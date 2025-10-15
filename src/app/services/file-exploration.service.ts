import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, firstValueFrom } from 'rxjs';
import { ConsoleService } from './console.service';
import { TvCommandService } from './tv-command.service';
import {
  FileAnalysis,
  ExplorationSession,
  ExplorationStats,
} from '../models/file-exploration';
import {
  EXPLORATION_PATHS,
  PATH_EXTRACTION_PATTERNS,
  SHELL_VARIABLES,
  BINARY_SIGNATURES,
  SCAN_CONFIG,
  COMMON_FILENAMES,
} from '../config/exploration-paths.config';

@Injectable({
  providedIn: 'root',
})
export class FileExplorationService {
  private session: ExplorationSession | null = null;
  private isScanning = false;

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
    private tvCommandService: TvCommandService
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
    };

    // Load initial paths from config (explicit files only)
    const initialPaths: string[] = [];

    EXPLORATION_PATHS.sort((a, b) => b.priority - a.priority).forEach(
      (category) => {
        // Add explicit files only
        initialPaths.push(...category.files);

        // Note: directories are NOT expanded anymore
        // Files will be discovered through content analysis
      }
    );

    this.session.queue = [...initialPaths];
    this.session.totalPaths = initialPaths.length;

    this.consoleService.info(
      `Starting exploration with ${initialPaths.length} explicit paths (content-driven discovery)`,
      'FileExploration'
    );

    this.sessionSubject.next(this.session);
    this.isScanning = true;

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
  }

  /**
   * Resume a paused exploration
   */
  public resumeExploration(): void {
    if (!this.session || this.session.status !== 'paused') return;

    this.session.status = 'running';
    this.isScanning = true;
    this.sessionSubject.next(this.session);
    this.consoleService.info('Exploration resumed', 'FileExploration');
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
    this.sessionSubject.next(this.session);
    this.consoleService.info('Exploration stopped', 'FileExploration');
  }

  /**
   * Get current session data
   */
  public getCurrentSession(): ExplorationSession | null {
    return this.session;
  }

  /**
   * Expand directories to file paths by combining with common filenames
   */
  private expandDirectories(directories: string[]): string[] {
    const paths: string[] = [];

    for (const dir of directories) {
      for (const filename of COMMON_FILENAMES) {
        const fullPath = `${dir}/${filename}`;
        if (this.isValidPath(fullPath)) {
          paths.push(fullPath);
        }
      }
    }

    return paths;
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
   * Scan next batch of files (sequential, one at a time)
   */
  private async scanNextBatch(): Promise<void> {
    if (!this.session || !this.isScanning) return;

    // Get next path from queue
    const path = this.session.queue.shift();

    if (!path) {
      this.stopExploration();
      return;
    }

    // Scan file
    await this.scanFile(path);

    // Update progress
    this.updateStats();

    // Continue with next file after delay
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
    this.session.scanned.add(path);
    this.session.scannedPaths++;

    // Check if there's a placeholder with discoveredFrom info
    const existingResult = this.session.results.get(path);
    const discoveredFrom = existingResult?.discoveredFrom;

    try {
      // Execute Hisense_FileRead remotely on TV
      // Must use relative path with ../../../
      const relativePath = `../../../${path}`;
      const result = await firstValueFrom(
        this.tvCommandService.executeFunction('Hisense_FileRead', [
          relativePath,
          0,
        ])
      );

      const content = result as string;

      if (!content || content === 'null' || content === 'undefined') {
        // File not found or access denied
        const result: FileAnalysis = {
          path,
          status: 'not-found',
          size: 0,
          isBinary: false,
          fileType: 'unknown',
          confidence: 0,
          extractedPaths: [],
          discoveredFrom, // Preserve source if available
          discoveryMethod: discoveredFrom ? 'extracted' : 'known-list',
          timestamp: new Date(),
        };

        this.session.results.set(path, result);
        this.session.failedReads++;
        this.resultsSubject.next(result);
        return;
      }

      // Analyze content
      const analysis = this.analyzeContent(path, content);

      // Preserve discoveredFrom from placeholder
      if (discoveredFrom) {
        analysis.discoveredFrom = discoveredFrom;
        analysis.discoveryMethod = 'extracted';
      }

      // Store result
      this.session.results.set(path, analysis);
      this.session.successfulReads++;

      if (analysis.isBinary) {
        this.session.binaryFiles++;
      } else {
        this.session.textFiles++;

        // Special handling for /proc/mounts - extract mount points
        if (path === '/proc/mounts') {
          const mountPaths = this.extractMountPaths(content);
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
          const homePaths = this.extractHomeDirPaths(content);
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
          const procPaths = this.extractProcPaths(path, content);
          if (procPaths.length > 0) {
            analysis.extractedPaths.push(...procPaths);
            this.consoleService.info(
              `Extracted ${procPaths.length} process paths from ${path}`,
              'FileExploration'
            );
          }
        }

        // Special handling for shell scripts (profile, bashrc, etc.) - extract paths from exports and source statements
        if (this.isShellScript(path)) {
          const shellPaths = this.extractShellScriptPaths(content);
          if (shellPaths.length > 0) {
            analysis.extractedPaths.push(...shellPaths);
            this.consoleService.info(
              `Extracted ${shellPaths.length} paths from shell script ${path}`,
              'FileExploration'
            );
          }
        }

        // Add discovered paths to queue
        if (analysis.extractedPaths.length > 0) {
          // Remove duplicates from extracted paths
          analysis.extractedPaths = Array.from(
            new Set(analysis.extractedPaths)
          );

          // Separate new paths from already known paths
          const newPaths: string[] = [];
          const ignoredPaths: string[] = [];

          for (const p of analysis.extractedPaths) {
            if (
              this.session &&
              (this.session.scanned.has(p) || this.session.queue.includes(p))
            ) {
              ignoredPaths.push(p);
            } else {
              newPaths.push(p);
            }
          }

          // Update extractedPaths to only contain new paths
          analysis.extractedPaths = newPaths;

          // Store ignored paths separately
          analysis.ignoredPaths = ignoredPaths;

          // Add discovered paths to end of queue with source tracking
          // They will be scanned after currently queued paths
          this.session.queue.push(...newPaths);
          this.session.totalPaths += newPaths.length;

          // Mark the source file for newly discovered paths
          for (const newPath of newPaths) {
            // Pre-create result entry with discoveredFrom metadata
            // This will be overwritten when the file is actually scanned
            // But we preserve the discoveredFrom field
            const existingResult = this.session.results.get(newPath);
            if (!existingResult) {
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
                discoveryMethod: 'extracted',
                timestamp: new Date(),
              };
              this.session.results.set(newPath, placeholder);
            }
          }

          this.consoleService.info(
            `Found ${newPaths.length} new paths in ${path} (${ignoredPaths.length} already known)`,
            'FileExploration'
          );
        }
      }

      this.resultsSubject.next(analysis);
    } catch (error) {
      const result: FileAnalysis = {
        path,
        status: 'error',
        size: 0,
        isBinary: false,
        fileType: 'error',
        confidence: 0,
        extractedPaths: [],
        discoveredFrom, // Preserve source if available
        discoveryMethod: discoveredFrom ? 'extracted' : 'known-list',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };

      this.session.results.set(path, result);
      this.session.failedReads++;
      this.resultsSubject.next(result);

      this.consoleService.error(
        `Error scanning ${path}: ${result.error}`,
        error,
        'FileExploration'
      );
    }
  }

  /**
   * Analyze file content
   */
  private analyzeContent(path: string, content: string): FileAnalysis {
    const size = content.length;

    // Detect if binary
    const binaryCheck = this.detectBinary(content);
    const isBinary = binaryCheck.isBinary;

    // Extract paths only from text files
    const extractedPaths = isBinary ? [] : this.extractPaths(content);

    // Generate preview
    const preview = isBinary
      ? `[Binary: ${binaryCheck.fileType}]`
      : content.slice(0, 10000);

    return {
      path,
      status: 'success',
      content,
      contentPreview: preview,
      size,
      isBinary,
      fileType: binaryCheck.fileType,
      encoding: isBinary ? 'binary' : 'utf-8',
      confidence: binaryCheck.confidence,
      magicBytes: binaryCheck.magicBytes,
      extractedPaths,
      discoveryMethod: 'known-list',
      timestamp: new Date(),
    };
  }

  /**
   * Detect if content is binary
   */
  private detectBinary(content: string): {
    isBinary: boolean;
    fileType: string;
    confidence: number;
    magicBytes: string;
  } {
    // Check magic bytes
    for (const [signature, type] of Object.entries(BINARY_SIGNATURES)) {
      if (content.startsWith(signature)) {
        return {
          isBinary: true,
          fileType: type,
          confidence: 1.0,
          magicBytes: this.formatMagicBytes(content.slice(0, 8)),
        };
      }
    }

    // Check for null bytes (strong indicator of binary)
    if (content.includes('\0')) {
      return {
        isBinary: true,
        fileType: 'binary',
        confidence: 1.0,
        magicBytes: this.formatMagicBytes(content.slice(0, 8)),
      };
    }

    // Calculate printable character ratio
    const printableChars = (content.match(/[\x20-\x7E\n\r\t]/g) || []).length;
    const ratio = printableChars / content.length;

    // Check for script shebang
    if (content.startsWith('#!')) {
      return {
        isBinary: false,
        fileType: 'script',
        confidence: 1.0,
        magicBytes: this.formatMagicBytes(content.slice(0, 8)),
      };
    }

    // If mostly printable, it's text
    if (ratio > 0.85) {
      return {
        isBinary: false,
        fileType: 'text',
        confidence: ratio,
        magicBytes: this.formatMagicBytes(content.slice(0, 8)),
      };
    }

    // Otherwise, probably binary
    return {
      isBinary: ratio < 0.7,
      fileType: ratio < 0.7 ? 'binary' : 'text',
      confidence: ratio,
      magicBytes: this.formatMagicBytes(content.slice(0, 8)),
    };
  }

  /**
   * Format magic bytes as hex string
   */
  private formatMagicBytes(content: string): string {
    return content
      .slice(0, 8)
      .split('')
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(' ');
  }

  /**
   * Extract paths from text content
   */
  private extractPaths(content: string): string[] {
    const paths = new Set<string>();

    // Apply all extraction patterns
    for (const [, pattern] of Object.entries(PATH_EXTRACTION_PATTERNS)) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const path = match[1];
        if (path && this.isValidPath(path)) {
          // Resolve shell variables
          const resolved = this.resolveVariables(path);
          // Only add if it looks like a file (not just a directory)
          if (this.looksLikeFile(resolved)) {
            paths.add(resolved);
          }
        }
      }
    }

    return Array.from(paths);
  }

  /**
   * Extract mount points from /proc/mounts content
   * Format: device mountpoint fstype options dump pass
   * Example: /dev/mtdblock4 /basic squashfs ro,relatime 0 0
   *
   * Note: We don't blindly probe for files in mount points anymore.
   * Files will be discovered through content analysis of other files that reference them.
   */
  private extractMountPaths(content: string): string[] {
    // Just log mount points for debugging, but don't generate file paths
    const lines = content.split('\n');
    const mountPoints: string[] = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        const mountPoint = parts[1];
        const fsType = parts[2];

        // Log interesting mount points (skip virtual filesystems)
        if (
          ![
            'devtmpfs',
            'proc',
            'tmpfs',
            'sysfs',
            'debugfs',
            'pstore',
            'devpts',
            'selinuxfs',
            'cgroup',
          ].includes(fsType) &&
          !['/dev', '/proc', '/sys', '/run'].some((skip) =>
            mountPoint.startsWith(skip)
          )
        ) {
          mountPoints.push(`${mountPoint} (${fsType})`);
        }
      }
    }

    if (mountPoints.length > 0) {
      this.consoleService.debug(
        `Found ${mountPoints.length} physical mount points: ${mountPoints.join(
          ', '
        )}`,
        'FileExploration'
      );
    }

    // Return empty array - rely on content-based discovery instead of blind probing
    return [];
  }

  /**
   * Extract home directory paths from /etc/passwd content
   * Format: username:x:uid:gid:info:home:shell
   * Example: root:x:0:0:root:/root:/bin/sh
   */
  private extractHomeDirPaths(content: string): string[] {
    const homePaths: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const parts = line.trim().split(':');
      if (parts.length >= 6) {
        const homeDir = parts[5];

        // Generate potential config files in home directory
        const candidates = [
          `${homeDir}/.bashrc`,
          `${homeDir}/.profile`,
          `${homeDir}/.bash_profile`,
          `${homeDir}/.config`,
          `${homeDir}/.ssh/config`,
        ];

        for (const candidate of candidates) {
          if (this.isValidPath(candidate) && this.looksLikeFile(candidate)) {
            homePaths.push(candidate);
          }
        }
      }
    }

    return homePaths;
  }

  /**
   * Extract process-related paths from /proc files
   * Intelligently discovers PIDs from process lists instead of blind counting
   */
  private extractProcPaths(path: string, content: string): string[] {
    const procPaths: string[] = [];

    // Extract PIDs from /proc/self/status (look for Pid: line)
    if (
      path.includes('/proc/self/status') ||
      path.match(/\/proc\/\d+\/status$/)
    ) {
      // Look for parent PID (PPid), thread group ID (Tgid), etc.
      const pidMatches = content.match(/(?:Pid|PPid|Tgid|TracerPid):\s+(\d+)/g);
      if (pidMatches) {
        for (const match of pidMatches) {
          const pid = match.match(/\d+/)?.[0];
          if (pid && pid !== '0') {
            // Add interesting files for this PID
            const candidates = [
              `/proc/${pid}/cmdline`,
              `/proc/${pid}/environ`,
              `/proc/${pid}/status`,
              `/proc/${pid}/maps`,
            ];
            procPaths.push(...candidates);
          }
        }
      }
    }

    // Extract PIDs from cmdline or environ content (they often reference other PIDs)
    if (path.includes('/cmdline') || path.includes('/environ')) {
      // Look for patterns like "pid=123" or "/proc/456"
      const pidRefs = content.match(/(?:pid[=:\s]+|\/proc\/)(\d+)/gi);
      if (pidRefs) {
        for (const match of pidRefs) {
          const pid = match.match(/\d+/)?.[0];
          if (pid && pid !== '0' && parseInt(pid) < 10000) {
            // Reasonable PID range
            procPaths.push(`/proc/${pid}/cmdline`);
            procPaths.push(`/proc/${pid}/status`);
          }
        }
      }
    }

    // Extract process-referenced files from maps (memory mapped files)
    if (path.includes('/maps')) {
      // Maps format: address perms offset dev inode pathname
      // Example: 7f1234567000-7f1234568000 r-xp 00000000 b3:02 12345 /lib/libc.so.6
      const mapMatches = content.match(
        /^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+(\/\S+)$/gm
      );
      if (mapMatches) {
        for (const match of mapMatches) {
          const filePath = match.split(/\s+/).pop();
          if (
            filePath &&
            this.isValidPath(filePath) &&
            this.looksLikeFile(filePath)
          ) {
            procPaths.push(filePath);
          }
        }
      }
    }

    // Extract file descriptors from /proc/self/fd/ references
    const fdMatches = content.match(/\/proc\/(?:self|\d+)\/fd\/\d+/g);
    if (fdMatches) {
      procPaths.push(...fdMatches);
    }

    return procPaths;
  }

  /**
   * Check if a path is a shell script
   */
  private isShellScript(path: string): boolean {
    const shellScriptPatterns = [
      /\/profile$/,
      /\/bashrc$/,
      /\/bash_profile$/,
      /\.sh$/,
      /\.bash$/,
      /\/init\.rc$/,
      /\/\.config$/,
      /global_env_setup\.ini$/,
    ];

    return shellScriptPatterns.some((pattern) => pattern.test(path));
  }

  /**
   * Extract paths from shell scripts (e.g., /etc/profile)
   * Handles:
   * - export statements with paths
   * - source statements with variable resolution
   * - LD_LIBRARY_PATH and PATH with multiple colon-separated entries
   * - Bash loops with path expansion (e.g., for INI_3RD in `ls ${PATH}`)
   */
  private extractShellScriptPaths(content: string): string[] {
    const paths = new Set<string>();

    // 1. Extract PATH and LD_LIBRARY_PATH entries
    const pathMatches = content.match(/(?:LD_LIBRARY_PATH|PATH)=([^\n]+)/g);
    if (pathMatches) {
      for (const match of pathMatches) {
        const pathValue = match.split('=')[1];
        // Split by colon and process each entry
        const entries = pathValue.split(':');
        for (let entry of entries) {
          entry = entry.trim();
          // Resolve variables
          entry = this.resolveVariables(entry);
          // Just log the directories - don't blindly probe for files
          // Real files will be discovered through other means (maps, source statements, etc.)
          if (entry.startsWith('/') && this.isValidPath(entry)) {
            this.consoleService.debug(
              `Found PATH/LD_LIBRARY_PATH directory: ${entry}`,
              'FileExploration'
            );
          }
        }
      }
    }

    // 2. Extract source/include statements with variable resolution
    // Example: source ${LINUX_BASIC_PATH}/3rd_ini/$INI_3RD/global_env_setup.ini
    const sourceMatches = content.match(
      /(?:source|\.)\s+([^\s;]+(?:global_env_setup\.ini|\.bashrc|\.profile|\.sh|\.bash))/g
    );
    if (sourceMatches) {
      for (const match of sourceMatches) {
        let path = match.replace(/^(?:source|\.)\s+/, '').trim();
        // Resolve variables first
        path = this.resolveVariables(path);

        // Handle dynamic paths like /basic/3rd_ini/$VAR/file
        // We'll try common subdirectories
        if (path.includes('$')) {
          const basePath = path.split('$')[0];
          // Try to expand with common patterns
          const expansions = this.expandDynamicPath(path, basePath);
          for (const expanded of expansions) {
            if (this.isValidPath(expanded) && this.looksLikeFile(expanded)) {
              paths.add(expanded);
            }
          }
        } else if (this.isValidPath(path) && this.looksLikeFile(path)) {
          paths.add(path);
        }
      }
    }

    // 3. Extract paths from file test conditions [ -f path ] (regular files only)
    // -f = regular file, -r = readable file, -x = executable (we want these)
    // -d = directory, -e = exists (we DON'T want these, could be directories)
    // Also matches negation: [ ! -f path ]
    // Note: These flags explicitly test for files, so we skip looksLikeFile() check
    const testMatches = content.match(/\[\s*!?\s*-[frx]\s+([^\]]+)\s*\]/g);
    if (testMatches) {
      for (const match of testMatches) {
        let path = match
          .replace(/\[\s*!?\s*-[frx]\s+/, '')
          .replace(/\s*\]/, '');
        path = this.resolveVariables(path);
        // Skip looksLikeFile() - if a script tests with -f/-r/-x, it IS a file
        if (this.isValidPath(path)) {
          paths.add(path);
        }
      }
    }

    // 4. Extract paths from bash loops
    // Example: for INI_3RD in `ls ${LINUX_BASIC_PATH}/3rd_ini`;
    const loopMatches = content.match(
      /for\s+\w+\s+in\s+`[^`]*\$\{?[\w_]+\}?([^`]+)`/g
    );
    if (loopMatches) {
      for (const match of loopMatches) {
        // Extract the directory being listed
        const dirMatch = match.match(/\$\{?([\w_]+)\}?([^`]*)/);
        if (dirMatch) {
          const varName = dirMatch[1];
          const suffix = dirMatch[2].replace(/^[^/]*/, ''); // Remove 'ls' or similar
          const resolvedBase = this.resolveVariables(`\${${varName}}`);
          const fullPath = `${resolvedBase}${suffix}`;

          // This is a directory being scanned, try to find config files in subdirectories
          // Example: /basic/3rd_ini/* -> try /basic/3rd_ini/*/global_env_setup.ini
          const candidates = [
            `${fullPath}/global_env_setup.ini`,
            `${fullPath}/.config`,
            `${fullPath}/config`,
          ];

          for (const candidate of candidates) {
            if (this.isValidPath(candidate)) {
              // For wildcard paths, we need to probe common subdirectories
              const expanded = this.expandWildcardPath(candidate);
              for (const exp of expanded) {
                if (this.looksLikeFile(exp)) {
                  paths.add(exp);
                }
              }
            }
          }
        }
      }
    }

    // 5. Extract paths from output redirections (>, >>)
    // Example: echo "text" > /path/to/file or command >> /var/log/file.log
    const redirectMatches = content.match(/(?:>>?|<)\s*([/\w\-.${}]+)/g);
    if (redirectMatches) {
      for (const match of redirectMatches) {
        let path = match.replace(/^(?:>>?|<)\s*/, '').trim();
        path = this.resolveVariables(path);
        if (this.isValidPath(path) && this.looksLikeFile(path)) {
          paths.add(path);
        }
      }
    }

    // 6. Extract paths from tee commands
    // Example: command | tee /path/to/file or command | tee -a /var/log/file.log
    const teeMatches = content.match(/\|\s*tee\s+(?:-a\s+)?([/\w\-.${}]+)/g);
    if (teeMatches) {
      for (const match of teeMatches) {
        let path = match.replace(/\|\s*tee\s+(?:-a\s+)?/, '').trim();
        path = this.resolveVariables(path);
        if (this.isValidPath(path) && this.looksLikeFile(path)) {
          paths.add(path);
        }
      }
    }

    // 7. Extract paths from file manipulation commands (touch, rm, cat, etc.)
    // Example: touch /tmp/file, rm /path/to/file, cat /etc/config
    const fileCommandMatches = content.match(
      /\b(?:touch|rm|cat|cp|mv|ln)\s+(?:-[a-z]+\s+)*([/\w\-.${}]+)/g
    );
    if (fileCommandMatches) {
      for (const match of fileCommandMatches) {
        let path = match
          .replace(/\b(?:touch|rm|cat|cp|mv|ln)\s+(?:-[a-z]+\s+)*/, '')
          .trim();
        path = this.resolveVariables(path);
        // Skip looksLikeFile() - these commands explicitly operate on files
        if (this.isValidPath(path)) {
          paths.add(path);
        }
      }
    }

    // 8. Extract absolute paths from command arguments
    // Example: /bin/app_launcher factoryservice /basic/bin/factory/factory_service_preload
    // Matches any absolute path (starting with /) in the script
    const absolutePathMatches = content.match(/(?:^|\s)([/][\w\-./]+)/gm);
    if (absolutePathMatches) {
      for (const match of absolutePathMatches) {
        let path = match.trim();
        path = this.resolveVariables(path);
        // Filter: Must be valid and look like a file (not just any path)
        if (this.isValidPath(path) && this.looksLikeFile(path)) {
          paths.add(path);
        }
      }
    }

    return Array.from(paths);
  }

  /**
   * Expand dynamic paths with variables
   * Example: /basic/3rd_ini/$VAR/file -> [/basic/3rd_ini/common/file, /basic/3rd_ini/vendor/file]
   */
  private expandDynamicPath(path: string, basePath: string): string[] {
    const expanded: string[] = [];

    // Common subdirectory names to try
    const commonDirs = [
      'common',
      'vendor',
      'system',
      'default',
      'main',
      'local',
      'user',
    ];

    // Extract the part after the variable
    const afterVar = path.split('$')[1]?.split('/').slice(1).join('/') || '';

    for (const dir of commonDirs) {
      const expandedPath = `${basePath}${dir}/${afterVar}`;
      expanded.push(expandedPath);
    }

    return expanded;
  }

  /**
   * Expand wildcard paths
   * Example: /basic/3rd_ini/asterisk/global_env_setup.ini (where asterisk is a wildcard)
   */
  private expandWildcardPath(path: string): string[] {
    if (!path.includes('*')) {
      return [path];
    }

    const expanded: string[] = [];
    const parts = path.split('*');
    const basePath = parts[0];
    const suffix = parts[1] || '';

    // Try common subdirectories
    const commonDirs = [
      'common',
      'vendor',
      'system',
      'default',
      'main',
      'local',
      'user',
    ];

    for (const dir of commonDirs) {
      expanded.push(`${basePath}${dir}${suffix}`);
    }

    return expanded;
  }

  /**
   * Check if a path looks like a file (not just a directory)
   */
  private looksLikeFile(path: string): boolean {
    // Exclude library paths (they are binaries anyway)
    if (path.includes('/lib/') || path.includes('/lib64/')) return false;
    if (path.endsWith('.so') || path.includes('.so.')) return false;

    // Allow executables in /bin/ and /sbin/ (they are files, not directories)
    // But block the directories themselves
    if (path === '/bin' || path === '/sbin') return false;
    if (path === '/usr/bin' || path === '/usr/sbin') return false;

    // Has file extension (e.g., .conf, .log, .sh)
    if (/\.[a-zA-Z0-9]+$/.test(path)) return true;

    // Known file patterns without extension
    const filePatterns = [
      /\/passwd$/,
      /\/shadow$/,
      /\/group$/,
      /\/hosts$/,
      /\/hostname$/,
      /\/profile$/,
      /\/bashrc$/,
      /\/bash_profile$/,
      /\/version$/,
      /\/release$/,
      /\/cmdline$/,
      /\/cpuinfo$/,
      /\/meminfo$/,
      /\/mounts$/,
      /\/environ$/,
      /\/status$/,
      /\/maps$/,
      /\/macro$/,
      /\/README$/,
      /\/LICENSE$/,
      /\/VERSION$/,
      /\/Makefile$/,
      /\/config\//, // Files in /config/ directories (e.g., /etc/config/openbox)
    ];

    if (filePatterns.some((pattern) => pattern.test(path))) return true;

    // If it's in /proc or /sys, it's often a file
    if (path.startsWith('/proc/') || path.startsWith('/sys/')) return true;

    return false;
  }

  /**
   * Resolve shell variables in path
   */
  private resolveVariables(path: string): string {
    let resolved = path;

    // Replace ${VAR} and $VAR
    for (const [varName, value] of Object.entries(SHELL_VARIABLES)) {
      resolved = resolved.replace(`\${${varName}}`, value);
      resolved = resolved.replace(`$${varName}`, value);
    }

    return resolved;
  }

  /**
   * Check if a path is valid
   */
  private isValidPath(path: string): boolean {
    // Must start with /
    if (!path.startsWith('/')) return false;

    // Must not contain spaces or special chars (except allowed ones)
    if (!/^[/\w\-.]+$/.test(path)) return false;

    // Must not be too short
    if (path.length < 4) return false;

    // Exclude obvious directory-only paths (no file extension, ends with /)
    if (path.endsWith('/')) return false;

    // Exclude paths that are clearly directories (common directory patterns)
    const dirPatterns = [
      /\/bin$/,
      /\/sbin$/,
      /\/lib$/,
      /\/usr$/,
      /\/etc$/,
      /\/var$/,
      /\/tmp$/,
      /\/opt$/,
      /\/home$/,
      /\/root$/,
      /\/dev$/,
      /\/proc$/,
      /\/sys$/,
      /\/mnt$/,
      /\/media$/,
      /\/srv$/,
      /\/run$/,
      /\/boot$/,
      /\/3rd$/,
      /\/3rd_rw$/,
      /\/basic$/,
      /\/perm$/,
      /\/persist$/,
      /\/data$/,
      /\/cache$/,
      /\/vendor$/,
      /\/system$/,
    ];

    if (dirPatterns.some((pattern) => pattern.test(path))) return false;

    return true;
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
}
