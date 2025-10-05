import { Injectable } from '@angular/core';

export interface DirectoryEntry {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: string;
  children?: DirectoryEntry[];
}

export interface TreeNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  children: TreeNode[];
  size?: string;
  depth: number;
  isLast?: boolean;
  parent?: TreeNode;
}

interface DemoItem {
  name: string;
  type: 'file' | 'directory';
  size?: string;
  children?: DemoItem[];
}

@Injectable({
  providedIn: 'root',
})
export class DirectoryTreeService {
  private visitedPaths = new Set<string>();
  private traversalLog: string[] = [];
  private foundRootPath: string | null = null;

  // Root-Indikatoren für Unix/Linux Systeme
  private static readonly ROOT_INDICATORS = [
    'bin',
    'sbin',
    'usr',
    'var',
    'tmp',
    'etc',
    'lib',
    'opt',
    'root',
    'home',
    'dev',
    'proc',
    'sys',
    'mnt',
    'boot',
  ];

  // Verbotene/gefährliche Verzeichnisse
  private static readonly FORBIDDEN_DIRS = ['dev', 'proc', 'sys'];

  async buildDirectoryTree(): Promise<TreeNode | null> {
    this.clearState();
    this.log('🚀 Starting directory tree generation from current directory...');

    const startPath = '.'; // Immer vom aktuellen Verzeichnis starten

    try {
      // Erst Root finden
      await this.findRootDirectory(startPath);

      if (this.foundRootPath) {
        this.log(`✅ Root directory found: ${this.foundRootPath}`);
        return await this.buildTreeFromRoot();
      } else {
        this.log(
          '⚠️ Root directory not found, building from current directory'
        );
        return await this.buildTreeFromPath(startPath, 0);
      }
    } catch (error) {
      this.log(`❌ Error building tree: ${error}`);

      // Spezielle Behandlung für Filesystem-Zugriffsfehler
      if (
        error instanceof Error &&
        error.message.includes('File system access blocked')
      ) {
        this.log('');
        this.log('💡 EXPLANATION:');
        this.log(
          '🔒 File system access is blocked in browser environments for security'
        );
        this.log(
          '�️ This tool is designed to work on VIDAA TV with filesystem access'
        );
        this.log('');
        this.log('� WHAT YOU CAN DO:');
        this.log('📋 Click "Demo Tree" button to see how the interface works');
        this.log(
          '🌐 Deploy this app to a VIDAA TV for real filesystem exploration'
        );
        this.log(
          '🔧 On VIDAA TV: file:// protocol should work for directory traversal'
        );
      } else {
        this.log('🔒 File system access failed.');
        this.log('📋 Try the Demo Tree to test the interface.');
      }

      return null;
    }
  }

  private async findRootDirectory(
    currentPath: string,
    depth = 0
  ): Promise<void> {
    if (depth > 10) return; // Sicherheitsgrenze

    const normalizedPath = this.normalizePath(currentPath);

    if (this.visitedPaths.has(normalizedPath)) return;
    this.visitedPaths.add(normalizedPath);

    try {
      const rootCheck = await this.detectRootDirectory(normalizedPath);

      if (rootCheck.isRoot) {
        this.foundRootPath = normalizedPath;
        this.log(`🎯 ROOT DIRECTORY DETECTED: ${normalizedPath}`);
        this.log(
          `   Found indicators: ${rootCheck.foundIndicators.join(', ')}`
        );
        return;
      }

      // Versuche Parent-Directory
      if (!this.foundRootPath) {
        const parentPath = normalizedPath + '/..';
        await this.findRootDirectory(parentPath, depth + 1);
      }
    } catch (error) {
      this.log(`❌ Error checking ${normalizedPath}: ${error}`);
    }
  }

  private async detectRootDirectory(path: string): Promise<{
    isRoot: boolean;
    indicatorCount: number;
    foundIndicators: string[];
  }> {
    try {
      const content = await this.readDirectoryContent(path);
      const directories = this.parseDirectoryNames(content);

      const foundIndicators = directories.filter((dir) =>
        DirectoryTreeService.ROOT_INDICATORS.includes(dir.toLowerCase())
      );

      const indicatorCount = foundIndicators.length;

      // Root wenn mindestens 5 Indikatoren UND starke Indikatoren vorhanden
      const hasStrongIndicators = directories.some((dir) =>
        ['bin', 'sbin', 'usr', 'etc'].includes(dir.toLowerCase())
      );

      const isRoot = indicatorCount >= 5 && hasStrongIndicators;

      return {
        isRoot,
        indicatorCount,
        foundIndicators,
      };
    } catch {
      return { isRoot: false, indicatorCount: 0, foundIndicators: [] };
    }
  }

  private async buildTreeFromRoot(): Promise<TreeNode | null> {
    if (!this.foundRootPath) return null;

    this.log('📁 Building complete tree from root...');
    this.visitedPaths.clear();

    return await this.buildTreeFromPath(this.foundRootPath, 0);
  }

  private async buildTreeFromPath(
    path: string,
    depth: number,
    maxDepth = 10
  ): Promise<TreeNode | null> {
    if (depth >= maxDepth) return null;

    const normalizedPath = this.normalizePath(path);

    if (this.visitedPaths.has(normalizedPath)) return null;
    this.visitedPaths.add(normalizedPath);

    try {
      const content = await this.readDirectoryContent(normalizedPath);
      const entries = this.parseDirectoryContent(content);

      // Filtere sichere Verzeichnisse
      const safeEntries = entries.filter((entry) => {
        if (entry.type === 'file') return true;

        const lowerName = entry.name.toLowerCase();
        return (
          !DirectoryTreeService.FORBIDDEN_DIRS.includes(lowerName) &&
          !entry.name.startsWith('.') &&
          entry.name !== 'lost+found'
        );
      });

      this.log(
        `📂 [${depth}] ${normalizedPath} -> ${safeEntries.length} entries`
      );

      const node: TreeNode = {
        path: normalizedPath,
        name: this.getBaseName(normalizedPath),
        type: 'directory',
        children: [],
        depth,
      };

      // Rekursiv Kinder laden
      for (const entry of safeEntries) {
        if (entry.type === 'directory') {
          const childPath = normalizedPath + '/' + entry.name;
          const childNode = await this.buildTreeFromPath(
            childPath,
            depth + 1,
            maxDepth
          );

          if (childNode) {
            childNode.parent = node;
            node.children.push(childNode);
          }
        } else {
          // Datei-Knoten hinzufügen
          const fileNode: TreeNode = {
            path: normalizedPath + '/' + entry.name,
            name: entry.name,
            type: 'file',
            children: [],
            depth: depth + 1,
            size: entry.size,
            parent: node,
          };
          node.children.push(fileNode);
        }
      }

      return node;
    } catch (error) {
      this.log(`❌ Cannot access ${normalizedPath}: ${error}`);
      return null;
    }
  }

  private async readDirectoryContent(path: string): Promise<string> {
    // Versuche erst Hisense_FileRead für Dateien, dann XHR für Verzeichnisse
    return new Promise((resolve, reject) => {
      // Informiere über Environment
      if (typeof window !== 'undefined') {
        const isVidaaEnv = this.checkVidaaEnvironment();
        this.log(
          `🔧 Environment: ${
            isVidaaEnv
              ? 'VIDAA TV detected'
              : 'Browser environment - filesystem access may be limited'
          }`
        );

        // Prüfe ob Hisense_FileRead verfügbar ist
        const hisenseWindow = window as typeof window & {
          Hisense_FileRead?: (path: string, flag: number) => string;
        };
        if (typeof hisenseWindow.Hisense_FileRead === 'function') {
          this.log(`🎯 Hisense_FileRead available - trying File API first`);
          try {
            // Versuche Hisense File API für einzelne Dateien
            const fileContent = hisenseWindow.Hisense_FileRead(path, 1);
            if (fileContent && fileContent.length > 0) {
              this.log(
                `✅ Hisense_FileRead success - Content length: ${fileContent.length}`
              );
              resolve(fileContent);
              return;
            }
          } catch (error) {
            this.log(
              `⚠️ Hisense_FileRead failed: ${error} - falling back to XHR`
            );
          }
        }
      }

      // Fallback: XMLHttpRequest für Directory Listings
      const xhr = new XMLHttpRequest();
      const url = path.startsWith('file://') ? path : `file://${path}`;

      this.log(`🔍 Attempting XHR directory read: ${url}`);

      xhr.open('GET', url, true);
      xhr.timeout = 2000;

      xhr.onload = () => {
        this.log(
          `📄 XHR Response - Status: ${xhr.status}, Content length: ${
            xhr.responseText?.length || 0
          }`
        );
        if (xhr.status === 200 || xhr.status === 0) {
          resolve(xhr.responseText);
        } else {
          const error = new Error(
            `HTTP ${xhr.status} - File system access denied`
          );
          this.log(`❌ XHR Load Error: ${error.message}`);
          reject(error);
        }
      };

      xhr.onerror = () => {
        this.log(`❌ XHR Network Error: File system access blocked`);
        this.log(`💡 This is expected in browser environments`);
        this.log(`🖥️ On VIDAA TV: Both Hisense_FileRead and XHR should work`);
        this.log(`🌐 In browser: Both APIs are blocked for security`);

        const error = new Error(
          'File system access blocked - Expected behavior in browser environment'
        );
        reject(error);
      };

      xhr.ontimeout = () => {
        const error = new Error('File system access timeout');
        this.log(`❌ XHR Timeout: ${error.message}`);
        reject(error);
      };

      xhr.send();
    });
  }

  private checkVidaaEnvironment(): boolean {
    // Prüfe auf VIDAA-spezifische Funktionen oder Eigenschaften
    if (typeof window === 'undefined') return false;

    const hasHisenseFunctions = Object.getOwnPropertyNames(window).some(
      (name) => name.startsWith('Hisense_')
    );

    this.log(
      `🔧 Environment check - Hisense functions available: ${hasHisenseFunctions}`
    );
    return hasHisenseFunctions;
  }

  private parseDirectoryContent(htmlContent: string): DirectoryEntry[] {
    const lines = htmlContent.split('\n');
    const entries: DirectoryEntry[] = [];

    for (const line of lines) {
      if (!line.includes('addRow')) continue;

      try {
        // Format: addRow("name","displayName",type,"size", [...])
        const match = line.match(
          /addRow\("([^"]+)","[^"]*",(\d+),"([^"]*)"[^)]*\)/
        );
        if (!match) continue;

        const [, name, typeFlag, size] = match;
        const cleanName = name.trim();

        if (cleanName && cleanName !== '.' && cleanName !== '..') {
          entries.push({
            name: cleanName,
            type: typeFlag === '1' ? 'directory' : 'file',
            path: cleanName,
            size: size || undefined,
          });
        }
      } catch {
        // Ignoriere Parse-Fehler
      }
    }

    return entries;
  }

  private parseDirectoryNames(htmlContent: string): string[] {
    const entries = this.parseDirectoryContent(htmlContent);
    return entries.filter((e) => e.type === 'directory').map((e) => e.name);
  }

  generateAsciiTree(root: TreeNode | null): string {
    if (!root) return 'No directory tree available';

    const lines: string[] = [];
    this.buildAsciiTreeLines(root, '', true, lines);

    // Header hinzufügen
    const header = ['📁 Directory Tree', '═'.repeat(50), ''];

    return header.join('\n') + lines.join('\n');
  }

  private buildAsciiTreeLines(
    node: TreeNode,
    prefix: string,
    isLast: boolean,
    lines: string[]
  ): void {
    // Icon basierend auf Typ
    const icon = node.type === 'directory' ? '📁' : '📄';

    // Name mit optionaler Größe
    let displayName = node.name;
    if (node.size && node.type === 'file') {
      displayName += ` (${node.size})`;
    }

    // Tree-Zeichen
    const connector = isLast ? '└── ' : '├── ';

    lines.push(prefix + connector + icon + ' ' + displayName);

    // Kinder sortieren: Verzeichnisse zuerst, dann alphabetisch
    const sortedChildren = [...node.children].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    // Kinder rekursiv hinzufügen
    sortedChildren.forEach((child, index) => {
      const isChildLast = index === sortedChildren.length - 1;
      const childPrefix = prefix + (isLast ? '    ' : '│   ');

      this.buildAsciiTreeLines(child, childPrefix, isChildLast, lines);
    });
  }

  generateTreeStats(root: TreeNode | null): string {
    if (!root) return 'No statistics available';

    const stats = this.calculateTreeStats(root);

    return [
      '📊 Tree Statistics',
      '═'.repeat(30),
      `Total Directories: ${stats.directories}`,
      `Total Files: ${stats.files}`,
      `Max Depth: ${stats.maxDepth}`,
      `Total Nodes: ${stats.directories + stats.files}`,
      `Root Path: ${root.path}`,
    ].join('\n');
  }

  private calculateTreeStats(node: TreeNode): {
    directories: number;
    files: number;
    maxDepth: number;
  } {
    let directories = node.type === 'directory' ? 1 : 0;
    let files = node.type === 'file' ? 1 : 0;
    let maxDepth = node.depth;

    for (const child of node.children) {
      const childStats = this.calculateTreeStats(child);
      directories += childStats.directories;
      files += childStats.files;
      maxDepth = Math.max(maxDepth, childStats.maxDepth);
    }

    return { directories, files, maxDepth };
  }

  private normalizePath(path: string): string {
    return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }

  private getBaseName(path: string): string {
    if (path === '/' || path === '') return '/';
    return path.split('/').pop() || path;
  }

  private clearState(): void {
    this.visitedPaths.clear();
    this.traversalLog = [];
    this.foundRootPath = null;
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString().slice(11, 23);
    const logEntry = `[${timestamp}] ${message}`;
    this.traversalLog.push(logEntry);
  }

  getTraversalLog(): string {
    return this.traversalLog.join('\n');
  }

  // Demo-Funktion für Test-Tree
  generateDemoTree(): TreeNode {
    const root: TreeNode = {
      path: '/',
      name: '/',
      type: 'directory',
      children: [],
      depth: 0,
    };

    // Simuliere typische VIDAA Verzeichnisstruktur
    const demoStructure = [
      {
        name: 'opt',
        type: 'directory' as const,
        children: [
          {
            name: 'vidaa',
            type: 'directory' as const,
            children: [
              {
                name: 'apps',
                type: 'directory' as const,
                children: [
                  {
                    name: 'launcher',
                    type: 'directory' as const,
                    children: [
                      {
                        name: 'Appinfo.json',
                        type: 'file' as const,
                        size: '2.4 kB',
                      },
                      {
                        name: 'preset.txt',
                        type: 'file' as const,
                        size: '1.2 kB',
                      },
                    ],
                  },
                  {
                    name: 'browser',
                    type: 'directory' as const,
                    children: [
                      {
                        name: 'index.html',
                        type: 'file' as const,
                        size: '15.6 kB',
                      },
                      {
                        name: 'main.js',
                        type: 'file' as const,
                        size: '234.1 kB',
                      },
                    ],
                  },
                ],
              },
              {
                name: 'config',
                type: 'directory' as const,
                children: [
                  {
                    name: 'system.conf',
                    type: 'file' as const,
                    size: '8.9 kB',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'etc',
        type: 'directory' as const,
        children: [
          { name: 'passwd', type: 'file' as const, size: '1.8 kB' },
          { name: 'hosts', type: 'file' as const, size: '245 B' },
        ],
      },
      {
        name: 'root',
        type: 'directory' as const,
        children: [{ name: '.profile', type: 'file' as const, size: '675 B' }],
      },
      {
        name: 'usr',
        type: 'directory' as const,
        children: [
          {
            name: 'bin',
            type: 'directory' as const,
            children: [
              { name: 'busybox', type: 'file' as const, size: '1.2 MB' },
            ],
          },
        ],
      },
    ];

    this.buildDemoNode(root, demoStructure, 0);
    return root;
  }

  private buildDemoNode(
    parent: TreeNode,
    structure: DemoItem[],
    depth: number
  ): void {
    for (const item of structure) {
      const node: TreeNode = {
        path: parent.path + '/' + item.name,
        name: item.name,
        type: item.type,
        children: [],
        depth: depth + 1,
        parent: parent,
        size: item.size,
      };

      parent.children.push(node);

      if (item.children) {
        this.buildDemoNode(node, item.children, depth + 1);
      }
    }
  }
}
