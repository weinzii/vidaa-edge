import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VidaaService } from '../../services/vidaa.service';

interface HisenseFunction {
  name: string;
  sourceCode: string;
  available: boolean;
}

@Component({
  selector: 'app-function-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="function-explorer-container">
      <h1>🔍 Hisense Function Explorer</h1>
      <p class="description">
        Explore all available Hisense functions and view their source code (as
        described in the bananamafia blog).
      </p>

      <!-- Status Display für TV-freundliches Feedback -->
      <div class="status-section" *ngIf="statusMessage">
        <div class="status-card" [ngClass]="statusType">
          <h3>📋 Status</h3>
          <pre>{{ statusMessage }}</pre>
          <button (click)="clearStatus()" class="clear-btn">✖ Clear</button>
        </div>
      </div>

      <!-- Funktions-Kategorien Tabs -->
      <div class="tabs-section">
        <div class="tab-header">
          <button
            *ngFor="let category of categories"
            class="tab-btn"
            [class.active]="selectedCategory === category.key"
            (click)="selectCategory(category.key)"
          >
            {{ category.icon }} {{ category.name }} ({{
              getCategoryCount(category.key)
            }})
          </button>
        </div>
      </div>

      <div class="export-section" *ngIf="availableFunctions.length > 0">
        <button (click)="sendToServer()" class="export-btn send-server-btn">
          🚀 Send to Development Server
        </button>
        <button
          (click)="openRemoteConsole()"
          class="export-btn remote-console-btn"
        >
          🎮 Open Remote Console
        </button>
        <button
          (click)="testConnection()"
          class="export-btn test-connection-btn"
        >
          🔍 Test Connection
        </button>
      </div>

      <div class="filter-section">
        <input
          type="text"
          [(ngModel)]="searchTerm"
          (input)="filterFunctions()"
          placeholder="🔍 Search functions..."
          class="search-input"
        />
        <label class="checkbox-label">
          <input
            type="checkbox"
            [(ngModel)]="showOnlyAvailable"
            (change)="filterFunctions()"
          />
          Show only available functions
        </label>
      </div>

      <div class="functions-list">
        <div
          *ngFor="let func of filteredFunctions"
          class="function-card"
          [class.available]="func.available"
          [class.missing]="!func.available"
        >
          <div class="function-header">
            <h3
              class="function-name"
              [class.native]="func.name.includes('[native]')"
            >
              {{ func.available ? '✅' : '❌' }}
              {{ func.name.includes('[native]') ? '🏗️' : '' }}
              {{ func.name }}
            </h3>
            <span
              class="availability-badge"
              [class.available]="func.available"
              [class.native]="func.name.includes('[native]')"
            >
              {{
                func.available
                  ? func.name.includes('[native]')
                    ? 'Native C++'
                    : 'JavaScript'
                  : 'Not Available'
              }}
            </span>
          </div>

          <div class="function-content">
            <div class="source-section">
              <h4>📄 Source Code:</h4>
              <pre
                class="source-code"
                *ngIf="func.available && func.sourceCode"
                >{{ func.sourceCode }}</pre
              >
              <div class="no-source" *ngIf="!func.available">
                <em>Function not available in current environment</em>
              </div>
              <div class="no-source" *ngIf="func.available && !func.sourceCode">
                <em>Source code could not be retrieved</em>
              </div>
            </div>

            <div class="execute-section" *ngIf="func.available">
              <div class="execute-header">
                <button
                  (click)="toggleExecutePanel(func.name)"
                  class="execute-toggle-btn"
                  [class.active]="executePanel[func.name]?.expanded"
                >
                  ⚡ Execute Function
                  <span class="toggle-icon">{{
                    executePanel[func.name]?.expanded ? '▼' : '▶'
                  }}</span>
                </button>
              </div>

              <div
                class="execute-panel"
                *ngIf="executePanel[func.name]?.expanded"
              >
                <div
                  class="parameter-inputs"
                  *ngIf="getFunctionParameters(func.sourceCode).length > 0"
                >
                  <h5>Parameters:</h5>
                  <div
                    *ngFor="
                      let param of getFunctionParameters(func.sourceCode);
                      let i = index
                    "
                    class="param-input-group"
                  >
                    <span class="param-label">{{ param }}:</span>
                    <input
                      type="text"
                      [(ngModel)]="executePanel[func.name].params[i]"
                      class="param-input"
                      [placeholder]="getParameterHint(param)"
                    />
                  </div>
                </div>

                <div class="execute-actions">
                  <button (click)="executeFunction(func)" class="execute-btn">
                    🚀 Execute
                  </button>
                  <button
                    (click)="clearParameters(func.name)"
                    class="clear-params-btn"
                  >
                    �️ Clear
                  </button>
                </div>

                <div
                  class="execute-result"
                  *ngIf="executePanel[func.name]?.result !== undefined"
                >
                  <h5>Result:</h5>
                  <pre class="result-output">{{
                    executePanel[func.name].result | json
                  }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="help-section" *ngIf="filteredFunctions.length === 0">
        <p>No functions match your search criteria.</p>
      </div>
    </div>
  `,
  styles: [
    `
      .function-explorer-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        background: #1a1a1a;
        color: #e0e0e0;
        min-height: 100vh;
      }

      h1 {
        color: #4a9eff;
        margin-bottom: 10px;
        font-size: 28px;
      }

      .description {
        margin-bottom: 30px;
        color: #b0b0b0;
        font-size: 16px;
      }

      .export-section {
        margin-bottom: 30px;
        text-align: center;
      }

      .status-card {
        background: #2a2a2a;
        padding: 20px;
        border-radius: 8px;
        border-left: 4px solid #4a9eff;
      }

      .status-card {
        position: relative;
      }

      .status-card.success {
        border-left-color: #4caf50;
      }

      .status-card.error {
        border-left-color: #f44336;
      }

      .status-card.info {
        border-left-color: #2196f3;
      }

      .status-card pre {
        white-space: pre-wrap;
        background: #1e1e1e;
        padding: 15px;
        border-radius: 4px;
        font-family: 'Courier New', monospace;
        font-size: 14px;
        line-height: 1.4;
        margin: 10px 0;
      }

      .clear-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        background: #f44336;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 5px 10px;
        cursor: pointer;
        font-size: 12px;
      }

      .clear-btn:hover {
        background: #d32f2f;
      }

      /* Tab System */
      .tabs-section {
        margin: 20px 0;
      }

      .tab-header {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 20px;
        border-bottom: 2px solid #444;
        padding-bottom: 10px;
      }

      .tab-btn {
        background: #2a2a2a;
        color: #ccc;
        border: 1px solid #555;
        border-radius: 6px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.3s ease;
        white-space: nowrap;
      }

      .tab-btn:hover {
        background: #3a3a3a;
        color: #fff;
        border-color: #666;
      }

      .tab-btn.active {
        background: #4a9eff;
        color: white;
        border-color: #4a9eff;
        font-weight: bold;
      }

      .tab-btn.active:hover {
        background: #357abd;
        border-color: #357abd;
      }

      .export-btn {
        padding: 10px 20px;
        background: #28a745;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        transition: background-color 0.2s;
      }

      .export-btn:hover {
        background: #218838;
      }

      .filtered-scan-btn {
        background: linear-gradient(45deg, #ff6b35, #f7931e) !important;
        border-color: #ff6b35 !important;
      }

      .filtered-scan-btn:hover {
        background: linear-gradient(45deg, #e55a2b, #d4841a) !important;
      }

      .super-filtered-btn {
        background: linear-gradient(45deg, #dc2626, #b91c1c) !important;
        border-color: #dc2626 !important;
        animation: pulse 2s infinite;
      }

      .super-filtered-btn:hover {
        background: linear-gradient(45deg, #b91c1c, #991b1b) !important;
        box-shadow: 0 0 20px rgba(220, 38, 38, 0.5);
      }

      .send-server-btn {
        background: linear-gradient(45deg, #4a9eff, #357abd) !important;
        border-color: #4a9eff !important;
        animation: pulse 2s infinite;
        font-size: 16px !important;
        padding: 15px 30px !important;
      }

      .send-server-btn:hover {
        background: linear-gradient(45deg, #357abd, #2563eb) !important;
        box-shadow: 0 0 20px rgba(74, 158, 255, 0.5);
      }

      .remote-console-btn {
        background: linear-gradient(45deg, #ff6b6b, #ee5a52) !important;
        border-color: #ff6b6b !important;
        animation: glow 2s ease-in-out infinite alternate;
        font-size: 16px !important;
        padding: 15px 30px !important;
        margin-left: 15px !important;
      }

      .remote-console-btn:hover {
        background: linear-gradient(45deg, #ee5a52, #dc3545) !important;
        box-shadow: 0 0 20px rgba(255, 107, 107, 0.5);
        transform: translateY(-2px);
      }

      @keyframes glow {
        0% {
          box-shadow: 0 0 5px rgba(255, 107, 107, 0.3);
        }
        100% {
          box-shadow: 0 0 20px rgba(255, 107, 107, 0.8);
        }
      }

      .test-connection-btn {
        background: linear-gradient(45deg, #9c88ff, #8b5cf6) !important;
        border-color: #9c88ff !important;
        font-size: 16px !important;
        padding: 15px 30px !important;
        margin-left: 15px !important;
      }

      .test-connection-btn:hover {
        background: linear-gradient(45deg, #8b5cf6, #7c3aed) !important;
        box-shadow: 0 0 20px rgba(156, 136, 255, 0.5);
        transform: translateY(-2px);
      }

      .debug-btn {
        background: linear-gradient(45deg, #f59e0b, #d97706) !important;
        border-color: #f59e0b !important;
        font-size: 16px !important;
        padding: 15px 30px !important;
        margin-left: 15px !important;
      }

      .debug-btn:hover {
        background: linear-gradient(45deg, #d97706, #b45309) !important;
        box-shadow: 0 0 20px rgba(245, 158, 11, 0.5);
        transform: translateY(-2px);
      }

      .quick-test-btn {
        background: linear-gradient(45deg, #10b981, #059669) !important;
        border-color: #10b981 !important;
        font-size: 16px !important;
        padding: 15px 30px !important;
        margin-left: 15px !important;
      }

      .quick-test-btn:hover {
        background: linear-gradient(45deg, #059669, #047857) !important;
        box-shadow: 0 0 20px rgba(16, 185, 129, 0.5);
        transform: translateY(-2px);
      }

      @keyframes pulse {
        0%,
        100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.02);
        }
      }

      .server-config {
        margin-top: 20px;
        padding: 15px;
        background: #1a1a1a;
        border-radius: 6px;
        border: 1px solid #444;
      }

      .server-config label {
        display: block;
        margin-bottom: 8px;
        font-weight: bold;
        color: #e0e0e0;
      }

      .server-input {
        width: 100%;
        padding: 8px 12px;
        background: #2a2a2a;
        border: 1px solid #555;
        border-radius: 4px;
        color: #e0e0e0;
        font-size: 14px;
        margin-bottom: 8px;
      }

      .server-input:focus {
        outline: none;
        border-color: #4a9eff;
      }

      .server-config small {
        color: #888;
        font-size: 12px;
      }

      .filter-section {
        margin-bottom: 30px;
        display: flex;
        gap: 20px;
        align-items: center;
        flex-wrap: wrap;
      }

      .search-input {
        padding: 10px 15px;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 6px;
        color: #e0e0e0;
        font-size: 14px;
        min-width: 300px;
      }

      .search-input:focus {
        outline: none;
        border-color: #4a9eff;
      }

      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 14px;
      }

      .checkbox-label input[type='checkbox'] {
        cursor: pointer;
      }

      .functions-list {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .function-card {
        background: #2a2a2a;
        border-radius: 8px;
        overflow: hidden;
        border-left: 4px solid #666;
      }

      .function-card.available {
        border-left-color: #28a745;
      }

      .function-card.missing {
        border-left-color: #dc3545;
      }

      .function-header {
        padding: 15px 20px;
        background: #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
      }

      .function-name {
        margin: 0;
        font-size: 18px;
        color: #e0e0e0;
      }

      .availability-badge {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: bold;
        background: #dc3545;
        color: white;
      }

      .availability-badge.available {
        background: #28a745;
      }

      .availability-badge.native {
        background: #ff6b35;
        color: white;
      }

      .function-name.native {
        color: #ff6b35;
        font-weight: bold;
      }

      .function-content {
        padding: 20px;
      }

      .source-section h4 {
        color: #4a9eff;
        margin: 0 0 15px 0;
        font-size: 16px;
      }

      .source-code {
        background: #1a1a1a;
        border: 1px solid #444;
        border-radius: 6px;
        padding: 15px;
        overflow-x: auto;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.4;
        color: #e0e0e0;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .no-source {
        background: #2a2a2a;
        border: 1px dashed #666;
        border-radius: 6px;
        padding: 15px;
        text-align: center;
        color: #888;
        font-style: italic;
      }

      .actions {
        margin-top: 15px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .execute-section {
        margin-top: 15px;
        border-top: 1px solid #444;
        padding-top: 15px;
      }

      .execute-toggle-btn {
        width: 100%;
        padding: 10px 15px;
        background: #2a2a2a;
        color: #e0e0e0;
        border: 1px solid #555;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: all 0.2s;
      }

      .execute-toggle-btn:hover {
        background: #3a3a3a;
        border-color: #666;
      }

      .execute-toggle-btn.active {
        background: #4a9eff;
        color: white;
        border-color: #4a9eff;
      }

      .toggle-icon {
        font-size: 12px;
        transition: transform 0.2s;
      }

      .execute-panel {
        background: #2a2a2a;
        border: 1px solid #555;
        border-top: none;
        border-radius: 0 0 6px 6px;
        padding: 15px;
      }

      .parameter-inputs h5 {
        color: #4a9eff;
        margin: 0 0 10px 0;
        font-size: 14px;
      }

      .param-input-group {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }

      .param-label {
        min-width: 80px;
        font-size: 13px;
        color: #ccc;
        font-weight: bold;
      }

      .param-input {
        flex: 1;
        padding: 6px 10px;
        background: #1a1a1a;
        border: 1px solid #555;
        border-radius: 4px;
        color: #e0e0e0;
        font-size: 13px;
      }

      .param-input:focus {
        outline: none;
        border-color: #4a9eff;
      }

      .execute-actions {
        margin: 15px 0 10px 0;
        display: flex;
        gap: 10px;
      }

      .execute-btn {
        padding: 8px 16px;
        background: #28a745;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        font-weight: bold;
        transition: background-color 0.2s;
      }

      .execute-btn:hover {
        background: #218838;
      }

      .clear-params-btn {
        padding: 8px 16px;
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        font-weight: bold;
        transition: background-color 0.2s;
      }

      .clear-params-btn:hover {
        background: #545b62;
      }

      .execute-result h5 {
        color: #4a9eff;
        margin: 15px 0 8px 0;
        font-size: 14px;
      }

      .result-output {
        background: #1a1a1a;
        border: 1px solid #444;
        border-radius: 4px;
        padding: 10px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        color: #e0e0e0;
        white-space: pre-wrap;
        max-height: 200px;
        overflow-y: auto;
      }

      .help-section {
        text-align: center;
        padding: 60px 20px;
        color: #888;
        font-size: 16px;
      }

      @media (max-width: 768px) {
        .function-explorer-container {
          padding: 15px;
        }

        .filter-section {
          flex-direction: column;
          align-items: stretch;
        }

        .search-input {
          min-width: auto;
          width: 100%;
        }

        .function-header {
          flex-direction: column;
          align-items: stretch;
        }

        .function-name {
          text-align: center;
        }
      }
    `,
  ],
})
export class FunctionExplorerComponent implements OnInit {
  functions: HisenseFunction[] = [];
  filteredFunctions: HisenseFunction[] = [];
  availableFunctions: HisenseFunction[] = [];
  searchTerm = '';
  showOnlyAvailable = false;
  serverEndpoint = this.getDefaultServerEndpoint();

  statusMessage = '';
  statusType: 'success' | 'error' | 'info' = 'info';

  // Category system
  selectedCategory = 'all';
  executePanel: Record<
    string,
    { expanded: boolean; params: string[]; result: unknown }
  > = {};
  categories = [
    { key: 'all', name: 'All Functions', icon: '📋' },
    { key: 'system', name: 'System Info', icon: '⚙️' },
    { key: 'network', name: 'Network', icon: '🌐' },
    { key: 'media', name: 'Media & Audio', icon: '🎵' },
    { key: 'apps', name: 'App Management', icon: '📱' },
    { key: 'security', name: 'Security & Crypto', icon: '🔐' },
    { key: 'filesystem', name: 'File System', icon: '📁' },
    { key: 'backend', name: 'Backend APIs', icon: '🔧' },
    { key: 'debug', name: 'Debug & Logs', icon: '🐛' },
  ];

  constructor(private vidaaService: VidaaService) {}

  ngOnInit(): void {
    setTimeout(() => this.scanTvSecurityApis(), 500);
    // Auto-initialize remote handler for TV commands
    setTimeout(() => this.autoInitRemoteHandler(), 1000);

    // Listen for remote handler status updates
    window.addEventListener('remoteHandlerStatus', (event: any) => {
      const { message, type } = event.detail;
      this.showStatus(message, type);
    });
  }

  selectCategory(category: string): void {
    this.selectedCategory = category;
    this.filterFunctions();
  }

  getCategoryCount(category: string): number {
    if (category === 'all') {
      return this.availableFunctions.length;
    }
    return this.availableFunctions.filter(
      (func) => this.getFunctionCategory(func.name) === category
    ).length;
  }

  private getFunctionCategory(functionName: string): string {
    // System Info
    if (
      functionName.match(
        /Get(Device|Model|Brand|Country|Api|OS|Firmware|Version|Chipset|Serial|Region|Feature|Capability)/
      )
    ) {
      return 'system';
    }

    // Network
    if (functionName.match(/Get(Net|IP|Mac|DNS)|SetDNS|Network/)) {
      return 'network';
    }

    // Media & Audio
    if (
      functionName.match(
        /Get(Volume|Sound|Picture|4K|HDR|Resolution|Mute|Dolby|TTS|Subtitle)/
      )
    ) {
      return 'media';
    }

    // App Management
    if (
      functionName.match(
        /App|Install|getAllAppJsonObj|getInstalledAppJsonObj|writeInstallAppObjToJson|mapAppInfoFields/
      )
    ) {
      return 'apps';
    }

    // Security & Crypto
    if (
      functionName.match(
        /Encrypt|Decrypt|RSA|CheckCode|CheckAccess|Reset|HiSdk/
      )
    ) {
      return 'security';
    }

    // File System
    if (functionName.match(/FileRead|FileWrite/)) {
      return 'filesystem';
    }

    // Backend APIs
    if (functionName.match(/^(HiUtils_|TvInfo_|omi_platform)/)) {
      return 'backend';
    }

    // Debug & Logs
    if (functionName.match(/Debug|Log|Print|Observer|VKB/)) {
      return 'debug';
    }

    return 'system'; // Default
  }

  private getFunctionSource(functionName: string): string {
    try {
      const cleanFuncName = functionName.replace(' [native]', '');
      const windowObj = window as typeof window & Record<string, unknown>;
      let func = windowObj[cleanFuncName];

      if (!func) {
        const globalObj = globalThis as typeof globalThis &
          Record<string, unknown>;
        func = globalObj[cleanFuncName];
      }

      if (typeof func === 'function') {
        const sourceCode = (func as (...args: unknown[]) => unknown).toString();

        if (sourceCode.includes('[native code]')) {
          return `// Native Function: ${cleanFuncName}\n// C++ implementation - source not available\n\nfunction ${cleanFuncName}() { [native code] }`;
        }

        return sourceCode;
      }
      return '';
    } catch {
      return '';
    }
  }

  filterFunctions(): void {
    this.filteredFunctions = this.functions.filter((func) => {
      const matchesSearch =
        !this.searchTerm ||
        func.name.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesAvailability = !this.showOnlyAvailable || func.available;
      const matchesCategory =
        this.selectedCategory === 'all' ||
        this.getFunctionCategory(func.name) === this.selectedCategory;

      return matchesSearch && matchesAvailability && matchesCategory;
    });
  }

  toggleExecutePanel(funcName: string): void {
    if (!this.executePanel[funcName]) {
      this.executePanel[funcName] = {
        expanded: false,
        params: [],
        result: undefined,
      };
    }
    this.executePanel[funcName].expanded =
      !this.executePanel[funcName].expanded;
  }

  getFunctionParameters(sourceCode: string): string[] {
    if (!sourceCode) return [];

    const match = sourceCode.match(/function\s*\([^)]*\)/);
    if (!match) return [];

    const paramString = match[0].replace(/function\s*\(|\)/g, '').trim();
    if (!paramString) return [];

    return paramString
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p);
  }

  getParameterHint(paramName: string): string {
    const name = paramName.toLowerCase();
    if (name.includes('code') || name.includes('id')) return 'Enter code/ID...';
    if (name.includes('path') || name.includes('url')) return 'Enter path...';
    if (name.includes('content') || name.includes('data'))
      return 'Enter content...';
    if (name.includes('mode') || name.includes('enable')) return 'true/false';
    if (name.includes('callback')) return 'function() {...}';
    return 'Enter value...';
  }

  executeFunction(func: HisenseFunction): void {
    try {
      const windowObj = window as unknown as Record<string, unknown>;
      const targetFunc = windowObj[func.name];

      if (typeof targetFunc !== 'function') {
        this.executePanel[func.name].result = 'Error: Function not found';
        return;
      }

      const params = this.executePanel[func.name]?.params || [];
      const processedParams = params.map((param) => {
        if (!param.trim()) return undefined;
        if (param === 'true') return true;
        if (param === 'false') return false;
        if (!isNaN(Number(param))) return Number(param);
        return param;
      });

      const result = (targetFunc as (...args: unknown[]) => unknown)(
        ...processedParams
      );
      this.executePanel[func.name].result = result;

      this.showStatus(
        `✅ Executed ${func.name}\nResult: ${JSON.stringify(result)}`,
        'success'
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.executePanel[func.name].result = `Error: ${errorMsg}`;
      this.showStatus(`❌ Execution failed: ${errorMsg}`, 'error');
    }
  }

  clearParameters(funcName: string): void {
    if (this.executePanel[funcName]) {
      this.executePanel[funcName].params = [];
      this.executePanel[funcName].result = undefined;
    }
  }

  copyAllDefinitions(): void {
    const definitions = this.generateTypeScriptDefinitions();
    const sourceCode = this.generateSourceCodeExport();

    const combined = [
      '// TypeScript Definitions',
      definitions,
      '',
      '// Function Source Code',
      sourceCode,
    ].join('\n');

    navigator.clipboard
      .writeText(combined)
      .then(() => {
        // Clipboard copy successful
      })
      .catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = combined;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      });
  }

  scanTvSecurityApis(): void {
    try {
      const allFunctions = new Set<string>();

      const allowedPatterns = [
        /^Hisense_/i,
        /^HiUtils_/i,
        /^VIDAA/i,
        /^TvInfo/i,
        /^vowOS/i,
        /^omi_platform/i,
        /Encrypt|Decrypt|RSA|Crypto/i,
        /Install|Uninstall/i,
        /Debug|Log/i,
        /Network|DNS|IP/i,
        /Device|Reset|Reboot/i,
        /File|Read|Write/i,
        /Access|Auth|Login/i,
        /_V[0-9]/,
        /Port|Socket/i,
        /Config|Setting/i,
        /Platform|System/i,
        /Enable|Disable/i,
        /^TV[A-Z]/,
        /Remote|Control/i,
        /Permission|Security/i,
        /Root|Admin|Elevated/i,
        /Shell|Execute|Run/i,
        /Memory|Buffer|Heap/i,
        /^[A-Z][a-z]+_[A-Z]/,
        /^[a-z]+OS/i,
        /Native|Bridge|JNI/i,
      ];

      const blockedPatterns = [
        /^webkit/i,
        /^moz/i,
        /^ms/i,
        /^o[A-Z]/,
        /^chrome/i,
        /^safari/i,
        /^edge/i,
        /HTML|DOM|CSS/i,
        /Canvas|WebGL|Audio|Video/i,
        /Animation|Transition/i,
        /Blob|FormData|Headers/i,
        /Request|Response|fetch/i,
        /Storage|IndexedDB/i,
        /Worker|Service|Background/i,
        /Notification|Push/i,
        /Geolocation|Sensor/i,
        /Battery|NetworkInfo/i,
        /FileSystem/i,
        /^HID/i,
        /^GM_/i,
        /^Gyroscope$/i,
        /^Accelerometer$/i,
        /^Magnetometer$/i,
        /^AbortController$/,
        /^AbortSignal$/,
        /^ArrayBuffer$/,
        /^DataView$/,
        /^Crypto$/,
        /^CryptoKey$/,
        /^CryptoKeyPair$/,
        /^File$/,
        /^FileReader$/,
        /^FileList$/,
        /^Clipboard$/,
        /^ClipboardEvent$/,
        /^ClipboardItem$/,
        /^CloseEvent$/,
        /^CompositionEvent$/,
        /^CustomEvent$/,
        /^DeviceMotion/,
        /^DeviceOrientation/,
        /^DragEvent$/,
        /^Event$/,
        /^ErrorEvent$/,
        /^FocusEvent$/,
        /^FormData$/,
        /^HashChangeEvent$/,
        /^Headers$/,
        /^History$/,
        /^ImageCapture$/,
        /^ImageData$/,
        /^InputEvent$/,
        /^IntersectionObserver/,
        /^KeyboardEvent$/,
        /^Location$/,
        /^MediaCapabilities$/,
        /^MediaDevices$/,
        /^MediaQuery/,
        /^MediaRecorder$/,
        /^MediaSession$/,
        /^MediaStream/,
        /^MessageChannel$/,
        /^MessageEvent$/,
        /^MessagePort$/,
        /^MouseEvent$/,
        /^MutationObserver$/,
        /^Navigator$/,
        /^PageTransitionEvent$/,
        /^Path2D$/,
        /^Performance/,
        /^PointerEvent$/,
        /^PopStateEvent$/,
        /^ProgressEvent$/,
        /^ReadableStream$/,
        /^ResizeObserver/,
        /^RTCPeerConnection$/,
        /^Screen$/,
        /^StorageEvent$/,
        /^TextDecoder$/,
        /^TextEncoder$/,
        /^TextMetrics$/,
        /^TimeRanges$/,
        /^TouchEvent$/,
        /^TransitionEvent$/,
        /^UIEvent$/,
        /^URL$/,
        /^URLSearchParams$/,
        /^VisibilityChangeEvent$/,
        /^WheelEvent$/,
        /^Window$/,
        /^XMLHttpRequest$/,

        // Block FileSystem APIs that came through
        /^FileSystemDirectoryHandle$/,
        /^FileSystemFileHandle$/,
        /^FileSystemHandle$/,
        /^FileSystemWritableFileStream$/,

        // Block HID APIs
        /^HIDDevice$/,
        /^HIDInputReportEvent$/,
        /^HIDConnectionEvent$/,

        // Block Sensor APIs
        /^Gyroscope$/,
        /^Accelerometer$/,
        /^Magnetometer$/,
        /^AmbientLightSensor$/,
        /^ProximitySensor$/,

        // Block Greasemonkey/Userscript APIs
        /^GM_/,
        /^unsafeWindow$/,

        // Block more standard APIs that might come through
        /^PaymentRequest$/,
        /^PaymentResponse$/,
        /^PushSubscription$/,
        /^PushManager$/,
        /^Presentation/,
        /^VirtualKeyboard$/,
        /^CredentialsContainer$/,
        /^PublicKeyCredential$/,
        /^AuthenticatorAssertionResponse$/,
        /^AuthenticatorAttestationResponse$/,

        // Block APIs that came through in our ultra scan
        /^BeforeInstallPromptEvent$/,
        /^CaptureController$/,
        /^ContentVisibility/,
        /^CreateOipfObject$/,
        /^DisableInterDeviceSync/,
        /^EnableInterDeviceSync/,
        /^InputDeviceCapabilities$/,
        /^InputDeviceInfo$/,
        /^MIDIAccess$/,
        /^MIDIPort$/,
        /^MediaDeviceInfo$/,
        /^MediaEncryptedEvent$/,
        /^MediaKeySystemAccess$/,
        /^PermissionStatus$/,
        /^Permissions$/,
        /^Profiler$/,
        /^RTCDtlsTransport$/,
        /^RTCIceTransport$/,
        /^RTCSctpTransport$/,
        /^RTCSessionDescription$/,
        /^RTCStatsReport$/,
        /^ReadableByteStreamController$/,
        /^ReadableStreamBYOBReader$/,
        /^ReadableStreamDefaultController$/,
        /^ReadableStreamDefaultReader$/,
        /^RemotePlayback$/,
        /^RunPerfTest$/,
        /^SVGClipPathElement$/,
        /^SVGEllipseElement$/,
        /^SVGFECompositeElement$/,
        /^SVGFEMorphologyElement$/,
        /^SVGScriptElement$/,
        /^SVGTextPositioningElement$/,
        /^ScriptProcessorNode$/,
        /^SecurityPolicyViolationEvent$/,
        /^SerialPort$/,
        /^ShadowRoot$/,
        /^SourceBuffer$/,
        /^SourceBufferList$/,
        /^StylePropertyMapReadOnly$/,
        /^SubtleCrypto$/,
        /^TransformStreamDefaultController$/,
        /^TrustedScript$/,
        /^TrustedScriptURL$/,
        /^USBConfiguration$/,
        /^USBDevice$/,
        /^VisualViewport$/,
        /^WebSocket$/,
        /^WebTransport/,
        /^WindowControlsOverlay/,
        /^WritableStreamDefaultController$/,
        /^WritableStreamDefaultWriter$/,
        /^XRPose$/,
        /^XRSystem$/,
        /^XRViewerPose$/,
        /^XRViewport$/,
        /^__zone_symbol__/,
        /^close$/,
        /^debug$/,
        /^postMessage$/,
        /^reportError$/,
        /^getAllAngularRootElements$/,
        /^showOpenFilePicker$/,
        /^showSaveFilePicker$/,
        /^pvr_supported$/,
        /^[A-Z][a-z]+Event$/,
        /^[A-Z][a-z]+Observer$/,
        /^[A-Z][a-z]+Controller$/,
        /^[A-Z][a-z]+Manager$/,
        /^[A-Z][a-z]+Stream$/,
        /^[A-Z][a-z]+Node$/,
        /^IDB/,
        /^WebGL/,
        /^RTCPeer/,
        /^Mutation/,
        /^Intersection/,
        /^Performance/,
        /^Geolocation/,
        /^Notification/,
        /^Audio$/,
        /^Video$/,
        /^Image$/,
        /^Option$/,
        /^Promise$/,
        /^Proxy$/,
        /^Reflect$/,
        /^WeakMap$/,
        /^WeakSet$/,
        /^Map$/,
        /^Set$/,
        /^Symbol$/,
        /^BigInt$/,
        /^Int8Array$/,
        /^Uint8Array$/,
        /^Int16Array$/,
        /^Uint16Array$/,
        /^Int32Array$/,
        /^Uint32Array$/,
        /^Float32Array$/,
        /^Float64Array$/,
        /^BigInt64Array$/,
        /^BigUint64Array$/,
        /^Uint8ClampedArray$/,
      ];

      // Scan window functions
      Object.getOwnPropertyNames(window).forEach((name) => {
        try {
          const windowObj = window as unknown as Record<string, unknown>;
          if (typeof windowObj[name] === 'function') {
            const isAllowed = allowedPatterns.some((pattern) =>
              pattern.test(name)
            );
            const isBlocked = blockedPatterns.some((pattern) =>
              pattern.test(name)
            );

            if (isAllowed && !isBlocked) {
              allFunctions.add(`window.${name}`);
            }
          }
        } catch {
          // Ignore access errors
        }
      });

      // Scan global functions
      Object.getOwnPropertyNames(globalThis).forEach((name) => {
        try {
          const globalObj = globalThis as unknown as Record<string, unknown>;
          if (typeof globalObj[name] === 'function') {
            const isAllowed = allowedPatterns.some((pattern) =>
              pattern.test(name)
            );
            const isBlocked = blockedPatterns.some((pattern) =>
              pattern.test(name)
            );

            if (
              isAllowed &&
              !isBlocked &&
              !allFunctions.has(`window.${name}`)
            ) {
              allFunctions.add(`global.${name}`);
            }
          }
        } catch {
          // Ignore access errors
        }
      });

      // Scan TV objects
      const tvObjects = ['vowOS', 'omi_platform', 'TvInfo_Json'];
      tvObjects.forEach((objName) => {
        try {
          const windowObj = window as unknown as Record<string, unknown>;
          const obj = windowObj[objName];
          if (obj && typeof obj === 'object') {
            const objRecord = obj as Record<string, unknown>;
            Object.getOwnPropertyNames(objRecord).forEach((name) => {
              try {
                if (typeof objRecord[name] === 'function') {
                  allFunctions.add(`${objName}.${name}`);
                }
              } catch {
                // Ignore method access errors
              }
            });
          }
        } catch {
          // Object not available
        }
      });

      const functionArray = Array.from(allFunctions).sort();

      // Update UI with scanned security functions
      const scannedFunctions = functionArray.map((name) => ({
        name: name.replace(/^(window\.|global\.)/, ''), // Remove window./global. prefix
        available: true, // All scanned functions are available
        sourceCode: this.getFunctionSource(
          name.replace(/^(window\.|global\.)/, '')
        ),
      }));

      // Replace current functions with security scan results
      this.functions = scannedFunctions.sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      this.availableFunctions = this.functions.filter((f) => f.available);
      this.filterFunctions();
    } catch (error) {
      console.error('Scan failed:', error);
    }
  }

  showStatus(message: string, type: 'success' | 'error' | 'info'): void {
    this.statusMessage = message;
    this.statusType = type;
  }

  getDefaultServerEndpoint(): string {
    // Use Port 3000 with separate endpoint for remote commands
    const hostname = window.location.hostname;

    // Use vidaahub.com:3000 for consistency with working uploads
    if (hostname === 'vidaahub.com' || hostname.endsWith('.vidaahub.com')) {
      return 'http://vidaahub.com:3000/api/remote-command';
    }

    // For development or other domains, still use vidaahub.com:3000 via PiHole DNS
    return 'http://vidaahub.com:3000/api/remote-command';
  }

  clearStatus(): void {
    this.statusMessage = '';
  }

  async sendToServer(): Promise<void> {
    this.showStatus(
      `🚀 Sending to server...\nEndpoint: ${this.serverEndpoint}\nFunctions: ${this.availableFunctions.length}`,
      'info'
    );

    if (!this.serverEndpoint) {
      this.showStatus('❌ Please enter a development server endpoint', 'error');
      return;
    }

    if (this.availableFunctions.length === 0) {
      this.showStatus(
        '❌ No functions available to send.\n\nPlease click "🔄 Refresh Functions" first to scan for available Hisense functions.',
        'error'
      );
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      functions: this.availableFunctions.map((func) => ({
        name: func.name,
        sourceCode: func.sourceCode,
        available: func.available,
      })),
      typeDefinitions: this.generateTypeScriptDefinitions(),
      deviceInfo: this.getDeviceInfo(),
    };

    try {
      // Use relative URL for function upload to avoid CORS issues
      const uploadEndpoint = '/api/functions';

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.text();
        this.showStatus(
          `✅ Success!\n\nFunction definitions sent to server.\n\nSent ${
            this.availableFunctions.length
          } functions to ${uploadEndpoint}.\nServer response: ${result.substring(
            0,
            100
          )}...`,
          'success'
        );
      } else {
        this.showStatus(
          `❌ Server Error!\n\nStatus: ${response.status}\nMessage: ${response.statusText}\n\nCheck if the server is running for:\n${uploadEndpoint}`,
          'error'
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('Failed to fetch')) {
        this.showStatus(
          `❌ CORS/Network Error!\n\n"Failed to fetch" indicates:\n\n🚫 Most likely CORS issue:\nTV browser blocks cross-origin requests to:\n${this.serverEndpoint}\n\n🛠️ Server needs CORS headers:\nAccess-Control-Allow-Origin: *\nAccess-Control-Allow-Methods: POST\nAccess-Control-Allow-Headers: Content-Type\n\n📡 Other causes:\n• No internet connection\n• DNS resolution failed\n• Server not running\n• TV browser security policy\n\n� Try: Use same-origin deployment or proxy`,
          'error'
        );
      } else if (errorMessage.toLowerCase().includes('cors')) {
        this.showStatus(
          `❌ CORS Policy Error!\n\nThe server at:\n${this.serverEndpoint}\n\nis blocking cross-origin requests.\n\n🛠️ Server configuration needed:\n\n1. Add CORS headers:\n   Access-Control-Allow-Origin: *\n   Access-Control-Allow-Methods: POST, OPTIONS\n   Access-Control-Allow-Headers: Content-Type\n\n2. Handle preflight OPTIONS requests\n\n3. Or deploy function explorer on same domain`,
          'error'
        );
      } else {
        this.showStatus(
          `❌ Connection Error!\n\nError: ${errorMessage}\n\nTroubleshooting:\n1. Is the development server running?\n2. Is the IP address correct: ${this.serverEndpoint}?\n3. Is the TV connected to the same network?`,
          'error'
        );
      }
    }
  }

  openRemoteConsole(): void {
    this.showStatus(
      `🎮 Opening Remote Console...\n\nConnecting to your laptop's Remote Console interface.`,
      'info'
    );

    // Try to determine server hostname from server endpoint
    let serverHost = 'vidaahub.com'; // Default to local DNS
    if (this.serverEndpoint) {
      const match = this.serverEndpoint.match(/https?:\/\/([^:\/]+)/);
      if (match) {
        serverHost = match[1];
      }
    }

    // Build Remote Console URL (for laptop access)
    const consoleURL = `http://${serverHost}:3001/`;

    // Don't navigate away from Function Explorer on TV!
    // Instead show info and activate remote handler
    this.showStatus(
      `🎮 Remote Console Setup\n\n✅ TV Remote Handler wird aktiviert...\n\n📱 Für Eingaben öffne auf deinem LAPTOP:\n${consoleURL}\n\n📋 Anweisungen:\n1. TV bleibt im Function Explorer (diese Seite)\n2. Laptop öffnet Remote Console unter obiger URL\n3. TV empfängt Befehle vom Laptop automatisch\n\n🔧 Falls Probleme:\n- Enhanced Receiver läuft auf: ${serverHost}\n- DNS: vidaahub.com zeigt auf Server-IP\n- TV und Server im gleichen Netzwerk`,
      'info'
    );

    // Also try to initialize the TV Remote Handler if not already done
    this.initRemoteHandler(serverHost);
  }

  async testConnection(): Promise<void> {
    this.showStatus('🔍 Checking Remote Console connection...', 'info');

    // Use same endpoint as function upload (we know this works)
    const serverHost = this.serverEndpoint
      ? this.serverEndpoint.match(/https?:\/\/([^:\/]+)/)?.[1] || 'vidaahub.com'
      : 'vidaahub.com';

    let results = '🔍 Remote Console Status:\n\n';

    // Test Console API (port 3001)
    try {
      const consoleResponse = await fetch(
        `http://${serverHost}:3001/api/status`
      );
      if (consoleResponse.ok) {
        const status = await consoleResponse.json();
        results += `✅ Console Server: ONLINE\n`;
        results += `   TV Connected: ${
          status.tvConnected ? '✅ YES' : '❌ NO'
        }\n`;
        results += `   Command Queue: ${
          status.commandQueueLength || 0
        } pending\n`;
      } else {
        results += `⚠️ Console Server: HTTP ${consoleResponse.status}\n`;
      }
    } catch (error) {
      results += `❌ Console Server: Not reachable\n`;
      results += `   URL: http://${serverHost}:3001/api/status\n`;
    }

    // Check Remote Handler Status
    if ((window as any).remoteControl) {
      const remoteStatus = (window as any).remoteControl.status();
      results += `\n🎮 TV Remote Handler:\n`;
      results += `   Status: ${
        remoteStatus.enabled ? '✅ ACTIVE' : '❌ INACTIVE'
      }\n`;
      results += `   URL: ${remoteStatus.receiverUrl}\n`;
    } else {
      results += `\n🎮 TV Remote Handler: ❌ NOT LOADED\n`;
      results += `   💡 Click "Open Remote Console" to initialize\n`;
    }

    results += `\n📋 Quick Fix:\n`;
    results += `1. If Console Server offline → Check Enhanced Receiver\n`;
    results += `2. If TV not connected → Send functions first (refresh)\n`;
    results += `3. If Handler not loaded → Click "Open Remote Console"\n`;

    this.showStatus(results, 'info');
  }

  debugRemoteHandler(): void {
    this.showStatus('🐛 Debugging Remote Handler...', 'info');

    let debug = '🐛 Remote Handler Debug Info:\n\n';

    // Check if Remote Control is loaded
    if ((window as any).remoteControl) {
      const status = (window as any).remoteControl.status();
      debug += `✅ Remote Handler: LOADED\n`;
      debug += `   Enabled: ${status.enabled ? '✅' : '❌'}\n`;
      debug += `   Receiver URL: ${status.receiverUrl}\n`;

      // Try to trigger a test
      try {
        (window as any).remoteControl.executeTest();
        debug += `   Test execution: ✅ TRIGGERED\n`;
      } catch (e) {
        debug += `   Test execution: ❌ FAILED\n`;
      }
    } else {
      debug += `❌ Remote Handler: NOT LOADED\n`;
      debug += `   Solution: Click "Open Remote Console" first\n`;
    }

    // Check global window functions
    debug += `\n🔍 Available TV Functions:\n`;
    const testFunctions = [
      'Hisense_GetApiVersion',
      'Hisense_GetDeviceInfo',
      'vowOS',
    ];
    testFunctions.forEach((funcName) => {
      const func = (window as any)[funcName];
      debug += `   ${funcName}: ${
        typeof func === 'function' ? '✅' : func ? '📦' : '❌'
      }\n`;
    });

    // Show debug console commands
    debug += `\n💻 Debug Commands (run in browser console):\n`;
    debug += `   window.remoteControl.status()\n`;
    debug += `   window.remoteControl.executeTest()\n`;
    debug += `   window.remoteControl.enable()\n`;
    debug += `\n🔧 Next Steps:\n`;
    debug += `1. If Handler not loaded → Click "Open Remote Console"\n`;
    debug += `2. Check browser console for error messages\n`;
    debug += `3. Verify Enhanced Receiver is running\n`;

    this.showStatus(debug, 'info');
  }

  async quickTest(): Promise<void> {
    this.showStatus('⚡ Running Quick Test...', 'info');

    const serverHost = this.serverEndpoint
      ? this.serverEndpoint.match(/https?:\/\/([^:\/]+)/)?.[1] || 'vidaahub.com'
      : 'vidaahub.com';

    let results = '⚡ Quick Test Results:\n\n';

    // Test 1: Direct TV function call
    try {
      if (typeof (window as any).Hisense_GetApiVersion === 'function') {
        const version = (window as any).Hisense_GetApiVersion();
        results += `✅ Direct TV Function: ${version}\n`;
      } else {
        results += `❌ Direct TV Function: Not found\n`;
      }
    } catch (e) {
      results += `❌ Direct TV Function: Error\n`;
    }

    // Test 2: Enhanced Receiver reachable (use same endpoint as function upload)
    try {
      // Try the exact same URL that function upload uses (we know this works)
      const testUrl = this.serverEndpoint
        ? this.serverEndpoint.replace('/api/functions', '/api/command-check')
        : `http://${serverHost}:3000/api/command-check`;

      const response = await fetch(testUrl);
      results += `✅ Enhanced Receiver: ${
        response.ok ? 'ONLINE' : 'ERROR ' + response.status
      }\n`;
      results += `   URL: ${testUrl}\n`;
    } catch (e) {
      const testUrl =
        this.serverEndpoint || `http://${serverHost}:3000/api/command-check`;
      results += `❌ Enhanced Receiver: NOT REACHABLE\n`;
      results += `   URL: ${testUrl}\n`;
      results += `   Note: Function upload works, so this is a URL/DNS issue\n`;
    }

    // Test 3: Remote Control Function
    if ((window as any).remoteControl) {
      try {
        const testResult = await (window as any).remoteControl.executeTest();
        results += `✅ Remote Control Test: SUCCESS\n`;
      } catch (e) {
        results += `❌ Remote Control Test: FAILED\n`;
      }
    } else {
      results += `❌ Remote Control: NOT LOADED\n`;
    }

    results += `\n🔧 Quick Fixes:\n`;
    results += `• Enhanced Receiver not reachable → Check if running\n`;
    results += `• TV Functions not found → Refresh Functions first\n`;
    results += `• Remote Control failed → Check browser console\n`;
    results += `\n💡 Manual test: Open browser console and run:\n`;
    results += `   Hisense_GetApiVersion()\n`;

    this.showStatus(results, 'info');
  }

  private autoInitRemoteHandler(): void {
    // Automatically initialize remote handler on page load
    const hostname = window.location.hostname;
    let serverHost = 'vidaahub.com';

    // Use same logic as getDefaultServerEndpoint
    if (hostname === 'vidaahub.com' || hostname.endsWith('.vidaahub.com')) {
      serverHost = 'vidaahub.com';
    } else if (this.serverEndpoint) {
      const match = this.serverEndpoint.match(/https?:\/\/([^:\/]+)/);
      if (match) {
        serverHost = match[1];
      }
    }

    this.showStatus('🚀 Starte TV Remote Handler...', 'info');
    this.initRemoteHandler(serverHost);
  }

  private initRemoteHandler(serverHost: string): void {
    // Check if remote handler is already loaded
    if ((window as any).remoteControl) {
      this.showStatus(
        `✅ Remote Control already active!\n\nYour TV is ready for remote commands.\nUse the Remote Console on your laptop to send commands.`,
        'success'
      );
      return;
    }

    // Try to auto-load the remote handler
    const script = `
(function() {
    // Show status in UI instead of console
    function updateStatus(message, type = 'info') {
        const event = new CustomEvent('remoteHandlerStatus', { 
            detail: { message: message, type: type } 
        });
        window.dispatchEvent(event);
    }
    
    updateStatus('🚀 Lade VIDAA Remote Handler...', 'info');
    
    // Use relative URLs to avoid CORS issues (same-origin)
    // Angular dev server will proxy /api/* to Enhanced Receiver via proxy.conf.json
    const RECEIVER_URL = '';
    let isRemoteEnabled = true;
    let commandCheckInterval = null;
    
    // Remote Command Checker Function
    function startRemoteCommandChecker() {
        if (commandCheckInterval) clearInterval(commandCheckInterval);
        
        updateStatus('📡 Verbindungstest zu Enhanced Receiver...', 'info');
        
        // Test connection first (relative URL)
        fetch('/api/status')
            .then(response => {
                if (response.ok) {
                    updateStatus('✅ Enhanced Receiver ist online! TV bereit für Remote-Befehle.', 'success');
                } else {
                    updateStatus('⚠️ Enhanced Receiver Fehler: Status ' + response.status, 'error');
                }
            })
            .catch(error => {
                updateStatus('❌ Enhanced Receiver nicht erreichbar!\\n\\n💡 Starte Enhanced Receiver mit:\\nnpm run enhanced-receiver', 'error');
            });
        
        commandCheckInterval = setInterval(async () => {
            if (!isRemoteEnabled) return;
            
            try {
                const response = await fetch('/api/command-check');
                if (!response.ok) {
                    if (response.status !== 404) {  // Don't spam for normal "no commands" responses
                        updateStatus('Command Check API Problem: Status ' + response.status, 'error');
                    }
                    return;
                }
                
                const data = await response.json();
                if (data.hasCommand) {
                    updateStatus('📥 Führe aus: ' + data.command.function, 'info');
                    await executeRemoteCommand(data.command);
                }
            } catch (error) {
                // Only report persistent connection issues, not every failed poll
            }
        }, 2000);
    }
    
    // Execute Remote Command Function  
    async function executeRemoteCommand(command) {
        let result = {
            commandId: command.id,
            function: command.function,
            parameters: command.parameters,
            success: false,
            data: null,
            error: null,
            timestamp: new Date().toISOString()
        };
        
        try {
            const func = window[command.function];
            if (typeof func !== 'function') {
                throw new Error('Function ' + command.function + ' not found');
            }
            
            const output = func(...command.parameters);
            result.success = true;
            result.data = output;
            
            updateStatus('✅ ' + command.function + ' erfolgreich ausgeführt', 'success');
        } catch (error) {
            result.error = error.message;
            updateStatus('❌ Fehler bei ' + command.function + ': ' + error.message, 'error');
        }
        
        // Send result back (relative URL)
        try {
            await fetch('/api/execute-response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result)
            });
        } catch (e) {
            console.log('Failed to send result back');
        }
    }
    
    // Add to global scope
    window.remoteControl = {
        enable: () => { isRemoteEnabled = true; startRemoteCommandChecker(); },
        disable: () => { isRemoteEnabled = false; if (commandCheckInterval) clearInterval(commandCheckInterval); },
        status: () => ({ enabled: isRemoteEnabled, receiverUrl: 'same-origin /api/*' })
    };
    
    // Auto-start
    startRemoteCommandChecker();
    updateStatus('✅ VIDAA Remote Handler geladen! Bereit für Befehle.', 'success');
})();
`;

    try {
      // Execute the remote handler script
      eval(script);

      this.showStatus(
        `✅ Remote Handler Initialized!\n\nYour TV is now ready to receive commands from the Remote Console.\n\n🎮 Remote Console URL: http://${serverHost}:3001/\n\n💡 You can now use your laptop to send commands to this TV!`,
        'success'
      );
    } catch (error) {
      this.showStatus(
        `⚠️ Auto-initialization failed\n\nPlease manually copy and paste the Remote Handler script from:\ntv-remote-handler.js\n\nInto your TV's browser console to enable remote control.`,
        'error'
      );
    }
  }

  private generateTypeScriptDefinitions(): string {
    const definitions = this.availableFunctions
      .filter((func) => func.sourceCode)
      .map((func) => {
        const source = func.sourceCode;
        const paramMatch = source.match(/function\s*\([^)]*\)/);

        // Determine return type based on function name and content
        let returnType = 'unknown';
        const name = func.name.toLowerCase();

        // String returns - names, versions, codes, addresses
        if (
          name.includes('get') &&
          (name.includes('name') ||
            name.includes('chipset') ||
            name.includes('language'))
        ) {
          returnType = 'string';
        } else if (
          name.includes('get') &&
          (name.includes('id') ||
            name.includes('serial') ||
            name.includes('code') ||
            name.includes('uuid'))
        ) {
          returnType = 'string';
        } else if (
          name.includes('get') &&
          (name.includes('version') ||
            name.includes('brand') ||
            name.includes('model') ||
            name.includes('country'))
        ) {
          returnType = 'string';
        } else if (
          name.includes('get') &&
          (name.includes('address') ||
            name.includes('dns') ||
            name.includes('ip'))
        ) {
          returnType = 'string';
        } else if (name.includes('encrypt') || name.includes('decrypt')) {
          returnType = 'string';
        } else if (name.includes('fileread')) {
          returnType = 'string';
          // Boolean returns - states, enables, supports, checks
        } else if (
          name.includes('get') &&
          (name.includes('state') ||
            name.includes('enable') ||
            name.includes('support'))
        ) {
          returnType = 'boolean';
        } else if (name.includes('check') && name.includes('code')) {
          returnType = 'boolean';
        } else if (
          name.includes('filewrite') ||
          name.includes('set') ||
          name.includes('enable') ||
          name.includes('disable')
        ) {
          returnType = 'boolean';
        } else if (
          name.includes('reset') ||
          name.includes('install') ||
          name.includes('uninstall')
        ) {
          returnType = 'boolean';
          // Object returns
        } else if (name.includes('app') && name.includes('obj')) {
          returnType = 'object';
        } else if (name.includes('info') || name.includes('list')) {
          returnType = 'object';
        }

        // Determine parameter types
        let params = '';
        if (paramMatch) {
          const paramString = paramMatch[0]
            .replace('function', '')
            .replace(/[()]/g, '');
          if (paramString.trim()) {
            const paramNames = paramString
              .split(',')
              .map((p) => p.trim())
              .filter((p) => p);
            const typedParams = paramNames.map((param) => {
              if (
                param.includes('code') ||
                param.includes('path') ||
                param.includes('content') ||
                param.includes('data')
              ) {
                return `${param}: string`;
              } else if (param.includes('mode') || param.includes('enable')) {
                return `${param}: boolean`;
              } else {
                return `${param}: any`;
              }
            });
            params = `(${typedParams.join(', ')})`;
          } else {
            params = '()';
          }
        } else {
          params = '()';
        }

        const signature = `declare function ${func.name}${params}: ${returnType};`;
        return `// ${func.name}\n${signature}`;
      })
      .join('\n\n');

    return definitions;
  }

  private generateSourceCodeExport(): string {
    return this.availableFunctions
      .filter((func) => func.sourceCode)
      .map((func) => {
        return [
          `// ${func.name}`,
          '// ' + '='.repeat(50),
          func.sourceCode,
          '',
        ].join('\n');
      })
      .join('\n');
  }

  private getDeviceInfo(): Record<string, unknown> {
    const info: Record<string, unknown> = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
    };

    const windowObj = window as typeof window & Record<string, unknown>;
    const hisenseInfoFunctions = [
      'Hisense_GetDeviceID',
      'Hisense_GetFirmWareVersion',
      'Hisense_GetBrand',
      'Hisense_GetModelName',
      'Hisense_GetCountryCode',
    ];

    for (const funcName of hisenseInfoFunctions) {
      try {
        if (typeof windowObj[funcName] === 'function') {
          const result = (windowObj[funcName] as () => unknown)();
          info[funcName] = result;
        }
      } catch (error) {
        info[funcName] = `Error: ${error}`;
      }
    }

    return info;
  }
}
