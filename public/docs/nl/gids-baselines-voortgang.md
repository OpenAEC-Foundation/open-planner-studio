# Baselines & voortgang

Een planning die je nooit bijwerkt, is een voorspelling. Zodra het werk begint, wil je twee dingen tegelijk kunnen zien: wat er oorspronkelijk was afgesproken, en wat er nu werkelijk gebeurt. Een **baseline** bevriest de eerste; **voortgang** en de **statusdatum** houden de tweede bij. Deze gids laat zien hoe je een baseline vastlegt en beheert, hoe je afwijkingen (variantie) zichtbaar maakt, hoe je voortgang invoert, en wat de statusdatum precies met je planning doet.

## Wat je hier leert

- Een baseline vastleggen en beheren, en welke baseline actief is.
- Variantie zien: de baseline-overlay in de Gantt en het variantierapport.
- Voortgang invoeren — percentage, werkelijke datums — via het paneel, de taakdialoog en het contextmenu.
- De statusdatum: wat hij doet met niet-gestarte taken en met niet-afgemelde mijlpalen.
- Out-of-sequence-meldingen: wat ze betekenen en hoe je ze oplost.
- De voortgangslijn lezen.

Volg mee met [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (één baseline vóór start, plus voortgang en een statusdatum halverwege het project) en met [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (twee baselines — een contractbaseline en een herbaseline na meerwerk — met eigen voortgang en statusdatum).

## Een baseline vastleggen en beheren

Open het venster **Baselines** via de lintgroep **Baselines & voortgang** op het tabblad **Planning**: de knop **Baseline opslaan…** slaat direct een nieuwe baseline op met een voorgestelde naam ("Baseline 1 — [datum]"), **Baselines beheren…** opent hetzelfde venster om te bekijken, hernoemen of verwijderen.

In het venster zie je een tabel met elke opgeslagen baseline: een **Actief**-keuzerondje, de **Naam** (direct te bewerken), de datum van **Aangemaakt**, en een verwijderknop. Precies één baseline kan actief zijn — dat is de baseline waartegen de Gantt-overlay en het variantierapport vergelijken. Verwijder je de actieve baseline, dan vraagt het venster om bevestiging (er blijft dan geen actieve baseline over totdat je er zelf een andere kiest of een nieuwe opslaat). Is de planning verouderd sinds de laatste berekening, dan toont het venster bij "Nieuwe baseline opslaan" een hint om eerst te herberekenen (F5) — een baseline die je vastlegt op een verouderde planning zou immers de verkeerde datums bevriezen.

Een baseline is een momentopname: start, finish en (bij mijlpalen) de datum van elke taak op het moment van opslaan. Wijzig je daarna de planning verder, dan blijft de baseline ongewijzigd totdat je zelf een nieuwe opslaat.

## Variantie zien

### In de Gantt: de baseline-overlay

Zet de overlay aan via **Beeld → lintgroep Baselines & voortgang → Baseline-overlay**. Onder elke taakbalk verschijnt een dunne onderbalk (of een ruit bij een mijlpaal) in de baseline-kleur, op de oorspronkelijke baseline-datums. Loopt de hoofdbalk voorbij zijn onderbalk uit, dan zie je in één oogopslag hoeveel een taak is uitgelopen ten opzichte van de baseline — zonder een apart rapport te hoeven openen.

### Als rapport: het variantierapport

Ga naar het tabblad **Rapport**, kies bij **Rapporttype** voor **Variance**. Het rapport toont per taak: **Baseline start**, **Baseline einde**, **Huidige start**, **Huidig einde**, **Δ start (wd)**, **Δ einde (wd)** en een **Status** (**Op schema**, **Later**, **Eerder**, **Nieuw** voor taken die na de baseline zijn toegevoegd, of **Vervallen** voor taken die sindsdien zijn verwijderd). Bovenaan telt het rapport het totaal aantal taken, hoeveel er later en hoeveel er eerder zijn, en — als de projecteinddatum is verschoven — een regel met het aantal werkdagen verschil ten opzichte van de baseline. Is er geen actieve baseline, dan meldt het rapport dat expliciet in plaats van een lege tabel te tonen.

## Voortgang invoeren

Voortgang zet je op drie plekken, elk met hetzelfde effect:

1. **Eigenschappenpaneel** — de sectie **Voortgang** onder een geselecteerde taak: een schuifregelaar voor het **percentage voltooid**, en (voor een gewone taak) velden **Werkelijke start**/**Werkelijke einde**, of (voor een mijlpaal) één veld **Werkelijke datum**. Zet je het percentage boven 0% zonder een werkelijke startdatum, dan wordt die automatisch gevuld met de geplande vroegste start; zet je het terug naar onder 100%, dan vervalt een eerder ingevulde werkelijke einddatum weer.
2. **Taakdialoog** — dezelfde sectie **Voortgang**, in het venster **Taak bewerken**.
3. **Contextmenu** — rechtsklik een taak, submenu **Voortgang**, met de vaste stappen **0%**, **25%**, **50%**, **75%** en **100%**. Handig voor een snelle update zonder een paneel te hoeven openen; voor een percentage ertussenin of een specifieke werkelijke datum gebruik je het paneel of de taakdialoog.

Werkelijke datums kunnen nooit ná de statusdatum liggen — vul je toch een latere datum in, dan wijst de app dat af met een foutmelding. Dat is een bewuste grens: een "feit" (wat er echt is gebeurd) kan per definitie niet in de toekomst liggen ten opzichte van het moment waarop je de planning bijwerkt.

## De statusdatum

De **statusdatum** (lintgroep **Baselines & voortgang** op het tabblad Planning, veld **Statusdatum**) markeert "vandaag" binnen de planning — het moment waarop je de voortgang hebt vastgelegd. Zodra hij gezet is, doet hij twee dingen tegelijk:

- Elke taak of mijlpaal die nog niet is gestart (0% voltooid, geen werkelijke start) kan niet vroeger beginnen dan de statusdatum, ook al zou de logica (voorgangers, relaties) een eerdere start toestaan. Zijn berekende vroegste start wordt op de statusdatum "gevloerd".
- Taken die al wél zijn gestart of afgerond, houden hun werkelijke datums — die worden nooit door de statusdatum overschreven.

Dit is precies zichtbaar in de middelgrote showcase: met de statusdatum op 20 mei 2027 hebben meerdere nog-niet-gestarte taken (bijvoorbeeld het metselwerk en het loodgieterswerk van verschillende woningen) hun vroegste start exact op die datum staan, ook al lopen ze in verschillende woningen en zouden ze zonder de statusdatum-vloer op uiteenlopende, eerdere data zijn begonnen.

### Waarom een niet-afgemelde mijlpaal "naar rechts schuift"

Een mijlpaal is in de berekening niets anders dan een taak zonder duur, dus dezelfde regel geldt: is hij nog niet afgemeld (geen 100%, geen werkelijke datum), dan kan zijn berekende datum niet vóór de statusdatum liggen. Zet je de statusdatum steeds verder op zonder de mijlpaal af te melden, dan schuift zijn getoonde datum in de Gantt steeds mee naar rechts, ook al is er aan de onderliggende taken niets veranderd — de planning zegt in feite: "dit moment kan niet in het verleden liggen als je het nog niet hebt afgevinkt". Zodra je de mijlpaal wél afmeldt met een werkelijke datum, valt hij weer terug op die vaste datum en stopt hij met meeschuiven.

## Out-of-sequence-meldingen

Zodra er een statusdatum is, controleert de berekening ook of de vastgelegde feiten (werkelijke start-/einddatums) niet in tegenspraak zijn met de logica van de relaties — bijvoorbeeld een opvolger die al is gestart terwijl zijn voorganger volgens de planning nog niet klaar had moeten zijn. Zulke gevallen heten **out-of-sequence** en verschijnen als waarschuwing in de statusbalk onderin het scherm ("N out-of-sequence-relatie(s)"), met een tooltip voor het aantal. Het is een waarschuwing, geen blokkerende fout — de berekening gaat gewoon door.

Los een out-of-sequence-melding op door de werkelijke situatie kloppend te registreren: vul de ontbrekende of onjuiste werkelijke start-/einddatum in op de betrokken taken (via het paneel, de taakdialoog of het contextmenu, zoals hierboven), zodat de vastgelegde feiten weer overeenkomen met wat er logisch aan vooraf moet zijn gegaan. Vaak betekent dit gewoon: een taak die in werkelijkheid al is afgerond, was in de planning nog niet als zodanig gemarkeerd.

## De voortgangslijn

Zet de voortgangslijn aan via **Beeld → lintgroep Baselines & voortgang → Voortgangslijn**. Deze tekent een oranje, gestreepte lijn (4/4-streepjes, zelfde stijl als de statusdatumlijn) die voor elke taak een punt tekent op de plek die overeenkomt met zijn percentage voltooid, en dat verbindt met de statusdatum — het klassieke zaagtand-patroon. Een uitstulping naar links van de statusdatum betekent dat een taak achterloopt op wat je op basis van de tijd zou verwachten; een uitstulping naar rechts betekent dat hij voorloopt. De voortgangslijn tekent de statusdatum-verticaal zelf al mee als ruggengraat van de zaagtand, dus de losse **Statusdatumlijn**-schakelaar (zelfde lintgroep) treedt terug zolang de voortgangslijn aan staat — die is alleen zichtbaar als je de voortgangslijn uitzet en toch de statusdatum als rechte lijn wilt zien.

## Verder lezen

- Zie een baseline vóór start en voortgang halverwege in de praktijk: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Zie twee baselines (Contract → Herbaseline na meerwerk) in de praktijk: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Resources en hun belasting worden ook herberekend bij elke F5 — lees de gids [Resources, histogram & nivellering](docs://gids-resources-histogram) voor overallocatie en nivellering.
- Voortgang en een statusdatum kunnen negatieve speling opleveren op een taak die al vaststaat — lees de gids [Kritiek pad & geavanceerde analyse](docs://gids-kritiek-pad-analyse) voor hoe je dat leest.
