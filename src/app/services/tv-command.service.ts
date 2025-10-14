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
  private readonly MAX_CODE_LENGTH = 50000; // 50KB max for custom code

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
   * @throws Error if function name is empty or invalid
   */
  public executeFunction(
    functionName: string,
    parameters: Record<string, unknown> | unknown[] = {}
  ): Observable<unknown> {
    // Validate input
    if (!functionName || functionName.trim().length === 0) {
      this.consoleService.error(
        'Function name cannot be empty',
        new Error('Invalid function name'),
        'TvCommand'
      );
      return new Observable((observer) => {
        observer.error(new Error('Function name cannot be empty'));
      });
    }

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
          const errorMessage =
            error.name === 'TimeoutError'
              ? `Command timeout - Server did not respond within 30 seconds`
              : `Command execution failed: ${error.message || 'Unknown error'}`;

          this.consoleService.error(
            `executeFunction failed for '${functionName}'`,
            error,
            'TvCommand'
          );
          throw new Error(errorMessage);
        })
      );
  }

  /**
   * Execute custom JavaScript code on the TV.
   * Validates code length and provides detailed error messages.
   * @param jsCode JavaScript code to execute
   * @returns Observable with execution result
   * @throws Error if code is empty, too long, or execution fails
   */
  public executeCustomCode(jsCode: string): Observable<unknown> {
    // Validate input
    if (!jsCode || jsCode.trim().length === 0) {
      this.consoleService.error(
        'Custom code cannot be empty',
        new Error('Empty code'),
        'TvCommand'
      );
      return new Observable((observer) => {
        observer.error(new Error('Custom code cannot be empty'));
      });
    }

    if (jsCode.length > this.MAX_CODE_LENGTH) {
      const errorMsg = `Custom code exceeds maximum length of ${this.MAX_CODE_LENGTH} characters (current: ${jsCode.length})`;
      this.consoleService.error(errorMsg, new Error('Code too long'), 'TvCommand');
      return new Observable((observer) => {
        observer.error(new Error(errorMsg));
      });
    }

    this.consoleService.info(
      `Executing custom code (${jsCode.length} characters)`,
      'TvCommand'
    );

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
        const errorMessage =
          error.name === 'TimeoutError'
            ? `Custom code execution timeout - No response within ${this.CUSTOM_CODE_TIMEOUT / 1000} seconds`
            : `Custom code execution failed: ${error.message || 'Unknown error'}`;

        this.consoleService.error(
          'executeCustomCode failed',
          error,
          'TvCommand'
        );
        throw new Error(errorMessage);
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
      let pollCount = 0;
      const maxPolls = Math.ceil(timeoutDuration / this.POLL_INTERVAL);

      const timeoutHandle = setTimeout(() => {
        clearInterval(pollInterval);
        this.consoleService.warn(
          `Command ${commandId} timed out after ${pollCount} polls (${timeoutDuration}ms)`,
          'TvCommand'
        );
        observer.error(
          new Error(
            `Command timeout - no response received within ${
              timeoutDuration / 1000
            } seconds`
          )
        );
      }, timeoutDuration);

      const pollInterval = setInterval(() => {
        pollCount++;

        this.http
          .get<CommandResponse>(`/api/execute-response/${commandId}`)
          .subscribe({
            next: (response: CommandResponse) => {
              if (response.waiting) {
                // Log progress every 5 polls
                if (pollCount % 5 === 0) {
                  this.consoleService.debug(
                    `Still waiting for command ${commandId} (poll ${pollCount}/${maxPolls})`,
                    'TvCommand'
                  );
                }
                return; // Keep polling
              }

              clearTimeout(timeoutHandle);
              clearInterval(pollInterval);

              if (response.success) {
                this.consoleService.info(
                  `Command ${commandId} completed successfully after ${pollCount} polls`,
                  'TvCommand'
                );
                observer.next(response.data);
              } else {
                const errorMsg = response.error || 'Unknown error';
                this.consoleService.error(
                  `Command ${commandId} failed: ${errorMsg}`,
                  new Error(errorMsg),
                  'TvCommand'
                );
                observer.error(new Error(errorMsg));
              }
              observer.complete();
            },
            error: (error) => {
              clearTimeout(timeoutHandle);
              clearInterval(pollInterval);
              this.consoleService.error(
                `HTTP error while polling for command ${commandId}`,
                error,
                'TvCommand'
              );
              observer.error(
                new Error(
                  `Failed to poll for result: ${error.message || 'Network error'}`
                )
              );
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
