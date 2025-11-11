import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { ConsoleService } from './console.service';
import {
  VariableResolverService,
  VariableValue,
} from './file-exploration/variable-resolver.service';
import { PathExtractorService } from './file-exploration/path-extractor.service';
import { FileContentAnalyzerService } from './file-exploration/file-content-analyzer.service';
import { FileScannerService } from './file-exploration/file-scanner.service';
import { FileTreeBuilderService } from './file-exploration/file-tree-builder.service';
import { TvErrorDetectorService } from './file-exploration/tv-error-detector.service';
import { ScanStorageService } from './scan-storage.service';
import {
  FileAnalysis,
  ExplorationSession,
  ExplorationStats,
  TreeNode,
} from '../models/file-exploration';
import {
  EXPLORATION_PATHS,
  SCAN_CONFIG,
  shouldExcludeVariableSource,
} from '../config/exploration-paths.config';

@Injectable({
  providedIn: 'root',
})
export class FileExplorationService {
  private session: ExplorationSession | null = null;
  private isScanning = false;
  private filesSinceLastSave = 0; // Track files scanned since last auto-save
  private isSaving = false; // Prevent concurrent saves

  // Session persistence tracking
  private currentSessionId: string | null = null;
  private currentRunId = 1;
  private sessionStartTime: Date | null = null;
  private sessionSavedOnce = false; // Track if session has been saved at least once
  private lastSavedResultCount = 0; // Track how many results were saved last time
  private readonly AUTO_SAVE_FILE_THRESHOLD = 25; // Save after every 25 files

  // Observables
  private sessionSubject = new BehaviorSubject<ExplorationSession | null>(null);
  public session$ = this.sessionSubject.asObservable();

  private statsSubject = new BehaviorSubject<ExplorationStats>({
    totalFiles: 0,
    successCount: 0,
    failedCount: 0,
    binaryCount: 0,
    textCount: 0,
    pathsDiscovered: 0,
    progress: 0,
  });
  public stats$ = this.statsSubject.asObservable();

  private resultsSubject = new Subject<FileAnalysis>();
  public results$ = this.resultsSubject.asObservable();

  constructor(
    private consoleService: ConsoleService,
    private variableResolver: VariableResolverService,
    private pathExtractor: PathExtractorService,
    private contentAnalyzer: FileContentAnalyzerService,
    private fileScanner: FileScannerService,
    private treeBuilder: FileTreeBuilderService,
    private errorDetector: TvErrorDetectorService,
    private scanStorage: ScanStorageService
  ) {}

  /**
   * Get all results from the current session
   */
  public getAllResults(): FileAnalysis[] {
    if (!this.session) {
      return [];
    }
    return Array.from(this.session.results.values());
  }

  /**
   * Check if a scan is currently running
   */
  public isScanActive(): boolean {
    return this.isScanning;
  }

  /**
   * Start a new exploration session
   */
  public startExploration(): void {
    if (this.isScanning) {
      this.consoleService.warn(
        'Exploration already running',
        'FileExploration'
      );
      return;
    }

    if (this.session) {
      this.session.results.clear();
      this.session.scanned.clear();
      this.session.queue = [];
      this.session.variables?.clear();
    }

    // Initialize session
    this.session = {
      id: `session-${Date.now()}`,
      startTime: new Date(),
      status: 'running',
      totalPaths: 0,
      scannedPaths: 0,
      successfulReads: 0,
      failedReads: 0,
      binaryFiles: 0,
      textFiles: 0,
      results: new Map(),
      queue: [], // Only explicit and discovered paths (no blind probing)
      scanned: new Set(),
      variables: new Map(), // Track discovered variables
      deferredPaths: [], // Templates waiting for variable resolution
    };

    // Initialize variable resolver for this session
    this.variableResolver.initSession(this.session.id);

    // Load initial paths from config (explicit files only)
    const initialPaths: string[] = [];

    EXPLORATION_PATHS.sort(
      (a: { priority: number }, b: { priority: number }) =>
        b.priority - a.priority
    ).forEach((category: { files: string[] }) => {
      // Add explicit files only
      initialPaths.push(...category.files);

      // Note: directories are NOT expanded anymore
      // Files will be discovered through content analysis
    });

    this.session.queue = [...initialPaths];
    this.session.totalPaths = initialPaths.length;

    this.consoleService.info(
      `Starting exploration with ${initialPaths.length} explicit paths (content-driven discovery)`,
      'FileExploration'
    );

    this.sessionSubject.next(this.session);
    this.isScanning = true;

    // Initialize session tracking - always create new session ID for fresh start
    this.sessionStartTime = new Date();
    this.currentSessionId = this.scanStorage.generateSessionName();
    this.currentRunId = 1;
    this.sessionSavedOnce = false; // Reset save tracking
    this.lastSavedResultCount = 0; // Reset incremental save counter
    this.filesSinceLastSave = 0; // Reset auto-save counter

    this.consoleService.info(
      `Session: ${this.currentSessionId}, Run: ${this.currentRunId}`,
      'FileExploration'
    );

    // Start scanning
    this.scanNextBatch();
  }

  /**
   * Pause the current exploration
   */
  public pauseExploration(): void {
    if (!this.session || this.session.status !== 'running') return;

    this.session.status = 'paused';
    this.isScanning = false;
    this.sessionSubject.next(this.session);
    this.consoleService.info('Exploration paused', 'FileExploration');

    this.saveSessionToServer();
  }

  /**
   * Resume a paused exploration
   */
  public resumeExploration(): void {
    if (!this.session || this.session.status !== 'paused') return;

    this.session.status = 'running';
    this.isScanning = true;

    this.errorDetector.resetConsecutiveErrors();

    this.currentRunId++;
    this.sessionStartTime = new Date();
    this.filesSinceLastSave = 0; // Reset auto-save counter for new run

    this.sessionSubject.next(this.session);
    this.consoleService.info(
      `Exploration resumed: Run #${this.currentRunId}`,
      'FileExploration'
    );
    this.scanNextBatch();
  }

  /**
   * Stop the exploration completely
   */
  public stopExploration(): void {
    if (!this.session) return;

    this.session.status = 'completed';
    this.session.endTime = new Date();
    this.isScanning = false;

    // Clean up variable resolver session
    this.variableResolver.clearSession(this.session.id);

    this.saveSessionToServer();

    // Note: We don't clear results here because component needs them for display
    // Results will be cleared when starting a new scan
    this.session.queue = [];
    this.session.scanned.clear();

    this.currentSessionId = '';
    this.currentRunId = 0;
    this.sessionSavedOnce = false;

    this.sessionSubject.next(this.session);
    this.consoleService.info(
      `Exploration stopped (session tracking reset for next scan)`,
      'FileExploration'
    );
  }

  /**
   * Load and resume a saved session from the server
   * @param sessionId - Session ID to resume
   * @returns Promise that resolves when session is loaded
   */
  public async loadSessionForResume(sessionId: string): Promise<void> {
    try {
      this.consoleService.info(
        `Loading session for resume: ${sessionId}`,
        'FileExploration'
      );

      // Get resume data from server
      const resumeData = await this.scanStorage
        .resumeSession(sessionId)
        .toPromise();

      if (!resumeData) {
        throw new Error('Failed to load resume data');
      }

      // Stop current session if any
      if (this.session) {
        this.stopExploration();
      }

      // Restore session data
      this.session = resumeData.session;
      this.session.status = 'paused'; // ✅ Set status to 'paused' so resumeExploration() can start
      this.currentSessionId = resumeData.sessionId;
      this.currentRunId = resumeData.nextRunId;
      this.sessionStartTime = new Date();
      this.sessionSavedOnce = true; // Session was already saved

      // Set lastSavedResultCount to current result count
      if (resumeData.session.results instanceof Map) {
        this.lastSavedResultCount = resumeData.session.results.size;
      } else if (Array.isArray(resumeData.session.results)) {
        this.lastSavedResultCount = (
          resumeData.session.results as unknown as FileAnalysis[]
        ).length;
      } else {
        this.lastSavedResultCount = 0;
      }

      this.filesSinceLastSave = 0; // Reset auto-save counter

      // Ensure session.id matches the resumed sessionId
      this.session.id = this.currentSessionId;

      // Restore variables to VariableResolverService (filter out excluded sources)
      const variablesMap = new Map<string, VariableValue[]>();
      let filteredOutCount = 0;

      Object.entries(resumeData.variables).forEach(([name, values]) => {
        // ✅ Filter out variables from excluded sources (e.g., mapping.ini)
        const filteredValues = values.filter(
          (v) => !shouldExcludeVariableSource(v.discoveredIn)
        );

        filteredOutCount += values.length - filteredValues.length;

        // Only add if there are values left after filtering
        if (filteredValues.length > 0) {
          variablesMap.set(name, filteredValues);
        }
      });

      this.consoleService.info(
        `Restored ${variablesMap.size} variables (${filteredOutCount} filtered out)`,
        'FileExploration'
      );

      // Initialize variable resolver session and restore data
      this.variableResolver.initSession(this.currentSessionId);
      this.variableResolver.restoreVariables(
        this.currentSessionId,
        variablesMap
      );

      // Restore deferred paths with full metadata
      if (resumeData.deferredPaths && resumeData.deferredPaths.length > 0) {
        this.consoleService.info(
          `Restoring ${resumeData.deferredPaths.length} deferred paths`,
          'FileExploration'
        );

        // Restore deferred paths in VariableResolver (NOT in queue!)
        this.variableResolver.restoreDeferredPaths(
          this.currentSessionId,
          resumeData.deferredPaths
        );

        // Don't add templates to queue - they will be resolved when variables are found
      }

      // Ensure queue is an array
      if (!Array.isArray(this.session.queue)) {
        this.consoleService.warn(
          `Queue is not an array, creating empty queue`,
          'FileExploration'
        );
        this.session.queue = [];
      }

      // Convert serialized collections back to proper types
      // Results: Array of [key, value] pairs → Map
      if (!(this.session.results instanceof Map)) {
        const resultsData = this.session.results as unknown;
        if (Array.isArray(resultsData)) {
          // Check if it's an array of [key, value] tuples
          if (resultsData.length > 0 && Array.isArray(resultsData[0])) {
            // Array of tuples format: [[path, FileAnalysis], ...]
            this.session.results = new Map(
              resultsData as [string, FileAnalysis][]
            );
          } else {
            // Legacy array format: [FileAnalysis, ...]
            const resultsMap = new Map<string, FileAnalysis>();
            (resultsData as FileAnalysis[]).forEach((result: FileAnalysis) => {
              resultsMap.set(result.path, result);
            });
            this.session.results = resultsMap;
          }
        } else {
          this.consoleService.warn(
            `Results is not in expected format, creating empty Map`,
            'FileExploration'
          );
          this.session.results = new Map<string, FileAnalysis>();
        }
      }

      // Scanned: Array → Set
      if (!(this.session.scanned instanceof Set)) {
        const scannedData = this.session.scanned as unknown;
        if (Array.isArray(scannedData)) {
          this.session.scanned = new Set<string>(scannedData);
        } else {
          this.consoleService.warn(
            `Scanned is not an array, creating empty Set`,
            'FileExploration'
          );
          this.session.scanned = new Set<string>();
        }
      }

      // Variables: Record → Map
      if (!(this.session.variables instanceof Map)) {
        const variablesData = this.session.variables as unknown;
        if (variablesData && typeof variablesData === 'object') {
          // Convert Record<string, VariableValue[]> to Map
          const variablesMap = new Map<string, VariableValue[]>();
          Object.entries(variablesData).forEach(([name, values]) => {
            variablesMap.set(name, values as VariableValue[]);
          });
          this.session.variables = variablesMap;
        } else {
          this.consoleService.warn(
            `Variables is not in expected format, creating empty Map`,
            'FileExploration'
          );
          this.session.variables = new Map<string, VariableValue[]>();
        }
      }

      // Notify subscribers
      this.sessionSubject.next(this.session);

      this.consoleService.info(
        `Session loaded: Run #${this.currentRunId}, ${this.session.results.size} files, Queue: ${this.session.queue.length} items`,
        'FileExploration'
      );

      // Now ready to resume - user can call resumeExploration()
    } catch (error) {
      this.consoleService.error(
        'Failed to load session for resume',
        error as Error,
        'FileExploration'
      );
      throw error;
    }
  }

  /**
   * Get current session data
   */
  public getCurrentSession(): ExplorationSession | null {
    return this.session;
  }

  /**
   * Export results as JSON
   */
  public exportResults(): string {
    if (!this.session) return '{}';

    const exportData = {
      session: {
        id: this.session.id,
        startTime: this.session.startTime,
        endTime: this.session.endTime,
        status: this.session.status,
        stats: {
          totalPaths: this.session.totalPaths,
          scannedPaths: this.session.scannedPaths,
          successfulReads: this.session.successfulReads,
          failedReads: this.session.failedReads,
          binaryFiles: this.session.binaryFiles,
          textFiles: this.session.textFiles,
        },
      },
      results: Array.from(this.session.results.values()),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Scan next batch of files (parallel processing)
   */
  private async scanNextBatch(): Promise<void> {
    if (!this.session || !this.isScanning) return;

    // Get next batch of paths (configurable batch size)
    const batchSize = SCAN_CONFIG.batchSize || 5;
    const batch: string[] = [];

    for (let i = 0; i < batchSize && this.session.queue.length > 0; i++) {
      const path = this.session.queue.shift();
      if (path) {
        batch.push(path);
      }
    }

    if (batch.length === 0) {
      this.stopExploration();
      return;
    }

    // Track SCANNED files count before batch (not results, which includes placeholders)
    const scannedBeforeBatch = this.session.scanned.size;

    // Scan all files in batch in parallel
    await Promise.all(batch.map((path) => this.scanFile(path)));

    const scannedAfterBatch = this.session.scanned.size;
    const actualFilesScanned = scannedAfterBatch - scannedBeforeBatch;
    this.filesSinceLastSave += actualFilesScanned;

    // Check if auto-save threshold reached
    if (
      this.filesSinceLastSave >= this.AUTO_SAVE_FILE_THRESHOLD &&
      this.session
    ) {
      this.saveSessionToServer();
      this.filesSinceLastSave = 0;
      this.consoleService.info(
        `Auto-saved scan progress (${this.AUTO_SAVE_FILE_THRESHOLD} files)`,
        'FileExploration'
      );
    }

    // Update progress
    this.updateStats();

    // Continue with next batch after delay
    if (this.isScanning && this.session.queue.length > 0) {
      setTimeout(() => this.scanNextBatch(), SCAN_CONFIG.delayBetweenFiles);
    } else if (this.session.queue.length === 0) {
      this.stopExploration();
    }
  }

  /**
   * Scan a single file using remote TV command
   */
  private async scanFile(path: string): Promise<void> {
    if (!this.session) return;

    // Skip if already scanned
    if (this.session.scanned.has(path)) return;

    // Check if there's a placeholder with discoveredFrom info
    const existingResult = this.session.results.get(path);
    const discoveredFrom = existingResult?.discoveredFrom;

    // Delegate file scanning to FileScannerService
    const scanResult = await this.fileScanner.scanFile(path);

    if (scanResult.status !== 'success' || !scanResult.content) {
      // Distinguish between permanent and temporary errors
      const isPermanentError = scanResult.status === 'not-found';
      const isTemporaryError = scanResult.status === 'error';

      // Only save and display permanent errors
      if (isPermanentError) {
        const result: FileAnalysis = {
          path,
          status: scanResult.status,
          size: 0,
          isBinary: false,
          fileType: 'unknown',
          confidence: 0,
          extractedPaths: [],
          discoveredFrom,
          discoveryMethod: discoveredFrom ? 'extracted' : 'known-list',
          timestamp: new Date(),
          error: scanResult.error,
          tvProcessingTimeMs: scanResult.tvProcessingTimeMs,
        };

        this.session.results.set(path, result);
        this.session.failedReads++;
        this.resultsSubject.next(result);
        this.session.scanned.add(path); // Permanent - don't retry
        this.session.scannedPaths++; // Only count for permanent errors

        // Auto-save is handled in scanNextBatch() after batch completes
      }

      // Temporary errors: count only, don't save (available for resume)
      if (isTemporaryError) {
        this.session.failedReads++;
        // Not in results - won't appear in tree
        // Not in scanned - can be retried on resume
        // No scannedPaths++ - will be counted on resume
        // Path stays in pending set

        if (scanResult.error) {
          // Analyze error and check if we should pause
          const error = new Error(scanResult.error);
          const errorAnalysis = this.errorDetector.analyzeError(error);

          if (errorAnalysis.shouldPause && this.isScanning) {
            this.consoleService.error(
              `Critical error detected - auto-pausing scan: ${errorAnalysis.type}`,
              scanResult.error,
              'FileExploration'
            );

            // Update session with error info
            if (this.session) {
              this.session.status = 'paused';
              this.isScanning = false;

              this.saveSessionToServer();

              this.sessionSubject.next(this.session);
            }

            return; // Stop processing to prevent further errors
          }

          this.consoleService.error(
            `Error scanning ${path}: ${scanResult.error}`,
            scanResult.error,
            'FileExploration'
          );
        }
      }
      return;
    }

    // ✅ Reset error counter on success
    this.errorDetector.resetConsecutiveErrors();

    const content = scanResult.content;

    // Analyze content (light operation - type detection only)
    const analysis = this.analyzeContent(path, content);

    // Add TV processing time from scan result
    analysis.tvProcessingTimeMs = scanResult.tvProcessingTimeMs;

    // Check if there's a placeholder with metadata
    const placeholder = this.session.results.get(path);

    // Preserve discoveredFrom and discoveryMethod from placeholder
    if (placeholder) {
      if (placeholder.discoveredFrom) {
        analysis.discoveredFrom = placeholder.discoveredFrom;
      }
      if (placeholder.discoveryMethod) {
        analysis.discoveryMethod = placeholder.discoveryMethod;
      }
    } else if (discoveredFrom) {
      // Fallback: use discoveredFrom parameter if no placeholder exists
      analysis.discoveredFrom = discoveredFrom;
      analysis.discoveryMethod = 'extracted';
    }

    // Store result and update statistics immediately
    this.session.results.set(path, analysis);
    this.session.successfulReads++;
    this.session.scanned.add(path); // Mark as successfully scanned
    this.session.scannedPaths++; // Count for progress

    if (analysis.isBinary) {
      this.session.binaryFiles++;
    } else {
      this.session.textFiles++;
    }

    // Emit result to UI immediately
    this.resultsSubject.next(analysis);

    // Auto-save is handled in scanNextBatch() after batch completes

    // Yield to event loop before heavy path extraction
    // This allows other pending network responses to be processed
    // while statistics are already updated in the UI
    await Promise.resolve();

    // Skip path extraction for binary files
    if (analysis.isBinary) {
      return;
    }

    // Continue with path extraction for text files
    if (this.session && !analysis.isBinary) {
      // Special handling for /proc/mounts - extract mount points
      if (path === '/proc/mounts') {
        const mountPaths = this.pathExtractor.extractMountPaths(content);
        if (mountPaths.length > 0) {
          // Add the extracted paths to the regular extracted paths
          analysis.extractedPaths.push(...mountPaths);
          this.consoleService.info(
            `Extracted ${mountPaths.length} mount points from ${path}`,
            'FileExploration'
          );
        }
      }

      // Special handling for /etc/passwd - extract home directories
      if (path === '/etc/passwd') {
        const homePaths = this.pathExtractor.extractHomeDirPaths(content);
        if (homePaths.length > 0) {
          analysis.extractedPaths.push(...homePaths);
          this.consoleService.info(
            `Extracted ${homePaths.length} home directory paths from ${path}`,
            'FileExploration'
          );
        }
      }

      // Special handling for /proc files - extract PIDs and process info
      if (path.startsWith('/proc/')) {
        const procPaths = this.pathExtractor.extractProcPaths(path, content);
        if (procPaths.length > 0) {
          analysis.extractedPaths.push(...procPaths);
          this.consoleService.info(
            `Extracted ${procPaths.length} process paths from ${path}`,
            'FileExploration'
          );
        }
      }

      // Special handling for shell scripts (profile, bashrc, etc.) - extract paths from exports and source statements
      if (this.pathExtractor.isShellScript(path)) {
        const shellPaths = this.pathExtractor.extractShellScriptPaths(content);
        if (shellPaths.length > 0) {
          // Track generated paths separately
          if (!analysis.generatedPaths) {
            analysis.generatedPaths = [];
          }

          // Process shell paths through variable resolver to handle $VAR and ${VAR} syntax
          for (const shellPath of shellPaths) {
            const result = this.variableResolver.processPath(
              this.session.id,
              shellPath,
              'shell-script',
              (p) => this.pathExtractor.looksLikeFile(p)
            );

            // Separate raw extracted paths from generated (resolved) paths using wasGenerated flag
            if (result.wasGenerated && result.resolvedPaths.length > 0) {
              // Path had variables and was resolved -> generated
              analysis.generatedPaths.push(...result.resolvedPaths);
            } else if (result.resolvedPaths.length > 0) {
              // Path was literal -> extracted
              analysis.extractedPaths.push(...result.resolvedPaths);
            }
          }

          this.consoleService.info(
            `Extracted ${analysis.extractedPaths.length} paths and generated ${analysis.generatedPaths.length} paths from shell script ${path}`,
            'FileExploration'
          );
        }
      }

      // Yield to event loop after special path extractions
      // This allows other pending network responses to be processed
      await Promise.resolve();

      // Add discovered paths to queue (combine extracted + generated)
      const allDiscoveredPaths = [
        ...analysis.extractedPaths,
        ...(analysis.generatedPaths || []),
      ];

      if (allDiscoveredPaths.length > 0) {
        // Remove duplicates
        const uniquePaths = Array.from(new Set(allDiscoveredPaths));

        // Separate new paths from already known paths
        const newExtracted: string[] = [];
        const newGenerated: string[] = [];
        const ignoredPaths: string[] = [];

        for (const p of uniquePaths) {
          if (
            this.session &&
            (this.session.scanned.has(p) || this.session.queue.includes(p))
          ) {
            ignoredPaths.push(p);
          } else {
            // Track whether path was extracted or generated
            if (analysis.extractedPaths.includes(p)) {
              newExtracted.push(p);
            } else {
              newGenerated.push(p);
            }
          }
        }

        // Update lists to only contain new paths
        analysis.extractedPaths = newExtracted;
        analysis.generatedPaths =
          newGenerated.length > 0 ? newGenerated : undefined;

        // Store ignored paths separately
        analysis.ignoredPaths = ignoredPaths;

        // Add discovered paths to end of queue with source tracking
        const allNewPaths = [...newExtracted, ...newGenerated];
        this.session.queue.push(...allNewPaths);
        this.session.totalPaths += allNewPaths.length;

        // Mark the source file for newly discovered paths
        for (const newPath of allNewPaths) {
          // Pre-create result entry with discoveredFrom metadata
          // This will be overwritten when the file is actually scanned
          // But we preserve the discoveredFrom field
          const existingResult = this.session.results.get(newPath);
          if (!existingResult) {
            const wasGenerated = newGenerated.includes(newPath);
            // Create placeholder to track source
            const placeholder: FileAnalysis = {
              path: newPath,
              status: 'not-found', // Will be updated when scanned
              size: 0,
              isBinary: false,
              fileType: 'unknown',
              confidence: 0,
              extractedPaths: [],
              discoveredFrom: path, // Track the source!
              discoveryMethod: wasGenerated ? 'generated' : 'extracted',
              timestamp: new Date(),
              isPlaceholder: true, // Mark as placeholder
            };
            this.session.results.set(newPath, placeholder);
          }
        }

        this.consoleService.info(
          `Found ${newExtracted.length} extracted + ${newGenerated.length} generated = ${allNewPaths.length} new paths in ${path} (${ignoredPaths.length} already known)`,
          'FileExploration'
        );
      }
    }
  }
  /**
   * Analyze file content
   */
  private analyzeContent(path: string, content: string): FileAnalysis {
    const size = content.length;

    // Delegate content analysis to FileContentAnalyzerService
    const analysis = this.contentAnalyzer.analyzeContent(path, content);
    const isBinary = analysis.isBinary;

    // Extract variables AND paths from text files
    // IMPORTANT: Extract variables FIRST, then paths!
    let extractedPaths: string[] = [];
    let generatedPaths: string[] = [];
    if (!isBinary && this.session) {
      // Skip path extraction for .pem files (certificates contain base64, not real paths)
      const skipPathExtraction = path.endsWith('.pem');

      if (!skipPathExtraction) {
        // 1. Extract variables and get newly resolved deferred paths
        const deferredResolved = this.variableResolver.extractVariables(
          content,
          path,
          this.session.id
        );

        // 2. Extract paths from current content
        const pathResult = this.extractAndResolvePaths(content);
        extractedPaths = pathResult.extracted;
        generatedPaths = pathResult.generated;

        // 3. Add deferred resolved paths to generated (they came from variable resolution)
        if (deferredResolved.length > 0) {
          this.consoleService.info(
            `🔧 Resolved ${deferredResolved.length} deferred paths after discovering variables in ${path}`,
            'FileExploration'
          );
          generatedPaths.push(...deferredResolved);
        }
      }
    }

    return {
      path,
      status: 'success',
      content,
      contentPreview: analysis.contentPreview,
      size,
      isBinary: analysis.isBinary,
      fileType: analysis.fileType,
      encoding: analysis.encoding,
      confidence: analysis.confidence,
      magicBytes: analysis.magicBytes,
      extractedPaths,
      generatedPaths: generatedPaths.length > 0 ? generatedPaths : undefined,
      discoveryMethod: 'known-list',
      timestamp: new Date(),
    };
  }

  /**
   * Extract paths from text content
   * Returns both extracted (literal) and generated (resolved from variables) paths
   */
  private extractAndResolvePaths(content: string): {
    extracted: string[];
    generated: string[];
  } {
    if (!this.session) return { extracted: [], generated: [] };

    // Delegate basic extraction to PathExtractorService
    const rawPaths = this.pathExtractor.extractPaths(content);
    const extractedPaths = new Set<string>();
    const generatedPaths = new Set<string>();

    // Process each path through VariableResolverService
    for (const path of rawPaths) {
      const result = this.variableResolver.processPath(
        this.session.id,
        path,
        'content',
        (p) => this.pathExtractor.looksLikeFile(p)
      );

      // Separate literal paths from generated (resolved) paths using wasGenerated flag
      if (result.wasGenerated && result.resolvedPaths.length > 0) {
        // Path had variables and was resolved -> generated
        for (const resolvedPath of result.resolvedPaths) {
          generatedPaths.add(resolvedPath);
        }
      } else if (result.resolvedPaths.length > 0) {
        // Path was literal -> extracted
        for (const resolvedPath of result.resolvedPaths) {
          extractedPaths.add(resolvedPath);
        }
      }

      // Deferred paths are tracked in VariableResolverService
      // They will be resolved later when variables are discovered
    }

    return {
      extracted: Array.from(extractedPaths),
      generated: Array.from(generatedPaths),
    };
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    if (!this.session) return;

    const progress =
      this.session.totalPaths > 0
        ? Math.round(
            (this.session.scannedPaths / this.session.totalPaths) * 100
          )
        : 0;

    const stats: ExplorationStats = {
      totalFiles: this.session.totalPaths,
      successCount: this.session.successfulReads,
      failedCount: this.session.failedReads,
      binaryCount: this.session.binaryFiles,
      textCount: this.session.textFiles,
      pathsDiscovered: this.session.queue.length,
      progress,
    };

    this.statsSubject.next(stats);
  }

  /**
   * Build a tree structure from flat file results
   * @param results Optional array of results. If not provided, uses current session results
   */
  public buildFileTree(results?: FileAnalysis[]): TreeNode[] {
    return this.treeBuilder.buildFileTree(
      results || (this.session ? Array.from(this.session.results.values()) : [])
    );
  }

  /**
   * Get current error info from error detector
   */
  public getErrorInfo() {
    return this.errorDetector.getErrorInfo();
  }

  /**
   * Fetch content for a file on-demand (used after resume when content is missing)
   */
  public async fetchFileContent(path: string): Promise<string | null> {
    try {
      const scanResult = await this.fileScanner.scanFile(path);

      if (scanResult.status === 'success' && scanResult.content) {
        // Update the result in session with content
        if (this.session) {
          const existingResult = this.session.results.get(path);
          if (existingResult) {
            existingResult.content = scanResult.content;
            existingResult.size = scanResult.content.length;
            this.session.results.set(path, existingResult);
          }
        }

        return scanResult.content;
      }

      return null;
    } catch (error) {
      this.consoleService.error(
        `Failed to fetch content for ${path}`,
        error as Error,
        'FileExploration'
      );
      return null;
    }
  }

  /**
   * Save current session to dev-server
   * Automatically uses 'create' for first save, 'merge' for subsequent saves
   */
  private saveSessionToServer(): void {
    if (!this.currentSessionId || !this.session) {
      this.consoleService.warn(
        'Cannot save session: sessionId or session is null',
        'FileExploration'
      );
      return;
    }

    // Prevent concurrent saves
    if (this.isSaving) {
      this.consoleService.debug(
        'Save already in progress, skipping',
        'FileExploration'
      );
      return;
    }

    // Auto-determine action: 'create' for first save, 'merge' for subsequent saves
    const actualAction = this.sessionSavedOnce ? 'merge' : 'create';

    // Get all variables for this session as Map
    const variablesMap = this.variableResolver.getVariables(this.session.id);

    // Convert Map<string, VariableValue[]> to Record<string, VariableValue[]>
    // Keep ALL values for each variable (not just the first one)
    const variables: Record<string, VariableValue[]> = {};
    variablesMap.forEach((values, name) => {
      variables[name] = values; // Keep all values with their metadata
    });

    // Get deferred paths with full metadata
    const deferredPaths = this.variableResolver.getDeferredPaths(
      this.session.id
    );

    // ✅ Incremental Save: Only send new results since last save
    const allResults = Array.from(this.session.results.values());
    const newResults = allResults.slice(this.lastSavedResultCount);

    if (newResults.length === 0 && this.sessionSavedOnce) {
      this.consoleService.debug(
        `No new results to save (total: ${allResults.length}, lastSaved: ${this.lastSavedResultCount})`,
        'FileExploration'
      );
      return;
    }

    this.consoleService.debug(
      `Saving ${newResults.length} new results (total: ${allResults.length}, lastSaved: ${this.lastSavedResultCount})`,
      'FileExploration'
    );

    // ✅ Strip binary content from results to reduce payload size
    // Binary files are never displayed and don't need content stored
    const newResultsWithoutBinaryContent = newResults.map((result) => {
      if (result.isBinary) {
        // Remove content from binary files
        return {
          ...result,
          content: undefined, // Strip binary content
          previewLines: [], // No preview needed
        };
      }
      return result;
    });

    // ✅ Also strip binary content from ALL results in session (not just new ones)
    const allResultsWithoutBinaryContent = Array.from(
      this.session.results.entries()
    ).map(([path, result]) => {
      if (result.isBinary) {
        return [
          path,
          {
            ...result,
            content: undefined,
            previewLines: [],
          },
        ];
      }
      return [path, result];
    });

    // Create serialized session for JSON transport
    const serializedSession = {
      ...this.session,
      results: allResultsWithoutBinaryContent, // ✅ Binary content stripped from all results
      scanned: Array.from(this.session.scanned),
      variables: variables, // Already a Record
    };

    // Prepare data for HTTP transmission - only new results
    const sessionData = {
      results: newResultsWithoutBinaryContent,
      session: serializedSession as unknown as ExplorationSession,
      variables: variables,
      deferredPaths: deferredPaths,
    };

    this.isSaving = true; // Mark save in progress

    this.scanStorage
      .saveSession(
        this.currentSessionId,
        actualAction,
        sessionData,
        this.currentRunId
      )
      .subscribe({
        next: (response) => {
          // Mark session as saved
          this.sessionSavedOnce = true;

          // ✅ Update last saved count
          this.lastSavedResultCount = allResults.length;

          this.isSaving = false; // Clear save flag

          this.consoleService.info(
            `Session saved: ${response.sessionId} (${response.totalFiles} files, ${response.newFiles} new)`,
            'FileExploration'
          );
        },
        error: (error) => {
          this.isSaving = false; // Clear save flag on error
          this.consoleService.error(
            'Failed to save session to server',
            error,
            'FileExploration'
          );
        },
      });
  }
}
