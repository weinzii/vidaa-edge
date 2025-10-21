/**
 * Models for scan session persistence in LocalStorage
 * Supports resume functionality and error recovery
 */

/**
 * Error types that can occur during scanning
 */
export type ErrorType =
  | 'timeout'
  | 'network'
  | 'api_failure'
  | 'tv_disconnected'
  | 'tv_overload'
  | 'unknown';

/**
 * Error information for a scan session
 */
export interface ErrorInfo {
  lastError: string;
  errorCount: number;
  consecutiveErrors: number;
  lastErrorTime: string; // ISO timestamp
  errorType: ErrorType;
  recommendation: string;
}

/**
 * Serialized file analysis (without content to save space)
 */
export interface SerializedFileAnalysis {
  path: string;
  status: 'success' | 'not-found' | 'error' | 'access-denied';
  size: number;
  isBinary: boolean;
  fileType: string;
  extractedPathsCount: number; // Just count, not actual paths
  generatedPathsCount?: number;
  discoveredFrom?: string;
  discoveryMethod: 'known-list' | 'extracted' | 'generated';
  timestamp: string; // ISO timestamp
  error?: string;
  isPlaceholder?: boolean; // Track if this is a placeholder for deferred path
}

/**
 * Serialized variable value
 */
export interface SerializedVariableValue {
  name: string;
  value: string;
  discoveredIn: string;
  confidence: 'explicit' | 'inferred' | 'conditional';
}

/**
 * Serialized variable map
 */
export interface SerializedVariableMap {
  [varName: string]: SerializedVariableValue[];
}

/**
 * Deferred path waiting for variable resolution
 */
export interface DeferredPath {
  template: string;
  variables: string[];
  discoveredIn: string;
  priority: number;
}

/**
 * Discovery method statistics
 */
export interface DiscoveryStats {
  knownListCount: number;
  extractedCount: number;
  generatedCount: number;
}

/**
 * Persisted scan session (stored in LocalStorage)
 * Optimized for storage space - no file content, minimal data
 */
export interface PersistedScanSession {
  // Schema version for migration
  version: string; // e.g., "1.0.0"

  // Session Metadata
  sessionId: string;
  startTime: string; // ISO timestamp
  lastSaveTime: string; // ISO timestamp
  status: 'running' | 'paused' | 'error' | 'completed';

  // Progress Tracking
  totalPaths: number;
  scannedPaths: number;
  successfulReads: number;
  failedReads: number;
  binaryFiles: number;
  textFiles: number;

  // Queue State (CRITICAL for Resume!)
  queue: string[]; // Pending paths to scan
  scanned: string[]; // Already scanned paths (Set → Array for JSON)

  // Results (minimal - no content!)
  results: SerializedFileAnalysis[];

  // Variable Tracking
  variables: SerializedVariableMap;
  deferredPaths: DeferredPath[];

  // Error State
  errorInfo?: ErrorInfo;

  // Discovery Method Breakdown
  discoveryStats: DiscoveryStats;
}

/**
 * Error analysis result
 */
export interface ErrorAnalysis {
  type: ErrorType;
  shouldPause: boolean; // Should we auto-pause the scan?
  consecutiveCount: number;
  errorRate: number; // Errors per second
  recommendation: string;
}

/**
 * Error event for tracking
 */
export interface ErrorEvent {
  type: ErrorType;
  timestamp: number;
  message: string;
}

/**
 * Resume dialog data
 */
export interface ResumeDialogData {
  sessionId: string;
  startTime: Date;
  lastSaveTime: Date;
  progress: {
    scanned: number;
    total: number;
    percentage: number;
  };
  status: string;
  lastError?: string;
  recommendation?: string;
  statistics: {
    success: number;
    failed: number;
    queued: number;
    binary: number;
    text: number;
  };
  discoveryStats: DiscoveryStats;
}

/**
 * LocalStorage key constants
 */
export const STORAGE_KEYS = {
  SCAN_SESSION: 'vidaa-edge-scan-session',
  SESSION_VERSION: '1.0.0',
} as const;

/**
 * Configuration constants
 */
export const SCAN_PERSISTENCE_CONFIG = {
  // Auto-save interval (milliseconds)
  AUTO_SAVE_INTERVAL: 30000, // 30 seconds

  // Save throttle (min time between saves)
  SAVE_THROTTLE_MS: 5000, // 5 seconds

  // Save every N files scanned
  SAVE_EVERY_N_FILES: 50,

  // Error detection
  ERROR_THRESHOLD: 3, // Consecutive errors to trigger auto-pause
  ERROR_WINDOW: 60000, // 60 seconds error window

  // Storage limits
  MAX_STORAGE_SIZE_KB: 4000, // 4 MB max (leave buffer for other data)

  // Session expiry
  SESSION_EXPIRY_HOURS: 24, // Discard sessions older than 24 hours
} as const;
