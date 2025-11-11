import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileAnalysis } from '../../../models/file-exploration';

@Component({
  selector: 'app-file-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-list.component.html',
  styleUrls: ['./file-list.component.css'],
})
export class FileListComponent implements AfterViewChecked, OnChanges {
  @Input() results: FileAnalysis[] = [];
  @Input() selectedFile: FileAnalysis | null = null;
  @Input() autoScrollEnabled = true;
  @Output() fileSelected = new EventEmitter<FileAnalysis>();
  @Output() autoScrollToggled = new EventEmitter<boolean>();

  @ViewChild('scrollContainer') scrollContainer?: ElementRef<HTMLDivElement>;
  private previousResultsLength = 0;
  private shouldScrollToBottom = false;

  ngOnChanges(changes: SimpleChanges): void {
    // Check if results array changed and new items were added
    if (changes['results'] && this.results) {
      const currentLength = this.results.length;
      if (currentLength > this.previousResultsLength) {
        // New items added - trigger scroll on next view check
        this.shouldScrollToBottom = this.autoScrollEnabled;
      }
      this.previousResultsLength = currentLength;
    }
  }

  ngAfterViewChecked(): void {
    // Scroll to bottom if flag is set
    if (this.shouldScrollToBottom && this.scrollContainer) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false; // Reset flag
    }
  }

  private scrollToBottom(): void {
    try {
      const element = this.scrollContainer?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {
      console.error('Auto-scroll error:', err);
    }
  }

  selectFile(file: FileAnalysis): void {
    this.fileSelected.emit(file);
  }

  toggleAutoScroll(): void {
    this.autoScrollEnabled = !this.autoScrollEnabled;
    this.autoScrollToggled.emit(this.autoScrollEnabled);
  }

  getFileIcon(result: FileAnalysis): string {
    if (result.status !== 'success') {
      return '❌';
    }
    if (result.isBinary) {
      return '📦';
    }
    // Text files
    if (result.fileType === 'script') return '📜';
    if (result.fileType === 'config') return '⚙️';
    if (result.fileType === 'log') return '📋';
    return '📄';
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get short name from full path for compact display
   */
  getShortSourceName(path: string): string {
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
   * Navigate to source file (emit selection with stop propagation)
   */
  selectSourceFile(sourcePath: string, event: Event): void {
    event.stopPropagation();
    // Find the file in results and emit
    const sourceFile = this.results.find((r) => r.path === sourcePath);
    if (sourceFile) {
      this.fileSelected.emit(sourceFile);
    }
  }
}
