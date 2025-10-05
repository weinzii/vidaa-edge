import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ConsoleService } from '../../../../services/console.service';
import { VidaaService } from '../../../../services/vidaa.service';

@Component({
  selector: 'app-custom-app-modal',
  templateUrl: './custom-app-modal.component.html',
  styleUrls: ['./custom-app-modal.component.css'],
  imports: [NgIf, FormsModule],
})
export class CustomAppModalComponent {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  isClosing = false;

  appId = '';
  appName = '';
  thumbnail = '';
  appUrl = '';
  statusMessage = '';

  constructor(
    private vidaaService: VidaaService,
    private consoleService: ConsoleService,
    private toastr: ToastrService
  ) {}

  openModal(): void {
    this.isOpen = true;
    this.isClosing = false;
    this.resetFields();
  }

  closeModal(): void {
    this.isClosing = true;
    setTimeout(() => {
      this.isClosing = false;
      this.isOpen = false;
      this.close.emit();
    }, 300);
  }

  createAppObject() {
    if (!this.appId || !this.appName || !this.thumbnail || !this.appUrl) {
      this.toastr.error('Please fill in all fields.');
      return;
    }

    const app = {
      appId: this.appId,
      appName: this.appName,
      appUrl: this.appUrl,
      desc: '',
      image: this.thumbnail,
    };

    return app;
  }

  installApp() {
    const app = this.createAppObject();

    if (!app) {
      return;
    }

    this.toastr.info(`Installing ${app.appName}`);
    this.consoleService.addLog(`Installing  ${app.appName}`);
    this.vidaaService
      .installApp(
        app.appId,
        app.appName,
        app.image,
        app.image,
        app.image,
        app.appUrl,
        'store'
      )
      .then((res) => {
        if (res) {
          this.toastr.success(
            `Installation completed. ${app.appName} successfully installed.`
          );
          this.consoleService.addLog(
            `Installation completed. ${app.appName} successfully installed.`
          );
        } else {
          this.toastr.error(
            `Installation failed. ${app.appName} failed to install.`
          );
          this.consoleService.addLog(
            `Installation failed. ${app.appName} failed to install.`,
            'error'
          );
        }
      })
      .catch(() => {
        this.toastr.error(
          `Installation failed. ${app.appName} failed to install.`
        );
        this.consoleService.addLog(
          `Installation failed. ${app.appName} failed to install.`
        );
      });
  }

  uninstallApp() {
    const app = this.createAppObject();

    if (!app) {
      return;
    }

    this.toastr.info(`Uninstall ${app.appName}`);
    this.consoleService.addLog(`Uninstall  ${app.appName}`);
    this.vidaaService
      .uninstallApp(app.appId, app.appName)
      .then((res) => {
        if (res) {
          this.toastr.success(
            `Uninstallation completed. ${app.appName} successfully uninstalled.`
          );
          this.consoleService.addLog(
            `Uninstallation completed. ${app.appName} successfully uninstalled.`
          );
        } else {
          this.toastr.error(
            `Uninstallation failed. ${app.appName} could not be uninstalled.`
          );
          this.consoleService.addLog(
            `Uninstallation failed. ${app.appName} could not be uninstalled.`,
            'error'
          );
        }
      })
      .catch(() => {
        this.toastr.error(
          `Uninstallation failed. ${app.appName} failed to uninstall.`
        );
        this.consoleService.addLog(
          `Uninstallation failed. ${app.appName} failed to uninstall.`
        );
      });
  }

  private resetFields(): void {
    this.appId = '';
    this.appName = '';
    this.thumbnail = '';
    this.appUrl = '';
    this.statusMessage = '';
  }
}
