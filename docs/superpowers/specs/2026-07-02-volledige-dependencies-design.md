# Ontwerp: Fase 2.1 — Volledige dependencies

*Datum: 2026-07-02 · Status: in uitvoering · Bron: [docs/TODO.md](../../TODO.md) §2.1, [PLAN.md](../../../PLAN.md) §2.2.B + §6 Fase 2.1*

Dit document legt de ontwerpbeslissingen vast voor de zes TODO-items van fase 2.1,
op basis van drie onderzoekssporen: (1) audit van de huidige implementatie,
(2) intentie-context uit PLAN.md en de planning-testsuite, en (3) vakstandaard-
semantiek van Primavera P6, MS Project en IFC 4.3 (buildingSMART).

## 1. Uitgangspunten uit het onderzoek

- **Lag-rekenkern bestaat al** en is geverifieerd (129 groene cases): alle vier
  relatietypes als *ondergrenzen* ("niet eerder dan"), lag in **werkdagen** via
  `CalendarEngine.addWorkingDaysSigned`, negatieve lag (lead) werkend maar
  geklemd op één globale projectstart-vloer (`CPMSolver.ts` forwardPass).
- **P6 én MS Project klemmen leads eveneens** (P6 op de data date, MSP op de
  projectstart). Onze clamp is dus *correct gedrag*, geen bug — het "nu deels"
  uit de TODO zit in de randgevallen en de portabiliteit (zie §2).
- **Vakstandaard lag-kalender**: MSP telt lag altijd in werktijd op de kalender
  van de opvolger (of als "elapsed" 24/7 bij `2ed`); P6 heeft een projectoptie
  met als gedocumenteerde default de *successor-kalender*. Eén projectkalender
  is alles wat wij nu hebben (meerdere kalenders = fase 2.8), dus werkdagen-lag
  = projectkalender; per relatie een unit-vlag werkdagen/kalenderdagen is de
  maximaal compatibele, simpelste vorm.
- **Procent-lag is MSP-semantiek** (P6 kent het niet; Asta wel): fractie van de
  duur van de **voorganger**, dynamisch — bij elke CPM-run opnieuw geëvalueerd
  uit de *huidige* voorgangerduur. IFC 4.3 ondersteunt dit native
  (`IfcRatioMeasure`; de spec zelf beschrijft 0.5 = "start wanneer de
  voorganger 50% gereed is").
- **Driving-definitie (P6, industriereferentie)**: een relatie is *driving*
  ⟺ de door haar gegenereerde grens is de bindende term in de `max()` van de
  early-datum van de opvolger (relationship free float = 0; gelijkspel
  toegestaan → meerdere driving voorgangers). Weergaveconventie die elke
  P6-gebruiker leest: **doorgetrokken = driving, gestreept = non-driving,
  rood = kritiek**. Computed, nooit gepersisteerd (ook niet in IFC).
- **IFC 4.3**: `IfcLagTime(Name, DataOrigin, UserDefinedDataOrigin, LagValue,
  DurationType)` met `LagValue: IfcTimeOrRatioSelect = IfcDuration |
  IfcRatioMeasure` en `DurationType: WORKTIME | ELAPSEDTIME | NOTDEFINED`.
  **Onze writer heeft LagValue en DurationType omgewisseld** (enum in het
  value-slot, duur in het enum-slot) — intern round-tript dat, maar het bestand
  is niet-conformant. Wordt in 2.1 rechtgezet, met legacy-leespad.
- **Matrix/tabel**: PLAN.md B10 is gemodelleerd op P6/Asta; P6's vorm is een
  *relatietabel* (Predecessors/Successors-tabs met kolommen Activity, Type,
  Lag, Driving, …), geen N×N-grid. Een echte DSM-matrix is een analyse-extra
  en valt buiten 2.1.
- **Path tracing**: MSP "Task Path" (bar-highlighting: voorgangers/opvolgers,
  driving in sterkere tint) + P6 "Trace Logic" (interactief N niveaus lopen).
  Voor 2.1: de Gantt-highlight, gesynchroniseerd met de selectie.

## 2. Wat "negatieve lag volledig correct" concreet betekent

De clamp op de projectstart blijft (P6/MSP-conform, en
`bevindingen.md` §mis-diagnose bevestigt de ondergrens-semantiek). Af te ronden:

1. **Weekend/feestdag-randgeval**: `addWorkingDaysSigned` normaliseert zijn
   input eerst *vooruit* naar `nextWorkDay` en stapt dan — een lead vanaf een
   niet-werkdag kan zo een dag verschuiven. Voor negatieve stappen hoort de
   normalisatie *achteruit* (`prevWorkDay`-richting). Testcases erbij.
2. **Symmetrie backward pass**: leads moeten in de late-datums exact gespiegeld
   doorwerken (geen fantoomfloat rond een lead). Testcases erbij.
3. **Truncatie-signaal**: wanneer de clamp een lead daadwerkelijk afkapt, wordt
   dat zichtbaar (waarschuwing in het relatie-paneel/de relatietabel), zodat de
   gebruiker weet dat de lead niet volledig benut is.
4. **Lead > voorgangerduur**: numeriek gewoon rekenen (zoals P6/MSP), maar
   markeren als logische waarschuwing.
5. **IFC-portabiliteit**: negatieve duur serialiseren als ISO-8601 met
   voorloopteken (`-P2D`) in plaats van het niet-standaard `P0Y0M-2D`;
   reader accepteert beide.

## 3. Datamodel

`src/types/sequence.ts` — `Sequence` breidt uit (backward-compatibel, alle
nieuwe velden optioneel):

```ts
export interface Sequence {
  id: string;
  predecessorId: string;
  successorId: string;
  type: SequenceType;
  /** Vaste lag in dagen (positief = uitloop, negatief = lead). Genegeerd als lagPercent gezet is. */
  lagDays: number;
  /** Lag-eenheid, IFC-conform: WORKTIME = werkdagen (default), ELAPSEDTIME = kalenderdagen. */
  lagUnit?: 'WORKTIME' | 'ELAPSEDTIME';
  /** Procentuele lag: fractie van de duur van de voorganger, bv. 50 = 50%. Sluit lagDays uit. */
  lagPercent?: number;
}
```

- `lagUnit` ontbreekt/`WORKTIME` = huidig gedrag (migratieloos).
- `lagPercent` gezet → effectieve lag = `round(voorgangerduur_werkdagen ×
  lagPercent / 100)` geëvalueerd **per CPM-run** (MSP-semantiek; afronden op
  hele dagen omdat de hele engine dag-granulair is — gedocumenteerde afwijking
  van MSP's minuutprecisie). Combineert met `lagUnit` (elapsed-percent = `e%`).
- **Driving wordt níét op `Sequence` opgeslagen** — het is een rekenresultaat
  (zie §4).

Nieuwe store-actie `updateSequence(id, patch)` in `sequenceSlice` (met
undo-snapshot + `isDirty`, zelfde patroon als `addSequence`); bestaat nu niet
(alleen add/remove).

## 4. CPM-wijzigingen (`CPMSolver` + `CalendarEngine`)

- **Effectieve lag** komt uit één helper: `resolveLag(seq, predDurationDays)`
  → dagen + unit. Kalenderdag-lag gebruikt `addCalendarDays` (bestaat al in
  `dateUtils`, nog niet aangesloten), gevolgd door de bestaande
  werkdag-snapping van de constraint (forward: `nextWorkDay`, backward:
  `prevWorkDay`-equivalent) — MSP-gedrag voor elapsed lag.
- **`addWorkingDaysSigned`**: richtingbewuste normalisatie (negatief → eerst
  terug naar de vorige werkdag i.p.v. vooruit).
- **Driving-berekening** in de forward pass: per relatie
  `driving ⟺ (gegenereerde grens == aangenomen early-grens)` met
  dag-gelijkheid; ties toegestaan. Output in `CPMResult`:
  `drivingSequenceIds: string[]` (ids van driving relaties). Geen persistentie,
  geen IFC.
- `criticalPath` blijft zoals hij is (set van tf = 0); longest-path e.d. is
  fase 2.9.

## 5. UI

Coherentie-uitgangspunt: bestaande patronen volgen — ribbon-tab → full panel
(zoals Tabel/IFC/Rapport), thema-variabelen, alles via `t(...)` (en-fallback,
14 locales), undo/dirty-conventies.

1. **Relatietabel** (TODO "dependency-matrix/tabel"): nieuwe ribbon-tab
   **Relaties** (`RibbonTab 'relations'`) met een full panel
   `RelationsPanel` — een platte, sorteerbare tabel van álle relaties:
   voorganger (wbs + naam), opvolger, type (dropdown, inline bewerkbaar),
   lag (inline bewerkbaar, notatie `2d`, `-1d`, `3ed`, `50%`), unit,
   **driving** (✓, alleen-lezen, uit `cpmResult`), waarschuwingen
   (afgekapte lead, lead > voorgangerduur), verwijderknop. Rij-klik selecteert
   beide taken in de Gantt.
2. **TaskPropertiesPanel**: de bestaande alleen-lezen relatielijst wordt
   bewerkbaar (type-dropdown + lag-invoer per relatie, zelfde notatie) en
   toont het driving-vinkje.
3. **GanttRenderer**: dependency-pijlen krijgen per-relatie stijl —
   **doorgetrokken = driving, gestreept = non-driving**; kritieke relaties
   (beide taken kritiek + driving) in de bestaande kritiek-kleur. Lag-label
   optioneel bij de pijl (bij voldoende zoom).
4. **Path tracing** (TODO f): `ui.traceMode: 'off' | 'predecessors' |
   'successors' | 'both'` (app-globaal, niet gesnapshot). Actief + selectie →
   renderer dimt niet-betrokken taken en tint transitieve voorgangers
   (goud/amber) en opvolgers (paars), driving-buren in sterkere tint
   (MSP Task Path-conventie). Bediening: knoppengroep op de Relaties-tab +
   contextmenu-item op een taak; Escape zet uit. De graaf-walk (voorgangers/
   opvolgers-closure over `sequences`) komt als pure helper in
   `src/engine/scheduler/` zodat tabel én renderer hem delen.

## 6. IFC round-trip (`ifcReader`/`ifcWriter`)

- **Schrijver conformant maken**: `IFCLAGTIME('Lag', .PREDICTED., $,
  <LagValue>, <DurationType>)` met LagValue als getypte select —
  `IFCDURATION('P2D')` / `IFCDURATION('-P2D')` voor vaste lag,
  `IFCRATIOMEASURE(0.5)` voor procent-lag — en DurationType `.WORKTIME.` /
  `.ELAPSEDTIME.`.
- **Lezer**: nieuw conformant pad + **legacy-pad** (huidige bestanden hebben de
  duur in args[4] en `.WORKTIME.` in args[3]; detecteer en lees beide, zodat
  bestaande opgeslagen projecten blijven laden).
- Driving gaat níét het IFC in (geen schema-slot; per ontwerp computed).

## 7. Adapters (csv / msproject / p6)

- **CSV**: notatie uitbreiden naar `1.2FS+3ed` (elapsed) en `1.2SS+50%`
  (procent); parser-regex + writer symmetrisch.
- **MSPDI**: `LagFormat` percent- en elapsed-codes lezen waar aanwezig;
  schrijven: procent-lag → percent-LagFormat, elapsed → elapsed-dagcode;
  anders huidige tienden-van-minuten-pad.
- **P6 XML**: kent geen procent-lag → bij export **uitbakken** naar vaste uren
  (met logmelding); elapsed-lag zo goed mogelijk mappen, anders ook uitbakken.

## 8. Tests (tests/planning)

Case-schema (`harness.ts` + BRIEF) uitbreiden: `links[].lagUnit?`,
`links[].lagPercent?`; expects: `drivingSet?: [pred, succ, type][]`.
Nieuwe batterij `cases-lag-advanced.json`:

- kalenderdag-lag over weekend/feestdag (positief + negatief), vs. dezelfde
  case in werkdagen (differentieel);
- procent-lag: 50% van even/oneven duur (afronding), duurwijziging →
  herberekening, 0% en 100%, procent + lead (−50%), elapsed-percent;
- lead-randgevallen: lead vanaf niet-werkdag (normalisatierichting), lead in
  backward pass (symmetrie/geen fantoomfloat), lead geklemd op anker
  (bestaande semantiek blijft), lead > voorgangerduur;
- driving: enkelvoudig, multi-voorganger (bindende wint), gelijkspel (beide
  driving), driving met lag/lead, SS/FF/SF-varianten.

TDD-volgorde per stap: cases eerst (rood), dan implementatie (groen), volledige
suite + `npm run build` groen vóór elke commit.

## 9. Buiten scope van 2.1 (bewust)

- Meerdere kalenders / taakkalenders (fase 2.8) — lag-kalender = projectkalender.
- Datum-constraints in de driving-uitzondering (P6 sluit hard-constrained
  opvolgers uit) — constraints bestaan pas in fase 2.3; dan toevoegen.
- N×N DSM-matrix, relationship filter (B13), longest path / near-critical
  (fase 2.9), trace-logic-diagram als apart netwerkvenster (fase 3.6
  netwerkdiagram).
- Sub-dag-precisie in lag (engine is dag-granulair; uren/minuten = fase 2.8).

## 10. Uitvoeringsvolgorde

1. Datamodel + `updateSequence` + `resolveLag` + CPM (lead-randgevallen,
   unit, procent) — TDD op `tests/planning`.
2. Driving-berekening in solver + `CPMResult` — TDD.
3. IFC-writer/reader conformant + legacy + procent/unit round-trip.
4. Adapters (CSV/MSPDI/P6).
5. UI: relatie-editing in TaskPropertiesPanel; Relaties-ribbontab +
   RelationsPanel; renderer (driving-stijlen).
6. Path tracing (helper + ui-state + renderer + bediening).
7. Zelftest (Playwright + `window.__OPS__`), i18n-strings alle 14 locales
   (en verplicht, rest vertaald), docs (TODO/CHANGELOG/dit doc), commits.
