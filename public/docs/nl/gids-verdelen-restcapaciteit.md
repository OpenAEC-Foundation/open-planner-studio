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
het gaat. Een link **Terug naar bezetting** brengt je terug naar het overzicht zonder iets te
wijzigen.

Een paar situaties blokkeren de verdeling meteen, met een duidelijke reden:

- Een van de betrokken projecten is nog niet doorgerekend — reken het eerst door (F5) in dat
  project.
- Het gekozen item is een materiaal-item; verdelen werkt alleen voor mensen en materieel.
- Geen van de projecten boekt hier daadwerkelijk werk op — er is dan niets te verdelen.

Bovenin de dialoog zie je een histogram van vóór en ná: hoe de belasting nu tegen de capaciteit
aanloopt, en hoe dat eruitziet als je het voorstel toepast.

## Wie wordt het meest ontzien?

Onder het histogram staat de rangordelijst **"Wie wordt het meest ontzien?"**. Dit is de volgorde
waarin de projecten voorrang krijgen: het project bovenaan wijkt het minst, elk project daaronder
levert eerder in als er een keuze gemaakt moet worden. Versleep een project om de volgorde te
wijzigen, of gebruik de pijltjes om het een plek omhoog of omlaag te zetten.

Bij elk project staat de speling die het nog heeft, en wat het zou kosten om alléén dít project te
laten opschuiven — in werkdagen uitloop. Zo zie je meteen welk project de goedkoopste plek is om de
verschuiving te laten landen, in plaats van dat te moeten gissen.

## Onderbrekingen toestaan

De schakelaar **"Onderbrekingen toestaan"** bepaalt hoe een taak mag wijken wanneer er niet genoeg
capaciteit is. Staat de schakelaar uit, dan schuift een taak die niet past in zijn geheel op naar een
later moment. Staat hij aan, dan mag een taak ook pauzedagen krijgen — hele werkdagen zonder inzet
tussen de wel-ingezette dagen door — in plaats van in één stuk te verschuiven. Dit is precies dezelfde
knop als "Leveling can create splits in remaining work" in Microsoft Project.

Werk dat al begonnen is, wordt nooit onderbroken, met of zonder deze schakelaar aan: dat deel kan
alleen nog via uitloop wijken. Bij elke instelling van de schakelaar toont de dialoog het prijskaartje
in werkdagen uitloop, zodat je het effect kunt afwegen vóór je toepast.

## Vastzetten of een plafond

Per project in de rangordelijst heb je twee manieren om de ruimte te begrenzen:

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

Elke wijziging aan de rangorde, een plafond, een vastzetting of de schakelaar maakt het huidige
voorstel meteen ongeldig; druk daarna op **Herbereken**, of gebruik **Verdeel automatisch** om dat
telkens vanzelf te laten gebeuren. Wordt er in een van de betrokken projecten iets bewerkt terwijl de
dialoog openstaat, dan vervalt het voorstel om diezelfde reden. Blijft er, ondanks alle instellingen,
een tekort over, dan toont de dialoog per project welke taken niet passen, en blijft **Toepassen**
uitgeschakeld met de reden erbij.

## Toepassen en terugdraaien

Is het voorstel geldig en past alles, dan schrijft **Toepassen** de verschuiving in álle betrokken
projecten tegelijk — ook in een project waar **Automatisch berekenen** uitstaat. Elk project krijgt
daarbij een gewone ongedaan-maken-stap, alsof je daar zelf handmatig had geschoven.

Na het toepassen verschijnt een strook "Toegepast in N projecten" met de knop **Alles terugdraaien**.
Die strook blijft staan, ook als je intussen elders in de app verder werkt, zodat je niet meteen hoeft
te beslissen. Terugdraaien maakt de stap in elk project ongedaan — behalve in een project waarin je
zelf, ná het toepassen, alweer verder gewerkt hebt: dat project wordt dan met naam gemeld en blijft op
zijn nieuwe stand staan, terwijl de rest gewoon teruggaat.

De keuzes die je in deze dialoog maakt — rangorde, vastzettingen, plafonds — horen bij deze ene
verdeelsessie. Ze worden nergens in het project opgeslagen: sluit je de dialoog of herstart je de
app, dan begin je de volgende keer weer met een neutrale rangorde, zonder pins of plafonds.

## De grens

"Verdelen over projecten" ziet, net als het bezettingsoverzicht waar het uit voortkomt, uitsluitend
de documenten die op dít moment in dít programma geopend staan. Een project dat niet open staat doet
niet mee, ook niet als het aan dezelfde bibliotheek gekoppeld is; en een collega die op een andere
machine plant, telt hier nooit mee.
