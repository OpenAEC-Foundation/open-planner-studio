# Een rapport maken en afdrukken

Doel: een rapport van je planning kiezen, in het voorbeeld controleren en als PDF opslaan, zodat je het kunt uitdelen of zelf afdrukken.

## Wanneer je dit nodig hebt

Vrijdag is het bouwoverleg. De opdrachtgever wil de planning op papier, de uitvoerder wil weten wat de komende weken start en de ploegbaas wil een blad met alleen zijn eigen taken. Zulke overzichten maak je op het tabblad *Rapport*. De app rekent ze uit je planning en toont ze eerst als voorbeeld. Daarna exporteer je ze naar een PDF.

De app stuurt een rapport niet zelf naar een printer. Het eindpunt is altijd een PDF. Die druk je af met je PDF-lezer, of mail je door.

## Stappen

### 1. Open het tabblad Rapport

Kies *Rapport* in het lint, of druk op Ctrl+P. Ctrl+P brengt je naar dit tabblad. Typ je in een veld, staat er een dialoog open of staat de presentatiemodus aan, dan werkt Ctrl+P niet. In de browser opent dan het printvenster van de browser, en dat drukt het scherm af, niet het rapport.

Vanuit het bestandsmenu kies je *Bestand › Afdruk › Open afdrukvoorbeeld*. Het bestandsmenu sluit en het tabblad Rapport opent. Daarna kies je het rapport en de instellingen.

Bij de Gantt-afdruk staat links een zijbalk met de keuzelijst *Rapporttype* en vijf stappen. Rechts staat het papier. Lees daarvoor [De Gantt-afdruk](docs://howto-rapport-maken-en-afdrukken#de-gantt-afdruk) hieronder. Bij de andere rapporten staat links de kolom *Rapportage* met de keuzelijst *Rapporttype*, een overzicht en de instellingen. Rechts staat het rapport.

### 2. Kies het rapporttype

De keuzelijst *Rapporttype* heeft elf rapporten. Kies het rapport dat bij je vraag past.

- *Gantt-afdruk*: de planning als balkenplan, voor de gewone uitdeelplanning. Wil je per resource een band, voor "wat doet ploeg X?", kies dan in de stap *Taken en groepering* de layout *Resourcediagram*.
- *Mijlpalen-overzicht*: alle mijlpalen met datum en status.
- *Variance*: de huidige planning naast de actieve baseline. Voor "hoeveel zijn we opgeschoven?".
- *Look-ahead*: wat de komende periode loopt of start. Het lijstje voor het weekoverleg.
- *Kritiek & near-critical*: de activiteiten zonder of bijna zonder speling.
- *Voortgangsrapport*: waar het project staat op de statusdatum, de dag waarop je de voortgang peilt.
- *Voortgangscurve*: kerncijfers en een S-curve van de geplande en de werkelijke voortgang.
- *Planningsgezondheid*: een controle van de planning zelf op fouten en ongewone waarden.
- *Resourcebelasting*: per resource per week of maand wat er gevraagd wordt tegenover wat beschikbaar is.
- *Resourcetoewijzingen*: per resource de activiteiten waaraan hij hangt.
- *WBS-samenvatting*: de planning per WBS-niveau opgerold, voor het management.

### 3. Zorg dat de planning actueel is

De app rekent niet vanzelf. Heb je taken, relaties of kalenders gewijzigd sinds de laatste berekening, druk dan op **Bereken** (F5). De tabelrapporten waarschuwen zelf, bovenaan het rapport: *De planning is gewijzigd sinds de laatste berekening — druk op Bereken (F5) voor actuele waarden.* Of, als er nog nooit is gerekend: *Nog niet berekend — druk op Bereken (F5) voor datums en speling.*

Het tabblad Rapport heeft geen lint en dus geen Bereken-knop, maar F5 werkt hier gewoon. *PDF exporteren* en *Exporteer PDF* rekenen bovendien zelf eerst door als de planning verouderd is, zodat de PDF nooit achterloopt op je planning.

### 4. Stel het rapport af

De Gantt-afdruk stel je af in de vijf stappen van de zijbalk; zie [De Gantt-afdruk](docs://howto-rapport-maken-en-afdrukken#de-gantt-afdruk). Look-ahead, Kritiek & near-critical, Voortgangsrapport, Voortgangscurve, Planningsgezondheid, Resourcebelasting, Resourcetoewijzingen en WBS-samenvatting hebben *Papier:*, *Oriëntatie:* en *Lettertype:*, plus een blok *Rapportopties* met de keuzes van dat rapport. Het Mijlpalen-overzicht en de Variance hebben geen eigen keuzes. Voor de periode van een rapport zie [De rapportageperiode kiezen](docs://howto-rapportageperiode-kiezen).

- *Papier:* en *Oriëntatie:* bepalen het vel. Standaard staat dit op A3 liggend, wat voor een bouwplanning handig is, maar niet elke printer drukt A3 af. Heb je een A4-printer, kies dan nu A4: de app legt de pagina's dan voor A4 op, in plaats van dat je ze later moet laten krimpen.
- *Lettertype:* kiest de letter van alle rapporten: *Inter* (standaard), *Liberation Sans* (zoals Arial), *Carlito* (zoals Calibri) of *Liberation Serif* (zoals Times New Roman). De keuze geldt voor elk rapport, net als het papier.

### 5. Controleer het rapport

Bij de Gantt-afdruk zie je het papier met paginakop, tabel, tijdlijn en legenda. Het papier op het scherm is gelijk aan de PDF: dezelfde pagina's, en namen en datums worden op dezelfde plek afgekapt.

De overige rapporten staan als tabel op het scherm. Wat je ziet is wat in de PDF komt.

### 6. Exporteer naar PDF

Klik onder aan de kolom links op **PDF exporteren** (Gantt-afdruk) of **Exporteer PDF** (de andere rapporten). De knop exporteert het gekozen rapport met je huidige instellingen naar PDF. De voorgestelde bestandsnaam is de projectnaam gevolgd door de soort rapport, bij de Gantt-afdruk bijvoorbeeld *Aanbouw woning-planning.pdf*. Het rapportdeel volgt de interfacetaal: een voortgangsrapport krijgt in het Nederlands `-voortgang.pdf` en in het Engels `-progress.pdf`. De projectnaam blijft gelijk; eerder opgeslagen bestanden worden niet hernoemd.

- In de desktopapp, en in een browser die een opslagdialoog voor bestanden kent, kies je waar de PDF komt. Sluit je die dialoog zonder te bewaren, dan gebeurt er niets.
- In een browser zonder zo'n dialoog zet de browser de PDF in je downloadmap.

### 7. Druk de PDF af

Open de PDF in je PDF-lezer en druk hem daar af. Print je een A3-PDF op een A4-printer, dan moet je printvenster de pagina's verkleinen. Stel het papierformaat daarom liever eerst in bij stap 4.

## De Gantt-afdruk

De andere rapporten kies je met hun naam in de keuzelijst *Rapporttype* bovenaan; die openen het tabblad zoals hierboven beschreven. Het Resourcediagram is geen eigen rapport: het is een layout in de stap *Taken en groepering*. Een eerder gekozen Resourcediagram opent als de Gantt-afdruk met die layout.

Links staat een zijbalk met vijf stappen, in de volgorde van het papier: *Taken en groepering*, *Kolommen*, *Balken en tijdlijn*, *Pagina* en *Kop en voet*. Onderaan staan de naam van het bestand en de knop *PDF exporteren*. De knop rechts naast de keuzelijst klapt de zijbalk in; ingeklapt toont hij een ander icoon en klapt hij hem weer uit. Er staat één stap open. Een dichte stap toont kort wat je koos. Een oranje stip bij het nummer betekent dat de stap afwijkt van de standaard. Een melding staat direct onder de keuze die hem geeft; een open stap met een melding heeft een waarschuwingsteken naast de titel. Bij je eerste bezoek staat stap 1 open; daarna opent de stap die je het laatst gebruikte. Het aantal pagina's staat boven het papier; lopen de bladen ook naast elkaar, dan staat erbij hoeveel naast en onder elkaar, bijvoorbeeld *12 pagina's: 6 naast elkaar, 2 onder elkaar*.

- **Taken en groepering: alle taken, de weergave of een layout.** In de stap *Taken en groepering* kies je welke rijen op papier komen. *Alle taken* geeft de hele takenboom. *Zoals de weergave* neemt het filter, de groepering, de sortering en de ingeklapte groepen van je huidige Gantt-diagram over, en ook de kolommen van de tabel naast de Gantt. Die kolommen volgen de tabel live; in de stap *Kolommen* zie je ze, maar wijzig je ze in de tabel zelf. Ook de balkkleuren volgen dan je scherm. Je eigen rapportkolommen en balkkleuren blijven bewaard en gelden weer zodra je *Alle taken* of een layout kiest. Onder *Layouts* staan dezelfde layouts als op het lint, met dezelfde naam en hetzelfde icoon: het meegeleverde *Resourcediagram*, je eigen layouts en je opgeslagen filters. Een layout geldt alleen voor het rapport; je Gantt-diagram verandert niet. Het rapport volgt de layout: verander je hem later, dan verandert het papier mee. Verwijder je hem, dan toont het rapport weer alle taken, met een melding.
- **Wat een layout meeneemt.** Het filter, de groepering en de sortering bepalen de rijen. Die volgen de layout live. Een deel dat de layout niet heeft, staat zoals bij *Alle taken*. Kolommen en balkopties neemt het rapport alleen over als je op een knop klikt. Het i-icoon naast het kopje *Layouts* vat dit kort samen. Heeft de layout andere kolommen of balkopties dan het rapport, dan staat onder de keuze een melding met *Kolommen overnemen* en *Balkopties overnemen*. Balkopties zijn *Afhankelijkheden*, de basislijn, de speling, de statuslijn en de balkkleuren. Na zo'n klik staat boven het papier *Ongedaan maken*. Dat zet alleen dat deel terug; de layout blijft gekozen. Neem je daarna ook het andere deel over, dan zet één klik op *Ongedaan maken* beide terug. Een andere keuze in *Taken en groepering*, met de muis of met de pijltjes, verandert je kolommen en balkopties nooit. Een klik op de keuze die al gekozen is, doet niets. De tijdschaal van een layout telt niet mee: de schaal kies je in *Pagina*. Gebruikt het filter van de layout een veld dat niet in dit project staat, bijvoorbeeld een verwijderd eigen veld, dan staat onder de keuze een melding. Het filter blijft zoals het is; pas het aan in *Layouts beheren*.
- **Per resource.** Groepeert de layout op resource, zoals het *Resourcediagram*, dan krijgt elke resource een eigen band, ook als twee resources dezelfde naam hebben. Een taak met twee resources staat onder beide banden. Onder *Per resource* kies je *Elke resource op een nieuwe pagina*, *Taken zonder resource meenemen*, *Groeperen op resourcetype*, *Eenheden/dag en curve tonen* en een periode; daaronder staat hoeveel resources en toewijzingen er zijn. De relatielijnen staan dan uit, want een taak staat onder meer banden. Je eigen keuze bij *Afhankelijkheden* blijft bewaard en geldt weer bij een andere keuze. *Kritiek pad* staat vast aan: kleuren de balken op kritiek pad, dan staat het kritieke pad in de legenda. De kleur van de balken kies je altijd bij *Balkkleuren*. Met *Eenheden/dag en curve tonen* staan de kolommen *Eenh./d* en *Curve* achter de taaknaam. Ze staan niet in de stap *Kolommen*; een klik op zo'n kolom op het papier brengt je naar deze schakelaar.
- **Balken en tijdlijn.** In de stap *Balken en tijdlijn* kies je onder meer de balkkleuren, de relatielijnen, de speling, de baseline en een *Statuslijn*: een statusdatumlijn of een voortgangslijn.
- **Pagina.** In de stap *Pagina* kies je *Papier*, de stand, *Lettertype*, de lettergrootte en de schaal van de tijdlijn. Een grotere letter laat minder ruimte over voor de tijdlijn.
- **Klik op het papier.** Beweeg over het blad: het deel onder de muis licht op en boven het blad staat zijn naam, bijvoorbeeld *Kolommen · Start*. Klik je, dan opent de stap van dat deel. Een klik op een kolom laat die kolom oplichten in de stap *Kolommen*.
- **Kolommen.** *Kolom toevoegen* opent hetzelfde venster als in de tabel. Typ een deel van de naam of open een categorie, en klik op de kolom. Het venster sluit en de kolom staat onderaan de lijst. Versleep een kolom aan de puntjes, of gebruik Alt met pijl omhoog of omlaag. Onder *Kolommen overnemen van* staan twee knoppen. *Tabblad Tabel* neemt de kolommen van het tabblad Tabel over, *Tabel naast de Gantt* die van de takentabel naast de Gantt. De twee tabellen kunnen verschillende kolommen hebben. Na zo'n klik staat boven het papier *Ongedaan maken*. De taaknaam is verplicht: zijn kruisje staat uit. Bij *Afkappen* stel je de breedte van de naamkolom in millimeter op papier in. Koos je bij *Taken en groepering* voor *Zoals de weergave*, dan volgen de kolommen de tabel naast de Gantt en kun je ze hier niet toevoegen, verplaatsen of weghalen.
- **Hele blad en Breedte.** Rechtsboven kies je hoe het papier in beeld past. *Hele blad* (standaard) toont één heel blad. *Breedte* vult de breedte van het venster met één blad. Loopt de tijdlijn over meer pagina's naast elkaar, dan zet *Hele rij* de bladen van een rij naast elkaar. Met − en + of Ctrl+scrollen zoom je; het percentage geldt ten opzichte van de ware grootte van het papier. De toets 0 zet *Hele blad* terug. *Hele blad* gaat naar de bovenkant van het blad dat het meest in beeld stond. Na een wissel van papier of stand staat blad 1 weer bovenaan.
- **Op de breedte of Vaste schaal.** In de stap *Pagina* past *Op de breedte* de hele tijdlijn op de bladbreedte. *Vaste schaal* geeft elke dag een vaste breedte. De app toont die in millimeter per dag, of per week, maand of jaar als een dag smaller is dan 1 mm, met eronder hoeveel tijd er op één pagina past, bijvoorbeeld *≈ 3 maanden per pagina*. Vaste schaal begint op precies de breedte per dag die je net had, ook als die kleiner is dan een tiende millimeter. Het aantal pagina's verspringt dus niet.
- **Herstel standaard en Ongedaan maken.** In de kop van de open stap staat de knop *Herstel standaard* (een pijl die terugdraait). Die zet alleen die stap terug. In een klein venster staat de knop in de kop van het venster. Daarna verschijnt boven het papier *Ongedaan maken*; een klein venster blijft daarbij open. Dat zet precies terug wat *Herstel standaard* veranderde, bij *Kop en voet* ook de bedrijfsnaam. Wat je daarna in een andere stap koos, blijft staan.
- **Statuslijn zonder statusdatum.** Kies je in *Balken en tijdlijn* een statuslijn terwijl het project geen statusdatum heeft, dan zet *Op vandaag zetten* de statusdatum op vandaag. Of je kiest er een datum. De app rekent daarna meteen door, net als F5.
- **Zijbalk inklappen.** Met de knop naast de keuzelijst of `Ctrl+\` klap je de zijbalk in tot een smalle rand met de stappen. Een klik op een stap of op het papier opent die stap als klein venster. Versleep het venster aan zijn kop als het iets afdekt; het blijft naast de rand en boven de knop *PDF exporteren*. Linksonder staat dan de knop *PDF exporteren*. Het papier blijft vrij van die knop: raakt een blad zijn hoek, dan stopt het papier erboven.
- **Exporteren.** *PDF exporteren* staat onderaan de zijbalk. Het papier op het scherm is gelijk aan de PDF: dezelfde pagina's, en namen en datums worden op dezelfde plek afgekapt.
- **Planning niet doorgerekend.** Wijzig je iets in de planning zonder F5 (en staat *Automatisch berekenen* uit), dan toont het papier nog de laatste berekening. Boven het papier staat dan *De planning is niet doorgerekend. De PDF rekent eerst door.* De PDF heeft dus de nieuwe datums en het papier nog niet. Klik op *Nu doorrekenen* (dat doet hetzelfde als F5); daarna is het papier weer gelijk aan de PDF.

## Valkuilen en wat de app dan doet

**Ctrl+P opent Rapport.** Ctrl+P brengt je naar het tabblad Rapport; het start geen export. Exporteren doe je met *PDF exporteren* of *Exporteer PDF*. Er is geen aparte printopdracht in de app: de weg naar papier loopt via de PDF. Werkt Ctrl+P niet (zie stap 1), dan opent in de browser het printvenster van de browser, en dat drukt het scherm af, niet het rapport.

**Bedrijfsnaam: overtypen wordt niet bewaard.** Het veld *Bedrijfsnaam in de kop* in de stap *Kop en voet* begint met het bedrijf uit de projectinstellingen. Wat je hier overtypt, wordt niet bewaard. De auteur kun je hier niet typen. Beide pas je aan met *Instellingen › Project › Projectinstellingen*, in de velden *Opdrachtgever/organisatie* en *Auteur*, en bevestig je met *Toepassen*.

**Balkkleuren: alleen voor het rapport.** Het rapport heeft eigen *Balkkleuren*, in de stap *Balken en tijdlijn*. Standaard kleuren de balken op kritiek pad, ook als je scherm een andere keuze heeft. Je Gantt op het scherm verandert niet. Koos je bij *Taken en groepering* voor *Zoals de weergave*, dan volgen de balkkleuren je scherm.

**De Variance zonder baseline.** Een baseline is een bewaarde momentopname van je planning waartegen je later meet; hoe je er een opslaat, lees je in [Een baseline opslaan en beheren](docs://howto-baseline-opslaan-en-beheren). Heb je geen actieve baseline, dan staat er in plaats van een vergelijking *Geen actieve baseline — sla een baseline op of kies er een als actief.*

**Statuslijn zonder statusdatum.** Kies je een *Statuslijn* terwijl het project geen statusdatum heeft, dan waarschuwt het rapport met *Stel eerst een statusdatum in* en tekent het geen lijn. Zet de statusdatum met *Op vandaag zetten* of kies een datum, of zet hem bij *Planning › Baselines & voortgang › Statusdatum*.

**De planning bevat een kring.** Zit er een kring in de planning, dan maakt de export geen bestand en toont de app de fout.

**Papier geldt op dit moment voor alle rapporten.** Er is één keuze voor *Papier:* en *Oriëntatie:*, gedeeld door alle rapporten. Het Mijlpalen-overzicht en de Variance hebben geen eigen papierkeuze: ze gebruiken wat je bij een ander rapport hebt ingesteld, standaard A3 liggend. Kies het papier dus eerst bij een rapport dat het aanbiedt, bijvoorbeeld de Gantt-afdruk, en ga dan terug.

**De instellingen gelden voor alle projecten.** Papier, lettertype, lettergrootte, periode en de andere keuzes onthoudt de app op dit apparaat, voor al je projecten. Ze horen niet bij het projectbestand.

## Zie ook

- [De rapportageperiode kiezen](docs://howto-rapportageperiode-kiezen): een look-ahead of voortgangsrapport over een bepaald stuk tijd.
- [Een layout maken en gebruiken](docs://howto-layouts-gebruiken): eerst filteren of groeperen, dan met *Zoals de weergave* of een layout afdrukken.
- [Een baseline opslaan en beheren](docs://howto-baseline-opslaan-en-beheren): de momentopname waarmee de Variance vergelijkt.
- [Overbezetting oplossen](docs://howto-overbezetting-oplossen): wat je doet als de Resourcebelasting overbelaste weken laat zien.
- [Rekenopties en conventies](docs://ref-rekenopties-en-conventies): waarom een activiteit kritiek is of bijna kritiek.
- [Rapporttypes](docs://ref-rapporttypes): alle rapporttypes en hun opties.
