import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FunctionData } from '../../../services/tv-communication.service';

interface Category {
  key: string;
  name: string;
  icon: string;
}

@Component({
  selector: 'app-function-library',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './function-library.component.html',
  styleUrls: ['./function-library.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FunctionLibraryComponent {
  @Input() availableFunctions: FunctionData[] = [];
  @Input() filteredFunctions: FunctionData[] = [];
  @Input() functionFilter = '';
  @Input() selectedCategory = 'all';
  @Input() expandedSources: Set<string> = new Set();

  @Output() functionFilterChange = new EventEmitter<string>();
  @Output() categorySelected = new EventEmitter<string>();
  @Output() functionSelected = new EventEmitter<FunctionData>();
  @Output() sourceExpansionToggled = new EventEmitter<string>();
  @Output() saveToDisk = new EventEmitter<void>();
  @Output() customCodeOpen = new EventEmitter<void>();
  @Output() copyToCustomCode = new EventEmitter<FunctionData>();

  categories: Category[] = [
    { key: 'all', name: 'All Functions', icon: '📋' },
    { key: 'system', name: 'System Info', icon: '🔧' },
    { key: 'network', name: 'Network', icon: '🌐' },
    { key: 'media', name: 'Media & Audio', icon: '🎵' },
    { key: 'apps', name: 'Apps', icon: '📱' },
    { key: 'security', name: 'Security', icon: '🔒' },
    { key: 'filesystem', name: 'File System', icon: '📁' },
  ];

  onFilterChange(filter: string): void {
    this.functionFilterChange.emit(filter);
  }

  onCategorySelect(category: string): void {
    this.categorySelected.emit(category);
  }

  onFunctionSelect(func: FunctionData): void {
    this.functionSelected.emit(func);
  }

  onSourceToggle(functionName: string, event: Event): void {
    event.stopPropagation();
    this.sourceExpansionToggled.emit(functionName);
  }

  onSaveToDisk(): void {
    this.saveToDisk.emit();
  }

  onCustomCodeOpen(): void {
    this.customCodeOpen.emit();
  }

  onCopyToCustomCode(func: FunctionData): void {
    this.copyToCustomCode.emit(func);
  }

  getCategoryCount(category: string): number {
    if (category === 'all') {
      return this.availableFunctions.length;
    }
    return this.availableFunctions.filter(
      (func) => this.getFunctionCategory(func.name) === category
    ).length;
  }

  getFunctionCategory(functionName: string): string {
    // System Info & Device Management
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(Get|Set)?(Device|Model|Brand|Country|Api|OS|Firmware|Version|Chipset|Serial|Region|Feature|Capability|Power|Standby|SystemInfo|DebugLevel|BlockTime|AdTarget|AdsID|CustomerID|CurrentBrowser)/i
      )
    ) {
      return 'system';
    }

    // Network & Connectivity
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(Get|Set)?(Net|IP|Mac|DNS|Network|Wifi|Connection)/i
      )
    ) {
      return 'network';
    }

    // Media, Audio & Video
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(Get|Set)?(Volume|Sound|Picture|4K|HDR|Resolution|Mute|Dolby|TTS|Subtitle|Audio|Video|Media|Display|Brightness|Contrast)/i
      )
    ) {
      return 'media';
    }

    // App Management & Browser
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(App|Install|Launch|Close|Browser|getAllAppJsonObj|getInstalledAppJsonObj|writeInstallAppObjToJson|mapAppInfoFields|OpenBrowser|CloseBrowser)/i
      )
    ) {
      return 'apps';
    }

    // Security & Encryption
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(Encrypt|Decrypt|RSA|CheckCode|CheckAccess|Reset|HiSdk|Security|Auth|Certificate)/i
      )
    ) {
      return 'security';
    }

    // File System Operations
    if (
      functionName.match(
        /(Hisense_|vowOS_|omi_)?(File|Read|Write|Directory|Storage|Path)/i
      )
    ) {
      return 'filesystem';
    }

    // Default fallback
    return 'system';
  }

  getFunctionType(functionName: string): string {
    // Check for native functions (contain [native] marker)
    if (functionName.includes('[native]')) {
      return 'Native';
    }

    // Everything else is JavaScript
    return 'JS';
  }

  getSourcePreview(sourceCode: string): string {
    if (!sourceCode) return '';

    if (sourceCode.includes('[native code]')) {
      return 'Native C++ function - source not available';
    }

    // Extract first meaningful line
    const lines = sourceCode.split('\n');
    const firstLine = lines.find(
      (line) => line.trim() && !line.trim().startsWith('//')
    );
    return firstLine ? firstLine.trim().substring(0, 60) + '...' : '';
  }

  isSourceExpanded(functionName: string): boolean {
    return this.expandedSources.has(functionName);
  }
}
