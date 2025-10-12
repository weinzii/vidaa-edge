import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeviceDetectionService } from '../../services/device-detection.service';
import { TvScannerComponent } from '../tv-scanner/tv-scanner.component';
import { ControllerConsoleComponent } from '../controller-console/controller-console.component';

@Component({
  selector: 'app-remote-console',
  standalone: true,
  imports: [CommonModule, TvScannerComponent, ControllerConsoleComponent],
  template: `
    <!-- TV Mode: Show TV Scanner Component -->
    <app-tv-scanner *ngIf="isTvMode"></app-tv-scanner>

    <!-- Controller Mode: Show Controller Console Component -->
    <app-controller-console *ngIf="!isTvMode"></app-controller-console>
  `,
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
