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
- Vanuit de Resources-ribbon, wanneer er een conflict openstaat.

De dialoog opent met de titel "Verdelen over projecten" en toont bovenaan om welk bibliotheekitem
het gaat. Je sluit hem met het kruisje rechtsboven of met Esc, of onderaan met **Verwerpen** — in
alle drie de gevallen verandert er niets, en het bezettingsoverzicht blijft gewoon onder de dialoog
staan, dus er is geen aparte "terug"-stap nodig.

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
alleen nog via uitloop wijken. Bij elke instelling van de schakelaar toont de dialoog het prijskaartje
in werkdagen uitloop, zodat je het effect kunt afwegen vóór je toepast.

## Wie wordt het meest ontzien?

Daaronder staat de rangordelijst **"Wie wordt het meest ontzien?"**. Dit is de volgorde waarin de
projecten voorrang krijgen: het project bovenaan wijkt het minst, elk project daaronder levert eerder
in als er een keuze gemaakt moet worden. Versleep een project om de volgorde te wijzigen, of gebruik
de pijltjes om het een plek omhoog of omlaag te zetten.

Bij elk project staat de speling die het nog heeft, en wat het zou kosten om alléén dít project te
laten opschuiven — in werkdagen uitloop. Zo zie je meteen welk project de goedkoopste plek is om de
verschuiving te laten landen, in plaats van dat te moeten gissen.

## Vastzetten of een plafond

Per project heb je daaronder, op een strook per project, twee manieren om de ruimte te begrenzen:

- **Vastzetten** (de pin) bevriest een project volledig: zowel de einddatum als de werkdagen blijven
  precies zoals ze nu zijn. Een vastgezet project levert dus nooit ruimte in — het telt in de
  berekening mee als een vaste last waar de andere projecten omheen moeten plannen.
- Het **plafond** ("Maximale uitloop van de einddatum") begrenst alleen hóéveel een project mag
  opschuiven, niet óf het mag opschuiven. Een plafond van 0 werkdagen betekent dat de einddatum niet
  mag verschuiven, maar de speling binnen de bestaande planning nog wel benut mag worden — dat is
  iets anders dan vastzetten, waar zelfs de werkdagen binnen de taak niet meer wijzigen.

Het plafond is een sleepbare handle op de fasestrook van elk project: sleep hem, of gebruik de
pijltjestoetsen om per werkdag te verschuiven, Home voor een plafond van 0, en End voor onbegrensd.
Het label bij de handle toont wat dat betekent voor de einddatum van het project, en als er minder
uitloop nodig bleek dan je had toegestaan, meldt het label dat expliciet: "gevraagd X, dichtst
haalbare Y".

## Vóór en na

Onder de fasestroken staat een grafiek met twee standen, "Nu" en "Na verdelen": hoe de belasting op
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
  andere projecten bezetten de resource al tot aan de bedrijfscapaciteit. Geef zo'n ander project een
  lagere plek in de rangorde, of zet het vast zodat de rest eromheen plant.

Een project met **["Datums zoals opgeslagen"](docs://datums-zoals-opgeslagen)** aan doet nooit mee in
een verdeling — verlaat die modus eerst in dat project voordat je het aan een verdeelvoorstel
toevoegt.

## Automatisch herberekend, of met de knop

Er is geen aparte modus voor automatisch rekenen: onderaan de dialoog staat één knop, die
**"Verdeel automatisch"** heet zolang er nog geen voorstel is, en daarna **"Herbereken"**. Wijzig je
de rangorde, een plafond, een vastzetting, of de schakelaar "Onderbrekingen toestaan", dan rekent de
dialoog het voorstel vanzelf meteen opnieuw door — je hoeft daarvoor niet zelf op de knop te drukken.
Alleen bij een heel groot overzicht (veel taken in een van de betrokken projecten, of veel taken die
op dit item boeken) schakelt de dialoog dat automatisme uit; ze meldt dan dat ze pas rekent zodra je
zelf op **Herbereken** drukt.

Wordt er in een van de betrokken projecten iets bewerkt terwíjl de dialoog openstaat — bijvoorbeeld
door een AI-assistent, door een andere bewerking, of doordat je zelf op **Toepassen** drukt — dan
meldt de dialoog het voorstel als niet meer actueel. Dat wordt nooit automatisch opnieuw doorgerekend:
druk dan zelf op **Herbereken**.

## Toepassen en terugdraaien

Is het voorstel geldig en past alles, dan schrijft **Toepassen** de verschuiving in álle betrokken
projecten tegelijk — ook in een project waar **Automatisch berekenen** uitstaat. Elk project krijgt
daarbij een gewone ongedaan-maken-stap, alsof je daar zelf handmatig had geschoven. Lukt het schrijven
in een project onverhoopt niet, dan verandert er nergens iets en krijg je een foutmelding — Toepassen
faalt dus nooit half en nooit stil.

Na het toepassen verschijnt onderin de dialoog een strook "Toegepast in N projecten" met de knop
**Alles terugdraaien**. Die strook blijft staan zolang je in hetzelfde document verder werkt — ook als
je de dialoog intussen sluit en later op dezelfde conflictregel opnieuw opent. Wissel je van
document, dan sluit de dialoog vanzelf en begint een volgende keer weer bij nul, ook wat de terugweg
betreft. De strook verdwijnt verder door een nieuw **Toepassen**, of doordat je een ander
bibliotheekitem gaat verdelen.

Terugdraaien maakt de stap in elk project ongedaan — behalve in een project waarin je zelf, ná het
toepassen, alweer verder gewerkt hebt: dat project wordt dan met naam gemeld en blijft op zijn nieuwe
stand staan, terwijl de rest gewoon teruggaat. Meteen na Toepassen meldt de dialoog het voorstel zelf
ook als "niet meer actueel" — dat is geen storing: de projecten zijn immers net gewijzigd. Druk op
Herbereken als je vanuit dezelfde dialoog nog een keer wilt verdelen.

De keuzes die je in deze dialoog maakt — rangorde, vastzettingen, plafonds — horen bij deze ene
verdeelsessie. Ze worden nergens in het project opgeslagen: sluit je de dialoog of herstart je de
app, dan begin je de volgende keer weer met een neutrale rangorde, zonder pins of plafonds.

## De grens

"Verdelen over projecten" ziet, net als het bezettingsoverzicht waar het uit voortkomt, uitsluitend
de documenten die op dít moment in dít programma geopend staan. Een project dat niet open staat doet
niet mee, ook niet als het aan dezelfde bibliotheek gekoppeld is; en een collega die op een andere
machine plant, telt hier nooit mee.
