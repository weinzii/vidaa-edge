/**
 * Hisense Functions from WebApp Development_Guide_for_Vidaa.pdf
 * https://www.vidaa.com/wp-content/uploads/2020/12/WebApp_Development_Guide_for_VIDAA.pdf
 */

declare function Hisense_GetDeviceID(): string;
declare function Hisense_GetFirmWareVersion(): string;
declare function Hisense_GetCountryCode(): string;
declare function Hisense_Get4KSupportState(): boolean;
declare function Hisense_GetBrand(): string;
declare function Hisense_GetModelName(): string;
declare function Hisense_GetSupportForHDR(): string;
declare function Hisense_GetPictureModeList(): string;
declare function Hisense_GetPictureMode(): number;
declare function Hisense_SetPictureMode(pictureMode: number): boolean;
declare function Hisense_GetResolution(): string;
declare function Hisense_GetParentalControlEnabled(): boolean;
declare function Hisense_GetRatingEnable(): boolean;
declare function Hisense_GetTvRating(): string;
declare function Hisense_GetTvChildrenRating(): string;
declare function Hisense_GetMovieRating(): string;
declare function Hisense_GetCanEngRating(): string;
declare function Hisense_GetCanFreRating(): string;
declare function Hisense_GetParentControls(): string;
declare function Hisense_installApp(appId: string, appName: string, thumbnail: string, iconSmall: string, iconBig: string, AppUrl: string, storeType: string, callback: (res: number) => void): void;
declare function Hisense_uninstallApp(appId: string, callback: (status: boolean) => void): void;


//**
// List of all available Hisense functions
// source vidaa.service.ts: getAvailableHisenseFunctions()
//*************************************** */
//Hisense_LoginWithVIDAA
//Hisense_installApp_V2
//Hisense_installApp
//Hisense_uninstallApp
//Hisense_getInstalledApps
//Hisense_GetApiVersion
//Hisense_GetDeviceInfo
//Hisense_GetTTSInfo
//Hisense_GetDrmInfo
//Hisense_GetDialInfo
//Hisense_GetNetworkInfo
//Hisense_GetParentControlInfo
//Hisense_GetPictureInfo
//Hisense_GetSoundInfo
//Hisense_GetChromiumVersion
//Hisense_GetCurrentBrowser
//Hisense_GetDeviceID
//Hisense_GetFirmWareVersion
//Hisense_GetDeviceCode
//Hisense_GetVersionStatus
//Hisense_GetChipSetName
//Hisense_GetSerialType
//Hisense_GetAdsID
//Hisense_GetEulaAdEnable
//Hisense_GetAdTargetEnable
//Hisense_GetOSVersion
//Hisense_GetCountryCode
//Hisense_Get4KSupportState
//Hisense_GetNetStatus
//Hisense_GetNetType
//Hisense_GetWoLEnable
//Hisense_GetWOWEnable
//Hisense_GetRegion
//Hisense_GetPanelResolution
//Hisense_GetMute
//Hisense_GetIPAddress
//Hisense_GetPictureMode
//Hisense_GetResolution
//Hisense_GetMenuLanguageCode
//Hisense_GetLocaleLanguage
//Hisense_GetSubtitleStatus
//Hisense_GetHighContrastMenuStatus
//Hisense_GetFeatureCode
//Hisense_GetCapabilityCode
//Hisense_GetIsHotelMode
//Hisense_RegisterObserver
//Hisense_UnregisterObserver
//Hisense_GetBrand
//Hisense_GetSupportForDolbyAtmos
//Hisense_GetUuid
//Hisense_GetMainSoundDev
//Hisense_GetSupportForHDR
//Hisense_GetSupportForHDRInfo
//Hisense_GetPlayerFeatureInfo
//Hisense_GetModelName
//Hisense_GetTVLogo
//Hisense_GetTTSEnable
//Hisense_GetTTSLanguage
//Hisense_GetTTSPitch
//Hisense_GetTTSVolume
//Hisense_GetTTSRate
//Hisense_GetTimeZone
//Hisense_GetVolume
//Hisense_GetVolumeType
//Hisense_GetMenuScheme
//Hisense_GetMenuTransparency
//Hisense_GetVolumeBarMode
//Hisense_GetVolumeBarVisible
//Hisense_GetParentControlEnabled
//Hisense_GetBlockStartTime
//Hisense_GetBlockEndTime
//Hisense_GetBlockTimeWeekly
//Hisense_setStartBandwidth
//Hisense_disableVKB
//Hisense_enableVKB
//Hisense_SetRemoteKeyboard
//Hisense_SupportAppConfig
//Hisense_GetTestApiList
//Hisense_HiSdkSignCreate
//Hisense_HiSdkSignCreateSoundbar
//Hisense_HiSdkJsonVerifyHeap
//Hisense_WriteTvRunLog
//Hisense_GetCustomerID
//Hisense_SetCustomerID
//Hisense_GetRoleID
//Hisense_SetRoleID
//Hisense_SetDNS
//Hisense_GetDNS
//Hisense_GetMacAddress
//Hisense_ResetDevice
//Hisense_Encrypt
//Hisense_Decrypt
//Hisense_RSADecrypt
//Hisense_CheckCodeValid
//Hisense_CheckAccessCode
//Hisense_GetUpdatesVerInfo
//Hisense_GetDebugLevelForHisenseUI
//Hisense_EnableDebugLog
//Hisense_PrintLogMessage
//Hisense_setDebugPort
//Hisense_getDebugPort
//Hisense_FileRead
//Hisense_FileWrite
//  ***********************************/