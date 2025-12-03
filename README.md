# VidaaEdge - VIDAA TV Development & Remote Control Toolkit

A development toolkit for VidaaOS-based TVs enabling remote function exploration, custom JavaScript execution, and PWA installation.

**Status:** Development toolkit - use at your own risk.

**Credits:**

- Original project by [weinzii](https://github.com/weinzii/vidaa-edge)
- Exploit research by [BananaMafia](https://bananamafia.dev/post/hisensehax/)
- Functions scanning, remote control, remote code execution and file browser by [simonbuehler](https://github.com/simonbuehler)

---

## Features

### PWA Installer (TV-OS Optimized)

- **Unified installation interface** with TV remote-friendly navigation
- **Dual installation methods:**
  - **Legacy:** Uses Hisense's official `installApp` API
  - **New:** Writes directly to system `Appinfo.json` via `HiUtils_createRequest`
- **Auto-detection** of available installation methods
- **Keyboard/remote navigation** support with arrow keys

### Remote Function Execution

- Execute VIDAA TV functions from your host
- Custom JavaScript runner with full-screen editor
- Real-time results with expandable views
- Persistent command history with timestamps

### Function Explorer

- Automatic discovery of all Hisense/VIDAA functions
- Source code extraction and parameter detection
- One-click copy to custom code editor
- Category-based organization and search

### File System Explorer

- Browse TV file system remotely
- Read file contents via `Hisense_FileRead`
- Session persistence for scan results

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm start
```

This starts both the API server (port 3000) and Angular dev server (port 443) concurrently.

### 3. Configure DNS

Point `vidaahub.com` to your host IP via DNS server/your router, pihole, adguard... you name it. :-)

### 4. Access on TV

Open `https://vidaahub.com/` in your TV's browser.

### 5. Install PWAs

Use the installer interface to add custom progressive web apps to your TV. (Restart TV after install, the installed app is now in the end of the list.)

---

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start both API server and Angular dev server |
| `npm run api` | Start only API server (port 3000) |
| `npm run serve` | Start only Angular dev server (port 443) |
| `npm run build` | Build for production |
| `npm run build:prod` | Build for production (explicit) |
| `npm test` | Run tests |
| `npm run lint` | Run linter |

---

## Architecture

```
TV (Scanner)              Development Server          Host (Controller)
├── Discover Functions →  ├── Command Queue      ←    ├── Execute Functions
├── Poll for Commands  ←  ├── Result Storage     →    ├── Custom JS Editor
└── Send Results       →  └── Function Registry       └── PWA Installer
```

---

## Project Structure

```
vidaa-edge/
├── server/                         # Backend API server
│   ├── api-server.js               # Express API server
│   ├── LoggingService.js           # Command logging
│   └── TimingTrackerService.js     # Performance tracking
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── controller-console/ # Remote controller UI
│   │   │   ├── tv-scanner/         # TV function scanner
│   │   │   ├── file-explorer/      # File system browser
│   │   │   └── remote-console/     # Remote command console
│   │   ├── services/
│   │   │   ├── app-management.service.ts  # PWA installation
│   │   │   └── tv-command.service.ts      # TV communication
│   │   └── pages/
│   │       └── installer/          # PWA installer UI
│   └── environments/               # Config files
├── public/                         # Static assets
└── scan-data/                      # Session persistence
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/functions` | POST | Upload function list from TV |
| `/api/functions` | GET | Retrieve discovered functions |
| `/api/remote-command` | POST | Queue command for TV |
| `/api/remote-command` | GET | Poll for pending commands |
| `/api/execute-response` | POST | Submit command result |
| `/api/execute-response/:id` | GET | Retrieve command result |
| `/api/scan/session/save` | POST | Save scan session |
| `/api/scan/sessions` | GET | List all sessions |
| `/api/scan/session/load/:id` | GET | Load session data |

---

## Installation Methods

### Legacy Method (Hisense API)
Uses `Hisense_installApp` function when available:
```javascript
Hisense_installApp(appId, appName, thumbnail, iconSmall, iconBig, appUrl, storeType, callback);
```

### New Method (File System)
Writes directly to system `Appinfo.json` using `HiUtils_createRequest`:
```javascript
HiUtils_createRequest('fileWrite', {
  path: 'websdk/Appinfo.json',
  mode: 6,
  writedata: JSON.stringify(apps)
});
```

The installer auto-detects which methods are available on your TV.

---

## Security Considerations

- **Local Network Only:** Designed for development on trusted networks
- **HTTPS Required:** TV browsers require secure connection
- **Self-signed Certs:** Included in `certs/` for HTTPS support
- **Custom Code Execution:** Allows arbitrary JavaScript on TV
- **File System Access:** Can read/write files via Hisense APIs

---

## Known Limitations

- **App Installation:** Some TVs may be missing required functions
- **Firmware Dependent:** Features vary by TV model and firmware version
- **DNS Required:** Must spoof `vidaahub.com` domain to access Hisense APIs

---

## References

- **BananaMafia Research:** [Original exploit analysis](https://bananamafia.dev/post/hisensehax/)
- **GitHub Repository:** [weinzii/vidaa-edge](https://github.com/weinzii/vidaa-edge)

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Disclaimer

This is an experimental development toolkit. Use at your own risk. Not endorsed by VidaaOS, Hisense, or any TV manufacturer. Only test on devices you own.
