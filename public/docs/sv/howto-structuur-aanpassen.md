# Justera strukturen

Mål: ordna uppgifter i faser och underuppgifter, ändra deras ordning och håll WBS-numren korrekta.

## När du behöver detta

Din tidsplan är ett träd: faser (sammanfattningsuppgifter) med underuppgifter under dem, till exempel *Foundation* med *Groundwork*, *Reinforcement* och *Pouring*. Du justerar trädet när du vill hänga uppgifter under en fas, ta en uppgift ur en fas eller när ordningen är fel. **WBS-koden** (1, 1.1, 1.2, 2, …) är en uppgifts nummer i trädet.

## Steg

### Indrag av en uppgift

1. Markera uppgiften. Du kan markera flera uppgifter.
2. Välj *Tidsplan › Struktur › Indrag*. Du kan också använda Alt+→ (eller Alt+Shift+→), eller *Indrag* i snabbmenyn.

Uppgiften blir den sista underuppgiften till föregående uppgift på samma nivå. Den uppgiften blir som ett resultat en sammanfattningsuppgift. Om du markerar en sammanhängande grupp dras hela gruppen in som en helhet. Om uppgiften inte har någon föregående uppgift på samma nivå händer ingenting, och det visas inget meddelande.

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

- **På (standard i ett nytt projekt).** Appen numrerar om hela trädet vid varje ny uppgift, varje borttagning och varje flytt. WBS-koden är då skrivskyddad: du kan inte skriva in den i uppgiftstabellen eller i panelen *Egenskaper*. *Numrera om WBS* är inaktiverad.
- **Av.** Koderna behålls som de är, också efter flytt och indrag. Du skriver in dem själv, i kolumnen *WBS* eller i fältet *WBS-kod* i panelen *Egenskaper*, eller så numrerar du om dem en gång med *Numrera om WBS*. Det skriver också över koder som du själv har skrivit in.

Om du slår på *WBS auto* numrerar appen trädet direkt. Både *WBS auto* och *Numrera om WBS* kan ångras med *Ångra*.

## Fallgropar och vad appen gör

**Filtrering, gruppering eller sortering är på.** Ordningen du ser är då inte tidsplanens ordning, så appen låser strukturen. *Indrag* och *Dra ut* är inaktiverade, med verktygstipset *Inte tillgänglig vid filtrering/gruppering/sortering*. Alt+→ och att dra visar samma text i en remsa, med knappen *Rensa*. Det tar bort filtret, grupperingen och sorteringen på en gång, och Ctrl+Z återställer dem inte. *Indrag* och *Dra ut* saknas då i snabbmenyn.

Alt+↑ och Alt+↓ fungerar i en sådan vy, utan meddelande. Med bara ett filter ser du den nya ordningen direkt. Med sortering ändras ordningen i tidsplanen, men du ser det först efter *Rensa*.

**WBS auto är av.** En ny uppgift får den kod som passar dess plats i trädet, även om en annan uppgift redan har den koden. Så kan dubbla nummer uppstå. Efter indrag stämmer koderna inte heller längre med trädet. *Numrera om WBS* åtgärdar båda.

**En milstolpe får underuppgifter.** En milstolpe är ett ögonblick och har inga underuppgifter. Appen tar bort milstolpsmarkeringen och visar ett meddelande.

**En uppgift med tilldelningar av resurser får underuppgifter.** En sammanfattningsuppgift har inga tilldelningar själv. Appen flyttar dem till den första nya underuppgiften som kan ta emot dem och visar ett meddelande. Finns det ingen sådan underuppgift, eller har den redan samma resurs, händer ingenting och meddelandet säger varför.

**Ett samband skulle skapa ett cirkelberoende.** Sambanden för en sammanfattningsuppgift gäller också för dess underuppgifter. Om en flytt skulle skapa ett cirkelberoende på grund av det, vägrar appen flytten och visar meddelandet *Den här flytten skulle skapa ett cirkelberoende i tidsplanen (…)*. Ingenting ändras.

**Ett samband mellan en uppgift och dess egen fas.** Om du placerar en uppgift under en fas som den redan har ett samband med, finns sambandet kvar, men räknas inte längre med i beräkningen. Appen visar ett meddelande. Du kan läsa mer om samband för sammanfattningsuppgifter i [Samband och fördröjning](docs://uitleg-relaties).

**Tidsplanen är inte längre aktuell.** En flytt till en annan fas kan ändra datum. Tryck på **Beräkna** (F5). Att bara byta ordning inom samma fas gör inte det.

## Se även

- [Lägga till uppgifter och milstolpar](docs://howto-taken-en-mijlpalen-toevoegen): lägg nya uppgifter på rätt plats.
- [Spara och infoga WBS-mallar](docs://howto-wbs-sjablonen): återanvänd en hel fas.
- [Lägga till samband](docs://howto-relaties-leggen): länka ihop uppgifter.
- [Markera, ta bort och ångra uppgifter](docs://howto-taken-selecteren-verwijderen): ångra en flytt.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): fyra faser med deras underuppgifter, precis så som du bygger dem med indrag.
