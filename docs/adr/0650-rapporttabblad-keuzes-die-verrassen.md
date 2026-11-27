# Rapport-tabblad: keuzes die verrassen

De Gantt-afdruk op het Rapport-tabblad (`src/components/panels/reportStudio/`) bevat een paar keuzes die een lezer
zonder uitleg zou terugdraaien. De snelheidskeuzes van het papier (het opnamemodel draagt zijn tekenopdrachten alleen in
een closure, een blad krijgt geen heel papiermodel als prop, vaste handlers, één gedeelde stylesheet voor de
letterregels, `flushSync` voor de bladen in beeld, één opname per invoer onder StrictMode, het papier één frame na de
bediening) staan met hun metingen in `docs/superpowers/specs/2026-11-07-rapport-tabblad-bevindingen.md`; wat een
layout meeneemt en wat *Zoals de weergave* doet, staat in de gids `howto-rapport-maken-en-afdrukken.md`. Hier staat
wat daar niet staat.

## Gevolgen

- Kolommen of balkopties overnemen uit een layout (`takeOverFromLayout` in `GanttReportStudio.tsx`) schrijft alle
  waarden van dat deel, niet alleen de waarden die verschillen. De knop verschijnt op het verschil met de stand van dit
  tabblad, maar de gedeelde opslag kan intussen van elders zijn gewijzigd.
- Een gekozen layout die niet meer bestaat, valt pas terug op *Alle taken* als de eigen layouts gelezen zijn
  (`loaded` van `useReportLayouts`) en als diezelfde layout in de nieuwste opslag (`latestReportSettings`) nog gekozen
  is. Koos een ander scherm intussen een andere bron, dan neemt het tabblad die over in plaats van haar te wissen.
- `useReportColumnDomain` bouwt dezelfde domeininvoer als `TaskGridSurface` in `FullTaskGrid.tsx`, zodat een kolom op
  papier dezelfde kop en celtekst draagt als in de tabel. Wie daar een invoer wijzigt die de celtekst raakt, wijzigt
  haar hier mee.
- `StepPopover` (`studioChrome.tsx`) leest `onClose` via een ref. Met de functie als afhankelijkheid liep het
  focuseffect bij elke render opnieuw en zette het de focus na elke toetsaanslag terug.
- `ReportPaperView` neemt de breedte van het venster uit het scrollvak en de hoogte uit het hele papiervlak. De strook
  voor de zwevende exportknop maakt het scrollvak lager; met die hoogte zou *Hele blad* na het verschijnen van de strook
  weer een andere maat krijgen.
