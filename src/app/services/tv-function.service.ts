import { Injectable, Injector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { TvConnectionService } from './tv-connection.service';
import { ConsoleService } from './console.service';
import { FileExplorationService } from './file-exploration.service';

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

/**
 * Service for managing TV function library.
 * Handles receiving, storing, and providing access to TV functions.
 */
@Injectable({
  providedIn: 'root',
})
export class TvFunctionService {
  private functionsSubject = new BehaviorSubject<FunctionData[]>([]);
  public functions$ = this.functionsSubject.asObservable();

  // Lazy-inject FileExplorationService to avoid circular dependency
  private fileExplorationService?: FileExplorationService;

  constructor(
    private http: HttpClient,
    private tvConnectionService: TvConnectionService,
    private consoleService: ConsoleService,
    private injector: Injector
  ) {
    this.loadFunctions();
    this.startFunctionMonitoring();
  }

  /**
   * Start monitoring for new functions from TV.
   * Polls every 2 seconds for responsive updates.
   * Skips polling during active file scans to reduce TV load.
   */
  private startFunctionMonitoring(): void {
    interval(2000).subscribe(() => {
      // Lazy-load FileExplorationService on first use to avoid circular dependency
      if (!this.fileExplorationService) {
        this.fileExplorationService = this.injector.get(FileExplorationService);
      }

      // Skip function enumeration during active file scans to reduce TV load
      if (this.fileExplorationService.isScanActive()) {
        return;
      }

      this.loadFunctions();
    });
  }

  /**
   * Receive functions from TV and update state.
   * @param data Function data from TV including device info
   * @returns Observable of the HTTP response
   */
  public receiveFunctions(data: ApiResponse): Observable<unknown> {
    // Validate input
    if (!data) {
      const error = new Error('Invalid function data: missing data object');
      this.consoleService.error(
        'receiveFunctions: data is null or undefined',
        error,
        'TvFunction'
      );
      return new Observable((observer) => {
        observer.error(error);
      });
    }

    if (!data.functions || !Array.isArray(data.functions)) {
      const error = new Error(
        'Invalid function data: missing or invalid functions array'
      );
      this.consoleService.error(
        'receiveFunctions: functions is not an array',
        error,
        'TvFunction'
      );
      return new Observable((observer) => {
        observer.error(error);
      });
    }

    if (data.functions.length === 0) {
      const error = new Error('No functions to upload');
      this.consoleService.warn(
        'receiveFunctions: empty functions array',
        'TvFunction'
      );
      return new Observable((observer) => {
        observer.error(error);
      });
    }

    this.consoleService.info(
      `receiveFunctions: Starting upload of ${data.functions.length} functions`,
      'TvFunction'
    );

    return this.http.post('/api/functions', data).pipe(
      tap(() => {
        const functions = this.extractFunctions(data);
        this.functionsSubject.next(functions);
        this.saveFunctions(data);

        const deviceDetails = this.tvConnectionService.extractDeviceDetails(
          data.deviceInfo
        );
        this.tvConnectionService.updateTvConnection({
          connected: true,
          ...deviceDetails,
        });

        this.consoleService.info(
          `Received ${functions.length} functions from TV`,
          'TvFunction'
        );
      }),
      catchError((error) => {
        this.consoleService.error(
          'Failed to save functions to server',
          error,
          'TvFunction'
        );
        throw new Error(
          `Failed to save functions: ${error.message || 'Unknown error'}`
        );
      })
    );
  }

  /**
   * Load functions from server API.
   * Updates connection status based on data freshness.
   */
  private loadFunctions(): void {
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

            const deviceDetails = this.tvConnectionService.extractDeviceDetails(
              response.deviceInfo
            );
            this.tvConnectionService.updateTvConnection({
              connected: isConnected,
              ...deviceDetails,
            });
          }
        } else {
          const currentFunctions = this.functionsSubject.value;
          const currentConnection =
            this.tvConnectionService.getConnectionStatus();

          if (currentFunctions.length > 0) {
            this.functionsSubject.next([]);
          }

          if (currentConnection.connected && currentConnection.lastSeen) {
            const timeSinceLastSeen =
              new Date().getTime() - currentConnection.lastSeen.getTime();
            // TV sends keep-alive every 5 seconds, so disconnect after 10 seconds of silence
            if (timeSinceLastSeen > 10000) {
              this.tvConnectionService.updateTvConnection({
                connected: false,
              });
            }
          }
        }
      },
      error: () => {
        this.functionsSubject.next([]);
      },
    });
  }

  /**
   * Extract and normalize function data from API response.
   * @param data API response containing functions
   * @returns Array of normalized function data
   */
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

  /**
   * Save functions to server (creates function files in memory).
   * @param data API response containing functions
   */
  private saveFunctions(data: ApiResponse): void {
    // No localStorage - only create function files via API
    this.createFunctionFiles(data);
  }

  /**
   * Create function files on server via API.
   * @param data API response containing functions
   */
  private createFunctionFiles(data: ApiResponse): void {
    this.http.post('/api/functions', data).subscribe();
  }

  /**
   * Get functions list as observable.
   * @returns Observable of function array
   */
  public getFunctionsList(): Observable<FunctionData[]> {
    return this.functions$;
  }

  /**
   * Get current functions array (synchronous).
   * @returns Current function array
   */
  public getCurrentFunctions(): FunctionData[] {
    return this.functionsSubject.value;
  }

  /**
   * Save function files to /public directory.
   * @param files Array of files to save
   * @returns Observable with saved file names
   */
  public saveFilesToPublic(
    files: Array<{ filename: string; content: string }>
  ): Observable<{ saved: string[] }> {
    return this.http.post<{ saved: string[] }>('/api/save-to-public', {
      files,
    });
  }

  /**
   * Download file to user's computer.
   * @param filename Name of file to download
   * @param content File content
   */
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
}
