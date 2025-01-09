import { NgIf } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-copy-to-clipboard',
  templateUrl: './copy-to-clipboard.component.html',
  styleUrls: ['./copy-to-clipboard.component.css'],
  imports: [NgIf],
})
export class CopyToClipboardComponent {
  @Input() value: string = '';
  showTooltip: boolean = false;

  copyToClipboard() {
    navigator.clipboard.writeText(this.value).then(
      () => {
        this.showTooltip = true;
        setTimeout(() => {
          this.showTooltip = false;
        }, 2000);
      },
      (err) => {
        console.error('Failed to copy: ', err);
      }
    );
  }
}
