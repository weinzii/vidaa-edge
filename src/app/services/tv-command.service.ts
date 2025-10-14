import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { switchMap, timeout, catchError } from 'rxjs/operators';
import { ConsoleService } from './console.service';

// Type alias for function execution results
export type FunctionResult =
  | string
  | number
  | boolean
  | null
  | undefined
  | object
  | FunctionResult[];

export interface CommandQueueItem {
  id: string;
  function: string;
  parameters?: Record<string, unknown> | unknown[];
  timestamp: Date;
  status: 'pending' | 'sent' | 'completed' | 'timeout';
  result?: FunctionResult;
}

export interface CommandResponse {
  commandId: string;
  success?: boolean;
  waiting?: boolean;
  data?: FunctionResult;
  error?: string | null;
  function?: string;
}

/**
 * Service for executing commands on TV and managing command queue.
 * Handles both regular function execution and custom code execution.
 */
@Injectable({
  providedIn: 'root',
})
export class TvCommandService {
  private readonly COMMAND_TIMEOUT = 10000; // 10 seconds
  private readonly CUSTOM_CODE_TIMEOUT = 30000; // 30 seconds
  private readonly POLL_INTERVAL = 1000; // 1 second (optimized from 500ms)

  private commandQueueSubject = new BehaviorSubject<CommandQueueItem[]>([]);
  public commandQueue$ = this.commandQueueSubject.asObservable();

  constructor(
    private http: HttpClient,
    private consoleService: ConsoleService
  ) {}

  /**
   * Execute a function on the TV remotely.
   * Sends command to server and polls for result.
   * @param functionName Name of function to execute
   * @param parameters Function parameters
   * @returns Observable with execution result
   */
  public executeFunction(
    functionName: string,
    parameters: Record<string, unknown> | unknown[] = {}
  ): Observable<unknown> {
    const commandId = Date.now().toString();

    return this.http
      .post<CommandResponse>('/api/remote-command', {
        id: commandId,
        function: functionName,
        parameters: parameters,
      })
      .pipe(
        timeout(30000),
        switchMap((response: CommandResponse) =>
          this.pollForResult(response.commandId)
        ),
        catchError((error) => {
          throw error;
        })
      );
  }

  /**
   * Execute custom JavaScript code on the TV.
   * @param jsCode JavaScript code to execute
   * @returns Observable with execution result
   */
  public executeCustomCode(jsCode: string): Observable<unknown> {
    const commandId = Date.now().toString();

    const customCommand = {
      id: commandId,
      function: '__CUSTOM_CODE__',
      parameters: [jsCode],
      timestamp: new Date().toISOString(),
    };

    return this.http.post('/api/remote-command', customCommand).pipe(
      switchMap(() => this.pollForResult(commandId, this.CUSTOM_CODE_TIMEOUT)),
      catchError((error) => {
        throw error;
      })
    );
  }

  /**
   * Poll for command execution result.
   * Checks every second until result is available or timeout occurs.
   * @param commandId ID of command to poll for
   * @param timeoutMs Timeout in milliseconds (optional)
   * @returns Observable with command result
   */
  private pollForResult(
    commandId: string,
    timeoutMs?: number
  ): Observable<unknown> {
    const timeoutDuration = timeoutMs || this.COMMAND_TIMEOUT;

    return new Observable((observer) => {
      const timeoutHandle = setTimeout(() => {
        clearInterval(pollInterval);
        observer.error(
          new Error(
            `Command timeout - no response received within ${
              timeoutDuration / 1000
            } seconds`
          )
        );
      }, timeoutDuration);

      const pollInterval = setInterval(() => {
        this.http
          .get<CommandResponse>(`/api/execute-response/${commandId}`)
          .subscribe({
            next: (response: CommandResponse) => {
              if (response.waiting) {
                return; // Keep polling
              }

              clearTimeout(timeoutHandle);
              clearInterval(pollInterval);

              if (response.success) {
                observer.next(response.data);
              } else {
                observer.error(new Error(response.error || 'Unknown error'));
              }
              observer.complete();
            },
            error: (error) => {
              clearTimeout(timeoutHandle);
              clearInterval(pollInterval);
              observer.error(error);
            },
          });
      }, this.POLL_INTERVAL);
    });
  }

  /**
   * Get current command queue status.
   * @returns Observable with queue statistics
   */
  public getStatus(): Observable<{
    commandQueue: { total: number; pending: number; completed: number };
  }> {
    const queue = this.commandQueueSubject.value;

    return new Observable((observer) => {
      observer.next({
        commandQueue: {
          total: queue.length,
          pending: queue.filter((cmd) => cmd.status === 'pending').length,
          completed: queue.filter((cmd) => cmd.status === 'completed').length,
        },
      });
      observer.complete();
    });
  }

  /**
   * Clear completed commands from queue.
   */
  public clearCompletedCommands(): void {
    const currentQueue = this.commandQueueSubject.value;
    const activeQueue = currentQueue.filter(
      (cmd) => cmd.status === 'pending' || cmd.status === 'sent'
    );
    this.commandQueueSubject.next(activeQueue);
  }

  /**
   * Clear all commands from queue.
   */
  public clearAllCommands(): void {
    this.commandQueueSubject.next([]);
  }
}
