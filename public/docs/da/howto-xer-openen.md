# Sådan åbner du en Primavera P6-fil (.xer)

Mål: åbn en tidsplan fra Primavera P6 direkte i appen, uden først at eksportere den til XML.

## Når du har brug for dette

En bygherre eller hovedentreprenør arbejder i Primavera og leverer sin tidsplan som en `.xer`-fil. Du vil se den, beregne den eller tilføje noget til den. Appen læser kun `.xer`-filer: den skriver ikke `.xer` og ændrer aldrig din fil. Fra filen tager den WBS-strukturen og opgaverne med varighed, datoer, begrænsninger og fremdrift, afhængighederne med forsinkelse, kalenderne og ressourcerne med deres tildelinger, samt opgavekoder, brugerdefinerede felter (UDF'er), noter og P6's tidsplanindstillinger. En opgave af typen *Level of Effort* bliver til en hængekøje.

## Trin

1. Vælg *Start › Fil › Åbn* eller tryk på Ctrl+O. Vælg `.xer`-filen.
2. Appen åbner én fane for hvert projekt, der har opgaver. Projektet med flest opgaver er den aktive fane. En fane hedder *Projektnavn (projekt-ID)*, hvis P6-projekt-ID'et er forskelligt fra navnet. *Projektindstillinger* viser kun navnet. Hvis du omdøber projektet, står projekt-ID'et stadig efter det. Et vindue forklarer derefter kort, hvad appen har overtaget fra filen, og hvordan gemning fungerer; se [Åbn og gem en fil](docs://howto-bestand-openen-en-opslaan).
3. Læs meddelelsen nederst. For en fil med tre projekter kan den se sådan ud: *XER-fil åbnet: 3 projektdokumenter.* Under den står linjer, der forklarer, hvad appen gjorde. Se overskriften nedenfor.
4. Kontrollér, om der vises en linje under båndet: *Du ser tidsplanen, som Primavera gemte den; ved at genberegne forskydes 1 opgave.* Primavera gemmer sine egne beregnede datoer i filen. Hvis appens beregning afviger fra dem, viser appen Primaveras datoer, så længe du ikke ændrer noget. En opgave, der er startet eller færdig, ligger altid på sine faktiske datoer, ligesom i Primavera. Hvad det betyder, og hvordan du skifter til appens egen beregning, står i [Datoer som Primavera gemte](docs://uitleg-datums-zoals-opgeslagen). Meddelelsen *Denne fil indeholder timeplanlægning.* kan også vises, med knappen *Slå timeplanlægning til*. Se [Sådan slår du timeplanlægning til](docs://howto-urenplanning-aanzetten).
5. Gem dit projekt med Ctrl+S. Fordi en `.xer`-fil aldrig overskrives, spørger appen, hvor den nye IFC-fil skal gemmes. Den foreslår *Projektnavn (projekt-ID)* som filnavn.

### Linjerne under meddelelsen

Den første linje i meddelelsen angiver, hvor mange faner der er åbnet. Under den står kun de linjer, der gælder. Disse kræver din opmærksomhed:

- *Dit projekt beregnes som Primavera P6. Ændr det via Fil → Projektinfo → Beregningsprofil og beregningsindstillinger.* Appen beregner dette projekt med Primaveras beregningsregler. Med *Åbn beregningsprofil* går du til indstillingen.
- *1 projekt med oprindelig plan udeladt.* og *1 oprindelig plan materialiseret.* Hvis et projekt i P6 udpeger et andet projekt som sin oprindelige plan, åbnes det andet projekt ikke som en fane for sig selv. Det bliver den aktive oprindelige plan for projektet, der henviser til det.
- *Der blev brugt en beskyttende reserve for den oprindelige plan.* Hvis udpegning af oprindelige planer ville betyde, at ingen projekter åbnes, hvis et projekt henviser til sig selv, eller hvis projekter henviser til hinanden i en løkke, åbner appen simpelthen alle projekter og laver ingen oprindelige planer.
- *1 ekstern afhængighed bevaret.* En afhængighed mellem to projekter. Appen gemmer den som kildedata, men gør den ikke til en afhængighed i din tidsplan.
- *12 opgaver viser datoerne, som Primavera gemte dem (ikke genberegnet).* Antallet af opgaver, som visningen *Datoer som Primavera gemte* viser Primaveras datoer for: alle opgaver, filen har gemt datoer for, ikke kun dem der afviger.

De øvrige linjer er diagnostik af selve indlæsningen. De kræver intet af dig:

- antallet af fundne projekter;
- et tomt projekt, der blev sprunget over;
- en ignoreret, ugyldig henvisning til en oprindelig plan;
- en tekstkodning, der ikke er almindelig UTF-8 (meddelelsen nævner hvilken: ved arabisk, kyrillisk eller græsk tekst vælger appen den matchende Windows-kodeside, ellers Windows-1252);
- opgaver uden planlagt start (de starter på statusdatoen eller på projektstartdatoen fra filen);
- tællere for fund i tabellerne, kalenderne og tallene, for ukendte feltværdier og for P6-planindstillinger, som appen erstattede med et sikkert valg.

*Læs mere* åbner hjælpen om at åbne Primavera-filer.

## Faldgruber, og hvad appen gør så

**Ikke alt bliver til en fane eller en afhængighed.** Et projekt uden opgaver åbnes ikke, et projekt, der bruges som oprindelig plan, åbnes ikke som en fane for sig selv, og en afhængighed mellem to projekter bliver ikke til en afhængighed i din tidsplan. Appen melder det i linjerne under meddelelsen.

**Hver fane er sit eget projekt.** Hvis du gemmer en fane, gemmer IFC-filen også hele den oprindelige `.xer`-fil. Hvis du senere åbner den IFC-fil igen, kender appen stadig Primaveras datoer. Hvis kildearkivet er beskadiget, eller et andet IFC-program har skrevet filen om, melder appen: *XER-kildearkivet i denne fil er ubrugeligt og er udeladt. Selve projektet er fuldt åbnet.* Tidsplanen, beregningsprofilen og alle projektdata er komplette. Der mangler to ting: datoerne, som Primavera gemte dem, og kildeherkomsten til AI og udvidelser. Åbn den oprindelige `.xer`-fil igen for at få arkivet tilbage.

**IFC-filen bliver større.** Fordi IFC-filen indeholder hele den oprindelige `.xer`-fil, er den større end en IFC-fil uden arkiv. Ved en stor `.xer`-fil mærker du det i filstørrelsen og i den tid, gemningen tager. Hvis en `.xer`-fil åbner flere projekter, indeholder hver fane, du gemmer, hele `.xer`-filen, ikke kun sit eget projekt.

**Eksport til CSV, MS Project XML eller P6 XML giver tab af data.** Appen advarer: *Ved eksport til CSV går XER-kildeoplysninger tabt.* Ved IFC går intet tabt.

**En ledig lørdag eller søndag, der ikke står i filen.** Appen kan selv gøre sådan en weekenddag ledig. Dagen hedder så *Kalenderundtagelse (genopbygning af weekend)* i kalenderen. Mønsteret står i [Import- og eksportformater](docs://ref-import-exportformaten).

**Slæk op til projektslutdatoen, uden slutdato.** Hvis filen ikke har en slutdato, slår appen indstillingen *Beregn slæk op til projektslutdatoen* fra. Det tælles med i linjen *N P6-planindstillinger brugte en sikker reserve.* Detaljer står i [Import- og eksportformater](docs://ref-import-exportformaten).

**Færdige opgaver på statusdatoen.** En færdig opgave kan vises som en smal bjælke på statusdatoen i visningen *Datoer som Primavera gemte*. Det er ikke en fejl i din fil. Forklaringen og den tilhørende konvention står i [Import- og eksportformater](docs://ref-import-exportformaten).

**Tal med komma som decimalskilletegn.** Hvis appen ikke kan fastslå decimalskilletegnet pålideligt, åbner den ikke filen. På den måde åbnes en tidsplan med forkert læste tal aldrig. Bed afsenderen om en ny eksport.

**En fil, appen ikke kan læse.** Du får en fejlmeddelelse med årsagen. Nogle eksempler:

- *Dette er ikke en gyldig eller understøttet XER-fil.*
- *En XER-tabel mangler obligatoriske kolonner.*
- *P6-projektet i denne XER-fil indeholder ingen opgaver.*
- *Decimalnotationen i denne XER-fil kan ikke fastlægges pålideligt.*

Så åbner ingenting. Kontrollér filen i P6, eller bed afsenderen om en ny eksport.

## Se også

- [Filer og formater](docs://uitleg-bestanden): hvorfor en `.xer`-fil kun læses, og hvad en eksport mister.
- [Datoer som Primavera gemte](docs://uitleg-datums-zoals-opgeslagen): visningen af Primaveras egne datoer.
- [Sådan åbner du en MS Project-fil (.mpp)](docs://howto-mpp-openen): det samme for MS Project.
- [Sådan slår du timeplanlægning til](docs://howto-urenplanning-aanzetten): hvis filen indeholder data i timer.
- [Import- og eksportformater](docs://ref-import-exportformaten): for hvert format, hvad der bliver overført, og hvad der ikke bliver.
- [Beregningsprofiler og konventioner](docs://uitleg-rekenprofielen): hvorfor en P6-fil åbnes med sin egen beregningsprofil.
