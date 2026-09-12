# Verdelen over projecten

Het [bezettingsoverzicht](docs://gids-bezettingsoverzicht) laat zien wélke resource over al je
geopende projecten heen dubbel geboekt staat. Deze gids gaat over de stap erna: die dubbele boeking
daadwerkelijk oplossen, zonder ieder project apart te moeten openen en handmatig te schuiven.

## Wanneer je dit gebruikt

Gebruik "Verdelen over projecten" zodra het bezettingsoverzicht een conflictregel toont: een
bibliotheekitem waarvan de som van de boekingen in meerdere projecten boven de bedrijfscapaciteit
uitkomt. In plaats van dat conflict project voor project te lijf te gaan, kijkt deze dialoog naar
alle betrokken projecten tegelijk en stelt in één keer een verschuiving voor die past binnen wat er
werkelijk beschikbaar is.

## De dialoog openen

Er zijn twee ingangen:

- Vanuit een conflictregel in het bezettingsoverzicht: de knop **Verdelen…**.
- Rechtstreeks via de Resources-ribbon: ook daar staat **Verdelen…**.

Heb je nog geen bibliotheekitem gekozen, dan opent die ribbonknop eerst een keuzelijst met de items
die op dit moment dubbel geboekt zijn over de geopende projecten, met per regel het aantal projecten
en het aantal conflictdagen. Eén klik op zo'n regel start het voorstel. Is er nergens een dubbele
boeking, dan zegt de dialoog dat gewoon: "Er is nu geen enkel bibliotheekitem dubbel geboekt over de
geopende projecten." In een lopende verdeling brengt **Ander item kiezen…** onderin je terug naar die
lijst; let op: daarmee vervalt ook de strook "Toegepast in … projecten".

De dialoog opent met de titel "Verdelen over projecten" en toont bovenaan om welk bibliotheekitem
het gaat. Je sluit hem met het kruisje rechtsboven of met Esc, of onderaan met **Verwerpen** — in
alle drie de gevallen verandert er niets, en het bezettingsoverzicht blijft gewoon onder de dialoog
staan, dus er is geen aparte "terug"-stap nodig.

### Uitproberen met de voorbeelden

De meegeleverde showcases dragen dit conflict zelf al. Open via **Bestand → Voorbeelden** alle drie
de showcases — [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc),
[Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) en
[Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) — elk in een
eigen tabblad, druk in elk project F5 en ga dan naar **Resources → Bezetting**. Precies twee rijen
staan rood, en dat is zo bedoeld: het bedrijf is op alle andere punten ruim genoeg voor deze drie
projecten samen.

De eerste is **Masonry crew**: die ploeg is er maar één, en begin juni metselt hij tegelijk aan de
uitbouw van de eengezinswoning én aan woning 6 van De Akkers. Dat is het schoolvoorbeeld — twee
projecten, één ploeg, netjes op te lossen door een van beide iets op te schuiven. De tweede is
**Plasterers**: één stukadoorsploeg die in alle drie de projecten meedoet, én binnen het
appartementencomplex al aan drie torens tegelijk gevraagd wordt. Die is ook oplosbaar, maar kost het
appartementencomplex een flink stuk uitloop — leerzaam om naast het eerste geval te leggen.

Klik op **Masonry crew** en dan op **Verdelen…**, en laat **Verdeel
automatisch** het voorstel maken; trek daarna eens de greep van een project naar rechts of zet een
project vast, en kijk wat er met de voorgestelde verschuiving gebeurt.

Een paar situaties blokkeren de verdeling meteen, met een duidelijke reden:

- Een van de betrokken projecten is nog niet doorgerekend — reken het eerst door (F5) in dat
  project.
- Het gekozen item is een materiaal-item; verdelen werkt alleen voor mensen en materieel.
- Geen van de projecten boekt hier daadwerkelijk werk op — er is dan niets te verdelen.

## Onderbrekingen toestaan

Bovenaan de dialoog staat de schakelaar **"Onderbrekingen toestaan"**. Die bepaalt hoe een taak mag
wijken wanneer er niet genoeg capaciteit is. Staat de schakelaar uit, dan schuift een taak die niet
past in zijn geheel op naar een later moment. Staat hij aan, dan mag een taak ook pauzedagen krijgen
— hele werkdagen zonder inzet tussen de wel-ingezette dagen door — in plaats van in één stuk te
verschuiven. Dit is precies dezelfde knop als "Leveling can create splits in remaining work" in
Microsoft Project.

Werk dat al begonnen is, wordt nooit onderbroken, met of zonder deze schakelaar aan: dat deel kan
alleen nog via uitloop wijken. Naast de schakelaar staat wat hij oplevert, als één verschil: staat
hij uit, dan lees je "zou 3 werkdagen besparen"; staat hij aan, dan "bespaart 3 werkdagen". Levert
onderbreken hier niets op, dan staat dat er ook gewoon.

## De balk is de bediening

Onder de schakelaar staat per project één balk op één gedeelde tijdas. Links de projectnaam met een
kleurstip en de speling die dat project nog heeft, in het midden de balk zelf, rechts de uitkomst.

In de balk zie je per werkdag een apart blokje in de kleur van het project, met een dun wit lijntje
ertussen — zo kun je de dagen letterlijk tellen. Een **gearceerd** blokje is een pauzedag: een
werkdag waarop de verdeler het werk even stillegt om ruimte te maken voor een ander project. Die
verschijnen alleen als je "Onderbrekingen toestaan" aan hebt staan.

Onderin de balk loopt een dunne meetlat mee. Het **grijs gestippelde** deel is de speling die dit
project nog had: zoveel mag het opschuiven zonder dat de einddatum meegaat. Het **massief rode**
deel is alles daarvoorbij — dát is echte einddatum-verschuiving. Een balk zonder rood kost het
project dus niets.

Rechts van het laatste blokje staat een **greep** met drie streepjes. Trek die naar rechts om dit
project meer uitloop toe te staan; de verdeler bepaalt vervolgens zelf op welke dagen hij pauzeert
en hoeveel van die ruimte hij echt nodig heeft. Wat je toestond maar niet nodig bleek, staat als een
**gestippeld kadertje** achter de balk. Terwijl je sleept rekent de app mee: de andere balken, de
grafiek en de uitkomsten veranderen onder je hand. Op een heel groot overzicht doet hij dat niet —
daar volgt de berekening zodra je loslaat.

Met het toetsenbord werkt dezelfde greep: pijltjes verzetten één werkdag, PageUp en PageDown drie,
Home zet het plafond op nul en End maakt het onbegrensd.

Rechts van de balk staat de uitkomst: een gekleurde pil met wat er met de einddatum gebeurt (groen
bij nul, amber bij een dag of twee, rood daarboven), en daaronder de uiterste datum die je toestond
plus hoeveel dagen daarvan echt benut zijn.

## Vastzetten of een plafond

Per project heb je twee manieren om de ruimte te begrenzen:

- **Vastzetten** (de pin) bevriest een project volledig: zowel de einddatum als de werkdagen blijven
  precies zoals ze nu zijn. Een vastgezet project levert dus nooit ruimte in — het telt in de
  berekening mee als een vaste last waar de andere projecten omheen moeten plannen.
- Het **plafond** ("Maximale uitloop van de einddatum") begrenst alleen hóéveel een project mag
  opschuiven, niet óf het mag opschuiven. Een plafond van 0 werkdagen betekent dat de einddatum niet
  mag verschuiven, maar de speling binnen de bestaande planning nog wel benut mag worden — dat is
  iets anders dan vastzetten, waar zelfs de werkdagen binnen de taak niet meer wijzigen.

Vastzetten doe je met de tekstknop **vastzetten** links bij de projectnaam; hij verandert dan in
**vast — losmaken**. Het plafond zet je met de greep in de balk, zoals hierboven beschreven. Met de
knop **Reset** onderin zet je in één keer alle plafonds en vastzettingen terug op neutraal; de
schakelaar "Onderbrekingen toestaan" blijft daarbij staan, want dat is een keuze over het
gereedschap en niet over één project.

## Vóór en na

Onder de balken staat een grafiek met twee standen, "Nu" en "Na verdelen": hoe de belasting op
dit moment tegen de capaciteitslijn van de bibliotheek aanloopt, en hoe dat verandert zodra je het
voorstel toepast. Blijft er, ondanks alle instellingen, een tekort over, dan toont de dialoog daarbij
per project welke taken niet passen, en blijft **Toepassen** uitgeschakeld met de reden erbij.

## Waarom het soms niet lukt

Een taak die niet verschoven kan worden, krijgt een reden in gewone taal in plaats van alleen een rood
vinkje:

- **De resource werkt niet op de benodigde dagen.** De kalender van de resource sluit de dagen uit
  die de taak nodig heeft; verschuiven binnen deze speling lost dat niet op.
- **Onvoldoende vrije capaciteit binnen de speling.** Er is nog wel ruimte, maar niet genoeg om dit
  conflict binnen de beschikbare speling op te lossen.
- **De taak vraagt op haar piek meer dan de capaciteit toelaat**, ongeacht hoe je schuift — dit is een
  taak die je alleen kunt oplossen door de inzet zelf te verlagen, niet door plannen.
- **Het plafond is te krap.** Binnen het toegestane aantal werkdagen uitloop is geen vrij venster te
  vinden. Zet het plafond ruimer, of sta onderbrekingen toe.
- **Een deadline of andere planningsbeperking houdt de taak op zijn plek** — extra uitloop toestaan
  helpt dan niet, want de taak mag daar sowieso niet vandaan.
- **Binnen de doorzochte periode is geen vrij venster gevonden.** Verderop in de tijd is het onbekend
  of er wel ruimte is — dit is geen definitief "nee", maar de zoekperiode was niet lang genoeg.
- **De restcapaciteit van de bibliotheek is op.** De eigen inzet van dit project had nog ruimte, maar
  andere projecten bezetten de resource al tot aan de bedrijfscapaciteit. Sta zo'n ander project met
  zijn greep meer uitloop toe, of zet het vast zodat de rest eromheen plant.

Een project met **["Datums zoals opgeslagen"](docs://datums-zoals-opgeslagen)** aan doet nooit mee in
een verdeling — verlaat die modus eerst in dat project voordat je het aan een verdeelvoorstel
toevoegt.

## Automatisch herberekend, of met de knop

Er is geen aparte modus voor automatisch rekenen: onderaan de dialoog staat één knop, die
**"Verdeel automatisch"** heet zolang er nog geen voorstel is, en daarna **"Herbereken"**. Wijzig je
een plafond, een vastzetting, of de schakelaar "Onderbrekingen toestaan", dan rekent de
dialoog het voorstel vanzelf meteen opnieuw door — je hoeft daarvoor niet zelf op de knop te drukken.
Alleen bij een heel groot overzicht (veel taken in een van de betrokken projecten, of veel taken die
op dit item boeken) schakelt de dialoog dat automatisme uit; ze meldt dan dat ze pas rekent zodra je
zelf op **Herbereken** drukt.

Wordt er in een van de betrokken projecten iets bewerkt terwíjl de dialoog openstaat — bijvoorbeeld
door een AI-assistent, door een andere bewerking, of doordat je zelf op **Toepassen** drukt — dan
meldt de dialoog het voorstel als niet meer actueel. Dat wordt nooit automatisch opnieuw doorgerekend:
druk dan zelf op **Herbereken**.

## De regel onder de grafiek

Onder de grafiek staat altijd één regel met het oordeel. Groen betekent dat het conflict opgelost is,
met daarbij de grootste einddatum-verschuiving en het project dat hem draagt. Rood betekent dat er
nog een tekort staat, met de eerste dagen waarop het misgaat. Staan alle projecten vast, dan zegt die
regel dat er niets te herverdelen valt en dat je er één moet losmaken. Is het voorstel niet meer
actueel — omdat je iets veranderde of omdat er in een van de projecten gewerkt is — dan staat dat
daar ook.

Die regel is er altijd, ook als er niets te melden valt. Dat is met opzet: zo verspringt de rest van
het scherm niet zodra er iets verandert.

## Toepassen en terugdraaien

Is het voorstel geldig en past alles, dan schrijft **Toepassen** de verschuiving in álle betrokken
projecten tegelijk — ook in een project waar **Automatisch berekenen** uitstaat. Elk project krijgt
daarbij een gewone ongedaan-maken-stap, alsof je daar zelf handmatig had geschoven. Lukt het schrijven
in een project onverhoopt niet, dan verandert er nergens iets en krijg je een foutmelding — Toepassen
faalt dus nooit half en nooit stil.

Na het toepassen verschijnt onderin de dialoog een strook "Toegepast in N projecten" met de knop
**Alles terugdraaien**. Die strook overleeft het wisselen, sluiten en openen van projecten binnen
dezelfde sessie: sluit je de dialoog, wissel je van document, of sluit en open je een project — open
je de dialoog daarna opnieuw vanuit dezelfde conflictregel, dan staat de strook er nog gewoon. Ze
verdwijnt pas door **Alles terugdraaien**, door een nieuw **Toepassen**, of doordat je een ander
bibliotheekitem gaat verdelen.

Terugdraaien maakt de stap in elk project ongedaan — behalve in een project waarin je zelf, ná het
toepassen, alweer verder gewerkt hebt: dat project wordt dan met naam gemeld en blijft op zijn nieuwe
stand staan, terwijl de rest gewoon teruggaat. Meteen na Toepassen meldt de dialoog het voorstel zelf
ook als "niet meer actueel" — dat is geen storing: de projecten zijn immers net gewijzigd. Druk op
Herbereken als je vanuit dezelfde dialoog nog een keer wilt verdelen.

De keuzes die je in deze dialoog maakt — vastzettingen en plafonds — horen net als de
"toegepast"-strook bij deze ene sessie: ze blijven staan zolang je met de app bezig bent, ook over een
documentwissel heen, en gaan pas terug naar neutraal zodra je een ander bibliotheekitem gaat
verdelen of de app herstart. In het project zelf worden ze nergens opgeslagen.

## De grens

"Verdelen over projecten" ziet, net als het bezettingsoverzicht waar het uit voortkomt, uitsluitend
de documenten die op dít moment in dít programma geopend staan. Een project dat niet open staat doet
niet mee, ook niet als het aan dezelfde bibliotheek gekoppeld is; en een collega die op een andere
machine plant, telt hier nooit mee.
