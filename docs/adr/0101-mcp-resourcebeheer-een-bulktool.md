# Resourcebeheer via MCP is één bulktool met acties

`planner_manage_resources` maakt resources aan, wijzigt en verwijdert ze, met één `action` per item, in plaats van
drie losse tools. Hij spiegelt zo `planner_manage_assignments`, de tool voor hetzelfde domein; een agent die de ene
kent, kent de andere. Aanmaken, wijzigen en verwijderen delen bijna al hun velden, en drie tools zouden drie bijna
gelijke beschrijvingen aan de toolkeuze toevoegen, wat de keuze van de agent slechter maakt. En "vervang de grote kraan
door twee kleine" is zo één aanroep en één stap ongedaan maken.

## Gevolgen

- De schrijfbare velden zijn wat de planner in het resourcepaneel kan wijzigen (naam, type, max. eenheden, kalender,
  uurtarief, meeteenheid, ploeg, beschikbaarheidsstappen) plus `description`. Dat veld staat in het `Resource`-type,
  reist mee door IFC en staat aan de leeskant, maar heeft in het paneel geen kolom. Niet schrijfbaar: `id` (de store
  maakt het) en `availability` (vervangen door `maxUnits`, alleen nog gelezen bij het openen van oude bestanden).
- Een afwezig veld blijft staan; `null` wist het. De patch draagt een gewist veld als sleutel met `undefined`, en
  `draft.updateResource` maakt daar een echte verwijdering van. Bij aanmaken betekent `null` gewoon niet gezet, zodat
  het object voor IFC schoon blijft. Een lege `availabilitySteps` wist de stappen: dat is een echt effect.
- Beschikbaarheidsstappen worden op datum gesorteerd, want de engine leest de laatste stap op of vóór de peildatum.
  Een stap naar 0 mag (niet beschikbaar, zoals in MS Project of een P6-tarief met 0); alleen de vlakke `maxUnits`
  moet groter dan 0 zijn.
- Verwijderen van een resource met toewijzingen vraagt `cascade: true`. Anders dan bij `planner_delete_tasks`, waar
  de meegewiste taken onder de gevraagde taak hangen, verdwijnt hier werk op taken die de aanroeper niet noemde. De
  weigering noemt het aantal toewijzingen en taken, zodat de agent in één ronde met `cascade: true` terugkomt, en het
  antwoord en een waarschuwing noemen wat er weg is. De tool draagt daarom `destructiveHint`.
- Een ploeg (`parentId`) wijst alleen naar een CREW, nooit naar zichzelf en niet zo dat er een kring ontstaat. Een
  kring die al verderop in de keten bestond, blokkeert de aanroep niet: die heeft de aanroeper niet gemaakt. Leden
  van een verwijderde ploeg verliezen hun `parentId`. `unitOfMeasure` geldt alleen voor MATERIAL, zoals in het paneel.
- Verandert de capaciteit (`maxUnits`, `availabilitySteps`, `calendarId`, of toewijzingen die meegingen met een
  verwijdering) terwijl er nivelleeruitvoer op de taken staat, dan waarschuwt het antwoord. Die uitvoer blijft staan
  en de herberekening rekent haar door op de nieuwe capaciteit. Of er nivellering op staat, beslist dezelfde
  `hasLevelingOutput` als achter Nivellering wissen.
