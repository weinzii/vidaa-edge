import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TreeNode, FileAnalysis } from '../../../models/file-exploration';

@Component({
  selector: 'app-file-tree',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-tree.component.html',
  styleUrls: ['./file-tree.component.css'],
})
export class FileTreeComponent {
  @Input() treeNodes: TreeNode[] = [];
  @Input() selectedFile: FileAnalysis | null = null;
  @Output() fileSelected = new EventEmitter<FileAnalysis>();
  @Output() nodeToggled = new EventEmitter<TreeNode>();

  selectFile(file: FileAnalysis): void {
    this.fileSelected.emit(file);
  }

  toggleNode(node: TreeNode): void {
    this.nodeToggled.emit(node);
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
}
