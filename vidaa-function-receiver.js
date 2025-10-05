#!/usr/bin/env node
/**
 * VIDAA Function Receiver Server
 * Läuft auf Ihrem Development-Rechner und empfängt Hisense-Funktionen vom VIDAA TV
 *
 * Usage: node vidaa-function-receiver.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;
const OUTPUT_DIR = './received-functions';

// Stelle sicher, dass Output-Verzeichnis existiert
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const server = http.createServer((req, res) => {
  console.log(
    `🌐 ${req.method} ${req.url} from ${req.connection.remoteAddress}`
  );

  // CORS Headers für VIDAA TV
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled');
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/functions') {
    console.log('🔍 Incoming POST request to /api/functions');
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        console.log('📦 Parsing received data...');
        const data = JSON.parse(body);
        console.log(`📡 Received function data from VIDAA TV`);
        console.log(`   Functions count: ${data.functions?.length || 0}`);
        console.log(`📊 Functions: ${data.functions.length}`);
        console.log(`📅 Timestamp: ${data.timestamp}`);

        // Speichere empfangene Daten
        const timestamp = new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:.]/g, '-');

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
        console.log(`💾 Saved definitions: ${definitionsFile}`);

        // Source Code Export
        const sourceFile = path.join(
          OUTPUT_DIR,
          `hisense-source-${timestamp}.js`
        );
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
        console.log(`💾 Saved source code: ${sourceFile}`);

        // Device Info
        if (data.deviceInfo) {
          const deviceFile = path.join(
            OUTPUT_DIR,
            `device-info-${timestamp}.json`
          );
          fs.writeFileSync(
            deviceFile,
            JSON.stringify(data.deviceInfo, null, 2)
          );
          console.log(`📱 Saved device info: ${deviceFile}`);
        }

        // Antwort senden
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'success',
            message: 'Function definitions received and saved',
            filesCreated: [definitionsFile, sourceFile].filter(Boolean),
          })
        );

        console.log('✅ Data processing completed\n');
      } catch (error) {
        console.error('❌ Error processing request:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'error',
            message: error.message,
          })
        );
      }
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'error',
          message: 'Internal server error',
        })
      );
    });
  } else {
    // 404 für andere Routen
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log('🚀 VIDAA Function Receiver Server started');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

// Error handling
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.log('💡 Try a different port or stop the existing process');
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});
