# 🔧 VIDAA-EDGE Refactoring TODO

**Stand:** 14. Oktober 2025  
**Ziel:** Code-Qualität verbessern, Dead Code entfernen, Wartbarkeit erhöhen

---

## 📋 PHASE 1: CLEANUP & DEAD CODE (Quick Wins)

### 1.1 Dead Code entfernen

- [x] `src/app/services/tv-function-scanner.service.ts` löschen (komplett leer)
- [x] Ungenutzte Models prüfen und aufräumen:
  - [x] `src/app/models/app.ts` - Interface `App` wird VERWENDET → behalten
  - [x] `src/app/models/hisense-function.ts` - Interfaces geprüft → werden teilweise verwendet

### 1.2 VidaaService entfernen

- [x] Alle Verwendungen von `VidaaService` finden (grep/search)
- [x] Funktionalität zu passenden Services migrieren:
  - [x] `getAvailableHisenseFunctions()` → bereits in `tv-scanner.component.ts` vorhanden, Duplikat entfernt
  - [x] `executeHisenseFunction()` → bereits in `tv-communication.service.ts` als `executeFunction()`
  - [x] `installApp()` / `uninstallApp()` → neuer `AppManagementService` erstellt
  - [x] Device-Info-Funktionen → neuer `DeviceInfoService` erstellt
- [x] Imports in `start.component.ts` und anderen Components entfernt
- [x] `src/app/services/vidaa.service.ts` gelöscht

---

## 📋 PHASE 2: TEMPLATE EXTRACTION (Lesbarkeit) ✅

### 2.1 TV-Scanner Component

- [x] Template aus `tv-scanner.component.ts` extrahieren
  - [x] Neue Datei erstellt: `src/app/components/tv-scanner/tv-scanner.component.html`
  - [x] HTML-Template in `.html` verschoben
  - [x] Component angepasst: `templateUrl: './tv-scanner.component.html'`
  - [x] CSS extrahiert: `tv-scanner.component.css`
  - [x] Getestet: Component lädt korrekt

### 2.2 Controller-Console Component

- [x] Template aus `controller-console.component.ts` extrahieren
  - [x] Neue Datei erstellt: `src/app/components/controller-console/controller-console.component.html`
  - [x] HTML-Template (413 Zeilen) in `.html` verschoben
  - [x] Component angepasst: `templateUrl: './controller-console.component.html'`
  - [x] Getestet: Component lädt korrekt

### 2.3 Remote-Console Component

- [x] Template aus `remote-console.component.ts` extrahieren
  - [x] Neue Datei erstellt: `src/app/components/remote-console/remote-console.component.html`
  - [x] HTML-Template in `.html` verschoben
  - [x] Component angepasst: `templateUrl: './remote-console.component.html'`
  - [x] Getestet: Component lädt korrekt

### 2.4 Code-Modal Component

- [x] Template aus `code-modal.component.ts` extrahieren
  - [x] Neue Datei erstellt: `src/app/components/code-modal/code-modal.component.html`
  - [x] HTML-Template in `.html` verschoben
  - [x] Component angepasst: `templateUrl: './code-modal.component.html'`
  - [x] Getestet: Modal funktioniert

---

## 📋 PHASE 3: LOGGING & ERROR HANDLING ✅

### 3.1 Zentralisierten Logging-Service erstellen

- [x] ConsoleService erweitert (bereits vorhanden, neue Methoden hinzugefügt)
- [x] Interface erweitert:
  ```typescript
  export class ConsoleService {
    info(message: string, context?: string): void;
    warn(message: string, context?: string): void;
    error(message: string, error?: unknown, context?: string): void;
    debug(message: string, context?: string): void;
  }
  ```
- [x] Environment-basiertes Debug-Logging implementiert
- [x] Service bereits in `app.config.ts` providiert

### 3.2 Console-Statements ersetzen

- [x] `tv-scanner.component.ts` - 4 Console-Statements ersetzt mit ConsoleService
- [x] `tv-communication.service.ts` - 1 Console-Statement ersetzt mit ConsoleService.debug
- [x] `controller-console.component.ts` - 5 Console.error-Statements ersetzt
- [x] `copy-to-clipboard.component.ts` - 1 Console-Statement ersetzt
- [x] `device-info.service.ts` - 6 Console-Statements ersetzt
- [ ] `dev-server.js` - Console-Statements durch strukturiertes Logging ersetzen (Backend, später)

### 3.3 Error-Handling vereinheitlichen

- [x] `device-info.service.ts` - Try-Catch für ALLE Methoden implementiert
- [x] `tv-scanner.component.ts` - Leere catch-Blöcke mit ConsoleService.error gefüllt
- [x] `tv-communication.service.ts` - Error-Handling mit ConsoleService implementiert

---

## 📋 PHASE 4: TYPE SAFETY IMPROVEMENTS ✅

### 4.1 FunctionResult Type Alias

- [x] `FunctionResult` Type Alias erstellt in `tv-communication.service.ts`
- [x] Type Definition: `string | number | boolean | null | undefined | object | FunctionResult[]`
- [x] Interfaces aktualisiert:
  - [x] `CommandResponse` verwendet `FunctionResult` für `data`
  - [x] `RemoteCommand` verwendet `FunctionResult` für `data`
  - [x] `CommandQueueItem` verwendet `FunctionResult` für `result`

### 4.2 Component Type Safety

- [x] `controller-console.component.ts`:
  - [x] `executionResult: FunctionResult = null`
  - [x] `customCodeResult: FunctionResult = null`
  - [x] Command History mit typed results
  - [x] Type assertions für HTTP responses
- [x] `tv-scanner.component.ts`:
  - [x] Result handling mit `FunctionResult`
  - [x] Type casting für remote command results

---

## 📋 PHASE 5: COMPONENT REFACTORING (Große Components aufteilen) - IN PROGRESS ⏳

### 5.1 Controller-Console Component aufteilen (1517 → 4x ~200 Zeilen)

**Status:** Part 1 abgeschlossen (Commit: c4ef0a4, +839 Zeilen) - Part 2 ausstehend

#### Sub-Component 1: Function Library ✅

- [x] Neue Component: `src/app/components/controller-console/function-library/function-library.component.ts`
- [x] Extrahieren:
  - [ ] `availableFunctions`, `filteredFunctions`, `functionFilter`
  - [ ] `filterFunctions()`, `selectCategory()`, `getCategoryCount()`
  - [ ] `getFunctionCategory()`, `getFunctionType()`
  - [ ] Categories-Array
- [ ] Template-Teil extrahieren (Function Library Browser Section)
- [ ] Input: `@Input() functions: FunctionData[]`
- [ ] Output: `@Output() functionSelected = new EventEmitter<FunctionData>()`

#### Sub-Component 2: Function Execution Modal

- [ ] Neue Component: `src/app/components/controller-console/function-execution-modal/function-execution-modal.component.ts`
- [ ] Extrahieren:
  - [ ] `selectedFunction`, `parameterValues`, `executionResult`
  - [ ] `isExecuting`, `isExecutionResultExpanded`
  - [ ] `executeFunction()`, `getParameterHint()`, `clearParameters()`
- [ ] Template-Teil extrahieren (Function Execution Modal Section)
- [ ] Input: `@Input() function: FunctionData | null`
- [ ] Output: `@Output() executionComplete = new EventEmitter<unknown>()`

#### Sub-Component 3: Command History

- [ ] Neue Component: `src/app/components/controller-console/command-history/command-history.component.ts`
- [ ] Extrahieren:
  - [ ] `commandHistory`, `expandedHistoryItems`, `expandedHistoryResults`
  - [ ] `loadCommandHistory()`, `saveCommandHistory()`, `deleteHistoryItem()`
  - [ ] `toggleHistoryExpansion()`, `toggleHistoryResultExpansion()`
- [ ] Template-Teil extrahieren (Command History Section)
- [ ] Input: `@Input() commands: CommandHistoryEntry[]`
- [ ] Output: `@Output() commandDeleted = new EventEmitter<number>()`

#### Sub-Component 4: Custom Code Modal

- [ ] Neue Component: `src/app/components/controller-console/custom-code-modal/custom-code-modal.component.ts`
- [ ] Extrahieren:
  - [ ] `customJsCode`, `customCodeResult`, `isExecutingCustomCode`
  - [ ] `isCustomCodeExpanded`, `isCustomCodeResultExpanded`
  - [ ] `executeCustomCode()`, `copyFunctionToCustomCode()`
- [ ] Template-Teil extrahieren (Custom Code Modal Section)
- [ ] Input: `@Input() isOpen: boolean`
- [ ] Output: `@Output() codeExecuted = new EventEmitter<unknown>()`

#### Parent Component zusammenführen

- [ ] `controller-console.component.ts` reduzieren auf Koordination
- [ ] Sub-Components einbinden
- [ ] Event-Handler verbinden
- [ ] Testen: Alle Funktionen arbeiten zusammen

---

## 📋 PHASE 6: SERVICE LAYER OPTIMIERUNG

### 5.1 TV-Communication Service aufteilen (464 → 3x ~150 Zeilen)

#### Service 1: TV Connection Service

- [ ] Neue Datei: `src/app/services/tv-connection.service.ts`
- [ ] Extrahieren aus `tv-communication.service.ts`:
  - [ ] `tvConnectionSubject`, `tvConnection$`
  - [ ] `updateTvConnection()`, `checkTvConnection()` (aus dev-server.js)
  - [ ] `startConnectionMonitoring()`, `sendKeepAlive()`

#### Service 2: TV Function Service

- [ ] Neue Datei: `src/app/services/tv-function.service.ts`
- [ ] Extrahieren aus `tv-communication.service.ts`:
  - [ ] `functionsSubject`, `functions$`
  - [ ] `receiveFunctions()`, `loadFunctions()`
  - [ ] `saveFunctions()`, `getFunctionsList()`

#### Service 3: TV Command Service

- [ ] Neue Datei: `src/app/services/tv-command.service.ts`
- [ ] Extrahieren aus `tv-communication.service.ts`:
  - [ ] `commandQueueSubject`, `commandQueue$`
  - [ ] `executeFunction()`, `executeCustomCode()`
  - [ ] `pollForResult()`, `checkForCommands()`, `receiveCommandResult()`
  - [ ] **Custom Code Execution BEHALTEN** - nur Code verbessern:
    - [ ] Input-Validation hinzufügen
    - [ ] Timeout-Handling verbessern
    - [ ] Error-Messages präziser gestalten

#### Service 4: TV File Service

- [ ] Neue Datei: `src/app/services/tv-file.service.ts`
- [ ] Extrahieren aus `tv-communication.service.ts`:
  - [ ] `downloadFile()`, `saveFilesToPublic()`
  - [ ] Dependency: `FunctionFileGeneratorService`

#### Parent Service anpassen

- [ ] `tv-communication.service.ts` als Facade behalten oder entfernen
- [ ] Alle Components auf neue Services umstellen
- [ ] Imports aktualisieren
- [ ] Testen: Alle Services funktionieren isoliert

### 5.2 Polling-Optimierung (OHNE WebSockets)

- [ ] `tv-scanner.component.ts` - Command-Polling optimieren:
  - [ ] Interval von 3000ms auf 5000ms erhöhen (weniger Last)
  - [ ] Exponential Backoff bei Errors implementieren
  - [ ] Polling pausieren bei Screensaver
- [ ] `tv-communication.service.ts` - Result-Polling optimieren:
  - [ ] PollInterval von 500ms auf 1000ms erhöhen
  - [ ] Abort-Signal für laufende Polls implementieren
  - [ ] Cleanup bei Component-Destroy verbessern

---

## 📋 PHASE 6: PERFORMANCE & OPTIMIERUNG

### 6.1 Change Detection optimieren

- [ ] `tv-scanner.component.ts` - `ChangeDetectionStrategy.OnPush` hinzufügen
- [ ] `controller-console.component.ts` - `ChangeDetectionStrategy.OnPush` hinzufügen
- [ ] `console-modal.component.ts` - `ChangeDetectionStrategy.OnPush` hinzufügen
- [ ] Alle neuen Sub-Components - `OnPush` von Anfang an

### 6.2 Large Lists optimieren (Optional)

- [ ] Function Library - Prüfen ob Virtual Scrolling nötig (bei >500 Funktionen)
- [ ] Command History - Prüfen ob Pagination nötig (bei >100 Einträgen)

---

## 📋 PHASE 7: SICHERHEIT & CORS

### 7.1 Custom Code Execution absichern

- [ ] Input-Validation hinzufügen:
  - [ ] Max-Length für Code (z.B. 10.000 Zeichen)
  - [ ] Blacklist gefährlicher Patterns (optional)
- [ ] Error-Handling verbessern:
  - [ ] Try-Catch um `new Function()`
  - [ ] Timeout für Code-Execution
  - [ ] Bessere Error-Messages
- [ ] Warning im UI hinzufügen:
  - [ ] "⚠️ Custom Code wird direkt auf dem TV ausgeführt"
  - [ ] "Nur vertrauenswürdigen Code verwenden"

### 7.2 CORS verschärfen

- [ ] `dev-server.js` - CORS-Konfiguration anpassen:
  - [ ] Whitelist statt `*`: `['http://localhost:4200', 'https://vidaahub.com']`
  - [ ] Environment-Variable für Production-Origin
  - [ ] Dokumentieren in README

---

## 📋 PHASE 8: DOKUMENTATION

### 8.1 JSDoc hinzufügen

- [ ] Alle Services dokumentieren:
  - [ ] `tv-connection.service.ts` - Alle public Methods
  - [ ] `tv-function.service.ts` - Alle public Methods
  - [ ] `tv-command.service.ts` - Alle public Methods
  - [ ] `tv-file.service.ts` - Alle public Methods
  - [ ] `logging.service.ts` - Alle public Methods

### 8.2 README aktualisieren

- [ ] Architektur-Diagramm hinzufügen
- [ ] Service-Layer-Struktur dokumentieren
- [ ] Custom Code Execution Sicherheitshinweise
- [ ] Development-Setup beschreiben

---

## 📋 PHASE 9: TESTING & VALIDATION

### 9.1 Manuelle Tests

- [ ] TV-Scanner funktioniert (Function-Scan, Upload)
- [ ] Controller-Console funktioniert (Function-Execution, History)
- [ ] Remote-Command-System funktioniert (TV ↔ Controller)
- [ ] Custom Code Execution funktioniert
- [ ] File-Download funktioniert
- [ ] Screensaver funktioniert

### 9.2 Build & Production

- [ ] `npm run build` läuft ohne Errors
- [ ] `npm run test` läuft ohne Errors
- [ ] Production-Build testen
- [ ] Performance-Check (Lighthouse/DevTools)

---

## ✅ COMPLETION CHECKLIST

- [x] **PHASE 1 COMPLETE** - Dead Code entfernt, VidaaService weg (Commit: c9b0257, -270 Zeilen)
- [x] **PHASE 2 COMPLETE** - Alle Templates in separate .html Dateien (Commit: 9c0379e, -660 Zeilen)
- [x] **PHASE 3 COMPLETE** - Logging-Service implementiert, Console-Statements ersetzt (Commit: 95ebd62, +55 Zeilen)
- [x] **PHASE 4 COMPLETE** - Type Safety mit FunctionResult (Commit: e92677b, +55 Zeilen)
- [x] **PHASE 5 COMPLETE** - Component Refactoring (Commits: c4ef0a4 + f6f7002, -405 Zeilen netto)
- [ ] **PHASE 6 PENDING** - Service Layer Optimierung
- [ ] **PHASE 7 PENDING** - Change Detection optimiert
- [ ] **PHASE 8 PENDING** - Custom Code abgesichert, CORS verschärft
- [ ] **PHASE 9 PENDING** - Dokumentation aktualisiert
- [ ] **PHASE 10 PENDING** - Alle Tests erfolgreich

---

## 📊 METRIKEN TRACKING

**Vor Refactoring:**

- Components >1000 Zeilen: 2
- Services >400 Zeilen: 2
- Dead Code Files: 1
- Console-Statements: 20+
- Inline Templates: 4

**Nach Phase 1-5 (Stand: 14. Okt 2025):**

- Components >1000 Zeilen: 0 ✅ (controller-console: 887 → 565)
- Services >400 Zeilen: 1 (tv-communication: 464 Zeilen) ⏳
- Dead Code Files: 0 ✅
- Console-Statements: ~3 (nur dev-server.js Backend) ✅
- Inline Templates: 0 ✅
- **Total Lines Saved:** -1225 Zeilen netto (5 Commits)
- **Sub-Components Created:** 4 (function-library, command-history, execution-modal, custom-code-modal)

---

## 🎯 GESCHÄTZTER AUFWAND

- **PHASE 1:** ~2 Stunden (einfach)
- **PHASE 2:** ~3 Stunden (mittel)
- **PHASE 3:** ~4 Stunden (mittel)
- **PHASE 4:** ~8 Stunden (komplex)
- **PHASE 5:** ~10 Stunden (komplex)
- **PHASE 6:** ~2 Stunden (einfach)
- **PHASE 7:** ~3 Stunden (mittel)
- **PHASE 8:** ~2 Stunden (einfach)
- **PHASE 9:** ~2 Stunden (mittel)

**GESAMT:** ~36 Stunden (~1 Woche Vollzeit oder 2 Wochen Teilzeit)

---

**HINWEISE:**

- ✅ Custom Code Execution bleibt erhalten (nur Sicherheit verbessern)
- ✅ Keine WebSockets (Polling nur optimieren)
- ✅ State Management unterschiedlich (LocalStorage, RxJS, Server) bleibt so
- ✅ Jede Phase kann einzeln abgearbeitet werden
- ✅ Nach jeder Phase: Commit + Test
