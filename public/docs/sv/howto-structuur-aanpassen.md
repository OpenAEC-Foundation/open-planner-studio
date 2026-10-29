# Justera strukturen

Mål: ordna uppgifter i faser och underuppgifter, ändra deras ordning och håll WBS-numren korrekta.

## När du behöver detta

Din tidsplan är ett träd: faser (sammanfattningsuppgifter) med underuppgifter under dem, till exempel *Foundation* med *Groundwork*, *Reinforcement* och *Pouring*. Du justerar trädet när du vill hänga uppgifter under en fas, ta en uppgift ur en fas eller när ordningen är fel. **WBS-koden** (1, 1.1, 1.2, 2, …) är en uppgifts nummer i trädet.

## Steg

### Indrag av en uppgift

1. Markera uppgiften. Du kan markera flera uppgifter.
2. Välj *Tidsplan › Struktur › Indrag*. Du kan också använda Alt+→ (eller Alt+Shift+→), eller *Indrag* i snabbmenyn.

Uppgiften blir den sista underuppgiften till föregående uppgift på samma nivå. Den uppgiften blir som ett resultat en sammanfattningsuppgift. Om du markerar ett sammanhängande block dras blocket in som en helhet. Om uppgiften inte har någon föregående uppgift på samma nivå händer ingenting, och det visas inget meddelande.

### Att dra ut en uppgift

Välj *Tidsplan › Struktur › Dra ut*, tryck på Alt+← (eller Alt+Shift+←) eller välj *Dra ut* i snabbmenyn.

Uppgiften blir en uppgift på samma nivå, direkt efter fasen som den hängde under. Dess egna underuppgifter följer med. Uppgifterna som kom efter den i fasen stannar kvar i den. En uppgift på översta nivån kan inte dras ut längre.

### Flytta en uppgift

Du har tre sätt.

- **Med tangentbordet.** Alt+↑ och Alt+↓ byter plats på uppgiften med grannen på samma nivå. En sammanfattningsuppgift tar med sina underuppgifter. Högst upp eller längst ner på nivån händer ingenting. Om flera uppgifter är markerade flyttas bara den uppgift du klickade på först.
- **Dra i uppgiftstabellen.** Tryck på en rad och dra lodrätt. Den översta fjärdedelen av en rad betyder *före*, den nedersta fjärdedelen *efter*. Mitten av en sammanfattningsuppgift placerar uppgiften under den som sista underuppgift. Mitten av en vanlig uppgift räknas som närmaste kant. Om du drar en rad som ingår i en markering med flera rader flyttas hela markeringen.
- **Dra i Gantt-diagrammet.** Dra balken lodrätt till en annan rad. Det fungerar på samma sätt som att dra i uppgiftstabellen och ändrar inga datum. Om du drar vågrätt flyttar du i stället datumen.

Varje flytt går att ångra i ett steg med *Ångra* (Ctrl+Z).

### Håll WBS-numren uppdaterade

Titta på knappen *WBS auto* i *Tidsplan › Struktur*.

- **På (standard i ett nytt projekt).** Den är också på efter att du öppnat en fil utan den här inställningen, om alla WBS-koder redan stämmer med numreringen av trädet (1, 1.1, 1.2 …). Koderna ändras inte. En tom fil utan den här inställningen får också *på*, precis som ett nytt projekt. Appen numrerar om hela trädet vid varje ny uppgift, varje borttagning och varje flytt. WBS-koden är då skrivskyddad: du kan inte skriva in den i uppgiftstabellen eller i panelen *Egenskaper*. *Numrera om WBS* är inaktiverat.
- **Av.** Standard i en fil med egna koder, till exempel *A1000*, eller med en kod som skiljer sig från trädet. Koderna behålls som de är, också efter flytt och indrag. Du skriver in dem själv, i kolumnen *WBS* eller i fältet *WBS-kod* i panelen *Egenskaper*, eller så numrerar du om dem en gång med *Numrera om WBS*. Det skriver också över koder som du själv har skrivit in.

Om du slår på *WBS auto* numrerar appen trädet direkt. Både *WBS auto* och *Numrera om WBS* kan ångras med *Ångra*.

## Fallgropar och vad appen gör

**Filtrering, gruppering eller sortering är på.** Ordningen du ser är då inte tidsplanens ordning, så appen låser strukturen. *Indrag* och *Dra ut* är inaktiverade, med verktygstipset *Inte tillgänglig vid filtrering/gruppering/sortering*. Alt+→ och att dra visar samma text i en röd remsa, med knappen *Rensa*. Det tar bort filtret, grupperingen och sorteringen på en gång, och Ctrl+Z återställer dem inte. Remsan blir kvar tills du klickar på krysset, använder Ctrl+Z eller Ctrl+Y, eller går till ett annat dokument. *Indrag* och *Dra ut* saknas då i snabbmenyn.

Alt+↑ och Alt+↓ fungerar i en sådan vy, utan meddelande. Med bara ett filter ser du den nya ordningen direkt. Med sortering ändras ordningen i tidsplanen, men du ser det först efter *Rensa*.

**WBS auto är av.** Det gäller en fil med egna koder, eller en fil som sparar inställningen som *av*. En ny uppgift får den kod som passar dess plats i trädet, även om en annan uppgift redan har den koden. Så kan dubbla nummer uppstå. Efter indrag stämmer koderna inte heller längre med trädet. *Numrera om WBS* åtgärdar båda.

**En milstolpe får underuppgifter.** En milstolpe är ett ögonblick och har inga underuppgifter. Appen tar bort milstolpsmarkeringen och visar ett meddelande.

**En uppgift med tilldelningar av resurser får underuppgifter.** En sammanfattningsuppgift har inga tilldelningar själv. Därför frågar appen först vad som ska hända med dem, i fönstret *Uppgift blir en sammanfattningsuppgift*. Det sker när du använder *Indrag*, när du använder *Ny underuppgift* eller *Lägg till milstolpe* på en uppgift, när du lägger in en mall, och i *Redigera uppgift* när du väljer en ny *Överordnad uppgift*. Det gäller både för en befintlig uppgift och för en ny uppgift. I *Redigera uppgift* kommer frågan före sparandet. Om du väljer *Avbryt* där, är *Redigera uppgift* kvar öppet med dina ändringar. Du väljer:

- *Avbryt*: inget ändras, och strukturen blir också kvar som den var.
- *Ta bort tilldelning*: uppgiften får sina underuppgifter och tilldelningarna tas bort. Det verkliga arbetet för de tilldelningarna tas också bort.
- *Flytta till ”…”*: tilldelningarna går till den första nya underuppgiften som kan ta emot dem, med deras verkliga arbete. En milstolpe eller en sammanfattningsuppgift tar inte emot tilldelningar.

Om den underuppgiften redan har samma resurs, eller om det inte finns någon lämplig underuppgift, är *Flytta* inaktiverat. Ett orange block i fönstret visar varför.

Om en tilldelning redan har verkligt arbete, visar det orange blocket hur många timmar per resurs. Till exempel: *Tilldelningen för Metselaar har redan 8 timmar verkligt arbete. Om du tar bort den försvinner arbetet.* *Avbryt* är då standardknappen: Enter ändrar inget. Vill du ändå ta bort tilldelningen, klicka då själv på *Ta bort tilldelning*.

Medan fönstret är öppet fungerar ingen genväg utanför fönstret, inklusive *Ångra*, *Klistra in*, Delete, F5 och Ctrl+S. Om en åtgärd skapar fler sammanfattningsuppgifter på en gång, visar fönstret resurserna per uppgift, och ditt val gäller för alla. Ett steg *Ångra* (Ctrl+Z) ångrar hela åtgärden.

**Ett samband skulle skapa ett cirkelberoende.** Sambanden för en sammanfattningsuppgift gäller också för dess underuppgifter. Om en flytt skulle skapa ett cirkelberoende på grund av det, vägrar appen flytten och visar meddelandet *Den här flytten skulle skapa ett cirkelberoende i tidsplanen (…)*. Ingenting ändras.

**Ett samband mellan en uppgift och dess egen fas.** Om du placerar en uppgift under en fas som den redan har ett samband med, finns sambandet kvar, men räknas inte längre med i beräkningen. Appen visar ett meddelande. Du kan läsa mer om samband för sammanfattningsuppgifter i [Samband och fördröjning](docs://uitleg-relaties).

**Tidsplanen är inte längre aktuell.** En flytt till en annan fas kan ändra datum. Tryck på **Beräkna** (F5). Att bara byta ordning inom samma fas gör det inte.

## Se även

- [Lägga till uppgifter och milstolpar](docs://howto-taken-en-mijlpalen-toevoegen): lägg nya uppgifter på rätt plats.
- [Spara och infoga WBS-mallar](docs://howto-wbs-sjablonen): återanvänd en hel fas.
- [Lägga till samband](docs://howto-relaties-leggen): länka ihop uppgifter.
- [Markera, ta bort och ångra uppgifter](docs://howto-taken-selecteren-verwijderen): ångra en flytt.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): fyra faser med deras underuppgifter, precis så som du bygger dem med indrag.
