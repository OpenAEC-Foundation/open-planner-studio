# God planlægning

Hvad gør en tidsplan god? Ikke hvor pænt den ser ud, men om den svarer på det spørgsmål, der er vigtigst, når arbejdet er i gang: Hvis dette bliver forsinket, hvad sker der så med overdragelsen? Denne artikel forklarer principperne bag en pålidelig tidsplan, og hvorfor de vejer så tungt i Open Planner Studio: appen beregner ud fra det, du indtaster, og ikke ud fra andet.

Eksemplerne kommer fra byggeri — konstruktionsarbejde, efterbehandlingsfag, leveringstider, vejrforsinkelse, underleverandører og en kontraktlig overdragelsesdato — men principperne selv er ikke knyttet til byggeri.

## Begrebet

En god tidsplan er ikke et billede af det, du håber på, men en **beregningsmodel**: opgaver med en varighed, forbundet med afhængigheder, i en kalender. Appen beregner datoerne ud fra den model. Når noget ændrer sig, genberegner modellen, og du ser med det samme, hvad det betyder for resten.

En planlægger arbejder i en fast rækkefølge:

1. Målet: milepæle og overdragelsesdato.
2. Opdelingen: faser, arbejdspakker, opgaver.
3. Varigheden af hver opgave.
4. Afhængighederne.
5. Begrænsninger og faste datoer.
6. Kalendere.
7. Ressourcer.
8. Den kritiske vej og slæk.
9. Oprindelig plan og fremdrift.
10. Gennemgang.

Rækkefølgen er ikke en formalitet. Springer du et trin over, viser det sig senere som en overraskelse: opgaver uden afhængigheder flytter sig ikke med, varigheder uden en kalender er forkerte, og en oprindelig plan, du først gemmer bagefter, fastfryser forsinkelsen i stedet for aftalen.

## Sådan beregner appen med den

Hver princip nedenfor hænger sammen med noget, appen gør. Derfor følger denne del samme rækkefølge.

### Start fra målet, ikke fra opgaverne

Skriv først de tidspunkter ned, der er faste, og først derefter det arbejde, der skal passe mellem dem: start på byggepladsforberedelse, endelig tilladelse, vejrtæt, start på færdiggørelse, aflevering. Det er **milepæle**: punkter uden varighed, som du rent faktisk indtaster som en milepæl (*Start › Opgaver › Milepæl ▾*) og ikke som en opgave med nul dage og et navn, der ligner en milepæl.

Hvorfor denne rækkefølge: en tidsplan, der starter fra en liste med opgaver, bliver en sum, og en sum rammer sjældent datoen i kontrakten. Start fra milepælene, så er spørgsmålet straks det rigtige. Ikke "hvor lang tid tager alt dette tilsammen", men "passer arbejdet mellem disse to tidspunkter, og hvis ikke, hvad skal så ændres". Arbejd baglæns fra den krævede afleveringsdato til det senest mulige tidspunkt, hvor bygningen skal være vejrtæt, og derfra til starten.

En aflevering, der er fastlagt i kontrakten, får afkrydsningsfeltet *Obligatorisk (kontraktuel)*. Så ser enhver, der åbner filen, at dette tidspunkt hverken kan forhandles eller ændres. Afkrydsningsfeltet er et markeringsmærke for Gantt og rapporterne. Det beskytter ikke en dato. Det gør du med en deadline eller en begrænsning (se nedenfor).

### Opdelingen: faser, arbejdspakker, opgaver

Under milepælene bygger du strukturen: faser, under dem arbejdspakker, under dem opgaver. Det gør du ved at indrykke. En opgave med underopgaver bliver automatisk en **hovedopgave**: appen udleder dens bjælke og varighed fra opgaverne under den. Indtast derfor aldrig selv en varighed for en hovedopgave.

Tommelfingerreglen for detaljeringsgraden: **en opgave varer cirka én dag til to uger**. Kortere end en dag betyder, at du laver tidsplanen for det daglige arbejde på byggepladsen i stedet for projektet. Det hører til byggelederens ugeplan, ikke til en beregningsmodel, der skal holde i flere måneder. Længere end to uger betyder en opgave, du ikke kan estimere ordentligt og ikke kan følge under udførelsen: "finishing ground floor, 40 days, 45% complete" fortæller ingen, om det går godt. Tidsplangennemgange tæller derfor ofte, hvor mange opgaver der varer længere end omkring to måneder. Ligger det over nogle få procent, tæller det som mangel på detaljering.

For fin detaljering skader lige så meget som for grov. Hver opgave koster vedligeholdelse: afhængigheder at tegne, fremdrift at registrere og en ny vurdering efter hver ændring. En tidsplan med to tusinde opgaver for et seks måneders projekt bliver ikke mere præcis. Den bliver uvedligeholdt, og en tidsplan, som ingen opdaterer, er fiktion inden for tre uger. Vælg det niveau, hvor du ærligt kan vise fremdriften, hver uge.

I praksis: "3. Finishing" er en fase, "Finishing house 4" en arbejdspakke, "Plastering house 4 ground floor" en opgave på fem dage. Du må bevidst overskride den øvre grænse for leveringstider og opsyn. En levering af vinduesrammer på ti uger er virkelig én udelelig blok ventetid, og løbende opsyn hører hjemme i en hængekøje i stedet for i en række kunstige udsnit.

### Estimere varigheden

En varighed er et estimat af, hvor lang tid arbejdet tager, ikke af, hvor hurtigt det kunne gå. Estimer for en normal dag med det hold, du faktisk får, ikke for den bedste dag med det bedste hold. Optimisme akkumuleres langs kæden: en tidsplan, hvor hver opgave forudsætter den bedste dag, rammer næsten aldrig sin afleveringsdato.

Dage eller timer er et reelt valg, ikke formatering. Vælg **dage** til arbejde, der sætter tempoet på byggepladsen, som murerarbejde, pudsning og flisearbejde. Det tager fem dage, uanset om en dag tilfældigvis er otte eller ni timer. Vælg **timer**, når timerne selv er enheden, og resten af dagen betyder noget: en inspektion på tre timer, et støbearbejde på fjorten timer fordelt over to dage, arbejde i arbejdsskift. Appen gemmer valget pr. opgave. Valget finder du først, når du har aktiveret *Slå timeplanlægning til*; se [Dage og timer](docs://uitleg-dagen-en-uren).

Skjul ikke risiko i de enkelte varigheder. Hvis du lægger en dag til alle steder, skjuler du marginen, så ingen kan se den eller styre den længere. Og der, hvor marginen virkelig var nødvendig, viser den sig at være for lille. Gør sikkerhedsmargenen synlig: en eksplicit buffer-opgave før afleveringsdatoen eller en særskilt vejrmargen. Pas på dobbelttælling. De cirka 180 dage om året, hvor der kan arbejdes, som den hollandske byggebranche regner med, er et årligt tal fastsat i kontrakt (UAV). Fra det tal er offentlige helligdage, byggeferien *og* tabte dage allerede trukket fra. Hvis helligdage og byggeferie allerede står i din projektkalender, er kun tabte dage på grund af vejret tilbage som særskilt post. Tabte dage på grund af frost og storm følger deres egne regler i overenskomsten Onwerkbaar weer Bouw & Infra. Læg de forventede tabte dage i kalenderen eller i en særskilt post, ikke skjult i varigheden af murerarbejdet.

### Afhængigheder: uden et netværk er det ikke en tidsplan

Appen beregner datoerne langs **afhængighederne**: en opgave starter først, når dens foregående opgaver tillader det. En opgave uden afhængigheder er ikke bundet til noget. Hvis den bærende konstruktion glider to uger, følger en løsrevet færdiggørelsesopgave ikke med, og tidsplanen viser noget forkert, uden at noget bliver rødt.

Derfor får hver opgave mindst én foregående opgave og mindst én efterfølgende opgave. Kun den første opgave i projektet og den sidste milepæl er undtaget. Ved en tidsplangennemgang er dette den første kontrol: højst nogle få procent af opgaverne må mangle logik.

**Slut til start er standard**, og det skal blive ved med at være sådan: fundament færdigt, derefter bærende konstruktion. I en sund byggetidsplan er cirka ni ud af ti afhængigheder slut til start. Det er et krav om læsbarhed. Slut til start er den eneste type, alle på byggepladsen forstår uden forklaring, og den opfører sig forudsigeligt under udførelsen.

**Start til start med en forsinkelse** er til arbejde, der virkelig løber parallelt i stedet for at vente. Det klassiske eksempel er rækkehuse eller et tårn med etager: installatøren følger tre dage efter murerarbejdet. Det er en start til start med en forsinkelse på tre dage, ikke en slut til start på en kunstigt opdelt opgave. Sæt en slut til slut ved siden af, ellers kan den efterfølgende opgave i teorien blive færdig før den foregående. I byggeri bruger du næsten aldrig start til slut.

Tegn helst den start til start mellem opgaver, ikke mellem faser. Hvis den foregående opgave i en start til start eller start til slut er en fase, lader appen den efterfølgende opgave vente på den opgave i fasen, der starter **sidst**, ikke den første. Så sætter den aldrig datoen for tidligt, men nogle gange senere end du mente. Ved slut til start og slut til slut, når den foregående opgave er en fase, venter den efterfølgende opgave på, at den sidste opgave i fasen er færdig. Det er normalt præcis det, du mener.

Vær sparsom med forsinkelser, og især med forskud. En forsinkelse er ventetid uden synlig grund: ingen kan senere se, hvorfor der er gået syv dage imellem. Hvis det er betonhærdning, gør det til en forsinkelse i kalenderdage (beton hærder også i weekenden). Eller endnu bedre: en egentlig opgave "hærdning", som alle kan se og følge. Et forskud, altså en overlapning, bør egentlig slet ikke være der. Ved en tidsplangennemgang er normen nul. Hvis du vil have overlapning, så del den foregående opgave, eller brug en start til start.

### Begrænsninger og faste datoer: så få som muligt

Alle opgaver starter med "så tidligt som muligt", og i langt de fleste tilfælde skal det blive sådan. En **begrænsning** er en datogrænse ved siden af afhængighederne. Jo flere du tilføjer, jo mindre beregner din tidsplan, og jo mere bliver den en tegning. En tidsplan fuld af faste datoer ser stabil ud, og netop derfor skjuler den risikoen. Den bevæger sig ikke længere, så den advarer heller ikke længere.

Brug kun en begrænsning for en hård, ekstern dato, som tidsplanen selv ikke kan påvirke. Det kan være tilladelsen, der ikke er endelig før 1. marts (*Start ikke tidligere end (SNET)*), det lukningsvindue kommunen har givet, eller forsyningsselskabets tilslutningsdato. "Jeg vil have denne opgave i maj" er ikke et eksternt faktum. Det løser du med logik eller en anden varighed. Som tommelfingerregel har højst nogle få procent af de resterende opgaver en hård datogrænse.

Skriv aldrig en startdato for at få en opgave på plads. For en opgave med en foregående opgave gør appen en indtastet (eller trukket) start til begrænsningen *Start ikke tidligere end (SNET)*. Opgaven står så, hvor du vil have den, og bliver der, også når hele kæden før den bliver forsinket.

Hvis du vil holde øje med en dato uden at styre beregningen, så brug en **deadline**. Den ændrer intet, men den giver negativ slæk og en advarsel, så snart opgaven ikke længere holder den. Præcis det signal vil du se. Brug en hård fastlåsning (*Obligatorisk (pin-logik)*) til det ekstreme tilfælde, men vid, at den giver negativ slæk i kæden før den. Det er tidsplanen, der siger, at det ikke passer, ikke at noget er i stykker.

### Kalendere: først projektet, dernæst undtagelserne

Alle varigheder tæller i arbejdsdage eller arbejdstimer i en kalender. Opsæt derfor projektkalenderen ordentligt, før du indtaster varigheder: arbejdsdage, arbejdstider, offentlige helligdage og byggeferien. En kalender, du retter halvvejs, forskyder hele din tidsplan. Tilføj de kendte lukninger med det samme: frostperioden, hvor du ikke støber beton, og virksomhedens nedlukning mellem jul og nytår.

Giv kun en ressource sin egen kalender, hvis den virkelig er anderledes. Det gælder for facadebyggeren, der kommer fire dage om ugen, eller holdet, der har sommerfri på et andet tidspunkt. En ressourcekalender ændrer ikke en eneste dato for en opgave. Den fortsætter med at køre på opgavens eller projektets kalender. Den viser kun, at ressourcen ikke arbejder på en af opgavens arbejdsdage, og det ses som overallokering i histogrammet. Den forskel er svær at gennemskue, hvis du ikke ved, at du selv har oprettet den.

### Ressourcer: hvem gør det, og er det muligt

En tidsplan uden ressourcer besvarer kun halvdelen af spørgsmålet. Så snart du tildeler hold og udstyr, viser histogrammet det, en tidslinje alene ikke kan: at du den 14. juni har brug for tre pudsehold, mens du har to.

Start med de ressourcer, der er knappe. Ikke hver skrue skal med. Tårnkranen, dine egne hold, underentreprenørerne med et kapacitetsloft og de lange leveringstider skal med. Giv hver ressource en ærlig kapacitet: to pudsere betyder to, ikke "to, men tre i en nødsituation".

Læs histogrammet som et spørgsmål, ikke som en fejl. Rødt over linjen betyder, at tidsplanen kræver mere, end du har den dag. Nogle gange er svaret: flyt. Ofte er svaret: det går ikke, og det var det, jeg ville vide. **Udjævning** flytter opgaver, indtil behovet passer inden for kapaciteten. Hvis slutdatoen kan være fleksibel, så tillad det. Hvis afleveringsdatoen er fast, udjævn kun inden for slæk (afkrydsningsfeltet *Kun udjævning inden for slæk — projektets slutdato forbliver fast*). Slutdatoen bliver så, hvor den er, og du står tilbage med en rapporteret resterende konflikt. Det er et mere ærligt resultat end en tidsplan, der bare ser løst ud.

Udjævn *ikke*, når behovet strukturelt er større end kapaciteten. Udjævning flytter eksisterende arbejde i tid. Den ansætter ikke ekstra pudsere og bygger ikke en ekstra kran. Tre tårne, der kræver samme hold på samme tid, er stadig tre tårne, der kræver samme hold efter udjævning. Det eneste, der ændrer sig, er, at afleveringen udskydes. Det, der hjælper, er så etapeinddeling, ekstra kapacitet eller andet arbejde. Udjævn heller ikke, før din logik og dine varigheder er på plads. Du ville ellers udjævne en tidsplan, der er anderledes i morgen.

### Kritisk vej og slæk: hvor tidsplanen er sårbar

Appen genberegner ikke ved hver ændring. Beregn med **Beregn** (F5), og læs først derefter. Hvis statuslinjen viser *Forældet — genberegn (F5)*, ser du den forrige beregning, ikke den aktuelle. Med indstillingen *Beregn automatisk* gør appen det selv.

Den **kritiske vej** er kæden uden slæk: hver dag, der går tabt der, udskyder afleveringen med en dag. Dér skal dit opsyn og dine bedste folk hen. Kig ikke kun på rødt. **Samlet slæk** siger, hvor meget en opgave må blive forsinket uden at påvirke afleveringen. **Tilladt slæk** siger, hvor meget den må blive forsinket uden at forskyde dens efterfølgende opgave. Forskellen påvirker ingens slutdato, men den står i vejen for nogen. Den er nyttig, når du arbejder med underentreprenører, du ikke kan omlægge to gange.

Hold øje med tre signaler. En opgave med få dages slæk er ikke en sikker opgave, men en næsten kritisk opgave. Med *Markér næsten kritisk* får sådanne opgaver deres egen farve. En opgave med ekstrem slæk, ved tidsplangennemgange mere end 44 arbejdsdage, omkring to måneder, mangler næsten altid en efterfølgende opgave. Det peger direkte på hullerne i dit netværk. Negativ slæk er aldrig en beregningsfejl. Det er tidsplanen, der siger, at en deadline eller en fast dato ikke passer.

### Opret den oprindelige plan før start, og hold den opdateret

Opret en **oprindelig plan**, så snart tidsplanen er godkendt, og før der sættes en spade i jorden (*Tidsplan › Oprindelige planer & fremdrift › Administrer oprindelige planer…*). Beregn først: den oprindelige plan gemmer datoerne fra den seneste beregning. Uden den reference kan du senere kun sige, *at* tingene går anderledes, ikke hvor meget eller siden hvornår. Netop det har du brug for på et byggemøde, ved ekstraarbejde og når det drøftes, at arbejdet er blevet forsinket.

En oprindelig plan gemmer datoerne, men ikke de antagelser, der ligger bag dem. Netop dem spørger man efter, så snart det drøftes, at arbejdet er blevet forsinket. Skriv derfor, når du opretter den oprindelige plan, kort ned, hvad denne tidsplan bygger på (i planlægningspraksis: *tidsplangrundlaget*). Angiv hvilke produktivitetstal du har brugt, hvilken kalender du har valgt og hvorfor den er sat op sådan, hvad du bevidst har udeladt af tidsplanen, hvem der har leveret de leveringstider du har antaget, og hvem der har godkendt tidsplanen. En halv side er nok.

Derefter er det at holde den opdateret en rytme, ikke et projekt. Opdater hver uge, i samme rækkefølge: sæt **statusdatoen** til rapporteringsdatoen, indtast faktiske start- og slutdatoer for det, der er startet og afsluttet, ret den resterende varighed for det, der kører, og beregn. En procentdel alene er ikke nok. Faktiske datoer er det dokumentationsgrundlag, man senere ser på.

Forstå, hvad statusdatoen gør: arbejde, der endnu ikke er startet, rykkes af appen til statusdatoen, og opgaverne efter den rykker med (undtagen i beregningsprofilen Microsoft Project). Hvis du glemmer at registrere en færdig opgave eller milepæl som færdig, flytter den sig selv til højre. Det er ikke en fejl, men modellen nægter at lade som om, at noget i fortiden stadig kan ske. Får du en advarsel om *Ude af rækkefølge*, er arbejdet udført i en anden rækkefølge, end logikken foreskriver. Det er normalt en grund til at rette rækkefølgen, ikke til at klikke advarslen væk. Opret kun en ny oprindelig plan ved en reel ændring af omfanget, og så ved siden af den første, ikke over den.

Til sidst: en tidsplan er kun pålidelig, hvis de mennesker, der udfører arbejdet, tror på den. Lad byggelederen og underentreprenørerne holde ugeplanen op imod denne model. Hvis du uge efter uge kun når halvdelen af det aftalte, ligger problemet oftere i tidsplanen end i udførelsen.

## Et gennemregnet eksempel: tre valg, der stille og roligt får tidsplanen til at lyve

Tallene kommer fra to eksempler, der er gennemregnet andre steder i Hjælp: øvelsesprojektet *House extension* fra selvstudierne og et lille netværk til en tilbygning. Pointen er, hvad hvert valg gør ved din tidsplan. Du prøver det selv i selvstudium 2 (afhængigheder og den kritiske vej) og selvstudium 3 (en begrænsning og en deadline).

### En glemt afhængighed

I tilbygningen starter arbejdet mandag den 7. juni 2027, og aflevering er fredag den 6. august. *Build outer cavity leaf* (6 arbejdsdage) har *Install window frames* som efterfølgende opgave, fordi rammerne sidder i facaden. Med den afhængighed har den ydre skal 2 arbejdsdage slæk.

Glemmer du den afhængighed, har den ydre skal pludselig 23 arbejdsdage slæk, frem til aflevering. På papiret kan den være flere uger forsinket, uden at nogen står og venter på den. Intet bliver rødt, og der kommer ingen advarsel. Kun med beregningsindstillingen *Opgaver med åben ende er kritiske* bliver en sådan opgave uden efterfølgende opgave kritisk, så hullet bliver synligt.

### En indtastet dato i stedet for en afhængighed

Det lille netværk: *Groundwork* (3 arbejdsdage), *Pour foundation* (2), *Brickwork* (5) og *Roofing* (3), efter hinanden, fra mandag den 7. juni 2027. Projektet er færdigt onsdag den 23. juni.

Hvis du skriver en start på mandag den 21. juni for *Brickwork*, fordi murstenene først kommer da, bliver det til en *Start ikke tidligere end*. Brickwork flyttes en uge, og projektet er færdigt onsdag den 30. juni. *Groundwork* og *Pour foundation* får 5 arbejdsdage slæk og er ikke længere kritiske. Hvis murstenene alligevel kommer tidligere, bliver Brickwork på den 21. juni: nu styrer datoen, ikke logikken.

Skriver du i stedet onsdag den 9. juni, før fundamentet er færdigt, sker der ikke noget: afhængighederne tillader alligevel kun, at Brickwork starter mandag den 14. juni.

### En deadline i stedet for en begrænsning

Vil du have *Roofing* færdig fredag den 18. juni, så sæt en deadline der. Intet flytter sig: Roofing bliver på mandag den 21. til onsdag den 23. juni. Men kæden får −3 arbejdsdage slæk, og appen melder *Deadline 18-06-2027 overskredet. Tidligste slutdato 23-06-2027*. Du ser dermed med det samme, at aftalen ikke passer. I stedet for en bjælke på det rigtige sted, med en kæde bagved, der ikke når målet.

## Konsekvenser og misforståelser

- **Opgaver uden foregående opgave eller efterfølgende opgave.** Det hyppigste og mest skadelige: disse opgaver flytter ikke med, og de får falsk slæk.
- **At skrive datoer eller trække bjælker i stedet for at tegne logikken.** Det sætter stille og roligt en begrænsning.
- **For mange begrænsninger, og en hård fastlåsning brugt som bogmærke.** Tidsplanen beregner så ikke længere, den tegner kun.
- **Opgaver på tre måneder, eller opgaver på en halv dag.** Mellem cirka en dag og to uger er det brugbare område.
- **Optimistiske varigheder, og margen skjult i hver enkelt opgave** i stedet for synlig som buffer.
- **Vejrstop og byggeferien ikke i kalenderen.** De havner alligevel i den i januar.
- **Forsinkelser i stedet for opgaver.** Syv dages ubenævnt ventetid er tre måneder senere uforklarlig.
- **Udjævning før logikken er på plads**, eller fortsat udjævning mod en strukturel kapacitetsmangel.
- **At glemme at beregne.** *Ikke opdateret* i statuslinjen betyder, at du ser den forrige beregning.
- **Ingen oprindelig plan, eller en oprindelig plan der kun gemmes efter start.**
- **Fremdrift registreret kun som procent**, uden faktiske datoer og uden statusdato.
- **At lukke panelet *Advarsler* uden at læse det.** Her samles de overskredne deadlines, overtrådte begrænsninger, afhængigheder i forkert rækkefølge og ressourcer med overallokering (*Planlægning › Tidsplan › Advarsler*).

## Se også

- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): hvordan appen beregner tidlige og seneste datoer og slæk.
- [Afhængigheder og forsinkelse](docs://uitleg-relaties): de fire typer afhængighed, forsinkelse og afhængigheder på en fase.
- [Begrænsninger og deadlines](docs://uitleg-constraints): hvad hver begrænsning og en deadline gør ved beregningen.
- [Kalendere og arbejdsdage](docs://uitleg-kalenders): hvordan appen tæller arbejdsdage, og hvilken kalender der vinder.
- [Dage og timer](docs://uitleg-dagen-en-uren): planlægning i dage, i timer eller blandet.
- [Udjævning af ressourcer](docs://uitleg-nivelleren): hvad udjævning flytter, og hvad den ikke flytter.
- [Fremdrift, statusdato og oprindelig plan](docs://uitleg-voortgang): hvad statusdatoen gør, og hvordan du læser afvigelser.
- [Tilføjelse af opgaver og milepæle](docs://howto-taken-en-mijlpalen-toevoegen): at indtaste milepæle og opgaver.
- [Tilføjelse af afhængigheder](docs://howto-relaties-leggen): at sammenkæde opgaver.
- [Tilslutning af en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen): en assistent, der planlægger efter disse principper.
- [Meddelelser og advarsler](docs://ref-meldingen): alle advarsler samlet ét sted.
