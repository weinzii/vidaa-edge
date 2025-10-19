/**
 * Configuration file for file system exploration paths.
 * Add or modify paths here to customize the scanning behavior.
 */

export interface PathCategory {
  name: string;
  description: string;
  priority: number; // Higher = scanned first
  files: string[]; // Specific files to scan
  directories?: string[]; // Directories to explore (will look for common files)
}

/**
 * Common filenames to look for in directories
 * ONLY critical files that are likely to exist and contain useful info
 */
export const COMMON_FILENAMES = ['config', 'version', 'build.macro', '.config'];

/**
 * Known paths to scan on Hisense TV systems.
 * Edit this array to add new paths or modify existing ones.
 */
export const EXPLORATION_PATHS: PathCategory[] = [
  {
    name: 'Critical Bootstrap',
    description: 'High-value files that contain many path references',
    priority: 100,
    files: [
      '/etc/profile',
      '/proc/mounts',
      '/proc/version',
      '/proc/cpuinfo',
      '/proc/meminfo',
      '/proc/cmdline',
    ],
  },

  {
    name: 'System Information',
    description: 'User and system configuration files',
    priority: 90,
    files: [
      '/etc/passwd',
      '/etc/group',
      '/etc/shadow',
      '/etc/hosts',
      '/etc/hostname',
      '/etc/resolv.conf',
      '/etc/os-release',
    ],
  },

  {
    name: 'Hisense Specific',
    description: 'TV-specific paths from /etc/profile analysis',
    priority: 80,
    files: [
      '/basic/build.macro',
      '/basic/version',
      '/vendor/tvconfig/config',
      '/system/build.prop',
    ],
    // Only expand critical directories that are likely to have config files
    directories: ['/basic', '/vendor/tvconfig'],
  },

  {
    name: 'Init Scripts',
    description: 'System initialization and startup scripts',
    priority: 70,
    files: [
      '/etc/init.d/rcS',
      '/etc/init.d/functions',
      '/etc/init.d/common/init_coredump.rc',
      '/etc/init.d/network',
      '/etc/init.d/syslog',
    ],
    // Removed directory expansion - rely on path discovery from file contents
  },

  {
    name: 'Log Files',
    description: 'System and application logs',
    priority: 50,
    files: [
      '/var/log/messages',
      '/var/log/syslog',
      '/var/log/dmesg',
      '/var/log/kern.log',
      '/tmp/app.log',
      '/tmp/system.log',
    ],
    // Removed directory expansion - most log files won't have useful paths
  },

  {
    name: 'Process Information',
    description: 'Running process details',
    priority: 40,
    files: [
      '/proc/self/cmdline',
      '/proc/self/environ',
      '/proc/self/maps',
      '/proc/self/status',
      // Note: Process PIDs will be extracted dynamically from /proc/self/status and other sources
      // instead of blind counting
    ],
  },

  {
    name: 'Network Configuration',
    description: 'Network interfaces and configuration',
    priority: 30,
    files: [
      '/sys/class/net/eth0/address',
      '/sys/class/net/wlan0/address',
      '/proc/net/route',
      '/proc/net/arp',
    ],
  },
];

/**
 * Regex patterns for extracting paths from file content.
 * These patterns are applied to ASCII files to discover new paths.
 */
export const PATH_EXTRACTION_PATTERNS = {
  // Absolute Unix paths: /path/to/file
  absolutePaths: /(?:^|[\s"'=])(\/(?:[\w\-.]+\/?)+)/g,

  // Shell export statements: export VAR=/path
  exports: /export\s+\w+=([\w\-.\/]+)/g,

  // Shell variables with paths: ${VAR}/path or $VAR/path
  shellVars: /\$\{?[\w_]+\}?(\/[\w\-.\/${}]+)/g,

  // Source/include statements: source /path/to/file or source ${VAR}/path
  sources: /(?:source|include|require)\s+([\w\-.\/${}]+)/g,

  // File test conditions: [ -f /path/to/file ] or [ -f ${VAR}/path ]
  fileTests: /\[\s*-[a-z]\s+([\w\-.\/${}]+)\s*\]/g,

  // LD_LIBRARY_PATH and PATH entries (split by colon)
  ldPath: /(?:LD_LIBRARY_PATH|PATH)=[^\n]*/g,

  // Log file references: log=/path, file=/path
  logRefs: /(?:log|file|path|config)[:=]\s*([^\s,;"']+)/gi,

  // Mount points from /proc/mounts: device /mountpoint fstype
  mounts: /^\S+\s+(\/\S+)\s+\w+/gm,

  // passwd format: extract home directories (6th field)
  passwdHomes: /^[^:]+:[^:]+:\d+:\d+:[^:]*:([^:]+):/gm,

  // Bash loops with paths: for VAR in `ls ${PATH}`;
  bashLoops: /for\s+\w+\s+in\s+`[^`]*\$\{?[\w_]+\}?([^`]+)`/g,

  // Output redirections: echo "text" > /path or command >> /path
  redirections: /(?:>>?|<)\s*([\/\w\-.${}]+)/g,

  // Pipe to tee: command | tee /path
  teeCommands: /\|\s*tee\s+(?:-a\s+)?([\/\w\-.${}]+)/g,
};

/**
 * Shell variable mappings extracted from /etc/profile
 * Used to resolve ${VAR} references in paths
 */
export const SHELL_VARIABLES: Record<string, string> = {
  LINUX_BASIC_PATH: '/basic',
  LINUX_3RD_PATH: '/3rd',
  LINUX_3RD_RW_PATH: '/3rd_rw',
  LINUX_ETC_PATH: '/linux_rootfs/etc',
  LINUX_PERM_PATH: '/perm',
  LINUX_ROOTFS_PATH: '/',
  LINUX_TMP_PATH: '/tmp',
  LINUX_PERSIST_PATH: '/persist',
  LINUX_RECIPE_PATH: '/recipe',
  FUSION_LINUX_DUSDATA_PATH: '/cusdata',
  FUSION_LINUX_DATA_PATH: '/data',
  FUSION_LINUX_CACHE_PATH: '/cache',
  FUSION_LINUX_EXTDEVUPG_PATH: '/ExtDevUpgrade',
  MTK_3RD_EXE_PATH: '/3rd',
  MTK_3RD_DATA_PATH: '/data',
};

/**
 * File extensions that are typically ASCII/text files
 */
export const TEXT_FILE_EXTENSIONS = [
  '.txt',
  '.log',
  '.conf',
  '.config',
  '.ini',
  '.sh',
  '.bash',
  '.json',
  '.xml',
  '.yaml',
  '.yml',
  '.properties',
  '.rc',
  '.profile',
  '.bashrc',
  '.env',
  '.macro',
];

/**
 * Binary file signatures (magic bytes)
 */
export const BINARY_SIGNATURES: Record<string, string> = {
  '\x7FELF': 'ELF executable',
  '\x89PNG\r\n\x1a\n': 'PNG image',
  '\xFF\xD8\xFF': 'JPEG image',
  GIF87a: 'GIF image',
  GIF89a: 'GIF image',
  '%PDF': 'PDF document',
  'PK\x03\x04': 'ZIP archive',
  '\x1f\x8b': 'GZIP compressed',
};

/**
 * Maximum file size to read (in bytes)
 * Files larger than this will be marked but not fully read
 */
export const MAX_FILE_SIZE = 1024 * 1024; // 1 MB

/**
 * Scan rate limiting
 */
export const SCAN_CONFIG = {
  delayBetweenFiles: 50, // ms delay between file scans (sequential) - faster polling
  maxRetries: 2, // Retry failed reads
  timeout: 10000, // Timeout per file read (ms)
};
