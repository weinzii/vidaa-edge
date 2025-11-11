import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileAnalysis } from '../../../models/file-exploration';

interface DiscoveryChainItem {
  path: string | null;
  name: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'app-file-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-details.component.html',
  styleUrls: ['./file-details.component.css'],
})
export class FileDetailsComponent {
  @Input() selectedFile: FileAnalysis | null = null;
  @Input() viewMode: 'list' | 'tree' = 'list'; // New input for view mode
  @Input() allResults: FileAnalysis[] = []; // All results for chain traversal
  @Input() isLoadingContent = false; // Loading indicator for on-demand content fetch
  @Input() isBrowseMode = false; // Whether in browse mode (read-only)
  @Output() fileSelected = new EventEmitter<string>(); // For clicking on extracted paths
  @Output() copyRequested = new EventEmitter<string>();
  @Output() contentRefreshRequested = new EventEmitter<void>(); // For refresh button

  activeTab: 'content' | 'metadata' = 'content'; // For tree view tabs

  selectFile(path: string): void {
    this.fileSelected.emit(path);
  }

  copyToClipboard(text: string): void {
    this.copyRequested.emit(text);
  }

  refreshContent(): void {
    this.contentRefreshRequested.emit();
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get short name from full path
   */
  getShortName(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
  }

  /**
   * Get icon for discovery method
   */
  getDiscoveryIcon(method: string): string {
    switch (method) {
      case 'known-list':
        return '📌';
      case 'extracted':
        return '🔗';
      case 'generated':
        return '🔧';
      default:
        return '❓';
    }
  }

  /**
   * Get human-readable description for discovery method
   */
  getMethodDescription(file: FileAnalysis): string {
    switch (file.discoveryMethod) {
      case 'known-list':
        return 'Explicitly configured in EXPLORATION_PATHS';
      case 'extracted':
        return file.discoveredFrom
          ? `Extracted from ${this.getShortName(file.discoveredFrom)}`
          : 'Extracted from file content';
      case 'generated':
        return file.discoveredFrom
          ? `Generated from template: ${file.discoveredFrom}`
          : 'Generated from template';
      default:
        return 'Unknown discovery method';
    }
  }

  /**
   * Build the full discovery chain from current file back to root
   */
  getDiscoveryChain(file: FileAnalysis | null): DiscoveryChainItem[] {
    if (!file) return [];

    const chain: DiscoveryChainItem[] = [];
    let current: FileAnalysis | undefined = file;
    const visited = new Set<string>(); // Prevent infinite loops

    while (current && !visited.has(current.path)) {
      visited.add(current.path);

      chain.unshift({
        path: current.path,
        name: this.getShortName(current.path),
        icon: this.getDiscoveryIcon(current.discoveryMethod),
        description: this.getMethodDescription(current),
      });

      // Traverse up the chain
      if (current.discoveredFrom) {
        current = this.findFileByPath(current.discoveredFrom);
      } else {
        break;
      }
    }

    return chain;
  }

  /**
   * Find a file in results by path
   */
  private findFileByPath(path: string): FileAnalysis | undefined {
    return this.allResults.find((r) => r.path === path);
  }

  /**
   * Get variables discovered in this file (from content analysis)
   * This would require tracking variables during scan - for now return empty
   */
  getVariablesDiscovered(): Array<{
    name: string;
    value: string;
    confidence: string;
  }> {
    // TODO: Could be enhanced by analyzing content for variable definitions
    // For now, return empty array
    return [];
  }

  /**
   * Get templates that were deferred because of this file
   */
  getTemplatesDeferred(): Array<{ template: string; variables: string[] }> {
    // TODO: Could be enhanced by tracking deferred paths per source file
    // For now, return empty array
    return [];
  }

  /**
   * Copy all debug information to clipboard
   */
  copyDebugInfo(): void {
    if (!this.selectedFile) return;

    const debugInfo = this.generateDebugReport(this.selectedFile);
    this.copyToClipboard(debugInfo);
  }

  /**
   * Generate a complete debug report for a file
   */
  private generateDebugReport(file: FileAnalysis): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push(`DEBUG REPORT: ${file.path}`);
    lines.push('='.repeat(80));
    lines.push('');

    // Processing Summary
    lines.push('PROCESSING SUMMARY:');
    lines.push('-'.repeat(80));
    lines.push(`Status:           ${file.status}`);
    lines.push(`Discovery Method: ${file.discoveryMethod}`);
    if (file.discoveredFrom) {
      lines.push(`Discovered From:  ${file.discoveredFrom}`);
    }
    lines.push(`Is Binary:        ${file.isBinary}`);
    lines.push(`File Type:        ${file.fileType}`);
    lines.push(`Size:             ${this.formatSize(file.size)}`);
    if (file.confidence) {
      lines.push(`Confidence:       ${(file.confidence * 100).toFixed(1)}%`);
    }
    if (file.magicBytes) {
      lines.push(`Magic Bytes:      ${file.magicBytes}`);
    }
    lines.push(`Timestamp:        ${file.timestamp.toISOString()}`);
    lines.push('');

    // Discovery Chain
    const chain = this.getDiscoveryChain(file);
    if (chain.length > 1) {
      lines.push('DISCOVERY CHAIN:');
      lines.push('-'.repeat(80));
      chain.forEach((item, index) => {
        lines.push(`Level ${index}: ${item.icon} ${item.name}`);
        lines.push(`  ${item.description}`);
      });
      lines.push('');
    }

    // Extracted Paths (literal paths found in file)
    if (file.extractedPaths.length > 0) {
      lines.push(`EXTRACTED PATHS (${file.extractedPaths.length} literal):`);
      lines.push('-'.repeat(80));
      file.extractedPaths.forEach((path) => {
        lines.push(`  ✓ ${path}`);
      });
      lines.push('');
    }

    // Generated Paths (resolved from variables)
    if (file.generatedPaths && file.generatedPaths.length > 0) {
      lines.push(
        `GENERATED PATHS (${file.generatedPaths.length} from variable resolution):`
      );
      lines.push('-'.repeat(80));
      file.generatedPaths.forEach((path) => {
        lines.push(`  🔧 ${path}`);
      });
      lines.push('');
    }

    // Ignored Paths
    if (file.ignoredPaths && file.ignoredPaths.length > 0) {
      lines.push(`IGNORED PATHS (${file.ignoredPaths.length} already known):`);
      lines.push('-'.repeat(80));
      file.ignoredPaths.forEach((path) => {
        lines.push(`  ⊘ ${path}`);
      });
      lines.push('');
    }

    // Error Details
    if (file.error) {
      lines.push('ERROR DETAILS:');
      lines.push('-'.repeat(80));
      lines.push(file.error);
      lines.push('');
    }

    // Full Content (for debugging path extraction)
    if (file.status === 'success' && !file.isBinary && file.contentPreview) {
      lines.push('FULL CONTENT:');
      lines.push('-'.repeat(80));
      lines.push(file.contentPreview); // Full content, not just preview
      lines.push('');
    }

    lines.push('='.repeat(80));
    lines.push('END OF DEBUG REPORT');
    lines.push('='.repeat(80));

    return lines.join('\n');
  }
}
