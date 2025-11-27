#!/usr/bin/env node
/**
 * VIDAA Edge API Server
 * Provides API endpoints for TV-Controller communication
 */

const express = require('express');
const fsPromises = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// === SERVICES ===
const loggingService = require('./LoggingService');
const timingTracker = require('./TimingTrackerService');

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
// Note: Timing tracking is now handled by TimingTrackerService

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
  updateTvConnectionTimestamp(req);
}

function updateTvConnectionTimestamp(req) {
  tvConnectionInfo = {
    connected: true,
    lastSeen: new Date(),
    ipAddress: req.ip,
    deviceInfo: tvConnectionInfo.deviceInfo || req.body.deviceInfo,
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

apiApp.post('/api/keepalive', (req, res) => {
  updateTvConnectionTimestamp(req);
  res.json({
    success: true,
    message: 'Keep-alive received',
    timestamp: new Date().toISOString(),
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

  try {
    const publicDir = path.join(__dirname, '..', 'public');
    const savedFiles = [];

    // Ensure public directory exists
    if (!fsSync.existsSync(publicDir)) {
      fsSync.mkdirSync(publicDir, { recursive: true });
    }

    // Save each file
    files.forEach((file) => {
      const filePath = path.join(publicDir, file.filename);
      fsSync.writeFileSync(filePath, file.content, 'utf8');
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
    id,
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
    id: id,
    function: functionName,
    parameters: parameters || [],
    sourceCode: sourceCode || '',
    executionMode: executionMode || 'direct',
    timestamp: new Date().toISOString(),
    queuedAt: Date.now(), // Track when command was queued
  };

  commandQueue.push(command);

  // Track timing via service
  timingTracker.trackQueued(command.id, {
    function: functionName,
    parameters: parameters,
  });

  // Log via service (eliminates duplicate extractFileInfo code)
  loggingService.logCommandQueued(command);

  res.json({ success: true, commandId: command.id });
});

apiApp.get('/api/remote-command', (req, res) => {
  // ATOMIC: Shift is atomic in single-threaded Node.js event loop
  // (Express handles one request at a time per event loop iteration)
  const command = commandQueue.shift();

  if (command) {
    const queueTime = timingTracker.trackSentToTv(command.id);
    if (queueTime !== null) {
      loggingService.logCommandSent(command, queueTime);
    }
  }

  res.json(command ? { hasCommand: true, command } : { hasCommand: false });
});

// Batch endpoint for parallel command execution
apiApp.get('/api/remote-command-batch', (req, res) => {
  const batchSize = Math.min(
    parseInt(req.query.batchSize) || 10,
    20 // Max 20 commands per batch for safety
  );

  // ATOMIC: Multiple shifts in single event loop iteration
  // Node.js event loop ensures this completes before next request
  const batch = [];
  for (let i = 0; i < batchSize && commandQueue.length > 0; i++) {
    batch.push(commandQueue.shift());
  }

  res.json({
    hasCommands: batch.length > 0,
    commands: batch,
    remainingInQueue: commandQueue.length,
  });
});

apiApp.post('/api/execute-response', (req, res) => {
  const commandId = req.body.commandId;

  // CRITICAL: Store result IMMEDIATELY before any logging
  // Angular polling may check for result while we're still logging!
  commandResults.set(req.body.commandId, req.body);

  // Track timing and get report
  const timingReport = timingTracker.trackReceivedFromTv(
    commandId,
    req.body.tvProcessingTimeMs
  );

  if (timingReport) {
    // Log via service (eliminates duplicate extractFileInfo code)
    loggingService.logResponseReceived(commandId, timingReport, req.body);

    // Clean up timing data after 60 seconds
    // NOTE: This is safe - even if deleted, the error handler below
    // uses optional chaining and handles missing timing gracefully
    timingTracker.scheduleCleanup(commandId, 60000);
  }

  res.json({ success: true });
});

apiApp.get('/api/execute-response/:commandId', (req, res) => {
  // ATOMIC: Get and delete in single operation to prevent race conditions
  const result = commandResults.get(req.params.commandId);
  if (result) {
    // Delete IMMEDIATELY to prevent duplicate retrievals
    commandResults.delete(req.params.commandId);

    // Log if this is a timeout or error without TV timing
    if (!result.success && !result.tvProcessingTimeMs) {
      // SAFE: Get timing snapshot before it might be cleaned up
      const timing = timingTracker.getTiming(req.params.commandId);
      const totalTime = timingTracker.getTotalTime(req.params.commandId);

      // Log via service (eliminates duplicate extractFileInfo code)
      loggingService.logCommandFailed(
        req.params.commandId,
        timing,
        result,
        totalTime
      );
    }

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

// ============================================================================
// === SESSION PERSISTENCE API ===
// ============================================================================

const SCAN_DATA_DIR = path.join(__dirname, '..', 'scan-data');

// Utility: Send error response with proper status code
function sendErrorResponse(res, error, context = 'Operation') {
  const status = error.code === 'ENOENT' ? 404 : 500;
  const message = error.code === 'ENOENT' ? 'Session not found' : error.message;

  console.error(`${context} failed:`, error);
  res.status(status).json({
    success: false,
    error: message,
  });
}

// Utility: Ensure scan-data directory exists
async function ensureScanDataDir() {
  try {
    await fsPromises.mkdir(SCAN_DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create scan-data directory:', error);
  }
}

// Utility: Format bytes to human-readable string
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Utility: Generate session ID
function generateSessionId(customName) {
  if (customName) {
    return customName.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `scan_${timestamp}`;
}

// Utility: Merge session data (for multiple runs)
function mergeResults(existingResults, newResults, runId) {
  const merged = new Map();

  // Load existing results
  existingResults.forEach((file) => {
    merged.set(file.path, file);
  });

  // Merge new results
  newResults.forEach((newFile) => {
    const existing = merged.get(newFile.path);

    if (!existing) {
      // New file: add scan history
      newFile.scanHistory = [
        {
          runId: runId,
          timestamp: Date.now(),
          status: newFile.status,
        },
      ];
      merged.set(newFile.path, newFile);
    } else {
      // Existing file: merge data
      const mergedFile = {
        ...existing, // Start with existing file (preserves all fields)
        ...newFile, // Override with new file data (updates all fields)
        // Special handling: Use newest values if success
        status: newFile.status === 'success' ? newFile.status : existing.status,
        // ✅ Strip binary content - never store binary file content
        content:
          newFile.isBinary || existing.isBinary
            ? undefined
            : newFile.content || existing.content,
        size: newFile.size || existing.size,
        timestamp: newFile.timestamp,
        // Merge extracted paths (union)
        extractedPaths: [
          ...new Set([
            ...(existing.extractedPaths || []),
            ...(newFile.extractedPaths || []),
          ]),
        ],
        // Merge generated paths (union)
        generatedPaths:
          newFile.generatedPaths || existing.generatedPaths
            ? [
                ...new Set([
                  ...(existing.generatedPaths || []),
                  ...(newFile.generatedPaths || []),
                ]),
              ]
            : undefined,
        // Merge ignored paths (union)
        ignoredPaths:
          newFile.ignoredPaths || existing.ignoredPaths
            ? [
                ...new Set([
                  ...(existing.ignoredPaths || []),
                  ...(newFile.ignoredPaths || []),
                ]),
              ]
            : undefined,
        // Merge variable references (union)
        variableReferences: [
          ...new Set([
            ...(existing.variableReferences || []),
            ...(newFile.variableReferences || []),
          ]),
        ],
        // Keep original discovery info (don't overwrite)
        discoveryMethod: existing.discoveryMethod,
        discoveredFrom: existing.discoveredFrom,
        // Keep placeholder flag from existing (if it was a placeholder initially)
        isPlaceholder: existing.isPlaceholder || newFile.isPlaceholder,
        // Append to scan history ONLY if this is a new run
        // Don't add duplicate entries during auto-saves within the same run
        scanHistory: (() => {
          const lastScanRun =
            existing.scanHistory?.[existing.scanHistory.length - 1]?.runId;
          const isNewRun = lastScanRun !== runId;

          if (isNewRun) {
            return [
              ...(existing.scanHistory || []),
              {
                runId: runId,
                timestamp: Date.now(),
                status: newFile.status,
              },
            ];
          }
          // Same run - keep existing scanHistory, but update last entry status if changed
          if (
            existing.scanHistory &&
            existing.scanHistory.length > 0 &&
            existing.scanHistory[existing.scanHistory.length - 1].status !==
              newFile.status
          ) {
            const updated = [...existing.scanHistory];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              status: newFile.status,
              timestamp: Date.now(),
            };
            return updated;
          }
          return existing.scanHistory || [];
        })(),
        // Merge debug log (append)
        debugLog:
          newFile.debugLog || existing.debugLog
            ? [...(existing.debugLog || []), ...(newFile.debugLog || [])]
            : undefined,
      };
      merged.set(newFile.path, mergedFile);
    }
  });

  return Array.from(merged.values());
}

// POST /api/scan/session/save - Save or merge session
apiApp.post('/api/scan/session/save', async (req, res) => {
  try {
    await ensureScanDataDir();

    const { sessionId, action, runId, data } = req.body;

    if (!sessionId || !data) {
      return res.status(400).json({
        success: false,
        error: 'Missing sessionId or data',
      });
    }

    const filePath = path.join(SCAN_DATA_DIR, `${sessionId}.json`);
    let sessionData;
    let existingData = null;

    // Load existing session if merging
    if (action === 'merge') {
      try {
        const content = await fsPromises.readFile(filePath, 'utf8');
        existingData = JSON.parse(content);
      } catch (error) {
        // File doesn't exist yet, treat as create
        console.log('No existing session found, creating new one');
      }
    }

    if (existingData && action === 'merge') {
      // Merge with existing session
      const currentRunId = runId || existingData.runs.length + 1;
      const mergedResults = mergeResults(
        existingData.data.results,
        data.results,
        currentRunId
      );

      // Check if this runId already exists (update) or is new (new run)
      const existingRunIndex = existingData.runs.findIndex(
        (r) => r.runId === currentRunId
      );
      const isNewRun = existingRunIndex === -1;

      // Update or add run entry
      let updatedRuns;
      if (isNewRun) {
        // New run - add to array
        updatedRuns = [
          ...existingData.runs,
          {
            runId: currentRunId,
            timestamp: Date.now(),
            filesScanned: data.results.length,
            duration: data.session?.endTime
              ? new Date(data.session.endTime).getTime() -
                new Date(data.session.startTime).getTime()
              : 0,
            status: data.session?.status || 'unknown',
          },
        ];
      } else {
        // Update existing run
        updatedRuns = [...existingData.runs];
        updatedRuns[existingRunIndex] = {
          ...updatedRuns[existingRunIndex],
          timestamp: Date.now(),
          filesScanned: data.results.length,
          duration: data.session?.endTime
            ? new Date(data.session.endTime).getTime() -
              new Date(data.session.startTime).getTime()
            : 0,
          status: data.session?.status || 'unknown',
        };
      }

      sessionData = {
        ...existingData,
        lastModified: Date.now(),
        metadata: {
          ...existingData.metadata,
          totalRuns: isNewRun
            ? existingData.runs.length + 1
            : existingData.runs.length,
          totalFiles: mergedResults.length,
          successCount: mergedResults.filter((f) => f.status === 'success')
            .length,
          failedCount: mergedResults.filter((f) => f.status !== 'success')
            .length,
          textCount: mergedResults.filter((f) => !f.isBinary).length,
          binaryCount: mergedResults.filter((f) => f.isBinary).length,
        },
        runs: updatedRuns,
        data: {
          results: mergedResults,
          session: data.session,
          variables: data.variables || existingData.data.variables,
          deferredPaths: data.deferredPaths || existingData.data.deferredPaths,
        },
      };
    } else {
      // Create new session
      sessionData = {
        sessionId: sessionId,
        version: '1.0.0',
        created: Date.now(),
        lastModified: Date.now(),
        metadata: {
          name: sessionId,
          description: 'TV Filesystem Scan',
          totalRuns: 1,
          totalFiles: data.results.length,
          successCount: data.results.filter((f) => f.status === 'success')
            .length,
          failedCount: data.results.filter((f) => f.status !== 'success')
            .length,
          textCount: data.results.filter((f) => !f.isBinary).length,
          binaryCount: data.results.filter((f) => f.isBinary).length,
          scanDuration: data.session?.endTime
            ? new Date(data.session.endTime).getTime() -
              new Date(data.session.startTime).getTime()
            : 0,
          tvIp: tvConnectionInfo.ipAddress || 'unknown',
        },
        runs: [
          {
            runId: runId || 1,
            timestamp: Date.now(),
            filesScanned: data.results.length,
            duration: data.session?.endTime
              ? new Date(data.session.endTime).getTime() -
                new Date(data.session.startTime).getTime()
              : 0,
            status: data.session?.status || 'unknown',
          },
        ],
        data: {
          results: data.results.map((r) => ({
            ...r,
            scanHistory: [
              {
                runId: runId || 1,
                timestamp: Date.now(),
                status: r.status,
              },
            ],
          })),
          session: data.session,
          variables: data.variables,
          deferredPaths: data.deferredPaths,
        },
      };
    }

    // Write to disk (minified JSON to save space)
    await fsPromises.writeFile(filePath, JSON.stringify(sessionData));

    const stats = await fsPromises.stat(filePath);
    sessionData.metadata.size = formatBytes(stats.size);

    res.json({
      success: true,
      sessionId: sessionId,
      totalFiles: sessionData.metadata.totalFiles,
      newFiles: existingData
        ? sessionData.metadata.totalFiles - existingData.metadata.totalFiles
        : sessionData.metadata.totalFiles,
      runId: sessionData.runs[sessionData.runs.length - 1].runId,
      size: sessionData.metadata.size,
    });
  } catch (error) {
    console.error('Failed to save session:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/scan/sessions - List all sessions
apiApp.get('/api/scan/sessions', async (req, res) => {
  try {
    await ensureScanDataDir();

    const files = await fsPromises.readdir(SCAN_DATA_DIR);
    const sessions = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(SCAN_DATA_DIR, file);
          const stats = await fsPromises.stat(filePath);
          const content = await fsPromises.readFile(filePath, 'utf8');
          const data = JSON.parse(content);

          sessions.push({
            sessionId: data.sessionId,
            name: data.metadata.name,
            status: data.data.session?.status || 'unknown',
            totalFiles: data.metadata.totalFiles,
            successCount: data.metadata.successCount,
            failedCount: data.metadata.failedCount,
            totalRuns: data.metadata.totalRuns,
            lastModified: data.lastModified,
            size: formatBytes(stats.size),
            canResume:
              data.data.session?.status === 'paused' ||
              data.data.session?.status === 'running',
            canBrowse: true,
          });
        } catch (error) {
          console.error(`Failed to read session ${file}:`, error);
        }
      }
    }

    // Sort by lastModified (newest first)
    sessions.sort((a, b) => b.lastModified - a.lastModified);

    res.json(sessions);
  } catch (error) {
    console.error('Failed to list sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Helper: Load session data from file
async function loadSessionData(sessionId) {
  const filePath = path.join(SCAN_DATA_DIR, `${sessionId}.json`);
  const content = await fsPromises.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

// GET /api/scan/session/load/:id - Load full session (for Browse mode)
apiApp.get('/api/scan/session/load/:id', async (req, res) => {
  try {
    const data = await loadSessionData(req.params.id);

    // Return structured data for browse mode
    res.json({
      sessionId: data.sessionId,
      metadata: data.metadata,
      data: {
        results: data.data.results,
        session: data.data.session,
        variables: data.data.variables,
        deferredPaths: data.data.deferredPaths,
        treeCache: data.data.treeCache,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, 'Load session');
  }
});

// GET /api/scan/session/resume/:id - Get resume data (for continuing scan)
apiApp.get('/api/scan/session/resume/:id', async (req, res) => {
  try {
    const data = await loadSessionData(req.params.id);

    // Return flattened data for resume with nextRunId
    res.json({
      sessionId: data.sessionId,
      session: data.data.session,
      results: data.data.results,
      variables: data.data.variables,
      deferredPaths: data.data.deferredPaths,
      nextRunId: data.runs.length + 1,
    });
  } catch (error) {
    sendErrorResponse(res, error, 'Load resume data');
  }
});

// DELETE /api/scan/session/delete/:id - Delete session
apiApp.delete('/api/scan/session/delete/:id', async (req, res) => {
  try {
    const filePath = path.join(SCAN_DATA_DIR, `${req.params.id}.json`);
    await fsPromises.unlink(filePath);

    console.log(`Deleted session: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Delete session');
  }
});

// === SERVER STARTUP ===
const API_PORT = process.env.API_PORT || 3000;

apiApp.listen(API_PORT, '0.0.0.0', () => {
  console.log(`\n🚀 VIDAA Edge API Server running on port ${API_PORT}`);
  console.log(`   Endpoints available at http://localhost:${API_PORT}/api/*\n`);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down API server...');
  process.exit(0);
});
