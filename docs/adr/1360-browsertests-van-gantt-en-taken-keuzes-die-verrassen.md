# Browsertests van Gantt en taken: keuzes die verrassen

Een paar browsertests van de Gantt, de takenlijst en de taken zijn zo gebouwd dat een eenvoudiger opzet ook op
kapotte code zou slagen, of op een trage machine iets anders zou meten dan bedoeld. Die opbouw blijft staan, ook
als hij omslachtig lijkt.

## Gevolgen

- De test in `gantt-drag-undo.spec.ts` die een diagonale balksleep met één Ctrl+Z terugdraait, zet eerst een kleine
  horizontale stap (`firstStepX = 40`) en daarna een veel grotere verticale; de test eist dat verschil vooraf. Viel
  de richtingskeuze een tweede keer tijdens het gebaar, dan wordt die met deze verhouding verticaal en krijgt de
  doelrij een dropzone; dat toetst de test nog vóór het loslaten. Na het loslaten eist hij dezelfde rijvolgorde,
  precies één undo-stap en het herstel met Ctrl+Z. Met even grote stappen slaagt hij ook als de keuze opnieuw valt.
- `task-split.spec.ts` toetst de weigering van een mijlpaal in de splitsmodus met een mijlpaal die zijn datums en
  dus een balk houdt. Zo valt de klik echt op een balk en toetst de test `canSplitTask`, niet het ontbreken van een
  trefvlak.
- In `new-project-timeline-start.spec.ts` rekent de test met de fasen-sjabloon de projectstart uit de klok: de eerste
  van dezelfde maand een jaar na vandaag. De verse weergave begint op vandaag; een vaste datum ligt op een dag in het
  verleden en bewijst dan niet meer dat een latere start in beeld komt.
- `gantt-float-band.spec.ts` leest de spelingsband uit de canvaspixels. Het zoeken begint 30 px vóór *Laatste
  einde* en niet bij de balkrand, omdat de naam van de smalle balk rechts erachter op de band staat
  (`drawOutsideBarName`). Niet-groene stukjes tot 3 px slaat hij over: de band is een vulpatroon waar een
  rasterlijn doorheen valt. Het einde mag 2 px van *Laatste einde* afwijken.
- `gantt-split-scroll.spec.ts` leest de tekentellers van beide renderers vóór de horizontale scroll van het tweede
  paneel. Na de Shift+wiel eist hij de gedeelde verticale scrollstand en dat beide tellers groter zijn dan die eerdere
  lezing; daarin kunnen ook paints van vóór de Shift+wiel meetellen. Hij eist geen vast aantal tekenbeurten: het
  aantal paints is geen afspraak van de viewport.
- `taskBarPoint` van de dev-brug leest de geometrie van de renderer (`getTaskBarRect`), niet de store. Na een
  storemutatie die de as of de scroll verandert, wachten de sleeptests daarom op een nieuwe paint (`paintedAfter`
  in `gantt-hour-drag.spec.ts`) en op een balkpunt dat stilstaat over drie peilingen: een referentie en daarna twee
  opeenvolgende vergelijkingen met dezelfde positie en dezelfde tekenteller
  (`settledBarPoint`; `settledPoint` in `f4b-momenten-en-maten.spec.ts` en `gantt-drag-calendars.spec.ts`). Een meting
  direct na de mutatie kan de balk van de vorige as teruggeven.
- De test in `task-grid-overlay-scrollbars.spec.ts` over een verouderd scroll-event zet de volgorde van de events
  zelf neer, in twee aparte stappen. Eerst schuift hij het raster en stuurt meteen daarna een `scroll`-event van de
  balk, dat nog de oude stand draagt; het raster mag daardoor niet terugspringen. Later houdt hij met een
  capture-listener op `window` het event van het raster tegen terwijl de store nog de vorige stand doorgeeft, en
  laat het daarna alsnog door. Een echte wielbeweging levert geen van beide volgordes vast.
- `task-recorded-dates-block.spec.ts` eist dat *Datums zoals opgeslagen* in het eigenschappenpaneel altijd een
  infoblok in de accentkleur is (`alert--info`, `TaskRecordedDatesNotice`), nooit een grijs blok (`alert--neutral`).
  Ook een taak waarvoor het bestand niet alles bewaarde, krijgt dat blok, met de ontbrekende velden als derde regel
  (eigenaarsbesluiten 2026-10-17 en 2026-10-19, besluit 4).
