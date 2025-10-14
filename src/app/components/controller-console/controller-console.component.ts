import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TvCommunicationService,
  FunctionData,
  TVConnectionInfo,
} from '../../services/tv-communication.service';
import {
  FunctionFileGeneratorService,
  type GeneratedFiles,
} from '../../services/function-file-generator.service';
import { Subscription, firstValueFrom } from 'rxjs';
import { CodeModalComponent } from '../code-modal/code-modal.component';

@Component({
  selector: 'app-controller-console',
  standalone: true,
  imports: [CommonModule, FormsModule, CodeModalComponent],
  template: `
    <div
      class="max-w-6xl mx-auto p-5 bg-customGray text-gray-200 min-h-screen font-sans"
    >
      <header class="text-center mb-4">
        <h1 class="text-orange-500 text-3xl font-bold mb-1">
          💻 Remote Function Controller
        </h1>
        <!-- Only show connection status when functions are available (not during initial setup) -->
        <div class="flex justify-center" *ngIf="availableFunctions.length > 0">
          <div
            class="flex items-center gap-3 bg-customGray-light px-4 py-2 rounded-lg border border-purple-900"
            [class.bg-green-900]="tvConnection.connected"
            [class.bg-red-900]="!tvConnection.connected"
          >
            <div
              class="w-3 h-3 rounded-full"
              [class.bg-green-400]="tvConnection.connected"
              [class.bg-red-400]="!tvConnection.connected"
            ></div>
            <div class="text-sm">
              <span class="font-medium">
                {{ getDeviceBrand() }} TV ({{ getDeviceModel() }})
                {{ tvConnection.connected ? 'Connected' : 'Disconnected' }} • FW
                {{ getDeviceFirmware() }} • Last seen
                {{ formatTime(tvConnection.lastSeen) }}
              </span>
            </div>
          </div>
        </div>
      </header>

      <!-- Waiting for TV Instructions -->
      <div
        class="max-w-4xl mx-auto"
        *ngIf="availableFunctions.length === 0 && !tvConnection.connected"
      >
        <div
          class="bg-customGray-light rounded-lg p-8 shadow-lg border border-purple-900"
        >
          <h2 class="text-2xl font-bold text-orange-500 mb-4">
            📺 TV Setup Required
          </h2>
          <p class="text-gray-300 mb-8">
            To use the Remote Console, please follow these steps on your TV:
          </p>

          <div class="space-y-6">
            <div class="flex items-start gap-4">
              <span
                class="bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                >1</span
              >
              <div>
                <h4 class="text-lg font-semibold text-white mb-2">
                  Open TV Browser
                </h4>
                <p class="text-gray-300">
                  Navigate to the browser app on your Hisense/VIDAA TV
                </p>
              </div>
            </div>

            <div class="flex items-start gap-4">
              <span
                class="bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                >2</span
              >
              <div>
                <h4 class="text-lg font-semibold text-white mb-2">
                  Visit Development Console
                </h4>
                <p class="text-gray-300 mb-2">
                  Go to:
                  <code
                    class="bg-customGray text-orange-400 px-3 py-1 rounded border border-purple-900"
                    >https://vidaahub.com/console</code
                  >
                </p>
                <p class="text-gray-400 text-sm mt-1">
                  DNS must redirect vidaahub.com to your local dev server
                </p>
              </div>
            </div>

            <div class="flex items-start gap-4">
              <span
                class="bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                >3</span
              >
              <div>
                <h4 class="text-lg font-semibold text-white mb-2">
                  Auto-Scan Functions
                </h4>
                <p class="text-gray-300">
                  The TV will automatically scan and upload available functions
                </p>
              </div>
            </div>
          </div>

          <div
            class="mt-8 p-5 bg-customGray rounded-lg border-l-4 border-orange-500"
          >
            <div class="flex items-center justify-center gap-3 mb-3">
              <div
                class="w-3 h-3 bg-orange-500 rounded-full animate-pulse"
              ></div>
              <span class="text-orange-400 font-bold"
                >Waiting for TV connection...</span
              >
            </div>
            <p class="text-gray-400 text-sm text-center italic">
              This page automatically updates when TV functions are detected.
            </p>
          </div>
        </div>
      </div>

      <!-- Function Library Browser (only when functions are available) -->
      <div
        class="bg-customGray-light rounded-lg p-6 mb-6 border border-purple-900"
        *ngIf="availableFunctions.length > 0"
      >
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-orange-500">
            📚 Function Library
          </h2>
          <div class="flex gap-3">
            <input
              type="text"
              [(ngModel)]="functionFilter"
              (input)="filterFunctions()"
              placeholder="🔍 Search functions..."
              class="bg-customGray text-white px-4 py-2 rounded-lg border border-purple-900 focus:border-orange-500 focus:outline-none"
              aria-label="Search functions"
            />
            <button
              (click)="saveFunctionsToDisk()"
              class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              aria-label="Save functions to disk"
              [disabled]="availableFunctions.length === 0"
            >
              💾 Save to Disk
            </button>
            <button
              (click)="openCustomCodeModal()"
              class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              aria-label="Open custom code editor"
            >
              📝 Custom Code
            </button>
          </div>
        </div>

        <!-- Horizontal Categories -->
        <div class="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button
            *ngFor="let category of categories"
            class="px-4 py-2 rounded-lg transition-colors whitespace-nowrap text-sm"
            [class.bg-orange-600]="selectedCategory === category.key"
            [class.text-white]="selectedCategory === category.key"
            [class.bg-customGray]="selectedCategory !== category.key"
            [class.text-gray-300]="selectedCategory !== category.key"
            [class.hover:bg-orange-500]="selectedCategory !== category.key"
            (click)="selectCategory(category.key)"
          >
            {{ category.icon }} {{ category.name }} ({{
              getCategoryCount(category.key)
            }})
          </button>
        </div>

        <!-- Compact Function Grid - SMALLER! -->
        <div
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1"
        >
          <div
            *ngFor="let func of filteredFunctions"
            [ngClass]="{
              'bg-customGray rounded-lg p-2 cursor-pointer transition-all hover:bg-purple-900/30 relative border border-purple-900': true,
              'ring-2 ring-orange-500 ring-offset-2 ring-offset-customGray-light bg-orange-900/30':
                selectedFunction?.name === func.name
            }"
            (click)="selectFunction(func)"
            tabindex="0"
            role="button"
            (keyup.enter)="selectFunction(func)"
            (keyup.space)="selectFunction(func)"
          >
            <div class="flex items-center justify-between">
              <span class="text-white text-xs font-medium truncate">{{
                func.name
              }}</span>
              <div class="flex items-center gap-1">
                <button
                  (click)="
                    copyFunctionToCustomCode(func); $event.stopPropagation()
                  "
                  class="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                  title="Copy to Custom Code"
                >
                  📋
                </button>
                <span
                  class="text-xs bg-purple-900 text-gray-300 px-1 py-0.5 rounded flex-shrink-0"
                  >{{ getFunctionType(func.name) }}</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Function Execution Modal -->
      <app-code-modal
        [isOpen]="showExecutionModal"
        [title]="'Execute Function: ' + (selectedFunction?.name || '')"
        [showExecuteButton]="true"
        (closeModal)="closeExecutionModal()"
        (executeCode)="executeFunction()"
      >
        <div class="space-y-4" *ngIf="selectedFunction">
          <!-- Source Code Display -->
          <div *ngIf="selectedFunction.sourceCode">
            <div class="block text-sm font-semibold text-gray-300 mb-2">
              Source Code:
            </div>
            <pre
              class="bg-customGray p-3 rounded border border-purple-900 font-mono text-xs overflow-x-auto max-h-32 text-gray-300"
              >{{ selectedFunction.sourceCode }}</pre
            >
          </div>

          <!-- Parameters -->
          <div
            *ngIf="
              selectedFunction.parameters &&
              selectedFunction.parameters.length > 0
            "
          >
            <div class="block text-sm font-semibold text-gray-300 mb-2">
              Parameters:
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                *ngFor="let param of selectedFunction.parameters; let i = index"
              >
                <label
                  [for]="'modal-param-' + i"
                  class="block mb-1 text-sm text-gray-400"
                  >{{ param }}</label
                >
                <input
                  [id]="'modal-param-' + i"
                  type="text"
                  [(ngModel)]="parameterValues[i]"
                  class="w-full p-2 bg-customGray border border-purple-900 rounded text-gray-200 text-sm focus:outline-none focus:border-orange-500"
                  [placeholder]="getParameterHint(param)"
                />
              </div>
            </div>
          </div>

          <!-- No Parameters Message -->
          <div
            *ngIf="
              !selectedFunction.parameters ||
              selectedFunction.parameters.length === 0
            "
            class="text-gray-400 text-sm italic"
          >
            This function takes no parameters.
          </div>

          <!-- Result Display -->
          <div *ngIf="executionResult !== null" class="mt-4 relative">
            <div class="flex items-center justify-between mb-2">
              <div class="text-sm font-semibold text-orange-400">
                📊 Result:
              </div>
              <div class="flex gap-2">
                <button
                  *ngIf="shouldShowExpandButton(executionResult)"
                  (click)="toggleExecutionResultExpanded()"
                  class="text-xs text-gray-400 hover:text-orange-400 transition-colors px-2 py-1 rounded hover:bg-purple-900/30"
                  title="Expand/Collapse"
                >
                  <svg
                    *ngIf="!isExecutionResultExpanded"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-4 h-4"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                    />
                  </svg>
                  <svg
                    *ngIf="isExecutionResultExpanded"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-4 h-4"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25"
                    />
                  </svg>
                </button>
                <button
                  (click)="copyResultToClipboard()"
                  class="text-xs text-gray-400 hover:text-orange-400 transition-colors px-2 py-1 rounded hover:bg-purple-900/30"
                  title="Copy to clipboard"
                >
                  📋 Copy
                </button>
              </div>
            </div>
            <pre
              class="bg-customGray p-3 rounded border border-purple-900 font-mono text-xs overflow-y-auto text-gray-300"
              [class.max-h-48]="!isExecutionResultExpanded"
              [class.max-h-none]="isExecutionResultExpanded"
              >{{ formatResult(executionResult) }}</pre
            >
          </div>

          <!-- Executing Indicator -->
          <div *ngIf="isExecuting" class="text-center text-orange-400">
            ⏳ Executing function on TV...
          </div>
        </div>
      </app-code-modal>

      <!-- Command History -->
      <div
        class="bg-customGray-light rounded-lg p-6 mt-6 border border-purple-900"
        *ngIf="commandHistory.length > 0"
      >
        <h3 class="text-xl font-bold text-orange-500 mb-4">
          📜 Command History
        </h3>
        <div class="space-y-3">
          <div
            *ngFor="
              let command of commandHistory.slice().reverse();
              let i = index
            "
            class="bg-customGray rounded border border-purple-900 p-3"
          >
            <div class="flex justify-between items-start mb-2">
              <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-2 flex-wrap">
                  <span class="font-mono font-bold text-orange-400 text-sm">{{
                    command.functionName
                  }}</span>
                  <!-- Show Parameters for regular functions - max 25% width -->
                  <span
                    *ngIf="
                      command.parameters &&
                      command.parameters.length > 0 &&
                      !command.customCode
                    "
                    class="text-gray-400 text-xs truncate max-w-[25%]"
                    [title]="'(' + command.parameters.join(', ') + ')'"
                    >({{ command.parameters.join(', ') }})</span
                  >
                  <!-- Expandable Custom Code -->
                  <button
                    *ngIf="command.customCode"
                    (click)="
                      toggleHistoryExpansion(commandHistory.length - 1 - i)
                    "
                    class="text-xs text-gray-400 hover:text-orange-400 transition-colors"
                    title="Show/Hide Code"
                  >
                    {{
                      isHistoryExpanded(commandHistory.length - 1 - i)
                        ? '▼'
                        : '▶'
                    }}
                    Show Code
                  </button>
                </div>
              </div>
              <div class="flex items-center gap-3 ml-4 flex-shrink-0">
                <span class="text-gray-400 text-xs">{{
                  formatTime(command.timestamp)
                }}</span>
                <span
                  class="text-sm font-bold"
                  [class.text-green-400]="command.success"
                  [class.text-red-400]="!command.success"
                >
                  {{ command.success ? '✅' : '❌' }}
                </span>
                <button
                  (click)="deleteHistoryItem(i)"
                  class="text-red-400 hover:text-red-300 transition-colors"
                  title="Delete"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-4 h-4"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Custom Code Display (Expandable) -->
            <div
              *ngIf="
                command.customCode &&
                isHistoryExpanded(commandHistory.length - 1 - i)
              "
              class="mb-2"
            >
              <pre
                class="bg-customGray p-3 rounded border border-purple-900 font-mono text-xs overflow-x-auto max-h-32 text-gray-300"
                >{{ command.customCode }}</pre
              >
            </div>

            <!-- Result Display (Expandable) -->
            <div
              *ngIf="command.result !== undefined && command.result !== null"
              class="relative"
            >
              <button
                *ngIf="shouldShowExpandButton(command.result)"
                (click)="
                  toggleHistoryResultExpansion(commandHistory.length - 1 - i)
                "
                class="absolute top-2 right-2 text-xs text-gray-400 hover:text-orange-400 transition-colors z-10 bg-customGray px-2 py-1 rounded"
                title="Expand/Collapse"
              >
                <svg
                  *ngIf="
                    !isHistoryResultExpanded(commandHistory.length - 1 - i)
                  "
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="w-4 h-4"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                  />
                </svg>
                <svg
                  *ngIf="isHistoryResultExpanded(commandHistory.length - 1 - i)"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="w-4 h-4"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25"
                  />
                </svg>
              </button>
              <pre
                class="bg-customGray p-2 rounded border border-purple-900 text-xs font-mono text-gray-300 overflow-y-auto"
                [class.max-h-20]="
                  !isHistoryResultExpanded(commandHistory.length - 1 - i)
                "
                [class.max-h-none]="
                  isHistoryResultExpanded(commandHistory.length - 1 - i)
                "
                >{{ formatResult(command.result) }}</pre
              >
            </div>
          </div>
        </div>

        <!-- Scroll to Top Button (fixed bottom right inside history) -->
        <button
          (click)="scrollToTop()"
          class="fixed bottom-6 right-6 bg-orange-500 hover:bg-orange-600 text-white p-3 rounded-full shadow-lg transition-all z-50"
          title="Scroll to Top"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="w-6 h-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4.5 15.75l7.5-7.5 7.5 7.5"
            />
          </svg>
        </button>
      </div>

      <!-- Custom Code Modal -->
      <app-code-modal
        [isOpen]="showCustomCodeModal"
        [title]="'Custom JavaScript Code'"
        [showExecuteButton]="true"
        (closeModal)="closeCustomCodeModal()"
        (executeCode)="executeCustomCode()"
      >
        <div class="space-y-4">
          <div class="relative">
            <div class="flex items-center justify-between mb-2">
              <div class="block text-sm font-semibold text-gray-300">
                JavaScript Code:
              </div>
              <button
                (click)="toggleCustomCodeExpanded()"
                class="text-xs text-gray-400 hover:text-orange-400 transition-colors px-2 py-1 rounded hover:bg-purple-900/30"
                title="Expand/Collapse"
              >
                <svg
                  *ngIf="!isCustomCodeExpanded"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="w-4 h-4"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                  />
                </svg>
                <svg
                  *ngIf="isCustomCodeExpanded"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="w-4 h-4"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25"
                  />
                </svg>
              </button>
            </div>
            <textarea
              [(ngModel)]="customJsCode"
              class="w-full p-3 bg-customGray border border-purple-900 rounded text-gray-200 font-mono text-sm focus:outline-none focus:border-orange-500"
              [class.h-64]="!isCustomCodeExpanded"
              [class.h-[600px]]="isCustomCodeExpanded"
              placeholder="// Enter custom JavaScript code to execute on TV...&#10;// Example:&#10;const result = Hisense_GetBrand();&#10;console.log(result);&#10;return result;"
            ></textarea>
          </div>

          <div *ngIf="customCodeResult !== null" class="mt-4">
            <div class="flex items-center justify-between mb-2">
              <div class="text-sm font-semibold text-orange-400">
                📊 Result:
              </div>
              <div class="flex gap-2">
                <button
                  *ngIf="shouldShowExpandButton(customCodeResult)"
                  (click)="toggleCustomCodeResultExpanded()"
                  class="text-xs text-gray-400 hover:text-orange-400 transition-colors px-2 py-1 rounded hover:bg-purple-900/30"
                  title="Expand/Collapse"
                >
                  <svg
                    *ngIf="!isCustomCodeResultExpanded"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-4 h-4"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                    />
                  </svg>
                  <svg
                    *ngIf="isCustomCodeResultExpanded"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-4 h-4"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25"
                    />
                  </svg>
                </button>
                <button
                  (click)="copyCustomCodeResultToClipboard()"
                  class="text-xs text-gray-400 hover:text-orange-400 transition-colors px-2 py-1 rounded hover:bg-purple-900/30"
                  title="Copy to clipboard"
                >
                  📋 Copy
                </button>
              </div>
            </div>
            <pre
              class="bg-customGray p-3 rounded border border-purple-900 font-mono text-xs overflow-y-auto text-gray-300"
              [class.max-h-48]="!isCustomCodeResultExpanded"
              [class.max-h-none]="isCustomCodeResultExpanded"
              >{{ formatResult(customCodeResult) }}</pre
            >
          </div>

          <div
            *ngIf="isExecutingCustomCode"
            class="text-center text-orange-400"
          >
            ⏳ Executing custom code on TV...
          </div>
        </div>
      </app-code-modal>
    </div>
  `,
  styles: [],
})
export class ControllerConsoleComponent implements OnInit, OnDestroy {
  // Laptop Mode Properties
  availableFunctions: FunctionData[] = [];
  selectedFunction: FunctionData | null = null;
  filteredFunctions: FunctionData[] = [];
  functionFilter = '';
  selectedCategory = 'all';
  expandedSources: Set<string> = new Set();

  // Execution Properties
  parameterValues: string[] = [];
  isExecuting = false;
  executionResult: unknown = null;
  commandHistory: Array<{
    functionName: string;
    parameters?: unknown[];
    customCode?: string; // Store custom code for display
    timestamp: Date;
    success: boolean;
    result?: unknown;
  }> = [];
  expandedHistoryItems: Set<number> = new Set();
  expandedHistoryResults: Set<number> = new Set();

  // Connection Properties
  tvConnection: TVConnectionInfo = {
    connected: false,
    lastSeen: null,
    brand: undefined,
    model: undefined,
    firmware: undefined,
  };

  // Categories for function organization
  categories = [
    { key: 'all', name: 'All Functions', icon: '📋' },
    { key: 'system', name: 'System Info', icon: '🔧' },
    { key: 'network', name: 'Network', icon: '🌐' },
    { key: 'media', name: 'Media & Audio', icon: '🎵' },
    { key: 'apps', name: 'Apps', icon: '📱' },
    { key: 'security', name: 'Security', icon: '🔒' },
    { key: 'filesystem', name: 'File System', icon: '📁' },
  ];

  // Modal Properties
  showCustomCodeModal = false;
  showExecutionModal = false;
  customJsCode = '';
  customCodeResult: unknown = null;
  isExecutingCustomCode = false;
  isExecutionResultExpanded = false;
  isCustomCodeResultExpanded = false;
  isCustomCodeExpanded = false;

  private subscriptions = new Subscription();

  constructor(
    private tvCommunicationService: TvCommunicationService,
    private functionFileGenerator: FunctionFileGeneratorService
  ) {}

  ngOnInit(): void {
    this.loadCommandHistory();
    this.initLaptopMode();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // LAPTOP MODE METHODS
  private initLaptopMode(): void {
    // Subscribe to TV functions from service
    const functionsSubscription =
      this.tvCommunicationService.functions$.subscribe({
        next: (functions: FunctionData[]) => {
          // Only update if we receive actual functions from TV
          if (functions && functions.length > 0) {
            this.availableFunctions = functions;
            this.filterFunctions();
            this.updateConnectionStatus();
          }
          // Keep dummy functions if TV has no functions yet
        },
        error: () => {
          // Handle error silently - UI will show "disconnected" state
        },
      });

    this.subscriptions.add(functionsSubscription);

    // Subscribe to connection status
    const connectionSubscription =
      this.tvCommunicationService.tvConnection$.subscribe({
        next: (connection) => {
          this.tvConnection = connection;
        },
      });

    this.subscriptions.add(connectionSubscription);

    // Load initial functions and apply filter to show dummy data
    this.refreshLibrary();
  }

  private refreshLibrary(): void {
    // Functions are automatically updated via subscription
    // This ensures dummy functions are filtered and displayed
    this.filterFunctions();
  }

  saveFunctionsToDisk(): void {
    if (this.availableFunctions.length === 0) {
      return;
    }

    // Transform functions to FunctionData format
    const functionData: FunctionData[] = this.availableFunctions.map(
      (func) => ({
        name: func.name,
        sourceCode: func.sourceCode,
        available: true,
        parameters: func.parameters || [],
      })
    );

    // Generate enhanced files using the service
    const mockDeviceInfo = {
      userAgent: 'Controller Request',
      platform: 'Manual Save',
      timestamp: new Date().toISOString(),
      // Include current device details if available
      ...(this.tvConnection.brand && {
        Hisense_GetBrand: this.tvConnection.brand,
      }),
      ...(this.tvConnection.model && {
        Hisense_GetModelName: this.tvConnection.model,
      }),
      ...(this.tvConnection.firmware && {
        Hisense_GetFirmWareVersion: this.tvConnection.firmware,
      }),
    };

    const generatedFiles: GeneratedFiles =
      this.functionFileGenerator.generateFiles(functionData, mockDeviceInfo);

    // Save generated files to /public directory
    this.downloadGeneratedFiles(generatedFiles);
  }

  private downloadGeneratedFiles(files: GeneratedFiles): void {
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:.]/g, '-');

    // Save files to /public directory via server API
    const filesToSave = [
      {
        filename: `hisense-functions-${timestamp}.d.ts`,
        content: files.typescript,
      },
      {
        filename: `hisense-source-${timestamp}.js`,
        content: files.javascript,
      },
      {
        filename: `device-info-${timestamp}.json`,
        content: files.deviceInfo,
      },
    ];

    // Send files to server to save in /public directory
    this.tvCommunicationService.saveFilesToPublic(filesToSave).subscribe({
      next: (response: { saved: string[] }) => {
        alert(
          `✅ ${
            response.saved.length
          } files saved to /public directory:\n${response.saved.join('\n')}`
        );
      },
      error: () => {
        alert(
          '❌ Failed to save files. Check dev-server is running on port 3000.'
        );
      },
    });
  }

  filterFunctions(): void {
    let filtered = this.availableFunctions;

    // Apply category filter
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(
        (func) => this.getFunctionCategory(func.name) === this.selectedCategory
      );
    }

    // Apply search filter
    if (this.functionFilter) {
      const searchTerm = this.functionFilter.toLowerCase();
      filtered = filtered.filter(
        (func) =>
          func.name.toLowerCase().includes(searchTerm) ||
          (func.sourceCode &&
            func.sourceCode.toLowerCase().includes(searchTerm)) ||
          (func.description &&
            func.description.toLowerCase().includes(searchTerm))
      );
    }

    this.filteredFunctions = filtered;
  }

  selectCategory(category: string): void {
    this.selectedCategory = category;
    this.filterFunctions();
  }

  getCategoryCount(category: string): number {
    if (category === 'all') {
      return this.availableFunctions.length;
    }
    return this.availableFunctions.filter(
      (func) => this.getFunctionCategory(func.name) === category
    ).length;
  }

  private getFunctionCategory(functionName: string): string {
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

  selectFunction(func: FunctionData): void {
    this.selectedFunction = func;
    this.parameterValues = [];
    this.executionResult = null;

    // Pre-fill parameter array based on function parameters
    if (func.parameters && func.parameters.length > 0) {
      this.parameterValues = func.parameters.map((param) =>
        this.getDefaultParameterValue(param)
      );
    } else {
      // Try to parse parameters from source if available
      const params = this.getFunctionParameters(func.sourceCode || '');
      this.parameterValues = params.map((param) =>
        this.getDefaultParameterValue(param)
      );
    }

    // Open execution modal
    this.showExecutionModal = true;
  }

  getFunctionParameters(sourceCode: string): string[] {
    if (!sourceCode) return [];

    // Try multiple patterns to extract parameters
    const patterns = [
      /function\s*\(([^)]*)\)/, // function(param1, param2)
      /\(([^)]*)\)\s*=>/, // (param1, param2) =>
      /function\s+\w+\s*\(([^)]*)\)/, // function name(param1, param2)
      /^\s*\(([^)]*)\)/, // (param1, param2) at start
      /=>\s*\(([^)]*)\)/, // => (param1, param2)
    ];

    for (const pattern of patterns) {
      const match = sourceCode.match(pattern);
      if (match && match[1] !== undefined) {
        const paramString = match[1].trim();
        if (!paramString) return [];

        return paramString
          .split(',')
          .map((p) => p.trim().split(/[=\s]/)[0]) // Remove default values and types
          .filter((p) => p && !p.includes('//') && !p.includes('/*'));
      }
    }

    // Fallback: Look for common parameter names in source
    const commonParams = [
      'path',
      'file',
      'data',
      'value',
      'id',
      'name',
      'url',
      'key',
    ];
    const foundParams = commonParams.filter((param) =>
      sourceCode.toLowerCase().includes(param.toLowerCase())
    );

    return foundParams.length > 0 ? foundParams.slice(0, 3) : []; // Max 3 guessed params
  }

  getDefaultParameterValue(paramName: string): string {
    const name = paramName.toLowerCase();
    // File/Path parameters → ../../../passwd
    if (name.includes('file') || name.includes('path')) {
      return '../../../etc/passwd';
    }
    // Boolean parameters → 0
    if (
      name.includes('mode') ||
      name.includes('enable') ||
      name.includes('flag') ||
      name.includes('bool')
    ) {
      return '0';
    }
    // Everything else → empty
    return '';
  }

  getParameterHint(paramName: string): string {
    const name = paramName.toLowerCase();
    if (name.includes('file') || name.includes('path'))
      return '../../../etc/passwd';
    if (name.includes('url') || name.includes('uri'))
      return 'e.g. http://example.com';
    if (name.includes('code') || name.includes('id')) return 'Enter code/ID';
    if (name.includes('content') || name.includes('data'))
      return 'Enter text content';
    if (
      name.includes('mode') ||
      name.includes('enable') ||
      name.includes('flag')
    )
      return 'true or false';
    if (
      name.includes('number') ||
      name.includes('count') ||
      name.includes('size')
    )
      return 'Enter number';
    if (name.includes('name')) return 'Enter name';
    if (name.includes('key')) return 'Enter key name';
    if (name.includes('value')) return 'Enter value';
    return 'Enter parameter value';
  }

  async executeFunction(): Promise<void> {
    if (!this.selectedFunction || this.isExecuting) return;

    await this.executeCommand(
      this.selectedFunction.name,
      this.parameterValues
        .map((param) => {
          if (!param.trim()) return undefined;
          if (param === 'true') return true;
          if (param === 'false') return false;
          if (!isNaN(Number(param))) return Number(param);
          return param;
        })
        .filter((p) => p !== undefined)
    );
  }

  async executeCustomCode(): Promise<void> {
    if (!this.customJsCode.trim() || this.isExecutingCustomCode) return;

    await this.executeCommand('__CUSTOM_CODE__', [], this.customJsCode);
  }

  private async executeCommand(
    functionName: string,
    parameters: unknown[],
    customCode?: string
  ): Promise<void> {
    const isCustomCode = !!customCode;

    // Set executing flag
    if (isCustomCode) {
      this.isExecutingCustomCode = true;
      this.customCodeResult = null;
    } else {
      this.isExecuting = true;
      this.executionResult = null;
    }

    try {
      // Execute either custom code or function
      const result = await firstValueFrom(
        isCustomCode
          ? this.tvCommunicationService.executeCustomCode(customCode)
          : this.tvCommunicationService.executeFunction(
              functionName,
              parameters
            )
      );

      // Set result
      if (isCustomCode) {
        this.customCodeResult = result;
      } else {
        this.executionResult = result;
      }

      // Add to command history (both custom code and functions)
      this.commandHistory.push({
        functionName: isCustomCode ? '📝 Custom Code' : functionName,
        parameters: isCustomCode ? [] : parameters,
        customCode: isCustomCode ? customCode : undefined, // Store custom code
        timestamp: new Date(),
        success: true,
        result: result,
      });
      this.saveCommandHistory();
    } catch (error) {
      const errorResult = this.handleExecutionError(error);

      // Set error result
      if (isCustomCode) {
        this.customCodeResult = errorResult;
      } else {
        this.executionResult = errorResult;
      }

      // Add failed command to history
      this.commandHistory.push({
        functionName: isCustomCode ? '📝 Custom Code' : functionName,
        parameters: isCustomCode ? [] : parameters,
        customCode: isCustomCode ? customCode : undefined, // Store custom code
        timestamp: new Date(),
        success: false,
        result: errorResult,
      });
      this.saveCommandHistory();
    } finally {
      // Clear executing flag
      if (isCustomCode) {
        this.isExecutingCustomCode = false;
      } else {
        this.isExecuting = false;
      }
    }
  }

  private handleExecutionError(error: unknown): {
    error: string;
    tvDisconnected?: boolean;
    lastSeen?: string;
    timeSinceLastSeen?: string;
  } {
    if (error instanceof Error) {
      return { error: error.message };
    }

    if (error && typeof error === 'object' && 'status' in error) {
      const httpError = error as {
        status?: number;
        statusText?: string;
        message?: string;
        error?: {
          error?: string;
          message?: string;
          lastSeen?: string;
          timeSinceLastSeen?: string;
        };
      };

      // Handle TV not connected error
      if (
        httpError.status === 503 &&
        httpError.error?.error === 'TV_NOT_CONNECTED'
      ) {
        return {
          error: `📺 TV Not Connected: ${
            httpError.error.message || 'TV is not available'
          }`,
          tvDisconnected: true,
          lastSeen: httpError.error.lastSeen,
          timeSinceLastSeen: httpError.error.timeSinceLastSeen,
        };
      }

      // Other HTTP error
      return {
        error: `HTTP ${httpError.status}: ${
          httpError.statusText || httpError.message || 'Request failed'
        }`,
      };
    }

    if (error && typeof error === 'object' && 'message' in error) {
      return { error: String(error.message) };
    }

    // Try to stringify the object
    try {
      return { error: JSON.stringify(error, null, 2) };
    } catch {
      return { error: String(error) };
    }
  }

  clearParameters(): void {
    this.parameterValues = this.parameterValues.map(() => '');
    this.executionResult = null;
  }

  copyResultToClipboard(): void {
    if (this.executionResult === null || this.executionResult === undefined) {
      return;
    }

    const resultText = this.formatResult(this.executionResult);

    navigator.clipboard.writeText(resultText).then(
      () => {
        // Success
      },
      (err) => {
        console.error('❌ Failed to copy to clipboard:', err);
        // Fallback: Try the old method
        this.fallbackCopyToClipboard(resultText);
      }
    );
  }

  private fallbackCopyToClipboard(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('❌ Fallback copy failed:', err);
    }
    document.body.removeChild(textArea);
  }

  copyCustomCodeResultToClipboard(): void {
    if (this.customCodeResult === null || this.customCodeResult === undefined) {
      return;
    }

    const resultText = this.formatResult(this.customCodeResult);

    navigator.clipboard.writeText(resultText).then(
      () => {
        // Success
      },
      (err) => {
        console.error('❌ Failed to copy to clipboard:', err);
        // Fallback: Try the old method
        this.fallbackCopyToClipboard(resultText);
      }
    );
  }

  formatResult(result: unknown): string {
    if (result === null || result === undefined) {
      return 'null';
    }

    if (typeof result === 'object') {
      try {
        return JSON.stringify(result, null, 2);
      } catch {
        return String(result);
      }
    }

    return String(result);
  }

  formatTime(date: Date | null): string {
    if (!date) return 'Never';
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return date.toLocaleTimeString();
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
  }

  getDeviceBrand(): string {
    return this.tvConnection.brand || 'Unknown';
  }

  getDeviceModel(): string {
    return this.tvConnection.model || 'Unknown';
  }

  getDeviceFirmware(): string {
    return this.tvConnection.firmware || 'Unknown';
  }

  private updateConnectionStatus(): void {
    const hasRecentFunctions = this.availableFunctions.length > 0;
    this.tvConnection.connected = hasRecentFunctions;

    if (hasRecentFunctions) {
      this.tvConnection.lastSeen = new Date();
    }
  }

  toggleSourceExpansion(functionName: string, event: Event): void {
    event.stopPropagation(); // Prevent function selection when clicking the expander
    if (this.expandedSources.has(functionName)) {
      this.expandedSources.delete(functionName);
    } else {
      this.expandedSources.add(functionName);
    }
  }

  isSourceExpanded(functionName: string): boolean {
    return this.expandedSources.has(functionName);
  }

  toggleHistoryExpansion(index: number): void {
    if (this.expandedHistoryItems.has(index)) {
      this.expandedHistoryItems.delete(index);
    } else {
      this.expandedHistoryItems.add(index);
    }
  }

  isHistoryExpanded(index: number): boolean {
    return this.expandedHistoryItems.has(index);
  }

  toggleHistoryResultExpansion(index: number): void {
    if (this.expandedHistoryResults.has(index)) {
      this.expandedHistoryResults.delete(index);
    } else {
      this.expandedHistoryResults.add(index);
    }
  }

  isHistoryResultExpanded(index: number): boolean {
    return this.expandedHistoryResults.has(index);
  }

  shouldShowExpandButton(result: unknown): boolean {
    const formatted = this.formatResult(result);
    const lines = formatted.split('\n');
    return lines.length > 5;
  }

  toggleExecutionResultExpanded(): void {
    this.isExecutionResultExpanded = !this.isExecutionResultExpanded;
  }

  toggleCustomCodeResultExpanded(): void {
    this.isCustomCodeResultExpanded = !this.isCustomCodeResultExpanded;
  }

  toggleCustomCodeExpanded(): void {
    this.isCustomCodeExpanded = !this.isCustomCodeExpanded;
  }

  // CUSTOM CODE METHODS
  openCustomCodeModal(): void {
    this.showCustomCodeModal = true;
  }

  closeCustomCodeModal(): void {
    this.showCustomCodeModal = false;
    this.customCodeResult = null;
  }

  closeExecutionModal(): void {
    this.showExecutionModal = false;
    this.executionResult = null;
  }

  copyFunctionToCustomCode(func: FunctionData): void {
    const functionName = func.name;
    const hasParams = func.parameters && func.parameters.length > 0;

    if (func.sourceCode) {
      const params =
        hasParams && func.parameters
          ? func.parameters
              .map((param) => {
                const hint = this.getDefaultParameterValue(param);
                return hint ? `"${hint}"` : `/* ${param} */`;
              })
              .join(', ')
          : '';

      const callTemplate = hasParams
        ? `// Adjust parameters as needed, then execute\nconst result = ${functionName}(${params});\nconsole.log(result);\nreturn result;`
        : `// Execute function\nconst result = ${functionName}();\nconsole.log(result);\nreturn result;`;

      this.customJsCode = `const ${functionName} = ${func.sourceCode}\n\n${callTemplate}`;
    } else {
      if (hasParams && func.parameters) {
        const params = func.parameters
          .map((param) => {
            const hint = this.getDefaultParameterValue(param);
            return hint ? `"${hint}"` : `/* ${param} */`;
          })
          .join(', ');

        this.customJsCode = `// Execute ${functionName}\nconst result = ${functionName}(${params});\nconsole.log(result);\nreturn result;`;
      } else {
        this.customJsCode = `// Execute ${functionName}\nconst result = ${functionName}();\nconsole.log(result);\nreturn result;`;
      }
    }

    this.showCustomCodeModal = true;
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private loadCommandHistory(): void {
    try {
      const stored = localStorage.getItem('vidaa-command-history');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.commandHistory = parsed.map(
          (cmd: {
            functionName: string;
            parameters?: unknown[];
            customCode?: string;
            timestamp: string;
            success: boolean;
            result?: unknown;
          }) => ({
            ...cmd,
            timestamp: new Date(cmd.timestamp),
          })
        );
      }
    } catch (error) {
      console.error('Failed to load command history:', error);
      this.commandHistory = [];
    }
  }

  private saveCommandHistory(): void {
    try {
      localStorage.setItem(
        'vidaa-command-history',
        JSON.stringify(this.commandHistory)
      );
    } catch (error) {
      console.error('Failed to save command history:', error);
    }
  }

  deleteHistoryItem(index: number): void {
    const reversedIndex = this.commandHistory.length - 1 - index;
    this.commandHistory.splice(reversedIndex, 1);
    this.saveCommandHistory();
  }
}
