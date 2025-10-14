import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  message: string;
  type: 'normal' | 'error'; // Legacy compatibility
  level?: LogLevel;
  timestamp?: Date;
  context?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ConsoleService {
  private logs: LogEntry[] = [];
  private logsSubject = new BehaviorSubject<LogEntry[]>(this.logs);
  private isDevelopment = true; // Can be set based on environment

  logs$ = this.logsSubject.asObservable();

  // Legacy method - kept for backward compatibility
  addLog(message: string, type: 'normal' | 'error' = 'normal'): void {
    this.logs.push({ message, type });
    this.logsSubject.next([...this.logs]);
  }

  // New structured logging methods
  info(message: string, context?: string): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: string): void {
    this.log('warn', message, context);
    console.warn(`[${context || 'App'}] ${message}`);
  }

  error(message: string, error?: unknown, context?: string): void {
    const fullMessage = error ? `${message}: ${error instanceof Error ? error.message : String(error)}` : message;
    this.log('error', fullMessage, context);
    console.error(`[${context || 'App'}] ${fullMessage}`, error);
  }

  debug(message: string, context?: string): void {
    if (this.isDevelopment) {
      this.log('debug', message, context);
      console.log(`[DEBUG][${context || 'App'}] ${message}`);
    }
  }

  private log(level: LogLevel, message: string, context?: string): void {
    const entry: LogEntry = {
      message,
      type: level === 'error' ? 'error' : 'normal',
      level,
      timestamp: new Date(),
      context,
    };
    this.logs.push(entry);
    this.logsSubject.next([...this.logs]);
  }

  clearLogs(): void {
    this.logs = [];
    this.logsSubject.next([...this.logs]);
  }
}
