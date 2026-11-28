# Keuzes in src/state (n–z) die verrassen

De losse modules in `src/state/` (van `newTaskMeasure.ts` tot `xerExportNotice.ts`) bevatten een paar keuzes die een
lezer zonder uitleg zou terugdraaien. Ze staan hier bij elkaar, per functie; meldingen staan in ADR 0840.

## Gevolgen

- **Datums zoals opgeslagen verlaten** (`recordedDatesExit.ts`, bij ADR 0782). `leftRecordedDatesMode` telt de overgang
  alleen binnen hetzelfde document: `datesAsRecorded` is documentdata en wisselt ook bij een documentwissel, en dan
  zou de app een ander document ongevraagd doorrekenen. Een herstel uit de historie (`restoredFromHistory`) telt ook
  niet: een undo kan de modus uitzetten naar een toestand die de historie zo vastlegde, en rekenen zou de opgeslagen
  datums overschrijven. `needsExitRecompute` beslist pas bij het uitvoeren (na `setTimeout` 0): een bulktransactie
  verlaat de modus bij de eerste mutatie en muteert daarna door, acties die zelf `runCPM` aanroepen hebben
  `scheduleStale` dan al teruggezet, en een Ctrl+Z ertussen zet de modus weer aan.
- **Projectstart klemmen** (`applyProjectPatch` in `projectPatch.ts`): de verouderde wortel-ankers vóór een nieuwe
  projectstart klemt de bewerking zelf, niet de solver. Alleen hier is bekend dat de planner zojuist de projectstart
  verzette; in de solver heeft een verouderd anker dezelfde vorm als een eerder anker uit MS Project, en dat wint
  daar (ADR 0011).
- **Kringtoets** (`relationAddVerdict` in `relationRules.ts`): de kringtoets zit niet in `relationVerdict`, want die
  draait ook per relatie bij plakken en sjablonen (`insertRemappedRelations`, een kopie van een acyclische tak maakt
  geen kring) en in de MCP-draft, die een eigen kringtoets en een terugdraai na de eindberekening heeft.
- **Taak bewerken** (`createTaskDialogSave` in `taskDialogSave.ts`): de tijdvelden komen bij Opslaan uit de store, niet
  uit het concept, zodat een herberekening terwijl de dialoog open stond niet wordt teruggedraaid; de duur komt alleen
  uit het concept als de planner hem in de dialoog wijzigde. De voortgangsregels draaien hier en niet in `updateTask`:
  die schrijft voortgangsvelden bewust rauw, voor de extensie-API (`fromExtTaskTimePatch`) en voor imports met een
  eigen restduur.
- **Invoegen buiten de boomweergave** (`taskInsertActions.ts`): *+ Taak* zet de taak dan achteraan met een rode melding
  (eigenaarsbesluit 2026-10-19 5a), want het is een toevoegactie met een voorkeursplek en weigeren zou in een
  gegroepeerde weergave geen nieuwe taak meer toelaten. *Invoegen boven/onder* weigert, want achteraan uitkomen zou
  misleiden. Het anker volgt de volgorde op het scherm, niet de klikvolgorde of de volgorde van `tasks`.
- **Selectie na verwijderen** (`selectNeighbourAfterRemoval` in `selectionAfterRowChange.ts`) draait na het opnieuw
  berekenen van `viewRows`: een fase die alleen zichtbaar was als ouder van een gefilterd kind valt met dat kind weg,
  en haar selecteren zou haar bij het volgende Verwijderen wissen.
- **Projectkalender in de bibliotheek** (`syncProjectCalendar.ts`) wijst een nieuwe array toe in plaats van `push`:
  `s.calendars` kan daar een door Immer bevroren array zijn die in dezelfde `set` uit een payload of snapshot werd
  toegewezen (uit het weggehaalde commentaar, niet nagegaan).
- **Undo en het IFC-schema** (`restoreSnapshot` in `snapshot.ts`): `project.ifcSchema` en `ifcSchemaUnconfirmed`
  blijven die van de live state (`withFileIfcSchema`): ze horen bij het bestand, niet bij de bewerkingsgeschiedenis.
- **Geheugenschatting van de sessiehistorie** (`sessionHistory.ts`): de constanten per element zijn geijkt op een meting
  (Node, 2000 taken, 20 stappen, review 2026-09-28): een naam op alle taken ongeveer 280 B per taak, een bewerking met
  herberekening ongeveer 1550 B per taak, een baseline ongeveer 176 B per vastgelegde taak. Andere elementen zijn niet
  gemeten en krijgen de taakschatting (uit het weggehaalde commentaar).
- **Letterlijke kalenders na een export** (`exportHitsOwnFile` in `savedLiteralCalendars.ts`): is niet vast te stellen
  of een export het eigen bestand schreef, dan telt het als het eigen bestand; hooguit blijft dan een kalender te veel
  letterlijk.
- **Open tekstinvoer afronden** (`createPendingTextEdits` in `pendingTextEdits.ts`): eerst committen alle velden, daarna
  geeft elke tekstbewerking alleen haar eigen rekenrem vrij. Geen algemene reset van `editHold`: een sleepgebaar dat
  tegelijk loopt, houdt zijn rem.
- **Sitevragen** (`installSiteDialogAskers` in `siteDialogBridge.ts`) worden in `App.tsx` direct geladen, ook al laden de
  dialogen zelf lui: zonder die registratie vallen Openen en Opslaan stil terug op deze pc.
- **Merknamen** van de ingebouwde rekenprofielen (`BUILT_IN_PROFILE_BRANDS` in `schedulingProfileNotice.ts`) gaan niet
  door `t()`: een merknaam verschilt niet per taal, en de store heeft geen `t()`.
