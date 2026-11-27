# Paneelschakelaars in het lint

Een lintknop die een paneel aan- en uitzet, is actief zolang je dat paneel ziet, niet zolang zijn vlag aan staat.
Voor de railpanelen (Eigenschappen, Resourcedock, Waarschuwingspaneel, Verschuivingen) betekent dat: de vlag aan, de
rail niet ingeklapt (`rightPanelCollapsed`) en de rail niet verdrongen door het volledige resourcepaneel
(`showResourcePanel && !resourcePanelDocked`). Alleen de vlag lezen laat de knop oplichten terwijl de kolom leeg en
ingeklapt is. Bij Eigenschappen, Resources en Resourcedock zet een klik op een knop die niet actief is het paneel
aan. Dat een railpaneel dan ook in beeld komt, regelt `setUI` in `uiSlice.ts` voor elke aanroeper: een railpaneel
aanzetten klapt de rail uit, en de rail uitklappen sluit het volledige resourcepaneel. Een tweede klik op een actieve knop sluit het paneel weer (eigenaarsbesluit 7 november 2026: een knop die
een venster of paneel opent, sluit het bij een tweede klik). Waarschuwingspaneel en Verschuivingen tonen hun stand op
dezelfde manier, maar hun klik keert de vlag om (`COMMANDS.toggleWarningsPanel`, `scheduleShiftPanelButton`); zie
knownbug 2521.

## Gevolgen

- Eigenschappen uitzetten raakt `rightPanelCollapsed` niet: dat veld is de stand "geef de Gantt de breedte", geen
  paneelkeuze.
- Resources en Resourcedock doen iets anders en heten daarom anders, met een eigen icoon, op beide tabbladen
  hetzelfde. Resources (`openResourcePanelButton`) opent het volledige paneel, dat de werkruimte overneemt
  (`resourcePanelDocked: false`); Resourcedock (`dockResourcePanelButton`) zet de compacte lijst in de rail
  (`resourcePanelDocked: true`).
- Het icoon `resource.dock` zegt waar het paneel komt, `resource.workspace` wat erin staat. Volgens het weggehaalde
  commentaar volgt het dock-icoon (een rechthoek met een afgescheiden zijvak, zonder pijlpunt omdat die in de
  compacte strip wegvalt) de conventie van VS Code en Figma voor deze schakelaar; dat is niet nagegaan. Het draagt
  `ops-icon-rail` en spiegelt in RTL (`ar`, `fa`) mee in `Ribbon.css`, omdat de rail daar links staat. Het wisselt
  niet van icoon bij aan of uit: de actieve stand van het lint is de terugkoppeling, net als bij Histogram.
  Eigenschappen wisselt wel, tussen `panel.properties` en `panel.properties-hidden`.
- Nieuwe resource zet alleen het verzoek `pendingNewResource`, met het volledige paneel (`resourcePanelDocked:
  false`). Alleen `ResourcePanel` handelt dat verzoek af: het opent een conceptrij, zoals de knop "+ Nieuwe resource"
  in het paneel, en de resource ontstaat pas bij een naam. Zo komt er geen naamloze resource met een eigen
  undo-stap.
