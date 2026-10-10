# Rapporttyper

Varje rapport på fliken *Rapport* har egna alternativ. För varje alternativ står vad det gör, startvärdet, vad som ändras i rapporten och var du hittar det. Hur du gör en rapport och sparar den som PDF står i [Så gör du och skriver ut en rapport](docs://howto-rapport-maken-en-afdrukken).

## Så fungerar rapportfönstret

Öppna fliken *Rapport* (eller tryck på Ctrl+P). Till vänster finns kolumnen *Rapport* med listrutan *Rapporttyp*, blocket *Översikt* med antal, blocket *Inställningar* eller *Rapportalternativ* och längst ned knappen *Exportera PDF*. Till höger finns förhandsvisningen. Det du ser i förhandsvisningen hamnar i PDF:en.

**Rapporttyp** — vilken rapport du ser. Välj bland elva rapporter. Standard: *Gantt-utskrift*. Var: *Rapport*, överst i kolumnen *Rapport*.

**Exportera PDF** — skapar PDF-filen. Effekt: resultatet är bara en PDF. Appen skickar inget till en skrivare. Om tidsplanen är föråldrad beräknar appen först. Om beräkningen ger ett fel, till exempel på grund av en loop i sambanden, skapar knappen ingen fil och visar felet. Var: *Rapport*, längst ned i kolumnen *Rapport*.

**Kommer ihåg.** Appen sparar alla rapportalternativ på den här enheten, för alla dina projekt. De hör inte till projektfilen. Endast fältet *Företag:* i Gantt-utskrift sparas inte.

**Aktuell tidsplan.** Rapporterna använder den senaste beräkningen. Om tidsplanen har ändrats sedan dess visar tabellrapporterna överst *Tidsplanen har ändrats sedan den senaste beräkningen — tryck på Beräkna (F5) för aktuella värden.* Om ingenting har beräknats än står det *Ännu inte beräknat — tryck på Beräkna (F5) för datum och slack.* Om projektet visas i vyn *Datum som registrerats* visar rapporterna datumen från källfilen, och en remsa säger det.

**Förkortningar.** *ad* är arbetsdagar. *TF* är totalt slack, *FF* fritt slack.

## Papper och orientering

**Papper:** — pappersstorleken för PDF:en. Välj mellan A4, A3, A2 och A1. Standard: A3. Effekt: sidorna läggs ut för den storleken. Det finns ett val för alla rapporter: det du väljer för en rapport gäller också för de andra. På stående A4 blir en bred tabell liten, eftersom tabellen skalas till sidans bredd. Var: *Inställningar* (Gantt-utskrift och Resursdiagram) eller *Rapportalternativ* (de sju tabellrapporterna). Milstolpeöversikten och Avvikelse har inga val.

**Orientering:** — liggande eller stående. Välj mellan *Liggande* och *Stående*. Standard: *Liggande*. Effekt: som för *Papper:*. Var: samma ställe som *Papper:*.

## Gantt-utskrift

Tidsplanen visas som ett diagram med balkar, med en tabell till vänster och en tidslinje till höger. Vid behov över flera sidor. Förhandsvisningen visar papperet med sidhuvud, tabell, tidslinje och förklaring. Blocket *Översikt* räknar *Uppgifter:*, *Lövuppgifter:*, *Kritisk:* och *Samband:*. Alla alternativ står under *Inställningar*.

**Företag:** — företaget i sidhuvudet. Standard: företaget från projektinfo. Effekt: bara sidhuvudet i rapporten. Det du skriver här sparas inte. Ändra företaget i *Inställningar › Projekt › Projektinfo*, i fältet *Beställare/organisation*, och bekräfta med *Tillämpa*.

**Författare:** — författaren i sidhuvudet. Skrivskyddad: appen hämtar den från projektinfo.

**Teckenstorlek:** — storleken på text och tabell i rapporten. Välj mellan 90%, 100%, 110% och 125%. Standard: 100%. Effekt: med en större teckenstorlek blir text, rader och tabell större, och tidslinjen blir smalare. Oberoende av *Textstorlek* i inställningarna.

**Stapelfärger:** — vad färgen på en balk beror på. Välj mellan *Kritisk linje*, *Per uppgift — automatiskt* och *Efter kategori*, med en listruta *Kategorifält* för *Efter kategori*. Standard: *Kritisk linje*. Effekt: samma val som *Stapelfärger* på fliken *Visa*. Om du ändrar det här ändras också Gantt-diagrammet på skärmen. Finns det valda fältet inte i projektet, står det *Det här fältet finns inte i projektet. Uppgiftstyp används tillfälligt.*

**Statuslinje:** — en linje vid rapportdatumet. Välj mellan *Ingen*, *Rapportdatumlinje* och *Framdriftslinje*. Standard: *Ingen*. Effekt: *Rapportdatumlinje* ritar en linje vid rapportdatumet. *Framdriftslinje* ritar den sicksackade linjen som bugtar mot framdriften för varje uppgift. Har projektet inget rapportdatum, står det *Ange först ett rapportdatum* och rapporten ritar ingenting.

**Följa vyn (filter, gruppering, sortering)** — bara för Gantt-utskrift. Standard: av. Effekt: av lägger hela uppgiftsträdet på papper. På ritar exakt de rader som syns på skärmen: med ditt filter, din gruppering, sortering och ihopfällda faser.

**Anpassa till papper** — skala tidslinjen till sidans bredd. Standard: på. Effekt: på skalar tidslinjen till sidans bredd. Antalet sidor följer av höjden. Av använder en fast skala (*Zoom:*) och delar också upp tidslinjen över bredden, vilket snabbt ger många sidor.

**Zoom:** — den fasta skalan för tidslinjen. Syns bara när *Anpassa till papper* är av. Reglage från 1 till 40. Standard: 22. Effekt: ett större värde gör tidslinjen bredare, så att det blir fler sidor i bredd.

**Tidslinjen över:** — sprider tidslinjen över fler sidbredder. Val från 1 till 8 sidor. Standard: 1 sida. Effekt: bara med *Anpassa till papper*. Annars är valet inaktivt och det står *Endast med anpassning*. Bra för en lång tidsplan som du vill skriva ut i läsbar storlek.

**Upprepa sidhuvud på varje sida** — Standard: på. Effekt: på visar sidhuvudet på varje sida. Av visar det bara på den första.

**Upprepa sidfot på varje sida** — Standard: på. Effekt: på visar sidfoten (projektnamn, utskriftsdatum och förklaring) på varje sida. Av visar den bara på den sista. Ett underlag utan förklaring går inte att läsa, därför är det på som standard.

**Uppgiftsnamn på balkar** — Standard: på. Effekt: namnet på uppgiften står på balken, där det finns plats.

**Visa slutförandegrad** — Standard: på. Effekt: en mörkare del i balken upp till uppgiftens framdrift, och kolumnen *Slutf*.

**Korta av uppgiftsnamn** — Standard: på. Effekt: på kortar av namnen i tabellen vid bredden för *Namnkolumn:*. Av låter kolumnen växa med det längsta namnet. Då står det *Namnkolumnen anpassar sig efter det längsta uppgiftsnamnet*.

**Namnkolumn:** — bredden på namnkolumnen. Syns bara när *Korta av uppgiftsnamn* är på. Reglage från 60 till 400. Standard: 130.

**Visa baslinjeöverlägg** — den aktiva baslinjen bredvid balkarna. Standard: av. Effekt: en tunn balk i baslinjens färg under uppgiftsbalken, bara för uppgifter som finns i baslinjen.

**Kritisk linje** — Standard: på. Effekt: styr bara de röda sambandslinjerna mellan två kritiska uppgifter och raden i förklaringen. Balkarna följer *Stapelfärger:*, oavsett den här kryssrutan.

**Visa slack** — Standard: på. Effekt: slacket som en remsa bakom icke-kritiska balkar.

**Samband** — sambandslinjerna. Standard: på. Effekt: ritar pilar mellan balkarna.

**Visa endast arbetsdagar** — komprimerar tidsaxeln i den här rapporten. Standard: av. Effekt: helger och helgdagar hoppas över, och veckoremsor ersätter då helgmarkeringen. Oberoende av samma inställning för Gantt-diagrammet på skärmen.

**Helger** — Standard: på. Effekt: markerar helger och helgdagar i tidslinjen, så länge skalan gör dagarna skiljbara. På den komprimerade axeln (*Visa endast arbetsdagar*) har den här kryssrutan ingen effekt.

**Förklaring** — Standard: på. Effekt: förklaringen i sidfoten.

**Kvalitet på förhandsvisningen** — hur skarp förhandsvisningen är. Välj mellan *Standard*, *Hög* och *Maximal*. Standard: *Hög*. Effekt: bara skärpan i förhandsvisningen på skärmen. PDF:en ändras inte. Var: *Rapport*, ovanför förhandsvisningen.

## Resursdiagram

Samma balkar som i Gantt-utskrift, grupperade per resurs: vem gör vad och när. Blocket *Översikt* räknar *Resurser:*, *Tilldelningar:* och *Utan resurs:* (med en period också *Utanför perioden:*). Diagrammet delar alla alternativ för Gantt-diagrammet, utom *Följa vyn (filter, gruppering, sortering)*, *Kritisk linje* och *Samband*. Raderna kommer inte från skärmen, en uppgift kan visas under flera resurser, och sambanden ritas inte där. Kryssrutan *Kritisk linje* är dold och på. Det hör till alternativen för Gantt-diagrammet under *Inställningar*, med de här fyra kryssrutorna och perioden:

**Varje resurs på en ny sida** — Standard: av. Effekt: varje resurs börjar på en ny sida, så att du kan dela ut ett blad per arbetslag eller anställd. Av ger ett sammanhängande dokument.

**Ta med uppgifter utan resurs** — Standard: av. Effekt: uppgifterna utan resurs kommer som sista grupp i diagrammet, så att du ser vad ingen har tagit än.

**Gruppera efter resurstyp** — Standard: av. Effekt: ett extra lager ovanpå: först en grupp per resurstyp (arbetskraft, arbetslag, underentreprenör, utrustning, material), och inom den en grupp per resurs.

**Visa enheter/dag och kurva** — Standard: på. Effekt: två kolumner efter uppgiftsnamnet med tilldelningsenheterna per dag och fördelningskurvan för resursen i den gruppen. Finns det för lite plats för tidslinjen, lämnar rapporten bort kolumnerna och står det *Kolumnerna Enh/d och Kurva utelämnades: …*. Mer plats får du med ett större papper eller liggande, en mindre teckenstorlek eller en smalare tabell.

**Rapportperiod:** — bara de uppgifter som rör perioden. Standard: *Hela projektet*. Effekt: tidsaxeln går exakt över perioden. Finns det inget i perioden, står det *Inga uppgifter i rapportperioden — välj en annan period eller Hela projektet.* Se *Rapportperiod* nedan.

## Milstolpeöversikt

Alla milstolpar i projektet i en tabell. Inga egna alternativ. Blocket *Översikt* räknar *Milstolpar*, *Obligatoriska* och *Försenade*. Kolumnerna är *WBS*, *Namn*, *Typ* (*Automatisk*, *Start* eller *Slut*), *Datum*, *Restriktion/måldatum*, *Slack*, *Obligatorisk* och *Status*. Statusen är *Försenad* om en restriktion är överträdd, ett måldatum har passerats eller det totala slacket är negativt. Annars är den *Kritisk* om milstolpen är kritisk enligt projektets definition av kritisk. Annars är den *Enligt tidsplan*. Utan milstolpar står det *Inga milstolpar i det här projektet.* PDF:en använder det papper och den orientering du senast valde för en annan rapport.

## Avvikelse

Den aktuella tidsplanen bredvid den aktiva baslinjen, för lövuppgifter. Inga egna alternativ. Blocket *Översikt* räknar *Uppgifter*, *Försenade* och *Tidigare* och visar *Projektslut: +3 arbetsdagar* (skillnaden i arbetsdagar mellan baslinjens slut och det aktuella slutet). Kolumnerna är *WBS*, *Namn*, *Baslinje start*, *Baslinje slut*, *Aktuell start*, *Aktuellt slut*, *Δ start (ad)*, *Δ slut (ad)* och *Status*. Statusen följer slutet: *Försenad* om slutet är senare än i baslinjen, *Tidigare* om det är tidigare, annars *Enligt tidsplan*. *Ny* är en uppgift som inte finns i baslinjen. *Bortfallen* är en uppgift som finns i baslinjen men inte längre i tidsplanen. Utan en aktiv baslinje står det *Ingen aktiv baslinje — spara en baslinje eller välj en som aktiv.* PDF:en använder det papper och den orientering du senast valde för en annan rapport.

## Look-ahead

Vad som pågår eller startar under perioden: listan för det veckovisa mötet. Alternativ under *Rapportalternativ*.

**Rapportperiod:** — rapportens fönster. Standard: *Nästa månad*. Effekt: rapporten innehåller de ej slutförda uppgifterna som rör perioden, även om de sträcker sig över hela perioden. Den innehåller också försenade uppgifter från före referensdagen. Det gäller så länge periodens slut inte ligger före referensdagen.

**Nära kritisk ≤ (ad):** — tröskelvärdet för *Nära kritisk*. Tal från 0 till 60. Standard: 5. Effekt: en uppgift med mer än 0 och högst så många arbetsdagar totalt slack räknas som nära kritisk. Vid 0 räknas bara det som projektets beräkningsalternativ *Markera nära kritisk* markerar.

Blocket *Översikt* räknar *Uppgifter*, *Försenade*, *Pågår*, *Skulle ha startat*, *Startar*, *Kritisk* och *Nära kritisk*. Statusen per rad, alltid relativt referensdagen: *Försenad* (inte slutförd och slutet är före referensdagen), *Skulle ha startat* (inte startad, fast starten var före referensdagen), *Pågår* och *Startar* (den senare: inte startad än, startar i fönstret). Kolumnerna är *WBS*, *Namn*, *Start*, *Slut*, *Kvar (ad)*, *Slutf*, *TF (ad)*, *Kritisk*, *Resurser* och *Status*.

## Kritisk och nära kritisk

De uppgifter som bestämmer projektets slut och de som nästan gör det. Alternativ under *Rapportalternativ*.

**Nära kritisk ≤ (ad):** — Standard: 5. Tal från 0 till 60. Effekt och betydelse som vid Look-ahead. Underrubriken anger det valda tröskelvärdet.

Rapporten innehåller de ej slutförda uppgifter som är kritiska (enligt beräkningsmotorn och projektets definition av kritisk) eller nära kritiska. De sorteras efter slackväg, sedan efter totalt slack och sedan efter start. Blocket *Översikt* räknar *Kritisk*, *Nära kritisk*, *Kritiska kedjor* och *Lövuppgifter*. Kolumnerna är *WBS*, *Namn*, *Start*, *Slut*, *Kvar (ad)*, *TF (ad)*, *FF (ad)*, *Linje* och *Status*. Kolumnen *Linje* visar slackvägen om beräkningsalternativet *Flera slackvägar* är på. Annars visar den ett streck.

## Framdriftsrapport

Var projektet står på rapportdatumet. Alternativ under *Rapportalternativ*.

**Rapportperiod:** — Standard: *Förra månaden*. Effekt: *Slutförda under förra perioden* räknar inom perioden. *Startar under nästa period* blickar framåt från rapportdatumet, upp till *Look-ahead t.o.m*. Med en *Förra*-period sträcker det sig lika långt framåt som perioden blickar bakåt.

**Nära kritisk ≤ (ad):** — Standard: 5. Som vid Look-ahead.

Blocket *Översikt* visar *Rapportdatum*, *Period*, *Look-ahead t.o.m*, *Baslinje slut*, *Prognostiserat slut*, *Δ slut (ad)*, *Planerat* (med *(baslinje)* eller *(aktuell tidsplan)*), *Verkligt*, och antalen *Slutförd*, *Pågår*, *Inte startad*, *Försenade* och *Kritisk*. Planerat och verkligt viktas efter uppgifternas varaktighet. Planerat mäts mot baslinjen om det finns en aktiv baslinje. Annars mäts det mot den aktuella tidsplanen. Avsnitten är *Slutförda under förra perioden*, *Pågår*, *Startar under nästa period*, *Försenade* och *Öppna kritiska uppgifter*. En uppgift kan finnas i mer än ett avsnitt.

## Tidsplanens hälsa

En kontroll av tidsplanen själv på fel och ovanliga värden, med DCMA 14-punktsbedömningen överst. Alternativ under *Rapportalternativ*.

**Hög slack > (ad):** — Tal från 1 till 365. Standard: 44. Effekt: en uppgift som inte är klar, med mer totalt slack än detta, hamnar under *Hög slack*.

**Lång varaktighet > (ad):** — Tal från 1 till 365. Standard: 44. Effekt: en uppgift som inte är klar, och inte en milstolpe, med längre varaktighet hamnar under *Lång varaktighet*.

**Fördröjning > (ad):** — Tal från 0 till 365. Standard: 10. Effekt: ett samband med mer fördröjning hamnar under *Lång fördröjning*. Överlapp rapporteras alltid.

**Nära kritisk ≤ (ad):** — Tal från 0 till 60. Standard: 5. Effekt: avgör kontrollen *Nära kritisk*.

Avsnittet *DCMA 14-punktsbedömning* står först. Det följer de fjorton kontrollerna från det amerikanska Defense Contract Management Agency, med formlerna och normerna från deras *EVMS Program Analysis Pamphlet* (DCMA-EA PAM 200.1, oktober 2012). Per punkt ser du *Antal*, *Av* (det totala antalet som räknades), *Värde*, *Norm*, *Resultat* och *Förklaring*. Resultatet är *Godkänd*, *Markering* eller *ej tillämplig*. Vid *ej tillämplig* står skälet i förklaringen. En markering är inget fel: pamfletten kallar den en anledning att titta närmare. Normerna under *Rapportalternativ* gäller inte för det här avsnittet; det använder alltid normerna från pamfletten.

Den räknar lövuppgifter som inte är klara, utan milstolpar och hängmattor, och de samband som leder in till sådana uppgifter. Noten över rapporten anger båda talen. De fjorton punkterna:

- *Logik*: uppgifter utan föregående eller efterföljande. Norm: högst 5 %.
- *Överlapp*: samband med fördröjning under noll. Norm: ingen.
- *Fördröjningar*: samband med en positiv fördröjning, hur kort den än är. Norm: högst 5 %.
- *Sambandstyper*: andelen FS-samband. Norm: minst 90 %.
- *Hårda restriktioner*: uppgifter med en obligatorisk restriktion eller en MSO, MFO, SNLT eller FNLT. Norm: högst 5 %.
- *Hög slack*: uppgifter med mer än 44 arbetsdagar i totalt slack. Norm: högst 5 %. Kräver en beräkning.
- *Negativt slack*: uppgifter med ett totalt slack under 0. Norm: ingen. Kräver en beräkning.
- *Hög varaktighet*: uppgifter längre än 44 arbetsdagar. Räknar baslinjens varaktighet om uppgiften finns i den aktiva baslinjen, annars den aktuella varaktigheten. Norm: högst 5 %.
- *Ogiltiga datum*: en verklig start eller ett verkligt slut efter rapportdatumet, eller en prognostiserad start eller ett prognostiserat slut före rapportdatumet. Norm: ingen. Kräver ett rapportdatum.
- *Resurser*: uppgifter utan resurs. Norm: ingen. Bara om projektet använder resurser; annars *ej tillämplig*.
- *Missade uppgifter*: av de uppgifter som baslinjen säger ska vara klara senast på rapportdatumet, andelen som blir klar senare eller prognostiseras senare. Norm: högst 5 %. Kräver ett rapportdatum och en aktiv baslinje.
- *Test av kritisk linje*: appen förlänger en kritisk uppgift med 100 arbetsdagar och beräknar om på en kopia, utan att ändra projektet. Testet är godkänt om projektets sista uppgift då inte slutar före den uppgiften. Det testar den kritiska, ej klara uppgiften med den tidigaste starten; förklaringen anger uppgiften och hur många arbetsdagar slutet flyttades.
- *CPLI*: (den kritiska linjens längd + slack) / den kritiska linjens längd. Längden räknar arbetsdagarna från rapportdatumet till slutet av den sista uppgiften. Slacket är skillnaden med baslinjens slut för den uppgiften, eller det beräknade slacket om uppgiften inte finns i baslinjen. Norm: minst 0,95. Kräver ett rapportdatum.
- *BEI*: antalet uppgifter som är klara på rapportdatumet, delat med antalet som baslinjen säger ska vara klara då, plus uppgifterna utan baslinje. Norm: minst 0,95. Kräver ett rapportdatum och en aktiv baslinje.

Två punkter skiljer sig från pamfletten, eftersom appen saknar begreppet: *Hög varaktighet* räknar varje uppgift som inte är klar, medan pamfletten begränsar den till den detaljerade planeringsperioden (rolling wave). *Resurser* tittar bara på tilldelade resurser, inte på kostnader. Pamfletten ger inget tal för testet av kritisk linje; de 100 arbetsdagarna är appens eget val.

Kontrollerna står i den här ordningen, med deras allvarlighetsgrad. Fel: *Negativt slack*, *Missat måldatum*, *Överträdd restriktion* och *Inkonsekvent framdrift* (verklig start eller verkligt slut efter rapportdatumet, prognostiserad start eller prognostiserat slut före rapportdatumet, 100 % utan ett verkligt slut, ett verkligt slut men inte 100 %, framdrift utan en verklig start). Varning: *Utan föregående (öppen start)* och *Utan efterföljande (öppet slut)* (inte milstolpar), *Lång varaktighet*, *Överlapp (fördröjning under noll)*, *Hård restriktion* (en obligatorisk restriktion eller en MSO, MFO, SNLT eller FNLT), *Framdrift i fel ordning* och *Missad uppgift (mot baslinje)*. Info: *Nära kritisk*, *Hög slack*, *Lång fördröjning*, *Samband annat än FS* och *Utan resurs* (bara om projektet använder resurser). Rapporten kontrollerar bara lövuppgifter som inte är hängmattor. Blocket *Översikt* räknar *DCMA-flaggor*, *Fel*, *Varningar*, *Information*, *Lövuppgifter* och *Samband*. Under DCMA-avsnittet finns avsnittet *Översikt* (per kontroll allvarlighetsgraden och antalet) och avsnittet *Iakttagelser* (varje uppgift eller varje samband). Utan beräkning saknas de kontroller som kräver slack.

## Resursbelastning

Per resurs, per vecka eller månad, vad som krävs jämfört med vad som finns tillgängligt. Alternativ under *Rapportalternativ*.

**Rapportperiod:** — Standard: *Hela projektet*. Effekt: varje vecka eller månad som berörs av perioden tas med i sin helhet. Då visar en rad samma tal som histogrammet.

**Sammanställning:** — Välj *Per vecka* eller *Per månad*. Standard: *Per vecka*. Effekt: en rad per kalendervecka (kolumnen *Vecka från*, med måndagen) eller per kalendermånad (kolumnen *Månad*).

**Endast perioder med överbeläggning** — Standard: av. Effekt: på visar bara veckorna eller månaderna med minst en dag med överbeläggning.

Kolumnerna är *Resurs*, *Typ*, *Vecka från* eller *Månad*, *Behov*, *Tillgänglig*, *Avvikelse* (tillgänglig minus behov; ett negativt tal betyder brist), *Topp/dag* och *Överbeläggning*. *Behov* är summan av tilldelningsenhetsdagar. Bara veckor eller månader med behov ingår. Blocket *Översikt* räknar *Resurser*, *Veckor* eller *Månader*, *Veckor med överbeläggning* eller *Månader med överbeläggning* och *Resurser med överbeläggning*.

## Resurstilldelningar

Per resurs, de uppgifter den är kopplad till: vad gör det här teamet eller den här kranen? Alternativ under *Rapportalternativ*.

**Rapportperiod:** — Standard: *Hela projektet*. Effekt: med en period tas bara med tilldelningar för uppgifter som berörs av perioden, plus försenat arbete från före referensdagen. *Hela projektet* filtrerar inte på datum.

**Ta med klara uppgifter** — Standard: av. Effekt: på tar också med tilldelningarna för klara uppgifter.

Raderna visas per resurs, och inom en resurs efter start. Blocket *Översikt* räknar *Resurser*, *Tilldelningar* och *Uppgifter utan resurs*. Kolumnerna innehåller resursen, uppgiften, start och slut, *Kvar (ad)*, *Enh./dag*, *Slutf*, *Kritisk* och *Status*.

## WBS-översikt

Tidsplanen sammanställd per WBS-element: den överblick som ledningen använder. Alternativ under *Rapportalternativ*.

**Nivå:** — till vilken nivå WBS visas. Välj *Hela WBS* och nivåerna 1 till 8. Standard: nivå 2. Effekt: underrubriken säger *Upp till nivå 2*.

**Visa uppgifter** — Standard: av. Effekt: på visar också lövuppgifterna under varje element.

Kolumnerna innehåller *WBS*, *Namn*, *Start*, *Slut*, *Baslinjestart*, *Baslinjeslut*, *Varaktighet (ad)*, *Slutf*, *Δ slut (ad)*, *Min. TF*, *Upp* (antal uppgifter), *Krit*, *Pågår* och *Klart*. Start och slut för en sammanfattningsuppgift kommer från den senaste beräkningen. Framdriften viktas efter varaktighet över lövuppgifterna. *Min. TF* och antalen gäller lövuppgifterna under elementet. Blocket *Översikt* räknar *WBS-element* och *Uppgifter*.

## Rapportperiod

Fyra tabellrapporter och resursdiagrammet använder en *Rapportperiod:*: *Look-ahead*, *Framdriftsrapport*, *Resursbelastning*, *Resurstilldelningar* och *Resursdiagram*. Varje rapport kommer ihåg sin egen period. Under rullistan finns *Från* och *Till*, med de datum som valet ger.

**Referensdag.** En period med *Nästa* eller *Senaste* räknar från projektets rapportdatum, eller från idag om det inte finns något rapportdatum. Då visar tabellrapporterna *Inget rapportdatum angivet — rapporten räknar med idag (…).* Flyttar du rapportdatumet, så följer fönstret med. Båda dagarna ingår.

**Nästa vecka, Nästa 2 veckor, Nästa 4 veckor, Nästa 6 veckor, Nästa 8 veckor, Nästa 12 veckor** — från referensdagen, 7 dagar per vecka. Med rapportdatum torsdag 20 maj går *Nästa vecka* från 20 till och med 26 maj och *Nästa 4 veckor* från 20 maj till och med 16 juni.

**Senaste veckan, Senaste 2 veckorna, Senaste 4 veckorna, Senaste 6 veckorna, Senaste 8 veckorna, Senaste 12 veckorna** — samma sex, men räknat bakåt: 7 dagar per vecka, till och med referensdagen. *Senaste 2 veckorna* går från 7 till och med 20 maj, med referensdagen 20 maj.

**Nästa månad, Förra månaden** — en kalendermånad framåt eller bakåt, till en dag före samma datum i den andra månaden. *Nästa månad* går till och med 19 juni med referensdagen 20 maj; *Förra månaden* går från 21 april till och med 20 maj.

**Hela projektet** — från den första starten till det sista slutet i tidsplanen.

**Anpassad** — din egen period. Effekt: *Från* och *Till* blir två datumfält. De börjar med datumen för valet du nyss hade. Slutdatumet får inte ligga före startdatumet (*Slutdatumet ligger före startdatumet.*) och båda fälten måste fyllas i (*Fyll i båda datumen.*). Är inmatningen inte rätt, så stannar rapporten kvar på den senaste giltiga perioden.

## Se även

- [Göra och skriva ut en rapport](docs://howto-rapport-maken-en-afdrukken): hela vägen från rapporttyp till PDF.
- [Välja rapportperiod](docs://howto-rapportageperiode-kiezen): steg och exempel.
- [Kritisk linje och slack](docs://uitleg-kritiek-pad): vad kritisk och nära kritisk betyder.
- [Framdrift, rapportdatum och baslinje](docs://uitleg-voortgang): rapportdatumet och baslinjen som rapporterna använder.
- [Lösa överbeläggning](docs://howto-overbezetting-oplossen): vad du gör med veckorna med överbeläggning från Resursbelastning.
- [Import- och exportformat](docs://ref-import-exportformaten): PDF bredvid de andra formaten.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): två baslinjer med framdrift och ett rapportdatum, för att titta på avvikelserapporten.
