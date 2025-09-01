# Omada Discord Webhook Bridge

A robust Node.js bridge that translates TP-Link Omada Controller webhook notifications into Discord webhook messages with rich formatting and security features.

## Features

- 🔄 **Real-time Translation**: Converts Omada webhook payloads to Discord-compatible format
- 🎨 **Rich Discord Embeds**: Beautiful formatting with colors, fields, and status indicators
- 🔒 **Security**: Optional shard secret authentication and input validation
- 📊 **Comprehensive Logging**: Detailed logging for monitoring and debugging
- 🚀 **High Performance**: Built with Express.js for fast webhook processing
- 🛡️ **Error Handling**: Robust error handling and graceful degradation
- 📱 **Alert Prioritization**: Automatic @mentions for critical alerts
- 🔧 **Flexible Configuration**: Environment variables or JSON configuration file

## Quick Start

### 1. Installation

```bash
git clone https://github.com/your-username/omada-discord-webhook-bridge.git
cd omada-discord-webhook-bridge
npm install
```

### 2. Discord Setup

1. Open Discord and navigate to your server
2. Create or select a channel for alerts (e.g., `#omada-alerts`)
3. Right-click the channel → "Edit Channel" → "Integrations"
4. Click "Create Webhook"
5. Set a name (e.g., "Omada Controller") and copy the webhook URL
6. Save the webhook

### 3. Configuration

Choose one of the following configuration methods:

#### Option A: Environment Variables

Create a `.env` file:

```bash
cp env.example .env
```

Edit `.env`:
```env
PORT=3000
NODE_ENV=production
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
DISCORD_RATE_LIMIT_DELAY=1000
SHARD_SECRET=your_secure_secret_here
ENABLE_CORS=true
ENABLE_HELMET=true
```

#### Option B: JSON Configuration

Copy the example config:
```bash
cp config.example.json config.json
```

Edit `config.json`:
```json
{
  "server": {
    "port": 3000,
    "nodeEnv": "production"
  },
  "discord": {
    "webhookUrl": "https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN",
    "rateLimitDelay": 1000
  },
  "security": {
    "shardSecret": "your_secure_secret_here"
  }
}
```

### 4. Start the Bridge

```bash
# Production
npm start

# Development with auto-restart
npm run dev
```

### 5. Configure Omada Controller

1. Open your Omada Controller web interface
2. Go to **Settings** → **Notifications** → **Webhook**
3. Enable webhook notifications
4. Set webhook URL to: `http://your-server:3000/webhook/omada`
5. If using shard secret, add header: `X-Shard-Secret: your_secure_secret_here`

## API Endpoints

### `POST /webhook/omada`
Main endpoint for receiving Omada webhook notifications.

**Headers:**
- `Content-Type: application/json`
- `X-Shard-Secret: your_secret` (if authentication enabled)

**Example Omada Payload:**
```json
{
  "type": "DEVICE_OFFLINE",
  "severity": "WARNING", 
  "timestamp": "2024-01-15T10:30:00Z",
  "message": "Device has gone offline",
  "device": {
    "name": "Office AP",
    "mac": "AA:BB:CC:DD:EE:FF",
    "ip": "192.168.1.100",
    "model": "EAP660 HD",
    "type": "ACCESS_POINT"
  },
  "site": {
    "name": "Main Office"
  }
}
```

### `GET /health`
Health check endpoint for monitoring.

### `GET /test/discord`
Test Discord webhook connectivity.

## Discord Message Format

The bridge creates rich Discord embeds with:

- **Colors**: Based on severity/alert type (red for critical, orange for warnings, etc.)
- **Emojis**: Visual indicators for different event types
- **Fields**: Device info, client info, site details
- **Timestamps**: When the event occurred
- **Mentions**: @here for critical alerts

### Example Discord Output

```
🚨 Attack Detected
An intrusion attempt has been detected on the network

📱 Device: Office Router
**Name:** Office Router
**MAC:** AA:BB:CC:DD:EE:FF  
**IP:** 192.168.1.1

⚠️ Severity: CRITICAL

🏢 Site: Main Office

Omada Controller • Today at 10:30 AM
```

## Supported Event Types

| Omada Event | Discord Title | Color | Mentions |
|-------------|---------------|-------|----------|
| ATTACK_DETECTED | 🚨 Attack Detected | Red | @here |
| INTRUSION_DETECTED | 🚨 Intrusion Detected | Red | @here |
| DEVICE_OFFLINE | 📴 Device Offline | Orange | No |
| DEVICE_ONLINE | 📶 Device Online | Green | No |
| CLIENT_CONNECTED | ✅ Client Connected | Green | No |
| CLIENT_DISCONNECTED | ❌ Client Disconnected | Orange | No |
| FIRMWARE_UPDATE | 🔄 Firmware Update | Blue | No |
| CONFIG_CHANGE | ⚙️ Configuration Change | Blue | No |

## Security Features

### Authentication
- **Shard Secret**: Validates incoming webhooks using `X-Shard-Secret` header
- **IP Filtering**: Can be configured at reverse proxy level
- **Input Sanitization**: Prevents XSS and injection attacks

### Security Headers
- **Helmet.js**: Adds security headers
- **CORS**: Configurable cross-origin policies
- **Request Size Limits**: Prevents DoS attacks

## Deployment

### Docker (Recommended)

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t omada-discord-bridge .
docker run -d -p 3000:3000 --env-file .env omada-discord-bridge
```

### PM2 (Production)

```bash
npm install -g pm2
pm2 start src/server.js --name omada-bridge
pm2 save
pm2 startup
```

### Systemd Service

Create `/etc/systemd/system/omada-bridge.service`:
```ini
[Unit]
Description=Omada Discord Webhook Bridge
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=/opt/omada-bridge
ExecStart=/usr/bin/node src/server.js
Restart=always
EnvironmentFile=/opt/omada-bridge/.env

[Install]
WantedBy=multi-user.target
```

## Monitoring and Logging

### Log Levels
- **info**: General operation messages
- **warn**: Non-critical issues
- **error**: Error conditions
- **debug**: Detailed debugging information

### Health Monitoring
- Monitor `/health` endpoint
- Check Discord connectivity with `/test/discord`
- Monitor server logs for errors

### Prometheus Metrics (Future Enhancement)
Planned metrics:
- Webhook processing rate
- Error rates by type
- Discord API response times
- Message delivery success rate

## Troubleshooting

### Common Issues

**Discord webhook not working:**
```bash
curl -X GET http://localhost:3000/test/discord
```

**Invalid webhook URL:**
- Ensure URL format: `https://discord.com/api/webhooks/ID/TOKEN`
- Check permissions on Discord channel

**Authentication errors:**
- Verify `X-Shard-Secret` header matches configuration
- Check Omada Controller webhook settings

**Connection refused:**
- Verify server is running: `curl http://localhost:3000/health`
- Check firewall settings
- Ensure correct port binding

### Debug Mode

Start with debug logging:
```bash
LOG_LEVEL=debug npm start
```

## Development

### Running Tests
```bash
npm test
```

### Code Style
```bash
npm run lint
npm run format
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

### v1.0.0
- Initial release
- Full Omada to Discord translation
- Security authentication
- Rich Discord embeds
- Comprehensive error handling

## Support

- **Issues**: [GitHub Issues](https://github.com/your-username/omada-discord-webhook-bridge/issues)
- **Documentation**: See `/docs` folder
- **Discord**: Join our [support server](https://discord.gg/your-invite)

---

**Made with ❤️ for the Omada community**
