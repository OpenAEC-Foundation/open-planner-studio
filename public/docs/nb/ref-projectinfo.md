# Nytt prosjekt og Prosjektinnstillinger

Feltene i vinduet *Nytt prosjekt* og i *Prosjektinnstillinger*: hva hvert felt gjør, hva standarden er og hvor det virker. De er to sider av samme skjema. *Nytt prosjekt* oppretter et nytt prosjekt og har noen få ekstra felt. *Prosjektinnstillinger* endrer prosjektet du har åpent.

## Åpne

**Nytt prosjekt** — *Fil › Ny*, Ctrl+N, eller plusstegnet til høyre for dokumentfanene (*Start et prosjekt*, deretter *Nytt prosjekt*). Vinduet åpnes med markøren i *Prosjektnavn*.

**Prosjektinnstillinger** — *Innstillinger › Prosjekt › Prosjektinnstillinger* åpner skjemaet som et vindu med tittelen *Prosjektinnstillinger*. *Fil › Prosjektinnstillinger* viser det samme skjemaet på skjermbildet *Fil*. Blokken *Beregningsprofil og beregningsalternativer* står nederst på begge steder. Hva den inneholder, står i [Beregningsalternativer og beregningsregler](docs://ref-rekenopties-en-conventies).

## Opprett, Bruk og avbryt

**Opprett** (i *Nytt prosjekt*) lager prosjektet. Hvis den gjeldende fanen er tom og uendret, bruker appen den fanen. Ellers åpnes prosjektet i en ny fane. **Bruk** (i *Prosjektinnstillinger*) skriver endringene dine til prosjektet.

- **Bare ved Bruk.** Du skriver i et utkast. Prosjektet endres bare når du klikker på *Bruk*. *Bruk* skriver bare det du faktisk har endret, i ett trinn i *Angre*. Klikker du på *Bruk* uten å endre noe, skjer det ingenting, og det legges ikke til et trinn.
- **Avbryt, krysset og Esc** lukker vinduet uten å lagre noe. Et klikk ved siden av vinduet lukker det ikke: det du har skrevet, blir der.
- **Enter** gjør det samme som *Opprett* eller *Bruk*, unntatt i feltet *Beskrivelse* og i en åpen rullegardinmeny.
- **I skjermbildet Fil** viser *Prosjektinnstillinger* *Endringer er ikke tatt i bruk — klikk på Bruk for å beholde dem.* nederst så lenge utkastet ditt er forskjellig. Forlater du skjermbildet etterpå, spør appen om du vil bruke, forkaste eller avbryte endringene. Se [Båndet, fane for fane](docs://ref-lint).
- **En egendefinert beregningsprofil uten navn** blokkerer *Bruk* og *Opprett*. Gi den et navn, eller forkast endringen.

## Felt i begge vinduer

**Prosjektnavn** — navnet på prosjektet i titellinjen, på fanen og i filnavnet når du lagrer. Standard: tom. Et tomt felt er tillatt: prosjektet heter da *Ny tidsplan*, vist med grå tekst i feltet. Hvor: hele skjermbildet.

**Beskrivelse** — fri tekst. Standard: tom. Effekt: lagres med prosjektet, i IFC-filen og i eksporten til Primavera P6 XML, og har ingen innvirkning på tidsplanen.

**Forfatter** — fri tekst. Standard: tom. Effekt: havner i IFC-filen og vises som *Forfatter:* i sidehodet på en rapport, der du ikke kan endre den.

**Ressursbibliotek** — hvilket ressursbibliotek prosjektet er koblet til. Velg mellom *ingen bibliotek (frittstående prosjekt)*, dine eksisterende bibliotek og *+ Legg til nytt ressursbibliotek…*. Standard: i *Nytt prosjekt* standardbiblioteket, i *Prosjektinnstillinger* den gjeldende koblingen. Effekt: se [Bruke ressursbiblioteket](docs://howto-resourcebibliotheek-gebruiken). Med *+ Legg til nytt ressursbibliotek…* skriver du et navn i et felt under. Biblioteket lages først ved *Opprett* eller *Bruk*. Avbryter du, blir det ingenting igjen. En kobling i *Prosjektinnstillinger* endres bare hvis du selv endrer dette feltet.

**Oppdragsgiver/organisasjon** — fri tekst. Standard: tom. Effekt: havner i IFC-filen og vises som *Selskap:* i sidehodet på en rapport.

**Startdato** — prosjektstarten. Standard: i *Nytt prosjekt* i dag. Hva feltet gjør, står nedenfor under *Hva startdatoen gjør*.

**Sluttdato** — den planlagte slutten av prosjektet. Standard: tom. Effekt: en opplysning, ikke et krav. Appen planlegger ikke mot denne datoen. Den vises i sidehodet på en rapport og i eksporten, og den bestemmer til hvilket år helligdagene genereres. Bare for en Primavera-fil med innstillingen *Beregne slakk til prosjektslutt* (se [Beregningsalternativer og beregningsregler](docs://ref-rekenopties-en-conventies)) kjøres slakkberegningen til denne datoen.

**Standardenhet for nye aktiviteter** — er bare synlig når *Slå på timeplanlegging* er på. Velg mellom *Dager* og *Timer*. Standard: *Dager*. Effekt og vilkår: se [Slå på timeplanlegging](docs://howto-urenplanning-aanzetten).

**Beregningsprofil og beregningsalternativer** — i *Prosjektinnstillinger* hele blokken. I *Nytt prosjekt* bare rullegardinlisten *Beregningsprofil* med *Primavera P6*, *Microsoft Project* og *Open Planner Studio*. Standard: *Open Planner Studio*. Når du velger en profil, settes også standardalternativene for den profilen. Se [Beregningsalternativer og beregningsregler](docs://ref-rekenopties-en-conventies).

## Bare i Prosjektinnstillinger

**IFC-schema ved lagring** — hvilket IFC-schema som står i sidehodet på den lagrede filen. Valg mellom *IFC 4.3 ADD2 (standard)*, *IFC 4.3* og *IFC4*. Standard: *IFC 4.3 ADD2 (standard)*. For en åpnet IFC-fil er det schemaet til den filen. Effekt: bare sidehodet i filen endres, ikke innholdet. Bruk det for å slå sammen tidsplanen med en bygningsmodell i samme schema. Har en åpnet fil et annet schema enn standard, spør appen første gang du lagrer om du vil beholde schemaet. Et valg her teller som svaret. Et annet valg her er ikke et trinn i *Angre*: schemaet hører til filen. Se [Velge IFC-schema](docs://howto-ifc-schema-kiezen).

## Bare i vinduet Nytt prosjekt

**Faseringsmal** — hvilke faser prosjektet starter med. Velg mellom *Tom*, *Boligbygging* og *Yrkesbygg / rehabilitering*. Standard: *Tom*. Effekt: *Tom* gir et prosjekt uten aktiviteter. De to andre legger klar åtte faseaktiviteter, hver med en varighet på 5 i prosjektets standardenhet (5 arbeidsdager, eller 5 timer hvis du velger *Timer* under *Standardenhet for nye aktiviteter*). De har ingen avhengigheter. Du gir dem nytt navn, flytter og utvider dem selv. For *Boligbygging* er det: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking og Oplevering. For *Yrkesbygg / rehabilitering*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen og Oplevering. Navnene er data i prosjektet og forblir nederlandske, også i et annet grensesnittspråk. Er *Slå på byggmodus* av, finnes bare *Tom*. Se [Appinnstillinger](docs://ref-instellingen).

**Skift** — bare synlig når *Slå på timeplanlegging* er på. Velg mellom *Dagskift*, *2 skift*, *3 skift* og *24/7*. Standard: *Dagskift*. Effekt: *Dagskift* lar standardkalenderen være som den er: en vanlig dagkalender fra mandag til fredag. De tre andre legger tidsbånd inn i prosjektets kalender, som knappene med samme navn i vinduet *Kalendere*. Hvilke tider det er, står i [Angi arbeidstider](docs://howto-werktijden-instellen). Med *Dagskift* kan du ikke velge *Timer* under *Standardenhet for nye aktiviteter*, fordi en dagkalender ikke har noen tidsbånd.

**Helligdagssett** — hvilke fridager prosjektkalenderen får. Ved *Land* velger du *Nederland* (standard), *Tyskland*, *Belgia*, *Frankrike*, *Storbritannia*, *Østerrike*, *Sveits*, *Ingen helligdager* eller *Egendefinert…*. Har landet regioner, legges det til en rullegardinliste *Region*. For Nederland velger du også *Byggferie* hvis *Slå på byggmodus* er på: *Ingen* (standard), *Nord*, *Midt* eller *Sør*. Under det står en linje som *36 helligdager, 2025–2029*. Den kan du utvide for å se listen. Årene går fra året før startdatoen til året etter sluttdatoen, eller til tre år etter startåret hvis det ikke er noen sluttdato. *Egendefinert…* gir en kalender uten helligdager. Den åpner vinduet *Kalendere* rett etter oppretting, så du kan fylle dem inn selv. Prosjektkalenderen heter *Bouwkalender NL*, eller *Standaardkalender* hvis *Slå på byggmodus* er av. Da er *Ingen helligdager* også et valg. Hvordan generatoren fungerer, står i [Generere helligdager og byggferie](docs://howto-feestdagen-genereren).

## Hva startdatoen gjør

Startdatoen er utgangspunktet for prosjektet. Det gjelder tre regler:

- **Nye aktiviteter starter på startdatoen.** En aktivitet du legger til, får prosjektstarten som sin planlagte start.
- **En aktivitet med en forgjenger starter aldri før startdatoen.** Er slutten på forgjengeren tidligere, venter aktiviteten til startdatoen. En aktivitet *uten* forgjenger beholder sin egen dato, også om den ligger før startdatoen. Det trengs for å vise en tidsplan fra MS Project eller Primavera slik kildeprogrammet viser den. En begrensning *Må starte på (MSO)* eller *Må slutte på (MFO)* bryter begge reglene. En slik aktivitet ligger fast på sin dato, også om den faller før startdatoen.
- **En senere startdato flytter løse aktiviteter med seg.** Setter du startdatoen senere i *Prosjektinnstillinger* og klikker på *Bruk*, flyttes aktiviteter uten forgjenger og uten en begrensning som setter en nedre grense (*Start ikke tidligere enn*, *Må starte på*, *Slutt ikke tidligere enn* eller *Må slutte på*) som ligger før den nye datoen, til den datoen. Det skjer i samme trinn i *Angre*. Appen sier hvor mange aktiviteter som er flyttet. Dette skjer bare når du selv endrer startdatoen, aldri når du åpner en fil. Setter du startdatoen senere, flyttes ikke resten av tidsplanen. Det gjør *Flytt prosjekt*. Se [Flytte et prosjekt](docs://howto-project-verplaatsen).

## Se også

- [Beregningsalternativer og beregningsregler](docs://ref-rekenopties-en-conventies): blokken *Beregningsprofil og beregningsalternativer*.
- [Beregningsprofiler og beregningsregler](docs://uitleg-rekenprofielen): hvorfor en profil endrer resultatet.
- [Flytte et prosjekt](docs://howto-project-verplaatsen): hele tidsplanen til en annen start.
- [Legge til aktiviteter og milepæler](docs://howto-taken-en-mijlpalen-toevoegen): å starte med de første aktivitetene.
- [Generere helligdager og byggferie](docs://howto-feestdagen-genereren): helligdagssettet i detalj.
- [Velge IFC-schema](docs://howto-ifc-schema-kiezen): lagre for en bygningsmodell i IFC4.
