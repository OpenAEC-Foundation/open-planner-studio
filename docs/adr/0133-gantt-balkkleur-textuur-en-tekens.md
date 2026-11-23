# Kleur, textuur en tekens op Gantt-balken

De kleur van een balk draagt de analyse: `barColor` geeft een trace-tint voorrang, en anders kritiek boven
near-critical boven de float-path-tint (`floatPath` groter dan 1) boven normaal. Eigen kleuren in de modus kritiek
pad vervangen die tinten, aangepast aan het thema. In de modus kritiek pad leest de schermbalk `Task.color` niet;
de andere modi komen uit `computeBarColors`, dezelfde pure regel als de afdruk, en zetten een rode rand om een
kritieke taak als het modusadvies dat vraagt. In het hoogcontrastthema is kleur alleen niet genoeg: een kritieke
balk is massief, een near-critical balk krijgt een geblokt patroon over zijn kleur (`getNearCriticalHatch`) en een
normale balk een rand. In licht en donker blijft de kleur het enige signaal.

## Gevolgen

- Categoriekleuren (werksoort, resource, code) gaan door `categoryColor`: in hoog contrast getoetst tegen de
  achtergrond en de weekend- of weekbandkleur (`ensureHighContrastBarVisible`), anders zichtbaar gemaakt voor het
  thema (`ensureThemeVisible`). Het resource-accent onder de balk volgt dezelfde weg, zodat een donkere
  resourcekleur in het donkere thema niet wegvalt. De afdruk doet dat niet: papier is licht.
- Het resource-accent is een aanvulling op de balkkleur, geen vervanging: een dun streepje onder een bladbalk,
  verdeeld naar `unitsPerDay` als er meer resources zijn. Zijn hoogte komt uit `barLayout`.
- De spelingsband is een halve balkhoogte, verticaal gecentreerd, met de float-kleur op 25 % en daarover een
  kruisarcering in dezelfde kleur (`getCrossHatch`). Zo leest hij als ruimte en niet als tweede balk, en blijft hij
  herkenbaar zonder kleurwaarneming. Hij eindigt op het laatste einde (`floatBandEnd`, `check-float-band-end`),
  telt mee in de zichtbaarheidstest van de balk (`check-gantt-float-cull`) en ontbreekt bij een voltooide taak en
  met `showFloatBand` op false. Het contrast van de float-kleur per thema bewaakt `check-theme-contrast`.
- Een hammock is een dunne balk met haakvormige eindkappen (de P6-vorm voor LOE) en heeft geen voortgangsvulling,
  omdat zijn looptijd is afgeleid.
- Een externe ghostbalk eindigt op het bevroren anker bij een externe voorganger en begint erop bij een externe
  opvolger. Ontbreekt de bron, dan krijgt hij een gestippelde rand en een badge. Hij wordt op volle dekking
  getekend, ook in een gedimde rij.
- De aantekeningstip staat er alleen bij minstens één open aantekening en is neutraal grijs: informatie, geen
  waarschuwing.
- Een gedimde rij in een filter (de ouderketen) tekent op 0,45, een taak buiten een trace op 0,25.
- In een ingeklapte mijlpalenreeks staan mijlpalen op dezelfde dag als één ruitje (`milestoneGroups.ts`). Dat
  ruitje is gekozen als één lid gekozen is, gedimd als alle leden buiten de trace vallen, heeft de trace-tint van het
  eerste lid in de trace en de kleur van een kritiek lid als er een is. De naam van een ruitje kapt af vóór het
  volgende ruitje; de datum vervalt als hij daar niet past. Een mijlpaalnaam is hooguit 200 px breed.
- Constraintpins en de aantekeningstip staan op de dagrand, ook bij een uurtaak (knownbug 1977).
