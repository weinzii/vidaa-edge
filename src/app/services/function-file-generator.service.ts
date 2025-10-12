import { Injectable } from '@angular/core';
import { FunctionData } from './tv-communication.service';

export interface DeviceInfo {
  userAgent?: string;
  platform?: string;
  language?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface GeneratedFiles {
  typescript: string;
  javascript: string;
  deviceInfo: string;
}

@Injectable({
  providedIn: 'root',
})
export class FunctionFileGeneratorService {
  generateFiles(
    functions: FunctionData[],
    deviceInfo?: DeviceInfo
  ): GeneratedFiles {
    const timestamp = new Date().toISOString();
    const functionsWithSource = functions.filter((f) =>
      this.hasValidSourceCode(f)
    );

    return {
      typescript: this.generateTypeScriptDefinitions(functions, timestamp),
      javascript: this.generateJavaScriptLibrary(
        functionsWithSource,
        timestamp
      ),
      deviceInfo: this.generateDeviceInfo(
        functions,
        functionsWithSource,
        deviceInfo,
        timestamp
      ),
    };
  }

  private hasValidSourceCode(func: FunctionData): boolean {
    const source = func.sourceCode;

    if (!source || !source.trim()) {
      return false;
    }

    const nativePatterns = [
      '[native code]',
      'function () { [native code] }',
      '[object Object]',
      'undefined',
      'null',
    ];

    const isNative = nativePatterns.some((pattern) => source.includes(pattern));
    const isJustName = source.trim() === func.name;

    return !isNative && !isJustName;
  }

  private generateFunctionSignature(func: FunctionData): string {
    const params = func.parameters || [];

    if (params.length > 0) {
      const paramStr = params
        .map((_param: string, i: number) => `param${i}: unknown`)
        .join(', ');
      return `${func.name}(${paramStr}): unknown;`;
    }

    return `${func.name}(): unknown;`;
  }

  private generateTypeScriptDefinitions(
    functions: FunctionData[],
    timestamp: string
  ): string {
    return [
      '/**',
      ' * Hisense VIDAA TV Platform - TypeScript Definitions',
      ` * Generated: ${timestamp}`,
      ` * Functions: ${functions.length}`,
      ' */',
      '',
      ...functions.map(
        (func) => `declare function ${this.generateFunctionSignature(func)}`
      ),
      '',
      'export {};',
    ].join('\n');
  }

  private generateJavaScriptLibrary(
    functionsWithSource: FunctionData[],
    timestamp: string
  ): string {
    return [
      '/**',
      ' * Hisense VIDAA TV Platform - Functions Source Code',
      ` * Generated: ${timestamp}`,
      ` * Functions: ${functionsWithSource.length}`,
      ' */',
      '',
      ...functionsWithSource.map((func) => {
        const source = func.sourceCode || '';

        // Clean up source code to ensure proper function declaration
        let cleanSource = source;
        if (cleanSource.startsWith('function ')) {
          // Source already starts with 'function', use as is
        } else {
          // Wrap in proper function declaration
          cleanSource = `function ${func.name}() { ${cleanSource} }`;
        }

        return [`// ${func.name}`, cleanSource, ''].join('\n');
      }),
    ].join('\n');
  }

  private generateDeviceInfo(
    functions: FunctionData[],
    functionsWithSource: FunctionData[],
    deviceInfo?: DeviceInfo,
    timestamp?: string
  ): string {
    const keyFunctionNames = [
      'Hisense_GetDeviceInfo',
      'Hisense_GetModelName',
      'Hisense_GetFirmWareVersion',
      'Hisense_GetVolume',
      'Hisense_GetMute',
      'TvInfo_getParam',
      'TvInfo_setParam',
    ];

    const info = {
      scanInfo: {
        timestamp: timestamp || new Date().toISOString(),
        totalFunctions: functions.length,
        functionsWithSource: functionsWithSource.length,
        nativeFunctions: functions.length - functionsWithSource.length,
      },
      deviceInfo: deviceInfo || {},
      functionsWithSource: functionsWithSource.map((f: FunctionData) => ({
        name: f.name,
        parameters: f.parameters?.length || 0,
      })),
      keyFunctions: keyFunctionNames.filter((name: string) =>
        functions.some((f: FunctionData) => f.name === name)
      ),
      developmentReady: functionsWithSource.length > 0,
    };

    return JSON.stringify(info, null, 2);
  }
}
