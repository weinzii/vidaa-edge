import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { FileExplorationService } from '../../services/file-exploration.service';
import { ScanStorageService } from '../../services/scan-storage.service';
import { VariableResolverService } from '../../services/file-exploration/variable-resolver.service';
import {
  FileAnalysis,
  ExplorationSession,
  ExplorationStats,
  TreeNode,
  VariableValue,
} from '../../models/file-exploration';
import {
  ResumeDialogData,
  ErrorInfo,
} from '../../models/scan-persistence.model';
import {
  SessionMetadata,
  LoadedSession,
} from '../../models/session-storage.model';
import { shouldExcludeVariableSource } from '../../config/exploration-paths.config';
import { FileListComponent } from './file-list/file-list.component';
import { FileTreeComponent } from './file-tree/file-tree.component';
import { FileDetailsComponent } from './file-details/file-details.component';
import { VariablesViewComponent } from './variables-view/variables-view.component';
import { ErrorBannerComponent } from './error-banner/error-banner.component';
import { ResumeScanDialogComponent } from './resume-scan-dialog/resume-scan-dialog.component';
import { SessionManagerComponent } from '../session-manager/session-manager.component';
import { CanComponentDeactivate } from '../../guards/can-deactivate-file-explorer.guard';

interface DeferredPathEntry {
  template: string;
  missingVars: string[];
  discoveryTime: Date;
}

@Component({
  selector: 'app-file-explorer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FileListComponent,
    FileTreeComponent,
    FileDetailsComponent,
    VariablesViewComponent,
    ErrorBannerComponent,
    ResumeScanDialogComponent,
    SessionManagerComponent,
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
  activeView: 'list' | 'tree' | 'variables' = 'list';
  treeNodes: TreeNode[] = [];

  // Variables data
  variables: Map<string, VariableValue[]> = new Map();
  deferredPaths: Map<string, DeferredPathEntry> = new Map();

  // Filters
  showSuccess = true;
  showFailed = true;
  showBinary = true;
  showText = true;
  searchTerm = '';

  // Discovery Method Filters - REMOVED (use discoveryMethod dropdown in file-list instead)

  // Auto-scroll
  autoScrollEnabled = true;

  // Resume system
  showResumeDialog = false;
  resumeDialogData: ResumeDialogData | undefined = undefined;
  showErrorBanner = false;
  errorInfo: ErrorInfo | undefined = undefined;

  // Content loading
  isLoadingContent = false;

  // Browse mode (offline session viewing)
  isBrowseMode = false;
  browseSessionId: string | null = null;
  browseSessionMetadata: SessionMetadata | null = null;

  // Session Manager Modal
  showSessionManager = false;

  constructor(
    private explorationService: FileExplorationService,
    private scanStorage: ScanStorageService,
    private variableResolver: VariableResolverService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // ✅ Check for persisted session on startup
    this.checkForPersistedSession();

    // Subscribe to session updates
    this.explorationService.session$
      .pipe(takeUntil(this.destroy$))
      .subscribe((session) => {
        this.session = session;

        // Check for errors when session is paused
        if (session && session.status === 'paused') {
          const errorInfo = this.explorationService.getErrorInfo();
          if (
            errorInfo &&
            errorInfo.consecutiveErrors > 0 &&
            errorInfo.lastError
          ) {
            this.errorInfo = errorInfo;
            this.showErrorBanner = true;
            // ✅ Trigger change detection to ensure error banner updates
            this.cdr.detectChanges();
          }
        }

        // Clear tree nodes when new session starts
        if (session && session.results.size === 0) {
          this.treeNodes = [];
        }

        // When session completes, ensure all results are loaded and filters applied
        if (session && session.status === 'completed') {
          this.loadAllResultsFromSession();
          this.applyFilters();
        }

        // Update variables and deferred paths when session changes
        this.updateVariablesData();
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

    // ✅ Add beforeunload handler to save on browser close
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  /**
   * Check if there's a persisted session and show resume dialog
   */
  private checkForPersistedSession(): void {
    if (this.explorationService.hasPersistedSession()) {
      const data = this.explorationService.getResumeDialogData();
      if (data) {
        this.resumeDialogData = data;
        this.showResumeDialog = true;
      }
    }
  }

  /**
   * Handle beforeunload event to save session
   */
  private handleBeforeUnload = (): void => {
    if (!this.session) return;

    // Save running sessions (will pause and save)
    if (this.session.status === 'running') {
      this.explorationService.pauseExploration();
    }
    // Paused sessions are already saved via pauseExploration()
    // No action needed for paused sessions
  };

  /**
   * Load all results from session (used when session completes or is restored)
   */
  private loadAllResultsFromSession(): void {
    if (!this.session) return;

    // ✅ FIX: Always clear and reload to prevent duplicates
    this.results = [];

    // Get all results from session
    const sessionResults = Array.from(this.session.results.values());
    this.results = sessionResults;
  }

  canDeactivate(): boolean {
    // Check if scan is running or paused
    if (this.isScanning || this.isPaused) {
      const confirmLeave = confirm(
        'A scan is currently in progress. Do you really want to leave? The scan will be stopped and all data will be cleared.'
      );

      if (confirmLeave) {
        // ✅ If running: stop (sets to completed)
        // ✅ If paused: keep paused status (already saved)
        if (this.isScanning) {
          this.explorationService.stopExploration();
        }
        // Paused sessions stay paused and are already saved

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

    // Remove beforeunload listener
    window.removeEventListener('beforeunload', this.handleBeforeUnload);

    // ✅ Only pause if actively scanning (don't change paused sessions)
    if (this.isScanning) {
      this.explorationService.pauseExploration();
    }
  }

  startScan(): void {
    this.results = [];
    this.filteredResults = [];
    this.selectedFile = null;
    this.treeNodes = [];
    this.showErrorBanner = false;
    this.errorInfo = undefined;
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

    // Load all results from session
    this.loadAllResultsFromSession();

    // Apply filters to show correct results
    this.applyFilters();

    // Rebuild tree if tree view is active
    if (this.activeView === 'tree') {
      this.buildTree();
    }
  }

  /**
   * Browse a saved session offline (read-only mode)
   */
  async browseSession(sessionId: string): Promise<void> {
    try {
      // Load full session from server
      const loadedSession: LoadedSession = (await this.scanStorage
        .loadSession(sessionId)
        .toPromise()) as LoadedSession;

      if (!loadedSession) {
        throw new Error('Failed to load session');
      }

      // Clear current scan if any
      // ✅ FIX: Only stop if actively scanning, not if paused
      if (this.session && this.isScanning) {
        this.explorationService.stopExploration();
      }

      // Enter browse mode
      this.isBrowseMode = true;
      this.browseSessionId = sessionId;
      this.browseSessionMetadata = loadedSession.metadata;

      // ✅ Update variables data FIRST (before setting session)
      this.updateVariablesDataFromSession(loadedSession);

      // Populate session data (read-only) - data is nested
      this.session = loadedSession.data.session;

      // Convert results array to local array format
      this.results = loadedSession.data.results;

      // Apply filters and build tree
      this.applyFilters();
      if (this.activeView === 'tree') {
        this.buildTree();
      }

      // Calculate stats from results
      this.updateStatsFromResults();
    } catch (error) {
      console.error('Failed to browse session:', error);
      alert('Failed to load session for browsing');
    }
  }

  /**
   * Exit browse mode and return to normal mode
   */
  exitBrowseMode(): void {
    this.isBrowseMode = false;
    this.browseSessionId = null;
    this.browseSessionMetadata = null;
    this.session = null;
    this.results = [];
    this.filteredResults = [];
    this.selectedFile = null;
    this.treeNodes = [];

    // Clear variables and deferred paths
    this.variables = new Map();
    this.deferredPaths = new Map();
  }

  /**
   * Handle browse session event from Session Manager
   */
  handleBrowseSession(sessionId: string): void {
    // Close modal
    this.showSessionManager = false;

    // Load session for browsing
    this.browseSession(sessionId);
  }

  /**
   * Handle session resumed event from Session Manager
   */
  handleSessionResumed(): void {
    // Close modal
    this.showSessionManager = false;

    // ✅ Exit browse mode when resuming a session (but don't clear session)
    if (this.isBrowseMode) {
      this.isBrowseMode = false;
      this.browseSessionId = null;
      this.browseSessionMetadata = null;
      // DON'T set this.session = null here!
      // The running session from the service will update via session$ observable
    }

    // ✅ Get the current running session from the service
    const currentSession = this.explorationService.getCurrentSession();
    if (currentSession) {
      this.session = currentSession;
    }

    // ✅ Trigger change detection to ensure UI updates
    this.cdr.detectChanges();

    // Load all results from the resumed session
    this.loadAllResultsFromSession();
    this.applyFilters();
  }

  /**
   * Handle session deleted event from Session Manager
   */
  handleSessionDeleted(sessionId: string): void {
    // ✅ If the deleted session is currently being browsed, exit browse mode
    if (this.isBrowseMode && this.browseSessionId === sessionId) {
      this.exitBrowseMode();

      // ✅ Trigger change detection to ensure UI updates
      this.cdr.detectChanges();
    }
  }

  /**
   * Update stats from loaded results (for browse mode)
   */
  private updateStatsFromResults(): void {
    this.stats = {
      totalFiles: this.results.length,
      successCount: this.results.filter((r) => r.status === 'success').length,
      failedCount: this.results.filter(
        (r) => r.status === 'error' || r.status === 'not-found'
      ).length,
      binaryCount: this.results.filter((r) => r.isBinary).length,
      textCount: this.results.filter(
        (r) => !r.isBinary && r.status === 'success'
      ).length,
      pathsDiscovered:
        this.results.reduce(
          (sum, r) => sum + (r.extractedPaths?.length || 0),
          0
        ) +
        this.results.reduce(
          (sum, r) => sum + (r.generatedPaths?.length || 0),
          0
        ),
      progress: 100,
    };
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
        // Check if content is missing and fetch on-demand
        this.fetchContentIfMissing(foundFile);

        // If in tree view, expand parent nodes first
        if (this.activeView === 'tree') {
          this.expandParentNodesForPath(file);
        }

        // Scroll to the file in the list/tree
        setTimeout(() => {
          const element = document.querySelector(`[data-path="${file}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    } else {
      this.selectedFile = file;
      // Check if content is missing and fetch on-demand
      this.fetchContentIfMissing(file);
    }
  }

  /**
   * Fetch file content on-demand if missing (after resume)
   */
  private async fetchContentIfMissing(file: FileAnalysis): Promise<void> {
    // Only fetch for successful text files that are missing content
    if (file.status === 'success' && !file.isBinary && !file.content) {
      this.isLoadingContent = true;
      try {
        const content = await this.explorationService.fetchFileContent(
          file.path
        );
        if (content && this.selectedFile?.path === file.path) {
          // Update the selected file reference
          this.selectedFile.content = content;
        }
      } catch (error) {
        console.error('Failed to fetch content:', error);
      } finally {
        this.isLoadingContent = false;
      }
    }
  }

  /**
   * Handle refresh request from file details component
   * Forces re-fetch of content even if it already exists
   */
  async onContentRefreshRequested(): Promise<void> {
    if (!this.selectedFile || this.selectedFile.isBinary) {
      return;
    }

    this.isLoadingContent = true;
    try {
      const content = await this.explorationService.fetchFileContent(
        this.selectedFile.path
      );
      if (content && this.selectedFile) {
        // Update the selected file reference with fresh content
        this.selectedFile.content = content;
      }
    } catch (error) {
      console.error('Failed to refresh content:', error);
    } finally {
      this.isLoadingContent = false;
    }
  }

  applyFilters(): void {
    this.filteredResults = this.results.filter((result) => {
      // Exclude placeholder entries ONLY in active scan mode (not in browse mode)
      if (!this.isBrowseMode && result.isPlaceholder) return false;

      // Status filter
      if (!this.showSuccess && result.status === 'success') return false;
      if (!this.showFailed && result.status !== 'success') return false;

      // Type filter
      if (result.status === 'success') {
        if (!this.showBinary && result.isBinary) return false;
        if (!this.showText && !result.isBinary) return false;
      }

      // Discovery Method filter - REMOVED (now handled by file-list component dropdown)

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

  /**
   * Expand all parent nodes for a given file path in the tree
   */
  private expandParentNodesForPath(filePath: string): void {
    // Get all parent directory paths
    const pathParts = filePath.split('/').filter((p) => p);
    const parentPaths: string[] = [];

    // Build parent paths: /a, /a/b, /a/b/c for file /a/b/c/file.txt
    for (let i = 1; i < pathParts.length; i++) {
      parentPaths.push('/' + pathParts.slice(0, i).join('/'));
    }

    // Expand all parent nodes recursively
    const expandNode = (nodes: TreeNode[]): void => {
      for (const node of nodes) {
        if (node.type === 'directory' && parentPaths.includes(node.path)) {
          node.isExpanded = true;
          if (node.children) {
            expandNode(node.children);
          }
        } else if (node.children) {
          expandNode(node.children);
        }
      }
    };

    expandNode(this.treeNodes);
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

  switchView(view: 'list' | 'tree' | 'variables'): void {
    this.activeView = view;
    if (view === 'tree') {
      // Only build tree if we have results in the current component state
      if (this.filteredResults.length > 0) {
        this.buildTree();
      } else {
        this.treeNodes = [];
      }
    } else if (view === 'variables') {
      // In browse mode, data is already loaded - just trigger change detection
      if (this.isBrowseMode) {
        this.cdr.detectChanges();
      } else {
        // Active session: Update from VariableResolverService
        this.updateVariablesData();
      }
    }
  }

  private updateVariablesData(): void {
    if (!this.session) {
      this.variables = new Map();
      this.deferredPaths = new Map();
      return;
    }

    const sessionId = this.session.id;

    // Get variables from VariableResolverService - create NEW Map to trigger change detection
    const originalVariables = this.variableResolver.getVariables(sessionId);
    this.variables = new Map(originalVariables); // ✅ Create new Map instance

    // Get deferred paths and convert to map with metadata
    const deferredPathsArray =
      this.variableResolver.getDeferredPaths(sessionId);
    const newDeferredPaths = new Map<string, DeferredPathEntry>(); // ✅ Create NEW Map

    deferredPathsArray.forEach((deferred) => {
      // Extract missing variables from template
      const missingVars = this.extractVariableNames(deferred.template).filter(
        (varName) => !this.variables.has(varName)
      );

      newDeferredPaths.set(deferred.template, {
        template: deferred.template,
        missingVars,
        discoveryTime: new Date(), // Use current time as fallback
      });
    });

    // Assign new Map to trigger change detection
    this.deferredPaths = newDeferredPaths;

    // ✅ Manually trigger change detection
    this.cdr.detectChanges();
  }

  private extractVariableNames(path: string): string[] {
    const vars: string[] = [];
    const regex = /\$\{?([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+)\}?/g;
    let match;

    while ((match = regex.exec(path)) !== null) {
      if (!vars.includes(match[1])) {
        vars.push(match[1]);
      }
    }

    return vars;
  }

  private updateVariablesDataFromSession(loadedSession: LoadedSession): void {
    // Extract variables from loaded session
    const variablesData = loadedSession.data.variables;
    const newVariables = new Map<string, VariableValue[]>(); // ✅ Create NEW Map

    // Convert Record<string, VariableValue[]> to Map
    if (variablesData && typeof variablesData === 'object') {
      Object.entries(variablesData).forEach(([varName, values]) => {
        // ✅ Filter out variables from excluded sources (e.g., mapping.ini)
        const filteredValues = values.filter(
          (v) => !shouldExcludeVariableSource(v.discoveredIn)
        );

        // Only add if there are values left after filtering
        if (filteredValues.length > 0) {
          newVariables.set(varName, filteredValues);
        }
      });
    }

    // Assign new Map to trigger change detection
    this.variables = newVariables;

    // Extract deferred paths from loaded session
    const deferredPathsData = loadedSession.data.deferredPaths;
    const newDeferredPaths = new Map<string, DeferredPathEntry>(); // ✅ Create NEW Map

    if (Array.isArray(deferredPathsData)) {
      deferredPathsData.forEach((deferredPath) => {
        const template = deferredPath.template;

        if (template) {
          // Extract missing variables
          const missingVars = this.extractVariableNames(template).filter(
            (varName) => !newVariables.has(varName)
          );

          newDeferredPaths.set(template, {
            template,
            missingVars,
            discoveryTime: new Date(), // Use current time (no discoveryTime in DeferredPath)
          });
        }
      });
    }

    // Assign new Map to trigger change detection
    this.deferredPaths = newDeferredPaths;

    // Trigger change detection immediately
    this.cdr.detectChanges();

    // Schedule another change detection for next tick to ensure child components get updated
    setTimeout(() => this.cdr.detectChanges(), 0);
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
        return `Scanning... ${this.session.scannedPaths}/${this.session.totalPaths} files`;
      case 'paused':
        return `Paused - ${this.session.scannedPaths}/${this.session.totalPaths} files`;
      case 'completed':
        return `Completed - ${this.session.scannedPaths} files scanned`;
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

  // Discovery Method counts
  get knownListCount(): number {
    return this.results.filter((r) => r.discoveryMethod === 'known-list')
      .length;
  }

  get extractedCount(): number {
    return this.results.filter((r) => r.discoveryMethod === 'extracted').length;
  }

  get generatedCount(): number {
    return this.results.filter((r) => r.discoveryMethod === 'generated').length;
  }

  // Resume Dialog Handlers
  handleResumeAction(action: string): void {
    this.showResumeDialog = false;

    switch (action) {
      case 'resume':
        // Resume from persisted session and continue scanning
        if (this.explorationService.resumeFromPersistedSession()) {
          this.loadAllResultsFromSession();
          this.applyFilters();
          // ✅ Clear error banner when resuming
          this.showErrorBanner = false;
          this.errorInfo = undefined;
          // ✅ Automatically resume scanning after loading
          this.explorationService.resumeExploration();
        }
        break;

      case 'restart':
        // Clear persisted session and start fresh
        this.explorationService.clearPersistedSession();
        this.startScan();
        break;

      case 'view':
        // Just load results without resuming scan
        if (this.explorationService.resumeFromPersistedSession()) {
          this.loadAllResultsFromSession();
          this.applyFilters();
          // Stop the session immediately (view only mode)
          this.explorationService.stopExploration();
        }
        break;

      case 'discard':
        // Clear persisted session
        this.explorationService.clearPersistedSession();
        break;
    }
  }

  // Error Banner Handlers
  handleRetry(): void {
    this.showErrorBanner = false;
    this.resumeScan();
  }

  handleStopAndSave(): void {
    this.showErrorBanner = false;
    this.stopScan();
  }

  handleDismissError(): void {
    this.showErrorBanner = false;
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text);
  }
}
