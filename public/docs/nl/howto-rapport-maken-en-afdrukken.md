# Een rapport maken en afdrukken

Doel: een rapport van je planning kiezen, in het voorbeeld controleren en als PDF opslaan, zodat je het kunt uitdelen of zelf afdrukken.

## Wanneer je dit nodig hebt

Vrijdag is het bouwoverleg. De opdrachtgever wil de planning op papier, de uitvoerder wil weten wat de komende weken start en de ploegbaas wil een blad met alleen zijn eigen taken. Zulke overzichten maak je op het tabblad *Rapport*. De app rekent ze uit je planning en toont ze eerst als voorbeeld. Daarna exporteer je ze naar een PDF.

De app stuurt een rapport niet zelf naar een printer. Het eindpunt is altijd een PDF. Die druk je af met je PDF-lezer, of mail je door.

## Stappen

### 1. Open het tabblad Rapport

Kies *Rapport* in het lint, of druk op Ctrl+P. Ctrl+P opent dus niet het printvenster van je browser of besturingssysteem, maar dit tabblad.

Links staat de kolom *Rapportage* met de keuzelijst *Rapporttype*, een overzicht en de instellingen. Rechts staat het voorbeeld.

### 2. Kies het rapporttype

De keuzelijst *Rapporttype* heeft elf rapporten. Kies het rapport dat bij je vraag past.

- *Gantt-afdruk*: de planning als balkenplan op papier, met de kolommen WBS, Taaknaam, Duur, Start, Einde en Volt. links van de tijdlijn. Het rapport voor de gewone uitdeelplanning.
- *Resourcediagram*: dezelfde balken, maar met per resource een band en daaronder zijn taken. Voor de vraag "wat doet ploeg X?". Met het vinkje *Elke resource op een nieuwe pagina* krijg je een blad per ploeg.
- *Mijlpalen-overzicht*: alle mijlpalen met datum, speling en status (*Op schema*, *Kritiek* of *Te laat*).
- *Variance*: de huidige start en het huidige einde naast die van de actieve baseline, met het verschil in werkdagen. Voor de vraag "hoeveel zijn we opgeschoven?".
- *Look-ahead*: de activiteiten die in de komende periode lopen of starten. Het lijstje voor het weekoverleg.
- *Kritiek & near-critical*: de activiteiten zonder speling (*Kritiek*) of bijna zonder speling (*Near-critical*).
- *Voortgangsrapport*: waar het project staat op de statusdatum. Gepland tegenover werkelijk, wat is voltooid, wat loopt en wat start straks.
- *Planningsgezondheid*: een controle van de planning zelf. Per controle staat er een ernst (*Fout*, *Waarschuwing* of *Info*) en welke taken het betreft, bijvoorbeeld bij *Negatieve speling*, *Gemiste deadline* of *Zonder voorganger (open begin)*.
- *Resourcebelasting*: per resource per week of maand wat er gevraagd wordt tegenover wat beschikbaar is. Overbelaste weken staan in de kolom *Overbelast*.
- *Resourcetoewijzingen*: per resource de activiteiten waaraan hij hangt.
- *WBS-samenvatting*: de planning per WBS-niveau opgerold. Het overzicht voor het management.

### 3. Zorg dat de planning actueel is

De app rekent niet vanzelf. Heb je taken, relaties of kalenders gewijzigd sinds de laatste berekening, druk dan op **Bereken** (F5). De tabelrapporten waarschuwen zelf, bovenaan het rapport: *De planning is gewijzigd sinds de laatste berekening — druk op Bereken (F5) voor actuele waarden.* Of, als er nog nooit is gerekend: *Nog niet berekend — druk op Bereken (F5) voor datums en speling.*

Het lint van het tabblad Rapport heeft geen Bereken-knop, maar F5 werkt hier gewoon. *Exporteer PDF* rekent bovendien zelf eerst door als de planning verouderd is, zodat de PDF nooit achterloopt op je planning.

### 4. Stel het rapport af

Onder *Instellingen* staan de keuzes voor de Gantt-afdruk en het Resourcediagram. Look-ahead, Kritiek & near-critical, Voortgangsrapport, Planningsgezondheid, Resourcebelasting, Resourcetoewijzingen en WBS-samenvatting hebben alleen *Papier:* en *Orientatie:*, plus een blok *Rapportopties* met de keuzes van dat rapport. Het Mijlpalen-overzicht en de Variance hebben geen eigen keuzes. Voor de periode van een rapport zie [De rapportageperiode kiezen](docs://howto-rapportageperiode-kiezen).

- *Papier:* en *Orientatie:* bepalen het vel. Standaard staat dit op A3 liggend, wat voor een bouwplanning handig is, maar niet elke printer drukt A3 af. Heb je een A4-printer, kies dan nu A4: de app legt de pagina's dan voor A4 op, in plaats van dat je ze later moet laten krimpen.
- *Lettergrootte:* (90% tot 125%) maakt tekst en tabel groter of kleiner. Een grotere letter laat minder ruimte over voor de tijdlijn.
- *Volg weergave (filter, groepering, sortering)* staat alleen bij de Gantt-afdruk. Standaard komt de hele takenboom op papier. Met dit vinkje tekent het rapport precies de rijen die je op het scherm ziet, bijvoorbeeld alleen de kritieke taken uit een layout. Hoe je zo'n weergave maakt, lees je in [Een layout maken en gebruiken](docs://howto-layouts-gebruiken).
- *Baseline-overlay tonen* laat de actieve baseline naast de huidige balken zien. Met *Statuslijn:* kies je een *Statusdatumlijn* of een *Voortgangslijn*.
- *Auto-fit op papier* staat standaard aan: de tijdlijn wordt dan op de paginabreedte geschaald en het aantal pagina's volgt uit de hoogte. Zet je het uit, dan gebruikt het rapport een vaste zoom en tegelt het ook in de breedte, wat snel veel pagina's oplevert. Met *Tijdlijn over:* spreid je de tijdlijn bij auto-fit over 2 tot en met 8 pagina's breed, voor een lange planning die je in leesbare grootte wilt afdrukken.

### 5. Controleer het voorbeeld

Bij de Gantt-afdruk en het Resourcediagram zie je het papier met paginakop, tabel, tijdlijn en legenda. Scrol om de pagina's te bekijken. *Previewkwaliteit* stelt alleen in hoe scherp het voorbeeld op je scherm is; de PDF verandert er niet door. Staat er onder de pagina's *… en nog 1 pagina — exporteer voor het volledige document* (bij meer pagina's *… en nog 2 pagina's — exporteer voor het volledige document*), dan heeft het voorbeeld niet alle pagina's klaarstaan. De PDF bevat ze allemaal.

De overige rapporten staan als tabel op het scherm. Wat je ziet is wat in de PDF komt.

### 6. Exporteer naar PDF

Klik onder aan de kolom links op **Exporteer PDF**. De voorgestelde bestandsnaam is de projectnaam gevolgd door de soort rapport, bij de Gantt-afdruk bijvoorbeeld *Aanbouw woning-planning.pdf*.

- In de desktopapp, en in een browser die een opslagdialoog voor bestanden kent, kies je waar de PDF komt. Sluit je die dialoog zonder te bewaren, dan gebeurt er niets.
- In een browser zonder zo'n dialoog zet de browser de PDF in je downloadmap.

### 7. Druk de PDF af

Open de PDF in je PDF-lezer en druk hem daar af. Print je een A3-PDF op een A4-printer, dan moet je printvenster de pagina's verkleinen. Stel het papierformaat daarom liever eerst in bij stap 4.

## Valkuilen en wat de app dan doet

**De knop Afdruk of Ctrl+P print niet.** De knop *Afdruk* in het lint (groep *Rapportage*) en Ctrl+P brengen je alleen naar het tabblad Rapport. Er gaat niets naar een printer, en er is geen aparte printopdracht: de weg naar papier loopt via de PDF.

**Bedrijf: blijft niet staan.** Het veld *Bedrijf:* bij de Gantt-afdruk begint met het bedrijf uit de projectinformatie. Wat je hier overtypt, geldt alleen zolang je op het tabblad Rapport blijft. Ga je naar een ander tabblad en weer terug, dan staat het bedrijf uit de projectinformatie er weer. *Auteur:* kun je hier niet typen. Beide pas je aan met *Instellingen › Project › Projectinfo*, in de velden *Bedrijf* en *Auteur*, en bevestig je met *Toepassen*.

**Balkkleuren: geldt ook voor je scherm.** De keuze *Balkkleuren:* in het rapport is dezelfde keuze als *Balkkleuren* op het tabblad Beeld. Verander je hem in het rapport, dan verandert je Gantt op het scherm mee.

**De Variance zonder baseline.** Heb je geen actieve baseline, dan staat er in plaats van een vergelijking *Geen actieve baseline — sla een baseline op of kies er een als actief.*

**Statuslijn zonder statusdatum.** Kies je een *Statuslijn:* terwijl het project geen statusdatum heeft, dan waarschuwt het rapport met *Stel eerst een statusdatum in* en tekent het niets. Je zet de statusdatum bij *Planning › Baselines & voortgang › Statusdatum*.

**Papier geldt voor alle rapporten.** Er is één keuze voor *Papier:* en *Orientatie:*, gedeeld door alle rapporten. Het Mijlpalen-overzicht en de Variance hebben geen eigen papierkeuze: ze gebruiken wat je bij een ander rapport hebt ingesteld, standaard A3 liggend. Kies het papier dus eerst bij een rapport dat het aanbiedt, bijvoorbeeld de Gantt-afdruk, en ga dan terug.

**De instellingen gelden voor alle projecten.** Papier, lettergrootte, periode en de andere keuzes onthoudt de app op dit apparaat, voor al je projecten. Ze horen niet bij het projectbestand.

## Zie ook

- [De rapportageperiode kiezen](docs://howto-rapportageperiode-kiezen): een look-ahead of voortgangsrapport over een bepaald stuk tijd.
- [Een layout maken en gebruiken](docs://howto-layouts-gebruiken): eerst filteren of groeperen, dan met *Volg weergave* afdrukken.
- [Overbezetting oplossen](docs://howto-overbezetting-oplossen): wat je doet als de Resourcebelasting overbelaste weken laat zien.
- [Kritiek pad en speling](docs://uitleg-kritiek-pad): waarom een activiteit kritiek is of bijna kritiek.
