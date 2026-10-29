# Utjevning av ressurser

Du har én murer og to vegger som må bygges samme dager. På papiret fungerer tidsplanen, men i praksis kan han bare være ett sted. Utjevning er måten appen løser slike kollisjoner på: den får aktiviteter til å starte senere, til ressursen klarer det. I denne artikkelen leser du nøyaktig hva utjevning flytter, når sluttdatoen gir etter, og hva den ikke løser for deg.

## Begrepet

En ressurs har **overallokering** på en arbeidsdag hvis tidsplanen krever mer av den den dagen enn den kan levere. Det ressursen kan levere, er kapasiteten: *Maksimalt antall* på arbeidsdagene i kalenderen. Hvis den ikke arbeider den dagen ifølge kalenderen, er kapasiteten 0.

**Utjevning** løser det ved å la aktiviteter starte senere. Den gjør ikke mer enn det. Den forkorter ikke en aktivitet, deler den ikke, endrer ikke tildelingsenheter eller avhengigheter, og legger ikke til en ekstra ressurs. For hver aktivitet leter appen etter den første plassen der ressursene er ledige, og flytter aktiviteten dit.

Det finnes to måter i vinduet *Utjevning av ressurser*:

- Som standard kan prosjektets sluttdato flytte seg. Det er utjevning i egentlig forstand.
- Med avmerkingsboksen *Kun utjevning innen slakk (smoothing) — prosjektets sluttdato forblir fast* flytter appen bare aktiviteter innen slakken. Sluttdatoen blir da stående. Hvis det ikke fungerer, blir aktiviteten stående der den er, og appen melder en konflikt. Hva slakk er, leser du i [Kritisk linje og slakk](docs://uitleg-kritiek-pad).

## Slik beregner appen

### Hvor mye en aktivitet krever

Per arbeidsdag teller appen hvor mange tildelingsenheter hver aktivitet krever av en ressurs. Det er tildelingsenhetene etter kurven eller din egen fordeling av timene, akkurat de samme timene per dag som histogrammet viser. Kapasiteten til ressursen er *Maksimalt antall*, eller verdien for trinnet i den tidsfaserte kapasiteten som gjelder den dagen. En dag har overallokering hvis behovet er større enn kapasiteten.

### I hvilken rekkefølge

Appen plasserer aktivitetene én for én, i denne rekkefølgen: først den høyeste prioriteten, deretter aktiviteten med minst totalslakk, deretter den tidligste starten, og til slutt rekkefølgen i aktivitetstabellen. En aktivitet kommer først opp når forgjengerne har fått sin plass.

Prioriteten er et tall fra 0 til 1000 som du setter per aktivitet. Standard er 500. I høyreklikkmenyen til en aktivitetsstolpe heter den *Prioritet*, med valgene *Lav* (100), *Normal* (500) og *Høy* (900). En aktivitet som kommer tidligere opp, får plassen den vil ha. De aktivitetene som kommer etterpå, må passe rundt den. Slik bepaler prioriteten hvilken aktivitet som beholder plassen, og hvilken som må vike. Verdien 1000 er spesiell: en slik aktivitet flytter seg aldri på grunn av kapasitet. Det er MS Project-varianten «Do Not Level».

### Hvor en aktivitet flytter seg til

For hver aktivitet starter appen på den tidligste starten avhengighetene tillater. Det tar hensyn til at forgjengere allerede kan ha flyttet seg selv. Passer aktiviteten der, blir den stående. Passer den ikke, prøver appen neste arbeidsdag for aktiviteten, og så videre. En aktivitet passer hvis ressursene har nok ledig kapasitet på hver dag i aktiviteten. Har en aktivitet flere ressurser, må alle være ledige de dagene. Derfor flytter en aktivitet seg alltid senere, aldri tidligere.

Appen registrerer flyttingen som en **utjevningsforsinkelse**: et antall arbeidsdager, i aktivitetens kalender, som aktiviteten starter senere enn avhengighetene krever. Du ser den i kolonnen *Utjevningsforsinkelse* under *Beregnet*. Forsinkelsen lagres sammen med prosjektfilen. *Beregn* (F5) tar den med som ekstra ventetid før starten. Aktiviteter som kommer etter, flytter seg med via avhengighetene.

### Innenfor slakk eller utover

Uten avmerkingsboksen *Kun utjevning innen slakk (smoothing) — prosjektets sluttdato forblir fast* leter appen til aktiviteten passer. Derfor kan sluttdatoen for prosjektet flytte seg.

Med avmerkingsboksen *Kun utjevning innen slakk (smoothing) — prosjektets sluttdato forblir fast* kan en aktivitet ikke starte senere enn sin seneste start. Det er den siste dagen den kunne starte uten at sluttdatoen flytter seg. Passer aktiviteten ikke i dette vinduet, blir den stående på sitt tidligste sted. Aktiviteten vises da under *Gjenstående konflikter*.

### Hva appen ikke flytter

- Aktiviteter som allerede har startet eller er ferdige. Deres belastning teller med, men de får aldri en utjevningsforsinkelse.
- Aktiviteter med prioritet 1000. De følger sine forgjengere, men flytter seg ikke på grunn av kapasitet.
- Aktiviteter uten tilordning til de valgte ressursene, milepæler og faser. De flytter seg bare hvis en forgjenger flytter seg.
- Materiale. Det utjevnes aldri.

### Forslag og bruk

*Beregn* lager et forslag: aktivitetene som flytter seg, med gammel og ny start, og sluttdatoen før og etter. Ingenting i tidsplanen endres før du velger *Bruk*. Da skriver appen forsinkelsene til aktivitetene og omberegner tidsplanen med en gang.

## Eksempel: murer på to vegger

Eksemplet er øvingsprosjektet *House extension* i opplæringen, slik det er like før utjevningen i opplæring 5. I opplæring 5 gjør du dette selv og kontrollerer tallene. I dette eksemplet har pussarbeidet aktivitetstypen *Fast arbeid*, og pusseren arbeider med tildelingsenheter på 2, som i [Aktivitetstyper: varighet, enheter og arbeid](docs://uitleg-werkregels).

Etter hulldekket, som er ferdig mandag 28. juni, starter både det innvendige murbladet (5 arbeidsdager) og det utvendige murbladet (6 arbeidsdager) tirsdag 29. juni. Begge er tildelt murer, med tildelingsenheter på 1 og *Maksimalt antall* på 1. Etter det innvendige murbladet kommer takelementene (en kranjobb på 6 timer) og takleggingen (2 arbeidsdager). Vindusrammene venter på takleggingen og på det utvendige murbladet. Overleveringen er mandag 30. august.

### Overallokeringen

Det innvendige murbladet går fra 29. juni til og med 5. juli, det utvendige fra 29. juni til og med 6. juli. Fra 29. juni til og med 5. juli, altså 5 arbeidsdager, krever tidsplanen 2 tildelingsenheter av en murer med kapasitet 1. Mureren har overallokering de 5 dagene.

### Rekkefølgen

Begge aktivitetene har prioritet 500. Vindusrammene leveres først 14. juli (i opplæring 3 setter du en begrensning, *Start ikke tidligere enn (SNET)*, for det). Derfor har det innvendige murbladet 3 arbeidsdager slakk, og det utvendige 5. Det innvendige har minst slakk, så det kommer først. Det står fra 29. juni til og med 5. juli.

### Flyttingen

Det utvendige murbladet kan ikke starte 29. juni. Den første dagen da mureren er ledig igjen, er tirsdag 6. juli. Det er 5 arbeidsdager etter tidligste start, så utjevningsforsinkelsen er 5. Det utvendige murbladet går nå fra 6. juli til og med 13. juli. Vindusrammene starter uansett først 14. juli, så overleveringen er fortsatt mandag 30. august. Vinduet viser *Prosjektets sluttdato: uendret (30-08-2027)* og én linje: *Build outer cavity leaf*, gammel start 29-06-2027, ny start 06-07-2027, *5 d*.

De 5 arbeidsdagene som aktiviteten flytter, er nøyaktig slakken til det utvendige murbladet. Derfor gir *utjevning* samme resultat her. Det utvendige murbladet har nå ingen slakk igjen og er kritisk.

### Hva om vindusrammene ikke kommer 14. juli

Uten den begrensningen kan vindusrammene starte fredag 9. juli, og overleveringen er onsdag 25. august. Det utvendige murbladet har da bare 2 arbeidsdager slakk.

- Uten *utjevning* flytter det utvendige murbladet fortsatt 5 arbeidsdager. Nå må vindusrammene vente: de starter 14. juli, 3 arbeidsdager senere. Alt etter dem flytter seg med, og overleveringen går fra 25. august til 30. august, også 3 arbeidsdager senere.
- Med *utjevning* flytter ingenting seg. Det utvendige murbladet passer ikke innenfor de 2 arbeidsdagene med slakk. Vinduet viser konflikten *Build outer cavity leaf*, 5 dag(er), med årsaken *For lite ledig kapasitet innen slakken til å løse denne konflikten.*

### Hva om det utvendige murbladet får prioritet

Hvis du gir det utvendige murbladet prioriteten *Høy* (900), kommer det først. Det står da på 29. juni, og nå må det innvendige murbladet vike: 6 arbeidsdager senere, fra 7. juli til og med 13. juli. Det innvendige har bare 3 arbeidsdager slakk, så 6 arbeidsdager er 3 for mye. Takelementene, vindusrammene og alt etter dem flytter med. Overleveringen går fra mandag 30. august til torsdag 2. september. Samme overallokering gir altså en annen sluttdato, avhengig av hvilken aktivitet som beholder plassen.

### Hva om en andre murer kommer til

Setter du *Maksimalt antall* for mureren til 2, er det ingen overallokering lenger. *Beregn* melder *Ingen aktiviteter må flyttes — tidsplanen er allerede konfliktfri.*

## Konsekvenser og misforståelser

**«Utjevning finner den korteste tidsplanen.»** Nei. Appen arbeider aktivitet for aktivitet i en fast rekkefølge. Den leter ikke etter den beste løsningen totalt sett. Se eksemplet med prioriteten: en annen prioritet gir en annen sluttdato.

**«En utjevnet aktivitet er trygg.»** Utjevning bruker slakk. Den forskjøvne aktiviteten har da mindre slakk, eller ingen igjen, og kan bli kritisk, slik det utvendige murbladet gjorde ovenfor. Blir den da forsinket, flytter overleveringen seg.

**«Utjevning følger endringer jeg gjør senere.»** Nei. Forsinkelsen er et fast antall arbeidsdager. Blir det innvendige murbladet kortere etter utjevningen, starter det utvendige fortsatt 5 arbeidsdager senere, selv om det ikke lenger er nødvendig. Utjevn da på nytt. Appen begynner da fra null.

**Ikke alt kan løses ved å flytte.** Hvis ressursen ikke arbeider på dagene aktiviteten trenger, eller kurven for aktiviteten krever mer på én dag enn ressursen kan levere, består overallokeringen. Appen sier da hvorfor ved aktiviteten.

**Materiale utjevnes ikke.** Krever materiale mer enn kapasiteten en dag, melder appen det som overallokering. Utjevning lar det likevel være.

**Låste aktiviteter.** Hvis alle aktiviteter som kolliderer har prioritet 1000, melder vinduet *Ingen aktiviteter må flyttes — tidsplanen er allerede konfliktfri*, mens overallokeringen består. Se derfor etter meldingen *Overallokering* i båndet etter at du har brukt forslaget.

## Se også

- [Løse overallokering](docs://howto-overbezetting-oplossen): stegene for å finne overallokering og utjevne den.
- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): hva slakk er, og hvorfor en aktivitet blir kritisk.
- [Aktivitetstyper: varighet, enheter og arbeid](docs://uitleg-werkregels): hvordan varigheten til en aktivitet beveger seg med tildelingsenhetene.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): tre tårn som trenger de samme mannskapene og tårnkranen, og hva utjevning gjør med det.
