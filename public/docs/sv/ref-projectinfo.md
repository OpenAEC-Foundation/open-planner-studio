# Nytt projekt och Projektinfo

Fälten i fönstret *Nytt projekt* och i *Projektinfo*: vad varje fält gör, vad standardvärdet är och var det verkar. De är två sidor av samma formulär. *Nytt projekt* skapar ett nytt projekt och har några extra fält. *Projektinfo* ändrar projektet som du har öppnat.

## Öppna

**Nytt projekt** — *Fil › Ny*, Ctrl+N, eller plusset till höger om dokumentflikarna (*Starta ett projekt*, sedan *Nytt projekt*). Fönstret öppnas med markören i *Projektnamn*.

**Projektinfo** — *Inställningar › Projekt › Projektinfo* öppnar formuläret som ett fönster med namnet *Projektinformation*. *Fil › Projektinfo* visar samma formulär på skärmen *Fil*. Blocket *Beräkningsprofil och beräkningsalternativ* finns längst ned på båda ställena. Vad som finns i blocket står i [Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies).

## Skapa, tillämpa och avbryt

**Skapa** (i *Nytt projekt*) skapar projektet och öppnar det i en egen flik. **Tillämpa** (i *Projektinfo*) skriver dina ändringar till projektet.

- **Endast vid Tillämpa.** Du skriver i ett utkast. Projektet ändras först när du klickar på *Tillämpa*. *Tillämpa* skriver bara det du faktiskt har ändrat, i ett steg i *Ångra*. Om du klickar på *Tillämpa* utan att ändra något händer inget och inget steg läggs till.
- **Avbryt, krysset och Esc** stänger fönstret utan att något sparas. Ett klick bredvid fönstret stänger det inte. Det du har skrivit finns kvar.
- **Enter** gör samma sak som *Skapa* eller *Tillämpa*, utom i fältet *Beskrivning* och i en öppen rullgardinslista.
- **På skärmen Fil** visar *Projektinfo* *Ändringarna är inte tillämpade — klicka på Tillämpa för att spara dem.* längst ned så länge ditt utkast skiljer sig. Om du sedan lämnar skärmen frågar appen om du vill tillämpa, kassera eller avbryta. Se [Menyfliksområdet, flik för flik](docs://ref-lint).
- **En anpassad beräkningsprofil utan namn** blockerar *Tillämpa* och *Skapa*. Ge den ett namn, eller kassera ändringen.

## Fält i båda fönstren

**Projektnamn** — projektets namn i namnlisten, på fliken och i filnamnet när du sparar. Standard: tomt. Ett tomt fält är tillåtet. Projektet heter då *Ny tidsplan*, visat som grå text i fältet. Var: hela skärmen.

**Beskrivning** — fri text. Standard: tomt. Effekt: sparas med projektet, i IFC-filen och i exporten till Primavera P6 XML. Det påverkar inte tidsplanen.

**Författare** — fri text. Standard: tomt. Effekt: går till IFC-filen och visas som *Författare:* i sidhuvudet på en rapport. Där kan du inte ändra det.

**Bibliotek** — vilket resursbibliotek projektet är kopplat till. Välj mellan *inget bibliotek (fristående projekt)*, dina befintliga bibliotek och *+ Nytt resursbibliotek…*. Standard: i *Nytt projekt* standardbiblioteket, i *Projektinfo* den nuvarande kopplingen. Effekt: se [Använda resursbiblioteket](docs://howto-resourcebibliotheek-gebruiken). Med *+ Nytt resursbibliotek…* skriver du ett namn i ett fält under. Biblioteket skapas först vid *Skapa* eller *Tillämpa*. Om du avbryter blir inget kvar. En koppling i *Projektinfo* ändras bara om du själv ändrar detta fält.

**Kund/organisation** — fri text. Standard: tomt. Effekt: går till IFC-filen och visas som *Företag:* i sidhuvudet på en rapport.

**Startdatum** — projektets start. Standard: i *Nytt projekt* dagens datum. Vad fältet gör står nedan under *Vad startdatumet gör*.

**Slutdatum** — projektets planerade slut. Standard: tomt. Effekt: bara information, inget krav. Appen planerar inte mot det här datumet. Det visas i sidhuvudet på en rapport och i exporter. Det bestämmer till vilket år helgdagarna skapas. Bara för en Primavera-fil med inställningen *Beräkna slack till projektslut* (se [Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies)) körs slackberäkningen till det här datumet.

**Standardenhet för nya uppgifter** — syns bara när *Aktivera timplanering* är på. Välj mellan *Dagar* och *Timmar*. Standard: *Dagar*. Effekt och villkor: se [Aktivera timplanering](docs://howto-urenplanning-aanzetten).

**Beräkningsprofil och beräkningsalternativ** — i *Projektinfo* hela blocket. I *Nytt projekt* bara rullgardinslistan *Beräkningsprofil* med *Primavera P6*, *Microsoft Project* och *Open Planner Studio*. Standard: *Open Planner Studio*. När du väljer en profil ställs även profilens standardalternativ in. Se [Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies).

## Endast i fönstret Nytt projekt

**Mall för faser** — vilka faser projektet börjar med. Välj mellan *Tom*, *Bostadsbyggnation* och *Kommersiellt byggande / renovering*. Standard: *Tom*. Effekt: *Tom* ger ett projekt utan uppgifter. De två andra lägger upp åtta fasuppgifter, var och en med en varaktighet på 5 i projektets standardenhet (5 arbetsdagar, eller 5 timmar om du väljer *Timmar* under *Standardenhet för nya uppgifter*) och utan samband. Du byter namn på dem, flyttar dem och utökar dem själv. För *Bostadsbyggnation* är dessa: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking och Oplevering. För *Kommersiellt byggande / renovering*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen och Oplevering. Namnen är data i ditt projekt. De förblir nederländska, även i ett annat gränssnittsspråk. Om *Aktivera byggläge* är av finns bara *Tom*. Se [Inställningar](docs://ref-instellingen).

**Skift** — syns bara när *Aktivera timplanering* är på. Välj mellan *Dagskift*, *2 skift*, *3 skift* och *24/7*. Standard: *Dagskift*. Effekt: *Dagskift* lämnar standardkalendern som den är, en vanlig dagskalender från måndag till fredag. De andra tre lägger band med arbetstid i projektets kalender, precis som knapparna med samma namn i fönstret *Kalendrar*. Vilka tider det är står i [Ställa in arbetstider](docs://howto-werktijden-instellen). Med *Dagskift* kan du inte välja *Timmar* under *Standardenhet för nya uppgifter*, eftersom en dagskalender inte har några band med arbetstid.

**Helgdagsuppsättning** — vilka helgdagar projektkalendern får. Vid *Land* väljer du *Nederländerna* (standard), *Tyskland*, *Belgien*, *Frankrike*, *Storbritannien*, *Österrike*, *Schweiz*, *Inga helgdagar* eller *Anpassat…*. Har landet regioner, läggs en rullgardinslista *Region* till. För Nederländerna väljer du också, om *Aktivera byggläge* är på, *Byggsemester*: *Ingen* (standard), *Norra*, *Mellersta* eller *Södra*. Under det står en rad som *36 helgdagar, 2025–2029*. Den kan du expandera för listan. Åren går från året före startdatumet till året efter slutdatumet. Finns inget slutdatum går de till tre år efter startåret. *Anpassat…* ger en kalender utan helgdagar. Fönstret *Kalendrar* öppnas direkt efter att du har skapat den, så att du kan fylla i dem själv. Projektkalendern heter *Bouwkalender NL*, eller *Standaardkalender* om *Aktivera byggläge* är av. Då finns också valet *Inga helgdagar*. Hur genereringen fungerar står i [Generera helgdagar och byggsemestern](docs://howto-feestdagen-genereren).

## Vad startdatumet gör

Startdatumet är projektets utgångspunkt. Det gäller tre regler:

- **Nya uppgifter börjar på startdatumet.** En uppgift som du lägger till får projektstarten som sin planerade start.
- **En uppgift som har en föregående uppgift börjar aldrig före startdatumet.** Om slutet på den föregående uppgiften ligger tidigare väntar uppgiften tills startdatumet. En uppgift *utan* föregående uppgift behåller sitt eget datum, även om det ligger före startdatumet. Det behövs för att visa en tidsplan från MS Project eller Primavera på samma sätt som källprogrammet visar den. En restriktion *Måste starta på (MSO)* eller *Måste slutföras på (MFO)* bryter båda reglerna. En sådan uppgift står kvar på sitt datum, även om det ligger före startdatumet.
- **Ett senare startdatum flyttar lösa uppgifter med sig.** Om du ändrar startdatumet till ett senare datum i *Projektinfo* och klickar på *Tillämpa*, flyttas uppgifter till det nya datumet om de annars skulle ligga före det. Det gäller uppgifter utan föregående uppgift och utan restriktion som sätter en nedre gräns (*Starta tidigast*, *Måste starta på*, *Avsluta tidigast* eller *Måste slutföras på*). Det sker i ett steg i *Ångra*. Appen säger hur många uppgifter som flyttades. Det sker bara när du ändrar startdatumet själv, aldrig när du öppnar en fil. Ett senare startdatum flyttar inte resten av tidsplanen. Det gör *Flytta projekt*, se [Flytta ett projekt](docs://howto-project-verplaatsen).

## Se även

- [Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies): blocket *Beräkningsprofil och beräkningsalternativ*.
- [Beräkningsprofiler och beräkningsregler](docs://uitleg-rekenprofielen): varför en profil ändrar resultatet.
- [Flytta ett projekt](docs://howto-project-verplaatsen): hela tidsplanen till en annan start.
- [Lägga till uppgifter och milstolpar](docs://howto-taken-en-mijlpalen-toevoegen): börja med de första uppgifterna.
- [Generera helgdagar och byggsemestern](docs://howto-feestdagen-genereren): helgdagsuppsättningen i detalj.
