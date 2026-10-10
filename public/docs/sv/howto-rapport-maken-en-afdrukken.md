# Skapa och skriva ut en rapport

Mål: välj en rapport av din tidsplan, kontrollera den i förhandsvisningen och spara den som PDF. Så kan du dela ut den eller skriva ut den själv.

## När du behöver det

Fredag är det byggmöte. Beställaren vill ha tidsplanen på papper. Byggledaren vill veta vad som startar de kommande veckorna. Arbetsledaren vill ha ett blad med bara sina egna uppgifter. Du gör översikter som dessa på fliken *Rapport*. Appen beräknar dem utifrån din tidsplan och visar dem först i en förhandsvisning. Sedan exporterar du dem till en PDF.

Appen skickar inte en rapport till en skrivare själv. Slutresultatet är alltid en PDF. Du skriver ut den med din PDF-läsare, eller skickar den med e-post.

## Steg

### 1. Öppna fliken *Rapport*

Välj *Rapport* i menyfliksområdet, eller tryck på Ctrl+P. Ctrl+P tar dig till den här fliken. Är du i ett fält, är ett dialogfönster öppet eller är presentationsläget på, fungerar Ctrl+P inte. I webbläsaren öppnas då webbläsarens utskriftsdialog. Den skriver ut skärmen, inte rapporten.

På vänster sida finns kolumnen *Rapport* med listan *Rapporttyp*, en sammanfattning och inställningarna. På höger sida finns förhandsvisningen.

### 2. Välj rapporttyp

Listan *Rapporttyp* har elva rapporter. Välj den som passar din fråga.

- *Gantt-utskrift*: tidsplanen som stapeldiagram, för den vanliga tidsplan du delar ut.
- *Resursdiagram*: samma balkar, men med en rad per resurs. För frågan ”vad gör besättning X?” får du om du vill ett blad per besättning.
- *Milstolpeöversikt*: alla milstolpar med datum och status.
- *Avvikelse*: den aktuella tidsplanen bredvid den aktiva baslinjen. För frågan ”hur mycket har vi hamnat efter?”.
- *Look-ahead*: vad som pågår eller startar under den kommande perioden. Listan för veckomötet.
- *Kritisk & nära kritisk*: uppgifterna utan eller med nästan inget slack.
- *Framdriftsrapport*: var projektet står på rapportdatumet, den dag då du mäter framdriften.
- *Tidsplanens hälsa*: en kontroll av tidsplanen själv på fel och ovanliga värden.
- *Resursbelastning*: per resurs och vecka eller månad, vad som krävs mot vad som finns.
- *Resurstilldelningar*: per resurs, de uppgifter som den är tilldelad.
- *WBS-sammanfattning*: tidsplanen summerad per WBS-nivå, för ledningen.

### 3. Kontrollera att tidsplanen är aktuell

Appen beräknar inte av sig själv. Har du ändrat uppgifter, samband eller kalendrar sedan den senaste beräkningen, tryck på **Beräkna** (F5). Tabellrapporterna varnar dig själva överst i rapporten: *Tidsplanen har ändrats sedan den senaste beräkningen — tryck på Beräkna (F5) för aktuella värden.* Eller, om den aldrig har beräknats: *Ännu inte beräknat — tryck på Beräkna (F5) för datum och slack.*

Menyfliksområdet på fliken *Rapport* har ingen Beräkna-knapp, men F5 fungerar här också. *Exportera PDF* beräknar också först av sig själv om tidsplanen inte längre är aktuell. Så släpar PDF:en aldrig efter din tidsplan.

### 4. Justera rapporten

Under *Inställningar* finns valen för *Gantt-utskrift* och *Resursdiagram*. *Look-ahead*, *Kritisk & nära kritisk*, *Framdriftsrapport*, *Tidsplanens hälsa*, *Resursbelastning*, *Resurstilldelningar* och *WBS-sammanfattning* har bara *Papper:* och *Orientering:*, plus ett block *Rapportalternativ* med valen för den rapporten. *Milstolpeöversikt* och *Avvikelse* har inga egna val. För rapportens period, se [Välja rapportperioden](docs://howto-rapportageperiode-kiezen).

- *Papper:* och *Orientering:* avgör bladet. Som standard är det A3 liggande. Det passar bra för en byggtidsplan, men inte alla skrivare skriver ut A3. Har du en A4-skrivare, välj A4 nu. Appen lägger då ut sidorna för A4. Då behöver du inte krympa dem senare.
- Med *Resursdiagram* ger kryssrutan *Varje resurs på en ny sida* ett blad per besättning.
- *Teckenstorlek:* (90% till 125%) gör texten och tabellen större eller mindre. En större text ger mindre plats för tidslinjen.
- *Följa vyn (filter, gruppering, sortering)* visas bara för *Gantt-utskrift*. Som standard hamnar hela uppgiftsträdet på papperet. Med kryssrutan ritar rapporten exakt de rader du ser på skärmen, även ihopfällda faser. Till exempel bara de kritiska uppgifterna i en layout. Hur du skapar en sådan vy finns i [Skapa och använda en layout](docs://howto-layouts-gebruiken).
- *Visa baslinjeöverlägg* visar den aktiva baslinjen bredvid de aktuella balkarna. Med *Statuslinje:* väljer du en *Rapportdatumlinje* eller en *Framdriftslinje*.
- *Anpassa till papper* är på som standard. Tidslinjen skalas då till sidans bredd. Antalet sidor följer av höjden. Stänger du av det, använder rapporten en fast zoom. Då delas den också upp i bredden, vilket snabbt ger många sidor. Med *Tidslinje över:* sprider du tidslinjen över 2 till 8 sidor i bredd, med anpassning. Det passar en lång tidsplan som du vill skriva ut i en läsbar storlek.

### 5. Kontrollera förhandsvisningen

För *Gantt-utskrift* och *Resursdiagram* ser du papperet med sidhuvud, tabell, tidslinje och teckenförklaring. Bläddra för att se sidorna. *Förhandsvisningskvalitet* ändrar bara hur skarp förhandsvisningen är på din skärm. PDF:en ändras inte av det. Står det under sidorna *… och 1 sida till — exportera för hela dokumentet* (med fler sidor *… och 2 sidor till — exportera för hela dokumentet*), har förhandsvisningen inte alla sidor klara. PDF:en innehåller alla sidor.

De andra rapporterna visas på skärmen som en tabell. Det du ser är det som hamnar i PDF:en.

### 6. Exportera till PDF

Klicka längst ner i den vänstra kolumnen på *Exportera PDF*. Det föreslagna filnamnet är projektnamnet, följt av rapporttypen. För *Gantt-utskrift* blir det till exempel *Extension house-planning.pdf*.

- I skrivbordsappen, och i en webbläsare som har en sparadialog för filer, väljer du var PDF:en sparas. Stänger du dialogen utan att spara, händer ingenting.
- I en webbläsare utan en sådan dialog lägger webbläsaren PDF:en i mappen för nedladdningar.

### 7. Skriv ut PDF:en

Öppna PDF:en i din PDF-läsare och skriv ut den där. Skriver du ut en A3-PDF på en A4-skrivare, måste utskriftsdialogen krympa sidorna. Ställ därför in pappersstorleken redan i steg 4.

## Fallgropar och vad appen gör

**Knappen *Utskrift* och Ctrl+P skriver inte ut.** Knappen *Utskrift* i gruppen *Rapport* finns på själva fliken Rapport och gör inget extra. Ctrl+P tar dig till den här fliken. Appen har inget separat utskriftskommando. Vägen till papper går via PDF:en. Fungerar Ctrl+P inte (se steg 1) öppnas webbläsarens utskriftsdialog. Den skriver ut skärmen, inte rapporten.

**Företag: överskriven text sparas inte.** Fältet *Företag:* i *Gantt-utskrift* börjar med företaget från *Projektinfo*. Det du skriver över sparas inte. Du kan inte skriva i *Författare:* här. Du ändrar båda med *Inställningar › Projekt › Projektinfo*, i fälten *Beställare/organisation* och *Författare*, och bekräftar med *Tillämpa*.

**Stapelfärger: gäller också din skärm.** Valet *Stapelfärger:* i rapporten är samma val som *Stapelfärger* på fliken Visa. Ändrar du det i rapporten, ändras ditt Gantt-diagram på skärmen också.

**Avvikelse utan baslinje.** En baslinje är en sparad ögonblicksbild av din tidsplan som du jämför med senare. Hur du sparar en beskrivs i [Spara och hantera en baslinje](docs://howto-baseline-opslaan-en-beheren). Har du ingen aktiv baslinje, står det i stället för en jämförelse: *Ingen aktiv baslinje — spara en baslinje eller välj en som aktiv.*

**Statuslinje utan rapportdatum.** Väljer du *Statuslinje:* medan projektet saknar rapportdatum, varnar rapporten med *Ange först ett rapportdatum* och ritar ingenting. Du anger rapportdatumet under *Tidsplan › Baslinjer & framdrift › Rapportdatum*.

**Tidsplanen har ett cirkulärt samband.** Innehåller tidsplanen ett cirkulärt samband, skapar *Exportera PDF* ingen fil och visar felet.

**Papper gäller nu för alla rapporter.** Det finns ett val för *Papper:* och *Orientering:* som alla rapporter delar. *Milstolpeöversikt* och *Avvikelse* har inget eget pappersval. De använder det du valt i en annan rapport, som standard A3 liggande. Välj därför papper först i en rapport som har det valet, till exempel *Gantt-utskrift*, och gå sedan tillbaka.

**Valen gäller alla projekt.** *Papper*, *Teckenstorlek*, period och de andra valen sparas av appen på den här enheten, för alla dina projekt. De hör inte till projektfilen.

## Se även

- [Välja rapportperioden](docs://howto-rapportageperiode-kiezen): en look-ahead eller framdriftsrapport över en viss period.
- [Skapa och använda en layout](docs://howto-layouts-gebruiken): filtrera eller gruppera först, skriv sedan ut med *Följa vyn*.
- [Spara och hantera en baslinje](docs://howto-baseline-opslaan-en-beheren): ögonblicksbilden som *Avvikelse* jämför med.
- [Lösa överbeläggning](docs://howto-overbezetting-oplossen): vad du gör när *Resursbelastning* visar veckor med överbeläggning.
- [Kritisk linje och slack](docs://uitleg-kritiek-pad): varför en uppgift är kritisk eller nära kritisk.
- [Rapporttyper](docs://ref-rapporttypes): alla rapporttyper och deras val.
