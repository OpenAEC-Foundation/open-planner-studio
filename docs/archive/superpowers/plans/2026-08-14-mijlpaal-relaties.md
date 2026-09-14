# Mijlpaal-relaties vrijgeven en spookrelaties dichten — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een relatie kunnen slepen vanaf een mijlpaal, en relaties met een verzameltaak als eindpunt overal weigeren bij het aanmaken terwijl bestaande exemplaren behouden en zichtbaar gemarkeerd worden.

**Architecture:** Eén pure bladmodule `src/state/relationRules.ts` bevat de regels; vijf plekken lezen eruit (twee `addSequence`-implementaties, de meldingswrapper, de MCP-classificatie, de paneelmarkering). De renderer krijgt een aparte hittest `getRelationSourceAt()` náást `getTaskBarBounds()`, zodat mijlpalen wél een relatie-sleep armen maar níét versleepbaar/resizebaar worden. Bestaande spookrelaties worden niet gefilterd of gemigreerd: de markering is afgeleid uit `childIds` en rekent live mee.

**Tech Stack:** TypeScript (strict, `noUnusedLocals`), React 19, Zustand + Immer, Canvas 2D-renderer, react-i18next (14 locales), esbuild-gebundelde node-tests.

**Spec:** [docs/superpowers/specs/2026-08-14-mijlpaal-relaties-design.md](../specs/2026-08-14-mijlpaal-relaties-design.md)

---

## Bestandsoverzicht

| bestand | actie | verantwoordelijkheid |
|---|---|---|
| `src/state/relationRules.ts` | **nieuw** | Pure regels: is een relatie toegestaan, en heeft ze een verzameltaak-eindpunt |
| `src/state/slices/sequenceSlice.ts` | wijzigen | Handhaving; retourtype `string \| null` |
| `src/state/relationActions.ts` | wijzigen | Melding kiezen op basis van het verdict; `length`-truc weg |
| `src/state/mcpTransaction.ts` | wijzigen | Handhaving in de snapshot-vrije variant |
| `src/services/mcp/tools/taskTools.ts` | wijzigen | Zachte weigering in `classifyDeps` |
| `src/engine/renderer/GanttRenderer.ts` | wijzigen | Nieuwe hittest `getRelationSourceAt()` |
| `src/components/canvas/GanttCanvas.tsx` | wijzigen | Relatie-sleep armt op de nieuwe hittest |
| `src/components/panels/RelationsPanel.tsx` | wijzigen | Markering via de bestaande `warnings`-array |
| `src/state/slices/fileSlice.ts` | wijzigen | Samenvattende melding in `applyLoadedProject` |
| `src/extensions/types.ts` | wijzigen | `addSequence` retourneert `string \| null` |
| `src/i18n/locales/*/common.json` (14×) | wijzigen | 2 nieuwe `notifications.*`-sleutels |
| `src/i18n/locales/*/task.json` (14×) | wijzigen | 1 nieuwe `relations.*`-sleutel |
| `tests/planning/check-relation-rules.ts` | **nieuw** | Regelmatrix + store-integratie |
| `tests/planning/check-renderer-dateless.ts` | uitbreiden | Hittest-assertions (harnas staat er al) |
| `tests/planning/run.sh` | wijzigen | Nieuwe check registreren |
| `tests/mcp/cases-update-dependencies.ts` | uitbreiden | Zachte weigering + mijlpaal-acceptatie |
| `public/docs/{nl,en}/gids-relaties-constraints.md` | uitbreiden | Uitleg voor gebruikers |
| `docs/extensions.md` | wijzigen | Gewijzigd retourtype |

### Achtergrond die je nodig hebt

- **Waarom een verzameltaak-relatie niets doet:** `runCPM` (`src/state/slices/scheduleSlice.ts`) geeft alleen bladtaken aan de solver: `s.tasks.filter(t => t.childIds.length === 0)`. `CPMSolver` leest relaties in met `this.successors.get(seq.predecessorId)?.push(seq)` — een verzameltaak staat niet in die map, dus de relatie verdwijnt geruisloos.
- **Waarom mijlpalen wél mogen:** een mijlpaal is een bladtaak (`childIds` leeg) en zit dus gewoon in de solver, met eigen START/FINISH-relatiewiskunde in `src/engine/scheduler/relationMath.ts`.
- **`verify:i18n` is een harde poort:** elke locale moet compleet zijn t.o.v. `nl`. Een sleutel toevoegen aan `nl` zonder de andere dertien maakt de suite rood. Daarom staan alle nieuwe sleutels in één taak (Taak 2), vóór het eerste gebruik.
- **Geen plurals gebruiken:** de aantal-melding gebruikt bewust `{{total}}` en niet `{{count}}`. i18next schakelt bij `count` automatisch naar pluralvormen, en dan eist `verify:i18n` CLDR-categorieën per taal (`pl` heeft `few`/`many`, `zh`/`ja`/`ko` hebben géén `one`). Met `{{total}}` is het één platte sleutel per taal.
- **Tests draaien via esbuild-bundels, geen testrunner.** Een `check-*.ts` is een script dat `process.exit(0|1)` doet. `tests/planning/run.sh` bundelt en draait ze. **De suite print "alles groen" ook bij exit 1 als het bundelen faalt — vertrouw op de exitcode, nooit op de tail.**

---

## Taak 1: De regelmodule

> **Bijgesteld na de kwaliteitsreview.** De code hieronder is de oorspronkelijke opzet met een
> `ReadonlyMap`-parameter en een `taskMapOf`-helper. Die is vervangen door een `TaskLookup`-functie
> (`(id: string) => Task | undefined`) en `taskMapOf` is geschrapt: een Map eisen dwong élke
> aanroeper er een te bouwen — per aanroep, in `sequenceSlice`/`mcpTransaction` zelfs over een
> Immer-draft, wat ook nog elke child-proxy materialiseert, en in een `planner_batch`-lus per
> relatie. Het Relaties-paneel heeft bovendien al een eigen `taskById`-`useMemo`. Er kwamen vier
> checks bij (19 → 23) voor mutaties die eerder ongemerkt passeerden. Taken 3, 4, 7 en 8 hieronder
> zijn al op de definitieve vorm gezet; raadpleeg voor de module zelf de code in de repo.

**Files:**
- Create: `src/state/relationRules.ts`
- Create: `tests/planning/check-relation-rules.ts`
- Modify: `tests/planning/run.sh`

- [ ] **Stap 1: Schrijf de falende test**

Maak `tests/planning/check-relation-rules.ts`:

```ts
// Regressie voor de relatieregels (spec 2026-08-14). Twee dingen die eerder stil misgingen:
//
//   1. Een relatie MET een mijlpaal als eindpunt werd door de Gantt-hittest geweigerd, terwijl de
//      solver mijlpalen volledig ondersteunt. Dit bestand verankert dat de regels ze toestaan.
//   2. Een relatie met een VERZAMELTAAK als eindpunt werd overal geaccepteerd maar door de solver
//      weggegooid (die krijgt alleen bladtaken) — een spookrelatie.
//
// Draait via run.sh. Exit 0 = alles groen.

import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import { relationVerdict, hasSummaryEndpoint } from '@/state/relationRules';

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

// ── Minimale taak-stubs: de regels lezen alleen `id` en `childIds`. ──────────
function task(id: string, childIds: string[] = []): Task {
  return { id, name: id, childIds } as unknown as Task;
}

const leafA = task('a');
const leafB = task('b');
const milestone = { ...task('m'), isMilestone: true } as Task;
const summary = task('s', ['a']);

const byId = new Map<string, Task>([
  [leafA.id, leafA], [leafB.id, leafB], [milestone.id, milestone], [summary.id, summary],
]);

const noSeqs: Sequence[] = [];
const FS = 'FINISH_START' as const;

// ── hasSummaryEndpoint ───────────────────────────────────────────────────────
ok('blad→blad telt als verzameltaak-eindpunt',
  !hasSummaryEndpoint(byId, { predecessorId: 'a', successorId: 'b' }));
ok('MIJLPAAL als voorganger telt als verzameltaak-eindpunt (regressie-anker)',
  !hasSummaryEndpoint(byId, { predecessorId: 'm', successorId: 'b' }));
ok('MIJLPAAL als opvolger telt als verzameltaak-eindpunt (regressie-anker)',
  !hasSummaryEndpoint(byId, { predecessorId: 'a', successorId: 'm' }));
ok('verzameltaak als voorganger niet herkend',
  hasSummaryEndpoint(byId, { predecessorId: 's', successorId: 'b' }));
ok('verzameltaak als opvolger niet herkend',
  hasSummaryEndpoint(byId, { predecessorId: 'a', successorId: 's' }));

// Retroactief: een bladtaak die alsnog een kind krijgt is vanaf dat moment een verzameltaak.
// Dit is de reden dat de markering AFGELEID is en niet opgeslagen.
const promoted = new Map(byId);
promoted.set('b', task('b', ['nieuw-kind']));
ok('retroactief: blad met nieuw kind niet als verzameltaak herkend',
  hasSummaryEndpoint(promoted, { predecessorId: 'a', successorId: 'b' }));

// ── relationVerdict ──────────────────────────────────────────────────────────
const verdict = (p: string, s: string, seqs: Sequence[] = noSeqs) =>
  relationVerdict(byId, seqs, { predecessorId: p, successorId: s, type: FS });

ok('blad→blad wordt niet toegestaan', verdict('a', 'b').ok);
ok('mijlpaal→blad wordt niet toegestaan (regressie-anker)', verdict('m', 'b').ok);
ok('blad→mijlpaal wordt niet toegestaan (regressie-anker)', verdict('a', 'm').ok);

const summaryV = verdict('s', 'b');
ok('verzameltaak-eindpunt niet geweigerd', !summaryV.ok);
ok('verzameltaak-eindpunt met verkeerde reden',
  !summaryV.ok && summaryV.reason === 'summary-endpoint');

const selfV = verdict('a', 'a');
ok('zelfrelatie niet geweigerd', !selfV.ok);
ok('zelfrelatie met verkeerde reden', !selfV.ok && selfV.reason === 'self');

const unknownV = verdict('a', 'bestaat-niet');
ok('onbekende taak niet geweigerd', !unknownV.ok);
ok('onbekende taak met verkeerde reden', !unknownV.ok && unknownV.reason === 'unknown-task');

const existing: Sequence[] = [
  { id: 'seq1', predecessorId: 'a', successorId: 'b', type: FS, lagDays: 0 },
];
const dupV = verdict('a', 'b', existing);
ok('duplicaat niet geweigerd', !dupV.ok);
ok('duplicaat met verkeerde reden', !dupV.ok && dupV.reason === 'duplicate');
ok('ander type tussen hetzelfde paar geweigerd (mag juist wél)',
  relationVerdict(byId, existing, { predecessorId: 'a', successorId: 'b', type: 'START_START' }).ok);

// Volgorde van de regels: een verzameltaak-eindpunt dat óók een duplicaat is meldt het
// inhoudelijke probleem, niet het duplicaat.
const both: Sequence[] = [
  { id: 'seq2', predecessorId: 's', successorId: 'b', type: FS, lagDays: 0 },
];
const bothV = verdict('s', 'b', both);
ok('verzameltaak+duplicaat meldt duplicaat i.p.v. het inhoudelijke probleem',
  !bothV.ok && bothV.reason === 'summary-endpoint');

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  relation-rules: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  relation-rules: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
```

Registreer hem in `tests/planning/run.sh`. Zoek de regel:

```bash
  if bundle_check "$DIR/check-renderer-dateless.ts" "$RDCHECK"; then node "$RDCHECK" || STATUS=1; fi
```

en zet er direct ná:

```bash
  RELRULES="$DIR/.relrules.mjs"
  if bundle_check "$DIR/check-relation-rules.ts" "$RELRULES"; then node "$RELRULES" || STATUS=1; fi
```

- [ ] **Stap 2: Draai de test en controleer dat hij faalt**

Run: `bash tests/planning/run.sh 2>&1 | grep -i "relation-rules\|bundelen mislukt"`
Expected: `XX  bundelen mislukt: check-relation-rules.ts` — `@/state/relationRules` bestaat nog niet.

- [ ] **Stap 3: Schrijf de module**

Maak `src/state/relationRules.ts`:

```ts
import type { Task } from '@/types/task';
import type { Sequence, SequenceType } from '@/types/sequence';

/**
 * De regels voor het aanmaken van een relatie, op één plek.
 *
 * Waarom dit een eigen BLADMODULE is: hij importeert bewust niets uit `slices/` of `appStore`.
 * Zou hij dat wel doen, dan ontstaat de cyclus `sequenceSlice → relationRules → appStore →
 * sequenceSlice` en slaat `npm run verify:cycles` aan. Zelfde reden als bij `state/defaults.ts`.
 *
 * Waarom hij bestaat: de dedup-regel stond in twee handgeschreven kopieën (`sequenceSlice` en
 * `mcpTransaction`), en de validatie die dit ontwerp toevoegt zou daar een derde en vierde kopie
 * van maken. Dat is precies het duplicatiepatroon dat elders in deze codebase is opgeruimd
 * (het documentcontract, `applyCpmResult`) — en het bijt hier direct: zou de validatie alleen in
 * de slice-actie staan, dan is de MCP-laag het gat waardoor de bug binnenkomt die we dichten.
 */

export interface RelationEndpoints {
  predecessorId: string;
  successorId: string;
}

export type RelationRejection = 'self' | 'unknown-task' | 'summary-endpoint' | 'duplicate';

export type RelationVerdict = { ok: true } | { ok: false; reason: RelationRejection };

const OK: RelationVerdict = { ok: true };

/**
 * Heeft deze relatie een eindpunt zonder effect op de planning?
 *
 * `runCPM` geeft alleen BLADtaken aan de solver (`tasks.filter(t => t.childIds.length === 0)`) en
 * `CPMSolver` leest relaties in met optional chaining, dus een verzameltaak-eindpunt betekent dat
 * de relatie stil wordt weggegooid — een spookrelatie: opgeslagen, getekend, geëxporteerd, zonder
 * enig effect.
 *
 * MIJLPALEN ZIJN EXPLICIET WÉL TOEGESTAAN. Een mijlpaal is een bladtaak met duur 0; de solver
 * ondersteunt hem volledig als voorganger én opvolger. Dat hij in de Gantt geen relatie kon armen
 * was een neveneffect van een hittest die voor slepen/resizen geschreven is.
 *
 * Aparte functie náást `relationVerdict` omdat de paneelmarkering hem per BESTAANDE rij nodig
 * heeft: daar is `relationVerdict` onbruikbaar, want elke bestaande relatie is haar eigen duplicaat.
 */
export function hasSummaryEndpoint(
  byId: ReadonlyMap<string, Task>,
  seq: RelationEndpoints,
): boolean {
  const pred = byId.get(seq.predecessorId);
  const succ = byId.get(seq.successorId);
  return (pred?.childIds.length ?? 0) > 0 || (succ?.childIds.length ?? 0) > 0;
}

/**
 * Mag deze NIEUWE relatie erbij? Volgorde is bewust: structurele problemen eerst, duplicaat als
 * laatste — een verzameltaak-relatie die toevallig ook al bestaat moet het inhoudelijke probleem
 * melden, niet "bestaat al".
 */
export function relationVerdict(
  byId: ReadonlyMap<string, Task>,
  sequences: readonly Sequence[],
  seq: RelationEndpoints & { type: SequenceType },
): RelationVerdict {
  if (seq.predecessorId === seq.successorId) return { ok: false, reason: 'self' };
  if (!byId.has(seq.predecessorId) || !byId.has(seq.successorId)) {
    return { ok: false, reason: 'unknown-task' };
  }
  if (hasSummaryEndpoint(byId, seq)) return { ok: false, reason: 'summary-endpoint' };
  // Exacte duplicaten weren, maar meerdere TYPES tussen hetzelfde paar blijven toegestaan
  // (bv. SS+FF als ladder-koppeling) — anders verdwijnt de tweede relatie stil.
  const exists = sequences.some(
    (e) => e.predecessorId === seq.predecessorId
      && e.successorId === seq.successorId
      && e.type === seq.type,
  );
  return exists ? { ok: false, reason: 'duplicate' } : OK;
}

/** Bouwt de id→taak-map die beide functies verwachten. */
export function taskMapOf(tasks: readonly Task[]): ReadonlyMap<string, Task> {
  return new Map(tasks.map((t) => [t.id, t]));
}
```

- [ ] **Stap 4: Draai de test en controleer dat hij slaagt**

Run: `bash tests/planning/run.sh 2>&1 | grep "relation-rules"`
Expected: `OK  relation-rules: alle checks groen (19)`

Draai daarna de hele suite om te bevestigen dat je niets anders hebt geraakt:
Run: `npm run test:planning; echo "exit=$?"`
Expected: `exit=0`

- [ ] **Stap 5: Committen**

```bash
git add src/state/relationRules.ts tests/planning/check-relation-rules.ts tests/planning/run.sh
git commit -m "feat(relaties): pure regelmodule voor relatie-validatie

Eén bron voor: zelfrelatie, onbekende taak, verzameltaak-eindpunt en
duplicaat. Bladmodule (importeert niets uit slices/ of appStore) om de
cyclus relationRules -> appStore -> sequenceSlice te vermijden.

Mijlpalen zijn expliciet toegestaan; dat is met twee assertions
verankerd, want dat is de bug die dit ontwerp repareert."
```

---

## Taak 2: Alle i18n-sleutels in één keer, in alle veertien locales

Deze taak staat vóór elk gebruik omdat `verify:i18n` (onderdeel van `npm run verify`) hard eist dat elke locale compleet is t.o.v. `nl`. Een sleutel toevoegen in `nl` en de rest later doen maakt de poort rood bij elke tussenliggende commit.

**Files:**
- Modify: `src/i18n/locales/{nl,en,de,fr,es,it,pt,pl,tr,zh,ja,ko,ar,fa}/common.json`
- Modify: `src/i18n/locales/{nl,en,de,fr,es,it,pt,pl,tr,zh,ja,ko,ar,fa}/task.json`

- [ ] **Stap 1: Voeg twee sleutels toe aan het `notifications`-blok van elke `common.json`**

Naast de bestaande `relationCreated` / `relationDuplicate` (nl/en regel 16-17).

**Let op `{{total}}` en niet `{{count}}`:** i18next schakelt bij de naam `count` automatisch naar pluralvormen, en dan eist `verify:i18n` CLDR-categorieën per taal (`pl` heeft `few`/`many`, `zh`/`ja`/`ko` hebben géén `one`). Met `{{total}}` blijft het één platte sleutel per taal.

| locale | `relationSummaryEndpoint` | `summaryRelationsIgnored` |
|---|---|---|
| nl | `Een samenvattingstaak als eindpunt heeft geen effect op de planning. Koppel aan een taak zonder subtaken.` | `{{total}} relatie(s) op samenvattingstaken hebben geen effect op de planning.` |
| en | `A summary task as endpoint has no effect on the schedule. Link to a task without subtasks.` | `{{total}} relation(s) on summary tasks have no effect on the schedule.` |
| de | `Eine Sammelaufgabe als Endpunkt hat keine Auswirkung auf den Terminplan. Verknüpfen Sie sie mit einer Aufgabe ohne Unteraufgaben.` | `{{total}} Beziehung(en) an Sammelaufgaben haben keine Auswirkung auf den Terminplan.` |
| fr | `Une tâche récapitulative comme extrémité n'a aucun effet sur le planning. Reliez-la plutôt à une tâche sans sous-tâches.` | `{{total}} relation(s) sur des tâches récapitulatives n'ont aucun effet sur le planning.` |
| es | `Una tarea de resumen como extremo no afecta a la planificación. Vincúlela a una tarea sin subtareas.` | `{{total}} relación(es) en tareas de resumen no afectan a la planificación.` |
| it | `Un'attività di riepilogo come estremità non ha effetto sulla pianificazione. Collegala a un'attività senza sottoattività.` | `{{total}} relazione/i su attività di riepilogo non hanno effetto sulla pianificazione.` |
| pt | `Uma tarefa de resumo como extremidade não tem efeito na planificação. Ligue-a a uma tarefa sem subtarefas.` | `{{total}} relação(ões) em tarefas de resumo não têm efeito na planificação.` |
| pl | `Zadanie sumaryczne jako punkt końcowy nie ma wpływu na harmonogram. Połącz z zadaniem bez podzadań.` | `Relacje na zadaniach sumarycznych bez wpływu na harmonogram: {{total}}.` |
| tr | `Uç nokta olarak bir özet görev planlamayı etkilemez. Alt görevi olmayan bir göreve bağlayın.` | `Özet görevlerdeki {{total}} ilişki planlamayı etkilemiyor.` |
| zh | `以摘要任务作为端点对计划没有影响。请链接到没有子任务的任务。` | `{{total}} 条位于摘要任务上的关系对计划没有影响。` |
| ja | `サマリータスクを端点にしてもスケジュールには影響しません。サブタスクのないタスクにリンクしてください。` | `サマリータスク上の {{total}} 件の関係はスケジュールに影響しません。` |
| ko | `요약 작업을 끝점으로 사용해도 일정에 영향을 주지 않습니다. 하위 작업이 없는 작업에 연결하세요.` | `요약 작업의 관계 {{total}}개는 일정에 영향을 주지 않습니다.` |
| ar | `المهمة الموجزة كنقطة نهاية لا تؤثر في الجدول الزمني. اربطها بمهمة بدون مهام فرعية.` | `عدد العلاقات المرتبطة بمهام موجزة والتي لا تؤثر في الجدول الزمني: {{total}}.` |
| fa | `وظیفه خلاصه به عنوان نقطه پایانی تأثیری بر زمان‌بندی ندارد. به وظیفه‌ای بدون زیروظیفه پیوند دهید.` | `{{total}} رابطه روی وظایف خلاصه بر زمان‌بندی تأثیری ندارد.` |

**Terminologie:** de `nl`-tekst gebruikt "samenvattingstaak" (de gevestigde gebruikersterm, o.a. `menu.json`, `task.json`, `public/docs/nl/ref-taakdialoog.md`) en niet "verzameltaak" — dat laatste is intern jargon dat in code blijft staan (bv. `src/state/relationRules.ts`), maar hoort niet in gebruikerzichtbare tekst. De `de`-tekst gebruikt "Sammelaufgabe" (gevestigd, o.a. `menu.json`, `task.json`) in plaats van "Sammelvorgang", en "Beziehung" (de gevestigde term voor een relatie, naast `relationCreated`/`relationDuplicate`) in plaats van "Verknüpfung" — dat laatste is in dit bestand al de term voor de externe, projectoverschrijdende koppelingen. De `zh`-tekst gebruikt "无影响" (geen effect) in plaats van "无效" (ongeldig) — de relaties blijven bestaan, ze tellen alleen niet mee in de berekening.

Voorbeeld voor `src/i18n/locales/nl/common.json`:

```json
    "relationCreated": "Relatie aangemaakt: {{predecessor}} → {{successor}}",
    "relationDuplicate": "Deze relatie bestaat al",
    "relationSummaryEndpoint": "Een samenvattingstaak als eindpunt heeft geen effect op de planning. Koppel aan een taak zonder subtaken.",
    "summaryRelationsIgnored": "{{total}} relatie(s) op samenvattingstaken hebben geen effect op de planning."
```

- [ ] **Stap 2: Voeg één sleutel toe aan het `relations`-blok van elke `task.json`**

Naast de bestaande `warnTruncatedLead`.

| locale | `warnSummaryEndpoint` |
|---|---|
| nl | `Zonder effect: samenvattingstaak als eindpunt` |
| en | `No effect: summary task as endpoint` |
| de | `Ohne Wirkung: Sammelaufgabe als Endpunkt` |
| fr | `Sans effet : tâche récapitulative comme extrémité` |
| es | `Sin efecto: tarea de resumen como extremo` |
| it | `Senza effetto: attività di riepilogo come estremità` |
| pt | `Sem efeito: tarefa de resumo como extremidade` |
| pl | `Bez wpływu: zadanie sumaryczne jako punkt końcowy` |
| tr | `Etkisiz: uç nokta olarak özet görev` |
| zh | `无影响：摘要任务作为端点` |
| ja | `効果なし: 端点がサマリータスク` |
| ko | `효과 없음: 끝점이 요약 작업` |
| ar | `بلا تأثير: مهمة موجزة كنقطة نهاية` |
| fa | `بدون تأثیر: وظیفه خلاصه به عنوان نقطه پایانی` |

- [ ] **Stap 3: Draai de i18n-poort**

Run: `npm run verify:i18n; echo "exit=$?"`
Expected: `exit=0` — geen enkele ontbrekende sleutel gemeld.

Als er iets ontbreekt noemt de uitvoer locale + sleutel; vul die aan en draai opnieuw.

- [ ] **Stap 4: Committen**

```bash
git add src/i18n/locales
git commit -m "i18n: sleutels voor verzameltaak-relatiemeldingen in 14 locales

Bewust {{total}} en niet {{count}}: i18next schakelt bij count naar
pluralvormen, waarna verify:i18n CLDR-categorieen per taal eist (pl
few/many, zh/ja/ko geen one). Platte sleutel is hier genoeg."
```

---

## Taak 3: Handhaving in de store-actie en de meldingswrapper

**Files:**
- Modify: `src/state/slices/sequenceSlice.ts:8` (interface) en `:18-32` (actie)
- Modify: `src/state/relationActions.ts`
- Modify: `src/extensions/types.ts:135`
- Test: `tests/planning/check-relation-rules.ts` (uitbreiden)

- [ ] **Stap 1: Schrijf de falende test**

Voeg toe aan `tests/planning/check-relation-rules.ts`, direct vóór het `// ── Uitslag ──`-blok. Deze checks draaien tegen de ECHTE store, net als de andere planningtests:

Zet `import { useAppStore } from '@/state/appStore';` bij de bestaande imports bovenaan het bestand — niet midden in de code, ook al staat ESM dat toe.

```ts
// ── Store-integratie: de slice-actie handhaaft dezelfde regels ────────────────
const S = () => useAppStore.getState();

S().newProject();
const fase = S().addTask({ name: 'Fase' });
const kind = S().addTask({ name: 'Kind', parentId: fase });
const los = S().addTask({ name: 'Los' });
const mp = S().addTask({ name: 'Mijlpaal', isMilestone: true });

const seqCountBefore = S().sequences.length;
const summaryId = S().addSequence({ predecessorId: fase, successorId: los, type: FS, lagDays: 0 });
ok('addSequence maakt een verzameltaak-relatie aan (verwacht null)', summaryId === null);
ok('addSequence muteerde de store ondanks weigering',
  S().sequences.length === seqCountBefore);

const msId = S().addSequence({ predecessorId: mp, successorId: los, type: FS, lagDays: 0 });
ok('addSequence weigert een MIJLPAAL als voorganger (regressie-anker)', msId !== null);

const kindId = S().addSequence({ predecessorId: kind, successorId: los, type: FS, lagDays: 0 });
ok('addSequence weigert een SUBTAAK zonder eigen kinderen', kindId !== null);

// Een geweigerde relatie mag geen undo-stap achterlaten (zelfde regel als bij duplicaten, R3).
const undoDepth = S().undoStack.length;
S().addSequence({ predecessorId: fase, successorId: los, type: 'START_START', lagDays: 0 });
ok('geweigerde relatie duwt tóch een undo-snapshot', S().undoStack.length === undoDepth);
```

**Let op:** `addTask` retourneert het nieuwe id. Controleer die aanname in `src/state/slices/taskSlice.ts` voordat je verdergaat; wijkt de signatuur af, pas dan de test aan (niet de slice).

- [ ] **Stap 2: Draai de test en controleer dat hij faalt**

Run: `bash tests/planning/run.sh 2>&1 | grep "relation-rules"`
Expected: `XX  relation-rules: 3 afwijking(en) van 24` — de drie weigering-checks falen, want `addSequence` retourneert nog altijd een id.

- [ ] **Stap 3: Pas de slice aan**

In `src/state/slices/sequenceSlice.ts`, wijzig de interface-regel:

```ts
  /** Retourneert het nieuwe id, of `null` wanneer de relatie geweigerd is (duplicaat, zelfrelatie,
   *  onbekende taak, of een verzameltaak als eindpunt — zie `relationRules.ts`). */
  addSequence: (seq: Omit<Sequence, 'id'>) => string | null;
```

Voeg de import toe bovenaan:

```ts
import { relationVerdict } from '../relationRules';
```

En vervang de actie. Let op de **lookup-functie** in plaats van een Map: `s.tasks` is hier een Immer-draft, en een Map bouwen zou elke child-proxy materialiseren.

```ts
  addSequence: (seq) => {
    const id = generateId('seq');
    let accepted = false;
    set((s) => {
      // Alle regels (dedup, zelfrelatie, onbekende taak, verzameltaak-eindpunt) staan in
      // relationRules.ts — één bron, gedeeld met mcpTransaction en de meldingswrapper.
      const lookup = (tid: string) => s.tasks.find((t) => t.id === tid);
      if (!relationVerdict(lookup, s.sequences, seq).ok) return; // geen snapshot, geen loze undo-stap (R3).
      beginUndoable(s); // snapshot pas ná de guard, vóór de mutatie (zie transaction.ts).
      s.sequences.push({ ...seq, id });
      finishMutation(s, { stale: true }); // nieuwe relatie (A6): planning verouderd tot F5.
      accepted = true;
    });
    return accepted ? id : null;
  },
```

Werk het extensie-contract bij in `src/extensions/types.ts` (regel 135):

```ts
    /** Retourneert het nieuwe relatie-id, of `null` wanneer de relatie geweigerd is. */
    addSequence(seq: Omit<ExtSequence, 'id'>): string | null;
```

- [ ] **Stap 4: Pas de meldingswrapper aan**

Vervang in `src/state/relationActions.ts` de body van `createRelationWithFeedback`. De docstring erboven moet mee — de `length`-truc die hij beschrijft bestaat straks niet meer:

```ts
import { useAppStore } from '@/state/appStore';
import { relationVerdict, type RelationRejection } from '@/state/relationRules';
import type { SequenceType } from '@/types/sequence';

/** Namen in een melding blijven leesbaar: langere taaknamen worden afgekapt. */
const MAX_NAME = 40;
const shortName = (name: string | undefined) =>
  !name ? '?' : name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 1)}…` : name;

/** Welke melding hoort bij een weigering? `self`/`unknown-task` zijn via de UI niet te maken
 *  (de gebaren selecteren bestaande, verschillende taken) — die vallen op de duplicaat-tekst
 *  terug in plaats van een eigen sleutel te eisen die nooit in beeld komt. */
const REJECTION_MESSAGE: Record<RelationRejection, string> = {
  duplicate: 'notifications.relationDuplicate',
  'summary-endpoint': 'notifications.relationSummaryEndpoint',
  self: 'notifications.relationDuplicate',
  'unknown-task': 'notifications.relationDuplicate',
};

/**
 * Relatie aanmaken MÉT gebruikerszichtbare terugkoppeling (issue #40).
 *
 * Waarom deze wrapper bestaat: `addSequence` weigert stil (geen mutatie, geen undo-stap). Alle drie
 * de callsites die met één gebaar een Eind-Start-relatie leggen (de lint-knop bij 2 selecties, de
 * knop in het Relaties-paneel, en het slepen in de Gantt) hadden daardoor exact hetzelfde symptoom
 * als de gemelde bug: er gebeurt zichtbaar niets. Hier gaat dat door één deur, met het
 * gecentraliseerde meldingenkanaal (bevinding K8) als uitgang.
 *
 * De REDEN komt uit `relationVerdict`, dezelfde pure functie die `addSequence` zelf gebruikt als
 * handhavingsgrens. Twee aanroepen van een pure functie is goedkoper dan de reden door het
 * retourtype van de store-actie heen vlechten — dat zou het extensie-API-oppervlak onnodig
 * ingewikkeld maken. De REGEL staat op één plek; alleen de aanroep staat er twee keer.
 *
 * @returns de id van de nieuwe relatie, of `null` wanneer hij geweigerd is.
 */
export function createRelationWithFeedback(
  predecessorId: string,
  successorId: string,
  type: SequenceType = 'FINISH_START',
): string | null {
  const st = useAppStore.getState();
  const lookup = (id: string) => st.tasks.find((t) => t.id === id);
  const verdict = relationVerdict(lookup, st.sequences, { predecessorId, successorId, type });
  if (!verdict.ok) {
    st.notify({
      severity: 'info',
      messageKey: REJECTION_MESSAGE[verdict.reason],
      // Samenvouwen: herhaald op dezelfde knop rammen levert één regel met een teller op.
      dedupeKey: `relation-rejected-${verdict.reason}`,
    });
    return null;
  }

  const id = st.addSequence({ predecessorId, successorId, type, lagDays: 0 });
  const after = useAppStore.getState();
  after.notify({
    severity: 'info',
    messageKey: 'notifications.relationCreated',
    params: {
      predecessor: shortName(after.tasks.find((t) => t.id === predecessorId)?.name),
      successor: shortName(after.tasks.find((t) => t.id === successorId)?.name),
    },
  });
  return id;
}
```

- [ ] **Stap 5: Draai de tests en de typecheck**

Run: `npm run typecheck; echo "exit=$?"`
Expected: `exit=0`. Faalt dit op een aanroeper die de retourwaarde als `string` gebruikt, pas die aanroeper aan — het nieuwe type is correcter.

Run: `bash tests/planning/run.sh 2>&1 | grep "relation-rules"`
Expected: `OK  relation-rules: alle checks groen (24)`

Run: `npm run test:planning; echo "exit=$?"`
Expected: `exit=0` — let vooral op `check-notifications.ts`, die het meldingenkanaal bewaakt.

- [ ] **Stap 6: Committen**

```bash
git add src/state/slices/sequenceSlice.ts src/state/relationActions.ts src/extensions/types.ts tests/planning/check-relation-rules.ts
git commit -m "fix(relaties): weiger verzameltaak-eindpunten in de store-actie

addSequence retourneert nu string|null in plaats van altijd een id. Dat
maakt de sequences.length-voor/na-truc in createRelationWithFeedback
overbodig: die bestond alleen omdat een geweigerd duplicaat toch een id
teruggaf die nergens naar verwees.

Mijlpalen en subtaken zonder eigen kinderen blijven expliciet toegestaan."
```

---

## Taak 4: Handhaving in de MCP-laag

De MCP-laag heeft twee plekken. `classifyDeps` doet de **zachte** per-item weigering (bestaat al voor onbekende id's en duplicaten); `mcpTransaction.addSequence` is de snapshot-vrije schrijfvariant en fungeert als backstop.

**Files:**
- Modify: `src/services/mcp/tools/taskTools.ts:663-692` (`classifyDeps`)
- Modify: `src/state/mcpTransaction.ts:370-383` (`addSequence`)
- Test: `tests/mcp/cases-update-dependencies.ts`

- [ ] **Stap 1: Schrijf de falende test**

Bekijk eerst de bestaande stijl: `head -60 tests/mcp/cases-update-dependencies.ts`. Volg die vorm (de harness in `tests/mcp/harness.ts` levert de case-helpers). Voeg een case toe die:

1. Een project maakt met een verzameltaak `Fase` met kind `Kind`, plus een losse taak `Los` en een mijlpaal `MP`.
2. `planner_add_dependencies` aanroept met drie items: `Fase→Los`, `MP→Los`, `Kind→Los`.
3. Assert: `added` bevat exact twee id's (die van `MP→Los` en `Kind→Los`).
4. Assert: `itemRejections` bevat één item met id `<fase>-><los>` en een `reason` die de tekst `verzameltaak` bevat.
5. Assert: `useAppStore.getState().sequences` bevat géén relatie met `predecessorId === <fase-id>`.

Punt 3 is het regressie-anker voor mijlpalen; punt 5 bewijst dat de weigering ook echt niets schrijft.

- [ ] **Stap 2: Draai de test en controleer dat hij faalt**

Run: `npm run test:mcp; echo "exit=$?"`
Expected: `exit=1`, met een faalregel over de ontbrekende weigering — `Fase→Los` wordt nu nog gewoon aangemaakt.

- [ ] **Stap 3: Voeg de weigering toe aan `classifyDeps`**

In `src/services/mcp/tools/taskTools.ts`, voeg bovenaan toe:

```ts
import { hasSummaryEndpoint } from '@/state/relationRules';
```

`classifyDeps` is de enige plek waar een Map écht loont: hij draait over een gewone (niet-draft) array en doet nu nog `st.tasks.some(...)` **per dep**. Bouw hem één keer buiten de lus, direct ná `const seen = new Set(...)` (regel 672):

```ts
  const byId = new Map(st.tasks.map((t) => [t.id, t]));
  const lookup = (id: string) => byId.get(id);
```

Vervang meteen de twee bestaan-checks (regel 684-685) door de map, zodat de lus niet twee keer lineair over alle taken loopt:

```ts
    if (!byId.has(d.predecessorId)) { rejections.push({ id: label, reason: `voorganger '${d.predecessorId}' bestaat niet` }); continue; }
    if (!byId.has(d.successorId)) { rejections.push({ id: label, reason: `opvolger '${d.successorId}' bestaat niet` }); continue; }
```

En voeg de nieuwe weigering toe direct daarná, vóór de dedup-check:

```ts
    // Verzameltaak als eindpunt: de solver krijgt alleen bladtaken, dus zo'n relatie zou stil
    // worden weggegooid. Zacht weigeren i.p.v. een spookrelatie schrijven. Mijlpalen zijn
    // bladtaken en blijven dus gewoon toegestaan.
    if (hasSummaryEndpoint(lookup, d)) {
      rejections.push({ id: label, reason: 'een verzameltaak als voorganger of opvolger heeft geen effect op de planning; koppel aan een taak zonder subtaken' });
      continue;
    }
```

Werk ook de `description` van `planner_add_dependencies` bij, zodat een AI-agent de regel kent vóór hij hem overtreedt. Zoek de zin `'Onbekende taak-id\'s of een reeds bestaande relatie worden per item zacht geweigerd; '` en vervang door:

```ts
    'Onbekende taak-id\'s, een reeds bestaande relatie, of een verzameltaak (taak MET subtaken) als ' +
    'voorganger/opvolger worden per item zacht geweigerd; '
```

- [ ] **Stap 4: Voeg de backstop toe aan `mcpTransaction`**

In `src/state/mcpTransaction.ts`, voeg de import toe:

```ts
import { relationVerdict } from './relationRules';
```

En vervang de dedup-check in `addSequence` (regel 374-378) door het gedeelde verdict. Ook hier een lookup-functie en géén Map: deze functie wordt door `planner_batch` **in een lus** aangeroepen, en een Map bouwen per relatie over een Immer-draft zou elke child-proxy materialiseren.

```ts
  addSequence(seq: Omit<Sequence, 'id'>): string | null {
    const id = generateId('seq');
    let result: string | null = null;
    useAppStore.setState((s) => {
      // Dezelfde regels als de store-actie, uit relationRules.ts. Dit was een handgeschreven kopie
      // van alleen de dedup-regel; die kopie is precies waarom validatie in de slice-actie de
      // MCP-laag zou overslaan.
      const lookup = (tid: string) => s.tasks.find((t) => t.id === tid);
      if (!relationVerdict(lookup, s.sequences, seq).ok) return; // result blijft null
      s.sequences.push({ ...seq, id });
      s.isDirty = true;
      result = id;
    });
    return result;
  },
```

**Niet aanpassen:** `updateSequence` in `sequenceSlice.ts` heeft een eigen, ándere botsingsregel (collision bij een *type-wijziging* op een bestaande relatie). Die valt buiten dit ontwerp — laat hem staan.

- [ ] **Stap 5: Draai de tests**

Run: `npm run test:mcp; echo "exit=$?"`
Expected: `exit=0`

Run: `npm run typecheck && npm run test:planning; echo "exit=$?"`
Expected: `exit=0`

- [ ] **Stap 6: Committen**

```bash
git add src/services/mcp/tools/taskTools.ts src/state/mcpTransaction.ts tests/mcp/cases-update-dependencies.ts
git commit -m "fix(mcp): weiger verzameltaak-eindpunten via de bestaande zachte weigering

classifyDeps had al een per-item weigeringsmechaniek voor onbekende id's
en duplicaten; daar sluit de nieuwe regel op aan in plaats van een eigen
foutpad te krijgen. mcpTransaction.addSequence deelt nu het verdict met
de store-actie in plaats van een eigen kopie van de dedup-regel."
```

---

## Taak 5: De renderer-hittest voor mijlpalen

**Files:**
- Modify: `src/engine/renderer/GanttRenderer.ts` (nieuwe methode náást `getTaskBarBounds`, regel ~2042)
- Test: `tests/planning/check-renderer-dateless.ts`

- [ ] **Stap 1: Schrijf de falende test**

Het testbestand heeft de harnas al: DOM-stubs, een opnemende 2D-context en een rijenlijst. Twee **gedateerde** fixtures ontbreken nog. Voeg ze toe ná de regel `const datelessMilestone = ...`:

```ts
// Gedateerde varianten voor de relatie-hittest: die moet mijlpalen WÉL accepteren (dat is de bug
// die spec 2026-08-14 repareert) en verzameltaken NIET (spookrelatie).
const datedMilestone = { ...healthy, id: 'ms-dated', isMilestone: true } as Task;
const datedSummary = { ...healthy, id: 'sum-dated', childIds: ['kind-y'] } as Task;
```

Breid de `rows`-array uit — **achteraan aanvullen**, zodat de bestaande rij-indices 0..4 en alle assertions daarover ongemoeid blijven:

```ts
const rows: ViewRow[] = [
  { kind: 'task', task: healthy, depth: 0, dimmed: false },
  { kind: 'task', task: datelessLeaf, depth: 0, dimmed: false },
  { kind: 'task', task: datelessLeafEmpty, depth: 0, dimmed: false },
  { kind: 'task', task: datelessSummary, depth: 0, dimmed: false },
  { kind: 'task', task: datelessMilestone, depth: 0, dimmed: false },
  { kind: 'task', task: datedMilestone, depth: 0, dimmed: false },
  { kind: 'task', task: datedSummary, depth: 0, dimmed: false },
];
```

Voeg de assertions toe binnen het bestaande `if (renderError === null) { ... }`-blok, ná stap 4b:

```ts
  // 5. Relatie-hittest (spec 2026-08-14). Bewust een ÁNDERE functie dan getTaskBarBounds: die
  //    laatste armt slepen/resizen en moet mijlpalen blijven weigeren (een ruit heeft geen duur
  //    om te resizen, een verzamelbalk heeft afgeleide datums).
  if (healthyBars.length > 0) {
    const bar = healthyBars[0];
    const midX = bar.x + bar.w / 2;

    ok('getRelationSourceAt vindt de gezonde bladtaak niet',
      renderer.getRelationSourceAt(midX, rowMidY(0))?.id === healthy.id);

    // De mijlpaal deelt de datums van `healthy`, dus zijn ruit staat op bar.x. Het greepgebied is
    // ±6 px, hetzelfde als het pijltekenen gebruikt.
    ok('getRelationSourceAt weigert een MIJLPAAL (dit is de bug die we repareren)',
      renderer.getRelationSourceAt(bar.x, rowMidY(5))?.id === 'ms-dated');

    ok('getRelationSourceAt accepteert een VERZAMELTAAK (zou een spookrelatie worden)',
      renderer.getRelationSourceAt(midX, rowMidY(6)) === null);

    ok('getRelationSourceAt accepteert een datumloze taak',
      renderer.getRelationSourceAt(TTW + 5, rowMidY(1)) === null);

    // Regressie-anker de andere kant op: de sleep/resize-hittest is NIET versoepeld.
    ok('getTaskBarBounds armt nu wél drag op een mijlpaal (mag niet)',
      renderer.getTaskBarBounds(bar.x, rowMidY(5)) === null);
    ok('getTaskBarBounds armt nu wél drag op een verzamelbalk (mag niet)',
      renderer.getTaskBarBounds(midX, rowMidY(6)) === null);
  }
```

- [ ] **Stap 2: Draai de test en controleer dat hij faalt**

Run: `bash tests/planning/run.sh 2>&1 | grep -i "renderer-dateless\|bundelen mislukt"`
Expected: `XX  bundelen mislukt: check-renderer-dateless.ts` — `getRelationSourceAt` bestaat nog niet, dus `tsc`/esbuild struikelt.

- [ ] **Stap 3: Voeg de methode toe**

In `src/engine/renderer/GanttRenderer.ts`, direct ná `getTaskBarBounds` (het slot van de klasse, regel ~2065):

```ts
  /**
   * Hit test: mag hier een RELATIE-sleep starten?
   *
   * Bewust een aparte methode náást `getTaskBarBounds` en géén versoepeling daarvan. Die functie
   * armt slepen én resizen, en weigert mijlpalen en verzamelbalken om goede redenen: een ruit heeft
   * geen duur om te resizen, en de datums van een verzamelbalk zijn afgeleid uit de kinderen.
   * Sinds issue #40 armt dezelfde functie óók de relatie-sleep, en dáár slaat de mijlpaal-clausule
   * nergens op: een mijlpaal is een bladtaak met duur 0 die de solver volledig ondersteunt als
   * voorganger én opvolger. Dat was de bug.
   *
   * Verzameltaken blijven hier wél geweerd: de solver krijgt alleen bladtaken, dus zo'n relatie
   * zou een spookrelatie zijn (zie `state/relationRules.ts`). Vroeg weigeren — door de sleep niet
   * te armen — is prettiger dan hem na afloop afwijzen.
   */
  getRelationSourceAt(canvasX: number, canvasY: number): Task | null {
    if (canvasX < this.opts.taskTableWidth) return null;
    const task = this.getTaskAtY(canvasY);
    if (!task || task.childIds.length > 0) return null;
    // Zelfde datumloos-guard als getTaskBarBounds: een taak zonder datums heeft alleen een
    // terugval-stub op de viewstart en dus geen betekenisvolle positie om vanaf te slepen.
    if (!(task.time.earlyStart || task.time.scheduleStart) || !(task.time.earlyFinish || task.time.scheduleFinish)) {
      return null;
    }

    const { x1, x2 } = this.barGeometry(task);
    // Een mijlpaal-ruit heeft x1 ≈ x2; zonder marge is er niets te raken. 6 px is dezelfde marge
    // die het pijltekenen voor mijlpalen aanhoudt (zie `pad` in drawDependencies).
    const grab = 6;
    return canvasX >= x1 - grab && canvasX <= x2 + grab ? task : null;
  }
```

- [ ] **Stap 4: Draai de test en controleer dat hij slaagt**

Run: `bash tests/planning/run.sh 2>&1 | grep "renderer-dateless"`
Expected: `OK  renderer-dateless: alle checks groen (…)` met een hoger aantal dan voorheen.

Run: `npm run test:planning; echo "exit=$?"`
Expected: `exit=0`

- [ ] **Stap 5: Committen**

```bash
git add src/engine/renderer/GanttRenderer.ts tests/planning/check-renderer-dateless.ts
git commit -m "feat(gantt): aparte hittest voor het armen van een relatie-sleep

getTaskBarBounds weigert mijlpalen en verzamelbalken omdat hij voor
slepen/resizen geschreven is. Sinds issue #40 armde diezelfde functie ook
de relatie-sleep, waardoor je geen relatie vanaf een mijlpaal kon
trekken -- terwijl de solver mijlpalen volledig ondersteunt.

Bewust een nieuwe methode: versoepelen van getTaskBarBounds zou een
mijlpaal-ruit versleepbaar en een verzamelbalk resizebaar maken. Twee
assertions verankeren dat die hittest onveranderd blijft."
```

---

## Taak 6: De canvas gebruikt de nieuwe hittest

**Files:**
- Modify: `src/components/canvas/GanttCanvas.tsx:1108-1126` (`handleMouseDown`)

- [ ] **Stap 1: Herstructureer de shift/relatiemodus-tak**

De relatie-tak zit nu *binnen* `if (hit)`, waarbij `hit` uit `getTaskBarBounds` komt. Trek hem naar voren zodat hij zijn eigen hittest gebruikt. Vervang:

```ts
    const hit = renderer.getTaskBarBounds(x, y);
    if (hit) {
      // Shift+drag vanaf een balk tekent een relatie — en sinds issue #40 doet de relatiemodus
      // exact hetzelfde zónder toets ("plakkende Shift"), zodat de lint-knop/het contextmenu-item
      // een écht gebaar armen in plaats van een dode vlag te zetten. Bewust hetzelfde pad: een
      // tweede interactie zou met box-select (ctrl) en deze sleep om dezelfde muis-events vechten.
      if (e.shiftKey || dependencyMode) {
        e.preventDefault();
        depDraw.startDepDraw({
          sourceTaskId: hit.task.id,
          sourceX: e.clientX,
          sourceY: e.clientY,
          currentX: e.clientX,
          currentY: e.clientY,
        });
        return;
      }
```

door:

```ts
    // Shift+drag tekent een relatie — en sinds issue #40 doet de relatiemodus exact hetzelfde
    // zónder toets ("plakkende Shift"), zodat de lint-knop/het contextmenu-item een écht gebaar
    // armen in plaats van een dode vlag te zetten. Bewust hetzelfde pad: een tweede interactie zou
    // met box-select (ctrl) en de balk-sleep om dezelfde muis-events vechten.
    //
    // Eigen hittest (spec 2026-08-14): getTaskBarBounds weigert mijlpalen omdat een ruit geen duur
    // heeft om te resizen — voor een relatie is dat geen bezwaar en was het een bug.
    if (e.shiftKey || dependencyMode) {
      const source = renderer.getRelationSourceAt(x, y);
      if (source) {
        e.preventDefault();
        depDraw.startDepDraw({
          sourceTaskId: source.id,
          sourceX: e.clientX,
          sourceY: e.clientY,
          currentX: e.clientX,
          currentY: e.clientY,
        });
        return;
      }
    }

    const hit = renderer.getTaskBarBounds(x, y);
    if (hit) {
```

**Correctie (eindreview, punt A):** deze aanname was onjuist en is niet uitgevoerd zoals hier
opgeschreven. `barHit` poort in `ContextMenu.tsx` precies één menu-item —
`context.startRelationHere` ("Relatie leggen vanaf hier") — dus een relatie-actie, geen
balk-specifieke actie. `handleContextMenu` is alsnog aangepast om `getRelationSourceAt` te
gebruiken in plaats van `getTaskBarBounds`, met een herschreven comment; zie de spec, §4, voor de
volledige toelichting.

**Niet aanpassen:** de drop-kant in `useDependencyDraw.ts` blijft `getTaskAtY` gebruiken. Je mág op een verzamelbalk loslaten en krijgt dan de weigering mét reden uit Taak 3 — beter dan een pijl die geruisloos nergens landt.

- [ ] **Stap 2: Typecheck**

Run: `npm run typecheck && npm run lint; echo "exit=$?"`
Expected: `exit=0`

- [ ] **Stap 3: Handmatig verifiëren in de browser**

Start de dev-server via `preview_start` (niet via Bash — zie CLAUDE.md) en **lees de toegewezen poort uit de uitvoer**; die is per worktree anders dan 3007.

Verifieer met een project dat een mijlpaal, een verzameltaak en gewone taken bevat:

1. Shift+drag vanaf een **mijlpaal-ruit** naar een taak → relatie ontstaat, succesmelding verschijnt.
2. Shift+drag vanaf een **verzamelbalk** → er start geen sleep (de hittest armt niet).
3. Shift+drag vanaf een gewone taak náár een **verzamelbalk** → geen relatie, melding "…heeft geen effect op de planning…".
4. Gewone drag (zonder shift) op een **mijlpaal** → de ruit beweegt níét (bewijs dat `getTaskBarBounds` niet versoepeld is).
5. Gewone drag op een normale taak → verplaatst zoals altijd.

Assert via de store (`window.__OPS__`), niet via canvas-pixels — zie `docs/self-test-harness.md`.

- [ ] **Stap 4: Committen**

```bash
git add src/components/canvas/GanttCanvas.tsx
git commit -m "fix(gantt): relatie slepen vanaf een mijlpaal werkt weer

De shift/relatiemodus-tak zat binnen de getTaskBarBounds-hit en erfde
daarmee de mijlpaal-uitsluiting die voor slepen/resizen bedoeld was."
```

---

## Taak 7: Markering in het Relaties-paneel

Het paneel heeft al een `warnings: string[]` per rij (voor `warnTruncatedLead` en `warnLeadExceedsDuration`). Daar sluit de markering op aan — geen nieuw markeringssysteem.

**Files:**
- Modify: `src/components/panels/RelationsPanel.tsx:60-76` (`rowData`)

- [ ] **Stap 1: Voeg de waarschuwing toe**

Voeg de import toe bovenaan:

```ts
import { hasSummaryEndpoint } from '@/state/relationRules';
```

`taskById` bestaat al als `useMemo` (regel ~46); daar hangt de lookup zo op — géén tweede map bouwen. Voeg in `rowData` één regel toe aan het `warnings`-blok, als **eerste** regel — het is het meest ingrijpende probleem van de drie:

```ts
    const warnings: string[] = [];
    // Spookrelatie: de solver krijgt alleen bladtaken, dus een verzameltaak-eindpunt betekent dat
    // deze relatie geen enkel effect heeft. Afgeleid en niet opgeslagen, zodat een bladtaak die
    // later een kind krijgt vanzelf meegaat.
    if (hasSummaryEndpoint((id) => taskById.get(id), seq)) warnings.push(t('relations.warnSummaryEndpoint'));
    if (truncatedSet.has(seq.id)) warnings.push(t('relations.warnTruncatedLead'));
    if (effLag < 0 && Math.abs(effLag) > predDur) warnings.push(t('relations.warnLeadExceedsDuration'));
```

De `useMemo`-dependency-array van `rows` bevat `taskById` en `t` al — niets aan te passen.

- [ ] **Stap 2: Typecheck en visuele controle**

Run: `npm run typecheck; echo "exit=$?"`
Expected: `exit=0`

Open in de browser een project met een bestaande verzameltaak-relatie (maak er één via de MCP-laag vóór Taak 4 landt, of importeer een P6/MSP-bestand dat er één bevat) en controleer dat de rij de markering toont zoals de bestaande waarschuwingen dat doen.

- [ ] **Stap 3: Committen**

```bash
git add src/components/panels/RelationsPanel.tsx
git commit -m "feat(relaties): markeer relaties zonder effect in het paneel

Sluit aan op de bestaande warnings-array per rij. Afgeleid uit childIds,
niet opgeslagen -- zo gaat een bladtaak die later een kind krijgt vanzelf
mee, zonder migratie."
```

---

## Taak 8: Samenvattende melding na het laden

`applyLoadedProject` in `fileSlice.ts` is de enige trechter: alle zes de aanroepers (openen, recent, voorbeeld, projectSlice, MCP-fileTools) gaan er doorheen. Eén meldpunt dekt dus IFC, CSV én XML-import.

**Files:**
- Modify: `src/state/slices/fileSlice.ts:146-187` (`applyLoadedProject`)

- [ ] **Stap 1: Voeg de melding toe**

Voeg de import toe bovenaan:

```ts
import { hasSummaryEndpoint } from '@/state/relationRules';
```

Voeg de melding toe direct ná het `set((s) => { ... })`-blok, náást de bestaande `runCPM`/`requestFitToProject`-aanroepen (rond regel 180) — dus buiten de Immer-draft, want `notify` is een store-actie:

```ts
      // Spookrelaties uit het bestand (spec 2026-08-14): relaties met een verzameltaak als eindpunt
      // worden door de solver weggegooid. Ze worden bewust NIET gefilterd — dat zou logica uit het
      // bronbestand vernietigen bij open + opslaan — maar wel één keer gemeld, want anders merkt
      // niemand die een P6/MSP-plan importeert dat er logica stilvalt.
      // `parsed.tasks` is een gewone array (geen Immer-draft) en we lopen over álle relaties, dus
      // hier loont een map wél — één keer bouwen i.p.v. een lineaire zoektocht per relatie.
      const byId = new Map(parsed.tasks.map((t) => [t.id, t]));
      const ineffective = parsed.sequences.filter((seq) => hasSummaryEndpoint((id) => byId.get(id), seq)).length;
      if (ineffective > 0) {
        get().notify({
          severity: 'info',
          messageKey: 'notifications.summaryRelationsIgnored',
          params: { total: ineffective },
          dedupeKey: 'summary-relations-ignored',
        });
      }
```

**Controleer de veldnamen:** het `ImportResult`-type (`src/services/importTypes.ts`) moet `tasks` en `sequences` heten. Wijken ze af, gebruik dan de werkelijke namen — niet het type aanpassen.

- [ ] **Stap 2: Typecheck en verificatie**

Run: `npm run typecheck; echo "exit=$?"`
Expected: `exit=0`

Run: `npm run verify:examples; echo "exit=$?"`
Expected: `exit=0` — de gebundelde voorbeelden mogen geen verzameltaak-relaties bevatten; is dat wél zo, dan is dat op zichzelf een vondst die je meldt in plaats van wegpoetst.

Open in de browser een bestand met zo'n relatie en controleer dat de melding één keer verschijnt.

- [ ] **Stap 3: Committen**

```bash
git add src/state/slices/fileSlice.ts
git commit -m "feat(bestanden): meld relaties zonder effect na het laden

Een van P6/MSP geimporteerd plan kan relaties op verzameltaken bevatten;
die worden door de solver stil weggegooid. Ze blijven behouden (filteren
zou logica uit het bronbestand vernietigen) maar worden nu eenmalig
gemeld. In applyLoadedProject: de enige trechter voor alle zes de
laadroutes."
```

---

## Taak 9: Documentatie

**Files:**
- Modify: `public/docs/nl/gids-relaties-constraints.md`
- Modify: `public/docs/en/gids-relaties-constraints.md`
- Modify: `docs/extensions.md`
- Modify: `docs/TODO.md`

- [ ] **Stap 1: Breid de gidsen uit**

Voeg aan beide gidsen een sectie toe over wat wél en niet kan. Houd je aan de **beperkte Markdown-subset** die `src/utils/miniMarkdown.tsx` aankan: koppen `#`/`##`/`###`, paragrafen, enkelvoudige lijsten, `**vet**`/`*cursief*`/`` `code` ``, codeblokken, afbeeldingen, en uitsluitend `docs://`- en `examples://`-links. **Geen tabellen, geen blockquotes, geen h4, geen rauwe HTML** — `npm run verify:docs` faalt daarop.

**Terminologie:** gebruikerzichtbare Nederlandse tekst zegt **samenvattingstaak**, niet
"verzameltaak" — dat is de term die de app al voert (`menu.json`, `task.json`, en de gids
`ref-taakdialoog.md`). De code en dit plan gebruiken intern wél "verzameltaak"; dat blijft zo. In
het Engels is "summary task" de gevestigde term.

Inhoud (nl; maak een gelijkwaardige en-versie):

```markdown
## Waar kun je een relatie aan hangen?

Je kunt relaties leggen tussen alle gewone taken en tussen mijlpalen. Een mijlpaal heeft duur 0,
maar gedraagt zich verder als elke andere taak: hij kan voorganger én opvolger zijn, en hij kan op
het kritieke pad liggen.

Wat *niet* kan is een relatie aan een **samenvattingstaak** hangen — een taak die zelf subtaken
heeft. De planningsmotor rekent alleen met taken zonder subtaken; de datums van een
samenvattingstaak worden daarna afgeleid uit haar kinderen. Een relatie naar zo'n taak zou dus wel
zichtbaar zijn, maar geen enkel effect hebben op de planning.

Wil je twee fasen aan elkaar koppelen, leg de relatie dan tussen de taken zelf: de laatste taak van
de ene fase naar de eerste taak van de volgende. Een mijlpaal aan het eind van een fase werkt daar
goed voor.

Bevat een geopend bestand toch zulke relaties — bijvoorbeeld uit Primavera P6 of MS Project, die ze
wél kennen — dan blijven ze bewaard en gaan ze bij het opslaan gewoon weer mee. In het
Relaties-paneel staan ze gemarkeerd als *zonder effect*, zodat je ziet dat de planning er niet mee
rekent.
```

- [ ] **Stap 2: Werk `docs/extensions.md` bij**

Zoek de beschrijving van `addSequence` en pas het retourtype aan naar `string | null`, met de reden: `null` betekent dat de relatie geweigerd is (duplicaat, zelfrelatie, onbekende taak, of een verzameltaak als eindpunt).

- [ ] **Stap 3: Noteer het openstaande punt in `docs/TODO.md`**

```markdown
- Mijlpaal horizontaal verslepen om de datum te wijzigen. Nu geblokkeerd door dezelfde
  `getTaskBarBounds`-null die het relatie-tekenen blokkeerde (opgelost in spec 2026-08-14). Raakt
  `barDrag`: bij een 0-duurtaak mag alleen een body-sleep armen, nooit een resize-greep, en
  snapping/undo/uur-modus moeten kloppen.
- `useDependencyDraw.ts` toetst de drop-x tegen `ui.leftPanelWidth`, terwijl de overige
  canvas-hittests `taskTableWidth` gebruiken. Uitzoeken of dat een bug is.
```

- [ ] **Stap 4: Draai de docs-poort**

Run: `npm run verify:docs; echo "exit=$?"`
Expected: `exit=0`

- [ ] **Stap 5: Committen**

```bash
git add public/docs docs/extensions.md docs/TODO.md
git commit -m "docs: relaties op mijlpalen en verzameltaken uitgelegd"
```

---

## Taak 10: Volledige poort

- [ ] **Stap 1: Draai de poort die CI, de release-gate en de deploy-gate alle drie draaien**

Run: `npm run verify; echo "exit=$?"`
Expected: `exit=0`

Dit dekt `typecheck`, `lint`, alle vier de testsuites, `verify:examples`, `verify:docs`, `verify:i18n`, `verify:cycles` en `verify:audit`.

**Let op bij het lezen van de uitvoer:** de planningssuite print "alles groen" ook bij exit 1 wanneer het bundelen faalt. Vertrouw op de exitcode, nooit op de laatste regels. `verify:cycles` is hier extra relevant: die bewaakt of `relationRules.ts` echt een bladmodule is gebleven.

- [ ] **Stap 2: Bij rood — repareren, niet omzeilen**

Meld wat er faalt, met de uitvoer erbij. Zet geen test uit en versoepel geen poort om groen te krijgen.

---

## Zelfreview van dit plan

**Spec-dekking:** §1 regelmodule → Taak 1. §2 dedup-verhuizing → Taak 4 (stap 4). §3 vier lezers → Taken 3, 4, 6, 7. §4 hittest → Taken 5, 6. §5 behouden + markeren → Taken 7, 8. Foutafhandelingstabel → Taken 3, 4, 6. Tests → Taken 1, 3, 4, 5. Documentatie → Taak 9. Geen gaten.

**Afwijking van de spec, bewust:** de spec beschrijft voor MCP een nieuw foutpad met een `RelationRejection`-doorgifte. Tijdens de verkenning bleek `classifyDeps` al een zachte-weigeringsmechaniek te hebben die onbekende id's én duplicaten afvangt. Taak 4 sluit daarop aan in plaats van een eigen pad te bouwen — minder code, en consistent met wat een AI-agent al terugkrijgt.

**Onopgelost gelaten, met opzet:** `updateSequence` in `sequenceSlice.ts` houdt zijn eigen botsingsregel (die gaat over een type-wijziging op een *bestaande* relatie, een andere vraag dan het aanmaken). Buiten scope.
