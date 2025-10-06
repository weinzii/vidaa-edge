/**
 * Express Middleware für API Integration
 * Läuft direkt im Angular Dev Server auf Port 443
 */

// In-memory storage für TV-Funktionen
let storedFunctions = [];
let tvConnectionInfo = {
  connected: false,
  lastSeen: null,
  ipAddress: null,
  deviceInfo: null,
};

/**
 * Express Middleware für /api/* Routen
 */
function apiMiddleware(req, res, next) {
  // CORS Headers für Cross-Device Kommunikation
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  // API Routen
  if (req.url === '/api/functions' && req.method === 'POST') {
    console.log(
      '📤 Received functions from TV:',
      req.body?.functions?.length || 0
    );

    storedFunctions = req.body?.functions || [];
    tvConnectionInfo = {
      connected: true,
      lastSeen: new Date(),
      ipAddress: req.ip || req.connection.remoteAddress,
      deviceInfo: req.body?.deviceInfo,
    };

    return res.json({
      success: true,
      message: `Received ${storedFunctions.length} functions`,
      timestamp: new Date().toISOString(),
    });
  }

  if (req.url === '/api/functions' && req.method === 'GET') {
    console.log('📥 Functions requested...');

    return res.json({
      functions: storedFunctions,
      deviceInfo: tvConnectionInfo.deviceInfo,
      timestamp: tvConnectionInfo.lastSeen,
      connectionInfo: tvConnectionInfo,
    });
  }

  if (req.url === '/api/status' && req.method === 'GET') {
    return res.json({
      server: 'Angular Dev Server with API Middleware',
      port: 443,
      functions: storedFunctions.length,
      tvConnected: tvConnectionInfo.connected,
      lastSeen: tvConnectionInfo.lastSeen,
      uptime: process.uptime(),
    });
  }

  if (req.url.startsWith('/api/remote-command') && req.method === 'POST') {
    console.log('🎮 Remote command received:', req.body);

    return res.json({
      success: true,
      commandId: Date.now().toString(),
      message: 'Command queued for TV execution',
    });
  }

  // Wenn keine API-Route gefunden, weiter zu Angular
  next();
}

module.exports = apiMiddleware;
