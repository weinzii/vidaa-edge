import { Injectable } from '@angular/core';
import { FileAnalysis, TreeNode } from '../../models/file-exploration';

/**
 * Service for building hierarchical tree structures from flat file lists
 * Handles:
 * - Tree construction from flat file paths
 * - Sorting (directories first, alphabetical)
 * - Statistics calculation (file/directory counts)
 */
@Injectable({
  providedIn: 'root',
})
export class FileTreeBuilderService {
  /**
   * Build a tree structure from flat file results
   */
  public buildFileTree(results: FileAnalysis[]): TreeNode[] {
    if (results.length === 0) {
      return [];
    }

    const root: TreeNode = {
      name: '',
      path: '',
      type: 'directory',
      level: -1,
      children: [],
      isExpanded: true,
    };

    results.forEach((file) => {
      const parts = file.path.split('/').filter((p) => p);
      let currentNode = root;

      parts.forEach((part, index) => {
        const isLastPart = index === parts.length - 1;

        if (!currentNode.children) {
          currentNode.children = [];
        }

        let childNode = currentNode.children.find(
          (child) => child.name === part
        );

        if (!childNode) {
          const fullPath = '/' + parts.slice(0, index + 1).join('/');

          childNode = {
            name: part,
            path: fullPath,
            type: isLastPart ? 'file' : 'directory',
            level: index,
            isExpanded: true, // All directories expanded by default
            children: isLastPart ? undefined : [],
          };

          if (isLastPart) {
            childNode.file = file;
          }

          currentNode.children.push(childNode);
        }

        if (!isLastPart) {
          currentNode = childNode;
        }
      });
    });

    // Sort and calculate stats
    if (root.children) {
      this.sortTreeNodes(root.children);
      this.calculateStats(root.children);
    }

    return root.children || [];
  }

  /**
   * Sort tree nodes: directories first, then files, both alphabetically
   */
  public sortTreeNodes(nodes: TreeNode[]): void {
    nodes.sort((a, b) => {
      // Directories before files
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      // Alphabetical within same type
      return a.name.localeCompare(b.name);
    });

    // Recursively sort children
    nodes.forEach((node) => {
      if (node.children) {
        this.sortTreeNodes(node.children);
      }
    });
  }

  /**
   * Calculate file and directory counts for each directory
   */
  public calculateStats(nodes: TreeNode[]): void {
    nodes.forEach((node) => {
      if (node.type === 'directory' && node.children) {
        // Recursively calculate for children first
        this.calculateStats(node.children);

        let fileCount = 0;
        let dirCount = 0;

        node.children.forEach((child) => {
          if (child.type === 'file') {
            fileCount++;
          } else {
            dirCount++;
            // Add child directory's counts
            fileCount += child.fileCount || 0;
            dirCount += child.directoryCount || 0;
          }
        });

        node.fileCount = fileCount;
        node.directoryCount = dirCount;
      }
    });
  }

  /**
   * Flatten tree back to array of files
   */
  public flattenTree(nodes: TreeNode[]): FileAnalysis[] {
    const files: FileAnalysis[] = [];

    const traverse = (node: TreeNode) => {
      if (node.type === 'file' && node.file) {
        files.push(node.file);
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };

    nodes.forEach(traverse);
    return files;
  }

  /**
   * Find a node by path
   */
  public findNodeByPath(nodes: TreeNode[], path: string): TreeNode | null {
    for (const node of nodes) {
      if (node.path === path) {
        return node;
      }
      if (node.children) {
        const found = this.findNodeByPath(node.children, path);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Get all parent paths for a given path
   * Example: /usr/local/bin/app -> ['/usr', '/usr/local', '/usr/local/bin']
   */
  public getParentPaths(path: string): string[] {
    const parts = path.split('/').filter((p) => p);
    const parents: string[] = [];

    for (let i = 1; i < parts.length; i++) {
      parents.push('/' + parts.slice(0, i).join('/'));
    }

    return parents;
  }

  /**
   * Calculate tree depth
   */
  public getTreeDepth(nodes: TreeNode[]): number {
    let maxDepth = 0;

    const traverse = (node: TreeNode, depth: number) => {
      maxDepth = Math.max(maxDepth, depth);
      if (node.children) {
        node.children.forEach((child) => traverse(child, depth + 1));
      }
    };

    nodes.forEach((node) => traverse(node, 1));
    return maxDepth;
  }

  /**
   * Get tree statistics
   */
  public getTreeStats(nodes: TreeNode[]): {
    totalFiles: number;
    totalDirectories: number;
    maxDepth: number;
  } {
    let totalFiles = 0;
    let totalDirectories = 0;

    const traverse = (node: TreeNode) => {
      if (node.type === 'file') {
        totalFiles++;
      } else {
        totalDirectories++;
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };

    nodes.forEach(traverse);

    return {
      totalFiles,
      totalDirectories,
      maxDepth: this.getTreeDepth(nodes),
    };
  }
}
