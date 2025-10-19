import { Component } from '@angular/core';
import { App } from '../../../../models/app';
import { AppManagementService } from '../../../../services/app-management.service';
import { CustomAppModalComponent } from '../custom-app-modal/custom-app-modal.component';
import { ConsoleService } from '../../../../services/console.service';
import { environment } from '../../../../../environments/environment';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-grid-list',
  templateUrl: './grid-list.component.html',
  styleUrls: ['./grid-list.component.css'],
  imports: [CustomAppModalComponent],
  standalone: true,
})
export class GridListComponent {
  predefinedApps: App[] = [
    {
      appId: 'jellyfin',
      appName: 'Jellyfin',
      appUrl: environment.jellyfinUrl,
      desc: '**Only for self-hosted projects!** Set custom URL in environments variable. For hosted: use (+) to add your custom jellyfin setup!',
      image:
        'https://static-00.iconduck.com/assets.00/jellyseerr-icon-2048x1968-ox8q7e49.png',
    },
    {
      appId: 'twitch',
      appName: 'Twitch',
      appUrl: 'https://hisense.tv.twitch.tv/',
      desc: 'is an interactive livestreaming service for content spanning gaming, entertainment, sports, music, and more.',
      image:
        'https://play-lh.googleusercontent.com/QLQzL-MXtxKEDlbhrQCDw-REiDsA9glUH4m16syfar_KVLRXlzOhN7tmAceiPerv4Jg=w240-h480-rw',
    },
    {
      appId: 'vevo',
      appName: 'Vevo',
      appUrl: 'https://hisense.vevo.com',
      desc: `is the world's leading music video network, connecting an ever-growing global audience to high quality music video content for more than a decade.`,
      image:
        'https://play-lh.googleusercontent.com/S3Wc8RcjrGvFwn6y8Q6xQRVGxO2FJr9HIaN7pxO-uG9i6D8ijNXAtoEwkBk0JLc69w=w240-h480',
    },
    {
      appId: 'webvideocast',
      appName: 'Web Video Cast',
      appUrl: 'https://vewd.webvideocaster.com/',
      desc: 'allows you to watch on your TV videos from your favorite websites including movies, TV shows, live streams of news, sports, and IPTV.',
      image:
        'https://play-lh.googleusercontent.com/4xUYWX2Z6LhCeyxjxfPl4d9v8DNGXiXJvR4gHcgTR3YCVoarhhGdfroTp1QvYI8pIQ',
    },
  ];

  isModalOpen = false;

  constructor(
    private appManagementService: AppManagementService,
    private consoleService: ConsoleService,
    private toastr: ToastrService
  ) {}

  installApp(app: App) {
    this.toastr.info(`Installing ${app.appName}`);
    this.consoleService.addLog(`Installing  ${app.appName}`);
    this.appManagementService
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

  uninstallApp(app: App) {
    this.toastr.info(`Uninstall ${app.appName}`);
    this.consoleService.addLog(`Uninstall  ${app.appName}`);
    this.appManagementService
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

  openModal(): void {
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
  }
}
