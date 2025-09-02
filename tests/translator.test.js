const OmadaToDiscordTranslator = require('../src/translator');
const { EVENT_TYPES, EVENT_TITLES } = require('../src/data');

describe('OmadaToDiscordTranslator', () => {
  let translator;

  beforeEach(() => {
    translator = new OmadaToDiscordTranslator();
  });

  describe('translate', () => {
    test('should translate basic Omada payload', () => {
      const omadaPayload = {
        Site: 'Test Site',
        description: 'Test alert message',
        Controller: 'Test Controller',
        timestamp: 1704067200000
      };

      const result = translator.translate(omadaPayload);

      expect(result).toHaveProperty('username', 'Omada Controller');
      expect(result).toHaveProperty('embeds');
      expect(result.embeds).toHaveLength(1);
      expect(result.embeds[0]).toHaveProperty('title', EVENT_TITLES[EVENT_TYPES.TEST]);
      expect(result.embeds[0]).toHaveProperty('description', 'Test alert message');
      expect(result.embeds[0]).toHaveProperty('color', 0x7289DA);
    });

    test('should handle payload with text array', () => {
      const omadaPayload = {
        Site: 'Test Site',
        text: ['Line 1', 'Line 2', 'Line 3'],
        Controller: 'Test Controller',
        timestamp: 1704067200000
      };

      const result = translator.translate(omadaPayload);

      expect(result.embeds[0].description).toBe('Line 1 Line 2 Line 3');
      expect(result.embeds[0].fields).toContainEqual({
        name: '📋 Details',
        value: 'Line 1\nLine 2\nLine 3',
        inline: false
      });
    });

    test('should detect attack events and add mention', () => {
      const omadaPayload = {
        Site: 'Test Site',
        description: 'Attack detected from external source',
        Controller: 'Test Controller',
        timestamp: 1704067200000
      };

      const result = translator.translate(omadaPayload);

      expect(result).toHaveProperty('content', '@here');
      expect(result.embeds[0].title).toBe('🚨 Attack Detected');
    });

    test('should handle minimal payload', () => {
      const omadaPayload = {
        description: 'Simple message'
      };

      const result = translator.translate(omadaPayload);

      expect(result.embeds[0].description).toBe('Simple message');
      expect(result.embeds[0].fields).toHaveLength(0);
    });

    test('should throw error for invalid payload', () => {
      expect(() => translator.translate(null)).toThrow('Invalid Omada payload');
      expect(() => translator.translate('string')).toThrow('Invalid Omada payload');
      expect(() => translator.translate(123)).toThrow('Invalid Omada payload');
    });

    test('should use fallback message when no description or text', () => {
      const omadaPayload = {
        Site: 'Test Site',
        Controller: 'Test Controller'
      };

      const result = translator.translate(omadaPayload);

      expect(result.embeds[0].description).toBe('No message provided');
    });

    test('should handle timestamp correctly', () => {
      const timestamp = 1704067200000;
      const omadaPayload = {
        description: 'Test message',
        timestamp
      };

      const result = translator.translate(omadaPayload);

      expect(result.embeds[0].timestamp).toBe(new Date(timestamp).toISOString());
    });
  });

  describe('buildFields', () => {
    test('should build fields for complete payload', () => {
      const payload = {
        Site: 'Main Office',
        Controller: 'Omada Controller v5.13.30',
        text: ['Detail 1', 'Detail 2']
      };

      const fields = translator.buildFields(payload);

      expect(fields).toHaveLength(3);
      expect(fields[0]).toEqual({
        name: '🏢 Site',
        value: 'Main Office',
        inline: true
      });
      expect(fields[1]).toEqual({
        name: '🎛️ Controller',
        value: 'Omada Controller v5.13.30',
        inline: true
      });
      expect(fields[2]).toEqual({
        name: '📋 Details',
        value: 'Detail 1\nDetail 2',
        inline: false
      });
    });

    test('should handle empty payload', () => {
      const fields = translator.buildFields({});
      expect(fields).toHaveLength(0);
    });
  });

  describe('shouldMention', () => {
    test('should mention for attack events', () => {
      expect(translator.shouldMention('ATTACK')).toBe(true);
      expect(translator.shouldMention('INTRUSION')).toBe(true);
    });

    test('should not mention for normal events', () => {
      expect(translator.shouldMention('INFO')).toBe(false);
      expect(translator.shouldMention('DEFAULT')).toBe(false);
      expect(translator.shouldMention('DEVICE_OFFLINE')).toBe(false);
    });
  });
});
