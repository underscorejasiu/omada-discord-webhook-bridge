const axios = require('axios');
const config = require('./config');

/**
 * Discord webhook sender service
 */
class DiscordSender {
  constructor() {
    this.webhookUrl = config.get('discord.webhookUrl');
    this.rateLimitDelay = config.get('discord.rateLimitDelay') || 1000; // Rate limiting delay in milliseconds
    this.lastSentTime = 0;
  }

  /**
   * Sends a message to Discord webhook
   * @param {Object} payload - Discord webhook payload
   * @returns {Promise<Object>} Response from Discord API
   */
  async send(payload) {
    try {
      // Validate payload
      this.validatePayload(payload);

      // Apply rate limiting
      await this.handleRateLimit();

      // Send the webhook
      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Omada-Discord-Bridge/1.0.0'
        },
        timeout: 10000 // 10 second timeout
      });

      this.lastSentTime = Date.now();

      console.log(`[${new Date().toISOString()}] Successfully sent message to Discord`);
      
      return {
        success: true,
        status: response.status,
        message: 'Message sent successfully'
      };

    } catch (error) {
      console.error(`[${new Date().toISOString()}] Failed to send message to Discord:`, error.message);
      
      if (error.response) {
        // Discord API error
        const { status, data } = error.response;
        
        if (status === 429) {
          // Rate limited
          console.error('Rate limited by Discord API');
          throw new Error(`Rate limited: ${data.message || 'Too many requests'}`);
        } else if (status === 400) {
          // Bad request
          console.error('Bad request to Discord API:', data);
          throw new Error(`Invalid payload: ${data.message || 'Bad request'}`);
        } else if (status === 404) {
          // Webhook not found
          throw new Error('Discord webhook not found - check your webhook URL');
        } else if (status >= 500) {
          // Discord server error
          throw new Error(`Discord server error: ${status}`);
        }
        
        throw new Error(`Discord API error: ${status} - ${data.message || 'Unknown error'}`);
      } else if (error.code === 'ECONNABORTED') {
        // Timeout
        throw new Error('Request timeout - Discord may be experiencing issues');
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        // Network error
        throw new Error('Network error - check your internet connection');
      } else {
        // Other errors
        throw new Error(`Failed to send webhook: ${error.message}`);
      }
    }
  }

  /**
   * Validates the Discord webhook payload
   * @param {Object} payload - The payload to validate
   */
  validatePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload must be an object');
    }

    // Check if payload has content or embeds
    if (!payload.content && (!payload.embeds || payload.embeds.length === 0)) {
      throw new Error('Payload must have either content or embeds');
    }

    // Validate content length
    if (payload.content && payload.content.length > 2000) {
      throw new Error('Content must be 2000 characters or less');
    }

    // Validate embeds
    if (payload.embeds) {
      if (!Array.isArray(payload.embeds)) {
        throw new Error('Embeds must be an array');
      }

      if (payload.embeds.length > 10) {
        throw new Error('Maximum 10 embeds allowed');
      }

      payload.embeds.forEach((embed, index) => {
        this.validateEmbed(embed, index);
      });
    }

    // Validate username length
    if (payload.username && payload.username.length > 80) {
      throw new Error('Username must be 80 characters or less');
    }

    return true;
  }

  /**
   * Validates a single embed
   * @param {Object} embed - The embed to validate
   * @param {number} index - The embed index for error reporting
   */
  validateEmbed(embed, index) {
    if (!embed || typeof embed !== 'object') {
      throw new Error(`Embed ${index} must be an object`);
    }

    // Validate title
    if (embed.title && embed.title.length > 256) {
      throw new Error(`Embed ${index} title must be 256 characters or less`);
    }

    // Validate description
    if (embed.description && embed.description.length > 4096) {
      throw new Error(`Embed ${index} description must be 4096 characters or less`);
    }

    // Validate fields
    if (embed.fields) {
      if (!Array.isArray(embed.fields)) {
        throw new Error(`Embed ${index} fields must be an array`);
      }

      if (embed.fields.length > 25) {
        throw new Error(`Embed ${index} can have maximum 25 fields`);
      }

      embed.fields.forEach((field, fieldIndex) => {
        if (!field.name || field.name.length > 256) {
          throw new Error(`Embed ${index} field ${fieldIndex} name must be 1-256 characters`);
        }
        if (!field.value || field.value.length > 1024) {
          throw new Error(`Embed ${index} field ${fieldIndex} value must be 1-1024 characters`);
        }
      });
    }

    // Validate footer
    if (embed.footer && embed.footer.text && embed.footer.text.length > 2048) {
      throw new Error(`Embed ${index} footer text must be 2048 characters or less`);
    }

    // Validate author
    if (embed.author && embed.author.name && embed.author.name.length > 256) {
      throw new Error(`Embed ${index} author name must be 256 characters or less`);
    }

    // Calculate total embed length
    const totalLength = this.calculateEmbedLength(embed);
    if (totalLength > 6000) {
      throw new Error(`Embed ${index} total length must be 6000 characters or less`);
    }
  }

  /**
   * Calculates the total character length of an embed
   * @param {Object} embed - The embed to calculate
   * @returns {number} Total character count
   */
  calculateEmbedLength(embed) {
    let total = 0;

    if (embed.title) total += embed.title.length;
    if (embed.description) total += embed.description.length;
    if (embed.footer && embed.footer.text) total += embed.footer.text.length;
    if (embed.author && embed.author.name) total += embed.author.name.length;

    if (embed.fields) {
      embed.fields.forEach(field => {
        total += field.name.length + field.value.length;
      });
    }

    return total;
  }

  /**
   * Handles rate limiting to avoid hitting Discord's limits
   */
  async handleRateLimit() {
    const timeSinceLastSent = Date.now() - this.lastSentTime;
    if (timeSinceLastSent < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastSent;
      console.log(`[${new Date().toISOString()}] Rate limiting: waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Tests the Discord webhook connection
   * @returns {Promise<Object>} Test result
   */
  async testConnection() {
    try {
      const testPayload = {
        embeds: [{
          title: '🧪 Connection Test',
          description: 'This is a test message from the Omada-Discord webhook bridge.',
          color: 0x00FF00,
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Omada Controller Bridge - Test'
          }
        }]
      };

      const result = await this.send(testPayload);
      return {
        success: true,
        message: 'Discord webhook connection successful'
      };
    } catch (error) {
      return {
        success: false,
        message: `Discord webhook connection failed: ${error.message}`
      };
    }
  }
}

module.exports = DiscordSender;
