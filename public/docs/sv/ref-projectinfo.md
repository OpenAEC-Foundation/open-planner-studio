# Nytt projekt och Projektinställningar

Fälten i fönstret *Nytt projekt* och i *Projektinställningar*: vad varje fält gör, vad standardvärdet är och var det får effekt. De är två sidor av samma formulär. *Nytt projekt* skapar ett nytt projekt och har några extra fält. *Projektinställningar* ändrar projektet som du har öppnat.

## Öppna

**Nytt projekt** — *Fil › Nytt*, Ctrl+N, eller plusknappen till höger om dokumentflikarna (*Starta ett projekt*, sedan *Nytt projekt*). Fönstret öppnas med markören i fältet *Projektnamn*.

**Projektinställningar** — *Inställningar › Projekt › Projektinställningar* öppnar formuläret som ett fönster med titeln *Projektinställningar*. *Fil › Projektinställningar* visar samma formulär i skärmen *Fil*. Blocket *Beräkningsprofil och beräkningsalternativ* står längst ned på båda ställena. Vad det innehåller står i [Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies).

## Skapa, Tillämpa och avbryt

**Skapa** (i *Nytt projekt*) skapar projektet. Om din aktuella flik är tom och oförändrad använder appen den fliken. Annars öppnas projektet i en ny flik. **Tillämpa** (i *Projektinställningar*) skriver dina ändringar till projektet.

- **Bara vid Tillämpa.** Du skriver i ett utkast. Projektet ändras först när du klickar på *Tillämpa*. *Tillämpa* skriver bara det du faktiskt har ändrat, i ett steg i *Ångra*. Klickar du på *Tillämpa* utan att ändra något, händer ingenting och inget steg läggs till.
- **Avbryt, krysset och Esc** stänger fönstret utan att något sparas. Ett klick bredvid fönstret stänger det inte. Det du har skrivit blir kvar.
- **Retur** gör samma sak som *Skapa* eller *Tillämpa*, utom i fältet *Beskrivning* och i en öppen rullgardinslista.
- **I skärmen Fil** visar *Projektinställningar* *Ändringarna är inte tillämpade — klicka på Tillämpa för att spara dem.* längst ned så länge ditt utkast skiljer sig. Lämnar du skärmen, frågar appen om du vill tillämpa, kassera eller avbryta. Se [Menyfliksområdet, flik för flik](docs://ref-lint).
- **En anpassad beräkningsprofil utan namn** blockerar *Tillämpa* och *Skapa*. Ge den ett namn, eller kassera ändringen.

## Fält i båda fönstren

**Projektnamn** — namnet på projektet i titelraden, på fliken och i filnamnet när du sparar. Standard: tomt. Ett tomt fält är tillåtet: projektet heter då *Ny tidsplan*, visat med grå text i fältet. Var: hela skärmen.

**Beskrivning** — fri tekst. Standard: tomt. Effekt: sparas med projektet, i IFC-filen och i exporten till Primavera P6 XML. Den påverkar inte tidsplanen.

**Författare** — fri tekst. Standard: tomt. Effekt: den går in i IFC-filen och visas som *Författare:* i sidhuvudet av en rapport, där du inte kan skriva om den.

**Bibliotek** — vilket bibliotek projektet är kopplat till. Välj *inget bibliotek (fristående projekt)*, något av dina befintliga bibliotek eller *+ Nytt resursbibliotek…*. Standard: i *Nytt projekt* standardbiblioteket, i *Projektinställningar* den nuvarande kopplingen. Effekt: se [Använda biblioteket](docs://howto-resourcebibliotheek-gebruiken). Med *+ Nytt resursbibliotek…* skriver du ett namn i ett fält nedanför. Biblioteket skapas först vid *Skapa* eller *Tillämpa*, så avbryt lämnar ingenting kvar. En koppling i *Projektinställningar* ändras bara om du rör det här fältet själv.

**Klient/organisation** — fri tekst. Standard: tomt. Effekt: den går in i IFC-filen och visas som *Företag:* i sidhuvudet av en rapport.

**Startdatum** — projektets start. Standard: i *Nytt projekt* dagens datum. Vad fältet gör står nedan under *Vad startdatumet gör*.

**Slutdatum** — den planerade slutdagen för projektet. Standard: tomt. Effekt: det är information, inte ett krav. Appen planerar inte mot det datumet. Det visas i sidhuvudet av en rapport och i exporter, och det bestämmer upp till vilket år helgdagarna genereras. Bara för en Primavera-fil med inställningen *Beräkna slack till projektslut* (se [Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies)) körs slackberäkningen fram till det här datumet.

**Standardenhet för nya uppgifter** — bara synlig när *Aktivera timplanering* är på. Välj *Dagar* eller *Timmar*. Standard: *Dagar*. Effekt och villkor: se [Aktivera timplanering](docs://howto-urenplanning-aanzetten).

**Beräkningsprofil och beräkningsalternativ** — i *Projektinställningar* hela blocket. I *Nytt projekt* bara rullgardinslistan *Beräkningsprofil* med *Primavera P6*, *Microsoft Project* och *Open Planner Studio*. Standard: *Open Planner Studio*. Att välja en profil ställer också in standardalternativen för den profilen. Se [Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies).

## Bara i Projektinställningar

**IFC-schema vid sparning** — vilket IFC-schema som står i huvudet på den sparade filen. Val mellan *IFC 4.3 ADD2 (standard)*, *IFC 4.3* och *IFC4*. Standard: *IFC 4.3 ADD2 (standard)*. För en öppnad IFC-fil: schemat i den filen. Effekt: bara huvudet i filen ändras, inte innehållet. Använd det för att slå ihop tidsplanen med en byggmodell i samma schema. Har en öppnad fil ett annat schema än standard, frågar appen första gången du sparar om du vill behålla det schemat. Ett val här räknas som svar. Ett annat val här är inget steg i *Ångra*, eftersom schemat hör till filen. Se [Välja IFC-schema](docs://howto-ifc-schema-kiezen).

## Bara i fönstret Nytt projekt

**Fasmall** — vilka faser projektet börjar med. Välj *Tom*, *Bostadsbyggnation* eller *Kommersiellt byggande / renovering*. Standard: *Tom*. Effekt: *Tom* ger ett projekt utan uppgifter. De andra två lägger åtta fasuppgifter klart, var och en med en varaktighet på 5 i projektets standardenhet (5 arbetsdagar, eller 5 timmar om du väljer *Timmar* under *Standardenhet för nya uppgifter*) och utan samband. Du döper om, flyttar och förlänger dem själv. För *Bostadsbyggnation* är dessa: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking en Oplevering. För *Kommersiellt byggande / renovering*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen en Oplevering. Namnen är data i ditt projekt och förblir på nederländska, även i ett annat gränssnittsspråk. Om *Aktivera byggläge* är av finns bara *Tom*. Se [Appinställningar](docs://ref-instellingen).

**Skift** — bara synlig när *Aktivera timplanering* är på. Välj *Dagskift*, *2 skift*, *3 skift* eller *24/7*. Standard: *Dagskift*. Effekt: *Dagskift* lämnar standardkalendern som den är, en vanlig dagkalender från måndag till fredag. De andra tre lägger band med arbetstid i projektets kalender, som knapparna med samma namn i fönstret *Kalendrar*. Vilka tider det är står i [Ställa in arbetstid](docs://howto-werktijden-instellen). Med *Dagskift* kan du inte välja *Timmar* under *Standardenhet för nya uppgifter*, eftersom en dagkalender inte har några band med arbetstid.

**Helgdagsuppsättning** — vilka lediga dagar projektkalendern får. Under *Land* väljer du *Nederländerna* (standard), *Tyskland*, *Belgien*, *Frankrike*, *Storbritannien*, *Österrike*, *Schweiz*, *Inga helgdagar* eller *Anpassad…*. Har landet regioner, läggs en rullgardinslista *Region* till. För Nederländerna väljer du också *Byggsemester* om *Aktivera byggläge* är på: *Ingen* (standard), *Norra*, *Mellersta* eller *Södra*. Under det står en rad som *36 helgdagar, 2025–2029*. Den fäller du ut för att se listan. Åren går från året före startdatumet till året efter slutdatumet, eller till tre år efter startåret om det inte finns något slutdatum. *Anpassad…* ger en kalender utan helgdagar och öppnar fönstret *Kalendrar* direkt efter att du har skapat den, så att du kan fylla i dem själv. Projektkalendern heter *Bouwkalender NL*, eller *Standaardkalender* om *Aktivera byggläge* är av. Då finns också *Inga helgdagar* som val. Hur genereringen fungerar står i [Generera helgdagar och byggsemester](docs://howto-feestdagen-genereren).

## Vad startdatumet gör

Startdatumet är projektets ankare. Tre regler:

- **Nya uppgifter börjar på startdatumet.** En uppgift som du lägger till får projektstarten som planerad start.
- **En uppgift med en föregående uppgift börjar aldrig före startdatumet.** Är slutet på den föregående uppgiften tidigare, väntar uppgiften till startdatumet. En uppgift *utan* föregående uppgift behåller sitt eget datum, även om det ligger före startdatumet. Det behövs för att visa en tidsplan från MS Project eller Primavera på samma sätt som källprogrammet gör. En restriktion *Måste starta på (MSO)* eller *Måste slutföras på (MFO)* bryter båda reglerna: en sådan uppgift står kvar på sitt datum, även om det ligger före startdatumet.
- **Ett senare startdatum flyttar lösa uppgifter med sig.** Om du ställer in ett senare startdatum i *Projektinställningar* och klickar på *Tillämpa*, flyttas uppgifter som saknar föregående uppgift och saknar en restriktion som sätter en undre gräns (*starta tidigast*, *måste starta på*, *avsluta tidigast* eller *måste slutföras på*) till det nya datumet, om de annars skulle ligga före det. Det sker i ett steg i *Ångra*. Appen säger hur många uppgifter som flyttades. Det händer bara när du ändrar startdatumet själv, aldrig när du öppnar en fil. Ett senare startdatum flyttar inte resten av tidsplanen. Det gör *Flytta projekt*, se [Flytta ett projekt](docs://howto-project-verplaatsen).

## Se även

- [Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies): blocket *Beräkningsprofil och beräkningsalternativ*.
- [Beräkningsprofiler och beräkningsregler](docs://uitleg-rekenprofielen): varför en profil ändrar resultatet.
- [Flytta ett projekt](docs://howto-project-verplaatsen): hela tidsplanen till en ny start.
- [Lägga till uppgifter och milstolpar](docs://howto-taken-en-mijlpalen-toevoegen): att börja med de första uppgifterna.
- [Generera helgdagar och byggsemester](docs://howto-feestdagen-genereren): helgdagsuppsättningen i detalj.
- [Välja IFC-schema](docs://howto-ifc-schema-kiezen): spara för en byggnadsmodell i IFC4.
