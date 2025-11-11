import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ConsoleService } from './console.service';
import {
  SessionMetadata,
  LoadedSession,
  ResumeData,
  SaveSessionRequest,
  SaveSessionResponse,
  MergeAction,
} from '../models/session-storage.model';
import { FileAnalysis, ExplorationSession } from '../models/file-exploration';
import {
  VariableValue,
  DeferredPath,
} from './file-exploration/variable-resolver.service';

/**
 * Service for persisting scan sessions to dev-server
 * Manages session storage, loading, and merging
 */
@Injectable({
  providedIn: 'root',
})
export class ScanStorageService {
  private readonly baseUrl = '/api/scan/session';

  constructor(
    private http: HttpClient,
    private consoleService: ConsoleService
  ) {}

  /**
   * Save or merge a scan session
   * @param sessionId - Unique session identifier
   * @param action - 'create', 'merge', or 'overwrite'
   * @param data - Scan data to save
   * @param runId - Optional run ID for tracking
   */
  saveSession(
    sessionId: string,
    action: MergeAction,
    data: {
      results: FileAnalysis[];
      session: ExplorationSession;
      variables: Record<string, VariableValue[]>; // Changed: Array of values
      deferredPaths?: DeferredPath[]; // Changed: Full DeferredPath objects
    },
    runId?: number
  ): Observable<SaveSessionResponse> {
    const request: SaveSessionRequest = {
      sessionId,
      action,
      runId,
      data,
    };

    this.consoleService.debug(
      `Saving session: ${sessionId} (action: ${action}, files: ${data.results.length})`,
      'ScanStorage'
    );

    return this.http
      .post<SaveSessionResponse>(`${this.baseUrl}/save`, request)
      .pipe(
        map((response) => {
          this.consoleService.info(
            `Session saved: ${response.totalFiles} files (${response.newFiles} new)`,
            'ScanStorage'
          );
          return response;
        }),
        catchError((error) => this.handleError('saveSession', error))
      );
  }

  /**
   * List all saved sessions
   */
  listSessions(): Observable<SessionMetadata[]> {
    this.consoleService.debug('Loading session list', 'ScanStorage');

    return this.http.get<SessionMetadata[]>(`${this.baseUrl}s`).pipe(
      map((sessions) => {
        this.consoleService.debug(
          `Found ${sessions.length} sessions`,
          'ScanStorage'
        );
        return sessions;
      }),
      catchError((error) => this.handleError('listSessions', error))
    );
  }

  /**
   * Private helper: Get session data from server
   * @param sessionId - Session ID
   * @param endpoint - Endpoint ('load' or 'resume')
   */
  private getSessionData<T>(
    sessionId: string,
    endpoint: 'load' | 'resume'
  ): Observable<T> {
    return this.http
      .get<T>(`${this.baseUrl}/${endpoint}/${sessionId}`)
      .pipe(
        catchError((error) => this.handleError(`${endpoint}Session`, error))
      );
  }

  /**
   * Load a complete session for browsing
   * @param sessionId - Session to load
   */
  loadSession(sessionId: string): Observable<LoadedSession> {
    this.consoleService.debug(`Loading session: ${sessionId}`, 'ScanStorage');

    return this.getSessionData<LoadedSession>(sessionId, 'load').pipe(
      map((session) => {
        this.consoleService.info(
          `Session loaded: ${session.metadata.totalFiles} files, ${session.metadata.totalRuns} runs`,
          'ScanStorage'
        );
        return session;
      })
    );
  }

  /**
   * Get resume data for continuing a paused scan
   * @param sessionId - Session to resume
   */
  resumeSession(sessionId: string): Observable<ResumeData> {
    this.consoleService.debug(
      `Loading resume data: ${sessionId}`,
      'ScanStorage'
    );

    return this.getSessionData<ResumeData>(sessionId, 'resume').pipe(
      map((data) => {
        this.consoleService.info(
          `Resume data loaded: Run #${data.nextRunId}, Queue: ${
            data.session.queue?.length || 0
          } items`,
          'ScanStorage'
        );
        return data;
      })
    );
  }

  /**
   * Delete a session
   * @param sessionId - Session to delete
   */
  deleteSession(sessionId: string): Observable<void> {
    this.consoleService.debug(`Deleting session: ${sessionId}`, 'ScanStorage');

    return this.http
      .delete<{ success: boolean }>(`${this.baseUrl}/delete/${sessionId}`)
      .pipe(
        map(() => {
          this.consoleService.info(
            `Session deleted: ${sessionId}`,
            'ScanStorage'
          );
        }),
        catchError((error) => this.handleError('deleteSession', error))
      );
  }

  /**
   * Generate a default session name
   * Format: scan_YYYY-MM-DD_HH-mm-ss
   */
  generateSessionName(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `scan_${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  }

  /**
   * Sanitize session name (remove invalid characters)
   */
  sanitizeSessionName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * Calculate estimated session size (rough estimate)
   * @param results - File analysis results
   */
  calculateSessionSize(results: FileAnalysis[]): string {
    let totalBytes = 0;

    results.forEach((result) => {
      // Estimate: path + content + metadata
      totalBytes += result.path.length;
      totalBytes += result.content?.length || 0;
      totalBytes += result.error?.length || 0;
      totalBytes += JSON.stringify(result.extractedPaths || []).length;
      totalBytes += 500; // Metadata overhead per file
    });

    return this.formatBytes(totalBytes);
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Validate session data before saving
   * @param data - Data to validate
   */
  validateSessionData(data: {
    results: FileAnalysis[];
    session: ExplorationSession;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.results || data.results.length === 0) {
      errors.push('No results to save');
    }

    if (!data.session) {
      errors.push('Session data is missing');
    }

    if (data.results && data.results.length > 10000) {
      errors.push(
        `Too many results (${data.results.length}). Consider splitting into multiple sessions.`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Handle HTTP errors
   */
  private handleError(
    operation: string,
    error: HttpErrorResponse
  ): Observable<never> {
    let errorMessage = `${operation} failed: `;

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage += error.error.message;
    } else {
      // Server-side error
      errorMessage += `Status ${error.status}: ${
        error.error?.error || error.message
      }`;
    }

    this.consoleService.error(errorMessage, error, 'ScanStorage');
    return throwError(() => new Error(errorMessage));
  }
}
