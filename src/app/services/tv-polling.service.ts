import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { ConsoleService } from './console.service';
import { FunctionResult } from './tv-command.service';

export interface RemoteCommand {
  id: string;
  function: string;
  parameters: unknown[];
  success: boolean;
  data: FunctionResult;
  error: string | null;
  timestamp: string;
}

export interface RemoteCommandCheck {
  hasCommand: boolean;
  command?: RemoteCommand;
}

export interface RemoteCommandBatchCheck {
  hasCommands: boolean;
  commands?: RemoteCommand[];
  remainingInQueue?: number;
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
 * Service for TV-side polling operations.
 * Used by TV to check for pending commands and send back results.
 * This is the counterpart to TvCommandService which sends commands.
 */
@Injectable({
  providedIn: 'root',
})
export class TvPollingService {
  constructor(
    private http: HttpClient,
    private consoleService: ConsoleService
  ) {}

  /**
   * Check for pending commands from server (called by TV).
   * TV polls this endpoint regularly to get commands to execute.
   * @returns Observable with command check result
   */
  public checkForCommands(): Observable<RemoteCommandCheck> {
    return new Observable((observer) => {
      this.http.get('/api/remote-command').subscribe({
        next: (data) => {
          observer.next(data as RemoteCommandCheck);
          observer.complete();
        },
        error: () => {
          this.consoleService.debug(
            'Command API not reachable (polling)',
            'TVPolling'
          );
          observer.next({ hasCommand: false });
          observer.complete();
        },
      });
    });
  }

  /**
   * Check for batch of pending commands from server (called by TV).
   * TV polls this endpoint to get multiple commands for parallel execution.
   * @param batchSize Number of commands to fetch (default: 10, max: 20)
   * @returns Observable with batch check result
   */
  public checkForCommandsBatch(
    batchSize = 10
  ): Observable<RemoteCommandBatchCheck> {
    return new Observable((observer) => {
      this.http
        .get(`/api/remote-command-batch?batchSize=${batchSize}`)
        .subscribe({
          next: (data) => {
            const result = data as RemoteCommandBatchCheck;
            if (result.hasCommands && result.commands) {
              this.consoleService.debug(
                `Fetched ${result.commands.length} commands (${result.remainingInQueue} remaining in queue)`,
                'TVPolling'
              );
            }
            observer.next(result);
            observer.complete();
          },
          error: () => {
            this.consoleService.debug(
              'Batch command API not reachable (polling)',
              'TVPolling'
            );
            observer.next({ hasCommands: false, commands: [] });
            observer.complete();
          },
        });
    });
  }

  /**
   * Receive command execution result from TV.
   * TV calls this to send back the result after executing a command.
   * @param commandId ID of executed command
   * @param result Execution result
   * @returns Observable of HTTP response
   */
  public receiveCommandResult(
    commandId: string,
    result: CommandResponse
  ): Observable<unknown> {
    // Validate input
    if (!commandId || commandId.trim().length === 0) {
      this.consoleService.error(
        'Command ID cannot be empty',
        new Error('Invalid commandId'),
        'TVPolling'
      );
      return new Observable((observer) => {
        observer.error(new Error('Command ID cannot be empty'));
      });
    }

    if (!result) {
      this.consoleService.error(
        'Result cannot be null',
        new Error('Invalid result'),
        'TVPolling'
      );
      return new Observable((observer) => {
        observer.error(new Error('Result cannot be null'));
      });
    }

    this.consoleService.info(
      `Sending result for command ${commandId} (success: ${result.success})`,
      'TVPolling'
    );

    return this.http.post('/api/execute-response', result).pipe(
      tap(() => {
        this.consoleService.debug(
          `Result for command ${commandId} sent successfully`,
          'TVPolling'
        );
      }),
      catchError((error) => {
        this.consoleService.error(
          `Failed to send result for command ${commandId}`,
          error as Error,
          'TVPolling'
        );
        throw new Error(
          `Failed to send command result: ${error.message || 'Unknown error'}`
        );
      })
    );
  }
}
