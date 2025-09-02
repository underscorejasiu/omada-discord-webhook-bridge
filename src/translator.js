const { EVENT_TYPES, EVENT_TITLES, EVENT_TYPES_MAP } = require('./data');

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
    
    const matchedEvent = EVENT_TYPES_MAP.find(({ regex }) => regex.test(message));
    const type = matchedEvent ? matchedEvent.type : EVENT_TYPES.DEFAULT;
    const title = EVENT_TITLES[type] || EVENT_TITLES[EVENT_TYPES.DEFAULT];

    const embed = {
      title,
      description: message,
      color: 0x7289DA,
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
