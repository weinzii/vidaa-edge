import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TvCommunicationService,
  FunctionData,
  TVConnectionInfo,
} from '../../services/tv-communication.service';
import {
  FunctionFileGeneratorService,
  type GeneratedFiles,
} from '../../services/function-file-generator.service';
import { Subscription, firstValueFrom } from 'rxjs';
import { CodeModalComponent } from '../code-modal/code-modal.component';
import { ConsoleService } from '../../services/console.service';

@Component({
  selector: 'app-controller-console',
  standalone: true,
  imports: [CommonModule, FormsModule, CodeModalComponent],
  templateUrl: './controller-console.component.html',
  styles: [],
})
export class ControllerConsoleComponent implements OnInit, OnDestroy {
  // Laptop Mode Properties
  availableFunctions: FunctionData[] = [];
  selectedFunction: FunctionData | null = null;
  filteredFunctions: FunctionData[] = [];
  functionFilter = '';
  selectedCategory = 'all';
  expandedSources: Set<string> = new Set();

  // Execution Properties
  parameterValues: string[] = [];
  isExecuting = false;
  executionResult: unknown = null;
  commandHistory: Array<{
    functionName: string;
    parameters?: unknown[];
    customCode?: string; // Store custom code for display
    timestamp: Date;
    success: boolean;
    result?: unknown;
  }> = [];
  expandedHistoryItems: Set<number> = new Set();
  expandedHistoryResults: Set<number> = new Set();

  // Connection Properties
  tvConnection: TVConnectionInfo = {
    connected: false,
    lastSeen: null,
    brand: undefined,
    model: undefined,
    firmware: undefined,
  };

  // Categories for function organization
  categories = [
    { key: 'all', name: 'All Functions', icon: '📋' },
    { key: 'system', name: 'System Info', icon: '🔧' },
    { key: 'network', name: 'Network', icon: '🌐' },
    { key: 'media', name: 'Media & Audio', icon: '🎵' },
    { key: 'apps', name: 'Apps', icon: '📱' },
    { key: 'security', name: 'Security', icon: '🔒' },
    { key: 'filesystem', name: 'File System', icon: '📁' },
  ];

  // Modal Properties
  showCustomCodeModal = false;
  showExecutionModal = false;
  customJsCode = '';
  customCodeResult: unknown = null;
  isExecutingCustomCode = false;
  isExecutionResultExpanded = false;
  isCustomCodeResultExpanded = false;
  isCustomCodeExpanded = false;

  private subscriptions = new Subscription();

  constructor(
    private tvCommunicationService: TvCommunicationService,
    private functionFileGenerator: FunctionFileGeneratorService,
    private consoleService: ConsoleService
  ) {}

  ngOnInit(): void {
    this.loadCommandHistory();
    this.initLaptopMode();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // LAPTOP MODE METHODS
  private initLaptopMode(): void {
    // Subscribe to TV functions from service
    const functionsSubscription =
      this.tvCommunicationService.functions$.subscribe({
        next: (functions: FunctionData[]) => {
          // Only update if we receive actual functions from TV
          if (functions && functions.length > 0) {
            this.availableFunctions = functions;
            this.filterFunctions();
            this.updateConnectionStatus();
          }
          // Keep dummy functions if TV has no functions yet
        },
        error: () => {
          // Handle error silently - UI will show "disconnected" state
        },
      });

    this.subscriptions.add(functionsSubscription);

    // Subscribe to connection status
    const connectionSubscription =
      this.tvCommunicationService.tvConnection$.subscribe({
        next: (connection) => {
          this.tvConnection = connection;
        },
      });

    this.subscriptions.add(connectionSubscription);

    // Load initial functions and apply filter to show dummy data
    this.refreshLibrary();
  }

  private refreshLibrary(): void {
    // Functions are automatically updated via subscription
    // This ensures dummy functions are filtered and displayed
    this.filterFunctions();
  }

  saveFunctionsToDisk(): void {
    if (this.availableFunctions.length === 0) {
      return;
    }

    // Transform functions to FunctionData format
    const functionData: FunctionData[] = this.availableFunctions.map(
      (func) => ({
        name: func.name,
        sourceCode: func.sourceCode,
        available: true,
        parameters: func.parameters || [],
      })
    );

    // Generate enhanced files using the service
    const mockDeviceInfo = {
      userAgent: 'Controller Request',
      platform: 'Manual Save',
      timestamp: new Date().toISOString(),
      // Include current device details if available
      ...(this.tvConnection.brand && {
        Hisense_GetBrand: this.tvConnection.brand,
      }),
      ...(this.tvConnection.model && {
        Hisense_GetModelName: this.tvConnection.model,
      }),
      ...(this.tvConnection.firmware && {
        Hisense_GetFirmWareVersion: this.tvConnection.firmware,
      }),
    };

    const generatedFiles: GeneratedFiles =
      this.functionFileGenerator.generateFiles(functionData, mockDeviceInfo);

    // Save generated files to /public directory
    this.downloadGeneratedFiles(generatedFiles);
  }

  private downloadGeneratedFiles(files: GeneratedFiles): void {
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:.]/g, '-');

    // Save files to /public directory via server API
    const filesToSave = [
      {
        filename: `hisense-functions-${timestamp}.d.ts`,
        content: files.typescript,
      },
      {
        filename: `hisense-source-${timestamp}.js`,
        content: files.javascript,
      },
      {
        filename: `device-info-${timestamp}.json`,
        content: files.deviceInfo,
      },
    ];

    // Send files to server to save in /public directory
    this.tvCommunicationService.saveFilesToPublic(filesToSave).subscribe({
      next: (response: { saved: string[] }) => {
        alert(
          `✅ ${
            response.saved.length
          } files saved to /public directory:\n${response.saved.join('\n')}`
        );
      },
      error: () => {
        alert(
          '❌ Failed to save files. Check dev-server is running on port 3000.'
        );
      },
    });
  }

  filterFunctions(): void {
    let filtered = this.availableFunctions;

    // Apply category filter
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(
        (func) => this.getFunctionCategory(func.name) === this.selectedCategory
      );
    }

    // Apply search filter
    if (this.functionFilter) {
      const searchTerm = this.functionFilter.toLowerCase();
      filtered = filtered.filter(
        (func) =>
          func.name.toLowerCase().includes(searchTerm) ||
          (func.sourceCode &&
            func.sourceCode.toLowerCase().includes(searchTerm)) ||
          (func.description &&
            func.description.toLowerCase().includes(searchTerm))
      );
    }

    this.filteredFunctions = filtered;
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
    // System Info & Device Management
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(Get|Set)?(Device|Model|Brand|Country|Api|OS|Firmware|Version|Chipset|Serial|Region|Feature|Capability|Power|Standby|SystemInfo|DebugLevel|BlockTime|AdTarget|AdsID|CustomerID|CurrentBrowser)/i
      )
    ) {
      return 'system';
    }

    // Network & Connectivity
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(Get|Set)?(Net|IP|Mac|DNS|Network|Wifi|Connection)/i
      )
    ) {
      return 'network';
    }

    // Media, Audio & Video
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(Get|Set)?(Volume|Sound|Picture|4K|HDR|Resolution|Mute|Dolby|TTS|Subtitle|Audio|Video|Media|Display|Brightness|Contrast)/i
      )
    ) {
      return 'media';
    }

    // App Management & Browser
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(App|Install|Launch|Close|Browser|getAllAppJsonObj|getInstalledAppJsonObj|writeInstallAppObjToJson|mapAppInfoFields|OpenBrowser|CloseBrowser)/i
      )
    ) {
      return 'apps';
    }

    // Security & Encryption
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(Encrypt|Decrypt|RSA|CheckCode|CheckAccess|Reset|HiSdk|Security|Auth|Certificate)/i
      )
    ) {
      return 'security';
    }

    // File System Operations
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(File|Read|Write|Directory|Storage|Path)/i
      )
    ) {
      return 'filesystem';
    }

    // Default fallback
    return 'system';
  }

  getFunctionType(functionName: string): string {
    // Check for native functions (contain [native] marker)
    if (functionName.includes('[native]')) {
      return 'Native';
    }

    // Everything else is JavaScript
    return 'JS';
  }

  getSourcePreview(sourceCode: string): string {
    if (!sourceCode) return '';

    if (sourceCode.includes('[native code]')) {
      return 'Native C++ function - source not available';
    }

    // Extract first meaningful line
    const lines = sourceCode.split('\n');
    const firstLine = lines.find(
      (line) => line.trim() && !line.trim().startsWith('//')
    );
    return firstLine ? firstLine.trim().substring(0, 60) + '...' : '';
  }

  selectFunction(func: FunctionData): void {
    this.selectedFunction = func;
    this.parameterValues = [];
    this.executionResult = null;

    // Pre-fill parameter array based on function parameters
    if (func.parameters && func.parameters.length > 0) {
      this.parameterValues = func.parameters.map((param) =>
        this.getDefaultParameterValue(param)
      );
    } else {
      // Try to parse parameters from source if available
      const params = this.getFunctionParameters(func.sourceCode || '');
      this.parameterValues = params.map((param) =>
        this.getDefaultParameterValue(param)
      );
    }

    // Open execution modal
    this.showExecutionModal = true;
  }

  getFunctionParameters(sourceCode: string): string[] {
    if (!sourceCode) return [];

    // Try multiple patterns to extract parameters
    const patterns = [
      /function\s*\(([^)]*)\)/, // function(param1, param2)
      /\(([^)]*)\)\s*=>/, // (param1, param2) =>
      /function\s+\w+\s*\(([^)]*)\)/, // function name(param1, param2)
      /^\s*\(([^)]*)\)/, // (param1, param2) at start
      /=>\s*\(([^)]*)\)/, // => (param1, param2)
    ];

    for (const pattern of patterns) {
      const match = sourceCode.match(pattern);
      if (match && match[1] !== undefined) {
        const paramString = match[1].trim();
        if (!paramString) return [];

        return paramString
          .split(',')
          .map((p) => p.trim().split(/[=\s]/)[0]) // Remove default values and types
          .filter((p) => p && !p.includes('//') && !p.includes('/*'));
      }
    }

    // Fallback: Look for common parameter names in source
    const commonParams = [
      'path',
      'file',
      'data',
      'value',
      'id',
      'name',
      'url',
      'key',
    ];
    const foundParams = commonParams.filter((param) =>
      sourceCode.toLowerCase().includes(param.toLowerCase())
    );

    return foundParams.length > 0 ? foundParams.slice(0, 3) : []; // Max 3 guessed params
  }

  getDefaultParameterValue(paramName: string): string {
    const name = paramName.toLowerCase();
    // File/Path parameters → ../../../passwd
    if (name.includes('file') || name.includes('path')) {
      return '../../../etc/passwd';
    }
    // Boolean parameters → 0
    if (
      name.includes('mode') ||
      name.includes('enable') ||
      name.includes('flag') ||
      name.includes('bool')
    ) {
      return '0';
    }
    // Everything else → empty
    return '';
  }

  getParameterHint(paramName: string): string {
    const name = paramName.toLowerCase();
    if (name.includes('file') || name.includes('path'))
      return '../../../etc/passwd';
    if (name.includes('url') || name.includes('uri'))
      return 'e.g. http://example.com';
    if (name.includes('code') || name.includes('id')) return 'Enter code/ID';
    if (name.includes('content') || name.includes('data'))
      return 'Enter text content';
    if (
      name.includes('mode') ||
      name.includes('enable') ||
      name.includes('flag')
    )
      return 'true or false';
    if (
      name.includes('number') ||
      name.includes('count') ||
      name.includes('size')
    )
      return 'Enter number';
    if (name.includes('name')) return 'Enter name';
    if (name.includes('key')) return 'Enter key name';
    if (name.includes('value')) return 'Enter value';
    return 'Enter parameter value';
  }

  async executeFunction(): Promise<void> {
    if (!this.selectedFunction || this.isExecuting) return;

    await this.executeCommand(
      this.selectedFunction.name,
      this.parameterValues
        .map((param) => {
          if (!param.trim()) return undefined;
          if (param === 'true') return true;
          if (param === 'false') return false;
          if (!isNaN(Number(param))) return Number(param);
          return param;
        })
        .filter((p) => p !== undefined)
    );
  }

  async executeCustomCode(): Promise<void> {
    if (!this.customJsCode.trim() || this.isExecutingCustomCode) return;

    await this.executeCommand('__CUSTOM_CODE__', [], this.customJsCode);
  }

  private async executeCommand(
    functionName: string,
    parameters: unknown[],
    customCode?: string
  ): Promise<void> {
    const isCustomCode = !!customCode;

    // Set executing flag
    if (isCustomCode) {
      this.isExecutingCustomCode = true;
      this.customCodeResult = null;
    } else {
      this.isExecuting = true;
      this.executionResult = null;
    }

    try {
      // Execute either custom code or function
      const result = await firstValueFrom(
        isCustomCode
          ? this.tvCommunicationService.executeCustomCode(customCode)
          : this.tvCommunicationService.executeFunction(
              functionName,
              parameters
            )
      );

      // Set result
      if (isCustomCode) {
        this.customCodeResult = result;
      } else {
        this.executionResult = result;
      }

      // Add to command history (both custom code and functions)
      this.commandHistory.push({
        functionName: isCustomCode ? '📝 Custom Code' : functionName,
        parameters: isCustomCode ? [] : parameters,
        customCode: isCustomCode ? customCode : undefined, // Store custom code
        timestamp: new Date(),
        success: true,
        result: result,
      });
      this.saveCommandHistory();
    } catch (error) {
      const errorResult = this.handleExecutionError(error);

      // Set error result
      if (isCustomCode) {
        this.customCodeResult = errorResult;
      } else {
        this.executionResult = errorResult;
      }

      // Add failed command to history
      this.commandHistory.push({
        functionName: isCustomCode ? '📝 Custom Code' : functionName,
        parameters: isCustomCode ? [] : parameters,
        customCode: isCustomCode ? customCode : undefined, // Store custom code
        timestamp: new Date(),
        success: false,
        result: errorResult,
      });
      this.saveCommandHistory();
    } finally {
      // Clear executing flag
      if (isCustomCode) {
        this.isExecutingCustomCode = false;
      } else {
        this.isExecuting = false;
      }
    }
  }

  private handleExecutionError(error: unknown): {
    error: string;
    tvDisconnected?: boolean;
    lastSeen?: string;
    timeSinceLastSeen?: string;
  } {
    if (error instanceof Error) {
      return { error: error.message };
    }

    if (error && typeof error === 'object' && 'status' in error) {
      const httpError = error as {
        status?: number;
        statusText?: string;
        message?: string;
        error?: {
          error?: string;
          message?: string;
          lastSeen?: string;
          timeSinceLastSeen?: string;
        };
      };

      // Handle TV not connected error
      if (
        httpError.status === 503 &&
        httpError.error?.error === 'TV_NOT_CONNECTED'
      ) {
        return {
          error: `📺 TV Not Connected: ${
            httpError.error.message || 'TV is not available'
          }`,
          tvDisconnected: true,
          lastSeen: httpError.error.lastSeen,
          timeSinceLastSeen: httpError.error.timeSinceLastSeen,
        };
      }

      // Other HTTP error
      return {
        error: `HTTP ${httpError.status}: ${
          httpError.statusText || httpError.message || 'Request failed'
        }`,
      };
    }

    if (error && typeof error === 'object' && 'message' in error) {
      return { error: String(error.message) };
    }

    // Try to stringify the object
    try {
      return { error: JSON.stringify(error, null, 2) };
    } catch {
      return { error: String(error) };
    }
  }

  clearParameters(): void {
    this.parameterValues = this.parameterValues.map(() => '');
    this.executionResult = null;
  }

  copyResultToClipboard(): void {
    if (this.executionResult === null || this.executionResult === undefined) {
      return;
    }

    const resultText = this.formatResult(this.executionResult);

    navigator.clipboard.writeText(resultText).then(
      () => {
        // Success
      },
      (err) => {
        this.consoleService.error('Failed to copy to clipboard', err, 'ControllerConsole');
        // Fallback: Try the old method
        this.fallbackCopyToClipboard(resultText);
      }
    );
  }

  private fallbackCopyToClipboard(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      this.consoleService.error('Fallback copy failed', err, 'ControllerConsole');
    }
    document.body.removeChild(textArea);
  }

  copyCustomCodeResultToClipboard(): void {
    if (this.customCodeResult === null || this.customCodeResult === undefined) {
      return;
    }

    const resultText = this.formatResult(this.customCodeResult);

    navigator.clipboard.writeText(resultText).then(
      () => {
        // Success
      },
      (err) => {
        this.consoleService.error('Failed to copy to clipboard', err, 'ControllerConsole');
        // Fallback: Try the old method
        this.fallbackCopyToClipboard(resultText);
      }
    );
  }

  formatResult(result: unknown): string {
    if (result === null || result === undefined) {
      return 'null';
    }

    if (typeof result === 'object') {
      try {
        return JSON.stringify(result, null, 2);
      } catch {
        return String(result);
      }
    }

    return String(result);
  }

  formatTime(date: Date | null): string {
    if (!date) return 'Never';
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return date.toLocaleTimeString();
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
  }

  getDeviceBrand(): string {
    return this.tvConnection.brand || 'Unknown';
  }

  getDeviceModel(): string {
    return this.tvConnection.model || 'Unknown';
  }

  getDeviceFirmware(): string {
    return this.tvConnection.firmware || 'Unknown';
  }

  private updateConnectionStatus(): void {
    const hasRecentFunctions = this.availableFunctions.length > 0;
    this.tvConnection.connected = hasRecentFunctions;

    if (hasRecentFunctions) {
      this.tvConnection.lastSeen = new Date();
    }
  }

  toggleSourceExpansion(functionName: string, event: Event): void {
    event.stopPropagation(); // Prevent function selection when clicking the expander
    if (this.expandedSources.has(functionName)) {
      this.expandedSources.delete(functionName);
    } else {
      this.expandedSources.add(functionName);
    }
  }

  isSourceExpanded(functionName: string): boolean {
    return this.expandedSources.has(functionName);
  }

  toggleHistoryExpansion(index: number): void {
    if (this.expandedHistoryItems.has(index)) {
      this.expandedHistoryItems.delete(index);
    } else {
      this.expandedHistoryItems.add(index);
    }
  }

  isHistoryExpanded(index: number): boolean {
    return this.expandedHistoryItems.has(index);
  }

  toggleHistoryResultExpansion(index: number): void {
    if (this.expandedHistoryResults.has(index)) {
      this.expandedHistoryResults.delete(index);
    } else {
      this.expandedHistoryResults.add(index);
    }
  }

  isHistoryResultExpanded(index: number): boolean {
    return this.expandedHistoryResults.has(index);
  }

  shouldShowExpandButton(result: unknown): boolean {
    const formatted = this.formatResult(result);
    const lines = formatted.split('\n');
    return lines.length > 5;
  }

  toggleExecutionResultExpanded(): void {
    this.isExecutionResultExpanded = !this.isExecutionResultExpanded;
  }

  toggleCustomCodeResultExpanded(): void {
    this.isCustomCodeResultExpanded = !this.isCustomCodeResultExpanded;
  }

  toggleCustomCodeExpanded(): void {
    this.isCustomCodeExpanded = !this.isCustomCodeExpanded;
  }

  // CUSTOM CODE METHODS
  openCustomCodeModal(): void {
    this.showCustomCodeModal = true;
  }

  closeCustomCodeModal(): void {
    this.showCustomCodeModal = false;
    this.customCodeResult = null;
  }

  closeExecutionModal(): void {
    this.showExecutionModal = false;
    this.executionResult = null;
  }

  copyFunctionToCustomCode(func: FunctionData): void {
    const functionName = func.name;
    const hasParams = func.parameters && func.parameters.length > 0;

    if (func.sourceCode) {
      const params =
        hasParams && func.parameters
          ? func.parameters
              .map((param) => {
                const hint = this.getDefaultParameterValue(param);
                return hint ? `"${hint}"` : `/* ${param} */`;
              })
              .join(', ')
          : '';

      const callTemplate = hasParams
        ? `// Adjust parameters as needed, then execute\nconst result = ${functionName}(${params});\nconsole.log(result);\nreturn result;`
        : `// Execute function\nconst result = ${functionName}();\nconsole.log(result);\nreturn result;`;

      this.customJsCode = `const ${functionName} = ${func.sourceCode}\n\n${callTemplate}`;
    } else {
      if (hasParams && func.parameters) {
        const params = func.parameters
          .map((param) => {
            const hint = this.getDefaultParameterValue(param);
            return hint ? `"${hint}"` : `/* ${param} */`;
          })
          .join(', ');

        this.customJsCode = `// Execute ${functionName}\nconst result = ${functionName}(${params});\nconsole.log(result);\nreturn result;`;
      } else {
        this.customJsCode = `// Execute ${functionName}\nconst result = ${functionName}();\nconsole.log(result);\nreturn result;`;
      }
    }

    this.showCustomCodeModal = true;
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private loadCommandHistory(): void {
    try {
      const stored = localStorage.getItem('vidaa-command-history');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.commandHistory = parsed.map(
          (cmd: {
            functionName: string;
            parameters?: unknown[];
            customCode?: string;
            timestamp: string;
            success: boolean;
            result?: unknown;
          }) => ({
            ...cmd,
            timestamp: new Date(cmd.timestamp),
          })
        );
      }
    } catch (error) {
      this.consoleService.error('Failed to load command history', error, 'ControllerConsole');
      this.commandHistory = [];
    }
  }

  private saveCommandHistory(): void {
    try {
      localStorage.setItem(
        'vidaa-command-history',
        JSON.stringify(this.commandHistory)
      );
    } catch (error) {
      this.consoleService.error('Failed to save command history', error, 'ControllerConsole');
    }
  }

  deleteHistoryItem(index: number): void {
    const reversedIndex = this.commandHistory.length - 1 - index;
    this.commandHistory.splice(reversedIndex, 1);
    this.saveCommandHistory();
  }
}
