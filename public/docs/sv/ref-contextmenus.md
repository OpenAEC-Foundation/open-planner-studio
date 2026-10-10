# Högerklicksmenyer

Vilka menyer högerknappen öppnar i Gantt och i uppgiftstabellen, vad varje post gör och vilka uppgifter den gäller. Posterna som också finns som knapp eller genväg står i [Menyfliksområdet, flik för flik](docs://ref-lint) och [Kortkommandon](docs://ref-sneltoetsen).

## Vilken meny finns var

Det finns fyra menyer. Vilken du får beror på var du klickar:

- **På en uppgiftsbalk i Gantt** — uppgiftsmenyn, med *Starta samband härifrån* överst.
- **På en uppgift i uppgiftstabellen** — samma uppgiftsmeny, utan det alternativet överst. Det gäller både uppgiftstabellen till vänster om Gantt och fliken *Tabell*.
- **På en grupprubrik i uppgiftstabellen** — en liten meny för att fälla ut och fälla ihop grupper. Grupprubriker syns bara när du grupperar, till exempel med layouten *Resursdiagram*.
- **På tomt utrymme** — i Gantt bredvid eller under balkarna, och i uppgiftstabellen under den sista uppgiften eller på den grå raden *Ny uppgift*. Menyn har *Ny uppgift*, *Lägg till milstolpe* och *Klistra in*. I Gantt finns också *Återställ zoom* och *Anpassa till projektet*. En ny uppgift eller milstolpe hamnar längst ned i listan. I Gantt börjar den på datumet där du klickade. I uppgiftstabellen öppnas namncellen direkt, så att du kan skriva.

På själva grupprubrikens rad i Gantt öppnar högerknappen ingen meny. Ett högerklick i tidslinjens rubrik gör inte heller något. Kolumnrubrikerna i uppgiftstabellen har en egen meny, som beskrivs i [Anpassa tabellkolumner](docs://howto-tabelkolommen-aanpassen).

**Vilka uppgifter gäller en post?** Du klickar på en uppgift, men markeringen avgör omfånget. Om uppgiften du klickar på ingår i markeringen gäller posten hela markeringen. Om den inte ingår gäller posten bara den uppgiften. Vid ett högerklick på en balk i Gantt eller på en rad i uppgiftstabellen ersätter den uppgiften markeringen, om den inte ingick i den. Varje post som ändrar något är ett steg i *Ångra*, också för en hel markering.

## Uppgiftsmenyn

Posterna står i den här ordningen. En linje mellan grupper är en avdelare i menyn.

**Starta samband härifrån** — bara i Gantt, på en balk. Slår på sambandsläget med den här uppgiften markerad. Du drar sedan till den efterföljande uppgiften. Se [Lägga till samband](docs://howto-relaties-leggen).

**Ta bort avbrott** och **Ta bort alla avbrott** — bara i Gantt, på en balk med avbrott. *Ta bort avbrott* finns bara om du klickar på ett avbrott eller på biten efter det, och avbrottet går att redigera. Då tas bara det avbrottet bort. *Ta bort alla avbrott* tar bort alla, även avbrott från en källfil som du inte kan redigera. Se [Dela upp en uppgift](docs://howto-taak-splitsen).

**Redigera...** — öppnar fönstret *Redigera uppgift* för den här uppgiften. Se [Uppgiftsdialogen och egenskapspanelen](docs://ref-taak-eigenschappen).

**Infoga ovan** och **Infoga under** — infogar en ny uppgift ovanför den översta uppgiften eller under den nedersta uppgiften i omfånget, på samma nivå. Det fungerar bara i den rena trädvyn, utan filter, gruppering eller sortering. Annars visar appen ett meddelande och gör ingenting. Se [Lägga till uppgifter och milstolpar](docs://howto-taken-en-mijlpalen-toevoegen).

**Lägg till underuppgift** — lägger till en ny uppgift som underuppgift till uppgiften du klickade på, längst ned bland dess underuppgifter. Bara för den uppgiften, inte för hela markeringen.

**Lägg till milstolpe** — lägger till en milstolpe som underuppgift till uppgiften du klickade på. Bara för den uppgiften.

**Lägg till samband** — gör samma sak som *Starta samband härifrån*: slår på sambandsläget med den här uppgiften markerad. I uppgiftstabellen är posten inaktiv om Gantt inte syns, med hjälptexten *Endast tillgänglig när Gantt-diagrammet visas*.

**Dra in** och **Dra ut** — flyttar uppgifterna i omfånget en nivå djupare eller en nivå högre i WBS. Dessa två finns bara i den rena trädvyn. Se [Ändra strukturen](docs://howto-structuur-aanpassen).

**Växla milstolpe** — gör uppgiften till en milstolpe, eller tillbaka. Det nya läget följer av uppgiften du klickade på och gäller för hela omfånget. Är den en uppgift, blir alla uppgifter i omfånget milstolpar. En sammanfattningsuppgift och en uppgift med tilldelningar blir inte en milstolpe. Resten av omfånget blir det. Du får ett meddelande för varje skäl.

**Tilldela kalender ▸** — en undermeny med *Projektkalender* (uppgiften har då ingen egen kalender) och under den de tillgängliga kalendrarna. Det aktuella valet har en bockmarkering. En uppgift som redan har den kalendern räknas inte med och ger inget extra steg i *Ångra*. Se [Skapa och tilldela en kalender](docs://howto-kalender-maken-en-toewijzen).

**Framdrift ▸** — en undermeny med 0%, 25%, 50%, 75% och 100%. Det aktuella värdet har en bockmarkering. En sammanfattningsuppgift har ingen egen framdrift. Finns en sådan i omfånget, får dess lövuppgifter procenten. Utan rapportdatum sätter appen det till idag, med ett meddelande. Är en uppgift planerad att börja först efter rapportdatumet och har ingen verklig start ännu, kommer först en fråga om den verkliga starten. Avbryter du den, ändras ingenting. Se [Uppdatera framdrift](docs://howto-voortgang-bijwerken).

**Prioritet ▸** — en undermeny med *Låg* (100), *Normal* (500) och *Hög* (900), utjämningsprioriteten för uppgiften. Det aktuella värdet har en bockmarkering. Se [Resursutjämning](docs://uitleg-nivelleren).

**Spåra drivkedja** — visar föregående och efterföljande uppgifter för den här uppgiften. Är spårningen redan på, heter posten *Sluta spåra drivkedja*. Se [Spåra en drivkedja](docs://howto-pad-traceren).

**Fäll ihop**, **Fäll ut** och **Spara gren som mall** — bara för en sammanfattningsuppgift. *Fäll ihop* och *Fäll ut* finns alltid båda, även om uppgiften redan är ihopfälld eller utfälld, och gäller hela omfånget. *Spara gren som mall* sparar uppgiften med dess underuppgifter och sambanden mellan dem som en WBS-mall. Se [Spara och infoga WBS-mallar](docs://howto-wbs-sjablonen).

**Ta bort** — tar bort uppgifterna i omfånget, med deras underuppgifter. Det finns ingen bekräftelse. Du får tillbaka dem med Ctrl+Z, ett steg för hela omfånget. Se [Markera, ta bort och ångra uppgifter](docs://howto-taken-selecteren-verwijderen).

## Menyn för en grupprubrik

Den här menyn finns bara i uppgiftstabellen, på en grupprubrik:

**Fäll ihop grupp** eller **Fäll ut grupp** — fäller ihop eller ut bara den här gruppen. Posten visar vad du kan göra.

**Fäll ut alla** och **Fäll ihop alla** — fäller ut eller ihop alla grupper på en gång.

Du ställer in grupperingen med en layout. Se [Skapa och använda en layout](docs://howto-layouts-gebruiken).

## Se även

- [Dra, panorera och zooma i Gantt](docs://howto-gantt-bedienen): vad dragning med vänster och mellersta musknappen gör.
- [Menyfliksområdet, flik för flik](docs://ref-lint): knapparna med samma åtgärder.
- [Kortkommandon](docs://ref-sneltoetsen): tangenterna som hör till dem.
