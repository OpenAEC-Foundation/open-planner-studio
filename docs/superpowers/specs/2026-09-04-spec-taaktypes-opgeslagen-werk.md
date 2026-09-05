# Taaktypes, opgeslagen werk en effort-driven plannen — ontwerp

*Ontwerp, 2026-09-04. Opvolger van het voorstel
[`2026-08-18-spec-taaktypes-effort-driven.md`](2026-08-18-spec-taaktypes-effort-driven.md)
("ontwerp vóór bouw"). Status: **in aanbouw op de branch `claude/contour-engine-planner-mnrsy3`
(PR #101, gestapeld op de XER-branch): stappen 1 t/m 7 zijn gebouwd (2026-09-05); stap 6 is
daarin voor de store/raster/MCP-kant meegenomen (resource erbij/eraf + contourhoogte, besluit 3);
stap 8 (afronding docs) volgt.**
De contour-engine, de contour-UI en de fasen-editor (2026-09) zijn geleverd en worden hier als
bestaand fundament gebruikt.*

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

**Effort-driven** (ZEKER; bron per punt):

- Effort-driven gaat uitsluitend over het **toevoegen of verwijderen van resources** ([M2]):
  "Project lengthens or shortens the duration of the task based on the number of resources that are
  assigned to it, but Project does not change the total work for the task." Bij Fixed Units verkort
  een resource erbij de duur; bij Fixed Duration daalt de inzet van elke resource ([M2]).
- Effort-driven werkt pas **ná de eerste toewijzing** ([M3]): "If you assign multiple resources at
  the same time, the duration doesn't change from your original estimate." De eerste toewijzing(en)
  zetten het werk; daarna houdt effort-driven dat werk vast.
- **Fixed Work is altijd effort-driven** en dat vinkje is daar niet te wijzigen ([M1]): "Project
  doesn't consider fixed work tasks to have flexible work values and are therefore always
  effort-driven."
- Samenvattingstaken en ingevoegde projecten kunnen niet effort-driven zijn ([M2]).
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

**De vier duration types en hun formules** (definities ZEKER uit [P1]; de twee
Fixed-Duration-formules ZEKER uit [P2]; voor de andere twee types geeft geen van beide pagina's
een formule — de regel daar is AFGELEID uit de algemene identiteit in de inleiding van [P3],
"Duration = Units ÷ (Resource Units ÷ Time)"):

| duration type | wat vastligt | formule |
|---|---|---|
| Fixed Duration & Units/Time | duur en inzet per tijdseenheid | Remaining Units = Units/Time × Remaining Duration (ZEKER, [P2]) |
| Fixed Duration & Units | duur en totaal werk | Units/Time = Remaining Units / Remaining Duration (ZEKER, [P2]) |
| Fixed Units/Time | inzet per tijdseenheid | Duration = Units / (Units/Time) (AFGELEID uit [P3]) |
| Fixed Units | totaal werk | idem (AFGELEID uit [P3]) |

Let op de woorden in de twee gedocumenteerde formules: **Remaining** Units en **Remaining**
Duration. Dat P6 de driehoek op het resterende deel rekent is daarmee ZEKER voor de twee
Fixed-Duration-types en **AFGELEID** voor Fixed Units/Time en Fixed Units: [P2] zegt daar niets
over rest versus totaal. De redenering: P6 houdt per toewijzing Actual, Remaining en At Completion
apart bij en herrekent Remaining of At Completion uit elkaar ([P5]), dus een regel die op het
totaal zou werken zou verrichte uren moeten herschrijven — wat geen van de opties in [P5] doet.
Dit is de basis van de keuze in §5 en staat daarom in §9 (cases 16–18) als te meten.

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
  "The duration type applies only when you have at least one resource assigned to the activity").
- Bij Start- en Finish-mijlpalen is het veld uitgeschakeld ([P1]).
- Projectoptie bij het toevoegen van resources ([P4]): "Preserve the Units, Duration, and Units/Time
  for existing assignments" óf "Recalculate the Units, Duration, and Units/Time for existing
  assignments based on the activity Duration Type". De laatste kolom van de synchronisatietabel
  geldt dus alleen bij de tweede instelling.
- Projectoptie bij actuals ([P5]): "Add actual to remaining" (At Completion Units = Remaining Units +
  Actual Units) óf "Subtract actual from at completion" (Remaining Units = At Completion Units −
  Actual Units). AFGELEID uit die twee formules: verricht werk is in beide varianten invoer en wordt
  door geen van beide herschreven.
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
| Fixed Units, niet effort-driven | — | **geen P6-tegenhanger**: MSP combineert hier *inzet gewijzigd ⇒ duur herberekend* met *resource erbij ⇒ werk groeit, duur blijft*. In [P3] gaat de eerste eigenschap alleen samen met de twee types die bij een extra resource juist de duur verkorten (Fixed Units/Time, Fixed Units); de twee types die de duur laten staan herberekenen bij een inzetwijziging het werk |

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

### 3.3 Genomen op 2026-09-05 (beslispunten 8–10)

| nr | besluit |
|---|---|
| 8 | **Optie B**: vier types in het menu; het bewaarde `Task.effortDriven` stuurt alleen de twee cellen waar MS Project van P6 afwijkt (§5). Taken die in OPS worden aangemaakt krijgen het veld nooit. |
| 9 | **Drie optionele werkvelden per toewijzing** (begroot / verricht / resterend); de driehoek werkt op het restant, begroot blijft referentie (§4.3). |
| 10 | **De vereenvoudiging "elke toewijzing loopt over de hele restduur" is geaccepteerd** voor deze etappe; de per-toewijzing-spanne staat in `docs/TODO.md` als vervolg (§6.2, §12). |

De afwegingen achter de drie punten staan hieronder bewaard zoals ze aan de eigenaar zijn
voorgelegd.

**Beslispunt 8 — de twee MS Project-gedragingen die niet in de vier P6-types passen (§2.3).**

| optie | wat het betekent | gevolg |
|---|---|---|
| A. Vier types, punt | Een MSP-taak "Fixed Units, niet effort-driven" wordt Fixed Units/Time en "Fixed Duration, effort-driven" wordt Fixed Duration & Units. | Eenvoudigst. Maar een geïmporteerde MSP-standaardtaak krijgt na "resource erbij" een kortere duur waar MSP de duur zou laten staan, en een effort-driven Fixed-Duration-taak houdt bij een duurwijziging het werk vast waar MSP het werk laat meegroeien. Dat is de "onverwacht verschuivende planning" die de UX-opgave juist wil vermijden. |
| B. Vier types in het menu, `effortDriven` blijft bewaarde invoer die alleen de afwijkende kolommen stuurt **(advies)** | Het bestaande veld `Task.effortDriven` blijft staan zoals het nu al round-tript. De regeltabel (§5) leest het op precies de twee cellen waar MSP afwijkt: Fixed Units/Time + `effortDriven === false` ⇒ resource erbij/eraf verandert werk in plaats van duur; Fixed Duration & Units + `effortDriven === true` ⇒ duur gewijzigd verandert werk in plaats van inzet. Taken die de gebruiker in OPS aanmaakt krijgen het veld nooit en volgen zuiver P6. | Het menu blijft vier keuzes (besluit 1 intact), MSP-bestanden gedragen zich als in MSP, en de afwijking is zichtbaar te maken als bijschrift ("uit MS Project: niet effort-driven") in plaats van als vinkje. Kost één extra rij in de regeltabel en twee testgevallen. |
| C. Zes types | Het menu toont de volledige unie (vier P6 + twee MSP). | Volledig, maar precies de "MSP-verwarring" die de eigenaar niet wil importeren; verworpen door besluit 1. |

Gekozen: B. De rekenkern van bouwstap 3 implementeert die twee cellen al (`workTriangle.ts`,
`TriangleState.effortDriven`; cases wt-05, wt-05b en wt-11b).

**Beslispunt 9 — drie optionele werkvelden per toewijzing (§4.3).** Aanbeveling uit de corpusscan
(GEMETEN: het resttarief `remain_qty_per_hr` wijkt in vijf bestanden structureel af van het
begrote tarief, tot 100 % van de rijen), uitgelegd aan de eigenaar op 2026-09-04 met het
metselwerkvoorbeeld (160 uur begroot, 80 verricht, 120 resterend). Gekozen: de drie velden.

**Beslispunt 10 — meerdere toewijzingen en de taakduur (§6.2).** OPS kent geen duur per toewijzing;
het ontwerp kiest de vereenvoudiging "elke toewijzing loopt over de hele restduur van de taak" en
legt de per-toewijzing-spanne in de TODO. Dat wijkt af van MSP en P6, waar toewijzingen een eigen
spanne hebben. Gekozen: accepteren, mét de TODO-notitie.

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
  | 'FIXED_RATE';           // P6 Fixed Units/Time            · MSP Fixed Units, effort-driven (niet effort-driven: zie beslispunt 8)
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
| | `DT_FixedDUR` (niet-standaard, 24 activiteiten in p6difftool-fixtures, GEMETEN) | de XER-lezer zelf valt bij een onbekend token gerapporteerd terug op de projectstandaard (`PROJECT.def_duration_type`, XER-etappeplan §4.7) en zet dát als `p6DurationType`; de werkregel volgt die standaard. Het rauwe token blijft in het bronarchief. (Bijgewerkt 2026-09-05 na de merge met de XER-branch; de oude regel "geen werkregel" is daarmee vervallen.) |

De P6 XML-labels zijn geverifieerd tegen de P6 EPPM REST-documentatie van het Activity-object
(ZEKER; dezelfde enum als PMXML) en de XER-token↔label-paren tegen Oracle's XER Import/Export Data
Map Guide (TASK.duration_type): `DT_FixedDrtn` = "Fixed Duration and Units/Time", `DT_FixedDUR2` =
"Fixed Duration and Units". Let op: de P6 XML-lezer van de XER-branch had die twee labels
verwisseld; bouwstap 2 heeft dat gecorrigeerd (`p6xmlReader.ts`, `check-xer-p6xml-parity.ts`).
De XER-tokens komen van de XER-sessie (ZEKER voor hun branch). `mppReader.ts`'s `MSP_TASK_TYPE_VALUES` gebruikt de volgorde 0/1/2 =
Fixed Units/Fixed Duration/Fixed Work (ZEKER); dat MSPDI's task-level `<Type>` dezelfde nummering
draagt is een externe bewering die de repo nergens vastlegt — te verifiëren tegen MPXJ's
`MSPDIReader` in stap 2 (ONBEKEND tot dan).

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
restwerk wijzigt herschaalt de contour proportioneel (de bestaande `rescaleContourForDuration`: die heeft een
parameter `taskType?: MspTaskType` en leidt daar intern `keepWork` uit af voor `'FIXED_WORK'` —
ZEKER; die parameter gaat de werkregel dragen, dus verbreden naar `WorkRule` of een tweede
parameter erbij, te kiezen in stap 3). Wijkt de som bij import af van het veld
(bron inconsistent), dan winnen de velden voor de totalen en wordt de contour bij de eerste
bewerking op de velden herschaald — nooit bij het openen (3.1-5). BEREDENEERD.

**Materiaalresources** vallen buiten de driehoek: hun "werk" is een hoeveelheid (P6 Unit of
Measure, MSP Material Label — ZEKER `Resource.unitOfMeasure`), geen tijd. Alleen LABOR, EQUIPMENT,
CREW en SUBCONTRACTOR sturen de duur. BEREDENEERD; MSP's tabel spreekt alleen over work resources.

### 4.4 Round-trips

| kanaal | taak | toewijzing | opmerking |
|---|---|---|---|
| **IFC** (native) | nieuwe pset `OPS_WorkRule` (property `WorkRule`, IFCLABEL) naast het bestaande `OPS_MspTaskType`; `Project.defaultWorkRule` in `OPS_SchedulingOptions` | JSON-pset `OPS_AssignmentWork` per taak (zelfde `writeTimephasedMeta`-vorm als `OPS_Timephased`, per toewijzing via `resourceId`, door `remapContourResourceIds`-achtige guid-remap) | route: `docs/ifc-round-trip.md` — writer, reader, fixture én canon-tabel in `check-ifc-roundtrip`; de laatste twee zijn compile-afgedwongen |
| **MSPDI** | `<Type>`, `<EffortDriven>` (nu niet gelezen én niet geschreven — ZEKER, `mspdiReader.ts`/`mspdiWriter.ts`; stap 2 bouwt beide richtingen) | `<Work>`, `<ActualWork>`, `<RemainingWork>` op `<Assignment>` én de sommen op `<Task>` | de writer schrijft `<Work>` vandaag al afgeleid (ZEKER, regel 652); wordt: veld als aanwezig, anders afgeleid |
| **P6 XML** | `<DurationType>` | `<PlannedUnits>`, `<ActualUnits>`, `<RemainingUnits>` (uren) en `<AtCompletionUnits>` = actual + remaining | lezer/writer lezen/schrijven nu alleen `PlannedUnitsPerTime` (ZEKER) |
| **XER** (alleen lezen, XER-branch) | `TASK.duration_type` → `p6DurationType` (bestaat op de XER-branch, niet op main — zie stap 0) + `workRule` (nieuw) | `TASKRSRC.target_qty`, `act_reg_qty + act_ot_qty`, `remain_qty` → de drie velden — **alleen wanneer `target_qty` afwijkt van duur × `target_qty_per_hr`** (afspraak met de XER-sessie); tot dan blijft alles in het bronarchief `OPS_XerSourceArchive` | GEMETEN: 176 van 61.618 rijen wijken >1 % af; 263 rijen hebben werk zonder tarief |
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
| **resource erbij** (met inzet I_n) | nieuwe W_n = R × I_n; rest ongemoeid | totaal W blijft; verdeeld naar rato van inzet; elke I_i = W_i / R | totaal W blijft; verdeeld naar rato van inzet; R = max_i(W_i / I_i) | totaal W blijft; verdeeld naar rato van inzet; R = max_i(W_i / I_i); **bij bewaard `effortDriven: false`: als FIXED_DURATION_RATE** (beslispunt 8-B) |
| **resource eraf** | W_n vervalt; rest ongemoeid | totaal W blijft; opnieuw verdeeld; I_i = W_i / R | totaal W blijft; opnieuw verdeeld; R = max_i(W_i / I_i) | totaal W blijft; opnieuw verdeeld; R = max_i(W_i / I_i); **bij `effortDriven: false`: W_n vervalt, R blijft** |
| **typewissel** | geen getal verandert (besluit 2) | idem + W vastleggen | idem + W vastleggen | geen getal verandert |
| **R gewijzigd, bewaard `effortDriven: true`** | — | **W = R × I** (MSP Fixed Duration + effort-driven, beslispunt 8-B) | — | — |

Bronnen per kolom: FIXED_DURATION_RATE, FIXED_RATE en FIXED_WORK: rijen 1–3 ZEKER ([M1] en
[P3] stemmen overeen). Rij 4 (erbij) ZEKER uit [P3]'s kolom "add additional resources" en [M2].
Rij 5 (eraf): [P3] heeft géén kolom voor verwijderen; [M2] dekt de drie effort-driven regels
("when you assign or remove people from a task"), dus ZEKER voor FIXED_RATE, FIXED_WORK en
FIXED_DURATION_WORK, en **AFGELEID** voor FIXED_DURATION_RATE (spiegelbeeld van rij 4).
FIXED_DURATION_WORK: rij 1 ZEKER uit [P3] (P6-lezing; de MSP-lezing staat in de laatste rij),
rij 2–3 ZEKER, rij 4 ZEKER ([P3]: "Units/Time of each resource"; [M2]: "decreases individual
resource unit values").

Drie regels die de tabel eenduidig maken (alle drie BEREDENEERD; §9 toetst ze):

- **De verdeelsleutel** bij "totaal W blijft; verdeeld" is in geen van beide documentaties benoemd
  (ONBEKEND). Het ontwerp verdeelt *naar rato van de inzet zoals die bij de bewerking geldt*: I_n
  zoals ingevoerd voor de nieuwe toewijzing, de huidige I_i voor de bestaande — dus vóórdat de
  regel zelf de inzet herrekent, anders is de sleutel circulair. Bij twee gelijke resources geeft
  dat de helft-helft-uitkomst die beide handleidingen als voorbeeld geven (cases 10, 15, 30).
- **De taakduur bij meerdere toewijzingen** is R = max_i(W_i / I_i) over de werkresources (§6.2).
  Direct ná een evenredige herverdeling is dat gelijk aan W / ΣI (elke toewijzing heeft dan dezelfde
  W_i / I_i); heeft de gebruiker per toewijzing eigen werk ingevoerd, dan bepaalt de zwaarste
  toewijzing de duur (case 29). "R = W / ΣI" mag dus nooit als losse formule worden gebouwd.
- **Na afronding** (§6.1) zijn W en I de opgeslagen grootheden en is R afgeleid en naar boven
  afgerond; een volgende bewerking rekent altijd vanuit de exacte W en I, nooit terug vanuit de
  afgeronde R (case 31).

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
  `remainingWorkMinutes` aanwezig, dan is het te verdelen totaal het RESTwerk **plus het verrichte
  deel** (`actualWorkMinutes` als de bron 'm gaf, anders afgeleid als verrichte duur × inzet —
  reviewbevinding B3 op bouwstap 4: de driehoek schrijft alleen het restveld, en een typewissel
  op een half gedane taak mag de belasting niet halveren, besluit 2), gespreid met de curvevorm
  over de hele duur; niet `unitsPerDay × durationDays`. Zonder die aanpassing toont het histogram
  op zo'n taak te veel werk. BEREDENEERD; MSP staat fractionele dagen toe (0,5 d) en heeft dit
  probleem niet.
- **Wat na afronding leidend is**: na case 4 geldt R = 3 d, I = 1,0 + 1,0 en W = 20 + 20 u, terwijl
  R × ΣI = 48 u. De identiteit werk = duur × inzet geldt dan alleen nog voor de exacte, niet-afgeronde
  R. Regel: onder de werkbeschermende regels zijn **W en I opgeslagen en is R afgeleid**; elke
  volgende bewerking (case 31) rekent uit de exacte W en I en nooit terug uit de afgeronde R, zodat
  herhaald bewerken niet drift. Onder de inzetbeschermende regels blijft W = R × I met de hele-dagen-R
  die de gebruiker zelf koos — het gedrag van vandaag.
- **Uurtaken**: R in hele minuten, naar boven; W exact.
- I wordt op twee decimalen opgeslagen zoals nu in de UI (ZEKER `isValidUnits`-guard: > 0).

### 6.2 Meerdere toewijzingen

OPS kent geen duur per toewijzing: elke toewijzing loopt over de hele taakduur (ZEKER, het
datamodel; `workWindowStart/Finish` bestaat, round-tript al door IFC (`OPS_TimephasedWindow`) en
het extensiecontract, maar geen lezer vult het en geen solverstap leest het — de latere activering
is dus geen groen veld). Regel in deze etappe (beslispunt
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
  nieuwe R; R = max_i(W_i / I_i) (§5). Voor FIXED_DURATION_WORK hetzelfde zonder duurwijziging.
- **Resource eraf**: contour van de verwijderde toewijzing vervalt met de toewijzing (nu al zo).

### 6.4 Kalenders en tijdmodus

De taakkalender bepaalt R in werkdagen/-minuten; de resourcekalender bepaalt op welke dagen het
histogram het werk legt (`taskWorkDayIsos`, ZEKER). Een werkregel verandert niets aan welke dagen
werkdagen zijn. ELAPSEDTIME-taken zijn buiten scope (besluit 6): hun "duur" is kloktijd en werk =
duur × inzet heeft er geen betekenis.

**Kalenderwissel (eigenaarsbesluit 2026-09-05, K2 — vervangt de eerdere "ongewijzigd"-regel).**
Een andere kalender (taakkalender, projectkalender of de inhoud van een kalender) verandert de
SLOTgrootte: werkminuten per werkdag. De restduur in dagen blijft, het werk van vóór de wissel is
het anker, en daarna beslist de regel van de taak (`workTriangle.ts`'s `applySlotChange`, brug
`settleCalendarChange`):
- FIXED_DURATION_RATE (standaard): duur en inzet blijven, het werk volgt — het gedrag van vandaag;
  zonder werkveld byte-identiek, een aanwezig veld wordt R' × I (meetlat 34).
- FIXED_DURATION_WORK: duur en werk blijven, de inzet wordt W / R' (meetlat 33).
- FIXED_WORK en FIXED_RATE: werk en inzet blijven, R = max(W / I) in de nieuwe slot, naar boven op
  hele dagen — minder uren per dag maakt de taak langer (meetlat 32). Dat verschuift dus wél de
  planning; een project- of kalenderwijziging die duren verandert, meldt hoeveel taken
  (`notifications.workRuleDurationsChanged`).
Uurtaken hebben geen slotafhankelijke duur en blijven ongemoeid. Bewijs: MSP rekent
Duration = Work ÷ (Units × Hours per day) en houdt onder Fixed Work het werk vast [M2]/[M4]
(documented), maar MSP's "dag" is een vaste omrekenfactor (Opties → Uren per dag) en geen
kalenderwerkdag — de vertaling naar OPS-werkdagen is beredeneerd, niet gemeten.

Vier randregels (reviewronde 2026-09-05, F3–F6; alle BEREDENEERD):
- FIXED_RATE legt bij de slotwissel — net als bij een inzetbewerking (§4.3) — géén werkveld vast:
  het anker is rekeninvoer voor R, en een afgerond R laat dan geen opgeslagen W achter die van
  R × I afwijkt (meetlat 35). Meerdere toewijzingen: R = max(W_i / I_i) (meetlat 36).
- Beslispunt 8-B (`effortDriven`) speelt bij een slotwissel niet: die uitzondering geldt een
  DUURbewerking in dagen, en de slotwissel laat de dagen juist staan. Een MSP-import met Fixed
  Duration + effort-driven krijgt hier dus de P6-lezing (inzet = W / R'), anders dan MSP zelf zou
  doen — bewust, en niet gemeten.
- De contour-as leeft op werkminuten (§6.3), dus zij wordt na de wissel herschaald van de OUDE
  werkminuten (dagen × oude slot) naar de nieuwe — óók wanneer de regel de dagen niet wijzigt
  (Vaste duur): dezelfde dagen zijn in de nieuwe slot een andere hoeveelheid werk. Werkbehoud in
  de hoogte volgt `contourKeepsWork`.
- Een gestarte taak: de nieuwe duur is verricht + nieuwe rest en de rest wordt expliciet
  geschreven, precies zoals bij een duurbewerking (§6.5, B2); `completion` blijft. Let op de
  bekende inconsistentie die daaruit volgt (zie §6.5, laatste punt) — die ontstaat hier zónder
  gebruikersbewerking, bij elke project- of kalenderwijziging.

### 6.5 Actuals

- `completion`, `actualStart/Finish`, `remainingTime/Minutes` blijven zoals ze zijn: OPS'
  voortgang is duurgebaseerd (P6 Duration % Complete-achtig). Een werkpercentage (MSP % Work
  Complete) komt er in deze etappe niet (TODO).
- Bij een bewerking op een gestarte taak is R de **restduur** (`remainingTime`/`remainingMinutes`,
  anders duur × (1 − completion) — de bestaande afleiding in de solver, ZEKER `CPMSolver.ts`) en W
  het restwerk. Verrichte duur en verricht werk bewegen niet. **Terugschrijven op een gestarte taak
  (bouwstap 4, reviewbevinding B2):** de nieuwe duur is verricht + nieuwe rest, en de rest wordt dan
  EXPLICIET geschreven (`remainingTime` in dagmodus, `remainingMinutes` in uurmodus) — anders zou de
  solver de rest opnieuw afleiden als nieuwe duur × (1 − completion), het verrichte deel mee
  verschuiven en een heen-en-weer-bewerking driften (case 31). `completion` blijft zoals ze is.
- **Een voortgangsbewerking is geen duurbewerking** (reviewbevinding B1): `completion` of
  `remainingTime` wijzigen verandert de rest maar niet de duur, en raakt de driehoek niet; de poort
  is de TOTALE werkduur van de taak (`settleDurationEdit` vergelijkt die met de momentopname).
- **Duurbewerking bij een EXPLICIETE restduur (eigenaarsbesluit 2026-09-05):** het verrichte deel is
  een feit, dus wat de gebruiker aan de duur toevoegt of afhaalt landt in de rest — rest = max(0,
  rest + Δ), in dagen (`remainingTime`) of minuten (`remainingMinutes`); `completion` blijft zoals
  ze is (`carryRemainingThroughDurationEdit`, in store, raster en MCP vóór de driehoekstap). Bron:
  Microsoft, Remaining Duration = Duration − Actual Duration [M5] (documented voor de identiteit;
  de Δ-richting bij een duurbewerking is daaruit afgeleid, niet gemeten). Zonder expliciet restveld
  wordt de rest al uit duur × (1 − completion) afgeleid en schuift hij vanzelf mee. Reikwijdte
  (reviewbevinding F7, AFGELEID): dit is een duur-identiteit en geen driehoeksregel, dus zij geldt
  óók op ELAPSEDTIME-taken; alleen verzameltaken, hangmatten en mijlpalen (geen eigen bewerkbare
  duur) blijven buiten schot.
- **Bekende inconsistentie `completion` ↔ expliciete rest (reviewbevinding F4, OPEN eigenaarsvraag).**
  Zodra de rest expliciet wordt geschreven terwijl `completion` blijft staan (Δ-regel hierboven, B2,
  en de kalenderwissel in §6.4), zeggen de twee velden iets anders: 10 d op 50 % met rest 5 wordt na
  een kalenderwissel naar 6 u/dag onder Vast werk 12 d met rest 7 — 5 d verricht volgens de rest,
  maar 6 d volgens `completion` × duur. De Gantt tekent de voortgangsbalk uit `completion`
  (`GanttRenderer.ts`), de solver plant op de rest. Opties: (a) `completion` herrekenen als
  verricht ÷ nieuwe duur wanneer de rest expliciet wordt geschreven; (b) renderer en rapportage
  op de rest laten leunen; (c) laten zoals het is. Vandaag: (c), conform "completion blijft"; het
  besluit staat in `docs/TODO.md`.
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

Alle toewijzingsroutes lopen door de driehoek — ook **verplaatsen** (`moveAssignment` = eraf bij de
oude taak + erbij bij de nieuwe) en **een resource verwijderen** (`removeResource` = eraf op elke
taak waar hij stond); reviewbevinding B4 op bouwstap 4. Buiten de driehoek blijft alleen de
kalender (§6.4) — met het gevolg dat na een kalenderwissel op een taak met vastgelegd werk W niet
meer bij I × R past (het histogram toont dan I' = W / R'): open beslispunt in `docs/TODO.md`.

## 9. De meetlat: bewerkingen om later tegen MS Project te toetsen

Vorm: een data-gedreven case-bestand `tests/planning/work-triangle-cases.json` (gebouwd; de naam
mist bewust het `cases-`-prefix, want `run.sh` globt `cases-*.json` de CPM-harnas en een vaste
batterij-inventaris in — ZEKER), met per case een resterende uitgangssituatie, één of meer
bewerkingen, de verwachte uitkomst en een veld `evidence: 'documented' | 'reasoned' | 'decided'
| 'measured'`. `tests/planning/check-work-triangle.ts` draait de cases tegen de pure
bewerkmodule (§10 stap 3) — géén UI; de drie store-gebonden cases (22, 23, 28) telt hij en
slaat hij over. Zodra iemand een
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
| 26 | elk type, geen toewijzingen | duur → 10 d | alleen de duur; geen veld geschreven | documented [P2] (P6); reasoned (MSP-lezingen) |
| 27 | FIXED_WORK | inzet → 0 | geweigerd, niets gewijzigd | bestaande guard |
| 28 | FIXED_WORK | inzet → 0,5, dan undo | duur, inzet, werk en contour in één stap terug | ontwerpregel §6.7 |
| 29 | FIXED_WORK, twee resources 1,0 met per toewijzing ingevoerd werk 40 u en 8 u | duur → 10 d | inzet 0,5 en 0,1; werk ongewijzigd — en omgekeerd: inzet van de eerste → 2,0 ⇒ R = max(40/16, 8/8) = 2,5 d (OPS 3 d), tweede toewijzing loopt over die 3 d: I = 8/(3 × 8) ≈ 0,33 | reasoned (§5, R = max_i) |
| 30 | FIXED_WORK, één resource 1,0 (40 u) | tweede resource erbij met inzet 0,5 | verdeling 1,0 : 0,5 ⇒ werk 26,67 + 13,33 u; R = 40/12 ≈ 3,33 d (OPS 4 d) | reasoned (verdeelsleutel §5) |
| 31 | FIXED_WORK, één resource 1,0 (40 u) | inzet → 0,6, daarna inzet → 1,0 | eerst R = ⌈40/4,8⌉ = 9 d, werk 40 u; daarna R = 5 d exact (niet 9 × 8 × 1,0 = 72 u) | reasoned (§6.1, W leidend) |
| 32 | FIXED_WORK, 4 d op 8 u/dag, één resource 1,0 (32 u) | taakkalender → 6 u/dag | werk 32 u, inzet 1,0, R = 32/6 = 5,33 ⇒ 6 d | reasoned (K2; [M2]/[M4] documented voor "werk vast, duur herrekend", OPS-dagen beredeneerd) |
| 33 | FIXED_DURATION_WORK, 4 d op 8 u/dag, één resource 1,0 (32 u) | taakkalender → 6 u/dag | R = 4 d, werk 32 u, inzet 32/24 = 1,33 | reasoned (K2; [P1] Units/Time = Remaining Units / Remaining Duration) |
| 34 | FIXED_DURATION_RATE, 4 d op 8 u/dag, resource a 1,0 met veld 32 u, resource b 1,0 zonder veld | taakkalender → 6 u/dag | R = 4 d, inzet 1,0; a wordt 24 u, b blijft veldloos (afgeleid 24 u) | reasoned (K2; het gedrag van vandaag) |
| 35 | FIXED_RATE, 4 d op 8 u/dag, één resource 1,0 zonder veld | taakkalender → 6 u/dag | R = ⌈32/6⌉ = 6 d, inzet 1,0, GEEN werkveld (afgeleid 36 u) | reasoned (F5; §4.3 afwezig blijft afwezig) |
| 36 | FIXED_WORK, 4 d op 8 u/dag, resource a 1,0 (32 u) + resource b 0,5 (8 u) | taakkalender → 6 u/dag | R = max(32/1, 8/0,5) = 32 u ÷ 6 = 5,33 ⇒ 6 d; beide werkvelden blijven | reasoned (F11; §6.2) |

Deze lijst (36 bewerkingen) gaat ook naar `docs/TODO.md` als "MSP-meetlat", zodat de eerstvolgende persoon met
MS Project weet wat er te meten valt. Voor 32–36 en de Δ-regel uit §6.5 geldt bovendien dat MS Project
hier niet in werkdagen rekent; wie meet, noteert de uren.

## 10. Bouwvolgorde — apart verifieerbare stappen

**Stap 0 — XER merget eerst.** De XER-branch heeft een tweede merge nodig (46 overlappende
bestanden met main sinds PR #95 en drie andere PR's). Deze etappe start pas op een main **mét** XER
erin, zodat `Task.p6DurationType`, de pset `OPS_P6Progress` en het bronarchief er zijn en er niet
twee keer aan `formatRegistry.ts`, `ifcPsets.ts` en de contour-adapters wordt getrokken.

| stap | levert | poort |
|---|---|---|
| 1 | `WorkRule`, `Task.workRule`, `Project.defaultWorkRule`, de drie werkvelden; `DOCUMENT_FIELDS`; IFC-psets `OPS_WorkRule` + `OPS_AssignmentWork`; ext-contract alleen-lezen. **Geen gedrag.** | `check-ifc-roundtrip` (fixture + canon), `check-document-contract`, `verify:cycles`; elk bestaand bestand byte-identiek |
| 2 | Importvertaling (§4.2) voor .mpp, MSPDI (incl. `<Type>`/`<EffortDriven>` lezen), P6 XML, XER; export MSPDI/P6 XML met de werkvelden; waarschuwingen | fidelity-poort blijft 0 (`GOAL_ZERO_DEVIATIONS`); `check-mpp-*`, `check-adapters-*`; nieuwe fixtures per bron |
| 3 **(gebouwd 2026-09-05)** | Pure module `src/engine/work/workTriangle.ts`: `applyDurationEdit`, `applyUnitsEdit`, `applyWorkEdit`, `applyTaskWorkEdit`, `applyAssignmentAdded`, `applyAssignmentRemoved`, `applyRuleChange` — invoer: de RESTERENDE toestand (`TriangleState`: regel, bewaard `effortDriven`, restduur in werkminuten, per toewijzing inzet + optioneel restwerk + `drivesDuration`), uitvoer: een nieuwe toestand of een weigering met reden; nooit een store. `WorkRule` in `src/types/workRule.ts` (verhuist in stap 1 naar `task.ts`). Plus `work-triangle-cases.json` (§9) | `tests/planning/check-work-triangle.ts`: 332 checks, 39 cases (21 documented, 16 reasoned, 2 decided, 0 measured; bij een mengvorm telt het zwakste bewijs) plus eigenschappen: geen veld geschreven onder de inzetregels, typewissel in alle 16 richtingen getalvrij, weigering bij restduur ≤ 0 of niet-eindige inzet (§6.7), `effortDriven` zonder effect buiten de twee 8-B-cellen |
| 4 **(gebouwd 2026-09-05)** | Brug `src/engine/work/workRuleApply.ts` (`captureTriangle` → kernstap → `applyTriangleResult`; `settleDurationEdit`/`settleUnitsEdit`/`planWorkEdit`+`commitTrianglePlan`/`settleAssignmentAdded`/`settleAssignmentRemoved`/`settleAssignmentPlan`/`settleRuleChange`; `contourKeepsWork`; `reconcileContourWork` = besluit 3 "vorm blijft, hoogte zakt"). Bedraad in `taskSlice.updateTask` + nieuw `setTaskWorkRule`, `resourceSlice.assignResource`/`updateAssignment`/`unassignResource` + nieuw `setAssignmentWork`, `gridTransaction.ts` (celduur én de assignment-set-cel, via `AssignmentSettleOp`), `createMcpTransactions.ts` (alle tweelingen + `setAssignmentWork`/`setTaskWorkRule` op de draft), `rescaleTaskContours(…, keepWork)` uit de effectieve regel, `assignmentDayUnits` derde bron = opgeslagen werk (§6.1). Een duur die uit de driehoek komt zet `scheduleStale`, herschaalt contour + importsplits en wist het Z8-venster — precies als een duurbewerking; onder FIXED_DURATION_RATE zonder werkvelden byte-identiek | `tests/planning/check-work-rule-store.ts` (95 checks: store, raster, MCP, vierde bron, meetlat 22/23/28, voortgang > 0, uurmodus, FIXED_RATE + 8-B, materiaal in het raster, datums-zoals-opgeslagen, verplaatsen/resource verwijderen), bestaande planning- en MCP-suites groen |
| 5 **(gebouwd 2026-09-05)** | Instelling `ui.showTaskTypes` (`ops-showTaskTypes`, `settingsRegistry` + `saveShowTaskTypes` + `SettingsPanelContent`, tabblad Tijdlijn); documentveld `taskTypesVisible` (`DOCUMENT_FIELDS`, rol `none`, afgeleid in `payloadFromImport` via `hasTaskTypeData` — taak met `workRule`/`mspTaskType`/`p6DurationType`, projectstandaard, of toewijzing met werkveld — en gezet door `setTaskWorkRule`/`setAssignmentWork`/rasterbewerkingen); één melding per document (`taskTypesNotice.ts`, `notifications.taskTypesUnlocked`, `helpArticleId` → `gids-taaktypes`); selector `taskTypesUnlocked`. UI: `TaskWorkRuleField` (paneel + dialoog: keuzelijst met projectstandaard, "Beschermd: …", MSP-bijschrift 8-B), kolom **Werk (rest)** + slotjes in `TaskAssignmentsSection`, raster `task.workRule` (bewerkbare enum, `available` alleen ontsloten; typewissel legt werk vast in `gridTransaction.ts`) en `assignment.remainingWork` (tokens `naam: uren`, assignment-set via `settleWorkEdit`), `TaskColumnContext.taskTypesUnlocked`; i18n 14 locales; gids `gids-taaktypes` nl+en (12 vertalingen volgen maandelijks) Reviewronde (2026-09-05) verwerkt: B1 cross-task plakken behoudt het werk (`validateAssignmentTokens`), B2 de werkcel vergelijkt met de getoonde waarde (niet-bewerkte toewijzingen krijgen geen expliciet werk), B3 typewissel in paneel en dialoog via `setTaskWorkRule` (geen `scheduleStale`, "datums zoals opgeslagen" blijft), B4 dialoog commit de regel direct en Opslaan stuurt de duur alleen mee als de gebruiker die wijzigde, K1 meldingsgate gewist bij `newProject`, K3 elk schrijfpad (ook MCP) ontsluit, K4 werkkolom alleen waar de regel werkt, K5 werkinvoer commit op Enter/blur, K6 contour-restsom, aria-labels met resourcenaam, sectiekop; `add` in `planner_manage_assignments` kent `remainingWorkMinutes` (batch zonder tempId voor toewijzingen). K2 (crashherstel zonder melding) en K6a in de TODO | `verify:i18n`, `verify:docs`, `check-work-rule-store` secties (n)+(o), browserspec `tests/browser/work-rule.spec.ts` (keuzelijst, werk typen toets-voor-toets, inzet, undo, dialoogpad, ontsluiting), `cases-work-rule.ts` (10) |
| 6 | Resource erbij/eraf (§5 rij 4–5) inclusief contourregels (§6.3) — **vereist beslispunt 8** (genomen: 8-B). **Store/raster/MCP-kant gebouwd in stap 4** (`settleAssignmentAdded`/`Removed`, `reconcileContourWork`); wat rest is de UI-kant (stap 5) | cases 4, 5, 9, 10, 15, 19, 20, 23, 29, 30 (kern) + `check-work-rule-store` (b15–b21, d5–d9, e6–e7, f3–f4) |
| 7 **(gebouwd 2026-09-05)** | Geen nieuwe tool (39 blijft 39) maar drie bestaande tools uitgebreid: `planner_update_tasks`/`planner_add_tasks` `fields.workRule` (enum \| null, via `draft.setTaskWorkRule` ná de duurpatch — een gelijktijdige `duration` wordt onder de OUDE regel verwerkt, `taskFields.ts`), `planner_manage_assignments` `update.remainingWorkMinutes` (> 0, via `draft.setAssignmentWork`; alleen op taken waar `workRuleApplies`), `planner_update_project` `defaultWorkRule` (enum \| null, `delete` bij null); `planner_get_project_info` toont `defaultWorkRule`, `planner_get_task` toonde `workRule` + werkvelden al sinds stap 1. `REJECT_HINTS` voor `plannedWorkMinutes`/`actualWorkMinutes`/`remainingWorkMinutes` als taakveld | `tests/mcp/cases-work-rule.ts` (9 cases via de echte dispatch, incl. `planner_batch` = één undo-stap), `cases-toolregistry`/`cases-schemavalidatie` groen |
| 8 | CLAUDE.md-sectie, TODO-afvinking, `docs/superpowers/README.md` | `verify:docs` |

Stap 1–3 zijn onafhankelijk van elkaar te reviewen en veranderen niets aan wat de gebruiker ziet.

## 11. Corpusbewijs (GEMETEN — XER-sessie, 84 unieke bestanden, aangeleverd 2026-09-04)

| meting | uitkomst | wat het voor dit ontwerp betekent |
|---|---|---|
| activiteiten per duration type | DT_FixedDUR2 15.978 · DT_FixedDrtn 1.773 · DT_FixedQty 153 (2 bestanden) · DT_FixedRate 0 · niet-standaard DT_FixedDUR 24 | bouwvolgorde binnen stap 3: FIXED_DURATION_WORK → FIXED_DURATION_RATE → FIXED_WORK → FIXED_RATE (minst getest in de praktijk); de vandaag hardgecodeerde regel is de op één na meest voorkomende in P6-bestanden |
| `target_qty` wijkt >1 % af van duur × tarief | 176 van 61.618 rijen (4 met duur 0); 263 rijen met werk zonder tarief; in 5 bestanden (HarbourPointe 98/417, DCP-03 As-Built 37/47, DCP-03 Baseline 35/45, p6_torture_test 5/45, testXer 1/90) | "afwezig ⇒ afgeleid" is voor 99,7 % van de rijen verliesvrij; de XER-afspraak "alleen overzetten bij afwijking" is dus goedkoop |
| toewijzingen met een curve | 2 rijen, 1 bestand | curves + werkregels: lage prioriteit, wel correct (§6.3) |
| verricht werk op DT_FixedQty | 1 rij | case 17 (verricht werk op een vast-werk-taak) heeft géén corpusdekking — puur beredeneerd |
| `remain_qty_per_hr` ≠ `target_qty_per_hr` | rehab-2 14.459/52.640 · DCP-03 As-Built 47/47 · Baseline 45/45 · Roads 71/3.575 · HarbourPointe 14/417 | het resttarief is een eigen grootheid ⇒ drie werkvelden (beslispunt 9) |

Het corpus staat bij de eigenaar (`~/open-aec/voor claude/testdata-crawl`, env `OPS_XER_CORPUS`),
niet in de repo; de tabellen staan daar in `/tmp/xer-overname/corpusscan-werk-2.md`. Een telling
van `mspTaskType × effortDriven` over de .mpp-crawl (216 bestanden) ontbreekt nog (§12).

## 12. Wat dit ontwerp bewust laat liggen (→ `docs/TODO.md`)

- **MSP-meetlat**: de 31 bewerkingen uit §9 meten in MS Project (en P6) zodra iemand het heeft.
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
- [M5] *Remaining Duration (task field)* — https://support.microsoft.com/en-us/project/remaining-duration-task-field
  (geraadpleegd 2026-09-05: "Remaining Duration = Duration − Actual Duration"; een wijziging van de
  restduur laat Project de duur herrekenen als rest + werkelijke duur)
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
