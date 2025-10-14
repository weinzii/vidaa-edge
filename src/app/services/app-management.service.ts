import { Injectable } from '@angular/core';
import { ConsoleService } from './console.service';

@Injectable({
  providedIn: 'root',
})
export class AppManagementService {
  constructor(private consoleService: ConsoleService) {}

  /**
   * Installs an app using Hisense_installApp API
   * @param appId Unique ID for the app
   * @param appName Name of the app
   * @param thumbnail URL for the app thumbnail
   * @param iconSmall URL for the small icon
   * @param iconBig URL for the big icon
   * @param appUrl URL to the app
   * @param storeType Store type (e.g., "store")
   * @returns A promise that resolves to true if the installation succeeds or false if it fails
   */
  installApp(
    appId: string,
    appName: string,
    thumbnail: string,
    iconSmall: string,
    iconBig: string,
    appUrl: string,
    storeType: string
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        // Check if Hisense_installApp is available
        if (typeof Hisense_installApp === 'undefined') {
          const errorMsg = 'Hisense_installApp is not available on this device';
          this.consoleService.addLog(errorMsg, 'error');
          reject(new Error(errorMsg));
          return;
        }

        Hisense_installApp(
          appId,
          appName,
          thumbnail,
          iconSmall,
          iconBig,
          appUrl,
          storeType,
          (res: number) => {
            if (res === 0) {
              this.consoleService.addLog(
                `Installation succeeded for ${appName}: ${res}`
              );
              resolve(true);
            } else {
              this.consoleService.addLog(
                `Installation failed for ${appName}: ${res}`,
                'error'
              );
              resolve(false);
            }
          }
        );
      } catch (error) {
        this.consoleService.addLog(
          `Installation failed for ${appName}: ${error}`,
          'error'
        );
        reject(error);
      }
    });
  }

  /**
   * Uninstalls an app on a Hisense TV.
   * @param appId Unique ID of the app to uninstall
   * @param appName Name of the app (used for logging)
   * @returns A promise that resolves to true if the uninstallation was successful, or false otherwise
   */
  uninstallApp(appId: string, appName: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        // Check if Hisense_uninstallApp is available
        if (typeof Hisense_uninstallApp === 'undefined') {
          const errorMsg =
            'Hisense_uninstallApp is not available on this device';
          this.consoleService.addLog(errorMsg, 'error');
          reject(new Error(errorMsg));
          return;
        }

        Hisense_uninstallApp(appId, (status: boolean) => {
          if (status) {
            this.consoleService.addLog(
              `Uninstallation succeeded for ${appName}: ${status}`
            );
            resolve(true);
          } else {
            this.consoleService.addLog(
              `Uninstallation failed for ${appName}: ${status}`,
              'error'
            );
            resolve(false);
          }
        });
      } catch (error) {
        this.consoleService.addLog(
          `Uninstallation failed for ${appName}: ${error}`,
          'error'
        );
        reject(error);
      }
    });
  }
}
