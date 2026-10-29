# Import- och exportformat

Per filformat: om du kan öppna, spara och exportera det, vad som följer med och inte, och med vilken beräkningsprofil det öppnas. Bakgrunden och ett exempel med siffror står i [Filer och format](docs://uitleg-bestanden).

## Översikt

**Öppning** fungerar med IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` och `.xer`. En fil med en annan filändelse behandlas av appen som IFC.

**Sparning** skriver alltid IFC. Bara en öppnad IFC-fil blir den fil som *Spara* använder. Ett projekt från ett annat format har ingen fil efter öppning, och *Spara* frågar då var IFC-filen ska sparas.

**Export** fungerar med IFC, MS Project XML, Primavera P6 XML, CSV och två framdriftsblad (Excel och CSV). En export ändrar inte ditt projekt.

**Skrivskyddade** är `.mpp` och `.xer`: appen kan öppna dem, men inte skriva dem.

**PDF** kommer bara från en rapport (se [Rapporttyper](docs://ref-rapporttypes)). Appen läser inte PDF.

**Var.** Öppning: *Start › Fil › Öppna*, *Fil › Öppna* eller Ctrl+O. Export: *Start › Fil › Exportera* eller *Fil › Exportera*. Du läser in ett ifyllt framdriftsblad via *Fil › Importera*, eller med knappen *Uppdatera framdrift från ett kalkylblad* i menyfliksområdets grupp *Framdrift* på flikarna *Tidsplan*, *Tabell* och *Rapport*.

**Beräkningsprofil vid öppning.** Varje format öppnas med en beräkningsprofil. Vad det är står i [Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies). `.xer` öppnas med *Primavera P6*, `.mpp` med *Microsoft Project*, och CSV, MS Project XML och P6 XML med *Open Planner Studio*. IFC behåller profilen som finns i filen. För `.xer` och `.mpp` meddelar appen att projektet räknar ut på det här sättet. Bara IFC innehåller beräkningsprofilen och beräkningsalternativen. Av beräkningsalternativen skriver MS Project XML högst det kritiska tröskelvärdet. En export i ett annat format, som öppnas igen, räknas ut som *Open Planner Studio*.

## IFC

**Öppna** — ja, `.ifc`. Appen läser IFC4 och IFC 4.3 (även ADD2). En fil i ett annat schema, till exempel IFC2X3, öppnas också. Vid första sparningen väljer du sedan ett schema som appen kan skriva (se [Välja IFC-schema](docs://howto-ifc-schema-kiezen)). Beräkningsprofil: den som finns i filen.

**Spara** — ja, och det är det enda format du kan spara i. *Spara* skriver hela ditt projekt som en IFC-fil, i projektets IFC-schema (IFC 4.3 ADD2 som standard). Filen blir den fil som *Spara* använder.

**Export** — ja, som *IFC*, i projektets IFC-schema (standard IFC 4.3 ADD2). Standardnamnet är projektnamnet med filändelsen `.ifc`. Om ditt projekt är kopplat till ett bibliotek står kryssrutan *Spara biblioteksfilen bredvid* under korten i *Fil › Exportera*. Om den är ikryssad frågar appen efter en plats för *projectname-bibliotheek.ifc*, efter projektet. Kryssrutan finns inte i listan på fliken *Start*.

**Vad följer med** — allt som hör till projektet: uppgifter med struktur, varaktighet, datum och framdrift; samband med fördröjning; restriktioner och måldatum; kalendrar; resurser och tilldelningar, inklusive timfördelningen; baslinjer; uppgiftskoder och egna fält; anteckningar; externa samband till andra projekt; avbrott; uppgiftstyper och egna arbetskategorier; projektinställningarna, till exempel rapportdatumet, framdriftsläget, beräkningsprofilen och beräkningsalternativen; kopplingen till ett bibliotek. För ett projekt från en `.xer` följer även den ursprungliga källfilen med. En egen arbetskategori sparas som IFC-typen `USERDEFINED` med sitt namn i fältet ObjectType, så att andra IFC-program läser uppgiften normalt. Appen behåller också arbetskategorins fasta id, så att ett namnbyte inte bryter kopplingen. Om någon öppnar filen på en annan dator visas arbetskategorin där under *Från det här projektet*, inte under deras egna *Mina arbetskategorier*.

**Vad följer inte med** — hur du har ställt in skärmen (zoom, rullningsposition, vald uppgift, ihopfällda faser, valt filter och vald gruppering) och appinställningarna ([Inställningar](docs://ref-instellingen)). Fliken *IFC* är en redigerare med IFC-texten för ditt projekt. *Generera IFC* uppdaterar den, *Kopiera* lägger den på urklippet och *Tillämpa* läser in texten som ditt projekt och ersätter projektet på fliken.

## MS Project XML (MSPDI)

**Öppna** — ja. Appen känner igen en `.xml`-fil som MS Project XML på rotelementet `Project` i MS Project-namnrymden (eller utan namnrymd). Beräkningsprofil: *Open Planner Studio*. Efter öppning meddelar appen i ett enda meddelande vad den inte tog över. Se [Öppna en MS Project-fil (.mpp)](docs://howto-mpp-openen).

**Spara** — nej. Ett sådant projekt får ingen fil som *Spara* använder.

**Export** — ja, som *MS Project XML* (*Öppnas i Microsoft Project. Fullständig WBS-struktur.*). Standardnamnet är projektnamnet med `.xml`.

**Vad följer med** — uppgifter med struktur (nivå och WBS), varaktighet, datum och framdrift; samband med fördröjning, även i timmar eller procent; restriktioner, inklusive måldatum; kalendrar, inklusive uppgiftskalendrar och resurskalendrar; resurser och tilldelningar, inklusive fördelningskurvan eller timfördelningen; rapportdatumet; det kritiska tröskelvärdet, som ett heltal på 0 eller fler arbetsdagar, med *Totalt slack ≤ tröskelvärde*; beskrivningen av en uppgift (som anteckning); uppgiftstypen för en uppgift (som MS Project-uppgiftstyp); en egen arbetskategori, i ett fritt fält (`ExtendedAttribute`) som appen läser tillbaka och som MS Project kan ignorera. Av dina baslinjer följer bara den aktiva med, som baslinje 0. En uppgift i timmar behåller sin enhet, och en milstolpe behåller sin typ (start, slut eller automatisk).

**Vad följer inte med** — anteckningar (checklistan på en uppgift), externa samband till andra projekt, uppgiftskoder och egna fält, en andra restriktion, markeringen *Manuellt schemalagd*, förskjutningen pga utjämning, återupptagnings- och stoppunkten för en uppgift med framdrift i fel ordning, beräkningsreglerna *Återstående arbete återupptas efter den förflutna tiden* och *Ej påbörjade uppgifter flyttas inte till rapportdatumet* i en MS Project-profil, och de övriga beräkningsalternativen. Uppgifter med avbrott utan timfördelning följer med, men utan sina avbrott.

**Helgdagar vid öppning.** En härledd kalender ärver undantagen från sin baskalender. En kalender med en egen arbetsvecka och utan undantag får inga helgdagar. Bara en ren kalender, utan baskalender, arbetsvecka eller undantag, behåller de vanliga nederländska helgdagarna. Saknas helgdagar, då kan ditt slutdatum skilja sig: se [Generera helgdagar och byggsemestern](docs://howto-feestdagen-genereren).

**Vad ändras på vägen** — en restriktion *Måste starta på (MSO)* eller *Måste slutföras på (MFO)* utan valet *Obligatorisk (pinlogik)* blir *Starta tidigast (SNET)* eller *Avsluta tidigast (FNET)*. En hängmatta blir en vanlig uppgift med beräknade datum. MS Project XML lagrar timmarna per dag bara för projektkalendern. En annan kalender med egna timmar per dag får sin arbetstid som timmar per dag när du öppnar filen: 8 timmar per dag med arbetstider på 10 timmar blir 10. En uppgift i dagar på en sådan kalender blir då kortare, till exempel 4 dagar i stället för 5.

## MS Project-fil (`.mpp`)

**Öppna** — ja, från MS Project 2010 till och med 2021. Beräkningsprofil: *Microsoft Project*. Appen läser bara filen: den ändrar aldrig din `.mpp`. En fil från MS Project 2007 eller äldre, och en lösenordsskyddad fil, avvisar appen med ett meddelande som hänvisar till XML-exporten från MS Project. Efter öppning meddelar appen i ett enda meddelande vad den inte tog över.

**Spara** — nej, och det finns ingen fil som *Spara* använder: *Spara* skriver en ny IFC-fil.

**Export** — nej.

**Vad följer med** — uppgifter med struktur, varaktighet och restriktioner; samband med fördröjning; kalendrar; resurser och tilldelningar; framdrift; en WBS-kod som du själv fyllde i i MS Project. Datum och slack som MS Project räknade ut själv läses också in, för vyn *Datum som sparats*.

**Vad följer inte med** — baslinjer, kostnader och standardkostnader, anteckningar, hyperlänkar, de egna fälten i MS Project, kopplingen till delprojekt och externa uppgifter, och det kritiska tröskelvärdet. Se [Öppna en MS Project-fil (.mpp)](docs://howto-mpp-openen).

**Ursprung och licens** — `.mpp`-läsaren skrevs för Open Planner Studio och är härledd från källkoden och strukturkunskapen i MPXJ (`github.com/joniles/mpxj`, Jon Iles m.fl.), ett Java-bibliotek under LGPL-2.1. Struktur och fältkonstanter porterades till TypeScript. Open Planner Studio självt är öppen källkod under LGPL-3.0. `.xer`-läsaren är inte en härledning: MPXJ konsulterades där bara som källa för förståelse.

## Primavera P6 XML

**Öppna** — ja. Appen känner igen en `.xml`-fil som P6 XML på rotelementet `APIBusinessObjects`. Beräkningsprofil: *Open Planner Studio*.

**Flera projekt i en fil.** Varje projekt med uppgifter öppnas i en egen flik, med namnet *Projektnamn (Projekt-ID)*. Appen hoppar över ett projekt utan uppgifter. Den aktiva fliken är projektet med flest uppgifter. Appen tar inte med ett samband till ett annat projekt, och inte en uppgift som inte tillhör något projekt. Efter öppning meddelar appen hur många projekt den öppnade.

**Helgdagar vid öppning.** Samma regler gäller som för MS Project XML: en kalender med en egen arbetsvecka och inga undantag får inga helgdagar.

**Baslinjer.** En `<BaselineProject>` i filen blir en baslinje för sitt projekt. Baslinjen som P6 markerar som aktiv är också aktiv i appen.

**Takt för en tilldelning.** Om arbete återstår blir den återstående takten (`RemainingUnitsPerTime`) till *Enh./dag*. Annars blir det den planerade takten (`PlannedUnitsPerTime`). För material behålls den planerade takten. Appen beräknar inget om när den öppnar filen. Vid en export till P6 XML skriver den den planerade takten som `PlannedUnitsPerTime`. Den återstående takten skriver den som `RemainingUnitsPerTime` bara när tilldelningen har en egen planerad takt.

**Inga läsbara uppgifter.** Om appen inte hittar någon uppgift som den kan läsa, öppnar den ingen flik. Den meddelar det, med orsaken när den är känd. Exempel: uppgifter utan `ObjectId`, eller XER-kolumnnamn i en XML-fil. Exportera projektet från P6 igen som P6 XML, eller öppna det som `.xer`.

**Spara** — nej.

**Export** — ja, som *Primavera P6 XML* (*För Oracle Primavera P6.*). Standardnamnet är projektnamnet med `.xml`, med projekt-ID inom parentes om projektet har ett. En export till MS Project XML får samma namn: ge dem olika namn själv.

**Projektnamn och projekt-ID.** Appen håller projekt-ID från P6 åtskilt från projektnamnet, precis som för en `.xer`. *Projektinställningar* visar bara namnet, till exempel *Bid for Facility Extension*. Fliken visar *Bid for Facility Extension (OZB-05)*. Om du byter namn på projektet till *Hall extension* heter fliken *Hall extension (OZB-05)*. En export till P6 XML skriver *OZB-05* tillbaka som projekt-ID och *Hall extension* som namn. Så känner P6 igen projektet. Ett projekt från en `.xer` tar också med sitt projekt-ID. Projekt-ID finns kvar när du sparar projektet som IFC. Parenteser i själva namnet, som *New build (phase 2)*, behålls i namnet. Ett projekt utan projekt-ID får vid export ett eget unikt ID från appen, som börjar med *OPS:*.

**Vad följer med** — WBS-struktur och uppgifter med varaktighet, datum och framdrift; samband med fördröjning; restriktioner (även en andra, som mjuk restriktion); kalendrar; resurser och tilldelningar; rapportdatumet (som `DataDate`); en egen arbetskategori, i ett eget fält, `OPS Custom Task Type`, som appen läser tillbaka och som P6 kan ignorera.

**Vad följer inte med** — baslinjer och måldatum; uppgiftskoder, egna fält, anteckningar och externa samband; beräkningsalternativen; namnen på helgdagar. P6 har inget namn per ledig dag: efter att du öppnat igen heter en helgdag *Helgdag* och ett arbetsundantag *Arbetsundantag*. Lediga dagar i följd kommer tillbaka som ett intervall. Appen förkortar ett namn eller en kod som är längre än P6 tillåter: ett uppgiftsnamn till 120 tecken, ett uppgifts-ID eller en WBS-kod till 40, ett WBS- eller projektnamn till 100. Den meddelar hur många namn och koder den förkortade. P6 har ingen fördröjning i procent: appen omvandlar den till ett fast antal dagar. En fördröjning i kalenderdagar blir en fördröjning i arbetstid: 3 kalenderdagar blir 3 arbetsdagar. En hängmatta blir en vanlig uppgift, en manuellt schemalagd uppgift blir en vanlig uppgift med beräknade datum, och en förskjutning pga utjämning på mindre än en dag tas bort.

## Primavera-fil (`.xer`)

**Öppna** — ja. Beräkningsprofil: *Primavera P6*. Appen läser bara filen: den skriver inte `.xer` och ändrar aldrig din fil. Den öppnar en flik per projekt med uppgifter. En fil utan uppgifter eller med skadade tabeller vägrar appen att öppna, med ett meddelande.

**Spara** — nej, och det finns ingen fil som *Spara* använder: *Spara* skriver en ny IFC-fil, med den ursprungliga `.xer`-filen inuti.

**Export** — nej. Om du exporterar ett projekt från en `.xer` till CSV, MS Project XML eller P6 XML, meddelar appen att XER-källinformation går förlorad, även om du har sparat projektet som IFC emellan. Till IFC förloras inget.

**Vad följer med** — WBS-strukturen och uppgifter med varaktighet, datum, restriktioner och framdrift; samband med fördröjning; kalendrar; resurser med tilldelningar; uppgiftskoder; egna fält (UDF:er); anteckningar; tidsplaninställningarna i P6. En uppgift av typen *Level of Effort* blir en hängmatta. Ett baslinjeprojekt blir den aktiva baslinjen i projektet som hänvisar till det. Ett samband mellan två projekt behålls av appen som källdata.

**Tilldelningens takt.** Om arbete återstår blir den återstående takten (`remain_qty_per_hr`) *Enh./dag*. Annars är det den planerade takten (`target_qty_per_hr`). Planerat, verkligt och återstående arbete behålls som i filen. För material behålls den planerade takten.

**En ledig lördag eller söndag som inte finns i filen.** Vissa P6-exporter flyttar en ledig lördag eller söndag inuti en serie med flera lediga dagar till fredagen före eller måndagen efter. Om kalendern arbetar på lördag eller söndag skulle den dagen felaktigt bli en arbetsdag. Ser appen det mönstret i en serie med minst tre lediga dagar, gör den aktuella lördagen eller söndagen ledig ändå. I kalendern heter dagen *Kalenderundantag (helgåterskapning)*, och den räknas på raden *N kalenderfynd.* i meddelandet. I en kalender som inte arbetar på helgen ändras ingenting.

**Slack upp till projektslut, utan slutdatum.** Är P6-alternativet på för att beräkna slack upp till projektslut, men har filen inget slutdatum för projektet och inget planerat slutdatum för någon uppgift? Då stänger appen av alternativet *Beräkna slack till projektslut*. Den beräknar sedan de senaste datumen bakåt från det senaste tidigaste slutet. Det räknas på raden *N P6-tidsplaninställningar med säker reservlösning.*

**Slutförda uppgifter på rapportdatumet.** Vissa filer sparar inte de verkliga datumen för en slutförd uppgift, utan ett fönster kring rapportdatumet. I vyn *Datum som sparats* är en sådan uppgift då en smal balk på rapportdatumet. Om du beräknar om hamnar den på en annan plats. Då räknas den med i antalet uppgifter som remsan anger. Beräkningsregeln *Slutförd uppgift i rapportdatumfönstret* beräknar ett sådant fönster. Bara med den regeln får en slutförd uppgift ett riktigt slack via beräkningsalternativet *Slutförd uppgift: senaste datum från rapportdatumet*. Den här beräkningsregeln är en approximation: appen har bara sett beteendet i P3-utdata, och Primavera bekräftar det inte någonstans. Därför är den avstängd i varje inbyggd beräkningsprofil, också under *Primavera P6*. Du slår på den i avsnittet *Beräkningsprofil och beräkningsalternativ*; projektet får då en egen profil. Se [Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies).

**Tal med komma som decimalavskiljare.** P6 sparar decimalavskiljaren och tusentalsavskiljaren i tabellen `CURRTYPE`. Appen läser de tecknen innan den konverterar varaktigheter, arbete och slack. Saknas den informationen använder appen en punkt som decimalavskiljare. Innehåller filen ändå tal med decimalkomma öppnar appen ingenting. På så sätt öppnas aldrig en tidsplan med fel inlästa tal.

**Vad följer inte med** — ett projekt utan uppgifter, och ett samband mellan två projekt som ett riktigt samband i din tidsplan. Se [Öppna en Primavera P6-fil (.xer)](docs://howto-xer-openen).

## CSV

**Öppna** — ja. Appen använder `;` och `,` som separator. Den känner igen kolumnrubriker på engelska och nederländska (till exempel `Name` eller `Naam`, `Duration` eller `Duur`, `Predecessors` eller `Voorgangers`). Datum kan vara *åååå-mm-dd*, *dd-mm-åååå* eller *dd/mm/åååå*. Du skriver en föregående uppgift som WBS-kod, sambandstyp och fördröjning, till exempel `1.2FS+2d`. Beräkningsprofil: *Open Planner Studio*. Projektet heter *CSV Import*. Kolumnen `Task Type` innehåller arbetskategorin, inte uppgiftstypen. Appen läser också rubrikerna `Werksoort` och `Work category`. En `Task Type` som inte är någon av de fasta koderna (till exempel `CONSTRUCTION` eller `INSTALLATION`, som appen skriver själv) blir en egen arbetskategori under *Från det här projektet*, inte under *Mina arbetskategorier*. Med `OPS Custom Task Type ID` behålls id:t för en egen arbetskategori.

**Spara** — nej.

**Export** — ja, som *CSV (;)* (*Universell tabellexport. Alla uppgifter med datum och varaktighet.*), på kortet *CSV (semikolonseparerad)*. Filen använder semikolon som separator, är i UTF-8 med BOM och har engelska kolumnrubriker.

**Vad följer med** — per uppgift finns dessa kolumner: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` och `Description`. Kolumnen `Task Type` innehåller arbetskategorin. Slutförandegraden anges i hela procent. Fördröjning i timmar får timtecknet för appens språk: `1.2FS+2h` på engelska, `1.2FS+2u` på nederländska. Vid öppning läses båda.

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
