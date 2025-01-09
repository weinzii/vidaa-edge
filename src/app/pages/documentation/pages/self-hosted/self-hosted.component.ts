import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CopyToClipboardComponent } from 'src/app/components/copy-to-clipboard/copy-to-clipboard.component';

@Component({
  selector: 'app-self-hosted',
  templateUrl: './self-hosted.component.html',
  imports: [CopyToClipboardComponent, RouterModule]
})
export class SelfHostedComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
