import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { GridListComponent } from './components/grid-list/grid-list.component';
import { ConsoleService } from '../../services/console.service';
import { VidaaService } from '../../services/vidaa.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  imports: [GridListComponent, RouterModule],
  standalone: true,
})
export class StartComponent implements OnInit {
  vidaaDevice = false;
  debugMode: boolean = environment.debug;

  constructor(
    private consoleService: ConsoleService,
    private vidaaService: VidaaService
  ) {}

  ngOnInit() {
    if (!this.debugMode) {
      this.checkForVidaaDevice();
    } else {
      this.consoleService.addLog(
        'Debug mode is enabled. Skipping device check.'
      );
      this.vidaaDevice = true;
    }
  }

  checkForVidaaDevice() {
    this.consoleService.addLog('Checking: if the device is running Vidaa OS.');

    const firmwareVersion = this.vidaaService.getFirmwareVersion();

    if (firmwareVersion) {
      this.consoleService.addLog(
        'Firmware version detected: ' + firmwareVersion
      );
      this.vidaaDevice = true;
    } else {
      this.consoleService.addLog(
        'Could not detect firmware version. Device is not running Vidaa OS.',
        'error'
      );
      this.vidaaDevice = false;
    }
  }
}
