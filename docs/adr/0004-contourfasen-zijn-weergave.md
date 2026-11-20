# De contoureditor bewerkt fasen, de opslag blijft een periode per aaneengesloten stuk van een werkdag

Een planner denkt in fasen: twee weken een halve ploeg, daarna de volle ploeg. De editor toont daarom fasen, reeksen
werkdagen met één inzet. Een fase van tien dagen zou als één periode kunnen worden opgeslagen, maar dat doen we niet:
de opslag blijft per werkdag, zodat de uitwisseling met MSPDI, P6 en IFC en de belasting niet veranderen. De schrijver
neemt aaneensluitende stukken van één dag samen tot één periode (twee werkblokken rond de pauze); een onderbreking
midden op de dag geeft twee periodes, met het gat ertussen.
Fasen zijn alleen weergave en komen bij het openen terug door opeenvolgende dagen met dezelfde inzet samen te nemen
(tot op een honderdste eenheid, de precisie van het scherm).

## Gevolgen

- Een dag op 0 uur is geen onderbreking en verschuift geen datum. De contour verdeelt uren binnen de duur die er al
  was; wie een onderbreking wil, bewerkt de taak. Naar buiten reist de 0-dag wel mee: MS Project en onze
  MSPDI-lezer (`splitGapsFromContours`) lezen een dag waarop geen enkele toewijzing werkt als split.
- De laatste fase heeft geen eigen lengte: het totaal aantal dagen is de duur van de taak. Een grens verschuiven
  wisselt dagen uit met de rechterbuur.
- De dialoog bewerkt inzet per werkdag op dezelfde plaatsing als het histogram. Het werk van een dag is inzet maal
  het deel van de dag maal de werktijd per dag; een uniforme toewijzing is één fase, ook als de taak halverwege een
  dag begint. Een rest van het bronwerk kleiner dan een halve milliseconde telt bij de laatste periode als werk.
- Verricht werk is een feit en blijft bij het toepassen ongewijzigd staan.
- Het bewerkmodel begrenst ongeldige invoer en gooit niet; de dialoog valideert eerder.
