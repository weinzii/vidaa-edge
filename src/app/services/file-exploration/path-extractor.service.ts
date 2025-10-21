import { Injectable } from '@angular/core';
import { ConsoleService } from '../console.service';
import {
  PATH_EXTRACTION_PATTERNS,
  COMMON_FILENAMES,
} from '../../config/exploration-paths.config';

export interface ExtractedPaths {
  paths: string[];
  sourcePath: string;
  extractionMethod: string;
}

/**
 * Service for extracting file paths from various sources
 * Handles:
 * - Generic path patterns (absolute paths, quoted paths, etc.)
 * - Mount points from /proc/mounts
 * - Home directories from /etc/passwd
 * - Process paths from /proc/* files
 * - Shell script paths (exports, source statements, etc.)
 * - Path validation and filtering
 */
@Injectable({
  providedIn: 'root',
})
export class PathExtractorService {
  // Track known directories from PATH/LD_LIBRARY_PATH to avoid scanning them as files
  private knownDirectories = new Set<string>([
    '/bin',
    '/sbin',
    '/usr/bin',
    '/usr/sbin',
  ]);

  constructor(private consoleService: ConsoleService) {}

  /**
   * Extract paths from text content using configured patterns
   */
  public extractPaths(content: string): string[] {
    const paths = new Set<string>();

    // Apply all extraction patterns
    for (const [patternName, pattern] of Object.entries(
      PATH_EXTRACTION_PATTERNS
    )) {
      // Type assertion: PATH_EXTRACTION_PATTERNS values are always RegExp
      const regex = pattern as RegExp;
      regex.lastIndex = 0; // Reset regex state
      const matches = content.matchAll(regex);

      for (const match of matches) {
        // bashLoops pattern has 2 capture groups: group 1 = command binary, group 2 = argument path
        // sources pattern uses group 1 (simplified pattern)
        // All other patterns use group 1
        const captureGroups: string[] = [];

        if (patternName === 'bashLoops') {
          // Extract BOTH command (group 1) AND argument (group 2) as SEPARATE paths
          // Example: `for INI_3RD in ${LINUX_ROOTFS_PATH}/bin/ls ${LINUX_BASIC_PATH}/3rd_ini`
          // Group 1: /bin/ls (could be binary OR shell script - worth checking)
          // Group 2: /basic/3rd_ini (argument path)
          // They are TWO separate paths, not one combined path
          if (match[1]) captureGroups.push(match[1]); // Command (e.g., /bin/ls)
          if (match[2]) captureGroups.push(match[2]); // Argument path (e.g., /basic/3rd_ini)
        } else {
          if (match[1]) captureGroups.push(match[1]);
        }

        for (const path of captureGroups) {
          if (path && path.length > 0) {
            // Clean up path: remove quotes (at start/end AND around variables), whitespace, trailing dots, and normalize slashes
            const cleanPath = path
              .trim()
              .replace(/^["']|["']$/g, '') // Remove quotes at start/end
              .replace(/["'](\$\{?[\w_]+\}?)["']/g, '$1') // Remove quotes around variables: "$VAR" -> $VAR
              .replace(/\.{3,}$/, '') // Remove trailing ... or more dots
              .replace(/\/+/g, '/') // Replace multiple slashes with single slash
              .replace(/\/$/, ''); // Remove trailing slash

            if (this.isValidPath(cleanPath)) {
              paths.add(cleanPath);
            }
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
  public extractMountPaths(content: string): string[] {
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
        'PathExtractor'
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
  public extractHomeDirPaths(content: string): string[] {
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
  public extractProcPaths(path: string, content: string): string[] {
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
   * Extract paths from shell scripts (e.g., /etc/profile)
   * Handles:
   * - export statements with paths
   * - source statements with variable resolution
   * - LD_LIBRARY_PATH and PATH with multiple colon-separated entries
   * - Bash loops with path expansion (e.g., for INI_3RD in `ls ${PATH}`)
   */
  public extractShellScriptPaths(content: string): string[] {
    const paths = new Set<string>();

    // 1. Extract PATH and LD_LIBRARY_PATH entries
    // These directories are used to filter out directory paths from being scanned as files
    const pathMatches = content.match(/(?:LD_LIBRARY_PATH|PATH)=([^\n]+)/g);
    if (pathMatches) {
      for (const match of pathMatches) {
        const pathValue = match.split('=')[1];
        // Split by colon and add each directory to known directories set
        const entries = pathValue.split(':');
        for (const entry of entries) {
          const trimmed = entry.trim();
          if (trimmed.startsWith('/') && this.isValidPath(trimmed)) {
            this.knownDirectories.add(trimmed);
          }
        }
      }
    }

    // 2. Extract source/include statements
    // Example: source ${LINUX_BASIC_PATH}/3rd_ini/$INI_3RD/global_env_setup.ini
    const sourceMatches = content.match(
      /(?:source|\.)\s+([^\s;]+(?:global_env_setup\.ini|\.bashrc|\.profile|\.sh|\.bash))/g
    );
    if (sourceMatches) {
      for (const match of sourceMatches) {
        const path = match.replace(/^(?:source|\.)\s+/, '').trim();
        // Return raw path (variables will be handled by caller)
        if (this.isValidPath(path) || path.includes('$')) {
          paths.add(path);
        }
      }
    }

    // 3. Extract paths from file test conditions [ -f path ] (regular files only)
    // -f = regular file, -r = readable file, -x = executable (we want these)
    // -d = directory, -e = exists (we DON'T want these, could be directories)
    // Also matches negation: [ ! -f path ]
    const testMatches = content.match(/\[\s*!?\s*-[frx]\s+([^\]]+)\s*\]/g);
    if (testMatches) {
      for (const match of testMatches) {
        const path = match
          .replace(/\[\s*!?\s*-[frx]\s+/, '')
          .replace(/\s*\]/, '')
          .trim();
        // Skip looksLikeFile() - if a script tests with -f/-r/-x, it IS a file
        if (this.isValidPath(path) || path.includes('$')) {
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
          const suffix = dirMatch[2].replace(/^[^/]*/, ''); // Remove 'ls' or similar

          // This is a directory being scanned, try to find config files in subdirectories
          const candidates = [
            `${suffix}/global_env_setup.ini`,
            `${suffix}/.config`,
            `${suffix}/config`,
          ];

          for (const candidate of candidates) {
            if (this.isValidPath(candidate) || candidate.includes('$')) {
              paths.add(candidate);
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
        const path = match.replace(/^(?:>>?|<)\s*/, '').trim();
        if (
          (this.isValidPath(path) && this.looksLikeFile(path)) ||
          path.includes('$')
        ) {
          paths.add(path);
        }
      }
    }

    // 6. Extract paths from tee commands
    // Example: command | tee /path/to/file or command | tee -a /var/log/file.log
    const teeMatches = content.match(/\|\s*tee\s+(?:-a\s+)?([/\w\-.${}]+)/g);
    if (teeMatches) {
      for (const match of teeMatches) {
        const path = match.replace(/\|\s*tee\s+(?:-a\s+)?/, '').trim();
        if (
          (this.isValidPath(path) && this.looksLikeFile(path)) ||
          path.includes('$')
        ) {
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
        const path = match
          .replace(/\b(?:touch|rm|cat|cp|mv|ln)\s+(?:-[a-z]+\s+)*/, '')
          .trim();
        // Skip looksLikeFile() - these commands explicitly operate on files
        if (this.isValidPath(path) || path.includes('$')) {
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
        const path = match.trim();
        // Filter: Must be valid and look like a file (not just any path)
        if (
          (this.isValidPath(path) && this.looksLikeFile(path)) ||
          path.includes('$')
        ) {
          paths.add(path);
        }
      }
    }

    return Array.from(paths);
  }

  /**
   * Check if a path is a shell script
   */
  public isShellScript(path: string): boolean {
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
   * Check if a path looks like a file (not just a directory)
   */
  public looksLikeFile(path: string): boolean {
    // Exclude library paths (they are binaries anyway)
    if (path.includes('/lib/') || path.includes('/lib64/')) return false;
    if (path.endsWith('.so') || path.includes('.so.')) return false;

    // Block known directories from PATH/LD_LIBRARY_PATH
    // These are directories, not files, and should not be scanned
    if (this.knownDirectories.has(path)) return false;

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
   * Check if a path is valid
   */
  /**
   * Validate if a path is potentially valid for scanning
   * Rejects: commands, devices, directories, XML elements, kernel modules
   */
  public isValidPath(path: string): boolean {
    // Basic format validation
    if (
      path.length < 4 || // Too short
      path.endsWith('/') || // Directory marker
      (!path.startsWith('/') && !path.includes('$')) || // Not absolute or variable
      !/^[/\w\-.${}]+$/.test(path) // Invalid characters
    ) {
      return false;
    }

    // Reject command substitutions (backticks or $(...))
    if (path.includes('`') || path.includes('$(')) return false;

    // Reject specific path patterns
    if (
      path.startsWith('/dev/') || // Device files
      (path.includes('/lib/modules/') && path.endsWith('.ko')) // Kernel modules
    ) {
      return false;
    }

    // Reject single-segment paths (likely XML elements like /KEY_UP)
    const segments = path.split('/').filter((s) => s.length > 0);
    if (segments.length === 1) return false;

    // Reject common directory-only paths (consolidated regex)
    return !/\/(?:bin|sbin|lib|usr|etc|var|tmp|opt|home|root|dev|proc|sys|mnt|media|srv|run|boot|3rd|3rd_rw|basic|perm|persist|data|cache|vendor|system)$/.test(
      path
    );
  }

  /**
   * Expand directories to file paths by combining with common filenames
   */
  public expandDirectories(directories: string[]): string[] {
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
   * Expand dynamic paths with variables
   * Example: /basic/3rd_ini/$VAR/file -> [/basic/3rd_ini/common/file, /basic/3rd_ini/vendor/file]
   */
  public expandDynamicPath(path: string, basePath: string): string[] {
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
  public expandWildcardPath(path: string): string[] {
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
}
