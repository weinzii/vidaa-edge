import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface LogEntry {
  message: string;
  type: 'normal' | 'error';
}

@Injectable({
  providedIn: 'root',
})
export class ConsoleService {
  private logs: LogEntry[] = [];
  private logsSubject = new BehaviorSubject<LogEntry[]>(this.logs);

  logs$ = this.logsSubject.asObservable();

  constructor() {}

  addLog(message: string, type: 'normal' | 'error' = 'normal'): void {
    this.logs.push({ message, type });
    this.logsSubject.next([...this.logs]);
  }

  clearLogs(): void {
    this.logs = [];
    this.logsSubject.next([...this.logs]);
  }
}
