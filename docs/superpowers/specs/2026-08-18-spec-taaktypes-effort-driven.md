# Taaktypes en effort-driven plannen — voorstel voor een eigen etappe

*Ontwerpvoorstel, 2026-08-18. Voortgekomen uit het eigenaarsgesprek tijdens de
nul-afwijkingen-etappe (zie het eigenaarsbesluit in
`docs/superpowers/plans/2026-08-17-plan-mpp-nul-afwijkingen.md`). Status: voorstel —
de etappe zelf is nog niet gepland.*

## Waar dit over gaat

Elke serieuze planningsmotor draait om één rekensom: **werk = duur × inzet**. Ken je
er twee, dan ligt de derde vast — en het karakter van een planningspakket wordt
bepaald door de vraag welke van de drie er *beschermd* is wanneer de gebruiker aan
een van de andere twee draait. MS Project beschermt standaard het werk ("effort
driven": een tweede metselaar erbij halveert de duur), Primavera P6 beschermt in de
gangbare bouwconfiguratie de duur (meer mensen betekent meer bestede uren, niet
eerder klaar), en beide pakketten laten de keuze per taak instellen.

Open Planner Studio heeft die keuze vandaag niet. De app beschermt altijd duur en
inzet: dat zijn de opgeslagen velden, en werk wordt er elke keer uit afgeleid —
"werk = duur × load, nooit opgeslagen" staat letterlijk in het datamodel. Dat is
P6's bouwdefault, hardgecodeerd zonder menu. Voor een bouwplanner is dat een
verdedigbare keuze; het wordt pas een beperking wanneer iemand een MS
Project-bestand met fixed-work-taken importeert en er daarna in wil doorwerken, of
wanneer een gebruiker zelf effort-driven wil plannen.

De eigenaar heeft besloten dat die volledige motor er komt, en wil hem opt-in
aanbieden: standaard blijft alles zoals het nu is, en de gebruiker die het nodig
heeft kan de keuze ontsluiten. Dit voorstel beschrijft hoe — en vooral: in welke
vorm en volgorde die opt-in veilig te bouwen is.

## De kern van het voorstel

**Standaard blijft de app precies zoals hij is: de bouwdefault, zonder menu.** Wie
niets doet, merkt niets. De volledige driehoek — taaktypes per taak, effort-driven
gedrag, opgeslagen werk — wordt opt-in ontsloten.

**De belangrijkste ontwerpregel: de opt-in-knop gate uitsluitend de wéérgave, nooit
de berekening.** Taaktypes zijn gewone documentdata die in het projectbestand
round-trippen, en de motor respecteert ze altijd — ook bij een gebruiker die de
knop nooit heeft aangeraakt. De knop bepaalt alleen of de gebruiker de
bijbehorende bedieningselementen ziet en zelf types kan zetten. Daarmee rekent
hetzelfde bestand bij iedereen hetzelfde, wat de harde les van de
nul-afwijkingen-etappe is: rekensemantiek hoort in het document, nooit in een
lokale app-instelling.

**Besloten (eigenaar, 2026-08-18): een bestand dat deze functionaliteit al bevat,
ontsluit de weergave automatisch.** Open je een project met effort-driven- of
taaktype-data (bijvoorbeeld een geïmporteerd .mpp), dan gaat de taaktype-weergave
voor dát project aan, met een informatieve melding bij het openen — in lijn met
hoe de .mpp-import bijzonderheden nu al meldt. De knop blijft een keuze voor
nieuwe of schone projecten. Het alternatief — verborgen correct blijven rekenen —
is verworpen: dan verandert de inzet "vanzelf" bij een duurwijziging zonder dat
de gebruiker kan zien waarom, en dat is precies de MS Project-verwarring die deze
etappe juist moet vermijden. Terugvallen op de standaardregel voor zulke bestanden
kan sowieso niet: dan zou hetzelfde bestand andere datums geven afhankelijk van
een lokale instelling.

## Wat er onder de motorkap nodig is

De knop is het kleinste deel van het werk. Eronder ligt, in dwingende volgorde:

1. **Werk wordt een eerste-klas, opgeslagen grootheid** per toewijzing — volgens
   het conventiepatroon van de nul-afwijkingen-etappe: veld aanwezig ⇒ bron van
   waarheid, veld afwezig ⇒ afgeleid zoals nu, byte-identiek gedrag voor elk
   bestaand project. Alles wat nu stilzwijgend op "werk is afgeleid" leunt moet
   daarbij expliciet kiezen: de nivelleerder, de histogram-verdeling
   (`distributeUnits`), de MCP-leestools, de CSV/MSPDI/P6-exporteurs, het
   documentcontract en de IFC-round-trip.
2. **Taaktypes als documentdata** — per taak de keuze welke hoek beschermd is,
   plus de effort-driven-vlag, opgeslagen in het project-IFC.
3. **De contour-engine hoort bij deze etappe.** Zonder herschaling van de
   werkverdeling-per-dag blijft "bewerken zoals MS Project" een halve belofte:
   precies het na-bewerken-gat dat de aanleiding van dit voorstel was, zit in de
   contouren, niet in de taaktypes alleen. De etappe is pas af als een bewerking
   op een gecontourde taak de verdeling meeneemt.
4. **Een bewerken-meetlat.** De bestaande fidelity-suite toetst *openen en
   herberekenen*; voor deze etappe is een tweede soort test nodig: bewerking X op
   bestand Y geeft MS Projects uitkomst Z. Die infrastructuur bestaat nog niet en
   moet vóór de motorbouw ontworpen worden — anders is "het werkt" een mening.

## Neutraal tussen MSP en P6

MS Project en P6 hebben nét verschillende menukaarten: MSP combineert een task
type met een losse effort-driven-vlag; P6 kent duration types met het subtiele
onderscheid tussen units en units/time. Het interne model van de motor moet een
superset zijn die naar beide mapt — anders bouwen we een MSP-vormige motor en
botst de XER-etappe er later op, zoals ook al is vastgelegd bij de
solver-aandachtspunten voor etappe 2. Dit is een harde eis voor de ontwerpronde,
geen nice-to-have.

## De UX-vraag

Effort-driven is al dertig jaar de meest beklaagde functie van MS Project — niet
omdat het idee slecht is, maar omdat MSP verbergt welke hoek vastligt, zodat de
gebruiker het pas merkt als zijn planning onverwacht verschuift. De UX-opgave van
deze etappe is dus niet "het menu kopiëren" maar "de bescherming zichtbaar maken":
in één oogopslag zien welke hoek van de driehoek vastligt, vóórdat je ergens aan
draait.

Twee plekken staan vast. **Het eigenschappenpaneel krijgt sowieso een
taaktype-instelling** — dat is de plek waar per-taak-keuzes thuishoren, en hij
werkt onafhankelijk van welke tabelweergave er bestaat. Daarnaast is een
**taaktype-kolom** de natuurlijke tweede plek — maar let op: die veronderstelt de
tabel-weergave-revisie (zie de vault), en die is nog niet gebouwd. Is de revisie
er tegen die tijd, dan liftt de kolom mee op het nieuwe kolommensysteem; is hij
er niet, dan is het eigenschappenpaneel de enige plek en mag de kolom geen
verkapte afhankelijkheid worden die deze etappe aan de tabelrevisie vastketent.
De rest van het onderzoek (hoe je de beschermde hoek visueel markeert, wat er
gebeurt bij het omzetten van een type) hoort ín de ontwerpronde van de etappe,
niet ervoor.

## Wat er nu al gebeurt

Vooruitlopend op dit alles worden MSP's task-type- en effort-driven-velden bij
.mpp-import alvast **gelezen en bewaard** (round-trip door het IFC, zonder enig
rekengedrag) — een kleine leestaak in het bestaande stramien, geregistreerd als
nataak van de nul-afwijkingen-etappe. Daarmee gooit de import niets weg en vindt
deze etappe zijn voedingsdata straks kant-en-klaar.

## Impact op het bestaande werk

De schade aan wat er nu ligt is klein en zit precies waar hij is ingecalculeerd.
Het fidelity-harnas, de corpus-pins, manual scheduling, leveling en de
relatiedossiers blijven onaangeraakt — met één harde ontwerpvoorwaarde:
taaktype-semantiek werkt op *bewerkingen*, nooit op het herberekenen van een vers
geopend bestand, anders verschuiven de gepinde importdatums en begint het
hermeten opnieuw. Het documentcontract en de IFC-psets zijn additief uit te
breiden volgens het bestaande stramien.

Drie plekken worden wél echt geraakt. De **splits-machinerie** rekent op de
werk-as met een vaste duur; zodra werk opgeslagen is en een duurwijziging het
werk niet meer meeschaalt, is er een regel nodig voor wat een bewerking met de
gaten doet — dat ís de contour-herschalingsvraag, en de reden dat de
contour-engine in deze etappe hoort. Het **gelezen timephased-venster** (de
smalle populatie die nu MSP's opgeslagen venster volgt) is bewust
wegwerpmateriaal: de contour-engine vervangt het door echt herrekenen, en de
bijbehorende invalidatie-nataak vervalt dan grotendeels mee.

Het derde raakvlak, **histogram en nivelleerder**, verdient meer woorden. Vandaag
is de dagbelasting van een resource een *formule*: de verdeelfunctie neemt
load × duur, smeert dat totaal volgens de curvevorm over de werkdagen van de
taak uit, en zowel het histogram (belasting, capaciteit, overallocatie per dag)
als de nivelleerder (die conflicten zoekt en taken opschuift) rekenen met die
formule-uitkomst. Er bestaat geen opgeslagen dagverdeling; de curve is een vorm,
geen data. Met deze etappe draait dat om: de dagverdeling wordt échte data — uit
een contour, uit een handbewerking, of uit een geïmporteerd .mpp — en de formule
wordt de terugval voor taken zonder eigen verdeling. Dat betekent concreet: het
histogram moet opgeslagen dagwaarden tonen in plaats van ze uit te rekenen (en
toont daarmee voor het eerst ook de verdeling van geïmporteerde
MSP-contourtaken, die er nu vlak in staan), de overallocatie-detectie moet op
die echte dagwaarden toetsen, en de nivelleerder moet met werkelijke
dagbelastingen schuiven in plaats van met formule-schattingen — waarbij het
verschuiven van een gecontourde taak de verdeling mee moet nemen. De
verdeelfunctie blijft bestaan, maar zakt van "de waarheid" naar "de terugval".

Eén grensregel daarbij, vastgelegd om een botsing met issue #21 punt 7 te
voorkomen: de hele-eenheden-afronding (geheel tempo ⇒ hele eenheden per dag,
grootste-rest) bestaat om een *artefact van de formule* te onderdrukken — een
gladde curve die 0,67 kraan op een dag laat vallen. Ze hoort dus uitsluitend bij
het formule-/terugvalpad en raakt opgeslagen dagwaarden nooit: een fractie in een
contour (2 uur van een monteur op maandag, uit een .mpp of met de hand ingevoerd)
is bedoelde data, geen rekenresidu, en wordt getoond zoals hij is.

Wat níét bestaat en de duurste post wordt: de **bewerken-meetlat**. Alles wat nu
bewijsbaar is gaat over openen; "bewerking X geeft MS Projects uitkomst Z" heeft
eigen testinfrastructuur nodig die niet uit het corpus te oogsten valt. Daar zal
deze etappe zijn tijd aan kwijt zijn — niet aan het overhoop halen van wat er
al staat.

## Wat dit voorstel níét zegt

Het zegt niet *wanneer*. Er is op dit moment geen gebruikersvraag naar taaktypes;
de vragen die er wél liggen (tabellen, consistentie, resource-weergaven) hebben
voorrang. Dit voorstel legt de vorm en de volgorde vast zodat de etappe, wanneer
hij gepland wordt, met een schone start kan beginnen — en zodat tussentijdse
beslissingen in andere etappes er niet mee in tegenspraak raken.
