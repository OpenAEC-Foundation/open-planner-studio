# Open Planner Studio — Projectplan

## 1. Visie & Doelstelling

**Open Planner Studio** is een open-source bouwplanningapplicatie gericht op de **bouwsector**. Het combineert Critical Path Method (CPM) scheduling, Gantt-diagrammen, Work Breakdown Structure (WBS) en 4D BIM-koppeling in een desktopapplicatie. Het native bestandsformaat is **IFC (Industry Foundation Classes)**, conform de IFC 4.3-standaard van buildingSMART.

### Kernprincipes
- **Open standaard**: IFC als enig projectformaat — geen vendor lock-in
- **Bouwsector-specifiek**: dependencies, fases, locatie-gebaseerd plannen, inspectiemomenten
- **4D BIM-ready**: koppeling van taken aan IFC-gebouwonderdelen voor visuele bouwsimulatie
- **Lean Construction**: ondersteuning voor Last Planner System en look-ahead planning
- **AI-gestuurd**: MCP-server voor integratie met Claude en andere AI-assistenten
- **Europees & Nederlands**: specifieke ondersteuning voor BRL, RAW, UAV-gc, STABU, Lean Planning

---

## 2. Marktonderzoek — Planningssoftware in de Bouw

### 2.1 Overzicht van alle bekende planningsprogramma's

#### A. Internationaal (wereldwijd gebruikt)

| Software | Leverancier | Land | Marktsegment | Prijs (indicatie) |
|----------|-------------|------|-------------|-------------------|
| **Oracle Primavera P6** | Oracle | VS | Enterprise, grote infra/bouw | ~€3.500-5.000/jr |
| **Microsoft Project** | Microsoft | VS | Generiek projectmanagement | ~€600-1.400/jr |
| **Microsoft Project for the Web** | Microsoft | VS | Cloud-first, lichtgewicht | Onderdeel M365 |
| **Asta Powerproject** | Elecosoft | VK | Bouwspecifiek, VK/EU populair | ~€1.200-2.500/jr |
| **Synchro Pro** (nu Bentley) | Bentley Systems | VS/VK | 4D BIM, grote bouwprojecten | ~€3.000-6.000/jr |
| **TILOS** | Trimble | VS/DE | Lineaire projecten (wegen, spoor, tunnels) | ~€2.500-4.000/jr |
| **Navisworks** (4D module) | Autodesk | VS | 4D BIM simulatie (geen scheduling) | ~€2.000/jr |
| **Procore** (scheduling module) | Procore | VS | Bouwmanagement platform + planning | ~€5.000+/jr |
| **Smartsheet** | Smartsheet | VS | Spreadsheet-achtig, Gantt | ~€200-500/jr |
| **Monday.com** | Monday.com | IL | Generiek PM met Gantt-weergave | ~€100-400/jr |
| **Wrike** | Citrix | VS | Enterprise PM met Gantt | ~€200-500/jr |
| **TeamGantt** | TeamGantt | VS | Eenvoudig online Gantt | ~€50-200/jr |
| **GanttProject** | Open source | — | Gratis desktop Gantt | Gratis |
| **ProjectLibre** | Open source | — | MS Project alternatief | Gratis |
| **OpenProject** | OpenProject GmbH | DE | Open-source PM (web-based) | Gratis/€25+/mnd |
| **Merlin Project** | ProjectWizards | DE | macOS-native PM tool | ~€150-350 |
| **Safran Project** | Safran | NO | Risk-based scheduling | ~€3.000-8.000/jr |
| **Spider Project** | Spider Project | RU | CPM/resource leveling specialist | ~€1.000-3.000 |
| **Elecosoft Powerproject BIM** | Elecosoft | VK | 4D BIM planning | ~€2.500-4.000/jr |
| **Vico Office** | Trimble | VS/FI | 5D BIM (planning + kosten) | ~€3.000-5.000/jr |
| **Bexel Manager** | Bexel Consulting | RS | 4D/5D BIM management | ~€2.000-4.000/jr |
| **Acconex/Oracle Aconex** | Oracle | AU | Document & planningsbeheer | ~€1.000-3.000/jr |
| **Buildots** | Buildots | IL | AI-gestuurde voortgangsmonitoring | Op aanvraag |
| **Aphex** | Aphex | VK | Lean Construction scheduling | ~€500-2.000/jr |
| **Touchplan** | Touchplan | VS | Digitaal Last Planner System | ~€500-1.500/jr |
| **VPlanner** | VPlanner | FI | Visueel Lean/LPS plannen | ~€500-2.000/jr |
| **LeanStation** | Various | — | LPS-specifieke tooling | Varieert |
| **Phoenix Project Manager** | Phoenix PM | VK | Bouwplanning, claim analyse | ~€1.500-3.000/jr |
| **Elecosoft Site Progress Mobile** | Elecosoft | VK | Mobiele voortgangsregistratie | ~€500/jr |
| **Fieldwire** | Hilti/Fieldwire | VS | Veldbeheer + taakplanning | ~€300-600/jr |
| **PlanGrid** (nu Autodesk Build) | Autodesk | VS | Veld-/bouwtekeningen + planning | ~€500-1.500/jr |
| **Sablono** | Sablono | DE | Production control & tracking | ~€1.000-3.000/jr |
| **Dalux** | Dalux | DK | BIM viewer + kwaliteitscontrole | ~€500-2.000/jr |
| **Catenda Hub** (BIMsync) | Catenda | NO | openBIM platform met planning | Varieert |

#### B. Duits/DACH-specifiek

| Software | Leverancier | Marktsegment | Bijzonderheden |
|----------|-------------|-------------|----------------|
| **Powerproject (DACH)** | Elecosoft/Asta | Grote bouw | Duits-talige versie, VOB/B-ondersteuning |
| **Newforma Konject** | Newforma | Projectcommunicatie | Documentbeheer + planning |
| **GRANID** | GRANID | Bouwplanning | Duitse bouwspecifiek, Terminplanung |
| **A-Plan** | braintool | Projectmanagement | Lichtgewicht PM, populair in MKB |
| **in-STEP BLUE** | microTOOL | Projectmanagement | Proces- en projectmanagement |
| **Aeneis** | Aeneis | BPM/Planning | Procesmanagement |
| **MS Project + VOB/B templates** | Microsoft | Generiek | Veel gebruikt in DE met Duitse templates |
| **California.pro** | G&W Software | AVA/Baukalkulation | Kostenraming + eenvoudige planning |
| **ARRIBA** | RIB Software (Schneider Electric) | Bouwkostencalculatie | Planning als onderdeel van iTWO |
| **iTWO** | RIB Software (Schneider Electric) | 5D BIM platform | Volledige BIM + planning + kosten |
| **BauSU** | BauSU GmbH | Baustellenmanagement | Eenvoudige Bauzeitenplanung |
| **Cycot** | Cycot | Terminplanung | Specifiek voor Bauzeitenplanung |
| **Paul** | IBS Engineering | Bauzeitenplan | Eenvoudig, populair bij kleine bedrijven |
| **Linea** | Linea | Lineaire planning | Weg- en spoorprojecten, vergelijkbaar met TILOS |

#### C. Nederlands/Belgisch-specifiek

| Software | Leverancier | Marktsegment | Bijzonderheden |
|----------|-------------|-------------|----------------|
| **MS Project** (meest gebruikt) | Microsoft | Generiek | >60% marktaandeel NL bouw |
| **Asta Powerproject** | Elecosoft | Grote bouw/GWW | Populair bij grote aannemers |
| **Primavera P6** | Oracle | Infra/grote projecten | Rijkswaterstaat, ProRail |
| **Relatics** | Relatics | Systems Engineering + planning | UAV-gc, SE-ondersteuning |
| **VISI** | CROW | Bouwcommunicatie | Standaard communicatieprotocol NL |
| **BouwConnect** | Diverse | Koppelingsplatform | Integratie planning-financieel |
| **PlanRadar** | PlanRadar | Kwaliteitscontrole | Opname/inspectie met planning |
| **Greycon** | Greycon | Supply chain planning | Productie- en logistieke planning |
| **Last Planner tools** | Diverse | Lean Construction | Excel/post-its/digitale borden |
| **BIM360/Autodesk Construction Cloud** | Autodesk | Platform | Wordt in NL steeds meer gebruikt |
| **Trimble Connect** | Trimble | BIM Platform | Planning-integratie |

#### D. Scandinavisch/Europees

| Software | Leverancier | Land | Bijzonderheden |
|----------|-------------|------|----------------|
| **VPlanner** | VPlanner | FI | Takt planning, Last Planner System |
| **Dalux** | Dalux | DK | BIM-first, kwaliteitsborging |
| **StreamBIM** | Rendra | NO | BIM streaming + planning |
| **Tocoman** | Tocoman | FI | 5D BIM, kosten + planning |
| **dRofus** | Norconsult | NO | Programmering/ruimteplanning |
| **Bluebeam Revu** | Bluebeam | VS/DK | PDF markup met planning-notities |

---

### 2.2 Complete feature-inventarisatie per categorie

Hieronder een exhaustieve opsomming van **alle denkbare functionaliteiten** in bouwplanningssoftware, gebaseerd op analyse van alle bovengenoemde producten.

#### A. Kernplanning (Scheduling)

| # | Feature | P6 | MSP | Asta | Synchro | TILOS | OPS (doel) |
|---|---------|-----|-----|------|---------|-------|------------|
| A1 | **Gantt-diagram** (balk-diagram) | v | v | v | v | v | v |
| A2 | **CPM** (Critical Path Method) | v | v | v | v | v | v |
| A3 | **PERT** (Program Evaluation & Review Technique) | v | v | - | - | - | v |
| A4 | **PDM** (Precedence Diagramming Method) | v | v | v | v | - | v |
| A5 | **Netwerkdiagram** (Activity-on-Node) | v | v | v | - | - | v |
| A6 | **Forward pass** (vroegste tijden) | v | v | v | v | v | v |
| A7 | **Backward pass** (laatst toelaatbare tijden) | v | v | v | v | v | v |
| A8 | **Totale float** berekening | v | v | v | v | v | v |
| A9 | **Vrije float** berekening | v | v | v | v | v | v |
| A10 | **Interfering float** | v | - | v | - | - | v |
| A11 | **Onafhankelijke float** | v | - | - | - | - | v |
| A12 | **Negatieve float** (deadline overschrijding) | v | v | v | v | - | v |
| A13 | **Meerdere kritieke paden** | v | v | v | v | - | v |
| A14 | **Near-critical path** analyse | v | - | v | - | - | v |
| A15 | **Datum-constraints** (ASAP, ALAP, SNET, SNLT, FNET, FNLT, MFO, MSO) | v | v | v | v | - | v |
| A16 | **Deadline-datum** per taak | v | v | v | v | - | v |
| A17 | **Hammock-taken** (samengevat duur) | v | v | v | - | - | v |
| A18 | **Summary/Group-taken** (rollup) | v | v | v | v | - | v |
| A19 | **Externe dependencies** (cross-project links) | v | v | v | - | - | v |
| A20 | **Multiple calendars** per project | v | v | v | v | v | v |
| A21 | **Task calendar** (individuele kalender per taak) | v | v | v | - | - | v |
| A22 | **Elapsed duration** (doorlopend incl. weekenden) | v | v | v | v | v | v |
| A23 | **Percentage gereed** (fysiek / duur / uren) | v | v | v | v | v | v |
| A24 | **Remaining duration** tracking | v | v | v | v | - | v |
| A25 | **Out-of-sequence progress** detectie | v | - | v | - | - | v |
| A26 | **Progress override** (Retained Logic / Progress Override) | v | - | v | - | - | v |
| A27 | **Scheduling options** (keuze uit berekeningsmethoden) | v | v | v | - | - | v |
| A28 | **Circulaire dependency-detectie** | v | v | v | v | - | v |
| A29 | **Probabilistische duurschatting** (3-point: optimistisch, realistisch, pessimistisch) | v | - | v | - | - | v |
| A30 | **Monte Carlo simulatie** (risico-analyse) | - | - | v* | - | - | v |

#### B. Dependencies & Relaties

| # | Feature | P6 | MSP | Asta | Synchro | TILOS | OPS |
|---|---------|-----|-----|------|---------|-------|-----|
| B1 | **Finish-to-Start** (FS) | v | v | v | v | v | v |
| B2 | **Start-to-Start** (SS) | v | v | v | v | v | v |
| B3 | **Finish-to-Finish** (FF) | v | v | v | v | v | v |
| B4 | **Start-to-Finish** (SF) | v | v | v | v | v | v |
| B5 | **Positieve lag** (vertraging) | v | v | v | v | v | v |
| B6 | **Negatieve lag** (lead/overlap) | v | v | v | v | v | v |
| B7 | **Lag in werkdagen vs. kalenderdagen** | v | v | v | - | - | v |
| B8 | **Procentuele lag** (bijv. SS+50%) | - | - | v | - | - | v |
| B9 | **Visueel dependencies tekenen** (drag & drop) | - | v | v | v | - | v |
| B10 | **Dependency-matrix/tabel** | v | - | v | - | - | v |
| B11 | **Driving/non-driving relationships** markering | v | - | v | - | - | v |
| B12 | **Path tracing** (trace voorgangers/opvolgers) | v | v | v | v | - | v |
| B13 | **Relationship filter** (toon alleen relaties van selectie) | v | - | v | - | - | v |

#### C. WBS & Structuur

| # | Feature | P6 | MSP | Asta | OPS |
|---|---------|-----|-----|------|-----|
| C1 | **WBS-hierarchie** (onbeperkte diepte) | v | v | v | v |
| C2 | **WBS-codes** (gestructureerd, bijv. 1.2.3.4) | v | v | v | v |
| C3 | **OBS** (Organization Breakdown Structure) | v | - | v | v |
| C4 | **CBS** (Cost Breakdown Structure) | v | - | v | v |
| C5 | **RBS** (Resource Breakdown Structure) | v | - | v | v |
| C6 | **EBS** (Element Breakdown Structure, NL-specifiek) | - | - | - | v |
| C7 | **Activity codes** (vrij definieerbare categorisering) | v | v | v | v |
| C8 | **Custom fields** (gebruikersvelden) | v | v | v | v |
| C9 | **Inklapbare groepen** | v | v | v | v |
| C10 | **Summary-taken met rollup statistieken** | v | v | v | v |
| C11 | **Meerdere WBS-indelingen** (bijv. per locatie EN per discipline) | v | - | v | v |
| C12 | **Kopieer/plak WBS-takken** | v | v | v | v |
| C13 | **WBS-templates** (herbruikbare structuren) | v | v | v | v |
| C14 | **WBS-dictionary** (beschrijvingen per node) | v | - | v | v |
| C15 | **Fasering/fasecodering** | v | v | v | v |

#### D. Resources & Kosten

| # | Feature | P6 | MSP | Asta | OPS |
|---|---------|-----|-----|------|-----|
| D1 | **Arbeid-resources** (mensen, ploegen) | v | v | v | v |
| D2 | **Materieel-resources** (kranen, machines) | v | v | v | v |
| D3 | **Materiaal-resources** (beton, staal) | v | v | v | v |
| D4 | **Onderaannemers als resource** | v | v | v | v |
| D5 | **Resource-kalenders** (beschikbaarheid per resource) | v | v | v | v |
| D6 | **Resource-histogram** | v | v | v | v |
| D7 | **Resource-nivellering** (automatisch) | v | v | v | v |
| D8 | **Resource-smoothing** (minimaliseer pieken zonder deadline te verplaatsen) | v | v | v | v |
| D9 | **Resource overallocatie-detectie** | v | v | v | v |
| D10 | **Kostenberekening per taak** (uren x tarief) | v | v | v | v |
| D11 | **Budget vs. actual kosten** | v | v | v | v |
| D12 | **Earned Value Management** (EVM) | v | v | v | v |
| D13 | **S-curve** (cumulatieve voortgang/kosten) | v | v | v | v |
| D14 | **Resource-curves** (front-loaded, back-loaded, bell curve) | v | - | v | v |
| D15 | **Team/ploeg-toewijzing** | v | v | v | v |
| D16 | **Resource-pools** (gedeeld tussen projecten) | v | v | v | v |
| D17 | **Capaciteitsplanning** | v | v | v | v |
| D18 | **Tijdregistratie/timesheets** | v | v | - | v |
| D19 | **Cost loading** (kosten verspreid over taakduur) | v | v | v | v |
| D20 | **Cashflow-prognose** | v | - | v | v |
| D21 | **Kostencurve** (gepland vs. werkelijk) | v | v | v | v |

#### E. Kalender & Tijdbeheer

| # | Feature | P6 | MSP | Asta | OPS |
|---|---------|-----|-----|------|-----|
| E1 | **Werkweek-definitie** (ma-vr, ma-za, 7 dagen) | v | v | v | v |
| E2 | **Werkuren per dag** (bijv. 07:00-16:00) | v | v | v | v |
| E3 | **Feestdagen** (per land) | v | v | v | v |
| E4 | **Nederlandse feestdagen** (Koningsdag, Bevrijdingsdag, etc.) | - | - | - | v |
| E5 | **Duitse feestdagen** (per Bundesland!) | - | - | - | v |
| E6 | **Bouwvakvakantie** (NL: regio Noord/Midden/Zuid) | - | - | - | v |
| E7 | **Winterstop/vorstperiode** | - | - | v | v |
| E8 | **Seizoensgebonden kalenders** | - | - | v | v |
| E9 | **Meerdere kalenders** (dag/nacht ploegen) | v | v | v | v |
| E10 | **Uitzonderingsdagen** (speciale werk/vrije dagen) | v | v | v | v |
| E11 | **Uren-based scheduling** (naast dagen) | v | v | v | v |
| E12 | **Minuten-based scheduling** (voor korte taken) | v | - | v | v |
| E13 | **24-uurs kalender** (continuous operations) | v | v | v | v |
| E14 | **Regionale kalendersets** (NL/DE/BE/etc.) | - | - | - | v |

#### F. Weergaven & Visualisatie

| # | Feature | P6 | MSP | Asta | Synchro | OPS |
|---|---------|-----|-----|------|---------|-----|
| F1 | **Gantt-diagram** | v | v | v | v | v |
| F2 | **Netwerkdiagram** (PDM/PERT) | v | v | v | - | v |
| F3 | **Tijdschalen** (uur/dag/week/maand/kwartaal/jaar) | v | v | v | v | v |
| F4 | **Dual tijdas** (bijv. maand + week) | v | v | v | v | v |
| F5 | **Zoom & pan** | v | v | v | v | v |
| F6 | **Kritiek pad markering** (kleur) | v | v | v | v | v |
| F7 | **Float-weergave** (als lijn achter balk) | v | v | v | - | v |
| F8 | **Baseline-vergelijking** (overlay) | v | v | v | v | v |
| F9 | **Progress-markering** (donkere balk in taak) | v | v | v | v | v |
| F10 | **Deadline-markering** (symbool) | v | v | v | - | v |
| F11 | **Constraint-indicatoren** | v | v | v | - | v |
| F12 | **Resource-histogram** onder Gantt | v | v | v | - | v |
| F13 | **Taakinfo in tooltip** | v | v | v | v | v |
| F14 | **Statusdatum-lijn** (vandaag-lijn) | v | v | v | v | v |
| F15 | **Meerdere statuslijnen** | v | v | v | - | v |
| F16 | **Kalenderweergave** (maandoverzicht) | - | v | - | - | v |
| F17 | **Tijdlijn-weergave** (Timeline view) | - | v | - | - | v |
| F18 | **Line of Balance** (LOB / tijd-locatie diagram) | - | - | v | - | v |
| F19 | **Tijd-weg diagram** (lineaire planning) | - | - | - | - | v* |
| F20 | **Takenlijst/spreadsheet** (tabel links) | v | v | v | v | v |
| F21 | **Kolom-aanpassing** (kies welke velden zichtbaar) | v | v | v | v | v |
| F22 | **Groeperen op veld** (WBS, fase, resource) | v | v | v | - | v |
| F23 | **Sorteren** (op elk veld) | v | v | v | v | v |
| F24 | **Filteren** (op elk veld, AND/OR) | v | v | v | v | v |
| F25 | **Custom layouts** (opslaan/laden) | v | v | v | - | v |
| F26 | **Kleurcodering** (per status, type, fase) | v | v | v | v | v |
| F27 | **Dark mode / Light mode** | - | - | - | - | v |
| F28 | **Presentation mode** (full screen Gantt) | - | - | v | v | v |
| F29 | **Mini-map** (overzicht van hele planning) | - | - | - | - | v |
| F30 | **Split view** (meerdere planningen naast elkaar) | v | v | v | - | v |

*v = beschikbaar, - = niet beschikbaar, v* = deels/via plugin

#### G. Baselines & Voortgang

| # | Feature | P6 | MSP | Asta | OPS |
|---|---------|-----|-----|------|-----|
| G1 | **Baseline opslaan** (snapshot) | v | v | v | v |
| G2 | **Meerdere baselines** (tot 11 in MSP, onbeperkt in P6) | v | v | v | v |
| G3 | **Baseline vergelijken** (visueel overlay) | v | v | v | v |
| G4 | **Baseline-variance rapport** | v | v | v | v |
| G5 | **Statusdatum instellen** | v | v | v | v |
| G6 | **Voortgang registreren** (% gereed, actuele start/eind) | v | v | v | v |
| G7 | **Voortgangslijnen** (progress lines in Gantt) | - | v | v | v |
| G8 | **Earned Value** (BCWP, BCWS, ACWP, CPI, SPI) | v | v | v | v |
| G9 | **Schedule Performance Index** (SPI) | v | v | v | v |
| G10 | **Cost Performance Index** (CPI) | v | v | v | v |
| G11 | **Estimate at Completion** (EAC) | v | v | v | v |
| G12 | **Trend-analyse** (voortgang per week/maand) | v | - | v | v |
| G13 | **Claims-analyse** (delay analysis, TIA) | v | - | v | v |
| G14 | **Window analysis** (period-by-period delay) | v | - | v | v |
| G15 | **As-planned vs. As-built** vergelijking | v | v | v | v |

#### H. Import/Export & Interoperabiliteit

| # | Feature | P6 | MSP | Asta | OPS |
|---|---------|-----|-----|------|-----|
| H1 | **IFC 4.3 (native)** | - | - | - | v |
| H2 | **MS Project XML** import/export | v | v | v | v |
| H3 | **MS Project MPP** import | - | v | v | v |
| H4 | **Primavera P6 XER** import/export | v | - | v | v |
| H5 | **Primavera XML (PMXML)** import/export | v | - | v | v |
| H6 | **CSV/Excel** import/export | v | v | v | v |
| H7 | **PDF-export** (Gantt als PDF) | v | v | v | v |
| H8 | **PNG/SVG-export** (Gantt als afbeelding) | - | v | v | v |
| H9 | **Asta Powerproject PP** import | - | - | v | v |
| H10 | **SDEF** (Standard Data Exchange Format, US Army Corps) | v | - | - | v |
| H11 | **UN/CEFACT XML** | - | - | - | v |
| H12 | **JSON API** (REST/GraphQL) | - | - | - | v |
| H13 | **IFC-model importeren** (3D gebouwmodel) | - | - | v | v |
| H14 | **bcf (BIM Collaboration Format)** | - | - | - | v |
| H15 | **BPMN** (Business Process Model & Notation) | - | - | - | v |
| H16 | **iCalendar (.ics)** export | - | - | - | v |
| H17 | **Clipboard** (kopieer taken naar Excel) | v | v | v | v |

#### I. 4D/5D BIM

| # | Feature | Synchro | Asta | Navisworks | OPS |
|---|---------|---------|------|------------|-----|
| I1 | **3D model laden** (IFC/Revit/DWG) | v | v | v | v |
| I2 | **Taken koppelen aan 3D-elementen** | v | v | v | v |
| I3 | **4D simulatie** (tijdlijn-animatie) | v | v | v | v |
| I4 | **Bouwfase-visualisatie** (kleurcodering per status) | v | v | v | v |
| I5 | **Clashdetectie** (gelijktijdige werken) | v | - | v | v |
| I6 | **Kraanplanning** (bereik, hijszones) | v | - | - | v |
| I7 | **Bouwplaatsinrichting** (logistics) | v | - | - | v |
| I8 | **5D kosten-koppeling** aan model | v* | - | - | v |
| I9 | **Quantity takeoff** vanuit BIM | v* | - | - | v |
| I10 | **BIM-model sectie/verdieping filteren** | v | v | v | v |

#### J. Lean Construction & Last Planner System

| # | Feature | VPlanner | Touchplan | Aphex | OPS |
|---|---------|----------|-----------|-------|-----|
| J1 | **Master Schedule** (overall planning) | v | v | v | v |
| J2 | **Phase Planning** (pull planning) | v | v | v | v |
| J3 | **Look-ahead Planning** (6-8 weken vooruit) | v | v | v | v |
| J4 | **Weekly Work Plan** (weekplanning) | v | v | v | v |
| J5 | **Commitment tracking** (toezeggingen) | v | v | v | v |
| J6 | **PPC** (Percent Plan Complete) | v | v | v | v |
| J7 | **Variance/Root Cause analysis** | v | v | v | v |
| J8 | **Constraint log** (belemmmeringen-register) | v | v | v | v |
| J9 | **Takt planning** (repetitieve eenheden) | v | - | - | v |
| J10 | **Kanban-bord** (visueel taakbeheer) | - | v | v | v |
| J11 | **Digitaal post-it bord** (collaborative planning) | v | v | v | v |
| J12 | **Dagstart-bord** (daily huddle dashboard) | - | - | v | v |
| J13 | **Constraint-ready indicator** (taak kan starten) | v | v | v | v |
| J14 | **Make-ready process** tracking | v | v | v | v |
| J15 | **Reliable promising** (belofte-registratie) | v | v | v | v |

#### K. Rapportage & Afdrukken

| # | Feature | P6 | MSP | Asta | OPS |
|---|---------|-----|-----|------|-----|
| K1 | **Afdrukken** naar printer | v | v | v | v |
| K2 | **PDF-export** | v | v | v | v |
| K3 | **Multi-page printing** (A3/A1 tiling) | v | v | v | v |
| K4 | **Rapport-wizard** | v | v | v | v |
| K5 | **Standaard rapporten** (taaklijst, kritiek pad, resources) | v | v | v | v |
| K6 | **Custom rapporten** | v | v | v | v |
| K7 | **Grafische rapporten** (histogrammen, pie charts) | v | v | v | v |
| K8 | **Executive dashboard** | v | - | v | v |
| K9 | **Voortgangsrapport** (per periode) | v | v | v | v |
| K10 | **Look-ahead rapport** (komende weken) | v | - | v | v |
| K11 | **Resource-rapport** | v | v | v | v |
| K12 | **Kostenrapport** | v | v | v | v |
| K13 | **Earned Value rapport** | v | v | v | v |
| K14 | **Delay-rapport** (vertragingsanalyse) | v | - | v | v |
| K15 | **Opleverpuntenlijst** | - | - | - | v |

#### L. Samenwerking & Communicatie

| # | Feature | P6 | MSP | Procore | OPS |
|---|---------|-----|-----|---------|-----|
| L1 | **Multi-user** (gelijktijdig bewerken) | v | v* | v | v |
| L2 | **Gebruikersrechten/rollen** | v | v | v | v |
| L3 | **Audit trail** (wijzigingslog) | v | v | v | v |
| L4 | **Notificaties** (e-mail/push bij wijzigingen) | v | v | v | v |
| L5 | **Commentaar per taak** | v | v | v | v |
| L6 | **Bijlagen per taak** (foto's, documenten) | - | v | v | v |
| L7 | **Subcontractor-portal** (beperkte toegang) | v | - | v | v |
| L8 | **Mobile app** (iOS/Android) | v | v | v | v |
| L9 | **Offline mode** | - | v | - | v |
| L10 | **Realtime sync** (WebSocket) | v | v* | v | v |
| L11 | **VISI-koppeling** (NL bouwcommunicatiestandaard) | - | - | - | v |

#### M. Automatisering & AI

| # | Feature | Bestaande tools | OPS |
|---|---------|----------------|-----|
| M1 | **Macro's/scripting** (VBA, Python) | P6, MSP | v |
| M2 | **API** (REST/GraphQL) | P6, Procore | v |
| M3 | **MCP-server** (AI-integratie) | - | v |
| M4 | **AI planning-suggesties** | Buildots | v |
| M5 | **AI risico-analyse** | - | v |
| M6 | **Automatische resource-toewijzing** | P6 | v |
| M7 | **Templates/sjablonen** | alle | v |
| M8 | **Regels/triggers** (als X dan Y) | P6 | v |
| M9 | **Batch-updates** | P6, MSP | v |
| M10 | **AI-gestuurde duurschatting** | - | v |
| M11 | **Natural language planning** ("plan fundering in week 10") | - | v |
| M12 | **Automatische clash/conflict detectie** | Synchro | v |
| M13 | **Weather-risk integration** (weersvoorspelling impact) | - | v |

#### N. Nederlandse/Europese Specifieke Features

| # | Feature | Beschrijving | Bestaande tools | OPS |
|---|---------|-------------|----------------|-----|
| N1 | **RAW-systematiek** | Standaard RAW-besteksposten koppelen aan taken | Geen | v |
| N2 | **STABU-integratie** | STABU-bestekscodes in WBS | Geen | v |
| N3 | **UAV-gc ondersteuning** | Systems Engineering integratie, V&V-planning | Relatics | v |
| N4 | **BRL-normen** | Beoordelingsrichtlijnen koppelen aan inspectiemomenten | Geen | v |
| N5 | **Wkb (Wet kwaliteitsborging)** | Kwaliteitsborgingsplan koppelen aan planning | Geen | v |
| N6 | **CROW-publicaties** | CROW richtlijnen integreren (bijv. CROW 400) | Geen | v |
| N7 | **Nederlandse aanbestedingsfasen** | Conform Aanbestedingswet 2012 | Geen | v |
| N8 | **VOB/B** (Duits) | Duitse bouwregelgeving, Terminplanung | iTWO | v |
| N9 | **HOAI-fasen** (Duits) | Leistungsphasen 1-9 als planningsstructuur | iTWO | v |
| N10 | **CE-markering planning** | Keuringsmomenten voor CE-markering | Geen | v |
| N11 | **Bouwveiligheid** (V&G-plan) | Veiligheidsmaatregelen als taken | Geen | v |
| N12 | **Omgevingsvergunning-milestones** | Vergunningentraject als planning | Geen | v |
| N13 | **BREEAM/LEED-planning** | Duurzaamheidscertificering in planning | Geen | v |
| N14 | **Energielabel-planning** | EPC-berekening momenten | Geen | v |
| N15 | **Asbestinventarisatie-planning** | Verplichte stappen conform wetgeving | Geen | v |
| N16 | **Bouwlogistiek** (BLVC-plan) | Bereikbaarheid, Leefbaarheid, Veiligheid, Communicatie | Geen | v |
| N17 | **Stikstof/PFAS-planning** | Milieumaatregelen als constraints | Geen | v |
| N18 | **Europese feestdagensets** | Per land configureerbaar (NL/DE/BE/FR/VK/etc.) | Geen | v |

---

### 2.3 Wat gebruikers missen — Pijnpunten per tool

#### Microsoft Project — Veelgenoemde tekortkomingen
1. **Geen bouwspecifieke features** — het is een generiek PM-tool, niet ontworpen voor de bouw
2. **Slechte multi-user samenwerking** — bestandslocking, geen realtime co-editing
3. **Duur per gebruiker** — €600+/jaar voor iets dat eigenlijk een spreadsheet met Gantt is
4. **Geen 4D BIM-integratie** — los product, geen koppeling aan 3D-modellen
5. **Complexe resource-leveling** — onvoorspelbaar, moeilijk te controleren
6. **Geen Lean/LPS** — geen ondersteuning voor Last Planner System
7. **Lastige import/export** — P6-bestanden importeren gaat matig
8. **Geen bouwvak/feestdagen** — Nederlandse specifieke kalender ontbreekt
9. **Geen claim-analyse** — geen delay analysis tooling
10. **Vendor lock-in** — .mpp formaat is proprietary

#### Oracle Primavera P6 — Veelgenoemde tekortkomingen
1. **Extreem steile leercurve** — complexe interface, lange training nodig
2. **Zeer duur** — onbetaalbaar voor MKB-aannemers
3. **Verouderde UI** — Java-based interface voelt gedateerd (jaren 2000-look)
4. **Geen 4D BIM** — moet via Synchro, apart product
5. **Trage performance** — bij grote projecten (>5.000 taken) wordt het traag
6. **Overkill voor kleinere projecten** — te zwaar voor een woningbouwproject
7. **Geen Lean/LPS** — geen Last Planner System ondersteuning
8. **Oracle-ecosysteem** — vendor lock-in in Oracle-stack
9. **Beperkte visualisatie** — Gantt is functioneel maar niet mooi
10. **Geen AI-integratie** — volledig handmatig werk

#### Asta Powerproject — Veelgenoemde tekortkomingen
1. **Alleen Windows** — geen macOS of Linux versie
2. **Minder bekend** — kleiner ecosysteem, minder tutorials/community
3. **Dure BIM-module** — 4D BIM is een premium add-on
4. **Geen cloud-native** — primair desktop-applicatie
5. **Beperkte API** — moeilijk te automatiseren
6. **Geen Lean/LPS** — geen ingebouwd Last Planner System
7. **Geen IFC-native** — eigen bestandsformaat

#### Synchro Pro — Veelgenoemde tekortkomingen
1. **Zeer duur** — €3.000-6.000/jaar
2. **Zwaar** — vereist krachtige hardware voor 4D simulatie
3. **Steile leercurve** — complexe 4D workflow
4. **Bentley-ecosysteem** — vendor lock-in
5. **Geen Lean/LPS** — focus op 4D, niet op dagelijkse planning

#### TILOS — Veelgenoemde tekortkomingen
1. **Niche-product** — alleen geschikt voor lineaire projecten
2. **Duur** — €2.500-4.000/jaar
3. **Beperkte Gantt** — focus op tijd-weg diagram
4. **Steile leercurve** — onconventionele interface
5. **Geen BIM** — geen 3D/4D integratie

#### Lean/LPS tools (VPlanner, Touchplan, Aphex) — Veelgenoemde tekortkomingen
1. **Geen CPM-integratie** — los van de "echte" planning
2. **Dubbel werk** — master schedule in MSP/P6, weekplanning in LPS-tool
3. **Geen export naar MSP/P6** — slechte interoperabiliteit
4. **Duur voor wat het is** — betalen voor wat eigenlijk post-its op een bord zijn
5. **Geen resource-management** — focus op toezeggingen, niet op capaciteit

#### Algemene pijnpunten (cross-tool)
1. **Hoge kosten** — professionele tools kosten €600-6.000 per jaar per gebruiker
2. **Vendor lock-in** — proprietary formaten (.mpp, .xer, .pp) maken wisselen lastig
3. **Geen open standaard** — geen enkele tool gebruikt IFC als native formaat
4. **Slechte interoperabiliteit** — import/export tussen tools verliest data
5. **Geen AI** — alle tools zijn volledig handmatig
6. **Geen Nederlandse bouwspecifieke features** — geen RAW, STABU, UAV-gc, BRL, Wkb
7. **Lean en CPM zijn gescheiden werelden** — geen tool combineert beide goed
8. **Desktop-first** — meeste tools hebben slechte mobiele ervaring
9. **Complexe licentiemodellen** — per seat, per project, per module
10. **Geen integratie met ERP** — planning staat los van inkoop/facturatie

---

## 3. Architectuur

De architectuur volgt het patroon van **Open 2D Studio** en **OpenFEM2D Studio**:

### 3.1 Technologiestack

| Laag | Technologie | Toelichting |
|------|-------------|-------------|
| **Desktop shell** | **Tauri 2.0** | Lichtgewicht (~10 MB), native performance, cross-platform (Windows/Linux/macOS) |
| **Frontend** | **React 19 + TypeScript** | Strict mode, functionele componenten met hooks |
| **Rendering** | **HTML5 Canvas 2D** | Gantt-chart rendering, interactieve tijdlijn, drag & drop |
| **State management** | **Zustand + Immer** | Per-document store met slices, undo/redo via Immer patches |
| **Styling** | **TailwindCSS** | Theming via CSS-variabelen, dark/light mode |
| **Iconen** | **lucide-react** | Consistent met Open 2D Studio |
| **Build** | **Vite 7** | Dev server + bundler, TypeScript compilatie |
| **Backend** | **Rust** (Tauri) | IFC parsing/schrijven, zware berekeningen (CPM-solver) |
| **IFC-bibliotheek** | **web-ifc** (frontend) + **ifc-rs** (Rust) | Lezen/schrijven van IFC-bestanden |
| **MCP-server** | **Python 3.10+** | AI-integratie via Model Context Protocol |
| **Testen** | **Vitest + Playwright** | Unit tests + E2E tests |

### 3.2 Waarom deze stack

- **Tauri 2.0** in plaats van Electron: 15x kleiner, 5x minder geheugen, betere security
- **Zustand** in plaats van React Context: betere performance bij grote planningen (duizenden taken), fine-grained subscriptions
- **Canvas 2D** in plaats van DOM/SVG: vloeiende rendering van grote Gantt-charts met duizenden bars
- **Rust backend**: CPM-berekeningen en IFC-serialisatie op native snelheid
- **IFC als native formaat**: directe interoperabiliteit met BIM-ecosysteem

### 3.3 Applicatie-architectuur (high-level)

```
┌─────────────────────────────────────────────────────────┐
│                    Tauri 2.0 Shell                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │              React 19 Frontend                     │  │
│  │                                                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────────┐ │  │
│  │  │ MenuBar  │ │  Ribbon  │ │   FileTabBar      │ │  │
│  │  └──────────┘ └──────────┘ └───────────────────┘ │  │
│  │  ┌────────┐ ┌──────────────────────┐ ┌─────────┐ │  │
│  │  │  WBS   │ │   Gantt Canvas       │ │ Props   │ │  │
│  │  │  Tree  │ │   (HTML5 Canvas)     │ │ Panel   │ │  │
│  │  │  Panel │ │                      │ │         │ │  │
│  │  │        │ │  ┌────┬────┬────┐   │ │ Task    │ │  │
│  │  │ Taken  │ │  │Bar │ Bar│ Bar│   │ │ Details │ │  │
│  │  │ Lijst  │ │  ├────┼────┼────┤   │ │         │ │  │
│  │  │        │ │  │    │    │    │   │ │ Deps    │ │  │
│  │  │        │ │  │    │    │    │   │ │         │ │  │
│  │  │        │ │  └────┴────┴────┘   │ │ Res.    │ │  │
│  │  └────────┘ └──────────────────────┘ └─────────┘ │  │
│  │  ┌───────────────────────────────────────────────┐ │  │
│  │  │  StatusBar (project info, CPM stats, zoom)    │ │  │
│  │  └───────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │           Rust Backend (Tauri)                     │  │
│  │  ┌─────────────┐ ┌──────────┐ ┌───────────────┐  │  │
│  │  │ IFC Parser  │ │CPM Solver│ │ File I/O      │  │  │
│  │  │ & Writer    │ │ (native) │ │ (open/save)   │  │  │
│  │  └─────────────┘ └──────────┘ └───────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         │                                    │
    ┌────▼────┐                         ┌─────▼─────┐
    │  .ifc   │                         │ MCP Server│
    │ bestanden│                         │ (Python)  │
    └─────────┘                         └───────────┘
```

---

## 4. Mappenstructuur

```
Open-Planner-Studio/
├── src/                              # TypeScript React frontend
│   ├── main.tsx                      # React entry point
│   ├── App.tsx                       # Hoofdcomponent met layout
│   ├── api/                          # Publieke API-laag
│   │   ├── index.ts                  # PlannerApi facade (window.planner)
│   │   ├── mcp/                      # MCP-server integratie
│   │   │   ├── tools.ts              # MCP tool-definities
│   │   │   └── server.ts             # MCP request handler
│   │   ├── commands/                 # Command registry (undo/redo)
│   │   ├── tasks.ts                  # Taak CRUD-operaties
│   │   ├── schedule.ts               # Planning-operaties
│   │   ├── resources.ts              # Resource-operaties
│   │   └── ifc.ts                    # IFC import/export API
│   ├── state/                        # Zustand state management
│   │   ├── appStore.ts               # Globale app-state
│   │   ├── documentStore.ts          # Per-document state (multi-tab)
│   │   └── slices/                   # State slices
│   │       ├── projectSlice.ts       # Projectinfo, kalender, WBS
│   │       ├── taskSlice.ts          # Taken, mijlpalen
│   │       ├── sequenceSlice.ts      # Dependencies (IfcRelSequence)
│   │       ├── resourceSlice.ts      # Resources (arbeid, materiaal, materieel)
│   │       ├── baselineSlice.ts      # Baselines & tracking
│   │       ├── viewSlice.ts          # Viewport (zoom, scroll, tijdschaal)
│   │       ├── selectionSlice.ts     # Geselecteerde taken
│   │       ├── historySlice.ts       # Undo/redo stack
│   │       ├── filterSlice.ts        # Filters & groepering
│   │       ├── leanSlice.ts          # Last Planner System state
│   │       ├── uiSlice.ts            # UI-state (dialogen, panelen)
│   │       └── types.ts              # Gedeelde types
│   ├── engine/                       # Rendering & berekeningen
│   │   ├── renderer/
│   │   │   ├── GanttRenderer.ts      # Gantt-chart Canvas renderer
│   │   │   ├── TimelineRenderer.ts   # Tijdas renderer (dag/week/maand)
│   │   │   ├── GridRenderer.ts       # Achtergrond grid
│   │   │   ├── DependencyRenderer.ts # Dependency-pijlen tekenen
│   │   │   ├── CriticalPathRenderer.ts # Kritiek pad markering
│   │   │   ├── BaselineRenderer.ts   # Baseline overlay
│   │   │   ├── MilestoneRenderer.ts  # Mijlpaal-symbolen
│   │   │   ├── LOBRenderer.ts        # Line of Balance renderer
│   │   │   ├── NetworkRenderer.ts    # Netwerkdiagram renderer
│   │   │   └── HistogramRenderer.ts  # Resource histogram renderer
│   │   ├── scheduler/
│   │   │   ├── CPMSolver.ts          # Forward/backward pass (TypeScript fallback)
│   │   │   ├── ResourceLeveler.ts    # Resource-nivellering
│   │   │   ├── CalendarEngine.ts     # Werkdagen/uren berekening
│   │   │   ├── FloatCalculator.ts    # Float & kritiek pad analyse
│   │   │   └── MonteCarloSim.ts      # Monte Carlo risico-simulatie
│   │   └── spatial/
│   │       └── IntervalTree.ts       # Ruimtelijke index voor tijdoverlap
│   ├── services/                     # Business logic
│   │   ├── ifc/
│   │   │   ├── ifcReader.ts          # IFC → intern model
│   │   │   ├── ifcWriter.ts          # Intern model → IFC
│   │   │   ├── ifcEntities.ts        # IFC entity definities
│   │   │   └── ifcMapping.ts         # Mapping intern ↔ IFC
│   │   ├── schedule/
│   │   │   ├── scheduleService.ts    # Planning logica
│   │   │   ├── taskService.ts        # Taak CRUD
│   │   │   ├── dependencyService.ts  # Dependency management
│   │   │   └── baselineService.ts    # Baseline snapshot/vergelijking
│   │   ├── resource/
│   │   │   ├── resourceService.ts    # Resource management
│   │   │   └── levelingService.ts    # Resource leveling
│   │   ├── calendar/
│   │   │   ├── calendarService.ts    # Werkkalender beheer
│   │   │   ├── dutchHolidays.ts      # Nederlandse feestdagen
│   │   │   ├── germanHolidays.ts     # Duitse feestdagen (per Bundesland)
│   │   │   └── europeanHolidays.ts   # Europese feestdagensets
│   │   ├── lean/
│   │   │   ├── lastPlannerService.ts # Last Planner System logica
│   │   │   ├── lookAheadService.ts   # Look-ahead planning
│   │   │   ├── weeklyPlanService.ts  # Weekplanning
│   │   │   ├── ppcService.ts         # PPC-berekening
│   │   │   └── constraintService.ts  # Constraint management
│   │   ├── earned-value/
│   │   │   ├── evmService.ts         # Earned Value Management
│   │   │   └── sCurveService.ts      # S-curve berekeningen
│   │   ├── claims/
│   │   │   ├── delayAnalysis.ts      # Delay analysis (TIA, Windows)
│   │   │   └── claimsReport.ts       # Claims rapportage
│   │   ├── risk/
│   │   │   ├── monteCarloService.ts  # Monte Carlo simulatie
│   │   │   └── riskRegister.ts       # Risico-register
│   │   ├── export/
│   │   │   ├── pdfExport.ts          # PDF-export (Gantt)
│   │   │   ├── csvExport.ts          # CSV-export
│   │   │   ├── xmlExport.ts          # P6 XML-export
│   │   │   ├── svgExport.ts          # SVG-export
│   │   │   └── icsExport.ts          # iCalendar export
│   │   ├── import/
│   │   │   ├── mppImport.ts          # MS Project import
│   │   │   ├── p6Import.ts           # Primavera P6 XER import
│   │   │   ├── pmxmlImport.ts        # Primavera XML import
│   │   │   ├── csvImport.ts          # CSV-import
│   │   │   └── ppImport.ts           # Asta Powerproject import
│   │   ├── dutch/
│   │   │   ├── rawService.ts         # RAW-besteksposten koppeling
│   │   │   ├── stabuService.ts       # STABU-integratie
│   │   │   ├── uavgcService.ts       # UAV-gc Systems Engineering
│   │   │   ├── wkbService.ts         # Wet kwaliteitsborging
│   │   │   └── brlService.ts         # BRL-normen
│   │   └── integration/
│   │       ├── claudeService.ts      # Claude AI-integratie
│   │       └── erpnextService.ts     # ERPNext-integratie
│   ├── components/                   # React UI-componenten
│   │   ├── canvas/
│   │   │   ├── GanttCanvas.tsx       # Hoofd Gantt-canvas component
│   │   │   ├── TimelineHeader.tsx    # Tijdas boven het Gantt-diagram
│   │   │   ├── TaskTable.tsx         # Tabel links van het Gantt-diagram
│   │   │   ├── NetworkCanvas.tsx     # Netwerkdiagram canvas
│   │   │   └── LOBCanvas.tsx         # Line of Balance canvas
│   │   ├── layout/
│   │   │   ├── MenuBar/             # Bestandsmenu (File, Edit, View, etc.)
│   │   │   ├── Ribbon/              # Office-stijl ribbon toolbar
│   │   │   ├── StatusBar/           # Statusbalk onderaan
│   │   │   └── FileTabBar/          # Multi-document tabs
│   │   ├── panels/
│   │   │   ├── WBSPanel.tsx          # WBS-boomstructuur (links)
│   │   │   ├── TaskPropertiesPanel.tsx # Taakeigenschappen (rechts)
│   │   │   ├── ResourcePanel.tsx     # Resource-overzicht
│   │   │   ├── DependencyPanel.tsx   # Dependencies bewerken
│   │   │   ├── CalendarPanel.tsx     # Kalender instellingen
│   │   │   ├── BaselinePanel.tsx     # Baseline vergelijking
│   │   │   ├── LeanPanel.tsx         # Last Planner System panel
│   │   │   ├── EVMPanel.tsx          # Earned Value Management
│   │   │   ├── RiskPanel.tsx         # Risico-analyse
│   │   │   └── ClaimsPanel.tsx       # Claims & delay analysis
│   │   ├── lean/
│   │   │   ├── LookAheadBoard.tsx    # Look-ahead planning bord
│   │   │   ├── WeeklyPlanBoard.tsx   # Weekplanning bord
│   │   │   ├── KanbanBoard.tsx       # Kanban-bord
│   │   │   ├── PPCDashboard.tsx      # PPC-dashboard
│   │   │   ├── ConstraintLog.tsx     # Belemmeringen-register
│   │   │   └── DailyHuddle.tsx       # Dagstart-dashboard
│   │   ├── dialogs/
│   │   │   ├── Backstage/           # File backstage (Openen/Opslaan)
│   │   │   ├── NewProjectDialog/    # Nieuw project wizard
│   │   │   ├── TaskDialog/          # Taak bewerken dialoog
│   │   │   ├── ResourceDialog/      # Resource bewerken
│   │   │   ├── CalendarDialog/      # Kalender bewerken
│   │   │   ├── BaselineDialog/      # Baseline opslaan
│   │   │   ├── FilterDialog/        # Filteren & groeperen
│   │   │   ├── PrintDialog/         # Afdrukken
│   │   │   ├── ImportDialog/        # Import (MPP, P6, CSV)
│   │   │   ├── SettingsDialog/      # Applicatie-instellingen
│   │   │   ├── MonteCarloDialog/    # Monte Carlo configuratie
│   │   │   └── TemplateDialog/      # Template selectie
│   │   └── shared/
│   │       ├── ContextMenu/         # Rechtermuisklik menu
│   │       └── Icons/               # Lucide iconen + custom
│   ├── hooks/                        # Custom React hooks
│   │   ├── canvas/
│   │   │   ├── useGanttEvents.ts     # Muis/touch events op canvas
│   │   │   ├── useTaskDrag.ts        # Taak slepen (start/eind/duur)
│   │   │   ├── useDependencyDraw.ts  # Dependency-pijl tekenen
│   │   │   └── useZoomPan.ts         # Zoomen & pannen
│   │   ├── scheduling/
│   │   │   ├── useCPM.ts             # CPM herberekening hook
│   │   │   └── useResourceLevel.ts   # Resource leveling hook
│   │   ├── keyboard/
│   │   │   └── useKeyboardShortcuts.ts
│   │   └── file/
│   │       └── useFileOperations.ts  # Open/Save/Export
│   ├── types/                        # TypeScript type-definities
│   │   ├── project.ts                # Project, kalender types
│   │   ├── task.ts                   # Task, TaskTime, Milestone
│   │   ├── sequence.ts              # Dependency, SequenceType, Lag
│   │   ├── resource.ts              # Resource, ResourceAssignment
│   │   ├── baseline.ts              # Baseline snapshot types
│   │   ├── calendar.ts              # WorkCalendar, WorkTime
│   │   ├── wbs.ts                   # WBS-structuur types
│   │   ├── ifc.ts                   # IFC entity types
│   │   ├── lean.ts                  # Last Planner System types
│   │   ├── evm.ts                   # Earned Value types
│   │   ├── risk.ts                  # Risico-analyse types
│   │   ├── rendering.ts            # Render-gerelateerde types
│   │   └── index.ts                 # Barrel export
│   ├── utils/                       # Hulpfuncties
│   │   ├── dateUtils.ts             # Datum berekeningen
│   │   ├── durationUtils.ts         # ISO 8601 duration parsing
│   │   ├── colorUtils.ts            # Kleuren voor kritiek pad, float
│   │   └── settings.ts              # Persistent settings
│   ├── i18n/                        # Meertaligheid
│   │   ├── nl.json                  # Nederlands (primair)
│   │   ├── en.json                  # Engels
│   │   ├── de.json                  # Duits
│   │   ├── fr.json                  # Frans
│   │   ├── es.json                  # Spaans
│   │   └── zh.json                  # Chinees
│   └── styles/
│       └── globals.css              # TailwindCSS + thema variabelen
├── src-tauri/                       # Rust Tauri backend
│   ├── src/
│   │   ├── main.rs                  # Tauri app entry point
│   │   ├── api_server.rs            # HTTP API bridge (voor MCP)
│   │   ├── ifc/
│   │   │   ├── mod.rs               # IFC module
│   │   │   ├── parser.rs            # IFC STEP parser
│   │   │   ├── writer.rs            # IFC STEP writer
│   │   │   ├── entities.rs          # IFC entity structs
│   │   │   └── scheduler.rs         # IFC scheduling entities
│   │   ├── solver/
│   │   │   ├── mod.rs               # Solver module
│   │   │   ├── cpm.rs               # CPM forward/backward pass
│   │   │   ├── resource.rs          # Resource leveling
│   │   │   ├── calendar.rs          # Kalender berekeningen
│   │   │   └── montecarlo.rs        # Monte Carlo simulatie (Rust, snel)
│   │   └── commands/
│   │       └── mod.rs               # Tauri commands (IPC)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── build.rs
├── mcp-server/                      # MCP Server (Python)
│   ├── server.py                    # MCP server entry point
│   ├── planner_client.py            # HTTP client naar Planner Studio
│   ├── tools/
│   │   ├── task_tools.py            # Taak MCP tools
│   │   ├── schedule_tools.py        # Planning MCP tools
│   │   ├── resource_tools.py        # Resource MCP tools
│   │   ├── lean_tools.py            # Lean/LPS MCP tools
│   │   └── project_tools.py         # Project MCP tools
│   ├── pyproject.toml
│   └── requirements.txt
├── examples/                        # Voorbeeldplanningen
│   ├── woongebouw-nieuwbouw.ifc     # Voorbeeld: nieuwbouw woongebouw
│   ├── infra-wegenbouw.ifc          # Voorbeeld: wegenbouwproject
│   ├── renovatie-kantoor.ifc        # Voorbeeld: kantoorrenovatie
│   └── README.md                    # Toelichting voorbeelden
├── templates/                       # Projectsjablonen
│   ├── nieuwbouw-woning.ifc         # Template nieuwbouw woning
│   ├── renovatie.ifc                # Template renovatie
│   ├── utiliteitsbouw.ifc           # Template utiliteitsbouw
│   ├── infra-weg.ifc                # Template wegenbouw
│   ├── infra-brug.ifc               # Template brugbouw
│   └── lean-takt.ifc                # Template Lean/Takt planning
├── docs/                            # Documentatie
│   ├── architecture.md              # Architectuur overzicht
│   ├── ifc-mapping.md               # IFC schema mapping
│   └── user-guide.md                # Gebruikershandleiding
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── vitest.config.ts
├── index.html
├── PLAN.md                          # Dit document
├── LICENSE                          # Open source licentie (LGPL-3.0)
└── README.md
```

---

## 5. IFC Data Model — Mapping

Open Planner Studio slaat **alle planningsdata op in IFC 4.3** formaat. Hieronder de mapping van intern model naar IFC-entiteiten:

### 5.1 Entiteiten-mapping

| Intern concept | IFC Entity | Toelichting |
|----------------|------------|-------------|
| **Project** | `IfcProject` | Hoofdcontainer, bevat naam, eenheden, kalender |
| **Planning** | `IfcWorkPlan` | Top-level plan met type (PLANNED/BASELINE/ACTUAL) |
| **Schema** | `IfcWorkSchedule` | Planning binnen een plan, bevat taken |
| **Taak** | `IfcTask` | Individuele activiteit met type, status, prioriteit |
| **Taaktijd** | `IfcTaskTime` | Alle tijddata: duur, start, eind, float, % gereed |
| **Mijlpaal** | `IfcTask` (isMilestone=TRUE) | Nul-duur markering in de tijd |
| **Dependency** | `IfcRelSequence` | Relatie tussen taken (FS/FF/SS/SF) met lag |
| **WBS-hierarchie** | `IfcRelNests` | Ouder-kind relatie tussen taken |
| **Taak->Schema** | `IfcRelAssignsToControl` | Koppelt taken aan hun werkschema |
| **Resource** | `IfcConstructionResource` | Arbeid, materiaal, materieel |
| **Resource->Taak** | `IfcRelAssignsToProcess` | Wijst resource toe aan taak |
| **Taak->Product** | `IfcRelAssignsToProduct` | 4D BIM: taak <-> gebouwelement |
| **Kalender** | `IfcWorkCalendar` | Werkdagen en -uren definitie |
| **Werktijd** | `IfcWorkTime` + `IfcRecurrencePattern` | Ma-Vr 07:00-16:00 etc. |

### 5.2 Dependency types

| Type | IFC SequenceEnum | Beschrijving |
|------|-------------------|-------------|
| Eind-Start (ES) | `FINISH_START` | Opvolger begint na afloop voorganger |
| Start-Start (SS) | `START_START` | Opvolger begint gelijk met voorganger |
| Eind-Eind (EE) | `FINISH_FINISH` | Opvolger eindigt gelijk met voorganger |
| Start-Eind (SE) | `START_FINISH` | Opvolger eindigt bij start voorganger |

### 5.3 IFC Task Types voor de bouw

| IfcTaskTypeEnum | Toepassing |
|-----------------|-----------|
| `CONSTRUCTION` | Bouwactiviteiten (metselwerk, storten, etc.) |
| `INSTALLATION` | Installatie (leidingen, elektra, etc.) |
| `DEMOLITION` | Sloopwerkzaamheden |
| `LOGISTIC` | Logistiek (transport, opslag) |
| `ATTENDANCE` | Bijwonen keuringen, inspecties |
| `MOVE` | Verplaatsingen (kraan, materieel) |
| `RENOVATION` | Renovatiewerkzaamheden |
| `MAINTENANCE` | Onderhoud |

### 5.4 IfcTaskTime — Volledige velden

```typescript
interface TaskTime {
  // Geplande waarden
  durationType: 'WORKTIME' | 'ELAPSEDTIME';
  scheduleDuration: string;      // ISO 8601 (bijv. "P5D" = 5 dagen)
  scheduleStart: string;         // ISO 8601 datetime
  scheduleFinish: string;        // ISO 8601 datetime

  // CPM-berekende waarden
  earlyStart: string;            // Vroegst mogelijke start
  earlyFinish: string;           // Vroegst mogelijke einde
  lateStart: string;             // Laatst toelaatbare start
  lateFinish: string;            // Laatst toelaatbaar einde
  freeFloat: string;             // Vrije speling
  totalFloat: string;            // Totale speling
  isCritical: boolean;           // Op kritiek pad?

  // Actuele waarden (tracking)
  actualStart?: string;
  actualFinish?: string;
  actualDuration?: string;
  remainingTime?: string;
  completion: number;            // 0.0 - 1.0 (percentage gereed)
}
```

---

## 6. Functionaliteiten — Roadmap in 6 Fases

### Fase 1: Fundament (MVP) — v0.1

**Doel**: Een werkende planning kunnen maken, opslaan als IFC, en openen. De basis moet solide zijn.

**Tijdsinschatting**: 8-12 weken

#### 1.1 Project Setup & Infrastructuur
- [ ] Tauri 2.0 + React 19 + TypeScript + Vite project opzet
- [ ] Zustand store met project, task, sequence slices
- [ ] Undo/redo systeem (Immer patches)
- [ ] Dark mode / Light mode theming
- [ ] Meertaligheid basis (NL + EN)
- [ ] Auto-save / crash recovery

#### 1.2 Gantt-diagram (Kernweergave)
- [ ] Gantt Canvas renderer (tijdas + taakbalken)
- [ ] Tijdas met dag/week/maand schalen
- [ ] Dual tijdas (bijv. maand boven, week onder)
- [ ] Zoom & pan op tijdlijn (Ctrl+scroll)
- [ ] Statusdatum-lijn (vandaag-markering)
- [ ] Weekend/feestdag-markering (grijze kolommen)
- [ ] Taakbalken met kleurcodering
- [ ] Tooltip met taakinfo bij hover

#### 1.3 Taakbeheer
- [ ] Takenlijst (spreadsheet-stijl tabel links van Gantt)
- [ ] Taken toevoegen, bewerken, verwijderen
- [ ] Inline editing in tabelcellen (dubbelklik)
- [ ] Taak slepen: horizontaal = verplaats in tijd
- [ ] Taak rand slepen = duur wijzigen
- [ ] Taak kopiëren/plakken
- [ ] Multi-selectie (Ctrl+klik, Shift+klik)
- [ ] Rechtermuisklik contextmenu

#### 1.4 Dependencies
- [ ] Finish-to-Start (FS) dependencies
- [ ] Dependencies visueel tekenen (drag van taakrand naar taakrand)
- [ ] Dependency-pijlen in Gantt
- [ ] Circulaire dependency-detectie met foutmelding

#### 1.5 CPM Engine
- [ ] CPM forward pass (vroegste tijden)
- [ ] CPM backward pass (laatst toelaatbare tijden)
- [ ] Totale float berekening
- [ ] Vrije float berekening
- [ ] Kritiek pad markering (rood)
- [ ] Float-weergave (groene lijn achter balk)

#### 1.6 Kalender
- [ ] Standaard werkkalender (ma-vr, 8 uur/dag)
- [ ] Nederlandse feestdagen (Koningsdag, Hemelvaart, Kerst, etc.)
- [ ] Bouwvakvakantie (NL: regio Noord/Midden/Zuid)
- [ ] Uitzonderingsdagen toevoegen

#### 1.7 IFC Bestandsbeheer
- [ ] IFC 4.3 writer: project opslaan als .ifc
- [ ] IFC 4.3 reader: project openen vanuit .ifc
- [ ] Nieuw project wizard
- [ ] Recent files lijst
- [ ] File tabs (multi-document)

#### 1.8 UI Framework
- [ ] MenuBar (Bestand, Bewerken, Beeld, Planning, Hulp)
- [ ] Ribbon toolbar (Office-stijl, tabbladen)
- [ ] StatusBar (taak-count, kritiek pad info, zoom-slider)
- [ ] Sneltoetsen (Ctrl+S, Ctrl+Z, Ctrl+Y, Delete, etc.)
- [ ] Resizable panelen (WBS links, properties rechts)

---

### Fase 2: Professionele Planning — v0.5

**Doel**: Alle gangbare features van MS Project/P6 bieden. Geschikt voor professioneel gebruik.

**Tijdsinschatting**: 10-14 weken

#### 2.1 Volledige Dependencies
- [ ] Alle dependency-types: FS, FF, SS, SF
- [ ] Positieve lag (vertraging)
- [ ] Negatieve lag (lead/overlap)
- [ ] Lag in werkdagen vs. kalenderdagen
- [ ] Procentuele lag (bijv. SS+50%)
- [ ] Driving/non-driving relationship markering
- [ ] Dependency-matrix/tabel weergave
- [ ] Path tracing (trace alle voorgangers/opvolgers)

#### 2.2 WBS & Structuur
- [ ] WBS-hierarchie met onbeperkte diepte
- [ ] WBS-codes (gestructureerd: 1.2.3.4)
- [ ] Inklapbare groepen
- [ ] Summary-taken met rollup statistieken
- [ ] Activity codes (vrij definieerbare categorisering)
- [ ] Custom fields (gebruikersvelden)
- [ ] Kopieer/plak WBS-takken
- [ ] WBS-templates (herbruikbare structuren)
- [ ] Fasering/fasecodering
- [ ] Meerdere WBS-indelingen (per locatie EN per discipline)

#### 2.3 Constraints & Deadlines
- [ ] Datum-constraints (ASAP, ALAP, SNET, SNLT, FNET, FNLT, MFO, MSO)
- [ ] Deadline-datum per taak (met waarschuwing bij overschrijding)
- [ ] Negatieve float detectie
- [ ] Constraint-indicatoren in Gantt

#### 2.4 Mijlpalen
- [ ] Mijlpalen als nul-duur taken (diamant-symbool)
- [ ] Start-mijlpalen en eind-mijlpalen
- [ ] Inspectiemomenten als verplichte mijlpalen
- [ ] Mijlpalen-overzicht/rapport

#### 2.5 Resources
- [ ] Arbeid-resources (mensen, ploegen)
- [ ] Materieel-resources (kranen, machines, steigers)
- [ ] Materiaal-resources (beton, staal, hout)
- [ ] Onderaannemers als resource-type
- [ ] Resource-kalenders (beschikbaarheid per resource)
- [ ] Resource-toewijzing aan taken (% / uren)
- [ ] Resource-histogram onder Gantt
- [ ] Resource overallocatie-detectie (markering)
- [ ] Resource-nivellering (automatisch, met opties)
- [ ] Resource-smoothing (minimaliseer pieken)
- [ ] Team/ploeg-toewijzing
- [ ] Resource-curves (front-loaded, back-loaded, bell)

#### 2.6 Baselines & Voortgang
- [ ] Baseline opslaan (snapshot van huidige planning)
- [ ] Meerdere baselines (onbeperkt)
- [ ] Baseline vergelijking (visueel overlay in Gantt)
- [ ] Baseline-variance rapport
- [ ] Statusdatum instellen
- [ ] Voortgang registreren (% gereed, actuele start/eind)
- [ ] Remaining duration tracking
- [ ] Voortgangslijnen in Gantt
- [ ] Out-of-sequence progress detectie
- [ ] Progress override opties (Retained Logic / Progress Override)

#### 2.7 Weergaven
- [ ] Tijdschalen: uur, dag, week, maand, kwartaal, jaar
- [ ] Kolom-aanpassing (kies welke velden zichtbaar in tabel)
- [ ] Groeperen op elk veld (WBS, fase, resource, etc.)
- [ ] Sorteren op elk veld
- [ ] Filteren met AND/OR logica
- [ ] Custom layouts opslaan/laden
- [ ] Kleurcodering per status/type/fase
- [ ] Presentation mode (full screen Gantt)
- [ ] Split view (meerdere planningen naast elkaar)
- [ ] Mini-map (thumbnail overzicht)

#### 2.8 Kalender Uitbreidingen
- [ ] Meerdere kalenders per project
- [ ] Taak-specifieke kalender
- [ ] Duitse feestdagen (per Bundesland!)
- [ ] Europese feestdagensets (BE, FR, VK, AT, CH)
- [ ] Seizoensgebonden kalenders
- [ ] Winterstop/vorstperiode
- [ ] 24-uurs kalender
- [ ] Dag/nacht ploegen kalender
- [ ] Uren-based en minuten-based scheduling

#### 2.9 Geavanceerde CPM
- [ ] Alle constraint-types in CPM-berekening
- [ ] Hammock-taken
- [ ] Externe dependencies (cross-project links)
- [ ] Near-critical path analyse
- [ ] Meerdere kritieke paden
- [ ] Interfering float
- [ ] Scheduling options (keuze berekeningsmethoden)

---

### Fase 3: Bouwsector & Nederlandse Features — v1.0

**Doel**: Unieke bouwsector-features die geen enkele concurrent biedt. Eerste versie voor productiegebruik.

**Tijdsinschatting**: 12-16 weken

#### 3.1 Lean Construction & Last Planner System
- [ ] Master Schedule (overall CPM-planning)
- [ ] Phase Planning / Pull Planning (faseplanningsbord)
- [ ] Look-ahead Planning (6-8 weken vooruit, constraint-check)
- [ ] Weekly Work Plan (weekplanning met commitments)
- [ ] Commitment tracking (wie belooft wat)
- [ ] PPC-berekening (Percent Plan Complete) + dashboard
- [ ] Variance/Root Cause analysis (waarom niet gehaald?)
- [ ] Constraint log (belemmeringen-register)
- [ ] Constraint-ready indicator (taak kan starten: groen/rood)
- [ ] Make-ready process tracking
- [ ] Takt planning (repetitieve eenheden, bijv. per verdieping)
- [ ] Kanban-bord weergave
- [ ] Digitaal post-it bord (collaborative planning)
- [ ] Dagstart-dashboard (daily huddle board)
- [ ] Naadloze integratie LPS <-> CPM (geen dubbel werk!)

#### 3.2 Nederlandse Bouwstandaarden
- [ ] RAW-besteksposten koppelen aan taken
- [ ] STABU-bestekscodes in WBS
- [ ] UAV-gc ondersteuning (Systems Engineering, V&V-planning)
- [ ] BRL-normen koppelen aan inspectiemomenten
- [ ] Wkb (Wet kwaliteitsborging) kwaliteitsborgingsplan integratie
- [ ] CROW-publicaties referenties (bijv. CROW 400)
- [ ] Nederlandse aanbestedingsfasen (conform Aanbestedingswet 2012)
- [ ] VISI-koppeling (NL bouwcommunicatiestandaard)
- [ ] BLVC-plan (Bereikbaarheid, Leefbaarheid, Veiligheid, Communicatie)
- [ ] Asbestinventarisatie-milestones
- [ ] Omgevingsvergunning-milestones
- [ ] V&G-plan taken (veiligheidsmaatregelen)
- [ ] Bouwlogistiek planning

#### 3.3 Duitse/DACH Bouwstandaarden
- [ ] VOB/B ondersteuning (Terminplanung conform VOB)
- [ ] HOAI-fasen (Leistungsphasen 1-9) als WBS-structuur
- [ ] Duitse feestdagen per Bundesland
- [ ] DIN-normen referenties

#### 3.4 Earned Value Management (EVM)
- [ ] BCWP, BCWS, ACWP berekeningen
- [ ] CPI (Cost Performance Index)
- [ ] SPI (Schedule Performance Index)
- [ ] EAC (Estimate at Completion)
- [ ] S-curve (cumulatieve voortgang/kosten grafiek)
- [ ] Kostencurve (gepland vs. werkelijk)
- [ ] Cashflow-prognose
- [ ] EVM-dashboard

#### 3.5 Kosten & Budget
- [ ] Kostenberekening per taak (uren x tarief + materiaal)
- [ ] Budget vs. actual kosten tracking
- [ ] Cost loading (kosten verspreid over taakduur)
- [ ] Kostenrapportage
- [ ] Budget-overschrijding waarschuwingen

#### 3.6 Weergave-uitbreidingen
- [ ] Netwerkdiagram (PDM/Activity-on-Node)
- [ ] Line of Balance (LOB) diagram voor repetitieve werken
- [ ] Kalenderweergave (maandoverzicht)
- [ ] Timeline-weergave (horizontale tijdlijn, MS Project-stijl)

#### 3.7 Bouwspecifieke Features
- [ ] Weercondities per taak (buitenwerk/binnenwerk markering)
- [ ] Inspectiemomenten als verplichte mijlpalen met checklijst
- [ ] Fasering-templates (fundering, ruwbouw, afbouw, installatie, oplevering)
- [ ] Seizoensgebonden restricties (geen buitenwerk in winter)
- [ ] Kraanplanning (beschikbaarheid, capaciteit)
- [ ] Bouwplaatsinrichting-milestones

#### 3.8 Import/Export
- [ ] MS Project XML import/export
- [ ] MS Project MPP import (readonly)
- [ ] Primavera P6 XER import/export
- [ ] Primavera XML (PMXML) import/export
- [ ] Asta Powerproject PP import
- [ ] CSV/Excel import/export
- [ ] PDF-export (Gantt, multi-page A3/A1)
- [ ] PNG/SVG-export van Gantt
- [ ] iCalendar (.ics) export
- [ ] Clipboard-ondersteuning (kopieer naar Excel)

#### 3.9 Rapportage
- [ ] Afdrukken naar printer (multi-page)
- [ ] Rapport-wizard (kies inhoud, layout, filters)
- [ ] Standaard rapporten: taaklijst, kritiek pad, resources, voortgang
- [ ] Custom rapporten (kies velden, groepering, filters)
- [ ] Grafische rapporten (histogrammen, pie charts)
- [ ] Look-ahead rapport (komende 3/6/8 weken)
- [ ] Voortgangsrapport (per periode)
- [ ] Executive dashboard (samenvatting op 1 pagina)
- [ ] Opleverpuntenlijst
- [ ] Kostenrapport

#### 3.10 Volledige Meertaligheid
- [ ] Nederlands (primair)
- [ ] Engels
- [ ] Duits
- [ ] Frans
- [ ] Spaans
- [ ] Chinees (vereenvoudigd)

---

### Fase 4: 4D/5D BIM & Geavanceerde Analyse — v2.0

**Doel**: 4D BIM-simulatie, risico-analyse, claims-management. Enterprise-niveau features.

**Tijdsinschatting**: 14-20 weken

#### 4.1 4D BIM
- [ ] IFC-gebouwmodel laden en renderen (Three.js + web-ifc)
- [ ] Taken koppelen aan IFC-elementen (drag & drop)
- [ ] 4D simulatie: tijdlijn-animatie (zie gebouw groeien)
- [ ] Bouwfase-visualisatie (kleurcodering per status: gepland/bezig/gereed)
- [ ] Scrub door tijdlijn (slider)
- [ ] Camera-posities opslaan
- [ ] Screenshot/video-export van simulatie
- [ ] BIM-model filteren op verdieping/sectie
- [ ] Transparantie voor toekomstige elementen

#### 4.2 5D Kosten-koppeling
- [ ] Quantity takeoff vanuit BIM-model
- [ ] Kosten koppelen aan IFC-elementen
- [ ] 5D visualisatie (kosten per fase in 3D)
- [ ] Cumulatieve kostencurve gekoppeld aan 4D-simulatie

#### 4.3 Risico-analyse
- [ ] Probabilistische duurschatting (3-point: optimistisch, realistisch, pessimistisch)
- [ ] Monte Carlo simulatie (Rust backend, snel)
- [ ] Tornado-diagram (gevoeligheidsanalyse)
- [ ] Risico-register met koppeling aan taken
- [ ] Confidence level-analyse (P50, P80, P90 einddatums)
- [ ] Weather-risk integration (historische weersdata impact)

#### 4.4 Claims & Delay Analysis
- [ ] As-planned vs. As-built vergelijking (visueel)
- [ ] Time Impact Analysis (TIA)
- [ ] Window analysis (period-by-period delay)
- [ ] Delay-rapport genereren
- [ ] Snapshot-vergelijking (welke wijzigingen per periode)
- [ ] Trend-analyse (voortgang per week/maand grafiek)

#### 4.5 Clashdetectie & Ruimtelijke Analyse
- [ ] Detectie gelijktijdige werkzaamheden op zelfde locatie
- [ ] Kraanreikwijdte-analyse
- [ ] Hijszone-conflicten
- [ ] Logistieke route-conflicten
- [ ] Veiligheidszone-analyse

#### 4.6 Geavanceerde Weergaven
- [ ] Tijd-weg diagram (lineaire projecten: wegen, tunnels, spoor)
- [ ] 3D Gantt (locatie x tijd x activiteit)
- [ ] Resource-heatmap (overbelasting visueel)
- [ ] Dashboard-builder (drag & drop widgets)

---

### Fase 5: AI, Automatisering & Integratie — v3.0

**Doel**: AI-gestuurde planning, MCP-integratie, ERPNext-koppeling, en platform-integraties.

**Tijdsinschatting**: 12-16 weken

#### 5.1 MCP-server (AI-integratie)
- [ ] MCP-server voor Claude en andere AI-assistenten
- [ ] Alle planning-operaties als MCP tools
- [ ] Natural language planning ("maak fundering in week 10, 3 dagen, 2 timmerlieden")
- [ ] AI-gestuurde planning suggesties
- [ ] AI risico-analyse ("welke taken lopen risico op vertraging?")
- [ ] AI resource-optimalisatie
- [ ] AI duurschatting op basis van historische data
- [ ] Conversational planning (chat-interface in app)

#### 5.2 MCP Server — Beschikbare Tools

| Tool | Beschrijving |
|------|-------------|
| `get_project_info` | Projectnaam, start, einde, statistieken |
| `list_tasks` | Alle taken met filters (fase, status, kritiek) |
| `get_task` | Details van een taak |
| `add_task` | Nieuwe taak toevoegen |
| `update_task` | Taak eigenschappen wijzigen |
| `delete_task` | Taak verwijderen |
| `add_dependency` | Dependency toevoegen tussen taken |
| `remove_dependency` | Dependency verwijderen |
| `run_cpm` | CPM herberekenen |
| `get_critical_path` | Kritiek pad opvragen |
| `list_resources` | Alle resources |
| `assign_resource` | Resource toewijzen aan taak |
| `save_baseline` | Baseline opslaan |
| `compare_baseline` | Huidige planning vergelijken met baseline |
| `export_ifc` | Project exporteren als IFC |
| `import_schedule` | Planning importeren |
| `get_resource_histogram` | Resource-belasting per periode |
| `get_ppc` | PPC-score opvragen |
| `add_constraint` | Belemmering toevoegen |
| `run_monte_carlo` | Monte Carlo simulatie uitvoeren |
| `suggest_optimization` | AI-optimalisatie suggesties |
| `analyze_delay` | Vertragingsanalyse uitvoeren |

#### 5.3 ERPNext-integratie
- [ ] Projecten synchroniseren (planning <-> ERP)
- [ ] Inkoop-triggers vanuit planning (materiaalbestelling bij start taak)
- [ ] Timesheet-koppeling (uren registratie <-> voortgang)
- [ ] Factuurmomenten koppelen aan mijlpalen
- [ ] Kosten-synchronisatie (budget ERP <-> planning)
- [ ] Subcontractor-management

#### 5.4 Automatisering
- [ ] Macro's/scripting (TypeScript API)
- [ ] REST API (voor externe integraties)
- [ ] Regels/triggers (als X dan Y, bijv. "als mijlpaal bereikt, stuur notificatie")
- [ ] Batch-updates (bulk wijzigingen)
- [ ] Automatische resource-toewijzing (AI-gestuurd)
- [ ] Templates met parametrisering (bijv. "woning, 3 verdiepingen, met kelder")
- [ ] Planning-validatie regels (automatische check op ontbrekende dependencies)

#### 5.5 Externe Integraties
- [ ] BIM Collaboration Format (BCF) import/export
- [ ] Relatics-koppeling (UAV-gc SE)
- [ ] VISI-koppeling (communicatieprotocol)
- [ ] Procore-koppeling
- [ ] BIM360/Autodesk Construction Cloud koppeling
- [ ] Trimble Connect koppeling
- [ ] Webhook-ondersteuning (events naar externe systemen)

---

### Fase 6: Samenwerking, Cloud & Enterprise — v4.0

**Doel**: Multi-user samenwerking, cloud-synchronisatie, enterprise-features, mobiele app.

**Tijdsinschatting**: 16-24 weken

#### 6.1 Multi-user Samenwerking
- [ ] Gelijktijdig bewerken (CRDT-based conflict resolution)
- [ ] Gebruikersrechten/rollen (admin, planner, viewer, subcontractor)
- [ ] Audit trail (volledige wijzigingslog met wie/wanneer/wat)
- [ ] Commentaar per taak (threaded discussions)
- [ ] @mentions en notificaties
- [ ] Bijlagen per taak (foto's, PDF's, documenten)
- [ ] Subcontractor-portal (beperkte toegang, alleen eigen taken)

#### 6.2 Cloud-synchronisatie
- [ ] Cloud storage backend (self-hosted of managed)
- [ ] Realtime sync (WebSocket/CRDT)
- [ ] Offline mode (werk lokaal, sync later)
- [ ] Versiegeschiedenis (terugkeren naar eerdere versie)
- [ ] Project-sharing (link delen)
- [ ] Multi-project portfolio-overzicht

#### 6.3 Mobiele App
- [ ] Progressive Web App (PWA) of native Tauri Mobile
- [ ] Voortgang registreren in het veld (foto + % gereed)
- [ ] Dagplanning bekijken
- [ ] Push-notificaties
- [ ] Offline voortgangsregistratie
- [ ] QR-code scanning voor locatie-registratie

#### 6.4 Enterprise Features
- [ ] Single Sign-On (SSO) / SAML / OAuth2
- [ ] LDAP/Active Directory integratie
- [ ] Multi-project resource pool
- [ ] Portfolio-management (overzicht alle projecten)
- [ ] Cross-project dependencies
- [ ] Organisatie-breed dashboard
- [ ] Capaciteitsplanning (organisatie-niveau)
- [ ] Compliance-rapportage (BRL, Wkb, VOB/B)
- [ ] Data-export voor BI-tools (Power BI, Tableau)
- [ ] White-label opties

#### 6.5 Communicatie & Notificaties
- [ ] E-mail notificaties bij wijzigingen
- [ ] Push-notificaties (desktop + mobiel)
- [ ] Weekrapport automatisch genereren en versturen
- [ ] Slack/Teams integratie
- [ ] Agenda-integratie (Outlook, Google Calendar)

---

## 7. Kernalgoritmen

### 7.1 Critical Path Method (CPM)

```
FORWARD PASS (vroegste tijden):
  Voor elke taak in topologische volgorde:
    EarlyStart = max(EarlyFinish van alle voorgangers + lag)
    EarlyFinish = EarlyStart + duur (werkdagen via kalender)

BACKWARD PASS (laatst toelaatbare tijden):
  Voor elke taak in omgekeerde topologische volgorde:
    LateFinish = min(LateStart van alle opvolgers - lag)
    LateStart = LateFinish - duur (werkdagen via kalender)

FLOAT BEREKENING:
  TotalFloat = LateStart - EarlyStart (of LateFinish - EarlyFinish)
  FreeFloat = min(EarlyStart opvolgers) - EarlyFinish - lag
  IsCritical = (TotalFloat == 0)
```

### 7.2 Resource Leveling

```
RESOURCE NIVELLERING:
  1. Bereken CPM en identificeer resource-conflicten
  2. Voor elk tijdstip met overbelasting:
     a. Identificeer niet-kritieke taken die verplaatst kunnen worden
     b. Verplaats taken met meeste float eerst
     c. Respecteer alle dependencies
     d. Herbereken CPM na elke verplaatsing
  3. Herhaal tot geen conflicten meer
```

### 7.3 Kalenderberekening

```
WERKDAGEN BEREKENEN (startdatum, duur):
  huidige_datum = startdatum
  resterende_uren = duur
  TERWIJL resterende_uren > 0:
    ALS is_werkdag(huidige_datum) EN NIET is_feestdag(huidige_datum):
      beschikbare_uren = werkuren_op(huidige_datum)
      resterende_uren -= beschikbare_uren
    huidige_datum += 1 dag
  RETOURNEER huidige_datum
```

### 7.4 Monte Carlo Simulatie

```
MONTE CARLO (project, iteraties=10000):
  resultaten = []
  VOOR i = 1 TOT iteraties:
    VOOR elke taak:
      taak.duur = random_sample(optimistisch, realistisch, pessimistisch)  // PERT-verdeling
    bereken_CPM(project)
    resultaten.push(project.einddatum)
  SORTEER resultaten
  P50 = resultaten[5000]   // 50% kans
  P80 = resultaten[8000]   // 80% kans
  P90 = resultaten[9000]   // 90% kans
  RETOURNEER { P50, P80, P90, histogram }
```

### 7.5 Earned Value Management

```
EARNED VALUE BEREKENINGEN:
  BAC = Budget at Completion (totaal geplande kosten)
  PV (BCWS) = Planned Value op statusdatum (geplande voortgang in kosten)
  EV (BCWP) = Earned Value (werkelijke voortgang in geplande kosten)
  AC (ACWP) = Actual Cost (werkelijke kosten)

  SV = EV - PV                    // Schedule Variance
  CV = EV - AC                    // Cost Variance
  SPI = EV / PV                   // Schedule Performance Index
  CPI = EV / AC                   // Cost Performance Index
  EAC = BAC / CPI                 // Estimate at Completion
  ETC = EAC - AC                  // Estimate to Complete
  VAC = BAC - EAC                 // Variance at Completion
  TCPI = (BAC - EV) / (BAC - AC)  // To-Complete Performance Index
```

### 7.6 PPC (Percent Plan Complete) — Last Planner System

```
PPC BEREKENING (weekplanning):
  geplande_taken = alle taken in weekplan
  voltooide_taken = taken die daadwerkelijk voltooid zijn
  PPC = voltooide_taken / geplande_taken * 100%

  VOOR elke niet-voltooide taak:
    registreer_reden(taak, categorie)
    // Categorieën: materiaal, arbeid, tekeningen, voorganger,
    //              weer, vergunning, veiligheid, overig

  GENEREER root_cause_analyse(redenen)
```

---

## 8. UI/UX Ontwerp

### 8.1 Hoofdvenster layout

Het venster volgt de Office/AutoCAD-stijl van Open 2D Studio:

```
┌─────────────────────────────────────────────────────────────┐
│ v Bestand  Bewerken  Beeld  Invoegen  Planning  Hulp        │  <- MenuBar
├─────────────────────────────────────────────────────────────┤
│ [Taak+] [Dep+] [Mijlpaal] [Resource] | [CPM] [Baseline]    │  <- Ribbon
├───────────┬─────────────────────────────────┬───────────────┤
│           │  Feb 2026         Mrt 2026      │               │
│ WBS/Taak  │  |W6|W7|W8|W9|W10|W11|W12|W13| │  Eigenschappen│
│           ├─────────────────────────────────┤               │
│ 1. Grond  │  ████████                       │  Taak: ...    │
│  1.1 Ont  │    ████                         │  Start: ...   │
│  1.2 Fun  │        ██████████               │  Duur: ...    │
│ 2. Ruwb   │              ████████████       │  Float: ...   │
│  2.1 Beg  │              ██████             │  Deps: ...    │
│  2.2 Vlo  │                    ██████       │  Resources:   │
│ 3. Afbouw │                          ██████ │               │
│           │                       ◆ Oplevering              │
├───────────┴─────────────────────────────────┴───────────────┤
│ Taken: 42  │ Kritiek pad: 28d  │ Float: 5d  │ Zoom: 100%   │  <- StatusBar
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Kleuren & thema

| Element | Kleur | Toelichting |
|---------|-------|-------------|
| Kritieke taken | `#DC2626` (rood) | Taken op het kritieke pad |
| Normale taken | `#2563EB` (blauw) | Taken met speling |
| Mijlpalen | `#7C3AED` (paars) | Diamant-symbool |
| Baseline | `#6B7280` (grijs, gestreept) | Oorspronkelijke planning |
| Float | `#10B981` (groen, lijn) | Vrije speling achter taak |
| Gereed deel | Donkerder variant | Voortgang binnen de balk |
| Weekend/feestdag | `#F3F4F6` (lichtgrijs) | Niet-werkbare dagen |
| Dependency-pijlen | `#374151` (donkergrijs) | Verbindingslijnen |
| Near-critical | `#F59E0B` (oranje) | Taken met weinig float |
| Constraint | `#8B5CF6` (violet) | Taken met datum-constraint |

### 8.3 Interactie

- **Taak slepen**: horizontaal = verplaats in tijd, rand slepen = duur wijzigen
- **Dependency tekenen**: sleep van taakrand naar taakrand
- **Dubbelklik**: open taak-eigenschappen dialoog
- **Rechtermuisklik**: contextmenu (bewerken, verwijderen, dependency toevoegen)
- **Scroll**: verticaal door taken, horizontaal door tijdlijn
- **Ctrl+Scroll**: zoom in/uit op tijdlijn
- **Selectie**: klik = enkele selectie, Ctrl+klik = multi-selectie, Shift+klik = bereik
- **Drag & drop in WBS**: verplaats taken in hierarchie
- **F5**: CPM herberekenen
- **Ctrl+B**: baseline opslaan

---

## 9. Referentie-analyse: Uitgebreide Vergelijking

### 9.1 Feature-matrix vs. Concurrenten

| Feature | P6 | MSP | Asta | Synchro | TILOS | VPlanner | **OPS** |
|---------|-----|-----|------|---------|-------|----------|---------|
| CPM | v | v | v | v | v | - | **v** |
| Gantt | v | v | v | v | v | - | **v** |
| Netwerkdiagram | v | v | v | - | - | - | **v** |
| WBS | v | v | v | v | - | - | **v** |
| Resources | v | v | v | v | - | - | **v** |
| Resource Leveling | v | v | v | - | - | - | **v** |
| Baselines | v | v | v | v | - | - | **v** |
| EVM / S-curve | v | v | v | - | - | - | **v** |
| 4D BIM | via Synchro | - | v | v | - | - | **v** |
| 5D kosten-BIM | - | - | - | v* | - | - | **v** |
| Monte Carlo | - | - | v* | - | - | - | **v** |
| Claims/Delay analysis | v | - | v | - | - | - | **v** |
| Line of Balance | - | - | v | - | v | - | **v** |
| IFC-native | - | - | - | - | - | - | **v** |
| Open source | - | - | - | - | - | - | **v** |
| AI-integratie (MCP) | - | Copilot* | - | - | - | - | **v** |
| Last Planner System | - | - | - | - | - | v | **v** |
| Lean + CPM gecombineerd | - | - | - | - | - | - | **v** |
| RAW/STABU/UAV-gc | - | - | - | - | - | - | **v** |
| Nederlandse feestdagen/bouwvak | - | - | - | - | - | - | **v** |
| Duitse feestdagen per Bundesland | - | - | - | - | - | - | **v** |
| ERPNext-integratie | - | - | - | - | - | - | **v** |
| Cross-platform (Win/Mac/Linux) | - | - | - | - | - | v | **v** |
| Prijs | ~€4K | ~€600 | ~€1.5K | ~€4K | ~€3K | ~€1K | **Gratis** |

### 9.2 Unieke Positionering Open Planner Studio

Open Planner Studio onderscheidt zich op 8 gebieden waar **geen enkele concurrent** een oplossing biedt:

1. **IFC-native**: Enige tool die IFC 4.3 als native bestandsformaat gebruikt — directe BIM-interoperabiliteit zonder conversie
2. **Lean + CPM in 1 tool**: Geen enkele tool combineert volwaardig CPM-scheduling met Last Planner System
3. **AI-first (MCP)**: Eerste planningtool met native AI-integratie via Model Context Protocol
4. **NL/DE bouwstandaarden**: RAW, STABU, UAV-gc, BRL, Wkb, VOB/B — geen concurrent ondersteunt dit
5. **Open source**: Geen vendor lock-in, geen licentiekosten, community-gedreven
6. **Cross-platform**: Windows, macOS en Linux vanuit dezelfde codebase
7. **ERPNext-integratie**: Directe koppeling planning-ERP voor inkoop, facturatie, timesheets
8. **Europese feestdagen**: Per land en regio (incl. NL bouwvak, DE per Bundesland)

---

## 10. Bouw- & Ontwikkelomgeving

### 10.1 Vereisten

```
Node.js >= 20.0
Rust >= 1.70 (stable)
Python >= 3.10
pnpm (pakketbeheer)
```

### 10.2 Installatie & ontwikkeling

```bash
# Clone
git clone https://github.com/OpenAEC-Foundation/Open-Planner-Studio.git
cd Open-Planner-Studio

# Frontend dependencies
pnpm install

# Development mode
pnpm dev            # Vite dev server
pnpm tauri dev      # Volledige Tauri app

# Build
pnpm build          # Frontend build
pnpm tauri build    # Volledige desktop build

# MCP Server
cd mcp-server
pip install -r requirements.txt
python server.py
```

### 10.3 CI/CD (GitHub Actions)

- **Test**: TypeScript compilatie + Vitest unit tests
- **Build**: Tauri build voor Linux, Windows, macOS
- **Release**: Automatische binaries bij git tag

---

## 11. Licentie

**LGPL-3.0** — Consistent met de OpenAEC Foundation filosofie. Iedereen mag de software gebruiken, aanpassen en distribueren, ook in commerciele contexten, mits wijzigingen aan de bibliotheek zelf ook open-source blijven.
