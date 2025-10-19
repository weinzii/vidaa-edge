import { NgIf } from '@angular/common';
import {
  Component,
  Input,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { ConsoleService } from '../../services/console.service';

@Component({
  selector: 'app-copy-to-clipboard',
  templateUrl: './copy-to-clipboard.component.html',
  styleUrls: ['./copy-to-clipboard.component.css'],
  standalone: true,
  imports: [NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopyToClipboardComponent {
  @Input() value = '';
  showTooltip = false;

  constructor(
    private consoleService: ConsoleService,
    private cdr: ChangeDetectorRef
  ) {}

  copyToClipboard() {
    navigator.clipboard.writeText(this.value).then(
      () => {
        this.showTooltip = true;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.showTooltip = false;
          this.cdr.markForCheck();
        }, 2000);
      },
      (err) => {
        this.consoleService.error(
          'Failed to copy to clipboard',
          err,
          'CopyToClipboard'
        );
      }
    );
  }
}
