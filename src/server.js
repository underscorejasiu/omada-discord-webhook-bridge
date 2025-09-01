const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const OmadaToDiscordTranslator = require('./translator');
const DiscordSender = require('./discord-sender');
const validator = require('./validator');

const app = express();
const translator = new OmadaToDiscordTranslator();
const discordSender = new DiscordSender();

try {
  config.validate();
  console.log(`[${new Date().toISOString()}] Configuration validated successfully`);
} catch (error) {
  console.error(`[${new Date().toISOString()}] Configuration error:`, error.message);
  process.exit(1);
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (config.get('options.enableHelmet') !== false) {
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
}

if (config.get('options.enableCors')) {
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? false : true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Shard-Secret']
  }));
}

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

const authenticateWebhook = (req, res, next) => {
  const expectedSecret = config.get('security.shardSecret');
  
  if (expectedSecret) {
    const providedSecret = req.headers['x-shard-secret'] || req.headers['access_token'] || req.headers['authorization']?.replace('Bearer ', '');
    if (!validator.validateShardSecret(providedSecret, expectedSecret)) {
      console.warn(`[${new Date().toISOString()}] Unauthorized webhook attempt from ${req.ip}`);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - Invalid or missing shard secret'
      });
    }
  }
  
  next();
};

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'omada-discord-webhook-bridge'
  });
});

app.get('/test/discord', async (req, res) => {
  try {
    const result = await discordSender.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/webhook/omada', authenticateWebhook, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Received Omada webhook:`, JSON.stringify(req.body, null, 2));

    // Validate headers
    const headerValidation = validator.validateHeaders(req.headers);
    if (!headerValidation.isValid) {
      console.warn(`[${new Date().toISOString()}] Header validation issues:`, headerValidation.issues);
    }

    // Sanitize input
    const sanitizedPayload = validator.sanitizeObject(req.body);

    // Validate Omada payload
    const payloadValidation = validator.validateOmadaPayload(sanitizedPayload);
    if (!payloadValidation.isValid) {
      console.error(`[${new Date().toISOString()}] Invalid Omada payload:`, payloadValidation.error);
      return res.status(400).json({
        success: false,
        error: `Invalid payload: ${payloadValidation.error}`
      });
    }

    // Translate to Discord format
    const discordPayload = translator.translate(payloadValidation.value);
    console.log(`[${new Date().toISOString()}] Translated to Discord format:`, JSON.stringify(discordPayload, null, 2));

    // Send to Discord
    const sendResult = await discordSender.send(discordPayload);

    res.json({
      success: true,
      message: 'Webhook processed and sent to Discord successfully',
      discordStatus: sendResult.status
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error processing webhook:`, error.message);
    console.error(error.stack);

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Unhandled error:`, error);
  
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON payload'
    });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Payload too large'
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /test/discord',
      'POST /webhook/omada'
    ]
  });
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`[${new Date().toISOString()}] Received ${signal}, shutting down gracefully...`);
  
  server.close(() => {
    console.log(`[${new Date().toISOString()}] Server closed`);
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error(`[${new Date().toISOString()}] Forced shutdown after timeout`);
    process.exit(1);
  }, 10000);
};

// Start the server
const port = config.get('server.port') || 3000;
const server = app.listen(port, () => {
  console.log(`[${new Date().toISOString()}] Omada-Discord webhook bridge started`);
  console.log(`[${new Date().toISOString()}] Server listening on port ${port}`);
  console.log(`[${new Date().toISOString()}] Environment: ${config.get('server.nodeEnv') || 'development'}`);
  console.log(`[${new Date().toISOString()}] Health check: http://localhost:${port}/health`);
  console.log(`[${new Date().toISOString()}] Webhook endpoint: http://localhost:${port}/webhook/omada`);
  
  if (config.get('security.shardSecret')) {
    console.log(`[${new Date().toISOString()}] Shard secret authentication enabled`);
  } else {
    console.warn(`[${new Date().toISOString()}] WARNING: No shard secret configured - webhook is publicly accessible`);
  }
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`[${new Date().toISOString()}] Uncaught Exception:`, error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${new Date().toISOString()}] Unhandled Rejection at:`, promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;
