const Joi = require('joi');

const omadaWebhookSchema = Joi.object({
  Site: Joi.string().optional(),
  description: Joi.string().optional(),
  shardSecret: Joi.string().optional(),
  text: Joi.array().items(Joi.string()).optional(),
  Controller: Joi.string().optional(),
  timestamp: Joi.date().timestamp().optional(),
}).unknown(true);

const configSchema = Joi.object({
  server: Joi.object({
    port: Joi.number().port().required(),
    nodeEnv: Joi.string().valid('development', 'production', 'test').optional()
  }).required(),
  discord: Joi.object({
    webhookUrl: Joi.string().uri().pattern(/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/).required()
  }).required(),
  security: Joi.object({
    shardSecret: Joi.string().min(8).optional()
  }).optional(),
  options: Joi.object({
    enableCors: Joi.boolean().optional(),
    enableHelmet: Joi.boolean().optional(),
    logLevel: Joi.string().valid('error', 'warn', 'info', 'debug').optional()
  }).optional(),
  omada: Joi.object({
    controllerUrl: Joi.string().uri().optional()
  }).optional()
});

class Validator {
  validateOmadaPayload(payload) {
    const { error, value } = omadaWebhookSchema.validate(payload, {
      allowUnknown: true,
      stripUnknown: false
    });

    if (error) {
      return {
        isValid: false,
        error: error.details[0].message,
        value: null
      };
    }

    return {
      isValid: true,
      error: null,
      value
    };
  }

  validateConfig(config) {
    const { error, value } = configSchema.validate(config);

    if (error) {
      return {
        isValid: false,
        error: error.details[0].message,
        value: null
      };
    }

    return {
      isValid: true,
      error: null,
      value
    };
  }

  validateShardSecret(providedSecret, expectedSecret) {
    if (!expectedSecret) {
      return true;
    }

    if (!providedSecret) {
      return false;
    }

    return this.timingSafeEqual(providedSecret, expectedSecret);
  }
  timingSafeEqual(a, b) {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }

    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .trim()
      .substring(0, 1000);
  }

  sanitizeObject(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeInput(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeInput(key);
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  isValidIP(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  isValidMAC(mac) {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
  }

  validateHeaders(headers) {
    const issues = [];

    const contentType = headers['content-type'];
    if (contentType && !contentType.includes('application/json')) {
      issues.push('Content-Type should be application/json');
    }

    const dangerousHeaders = ['x-forwarded-for', 'x-real-ip'];
    dangerousHeaders.forEach(header => {
      if (headers[header]) {
        console.warn(`Potentially dangerous header detected: ${header}`);
      }
    });

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

module.exports = new Validator();
