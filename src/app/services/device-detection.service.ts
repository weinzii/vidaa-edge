import { Injectable } from '@angular/core';

export interface DeviceInfo {
  isTV: boolean;
  isLaptop: boolean;
  deviceType: 'tv' | 'laptop' | 'unknown';
  userAgent: string;
}

@Injectable({
  providedIn: 'root',
})
export class DeviceDetectionService {
  private deviceInfo: DeviceInfo;

  constructor() {
    this.deviceInfo = this.detectDevice();
    console.log(
      '📱 DeviceDetectionService: Device analysis completed',
      this.deviceInfo
    );
  }

  private detectDevice(): DeviceInfo {
    // TV Detection: Only check for Hisense/VIDAA specific functions
    const isTVBrowser = this.detectTVFunctions();

    return {
      isTV: isTVBrowser,
      isLaptop: !isTVBrowser, // Everything else is treated as laptop/desktop
      deviceType: isTVBrowser ? 'tv' : 'laptop',
      userAgent: navigator.userAgent,
    };
  }

  /**
   * Detect TV by checking for Hisense/VIDAA specific functions in window scope
   */
  private detectTVFunctions(): boolean {
    try {
      const windowObj = window as unknown as Record<string, unknown>;

      // Check for Hisense specific functions
      const hisenseFunctions = [
        'Hisense_GetDeviceID',
        'Hisense_GetModelName',
        'Hisense_GetBrand',
        'Hisense_GetFirmWareVersion',
        'Hisense_GetCountryCode',
        'Hisense_FileRead',
        'Hisense_FileWrite',
      ];

      // Check for VIDAA/TV platform objects
      const tvObjects = ['vowOS', 'omi_platform', 'TvInfo_Json'];

      // Check for TV-specific functions in window scope
      const hasHisenseFunctions = hisenseFunctions.some(
        (funcName) => typeof windowObj[funcName] === 'function'
      );

      // Check for TV platform objects
      const hasTVObjects = tvObjects.some((objName) => {
        const obj = windowObj[objName];
        return obj && typeof obj === 'object';
      });

      return hasHisenseFunctions || hasTVObjects;
    } catch {
      return false;
    }
  }

  public getDeviceInfo(): DeviceInfo {
    return this.deviceInfo;
  }

  public isTV(): boolean {
    return this.deviceInfo.isTV;
  }

  public isLaptop(): boolean {
    return this.deviceInfo.isLaptop;
  }

  public getRecommendedPath(): string {
    if (this.isTV()) {
      return '/console';
    } else if (this.isLaptop()) {
      return '/console';
    }
    return '/';
  }

  public shouldShowNavItem(path: string): boolean {
    if (path.includes('console')) {
      return true; // Console für beide Geräte
    }
    return true; // Andere Items immer zeigen
  }
}
