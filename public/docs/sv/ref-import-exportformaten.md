# Import- och exportformat

Per filformat: om du kan öppna, spara och exportera det, vad som följer med och inte, och med vilken beräkningsprofil det öppnas. Bakgrunden och ett exempel med siffror står i [Filer och format](docs://uitleg-bestanden).

## Översikt

**Öppning** fungerar med IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` och `.xer`. En fil med en annan filändelse behandlas av appen som IFC.

**Sparning** skriver alltid IFC. Bara en öppnad IFC-fil blir den fil som *Spara* använder. Ett projekt från ett annat format har ingen fil efter öppning, och *Spara* frågar då var IFC-filen ska sparas.

**Export** fungerar med IFC 4x3, MS Project XML, Primavera P6 XML, CSV och två framdriftsblad (Excel och CSV). En export ändrar inte ditt projekt.

**Skrivskyddade** är `.mpp` och `.xer`: appen kan öppna dem, men inte skriva dem.

**PDF** kommer bara från en rapport (se [Rapporttyper](docs://ref-rapporttypes)). Appen läser inte PDF.

**Var.** Öppning: *Start › Fil › Öppna*, *Fil › Öppna* eller Ctrl+O. Export: *Start › Fil › Exportera* eller *Fil › Exportera*. Du läser in ett ifyllt framdriftsblad via *Fil › Importera*, eller med knappen *Uppdatera framdrift från ett kalkylblad* i menyfliksområdets grupp *Framdrift* på flikarna *Tidsplan*, *Tabell* och *Rapport*.

**Beräkningsprofil vid öppning.** Varje format öppnas med en beräkningsprofil. Vad den är beskrivs i [Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies). `.xer` öppnas med *Primavera P6*, `.mpp` med *Microsoft Project*, och CSV, MS Project XML och P6 XML med *Open Planner Studio*. IFC behåller profilen som finns i filen. För `.xer` och `.mpp` meddelar appen att projektet räknar ut på det här sättet. Bara IFC innehåller beräkningsprofilen och beräkningsalternativen. Av beräkningsalternativen skriver MS Project XML högst det kritiska tröskelvärdet. En export i ett annat format, som öppnas igen, räknas ut som *Open Planner Studio*.

## IFC

**Öppna** — ja, `.ifc`. Appen läser IFC 4.3. Beräkningsprofil: den som finns i filen.

**Spara** — ja, och det är det enda format du kan spara i. *Spara* skriver hela ditt projekt som en IFC-fil. Filen blir den fil som *Spara* använder.

**Export** — ja, som *IFC 4x3* (beskrivet som *BuildingSMART-standard. 4D-koppling med BIM-modeller.*). Standardnamnet är projektnamnet med filändelsen `.ifc`. Om ditt projekt är kopplat till ett bibliotek står kryssrutan *Spara biblioteksfilen bredvid* under korten i *Fil › Exportera*. När den är ikryssad frågar appen efter en plats för *projectname-bibliotheek.ifc*, efter projektet. Kryssrutan finns inte i listan på fliken *Start*.

**Vad följer med** — allt som hör till projektet: uppgifter med struktur, varaktighet, datum och framdrift; samband med fördröjning; restriktioner och måldatum; kalendrar; resurser och tilldelningar, inklusive timfördelningen; baslinjer; uppgiftskoder och egna fält; anteckningar; externa samband till andra projekt; avbrott; arbetsregler och uppgiftstyper; projektinställningarna, till exempel rapportdatumet, framdriftsläget, beräkningsprofilen och beräkningsalternativen; kopplingen till ett bibliotek. För ett projekt från en `.xer` följer även den ursprungliga källfilen med. En egen uppgiftstyp sparas som IFC-typen `USERDEFINED` med sitt namn i fältet ObjectType, så att andra IFC-program läser uppgiften normalt. Appen behåller också typens fasta id, så att ett namnbyte inte bryter kopplingen. Om någon öppnar filen på en annan dator visas typen där under *Från det här projektet*, inte under deras egna *Mina uppgiftstyper*.

**Vad följer inte med** — hur du har ställt in skärmen (zoom, rullningsposition, vald uppgift, ihopfällda faser, valt filter och vald gruppering) och appinställningarna ([Inställningar](docs://ref-instellingen)). Fliken *IFC* visar IFC-texten för ditt projekt.

## MS Project XML (MSPDI)

**Öppna** — ja. Appen känner igen en `.xml`-fil som MS Project XML på rotelementet `Project` i MS Project-namnrymden (eller utan namnrymd). Beräkningsprofil: *Open Planner Studio*.

**Spara** — nej. Ett sådant projekt får ingen fil som *Spara* använder.

**Export** — ja, som *MS Project XML* (*Öppnas i Microsoft Project. Fullständig WBS-struktur.*). Standardnamnet är projektnamnet med `.xml`.

**Vad följer med** — uppgifter med struktur (nivå och WBS), varaktighet, datum och framdrift; samband med fördröjning, även i timmar eller procent; restriktioner, inklusive måldatum; kalendrar, inklusive uppgiftskalendrar och resurskalendrar; resurser och tilldelningar, inklusive fördelningskurvan eller timfördelningen; rapportdatumet; det kritiska tröskelvärdet, som ett heltal på 0 eller fler arbetsdagar, med *Totalt slack ≤ tröskelvärde*; beskrivningen av en uppgift (som en anteckning); arbetsregeln för en uppgift (som MS Project-uppgiftstyp); en egen uppgiftstyp, i ett fritt fält (`ExtendedAttribute`) som appen läser tillbaka och som MS Project kan ignorera. Av dina baslinjer följer bara den aktiva med, som baslinje 0. En uppgift i timmar behåller sin enhet, och en milstolpe behåller sin typ (start, slut eller automatisk).

**Vad följer inte med** — anteckningar (checklistan på en uppgift), externa samband till andra projekt, uppgiftskoder och egna fält, en andra restriktion, markeringen *Manuellt schemalagd*, förskjutningen pga utjämning, återupptagnings- och stoppunkten för en uppgift med framdrift i fel ordning, beräkningsreglerna *Återstående arbete återupptas efter den förflutna tiden* och *Ej påbörjade uppgifter flyttas inte till rapportdatumet* i en MS Project-profil, och de övriga beräkningsalternativen. Uppgifter med avbrott utan timfördelning följer med, men utan sina avbrott.

**Vad ändras på vägen** — en restriktion *Måste starta på (MSO)* eller *Måste slutföras på (MFO)* utan valet *Obligatorisk (pinlogik)* blir *Starta tidigast (SNET)* eller *Avsluta tidigast (FNET)*. En hängmatta blir en vanlig uppgift med beräknade datum.

## MS Project-fil (`.mpp`)

**Öppna** — ja, från MS Project 2010 till och med 2021. Beräkningsprofil: *Microsoft Project*. Appen läser bara filen: den ändrar aldrig din `.mpp`. Appen vägrar att öppna en fil från MS Project 2007 eller äldre, och en lösenordsskyddad fil, med ett meddelande som hänvisar till XML-exporten från MS Project.

**Spara** — nej, och det finns ingen fil som *Spara* använder: *Spara* skriver en ny IFC-fil.

**Export** — nej.

**Vad följer med** — uppgifter med struktur, varaktighet och restriktioner; samband med fördröjning; kalendrar; resurser och tilldelningar; framdrift; en WBS-kod som du själv fyllde i i MS Project. Datum och slack som MS Project räknade ut själv läses också in, för vyn *Datum som sparats*.

**Vad följer inte med** — baslinjer, kostnader och standardkostnader, anteckningar och egna fält i MS Project. Se [Öppna en MS Project-fil (.mpp)](docs://howto-mpp-openen).

**Ursprung och licens** — `.mpp`-läsaren skrevs för Open Planner Studio och är härledd från källkoden och strukturkunskapen i MPXJ (`github.com/joniles/mpxj`, Jon Iles m.fl.), ett Java-bibliotek under LGPL-2.1. Struktur och fältkonstanter porterades till TypeScript. Open Planner Studio självt är öppen källkod under LGPL-3.0. `.xer`-läsaren är inte en härledning: MPXJ användes där bara som källa för förståelse.

## Primavera P6 XML

**Öppna** — ja. Appen känner igen en `.xml`-fil som P6 XML på rotelementet `APIBusinessObjects`. Beräkningsprofil: *Open Planner Studio*.

**Spara** — nej.

**Export** — ja, som *Primavera P6 XML* (*För Oracle Primavera P6.*). Standardnamnet är projektnamnet med `.xml`, alltså samma namn som en MS Project XML-export: ge dem olika namn själv.

**Vad följer med** — WBS-struktur och uppgifter med varaktighet, datum och framdrift; samband med fördröjning; restriktioner (även en andra, som mjuk restriktion); kalendrar; resurser och tilldelningar; rapportdatumet (som `DataDate`); en egen uppgiftstyp, i ett eget fält, `OPS Custom Task Type`, som appen läser tillbaka och som P6 kan ignorera.

**Vad följer inte med** — baslinjer och måldatum; uppgiftskoder, egna fält, anteckningar och externa samband; beräkningsalternativen; ett undantag i arbetskalendern (ett undantag som gör en dag till en arbetsdag). P6 har ingen fördröjning i procent: appen omvandlar den till ett fast antal dagar. En fördröjning i kalenderdagar blir en fördröjning i arbetstid: 3 kalenderdagar blir 3 arbetsdagar. En hängmatta blir en vanlig uppgift, en manuellt schemalagd uppgift blir en vanlig uppgift med beräknade datum, och en förskjutning pga utjämning på mindre än en dag tas bort.

## Primavera-fil (`.xer`)

**Öppna** — ja. Beräkningsprofil: *Primavera P6*. Appen läser bara filen: den skriver inte `.xer` och ändrar aldrig din fil. Den öppnar en flik per projekt med uppgifter. En fil utan uppgifter eller med skadade tabeller vägrar appen att öppna, med ett meddelande.

**Spara** — nej, och det finns ingen fil som *Spara* använder: *Spara* skriver en ny IFC-fil, med den ursprungliga `.xer`-filen inuti.

**Export** — nej. Om du exporterar ett projekt från en `.xer` till CSV, MS Project XML eller P6 XML, meddelar appen att XER-källinformation går förlorad, även om du har sparat projektet som IFC emellan. Till IFC förloras inget.

**Vad följer med** — WBS-strukturen och uppgifter med varaktighet, datum, restriktioner och framdrift; samband med fördröjning; kalendrar; resurser med tilldelningar; uppgiftskoder; egna fält (UDF:er); anteckningar; tidsplaneringsinställningarna i P6. En uppgift av typen *Level of Effort* blir en hängmatta. Ett baslinjeprojekt blir den aktiva baslinjen i projektet som hänvisar till det. Ett samband mellan två projekt behålls av appen som källdata.

**Vad följer inte med** — ett projekt utan uppgifter, och ett samband mellan två projekt som ett riktigt samband i din tidsplan. Se [Öppna en Primavera P6-fil (.xer)](docs://howto-xer-openen).

## CSV

**Öppna** — ja. Appen använder `;` och `,` som separator. Den känner igen kolumnrubriker på engelska och nederländska (till exempel `Name` eller `Naam`, `Duration` eller `Duur`, `Predecessors` eller `Voorgangers`). Datum kan vara *åååå-mm-dd*, *dd-mm-åååå* eller *dd/mm/åååå*. Du skriver en föregående uppgift som WBS-kod, sambandstyp och fördröjning, till exempel `1.2FS+2d`. Beräkningsprofil: *Open Planner Studio*. Projektet heter *CSV Import*. En `Task Type` som inte är någon av de fasta koderna (till exempel `CONSTRUCTION` eller `INSTALLATION`, som appen skriver själv) blir en egen uppgiftstyp under *Från det här projektet*, inte under *Mina uppgiftstyper*. Med `OPS Custom Task Type ID` behålls id:t för en egen uppgiftstyp.

**Spara** — nej.

**Export** — ja, som *CSV (;)* (*Universell tabellexport. Alla uppgifter med datum och varaktighet.*), på kortet *CSV (semikolonseparerad)*. Filen använder semikolon som separator, är i UTF-8 med BOM och har engelska kolumnrubriker.

**Vad följer med** — per uppgift finns dessa kolumner: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` och `Description`. Slutförandegraden anges i hela procent.

**Vad följer inte med** — resurser, tilldelningar, kalendrar, restriktioner, måldatum, baslinjer och rapportdatumet. Om datumen visas i vyn *Datum som sparats* lämnar exporten `Critical` och `Total Float` tomma för uppgifter vars källfil inte sparade det.

## Framdriftsblad (Excel och CSV)

**Öppna** — ja, via *Fil › Importera* (*Uppdatera framdrift från ett kalkylblad*) eller via knappen med samma namn i menyfliksområdets grupp *Framdrift* på flikarna *Tidsplan*, *Tabell* och *Rapport*. Appen läser `.xlsx` och `.csv`, upp till 16 MB och 50 000 rader. Det här öppnar inget projekt: det uppdaterar framdriften i ditt öppna projekt. Se [Importera framdrift från ett kalkylblad](docs://howto-voortgang-importeren).

**Spara** — nej.

**Export** — ja, som *Framdriftsblad (Excel)* (*Framdrift (Excel)* i listan) och *Framdriftsblad (CSV)* (*Framdrift (CSV)*). Standardnamnet är *projectname-voortgang*. Knappen *Exportera framdriftsblad* i samma grupp skapar Excel-bladet med ett enda klick. Excel-bladet har fasta kolumnbredder, låsta fält och datumkontroll. CSV-bladet har samma innehåll som vanlig text.

**Vad följer med** — kolumnerna `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` och `Actual Finish`. Vid inläsning använder appen `Completion (%)`, `Actual Start` och `Actual Finish`. `Start` och `Finish` används bara för att känna igen datumnotationen och ändrar inte din tidsplan. Appen kopplar rader till uppgifter med `OPS Task ID`, eller annars med en unik WBS-kod.

**Vad följer inte med** — allt utanför dessa kolumner: varaktighet, samband, resurser och resten av din tidsplan. En sammanfattningsuppgift får ingen framdrift från bladet.

## PDF

**Öppna** — nej.

**Spara** — nej.

**Export** — ja, från en rapport: på fliken *Rapport* med knappen *Exportera PDF*. Appen skickar inte en rapport till en skrivare själv. Vägen till papper går via PDF:en. Innehållet beror på rapporttypen: se [Rapporttyper](docs://ref-rapporttypes) och [Skapa och skriva ut en rapport](docs://howto-rapport-maken-en-afdrukken).

## Se även

- [Filer och format](docs://uitleg-bestanden): varför IFC är appens eget format och vad en export förlorar, med ett exempel.
- [Öppna och spara en fil](docs://howto-bestand-openen-en-opslaan): stegen.
- [Exportera](docs://howto-exporteren): välja ett format och meddelandena efter en export.
- [Datum som sparats](docs://uitleg-datums-zoals-opgeslagen): varför en öppnad fil kan visa andra datum.
- [Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies): beräkningsprofilerna.
