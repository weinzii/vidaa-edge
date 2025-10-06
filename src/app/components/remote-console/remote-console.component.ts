import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TvCommunicationService,
  TVFunction,
} from '../../services/tv-communication.service';
import { DeviceDetectionService } from '../../services/device-detection.service';
import { Subscription, firstValueFrom } from 'rxjs';

interface HisenseFunction {
  name: string;
  sourceCode: string;
  available: boolean;
}

@Component({
  selector: 'app-remote-console',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="max-w-6xl mx-auto p-5 bg-gray-900 text-gray-200 min-h-screen font-sans"
    >
      <!-- TV MODE: Function Scanner -->
      <div class="max-w-4xl mx-auto" *ngIf="isTvMode">
        <header class="text-center mb-8">
          <h1 class="text-blue-400 text-3xl font-bold mb-3">
            📺 TV Function Scanner
          </h1>
          <p class="text-gray-400">
            Auto-scanning and uploading TV functions...
          </p>
        </header>

        <!-- TV Status Display -->
        <div class="mb-6" *ngIf="tvStatusMessage">
          <div
            class="bg-gray-800 border-l-4 p-4 rounded"
            [class.border-green-500]="tvStatusType === 'success'"
            [class.border-red-500]="tvStatusType === 'error'"
            [class.border-blue-500]="tvStatusType === 'info'"
          >
            <h3 class="text-lg font-semibold mb-3">📋 Scanner Status</h3>
            <pre
              class="whitespace-pre-wrap bg-black p-4 rounded font-mono text-sm leading-relaxed max-h-80 overflow-y-auto"
              >{{ tvStatusMessage }}</pre
            >
          </div>
        </div>

        <!-- TV Action Center -->
        <div
          class="bg-gray-800 rounded-lg p-6"
          *ngIf="scannedFunctions.length > 0"
        >
          <div class="mb-6">
            <h4 class="text-xl font-semibold text-white mb-2">
              Export Function Definitions
            </h4>
            <p class="text-gray-300">
              Functions and TypeScript definitions can be written to development
              server.<br />
              Output directory:
              <code class="bg-gray-700 px-2 py-1 rounded text-green-400"
                >./received-functions/</code
              >
            </p>
          </div>

          <div class="flex gap-3">
            <button
              (click)="uploadToService()"
              class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              💾 Save to Server
            </button>
            <button
              (click)="testApiConnection()"
              class="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              🔍 Test API Connection
            </button>
          </div>
        </div>
      </div>

      <!-- LAPTOP MODE: Remote Console -->
      <div class="max-w-6xl mx-auto" *ngIf="!isTvMode">
        <header class="text-center mb-8">
          <h1 class="text-blue-400 text-4xl font-bold mb-2">
            💻 Remote TV Console
          </h1>
          <p class="text-gray-400 mb-6">Control your TV functions remotely</p>
          <!-- Only show connection status when functions are available (not during initial setup) -->
          <div
            class="flex justify-center"
            *ngIf="availableFunctions.length > 0"
          >
            <div
              class="flex items-center gap-3 bg-gray-800 px-4 py-2 rounded-lg"
              [class.bg-green-900]="tvConnection.connected"
              [class.bg-red-900]="!tvConnection.connected"
            >
              <div
                class="w-3 h-3 rounded-full"
                [class.bg-green-400]="tvConnection.connected"
                [class.bg-red-400]="!tvConnection.connected"
              ></div>
              <div class="text-sm">
                <span class="font-medium">{{
                  tvConnection.connected ? 'TV Connected' : 'TV Disconnected'
                }}</span>
                <span class="text-gray-400 block" *ngIf="tvConnection.lastSeen"
                  >Last seen: {{ formatTime(tvConnection.lastSeen) }}</span
                >
              </div>
            </div>
          </div>
        </header>

        <!-- Waiting for TV Instructions -->
        <div
          class="max-w-4xl mx-auto"
          *ngIf="availableFunctions.length === 0 && !tvConnection.connected"
        >
          <div class="bg-gray-800 rounded-lg p-8 shadow-lg">
            <h2 class="text-2xl font-bold text-blue-400 mb-4">
              📺 TV Setup Required
            </h2>
            <p class="text-gray-300 mb-8">
              To use the Remote Console, please follow these steps on your TV:
            </p>

            <div class="space-y-6">
              <div class="flex items-start gap-4">
                <span
                  class="bg-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  >1</span
                >
                <div>
                  <h4 class="text-lg font-semibold text-white mb-2">
                    Open TV Browser
                  </h4>
                  <p class="text-gray-300">
                    Navigate to the browser app on your Hisense/VIDAA TV
                  </p>
                </div>
              </div>

              <div class="flex items-start gap-4">
                <span
                  class="bg-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  >2</span
                >
                <div>
                  <h4 class="text-lg font-semibold text-white mb-2">
                    Visit Development Console
                  </h4>
                  <p class="text-gray-300 mb-2">Go to:</p>
                  <code
                    class="bg-gray-700 text-green-400 px-3 py-1 rounded block"
                    >https://vidaahub.com/console</code
                  >
                  <p class="text-gray-400 text-sm mt-1">
                    DNS must redirect vidaahub.com to your local dev server
                  </p>
                </div>
              </div>

              <div class="flex items-start gap-4">
                <span
                  class="bg-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  >3</span
                >
                <div>
                  <h4 class="text-lg font-semibold text-white mb-2">
                    Auto-Scan Functions
                  </h4>
                  <p class="text-gray-300">
                    The TV will automatically scan and upload available
                    functions
                  </p>
                </div>
              </div>
            </div>

            <div
              class="mt-8 p-5 bg-black rounded-lg border-l-4 border-green-500"
            >
              <div class="flex items-center justify-center gap-3 mb-3">
                <div
                  class="w-3 h-3 bg-green-500 rounded-full animate-pulse"
                ></div>
                <span class="text-green-400 font-bold"
                  >Waiting for TV connection...</span
                >
              </div>
              <p class="text-gray-400 text-sm text-center italic">
                This page automatically updates when TV functions are detected.
              </p>
            </div>
          </div>
        </div>

        <!-- Function Library Browser (only when functions are available) -->
        <div
          class="bg-gray-800 rounded-lg p-6 mb-6"
          *ngIf="availableFunctions.length > 0"
        >
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-white">📚 Function Library</h2>
            <div class="flex gap-3">
              <input
                type="text"
                [(ngModel)]="functionFilter"
                (input)="filterFunctions()"
                placeholder="🔍 Search functions..."
                class="bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                aria-label="Search functions"
              />
              <button
                (click)="refreshLibrary()"
                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                aria-label="Refresh library"
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div class="lg:col-span-1">
              <div class="space-y-2">
                <button
                  *ngFor="let category of categories"
                  class="w-full text-left px-4 py-3 rounded-lg transition-colors"
                  [class.bg-blue-600]="selectedCategory === category.key"
                  [class.text-white]="selectedCategory === category.key"
                  [class.bg-gray-700]="selectedCategory !== category.key"
                  [class.text-gray-300]="selectedCategory !== category.key"
                  [class.hover:bg-blue-500]="selectedCategory !== category.key"
                  (click)="selectCategory(category.key)"
                >
                  {{ category.icon }} {{ category.name }} ({{
                    getCategoryCount(category.key)
                  }})
                </button>
              </div>
            </div>

            <div class="lg:col-span-3">
              <div
                class="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto"
              >
                <div
                  *ngFor="let func of filteredFunctions"
                  class="bg-gray-700 rounded-lg p-4 cursor-pointer transition-all hover:bg-gray-600"
                  [class.ring-2]="selectedFunction?.name === func.name"
                  [class.ring-blue-500]="selectedFunction?.name === func.name"
                  [class.bg-blue-900]="selectedFunction?.name === func.name"
                  (click)="selectFunction(func)"
                  tabindex="0"
                  role="button"
                  (keyup.enter)="selectFunction(func)"
                  (keyup.space)="selectFunction(func)"
                >
                  <div class="flex items-start justify-between mb-2">
                    <span class="text-white font-medium">{{ func.name }}</span>
                    <span
                      class="text-xs bg-gray-600 text-gray-300 px-2 py-1 rounded"
                      >{{ getFunctionType(func.name) }}</span
                    >
                  </div>
                  <div
                    class="text-sm text-gray-400 truncate"
                    *ngIf="func.source"
                  >
                    {{ getSourcePreview(func.source) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Function Execution Panel -->
        <div class="bg-gray-800 rounded-lg p-6 mb-6" *ngIf="selectedFunction">
          <h3 class="text-2xl font-bold text-blue-400 mb-6">
            ⚡ Execute Function: {{ selectedFunction.name }}
          </h3>

          <div class="space-y-6">
            <div *ngIf="selectedFunction.source">
              <h4 class="text-lg font-semibold text-blue-400 mb-3">
                📄 Source Code
              </h4>
              <pre
                class="bg-black p-4 rounded border border-gray-600 font-mono text-sm overflow-x-auto max-h-48 text-gray-300"
                >{{ selectedFunction.source }}</pre
              >
            </div>

            <div
              *ngIf="
                selectedFunction.parameters &&
                selectedFunction.parameters.length > 0
              "
            >
              <h4 class="text-lg font-semibold text-blue-400 mb-3">
                🔧 Parameters
              </h4>
              <div
                *ngFor="let param of selectedFunction.parameters; let i = index"
                class="mb-4"
              >
                <label
                  [for]="'param-' + i"
                  class="block mb-2 font-semibold text-gray-300"
                  >{{ param }}:</label
                >
                <input
                  [id]="'param-' + i"
                  type="text"
                  [(ngModel)]="parameterValues[i]"
                  class="w-full p-3 bg-black border border-gray-600 rounded text-gray-200 text-sm focus:outline-none focus:border-blue-500"
                  [placeholder]="getParameterHint(param)"
                />
              </div>
            </div>

            <div class="flex gap-3">
              <button
                (click)="executeFunction()"
                class="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                [disabled]="isExecuting"
              >
                <span *ngIf="!isExecuting">🚀 Execute</span>
                <span *ngIf="isExecuting">⏳ Executing...</span>
              </button>
              <button
                (click)="clearParameters()"
                class="bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                🗑️ Clear Parameters
              </button>
            </div>

            <div *ngIf="executionResult !== null">
              <h4 class="text-lg font-semibold text-blue-400 mb-3">
                📊 Result
              </h4>
              <pre
                class="bg-black p-4 rounded border border-gray-600 font-mono text-sm max-h-48 overflow-y-auto text-gray-300"
                >{{ formatResult(executionResult) }}</pre
              >
            </div>
          </div>
        </div>

        <!-- Command History -->
        <div
          class="bg-gray-800 rounded-lg p-6 mt-6"
          *ngIf="commandHistory.length > 0"
        >
          <h3 class="text-2xl font-bold text-blue-400 mb-4">
            📜 Command History
          </h3>
          <div class="space-y-2">
            <div
              *ngFor="let command of commandHistory.slice(-5)"
              class="flex justify-between items-center p-3 bg-black rounded border border-gray-600"
            >
              <span class="font-mono font-bold text-blue-400">{{
                command.functionName
              }}</span>
              <span class="text-gray-400 text-sm">{{
                formatTime(command.timestamp)
              }}</span>
              <span
                class="text-sm font-bold"
                [class.text-green-400]="command.success"
                [class.text-red-400]="!command.success"
              >
                {{ command.success ? '✅' : '❌' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class RemoteConsoleComponent implements OnInit, OnDestroy {
  // Device Mode Detection
  isTvMode = false;

  // TV Mode Properties
  scannedFunctions: HisenseFunction[] = [];
  tvStatusMessage = '';
  tvStatusType: 'success' | 'error' | 'info' = 'info';

  // Remote Command System (TV Mode)
  isRemoteControlEnabled = false;
  remoteControlStatus = 'INAKTIV';
  lastCommand = '-';
  private commandCheckInterval?: number;

  // Laptop Mode Properties
  availableFunctions: TVFunction[] = [];
  selectedFunction: TVFunction | null = null;
  filteredFunctions: TVFunction[] = [];
  functionFilter = '';
  selectedCategory = 'all';

  // Execution Properties
  parameterValues: string[] = [];
  isExecuting = false;
  executionResult: unknown = null;
  commandHistory: Array<{
    functionName: string;
    timestamp: Date;
    success: boolean;
    result?: unknown;
  }> = [];

  // Connection Properties
  tvConnection = {
    connected: false,
    lastSeen: null as Date | null,
  };

  // Categories for function organization
  categories = [
    { key: 'all', name: 'All Functions', icon: '📋' },
    { key: 'system', name: 'System Info', icon: '⚙️' },
    { key: 'network', name: 'Network', icon: '🌐' },
    { key: 'media', name: 'Media & Audio', icon: '🎵' },
    { key: 'apps', name: 'App Management', icon: '📱' },
    { key: 'security', name: 'Security & Crypto', icon: '🔐' },
    { key: 'filesystem', name: 'File System', icon: '📁' },
    { key: 'debug', name: 'Debug & Logs', icon: '🐛' },
  ];

  private subscriptions = new Subscription();

  constructor(
    private tvCommunicationService: TvCommunicationService,
    private deviceDetectionService: DeviceDetectionService
  ) {}

  ngOnInit(): void {
    // Detect device type and set mode
    this.isTvMode = this.deviceDetectionService.isTV();

    if (this.isTvMode) {
      // TV Mode: Start auto function scanning
      this.initTvMode();
    } else {
      // Laptop Mode: Setup function library and execution
      this.initLaptopMode();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();

    // Cleanup remote command checker
    if (this.commandCheckInterval) {
      clearInterval(this.commandCheckInterval);
      this.commandCheckInterval = undefined;
    }
  }

  // TV MODE METHODS
  private async initTvMode(): Promise<void> {
    this.appendTvStatus('🔄 Initializing TV Function Scanner...', 'info');

    // Auto-start scanning after short delay
    setTimeout(() => {
      this.autoScanAndUpload();
    }, 1000);

    // Start remote command polling for TV
    this.startRemoteCommandChecker();
  }

  private async autoScanAndUpload(): Promise<void> {
    try {
      this.appendTvStatus('📡 Scanning for TV functions...', 'info');

      // Perform function scan
      this.performFunctionScan();

      // Wait for scan to complete
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (this.scannedFunctions.length === 0) {
        this.appendTvStatus(
          '⚠️ No TV functions found. Verify this is a TV browser.',
          'error'
        );
        return;
      }

      // Auto-upload to service
      this.appendTvStatus(
        `🚀 Auto-uploading ${this.scannedFunctions.length} functions...`,
        'info'
      );
      this.uploadToService();

      // uploadToService() already provides the final status message
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.appendTvStatus(
        `❌ Auto-Scan Failed!\n\nError: ${errorMessage}\n\n` +
          `💡 Try manual refresh or check TV browser compatibility.`,
        'error'
      );
    }
  }

  refreshFunctionScan(): void {
    this.appendTvStatus('🔄 Refreshing function scan...', 'info');
    this.performFunctionScan();

    setTimeout(() => {
      this.appendTvStatus(
        `✅ Scan Refreshed!\n\nFound ${this.scannedFunctions.length} functions`,
        'success'
      );
    }, 1000);
  }

  uploadToService(): void {
    if (this.scannedFunctions.length === 0) {
      this.appendTvStatus(
        '❌ No functions to upload. Run scan first.',
        'error'
      );
      return;
    }

    const functionData = {
      functions: this.scannedFunctions.map((func) => {
        // Extract parameters from source code
        const extractedParams = this.getFunctionParameters(
          func.sourceCode || ''
        );

        return {
          name: func.name,
          sourceCode: func.sourceCode,
          available: func.available,
          parameters: extractedParams, // ← Parameter hinzufügen!
        };
      }),
      deviceInfo: this.getDeviceInfo(),
      timestamp: new Date().toISOString(),
    };

    try {
      this.appendTvStatus(
        `🔄 Uploading ${this.scannedFunctions.length} functions to server...`,
        'info'
      );

      this.tvCommunicationService.receiveFunctions(functionData).subscribe({
        next: (response) => {
          this.appendTvStatus(
            `📤 Server Response: ${JSON.stringify(response)}`,
            'info'
          );
          this.appendTvStatus(
            `✅ Functions loaded! ${this.scannedFunctions.length} functions are now available for remote execution. Ready for development integration.`,
            'success'
          );
        },
        error: (error) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.appendTvStatus(`❌ Upload failed: ${errorMessage}`, 'error');
          this.appendTvStatus(
            `🔍 Error Details: ${JSON.stringify(error)}`,
            'error'
          );
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.appendTvStatus(`❌ Upload failed: ${errorMessage}`, 'error');
    }
  }

  testApiConnection(): void {
    this.appendTvStatus('🔍 Testing API connection...', 'info');

    // Test 1: Status API
    this.tvCommunicationService.getStatus().subscribe({
      next: (response) => {
        this.appendTvStatus(
          `✅ Status API: ${JSON.stringify(response)}`,
          'success'
        );

        // Test 2: Simple POST test
        const testData = {
          test: true,
          functions: [{ name: 'test_function', available: true }],
          deviceInfo: { test: true },
          timestamp: new Date().toISOString(),
        };

        this.tvCommunicationService.receiveFunctions(testData).subscribe({
          next: (postResponse) => {
            this.appendTvStatus(
              `✅ POST Test: ${JSON.stringify(postResponse)}`,
              'success'
            );
          },
          error: (postError) => {
            this.appendTvStatus(
              `❌ POST Test Failed: ${JSON.stringify(postError)}`,
              'error'
            );
          },
        });
      },
      error: (error) => {
        this.appendTvStatus(
          `❌ API Connection Failed: ${JSON.stringify(error)}`,
          'error'
        );
        this.appendTvStatus(
          `🔍 URL: ${window.location.origin}/api/status`,
          'info'
        );
      },
    });
  }

  private performFunctionScan(): void {
    // Use the same comprehensive scanning logic from Function Explorer
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
        /^FileSystemDirectoryHandle$/,
        /^FileSystemFileHandle$/,
        /^FileSystemHandle$/,
        /^FileSystemWritableFileStream$/,
        /^HIDDevice$/,
        /^HIDInputReportEvent$/,
        /^HIDConnectionEvent$/,
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
        /^Array$/,
        /^Object$/,
        /^Function$/,
        /^Map$/,
        /^Set$/,
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
              allFunctions.add(name);
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

      // Convert to scanned functions
      const functionArray = Array.from(allFunctions).sort();
      this.scannedFunctions = functionArray.map((name) => ({
        name: name.replace(/^(window\.|global\.)/, ''),
        available: true,
        sourceCode: this.getFunctionSource(
          name.replace(/^(window\.|global\.)/, '')
        ),
      }));
    } catch (error) {
      console.error('Function scan failed:', error);
      this.scannedFunctions = [];
    }
  }

  private getFunctionSource(functionName: string): string {
    try {
      const windowObj = window as typeof window & Record<string, unknown>;
      const func = windowObj[functionName];

      if (typeof func === 'function') {
        const sourceCode = (func as (...args: unknown[]) => unknown).toString();

        if (sourceCode.includes('[native code]')) {
          return `// Native Function: ${functionName}\n// C++ implementation - source not available\n\nfunction ${functionName}() { [native code] }`;
        }

        return sourceCode;
      }
      return '';
    } catch {
      return '';
    }
  }

  appendTvStatus(message: string, type: 'success' | 'error' | 'info'): void {
    if (this.tvStatusMessage) {
      this.tvStatusMessage += '\n\n' + message;
    } else {
      this.tvStatusMessage = message;
    }
    this.tvStatusType = type;

    // Auto-scroll to bottom after status update
    setTimeout(() => {
      const statusElement = document.querySelector('pre.whitespace-pre-wrap');
      if (statusElement) {
        statusElement.scrollTop = statusElement.scrollHeight;
      }
    }, 100);
  }

  clearTvStatus(): void {
    this.tvStatusMessage = '';
  }

  // LAPTOP MODE METHODS
  private initLaptopMode(): void {
    // Subscribe to TV functions from service
    const functionsSubscription =
      this.tvCommunicationService.functions$.subscribe({
        next: (functions: TVFunction[]) => {
          this.availableFunctions = functions;
          this.filterFunctions();
          this.updateConnectionStatus();
        },
        error: (error: unknown) => {
          console.error('Error loading functions:', error);
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

    // Load initial functions
    this.refreshLibrary();
  }

  refreshLibrary(): void {
    // Functions are automatically updated via subscription
    // This method can be used to trigger UI updates
    this.filterFunctions();
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
          (func.source && func.source.toLowerCase().includes(searchTerm)) ||
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
    if (
      functionName.match(
        /Get(Device|Model|Brand|Country|Api|OS|Firmware|Version|Chipset|Serial|Region|Feature|Capability)/
      )
    ) {
      return 'system';
    }
    if (functionName.match(/Get(Net|IP|Mac|DNS)|SetDNS|Network/)) {
      return 'network';
    }
    if (
      functionName.match(
        /Get(Volume|Sound|Picture|4K|HDR|Resolution|Mute|Dolby|TTS|Subtitle)/
      )
    ) {
      return 'media';
    }
    if (
      functionName.match(
        /App|Install|getAllAppJsonObj|getInstalledAppJsonObj|writeInstallAppObjToJson|mapAppInfoFields/
      )
    ) {
      return 'apps';
    }
    if (
      functionName.match(
        /Encrypt|Decrypt|RSA|CheckCode|CheckAccess|Reset|HiSdk/
      )
    ) {
      return 'security';
    }
    if (functionName.match(/FileRead|FileWrite/)) {
      return 'filesystem';
    }
    if (functionName.match(/Debug|Log|Print|Observer|VKB/)) {
      return 'debug';
    }
    return 'system';
  }

  getFunctionType(functionName: string): string {
    if (
      functionName.includes('[native]') ||
      functionName.match(/^[A-Z][a-z]+_/)
    ) {
      return 'Native';
    }
    if (
      functionName.startsWith('vowOS') ||
      functionName.startsWith('omi_platform')
    ) {
      return 'TV API';
    }
    if (functionName.startsWith('Hisense_')) {
      return 'Hisense';
    }
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

  selectFunction(func: TVFunction): void {
    this.selectedFunction = func;
    this.parameterValues = [];
    this.executionResult = null;

    // Pre-fill parameter array based on function parameters
    if (func.parameters && func.parameters.length > 0) {
      this.parameterValues = new Array(func.parameters.length).fill('');
    } else {
      // Try to parse parameters from source if available
      const params = this.getFunctionParameters(func.source || '');
      this.parameterValues = new Array(params.length).fill('');
    }
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

  getParameterHint(paramName: string): string {
    const name = paramName.toLowerCase();
    if (name.includes('file') || name.includes('path'))
      return 'e.g. /tmp/test.txt';
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

    this.isExecuting = true;
    this.executionResult = null;

    try {
      // Check if we're in TV mode or Laptop mode
      if (this.isTvMode) {
        // TV MODE: Execute directly on TV browser
        const processedParams = this.parameterValues.map((param) => {
          if (!param.trim()) return undefined;
          if (param === 'true') return true;
          if (param === 'false') return false;
          if (!isNaN(Number(param))) return Number(param);
          return param;
        });

        // Execute function directly on TV
        const windowObj = window as unknown as Record<string, unknown>;
        const func = windowObj[this.selectedFunction.name];

        if (typeof func !== 'function') {
          throw new Error(
            `Function ${this.selectedFunction.name} not available on this TV`
          );
        }

        const result = func(...processedParams);
        this.executionResult = result;

        // Add to command history
        this.commandHistory.push({
          functionName: this.selectedFunction.name,
          timestamp: new Date(),
          success: true,
          result: result,
        });
      } else {
        // LAPTOP MODE: Send command to TV via queue system
        const processedParams = this.parameterValues.map((param) => {
          if (!param.trim()) return undefined;
          if (param === 'true') return true;
          if (param === 'false') return false;
          if (!isNaN(Number(param))) return Number(param);
          return param;
        });

        // Use TvCommunicationService executeFunction method
        const result = await firstValueFrom(
          this.tvCommunicationService.executeFunction(
            this.selectedFunction.name,
            processedParams,
            this.selectedFunction.source
          )
        );

        this.executionResult = result;

        // Add to command history
        this.commandHistory.push({
          functionName: this.selectedFunction.name,
          timestamp: new Date(),
          success: true,
          result: result,
        });
      }
    } catch (error) {
      let errorMessage = 'Unknown error occurred';

      // Handle different types of errors
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        // Check if it's an HTTP error with status
        if ('status' in error) {
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
            this.executionResult = {
              error: `📺 TV Not Connected: ${
                httpError.error.message || 'TV is not available'
              }`,
              tvDisconnected: true,
              lastSeen: httpError.error.lastSeen,
              timeSinceLastSeen: httpError.error.timeSinceLastSeen,
            };
            // Add failed command to history
            this.commandHistory.push({
              functionName: this.selectedFunction.name,
              timestamp: new Date(),
              success: false,
              result: this.executionResult,
            });
            this.isExecuting = false;
            return;
          } else {
            // Other HTTP error
            errorMessage = `HTTP ${httpError.status}: ${
              httpError.statusText || httpError.message || 'Request failed'
            }`;
          }
        } else if ('message' in error) {
          errorMessage = String(error.message);
        } else {
          // Try to stringify the object
          try {
            errorMessage = JSON.stringify(error, null, 2);
          } catch {
            errorMessage = String(error);
          }
        }
      } else {
        errorMessage = String(error);
      }

      this.executionResult = { error: errorMessage };

      // Add failed command to history
      this.commandHistory.push({
        functionName: this.selectedFunction.name,
        timestamp: new Date(),
        success: false,
        result: error,
      });
    } finally {
      this.isExecuting = false;
    }
  }

  clearParameters(): void {
    this.parameterValues = this.parameterValues.map(() => '');
    this.executionResult = null;
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
    return date.toLocaleTimeString();
  }

  private updateConnectionStatus(): void {
    const hasRecentFunctions = this.availableFunctions.length > 0;
    this.tvConnection.connected = hasRecentFunctions;

    if (hasRecentFunctions) {
      this.tvConnection.lastSeen = new Date();
    }
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
      } catch {
        // Ignore function call errors
      }
    }

    return info;
  }

  /**
   * ===== REMOTE COMMAND METHODS (TV MODE) =====
   */

  private startRemoteCommandChecker(): void {
    if (this.commandCheckInterval) {
      clearInterval(this.commandCheckInterval);
    }

    this.isRemoteControlEnabled = true;
    this.remoteControlStatus = 'ACTIVE';
    this.appendTvStatus(
      '🎮 Remote Control enabled - Waiting for PC commands...',
      'success'
    );

    this.commandCheckInterval = window.setInterval(() => {
      if (!this.isRemoteControlEnabled) return;

      // Use existing TvCommunicationService command queue system
      this.tvCommunicationService.checkForCommands().subscribe({
        next: (commandData) => {
          if (commandData.hasCommand) {
            this.appendTvStatus(
              `� Command received: ${commandData.command.function}`,
              'info'
            );

            this.lastCommand = `${commandData.command.function}()`;
            this.appendTvStatus(
              `⚡ Executing: ${commandData.command.function}`,
              'info'
            );
            this.executeRemoteCommand(commandData.command);
          }
        },
        error: (error) => {
          this.appendTvStatus(`❌ Polling error: ${error.message}`, 'error');
        },
      });
    }, 2000); // Check every 2 seconds
  }

  private executeRemoteCommand(command: {
    id: string;
    function: string;
    parameters?: unknown[];
    sourceCode?: string;
    executionMode?: string;
  }): void {
    console.log(
      `🔧 Führe aus: ${command.function}(${
        command.parameters?.join(', ') || ''
      })`
    );

    const result = {
      commandId: command.id,
      function: command.function,
      parameters: command.parameters || [],
      success: false,
      data: null as unknown,
      error: null as string | null,
      timestamp: new Date().toISOString(),
    };

    try {
      let output: unknown;

      // Check if we have source code to eval or just function name to call
      if (command.executionMode === 'eval' && command.sourceCode) {
        // NEW: Execute source code via eval()
        this.appendTvStatus(`📺 TV MODE: Executing via eval()`, 'info');
        this.appendTvStatus(
          `📝 Source Code: ${command.sourceCode.substring(0, 100)}...`,
          'info'
        );
        this.appendTvStatus(
          `📋 Parameters: ${JSON.stringify(command.parameters)}`,
          'info'
        );

        if (!command.sourceCode || command.sourceCode.trim() === '') {
          throw new Error(
            `No source code provided for function ${command.function}`
          );
        }

        // Execute source code with parameters via eval
        const functionParams = command.parameters || [];
        if (functionParams.length > 0) {
          // Build parameter string for eval
          const paramString = functionParams
            .map((p) => JSON.stringify(p))
            .join(', ');
          const evalString = `(${command.sourceCode})(${paramString})`;
          this.appendTvStatus(
            `� Eval string: ${evalString.substring(0, 200)}...`,
            'info'
          );
          output = eval(evalString);
        } else {
          // No parameters - just call the function
          const evalString = `(${command.sourceCode})()`;
          this.appendTvStatus(`🔧 Eval string: ${evalString}`, 'info');
          output = eval(evalString);
        }
      } else {
        // LEGACY: Get function from window object (for backward compatibility)
        const windowObj = window as unknown as Record<string, unknown>;
        const func = windowObj[command.function];

        if (typeof func !== 'function') {
          throw new Error(`Function ${command.function} not found`);
        }

        this.appendTvStatus(
          `🔧 Executing via window.${command.function}()`,
          'info'
        );
        output = func(...((command.parameters as unknown[]) || []));
      }

      this.appendTvStatus(`🔍 Output type = ${typeof output}`, 'info');
      this.appendTvStatus(
        `🔍 Raw output = ${JSON.stringify(output).substring(0, 200)}...`,
        'info'
      );

      result.success = true;
      result.data = output;

      this.appendTvStatus(
        `🎮 Remote: ${command.function}() → Success`,
        'success'
      );
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);

      this.appendTvStatus(
        `🎮 Remote: ${command.function}() → Error: ${result.error}`,
        'error'
      );
    }

    // Send result back via TvCommunicationService
    this.tvCommunicationService
      .receiveCommandResult(command.id, result)
      .subscribe({
        error: (error) => {
          console.error('Failed to send result:', error);
        },
      });
  }

  private stopRemoteCommandChecker(): void {
    if (this.commandCheckInterval) {
      clearInterval(this.commandCheckInterval);
      this.commandCheckInterval = undefined;
    }
    this.isRemoteControlEnabled = false;
    this.remoteControlStatus = 'INAKTIV';
  }
}
