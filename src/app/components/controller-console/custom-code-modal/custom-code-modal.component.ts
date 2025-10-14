import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FunctionResult } from '../../../services/tv-communication.service';

@Component({
  selector: 'app-custom-code-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './custom-code-modal.component.html',
  styleUrls: ['./custom-code-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomCodeModalComponent {
  @Input() isOpen = false;
  @Input() customJsCode = '';
  @Input() customCodeResult: FunctionResult = null;
  @Input() isExecutingCustomCode = false;
  @Input() isCustomCodeExpanded = false;
  @Input() isCustomCodeResultExpanded = false;

  @Output() closeModal = new EventEmitter<void>();
  @Output() executeCode = new EventEmitter<void>();
  @Output() codeChanged = new EventEmitter<string>();
  @Output() copyResult = new EventEmitter<void>();
  @Output() codeExpansionToggled = new EventEmitter<void>();
  @Output() resultExpansionToggled = new EventEmitter<void>();

  onClose(): void {
    this.closeModal.emit();
  }

  onExecute(): void {
    this.executeCode.emit();
  }

  onCodeChange(code: string): void {
    this.codeChanged.emit(code);
  }

  onCopyResult(): void {
    this.copyResult.emit();
  }

  onToggleCodeExpansion(): void {
    this.codeExpansionToggled.emit();
  }

  onToggleResultExpansion(): void {
    this.resultExpansionToggled.emit();
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
