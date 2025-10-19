import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-code-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './code-modal.component.html',
  styles: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodeModalComponent {
  @Input() isOpen = false;
  @Input() title = 'Modal';
  @Input() showExecuteButton = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() executeCode = new EventEmitter<void>();

  close(): void {
    this.closeModal.emit();
  }

  execute(): void {
    this.executeCode.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
}
