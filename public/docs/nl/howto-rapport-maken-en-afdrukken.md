# Een rapport maken en afdrukken

Doel: een rapport van je planning kiezen, in het voorbeeld controleren en als PDF opslaan, zodat je het kunt uitdelen of zelf afdrukken.

## Wanneer je dit nodig hebt

Vrijdag is het bouwoverleg. De opdrachtgever wil de planning op papier, de uitvoerder wil weten wat de komende weken start en de ploegbaas wil een blad met alleen zijn eigen taken. Zulke overzichten maak je op het tabblad *Rapport*. De app rekent ze uit je planning en toont ze eerst als voorbeeld. Daarna exporteer je ze naar een PDF.

De app stuurt een rapport niet zelf naar een printer. Het eindpunt is altijd een PDF. Die druk je af met je PDF-lezer, of mail je door.

## Stappen

### 1. Open het tabblad Rapport

Kies *Rapport* in het lint, of druk op Ctrl+P. Ctrl+P brengt je naar dit tabblad. Typ je in een veld, staat er een dialoog open of staat de presentatiemodus aan, dan werkt Ctrl+P niet. In de browser opent dan het printvenster van de browser, en dat drukt het scherm af, niet het rapport.

Vanuit het bestandsmenu kies je *Bestand › Afdruk › Open afdrukvoorbeeld*. Het bestandsmenu sluit en het tabblad Rapport opent. Daarna kies je het rapport en de instellingen.

Links staat de kolom *Rapportage* met de keuzelijst *Rapporttype*, een overzicht en de instellingen. Rechts staat het voorbeeld.

Staat bij *Instellingen › Geavanceerd › Experimenteel* de keuze *Nieuw tabblad Rapport* aan, dan ziet de Gantt-afdruk er anders uit. Lees dan [Het nieuwe tabblad Rapport](docs://howto-rapport-maken-en-afdrukken#het-nieuwe-tabblad-rapport-experimenteel) hieronder.

### 2. Kies het rapporttype

De keuzelijst *Rapporttype* heeft elf rapporten. Kies het rapport dat bij je vraag past.

- *Gantt-afdruk*: de planning als balkenplan, voor de gewone uitdeelplanning.
- *Resourcediagram*: dezelfde balken, maar per resource een band. Voor "wat doet ploeg X?", desgewenst met een blad per ploeg.
- *Mijlpalen-overzicht*: alle mijlpalen met datum en status.
- *Variance*: de huidige planning naast de actieve baseline. Voor "hoeveel zijn we opgeschoven?".
- *Look-ahead*: wat de komende periode loopt of start. Het lijstje voor het weekoverleg.
- *Kritiek & near-critical*: de activiteiten zonder of bijna zonder speling.
- *Voortgangsrapport*: waar het project staat op de statusdatum, de dag waarop je de voortgang peilt.
- *Planningsgezondheid*: een controle van de planning zelf op fouten en ongewone waarden.
- *Resourcebelasting*: per resource per week of maand wat er gevraagd wordt tegenover wat beschikbaar is.
- *Resourcetoewijzingen*: per resource de activiteiten waaraan hij hangt.
- *WBS-samenvatting*: de planning per WBS-niveau opgerold, voor het management.

### 3. Zorg dat de planning actueel is

De app rekent niet vanzelf. Heb je taken, relaties of kalenders gewijzigd sinds de laatste berekening, druk dan op **Bereken** (F5). De tabelrapporten waarschuwen zelf, bovenaan het rapport: *De planning is gewijzigd sinds de laatste berekening — druk op Bereken (F5) voor actuele waarden.* Of, als er nog nooit is gerekend: *Nog niet berekend — druk op Bereken (F5) voor datums en speling.*

Het lint van het tabblad Rapport heeft geen Bereken-knop, maar F5 werkt hier gewoon. *Exporteer PDF* rekent bovendien zelf eerst door als de planning verouderd is, zodat de PDF nooit achterloopt op je planning.

### 4. Stel het rapport af

Onder *Instellingen* staan de keuzes voor de Gantt-afdruk en het Resourcediagram. Look-ahead, Kritiek & near-critical, Voortgangsrapport, Planningsgezondheid, Resourcebelasting, Resourcetoewijzingen en WBS-samenvatting hebben alleen *Papier:*, *Oriëntatie:* en *Lettertype:*, plus een blok *Rapportopties* met de keuzes van dat rapport. Het Mijlpalen-overzicht en de Variance hebben geen eigen keuzes. Voor de periode van een rapport zie [De rapportageperiode kiezen](docs://howto-rapportageperiode-kiezen).

- *Papier:* en *Oriëntatie:* bepalen het vel. Standaard staat dit op A3 liggend, wat voor een bouwplanning handig is, maar niet elke printer drukt A3 af. Heb je een A4-printer, kies dan nu A4: de app legt de pagina's dan voor A4 op, in plaats van dat je ze later moet laten krimpen.
- Bij het Resourcediagram geeft het vinkje *Elke resource op een nieuwe pagina* een blad per ploeg.
- *Lettertype:* kiest de letter van alle rapporten: *Inter* (standaard), *Liberation Sans* (zoals Arial), *Carlito* (zoals Calibri) of *Liberation Serif* (zoals Times New Roman). De keuze geldt voor elk rapport, net als het papier.
- *Lettergrootte:* (90% tot 125%) maakt tekst en tabel groter of kleiner. Een grotere letter laat minder ruimte over voor de tijdlijn.
- *Volg weergave (filter, groepering, sortering)* staat alleen bij de Gantt-afdruk. Standaard komt de hele takenboom op papier. Met dit vinkje tekent het rapport precies de rijen die je op het scherm ziet, ook met ingeklapte fasen, bijvoorbeeld alleen de kritieke taken uit een layout. Hoe je zo'n weergave maakt, lees je in [Een layout maken en gebruiken](docs://howto-layouts-gebruiken).
- *Baseline-overlay tonen* laat de actieve baseline naast de huidige balken zien. Met *Statuslijn:* kies je een *Statusdatumlijn* of een *Voortgangslijn*.
- *Auto-fit op papier* staat standaard aan: de tijdlijn wordt dan op de paginabreedte geschaald en het aantal pagina's volgt uit de hoogte. Zet je het uit, dan gebruikt het rapport een vaste zoom en tegelt het ook in de breedte, wat snel veel pagina's oplevert. Met *Tijdlijn over:* spreid je de tijdlijn bij auto-fit over 2 tot en met 8 pagina's breed, voor een lange planning die je in leesbare grootte wilt afdrukken.

### 5. Controleer het voorbeeld

Bij de Gantt-afdruk en het Resourcediagram zie je het papier met paginakop, tabel, tijdlijn en legenda. Scrol om de pagina's te bekijken. *Previewkwaliteit* stelt alleen in hoe scherp het voorbeeld op je scherm is; de PDF verandert er niet door. Met het nieuwe tabblad Rapport is het papier altijd scherp, en staat deze keuze er niet. Staat er onder de pagina's *… en nog 1 pagina — exporteer voor het volledige document* (bij meer pagina's *… en nog 2 pagina's — exporteer voor het volledige document*), dan heeft het voorbeeld niet alle pagina's klaarstaan. De PDF bevat ze allemaal.

De overige rapporten staan als tabel op het scherm. Wat je ziet is wat in de PDF komt.

### 6. Exporteer naar PDF

Klik onder aan de kolom links op **Exporteer PDF**. De knop exporteert het gekozen rapport met je huidige instellingen naar PDF. De voorgestelde bestandsnaam is de projectnaam gevolgd door de soort rapport, bij de Gantt-afdruk bijvoorbeeld *Aanbouw woning-planning.pdf*. Het rapportdeel volgt de interfacetaal: een voortgangsrapport krijgt in het Nederlands `-voortgang.pdf` en in het Engels `-progress.pdf`. De projectnaam blijft gelijk; eerder opgeslagen bestanden worden niet hernoemd.

- In de desktopapp, en in een browser die een opslagdialoog voor bestanden kent, kies je waar de PDF komt. Sluit je die dialoog zonder te bewaren, dan gebeurt er niets.
- In een browser zonder zo'n dialoog zet de browser de PDF in je downloadmap.

### 7. Druk de PDF af

Open de PDF in je PDF-lezer en druk hem daar af. Print je een A3-PDF op een A4-printer, dan moet je printvenster de pagina's verkleinen. Stel het papierformaat daarom liever eerst in bij stap 4.

## Het nieuwe tabblad Rapport (experimenteel)

Staat bij *Instellingen › Geavanceerd › Experimenteel* de keuze *Nieuw tabblad Rapport* aan, dan opent de Gantt-afdruk in een nieuwe opbouw. De andere rapporten kies je met *Ander rapport* in de keuzelijst bovenaan; die openen het tabblad zoals hierboven beschreven. Het Resourcediagram staat daar niet meer: in het nieuwe tabblad is dat een layout in de stap *Taken*. Een eerder gekozen Resourcediagram opent als de Gantt-afdruk met die layout.

Links staat een zijbalk met vijf stappen, in de volgorde van het papier: *Taken*, *Kolommen*, *Balken en tijdlijn*, *Pagina* en *Kop en voet*. Onderaan staan de naam van het bestand en de knop *PDF exporteren*. Er staat één stap open. Een dichte stap toont kort wat je koos. Een oranje stip bij het nummer betekent dat de stap afwijkt van de standaard. Een melding staat direct onder de keuze die hem geeft; een open stap met een melding heeft een waarschuwingsteken naast de titel. Bij je eerste bezoek staat stap 1 open; daarna opent de stap die je het laatst gebruikte. Het aantal pagina's staat boven het papier; lopen de bladen ook naast elkaar, dan staat erbij hoeveel naast en onder elkaar, bijvoorbeeld *12 pagina's: 6 naast elkaar, 2 onder elkaar*.

- **Taken: alle taken, de weergave of een layout.** In de stap *Taken* kies je welke rijen op papier komen. *Alle taken* geeft de hele takenboom. *Zoals de weergave* neemt het filter, de groepering, de sortering en de ingeklapte groepen van het scherm over. Onder *Layouts* staan dezelfde layouts als op het lint, met dezelfde naam en hetzelfde icoon: het meegeleverde *Resourcediagram*, je eigen layouts en je opgeslagen filters. Een layout geldt alleen voor het rapport; je scherm verandert niet. Het rapport volgt de layout: verander je hem later, dan verandert het papier mee. Verwijder je hem, dan toont het rapport weer alle taken, met een melding.
- **Wat een layout meeneemt.** Het filter, de groepering en de sortering bepalen de rijen. Een deel dat de layout niet heeft, staat zoals bij *Alle taken*. Heeft de layout kolommen, relatielijnen of overlays, dan neemt het rapport bij het kiezen ook de kolommen, *Afhankelijkheden*, de basislijn, de speling en de statuslijn over. *Ongedaan maken* boven het papier zet die in één stap terug. De tijdschaal van een layout telt niet mee: de schaal kies je in *Pagina*. Kleurt de layout de balken anders, dan biedt de stap *Balkkleuren overnemen* aan; die keuze geldt ook voor je scherm.
- **Per resource.** Groepeert de layout op resource, zoals het *Resourcediagram*, dan krijgt elke resource een eigen band, ook als twee resources dezelfde naam hebben. Een taak met twee resources staat onder beide banden. Onder *Per resource* kies je *Elke resource op een nieuwe pagina*, *Taken zonder resource meenemen*, *Groeperen op resourcetype*, *Eenheden/dag en curve tonen* en een periode; daaronder staat hoeveel resources en toewijzingen er zijn. De relatielijnen staan dan uit, want een taak staat onder meer banden. *Kritiek pad* kleurt alleen de balken.
- **Klik op het papier.** Beweeg over het blad: het deel onder de muis licht op en boven het blad staat zijn naam, bijvoorbeeld *Kolommen · Start*. Klik je, dan opent de stap van dat deel. Een klik op een kolom laat die kolom oplichten in de stap *Kolommen*.
- **Kolommen.** Kies *Kolom toevoegen* en typ een deel van de naam. Enter voegt de kolom toe en sluit de lijst. Versleep een kolom aan de puntjes, of gebruik Alt met pijl omhoog of omlaag. *Zoals de tabel* neemt de kolommen van de takentabel naast de Gantt over. De taaknaam is verplicht. Bij *Afkappen* stel je de breedte van de naamkolom in millimeter op papier in.
- **Hele blad en Breedte.** Rechtsboven kies je hoe het papier in beeld past. *Hele blad* (standaard) toont één heel blad. *Breedte* vult de breedte van het venster met één blad. Loopt de tijdlijn over meer pagina's naast elkaar, dan zet *Hele rij* de bladen van een rij naast elkaar. Met − en + of Ctrl+scrollen zoom je; het percentage geldt ten opzichte van de ware grootte van het papier. De toets 0 zet *Hele blad* terug. *Hele blad* gaat naar de bovenkant van het blad dat het meest in beeld stond. Na een wissel van papier of stand staat blad 1 weer bovenaan.
- **Op de breedte of Vaste schaal.** In de stap *Pagina* past *Op de breedte* de hele tijdlijn op de bladbreedte. *Vaste schaal* geeft elke dag een vaste breedte. De app toont die in millimeter per dag, of per week, maand of jaar als een dag smaller is dan 1 mm, met eronder hoeveel tijd er op één pagina past, bijvoorbeeld *≈ 3 maanden per pagina*. Vaste schaal begint op precies de breedte per dag die je net had, ook als die kleiner is dan een tiende millimeter. Het aantal pagina's verspringt dus niet.
- **Standaard en Ongedaan maken.** Onderaan elke stap zet *Standaard* alleen die stap terug. Daarna verschijnt boven het papier *Ongedaan maken*; een klein venster blijft daarbij open. Dat zet precies terug wat *Standaard* veranderde, bij *Kop en voet* ook de bedrijfsnaam. Wat je daarna in een andere stap koos, blijft staan.
- **Statuslijn zonder statusdatum.** Kies je in *Balken en tijdlijn* een statuslijn terwijl het project geen statusdatum heeft, dan zet *Op vandaag zetten* de statusdatum op vandaag. Of je kiest er een datum. De app rekent daarna meteen door, net als F5.
- **Zijbalk inklappen.** Met de knop naast de keuzelijst of `Ctrl+\` klap je de zijbalk in tot een smalle rand met de stappen. Een klik op een stap of op het papier opent die stap als klein venster. Linksonder staat dan de knop *PDF exporteren*. Het papier blijft vrij van die knop: raakt een blad zijn hoek, dan stopt het papier erboven.
- **Exporteren.** *PDF exporteren* staat onderaan de zijbalk. Het papier op het scherm is gelijk aan de PDF: dezelfde pagina's, en namen en datums worden op dezelfde plek afgekapt.
- **Planning niet doorgerekend.** Wijzig je iets in de planning zonder F5 (en staat *Automatisch berekenen* uit), dan toont het papier nog de laatste berekening. Boven het papier staat dan *De planning is niet doorgerekend. De PDF rekent eerst door.* De PDF heeft dus de nieuwe datums en het papier nog niet. Klik op *Nu doorrekenen* (dat doet hetzelfde als F5); daarna is het papier weer gelijk aan de PDF.

## Valkuilen en wat de app dan doet

**Ctrl+P opent Rapport.** Ctrl+P brengt je naar het tabblad Rapport; het start geen export. Exporteren doe je met *Exporteer PDF*. Er is geen aparte printopdracht in de app: de weg naar papier loopt via de PDF. Werkt Ctrl+P niet (zie stap 1), dan opent in de browser het printvenster van de browser, en dat drukt het scherm af, niet het rapport.

**Bedrijf: overtypen wordt niet bewaard.** Het veld *Bedrijf:* bij de Gantt-afdruk begint met het bedrijf uit de projectinstellingen. Wat je hier overtypt, wordt niet bewaard. *Auteur:* kun je hier niet typen. Beide pas je aan met *Instellingen › Project › Projectinstellingen*, in de velden *Opdrachtgever/organisatie* en *Auteur*, en bevestig je met *Toepassen*.

**Balkkleuren: geldt ook voor je scherm.** De keuze *Balkkleuren:* in het rapport is dezelfde keuze als *Balkkleuren* op het tabblad Beeld. Verander je hem in het rapport, dan verandert je Gantt op het scherm mee.

**De Variance zonder baseline.** Een baseline is een bewaarde momentopname van je planning waartegen je later meet; hoe je er een opslaat, lees je in [Een baseline opslaan en beheren](docs://howto-baseline-opslaan-en-beheren). Heb je geen actieve baseline, dan staat er in plaats van een vergelijking *Geen actieve baseline — sla een baseline op of kies er een als actief.*

**Statuslijn zonder statusdatum.** Kies je een *Statuslijn:* terwijl het project geen statusdatum heeft, dan waarschuwt het rapport met *Stel eerst een statusdatum in* en tekent het niets. Je zet de statusdatum bij *Planning › Baselines & voortgang › Statusdatum*.

**De planning bevat een kring.** Zit er een kring in de planning, dan maakt *Exporteer PDF* geen bestand en toont het de fout.

**Papier geldt op dit moment voor alle rapporten.** Er is één keuze voor *Papier:* en *Oriëntatie:*, gedeeld door alle rapporten. Het Mijlpalen-overzicht en de Variance hebben geen eigen papierkeuze: ze gebruiken wat je bij een ander rapport hebt ingesteld, standaard A3 liggend. Kies het papier dus eerst bij een rapport dat het aanbiedt, bijvoorbeeld de Gantt-afdruk, en ga dan terug.

**De instellingen gelden voor alle projecten.** Papier, lettertype, lettergrootte, periode en de andere keuzes onthoudt de app op dit apparaat, voor al je projecten. Ze horen niet bij het projectbestand.

## Zie ook

- [De rapportageperiode kiezen](docs://howto-rapportageperiode-kiezen): een look-ahead of voortgangsrapport over een bepaald stuk tijd.
- [Een layout maken en gebruiken](docs://howto-layouts-gebruiken): eerst filteren of groeperen, dan met *Volg weergave* afdrukken.
- [Een baseline opslaan en beheren](docs://howto-baseline-opslaan-en-beheren): de momentopname waarmee de Variance vergelijkt.
- [Overbezetting oplossen](docs://howto-overbezetting-oplossen): wat je doet als de Resourcebelasting overbelaste weken laat zien.
- [Rekenopties en conventies](docs://ref-rekenopties-en-conventies): waarom een activiteit kritiek is of bijna kritiek.
- [Rapporttypes](docs://ref-rapporttypes): alle rapporttypes en hun opties.
