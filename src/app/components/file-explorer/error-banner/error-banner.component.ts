import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, style, transition, animate } from '@angular/animations';
import { ErrorInfo } from '../../../models/session-storage.model';

/**
 * Error banner component
 * Displays TV API errors and provides retry/action buttons
 */
@Component({
  selector: 'app-error-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error-banner.component.html',
  styleUrls: ['./error-banner.component.css'],
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({
          transform: 'translate(-50%, -100%)',
          opacity: 0,
        }),
        animate(
          '300ms ease-out',
          style({
            transform: 'translate(-50%, 0)',
            opacity: 1,
          })
        ),
      ]),
      transition(':leave', [
        animate(
          '200ms ease-in',
          style({
            transform: 'translate(-50%, -100%)',
            opacity: 0,
          })
        ),
      ]),
    ]),
  ],
})
export class ErrorBannerComponent {
  @Input() errorInfo?: ErrorInfo;
  @Input() visible = false;

  @Output() retry = new EventEmitter<void>();
  @Output() stopScan = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();

  onRetry(): void {
    this.retry.emit();
  }

  onStop(): void {
    this.stopScan.emit();
  }

  onDismiss(): void {
    this.dismiss.emit();
  }

  getErrorIcon(): string {
    if (!this.errorInfo) return '⚠️';

    switch (this.errorInfo.errorType) {
      case 'timeout':
        return '⏱️';
      case 'network':
        return '🌐';
      case 'tv_disconnected':
        return '📺';
      case 'tv_overload':
        return '🔴';
      case 'api_failure':
        return '⚠️';
      default:
        return '❌';
    }
  }

  getErrorTitle(): string {
    if (!this.errorInfo) return 'Error Occurred';

    switch (this.errorInfo.errorType) {
      case 'timeout':
        return 'TV Response Timeout';
      case 'network':
        return 'Network Error';
      case 'tv_disconnected':
        return 'TV Disconnected';
      case 'tv_overload':
        return 'TV API Overloaded';
      case 'api_failure':
        return 'TV API Error';
      default:
        return 'Unknown Error';
    }
  }
}
