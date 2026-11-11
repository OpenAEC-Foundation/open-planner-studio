# Rapporttypes

Elk rapport op het tabblad *Rapport*, met de opties die erbij horen: wat ze doen, wat de beginwaarde is, wat er in het rapport verandert en waar je ze vindt. Hoe je een rapport maakt en als PDF opslaat, staat in [Een rapport maken en afdrukken](docs://howto-rapport-maken-en-afdrukken).

## Zo werkt het rapportvenster

Open het tabblad *Rapport* (of druk op Ctrl+P). Bij de Gantt-afdruk staat links een zijbalk met de keuzelijst *Rapporttype*, vijf stappen en onderaan de knop *PDF exporteren*; rechts staat het papier. Bij de andere rapporten staat links de kolom *Rapportage* met de keuzelijst *Rapporttype*, het blok *Overzicht* met tellingen, het blok *Rapportopties* en onderaan de knop *Exporteer PDF*; rechts staat het rapport. Wat je op het scherm ziet, komt in de PDF.

**Rapporttype** — welk rapport je ziet. Keuze uit elf rapporten. Standaard: *Gantt-afdruk*. Waar: *Rapport*, bovenaan de zijbalk of de kolom *Rapportage*.

**PDF exporteren** en **Exporteer PDF** — maken de PDF. Effect: er komt alleen een PDF; de app stuurt niets naar een printer. Is de planning verouderd, dan rekent de app eerst door. Geeft de berekening een fout, bijvoorbeeld door een kring in de relaties, dan maakt de knop geen bestand en toont hij de fout. Waar: *Rapport*, onderaan de zijbalk of de kolom *Rapportage*.

**Onthouden.** Alle rapportopties bewaart de app op dit apparaat, voor al je projecten. Ze horen niet bij het projectbestand. Alleen het veld *Bedrijfsnaam in de kop* van de Gantt-afdruk wordt niet bewaard.

**Actuele planning.** De rapporten gebruiken de laatste berekening. Is de planning gewijzigd sinds die berekening, dan staat boven de tabelrapporten *De planning is gewijzigd sinds de laatste berekening — druk op Bereken (F5) voor actuele waarden.* Is er nog nooit gerekend, dan staat er *Nog niet berekend — druk op Bereken (F5) voor datums en speling.* Staat het project in de weergave *Datums zoals opgeslagen*, dan tonen de rapporten de datums uit het bronbestand en meldt een strook dat.

**Afkortingen.** *wd* is werkdagen. *TF* is totale speling, *FF* vrije speling.

**Duur en rest.** De kolommen *Rest* en *Duur* tonen de duur in de maat van de taak, zoals de tabel. In het OPS-profiel staat een dagenmaat-taak in d (*2,5d*) en een urenmaat-taak in u (*40u*). Onder het P6- en het MSP-profiel volgt *Duur* de instelling *Duurweergave*. Een verzameltaak in de WBS-samenvatting toont werkdagen.

## Papier en oriëntatie

**Papier:** — het papierformaat van de PDF. Keuze uit A4, A3, A2 en A1. Standaard: A3. Effect: de pagina's worden voor dat formaat opgelegd. Er is één keuze voor alle rapporten: wat je bij het ene rapport kiest, geldt ook voor de andere. Op A4 staand wordt een brede tabel klein, want de tabel wordt op de paginabreedte geschaald. Waar: de stap *Pagina* (Gantt-afdruk) of *Rapportopties* (de tabelrapporten). Het Mijlpalen-overzicht en de Variance tonen geen keuzes.

**Oriëntatie:** (bij de Gantt-afdruk *Richting*) — liggend of staand. Keuze uit *Liggend* en *Staand*. Standaard: *Liggend*. Effect: zoals *Papier:*. Waar: dezelfde plek als *Papier:*.

**Lettertype:** — de letter van alle tekst in het rapport. Keuze uit *Inter (standaard)*, *Liberation Sans (zoals Arial)*, *Carlito (zoals Calibri)* en *Liberation Serif (zoals Times New Roman)*. Standaard: Inter. Effect: scherm en PDF gebruiken deze letter, en de PDF bevat hem, zodat hij op elke computer hetzelfde afdrukt. De letters naast Inter hebben dezelfde tekenbreedtes als het lettertype tussen haakjes. Een teken dat de gekozen letter mist, komt uit Inter. Net als bij *Papier:* is er één keuze voor alle rapporten; de app bewaart hem op dit apparaat en niet in het projectbestand. Waar: dezelfde plek als *Papier:*.

## Gantt-afdruk

De planning als balkenplan, met een tabel links en een tijdlijn rechts, over meerdere pagina's als het moet. Rechts staat het papier met paginakop, tabel, tijdlijn en legenda; het papier is gelijk aan de PDF. De opties staan in vijf stappen in de zijbalk. Hoe je ermee werkt, staat in [De Gantt-afdruk](docs://howto-rapport-maken-en-afdrukken#de-gantt-afdruk). Hieronder de opties per stap.

### Taken en groepering

**Welke taken** — welke rijen op papier komen. Keuze uit *Alle taken*, *Zoals de weergave* en een layout. Standaard: *Alle taken*. Effect: *Alle taken* geeft de hele takenboom. *Zoals de weergave* neemt het filter, de groepering, de sortering, de ingeklapte groepen, de kolommen en de balkkleuren van je Gantt-diagram over. Een layout bepaalt de rijen met zijn filter, groepering en sortering; je Gantt-diagram verandert niet.

**Per resource** — alleen bij een layout die op resource groepeert, zoals het meegeleverde *Resourcediagram*. Elke resource krijgt een eigen band, daaronder zijn taken op start. Het blok telt *Resources:*, *Toewijzingen:* en *Zonder resource:* (bij een periode ook *Buiten de periode:*). De relatielijnen staan dan uit, want een taak kan onder meer banden staan, en *Kritiek pad* staat vast aan. Met deze vier schakelaars en de periode:

- **Elke resource op een nieuwe pagina** — Standaard: uit. Effect: elke resource begint op een nieuwe pagina, zodat je een blad per ploeg of medewerker kunt uitdelen.
- **Taken zonder resource meenemen** — Standaard: uit. Effect: de taken zonder resource komen als laatste band, om te zien wat nog niemand heeft.
- **Groeperen op resourcetype** — Standaard: uit. Effect: eerst een band per resourcetype (arbeid, ploeg, onderaannemer, materieel, materiaal), daarbinnen per resource.
- **Eenheden/dag en curve tonen** — Standaard: aan. Effect: de kolommen *Eenh./d* en *Curve* achter de taaknaam. Is er te weinig ruimte voor de tijdlijn, dan laat het rapport de kolommen weg en meldt *De kolommen Eenh./d en Curve zijn weggelaten: …*.
- **Rapportageperiode** — Standaard: *Hele project*. Effect: alleen de taken die de periode raken, en de tijdas loopt exact over de periode. Is er niets in de periode, dan staat er *Geen taken in de rapportageperiode — kies een andere periode of Hele project.*

### Kolommen

**Kolommen** — de kolommen van de tabel, uit dezelfde lijst als de tabel van de app. Standaard: WBS, Taaknaam, Duur, Start, Einde en Voltooiing. De taaknaam is verplicht. Met *Kolommen overnemen van* neem je de kolommen van het tabblad Tabel of van de tabel naast de Gantt over.

**Taaknaam** — *Afkappen* of *Volledig*. Standaard: *Afkappen*. Effect: *Afkappen* kapt namen af op de *Breedte van de naamkolom*; *Volledig* laat de kolom meegroeien met de langste naam.

### Balken en tijdlijn

**Taaknamen bij de balken** — Standaard: aan. Effect: de naam van de taak naast de balk.

**Voortgang in de balk** — Standaard: aan. Effect: het deel dat klaar is, donker in de balk. Een voltooide taak krijgt geen spelingsband.

**Speling tonen** — Standaard: aan. Effect: de speling als band achter niet-kritieke balken.

**Baseline-overlay tonen** — Standaard: uit. Effect: een dunne balk in de baseline-kleur onder de taakbalk, alleen voor taken die in de actieve baseline staan.

**Balkkleuren** — waar de kleur van een balk van afhangt. Keuze uit *Kritiek pad*, *Per taak — automatisch* en *Op categorie*, met bij *Op categorie* een keuzelijst *Categorieveld*. Standaard: *Kritiek pad*. Effect: alleen het rapport; je Gantt-diagram verandert niet. Bij *Zoals de weergave* volgen de balkkleuren je scherm. Bestaat het gekozen veld niet in dit project, dan staat er *Dit veld bestaat niet in dit project. Werksoort wordt tijdelijk gebruikt.*

**Afhankelijkheden** — Standaard: aan. Effect: tekent de relatielijnen tussen de balken.

**Kritiek pad** — Standaard: aan. Effect: stuurt alleen de rode relatielijnen tussen twee kritieke taken en de legendaregel. De balken zelf volgen *Balkkleuren*.

**Statuslijn** — Keuze uit *Geen*, *Statusdatumlijn* en *Voortgangslijn*. Standaard: *Geen*. Effect: *Statusdatumlijn* trekt een lijn op de statusdatum; *Voortgangslijn* trekt de zigzaglijn die per taak naar de voortgang uitstulpt. Heeft het project geen statusdatum, dan staat er *Stel eerst een statusdatum in*, met *Op vandaag zetten* en een datumveld.

**Weekenden** — Standaard: aan. Effect: arceert weekenden en feestdagen in de tijdlijn, zolang de schaal dagen te onderscheiden maakt.

**Alleen werkbare dagen tonen** — Standaard: uit. Effect: weekenden en feestdagen worden overgeslagen in de tijd-as van dit rapport. Los van dezelfde instelling voor de Gantt op het scherm.

### Pagina

**Papier**, **Richting** en **Lettertype** — zie *Papier en oriëntatie* hierboven.

**Lettergrootte** — grootte van tekst en tabel. Keuze uit 90%, 100%, 110% en 125%. Standaard: 100%. Effect: bij een grotere letter groeien tekst, rijen en tabel en levert de tijdlijn breedte in.

**Passen** — *Op de breedte* of *Vaste schaal*. Standaard: *Op de breedte*. Effect: *Op de breedte* past de hele tijdlijn op de bladbreedte; met *Tijdlijn over* (1 tot en met 8 pagina's) spreid je hem over meer bladen naast elkaar. *Vaste schaal* geeft elke dag een vaste *Breedte per dag*.

### Kop en voet

**Bedrijfsnaam in de kop** — Standaard: het bedrijf uit de projectinstellingen. Effect: alleen de kop van het rapport; wat je hier overtypt, wordt niet bewaard.

**Auteur (uit het project)** — alleen lezen.

**Kop op elke pagina herhalen** — Standaard: aan. Effect: aan zet de paginakop op elke pagina; uit alleen op de eerste.

**Voet op elke pagina herhalen** — Standaard: aan. Effect: aan zet de voet (projectnaam, afdrukdatum en legenda) op elke pagina; uit alleen op de laatste.

**Legenda** — Standaard: aan. Effect: de legenda in de voet.

## Mijlpalen-overzicht

Alle mijlpalen van het project in een tabel. Geen eigen opties. Het blok *Overzicht* telt *Mijlpalen*, *Verplicht* en *Te laat*. De kolommen zijn *WBS*, *Naam*, *Soort* (*Automatisch*, *Start* of *Eind*), *Datum*, *Constraint/deadline*, *Speling*, *Verplicht* en *Status*. De status is *Te laat* als de constraint is geschonden, de deadline gemist is of de totale speling negatief is; anders *Kritiek* als de mijlpaal kritiek is volgens de kritiek-definitie van het project; anders *Op schema*. Zonder mijlpalen staat er *Geen mijlpalen in dit project.* De PDF gebruikt het papier en de oriëntatie die je het laatst bij een ander rapport koos.

## Variance

De huidige planning naast de actieve baseline, voor leaf-taken. Geen eigen opties. Het blok *Overzicht* telt *Taken*, *Later* en *Eerder* en toont *Projecteinde: +3 werkdagen* (het verschil in werkdagen tussen het baseline-einde en het huidige einde). De kolommen zijn *WBS*, *Naam*, *Baseline start*, *Baseline einde*, *Huidige start*, *Huidig einde*, *Δ start (wd)*, *Δ einde (wd)* en *Status*. De status volgt het einde: *Later* als het einde later ligt dan in de baseline, *Eerder* als het eerder ligt, anders *Op schema*. *Nieuw* is een taak die niet in de baseline staat, *Vervallen* een taak die in de baseline staat maar niet meer in de planning. Zonder actieve baseline staat er *Geen actieve baseline — sla een baseline op of kies er een als actief.* De PDF gebruikt het papier en de oriëntatie die je het laatst bij een ander rapport koos.

## Look-ahead

Wat er in de periode loopt of start: het lijstje voor het weekoverleg. Opties onder *Rapportopties*.

**Rapportageperiode:** — het venster van het rapport. Standaard: *Volgende maand*. Effect: het rapport bevat de niet-voltooide activiteiten die de periode raken, ook als ze de hele periode overspannen, plus achterstallige activiteiten van vóór de referentiedag, zolang het einde van de periode niet vóór de referentiedag ligt.

**Near-critical ≤ (wd):** — de drempel voor *Near-critical*. Getal van 0 tot 60. Standaard: 5. Effect: een taak met meer dan 0 en hoogstens zoveel werkdagen totale speling telt als near-critical. Bij 0 telt alleen wat de reken-optie *Bijna-kritiek markeren* van het project markeert.

Het blok *Overzicht* telt *Activiteiten*, *Achterstallig*, *In uitvoering*, *Had moeten starten*, *Start*, *Kritiek* en *Near-critical*. De status per rij, altijd ten opzichte van de referentiedag: *Achterstallig* (niet voltooid en het einde ligt vóór de referentiedag), *Had moeten starten* (niet gestart terwijl de start vóór de referentiedag lag), *In uitvoering*, *Start* (nog niet gestart, start in het venster). De kolommen zijn *WBS*, *Naam*, *Start*, *Einde*, *Rest*, *Volt.*, *TF (wd)*, *Kritiek*, *Resources* en *Status*.

## Kritiek & near-critical

De activiteiten die het projecteinde bepalen en die daar bijna toe behoren. Optie onder *Rapportopties*.

**Near-critical ≤ (wd):** — Standaard: 5. Getal van 0 tot 60. Effect en betekenis zoals bij de Look-ahead. De ondertitel meldt de gekozen drempel.

Het rapport bevat de niet-voltooide taken die kritiek zijn (volgens de solver en de kritiek-definitie van het project) of near-critical, gesorteerd op spelingpad, dan op totale speling, dan op start. Het blok *Overzicht* telt *Kritiek*, *Near-critical*, *Kritieke ketens* en *Bladtaken*. De kolommen zijn *WBS*, *Naam*, *Start*, *Einde*, *Rest*, *TF (wd)*, *FF (wd)*, *Pad* en *Status*. De kolom *Pad* toont het spelingpad als de reken-optie *Meerdere speling-paden* aan staat, anders een streepje.

## Voortgangsrapport

Waar het project staat op de statusdatum. Opties onder *Rapportopties*.

**Rapportageperiode:** — Standaard: *Afgelopen maand*. Effect: *Voltooid in de afgelopen periode* telt binnen de periode. *Start in de komende periode* kijkt vanaf de statusdatum vooruit, tot *Vooruitblik t/m*; bij een *Afgelopen*-periode even ver vooruit als de periode terugkijkt.

**Near-critical ≤ (wd):** — Standaard: 5. Zoals bij de Look-ahead.

Het blok *Overzicht* toont *Statusdatum*, *Periode*, *Vooruitblik t/m*, *Baseline-einde*, *Prognose-einde*, *Δ einde (wd)*, *Gepland* (met *(baseline)* of *(huidige planning)*), *Werkelijk*, de tellingen *Voltooid*, *In uitvoering*, *Niet gestart*, *Achterstallig* en *Kritiek*. Gepland en werkelijk zijn gewogen naar de duur van de taken. Gepland meet tegen de baseline als er een actieve baseline is, anders tegen de huidige planning. De secties zijn *Voltooid in de afgelopen periode*, *In uitvoering*, *Start in de komende periode*, *Achterstallig* en *Kritieke open activiteiten*; een taak kan in meer dan één sectie staan. Elke sectie heeft dezelfde kolommen: *WBS*, *Naam*, *Baseline-einde*, *Prognose-einde*, *Volt.*, *Rest*, *TF (wd)*, *Kritiek* en *Status*. De status per rij is *Voltooid*, *In uitvoering*, *Niet gestart*, *Had moeten starten* of *Had moeten eindigen*.

## Voortgangscurve

Hoe het project ervoor staat, in één blad: vier kerncijfers, een S-curve van de voortgang en de taken met risico. Dit rapport heeft geen eigen opties, alleen *Papier:*, *Oriëntatie:* en *Lettertype:*.

Het blok *Overzicht* toont *Statusdatum*, *Baseline-einde*, *Prognose-einde* en *Δ einde (wd)*. Daaronder staan vier kerncijfers:

- *Gereed* — de werkelijke voortgang, gewogen naar de duur van de taken. Eronder staat de geplande voortgang op de statusdatum. Zonder baseline komt *gepland* uit de huidige planning en staat er *(huidige planning)* achter. Het getal is rood als je achterloopt op de planning.
- *Te laat* — open taken die volgens de planning al hadden moeten starten of eindigen, of die later eindigen dan de baseline. Eronder staat hoeveel daarvan kritiek zijn.
- *Negatieve speling* — open taken met een totale speling onder nul. Eronder staat de grootste negatieve speling.
- *Volgende mijlpaal* — de eerste open mijlpaal, met de datum en over hoeveel kalenderdagen. Ligt de mijlpaal al voor de statusdatum, dan staat er hoeveel dagen geleden, in rood.

De S-curve toont de cumulatieve voortgang van 0 tot 100 %, gewogen naar duur:

- *Gepland (baseline)* — gestippeld: de voortgang volgens de actieve baseline. Zonder baseline is er geen geplande lijn.
- *Werkelijk* — doorgetrokken, tot de statusdatum. De app bewaart geen voortgang per week. De lijn is daarom een benadering: per taak loopt de voortgang gelijkmatig van de werkelijke start tot de huidige voltooiing.
- *Doelband: vroegste tot laatste data* — het gebied tussen de voortgang als elke taak op haar vroegste data loopt, en als elke taak op haar laatste data loopt. Ligt *Werkelijk* onder de band, dan loop je achter op wat nog zonder vertraging kan. Is de planning nog niet berekend, dan is er geen band en staat er een lijn *Vroegste data*.
- *Statusdatum* — een verticale lijn.

De tabel *Risicotaken: te laat of negatieve speling* toont de open taken uit *Te laat* en *Negatieve speling*, de laagste speling eerst. De kolommen zijn *WBS*, *Naam*, *Baseline-einde*, *Prognose-einde*, *Δ einde (wd)*, *TF (wd)*, *Kritiek* en *Te laat*.

## Planningsgezondheid

Een controle van de planning zelf op fouten en ongewone waarden, met bovenaan de DCMA 14-puntsbeoordeling. Opties onder *Rapportopties*.

**Hoge speling > (wd):** — Getal van 1 tot 365. Standaard: 44. Effect: een niet-voltooide taak met meer totale speling dan dit valt onder *Hoge speling*.

**Lange duur > (wd):** — Getal van 1 tot 365. Standaard: 44. Effect: een niet-voltooide taak, geen mijlpaal, met een langere duur valt onder *Lange duur*.

**Lag > (wd):** — Getal van 0 tot 365. Standaard: 10. Effect: een relatie met meer lag valt onder *Lange lag*. Een negatieve lag (lead) wordt altijd gemeld.

**Near-critical ≤ (wd):** — Getal van 0 tot 60. Standaard: 5. Effect: bepaalt de controle *Near-critical*.

De sectie *DCMA 14-puntsbeoordeling* staat bovenaan. Ze volgt de veertien controles van de Amerikaanse Defense Contract Management Agency, met de formules en normen uit hun *EVMS Program Analysis Pamphlet* (DCMA-EA PAM 200.1, oktober 2012). Per punt zie je *Aantal*, *Van* (het totaal waarover geteld is), *Waarde*, *Norm*, *Uitslag* en *Toelichting*. De uitslag is *Voldoet*, *Markering* of *n.v.t.*; bij n.v.t. staat de reden in de toelichting. Een markering is geen afkeuring: het pamflet noemt het een reden om verder te kijken. De drempels onder *Rapportopties* gelden niet voor deze sectie; die rekent altijd met de normen uit het pamflet.

Geteld worden niet-voltooide bladtaken, zonder mijlpalen en hammocks, en de relaties naar zulke taken. De melding boven het rapport noemt beide aantallen. De veertien punten:

- *Logica*: taken zonder voorganger of opvolger. Norm: hoogstens 5%.
- *Leads*: relaties met een negatieve lag. Norm: geen.
- *Lags*: relaties met een positieve lag, hoe kort ook. Norm: hoogstens 5%.
- *Relatietypes*: het aandeel FS-relaties. Norm: minstens 90%.
- *Harde constraints*: taken met een verplichte constraint of een MSO, MFO, SNLT of FNLT. Norm: hoogstens 5%.
- *Hoge speling*: taken met meer dan 44 werkdagen totale speling. Norm: hoogstens 5%. Vraagt een berekening.
- *Negatieve speling*: taken met een totale speling onder 0. Norm: geen. Vraagt een berekening.
- *Lange duur*: taken langer dan 44 werkdagen. Telt de baselineduur als de taak in de actieve baseline staat, anders de huidige duur. Norm: hoogstens 5%.
- *Ongeldige datums*: een werkelijke start of werkelijk einde ná de statusdatum, of een prognosestart of prognose-einde vóór de statusdatum. Norm: geen. Vraagt een statusdatum.
- *Resources*: taken zonder resource. Norm: geen. Alleen als het project resources gebruikt; anders n.v.t.
- *Gemiste taken*: van de taken die volgens de baseline vóór of op de statusdatum klaar moesten zijn, het aandeel dat later eindigt of later is voorspeld. Norm: hoogstens 5%. Vraagt een statusdatum en een actieve baseline.
- *Kritiek-padtest*: de app verlengt een kritieke taak met 100 werkdagen en rekent opnieuw, op een kopie, zonder het project te wijzigen. De test slaagt als de laatste taak van het project daarna niet vóór die taak eindigt. Getest wordt de kritieke, niet-voltooide taak met de vroegste start; de toelichting noemt de taak en hoeveel werkdagen het einde opschoof. In de weergave *Datums zoals opgeslagen* is deze test n.v.t. (*niet berekend*): de test rekent zelf, en het rapport toont dan de datums uit het bronbestand. Druk op Bereken (F5), dan draait de test weer.
- *CPLI*: (lengte van het kritieke pad + speling) / lengte van het kritieke pad. De lengte telt de werkdagen van de statusdatum tot het einde van de laatste taak; de speling is het verschil met het baseline-einde van die taak, of de berekende speling als de taak niet in de baseline staat. Norm: minstens 0,95. Vraagt een statusdatum.
- *BEI*: het aantal taken dat op de statusdatum voltooid is, gedeeld door het aantal dat volgens de baseline dan klaar had moeten zijn plus de taken zonder baseline. Norm: minstens 0,95. Vraagt een statusdatum en een actieve baseline.

Twee punten wijken af van het pamflet, omdat de app het begrip niet kent: *Lange duur* telt elke niet-voltooide taak, want het pamflet beperkt dit tot de detailplanningsperiode (rolling wave), en *Resources* kijkt alleen naar toegewezen resources, niet naar kosten. Het pamflet noemt voor de kritiek-padtest geen getal; de 100 werkdagen zijn een keuze van de app.

De controles staan in deze volgorde, met hun ernst. Fout: *Negatieve speling*, *Gemiste deadline*, *Geschonden constraint* en *Inconsistente voortgang* (werkelijke start of einde ná de statusdatum, prognosestart of prognose-einde vóór de statusdatum, 100% zonder werkelijk einde, werkelijk einde maar geen 100%, voortgang zonder werkelijke start). Waarschuwing: *Zonder voorganger (open begin)* en *Zonder opvolger (open einde)* (geen mijlpalen), *Lange duur*, *Lead (negatieve lag)*, *Harde constraint* (een verplichte constraint of een MSO, MFO, SNLT of FNLT), *Out-of-sequence voortgang* en *Gemiste taak (t.o.v. baseline)*. Info: *Near-critical*, *Hoge speling*, *Lange lag*, *Relatie anders dan FS* en *Zonder resource* (alleen als het project resources gebruikt). Het rapport bekijkt alleen bladtaken die geen hammock zijn. Het blok *Overzicht* telt *DCMA-markeringen*, *Fouten*, *Waarschuwingen*, *Ter informatie*, *Bladtaken* en *Relaties*; onder de DCMA-sectie staan een sectie *Overzicht* (per controle de ernst en het aantal) en een sectie *Bevindingen* (elke taak of relatie). Zonder berekening ontbreken de controles die speling nodig hebben.

## Resourcebelasting

Per resource per week of maand wat er gevraagd wordt tegenover wat beschikbaar is. Opties onder *Rapportopties*.

**Rapportageperiode:** — Standaard: *Hele project*. Effect: elke week of maand die de periode raakt, komt er in zijn geheel in. Zo toont een rij hetzelfde getal als het histogram.

**Aggregatie:** — Keuze uit *Per week* en *Per maand*. Standaard: *Per week*. Effect: een rij per kalenderweek (kolom *Week van*, met de maandag) of per kalendermaand (kolom *Maand*).

**Alleen overbelaste periodes** — Standaard: uit. Effect: aan laat alleen de weken of maanden met minstens één overbelaste dag zien.

De kolommen zijn *Resource*, *Type*, *Week van* of *Maand*, *Gevraagd*, *Beschikbaar*, *Verschil* (beschikbaar min gevraagd; negatief is een tekort), *Piek/dag* en *Overbelast*. *Gevraagd* is de som van de eenheid-dagen. Alleen weken of maanden mét vraag staan erin. Het blok *Overzicht* telt *Resources*, *Weken* of *Maanden*, *Overbelaste weken* of *Overbelaste maanden* en *Overbelaste resources*.

## Resourcetoewijzingen

Per resource de activiteiten waaraan hij hangt: wat doet deze ploeg of kraan? Opties onder *Rapportopties*.

**Rapportageperiode:** — Standaard: *Hele project*. Effect: met een periode komen alleen toewijzingen van activiteiten die de periode raken erin, plus achterstallig werk van vóór de referentiedag. *Hele project* filtert niet op datum.

**Voltooide taken meenemen** — Standaard: uit. Effect: aan neemt ook de toewijzingen van voltooide activiteiten mee.

De rijen staan per resource, en binnen een resource op start. Het blok *Overzicht* telt *Resources*, *Toewijzingen* en *Taken zonder resource*. De kolommen zijn *Resource*, *Type*, *WBS*, *Naam*, *Start*, *Einde*, *Rest*, *Eenh./dag*, *Volt.*, *Kritiek* en *Status*. *Resource* en *Type* staan alleen op de eerste rij van een resource. De status per rij is dezelfde als bij het Voortgangsrapport: *Voltooid*, *In uitvoering*, *Niet gestart*, *Had moeten starten* of *Had moeten eindigen*.

## WBS-samenvatting

De planning opgerold per WBS-element: het managementoverzicht. Opties onder *Rapportopties*.

**Niveau:** — tot welk niveau de WBS wordt getoond. Keuze uit *Volledige WBS* en de niveaus 1 tot en met 8. Standaard: niveau 2. Effect: de ondertitel meldt *Tot en met niveau 2*.

**Activiteiten tonen** — Standaard: uit. Effect: aan toont onder elk element ook de bladtaken zelf.

De kolommen zijn onder meer *WBS*, *Naam*, *Start*, *Einde*, *Baseline start*, *Baseline einde*, *Duur*, *Volt.*, *Δ einde (wd)*, *Min. TF*, *Act.* (aantal activiteiten), *Krit.*, *Bezig* en *Klaar*. Start en einde van een verzameltaak komen uit de laatste berekening. De voortgang is duurgewogen over de bladtaken. *Min. TF* en de tellingen gaan over de bladtaken eronder. Het blok *Overzicht* telt *WBS-elementen* en *Activiteiten*.

## Rapportageperiode

Vier tabelrapporten en de layout Resourcediagram van de Gantt-afdruk werken met een *Rapportageperiode:*: *Look-ahead*, *Voortgangsrapport*, *Resourcebelasting*, *Resourcetoewijzingen* en het *Resourcediagram*. Elk rapport onthoudt zijn eigen periode. Onder de keuzelijst staan *Van* en *Tot*, met de datums die de keuze oplevert.

**Referentiedag.** Een periode met *Volgende* of *Afgelopen* telt vanaf de statusdatum van het project, of vanaf vandaag als er geen statusdatum is. Dan staat er in de tabelrapporten *Geen statusdatum ingesteld — het rapport rekent met vandaag (…).* Schuif je de statusdatum op, dan schuift het venster mee. Beide dagen tellen mee.

**Volgende week, Volgende 2 weken, Volgende 4 weken, Volgende 6 weken, Volgende 8 weken, Volgende 12 weken** — vanaf de referentiedag, 7 dagen per week lang. Bij statusdatum donderdag 20 mei loopt *Volgende week* van 20 tot en met 26 mei en *Volgende 4 weken* van 20 mei tot en met 16 juni.

**Afgelopen week, Afgelopen 2 weken, Afgelopen 4 weken, Afgelopen 6 weken, Afgelopen 8 weken, Afgelopen 12 weken** — dezelfde zes, maar teruggerekend: 7 dagen per week lang, tot en met de referentiedag. *Afgelopen 2 weken* loopt bij 20 mei van 7 tot en met 20 mei.

**Volgende maand, Afgelopen maand** — een kalendermaand vooruit of terug, tot een dag vóór dezelfde datum in de andere maand. *Volgende maand* loopt bij 20 mei tot en met 19 juni; *Afgelopen maand* loopt van 21 april tot en met 20 mei.

**Hele project** — van de eerste start tot het laatste einde van de planning.

**Aangepast** — je eigen periode. Effect: *Van* en *Tot* worden twee datumvelden. Ze beginnen met de datums van de keuze die je net had. De einddatum mag niet vóór de begindatum liggen (*De einddatum ligt vóór de begindatum.*) en beide velden moeten gevuld zijn (*Vul beide datums in.*). Klopt de invoer niet, dan blijft het rapport op de laatste geldige periode staan.

## Zie ook

- [Een rapport maken en afdrukken](docs://howto-rapport-maken-en-afdrukken): het hele traject van rapporttype tot PDF.
- [De rapportageperiode kiezen](docs://howto-rapportageperiode-kiezen): stappen en voorbeelden.
- [Rekenopties en conventies](docs://ref-rekenopties-en-conventies): wat kritiek en near-critical betekenen.
- [Voortgang bijwerken](docs://howto-voortgang-bijwerken): de statusdatum en de baseline waar de rapporten mee rekenen.
- [Overbezetting oplossen](docs://howto-overbezetting-oplossen): wat je doet met de overbelaste weken uit de Resourcebelasting.
- [Import- en exportformaten](docs://ref-import-exportformaten): PDF naast de andere formaten.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): twee baselines met voortgang en statusdatum, om het variance-rapport mee te bekijken.
