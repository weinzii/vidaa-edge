import {
  Component,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FunctionResult } from '../../../services/tv-communication.service';

export interface CommandHistoryEntry {
  functionName: string;
  parameters?: unknown[];
  customCode?: string;
  timestamp: Date;
  success: boolean;
  result?: FunctionResult;
}

@Component({
  selector: 'app-command-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './command-history.component.html',
  styleUrls: ['./command-history.component.css'],
})
export class CommandHistoryComponent {
  @Input() commandHistory: CommandHistoryEntry[] = [];
  @Input() expandedHistoryItems: Set<number> = new Set();
  @Input() expandedHistoryResults: Set<number> = new Set();

  @Output() historyExpansionToggled = new EventEmitter<number>();
  @Output() historyResultExpansionToggled = new EventEmitter<number>();
  @Output() historyItemDeleted = new EventEmitter<number>();
  @Output() scrollToTop = new EventEmitter<void>();

  onHistoryToggle(index: number): void {
    this.historyExpansionToggled.emit(index);
  }

  onResultToggle(index: number): void {
    this.historyResultExpansionToggled.emit(index);
  }

  onDeleteItem(index: number): void {
    this.historyItemDeleted.emit(index);
  }

  onScrollToTop(): void {
    this.scrollToTop.emit();
  }

  isHistoryExpanded(index: number): boolean {
    return this.expandedHistoryItems.has(index);
  }

  isHistoryResultExpanded(index: number): boolean {
    return this.expandedHistoryResults.has(index);
  }

  shouldShowExpandButton(result: FunctionResult): boolean {
    const formatted = this.formatResult(result);
    const lines = formatted.split('\n');
    return lines.length > 5;
  }

  formatResult(result: FunctionResult): string {
    if (result === null) return 'null';
    if (result === undefined) return 'undefined';
    if (typeof result === 'string') return result;
    if (typeof result === 'number' || typeof result === 'boolean')
      return String(result);

    try {
      return JSON.stringify(result, null, 2);
    } catch {
      return String(result);
    }
  }

  formatTime(date: Date | null): string {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
