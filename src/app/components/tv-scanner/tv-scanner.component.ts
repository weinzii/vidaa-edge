import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  TvCommunicationService,
  RemoteCommandCheck,
  RemoteCommand,
} from '../../services/tv-communication.service';
import { Subscription, interval, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface HisenseFunction {
  name: string;
  sourceCode: string;
  available: boolean;
  category?: string;
}

@Component({
  selector: 'app-tv-scanner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="max-w-4xl mx-auto p-5 bg-gray-900 text-gray-200 min-h-screen font-sans relative overflow-y-auto hide-scrollbar"
      [class.screensaver-active]="isScreensaverActive"
    >
      <!-- Screensaver Overlay -->
      <div
        *ngIf="isScreensaverActive"
        class="fixed inset-0 bg-black bg-opacity-95 backdrop-blur-xl z-50"
      >
        <div
          class="absolute select-none animate-float-blur"
          [style.top.%]="screensaverPosition.y"
          [style.left.%]="screensaverPosition.x"
        >
          <div class="text-center">
            <div class="text-9xl opacity-25">📺</div>
            <div class="text-2xl text-gray-600 tracking-widest mt-6 font-light">
              SCREEN SAVER
            </div>
            <div class="mt-4 text-sm text-gray-700">
              Last activity: {{ formatScreensaverTime() }}
            </div>
          </div>
        </div>
      </div>

      <header class="text-center mb-8">
        <h1 class="text-blue-400 text-3xl font-bold mb-3">
          📺 TV Function Scanner
        </h1>
        <p class="text-gray-400">Auto-scanning and uploading TV functions...</p>
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
    </div>
  `,
  styles: [
    `
      /* Hide scrollbar globally for body/html */
      :host ::ng-deep body,
      :host ::ng-deep html {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
        overflow-y: auto !important;
      }
      :host ::ng-deep body::-webkit-scrollbar,
      :host ::ng-deep html::-webkit-scrollbar {
        display: none !important;
      }

      /* Hide scrollbar for component */
      .hide-scrollbar {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .hide-scrollbar::-webkit-scrollbar {
        display: none;
      }

      /* Smooth floating animation for screensaver - organic random movement */
      @keyframes float {
        0% {
          top: 35%;
          left: 25%;
        }
        12% {
          top: 42%;
          left: 38%;
        }
        28% {
          top: 55%;
          left: 62%;
        }
        41% {
          top: 48%;
          left: 73%;
        }
        56% {
          top: 38%;
          left: 68%;
        }
        68% {
          top: 52%;
          left: 45%;
        }
        79% {
          top: 62%;
          left: 32%;
        }
        92% {
          top: 45%;
          left: 28%;
        }
        100% {
          top: 35%;
          left: 25%;
        }
      }

      @keyframes dynamicBlur {
        0% {
          filter: blur(0px);
        }
        20% {
          filter: blur(3px);
        }
        45% {
          filter: blur(1px);
        }
        70% {
          filter: blur(5px);
        }
        85% {
          filter: blur(2px);
        }
        100% {
          filter: blur(0px);
        }
      }

      .animate-float-blur {
        animation: float 45s cubic-bezier(0.4, 0, 0.2, 1) infinite,
          dynamicBlur 18s ease-in-out infinite;
      }
    `,
  ],
})
export class TvScannerComponent implements OnInit, OnDestroy {
  // TV Mode Properties
  scannedFunctions: HisenseFunction[] = [];
  tvStatusMessage = '';
  tvStatusType: 'success' | 'error' | 'info' = 'info';

  // Remote Command System
  isRemoteControlEnabled = false;
  remoteControlStatus = 'INAKTIV';
  lastCommand = '-';

  // Screensaver
  isScreensaverActive = false;
  private screensaverTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastActivityTime: Date = new Date();
  screensaverPosition = { x: 50, y: 50 }; // Random position for screensaver text

  private subscriptions = new Subscription();

  constructor(private tvCommunicationService: TvCommunicationService) {}

  ngOnInit(): void {
    this.initTvMode();
    this.startScreensaverTimer();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.isRemoteControlEnabled = false;
    if (this.screensaverTimeout) {
      clearTimeout(this.screensaverTimeout);
    }
  }

  // SCREENSAVER METHODS
  private startScreensaverTimer(): void {
    this.resetScreensaverTimer();
  }

  private resetScreensaverTimer(): void {
    // Clear existing timer
    if (this.screensaverTimeout) {
      clearTimeout(this.screensaverTimeout);
    }

    // Wake up if screensaver is active
    if (this.isScreensaverActive) {
      this.isScreensaverActive = false;
    }

    // Update last activity
    this.lastActivityTime = new Date();

    // Set new timer (5 seconds)
    this.screensaverTimeout = setTimeout(() => {
      // Set random position for screensaver text
      this.screensaverPosition = {
        x: 20 + Math.random() * 60, // 20% to 80%
        y: 20 + Math.random() * 60, // 20% to 80%
      };
      this.isScreensaverActive = true;
    }, 5000);
  }

  formatScreensaverTime(): string {
    if (!this.lastActivityTime) return 'Unknown';
    const now = new Date();
    const diff = Math.floor(
      (now.getTime() - this.lastActivityTime.getTime()) / 1000
    );
    if (diff < 60) return `${diff} seconds ago`;
    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }

  // PUBLIC METHODS (called from template)
  startScan(): void {
    this.autoScan();
  }

  uploadToService(): void {
    if (this.scannedFunctions.length === 0) {
      this.appendTvStatus(
        '❌ No functions to upload. Run scan first.',
        'error'
      );
      return;
    }

    // Activity detected
    this.resetScreensaverTimer();

    const functionData = {
      functions: this.scannedFunctions.map((func) => {
        const extractedParams = this.getFunctionParameters(
          func.sourceCode || ''
        );

        return {
          name: func.name,
          sourceCode: func.sourceCode,
          available: func.available,
          parameters: extractedParams,
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

  // PRIVATE METHODS
  private async initTvMode(): Promise<void> {
    this.appendTvStatus('🔄 Initializing TV Function Scanner...', 'info');

    // Auto-start scanning after short delay
    setTimeout(() => {
      this.autoScan();
    }, 1000);

    // Enable remote command listening
    this.enableRemoteCommandListener();

    // Start keep-alive to maintain connection status
    this.startKeepAlive();
  }

  private startKeepAlive(): void {
    // Start immediately (0ms), then repeat every 2 minutes (120000ms)
    const keepAlive$ = timer(0, 120000).pipe(
      switchMap(() => this.tvCommunicationService.sendKeepAlive())
    );

    this.subscriptions.add(
      keepAlive$.subscribe({
        next: () => {
          console.log('✅ Keep-alive sent');
        },
        error: (err) => {
          console.error('❌ Keep-alive failed:', err);
        },
      })
    );
  }

  private async autoScan(): Promise<void> {
    try {
      // Activity detected
      this.resetScreensaverTimer();

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

      // Send functions to controller (but don't save to disk)
      this.appendTvStatus(
        `✅ Scan Complete! Found ${this.scannedFunctions.length} functions.`,
        'success'
      );
      this.sendFunctionsToController();
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

  private sendFunctionsToController(): void {
    const functionData = {
      functions: this.scannedFunctions.map((func) => {
        const extractedParams = this.getFunctionParameters(
          func.sourceCode || ''
        );
        return {
          name: func.name,
          sourceCode: func.sourceCode,
          available: func.available,
          parameters: extractedParams,
        };
      }),
      deviceInfo: this.getDeviceInfo(),
      timestamp: new Date().toISOString(),
    };

    // Send to controller without saving to disk
    this.tvCommunicationService.receiveFunctions(functionData).subscribe({
      next: () => {
        this.appendTvStatus(
          `📤 Functions sent to controller successfully!`,
          'success'
        );
      },
      error: (error) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.appendTvStatus(
          `❌ Failed to send to controller: ${errorMessage}`,
          'error'
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

  private getFunctionParameters(sourceCode: string): string[] {
    if (!sourceCode) return [];

    const patterns = [
      /function\s*\(([^)]*)\)/,
      /\(([^)]*)\)\s*=>/,
      /function\s+\w+\s*\(([^)]*)\)/,
      /^\s*\(([^)]*)\)/,
      /=>\s*\(([^)]*)\)/,
    ];

    for (const pattern of patterns) {
      const match = sourceCode.match(pattern);
      if (match && match[1] !== undefined) {
        const paramString = match[1].trim();
        if (!paramString) return [];

        return paramString
          .split(',')
          .map((p) => p.trim().split(/[=\s]/)[0])
          .filter((p) => p && !p.includes('//') && !p.includes('/*'));
      }
    }

    return [];
  }

  private appendTvStatus(
    message: string,
    type: 'success' | 'error' | 'info'
  ): void {
    if (this.tvStatusMessage) {
      this.tvStatusMessage += '\n' + message;
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

  private enableRemoteCommandListener(): void {
    this.isRemoteControlEnabled = true;
    this.remoteControlStatus = 'ACTIVE';
    this.appendTvStatus(
      '📡 Remote Control enabled - Listening for PC commands...',
      'success'
    );

    // Poll for commands every 3 seconds
    const pollingSubscription = interval(3000).subscribe(() => {
      this.tvCommunicationService.checkForCommands().subscribe({
        next: (commandData: RemoteCommandCheck) => {
          if (commandData.hasCommand && commandData.command) {
            // Wake up from screensaver on command received
            this.resetScreensaverTimer();

            this.appendTvStatus(
              `📥 Command received: ${commandData.command.function}`,
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
          console.error('Command check failed:', error);
          // Ignore polling errors - don't spam the UI
        },
      });
    });

    this.subscriptions.add(pollingSubscription);
  }

  private executeRemoteCommand(command: RemoteCommand): void {
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
      const windowObj = window as unknown as Record<string, unknown>;
      let nativeFunc: unknown;

      if (
        command.function === '__CUSTOM_CODE__' &&
        command.parameters &&
        command.parameters.length > 0
      ) {
        try {
          const jsCode = String(command.parameters[0]);
          this.appendTvStatus(
            `📝 Executing custom code:\n${jsCode.substring(0, 100)}...`,
            'info'
          );

          const customFunction = new Function(jsCode);
          const output = customFunction();

          result.success = true;
          result.data = output;

          this.appendTvStatus(
            `✅ Custom code executed successfully → ${JSON.stringify(output)}`,
            'success'
          );
        } catch (execError) {
          const execErrorMessage =
            execError instanceof Error ? execError.message : String(execError);
          result.error = `Custom code execution failed: ${execErrorMessage}`;

          this.appendTvStatus(
            `📡 Remote: ${command.function}() → Error: ${result.error}`,
            'error'
          );
        }
      } else if (command.function.includes('.')) {
        const parts = command.function.split('.');
        let current: unknown = windowObj;

        for (const part of parts) {
          if (current && typeof current === 'object') {
            current = (current as Record<string, unknown>)[part];
          } else {
            throw new Error(`Cannot access ${part} in ${command.function}`);
          }
        }

        nativeFunc = current;

        if (typeof nativeFunc === 'function') {
          try {
            const output = (nativeFunc as (...args: unknown[]) => unknown)(
              ...((command.parameters as unknown[]) || [])
            );

            result.success = true;
            result.data = output;

            this.appendTvStatus(
              `📡 Remote: ${command.function}(${(command.parameters || []).join(
                ', '
              )}) → ${JSON.stringify(output)}`,
              'success'
            );
          } catch (execError) {
            const execErrorMessage =
              execError instanceof Error
                ? execError.message
                : String(execError);
            throw new Error(`Execution failed: ${execErrorMessage}`);
          }
        } else {
          throw new Error(
            `Function ${
              command.function
            } not found or is not a function (type: ${typeof nativeFunc})`
          );
        }
      } else {
        nativeFunc = windowObj[command.function];

        if (typeof nativeFunc === 'function') {
          try {
            const output = (nativeFunc as (...args: unknown[]) => unknown)(
              ...((command.parameters as unknown[]) || [])
            );

            result.success = true;
            result.data = output;

            this.appendTvStatus(
              `📡 Remote: ${command.function}(${(command.parameters || []).join(
                ', '
              )}) → ${JSON.stringify(output)}`,
              'success'
            );
          } catch (execError) {
            const execErrorMessage =
              execError instanceof Error
                ? execError.message
                : String(execError);
            throw new Error(`Execution failed: ${execErrorMessage}`);
          }
        } else {
          throw new Error(
            `Function ${
              command.function
            } not found or is not a function (type: ${typeof nativeFunc})`
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.error = errorMessage;

      this.appendTvStatus(
        `📡 Remote: ${command.function}() → Error: ${result.error}`,
        'error'
      );
    } finally {
      // ALWAYS send result back, even if there was an error
      // This prevents the PC from waiting forever
      this.sendResultBackToPC(command.id, result);
    }
  }

  private sendResultBackToPC(
    commandId: string,
    result: {
      commandId: string;
      function: string;
      parameters: unknown[];
      success: boolean;
      data: unknown;
      error: string | null;
      timestamp: string;
    }
  ): void {
    this.tvCommunicationService
      .receiveCommandResult(commandId, result)
      .subscribe({
        next: () => {
          this.appendTvStatus(`✅ Result sent back to PC`, 'success');
        },
        error: (error) => {
          console.error('Failed to send result:', error);
          this.appendTvStatus(
            `❌ Failed to send result: ${error.message}`,
            'error'
          );
        },
      });
  }
}
