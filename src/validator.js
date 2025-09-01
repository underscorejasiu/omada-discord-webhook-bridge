const Joi = require('joi');

/**
 * Input validation schemas and utilities
 */

// Schema for Omada webhook payload validation
const omadaWebhookSchema = Joi.object({
  Site: Joi.string().optional(),
  description: Joi.string().optional(),
  shardSecret: Joi.string().optional(),
  text: Joi.array().items(Joi.string()).optional(),
  Controller: Joi.string().optional(),
  timestamp: Joi.date().timestamp().optional(),
}).unknown(true);

// Schema for configuration validation
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
  /**
   * Validates an Omada webhook payload
   * @param {Object} payload - The payload to validate
   * @returns {Object} Validation result
   */
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

  /**
   * Validates configuration object
   * @param {Object} config - The configuration to validate
   * @returns {Object} Validation result
   */
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

  /**
   * Validates shard secret for webhook authentication
   * @param {string} providedSecret - Secret from request header
   * @param {string} expectedSecret - Expected secret from config
   * @returns {boolean} Whether the secret is valid
   */
  validateShardSecret(providedSecret, expectedSecret) {
    if (!expectedSecret) {
      // If no secret is configured, allow all requests
      return true;
    }

    if (!providedSecret) {
      return false;
    }

    // Use timing-safe comparison to prevent timing attacks
    return this.timingSafeEqual(providedSecret, expectedSecret);
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {boolean} Whether strings are equal
   */
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

  /**
   * Sanitizes input to prevent XSS and injection attacks
   * @param {string} input - Input string to sanitize
   * @returns {string} Sanitized string
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }

    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim()
      .substring(0, 1000); // Limit length
  }

  /**
   * Validates and sanitizes an entire object recursively
   * @param {Object} obj - Object to sanitize
   * @returns {Object} Sanitized object
   */
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
        // Sanitize both key and value
        const sanitizedKey = this.sanitizeInput(key);
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Validates IP address format
   * @param {string} ip - IP address to validate
   * @returns {boolean} Whether IP is valid
   */
  isValidIP(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Validates MAC address format
   * @param {string} mac - MAC address to validate
   * @returns {boolean} Whether MAC is valid
   */
  isValidMAC(mac) {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
  }

  /**
   * Validates HTTP request headers for security
   * @param {Object} headers - Request headers
   * @returns {Object} Validation result
   */
  validateHeaders(headers) {
    const issues = [];

    // Check for required headers in webhook requests
    const contentType = headers['content-type'];
    if (contentType && !contentType.includes('application/json')) {
      issues.push('Content-Type should be application/json');
    }

    // Check for potentially dangerous headers
    const dangerousHeaders = ['x-forwarded-for', 'x-real-ip'];
    dangerousHeaders.forEach(header => {
      if (headers[header]) {
        // Log but don't reject - these might be legitimate in some setups
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
