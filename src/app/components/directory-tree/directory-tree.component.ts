import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DirectoryTreeService,
  TreeNode,
} from '../../services/directory-tree.service';

@Component({
  selector: 'app-directory-tree',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="directory-tree-container">
      <div class="header">
        <h2>📁 VIDAA Directory Tree Explorer</h2>
        <div class="controls">
          <button
            (click)="generateTree()"
            [disabled]="isLoading"
            class="generate-btn"
          >
            {{ isLoading ? 'Building Tree...' : 'Generate Tree' }}
          </button>
          <button
            (click)="clearTree()"
            [disabled]="!treeOutput"
            class="clear-btn"
          >
            Clear
          </button>
          <button (click)="generateDemoTree()" class="demo-btn">
            📋 Demo Tree
          </button>
        </div>
      </div>

      <div class="status-bar" *ngIf="statusMessage">
        <span [class]="statusClass">{{ statusMessage }}</span>
      </div>

      <div class="content-tabs" *ngIf="treeOutput || logOutput">
        <div class="tab-headers">
          <button
            *ngIf="treeOutput"
            (click)="activeTab = 'tree'"
            [class.active]="activeTab === 'tree'"
            class="tab-btn"
          >
            🌳 Tree View
          </button>
          <button
            *ngIf="treeOutput"
            (click)="activeTab = 'stats'"
            [class.active]="activeTab === 'stats'"
            class="tab-btn"
          >
            📊 Statistics
          </button>
          <button
            *ngIf="logOutput"
            (click)="activeTab = 'log'"
            [class.active]="activeTab === 'log'"
            class="tab-btn"
          >
            📋 Debug Log
          </button>
        </div>

        <div class="tab-content">
          <!-- Tree View -->
          <div *ngIf="activeTab === 'tree'" class="tree-view">
            <div class="tree-actions">
              <button (click)="copyToClipboard(treeOutput)" class="copy-btn">
                📋 Copy Tree
              </button>
              <button (click)="downloadTree()" class="download-btn">
                💾 Download
              </button>
              <div class="search-box">
                <input
                  type="text"
                  [(ngModel)]="searchTerm"
                  (input)="filterTree()"
                  placeholder="Search in tree..."
                  class="search-input"
                />
                <span *ngIf="filteredResults > 0" class="search-results">
                  {{ filteredResults }} matches
                </span>
              </div>
            </div>
            <pre class="tree-output" [innerHTML]="displayedTree"></pre>
          </div>

          <!-- Statistics -->
          <div *ngIf="activeTab === 'stats'" class="stats-view">
            <pre class="stats-output">{{ statisticsOutput }}</pre>

            <div class="additional-stats" *ngIf="rootNode">
              <h4>📈 Detailed Analysis</h4>
              <div class="stat-grid">
                <div class="stat-card">
                  <span class="stat-label">Deepest Path:</span>
                  <span class="stat-value">{{ getDeepestPath() }}</span>
                </div>
                <div class="stat-card">
                  <span class="stat-label">Largest Directory:</span>
                  <span class="stat-value">{{ getLargestDirectory() }}</span>
                </div>
                <div class="stat-card">
                  <span class="stat-label">File Types Found:</span>
                  <span class="stat-value">{{ getFileTypesCount() }}</span>
                </div>
                <div class="stat-card">
                  <span class="stat-label">Empty Directories:</span>
                  <span class="stat-value">{{
                    getEmptyDirectoriesCount()
                  }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Debug Log -->
          <div *ngIf="activeTab === 'log'" class="log-view">
            <div class="log-actions">
              <button (click)="copyToClipboard(logOutput)" class="copy-btn">
                📋 Copy Log
              </button>
              <button (click)="clearLog()" class="clear-btn">
                🗑️ Clear Log
              </button>
            </div>
            <textarea
              class="log-output"
              [value]="logOutput"
              readonly
            ></textarea>
          </div>
        </div>
      </div>

      <div class="help-section" *ngIf="!treeOutput && !isLoading">
        <h3>🛠️ How to Use</h3>
        <p class="simple-instruction">
          Click <strong>"Generate Tree"</strong> to explore the complete
          directory structure starting from the current location.
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .directory-tree-container {
        max-width: 1200px;
        margin: 20px auto;
        padding: 20px;
        background: #1a1a1a;
        border-radius: 8px;
        color: #e0e0e0;
        font-family: 'Monaco', 'Consolas', monospace;
      }

      .header {
        margin-bottom: 20px;
        border-bottom: 2px solid #333;
        padding-bottom: 15px;
      }

      .header h2 {
        margin: 0 0 15px 0;
        color: #4a9eff;
        text-align: center;
      }

      .controls {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }

      .generate-btn,
      .clear-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.2s;
      }

      .generate-btn {
        background: #28a745;
        color: white;
      }

      .generate-btn:hover:not(:disabled) {
        background: #218838;
      }

      .generate-btn:disabled {
        background: #555;
        cursor: not-allowed;
      }

      .clear-btn {
        background: #dc3545;
        color: white;
      }

      .clear-btn:hover:not(:disabled) {
        background: #c82333;
      }

      .demo-btn {
        background: #17a2b8;
        color: white;
      }

      .demo-btn:hover {
        background: #138496;
      }

      .status-bar {
        margin: 10px 0;
        padding: 10px;
        border-radius: 4px;
        text-align: center;
      }

      .status-success {
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
      }

      .status-error {
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
      }

      .status-info {
        background: #d1ecf1;
        color: #0c5460;
        border: 1px solid #bee5eb;
      }

      .tab-headers {
        display: flex;
        border-bottom: 2px solid #333;
        margin-bottom: 15px;
      }

      .tab-btn {
        padding: 10px 20px;
        background: transparent;
        border: none;
        color: #888;
        cursor: pointer;
        border-bottom: 3px solid transparent;
        transition: all 0.2s;
      }

      .tab-btn:hover {
        color: #e0e0e0;
        background: #2a2a2a;
      }

      .tab-btn.active {
        color: #4a9eff;
        border-bottom-color: #4a9eff;
      }

      .tree-actions,
      .log-actions {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
        align-items: center;
        flex-wrap: wrap;
      }

      .copy-btn,
      .download-btn {
        padding: 6px 12px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }

      .copy-btn:hover,
      .download-btn:hover {
        background: #0056b3;
      }

      .search-box {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-left: auto;
      }

      .search-input {
        padding: 6px 10px;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 4px;
        color: #e0e0e0;
        width: 200px;
      }

      .search-results {
        font-size: 12px;
        color: #28a745;
      }

      .tree-output,
      .stats-output {
        background: #0d1117;
        padding: 15px;
        border-radius: 4px;
        border: 1px solid #333;
        overflow-x: auto;
        white-space: pre;
        font-family: 'Fira Code', monospace;
        font-size: 13px;
        line-height: 1.4;
        max-height: 600px;
        overflow-y: auto;
      }

      .log-output {
        background: #0d1117;
        color: #e0e0e0;
        padding: 15px;
        border-radius: 4px;
        border: 1px solid #333;
        font-family: 'Fira Code', monospace;
        font-size: 13px;
        line-height: 1.4;
        width: 100%;
        min-height: 400px;
        max-height: 600px;
        resize: vertical;
        white-space: pre;
      }

      .stat-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 15px;
        margin-top: 15px;
      }

      .stat-card {
        background: #2a2a2a;
        padding: 15px;
        border-radius: 6px;
        border-left: 4px solid #4a9eff;
      }

      .stat-label {
        display: block;
        font-size: 12px;
        color: #888;
        margin-bottom: 5px;
      }

      .stat-value {
        display: block;
        font-size: 14px;
        color: #e0e0e0;
        font-weight: bold;
      }

      .help-section {
        background: #2a2a2a;
        padding: 20px;
        border-radius: 6px;
        margin-top: 20px;
      }

      .help-section h3,
      .help-section h4 {
        color: #4a9eff;
        margin-top: 0;
      }

      .help-section ul {
        line-height: 1.6;
      }

      .simple-instruction {
        font-size: 16px;
        line-height: 1.6;
        color: #e0e0e0;
        text-align: center;
        padding: 20px;
        background: #333;
        border-radius: 8px;
        border-left: 4px solid #4a9eff;
      }

      .example-paths {
        margin-top: 20px;
      }

      /* Highlight für Suchergebnisse */
      .highlight {
        background-color: #ffd700;
        color: #000;
        padding: 1px 2px;
        border-radius: 2px;
      }

      @media (max-width: 768px) {
        .controls {
          flex-direction: column;
          align-items: stretch;
        }

        .path-input {
          min-width: auto;
          width: 100%;
        }

        .search-box {
          margin-left: 0;
          margin-top: 10px;
        }

        .stat-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class DirectoryTreeComponent {
  startPath = '.';
  isLoading = false;
  treeOutput = '';
  statisticsOutput = '';
  logOutput = '';
  statusMessage = '';
  statusClass = '';
  activeTab = 'tree';
  searchTerm = '';
  filteredResults = 0;
  displayedTree = '';
  rootNode: TreeNode | null = null;

  constructor(private directoryTreeService: DirectoryTreeService) {}

  async generateTree(): Promise<void> {
    if (this.isLoading) return;

    this.isLoading = true;
    this.statusMessage = 'Building directory tree from current directory...';
    this.statusClass = 'status-info';
    this.clearTree();

    try {
      this.rootNode = await this.directoryTreeService.buildDirectoryTree();

      if (this.rootNode) {
        this.treeOutput = this.directoryTreeService.generateAsciiTree(
          this.rootNode
        );
        this.statisticsOutput = this.directoryTreeService.generateTreeStats(
          this.rootNode
        );
        this.logOutput = this.directoryTreeService.getTraversalLog();
        this.displayedTree = this.treeOutput;

        this.statusMessage = '✅ Directory tree generated successfully!';
        this.statusClass = 'status-success';
      } else {
        this.statusMessage =
          '⚠️ Could not generate directory tree. Check Log tab for details.';
        this.statusClass = 'status-error';
        this.logOutput = this.directoryTreeService.getTraversalLog();
        this.activeTab = 'log'; // Automatisch zum Log-Tab wechseln
      }
    } catch (error) {
      this.statusMessage = `❌ Error generating tree: ${error}`;
      this.statusClass = 'status-error';
      this.logOutput = this.directoryTreeService.getTraversalLog();
      this.activeTab = 'log'; // Automatisch zum Log-Tab wechseln
    } finally {
      this.isLoading = false;
    }
  }

  clearTree(): void {
    this.treeOutput = '';
    this.statisticsOutput = '';
    this.logOutput = '';
    this.displayedTree = '';
    this.statusMessage = '';
    this.rootNode = null;
    this.searchTerm = '';
    this.filteredResults = 0;
  }

  clearLog(): void {
    this.logOutput = '';
  }

  generateDemoTree(): void {
    this.clearTree();

    // Lade Demo-Tree vom Service
    this.rootNode = this.directoryTreeService.generateDemoTree();
    this.treeOutput = this.directoryTreeService.generateAsciiTree(
      this.rootNode
    );
    this.statisticsOutput = this.directoryTreeService.generateTreeStats(
      this.rootNode
    );
    this.displayedTree = this.treeOutput;
    this.logOutput = 'Demo tree generated successfully!';

    this.statusMessage = '📋 Demo tree loaded!';
    this.statusClass = 'status-success';

    setTimeout(() => {
      this.statusMessage = '';
    }, 3000);
  }

  filterTree(): void {
    if (!this.searchTerm.trim() || !this.treeOutput) {
      this.displayedTree = this.treeOutput;
      this.filteredResults = 0;
      return;
    }

    const searchRegex = new RegExp(
      `(${this.escapeRegex(this.searchTerm)})`,
      'gi'
    );
    const lines = this.treeOutput.split('\n');
    let matchCount = 0;

    const filteredLines = lines
      .filter((line) => {
        if (searchRegex.test(line)) {
          matchCount++;
          return true;
        }
        return false;
      })
      .map((line) => {
        return line.replace(searchRegex, '<span class="highlight">$1</span>');
      });

    this.displayedTree = filteredLines.join('\n');
    this.filteredResults = matchCount;
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.statusMessage = '📋 Copied to clipboard!';
      this.statusClass = 'status-success';
      setTimeout(() => {
        this.statusMessage = '';
      }, 2000);
    } catch {
      // Fallback für ältere Browser
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);

      this.statusMessage = '📋 Copied to clipboard!';
      this.statusClass = 'status-success';
      setTimeout(() => {
        this.statusMessage = '';
      }, 2000);
    }
  }

  downloadTree(): void {
    if (!this.treeOutput) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `vidaa-directory-tree-${timestamp}.txt`;

    const content = [
      'VIDAA Directory Tree Export',
      '='.repeat(50),
      `Generated: ${new Date().toISOString()}`,
      `Start Path: ${this.startPath}`,
      '',
      this.statisticsOutput,
      '',
      this.treeOutput,
      '',
      '--- Debug Log ---',
      this.logOutput,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  // Statistik-Hilfsmethoden
  getDeepestPath(): string {
    if (!this.rootNode) return 'N/A';

    let deepestPath = this.rootNode.path;
    let maxDepth = this.rootNode.depth;

    this.findDeepestPath(this.rootNode, (node) => {
      if (node.depth > maxDepth) {
        maxDepth = node.depth;
        deepestPath = node.path;
      }
    });

    return `${deepestPath} (depth: ${maxDepth})`;
  }

  getLargestDirectory(): string {
    if (!this.rootNode) return 'N/A';

    let largestDir = this.rootNode.name;
    let maxChildren = this.rootNode.children.length;

    this.findDeepestPath(this.rootNode, (node) => {
      if (node.type === 'directory' && node.children.length > maxChildren) {
        maxChildren = node.children.length;
        largestDir = node.name;
      }
    });

    return `${largestDir} (${maxChildren} items)`;
  }

  getFileTypesCount(): string {
    if (!this.rootNode) return 'N/A';

    const extensions = new Set<string>();

    this.findDeepestPath(this.rootNode, (node) => {
      if (node.type === 'file') {
        const ext = node.name.split('.').pop();
        if (ext && ext !== node.name) {
          extensions.add(ext.toLowerCase());
        }
      }
    });

    return extensions.size.toString();
  }

  getEmptyDirectoriesCount(): string {
    if (!this.rootNode) return 'N/A';

    let emptyCount = 0;

    this.findDeepestPath(this.rootNode, (node) => {
      if (node.type === 'directory' && node.children.length === 0) {
        emptyCount++;
      }
    });

    return emptyCount.toString();
  }

  private findDeepestPath(
    node: TreeNode,
    callback: (node: TreeNode) => void
  ): void {
    callback(node);
    for (const child of node.children) {
      this.findDeepestPath(child, callback);
    }
  }
}
