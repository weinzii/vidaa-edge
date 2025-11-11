import { Injectable } from '@angular/core';
import { BINARY_SIGNATURES } from '../../config/exploration-paths.config';

export interface BinaryCheckResult {
  isBinary: boolean;
  fileType: string;
  confidence: number;
  magicBytes: string;
}

export interface ContentAnalysis {
  isBinary: boolean;
  fileType: string;
  encoding: string;
  confidence: number;
  magicBytes?: string;
  contentPreview: string;
}

/**
 * Service for analyzing file content
 * Handles:
 * - Binary detection (magic bytes, null bytes, character ratio)
 * - File type determination (scripts, text, binary formats)
 * - Content encoding detection
 * - Magic bytes formatting
 */
@Injectable({
  providedIn: 'root',
})
export class FileContentAnalyzerService {
  /**
   * Analyze file content and determine type, encoding, etc.
   */
  public analyzeContent(path: string, content: string): ContentAnalysis {
    // Detect if binary
    const binaryCheck = this.detectBinary(content);
    const isBinary = binaryCheck.isBinary;

    // Determine encoding
    const encoding = isBinary ? 'binary' : 'utf-8';

    // Generate preview
    const preview = isBinary
      ? `[Binary: ${binaryCheck.fileType}]`
      : content.slice(0, 10000);

    return {
      isBinary,
      fileType: binaryCheck.fileType,
      encoding,
      confidence: binaryCheck.confidence,
      magicBytes: binaryCheck.magicBytes,
      contentPreview: preview,
    };
  }

  /**
   * Detect if content is binary
   * Uses multiple heuristics:
   * 1. Magic bytes (file signatures)
   * 2. Null bytes (strong indicator)
   * 3. Shebang (#! for scripts)
   * 4. Printable character ratio
   */
  public detectBinary(content: string): BinaryCheckResult {
    // Check magic bytes (file signatures)
    for (const [signature, type] of Object.entries(BINARY_SIGNATURES)) {
      if (content.startsWith(signature)) {
        return {
          isBinary: true,
          fileType: type as string, // Type assertion: BINARY_SIGNATURES values are strings
          confidence: 1.0,
          magicBytes: this.formatMagicBytes(content.slice(0, 8)),
        };
      }
    }

    // Check for null bytes (strong indicator of binary)
    if (content.includes('\0')) {
      return {
        isBinary: true,
        fileType: 'binary',
        confidence: 1.0,
        magicBytes: this.formatMagicBytes(content.slice(0, 8)),
      };
    }

    // Check for script shebang
    if (content.startsWith('#!')) {
      return {
        isBinary: false,
        fileType: this.detectScriptType(content),
        confidence: 1.0,
        magicBytes: this.formatMagicBytes(content.slice(0, 8)),
      };
    }

    // Calculate printable character ratio
    const printableChars = (content.match(/[\x20-\x7E\n\r\t]/g) || []).length;
    const ratio = printableChars / content.length;

    // If mostly printable, it's text
    if (ratio > 0.85) {
      return {
        isBinary: false,
        fileType: this.detectTextFileType(content),
        confidence: ratio,
        magicBytes: this.formatMagicBytes(content.slice(0, 8)),
      };
    }

    // Otherwise, probably binary
    return {
      isBinary: ratio < 0.7,
      fileType: ratio < 0.7 ? 'binary' : 'text',
      confidence: ratio,
      magicBytes: this.formatMagicBytes(content.slice(0, 8)),
    };
  }

  /**
   * Detect script type from shebang
   */
  private detectScriptType(content: string): string {
    const firstLine = content.split('\n')[0];

    if (firstLine.includes('/bin/sh') || firstLine.includes('/bin/bash')) {
      return 'shell-script';
    }
    if (firstLine.includes('python')) {
      return 'python-script';
    }
    if (firstLine.includes('node') || firstLine.includes('nodejs')) {
      return 'javascript-script';
    }
    if (firstLine.includes('perl')) {
      return 'perl-script';
    }
    if (firstLine.includes('ruby')) {
      return 'ruby-script';
    }
    if (firstLine.includes('php')) {
      return 'php-script';
    }

    return 'script';
  }

  /**
   * Detect text file type from content patterns
   */
  private detectTextFileType(content: string): string {
    // Check for common file patterns
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      return 'json';
    }
    if (content.includes('<?xml')) {
      return 'xml';
    }
    if (content.includes('<html') || content.includes('<!DOCTYPE html')) {
      return 'html';
    }
    if (
      content.includes('function ') ||
      content.includes('const ') ||
      content.includes('let ') ||
      content.includes('var ')
    ) {
      return 'javascript';
    }
    if (content.includes('export ') || content.includes('source ')) {
      return 'shell-script';
    }
    if (
      content.match(/^[A-Z_]+=/) ||
      content.includes('\n[') ||
      content.includes('.ini')
    ) {
      return 'config';
    }

    return 'text';
  }

  /**
   * Format magic bytes as hex string
   */
  public formatMagicBytes(content: string): string {
    return content
      .slice(0, 8)
      .split('')
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(' ');
  }
}
