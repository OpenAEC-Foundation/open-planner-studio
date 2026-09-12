# B1c — Plan 4: het herontwerp van de verdeeldialoog naar het Interface-lab (implementatieplan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De verdeeldialoog van B1c herbouwen naar het prototype dat de eigenaar op 2026-08-27 koos
(tabblad 4 "Fasestrook-handles" in `docs/superpowers/prototypes/2026-08-27-b1c-interface-lab.html`):
de balk per project wordt de bediening, de rangordelijst verdwijnt, het prijskaartje wordt één
verschil, er wordt live meegerekend tijdens het slepen, en geen enkele rekentoestand mag de dialoog
nog laten flitsen.

**Architecture:** vijf lagen, van binnen naar buiten. (1) Een **nieuwe pure geometriemodule**
`stripGeometry.ts` die uit een `DistributionProposal`-doorsnede en de gedeelde tijdas de dagblokjes,
pauzedagen, gestippelde rest en de meetlat uitrekent — headless getoetst, geen React. (2) **`PhaseStrip`
herbouwd** op die module: label 150 px | track 32 px | uitkomstlabel 132 px, met een echte
handle-knop van 15×30 px. (3) **`useDistributionProposal`** verliest de per-project-kostenlabels en
krijgt in plaats daarvan één verschil-prijs; zijn bestaande in-flight-coalescing ís de throttle van
de sleeprun. (4) **`DistributionDialog`** verliest de rangordelijst en krijgt een altijd-aanwezige
validatiestrook, een Reset-knop, bovenverankering en een histogram dat kolom-op-kolom onder de
balken uitkomt. (5) **i18n, tests en gidsen** volgen.

**Tech Stack:** TypeScript strict, React 19, SVG in de DOM (geen Canvas — dat is uitsluitend de Gantt),
`react-i18next` met 14 locales, headless checks als `check-*.ts` onder `tests/planning/` met
registratie in `tests/planning/run.sh`, browsertests als Playwright-specs onder `tests/browser/`.

---

## Waar dit plan vandaan komt

| bron | wat je eruit haalt |
|---|---|
| `docs/superpowers/specs/2026-09-12-b1c-verdeeldialoog-herontwerp-design.md` | **de opdracht.** Alle eigenaarsbesluiten staan daar; dit plan wijkt nergens af. |
| `docs/superpowers/prototypes/2026-08-27-b1c-interface-lab.html`, tabblad 4 | **de maatvoering.** Zoek `.ptrack`, `.pblk`, `.ppause`, `.pfree`, `.pfl`, `.pover`, `.phandle`, `rowBlocks()`, `buildPhaseHandles()`, `dragify()`. Elke pixelmaat in taak 2 komt daar letterlijk vandaan. |
| `docs/superpowers/plans/2026-08-31-b1c-plan3-schrijfpad-paneel.md` | de huisstijl van een plan in deze repo, en de redenering achter de tune-state (scope-bak "Waar de tune-state woont" — die blijft onverkort gelden). |
| `CLAUDE.md` | de poorten, de i18n-pluralregels, het meldingenkanaal, de store-eigendomstabel. |

Waar dit plan de spec **concretiseert** staat dat expliciet als **KEUZE VAN DIT PLAN**. Er staat
nergens een **AFWIJKING** in: alles wat hieronder gebouwd wordt valt binnen de eigenaarsbesluiten van
§2 van de spec.

---

## Regels voor iedere uitvoerder van dit plan

Lees deze acht regels vóór je taak; ze gelden voor élke taak.

1. **Poorten draaien in de VOORGROND en het oordeel is de EXITCODE.** Nooit `&`, nooit een
   achtergrondtaak met een tail. De planningssuite print "alles groen" ook bij exit 1 wanneer het
   bundelen faalt; `grep -c '^XX'` is een extraatje, geen poort.
2. **Maximaal ÉÉN zware run tegelijk op deze machine.** Vóór `npm run verify` of
   `npm run test:browser` eerst wachten tot er geen andere loopt:
   ```bash
   while pgrep -f "vite build|tsc --noEmit|playwright test|run.sh" >/dev/null; do sleep 20; done
   ```
3. **`PATH` expliciet zetten vóór élke npm-aanroep** — een subagent-shell heeft nvm niet geladen en
   geeft anders exit 127:
   ```bash
   export PATH="/home/nozzit/.nvm/versions/node/v22.23.2/bin:$PATH"
   ```
4. **Eén losse browserspec draai je gericht:**
   ```bash
   npm run test:browser -- tests/browser/leveling-distribution.spec.ts
   ```
5. **Nooit pushen.** Commit op de eigen branch, klaar. Geen merge, geen PR, geen tag.
6. **Geen `alert()`, geen `confirm()`, geen eigen toast.** Gebruikerzichtbare meldingen lopen via het
   ene K8a-kanaal (`notify`) of via de dialoog zelf.
7. **Alle zichtbare tekst via `t(...)`.** Nooit een hardgecodeerde string in JSX, ook niet
   "tijdelijk".
8. **Geen nieuwe store-velden.** Alles wat deze verbouwing nodig heeft past in de bestaande
   `DistributionUiState` (`allowSplits`, `order`, `pinned`, `ceilings`, `applied`). Komt er tóch een
   veld bij, dan is dat een ontwerpfout in dit plan — meld het in plaats van het erin te schrijven.

---

## Scope

**In dit plan:**

| onderwerp | spec | taak |
|---|---|---|
| pure balkgeometrie (dagblokjes, pauzedagen, gestippelde rest, meetlat) + verschil-prijs | §4, §2.2 | T1 |
| `PhaseStrip` herbouwd naar de prototype-maten, handle-knop, pin als tekstknop, legenda | §4, §5, §6 | T2 |
| hook: live meerekenen tijdens het slepen, `order` afgeleid, kostenlabels weg, verschil-prijs | §2.1, §2.2, §5, §8 | T3 |
| dialooglay-out: rangordelijst weg, validatiestrook, Reset, bovenverankering, kolom-op-kolom | §3, §6, §7 | T4 |
| i18n in veertien locales + opschonen van de dode sleutels | §8 | T5 |
| browsertests herschreven + de boundingBox-stabiliteitstest | §9 | T6 |
| gidsen `nl`/`en` + `docs/library.md` | §10 | T7 |
| de volle poort | — | T8 |

**NIET in dit plan** (spec §11):

| onderwerp | waarom niet |
|---|---|
| De hele balk versleepbaar maken als harde plaatsing | ander mentaal model dan het gekozen prototype; zo nodig een latere etappe |
| Een expliciete rangorde-bediening terugbrengen (ingeklapt of anders) | eigenaarsbesluit §2.1: weg uit beeld |
| Wijzigingen aan de verdeler-kern (`distribute.ts`) of het schrijfpad (`applyDistribution`) | §2.4: de kern blijft zoals gebouwd |
| Persistentie van pins/plafonds over een herstart of door het IFC | plan 3, scope-bak "Waar de tune-state woont" — nog steeds geen v1-werk |

---

## Context voor wie hier koud instapt

Alles hieronder is geverifieerd in de code van 2026-09-12 (HEAD `7f9633ca`, branch
`t3code/b1c-etappe3`). Lees het vóór taak 1 — zonder deze acht punten is de rest raden.

- **Wat "verdelen" doet.** Eén bibliotheekitem (een poolresource, bv. "Gedeelde kraan") wordt door
  meerdere geopende projecten tegelijk geboekt. Samen overschrijden ze de bedrijfscapaciteit. De
  verdeler (`src/services/library/distribute.ts`, puur) plaatst de documenten één voor één in
  rangorde tegen de restcapaciteit: nummer 1 nivelleert alleen tegen de vaste last, elk volgend
  document ziet de échte boekingen van zijn voorgangers. De uitkomst is een `DistributionProposal`.
- **Wat er in een `DistributionProposal` zit** (lees `distribute.ts` regels 90–150):
  `docs: DistributionDocResult[]` met per document `delays`, `gaps`, `projectEndBefore`,
  `projectEndAfter`, `endShiftWorkdays`, `participated`, `pinnedReason`, `cannotMove`, `shortfalls`;
  plus `bookingByDay` (docId → ISO → eenheden VÓÓR), `afterLoadByDay` (idem NÁ), `fixedLoadByDay`
  (ISO → vaste last), `residualByDay`, `hasShortfall`, `afterIncomplete`, `blocked`.
- **De tijdas is gedeeld.** `src/components/panels/occupancyAxis.ts` bouwt één `OccupancyAxis`
  (segmenten met kalenderdagen, `dayWidth`, `width`, `xOf(iso)`, gatcompressie boven 30 dagen). De
  dialoog bouwt hem één keer (`targetWidth: 560`) en geeft dezelfde INSTANTIE aan alle stroken én aan
  de voor/na-grafiek. `AXIS.padLeft` is 34 (ruimte voor de y-as-waarden van het histogram),
  `AXIS.padRight` is 8. Een strook laat die padLeft-strook gewoon leeg — dat is precies wat de
  kolom-op-kolom-uitlijning in taak 4 mogelijk maakt.
- **De tune-state.** `ui.levelingDistribution: DistributionUiState | null` (zie
  `src/state/slices/types.ts:255`): `companyId`, `libraryItemId`, `allowSplits`, `order` (docIds),
  `pinned` (docId → bool), `ceilings` (docId → werkdagen of `null` = onbegrensd), `applied`. Dit is
  app-globale UI-state, géén documentdata: hij zit niet in `DOCUMENT_FIELDS`, overleeft geen
  herstart en wordt niet door undo geraakt.
- **Rekenen is discreet.** `useDistributionProposal` abonneert zich bewust NIET op de documentinhoud;
  hij leest de store pas binnen een run (`useAppStore.getState()`). Er loopt er precies één tegelijk
  (`busyRef`), en een verzoek dat tijdens een run binnenkomt wordt daarna precies ÉÉN keer ingehaald
  (`pendingRef`). **Dát mechanisme ís de throttle die spec §5 vraagt** — er komt in taak 3 geen
  tweede timer bij.
- **Schaal-degradatie.** Boven 1000 taken per document, 40 boekende taken op dit poolitem of 6
  geopende documenten rekent de dialoog alleen nog op "Herbereken" (`isDistributionDegraded`). In die
  stand mag het slepen dus NIET live rekenen.
- **Wat er nu stuk is** (gebruikstest eigenaar 2026-09-12): de strook was een dun blokje van 24 px
  zonder dagindeling, pauzes waren onzichtbaar, tijdens het slepen bewoog niets mee, de
  rangordelijst trok alle aandacht, en het prijskaartje toonde twee kale bedragen naast elkaar.
- **De poorten.** `npm run verify` (typecheck + lint + alle vijf de suites + de verify-poorten) en
  `npm run test:browser`. Oordeel op de exitcode.

---

## Bestandsoverzicht

| bestand | rol na deze verbouwing | taak |
|---|---|---|
| `src/components/dialogs/DistributionDialog/stripGeometry.ts` | **nieuw** — pure balkgeometrie + verschil-prijs. Geen React, geen domeintypes. | T1 |
| `tests/planning/check-distribution-strip-geometry.ts` | **nieuw** — headless check op T1. | T1 |
| `tests/planning/run.sh` | registratie van die check. | T1 |
| `src/components/dialogs/DistributionDialog/PhaseStrip.tsx` | **herbouwd** — label/track/uitkomstlabel, handle-knop, pin-tekstknop. | T2 |
| `src/components/dialogs/DistributionDialog/useDistributionProposal.ts` | kostenlabels eruit, `savings` erin, sleeprun. | T3 |
| `src/components/dialogs/DistributionDialog/DistributionDialog.tsx` | rangordelijst eruit, validatiestrook/Reset/uitlijning erin. | T4 |
| `src/components/dialogs/DistributionDialog/BeforeAfterChart.tsx` | eigen kleurterugval eruit (één `assignDocColors`). | T4 |
| `src/components/common/Dialog.tsx` | `alignTop`-prop voor de bovenverankering. | T4 |
| `src/i18n/locales/*/common.json` (14×) | nieuwe sleutels, dode sleutels weg. | T5 |
| `tests/browser/leveling-distribution.spec.ts` | herschreven waar de bediening wijzigt + stabiliteitstest. | T6 |
| `public/docs/{nl,en}/gids-verdelen-restcapaciteit.md`, `docs/library.md` | de nieuwe bediening beschreven. | T7 |

De taken zijn zo geknipt dat T1, T5 en T7 **disjunct in bestanden** zijn en dus parallel gebouwd
kunnen worden; T2 hangt aan T1, T4 aan T2+T3, T6 aan T4, T8 aan alles.

---

## Task 1: de pure balkgeometrie + de verschil-prijs

**Files:**
- Create: `src/components/dialogs/DistributionDialog/stripGeometry.ts`
- Create: `tests/planning/check-distribution-strip-geometry.ts`
- Modify: `tests/planning/run.sh` (registratie, naast de bestaande `DISTCHARTCHECK`-blok op regel 691–695)

### Wat deze module beslist (lees dit vóór stap 1)

De spec (§4) beschrijft de balk in vier lagen. Dit is hoe elke laag uit de proposal-data volgt:

| laag in §4 | bron |
|---|---|
| volle blokjes = werkdagen | `afterLoadByDay[docId]` — de **NA**-stand. **KEUZE VAN DIT PLAN:** §4 schrijft "`bookingByDay`/`afterLoadByDay`" en laat de keuze open; het moet de NA-stand zijn, anders beweegt de balk niet mee tijdens het slepen en is de hele bediening zinloos. Voor een gepind/#63-document zijn beide gelijk, dus er gaat niets verloren. |
| gearceerd = pauzedag | een dag ín de fasespanne (eerste t/m laatste geboekte dag) zónder boeking die **wél een werkdag is**. Een weekend of feestdag is geen pauzedag en wordt overgeslagen — anders staat elke balk vol arcering. De werkdagvraag komt als `isWorkingDay`-predicaat binnen, zodat de module puur blijft. |
| gestippelde rest | van het fase-einde tot de handle-stand (`ceilingWorkdays - endShiftWorkdays` werkdagen verder). |
| meetlat grijs/rood | grijs = de **beschikbare** speling vanaf het OORSPRONKELIJKE fase-einde (`bookingByDay[docId]`, laatste geboekte dag), `slackWorkdays` werkdagen lang — precies wat het prototype met `.pfl` doet. Rood = alles van het einde van die speling tot het huidige fase-einde (`.pover`). |

**KEUZE VAN DIT PLAN — waarom de meetlat niet op `projectEndBefore`/`projectEndAfter` splitst.** Die
twee velden beschrijven de PROJECTeinddatum; de balk toont een FASE. Een fase kan binnen haar eigen
speling opschuiven zonder de projecteinddatum te raken, en dat is precies het onderscheid dat de
meetlat moet tonen. Het prototype splitst daarom op de eigen float, en dat is hier navolgbaar omdat
`documentFloatOn` (de kleinste `totalFloat` over de boekende taken, al aanwezig in
`useDistributionProposal.ts`) diezelfde grootheid levert. `endShiftWorkdays` blijft de bron van het
uitkomstlabel — die twee spreken elkaar niet tegen: is `endShiftWorkdays` 0, dan ligt het fase-einde
binnen de speling en is het rode deel per constructie leeg.

**De verschil-prijs (§2.2).** `savingsWorkdays(offMax, onMax)` = `Math.max(0, offMax - onMax)`, waarbij
`offMax`/`onMax` de grootste `endShiftWorkdays` over de deelnemers zijn in de uit- resp. aan-stand.
De klem op 0 is nodig omdat onderbreken in theorie duurder kan uitvallen; "bespaart niets" is dan het
eerlijke antwoord, een negatief bedrag zou onzin zijn.

- [ ] **Step 1: Schrijf de falende check**

Maak `tests/planning/check-distribution-strip-geometry.ts`:

```ts
// B1c-plan4 taak 1 — de PURE balkgeometrie van de verdeeldialoog (spec §4/§9).
//
// Drie gevallen uit spec §9, plus de verschil-prijs van §2.2. De as is bewust minimaal: één
// aaneengesloten reeks kalenderdagen, zodat elke x-positie met de hand na te rekenen is
// (`AXIS.padLeft + index * dayWidth`).
//
// De werkdagdefinitie komt als predicaat binnen — deze check gebruikt "ma t/m vr", zodat er geen
// kalendermotor aan te pas komt en de pauzedag-logica geïsoleerd getoetst wordt.
import { AXIS, buildOccupancyAxis, expandDays } from '@/components/panels/occupancyAxis';
import {
  STRIP, buildStripGeometry, savingsWorkdays, maxEndShiftWorkdays,
} from '@/components/dialogs/DistributionDialog/stripGeometry';

let failures = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) console.log(`OK  ${msg}`);
  else { console.log(`XX  ${msg}`); failures++; }
}

// 2026-09-07 is een maandag. Twee volle weken + een dag.
const DAYS = expandDays('2026-09-07', '2026-09-25');
const axis = buildOccupancyAxis(DAYS, { targetWidth: 560 })!;
const dw = axis.dayWidth;
const xAt = (iso: string): number => axis.xOf(iso)!;
const isWorkingDay = (iso: string): boolean => {
  const day = new Date(`${iso}T00:00:00`).getDay();
  return day >= 1 && day <= 5;
};
const load = (isos: string[]): Record<string, number> =>
  Object.fromEntries(isos.map(iso => [iso, 1]));

ok(axis !== null, 'de as over de fixture-dagen bestaat');
ok(dw > 0, `de dagbreedte is positief (${dw})`);

// ── Geval 1: BINNEN DE SPELING ───────────────────────────────────────────────────────────────
// Oorspronkelijk ma 7 t/m wo 9; na de verdeling di 8 t/m do 10. Speling 3 werkdagen: het nieuwe
// einde valt er ruim binnen, dus er hoort GEEN rood te staan.
{
  const before = load(['2026-09-07', '2026-09-08', '2026-09-09']);
  const after = load(['2026-09-08', '2026-09-09', '2026-09-10']);
  const g = buildStripGeometry({
    axis,
    beforeLoadByDay: before,
    loadByDay: after,
    fixedLoadByDay: {},
    isWorkingDay,
    slackWorkdays: 3,
    ceilingWorkdays: 3,
    endShiftWorkdays: 0,
  });

  ok(g.blocks.length === 3, `1 — drie dagblokjes (kreeg ${g.blocks.length})`);
  ok(g.blocks.every(b => b.kind === 'work'), '1 — alle drie zijn werkdagblokjes, geen pauzedag');
  ok(g.blocks[0].x === xAt('2026-09-08'), '1 — het eerste blokje staat op de nieuwe startdag');
  ok(g.blocks[0].w === dw, '1 — een blokje is precies één dagbreedte');
  ok(g.phaseEndX === xAt('2026-09-10') + dw, '1 — het fase-einde ligt achter de laatste geboekte dag');

  // De meetlat: grijs vanaf het OORSPRONKELIJKE einde (wo 9 + 1 = do 10), drie werkdagen lang
  // (do 10, vr 11, ma 14) — dus tot en met ma 14, x = xAt(ma 14) + dw.
  ok(g.slackBar !== null, '1 — er is een grijze spelingsmeetlat');
  ok(g.slackBar!.x === xAt('2026-09-09') + dw, '1 — de speling begint achter het oorspronkelijke fase-einde');
  ok(g.slackBar!.x + g.slackBar!.w === xAt('2026-09-14') + dw,
    '1 — drie WERKdagen speling slaat het weekend over en eindigt na ma 14');
  ok(g.overrunBar === null, '1 — binnen de speling staat er geen rood');

  // Plafond 3 werkdagen, benut 0 ⇒ de handle staat drie werkdagen voorbij het fase-einde
  // (vr 11, ma 14, di 15).
  ok(g.handleX === xAt('2026-09-15') + dw, '1 — de handle staat drie werkdagen voorbij het fase-einde');
  ok(g.freeBox !== null && g.freeBox.x === g.phaseEndX,
    '1 — de gestippelde rest begint op het fase-einde');
  ok(g.freeBox !== null && g.freeBox.x + g.freeBox.w === g.handleX,
    '1 — de gestippelde rest loopt tot de handle');
  ok(g.ceilingEndIso === '2026-09-15', `1 — de plafonddatum is di 15 (kreeg ${g.ceilingEndIso})`);
}

// ── Geval 2: VOORBIJ DE SPELING ──────────────────────────────────────────────────────────────
// Zelfde oorspronkelijke fase, maar het nieuwe einde ligt op do 17 en de speling is maar 1 werkdag.
{
  const before = load(['2026-09-07', '2026-09-08', '2026-09-09']);
  const after = load(['2026-09-15', '2026-09-16', '2026-09-17']);
  const g = buildStripGeometry({
    axis,
    beforeLoadByDay: before,
    loadByDay: after,
    fixedLoadByDay: {},
    isWorkingDay,
    slackWorkdays: 1,
    ceilingWorkdays: null,
    endShiftWorkdays: 5,
  });

  // Eén werkdag speling vanaf do 10 ⇒ de grijze meetlat eindigt na do 10.
  ok(g.slackBar !== null && g.slackBar.x + g.slackBar.w === xAt('2026-09-10') + dw,
    '2 — de grijze meetlat is precies één werkdag lang');
  ok(g.overrunBar !== null, '2 — voorbij de speling staat een rode meetlat');
  ok(g.overrunBar!.x === xAt('2026-09-10') + dw, '2 — het rood begint waar de speling ophoudt');
  ok(g.overrunBar!.x + g.overrunBar!.w === g.phaseEndX, '2 — het rood loopt tot het fase-einde');
  // Onbegrensd plafond ⇒ de handle staat aan het einde van de as (spec §5).
  ok(g.handleX === axis.width - AXIS.padRight, '2 — een onbegrensd plafond zet de handle aan het aseinde');
  ok(g.ceilingEndIso === null, '2 — een onbegrensd plafond heeft geen plafonddatum');
}

// ── Geval 3: MET ONDERBREKINGEN ──────────────────────────────────────────────────────────────
// De fase loopt ma 7 → vr 11, met di 8 en do 10 als ingevoegde pauzedagen. Het weekend ertussen
// telt NIET als pauzedag.
{
  const before = load(['2026-09-07', '2026-09-08', '2026-09-09']);
  const after = load(['2026-09-07', '2026-09-09', '2026-09-11']);
  const g = buildStripGeometry({
    axis,
    beforeLoadByDay: before,
    loadByDay: after,
    fixedLoadByDay: load(['2026-09-07', '2026-09-08']),
    isWorkingDay,
    slackWorkdays: 2,
    ceilingWorkdays: 2,
    endShiftWorkdays: 1,
  });

  ok(g.blocks.length === 5, `3 — vijf blokjes: drie werkdagen + twee pauzedagen (kreeg ${g.blocks.length})`);
  const pauses = g.blocks.filter(b => b.kind === 'pause').map(b => b.iso);
  ok(pauses.join(',') === '2026-09-08,2026-09-10',
    `3 — precies di 8 en do 10 zijn pauzedagen (kreeg ${pauses.join(',')})`);
  ok(g.blocks.every(b => b.iso >= '2026-09-07' && b.iso <= '2026-09-11'),
    '3 — er staat niets buiten de fasespanne');

  // De vaste last is één aaneengesloten band over ma 7 en di 8.
  ok(g.fixedBands.length === 1, `3 — de vaste last is één band (kreeg ${g.fixedBands.length})`);
  ok(g.fixedBands[0].x === xAt('2026-09-07') && g.fixedBands[0].w === 2 * dw,
    '3 — die band beslaat precies twee dagen');

  // Week- en maandlijnen: maandagen 7, 14 en 21 binnen dit domein; geen 1e van de maand.
  ok(g.weekLines.length === 3, `3 — drie weekscheidingen (kreeg ${g.weekLines.length})`);
  ok(g.monthLines.length === 0, '3 — geen maandlijn binnen september');
}

// ── De verschil-prijs (§2.2) ─────────────────────────────────────────────────────────────────
ok(savingsWorkdays(5, 2) === 3, 'prijs — uit 5, aan 2 ⇒ bespaart 3 werkdagen');
ok(savingsWorkdays(4, 4) === 0, 'prijs — even duur ⇒ bespaart niets');
ok(savingsWorkdays(1, 3) === 0, 'prijs — aan is duurder ⇒ geklemd op nul, nooit negatief');
ok(maxEndShiftWorkdays([{ endShiftWorkdays: 1 }, { endShiftWorkdays: 4 }, { endShiftWorkdays: 0 }]) === 4,
  'prijs — de prijs is de UITSCHIETER over de deelnemers, niet de som');
ok(maxEndShiftWorkdays([]) === 0, 'prijs — zonder deelnemers is de prijs nul');

// ── De maatvoering uit het prototype ─────────────────────────────────────────────────────────
ok(STRIP.labelWidth === 150 && STRIP.endWidth === 132 && STRIP.trackHeight === 32,
  'maten — label 150, uitkomstlabel 132, track 32 (prototype tabblad 4)');
ok(STRIP.handleWidth === 15 && STRIP.handleHeight === 30, 'maten — de handle is 15×30');
ok(STRIP.blockHeight === 15 && STRIP.blockTop === 5, 'maten — een dagblokje is 15 hoog op y=5');

if (failures > 0) { console.log(`\n${failures} fout(en)`); process.exit(1); }
console.log('\nalles groen');
```

- [ ] **Step 2: Registreer de check in `tests/planning/run.sh`**

Zoek het bestaande blok (rond regel 691) en zet het nieuwe blok er direct ONDER:

```bash
  # B1c-plan4 taak 1: de pure balkgeometrie van de verdeeldialoog — dagblokjes, pauzedagen (een
  # weekend is er GEEN), de gestippelde rest tot het plafond, de meetlat grijs/rood, en de
  # verschil-prijs van de onderbrekingsschakelaar.
  DISTSTRIPCHECK="$DIR/.distribution-strip-geometry.mjs"
  if bundle_check "$DIR/check-distribution-strip-geometry.ts" "$DISTSTRIPCHECK"; then node "$DISTSTRIPCHECK" || STATUS=1; fi
```

- [ ] **Step 3: Draai de check en zie hem falen**

```bash
export PATH="/home/nozzit/.nvm/versions/node/v22.23.2/bin:$PATH"
npm run test:planning 2>&1 | grep -A3 "distribution-strip"; echo "exit: ${PIPESTATUS[0]}"
```

Verwacht: een bundelfout ("Could not resolve … stripGeometry") en **exit 1**. Ziet de suite er groen
uit, dan kijk je naar de tail in plaats van naar de exitcode — zie regel 1 bovenaan dit plan.

- [ ] **Step 4: Schrijf `stripGeometry.ts`**

Maak `src/components/dialogs/DistributionDialog/stripGeometry.ts`:

```ts
// B1c-plan4 taak 1 — de PURE balkgeometrie van één projectrij in de verdeeldialoog (spec §4).
//
// WAAROM DIT EEN EIGEN MODULE IS. De balk is sinds dit herontwerp de BEDIENING, niet een plaatje:
// hij toont per werkdag een blokje, maakt een ingevoegde pauze zichtbaar, tekent hoeveel ruimte je
// toestond maar niet nodig bleek, en meet met een meetlat af hoeveel van de verschuiving nog binnen
// de eigen speling valt. Dat is genoeg regelwerk om buiten React te horen: hier is het headless
// toetsbaar (`tests/planning/check-distribution-strip-geometry.ts`) en kan `PhaseStrip.tsx` zich tot
// tekenen en gebaren beperken.
//
// PUUR, GEEN DOMEINTYPES. De werkdagvraag komt als predicaat binnen (`isWorkingDay`), niet als
// `WorkCalendar` — zo hoeft de check geen kalendermotor op te tuigen en kan de aanroeper gewoon de
// `CalendarEngine` van het betreffende document doorgeven. Dezelfde keuze als `chartGeometry.ts`, dat
// de capaciteit als `capacityOn`-functie aanneemt.
//
// DE MEETLAT MEET DE FASE, NIET HET PROJECT (KEUZE VAN DIT PLAN, zie het plan bij taak 1). Grijs
// gestippeld = de BESCHIKBARE speling vanaf het oorspronkelijke fase-einde; massief rood = alles
// daarvoorbij. Dat is letterlijk `.pfl`/`.pover` uit het prototype, en het klopt per constructie met
// `endShiftWorkdays`: zolang dat 0 is, blijft het fase-einde binnen de grijze meetlat en is er geen
// rood.
//
// EEN WEEKEND IS GEEN PAUZEDAG. De as loopt op KALENDERdagen, dus zonder de werkdagtoets zou elke
// balk vol arcering staan en zou een echte, ingevoegde onderbreking niet meer opvallen — precies het
// gebrek dat de gebruikstest van 2026-09-12 aanwees ("pauzes waren onzichtbaar").
import { AXIS, type OccupancyAxis } from '@/components/panels/occupancyAxis';
import { parseDate } from '@/utils/dateUtils';

/** De maatvoering van één rij, letterlijk uit het prototype (tabblad 4, `.prow`/`.ptrack.tall`).
 *  Eén definitie, gedeeld door `PhaseStrip.tsx` (de rij zelf) en `DistributionDialog.tsx` (de
 *  uitlijning van het histogram eronder) — anders lopen balk en histogram alsnog uit elkaar. */
export const STRIP = {
  /** `.plabel` — kleurstip, projectnaam, "speling N dagen". */
  labelWidth: 150,
  /** `.pend` — de uitkomstpil met "max <datum> · benut N". */
  endWidth: 132,
  /** `.prow { gap: 10px }`. */
  gap: 10,
  /** `.ptrack.tall { height: 32px }`. */
  trackHeight: 32,
  /** `.ptrack.tall .pblk { top: 5px; height: 15px }`. */
  blockHeight: 15,
  blockTop: 5,
  /** `.pfl`/`.pover { bottom: 3px; height: 3px }`. */
  measureHeight: 3,
  measureBottom: 3,
  /** `.phandle { top: 1px; height: 30px; width: 15px; margin-left: -7px }`. */
  handleWidth: 15,
  handleHeight: 30,
  handleTop: 1,
} as const;

export type StripBlockKind = 'work' | 'pause';

/** Eén dagblokje in de track. `w` is altijd één dagbreedte; de 1 px witte scheiding rechts is een
 *  tekenkeuze van de component, geen geometrie. */
export interface StripBlock {
  iso: string;
  x: number;
  w: number;
  kind: StripBlockKind;
}

/** Een aaneengesloten horizontale band (vaste last, gestippelde rest, meetlat). */
export interface StripBand {
  x: number;
  w: number;
}

export interface StripGeometry {
  blocks: StripBlock[];
  /** De vaste last van gepinde/#63-documenten, samengevoegd tot aaneengesloten banden. */
  fixedBands: StripBand[];
  /** "Toegestaan maar niet benut": van het fase-einde tot de handle. `null` ⇒ niets over. */
  freeBox: StripBand | null;
  /** De beschikbare eigen speling, vanaf het OORSPRONKELIJKE fase-einde. */
  slackBar: StripBand | null;
  /** Alles voorbij die speling — dus echte einddatum-verschuiving. */
  overrunBar: StripBand | null;
  /** x van het MIDDEN van de handle. */
  handleX: number;
  /** x van de rechterrand van de laatste geboekte dag. */
  phaseEndX: number;
  /** De kalenderdag waarop het plafond uitkomt; `null` bij een onbegrensd plafond. */
  ceilingEndIso: string | null;
  /** x-posities van de 1 px weekscheidingen (elke maandag) … */
  weekLines: number[];
  /** … en van de donkerdere maandlijnen (elke eerste van de maand). */
  monthLines: number[];
}

export interface StripGeometryInput {
  axis: OccupancyAxis;
  /** `DistributionProposal.bookingByDay[docId]` — de stand VÓÓR de verdeling. Levert het
   *  oorspronkelijke fase-einde, het ankerpunt van de meetlat. */
  beforeLoadByDay: Record<string, number>;
  /** `DistributionProposal.afterLoadByDay[docId]` — de stand NÁ de verdeling; dít wordt getekend. */
  loadByDay: Record<string, number>;
  /** `DistributionProposal.fixedLoadByDay`, met de eigen boeking er al afgetrokken wanneer dit
   *  document zélf gepind is (dat doet de aanroeper — een gepind document zit in de vaste last). */
  fixedLoadByDay: Record<string, number>;
  isWorkingDay: (iso: string) => boolean;
  /** De eigen speling in hele werkdagen (`documentFloatOn`, geklemd op ≥ 0). */
  slackWorkdays: number;
  /** Het ingestelde plafond in werkdagen; `null` = onbegrensd. */
  ceilingWorkdays: number | null;
  /** De benutte uitloop (`DistributionDocResult.endShiftWorkdays`). */
  endShiftWorkdays: number;
}

/** Alle kalenderdagen van de as met hun x, in tekenvolgorde. */
function axisDayXs(axis: OccupancyAxis): { iso: string; x: number }[] {
  const out: { iso: string; x: number }[] = [];
  for (const segment of axis.segments) {
    for (let i = 0; i < segment.days.length; i++) {
      out.push({ iso: segment.days[i], x: segment.x0 + i * axis.dayWidth });
    }
  }
  return out;
}

/** De laatste dag met een boeking, of `null` wanneer er niets geboekt is. */
function lastBookedDay(loadByDay: Record<string, number>): string | null {
  let last: string | null = null;
  for (const [iso, units] of Object.entries(loadByDay)) {
    if (units > 0 && (last === null || iso > last)) last = iso;
  }
  return last;
}

/** De eerste dag met een boeking, of `null`. */
function firstBookedDay(loadByDay: Record<string, number>): string | null {
  let first: string | null = null;
  for (const [iso, units] of Object.entries(loadByDay)) {
    if (units > 0 && (first === null || iso < first)) first = iso;
  }
  return first;
}

/**
 * Loop vanaf (exclusief) `fromIso` `workdays` WERKdagen vooruit over de as en geef de dag waarop je
 * uitkomt plus de x van zijn rechterrand. Loopt de as op vóór het aantal bereikt is, dan levert hij
 * het aseinde — de handle mag de as nooit verlaten.
 */
function advanceWorkdays(
  axis: OccupancyAxis,
  days: { iso: string; x: number }[],
  fromIso: string | null,
  workdays: number,
  isWorkingDay: (iso: string) => boolean,
): { iso: string | null; xEnd: number } {
  const startX = fromIso === null
    ? AXIS.padLeft
    : (axis.xOf(fromIso) ?? AXIS.padLeft) + axis.dayWidth;
  if (workdays <= 0) return { iso: fromIso, xEnd: startX };
  let remaining = workdays;
  for (const day of days) {
    if (fromIso !== null && day.iso <= fromIso) continue;
    if (!isWorkingDay(day.iso)) continue;
    remaining -= 1;
    if (remaining === 0) return { iso: day.iso, xEnd: day.x + axis.dayWidth };
  }
  return { iso: null, xEnd: axis.width - AXIS.padRight };
}

/** De volledige geometrie van één rij. Zie het moduleblok voor de vier lagen. */
export function buildStripGeometry(input: StripGeometryInput): StripGeometry {
  const {
    axis, beforeLoadByDay, loadByDay, fixedLoadByDay, isWorkingDay,
    slackWorkdays, ceilingWorkdays, endShiftWorkdays,
  } = input;
  const dayWidth = axis.dayWidth;
  const days = axisDayXs(axis);
  const trackRight = axis.width - AXIS.padRight;

  // (1) De dagblokjes van de NA-stand, binnen de fasespanne.
  const first = firstBookedDay(loadByDay);
  const last = lastBookedDay(loadByDay);
  const blocks: StripBlock[] = [];
  if (first !== null && last !== null) {
    for (const day of days) {
      if (day.iso < first || day.iso > last) continue;
      const booked = (loadByDay[day.iso] ?? 0) > 0;
      if (booked) blocks.push({ iso: day.iso, x: day.x, w: dayWidth, kind: 'work' });
      else if (isWorkingDay(day.iso)) blocks.push({ iso: day.iso, x: day.x, w: dayWidth, kind: 'pause' });
      // Een niet-werkdag zonder boeking is geen pauze maar gewoon weekend: niets tekenen.
    }
  }
  const phaseEndX = last === null ? AXIS.padLeft : (axis.xOf(last) ?? AXIS.padLeft) + dayWidth;

  // (2) De vaste last, samengevoegd tot aaneengesloten banden.
  const fixedBands: StripBand[] = [];
  let open: StripBand | null = null;
  for (const day of days) {
    if ((fixedLoadByDay[day.iso] ?? 0) > 0) {
      if (open !== null && Math.abs(open.x + open.w - day.x) < 0.001) open.w += dayWidth;
      else { open = { x: day.x, w: dayWidth }; fixedBands.push(open); }
    } else {
      open = null;
    }
  }

  // (3) De meetlat, verankerd aan het OORSPRONKELIJKE fase-einde.
  const origEnd = lastBookedDay(beforeLoadByDay);
  const origEndX = origEnd === null ? AXIS.padLeft : (axis.xOf(origEnd) ?? AXIS.padLeft) + dayWidth;
  const slack = advanceWorkdays(axis, days, origEnd, Math.max(0, Math.floor(slackWorkdays)), isWorkingDay);
  const slackEndX = Math.min(trackRight, slack.xEnd);
  const slackBar = slackEndX > origEndX ? { x: origEndX, w: slackEndX - origEndX } : null;
  const overrunBar = phaseEndX > slackEndX ? { x: slackEndX, w: phaseEndX - slackEndX } : null;

  // (4) Het plafond: de handle en de gestippelde rest. Onbegrensd ⇒ aan het einde van de as (§5).
  let handleX: number;
  let ceilingEndIso: string | null;
  if (ceilingWorkdays === null) {
    handleX = trackRight;
    ceilingEndIso = null;
  } else {
    const ceiling = advanceWorkdays(
      axis, days, origEnd, Math.max(0, ceilingWorkdays), isWorkingDay);
    handleX = Math.max(AXIS.padLeft, Math.min(trackRight, ceiling.xEnd));
    ceilingEndIso = ceiling.iso;
  }
  // Het plafond wordt vanaf het OORSPRONKELIJKE einde geteld, de benutte uitloop ook — dus wanneer
  // er meer benut is dan toegestaan (een plafond dat krapper is dan de uitkomst) valt de handle ín
  // de balk. Dat is geen fout maar precies de bedoelde aflezing; `endShiftWorkdays` staat hier als
  // documentatie van die relatie en om de aanroeper niet te laten gissen.
  void endShiftWorkdays;
  const freeBox = handleX > phaseEndX ? { x: phaseEndX, w: handleX - phaseEndX } : null;

  // (5) Week- en maandlijnen.
  const weekLines: number[] = [];
  const monthLines: number[] = [];
  for (const day of days) {
    if (day.iso.slice(8) === '01') monthLines.push(day.x);
    else if (parseDate(day.iso).getDay() === 1) weekLines.push(day.x);
  }

  return {
    blocks, fixedBands, freeBox, slackBar, overrunBar,
    handleX, phaseEndX, ceilingEndIso, weekLines, monthLines,
  };
}

/** De grootste einddatum-verschuiving over de deelnemers — de UITSCHIETER, niet de som (§2.2). */
export function maxEndShiftWorkdays(docs: { endShiftWorkdays: number }[]): number {
  return docs.reduce((max, doc) => Math.max(max, doc.endShiftWorkdays), 0);
}

/**
 * Het verschil-prijskaartje van "Onderbrekingen toestaan" (§2.2): hoeveel werkdagen de aan-stand
 * bespaart ten opzichte van de uit-stand. Geklemd op 0 — onderbreken kán in theorie duurder
 * uitvallen, en dan is "bespaart niets" het eerlijke antwoord.
 */
export function savingsWorkdays(offMax: number, onMax: number): number {
  return Math.max(0, offMax - onMax);
}
```

- [ ] **Step 5: Draai de check tot hij groen is**

```bash
export PATH="/home/nozzit/.nvm/versions/node/v22.23.2/bin:$PATH"
npm run test:planning; echo "exit: $?"
```

Verwacht: **exit 0**, en in de uitvoer `alles groen` ná de regels van
`check-distribution-strip-geometry`. Faalt een `OK`-regel, lees welke — de x-posities zijn met de
hand na te rekenen als `AXIS.padLeft + index * dayWidth`.

- [ ] **Step 6: Typecheck + lint**

```bash
export PATH="/home/nozzit/.nvm/versions/node/v22.23.2/bin:$PATH"
npm run typecheck && npm run lint; echo "exit: $?"
```

Verwacht: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/dialogs/DistributionDialog/stripGeometry.ts \
        tests/planning/check-distribution-strip-geometry.ts tests/planning/run.sh
git commit -m "$(cat <<'EOF'
feat(b1c): pure balkgeometrie en verschil-prijs voor de verdeeldialoog

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `PhaseStrip` herbouwd — label | track | uitkomstlabel

**Files:**
- Rewrite: `src/components/dialogs/DistributionDialog/PhaseStrip.tsx` (vervang het HELE bestand)
- Test: taak 6 (browser). Deze taak heeft geen eigen headless test — de geometrie zit in taak 1, wat
  hier overblijft is tekenen en gebaren, en dat toets je in een echte browser.

### Wat er verandert en waarom

| nu | straks | spec |
|---|---|---|
| één SVG van 24 px hoog met massieve rechthoeken per dag | een rij van drie kolommen: label 150 px, track 32 px hoog, uitkomstlabel 132 px | §4 |
| de boeking als hoogte-gestapelde staaf | per werkdag één blokje van 15 px in de projectkleur met een 1 px witte scheiding rechts | §4 |
| pauzes onzichtbaar | gearceerd blokje (`repeating-linear-gradient(135deg, …)`) met een dun grijs randje | §4 |
| handle = een 5 px streepje | een knop van 15×30 px met drie grijpstreepjes, `cursor: ew-resize` | §5 |
| pin = een icoonknop | een tekstknop "vastzetten" ↔ "vast — losmaken" | §6 |
| effect als kale tekst rechts | een gekleurde pil (+0 groen, +1/+2 amber, meer rood) met daaronder "max <datum> · benut N" | §4 |
| geen legenda | één legenda-regel onder alle balken (staat in taak 4, de dialoog) | §4 |

**KEUZE VAN DIT PLAN — SVG voor de track, DOM voor de handle.** Het prototype tekent alles met
absoluut gepositioneerde `<span>`s. Dit plan tekent de **track in SVG** en zet de **handle als
absoluut gepositioneerde `<button>` erbovenop** — precies de verdeling die `PhaseStrip.tsx` vandaag
al heeft en die `ContourPhaseStrip.tsx` (de andere fasestrook in dit product) ook aanhoudt. Drie
redenen: (1) de tekenlaag komt uit een pure module die x/w in viewBox-eenheden levert, en SVG neemt
die 1-op-1 over terwijl DOM er percentages van zou moeten maken — een tweede omrekening die van de
as kan afwijken; (2) de handle moet focusbaar zijn, een `role="slider"` dragen, toetsen afhandelen en
een `:focus-visible`-omranding krijgen, en dat is in DOM triviaal en in SVG omslachtig; (3) de
arcering van een pauzedag is in SVG een `<pattern>`, wat leesbaarder is dan een herhaalde gradient én
in beide thema's met `currentColor` meekleurt. De **maatvoering** blijft onveranderd die van het
prototype — `STRIP` in `stripGeometry.ts` is daar de enige bron van.

**KEUZE VAN DIT PLAN — wanneer het slepen commit.** Onder de ondersteunde schaal commit élke gesnapte
werkdagverandering meteen (`liveCommit`), zodat de hook doorrekent en de hele dialoog meebeweegt
(§5). Boven de schaal (gedegradeerd) commit alleen het loslaten — dan beweegt tijdens het slepen
alleen de handle en de plafondtekst, precies wat §5 daarvoor voorschrijft. De component kent dat
verschil via één `liveCommit`-prop; hij beslist er niet zelf over.

- [ ] **Step 1: Vervang `PhaseStrip.tsx` volledig**

```tsx
// B1c-plan4 taak 2 — de BALK van één project in de verdeeldialoog (spec §4/§5/§6).
//
// DE BALK IS DE BEDIENING. Vóór dit herontwerp was de strook een dun blokje van 24 px waarin je
// dagen niet kon tellen, pauzes niet zag en tijdens het slepen niets bewoog; de eigenaar vatte dat
// op 2026-09-12 samen als "ik snap niet wat alle knoppen doen". De vorm hier is die van het
// gekozen prototype (`docs/superpowers/prototypes/2026-08-27-b1c-interface-lab.html`, tabblad 4):
// een rij van drie kolommen — label 150 px | track 32 px | uitkomstlabel 132 px — met per werkdag
// een apart blokje, zodat je de dagen letterlijk kunt tellen.
//
// DE GEOMETRIE ZIT NIET HIER. `stripGeometry.ts` rekent uit een voorstel-doorsnede de dagblokjes,
// pauzedagen, de gestippelde rest en de meetlat uit; deze component tekent ze en vangt de gebaren
// op. Dat is dezelfde knip als tussen `chartGeometry.ts` en `BeforeAfterChart.tsx`.
//
// SVG VOOR DE TRACK, DOM VOOR DE HANDLE. Zie het plan bij taak 2: de tekenlaag neemt de x/w van de
// pure module 1-op-1 over, en de handle is een echte `<button>` omdat hij focus, toetsen en een
// `:focus-visible`-omranding nodig heeft.
//
// LIVE MEEREKENEN TIJDENS HET SLEPEN (§5). Onder de ondersteunde schaal gaat élke gesnapte
// werkdagverandering meteen naar `onCeilingChange` — de hook coalesceert die runs zelf (één in
// vlucht, de laatste stand wint), dus er is hier GEEN eigen timer nodig en er mag er ook geen
// bijkomen: een tweede throttle zou de laatste stand kunnen inslikken. Boven de schaal
// (`liveCommit === false`) commit alleen het loslaten, en beweegt tijdens het slepen dus alleen de
// handle en de plafondtekst. Een zuivere klik (pointerdown/-up zonder move) commit nooit iets:
// anders zou een klik op een onbegrensde handle 'm stiekem op een concreet getal zetten.
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AXIS, type OccupancyAxis } from '@/components/panels/occupancyAxis';
import { STRIP, buildStripGeometry } from './stripGeometry';

/** Eindige bovengrens voor `aria-valuemax`. Het plafond zélf kent ook `null` = ONBEGRENSD (de
 *  End-toets); dat is geen 61e waarde maar het ontbreken van een grens, en wordt aan
 *  hulptechnologie gerapporteerd als deze `valuemax` mét een `aria-valuetext` die "onbegrensd"
 *  zegt — een slider zonder eindige `valuemax` is voor screenreaders betekenisloos. */
export const CEILING_MAX_WORKDAYS = 60;

/** De pil-toon bij een einddatum-verschuiving (§4): 0 groen, 1–2 amber, meer rood. */
function shiftTone(workdays: number): { background: string; color: string } {
  if (workdays <= 0) return { background: 'color-mix(in srgb, var(--success) 18%, transparent)', color: 'var(--success)' };
  if (workdays <= 2) return { background: 'color-mix(in srgb, var(--warning) 20%, transparent)', color: 'var(--warning)' };
  return { background: 'color-mix(in srgb, var(--error) 16%, transparent)', color: 'var(--error)' };
}

export interface PhaseStripProps {
  docId: string;
  title: string;
  /** De gedeelde tijdas, of `null` wanneer er geen enkele geboekte dag te tekenen valt. */
  axis: OccupancyAxis | null;
  /** `proposal.bookingByDay[docId]` — de stand VÓÓR (ankerpunt van de meetlat). */
  beforeLoadByDay: Record<string, number>;
  /** `proposal.afterLoadByDay[docId]` — de stand NÁ; dít wordt als dagblokjes getekend. */
  afterLoadByDay: Record<string, number>;
  /** `proposal.fixedLoadByDay` met de eigen boeking er al af wanneer dit document gepind is. */
  fixedLoadByDay: Record<string, number>;
  /** Is deze kalenderdag een werkdag in de kalender van dít document? Bepaalt of een boekingsloze
   *  dag binnen de fase een PAUZEDAG is of gewoon weekend. */
  isWorkingDay: (iso: string) => boolean;
  /** De identiteitskleur van dít document (`assignDocColors`) — gedeeld met het histogram. */
  color: string;
  /** De eigen speling in werkdagen; `null` ⇒ onbekend (geen boekende taak). */
  slackWorkdays: number | null;
  /** Werkdagen die de einddatum van dít document opschuift in het huidige voorstel. */
  endShiftWorkdays: number;
  /** Het ingestelde plafond in werkdagen; `null` = onbegrensd. */
  ceiling: number | null;
  pinned: boolean;
  /** #63 "datums zoals opgeslagen": impliciet gepind, en niet met een pin-knop te ontgrendelen. */
  recorded: boolean;
  /** Alle betrokken taken staan vast (priority 1000) — het document KAN niet wijken. */
  cannotMove: boolean;
  /** Onder de ondersteunde schaal ⇒ élke gesnapte werkdag commit meteen (§5). */
  liveCommit: boolean;
  /** Er loopt een berekening: de uitkomstpil toont "Bezig…" ZONDER van maat te veranderen (§7). */
  busy: boolean;
  /** Datumnotatie voor de plafonddatum — de dialoog levert één `Intl.DateTimeFormat` voor alle rijen. */
  formatDay: (iso: string) => string;
  onTogglePin: () => void;
  onCeilingChange: (next: number | null) => void;
}

export function PhaseStrip({
  docId, title, axis, beforeLoadByDay, afterLoadByDay, fixedLoadByDay, isWorkingDay, color,
  slackWorkdays, endShiftWorkdays, ceiling, pinned, recorded, cannotMove, liveCommit, busy,
  formatDay, onTogglePin, onCeilingChange,
}: PhaseStripProps) {
  const { t } = useTranslation('common');

  // Sleepstate: `dragRef` is de bron van waarheid TIJDENS het slepen (geen staleness over
  // event-grenzen heen), `dragValue` de renderbare afgeleide. Niet-`null` ⇒ er wordt nu gesleept.
  const dragRef = useRef<{ pointerId: number; startX: number; startCeiling: number; moved: boolean; value: number } | null>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);

  const dayWidth = axis?.dayWidth ?? 0;
  const trackWidth = axis?.width ?? AXIS.padLeft + 200;
  const displayCeiling = dragValue !== null ? dragValue : ceiling;

  const geometry = axis === null ? null : buildStripGeometry({
    axis,
    beforeLoadByDay,
    loadByDay: afterLoadByDay,
    fixedLoadByDay,
    isWorkingDay,
    slackWorkdays: slackWorkdays ?? 0,
    ceilingWorkdays: displayCeiling,
    endShiftWorkdays,
  });

  const handleX = geometry?.handleX ?? AXIS.padLeft;
  const patternId = `ops-pause-${docId}`;

  const ceilingText = displayCeiling === null
    ? t('resource.distribution.strip.ceilingUnlimited')
    : t('resource.distribution.strip.ceilingDays', { count: displayCeiling });
  const shiftText = endShiftWorkdays === 0
    ? t('resource.distribution.strip.endUnchanged')
    : t('resource.distribution.strip.endShift', { count: endShiftWorkdays });
  const maxDateText = geometry?.ceilingEndIso
    ? t('resource.distribution.strip.maxDate', { date: formatDay(geometry.ceilingEndIso) })
    : t('resource.distribution.strip.maxDate', { date: t('resource.distribution.strip.ceilingUnlimited') });
  const usedText = t('resource.distribution.strip.used', { used: endShiftWorkdays });
  const valueText = `${ceilingText} — ${shiftText}`;

  const clamp = (value: number) => Math.max(0, Math.min(CEILING_MAX_WORKDAYS, value));
  // Onbegrensd is geen getal op de as, dus een pijltje pakt de handle op waar hij staat: bij de
  // benutte uitloop. Dat is de enige lezing waarin de handle niet verspringt op het moment dat je
  // hem voor het eerst aanraakt. Pointer en toetsenbord delen dit stappunt — één definitie.
  const stepBase = ceiling ?? Math.max(0, endShiftWorkdays);

  const commit = (next: number | null) => {
    if (pinned) return;
    onCeilingChange(next);
  };

  const onHandleKey = (event: React.KeyboardEvent) => {
    if (pinned) return;
    let next: number | null;
    switch (event.key) {
      case 'ArrowRight': case 'ArrowUp': next = clamp(stepBase + 1); break;
      case 'ArrowLeft': case 'ArrowDown': next = clamp(stepBase - 1); break;
      case 'PageUp': next = clamp(stepBase + 3); break;
      case 'PageDown': next = clamp(stepBase - 3); break;
      case 'Home': next = 0; break;
      case 'End': next = null; break;
      default: return;
    }
    // De dialoog scrollt; pijltjes en Home/End mogen die scroll niet óók verzetten.
    event.preventDefault();
    event.stopPropagation();
    commit(next);
  };

  const onHandlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (pinned || dragRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startCeiling: stepBase, moved: false, value: stepBase };
    setDragValue(stepBase);
  };

  const onHandlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.moved = true;
    if (dayWidth <= 0) return;
    // Snappen op hele werkdagen: dezelfde dayWidth-per-werkdag-conventie die de tekenpositie van de
    // handle hierboven gebruikt. Een tweede, kalenderdaggetrouwe omrekening zou de handle tijdens
    // het slepen van zijn eigen getekende positie laten afwijken.
    const next = clamp(drag.startCeiling + Math.round((event.clientX - drag.startX) / dayWidth));
    if (next === drag.value) return;
    drag.value = next;
    setDragValue(next);
    // Onder de schaal is ELKE gesnapte werkdag een rekenmoment (§5). De hook coalesceert.
    if (liveCommit) commit(next);
  };

  const onHandlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragValue(null);
    // Een zuivere klik commit niets; in de live-stand is de waarde al onderweg.
    if (drag.moved && !liveCommit) commit(drag.value);
  };

  const onHandlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragValue(null);
  };

  const tone = shiftTone(endShiftWorkdays);

  return (
    <div
      className="flex items-center"
      style={{ gap: STRIP.gap }}
      data-ops-distribution-strip
      data-ops-doc-id={docId}
      data-ops-distribution-day-width={dayWidth}
      {...(pinned ? { 'data-ops-distribution-pinned': 'true' } : {})}
    >
      {/* (a) LABEL — kleurstip, projectnaam, speling, pin-tekstknop (§4/§6). */}
      <div
        className="flex flex-col justify-center shrink-0 min-w-0"
        style={{ width: STRIP.labelWidth }}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <span
            className="inline-block rounded-[2px] shrink-0"
            style={{ width: 8, height: 8, background: color }}
            aria-hidden
          />
          <span className="truncate font-medium">{title}</span>
        </span>
        <span className="text-[10px] text-text-secondary truncate">
          {t('resource.distribution.strip.slack', {
            days: slackWorkdays === null ? '—' : String(slackWorkdays),
          })}
        </span>
        {recorded ? (
          <span
            className="text-[10px] text-text-secondary truncate"
            title={`${t('recordedDates.active')} ${t('recordedDates.recalculate')}`}
            data-ops-distribution-recorded
          >
            {t('resource.distribution.strip.pinnedRecorded')}
          </span>
        ) : cannotMove ? (
          <span className="text-[10px] text-text-secondary truncate">
            {t('resource.distribution.strip.cannotMove')}
          </span>
        ) : (
          <button
            type="button"
            aria-pressed={pinned}
            title={t('resource.distribution.help.pin')}
            onClick={onTogglePin}
            className="text-[10px] text-left underline underline-offset-2 text-text-secondary hover:text-text-primary"
            data-ops-distribution-pin
          >
            {pinned
              ? t('resource.distribution.strip.unpinButton')
              : t('resource.distribution.strip.pinButton')}
          </button>
        )}
      </div>

      {/* (b) TRACK. Geforceerd LTR, net als het histogram: een tijdas spiegelt nergens in dit
          product. De horizontale scroll zit BEWUST niet hier maar om de hele stapel heen (de
          dialoog), zodat balken en histogram kolom-op-kolom blijven staan tijdens het scrollen. */}
      <div
        className="relative shrink-0"
        dir="ltr"
        style={{ width: trackWidth, height: STRIP.trackHeight, direction: 'ltr' }}
        data-ops-distribution-track
      >
        <svg
          width={trackWidth}
          height={STRIP.trackHeight}
          viewBox={`0 0 ${trackWidth} ${STRIP.trackHeight}`}
          role="img"
          aria-label={title}
          style={{ display: 'block' }}
        >
          <defs>
            {/* De arcering van een pauzedag: `repeating-linear-gradient(135deg, …)` uit het
                prototype, hier als SVG-pattern zodat hij met het thema meekleurt. */}
            <pattern id={patternId} width={6} height={6} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <rect width={6} height={6} fill="var(--theme-text-dim)" opacity={0.05} />
              <rect width={3} height={6} fill="var(--theme-text-dim)" opacity={0.17} />
            </pattern>
          </defs>

          {/* De track zelf: lichte achtergrond met een randje (`.ptrack`). */}
          <rect
            x={AXIS.padLeft} y={0}
            width={Math.max(0, trackWidth - AXIS.padLeft - AXIS.padRight)}
            height={STRIP.trackHeight}
            rx={6}
            fill="var(--theme-surface-alt, transparent)"
            stroke="var(--theme-border-light)"
          />

          {/* Vaste last van gepinde/#63-documenten (§4, achtergrondband). */}
          {(geometry?.fixedBands ?? []).map((band, i) => (
            <rect key={`fx-${i}`} x={band.x} y={0} width={band.w} height={STRIP.trackHeight}
              fill="var(--theme-text-dim)" opacity={0.14} />
          ))}

          {/* Weekscheidingen (1 px) en de donkerdere maandlijn. */}
          {(geometry?.weekLines ?? []).map((x, i) => (
            <rect key={`w-${i}`} x={x} y={0} width={1} height={STRIP.trackHeight} fill="var(--theme-border-light)" />
          ))}
          {(geometry?.monthLines ?? []).map((x, i) => (
            <rect key={`m-${i}`} x={x} y={0} width={1} height={STRIP.trackHeight} fill="var(--theme-border)" />
          ))}

          {/* "Toegestaan maar niet benut" — lege doos met gestippelde rand (§4). */}
          {geometry?.freeBox && (
            <rect
              x={geometry.freeBox.x} y={STRIP.blockTop}
              width={Math.max(1, geometry.freeBox.w)} height={STRIP.blockHeight}
              fill="none" stroke="var(--theme-text-dim)" strokeWidth={1} strokeDasharray="3 3" rx={2}
              data-ops-distribution-tail
            />
          )}

          {/* De dagblokjes. Een werkdag in de projectkleur met een 1 px witte scheiding rechts
              (`.pwork`), een pauzedag gearceerd met een dun grijs randje (`.ppause`). */}
          {(geometry?.blocks ?? []).map(block => (block.kind === 'work' ? (
            <rect
              key={`b-${block.iso}`}
              x={block.x} y={STRIP.blockTop}
              width={Math.max(1, block.w - 1)} height={STRIP.blockHeight}
              fill={color} opacity={pinned ? 0.45 : 0.9}
              data-ops-doc-id={docId} data-ops-distribution-day="work"
            />
          ) : (
            <rect
              key={`p-${block.iso}`}
              x={block.x + 0.5} y={STRIP.blockTop}
              width={Math.max(1, block.w - 1)} height={STRIP.blockHeight}
              fill={`url(#${patternId})`} stroke="var(--theme-border)" strokeWidth={1} rx={2}
              data-ops-distribution-day="pause"
            />
          )))}

          {/* De meetlat: grijs gestippeld = speling, massief rood = einddatum-verschuiving (§4). */}
          {geometry?.slackBar && (
            <rect
              x={geometry.slackBar.x} y={STRIP.trackHeight - STRIP.measureBottom - STRIP.measureHeight}
              width={Math.max(1, geometry.slackBar.w)} height={STRIP.measureHeight}
              fill="var(--theme-text-dim)" opacity={0.55} strokeDasharray="3 3"
              data-ops-distribution-slack-bar
            />
          )}
          {geometry?.overrunBar && (
            <rect
              x={geometry.overrunBar.x} y={STRIP.trackHeight - STRIP.measureBottom - STRIP.measureHeight}
              width={Math.max(1, geometry.overrunBar.w)} height={STRIP.measureHeight}
              fill="var(--error)"
              data-ops-distribution-overrun-bar
            />
          )}
        </svg>

        {/* De HANDLE (§5): een echte knop van 15×30 met drie grijpstreepjes. */}
        <button
          type="button"
          role="slider"
          aria-label={t('resource.distribution.strip.handleLabel', { doc: title })}
          aria-valuemin={0}
          aria-valuemax={CEILING_MAX_WORKDAYS}
          aria-valuenow={displayCeiling ?? CEILING_MAX_WORKDAYS}
          aria-valuetext={valueText}
          aria-disabled={pinned || undefined}
          title={t('resource.distribution.help.ceiling')}
          onKeyDown={onHandleKey}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerCancel}
          data-ops-distribution-handle
          className="absolute flex items-center justify-center rounded-[4px] border"
          style={{
            left: handleX - STRIP.handleWidth / 2,
            top: STRIP.handleTop,
            width: STRIP.handleWidth,
            height: STRIP.handleHeight,
            borderColor: 'var(--theme-text-secondary)',
            background: 'var(--theme-surface)',
            cursor: pinned ? 'not-allowed' : 'ew-resize',
            opacity: pinned ? 0.45 : 1,
            touchAction: 'none',
            padding: 0,
          }}
        >
          {/* Drie grijpstreepjes (`.phandle::before` met twee box-shadows in het prototype). */}
          <span aria-hidden className="flex items-center" style={{ gap: 2 }}>
            <span style={{ width: 1, height: 13, background: 'var(--theme-text-secondary)' }} />
            <span style={{ width: 1, height: 13, background: 'var(--theme-text-secondary)' }} />
            <span style={{ width: 1, height: 13, background: 'var(--theme-text-secondary)' }} />
          </span>
        </button>
      </div>

      {/* (c) UITKOMSTLABEL — vaste breedte, dus een toestandswissel verandert de maat niet (§7). */}
      <div
        className="flex flex-col items-end shrink-0 text-right"
        style={{ width: STRIP.endWidth }}
        data-ops-distribution-effect
      >
        <span
          className="inline-block rounded-full px-2 py-0.5 tabular-nums"
          style={busy
            ? { background: 'color-mix(in srgb, var(--theme-text-dim) 14%, transparent)', color: 'var(--theme-text-secondary)' }
            : tone}
        >
          {busy ? t('resource.distribution.compute.busy') : shiftText}
        </span>
        <span className="text-[10px] text-text-secondary truncate w-full">
          {`${maxDateText} · ${usedText}`}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
export PATH="/home/nozzit/.nvm/versions/node/v22.23.2/bin:$PATH"
npm run typecheck; echo "exit: $?"
```

Verwacht: **fouten in `DistributionDialog.tsx`** — die geeft nog de oude props door
(`dailyLoad`, `scaleMax`, `degraded`, `onTogglePin`) en mist de nieuwe (`beforeLoadByDay`,
`afterLoadByDay`, `isWorkingDay`, `slackWorkdays`, `liveCommit`, `busy`, `formatDay`). Dat is
verwacht: taak 4 bedraadt de aanroeper. **Commit deze taak dus samen met taak 4** wanneer je ze
achter elkaar uitvoert; bouw je ze parallel, dan blijft deze taak op een eigen branch tot taak 4 er
is. De typecheck van de losse component controleer je zolang met:

```bash
export PATH="/home/nozzit/.nvm/versions/node/v22.23.2/bin:$PATH"
npx tsc --noEmit --jsx react-jsx --strict --moduleResolution bundler --module esnext \
  --target es2022 --baseUrl . --paths '{"@/*":["src/*"]}' \
  src/components/dialogs/DistributionDialog/PhaseStrip.tsx 2>&1 | head -20; echo "exit: ${PIPESTATUS[0]}"
```

Verwacht: geen fouten die naar `PhaseStrip.tsx` zelf wijzen.

- [ ] **Step 3: Commit**

```bash
git add src/components/dialogs/DistributionDialog/PhaseStrip.tsx
git commit -m "$(cat <<'EOF'
feat(b1c): de projectbalk herbouwd naar het Interface-lab-prototype

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: de hook — verschil-prijs, sleeprun, kostenlabels weg

**Files:**
- Modify: `src/components/dialogs/DistributionDialog/useDistributionProposal.ts`
- Test: `tests/planning/check-distribution-chart-scale.ts` blijft ongewijzigd groen (die toetst
  `diffReason`, dat hier niet verandert).

### Wat er verandert

1. **`costByDoc` verdwijnt.** De kostenlabels ("alleen dit project laten opschuiven kost N
   werkdagen") hoorden bij de rangordelijst; die is weg (§2.1/§8). Daarmee verdwijnt ook de duurste
   kant van de labelpas: één volledige `computeDistribution`-run **per deelnemer**. Dat is precies
   wat het live meerekenen tijdens het slepen betaalbaar maakt — er blijven twee extra runs over in
   plaats van N+2.
2. **`toolPrice: { off, on }` wordt `savings`.** Eén verschil (§2.2) in plaats van twee bedragen.
   De hook levert het rauwe getal; de dialoog kiest de zin ("zou N besparen" / "bespaart N").
3. **De sleeprun heeft geen nieuwe code nodig.** De bestaande rekenmoment-2-`useEffect` reageert al
   op elke `ceilings`-wijziging via `diffReason`, en `busyRef`/`pendingRef` doen de coalescing die
   §5 vraagt ("maximaal één run in vlucht, de laatste stand wint"). Wat er wél bij moet: de
   **stale-reden mag tijdens een sleep niet als foutmelding gaan schreeuwen** — zie stap 3.

**KEUZE VAN DIT PLAN — `order` als "afgeleide" betekent: één keer afgeleid, bij het openen.**
Spec §2.1 zegt dat `order` blijft bestaan "als afgeleide (spelingsvolgorde)". `freshDistributionUi`
zet die spelingsvolgorde al (`floatSortedOrder`) op het moment dat een poolitem gekozen wordt, en
zonder rangordelijst kan niets hem daarna nog veranderen. Er komt dus **geen tweede afleidingsmoment
bij**, en dat is geen luiheid maar een noodzaak: zou de hook `order` bij elke run herberekenen en
terugschrijven naar `ui.levelingDistribution`, dan ziet `diffReason` een `'rank'`-wijziging, plant hij
een nieuwe run, en draait de dialoog in een oneindige lus. De rijvolgorde in de dialoog is en blijft
`tune.order`; documenten die ná het openen bijkomen sluiten achteraan aan (bestaand gedrag in
`buildDistributionInputs`).

- [ ] **Step 1: Pas het contract aan**

In `useDistributionProposal.ts`, vervang in `interface DistributionProposalState` de twee laatste
velden:

```ts
  /** docId → "alleen dit document laten opschuiven kost N werkdagen" … */
  costByDoc: Record<string, number>;
  /** Het prijskaartje van de gereedschapsschakelaar … */
  toolPrice: { off: number; on: number } | null;
```

door:

```ts
  /**
   * Het VERSCHIL-prijskaartje van "Onderbrekingen toestaan" (spec §2.2, eigenaarsbesluit
   * 2026-09-12). Twee volledige `computeDistribution`-runs — één met `allowSplits: false`, één met
   * `true` — leveren elk de grootste `endShiftWorkdays` over de deelnemers (de UITSCHIETER, niet de
   * som); `workdays` is het verschil daartussen, geklemd op ≥ 0.
   *
   * Waarom één verschil en niet twee bedragen: de gebruikstest van 2026-09-12 las "kost 27
   * werkdagen uitloop · kost 27 werkdagen uitloop" als een weergavefout. Een gebruiker wil weten wat
   * de schakelaar hém oplevert, niet wat elke stand los kost.
   *
   * `null` ⇒ nog niet (her)berekend; de dialoog zegt dan eerlijk "prijs onbekend".
   */
  savings: { workdays: number } | null;
```

- [ ] **Step 2: Vervang de labelpas door de verschil-pas**

Vervang de hele functie `scheduleDistributionLabels` (inclusief haar doc-blok) door:

```ts
  /**
   * Spec §2.2 — het VERSCHIL-prijskaartje. Twee volledige `computeDistribution`-runs (`allowSplits`
   * uit en aan) ná het hoofdvoorstel, elk in een eigen macrotask zodat de browser ertussen kan
   * schilderen en een afbreekreden binnen één stap landt. Breekt af zodra `myGeneration` is
   * ingehaald door een nieuwere hoofdrun of door een 'edited'-invalidatie
   * (`fingerprintsRef.current === null`) — beide zijn precies de gevallen waarin het hoofdvoorstel
   * op het scherm zelf ook al niet meer bij de documenten hoort.
   *
   * DIT WAS VIER KEER ZO DUUR. Tot 2026-09-12 deed deze pas óók per deelnemer een isolatierun voor
   * de kostenlabels van de rangordelijst. Die lijst is weg (§2.1) en die runs dus ook: er blijven
   * twee runs over in plaats van N+2. Dat is wat het live meerekenen tijdens het slepen (§5)
   * betaalbaar maakt.
   */
  const scheduleSavingsPass = (
    myGeneration: number,
    tuneAtRun: DistributionUiState,
    pool: CompanyPool,
    built: DistributionDocInput[],
  ): void => {
    const superseded = () => generationRef.current !== myGeneration || fingerprintsRef.current === null;
    // Alleen de teller van DEZE pas mag de bezig-toestand weer uitzetten: een nieuwere pas loopt
    // dan al en heeft 'm zojuist zelf aangezet.
    const finish = () => { if (generationRef.current === myGeneration) setLabelsBusy(false); };

    const priceOf = (p: DistributionProposal): number | null =>
      p.blocked ? null : maxEndShiftWorkdays(p.docs);

    let offPrice: number | null = null;
    let onPrice: number | null = null;
    const steps: (() => void)[] = [
      () => {
        offPrice = priceOf(computeDistribution(
          tuneAtRun.companyId, pool, tuneAtRun.libraryItemId, built, { allowSplits: false },
        ));
      },
      () => {
        onPrice = priceOf(computeDistribution(
          tuneAtRun.companyId, pool, tuneAtRun.libraryItemId, built, { allowSplits: true },
        ));
      },
      () => {
        if (offPrice !== null && onPrice !== null) {
          setSavings({ workdays: savingsWorkdays(offPrice, onPrice) });
        }
      },
    ];

    const runStep = (index: number): void => {
      if (superseded() || index >= steps.length) { finish(); return; }
      try {
        steps[index]();
      } catch {
        // Een mislukte stap laat gewoon geen prijs zien — nooit een gok tonen. De volgende stap
        // loopt door; zonder beide prijzen blijft `savings` op `null` en zegt de dialoog eerlijk
        // dat de prijs onbekend is.
      }
      schedule(() => runStep(index + 1));
    };

    setLabelsBusy(true);
    schedule(() => runStep(0));
  };
```

- [ ] **Step 3: Bedraad de nieuwe state**

Drie kleine wijzigingen in de body van `useDistributionProposal`:

**(a)** Vervang de twee `useState`-regels

```ts
  const [costByDoc, setCostByDoc] = useState<Record<string, number>>({});
  const [toolPrice, setToolPrice] = useState<{ off: number; on: number } | null>(null);
```

door:

```ts
  const [savings, setSavings] = useState<{ workdays: number } | null>(null);
```

**(b)** In `runRef.current` vervang

```ts
    setCostByDoc({});
    setToolPrice(null);
```

door

```ts
    // De prijs hoort bij het HUIDIGE voorstel, niet bij het vorige — hij gaat dus meteen leeg zodra
    // een nieuwe run start. Een oud getal tijdens "Bezig met verdelen…" is even misleidend als een
    // oud getal na een invalidatie.
    setSavings(null);
```

en vervang de aanroep

```ts
        if (pool && proposalResult && !proposalResult.blocked && !isDistributionDegraded(built, current)) {
          scheduleDistributionLabels(myGeneration, current, pool, built, proposalResult);
        }
```

door

```ts
        if (pool && proposalResult && !proposalResult.blocked && !isDistributionDegraded(built, current)) {
          scheduleSavingsPass(myGeneration, current, pool, built);
        }
```

**(c)** In het `subjectKey`-effect vervang

```ts
    setCostByDoc({});
    setToolPrice(null);
```

door

```ts
    setSavings(null);
```

en in de `return` van de hook vervang

```ts
    costByDoc, toolPrice,
```

door

```ts
    savings,
```

- [ ] **Step 4: Werk de imports bij**

Voeg bovenaan `useDistributionProposal.ts` toe, onder de bestaande `distribute`-import:

```ts
import { maxEndShiftWorkdays, savingsWorkdays } from './stripGeometry';
```

`DistributionProposal` blijft geïmporteerd (de `priceOf`-signatuur gebruikt hem); `CompanyPool` ook.

- [ ] **Step 5: Werk het moduleblok bij**

Vervang in het moduleblok bovenaan de zin over de sleepbeweging

```
// binnenkomt wordt daarna precies ÉÉN keer ingehaald (niet N keer — een sleepbeweging over de
// plafondhandle in taak 9 levert anders een wachtrij die minutenlang naloopt).
```

door

```
// binnenkomt wordt daarna precies ÉÉN keer ingehaald (niet N keer). DÍT MECHANISME IS DE THROTTLE
// DIE SPEC §5 VRAAGT: onder de ondersteunde schaal commit de balk élke gesnapte werkdag tijdens het
// slepen, en deze in-flight-bewaking zorgt dat er maximaal één run loopt en de laatste stand wint.
// Er hoort hier GEEN tweede timer bij te komen — die zou de laatste stand kunnen inslikken.
```

- [ ] **Step 6: Typecheck**

```bash
export PATH="/home/nozzit/.nvm/versions/node/v22.23.2/bin:$PATH"
npm run typecheck 2>&1 | grep -v "DistributionDialog.tsx" ; echo "exit: ${PIPESTATUS[0]}"
```

Verwacht: geen fouten in `useDistributionProposal.ts` of `stripGeometry.ts`. Fouten in
`DistributionDialog.tsx` (die leest nog `costByDoc`/`toolPrice`) zijn verwacht en worden in taak 4
opgeruimd.

- [ ] **Step 7: Commit**

```bash
git add src/components/dialogs/DistributionDialog/useDistributionProposal.ts
git commit -m "$(cat <<'EOF'
feat(b1c): verschil-prijskaartje i.p.v. twee bedragen, kostenlabels weg

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: de dialooglay-out — rangordelijst weg, validatiestrook, Reset, uitlijning

**Files:**
- Modify: `src/components/common/Dialog.tsx` (één nieuwe prop)
- Modify: `src/components/dialogs/DistributionDialog/DistributionDialog.tsx` (de grote verbouwing)
- Modify: `src/components/dialogs/DistributionDialog/BeforeAfterChart.tsx` (kleurterugval eruit)

### De nieuwe opbouw (spec §3)

```
┌ kop: itemnaam · ondertitel · één regel uitleg ────────────────────────────┐
│ gereedschap: [schakelaar] Onderbrekingen toestaan  "bespaart 3 werkdagen" │
│              <MS Project-toelichting>                                     │
│ ┌ één horizontale scroll-container ───────────────────────────────────┐   │
│ │ [label 150] [track ..................] [uitkomst 132]   ← per project│   │
│ │ [label 150] [track ..................] [uitkomst 132]                │   │
│ │ legenda-regel, ingesprongen tot de track                             │   │
│ │ [ 150 spatie ] einddatum-badges per project [132 spatie]             │   │
│ │ [ 150 spatie ] histogram Nu / Na verdelen   [132 spatie]             │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
│ validatiestrook (altijd gerenderd, vaste hoogte) · reden voor Toepassen   │
├ knoppenbalk: [Ander item kiezen…] [Reset]   [Herbereken] [Toepassen] [Verwerpen] │
└───────────────────────────────────────────────────────────────────────────┘
```

**KEUZE VAN DIT PLAN — één scroll-container om balken én histogram.** Spec §3.4 eist dat het
histogram "kolom-op-kolom uitgelijnd met de balken" staat. Vandaag heeft élke strook en élk
histogram zijn eigen `overflow-x-auto`; scrollt de gebruiker de ene, dan staan de kolommen scheef.
Eén gedeelde scroll-container om de hele stapel lost dat structureel op. Binnen die container
krijgen de badgerij en het histogram links een spatie van `STRIP.labelWidth + STRIP.gap` en rechts
van `STRIP.endWidth + STRIP.gap`, zodat hun plotgebied exact samenvalt met de tracks. De
`AXIS.padLeft` van 34 px zit ín de as en geldt voor beide — die hoeft niet gecompenseerd te worden.

**KEUZE VAN DIT PLAN — de stale-melding woont in de validatiestrook, met behoud van haar testanker.**
Spec §7 zegt dat de stale-melding geen eigen blok meer krijgt. Het `data-ops-distribution-stale`-anker
blijft wél bestaan, maar als een `<span>` bínnen de altijd aanwezige strook — dan blijven de
bestaande browserasserties (`toHaveCount(0)` als er niets stale is) geldig én verandert de hoogte
niet.

**KEUZE VAN DIT PLAN — wat "N ploegdagen tekort" telt.** Het getal is het aantal **unieke ISO-dagen**
over alle `DistributionDocResult.shortfalls[].days` samen. Dat is de grootheid die de gebruiker op de
tijdas terugziet; het aantal (taak, dag)-paren zou hetzelfde tekort dubbel tellen zodra twee taken op
dezelfde dag vastlopen. De "eerste drie data" uit §3.5 zijn de eerste drie van die gesorteerde set.

- [ ] **Step 1: `Dialog` leert bovenverankeren**

In `src/components/common/Dialog.tsx`, voeg aan `DialogProps` toe (direct onder `overlayClassName`):

```ts
  /** Verankert het paneel aan de BOVENkant in plaats van verticaal te centreren. Nodig voor
   *  dialogen waarvan de inhoud van hoogte wisselt: bij verticaal centreren verschuift het hele
   *  paneel dan onder de muis vandaan (B1c-plan4, spec §7 "de dialoog flitst niet"). */
  alignTop?: boolean;
```

Voeg `alignTop = false` toe aan de destructurering, en vervang de overlay-className:

```tsx
      className={`fixed inset-0 flex ${alignTop ? 'items-start pt-[4vh]' : 'items-center'} justify-center ${overlayClassName}`}
```

Zo botsen `items-start` en `items-center` nooit in dezelfde class-lijst — dat zou van
CSS-volgorde afhangen in plaats van van deze prop.

- [ ] **Step 2: Verwijder de rangorde-machinerie uit `DistributionDialog.tsx`**

Verwijder, in deze volgorde:

1. In het moduleblok bovenaan: het hele kopje **"RANGORDE MET DE MUIS (taak 10, spec §4 stap 1) —
   POINTER-EVENTS, NIET HTML5-DND."** tot en met de laatste regel ervan
   (`…zet net als de knoppen \`staleReason = 'rank'\` via \`diffReason\` in \`useDistributionProposal\`.`).
   Zet er dit voor in de plaats:

```
// DE RANGORDELIJST IS WEG (eigenaarsbesluit 2026-09-12, spec §2.1). Hij trok in de gebruikstest alle
// aandacht weg van de balken, terwijl de balk zelf de bediening hoort te zijn. De rijvolgorde is
// sindsdien puur de plaatsingsvolgorde van de rekenaar — de spelingsvolgorde die
// `freshDistributionUi` bij het openen in `tune.order` zet — en sturen doe je uitsluitend met de
// handle en de pin. `order` blijft in de tune-state bestaan zodat de kern en het schrijfpad
// ONGEWIJZIGD blijven; er is alleen geen bediening meer die hem verandert. Een tweede
// afleidingsmoment (order herberekenen en terugschrijven) zou via `diffReason('rank')` een
// oneindige herberekening geven — zie het plan bij taak 3.
```

2. De import van `ChevronDown, ChevronUp, GripVertical` (houd `X`):

```tsx
import { X } from 'lucide-react';
```

3. De hele `rankRows`-`useMemo`, de functies `move`, `reorderTo`, `dropTargetAt`,
   `onGripPointerDown`, `onGripPointerMove`, `endDrag`, `onGripPointerUp`, `onGripPointerCancel`, en
   de states `draggedDocId`, `dropTarget`, `rowRefs`, `dragRef`.
4. De helpers `costLabel`, `priceText`, `toolPriceLabel`, `isCostCandidate` en de consts
   `labelsValid`, `labelsPending`, `numberFmt`.
5. De hele `{/* (4) Rangorde */}`-`<section>` in de JSX.
6. De `{/* Tekorten (§4 stap 3) … */}`-`<section>` (`data-ops-distribution-shortfall`) — die inhoud
   verhuist naar de validatiestrook.
7. Het losse `{degraded && …}`-blok en het `{showStale && …}`-blok in de knoppenbalk, plus de const
   `showStale`.
8. `orderBase` blijft staan — hij is nog steeds de bron van de rijvolgorde.

- [ ] **Step 3: Nieuwe afgeleide waarden**

Vervang de `stripView`-`useMemo` (en alles wat eraan hing) door dit blok. Zet het ná
`bookingByDoc` en vóór `docColors`:

```tsx
  // De boeking NA de verdeling per document — de stand die de balken tekenen (spec §4).
  const afterByDoc = useMemo(() => {
    if (!proposal || proposal.blocked) return new Map<string, Record<string, number>>();
    return new Map(Object.entries(proposal.afterLoadByDay));
  }, [proposal]);

  // De GEDEELDE tijdas van balken én histogram. De as loopt door tot voorbij de laatste geboekte
  // dag, zodat een gestippelde rest (toegestaan-maar-niet-benut) er nog binnen past.
  const stripView = useMemo(() => {
    if (!tune || !proposal || proposal.blocked || !poolItem) return null;
    const rankIndex = new Map(orderBase.map((docId, index) => [docId, index]));
    const docs = [...proposal.docs].sort((a, b) =>
      (rankIndex.get(a.docId) ?? orderBase.length) - (rankIndex.get(b.docId) ?? orderBase.length));

    const days = new Set<string>(Object.keys(proposal.fixedLoadByDay));
    for (const doc of docs) {
      for (const iso of Object.keys(bookingByDoc.get(doc.docId) ?? {})) days.add(iso);
      for (const iso of Object.keys(afterByDoc.get(doc.docId) ?? {})) days.add(iso);
    }
    if (days.size === 0) return { axis: null, docs };

    const outlook = docs.reduce(
      (n, doc) => Math.max(n, doc.endShiftWorkdays, tune.ceilings[doc.docId] ?? 0), 0);
    if (outlook > 0) {
      const last = [...days].sort()[days.size - 1];
      // Werkdagen → kalenderdagen (5/7) plus een marge, en hoe dan ook begrensd: de rest mag de
      // as verbreden, niet laten ontsporen.
      const extra = Math.min(90, Math.ceil(outlook * 7 / 5) + 2);
      for (const iso of expandDays(
        formatDate(addCalendarDays(parseDate(last), 1)),
        formatDate(addCalendarDays(parseDate(last), extra)),
      )) days.add(iso);
    }

    return { axis: buildOccupancyAxis([...days], { targetWidth: 560 }), docs };
  }, [tune, proposal, poolItem, orderBase, bookingByDoc, afterByDoc]);

  // Is deze kalenderdag een werkdag in de kalender van dít document? Dat onderscheid bepaalt of een
  // boekingsloze dag binnen een fase een PAUZEDAG is (gearceerd) of gewoon weekend (niets). De
  // kalender komt uit dezelfde `inputs` waarop het voorstel gerekend is — geen tweede bron.
  const workingDayByDoc = useMemo(() => {
    const out = new Map<string, (iso: string) => boolean>();
    for (const doc of inputs) {
      const engine = new CalendarEngine(doc.calendar);
      const cache = new Map<string, boolean>();
      out.set(doc.docId, (iso: string) => {
        const hit = cache.get(iso);
        if (hit !== undefined) return hit;
        const value = engine.isWorkDay(parseDate(iso));
        cache.set(iso, value);
        return value;
      });
    }
    return out;
  }, [inputs]);

  // De eigen speling per document — dezelfde grootheid die de startvolgorde bepaalt, nu als
  // labeltekst én als ankerpunt van de grijze meetlat.
  const slackByDoc = useMemo(() => {
    const out = new Map<string, number | null>();
    if (!tune) return out;
    for (const doc of inputs) {
      const slack = documentFloatOn(doc, tune.companyId, tune.libraryItemId);
      out.set(doc.docId, slack === null ? null : Math.max(0, Math.floor(slack)));
    }
    return out;
  }, [inputs, tune]);

  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }),
    [i18n.language],
  );
  const formatDay = useCallback(
    (iso: string) => dayFmt.format(parseDate(iso)),
    [dayFmt],
  );

  // Het VERSCHIL-prijskaartje (§2.2). De schakelaar-stand bepaalt de zin, niet het getal: uit ⇒
  // "zou N besparen" (een belofte), aan ⇒ "bespaart N" (een constatering).
  const savingsLabel = (): string => {
    if (busy || labelsBusy) return t('resource.distribution.compute.busy');
    if (staleReason !== null || degraded || savings === null) {
      return t('resource.distribution.tool.priceUnknown');
    }
    if (savings.workdays === 0) {
      return tune?.allowSplits
        ? t('resource.distribution.tool.savesNoneOn')
        : t('resource.distribution.tool.savesNoneOff');
    }
    return tune?.allowSplits
      ? t('resource.distribution.tool.savesOn', { count: savings.workdays })
      : t('resource.distribution.tool.savesOff', { count: savings.workdays });
  };

  // De unieke tekortdagen over alle documenten (zie het plan bij taak 4 voor waarom UNIEKE dagen).
  const shortfallDays = useMemo(() => {
    if (!proposal || proposal.blocked) return [] as string[];
    const days = new Set<string>();
    for (const doc of proposal.docs) for (const s of doc.shortfalls) for (const iso of s.days) days.add(iso);
    return [...days].sort();
  }, [proposal]);

  // Alle deelnemers vast ⇒ er valt niets te herverdelen (§6).
  const allPinned = useMemo(() => {
    if (!proposal || proposal.blocked || proposal.docs.length === 0) return false;
    return proposal.docs.every(doc => !doc.participated || doc.cannotMove);
  }, [proposal]);

  // Reset (§3.6): alle plafonds en pins terug, de schakelaar ONGEMOEID.
  const onReset = () => {
    if (!tune) return;
    setUI({ levelingDistribution: { ...tune, pinned: {}, ceilings: {} } });
  };
```

Werk de imports bovenaan bij:

```tsx
import { useCallback, useMemo } from 'react';
```

en voeg toe:

```tsx
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { STRIP } from './stripGeometry';
```

(`useRef`/`useState` mogen weg als niets anders ze nog gebruikt — de typecheck met
`noUnusedLocals` vertelt je dat.)

- [ ] **Step 4: De validatiestrook**

Zet dit blok direct ná `applyGate` (hij leest `applyGate.reason`):

```tsx
  /**
   * De VALIDATIESTROOK (spec §3.5/§7). Altijd gerenderd, altijd één regel hoog — ook wanneer er
   * niets te melden valt: een strook die verschijnt en verdwijnt verschuift alles eronder, en dat
   * is precies het flitsen dat §7 verbiedt. De volgorde is die van dringendheid: een voorstel dat
   * niet meer bij de documenten hoort gaat vóór alles, dan "alles staat vast", dan het tekort, en
   * pas als niets daarvan speelt de groene uitkomst.
   */
  const statusLine = useMemo<{ tone: 'ok' | 'bad' | 'neutral'; text: string; stale: boolean }>(() => {
    if (busy) return { tone: 'neutral', text: t('resource.distribution.compute.busy'), stale: false };
    if (staleReason !== null) {
      return {
        tone: 'neutral',
        text: `${t(`resource.distribution.stale.${staleReason}`, { docs: staleDocs })}`
          + (degraded || staleReason === 'edited' ? ` ${t('resource.distribution.compute.pressRecompute')}` : ''),
        stale: true,
      };
    }
    if (!proposal || proposal.blocked) return { tone: 'neutral', text: '', stale: false };
    if (allPinned) return { tone: 'bad', text: t('resource.distribution.status.allPinned'), stale: false };
    if (proposal.hasShortfall) {
      return {
        tone: 'bad',
        text: t('resource.distribution.status.shortfall', {
          count: shortfallDays.length,
          days: shortfallDays.slice(0, 3).map(formatDay).join(', '),
        }),
        stale: false,
      };
    }
    const worst = proposal.docs.reduce(
      (best, doc) => (doc.endShiftWorkdays > best.endShiftWorkdays ? doc : best),
      proposal.docs[0] ?? { endShiftWorkdays: 0, title: '' },
    );
    return {
      tone: 'ok',
      text: t('resource.distribution.status.resolved', {
        // Hergebruikt de BESTAANDE `strip.endShift`-meervoudfamilie, die al in alle veertien
        // locales met de juiste CLDR-categorieën staat — zo hoeft er voor deze zin geen vijftiende
        // meervoudfamilie bij.
        shift: worst.endShiftWorkdays === 0
          ? t('resource.distribution.strip.endUnchanged')
          : t('resource.distribution.strip.endShift', { count: worst.endShiftWorkdays }),
        doc: worst.title,
      }),
      stale: false,
    };
  }, [busy, staleReason, staleDocs, degraded, proposal, allPinned, shortfallDays, formatDay, t]);
```

- [ ] **Step 5: De nieuwe JSX-body**

Vervang de hele `<Dialog …>`-aanroep-opening door (let op de nieuwe `alignTop`):

```tsx
    <Dialog
      alignTop
      onBackdropClick={close}
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[960px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden"
      panelProps={{
        'data-ops-distribution-dialog': '',
        ...(lastStaleReason ? { 'data-ops-distribution-last-stale-reason': lastStaleReason } : {}),
      }}
    >
```

Vervang de `{/* (3) Gereedschap … */}`-sectie door:

```tsx
            {/* (2) GEREEDSCHAP — de schakelaar met het VERSCHIL-prijskaartje (§2.2/§3.2). Het
                prijsvak heeft een vaste breedte: "Bezig…" mag de schakelaar er niet naast
                wegduwen (§7). */}
            <section className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Switch
                  checked={tune.allowSplits}
                  onChange={toggleSplits}
                  ariaLabel={t('resource.distribution.tool.allowSplits')}
                  title={t('resource.distribution.help.allowSplits')}
                  className="inline-flex items-center shrink-0"
                  data-ops-distribution-allow-splits
                />
                <span className="font-medium" title={t('resource.distribution.help.allowSplits')}>
                  {t('resource.distribution.tool.allowSplits')}
                </span>
                <span
                  className="text-text-secondary shrink-0 truncate"
                  style={{ width: 210 }}
                  title={t('resource.distribution.help.price')}
                  data-ops-distribution-tool-price
                >
                  {savingsLabel()}
                </span>
              </div>
              <span className="text-[10px] text-text-secondary">{t('resource.distribution.tool.allowSplitsHint')}</span>
            </section>
```

Vervang de `{/* (5) Fasestroken … */}`- en `{/* (6) Voor/na-histogram … */}`-secties samen door één
blok:

```tsx
            {/* (3)(4) DE BALKEN EN DE UITKOMST, in ÉÉN horizontale scroll-container zodat ze
                kolom-op-kolom uitgelijnd blijven — ook tijdens het scrollen (spec §3.4). */}
            <div className="overflow-x-auto" dir="ltr" style={{ direction: 'ltr' }}>
              <div className="inline-flex flex-col gap-1 min-w-full" data-ops-distribution-strips>
                {(stripView?.docs ?? []).map(doc => {
                  const recorded = doc.pinnedReason === 'dates-as-recorded';
                  const isPinned = recorded || tune.pinned[doc.docId] === true;
                  const own = bookingByDoc.get(doc.docId) ?? {};
                  // Een gepind document zit ZELF in de vaste last (dat is wat pinnen betekent);
                  // zonder deze aftrek zou zijn boeking twee keer in dezelfde band staan.
                  const fixed = isPinned
                    ? Object.fromEntries(Object.entries(proposal?.fixedLoadByDay ?? {}).map(
                        ([iso, units]) => [iso, Math.max(0, units - (own[iso] ?? 0))]))
                    : (proposal?.fixedLoadByDay ?? {});
                  return (
                    <PhaseStrip
                      key={doc.docId}
                      docId={doc.docId}
                      title={doc.title}
                      axis={stripView?.axis ?? null}
                      beforeLoadByDay={own}
                      afterLoadByDay={afterByDoc.get(doc.docId) ?? {}}
                      fixedLoadByDay={fixed}
                      isWorkingDay={workingDayByDoc.get(doc.docId) ?? (() => true)}
                      color={docColors.get(doc.docId) ?? 'var(--theme-accent)'}
                      slackWorkdays={slackByDoc.get(doc.docId) ?? null}
                      endShiftWorkdays={doc.endShiftWorkdays}
                      ceiling={tune.ceilings[doc.docId] ?? null}
                      pinned={isPinned}
                      recorded={recorded}
                      cannotMove={doc.cannotMove}
                      liveCommit={!degraded}
                      busy={busy}
                      formatDay={formatDay}
                      onTogglePin={() => setPinned(doc.docId, tune.pinned[doc.docId] !== true)}
                      onCeilingChange={next => setCeiling(doc.docId, next)}
                    />
                  );
                })}

                {/* De legenda-regel (§4), ingesprongen tot waar de tracks beginnen. */}
                <div
                  className="text-[10px] text-text-secondary"
                  style={{ marginLeft: STRIP.labelWidth + STRIP.gap }}
                  data-ops-distribution-legend
                >
                  {t('resource.distribution.strip.legend')}
                </div>

                {/* De einddatum-badges per project, boven het histogram (§3.4). */}
                <div
                  className="flex flex-wrap gap-x-3 gap-y-1 mt-1"
                  style={{ marginLeft: STRIP.labelWidth + STRIP.gap, marginRight: STRIP.endWidth + STRIP.gap }}
                  data-ops-distribution-end-badges
                >
                  {(stripView?.docs ?? []).map(doc => (
                    <span key={doc.docId} className="inline-flex items-center gap-1.5 min-w-0" data-ops-doc-id={doc.docId}>
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ background: docColors.get(doc.docId) }}
                        aria-hidden
                      />
                      <span className="text-[10px] text-text-secondary truncate">
                        {`${doc.title}: ${doc.projectEndAfter ? formatDay(doc.projectEndAfter) : '—'}`}
                      </span>
                    </span>
                  ))}
                </div>

                {/* Het histogram Nu/Na op DEZELFDE as-instantie, met dezelfde marges als de tracks —
                    daardoor staan de kolommen per constructie onder de dagblokjes. */}
                <section
                  className="rounded-[8px] border border-border px-2 py-3 mt-1"
                  style={{ marginLeft: STRIP.labelWidth + STRIP.gap, marginRight: STRIP.endWidth + STRIP.gap }}
                  title={t('resource.distribution.help.chart')}
                  data-ops-distribution-histogram
                >
                  {poolItem ? (
                    <BeforeAfterChart
                      poolItem={poolItem}
                      axis={stripView?.axis ?? null}
                      docs={(stripView?.docs ?? []).map(doc => ({ docId: doc.docId, title: doc.title }))}
                      docColors={docColors}
                      bookingByDay={proposal?.bookingByDay ?? {}}
                      afterLoadByDay={proposal?.afterLoadByDay ?? {}}
                      afterIncomplete={proposal?.afterIncomplete ?? false}
                      shortfallDocs={shortfallDocs}
                    />
                  ) : (
                    <span className="text-text-secondary">
                      {t('resource.distribution.preview.before')} / {t('resource.distribution.preview.after')} / {t('resource.distribution.preview.capacity')}
                    </span>
                  )}
                </section>
              </div>
            </div>
```

- [ ] **Step 6: De validatiestrook + de knoppenbalk**

Vervang, in het onderste blok (`<div className="border-t border-border …">`), alles tussen
`<>` en `</>` van de niet-kiezer-tak door:

```tsx
        {/* (5) VALIDATIESTROOK — `role="status"`, ALTIJD gerenderd, VASTE hoogte (§3.5/§7). Leeg =
            onzichtbare tekst, geen weggehaald blok: alleen zó verschuift er nooit iets. */}
        <div
          className="flex items-center gap-2 px-2.5 rounded-[8px] border"
          style={{
            height: 30,
            background: statusLine.tone === 'ok'
              ? 'color-mix(in srgb, var(--success) 10%, transparent)'
              : statusLine.tone === 'bad'
                ? 'color-mix(in srgb, var(--error) 10%, transparent)'
                : 'color-mix(in srgb, var(--theme-text-dim) 10%, transparent)',
            borderColor: statusLine.tone === 'ok'
              ? 'var(--success)'
              : statusLine.tone === 'bad' ? 'var(--error)' : 'var(--theme-text-dim)',
            color: statusLine.tone === 'ok'
              ? 'var(--success)'
              : statusLine.tone === 'bad' ? 'var(--error)' : 'var(--theme-text-secondary)',
          }}
          role="status"
          aria-live="polite"
          data-ops-distribution-status
        >
          {statusLine.stale ? (
            <span
              className="flex-1 min-w-0 truncate"
              data-ops-distribution-stale
              data-ops-distribution-stale-reason={staleReason ?? ''}
            >
              {statusLine.text}
            </span>
          ) : (
            <span className="flex-1 min-w-0 truncate">{statusLine.text}</span>
          )}
          <span
            className="text-text-secondary shrink-0 truncate"
            style={{ maxWidth: 320 }}
            data-ops-distribution-apply-reason
          >
            {applyGate.reason}
          </span>
        </div>

        {/* De terugweg na Toepassen (§3.6, bestaand gedrag). Permanent zolang het record geldig is:
            het meldingenkanaal kent geen actieknoppen en ruimt een `info` na 5 s op. */}
        {applied && (
          <div
            className="px-2.5 py-1.5 rounded-[8px] border flex items-center gap-2"
            style={{
              background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
              borderColor: 'var(--accent)',
            }}
            role="status"
            data-ops-distribution-applied
          >
            <span className="flex-1 min-w-0">
              {t('resource.distribution.applied', { count: applied.docs.length })}
            </span>
            <button
              type="button"
              className="px-2 py-1 rounded-[8px] border border-border bg-surface hover:bg-surface-hover shrink-0"
              onClick={onUndoAll}
            >
              {t('resource.distribution.undoAll')}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-[8px] border border-border hover:bg-surface-hover"
            data-ops-distribution-pick-another
            title={t('resource.distribution.help.pickAnother')}
            onClick={() => setUI({ levelingDistribution: null })}
          >
            {applied
              ? t('resource.distribution.pickAnotherApplied')
              : t('resource.distribution.pickAnother')}
          </button>
          {/* Reset (§3.6): alle plafonds en pins terug naar neutraal, de schakelaar ONGEMOEID —
              die is een gereedschapskeuze, geen per-project-bijstelling. */}
          <button
            type="button"
            className="px-3 py-1.5 rounded-[8px] border border-border hover:bg-surface-hover"
            data-ops-distribution-reset
            title={t('resource.distribution.help.reset')}
            onClick={onReset}
          >
            {t('resource.distribution.reset')}
          </button>
          <span className="flex-1" />
          <button
            type="button"
            className="px-3 py-1.5 rounded-[8px] border border-border hover:bg-surface-hover disabled:opacity-40"
            onClick={recompute}
            disabled={busy}
            title={t('resource.distribution.help.recompute')}
          >
            {proposal === null
              ? t('resource.distribution.compute.auto')
              : t('resource.distribution.compute.recalculate')}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-[8px] bg-accent text-white disabled:opacity-40"
            disabled={!applyGate.ok}
            title={applyGate.reason || t('resource.distribution.help.apply')}
            onClick={onApply}
          >
            {t('resource.distribution.apply')}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-[8px] border border-border hover:bg-surface-hover"
            title={t('resource.distribution.help.discard')}
            onClick={close}
          >
            {t('resource.distribution.discard')}
          </button>
        </div>
```

De degradatiemelding blijft bestaan (§5 "de degradatiemelding blijft"), maar krijgt een
**gereserveerde** plek: zet direct boven de validatiestrook

```tsx
        <div className="text-[10px] text-text-secondary" style={{ minHeight: 14 }} data-ops-distribution-degraded-slot>
          {degraded ? (
            <span data-ops-distribution-degraded>{t('resource.distribution.compute.degraded')}</span>
          ) : null}
        </div>
```

- [ ] **Step 7: `BeforeAfterChart` gebruikt één kleurtoewijzing**

In `BeforeAfterChart.tsx`: verwijder `import { DOC_PALETTE } from '@/utils/documents';` en vervang

```tsx
              fill={docColors.get(b.docId) ?? DOC_PALETTE[0]}
```

door

```tsx
              // Eén kleurtoewijzing voor de hele dialoog (spec §8): de map komt van
              // `assignDocColors` in `DistributionDialog` en dekt per constructie élk document dat
              // hier een staaf krijgt. Een eigen terugval zou een tweede kleurbron zijn en precies
              // de mismatch tussen balk en histogram kunnen terugbrengen die B9 opleverde.
              fill={docColors.get(b.docId)}
```

- [ ] **Step 8: Typecheck + lint**

```bash
export PATH="/home/nozzit/.nvm/versions/node/v22.23.2/bin:$PATH"
npm run typecheck && npm run lint; echo "exit: $?"
```

Verwacht: **exit 0**. Krijg je `noUnusedLocals`-fouten, dan staat er nog dode rangorde-code — dat is
de compiler die stap 2 voor je afmaakt. De i18n-sleutels bestaan nog niet; dat geeft geen
typefout (i18next-sleutels zijn strings) maar wél zichtbare Engelse fallback in de app tot taak 5.

- [ ] **Step 9: Commit**

```bash
git add src/components/common/Dialog.tsx \
        src/components/dialogs/DistributionDialog/DistributionDialog.tsx \
        src/components/dialogs/DistributionDialog/BeforeAfterChart.tsx
git commit -m "$(cat <<'EOF'
feat(b1c): verdeeldialoog zonder rangordelijst, met validatiestrook en Reset

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: i18n — veertien locales, en de dode sleutels eruit

**Files:**
- Modify: `src/i18n/locales/{nl,en,fr,de,es,zh,it,pt,pl,tr,ar,ja,ko,fa}/common.json`

### Wat je moet weten over de meervoudsregels van dit project

Een ontbrekende meervoudsvorm valt in i18next **niet** terug op `_other` maar op het **Engels** — een
gat is dus zichtbare taalvervuiling, geen cosmetiek. `npm run verify:i18n` eist per locale precies de
CLDR-categorieën van die taal:

| locale | categorieën voor een `{{count}}`-familie |
|---|---|
| `nl`, `en`, `de`, `tr`, `fa` | `_one`, `_other` |
| `fr`, `es`, `it`, `pt` | `_one`, `_many`, `_other` — en `_many` is in dit project gelijk aan `_other` (zie CLAUDE.md: `{{count}}` staat hier altijd in cijfers) |
| `pl` | `_one`, `_few`, `_many`, `_other` |
| `ar` | `_zero`, `_one`, `_two`, `_few`, `_many`, `_other` |
| `zh`, `ja`, `ko` | alleen `_other` |

Er komen **drie** meervoudsfamilies bij: `tool.savesOff`, `tool.savesOn` en `status.shortfall`.

**KEUZE VAN DIT PLAN — `status.resolved` en `strip.used` krijgen géén eigen meervoudsfamilie.**
`status.resolved` zet het getal niet zelf neer maar krijgt een al vertaalde `{{shift}}`-zin binnen,
opgebouwd uit de **bestaande** `strip.endShift`-familie (die in alle veertien locales al met de juiste
categorieën staat). `strip.used` gebruikt bewust `{{used}}` in plaats van `{{count}}`, zodat i18next
er geen meervoudsfamilie van maakt voor een getal dat naast een zelfstandig naamwoord staat dat niet
verbuigt ("benut 2"). Zo blijven het er drie in plaats van vijf, zonder dat er ergens een verkeerde
vorm op het scherm komt. `status.shortfall` is wél een familie: daar staat "ploegdag(en)" in de zin,
en spec §8 noemt hem niet expliciet maar §3.5 schrijft de tekst met een telwoord voor.

- [ ] **Step 1: De Nederlandse bron**

In `src/i18n/locales/nl/common.json`, onder `resource.distribution`:

**Vervang** `"intro"` door:

```json
"intro": "Trek het einde van een balk naar rechts om dat project te laten uitlopen; zet een project vast als het niet mag bewegen. Toepassen schrijft de verschuivingen in alle betrokken projecten.",
```

**Verwijder** het hele `"rank"`-object en uit `"tool"` de sleutels `price_one`, `price_other`,
`priceNone`, `priceOff`, `priceOn`, `priceSame` (**`priceUnknown` blijft**). Verwijder uit `"help"`
de sleutels `dragHandle`, `rank`, `rankCost`. Verwijder uit `"strip"` de sleutels `pin`, `pinned`,
`fixedLoad`, `ceiling`, `requestedVsAchievable`.

**Voeg toe** aan `"tool"`:

```json
"savesOff_one": "zou {{count}} werkdag besparen",
"savesOff_other": "zou {{count}} werkdagen besparen",
"savesOn_one": "bespaart {{count}} werkdag",
"savesOn_other": "bespaart {{count}} werkdagen",
"savesNoneOff": "zou niets besparen",
"savesNoneOn": "bespaart niets"
```

**Voeg toe** aan `"strip"`:

```json
"legend": "Volle blokjes = werkdagen · gearceerd = pauzedag · meetlat: grijs = speling, rood = einddatum-verschuiving · gestippeld = toegestaan maar niet benut",
"slack": "speling {{days}} dagen",
"pinButton": "vastzetten",
"unpinButton": "vast — losmaken",
"maxDate": "max {{date}}",
"used": "benut {{used}}"
```

**Voeg toe** aan `"help"`:

```json
"reset": "Zet alle plafonds en vastzettingen terug op neutraal. De schakelaar \"Onderbrekingen toestaan\" blijft staan."
```

**Voeg toe** als nieuw object onder `resource.distribution`, plus één losse sleutel:

```json
"status": {
  "resolved": "Conflict opgelost — grootste einddatum-verschuiving: {{shift}} ({{doc}})",
  "shortfall_one": "Nog {{count}} ploegdag tekort op {{days}}…",
  "shortfall_other": "Nog {{count}} ploegdagen tekort op {{days}}…",
  "allPinned": "Alle projecten staan vast — er is niets te herverdelen. Maak er één los."
},
"reset": "Reset"
```

- [ ] **Step 2: Engels**

Dezelfde verwijderingen; toevoegingen:

```json
"savesOff_one": "would save {{count}} workday",
"savesOff_other": "would save {{count}} workdays",
"savesOn_one": "saves {{count}} workday",
"savesOn_other": "saves {{count}} workdays",
"savesNoneOff": "would save nothing",
"savesNoneOn": "saves nothing"
```
```json
"legend": "Solid blocks = workdays · hatched = pause day · gauge: grey = slack, red = end-date shift · dotted = allowed but not used",
"slack": "slack {{days}} days",
"pinButton": "pin",
"unpinButton": "pinned — unpin",
"maxDate": "max {{date}}",
"used": "used {{used}}"
```
```json
"reset": "Puts all ceilings and pins back to neutral. The \"Allow interruptions\" switch stays as it is."
```
```json
"status": {
  "resolved": "Conflict resolved — largest end-date shift: {{shift}} ({{doc}})",
  "shortfall_one": "Still {{count}} crew day short on {{days}}…",
  "shortfall_other": "Still {{count}} crew days short on {{days}}…",
  "allPinned": "Every project is pinned — there is nothing to redistribute. Unpin one."
},
"reset": "Reset",
"intro": "Drag the end of a bar to the right to let that project run on; pin a project that must not move. Apply writes the shifts into every project involved."
```

- [ ] **Step 3: De overige twaalf locales**

Zelfde verwijderingen, en per locale exact dit. De sleutelnamen zijn overal identiek; alleen de
meervoudssuffixen verschillen volgens de tabel bovenaan deze taak.

**`de`** (`_one`/`_other`)
```json
"intro": "Ziehen Sie das Ende eines Balkens nach rechts, damit dieses Projekt überlaufen darf; fixieren Sie ein Projekt, das sich nicht bewegen darf. Übernehmen schreibt die Verschiebungen in alle beteiligten Projekte.",
"reset": "Zurücksetzen",
"tool": { "savesOff_one": "würde {{count}} Arbeitstag sparen", "savesOff_other": "würde {{count}} Arbeitstage sparen", "savesOn_one": "spart {{count}} Arbeitstag", "savesOn_other": "spart {{count}} Arbeitstage", "savesNoneOff": "würde nichts sparen", "savesNoneOn": "spart nichts" },
"strip": { "legend": "Volle Blöcke = Arbeitstage · schraffiert = Pausentag · Messlatte: grau = Puffer, rot = Endterminverschiebung · gepunktet = erlaubt, aber nicht genutzt", "slack": "Puffer {{days}} Tage", "pinButton": "fixieren", "unpinButton": "fixiert — lösen", "maxDate": "max. {{date}}", "used": "genutzt {{used}}" },
"help": { "reset": "Setzt alle Obergrenzen und Fixierungen auf neutral zurück. Der Schalter „Unterbrechungen zulassen“ bleibt unverändert." },
"status": { "resolved": "Konflikt gelöst — größte Endterminverschiebung: {{shift}} ({{doc}})", "shortfall_one": "Es fehlt noch {{count}} Schichttag am {{days}}…", "shortfall_other": "Es fehlen noch {{count}} Schichttage am {{days}}…", "allPinned": "Alle Projekte sind fixiert — es gibt nichts umzuverteilen. Lösen Sie eines." }
```

**`fr`** (`_one`/`_many`/`_other`)
```json
"intro": "Faites glisser la fin d'une barre vers la droite pour laisser ce projet déborder ; épinglez un projet qui ne doit pas bouger. Appliquer écrit les décalages dans tous les projets concernés.",
"reset": "Réinitialiser",
"tool": { "savesOff_one": "économiserait {{count}} jour ouvré", "savesOff_many": "économiserait {{count}} jours ouvrés", "savesOff_other": "économiserait {{count}} jours ouvrés", "savesOn_one": "économise {{count}} jour ouvré", "savesOn_many": "économise {{count}} jours ouvrés", "savesOn_other": "économise {{count}} jours ouvrés", "savesNoneOff": "n'économiserait rien", "savesNoneOn": "n'économise rien" },
"strip": { "legend": "Blocs pleins = jours ouvrés · hachuré = jour de pause · règle : gris = marge, rouge = décalage de la date de fin · pointillé = autorisé mais non utilisé", "slack": "marge {{days}} jours", "pinButton": "épingler", "unpinButton": "épinglé — détacher", "maxDate": "max {{date}}", "used": "utilisé {{used}}" },
"help": { "reset": "Remet tous les plafonds et épinglages à l'état neutre. L'interrupteur « Autoriser les interruptions » reste tel quel." },
"status": { "resolved": "Conflit résolu — plus grand décalage de fin : {{shift}} ({{doc}})", "shortfall_one": "Il manque encore {{count}} jour-équipe le {{days}}…", "shortfall_many": "Il manque encore {{count}} jours-équipe les {{days}}…", "shortfall_other": "Il manque encore {{count}} jours-équipe les {{days}}…", "allPinned": "Tous les projets sont épinglés — il n'y a rien à redistribuer. Détachez-en un." }
```

**`es`** (`_one`/`_many`/`_other`)
```json
"intro": "Arrastra el final de una barra hacia la derecha para dejar que ese proyecto se prolongue; fija un proyecto que no deba moverse. Aplicar escribe los desplazamientos en todos los proyectos implicados.",
"reset": "Restablecer",
"tool": { "savesOff_one": "ahorraría {{count}} día laborable", "savesOff_many": "ahorraría {{count}} días laborables", "savesOff_other": "ahorraría {{count}} días laborables", "savesOn_one": "ahorra {{count}} día laborable", "savesOn_many": "ahorra {{count}} días laborables", "savesOn_other": "ahorra {{count}} días laborables", "savesNoneOff": "no ahorraría nada", "savesNoneOn": "no ahorra nada" },
"strip": { "legend": "Bloques sólidos = días laborables · rayado = día de pausa · regla: gris = holgura, rojo = desplazamiento de la fecha de fin · punteado = permitido pero no usado", "slack": "holgura {{days}} días", "pinButton": "fijar", "unpinButton": "fijado — soltar", "maxDate": "máx. {{date}}", "used": "usado {{used}}" },
"help": { "reset": "Devuelve todos los topes y fijaciones al estado neutro. El interruptor «Permitir interrupciones» no cambia." },
"status": { "resolved": "Conflicto resuelto — mayor desplazamiento de fin: {{shift}} ({{doc}})", "shortfall_one": "Todavía falta {{count}} día-cuadrilla el {{days}}…", "shortfall_many": "Todavía faltan {{count}} días-cuadrilla el {{days}}…", "shortfall_other": "Todavía faltan {{count}} días-cuadrilla el {{days}}…", "allPinned": "Todos los proyectos están fijados: no hay nada que redistribuir. Suelta uno." }
```

**`it`** (`_one`/`_many`/`_other`)
```json
"intro": "Trascina la fine di una barra verso destra per lasciare che quel progetto sfori; blocca un progetto che non deve muoversi. Applica scrive gli slittamenti in tutti i progetti coinvolti.",
"reset": "Reimposta",
"tool": { "savesOff_one": "risparmierebbe {{count}} giorno lavorativo", "savesOff_many": "risparmierebbe {{count}} giorni lavorativi", "savesOff_other": "risparmierebbe {{count}} giorni lavorativi", "savesOn_one": "risparmia {{count}} giorno lavorativo", "savesOn_many": "risparmia {{count}} giorni lavorativi", "savesOn_other": "risparmia {{count}} giorni lavorativi", "savesNoneOff": "non risparmierebbe nulla", "savesNoneOn": "non risparmia nulla" },
"strip": { "legend": "Blocchi pieni = giorni lavorativi · tratteggio = giorno di pausa · righello: grigio = scorrimento, rosso = slittamento della data di fine · punteggiato = consentito ma non usato", "slack": "scorrimento {{days}} giorni", "pinButton": "blocca", "unpinButton": "bloccato — sblocca", "maxDate": "max {{date}}", "used": "usato {{used}}" },
"help": { "reset": "Riporta tutti i tetti e i blocchi allo stato neutro. L'interruttore «Consenti interruzioni» resta invariato." },
"status": { "resolved": "Conflitto risolto — slittamento di fine maggiore: {{shift}} ({{doc}})", "shortfall_one": "Manca ancora {{count}} giorno-squadra il {{days}}…", "shortfall_many": "Mancano ancora {{count}} giorni-squadra il {{days}}…", "shortfall_other": "Mancano ancora {{count}} giorni-squadra il {{days}}…", "allPinned": "Tutti i progetti sono bloccati: non c'è nulla da ridistribuire. Sbloccane uno." }
```

**`pt`** (`_one`/`_many`/`_other`)
```json
"intro": "Arraste o fim de uma barra para a direita para deixar esse projeto estender-se; fixe um projeto que não pode mover-se. Aplicar escreve os deslocamentos em todos os projetos envolvidos.",
"reset": "Repor",
"tool": { "savesOff_one": "pouparia {{count}} dia útil", "savesOff_many": "pouparia {{count}} dias úteis", "savesOff_other": "pouparia {{count}} dias úteis", "savesOn_one": "poupa {{count}} dia útil", "savesOn_many": "poupa {{count}} dias úteis", "savesOn_other": "poupa {{count}} dias úteis", "savesNoneOff": "não pouparia nada", "savesNoneOn": "não poupa nada" },
"strip": { "legend": "Blocos cheios = dias úteis · tracejado = dia de pausa · régua: cinzento = folga, vermelho = deslocamento da data de fim · pontilhado = permitido mas não usado", "slack": "folga {{days}} dias", "pinButton": "fixar", "unpinButton": "fixado — soltar", "maxDate": "máx. {{date}}", "used": "usado {{used}}" },
"help": { "reset": "Repõe todos os limites e fixações no estado neutro. O interruptor «Permitir interrupções» fica como está." },
"status": { "resolved": "Conflito resolvido — maior deslocamento de fim: {{shift}} ({{doc}})", "shortfall_one": "Ainda falta {{count}} dia-equipa em {{days}}…", "shortfall_many": "Ainda faltam {{count}} dias-equipa em {{days}}…", "shortfall_other": "Ainda faltam {{count}} dias-equipa em {{days}}…", "allPinned": "Todos os projetos estão fixados — não há nada para redistribuir. Solte um." }
```

**`pl`** (`_one`/`_few`/`_many`/`_other`)
```json
"intro": "Przeciągnij koniec paska w prawo, aby ten projekt mógł się przedłużyć; przypnij projekt, który nie może się przesuwać. Zastosuj zapisuje przesunięcia we wszystkich powiązanych projektach.",
"reset": "Resetuj",
"tool": { "savesOff_one": "zaoszczędziłoby {{count}} dzień roboczy", "savesOff_few": "zaoszczędziłoby {{count}} dni robocze", "savesOff_many": "zaoszczędziłoby {{count}} dni roboczych", "savesOff_other": "zaoszczędziłoby {{count}} dnia roboczego", "savesOn_one": "oszczędza {{count}} dzień roboczy", "savesOn_few": "oszczędza {{count}} dni robocze", "savesOn_many": "oszczędza {{count}} dni roboczych", "savesOn_other": "oszczędza {{count}} dnia roboczego", "savesNoneOff": "nic by nie zaoszczędziło", "savesNoneOn": "nic nie oszczędza" },
"strip": { "legend": "Pełne bloki = dni robocze · kreskowanie = dzień przerwy · miarka: szary = zapas, czerwony = przesunięcie daty zakończenia · kropkowany = dozwolone, ale niewykorzystane", "slack": "zapas {{days}} dni", "pinButton": "przypnij", "unpinButton": "przypięty — odepnij", "maxDate": "maks. {{date}}", "used": "wykorzystano {{used}}" },
"help": { "reset": "Przywraca wszystkie limity i przypięcia do stanu neutralnego. Przełącznik „Zezwalaj na przerwy” pozostaje bez zmian." },
"status": { "resolved": "Konflikt rozwiązany — największe przesunięcie zakończenia: {{shift}} ({{doc}})", "shortfall_one": "Brakuje jeszcze {{count}} dnia brygady w {{days}}…", "shortfall_few": "Brakuje jeszcze {{count}} dni brygady w {{days}}…", "shortfall_many": "Brakuje jeszcze {{count}} dni brygady w {{days}}…", "shortfall_other": "Brakuje jeszcze {{count}} dnia brygady w {{days}}…", "allPinned": "Wszystkie projekty są przypięte — nie ma czego rozdzielać. Odepnij jeden." }
```

**`tr`** (`_one`/`_other`)
```json
"intro": "Bir projenin taşmasına izin vermek için çubuğun ucunu sağa sürükleyin; hareket etmemesi gereken projeyi sabitleyin. Uygula, kaymaları ilgili tüm projelere yazar.",
"reset": "Sıfırla",
"tool": { "savesOff_one": "{{count}} iş günü kazandırırdı", "savesOff_other": "{{count}} iş günü kazandırırdı", "savesOn_one": "{{count}} iş günü kazandırıyor", "savesOn_other": "{{count}} iş günü kazandırıyor", "savesNoneOff": "hiçbir şey kazandırmazdı", "savesNoneOn": "hiçbir şey kazandırmıyor" },
"strip": { "legend": "Dolu bloklar = iş günleri · taralı = mola günü · cetvel: gri = bolluk, kırmızı = bitiş tarihi kayması · noktalı = izin verildi ama kullanılmadı", "slack": "bolluk {{days}} gün", "pinButton": "sabitle", "unpinButton": "sabit — çöz", "maxDate": "en geç {{date}}", "used": "kullanılan {{used}}" },
"help": { "reset": "Tüm tavanları ve sabitlemeleri nötr duruma döndürür. \"Kesintilere izin ver\" anahtarı olduğu gibi kalır." },
"status": { "resolved": "Çakışma çözüldü — en büyük bitiş kayması: {{shift}} ({{doc}})", "shortfall_one": "{{days}} tarihinde hâlâ {{count}} ekip günü eksik…", "shortfall_other": "{{days}} tarihinde hâlâ {{count}} ekip günü eksik…", "allPinned": "Tüm projeler sabit — yeniden dağıtılacak bir şey yok. Birini çözün." }
```

**`ar`** (`_zero`/`_one`/`_two`/`_few`/`_many`/`_other`, RTL)
```json
"intro": "اسحب نهاية الشريط إلى اليمين للسماح لهذا المشروع بالتمدد؛ ثبّت المشروع الذي لا يجوز تحريكه. يكتب «تطبيق» الإزاحات في جميع المشاريع المعنية.",
"reset": "إعادة ضبط",
"tool": { "savesOff_zero": "لن يوفّر شيئًا", "savesOff_one": "سيوفّر يوم عمل واحدًا", "savesOff_two": "سيوفّر يومَي عمل", "savesOff_few": "سيوفّر {{count}} أيام عمل", "savesOff_many": "سيوفّر {{count}} يوم عمل", "savesOff_other": "سيوفّر {{count}} يوم عمل", "savesOn_zero": "لا يوفّر شيئًا", "savesOn_one": "يوفّر يوم عمل واحدًا", "savesOn_two": "يوفّر يومَي عمل", "savesOn_few": "يوفّر {{count}} أيام عمل", "savesOn_many": "يوفّر {{count}} يوم عمل", "savesOn_other": "يوفّر {{count}} يوم عمل", "savesNoneOff": "لن يوفّر شيئًا", "savesNoneOn": "لا يوفّر شيئًا" },
"strip": { "legend": "المربعات الممتلئة = أيام العمل · المظلّلة = يوم توقّف · المسطرة: رمادي = المرونة، أحمر = إزاحة تاريخ الانتهاء · المنقّطة = مسموح لكنه غير مستخدم", "slack": "مرونة {{days}} يوم", "pinButton": "تثبيت", "unpinButton": "مثبّت — فكّ التثبيت", "maxDate": "بحد أقصى {{date}}", "used": "المستخدم {{used}}" },
"help": { "reset": "يعيد جميع الحدود والتثبيتات إلى الوضع المحايد. يبقى مفتاح «السماح بالانقطاعات» كما هو." },
"status": { "resolved": "تم حل التعارض — أكبر إزاحة للانتهاء: {{shift}} ({{doc}})", "shortfall_zero": "لا يوجد نقص", "shortfall_one": "ما زال ينقص يوم فريق واحد في {{days}}…", "shortfall_two": "ما زال ينقص يوما فريق في {{days}}…", "shortfall_few": "ما زال ينقص {{count}} أيام فريق في {{days}}…", "shortfall_many": "ما زال ينقص {{count}} يوم فريق في {{days}}…", "shortfall_other": "ما زال ينقص {{count}} يوم فريق في {{days}}…", "allPinned": "جميع المشاريع مثبّتة — لا يوجد ما يُعاد توزيعه. فُكّ تثبيت أحدها." }
```

**`fa`** (`_one`/`_other`, RTL)
```json
"intro": "انتهای نوار را به راست بکشید تا آن پروژه تمدید شود؛ پروژه‌ای را که نباید جابه‌جا شود سنجاق کنید. «اعمال» جابه‌جایی‌ها را در همهٔ پروژه‌های مرتبط می‌نویسد.",
"reset": "بازنشانی",
"tool": { "savesOff_one": "{{count}} روز کاری صرفه‌جویی می‌کرد", "savesOff_other": "{{count}} روز کاری صرفه‌جویی می‌کرد", "savesOn_one": "{{count}} روز کاری صرفه‌جویی می‌کند", "savesOn_other": "{{count}} روز کاری صرفه‌جویی می‌کند", "savesNoneOff": "چیزی صرفه‌جویی نمی‌کرد", "savesNoneOn": "چیزی صرفه‌جویی نمی‌کند" },
"strip": { "legend": "بلوک‌های توپر = روزهای کاری · هاشور = روز توقف · خط‌کش: خاکستری = شناوری، قرمز = جابه‌جایی تاریخ پایان · نقطه‌چین = مجاز اما استفاده‌نشده", "slack": "شناوری {{days}} روز", "pinButton": "سنجاق", "unpinButton": "سنجاق‌شده — باز کردن", "maxDate": "حداکثر {{date}}", "used": "استفاده‌شده {{used}}" },
"help": { "reset": "همهٔ سقف‌ها و سنجاق‌ها را به حالت خنثی برمی‌گرداند. کلید «اجازهٔ وقفه» بدون تغییر می‌ماند." },
"status": { "resolved": "تعارض حل شد — بیشترین جابه‌جایی پایان: {{shift}} ({{doc}})", "shortfall_one": "هنوز {{count}} روزِ اکیپ در {{days}} کم است…", "shortfall_other": "هنوز {{count}} روزِ اکیپ در {{days}} کم است…", "allPinned": "همهٔ پروژه‌ها سنجاق شده‌اند — چیزی برای توزیع مجدد نیست. یکی را باز کنید." }
```

**`zh`** (alleen `_other`)
```json
"intro": "向右拖动条形的末端，让该项目延期；将不能移动的项目固定。应用会把偏移写入所有相关项目。",
"reset": "重置",
"tool": { "savesOff_other": "可节省 {{count}} 个工作日", "savesOn_other": "节省 {{count}} 个工作日", "savesNoneOff": "不会节省时间", "savesNoneOn": "没有节省" },
"strip": { "legend": "实心方块＝工作日 · 斜纹＝暂停日 · 标尺：灰色＝浮时，红色＝完工日期偏移 · 虚线＝已允许但未使用", "slack": "浮时 {{days}} 天", "pinButton": "固定", "unpinButton": "已固定 — 解除", "maxDate": "最迟 {{date}}", "used": "已用 {{used}}" },
"help": { "reset": "将所有上限和固定恢复为中立状态。「允许中断」开关保持不变。" },
"status": { "resolved": "冲突已解决 — 最大完工日期偏移：{{shift}}（{{doc}}）", "shortfall_other": "{{days}} 仍缺 {{count}} 个班组日…", "allPinned": "所有项目都已固定 — 没有可重新分配的内容。请解除其中一个。" }
```

**`ja`** (alleen `_other`)
```json
"intro": "バーの末尾を右へドラッグすると、そのプロジェクトを延長できます。動かしたくないプロジェクトは固定してください。「適用」は関連するすべてのプロジェクトにずれを書き込みます。",
"reset": "リセット",
"tool": { "savesOff_other": "{{count}} 稼働日を節約できます", "savesOn_other": "{{count}} 稼働日を節約しています", "savesNoneOff": "何も節約できません", "savesNoneOn": "節約はありません" },
"strip": { "legend": "塗りつぶしのブロック＝稼働日 · 斜線＝休止日 · 目盛り：グレー＝余裕、赤＝終了日のずれ · 点線＝許可したが未使用", "slack": "余裕 {{days}} 日", "pinButton": "固定", "unpinButton": "固定中 — 解除", "maxDate": "最大 {{date}}", "used": "使用 {{used}}" },
"help": { "reset": "すべての上限と固定を中立に戻します。「中断を許可」スイッチはそのままです。" },
"status": { "resolved": "競合を解消しました — 最大の終了日のずれ：{{shift}}（{{doc}}）", "shortfall_other": "{{days}} に {{count}} 班日ぶん不足しています…", "allPinned": "すべてのプロジェクトが固定されています。再配分するものがありません。1 つ解除してください。" }
```

**`ko`** (alleen `_other`)
```json
"intro": "막대 끝을 오른쪽으로 끌면 해당 프로젝트를 연장할 수 있습니다. 움직이면 안 되는 프로젝트는 고정하세요. [적용]은 관련된 모든 프로젝트에 이동을 기록합니다.",
"reset": "초기화",
"tool": { "savesOff_other": "작업일 {{count}}일을 절약할 수 있습니다", "savesOn_other": "작업일 {{count}}일을 절약합니다", "savesNoneOff": "절약할 수 있는 시간이 없습니다", "savesNoneOn": "절약되지 않습니다" },
"strip": { "legend": "채워진 블록 = 작업일 · 빗금 = 휴지일 · 눈금: 회색 = 여유, 빨강 = 종료일 이동 · 점선 = 허용했지만 사용하지 않음", "slack": "여유 {{days}}일", "pinButton": "고정", "unpinButton": "고정됨 — 해제", "maxDate": "최대 {{date}}", "used": "사용 {{used}}" },
"help": { "reset": "모든 상한과 고정을 중립 상태로 되돌립니다. '중단 허용' 스위치는 그대로 유지됩니다." },
"status": { "resolved": "충돌 해결 — 최대 종료일 이동: {{shift}} ({{doc}})", "shortfall_other": "{{days}}에 작업조 {{count}}일이 부족합니다…", "allPinned": "모든 프로젝트가 고정되어 재분배할 것이 없습니다. 하나를 해제하세요." }
```

De blokken hierboven zijn **fragmenten**: voeg de sleutels toe aan de al bestaande objecten
`tool`, `strip` en `help` van die locale, en zet `status`, `intro` en `reset` rechtstreeks onder
`resource.distribution`. Overschrijf de bestaande objecten niet in hun geheel.

- [ ] **Step 4: Controleer dat er geen dode sleutel meer gebruikt wordt**

```bash
grep -rn "distribution.rank\.\|tool\.price_\|tool\.priceNone\|tool\.priceOff\|tool\.priceOn\|tool\.priceSame\|help\.dragHandle\|help\.rankCost\|strip\.requestedVsAchievable\|strip\.fixedLoad" src/ tests/ ; echo "treffers: $?"
```

Verwacht: **geen enkele treffer** (`grep` exit 1). Is er wel één, dan is taak 4 niet af.

- [ ] **Step 5: De i18n-poort**

```bash
export PATH="/home/nozzit/.nvm/versions/node/v22.23.2/bin:$PATH"
npm run verify:i18n; echo "exit: $?"
```

Verwacht: **exit 0**. Meldt hij een ontbrekende categorie, kijk in de tabel bovenaan deze taak welke
suffixen die locale eist — een `_many` vergeten in `fr`/`es`/`it`/`pt` is de meest voorkomende fout.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/locales
git commit -m "$(cat <<'EOF'
i18n(b1c): verschil-prijs, legenda en validatiestrook in veertien locales

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: de browsertests herschrijven

**Files:**
- Modify: `tests/browser/leveling-distribution.spec.ts`

De fixtures blijven ongewijzigd: `createLibrary`, `bookOnPoolItem`, `seedTwoConflictingDocuments`,
`seedUncountedDocument`, `seedTwoSingleDayDocuments`, `seedUnsolvableShortfall`, `makeScheduled`,
`openOccupancyWithRealClick`, `openDistributionFromConflictRow`, `openDistributionFromRibbon`,
`seedLargeDegradedProject`, `seedManySmallDocuments`, `delayedTaskCount`. Alleen de tests die de
**bediening** aanraken gaan op de schop.

- [ ] **Step 1: Verwijder de vervallen test**

Verwijder de hele test `'rangorde: slepen verandert de volgorde en laat het voorstel vervallen'`
inclusief zijn commentaarblok — de rangordelijst bestaat niet meer (spec §2.1).

- [ ] **Step 2: Pas de pin-/toetsenbordtest aan**

Vervang in `'fasestroken: pin en plafond zijn met het toetsenbord te bedienen'` de pin-locator

```ts
  const pin = strip.getByRole('button', { name: /Vastzetten|Pin/ });
```

door

```ts
  // De pin is sinds het herontwerp een TEKSTknop ("vastzetten" ↔ "vast — losmaken", spec §6), geen
  // icoon meer. Het testanker blijft `data-ops-distribution-pin`; de toestand blijft `aria-pressed`.
  const pin = strip.locator('[data-ops-distribution-pin]');
```

en vervang de laatste twee regels van die test

```ts
  await handle.press('End');
  await expect(handle).toHaveAttribute('aria-valuetext', /onbegrensd|unlimited/i);
```

door

```ts
  await handle.press('End');
  await expect(handle).toHaveAttribute('aria-valuetext', /onbegrensd|unlimited/i);
  // Onbegrensd zet de handle aan het einde van de as (spec §5) — meetbaar: hij staat rechts van
  // het laatste dagblokje van dezelfde rij.
  const handleBox = (await handle.boundingBox())!;
  const lastDay = (await strip.locator('[data-ops-distribution-day="work"]').last().boundingBox())!;
  expect(handleBox.x).toBeGreaterThan(lastDay.x + lastDay.width);
```

- [ ] **Step 3: Vervang de "rekent pas bij loslaten"-test door de LIVE-sleeptest**

Vervang de hele test `'plafond-handle: slepen snapt op hele werkdagen en rekent pas bij loslaten'`
door:

```ts
test('plafond-handle: tijdens het slepen rekent de dialoog live mee', async ({ page, ops: _ops }) => {
  await seedTwoSingleDayDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  // De rijen staan in plaatsingsvolgorde; nr. 2 is degene die moet wijken. Home = plafond 0, een
  // deterministisch startpunt ongeacht de benutte uitloop.
  const strip = page.locator('[data-ops-distribution-strip]').nth(1);
  const handle = strip.locator('[data-ops-distribution-handle]');
  await handle.focus();
  await handle.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '0');
  await expect.poll(() => strip.locator('[data-ops-distribution-effect]').textContent())
    .not.toContain('…');

  // Geen magisch getal: de dagbreedte komt uit de gedeelde tijdas, zichtbaar via hetzelfde
  // attribuut dat de sleeppositie zelf ook gebruikt.
  const dayWidth = Number(await strip.getAttribute('data-ops-distribution-day-width'));
  expect(dayWidth).toBeGreaterThan(0);

  const effectBefore = await strip.locator('[data-ops-distribution-effect]').textContent();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();

  // Spec §5, het eigenaarsbesluit dat §3.4 van de oude spec bijstelt: tijdens het slepen wordt er
  // ECHT gerekend. Zowel de waarde als het uitkomstlabel moeten VÓÓR `mouse.up()` meebewegen.
  await page.mouse.move(box.x + box.width / 2 + 3 * dayWidth, box.y + box.height / 2, { steps: 6 });
  await expect(handle).toHaveAttribute('aria-valuenow', '3');
  await expect.poll(() => strip.locator('[data-ops-distribution-effect]').textContent())
    .not.toBe(effectBefore);

  // De muis verlaat het element en het slepen loopt door — `setPointerCapture` op de handle, geen
  // document-brede listener nodig.
  await page.mouse.move(box.x + box.width / 2 + 5 * dayWidth, box.y - 200, { steps: 4 });
  await expect(handle).toHaveAttribute('aria-valuenow', '5');
  await page.mouse.up();

  const shiftedDocId = await strip.getAttribute('data-ops-doc-id') ?? '';
  await expect.poll(() => page.evaluate(docId => {
    const ui = window.__OPS__!.store.getState().ui.levelingDistribution!;
    return ui.ceilings[docId];
  }, shiftedDocId)).toBe(5);
});
```

- [ ] **Step 4: De verschil-prijs**

Vervang de test `'kostenlabels en prijskaartjes verschijnen en verdwijnen met het voorstel'` door:

```ts
test('het prijskaartje is één VERSCHIL en volgt de stand van de schakelaar', async ({ page, ops: _ops }) => {
  await seedTwoConflictingDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  // Eigenaarsbesluit 2026-09-12 (spec §2.2): geen twee bedragen naast elkaar meer, maar één
  // verschil. Schakelaar UIT ⇒ een belofte ("zou … besparen"); AAN ⇒ een constatering ("bespaart
  // …"). Nul is expliciet, niet leeg.
  const price = page.locator('[data-ops-distribution-tool-price]');
  await expect.poll(() => price.textContent())
    .toMatch(/zou .*besparen|would save|zou niets besparen|would save nothing/i);

  await page.getByRole('switch', { name: /Onderbrekingen toestaan|Allow interruptions/ }).click();
  await page.getByRole('button', { name: /Herbereken|Recalculate/ }).click();
  await expect.poll(() => price.textContent())
    .toMatch(/^(?!.*zou)(?=.*(bespaart|saves))/i);

  // Een externe bewerking laat het voorstel vervallen (§6a); een prijs bij een vervallen voorstel
  // zou liegen, dus die gaat terug naar "prijs onbekend".
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const task = s.tasks[0];
    s.updateTask(task.id, { time: { ...task.time, scheduleDuration: 4 } });
  });
  await expect(price).toContainText(/prijs onbekend|price unknown/i);
});
```

- [ ] **Step 5: Nieuw — de validatiestrook, Reset en de vaste-hoogte-belofte**

Voeg deze drie tests toe, onder de bestaande taak-12-tests:

```ts
test('de validatiestrook staat er altijd en meldt de uitkomst of het tekort', async ({ page, ops: _ops }) => {
  await seedTwoSingleDayDocuments(page);
  await openDistributionFromConflictRow(page);

  // Spec §3.5/§7: ALTIJD gerenderd, ook wanneer alles goed is — en dan groen met de grootste
  // einddatum-verschuiving erin.
  const status = page.locator('[data-ops-distribution-status]');
  await expect(status).toBeVisible();
  await expect(status).toContainText(/Conflict opgelost|Conflict resolved/i);

  // Alle deelnemers vastzetten ⇒ er valt niets te herverdelen, en de strook zegt dat met een uitweg.
  for (const pin of await page.locator('[data-ops-distribution-pin]').all()) await pin.click();
  await page.getByRole('button', { name: /Herbereken|Recalculate/ }).click();
  await expect(status).toContainText(/staan vast|is pinned/i);
});

test('een tekort kleurt de validatiestrook rood en houdt Toepassen tegen', async ({ page, ops: _ops }) => {
  await seedUnsolvableShortfall(page);
  await openDistributionFromConflictRow(page);

  const status = page.locator('[data-ops-distribution-status]');
  await expect(status).toContainText(/tekort|short/i);
  await expect(page.getByRole('button', { name: /^(Toepassen|Apply)$/ })).toBeDisabled();
  await expect(page.locator('[data-ops-distribution-apply-reason]')).toContainText(/tekort|shortfall/i);
});

test('Reset zet plafonds en vastzettingen terug, en laat de schakelaar staan', async ({ page, ops: _ops }) => {
  await seedTwoSingleDayDocuments(page);
  await openDistributionFromConflictRow(page);

  await page.getByRole('switch', { name: /Onderbrekingen toestaan|Allow interruptions/ }).click();
  const strip = page.locator('[data-ops-distribution-strip]').nth(1);
  await strip.locator('[data-ops-distribution-handle]').focus();
  await strip.locator('[data-ops-distribution-handle]').press('ArrowRight');
  await page.locator('[data-ops-distribution-pin]').first().click();
  await expect.poll(() => page.evaluate(() => {
    const ui = window.__OPS__!.store.getState().ui.levelingDistribution!;
    return Object.keys(ui.ceilings).length + Object.values(ui.pinned).filter(Boolean).length;
  })).toBeGreaterThan(1);

  await page.locator('[data-ops-distribution-reset]').click();

  // Spec §3.6: alle plafonds en pins terug, de SCHAKELAAR ongemoeid.
  await expect.poll(() => page.evaluate(() => {
    const ui = window.__OPS__!.store.getState().ui.levelingDistribution!;
    return {
      ceilings: Object.values(ui.ceilings).filter(v => v !== null).length,
      pins: Object.values(ui.pinned).filter(Boolean).length,
      splits: ui.allowSplits,
    };
  })).toEqual({ ceilings: 0, pins: 0, splits: true });
});

test('de dialoog flitst niet: dezelfde boundingBox over een herberekening en een sleep', async ({ page, ops: _ops }) => {
  await seedTwoSingleDayDocuments(page);
  await openDistributionFromConflictRow(page);
  await expect(page.locator('[data-ops-distribution-strip]')).toHaveCount(2);

  const dialog = page.locator('[data-ops-distribution-dialog]');
  const before = (await dialog.boundingBox())!;

  // (1) Een herberekening. De bezig-toestand mag zich alleen via kleur/opaciteit tonen — nooit door
  // een blok toe te voegen of weg te halen (spec §7).
  await page.getByRole('button', { name: /Herbereken|Recalculate/ }).click();
  const during = (await dialog.boundingBox())!;
  await expect(page.locator('[data-ops-distribution-status]')).toBeVisible();
  const after = (await dialog.boundingBox())!;

  // (2) Een sleep, inclusief de live herberekening die eronder loopt.
  const strip = page.locator('[data-ops-distribution-strip]').nth(1);
  const handle = strip.locator('[data-ops-distribution-handle]');
  const dayWidth = Number(await strip.getAttribute('data-ops-distribution-day-width'));
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 4 * dayWidth, box.y + box.height / 2, { steps: 8 });
  const dragging = (await dialog.boundingBox())!;
  await page.mouse.up();
  const released = (await dialog.boundingBox())!;

  for (const [name, box2] of [['tijdens', during], ['erna', after], ['slepend', dragging], ['losgelaten', released]] as const) {
    expect(box2.x, `x ${name}`).toBeCloseTo(before.x, 0);
    expect(box2.y, `y ${name}`).toBeCloseTo(before.y, 0);
    expect(box2.width, `breedte ${name}`).toBeCloseTo(before.width, 0);
    expect(box2.height, `hoogte ${name}`).toBeCloseTo(before.height, 0);
  }
});
```

- [ ] **Step 6: De twee degradatietests**

De kostenlabels bestaan niet meer, dus `[data-ops-distribution-cost]` bestaat niet meer. Vervang in
`'boven het documentenplafond rekent de dialoog alleen op de knop'`:

```ts
  await expect(page.locator('[data-ops-distribution-cost]').first()).toContainText(/Herbereken|Recalculate/);
```

door

```ts
  // Gedegradeerd ⇒ geen verschil-pas, dus geen prijs maar de expliciete route.
  await expect(page.locator('[data-ops-distribution-tool-price]')).toContainText(/prijs onbekend|price unknown/i);
```

En in `'boven de ondersteunde schaal rekent de dialoog alleen op de knop'` vervang de twee
`[data-ops-distribution-cost]`/`[data-ops-distribution-effect]`-asserties door:

```ts
  await expect(page.locator('[data-ops-distribution-tool-price]')).toContainText(/prijs onbekend|price unknown/i);

  const handle = page.locator('[data-ops-distribution-strip]').first().locator('[data-ops-distribution-handle]');
  await handle.focus();
  await handle.press('ArrowRight');
  // Boven de schaal rekent een plafondwijziging NIET door (spec §5): de reden staat in de
  // validatiestrook, met de expliciete route erbij.
  await expect(page.locator('[data-ops-distribution-status]')).toContainText(/Herbereken|Recalculate/);
```

- [ ] **Step 7: Draai de spec**

```bash
export PATH="/home/nozzit/.nvm/versions/node/v22.23.2/bin:$PATH"
while pgrep -f "vite build|tsc --noEmit|playwright test|run.sh" >/dev/null; do sleep 20; done
npm run test:browser -- tests/browser/leveling-distribution.spec.ts; echo "exit: $?"
```

Verwacht: **exit 0**. Bij een val: `test-results/` heeft screenshots en traces,
`playwright-report/` het HTML-rapport.

- [ ] **Step 8: Commit**

```bash
git add tests/browser/leveling-distribution.spec.ts
git commit -m "$(cat <<'EOF'
test(b1c): browsertests voor de herontworpen verdeeldialoog

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: de gidsen en `docs/library.md`

**Files:**
- Modify: `public/docs/nl/gids-verdelen-restcapaciteit.md`
- Modify: `public/docs/en/gids-verdelen-restcapaciteit.md`
- Modify: `docs/library.md` (alleen waar hij de rangordelijst noemt)

De `manifest.json`-entry bestaat al (het artikel-id verandert niet). Blijf binnen de
**miniMarkdown-subset**: koppen `#`/`##`/`###`, paragrafen, enkelvoudige lijsten, `**vet**`,
`*cursief*`, `` `code` ``, codeblokken, afbeeldingen, en alleen `docs://`- en `examples://`-links.
Geen tabellen, geen blockquotes, geen h4, geen rauwe HTML.

- [ ] **Step 1: Vervang in de NL-gids de sectie "Wie wordt het meest ontzien?"**

Verwijder die hele sectie (kop + twee alinea's) en zet er dit voor in de plaats:

```markdown
## De balk is de bediening

Onder de schakelaar staat per project één balk op één gedeelde tijdas. Links de projectnaam met een
kleurstip en de speling die dat project nog heeft, in het midden de balk zelf, rechts de uitkomst.

In de balk zie je per werkdag een apart blokje in de kleur van het project, met een dun wit lijntje
ertussen — zo kun je de dagen letterlijk tellen. Een **gearceerd** blokje is een pauzedag: een
werkdag waarop de verdeler het werk even stillegt om ruimte te maken voor een ander project. Die
verschijnen alleen als je "Onderbrekingen toestaan" aan hebt staan.

Onderin de balk loopt een dunne meetlat mee. Het **grijs gestippelde** deel is de speling die dit
project nog had: zoveel mag het opschuiven zonder dat de einddatum meegaat. Het **massief rode**
deel is alles daarvoorbij — dát is echte einddatum-verschuiving. Een balk zonder rood kost het
project dus niets.

Rechts van het laatste blokje staat een **greep** met drie streepjes. Trek die naar rechts om dit
project meer uitloop toe te staan; de verdeler bepaalt vervolgens zelf op welke dagen hij pauzeert
en hoeveel van die ruimte hij echt nodig heeft. Wat je toestond maar niet nodig bleek, staat als een
**gestippeld kadertje** achter de balk. Terwijl je sleept rekent de app mee: de andere balken, de
grafiek en de uitkomsten veranderen onder je hand. Op een heel groot overzicht doet hij dat niet —
daar volgt de berekening zodra je loslaat.

Met het toetsenbord werkt dezelfde greep: pijltjes verzetten één werkdag, PageUp en PageDown drie,
Home zet het plafond op nul en End maakt het onbegrensd.

Rechts van de balk staat de uitkomst: een gekleurde pil met wat er met de einddatum gebeurt (groen
bij nul, amber bij een dag of twee, rood daarboven), en daaronder de uiterste datum die je toestond
plus hoeveel dagen daarvan echt benut zijn.
```

- [ ] **Step 2: Vervang in de NL-gids de sectie "Vastzetten of een plafond"**

Vervang de laatste alinea van die sectie (die begint met "Het plafond is een sleepbare handle op de
fasestrook") door:

```markdown
Vastzetten doe je met de tekstknop **vastzetten** links bij de projectnaam; hij verandert dan in
**vast — losmaken**. Het plafond zet je met de greep in de balk, zoals hierboven beschreven. Met de
knop **Reset** onderin zet je in één keer alle plafonds en vastzettingen terug op neutraal; de
schakelaar "Onderbrekingen toestaan" blijft daarbij staan, want dat is een keuze over het
gereedschap en niet over één project.
```

- [ ] **Step 3: Vervang in de NL-gids de sectie "Onderbrekingen toestaan", laatste alinea**

Vervang

```markdown
Werk dat al begonnen is, wordt nooit onderbroken, met of zonder deze schakelaar aan: dat deel kan
alleen nog via uitloop wijken. Bij elke instelling van de schakelaar toont de dialoog het prijskaartje
in werkdagen uitloop, zodat je het effect kunt afwegen vóór je toepast.
```

door

```markdown
Werk dat al begonnen is, wordt nooit onderbroken, met of zonder deze schakelaar aan: dat deel kan
alleen nog via uitloop wijken. Naast de schakelaar staat wat hij oplevert, als één verschil: staat
hij uit, dan lees je "zou 3 werkdagen besparen"; staat hij aan, dan "bespaart 3 werkdagen". Levert
onderbreken hier niets op, dan staat dat er ook gewoon.
```

- [ ] **Step 4: Voeg in de NL-gids een sectie toe vóór "Toepassen en terugdraaien"**

```markdown
## De regel onder de grafiek

Onder de grafiek staat altijd één regel met het oordeel. Groen betekent dat het conflict opgelost is,
met daarbij de grootste einddatum-verschuiving en het project dat hem draagt. Rood betekent dat er
nog een tekort staat, met de eerste dagen waarop het misgaat. Staan alle projecten vast, dan zegt die
regel dat er niets te herverdelen valt en dat je er één moet losmaken. Is het voorstel niet meer
actueel — omdat je iets veranderde of omdat er in een van de projecten gewerkt is — dan staat dat
daar ook.

Die regel is er altijd, ook als er niets te melden valt. Dat is met opzet: zo verspringt de rest van
het scherm niet zodra er iets verandert.
```

- [ ] **Step 5: Dezelfde vier wijzigingen in de EN-gids**

`public/docs/en/gids-verdelen-restcapaciteit.md`, met de EN-koppen:

```markdown
## The bar is the control

Below the switch, each project gets one bar on one shared timeline. On the left the project name with
a colour dot and the slack it still has, in the middle the bar itself, on the right the outcome.

Inside the bar you see one block per workday in the project's colour, separated by a thin white line —
so you can literally count the days. A **hatched** block is a pause day: a workday on which the
distributor holds the work still to make room for another project. Those only appear when "Allow
interruptions" is on.

A thin gauge runs along the bottom of the bar. The **grey dotted** part is the slack this project
still had: it may shift that far without moving its end date. The **solid red** part is everything
beyond that — real end-date shift. A bar without red costs the project nothing.

To the right of the last block sits a **grip** with three strokes. Drag it to the right to allow this
project more overrun; the distributor then decides for itself which days to pause on and how much of
that room it actually needs. Whatever you allowed but turned out not to be needed shows up as a
**dotted box** behind the bar. While you drag, the app recalculates: the other bars, the chart and the
outcomes move under your hand. On a very large overview it does not — there the calculation follows
when you release.

The same grip works from the keyboard: the arrow keys move one workday, PageUp and PageDown three,
Home sets the ceiling to zero and End makes it unlimited.

To the right of the bar sits the outcome: a coloured pill with what happens to the end date (green at
zero, amber at a day or two, red above that), and below it the latest date you allowed plus how many
of those days are actually used.
```

```markdown
Pinning is the **pin** text button next to the project name; it turns into **pinned — unpin**. The
ceiling is the grip in the bar, as described above. The **Reset** button at the bottom puts every
ceiling and pin back to neutral in one go; the "Allow interruptions" switch stays as it is, because
that is a choice about the tool and not about one project.
```

```markdown
Work that has already started is never interrupted, with or without this switch: that part can only
give way through overrun. Next to the switch you see what it buys you, as a single difference: with
the switch off it reads "would save 3 workdays", with it on "saves 3 workdays". If interrupting buys
nothing here, it says so plainly.
```

```markdown
## The line below the chart

Below the chart there is always one line with the verdict. Green means the conflict is resolved, with
the largest end-date shift and the project carrying it. Red means a shortfall remains, with the first
days on which it goes wrong. If every project is pinned, that line says there is nothing to
redistribute and that you should unpin one. If the proposal is no longer current — because you
changed something, or because someone worked in one of the projects — that shows up there too.

That line is always there, even when there is nothing to report. That is deliberate: it stops the
rest of the screen from jumping whenever something changes.
```

- [ ] **Step 6: `docs/library.md`**

Vervang in punt 5 de zin

```
De gebruiker stuurt het
   voorstel bij met een rangorde ("wie wordt het meest ontzien"), een schakelaar voor onderbrekingen,
   en per project twee begrenzingen:
```

door

```
De gebruiker stuurt het
   voorstel bij vanuit de balken zelf (herontwerp 2026-09-12: de rangordelijst is uit beeld
   verdwenen — de rijvolgorde ís de spelingsvolgorde van de rekenaar, en sturen doe je met de greep
   en de pin), met daarnaast een schakelaar voor onderbrekingen, en per project twee begrenzingen:
```

en vervang in dezelfde alinea "De rangorde, pins en plafonds horen bij de verdeelsessie zelf" door
"De pins en plafonds horen bij de verdeelsessie zelf".

- [ ] **Step 7: De docs-poort**

```bash
export PATH="/home/nozzit/.nvm/versions/node/v22.23.2/bin:$PATH"
npm run verify:docs; echo "exit: $?"
```

Verwacht: **exit 0**. Klaagt hij over de parser-subset, dan staat er een tabel, een blockquote, een
h4 of rauwe HTML in je tekst.

- [ ] **Step 8: Commit**

```bash
git add public/docs/nl/gids-verdelen-restcapaciteit.md \
        public/docs/en/gids-verdelen-restcapaciteit.md docs/library.md
git commit -m "$(cat <<'EOF'
docs(b1c): gidsen en library.md volgen de nieuwe bediening van de verdeeldialoog

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: de volle poort

**Files:** geen — dit is de poort, geen wijziging. Blijkt er tóch iets stuk, dan repareer je dat in
de taak waar het hoort en draai je deze taak opnieuw.

- [ ] **Step 1: Wacht tot er niets zwaars draait, en draai `verify`**

```bash
export PATH="/home/nozzit/.nvm/versions/node/v22.23.2/bin:$PATH"
while pgrep -f "vite build|tsc --noEmit|playwright test|run.sh" >/dev/null; do sleep 20; done
npm run verify; echo "exit: $?"
```

Verwacht: **exit 0**. Let specifiek op deze vier poorten:

- **`verify:i18n`** — de drie nieuwe meervoudsfamilies in veertien locales (taak 5).
- **`verify:docs`** — de gidsen blijven binnen de miniMarkdown-subset (taak 7).
- **`verify:cycles`** — `stripGeometry.ts` importeert alleen `occupancyAxis` en `dateUtils`, beide
  bladmodules; `useDistributionProposal` → `stripGeometry` is een nieuwe rand en mag geen kring
  sluiten.
- **`verify:gantt-boundaries`** — deze dialoog tekent SVG in de DOM en hoort de Canvas-renderer-,
  viewport- en pointergrenzen van de Gantt niet te raken.

Kijk **niet** naar de tekst "alles groen" in de tail — de planningssuite print die ook bij exit 1
wanneer het bundelen faalt.

- [ ] **Step 2: De volle browserpoort**

```bash
export PATH="/home/nozzit/.nvm/versions/node/v22.23.2/bin:$PATH"
while pgrep -f "vite build|tsc --noEmit|playwright test|run.sh" >/dev/null; do sleep 20; done
npm run test:browser; echo "exit: $?"
```

Verwacht: **exit 0**. Deze dekking moet er staan in
`tests/browser/leveling-distribution.spec.ts`:

| flow | taak |
|---|---|
| dialoog openen vanuit de conflictregel, focus-trap, twee balken, sluiten (Esc) | bestaand |
| kiezer-stand: lijst, geen conflicten, "Ander item kiezen…" | bestaand |
| geblokkeerd voorstel: uitleg + Toepassen uit | bestaand |
| pin als tekstknop met `aria-pressed`; plafond met pijltjes/Home/End; End zet de handle aan het aseinde | 6 |
| slepen: snappen op werkdagen, LIVE meerekenen vóór `mouse.up`, doorlopen buiten het element | 6 |
| het prijskaartje is één verschil en volgt de schakelaarstand | 6 |
| validatiestrook: groen bij opgelost, "alles vast", rood bij tekort | 6 |
| Reset zet plafonds en pins terug en laat de schakelaar staan | 6 |
| de `boundingBox` van de dialoog is stabiel over herberekening én sleep | 6 |
| voor/na-preview: conflictdagen weg in de na-stand | bestaand |
| Toepassen in twee projecten + "Alles terugdraaien" | bestaand |
| voorstel vervalt bij een bewerking; documentwissel sluit de dialoog | bestaand |
| de twee degradatiestanden | 6 |

Ontbreekt er een rij, dan is die taak niet af.

- [ ] **Step 3: Een echte blik op het scherm**

De poorten meten gedrag, niet vorm. Deze verbouwing gaat over vorm, dus kijk er één keer naar:

```bash
export PATH="/home/nozzit/.nvm/versions/node/v22.23.2/bin:$PATH"
npm run dev
```

Lees de poort uit de uitvoer van de dev-server (niet 3007 aannemen — die is per worktree), open de
app, maak twee projecten die op één bibliotheekitem boeken, open Bezetting → Verdelen…, en
controleer met eigen ogen:

1. de dagblokjes zijn te tellen en de kleur per project komt overeen met het histogram eronder;
2. de kolommen van het histogram staan recht onder de dagblokjes, ook na horizontaal scrollen;
3. slepen aan de greep laat de andere balken en de grafiek meebewegen;
4. de dialoog verspringt geen pixel tijdens het rekenen;
5. in het donkere thema is de arcering van een pauzedag nog zichtbaar en de meetlat nog leesbaar.

- [ ] **Step 4: `git status --short` hoort schoon te zijn**

```bash
git status --short; git log --oneline -8
```

---

## Zelfreview van dit plan (uitgevoerd)

### 1. Spec-dekking

| spec | eis | taak |
|---|---|---|
| §2.1 | rangordelijst weg, `order` blijft bestaan als afgeleide | T3 (afleiding), T4 (lijst weg), T6 (test weg) |
| §2.2 | prijskaartje is één verschil, met de vier zinsvormen | T1 (`savingsWorkdays`), T3 (`savings`), T4 (`savingsLabel`), T5 (teksten), T6 (test) |
| §2.3 | geen rekentoestand verandert een hoogte | T2 (vaste breedtes), T4 (validatiestrook + degradatiesleuf), T6 (boundingBox-test) |
| §2.4 | kern, schrijfpad, terugdraaien, invalidatie, kiezer, degradatie blijven | expliciet buiten scope; T4 laat `applyGate`, `onApply`, `onUndoAll`, `DistributionPicker` ongemoeid |
| §3.1 | kop met itemnaam, ondertitel, één regel uitleg | T4 (kop blijft), T5 (`intro` herschreven) |
| §3.2 | gereedschap: schakelaar + verschil-prijs + MSP-toelichting | T4 stap 5, T5 |
| §3.3 | per deelnemend project één rij, aaneengesloten, één tijdas | T4 stap 5 |
| §3.4 | histogram op dezelfde as-instantie, kolom-op-kolom, capaciteitslijn, rode arcering, einddatum-badges | T4 stap 5 (gedeelde scroll-container + badgerij) |
| §3.5 | validatiestrook `role="status"`, `aria-live`, altijd gerenderd, vaste hoogte, groen/rood + reden | T4 stap 4 en 6, T5 (`status.*`), T6 |
| §3.6 | knoppenbalk: Ander item kiezen…, Reset, Toepassen, Verwerpen, "toegepast"-strook | T4 stap 6, T5 (`reset`, `help.reset`), T6 (Reset-test) |
| §4 | label 150 / track 32 / uitkomst 132, dagblokjes, pauzedag, gestippelde rest, meetlat, vaste last, pil + "max · benut", "vast"/"vast: datums zoals opgeslagen"/"kan niet wijken", legenda | T1 (geometrie), T2 (tekening + label), T4 (legenda-regel), T5 (`strip.*`) |
| §5 | alleen de handle pakbaar, 15×30, `role="slider"`, `aria-valuetext`, pointer capture, snappen, live meerekenen gethrottled, degradatie, toetsenbord ←/→/PgUp/PgDn/Home/End | T2 (alles), T3 (throttle-motivering), T6 (twee tests) |
| §6 | pin als tekstknop met `aria-pressed`, grijze rand, `aria-disabled`, "alles vast"-melding | T2 (knop + `aria-disabled` + gedempte kleuren), T4 (`allPinned`), T5 |
| §7 | bovenverankering, gereserveerde hoogtes, toestand via opaciteit/kleur, boundingBox-test | T4 stap 1/4/6, T2 (vaste breedte uitkomstlabel), T6 |
| §8 | de nieuwe sleutels, en `rank.*`/`tool.price*` weg zodra ongebruikt; één `assignDocColors` | T5, T4 stap 7 |
| §9 | headless check met drie gevallen + verschil-prijs; browsertests herschreven | T1, T6 |
| §10 | gidsen nl/en herschreven, `docs/library.md` waar hij de rangorde noemt | T7 |
| §11 | buiten scope | scope-tabel bovenaan |

Geen enkele spec-sectie zonder taak.

### 2. Plaatshouder-scan

Doorzocht op "TBD", "TODO", "later", "vergelijkbaar met taak N", "voeg foutafhandeling toe",
"schrijf tests voor het bovenstaande" en op stappen die wél zeggen wát maar niet hóé. Gevonden en
opgelost:

- Taak 4 stap 2 stond eerst als "verwijder de rangorde-code". Dat is nu een genummerde lijst van
  acht concrete verwijderingen mét de vervangende commentaartekst.
- Taak 5 stond eerst als "vertaal de nieuwe sleutels naar de overige twaalf talen". Dat zijn nu
  twaalf volledig uitgeschreven JSON-fragmenten mét de juiste CLDR-suffixen per taal.
- Taak 7 stond eerst als "herschrijf de gids". Dat is nu per sectie de letterlijke vervangende
  tekst, in beide talen.

Eén bewuste uitzondering die géén plaatshouder is: taak 4 stap 5 en 6 vervangen benoemde JSX-secties
in een bestand van 843 regels in plaats van het hele bestand over te typen. De ankers zijn de
bestaande commentaarkoppen (`{/* (4) Rangorde */}`, `{/* (5) Fasestroken … */}`,
`{/* (6) Voor/na-histogram … */}`) — die staan er letterlijk zo in.

### 3. Type-consistentie tussen de taken

| naam | gedefinieerd in | gebruikt in | klopt |
|---|---|---|---|
| `STRIP` (`labelWidth` 150, `endWidth` 132, `gap` 10, `trackHeight` 32, `blockHeight` 15, `blockTop` 5, `measureHeight` 3, `measureBottom` 3, `handleWidth` 15, `handleHeight` 30, `handleTop` 1) | T1 | T1 (check), T2 (tekening), T4 (uitlijning) | ✔ |
| `buildStripGeometry(input: StripGeometryInput): StripGeometry` | T1 | T2 | ✔ — T2 geeft exact de acht velden mee die `StripGeometryInput` eist |
| `StripGeometry.ceilingEndIso` | T1 | T2 (`maxDate`-label) | ✔ |
| `savingsWorkdays(off, on)` / `maxEndShiftWorkdays(docs)` | T1 | T3 (`scheduleSavingsPass`) | ✔ |
| `DistributionProposalState.savings: { workdays: number } \| null` | T3 | T4 (`savingsLabel`) | ✔ — `costByDoc`/`toolPrice` bestaan nergens meer |
| `PhaseStripProps` (18 velden) | T2 | T4 (de aanroep) | ✔ — de aanroep in T4 stap 5 geeft alle 18, incl. `beforeLoadByDay`/`afterLoadByDay`/`isWorkingDay`/`slackWorkdays`/`liveCommit`/`busy`/`formatDay` |
| `Dialog.alignTop?: boolean` | T4 stap 1 | T4 stap 5 | ✔ |
| i18n-sleutels `tool.savesOff/savesOn/savesNoneOff/savesNoneOn`, `strip.legend/slack/pinButton/unpinButton/maxDate/used`, `status.resolved/shortfall/allPinned`, `reset`, `help.reset` | T5 | T2 en T4 | ✔ — één-op-één dezelfde namen; `strip.used` gebruikt `{{used}}` (geen `count`), `status.resolved` gebruikt `{{shift}}` + `{{doc}}`, `status.shortfall` gebruikt `{{count}}` + `{{days}}` |
| testankers `data-ops-distribution-{status,reset,legend,end-badges,track,handle,pin,effect,tool-price,day}` | T2 en T4 | T6 | ✔ |

Eén punt dat de uitvoerder van T4 moet bewaken: `shortfallDocs` (de bestaande `useMemo` die
`BeforeAfterChart` voedt) blijft bestaan — hij wordt níét vervangen door `shortfallDays`. Die twee
hebben verschillende vormen (per document met een taakteller, versus de unieke dagen over alles) en
verschillende afnemers.

### 4. Waar dit plan concretiseert (alle **KEUZE VAN DIT PLAN**-plekken op een rij)

1. **T1** — de balk tekent de **NA**-stand (`afterLoadByDay`), niet de voor-stand. §4 laat beide toe;
   alleen de NA-stand beweegt mee tijdens het slepen.
2. **T1** — de meetlat splitst op de **eigen speling vanaf het oorspronkelijke fase-einde**, niet op
   `projectEndBefore`/`projectEndAfter`. Dat is letterlijk `.pfl`/`.pover` uit het prototype, en het
   is per constructie consistent met `endShiftWorkdays`.
3. **T2** — **SVG voor de track, DOM voor de handle**, met de maatvoering van het prototype. Drie
   redenen in de taak; het volgt bovendien wat `PhaseStrip` en `ContourPhaseStrip` vandaag al doen.
4. **T2/T3** — **live commit per gesnapte werkdag** onder de schaal; de bestaande
   in-flight-coalescing van de hook ís de throttle, er komt geen tweede timer bij.
5. **T3** — `order` is **één keer afgeleid, bij het openen**. Een tweede afleidingsmoment zou via
   `diffReason('rank')` een oneindige herberekening geven.
6. **T4** — **één gedeelde horizontale scroll-container** om balken, badges en histogram, zodat de
   kolom-op-kolom-uitlijning ook tijdens het scrollen klopt.
7. **T4** — de **stale-melding verhuist naar de validatiestrook** maar behoudt haar
   `data-ops-distribution-stale`-anker als `<span>` erbinnen, zodat de bestaande browserasserties
   geldig blijven én de hoogte vast is.
8. **T4** — "N ploegdagen tekort" telt **unieke ISO-dagen** over alle tekorten samen.
9. **T5** — `status.resolved` en `strip.used` krijgen **geen eigen meervoudsfamilie**: de eerste
   hergebruikt de bestaande `strip.endShift`-familie via een `{{shift}}`-parameter, de tweede
   vermijdt `count` bewust. `status.shortfall` wordt wél een familie (spec §8 noemt hem niet, §3.5
   schrijft de tekst met een telwoord voor).

### 5. Wat de uitvoerder onderweg moet verifiëren

Deze drie aannames zijn gelezen maar niet gedraaid; ze staan ook in de betreffende stap.

1. **`CalendarEngine`'s constructor neemt één `WorkCalendar`** (`CalendarEngine.ts:64`) en
   `isWorkDay(date: Date)` bestaat (`:171`). `DistributionDocInput` draagt `calendar` én `calendars`;
   dit plan gebruikt alleen `calendar` — controleer of dat voor een document met een afwijkende
   taakkalender de juiste werkdagen oplevert, en meld het als een taakkalender hier zichtbaar
   afwijkt (T4 stap 3).
2. **Tailwind's `items-start` versus `items-center`** in dezelfde class-lijst is afhankelijk van
   CSS-volgorde; daarom vervangt `alignTop` de klasse in plaats van er één naast te zetten
   (T4 stap 1). Controleer in stap 3 van taak 8 met eigen ogen dat het paneel écht bovenaan hangt.
3. **`--success` (#16A34A) en `--warning` (#F59E0B)** bestaan in `src/styles/globals.css`
   (regels 1170 en 1173) — geverifieerd op 2026-09-12. Wat nog wél te controleren valt: of het
   DONKERE thema ze overschrijft met een variant die op `color-mix(… 10% …)`-achtergrond genoeg
   contrast houdt. Blijkt de amberkleur daar onleesbaar, meld dat dan in plaats van er zelf een
   vierde kleur bij te verzinnen (T2 stap 1, T4 stap 6).
