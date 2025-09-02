const config = require('./src/config');

function createTimeoutSignal(timeoutMs) {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  } else {
    // Fallback for Node.js < 16.14.0
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
  }
}

const testPayloads = {
  deviceOffline: {
    site: 'Main Office',
    description: 'Device "Office AP" has gone offline',
    text: ['Device Offline', 'Office AP (AA:BB:CC:DD:EE:FF) has disconnected'],
    Controller: 'Omada Controller v5.13.30',
    timestamp: Date.now()
  },

  attackDetected: {
    site: 'Main Office',
    description: 'Critical: Potential DDoS attack detected from external source',
    text: ['Security Alert', 'DDoS attack detected from 203.0.113.15', 'Target: Gateway Router'],
    Controller: 'Omada Controller v5.13.30',
    timestamp: Date.now()
  },

  clientConnected: {
    site: 'Main Office',
    description: 'New client connected to wireless network',
    text: ['Client Connected', 'John-iPhone connected to Office-WiFi via Conference Room AP'],
    Controller: 'Omada Controller v5.13.30',
    timestamp: Date.now()
  },

  firmwareUpdate: {
    site: 'Main Office',
    description: 'Firmware update completed successfully',
    text: ['Firmware Update', 'Lobby Switch updated to version 1.0.5', 'Update completed in 3 minutes'],
    Controller: 'Omada Controller v5.13.30',
    timestamp: Date.now()
  },

  basicAlert: {
    site: 'Main Office',
    description: 'Connection timeout detected',
    Controller: 'Omada Controller',
    timestamp: Date.now()
  },

  minimalPayload: {
    description: 'Simple alert message',
    timestamp: Date.now()
  },

  testDiscordJS: {
    Site: 'Test Site',
    description: 'Testing discord.js implementation',
    text: ['Test message', 'Discord.js WebhookClient integration'],
    Controller: 'Omada Controller Test',
    timestamp: Date.now()
  }
};

async function testWebhook(endpoint = 'http://localhost:3000/webhook/omada', secret = null) {
  console.log('🧪 Testing Omada Discord Webhook Bridge');
  console.log(`📡 Endpoint: ${endpoint}`);
  console.log(`🔐 Secret: ${secret ? '***configured***' : 'none'}\n`);

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Omada-Test-Client/1.0.0'
  };

  if (secret) {
    headers['X-Shard-Secret'] = secret;
  }

  let successCount = 0;
  let failureCount = 0;

  for (const [testName, payload] of Object.entries(testPayloads)) {
    try {
      console.log(`📤 Testing: ${testName}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: createTimeoutSignal(10000) // 10 second timeout
      });

      if (response.ok) {
        console.log(`✅ ${testName}: SUCCESS`);
        successCount++;
      } else {
        console.log(`❌ ${testName}: FAILED (Status: ${response.status})`);
        failureCount++;
      }

      // Wait 1 second between requests to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.log(`❌ ${testName}: FAILED`);
      if (error.name === 'AbortError') {
        console.log(`   Error: Request timeout`);
      } else if (error.cause && error.cause.code) {
        console.log(`   Error: ${error.cause.code} - ${error.message}`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
      failureCount++;
    }
  }

  console.log('\n📊 Test Results:');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`📈 Success Rate: ${Math.round((successCount / (successCount + failureCount)) * 100)}%`);

  if (failureCount === 0) {
    console.log('\n🎉 All tests passed! Your webhook bridge is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check your configuration and Discord webhook URL.');
  }
}

// Test health endpoint
async function testHealth(baseUrl = 'http://localhost:3000') {
  try {
    console.log('🏥 Testing health endpoint...');
    const response = await fetch(`${baseUrl}/health`, {
      signal: createTimeoutSignal(5000)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Health check: PASSED');
      console.log(`   Status: ${data.status}`);
      console.log(`   Version: ${data.version}`);
      return true;
    } else {
      console.log(`❌ Health check: FAILED (Status: ${response.status})`);
      return false;
    }
  } catch (error) {
    console.log('❌ Health check: FAILED');
    if (error.name === 'AbortError') {
      console.log(`   Error: Request timeout`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    return false;
  }
}

// Test Discord connectivity
async function testDiscord(baseUrl = 'http://localhost:3000') {
  try {
    console.log('🔗 Testing Discord connectivity...');
    const response = await fetch(`${baseUrl}/test/discord`, {
      signal: createTimeoutSignal(10000)
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        console.log('✅ Discord test: PASSED');
        return true;
      } else {
        console.log('❌ Discord test: FAILED');
        console.log(`   Error: ${data.message || 'Unknown error'}`);
        return false;
      }
    } else {
      const data = await response.json().catch(() => ({}));
      console.log('❌ Discord test: FAILED');
      console.log(`   Error: ${data.error || `HTTP ${response.status}`}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Discord test: FAILED');
    if (error.name === 'AbortError') {
      console.log(`   Error: Request timeout`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    return false;
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const endpoint = args[0] || 'http://localhost:3000/webhook/omada';
  const secret = args[1] || process.env.SHARD_SECRET;
  const baseUrl = endpoint.replace('/webhook/omada', '');

  console.log('🚀 Starting Omada Discord Bridge Tests\n');

  // Test health first
  const healthOk = await testHealth(baseUrl);
  if (!healthOk) {
    console.log('\n❌ Health check failed. Make sure the bridge is running.');
    process.exit(1);
  }

  console.log();

  // Test Discord connectivity
  const discordOk = await testDiscord(baseUrl);
  if (!discordOk) {
    console.log('\n⚠️  Discord connectivity test failed. Check your webhook URL.');
  }

  console.log();

  // Test webhooks
  await testWebhook(endpoint, secret);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Test script failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testWebhook, testHealth, testDiscord };
