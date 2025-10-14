import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { ConsoleService } from './console.service';

export interface TVConnectionInfo {
  connected: boolean;
  lastSeen: Date | null;
  brand?: string;
  model?: string;
  firmware?: string;
}

/**
 * Service for managing TV connection status and keep-alive functionality.
 * Monitors TV availability and maintains connection state.
 */
@Injectable({
  providedIn: 'root',
})
export class TvConnectionService {
  private tvConnectionSubject = new BehaviorSubject<TVConnectionInfo>({
    connected: false,
    lastSeen: null,
    brand: undefined,
    model: undefined,
    firmware: undefined,
  });

  public tvConnection$ = this.tvConnectionSubject.asObservable();

  constructor(
    private http: HttpClient,
    private consoleService: ConsoleService
  ) {
    this.startConnectionMonitoring();
  }

  /**
   * Start monitoring TV connection status.
   * Checks connection every 10 seconds.
   */
  private startConnectionMonitoring(): void {
    interval(10000).subscribe(() => {
      // Connection status is updated by function service
      // This is a placeholder for future connection checks
    });
  }

  /**
   * Update TV connection information.
   * @param info Partial connection info to update
   */
  public updateTvConnection(info: Partial<TVConnectionInfo>): void {
    const current = this.tvConnectionSubject.value;
    const updated = {
      ...current,
      ...info,
      lastSeen: info.lastSeen || new Date(),
    };
    this.tvConnectionSubject.next(updated);
  }

  /**
   * Get current TV connection status.
   * @returns Current connection info
   */
  public getConnectionStatus(): TVConnectionInfo {
    return this.tvConnectionSubject.value;
  }

  /**
   * Send keep-alive ping to maintain TV connection.
   * @returns Observable with keep-alive response
   */
  public sendKeepAlive(): Observable<unknown> {
    return this.http.post('/api/keepalive', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Extract device details from device info object.
   * @param deviceInfo Device information from TV
   * @returns Extracted device details (brand, model, firmware)
   */
  public extractDeviceDetails(
    deviceInfo: Record<string, unknown> | null | undefined
  ): {
    brand?: string;
    model?: string;
    firmware?: string;
  } {
    if (!deviceInfo) return {};

    return {
      brand:
        (typeof deviceInfo?.['Hisense_GetBrand'] === 'string'
          ? deviceInfo['Hisense_GetBrand']
          : undefined) ||
        (typeof deviceInfo?.['userAgent'] === 'string' &&
        deviceInfo['userAgent'].includes('Hisense')
          ? 'Hisense'
          : undefined),
      model:
        typeof deviceInfo?.['Hisense_GetModelName'] === 'string'
          ? deviceInfo['Hisense_GetModelName']
          : undefined,
      firmware:
        (typeof deviceInfo?.['Hisense_GetFirmWareVersion'] === 'string'
          ? deviceInfo['Hisense_GetFirmWareVersion']
          : undefined) ||
        (typeof deviceInfo?.['Hisense_GetApiVersion'] === 'string'
          ? deviceInfo['Hisense_GetApiVersion']
          : undefined),
    };
  }
}
