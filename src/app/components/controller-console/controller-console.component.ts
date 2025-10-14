import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TvConnectionService,
  TVConnectionInfo,
} from '../../services/tv-connection.service';
import {
  TvFunctionService,
  FunctionData,
} from '../../services/tv-function.service';
import {
  TvCommandService,
  FunctionResult,
} from '../../services/tv-command.service';
import {
  FunctionFileGeneratorService,
  type GeneratedFiles,
} from '../../services/function-file-generator.service';
import { Subscription, firstValueFrom } from 'rxjs';
import { CodeModalComponent } from '../code-modal/code-modal.component';
import { ConsoleService } from '../../services/console.service';
import { FunctionLibraryComponent } from './function-library/function-library.component';
import {
  CommandHistoryComponent,
  type CommandHistoryEntry,
} from './command-history/command-history.component';
import { FunctionExecutionModalComponent } from './function-execution-modal/function-execution-modal.component';
import { CustomCodeModalComponent } from './custom-code-modal/custom-code-modal.component';

@Component({
  selector: 'app-controller-console',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CodeModalComponent,
    FunctionLibraryComponent,
    CommandHistoryComponent,
    FunctionExecutionModalComponent,
    CustomCodeModalComponent,
  ],
  templateUrl: './controller-console.component.html',
  styles: [],
})
export class ControllerConsoleComponent implements OnInit, OnDestroy {
  // Function Library State
  availableFunctions: FunctionData[] = [];
  filteredFunctions: FunctionData[] = [];
  functionFilter = '';
  selectedCategory = 'all';
  expandedSources: Set<string> = new Set();

  // Execution Modal State
  selectedFunction: FunctionData | null = null;
  parameterValues: string[] = [];
  isExecuting = false;
  executionResult: FunctionResult = null;
  showExecutionModal = false;
  isExecutionResultExpanded = false;

  // Custom Code Modal State
  showCustomCodeModal = false;
  customJsCode = '';
  customCodeResult: FunctionResult = null;
  isExecutingCustomCode = false;
  isCustomCodeExpanded = false;
  isCustomCodeResultExpanded = false;

  // Command History State
  commandHistory: CommandHistoryEntry[] = [];
  expandedHistoryItems: Set<number> = new Set();
  expandedHistoryResults: Set<number> = new Set();

  // Scroll State
  showScrollButton = false;

  // Connection State
  tvConnection: TVConnectionInfo = {
    connected: false,
    lastSeen: null,
    brand: undefined,
    model: undefined,
    firmware: undefined,
  };

  private subscriptions = new Subscription();

  constructor(
    private tvConnectionService: TvConnectionService,
    private tvFunctionService: TvFunctionService,
    private tvCommandService: TvCommandService,
    private functionFileGenerator: FunctionFileGeneratorService,
    private consoleService: ConsoleService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCommandHistory();
    this.initConnection();
    this.initScrollListener();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    // Remove scroll listener
    window.removeEventListener('scroll', this.handleScroll);
  }

  // CONNECTION MANAGEMENT
  private initConnection(): void {
    // Subscribe to TV functions for filtering
    const functionsSubscription = this.tvFunctionService.functions$.subscribe({
      next: (functions: FunctionData[]) => {
        console.log(
          '[ControllerConsole] Subscription triggered with',
          functions.length,
          'functions'
        );
        console.log(
          '[ControllerConsole] availableFunctions before:',
          this.availableFunctions.length
        );
        if (functions && functions.length > 0) {
          this.availableFunctions = functions;
          this.filterFunctions();
          console.log(
            '[ControllerConsole] availableFunctions after:',
            this.availableFunctions.length
          );
          console.log(
            '[ControllerConsole] filteredFunctions:',
            this.filteredFunctions.length
          );
          console.log('[ControllerConsole] Calling detectChanges()...');
          this.cdr.detectChanges();
          console.log('[ControllerConsole] detectChanges() done!');
        }
      },
    });

    this.subscriptions.add(functionsSubscription);

    // Subscribe to connection status
    const connectionSubscription =
      this.tvConnectionService.tvConnection$.subscribe({
        next: (connection: TVConnectionInfo) => {
          this.tvConnection = connection;
        },
      });

    this.subscriptions.add(connectionSubscription);

    this.filterFunctions();
  }

  // FUNCTION LIBRARY EVENT HANDLERS
  onFunctionFilterChange(filter: string): void {
    this.functionFilter = filter;
    this.filterFunctions();
  }

  onCategorySelected(category: string): void {
    this.selectedCategory = category;
    this.filterFunctions();
  }

  onFunctionSelected(func: FunctionData): void {
    this.selectedFunction = func;
    this.parameterValues = [];
    this.executionResult = null;

    // Pre-fill parameters
    if (func.parameters && func.parameters.length > 0) {
      this.parameterValues = func.parameters.map((param) =>
        this.getDefaultParameterValue(param)
      );
    }

    this.showExecutionModal = true;
  }

  onSourceExpansionToggled(functionName: string): void {
    if (this.expandedSources.has(functionName)) {
      this.expandedSources.delete(functionName);
    } else {
      this.expandedSources.add(functionName);
    }
  }

  onSaveToDisk(): void {
    this.saveFunctionsToDisk();
  }

  onCustomCodeOpen(): void {
    this.showCustomCodeModal = true;
  }

  onCopyToCustomCode(func: FunctionData): void {
    this.copyFunctionToCustomCode(func);
  }

  // FUNCTION EXECUTION MODAL EVENT HANDLERS
  onExecuteFunction(): void {
    this.executeFunction();
  }

  onClearParameters(): void {
    this.parameterValues = this.parameterValues.map(() => '');
    this.executionResult = null;
  }

  onCopyExecutionResult(): void {
    this.copyResultToClipboard(this.executionResult);
  }

  onParameterChanged(event: { index: number; value: string }): void {
    this.parameterValues[event.index] = event.value;
  }

  onExecutionResultExpansionToggled(): void {
    this.isExecutionResultExpanded = !this.isExecutionResultExpanded;
  }

  onCloseExecutionModal(): void {
    this.showExecutionModal = false;
    this.executionResult = null;
  }

  // CUSTOM CODE MODAL EVENT HANDLERS
  onExecuteCustomCode(): void {
    this.executeCustomCode();
  }

  onCustomCodeChanged(code: string): void {
    this.customJsCode = code;
  }

  onCopyCustomCodeResult(): void {
    this.copyResultToClipboard(this.customCodeResult);
  }

  onCustomCodeExpansionToggled(): void {
    this.isCustomCodeExpanded = !this.isCustomCodeExpanded;
  }

  onCustomCodeResultExpansionToggled(): void {
    this.isCustomCodeResultExpanded = !this.isCustomCodeResultExpanded;
  }

  onCloseCustomCodeModal(): void {
    this.showCustomCodeModal = false;
    this.customCodeResult = null;
  }

  // COMMAND HISTORY EVENT HANDLERS
  onHistoryExpansionToggled(index: number): void {
    if (this.expandedHistoryItems.has(index)) {
      this.expandedHistoryItems.delete(index);
    } else {
      this.expandedHistoryItems.add(index);
    }
  }

  onHistoryResultExpansionToggled(index: number): void {
    if (this.expandedHistoryResults.has(index)) {
      this.expandedHistoryResults.delete(index);
    } else {
      this.expandedHistoryResults.add(index);
    }
  }

  onHistoryItemDeleted(index: number): void {
    const reversedIndex = this.commandHistory.length - 1 - index;
    this.commandHistory.splice(reversedIndex, 1);
    this.saveCommandHistory();
  }

  onScrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // SCROLL MANAGEMENT
  private initScrollListener(): void {
    window.addEventListener('scroll', this.handleScroll);
  }

  private handleScroll = (): void => {
    // Show button when scrolled down more than 300px
    this.showScrollButton = window.scrollY > 300;
    this.cdr.detectChanges();
  };

  // SHARED UTILITY METHODS
  private filterFunctions(): void {
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

  private getFunctionCategory(functionName: string): string {
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(Get|Set)?(Device|Model|Brand|Country|Api|OS|Firmware|Version|Chipset|Serial|Region|Feature|Capability|Power|Standby|SystemInfo|DebugLevel|BlockTime|AdTarget|AdsID|CustomerID|CurrentBrowser)/i
      )
    )
      return 'system';
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(Get|Set)?(Net|IP|Mac|DNS|Network|Wifi|Connection)/i
      )
    )
      return 'network';
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(Get|Set)?(Volume|Sound|Picture|4K|HDR|Resolution|Mute|Dolby|TTS|Subtitle|Audio|Video|Media|Display|Brightness|Contrast)/i
      )
    )
      return 'media';
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(App|Install|Launch|Close|Browser|getAllAppJsonObj|getInstalledAppJsonObj|writeInstallAppObjToJson|mapAppInfoFields|OpenBrowser|CloseBrowser)/i
      )
    )
      return 'apps';
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(Encrypt|Decrypt|RSA|CheckCode|CheckAccess|Reset|HiSdk|Security|Auth|Certificate)/i
      )
    )
      return 'security';
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(File|Read|Write|Directory|Storage|Path)/i
      )
    )
      return 'filesystem';
    return 'system';
  }

  private getDefaultParameterValue(paramName: string): string {
    const name = paramName.toLowerCase();
    if (name.includes('file') || name.includes('path'))
      return '../../../etc/passwd';
    if (
      name.includes('mode') ||
      name.includes('enable') ||
      name.includes('flag') ||
      name.includes('bool')
    )
      return '0';
    return '';
  }

  private saveFunctionsToDisk(): void {
    if (this.availableFunctions.length === 0) return;

    const functionData: FunctionData[] = this.availableFunctions.map(
      (func) => ({
        name: func.name,
        sourceCode: func.sourceCode,
        available: true,
        parameters: func.parameters || [],
      })
    );

    const mockDeviceInfo = {
      userAgent: 'Controller Request',
      platform: 'Manual Save',
      timestamp: new Date().toISOString(),
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

    this.downloadGeneratedFiles(generatedFiles);
  }

  private downloadGeneratedFiles(files: GeneratedFiles): void {
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:.]/g, '-');

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

    this.tvFunctionService.saveFilesToPublic(filesToSave).subscribe({
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

  private async executeFunction(): Promise<void> {
    if (!this.selectedFunction || this.isExecuting) return;

    const params = this.parameterValues
      .map((param) => {
        if (!param.trim()) return undefined;
        if (param === 'true') return true;
        if (param === 'false') return false;
        if (!isNaN(Number(param))) return Number(param);
        return param;
      })
      .filter((p) => p !== undefined);

    await this.executeCommand(this.selectedFunction.name, params);
  }

  private async executeCustomCode(): Promise<void> {
    if (!this.customJsCode.trim() || this.isExecutingCustomCode) return;
    await this.executeCommand('__CUSTOM_CODE__', [], this.customJsCode);
  }

  private async executeCommand(
    functionName: string,
    parameters: unknown[],
    customCode?: string
  ): Promise<void> {
    const isCustomCode = !!customCode;

    if (isCustomCode) {
      this.isExecutingCustomCode = true;
      this.customCodeResult = null;
    } else {
      this.isExecuting = true;
      this.executionResult = null;
    }

    try {
      const result = await firstValueFrom(
        isCustomCode
          ? this.tvCommandService.executeCustomCode(customCode)
          : this.tvCommandService.executeFunction(functionName, parameters)
      );

      const functionResult = result as FunctionResult;
      if (isCustomCode) {
        this.customCodeResult = functionResult;
      } else {
        this.executionResult = functionResult;
      }

      this.commandHistory.push({
        functionName: isCustomCode ? '📝 Custom Code' : functionName,
        parameters: isCustomCode ? [] : parameters,
        customCode: isCustomCode ? customCode : undefined,
        timestamp: new Date(),
        success: true,
        result: functionResult,
      });
      this.saveCommandHistory();
    } catch (error) {
      const errorResult = this.handleExecutionError(error);

      if (isCustomCode) {
        this.customCodeResult = errorResult;
      } else {
        this.executionResult = errorResult;
      }

      this.commandHistory.push({
        functionName: isCustomCode ? '📝 Custom Code' : functionName,
        parameters: isCustomCode ? [] : parameters,
        customCode: isCustomCode ? customCode : undefined,
        timestamp: new Date(),
        success: false,
        result: errorResult,
      });
      this.saveCommandHistory();
    } finally {
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

      return {
        error: `HTTP ${httpError.status}: ${
          httpError.statusText || httpError.message || 'Request failed'
        }`,
      };
    }

    if (error && typeof error === 'object' && 'message' in error) {
      return { error: String(error.message) };
    }

    try {
      return { error: JSON.stringify(error, null, 2) };
    } catch {
      return { error: String(error) };
    }
  }

  private copyFunctionToCustomCode(func: FunctionData): void {
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

  private copyResultToClipboard(result: FunctionResult): void {
    if (result === null || result === undefined) return;

    const resultText = this.formatResult(result);

    navigator.clipboard.writeText(resultText).then(
      () => {
        // Success
      },
      (err) => {
        this.consoleService.error(
          'Failed to copy to clipboard',
          err,
          'ControllerConsole'
        );
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
      this.consoleService.error(
        'Fallback copy failed',
        err,
        'ControllerConsole'
      );
    }
    document.body.removeChild(textArea);
  }

  private formatResult(result: FunctionResult): string {
    if (result === null || result === undefined) return 'null';
    if (typeof result === 'object') {
      try {
        return JSON.stringify(result, null, 2);
      } catch {
        return String(result);
      }
    }
    return String(result);
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
            result?: FunctionResult;
          }) => ({
            ...cmd,
            timestamp: new Date(cmd.timestamp),
          })
        );
      }
    } catch (error) {
      this.consoleService.error(
        'Failed to load command history',
        error,
        'ControllerConsole'
      );
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
      this.consoleService.error(
        'Failed to save command history',
        error,
        'ControllerConsole'
      );
    }
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
}
