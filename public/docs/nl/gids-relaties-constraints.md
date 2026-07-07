# Relaties & constraints

Taken die los van elkaar staan, verschuiven niet mee als de planning verandert. Relaties leggen die afhankelijkheid vast; constraints leggen een harde of zachte randvoorwaarde op een datum vast. Deze gids gaat dieper in op beide dan de gids [Snel starten](docs://quick-start): wanneer kies je welk relatietype, wat doet een lag/lead precies, wat betekent een harde pin en wanneer moet je die júist niet gebruiken, en hoe verhoudt een deadline zich tot een constraint?

## Wat je hier leert

- De vier relatietypes (FS/SS/FF/SF) en wanneer je welke gebruikt.
- Lag en lead, inclusief procentuele lag en doorlooptijd-lag (bijvoorbeeld voor uitharding van beton).
- Relaties leggen op drie manieren: slepen, selectie, en de relatietabel.
- Alle acht constraint-types, plus de harde pin (P6 Mandatory) en de secundaire constraint.
- Het verschil tussen een deadline en een constraint.

Volg mee met de instap-showcase [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) (SNET-vergunning, SS-overlap, FF-koppeling) en, voor het deadline-conflict, met [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).

## De vier relatietypes

Elke relatie heeft een **Voorganger** en een **Opvolger**, en een van vier types:

- **FS — Finish-Start**: de opvolger start pas nadat de voorganger klaar is. Dit is verreweg de meest voorkomende relatie in de bouw: eerst de fundering, dán de ruwbouw. Gebruik FS als de ene taak fysiek pas kan beginnen zodra de andere af is.
- **SS — Start-Start**: beide taken starten (ongeveer) gelijktijdig. Gebruik dit als twee taken samen kunnen oplopen zodra de eerste op gang is — bijvoorbeeld wandwerk en dakconstructie die overlappend starten zodra de ruwbouw vordert, zonder dat de een pas begint als de ander klaar is.
- **FF — Finish-Finish**: beide taken eindigen (ongeveer) gelijktijdig. Handig wanneer twee taken onafhankelijk kunnen lopen, maar wél gelijk moeten worden afgerond — bijvoorbeeld schilderwerk dat vlak na het tegelwerk moet eindigen, zodat de ruimte in één keer opgeleverd kan worden.
- **SF — Start-Finish**: de voorganger moet starten voordat de opvolger mag eindigen. Dit is in de bouwpraktijk verreweg het minst voorkomende type — bewaar het voor uitzonderingsgevallen waarin een aflopende taak pas mag stoppen zodra een andere taak is opgestart (bijvoorbeeld bij ploegenoverdracht).

Herken je deze drie eerste types graag in een echt voorbeeld? De showcase "Verbouwing & Aanbouw Eengezinswoning" bevat een FS-keten tussen de hoofdfasen, een SS-overlap tussen wand- en dakwerk, en een FF-koppeling tussen tegel- en schilderwerk.

## Lag en lead

Een relatie hoeft niet op nul te staan: een **lag** (positief) voegt wachttijd toe tussen voorganger en opvolger, een **lead** (negatief, uitgedrukt als een negatief getal) laat de opvolger juist eerder beginnen — een bewuste overlap. Het lag-veld (**Lag**, in het eigenschappenpaneel en in de relatietabel) accepteert een korte notatie:

- `2d` — 2 werkdagen lag (de standaard-eenheid: dagen op de projectkalender).
- `3ed` — 3 **doorlooptijd**-dagen (elapsed days): kalenderdagen die ook in het weekend of op feestdagen doorlopen. Dit is de eenheid die je wilt voor bijvoorbeeld het **uitharden van beton**: het beton hardt ook op zaterdag en zondag uit, dus een lag van "3 werkdagen" zou de uithardingstijd onderschatten als er een weekend tussen valt. Zet in dat geval de lag op elapsed-eenheid.
- `50%` — een procentuele lag: 50% van de duur van de vóórganger, herberekend bij elke CPM-run als de duur van de voorganger verandert (dezelfde logica als MS Project). Handig als de wachttijd van nature meeschaalt met de omvang van de voorgaande taak.
- `-25e%` — een negatieve, procentuele doorlooptijd-lag: een lead van 25% van de duur van de voorganger, in doorlooptijd-dagen.

Een negatief getal (lead) betekent dat de opvolger al start terwijl de voorganger nog loopt — bijvoorbeeld tegelwerk dat al start op de laatste dagen van het stukadoorswerk in dezelfde ruimte.

## Relaties leggen

Er zijn drie manieren om een relatie aan te maken, afhankelijk van waar je toch al aan het werk bent:

1. **Slepen in het Gantt-diagram**: houd **Shift** ingedrukt en sleep van de balk van de voorganger naar de balk van de opvolger. Zodra je loslaat, ontstaat direct een FS-relatie met lag 0, en verschijnt meteen het venster **Type relatie** — daarin pas je het type (FS/SS/FF/SF) en de lag aan zonder het eigenschappenpaneel te hoeven openen.
2. **Selectie + knop**: selecteer eerst de voorganger, houd Ctrl/Cmd ingedrukt en selecteer daarna de opvolger (in die volgorde), en klik op **Nieuwe relatie uit selectie** (lintgroep **Relaties** op het tabblad **Planning**, of het tabblad **Relaties** zelf). Deze knop werkt alleen als er precies twee taken geselecteerd zijn.
3. **Rechtstreeks in de relatietabel**: open het tabblad **Relaties** (via **Beheer** in de lintgroep Relaties). De tabel toont per relatie de kolommen **Voorganger**, **Type**, **Lag**, **Opvolger**, **Bepalend** en **Vrije speling** — type en lag zijn hier direct te bewerken, ook voor relaties die je eerder via slepen of selectie hebt aangemaakt.

De kolom **Bepalend** (driving) laat na een berekening zien welke relatie daadwerkelijk de start- of einddatum van de opvolger bepaalt — bij een taak met meerdere voorgangers is dat niet per se de relatie die je het laatst hebt aangemaakt, maar degene met de laatste (bepalende) datum.

## Constraint-types

Een constraint legt een datumgrens op een taak, los van zijn relaties. Open Planner Studio kent acht types, in te stellen via het veld **Constraint** in het eigenschappenpaneel:

- **Zo vroeg mogelijk (ASAP)** — geen datumgrens, de standaardinstelling.
- **Zo laat mogelijk (ALAP)** — de taak schuift zo ver mogelijk op binnen zijn speling.
- **Start niet eerder dan (SNET)** — een ondergrens op de startdatum (bijvoorbeeld: niet eerder starten dan de vergunning binnen is).
- **Start niet later dan (SNLT)** — een bovengrens op de startdatum.
- **Eindig niet eerder dan (FNET)** — een ondergrens op de einddatum.
- **Eindig niet later dan (FNLT)** — een bovengrens op de einddatum.
- **Moet starten op (MSO)** — een vaste startdatum.
- **Moet eindigen op (MFO)** — een vaste einddatum.

SNET/SNLT/FNET/FNLT zijn allemaal **zachte grenzen**: de CPM-berekening houdt er rekening mee, maar een overtreding leidt "alleen" tot negatieve speling, niet tot een crash of blokkade. De showcase "Verbouwing & Aanbouw Eengezinswoning" gebruikt bijvoorbeeld een SNET-constraint om een taak niet eerder te laten starten dan de vergunning binnen is.

### De harde pin (P6 Mandatory)

MSO en MFO kunnen bovendien **hard** gemaakt worden via het vinkje **Verplicht (pin logica)**, dat alleen verschijnt bij deze twee types. Dit is de "P6 Mandatory"-constraint uit Primavera P6: de balk wordt op de datum vastgezet, ook als zijn voorgangers dat logisch tegenspreken. Bij het aanzetten van een harde pin toont Open Planner Studio eenmalig een waarschuwing: **een harde pin overschrijft de relaties — de balk wordt op de datum vastgezet, ook vóór z'n voorgangers. Overtreding wordt negatieve speling stroomopwaarts.**

Gebruik een harde pin dus alleen wanneer een datum werkelijk niet onderhandelbaar is en losstaat van de logica van de planning — bijvoorbeeld een wettelijk vastgelegde opleverdatum die vaststaat ongeacht voortgang. Gebruik hem **niet** als vuistregel voor "ik wil dat deze taak op die datum staat": in dat geval is een zachte constraint (SNET/FNLT/etc.) of gewoon een goed geplande keten van relaties vrijwel altijd de betere keuze. Een harde pin kan het hele netwerk stroomopwaarts knellen: als de voorgaande taken door de pin heen willen lopen, ontstaat er negatieve speling die zich door de hele keten vóór de gepinde taak voortplant — een teken dat de planning conflicteert, niet dat de pin het probleem oplost.

### Secundaire constraint

Bij een niet-harde constraint (dus geen ASAP/ALAP en geen harde MSO/MFO) kun je een **secundaire constraint** toevoegen: een tweede grens uit dezelfde vier zachte types (SNET/FNET/SNLT/FNLT), die niet dezelfde zijde mag begrenzen als de primaire. Zo kun je bijvoorbeeld tegelijk een ondergrens én een bovengrens op de startdatum zetten. Open Planner Studio valideert de combinatie live en toont een foutmelding zodra de combinatie ongeldig is — bijvoorbeeld een secundaire constraint naast een harde pin, wat niet is toegestaan.

## Deadlines versus constraints

Een **deadline** (los veld, eigenschappenpaneel) lijkt op een constraint maar is bewust anders: het is een zachte, informatieve bovengrens op de einddatum die in het Gantt-diagram als een pijl-omlaag-markering wordt getoond — groen zolang de taak er nog op tijd is, rood zodra de vroegste finish er voorbij loopt. Een deadline dwingt de planning niet af (in tegenstelling tot een MFO/FNLT-constraint, die actief in de berekening zit), maar telt wél mee als bovengrens bij het berekenen van speling: haalt de planning van nature de deadline niet, dan levert dat **negatieve speling** op zonder dat er een constraint in het spel is.

Dat is precies wat er gebeurt in de showcase [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): die bevat een bewust te krappe contractdeadline die de natuurlijke doorlooptijd van de planning niet haalt, met zichtbare negatieve speling tot gevolg — een goed voorbeeld om te bekijken als je wilt zien hoe een deadline-conflict er in de praktijk uitziet, zonder dat er iets "kapot" is: de planning rekent gewoon door en toont waar het schuurt.

Vuistregel: gebruik een **deadline** voor een streefdatum die je wilt bewaken zonder de logica van de planning te forceren, en gebruik een **constraint** (zacht of, bij uitzondering, hard) wanneer een datum daadwerkelijk een randvoorwaarde is waar de berekening mee moet rekenen.

## Verder lezen

- Zie SNET, SS-overlap en FF-koppeling in de praktijk: [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).
- Zie het deadline-conflict in de praktijk: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Structuur nog niet op orde? Lees eerst de gids [Plannen & WBS](docs://gids-plannen-wbs).
- Voor kalenders en werktijden die de duur van taken beïnvloeden: de gids [Kalenders & uren-planning](docs://gids-kalenders-uren).
