import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConsoleService } from '../console.service';
import { TvCommandService } from '../tv-command.service';

export interface ScanResult {
  path: string;
  content: string | null;
  error?: string;
  status: 'success' | 'not-found' | 'error';
  tvProcessingTimeMs?: number; // Time TV took to process command
}

/**
 * Service for scanning individual files via remote TV commands
 * Handles:
 * - Remote file reading via Hisense_FileRead
 * - Path conversion (absolute to relative with ../../../)
 * - Error handling for missing/inaccessible files
 * - Result normalization
 */
@Injectable({
  providedIn: 'root',
})
export class FileScannerService {
  constructor(
    private consoleService: ConsoleService,
    private tvCommandService: TvCommandService
  ) {}

  /**
   * Scan a single file using remote TV command
   * Converts absolute paths to relative format required by TV API
   */
  public async scanFile(path: string): Promise<ScanResult> {
    try {
      // Execute Hisense_FileRead remotely on TV
      // Must use relative path with ../../../
      const relativePath = this.convertToRelativePath(path);
      const response = await firstValueFrom(
        this.tvCommandService.executeFunctionWithMetadata('Hisense_FileRead', [
          relativePath,
          0,
        ])
      );

      const content = response.data as string;

      if (!content || content === 'null' || content === 'undefined') {
        // File not found or access denied
        return {
          path,
          content: null,
          status: 'not-found',
          tvProcessingTimeMs: response.tvProcessingTimeMs,
        };
      }

      // Success
      return {
        path,
        content,
        status: 'success',
        tvProcessingTimeMs: response.tvProcessingTimeMs,
      };
    } catch (error) {
      // Error during execution
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check if it's a timeout error
      const isTimeout = errorMessage.includes('timeout');

      if (isTimeout) {
        this.consoleService.warn(
          `Timeout scanning ${path} (TV may be busy or file inaccessible)`,
          'FileScanner'
        );
      } else {
        this.consoleService.error(
          `Error scanning ${path}: ${errorMessage}`,
          error,
          'FileScanner'
        );
      }

      return {
        path,
        content: null,
        error: errorMessage,
        status: 'error',
      };
    }
  }

  /**
   * Convert absolute path to relative path format
   * Example: /etc/profile -> ../../../etc/profile
   */
  private convertToRelativePath(absolutePath: string): string {
    // Remove leading slash and prepend ../../../
    const cleanPath = absolutePath.startsWith('/')
      ? absolutePath.substring(1)
      : absolutePath;
    return `../../../${cleanPath}`;
  }

  /**
   * Validate if a path is scannable (basic checks)
   */
  public isScannablePath(path: string): boolean {
    // Must start with /
    if (!path.startsWith('/')) return false;

    // Must not be empty
    if (path.length < 2) return false;

    // Must not contain dangerous patterns
    const dangerousPatterns = [
      /\.\./, // Path traversal attempts
      /\/\//, // Double slashes
      /\s/, // Whitespace (usually not valid in Linux paths)
    ];

    if (dangerousPatterns.some((pattern) => pattern.test(path))) {
      this.consoleService.warn(
        `Path contains dangerous patterns: ${path}`,
        'FileScanner'
      );
      return false;
    }

    return true;
  }

  /**
   * Batch scan multiple files
   * Returns array of results in the same order as input paths
   */
  public async scanFiles(paths: string[]): Promise<ScanResult[]> {
    const results: ScanResult[] = [];

    for (const path of paths) {
      if (!this.isScannablePath(path)) {
        results.push({
          path,
          content: null,
          error: 'Invalid path format',
          status: 'error',
        });
        continue;
      }

      const result = await this.scanFile(path);
      results.push(result);
    }

    return results;
  }

  /**
   * Parallel scan multiple files (with concurrency limit)
   */
  public async scanFilesParallel(
    paths: string[],
    concurrency = 5
  ): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    const validPaths = paths.filter((p) => this.isScannablePath(p));

    // Process in batches
    for (let i = 0; i < validPaths.length; i += concurrency) {
      const batch = validPaths.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((path) => this.scanFile(path))
      );
      results.push(...batchResults);
    }

    return results;
  }
}
