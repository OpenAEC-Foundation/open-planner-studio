# Inställningar

Varje inställning i appen: vad den gör, dess startvärde, vad som ändras och var du hittar den. För beräkningsalternativen i ett projekt (beräkningsprofil, definition av vad som är kritiskt) se [Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies). De hör till projektfilen, inte till appen.

## Var du hittar dem och hur de fungerar

Panelen med inställningar finns på tre ställen, och överallt är det samma panel: kugghjulet högst upp i fönstret, *Inställningar › Projekt › Inställningar* och *Fil › Inställningar*. Panelen har tre flikar: *Utseende*, *Tidsplan* och *Avancerat*. Varje inställning nedan anger bara fliken.

En ändring gäller direkt. Det finns ingen knapp *Tillämpa* och ingen knapp *Avbryt*.

**Gäller hela appen, inte per projekt.** Alla inställningar i den här artikeln gäller för alla dina projekt och hör till den här enheten. Appen sparar dem i lagringen för appen eller för din webbläsare, inte i projektfilen. En annan person som öppnar din fil ser därför sina egna inställningar. En webbläsare vars lagring du rensar börjar igen med startvärdena.

## Fliken Utseende

**Tema** — färgschemat för gränssnittet. Välj mellan *Mörkt*, *Ljust* och *Hög kontrast*. Standard: *Mörkt*. Effekt: färgerna i hela gränssnittet, inklusive Gantt och histogrammet. Var: *Utseende*.

**Följ systemtema** — låter färgschemat i ditt operativsystem avgöra. Standard: av. Effekt: appen är *Ljust* eller *Mörkt*, avhängigt av ditt system; de tre temakorten är då avstängda. *Hög kontrast* följer inte ditt system: du väljer den själv. Om du stänger av detta blir temat som visades på skärmen då kvar. Var: *Utseende*, under *Tema*.

**Språk** — språket i gränssnittet. Standard: språket i din webbläsare eller ditt system om appen känner till det, annars engelska. Effekt: alla texter i appen; de fjorton språken sorteras efter sin korta kod. Arabiska och persiska speglar gränssnittet från höger till vänster. Du väljer språket för hjälpartiklarna separat, under *Dokumentationsspråk* i *Fil › Hjälp*. Var: *Utseende*.

**Teckensnitt** — teckensnittet för hela gränssnittet. Välj mellan *Standard*, *System*, *Med serifer* och *Monospace*. Standard: *Standard*. Effekt: rubriker och text i fönstret, och texten i Gantt och histogrammet. En webbapp följer inte systemets teckensnitt av sig själv; därför väljer du det här. Var: *Utseende*.

**Textstorlek** — skalan för gränssnittet. Välj mellan 90%, 100%, 110% och 125%. Standard: 100%. Effekt: text och layout i menyfliksområdet, panelerna och dialogerna blir större eller mindre, och radhöjden i tabellen och i Gantt skalas med. Det finns inget val över 125%, eftersom knapptexterna i menyfliksområdet då bryts över flera rader. Var: *Utseende*.

**Datumformat** — hur datum visas i appen. Välj mellan *dd-mm-åååå*, *mm-dd-åååå* och *åååå-mm-dd*. Standard: *dd-mm-åååå*. Effekt: datum i tabellen, dialogerna, rapporterna och utskriften. Filer och beräkningar ändras inte: bara visningen. Var: *Utseende*.

**Visning av varaktighet** — i vilken enhet varaktigheten för en uppgift visas. Välj mellan *Automatiskt (egen enhet per uppgift)*, *Alltid dagar* och *Alltid timmar*. Standard: *Automatiskt (egen enhet per uppgift)*. Effekt: i uppgiftstabellen, balketiketterna i Gantt, verktygstipset, utskriften och rapporterna. Med *Automatiskt* visar en daguppgift dagar och en timuppgift timmar. Med *Alltid dagar* eller *Alltid timmar* räknar appen om med timmar per dag i uppgiftens kalender. Har uppgiften en annan enhet, så lägger appen dess egen enhet efter inom parentes, till exempel `2.25d(18h)`. Bara visningen ändras; uppgiften behåller sin egen enhet. Var: *Utseende*.

**Växlingsstil för dokument** — hur du växlar mellan öppna projekt. Välj mellan *Horisontella flikar*, *Vertikala flikar* och *Kapsel*. Standard: *Horisontella flikar*. Effekt: *Horisontella flikar* visar en flikrad under menyfliksområdet; *Vertikala flikar* ett projektfält till vänster; *Kapsel* en liten projektknapp i namnlisten. Var: *Utseende*.

### Avsnittet Gantt

**Visa bara arbetsdagar** — komprimerar tidsaxeln. Standard: av. Effekt: helger och helgdagar från projektkalendern hoppas över, så en uppgift på 5 arbetsdagar är exakt lika bred som 5 dagar på tidsskalan. Genvägarna för *Hoppa till idag* och *Anpassa till projektet* räknar då också i arbetsdagar. Rapporten har en egen kryssruta med samma namn, som är oberoende av den här inställningen. Var: *Utseende*, under *Gantt › Tidsaxel*.

**Visa kvartstimmar när du zoomar in långt** — en extra fin tidsskala. Standard: av. Effekt: du kan zooma längre in, och timskalan får en extra rad med kvartstimmar. Att dra en timbalk kan då snäppa till kvartstimmar i stället för hela timmar. Du ser detta bara när *Aktivera timplanering* är på. Var: *Utseende*, under *Gantt › Kvartszoom*.

**Uppgiftsbalkar vid avbrott** — om en timuppgift ritas i band. Välj mellan *Dela aldrig upp*, *Dela upp vid val* och *Dela alltid upp*. Standard: *Dela upp vid val*. Effekt: balken för en timuppgift ritas då per band i stället för som en sammanhängande balk. *Dela upp vid val* gör det bara för den valda uppgiften. Det gäller bara timuppgifter. En uppgift som verkligen är delad (med *Dela uppgift*) visar sitt avbrott oavsett den här inställningen. Var: *Utseende*, under *Gantt*.

**Scrolla & zooma › Läge** — vad scrollhjulet gör över Gantt. Välj mellan *Position*, *Tangenter* och *Zooma + dra*. Standard: *Zooma + dra*. Effekt: med *Zooma + dra* zoomar hjulet kring markören, Shift+hjul rullar genom raderna, du panorerar tidslinjen genom att dra i bakgrunden, och Ctrl+dra (Cmd på en Mac) ritar en markeringsruta. Med *Position* beror hjulets funktion på var markören är; Ctrl+hjul zoomar alltid och Shift+hjul rullar alltid horisontellt. Med *Tangenter* väljer du själv vilken tangent som gör vad. Valet gäller också för den andra tidslinjen i den delade vyn. Var: *Utseende*, under *Gantt › Scrolla & zooma*.

**Skärmindelning** — var markören är avgör vilken funktion som gäller. Syns bara i läget *Position*. Välj mellan *Vänster/höger*, *Upp/ned* och *Övre högra hörnet*. Standard: *Vänster/höger*. Effekt: med *Vänster/höger* rullar hjulet vertikalt över vänstra halvan och horisontellt över den högra halvan. Med *Upp/ned* rullar hjulet horisontellt över de översta 30% (nära tidsskalan) och vertikalt under det. Med *Övre högra hörnet* rullar hjulet horisontellt i det övre högra hörnet och vertikalt i resten. Var: *Utseende*, under *Gantt › Scrolla & zooma*.

**Scrolla & zooma › Vertikalt, Horisontellt, Zooma** — vilken tangent som hör till vilken hjulfunktion. Syns bara i läget *Tangenter*. För varje funktion väljer du mellan *Scrolla*, *Ctrl + scrolla* eller *Shift + scrolla*. Standard: *Vertikalt* är *Scrolla*, *Zooma* är *Ctrl + scrolla* och *Horisontellt* är *Shift + scrolla*. Effekt: om du väljer en tangent som redan används byter den plats med funktionen som hade den. Var: *Utseende*, under *Gantt › Scrolla & zooma*.

## Fliken Tidsplan

**Aktivera byggläge** — byggorienterade startvärden för nya projekt. Standard: på. Effekt: när byggläget är på ger appen ett nytt projekt kalendern *Bouwkalender NL* med de nederländska allmänna helgdagarna, låter dig välja en byggerhelgdag när du genererar helgdagar, erbjuder faseringsmallarna *Bostadsbyggnation* och *Kommersiellt byggande / renovering* och ger nya uppgifter uppgiftstypen *Bygg*. Av ger ett nytt projekt kalendern *Standaardkalender* utan helgdagar, bara mallen *Tom* och uppgiftstypen *Övrigt*. En ny uppgift under en överordnad uppgift som har en uppgiftstyp tar först över den uppgiftstypen; *Bygg* eller *Övrigt* gäller sedan. Befintliga uppgifter och kalendrar ändras inte. Var: *Tidsplan*.

**Aktivera timplanering** — planering i arbetstimmar bredvid arbetsdagar. Standard: av. Effekt: tidsskalan *Timme* visas under *Visa › Tidsskala*, fönstret *Kalendrar* får avsnittet *Arbetstider*, och fönstret *Nytt projekt* får valen *Skift* och *Standardenhet för nya uppgifter*. *Projektinfo* får också valet *Standardenhet för nya uppgifter*. Av betyder att appen arbetar med dagar som minsta enhet. Uppgifter som redan är i timmar behålls och räknas med i beräkningen; du kan bara ändra deras varaktighet när du slår på timplanering. Var: *Tidsplan*, under *Timplanering*. Se [Att slå på timplanering](docs://howto-urenplanning-aanzetten).

**Tillåt blandad dag-/timplanering** — om du väljer enhet per uppgift. Syns bara när *Aktivera timplanering* är på. Standard: på. Effekt: när inställningen är på visar appen listrutan *Varaktighetsenhet* bredvid varaktigheten för varje uppgift. Av döljer listrutan. Var: *Tidsplan*, under *Timplanering*. Se [Dagar och timmar](docs://uitleg-dagen-en-uren).

**Veckan börjar på** — första dagen i veckan. Välj mellan *Måndag* och *Söndag*. Standard: *Måndag*. Effekt: veckoindelningen och veckonumren på tidsskalan i Gantt och i rapporterna (utskriften av Gantt-diagrammet), och ordningen för veckodagarna i fönstret *Kalendrar*. Var: *Tidsplan*.

**Beräkna automatiskt** — beräknar om tidsplanen så snart den är inaktuell. Standard: av. Effekt: av betyder att du själv trycker på *Beräkna* (F5). På gör att appen beräknar om tidsplanen inom en bråkdel av en sekund efter en ändring i uppgifter, samband eller kalender. Under ett dragmoment eller medan du skriver i ett fält väntar appen och beräknar en gång när du är klar. Efter en misslyckad beräkning beräknar appen bara igen när du har ändrat något. Var: *Tidsplan*, under *Beräkning*.

**Visa arbetsregler och arbete** — fälten för arbetsregel och arbete i appen. Standard: av. Effekt: när inställningen är på visar appen fältet *Arbetsregel* på en uppgift och arbetskolumnen för tilldelningarna, och appen gör tabellkolumnen *Arbetsregel* tillgänglig. Av döljer dem; varaktighet och tilldelningsenheter ligger kvar och arbetet följer med. Ett projekt som redan innehåller arbetsregel- eller arbetsdata, till exempel från en `.mpp`- eller `.xer`-fil, visar dem alltid, även när inställningen är av. Var: *Tidsplan*, under *Beräkning*. Se [Arbetsregler: varaktighet, tilldelningsenheter och arbete](docs://uitleg-werkregels).

## Fliken Avancerat

**Aktivera AI-läge** — låter en AI-assistent arbeta med din tidsplan. Standard: av. Effekt: när inställningen är på visar appen fliken *AI* med MCP-bryggan, så att en AI-assistent kan arbeta med din tidsplan via Model Context Protocol. Av döljer fliken och stoppar bryggan. Var: *Avancerat*, under *AI-läge*. Se [Koppla en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen).

**Starta bryggan automatiskt** — startar MCP-bryggan när appen startar. Kan bara slås på när *Aktivera AI-läge* är på. Standard: av. Effekt: bryggan är igång direkt, så att en AI-klient kan ansluta utan att du först öppnar fliken *AI*. Det fungerar bara i skrivbordsappen, och en gång per start: stänger du själv av bryggan efteråt startar den inte om. Var: *Avancerat*, under *AI-läge*.

**Aktivera felsökningsterminal** — en loggpanel för felsökning. Standard: av. Effekt: när inställningen är på lägger appen en terminalknapp i statusfältet, som visar eller döljer loggpanelen. Av stänger panelen. Var: *Avancerat*, under *Felsökningsterminal*.

**Benchmark…** — mäter prestandan i tidsplaneringsmotorn. Effekt: öppnar ett fönster där en testtidsplan av en storlek du väljer genereras och kärnfaserna mäts. Ditt öppna projekt lämnas orört. Det är en knapp, inte en inställning: det finns inget att komma ihåg. Var: *Avancerat*, under *Benchmark*.

**Statistik…** — hur ofta appen har laddats ner. Effekt: öppnar fönstret *Nedladdningsstatistik* med offentliga siffror från GitHub Releases; ingenting samlas in från dig. Det är en knapp, inte en inställning. Var: *Avancerat*, under *Statistik*. I fönstret:

- *Nedladdningar per operativsystem* — per system visas kolumnerna *Nedladdningar*, *Installationsfiler* (det en person laddar ner) och *Uppdateringar* (det uppdateraren i appen hämtar), med *Totalt*. På Linux går de två inte att skilja åt: uppdateraren hämtar samma `.deb`, `.rpm` eller `.AppImage`-fil som folk också laddar ner för hand, så där räknas bara snap-filen som installationsfil. Under det visas *Uppdateringskontroller från appen*: hur ofta uppdateraren i en installerad app har hämtat versionsfilen från GitHub för att söka efter en ny version. Det är kontroller, inte installationer.
- *Per release* — samma nedladdningar per version, med datumet; först de sex senaste, med *Visa alla … releaser* för resten.
- *Källa* — datumet för siffrorna (GitHub Releases, uppdateras varje vecka) och *Uppdatera nu*. Appen behåller hämtade siffror i en halv timme. Lyckas hämtningen inte, då säger fönstret det. Installationer via Snap Store går inte via GitHub och saknas.

**Starta rundtur** — den inledande rundturen igen. Effekt: stänger inställningsfönstret och startar rundturen från första steget. Var: *Avancerat*, under *Rundtur*.

**Version** — versionsnumret för appen, med två knappar. *Sök efter uppdateringar* öppnar fönstret för uppdateringar. *Vad är nytt* visar nyheterna för den aktuella versionen. Var: *Avancerat*, under *Version*.

**Visa klassiska vyknappar** — en ersatt funktion, under *Äldre funktioner*. Standard: av. Effekt: när inställningen är på lägger appen en grupp *Visning* tillbaka på fliken *Visa*, med de separata knapparna *Kolumner…*, *Filtrera…*, *Gruppera…* och *Sortera…*. De har ersatts av plusknappen i tabellrubriken, layoutknapparna och layoutfönstret. Var: *Avancerat*, under *Äldre funktioner*.

## Sparade visningsval utanför panelen

Appen sparar också dessa val på den här enheten. Men du ställer in dem vid objektet självt, inte i inställningspanelen.

**Baslinjeöverlägg** — den aktiva baslinjen som en tunn balk under uppgiftsbalken. Standard: på. Var: *Visa › Baslinjer & framdrift › Baslinjeöverlägg*.

**Framdriftslinje** — den sicksackande linjen för framdrift vid rapportdatumet. Standard: på. Effekt: linjen visas bara när projektet har ett rapportdatum. Då ersätter linjen den separata rapportdatumlinjen. Var: *Visa › Baslinjer & framdrift › Framdriftslinje*.

**Rapportdatumlinje** — en prickad linje vid rapportdatumet. Standard: på. Effekt: om framdriftslinjen är på ritar den markeringen själv. Var: *Visa › Baslinjer & framdrift › Rapportdatumlinje*.

**Resursaccent** — en tunn remsa i resursens färg under uppgiftsbalken. Standard: av. Var: *Visa › Baslinjer & framdrift › Resursaccent*.

**Slackband** — slacket som ett område bakom icke-kritiska balkar. Standard: på. Var: *Visa › Baslinjer & framdrift › Slackband*.

**Stapelfärger** — vad färgen på en balk beror på. Välj bland *Kritisk linje*, *Per uppgift — automatiskt* och *Efter kategori*. Standard: *Kritisk linje*. Effekt: gäller för Gantt och för rapporten samtidigt. Var: *Visa › Baslinjer & framdrift › Stapelfärger*.

**Histogram** — remsan med histogrammet under Gantt. Standard: av. Var: *Resurser › Histogram › Histogram*, *Visa › Paneler › Histogram* eller Ctrl+Shift+H. Du ställer in höjden på remsan (standard 160 pixlar, mellan 80 och 480) genom att dra i dess kant.

**Minikarta** — en översiktskarta över tidslinjen. Standard: av. Var: *Visa › Presentation › Minikarta*.

**Komprimera menyfliksområdet** — ett kompakt menyfliksområde. Standard: av. Var: pilknappen längst ned till höger i menyfliksområdet.

**Bredd på uppgiftstabellen** — standard 350 pixlar, mellan 150 och 800. Du ställer in den genom att dra i avdelaren bredvid tabellen. Du kan också använda vänsterpil och högerpil när avdelaren har fokus.

**Bredd på den högra panelen** — standard 280 pixlar, mellan 200 och 900. Du ställer in den genom att dra i panelens kant.

**Höjd på *Egenskaper* och *Varningar* i den högra panelen** — standard 240 och 220 pixlar, mellan 120 och 2000. *Egenskaper* har den höjden även när resurslistan är öppen. Du ställer in höjden med handtaget mellan avsnitten. Appen sparar inte om avsnitten är öppna eller stängda.

**Sparas också, men beskrivs på andra ställen** — kolumnerna i tabellen ([Justera tabellkolumner](docs://howto-tabelkolommen-aanpassen)), dina layouter ([Skapa och använda en layout](docs://howto-layouts-gebruiken)), rapportalternativen ([Rapporttyper](docs://ref-rapporttypes)), dina egna mallar för beräkningsprofiler ([Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies)) och *Dokumentationsspråk* för Hjälp (*Fil › Hjälp*) sparas också av appen på den här enheten, inte i projektfilen.

## Se också

- [Beräkningsalternativ och beräkningsregler](docs://ref-rekenopties-en-conventies): alternativen som hör till ett projekt.
- [Aktivera timplanering](docs://howto-urenplanning-aanzetten): stegen för växeln *Aktivera timplanering*.
- [Dagar och timmar](docs://uitleg-dagen-en-uren): hur appen räknar dagar och timmar.
- [Arbetsregler: varaktighet, tilldelningsenheter och arbete](docs://uitleg-werkregels): vad *Visa arbetsregler och arbete* gör synligt.
- [Kortkommandon](docs://ref-sneltoetsen): alla tangenter i appen, inklusive dem för zoom och scrollning.
