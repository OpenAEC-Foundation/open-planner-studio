# Open Planner Studio — Projectplan

## 1. Visie & Doelstelling

**Open Planner Studio** is een open-source bouwplanningapplicatie gericht op de **bouwsector**. Het combineert Critical Path Method (CPM) scheduling, Gantt-diagrammen, Work Breakdown Structure (WBS) en 4D BIM-koppeling in één desktopapplicatie. Het native bestandsformaat is **IFC (Industry Foundation Classes)**, conform de IFC 4.3-standaard van buildingSMART.

### Kernprincipes
- **Open standaard**: IFC als enig projectformaat — geen vendor lock-in
- **Bouwsector-specifiek**: dependencies, fases, locatie-gebaseerd plannen, inspectiemomenten
- **4D BIM-ready**: koppeling van taken aan IFC-gebouwonderdelen voor visuele bouwsimulatie
- **Lean Construction**: ondersteuning voor Last Planner System en look-ahead planning
- **AI-gestuurd**: MCP-server voor integratie met Claude en andere AI-assistenten

---

## 2. Architectuur

De architectuur volgt het patroon van **Open 2D Studio** en **OpenFEM2D Studio**:

### 2.1 Technologiestack

| Laag | Technologie | Toelichting |
|------|-------------|-------------|
| **Desktop shell** | **Tauri 2.0** | Lichtgewicht (~10 MB), native performance, cross-platform (Windows/Linux/macOS) |
| **Frontend** | **React 18 + TypeScript** | Strict mode, functionele componenten met hooks |
| **Rendering** | **HTML5 Canvas 2D** | Gantt-chart rendering, interactieve tijdlijn, drag & drop |
| **State management** | **Zustand + Immer** | Per-document store met slices, undo/redo via Immer patches |
| **Styling** | **TailwindCSS** | Theming via CSS-variabelen, dark/light mode |
| **Iconen** | **lucide-react** | Consistent met Open 2D Studio |
| **Build** | **Vite 5** | Dev server + bundler, TypeScript compilatie |
| **Backend** | **Rust** (Tauri) | IFC parsing/schrijven, zware berekeningen (CPM-solver) |
| **IFC-bibliotheek** | **web-ifc** (frontend) + **ifc-rs** (Rust) | Lezen/schrijven van IFC-bestanden |
| **MCP-server** | **Python 3.10+** | AI-integratie via Model Context Protocol |
| **Testen** | **Vitest + Playwright** | Unit tests + E2E tests |

### 2.2 Waarom deze stack

- **Tauri 2.0** in plaats van Electron: 15x kleiner, 5x minder geheugen, betere security
- **Zustand** in plaats van React Context: betere performance bij grote planningen (duizenden taken), fine-grained subscriptions
- **Canvas 2D** in plaats van DOM/SVG: vloeiende rendering van grote Gantt-charts met duizenden bars
- **Rust backend**: CPM-berekeningen en IFC-serialisatie op native snelheid
- **IFC als native formaat**: directe interoperabiliteit met BIM-ecosysteem

### 2.3 Applicatie-architectuur (high-level)

```
┌─────────────────────────────────────────────────────────┐
│                    Tauri 2.0 Shell                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │              React 18 Frontend                     │  │
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

## 3. Mappenstructuur

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
│   │   │   └── MilestoneRenderer.ts  # Mijlpaal-symbolen
│   │   ├── scheduler/
│   │   │   ├── CPMSolver.ts          # Forward/backward pass (TypeScript fallback)
│   │   │   ├── ResourceLeveler.ts    # Resource-nivellering
│   │   │   ├── CalendarEngine.ts     # Werkdagen/uren berekening
│   │   │   └── FloatCalculator.ts    # Float & kritiek pad analyse
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
│   │   │   └── dutchHolidays.ts      # Nederlandse feestdagen
│   │   ├── export/
│   │   │   ├── pdfExport.ts          # PDF-export (Gantt)
│   │   │   ├── csvExport.ts          # CSV-export
│   │   │   └── xmlExport.ts          # P6 XML-export
│   │   ├── import/
│   │   │   ├── mppImport.ts          # MS Project import
│   │   │   ├── p6Import.ts           # Primavera P6 XER import
│   │   │   └── csvImport.ts          # CSV-import
│   │   └── integration/
│   │       └── claudeService.ts      # Claude AI-integratie
│   ├── components/                   # React UI-componenten
│   │   ├── canvas/
│   │   │   ├── GanttCanvas.tsx       # Hoofd Gantt-canvas component
│   │   │   ├── TimelineHeader.tsx    # Tijdas boven het Gantt-diagram
│   │   │   └── TaskTable.tsx         # Tabel links van het Gantt-diagram
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
│   │   │   └── BaselinePanel.tsx     # Baseline vergelijking
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
│   │   │   └── SettingsDialog/      # Applicatie-instellingen
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
│   │   └── fr.json                  # Frans
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
│   │   │   └── calendar.rs          # Kalender berekeningen
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
│   │   └── project_tools.py         # Project MCP tools
│   ├── pyproject.toml
│   └── requirements.txt
├── examples/                        # Voorbeeldplanningen
│   ├── woongebouw-nieuwbouw.ifc     # Voorbeeld: nieuwbouw woongebouw
│   └── README.md                    # Toelichting voorbeelden
├── docs/                            # Documentatie
│   ├── architecture.md              # Architectuur overzicht
│   ├── ifc-mapping.md               # IFC schema mapping
│   └── user-guide.md                # Gebruikershandleiding
├── templates/                       # Projectsjablonen
│   ├── nieuwbouw-woning.ifc         # Template nieuwbouw woning
│   ├── renovatie.ifc                # Template renovatie
│   └── utiliteitsbouw.ifc           # Template utiliteitsbouw
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

## 4. IFC Data Model — Mapping

Open Planner Studio slaat **alle planningsdata op in IFC 4.3** formaat. Hieronder de mapping van intern model naar IFC-entiteiten:

### 4.1 Entiteiten-mapping

| Intern concept | IFC Entity | Toelichting |
|----------------|------------|-------------|
| **Project** | `IfcProject` | Hoofdcontainer, bevat naam, eenheden, kalender |
| **Planning** | `IfcWorkPlan` | Top-level plan met type (PLANNED/BASELINE/ACTUAL) |
| **Schema** | `IfcWorkSchedule` | Planning binnen een plan, bevat taken |
| **Taak** | `IfcTask` | Individuele activiteit met type, status, prioriteit |
| **Taaktijd** | `IfcTaskTime` | Alle tijddata: duur, start, eind, float, % gereed |
| **Mijlpaal** | `IfcTask` (isMilestone=TRUE) | Nul-duur markering in de tijd |
| **Dependency** | `IfcRelSequence` | Relatie tussen taken (FS/FF/SS/SF) met lag |
| **WBS-hiërarchie** | `IfcRelNests` | Ouder-kind relatie tussen taken |
| **Taak→Schema** | `IfcRelAssignsToControl` | Koppelt taken aan hun werkschema |
| **Resource** | `IfcConstructionResource` | Arbeid, materiaal, materieel |
| **Resource→Taak** | `IfcRelAssignsToProcess` | Wijst resource toe aan taak |
| **Taak→Product** | `IfcRelAssignsToProduct` | 4D BIM: taak ↔ gebouwelement |
| **Kalender** | `IfcWorkCalendar` | Werkdagen en -uren definitie |
| **Werktijd** | `IfcWorkTime` + `IfcRecurrencePattern` | Ma-Vr 07:00-16:00 etc. |

### 4.2 Dependency types

| Type | IFC SequenceEnum | Beschrijving |
|------|-------------------|-------------|
| Eind-Start (ES) | `FINISH_START` | Opvolger begint na afloop voorganger |
| Start-Start (SS) | `START_START` | Opvolger begint gelijk met voorganger |
| Eind-Eind (EE) | `FINISH_FINISH` | Opvolger eindigt gelijk met voorganger |
| Start-Eind (SE) | `START_FINISH` | Opvolger eindigt bij start voorganger |

### 4.3 IFC Task Types voor de bouw

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

### 4.4 IfcTaskTime — Volledige velden

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

## 5. Functionaliteiten — Roadmap

### Fase 1: Fundament (MVP) — v0.1

**Doel**: Basale planning kunnen maken, opslaan als IFC, en openen.

- [ ] Tauri 2.0 + React 18 + TypeScript + Vite project opzet
- [ ] Zustand store met project, task, sequence slices
- [ ] Gantt Canvas renderer (tijdas + taakbalken)
- [ ] Takenlijst (tabel links van Gantt)
- [ ] Taken toevoegen, bewerken, verwijderen
- [ ] Dependencies tekenen (FS) met drag & drop
- [ ] CPM forward/backward pass (TypeScript)
- [ ] Kritiek pad markering (rood)
- [ ] Float-berekening en weergave
- [ ] IFC-writer: project opslaan als .ifc
- [ ] IFC-reader: project openen vanuit .ifc
- [ ] Undo/redo (Immer patches)
- [ ] Werkkalender (ma-vr, 8 uur/dag)

### Fase 2: Professionele Planning — v0.5

- [ ] Alle dependency-types (FS, FF, SS, SF) + lag/lead
- [ ] WBS-hiërarchie met inklapbare groepen
- [ ] Mijlpalen
- [ ] Baselines opslaan en vergelijken
- [ ] Resource-definitie (arbeid, materieel, materiaal)
- [ ] Resource-toewijzing aan taken
- [ ] Resource-histogram
- [ ] Resource-nivellering
- [ ] Tijdschalen: dag, week, maand, kwartaal, jaar
- [ ] Zoom & pan op tijdlijn
- [ ] Taak slepen (verplaats start, verander duur)
- [ ] Meerdere planningen per project (tabs)
- [ ] Ribbon toolbar (Office-stijl)
- [ ] Rechtermuisklik contextmenu
- [ ] Sneltoetsen

### Fase 3: Bouwsector Features — v1.0

- [ ] Nederlandse feestdagen en bouwvak
- [ ] Weercondities per taak (buitenwerk/binnenwerk markering)
- [ ] Inspectiemomenten als verplichte mijlpalen
- [ ] Fasering-templates (fundering, ruwbouw, afbouw, installatie, oplevering)
- [ ] Look-ahead planning (3-6 weken vooruit)
- [ ] Last Planner System: PPC-tracking (Percent Plan Complete)
- [ ] S-curve (Earned Value / voortgang)
- [ ] Print/PDF-export van Gantt-diagram
- [ ] CSV/Excel-export
- [ ] Import: MS Project XML, Primavera P6 XER
- [ ] Meertaligheid (NL, EN, DE, FR)

### Fase 4: 4D BIM & AI — v2.0

- [ ] 4D BIM: IFC-model laden en taken koppelen aan gebouwelementen
- [ ] 3D viewer (Three.js + web-ifc) met tijdlijn-animatie
- [ ] Bouwsimulatie: stap door de planning en zie het gebouw groeien
- [ ] MCP-server voor AI-integratie
- [ ] AI-gestuurde planning suggesties
- [ ] Clashdetectie tussen gelijktijdige werkzaamheden
- [ ] Locatie-gebaseerd plannen (Line of Balance)
- [ ] Subcontractor-toewijzing en -communicatie
- [ ] ERPNext-integratie (projecten, inkoop, timesheets)
- [ ] Cloud-synchronisatie en samenwerking

---

## 6. Kernalgoritmen

### 6.1 Critical Path Method (CPM)

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

### 6.2 Resource Leveling

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

### 6.3 Kalenderberekening

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

---

## 7. UI/UX Ontwerp

### 7.1 Hoofdvenster layout

Het venster volgt de Office/AutoCAD-stijl van Open 2D Studio:

```
┌─────────────────────────────────────────────────────────────┐
│ ▸ Bestand  Bewerken  Beeld  Invoegen  Planning  Hulp       │  ← MenuBar
├─────────────────────────────────────────────────────────────┤
│ [Taak+] [Dep+] [Mijlpaal] [Resource] │ [CPM ▶] [Baseline] │  ← Ribbon
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
│ Taken: 42  │ Kritiek pad: 28d  │ Float: 5d  │ Zoom: 100%   │  ← StatusBar
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Kleuren & thema

| Element | Kleur | Toelichting |
|---------|-------|-------------|
| Kritieke taken | `#DC2626` (rood) | Taken op het kritieke pad |
| Normale taken | `#2563EB` (blauw) | Taken met speling |
| Mijlpalen | `#7C3AED` (paars) | Diamant-symbool ◆ |
| Baseline | `#6B7280` (grijs, gestreept) | Oorspronkelijke planning |
| Float | `#10B981` (groen, lijn) | Vrije speling achter taak |
| Gereed deel | Donkerder variant | Voortgang binnen de balk |
| Weekend/feestdag | `#F3F4F6` (lichtgrijs) | Niet-werkbare dagen |
| Dependency-pijlen | `#374151` (donkergrijs) | Verbindingslijnen |

### 7.3 Interactie

- **Taak slepen**: horizontaal = verplaats in tijd, rand slepen = duur wijzigen
- **Dependency tekenen**: sleep van taakrand naar taakrand
- **Dubbelklik**: open taak-eigenschappen dialoog
- **Rechtermuisklik**: contextmenu (bewerken, verwijderen, dependency toevoegen)
- **Scroll**: verticaal door taken, horizontaal door tijdlijn
- **Ctrl+Scroll**: zoom in/uit op tijdlijn
- **Selectie**: klik = enkele selectie, Ctrl+klik = multi-selectie, Shift+klik = bereik

---

## 8. MCP Server — AI Integratie

### 8.1 Beschikbare tools

| Tool | Beschrijving |
|------|-------------|
| `get_project_info` | Projectnaam, start, einde, statistieken |
| `list_tasks` | Alle taken met filters (fase, status, kritiek) |
| `get_task` | Details van één taak |
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

### 8.2 Voorbeeldgesprek met AI

```
Gebruiker: "Maak een planning voor een nieuwbouw woongebouw,
            6 maanden, start 1 maart 2026"

Claude: [roept add_task aan voor elke fase]
        [roept add_dependency aan voor de relaties]
        [roept run_cpm aan]
        [roept get_critical_path aan]

        "Ik heb een planning gemaakt met 42 taken in 5 fasen:
         1. Grondwerk (3 weken)
         2. Fundering (4 weken)
         3. Ruwbouw (8 weken)
         4. Installaties (6 weken, deels parallel)
         5. Afbouw & oplevering (5 weken)

         Kritiek pad: 24 weken → einddatum 17 augustus 2026.
         Totale float: 2 weken."
```

---

## 9. Referentie-analyse: Vergelijking met bestaande tools

| Feature | Primavera P6 | MS Project | Asta Powerproject | **Open Planner Studio** |
|---------|-------------|------------|-------------------|------------------------|
| CPM | ✅ | ✅ | ✅ | ✅ |
| Gantt | ✅ | ✅ | ✅ | ✅ |
| WBS | ✅ | ✅ | ✅ | ✅ |
| Resources | ✅ | ✅ | ✅ | ✅ |
| Baselines | ✅ | ✅ | ✅ | ✅ |
| 4D BIM | Via Synchro | Nee | ✅ | ✅ (v2.0) |
| IFC-native | Nee | Nee | Nee | **✅** |
| Open source | Nee | Nee | Nee | **✅** |
| AI-integratie | Nee | Copilot (beperkt) | Nee | **✅ (MCP)** |
| Bouwsector | ✅ | Generiek | ✅ | **✅** |
| Last Planner | Nee | Nee | Nee | **✅ (v1.0)** |
| Prijs | ~€3.500 | ~€600/jr | ~€1.400 | **Gratis** |

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

**LGPL-3.0** — Consistent met de OpenAEC Foundation filosofie. Iedereen mag de software gebruiken, aanpassen en distribueren, ook in commerciële contexten, mits wijzigingen aan de bibliotheek zelf ook open-source blijven.
