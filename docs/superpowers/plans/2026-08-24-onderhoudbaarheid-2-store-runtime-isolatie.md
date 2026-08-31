# Onderhoudbaarheidsprogramma 2 — store-runtime- en MCP-isolatie

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zorg dat elke via `createAppStoreContext()` gemaakte store haar eigen undo-coalescing, batchvenster, MCP-transactie, rollback, draftprimitieven en meldingen bezit, terwijl bestaande appimports via dunne compatibiliteitswrappers blijven werken.

**Architecture:** `StoreRuntime` houdt uitvoeringsmetadata in een per-context closure en wordt in transactionele slices geïnjecteerd. Batch- en MCP-transacties zijn factories rond `AppStoreContext`; alleen app-composition roots binden de singleton. `McpContext` draagt store en transacties expliciet door naar runtime, tools, backup en stale guards.

**Tech Stack:** TypeScript strict, Zustand 5 + Immer 11, bestaande snapshot-/documentcontractlaag, headless planning- en MCP-suites.

**Spec:** [`docs/superpowers/specs/2026-08-24-onderhoudbaarheidsprogramma-design.md`](../specs/2026-08-24-onderhoudbaarheidsprogramma-design.md)

## Global Constraints

- Plan 0 is volledig groen.
- Voer Task 1 uit vóór Plan 1. Rond daarna Plan 1 af en hervat pas dan Task 2 en verder.
- De app blijft productmatig één singleton gebruiken; dit plan maakt een tweede context correct, het
  introduceert geen multi-window-UI.
- Snapshot-undo, `DOCUMENT_FIELDS`, handmatige CPM en documentwisselsemantiek blijven gelijk.
- Batchthrows behouden bestaand gedrag: gedeeltelijke mutaties blijven staan en zijn één keer undoable.
- MCP-fouten rollen de eigen context volledig terug en laten andere contexten byte-inhoudelijk gelijk.
- Geen core runtimefactory of storegebonden MCP-tool importeert `useAppStore` of `appStoreContext`.
- Dunne compatibiliteitswrappers mogen de appcontext binden maar bevatten geen domeinlogica.
- `tests/planning/run.sh` bevat bij de huidige start een niet-gerelateerde
  `check-dependency-presentation.ts`-hunk. Stage eigen registraties hunkgewijs en controleer de
  cached diff; stage die bestaande hunk en het bijbehorende nieuwe bestand niet in dit programma.
  Vallen beide regels in één patchhunk, splits met `s` of bewerk met `e` tot alleen de eigen regel.
- Draai vóór de eerste edit `git status --short`. Draai vóór iedere commit
  `git diff --cached --name-only` en `git diff --cached --check`; inspecteer ieder overlappend bestand
  hunk voor hunk en breek af bij werk buiten de actieve task.
- Raak `docs/CHANGELOG.md` niet aan.

---

## Task 1: Introduceer `AppStoreContext`, per-store runtime en gebonden batchfactory

**Waarom dit vóór Plan 1 gebeurt:** extensie-`data.*` moet aan een expliciete store kunnen worden
gebonden. Alleen een storeobject doorgeven is onvoldoende zolang de undo-/batchmetadata module-global
blijft.

**Files:**
- Create: `src/state/runtime/storeRuntime.ts`
- Create: `src/state/runtime/createBatchTransactions.ts`
- Modify: `src/state/transaction.ts`
- Modify: `src/state/batchTransaction.ts`
- Modify: `src/state/appStore.ts`
- Modify: `src/state/slices/types.ts`
- Modify: `src/state/slices/baselineSlice.ts`
- Modify: `src/state/slices/documentSlice.ts`
- Modify: `src/state/slices/fileSlice.ts`
- Modify: `src/state/slices/historySlice.ts`
- Modify: `src/state/slices/librarySlice.ts`
- Modify: `src/state/slices/projectSlice.ts`
- Modify: `src/state/slices/resourceSlice.ts`
- Modify: `src/state/slices/scheduleSlice.ts`
- Modify: `src/state/slices/selectionSlice.ts`
- Modify: `src/state/slices/sequenceSlice.ts`
- Modify: `src/state/slices/structureSlice.ts`
- Modify: `src/state/slices/taskSlice.ts`
- Replace assertions in: `tests/planning/check-store-factory.ts`

- [ ] **Step 1: Vervang de bekende-kloofasserties door gewenste failing asserts**

In `check-store-factory.ts` worden de checks die nu aantonen dat batch de singleton raakt vervangen
door:

- `createAppStoreContext()` levert `{store,runtime}` en twee verschillende runtimeobjecten;
- batch op B pusht één snapshot op B, nul op A en nul op de app-singleton;
- mutators in B worden alleen binnen B onderdrukt;
- een mutatie in A tijdens een open batch op B krijgt haar eigen undo-stap;
- `copyTasks` blijft app-globaal, maar `pasteTasks` op B gebruikt B's runtime, pusht alleen op B één
  snapshot en laat A/app-singleton byte-identiek;
- `createAppStore()` blijft een kale store met Zustandvorm leveren.

- [ ] **Step 2: Draai de factorycheck rood**

```bash
bash tests/planning/run.sh
```

Verwacht: exit ongelijk aan 0 op ontbrekende context/factory of op de oude singletonkoppeling.

- [ ] **Step 3: Definieer de runtimeclosure**

`src/state/runtime/storeRuntime.ts`:

```ts
export interface StoreRuntime {
  beginUndoable(state: AppState, opts?: { coalesceKey?: string }): void;
  pushUndoSnapshot(state: AppState, base?: AppState): void;
  resetUndoCoalescing(): void;
  isBatchActive(): boolean;
  enterBatch(): void;
  exitBatch(): void;
  enterMcpTransaction(): McpTransactionLease;
  recordMcpTimephasedLoss(lease: McpTransactionLease, taskId: string): void;
  countMcpTimephasedLoss(lease: McpTransactionLease): number;
  exitMcpTransaction(lease: McpTransactionLease): void;
}

export interface McpTransactionLease {
  readonly token: symbol;
}

export function createStoreRuntime(): StoreRuntime;
```

De vier huidige modulevariabelen en één `activeMcpLease: { token: symbol;
timephasedLossTaskIds: Set<string> } | null` worden locals van `createStoreRuntime()`. De MCP-lease
is bewust geen vrije booleansetter:

- `enterMcpTransaction()` weigert vóór iedere statemutatie wanneer al een lease actief is;
- record/count accepteren uitsluitend het exact actieve leaseobject;
- `exitMcpTransaction(lease)` wist alleen datzelfde actieve leaseobject; een vreemde of al gesloten
  lease gooit zonder de actieve outer lease vrij te geven;
- `beginUndoable` onderdrukt snapshots zolang `batchDepth > 0` of een MCP-lease actief is.

Hiermee delen twee los gemaakte `createMcpTransactions(B)`-factories toch één
herintreedbaarheids- en suppressie-eigenaar: de runtime van B. `MAX_UNDO` blijft één geëxporteerde
constante. `createSnapshot` blijft de bestaande bron.

- [ ] **Step 4: Houd pure mutatiehelpers puur**

`src/state/transaction.ts` exporteert alleen:

- `MAX_UNDO` als re-export als bestaande callers dat nodig hebben;
- `finishMutation`;
- `markScheduleStale`;
- runtime types/factory als expliciete re-export indien dat importmigratie vereenvoudigt.

Er staat geen mutable module-state meer in dit bestand.

- [ ] **Step 5: Maak slice-factories runtimebewust**

Voeg in `slices/types.ts` toe:

```ts
export type AppSliceFactory<T> = (runtime: StoreRuntime) => AppSlice<T>;
```

De twaalf slices die nu transactionhelpers importeren worden `AppSliceFactory<...>`. Vervang:

- `beginUndoable(...)` door `runtime.beginUndoable(...)`;
- `pushUndoSnapshot(...)` door `runtime.pushUndoSnapshot(...)`;
- `resetUndoCoalescing()` door `runtime.resetUndoCoalescing()`.

`finishMutation` en `markScheduleStale` blijven directe pure imports.
`selectionSlice.ts` hoort expliciet bij deze twaalf: `pasteTasks` gebruikt
`runtime.beginUndoable(s)`. `taskClipboard` zelf blijft app-globaal conform het documentcontract;
alleen de paste-mutatie en undo horen bij de doelcontext.

- [ ] **Step 6: Bouw context en compatibiliteitsstore**

In `appStore.ts`:

```ts
export type AppStore = UseBoundStore<StoreApi<AppState>>;
export interface AppStoreContext { store: AppStore; runtime: StoreRuntime }

export function createAppStoreContext(): AppStoreContext {
  const runtime = createStoreRuntime();
  const store = create<AppState>()(immer((...a) => ({
    ...createProjectSlice(runtime)(...a),
    // alle overige slices; pure slices mogen hun huidige vorm houden
  })));
  return { store, runtime };
}

export function createAppStore(): AppStore {
  return createAppStoreContext().store;
}

export const appStoreContext = createAppStoreContext();
export const useAppStore = appStoreContext.store;
```

Gebruik geen globale `currentRuntime` tijdens storeconstructie.

- [ ] **Step 7: Maak batch een contextfactory**

`createBatchTransactions.ts`:

```ts
export interface BatchTransactions {
  withTransaction<T>(fn: () => T): T;
}
export function createBatchTransactions(context: AppStoreContext): BatchTransactions;
```

De factory gebruikt alleen `context.store` en `context.runtime`. Nested batch op dezelfde runtime
neemt geen tweede snapshot. `finally` sluit alleen de runtime van die context.

`batchTransaction.ts` wordt een dunne adapter:

```ts
export const batchTransactions = createBatchTransactions(appStoreContext);
export const withTransaction = batchTransactions.withTransaction;
export type { BatchTransactions } from './runtime/createBatchTransactions';
```

- [ ] **Step 8: Draai planning- en typecheck groen**

```bash
npm run typecheck
bash tests/planning/run.sh
```

Verwacht: beide exit 0 en de oude `VASTGEPIND`-batchasserties zijn verdwenen, niet omgekeerd.

- [ ] **Step 9: Commit de gedeelde contextnaad**

```bash
git add src/state/runtime/storeRuntime.ts src/state/runtime/createBatchTransactions.ts src/state/transaction.ts src/state/batchTransaction.ts src/state/appStore.ts src/state/slices/types.ts src/state/slices/baselineSlice.ts src/state/slices/documentSlice.ts src/state/slices/fileSlice.ts src/state/slices/historySlice.ts src/state/slices/librarySlice.ts src/state/slices/projectSlice.ts src/state/slices/resourceSlice.ts src/state/slices/scheduleSlice.ts src/state/slices/selectionSlice.ts src/state/slices/sequenceSlice.ts src/state/slices/structureSlice.ts src/state/slices/taskSlice.ts tests/planning/check-store-factory.ts
git commit -m "refactor(state): geef elke store eigen transactie-runtime"
```

- [ ] **Step 10: Pauzeer Plan 2 en voer Plan 1 volledig uit**

Ga pas door naar Task 2 als het extensieplan inclusief de contextgebonden `ExtensionApi` groen is.

---

## Task 2: Bewijs coalescing, nested batch en throwgedrag tussen twee stores

**Files:**
- Create: `tests/planning/check-store-runtime-isolation.ts`
- Modify: `tests/planning/run.sh`

- [ ] **Step 1: Registreer een eigen isolation-batterij**

Gebruik verse contexten A en B en een genormaliseerde kalenderfixture. Vergelijk documentstate met
`capturePayload` en uitvoeringsstate met expliciete stacklengtes; vergelijk geen functies.

- [ ] **Step 2: Test interleaved dezelfde coalescekey**

Volgorde:

1. A `updateTask(..., {coalesceKey:'edit:name'})` tweemaal => één undo;
2. B dezelfde key eenmaal => één eigen undo;
3. A dezelfde key nogmaals zonder andere A-mutatie => nog steeds één A-undo;
4. gewone A-mutatie breekt alleen A-coalescing;
5. documentwissel en undo/redo resetten alleen de betrokken runtime.

- [ ] **Step 3: Test nested en interleaved batch**

- Outer batch B + nested batch B => één B-snapshot.
- Tijdens outer B muteert A => A krijgt normale eigen snapshot.
- Tijdens outer B opent batch A => één A-batchsnapshot; beide depths herstellen naar nul.
- Na beide batches krijgt een gewone mutatie per store weer een snapshot.

- [ ] **Step 4: Test throwsemantiek exact**

Laat B in een batch twee taken toevoegen en daarna gooien. Assert:

- de twee B-taken blijven staan;
- B heeft precies één undo-stap;
- één B-undo herstelt exact de beginpayload;
- A en zijn stacks zijn byte-inhoudelijk gelijk;
- een vervolgmutatie in A en B krijgt weer een snapshot.

- [ ] **Step 5: Draai rood/groen en de undo-batterij**

```bash
bash tests/planning/run.sh
```

Verwacht: exit 0, inclusief `check-undo-bound.ts` en de nieuwe isolatiecheck.

- [ ] **Step 6: Commit het twee-store-bewijs**

Als een case rood blijft door een productdefect, stop deze task en herstel de contractimplementatie
in Task 1 met die regressiecase erbij. De bewijscommit hieronder bevat geen verborgen runtimefix.

```bash
git add tests/planning/check-store-runtime-isolation.ts
git add -p tests/planning/run.sh
git diff --cached -- tests/planning/run.sh
git diff --cached --name-only
git commit -m "test(state): bewijs coalescing en batchisolatie tussen stores"
```

Selecteer alleen de nieuwe isolationregistratie; de cached diff mag
`check-dependency-presentation.ts` niet bevatten.

---

## Task 3: Verplaats de volledige MCP-transactiekern naar een contextfactory

**Files:**
- Create: `src/state/runtime/createMcpTransactions.ts`
- Modify: `src/state/mcpTransaction.ts`
- Modify: `tests/mcp/cases-transaction.ts`
- Modify: `tests/mcp/cases-draft.ts`
- Modify: `tests/mcp/cases-bulk.ts`
- Modify: `tests/mcp/cases-recorded-dates.ts`
- Modify: `tests/mcp/cases-guards.ts`

- [ ] **Step 1: Schrijf factorycases vóór de verhuizing**

Maak context B, `const txB = createMcpTransactions(B)` en daarnaast onafhankelijk
`const txB2 = createMcpTransactions(B)`. Test:

- succes muteert alleen B, maakt één B-undo en rekent B éénmaal;
- callbackthrow en solvercycle rollen B volledig terug;
- A-payload, A-undo/redo en A-notifications blijven byte-inhoudelijk gelijk;
- nested `txB.run` wordt geweigerd en rolt de outer call terug;
- `txB.run(() => txB2.run(...))` wordt eveneens geweigerd: de bescherming hoort bij B's runtime,
  niet bij één factoryobject; gedurende de volledige outer call blijft suppressie actief, er komt
  geen extra undo/redo en na rollback is B opnieuw bruikbaar;
- gelijktijdig synchroon `txA.run` vanuit `txB.run` is toegestaan omdat reentrancy contextlokaal is;
- na succes én rollback is B-coalescing gebroken, A-coalescing niet;
- twee afzonderlijke `buildMcpContext(B)`-resultaten kunnen elkaar evenmin nesten;
- timephased-lossmelding en teller verschijnen alleen in B.

- [ ] **Step 2: Draai alleen MCP rood**

```bash
npm run test:mcp
```

Verwacht: exit ongelijk aan 0 op ontbrekende factory of singletonlek.

- [ ] **Step 3: Laat de runtime de actieve transactielease bezitten**

`context.runtime` bezit precies één actieve MCP-lease met:

- een unieke `token`;
- `timephasedLossTaskIds: Set<string>` voor die call.

`createMcpTransactions(context)` bezit alleen de draftprimitieven en de uitvoering van rollback en
eindherberekening. Iedere `run` vraagt eerst een lease aan, vóór snapshot of andere statemutatie.
De enter staat buiten de failure-naar-resultaat-`catch` van die inner `run`: een geweigerde nested
enter propageert dus als fout naar de outer callback, zodat de outer transactie volledig terugrolt.
`finally` sluit uitsluitend de eigen lease. Een factory houdt hoogstens haar huidige lease lokaal
bij om draftcalls te routeren; een draftcall zonder actieve eigen run faalt vóór mutatie. Draftcode
registreert timephased verlies via de lease die door haar huidige `run` is verkregen;
count/record/exit valideren telkens de objectidentiteit. Geen enkele factory kan met een losse
`false` de suppressie van een andere factory op dezelfde context beëindigen.

Geen van deze waarden blijft module-global of als herintreedbaarheidsvlag in een factoryclosure.

- [ ] **Step 4: Maak `run` generiek zonder compatibiliteit te breken**

Corecontract:

```ts
export type McpTransactionResult<T> =
  | { ok: true; value: T; timephasedGuidanceLost: number }
  | { ok: false; error: string };

export interface McpTransactions {
  run<T>(fn: () => T): McpTransactionResult<T>;
  draft: McpDraft;
}
```

De callback blijft strikt synchroon. `Promise` is geen toegestane return; borg dit met type en een
runtimeguard op een thenable als JavaScriptcaller de types omzeilt.

- [ ] **Step 5: Vervang elke draft-singletonread mechanisch**

In de verplaatste circa 900 regels gebruikt elk primitief `context.store.getState/setState`. Zoek na
de verhuizing:

```bash
rg -n "useAppStore|appStoreContext" src/state/runtime/createMcpTransactions.ts
```

Verwacht: exit 1 zonder uitvoer.

- [ ] **Step 6: Maak `mcpTransaction.ts` een dunne adapter**

```ts
export const mcpTransactions = createMcpTransactions(appStoreContext);
export const draft = mcpTransactions.draft;
export function runInMcpTransaction(fn: () => void): LegacyMcpTransactionResult {
  const result = mcpTransactions.run(fn);
  return result.ok
    ? { ok: true, timephasedGuidanceLost: result.timephasedGuidanceLost }
    : result;
}
```

Re-exporteer bestaande drafttypes zodat tool- en testimports niet in deze commit hoeven te wijzigen.

- [ ] **Step 7: Draai MCP en planning groen**

```bash
npm run test:mcp
bash tests/planning/run.sh
npm run typecheck
```

Verwacht: alle drie exit 0.

- [ ] **Step 8: Commit factory en compatlaag**

```bash
git add src/state/runtime/createMcpTransactions.ts src/state/mcpTransaction.ts tests/mcp/cases-transaction.ts tests/mcp/cases-draft.ts tests/mcp/cases-bulk.ts tests/mcp/cases-recorded-dates.ts tests/mcp/cases-guards.ts
git commit -m "refactor(mcp): maak transacties en drafts storegebonden"
```

---

## Task 4: Draag store en transacties expliciet in `McpContext`

**Files:**
- Modify: `src/services/mcp/contracts.ts`
- Modify: `src/services/mcp/server.ts`
- Modify: `src/services/mcp/tools/runtime.ts`
- Modify: `src/hooks/keyboard/shortcutRegistry.ts`
- Modify: `tests/mcp/harness.ts`
- Modify: `tests/mcp/cases-baselines.ts`
- Modify: `tests/mcp/cases-batch.ts`
- Modify: `tests/mcp/cases-bibliotheek.ts`
- Modify: `tests/mcp/cases-doc-file.ts`
- Modify: `tests/mcp/cases-mutate-cal-res.ts`
- Modify: `tests/mcp/cases-mutate-tasks.ts`
- Modify: `tests/mcp/cases-project-start-anchor.ts`
- Modify: `tests/mcp/cases-protocol.ts`
- Modify: `tests/mcp/cases-read.ts`
- Modify: `tests/mcp/cases-resource-crud.ts`
- Modify: `tests/mcp/cases-runtime.ts`
- Modify: `tests/mcp/cases-schemavalidatie.ts`
- Modify: `tests/mcp/cases-server.ts`
- Modify: `tests/mcp/cases-statusdatum.ts`
- Modify: `tests/mcp/cases-stille-noops-taken.ts`
- Modify: `tests/mcp/cases-stille-noops.ts`
- Modify: `tests/mcp/cases-sync2-integration.ts`
- Modify: `tests/mcp/cases-taskfields.ts`
- Modify: `tests/mcp/cases-update-dependencies.ts`
- Modify: `tests/mcp/cases-uurkalender.ts`

- [ ] **Step 1: Breid het contextcontract uit**

```ts
export interface McpContext {
  app: AppStoreContext;
  transactions: McpTransactions;
  expectedDocId: string | null;
  tempIdMap: Map<string, string>;
  paused: boolean;
  readOnly: boolean;
  ensureBackup: EnsureBackupFn;
}
```

Imports uit state zijn `import type`. De cyclecheck kijkt na type-erasure en mag geen runtimecykel
introduceren.

- [ ] **Step 2: Maak `buildMcpContext` injecteerbaar**

```ts
export function buildMcpContext(
  app: AppStoreContext = appStoreContext,
  transactions?: McpTransactions,
): McpContext;
```

De implementatie kiest `transactions ?? (app === appStoreContext ? mcpTransactions :
createMcpTransactions(app))`. Daardoor geeft `buildMcpContext(B)` zonder tweede argument nooit
singletontransacties terug. Meerdere calls mogen verschillende factoryobjecten opleveren, omdat de
runtimelease de contextbrede exclusiviteit afdwingt. Voeg in `cases-server.ts` een verplichte
een-argumenttest toe: read, mutatie, rollback en envelope horen alle vier bij B en A blijft exact
gelijk. Bouw daarnaast twee afzonderlijke `buildMcpContext(B)`-resultaten en bewijs dat een run uit
de ene context niet in een run uit de andere kan nesten, dat de outer rollback exact is en dat B
daarna herbruikbaar is.

- [ ] **Step 3: Maak runtimehelpers contextgebonden**

Wijzig signatures:

```ts
export function buildEnvelope(ctx: McpContext): McpEnvelope;
function blockingDialogName(ui: UIState): string | null;
function driftGuard(ctx: McpContext): McpToolErr | null;
export function bindExpectedDoc(ctx: McpContext): void;
```

`runReadTool` leest `ctx.app.store`. `runMutateTool` gebruikt `ctx.transactions.run` en neemt
`value: MutationOutcome` rechtstreeks uit het resultaat; de closurevariabelen `outcome` en
`stepError` mogen verdwijnen als een getypeerde thrown `McpStepError` apart wordt herkend.

- [ ] **Step 4: Maak dialoogguard expliciet**

Pas `hasBlockingDialogOpen` aan naar:

```ts
export function hasBlockingDialogOpen(ui = useAppStore.getState().ui): boolean;
```

MCP geeft altijd `ctx.app.store.getState().ui`; bestaande UI-shortcutcallers mogen de default
behouden.

- [ ] **Step 5: Update de MCP-testharness**

De harness exporteert `appStoreContext`, `useAppStore` en een `makeMcpContext(app?)` die altijd
bijpassende transacties bouwt. Migreer de negentien actuele lokale contextfactories/literals naar
die ene helper: `cases-baselines`, `cases-batch`, `cases-bibliotheek`, `cases-doc-file`,
`cases-mutate-cal-res`, `cases-mutate-tasks`, `cases-project-start-anchor`, `cases-protocol`,
`cases-read`, `cases-resource-crud`, `cases-runtime`, `cases-schemavalidatie`, `cases-statusdatum`,
`cases-stille-noops-taken`, `cases-stille-noops`, `cases-sync2-integration`, `cases-taskfields`,
`cases-update-dependencies` en `cases-uurkalender`. Overrides mogen `expectedDocId`, flags en
`ensureBackup` zetten, maar nooit `app` zonder bijpassende `transactions`. Tests die bewust de
singleton testen blijven dat expliciet doen.

- [ ] **Step 6: Draai runtime/servercases**

```bash
npm run test:mcp
npm run verify:cycles
npm run typecheck
```

Verwacht: alle drie exit 0.

- [ ] **Step 7: Commit contextpropagatie**

```bash
git add src/services/mcp/contracts.ts src/services/mcp/server.ts src/services/mcp/tools/runtime.ts src/hooks/keyboard/shortcutRegistry.ts tests/mcp/harness.ts tests/mcp/cases-baselines.ts tests/mcp/cases-batch.ts tests/mcp/cases-bibliotheek.ts tests/mcp/cases-doc-file.ts tests/mcp/cases-mutate-cal-res.ts tests/mcp/cases-mutate-tasks.ts tests/mcp/cases-project-start-anchor.ts tests/mcp/cases-protocol.ts tests/mcp/cases-read.ts tests/mcp/cases-resource-crud.ts tests/mcp/cases-runtime.ts tests/mcp/cases-schemavalidatie.ts tests/mcp/cases-server.ts tests/mcp/cases-statusdatum.ts tests/mcp/cases-stille-noops-taken.ts tests/mcp/cases-stille-noops.ts tests/mcp/cases-sync2-integration.ts tests/mcp/cases-taskfields.ts tests/mcp/cases-update-dependencies.ts tests/mcp/cases-uurkalender.ts
git commit -m "refactor(mcp): draag storecontext door de toolruntime"
```

---

## Task 5: Migreer alle MCP-toolmodules van de singleton

**Files:**
- Modify: `src/services/mcp/tools/baselineTools.ts`
- Modify: `src/services/mcp/tools/batchTool.ts`
- Modify: `src/services/mcp/tools/calendarResourceTools.ts`
- Modify: `src/services/mcp/tools/dependencyTools.ts`
- Modify: `src/services/mcp/tools/documentTools.ts`
- Modify: `src/services/mcp/tools/fileTools.ts`
- Modify: `src/services/mcp/tools/helpers.ts`
- Modify: `src/services/mcp/tools/readTools.ts`
- Modify: `src/services/mcp/tools/resourceTools.ts`
- Modify: `src/services/mcp/tools/taskTools.ts`
- Create: `tests/mcp/cases-tool-context.ts`

- [ ] **Step 1: Leg de huidige singletonimportlijst vast**

```bash
rg -l "useAppStore|@/state/mcpTransaction" src/services/mcp/tools | sort
```

Bewaar de lijst in de commitbeschrijving of testkop. Na deze task moet hij leeg zijn.

Schrijf daarnaast `cases-tool-context.ts`: bouw context A en B, roep ten minste één readtool en één
mutatietool uit elk gemigreerd toolcluster op B aan en bewijs dat response én mutatie uit B komen
terwijl A byte-identiek blijft. Bestaande handlerexports houden hun vorm; daardoor hoeven bestaande
cases in deze task niet mechanisch te worden herschreven.

- [ ] **Step 2: Migreer read- en helpermodules eerst**

- Handlers lezen `ctx.app.store.getState()`.
- Pure helpers krijgen de benodigde `AppState`/waarden als parameter.
- `buildEnvelope`, guards en documenttitelhelpers krijgen `ctx` waar nodig.

Draai daarna:

```bash
npm run test:mcp
```

Verwacht: exit 0.

- [ ] **Step 3: Migreer task/dependency/resource/calendar-tools**

Vervang imports van globale `draft` door `ctx.transactions.draft`. Batchstappen krijgen dezelfde
`ctx` door en openen geen eigen transactie.

- [ ] **Step 4: Migreer document- en filetools**

Deze tools wisselen of laden documenten buiten de MCP-transactie. Ze gebruiken nog steeds
`ctx.app.store`, binden daarna het driftanker via dezelfde context en mogen geen snapshot van de
verkeerde appstore nemen.

- [ ] **Step 5: Migreer `batchTool` zonder geneste transactie**

De buitenste `runMutateTool` bezit `ctx.transactions.run`. Elke batchstap gebruikt
`ctx.transactions.draft` of contextgebonden nontransactionele helper. `recomputeMidBatch` draait
binnen dezelfde runtime-suppressie en raakt geen andere context.

- [ ] **Step 6: Zoek de tooltree schoon**

```bash
rg -n "useAppStore|@/state/mcpTransaction" src/services/mcp/tools
```

Verwacht: exit 1 zonder uitvoer.

- [ ] **Step 7: Draai alle MCP-cases**

```bash
npm run test:mcp
npm run typecheck
```

Verwacht: beide exit 0.

- [ ] **Step 8: Commit toolmigratie**

```bash
git add src/services/mcp/tools/baselineTools.ts src/services/mcp/tools/batchTool.ts src/services/mcp/tools/calendarResourceTools.ts src/services/mcp/tools/dependencyTools.ts src/services/mcp/tools/documentTools.ts src/services/mcp/tools/fileTools.ts src/services/mcp/tools/helpers.ts src/services/mcp/tools/readTools.ts src/services/mcp/tools/resourceTools.ts src/services/mcp/tools/taskTools.ts tests/mcp/cases-tool-context.ts
git commit -m "refactor(mcp): laat tools uitsluitend hun requestcontext gebruiken"
```

---

## Task 6: Bind backup, stale guard en serverlifecycle aan de context

**Files:**
- Modify: `src/services/mcp/backup.ts`
- Modify: `src/services/mcp/staleGuard.ts`
- Modify: `src/services/mcp/server.ts`
- Modify: `tests/mcp/cases-backup.ts`
- Modify: `tests/mcp/cases-server.ts`
- Modify: `tests/mcp/cases-staleguard.ts`
- Modify: `tests/mcp/cases-stille-noops.ts`

- [ ] **Step 1: Maak echte backupdeps contextgebonden**

Wijzig:

```ts
function realDeps(app: AppStoreContext): BackupDeps;
export function createAppBackupService(app: AppStoreContext): BackupService;
```

`getDoc` en `activeDocId` lezen alleen `app.store`. De publieke appwrappers mogen een singletonservice
op `appStoreContext` houden. `buildMcpContext(customApp)` krijgt een backupservice voor diezelfde
context of een expliciet geïnjecteerde `ensureBackup`.

- [ ] **Step 2: Maak stale guard parameteriseerbaar**

```ts
export function ensureFreshSchedule(app: AppStoreContext = appStoreContext): FreshResult;
```

MCP-toolcallers geven altijd `ctx.app`; bestaande appcaller mag default gebruiken.

- [ ] **Step 3: Scheid app-servercomposition van requestcore**

`attemptBridgeStart` en app-lifecycle mogen de singleton kennen. `createRequestHandler` en elke
request na `buildContext()` gebruiken alleen de context in dat request.

- [ ] **Step 4: Test backup tegen context B**

Assert dat de geserialiseerde IFC en projectnaam uit B komen, ook wanneer A actief andere data bevat.
Manual backup op een B-service gebruikt B's active doc. De app-wrapper blijft A gebruiken.

- [ ] **Step 5: Draai MCP en webbuild**

```bash
npm run test:mcp
npm run build
```

Verwacht: beide exit 0; geen top-level Tauri-import is toegevoegd.

- [ ] **Step 6: Commit services**

```bash
git add src/services/mcp/backup.ts src/services/mcp/staleGuard.ts src/services/mcp/server.ts tests/mcp/cases-backup.ts tests/mcp/cases-server.ts tests/mcp/cases-staleguard.ts tests/mcp/cases-stille-noops.ts
git commit -m "refactor(mcp): bind backup en versheidscontrole aan requests"
```

---

## Task 7: Voeg een mechanische ownershippoort toe

**Files:**
- Create: `scripts/verify-store-boundaries.mjs`
- Modify: `package.json`
- Create: `tests/planning/check-store-runtime-boundaries.ts`
- Modify: `tests/planning/run.sh`
- Modify: `src/state/appStore.ts`

- [ ] **Step 1: Definieer verboden en toegestane zones**

De scriptpoort scant importdeclaraties, geen losse commentaartekst.

Verboden singletonimports in:

- `src/state/runtime/**`;
- `src/services/mcp/tools/**`;
- `src/services/mcp/staleGuard.ts` core;
- contextgebonden delen van `src/services/mcp/backup.ts`.

Toegestaan:

- `src/state/batchTransaction.ts` en `src/state/mcpTransaction.ts` als dunne adapters;
- `src/services/mcp/server.ts` alleen in app-compositionfuncties;
- React-componenten en hooks;
- expliciet benoemde app-lifecyclemodules.

- [ ] **Step 2: Laat de poort ook logicaslip in adapters vangen**

Adapters mogen naast imports/exports en een kleine shape-conversie geen storemutaties bevatten.
Laat de scriptpoort minimaal falen op `.getState(`, `.setState(` en `createSnapshot(` in de twee
compatibiliteitsbestanden.

- [ ] **Step 3: Voeg aan verify toe**

```json
"verify:store-boundaries": "node scripts/verify-store-boundaries.mjs"
```

Voeg `npm run verify:store-boundaries` vóór `verify:cycles` aan de bestaande `verify`-keten toe.

- [ ] **Step 4: Werk `appStore.ts`-documentatie bij**

Verwijder de drie verouderde bekende-kloven. Leg feitelijk vast wat per context is en wat bewust
app-global blijft.

- [ ] **Step 5: Draai de poort en negatieve controle**

```bash
npm run verify:store-boundaries
```

Verwacht: exit 0. Voeg tijdelijk een verboden import aan een testfixture of injecteer brontekst in
de scripttest en bewijs exit ongelijk aan 0; wijzig geen productiefile voor de negatieve controle.

- [ ] **Step 6: Commit ownershippoort**

```bash
git add scripts/verify-store-boundaries.mjs package.json tests/planning/check-store-runtime-boundaries.ts src/state/appStore.ts
git add -p tests/planning/run.sh
git diff --cached -- tests/planning/run.sh
git diff --cached --name-only
git commit -m "chore(state): bewaak storegebonden runtimegrenzen"
```

Selecteer alleen de store-boundaryregistratie; stage de bestaande dependency-presentationhunk niet.

---

## Task 8: Voeg de volledige twee-store MCP-matrix toe

**Files:**
- Create: `tests/mcp/cases-store-isolation.ts`

`tests/mcp/run.sh` globt `cases-*.ts` al; wijzig het niet.

- [ ] **Step 1: Maak genormaliseerde contextfixtures**

Context A en B krijgen elk:

- eigen projectnaam/document-id;
- projectkalender al in `calendars`, zodat rollback geen bekende restore-normalisatie introduceert;
- eigen taak/resource/assignment;
- eigen undo- en redo-inhoud;
- eigen notificationbaseline.

Helper `plainState(app)` gebruikt `capturePayload` plus expliciet de app-globale velden die in deze
test relevant zijn; serialiseer Maps/Sets deterministisch.

- [ ] **Step 2: Test succes op B met A byte-identiek**

Voer via een echte `McpContext` voor B task-, dependency-, resource- en calendar-draftmutaties uit.
Assert één B-undo, één B-recompute-uitkomst, correcte envelope met B-id/titel en A exact gelijk.

- [ ] **Step 3: Test rollback op B met A byte-identiek**

Vier rollbackoorzaken:

- draftthrow;
- expliciete `McpStepError`;
- solvercycle;
- nested run op dezelfde context.

Na elk: B exact terug inclusief undo/redo, A exact gelijk en suppressies/coalescing bruikbaar.

- [ ] **Step 4: Test lokale reentrancy**

- B-in-B via hetzelfde transactieobject faalt.
- B-in-B via twee onafhankelijk gemaakte `createMcpTransactions(B)`-factories faalt eveneens; de
  outer call rolt volledig terug, runtime-suppressie blijft tot diens `finally` actief, undo/redo
  groeit niet extra en B is daarna herbruikbaar.
- B-in-B via twee afzonderlijke `buildMcpContext(B)`-resultaten heeft exact hetzelfde gedrag.
- A-run synchroon vanuit B-run slaagt en commit onafhankelijk.
- Na een gefaalde B-run kan A en daarna B opnieuw muteren.

- [ ] **Step 5: Test lokale coalescingreset**

Open coalescereeks in A en B. MCP-succes/rollback in B breekt alleen B. Een volgende A-edit met
dezelfde key coalescet nog; een volgende B-edit begint een nieuwe stap.

- [ ] **Step 6: Test lokale timephased melding**

Laat alleen B een timephased window verliezen. Resultaatcounter en notification zijn alleen in B;
A's eenmalige-per-document-gate blijft beschikbaar voor zijn eerste eigen verlies.

- [ ] **Step 7: Test singletoncompatibiliteit**

Bestaande `runInMcpTransaction` en `draft` muteren nog steeds de app-singleton, niet een verse A/B.
Dit bewijst dat oude callers niet stil van eigenaar veranderden.

- [ ] **Step 8: Draai MCP drie keer**

```bash
npm run test:mcp
npm run test:mcp
npm run test:mcp
```

Verwacht: drie keer exit 0.

- [ ] **Step 9: Commit de isolationmatrix**

Als deze matrix een productfout vindt, stop dan deze task: ga terug naar de eigenaar in Task 3–6,
voeg daar de kleinste regressiecase toe en herstel die task eerst groen. Verstop geen productfix in de
bewijscommit van Task 8.

```bash
git add tests/mcp/cases-store-isolation.ts
git commit -m "test(mcp): bewijs volledige isolatie tussen storecontexten"
```

---

## Task 9: Documenteer ownership en verwijder oude gaptaal

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-07-24-mcp-bridge-design.md`
- Modify: `src/state/appStore.ts`
- Modify: `src/state/transaction.ts`
- Modify: `src/state/mcpTransaction.ts`
- Modify: `tests/planning/check-store-factory.ts`

- [ ] **Step 1: Documenteer de eigendomsmatrix**

Leg vast:

- UI-selectors gebruiken app-singleton;
- store runtime, batch, MCP en extension data krijgen context;
- registries mogen app-global blijven;
- compatibiliteitswrappers zijn alleen appbinding.

- [ ] **Step 2: Actualiseer de normatieve MCP-spec**

Pas alleen de implementatiearchitectuur aan; wijzig geen toolnamen, envelopvelden, guardvolgorde,
backupsemantiek of batchcontract.

- [ ] **Step 3: Verwijder tests die een opgelost defect verwachten**

In `check-store-factory.ts` mag geen `VASTGEPIND`-sectie over singleton batch/MCP meer staan. Vervang
niet door zwakkere afwezigheidsasserties; de positieve isolationbatterijen zijn de bron.

- [ ] **Step 4: Draai docs/cycles/typecheck**

```bash
npm run verify:docs
npm run verify:cycles
npm run typecheck
```

Verwacht: alle drie exit 0.

- [ ] **Step 5: Commit documentatie**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-07-24-mcp-bridge-design.md src/state/appStore.ts src/state/transaction.ts src/state/mcpTransaction.ts tests/planning/check-store-factory.ts
git commit -m "docs(state): leg storecontext en app-globale grenzen vast"
```

---

## Task 10: Volledige Plan-2-verificatie en stopbesluit

**Files:** geen productwijzigingen; alleen bewijs verzamelen.

- [ ] **Step 1: Zoek core singletonimports**

```bash
npm run verify:store-boundaries
rg -n "useAppStore|appStoreContext" src/state/runtime src/services/mcp/tools
```

Verwacht: eerste exit 0; tweede exit 1 zonder uitvoer.

- [ ] **Step 2: Zoek verdwenen module-uitvoeringsstate**

```bash
rg -n "let (coalesce|undoSeq|batchDepth|mcpTransactionActive|mcpTransactionInProgress|mcpTimephasedLossTaskIds)" src/state
```

Verwacht: exit 1 zonder uitvoer. Dezelfde concepten mogen locals in factoryclosures zijn, niet
module-`let`s.

- [ ] **Step 3: Draai de risicogerichte suites**

```bash
bash tests/planning/run.sh
npm run test:mcp
npm run test:library
npm run verify:cycles
```

Verwacht: vier keer exit 0.

- [ ] **Step 4: Draai de werkelijke gate**

```bash
npm run verify
```

Verwacht: exit 0.

- [ ] **Step 5: Controleer stopcriteria handmatig**

- Batchthrow blijft gedeeltelijk-mutatief en één keer undoable.
- MCP-rollback is exact en contextlokaal.
- A-in-B is toegestaan, B-in-B geweigerd.
- Coalescingreset en timephased melding zijn contextlokaal.
- Extension `data.batch` uit Plan 1 gebruikt dezelfde context.
- Singletonwrappers behouden bestaande appcallers.

- [ ] **Step 6: Stop bij één kruisbesmetting**

Plan 3 mag niet starten als één twee-store-case, boundarycheck of echte gate rood is. Een allowlist
voor een core singletonimport is geen reparatie; verplaats de binding naar de composition root.
