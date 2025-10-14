import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DeviceInfoService {
  /**
   * Get Firmware Version
   * Retrieves the firmware version of the device.
   * Use to check if VIDAA OS is running and to validate the availability of the global functions.
   *
   * @returns {string | null} A string representing the firmware version, or null if the function is not available.
   */
  getFirmwareVersion(): string | null {
    try {
      if (typeof Hisense_GetFirmWareVersion === 'undefined') {
        console.warn('Hisense_GetFirmWareVersion is not available');
        return null;
      }
      return Hisense_GetFirmWareVersion();
    } catch (error) {
      console.error(
        'Error: Hisense_GetFirmWareVersion is not defined or failed.',
        error
      );
      return null;
    }
  }

  /**
   * Get Device ID
   * Retrieves a unique ID for the device.
   * @returns {string | null} A 56-byte string representing the unique device ID, or null if not available.
   * @example "861003009000006000000641a9ceff9b0d3706276f8712e3d4b793d8"
   */
  getDeviceID(): string | null {
    try {
      if (typeof Hisense_GetDeviceID === 'undefined') {
        return null;
      }
      return Hisense_GetDeviceID();
    } catch (error) {
      console.error('Error getting device ID:', error);
      return null;
    }
  }

  /**
   * Get Country Code
   * Retrieves the country code of the device.
   * @returns {string | null} A country abbreviation (e.g., "USA", "CAN", "MEX"), or null if not available.
   */
  getCountryCode(): string | null {
    try {
      if (typeof Hisense_GetCountryCode === 'undefined') {
        return null;
      }
      return Hisense_GetCountryCode();
    } catch (error) {
      console.error('Error getting country code:', error);
      return null;
    }
  }

  /**
   * Get TV Brand
   * Retrieves the brand name of the TV.
   * @returns {string | null} The full name of the TV brand, or null if not available.
   * @example "Hisense", "Sharp"
   */
  getTVBrand(): string | null {
    try {
      if (typeof Hisense_GetBrand === 'undefined') {
        return null;
      }
      return Hisense_GetBrand();
    } catch (error) {
      console.error('Error getting TV brand:', error);
      return null;
    }
  }

  /**
   * Get TV Model Name
   * Retrieves the model name or hardware version of the TV.
   * @returns {string | null} The model name of the TV, or null if not available.
   * @example "55H8G", "U7QF"
   */
  getTVModelName(): string | null {
    try {
      if (typeof Hisense_GetModelName === 'undefined') {
        return null;
      }
      return Hisense_GetModelName();
    } catch (error) {
      console.error('Error getting TV model name:', error);
      return null;
    }
  }

  /**
   * Get 4K Support Status
   * Checks if the device supports 4K resolution.
   * @returns {boolean | null} True if 4K is supported, false otherwise, null if not available.
   */
  is4KSupported(): boolean | null {
    try {
      if (typeof Hisense_Get4KSupportState === 'undefined') {
        return null;
      }
      return Hisense_Get4KSupportState();
    } catch (error) {
      console.error('Error checking 4K support:', error);
      return null;
    }
  }
}
