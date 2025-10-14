/**
 * Models for file system exploration
 */

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
  ignoredPaths?: string[]; // Paths that were extracted but already in queue/scanned

  // Metadata
  discoveredFrom?: string; // Which file led to discovering this
  discoveryMethod: 'known-list' | 'extracted' | 'generated';
  timestamp: Date;
  error?: string;
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

  scanned: Set<string>;
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
