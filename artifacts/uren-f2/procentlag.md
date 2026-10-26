# Exacte procentlag: verantwoording van de voorbeeldensnapshot

De 378 afwijkende waarden van `cbd63b03a` zijn volledig aan B7 gekoppeld. Er is niets ververst zonder die koppeling.
De tegenproef verandert uitsluitend de procentlagberekening terug naar afronding op hele dagen. Die ene wijziging
maakt alle 378 afwijkingen ongedaan. Dezelfde tegenproef op de gerepareerde F2-kern maakt alle resterende 322
afwijkingen ongedaan. Beide tegenproeven eindigen met exit 0 en 0 afwijkingen; de productiecode is daarna met
`cp` hersteld. De echte procentlag blijft exact volgens B7.

De terugrekening herstelt 56 waarden zonder snapshotwijziging. Vooruit starten dagtaken nog steeds midden op
een werkdag. Achteruit behouden zij nu hetzelfde moment binnen hun startdag. Ook moet een hele dag volledig
vóór een opvolgergrens passen. Dit repareert de F2-fouten; het bouwt geen loper van §3.14.

## Telling per oorzaak

De volledige lijst staat in [procentlag-waarden.json](procentlag-waarden.json), met per waarde voorbeeld,
taaksleutel, veld, oude en nieuwe waarde en oorzaak. De groepen overlappen niet: eerst samenvattingen,
dan de late datums en speling van bladtaken, daarna vroege datums van een directe procentlagopvolger,
dan overige vroege doorwerking.

- rechtstreeks procentlag: 4 bij de start, 4 na de reparatie; 0 hersteld zonder verversen.
- doorwerking vooruit: 108 bij de start, 108 na de reparatie; 0 hersteld zonder verversen.
- terugrekening en speling: 202 bij de start, 166 na de reparatie; 36 hersteld zonder verversen.
- samenvatting: 64 bij de start, 44 na de reparatie; 20 hersteld zonder verversen.

Totaal: **378 → 322**, dus **56 hersteld**. De 322 overblijvende waarden komen uit twee voorbeelden:
168 in `08-zorgcentrum-de-linde` en 154 in `18-station-uitbreiding-breda`.

## De zes oorspronkelijke oorzaken

Elke relatie is SS +40%. De eerste vijf regels hebben 8 of 12 dagen voorgangerduur; het laatste voorbeeld 3.

- Brugvervanging N279: 2.1 → 3.1, 8 × 40% = 3,2 d. 10 afwijkende waarden → 0 na de terugrekenfix.
- Zorgcentrum De Linde: 2.1 → 3.1, 12 × 40% = 4,8 d. 178 → 168. De exacte lag start de opvolger een dag eerder dan de oude afgeronde 5 d; dat werkt door in volgende taken, samenvattingen, terugrekening en speling.
- Villa Wassenaar: 2.1 → 3.1, 8 × 40% = 3,2 d. 10 → 0.
- Station Breda: 2.1 → 3.1, 12 × 40% = 4,8 d. 164 → 154, met dezelfde voorwaartse doorwerking als De Linde.
- Woonwijk Almere: 2.1 → 3.1, 8 × 40% = 3,2 d. 10 → 0; de volgende SS-relatie zet ook 3.2 op een tijdstip midden op een dag.
- De Akkers: 6.3 → 6.4, 3 × 40% = 1,2 d. 6 → 0.

## Wat F3 nog verandert

Deze zeven bladtaken beginnen midden op een werkdag. F2 telt hun duur volgens §7.2 nog in hele dagen;
F3 telt het gewerkte deel van de eerste en laatste dag volgens §3.14. Hun einde, de doorwerking op
opvolgers en samenvattingen en hun late datums/speling worden daarom opnieuw gemeten in F3.
Ook wanneer een datumdeel nu gelijk is aan F0, kan het exacte einde straks veranderen.

- `05-brugvervanging-n279 / 3.1 Drive sheet piling`: start 2027-03-17T08:36, F2-einde 2027-03-30T16:00, duur 10 d.
- `08-zorgcentrum-de-linde / 3.1 Ground floor load-bearing structure`: start 2027-03-15T14:24, F2-einde 2027-04-01T16:00, duur 12 d.
- `10-villa-wassenaar / 3.1 Ground floor masonry`: start 2027-03-09T08:36, F2-einde 2027-03-24T16:00, duur 12 d.
- `18-station-uitbreiding-breda / 3.1 Prefab platform edges`: start 2027-03-22T14:24, F2-einde 2027-04-01T16:00, duur 8 d.
- `20-woonwijk-almere / 3.1 Piling block 4 (10 terraced houses)`: start 2027-04-02T08:36, F2-einde 2027-04-13T16:00, duur 8 d.
- `20-woonwijk-almere / 3.2 Piling block 5 (10 semi-detached)`: start 2027-04-07T08:36, F2-einde 2027-04-16T16:00, duur 8 d.
- `showcase-rijwoningen-de-akkers / 6.4 Painting — House 1`: start 2027-06-10T08:36, F2-einde 2027-06-15T16:00, duur 4 d.

De snapshot wordt met de bestaande bijwerkroute gegenereerd. Alleen de 322 aantoonbaar afwijkende waarden
worden overgenomen; de overige waarden houden hun bestaande toets op dagniveau. De toelichting noemt nu
F2 en de B7-oorzaak. De snapshotcontrole moet daarna alle 6.090 waarden exact volgens haar vergelijking halen.

Bronnen: de specificatie van 20 oktober, B7, §6.1, §6.3 en §7.2; besluit van de orkestrator van 23 oktober.
