# Raster, tijdschaal en feestdagen in de Gantt

Op jaarzoom (1 tot 2 px per dag) maakt een rasterlijn per kalenderdag van de tijdlijn een egaal streeppatroon
waarin de balken verdwijnen. `gridDensityForZoom` kiest daarom de dichtheid: vanaf 8 px per dag een lijn per dag
(de weekgrens 1 px, de andere 0,5 px), vanaf 2 px per dag alleen de weekgrens, daaronder alleen de maandgrens. De
niet-werkdagarcering en de weekbanden zijn vlakken en blijven op elk zoomniveau staan; zij dragen de weekstructuur
zodra de lijnen wegvallen. Bewaking: `check-gantt-grid-density`.

Op de kalenderas komt de arcering van `CalendarEngine.isWorkDay` op de projectkalender (weekpatroon en
feestdagen), niet van een vaste zaterdag en zondag. Op een werkelijk gecomprimeerde as (*Alleen werkbare dagen
tonen* aan en de kalender heeft werkdagen) bestaan niet-werkdagen niet als kolom. `drawGridBackground` loopt daar
over de as-indices (`dateAtIndex`), zodat weekend en feestdag niet op dezelfde naad samenvallen met dubbele lijnen.
Er is dan niets te arceren; in plaats daarvan krijgen de kolommen van oneven weeknummers (`getWeekNumberFor` met
`weekStartDay`) de band `gridWeekBand`. De pariteit hangt aan het weeknummer en niet aan de beeldrand, zodat de
banden bij scrollen niet verspringen (`check-week-banding`).

## Gevolgen

- Op de gecomprimeerde as is een week- of maandgrens een overgang tussen twee getekende kolommen: de vorige
  as-index heeft een ander weeknummer of een andere maand. De weekstartdag of de eerste van de maand hoeft daar
  geen kolom te zijn (zondag bij weekstart zondag, maandag bij een kalender di–za). Ook de dikte van de lijn op
  dagzoom volgt die overgang. Rond de jaarwisseling kunnen twee buurweken dezelfde pariteit hebben (knownbug 1973).
- Maand en dag lezen de renderer met UTC-getters: de datums komen uit `parseDate` en `addCalendarDays` op
  UTC-middernacht, en een lokale getter verschuift de maandgrens in een tijdzone achter UTC (de tijdzonematrix van
  `tests/planning/run.sh`).
- De tijdschaalkop bepaalt zijn zichtbare bereik via de as-index (`dayIndexOf`, `dateAtIndex`), niet via
  `scrollX / zoom` in kalenderdagen; onder compressie liep de datumregel anders leeg (`check-header-compress`).
  De dagtier onder compressie stapt over as-indices (`drawWorkdayTierLabels`); week- en maandtier volgen de as via
  `dateToX`.
- Een kop die niet in zijn tick past, wordt overgeslagen (`drawTickLabel`): geen ellips en geen
  `fillText`-`maxWidth`. "ok…" of "20…" zegt niets over een datum, en de volgende tick die wel past, draagt het
  bereik. Een taaknaam krijgt wel een ellips, omdat een deel van een unieke naam de lezer helpt.
- In de 12-uursnotatie kiest de uurrij één vorm: past "12 AM" niet in de eerste kolom met breedte, dan staat de hele
  rij in de compacte vorm, zodat de vormen niet door elkaar staan.
- De dagtier zet de weekdagafkorting vóór het dagnummer vanaf zoom 40 en alleen met `localizedWeekdays`.
- Feestdagnamen (`drawHolidayLabels`) worden ná de taakbalken getekend: de naam verklaart een balk die over een
  feestdagblok is opgerekt, en een balk mag hem dus niet overschilderen. Een blok krijgt een naam vanaf drie
  dagbreedtes, als er minstens één dagbreedte van zichtbaar is. Vanaf 70 px staat de naam horizontaal: gecentreerd
  in het zichtbare deel als hij daarin past; een langere naam begint op de oorspronkelijke blokstart en wordt op het
  zichtbare deel afgeknipt, ook als die blokstart links buiten beeld ligt. Smaller staat hij verticaal langs de
  linkerrand van het zichtbare deel. In beide gevallen wordt de naam geknipt, niet samengeknepen. Op de gecomprimeerde as tekent de renderer geen feestdagnamen: het blok heeft daar geen
  breedte.
