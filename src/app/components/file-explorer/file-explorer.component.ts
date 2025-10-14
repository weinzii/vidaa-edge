import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { FileExplorationService } from '../../services/file-exploration.service';
import {
  FileAnalysis,
  ExplorationSession,
  ExplorationStats,
} from '../../models/file-exploration';

@Component({
  selector: 'app-file-explorer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-explorer.component.html',
  styleUrls: ['./file-explorer.component.css'],
})
export class FileExplorerComponent implements OnInit, OnDestroy {
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

  // Filters
  showSuccess = true;
  showFailed = true;
  showBinary = true;
  showText = true;
  searchTerm = '';

  constructor(private explorationService: FileExplorationService) {}

  ngOnInit(): void {
    // Load existing results if navigation back to component
    const existingResults = this.explorationService.getAllResults();
    if (existingResults.length > 0) {
      this.results = [...existingResults];
      this.applyFilters();
    }

    // Subscribe to session updates
    this.explorationService.session$
      .pipe(takeUntil(this.destroy$))
      .subscribe((session) => {
        this.session = session;
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  startScan(): void {
    this.results = [];
    this.filteredResults = [];
    this.selectedFile = null;
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

  get isScanning(): boolean {
    return this.session?.status === 'running';
  }

  get isPaused(): boolean {
    return this.session?.status === 'paused';
  }

  get canStart(): boolean {
    return !this.session || this.session.status === 'completed';
  }

  getFileIcon(result: FileAnalysis): string {
    if (result.status !== 'success') return '🔒';
    if (result.isBinary) return '📦';
    if (result.fileType === 'script') return '📜';
    if (result.fileType.includes('config')) return '⚙️';
    if (result.fileType.includes('log')) return '📊';
    return '📄';
  }

  getStatusColor(result: FileAnalysis): string {
    switch (result.status) {
      case 'success':
        return 'text-green-600';
      case 'access-denied':
        return 'text-red-600';
      case 'not-found':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text);
  }
}
