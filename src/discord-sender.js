const { WebhookClient, EmbedBuilder } = require('discord.js');
const config = require('./config');

class DiscordSender {
  constructor() {
    const webhookUrl = config.get('discord.webhookUrl');
    this.rateLimitDelay = config.get('discord.rateLimitDelay') || 1000;
    this.lastSentTime = 0;
    
    // Extract webhook ID and token from URL
    const urlParts = webhookUrl.match(/https:\/\/discord\.com\/api\/webhooks\/(\d+)\/(.+)/);
    if (!urlParts) {
      throw new Error('Invalid Discord webhook URL format');
    }
    
    this.webhookClient = new WebhookClient({
      id: urlParts[1],
      token: urlParts[2]
    });
  }

  async send(payload) {
    try {
      // Apply rate limiting
      await this.handleRateLimit();

      // Convert payload to discord.js format
      const options = {
        username: payload.username || 'Omada Controller',
        avatarURL: payload.avatar_url
      };

      if (payload.content) {
        options.content = payload.content;
      }

      if (payload.embeds && payload.embeds.length > 0) {
        options.embeds = payload.embeds.map(embedData => {
          const embed = new EmbedBuilder()
            .setTitle(embedData.title)
            .setDescription(embedData.description)
            .setTimestamp(embedData.timestamp ? new Date(embedData.timestamp) : new Date());

          if (embedData.color) {
            embed.setColor(embedData.color);
          }

          if (embedData.fields && embedData.fields.length > 0) {
            embedData.fields.forEach(field => {
              embed.addFields({
                name: field.name,
                value: field.value,
                inline: field.inline || false
              });
            });
          }

          if (embedData.footer) {
            embed.setFooter({
              text: embedData.footer.text,
              iconURL: embedData.footer.icon_url
            });
          }

          if (embedData.thumbnail && embedData.thumbnail.url) {
            embed.setThumbnail(embedData.thumbnail.url);
          }

          if (embedData.author) {
            embed.setAuthor({
              name: embedData.author.name,
              iconURL: embedData.author.icon_url,
              url: embedData.author.url
            });
          }

          return embed;
        });
      }

      const message = await this.webhookClient.send(options);
      this.lastSentTime = Date.now();

      console.log(`[${new Date().toISOString()}] Successfully sent message to Discord`);
      
      return {
        success: true,
        messageId: message.id,
        message: 'Message sent successfully'
      };

    } catch (error) {
      console.error(`[${new Date().toISOString()}] Failed to send message to Discord:`, error.message);
      
      if (error.code === 10015) {
        throw new Error('Discord webhook not found - check your webhook URL');
      } else if (error.code === 50035) {
        throw new Error(`Invalid payload: ${error.message}`);
      } else if (error.status === 429) {
        throw new Error(`Rate limited: ${error.message}`);
      } else if (error.status >= 500) {
        throw new Error(`Discord server error: ${error.status}`);
      } else {
        throw new Error(`Failed to send webhook: ${error.message}`);
      }
    }
  }

  async handleRateLimit() {
    const timeSinceLastSent = Date.now() - this.lastSentTime;
    if (timeSinceLastSent < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastSent;
      console.log(`[${new Date().toISOString()}] Rate limiting: waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

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

      await this.send(testPayload);
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

  destroy() {
    if (this.webhookClient) {
      this.webhookClient.destroy();
    }
  }
}

module.exports = DiscordSender;
