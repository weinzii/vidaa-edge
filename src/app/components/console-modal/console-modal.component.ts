import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ConsoleService, LogEntry } from '../../services/console.service';
import { NgClass, NgFor, NgIf, AsyncPipe } from '@angular/common';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-console-modal',
  templateUrl: './console-modal.component.html',
  styleUrls: ['./console-modal.component.css'],
  imports: [NgIf, NgFor, NgClass, AsyncPipe],
  standalone: true,
  preserveWhitespaces: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsoleModalComponent implements OnInit {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  isClosing = false;
  logs$!: Observable<LogEntry[]>;

  constructor(private consoleService: ConsoleService) {}

  ngOnInit(): void {
    this.logs$ = this.consoleService.logs$;
  }

  openModal(): void {
    this.isOpen = true;
    this.isClosing = false;
  }

  closeModal(): void {
    this.isClosing = true;
    setTimeout(() => {
      this.isClosing = false;
      this.isOpen = false;
      this.close.emit();
    }, 300);
  }

  clearConsole(): void {
    this.consoleService.clearLogs();
  }
}
