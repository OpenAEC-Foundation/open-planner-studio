# Resurspanelen

Resurspanelen är där du hanterar resurser: vem och vad som är tillgängligt, med vilken kapacitet och på vilken kalender. Histogrammet under Gantt och överbeläggning hör till den. Den här artikeln beskriver för varje fält och knapp vad det gör, vad standardvärdet är och vad du märker av det. Så skapar och tilldelar du resurser beskrivs i [Hantera resurser](docs://howto-resources-beheren) och [Tilldela resurser med en kurva](docs://howto-resource-toewijzen). Att lösa överbeläggning beskrivs i [Lösa överbeläggning](docs://howto-overbezetting-oplossen).

## Så hittar du den

- **Hela panelen** — *Resurser › Hantera › Resurser* eller *Visa › Paneler › Resurser*. Den tar över arbetsytan. Krysset längst upp till höger stänger den.
- **Resursdocka** — *Resurser › Hantera › Resursdocka* eller *Visa › Paneler › Resursdocka*: en kompakt lista i den högra kolumnen bredvid Gantt. Se nedan.
- **Histogram** — *Resurser › Histogram › Histogram* eller *Visa › Paneler › Histogram*: en remsa under Gantt. Se nedan.
- **Vyer** — om projektet hör till ett bibliotek finns det längst upp till höger i panelen ett val mellan *Bibliotek*, *Projekt* och *Beläggning*. Utan bibliotek finns bara projekttabellen. Varje gång du öppnar panelen startar den på *Projekt*. Så hamnar du inte oavsiktligt i det delade biblioteket.

## Ny resurs

- **Ny resurs i projektet** (i vyn *Bibliotek* heter den *Ny resurs i biblioteket*) — knapp längst upp till höger. Öppnar en utkastrad längst ner i tabellen. Ingenting skapas förrän du skriver ett namn och lämnar raden, eller trycker på Enter. Klickar du bort utan namn, eller trycker på Esc, blir det ingenting kvar: ingen resurs och inget steg under *Ångra*. Du kan fylla i fälten i valfri ordning. Allt sparas på en gång. Enter eller pil ned bekräftar raden och öppnar en ny utkastrad. Shift+Enter eller pil upp bekräftar raden och går tillbaka till tabellen. Utkastraden saknar expanderaren för kapacitet, kalenderpennan och papperskorgen, eftersom de arbetar på en resurs som ännu inte finns. Knappen *Ny resurs* under *Resurser › Hantera* gör samma sak.
- **Navigering i tabellen** — i tabellen flyttar Enter och Shift+Enter, och pilarna upp och ned, markören mellan raderna. Enter på sista raden öppnar en ny utkastrad.

## Vyn Projekt

Tabellen med det som projektet använder. Varje rad är en resurs. Ändringar av text och standardkostnad gäller så snart du lämnar fältet. De räknas som ett steg under *Ångra*.

- **Färg** — en färgväljare. Standard: den första lediga färgen från paletten. Resultat: färgen på resursaccenten under Gantt-balkarna (*Visa › Baslinjer & framdrift › Resursaccent*) och på färgrutan i docken.
- **Namn** — resursens namn. Ett tomt namn sparas inte. Fältet går tillbaka till det gamla namnet.
- **Typ** — *Arbete*, *Utrustning*, *Material*, *Underentreprenör* eller *Arbetslag*. Standard för en ny resurs: *Arbete*. Resultat: *Material* har en *Enhet* och räknas inte med i summan *Alla resurser* i histogrammet. Utjämning hoppar över material. Ett *Arbetslag* kan väljas som arbetslag för andra resurser. De andra typerna räknas på samma sätt.
- **Max enheter** — hur mycket av resursen som finns tillgängligt per dag. Det är ett tal över 0, bråktal är tillåtna. Standard: 1. Resultat: kapaciteten per dag. Är belastningen högre har resursen överbeläggning. Pilen bredvid fäller ut *Tidsfasad kapacitet*. Talet vid pilen är antalet steg.
- **Tidsfasad kapacitet** — steg med *Från* (ett datum) och *Max enheter*. *Lägga till steg* lägger till ett steg med dagens datum och 1. Utan steg står det *Inga steg — det platta värdet för max enheter gäller alltid.* Resultat: från datumet för ett steg gäller dess *Max enheter* i stället för det platta värdet. Det senaste steget med ett datum på eller före en dag gäller.
- **Kalender** — en lista med *Projektkalender* (standard), projektets kalendrar och *+ Resurskalender* för en ny. Pennan (*Redigera…*) öppnar den valda kalendern. Den är inaktiv för *Projektkalender*. Resultat: de dagar då resursen arbetar. På en ledig dag är kapaciteten 0. Om arbete är planerat då har resursen överbeläggning med orsaken *Arbetar inte denna dag enligt kalendern "…"*. Resurskalendern ändrar inte datumen för en uppgift. Se [Kalenderfönster](docs://ref-kalenders).
- **Standardkostnad/timme** — kostnaden per timme. Tomt betyder ingen standardkostnad. Ett ogiltigt tal återgår till föregående värde. Resultat: ingen påverkan på tidsplanen eller belastningen. Standardkostnaden styr kolumnen *Totalt*. Den sparas i IFC-filen och skrivs med vid export till MS Project (standardkostnad) och Primavera P6 XML (pris per enhet).
- **Totalt** — skrivskyddat: de belastade timmarna × standardkostnaden, med två decimaler. *—* betyder utan standardkostnad eller belastning. Längst ner summerar en rad *Totalt* alla resurser. Timmarna kommer från den senaste beräkningen. De räknas som tilldelningsenheter × timmar per dag i kalendern för uppgiften. Är de föråldrade? Tryck på *Beräkna*.
- **Enhet** — måttenheten för materialet, till exempel `m³`. Går bara att fylla i för typen *Material* (verktygstips *Fyll bara i för resurser av typen Material.*). Resultat: en etikett. Den räknar inte.
- **Arbetslag** — arbetslaget som resursen tillhör, från resurserna av typen *Arbetslag*. Standard: *Ingen*. Resultat: endast gruppering. Kapaciteten och belastningen för ett arbetslag är inte summan av dess medlemmar.
- **Ta bort** (papperskorgen) — tar bort resursen. Har den tilldelningar frågar appen först *'…' har … tilldelning(ar) — ta bort?* med en bock för att bekräfta och ett kryss för att avbryta.
- **Till biblioteket** — bara när projektet hör till ett bibliotek, och för en resurs med ett namn som ännu inte kommer från biblioteket. Lägger resursen i biblioteket, eller kopplar den till ett befintligt objekt med samma namn. Visar vad som hände (*Tillagd.*, *Fanns redan i biblioteket. Nu kopplad.* eller *Kopplad till det befintliga biblioteksobjektet. Värdena skiljer sig åt, se markeringen.*).
- **Koppla loss från biblioteket** — ikonen för att koppla loss på en resurs som kommer från biblioteket. Tar bort ursprunget. Därefter är alla fält fria igen.

Utan resurser står det *Inga resurser än. Lägg till en för att börja.* Om projektet hör till ett bibliotek står det *Det här projektet använder ännu inga resurser från biblioteket.* med ett tips.

### Resurser från biblioteket

En resurs som kommer från biblioteket har en liten bibliotekssymbol (*Från biblioteket*). Dess *Namn*, *Typ*, *Standardkostnad/timme* och *Enhet* är då vanlig text (*Biblioteksvärde — redigera i bibliotekvyn, eller koppla loss den här resursen från biblioteket.*). Biblioteket bestämmer vad resursen är. *Färg*, *Max enheter*, stegen för kapaciteten, *Kalender* och *Arbetslag* går fortfarande att ändra. Projektet bestämmer hur mycket och när. Två märken kan visas: *avviker — bestäm* (ett klick öppnar fönstret *Länka resursbibliotek*) och *inte längre i biblioteket*, med knappen *Ta bort från projekt*.

## Vyn Bibliotek

Endast när projektet hör till ett bibliotek. Se [Använda biblioteket](docs://howto-resourcebibliotheek-gebruiken) och [Hantera och dela bibliotek](docs://howto-bibliotheken-beheren). Längst upp finns en färgad notis: *Detta redigerar biblioteket och gäller alla projekt — kan inte ångras.* Tabellen har samma fält som vyn *Projekt*, med dessa skillnader:

- Det finns ingen kolumn *Totalt*. Den är en beräkning för ett projekt.
- Kolumnen *Arbetslag* finns så snart biblioteket har resurser.
- Kolumnen *Kalender* erbjuder bibliotekets kalendrar, med *Ingen kalender* som standard.
- **Tilldela till projekt** — lägger resursen i projektet, med en kopia av dess kalender. Visar *Tillagd.* eller *Finns redan i projektet.*
- **Ta bort** — frågar *Ta bort '…' från biblioteket? Detta gäller alla projekt och kan inte ångras.*
- Utan resurser står det *Inga resurser i biblioteket ännu.*

## Vyn Beläggning

En skrivskyddad vy över alla öppna dokument: vilka bibliotekresurser som är bokade var. Det finns ingen knapp för en ny resurs. Se [Använda beläggningsöversikten](docs://howto-bezettingsoverzicht-gebruiken).

- **Tabell** — per bibliotekresurs: *Namn*, *Dokument* (antalet dokument den finns i), *Period* och *Topp / Kapacitet* (den högsta sammanlagda belastningen mot kapaciteten den dagen). En röd *N dagar med överbeläggning* betyder att resursen över flera dokument har mer än sin kapacitet. Pilen bredvid ett namn fäller ut dokumenten, var och en med period och topp. Ett klick på en rad visar histogrammet för den resursen (*Välj en resurs för att se histogrammet.*).
- **Vad som räknas** — bara dokument som är öppna i det här programmet (*Den här översikten visar bara dokumenten som är öppnade i det här programmet.*). Ett dokument som inte är beräknat får ett meddelande på sin rad. Det aktiva dokumentet räknas med de senast beräknade siffrorna (*Föråldrat: det här är de senast beräknade siffrorna — tryck F5 i det här dokumentet.*). Ett annat dokument beräknas i förväg av översikten (*Förberäknat för den här översikten — dokumentet visar själv äldre datum tills du trycker F5 där eller slår på “Beräkna automatiskt”.*). Är *Beräkna automatiskt* på beräknar översikten verkligen de dokumenten. Misslyckas beräkningen räknas dokumentet inte (*Räknas inte med: tidsplanen är inte beräknad — aktivera dokumentet och tryck F5.*). Utan bokade resurser står det *Inga bibliotekresurser bokade i de öppnade dokumenten.*
- **Ordning** — resurser med överbeläggning står överst, med flest dagar med överbeläggning först. Sedan kommer de i alfabetisk ordning.

## Resursdockan

En kompakt lista i den högra kolumnen, bredvid panelen *Egenskaper*. Per resurs: en färgruta, namnet (skrivskyddat), en röd triangel *Överbeläggning* så snart resursen har minst en dag med överbeläggning, och *Max enheter* att ändra. Om det finns en markering av uppgifter, visas bara resurserna för de uppgifterna. I rubriken finns *Hela panelen* (öppnar hela panelen) och *Stänga docken*. Utan resurser står det *Inga resurser än. Lägg till en för att börja.*

## Histogrammet

En remsa under Gantt som visar belastningen för en resurs per dag. Slå på eller av den med *Resurser › Histogram › Histogram* eller *Visa › Paneler › Histogram*. Standard: av. Ditt val sparas. Höjden är 160 pixlar som standard. Du kan dra i kanten mellan Gantt och histogrammet för att ändra den.

- **Väljare** — till vänster, under uppgiftstabellen, finns en lista. *Alla resurser* står överst och under den en rad per resurs. Ett klick väljer raden. Piltangenterna går igenom listan, och *Resurser › Histogram › Föregående* och *Nästa* gör samma sak. En röd prick bredvid en rad betyder att den resursen har minst en dag med överbeläggning. För *Alla resurser* tittar pricken bara på resurser som inte är material. Om det finns en markering av uppgifter, innehåller listan bara resurserna för de uppgifterna. Ligger din valda resurs utanför den, visar remsan tillfälligt *Alla resurser* för markeringen.
- **Staplar** — en stapel per dag: belastningen i tilldelningsenheter. En linje visar kapaciteten. Den del av stapeln som ligger över kapaciteten är röd. Överst till vänster står det högsta värdet med *tilldelningsenheter*. *Alla resurser* summerar belastningen och kapaciteten för alla resurser, utom material.
- **Verktygstips** — håll musen still en stund över en dag: *N uppgifter bidrar på {date}* med namnen på högst åtta uppgifter. För en vald resurs och en dag då dess kalender inte arbetar står det också *Arbetar inte denna dag enligt kalendern "…"*.
- **Meddelanden i remsan** — *Beräkna om (F5) för att visa belastningen* när det inte finns någon belastning. *Inga resurser än* när det inte finns några resurser. *⚠ Tidsplanen är föråldrad — beräkna om (F5)* längst upp till höger när tidsplanen är föråldrad.
- **Vad som räknas** — tilldelningsenheterna per dag för varje tilldelning, fördelade över arbetsdagarna för uppgiften enligt *Kurva* (eller *Timfördelning*). Bara lövuppgifter räknas, och ingen milstolpe. Belastningen uppdateras efter *Beräkna* och efter ändringar av resurser och tilldelningar. Ändrar du datum för uppgifter räknas det först efter *Beräkna*.

## Överbeläggning

En resurs har överbeläggning på en dag om dess belastning är högre än dess kapacitet. Kapaciteten är *Max enheter* (med stegen för kapaciteten) på en arbetsdag i dess kalender. På en ledig dag är den 0. Material räknas med här. Orsaken är antingen för lite kapacitet, eller en dag då resursen inte arbetar enligt sin kalender.

Var du ser det:

- **Resurser › Överbeläggning** — antalet resurser med överbeläggning, eller *Ingen*.
- **Statusfältet** — *N resurs(er) med överbeläggning*. Ett klick öppnar panelen *Varningar*.
- **Varningar** — en rad per resurs *Överbeläggning på N dag(ar) (första – sista)*. Till det läggs *resursen arbetar inte dessa dag(ar) enligt sin kalender* om alla dagar är lediga dagar. Vid en blandning läggs *varav N dag(ar) då resursen inte arbetar enligt sin kalender* till. Se [Meddelanden och varningar](docs://ref-meldingen).
- **Histogram** — de röda delarna av staplarna och den röda pricken i väljaren.
- **Docken** — triangeln *Överbeläggning*.

Med utjämning kan du lösa överbeläggning genom att flytta uppgifter inom deras slack. Utjämning löser inte överbeläggning för en resurs som måste arbeta på en ledig dag. Se [Utjämning](docs://uitleg-nivelleren).
