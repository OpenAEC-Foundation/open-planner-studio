# Dialogen: keuzes die verrassen

De dialogen in `src/components/dialogs/` hebben een paar keuzes waarvan de gewone vorm hetzelfde lijkt te doen maar
een fout gaf, of waarvan de reden buiten de dialoog ligt. Die staan hier. Hoe dialogen stapelen, de z-index boven de
sluitvraag van een tabblad en de backdrop-regel staan in de regel `ui-shell` en in `Dialog.tsx`; Enter in de
kalenderdialoog staat in ADR 0463.

## Gevolgen

- Een dialoog die boven een andere open dialoog stapelt, stopt de klik op zijn backdrop (`stopBackdropPropagation` in
  `ConfirmDialog` en `ContourDialog`), en `ConfirmDialog` vangt zijn toetsen in de capture-fase op `document`.
  Anders vuurt de backdrop-klik of de Escape-listener van de dialoog eronder ook en sluit die mee. Om dezelfde reden
  vangt de grote editor van `ScreenshotAnnotator` Escape in de capture-fase met `stopPropagation`: Escape sluit alleen
  de editor, niet `FeedbackDialog` met de getypte tekst.
- `ContourDialog` sluit op Escape alleen zichzelf. De globale Escape-sneltoets heft met de focus op een knop de
  taakselectie op, en daarmee verdwijnen het eigenschappenpaneel en dit venster.
- `FormatNoticeDialog` en `JustUpdatedDialog` sluiten eerst zichzelf en openen dan Help; andersom opent Help achter
  de dialoog.
- `FeedbackDialog` zet "al binnen" alleen terug als het aan staat (`alreadyInRef`), niet onvoorwaardelijk bij elke
  wijziging. Een onvoorwaardelijke `setAlreadyIn(false)` gaf bij snel typen "Maximum update depth exceeded" en een
  weggevallen teken (knownbug 151). Na een onzekere verzendpoging biedt de dialoog geen GitHub-route meer, ook niet na
  een latere zekere mislukking: de onzekere poging kan alsnog binnenkomen, en dan staat de melding er twee keer.
- `ScreenshotAnnotator` voorkomt de standaard focusactie van `mousedown` op het canvas; anders blurt het net geopende
  tekstveld meteen en verdwijnt het leeg. Zijn focus-trap luistert ook op `document`, omdat de focus na tekenen op
  het canvas op `body` staat. Lukt het samenvoegen van screenshot en afdekking niet, dan legt *Klaar* niets vast en
  blijft de editor open: nooit het origineel zonder afdekking versturen.
- `WelcomeDialog` sluit de welkomst en opent de rondleiding in één `setUI`. Een store-abonnee (de wachtende
  updatedialoog, via `isOnboardingActive`) mag geen moment zien waarop alles dicht is.
- `SettingsDialog` geeft `useFocusTrap` een vaste functie voor de beginfocus: de trap zet de focus opnieuw zodra die
  functie een andere identiteit krijgt.
- `CalendarDialog` rekent na Toepassen alleen door als `commitCalendarLibrary` iets vastlegde. Even kijken en
  Toepassen zou anders een document in de stand "datums zoals opgeslagen" herberekenen.
- `MoveProjectDialog` toont een volledige droogrun van de berekening, geen schatting: de kalender schuift niet mee,
  dus het projecteinde kan met een ander aantal dagen verspringen dan de verschuiving. Het einde en de duur in
  werkdagen zijn twee losse symptomen met elk een eigen sleutel, zodat er geen zin als "van 177 naar 177 werkdagen"
  ontstaat. De meeverschoven onderdelen staan als "label: aantal" en niet als zin met vier tellingen, omdat zo'n zin
  per telling een eigen meervoudsvorm nodig heeft.
- In `ProgressImportDialog` staat `tasks` in de afhankelijkheden van het voorbeeld, met een gerichte
  `eslint-disable`, al gebruikt de closure hem niet letterlijk: het voorbeeld leest de actuele taken via de store.
- `TaskDialog` voert een in de dialoog bevestigde hernoeming van een werksoort pas uit als de bewerksessie dicht is,
  als eigen stap: anders draait Annuleren haar terug en voegt Opslaan haar samen met de taakbewerking. De relaties
  (`TaskDependenciesSection`) staan er met `interactive={false}`, zonder sprongknop: de dialoog kan op elk tabblad open
  staan, zonder Gantt die het signaal "spring naar taak" oppikt. Die knop staat alleen in het eigenschappenpaneel.
- Het handmatige installatiecommando in `UpdateDialog` (`DEB_INSTALL_COMMAND`) zoekt `amd64.deb"` met de afsluitende
  quote, zodat het `.deb.sig`-bestand van dezelfde release niet ook matcht en `curl` twee URL's krijgt.
