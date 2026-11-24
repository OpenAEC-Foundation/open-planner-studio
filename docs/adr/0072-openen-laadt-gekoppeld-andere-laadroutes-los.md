# Openen laadt gekoppeld; de andere laadroutes laden los of bewerken

Alle routes die een project in het actieve document zetten, lopen door één implementatie (`applyLoadedProject`), maar
ze bedoelen niet hetzelfde. We onderscheiden er drie. Een echt open-pad (Bestand → Openen, Recent, de site, slepen,
de dev-link, `planner_import_schedule` en Bestand → Importeren via een extensie) loopt via `openAsDocument` en laadt
gekoppeld: bibliotheekbinding en herkomststempels blijven en de open-grens draait. Wie naar het bronbestand
terugschrijft, moet ook alles geladen hebben wat erin stond; anders wist de eerstvolgende Ctrl+S de
bibliotheekkoppeling uit dat bestand. Zo'n open-pad hergebruikt alleen een leeg, ongewijzigd tabblad; met
niet-opgeslagen werk in het actieve tabblad krijgt het geopende bestand een eigen tabblad. Een losse load (`loadState`,
de route van de extensie-API `api.data.loadProject`, en de voorbeeldprojecten) vult het actieve document en laadt het
project zonder bedrijfsbinding en herkomststempels. De IFC-editor (`applyProjectEdit`) bewerkt het huidige document als één undo-stap. Het crashherstel
loopt niet door deze implementatie maar door `restoreDocuments`.

## Gevolgen

- Alleen een formaat dat de formatRegistry als opslagdoel toelaat (`saveTargetFor`) krijgt bij openen een opslagdoel.
  Opslaan schrijft altijd IFC-tekst, dus elk ander bronformaat zou zijn eigen bestand met IFC laten overschrijven;
  Ctrl+S wordt daar Opslaan als. Recent bewaart zo'n bestand wel, zodat heropenen blijft werken.
- Een bron van een extensie-importer is nooit een opslagdoel (`OpenedFileSource.saveTarget: false`): een onbekende
  extensie leest als IFC, en dan zou Ctrl+S IFC-tekst naar het bronbestand van de importer schrijven
  (`check-ext-contract.ts` 12).
- De IFC-editor vervangt de inhoud, niet het document: project-id, bedrijfsbinding, de keuze voor Automatisch opslaan
  en het opslagdoel blijven. Was het `InternalProjectId` in de tekst gewijzigd, dan verhuizen de GlobalId-sleutels van
  project, werkplan en werkschema naar het id van de sessie, zodat de writer de bewaarde GlobalIds terugvindt.
- De keuze voor letterlijke kalenders wordt bij een bewerking nooit kleiner: toepassen voegt de letterlijke kalenders
  van de tekst toe aan die van het document. Een kalender te veel letterlijk is de veilige richting, en daarom hoeft
  undo de keuze niet terug te zetten.
- Vervangt een load de inhoud op hetzelfde opslagdoel zonder eigen bron (IFC-paneel, `loadState` zonder doel), dan
  blijven de bron (`ifcSource`) en het bronkenmerk van het document staan. Anders viel een vreemd deel uit de bewaking
  en schreef Ctrl+S het modelbestand over met alleen planning.
- Een MCP-backup van een document met een bronkenmerk draagt dat kenmerk (`OPS_RecoveryForeignSource`). Wie zo'n
  backup opent, krijgt het kenmerk terug zonder opslagdoel, met de flag `ifcForeignContent` aan als ontbrekende bron.
  Anders schreef Ctrl+S de backup over zonder kenmerk en mocht Opslaan als daarna over de bron.
- *WBS auto* bij het openen (eigenaarsbesluit 2026-10-17) draait alleen op de echte open-paden, op de payload vóór
  publicatie, dus zonder undo-stap en zonder het document gewijzigd te maken. Het staat niet in `payloadFromImport`,
  omdat die ook het crashherstel bouwt (`check-wbs-auto-on-open.ts`).
- Een voorbeeldproject heeft geen bronbestand: geen pad, geen opslagdoel en geen Recent.
