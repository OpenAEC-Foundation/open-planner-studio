# Sådan virker AI-forbindelsen

Hvad sker der egentlig, når en AI-assistent arbejder i din tidsplan? I denne artikel læser du, hvad forbindelsen er, og hvorfor den er anderledes end at udveksle en fil. Du læser også, hvilke grænser appen selv vogter over, og hvordan assistenten får at vide, hvordan en tidsplan skal opbygges. Eksemplet til sidst viser med tal, hvad en assistent kan udrette på én gang, og hvad du får tilbage.

## Begrebet

En AI-assistent, fx et chatprogram eller en programmeringsassistent, kan styre et andet program via **Model Context Protocol** (MCP). I den udveksling er Open Planner Studio serveren. Desktopappen kører en lille server på din egen computer, **broen**. Assistenten forbinder sig med broen og får en liste med **værktøjer**: funktioner med et navn, der begynder med `planner_`, fx at læse opgaver, tilføje en afhængighed eller gemme en oprindelig plan. Hvilke værktøjer der findes, står i [AI-værktøjer](docs://ref-ai-tools).

Det bemærkelsesværdige er, at assistenten arbejder i det projekt, du har åbent lige nu, og ikke i en kopi. Du eksporterer intet, du importerer intet, og der er aldrig et øjeblik, hvor du og assistenten ser på to forskellige versioner. En opgave, som assistenten tilføjer, vises med det samme i Gantt-diagrammet. Appen er ikke naiv på det punkt: assistenten arbejder med den samme beregning, den samme fortrydelseshistorik og de samme regler som du.

Hvordan du slår forbindelsen til, står i [Forbind en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen). Nedenfor læser du, hvordan den virker.

## Sådan håndterer appen det

### En server, som kun din egen computer kan høre

Broen lytter kun på din egen computer (`127.0.0.1`), på én port, som standard 3877. Den accepterer kun forespørgsler på adressen `/mcp`, og kun med dit **token** i headeren `Authorization: Bearer`. Den afviser en forespørgsel uden det rigtige token. En forespørgsel, der kommer fra en browser, som broen genkender på `Origin`-headeren, afvises også. Så kan en webside, du tilfældigvis har åben, ikke tale med din tidsplan. Broen behandler forespørgsler strikt én ad gangen.

Forbindelsen er almindelig HTTP på din egen computer. Appen selv sender intet ud. Hvad en assistent gør med den tidsplan den læser, fx hvad dens udbyder gør med den, ligger hos assistenten og ligger uden for appen.

### Assistenten arbejder på ét dokument

Ved dens første ændring binder broen forbindelsen til det dokument, der er aktivt på det tidspunkt. Skifter du selv faner bagefter, afviser appen assistentens næste ændring (kode `DOC_DRIFT`), indtil den bekræfter med `planner_switch_document`, hvilket dokument den vil arbejde i. Så havner intet i det forkerte projekt. En assistent, der selv åbner eller dupliker et dokument, arbejder bagefter i det nye dokument.

### Hver ændring genberegner

I appen laver du selv tidsplanen: du ændrer noget og trykker derefter på *Beregn* (F5), medmindre *Beregn automatisk* er slået til. Det gælder ikke for en ændring fra assistenten. Hver skrivehandling fra assistenten går gennem én transaktion. Ændrer den projektdata, genberegner appen selv til sidst, én gang pr. script. Et læseværktøj giver altid aktuelle datoer. Er tidsplanen forældet, fx fordi du selv har ændret noget og endnu ikke har trykket på *Beregn*, så genberegner læseværktøjet først. Der er én undtagelse: står projektet i visningen *Datoer som de er gemt* (efter en import), genberegner et læseværktøj ikke uden videre, for det ville erstatte disse datoer. Assistenten får så de gemte datoer med en besked om, at de ikke er genberegnet. En ændring, som assistenten selv foretager, genberegner altid, også da. Efter en ændring fra assistenten behøver du ikke trykke på *Beregn*. Assistenten læser resultatet tilbage med læseværktøjerne, fx projektets slutdato og den kritiske vej. Se også [Datoer som de er gemt](docs://uitleg-datums-zoals-opgeslagen).

### Et script er ét trin

En assistent kan indsende en række trin som ét hele med `planner_batch`, et script på højst 100 trin. Det giver dig ét fortrydelsestrin, én genberegning og én backup. Mislykkes ét trin strukturelt, fx et ukendt værktøj eller en cirkulær reference, ruller appen hele scriptet tilbage. Du får aldrig en halvfærdig tidsplan. En afvisning af ét element i et bulktrin, fx én ugyldig fremdriftsindtastning ud af tyve, er mildere: elementet springes over, og resten udføres. Afvisningerne står øverst i svaret.

### Dine grænser

Du stiller fire ting selv i fanen *AI*:

- *Pausér* og *Skrivebeskyttet* holder assistenten forbundet, men afviser alle ændringer. Læsning er stadig mulig, også genberegning af en forældet tidsplan under læsning. Det er beregnede felter, ikke projektdata, så der tilføjes intet fortrydelsestrin, og projektet tæller ikke som ændret. Er du selv midt i en redigering, fx ved at trække en bjælke eller skrive i et felt, genberegner et læseværktøj ikke. Assistenten får så datoerne fra før din redigering, med en besked om at de er forældede.
- En åben dialog blokerer alt. Er der fx en opgavedialog, indstillingerne, præsentationstilstand eller velkomstvinduet åbent, så afviser appen også læsning, fordi du er midt i en manuel handling. Assistenten får fejlkoden `DIALOG_OPEN`. Beskeden nævner det interne navn på det, der er åbent, fx `showTaskDialog` for opgavedialogen.
- *Automatisk backup* skriver en IFC-kopi før den første ændring pr. dokument. Lykkes den backup ikke, udfører appen ikke ændringen.
- Panelet *Handlingspanel* viser hvert kald med argumenter og svar.

Dertil kommer den almindelige funktion *Fortryd* (Ctrl+Z). Assistenten deler den historik med dig og har selv `planner_undo` og `planner_redo`.

### Hvad assistenten ikke kan

Broen er bevidst smallere end appen. Det, assistenten ikke kan, har som regel én af tre grunde.

**Den rækker længere end projektet.** En assistent kan ikke ændre biblioteket. Et bibliotek deles af alle dine projekter og ligger uden for fortrydelseshistorikken; én ændring af standardsatsen ville så få virkning i projekter, der slet ikke er åbne. For en ressource fra et bibliotek er navn, type, beskrivelse, standardsats pr. time og enhed faste, ligesom i ressourcepanelet. Det projektet bestemmer, ligger hos assistenten: maksimalt antal enheder, tilgængelighed over tid, kalender og mandskab. Den kan heller ikke vælge, hvilken kalender der er projektkalender. Den kan læse beregningsprofilen og beregningsindstillingerne, men ikke ændre dem; den kan kun sætte fremdriftsmetoden og projektets standard for opgavetypen. Der findes ingen værktøjer til indstillinger, tema, sprog, udvidelser eller opdateringer.

**Det kan ikke kontrolleres pålideligt.** En assistent kan ikke oprette en hængekøje, sætte datoerne for en opgave manuelt, sætte en ekstra begrænsning, udfylde noter, farver, opgavekoder, brugerdefinerede felter eller eksterne afhængigheder, og den kan ikke sætte en udjævningsforskydning manuelt. Den vælger heller ikke en WBS-kode; appen udleder den selv.

**Det rører ved noget, du selv skal beslutte.** Den registrerer kun fremdrift, hvis der er en statusdato. Den vælger selv ikke datoen: den er din referencedato. Hvis en opgave, der ikke er startet, har en planlagt start efter statusdatoen, skal assistenten angive den faktiske startdato. Den læser og skriver kun filer i din brugermappe, og den overskriver kun en eksisterende fil, hvis den udtrykkeligt beder om det. En eksport er ikke det samme som *Gem*: projektet forbliver ugemt i appen.

### Hvordan assistenten ved, hvordan en tidsplan opbygges

En assistent, der kender værktøjerne, kan stadig opbygge en tidsplan, som ingen erfaren projektleder har nytte af: opgaver uden afhængigheder, en fast dato på hver opgave eller en opdeling, der er alt for fin. Derfor giver appen de tre ting.

**De centrale regler i håndtrykket.** Når der oprettes forbindelse, sender broen en kort tekst i feltet `instructions` i MCP-håndtrykket. Mange klienter lægger den tekst i deres systemprompt; om din gør, afhænger af klienten. Reglerne: start ved milepælene og leveringsdatoen, lav opgaver på cirka en dag til to uger, styr tidsplanen med afhængigheder i stedet for faste datoer, brug begrænsninger kun til hårde eksterne datoer, ret først en mislykket beregning, brug `planner_batch` for en sammenhængende række, registrer fremdrift kun med din statusdato og de faktiske datoer, du selv oplyser, og sig til sidst, hvad du antog, og hvad du bevidst lod være.

**Vejledningen til assistenter.** Værktøjet `planner_get_planning_guide` returnerer en vejledning, der er skrevet særligt til assistenter. Den følger de samme principper som [Sådan laver du en god tidsplan](docs://gids-goed-plannen), men en assistent arbejder anderledes end du: den trykker ikke på F5 og klikker ikke i båndet, den kalder værktøjer, og appen genberegner for den. Vejledningen nævner derfor for hvert princip, hvilke værktøjer assistenten bruger til det, og forklarer, hvad assistenten gør med *Datoer som de er gemt* eller en mislykket beregning. Vejledningen er på engelsk, ligesom alt, assistenten læser via forbindelsen. Værktøjet accepterer stadig et sprogvalg for ældre assistenter, men det ændrer ikke teksten. Du kan selv læse den på `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Forbindelsesprompten i vinduet *Forbindelsesoplysninger* beder assistenten om at læse vejledningen først. Værktøjet virker også, mens en dialog er åben, mens det er sat på pause, og i skrivebeskyttet tilstand, fordi det ikke læser din tidsplan.

**To skills.** En skill er en lille fil med instruktioner, som en assistent læser med i hver session. Der er to, fordi det er to slags arbejde. Opsætning af en tidsplan handler om logik; opdatering af fremdrift handler om fakta, som kun du kender. Skillen *goed-plannen* bruges til at opsætte eller omstrukturere en tidsplan: rækkefølgen af værktøjerne, genberegningsreglen, `planner_batch` og pligten til at melde antagelser. Skillen *progress-update* bruges til den ugentlige fremdriftsopdatering: først din statusdato, dernæst de faktiske start- og slutdatoer og % færdigt, og bagefter en rapport over afvigelsen fra den oprindelige plan, den kritiske vej og den nye slutdato. Principperne for en god tidsplan står selv i vejledningen. Begge skills er på engelsk. Værktøjet returnerer begge, med angivelse af hvor de hører hjemme. Hvordan du installerer dem, står i [Forbind en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen).

## Et eksempel

Du beder en assistent: byg en tilbygning med foundation, brickwork og roof, i den rækkefølge. Dit projekt begynder mandag den 2. marts 2026. Assistenten læser først vejledningen og indsender derefter ét script:

1. projektstartdatoen den 2. marts 2026;
2. tre opgaver: Foundation på 5 arbejdsdage, Brickwork på 10 og Roof på 4;
3. to afhængigheder af typen slut til start: Foundation til Brickwork, Brickwork til Roof.

Appen udfører de tre trin og genberegner. Læser assistenten bagefter tilbage, ser den: projektets slutdato torsdag den 26. marts 2026, projektets varighed 19 arbejdsdage og alle tre opgaver kritiske. Det stemmer med summen: 5 + 10 + 4 er 19 arbejdsdage, og 19 arbejdsdage efter mandag den 2. marts ender på torsdag den 26. marts. Hele scriptet er ét trin i din fortrydelseshistorik. Ét klik på *Fortryd* fjerner de tre opgaver, de to afhængigheder og den nye projektstartdato.

Nu et hvad-hvis-scenarie. Så beder du assistenten om at opdatere fremdriften, og den sætter dertil statusdatoen til mandag den 16. marts. En statusdato er ikke bare en etiket: arbejde, der ikke er startet, må ikke ligge før den dato og rykkes hen til den. Uden én eneste linje fremdrift løber hele tidsplanen derfor med: Foundation løber fra 16. til 20. marts, Brickwork fra 23. marts til 7. april og Roof fra 8. til 13. april. Projektets slutdato springer fra 26. marts til 13. april. Tidsplanen rykker to arbejdsuger frem, og kalenderen i dette eksempel, *Bouwkalender NL*, har langfredag (3. april) og påsken (5. og 6. april). Disse to fridage i ugedagene skubber slutdatoen to dage længere. Derfor sætter assistenten kun statusdatoen efter din anmodning, og kun når der er reel fremdrift at registrere.

## Konsekvenser for din tidsplan og almindelige misforståelser

**Assistenten har ingen egen kopi.** Det den ændrer, ændrer dit projekt. Med *Automatisk backup* slået til har du en IFC-backup før dens første ændring. Med *Skrivebeskyttet* kan den analysere uden at ændre noget.

**Et nyt token bryder alle forbindelser.** Tokenet er broens adgangskode. Et nyt token gør det gamle ugyldigt, også på en kørende bro, og assistenten skal have det nye.

**At assistenten siger, at det virkede, er ikke bevis.** Panelet *Handlingspanel* viser, hvilket værktøj den faktisk kaldte, og hvad der kom tilbage. En afvisning nævner næsten altid det felt, der var forkert, og den vej, der virker.

**Assistenten kan ikke køre et hvad-hvis-scenarie med fortryd.** Den deler fortrydelseshistorikken med dig, så til varianter dupliker den dokumentet med `planner_duplicate_document`. Kopien er løsrevet, har ingen filsti og vises som ugemt. Assistenten lukker ikke varianter; det bestemmer du.

**En eksport fra assistenten er ikke det samme som at gemme.** Den skriver en IFC-fil til en sti, den selv vælger, inde i din brugermappe, og den overskriver kun en eksisterende fil, hvis den udtrykkeligt beder om det. Dit projekt forbliver ugemt i appen og beholder sit eget gemmemål. Importerer den en fil, åbnes den i en ny fane eller i en tom, uændret fane.

## Se også

- [Forbind en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen): stapperne til at starte broen, forbinde en assistent og installere skillen.
- [AI-værktøjer](docs://ref-ai-tools): alle værktøjer pr. gruppe, hvad de afviser, og hvor længe backups bevares.
- [Sådan laver du en god tidsplan](docs://gids-goed-plannen): principperne for en god tidsplan; assistenten får dem i en engelsk version med værktøjerne tilføjet.
- [Fremdrift, statusdato og oprindelig plan](docs://uitleg-voortgang): hvad statusdatoen gør ved din tidsplan.
