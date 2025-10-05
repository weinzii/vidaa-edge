#!/usr/bin/env node
/**
 * VIDAA Enhanced Function Receiver Server
 * Erweiterte Version - empfängt Funktionen und leitet Befehle weiter
 *
 * Features:
 * - Empfang von Hisense-Funktionen vom VIDAA TV (Port 3000)
 * - Remote Console API für Laptop-Steuerung (Port 3001)
 * - Weiterleitung von Befehlen an das VIDAA TV
 *
 * Usage: node enhanced-receiver.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const RECEIVER_PORT = 3000; // Unified port for everything
const OUTPUT_DIR = './received-functions';

// TV Connection State
let tvConnectionInfo = {
  connected: false,
  lastSeen: null,
  ipAddress: null,
  deviceInfo: null,
};

// Command queue for TV
let commandQueue = [];
let isProcessingCommands = false;

// Stelle sicher, dass Output-Verzeichnis existiert
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * ===== TV RECEIVER SERVER (Port 3000) =====
 * Empfängt Funktionen vom VIDAA TV
 */
const receiverServer = http.createServer((req, res) => {
  console.log(
    `🖥️  TV Request: ${req.method} ${req.url} from ${req.connection.remoteAddress}`
  );

  // CORS Headers für VIDAA TV
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('✅ TV CORS preflight handled');
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/functions') {
    handleFunctionReceive(req, res);
  } else if (req.method === 'POST' && req.url === '/api/execute-response') {
    handleExecuteResponse(req, res);
  } else if (req.method === 'GET' && req.url === '/api/command-check') {
    handleCommandCheck(req, res);
  } else if (
    req.method === 'GET' &&
    (req.url === '/console' || req.url === '/remote-console')
  ) {
    // Serve Remote Console HTML for laptop access
    handleConsoleUI(req, res);
  } else if (req.method === 'GET' && req.url === '/api/status') {
    // Status API for Remote Console
    handleStatusRequest(req, res);
  } else if (req.method === 'POST' && req.url === '/api/remote-command') {
    // Remote Console: Funktions-Ausführung
    handleExecuteRequest(req, res);
  } else if (req.method === 'GET' && req.url === '/api/functions') {
    // Function list for Remote Console
    handleFunctionsList(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

/**
 * ===== REMOTE CONSOLE SERVER (Port 3001) =====
 * Für Laptop-Steuerung
 */
const consoleServer = { close: () => {}, on: () => {} }; // Dummy - Console Server removed
const _oldConsoleServer = http.createServer((req, res) => {
  console.log(
    `💻 Console Request: ${req.method} ${req.url} from ${req.connection.remoteAddress}`
  );

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/console')) {
    handleConsoleUI(req, res);
  } else if (req.method === 'GET' && req.url === '/api/status') {
    handleStatusRequest(req, res);
  } else if (req.method === 'POST' && req.url === '/api/execute') {
    handleExecuteRequest(req, res);
  } else if (req.method === 'POST' && req.url === '/api/functions') {
    // TV sendet Funktions-Upload (Original Funktion)
    handleFunctionReceive(req, res);
  } else if (req.method === 'GET' && req.url === '/api/functions') {
    handleFunctionsList(req, res);
  } else if (req.method === 'POST' && req.url === '/api/remote-command') {
    // Remote Console: Funktions-Ausführung (uses same handler as /api/execute)
    handleExecuteRequest(req, res);
  } else if (req.method === 'GET' && req.url === '/api/command-check') {
    // TV fragt nach Befehlen
    handleCommandCheck(req, res);
  } else if (req.method === 'POST' && req.url === '/api/execute-response') {
    // TV sendet Ausführungsergebnis zurück
    handleExecuteResponse(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

/**
 * ===== HANDLER FUNCTIONS =====
 */

// Serve Console UI
function handleConsoleUI(req, res) {
  try {
    const htmlPath = path.join(__dirname, 'remote-console.html');

    if (fs.existsSync(htmlPath)) {
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlContent);
      console.log('📱 Console UI served');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Remote Console</title></head>
        <body style="font-family: Arial; padding: 20px; background: #1a1a1a; color: white;">
          <h2>🚫 Remote Console nicht gefunden</h2>
          <p>Die Datei <code>remote-console.html</code> wurde nicht gefunden.</p>
          <p>Bitte stelle sicher, dass die Datei im gleichen Verzeichnis wie der Server liegt.</p>
          <hr>
          <p><strong>APIs verfügbar:</strong></p>
          <ul>
            <li><a href="/api/status" style="color: #4CAF50;">/api/status</a> - Server Status</li>
            <li><a href="/api/functions" style="color: #4CAF50;">/api/functions</a> - Verfügbare Funktionen</li>
          </ul>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('❌ Error serving console UI:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}

// TV sendet Funktionsdefinitionen
function handleFunctionReceive(req, res) {
  let body = '';

  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log(
        `📡 Received ${data.functions?.length || 0} functions from TV`
      );

      // Update TV connection info
      tvConnectionInfo.connected = true;
      tvConnectionInfo.lastSeen = new Date();
      tvConnectionInfo.ipAddress = req.connection.remoteAddress;
      tvConnectionInfo.deviceInfo = data.deviceInfo;

      // Speichere wie bisher
      saveFunctionData(data);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'success',
          message: 'Functions received',
          remoteConsoleAvailable: true,
        })
      );

      console.log('✅ TV connection established');
    } catch (error) {
      console.error('❌ Error processing TV functions:', error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: error.message }));
    }
  });
}

// TV fragt nach Befehlen
function handleCommandCheck(req, res) {
  tvConnectionInfo.connected = true;
  tvConnectionInfo.lastSeen = new Date();

  res.setHeader('Content-Type', 'application/json');

  if (commandQueue.length > 0) {
    const command = commandQueue.shift();
    console.log(`📤 Sending command to TV: ${command.function}`);

    res.writeHead(200);
    res.end(
      JSON.stringify({
        hasCommand: true,
        command: command,
      })
    );
  } else {
    res.writeHead(200);
    res.end(JSON.stringify({ hasCommand: false }));
  }
}

// TV sendet Ausführungsergebnis
function handleExecuteResponse(req, res) {
  let body = '';

  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const result = JSON.parse(body);
      console.log(
        `📥 Execution result: ${result.success ? 'SUCCESS' : 'ERROR'}`
      );

      // Store result for console to pick up
      result.timestamp = new Date().toISOString();
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `result-${Date.now()}.json`),
        JSON.stringify(result, null, 2)
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'received' }));
    } catch (error) {
      console.error('❌ Error processing execution result:', error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: error.message }));
    }
  });
}

// Console fragt Status ab
function handleStatusRequest(req, res) {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    tvConnected:
      tvConnectionInfo.connected &&
      tvConnectionInfo.lastSeen &&
      Date.now() - tvConnectionInfo.lastSeen.getTime() < 30000, // 30 sec timeout
    tvInfo: tvConnectionInfo.deviceInfo,
    commandQueueLength: commandQueue.length,
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(status));
}

// Console sendet Ausführungsbefehl
function handleExecuteRequest(req, res) {
  let body = '';

  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const request = JSON.parse(body);
      console.log(
        `🚀 Execute request: ${request.function}(${
          request.parameters?.join(', ') || ''
        })`
      );

      // Allow commands even if TV hasn't sent functions yet
      // The Remote Handler will establish connection when it starts polling
      console.log(
        `📋 TV Connection Status: ${
          tvConnectionInfo.connected
            ? 'Established'
            : 'Waiting for Remote Handler'
        }`
      );

      // Add to command queue
      const command = {
        id: Date.now().toString(),
        function: request.function,
        parameters: request.parameters || [],
        timestamp: new Date().toISOString(),
      };

      commandQueue.push(command);
      console.log(`📋 Command queued: ${commandQueue.length} in queue`);

      // Wait for result with longer timeout and better checking
      let resultReceived = false;
      const checkInterval = setInterval(() => {
        // Check for result file
        const resultFiles = fs
          .readdirSync(OUTPUT_DIR)
          .filter((f) => f.startsWith('result-'))
          .sort()
          .reverse();

        if (resultFiles.length > 0) {
          try {
            const latestResult = path.join(OUTPUT_DIR, resultFiles[0]);
            const result = JSON.parse(fs.readFileSync(latestResult, 'utf8'));

            if (result.commandId === command.id) {
              console.log(`✅ Result received for command ${command.id}`);
              clearInterval(checkInterval);
              resultReceived = true;

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: result.success,
                  data: result.data,
                  error: result.error,
                })
              );

              // Clean up result file
              try {
                fs.unlinkSync(latestResult);
              } catch (e) {
                console.log('Could not delete result file');
              }
            }
          } catch (e) {
            console.error('Error reading result:', e);
          }
        }
      }, 500); // Check every 500ms

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!resultReceived) {
          clearInterval(checkInterval);
          console.log(
            `⏰ Timeout for command ${command.id} - TV may not be polling`
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              error: 'Command timeout - Check if TV Remote Handler is running',
            })
          );
        }
      }, 10000); // 10 second timeout
    } catch (error) {
      console.error('❌ Error processing execute request:', error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: error.message,
        })
      );
    }
  });
}

// Duplicate handleCommandCheck removed - using the correct one at line 206

// Console fragt verfügbare Funktionen ab
function handleFunctionsList(req, res) {
  try {
    // Read latest function definitions
    const files = fs
      .readdirSync(OUTPUT_DIR)
      .filter((f) => f.startsWith('hisense-functions-') && f.endsWith('.d.ts'))
      .sort()
      .reverse();

    if (files.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'No function definitions available',
        })
      );
      return;
    }

    const latestFile = path.join(OUTPUT_DIR, files[0]);
    const definitions = fs.readFileSync(latestFile, 'utf8');

    // Extract function names (simplified)
    const functions =
      definitions
        .match(/function\s+(\w+)/g)
        ?.map((f) => f.replace('function ', '')) || [];

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        functions: functions,
        source: files[0],
      })
    );
  } catch (error) {
    console.error('❌ Error reading functions:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: error.message,
      })
    );
  }
}

// Helper: Save function data (from original code)
function saveFunctionData(data) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');

  // TypeScript Definitions
  const definitionsFile = path.join(
    OUTPUT_DIR,
    `hisense-functions-${timestamp}.d.ts`
  );
  const definitionsContent = [
    '/**',
    ' * Hisense VIDAA Function Definitions',
    ` * Received: ${data.timestamp}`,
    ` * Functions: ${data.functions.length}`,
    ' * Source: VIDAA TV Function Explorer',
    ' */',
    '',
    data.typeDefinitions || '// No type definitions available',
  ].join('\n');

  fs.writeFileSync(definitionsFile, definitionsContent);

  // Source Code Export
  const sourceFile = path.join(OUTPUT_DIR, `hisense-source-${timestamp}.js`);
  const sourceContent = [
    '/**',
    ' * Hisense VIDAA Function Source Code',
    ` * Received: ${data.timestamp}`,
    ` * Functions: ${data.functions.length}`,
    ' */',
    '',
    ...data.functions
      .filter((func) => func.sourceCode)
      .map((func) =>
        [
          `// ${func.name}`,
          '// ' + '='.repeat(50),
          `window.${func.name} = ${func.sourceCode};`,
          '',
        ].join('\n')
      ),
  ].join('\n');

  fs.writeFileSync(sourceFile, sourceContent);

  // Device Info
  if (data.deviceInfo) {
    const deviceFile = path.join(OUTPUT_DIR, `device-info-${timestamp}.json`);
    fs.writeFileSync(deviceFile, JSON.stringify(data.deviceInfo, null, 2));
  }

  console.log(`💾 Saved: ${definitionsFile}, ${sourceFile}`);
}

/**
 * ===== SERVER STARTUP =====
 */

// Start TV Receiver Server on all interfaces
receiverServer.listen(RECEIVER_PORT, '0.0.0.0', () => {
  console.log(
    `🖥️  TV Receiver Server started on port ${RECEIVER_PORT} (all interfaces)`
  );
  console.log(`   Endpoint: http://localhost:${RECEIVER_PORT}/api/functions`);
});

// Console Server removed - all APIs now on Port 3000

// Connection checker
setInterval(() => {
  if (tvConnectionInfo.connected && tvConnectionInfo.lastSeen) {
    const timeSinceLastSeen = Date.now() - tvConnectionInfo.lastSeen.getTime();
    if (timeSinceLastSeen > 60000) {
      // 60 seconds
      tvConnectionInfo.connected = false;
      console.log('📴 TV connection timeout');
    }
  }
}, 30000); // Check every 30 seconds

// Graceful shutdown
function shutdown() {
  console.log('\n👋 Shutting down server...');
  receiverServer.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Error handling
receiverServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ TV Receiver port ${RECEIVER_PORT} is already in use`);
  } else {
    console.error('❌ TV Receiver error:', error);
  }
  process.exit(1);
});

// Console server error handling removed

console.log('🚀 VIDAA Enhanced Receiver System started');
console.log('📋 Available endpoints:');
console.log(`   📡 All APIs: http://localhost:${RECEIVER_PORT}/api/*`);
console.log(
  `   📤 Function Upload: http://localhost:${RECEIVER_PORT}/api/functions`
);
console.log(
  `   🎮 Remote Commands: http://localhost:${RECEIVER_PORT}/api/remote-command`
);
console.log(`   📊 Status: http://localhost:${RECEIVER_PORT}/api/status`);
