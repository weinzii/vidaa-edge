import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeviceDetectionService } from '../../services/device-detection.service';
import { TvScannerComponent } from '../tv-scanner/tv-scanner.component';
import { ControllerConsoleComponent } from '../controller-console/controller-console.component';

@Component({
  selector: 'app-remote-console',
  standalone: true,
  imports: [CommonModule, TvScannerComponent, ControllerConsoleComponent],
  templateUrl: './remote-console.component.html',
  styles: [],
})
export class RemoteConsoleComponent implements OnInit {
  // Device Mode Detection
  isTvMode = false;

  constructor(private deviceDetectionService: DeviceDetectionService) {}

  ngOnInit(): void {
    // Detect device type and set mode
    this.isTvMode = this.deviceDetectionService.isTV();
  }
}
