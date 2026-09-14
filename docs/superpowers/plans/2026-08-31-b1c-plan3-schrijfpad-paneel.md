# B1c — Etappe 3: het schrijfpad en de dialoog (implementatieplan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** B1c afmaken: het **schrijfpad** (spec §5 — Toepassen over het actieve én de slapende documenten,
per-document-undo, "alles terugdraaien") en de **verdeeldialoog** (spec §6/§7 — fasestroken met
plafond-handles en pins, rangordelijst, gereedschapsschakelaar, voor/na-histogram, voorstel-invalidatie),
plus de i18n-pass en de gebruikersgids die daarbij horen (spec §8). Leidende bron:
`docs/superpowers/specs/2026-08-17-b1c-nivelleren-restcapaciteit-design.md`; alle eigenaarsbesluiten
staan in §11 daarvan. Waar dit plan de spec **concretiseert** staat dat expliciet als
**KEUZE VAN DIT PLAN**; waar het bewust **afwijkt** staat **AFWIJKING — VOORLEGGEN**. Twee besluiten van
de eigenaar op 2026-08-31 zijn al in dit plan verwerkt (gemarkeerd als **besluit eigenaar 2026-08-31**
op hun plek): de dialoogstanden (pin, plafond, rangorde) zijn sessie-stand, niet projectdata (bevestiging van de bestaande keuze
hieronder), en de verdeelflow wordt een losse dialoog in plaats van de eerder gekozen drill-down (taak 8
e.v., met de gevolgen daarvan in taken 9–13 en 15).

**Architecture:** vier lagen, van binnen naar buiten. De onderste twee bestaan al (etappe 2) en worden
hier alleen afgemaakt; de bovenste twee zijn nieuw.

1. **`src/engine/scheduler/ResourceLeveler.ts`** — de motor binnen één document. Etappe 2 gaf hem
   `scopeTaskIds`, `overrunCeilingDays`, `poolLedger`, `allowSplits` en de zeven-koppige
   `LevelingReason`-taxonomie. Dit plan raakt hem nog op drie punten: twee doorgeschoven
   keuringsbevindingen (taak 1) en de **gap-strip in de baseline** die `applyLeveling` idempotent
   maakt (taak 2).
2. **`src/services/library/distribute.ts`** — de verdeler-kern. Puur, geen store. Dit plan voegt er
   twee dingen aan toe: een echt per-item-geboekt grootboek (taak 1) en `afterLoadByDay` voor de
   voor/na-preview (taak 11).
3. **Het schrijfpad** — nieuw: `src/state/runtime/scratchDocument.ts` (headless scratch-instantie) plus
   `applyDistribution`/`undoDistribution` op `librarySlice`. Dit is de laag die spec §5 beschrijft.
4. **De verdeeldialoog** — nieuw: `src/components/dialogs/DistributionDialog/`, gemount vanuit
   `App.tsx` achter `ui.showDistributionDialog`, via de gedeelde `Dialog`-component en de
   `hasBlockingDialogOpen`-guard (besluit eigenaar 2026-08-31, taak 8) — de eerste versie van dit plan
   koos hier een drill-down binnen `ResourceOccupancyView`, dat is teruggedraaid. Geopend vanuit de
   conflictregel in `ResourceOccupancyView` en, analoog aan `showLevelingDialog`, een knop op de
   Resources-ribbon. Gewoon DOM/React (Canvas is uitsluitend voor de Gantt), geen native dialogs, geen
   nieuw meldingskanaal.

**Tech Stack:** TypeScript strict, React 19, geen frameworks. Headless tests als `check-*.ts` onder
`tests/planning/` (registratie in `tests/planning/run.sh`) en `tests/library/` (`run_check check-x`
onderaan `tests/library/run.sh`). UI-tests als Playwright-specs onder `tests/browser/`. De poort is
`npm run verify` plus `npm run test:browser` — oordeel **UITSLUITEND op de exitcode**, nooit op de
tekst "alles groen"; `tests/library/` print zijn faalregels **ingesprongen** (`   XX …`), dus
`grep '^XX'` is daar structureel blind.

---

## Scope

**In dit plan (etappe 3):**

- De vijf doorgeschoven bevindingen uit de eindkeuring van etappe 2 (taak 1).
- `applyLeveling` scope-behoudend + `LevelingResult.gaps` daadwerkelijk schrijven, `clearLeveling` die
  ook leveling-gaten wist, de `clearLevelingGaps`-wiring op tijdbasis-bewerkingen, en de
  ribbon-enable-check (taken 2 en 3).
- De mutatieteller op de store-runtime en de voorstel-vingerafdruk (taak 4, spec §6a).
- Het schrijfpad naar slapende documenten via een headless scratch-instantie, met de twee
  singleton-randen (extensie-emitter, `notify`) dichtgezet (taken 5 en 6, spec §5).
- De i18n-pass: alle zeven `LevelingReason`-codes, de drie `DistributionBlockReason`-codes en élke
  dialoogtekst, in veertien locales met CLDR-pluralcategorieën (taak 7, spec §8).
- De verdeeldialoog: ingang vanuit de conflictregel, gereedschapsschakelaar, rangordelijst, "Verdeel
  automatisch"/"Herbereken" met bezig-toestand en schaal-degradatie, fasestroken met pin en
  plafond-handle (toetsenbord én pointer), voor/na-histogram, Toepassen/verwerpen, de
  "toegepast"-strook met "alles terugdraaien", voorstel-invalidatie (taken 8–13, spec §6/§6a/§7).
- De gebruikersgids `public/docs/{nl,en}/gids-verdelen-restcapaciteit.md` + manifest-entry, en
  `docs/library.md` (taak 14, spec §8).

**NIET in dit plan:**

| onderwerp | waar het hoort |
|---|---|
| Een slimmere zoekstap bovenop de vroegste-venster-plaatsing | buiten scope (spec §11.6: "geen v1-werk") |
| Simultaan optimaliseren over documenten in één solve | buiten scope (spec §10) |
| Cross-machine boekingen / gedeelde opslag | buiten scope (spec §10) |
| MCP-tools voor de verdeler | buiten scope (spec §10, "additief zodra gevraagd") |
| Automatisch hernivelleren bij elke bewerking | buiten scope (spec §10, F5-filosofie) |
| Split-view / multi-window voor de verdeeldialoog | buiten scope (CLAUDE.md, store-ownership) |
| Pins/plafonds die een app-herstart of een `.ifc`-round-trip overleven | **mogelijke latere uitbreiding, geen v1-werk** — besloten door de eigenaar, zie de bak "Waar de tune-state woont" hieronder |

### Waar de tune-state woont (KEUZE VAN DIT PLAN, bevestigd door de eigenaar 2026-08-31)

De opdracht bij dit plan noemde het documentcontract voor "nieuwe per-document-instellingen zoals
pin/plafond". Dit plan zet ze **niet** in `DOCUMENT_FIELDS`, maar in `ui` (dat in
`documentContract.ts`'s `AppGlobalKey` al als app-globaal geclassificeerd staat, dus er verandert
niets aan de contract-asserties). Drie redenen, alle drie hard:

1. **De dialoog kijkt naar N documenten tegelijk.** Pin en plafond van élk deelnemend document moeten
   in één render leesbaar zijn. In `DOCUMENT_FIELDS` wonen ze per document — voor het actieve
   top-level, voor de slapers in hun payload — dus de dialoog zou zijn eigen bediening uit twee
   verschillende plekken moeten samenrapen, en een pin zetten op een slapend document zou een
   payload-mutatie zijn.
2. **Het zijn geen projectdata.** `DOCUMENT_FIELDS` bepaalt óók wat er in de undo-snapshot zit en wat
   `newProject()` reset. Een pin in de snapshot betekent dat Ctrl+Z in het actieve document een
   dialoogbediening terugdraait; dat is precies de soort verwarring die het documentcontract elders
   voorkomt.
3. **Ze horen bij één verdeelsessie, niet bij het project.** Spec §6a laat het voorstel al vervallen
   bij elke rang-, plafond-, pin- of gereedschapswijziging: de tune-state is de invoer van een
   momentopname, geen opgeslagen projecteigenschap. De spec vraagt nergens om persistentie ervan.

**Besluit eigenaar 2026-08-31:** de dialoogstanden (pin, plafond, rangorde) zijn **tijdelijk** —
sessie-stand, geen projectbestand. Dit bevestigt de keuze hierboven expliciet: Ctrl+Z in het actieve
document raakt de tune-state nooit, en na een herstart begint de gebruiker neutraal (float-gesorteerd,
geen pins, geen plafonds). Wat hierboven nog als **AFWIJKING — VOORLEGGEN** stond — wil de eigenaar dat
een pin of een plafond een app-herstart overleeft (of zelfs door het IFC round-trippt) — is daarmee
beantwoord: dat blijft een **mogelijke latere uitbreiding**, geen v1-werk. Kiest de eigenaar daar ooit
voor, dan hoort er een veld in `DOCUMENT_FIELDS` bij plus een `OPS_`-pset, en dan verandert de betekenis
van de pin van "deze verdeelsessie" naar "dit project ligt vast" — een apart besluit, niet dit plan.

---

## Context voor wie hier koud instapt

Lees dit vóór taak 1. Alles hieronder is geverifieerd in de code van 2026-08-31, ná de fixronde van
etappe 2 (`a281f665`).

- **Wat etappe 2 heeft opgeleverd.** `levelResources` accepteert vier optionele invoeren
  (`scopeTaskIds`, `overrunCeilingDays`, `poolLedger`, `allowSplits`) en levert naast `delays`/
  `unresolved`/`unresolvedReasons`/`shifts`/`projectEndBefore`/`projectEndAfter` óók
  **`gaps: Record<string, TaskSplitGap[]>`** — de VOLLEDIGE, te schrijven `splitGaps`-waarde per taak
  (importsplits inbegrepen), niet het verschil. `LevelingReason` telt zeven leden:
  `CALENDAR_MISMATCH`, `INSUFFICIENT_CAPACITY`, `INTRINSIC_OVERRUN`, `CEILING_TOO_TIGHT`,
  `CEILING_UNREACHABLE`, `NO_WINDOW_IN_HORIZON`, `RESIDUAL_FULL`.
- **`computeDistribution`** (`src/services/library/distribute.ts`) levert een `DistributionProposal`
  met `blocked` (`UNCOUNTED_DOCUMENT` | `MATERIAL_ITEM` | `NO_DEMAND`), `docs`
  (`DistributionDocResult[]` met `delays`, `gaps`, `shortfalls`, `endShiftWorkdays`, `participated`,
  `pinnedReason`, `cannotMove`), `fixedLoadByDay`, `residualByDay` en `hasShortfall`. Hij is puur:
  geen store, geen I/O. De motor-rand (`DistributionLevelRun`) is injecteerbaar, precies zoals
  `OccupancyEphemeralSolve` in `occupancy.ts`.
- **`applyLeveling`/`clearLeveling`** staan tweemaal: in `src/state/slices/scheduleSlice.ts` (de
  store-variant, mét snapshot en `runCPM`) en in `src/state/runtime/createMcpTransactions.ts` (de
  snapshot-/recompute-vrije variant binnen een MCP-transactie). Elke wijziging aan de een hoort ook
  bij de ander; beide dragen al een verwijscommentaar naar elkaar. Ze schrijven vandaag **alleen**
  `levelingDelay` (+ de M10-strip van `levelingDelayMinutes`/`levelingDelayElapsed`) en raken
  `splitGaps` niet aan.
- **`clearLevelingGaps(task)`** bestaat al (`src/utils/taskDefaults.ts`, etappe-2 taak 7): wist
  uitsluitend gaten met `source === 'leveling'`, laat importsplits staan, zet `splitGaps` op
  `undefined` als er niets overblijft, en geeft `true` terug precies wanneer er iets gewist is —
  hetzelfde contract als `clearTimephasedWindow` ernaast. Hij heeft vandaag **nul aanroepplekken**.
- **De storecontext.** `createAppStoreContext()` (`src/state/appStore.ts`) bouwt een volledig
  onafhankelijke context: eigen store, eigen `StoreRuntime` (coalescing, batchdiepte, MCP-lease). De
  gemounte interface gebruikt precies één (`appStoreContext`/`useAppStore`). Core-runtimefactories
  mogen `useAppStore`/`appStoreContext` **nooit** importeren — `npm run verify:store-boundaries`
  bewaakt dat mechanisch.
- **Het documentcontract.** `capturePayload(state)` / `hydratePayload(state, payload)` /
  `freshPayload()` lopen key-gedreven over `DOCUMENT_FIELDS`. Dat is precies het mechanisme waarmee de
  scratch-instantie in taak 5 een slapende payload in- en uitlaadt.
- **`resetDocumentScopedUI(s)`** (`src/state/slices/documentSlice.ts`, regel ~56) is de ENE plek waar
  `ui`-velden die naar het uitgaande document wijzen worden opgeruimd; hij draait bij
  `newDocument`/`switchDocument`/`closeDocument`/`duplicateDocument`/`restoreDocuments`. De
  verdeeldialoog moet daar in taak 12 aan gekoppeld worden — en sluit dan (besluit eigenaar
  2026-08-31), niet alleen zijn voorstel laten vervallen.
- **`ResourceOccupancyView`** (`src/components/panels/ResourceOccupancyView.tsx`, 837 regels) is het
  bezettingsoverzicht: één `useMemo` rond `computeLibraryOccupancy` met een per-payload-`WeakMap`-cache
  op de bibliotheek-SNIT, plus een SVG-histogram (`OccupancyHistogram`) met gatcompressie. De
  conflictregel hierin draagt de ingang naar de verdeeldialoog (taak 8) en de dialoog deelt in taak 9
  zijn tijdas — maar rendert zelf los, via `App.tsx` (geen inbedding meer in deze view).
- **Meldingen** lopen sinds K8a via één kanaal (`get().notify({ severity, messageKey, … })`,
  `uiSlice`). Geen `alert()`, geen native dialogs, geen tweede toast-mechaniek. Actieknoppen bestaan
  in dat kanaal NIET — daarom woont "alles terugdraaien" in de dialoog zelf (spec §5).
- **De testrunners.** `tests/planning/run.sh` registreert een check met twee regels (kopieer het
  `LEVELERSPLITSCHECK`-blok). `tests/library/run.sh` is één regel `run_check check-x` onderaan en
  draait `tsc -p tests/library/tsconfig.check.json` als eerste stap, dus fixture-typen worden daar
  hard afgedwongen. Browsertests: `npm run test:browser` (Playwright Chromium headless shell, één
  worker, nul retries); installeer eenmalig met
  `npx playwright install --with-deps --only-shell chromium`. De dev-only `window.__OPS__`-brug mag
  fixtures zetten en state lezen, maar **nooit** de geteste gebruikershandeling vervangen.

---

## Task 1: de vijf doorgeschoven bevindingen uit de eindkeuring van etappe 2

**Waarom hier en niet later.** Bevindingen 11 en 12 zitten in `scatterSlot`/`findSlot` — precies de
code die de verdeeldialoog straks per handle-loslating aanroept; 6 zit in het grootboek dat taak 11
uitbreidt; 10 is regeleinde-ruis die élke latere diff in `src/types/task.ts` onleesbaar maakt.
Nummering volgt de eindkeuring van etappe 2.

**Files:**
- Modify: `src/types/task.ts` (bevinding 10, alléén regeleinden)
- Modify: `src/engine/scheduler/ResourceLeveler.ts` (bevindingen 11, 12)
- Modify: `src/services/library/distribute.ts` (bevinding 6)
- Modify: `tests/planning/check-leveler-splitmode.ts` (bevinding 7 + de guard van 12)
- Modify: `tests/library/check-distribute.ts` (bevinding 6)

- [ ] **Step 1: Bevinding 10 — CRLF-ruis, als EIGEN commit vooraf**

`src/types/task.ts` heeft sinds commit `e6f36d50` CRLF-regeleinden (495 regels; `file` meldt
"with CRLF line terminators"). De rest van `src/` is LF. Normaliseer, **zonder één inhoudelijke
wijziging**:

```bash
cd "$(git rev-parse --show-toplevel)"
python3 - <<'PY'
from pathlib import Path
p = Path('src/types/task.ts')
b = p.read_bytes()
assert b'\r\n' in b, 'geen CRLF gevonden — bevinding 10 is al opgelost, meld dat en sla deze stap over'
p.write_bytes(b.replace(b'\r\n', b'\n'))
PY
git diff --stat src/types/task.ts   # verwacht: ~495 regels "changed", 0 echte inhoud
npx tsc --noEmit -p tsconfig.json; echo "exit: $?"
```

Commit dit **apart**, zodat het geen enkele latere `git blame` vervuilt:

```bash
git add src/types/task.ts
git commit -m "chore(types): LF-regeleinden in task.ts (B1c-plan3 taak 1, bevinding 10)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Schrijf de falende tests voor bevindingen 11, 12 en 7**

Achteraan in `tests/planning/check-leveler-splitmode.ts`, in de bestaande `ok`/`eq`-stijl:

```ts
console.log('-- B1c-plan3 taak 1: scatter-randen --');

// ── Bevinding 12: `scatterSlot` mag nooit een LEGE dagenset als "geplaatst" teruggeven ────────────
// Een taak zonder enige vraag op een geselecteerde resource levert `need === 0`; `scatterSlot` gaf
// dan `[]` terug, dat is truthy, en `findSlot` deed `parseDate(scatterDays[0])` op `undefined` ⇒
// een Invalid Date als starttijd, die verderop stil door de hele run reist. Bouw de fixture met een
// scope-taak wier enige toewijzing `unitsPerDay: 0` heeft (dan blijft ze buiten `hasDemand`, dus
// forceer het geval via een taak MET vraag op resource R en een `resourceIds`-filter dat R uitsluit —
// zoek in `LevelingOptions` welk filterveld dat is en gebruik dát).
ok('lege scatter levert nooit een Invalid Date als start', !isNaN(parseDate(rEmpty.shifts['Z']?.newStart ?? '2026-01-01').getTime()));
eq('lege scatter schrijft geen gaten', rEmpty.gaps['Z'], undefined);

// ── Bevinding 11: zonder bindend venster stopt de scatter-scan op de HORIZON, niet op 200.000 ─────
// `allowSplits: true`, GEEN `overrunCeilingDays`, GEEN `constrainToFloat`, en een resource die vanaf
// de projectstart tot ver voorbij elke horizon nul capaciteit heeft (`availabilitySteps` naar 0).
// `scatterSlot` vindt dan nooit een dag. Vóór de fix liep hij HARD_SCAN_CAP (200.000) kandidaten af;
// erna stopt hij op de grootboekhorizon (of, zonder grootboek, op dezelfde `scanLimit`-ondergrens die
// de aaneengesloten scan gebruikt) en meldt de eerlijke reden.
eq('geen eindeloze scatter-scan: eerlijke horizon-reden', rNoWindow.unresolvedReasons['A'], 'NO_WINDOW_IN_HORIZON');
// Prestatie is GEEN poort, maar de orde van grootte wél zichtbaar: meet met `Date.now()` rond de
// aanroep en assert < 2000 ms. Vóór de fix duurde dit geval seconden tot tientallen seconden.
ok('en hij is niet meer traag', elapsedMs < 2000);

// ── Bevinding 7: fractionele uur-modus in de scatter (2,5 dag / 1200 minuten) ─────────────────────
// Taak H: `durationUnit: 'hours'`, `durationMinutes: 1200` (20 werkuur), `scheduleDuration: 2.5` op
// een 8u-kalender, `durationType: 'WORKTIME'`, `completion: 0`, prio 100. Resource R (cap 1) is ma+wo
// al bezet door een prio-900-taak. Met `allowSplits` moet H op di, do en vr landen: `distributeUnits`
// rondt 2,5 af naar DRIE curve-slots, dus `need === 3` — niet 2 (`Math.floor`) en niet 2,5.
eq('fractionele uur-modus: drie curve-slots, dus drie werkdagen',
   enumerateTaskWorkDays(rFrac.gaps['H'], projEng, '<H se nieuwe start>', 3),
   ['2026-06-02', '2026-06-04', '2026-06-05']);
ok('en precies twee leveling-gaten (na di en na do)',
   rFrac.gaps['H']?.filter(g => g.source === 'leveling').length === 2);
```

En in `tests/library/check-distribute.ts`, achteraan:

```ts
// ── B1c-plan3 taak 1, bevinding 6: het grootboek boekt PER ITEM ──────────────────────────────────
// `makeLedgerForDoc` negeerde `itemId` volledig (`residualOn: (_itemId, iso) => residualOn(iso)`).
// Dat is vandaag correct omdat `poolItemOf` uitsluitend `libraryItemId` teruggeeft — maar het is een
// ONGESCHREVEN invariant, en een toekomstige verdeler over meerdere poolitems tegelijk zou stil
// alles op één hoop boeken. Deze case pint dat de sleutel gebruikt WORDT.
ok('een boeking op een ANDER itemId raakt dit poolitem niet',
   (() => { const l = ledgerOf(p1); const before = l.residualOn(ITEM, '2026-08-03');
            l.book('een-ander-item', '2026-08-03', 99);
            return l.residualOn(ITEM, '2026-08-03') === before; })());
```

Draai en verwacht rood:

```bash
bash tests/planning/run.sh 2>&1 | tail -20; echo "exit: ${PIPESTATUS[0]}"
bash tests/library/run.sh 2>&1 | tail -20; echo "exit: ${PIPESTATUS[0]}"
```

- [ ] **Step 3: Implementeer bevindingen 11 en 12 in `ResourceLeveler.ts`**

**(12) De guard**, in `findSlot` (regel ~838):

```ts
    if (splitEligible(task)) {
      const scatterDays = scatterSlot(taskId, pf, finishWindowLimit(taskId));
      // B1c-plan3 taak 1 (bevinding 12): een LEGE dagenset is geen plaatsing. `scatterSlot` geeft
      // `[]` terug zodra `need === 0` (`chosen.length === need` is dan meteen waar), en `[]` is
      // truthy — `parseDate(scatterDays[0])` maakte er dan een Invalid Date van, die als `start` de
      // hele hoofdlus in reisde (delay-meting, boeking, shifts). Niets plaatsen hoort door te vallen
      // naar het "geen slot"-vangnet hieronder.
      if (scatterDays && scatterDays.length > 0) {
        return { start: parseDate(scatterDays[0]), unresolved: [], scatterDays };
      }
    }
```

**(11) De scatter-horizon**, in `scatterSlot` (regel ~972). De lus loopt vandaag tot `HARD_SCAN_CAP`
zodra `finishLimit === null`. Geef hem dezelfde tweetrapsgrens als de aaneengesloten scan:

```ts
  function scatterSlot(taskId: string, pf: Date, finishLimit: Date | null): string[] | null {
    const task = taskById.get(taskId)!;
    const byRes = demandByTask.get(taskId)!;
    /* … bestaande `need`-berekening ONGEWIJZIGD … */
    const need = byRes.values().next().value?.length ?? Math.ceil(task.time.scheduleDuration);
    // B1c-plan3 taak 1 (bevinding 11): zonder `finishLimit` (geen plafond, geen constrainToFloat) had
    // deze lus alleen `HARD_SCAN_CAP` als rem — 200.000 kandidaatdagen mét een volledige `dayFits`
    // per dag, terwijl de aaneengesloten scan er allang mee gestopt is. Zelfde tweetrapsgrens als
    // `findSlot`: `scanLimit` is de gewone ondergrens (afgeleid van de eigen taakduren), en een
    // grootboekhorizon mag hem verlengen omdat externe vaste last het eerste vrije venster voorbij
    // die ondergrens kan duwen (L4). `HARD_SCAN_CAP` blijft uitsluitend de vangrail.
    const horizonDate = ledger?.horizonIso ? parseDate(ledger.horizonIso) : null;
    const chosen: string[] = [];
    let cand = nextCandidateFor(task, pf);
    let guard = 0;
    while (chosen.length < need && guard++ < HARD_SCAN_CAP) {
      if (finishLimit && cand > finishLimit) return null;
      if (guard > scanLimit && !(horizonDate && cand <= horizonDate)) return null;
      const iso = formatDate(cand);
      if (dayFits(byRes, chosen.length, iso)) chosen.push(iso);
      cand = nextCandidateAfterFor(task, cand);
    }
    return chosen.length === need ? chosen : null;
  }
```

Controleer bij het implementeren dat `scanLimit` op dit punt in scope is (hij wordt in `findSlot`s
omhullende functie berekend); is dat niet zo, geef hem als parameter mee in plaats van hem te
herberekenen — één definitie, geen tweede die kan afdrijven.

- [ ] **Step 4: Implementeer bevinding 6 in `distribute.ts`**

Vervang de itemId-negerende sluitingen door een echt per-item grootboek:

```ts
  // Het gedeelde poolitem-grootboek (§4 stap 2), PER ITEM geboekt (B1c-plan3 taak 1, bevinding 6).
  // Vandaag levert `poolItemOf` uitsluitend `libraryItemId` terug, dus één emmer zou volstaan — maar
  // dat is een ongeschreven invariant, en het contract van `LevelingPoolLedger` belooft expliciet een
  // per-item-boekhouding. De sleutel gebruiken kost niets en maakt een latere verdeler over meerdere
  // poolitems tegelijk een uitbreiding in plaats van een herschrijving.
  const placedByItem: Record<string, Record<string, number>> = {};
  const bookPlaced = (itemId: string, iso: string, units: number) => {
    const bucket = placedByItem[itemId] ?? (placedByItem[itemId] = {});
    bucket[iso] = (bucket[iso] ?? 0) + units;
  };
  const residualOn = (itemId: string, iso: string): number =>
    itemId === libraryItemId
      ? Math.max(0, maxUnitsOn(poolItem, iso) - (fixedLoadByDay[iso] ?? 0) - (placedByItem[itemId]?.[iso] ?? 0))
      // Een ander item hoort in deze run niet voor te komen (zie `poolItemOf`); geef 0 terug in
      // plaats van de capaciteit van DIT item — dat zou een vreemd item gratis ruimte geven.
      : 0;
```

Werk `placed` in `computeHorizonIso`, in de `cannotMove`-tak en in de `residualByDay`-opbouw mee om
naar `placedByItem[libraryItemId] ?? {}`. Laat de rest van het bestand ongewijzigd.

- [ ] **Step 5: Draai**

```bash
bash tests/planning/run.sh 2>&1 | tail -8; echo "exit: $?"
bash tests/library/run.sh 2>&1 | tail -8; echo "exit: $?"
npx tsc --noEmit -p tsconfig.json; echo "exit: $?"
```

Verwacht: exit 0, 0, 0. Wordt een bestaande leveling-case rood op de scatter-horizon (stap 3), dan
scande die case bewust ver voorbij `scanLimit` zónder grootboek — begrijp dat eerst en meld het;
pas nooit blind een verwachting aan.

- [ ] **Step 6: Commit (twee commits, de CRLF-commit stond al in stap 1)**

```bash
git add src/engine/scheduler/ResourceLeveler.ts tests/planning/check-leveler-splitmode.ts
git commit -m "fix(scheduler): scatter-plaatsing stopt op de horizon en levert nooit een lege dagenset (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"

git add src/services/library/distribute.ts tests/library/check-distribute.ts
git commit -m "fix(library): het poolitem-grootboek boekt per item in plaats van op één hoop (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: `applyLeveling` scope-behoudend, mét `splitGaps` — en de idempotentie die daarbij hoort

**Spec §5, "Scope-behoudend toepassen — op drie plekken"**, de derde plek: *"de reset-lus in
`applyLeveling`"*. En **spec §4, "Herkomst"**: *"`applyLeveling` (idempotent herschrijven),
'nivellering wissen' en 'alles terugdraaien' raken uitsluitend leveling-gaps; importsplits zijn
brondata en blijven staan."*

Drie dingen die vandaag ontbreken, en één die de eerste twee pas waar maakt:

1. `applyLeveling` reset **álle** `levelingDelay`s. Met een scope-genivelleerd resultaat (de verdeler
   levert er niets anders) zou Toepassen dus de delays van elke taak buiten de scope wissen — precies
   het document herschikken dat `scopeTaskIds` kwam voorkomen.
2. `LevelingResult.gaps` is inert: niemand schrijft het. De hele onderbreek-modus van etappe 2 heeft
   daardoor geen effect op de opgeslagen planning.
3. `clearLeveling` wist geen leveling-gaten.
4. **En de idempotentie-voorwaarde:** `levelResources`' `workTasks`-baseline stript `levelingDelay`
   (+ de M10-velden) voor in-scope taken, maar **niet** `splitGaps`. Een tweede nivellering zou de
   leveling-gaten van de eerste als brondata lezen en er nieuwe bovenop leggen — accumulatie in
   plaats van herschrijven. De strip moet dus symmetrisch worden.

**Files:**
- Modify: `src/engine/scheduler/ResourceLeveler.ts` (`workTasks`-strip + `gapsOut`-bron)
- Modify: `src/state/slices/scheduleSlice.ts` (`applyLeveling`, `clearLeveling`)
- Modify: `src/state/runtime/createMcpTransactions.ts` (dezelfde twee)
- Modify: `src/components/layout/Ribbon/ribbonConfig.tsx` (regel ~609, de enable-check)
- Create: `tests/planning/check-apply-leveling-scope.ts`
- Modify: `tests/planning/run.sh` (registratie)

- [ ] **Step 1: Schrijf de falende test**

`tests/planning/check-apply-leveling-scope.ts`. Store-patroon: kopieer uit
`tests/planning/check-move-assignment.ts` hoe die de echte store aanspreekt.

```ts
// check-apply-leveling-scope.ts — B1c-plan3 taak 2. `applyLeveling` schrijft voortaan binnen een
// SCOPE en schrijft ook `splitGaps`; `clearLeveling` wist ook de leveling-gaten. Vier delen.

// ── Deel 1: scope-behoud ─────────────────────────────────────────────────────────────────────────
// Document met taken A, B, C. A draagt AL `levelingDelay: 2` uit een eerdere nivellering.
// applyLeveling({ delays: { C: 1 }, gaps: {} }, { scopeTaskIds: ['B', 'C'] })
eq('A behoudt zijn delay (buiten de scope)', tA.levelingDelay, 2);
eq('C krijgt zijn nieuwe delay', tC.levelingDelay, 1);
eq('B wordt binnen de scope gereset', tB.levelingDelay, undefined);
// Zónder scope blijft het gedrag byte-identiek: alles wordt gereset.
eq('geen scope ⇒ A wordt WEL gereset', tA2.levelingDelay, undefined);

// ── Deel 2: gaps schrijven ───────────────────────────────────────────────────────────────────────
// Taak D draagt een IMPORTSPLIT (`{ afterMinutes: 480, gapMinutes: 480 }`, geen source).
// applyLeveling met gaps: { D: [importsplit, { afterMinutes: 1440, gapMinutes: 480, source: 'leveling' }] }
eq('splitGaps geschreven zoals aangeleverd', tD.splitGaps?.length, 2);
eq('de importsplit staat er nog, zonder source', tD.splitGaps?.[0].source, undefined);
eq('het leveling-gat draagt zijn herkomst', tD.splitGaps?.[1].source, 'leveling');
// Idempotent: een TWEEDE applyLeveling ZONDER gaps voor D wist alleen het leveling-gat.
eq('tweede apply: alleen het leveling-gat weg', tD2.splitGaps?.length, 1);
eq('en de importsplit staat er nog', tD2.splitGaps?.[0].afterMinutes, 480);

// ── Deel 3: clearLeveling ────────────────────────────────────────────────────────────────────────
eq('clearLeveling wist het leveling-gat', tD3.splitGaps?.length, 1);
eq('en laat de importsplit staan', tD3.splitGaps?.[0].source, undefined);
// De no-op-guard telt gaten mee: een document met UITSLUITEND een leveling-gat (geen enkele delay)
// moet clearLeveling nog steeds een snapshot laten pushen en runCPM laten draaien.
ok('clearLeveling is geen no-op bij alleen een leveling-gat', undoDepthAfter > undoDepthBefore);

// ── Deel 4 (motor): de baseline is ook GAP-vrij ──────────────────────────────────────────────────
// Draai `levelResources` met allowSplits TWEE keer achter elkaar op dezelfde fixture, waarbij je de
// gaps van run 1 op de taken schrijft vóór run 2. Run 2 moet EXACT dezelfde gaps opleveren —
// accumulatie is de bug die deze case pint.
eq('nivelleren is idempotent in de onderbreek-modus',
   JSON.stringify(run2.gaps), JSON.stringify(run1.gaps));
// En out-of-scope gaten blijven staan (spiegel van de delay-regel):
eq('een leveling-gat BUITEN de scope overleeft de baseline-strip', run3.gaps['Buiten'], undefined);
ok('en de taak buiten de scope boekt nog op zijn gesplitste dagen', /* zie de fixture-toelichting */ true);
```

Registreer in `tests/planning/run.sh` (kopieer het `LEVELERSPLITSCHECK`-blok) en draai; verwacht rood
op alle vier de delen.

- [ ] **Step 2: Implementeer — de motor (idempotentie-voorwaarde)**

`src/engine/scheduler/ResourceLeveler.ts`, de `workTasks`-regel:

```ts
  // De werkkopie is de NIVELLERING-VRIJE baseline voor taken BINNEN de scope. Sinds B1c-plan3 taak 2
  // hoort `splitGaps` daar symmetrisch bij: een gat met `source === 'leveling'` is UITVOER van een
  // eerdere nivellering, precies zoals `levelingDelay` dat is. Stond het hier in de baseline, dan las
  // een tweede nivellering het als brondata en legde er nieuwe gaten bovenop — accumulatie in plaats
  // van het idempotente herschrijven dat spec §4 ("Herkomst") eist. IMPORTSPLITS (gaten zónder
  // `source`) zijn wél brondata en blijven staan; `stripLevelingGaps` hieronder is dezelfde regel als
  // `clearLevelingGaps` in taskDefaults.ts — puur, want de motor muteert de invoer nooit.
  const stripLevelingGaps = (gaps: TaskSplitGap[] | undefined): TaskSplitGap[] | undefined => {
    if (!gaps || gaps.length === 0) return gaps;
    const kept = gaps.filter(g => g.source !== 'leveling');
    return kept.length > 0 ? kept : undefined;
  };
  const workTasks: Task[] = tasks.map(t => inScope(t.id)
    ? {
        ...t,
        levelingDelay: undefined,
        levelingDelayMinutes: undefined,
        levelingDelayElapsed: undefined,
        splitGaps: stripLevelingGaps(t.splitGaps),
        time: { ...t.time },
      }
    : { ...t, time: { ...t.time } });
```

En in de hoofdlus (regel ~659): `gapsOut` moet op de **gestripte** werkkopie stapelen, niet op de
originele taak — anders komen de gaten van de vórige nivellering alsnog in het resultaat:

```ts
        const workCopy = workById.get(pick)!;
        const newGaps: TaskSplitGap[] = [
          ...(workCopy.splitGaps ?? []),   // ⇐ WAS: pickedTask.splitGaps (de ONgestripte origineel)
          ...splitGapsFromWorkDayBlocks(blocksFromDays(scatterDays, engineForTask(pickedTask)), mpd, 'leveling'),
        ];
```

Let op: `occurrenceFor`/`demandByTask` lezen elders `taskById` (de originelen). Controleer bij het
implementeren of de dagenset van een in-scope taak mét oude leveling-gaten uit `workTasks` of uit
`taskById` komt, en trek dat consistent naar `workTasks` — de baseline hóórt gap-vrij te zijn. Wijkt
dat af van wat hier staat, stop en meld het: dan raakt de strip meer plekken dan dit voorschrift
noemt.

- [ ] **Step 3: Implementeer — het schrijfpad**

`src/state/slices/scheduleSlice.ts`. Nieuw invoertype en signatuur:

```ts
  /** Wat `applyLeveling` daadwerkelijk schrijft. Een volle `LevelingResult` is hieraan toewijsbaar,
   *  dus bestaande aanroepers (LevelingDialog, MCP) blijven ongewijzigd werken; de verdeler levert
   *  alleen deze twee velden per document. */
  applyLeveling: (
    write: Pick<LevelingResult, 'delays' | 'gaps'>,
    opts?: { scopeTaskIds?: string[] },
  ) => void;
```

De reset-lus:

```ts
      // Scope-behoudend toepassen (spec §5, derde plek — B1c-plan3 taak 2). Zonder scope blijft dit
      // byte-identiek aan het gedrag van vóór B1c: alle taken worden gereset. MET scope raken we
      // uitsluitend de gescopete taken — de verdeler nivelleert per POOLITEM, dus een delay op een
      // taak die niets met dat poolitem te maken heeft is VASTE LAST waarop het voorstel gerekend
      // heeft; die hier wissen zou het document herschikken en het voorstel ongeldig maken.
      const scope = opts?.scopeTaskIds ? new Set(opts.scopeTaskIds) : null;
      for (const task of s.tasks) {
        if (scope && !scope.has(task.id)) continue;
        const d = write.delays[task.id];
        task.levelingDelay = d !== undefined && d > 0 ? d : undefined;
        if (task.levelingDelayMinutes !== undefined || task.levelingDelayElapsed !== undefined) {
          roundedCount++;
        }
        task.levelingDelayMinutes = undefined;
        task.levelingDelayElapsed = undefined;
        // De onderbreek-modus (spec §4, "Herkomst"). `write.gaps[id]` is de VOLLEDIGE te schrijven
        // waarde — importsplits inbegrepen — dus hij mag rechtstreeks. Staat de taak NIET in
        // `write.gaps`, dan levert dit voorstel voor haar geen onderbreking: wis dan haar eventuele
        // leveling-gaten van een VORIGE nivellering en laat importsplits staan. Dat is precies wat
        // "idempotent herschrijven" betekent, en het is ook wat er gebeurt zodra de gebruiker
        // "Onderbrekingen toestaan" uitzet en opnieuw toepast (`gaps` is dan `{}`).
        const g = write.gaps[task.id];
        if (g !== undefined) task.splitGaps = g.length > 0 ? g : undefined;
        else clearLevelingGaps(task);
      }
```

`clearLeveling` in dezelfde slice — de no-op-guard en de lus:

```ts
      // De guard telt sinds B1c-plan3 taak 2 ook leveling-GATEN mee: een taak die uitsluitend een
      // ingevoegde pauzedag draagt (geen enkele delay) werd hier stil overgeslagen, waardoor
      // "Nivellering wissen" die pauzedag liet staan.
      const hasLevelingGap = (t: Task) => (t.splitGaps ?? []).some(g => g.source === 'leveling');
      if (!s.tasks.some((t) =>
        t.levelingDelay !== undefined || t.levelingDelayMinutes !== undefined
        || t.levelingDelayElapsed !== undefined || hasLevelingGap(t))) return;
      runtime.beginUndoable(s);
      for (const task of s.tasks) {
        if (task.levelingDelayMinutes !== undefined || task.levelingDelayElapsed !== undefined) roundedCount++;
        task.levelingDelay = undefined;
        task.levelingDelayMinutes = undefined;
        task.levelingDelayElapsed = undefined;
        clearLevelingGaps(task); // uitsluitend `source: 'leveling'`; importsplits zijn brondata
      }
```

`src/state/runtime/createMcpTransactions.ts`: exact dezelfde twee wijzigingen in zijn
`applyLeveling`/`clearLeveling` (inclusief de `opts`-parameter en de `write`-signatuur), met het
bestaande verwijscommentaar naar de store-variant uitgebreid — de twee mogen niet uit elkaar lopen.

- [ ] **Step 4: De ribbon-enable-check**

`src/components/layout/Ribbon/ribbonConfig.tsx`, regel ~609. `hasLeveling` toetst alleen
`levelingDelay`, dus "Nivellering wissen" staat grijs op een `.mpp`-project met uitsluitend sub-dag-
precisie, én op een project dat alleen ingevoegde pauzedagen draagt:

```ts
          const hasLeveling = useAppStore(s => s.tasks.some(t =>
            t.levelingDelay !== undefined
            || t.levelingDelayMinutes !== undefined
            || t.levelingDelayElapsed !== undefined
            || (t.splitGaps ?? []).some(g => g.source === 'leveling')));
```

Houd deze conditie **letterlijk gelijk** aan de no-op-guard in `clearLeveling` (stap 3) — een knop die
inschakelt terwijl de actie een no-op is, of andersom, is de bug die dit repareert. Zet dat als
commentaarregel bij beide.

- [ ] **Step 5: Draai**

```bash
bash tests/planning/run.sh 2>&1 | tail -8; echo "exit: $?"
bash tests/mcp/run.sh 2>&1 | tail -5; echo "exit: $?"
npx tsc --noEmit -p tsconfig.json; echo "exit: $?"
```

Verwacht: exit 0, 0, 0.

- [ ] **Step 6: Commit**

```bash
git add src/engine/scheduler/ResourceLeveler.ts src/state/slices/scheduleSlice.ts \
       src/state/runtime/createMcpTransactions.ts src/components/layout/Ribbon/ribbonConfig.tsx \
       tests/planning/check-apply-leveling-scope.ts tests/planning/run.sh
git commit -m "feat(scheduler): nivellering toepassen binnen een scope, inclusief de ingevoegde pauzedagen (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: `clearLevelingGaps` bedraden op tijdbasis-bewerkingen

**Spec §4, "Invalidatie"**: *"Een bewerking die de tijdbasis van de taak raakt (duur, kalender,
handmatige datums, voortgang) wist de leveling-gaps van díé taak — een gat op een verouderde as is
geen planning maar ruis. Importsplits volgen dit niet (bestaand gedrag)."*

`clearLevelingGaps` bestaat sinds etappe-2 taak 7 en heeft **nul aanroepplekken**. De aanroepplekken
zijn precies dezelfde klasse bewerkingen die `clearTimephasedWindow` al afvangt — dat is de
discoverable regel: `grep -rn "clearTimephasedWindow" src/` wijst ze aan.

**Files:**
- Modify: elke plek uit de `clearTimephasedWindow`-grep (verwacht: `src/utils/taskDefaults.ts` als
  bron, plus de aanroepers in `taskSlice.ts`/`createMcpTransactions.ts`; verifieer dit met de grep en
  neem de werkelijke lijst over in de commit)
- Modify: `tests/planning/check-apply-leveling-scope.ts` (uitbreiding) **of** de bestaande batterij die
  `clearTimephasedWindow` al dekt — zoek die eerst met `grep -rn "clearTimephasedWindow" tests/`

- [ ] **Step 1: Breng de aanroepplekken in kaart en schrijf de falende test**

```bash
grep -rn "clearTimephasedWindow\|clearTimephasedDurationWalks" src/ tests/
```

Neem elke `src/`-aanroepplek over. Per plek één assert, in de batterij die `clearTimephasedWindow` al
dekt (geen nieuwe check aanmaken als er al een is):

```ts
// B1c-plan3 taak 3: een tijdbasis-bewerking wist de LEVELING-gaten van díé taak (spec §4,
// "Invalidatie") en laat IMPORTSPLITS staan. Per aanroepplek één geval; de vier klassen uit de spec:
//  - duur wijzigen        (setTaskDuration / duration-unit-wissel)
//  - kalender wijzigen    (taakkalender toewijzen)
//  - handmatige datums    (scheduleStart/scheduleFinish zetten, Gantt-sleep)
//  - voortgang            (completion / actualStart / actualFinish)
eq('duur wijzigen wist het leveling-gat', tAfter.splitGaps?.length, 1);
eq('en laat de importsplit staan', tAfter.splitGaps?.[0].source, undefined);
// Een taak ZONDER leveling-gaten mag door zo'n bewerking niets verliezen (contract van
// clearLevelingGaps: `false` ⇒ niets gemuteerd).
eq('een taak met alleen importsplits blijft ongemoeid', tOnlyImport.splitGaps?.length, 1);
```

- [ ] **Step 2: Implementeer**

Naast élke `clearTimephasedWindow(task)`-aanroep in `src/`:

```ts
      // B1c-plan3 taak 3 (spec §4, "Invalidatie"): dezelfde bewerking die de MSP-urensturing
      // ongeldig maakt, maakt ook een door de nivelleerder ingevoegde pauzedag ongeldig — het gat
      // ligt dan op een verouderde tijd-as. Importsplits (gaten zonder `source`) zijn brondata en
      // blijven staan; `clearLevelingGaps` doet dat onderscheid.
      clearLevelingGaps(task);
```

**GEEN melding.** Anders dan de M10-afronding (etappe-2 taak 1) is dit geen verlies van
gebruikersdata uit een importbestand maar het opruimen van app-eigen afgeleide nivelleeruitvoer op
een as die de gebruiker zelf zojuist heeft verzet. Schrijf die redenering als commentaar bij één van
de aanroepplekken op, zodat een latere lezer niet denkt dat de melding vergeten is.

- [ ] **Step 3: Draai en commit**

```bash
bash tests/planning/run.sh 2>&1 | tail -5; echo "exit: $?"
bash tests/mcp/run.sh 2>&1 | tail -5; echo "exit: $?"
```

```bash
git add -A src/ tests/
git commit -m "fix(scheduler): een tijdbasis-bewerking wist de ingevoegde pauzedagen van die taak (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: de mutatieteller op de store-runtime + de voorstel-vingerafdruk

**Spec §6a**: *"Het paneel bewaakt dit met een vingerafdruk per betrokken document: payload-referentie
voor slapers, en voor het actieve document een monotone mutatieteller die de store-runtime exposeert
(nieuw, klein — het interne undo-volgnummer zit in een closure en `undoStack.length` is onbruikbaar
door `MAX_UNDO`-trimming)."*

> **Aangepast na merge met main (sessiehistorie, 2026-09-04).** `undoStack`/`redoStack` per document
> bestaan niet meer; undo/redo is één app-globale sessiechronologie (`AppState.historyEvents`,
> `src/state/sessionHistory.ts`). De teller blijft even nodig en om dezelfde reden: een
> gecoalesceerde reeks schrijft alleen het `after` van een BESTAAND event bij, dus `historyEvents`
> beweegt dan niet, en `pruneSessionHistory` trimt van onderaf op
> `MAX_SESSION_HISTORY_EVENTS_PER_SCOPE`. De bump staat nu als eerste regel van main's
> `beginUndoable` (vóór de batch-/lease-guard én vóór de pending/nesting-tak); `pushUndoSnapshot`
> is verdwenen. De testfragmenten hieronder zijn in `check-mutation-seq.ts` omgezet naar
> `beginUndoable`/`finishUndoable` + `historyEvents`.

**KEUZE VAN DIT PLAN — de teller alléén is niet genoeg.** In de huidige runtime bumpt `undoSeq`
uitsluitend in `pushUndoSnapshot`, en `beginUndoable` slaat die aanroep over zodra een
**coalesce-reeks** loopt (een Gantt-sleep, een reeks tikken in een invoerveld). Een hele sleep zou de
teller dus niet bewegen. Daarnaast schrijft `runCPM` datums zónder snapshot. De vingerafdruk wordt
daarom **de teller PLUS de referentieset** van de velden waarop het voorstel gerekend heeft — precies
het patroon dat `ResourceOccupancyView` al gebruikt (Immer geeft bij elke mutatie een nieuwe
referentie). De teller blijft er als goedkope, monotone grofmazige backstop en omdat de spec hem
expliciet vraagt; de referenties maken hem sluitend.

**Files:**
- Modify: `src/state/runtime/storeRuntime.ts`
- Create: `src/services/library/proposalFingerprint.ts`
- Create: `tests/planning/check-mutation-seq.ts`
- Modify: `tests/planning/run.sh` (registratie)

- [ ] **Step 1: Schrijf de falende test**

```ts
// check-mutation-seq.ts — B1c-plan3 taak 4 (spec §6a). De teller is MONOTOON en beweegt bij ELKE
// undoable mutatie, óók binnen een coalesce-reeks — dat is precies waar `undoStack.length` en het
// interne undo-volgnummer tekortschieten.

const rt = createStoreRuntime();
eq('start op 0', rt.mutationSeq(), 0);
// Een gewone mutatie: snapshot gepusht ⇒ teller omhoog.
rt.beginUndoable(state);
ok('gewone mutatie bumpt', rt.mutationSeq() > 0);
// Een GECOALESCEERDE tweede mutatie pusht GEEN snapshot (undoStack groeit niet) maar is wél een
// mutatie — de teller moet er dus wél op bewegen.
const before = rt.mutationSeq();
const depthBefore = state.undoStack.length;
rt.beginUndoable(state, { coalesceKey: 'k' });
rt.beginUndoable(state, { coalesceKey: 'k' });
eq('coalesce pusht geen tweede snapshot', state.undoStack.length, depthBefore + 1);
ok('maar de teller beweegt wél', rt.mutationSeq() > before + 1);
// MAX_UNDO-trimming raakt de teller niet (dat is het hele punt van een aparte teller).
ok('teller blijft monotoon voorbij MAX_UNDO', /* 150× beginUndoable */ rt.mutationSeq() >= 150);
// Twee contexten hebben ELK hun eigen teller (geen module-global).
ok('per context', createStoreRuntime().mutationSeq() === 0 && rt.mutationSeq() > 0);

// ── De vingerafdruk ─────────────────────────────────────────────────────────────────────────────
// `documentFingerprint` is puur en vergelijkt met `===` op referentie; twee identieke maar
// verschillende arrays MOETEN een andere vingerafdruk geven (dat is de bedoeling: Immer levert bij
// elke mutatie een nieuwe referentie, en een "toevallig gelijke" inhoud is geen garantie).
ok('zelfde referenties ⇒ zelfde vingerafdruk', fpA === fpB);
ok('nieuwe tasks-referentie ⇒ andere vingerafdruk', fpA !== fpC);
```

- [ ] **Step 2: Implementeer de teller**

`src/state/runtime/storeRuntime.ts`:

```ts
export interface StoreRuntime {
  /* … bestaande leden … */
  /**
   * Monotone teller die bij ELKE undoable mutatie in deze context omhoog gaat — óók bij een
   * gecoalesceerde mutatie, die bewust géén snapshot pusht (spec §6a). Bewust NIET hetzelfde als het
   * interne `undoSeq`: dat volgnummer stuurt de coalesce-vergelijking en beweegt daarom juist niet
   * tijdens een sleepreeks, en `undoStack.length` is onbruikbaar omdat `MAX_UNDO` van onderaf trimt.
   *
   * Afnemer: de voorstel-invalidatie van de B1c-verdeeldialoog. Die combineert deze teller met de
   * REFERENTIES van de documentvelden waarop het voorstel gerekend heeft — de teller is de goedkope,
   * grofmazige backstop; de referenties maken de bewaking sluitend (`runCPM` muteert datums zonder
   * ooit langs `beginUndoable` te komen).
   */
  mutationSeq(): number;
}
```

In `createStoreRuntime`: `let mutationSeq = 0;`, en bump hem als **eerste regel** van `beginUndoable`
(vóór de batch-/lease-guard én vóór de coalesce-tak), plus in `pushUndoSnapshot`. Schrijf erbij
waarom de bump vóór de guards staat: een mutatie binnen een batch of MCP-transactie is nog steeds een
mutatie, ook al neemt de omvattende transactie de snapshot.

- [ ] **Step 3: Implementeer de vingerafdruk**

`src/services/library/proposalFingerprint.ts` — puur, geen store-import (bewaakt door
`verify:store-boundaries`):

```ts
/**
 * Vingerafdruk van de documentstate waarop een verdelingsvoorstel gerekend heeft (spec §6a).
 *
 * Referentie-gebaseerd, met opzet: Immer bevriest de state na elke producer en levert bij elke
 * mutatie een NIEUWE referentie voor het gemuteerde deel. Een vergelijking op inhoud zou duurder én
 * zwakker zijn (een gelijk-ogende takenlijst na een undo/redo is niet dezelfde planning).
 *
 * De velden zijn precies wat `computeDistribution` leest: de taken (datums, delays, gaten, prioriteit),
 * de relaties, de resources en toewijzingen (wie boekt), de kalenders, het project (statusdatum,
 * voortgangsmodus, planningsopties, bibliotheekkoppeling) en `cpmResult` (de doorgerekende cijfers
 * waar §3.1 op staat). Groeit die leeslijst, dan groeit deze functie mee — anders overleeft een
 * voorstel een bewerking die het wél ongeldig maakt.
 */
export interface FingerprintInput {
  tasks: unknown; sequences: unknown; resources: unknown; assignments: unknown;
  calendar: unknown; calendars: unknown; project: unknown; cpmResult: unknown;
  scheduleStale: unknown; datesAsRecorded: unknown;
}
export function documentFingerprint(d: FingerprintInput, mutationSeq: number): string
```

Implementatie: een `WeakMap<object, number>` met een oplopende id per geziene referentie, en de
vingerafdruk is de aaneengeschakelde id-reeks plus `mutationSeq`. Zo is de uitkomst een goedkoop te
vergelijken string zonder de objecten zelf vast te houden (de WeakMap laat ze vrij).

- [ ] **Step 4: Draai en commit**

```bash
bash tests/planning/run.sh 2>&1 | tail -5; echo "exit: $?"
npm run verify:store-boundaries; echo "exit: $?"
```

```bash
git add src/state/runtime/storeRuntime.ts src/services/library/proposalFingerprint.ts \
       tests/planning/check-mutation-seq.ts tests/planning/run.sh
git commit -m "feat(state): monotone mutatieteller per storecontext + voorstel-vingerafdruk (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: de headless scratch-instantie + de context-bewuste extensie-emitter

**Spec §5**: *"Slapende documenten gaan bij voorkeur via een headless scratch-instantie
(`createAppStoreContext()`): payload hydrateren, dezelfde acties draaien (undo-snapshot op de eigen
stack, schrijven, doorrekenen), payload terug capturen. Zo gelden `MAX_UNDO`, coalescing en het
documentcontract vanzelf."* En: *"Twee bekende singleton-randen worden expliciet dichtgezet …
(a) `runCPM` vuurt `emitExtensionEvent('schedule:calculated')` op een app-globale luisteraar-map …
de emitter wordt context-bewust/injecteerbaar en staat in de scratch-instantie uit. (b) `notify`
schrijft in de `ui.notifications` van de eigen context — in een scratch-instantie rendert niemand
die; fouten uit de scratch-run bubbelen daarom op als blokkerende reden in het voorstel, nooit als
onzichtbare melding."*

**Files:**
- Modify: `src/state/runtime/storeRuntime.ts` (`emitHostEvent` op de runtime)
- Modify: `src/state/appStore.ts` (`createAppStoreContext(opts?)`)
- Modify: elke slice die `emitExtensionEvent(HOST_EVENTS.…)` aanroept (zoek met
  `grep -rn "emitExtensionEvent(HOST_EVENTS" src/state/`)
- Create: `src/state/runtime/scratchDocument.ts`
- Create: `tests/planning/check-scratch-document.ts`
- Modify: `tests/planning/run.sh` (registratie)

- [ ] **Step 1: Schrijf de falende test**

```ts
// check-scratch-document.ts — B1c-plan3 taak 5 (spec §5). Een slapende payload wordt in een eigen
// storecontext bewerkt, en die context laat GEEN sporen na in de app-globale registers.

// ── Geval 1: de payload gaat er heel in en heel uit ──────────────────────────────────────────────
// Bouw een payload met taken/relaties/resources, draai een no-op-functie, en vergelijk veld voor
// veld met het documentcontract (loop over DOCUMENT_FIELDS — niet met de hand opsommen).
for (const f of DOCUMENT_FIELDS) eq(`round-trip: ${f.key}`, /* out[f.key] */, /* in[f.key] */);

// ── Geval 2: de echte acties draaien, met echte undo-semantiek ───────────────────────────────────
// applyLeveling in de scratch-context ⇒ delays geschreven, ÉÉN undo-stap op de EIGEN stack, en
// `runCPM` heeft gedraaid (cpmResult vers, scheduleStale false).
// AANGEPAST NA MERGE MET MAIN (2026-09-04): de scratch-context heeft geen eigen undo-STACK meer om
// op te tellen — zijn `historyEvents` worden mét de context weggegooid (zie de noot bij taak 6). Wat
// blijft is dat de ECHTE actie draait: `check-scratch-document.ts` toetst nu de geschreven delay,
// `isDirty`, de verse `cpmResult` en de doorgerekende datums, plus dat een payload per constructie
// geen sessiehistorie kan dragen.
eq('doorgerekend + geschreven', out.payload.tasks.find(t => t.id === 'B')!.levelingDelay, 2);
eq('doorgerekend', out.scheduleStale, false);
ok('nieuwe datums geschreven', out.tasks.find(t => t.id === 'B')!.time.earlyStart !== beforeStart);

// ── Geval 3: de extensie-emitter zwijgt ─────────────────────────────────────────────────────────
// Abonneer op HOST_EVENTS.scheduleCalculated via de app-globale bus, draai runCPM in de scratch-
// context, en tel: NUL events. Draai daarna runCPM op een gewone context: WÉL een event.
eq('scratch-run vuurt geen extensie-event', seen.length, 0);
ok('een gewone context vuurt dat wél', seenNormal.length > 0);

// ── Geval 4: meldingen komen naar buiten in plaats van te verdwijnen ────────────────────────────
// Draai een functie die een cyclus veroorzaakt (runCPM met een relatiecyclus). De scratch-run levert
// de melding(en) terug bij de AANROEPER in plaats van ze in een onzichtbare ui.notifications te
// laten belanden.
ok('fouten uit de scratch-run bubbelen op', res.notifications.some(n => n.messageKey === 'notifications.scheduleFailed'));
eq('en niets landde in een onzichtbaar meldingenkanaal', /* ctx.store.getState().ui.notifications.length */ 0);

// ── Geval 5: geen sporen in de app-globale registers ────────────────────────────────────────────
// Vóór en ná: extensie-instanties, de eventbus-luisteraarslijst en de bibliotheek-persistentie zijn
// onveranderd; `appStoreContext.store.getState()` is byte-identiek (vergelijk capturePayload).
ok('de app-store is onaangeraakt', JSON.stringify(capturePayload(appStoreContext.store.getState())) === appBefore);
```

- [ ] **Step 2: Implementeer de context-bewuste emitter**

`storeRuntime.ts`:

```ts
export interface StoreRuntimeOptions {
  /** `false` ⇒ deze context zendt GEEN host-events uit (spec §5, rand (a)). Gebruikt door de
   *  scratch-instantie: extensies zijn app-globaal geregistreerd en zouden anders cijfers krijgen
   *  van een document waar de gebruiker niet naar kijkt. Default `true`. */
  emitHostEvents?: boolean;
}

export interface StoreRuntime {
  /* … */
  /** Zend een host-lifecycle-event uit namens DEZE context. Slices roepen dit aan in plaats van
   *  `emitExtensionEvent` rechtstreeks — de bus zelf blijft app-globaal (dat hoort zo: extensies
   *  zijn app-niveau), maar of een context er iets op zet is nu een eigenschap van die context. */
  emitHostEvent(event: HostEventName, data?: unknown): void;
}
```

Implementatie: `emitHostEvent: opts?.emitHostEvents === false ? () => {} : emitExtensionEvent`.

Vervang in `src/state/slices/*.ts` elke `emitExtensionEvent(HOST_EVENTS.x, …)` door
`runtime.emitHostEvent(HOST_EVENTS.x, …)`. Slices die vandaag geen `runtime` krijgen (`createViewSlice`,
`createUiSlice`, `createExtensionSlice`) roepen 'm sowieso niet aan; controleer dat met de grep en meld
het als het wél zo is.

`appStore.ts`: `createAppStoreContext(opts?: StoreRuntimeOptions)` geeft `opts` door aan
`createStoreRuntime`. De app-singleton blijft `createAppStoreContext()` — default aan, gedrag
ongewijzigd.

- [ ] **Step 3: Implementeer de scratch-instantie**

`src/state/runtime/scratchDocument.ts`:

```ts
/**
 * Draai een bewerking op een SLAPENDE documentpayload in een eigen, headless storecontext
 * (spec §5, "Toepassen: schrijven in meerdere documenten").
 *
 * Waarom niet gewoon de payload spreaden zoals `recalculateStaleSleepingDocuments` doet: die route
 * omzeilt `beginUndoable` en moet `MAX_UNDO`-trimming en coalescing zelf naborgen. Hier draaien de
 * ECHTE acties op een echte context, dus het documentcontract, de undo-semantiek en de
 * transactie-runtime gelden vanzelf.
 *
 * (AANGEPAST NA MERGE MET MAIN, 2026-09-04: hier stond "en dat is precies wat 'alles terugdraaien'
 * (taak 6) nodig heeft: een échte undo-stap op de eigen stack van dat document". Dat klopt niet
 * meer — de sessiehistorie is app-globaal en die van een scratch-context wordt weggegooid. De
 * scratch-instantie blijft nuttig omdat hij de ECHTE acties draait; het history-event registreert
 * de aanroeper zelf, zie taak 6.)
 *
 * Twee singleton-randen staan dicht (spec §5):
 *  (a) host-events — de context wordt met `emitHostEvents: false` gebouwd, zodat extensies geen
 *      cijfers krijgen van een document waar de gebruiker niet naar kijkt;
 *  (b) meldingen — `ui.notifications` van deze context rendert niemand. Ze worden na afloop
 *      LEEGGEHAALD en aan de aanroeper teruggegeven, zodat een fout (cyclus, lege kalender) als
 *      blokkerende reden zichtbaar wordt in plaats van geruisloos te verdwijnen.
 *
 * De context is puur lokaal: hij wordt niet bewaard, niet geregistreerd en niet hergebruikt. App-
 * globale registers (extensie-instanties, MCP, bibliotheek-persistentie) worden niet aangeraakt —
 * die leven buiten de Zustand-factory.
 */
export interface ScratchRunResult<T> {
  /** De payload ná de bewerking — klaar om in `documents[i].payload` gezet te worden. */
  payload: DocumentPayload;
  result: T;
  /** Wat de scratch-context in zijn onzichtbare meldingenkanaal zou hebben gezet. */
  notifications: NotifyInput[];
  /** `false` wanneer `fn` een exception gooide; `payload` is dan de ONGEWIJZIGDE invoer. */
  ok: boolean;
  error?: string;
}

export function runInScratchDocument<T>(
  payload: DocumentPayload,
  fn: (state: AppState) => T,
): ScratchRunResult<T>
```

Implementatie in vier stappen, met dit commentaar erbij:

```ts
  const ctx = createAppStoreContext({ emitHostEvents: false });
  // 1. Hydrateren via het documentcontract — dezelfde functie die `switchDocument` gebruikt, dus
  //    élk (ook toekomstig) documentveld rijdt automatisch mee.
  ctx.store.setState((s) => { hydratePayload(s, payload); });
  // 2. De ECHTE acties draaien. `fn` krijgt de state (met alle acties erop) en mag alles doen wat een
  //    gewone gebruiker zou doen — inclusief `applyLeveling`, dat zelf zijn snapshot pusht en
  //    `runCPM` draait.
  let result: T; let ok = true; let error: string | undefined;
  try { result = fn(ctx.store.getState()); }
  catch (e) { ok = false; error = String(e); }
  // 3. Meldingen oogsten en het kanaal legen (rand (b)).
  const notifications = harvestNotifications(ctx);
  // 4. Terug capturen. Bij een mislukking geven we de ONGEWIJZIGDE invoerpayload terug: net als
  //    `recalculateStaleSleepingDocuments` mag een halve mutatie nooit terug de registry in.
  return { payload: ok ? capturePayload(ctx.store.getState()) : payload, result, notifications, ok, error };
```

Controleer bij het implementeren of `ui.notifications` in `uiSlice` de vorm heeft die
`harvestNotifications` aanneemt (id/severity/messageKey); wijkt dat af, volg de werkelijke vorm en
noteer dat in het docblok.

- [ ] **Step 4: Draai**

```bash
bash tests/planning/run.sh 2>&1 | tail -8; echo "exit: $?"
bash tests/mcp/run.sh 2>&1 | tail -5; echo "exit: $?"
npm run verify:cycles; echo "exit: $?"
npm run verify:store-boundaries; echo "exit: $?"
```

Verwacht: exit 0 ×4. Let op `verify:cycles`: `state/runtime/scratchDocument` importeert
`state/appStore` (voor `createAppStoreContext`) én `state/documentContract`. Ontstaat daar een cyclus,
dan hoort de factory-import losgetrokken te worden (injecteer `createAppStoreContext` als parameter met
een default) — meld het als je die route neemt.

- [ ] **Step 5: Commit**

```bash
git add src/state/runtime/storeRuntime.ts src/state/appStore.ts src/state/runtime/scratchDocument.ts \
       src/state/slices/ tests/planning/check-scratch-document.ts tests/planning/run.sh
git commit -m "feat(state): headless scratch-instantie voor slapende documenten, met stille host-events (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: `applyDistribution` / `undoDistribution` — het schrijfpad over meerdere documenten

**Spec §5** in zijn geheel. Dit is het hart van de etappe: één klik schrijft in élk deelnemend
document, met per document een échte undo-stap, en de "toegepast"-strook kan alles in één keer
terugdraaien.

> **Aangepast na merge met main (sessiehistorie, 2026-09-04).** Wat de spec vraagt verandert niet
> ("per document een gewone undo-stap; 'alles terugdraaien' draait de undo-stap van elk beschreven
> document terug"), maar het mechanisme wel — er is geen `undoStack` per document meer.
>
> - `DistributionApplyRecord.docs[]` draagt in plaats van `undoDepthAfterApply` het
>   **`historyEventId`** (+ `historySequence`) van het event dat het toepassen voor dát document
>   achterliet. Een diepte is geen identiteit meer: de chronologie is app-globaal, dus een
>   bewerking in een ánder document verschuift 'm ook, en `pruneSessionHistory` trimt van onderaf.
> - Voor een SLAPEND document registreert `applyDistribution` dat event zelf, in dezelfde producer
>   waarin het de payload terugschrijft: `recordSessionHistoryDeltas(s, 'Verdeling toepassen',
>   [{ kind: 'document-data', documentId, before: snapshotOfPayload(oudePayload),
>   after: snapshotOfPayload(nieuwePayload) }])`. `snapshotOfPayload` (nieuw in
>   `src/state/snapshot.ts`) is de payload-tegenhanger van `createSnapshot`: key-gedreven over
>   `DOCUMENT_FIELDS`, dezelfde rolregel, alles per referentie.
> - Voor het ACTIEVE document blijft `get().applyLeveling(write, { scopeTaskIds })` het pad; het
>   event wordt daarna teruggezocht als het jongste toegepaste `document-data`-event voor dat
>   document met `sequence >= nextHistorySequence-van-vóór-de-aanroep`. Dat `applyLeveling` →
>   `runCPM` het `after` van datzelfde event ververst (`refreshLatestDocumentDataHistoryAfter`) is
>   gewenst: de doorgerekende datums horen in dezelfde ene undo-stap.
> - `undoDistribution` poort per document op: het event bestaat, staat op `applied`, en is het event
>   dat `selectUndoHistoryEvent(historyEvents, docId)` NU zou kiezen. Anders `skippedDocIds`. Het
>   actieve document gaat via `get().undo()`; een slaper krijgt de `before`-snapshot over zijn
>   payload gespreid (`isDirty: true`, `resourceLoadResult: null`) en zijn event op `undone`, zodat
>   redo daarna gewoon via `redo()` loopt zodra je dat document activeert.
> - Een GESLOTEN document valt vanzelf in `skippedDocIds`: `removeSessionHistoryForDocument` heeft
>   zijn events dan al opgeruimd.

**Plaatsing:** op `librarySlice` (die is app-globaal, net als de verdeler zelf, en importeert al
`services/library`). Er komt **geen** nieuw top-level state-veld bij: het toegepast-record woont in
`ui` (taak 8). Zo blijven de contract-asserties in `documentContract.ts` ongewijzigd.

**Files:**
- Modify: `src/state/slices/librarySlice.ts`
- Create: `src/services/library/applyDistribution.ts` (de pure voorbereiding: wat wordt er per document
  geschreven, en mag het überhaupt)
- Create: `tests/library/check-apply-distribution.ts`
- Modify: `tests/library/run.sh` (`run_check check-apply-distribution`)

- [ ] **Step 1: Schrijf de falende test**

```ts
// check-apply-distribution.ts — B1c-plan3 taak 6 (spec §5/§9 "Store-niveau"). Toepassen schrijft in
// het actieve document én in de slapers; "alles terugdraaien" zet alles terug, inclusief de
// doorrekening. Bouw de fixtures met `createAppStore()` + `newDocument()` (echte documenten, echte
// payloads) en de bouwstenen uit `check-distribute.ts`.

// ── Geval 1: geblokkeerd voorstel schrijft NIETS ─────────────────────────────────────────────────
eq('blocked ⇒ geen record', store.applyDistribution(blockedProposal), null);
ok('en geen enkel document is aangeraakt', unchanged(store));

// ── Geval 2: tekort blokkeert Toepassen (spec §4 stap 3) ─────────────────────────────────────────
eq('hasShortfall ⇒ geen record', store.applyDistribution(shortfallProposal), null);

// ── Geval 3: schrijven over actief + slapend ─────────────────────────────────────────────────────
eq('het actieve document kreeg zijn delays', activeTaskAfter.levelingDelay, 2);
eq('het slapende document ook', sleepingPayload.tasks.find(t => t.id === 'S1')!.levelingDelay, 1);
ok('en de DOORREKENING is gepersisteerd (spec §5)', sleepingPayload.scheduleStale === false
   && sleepingPayload.cpmResult !== null);
eq('beide documenten staan als gewijzigd', sleepingPayload.isDirty, true);
// Toepassen schrijft ONVOORWAARDELIJK, ook met "Automatisch berekenen" UIT (spec §11.5).
ok('ook in handmatige modus geschreven', store.ui.autoCalcCPM === false && sleepingPayload.cpmResult !== null);

// ── Geval 4: scope-behoud over de documentgrens ─────────────────────────────────────────────────
// Een taak in het slapende document die NIET op dit poolitem boekt en al een levelingDelay droeg,
// houdt die. Dat is taak 2's scope-behoud, hier via het schrijfpad bewezen.
eq('out-of-scope delay overleeft Toepassen', sleepingPayload.tasks.find(t => t.id === 'Buiten')!.levelingDelay, 3);

// ── Geval 5: onderbrekingen worden echt geschreven ──────────────────────────────────────────────
eq('splitGaps geschreven met herkomst', gapTask.splitGaps?.some(g => g.source === 'leveling'), true);

// ── Geval 6: per document ÉÉN undo-stap, en gewone Ctrl+Z werkt ─────────────────────────────────
// Sessiehistorie (2026-09-04): geen stack-lengtes meer maar event-tellingen — `historyDepthsFor
// ActiveScope(...).undoDepth` voor het actieve document, en een filter op `document-data`-deltas
// voor de slaper (diens events liggen buiten de actieve scope).
eq('actief: één stap erbij', historyDepthsForActiveScope(store).undoDepth, activeDepthBefore + 1);
eq('slapend: één history-event erbij', eventsFor(sleepDocId, 'applied'), sleepEventsBefore + 1);
// Activeer het slapende document en druk gewoon undo: dat draait ALLEEN dat document terug.
ok('per-document-undo herstelt dat ene document', /* … */ true);

// ── Geval 7: "alles terugdraaien" ───────────────────────────────────────────────────────────────
eq('undoDistribution slaagt', store.undoDistribution(record), true);
ok('actief document terug bij af (datums én delays)', deepEqual(activeAfterUndo, activeBefore));
ok('slapend document terug bij af, inclusief cpmResult', deepEqual(sleepAfterUndo, sleepBefore));

// ── Geval 8: terugdraaien weigert wat het niet meer herkent ─────────────────────────────────────
// Bewerk ná het toepassen het slapende document (een extra undo-stap erbovenop). "Alles terugdraaien"
// mag DAT document dan niet blind terugpoppen — het zou de verkeerde stap ongedaan maken.
eq('gedeeltelijk terugdraaien meldt welk document overgeslagen is',
   store.undoDistributionReport?.skippedDocIds, ['doc-slaper']);

// ── Geval 9: geen sporen in de app-globale registers (spec §9 "Store-niveau") ────────────────────
ok('extensie-events zijn niet gevuurd voor slapende documenten', seenScheduleCalculated.length <= 1);
```

Registreer in `tests/library/run.sh` en draai; verwacht rood.

- [ ] **Step 2: Implementeer de pure voorbereiding**

`src/services/library/applyDistribution.ts` — puur, geen store:

```ts
/** Wat er per document geschreven moet worden. Afgeleid uit het voorstel, zodat de store-actie geen
 *  eigen interpretatie van `DistributionDocResult` heeft (en de test die afleiding los kan pinnen). */
export interface DistributionWrite {
  docId: string;
  scopeTaskIds: string[];
  write: { delays: Record<string, number>; gaps: Record<string, TaskSplitGap[]> };
}

/** `null` ⇒ dit voorstel mag NIET geschreven worden, met de reden erbij. Spec §3.1 (geblokkeerd) en
 *  §4 stap 3 (een voorstel mét tekorten is een geldige preview maar blokkeert Toepassen). */
export type DistributionWritePlan =
  | { ok: true; writes: DistributionWrite[] }
  | { ok: false; reason: 'blocked' | 'shortfall' | 'nothing-to-write' };

export function planDistributionWrites(
  proposal: DistributionProposal,
  scopeTaskIdsByDoc: Record<string, string[]>,
): DistributionWritePlan
```

Regels, letterlijk als commentaar erbij:
- `proposal.blocked !== null` ⇒ `{ ok: false, reason: 'blocked' }`.
- `proposal.hasShortfall` ⇒ `{ ok: false, reason: 'shortfall' }`.
- Alleen `docs` met `participated === true && cannotMove === false` leveren een write. Gepinde,
  #63- en `cannotMove`-documenten worden per definitie **nooit** beschreven (spec §3.3a/§6).
- Geen enkele write ⇒ `'nothing-to-write'` (het voorstel verandert niets; Toepassen is dan zinloos,
  niet fout).

- [ ] **Step 3: Implementeer de store-acties**

`librarySlice.ts`:

```ts
  /** Toepassen (spec §5). Schrijft het voorstel in élk deelnemend document — het actieve via het
   *  gewone top-level-pad, de slapers via een headless scratch-instantie — en geeft een record terug
   *  waarmee de "toegepast"-strook alles in één keer kan terugdraaien. `null` ⇒ er is niets
   *  geschreven (geblokkeerd, tekort, of niets te doen). */
  applyDistribution: (
    proposal: DistributionProposal,
    scopeTaskIdsByDoc: Record<string, string[]>,
  ) => DistributionApplyRecord | null;

  /** "Alles terugdraaien" (spec §5): draait per beschreven document precies de undo-stap terug die
   *  `applyDistribution` daar heeft achtergelaten. Geeft terug welke documenten wél en welke NIET
   *  konden (zie de bewaking hieronder). */
  undoDistribution: (record: DistributionApplyRecord) => DistributionUndoReport;
```

```ts
export interface DistributionApplyRecord {
  libraryItemId: string;
  appliedAt: string;               // ISO — puur voor de strooktekst
  docs: Array<{
    docId: string;
    title: string;
    /** AANGEPAST NA MERGE MET MAIN (2026-09-04): was `undoDepthAfterApply: number`. Nu het
     *  history-event zelf. "Alles terugdraaien" pakt alleen een document waarvan dit event er nog
     *  is, nog op `applied` staat, én nog het event is dat een gewone Ctrl+Z voor dat document zou
     *  kiezen — heeft de gebruiker er intussen zelf in gewerkt, dan zou terugdraaien de VERKEERDE
     *  stap ongedaan maken. Dan slaan we dat document over en melden we het
     *  (`DistributionUndoReport.skippedDocIds`). In de praktijk zeldzaam: §6a laat het voorstel al
     *  vervallen zodra een betrokken document muteert, en de strook verdwijnt daarmee. */
    historyEventId: string;
    historySequence: number;
  }>;
}
export interface DistributionUndoReport { undoneDocIds: string[]; skippedDocIds: string[] }
```

De uitvoeringsvolgorde in `applyDistribution` (schrijf deze motivering erbij — het is de
atomiciteitsgarantie, gespiegeld aan `recalculateStaleSleepingDocuments`):

1. `planDistributionWrites(...)`; `ok === false` ⇒ `return null`.
2. **Fase 1 — buiten de producer:** voor élke slapende write een `runInScratchDocument(payload, s =>
   s.applyLeveling(write, { scopeTaskIds }))`. Verzamel de nieuwe payloads. Faalt er één
   (`ok === false`), dan **stopt de hele actie** en is er nog niets gemuteerd: `return null`, en push
   de opgeviste `notifications` van die run door naar `get().notify(...)` zodat de fout zichtbaar
   wordt (spec §5, rand (b) — nooit een onzichtbare melding).
3. **Het actieve document** (als het meedoet) via het gewone pad:
   `get().applyLeveling(write, { scopeTaskIds })`. Dat pusht zijn eigen snapshot en draait `runCPM`.
4. **Fase 2 — één producer:** de nieuwe slaper-payloads in `s.documents[i].payload` zetten.
   Sla een document over dat intussen gesloten of geactiveerd is (`entry.payload === null`), exact
   zoals `recalculateStaleSleepingDocuments` dat doet.
5. Bouw en retourneer het record (met het `historyEventId` per document — 2026-09-04: was
   `undoStack.length` ná het schrijven).

Roep vóór stap 2 `runtime.resetUndoCoalescing()` aan: een lopende coalesce-reeks (Gantt-sleep,
tikken in een invoerveld) zou anders het `after` van dát oudere event bijschrijven in plaats van een
eigen event op te leveren — en dan is er geen event om in het record te zetten.

`undoDistribution`: per document uit het record — het actieve via `get().undo()`, een slaper door de
`before`-snapshot van zijn event over de payload te spreiden en dat event op `undone` te zetten —
maar **alleen** wanneer de poort hierboven slaagt. Verzamel `undoneDocIds`/`skippedDocIds`. Ook hier:
eerst alles puur bepalen, dan één producer. (2026-09-04: was "een slaper via
`runInScratchDocument(payload, s => s.undo())` … wanneer de undo-diepte nog klopt". Een scratch-undo
kan niet meer: de undo-historie van een slaper leeft in de ECHTE store, niet in zijn payload.)

- [ ] **Step 4: Draai**

```bash
bash tests/library/run.sh 2>&1 | tail -8; echo "exit: $?"
bash tests/planning/run.sh 2>&1 | tail -5; echo "exit: $?"
npm run verify:store-boundaries; echo "exit: $?"
```

- [ ] **Step 5: Commit**

```bash
git add src/services/library/applyDistribution.ts src/state/slices/librarySlice.ts \
       tests/library/check-apply-distribution.ts tests/library/run.sh
git commit -m "feat(library): verdeling toepassen en in één keer terugdraaien over meerdere documenten (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: de i18n-pass — reden-taxonomie + alle dialoogteksten, veertien locales

**Spec §8**: *"Volledig via `t(...)`, veertien talen, CLDR-pluralen (dag/dagen-teksten!)."* Etappe 2
stelde deze pass bewust uit (één sleutel toevoegen kost veertien bestanden); hier gebeurt hij in één
keer, vóór de UI-taken, zodat die alleen nog `t(...)` hoeven te consumeren.

Twee delen: **(a)** de reden-taxonomie, met een gedeelde mapping die `LevelingDialog` en de nieuwe
verdeeldialoog allebei gebruiken, en **(b)** de complete dialoogsleutelset.

**Files:**
- Create: `src/utils/levelingReasonKey.ts`
- Modify: `src/components/dialogs/LevelingDialog.tsx` (de if/else-keten vervangen)
- Modify: `src/i18n/locales/{nl,en,fr,de,es,zh,it,pt,pl,tr,ar,ja,ko,fa}/common.json`
- Modify: `tests/library/check-i18n-plurals.ts` (of de batterij die dat bestand al dekt)

- [ ] **Step 1: De gedeelde reden-mapping**

`src/utils/levelingReasonKey.ts`:

```ts
/**
 * `LevelingReason` → i18n-sleutel. Eén mapping voor de nivelleerdialoog én de B1c-verdeeldialoog;
 * vóór B1c-etappe-3 stond dit als een if/else-keten in `LevelingDialog.tsx` die drie van de zeven
 * codes kende en de rest ZONDER uitleg liet — een horizon-uitputting las daar als "onvoldoende
 * capaciteit".
 *
 * Het `satisfies Record<LevelingReason, string>` is de poort: een nieuw lid in de taxonomie zonder
 * sleutel geeft een COMPILE-fout in plaats van een stilzwijgend lege uitleg.
 */
export const LEVELING_REASON_KEY = {
  CALENDAR_MISMATCH:    'resource.leveling.reason.calendarMismatch',
  INSUFFICIENT_CAPACITY:'resource.leveling.reason.insufficientCapacity',
  INTRINSIC_OVERRUN:    'resource.leveling.reason.intrinsicOverrun',
  CEILING_TOO_TIGHT:    'resource.leveling.reason.ceilingTooTight',
  CEILING_UNREACHABLE:  'resource.leveling.reason.ceilingUnreachable',
  NO_WINDOW_IN_HORIZON: 'resource.leveling.reason.noWindowInHorizon',
  RESIDUAL_FULL:        'resource.leveling.reason.residualFull',
} as const satisfies Record<LevelingReason, string>;

/** `DistributionBlockReason` → i18n-sleutel; zelfde `satisfies`-poort. */
export const DISTRIBUTION_BLOCK_KEY = {
  UNCOUNTED_DOCUMENT: 'resource.distribution.blocked.uncounted',
  MATERIAL_ITEM:      'resource.distribution.blocked.material',
  NO_DEMAND:          'resource.distribution.blocked.noDemand',
} as const satisfies Record<DistributionBlockReason, string>;
```

`LevelingDialog.tsx`: vervang de if/else-keten door `t(LEVELING_REASON_KEY[reason])`, met behoud van
de bestaande `INTRINSIC_OVERRUN`-tak (die heeft interpolatie: resource/peak/capacity — houd dáárvoor
de bestaande sleutel `resource.leveling.intrinsicOverrun` en laat de mapping ernaar wijzen, of
verplaats hem naar `reason.intrinsicOverrun` en werk de aanroep bij; kies één en schrijf op welke).

- [ ] **Step 2: De NL-bronsleutels**

`src/i18n/locales/nl/common.json`. Uitbreiding van `resource.leveling.reason`:

```json
"reason": {
  "calendarMismatch": "De resource werkt niet op alle dagen die deze taak nodig heeft — verschuiven lost dit niet op.",
  "insufficientCapacity": "Onvoldoende vrije capaciteit binnen de speling om dit conflict op te lossen.",
  "ceilingTooTight": "Het uitloop-plafond laat te weinig ruimte: binnen dat aantal werkdagen is geen vrij venster.",
  "ceilingUnreachable": "Uitloop geven helpt hier niet — een deadline of constraint houdt deze taak op zijn plek.",
  "noWindowInHorizon": "Binnen de doorzochte periode is geen vrij venster gevonden; verderop is het onbekend.",
  "residualFull": "De eigen inzet had ruimte, maar de restcapaciteit van de bibliotheek is op — andere projecten bezetten hem."
}
```

Nieuwe sectie `resource.distribution` (volledige lijst; de dialoog gebruikt uitsluitend deze):

| sleutel | NL |
|---|---|
| `open` | Verdelen… |
| `title` | Verdelen over projecten |
| `back` | Terug naar bezetting |
| `subtitle` | {{item}} — restcapaciteit verdelen over de geopende projecten |
| `blocked.uncounted` | Eerst doorrekenen: {{docs}} is nog niet berekend, dus er valt niets tegen te verdelen. |
| `blocked.material` | Dit is een materiaal-item; verdelen werkt alleen voor mensen en materieel. |
| `blocked.noDemand` | Geen van de projecten boekt hier daadwerkelijk werk op. |
| `tool.title` | Gereedschap |
| `tool.allowSplits` | Onderbrekingen toestaan |
| `tool.allowSplitsHint` | Het werk mag pauzedagen krijgen in plaats van in één stuk op te schuiven. In MS Project heet dit "Leveling can create splits in remaining work". |
| `tool.price_one` | kost {{count}} werkdag uitloop |
| `tool.price_other` | kost {{count}} werkdagen uitloop |
| `tool.priceNone` | kost geen uitloop |
| `tool.priceUnknown` | prijs onbekend — druk op Herbereken |
| `rank.title` | Wie wordt het meest ontzien? |
| `rank.hint` | Bovenaan wijkt het minst. Sleep om de volgorde te veranderen. |
| `rank.float` | speling: {{days}} |
| `rank.cost_one` | alleen dit project laten opschuiven kost {{count}} werkdag |
| `rank.cost_other` | alleen dit project laten opschuiven kost {{count}} werkdagen |
| `rank.costNone` | alleen dit project laten opschuiven kost geen uitloop |
| `rank.moveUp` | Naar boven |
| `rank.moveDown` | Naar beneden |
| `strip.pin` | Vastzetten |
| `strip.pinned` | Vastgezet — dit project wijkt niet en houdt ook zijn werkdagen |
| `strip.pinnedRecorded` | Vastgezet: datums zoals opgeslagen |
| `strip.cannotMove` | Kan niet wijken — al het werk hier staat vast |
| `strip.fixedLoad` | Vaste last |
| `strip.ceiling` | Maximale uitloop van de einddatum |
| `strip.ceilingUnlimited` | onbegrensd |
| `strip.ceilingDays_one` | plafond {{count}} werkdag |
| `strip.ceilingDays_other` | plafond {{count}} werkdagen |
| `strip.endUnchanged` | eind ongewijzigd |
| `strip.endShift_one` | eind +{{count}} dag |
| `strip.endShift_other` | eind +{{count}} dagen |
| `strip.requestedVsAchievable` | gevraagd {{requested}}, dichtst haalbare {{achievable}} |
| `strip.handleLabel` | Uitloop-plafond voor {{doc}} |
| `compute.recalculate` | Herbereken |
| `compute.auto` | Verdeel automatisch |
| `compute.busy` | Bezig met verdelen… |
| `compute.pressRecompute` | — druk op Herbereken |
| `compute.degraded` | Dit is een groot overzicht; het rekent alleen wanneer je op Herbereken drukt. |
| `stale.rank` | De volgorde is gewijzigd — herbereken om het effect te zien. |
| `stale.ceiling` | Een plafond is gewijzigd — herbereken om het effect te zien. |
| `stale.pin` | Een vastzetting is gewijzigd — herbereken om het effect te zien. |
| `stale.tool` | Het gereedschap is gewijzigd — herbereken om het effect te zien. |
| `stale.edited` | Er is iets gewijzigd in {{docs}} — dit voorstel is niet meer actueel. |
| `stale.documents` | De geopende projecten zijn veranderd — dit voorstel is niet meer actueel. |
| `shortfall.title` | Blijft over |
| `shortfall.doc` | {{doc}}: {{count}} taak past niet |
| `shortfall.doc_other` | {{doc}}: {{count}} taken passen niet |
| `preview.before` | Nu |
| `preview.after` | Na verdelen |
| `preview.capacity` | Capaciteit |
| `apply` | Toepassen |
| `discard` | Verwerpen |
| `applyBlockedShortfall` | Los eerst het tekort op — of zet een plafond ruimer, of laat onderbrekingen toe. |
| `applyBlockedNothing` | Er valt niets toe te passen: dit voorstel verandert niets. |
| `applied_one` | Toegepast in {{count}} project. |
| `applied_other` | Toegepast in {{count}} projecten. |
| `undoAll` | Alles terugdraaien |
| `undoneAll` | Alles is teruggedraaid. |
| `undonePartial` | Teruggedraaid, behalve {{docs}} — daar is intussen in gewerkt. |
| `selectHint` | Kies een bibliotheekitem met een conflict om te gaan verdelen. |

- [ ] **Step 3: De dertien vertalingen**

Vertaal élke sleutel naar `en, fr, de, es, zh, it, pt, pl, tr, ar, ja, ko, fa`, met de juiste
**CLDR-pluralcategorieën** per taal (CLAUDE.md, i18n-paragraaf):
- `zh`/`ja`/`ko` kennen géén `one` ⇒ **geen** `_one`-variant;
- `pl` heeft ook `_few` en `_many`;
- `es`/`fr`/`it`/`pt` hebben ook `_many` (in dit project gelijk aan `_other`, want `{{count}}` wordt
  altijd in cijfers weergegeven).
De pluralsleutels in de tabel hierboven zijn: `tool.price`, `rank.cost`, `strip.ceilingDays`,
`strip.endShift`, `shortfall.doc`, `applied`.

- [ ] **Step 4: Draai**

```bash
npm run verify:i18n; echo "exit: $?"
bash tests/library/run.sh 2>&1 | tail -5; echo "exit: $?"
npx tsc --noEmit -p tsconfig.json; echo "exit: $?"
```

Verwacht: exit 0, 0, 0. `verify:i18n` is hier de hoofdpoort; hij rekent met CLDR-categorieën, dus een
`_one` in `zh` is net zo goed fout als een ontbrekende `_many` in `pl`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/levelingReasonKey.ts src/components/dialogs/LevelingDialog.tsx src/i18n/locales tests/
git commit -m "feat(i18n): reden-taxonomie en verdeeldialoogteksten in veertien talen (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 8: de verdeeldialoog — ingang, ui-state en de voorstel-berekening

**Spec §7** (plek in de UI) en **§3.4** (discrete rekenmomenten, bezig-toestand, schaal-degradatie).

**Besluit eigenaar 2026-08-31 — losse dialoog, geen drill-down.** Dit plan koos in zijn eerste versie
een drill-down binnen `ResourceOccupancyView` (KEUZE VAN DIT PLAN, hieronder had gestaan waarom).
De eigenaar heeft die keuze **teruggedraaid**: de verdeelflow wordt een **losse dialoog**, via de
gedeelde `Dialog`-component (focus-trap) en de `hasBlockingDialogOpen`-guard, gemount vanuit `App.tsx`
achter een eigen `ui.show*`-vlag — conform de bestaande dialoogconventies (CLAUDE.md: "Global dialogs
… mount from `App.tsx` behind `ui.show*` flags"; "native alleen bestandskiezers"). Het patroon is
letterlijk dat van `showLevelingDialog`/`LevelingDialog.tsx`: een sessie-boolean in `UIState`, een
`use`-callback op een ribbonknop die 'm zet, en een `{showX && <XDialog />}`-regel in `App.tsx`. De
dialoog moet groot genoeg zijn voor histogram + N fasestroken + rangordelijst + knoppenbalk — qua
chrome-opbouw (header/Esc/backdrop/Enter, `max-h-[90vh]`, scroll binnenin) naar het patroon van
`ProjectInfoDialog` (die gebruikt `w-[560px]`), maar merkbaar breder omdat de inhoud een werkoppervlak
is en geen formulier — richt op iets in de orde van `w-[960px] max-w-[95vw]`.

De **ingang** blijft de conflictregel in `ResourceOccupancyView` (zet de ui-state en de open-vlag);
daarnaast komt er, analoog aan hoe nivelleren dat al doet (`ribbonConfig.tsx`, regel ~603:
`use: () => { const setUI = useAppStore(s => s.setUI); return { onClick: () => setUI({
showLevelingDialog: true }) }; }`), een knop op de Resources-ribbon die de dialoog opent — met het
laatst gebruikte bibliotheekitem/`companyId` als voorinvulling, of, zonder een eerder geopend item, de
dialoog met `selectHint` totdat de gebruiker via het bezettingsoverzicht een conflict kiest.

Gedrag bij documentwissel (spec §6a: het voorstel vervalt — hier expliciet als **dialoogsluiting**
i.p.v. paneelsluiting, zie taak 12 stap 3): een documentwissel sluit de dialoog. `hasBlockingDialogOpen`
(`shortcutRegistry.ts`) en de MCP-blokkeerlijst (`services/mcp/tools/runtime.ts`) leren de nieuwe vlag
kennen, net als elke andere dialoogvlag.

**Files:**
- Modify: `src/state/slices/types.ts` (`UIState` + `showDistributionDialog` + de `DistributionUiState`-vorm)
- Modify: `src/state/slices/uiSlice.ts` (defaults)
- Modify: `src/hooks/keyboard/shortcutRegistry.ts` (`hasBlockingDialogOpen`)
- Modify: `src/services/mcp/tools/runtime.ts` (dezelfde vlaggenlijst)
- Modify: `src/App.tsx` (mount achter `ui.showDistributionDialog`)
- Create: `src/components/dialogs/DistributionDialog/DistributionDialog.tsx`
- Create: `src/components/dialogs/DistributionDialog/useDistributionProposal.ts`
- Modify: `src/components/panels/ResourceOccupancyView.tsx` (de "Verdelen…"-ingang zet de open-vlag)
- Modify: `src/components/layout/Ribbon/ribbonConfig.tsx` (Resources-ribbonknop, analoog aan `showLevelingDialog`)
- Create: `tests/browser/leveling-distribution.spec.ts`

- [ ] **Step 1: Schrijf de falende browsertest**

`tests/browser/leveling-distribution.spec.ts`, in de stijl van
`tests/browser/resource-panel-effects.spec.ts` (echte klikken; `window.__OPS__` uitsluitend voor de
fixture en voor state-asserties):

```ts
// leveling-distribution.spec.ts — B1c-plan3, de verdeeldialoog. Fixture: twee documenten, dezelfde
// bibliotheek, één poolitem met een echt conflict. `window.__OPS__` zet de fixture; élke handeling
// hieronder is een ECHTE klik/toets.

test('verdeeldialoog: openen vanuit de conflictregel, een voorstel rekenen, focus-trap en sluiten', async ({ page }) => {
  await seedTwoConflictingDocuments(page);
  await page.getByRole('button', { name: /^(Occupancy|Bezetting)$/ }).click();
  // De conflictregel draagt de ingang.
  await page.locator('[data-ops-occupancy-row]').first().getByRole('button', { name: /Verdelen|Distribute/ }).click();
  await expect(page.locator('[data-ops-distribution-dialog]')).toBeVisible();
  // De gedeelde Dialog houdt Tab binnen de dialoog (CLAUDE.md, "gedeelde Dialog heeft een
  // focus-trap") — dezelfde asserttrant als de bestaande dialoogtests in `tests/browser/`.
  await expect(page.locator('[data-ops-distribution-dialog] :focus')).toHaveCount(1);
  // Het overzicht eronder blijft zichtbaar: de dialoog is een overlay, geen vervanging van de content.
  await expect(page.locator('[data-ops-occupancy-row]').first()).toBeVisible();
  // Het voorstel rekent bij het openen (spec §3.4, eerste discrete moment) en levert per document
  // een strook.
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);
  // Esc sluit, zoals elke andere dialoog (LAYOUTS.md §3.3). Het bezettingsoverzicht eronder was al
  // die tijd gewoon aanwezig; er is dus niets terug te "geven".
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ops-distribution-dialog]')).toHaveCount(0);
});

test('verdeeldialoog: de gereedschapsschakelaar laat het voorstel vervallen met reden', async ({ page }) => {
  /* … open de dialoog … */
  await page.getByRole('switch', { name: /Onderbrekingen toestaan|Allow splits/ }).click();
  await expect(page.locator('[data-ops-distribution-stale]')).toBeVisible();
  await page.getByRole('button', { name: /Herbereken|Recalculate/ }).click();
  await expect(page.locator('[data-ops-distribution-stale]')).toHaveCount(0);
});

test('verdeeldialoog: een geblokkeerd voorstel legt uit waarom en biedt geen Toepassen', async ({ page }) => {
  await seedUncountedDocument(page);   // een document met een relatiecyclus ⇒ counted: false
  /* … open de dialoog … */
  await expect(page.locator('[data-ops-distribution-blocked]')).toContainText(/doorrekenen|calculate/i);
  await expect(page.getByRole('button', { name: /^(Toepassen|Apply)$/ })).toBeDisabled();
});
```

Draai `npm run test:browser` en verwacht rood (de dialoog bestaat nog niet).

- [ ] **Step 2: De ui-state**

`src/state/slices/types.ts`, in `UIState`:

```ts
  /** session — of de B1c-verdeeldialoog open staat. Zelfde patroon als `showLevelingDialog`: een
   *  gewone dialoogvlag, bewaakt door `hasBlockingDialogOpen()` en gemount in `App.tsx`. Gescheiden
   *  van `levelingDistribution` hieronder omdat de tune-state en het toegepast-record een sluiting
   *  moeten OVERLEVEN — sluit de gebruiker de dialoog en opent hij 'm opnieuw op dezelfde
   *  conflictregel, dan staat de "toegepast"-strook (met "alles terugdraaien") er nog steeds. Alleen
   *  `resetDocumentScopedUI` (documentwissel, spec §6a) en het kiezen van een ANDER poolitem legen
   *  ook `levelingDistribution` zelf. */
  showDistributionDialog: boolean;
  /** session — de tune-state van de B1c-verdeeldialoog (spec §6/§6a). App-globaal, NIET per document:
   *  de dialoog kijkt naar N documenten tegelijk, en pin/plafond/rangorde zijn de invoer van één
   *  verdeelsessie, geen projectdata (zie de scope-bak in het implementatieplan — **besluit eigenaar
   *  2026-08-31**: dit is sessie-stand, geen projectbestand). `null` ⇒ er is nog geen sessie gestart
   *  (vóór de eerste keer openen, of ná het sluiten van het poolitem/de bibliotheek).
   *
   *  Bewust ZONDER het voorstel zelf: dat is afgeleide data en woont in de componentstate van de
   *  dialoog — zelfde filosofie als `DerivedKey` in het documentcontract. Wat hier staat is
   *  uitsluitend wat een gebruiker heeft INGESTELD, plus het toegepast-record (zie hierboven). */
  levelingDistribution: DistributionUiState | null;
```

```ts
export interface DistributionUiState {
  companyId: string;
  libraryItemId: string;
  /** "Onderbrekingen toestaan" (spec §4 stap 0). */
  allowSplits: boolean;
  /** docIds in rangorde; nr. 1 wordt het meest ontzien. Gevuld bij het openen op float-volgorde
   *  (spec §4 stap 1) en daarna handmatig te herschikken. */
  order: string[];
  pinned: Record<string, boolean>;
  /** docId → maximale uitloop in werkdagen; `null` = onbegrensd. */
  ceilings: Record<string, number | null>;
  applied: DistributionApplyRecord | null;
}
```

Defaults in `uiSlice`: `showDistributionDialog: false, levelingDistribution: null`. **Niet** in
`settingsRegistry` — dit is sessie-state, geen instelling (besluit eigenaar 2026-08-31).

- [ ] **Step 3: De voorstel-hook**

`useDistributionProposal.ts` — de discrete rekenmomenten, de bezig-toestand en de degradatie op één
plek, zodat de dialoog zelf alleen rendert:

```ts
/**
 * Berekent het verdelingsvoorstel op de DISCRETE momenten uit spec §3.4 — nooit per sleep-pixel.
 * Rekenmomenten: dialoog openen, "Verdeel automatisch"/"Herbereken", loslaten van een handle of een
 * toetsenbord-stap, en een pin-, rangorde- of gereedschapswijziging. Alles daartussen laat het
 * bestaande voorstel staan en zet alleen `staleReason`.
 *
 * BEZIG-TOESTAND, en waarom die een tick nodig heeft: `computeDistribution` is synchroon en kan tot
 * ~2 s duren (spec §3.4-budget: ≤ ~0,5 s per document, vier documenten). Zetten we de bezig-vlag en
 * rekenen we in dezelfde tick, dan schildert de browser die vlag nooit. Daarom: vlag zetten,
 * `setTimeout(..., 0)`, dán rekenen. Eén in-flight run tegelijk; een nieuw verzoek tijdens een run
 * wordt in de wacht gezet en na afloop precies één keer uitgevoerd.
 *
 * SCHAAL-DEGRADATIE (spec §3.4): boven de ondersteunde schaal — meer dan `MAX_TASKS_AUTO` taken in
 * één deelnemend document of meer dan `MAX_BOOKING_TASKS_AUTO` boekende taken op dit poolitem —
 * rekent een handle-loslating of toetsenbord-stap NIET meer automatisch; het effectlabel toont dan
 * `compute.pressRecompute` en de knop "Herbereken" is de enige weg. Dat ís de gedefinieerde
 * degradatie; niets bevriest stil.
 */
const MAX_TASKS_AUTO = 1000;          // spec §3.4, "ondersteunde schaal"
const MAX_BOOKING_TASKS_AUTO = 40;    // idem
```

**De invoer die de hook bouwt — dit is de scherpste val van deze taak.** `DistributionDocInput`
erft van `OccupancyDocInput`, en `ResourceOccupancyView` levert dáár bewust de **bibliotheek-snit**
aan (`librarySlice`, §7-cache). Voor de verdeler mag dat **niet**: `defaultLevelRun` geeft
`doc.resources`/`doc.assignments` rechtstreeks aan `levelResources`, en die moet de VOLLEDIGE
projectinzet zien — anders lost B1c een bibliotheekconflict op door een projectconflict te maken
(spec §4 stap 2, "de bestaande per-resource-toets tegen de eigen projectinzet"). Bouw de invoer voor
de dialoog dus uit de **volledige** payloadvelden:

```ts
    const inputs: DistributionDocInput[] = payloads.map(({ id, payload }, i) => ({
      docId: id,
      title: displayDocumentTitle(rawTitles[i], ordinals[i], untitledLabel),
      scheduleStale: payload.scheduleStale,
      companyId: payload.project.companyId ?? null,
      // VOLLEDIG, niet de bibliotheek-snit — zie hierboven. De extra kosten vallen op een DISCREET
      // rekenmoment, niet per render, dus de §7-cache van het bezettingsoverzicht is hier niet nodig.
      resources: payload.resources,
      assignments: payload.assignments,
      tasks: payload.tasks,
      calendar: payload.calendar,
      calendars: payload.calendars,
      solveInput: { tasks: payload.tasks, sequences: payload.sequences, dataDate: payload.project.statusDate,
                    progressMode: payload.project.progressMode, schedulingOptions: payload.project.schedulingOptions },
      levelInput: { tasks: payload.tasks, sequences: payload.sequences, dataDate: payload.project.statusDate,
                    progressMode: payload.project.progressMode, schedulingOptions: payload.project.schedulingOptions },
      rank: order.indexOf(id) + 1,
      pinned: pinned[id] === true,
      datesAsRecorded: payload.datesAsRecorded,
      ceilingWorkdays: ceilings[id] ?? null,
    }));
```

De startvolgorde bij het openen is **float-gesorteerd** (spec §4 stap 1: "float van een document = de
kleinste totale float over zijn boekende taken op dit poolitem, uit de counted cijfers"). Bereken die
uit de doorgerekende taken van elk document, met de scope-taken uit `scopeTaskIdsFor` — exporteer die
helper uit `distribute.ts` in plaats van hem na te bouwen.

- [ ] **Step 4: De dialoog-chrome en de ingang**

`DistributionDialog.tsx` gebruikt de gedeelde `Dialog` (zie de motivering en het maatvoorbeeld
bovenaan deze taak) en rendert daarbinnen, van boven naar beneden (spec §7):
1. Kop met de itemnaam en `subtitle`, en de gewone dialoog-sluitknop (X) — Esc en een backdrop-klik
   sluiten ook, via `Dialog`'s eigen `onCancel`/`onBackdropClick` (het patroon van elke andere
   dialoog in dit product, bv. `ProjectInfoDialog`). Er is geen "terug"-knop: de dialoog is een
   overlay, het bezettingsoverzicht eronder is nooit weggehaald.
2. Een blokkade-blok (`data-ops-distribution-blocked`) mét `t(DISTRIBUTION_BLOCK_KEY[reason])` en de
   documenttitels erbij — of, zonder blokkade:
3. De gereedschapsschakelaar (`role="switch"`, `aria-checked`) met het prijskaartje (taak 13 vult de
   prijs; hier tonen we voorlopig `tool.priceUnknown`).
4. De rangordelijst (taak 13 voegt de kostenlabels toe; hier: titel, hint, per regel de documentnaam,
   zijn float, en "naar boven"/"naar beneden"-knoppen — de sleepbaarheid is taak 10's terrein maar de
   knoppen zijn de toegankelijke basisbediening en blijven staan).
5. Een plaatshouder-`<div data-ops-distribution-strips>` (taak 9 vult 'm).
6. Een plaatshouder voor het voor/na-histogram (taak 11).
7. Een `stale`-strook (`data-ops-distribution-stale`) met de reden, en de knoppenbalk
   "Verdeel automatisch" / "Herbereken" / "Toepassen" / "Verwerpen" (taak 12 bedraadt Toepassen).

`ResourceOccupancyView.tsx`: in de conflictbadge-cel een knop `t('resource.distribution.open')` die
`setUI({ showDistributionDialog: true, levelingDistribution: { companyId, libraryItemId:
row.libraryItemId, allowSplits: false, order: <float-volgorde>, pinned: {}, ceilings: {}, applied:
null } })` zet — of, staat er al een `levelingDistribution` voor DÉZELFDE `libraryItemId` (de gebruiker
sloot de dialoog en opent 'm opnieuw, inclusief een eventueel `applied`-record), dan zet die knop
alleen `showDistributionDialog: true` en laat de bestaande tune-state en het toegepast-record staan.
Toon de knop **alleen** bij `hasConflict` (spec §7: "vanuit een conflictregel"). De Resources-ribbonknop
(zie boven) doet hetzelfde, met het laatst geopende poolitem als default. Het overzicht (tabel +
histogram) blijft **ongewijzigd zichtbaar** terwijl de dialoog open staat — er is geen "in plaats van"
meer, want de dialoog rendert los, via `App.tsx`.

- [ ] **Step 5: Draai**

```bash
npm run test:browser 2>&1 | tail -20; echo "exit: ${PIPESTATUS[0]}"
npx tsc --noEmit -p tsconfig.json; echo "exit: $?"
npm run lint; echo "exit: $?"
```

Verwacht: exit 0 ×3. Bij een falende browsertest: `test-results/` bevat screenshots en traces,
`playwright-report/` het HTML-rapport.

- [ ] **Step 6: Commit**

```bash
git add src/state/slices/types.ts src/state/slices/uiSlice.ts src/hooks/keyboard/shortcutRegistry.ts \
       src/services/mcp/tools/runtime.ts src/App.tsx src/components/dialogs/DistributionDialog/ \
       src/components/panels/ResourceOccupancyView.tsx src/components/layout/Ribbon/ribbonConfig.tsx \
       tests/browser/leveling-distribution.spec.ts
git commit -m "feat(library): verdeeldialoog — ingang vanuit de conflictregel, voorstel op discrete momenten (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 9: de fasestroken — boeking, vaste last, pin en de plafond-handle (toetsenbord)

**Spec §6** in zijn geheel, minus het pointer-slepen (taak 10).

> *"Per document één strook met zijn boeking op het poolitem: de vereniging van álle taken van dat
> document die (via een gestempelde resource) op dit poolitem boeken — mogelijk niet-aaneengesloten;
> interne gaten (bestaande splits of ingevoegde pauzes) worden als gaten getekend."*
> *"De handle zit aan het rechtereinde van de strook en zet het plafond … het label bij de handle
> toont altijd het einddatum-effect … Een gestippelde staart toont toegestaan maar niet benut."*
> *"Bediening: pointer-slepen én toetsenbord (`role="slider"`, pijltjes = één werkdag, Home/End,
> `aria-valuetext` met plafond, benutting en einddatum-effect); pin met `aria-pressed`. Snappen op
> hele werkdagen."*

**Files:**
- Create: `src/components/panels/occupancyAxis.ts` (gedeelde tijdas, uit `ResourceOccupancyView`)
- Modify: `src/components/panels/ResourceOccupancyView.tsx` (de as-opbouw eruit trekken)
- Create: `src/components/dialogs/DistributionDialog/PhaseStrip.tsx`
- Modify: `src/components/dialogs/DistributionDialog/DistributionDialog.tsx`
- Modify: `tests/browser/leveling-distribution.spec.ts`

- [ ] **Step 1: Schrijf de falende browsertest**

```ts
test('fasestroken: pin en plafond zijn met het toetsenbord te bedienen', async ({ page }) => {
  /* … open de dialoog op de conflictrij … */
  const strip = page.locator('[data-ops-distribution-strip]').first();

  // De pin is een toggle-knop met aria-pressed (spec §6).
  const pin = strip.getByRole('button', { name: /Vastzetten|Pin/ });
  await expect(pin).toHaveAttribute('aria-pressed', 'false');
  await pin.click();
  await expect(pin).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => Object.values(
    window.__OPS__!.store.getState().ui.levelingDistribution!.pinned).filter(Boolean).length)).toBe(1);
  // Een gepind document doet niet mee ÉN telt als vaste last (spec §4/§6).
  await page.getByRole('button', { name: /Herbereken|Recalculate/ }).click();
  await expect(strip).toHaveAttribute('data-ops-distribution-pinned', 'true');

  // De handle is een slider: pijltjes = één werkdag, Home = 0, End = onbegrensd.
  await pin.click(); // pin weer los
  const handle = strip.getByRole('slider');
  await handle.focus();
  await handle.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState()
    .ui.levelingDistribution!.ceilings[Object.keys(window.__OPS__!.store.getState().ui.levelingDistribution!.ceilings)[0]]))
    .toBe(1);
  await handle.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '0');
  await handle.press('End');
  // `aria-valuetext` draagt plafond, benutting én einddatum-effect (spec §6).
  await expect(handle).toHaveAttribute('aria-valuetext', /onbegrensd|unlimited/i);
});

test('fasestroken: het label toont het EINDDATUM-effect, niet de sleepafstand', async ({ page }) => {
  /* … plafond op 3 zetten, herberekenen … */
  // Benut < plafond ⇒ "gevraagd 3, dichtst haalbare 1" plus het effectlabel "eind +1 dag".
  await expect(strip.locator('[data-ops-distribution-effect]')).toContainText(/eind \+1 dag|end \+1 day/i);
  await expect(strip.locator('[data-ops-distribution-achievable]')).toBeVisible();
});
```

- [ ] **Step 2: Trek de tijdas uit `ResourceOccupancyView`**

`src/components/panels/occupancyAxis.ts` — puur, geen React:

```ts
/**
 * De gedeelde tijdas van het bezettingsoverzicht en de verdeeldialoog: segmentindeling met
 * gatcompressie, dagbreedte en x-posities per ISO-dag.
 *
 * Waarom gedeeld: het histogram (§5a), de fasestroken (§6) en de voor/na-preview (§7) MOETEN op
 * dezelfde as staan, anders lezen ze als drie verschillende tijdlijnen boven elkaar. Deze code stond
 * ingebakken in `OccupancyHistogram`s memo; hier staat hij één keer.
 */
export interface OccupancyAxis {
  segments: Array<{ days: string[]; x0: number }>;
  breaks: number[];
  dayWidth: number; width: number;
  xOf(iso: string): number | null;   // null ⇒ die dag valt in een ingeklapt gat
}
export function buildOccupancyAxis(bookedDays: string[], opts?: { targetWidth?: number }): OccupancyAxis | null
```

Verplaats de bestaande logica (ranges → gatcompressie op `GAP_COMPRESS_DAYS` → `dayWidth` →
`segments`/`breaks`) letterlijk hierheen en laat `OccupancyHistogram` hem aanroepen. **Geen
gedragswijziging** — de bestaande browsertests van het histogram (`gantt-histogram.spec.ts` en de
occupancy-asserts) moeten groen blijven zonder aanpassing; wordt er iets rood, dan is de verplaatsing
niet letterlijk geweest.

- [ ] **Step 3: Implementeer `PhaseStrip`**

Eén SVG-rij per document, op de gedeelde as:
- **De vaste last** als achtergrondband (uit `proposal.fixedLoadByDay`) — dat is wat er sowieso al
  ligt, ongeacht dit document.
- **De boeking van dit document** als gevulde blokken over de dagen uit zijn `dailyLoad`; dagen
  zonder boeking binnen de spanne (bestaande splits én ingevoegde pauzes) blijven leeg — precies wat
  de Gantt-renderer met een gesplitste balk doet.
- **De gestippelde staart**: van het einde van de benutte uitloop tot het plafond ("toegestaan maar
  niet benut", spec §6).
- **De handle** aan het rechtereinde:

```tsx
        <div
          role="slider"
          tabIndex={0}
          aria-label={t('resource.distribution.strip.handleLabel', { doc: docTitle })}
          aria-valuemin={0}
          aria-valuemax={CEILING_MAX_WORKDAYS}
          aria-valuenow={ceiling ?? CEILING_MAX_WORKDAYS}
          // Spec §6: het label draagt PLAFOND, BENUTTING én EINDDATUM-EFFECT — de drie getallen die
          // samen "gevraagd X, dichtst haalbare Y" betekenisvol maken. Een schermlezer krijgt hier
          // dus dezelfde informatie als het visuele effectlabel eronder.
          aria-valuetext={ceilingValueText}
          aria-disabled={pinned || undefined}
          onKeyDown={onHandleKey}
          data-ops-distribution-handle
        />
```

`onHandleKey`: `ArrowRight`/`ArrowUp` = +1 werkdag, `ArrowLeft`/`ArrowDown` = −1 (ondergrens 0),
`Home` = 0, `End` = onbegrensd (`null`), `PageUp`/`PageDown` = ±5. Elke toets is een **discreet
rekenmoment** (spec §3.4) — behalve in de gedegradeerde modus, waar hij alleen de waarde zet en het
effectlabel `compute.pressRecompute` toont.

`CEILING_MAX_WORKDAYS`: kies een eindige bovengrens voor `aria-valuemax` (bijvoorbeeld 60 werkdagen)
en documenteer dat `null`/`End` "onbegrensd" betekent en als `valuemax` gerapporteerd wordt — een
`role="slider"` zonder eindige max is voor hulpsoftware onbruikbaar.

**De pin**: een `<button aria-pressed={pinned}>`. Een gepinde strook krijgt
`data-ops-distribution-pinned="true"`, toont `strip.pinned`, en zijn handle staat op
`aria-disabled` (een bevroren document heeft geen plafond — spec §6: de pin bevriest einddatum **én**
werkdagen). Een `datesAsRecorded`-document toont `strip.pinnedRecorded`, heeft géén klikbare pin
(het is impliciet gepind, spec §3.3a) en zegt in zijn titel wat de gebruiker moet doen om het te
laten meedoen. Een `cannotMove`-document toont `strip.cannotMove`.

- [ ] **Step 4: Draai en commit**

```bash
npm run test:browser 2>&1 | tail -20; echo "exit: ${PIPESTATUS[0]}"
npm run verify:gantt-boundaries; echo "exit: $?"
npx tsc --noEmit -p tsconfig.json; echo "exit: $?"
```

`verify:gantt-boundaries` is hier bewust in de lijst: de dialoog tekent SVG en mag **niet** aan de
Canvas-renderer, viewport- of pointer-grenzen van de Gantt raken.

```bash
git add src/components/panels/occupancyAxis.ts src/components/panels/ResourceOccupancyView.tsx \
       src/components/dialogs/DistributionDialog/ tests/browser/leveling-distribution.spec.ts
git commit -m "feat(library): fasestroken met pin en plafond-handle in de verdeeldialoog (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 10: pointer-slepen op de plafond-handle

**Spec §6**: *"Bediening: pointer-slepen (blijft werken buiten het element) én toetsenbord … Snappen
op hele werkdagen."* en **§3.4**: *"Sleep-feedback tijdens het slepen is de plafondwaarde; het effect
verschijnt bij loslaten (discrete doorrekenmomenten) — nooit per sleep-pixel."*

Deze taak staat bewust ná taak 9: de toetsenbordbediening is de bron van waarheid (dezelfde
`setCeiling`-functie), het slepen is een tweede invoerroute erop. **Zou etappe 3 moeten inkorten, dan
is dít de enige UI-taak die naar een etappe 4 kan** — de dialoog is zonder slepen volledig bedienbaar.
De spec eist hem voor v1, dus hij staat hier gewoon in.

**Files:**
- Modify: `src/components/dialogs/DistributionDialog/PhaseStrip.tsx`
- Modify: `tests/browser/leveling-distribution.spec.ts`
- Modify: `src/components/dialogs/DistributionDialog/DistributionDialog.tsx` (rangorde-slepen, zie stap 3)

- [ ] **Step 1: Schrijf de falende browsertest**

```ts
test('plafond-handle: slepen snapt op hele werkdagen en rekent pas bij loslaten', async ({ page }) => {
  /* … open de dialoog … */
  const handle = strip.locator('[data-ops-distribution-handle]');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // Tijdens het slepen: de PLAFOND-waarde beweegt mee, het EFFECT-label niet (spec §3.4).
  const effectBefore = await strip.locator('[data-ops-distribution-effect]').textContent();
  await page.mouse.move(box.x + box.width / 2 + 3 * dayWidth, box.y + box.height / 2, { steps: 6 });
  await expect(handle).toHaveAttribute('aria-valuenow', '3');
  expect(await strip.locator('[data-ops-distribution-effect]').textContent()).toBe(effectBefore);
  // De muis verlaat het element en het slepen loopt door (pointer capture).
  await page.mouse.move(box.x + box.width / 2 + 5 * dayWidth, box.y - 200, { steps: 4 });
  await expect(handle).toHaveAttribute('aria-valuenow', '5');
  await page.mouse.up();
  // Loslaten is een discreet rekenmoment ⇒ het effectlabel wordt bijgewerkt.
  await expect.poll(async () => strip.locator('[data-ops-distribution-effect]').textContent())
    .not.toBe(effectBefore);
});

test('rangorde: slepen verandert de volgorde en laat het voorstel vervallen', async ({ page }) => {
  /* … sleep regel 2 boven regel 1 … */
  await expect(page.locator('[data-ops-distribution-rank-row]').first())
    .toHaveAttribute('data-ops-doc-id', secondDocId);
  await expect(page.locator('[data-ops-distribution-stale]')).toBeVisible();
});
```

- [ ] **Step 2: Implementeer het slepen op de handle**

Gebruik **pointer events met `setPointerCapture`** (niet mouse-events, niet een globale
document-listener): dat is precies wat "blijft werken buiten het element" oplevert, zonder losse
opruiming.

```tsx
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pinned) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startCeiling: ceiling ?? 0 };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // Snappen op HELE WERKDAGEN (spec §6): de as is dag-granulair, dus de sleepafstand deelt door de
    // dagbreedte. BEWUST kalenderdagen → werkdagen via de projectkalender van dít document, niet
    // rauwe pixels/dagen: het plafond is in WERKdagen gedefinieerd en moet dat blijven, ook over een
    // weekend heen.
    setLocalCeiling(clamp(drag.startCeiling + workdaysForPixels(e.clientX - drag.startX)));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    // DISCREET rekenmoment (spec §3.4): pas hier gaat de waarde de ui-state in en wordt er
    // herberekend. Tijdens het slepen leefde ze uitsluitend in `localCeiling`, dus er is nooit per
    // sleep-pixel gerekend — en het effectlabel toonde intussen nog het effect van de VORIGE stand,
    // wat klopt: het effect ván deze stand is nog niet berekend.
    commitCeiling(localCeiling);
  };
```

In de gedegradeerde modus (taak 8) commit `commitCeiling` de waarde wél maar **rekent niet** — het
effectlabel toont dan `compute.pressRecompute`.

- [ ] **Step 3: Implementeer het slepen in de rangordelijst**

Spec §4 stap 1 vraagt een "sleepbare lijst". Gebruik de HTML5-`draggable`-route óf pointer-events —
kies wat elders in dit product al gebruikt wordt (`grep -rn "onDragStart\|draggable" src/components/`)
en volg dát patroon; introduceer geen tweede sleepmechaniek. De "naar boven"/"naar beneden"-knoppen
uit taak 8 **blijven staan**: zij zijn de toetsenbordroute en de test-anker.

- [ ] **Step 4: Draai en commit**

```bash
npm run test:browser 2>&1 | tail -20; echo "exit: ${PIPESTATUS[0]}"
npm run lint; echo "exit: $?"
```

```bash
git add src/components/dialogs/DistributionDialog/ tests/browser/leveling-distribution.spec.ts
git commit -m "feat(library): plafond-handle en rangorde met de muis, rekenen pas bij loslaten (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 11: het voor/na-histogram bovenin de dialoog

**Spec §7**: *"bovenin het histogram als voor/na-preview"*.

"Voor" is er al: de gesommeerde `dailyLoad` per dag uit `computeLibraryOccupancy`. "Na" bestaat nog
niet — het voorstel levert delays en gaten, geen resulterende dagbelasting. Dat getal zit echter
letterlijk al in de verdeler: het gedeelde grootboek accumuleert per dag exact de **geplaatste**
boekingen. Deze taak maakt dat naar buiten leesbaar.

**Files:**
- Modify: `src/services/library/distribute.ts`
- Modify: `tests/library/check-distribute.ts`
- Create: `src/components/dialogs/DistributionDialog/BeforeAfterChart.tsx`
- Modify: `src/components/dialogs/DistributionDialog/DistributionDialog.tsx`
- Modify: `tests/browser/leveling-distribution.spec.ts`

- [ ] **Step 1: Schrijf de falende tests**

`tests/library/check-distribute.ts`:

```ts
// ── B1c-plan3 taak 11: `afterLoadByDay` ─────────────────────────────────────────────────────────
// De som over documenten van `afterLoadByDay` plus de vaste last is per dag exact
// `maxUnitsOn(poolItem, dag) − residualByDay[dag]` — één boekhouding, geen tweede berekening.
for (const iso of Object.keys(p.residualByDay)) {
  const placed = Object.values(p.afterLoadByDay).reduce((n, d) => n + (d[iso] ?? 0), 0);
  eq(`sluitend op ${iso}`, placed + (p.fixedLoadByDay[iso] ?? 0) + p.residualByDay[iso], capOn(iso));
}
// Een document dat NIET wijkt (gepind/#63/cannotMove) staat er met zijn ONGEWIJZIGDE boeking in.
eq('gepind document staat met zijn huidige boeking in de na-stand',
   p7.afterLoadByDay['doc-gepind'], booking7.dailyLoad);
// Bij een TEKORT is de na-stand per definitie onvolledig (de niet-plaatsbare vraag is nergens
// geboekt) — dat wordt expliciet gemeld, zodat de preview er geen "opgelost" van maakt.
eq('tekort ⇒ de na-stand is gemarkeerd als onvolledig', p12.afterIncomplete, true);
```

En een browsertest:

```ts
test('voor/na-preview: de na-stand blijft binnen de capaciteitslijn', async ({ page }) => {
  /* … open de dialoog, "Verdeel automatisch" … */
  await expect(page.locator('[data-ops-distribution-chart-before]')).toBeVisible();
  await expect(page.locator('[data-ops-distribution-chart-after]')).toBeVisible();
  // De conflictdagen staan in de VOOR-stand rood en in de NA-stand niet meer.
  await expect(page.locator('[data-ops-distribution-chart-before] [data-ops-conflict-day]')).not.toHaveCount(0);
  await expect(page.locator('[data-ops-distribution-chart-after] [data-ops-conflict-day]')).toHaveCount(0);
});
```

- [ ] **Step 2: Implementeer `afterLoadByDay` in `distribute.ts`**

Laat `bookPlaced` ook per document boeken:

```ts
  /** ISO-dag → geplaatste boeking, PER DOCUMENT — de "na"-stand voor de voor/na-preview (spec §7).
   *  Bewust dezelfde boekhouding als het grootboek zelf, niet een tweede berekening: elke boeking die
   *  in `residualOn` meetelt komt hier langs, en geen andere. */
  const afterLoadByDay: Record<string, Record<string, number>> = {};
```

De grootboek-`book` krijgt de huidige `docId` mee via de sluiting van `makeLedgerForDoc(doc, …)`, en
de `cannotMove`-tak boekt onder zijn eigen docId. Voeg toe aan `DistributionProposal`:

```ts
  /** docId → ISO-dag → boeking NA de verdeling (spec §7, voor/na-preview). */
  afterLoadByDay: Record<string, Record<string, number>>;
  /** `true` ⇒ minstens één taak kon niet geplaatst worden, dus haar vraag staat NERGENS in
   *  `afterLoadByDay`. De preview moet dat tonen (anders leest een tekort als "opgelost"). Loopt
   *  altijd gelijk op met `hasShortfall`; apart benoemd omdat de preview er iets anders mee doet dan
   *  de Toepassen-knop. */
  afterIncomplete: boolean;
```

- [ ] **Step 3: Implementeer `BeforeAfterChart`**

Twee gestapelde histogrammen onder elkaar op de **gedeelde as** (taak 9), met dezelfde
documentkleuren als het bezettingsoverzicht (`DOC_PALETTE`/`docColors`), dezelfde
capaciteits-traplijn (`maxUnitsOn` per dag) en dezelfde conflictmarkering. Hergebruik de
teken-primitieven van `OccupancyHistogram` waar mogelijk; introduceer géén tweede conflictdefinitie —
"conflict" blijft `som > maxUnitsOn(poolItem, dag)`, strikt groter (spec §6 van B1b).

De na-stand toont bij `afterIncomplete` een expliciete markering (`shortfall.title` + de
tekortregels), zodat de lezer ziet dat de na-balken niet alles bevatten.

- [ ] **Step 4: Draai en commit**

```bash
bash tests/library/run.sh 2>&1 | tail -8; echo "exit: $?"
npm run test:browser 2>&1 | tail -20; echo "exit: ${PIPESTATUS[0]}"
```

```bash
git add src/services/library/distribute.ts src/components/dialogs/DistributionDialog/ tests/
git commit -m "feat(library): voor/na-preview van de verdeling, uit dezelfde boekhouding als het grootboek (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 12: Toepassen, de "toegepast"-strook met "alles terugdraaien", en de voorstel-invalidatie

**Spec §5** (de terugweg woont in de dialoog, niet in een melding) en **§6a** (levensduur van het
voorstel).

**Files:**
- Modify: `src/components/dialogs/DistributionDialog/DistributionDialog.tsx`
- Modify: `src/components/dialogs/DistributionDialog/useDistributionProposal.ts`
- Modify: `src/state/slices/documentSlice.ts` (`resetDocumentScopedUI`)
- Modify: `tests/browser/leveling-distribution.spec.ts`
- Modify: `tests/library/check-apply-distribution.ts` (invalidatie-asserts op storeniveau)

- [ ] **Step 1: Schrijf de falende tests**

```ts
test('toepassen: schrijft in beide projecten en biedt daarna "alles terugdraaien"', async ({ page }) => {
  /* … open de dialoog, "Verdeel automatisch" … */
  await page.getByRole('button', { name: /^(Toepassen|Apply)$/ }).click();
  // Beide documenten dragen de delays; de strook staat er, permanent (geen 5s-timeout — spec §5).
  await expect(page.locator('[data-ops-distribution-applied]')).toBeVisible();
  await page.waitForTimeout(6000);
  await expect(page.locator('[data-ops-distribution-applied]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState()
    .tasks.filter(t => t.levelingDelay !== undefined).length)).toBeGreaterThan(0);

  // "Alles terugdraaien" zet beide documenten terug.
  await page.getByRole('button', { name: /Alles terugdraaien|Undo everything/ }).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState()
    .tasks.filter(t => t.levelingDelay !== undefined).length)).toBe(0);
  await expect(page.locator('[data-ops-distribution-applied]')).toHaveCount(0);
});

test('toepassen is uitgeschakeld-met-reden zolang er een tekort is', async ({ page }) => {
  /* … fixture met een onoplosbaar tekort … */
  const apply = page.getByRole('button', { name: /^(Toepassen|Apply)$/ });
  await expect(apply).toBeDisabled();
  await expect(page.locator('[data-ops-distribution-apply-reason]')).toContainText(/tekort|shortfall/i);
});

test('het voorstel vervalt met reden zodra er in een betrokken document gewerkt wordt', async ({ page }) => {
  /* … open de dialoog, reken … */
  // Een ECHTE bewerking in het actieve document (via het lint/de tabel, niet via __OPS__).
  await editATaskDurationThroughTheUi(page);
  await expect(page.locator('[data-ops-distribution-stale]')).toContainText(/niet meer actueel|no longer/i);
  await expect(page.getByRole('button', { name: /^(Toepassen|Apply)$/ })).toBeDisabled();
});

test('van document wisselen sluit de dialoog', async ({ page }) => {
  /* … open de dialoog, reken, dan Ctrl+2 … */
  await page.keyboard.press('Control+2');
  // Besluit eigenaar 2026-08-31: het voorstel VERVALT (spec §6a) en dat betekent hier — anders dan de
  // vorige, teruggedraaide drill-down-lezing — dat de DIALOOG SLUIT, niet dat hij openblijft met een
  // vervallen voorstel. Het overzicht eronder blijft gewoon staan; de gebruiker opent opnieuw op de
  // conflictregel.
  await expect(page.locator('[data-ops-distribution-dialog]')).toHaveCount(0);
});
```

- [ ] **Step 2: Implementeer Toepassen en de strook**

De knop is **uitgeschakeld-met-reden** (spec §4 stap 3) zodra:
`proposal === null` (nog niet gerekend), `proposal.blocked !== null`, `proposal.hasShortfall`,
de `staleReason` gezet is, of er niets te schrijven valt. Toon per geval de bijbehorende tekst in
`[data-ops-distribution-apply-reason]`. **Nooit** een uitgeschakelde knop zonder reden — dat is
precies wat spec §3 belooft ("validatie wijst altijd een uitweg aan").

Klikken roept `applyDistribution(proposal, scopeTaskIdsByDoc)` aan (taak 6) en zet het resultaat in
`ui.levelingDistribution.applied`. Daarna:

```tsx
      {/* Spec §5: de terugweg woont HIER, niet in het meldingenkanaal — dat kent geen actieknoppen
          en ruimt `info` na 5 s op. Deze strook is permanent zolang het record geldig is. De
          informatieve melding via `notify` mag ernaast bestaan, maar is nooit de enige terugweg. */}
      {applied && (
        <div role="status" data-ops-distribution-applied>
          <span>{t('resource.distribution.applied', { count: applied.docs.length })}</span>
          <button onClick={onUndoAll}>{t('resource.distribution.undoAll')}</button>
        </div>
      )}
```

`onUndoAll` roept `undoDistribution(applied)` aan, wist `applied`, en toont bij
`skippedDocIds.length > 0` de tekst `undonePartial` met die documenttitels — via het gewone
meldingenkanaal (`notify`, severity `warning`), want dát is een informatieve afloop en geen tweede
terugweg.

Push ná een geslaagd Toepassen óók een gewone informatieve melding (`notify`, `severity: 'info'`,
`messageKey: 'resource.distribution.applied'`) — spec §5: "De melding blijft puur informatief."

- [ ] **Step 3: Implementeer de invalidatie (spec §6a)**

In `useDistributionProposal`: bewaar bij elke geslaagde berekening
`fingerprints: Record<docId, string>` via `documentFingerprint(...)` (taak 4). Op elke render een
goedkope vergelijking; verschilt er één, dan `staleReason = 'edited'` met de titels van de
veranderde documenten. Verder:

| gebeurtenis | reden |
|---|---|
| rangorde gewijzigd | `stale.rank` |
| plafond gewijzigd | `stale.ceiling` |
| pin gewijzigd | `stale.pin` |
| gereedschapsschakelaar | `stale.tool` |
| mutatie in een betrokken document | `stale.edited` |

Alle vijf zijn **gewone hertriggering**: de dialoog rekent er meteen op door (behalve in de
gedegradeerde modus, waar hij alleen de reden toont). **Anders dan de vorige versie van dit plan**
staan "document geopend/gesloten dat op dit poolitem boekt" en "documentwissel" hier niet meer als
`staleReason`-tak: die twee gebeurtenissen lopen altijd via `newDocument`/`switchDocument`/
`closeDocument`/`duplicateDocument`/`restoreDocuments` — precies de triggerlijst van
`resetDocumentScopedUI` — en sluiten dus de hele dialoog (besluit eigenaar 2026-08-31, hieronder) in
plaats van hem open te laten staan met een vervallen voorstel. **Let op de i18n-nasleep:** taak 7 gaf
al een `stale.documents`-sleutel ("De geopende projecten zijn veranderd…") voor precies dit geval; die
sleutel heeft na deze taak geen aanroepplek meer. Verwijder hem uit de veertien locales, of — als de
uitvoerder een scenario vindt waarin een document verandert zonder een van de vijf
`resetDocumentScopedUI`-triggers (meld dat als het bestaat) — houd hem aan die plek vast. Niet
stilzwijgend laten staan als dode sleutel.

`resetDocumentScopedUI` (documentSlice, regel ~56):

```ts
  // B1c (spec §6a): de verdeeldialoog kijkt naar een MOMENTOPNAME van meerdere documenten. Een
  // documentwissel of een gesloten document maakt zijn tune-state (rangorde/pins/plafonds op docId)
  // en zijn toegepast-record onbetrouwbaar: het record verwijst naar history-events van documenten
  // die er misschien niet meer zijn (2026-09-04, aangepast na merge met main: was "undo-diepten" —
  // zie de noot bij taak 6; sluiten ruimt die events bovendien op). BESLUIT EIGENAAR 2026-08-31: dat betekent hier dat de DIALOOG SLUIT
  // (niet dat hij openblijft met een vervallen voorstel — dat was de vraag in de vorige versie van dit
  // plan, tégen de toen nog gekozen drill-down; met een losse dialoog is sluiten het enige zinnige
  // gevolg, want er is geen "eronder" om op terug te vallen zoals bij een drill-down). Het
  // bezettingsoverzicht blijft gewoon staan; de gebruiker opent de dialoog opnieuw op de conflictregel,
  // en start dan met een verse tune-state (tenzij hetzelfde poolitem nog een `applied`-record droeg —
  // zie taak 8 stap 4, de "zelfde item"-tak van de ingangsknop).
  s.ui.showDistributionDialog = false;
  s.ui.levelingDistribution = null;
```

> **Aangepast na de review van 2026-09-05:** `levelingDistribution` blijft staan bij documentwissel;
> alleen de dialoog sluit — zie `resetDocumentScopedUI`.

Dit is geen open vraag meer: spec §6a zegt dat het voorstel bij een documentwissel *vervalt*, en de
eigenaar heeft op 2026-08-31 bevestigd dat dat hier als **dialoogsluiting** landt, niet als een
openblijvende dialoog met een vervallen voorstel. De vorige versie van dit plan had dit nog als
AFWIJKING — VOORLEGGEN staan (toen nog geformuleerd als "het paneel sluit i.p.v. alleen het voorstel
laat vervallen"); dat is hiermee beantwoord.

- [ ] **Step 4: Draai en commit**

```bash
npm run test:browser 2>&1 | tail -20; echo "exit: ${PIPESTATUS[0]}"
bash tests/library/run.sh 2>&1 | tail -8; echo "exit: $?"
bash tests/planning/run.sh 2>&1 | tail -5; echo "exit: $?"
```

```bash
git add src/components/dialogs/DistributionDialog/ src/state/slices/documentSlice.ts tests/
git commit -m "feat(library): verdeling toepassen vanuit de dialoog, met een permanente terugweg (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 13: de kostenlabels en de prijskaartjes van de gereedschapsschakelaar

**Spec §4 stap 0/1** en **§3.4**: *"Naast de schakelaar het doorgerekende prijskaartje van beide
standen — berekend bij paneelopening en bij invalidatie, niet live."* en *"De kostenlabels in de
rangordelijst ('alleen dit project laten opschuiven kost +N') zijn elk óók een volledige run: ze
worden alleen onder de ondersteunde schaal bij paneelopening berekend en gecachet tot invalidatie;
daarboven on-demand per knop."*

De kern heeft hier **geen nieuwe API** voor nodig (dat staat al in het moduleblok van `distribute.ts`):
een kostenlabel is `computeDistribution` opnieuw draaien met een andere rangorde, een prijskaartje is
hetzelfde met de andere `allowSplits`-stand.

**Files:**
- Modify: `src/components/dialogs/DistributionDialog/useDistributionProposal.ts`
- Modify: `src/components/dialogs/DistributionDialog/DistributionDialog.tsx`
- Modify: `tests/browser/leveling-distribution.spec.ts`

- [ ] **Step 1: Schrijf de falende browsertest**

```ts
test('kostenlabels en prijskaartjes verschijnen en verdwijnen met het voorstel', async ({ page }) => {
  /* … open de dialoog op een klein project (onder de ondersteunde schaal) … */
  // Elk rangorde-regeltje draagt zijn kostenlabel na de eerste berekening.
  await expect(page.locator('[data-ops-distribution-rank-row] [data-ops-distribution-cost]'))
    .toHaveCount(2);
  // Beide standen van de schakelaar dragen een prijs.
  await expect(page.locator('[data-ops-distribution-tool-price]')).toContainText(/werkdag|no overrun|geen uitloop/i);
  // Een bewerking laat ze vervallen: gecachet tot invalidatie, niet live (spec §3.4).
  await editATaskDurationThroughTheUi(page);
  await expect(page.locator('[data-ops-distribution-cost]').first()).toContainText(/Herbereken|Recalculate/);
});

test('boven de ondersteunde schaal rekent de dialoog alleen op de knop', async ({ page }) => {
  await seedLargeProject(page, { tasks: 1200 });   // > MAX_TASKS_AUTO
  /* … open de dialoog … */
  await expect(page.locator('[data-ops-distribution-degraded]')).toBeVisible();
  // Kostenlabels worden dan NIET vooraf gerekend.
  await expect(page.locator('[data-ops-distribution-cost]').first()).toContainText(/Herbereken|Recalculate/);
  // En een handle-stap rekent niet vanzelf.
  await handle.focus(); await handle.press('ArrowRight');
  await expect(page.locator('[data-ops-distribution-effect]').first()).toContainText(/Herbereken|Recalculate/);
});
```

- [ ] **Step 2: Implementeer**

```ts
/**
 * De kostenlabels (spec §4 stap 1). "Alleen dit project laten opschuiven kost +N werkdagen" is:
 * draai `computeDistribution` opnieuw met dít document op rang 1 en alle andere deelnemers gepind,
 * en lees zijn `endShiftWorkdays`. Dat is per label een VOLLEDIGE run — vandaar het cachebeleid van
 * §3.4: alleen onder de ondersteunde schaal, alleen bij dialoogopening en na een invalidatie, en
 * daarna gecachet tot het voorstel vervalt. Boven die schaal blijft het label leeg met
 * `compute.pressRecompute`; de gebruiker vraagt ze dan expliciet op.
 *
 * Zelfde vorm voor het prijskaartje van de gereedschapsschakelaar: één run met `allowSplits: false`
 * en één met `true`, en de prijs is de grootste `endShiftWorkdays` over de deelnemers (de
 * "uitschieter" die spec §4 stap 2 minimaal wil houden — dát is het getal waar de planner op stuurt,
 * niet de som).
 */
```

Draai de labels **na** het hoofdvoorstel, in dezelfde bezig-toestand, en breek af zodra er intussen
een invalidatie is opgetreden (een label van een vervallen voorstel is misleidender dan geen label).

- [ ] **Step 3: Draai en commit**

```bash
npm run test:browser 2>&1 | tail -20; echo "exit: ${PIPESTATUS[0]}"
```

```bash
git add src/components/dialogs/DistributionDialog/ tests/browser/leveling-distribution.spec.ts
git commit -m "feat(library): kostenlabels per project en prijskaartjes per gereedschapsstand (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 14: de gebruikersgids + `docs/library.md`

**Spec §8**: *"Gebruikersgids (minimaal nl+en) met manifest-entry — de schakelaar 'onderbrekingen' met
het MS Project-equivalent erbij, en de pin/plafond-semantiek in gewone taal (einddatum vs.
werkdagen)."*

**Files:**
- Create: `public/docs/nl/gids-verdelen-restcapaciteit.md`
- Create: `public/docs/en/gids-verdelen-restcapaciteit.md`
- Modify: `public/docs/manifest.json`
- Modify: `docs/library.md`

- [ ] **Step 1: Schrijf de gids**

Model: `public/docs/nl/gids-bezettingsoverzicht.md` — zelfde toon (tweede persoon, gewone taal, geen
agenttaal), zelfde opbouw (`#`-kop, een "Wat je hier leert"-lijst, dan secties met `##`). **Blijf
binnen de parser-subset** van `src/utils/miniMarkdown.tsx`: koppen `#`/`##`/`###`, paragrafen,
enkelvoudige lijsten, `**vet**`/`*cursief*`/`` `code` ``, codeblokken, afbeeldingen, en uitsluitend
`docs://`- en `examples://`-links. **Geen tabellen, geen blockquotes, geen h4, geen rauwe HTML** —
`npm run verify:docs` faalt daarop.

Secties die er hoe dan ook in horen:
- **Wanneer je dit gebruikt** — je ziet in het bezettingsoverzicht een rode conflictbadge, en je wilt
  hem wegwerken zonder één project willekeurig op te offeren.
- **De dialoog openen** — vanaf de conflictregel (of de knop op de Resources-ribbon), met de link naar
  [Bezettingsoverzicht](docs://gids-bezettingsoverzicht).
- **Wie wordt het meest ontzien** — de rangorde, wat "speling" hier betekent, en het kostenlabel.
- **Onderbrekingen toestaan** — uit = het werk schuift in één stuk op; aan = het werk mag pauzedagen
  krijgen. Noem het MS Project-equivalent letterlijk ("Leveling can create splits in remaining work").
  Vertel dat de pauze altijd een hele werkdag is, en dat werk dat al begonnen is nooit onderbroken
  wordt (dat wijkt alleen via uitloop).
- **Vastzetten of een plafond** — het verschil in gewone taal: een **plafond** zegt "de einddatum mag
  hooguit zoveel werkdagen opschuiven", een **pin** zegt "raak dit project helemaal niet aan, ook de
  dagen niet". Plafond 0 is niet hetzelfde als een pin: dan mag de speling nog steeds benut worden.
- **Waarom het soms niet lukt** — de zeven redenen in gewone taal, en wat je eraan kunt doen. Noem
  ook dat een project met "datums zoals opgeslagen" nooit meedoet, met een link naar
  [Datums zoals opgeslagen](docs://datums-zoals-opgeslagen).
- **Toepassen en terugdraaien** — dat het in álle projecten tegelijk schrijft, dat elk project een
  gewone ongedaan-maken-stap krijgt, en dat "Alles terugdraaien" in de strook blijft staan.
- **De grens** — alleen documenten die in dít programma geopend zijn (zelfde beperking als het
  bezettingsoverzicht).

De EN-versie is een echte vertaling, geen kopie. `npm run verify:docs` eist `nl` en `en`; de overige
twaalf talen volgen later en worden alleen gevalideerd zodra ze bestaan.

- [ ] **Step 2: De manifest-entry**

In `public/docs/manifest.json`, naast `gids-bezettingsoverzicht`, met **alle veertien titels**
(spiegel het formaat van die entry letterlijk):

```json
    {
      "id": "gids-verdelen-restcapaciteit",
      "title": {
        "nl": "Verdelen over projecten",
        "en": "Distributing across projects",
        "de": "…", "fr": "…", "es": "…", "zh": "…", "it": "…", "pt": "…",
        "pl": "…", "tr": "…", "ar": "…", "ja": "…", "ko": "…", "fa": "…"
      },
      "layer": "gidsen",
      "cluster": "bezettingsoverzicht"
    },
```

De `cluster` is bewust dezelfde als het bezettingsoverzicht: het is dezelfde werkstroom, in twee
stappen (zien, dan oplossen).

- [ ] **Step 3: `docs/library.md`**

Voeg onder de bestaande B1c-alinea (§5, punt 5: "Verdeler-kern bestaat, nog zonder schrijfpad/paneel …
het schrijfpad … en het paneel dat dit voorstel toont, bestaan nog niet") één blok toe: dat de
verdeling nu via een dialoog gaat (geen drill-down — besluit eigenaar 2026-08-31), waar hij vandaan te
openen is (conflictregel + Resources-ribbon), wat pin en plafond betekenen, dat Toepassen in meerdere
documenten schrijft met per document een gewone undo-stap, en dat de tune-state bij de verdeelsessie
hoort en geen projecteigenschap is — sessie-stand, overleeft geen herstart (met de verwijzing naar de
scope-bak van dit plan). Verwijder de "bestaan nog niet"-zin.

- [ ] **Step 4: Draai en commit**

```bash
npm run verify:docs; echo "exit: $?"
```

```bash
git add public/docs docs/library.md
git commit -m "docs: gids voor het verdelen over projecten (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 15: de volle poort

**Files:** geen, tenzij een poort iets aanwijst.

- [ ] **Step 1: De ene poort**

```bash
npm run verify; echo "exit: $?"
```

Verwacht: exit 0. Dit draait typecheck (incl. `tests/` en `scripts/`), lint, alle vijf de suites,
voorbeelden, docs, i18n, cycles, store-grenzen en audit — exact wat CI, de release-gate en de
deploy-gate draaien. Oordeel **alleen op de exitcode**.

Poorten die in dit plan bijzondere aandacht verdienen:
- **`verify:i18n`** — taak 7 voegt een grote sleutelset toe. Faalt deze poort, dan mist er een
  CLDR-categorie: `zh`/`ja`/`ko` mogen geen `_one` hebben, `pl` heeft ook `_few`/`_many`,
  `es`/`fr`/`it`/`pt` ook `_many`.
- **`verify:docs`** — taak 14. Elk manifest-id moet `nl` én `en` hebben, elke `docs://`-link moet
  bestaan, en de inhoud moet binnen de miniMarkdown-subset blijven.
- **`verify:store-boundaries`** — `distribute.ts`, `applyDistribution.ts` en `proposalFingerprint.ts`
  mogen **nooit** `useAppStore` of `appStoreContext` importeren. `scratchDocument.ts` mag wél
  `createAppStoreContext` gebruiken (dat is de factory, niet de app-singleton) — controleer dat de
  poort dat onderscheid maakt en meld het als hij dat niet doet.
- **`verify:cycles`** — de toegestane richting blijft `services/library` → `engine/scheduler`.
  `state/runtime/scratchDocument` → `state/appStore` → alle slices is de nieuwe kant; loopt daar een
  cyclus, zie taak 5 stap 4.
- **`verify:gantt-boundaries`** — de verdeeldialoog tekent SVG in de DOM en hoort de Canvas-renderer-,
  viewport- en pointergrenzen van de Gantt niet te raken.

- [ ] **Step 2: De browserpoort**

```bash
npm run test:browser 2>&1 | tail -20; echo "exit: ${PIPESTATUS[0]}"
```

Verwacht: exit 0. Dekking die deze etappe moet hebben opgeleverd in
`tests/browser/leveling-distribution.spec.ts`:

| flow | taak |
|---|---|
| dialoog openen vanuit de conflictregel, focus-trap, twee stroken, sluiten (Esc) | 8 |
| gereedschapsschakelaar ⇒ vervallen met reden ⇒ herberekenen | 8 |
| geblokkeerd voorstel: uitleg + Toepassen uit | 8 |
| pin met `aria-pressed`, plafond met pijltjes/Home/End, `aria-valuetext` | 9 |
| effectlabel toont het einddatum-effect en "dichtst haalbare" | 9 |
| slepen: snappen op werkdagen, doorlopen buiten het element, rekenen bij loslaten | 10 |
| rangorde slepen ⇒ vervallen met reden | 10 |
| voor/na-preview: conflictdagen weg in de na-stand | 11 |
| Toepassen in twee projecten + "alles terugdraaien" | 12 |
| Toepassen uitgeschakeld-met-reden bij een tekort | 12 |
| voorstel vervalt bij een echte bewerking; documentwissel sluit de dialoog | 12 |
| kostenlabels/prijskaartjes + de gedegradeerde modus | 13 |

Ontbreekt er een rij, dan is die taak niet af — vul hem aan vóór je deze stap afvinkt.

- [ ] **Step 3: `git status --short` hoort schoon te zijn**

---

## Zelfreview van dit plan (uitgevoerd)

**Spec-dekking.**

| spec-onderdeel | taak |
|---|---|
| §4, "Herkomst" — idempotent herschrijven, wissen raakt alleen leveling-gaten | 2 |
| §4, "Invalidatie" — tijdbasis-bewerking wist de leveling-gaten van díé taak | 3 |
| §4 stap 0 — gereedschapsschakelaar met prijskaartje per stand | 8 (schakelaar), 13 (prijs) |
| §4 stap 1 — rangordelijst, float-startvolgorde, kostenlabels | 8 (lijst + float), 10 (slepen), 13 (labels) |
| §4 stap 2 — "Verdeel automatisch" | 8 |
| §4 stap 3 — tunen, Toepassen uitgeschakeld-met-reden | 9 (tunen), 12 (knop) |
| §5 — actief document via het gewone pad | 6 |
| §5 — slapende documenten via een headless scratch-instantie | 5, 6 |
| §5 — de twee singleton-randen (extensie-emitter, `notify`) | 5 |
| §5 — scope-behoudend toepassen, derde plek (`applyLeveling`) | 2 |
| §5 — de doorrekening wordt gepersisteerd | 6 (geval 3) |
| §5 — ook in handmatige modus | 6 (geval 3) |
| §5 — de terugweg in de dialoog, niet in een melding | 12 |
| §6 — fasestrook per document, gaten getekend | 9 |
| §6 — handle = plafond, label = einddatum-effect, gestippelde staart | 9 |
| §6 — pin bevriest einddatum én werkdagen, telt als vaste last | 9 (UI), 6 (schrijfpad slaat 'm over) |
| §6 — pointer én toetsenbord, `role="slider"`, `aria-pressed`, snappen | 9 (toetsenbord), 10 (pointer) |
| §6 — "gevraagd X, dichtst haalbare Y" | 9 |
| §6a — vingerafdruk, mutatieteller, `resetDocumentScopedUI` | 4, 12 |
| §3.4 — discrete rekenmomenten, bezig-toestand, schaal-degradatie | 8, 13 |
| §3.1 / §3.3a — uncounted blokkeert, #63 impliciet gepind | 8 (weergave), 6 (nooit beschreven) |
| §7 — plek in de UI, opbouw van boven naar beneden | 8, 9, 11, 12 |
| §8 — i18n veertien talen, CLDR-pluralen | 7 |
| §8 — gebruikersgids nl+en met manifest-entry | 14 |
| §9 "Store-niveau" — de volledige testlijst | 5, 6, 12 |
| Doorgeschoven eindkeuringsbevindingen 6, 7, 10, 11, 12 | 1 |
| Doorgeschoven punt d (ribbon-enable-check) | 2 |

**Drie plekken waar dit plan concretiseert (gemarkeerd als KEUZE VAN DIT PLAN).**
1. ~~Het paneel is een **drill-down** binnen `ResourceOccupancyView`, geen modale `Dialog`~~ —
   **teruggedraaid door de eigenaar (besluit 2026-08-31, taak 8): een losse dialoog, via de gedeelde
   `Dialog` en `hasBlockingDialogOpen`.** Zie de gevolgen daarvan in taken 9–13 en 15.
2. De **tune-state woont in `ui`**, niet in `DOCUMENT_FIELDS` — met de volledige redenering in de
   scope-bak bovenaan. **Bevestigd door de eigenaar (besluit 2026-08-31): sessie-stand, geen
   projectbestand.**
3. De **vingerafdruk is de mutatieteller PLUS de referentieset**; de teller alléén, zoals §6a hem
   beschrijft, mist een gecoalesceerde sleepreeks en `runCPM` (taak 4).

**Twee plekken die de eigenaar al gezien heeft — allebei besloten op 2026-08-31.**
1. **Pin/plafond zijn sessiegebonden, niet opgeslagen.** Stond hier als AFWIJKING — VOORLEGGEN: wil de
   eigenaar dat een pin een herstart of zelfs het IFC overleeft, dan verandert de betekenis van "pin"
   en hoort er een documentveld plus een `OPS_`-pset bij. **Besluit: nee — dit plan bouwt en houdt de
   sessie-lezing; persistentie is een mogelijke latere uitbreiding, geen v1-werk.** Zie de bak "Waar de
   tune-state woont" bovenaan.
2. **Documentwissel sluit de dialoog** in plaats van alleen het voorstel te laten vervallen (taak 12,
   stap 3). Stond hier als open vraag ("de spec beschrijft het gedrag niet"). **Besluit: ja, sluiten —
   en dat past ook beter bij de tweede beslissing van dezelfde dag (losse dialoog i.p.v. drill-down):
   een dialoog heeft geen "eronder" om open te laten staan met een vervallen voorstel.**

**Eén bevinding die dit plan onderweg oploste en die de eigenaar mag weten.** `levelResources` stripte
in zijn baseline wél `levelingDelay` maar niet de leveling-**gaten**. Zonder taak 2 stap 2 zou een
tweede nivellering in de onderbreek-modus de gaten van de eerste als brondata lezen en er nieuwe
bovenop leggen — accumulatie in plaats van het idempotente herschrijven dat spec §4 eist. Dat was in
etappe 2 niet zichtbaar omdat niets de gaten schreef.

**Open aannames die de uitvoerder moet verifiëren** (staan óók in de betreffende stap): of
`createAppStoreContext()` bij constructie werkelijk geen I/O of globale registratie doet (taak 5), of
`ui.notifications` de vorm heeft die `harvestNotifications` aanneemt (taak 5), welke `src/`-plekken
`clearTimephasedWindow` precies aanroepen (taak 3), of `scanLimit` in `scatterSlot`s scope staat
(taak 1), of `occurrenceFor`/`demandByTask` de dagenset van een in-scope taak uit `workTasks` of uit
`taskById` lezen (taak 2), en welk sleepmechanisme dit product elders al gebruikt voor herordenbare
lijsten (taak 10).
