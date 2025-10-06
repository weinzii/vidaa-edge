# VidaaEdge - VIDAA TV Development Toolkit

[!["Drop me a Coin"](https://coindrop.to/embed-button.png)](https://coindrop.to/weinzii)

This project provides comprehensive development tools for VidaaOS-based TVs, including filesystem exploration, API analysis, and custom app installation capabilities.

**Status:** Development toolkit - use at your own risk.

Credits go to [BananaMafia](https://bananamafia.dev/post/hisensehax/) for discovering the directory traversal exploits that enabled this research.

## 🛠️ Development Tools

### Function Explorer & Analyzer

- **API Discovery:** Extract and analyze all available VIDAA TV functions
- **Source Code Export:** Export function definitions as TypeScript declarations
- **Development Bridge:** Transfer functions from TV to development machine
- **Real-time Analysis:** Live function inspection and documentation

### Custom App Installation

- **PWA Support:** Install Progressive Web Apps on VidaaOS TVs
- **Self-hosted Options:** Deploy and manage custom applications
- **DNS Configuration:** Enable API access through network configuration

## 🚀 Quick Start

### Development Mode

```bash
# Start the complete development environment
npm run receiver

# This automatically:
# 1. Detects your local IP address
# 2. Updates configuration
# 3. Starts the function receiver server
```

### Access on VIDAA TV

1. Navigate to the **Remote Console** on your TV browser
2. Use **Function Explorer** for security analysis
3. Use **Function Explorer** to extract TV APIs
4. Install custom apps through the installation interface

## 📋 Features

### 🔍 Filesystem Analysis

- **Root Discovery:** `/`, `/system`, `/data`, `/storage` exploration
- **Directory Traversal:** Recursive tree building with depth control
- **File Access:** Read system files and configuration data
- **Mount Point Detection:** Identify all available filesystems

### 🔧 API Research

- **Function Extraction:** Complete VIDAA API surface discovery
- **Source Analysis:** Extract function implementations via toString()
- **TypeScript Generation:** Auto-generate type definitions
- **Cross-Platform Transfer:** TV-to-development-machine bridge

### 📱 App Management

- **Custom Installation:** Deploy PWAs and custom applications
- **DNS Integration:** Network-based API enablement
- **Self-hosted Deployment:** Complete local development setup

## 🏗️ Architecture

```
VIDAA TV                    Development Machine
├── Directory Explorer  →   ├── Function Receiver Server
├── Function Analyzer   →   ├── TypeScript Definitions
└── Custom App Installer    └── Development Environment
```

## ⚠️ Security & Disclaimer

- **Experimental Tool:** This is a research and development toolkit
- **Use Responsibly:** Only analyze your own devices
- **No Official Support:** Not endorsed by VidaaOS or Hisense
- **Self-hosting Recommended:** Safest approach for production use

## 📖 Documentation

For complete setup guides and API references:

- **Hosted Documentation:** [vidaa.flummi.ch](https://vidaa.flummi.ch/documentation)
- **BananaMafia Research:** [Original exploit analysis](https://bananamafia.dev/post/hisensehax/)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
