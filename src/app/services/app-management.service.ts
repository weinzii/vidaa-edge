import { Injectable } from '@angular/core';
import { ConsoleService } from './console.service';

export interface AppEntry {
  Id: string;
  AppName: string;
  Title: string;
  URL: string;
  StartCommand: string;
  IconURL: string;
  Icon_96: string;
  Image: string;
  Thumb: string;
  Type: string;
  InstallTime: string;
  RunTimes: number;
  StoreType: string;
  PreInstall: boolean;
}

export interface AppInfoFile {
  AppInfo: AppEntry[];
}

@Injectable({
  providedIn: 'root',
})
export class AppManagementService {
  constructor(private consoleService: ConsoleService) {}

  /**
   * Installs an app using Hisense_installApp API (Legacy Method)
   * @param appId Unique ID for the app
   * @param appName Name of the app
   * @param thumbnail URL for the app thumbnail
   * @param iconSmall URL for the small icon
   * @param iconBig URL for the big icon
   * @param appUrl URL to the app
   * @param storeType Store type (e.g., "store")
   * @returns A promise that resolves to true if the installation succeeds or false if it fails
   */
  installAppLegacy(
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
   * Installs an app using the new method (HiUtils_createRequest with file system access)
   * This writes directly to the system's Appinfo.json file
   * @param appId Unique ID for the app
   * @param appName Name of the app
   * @param appUrl URL to the app
   * @param iconUrl URL for the app icon
   * @returns A promise that resolves to true if the installation succeeds or false if it fails
   */
  installAppNew(
    appId: string,
    appName: string,
    appUrl: string,
    iconUrl: string
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        // Check if HiUtils_createRequest is available
        const windowObj = window as unknown as Record<string, unknown>;
        if (typeof windowObj['HiUtils_createRequest'] !== 'function') {
          const errorMsg =
            'HiUtils_createRequest is not available on this device';
          this.consoleService.addLog(errorMsg, 'error');
          reject(new Error(errorMsg));
          return;
        }

        const HiUtils_createRequest = windowObj['HiUtils_createRequest'] as (
          action: string,
          params: Record<string, unknown>
        ) => { ret: boolean; msg: string };

        // Read existing app list from system storage
        const current = HiUtils_createRequest('fileRead', {
          path: 'websdk/Appinfo.json',
          mode: 6,
        });

        // Parse JSON if it exists, otherwise create an empty structure
        const apps: AppInfoFile = current.ret
          ? JSON.parse(current.msg)
          : { AppInfo: [] };

        // Define the new app entry
        const newApp: AppEntry = {
          Id: appId,
          AppName: appName,
          Title: appName,
          URL: appUrl,
          StartCommand: appUrl,
          IconURL: iconUrl,
          Icon_96: iconUrl,
          Image: iconUrl,
          Thumb: iconUrl,
          Type: 'Browser',
          InstallTime: new Date().toISOString().split('T')[0],
          RunTimes: 0,
          StoreType: 'custom',
          PreInstall: false,
        };

        // Update existing entry or add a new one
        const index = apps.AppInfo.findIndex((a) => a.Id === newApp.Id);
        if (index >= 0) {
          apps.AppInfo[index] = newApp;
        } else {
          apps.AppInfo.push(newApp);
        }

        // Write the updated list back to the system file
        const result = HiUtils_createRequest('fileWrite', {
          path: 'websdk/Appinfo.json',
          mode: 6,
          writedata: JSON.stringify(apps),
        });

        if (result.ret) {
          this.consoleService.addLog(
            `Installation succeeded for ${appName} (new method)`
          );
          resolve(true);
        } else {
          this.consoleService.addLog(
            `Installation failed for ${appName} (new method): ${result.msg}`,
            'error'
          );
          resolve(false);
        }
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
   * Uninstalls an app using the new method (HiUtils_createRequest with file system access)
   * This removes the app entry from the system's Appinfo.json file
   * @param appId Unique ID of the app to uninstall
   * @param appName Name of the app (used for logging)
   * @returns A promise that resolves to true if the uninstallation was successful, or false otherwise
   */
  uninstallAppNew(appId: string, appName: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        // Check if HiUtils_createRequest is available
        const windowObj = window as unknown as Record<string, unknown>;
        if (typeof windowObj['HiUtils_createRequest'] !== 'function') {
          const errorMsg =
            'HiUtils_createRequest is not available on this device';
          this.consoleService.addLog(errorMsg, 'error');
          reject(new Error(errorMsg));
          return;
        }

        const HiUtils_createRequest = windowObj['HiUtils_createRequest'] as (
          action: string,
          params: Record<string, unknown>
        ) => { ret: boolean; msg: string };

        // Read existing app list from system storage
        const current = HiUtils_createRequest('fileRead', {
          path: 'websdk/Appinfo.json',
          mode: 6,
        });

        if (!current.ret) {
          this.consoleService.addLog(
            `Cannot read app list for uninstallation`,
            'error'
          );
          resolve(false);
          return;
        }

        // Parse JSON
        const apps: AppInfoFile = JSON.parse(current.msg);

        // Find and remove the app entry
        const index = apps.AppInfo.findIndex((a) => a.Id === appId);
        if (index < 0) {
          this.consoleService.addLog(
            `App ${appName} not found in installed apps`,
            'error'
          );
          resolve(false);
          return;
        }

        apps.AppInfo.splice(index, 1);

        // Write the updated list back to the system file
        const result = HiUtils_createRequest('fileWrite', {
          path: 'websdk/Appinfo.json',
          mode: 6,
          writedata: JSON.stringify(apps),
        });

        if (result.ret) {
          this.consoleService.addLog(
            `Uninstallation succeeded for ${appName} (new method)`
          );
          resolve(true);
        } else {
          this.consoleService.addLog(
            `Uninstallation failed for ${appName} (new method): ${result.msg}`,
            'error'
          );
          resolve(false);
        }
      } catch (error) {
        this.consoleService.addLog(
          `Uninstallation failed for ${appName}: ${error}`,
          'error'
        );
        reject(error);
      }
    });
  }

  /**
   * Uninstalls an app on a Hisense TV (Legacy Method).
   * @param appId Unique ID of the app to uninstall
   * @param appName Name of the app (used for logging)
   * @returns A promise that resolves to true if the uninstallation was successful, or false otherwise
   */
  uninstallAppLegacy(appId: string, appName: string): Promise<boolean> {
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

  /**
   * Check if the new installation method is available
   * @returns true if HiUtils_createRequest is available
   */
  isNewMethodAvailable(): boolean {
    const windowObj = window as unknown as Record<string, unknown>;
    return typeof windowObj['HiUtils_createRequest'] === 'function';
  }

  /**
   * Check if the legacy installation method is available
   * @returns true if Hisense_installApp is available
   */
  isLegacyMethodAvailable(): boolean {
    return typeof Hisense_installApp !== 'undefined';
  }
}
