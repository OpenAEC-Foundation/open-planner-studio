# Paneelschakelaars in het lint

De knoppen voor de railpanelen en het resourcepaneel lichten op als je het paneel ziet, niet alleen als zijn vlag aan
staat: alleen de vlag lezen liet een knop oplichten terwijl de kolom leeg en ingeklapt was. Histogram volgt alleen
zijn vlag. Een tweede klik op een knop die een venster of
paneel opent, sluit het weer. Dat volgt uit de lintcontrole van de eigenaar op 7 november 2026 (punt 4), verwerkt in
PR #841: daar sloten popovers en paneelschakelaars al, en dekken modale vensters het lint af, zodat een tweede klik op
hun knop niet kan; Kolommen en Resources kregen toen hun tweede klik. De regel verschilt per knop.

## Per knop

- Eigenschappen (Beeld → Panelen) is actief als `showPropertiesPanel` aan staat, de rail niet ingeklapt is
  (`rightPanelCollapsed`) en het volledige resourcepaneel er niet is (`showResourcePanel && !resourcePanelDocked`).
  Een klik op de actieve knop zet alleen de vlag uit en laat `rightPanelCollapsed` staan: dat veld is de stand "geef
  de Gantt de breedte", geen paneelkeuze. Een klik op de niet-actieve knop zet de vlag aan; `setUI` klapt dan de
  rail uit en sluit daardoor ook het volledige resourcepaneel. Het icoon wisselt tussen `panel.properties` en
  `panel.properties-hidden`.
- Resourcedock (`dockResourcePanelButton`) is actief als het dock aan staat (`showResourcePanel` en
  `resourcePanelDocked`) en de rail niet ingeklapt is. De klik op de niet-actieve knop zet het dock aan, ook in de
  plaats van het volledige paneel; `setUI` klapt de rail dan uit. Een klik op de actieve knop zet het dock uit.
- Resources (`openResourcePanelButton`) is actief als het volledige paneel aan staat, dat de werkruimte overneemt
  (`resourcePanelDocked: false`). Een klik op de niet-actieve knop opent het, ook in de plaats van het dock; een klik
  op de actieve knop sluit het.
- Histogram (`toggleHistogramButton`) is actief als `ui.showHistogram` aan staat, ook als het volledige resourcepaneel
  de Gantt met het histogram vervangt. De klik keert de vlag om via `COMMANDS.toggleHistogram`.
- Waarschuwingspaneel en Verschuivingen zijn actief op dezelfde manier als Eigenschappen, maar hun klik keert de vlag
  om (`COMMANDS.toggleWarningsPanel`, `scheduleShiftPanelButton`); zie knownbug 2521.

Het uitklappen van de rail in `setUI` (`uiSlice.ts`) geldt alleen als de aanroeper zelf geen `rightPanelCollapsed`
meegeeft; een expliciete waarde wint. De lintknoppen geven die nooit mee.

## Gevolgen

- Resources en Resourcedock doen iets anders en heten daarom anders, met een eigen icoon, op beide tabbladen
  hetzelfde. Het icoon `resource.dock` zegt waar het paneel komt, `resource.workspace` wat erin staat. Volgens het
  weggehaalde commentaar volgt het dock-icoon (een rechthoek met een afgescheiden zijvak, zonder pijlpunt omdat die
  in de compacte strip wegvalt) de conventie van VS Code en Figma voor deze schakelaar; dat is niet nagegaan. Het
  draagt `ops-icon-rail` en spiegelt in RTL (`ar`, `fa`) mee in `Ribbon.css`, omdat de rail daar links staat. Het
  wisselt niet van icoon bij aan of uit: de actieve stand van het lint is de terugkoppeling, net als bij Histogram.
- Nieuwe resource zet alleen het verzoek `pendingNewResource`, samen met het volledige paneel (`showResourcePanel:
  true`, `resourcePanelDocked: false`). Dat paneel is nodig omdat alleen `ResourcePanel` het verzoek afhandelt en de
  bewerkbare conceptrij biedt, zoals de knop "+ Nieuwe resource" in het paneel. De resource ontstaat pas bij een
  naam (`commitPendingNew`), dus er komt geen naamloze resource met een eigen undo-stap.
