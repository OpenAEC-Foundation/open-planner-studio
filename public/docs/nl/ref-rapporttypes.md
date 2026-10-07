# Rapporttypes

Elk rapport op het tabblad *Rapport*, met de opties die erbij horen: wat ze doen, wat de beginwaarde is, wat er in het rapport verandert en waar je ze vindt. Hoe je een rapport maakt en als PDF opslaat, staat in [Een rapport maken en afdrukken](docs://howto-rapport-maken-en-afdrukken).

## Zo werkt het rapportvenster

Open het tabblad *Rapport* (of druk op Ctrl+P). Links staat de kolom *Rapportage* met de keuzelijst *Rapporttype*, het blok *Overzicht* met tellingen, het blok *Instellingen* of *Rapportopties* en onderaan de knop *Exporteer PDF*. Rechts staat het voorbeeld. Wat je in het voorbeeld ziet, komt in de PDF.

**Rapporttype** — welk rapport je ziet. Keuze uit elf rapporten. Standaard: *Gantt-afdruk*. Waar: *Rapport*, bovenaan de kolom *Rapportage*.

**Exporteer PDF** — maakt de PDF. Effect: er komt alleen een PDF; de app stuurt niets naar een printer. Is de planning verouderd, dan rekent de app eerst door. Geeft de berekening een fout, bijvoorbeeld door een kring in de relaties, dan maakt de knop geen bestand en toont hij de fout. Waar: *Rapport*, onderaan de kolom *Rapportage*.

**Onthouden.** Alle rapportopties bewaart de app op dit apparaat, voor al je projecten. Ze horen niet bij het projectbestand. Alleen het veld *Bedrijf:* van de Gantt-afdruk wordt niet bewaard.

**Actuele planning.** De rapporten gebruiken de laatste berekening. Is de planning gewijzigd sinds die berekening, dan staat boven de tabelrapporten *De planning is gewijzigd sinds de laatste berekening — druk op Bereken (F5) voor actuele waarden.* Is er nog nooit gerekend, dan staat er *Nog niet berekend — druk op Bereken (F5) voor datums en speling.* Staat het project in de weergave *Datums zoals opgeslagen*, dan tonen de rapporten de datums uit het bronbestand en meldt een strook dat.

**Afkortingen.** *wd* is werkdagen. *TF* is totale speling, *FF* vrije speling.

## Papier en oriëntatie

**Papier:** — het papierformaat van de PDF. Keuze uit A4, A3, A2 en A1. Standaard: A3. Effect: de pagina's worden voor dat formaat opgelegd. Er is één keuze voor alle rapporten: wat je bij het ene rapport kiest, geldt ook voor de andere. Op A4 staand wordt een brede tabel klein, want de tabel wordt op de paginabreedte geschaald. Waar: *Instellingen* (Gantt-afdruk en Resourcediagram) of *Rapportopties* (de zeven tabelrapporten). Het Mijlpalen-overzicht en de Variance tonen geen keuzes.

**Orientatie:** — liggend of staand. Keuze uit *Liggend* en *Staand*. Standaard: *Liggend*. Effect: zoals *Papier:*. Waar: dezelfde plek als *Papier:*.

## Gantt-afdruk

De planning als balkenplan, met een tabel links en een tijdlijn rechts, over meerdere pagina's als het moet. Het voorbeeld toont het papier met paginakop, tabel, tijdlijn en legenda. Het blok *Overzicht* telt *Taken:*, *Bladtaken:*, *Kritiek:* en *Relaties:*. Alle opties staan onder *Instellingen*.

**Bedrijf:** — het bedrijf in de paginakop. Standaard: het bedrijf uit de projectinformatie. Effect: alleen de kop van het rapport; wat je hier overtypt, wordt niet bewaard. Verander het bedrijf in *Instellingen › Project › Projectinfo*, in het veld *Opdrachtgever/organisatie*, en bevestig met *Toepassen*.

**Auteur:** — de auteur in de paginakop. Alleen lezen: de app neemt hem uit de projectinformatie.

**Lettergrootte:** — grootte van tekst en tabel in het rapport. Keuze uit 90%, 100%, 110% en 125%. Standaard: 100%. Effect: bij een grotere letter groeien tekst, rijen en tabel en levert de tijdlijn breedte in. Los van *Tekengrootte* in de instellingen.

**Balkkleuren:** — waar de kleur van een balk van afhangt. Keuze uit *Kritiek pad*, *Per taak — automatisch* en *Op categorie*, met bij *Op categorie* een keuzelijst *Categorieveld*. Standaard: *Kritiek pad*. Effect: dit is dezelfde keuze als *Balkkleuren* op het tabblad *Beeld*: verander je hem hier, dan verandert de Gantt op het scherm mee. Bestaat het gekozen veld niet in dit project, dan staat er *Dit veld bestaat niet in dit project. Taaktype wordt tijdelijk gebruikt.*

**Statuslijn:** — een lijn op de statusdatum. Keuze uit *Geen*, *Statusdatumlijn* en *Voortgangslijn*. Standaard: *Geen*. Effect: *Statusdatumlijn* trekt een lijn op de statusdatum; *Voortgangslijn* trekt de zigzaglijn die per taak naar de voortgang uitstulpt. Heeft het project geen statusdatum, dan staat er *Stel eerst een statusdatum in* en tekent het rapport niets.

**Volg weergave (filter, groepering, sortering)** — alleen bij de Gantt-afdruk. Standaard: uit. Effect: uit neemt de hele takenboom op papier. Aan tekent precies de rijen van het scherm: met je filter, groepering, sortering en ingeklapte fasen.

**Auto-fit op papier** — de tijdlijn op de paginabreedte schalen. Standaard: aan. Effect: aan schaalt de tijdlijn op de breedte van de pagina; het aantal pagina's volgt uit de hoogte. Uit gebruikt een vaste schaal (*Zoomen:*) en tegelt ook in de breedte, wat snel veel pagina's geeft.

**Zoomen:** — de vaste schaal van de tijdlijn. Alleen zichtbaar als *Auto-fit op papier* uit staat. Schuifregelaar van 1 tot 40. Standaard: 22. Effect: een grotere waarde maakt de tijdlijn breder, dus meer pagina's in de breedte.

**Tijdlijn over:** — spreidt de tijdlijn over meer paginabreedtes. Keuze van 1 tot en met 8 pagina's. Standaard: 1 pagina. Effect: alleen bij *Auto-fit op papier*; anders is de keuze uitgeschakeld en staat er *Alleen bij automatische passing*. Handig voor een lange planning die je in leesbare grootte wilt afdrukken.

**Kop op elke pagina herhalen** — Standaard: aan. Effect: aan zet de paginakop op elke pagina; uit alleen op de eerste.

**Voet op elke pagina herhalen** — Standaard: aan. Effect: aan zet de voet (projectnaam, afdrukdatum en legenda) op elke pagina; uit alleen op de laatste. Een uitdeelvel zonder legenda is onleesbaar, vandaar aan.

**Taaknamen op staafjes** — Standaard: aan. Effect: de naam van de taak op de balk, waar de balk breed genoeg is.

**Voltooiing tonen** — Standaard: aan. Effect: het voltooide deel van de balk wordt grijs, net als in de Gantt, en de kolom *Volt.* staat in de tabel. Een voltooide taak krijgt geen spelingsband.

**Taaknamen afkappen** — Standaard: aan. Effect: aan kapt namen in de tabel af op de breedte van *Naamkolom:*. Uit laat de kolom meegroeien met de langste naam; dan staat er *De naamkolom past zich aan de langste taaknaam aan*.

**Naamkolom:** — de breedte van de naamkolom. Alleen zichtbaar als *Taaknamen afkappen* aan staat. Schuifregelaar van 60 tot 400. Standaard: 130.

**Baseline-overlay tonen** — de actieve baseline naast de balken. Standaard: uit. Effect: een dunne balk in de baseline-kleur onder de taakbalk, alleen voor taken die in de baseline staan.

**Kritiek pad** — Standaard: aan. Effect: stuurt alleen de rode relatielijnen tussen twee kritieke taken en de legendaregel. De balken zelf volgen *Balkkleuren:*, ongeacht dit vinkje.

**Speling tonen** — Standaard: aan. Effect: de speling als band achter niet-kritieke balken.

**Afhankelijkheden** — de relatielijnen. Standaard: aan. Effect: tekent pijlen tussen de balken.

**Alleen werkbare dagen tonen** — comprimeert de tijd-as in dit rapport. Standaard: uit. Effect: weekenden en feestdagen worden overgeslagen, en weekbanden vervangen dan de weekendarcering. Los van dezelfde instelling voor de Gantt op het scherm.

**Weekenden** — Standaard: aan. Effect: arceert weekenden en feestdagen in de tijdlijn, zolang de schaal dagen te onderscheiden maakt. Op de gecomprimeerde as (*Alleen werkbare dagen tonen*) heeft dit vinkje geen effect.

**Legenda** — Standaard: aan. Effect: de legenda in de voet.

**Previewkwaliteit** — hoe scherp het voorbeeld is. Keuze uit *Standaard*, *Hoog* en *Maximaal*. Standaard: *Hoog*. Effect: alleen de scherpte van het voorbeeld op het scherm; de PDF verandert er niet door. Waar: *Rapport*, boven het voorbeeld.

## Resourcediagram

Dezelfde balken als de Gantt-afdruk, gegroepeerd per resource: wie doet wat en wanneer. Het blok *Overzicht* telt *Resources:*, *Toewijzingen:* en *Zonder resource:* (bij een periode ook *Buiten de periode:*). Het diagram deelt alle opties van de Gantt-afdruk, behalve *Volg weergave (filter, groepering, sortering)*, *Kritiek pad* en *Afhankelijkheden*: de rijen komen niet van het scherm, een taak kan onder meerdere resources staan, en de relaties worden er niet getekend. Het vinkje *Kritiek pad* is er verborgen en staat aan. Dit komt bij de opties van de Gantt-afdruk onder *Instellingen*, met deze vier vinkjes en de periode:

**Elke resource op een nieuwe pagina** — Standaard: uit. Effect: elke resource begint op een nieuwe pagina, zodat je een blad per ploeg of medewerker kunt uitdelen. Uit geeft één doorlopend document.

**Taken zonder resource meenemen** — Standaard: uit. Effect: de taken zonder resource komen als laatste band in het diagram, om te zien wat nog niemand heeft.

**Groeperen op resourcetype** — Standaard: uit. Effect: een laag erboven: eerst een band per resourcetype (arbeid, ploeg, onderaannemer, materieel, materiaal), daarbinnen per resource.

**Eenheden/dag en curve tonen** — Standaard: aan. Effect: twee kolommen achter de taaknaam met de eenheden per dag en de verdeelcurve van de resource van die band. Is er te weinig ruimte voor de tijdlijn, dan laat het rapport de kolommen weg en meldt *De kolommen Eenh./d en Curve zijn weggelaten: …*; meer ruimte geeft groter of liggend papier, een kleinere lettergrootte of een smallere tabel.

**Rapportageperiode:** — alleen de taken die de periode raken. Standaard: *Hele project*. Effect: de tijdas loopt exact over de periode. Is er niets in de periode, dan staat er *Geen taken in de rapportageperiode — kies een andere periode of Hele project.* Zie *Rapportageperiode* verderop.

## Mijlpalen-overzicht

Alle mijlpalen van het project in een tabel. Geen eigen opties. Het blok *Overzicht* telt *Mijlpalen*, *Verplicht* en *Te laat*. De kolommen zijn *WBS*, *Naam*, *Soort* (*Automatisch*, *Start* of *Eind*), *Datum*, *Constraint/deadline*, *Speling*, *Verplicht* en *Status*. De status is *Te laat* als de constraint is geschonden, de deadline gemist is of de totale speling negatief is; anders *Kritiek* als de mijlpaal kritiek is volgens de kritiek-definitie van het project; anders *Op schema*. Zonder mijlpalen staat er *Geen mijlpalen in dit project.* De PDF gebruikt het papier en de oriëntatie die je het laatst bij een ander rapport koos.

## Variance

De huidige planning naast de actieve baseline, voor leaf-taken. Geen eigen opties. Het blok *Overzicht* telt *Taken*, *Later* en *Eerder* en toont *Projecteinde: +3 werkdagen* (het verschil in werkdagen tussen het baseline-einde en het huidige einde). De kolommen zijn *WBS*, *Naam*, *Baseline start*, *Baseline einde*, *Huidige start*, *Huidig einde*, *Δ start (wd)*, *Δ einde (wd)* en *Status*. De status volgt het einde: *Later* als het einde later ligt dan in de baseline, *Eerder* als het eerder ligt, anders *Op schema*. *Nieuw* is een taak die niet in de baseline staat, *Vervallen* een taak die in de baseline staat maar niet meer in de planning. Zonder actieve baseline staat er *Geen actieve baseline — sla een baseline op of kies er een als actief.* De PDF gebruikt het papier en de oriëntatie die je het laatst bij een ander rapport koos.

## Look-ahead

Wat er in de periode loopt of start: het lijstje voor het weekoverleg. Opties onder *Rapportopties*.

**Rapportageperiode:** — het venster van het rapport. Standaard: *Volgende maand*. Effect: het rapport bevat de niet-voltooide activiteiten die de periode raken, ook als ze de hele periode overspannen, plus achterstallige activiteiten van vóór de referentiedag, zolang het einde van de periode niet vóór de referentiedag ligt.

**Near-critical ≤ (wd):** — de drempel voor *Near-critical*. Getal van 0 tot 60. Standaard: 5. Effect: een taak met meer dan 0 en hoogstens zoveel werkdagen totale speling telt als near-critical. Bij 0 telt alleen wat de reken-optie *Bijna-kritiek markeren* van het project markeert.

Het blok *Overzicht* telt *Activiteiten*, *Achterstallig*, *In uitvoering*, *Had moeten starten*, *Start*, *Kritiek* en *Near-critical*. De status per rij, altijd ten opzichte van de referentiedag: *Achterstallig* (niet voltooid en het einde ligt vóór de referentiedag), *Had moeten starten* (niet gestart terwijl de start vóór de referentiedag lag), *In uitvoering*, *Start* (nog niet gestart, start in het venster). De kolommen zijn *WBS*, *Naam*, *Start*, *Einde*, *Rest (wd)*, *Volt.*, *TF (wd)*, *Kritiek*, *Resources* en *Status*.

## Kritiek & near-critical

De activiteiten die het projecteinde bepalen en die daar bijna toe behoren. Optie onder *Rapportopties*.

**Near-critical ≤ (wd):** — Standaard: 5. Getal van 0 tot 60. Effect en betekenis zoals bij de Look-ahead. De ondertitel meldt de gekozen drempel.

Het rapport bevat de niet-voltooide taken die kritiek zijn (volgens de solver en de kritiek-definitie van het project) of near-critical, gesorteerd op spelingpad, dan op totale speling, dan op start. Het blok *Overzicht* telt *Kritiek*, *Near-critical*, *Kritieke ketens* en *Bladtaken*. De kolommen zijn *WBS*, *Naam*, *Start*, *Einde*, *Rest (wd)*, *TF (wd)*, *FF (wd)*, *Pad* en *Status*. De kolom *Pad* toont het spelingpad als de reken-optie *Meerdere speling-paden* aan staat, anders een streepje.

## Voortgangsrapport

Waar het project staat op de statusdatum. Opties onder *Rapportopties*.

**Rapportageperiode:** — Standaard: *Afgelopen maand*. Effect: *Voltooid in de afgelopen periode* telt binnen de periode. *Start in de komende periode* kijkt vanaf de statusdatum vooruit, tot *Vooruitblik t/m*; bij een *Afgelopen*-periode even ver vooruit als de periode terugkijkt.

**Near-critical ≤ (wd):** — Standaard: 5. Zoals bij de Look-ahead.

Het blok *Overzicht* toont *Statusdatum*, *Periode*, *Vooruitblik t/m*, *Baseline-einde*, *Prognose-einde*, *Δ einde (wd)*, *Gepland* (met *(baseline)* of *(huidige planning)*), *Werkelijk*, de tellingen *Voltooid*, *In uitvoering*, *Niet gestart*, *Achterstallig* en *Kritiek*. Gepland en werkelijk zijn gewogen naar de duur van de taken. Gepland meet tegen de baseline als er een actieve baseline is, anders tegen de huidige planning. De secties zijn *Voltooid in de afgelopen periode*, *In uitvoering*, *Start in de komende periode*, *Achterstallig* en *Kritieke open activiteiten*; een taak kan in meer dan één sectie staan.

## Planningsgezondheid

Een controle van de planning zelf op fouten en ongewone waarden, in de geest van de DCMA 14-punts-controle. Opties onder *Rapportopties*.

**Hoge speling > (wd):** — Getal van 1 tot 365. Standaard: 44. Effect: een niet-voltooide taak met meer totale speling dan dit valt onder *Hoge speling*.

**Lange duur > (wd):** — Getal van 1 tot 365. Standaard: 44. Effect: een niet-voltooide taak, geen mijlpaal, met een langere duur valt onder *Lange duur*.

**Lag > (wd):** — Getal van 0 tot 365. Standaard: 10. Effect: een relatie met meer lag valt onder *Lange lag*. Een negatieve lag (lead) wordt altijd gemeld.

**Near-critical ≤ (wd):** — Getal van 0 tot 60. Standaard: 5. Effect: bepaalt de controle *Near-critical*.

De controles staan in deze volgorde, met hun ernst. Fout: *Negatieve speling*, *Gemiste deadline*, *Geschonden constraint* en *Inconsistente voortgang* (werkelijke start of einde ná de statusdatum, 100% zonder werkelijk einde, werkelijk einde maar geen 100%, voortgang zonder werkelijke start). Waarschuwing: *Zonder voorganger (open begin)* en *Zonder opvolger (open einde)* (geen mijlpalen), *Lange duur*, *Lead (negatieve lag)*, *Harde constraint* (een verplichte constraint of een MSO, MFO, SNLT of FNLT) en *Out-of-sequence voortgang*. Info: *Near-critical*, *Hoge speling* en *Lange lag*. Het rapport bekijkt alleen bladtaken die geen hammock zijn. Het blok *Overzicht* telt *Fouten*, *Waarschuwingen*, *Ter informatie*, *Bladtaken* en *Relaties*; daaronder staan een sectie *Overzicht* (per controle de ernst en het aantal) en een sectie *Bevindingen* (elke taak of relatie). Zonder berekening ontbreken de controles die speling nodig hebben.

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

De rijen staan per resource, en binnen een resource op start. Het blok *Overzicht* telt *Resources*, *Toewijzingen* en *Taken zonder resource*. De kolommen bevatten onder meer de resource, de taak, start en einde, *Rest (wd)*, *Eenh./dag*, *Volt.*, *Kritiek* en *Status*.

## WBS-samenvatting

De planning opgerold per WBS-element: het managementoverzicht. Opties onder *Rapportopties*.

**Niveau:** — tot welk niveau de WBS wordt getoond. Keuze uit *Volledige WBS* en de niveaus 1 tot en met 8. Standaard: niveau 2. Effect: de ondertitel meldt *Tot en met niveau 2*.

**Activiteiten tonen** — Standaard: uit. Effect: aan toont onder elk element ook de bladtaken zelf.

De kolommen zijn onder meer *WBS*, *Naam*, *Start*, *Einde*, *Baseline start*, *Baseline einde*, *Duur (wd)*, *Volt.*, *Δ einde (wd)*, *Min. TF*, *Act.* (aantal activiteiten), *Krit.*, *Bezig* en *Klaar*. Start en einde van een verzameltaak komen uit de laatste berekening. De voortgang is duurgewogen over de bladtaken. *Min. TF* en de tellingen gaan over de bladtaken eronder. Het blok *Overzicht* telt *WBS-elementen* en *Activiteiten*.

## Rapportageperiode

Vier tabelrapporten en het Resourcediagram werken met een *Rapportageperiode:*: *Look-ahead*, *Voortgangsrapport*, *Resourcebelasting*, *Resourcetoewijzingen* en het *Resourcediagram*. Elk rapport onthoudt zijn eigen periode. Onder de keuzelijst staan *Van* en *Tot*, met de datums die de keuze oplevert.

**Referentiedag.** Een periode met *Volgende* of *Afgelopen* telt vanaf de statusdatum van het project, of vanaf vandaag als er geen statusdatum is. Dan staat er in de tabelrapporten *Geen statusdatum ingesteld — het rapport rekent met vandaag (…).* Schuif je de statusdatum op, dan schuift het venster mee. Beide dagen tellen mee.

**Volgende week, Volgende 2 weken, Volgende 4 weken, Volgende 6 weken, Volgende 8 weken, Volgende 12 weken** — vanaf de referentiedag, 7 dagen per week lang. Bij statusdatum donderdag 20 mei loopt *Volgende week* van 20 tot en met 26 mei en *Volgende 4 weken* van 20 mei tot en met 16 juni.

**Afgelopen week, Afgelopen 2 weken, Afgelopen 4 weken, Afgelopen 6 weken, Afgelopen 8 weken, Afgelopen 12 weken** — dezelfde zes, maar teruggerekend: 7 dagen per week lang, tot en met de referentiedag. *Afgelopen 2 weken* loopt bij 20 mei van 7 tot en met 20 mei.

**Volgende maand, Afgelopen maand** — een kalendermaand vooruit of terug, tot een dag vóór dezelfde datum in de andere maand. *Volgende maand* loopt bij 20 mei tot en met 19 juni; *Afgelopen maand* loopt van 21 april tot en met 20 mei.

**Hele project** — van de eerste start tot het laatste einde van de planning.

**Aangepast** — je eigen periode. Effect: *Van* en *Tot* worden twee datumvelden. Ze beginnen met de datums van de keuze die je net had. De einddatum mag niet vóór de begindatum liggen (*De einddatum ligt vóór de begindatum.*) en beide velden moeten gevuld zijn (*Vul beide datums in.*). Klopt de invoer niet, dan blijft het rapport op de laatste geldige periode staan.

## Zie ook

- [Een rapport maken en afdrukken](docs://howto-rapport-maken-en-afdrukken): het hele traject van rapporttype tot PDF.
- [De rapportageperiode kiezen](docs://howto-rapportageperiode-kiezen): stappen en voorbeelden.
- [Kritiek pad en speling](docs://uitleg-kritiek-pad): wat kritiek en near-critical betekenen.
- [Voortgang, statusdatum en baseline](docs://uitleg-voortgang): de statusdatum en de baseline waar de rapporten mee rekenen.
- [Overbezetting oplossen](docs://howto-overbezetting-oplossen): wat je doet met de overbelaste weken uit de Resourcebelasting.
- [Import- en exportformaten](docs://ref-import-exportformaten): PDF naast de andere formaten.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): twee baselines met voortgang en statusdatum, om het variance-rapport mee te bekijken.
