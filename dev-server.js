#!/usr/bin/env node
/**
 * Custom Dev Server with API Integration
 * Starts Angular Dev Server with integrated API endpoints
 */

const { exec } = require('child_process');
const express = require('express');

// In-memory storage for functions and connection state
let storedFunctions = [];
let tvConnectionInfo = {
  connected: false,
  lastSeen: null,
  ipAddress: null,
  deviceInfo: null,
};

// Command Queue System
const commandQueue = [];
const commandResults = new Map(); // Store results by commandId

// Create Express app for API middleware
const apiApp = express();
apiApp.use(express.json({ limit: '10mb' }));

// CORS middleware
apiApp.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// API Routes
apiApp.post('/api/functions', (req, res) => {
  storedFunctions = req.body.functions || [];
  tvConnectionInfo = {
    connected: true,
    lastSeen: new Date(),
    ipAddress: req.ip,
    deviceInfo: req.body.deviceInfo,
  };

  // Save to shared-functions.json file
  const fs = require('fs');
  const path = require('path');

  const sharedFunctionsData = {
    functions: storedFunctions,
    timestamp: new Date().toISOString(),
    deviceInfo: req.body.deviceInfo,
  };

  const sharedFunctionsPath = path.join(
    __dirname,
    'public',
    'shared-functions.json'
  );

  try {
    fs.writeFileSync(
      sharedFunctionsPath,
      JSON.stringify(sharedFunctionsData, null, 2)
    );
    console.log(
      `📁 Saved ${storedFunctions.length} functions to shared-functions.json`
    );
  } catch (error) {
    console.error('❌ Failed to save shared-functions.json:', error);
  }

  // Save files in received-functions/ directory (like vidaa-function-receiver.js)
  const receivedFunctionsDir = path.join(__dirname, 'received-functions');

  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(receivedFunctionsDir)) {
      fs.mkdirSync(receivedFunctionsDir, { recursive: true });
    }

    console.log('📦 Processing received function data...');
    console.log(`📡 Received function data from VIDAA TV`);
    console.log(`📊 Functions: ${storedFunctions.length}`);
    console.log(
      `📅 Timestamp: ${req.body.timestamp || new Date().toISOString()}`
    );

    // Generate timestamp for filenames
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:.]/g, '-');

    // 1. TypeScript Definitions
    const definitionsFile = path.join(
      receivedFunctionsDir,
      `hisense-functions-${timestamp}.d.ts`
    );
    const definitionsContent = [
      '/**',
      ' * Hisense VIDAA Function Definitions',
      ` * Received: ${req.body.timestamp || new Date().toISOString()}`,
      ` * Functions: ${storedFunctions.length}`,
      ' * Source: VIDAA TV Function Explorer',
      ' */',
      '',
      req.body.typeDefinitions || '// No type definitions available',
    ].join('\n');
    fs.writeFileSync(definitionsFile, definitionsContent);
    console.log(`💾 Saved definitions: ${definitionsFile}`);

    // 2. Source Code Export
    const sourceFile = path.join(
      receivedFunctionsDir,
      `hisense-source-${timestamp}.js`
    );
    const sourceContent = [
      '/**',
      ' * Hisense VIDAA Function Source Code',
      ` * Received: ${req.body.timestamp || new Date().toISOString()}`,
      ` * Functions: ${storedFunctions.length}`,
      ' */',
      '',
      ...storedFunctions
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

    // 3. Device Info
    if (req.body.deviceInfo) {
      const deviceFile = path.join(
        receivedFunctionsDir,
        `device-info-${timestamp}.json`
      );
      fs.writeFileSync(
        deviceFile,
        JSON.stringify(req.body.deviceInfo, null, 2)
      );
      console.log(`📱 Saved device info: ${deviceFile}`);
    }

    // 4. Complete data (for compatibility)
    const completeDataPath = path.join(
      receivedFunctionsDir,
      'complete-data.json'
    );
    fs.writeFileSync(completeDataPath, JSON.stringify(req.body, null, 2));

    // 5. functions.json (for compatibility)
    const functionsPath = path.join(receivedFunctionsDir, 'functions.json');
    fs.writeFileSync(functionsPath, JSON.stringify(storedFunctions, null, 2));

    console.log('✅ Data processing completed');
    console.log(`📁 Saved files:`);
    console.log(
      `   - ${path.basename(definitionsFile)} (TypeScript definitions)`
    );
    console.log(`   - ${path.basename(sourceFile)} (Source code)`);
    if (req.body.deviceInfo) {
      console.log(`   - device-info-${timestamp}.json (Device info)`);
    }
    console.log(`   - functions.json (${storedFunctions.length} functions)`);
    console.log(`   - complete-data.json (Complete payload)`);
  } catch (error) {
    console.error('❌ Failed to save received-functions/ files:', error);
  }

  res.json({
    success: true,
    message: `Received ${storedFunctions.length} functions and saved to file`,
    timestamp: new Date().toISOString(),
  });
});

apiApp.get('/api/functions', (req, res) => {
  // Check TV connection status
  const isConnected = tvConnectionInfo.connected && tvConnectionInfo.lastSeen;
  const timeSinceLastSeen = isConnected
    ? new Date().getTime() - new Date(tvConnectionInfo.lastSeen).getTime()
    : Infinity;

  // TV is considered disconnected after 10 minutes of inactivity
  const tvDisconnected = timeSinceLastSeen > 600000; // 10 minutes

  if (tvDisconnected && tvConnectionInfo.connected) {
    tvConnectionInfo.connected = false;
  }

  res.json({
    functions: tvConnectionInfo.connected ? storedFunctions : [],
    deviceInfo: tvConnectionInfo.connected ? tvConnectionInfo.deviceInfo : null,
    timestamp: tvConnectionInfo.lastSeen,
    connectionInfo: {
      ...tvConnectionInfo,
      connected: tvConnectionInfo.connected && !tvDisconnected,
    },
  });
});

// PC sends command to TV
apiApp.post('/api/remote-command', (req, res) => {
  const {
    function: functionName,
    parameters,
    sourceCode,
    executionMode,
  } = req.body;

  console.log('🔥 REMOTE COMMAND RECEIVED:');
  console.log('📋 Function:', functionName);
  console.log('📋 Parameters:', parameters);
  console.log('📋 Source Code Length:', sourceCode?.length || 0);
  console.log('📋 Execution Mode:', executionMode);

  // Check TV connection status BEFORE queuing command
  const isConnected = tvConnectionInfo.connected && tvConnectionInfo.lastSeen;
  const timeSinceLastSeen = isConnected
    ? new Date().getTime() - new Date(tvConnectionInfo.lastSeen).getTime()
    : Infinity;

  if (!isConnected || timeSinceLastSeen > 600000) {
    // 10 minutes timeout
    return res.status(503).json({
      success: false,
      error: 'TV_NOT_CONNECTED',
      message:
        'TV is not connected. Please ensure TV is on and has visited /console',
      lastSeen: tvConnectionInfo.lastSeen,
      timeSinceLastSeen: Math.round(timeSinceLastSeen / 1000) + 's',
    });
  }

  const command = {
    id: Date.now().toString(),
    function: functionName,
    parameters: parameters || [],
    sourceCode: sourceCode || '', // Include source code for eval() execution
    executionMode: executionMode || 'direct', // 'eval' or 'direct'
    timestamp: new Date().toISOString(),
  };

  commandQueue.push(command);
  console.log('📤 Command queued:', command.id, 'Mode:', command.executionMode);

  res.json({
    success: true,
    commandId: command.id,
    message: `Command queued for TV execution (${command.executionMode} mode)`,
  });
});

// TV polls for commands
apiApp.get('/api/remote-command', (req, res) => {
  if (commandQueue.length > 0) {
    const command = commandQueue.shift();

    res.json({
      hasCommand: true,
      command: command,
    });
  } else {
    res.json({
      hasCommand: false,
    });
  }
});

// TV sends result back
apiApp.post('/api/execute-response', (req, res) => {
  const result = req.body;

  // Store result for PC to retrieve
  commandResults.set(result.commandId, result);

  res.json({
    success: true,
    message: 'Result received',
  });
});

// PC retrieves result
apiApp.get('/api/execute-response/:commandId', (req, res) => {
  const commandId = req.params.commandId;
  const result = commandResults.get(commandId);

  if (result) {
    commandResults.delete(commandId); // Clean up
    res.json(result);
  } else {
    // Check if TV is still connected while waiting
    const isConnected = tvConnectionInfo.connected && tvConnectionInfo.lastSeen;
    const timeSinceLastSeen = isConnected
      ? new Date().getTime() - new Date(tvConnectionInfo.lastSeen).getTime()
      : Infinity;

    if (!isConnected || timeSinceLastSeen > 300000) {
      // 5 minutes timeout
      return res.json({
        success: false,
        error: 'TV_DISCONNECTED',
        message: 'TV disconnected while waiting for result',
        commandId: commandId,
      });
    }

    res.json({ waiting: true });
  }
});

apiApp.get('/api/status', (req, res) => {
  res.json({
    server: 'Custom Dev Server with API',
    functions: storedFunctions.length,
    tvConnected: tvConnectionInfo.connected,
    lastSeen: tvConnectionInfo.lastSeen,
    uptime: process.uptime(),
  });
});

// Start API server on port 3000 (internal) - bind to all interfaces
const API_PORT = 3000;
apiApp.listen(API_PORT, '0.0.0.0', () => {
  console.log(`API Server running on port ${API_PORT}`);
});

// Start Angular Dev Server on port 443 with proxy to API
console.log('Starting Angular Dev Server on port 443...');
const ngServe = exec('nx serve --configuration=development', {
  stdio: 'inherit',
});

console.log('Application available at: https://localhost:443/');

ngServe.stdout?.on('data', (data) => {
  console.log(data.toString());
});

ngServe.stderr?.on('data', (data) => {
  console.error(data.toString());
});

ngServe.on('close', (code) => {
  console.log(`Angular Dev Server exited with code ${code}`);
  process.exit(code);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down servers...');
  ngServe.kill();
  process.exit(0);
});

console.log('Custom Dev Server started!');
