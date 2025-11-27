import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { AppManagementService } from '../../services/app-management.service';
import { ConsoleService } from '../../services/console.service';
import { DeviceInfoService } from '../../services/device-info.service';
import { environment } from '../../../environments/environment';

type InstallMethod = 'auto' | 'legacy' | 'new';

// Default placeholder icon when no icon URL is provided
const DEFAULT_ICON_URL = '/favicon.ico';

// Element IDs for focus management
enum FocusableElement {
  AppId = 'appId',
  AppName = 'appName',
  AppUrl = 'appUrl',
  IconUrl = 'iconUrl',
  Method = 'method',
  InstallBtn = 'installBtn',
  UninstallBtn = 'uninstallBtn',
}

@Component({
  selector: 'app-installer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './installer.component.html',
})
export class InstallerComponent implements OnInit {
  // Form fields
  appId = '';
  appName = '';
  appUrl = '';
  iconUrl = '';

  // UI State
  isInstalling = false;
  installMethod: InstallMethod = 'auto';
  vidaaDevice = false;
  debugMode: boolean = environment.debug;

  // Focus management for TV remote navigation
  focusedElement = 0;
  readonly focusableElements = Object.values(FocusableElement);

  // Method availability
  legacyAvailable = false;
  newMethodAvailable = false;

  constructor(
    private appManagementService: AppManagementService,
    private consoleService: ConsoleService,
    private deviceInfoService: DeviceInfoService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    if (!this.debugMode) {
      this.checkForVidaaDevice();
    } else {
      this.consoleService.addLog('Debug mode is enabled. Skipping device check.');
      this.vidaaDevice = true;
    }

    // Check available methods
    this.legacyAvailable = this.appManagementService.isLegacyMethodAvailable();
    this.newMethodAvailable = this.appManagementService.isNewMethodAvailable();
  }

  checkForVidaaDevice(): void {
    this.consoleService.addLog('Checking: if the device is running Vidaa OS.');

    const firmwareVersion = this.deviceInfoService.getFirmwareVersion();

    if (firmwareVersion) {
      this.consoleService.addLog('Firmware version detected: ' + firmwareVersion);
      this.vidaaDevice = true;
    } else {
      this.consoleService.addLog(
        'Could not detect firmware version. Device is not running Vidaa OS.',
        'error'
      );
      this.vidaaDevice = false;
    }
  }

  // Handle keyboard navigation for TV remote
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.focusNext();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusPrevious();
        break;
      case 'Enter':
        event.preventDefault();
        this.handleEnter();
        break;
    }
  }

  focusNext(): void {
    if (this.focusedElement < this.focusableElements.length - 1) {
      this.focusedElement++;
      this.focusCurrentElement();
    }
  }

  focusPrevious(): void {
    if (this.focusedElement > 0) {
      this.focusedElement--;
      this.focusCurrentElement();
    }
  }

  focusCurrentElement(): void {
    const elementId = this.focusableElements[this.focusedElement];
    const element = document.getElementById(elementId);
    if (element) {
      element.focus();
    }
  }

  handleEnter(): void {
    const elementId = this.focusableElements[this.focusedElement];
    if (elementId === 'installBtn') {
      this.installApp();
    } else if (elementId === 'uninstallBtn') {
      this.uninstallApp();
    }
  }

  setFocusedElement(index: number): void {
    this.focusedElement = index;
  }

  isFormValid(): boolean {
    return !!(this.appId?.trim() && this.appName?.trim() && this.appUrl?.trim());
  }

  /**
   * Get the icon URL to use for installation.
   * Returns the user-provided icon URL if valid, otherwise uses a default placeholder.
   */
  private getIconUrl(): string {
    const trimmedIcon = this.iconUrl?.trim();
    if (trimmedIcon && (trimmedIcon.startsWith('http://') || trimmedIcon.startsWith('https://'))) {
      return trimmedIcon;
    }
    return DEFAULT_ICON_URL;
  }

  async installApp(): Promise<void> {
    if (!this.isFormValid()) {
      this.toastr.error('Please fill in App ID, App Name, and App URL.');
      return;
    }

    if (this.isInstalling) {
      return;
    }

    this.isInstalling = true;
    this.toastr.info(`Installing ${this.appName}...`);
    this.consoleService.addLog(`Installing ${this.appName} with method: ${this.installMethod}`);

    try {
      let success = false;
      const icon = this.getIconUrl();

      if (this.installMethod === 'auto') {
        // Try new method first, then fall back to legacy
        if (this.newMethodAvailable) {
          this.consoleService.addLog('Trying new installation method...');
          success = await this.appManagementService.installAppNew(
            this.appId,
            this.appName,
            this.appUrl,
            icon
          );
        }
        if (!success && this.legacyAvailable) {
          this.consoleService.addLog('Trying legacy installation method...');
          success = await this.appManagementService.installAppLegacy(
            this.appId,
            this.appName,
            icon,
            icon,
            icon,
            this.appUrl,
            'store'
          );
        }
      } else if (this.installMethod === 'legacy' && this.legacyAvailable) {
        success = await this.appManagementService.installAppLegacy(
          this.appId,
          this.appName,
          icon,
          icon,
          icon,
          this.appUrl,
          'store'
        );
      } else if (this.installMethod === 'new' && this.newMethodAvailable) {
        success = await this.appManagementService.installAppNew(
          this.appId,
          this.appName,
          this.appUrl,
          icon
        );
      }

      if (success) {
        this.toastr.success(`${this.appName} installed successfully! Restart your TV to see the app.`);
        this.consoleService.addLog(`Installation completed for ${this.appName}`);
      } else {
        this.toastr.error(`Failed to install ${this.appName}. Check console for details.`);
        this.consoleService.addLog(`Installation failed for ${this.appName}`, 'error');
      }
    } catch (error) {
      this.toastr.error(`Installation error: ${error}`);
      this.consoleService.addLog(`Installation error for ${this.appName}: ${error}`, 'error');
    } finally {
      this.isInstalling = false;
    }
  }

  async uninstallApp(): Promise<void> {
    if (!this.appId?.trim() || !this.appName?.trim()) {
      this.toastr.error('Please provide App ID and App Name to uninstall.');
      return;
    }

    if (this.isInstalling) {
      return;
    }

    this.isInstalling = true;
    this.toastr.info(`Uninstalling ${this.appName}...`);
    this.consoleService.addLog(`Uninstalling ${this.appName} with method: ${this.installMethod}`);

    try {
      let success = false;

      if (this.installMethod === 'auto') {
        // Try new method first, then fall back to legacy
        if (this.newMethodAvailable) {
          this.consoleService.addLog('Trying new uninstallation method...');
          success = await this.appManagementService.uninstallAppNew(this.appId, this.appName);
        }
        if (!success && this.legacyAvailable) {
          this.consoleService.addLog('Trying legacy uninstallation method...');
          success = await this.appManagementService.uninstallAppLegacy(this.appId, this.appName);
        }
      } else if (this.installMethod === 'legacy' && this.legacyAvailable) {
        success = await this.appManagementService.uninstallAppLegacy(this.appId, this.appName);
      } else if (this.installMethod === 'new' && this.newMethodAvailable) {
        success = await this.appManagementService.uninstallAppNew(this.appId, this.appName);
      }

      if (success) {
        this.toastr.success(`${this.appName} uninstalled successfully! Restart your TV.`);
        this.consoleService.addLog(`Uninstallation completed for ${this.appName}`);
      } else {
        this.toastr.error(`Failed to uninstall ${this.appName}. Check console for details.`);
        this.consoleService.addLog(`Uninstallation failed for ${this.appName}`, 'error');
      }
    } catch (error) {
      this.toastr.error(`Uninstallation error: ${error}`);
      this.consoleService.addLog(`Uninstallation error for ${this.appName}: ${error}`, 'error');
    } finally {
      this.isInstalling = false;
    }
  }

  clearForm(): void {
    this.appId = '';
    this.appName = '';
    this.appUrl = '';
    this.iconUrl = '';
  }
}
