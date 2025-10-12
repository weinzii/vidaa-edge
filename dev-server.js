#!/usr/bin/env node
/**
 * VIDAA Edge Development Server
 * Provides API endpoints for TV-Controller communication
 */

const { exec } = require('child_process');
const express = require('express');

// === STATE MANAGEMENT ===
let storedFunctions = [];
let tvConnectionInfo = {
  connected: false,
  lastSeen: null,
  ipAddress: null,
  deviceInfo: null,
};
const commandQueue = [];
const commandResults = new Map();

// === EXPRESS SETUP ===
const apiApp = express();
apiApp.use(express.json({ limit: '10mb' }));
apiApp.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// === UTILITY FUNCTIONS ===
function updateTvConnection(req) {
  storedFunctions = req.body.functions || [];
  tvConnectionInfo = {
    connected: true,
    lastSeen: new Date(),
    ipAddress: req.ip,
    deviceInfo: req.body.deviceInfo,
  };
}

function checkTvConnection() {
  if (!tvConnectionInfo.connected || !tvConnectionInfo.lastSeen) return false;
  const timeSinceLastSeen =
    Date.now() - new Date(tvConnectionInfo.lastSeen).getTime();
  return timeSinceLastSeen < 600000; // 10 minutes
}

// === FUNCTION MANAGEMENT API ===
apiApp.post('/api/functions', (req, res) => {
  updateTvConnection(req);
  res.json({
    success: true,
    message: `Received ${storedFunctions.length} functions`,
    timestamp: new Date().toISOString(),
  });
});

apiApp.get('/api/functions', (req, res) => {
  const isConnected = checkTvConnection();
  if (!isConnected && tvConnectionInfo.connected) {
    tvConnectionInfo.connected = false;
  }

  res.json({
    functions: isConnected ? storedFunctions : [],
    deviceInfo: isConnected ? tvConnectionInfo.deviceInfo : null,
    timestamp: tvConnectionInfo.lastSeen,
    connectionInfo: { ...tvConnectionInfo, connected: isConnected },
  });
});

// === SAVE TO PUBLIC API ===
apiApp.post('/api/save-to-public', (req, res) => {
  const { files } = req.body;

  if (!files || !Array.isArray(files)) {
    return res.status(400).json({
      success: false,
      message: 'No files provided',
    });
  }

  const fs = require('fs');
  const path = require('path');

  try {
    const publicDir = path.join(__dirname, 'public');
    const savedFiles = [];

    // Ensure public directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Save each file
    files.forEach((file) => {
      const filePath = path.join(publicDir, file.filename);
      fs.writeFileSync(filePath, file.content, 'utf8');
      savedFiles.push(file.filename);
      console.log(`💾 Saved file: ${file.filename}`);
    });

    res.json({
      success: true,
      saved: savedFiles,
      location: '/public',
      message: `${savedFiles.length} files saved to /public directory`,
    });
  } catch (error) {
    console.error('❌ Error saving files to /public:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save files to /public directory',
      error: error.message,
    });
  }
});

// === REMOTE COMMAND API ===
apiApp.post('/api/remote-command', (req, res) => {
  const {
    function: functionName,
    parameters,
    sourceCode,
    executionMode,
  } = req.body;

  if (!checkTvConnection()) {
    return res.status(503).json({
      success: false,
      error: 'TV_NOT_CONNECTED',
      message: 'TV is not connected',
      lastSeen: tvConnectionInfo.lastSeen,
    });
  }

  const command = {
    id: Date.now().toString(),
    function: functionName,
    parameters: parameters || [],
    sourceCode: sourceCode || '',
    executionMode: executionMode || 'direct',
    timestamp: new Date().toISOString(),
  };

  commandQueue.push(command);
  res.json({ success: true, commandId: command.id });
});

apiApp.get('/api/remote-command', (req, res) => {
  const command = commandQueue.shift();
  res.json(command ? { hasCommand: true, command } : { hasCommand: false });
});

apiApp.post('/api/execute-response', (req, res) => {
  commandResults.set(req.body.commandId, req.body);
  res.json({ success: true });
});

apiApp.get('/api/execute-response/:commandId', (req, res) => {
  const result = commandResults.get(req.params.commandId);
  if (result) {
    commandResults.delete(req.params.commandId);
    return res.json(result);
  }

  if (!checkTvConnection()) {
    return res.json({
      success: false,
      error: 'TV_DISCONNECTED',
      message: 'TV disconnected while waiting for result',
    });
  }

  res.json({ waiting: true });
});

// === SERVER STARTUP ===
const API_PORT = 3000;
apiApp.listen(API_PORT, '0.0.0.0', () => {
  console.log(`API Server running on port ${API_PORT}`);
});

console.log('Starting Angular Dev Server on port 443...');
const ngServe = exec('nx serve --configuration=development');

ngServe.stdout?.on('data', (data) => {
  process.stdout.write(data);
});

ngServe.stderr?.on('data', (data) => {
  process.stderr.write(data);
});

ngServe.on('close', (code) => {
  console.log(`Angular Dev Server exited with code ${code}`);
  process.exit(code);
});

process.on('SIGINT', () => {
  console.log('\nShutting down servers...');
  ngServe.kill();
  process.exit(0);
});

console.log('VIDAA Edge Dev Server started!');
