import { Injectable } from '@angular/core';
import { ConsoleService } from './console.service';


@Injectable({
    providedIn: 'root'
})
export class VidaaService {

    constructor(private consoleService: ConsoleService) { }

    /**
     * Get Available Hisense Functions
     * Discover all available Hisense functions in the global scope.
     * see global.d.ts for more details
     * @returns {string[]} An array of available Hisense functions.
     * @credits https://bananamafia.dev/post/hisensehax/
     */
    getAvailableHisenseFunctions(): string[] {
        return Object.getOwnPropertyNames(window).filter(name => name.startsWith('Hisense_'));
    }

    /**
     * Get Firmware Version
     * Retrieves the firmware version of the device.
     * Use to check if VIDAA OS is running and to validate the availability of the global functions.
     * 
     * Why try-catch only here? Because I'm lazy and decided to handle it just for this method 
     * instead of implementing it everywhere for all global functions.
     * 
     * @returns {string | null} A string representing the firmware version, or null if the function is not available.
     */
    getFirmwareVersion(): string | null {
        try {
            return Hisense_GetFirmWareVersion();
        } catch (error) {
            console.error('Error: Hisense_GetFirmWareVersion is not defined or failed.', error);
            return null;
        }
    }


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
    installApp(appId: string, appName: string, thumbnail: string, iconSmall: string, iconBig: string, appUrl: string, storeType: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            try {
                Hisense_installApp(appId, appName, thumbnail, iconSmall, iconBig, appUrl, storeType,
                    (res: number) => {
                        if (res === 0) {
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    }
                );
            } catch (error) {
                this.consoleService.addLog(`Installation failed for ${appName}: ${error}`, 'error');
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
                Hisense_uninstallApp(appId, (status: boolean) => {
                    if (status) {
                        resolve(true);
                        this.consoleService.addLog(`Installation succeded for ${appName}: ${status}`);
                    } else {
                        resolve(false);
                        this.consoleService.addLog(`Uninstallation failed for ${appName}: ${status}`, 'error');
                    }
                });
            } catch (error) {
                this.consoleService.addLog(`Uninstallation failed for ${appName}: ${error}`, 'error');
                reject(error);
            }
        });
    }


    /**
     * Get Device ID
     * Retrieves a unique ID for the device.
     * @returns {string} A 56-byte string representing the unique device ID.
     * @example "861003009000006000000641a9ceff9b0d3706276f8712e3d4b793d8"
     */
    getDeviceID(): string {
        return Hisense_GetDeviceID();
    }


    /**
     * Get Country Code
     * Retrieves the country code of the device.
     * @returns {string} A country abbreviation (e.g., "USA", "CAN", "MEX").
     * @example "USA" for United States, "CAN" for Canada, "MEX" for Mexico.
     */
    getCountryCode(): string {
        return Hisense_GetCountryCode();
    }

    /**
     * Get 4K Support Status
     * Checks if the device supports 4K resolution.
     * @returns {boolean} True if 4K is supported, false otherwise.
     * @example true (4K supported), false (4K not supported).
     */
    is4KSupported(): boolean {
        return Hisense_Get4KSupportState();
    }

    /**
     * Get TV Brand
     * Retrieves the brand name of the TV.
     * @returns {string} The full name of the TV brand.
     * @example "Hisense", "Sharp"
     */
    getTVBrand(): string {
        return Hisense_GetBrand();
    }

    /**
     * Get TV Model Name
     * Retrieves the model name or hardware version of the TV.
     * @returns {string} The model name of the TV.
     * @example "55H8G", "U7QF"
     */
    getTVModelName(): string {
        return Hisense_GetModelName();
    }

    /**
     * Get HDR Support
     * Retrieves the type of HDR support available on the TV.
     * @returns {string} A string representing the HDR type.
     * @example "0" (not supported), "1" (HDR10), "2" (HLG), "3" (HDR10+HLG), "4" (HDR10+HLG+HDR10+)
     */
    getHDRSupport(): string {
        return Hisense_GetSupportForHDR();
    }

    /**
     * Get Picture Mode List
     * Retrieves a list of all available picture modes.
     * @returns {string} A comma-separated list of picture modes.
     * @example "Vivid,Standard,Energy Saving,Theater,Game,Sport,Calibrated"
     */
    getPictureModeList(): string {
        return Hisense_GetPictureModeList();
    }

    /**
     * Get Current Picture Mode
     * Retrieves the current picture mode of the TV.
     * @returns {number} An integer representing the current picture mode.
     * @example 0 (Vivid), 1 (Standard), 2 (Energy Saving), 3 (Theater), 4 (Game), 5 (Sport), 6 (Calibrated)
     */
    getCurrentPictureMode(): number {
        return Hisense_GetPictureMode();
    }

    /**
     * Set Picture Mode
     * Sets the picture mode of the TV.
     * @param {number} pictureMode The desired picture mode as an integer.
     * @returns {boolean} True if the mode was set successfully, false otherwise.
     * @example true (success), false (failure)
     */
    setPictureMode(pictureMode: number): boolean {
        return Hisense_SetPictureMode(pictureMode);
    }

    /**
     * Get Resolution
     * Retrieves the resolution of the current input signal.
     * @returns {string} A string with frame width, height, interlacing, and framerate.
     * @example "1920,1080,0,60" (1920x1080, progressive, 60fps)
     */
    getResolution(): string {
        return Hisense_GetResolution();
    }

    // Parental Control Functions

    /**
     * Get Parental Control Lock Status
     * Checks if parental control is enabled.
     * @returns {boolean} True if enabled, false otherwise.
     * @example true (enabled), false (disabled)
     */
    isParentalControlEnabled(): boolean {
        return Hisense_GetParentalControlEnabled();
    }

    /**
     * Get Parental Controller Status
     * Checks if the parental controller is locked.
     * @returns {boolean} True if locked, false otherwise.
     * @example true (locked), false (unlocked)
     */
    isRatingEnabled(): boolean {
        return Hisense_GetRatingEnable();
    }

    /**
     * Get TV Rating
     * Retrieves the current TV rating set for parental control.
     * @returns {string} The TV rating.
     * @example "TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14", "TV-MA", "OFF"
     */
    getTVRating(): string {
        return Hisense_GetTvRating();
    }

    /**
     * Get TV Children Rating
     * Retrieves the current children's TV rating set for parental control.
     * @returns {string} The children TV rating.
     * @example "TV-Y", "TV-Y7", "OFF"
     */
    getTVChildrenRating(): string {
        return Hisense_GetTvChildrenRating();
    }

    /**
     * Get Movie Rating
     * Retrieves the current movie rating set for parental control.
     * @returns {string} The movie rating.
     * @example "G", "PG", "PG-13", "R", "NC-17", "X", "OFF"
     */
    getMovieRating(): string {
        return Hisense_GetMovieRating();
    }

    /**
     * Get Canadian English Rating
     * Retrieves the Canadian English parental control rating.
     * @returns {string} The Canadian English rating.
     * @example "C", "C8+", "G", "PG", "14+", "18+", "OFF"
     */
    getCanadianEnglishRating(): string {
        return Hisense_GetCanEngRating();
    }

    /**
     * Get Canadian French Rating
     * Retrieves the Canadian French parental control rating.
     * @returns {string} The Canadian French rating.
     * @example "G", "8ans+", "13ans+", "16ans+", "18ans+", "OFF"
     */
    getCanadianFrenchRating(): string {
        return Hisense_GetCanFreRating();
    }

    /**
     * Get Parental Control Information
     * Retrieves detailed parental control information as a JSON object.
     * @returns {any} An object with parental control details.
     * @example
     * {
     *   "enable": 1,
     *   "US_TV_Ratings": "TV-Y",
     *   "US_MOVIE_Ratings": "G",
     *   "Canadian_English_Ratings": "G",
     *   "Canadian_French_Ratings": "G"
     * }
     */
    getParentalControlInformation(): any {
        const infoJson = Hisense_GetParentControls();
        return JSON.parse(infoJson);
    }
}
