# Taaktypes, opgeslagen werk en effort-driven plannen — ontwerp

*Ontwerp, 2026-09-04. Opvolger van het voorstel
[`2026-08-18-spec-taaktypes-effort-driven.md`](2026-08-18-spec-taaktypes-effort-driven.md)
("ontwerp vóór bouw"). Status: **ontwerp, nog niet gebouwd.** Alleen documentatie; er is in deze
ronde geen code aangeraakt. De contour-engine, de contour-UI en de fasen-editor (2026-09) zijn
inmiddels geleverd en worden hier als bestaand fundament gebruikt.*

## 0. Leeswijzer

Elke bewering in dit document draagt één van deze labels, zodat een bouwer ziet waar hij op kan
leunen en waar niet:

| label | betekenis |
|---|---|
| **ZEKER** | staat letterlijk in de documentatie van Microsoft of Oracle (bron in §13), of in onze eigen code |
| **GEMETEN** | geteld op een corpus (het XER-corpus van de XER-sessie, §11) |
| **AFGELEID** | volgt met een korte redenering uit ZEKER/GEMETEN feiten; de redenering staat erbij |
| **BEREDENEERD** | ontwerpkeuze zonder bron; de meetlat (§9) moet dit later tegen MS Project toetsen |
| **ONBEKEND** | niet gevonden in documentatie en niet gemeten; expliciet open |
| **BESLOTEN** | eigenaarsbesluit (§3) |

De eigenaar vroeg om "beredeneren + grondig onderzoek in de documentatie van MS Project en P6" als
bewijs, omdat er niemand met MS Project beschikbaar is om te meten (besluit 4). Dat is de reden dat
§2 zo uitgebreid is en dat §9 een concrete lijst bewerkingen bevat die een latere meting kan
afwerken.

## 1. Waar dit over gaat

Eén rekensom: **werk = duur × inzet.** Ken je er twee, dan ligt de derde vast. Het karakter van een
planningspakket wordt bepaald door de vraag welke van de drie *beschermd* is wanneer de gebruiker
aan een van de andere twee draait.

Open Planner Studio beschermt vandaag altijd duur en inzet: dat zijn de opgeslagen velden
(`scheduleDuration`/`durationMinutes` op de taak, `unitsPerDay` op de toewijzing), en werk wordt er
elke keer uit afgeleid — "werk = duur × unitsPerDay, altijd afgeleid, nooit opgeslagen" staat
letterlijk in `src/types/resource.ts` (ZEKER). In de terminologie van P6 is dat **Fixed Duration &
Units/Time**; in die van MS Project **Fixed Duration, niet effort-driven** (AFGELEID uit de tabellen
in §2.1 en §2.2: bij een duurwijziging beweegt het werk mee, bij een inzetwijziging beweegt het werk
mee, een resource erbij voegt werk toe).

Deze etappe maakt die keuze per taak instelbaar en maakt werk een echte, opgeslagen grootheid. De
kernregels uit het voorstel van 2026-08-18 blijven staan: standaard verandert er niets; de
aan-knop stuurt alleen de weergave en nooit de berekening; de semantiek zit in het document.

## 2. Wat MS Project en P6 doen

### 2.1 MS Project

**De drie taaktypes en de rekentabel** (ZEKER, bron [M1], [M4]):

| taaktype | inzet gewijzigd | duur gewijzigd | werk gewijzigd |
|---|---|---|---|
| Fixed Units | duur herberekend | werk herberekend | duur herberekend |
| Fixed Work | duur herberekend | inzet herberekend | duur herberekend |
| Fixed Duration | werk herberekend | werk herberekend | inzet herberekend |

**Standaardtype** is Fixed Units (ZEKER, [M4]: "Fixed Units (default)"); de gebruiker kan dat in de
projectopties wijzigen.

**Effort-driven** (ZEKER, [M2], [M3]):

- Effort-driven gaat uitsluitend over het **toevoegen of verwijderen van resources**: "Project
  lengthens or shortens the duration of the task based on the number of resources that are assigned
  to it, but Project does not change the total work for the task." Bij Fixed Units verkort een
  resource erbij de duur; bij Fixed Duration daalt de inzet van elke resource.
- Effort-driven werkt pas **ná de eerste toewijzing**: "When assigning multiple resources
  simultaneously to a task, the duration doesn't change from your original estimate." De eerste
  toewijzing(en) zetten het werk; daarna houdt effort-driven dat werk vast.
- **Fixed Work is altijd effort-driven** en dat vinkje is daar niet te wijzigen: "Project doesn't
  consider fixed work tasks to have flexible work values and are therefore always effort-driven."
- Samenvattingstaken en ingevoegde projecten kunnen niet effort-driven zijn.
- Standaardwaarde van het vinkje voor nieuwe taken: de Microsoft-artikelen die ik vond noemen alleen
  dát er een optie "New tasks are effort driven" bestaat, niet wat hij standaard is ([M2], [M3]).
  Secundaire bronnen (trainingsmateriaal, [M9]) zeggen "standaard uit" voor 2010/2013/2016. Ik
  markeer dit als **AFGELEID uit secundaire bron**, niet ZEKER.

**Werk, verricht werk en restwerk** (ZEKER, [M5], [M6], [M7], [M8]):

- Taakwerk = som van het werk van alle toewijzingen. Toewijzingswerk = spanne × inzet
  ("The span of an assignment is multiplied by the assignment units to calculate the amount of
  work": 100 % op één dag = 8 uur, 50 % = 4 uur, 200 % = 16 uur).
- Restwerk = werk − verricht werk; restduur = duur − verrichte duur. Wie de restduur wijzigt, houdt de
  verrichte duur vast en verandert de totale duur ("Project changes duration to match the sum of
  the remaining duration and actual duration and leaves the actual duration unchanged").
- Wie taakwerk of verricht werk op taakniveau invoert, laat Project dat "onder de toegewezen
  resources verdelen"; **hoe** die verdeling gaat (evenredig aan inzet? aan bestaand werk?) staat er
  niet bij — ONBEKEND. Voor tijdgefaseerde invoer zegt [M7] wel "in the same proportion of work
  scheduled for each assigned resource at that point in time".
- Wat een wijziging van de *totale* duur op een lopende taak met verrichte duur doet, staat niet
  letterlijk in [M6]/[M8]. AFGELEID: verricht werk en verrichte duur zijn feiten die geen enkele
  formule in de artikelen aanpast; de enige velden die de formules laten bewegen zijn duur, restduur,
  restwerk en % gereed. Dit is precies de vraag die aan het eind van het vorige gesprek open bleef
  ("houdt MS Project het rest- of het totaalwerk vast bij een duurwijziging op een lopende
  Fixed-Work-taak"): documentatie geeft er geen uitsluitsel over; §5 kiest "de driehoek werkt op het
  restant" en §9 (meting 16–18) legt dat vast als te toetsen.

### 2.2 Primavera P6

**De vier duration types en hun formules** (ZEKER, [P1], [P2]):

| duration type | wat vastligt | formule uit de documentatie |
|---|---|---|
| Fixed Duration & Units/Time | duur en inzet per tijdseenheid | Remaining Units = Units/Time × Remaining Duration |
| Fixed Duration & Units | duur en totaal werk | Units/Time = Remaining Units / Remaining Duration |
| Fixed Units/Time | inzet per tijdseenheid | Duration = Units / (Units/Time) |
| Fixed Units | totaal werk | idem |

Let op de woorden in de formules: **Remaining** Units en **Remaining** Duration. P6 rekent de
driehoek op het resterende deel, niet op het totaal (ZEKER, [P2]). Dat is de bron van de keuze in §5.

**De synchronisatietabel** (ZEKER, [P3] — Oracle's eigen overzicht van wat er per type verandert):

| duration type | inzet (units) gewijzigd | duur gewijzigd | inzet/tijd gewijzigd | resource erbij zonder werk | extra resource erbij |
|---|---|---|---|---|---|
| Fixed Units/Time | duur | werk | duur | werk | duur |
| Fixed Duration & Units/Time | inzet/tijd | werk | werk | werk | werk |
| Fixed Units | duur | inzet/tijd | duur | werk | duur |
| Fixed Duration & Units | inzet/tijd | inzet/tijd | werk | werk | inzet/tijd van elke resource |

(In P6-termen: "Units" = totaal werk in uren, "Units/Time" = inzet per tijdseenheid. Ik schrijf hier
werk en inzet/tijd om verwarring met OPS' `unitsPerDay` te voorkomen.)

**Overige P6-regels** (ZEKER):

- Het duration type doet pas iets zodra er minstens één resource op de activiteit staat ([P2]:
  "Duration type applies only when at least one resource is assigned to the activity").
- Bij Start- en Finish-mijlpalen is het veld uitgeschakeld ([P1]).
- Projectoptie bij het toevoegen van resources ([P4]): "Preserve the units, duration, and units/time
  for existing assignments" óf "Recalculate … based on the activity's duration type". De laatste
  kolom van de synchronisatietabel geldt dus alleen bij de tweede instelling.
- Projectoptie bij actuals ([P5]): "Add actual to remaining" (At Completion = Remaining + Actual) óf
  "Subtract actual from at completion" (Remaining = At Completion − Actual). Verricht werk is in beide
  varianten een invoer die door niets anders wordt herschreven.
- Standaard duration type voor nieuwe activiteiten: niet gevonden in de geraadpleegde pagina's —
  ONBEKEND uit documentatie. GEMETEN (§11): 89 % van de activiteiten in het XER-corpus staat op
  `DT_FixedDUR2` (Fixed Duration & Units).

### 2.3 Waar ze verschillen — en de consequentie voor besluit 1

Zet je de tabellen van §2.1 en §2.2 naast elkaar, dan zijn drie MS Project-combinaties exact gelijk
aan een P6-type, en twee niet (AFGELEID, cel voor cel uit [M1] en [P3]):

| MS Project | P6 | overeenkomst |
|---|---|---|
| Fixed Units, effort-driven | Fixed Units/Time | alle vijf kolommen gelijk |
| Fixed Work (altijd effort-driven) | Fixed Units | alle vijf kolommen gelijk |
| Fixed Duration, niet effort-driven | Fixed Duration & Units/Time | alle vijf kolommen gelijk |
| Fixed Duration, effort-driven | Fixed Duration & Units | **verschil bij duur gewijzigd**: MSP herberekent werk ([M1], rij Fixed Duration), P6 herberekent inzet/tijd ([P3]) |
| Fixed Units, niet effort-driven | — | **geen P6-tegenhanger**: bij resource erbij groeit het werk en blijft de duur; alle vier P6-types die de inzet vastzetten verkorten de duur |

Besluit 1 (menukaart = de vier P6-types, geen los vinkje) dekt dus drie van de vijf
MS Project-gedragingen exact. De twee andere zijn geen exotische gevallen: "Fixed Units, niet
effort-driven" is de fabrieksinstelling van MS Project (Fixed Units is ZEKER standaard, het vinkje
staat volgens secundaire bronnen standaard uit), dus vermoedelijk het meest voorkomende type in
.mpp-bestanden — GEMETEN is dat niet (het .mpp-fidelity-corpus is hier niet beschikbaar; een telling
van `mspTaskType × effortDriven` over de `OPS_MPP_CRAWL`-set is in §12 als TODO opgenomen).

Dit is een nieuw feit ten opzichte van het gesprek van 2026-09-04 en vraagt om een aanvulling op
besluit 1. Het staat in §3 als **beslispunt 8** met drie opties en een advies; de bouwvolgorde (§10)
zet het gedrag "resource erbij/eraf" bewust als aparte, late stap zodat de rest niet wacht.

## 3. Besluiten

### 3.1 Al vastgelegd (2026-08-18, voorstel + eigenaarsbesluit in het mpp-plan)

1. De volledige motor komt er, **opt-in**; standaard blijft alles zoals nu.
2. De knop stuurt **alleen de weergave, nooit de berekening**; taaktypes zijn documentdata.
3. Een bestand met taaktypedata **ontsluit de weergave automatisch** voor dat document, met melding.
4. Het **eigenschappenpaneel** krijgt de instelling; een tabelkolom mag mee zodra het kolommensysteem
   dat draagt (de tabelrevisie van 2026-08-24 bestaat inmiddels — ZEKER, `taskColumnRegistry.ts`).
5. Semantiek werkt **alleen op bewerkingen**, nooit bij het openen/herberekenen van een bestand
   (anders verschuiven de gepinde importdatums).
6. Import **bewaart** MSP's velden (gedaan: `Task.mspTaskType`, `Task.effortDriven`, pset
   `OPS_MspTaskType`; alleen de `.mpp`-lezer vult ze — ZEKER, `mppReader.ts`; de MSPDI-lezer leest
   `<Type>`/`<EffortDriven>` op taakniveau vandaag **niet**, ZEKER, `mspdiReader.ts`).
7. De **contour-engine** hoort bij deze etappe (gedaan, 2026-09).
8. **Hele-eenheden-afronding** alleen op het formulepad, nooit op opgeslagen dagwaarden (gedaan).
9. Het interne model is **neutraal** tussen MSP en P6 (superset).
10. De **bewerken-meetlat** wordt vóór de motorbouw ontworpen (→ §9).
11. Geen tijdstip; geen gebruikersvraag die dit voorrang geeft.

### 3.2 Genomen op 2026-09-04

| nr | besluit |
|---|---|
| 1 | Menukaart = **P6-vorm: vier types, geen los effort-driven-vinkje**; intern een superset die MSP dekt (zie beslispunt 8 voor de twee gevallen die niet passen). |
| 2 | **Een typewissel verandert geen enkel getal**; alleen welke hoek voortaan beschermd is. Bij wissel naar een type dat werk beschermt wordt het huidige werk vastgelegd zoals het is. |
| 3 | Resource toevoegen op een gecontoureerde taak met vast werk: **vorm blijft, hoogte zakt evenredig; de nieuwe resource is vlak; de duur wordt korter.** "Volg MS Project, meting bepaalt details." |
| 4 | Bewijs = **beredeneren + grondig documentatieonderzoek**, elke detailregel expliciet; meting tegen MSP zelf in de TODO met een bewerkingenlijst. |
| 5 | **Aan-knop = app-instelling** ("Toon taaktypes"), plus automatische ontsluiting per document (3.1-3). |
| 6 | Reikwijdte: **alleen gewone bladtaken op werktijd, en uurtaken.** |
| 7 | **Nivelleerder blijft alleen verschuiven**; "inzet verlagen bij vast werk" komt in de TODO als geavanceerde optie. |

### 3.3 Open — nog door de eigenaar te nemen

**Beslispunt 8 — de twee MS Project-gedragingen die niet in de vier P6-types passen (§2.3).**

| optie | wat het betekent | gevolg |
|---|---|---|
| A. Vier types, punt | Een MSP-taak "Fixed Units, niet effort-driven" wordt Fixed Units/Time en "Fixed Duration, effort-driven" wordt Fixed Duration & Units. | Eenvoudigst. Maar een geïmporteerde MSP-standaardtaak krijgt na "resource erbij" een kortere duur waar MSP de duur zou laten staan, en een effort-driven Fixed-Duration-taak houdt bij een duurwijziging het werk vast waar MSP het werk laat meegroeien. Dat is de "onverwacht verschuivende planning" die de UX-opgave juist wil vermijden. |
| B. Vier types in het menu, `effortDriven` blijft bewaarde invoer die alleen de afwijkende kolommen stuurt **(advies)** | Het bestaande veld `Task.effortDriven` blijft staan zoals het nu al round-tript. De regeltabel (§5) leest het op precies de twee cellen waar MSP afwijkt: Fixed Units/Time + `effortDriven === false` ⇒ resource erbij/eraf verandert werk in plaats van duur; Fixed Duration & Units + `effortDriven === true` ⇒ duur gewijzigd verandert werk in plaats van inzet. Taken die de gebruiker in OPS aanmaakt krijgen het veld nooit en volgen zuiver P6. | Het menu blijft vier keuzes (besluit 1 intact), MSP-bestanden gedragen zich als in MSP, en de afwijking is zichtbaar te maken als bijschrift ("uit MS Project: niet effort-driven") in plaats van als vinkje. Kost één extra rij in de regeltabel en twee testgevallen. |
| C. Zes types | Het menu toont de volledige unie (vier P6 + twee MSP). | Volledig, maar precies de "MSP-verwarring" die de eigenaar niet wil importeren; verworpen door besluit 1. |

Zolang dit punt open staat, bouwt de etappe stap 1–5 van §10 zonder het te raken; stap 6 (resource
erbij/eraf) is de eerste plek waar het antwoord nodig is.

**Beslispunt 9 — drie optionele werkvelden per toewijzing (§4.3).** Aanbeveling uit de corpusscan
(GEMETEN: het resttarief `remain_qty_per_hr` wijkt in vijf bestanden structureel af van het
begrote tarief, tot 100 % van de rijen), uitgelegd aan de eigenaar op 2026-09-04 met het
metselwerkvoorbeeld (160 uur begroot, 80 verricht, 120 resterend). Geen bezwaar geuit, maar ook
geen expliciet akkoord. Dit ontwerp gaat uit van de drie velden.

**Beslispunt 10 — meerdere toewijzingen en de taakduur (§6.2).** OPS kent geen duur per toewijzing;
het ontwerp kiest de vereenvoudiging "elke toewijzing loopt over de hele restduur van de taak" en
legt de per-toewijzing-spanne in de TODO. Dat wijkt af van MSP en P6, waar toewijzingen een eigen
spanne hebben. Bevestiging gevraagd.

## 4. Datamodel

### 4.1 De werkregel per taak

Een nieuw optioneel taakveld, neutraal genoemd zodat het niet met `taskType` (OPS-domeinklasse),
`mspTaskType` (MSP-import) of `durationType` (WORKTIME/ELAPSEDTIME) botst:

```ts
/** Welke hoeken van werk = duur × inzet beschermd zijn bij een BEWERKING (taaktypes-etappe).
 *  Afwezig ⇒ de projectstandaard (`Project.defaultWorkRule`), en als die ook ontbreekt
 *  FIXED_DURATION_RATE — het gedrag van vandaag, byte-identiek. Geen enkele solverstap leest dit
 *  veld; het werkt uitsluitend in de bewerkingslaag (§5). */
export type WorkRule =
  | 'FIXED_DURATION_RATE'   // P6 Fixed Duration & Units/Time · MSP Fixed Duration, niet effort-driven · vandaag
  | 'FIXED_DURATION_WORK'   // P6 Fixed Duration & Units      · MSP Fixed Duration, effort-driven (zie beslispunt 8)
  | 'FIXED_WORK'            // P6 Fixed Units                 · MSP Fixed Work
  | 'FIXED_RATE';           // P6 Fixed Units/Time            · MSP Fixed Units, effort-driven (zie beslispunt 8)
```

Gebruikersnamen (nl): *Vaste duur en inzet*, *Vaste duur en werk*, *Vast werk*, *Vaste inzet*. Elk
met een bijschrift van één zin in het paneel ("Bij een duurwijziging beweegt het werk mee" enz.).

"Rate" staat voor `unitsPerDay` (inzet per werkdag), P6's units/time. Ik vermijd "units" omdat P6
er totaal werk mee bedoelt en MSP inzet — precies de verwarring die het neutrale model moet
wegnemen.

`Project.defaultWorkRule?: WorkRule` is de projectstandaard (het "taaktype als projecteigenschap"
uit het eigenaarsbesluit van 2026-08-18). Nieuwe taken krijgen **geen** eigen veld; ze volgen de
projectstandaard totdat de gebruiker per taak kiest. Afwezig ⇒ FIXED_DURATION_RATE.

Beide velden horen in `DOCUMENT_FIELDS` (documentcontract) — anders overleven ze geen documentwissel,
undo of crashherstel (ZEKER, `documentContract.ts`).

### 4.2 Vertaling van de importvelden

De bestaande importvelden blijven **onaangeraakt** staan (het `manuallyScheduled`-precedent O3: één
klasse taakvelden, altijd round-trip). De werkregel wordt er bij import uit **afgeleid en apart
opgeslagen**, zodat een latere typewissel de herkomst niet vernietigt:

| bron | invoer | `workRule` |
|---|---|---|
| MSP (.mpp, MSPDI) | Fixed Units + effort-driven | FIXED_RATE |
| | Fixed Units, niet effort-driven | FIXED_RATE **+ `effortDriven: false` blijft staan** (beslispunt 8) |
| | Fixed Duration, niet effort-driven | FIXED_DURATION_RATE |
| | Fixed Duration + effort-driven | FIXED_DURATION_WORK **+ `effortDriven: true` blijft staan** (beslispunt 8) |
| | Fixed Work | FIXED_WORK |
| P6 XML | `DurationType` = Fixed Duration and Units/Time | FIXED_DURATION_RATE |
| | Fixed Duration and Units | FIXED_DURATION_WORK |
| | Fixed Units | FIXED_WORK |
| | Fixed Units/Time | FIXED_RATE |
| XER (XER-branch) | `DT_FixedDrtn` | FIXED_DURATION_RATE |
| | `DT_FixedDUR2` | FIXED_DURATION_WORK |
| | `DT_FixedQty` | FIXED_WORK |
| | `DT_FixedRate` | FIXED_RATE |
| | `DT_FixedDUR` (niet-standaard, 24 activiteiten in p6difftool-fixtures, GEMETEN) | **geen** werkregel; token blijft rauw bewaard in `p6DurationType`; één waarschuwing. Niet raden. |

De exacte tekenreeksen van P6 XML's `<DurationType>` zijn hier niet tegen het PMXML-schema
gecontroleerd — te verifiëren tegen MPXJ's `DurationTypeHelper` bij de bouw (ONBEKEND tot dan).
De XER-tokens komen van de XER-sessie (ZEKER voor hun branch). De MSPDI-codes `<Type>` 0/1/2 =
Fixed Units/Fixed Duration/Fixed Work volgen dezelfde volgorde als `mppReader.ts`'s
`MSP_TASK_TYPE_VALUES` (ZEKER).

Omgekeerd bij export: `workRule` → MSPDI `<Type>` + `<EffortDriven>` volgens dezelfde tabel, waarbij
een bewaard `effortDriven` wint; P6 XML `<DurationType>` 1-op-1 (een MSP-afwijking uit beslispunt 8
gaat daar verloren — één waarschuwing, zoals de ELAPSEDTIME-waarschuwing in de CSV-export); XER
schrijft de app niet.

### 4.3 Werk per toewijzing: drie optionele velden

```ts
export interface ResourceAssignment {
  // … bestaande velden …
  /** OPTIONEEL — begroot werk in minuten (MSP Work / P6 Planned Units / XER target_qty). */
  plannedWorkMinutes?: number;
  /** OPTIONEEL — verricht werk in minuten (MSP Actual Work / P6 Actual Units / XER act_reg_qty + act_ot_qty). */
  actualWorkMinutes?: number;
  /** OPTIONEEL — resterend werk in minuten (MSP Remaining Work / P6 Remaining Units / XER remain_qty). */
  remainingWorkMinutes?: number;
}
```

**De regel "afwezig ⇒ afgeleid zoals nu":**

| veld | afwezig ⇒ | wanneer geschreven |
|---|---|---|
| `remainingWorkMinutes` | restduur van de taak (werkdagen × `hoursPerDay × 60`, of `remainingMinutes` in uurmodus) × `unitsPerDay`; met een contour: de som van de `remaining`-periodes | (a) door een bewerking onder een werkbeschermende regel (§5), (b) bij een expliciete werkinvoer van de gebruiker, (c) bij import wanneer de bron een waarde levert die van de afleiding afwijkt |
| `actualWorkMinutes` | som van de `actual`-periodes van de contour; zonder contour 0 | (b), (c); nooit door een planningsbewerking (verricht werk is een feit) |
| `plannedWorkMinutes` | `actual + remaining` | (b), (c), en bij een typewissel naar een werkbeschermende regel (besluit 2: "vastleggen zoals het is") |

Waarom drie en niet één (AFGELEID uit §11): in het XER-corpus wijkt het resttarief structureel af
van het begrote tarief (rehab-2: 14.459 van 52.640 toewijzingen; DCP-03 As-Built 47/47; Baseline
45/45). Met één werkveld zou "wat was begroot" verloren gaan zodra het restant wordt herschat, en
dat is precies het getal waar een planner later op wordt afgerekend. De driehoek werkt op het
**resterende** deel (P6: ZEKER, de formules in §2.2 gebruiken Remaining; MSP: AFGELEID, §2.1);
`plannedWorkMinutes` is referentie en wordt door de driehoek nooit herschreven.

**Waar de tijdgefaseerde contour zich toe verhoudt.** De contour (`Task.timephasedContours`) is de
*vorm*, de werkvelden zijn de *totalen*. Regel: staan ze allebei, dan moet de som van de
`remaining`-periodes gelijk zijn aan `remainingWorkMinutes` (idem actual). Een bewerking die het
restwerk wijzigt herschaalt de contour proportioneel (de bestaande `rescaleContourForDuration`, met
`keepWork` voor de werkbeschermende regels — ZEKER dat die parameter al bestaat, nu gestuurd door
`mspTaskType === 'FIXED_WORK'`; hij gaat de werkregel lezen). Wijkt de som bij import af van het veld
(bron inconsistent), dan winnen de velden voor de totalen en wordt de contour bij de eerste
bewerking op de velden herschaald — nooit bij het openen (3.1-5). BEREDENEERD.

**Materiaalresources** vallen buiten de driehoek: hun "werk" is een hoeveelheid (P6 Unit of
Measure, MSP Material Label — ZEKER `Resource.unitOfMeasure`), geen tijd. Alleen LABOR, EQUIPMENT,
CREW en SUBCONTRACTOR sturen de duur. BEREDENEERD; MSP's tabel spreekt alleen over work resources.

### 4.4 Round-trips

| kanaal | taak | toewijzing | opmerking |
|---|---|---|---|
| **IFC** (native) | nieuwe pset `OPS_WorkRule` (property `WorkRule`, IFCLABEL) naast het bestaande `OPS_MspTaskType`; `Project.defaultWorkRule` in `OPS_SchedulingOptions` | JSON-pset `OPS_AssignmentWork` per taak (zelfde `writeTimephasedMeta`-vorm als `OPS_Timephased`, per toewijzing via `resourceId`, door `remapContourResourceIds`-achtige guid-remap) | route: `docs/ifc-round-trip.md` — writer, reader, fixture én canon-tabel in `check-ifc-roundtrip`; de laatste twee zijn compile-afgedwongen |
| **MSPDI** | `<Type>`, `<EffortDriven>` (nu niet gelezen — ZEKER) | `<Work>`, `<ActualWork>`, `<RemainingWork>` op `<Assignment>` én de sommen op `<Task>` | de writer schrijft `<Work>` vandaag al afgeleid (ZEKER, regel 652); wordt: veld als aanwezig, anders afgeleid |
| **P6 XML** | `<DurationType>` | `<PlannedUnits>`, `<ActualUnits>`, `<RemainingUnits>` (uren) en `<AtCompletionUnits>` = actual + remaining | lezer/writer lezen/schrijven nu alleen `PlannedUnitsPerTime` (ZEKER) |
| **XER** (alleen lezen, XER-branch) | `TASK.duration_type` → `p6DurationType` (bestaat) + `workRule` (nieuw) | `TASKRSRC.target_qty`, `act_reg_qty + act_ot_qty`, `remain_qty` → de drie velden — **alleen wanneer `target_qty` afwijkt van duur × `target_qty_per_hr`** (afspraak met de XER-sessie); tot dan blijft alles in het bronarchief `OPS_XerSourceArchive` | GEMETEN: 176 van 61.618 rijen wijken >1 % af; 263 rijen hebben werk zonder tarief |
| **CSV** | geen kolom (CSV kent geen toewijzingen — ZEKER, `csvWriter.ts` negeert `_assignments`) | — | bewust buiten scope |
| **MCP** | leestools tonen `workRule`/velden; `planner_update_task` krijgt `workRule`; werkinvoer per toewijzing via `planner_update_assignment` (bestaand contract uitbreiden) | | route: `docs/recepten/mcp-tool.md`; `cases-toolregistry.ts` vangt een vergeten registratie |
| **Extensies** | `ExtTask.workRule` alleen-lezen erbij (zoals `mspTaskType` er nu al staat — ZEKER `extTypes.ts`) | | |

## 5. De regeltabel

Symbolen: **R** = resterende duur van de taak (werkdagen, of minuten in uurmodus), **I** = inzet
per werkdag van een toewijzing (`unitsPerDay`), **W** = resterend werk van die toewijzing.
Verricht werk en verrichte duur staan in geen enkele cel: ze zijn feiten (§2.1, §2.2 — P6 ZEKER,
MSP AFGELEID). Alles hieronder werkt op het restant.

| bewerking | FIXED_DURATION_RATE (vandaag) | FIXED_DURATION_WORK | FIXED_WORK | FIXED_RATE |
|---|---|---|---|---|
| **R gewijzigd** | W = R × I | I = W / R | I = W / R | W = R × I |
| **I gewijzigd** | W = R × I | W = R × I | R = W / I | R = W / I |
| **W gewijzigd** | I = W / R | I = W / R | R = W / I | R = W / I |
| **resource erbij** (met inzet I_n) | nieuwe W_n = R × I_n; rest ongemoeid | totaal W blijft; verdeeld naar rato van inzet; elke I_i = W_i / R | totaal W blijft; verdeeld naar rato van inzet; R = W / ΣI | R = W / ΣI (werk blijft); **bij bewaard `effortDriven: false`: als FIXED_DURATION_RATE** (beslispunt 8-B) |
| **resource eraf** | W_n vervalt; rest ongemoeid | totaal W blijft; opnieuw verdeeld; I_i = W_i / R | totaal W blijft; R = W / ΣI | R = W / ΣI; **bij `effortDriven: false`: W_n vervalt, R blijft** |
| **typewissel** | geen getal verandert (besluit 2) | idem + W vastleggen | idem + W vastleggen | geen getal verandert |
| **R gewijzigd, bewaard `effortDriven: true`** | — | **W = R × I** (MSP Fixed Duration + effort-driven, beslispunt 8-B) | — | — |

Bronnen per kolom: FIXED_DURATION_RATE en FIXED_RATE en FIXED_WORK: rijen 1–3 ZEKER ([M1] en
[P3] stemmen overeen), rij 4–5 ZEKER uit [P3]'s laatste kolom en [M2]. FIXED_DURATION_WORK: rij 1
ZEKER uit [P3] (P6-lezing; de MSP-lezing staat in de laatste rij), rij 2–3 ZEKER, rij 4–5 ZEKER
([P3]: "Units/Time of each resource"; [M2]: "decreases individual resource unit values").
**De verdeelsleutel** bij "totaal W blijft; verdeeld" is in geen van beide documentaties benoemd
(ONBEKEND); het ontwerp kiest *naar rato van inzet* (BEREDENEERD: bij twee gelijke resources levert
het de helft-helft-uitkomst die beide handleidingen als voorbeeld geven; §9 meting 10 en 15 toetsen
het).

"Resource erbij" op een taak **zonder** toewijzingen: de nieuwe toewijzing krijgt W = R × I; geen
enkele regel wordt toegepast (P6 ZEKER: het type doet pas iets vanaf één resource; MSP ZEKER: de
eerste toewijzing zet het werk).

## 6. Detailregels

### 6.1 Afronding

- Werk wordt in **minuten** opgeslagen, als getal; geen afronding op hele dagen of hele uren
  (besluit 4 en het contour-precedent: een fractie is data). Weergave rondt op twee decimalen uur.
- **Dagtaken** hebben een hele-dagen-invariant (`scheduleDuration` is een geheel aantal werkdagen —
  ZEKER, `TaskTime`-docblok). Levert een regel R = W / I een fractie op, dan wordt R **naar boven op
  hele dagen** afgerond en blijft W exact staan; de laatste dag is dan niet vol. Dat vraagt één
  aanpassing in `assignmentDayUnits` (ResourceLoad.ts): een vierde bron vóór de formule — is
  `remainingWorkMinutes` aanwezig, dan is het te verdelen totaal dát getal en niet
  `unitsPerDay × durationDays`. Zonder die aanpassing toont het histogram op zo'n taak te veel werk.
  BEREDENEERD; MSP staat fractionele dagen toe (0,5 d) en heeft dit probleem niet.
- **Uurtaken**: R in hele minuten, naar boven; W exact.
- I wordt op twee decimalen opgeslagen zoals nu in de UI (ZEKER `isValidUnits`-guard: > 0).

### 6.2 Meerdere toewijzingen

OPS kent geen duur per toewijzing: elke toewijzing loopt over de hele taakduur (ZEKER, het
datamodel; `workWindowStart/Finish` bestaat maar is ongebruikt). Regel in deze etappe (beslispunt
10): **R van de taak = max over de werkresources van W_i / I_i**, en elke toewijzing loopt over die
R. Gevolg: wijzigt de gebruiker I van één toewijzing op een FIXED_WORK-taak, dan verandert R via die
toewijzing en krijgen de andere toewijzingen I_j = W_j / R (hun werk blijft, dunner gespreid). MSP
en P6 laten de andere toewijzingen hun eigen kortere spanne houden. Dit is een bewuste, zichtbare
vereenvoudiging; de per-toewijzing-spanne staat in de TODO (§12).

Een taakniveau-invoer van werk (kolom "Werk" op de taak) wordt **naar rato van bestaand restwerk**
over de toewijzingen verdeeld (BEREDENEERD; MSP zegt alleen "verdeeld onder de resources", [M5]).

### 6.3 Contouren

- **R gewijzigd**: de bestaande `rescaleContourForDuration` — as proportioneel, gaten mee, actuals
  blijven; `keepWork` = de werkregel is FIXED_DURATION_WORK of FIXED_WORK (nu: `mspTaskType ===
  'FIXED_WORK'`). ZEKER dat het mechanisme bestaat; de aansturing wisselt van veld.
- **I gewijzigd** op een gecontoureerde toewijzing onder een werkbeschermende regel: de contour is
  data en de inzet is er een afgeleide van (de dialoog toont I per fase). De regel wordt: de hele
  contour schaalt in hoogte met I_nieuw / I_oud; onder FIXED_WORK verandert daardoor R (§5) en volgt
  daarna de as-herschaling. BEREDENEERD.
- **Resource erbij** op een gecontoureerde taak met vast werk: besluit 3 — bestaande contouren
  houden hun vorm, hoogte × (W_i,nieuw / W_i,oud); de nieuwe toewijzing is vlak (geen contour) over de
  nieuwe R; R = W / ΣI. Voor FIXED_DURATION_WORK hetzelfde zonder duurwijziging.
- **Resource eraf**: contour van de verwijderde toewijzing vervalt met de toewijzing (nu al zo).

### 6.4 Kalenders en tijdmodus

Ongewijzigd: de taakkalender bepaalt R in werkdagen/-minuten; de resourcekalender bepaalt op welke
dagen het histogram het werk legt (`taskWorkDayIsos`, ZEKER). Een werkregel verandert niets aan
welke dagen werkdagen zijn. ELAPSEDTIME-taken zijn buiten scope (besluit 6): hun "duur" is kloktijd
en werk = duur × inzet heeft er geen betekenis.

### 6.5 Actuals

- `completion`, `actualStart/Finish`, `remainingTime/Minutes` blijven zoals ze zijn: OPS'
  voortgang is duurgebaseerd (P6 Duration % Complete-achtig). Een werkpercentage (MSP % Work
  Complete) komt er in deze etappe niet (TODO).
- Bij een bewerking op een gestarte taak is R de **restduur** (`remainingTime`/`remainingMinutes`,
  anders duur × (1 − completion) — de bestaande afleiding in de solver, ZEKER `CPMSolver.ts`) en W
  het restwerk. Verrichte duur en verricht werk bewegen niet.
- Het `actual`-deel van een contour telt als `actualWorkMinutes` wanneer dat veld afwezig is.
- Afsluiten op 100 %: restwerk 0, begroot blijft; heropenen laat de velden staan.

### 6.6 Nivelleerder, histogram, bezetting

- Nivelleerder: verschuiven blijft de enige ingreep (besluit 7); hij leest via `assignmentDayUnits`
  automatisch het opgeslagen restwerk (§6.1) en verandert nooit I of W. "Inzet verlagen om binnen
  capaciteit te blijven" → TODO, geavanceerde optie.
- Histogram/overallocatie/bezettingsoverzicht: geen eigen code; ze delen `assignmentDayUnits`
  (ZEKER) en krijgen de vierde bron uit §6.1 gratis mee.

### 6.7 Wat niet mag

- Een regel mag nooit een negatief of nul-restant opleveren: I ≤ 0 of R ≤ 0 als uitkomst ⇒ de
  bewerking wordt geweigerd met behoud van de oude waarden (dezelfde "weigeren-met-behoud"-conventie
  als `updateAssignment`'s `isValidUnits`, ZEKER).
- Een bewerking onder een werkregel is **één undo-stap**, ook als ze drie velden en een contour
  raakt (`runtime.beginUndoable` één keer; §9 meting 28).
- Nooit een getal wijzigen bij openen, herberekenen (F5), documentwissel of typewissel.

## 7. UI

**Instelling "Toon taaktypes"** (`ops-showTaskTypes`, boolean, standaard uit) via
`settingsRegistry.ts` + `saveShowTaskTypes` + `SettingsPanelContent` (de drie vaste plekken —
ZEKER, `docs/recepten/instelling.md`). De instelling stuurt alleen zichtbaarheid.

**Automatische ontsluiting per document** (3.1-3): bij het laden leidt de app een niet-gepersisteerd
documentveld `taskTypesVisible` af (rol `none` in de snapshot; in `DOCUMENT_FIELDS`, `fresh: false`)
uit "minstens één taak heeft `workRule`, `mspTaskType` of `p6DurationType`, of minstens één
toewijzing heeft een werkveld". Is dat zo, dan zijn de bedieningselementen voor dát document zichtbaar
ongeacht de app-instelling, met één informatieve melding via het bestaande meldingenkanaal en een
`helpArticleId` naar de gids (patroon `notifyTimephasedLoss`, ZEKER).

**Eigenschappenpaneel** (`TaskPropertiesPanel`, sectie Planning): een keuzelijst *Werkregel* met de
vier keuzes en het bijschrift; daaronder een regel "Beschermd: duur en inzet" in gewone woorden. In
de toewijzingstabel (`TaskAssignmentsSection`) een kolom **Werk (rest)** in uren, bewerkbaar, en een
slotje in de kop van de kolommen die de huidige regel beschermt — dat is de "bescherming zichtbaar
maken"-opgave uit het voorstel. Een taak met een bewaard `effortDriven` dat afwijkt (beslispunt 8-B)
toont een bijschrift "uit MS Project: (niet) effort-driven", geen vinkje.

**Taakraster**: `task.workRule` als bewerkbare enum-kolom (naast het bestaande alleen-lezen
`task.mspTaskType`, ZEKER `taskColumnRegistry.ts` regel 603) en `assignment.work` als tokens-kolom
in de categorie *resources*, met dezelfde `assignment-set`-transactie als `assignment.unitsPerDay`.
Kolommen verschijnen alleen in de kolomkiezer wanneer de weergave ontsloten is.

**Taakdialoog**: dezelfde secties als het paneel (ze delen `task-sections/`, ZEKER).

## 8. Reikwijdte

In scope: gewone bladtaken op werktijd, in dag- en uurmodus (besluit 6). Buiten scope, gedrag
ongewijzigd en geïmporteerd type bewaard: ELAPSEDTIME-taken, hangmatten, mijlpalen (P6 schakelt het
veld daar zelf uit — ZEKER), samenvattingstaken (MSP: nooit effort-driven — ZEKER), taken zonder
toewijzingen (regel doet niets — ZEKER), materiaalresources (§4.3).

## 9. De meetlat: bewerkingen om later tegen MS Project te toetsen

Vorm: een data-gedreven case-bestand `tests/planning/cases-taaktypes.json` in het stramien van
`cases-progress.json` (ZEKER, dat stramien bestaat), met per case een uitgangssituatie, één
bewerking, de verwachte uitkomst en een veld `evidence: 'reasoned' | 'documented' | 'measured'`.
De suite draait de cases tegen de pure bewerkmodule (§10 stap 3) — géén UI. Zodra iemand een
meting in MS Project (of P6) heeft gedaan, wordt `evidence` `measured` en de verwachting eventueel
gecorrigeerd. Uitgangssituatie tenzij anders vermeld: dagtaak, 8 uur/dag, 5 werkdagen, één
werkresource op inzet 1,0 ⇒ werk 40 uur, niets verricht.

| nr | regel | bewerking | verwacht | bewijs |
|---|---|---|---|---|
| 1 | FIXED_RATE | duur → 10 d | werk 80 u, inzet 1,0 | documented [M1] |
| 2 | FIXED_RATE | inzet → 0,5 | duur 10 d, werk 40 u | documented |
| 3 | FIXED_RATE | werk → 80 u | duur 10 d | documented |
| 4 | FIXED_RATE | tweede resource 1,0 erbij | duur 2,5 d in MSP; OPS: 3 d met halve laatste dag, werk 20 + 20 u | documented [M2] + reasoned (§6.1) |
| 5 | FIXED_RATE + `effortDriven:false` | tweede resource erbij | duur 5 d, werk 40 + 40 u | documented [M2] (beslispunt 8) |
| 6 | FIXED_DURATION_RATE | duur → 10 d | werk 80 u | documented |
| 7 | FIXED_DURATION_RATE | inzet → 0,5 | werk 20 u | documented |
| 8 | FIXED_DURATION_RATE | werk → 80 u | inzet 2,0 | documented |
| 9 | FIXED_DURATION_RATE | tweede resource erbij | duur 5 d, werk 40 + 40 u | documented [P3] |
| 10 | FIXED_DURATION_WORK | tweede resource 1,0 erbij | duur 5 d, inzet 0,5 + 0,5, werk 20 + 20 u | documented [M2]/[P3]; verdeelsleutel reasoned |
| 11 | FIXED_DURATION_WORK | duur → 10 d | inzet 0,5, werk 40 u (P6) — **MSP effort-driven Fixed Duration: werk 80 u** | documented, beide lezingen (beslispunt 8) |
| 12 | FIXED_WORK | duur → 10 d | inzet 0,5, werk 40 u | documented [M1] |
| 13 | FIXED_WORK | inzet → 0,5 | duur 10 d | documented |
| 14 | FIXED_WORK | werk → 80 u | duur 10 d | documented |
| 15 | FIXED_WORK | tweede resource 1,0 erbij | duur 2,5 d (OPS 3 d), werk 20 + 20 u | documented; verdeelsleutel reasoned |
| 16 | FIXED_RATE, 10 d, 40 % gereed (32 u verricht) | duur → 15 d | verricht 4 d/32 u ongewijzigd; rest 11 d, restwerk 88 u; totaal 120 u | reasoned (§2.1 laatste punt) |
| 17 | FIXED_WORK, 10 d, 40 % gereed | duur → 12 d | rest 8 d, restwerk 48 u ⇒ inzet 0,75; verricht ongewijzigd | reasoned |
| 18 | FIXED_DURATION_RATE, 10 d, 40 % | duur → 12 d | rest 8 d, restwerk 64 u, totaal 96 u | reasoned |
| 19 | FIXED_WORK, twee resources 1,0 (werk 20 + 20 u, 2,5 d) | één resource eraf | duur 5 d, werk 40 u op de blijver | documented [M2] |
| 20 | FIXED_DURATION_WORK, twee resources 0,5 | één eraf | blijver inzet 1,0, duur 5 d | documented |
| 21 | FIXED_RATE | wissel → FIXED_WORK, daarna duur → 10 d | na wissel niets gewijzigd; na duur: inzet 0,5 | besloten (2) + documented |
| 22 | FIXED_WORK, contour vooraan belast | duur → 10 d | as ×2, hoogte ×0,5, werk 40 u; actual-periodes onaangeraakt | reasoned (bestaande `rescaleContourForDuration`) |
| 23 | FIXED_WORK, contour vooraan belast | tweede resource erbij | vorm blijft, hoogte ×0,5, nieuwe resource vlak, duur korter | besloten (3) |
| 24 | FIXED_WORK, uurtaak 16 u, inzet 1,0 | inzet → 2,0 | duur 8 u (480 min) | documented |
| 25 | FIXED_WORK + materiaalresource 100 stuks | duur → 10 d | materiaal ongemoeid; werkresource inzet 0,5 | reasoned (§4.3) |
| 26 | elk type, geen toewijzingen | duur → 10 d | alleen de duur; geen veld geschreven | documented [P2] |
| 27 | FIXED_WORK | inzet → 0 | geweigerd, niets gewijzigd | bestaande guard |
| 28 | FIXED_WORK | inzet → 0,5, dan undo | duur, inzet, werk en contour in één stap terug | ontwerpregel §6.7 |

Deze lijst gaat ook naar `docs/TODO.md` als "MSP-meetlat", zodat de eerstvolgende persoon met
MS Project weet wat er te meten valt.

## 10. Bouwvolgorde — apart verifieerbare stappen

**Stap 0 — XER merget eerst.** De XER-branch heeft een tweede merge nodig (46 overlappende
bestanden met main sinds PR #95 en drie andere PR's). Deze etappe start pas op een main **mét** XER
erin, zodat `Task.p6DurationType`, de pset `OPS_P6Progress` en het bronarchief er zijn en er niet
twee keer aan `formatRegistry.ts`, `ifcPsets.ts` en de contour-adapters wordt getrokken.

| stap | levert | poort |
|---|---|---|
| 1 | `WorkRule`, `Task.workRule`, `Project.defaultWorkRule`, de drie werkvelden; `DOCUMENT_FIELDS`; IFC-psets `OPS_WorkRule` + `OPS_AssignmentWork`; ext-contract alleen-lezen. **Geen gedrag.** | `check-ifc-roundtrip` (fixture + canon), `check-document-contract`, `verify:cycles`; elk bestaand bestand byte-identiek |
| 2 | Importvertaling (§4.2) voor .mpp, MSPDI (incl. `<Type>`/`<EffortDriven>` lezen), P6 XML, XER; export MSPDI/P6 XML met de werkvelden; waarschuwingen | fidelity-poort blijft 0 (`GOAL_ZERO_DEVIATIONS`); `check-mpp-*`, `check-adapters-*`; nieuwe fixtures per bron |
| 3 | Pure module `src/engine/work/workTriangle.ts`: `applyDurationEdit`, `applyUnitsEdit`, `applyWorkEdit`, `applyAssignmentAdded`, `applyAssignmentRemoved`, `applyRuleChange` — invoer: taak, toewijzingen, regel, `hoursPerDay`; uitvoer: patches, nooit een store. Plus `cases-taaktypes.json` (§9) | `tests/planning/check-work-triangle.ts` draait alle cases; `evidence` per case |
| 4 | Bedrading: `taskSlice.updateTask` (R), `resourceSlice.updateAssignment` (I, W), `taskEditPlan`/`assignmentPlan` (raster), `createMcpTransactions` (MCP-tweeling — ZEKER dat die spiegel bestaat), `assignmentDayUnits` vierde bron (§6.1) | bestaande suites + `check-work-triangle` via de store; `cases-resource-load.json` uitgebreid |
| 5 | UI: instelling, auto-ontsluiting + melding, paneel/dialoog, rasterkolommen, i18n 14 locales, gidsen nl+en (+12 vertalingen, anders faalt `verify:docs` niet maar is de functie onvindbaar) | `verify:i18n`, `verify:docs`, browserspec `tests/browser/work-rule.spec.ts` (echte toetsen/klikken, store-asserties) |
| 6 | Resource erbij/eraf (§5 rij 4–5) inclusief contourregels (§6.3) — **vereist beslispunt 8** | cases 4, 5, 9, 10, 15, 19, 20, 23 |
| 7 | MCP: contract + schema + registratie; `docs/recepten/mcp-tool.md` | `tests/mcp/`, `cases-toolregistry` |
| 8 | CLAUDE.md-sectie, TODO-afvinking, `docs/superpowers/README.md` | `verify:docs` |

Stap 1–3 zijn onafhankelijk van elkaar te reviewen en veranderen niets aan wat de gebruiker ziet.

## 11. Corpusbewijs (GEMETEN — XER-sessie, 84 unieke bestanden, aangeleverd 2026-09-04)

| meting | uitkomst | wat het voor dit ontwerp betekent |
|---|---|---|
| activiteiten per duration type | DT_FixedDUR2 15.978 · DT_FixedDrtn 1.773 · DT_FixedQty 153 (2 bestanden) · DT_FixedRate 0 · niet-standaard DT_FixedDUR 24 | bouwvolgorde binnen stap 3: FIXED_DURATION_WORK → FIXED_DURATION_RATE → FIXED_WORK → FIXED_RATE (minst getest in de praktijk); de vandaag hardgecodeerde regel is de op één na meest voorkomende in P6-bestanden |
| `target_qty` wijkt >1 % af van duur × tarief | 176 van 61.618 rijen (4 met duur 0); 263 rijen met werk zonder tarief; in 5 bestanden (HarbourPointe 98/417, DCP-03 As-Built 37/47, DCP-03 Baseline 35/45, p6_torture_test 5/45, testXer 1/90) | "afwezig ⇒ afgeleid" is voor 99,7 % van de rijen verliesvrij; de XER-afspraak "alleen overzetten bij afwijking" is dus goedkoop |
| toewijzingen met een curve | 2 rijen, 1 bestand | curves + werkregels: lage prioriteit, wel correct (§6.3) |
| verricht werk op DT_FixedQty | 1 rij | cases 17 en 19 hebben géén corpusdekking — puur beredeneerd |
| `remain_qty_per_hr` ≠ `target_qty_per_hr` | rehab-2 14.459/52.640 · DCP-03 As-Built 47/47 · Baseline 45/45 · Roads 71/3.575 · HarbourPointe 14/417 | het resttarief is een eigen grootheid ⇒ drie werkvelden (beslispunt 9) |

Het corpus staat bij de eigenaar (`~/open-aec/voor claude/testdata-crawl`, env `OPS_XER_CORPUS`),
niet in de repo; de tabellen staan daar in `/tmp/xer-overname/corpusscan-werk-2.md`. Een telling
van `mspTaskType × effortDriven` over de .mpp-crawl (216 bestanden) ontbreekt nog (§12).

## 12. Wat dit ontwerp bewust laat liggen (→ `docs/TODO.md`)

- **MSP-meetlat**: de 28 bewerkingen uit §9 meten in MS Project (en P6) zodra iemand het heeft.
- **Telling `mspTaskType × effortDriven`** over de `OPS_MPP_CRAWL`-set: bepaalt hoe vaak beslispunt
  8 in de praktijk speelt.
- **Nivelleerder-optie "inzet verlagen"** (besluit 7-B) onder een geavanceerde optie.
- **Per-toewijzing-spanne** (`workWindowStart/Finish` activeren) — heft de vereenvoudiging van
  §6.2 op.
- **% werk gereed** (MSP % Work Complete) naast de duurgebaseerde `completion`.
- **Projectstandaard-werkregel in de UI** (projectwizard/projectinfo): stap 1 slaat het veld op,
  de UI ervoor is klein maar niet in deze etappe.
- **CSV**: toewijzingen en werk in CSV — pas wanneer CSV toewijzingen kent.
- **P6-optie "preserve existing assignments"** ([P4]): OPS kiest altijd "recalculate" (de
  synchronisatietabel); de "preserve"-variant is een instelling voor later.

## 13. Bronnen

MS Project (Microsoft Support, geraadpleegd 2026-09-04):

- [M1] *Change the task type for more accurate scheduling* —
  https://support.microsoft.com/en-us/office/change-the-task-type-for-more-accurate-scheduling-b0b969ad-45bc-4e9e-8967-435587548a72
- [M2] *Change the effort driven setting for task types* —
  https://support.microsoft.com/en-us/office/change-the-effort-driven-setting-for-task-types-18efd7c7-d146-4b06-bdbe-b6a11564bdf3
- [M3] *The duration or work value changed when I assigned a resource* —
  https://support.microsoft.com/en-au/office/the-duration-or-work-value-changed-when-i-assigned-a-resource-a3573268-f613-419d-b78f-2516255c7432
- [M4] *Type fields* — https://support.microsoft.com/en-us/project/type-fields
- [M5] *Work fields* — https://support.microsoft.com/en-us/project/work-fields
- [M6] *Remaining Work fields* — https://support.microsoft.com/en-us/project/remaining-work-fields
- [M7] *Actual Work fields* — https://support.microsoft.com/en-US/project/actual-work-fields
- [M8] *Remaining Duration (task field)* — https://support.microsoft.com/en-us/project/remaining-duration-task-field
- [M9] secundair: NCDOT-trainingsdocument *Microsoft Project 2016 – Before You Plan Your First
  Project* (stelt "New tasks are effort driven" standaard uit) —
  https://connect.ncdot.gov/projects/Project-Management/TrainingDocs/MicrosoftProject2016-BeforeYouPlanYourFirstProject.pdf
- Ook geraadpleegd zonder aanvullende regel: *Effort Driven (task field)*, *Duration (task field)*,
  *Work Contour field* (eerder, contour-etappe).

Primavera P6 (Oracle Help Center, geraadpleegd 2026-09-04):

- [P1] *Define activity duration types* (P6 Professional 24) —
  https://docs.oracle.com/cd/F88968_01/English/User_Guides/p6_pro_user/define_activity_duration_types.htm
- [P2] *About Duration Types* (P6 EPPM Help 24, met de Remaining-formules) —
  https://docs.oracle.com/cd/F88966_01/p6help/en/6631.htm
- [P3] *Synchronizing activity duration, units, and resource units/time* (de synchronisatietabel) —
  https://docs.oracle.com/cd/F88968_01/English/User_Guides/p6_pro_user/synchronizing_activity_duration_units_and_resource_units_time.htm
- [P4] *Select calculation options for resource and role assignments* —
  https://docs.oracle.com/cd/G48902_01/English/User_Guides/p6_pro_user/select_calculation_options_for_resource_and_role_assignments.htm
- [P5] *Calculations Tab of the Project Preferences Dialog Box* (P6 EPPM Help 23) —
  https://docs.oracle.com/cd/F74773_01/p6help/en/91690.htm
- Eerder (contour-etappe): *Future period bucket planning*, *The Resource Usage Spreadsheet*,
  *Editing Period Values for Assignments*.

Eigen code (ZEKER-verwijzingen): `src/types/task.ts`, `src/types/resource.ts`,
`src/engine/contour/contourEngine.ts` (`rescaleContourForDuration`), `src/utils/taskDefaults.ts`
(`rescaleTaskContours`), `src/engine/scheduler/ResourceLoad.ts` (`assignmentDayUnits`,
`taskWorkDayIsos`), `src/state/slices/resourceSlice.ts`, `src/state/slices/taskSlice.ts`,
`src/services/mpp/mppReader.ts`, `src/services/msproject/mspdi{Reader,Writer}.ts`,
`src/services/p6/p6xml{Reader,Writer}.ts`, `src/services/csv/csvWriter.ts`,
`src/engine/taskGrid/taskColumnRegistry.ts`, `src/state/documentContract.ts`,
`docs/ifc-round-trip.md`, `docs/recepten/instelling.md`, `tests/planning/cases-progress.json`.
