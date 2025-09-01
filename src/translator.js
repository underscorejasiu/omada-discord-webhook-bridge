/**
 * Translator module for converting Omada webhook payloads to Discord webhook format
 */

const EVENT_TYPES = {
  CRITICAL: 'CRITICAL',
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  ATTACK: 'ATTACK',
  INTRUSION: 'INTRUSION',
  DEVICE_OFFLINE: 'DEVICE_OFFLINE',
  DEVICE_ONLINE: 'DEVICE_ONLINE',
  CLIENT_CONNECTED: 'CLIENT_CONNECTED',
  CLIENT_DISCONNECTED: 'CLIENT_DISCONNECTED',
  FIRMWARE_UPDATE: 'FIRMWARE_UPDATE',
  CONFIG_CHANGE: 'CONFIG_CHANGE',
  DEFAULT: 'DEFAULT',
  DHCP: 'DHCP',
  LOGS: 'LOGS',
  LOGGED_IN_OUT: 'LOGGED_IN_OUT',
  TEST: 'TEST',
  BANDWIDTH_LIMIT: 'BANDWIDTH_LIMIT',
  AUTHENTICATION_FAILURE: 'AUTHENTICATION_FAILURE',
};
/**
 * Maps Omada alert types to Discord embed colors
 */
const ALERT_COLORS_MAPPING = {
  [EVENT_TYPES.CRITICAL]: 0xFF0000, // Red
  [EVENT_TYPES.ERROR]: 0xFF4500,    // Orange Red
  [EVENT_TYPES.WARNING]: 0xFFA500,  // Orange
  [EVENT_TYPES.INFO]: 0x00BFFF,     // Deep Sky Blue
  [EVENT_TYPES.SUCCESS]: 0x00FF00,  // Green
  [EVENT_TYPES.ATTACK]: 0x8B0000,   // Dark Red
  [EVENT_TYPES.INTRUSION]: 0x8B0000, // Dark Red
  [EVENT_TYPES.DEVICE_OFFLINE]: 0xFF4500, // Orange Red
  [EVENT_TYPES.DEVICE_ONLINE]: 0x00FF00,  // Green
  [EVENT_TYPES.CLIENT_CONNECTED]: 0x00FF00, // Green
  [EVENT_TYPES.CLIENT_DISCONNECTED]: 0xFFA500, // Orange
  [EVENT_TYPES.FIRMWARE_UPDATE]: 0x00BFFF, // Deep Sky Blue
  [EVENT_TYPES.CONFIG_CHANGE]: 0x00BFFF,   // Deep Sky Blue
  [EVENT_TYPES.DEFAULT]: 0x7289DA,  // Discord Blurple
  [EVENT_TYPES.DHCP]: 0x7289DA,  // Discord Blurple
  [EVENT_TYPES.LOGS]: 0x7289DA,  // Discord Blurple
  [EVENT_TYPES.LOGGED_IN_OUT]: 0x7289DA,  // Discord Blurple
  [EVENT_TYPES.BANDWIDTH_LIMIT]: 0x7289DA,  // Discord Blurple
  [EVENT_TYPES.AUTHENTICATION_FAILURE]: 0x7289DA,  // Discord Blurple
  [EVENT_TYPES.TEST]: 0x7289DA,  // Discord Blurple
};

/**
 * Maps Omada event types to user-friendly titles
 */
const EVENT_TITLES = {
  [EVENT_TYPES.ATTACK]: '🚨 Attack Detected',
  [EVENT_TYPES.INTRUSION]: '🚨 Intrusion Detected', 
  [EVENT_TYPES.DEVICE_OFFLINE]: '📴 Device Offline',
  [EVENT_TYPES.DEVICE_ONLINE]: '📶 Device Online',
  [EVENT_TYPES.CLIENT_CONNECTED]: '✅ Client Connected',
  [EVENT_TYPES.CLIENT_DISCONNECTED]: '❌ Client Disconnected',
  [EVENT_TYPES.FIRMWARE_UPDATE]: '🔄 Firmware Update',
  [EVENT_TYPES.CONFIG_CHANGE]: '⚙️ Configuration Change',
  [EVENT_TYPES.DHCP]: '🖥️ DHCP',
  [EVENT_TYPES.LOGS]: '📃 Logs',
  [EVENT_TYPES.BANDWIDTH_LIMIT]: '⚠️ Bandwidth Limit Exceeded',
  [EVENT_TYPES.AUTHENTICATION_FAILURE]: '🔐 Authentication Failure',
  [EVENT_TYPES.LOGGED_IN_OUT]: '👤 Logged In/Out',
  [EVENT_TYPES.TEST]: '🧪 Test',
  [EVENT_TYPES.DEFAULT]: '📢 Omada Alert',
};

const EVENT_TYPES_MAP = [
	{ regex: /attack/i, type: EVENT_TYPES.ATTACK }, 
  { regex: /flood/i, type: EVENT_TYPES.ATTACK }, 
  { regex: /intrusion/i, type: EVENT_TYPES.INTRUSION }, 
	{ regex: /error|failed/i, type: EVENT_TYPES.ERROR },
	{ regex: /dhcp/i, type: EVENT_TYPES.DHCP }, 
	{ regex: /logs/i, type: EVENT_TYPES.LOGS },
	{ regex: /logged (?:out|in)/i, type: EVENT_TYPES.LOGGED_IN_OUT },
	{ regex: /success/i, type: EVENT_TYPES.SUCCESS },
  { regex: /test/i, type: EVENT_TYPES.TEST },
  { regex: /device offline/i, type: EVENT_TYPES.DEVICE_OFFLINE },
  { regex: /device online/i, type: EVENT_TYPES.DEVICE_ONLINE },
  { regex: /client connected/i, type: EVENT_TYPES.CLIENT_CONNECTED },
  { regex: /client disconnected/i, type: EVENT_TYPES.CLIENT_DISCONNECTED },
  { regex: /firmware update/i, type: EVENT_TYPES.FIRMWARE_UPDATE },
  { regex: /configuration change/i, type: EVENT_TYPES.CONFIG_CHANGE },
  { regex: /bandwidth limit exceeded/i, type: EVENT_TYPES.BANDWIDTH_LIMIT },
  { regex: /authentication failure/i, type: EVENT_TYPES.AUTHENTICATION_FAILURE },
];


class OmadaToDiscordTranslator {
  translate(omadaPayload) {
    if (!omadaPayload || typeof omadaPayload !== 'object') {
      throw new Error('Invalid Omada payload');
    }

    const {
      description,
      text,
      timestamp: omadaTimestamp
    } = omadaPayload;

    const message = description || (Array.isArray(text) ? text.join(' ') : text) || 'No message provided';
    const timestamp = omadaTimestamp ? new Date(omadaTimestamp).toISOString() : new Date().toISOString();
    const type = EVENT_TYPES_MAP.find(({ regex }) => regex.test(text));
    const color = this.getEmbedColor(type);
    const title = EVENT_TITLES[type] || EVENT_TITLES.DEFAULT;

    const embed = {
      title,
      description: message,
      color,
      timestamp,
      fields: this.buildFields(omadaPayload),
    };

    const discordPayload = {
      username: 'Omada Controller',
      avatar_url: 'https://static.tp-link.com/favicon.ico',
      embeds: [embed]
    };

    if (this.shouldMention(type)) {
      discordPayload.content = '@here';
    }

    return discordPayload;
  }

  getEmbedColor(type) {
    if (ALERT_COLORS_MAPPING[type]) {
      return ALERT_COLORS_MAPPING[type];
    }
    
    return ALERT_COLORS_MAPPING.DEFAULT;
  }

  buildFields(payload) {
    const fields = [];

    if (payload.Site) {
      fields.push({
        name: '🏢 Site',
        value: payload.Site,
        inline: true
      });
    }

    if (payload.Controller) {
      fields.push({
        name: '🎛️ Controller',
        value: payload.Controller,
        inline: true
      });
    }

    if (payload.text && Array.isArray(payload.text) && payload.text.length > 0) {
      fields.push({
        name: '📋 Details',
        value: payload.text.join('\n'),
        inline: false
      });
    }

    return fields;
  }

  shouldMention(type) {
    const criticalTypes = [EVENT_TYPES.ATTACK, EVENT_TYPES.INTRUSION];
    
    return criticalTypes.includes(type);
  }
}

module.exports = OmadaToDiscordTranslator;
