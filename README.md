# Open Planner Studio

Open-source bouwplanningapplicatie voor de bouwsector. Native IFC-bestandsformaat.

![Open Planner Studio](screenshot.png)

## Kenmerken

- **Gantt-diagrammen** met interactieve Canvas-rendering, drag & drop, en zoom
- **Critical Path Method (CPM)** — automatische berekening kritiek pad en float
- **Work Breakdown Structure (WBS)** — hierarchische taakstructuur met inklapbare hoofdstukken
- **IFC-native** — opslaan en openen in IFC 4.3 (buildingSMART standaard)
- **Ribbon toolbar** — Microsoft Office-achtige ribbon met tabbladen
- **Meertalig** — Nederlands, English, Francais, Deutsch, Espanol, Zhongwen
- **Tabelweergave** — Excel-achtige editor met dubbelklik-bewerking
- **Rapportage** — instelbare printuitvoer met papierformaat, orientatie, legenda
- **Context menu** — rechtermuisknop voor snelle acties op taken
- **Resource management** — arbeid, materieel, onderaannemers
- **Bouwsector-specifiek** — feestdagen, bouwvak, inspectiemomenten, fasering
- **4D BIM-ready** — koppeling planning aan IFC-gebouwmodel

![Context Menu](screenshot-context-menu.png)

## Snel starten

```bash
# Installeer dependencies
npm install

# Start development server
npm run dev

# Open in browser
open http://localhost:5173
```

## Technologiestack

| Laag | Technologie |
|------|-------------|
| Desktop | Tauri 2.0 |
| Frontend | React 18 + TypeScript |
| Rendering | HTML5 Canvas 2D |
| State | Zustand + Immer |
| Styling | TailwindCSS |
| i18n | Custom React Context (6 talen) |
| Build | Vite 5 |

## Projectstructuur

```
src/
  components/
    canvas/          # GanttCanvas, ContextMenu
    dialogs/         # TaskDialog, ProjectInfoDialog
    layout/          # Ribbon, StatusBar
    panels/          # TableEditor, IFCPanel, ReportPanel, TaskPropertiesPanel
  engine/
    renderer/        # GanttRenderer (Canvas 2D)
    scheduler/       # CPMSolver, CalendarEngine
  i18n/              # Vertalingen (nl, en, fr, de, es, zh)
  services/
    ifc/             # IFC 4.3 lezen/schrijven
    print/           # Print preview
  state/             # Zustand store, slices
  types/             # TypeScript types (Task, Sequence, Resource, Calendar)
  utils/             # Date utilities, ID generator
examples/            # Voorbeeld IFC-planningen
```

## Ribbon Tabs

| Tab | Functie |
|-----|---------|
| **Start** | Bestand, Bewerken, Taken toevoegen, CPM berekenen, Zoom |
| **Planning** | CPM, Relaties beheren, Kalender, Vrije dagen |
| **Beeld** | Zoom, Tijdschaal, Panelen, Afdrukken |
| **Instellingen** | Project info, Kalender, Taalinstelling |
| **Tabel** | Excel-achtige tabelweergave met inline bewerking |
| **IFC** | IFC 4.3 code-editor met genereren/toepassen |
| **Rapport** | Rapportinstellingen en afdrukvoorbeeld |

## Architectuur

Volgt het patroon van [Open 2D Studio](https://github.com/OpenAEC-Foundation/Open-2D-Studio) en [Open FEM2D Studio](https://github.com/OpenAEC-Foundation/Open-FEM2D-Studio).

Zie [PLAN.md](PLAN.md) voor het volledige projectplan.

## Voorbeelden

Zie de [`examples/`](examples/) map voor voorbeeldplanningen in IFC-formaat.

## Licentie

LGPL-3.0
