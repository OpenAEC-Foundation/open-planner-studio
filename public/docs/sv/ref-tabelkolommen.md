# Tabellkolumner

Uppgiftstabellen har 86 fasta kolumner, plus en kolumn per uppgiftskod och eget fält i projektet, och åtta kolumner per baslinje. Den här artikeln beskriver för varje kolumn vad den visar, om du kan redigera den och i vilken form värdet skrivs. Hur du väljer och ordnar kolumner står i [Anpassa uppgiftstabellens kolumner](docs://howto-tabelkolommen-aanpassen).

## Var du väljer kolumner

Uppgiftstabellen bredvid Gantt-diagrammet och tabellen på fliken *Tabell* har var sin kolumnval. Plustecknet till höger i rubriken öppnar kolumnväljaren (fönstrets titel *Välja kolumn*). På *Tabell* kan du också använda *Tabell › Kolumner › Kolumner…*. Väljaren visar kolumnerna per kategori: *Uppgift*, *Tidsplan*, *Restriktioner*, *Samband*, *Resurser*, *Framdrift*, *Beräknat*, *Baslinje*, *Anpassat* och *Teknisk*. Du söker på namn. *Senast använda* står överst. *Återställ standard* återställer standardkolumnerna.

Som standard visar tabellen bredvid Gantt *WBS*, *Uppgiftsnamn* och *Varaktighet*. Tabellen på fliken *Tabell* visar *WBS*, *Uppgiftsnamn*, *Varaktighet*, *Start*, *Slut*, *Uppgiftstyp*, *Kritisk*, *Totalt slack* och *Framdrift*, plus en kolumn per uppgiftskod och eget fält i projektet.

## Hur värden läses och redigeras

- **Beräknade kolumner** — kolumnerna i kategorin *Beräknat* och ett antal andra är skrivskyddade: de kommer från beräkningen. Försöker du redigera en skrivskyddad cell visar appen *Den här beräknade kolumnen kan inte redigeras.* Den texten gäller för alla skrivskyddade celler, även när kolumnen inte är beräknad. Om värdena är föråldrade eftersom du ändrat något visas *föråldrad* bredvid dem tills du trycker på *Beräkna*.
- **Datum** — visas i det format du valde under *Inställningar*, fliken *Visa*, rubriken *Datumformat*.
- **Varaktighet och slack** — en varaktighet visas i uppgiftens enhet (`5d`, `12h`) eller enligt *Visning av varaktighet* på samma flik (*Automatiskt (egen enhet per uppgift)*, *Alltid dagar* eller *Alltid timmar*). Slack visas i arbetsdagar med två decimaler och med decimaltecknet för ditt språk.
- **Ja/Nej** — ett värde för ja eller nej visas som *Ja* eller *Nej*; ett tomt värde visas som ett streck (—).
- **Redigera** — skriv eller välj ett värde. Ett ogiltigt värde avvisas med en orsak under cellen, till exempel *Ange en giltig varaktighet, till exempel 5d eller 8h.* eller *Ange en procentsats mellan 0 och 100.* När du klistrar in ett block med celler fungerar det cell för cell. Skrivskyddade celler hoppas över, och appen visar hur många det var.

## Uppgift

- **Uppgiftsnamn** — namnet på uppgiften. Redigerbart; obligatoriskt. En sammanfattningsuppgift visas med fet text och en ljus bakgrundston i namncellen. En milstolpe visas med fet text i milstolpsfärgen (samma färgfamilj som milstolpen i Gantt). En vanlig uppgift ser ut som vanligt. Det är bara formatering: markera, dra och redigera fungerar på samma sätt.
- **Beskrivning** — beskrivningen. Redigerbar; fri text.
- **WBS** — WBS-koden. Redigerbar och obligatorisk, men skrivskyddad medan *WBS auto* är på.
- **Uppgiftstyp** — uppgiftstypen (*Bygg*, *Installation*, *Rivning*, *Logistik*, *Besiktning*, *Flytt*, *Renovering*, *Underhåll* eller *Övrigt*). Redigerbar med en lista.
- **Egen uppgiftstyp** — den egna uppgiftstypen från projektet, eller ett streck. Redigerbar med en lista över projektets egna typer.
- **Färg** — den sparade färgen för uppgiften, som en färgkod, till exempel `#1a73e8`. Redigerbar med en färgväljare. Den sparas i IFC-filen, men ingen balk eller rapport använder den. Stapelfärgerna ställer du in under *Visa › Baslinjer & framdrift › Stapelfärger*.
- **Noteringar** — noteringarna som `✓ text; ○ text`. Redigerbara så länge det finns högst en notering (då redigerar du dess text). Med fler noteringar är de skrivskyddade.

## Tidsplan

- **Milstolpe** — om uppgiften är en milstolpe. Redigerbar. När du slår på den blir varaktigheten 0. Appen avvisar det för en sammanfattningsuppgift och för en uppgift med tilldelningar.
- **Milstolpstyp** — *Startmilstolpe* eller *Slutmilstolpe*, eller ett streck för automatiskt. Redigerbar endast på en milstolpe.
- **Obligatorisk milstolpe** — flaggan *Obligatorisk (avtalsenlig)*. Redigerbar endast på en milstolpe.
- **Prioritet för utjämning** — ett heltal från 0 till 1000, standard 500. Redigerbar. 1000 låser uppgiften för utjämning.
- **Delningsluckor** — antalet avbrott, som `Delningsluckor: 2`, eller ett streck. Skrivskyddad. Du redigerar dem i panelen *Egenskaper*.
- **Arbetsregel** — uppgiftens arbetsregel; tomt betyder projektets standard. Redigerbar med en lista, men tom och skrivskyddad på en milstolpe, sammanfattningsuppgift eller hängmatta. Den visas i kolumnväljaren endast när arbetsreglerna är synliga (*Visa arbetsregler och arbete*, eller när filen har arbetsregler).
- **Hängmatta (härledd varaktighet)** — om uppgiften är en hängmatta. Redigerbar, utom på en milstolpe eller sammanfattningsuppgift.
- **Kalender** — id:t för uppgiftens egna kalender; tomt (—) är projektkalendern. Du skriver eller väljer ett id från förslagen. Ett okänt id avvisas. Obs: cellen visar för närvarande det interna id:t i stället för namnet. Välj hellre en kalender i panelen *Egenskaper*.
- **Varaktighetstyp** — *Arbetstid* (varaktigheten räknas i arbetsdagar eller arbetstider i kalendern) eller *Förfluten tid* (varaktigheten räknas i sammanhängande klocktid, utan kalender). Redigerbar.
- **Varaktighetsenhet** — *Dagar* eller *Timmar*. Redigerbar, utom på en sammanfattningsuppgift, hängmatta eller milstolpe. Bytet fungerar bara om omräkningen blir exakt och *Aktivera timplanering* är på.
- **Varaktighet** — uppgiftens varaktighet, i uppgiftens enhet eller enligt *Visning av varaktighet*. Redigerbar: skriv `5d`, `12h` eller `1h 30m`; även ett tal i uppgiftens enhet. Skrivskyddad på en sammanfattningsuppgift, en hängmatta och en milstolpe med varaktighet 0.
- **Start** — den visade starten, samma datum som Gantt-balken. Redigerbar. Ger du en uppgift med en föregående uppgift en ny start, får den restriktionen *Starta tidigast (SNET)* på det datumet. Skrivskyddad på en sammanfattningsuppgift eller hängmatta, om den inte är manuellt schemalagd.
- **Slut** — det visade slutet. Redigerbart: ett nytt slut blir en ny varaktighet. Appen avvisar det för en slutförd uppgift, en milstolpe, en uppgift med förfluten tid och en uppgift med avbrott. Den avvisar också ett slut före starten (*Slutet ligger före starten.*). Skrivskyddat på en sammanfattningsuppgift eller hängmatta, om den inte är manuellt schemalagd.
- **Schemalagd start** — startpunkten som beräkningen utgår från (inte alltid den visade starten). Redigerbar; samma effekt som att skriva i *Start*.
- **Schemalagt slut** — det angivna slutet. Redigerbart endast på en manuellt schemalagd uppgift. Annars säger appen *Planerat slut gäller bara för en manuellt schemalagd uppgift. Ändra slutet via kolumnen Slut eller via varaktigheten.*

## Restriktioner

- **Restriktionstyp** — typen av restriktion, från *Så tidigt som möjligt (ASAP)* till *Måste slutföras på (MFO)*. Redigerbar. En uppgift utan restriktion visar *ASAP*.
- **Restriktionsdatum** — datumet för restriktionen. Redigerbart.
- **Hård restriktion** — flaggan *Obligatorisk (pinlogik)*. Redigerbar endast på *MSO* och *MFO*.
- **Sekundär restriktionstyp** — typen av den andra gränsen, eller ett streck. Redigerbar. Tabellen erbjuder alla typer, men en kombination som inte är tillåten avvisas. Den måste vara *SNET*, *FNET*, *SNLT* eller *FNLT*. Den primära restriktionen måste vara en gräns (inte *ASAP*, *ALAP*, *MSO*, *MFO* eller en hård restriktion). De två måste gränsa till motsatta sidor (en nedre gräns *SNET*/*FNET* med en övre gräns *SNLT*/*FNLT*, eller omvänt).
- **Sekundärt restriktionsdatum** — datumet för den andra gränsen. Redigerbart.
- **Måldatum** — måldatumet för slutet. Redigerbart.

## Samband

- **Föregående** — de föregående uppgifterna, som `WBS typ±fördröjning`, åtskilda med `; `, till exempel `1.2 FS+2d`. Redigerbart genom att skriva i samma form. Du lägger inte till ett externt samband här utan via *Tidsplan › Samband › Länka › Lägga till externt samband…*.
- **Efterföljande** — de efterföljande uppgifterna, i samma form. Redigerbart.
- **Drivande samband** — de samband som avgör datumet för den här uppgiften, som `← 1.2` (föregående) eller `→ 1.4` (efterföljande). Skrivskyddat; föråldrat tills du trycker på *Beräkna*.
- **Fritt slack** (i kategorin *Samband*) — det fria slacket per samband, som `← 1.2: 3d`. Inte samma kolumn som *Fritt slack* under *Beräknat*, som visar slacket för uppgiften självt. Skrivskyddat.
- **Varningar** — varningar per samband, till exempel *Utanför ordning* eller *Inte medräknat i beräkningen*. Skrivskyddade. Se [Meddelanden och varningar](docs://ref-meldingen).

## Resurser

- **Tilldelade resurser** — namnen på de tilldelade resurserna, åtskilda med kommatecken. Redigerbart: när du lägger till ett namn tilldelas resursen med 1 tilldelningsenhet per dag. När du tar bort ett namn tas tilldelningen bort. Skrivskyddat på en milstolpe eller sammanfattningsuppgift.
- **Tilldelningsenheter per dag** — enheterna per resurs, som `Name: 1; Name: 0.5`. Redigerbart på en uppgift med tilldelningar.
- **Tilldelningskurva** — kurvan per resurs, som `Name: Uniform`. Redigerbar på en uppgift med tilldelningar.
- **Arbetsfönster start** och **Arbetsfönster slut** — arbetsfönstret per resurs, från en importerad fil, som `Name: datum`. Skrivskyddade.
- **Planerat arbete (timmar)** och **Verkligt arbete (timmar)** — det planerade och verkliga arbetet per resurs i timmar, som `Name: 12`, från en importerad fil. Skrivskyddade.
- **Återstående arbete (timmar)** — det återstående arbetet per resurs i timmar, som `Name: 6`: det lagrade arbetet, annars återstående varaktighet × tilldelningsenheter. Redigerbart på en uppgift med tilldelningar där en arbetsregel gäller. Visas i kolumnväljaren endast när arbetsreglerna är synliga.

## Framdrift

- **Status** — *Inte startad*, *Pågår* eller *Klar*. Redigerbar, utom på en sammanfattningsuppgift.
- **Framdrift** — procenten, som `40%`. Redigerbar med ett tal från 0 till 100, utom på en sammanfattningsuppgift.
- **Verklig start** — datumet då uppgiften började. Redigerbar, utom på en sammanfattningsuppgift.
- **Verkligt slut** — datumet då uppgiften blev klar. Redigerbart, utom på en sammanfattningsuppgift.
- **Verklig varaktighet** — den verkliga varaktigheten, som ett tal. Redigerbar, utom på en sammanfattningsuppgift.
- **Återstående** — den återstående varaktigheten, i uppgiftens enhet. Redigerbar, utom på en sammanfattningsuppgift.
- **Återupptagningsdatum** och **Stoppdatum** — återupptagningen och stoppet av en pågående uppgift från en MS Project- eller Primavera-fil. Skrivskyddade.

Kolumnerna för framdrift följer appens framdriftsregler. Ett verkligt datum efter rapportdatumet avvisas. På en sammanfattningsuppgift visar appen *Framdriften för en sammanfattningsuppgift härleds från underuppgifterna och kan inte ändras här.*

## Beräknat

Alla kolumner i den här kategorin är skrivskyddade.

- **Förskjutning pga utjämning** — hur många arbetsdagar utjämningen förskjöt uppgiften; ett streck om ingen utjämning har tillämpats.
- **Tidigaste start** och **Tidigaste slut** — de tidigaste datumen från beräkningen.
- **Senaste start** och **Senaste slut** — de senaste datumen då uppgiften fortfarande får börja eller sluta utan att projektet försenas.
- **Fritt slack** — de arbetsdagar som uppgiften kan glida utan att en efterföljande uppgift försenas.
- **Totalt slack** — de arbetsdagar som uppgiften kan glida utan att försena projektslutet. Negativt om en restriktion eller ett måldatum inte kan uppnås.
- **Kritisk** — *Ja* om uppgiften ligger på den kritiska linjen.
- **Störande slack** — totalt slack minus fritt slack.
- **Nära kritisk** — *Ja* för en uppgift som är nära kritisk. Fylls bara i om *Markera nära kritisk* är på (*Projektinfo*, blocket *Beräkningsprofil och beräkningsalternativ*); annars ett streck.
- **Slackväg** — slackvägens nummer, 1 för den mest kritiska. Fylls bara i om *Flera slackvägar* är på; annars ett streck.
- **Källa för registrerade datum** — för en fil med registrerade datum: *Avviker* eller *Delvis ej registrerat*. Visas bara i kolumnväljaren för en sådan fil. På en oregistrerad axel visas *Ej registrerat* i kolumnerna för senaste datum och slack.

Se [Kritisk linje och slack](docs://uitleg-kritiek-pad).

## Baslinje

För varje baslinje i projektet läggs kolumner till, med baslinjens namn före kolumnnamnet (`<baseline> — Schemalagd start`). De är skrivskyddade. En uppgift som inte finns i baslinjen visar ett streck med verktygstipset *Finns inte i den här baslinjen*.

- **Schemalagd start**, **Schemalagt slut** och **Varaktighet** — start, slut och varaktighet så som baslinjen registrerade dem.
- **Startavvikelse** och **Slutavvikelse** — antalet arbetsdagar mellan baslinjen och den visade starten eller det visade slutet, i projektets kalender. Positivt om uppgiften ligger senare.
- **Varaktighetsavvikelse** — den aktuella varaktigheten minus varaktigheten i baslinjen, i arbetsdagar.

## Anpassat

- **Uppgiftskod** — en kolumn per uppgiftskod, med namnet på koden. Visar koden för det valda värdet. Redigerbar: du skriver koden eller väljer den från förslagen. En okänd kod avvisas. Förekommer en kod mer än en gång frågar appen efter vilken du vill välja i listan.
- **Eget fält** — en kolumn per eget fält, med dess namn. Inmatningen passar typen: text, tal, heltal, kostnad, datum eller ja/nej. Redigerbart.

Kolumnerna hör till det projekt som koden eller fältet finns i. Se [Koder och egna fält](docs://howto-codes-en-velden).

## Teknisk

Alla kolumner i den här kategorin är skrivskyddade. De visar data som appen lagrar men inte visar i en vanlig kolumn, till exempel för att kontrollera en import.

- **Uppgifts-ID** — uppgiftens interna id.
- **Överordnad uppgifts-ID** och **Underordnade uppgifters ID** — id för den överordnade och de underordnade uppgifterna.
- **Resurs-ID** — id för resurserna på uppgiften.
- **Tilldelnings-ID**, **Tilldelnings uppgifts-ID** och **Tilldelnings resurs-ID** — id för tilldelningarna, uppgifterna och resurserna för den här uppgiften.
- **Varaktighet (minuter)** och **Återstående (minuter)** — varaktigheten och den återstående varaktigheten i minuter; fylls bara i för en uppgift i timmar.
- **Förskjutning pga utjämning (minuter)** och **Förfluten förskjutning pga utjämning** — förskjutningen från utjämningen i MS Project i minuter, och om den räknas i klocktid.
- **Manuellt schemalagd** — om uppgiften är manuellt schemalagd.
- **MS Project-uppgiftstyp (import)** och **Insatsberoende** — uppgiftstypen och flaggan för insatsberoende så som MS Project hade dem.
- **Primavera P6-ursprung** — källfälten från en Primavera-fil, som `key: value`.
- **Uttrycklig sammanfattningsuppgift** — om uppgiften är en uttrycklig sammanfattning utan underuppgifter (från en Primavera-fil).
- **Timfasad slutgräns**, **Timfasad startankare**, **Timfasade varaktighetssegment** och **Timfasade profiler** — timfördelningen från en MS Project-fil, som datum och antal.
- **Uppgiftskoddata**, **Data för egna fält** och **Noteringsdata** — antalet kodtilldelningar, egna fält och noteringar.
- **Data för interna samband** och **Data för externa samband** — antalet interna och externa samband.
- För varje baslinje finns även **Milstolpe** och **Milstolpstyp** här, så som baslinjen registrerade dem.
