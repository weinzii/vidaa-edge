import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FunctionData } from '../../../services/tv-function.service';
import { FunctionResult } from '../../../services/tv-command.service';

@Component({
  selector: 'app-function-execution-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './function-execution-modal.component.html',
  styleUrls: ['./function-execution-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FunctionExecutionModalComponent {
  @Input() isOpen = false;
  @Input() selectedFunction: FunctionData | null = null;
  @Input() parameterValues: string[] = [];
  @Input() executionResult: FunctionResult = null;
  @Input() isExecuting = false;
  @Input() isExecutionResultExpanded = false;

  @Output() closeModal = new EventEmitter<void>();
  @Output() executeFunction = new EventEmitter<void>();
  @Output() clearParameters = new EventEmitter<void>();
  @Output() copyResult = new EventEmitter<void>();
  @Output() parameterChanged = new EventEmitter<{ index: number; value: string }>();
  @Output() resultExpansionToggled = new EventEmitter<void>();

  onClose(): void {
    this.closeModal.emit();
  }

  onExecute(): void {
    this.executeFunction.emit();
  }

  onClear(): void {
    this.clearParameters.emit();
  }

  onCopyResult(): void {
    this.copyResult.emit();
  }

  onParameterChange(index: number, value: string): void {
    this.parameterChanged.emit({ index, value });
  }

  onToggleResultExpansion(): void {
    this.resultExpansionToggled.emit();
  }

  getParameterHint(paramName: string): string {
    const name = paramName.toLowerCase();
    if (name.includes('file') || name.includes('path'))
      return '../../../etc/passwd';
    if (name.includes('url') || name.includes('uri'))
      return 'e.g. http://example.com';
    if (name.includes('code') || name.includes('id')) return 'Enter code/ID';
    if (name.includes('content') || name.includes('data'))
      return 'Enter text content';
    if (
      name.includes('mode') ||
      name.includes('enable') ||
      name.includes('flag')
    )
      return 'true or false';
    if (
      name.includes('number') ||
      name.includes('count') ||
      name.includes('size')
    )
      return 'Enter number';
    if (name.includes('name')) return 'Enter name';
    if (name.includes('key')) return 'Enter key name';
    if (name.includes('value')) return 'Enter value';
    return 'Enter parameter value';
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

  shouldShowExpandButton(result: FunctionResult): boolean {
    const formatted = this.formatResult(result);
    const lines = formatted.split('\n');
    return lines.length > 5;
  }
}
