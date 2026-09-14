# Taaktype overerven van bovenliggende taak — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een nieuwe taak die met een bestaande `parentId` wordt aangemaakt, krijgt standaard het `taskType` van die ouder in plaats van de bouwmodus-brede default (`CONSTRUCTION`/`USERDEFINED`) — zowel via de UI als via de AI/MCP-tool `planner_add_tasks`.

**Architecture:** Twee functies maken daadwerkelijk een `Task`-object aan: `addTask` in `src/state/slices/taskSlice.ts` (UI-pad) en `draft.addTask` in `src/state/mcpTransaction.ts` (MCP-pad, ook gebruikt door `draft.addTasks` voor geneste WBS-batches). Beide krijgen dezelfde kleine wijziging: zoek de ouder op in `s.tasks` vóórdat het `Task`-object wordt gebouwd, en zet `parentTask?.taskType` als tussenstap in de bestaande fallback-keten (`partial.taskType || parentTask?.taskType || constructionMode-default`). Geen nieuwe bestanden, geen state-/schema-wijziging — puur een uitbreiding van bestaande default-logica.

**Tech Stack:** TypeScript, Zustand/Immer store, headless testscripts via esbuild+Node (`tests/planning/run.sh`, `tests/mcp/run.sh`).

**Referentie:** ontwerp in [`docs/superpowers/specs/2026-08-14-task-type-inheritance-parent-design.md`](../specs/2026-08-14-task-type-inheritance-parent-design.md).

---

### Task 1: UI-pad — `addTask` in `taskSlice.ts`

**Files:**
- Modify: `src/state/slices/taskSlice.ts:286-298`
- Test: `tests/planning/check-move-task.ts` (nieuwe sectie 5, vóór de "Uitslag"-sectie)

- [ ] **Step 1: Schrijf de falende test**

Open `tests/planning/check-move-task.ts`. Voeg vlak vóór de regel `// ── Uitslag ──` (rond regel 112) de volgende sectie toe:

```ts
// ── 5) addTask: taskType overerven van de bestaande ouder (alleen bij aanmaken). ──────────
const idOuderLogistiek = S().addTask({ name: 'OuderLogistiek', taskType: 'LOGISTIC' });
const idKindZonderType = S().addTask({ name: 'KindZonderType', parentId: idOuderLogistiek });
eq('26 addTask met ouder: kind zonder eigen taskType erft LOGISTIC van de ouder', task(idKindZonderType)?.taskType, 'LOGISTIC');

const idKindMetType = S().addTask({ name: 'KindMetType', parentId: idOuderLogistiek, taskType: 'DEMOLITION' });
eq('27 addTask met ouder: expliciete taskType op het kind wint van de ouder', task(idKindMetType)?.taskType, 'DEMOLITION');

const idRootZonderType = S().addTask({ name: 'RootZonderType' });
eq('28 addTask zonder ouder: root valt terug op de bouwmodus-default (CONSTRUCTION)', task(idRootZonderType)?.taskType, 'CONSTRUCTION');
```

Deze drie asserts dekken: overerving van de ouder, expliciete waarde wint van de ouder, en root-taken (geen ouder) blijven ongewijzigd op de bestaande default (de store-default `ui.constructionMode` is `true` en wordt nergens in deze testsuite gewijzigd, dus root-taken krijgen hier altijd `CONSTRUCTION`).

- [ ] **Step 2: Run de test om te bevestigen dat hij faalt**

Run: `bash tests/planning/run.sh`
Expected: FAIL — regel `XX  move-task-check: ...` met afwijkingen op checks 26 en 27 (`KindZonderType`/`KindMetType` krijgen nu `CONSTRUCTION` i.p.v. `LOGISTIC`/`DEMOLITION`, want de huidige code kijkt niet naar de ouder). Check 28 hoort al te slagen (ongewijzigd gedrag).

- [ ] **Step 3: Implementeer de minimale wijziging**

In `src/state/slices/taskSlice.ts`, regel 286-298, huidige code:

```ts
      const anchorTask = partial.position
        ? s.tasks.find(t => t.id === partial.position!.anchorId)
        : undefined;
      const parentId = anchorTask ? anchorTask.parentId : (partial.parentId || null);

      const task: Task = {
        id,
        name: partial.name,
        description: partial.description || '',
        wbsCode: partial.wbsCode || '',
        // Bouwmodus (2026-07-13): neutraal taaktype-default in bouw-agnostische modus (USERDEFINED)
        // i.p.v. CONSTRUCTION. Alleen de default bij aanmaken verandert; de enum blijft intact.
        taskType: partial.taskType || (s.ui.constructionMode ? 'CONSTRUCTION' : 'USERDEFINED'),
```

Vervang door:

```ts
      const anchorTask = partial.position
        ? s.tasks.find(t => t.id === partial.position!.anchorId)
        : undefined;
      const parentId = anchorTask ? anchorTask.parentId : (partial.parentId || null);
      // Overerving (2026-08-14): een taak met een bestaande ouder neemt diens taskType over als de
      // aanroeper zelf geen taskType opgeeft — vóór de bouwmodus-brede default. Geldt alleen op het
      // moment van aanmaken; indenteren/verslepen van een bestaande taak laat taskType met rust.
      const parentTask = parentId ? s.tasks.find(t => t.id === parentId) : undefined;

      const task: Task = {
        id,
        name: partial.name,
        description: partial.description || '',
        wbsCode: partial.wbsCode || '',
        // Bouwmodus (2026-07-13): neutraal taaktype-default in bouw-agnostische modus (USERDEFINED)
        // i.p.v. CONSTRUCTION. Alleen de default bij aanmaken verandert; de enum blijft intact.
        taskType: partial.taskType || parentTask?.taskType || (s.ui.constructionMode ? 'CONSTRUCTION' : 'USERDEFINED'),
```

- [ ] **Step 4: Run de test om te bevestigen dat hij slaagt**

Run: `bash tests/planning/run.sh`
Expected: PASS — `OK  move-task-check: alle checks groen (28)` (en alle andere batterijen blijven groen; exitcode 0).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: geen fouten.

- [ ] **Step 6: Commit**

```bash
git add src/state/slices/taskSlice.ts tests/planning/check-move-task.ts
git commit -m "feat(planning): addTask erft taskType van de ouder bij aanmaken (UI-pad)"
```

---

### Task 2: MCP-pad — `draft.addTask` in `mcpTransaction.ts`

**Files:**
- Modify: `src/state/mcpTransaction.ts:169-184`
- Test: `tests/mcp/cases-draft.ts` (nieuwe tests in sectie "1) addTask")

- [ ] **Step 1: Schrijf de falende tests**

Open `tests/mcp/cases-draft.ts`. Voeg ná de bestaande test `'draft.addTask mijlpaal ⇒ duur 0, gewone taak ⇒ default 5'` (eindigt rond regel 61) en vóór de sectiekop `// --- 2) addSequence ---` de volgende twee tests toe:

```ts
test('draft.addTask erft taskType van de ouder wanneer de aanroeper er zelf geen opgeeft', () => {
  const parentId = store.getState().addTask({ name: 'mcp-ouder', taskType: 'LOGISTIC' });

  let childId = '';
  const res = runInMcpTransaction(() => {
    childId = draft.addTask({ name: 'mcp-kind', parentId });
  });

  assert(res.ok, 'transactie hoort te slagen');
  assertEq(store.getState().tasks.find((t) => t.id === childId)?.taskType, 'LOGISTIC', 'kind hoort taskType van de ouder over te nemen');
});

test('draft.addTask: expliciete taskType wint van de ouder', () => {
  const parentId = store.getState().addTask({ name: 'mcp-ouder-2', taskType: 'LOGISTIC' });

  let childId = '';
  const res = runInMcpTransaction(() => {
    childId = draft.addTask({ name: 'mcp-kind-2', parentId, taskType: 'DEMOLITION' });
  });

  assert(res.ok, 'transactie hoort te slagen');
  assertEq(store.getState().tasks.find((t) => t.id === childId)?.taskType, 'DEMOLITION', 'expliciete taskType hoort te winnen van de ouder');
});
```

- [ ] **Step 2: Run de test om te bevestigen dat hij faalt**

Run: `bash tests/mcp/run.sh cases-draft.ts`
Expected: FAIL op de eerste nieuwe test (`kind hoort taskType van de ouder over te nemen` — krijgt nu `CONSTRUCTION` i.p.v. `LOGISTIC`). De tweede nieuwe test slaagt al (expliciete waarde werkte al).

- [ ] **Step 3: Implementeer de minimale wijziging**

In `src/state/mcpTransaction.ts`, regel 169-184, huidige code:

```ts
  addTask(partial: Partial<Task> & { name: string }): string {
    const id = generateId('task');
    useAppStore.setState((s) => {
      const now = s.project.startDate || formatDate(new Date());
      const parentId = partial.parentId ?? null;
      // Onbekende parentId ⇒ herkenbare fout (VÓÓR enige mutatie, dus geen halve state).
      if (parentId !== null && !s.tasks.some((t) => t.id === parentId)) {
        throw new Error(`draft.addTask: onbekende parentId '${parentId}'`);
      }

      const task: Task = {
        id,
        name: partial.name,
        description: partial.description || '',
        wbsCode: partial.wbsCode || '',
        taskType: partial.taskType || (s.ui.constructionMode ? 'CONSTRUCTION' : 'USERDEFINED'),
```

Vervang door:

```ts
  addTask(partial: Partial<Task> & { name: string }): string {
    const id = generateId('task');
    useAppStore.setState((s) => {
      const now = s.project.startDate || formatDate(new Date());
      const parentId = partial.parentId ?? null;
      // Onbekende parentId ⇒ herkenbare fout (VÓÓR enige mutatie, dus geen halve state).
      const parentTask = parentId !== null ? s.tasks.find((t) => t.id === parentId) : undefined;
      if (parentId !== null && !parentTask) {
        throw new Error(`draft.addTask: onbekende parentId '${parentId}'`);
      }

      const task: Task = {
        id,
        name: partial.name,
        description: partial.description || '',
        wbsCode: partial.wbsCode || '',
        // Overerving (2026-08-14): zie taskSlice.ts addTask — zelfde regel, MCP-pad (ook gebruikt
        // door draft.addTasks, die top-down per item deze functie aanroept).
        taskType: partial.taskType || parentTask?.taskType || (s.ui.constructionMode ? 'CONSTRUCTION' : 'USERDEFINED'),
```

- [ ] **Step 4: Run de test om te bevestigen dat hij slaagt**

Run: `bash tests/mcp/run.sh cases-draft.ts`
Expected: PASS — alle tests in dit bestand groen.

- [ ] **Step 5: Volledige MCP-suite + typecheck**

Run: `bash tests/mcp/run.sh && npm run typecheck`
Expected: alle `cases-*.ts` groen, geen typefouten.

- [ ] **Step 6: Commit**

```bash
git add src/state/mcpTransaction.ts tests/mcp/cases-draft.ts
git commit -m "feat(mcp): draft.addTask erft taskType van de ouder bij aanmaken (AI-pad)"
```

---

### Task 3: Regressietest — geneste batch (`draft.addTasks`) erft transitief

**Doel van deze taak:** `draft.addTasks` roept top-down per item `draft.addTask` aan (zie `mcpTransaction.ts:296-307`) — met de fix uit Task 2 erft een geneste batch dus al automatisch, óók wanneer de ouder een `tempId` binnen dezelfde aanroep is (die ouder bestaat al in `s.tasks` tegen de tijd dat zijn kind wordt verwerkt). Er is hier **geen productiecode-wijziging** nodig — deze taak legt dat gedrag vast als regressietest, zodat het niet stilzwijgend kan wegvallen als `addTasks` ooit wordt herschreven.

**Files:**
- Test: `tests/mcp/cases-bulk.ts` (nieuwe test aan het einde, vóór `await run();`)

- [ ] **Step 1: Schrijf de test**

Open `tests/mcp/cases-bulk.ts`. Voeg vlak vóór de laatste regel (`await run();`) de volgende test toe:

```ts
// --- 9) taskType-overerving: geneste batch (net-aangemaakte tempId-ouder telt al mee) --------------
test('draft.addTasks: taskType erft door de keten van tempId-ouder naar kind naar kleinkind', () => {
  let map = new Map<string, string>();
  const res = runInMcpTransaction(() => {
    map = draft.addTasks([
      { tempId: 'a', name: 'erf-niveau1', taskType: 'LOGISTIC' },
      { tempId: 'b', name: 'erf-niveau2', parentId: 'a' },
      { tempId: 'c', name: 'erf-niveau3', parentId: 'b', taskType: 'DEMOLITION' },
    ]);
  });

  assert(res.ok, 'transactie hoort te slagen');
  const idA = map.get('a')!;
  const idB = map.get('b')!;
  const idC = map.get('c')!;
  assertEq(store.getState().tasks.find((t) => t.id === idA)?.taskType, 'LOGISTIC', 'niveau1 behoudt zijn expliciete taskType');
  assertEq(store.getState().tasks.find((t) => t.id === idB)?.taskType, 'LOGISTIC', 'niveau2 zonder eigen taskType erft van de net-aangemaakte tempId-ouder (a)');
  assertEq(store.getState().tasks.find((t) => t.id === idC)?.taskType, 'DEMOLITION', 'niveau3 met een expliciete taskType wint van zijn ouder (b)');
});
```

- [ ] **Step 2: Run de test**

Run: `bash tests/mcp/run.sh cases-bulk.ts`
Expected: PASS meteen (Task 2 heeft de onderliggende functie al gefixt — dit is een bevestigingstest, geen TDD-rood/groen-cyclus).

- [ ] **Step 3: Volledige testsuite**

Run: `npm run test`
Expected: alle vier de suites (`test:planning`, `test:library`, `test:mcp`, `test:dev-server`) groen, exitcode 0.

- [ ] **Step 4: Commit**

```bash
git add tests/mcp/cases-bulk.ts
git commit -m "test(mcp): dek taskType-overerving in geneste draft.addTasks-batches"
```

---

### Task 4: Volledige verify-poort

**Files:** geen wijzigingen — alleen verificatie.

- [ ] **Step 1: Draai de volledige CI-poort**

Run: `npm run verify`
Expected: exitcode 0 (typecheck, lint, alle testsuites, examples, docs, i18n, cycles, audit).

- [ ] **Step 2: Geen verdere actie nodig**

Er is geen documentatie-update nodig (dit is een default-waardewijziging, geen nieuw zichtbaar UI-element) en geen wijziging aan `DOCUMENT_FIELDS`/het documentcontract (het gedrag zit volledig in bestaande velden). Als `npm run verify` groen is, is de feature compleet.
