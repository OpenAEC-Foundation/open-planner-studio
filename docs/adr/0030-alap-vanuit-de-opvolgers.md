# Een ALAP-taak schuift zo laat als haar opvolgers toestaan, opvolgers eerst

Een taak met ALAP (zo laat mogelijk) krijgt na de achterwaartse pass nul vrije speling: haar vroege datums schuiven
op tot haar opvolgers. De solver loopt daarvoor in omgekeerde topologische volgorde, in elk profiel. In voorwaartse
volgorde mat een ALAP-voorganger haar speling tegen een nog niet verschoven ALAP-opvolger, zodat van een keten
A, B, einde alleen B laat kwam; MS Project en P6 zetten de hele keten laat. Na de verschuiving krijgen de uitgaande
relaties hun nieuwe grens, zodat vrije speling en driving kloppen (de relatie wordt precies bindend).

## Gevolgen

- Een niet-gestarte taak (geen hammock) krijgt als vroege finish de laatste grens die haar opvolgers met hun vroege
  datums via de achterwaartse relatiewiskunde toestaan (zonder opvolger haar late finish), nooit later dan haar eigen
  late finish (deadline, constraints, projecteinde) en op een eindmoment van haar eigen kalender. Haar vroege start
  is die finish min haar opgeslagen duur in de maat van het profiel, zodat het venster precies die duur houdt, ook
  over een korte werkdag. Ze schuift alleen later.
- De terugrekening is niet overal de exacte inverse van de voorwaartse (knownbug 345). Zou de nieuwe plek een
  opvolger toch later laten beginnen, dan zoekt een halvering in werkminuten de laatste plek die dat niet doet. Dat
  mag omdat later schuiven nooit minder van een opvolger vraagt: de uitvoerbare plekken vormen één aaneengesloten
  stuk vanaf het vroege einde.
- Een gestarte of voltooide taak en een hammock houden de stap in hele werkdagen van de opvolgerkalender, begin en
  einde even ver: hun venster is geen opgeslagen duur, en de voltooide P6-gevallen zijn op die stap geijkt. De
  grenzen daarvan staan in knownbug 361.
- C14 (`p6AlapPositionedFromSuccessors`, niet-gestarte taak op een kalender met eigen werkblokken) gebruikt dezelfde
  laatste grens, in dezelfde omgekeerde doorloop, zodat een gewone ALAP-voorganger al tegen de verschoven C14-taak
  meet. Ondergrens zijn de grenzen van haar voorgangers en de statusdatum, niet haar eigen geplande start (A16) of
  anker; een C14-wortel heeft de statusdatum als vroege start. Een secundaire constraint blijft gelden: SNLT en FNLT
  als bovengrens, SNET en FNET als ondergrens, en bij een botsing wint de ondergrens. Opvolgers bewegen niet.
