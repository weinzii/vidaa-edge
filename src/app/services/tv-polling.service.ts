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
