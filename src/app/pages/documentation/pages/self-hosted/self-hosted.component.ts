import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CopyToClipboardComponent } from '../../../../components/copy-to-clipboard/copy-to-clipboard.component';

@Component({
  selector: 'app-self-hosted',
  templateUrl: './self-hosted.component.html',
  imports: [CopyToClipboardComponent, RouterModule],
})
export class SelfHostedComponent {}
