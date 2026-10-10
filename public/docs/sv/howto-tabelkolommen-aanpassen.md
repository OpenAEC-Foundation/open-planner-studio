# Justera tabellkolumner

Mål: välj vilka kolumner du ser i uppgiftstabellen, i vilken ordning och hur breda de är.

## När du behöver det

På mötet vill du se måldatumet och totalt slack bredvid varje uppgift. Platschefen vill bara ha start och slut bredvid namnet. Eller så är en kolumn så smal att rubriken klipps av. Uppgiftstabellen består av kolumner som du väljer själv: det finns dussintals, från *Uppgiftsnamn* och *Varaktighet* till *Måldatum*, *Fritt slack* och *Tilldelade resurser*.

Det finns två uppgiftstabeller, var och en med sina egna kolumner:

- **Uppgiftstabellen bredvid Gantt-schemat** finns till vänster om tidslinjen på bland andra flikarna *Start*, *Tidsplan* och *Visa*. Som standard har den *WBS*, *Uppgiftsnamn* och *Varaktighet*, så att det finns plats kvar för tidslinjen.
- **Tabellen på fliken Tabell** använder hela arbetsytan. Som standard har den *WBS*, *Uppgiftsnamn*, *Varaktighet*, *Start*, *Slut*, *Uppgiftstyp*, *Kritisk*, *Totalt slack* och *Framdrift*, plus en kolumn per uppgiftskod och eget fält i projektet.

En ändring i den ena tabellen ändrar inte den andra.

## Steg

### Lägga till en kolumn

1. Klicka på plusset (**+**) till höger om tabellrubriken. På fliken *Tabell* kan du också använda *Tabell › Kolumner › Kolumner…*. Fönstret *Välja kolumn* öppnas.
2. Hitta kolumnen. Överst finns *Senast använda*, om du har valt kolumner tidigare. Skriv en del av namnet i fältet *Sök*, till exempel *mål* för *Måldatum*, eller öppna en kategori: *Uppgift*, *Tidsplan*, *Restriktioner*, *Samband*, *Resurser*, *Framdrift*, *Beräknat*, *Baslinje*, *Anpassat* eller *Teknisk*.
3. Klicka på kolumnen. Den läggs sist i tabellen och fönstret stängs.

En kolumn som redan finns i tabellen är grå och går inte att välja.

### Ta bort en kolumn

Klicka på minustecknet i kolumnrubriken (*Ta bort: Måldatum*). Eller högerklicka på rubriken och välj *Ta bort: Måldatum*. Med Ctrl+Z får du tillbaka kolumnen, eller så väljer du den igen med plusset.

### Ändra bredden

Dra kanten till höger om kolumnrubriken åt vänster eller åt höger. Dubbelklicka på kanten, eller välj *Anpassa automatiskt* i menyn för rubriken (med höger musknapp), för att göra kolumnen tillräckligt bred för innehållet, upp till högst 480 pixlar. Om kanten har fokus gör piltangenterna kolumnen bredare eller smalare steg för steg.

### Fästa kolumner

Högerklicka på rubriken och välj *Fäst*. Fästa kolumner flyttas till början och blir kvar till vänster när du rullar i sidled. Det fungerar så länge de tillsammans inte är bredare än fönstret. *Lossa* flyttar tillbaka dem till raden.

### Ändra ordningen

Dra en kolumnrubrik till en annan plats. En fäst kolumn flyttar du bland de fästa kolumnerna, en vanlig kolumn bland de vanliga kolumnerna.

### Tillbaka till standard

Öppna fönstret *Välja kolumn* och klicka på *Återställ standard* längst ned. Knappen är grå om kolumnerna redan är standard. För tabellen på fliken *Tabell* läggs dessutom en kolumn till för varje uppgiftskod och eget fält i projektet, även om du tog bort dem tidigare. Kolumnerna hör till det projekt som koden eller det egna fältet finns i. Du kan läsa om de koderna och fälten i [Uppgiftskoder och egna fält](docs://howto-codes-en-velden).

## Fallgropar och vad appen gör

**Rubriken klipps av.** En smal kolumn klipper av namnet, till exempel *Totalt slack* till *Tot…*. Dubbelklicka på kanten av rubriken för att passa in kolumnen.

**Du ändrar fel tabell.** Kolumnerna i uppgiftstabellen bredvid Gantt-schemat och de på fliken *Tabell* är separata. Om du är på *Visa* eller *Start* ändrar du tabellen bredvid Gantt-schemat. Plusset på fliken *Tabell* ändrar den stora tabellen.

**En layout återställer kolumner.** Om en layout har delen *Kolumner* bockad sätter ett klick på layoutknappen tillbaka kolumnerna i uppgiftstabellen bredvid Gantt-schemat till det sparade läget. Tabellen på fliken *Tabell* lämnas ifred. Se [Skapa och använda en layout](docs://howto-layouts-gebruiken).

**Kolumnerna finns på din enhet, inte i projektet.** Appen sparar ditt kolumnval för alla dina projekt på den här enheten och sparar det inte i projektfilen. Projektet blir inte heller ”ändrat”. Du kan ångra varje kolumnändring med *Ångra* (Ctrl+Z). Stegen heter till exempel *Lägg till kolumn Deadline* och *Ändra bredd på kolumn Task name*.

## Se även

- [Skapa och använda en layout](docs://howto-layouts-gebruiken): kolumner på en knapp tillsammans med ett filter eller en sortering.
- [Uppgiftskoder och egna fält](docs://howto-codes-en-velden): skapa egna kolumner som du kan välja här.
- [Tabellkolumner](docs://ref-tabelkolommen): alla kolumner och vad de visar.
