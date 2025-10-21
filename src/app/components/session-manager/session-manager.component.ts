import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ScanStorageService } from '../../services/scan-storage.service';
import { FileExplorationService } from '../../services/file-exploration.service';
import { ConsoleService } from '../../services/console.service';
import { SessionMetadata } from '../../models/session-storage.model';

@Component({
  selector: 'app-session-manager',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session-manager.component.html',
  styleUrls: ['./session-manager.component.css'],
})
export class SessionManagerComponent implements OnInit, OnDestroy {
  @Output() browse = new EventEmitter<string>(); // Emit sessionId to browse
  @Output() sessionResumed = new EventEmitter<string>(); // Emit sessionId when resumed
  @Output() sessionDeleted = new EventEmitter<string>(); // Emit sessionId when deleted
  sessions: SessionMetadata[] = [];
  loading = false;
  error: string | null = null;
  selectedSessionId: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private scanStorage: ScanStorageService,
    private fileExploration: FileExplorationService,
    private consoleService: ConsoleService
  ) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load all saved sessions from server
   */
  loadSessions(): void {
    this.loading = true;
    this.error = null;

    this.scanStorage
      .listSessions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions: SessionMetadata[]) => {
          this.sessions = sessions;
          this.loading = false;
          this.consoleService.info(
            `Loaded ${this.sessions.length} sessions`,
            'SessionManager'
          );
        },
        error: (err) => {
          this.error = 'Failed to load sessions';
          this.loading = false;
          this.consoleService.error(
            'Failed to load sessions',
            err,
            'SessionManager'
          );
        },
      });
  }

  /**
   * Select a session (highlights it)
   */
  selectSession(sessionId: string): void {
    this.selectedSessionId = sessionId;
  }

  /**
   * Resume scanning from a saved session
   */
  async resumeSession(sessionId: string): Promise<void> {
    try {
      this.loading = true;
      this.error = null;

      // Load session for resume
      await this.fileExploration.loadSessionForResume(sessionId);

      // Start scanning
      this.fileExploration.resumeExploration();

      // Emit event to parent component
      this.sessionResumed.emit(sessionId);

      this.consoleService.info(
        `Resumed session: ${sessionId}`,
        'SessionManager'
      );
      this.loading = false;
    } catch (err) {
      this.error = 'Failed to resume session';
      this.loading = false;
      this.consoleService.error(
        'Failed to resume session',
        err as Error,
        'SessionManager'
      );
    }
  }

  /**
   * Browse a completed session offline
   */
  browseSession(sessionId: string): void {
    this.consoleService.info(
      `Browsing session: ${sessionId}`,
      'SessionManager'
    );

    // Emit event to parent component (will be handled by File Explorer)
    this.browse.emit(sessionId);
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    if (!confirm(`Delete session ${sessionId}?`)) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.scanStorage
      .deleteSession(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.consoleService.info(
            `Deleted session: ${sessionId}`,
            'SessionManager'
          );

          // Emit event to parent component
          this.sessionDeleted.emit(sessionId);

          // Reload sessions
          this.loadSessions();
        },
        error: (err) => {
          this.error = 'Failed to delete session';
          this.loading = false;
          this.consoleService.error(
            'Failed to delete session',
            err,
            'SessionManager'
          );
        },
      });
  }

  /**
   * Export session as JSON
   */
  exportSession(sessionId: string): void {
    this.scanStorage
      .loadSession(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          const json = JSON.stringify(session, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${sessionId}.json`;
          a.click();
          URL.revokeObjectURL(url);

          this.consoleService.info(
            `Exported session: ${sessionId}`,
            'SessionManager'
          );
        },
        error: (err) => {
          this.error = 'Failed to export session';
          this.consoleService.error(
            'Failed to export session',
            err,
            'SessionManager'
          );
        },
      });
  }

  /**
   * Format timestamp for display
   */
  formatDate(timestamp: number): string {
    // timestamp is already a number (milliseconds since epoch)
    return new Date(timestamp).toLocaleString('de-DE');
  }

  /**
   * Format file size
   */
  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
