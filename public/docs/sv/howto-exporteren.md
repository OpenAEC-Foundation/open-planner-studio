# Exportera

Mål: lämna över din tidsplan som en fil i ett annat format, för någon som inte läser IFC eller för ett annat program.

## När du behöver det

Konsulten arbetar i MS Project. Kunden arbetar i Primavera. Underleverantören vill ha uppgifterna i Excel. Eller så skickar du en tidsplan till ett program som inte klarar IFC. En export är en kopia i ett annat format. Vill du behålla projektet sparar du det. Då sparas det som IFC, och allt följer med. Vad varje format bär med sig, och vad inte, står i [Filer och format](docs://uitleg-bestanden).

## Steg

1. Välj *Start › Fil › Exportera* och välj sedan ett format i listan, eller välj *Fil › Exportera*. Där är varje format ett kort med en kort beskrivning.
2. I fönstret väljer du ett namn och en plats. Appen föreslår projektnamnet, med filändelsen för formatet. Framdriftsbladen heter *projektnamn-framdrift* och öppnas i din nedladdningsmapp där det går.
3. Bekräfta. Om exporten lyckas visas inget meddelande, utom de meddelanden nedan. Efteråt går du från *Fil › Exportera* tillbaka till fliken *Start*, även om du avbryter fönstret. Avbryter du fönstret för en export från listan på fliken *Start* händer ingenting.

Om din webbläsare bara sparar via en nedladdning, till exempel Firefox, finns filen direkt efter steg 1 i din nedladdningsmapp. Du ser meddelandet *Sparad som nedladdning: 'name.xml' finns nu i din nedladdningsmapp. Den här miljön tillåter inte att appen skriver direkt till platsen du valde.*

### Vilket format väljer du?

Listan på fliken *Start* och korten i *Fil › Exportera* erbjuder samma format:

- *Framdrift (Excel)* och *Framdrift (CSV)*, på korten *Framdriftsblad (Excel)* och *Framdriftsblad (CSV)*: ett enkelt blad med id, WBS, namn, datum och slutförandegrad, som du skickar runt till den som fyller i framdriften.
- *CSV (;)*, på kortet *CSV (semikolonseparerad)*: en uppgiftstabell som du öppnar i ett kalkylblad.
- *MS Project XML*: kan öppnas i Microsoft Project.
- *Primavera P6 XML*: för Oracle Primavera P6.
- *IFC 4x3*: appens eget format, med allt i sig.

### En IFC-export med en biblioteksfil

Är ditt projekt kopplat till ett bibliotek med resurser, står kryssrutan *Spara biblioteksfilen bredvid* under korten i *Fil › Exportera*. Markerar du den och väljer *IFC 4x3* frågar appen två gånger efter en plats: först för projektet, sedan för *projektnamn-bibliotek.ifc*. Kryssrutan finns bara i *Fil › Exportera*, inte i listan på fliken *Start*.

### Läsa in ett framdriftsblad igen

Du läser in ett ifyllt framdriftsblad igen via *Fil › Importera*. Se [Importera framdrift från ett kalkylblad](docs://howto-voortgang-importeren).

## Fallgropar och vad appen gör då

**Ditt projekt ändras inte.** Projektets fil är densamma, och markeringen *Ej sparad* finns kvar om den var där.

**En föråldrad tidsplan beräknas om först.** Då får du de aktuella datumen, även om du glömde att trycka på *Beräkna*.

**En export finns också under Senaste.** Det gäller inte för framdriftsbladen. Öppnar du en export där, öppnas den som en import av det formatet.

**En export bär inte allt med sig.** En CSV-fil har inga resurser eller restriktioner. P6 XML har inga baslinjer och inga måldatum. Beräkningsprofilen följer inte med heller: en återöppnad export beräknas som *Open Planner Studio*. Bara IFC bär med sig allt. Ett exempel med siffror hittar du i [Filer och format](docs://uitleg-bestanden).

**Två format med samma filändelse.** MS Project XML och Primavera P6 XML får båda namnet *projektnamn.xml*. Ge dem olika namn själv. Annars vet du senare inte vilken fil som är vilket format.

**En tidsplan med ett cirkulärt samband exporteras inte.** Appen beräknar först och stoppar om det finns en slinga. På fliken *Start* ser du meddelandet *Tidsplanen kunde inte beräknas*, och under det till exempel *Cirkulärt samband mellan uppgifter: Set up site → Demolish existing extension → Set up site*. I *Fil › Exportera* visas bara den andra texten. Lös slingan och exportera igen.

**Ett projekt från Primavera förlorar källinformation.** Exporterar du ett sådant projekt till CSV, MS Project XML eller P6 XML, meddelar appen: *Export till CSV gör att XER-källinformation går förlorad.* För MS Project XML står det *MSPDI*, för P6 XML *P6*. Se [Öppna en Primavera P6-fil (.xer)](docs://howto-xer-openen).

**Delade uppgifter förlorar sina delningar.** MS Project och Primavera känner bara till en delning som en timfördelning. Innehåller ditt projekt delade uppgifter utan timfördelning, meddelar appen efter en export till MS Project XML eller P6 XML: *2 uppgifter med avbrott exporterades utan sina avbrott: MS Project och P6 känner bara till avbrott som en arbetsfördelning.* För en uppgift står det *1 uppgift med avbrott exporterades utan avbrotten: MS Project och P6 känner bara till avbrott som en arbetsfördelning.* Se [Dela en uppgift](docs://howto-taak-splitsen).

**En tidsplan i vyn *Datum som registrerats*.** Exporterar du till CSV medan du ser datumen från källfilen, lämnar appen `Critical` och `Total Float` tomma för uppgifter där källfilen inte registrerade det. Se [Datum som registrerats](docs://uitleg-datums-zoals-opgeslagen).

## Se även

- [Filer och format](docs://uitleg-bestanden): vad varje format bär med sig och vad inte.
- [Öppna och spara en fil](docs://howto-bestand-openen-en-opslaan): ditt projekt sparas som IFC.
- [Importera framdrift från ett kalkylblad](docs://howto-voortgang-importeren): läsa in ett ifyllt framdriftsblad.
- [Import- och exportformat](docs://ref-import-exportformaten): per format vad som följer med och vad som inte gör det.
