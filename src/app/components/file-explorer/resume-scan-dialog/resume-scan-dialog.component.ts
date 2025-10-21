import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResumeDialogData } from '../../../models/scan-persistence.model';

export type ResumeAction = 'resume' | 'restart' | 'view' | 'discard';

/**
 * Resume scan dialog component
 * Allows user to choose between resuming or restarting a previous scan
 */
@Component({
  selector: 'app-resume-scan-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resume-scan-dialog.component.html',
  styleUrls: ['./resume-scan-dialog.component.css'],
})
export class ResumeScanDialogComponent {
  @Input() data?: ResumeDialogData;
  @Input() visible = false;

  @Output() action = new EventEmitter<ResumeAction>();

  onResume(): void {
    this.action.emit('resume');
  }

  onRestart(): void {
    this.action.emit('restart');
  }

  onViewResults(): void {
    this.action.emit('view');
  }

  onDiscard(): void {
    this.action.emit('discard');
  }

  getStatusColor(): string {
    if (!this.data) return 'bg-gray-500';

    switch (this.data.status) {
      case 'running':
        return 'bg-blue-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      case 'completed':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  }

  getTimeSince(): string {
    if (!this.data) return '';

    const now = Date.now();
    const then = this.data.lastSaveTime.getTime();
    const diffMs = now - then;

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }
}
