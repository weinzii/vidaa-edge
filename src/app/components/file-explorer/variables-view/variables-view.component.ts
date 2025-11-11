import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VariableValue } from '../../../models/file-exploration';

interface VariableEntry {
  name: string;
  values: VariableValue[];
  expanded: boolean;
}

interface DeferredPathEntry {
  template: string;
  missingVars: string[];
  discoveryTime: Date;
}

@Component({
  selector: 'app-variables-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './variables-view.component.html',
  styleUrls: ['./variables-view.component.css'],
})
export class VariablesViewComponent implements OnChanges {
  @Input() variables: Map<string, VariableValue[]> = new Map();
  @Input() deferredPaths: Map<string, DeferredPathEntry> = new Map();

  // Filter state
  variableSearchTerm = '';
  deferredSearchTerm = '';

  // Processed data
  variableEntries: VariableEntry[] = [];
  deferredEntries: DeferredPathEntry[] = [];

  // Filtered data
  filteredVariables: VariableEntry[] = [];
  filteredDeferred: DeferredPathEntry[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['variables'] || changes['deferredPaths']) {
      this.processData();
      this.applyFilters();
    }
  }

  private processData(): void {
    // Process variables
    this.variableEntries = Array.from(this.variables.entries())
      .map(([name, values]) => ({
        name,
        values,
        expanded: false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Process deferred paths
    this.deferredEntries = Array.from(this.deferredPaths.values()).sort(
      (a, b) => b.discoveryTime.getTime() - a.discoveryTime.getTime()
    );
  }

  applyFilters(): void {
    // Filter variables
    if (this.variableSearchTerm.trim()) {
      const term = this.variableSearchTerm.toLowerCase();
      this.filteredVariables = this.variableEntries.filter(
        (v) =>
          v.name.toLowerCase().includes(term) ||
          v.values.some((val) => val.value.toLowerCase().includes(term))
      );
    } else {
      this.filteredVariables = [...this.variableEntries];
    }

    // Filter deferred paths
    if (this.deferredSearchTerm.trim()) {
      const term = this.deferredSearchTerm.toLowerCase();
      this.filteredDeferred = this.deferredEntries.filter(
        (d) =>
          d.template.toLowerCase().includes(term) ||
          d.missingVars.some((v) => v.toLowerCase().includes(term))
      );
    } else {
      this.filteredDeferred = [...this.deferredEntries];
    }
  }

  toggleVariable(variable: VariableEntry): void {
    variable.expanded = !variable.expanded;
  }

  getConfidenceColor(confidence: string): string {
    if (confidence === 'explicit') return 'text-green-400';
    if (confidence === 'inferred') return 'text-yellow-400';
    return 'text-orange-400'; // conditional
  }

  getConfidenceIcon(confidence: string): string {
    if (confidence === 'explicit') return '✓';
    if (confidence === 'inferred') return '◐';
    return '◯'; // conditional
  }

  getConfidenceLabel(confidence: string): string {
    if (confidence === 'explicit') return 'Explicit (High)';
    if (confidence === 'inferred') return 'Inferred (Medium)';
    return 'Conditional (Low)';
  }
}
