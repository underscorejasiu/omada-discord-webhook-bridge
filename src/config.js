const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

/**
 * Configuration management for the Omada-Discord webhook bridge
 */
class Config {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    // Try to load from environment variables first
    if (process.env.DISCORD_WEBHOOK_URL) {
      return {
        server: {
          port: parseInt(process.env.PORT) || 3000,
          nodeEnv: process.env.NODE_ENV || 'development'
        },
        discord: {
          webhookUrl: process.env.DISCORD_WEBHOOK_URL,
          rateLimitDelay: parseInt(process.env.DISCORD_RATE_LIMIT_DELAY) || 1000
        },
        security: {
          shardSecret: process.env.SHARD_SECRET
        },
        options: {
          enableCors: process.env.ENABLE_CORS === 'true',
          enableHelmet: process.env.ENABLE_HELMET !== 'false',
          logLevel: process.env.LOG_LEVEL || 'info'
        },
        omada: {
          controllerUrl: process.env.OMADA_CONTROLLER_URL
        }
      };
    }

    // Fallback to config.json file
    const configPath = path.join(process.cwd(), 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const configFile = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configFile);
      } catch (error) {
        console.error('Error reading config.json:', error.message);
        throw new Error('Invalid configuration file');
      }
    }

    throw new Error('No configuration found. Please set environment variables or create config.json');
  }

  get(key) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  validate() {
    const required = [
      'discord.webhookUrl'
    ];

    const missing = required.filter(key => !this.get(key));
    
    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    // Validate Discord webhook URL format
    const webhookUrl = this.get('discord.webhookUrl');
    if (!webhookUrl.match(/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/)) {
      throw new Error('Invalid Discord webhook URL format');
    }

    return true;
  }
}

module.exports = new Config();
