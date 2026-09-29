# Resourcepaneel

Het resourcepaneel is waar je resources beheert: wie en wat er beschikbaar is, met welke capaciteit en op welke kalender. Bij het paneel horen het histogram onder de Gantt en de overbezetting. Dit artikel zegt per veld en knop wat het doet, wat de standaard is en wat je ervan merkt. Hoe je resources aanmaakt en toewijst, staat in [Resources beheren](docs://howto-resources-beheren) en [Resources toewijzen met een curve](docs://howto-resource-toewijzen); overbezetting oplossen in [Overbezetting oplossen](docs://howto-overbezetting-oplossen).

## Waar je het vindt

- **Volledig paneel** — *Resources › Beheer › Resources* of *Beeld › Panelen › Resources*. Het neemt de werkruimte over; het kruisje rechtsboven sluit het.
- **Resourcedock** — *Resources › Beheer › Resourcedock* of *Beeld › Panelen › Resourcedock*: een compacte lijst in de rechterkolom naast de Gantt. Zie hieronder.
- **Histogram** — *Resources › Histogram › Histogram* of *Beeld › Panelen › Histogram*: een strook onder de Gantt. Zie hieronder.
- **Weergaven** — hoort je project bij een resourcebibliotheek, dan staat rechtsboven in het paneel een keuze tussen *Bibliotheek*, *Project* en *Bezetting*. Zonder bibliotheek is er alleen de projecttabel. Bij elke keer openen begint het paneel op *Project*, zodat je niet ongemerkt in de gedeelde bibliotheek belandt.

## Nieuwe resource

- **Nieuwe resource in het project** (in de weergave *Bibliotheek* *Nieuwe resource in de bibliotheek*) — knop rechtsboven. Opent onderaan de tabel een conceptrij. Er ontstaat pas iets zodra je een naam invult en de rij verlaat (of Enter drukt); leeg wegklikken of Esc laat niets achter, geen resource en geen stap onder *Ongedaan*. Je mag de velden in elke volgorde invullen; alles gaat in één keer mee. Enter of pijl omlaag legt de rij vast en opent een verse conceptrij; Shift+Enter of pijl omhoog legt hem vast en gaat terug de tabel in. In de conceptrij ontbreken de uitklapper voor capaciteit, het kalenderpotlood en de prullenbak, want die werken op een resource die nog niet bestaat. De knop *Nieuwe resource* op *Resources › Beheer* doet hetzelfde.
- **Rasternavigatie** — in de tabel verplaatsen Enter en Shift+Enter, en pijl omhoog en omlaag, de cursor tussen de rijen. Enter op de laatste rij opent een nieuwe conceptrij.

## De weergave Project

De tabel met wat dit project gebruikt. Elke rij is een resource. Wijzigingen aan tekst en tarief gelden zodra je het veld verlaat en tellen als één stap onder *Ongedaan*.

- **Kleur** — een kleurkiezer. Standaard: de eerste vrije kleur uit het palet. Effect: de kleur van het resource-accent onder de Gantt-balken (*Beeld › Baselines & voortgang › Resource-accent*) en van het vakje in de dock.
- **Naam** — de naam van de resource. Een lege naam wordt niet bewaard; het veld valt terug op de oude naam.
- **Type** — *Arbeid*, *Materieel*, *Materiaal*, *Onderaannemer* of *Ploeg*. Standaard bij een nieuwe resource: *Arbeid*. Effect: *Materiaal* heeft een *Eenheid* en telt niet mee in de som *Alle resources* van het histogram; nivelleren slaat materiaal over. *Ploeg* kun je kiezen als *Ploeg* van andere resources. De overige typen rekenen hetzelfde.
- **Max. eenheden** — hoeveel van de resource per dag beschikbaar is, een getal boven 0 (fracties mogen). Standaard: 1. Effect: de capaciteit per dag. Ligt de belasting hoger, dan is de resource overbezet. Het pijltje ernaast klapt de *Tijd-gefaseerde capaciteit* uit; het getal bij het pijltje is het aantal stappen.
- **Tijd-gefaseerde capaciteit** — stappen met *Vanaf* (een datum) en *Max. eenheden*. *Stap toevoegen* voegt een stap toe met vandaag en 1. Zonder stappen staat er *Geen stappen — vlakke max. eenheden geldt altijd.* Effect: vanaf de datum van een stap geldt zijn *Max. eenheden* in plaats van de vlakke waarde; de laatste stap met een datum op of vóór een dag wint.
- **Kalender** — een keuzelijst met *Projectkalender* (standaard), de kalenders van het project en *+ Resourcekalender* voor een nieuwe. Het potlood (*Bewerken…*) opent de gekozen kalender en is uitgeschakeld bij *Projectkalender*. Effect: de dagen waarop de resource werkt. Op een vrije dag is de capaciteit 0; staat er dan werk gepland, dan is de resource overbezet met de reden *Werkt volgens kalender "…" niet op deze dag*. De datums van een taak verandert de resourcekalender niet. Zie [Kalenderdialoog](docs://ref-kalenders).
- **Tarief/uur** — de kosten per uur. Leeg = geen tarief; een ongeldig getal valt terug. Effect: alleen de kolom *Totaal*.
- **Totaal** — alleen-lezen: de belaste uren × het tarief, met twee decimalen; *—* zonder tarief of belasting. Onderaan telt een regel *Totaal* alle resources op. De uren komen uit de laatste berekening en tellen eenheden × uren per dag van de kalender van de taak; verouderd? Druk *Bereken*.
- **Eenheid** — de maateenheid van het materiaal, bijvoorbeeld `m³`. Alleen invulbaar bij het type *Materiaal* (tooltip *Alleen in te vullen bij resources van het type Materiaal.*). Effect: een label; het rekent niet mee.
- **Ploeg** — de ploeg waar de resource bij hoort, uit de resources van het type *Ploeg*. Standaard: *Geen*. Effect: alleen groepering; de capaciteit en belasting van een ploeg zijn niet de som van haar leden.
- **Verwijderen** (de prullenbak) — verwijdert de resource. Heeft ze toewijzingen, dan vraagt de app eerst *'…' heeft … toewijzing(en) — verwijderen?* met een vinkje om te bevestigen en een kruisje om te annuleren.
- **Naar de bibliotheek** — alleen als het project bij een resourcebibliotheek hoort, bij een resource met een naam die nog niet uit de bibliotheek komt. Zet haar in de bibliotheek, of koppelt haar aan een bestaand item met dezelfde naam, en meldt wat er gebeurde (*Toegevoegd.*, *Bestond al in de bibliotheek — nu gekoppeld.* of *Gekoppeld aan het bestaande bibliotheekitem — de waarden verschillen, zie de markering.*).
- **Losmaken van de bibliotheek** — het losmaak-icoon bij een resource die uit de bibliotheek komt. Haalt de herkomst weg, waarna alle velden weer vrij zijn.

Zonder resources staat er *Nog geen resources. Voeg er een toe om te beginnen.* Hoort het project bij een bibliotheek, dan staat er *Dit project gebruikt nog geen resources uit de bibliotheek.* met een hint.

### Resources uit de bibliotheek

Een resource die uit de bibliotheek komt, heeft een bibliotheek-icoontje (*Uit de bibliotheek*). Haar *Naam*, *Type*, *Tarief/uur* en *Eenheid* zijn dan platte tekst (*Bibliotheekwaarde — bewerk in de Bibliotheekweergave, of maak deze resource los van de bibliotheek.*), want de bibliotheek bepaalt wat de resource is. *Kleur*, *Max. eenheden*, de capaciteitsstappen, *Kalender* en *Ploeg* blijven te bewerken, want het project bepaalt hoeveel en wanneer. Twee badges kunnen erbij staan: *wijkt af — beslis* (een klik opent het venster *Resourcebibliotheek koppelen*) en *niet meer in de bibliotheek*, met de knop *Verwijder uit project*.

## De weergave Bibliotheek

Alleen als het project bij een resourcebibliotheek hoort. Bovenaan staat een gekleurde melding: *Dit bewerkt de bibliotheek en geldt voor alle projecten — valt buiten ongedaan maken.* De tabel heeft dezelfde velden als de weergave *Project* met deze verschillen:

- Er is geen kolom *Totaal*: dat is een berekening van één project.
- De kolom *Ploeg* staat er zodra de bibliotheek resources heeft.
- De kolom *Kalender* biedt de kalenders van de bibliotheek, met *Geen kalender* als standaard.
- **Toewijzen aan project** — zet de resource in het project, met een kopie van haar kalender. Meldt *Toegevoegd.* of *Zit al in het project.*
- **Verwijderen** — vraagt *'…' verwijderen uit de bibliotheek? Dit geldt voor alle projecten en is niet ongedaan te maken.*
- Zonder resources staat er *Nog geen resources in de pool.*

## De weergave Bezetting

Een leesvenster over alle geopende documenten: welke bibliotheekresources er waar geboekt zijn. Er is geen knop voor een nieuwe resource.

- **Tabel** — per bibliotheekresource: *Naam*, *Documenten* (het aantal documenten waarin ze staat), *Periode* en *Piek / Capaciteit* (de hoogste gezamenlijke belasting tegenover de capaciteit op die dag). Een rood *N dagen dubbel geboekt* betekent dat de resource in meerdere documenten samen meer heeft dan haar capaciteit. Het pijltje bij een naam klapt de documenten uit, elk met periode en piek; een klik op een rij toont het histogram van die resource (*Selecteer een resource om het histogram te zien.*).
- **Wat meetelt** — alleen documenten die in deze app geopend zijn (*Dit overzicht ziet alleen de documenten die in dit programma geopend zijn.*). Een document dat niet is doorgerekend, krijgt een melding bij zijn regel. Het actieve document telt mee met zijn laatst berekende cijfers (*Verouderd: dit zijn de laatst berekende cijfers — druk F5 in dit document.*). Een ander document rekent het overzicht alvast door (*Alvast doorgerekend voor dit overzicht — het document zelf toont oudere datums tot je daar F5 drukt of 'Automatisch berekenen' aanzet.*); staat *Automatisch berekenen* aan, dan rekent het overzicht die documenten echt door. Lukt het doorrekenen niet, dan telt het document niet mee (*Telt niet mee: planning niet doorgerekend — activeer dit document en druk F5.*). Zonder geboekte resources staat er *Geen bibliotheekresources geboekt in de geopende documenten.*
- **Volgorde** — resources met dubbele boekingen staan bovenaan, de meeste conflictdagen eerst, daarna alfabetisch.

## De resourcedock

Een compacte lijst in de rechterkolom, naast het paneel *Eigenschappen*. Per resource: een kleurvlakje, de naam (alleen-lezen), een rood driehoekje *Overbelast* zodra de resource minstens één overbelaste dag heeft, en *Max. eenheden* om te bewerken. Is er een taakselectie, dan staan er alleen de resources van die taken. In de kop staan *Volledig paneel* (opent het volledige paneel) en *Dock sluiten*. Zonder resources staat er *Nog geen resources. Voeg er een toe om te beginnen.*

## Het histogram

Een strook onder de Gantt die per dag de belasting van een resource toont. Aan- en uitzetten: *Resources › Histogram › Histogram* of *Beeld › Panelen › Histogram*. Standaard: uit; de keuze blijft bewaard. De hoogte is standaard 160 pixels en te verslepen aan de rand tussen Gantt en histogram.

- **Kiezer** — links, onder de taaktabel, staat een lijst: bovenaan vast *Alle resources*, daaronder één regel per resource. Een klik kiest de regel, de pijltoetsen bladeren erdoorheen, en *Resources › Histogram › Vorige* en *Volgende* doen hetzelfde. Een rood bolletje bij een regel betekent dat die resource minstens één overbelaste dag heeft. Is er een taakselectie, dan bevat de lijst alleen de resources van die taken; valt je gekozen resource daarbuiten, dan toont de strook tijdelijk *Alle resources* van de selectie.
- **Staven** — één staaf per dag: de belasting in eenheden. Een lijn toont de capaciteit; het deel van de staaf boven de capaciteit is rood. Linksboven staat de hoogste waarde met *eenheden*. *Alle resources* telt de belasting en de capaciteit van alle resources op, behalve materiaal.
- **Tooltip** — houd de muis even stil boven een dag: *N taken dragen bij op {datum}* met de namen van maximaal acht taken. Bij een gekozen resource en een dag waarop haar kalender niet werkt, staat er ook *Werkt volgens kalender "…" niet op deze dag*.
- **Meldingen in de strook** — *Herbereken (F5) om de belasting te tonen* zolang er geen belasting is, *Nog geen resources* zonder resources, en *⚠ Planning verouderd — herbereken (F5)* rechtsboven als de planning verouderd is.
- **Wat er meetelt** — de eenheden per dag van elke toewijzing, verdeeld over de werkdagen van de taak volgens de *Curve* (of de *Urenverdeling*); alleen bladtaken en geen mijlpalen. De belasting ververst na *Bereken* en na wijzigingen aan resources en toewijzingen; wijzig je de datums van taken, dan telt dat pas mee na *Bereken*.

## Overbezetting

Een resource is overbezet op een dag als haar belasting hoger is dan haar capaciteit. De capaciteit is *Max. eenheden* (met de capaciteitsstappen) op een werkdag van haar kalender, en 0 op een vrije dag. Materiaal telt hier wel mee. De reden is óf te weinig capaciteit, óf een dag waarop de resource volgens haar kalender niet werkt.

Waar je het ziet:

- **Resources › Overallocatie** — het aantal overbezette resources, of *Geen*.
- **Statusbalk** — *N resource(s) overbezet*; een klik opent het paneel *Waarschuwingen*.
- **Waarschuwingen** — per resource een regel *Overbezet op N dag(en) (eerste – laatste)*, met erbij *de resource werkt deze dag(en) niet volgens zijn kalender* als alle dagen vrije dagen zijn, of *waarvan N dag(en) waarop de resource niet werkt volgens zijn kalender* bij een mix. Zie [Meldingen en waarschuwingen](docs://ref-meldingen).
- **Histogram** — de rode delen van de staven en het rode bolletje in de kiezer.
- **Dock** — het driehoekje *Overbelast*.

Nivelleren kan overbezetting oplossen door taken binnen hun speling te verschuiven; het lost een resource niet op die op een vrije dag moet werken. Zie [Nivelleren](docs://uitleg-nivelleren).
