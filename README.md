# VidaaEdge - VIDAA TV Development & Remote Control Toolkit

[!["Drop me a Coin"](https://coindrop.to/embed-button.png)](https://coindrop.to/weinzii)

A development toolkit for VidaaOS-based TVs enabling remote function exploration, custom JavaScript execution, and app installation.

**Status:** Development toolkit - use at your own risk.

**Credits:**

- Original project by [weinzii](https://github.com/weinzii/vidaa-edge)
- Exploit research by [BananaMafia](https://bananamafia.dev/post/hisensehax/)

---

## About This Fork

This fork extends the original VidaaEdge project with enhanced JavaScript execution and exploration capabilities:

- **Remote Command Execution:** Control TV functions from your laptop with real-time feedback
- **Persistent History:** Command history stored across sessions with expandable results
- **Source Code Explorer:** Extract and inspect actual function implementations
- **Enhanced Custom Code Editor:** Full-screen editor with smart parameter templates

### Known Limitations & TODOs

- **App Installation:**
  - Some TVs missing required functions, somehow not injected
  - Investigate `Hisense_installApp_V2` implementation differences
  - Test compatibility across TV models
- **File System Explorer:** Auto-scan from known paths to discover mounts/directory/files structure
- **Phoenix Services:** Understand `phoenix://service/*` architecture and endpoints
- **Debug Access:** Enable UART/debug mode for deeper system access

**Thanks to weinzii for the excellent foundation!**

---

## Features

### Remote Function Execution

- Execute VIDAA TV functions from your laptop/PC
- Custom JavaScript runner with full-screen editor
- Real-time results with expandable views
- Persistent command history with timestamps

### Function Explorer

- Automatic discovery of all Hisense/VIDAA functions
- Source code extraction and parameter detection
- One-click copy to custom code editor
- Category-based organization and search

### App Management

- Install Progressive Web Apps (Jellyfin, Twitch, Vevo, etc.)
- Custom self-hosted application deployment

## Quick Start

### 1. Start Development Server

```bash
npm start
```

### 2. Configure DNS

Point `vidaahub.com` to your laptop IP via DNS server or DNS spoofing.

### 3. Access on TV

Open `https://vidaahub.com/` in TV browser - function scanning starts automatically.

### 4. Control from Laptop

Open `https://vidaahub.com/` on laptop - execute functions and run custom JavaScript.

## Architecture

```
TV (Scanner)              Development Server          Laptop (Controller)
├── Discover Functions →  ├── Command Queue      ←    ├── Execute Functions
├── Poll for Commands  ←  ├── Result Storage     →    ├── Custom JS Editor
└── Send Results       →  └── Function Registry       └── Command History
```

## Key Capabilities

### Custom JavaScript Execution

- Full JavaScript environment on TV
- Automatic function wrapping with call templates
- Smart parameter placeholders (callbacks, paths, etc.)

### Function Exploration

- Source code inspection via toString()
- Parameter signature detection
- Native vs. implemented function identification
- Export as TypeScript definitions

### Command History

- LocalStorage persistence across sessions
- Expandable results for long output
- Custom code snippet display
- Individual item deletion

## API Endpoints

- `POST /api/functions` - Upload function list
- `GET /api/functions` - Retrieve functions
- `POST /api/remote-command` - Queue command
- `GET /api/remote-command` - Poll for commands
- `POST /api/execute-response` - Submit result
- `GET /api/execute-response/:id` - Retrieve result

## Development

### Project Structure

```
vidaa-edge/
├── dev-server.js              # Express API server
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── controller-console/  # Remote controller UI
│   │   │   └── tv-scanner/          # TV function scanner
│   │   ├── services/
│   │   │   └── tv-communication.service.ts  # HTTP API client
│   │   └── pages/
│   │       ├── documentation/       # User documentation
│   │       └── start/              # App installation
│   └── environments/               # Config files
└── public/                        # Generated function files
```

### Build Commands

```bash
npm start            # Start API server (dev-server.js on port 3000)
npm run build        # Production build
npm test             # Run tests
```

## Security Considerations

- **Local Network Only:** Designed for development on trusted networks
- **HTTPS Required:** TV browsers require secure connection
- **Self-signed Certs:** Included for HTTPS support
- **Custom Code Execution:** Allows arbitrary JavaScript on TV
- **File System Access:** Can read files via `Hisense_FileRead`

## Documentation

For complete setup guides and API references:

- **Hosted Documentation:** [vidaa.flummi.ch](https://vidaa.flummi.ch/documentation)
- **BananaMafia Research:** [Original exploit analysis](https://bananamafia.dev/post/hisensehax/)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Disclaimer

This is an experimental development toolkit. Use at your own risk. Not endorsed by VidaaOS, Hisense, or any TV manufacturer. Only test on devices you own."
