/**
 * Models for file system exploration
 */

export interface ScanHistoryEntry {
  runId: number;
  timestamp: number;
  status: 'success' | 'error' | 'not-found';
}

export interface FileAnalysis {
  path: string;
  status: 'success' | 'access-denied' | 'not-found' | 'error';

  // Content info
  content?: string;
  contentPreview?: string;
  size: number;

  // Type detection
  isBinary: boolean;
  fileType: string; // 'text', 'elf', 'script', 'config', 'log', 'binary', etc.
  encoding?: string;
  confidence: number; // 0-1, how confident we are about the type
  magicBytes?: string;

  // Path discovery
  extractedPaths: string[];
  generatedPaths?: string[]; // Paths generated through variable resolution (e.g., ${VAR} -> value)
  ignoredPaths?: string[]; // Paths that were extracted but already in queue/scanned

  // Metadata
  discoveredFrom?: string; // Which file led to discovering this
  discoveryMethod: 'known-list' | 'extracted' | 'generated';
  timestamp: Date;
  error?: string;
  tvProcessingTimeMs?: number; // Time TV took to read file (in ms)
  isPlaceholder?: boolean; // True if this is a placeholder for a discovered path (not yet scanned)

  // Session persistence (for multi-run tracking)
  scanHistory?: ScanHistoryEntry[]; // Track which runs scanned this file

  // Debug info
  debugLog?: DebugLogEntry[]; // Processing log for this file
}

export interface DebugLogEntry {
  timestamp: Date;
  level: 'info' | 'debug' | 'warn' | 'error';
  message: string;
  category?: string;
}

export interface VariableValue {
  name: string;
  value: string;
  discoveredIn: string;
  confidence: 'explicit' | 'inferred' | 'conditional';
}

export interface DeferredPath {
  template: string;
  variables: string[];
  discoveredIn: string;
  priority: number;
}

export interface ExplorationSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'paused' | 'completed' | 'error';

  // Statistics
  totalPaths: number;
  scannedPaths: number;
  successfulReads: number;
  failedReads: number;
  binaryFiles: number;
  textFiles: number;

  // Results
  results: Map<string, FileAnalysis>;

  // Single queue: only discovered and explicit paths (no blind probing)
  queue: string[];

  // Variable tracking for template resolution
  variables: Map<string, VariableValue[]>; // varName -> possible values
  deferredPaths: DeferredPath[]; // Templates waiting for variable values

  scanned: Set<string>;
}

/**
 * Serialized version of ExplorationSession for JSON transport
 * Maps and Sets are converted to Arrays/Objects for JSON compatibility
 */
export interface SerializedExplorationSession
  extends Omit<ExplorationSession, 'results' | 'scanned' | 'variables'> {
  results: [string, FileAnalysis][]; // Map serialized as array of [key, value] tuples
  scanned: string[]; // Set serialized as array
  variables: Record<string, VariableValue[]>; // Map serialized as Record object
}

export interface ExplorationStats {
  totalFiles: number;
  successCount: number;
  failedCount: number;
  binaryCount: number;
  textCount: number;
  pathsDiscovered: number;
  progress: number; // 0-100
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
  file?: FileAnalysis; // Only for files
  isExpanded?: boolean;
  level: number;
  fileCount?: number; // For directories: count of files in this directory and subdirectories
  directoryCount?: number; // For directories: count of subdirectories
}
