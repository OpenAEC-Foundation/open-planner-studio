# Hantera resurser

Mål: skapa, redigera och ta bort resurser (personer, maskiner och material) i ditt projekt, så att du kan tilldela dem till uppgifter.

## När du behöver detta

Innan du sätter en murare eller en kran på en uppgift måste personen eller maskinen finnas som resurs. Resursen registrerar hur mycket av den som finns och vilka dagar den arbetar. Med det räknar appen ut om du begär för mycket av den en och samma dag. Du redigerar en resurs när bemanningen ändras, till exempel när en andra murare går med.

Två termer. **Max enheter** är kapaciteten per arbetsdag: 1 är en person eller maskin, 2 är två av dem. En **tilldelning** är en resurs på en uppgift (se [Tilldela resurser med en kurva](docs://howto-resource-toewijzen)).

## Steg

### Skapa en resurs

1. Välj *Resurser › Hantera › Ny resurs*. Resurspanelen tar över arbetsytan och en tom rad visas längst ner i tabellen. Du kan också öppna panelen med *Resurser › Hantera › Resurser* och sedan välja *Ny resurs i projektet*.
2. Skriv namnet, till exempel *Bricklayer*.
3. Välj *Typ*: *Arbete* (standard), *Utrustning*, *Material*, *Underentreprenör* eller *Arbetslag*.
4. Fyll i de andra fälten om det behövs. Allt har en standard: *Max enheter* är 1 och *Kalender* är *Projektkalender*. *Standardkostnad/timme* är tomt. Du kan bara fylla i *Enhet* för typen *Material*, till exempel m³.
5. Tryck på Enter eller klicka utanför raden. Resursen finns i tabellen. Med Enter öppnas direkt en tom rad under den för nästa resurs. Tryck på Esc när du är klar.

Raden blir först en resurs när den har ett namn. Med Esc, eller om du klickar bort utan namn, skapar appen ingenting. Ordningen när du fyller i saker spelar ingen roll: du kan välja typ först och skriva namnet sedan.

### Redigera en resurs

Redigera fälten i raden. Appen sparar namnet, standardkostnaden och enheten när du lämnar fältet, och de andra fälten direkt.

- Appen godkänner *Max enheter* bara om värdet är större än 0. Med 0 eller lägre får fältet en röd kant och går tillbaka till föregående värde.
- *Kalender* avgör vilka dagar resursen arbetar. Välj *Projektkalender* eller en egen kalender. Med *+ Resurskalender* skapar du en ny. Pennan (*Redigera…*) öppnar den valda kalendern. Om en uppgift arbetar en dag när resursen är ledig enligt sin kalender, räknas dagen som överbeläggning. Hur du skapar en resurskalender beskrivs i [Ställa in en resurskalender](docs://howto-resourcekalender-instellen).
- *Standardkostnad/timme* och *Totalt*: *Totalt* är resursens belastade timmar gånger standardkostnaden. En putsare som är belastad i 32 timmar med en standardkostnad på 50 per timme blir 1 600,00. Längst ner i tabellen står summan av alla resurser.
- *Arbetslag* grupperar en resurs under en resurs av typen *Arbetslag*. Det är bara en gruppering: appen lägger inte ihop kapaciteten eller belastningen för medlemmarna till besättningen.
- Den färgade rutan till vänster är resursens färg. Den visas bara och påverkar inte tidsplanen.

### Kapacitet som ändras över tid

Kommer din andra murare först den 19 juli? Klicka på pilen bredvid *Max enheter*. Under *Tidsfasad kapacitet* väljer du *Lägga till steg*. Varje steg har ett datum (*Från*) och ett tal (*Max enheter*). Från det datumet gäller det talet. Utan steg gäller alltid det fasta värdet.

Ett nytt steg börjar med dagens datum och 1 enhet. Ändra båda, för annars gäller en kapacitet på 1 från i dag.

### Ta bort en resurs

1. Klicka på papperskorgen i raden.
2. Om resursen har tilldelningar frågar appen efter bekräftelse, till exempel *'Bricklayer' har 4 tilldelning(ar) — ta bort?* Klicka på bocken för att ta bort eller krysset för att avbryta. Utan tilldelningar försvinner resursen direkt.

Resursens tilldelningar försvinner med den. Om en uppgift har en arbetsregel som inte är *Fast varaktighet och fasta enheter*, fördelar appen arbetet från den borttagna resursen bland de resurser som finns kvar. Beroende på regeln ändras deras tilldelningsenheter eller uppgiftens varaktighet. Om varaktigheten ändras är tidsplanen inte längre aktuell.

Du kan ångra att skapa, redigera och ta bort med *Ångra* (Ctrl+Z).

### Den lilla översikten i sidokolumnen

*Resurser › Hantera › Resursdocka* visar en kompakt översikt i den högra kolumnen, bredvid *Egenskaper*. Där ser du namn och färg för varje resurs och en varningssymbol (*Överbeläggning*) bredvid en resurs med överbeläggning. Du kan bara ändra *Max enheter* där. Om du väljer en eller flera uppgifter visar översikten bara resurserna för de uppgifterna.

## Fallgropar och vad appen gör då

**Bara typen *Material* gör skillnad för beräkningen.** Arbete, Utrustning, Underentreprenör och Besättning behandlas lika. Material räknas inte in i en uppgifts varaktighet och jämnas inte ut. I histogrammet räknas inte material heller i raden *Alla resurser*.

**Inget namn, ingen resurs.** En tom rad försvinner utan spår.

**Ett nytt steg i kapaciteten.** Om du glömmer att ändra datumet och talet är kapaciteten 1 från i dag.

**Att ta bort en resurs du fortfarande behöver.** Om du tar bort den av misstag trycker du på Ctrl+Z direkt. Tilldelningarna kommer tillbaka också.

## Se även

- [Tilldela resurser med en kurva](docs://howto-resource-toewijzen): sätta en resurs på en uppgift.
- [Ställa in en resurskalender](docs://howto-resourcekalender-instellen): att fastställa arbetsdagarna för en resurs.
- [Lösa överbeläggning](docs://howto-overbezetting-oplossen): vad du gör när en resurs har för mycket att göra en dag.
- [Resurspanel](docs://ref-resourcepaneel): alla fält och knappar i resurspanelen.
