import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TvConnectionService } from '../../services/tv-connection.service';
import { TvFunctionService } from '../../services/tv-function.service';
import {
  TvPollingService,
  RemoteCommand,
} from '../../services/tv-polling.service';
import { FunctionResult } from '../../services/tv-command.service';
import { Subscription, interval, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ConsoleService } from '../../services/console.service';

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
  templateUrl: './tv-scanner.component.html',
  styleUrls: ['./tv-scanner.component.css'],
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
  screensaverAnimationId = 0; // Unique ID for dynamic animation
  private animationUpdateInterval: ReturnType<typeof setInterval> | null = null; // Continuous animation updates

  private subscriptions = new Subscription();

  constructor(
    private tvConnectionService: TvConnectionService,
    private tvFunctionService: TvFunctionService,
    private tvPollingService: TvPollingService,
    private consoleService: ConsoleService,
    private cdr: ChangeDetectorRef
  ) {}

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
    if (this.animationUpdateInterval) {
      clearInterval(this.animationUpdateInterval);
    }

    // Restore scrollbars on cleanup
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
  }

  // SCREENSAVER METHODS
  private startScreensaverTimer(): void {
    this.resetScreensaverTimer();
  }

  /**
   * Called on any user activity (mouse move, click, key press, touch)
   */
  onUserActivity(): void {
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

      // Restore scrollbars on body and html
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }

      // Stop animation updates
      if (this.animationUpdateInterval) {
        clearInterval(this.animationUpdateInterval);
        this.animationUpdateInterval = null;
      }
      this.cdr.detectChanges();
    }

    // Update last activity
    this.lastActivityTime = new Date();

    // Set new timer (5 seconds)
    this.screensaverTimeout = setTimeout(() => {
      this.activateScreensaver();
    }, 10000);
  }

  /**
   * Activate screensaver with random animation
   */
  private activateScreensaver(): void {
    // Generate unique animation ID
    this.screensaverAnimationId = Date.now();

    // Generate first animation
    this.updateScreensaverAnimation();

    // Activate screensaver
    this.isScreensaverActive = true;

    // Hide scrollbars on body and html
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }

    this.cdr.detectChanges();

    // Start continuous animation updates every 20 seconds
    this.animationUpdateInterval = setInterval(() => {
      if (this.isScreensaverActive) {
        this.updateScreensaverAnimation();
      }
    }, 20000); // Update every 20 seconds (when animation completes)
  }

  /**
   * Update screensaver animation with new random path and bezier curve
   */
  private updateScreensaverAnimation(): void {
    // Generate new animation ID
    this.screensaverAnimationId = Date.now();

    // Generate 5-8 random movement points for more organic flow
    const numPoints = 5 + Math.floor(Math.random() * 4); // 5 to 8 points
    const points: Array<{
      x: number;
      y: number;
      scale: number;
      rotate: number;
    }> = [];

    // Start point (centered by flexbox)
    points.push({ x: 0, y: 0, scale: 1, rotate: 0 });

    // Generate intermediate points
    // Element is ~400px wide, ~200px tall (text-9xl + text)
    // Screen is typically 1920x1080
    // Safe movement range to avoid clipping:
    // X: ±40vw (element stays within 10%-90% of screen)
    // Y: ±35vh (element stays within 15%-85% of screen)
    for (let i = 0; i < numPoints - 2; i++) {
      points.push({
        x: -40 + Math.random() * 80, // -40vw to 40vw
        y: -35 + Math.random() * 70, // -35vh to 35vh
        scale: 0.93 + Math.random() * 0.14, // 0.93 to 1.07
        rotate: -6 + Math.random() * 12, // -6deg to 6deg
      });
    }

    // End point (back to start)
    points.push({ x: 0, y: 0, scale: 1, rotate: 0 });

    // Generate random bezier curve for organic easing
    const bezier = this.generateRandomBezier();

    // Remove old animation style
    const oldStyle = document.getElementById('screensaver-animation');
    if (oldStyle) {
      oldStyle.remove();
    }

    // Create dynamic CSS animation with keyframes
    const animName = `float-${this.screensaverAnimationId}`;
    let keyframesCSS = `@keyframes ${animName} {\n`;

    // Generate keyframes dynamically based on number of points
    points.forEach((point, index) => {
      const percentage = Math.round((index / (points.length - 1)) * 100);
      keyframesCSS += `  ${percentage}% { transform: translate(${point.x}vw, ${point.y}vh) scale(${point.scale}) rotate(${point.rotate}deg); }\n`;
    });

    keyframesCSS += `}`;

    const css = `
      ${keyframesCSS}
      .screensaver-float-${this.screensaverAnimationId} {
        animation: ${animName} 20s ${bezier} infinite;
        will-change: transform;
      }
    `;

    const style = document.createElement('style');
    style.id = 'screensaver-animation';
    style.textContent = css;
    document.head.appendChild(style);

    // Trigger change detection to apply new class
    this.cdr.detectChanges();
  }

  /**
   * Generate random cubic-bezier curve for organic easing
   */
  private generateRandomBezier(): string {
    // Generate control points for cubic-bezier
    // P1: (x1, y1) - first control point
    // P2: (x2, y2) - second control point
    // All values between 0 and 1 for smooth curves

    const x1 = 0.2 + Math.random() * 0.4; // 0.2 to 0.6
    const y1 = Math.random() * 0.3; // 0 to 0.3 (slight ease-in)
    const x2 = 0.4 + Math.random() * 0.4; // 0.4 to 0.8
    const y2 = 0.7 + Math.random() * 0.3; // 0.7 to 1.0 (ease-out)

    return `cubic-bezier(${x1.toFixed(2)}, ${y1.toFixed(2)}, ${x2.toFixed(
      2
    )}, ${y2.toFixed(2)})`;
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

      this.tvFunctionService.receiveFunctions(functionData).subscribe({
        next: () => {
          this.appendTvStatus(
            `✅ Functions loaded! ${this.scannedFunctions.length} functions are now available for remote execution. Ready for development integration.`,
            'success'
          );
        },
        error: (error: Error) => {
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

    // Enable remote command listening
    this.enableRemoteCommandListener();

    // Start keep-alive to maintain connection status
    this.startKeepAlive();

    // Auto-start scanning after short delay
    setTimeout(() => {
      this.consoleService.info(
        'Triggering auto-scan in setTimeout',
        'TVScanner'
      );
      this.autoScan().catch((err) => {
        this.consoleService.error(
          'autoScan promise rejected',
          err,
          'TVScanner'
        );
        this.appendTvStatus(`❌ Auto-Scan failed: ${err}`, 'error');
      });
    }, 1000);
  }

  private startKeepAlive(): void {
    // Start immediately (0ms), then repeat every 5 seconds (5000ms)
    const keepAlive$ = timer(0, 5000).pipe(
      switchMap(() => this.tvConnectionService.sendKeepAlive())
    );

    this.subscriptions.add(
      keepAlive$.subscribe({
        next: () => {
          this.consoleService.debug('Keep-alive sent', 'TVScanner');
        },
        error: (err) => {
          this.consoleService.error('Keep-alive failed', err, 'TVScanner');
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

      this.consoleService.info(
        `Scan completed. Found ${this.scannedFunctions.length} functions.`,
        'TVScanner'
      );

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
      this.consoleService.error('autoScan failed', error as Error, 'TVScanner');
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
    this.tvFunctionService.receiveFunctions(functionData).subscribe({
      next: () => {
        this.appendTvStatus(
          `📤 Functions sent to controller successfully!`,
          'success'
        );
      },
      error: (error: Error) => {
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
      this.consoleService.error('Function scan failed', error, 'TVScanner');
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

    // Trigger change detection
    this.cdr.detectChanges();

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

  /**
   * Truncate long return values for status display
   */
  private truncateResult(value: unknown, maxLength = 100): string {
    try {
      const stringified = JSON.stringify(value);
      if (stringified.length <= maxLength) {
        return stringified;
      }
      return stringified.substring(0, maxLength) + '...';
    } catch {
      const strValue = String(value);
      if (strValue.length <= maxLength) {
        return strValue;
      }
      return strValue.substring(0, maxLength) + '...';
    }
  }

  private enableRemoteCommandListener(): void {
    this.isRemoteControlEnabled = true;
    this.remoteControlStatus = 'ACTIVE';
    this.appendTvStatus(
      '📡 Remote Control enabled - Listening for PC commands (batch mode)...',
      'success'
    );

    // Poll for commands every 3 seconds (batch mode for parallel execution)
    const pollingSubscription = interval(3000).subscribe(() => {
      this.tvPollingService.checkForCommandsBatch(10).subscribe({
        next: (batchData) => {
          if (
            batchData.hasCommands &&
            batchData.commands &&
            batchData.commands.length > 0
          ) {
            // Wake up from screensaver on commands received
            this.resetScreensaverTimer();

            this.appendTvStatus(
              `📥 Batch received: ${batchData.commands.length} commands (${
                batchData.remainingInQueue || 0
              } remaining)`,
              'info'
            );

            // Execute all commands in parallel
            const commandPromises = batchData.commands.map((command) => {
              this.lastCommand = `${command.function}()`;
              return this.executeRemoteCommandAsync(command);
            });

            // Wait for all commands to complete
            Promise.all(commandPromises)
              .then(() => {
                this.appendTvStatus(
                  `✅ Batch completed: ${
                    batchData.commands?.length || 0
                  } commands executed`,
                  'success'
                );
              })
              .catch((error) => {
                this.consoleService.error(
                  'Batch execution error',
                  error,
                  'TVScanner'
                );
              });
          }
        },
        error: () => {
          this.consoleService.debug(
            'Batch command check polling error (ignored)',
            'TVScanner'
          );
          // Ignore polling errors - don't spam the UI
        },
      });
    });

    this.subscriptions.add(pollingSubscription);
  }

  private async executeRemoteCommandAsync(
    command: RemoteCommand
  ): Promise<void> {
    return new Promise((resolve) => {
      this.executeRemoteCommand(command);
      resolve();
    });
  }

  /**
   * Execute remote command with retry logic for transient failures
   */
  private executeRemoteCommand(command: RemoteCommand, retryCount = 0): void {
    const MAX_RETRIES = 2; // Total 3 attempts (initial + 2 retries)
    const RETRY_DELAY_MS = 1000; // 1 second between retries

    // Activity detected - reset screensaver
    this.resetScreensaverTimer();

    // Start timing - measure TV processing time
    const startTime = performance.now();

    const result = {
      commandId: command.id,
      function: command.function,
      parameters: command.parameters || [],
      success: false,
      data: null as unknown,
      error: null as string | null,
      timestamp: new Date().toISOString(),
      tvProcessingTimeMs: 0, // Will be set in finally block
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
            `✅ Custom code executed successfully → ${this.truncateResult(
              output
            )}`,
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
              )}) → ${this.truncateResult(output)}`,
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
              )}) → ${this.truncateResult(output)}`,
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

      // Check if error is retryable
      const isRetryable = this.isRetryableError(errorMessage);

      if (isRetryable && retryCount < MAX_RETRIES) {
        // Log retry attempt
        this.appendTvStatus(
          `🔄 RETRY ${retryCount + 1}/${MAX_RETRIES}: ${command.function}()\n` +
            `Error: ${errorMessage}\n` +
            `Retrying in ${RETRY_DELAY_MS}ms...`,
          'info'
        );

        // Schedule retry after delay
        setTimeout(() => {
          this.executeRemoteCommand(command, retryCount + 1);
        }, RETRY_DELAY_MS);

        return; // Don't send result yet, wait for retry
      }

      // Final failure or non-retryable error
      const retryInfo = retryCount > 0 ? ` (after ${retryCount} retries)` : '';
      this.appendTvStatus(
        `❌ Remote: ${command.function}() → Error: ${result.error}${retryInfo}`,
        'error'
      );
    }

    // Send result to PC (skipped if retry in progress)
    const endTime = performance.now();
    result.tvProcessingTimeMs = Math.round(endTime - startTime);

    const typedResult = {
      ...result,
      data: result.data as FunctionResult,
    };
    this.sendResultToServer(command.id, typedResult);
  }

  /**
   * Check if an error is retryable (transient failure)
   * @param errorMessage Error message to check
   * @returns true if error should be retried
   */
  private isRetryableError(errorMessage: string): boolean {
    const retryablePatterns = [
      /Failed to load/i, // Network errors
      /Failed to execute.*XMLHttpRequest/i, // XHR errors
      /Network.*failed/i,
      /Connection.*refused/i,
      /Timeout/i,
      /Service.*unavailable/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /temporarily unavailable/i,
      /Service not ready/i,
    ];

    return retryablePatterns.some((pattern) => pattern.test(errorMessage));
  }

  private sendResultToServer(
    commandId: string,
    result: {
      commandId: string;
      function: string;
      parameters: unknown[];
      success: boolean;
      data: FunctionResult;
      error: string | null;
      timestamp: string;
      tvProcessingTimeMs: number;
    }
  ): void {
    this.tvPollingService.receiveCommandResult(commandId, result).subscribe({
      next: () => {
        this.appendTvStatus(
          `✅ Result sent back to PC (TV processing: ${result.tvProcessingTimeMs}ms)`,
          'success'
        );
      },
      error: (error: Error) => {
        this.consoleService.error('Failed to send result', error, 'TVScanner');
        this.appendTvStatus(
          `❌ Failed to send result: ${
            error instanceof Error ? error.message : String(error)
          }`,
          'error'
        );
      },
    });
  }
}
