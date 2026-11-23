# Nivelleren: wie schuift, wie volgt en wat vaste last is

Een vertraging is alleen zinvol op een taak die de solver er ook mee verschuift. `levelResources` deelt daarom elke
taak met vraag op de gekozen resources in voordat hij plaatst. Een taak buiten de scope, en met
`preserveExistingLeveling` elke taak, is vaste last. Een onverplaatsbare taak (`isImmovableTask`: handmatig gepland,
voltooid volgens `isPinnedComplete` of lopend volgens `isPinnedInProgress`) is ook vaste last. Een taak met
prioriteit 1000 is vastgepind; de rest mag schuiven. Vaste last boekt vóór de lus op haar vroege start uit de
eigen basis (ADR 0160), krijgt nooit een vertraging en gaat niet door de kandidatenscan. De solver plant een
handmatige taak op haar eigen datums en een voltooide op haar werkelijke datums (`forwardPass`); een vertraging
verplaatst die niet. Kreeg een voltooide taak toch een vertraging, dan kwam het conflict na de
volgende berekening terug zonder dat `unresolved` het meldde (`check-leveler-splits.ts`, geval 12). Een lopende taak is al
gestart: de solver plant haar rest vanaf de statusdatum, of zonder statusdatum vanaf haar werkelijke start (de tak
`isPinnedInProgress` in `forwardPass`).

Een vastgepinde taak volgt wel haar voorgangers, zoals *Do Not Level* in MS Project: ze boekt op haar vroegste start
volgens de relaties op de werkkopie, gesnapt op de taakkalender (`nextCandidateFor`), en scant niet voor capaciteit.
Ze boekt dus niet op haar oorspronkelijke vroege start, die na het verschuiven van een voorganger niet meer
klopt. Wat de planner hiervan ziet, staat in de gids `howto-overbezetting-oplossen.md`.

## Gevolgen

- De scope (`scopeTaskIds`) is er voor de verdeler van de resourcebibliotheek, die per poolitem nivelleert. Taken
  die niets met dat poolitem te maken hebben, blijven staan; anders loste een bibliotheekconflict zich op door het
  hele document te herschikken. Een taak buiten de scope houdt haar vertraging en gaten in de werkkopie; de eigen basis en
  de vroegste start van haar opvolgers rekenen daarom met haar genivelleerde positie (`check-leveler-scope.ts`,
  geval 2).
- `preserveExistingLeveling` zet de verdeler (`computeDistribution` in `src/services/library/distribute.ts`) voor
  een document waarin elke taak van de scope vastgepind is: het schrijfplan slaat dat document over, dus de
  capaciteitstoets moet dezelfde vertragingen en gaten zien als de bezetting na toepassen.
- Na de lus kijkt `levelResources` de vastgepinde taken en de vaste last binnen de scope na op hun boekingsmoment,
  zonder een tweede boeking: een vaste taak boekt zonder alternatief, dus ook de eerst geboekte pin moet het
  conflict met een later geboekte pin terugkrijgen. Bij een pin, een handmatige taak en met
  `preserveExistingLeveling` toetst die controle de projectcapaciteit en het poolgrootboek; bij de overige vaste
  last binnen de scope alleen het poolgrootboek. Zo'n conflict krijgt geen reden in `unresolvedReasons`: de taak is
  niet verplaatst, dus er is geen scanreden.
- Een tussenstap zonder vraag en een onverplaatsbare taak zonder vraag doen niet mee als vaste last; ze boeken
  niets.
