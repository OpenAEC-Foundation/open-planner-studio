# Nivelleren: wie schuift, wie volgt en wat vaste last is

Een vertraging is alleen zinvol op een taak die de solver er ook mee verschuift. `levelResources` deelt daarom elke
taak met vraag op de gekozen resources in voordat hij plaatst; de indeling staat in de lus die `fixedLoadIds`,
`pinnedIds` en `movableIds` vult. Vaste last zijn de taken buiten de scope, met `preserveExistingLeveling` alle taken,
en de onverplaatsbare taken (`isImmovableTask`). Vaste last boekt haar vraag vóór de lus op haar vroege start uit de
eigen basis (ADR 0160), krijgt geen vertraging en gaat niet door de kandidatenscan. Voor de onverplaatsbare taken is
de reden de solver: een handmatige taak plant hij op haar eigen datums en een voltooide op haar werkelijke datums
(`forwardPass`), dus een vertraging verplaatst die niet. Kreeg een voltooide taak toch een vertraging, dan kwam het
conflict na de volgende berekening terug zonder dat `unresolved` het meldde (`check-leveler-splits.ts`, geval 12).
Een lopende taak is al gestart; hoe de solver haar rest plant, staat in de tak `isPinnedInProgress` van
`forwardPass`.

Vaste last is geen vaste datum. Ze boekt op haar positie in de basis, maar haar datums in het voorstel komen uit de
proefsolve, die de relaties volgt (ADR 0160).

Een taak met prioriteit 1000 volgt haar voorgangers maar scant niet voor capaciteit, zoals *Do Not Level* in MS
Project: ze boekt op haar eerste kandidaat vanaf de vroegste start volgens de relaties op de werkkopie
(`nextCandidateFor`), niet op haar oorspronkelijke vroege start, die na het verschuiven van een voorganger niet meer
klopt. Wat de planner hiervan ziet, staat in de gids `howto-overbezetting-oplossen.md`.

## Gevolgen

- De scope (`scopeTaskIds`) is er voor de verdeler van de resourcebibliotheek, die per poolitem nivelleert. Een taak
  buiten de scope houdt haar eigen vertraging en gaten, zodat een bibliotheekconflict niet wordt opgelost door het hele
  document opnieuw te nivelleren. De basis en de vroegste start van haar opvolgers rekenen met die behouden
  vertraging (`check-leveler-scope.ts`, geval 2).
- `preserveExistingLeveling` zet de verdeler (`computeDistribution` in `src/services/library/distribute.ts`) voor
  een document waarin elke taak van de scope vastgepind is: het schrijfplan slaat dat document over, dus de
  capaciteitstoets moet dezelfde vertragingen en gaten zien als de bezetting na toepassen.
- Na de lus kijkt `levelResources` de pins en de vaste last binnen de scope na op hun boekingsmoment, omdat een vaste
  taak zonder alternatief boekt: ook de eerst geboekte pin moet het conflict met een later geboekte pin terugkrijgen.
  Welke toets bij welke taak hoort, staat in die lus. Zo'n conflict krijgt geen reden in `unresolvedReasons`: de taak
  is niet verplaatst, dus er is geen scanreden.

- Schuift vaste last buiten de scope mee met een gewijzigde planning, dan controleert het voorstel ook haar
  berekende plaatsing op plaatselijke overbezetting. Die controle gebruikt dezelfde belastingberekening als
  het histogram na toepassen en meldt de dagen waarop de meeschuivende taak aan de overbezetting bijdraagt (#1162).
