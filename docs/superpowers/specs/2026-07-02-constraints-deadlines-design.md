# Ontwerp: Fase 2.3 — Constraints & deadlines

*Datum: 2026-07-02 · Status: **geïmplementeerd** (zelfde dag; zie changelog) · Bron: [docs/TODO.md](../../TODO.md) §2.3, [PLAN.md](../../../PLAN.md) A12/A15/A16 + F10/F11*

Gebaseerd op twee onderzoekssporen: PLAN.md-intentie/codetouchpoints en
vakstandaard-semantiek (Oracle P6-help, MSP-documentatie, DCMA 14-punts, IFC 4.3).

## 1. Kernbeslissingen

- **Semantiek = P6-soft / "MSP zonder honor-optie"**: constraints verschuiven
  nooit logica-gedreven vroege datums naar achteren en breken nooit relaties.
  Vroege-zijde types (`SNET`/`FNET`) zijn ondergrenzen in de forward pass
  (`max()`); late-zijde types (`SNLT`/`FNLT`) zijn bovengrenzen in de backward
  pass (`min()`); overtreding uit zich als **negatieve float**, niet als
  verschoven balken.
- **MSO/MFO = P6 "Start On"/"Finish On" (soft)**: de datum werkt als onder- én
  bovengrens (SNET+SNLT resp. FNET+FNLT). De logica-brekende harde pin
  (P6 Mandatory, DCMA-ontraden, splitst het netwerk) is bewust **2.9**.
- **ALAP = P6-semantiek (zero free float)**: na beide passes schuiven de vroege
  datums van een ALAP-taak op met de eigen vrije speling (opvolgers bewegen per
  definitie niet). Niet MSP's totale-float-drainage.
- **Deadline is een apart, zacht veld** (MSP-model, aparte matrixrij A16):
  alleen een bovengrens op de late finish in de backward pass — balken bewegen
  nooit; overschrijding (`earlyFinish > deadline`) ⇒ negatieve float + indicator.
- **Negatieve float wordt gedeclampt**: `totalFloat` wordt getekend
  (`min(LF−EF, LS−ES)` in werkdagen, MSP-veilig bij SNLT), `isCritical`
  wordt `tf ≤ 0`, en de eindtaak-vrije-speling mag negatief. Zonder
  constraints/deadlines blijft alles ≥ 0 (backward cap = projectEnd ≥ alle
  early finishes), dus de 159 bestaande cases veranderen niet. DCMA-checks 5+7
  (harde constraints ≤ 5%, negatieve float = 0%) zijn het rapportagekader.
- **Constraint-datums snappen naar werkdagen** bij toepassing (voorkomt
  schijn-negatieve float à la P6 mandatory-op-weekend).
- Eén constraint per taak + één deadline (MSP-model); P6-secundaire
  constraints (vensters) zijn v2.

## 2. Datamodel

```ts
// types/task.ts
export type ConstraintType =
  | 'ASAP' | 'ALAP' | 'SNET' | 'SNLT' | 'FNET' | 'FNLT' | 'MSO' | 'MFO';

interface Task {
  …
  /** Datum-constraint (fase 2.3). ASAP = default (afwezig); date verplicht behalve bij ALAP. */
  constraint?: { type: ConstraintType; date?: string };
  /** Zachte deadline (MSP-model): beïnvloedt alleen late datums/float, nooit de balken. */
  deadline?: string;
}
```

Geen nieuwe store-acties nodig: `updateTask` dekt beide velden (undo/snapshot/
klembord/document-payloads liften automatisch mee via het Task-object).

## 3. CPM-wijzigingen (`CPMSolver`)

- **Forward pass**, na de relatie-max en vóór de werkdag-snap:
  `SNET|MSO`: `es = max(es, d)`; `FNET|MFO`: `es = max(es, d ⊖ (dur−1))`
  (finish-ondergrens naar start vertaald; milestones: `es = max(es, d)`).
  Geldt óók voor taken zonder voorgangers.
- **Backward pass**, na de bestaande `min(projectEnd, succ-constraints)`:
  `FNLT|MFO`: `lf = min(lf, d)`; `SNLT|MSO`: `lf = min(lf, d ⊕ (dur−1))`;
  `deadline`: `lf = min(lf, deadline)`.
- **Float**: nieuwe signed helper (`a≤b ? wdb−1 : −(wdb−1)`);
  `tf = min(signed(ef→lf), signed(es→ls))`; `isCritical = tf ≤ 0`;
  eindtaak-`ff = signed(ef→lf)` (declampt); relatie-ff blijft ≥ 0 door
  constructie.
- **ALAP** in `computeResults`: `es/ef += max(0, ff)` werkdagen, daarna `ff = 0`
  (alleen bij `ff > 0`).
- `CPMResult` krijgt `violatedConstraintTaskIds: string[]` en
  `missedDeadlineTaskIds: string[]` (earlyFinish/earlyStart voorbij de
  betreffende grens) voor statusbar/indicatoren — rekenresultaat, niet
  gepersisteerd.

## 4. IFC 4.3

`IfcTaskTime` heeft géén constraint-/deadline-slots (bevestigd tegen
buildingSMART-docs). Dragers: het bestaande OPS-pset-mechanisme —
`OPS_Constraints`-pset per taak met `ConstraintType` (IfcLabel),
`ConstraintDate` (IfcDate) en `Deadline` (IfcDate), via
`IfcRelDefinesByProperties`. De standaardconforme
`IfcRelAssociatesConstraint`/`IfcMetric`-graf (HARD/SOFT + benchmark-enums)
is gedocumenteerd alternatief voor later (geen tool round-tript hem in de
praktijk).

## 5. UI

- **TaskPropertiesPanel**: sectie *Constraint & deadline* — dropdown (ASAP
  default … MFO), datumveld (verborgen bij ASAP/ALAP), apart deadline-veld.
- **GanttRenderer** (F10/F11, constraint-kleur `#8B5CF6` uit PLAN §8.2):
  - constraint-pin op de balkrand: blauw voor vroege-zijde (SNET/FNET), violet
    voor late-zijde/pinnend (SNLT/FNLT/MSO/MFO), rood wanneer geschonden;
  - deadline: pijl-omlaag-marker op de deadline-datum, groen; rood + rand om de
    balk bij overschrijding (MSP-conventie);
  - negatieve float: kritiek-rood dekt tf ≤ 0 al; de float-strook wordt bij
    tf < 0 niet getekend.
- **TableEditor**: P6-asterisk (`*`) achter start-/finish-datums van taken met
  constraint; float-kolom toont negatieve waarden in rood.
- **StatusBar**: warning-teller "⚠ N deadline(s) overschreden · M neg. float"
  in `--theme-warning-text`, alleen zichtbaar bij > 0.

## 6. Buiten scope (bewust; grotendeels → 2.9)

Logica-brekende Mandatory-pins; P6-secundaire constraints/vensters;
scheduling-options (float-berekeningswijze, honor-toggle, retained logic /
progress override); Expected Finish; project-brede Must Finish By (kan later
als projectveld); tijd-van-dag-nuances (dag-granulair).

## 7. Uitvoeringsvolgorde

1. Datamodel + harness-uitbreiding (constraint/deadline per taak) + nieuwe
   casebatterij `cases-constraints.json` (rood) → CPM-implementatie (groen);
   volledige suite moet zonder wijzigingen groen blijven (declamp-bewijs).
2. IFC-pset round-trip + headless verificatie.
3. UI (panel, renderer-markers, tabel-asterisk/rode float, statusbar) + i18n
   en+nl.
4. Zelftest (browser + screenshots), i18n 12 locales, docs, release v2026.7.1.
