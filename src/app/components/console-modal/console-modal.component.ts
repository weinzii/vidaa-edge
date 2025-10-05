import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { ConsoleService, LogEntry } from '../../services/console.service';
import { NgClass, NgFor, NgIf } from '@angular/common';

@Component({
  selector: 'app-console-modal',
  templateUrl: './console-modal.component.html',
  styleUrls: ['./console-modal.component.css'],
  imports: [NgIf, NgFor, NgClass],
  standalone: true,
  preserveWhitespaces: true,
})
export class ConsoleModalComponent implements OnInit {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  isClosing = false;
  logs: LogEntry[] = [];

  constructor(private consoleService: ConsoleService) {}

  ngOnInit(): void {
    this.consoleService.logs$.subscribe((logs) => {
      this.logs = logs;
    });
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
