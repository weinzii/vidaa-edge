import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DeviceDetectionService {
  private isTVDevice: boolean;

  constructor() {
    this.isTVDevice = this.detectTVFunctions();
  }

  private detectTVFunctions(): boolean {
    try {
      const windowObj = window as unknown as Record<string, unknown>;

      const hisenseFunctions = [
        'Hisense_GetDeviceID',
        'Hisense_GetModelName',
        'Hisense_GetBrand',
        'Hisense_GetFirmWareVersion',
        'Hisense_GetCountryCode',
        'Hisense_FileRead',
        'Hisense_FileWrite',
      ];

      const tvObjects = ['vowOS', 'omi_platform', 'TvInfo_Json'];

      const hasHisenseFunctions = hisenseFunctions.some(
        (funcName) => typeof windowObj[funcName] === 'function'
      );

      const hasTVObjects = tvObjects.some((objName) => {
        const obj = windowObj[objName];
        return obj && typeof obj === 'object';
      });

      return hasHisenseFunctions || hasTVObjects;
    } catch {
      return false;
    }
  }

  public isTV(): boolean {
    return this.isTVDevice;
  }
}
