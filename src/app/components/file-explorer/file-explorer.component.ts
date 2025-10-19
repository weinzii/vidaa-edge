import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { FileExplorationService } from '../../services/file-exploration.service';
import {
  FileAnalysis,
  ExplorationSession,
  ExplorationStats,
  TreeNode,
} from '../../models/file-exploration';
import { FileListComponent } from './file-list/file-list.component';
import { FileTreeComponent } from './file-tree/file-tree.component';
import { FileDetailsComponent } from './file-details/file-details.component';
import { CanComponentDeactivate } from '../../guards/can-deactivate-file-explorer.guard';

@Component({
  selector: 'app-file-explorer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FileListComponent,
    FileTreeComponent,
    FileDetailsComponent,
  ],
  templateUrl: './file-explorer.component.html',
  styleUrls: ['./file-explorer.component.css'],
})
export class FileExplorerComponent
  implements OnInit, OnDestroy, CanComponentDeactivate
{
  private destroy$ = new Subject<void>();

  session: ExplorationSession | null = null;
  stats: ExplorationStats = {
    totalFiles: 0,
    successCount: 0,
    failedCount: 0,
    binaryCount: 0,
    textCount: 0,
    pathsDiscovered: 0,
    progress: 0,
  };

  results: FileAnalysis[] = [];
  filteredResults: FileAnalysis[] = [];
  selectedFile: FileAnalysis | null = null;

  // View mode
  activeView: 'list' | 'tree' = 'list';
  treeNodes: TreeNode[] = [];

  // Filters
  showSuccess = true;
  showFailed = true;
  showBinary = true;
  showText = true;
  searchTerm = '';

  constructor(private explorationService: FileExplorationService) {}

  ngOnInit(): void {
    // Subscribe to session updates
    this.explorationService.session$
      .pipe(takeUntil(this.destroy$))
      .subscribe((session) => {
        this.session = session;
        // Clear tree nodes when new session starts
        if (session && session.results.size === 0) {
          this.treeNodes = [];
        }
      });

    // Subscribe to stats updates
    this.explorationService.stats$
      .pipe(takeUntil(this.destroy$))
      .subscribe((stats) => {
        this.stats = stats;
      });

    // Subscribe to new results
    this.explorationService.results$
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        this.results.push(result);
        this.applyFilters();
      });
  }

  canDeactivate(): boolean {
    // Check if scan is running and ask for confirmation
    if (this.isScanning || this.isPaused) {
      const confirmLeave = confirm(
        'A scan is currently in progress. Do you really want to leave? The scan will be stopped and all data will be cleared.'
      );

      if (confirmLeave) {
        // Stop the scan and clear data
        this.explorationService.stopExploration();
        this.results = [];
        this.filteredResults = [];
        this.selectedFile = null;
        this.treeNodes = [];
        return true;
      }

      return false; // Prevent navigation
    }

    return true; // Allow navigation
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.destroy$.next();
    this.destroy$.complete();

    // Stop scan if still running (failsafe)
    if (this.isScanning || this.isPaused) {
      this.explorationService.stopExploration();
    }
  }

  startScan(): void {
    this.results = [];
    this.filteredResults = [];
    this.selectedFile = null;
    this.treeNodes = [];
    this.explorationService.startExploration();
  }

  pauseScan(): void {
    this.explorationService.pauseExploration();
  }

  resumeScan(): void {
    this.explorationService.resumeExploration();
  }

  stopScan(): void {
    this.explorationService.stopExploration();
    // Rebuild tree if tree view is active
    if (this.activeView === 'tree') {
      this.buildTree();
    }
  }

  exportResults(): void {
    const json = this.explorationService.exportResults();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `file-exploration-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  selectFile(file: FileAnalysis | string): void {
    // Support both FileAnalysis object and path string
    if (typeof file === 'string') {
      const foundFile = this.results.find((r) => r.path === file);
      if (foundFile) {
        this.selectedFile = foundFile;
        // Scroll to the file in the list if needed
        setTimeout(() => {
          const element = document.querySelector(`[data-path="${file}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    } else {
      this.selectedFile = file;
    }
  }

  applyFilters(): void {
    this.filteredResults = this.results.filter((result) => {
      // Status filter
      if (!this.showSuccess && result.status === 'success') return false;
      if (!this.showFailed && result.status !== 'success') return false;

      // Type filter
      if (result.status === 'success') {
        if (!this.showBinary && result.isBinary) return false;
        if (!this.showText && !result.isBinary) return false;
      }

      // Search filter
      if (
        this.searchTerm &&
        !result.path.toLowerCase().includes(this.searchTerm.toLowerCase())
      ) {
        return false;
      }

      return true;
    });

    // Auto-update tree if tree view is active
    if (this.activeView === 'tree') {
      this.buildTree();
    }
  }

  onSearchChange(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.applyFilters();
  }

  toggleFilter(filter: string): void {
    switch (filter) {
      case 'success':
        this.showSuccess = !this.showSuccess;
        break;
      case 'failed':
        this.showFailed = !this.showFailed;
        break;
      case 'binary':
        this.showBinary = !this.showBinary;
        break;
      case 'text':
        this.showText = !this.showText;
        break;
    }
    this.applyFilters();
  }

  switchView(view: 'list' | 'tree'): void {
    this.activeView = view;
    if (view === 'tree') {
      // Only build tree if we have results in the current component state
      if (this.filteredResults.length > 0) {
        this.buildTree();
      } else {
        this.treeNodes = [];
      }
    }
  }

  buildTree(): void {
    // Build tree from filtered results (respects search/filters)
    this.treeNodes = this.explorationService.buildFileTree(
      this.filteredResults
    );
  }

  toggleNode(node: TreeNode): void {
    node.isExpanded = !node.isExpanded;
  }

  get isScanning(): boolean {
    return this.session?.status === 'running';
  }

  get isPaused(): boolean {
    return this.session?.status === 'paused';
  }

  get canStart(): boolean {
    return !this.session || this.session.status === 'completed';
  }

  get statusText(): string {
    if (!this.session) return '';
    switch (this.session.status) {
      case 'running':
        return 'Scanning...';
      case 'paused':
        return 'Paused';
      case 'completed':
        return 'Completed';
      default:
        return '';
    }
  }

  get progress(): number {
    return this.stats.progress;
  }

  get successCount(): number {
    return this.stats.successCount;
  }

  get failedCount(): number {
    return this.stats.failedCount;
  }

  get textCount(): number {
    return this.stats.textCount;
  }

  get binaryCount(): number {
    return this.stats.binaryCount;
  }

  get queueSize(): number {
    return this.stats.pathsDiscovered;
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text);
  }
}
