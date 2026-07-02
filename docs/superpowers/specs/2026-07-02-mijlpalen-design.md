# Ontwerp: Fase 2.4 — Mijlpalen

*Datum: 2026-07-02 · Status: **in uitvoering** · Bron: [docs/TODO.md](../../TODO.md) §2.4, PLAN.md §2.4 (regels 1002-1006) + §8.2 (mijlpaalkleur `#7C3AED`, diamant)*

Gebaseerd op twee onderzoekssporen: code-audit (huidige milestone-implementatie
end-to-end) en vakstandaard-research (Oracle P6 start/finish-milestones, MSP
Milestone/Deadline, DCMA, NEC Key Dates, IFC 4.3, MTA-rapportage).

## 1. Kernbeslissingen

- **Grens-model, dag-granulair.** P6 onderscheidt start- en finish-milestones
  via tijdstippen (08:00/17:00). Dag-granulair vertaald: elke dag heeft een
  *begin*- en een *eind*-grens; einde van werkdag F = begin van de
  eerstvolgende werkdag. Een **startmijlpaal** ankert op een dagbegin, een
  **eindmijlpaal** op een dageinde; het daglabel volgt het geankerde moment.
- **De bestaande solver is al het grens-model met een automatisch anker.**
  Een mijlpaal-opvolger landt nu via FS/SS op de startzijde (FS: werkdag ná
  voorganger-finish; SS: zelfde dag als voorganger-start) en via FF/SF op de
  finishzijde (FF: zelfde dag als voorganger-finish). Dat is theoretisch
  correct: FS/SS binden de start van de opvolger, FF/SF de finish — met
  `es == ef` volgt het label de gebonden zijde. Daarom:
  **`milestoneKind?: 'START' | 'FINISH'` met `undefined` = automatisch**
  (legacy-gedrag). Bestaande bestanden en alle 176 bestaande cases veranderen
  **niet**; expliciete soorten zijn opt-in.
- **Expliciete soorten wijken maar op vier punten af van automatisch** (alle
  overige combinaties zijn identiek; lag telt gewoon op de grens door):
  - als **opvolger**: `FF → startmijlpaal` = werkdag ná voorganger-finish
    (auto: zelfde dag); `FS → eindmijlpaal` = zelfde dag als
    voorganger-finish (auto: werkdag erna).
  - als **voorganger**: vanaf een **eindmijlpaal** (dag M) start een
    FS/SS-opvolger de werkdag ná M (auto/startmijlpaal: op dag M zelf).
  - Daglabels worden pragmatisch geklemd op de dag van het sturende moment
    (geen "einde van dag S−1"-labels): eindmijlpaal via SS/SF = dag S.
- **Gouden invariant** (regressie-case): een mijlpaal verbruikt nooit een
  werkdag — A —FS→ mijlpaal —FS→ B geeft B dezelfde datums als A —FS→ B,
  voor béíde soorten (eindmijlpaal op dag F, startmijlpaal op dag F+1).
- **Verplichte mijlpaal = markering + bestaande 2.3-bewaking, geen
  delete-blokkade.** Vakstandaard (P6-contractmijlpalen, NEC Key Dates):
  contractuele bewaking loopt via een *zachte* datum-constraint — de
  backward pass geeft negatieve float zodra de datum in gevaar komt. Dat
  mechanisme bestaat sinds 2.3. Nieuw veld `mandatory?: boolean` is een
  vlag voor rapportage/visualisatie; de datum bewaakt de gebruiker met
  FNLT/MFO of deadline (bestaand). Geen enkel groot pakket blokkeert
  verwijderen; wij ook niet.
- **Inspectiemoment** = eindmijlpaal + taaktype `ATTENDANCE`
  (= "Keuring/Inspectie") + `mandatory: true`, als één ribbon-actie. De
  gewone mijlpaal-knop stopt met `ATTENDANCE` als default (dat conflateerde
  elke mijlpaal met een keuring) en wordt `USERDEFINED`.
- **Mijlpalen-overzicht = tweede rapporttype in het Rapport-paneel** (naast
  de bestaande Gantt-afdruk): tabel met soort/datum/float/status/verplicht,
  afdrukbaar via de bestaande print-popup. Baseline-/variance-kolommen en
  Milestone Trend Analysis vereisen snapshots → fase 2.6.
- **MSP/P6-uitwisseling verliest het onderscheid deels bewust**: Oracle's
  eigen datamap stuurt beide P6-soorten naar hetzelfde MSP-vlag. Wij: P6-XML
  schrijft/leest `Start Milestone`/`Finish Milestone` uit `milestoneKind`
  (repareert de bestaande dode duur-gebaseerde tak); MSPDI houdt alleen
  `Milestone=1`; CSV alleen duur 0.

## 2. Datamodel

```ts
// types/task.ts
interface Task {
  …
  isMilestone: boolean;
  /** Soort mijlpaal (fase 2.4). undefined = automatisch: het anker volgt de
   *  bindende relatiezijde (FS/SS → start, FF/SF → finish) — legacy-gedrag. */
  milestoneKind?: 'START' | 'FINISH';
  /** Verplichte (contractuele) mijlpaal — NL: inspectie-/keurings-/opleverpunt.
   *  Alleen markering voor rapportage & Gantt; datumbewaking via constraint/deadline. */
  mandatory?: boolean;
}
```

`updateTask` dekt beide velden (undo/klembord/payloads liften mee). Bijvangst
uit de audit: het mijlpaal-vinkje in het eigenschappen-paneel zet de duur
niet op 0 en het duur-veld blijft bewerkbaar (TableEditor toont daardoor een
andere duur dan de canvas-tabel) — wordt meegerepareerd.

## 3. CPM (`CPMSolver`)

Helpers `predKind(task)`/`succKind(task)` → `'AUTO' | 'START' | 'FINISH'`.
In `getForwardConstraint`/`getBackwardConstraint`:

- opvolger-mijlpaal, expliciet START: FF-tak krijgt de werkdag-ná-variant
  (zoals FS nu); expliciet FINISH: FS-tak verliest de werkdag-ná-stap.
- voorganger-eindmijlpaal: FS/SS-takken behandelen de voorganger als een
  gewone taak die op dag M eindigt (dus opvolger start werkdag ná M);
  voorganger-startmijlpaal en AUTO = huidig gedrag.
- Elapsed-lag-takken gebruiken dezelfde basisdagen; procentlag: voorgangerduur
  van een mijlpaal is 0, dus geen wijziging.
- Backward pass is het spiegelbeeld (zelfde vier afwijkingen).

Nieuwe testbatterij `cases-milestone-kinds.json` (hand-berekend, BRIEF.md-
conventies): differentiële trio's AUTO/START/FINISH per relatietype, mijlpaal
als voorganger, de gouden invariant, ketens met lag, backward-float/driving
door mijlpalen heen, verplichte eindmijlpaal + FNLT → negatieve float
(bestaande 2.3-machinerie). Alle 176 bestaande cases moeten ongewijzigd
groen blijven (bewijs dat AUTO = legacy).

## 4. IFC 4.3

`IfcTask.IsMilestone` bestaat al (arg 8). `IfcTaskTypeEnum` kent géén
start/finish-onderscheid en geen verplicht-vlag → **`OPS_Milestone`-pset**
per taak, exact volgens het OPS_Constraints-patroon (template +
`IfcRelDefinesByProperties`): `MilestoneKind` (IfcLabel `START`/`FINISH`,
alleen indien expliciet gezet) en `Mandatory` (IfcBoolean, alleen indien
true). Reader herstelt beide velden. AUTO schrijft niets → oude bestanden
round-trippen bit-gelijk.

## 5. UI

- **TaskPropertiesPanel**: bij mijlpalen een dropdown *Soort mijlpaal*
  (Automatisch / Startmijlpaal / Eindmijlpaal) + vinkje *Verplicht
  (contractueel)*; mijlpaal-vinkje zet voortaan duur 0 en disabled het
  duur-veld (paritair met TaskDialog).
- **Ribbon (Start/Planning)**: de mijlpaal-knop wordt een split-knop met
  *Startmijlpaal* (default), *Eindmijlpaal*, *Inspectiemoment* (eindmijlpaal
  + ATTENDANCE + verplicht).
- **GanttRenderer**: eindmijlpalen tekenen op de dag-eindgrens
  (`dateToX(dag) + zoom` i.p.v. dagbegin); verplichte mijlpalen krijgen een
  dikkere rand + witte kern (dubbel-ruit-effect); gemist/geschonden blijft
  via de 2.3-indicatoren (rode pin) lopen. TableEditor toont duur `0` voor
  mijlpalen (read-only).
- **Rapport-paneel**: keuze *Gantt-afdruk* | *Mijlpalenoverzicht*. Het
  overzicht: tabel (WBS, naam, soort, datum, constraint-/deadline-datum,
  float, verplicht, status op-schema/kritiek/te-laat) + zelfde print-route.
  Statusafleiding: te laat = in violated/missed-sets of tf < 0; kritiek =
  tf ≤ 0; anders op schema.

## 6. Buiten scope (bewust)

Milestone Trend Analysis & baseline-variance (vereist snapshots → 2.6);
checklijsten bij inspectiemomenten (PLAN fase 3.2); delete-blokkade;
tijd-van-dag (blijft dag-granulair); kind-kolom in CSV.

## 7. Uitvoeringsvolgorde

1. Datamodel + harness (`milestoneKind`/`mandatory`) + `cases-milestone-kinds.json`
   (rood) → CPM-implementatie (groen; 176 bestaande cases ongewijzigd).
2. IFC-pset round-trip + headless verificatie; P6-XML-adapter.
3. UI (panel, ribbon-splitknop, renderer, tabel-fix, rapport) + i18n en+nl.
4. Zelftest (browser + screenshots), i18n 12 overige locales, docs.
