# Taakdialoog en eigenschappenpaneel

Een taak kun je op twee plekken bewerken: in het venster *Taak bewerken* en in het paneel *Eigenschappen*. Ze delen bijna alle velden. Dit artikel zegt per veld wat het doet, wat de standaard is en wat je ervan merkt. Hoe je een taak aanmaakt en inricht, staat in [Taken en mijlpalen toevoegen](docs://howto-taken-en-mijlpalen-toevoegen); waarom de berekening uitkomt waar ze uitkomt, in [Kritiek pad en speling](docs://uitleg-kritiek-pad).

## De twee plekken

- **Taak bewerken** — het venster voor de eerste geselecteerde taak. Openen: F2, dubbelklikken op een balk in de Gantt, of rechtsklikken op een taak in de Gantt of de tabel en *Bewerken...* kiezen. Je wijzigingen staan in een concept tot je op *Opslaan* klikt (Enter); *Annuleren* (Esc) gooit ze weg. *Opslaan* is uitgeschakeld zolang de naam leeg is. Opslaan is één stap onder *Ongedaan*, ook wat je in de secties *Werkregel*, *Afhankelijkheden*, *Toewijzingen* en *Codes & velden* deed: die werken al tijdens het bewerken op het project, en *Annuleren* draait ze terug.
- **Eigenschappen** — het paneel in de rechterkolom, voor de actieve taak. Elke wijziging werkt direct; opeenvolgende wijzigingen van hetzelfde veld tellen als één stap onder *Ongedaan*. Zonder taak staat er *Selecteer een taak om eigenschappen te bekijken.* Aan- en uitzetten: *Beeld › Panelen › Eigensch.* Standaard: aan. Het paneel staat naast de Gantt en op het tabblad *Tabel*, niet op *IFC* en *Rapport* en niet onder het volledige resourcepaneel.

Alleen in het venster: *Bovenliggende taak* en de knoppen *Opslaan* en *Annuleren*. Alleen in het paneel: de prullenbak *Verwijder taak*, de knop *Bereken* onderaan, de sectie *Onderbrekingen*, de drie markeringen onder *Werkregel* (lange vrije periode, MS Project, opgeslagen datums) en het toevoegen van relaties en het springen naar een gekoppelde taak in *Afhankelijkheden*. Alle overige velden staan op beide plekken. Het venster toont *Afhankelijkheden*, *Toewijzingen* en *Codes & velden* alleen voor een bestaande taak.

Veranderde je iets dat de datums raakt, druk dan op *Bereken*. Berekenen gebeurt niet vanzelf, tenzij *Automatisch berekenen* aan staat.

## Algemeen

- **Naam** (in het venster *Naam \**) — de naam van de taak in de Gantt, de tabel en de rapporten. Verplicht: een lege naam wordt niet bewaard. Standaard bij een nieuwe taak: *Nieuwe taak*.
- **WBS Code** — de structuurcode van de taak, bijvoorbeeld `RB-301`. Verplicht. Bij *Planning › Structuur › WBS auto* is het veld uitgeschakeld (tooltip: *WBS-codes worden automatisch genummerd (Planning → Structuur)*), omdat de app de codes dan bezit.
- **Beschrijving** — vrije tekst. Geen invloed op de berekening; je kunt hem als kolom *Beschrijving* in de tabel tonen.
- **Type** — het taaktype. De lijst heeft de groepen *Ingebouwde typen* (*Bouw*, *Installatie*, *Sloop*, *Logistiek*, *Keuring/Inspectie*, *Verplaatsing*, *Renovatie*, *Onderhoud*), *Mijn taaktypen* en *Uit dit project*. *Overig* verschijnt alleen als de taak dat type al heeft. Onderaan staan *+ Nieuw taaktype…* en *Taaktypen beheren…*. Standaard: het type van de bovenliggende taak, anders *Bouw* (Bouwmodus aan, de standaard) of *Overig*. Effect: geen invloed op de berekening; je kunt erop groeperen en filteren en de balken erop kleuren. Een eigen type bewaart de app op je apparaat; kies je het, dan komt er een kopie in het project (*Uit dit project*). Typ je bij *+ Nieuw taaktype…* een naam die al in *Mijn taaktypen* staat, ook met andere hoofdletters, dan maakt de app geen tweede type maar kiest ze het bestaande. In *Taaktypen beheren…* bewerk of verwijder je alleen je eigen typen; een lege naam of een naam die al bestaat wordt niet bewaard. Verwijder je een type dat het geopende project gebruikt, dan vraagt de app het eerst, en de projectkopie blijft. Een type onder *Uit dit project*, bijvoorbeeld uit een bestand van iemand anders, komt alleen in je eigen lijst als je in *Taaktypen beheren…* op *Toevoegen aan mijn taaktypen* klikt.
- **Kalender** — de kalender waarin de taak zijn duur, einddatum en speling telt. Standaard: *Projectkalender: {naam}*. Effect: een taak op een eigen kalender werkt op andere dagen dan de projectkalender. Na een wijziging rekent *Bereken* de datums opnieuw uit. Zie [Kalenders en werkdagen](docs://uitleg-kalenders).
- **Bovenliggende taak** (alleen in het venster) — verplaatst de taak onder een andere taak. Standaard: de huidige bovenliggende taak; *- Geen (root) -* zet hem op het hoogste niveau. Een keuze die een kring in de relaties zou maken wordt bij *Opslaan* geweigerd met een melding en het venster blijft open.

## Aantekeningen

- **Aantekeningen** — een checklist bij de taak. *aantekening toevoegen* voegt een regel toe; het vinkje (*Afgevinkt*) streept hem door; het prullenbakje (*Verwijderen*) haalt hem weg. Zonder regels staat er *Nog geen aantekeningen.* Geen invloed op de berekening; de kolom *Aantekeningen* in de tabel toont ze met ✓ of ○ ervoor.

## Mijlpaal

- **Mijlpaal** — maakt van de taak een mijlpaal. Standaard: uit. Effect: de duur wordt 0. De app weigert het bij een samenvattingstaak (een taak met subtaken) en bij een taak met resource-toewijzingen, met een melding; verwijder eerst de toewijzingen. Zet je het vinkje weer uit, dan verdwijnen *Soort mijlpaal* en *Verplicht (contractueel)*.
- **Soort mijlpaal** (alleen bij een mijlpaal) — *Automatisch*, *Startmijlpaal* of *Eindmijlpaal*. Standaard: *Automatisch*. Effect: een startmijlpaal staat aan het begin van een dag, een eindmijlpaal aan het einde. Bij *Automatisch* geldt de mijlpaal als voorganger als een startmijlpaal, aan het begin van de dag.
- **Verplicht (contractueel)** (alleen bij een mijlpaal) — markeert een contractuele mijlpaal, zoals een inspectie of oplevering. Standaard: uit. Effect: een markering voor Gantt en rapporten; het bewaakt geen datum. Dat doe je met een constraint of deadline.

## Tijd

- **Start** (in het venster *Startdatum*) — toont de berekende start, dezelfde datum als de Gantt-balk en de kolom *Start*, niet het ruwe planningsanker. Verplicht: een leeg veld valt terug. Effect van typen: de nieuwe datum wordt het geplande anker (kolom *Geplande start*). Heeft de taak een voorganger en is hij nog niet gestart, dan legt de app de nieuwe start vast als constraint *Start niet eerder dan (SNET)* op die datum (of verzet een bestaande SNET), met een melding; de taak begint na *Bereken* dus niet eerder. Staat er een andere constraint dan *ASAP* of *SNET*, dan past de app de start niet toe en meldt welke constraint de start bepaalt.
- **Duur** — hoe lang de taak werkt. Typ `5d` voor dagen, of `12h` of `1h 30m` voor uren (`u` mag ook). Een getal zonder eenheid telt in de eenheid van de taak. Dagen zijn altijd geheel; uren mogen een decimaal hebben. Een ongeldige invoer geeft *Voer een geheel aantal dagen of uren in, bijvoorbeeld 2d of 12h.* en het veld springt terug. Standaard bij een nieuwe taak: 5 dagen (een mijlpaal 0). Het veld is uitgeschakeld bij een samenvattingstaak, een hammock en een mijlpaal met duur 0: hun duur volgt uit andere taken of is nul. Een taak in uren is uitgeschakeld zolang *Urenplanning inschakelen* uit staat; daar staat een knop met dezelfde naam. Effect: de duur bepaalt na *Bereken* het einde in de kalender van de taak. Heeft de taak resources en een werkregel, dan bepaalt de regel of werk of inzet meebeweegt. Is de taak al voor een deel gedaan, dan weigert de app een duur korter dan het gedane werk. Zie [Dagen en uren](docs://uitleg-dagen-en-uren).
- **Duureenheid** — keuze *Dagen* of *Uren*, met een infoknop ernaast. Alleen zichtbaar als *Urenplanning inschakelen* en *Gemengde dag/uur-planning toestaan* aan staan (de laatste staat standaard aan als urenplanning aan is). Effect: de app rekent alleen om als de uitkomst exact klopt, en doet dan een voorstel (*Voorstel toepassen* of *Behouden*). Past het niet exact, dan blijft de eenheid en meldt de app dat. Een kalender zonder geldige werktijden weigert de wissel.
- **Werkregel** — welke hoek van duur × inzet = werk vaststaat als een van de drie verandert. Keuzes: *Projectstandaard (Vaste duur en inzet)*, *Vaste duur en inzet*, *Vaste duur en werk*, *Vast werk* en *Vaste inzet*. Standaard: de projectstandaard. Eronder staat wat de regel beschermt (*Beschermd: …*) en, bij een taak uit MS Project, *Uit MS Project: effort-driven* of *Uit MS Project: niet effort-driven*. Alleen zichtbaar als *Toon werkregels en werk* aan staat (*Instellingen*, tabblad *Planning*, kop *Berekenen*) of het bestand zelf werkregels of opgeslagen werk draagt, en alleen bij een gewone taak: geen samenvattingstaak, mijlpaal, hammock of taak in verstreken tijd. Zie [Werkregels: duur, inzet en werk](docs://uitleg-werkregels).

## Hammock

- **Hammock (afgeleide duur)** — laat de duur volgen uit twee andere taken in plaats van er zelf een te hebben. Standaard: uit. Alleen bij een gewone taak, dus niet bij een mijlpaal of samenvattingstaak. Aan: *Start-driver* toont de voorgangers met een Eind-Start- of Start-Start-relatie, *Finish-driver* die met een Eind-Eind- of Start-Eind-relatie, elk met het relatietype erachter. Heb je geen finish-driver, dan staat er *Geen finish-driver (FF/SF) — de span valt terug op nul-lengte.* en is de duur nul. Zie [Een hammock maken](docs://howto-hammock).

## Constraint en deadline

Op een samenvattingstaak heeft een constraint of deadline geen effect: de berekening rekent alleen bladtaken door en leidt de datums van een samenvattingstaak af uit haar subtaken.

- **Constraint** — een datumgrens voor de taak. Keuzes: *Zo vroeg mogelijk (ASAP)*, *Zo laat mogelijk (ALAP)*, *Start niet eerder dan (SNET)*, *Start niet later dan (SNLT)*, *Eindig niet eerder dan (FNET)*, *Eindig niet later dan (FNLT)*, *Moet starten op (MSO)* en *Moet eindigen op (MFO)*. Standaard: *ASAP*, dat is geen constraint. Kies je ASAP, dan verdwijnen alle constraints van de taak; kies je ALAP, dan verdwijnt de secundaire. Effect na *Bereken*: een grens verschuift de taak of laat de speling negatief worden. Zie [Constraints en deadlines](docs://uitleg-constraints).
- **Constraint-datum** — de datum bij de constraint. Zichtbaar bij elke constraint behalve *ALAP*. Verplicht; een nieuwe constraint krijgt de geplande start als datum.
- **Verplicht (pin logica)** — alleen bij *MSO* en *MFO*. Standaard: uit. Aan: de datum is hard, overschrijft de relaties en zet de balk ook vóór zijn voorgangers vast. Een overtreding wordt negatieve speling stroomopwaarts. De eerste keer dat je hem aanzet, verschijnt eenmalig een toelichting.
- **Secundaire constraint** en **Secundaire datum** — een tweede grens, alleen een van *SNET*, *FNET*, *SNLT* of *FNLT* (of *(geen)*). Zichtbaar zodra er een primaire constraint is die geen ASAP, ALAP of harde pin is. Altijd zacht. Een verboden combinatie krijgt een rode rand en een reden: een secundaire constraint mag niet hard zijn, niet bij MSO/MFO of een harde pin, niet bij ASAP/ALAP, moet een grens zijn, en primair en secundair mogen niet dezelfde zijde begrenzen. Een geldig paar is bijvoorbeeld SNET met FNLT.
- **Deadline** — een streefdatum voor het einde. Leeg = geen deadline. Effect: de taak verschuift er niet door. Is het vroegste einde later, dan wordt de speling negatief en meldt de app *Deadline … overschreden — vroegste einde …*.

## Voortgang

- **Voortgang (%)** — een schuif van 0 tot 100. Standaard: 0. Effect: boven 0 vult de app een ontbrekende *Werkelijke start* in, en 100 vult het *Werkelijke einde* in. De status volgt: *Niet gestart* zonder werkelijke start, *Bezig* met een werkelijke start en *Voltooid* bij een werkelijk einde. De rest-duur (*Resterend*) is de duur × (1 − voortgang), bij een taak in dagen afgerond op hele dagen, bij een taak in uren op hele minuten. Gedaan werk wordt gemeten tot de statusdatum; is er nog geen statusdatum, dan zet de app hem op vandaag en meldt dat. Bij een samenvattingstaak is het veld uitgeschakeld: haar voortgang volgt na *Bereken* uit haar subtaken (*Afgeleid uit de onderliggende taken: wijzig de voortgang daar. De samenvattende taak volgt na berekenen (F5).*).
- **Werkelijke start** — de datum waarop de taak echt begon. Een datum na het werkelijke einde of na de statusdatum wordt geweigerd. Begint de taak volgens de planning pas na de statusdatum en krijgt hij nu voortgang, dan vraagt het venster *Werkelijke start opgeven*. Bij een mijlpaal staat er één veld *Werkelijke datum* in plaats van *Werkelijke start* en *Werkelijke einde*.
- **Werkelijke einde** — de datum waarop de taak echt klaar was. Invullen zet de voortgang op 100 en de status op *Voltooid*; wissen zet de voortgang terug op 0 en de status op *Bezig*. Zelfde weigeringen als *Werkelijke start*.
- **Resterend** — alleen-lezen (niet bij een mijlpaal): wat er aan duur over is, in de eenheid van de taak.

Het venster past deze regels op het concept toe; ze gelden pas na *Opslaan*. Zie [Voortgang, statusdatum en baseline](docs://uitleg-voortgang).

## CPM Resultaat

- **CPM Resultaat** — alleen-lezen weergave van de laatste berekening: *Vroegste start*, *Vroegste einde*, *Laatste start*, *Laatste einde*, *Totale speling*, *Vrije speling*, *Interfererende speling* en *Kritiek pad* (*Ja* of *Nee*). Speling staat in werkdagen met twee decimalen. Verouderd of nog niet berekend? Druk *Bereken*.

## Afhankelijkheden

- **Afhankelijkheden** — de relaties van deze taak, één regel per relatie: de gekoppelde taak (in het paneel de WBS-code, of de naam als die ontbreekt; in het venster de naam), een bliksemicoon als de relatie bepalend is (*Bepalende relatie (driving)*, na een berekening), het relatietype (*FS*, *SS*, *FF* of *SF*), de lag en een prullenbakje. In het paneel is de WBS-code een knop: aanwijzen toont de taak, klikken springt ernaartoe. In het venster is het platte tekst en zie je de sectie alleen als de taak relaties heeft.
- **Lag** — typ een getal met eenheid: `2d` werkdagen, `3ed` kalenderdagen, `2u` of `2h` werkuren, `3eu` of `3eh` kalenderuren, `50%` een percentage van de duur van de voorganger, `-25e%` een percentage in kalendertijd. Een min maakt er een lead van. Zonder eenheid telt het als werkdagen. Een ongeldige invoer kleurt het veld rood en valt terug. Zie [Relaties en lag](docs://uitleg-relaties).
- **Relatie toevoegen** (alleen in het paneel) — opent een concept-rij. Kies bij *Richting* *Voorganger* of *Opvolger*, zoek de taak met *Zoek taak…* op WBS of naam, kies het type en de lag, en bevestig met *Relatie vastleggen* (of *Annuleren*). Een duplicaat of een relatie met de eigen bovenliggende taak wordt geweigerd met een melding en de rij blijft staan.

## Onderbrekingen

Alleen in het paneel, en niet bij een mijlpaal, samenvattingstaak, hammock, taak in verstreken tijd, handmatig geplande taak of een taak die te kort is voor een pauze.

- **Onderbrekingen** — pauzes in het werk van de taak. Per pauze één regel: *na* (hoeveel werk vóór de pauze), *pauze* (de lengte) en de eenheid (*werkdagen*, bij een taak in uren *uren*), met eronder van–tot van het stuk erna. Een pauze die nivelleren maakte, draagt de badge *nivellering*. Een pauze met lengte 0 heft hem op; het prullenbakje per regel (*Onderbreking verwijderen*) haalt hem ook weg. Effect: de balk wordt onderbroken getekend en het einde schuift na *Bereken* op met de pauze.
- **Onderbreking toevoegen** — voegt een pauze van één eenheid toe in het midden van het langste stuk. Uitgeschakeld als er geen ruimte voor een pauze is.
- **Alle onderbrekingen opheffen** — verschijnt als de onderbrekingen uit een bronbestand komen in een vorm die hier niet te bewerken is (*Deze onderbrekingen komen uit het bronbestand in een vorm die hier niet bewerkt kan worden.*). Dan zie je alleen de datums.

Zie [Een taak splitsen](docs://howto-taak-splitsen).

## Toewijzingen

- **Toewijzingen** — de resources op deze taak. Per resource: de naam met een prullenbakje (*Verwijderen*), *Eenh./dag*, *Werk (rest)*, *Curve*, een knop *Urenverdeling…* en *Verplaats naar…*. Onderaan staat een keuzelijst *Resource toewijzen*; die wijst de resource toe met 1 eenheid per dag. Zonder resources staat er *Maak eerst resources aan (Resources-tab).*; zijn ze allemaal toegewezen, dan *Alle resources zijn al toegewezen.* Bij een mijlpaal of samenvattingstaak staat er dat toewijzen niet kan.
- **Eenh./dag** — hoeveel van de resource de taak per dag inzet, een getal boven 0. Effect: de belasting in het histogram en de overbezetting, en met een werkregel het werk.
- **Werk (rest)** — resterend werk in uren voor deze resource. Alleen zichtbaar als de werkregels zichtbaar zijn en de taak er een heeft; bij materiaal staat een streepje. Het slotje toont welke hoek de werkregel beschermt (*Beschermd door de werkregel …*). Het waarschuwingsdriehoekje (*Wijkt af van inzet × duur*) betekent dat het opgeslagen werk niet gelijk is aan inzet × restduur; het histogram volgt dan het opgeslagen werk.
- **Curve** — hoe het werk over de duur verdeeld wordt: *Uniform*, *Vooraan belast*, *Achteraan belast*, *Klokvorm*, *Vroege piek*, *Late piek*, *Dubbele piek* of *Schildpad*. Standaard: *Uniform*. Heeft de toewijzing een eigen urenverdeling, dan staat er *Contour* en is de keuzelijst uitgeschakeld; een geïmporteerde curve heet *Geïmporteerde curve*.
- **Urenverdeling…** — opent de urenverdeling per werkdag van deze toewijzing. Zie [Urenverdeling aanpassen](docs://howto-urenverdeling-aanpassen).
- **Verplaats naar…** — verplaatst de toewijzing naar een andere bladtaak die de resource nog niet heeft. Alleen zichtbaar als zo'n taak bestaat.

## Codes & velden

- **Codes & velden** — alleen zichtbaar als het project activity codes of gebruikersvelden heeft. Elke activity code is een keuzelijst met *(geen)* en de waarden als `code — omschrijving`; per type kies je hoogstens één waarde. Elk gebruikersveld heeft een invoer die past bij zijn type: *Tekst*, *Getal*, *Geheel getal*, *Kosten*, *Datum* of *Ja/nee*. Effect: geen invloed op de berekening; je kunt erop groeperen, filteren en ze als kolom tonen. Zie [Codes en eigen velden](docs://howto-codes-en-velden).

## Markeringen onder de werkregel

Alleen in het paneel, en alleen als ze van toepassing zijn.

- **Lange vrije periode** — *Deze taak loopt over een vrije periode van … dagen (… t/m …).*, of met de naam van de feestdag of het bouwvak erbij. Verschijnt als de taak over een aaneengesloten periode van 8 dagen of meer heen loopt waarin minstens één feestdag zit. Het is een waarschuwing, geen weigering; kijk of de planning zo bedoeld is.
- **MS Project-markering** — een badge *Volgt de urenverdeling uit MS Project*, *Datumvenster uit MS Project niet meer toegepast na bewerking — …* of *Eigen urenverdeling*, met *Lees meer*. Ze zegt of de urenverdeling uit een MS Project-bestand nog de datums stuurt.
- **Opgeslagen datums** — een badge bij een geïmporteerd bestand met vastgelegde datums: *Toont de datums zoals ze in het bestand staan voor deze taak* (bij een Primavera-bestand *Toont Primavera’s eigen opgeslagen datums voor deze taak*), *Wijkt af van de opgeslagen datums* of *Vastlegging deels onvolledig — zie de late-/spelingkolommen*, met *Lees meer*. Zie [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen).

## Kop en voet van het paneel

- **Verwijder taak** — het prullenbakje naast de kop *Taak*; verwijdert deze taak samen met haar subtaken, als één stap onder *Ongedaan*. De planning is daarna verouderd tot je *Bereken* drukt.
- **Bereken** — de knop onderaan; dezelfde berekening als *Start › Planning › Bereken*.

## Wat je hier niet vindt

- **Nivelleerprioriteit** — staat niet in het venster of het paneel. Je zet hem met rechtsklik en *Prioriteit* (*Laag* = 100, *Normaal* = 500, *Hoog* = 900) of typt een getal van 0 tot 1000 in de kolom *Nivelleerprioriteit*. Standaard: 500. Effect: nivelleren laat taken met een hogere prioriteit eerder op hun plek; 1000 zet de taak vast, zodat nivelleren hem nooit verschuift. Zie [Nivelleren](docs://uitleg-nivelleren).
- **Overige taakgegevens** — de rest van wat een taak draagt, zoals de kolommen *Handmatig gepland*, *Kleur* en de technische kolommen, staat alleen in de tabel; zie [Tabelkolommen](docs://ref-tabelkolommen).