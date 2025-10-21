/**
 * Models for Session Persistence and Storage
 * Used for saving/loading scan sessions with full content
 */

import {
  FileAnalysis,
  ExplorationSession,
  ScanHistoryEntry,
} from './file-exploration';
import {
  VariableValue,
  DeferredPath,
} from '../services/file-exploration/variable-resolver.service';

/**
 * Session status types
 */
export type SessionStatus =
  | 'active' // Scan is currently running (new sessions)
  | 'running' // Scan is currently running (legacy sessions)
  | 'paused' // Scan paused, can be resumed
  | 'completed' // Scan finished successfully
  | 'error' // Scan stopped due to error
  | 'archived' // Read-only snapshot
  | 'browse-mode'; // Loaded for browsing only

/**
 * Merge action for saving sessions
 */
export type MergeAction =
  | 'create' // Create new session
  | 'merge' // Merge with existing session
  | 'overwrite'; // Overwrite existing session

/**
 * Information about a single scan run
 */
export interface SessionRunInfo {
  runId: number;
  timestamp: number;
  filesScanned: number;
  duration: number; // milliseconds
  status: 'active' | 'paused' | 'completed' | 'error';
  errorCount?: number;
}

/**
 * Session metadata for UI display
 */
export interface SessionMetadata {
  sessionId: string;
  name: string;
  description?: string;
  status: SessionStatus;

  // Statistics
  totalRuns: number;
  totalFiles: number;
  successCount: number;
  failedCount: number;
  textCount: number;
  binaryCount: number;
  scanDuration: number; // Total duration across all runs

  // Context
  tvIp: string;
  size: string; // Human-readable size (e.g., "45.2 MB")

  // Timestamps
  created?: number;
  lastModified: number;

  // Capabilities
  canResume: boolean;
  canBrowse: boolean;
  isReadOnly?: boolean;
}

/**
 * Complete session data stored on disk
 */
export interface StoredScanSession {
  sessionId: string;
  version: string; // Schema version (e.g., "1.0.0")
  created: number;
  lastModified: number;

  // Metadata for UI listing
  metadata: SessionMetadata;

  // Run history
  runs: SessionRunInfo[];

  // Complete scan data
  data: {
    // All file analysis results (WITH CONTENT!)
    results: FileAnalysis[];

    // Session state (for resume)
    session: ExplorationSession;

    // Variable resolver state
    variables: Record<string, VariableValue>;

    // Deferred paths (templates not yet resolved)
    deferredPaths: string[];

    // Optional: Pre-built tree cache for fast loading
    treeCache?: {
      nodes: Record<string, unknown>[]; // TreeNode[] - avoiding circular import
      lastBuilt: number;
    };
  };
}

/**
 * Loaded session data (from API)
 */
export interface LoadedSession {
  sessionId: string;
  metadata: SessionMetadata;
  data: {
    results: FileAnalysis[];
    session: ExplorationSession;
    variables: Record<string, VariableValue[]>;
    deferredPaths: DeferredPath[];
    treeCache?: {
      nodes: Record<string, unknown>[];
      lastBuilt: number;
    };
  };
}

/**
 * Resume data for continuing a paused scan
 */
export interface ResumeData {
  sessionId: string;
  session: ExplorationSession;
  results: FileAnalysis[]; // ✅ Include results for resume (sent by backend)
  variables: Record<string, VariableValue[]>; // Changed: Array of values per variable
  deferredPaths: DeferredPath[]; // Changed: Full DeferredPath objects with metadata
  nextRunId: number;
}

/**
 * Request payload for saving a session
 */
export interface SaveSessionRequest {
  sessionId: string;
  action: MergeAction;
  runId?: number;
  data: {
    results: FileAnalysis[];
    session: ExplorationSession;
    variables: Record<string, VariableValue[]>; // Changed: Array of values
    deferredPaths?: DeferredPath[]; // Changed: Full objects
  };
}

/**
 * Response from saving a session
 */
export interface SaveSessionResponse {
  success: boolean;
  sessionId: string;
  totalFiles: number;
  newFiles: number;
  updatedFiles?: number;
  runId: number;
  size: string;
  error?: string;
}

/**
 * Extended FileAnalysis with scan history
 * (Extends the existing FileAnalysis model)
 */
export interface FileAnalysisWithHistory extends FileAnalysis {
  scanHistory?: ScanHistoryEntry[];
}
