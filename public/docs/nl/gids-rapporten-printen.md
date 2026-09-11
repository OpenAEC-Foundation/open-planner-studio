# Rapporten & printen

Een planning is pas af als je hem ook kunt delen — op papier voor een bouwvergadering, als
afbeelding in een presentatie, of als overzicht van wat er straks moet gebeuren en wat er al
verschoven is. Daarvoor is er het tabblad **Rapport**, met tien rapporttypen en een printvoorbeeld.

## Wat je hier leert

- De rapporttypen op het tabblad **Rapport**: de Gantt-afdruk, twee tabelrapporten over mijlpalen
  en variance, en zeven tabelrapporten voor de weekvergadering, de voortgangsrapportage, de
  planningsreview, de resources en het management.
- Hoe het printvoorbeeld werkt: papierformaat, oriëntatie en welke elementen je aan/uit zet.
- Hoe je een rapport daadwerkelijk afdrukt of als bestand bewaart.
- Wat **Ctrl+P** doet in deze app.

## Naar het rapportscherm

Er zijn drie ingangen naar hetzelfde scherm: klik op het lint-tabblad **Rapport**, ga naar
**Backstage → Afdrukken** (dat opent direct het rapportscherm), of druk op **Ctrl+P**. Alle drie
komen uit op dezelfde plek — er is geen los "print"-dialoogvenster, het rapportscherm ís het
afdrukvoorbeeld.

Het scherm is in twee kolommen opgedeeld: links een instellingenpaneel met bovenaan de keuze
**Rapporttype**, rechts een live voorbeeld dat direct meebeweegt met wat je links instelt.

## De rapporttypen

### Gantt-afdruk

Een volledige, opgemaakte afdruk van de Gantt-balken — dit is het enige rapporttype met een
instellingenblok:

- **Papier**: A4, A3, A2 of A1.
- **Oriëntatie**: liggend of staand.
- **Auto-fit op papier** (aan = de tijdas automatisch naar het gekozen formaat comprimeert) of een
  handmatige **zoom**-schuif als je auto-fit uitzet. Ook bij een meerjarige planning blijven de
  activiteitenkolom en rapporttekst daarbij even groot op A4, A3, A2 en A1; alleen de tijdas wordt
  dichter of ruimer.
- **Lettergrootte** — 90, 100, 110 of 125%; schaalt de rapporttekst, rijhoogte en kop/voet mee, los
  van het zoomniveau hierboven.
- **Kop op elke pagina herhalen** — standaard aan; houdt de rapportkop zichtbaar op elke afgedrukte
  pagina in plaats van alleen de eerste.
- **Tijdlijn over** — verdeelt de Gantt-tijdlijn over 1 tot 8 pagina's naast elkaar; alleen
  beschikbaar met auto-fit aan. Kies meer pagina's wanneer je de tijdas minder wilt comprimeren
  zonder de tabeltekst kleiner te maken.
- Aan/uit-schakelaars voor **taaknamen op staafjes**, **voltooiing tonen**, **kritiek pad**,
  **speling tonen**, **afhankelijkheden**, **weekenden** en **legenda**. Met **voltooiing tonen**
  uit verdwijnt de hele kolom *Volt.* uit de taaktabel en krijgt de tijdlijn die ruimte; de tabel
  begint bij de WBS-kolom, er is geen aparte rijnummerkolom.
- **Taaknamen afkappen** — aan (standaard): de naamkolom heeft een vaste breedte die u met de
  slider **Naamkolom** instelt, en een langere naam eindigt op een beletselteken. Uit: de kolom
  wordt precies zo breed als de langste naam in het rapport (inclusief inspringing), zodat niets
  wordt afgekapt; de tijdlijn wordt navenant smaller. Alleen bij een extreem lange naam kapt de
  kolom alsnog af, zodat één naam nooit de hele pagina opeist.
- **Balkkleuren** — één keuze die het Gantt-scherm en het rapport samen gebruiken. *Kritiek pad*
  geeft het vertrouwde rood/oranje/blauw; *Per taak — automatisch* geeft iedere taak een vaste
  paletkleur; met *Op categorie* kiest u een veld uit dezelfde lijst als bij **Groeperen**. Kies
  bijvoorbeeld **Taaktype** om constructie, installatie en sloop ieder één kleur te geven, of de
  activiteitcode **Discipline** om per discipline te kleuren. Ook WBS, gebruikersvelden en
  **Resource** zijn beschikbaar. Bij Resource wordt een taak met meerdere partijen gesegmenteerd
  naar verhouding van hun inzet. Taken zonder waarde krijgen neutraal grijs. Buiten *Kritiek pad*
  houdt een **rode rand** de kritieke taken herkenbaar en toont de legenda alleen de waarden die in
  het rapport voorkomen. Verandert u deze keuze onder **Beeld**, dan staat hij hier meteen gelijk
  — en andersom. Bestaat een eerder gekozen projectveld niet in het huidige project, dan gebruikt
  de app tijdelijk Taaktype zonder uw keuze te vergeten.
- **Statuslijn** — *Geen* (standaard), *Statusdatumlijn* (een verticale stippellijn op de
  statusdatum van het project) of *Voortgangslijn* (dezelfde zigzaglijn als op het scherm: per taak
  een uitstulping naar de voortgangspositie). Zonder statusdatum in het project tekent niets —
  stel er eerst één in via de projectgegevens; het paneel wijst u daarop.
- **Volg weergave** — staat dit aan, dan print de export precies wat u op het scherm ziet: het
  actieve filter, de groepering, de sortering én ingeklapte groepen blijven ingeklapt. Uit
  (standaard) print de export de volledige takenboom.
- Een **bedrijf**-veld (vult automatisch de projectinstelling, maar is hier los aanpasbaar) en de
  **auteur** (alleen-lezen, uit de projectgegevens).

De relatielijnen in het rapport gebruiken dezelfde tekentaal als het Gantt-scherm: een
**doorgetrokken** lijn is een bepalende (driving) relatie, een **gestreepte** lijn een
niet-bepalende, en een bepalende relatie tussen twee kritieke taken is **rood**. Zet je *kritiek pad*
uit, dan worden ook die lijnen neutraal. De legenda onderaan vat het verschil samen. Is er nog niet
gerekend, dan staan alle lijnen neutraal doorgetrokken — druk eerst op *Bereken* (F5).

Het overzichtsblok erboven toont live het aantal taken, bladtaken, kritieke taken en relaties in
het project. Het instellingenpaneel onthoudt je keuzes tussen sessies — open het tabblad Rapport
later opnieuw en papierformaat, schakelaars, lettergrootte en de rest staan er weer precies zo bij
als je ze achterliet. Alleen het bedrijfsveld reset: dat begint altijd bij de eigen instelling van
het project, zodat een rapport nooit de bedrijfsnaam van een ander project meesleept.

### Mijlpalen-overzicht

Een tabel van alle mijlpalen in het project: WBS, naam, soort (automatisch/start/eind), datum, de
onderliggende beperking of deadline, speling, of de mijlpaal verplicht is, en status (op schema /
kritiek / te laat). Het overzichtsblok toont het totaal aantal mijlpalen, hoeveel er verplicht zijn
en hoeveel er te laat zijn. Dit rapport heeft geen papierformaat-/oriëntatie-instellingen — het
print de tabel zoals getoond.

### Variance

Vergelijkt de huidige planning met de actieve baseline: baseline-start/-einde tegenover de huidige
start/einde, het verschil in werkdagen voor start en einde, en een status per taak (op schema /
later / eerder / nieuw / vervallen). Is er geen actieve baseline, dan meldt het scherm dat expliciet
in plaats van een leeg rapport te tonen. Het overzichtsblok toont ook de verschuiving van de
projecteinddatum in werkdagen, als die er is. Zie de gids [Baselines & voortgang](docs://gids-baselines-voortgang)
voor hoe je een baseline vastlegt vóórdat je dit rapport zinvol kunt gebruiken.

## De zeven tabelrapporten

De overige rapporttypen zijn tabelrapporten die rechtstreeks uit de laatste berekening komen. Ze
delen een paar afspraken:

- Alleen **bladtaken** tellen als activiteit; verzameltaken zie je alleen in de WBS-samenvatting.
  Hammock-taken (LOE) doen in de activiteitenrapporten niet mee; in de twee resourcerapporten
  wél, want ook toezicht boekt inzet — dezelfde set als het histogram.
- De **referentiedag** is de statusdatum van het project. Is er geen statusdatum, dan rekent het
  rapport met vandaag en zegt dat er bij. Stel dus eerst een statusdatum in via de projectgegevens
  als je een rapport voor een vaste peildatum wilt.
- Datums en speling komen uit de laatste **berekening**. Is de planning gewijzigd sinds de laatste
  keer dat je op *Bereken* (F5) drukte, dan staat er een melding boven het rapport; de PDF-export
  rekent altijd eerst door.
- Elk rapport heeft een klein blok **Rapportopties** onder de samenvatting, met bovenaan het
  papierformaat en de oriëntatie van de PDF (een brede tabel op A4 staand wordt erg klein — kies
  dan A3 liggend); die keuzes worden onthouden tussen sessies. Werkdagen worden afgekort tot *wd*.
- Een taak kan in meerdere secties van één rapport staan wanneer die secties elk een andere vraag
  beantwoorden (in uitvoering én kritiek, bijvoorbeeld).

### Look-ahead

De lijst voor het weekoverleg op de bouw: alle activiteiten die de komende *N* weken (standaard
vier) aan de orde zijn — wat start, wat loopt door, wat eindigt — plus wat er al had moeten
gebeuren. Per rij zie je WBS, naam, start en einde, de resterende duur, de voltooiing, de totale
speling, of de taak kritiek of near-critical is, de toegewezen resources en een status:
**Start** (begint in het venster), **In uitvoering**, **Had moeten starten** (start vóór de
peildatum, nog niet begonnen) of **Achterstallig** (einde vóór de peildatum, nog niet klaar). Een
taak die het hele venster overspant staat er ook in — hetzelfde overlap-idee als het filterveld
*In uitvoering* in de Gantt.

### Kritiek & near-critical

Welke activiteiten bepalen het projecteinde, en welke staan op het punt dat te gaan doen. Kritiek
komt uit de berekening; *near-critical* is een totale speling van 0 tot en met de drempel in de
rapportopties (standaard 5 werkdagen), of de markering uit de planningsopties als je die hebt
ingesteld. Voltooide taken staan er niet in. Gesorteerd op float-pad (wanneer de planningsopties
float-paden berekenen), dan op speling, dan op start. De kolommen tonen ook de vrije speling en
het padnummer.

### Voortgangsrapport

Het periodieke "waar staan we"-overzicht op de statusdatum. De samenvatting geeft baseline- en
prognose-einde met het verschil in werkdagen, de **geplande** tegenover de **werkelijke**
voortgang en de tellingen per staat. Beide percentages zijn duurgewogen over de bladtaken: een
mijlpaal weegt niets, een maand werk weegt zwaar. Gepland wordt gemeten op de datums van de
actieve baseline (de afspraak waartegen je meet); zonder baseline op de huidige planning, en dat
staat er dan bij. Daaronder vijf secties: voltooid in de afgelopen periode, in uitvoering, start
in de komende periode, achterstallig, en de open kritieke activiteiten. De periode (standaard twee
weken) kijkt evenveel terug als vooruit.

### Planningsgezondheid

Een geautomatiseerde planningsreview in de geest van de DCMA-14-puntscontrole. Elke controle
krijgt een ernst en een telling, met daaronder de bevindingen per taak of relatie:

- **Fouten** — negatieve speling, gemiste deadline, geschonden constraint, inconsistente voortgang
  (werkelijke start of einde ná de statusdatum, 100% zonder werkelijk einde, of andersom).
- **Waarschuwingen** — open begin of einde (geen voorganger of opvolger; mijlpalen uitgezonderd),
  lange duur, leads (negatieve lag), harde constraints (MSO/MFO/SNLT/FNLT of een verplichte pin),
  out-of-sequence voortgang.
- **Ter informatie** — near-critical, hoge speling en lange lags.

De drempels staan in de rapportopties. Standaard volgen ze DCMA: hoge speling en lange duur boven
44 werkdagen; een lag boven 10 werkdagen. Een schone planning heeft nul fouten; waarschuwingen en
informatie zijn aanleiding om te kijken, niet per se om te veranderen.

### Resourcebelasting per week

Per resource en per week de gevraagde inzet tegenover de beschikbare capaciteit (in eenheid-dagen),
het verschil, de piekbelasting op één dag en of de week overbelast is. Het is dezelfde berekening
als het histogram op het tabblad **Resources**, maar dan als tabel om naast elkaar te leggen in
een bemensingsoverleg. Alleen weken met vraag staan erin; met de optie *Alleen overbelaste weken*
houd je uitsluitend de knelpunten over.

### Resourcetoewijzingen

Per resource welke activiteiten eraan hangen: WBS, naam, start en einde, resterende duur, inzet in
eenheden per dag, voltooiing, kritiek en status. Voltooide taken staan er standaard niet in. Met een
venster in weken wordt het de *resource-look-ahead*: alleen wat deze ploeg of dit materieel de
komende weken te doen heeft, plus wat er nog open staat. De samenvatting telt ook de taken zonder
resource.

### WBS-samenvatting

De planning opgerold per WBS-element tot een instelbaar niveau — het managementoverzicht. Per
element: start en einde, baseline-start en -einde, duur, duurgewogen voortgang, het verschil van het
einde met de baseline, de kleinste totale speling en het aantal activiteiten, waarvan kritiek, in
uitvoering en voltooid. Kies een niveau (standaard 2) of de volledige WBS, en desgewenst ook de
activiteiten zelf onder hun element.

## Afdrukken en exporteren

Er is geen aparte printknop met een systeemdialoog: afdrukken gaat via de PDF. Exporteer het
rapport, open de PDF en print die — zo komt op papier precies wat het voorbeeld toont, met dezelfde
paginaovergangen (nooit dwars door een rij).

Elk rapporttype heeft een knop **Exporteer PDF**. Bij het Gantt-rapport bewaart die het huidige
voorbeeld als een echt PDF-bestand (bestandsnaam eindigend op `-planning.pdf`) — één pagina op de
fysieke maat van het gekozen papierformaat en de oriëntatie; de tabelrapporten exporteren hun tabel
met dezelfde papierinstellingen. Het PDF-bestand is **vectorgrafisch**:
balken, lijnen en tekst worden als PDF-tekenopdrachten opgeslagen in plaats van als één ingebedde
afbeelding, dus het blijft haarscherp op elk zoomniveau en de tekst is selecteerbaar en doorzoekbaar
in elke PDF-viewer. Dit geldt voor Latijnse, Cyrillische, Griekse, Arabische en Perzische tekst — Arabisch en Perzisch
worden eveneens als vector geshapet en ingebed. Chinese, Japanse en Koreaanse tekst is opt-in:
installeer je een font-extensie die die glyphs levert, dan wordt ook die tekst als vector ingebed
(selecteerbaar en doorzoekbaar); zonder zo'n extensie wordt die tekst als raster-afbeelding
geëxporteerd — nog steeds correct leesbaar, maar niet selecteerbaar of doorzoekbaar. Handig voor e-mail of archief zonder de systeem-printdialoog erbij te hoeven halen.
Wil je een ander papierformaat dan hierboven ingesteld, kies dat dan in het rapport zelf vóór het
exporteren — de PDF is altijd op de fysieke maat van het gekozen papier.

## Rapporten in de praktijk

Elk rapporttype dient een ander gesprek:

- Het **Gantt-rapport** is de klassieke bouwvergadering-uitdraai: het kritieke pad rood/gemarkeerd,
  de speling zichtbaar op de niet-kritieke balken, en de legenda die uitlegt wat welke kleur
  betekent. Zet **taaknamen op staafjes** en **voltooiing tonen** aan als het publiek de planning
  zelf niet kent; zet ze uit voor een strak overzicht op A1 als er toch een aparte takenlijst
  bijgaat.
- Het **mijlpalen-overzicht** is bedoeld voor wie alleen de belangrijke data wil zien zonder door
  tientallen taakregels te bladeren — bijvoorbeeld een opdrachtgever die vooral wil weten of de
  verplichte opleverdata gehaald worden. Het ◆-symbool voor een mijlpaalnaam in de tabel markeert
  een **verplichte** mijlpaal.
- Het **variance-rapport** is het gesprek over bijsturen: welke taken lopen uit ten opzichte van de
  baseline, en met hoeveel werkdagen. Bekijk dit rapport in de praktijk in de showcase
  [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), die twee
  baselines bevat (een contractbaseline en een herbaseline na meerwerk) met eigen voortgang en
  statusdatum — een goed voorbeeld om te zien hoe de Δ-kolommen zich vullen zodra er daadwerkelijk
  verschil is tussen baseline en actuele planning.

- De **look-ahead** is de lijst voor het weekoverleg; het **voortgangsrapport** de periodieke
  rapportage aan opdrachtgever of directie. Combineer ze: het voortgangsrapport zegt waar je
  staat, de look-ahead wat er nu moet gebeuren.
- **Planningsgezondheid** hoort bij een planningsreview vóór je een baseline vastlegt of een
  planning bij een contract voegt: nul fouten is de lat.
- De twee **resource**-rapporten en de **WBS-samenvatting** zijn er voor respectievelijk het
  bemensingsoverleg en het managementoverzicht. Alle zeven tabelrapporten werken ook op de
  showcase hierboven, die een statusdatum, baselines en voortgang bevat.

Het live voorbeeld rechts ververst bij elke wijziging aan de instellingen links — er is geen aparte
"vernieuwen"-knop nodig, en niets wordt pas bij het afdrukken zelf berekend.

## Verder lezen

- Een variance-rapport heeft pas iets te vergelijken als er een baseline is vastgelegd — lees de
  gids [Baselines & voortgang](docs://gids-baselines-voortgang).
- Kritiek pad en speling die op het Gantt-rapport getoond worden, komen uit dezelfde berekening als
  in de Gantt-weergave zelf — lees de gids
  [Kritiek pad & geavanceerde analyse](docs://gids-kritiek-pad-analyse) voor hoe je dat leest.
