import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileAnalysis } from '../../../models/file-exploration';

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
  @Output() fileSelected = new EventEmitter<string>(); // For clicking on extracted paths
  @Output() copyRequested = new EventEmitter<string>();

  activeTab: 'content' | 'metadata' = 'content'; // For tree view tabs

  selectFile(path: string): void {
    this.fileSelected.emit(path);
  }

  copyToClipboard(text: string): void {
    this.copyRequested.emit(text);
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
