const validator = require('../src/validator');

describe('Validator', () => {
  describe('validateOmadaPayload', () => {
    test('should validate correct Omada payload', () => {
      const payload = {
        Site: 'Test Site',
        description: 'Test message',
        Controller: 'Test Controller',
        timestamp: 1704067200000,
        text: ['Line 1', 'Line 2']
      };

      const result = validator.validateOmadaPayload(payload);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
      expect(result.value).toEqual({ ...payload, timestamp: new Date(1704067200000) });
    });

    test('should allow minimal payload', () => {
      const payload = {
        description: 'Simple message'
      };

      const result = validator.validateOmadaPayload(payload);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    test('should allow unknown fields', () => {
      const payload = {
        Site: 'Test Site',
        description: 'Test message',
        unknownField: 'unknown value',
        nested: {
          unknown: 'field'
        }
      };

      const result = validator.validateOmadaPayload(payload);

      expect(result.isValid).toBe(true);
      expect(result.value).toHaveProperty('unknownField', 'unknown value');
    });

    test('should validate text array', () => {
      const payload = {
        text: ['Valid', 'text', 'array']
      };

      const result = validator.validateOmadaPayload(payload);

      expect(result.isValid).toBe(true);
    });

    test('should reject invalid text array', () => {
      const payload = {
        text: ['Valid string', 123, 'Another string']
      };

      const result = validator.validateOmadaPayload(payload);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be a string');
    });

    test('should handle different timestamp formats', () => {
      const unixTimestamp = { timestamp: 1704067200 };
      const dateTimestamp = { timestamp: new Date() };

      expect(validator.validateOmadaPayload(unixTimestamp).isValid).toBe(true);
      expect(validator.validateOmadaPayload(dateTimestamp).isValid).toBe(true);
    });
  });

  describe('validateShardSecret', () => {
    test('should return true when no secret is configured', () => {
      const result = validator.validateShardSecret('any-secret', null);
      expect(result).toBe(true);
    });

    test('should return true when no secret is configured (undefined)', () => {
      const result = validator.validateShardSecret('any-secret', undefined);
      expect(result).toBe(true);
    });

    test('should return true for matching secrets', () => {
      const result = validator.validateShardSecret('test-secret', 'test-secret');
      expect(result).toBe(true);
    });

    test('should return false for non-matching secrets', () => {
      const result = validator.validateShardSecret('wrong-secret', 'test-secret');
      expect(result).toBe(false);
    });

    test('should return false when no secret provided but one expected', () => {
      const result = validator.validateShardSecret(null, 'expected-secret');
      expect(result).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    test('should remove HTML tags', () => {
      const result = validator.sanitizeInput('<script>alert("xss")</script>Hello');
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;Hello');
    });

    test('should remove javascript protocols', () => {
      const result = validator.sanitizeInput('javascript:alert("xss")');
      expect(result).toBe('javascript:alert(&quot;xss&quot;)');
    });

    test('should remove event handlers', () => {
      const result = validator.sanitizeInput('onclick=alert("xss")Hello');
      expect(result).toBe('onclick=alert(&quot;xss&quot;)Hello');
    });

    test('should trim whitespace', () => {
      const result = validator.sanitizeInput('  Hello World  ');
      expect(result).toBe('Hello World');
    });

    test('should limit length', () => {
      const longString = 'a'.repeat(1500);
      const result = validator.sanitizeInput(longString);
      expect(result).toHaveLength(1000);
    });

    test('should handle non-string input', () => {
      expect(validator.sanitizeInput(123)).toBe(123);
      expect(validator.sanitizeInput(null)).toBe(null);
      expect(validator.sanitizeInput(undefined)).toBe(undefined);
    });
  });

  describe('sanitizeObject', () => {
    test('should sanitize nested object', () => {
      const input = {
        'normal<script>': 'value<script>alert("xss")</script>',
        nested: {
          'key onclick=': 'javascript:alert("xss")'
        }
      };

      const result = validator.sanitizeObject(input);

      expect(result).toEqual({
        "normal&lt;script&gt;": "value&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
        nested: {
          "key onclick=": "javascript:alert(&quot;xss&quot;)"
        }
      });
    });

    test('should handle arrays', () => {
      const input = ['<script>test</script>', 'normal', 'javascript:alert()'];
      const result = validator.sanitizeObject(input);
      expect(result).toEqual(['&lt;script&gt;test&lt;/script&gt;', 'normal', 'javascript:alert()']);
    });
  });

  describe('isValidIP', () => {
    test('should validate IPv4 addresses', () => {
      expect(validator.isValidIP('192.168.1.1')).toBe(true);
      expect(validator.isValidIP('10.0.0.1')).toBe(true);
      expect(validator.isValidIP('255.255.255.255')).toBe(true);
    });

    test('should reject invalid IPv4 addresses', () => {
      expect(validator.isValidIP('256.1.1.1')).toBe(false);
      expect(validator.isValidIP('192.168.1')).toBe(false);
      expect(validator.isValidIP('not-an-ip')).toBe(false);
    });

    test('should validate IPv6 addresses', () => {
      expect(validator.isValidIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
    });
  });

  describe('isValidMAC', () => {
    test('should validate MAC addresses with colons', () => {
      expect(validator.isValidMAC('AA:BB:CC:DD:EE:FF')).toBe(true);
      expect(validator.isValidMAC('00:11:22:33:44:55')).toBe(true);
    });

    test('should validate MAC addresses with hyphens', () => {
      expect(validator.isValidMAC('AA-BB-CC-DD-EE-FF')).toBe(true);
    });

    test('should reject invalid MAC addresses', () => {
      expect(validator.isValidMAC('AA:BB:CC:DD:EE')).toBe(false);
      expect(validator.isValidMAC('GG:BB:CC:DD:EE:FF')).toBe(false);
      expect(validator.isValidMAC('not-a-mac')).toBe(false);
    });
  });
});
