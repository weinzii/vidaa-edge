import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { tap, catchError, switchMap, timeout } from 'rxjs/operators';

export interface TVConnectionInfo {
  connected: boolean;
  lastSeen: Date | null;
  brand?: string;
  model?: string;
  firmware?: string;
}

export interface CommandQueueItem {
  id: string;
  function: string;
  parameters?: Record<string, unknown> | unknown[];
  timestamp: Date;
  status: 'pending' | 'sent' | 'completed' | 'timeout';
  result?: unknown;
}

export interface FunctionData {
  name: string;
  sourceCode?: string;
  parameters?: string[];
  description?: string;
  available?: boolean;
}

export interface ApiResponse {
  functions: FunctionData[];
  timestamp?: string;
  deviceInfo?: Record<string, unknown>;
}

export interface CommandResponse {
  commandId: string;
  success?: boolean;
  waiting?: boolean;
  data?: unknown;
  error?: string | null;
  function?: string;
}

export interface ExecuteRequest {
  function: string;
  parameters: Record<string, unknown> | unknown[];
}

export interface RemoteCommand {
  id: string;
  function: string;
  parameters: unknown[];
  success: boolean;
  data: unknown;
  error: string | null;
  timestamp: string;
}

export interface RemoteCommandCheck {
  hasCommand: boolean;
  command?: RemoteCommand;
}

@Injectable({
  providedIn: 'root',
})
export class TvCommunicationService {
  private readonly COMMAND_TIMEOUT = 10000; // 10 seconds

  // State Management
  private tvConnectionSubject = new BehaviorSubject<TVConnectionInfo>({
    connected: false,
    lastSeen: null,
    brand: undefined,
    model: undefined,
    firmware: undefined,
  });

  private commandQueueSubject = new BehaviorSubject<CommandQueueItem[]>([]);
  private functionsSubject = new BehaviorSubject<FunctionData[]>([]);

  // Public Observables
  public tvConnection$ = this.tvConnectionSubject.asObservable();
  public commandQueue$ = this.commandQueueSubject.asObservable();
  public functions$ = this.functionsSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadFunctions();
    this.startConnectionMonitoring();
  }

  /**
   * ===== TV CONNECTION MANAGEMENT =====
   */

  private startConnectionMonitoring(): void {
    // Check for new functions and manage connection status (every 10 seconds)
    interval(10000).subscribe(() => {
      this.loadFunctions();
    });

    // Note: Command polling is now handled by TV Scanner Component
    // The TV Scanner polls checkForCommands() every 3 seconds
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
   * Extract device details from deviceInfo
   */
  private extractDeviceDetails(
    deviceInfo: Record<string, unknown> | null | undefined
  ): {
    brand?: string;
    model?: string;
    firmware?: string;
  } {
    if (!deviceInfo) return {};

    return {
      brand:
        (typeof deviceInfo?.['Hisense_GetBrand'] === 'string'
          ? deviceInfo['Hisense_GetBrand']
          : undefined) ||
        (typeof deviceInfo?.['userAgent'] === 'string' &&
        deviceInfo['userAgent'].includes('Hisense')
          ? 'Hisense'
          : undefined),
      model:
        typeof deviceInfo?.['Hisense_GetModelName'] === 'string'
          ? deviceInfo['Hisense_GetModelName']
          : undefined,
      firmware:
        (typeof deviceInfo?.['Hisense_GetFirmWareVersion'] === 'string'
          ? deviceInfo['Hisense_GetFirmWareVersion']
          : undefined) ||
        (typeof deviceInfo?.['Hisense_GetApiVersion'] === 'string'
          ? deviceInfo['Hisense_GetApiVersion']
          : undefined),
    };
  }

  /**
   * ===== FUNCTION MANAGEMENT =====
   */

  public receiveFunctions(data: ApiResponse): Observable<unknown> {
    return this.http.post('/api/functions', data).pipe(
      tap(() => {
        const functions = this.extractFunctions(data);
        this.functionsSubject.next(functions);
        this.saveFunctions(data);

        const deviceDetails = this.extractDeviceDetails(data.deviceInfo);
        this.updateTvConnection({
          connected: true,
          ...deviceDetails,
        });
      })
    );
  }

  private extractFunctions(data: ApiResponse): FunctionData[] {
    if (!data.functions || !Array.isArray(data.functions)) {
      return [];
    }

    return data.functions.map((func: FunctionData) => ({
      name: func.name,
      parameters: func.parameters || [],
      description: func.description || '',
      sourceCode: func.sourceCode || func.toString(),
      available: func.available ?? true,
    }));
  }

  private saveFunctions(data: ApiResponse): void {
    // No localStorage - only create function files in memory
    this.createFunctionFiles(data);
  }

  private loadFunctions(): void {
    // Load from API for cross-device communication
    this.http.get<ApiResponse>('/api/functions').subscribe({
      next: (response: ApiResponse) => {
        if (response.functions && response.functions.length > 0) {
          const mappedFunctions = response.functions.map(
            (func: FunctionData) => ({
              name: func.name,
              parameters: func.parameters || [],
              description: func.description || '',
              sourceCode: func.sourceCode,
            })
          );

          this.functionsSubject.next(mappedFunctions);

          // Update connection status based on data freshness
          if (response.timestamp) {
            const dataAge =
              new Date().getTime() - new Date(response.timestamp).getTime();
            const isConnected = dataAge < 300000; // 5 minutes threshold

            const deviceDetails = this.extractDeviceDetails(
              response.deviceInfo
            );
            this.updateTvConnection({
              connected: isConnected,
              ...deviceDetails,
            });
          }
        } else {
          const currentFunctions = this.functionsSubject.value;
          const currentConnection = this.tvConnectionSubject.value;

          if (currentFunctions.length > 0) {
            this.functionsSubject.next([]);
          }

          if (currentConnection.connected && currentConnection.lastSeen) {
            const timeSinceLastSeen =
              new Date().getTime() - currentConnection.lastSeen.getTime();
            if (timeSinceLastSeen > 300000) {
              this.updateTvConnection({ connected: false });
            }
          }
        }
      },
      error: () => {
        this.functionsSubject.next([]);
      },
    });
  }

  private createFunctionFiles(data: ApiResponse): void {
    // Use relative path so proxy can intercept
    this.http.post('/api/functions', data).subscribe();
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

  public getFunctionsList(): Observable<FunctionData[]> {
    return this.functions$;
  }

  /**
   * ===== COMMAND EXECUTION =====
   * Sends remote commands to TV via the command queue system.
   * This method is used by the Controller Console (laptop/browser)
   * to execute functions on the TV remotely.
   *
   * The TV Scanner Component polls for these commands and executes them.
   * Note: Source code is NOT sent to the TV - the TV already has access to all functions.
   */

  public executeFunction(
    functionName: string,
    parameters: Record<string, unknown> | unknown[] = {}
  ): Observable<unknown> {
    // Send only function name and parameters to TV
    // The TV will execute the function from its own window object
    return this.http
      .post<CommandResponse>('/api/remote-command', {
        function: functionName,
        parameters: parameters,
      })
      .pipe(
        timeout(30000), // 30 seconds timeout for initial command queue submission
        switchMap((response: CommandResponse) =>
          this.pollForResult(response.commandId)
        ),
        catchError((error) => {
          throw error;
        })
      );
  }

  private pollForResult(commandId: string): Observable<unknown> {
    return new Observable((observer) => {
      const timeout = setTimeout(() => {
        clearInterval(pollInterval);
        observer.error(
          new Error('Command timeout - no response received within 10 seconds')
        );
      }, this.COMMAND_TIMEOUT);

      const pollInterval = setInterval(() => {
        this.http
          .get<CommandResponse>(`/api/execute-response/${commandId}`)
          .subscribe({
            next: (response: CommandResponse) => {
              if (response.waiting) {
                // Still waiting for result
                return;
              }

              clearTimeout(timeout);
              clearInterval(pollInterval);

              if (response.success) {
                observer.next(response.data);
              } else {
                observer.error(new Error(response.error || 'Unknown error'));
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

  /**
   * ===== TV POLLING INTERFACE =====
   * These methods are called by the TV to check for commands and send results
   */

  public checkForCommands(): Observable<RemoteCommandCheck> {
    // TV polls server for commands
    return new Observable((observer) => {
      this.http.get('/api/remote-command').subscribe({
        next: (data) => {
          observer.next(data as RemoteCommandCheck);
          observer.complete();
        },
        error: () => {
          console.log('⚠️ Command API not reachable');
          observer.next({ hasCommand: false });
          observer.complete();
        },
      });
    });
  }

  public receiveCommandResult(
    commandId: string,
    result: CommandResponse
  ): Observable<unknown> {
    return this.http.post('/api/execute-response', result);
  }

  /**
   * ===== STATUS INFORMATION =====
   */

  public getStatus(): Observable<{
    tvConnection: TVConnectionInfo;
    commandQueue: { total: number; pending: number; completed: number };
    functionsAvailable: number;
    lastUpdate: string;
  }> {
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

  /**
   * ===== FILE SAVING =====
   */

  public saveFilesToPublic(
    files: Array<{ filename: string; content: string }>
  ): Observable<{ saved: string[] }> {
    return this.http.post<{ saved: string[] }>('/api/save-to-public', {
      files,
    });
  }

  /**
   * ===== CUSTOM CODE EXECUTION =====
   * Execute arbitrary JavaScript code on the TV
   */

  public executeCustomCode(jsCode: string): Observable<unknown> {
    const commandId = Date.now().toString();

    // Create custom code command (only send required fields for queueing)
    const customCommand = {
      id: commandId,
      function: '__CUSTOM_CODE__',
      parameters: [jsCode], // Pass JS code as parameter
      timestamp: new Date().toISOString(),
    };

    // Send command to server
    return this.http.post('/api/remote-command', customCommand).pipe(
      switchMap(() => this.pollForResult(commandId)),
      timeout(this.COMMAND_TIMEOUT),
      catchError((error) => {
        // Pass through the original error object (like executeFunction does)
        // This preserves HTTP status codes and structured error responses
        throw error;
      })
    );
  }
}
