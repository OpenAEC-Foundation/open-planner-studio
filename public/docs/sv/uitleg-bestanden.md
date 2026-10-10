# Filer och format

Vad finns egentligen i filen du sparar? Och vad händer med din tidsplan när du exporterar den till ett annat program? I den här artikeln läser du hur appen hanterar filer: IFC som eget format, de andra formaten som översättare, vad en export lämnar kvar och hur sparande, automatisk sparning och kraschskydd skiljer sig åt. Exemplet sist visar med siffror vad en export gör.

## Konceptet

Open Planner Studio har ett eget filformat: **IFC**, ett öppet utbytesformat för byggnadsinformation från buildingSMART. Appen skriver IFC 4.3. I exportlistan heter det *IFC 4x3*. Det finns inget annat, proprietärt projektformat. *Spara* skriver hela ditt projekt som en IFC-fil (`.ifc`). *Öppna* läser en sådan fil tillbaka. Vill du se vad filen innehåller? Fliken *IFC* visar IFC-texten för ditt projekt. *Generera IFC* uppdaterar den texten.

Alla andra format är **adaptrar**: översättare mellan modellen i ett annat program och modellen i appen. Appen läser CSV, MS Project XML, Primavera P6 XML, MS Project-filer (`.mpp`) och Primavera-filer (`.xer`). Den skriver CSV, MS Project XML, Primavera P6 XML och två framdriftsblad. Du kan inte exportera till `.mpp` eller `.xer`.

Varför är den skillnaden viktig? En översättare kan bara ta med det som båda sidor känner till. IFC-filen i appen behåller allt som hör till ditt projekt. Alla andra format saknar en del av det. Den delen blir kvar.

## Så hanterar appen filer

### Vad öppnandet gör

Appen väljer läsare efter filändelsen: `.ifc`, `.csv`, `.xml`, `.mpp` eller `.xer`. Med en `.xml`-fil kontrollerar appen i filen om det är MS Project XML eller Primavera P6 XML. En okänd filändelse behandlas som IFC. Om filen inte är IFC visar appen *Det gick inte att öppna filen*, med orsaken.

Varje fil öppnas i en egen flik. Undantaget är en flik som fortfarande är tom och oförändrad: den fliken tar över filen. En enda Primavera-fil kan ge flera flikar, en för varje projekt som har uppgifter.

Efter öppning beräknar appen alltid om. Om filen kommer från ett annat program kan datumen skilja sig från vad filen sa. Det beskrivs i [Datum så som de sparats](docs://uitleg-datums-zoals-opgeslagen).

Bara en IFC-fil blir **målfil för sparning**: filen som *Spara* skriver tillbaka till. En CSV-, XML-, `.mpp`- eller `.xer`-fil gör inte det. Ett sådant projekt har ingen fil efter öppning. *Spara* frågar då var den nya IFC-filen ska ligga. Så skriver Ctrl+S aldrig över din ursprungliga fil med IFC-text.

### Vad sparandet skriver

*Spara* skriver alltid hela projektet. Det här ingår:

- uppgifter med struktur, varaktighet, datum och framdrift;
- samband med fördröjning, restriktioner och måldatum;
- kalendrar, resurser och tilldelningar, inklusive kurvorna;
- baslinjer, uppgiftskoder, egna fält och anteckningar;
- externa samband till andra projekt;
- projektinställningarna, till exempel rapportdatumet, beräkningsprofilen och beräkningsalternativen;
- länken till ett bibliotek.

Det du ställer in på skärmen hör inte till projektet och följer inte med: zoom, scrollposition, den valda uppgiften och hopfällda faser. Dina appinställningar, till exempel språk och tema, står inte heller i filen. Appen sparar dem själv, i appen eller i din webbläsare.

En export till ett annat format rör inte ditt projekt. Efter en export har projektet kvar samma målfil. Det är fortfarande *Ej sparad* om det var det innan.

### Vad en export förlorar

Varje adapter tar med det som dess format känner till.

**MS Project XML** tar med uppgifter, samband, kalendrar, resurser, tilldelningar, restriktioner, måldatum och rapportdatum. Av dina baslinjer följer bara den aktiva med. Uppgiftskoder, egna fält, anteckningar och externa samband följer inte med. En andra restriktion på en uppgift följer inte med. En restriktion *Måste starta på (MSO)* eller *Måste slutföras på (MFO)* utan valet *Obligatorisk (pinlogik)* kommer tillbaka som *Starta tidigast (SNET)* eller *Avsluta tidigast (FNET)*. *Manuellt schemalagd* och *Förskjutning pga utjämning* för en uppgift kommer inte tillbaka. En hängmatta blir en vanlig uppgift med beräknade datum.

**Primavera P6 XML** tar med uppgifter, samband, kalendrar, resurser, tilldelningar, restriktioner och rapportdatum. Baslinjer och måldatum följer inte med, inte heller uppgiftskoder, egna fält, anteckningar och externa samband. Även här blir en hängmatta en vanlig uppgift. P6 har ingen fördröjning i procent: appen omvandlar en sådan fördröjning till ett fast antal dagar. En fördröjning i kalenderdagar blir en fördröjning i arbetsdagar.

**CSV** är en uppgiftslista. Filen har dessa kolumner för varje uppgift: uppgifts-id, WBS, nivå, namn, varaktighet, start, slut, föregående, typ, id för en egen uppgiftstyp (`OPS Custom Task Type ID`), status, slutförandegrad, verklig start och slut, kritisk, totalt slack och beskrivning. Resurser, tilldelningar, kalendrar, restriktioner, måldatum, baslinjer och rapportdatum finns inte i den. Kolumnrubrikerna är alltid på engelska.

**Bara IFC tar med beräkningsprofilen och beräkningsalternativen.** Exporterar du till CSV, MS Project XML eller Primavera P6 XML finns profilen inte i filen. Av beräkningsalternativen skriver MS Project XML högst det kritiska tröskelvärdet. En sådan fil öppnas igen som *Open Planner Studio*. Har ditt projekt beräknats med *Primavera P6* eller *Microsoft Project*, till exempel för att det kom från en `.xer` eller `.mpp`, kan datumen förskjutas av det. Vad en beräkningsprofil är, förklaras i [Beräkningsprofiler och beräkningsregler](docs://uitleg-rekenprofielen).

Kommer ditt projekt från en Primavera-fil (`.xer`), även om du sparade det som IFC emellan, då visar appen efter en export till CSV, MS Project XML eller P6 XML: *Export till CSV gör att XER-källinformation går förlorad.* För MS Project XML står det *Export till MSPDI* i stället för *Export till CSV*, för P6 XML står det *Export till P6*. För IFC visas inte det meddelandet: IFC-filen tar med Primaveras källfil. Se [Öppna en Primavera P6-fil (.xer)](docs://howto-xer-openen).

Appen gör två saker till vid en export. Är tidsplanen föråldrad, beräknar den först om och exporterar sedan. Och appen exporterar inte en tidsplan med ett cirkulärt samband: du får ett meddelande med slingan, till exempel *Cirkulärt samband mellan uppgifter: Set up site → Demolish existing extension → Set up site*.

### Spara, automatisk sparning och kraschskydd

Det här är tre olika saker. De liknar varandra, men de skriver till olika platser.

**Spara** gör du själv. Appen skriver projektet till din fil och tar bort markeringen *Ej sparad*.

**Automatisk sparning** är av som standard. Du slår på den själv för varje projekt. Appen skriver då till samma fil när det finns ändringar, utan att något fönster visas, högst en gång per tio sekunder. Det fungerar bara om projektet redan har en fil. Se [Att slå på automatisk sparning](docs://howto-automatisch-opslaan).

**Kraschskydd** är alltid på. Så snart något ändras någonstans sparar appen, högst en gång per tio sekunder, en återställningskopia av alla öppna projekt. Det gäller även projekt som du inte ändrade själv. Kopian finns inte i din projektfil: i skrivbordsappen ligger den i appens datamapp, i webbläsaren i webbläsarens lagring. Vid nästa start erbjuder appen den kopian. Du läser om det i [Återställa efter en krasch](docs://howto-herstellen-na-een-crash). Kraschskyddet skriver aldrig till din projektfil.

Eftersom en kopia sparas högst en gång per tio sekunder kan du förlora de sista sekunderna av arbete vid en krasch.

### Skrivbord och webbläsare

Skrivbordsappen och webbversionen gör likadant med ditt projekt, men de skriver filer på olika sätt.

På skrivbordet arbetar appen med riktiga sökvägar. *Spara* skriver direkt till din fil. Vanligtvis skriver appen först till en tillfällig fil bredvid den (`.ops-save.tmp`) och ersätter sedan din fil. Så kan en krasch mitt i skrivningen inte förstöra din gamla fil. Stänger du appen med ändringar, frågar den för varje projekt om du vill spara. Vid en normal avslutning rensar appen sina återställningskopior.

I en webbläsare som kan spara filer var som helst (till exempel Chrome och Edge) får du ett vanligt öppna- och sparafönster. Därefter skriver *Spara* direkt till filen. För en fil du öppnat frågar webbläsaren en gång om tillstånd. Listan *Senaste* fungerar, men visar bara filnamnen.

I en webbläsare utan den förmågan (till exempel Firefox) öppnar appen en fil via filväljaren och sparar via en nedladdning. Med *Spara* förklarar meddelandet *Sparad som nedladdning: 'name.ifc' finns i din nedladdningsmapp. …* detta en gång per session. Med *Spara som* och exporter ser du *Sparad som nedladdning: 'name.ifc' finns nu i din nedladdningsmapp. Den här miljön tillåter inte att appen skriver direkt till platsen du valde.* Kan webbläsaren visa ett sparafönster men inte skriva tillbaka till projektets fil, frågar *Spara* varje gång efter en plats igen. Ett meddelande förklarar det också en gång per session. *Fil › Senaste* finns, men öppnar en tom sida, och automatisk sparning finns inte. Du får samma meddelande i alla miljöer som inte tillåter att appen skriver till platsen du valde.

## Exempel: exportera exempelprojektet

Använd exemplet *Refurbishment & Extension of a Family Home* (*Fil › Exempel*). Det har 20 uppgifter, varav 4 faser och 2 milstolpar, och 16 samband. Det finns 6 resurser med 8 tilldelningar, 1 baslinje och en länk till *Demo resource library*. Uppgiften *Demolish existing extension* har restriktionen *Starta tidigast (SNET)* den 14 maj 2027, och *Handover inspection* har ett måldatum den 29 juli 2027. Tidsplanen slutar den 7 juli 2027.

Så här kommer projektet tillbaka från varje format, mätt efter att exportfilen öppnats igen:

- IFC-filen ger allt tillbaka: 20 uppgifter, 16 samband, 6 resurser, 8 tilldelningar, baslinjen, restriktionen, måldatumet och länken till biblioteket. Tidsplanen slutar igen den 7 juli 2027.
- MS Project XML-filen ger också allt tillbaka, utom länken till biblioteket. Tidsplanen slutar den 7 juli 2027.
- P6 XML-filen ger tillbaka uppgifterna, sambanden, resurserna, tilldelningarna och restriktionen. Baslinjen och måldatumet saknas. Tidsplanen slutar fortfarande den 7 juli 2027, eftersom restriktionen fortfarande finns med.
- CSV-filen ger tillbaka 20 uppgifter och 16 samband. Resurser, tilldelningar, baslinje, restriktion och måldatum saknas, och projektet heter *CSV Import*. Utan restriktionen flyttas uppgifterna framåt: tidsplanen slutar den 2 juli 2027, fem kalenderdagar tidigare.

Utan den restriktionen slutar exemplet självt också den 2 juli 2027. Skillnaden beror alltså på restriktionen som CSV-filen inte bär med sig.

## Följder och missförstånd

**En export är ingen backup.** Bara IFC behåller allt. Vill du behålla ditt projekt, spara det som IFC. Exportera bara för någon som behöver det andra formatet.

**Att öppna en export igen ger inte alltid samma tidsplan.** Appen beräknar alltid om vid öppning, med den beräkningsprofil som hör till formatet. Saknas logik, till exempel restriktionen i CSV-exemplet, eller beräknar profilen på ett annat sätt, då ändras resultatet.

**En export finns också i *Senaste*.** På skrivbordet och i webbläsare med filåtkomst hamnar en export i *Senaste*, precis som ett sparat projekt (framdriftsbladen gör inte det). Öppnar du den därifrån, öppnas den som en import av det formatet.

**Spara är inte samma sak som kraschskydd.** Kraschskyddet hjälper efter en krasch, men ersätter inte sparandet. Spara därför innan du stänger en flik eller appen.

## Se även

- [Att öppna och spara en fil](docs://howto-bestand-openen-en-opslaan): stegen för öppna, spara och spara som.
- [Exportera](docs://howto-exporteren): att välja ett format och vad du får.
- [Datum så som de sparats](docs://uitleg-datums-zoals-opgeslagen): varför en importerad tidsplan kan visa andra datum.
- [Restriktioner och måldatum](docs://uitleg-constraints): vad en restriktion gör, och vad som försvinner om den saknas.
- [Samband och fördröjning](docs://uitleg-relaties): vad en fördröjning är och hur appen beräknar den.
- [Skapa en hängmatta](docs://howto-hammock): vad en hängmatta är, som en export skriver som en vanlig uppgift.
- [Koder och egna fält](docs://howto-codes-en-velden): uppgiftskoder och egna fält, som bara IFC behåller.
- [Externa samband till ett annat projekt](docs://howto-externe-relaties): samband som MS Project XML och P6 XML inte tar med.
- [Spara och hantera en baslinje](docs://howto-baseline-opslaan-en-beheren): baslinjer, av vilka MS Project XML bara tar med den aktiva.
- [Import- och exportformat](docs://ref-import-exportformaten): per format vad som tas med och vad som inte tas med.
