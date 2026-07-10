# Kritiek pad & geavanceerde analyse

Elke planning heeft een langste keten van taken die samen bepalen wanneer het project klaar is: het kritieke pad. Alles daarbuiten heeft speling — ruimte om uit te lopen zonder de einddatum te raken. Deze gids gaat verder dan "welke balken zijn rood": total/vrije/interfererende speling, bijna-kritiek werk, meerdere gelijkwaardige kritieke paden, hammocks, harde pins en hun effect stroomopwaarts, en externe koppelingen tussen projecten.

## Wat je hier leert

- Het kritieke pad lezen, en het verschil tussen totale, vrije en interfererende speling.
- Bijna-kritiek werk: de drempel instellen en de amber-markering herkennen.
- Meerdere kritieke paden tegelijk — wanneer dat gebeurt en hoe je ze ziet.
- Harde pins en hun effect op speling, inclusief negatieve speling die stroomopwaarts ontstaat.
- Hammocks (Level of Effort): wat ze wel en niet doen.
- Externe koppelingen tussen projecten: het bevroren anker, verversen, en de "bron ontbreekt"-status.
- Een pad traceren via het contextmenu of het lint.
- De sectie **Berekening** in de projectinstellingen.

Volg mee met [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) — de grote, "kitchen sink"-showcase met drie parallelle torens die vrijwel elk onderwerp in deze gids laat zien: meerdere kritieke paden, bijna-kritiek werk, een hammock, een harde pin en een externe koppeling naar een apart bronbestand.

## Het kritieke pad lezen

Druk op **F5** (of de knop **Bereken**) om de planning door te rekenen. De statusbalk onderin toont daarna bijvoorbeeld "Kritiek pad: N taken, M werkdagen" — het aantal taken op het kritieke pad en de totale doorlooptijd. In het Gantt-diagram krijgen kritieke taken een eigen (rode) balkkleur: taken zonder speling, waarvan elke dag vertraging direct de projecteinddatum meeschuift.

Dubbelklik een taak en kijk in de sectie **CPM Resultaat** voor de exacte cijfers: **Vroegste start**, **Vroegste einde**, **Laatste start**, **Laatste einde**, **Totale speling**, **Vrije speling** en (indien van toepassing) **Interfererende speling**, plus of de taak op het **Kritiek pad** ligt. Wil je deze velden als kolommen in de taaktabel? **Beeld → Kolommen…** en vink ze aan.

### Totale, vrije en interfererende speling

- **Totale speling** — hoeveel een taak in totaal mag uitlopen zonder de projecteinddatum te raken. Nul betekent kritiek.
- **Vrije speling** — hoeveel een taak mag uitlopen zonder zijn eerstvolgende opvolger te raken. Kan kleiner zijn dan de totale speling: een taak kan best wat totale speling hebben, maar als hij één dag uitloopt, schuift de eerstvolgende taak toch al mee (die opvolger heeft dan zelf nog voldoende eigen speling om de einddatum niet te raken).
- **Interfererende speling** — het verschil tussen beide (totale speling − vrije speling): het deel van je speling dat weliswaar de einddatum niet raakt, maar wél een opvolger "in de weg zit". Nul betekent dat vrije en totale speling gelijk zijn — uitlopen binnen je speling raakt dan niemand.

## Bijna-kritiek werk

Een taak met een kleine, maar niet-nul totale speling is kwetsbaar: een kleine tegenslag maakt hem alsnog kritiek. Zet dit aan via **Projectgegevens → Berekening → Bijna-kritiek markeren**, met een **Drempel** in werkdagen (of uren, afhankelijk van je duurweergave). Elke taak met totale speling groter dan nul én kleiner dan of gelijk aan die drempel krijgt een amber balkkleur in de Gantt — tussen het rood van kritiek en het groen van ruime speling in. In het thema **Hoog contrast** (Instellingen) krijgt near-critical werk bovendien een geblokt vulpatroon in plaats van een effen balk, zodat het onderscheid ook zonder kleurwaarneming zichtbaar blijft; in het lichte en donkere thema blijft de amber-kleur zelf het signaal.

De grote showcase zet de drempel op 3 werkdagen. De opleverkeuring van **Toren C** heeft daardoor precies 3 werkdagen totale speling — net binnen de drempel — terwijl de identieke opleverkeuringen van **Toren A** en **Toren B** op nul speling staan en dus echt kritiek zijn. Toren C is qua taken en duren identiek aan de andere twee, op één iets kortere afwerktaak na; dat kleine verschil is precies genoeg om hem van kritiek naar bijna-kritiek te verplaatsen.

## Meerdere kritieke paden

Normaal gesproken is er precies één langste keten, maar het kán voorkomen dat twee of meer ketens exact even lang zijn — dan zijn ze allebei (of alledrie) even kritiek. Zet **Meerdere speling-paden** aan (**Projectgegevens → Berekening**) om dit te laten uitrekenen: kies de **Methode** (**Vrije speling (peeling)** of **Totale speling (rangschikking)**) en een **Max. paden**. Elke taak krijgt dan een **Speling-pad**-nummer (1 = meest kritiek); een taak zonder float-pad zit op geen van de berekende paden.

In de grote showcase zijn Toren A en Toren B qua taken en duren volledig symmetrisch — ze zijn exact tegelijk klaar. Zodra je **Meerdere speling-paden** aanzet, ziet u dan ook meer dan één pad in de resultaten (`criticalPaths.length` groter dan 1 in de berekening): niet één enkele langste keten, maar meerdere gelijkwaardige ketens door het project heen. Dat is een ander signaal dan "één kritiek pad met wat bijna-kritiek werk ernaast" — het betekent dat vertraging in *elk* van die paden de einddatum evenveel raakt, dus je kunt je aandacht niet op één enkele keten concentreren.

## Harde pins en hun effect op speling

Een **harde pin** (het vinkje **Verplicht (pin logica)** bij een MSO- of MFO-constraint) zet een taak vast op een datum, ook als zijn voorgangers dat logisch tegenspreken. De grote showcase gebruikt dit op "Wegafzetting gemeente (vergunde stremmingsperiode)": de gemeente staat de stremming alleen op precies die vergunde datum toe, punt uit — de netwerklogica buigt daarvoor.

Het effect stroomopwaarts is het lastige deel om te doorzien: als de voorgangers van een gepinde taak méér tijd nodig hebben dan er tot de pin-datum beschikbaar is, ontstaat er **negatieve speling** op die voorgangers. Negatieve speling is dus geen rekenfout: het is de manier waarop de berekening je vertelt "deze voorgaande keten past niet meer binnen de tijd die de pin toestaat". Zie je negatieve speling stroomopwaarts van een harde pin, dan is de vraag niet "wat is hier stuk", maar "welke van deze twee dingen moet wijken: de pin-datum, of de duur van de keten ervoor".

Let op: in de grote showcase is de hele keten rond "Wegafzetting gemeente" — inclusief de gepinde taak zelf — allang volledig afgerond (werkelijke start én einde, ver vóór de statusdatum). Daardoor zie je daar over de hele fase-1-keten een kleine restnegatieve speling staan, óók op de pin-taak zelf: dat is een kenmerk van reeds-afgeronde taken in combinatie met een statusdatum, niet het hierboven beschreven "voorgangers passen niet"-scenario. Wil je dat scenario in zuivere vorm zien: verwijder tijdelijk de statusdatum (lintgroep **Baselines & voortgang**, knop **Statusdatum leegmaken**) en herbereken — dan staat de pin-taak zelf weer op totale speling nul, en ontstaat negatieve speling pas zodra je de voorgaande keten zelf bewust langer maakt dan de ruimte tot de pin-datum toelaat.

## Hammocks (Level of Effort)

Een **hammock** (vinkje **Hammock (afgeleide duur)** in het eigenschappenpaneel) is een taak zonder eigen duur-invoer: zijn start en einde volgen automatisch uit zijn eigen relaties. Inkomende **FS**/**SS**-relaties leveren de **start-driver** (de vroegste start), inkomende **FF**/**SF**-relaties leveren de **finish-driver** (de laatste finish) — het paneel toont beide read-only zodra je de hammock aanvinkt, zodat je precies ziet welke taken de span bepalen. Zonder finish-driver valt de span terug op nul-lengte, met een waarschuwing in het paneel.

Wat een hammock wél doet: hij toont, als een soort overkoepelende balk, de volledige spanne van een stuk werk zonder dat je zelf een duur hoeft bij te houden — handig voor bijvoorbeeld "toezicht" of "algemene bouwplaatskosten" die letterlijk zo lang lopen als het onderliggende werk. Wat een hammock niet doet: hij draagt geen eigen resources of eigen logica die de CPM-berekening beïnvloedt — hij is een afgeleide weergave, geen sturende taak. De grote showcase gebruikt dit voor "Ruwbouw toren A (LOE)": een hammock die start zodra de eerste echte ruwbouwtaak van toren A begint en eindigt zodra de laatste klaar is, zonder zelf ergens tussenin te zitten.

## Externe koppelingen tussen projecten

Grote projecten bestaan soms uit meerdere, apart beheerde deelplanningen — bijvoorbeeld je eigen hoofdplanning en een terreininrichting die een andere aannemer beheert. Een **externe koppeling** (venster **Externe (cross-project) koppeling**, te openen via de knop op het tabblad **Relaties**) legt een relatie naar een taak in zo'n ander bestand vast, zonder dat bestand als document te hoeven openen.

Je kiest een **Bronbestand** uit je recente bestanden (dat wordt alleen-lezen ingelezen, nooit als document geopend) of vult **Handmatig** een project-id, taak-id en ankerdatum in als je het bronbestand niet bij de hand hebt. Daarna kies je **Richting** (voorganger of opvolger), **Relatietype** (FS/SS/FF/SF) en een **Lag**. De **Ankerdatum** — de datum van de brontaak op het moment van koppelen — wordt bevroren in je eigen bestand; die datum verandert dus niet vanzelf mee als het bronproject wijzigt.

Wil je weten of het bronbestand intussen is bijgewerkt? Ga naar het tabblad **Relaties**, sectie **Externe koppelingen**, en klik **Ververs deze koppeling** (per koppeling) of **Ververs externe ankers** (alles in één keer) om het bronbestand opnieuw in te lezen en het anker bij te werken. Is het bronbestand niet beschikbaar — verplaatst, hernoemd, of nooit meegeleverd — dan toont de koppeling het label **verouderd** met de tooltip "bron niet geladen — her-importeer om te verversen": de app kan dan niet zelf verifiëren of het bevroren anker nog klopt.

De grote showcase demonstreert precies dat laatste pad met opzet: de taak "Bestrating parkeerterrein" is gekoppeld aan een bronbestand van een terrein-onderaannemer dat bewust *niet* wordt meegeleverd met het voorbeeld. Open de taak en je ziet de koppeling staan met de status "verouderd" — een eerlijke demonstratie van wat er gebeurt als een extern bronbestand niet meer beschikbaar is, in plaats van een koppeling die altijd feilloos ververst.

## Een pad traceren

Wil je precies zien welke taken een bepaalde taak stroomopwaarts en -afwaarts beïnvloeden? Rechtsklik de taak en kies **Pad traceren** (of **Traceren stoppen** om het weer uit te zetten) — dat markeert in één keer de volledige keten van voorgangers én opvolgers. Voor gerichter werk staat op het lint (tabblad **Planning** of **Relaties**, lintgroep **Pad traceren**) een los knoppenpaar **Voorgangers**/**Opvolgers**: allebei uit toont niets, één aan toont die ene richting, allebei aan is gelijk aan het contextmenu-commando. De trace maakt bovendien onderscheid tussen álle logisch verbonden taken en de taken die daadwerkelijk **bepalend** zijn voor de datum (dezelfde "Bepalend"-relatie die ook in de relatietabel staat) — zo zie je niet alleen wát er verbonden is, maar ook wát er werkelijk stuurt.

## Berekening-instellingen

De sectie **Berekening** in **Projectgegevens** (Backstage → Projectinfo, of het venster **Projectgegevens**) verzamelt de reken-opties die bij dít project horen — ze horen bij het bestand, niet bij de app, zodat een collega die hetzelfde bestand opent dezelfde uitkomst krijgt:

- **Kritiek-definitie** — **Totale speling ≤ drempel** (standaard drempel 0) of **Langste pad**, dat taken op basis van de langste keten door het netwerk als kritiek aanmerkt, onafhankelijk van hun speling-getal.
- **Speling-berekening** — hoe totale speling wordt bepaald bij een taak met zowel een start- als een finish-kant: **Kleinste (start/finish)** (standaard), **Startspeling** of **Finishspeling**.
- **Open-eind-taken kritiek** — taken zonder opvolger automatisch als kritiek behandelen.
- **Bijna-kritiek markeren** met **Drempel** (zie hierboven).
- **Meerdere speling-paden** met **Methode** en **Max. paden** (zie hierboven).
- **Lag-kalender** — welke kalender een lag in werkdagen gebruikt: die van de **Voorganger**, de **Opvolger**, altijd **24-uurs**, of de **Projectkalender**.

## Verder lezen

- Zie meerdere kritieke paden, bijna-kritiek werk, een hammock, een harde pin en een externe koppeling allemaal in één planning: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Relaties, lag/lead en constraints (inclusief de harde pin) staan uitgebreider uitgelegd in de gids [Relaties & constraints](docs://gids-relaties-constraints).
- Nivellering kan de kritieke-pad-structuur veranderen — lees de gids [Resources, histogram & nivellering](docs://gids-resources-histogram).
- Voortgang en een statusdatum kunnen negatieve speling opleveren op een al vaststaande taak — lees de gids [Baselines & voortgang](docs://gids-baselines-voortgang).
