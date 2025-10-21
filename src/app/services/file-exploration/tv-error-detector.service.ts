import { Injectable } from '@angular/core';
import { ConsoleService } from '../console.service';
import {
  ErrorType,
  ErrorAnalysis,
  ErrorEvent,
  ErrorInfo,
  ERROR_DETECTION_CONFIG,
} from '../../models/session-storage.model';

/**
 * Service for detecting and analyzing TV API errors
 * Determines when to auto-pause scan and provides recommendations
 */
@Injectable({
  providedIn: 'root',
})
export class TvErrorDetectorService {
  private errorHistory: ErrorEvent[] = [];
  private totalErrorCount = 0;
  private consecutiveErrorCount = 0;

  constructor(private consoleService: ConsoleService) {}

  /**
   * Analyze an error and determine action
   */
  public analyzeError(error: Error): ErrorAnalysis {
    const errorType = this.classifyError(error);

    // Add to history with fallback message
    this.errorHistory.push({
      type: errorType,
      timestamp: Date.now(),
      message: error.message || 'Unknown error occurred',
    });

    this.totalErrorCount++;
    this.consecutiveErrorCount++;

    // Clean old errors (outside window)
    this.cleanOldErrors();

    // Calculate error rate
    const errorRate =
      this.errorHistory.length / (ERROR_DETECTION_CONFIG.ERROR_WINDOW / 1000);

    // Determine if we should pause
    const shouldPause =
      this.consecutiveErrorCount >= ERROR_DETECTION_CONFIG.ERROR_THRESHOLD;

    // Get recommendation
    const recommendation = this.getRecommendation(
      errorType,
      this.consecutiveErrorCount
    );

    const analysis: ErrorAnalysis = {
      type: errorType,
      shouldPause,
      consecutiveCount: this.consecutiveErrorCount,
      errorRate,
      recommendation,
    };

    if (shouldPause) {
      this.consoleService.warn(
        `🔴 Auto-pause triggered: ${this.consecutiveErrorCount} consecutive ${errorType} errors. ${recommendation}`,
        'TvErrorDetector'
      );
    } else {
      this.consoleService.warn(
        `⚠️ Error detected (${this.consecutiveErrorCount} consecutive): ${recommendation}`,
        'TvErrorDetector'
      );
    }

    return analysis;
  }

  /**
   * Reset consecutive error count (call on successful operation)
   */
  public resetConsecutiveErrors(): void {
    if (this.consecutiveErrorCount > 0) {
      this.consoleService.debug(
        `✅ Consecutive errors reset (was ${this.consecutiveErrorCount})`,
        'TvErrorDetector'
      );
      this.consecutiveErrorCount = 0;
    }
  }

  /**
   * Get current error info for persistence
   */
  public getErrorInfo(): ErrorInfo | undefined {
    if (this.errorHistory.length === 0) {
      return undefined;
    }

    const lastError = this.errorHistory[this.errorHistory.length - 1];

    return {
      lastError: lastError.message,
      errorCount: this.totalErrorCount,
      consecutiveErrors: this.consecutiveErrorCount,
      lastErrorTime: new Date(lastError.timestamp).toISOString(),
      errorType: lastError.type,
      recommendation: this.getRecommendation(
        lastError.type,
        this.consecutiveErrorCount
      ),
    };
  }

  /**
   * Clear error history
   */
  public clearHistory(): void {
    this.errorHistory = [];
    this.totalErrorCount = 0;
    this.consecutiveErrorCount = 0;
    this.consoleService.debug('Error history cleared', 'TvErrorDetector');
  }

  /**
   * Classify error by type
   */
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();

    // In practice, we only get timeout errors from TV API
    if (message.includes('timeout')) {
      return 'timeout';
    }

    // Fallback for any other errors (rarely happens)
    return 'unknown';
  }

  /**
   * Get recommendation based on error type and count
   */
  private getRecommendation(type: ErrorType, count: number): string {
    // Main case: timeout errors (only type we actually get)
    if (type === 'timeout') {
      if (count >= 3) {
        return 'Multiple timeouts detected. Hisense service crashed/memleaked? Restart TV / clear cache.';
      }
      return 'TV response timeout. Check if TV is powered on and not busy. Wait and retry.';
    }

    // Fallback for any other error types (rarely happens)
    if (count >= 5) {
      return 'Too many errors detected. Try restarting TV or clearing cache.';
    }

    return 'Check TV connection and retry. If issue persists, restart the scan.';
  }

  /**
   * Clean errors outside the time window
   */
  private cleanOldErrors(): void {
    const cutoff = Date.now() - ERROR_DETECTION_CONFIG.ERROR_WINDOW;
    const oldLength = this.errorHistory.length;

    this.errorHistory = this.errorHistory.filter((e) => e.timestamp >= cutoff);

    if (oldLength !== this.errorHistory.length) {
      this.consoleService.debug(
        `Cleaned ${oldLength - this.errorHistory.length} old errors`,
        'TvErrorDetector'
      );
    }
  }

  /**
   * Get error statistics
   */
  public getStatistics(): {
    totalErrors: number;
    consecutiveErrors: number;
    recentErrors: number;
    errorRate: number;
  } {
    this.cleanOldErrors();

    return {
      totalErrors: this.totalErrorCount,
      consecutiveErrors: this.consecutiveErrorCount,
      recentErrors: this.errorHistory.length,
      errorRate:
        this.errorHistory.length / (ERROR_DETECTION_CONFIG.ERROR_WINDOW / 1000),
    };
  }
}
