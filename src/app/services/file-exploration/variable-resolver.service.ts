import { Injectable } from '@angular/core';
import { ConsoleService } from '../console.service';
import {
  VARIABLE_EXTRACTION_PATTERNS,
  SHELL_VARIABLES,
  shouldExcludeVariableSource,
} from '../../config/exploration-paths.config';

export interface VariableValue {
  name: string;
  value: string;
  discoveredIn: string;
  confidence: 'explicit' | 'inferred' | 'conditional';
}

export interface DeferredPath {
  template: string;
  variables: string[];
  discoveredIn: string;
  priority: number;
}

export interface VariableResolutionResult {
  resolvedPaths: string[];
  deferredPath?: DeferredPath;
  wasGenerated?: boolean; // True if path contained variables and was resolved
}

/**
 * Service for managing shell variable tracking and template path expansion
 * Handles:
 * - Variable extraction from shell scripts (explicit definitions and conditional tests)
 * - Deferred path resolution (templates with unresolved variables)
 * - Template expansion (generating all possible paths from variables)
 */
@Injectable({
  providedIn: 'root',
})
export class VariableResolverService {
  // Session-specific state (maps session ID to variables/deferred paths)
  private sessionVariables = new Map<string, Map<string, VariableValue[]>>();
  private sessionDeferredPaths = new Map<string, DeferredPath[]>();

  constructor(private consoleService: ConsoleService) {}

  /**
   * Initialize a new session for variable tracking
   */
  public initSession(sessionId: string): void {
    this.sessionVariables.set(sessionId, new Map());
    this.sessionDeferredPaths.set(sessionId, []);
    this.consoleService.debug(
      `Variable tracking initialized for session ${sessionId}`,
      'VariableResolver'
    );
  }

  /**
   * Clear session data
   */
  public clearSession(sessionId: string): void {
    this.sessionVariables.delete(sessionId);
    this.sessionDeferredPaths.delete(sessionId);
  }

  /**
   * Get all variables for a session
   */
  public getVariables(sessionId: string): Map<string, VariableValue[]> {
    return this.sessionVariables.get(sessionId) || new Map();
  }

  /**
   * Get all deferred paths for a session
   */
  public getDeferredPaths(sessionId: string): DeferredPath[] {
    return this.sessionDeferredPaths.get(sessionId) || [];
  }

  /**
   * Restore deferred paths for a session (used when resuming)
   */
  public restoreDeferredPaths(sessionId: string, paths: DeferredPath[]): void {
    if (!this.sessionDeferredPaths.has(sessionId)) {
      this.sessionDeferredPaths.set(sessionId, []);
    }
    this.sessionDeferredPaths.set(sessionId, [...paths]);
    this.consoleService.debug(
      `Restored ${paths.length} deferred paths for session ${sessionId}`,
      'VariableResolver'
    );
  }

  /**
   * Restore variables for a session (used when resuming)
   */
  public restoreVariables(
    sessionId: string,
    variables: Map<string, VariableValue[]>
  ): void {
    this.sessionVariables.set(sessionId, new Map(variables));
    this.consoleService.debug(
      `Restored ${variables.size} variables for session ${sessionId}`,
      'VariableResolver'
    );
  }

  /**
   * Check if a value is a command substitution (dynamic value)
   * Examples:
   * - `command` (backtick syntax)
   * - $(command) (modern syntax)
   * - `command | grep pattern` (backtick with pipe)
   * - $(command --arg) (command with args)
   *
   * Returns true if the value should be skipped as it's not a static path/value
   */
  private isCommandSubstitution(value: string): boolean {
    // Check for backtick command: `...`
    if (value.startsWith('`') && value.endsWith('`')) {
      return true;
    }

    // Check for $(...) command substitution
    if (value.startsWith('$(') && value.endsWith(')')) {
      return true;
    }

    // Check for embedded backticks or $(...) anywhere in value
    if (value.includes('`') || /\$\([^)]+\)/.test(value)) {
      return true;
    }

    return false;
  }

  /**
   * Extract variable definitions from content
   * Handles:
   * 1. Explicit definitions: VAR=value or export VAR=value
   * 2. Conditional tests: [ "$VAR" == "value" ] or [[ $VAR = "value" ]]
   *
   * Returns: Array of newly resolved paths from deferred queue
   */
  public extractVariables(
    content: string,
    sourcePath: string,
    sessionId: string
  ): string[] {
    const variables = this.sessionVariables.get(sessionId);
    if (!variables) return [];

    // ✅ Skip variable extraction from excluded sources (e.g., /proc/cmdline, mapping.ini)
    if (shouldExcludeVariableSource(sourcePath)) {
      return [];
    }

    const allResolvedPaths: string[] = [];

    // 1. Extract explicit definitions: VAR=value or export VAR=value
    // Pattern groups: (whitespace)(export\s+)?(varName)=(value)
    const defPattern = VARIABLE_EXTRACTION_PATTERNS.definitions;
    defPattern.lastIndex = 0;

    let match;
    while ((match = defPattern.exec(content)) !== null) {
      const varName = match[3]; // Group 3: variable name
      const value = match[4]; // Group 4: value

      if (varName && value) {
        // ✅ Skip command substitutions: `command` or $(command)
        // These are dynamic values, not static paths
        if (this.isCommandSubstitution(value)) {
          continue; // Skip this variable
        }

        const resolvedPaths = this.addVariable(
          sessionId,
          varName,
          value,
          sourcePath,
          'explicit'
        );
        allResolvedPaths.push(...resolvedPaths);
      }
    }

    // 2. Extract from conditional tests: [ "$VAR" == "value" ] or [[ $VAR = "value" ]]
    const condPattern = VARIABLE_EXTRACTION_PATTERNS.conditionalTests;
    condPattern.lastIndex = 0;

    while ((match = condPattern.exec(content)) !== null) {
      const varName = match[1];
      const value = match[2];

      if (varName && value) {
        // Don't log here - will be logged if it actually resolves paths
        const resolvedPaths = this.addVariable(
          sessionId,
          varName,
          value,
          sourcePath,
          'conditional'
        );
        allResolvedPaths.push(...resolvedPaths);
      }
    }

    return allResolvedPaths;
  }

  /**
   * Add a variable value and trigger deferred path resolution
   * Returns: Array of newly resolved paths from deferred queue
   */
  public addVariable(
    sessionId: string,
    name: string,
    value: string,
    discoveredIn: string,
    confidence: 'explicit' | 'inferred' | 'conditional'
  ): string[] {
    // Skip variables from excluded sources
    if (discoveredIn.toLowerCase().endsWith('mapping.ini')) {
      return [];
    }

    // ❌ Skip binary paths as variable values (they're commands, not data)
    // Example: Don't use /bin/ls as a value for loop variable INI_3RD
    if (value.match(/^\/(bin|sbin|usr\/bin|usr\/sbin)\/[a-z]/)) {
      return [];
    }

    const variables = this.sessionVariables.get(sessionId);
    if (!variables) return [];

    const varValue: VariableValue = { name, value, discoveredIn, confidence };

    // Add to session variables
    if (!variables.has(name)) {
      variables.set(name, []);
    }

    const existingValues = variables.get(name);
    if (!existingValues) return [];

    // Check if value already exists
    const alreadyExists = existingValues.some((v) => v.value === value);
    if (!alreadyExists) {
      existingValues.push(varValue);

      // Only log if this variable actually resolves deferred paths
      const resolvedPaths = this.resolveDeferredPaths(sessionId, name);

      if (resolvedPaths.length > 0) {
        this.consoleService.debug(
          `Variable discovered: ${name}=${value} (${confidence}) in ${discoveredIn}`,
          'VariableResolver'
        );
      }

      // Return resolved paths
      return resolvedPaths;
    }

    return [];
  }

  /**
   * Process a path that might contain variables
   * Returns resolved paths if variables are known, or defers the path for later resolution
   */
  public processPath(
    sessionId: string,
    path: string,
    discoveredIn: string,
    pathValidator: (path: string) => boolean
  ): VariableResolutionResult {
    // Check if path contains variables
    const hadVariables = this.containsVariables(path);
    if (!hadVariables) {
      return { resolvedPaths: [path], wasGenerated: false };
    }

    // Try to resolve immediately with known variables
    const resolved = this.resolveVariables(sessionId, path);
    if (!this.containsVariables(resolved)) {
      // Successfully resolved
      if (pathValidator(resolved)) {
        return { resolvedPaths: [resolved], wasGenerated: true };
      }
      return { resolvedPaths: [], wasGenerated: false };
    }

    // Still contains unresolved variables - defer it
    this.consoleService.debug(
      `⏸️ Deferred path (unresolved variables): ${path}`,
      'VariableResolver'
    );
    const deferredPath = this.addDeferredPath(sessionId, path, discoveredIn);
    return { resolvedPaths: [], deferredPath, wasGenerated: false };
  }

  /**
   * Add a template path to deferred queue
   */
  private addDeferredPath(
    sessionId: string,
    template: string,
    discoveredIn: string
  ): DeferredPath {
    const deferredPaths = this.sessionDeferredPaths.get(sessionId);
    if (!deferredPaths) {
      throw new Error(`Session ${sessionId} not initialized`);
    }

    // Extract variable names from template
    const variables = this.extractVariableNames(template);

    if (variables.length === 0) {
      throw new Error(`No variables found in template: ${template}`);
    }

    // Check if already in deferred queue
    const existing = deferredPaths.find((dp) => dp.template === template);
    if (existing) {
      return existing;
    }

    const deferredPath: DeferredPath = {
      template,
      variables,
      discoveredIn,
      priority: deferredPaths.length,
    };

    deferredPaths.push(deferredPath);

    // Don't log every deferred path - only log when actually resolved
    // this.consoleService.info(
    //   `⏳ Deferred template: ${template} (waiting for: ${variables.join(
    //     ', '
    //   )})`,
    //   'VariableResolver'
    // );

    return deferredPath;
  }

  /**
   * Resolve deferred paths when a variable becomes known
   * Returns array of resolved paths
   */
  public resolveDeferredPaths(sessionId: string, varName: string): string[] {
    const deferredPaths = this.sessionDeferredPaths.get(sessionId);
    if (!deferredPaths) return [];

    const toResolve = deferredPaths.filter((dp) =>
      dp.variables.includes(varName)
    );

    if (toResolve.length === 0) return [];

    this.consoleService.info(
      `🔧 Variable ${varName} discovered, resolving ${toResolve.length} deferred templates...`,
      'VariableResolver'
    );

    const allResolvedPaths: string[] = [];

    for (const deferred of toResolve) {
      // Get all possible values for each variable in the template
      const possiblePaths = this.expandTemplate(sessionId, deferred.template);

      if (possiblePaths.length > 0) {
        this.consoleService.info(
          `✅ Resolved "${deferred.template}" → ${
            possiblePaths.length
          } paths: ${possiblePaths.slice(0, 3).join(', ')}${
            possiblePaths.length > 3 ? '...' : ''
          }`,
          'VariableResolver'
        );

        allResolvedPaths.push(...possiblePaths);

        // Remove from deferred queue
        const index = deferredPaths.indexOf(deferred);
        if (index !== -1) {
          deferredPaths.splice(index, 1);
        }
      }
    }

    return allResolvedPaths;
  }

  /**
   * Expand a template path with all known variable values
   */
  public expandTemplate(
    sessionId: string,
    template: string,
    depth = 0
  ): string[] {
    const MAX_DEPTH = 10; // ✅ Prevent infinite recursion

    // Check recursion depth
    if (depth >= MAX_DEPTH) {
      console.warn(
        `[VariableResolver] Max recursion depth reached for template: ${template}`
      );
      return []; // Stop recursion
    }

    const variables = this.sessionVariables.get(sessionId);
    if (!variables) return [];

    const varNames = this.extractVariableNames(template);
    if (varNames.length === 0) return [template];

    // Check if all variables are known
    const allKnown = varNames.every((v) => variables.has(v));
    if (!allKnown) return []; // Wait for more variables

    // Generate all combinations
    const paths: string[] = [];
    const varName = varNames[0]; // Start with first variable
    const values = variables.get(varName) || [];

    for (const varValue of values) {
      // Replace variable in template
      const partial = this.replaceVariable(template, varName, varValue.value);

      // ✅ Check if we're making progress (avoid cycles)
      if (partial === template) {
        console.warn(
          `[VariableResolver] Variable replacement made no progress: ${varName} in ${template}`
        );
        continue; // Skip this value
      }

      // Recursively expand remaining variables (with depth tracking)
      const expanded = this.expandTemplate(sessionId, partial, depth + 1);
      paths.push(...expanded);
    }

    return paths;
  }

  /**
   * Check if path contains unresolved variables
   */
  public containsVariables(path: string): boolean {
    // Match both uppercase AND lowercase variables: $VAR, ${VAR}, $var, ${var}, $i, $1, etc.
    return /\$\{?[a-zA-Z_][a-zA-Z0-9_]*\}?|\$[0-9]+/.test(path);
  }

  /**
   * Extract variable names from a path
   */
  public extractVariableNames(path: string): string[] {
    const vars: string[] = [];
    // Match both uppercase AND lowercase variables, plus positional parameters like $1, $2
    const regex = /\$\{?([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+)\}?/g;
    let match;

    while ((match = regex.exec(path)) !== null) {
      if (!vars.includes(match[1])) {
        vars.push(match[1]);
      }
    }

    return vars;
  }

  /**
   * Replace a specific variable in a path
   */
  private replaceVariable(
    path: string,
    varName: string,
    value: string
  ): string {
    // Replace both ${VAR} and $VAR forms
    return path
      .replace(new RegExp(`\\$\\{${varName}\\}`, 'g'), value)
      .replace(new RegExp(`\\$${varName}\\b`, 'g'), value);
  }

  /**
   * Resolve shell variables in path (static known variables)
   */
  public resolveVariables(sessionId: string, path: string): string {
    let resolved = path;
    const variables = this.sessionVariables.get(sessionId);

    // First try session-specific variables
    if (variables) {
      for (const [varName, values] of variables.entries()) {
        if (values.length > 0) {
          // Use first value (highest confidence)
          const value = values[0].value;
          resolved = this.replaceVariable(resolved, varName, value);
        }
      }
    }

    // Then try static shell variables
    for (const [varName, value] of Object.entries(SHELL_VARIABLES)) {
      // Type assertion: SHELL_VARIABLES values are always strings
      const stringValue = value as string;
      resolved = resolved.replace(`\${${varName}}`, stringValue);
      resolved = resolved.replace(`$${varName}`, stringValue);
    }

    return resolved;
  }

  /**
   * Get statistics about variables and deferred paths
   */
  public getStats(sessionId: string): {
    totalVariables: number;
    totalDeferredPaths: number;
    variablesByConfidence: Record<string, number>;
  } {
    const variables = this.sessionVariables.get(sessionId);
    const deferredPaths = this.sessionDeferredPaths.get(sessionId);

    const stats = {
      totalVariables: 0,
      totalDeferredPaths: deferredPaths?.length || 0,
      variablesByConfidence: {
        explicit: 0,
        inferred: 0,
        conditional: 0,
      },
    };

    if (!variables) return stats;

    for (const values of variables.values()) {
      stats.totalVariables += values.length;
      for (const value of values) {
        stats.variablesByConfidence[value.confidence]++;
      }
    }

    return stats;
  }
}
