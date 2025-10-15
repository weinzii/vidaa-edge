import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileAnalysis } from '../../../models/file-exploration';

@Component({
  selector: 'app-file-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-list.component.html',
  styleUrls: ['./file-list.component.css'],
})
export class FileListComponent {
  @Input() results: FileAnalysis[] = [];
  @Input() selectedFile: FileAnalysis | null = null;
  @Output() fileSelected = new EventEmitter<FileAnalysis>();

  selectFile(file: FileAnalysis): void {
    this.fileSelected.emit(file);
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
}
