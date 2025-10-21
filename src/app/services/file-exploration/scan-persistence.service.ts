import { Injectable } from '@angular/core';
import { ConsoleService } from '../console.service';
import {
  ExplorationSession,
  FileAnalysis,
} from '../../models/file-exploration';
import { VariableValue } from './variable-resolver.service';
import {
  PersistedScanSession,
  SerializedFileAnalysis,
  SerializedVariableMap,
  SerializedVariableValue,
  STORAGE_KEYS,
  SCAN_PERSISTENCE_CONFIG,
  ResumeDialogData,
  ErrorInfo,
} from '../../models/scan-persistence.model';

/**
 * Service for persisting scan sessions to LocalStorage
 * Supports resume functionality after browser reload or errors
 */
@Injectable({
  providedIn: 'root',
})
export class ScanPersistenceService {
  private lastSaveTime = 0;
  private pendingSave = false;
  private saveTimeoutHandle?: number;

  constructor(private consoleService: ConsoleService) {}

  /**
   * Save session to LocalStorage (throttled)
   */
  public scheduleSave(session: ExplorationSession): void {
    const now = Date.now();

    if (now - this.lastSaveTime < SCAN_PERSISTENCE_CONFIG.SAVE_THROTTLE_MS) {
      // Too soon, schedule for later
      if (!this.pendingSave) {
        this.pendingSave = true;
        this.saveTimeoutHandle = window.setTimeout(() => {
          this.saveSession(session);
          this.pendingSave = false;
        }, SCAN_PERSISTENCE_CONFIG.SAVE_THROTTLE_MS);
      }
      return;
    }

    this.saveSession(session);
  }

  /**
   * Save session immediately
   */
  public saveSession(session: ExplorationSession, errorInfo?: ErrorInfo): void {
    try {
      const persisted = this.serializeSession(session, errorInfo);
      const json = JSON.stringify(persisted);

      // Check size
      const sizeKB = new Blob([json]).size / 1024;

      if (sizeKB > SCAN_PERSISTENCE_CONFIG.MAX_STORAGE_SIZE_KB) {
        this.consoleService.warn(
          `Session too large (${Math.round(
            sizeKB
          )} KB), using minimal storage mode`,
          'ScanPersistence'
        );
        // TODO: Implement minimal storage mode
        return;
      }

      localStorage.setItem(STORAGE_KEYS.SCAN_SESSION, json);
      this.lastSaveTime = Date.now();

      this.consoleService.debug(
        `Session saved (${Math.round(sizeKB)} KB, ${
          persisted.results.length
        } results)`,
        'ScanPersistence'
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.consoleService.error(
          'LocalStorage quota exceeded! Cannot save session.',
          error,
          'ScanPersistence'
        );
      } else {
        this.consoleService.error(
          'Failed to save session',
          error as Error,
          'ScanPersistence'
        );
      }
    }
  }

  /**
   * Load session from LocalStorage
   */
  public loadSession(): PersistedScanSession | null {
    try {
      const json = localStorage.getItem(STORAGE_KEYS.SCAN_SESSION);
      if (!json) {
        return null;
      }

      const persisted: PersistedScanSession = JSON.parse(json);

      // Validate version
      if (persisted.version !== STORAGE_KEYS.SESSION_VERSION) {
        this.consoleService.warn(
          `Session version mismatch (${persisted.version} vs ${STORAGE_KEYS.SESSION_VERSION}), attempting migration...`,
          'ScanPersistence'
        );
        // TODO: Implement version migration
        return null;
      }

      // Check if session is expired
      const lastSave = new Date(persisted.lastSaveTime);
      const ageHours = (Date.now() - lastSave.getTime()) / (1000 * 60 * 60);

      if (ageHours > SCAN_PERSISTENCE_CONFIG.SESSION_EXPIRY_HOURS) {
        this.consoleService.info(
          `Session expired (${Math.round(ageHours)} hours old), discarding`,
          'ScanPersistence'
        );
        this.clearSession();
        return null;
      }

      this.consoleService.info(
        `Session loaded (${persisted.results.length} results, ${persisted.queue.length} queued)`,
        'ScanPersistence'
      );

      return persisted;
    } catch (error) {
      this.consoleService.error(
        'Failed to load session (corrupted?)',
        error as Error,
        'ScanPersistence'
      );
      this.clearSession(); // Clear corrupted session
      return null;
    }
  }

  /**
   * Clear session from LocalStorage
   */
  public clearSession(): void {
    localStorage.removeItem(STORAGE_KEYS.SCAN_SESSION);
    this.consoleService.debug('Session cleared', 'ScanPersistence');
  }

  /**
   * Get resume dialog data if session exists
   */
  public getResumeDialogData(): ResumeDialogData | null {
    const persisted = this.loadSession();
    if (!persisted) {
      return null;
    }

    const percentage =
      persisted.totalPaths > 0
        ? Math.round((persisted.scannedPaths / persisted.totalPaths) * 100)
        : 0;

    return {
      sessionId: persisted.sessionId,
      startTime: new Date(persisted.startTime),
      lastSaveTime: new Date(persisted.lastSaveTime),
      status: persisted.status,
      progress: {
        scanned: persisted.scannedPaths,
        total: persisted.totalPaths,
        percentage,
      },
      lastError: persisted.errorInfo?.lastError,
      recommendation: persisted.errorInfo?.recommendation,
      statistics: {
        success: persisted.successfulReads,
        failed: persisted.failedReads,
        queued: persisted.queue.length,
        binary: persisted.binaryFiles,
        text: persisted.textFiles,
      },
      discoveryStats: persisted.discoveryStats,
    };
  }

  /**
   * Cancel pending save
   */
  public cancelPendingSave(): void {
    if (this.saveTimeoutHandle) {
      window.clearTimeout(this.saveTimeoutHandle);
      this.pendingSave = false;
    }
  }

  /**
   * Convert ExplorationSession to PersistedScanSession
   */
  private serializeSession(
    session: ExplorationSession,
    errorInfo?: ErrorInfo
  ): PersistedScanSession {
    // Serialize results (exclude content to save space)
    const results: SerializedFileAnalysis[] = [];
    for (const [, analysis] of session.results.entries()) {
      results.push(this.serializeFileAnalysis(analysis));
    }

    // Serialize variables
    const variables: SerializedVariableMap = {};
    if (session.variables) {
      for (const [varName, values] of session.variables.entries()) {
        variables[varName] = values.map(this.serializeVariableValue);
      }
    }

    // Count discovery methods
    const discoveryStats = {
      knownListCount: results.filter((r) => r.discoveryMethod === 'known-list')
        .length,
      extractedCount: results.filter((r) => r.discoveryMethod === 'extracted')
        .length,
      generatedCount: results.filter((r) => r.discoveryMethod === 'generated')
        .length,
    };

    return {
      version: STORAGE_KEYS.SESSION_VERSION,
      sessionId: session.id,
      startTime: session.startTime.toISOString(),
      lastSaveTime: new Date().toISOString(),
      status: session.status,
      totalPaths: session.totalPaths,
      scannedPaths: session.scannedPaths,
      successfulReads: session.successfulReads,
      failedReads: session.failedReads,
      binaryFiles: session.binaryFiles,
      textFiles: session.textFiles,
      queue: session.queue,
      scanned: Array.from(session.scanned),
      results,
      variables,
      deferredPaths: session.deferredPaths || [],
      discoveryStats,
      errorInfo, // Include error info if provided
    };
  }

  /**
   * Serialize FileAnalysis (exclude content)
   */
  private serializeFileAnalysis(
    analysis: FileAnalysis
  ): SerializedFileAnalysis {
    return {
      path: analysis.path,
      status: analysis.status,
      size: analysis.size,
      isBinary: analysis.isBinary,
      fileType: analysis.fileType,
      extractedPathsCount: analysis.extractedPaths.length,
      generatedPathsCount: analysis.generatedPaths?.length,
      discoveredFrom: analysis.discoveredFrom,
      discoveryMethod: analysis.discoveryMethod,
      timestamp: analysis.timestamp.toISOString(),
      error: analysis.error,
      isPlaceholder: analysis.isPlaceholder, // Preserve placeholder flag
    };
  }

  /**
   * Serialize VariableValue
   */
  private serializeVariableValue(
    value: VariableValue
  ): SerializedVariableValue {
    return {
      name: value.name,
      value: value.value,
      discoveredIn: value.discoveredIn,
      confidence: value.confidence,
    };
  }

  /**
   * Convert PersistedScanSession to ExplorationSession
   * (Used for resume functionality)
   */
  public deserializeSession(
    persisted: PersistedScanSession
  ): ExplorationSession {
    // Reconstruct results Map (without content)
    const results = new Map<string, FileAnalysis>();
    for (const serialized of persisted.results) {
      results.set(serialized.path, this.deserializeFileAnalysis(serialized));
    }

    // Reconstruct variables Map
    const variables = new Map<string, VariableValue[]>();
    for (const [varName, values] of Object.entries(persisted.variables)) {
      variables.set(varName, values.map(this.deserializeVariableValue));
    }

    return {
      id: persisted.sessionId,
      startTime: new Date(persisted.startTime),
      endTime: persisted.status === 'completed' ? new Date() : undefined,
      status: persisted.status,
      totalPaths: persisted.totalPaths,
      scannedPaths: persisted.scannedPaths,
      successfulReads: persisted.successfulReads,
      failedReads: persisted.failedReads,
      binaryFiles: persisted.binaryFiles,
      textFiles: persisted.textFiles,
      results,
      queue: persisted.queue,
      scanned: new Set(persisted.scanned),
      variables,
      deferredPaths: persisted.deferredPaths,
    };
  }

  /**
   * Deserialize FileAnalysis (reconstruct without content)
   */
  private deserializeFileAnalysis(
    serialized: SerializedFileAnalysis
  ): FileAnalysis {
    return {
      path: serialized.path,
      status: serialized.status,
      size: serialized.size,
      isBinary: serialized.isBinary,
      fileType: serialized.fileType,
      confidence: 0,
      extractedPaths: [], // Will be empty for resumed sessions
      generatedPaths:
        serialized.generatedPathsCount && serialized.generatedPathsCount > 0
          ? []
          : undefined,
      discoveredFrom: serialized.discoveredFrom,
      discoveryMethod: serialized.discoveryMethod,
      timestamp: new Date(serialized.timestamp),
      error: serialized.error,
      isPlaceholder: serialized.isPlaceholder, // Restore placeholder flag
      // Note: content is NOT restored (too large)
    };
  }

  /**
   * Deserialize VariableValue
   */
  private deserializeVariableValue(
    serialized: SerializedVariableValue
  ): VariableValue {
    return {
      name: serialized.name,
      value: serialized.value,
      discoveredIn: serialized.discoveredIn,
      confidence: serialized.confidence,
    };
  }

  /**
   * Prepare data for resume dialog
   */
  public prepareResumeDialogData(
    persisted: PersistedScanSession
  ): ResumeDialogData {
    const percentage =
      persisted.totalPaths > 0
        ? Math.round((persisted.scannedPaths / persisted.totalPaths) * 100)
        : 0;

    return {
      sessionId: persisted.sessionId,
      startTime: new Date(persisted.startTime),
      lastSaveTime: new Date(persisted.lastSaveTime),
      progress: {
        scanned: persisted.scannedPaths,
        total: persisted.totalPaths,
        percentage,
      },
      status: persisted.status,
      lastError: persisted.errorInfo?.lastError,
      recommendation: persisted.errorInfo?.recommendation,
      statistics: {
        success: persisted.successfulReads,
        failed: persisted.failedReads,
        queued: persisted.queue.length,
        binary: persisted.binaryFiles,
        text: persisted.textFiles,
      },
      discoveryStats: persisted.discoveryStats,
    };
  }

  /**
   * Check if there's a resumable session
   */
  public hasResumableSession(): boolean {
    const session = this.loadSession();
    return (
      session !== null &&
      session.status !== 'completed' &&
      session.queue.length > 0
    );
  }
}
