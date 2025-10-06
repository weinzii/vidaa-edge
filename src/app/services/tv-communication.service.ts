import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { tap, catchError, switchMap, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { DeviceDetectionService } from './device-detection.service';

export interface TVConnectionInfo {
  connected: boolean;
  lastSeen: Date | null;
  ipAddress: string | null;
  deviceInfo: any | null;
}

export interface CommandQueueItem {
  id: string;
  function: string;
  parameters?: any;
  timestamp: Date;
  status: 'pending' | 'sent' | 'completed' | 'timeout';
  result?: any;
}

export interface TVFunction {
  name: string;
  parameters?: string[];
  description?: string;
  source?: string;
}

@Injectable({
  providedIn: 'root',
})
export class TvCommunicationService {
  private readonly STORAGE_KEY = 'vidaa_functions';
  private readonly COMMAND_TIMEOUT = 10000; // 10 seconds
  private apiBaseUrl = ''; // Will be set based on device detection

  // State Management
  private tvConnectionSubject = new BehaviorSubject<TVConnectionInfo>({
    connected: false,
    lastSeen: null,
    ipAddress: null,
    deviceInfo: null,
  });

  private commandQueueSubject = new BehaviorSubject<CommandQueueItem[]>([]);
  private functionsSubject = new BehaviorSubject<TVFunction[]>([]);

  // Public Observables
  public tvConnection$ = this.tvConnectionSubject.asObservable();
  public commandQueue$ = this.commandQueueSubject.asObservable();
  public functions$ = this.functionsSubject.asObservable();

  constructor(private http: HttpClient) {
    this.initializeApiBaseUrl();
    this.loadFunctions();
    this.startConnectionMonitoring();
  }

  private initializeApiBaseUrl(): void {
    // Always use current host - no localStorage
    this.apiBaseUrl = window.location.origin;
  }

  /**
   * ===== TV CONNECTION MANAGEMENT =====
   */

  private startConnectionMonitoring(): void {
    // Check for new functions and manage connection status (every 10 seconds)
    interval(10000).subscribe(() => {
      this.loadFunctions();
    });
  }

  public updateTvConnection(info: Partial<TVConnectionInfo>): void {
    const current = this.tvConnectionSubject.value;
    const updated = {
      ...current,
      ...info,
      lastSeen: info.lastSeen || new Date(),
    };

    this.tvConnectionSubject.next(updated);
  }

  /**
   * ===== FUNCTION MANAGEMENT =====
   */

  public receiveFunctions(data: any): Observable<any> {
    console.log(
      '📤 TvCommunicationService: Starting receiveFunctions with data:',
      {
        functionsCount: data.functions?.length || 0,
        deviceInfo: data.deviceInfo,
        timestamp: data.timestamp,
      }
    );

    // Send to backend API for cross-device communication
    return this.http.post('/api/functions', data).pipe(
      tap((response: any) => {
        console.log(
          '📤 TvCommunicationService: API Response received:',
          response
        );

        // Also update local state
        const functions = this.extractFunctions(data);
        this.functionsSubject.next(functions);
        this.saveFunctions(data);

        // Update TV connection info
        this.updateTvConnection({
          connected: true,
          ipAddress: data.deviceInfo?.networkInfo?.ipAddress,
          deviceInfo: data.deviceInfo,
        });
      }),
      catchError((error) => {
        console.error(
          '❌ TvCommunicationService: receiveFunctions API Error:',
          error
        );
        console.error('❌ Error Details:', {
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          message: error.message,
        });
        throw error;
      })
    );
  }

  private extractFunctions(data: any): TVFunction[] {
    if (!data.functions || !Array.isArray(data.functions)) {
      return [];
    }

    return data.functions.map((func: any) => ({
      name: func.name,
      parameters: func.parameters || [],
      description: func.description || '',
      source: func.sourceCode || func.source || func.toString(),
    }));
  }

  private saveFunctions(data: any): void {
    // No localStorage - only create function files in memory
    this.createFunctionFiles(data);
  }

  private loadFunctions(): void {
    // Load from API for cross-device communication
    this.http.get('/api/functions').subscribe({
      next: (response: any) => {
        if (response.functions && response.functions.length > 0) {
          const currentFunctions = this.functionsSubject.value;
          const newCount = response.functions.length;
          const oldCount = currentFunctions.length;

          // Only log significant changes (not just polling)
          if (newCount !== oldCount && newCount > 0) {
            console.log(
              `📥 TV Functions loaded: ${newCount} functions available`
            );
          }

          this.functionsSubject.next(response.functions);

          // Update connection status based on data freshness
          if (response.timestamp) {
            const dataAge =
              new Date().getTime() - new Date(response.timestamp).getTime();
            const isConnected = dataAge < 300000; // 5 minutes threshold

            this.updateTvConnection({
              connected: isConnected,
              ipAddress: response.connectionInfo?.ipAddress,
              deviceInfo: response.deviceInfo,
            });
          }
        } else {
          // No functions available - check if we should disconnect
          const currentFunctions = this.functionsSubject.value;
          const currentConnection = this.tvConnectionSubject.value;

          if (currentFunctions.length > 0) {
            console.log('📂 TV disconnected - functions cleared');
            this.functionsSubject.next([]);
          }

          // Set disconnected if we haven't seen data recently
          if (currentConnection.connected && currentConnection.lastSeen) {
            const timeSinceLastSeen =
              new Date().getTime() - currentConnection.lastSeen.getTime();
            if (timeSinceLastSeen > 300000) {
              // 5 minutes
              this.updateTvConnection({ connected: false });
            }
          }
        }
      },
      error: (error) => {
        console.log('⚠️ API not available - no fallback');
        // No localStorage fallback - force API usage
        this.functionsSubject.next([]);
      },
    });
  }

  private createFunctionFiles(data: any): void {
    // Store functions in service for remote console access
    console.log(
      `📁 Functions loaded into service: ${this.functionsSubject.value.length} functions available for remote execution`
    );

    // Send to dev-server instead of downloading files (TV doesn't need downloads)
    // Use current origin (vidaahub.com redirected to dev-server by DNS)
    const serverUrl = `${window.location.origin}/api/functions`;

    this.http.post(serverUrl, data).subscribe({
      next: (response: any) => {
        console.log('📡 Functions successfully sent to server:', response);
        console.log('💾 Files saved on development machine');
      },
      error: (error) => {
        console.warn(
          '⚠️ Dev-Server not available - functions stored locally only',
          error
        );
        console.log('💡 Start dev server with: npm start');
      },
    });

    console.log('🔧 Functions ready for laptop remote control');
  }

  public downloadFile(filename: string, content: string): void {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  public getFunctionsList(): Observable<TVFunction[]> {
    return this.functions$;
  }

  /**
   * ===== COMMAND EXECUTION =====
   */

  public executeFunction(
    functionName: string,
    parameters: any = {},
    sourceCode?: string
  ): Observable<any> {
    console.log(`🔥 EXECUTE FUNCTION CALLED:`);
    console.log(`📋 Function: ${functionName}`);
    console.log(`📋 Parameters:`, parameters);
    console.log(`📋 Source Code Length:`, sourceCode?.length || 0);

    // Check if we have access to window functions (TV Mode)
    const windowObj = window as unknown as Record<string, unknown>;
    const isTvMode = typeof windowObj[functionName] === 'function';

    console.log(
      `📋 Device Mode: ${
        isTvMode ? 'TV (Direct Execution)' : 'Laptop (Remote Command)'
      }`
    );

    if (isTvMode) {
      // TV MODE: Direct execution
      console.log(`📺 TV MODE: Executing function directly`);

      try {
        const func = windowObj[functionName] as Function;

        // Convert parameters to array if needed
        const paramArray = Array.isArray(parameters)
          ? parameters
          : parameters && typeof parameters === 'object'
          ? Object.values(parameters)
          : [parameters];

        const result = func(...paramArray);
        console.log(`✅ TV execution successful:`, result);

        return new Observable((observer) => {
          observer.next(result);
          observer.complete();
        });
      } catch (error) {
        console.error(`❌ TV execution failed:`, error);
        return new Observable((observer) => {
          observer.error(error);
        });
      }
    } else {
      // LAPTOP MODE: Send command with source code for eval() execution on TV
      console.log(`💻 LAPTOP MODE: Sending remote command with source code`);

      // Find the function source code if not provided
      let functionSource = sourceCode;
      if (!functionSource) {
        const functions = this.functionsSubject.value;
        const targetFunction = functions.find((f) => f.name === functionName);
        functionSource = targetFunction?.source || '';
      }

      const url = '/api/remote-command';
      console.log(`📋 Using URL: ${url} (via proxy)`);

      return this.http
        .post(url, {
          function: functionName,
          parameters: parameters,
          sourceCode: functionSource, // Include source code for eval() execution
          executionMode: 'eval', // Tell TV to use eval()
        })
        .pipe(
          timeout(5000), // 5 second timeout
          tap({
            next: (response: any) => {
              console.log(`🔥 HTTP POST SUCCESS:`);
              console.log(`🔥📤 Response Status: SUCCESS`);
              console.log(`📤 Response Data:`, response);
              console.log(`📤 Response Type:`, typeof response);
              console.log(`📤 Response Keys:`, Object.keys(response || {}));

              if (response && response.commandId) {
                console.log(`📤 Command ID found: ${response.commandId}`);
              } else {
                console.log(`🔥 NO COMMAND ID! This is the problem!`);
                console.log(
                  `🔥 Response structure:`,
                  JSON.stringify(response, null, 2)
                );
              }
            },
            error: (error) => {
              console.log(`🔴 Command failed:`, error.status, error.message);

              // Handle TV disconnection errors specifically
              if (
                error.status === 503 &&
                error.error?.error === 'TV_NOT_CONNECTED'
              ) {
                console.log(`📺 TV NOT CONNECTED:`, error.error.message);
              }
            },
          }),
          switchMap((response: any) => {
            // Poll for result
            return this.pollForResult(response.commandId);
          }),
          catchError((error) => {
            console.error('❌ Command execution failed:', error);
            throw error;
          })
        );
    }
  }

  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private pollForResult(commandId: string): Observable<any> {
    return new Observable((observer) => {
      const timeout = setTimeout(() => {
        clearInterval(pollInterval);
        observer.error(
          new Error('Command timeout - no response received within 10 seconds')
        );
      }, this.COMMAND_TIMEOUT);

      const pollInterval = setInterval(() => {
        this.http.get(`/api/execute-response/${commandId}`).subscribe({
          next: (response: any) => {
            if (response.waiting) {
              // Still waiting for result
              return;
            }

            // Got result
            clearTimeout(timeout);
            clearInterval(pollInterval);

            console.log(
              `✅ Command result received: ${response.function} (${commandId})`
            );

            if (response.success) {
              observer.next(response.data);
            } else {
              observer.error(new Error(response.error));
            }
            observer.complete();
          },
          error: (error) => {
            clearTimeout(timeout);
            clearInterval(pollInterval);
            observer.error(error);
          },
        });
      }, 500); // Poll every 500ms
    });
  }

  private monitorCommandExecution(commandId: string): Observable<any> {
    return new Observable((observer) => {
      const timeout = setTimeout(() => {
        this.updateCommandStatus(commandId, 'timeout');
        observer.error(
          new Error('Command timeout - no response received within 10 seconds')
        );
      }, this.COMMAND_TIMEOUT);

      // Poll for command completion
      const checkInterval = setInterval(() => {
        const queue = this.commandQueueSubject.value;
        const command = queue.find((cmd) => cmd.id === commandId);

        if (command?.status === 'completed') {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          observer.next(command.result);
          observer.complete();
        }
      }, 500);
    });
  }

  private updateCommandStatus(
    commandId: string,
    status: CommandQueueItem['status'],
    result?: any
  ): void {
    const currentQueue = this.commandQueueSubject.value;
    const updatedQueue = currentQueue.map((cmd) =>
      cmd.id === commandId ? { ...cmd, status, result } : cmd
    );
    this.commandQueueSubject.next(updatedQueue);
  }

  /**
   * ===== TV POLLING INTERFACE =====
   * These methods are called by the TV to check for commands and send results
   */

  public checkForCommands(): Observable<any> {
    // TV polls server for commands
    return this.http.get('/api/remote-command').pipe(
      catchError((error) => {
        console.log('⚠️ Command API not reachable:', error);
        // Return no command if API not available
        return new Observable((observer) => {
          observer.next({ hasCommand: false });
          observer.complete();
        });
      })
    );
  }

  public receiveCommandResult(commandId: string, result: any): Observable<any> {
    console.log(
      `✅ TvCommunicationService: Sending result to server - ${commandId}`
    );

    // Send result to server
    return this.http.post('/api/execute-response', result).pipe(
      tap(() => {
        console.log(
          `📤 Result sent to server: ${result.function} (${commandId})`
        );
      }),
      catchError((error) => {
        console.error('❌ Failed to send result to server:', error);
        throw error;
      })
    );
  }

  /**
   * ===== STATUS INFORMATION =====
   */

  public getStatus(): Observable<any> {
    const tvInfo = this.tvConnectionSubject.value;
    const queue = this.commandQueueSubject.value;
    const functions = this.functionsSubject.value;

    return new Observable((observer) => {
      observer.next({
        tvConnection: tvInfo,
        commandQueue: {
          total: queue.length,
          pending: queue.filter((cmd) => cmd.status === 'pending').length,
          completed: queue.filter((cmd) => cmd.status === 'completed').length,
        },
        functionsAvailable: functions.length,
        lastUpdate: new Date().toISOString(),
      });
      observer.complete();
    });
  }

  /**
   * ===== CLEANUP =====
   */

  public clearCompletedCommands(): void {
    const currentQueue = this.commandQueueSubject.value;
    const activeQueue = currentQueue.filter(
      (cmd) => cmd.status === 'pending' || cmd.status === 'sent'
    );
    this.commandQueueSubject.next(activeQueue);
  }

  public clearAllCommands(): void {
    this.commandQueueSubject.next([]);
  }
}
