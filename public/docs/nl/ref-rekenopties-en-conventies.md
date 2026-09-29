# Rekenopties en conventies

Alle keuzes die bepalen hoe de app een planning doorrekent, zoals je ze in het blok *Rekenprofiel en reken-opties* vindt: het profiel, de 27 conventies per profiel en de reken-opties van het project. Waarom P6 en MS Project anders rekenen en wat dat voor je datums betekent, staat in [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen).

## Waar vind je ze en hoe werken ze

Kies *Instellingen › Project › Projectinfo* of *Bestand › Projectinfo*. Onderaan staat het blok *Rekenprofiel en reken-opties*. In het venster *Nieuw project* staat alleen de keuzelijst *Rekenprofiel*: een keuze past meteen de standaardopties van dat profiel toe.

**Per project, niet per app.** Het profiel en de opties horen bij het projectbestand en gaan mee met *Opslaan* (IFC). Twee mensen die hetzelfde bestand openen, rekenen dus hetzelfde. CSV, MS Project XML en P6 XML nemen ze niet mee: dat staat in [Import- en exportformaten](docs://ref-import-exportformaten). Eigen sjablonen zijn wel app-breed: die bewaart de app op dit apparaat.

**Pas bij Toepassen.** Wat je in dit blok wijzigt, is een concept tot je op *Toepassen* klikt. Daarna rekent de app de planning door, ook als *Automatisch berekenen* uit staat, en meldt hoeveel taken verschoven zijn (*Na het toepassen zijn 3 taken verschoven.*). Het is één stap voor *Ongedaan maken*. Toepassen verlaat ook de weergave *Datums zoals opgeslagen*. Een wijziging die niets verandert, doet niets. In *Bestand › Projectinfo* gooi je het concept weg met *Verwerpen*.

## Rekenprofiel

**Rekenprofiel** — de basis waarmee de app rekent. Keuze uit *Primavera P6*, *Microsoft Project* en *Open Planner Studio*, plus je eigen sjablonen en het eigen profiel van dit project. Standaard: *Open Planner Studio* voor een nieuw project en voor een project zonder profiel. Effect: het profiel zet elk van de 27 conventies hieronder aan of uit. Een bestand dat je opent krijgt het profiel van zijn formaat: een `.xer` rekent als *Primavera P6*, een `.mpp` als *Microsoft Project*, en CSV, MS Project XML en P6 XML als *Open Planner Studio*. Een IFC-bestand houdt het profiel dat erin staat. Een profiel dat afwijkt van zijn basis heet *Primavera P6 (aangepast)*, met de naam van de basis. Waar: het blok *Rekenprofiel en reken-opties*, keuzelijst *Rekenprofiel*.

**Een conventie aan- of uitvinken** — wijzigt het profiel. Effect: op een ingebouwd profiel maakt de app zelf een eigen profiel met de naam *Kopie van Primavera P6* (of het profiel waar je van uitging), met alle huidige waarden. Dat profiel noemt het veld *Naam van dit eigen profiel*; zonder naam weigert *Toepassen* het. Waar: het blok *Conventies van dit profiel*.

**Opslaan als sjabloon**, **Sjabloon bijwerken vanuit dit project**, **Bijwerken vanuit sjabloon** en **Sjabloon verwijderen** — beheren je eigen profielen als sjabloon. Effect: een sjabloon is een bewaard profiel dat je in elk project kunt kiezen; het project houdt een eigen kopie. Wijkt het profiel van het project af van zijn sjabloon, dan staat er *Dit profiel wijkt af van het sjabloon “…”.* Sjablonen staan niet in het projectbestand. Waar: onder de keuzelijst, bij een eigen profiel.

## Conventies per profiel

Een conventie is een regel waarin planningspakketten verschillen. Elke conventie is aan of uit. Het blok toont per conventie een vinkje, de basiswaarde (*basis: aan* of *basis: uit*) en, als je afwijkt, de knop *terug naar basis* en een badge *afwijkend: 2* bij de groep. Met het pijltje voor een regel klap je de uitleg open. Standaard geldt per conventie wat het gekozen ingebouwde profiel zegt. *Open Planner Studio* heeft alle conventies uit. Bij elke conventie hieronder staat wat *Primavera P6* en *Microsoft Project* doen.


### Voortgang en voltooid werk

**Werkelijke datums behouden in de terugwaartse berekening** — Een gestarte of voltooide taak houdt haar geregistreerde datums ook aan de late kant; een voltooide opvolger trekt een open voorganger niet terug in het verleden. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.

**Lopende taak: vroege start = begin van het restwerk** — De vroege en late start van een lopende taak beschrijven waar het resterende werk begint, niet de historische werkelijke start. Terugrekenend over een start-start-relatie telt alleen de restduur. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.

**Voltooide fysieke-voortgangstaak staat op de statusdatum** — Een voltooide taak met fysiek voortgangspercentage staat als één punt op de statusdatum, of later als een voorganger dat eist, in plaats van op haar werkelijke datums. Alleen gemeten voor fysieke voortgang; voor andere voortgangstypen (P6-standaard: duur) is dit gedrag niet gemeten en blijft het uit. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.

**Geplande start is geen vloer voor een lopende taak** — Het resterende werk van een gestarte taak begint op de statusdatum en direct na haar voorgangers, ook als haar geplande start later ligt. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.

**Progress Override negeert een gestarte opvolger ook achterwaarts** — Onder Progress Override telt de relatie naar een opvolger die al gestart is niet mee in de late datums en de vrije speling van een voorganger die nog niet klaar is. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.


### Relaties en lag

**Opvolger start op de finishgrens** — Bij een eind-start-relatie zonder lag op een gedeelde bandgrens begint de opvolger op de finish van de voorganger (alleen relaties die het bestand zo markeert). Terugrekenend toont de opvolger haar late start gewoon als begin van een werkband. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.

**Lag terugrekenen vanaf een finishgrens** — Trekt de terugwaartse berekening een werktijd-lag af vanaf een finishgrens en komt ze precies op een bandstart uit, dan landt ze op de vorige finishgrens. Ook bij een eind-eind-relatie zonder lag blijft een late finish op een bandeinde die finishgrens. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.

**Verstreken lag van een voltooide voorganger telt niet** — Aan de late kant telt van de lag na een voltooide voorganger alleen het deel dat op de statusdatum nog niet verstreken is. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.

**Verstreken SS-lag uit een lopende voorganger telt niet** — Bij een start-start-relatie uit een al gestarte taak telt van de lag alleen het deel dat sinds haar werkelijke start op de statusdatum nog niet verstreken is. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.

**Vroege finish niet vóór een eind-eind-grens** — Bij een eind-eind-relatie ligt de vroege finish van de opvolger in kloktijd nooit vóór de grens die de voorganger stelt. Valt die grens in vrije tijd van de opvolger, dan wordt de finish het begin van de volgende werkperiode. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.


### Mijlpalen en LOE-activiteiten

**Mijlpaal volgt de geplande kalendergrens** — Een mijlpaal zonder duur blijft op de kalendergrens die het bestand plande: een dagstart blijft een startmijlpaal, een bandeinde mag op de finish van de voorganger landen. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.

**Niet-gestarte LOE neemt het doelvenster** — Een level-of-effort-activiteit die nog niet begonnen is, neemt haar doelvenster als looptijd (alleen taken met P6-herkomst). Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.

**Eind-eind-relatie naar een startmijlpaal bindt aan de mijlpaal zelf** — Een eind-eind-relatie naar een startmijlpaal telt tot de mijlpaal zelf, niet tot het begin van de mijlpaaldag: de late finish van de voorganger mag tot de late finish van de mijlpaal lopen. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.


### Speling en late datums

**Vrije speling nooit negatief** — Bij een onhaalbare late constraint blijft de totale speling negatief, maar de vrije speling wordt nul. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.

**Vrije speling in de eigen kalender** — De vrije speling van een niet-gestarte taak telt per relatie in de kalender van de taak zelf, niet in die van de opvolger: bij eind-start, start-start en eind-eind, ook met een lag in werktijd op de kalender van de voorganger. Een gestarte taak alleen bij eind-start zonder lag. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.

**Late finish op de eigen kalender** — Valt de late finish die een opvolger oplegt buiten de werktijd van de taak, dan wordt hij het einde van de vorige werkperiode op de eigen kalender. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.

**ALAP-taken zo laat als de opvolgers toestaan** — Een niet-gestarte taak met de beperking 'zo laat mogelijk' eindigt op de minuut waarop haar opvolgers haar nodig hebben, opvolgers eerst, zodat een keten aaneensluit. Haar eigen geplande start telt niet; een taak zonder voorganger begint dan niet vóór de statusdatum. Geldt alleen op een urenkalender. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.


### Datums en tijdstippen uit het bestand

**Geplande start als extra ondergrens** — De geplande start uit het bestand telt als ondergrens zodra start én einde meer dan een kalenderdag later liggen dan het netwerk toelaat. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.

**Werkelijke datums exact overnemen** — Geregistreerde werkelijke start- en einddatums worden niet naar een werktijdband verschoven. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.

**Constraintmoment op een mijlpaal exact** — Een datum-en-tijdconstraint op een mijlpaal zonder duur is een exact punt, ook aan het begin van een werkband. Standaard: aan onder Primavera P6, uit onder Microsoft Project en Open Planner Studio.


### Voortgang zoals Microsoft Project

**Restwerk hervat na de al verstreken duur** — Een lopende taak hervat haar restwerk op de werkelijke start plus de al verstreken duur, niet op de statusdatum. Standaard: aan onder Microsoft Project, uit onder Primavera P6 en Open Planner Studio.

**Niet-gestarte taken niet naar de statusdatum** — Een taak die nog niet begonnen is, schuift niet vanzelf naar op of na de statusdatum. Standaard: aan onder Microsoft Project, uit onder Primavera P6 en Open Planner Studio.


### Alleen voor eigen profielen

Deze conventies staan in elk ingebouwd profiel uit, ook onder Primavera P6. Zet je er een aan, dan wordt het een eigen profiel.

**Eindmijlpaal als grensvenster** — Een eindmijlpaal mag op twee aangrenzende kalendergrenzen staan: vroege start aan het begin van een band, vroeg einde aan het einde van de vorige band. Standaard: uit in elk ingebouwd profiel.

**Voltooide taak in het statusdatumvenster** — Een voltooide taak krijgt vroege datums in het venster van de statusdatum, en haar einde telt mee voor het projecteinde (alleen taken met P6-herkomst). Standaard: uit in elk ingebouwd profiel.

**Voltooide LOE via het werkelijke einde** — Een voltooide level-of-effort-activiteit met alleen een start-start-ingang volgt de route via haar werkelijke einde (alleen taken met P6-herkomst). Standaard: uit in elk ingebouwd profiel.

**Voltooide voorganger houdt niet vast na de statusdatum** — Eindigt een voltooide voorganger volgens zijn werkelijke datum ná de statusdatum, dan mogen zijn opvolgers toch al op de statusdatum beginnen. Standaard: uit in elk ingebouwd profiel.

**Voltooide taak buiten volgorde wacht op haar voorgangers** — Een voltooide taak waarvan een voorganger nog niet klaar is, krijgt haar nulvenster ná die voorganger in plaats van op de statusdatum (P6: Retained Logic). Standaard: uit in elk ingebouwd profiel.


## Reken-opties van dit project

Deze opties staan onder *Reken-opties van dit project*, onder de conventies. De knop *Standaardopties van dit profiel toepassen* zet ze allemaal terug op de standaard van het gekozen profiel. Standaard per profiel: *Open Planner Studio* heeft geen eigen waarden, dus elke optie staat op haar standaard hieronder; *Microsoft Project* zet alleen *Speling-berekening* op *Kleinste (start/finish)*; *Primavera P6* zet *Lag-kalender* op *Voorganger*, *Kritiek-definitie* op *Totale speling ≤ drempel* met een drempel van 0 uur, *Speling-berekening* op *Finishspeling*, *Open-eind-taken kritiek* uit en *SS-lag van een lopende voorganger rekenen vanaf* op *Vroege start (restwerkstart)*. Een `.xer`-bestand brengt daarnaast waarden uit het bestand zelf mee.

**Kritiek-definitie** — wat een taak kritiek maakt. Keuze uit *Totale speling ≤ drempel* en *Langste pad*. Standaard: *Totale speling ≤ drempel* met drempel 0. Effect: bij *Totale speling ≤ drempel* is een taak kritiek als haar totale speling kleiner is dan of gelijk aan de drempel. Bij *Langste pad* is een taak kritiek als ze op de keten ligt die naar het laatste einde leidt; bij meerdere eindtaken met hetzelfde einde tellen al hun ketens. De speling speelt dan geen rol. In beide gevallen is een voltooide taak nooit kritiek en een hammock ook niet. Het geldt voor de Gantt, de tabel, het mijlpalen-overzicht en de rapporten. Waar: *Reken-opties van dit project*.

**Drempel (werkdagen)** — de grens bij *Totale speling ≤ drempel*. Standaard: 0. Effect: de drempel mag negatief zijn. Een drempel uit een P6-bestand staat in uren en heet dan *Drempel (uren, per taakkalender)*: de app vergelijkt die per taak in de uren van de kalender van die taak. Waar: *Reken-opties van dit project*, naast *Kritiek-definitie*.

**Speling-berekening** — welke speling de totale speling is. Keuze uit *Automatisch (standaard)*, *Kleinste (start/finish)*, *Startspeling* en *Finishspeling*. Standaard: *Automatisch (standaard)*; *Microsoft Project* zet *Kleinste (start/finish)* en *Primavera P6* *Finishspeling*. Effect: *Startspeling* is late start min vroege start, *Finishspeling* is late einde min vroeg einde, *Kleinste (start/finish)* is de kleinste van die twee. *Automatisch (standaard)* gebruikt voor een lopende taak (met werkelijke start of voortgang, en een statusdatum) de finishspeling, en voor alle andere taken de kleinste. Waar: *Reken-opties van dit project*.

**Open-eind-taken kritiek** — een taak zonder opvolger. Standaard: uit. Effect: aan geeft zo'n taak totale en vrije speling 0, zodat ze bij de kritiek-definitie *Totale speling ≤ drempel* kritiek wordt (behalve als ze voltooid is). Uit rekent de speling zoals gewoonlijk tot het einde van het project. Waar: *Reken-opties van dit project*.

**Bijna-kritiek markeren** — markeert taken met bijna geen speling. Standaard: uit. Effect: aan geeft een drempel, standaard 2 werkdagen (het veld *Drempel*). Een taak met meer dan 0 en hoogstens die drempel aan totale speling heet *Bijna kritiek*; een taak met precies 0 speling is kritiek en telt niet mee. Je ziet dat in de tabelkolom *Bijna kritiek* en in de rapporten. Het veld toont werkdagen; met urenplanning aan en de duurweergave in uren toont het uren. Waar: *Reken-opties van dit project*.

**Meerdere speling-paden** — nummert ketens van taken naar hun speling. Standaard: uit. Effect: aan geeft taken een nummer in de tabelkolom *Spelingpad*. Uit laat de kolom leeg. Waar: *Reken-opties van dit project*.

**Methode** — hoe de paden ontstaan, bij *Meerdere speling-paden*. Keuze uit *Vrije speling (peeling)* en *Totale speling (rangschikking)*. Standaard: *Vrije speling (peeling)*. Effect: bij *Vrije speling (peeling)* pelt de app ketens af. Ze kiest de taak met het laatste einde en neemt haar bepalende voorgangers erbij: dat is pad 1. Van de overgebleven taken doet ze dat opnieuw voor pad 2, enzovoort; een gedeelde voorganger houdt het nummer van het eerste pad waarin hij voorkomt. Bij *Totale speling (rangschikking)* is het nummer de rang van de totale speling van de taak: 1 voor de kleinste, 2 voor de volgende kleinste waarde. Hammocks doen niet mee. Waar: *Reken-opties van dit project*.

**Max. paden** — hoeveel paden genummerd worden. Standaard: 10. Effect: taken buiten de eerste *Max. paden* paden of rangen krijgen geen nummer. Waar: *Reken-opties van dit project*, bij *Meerdere speling-paden*.

**Lag-kalender** — in welke kalender een lag in werktijd telt. Keuze uit *Voorganger*, *Opvolger*, *24-uurs* en *Projectkalender*. Standaard: *Voorganger*. Effect: een lag van 2 dagen telt in de werkdagen van de kalender die je kiest. Waar: *Reken-opties van dit project*. Zie [Relaties en lag](docs://uitleg-relaties).

**SS-lag van een lopende voorganger rekenen vanaf** — de variant van de conventie *Verstreken SS-lag uit een lopende voorganger telt niet*. Keuze uit *Vroege start (restwerkstart)* en *Werkelijke start (statusdatum)*. Standaard: *Vroege start (restwerkstart)*. Effect: bij een start-startrelatie met een positieve lag in werktijd uit een lopende voorganger begint de opvolger bij *Vroege start (restwerkstart)* op de start van het restwerk van de voorganger plus de resterende lag. Bij *Werkelijke start (statusdatum)* begint hij op de statusdatum plus de resterende lag, en begrenst de relatie de lopende voorganger niet naar achteren. De resterende lag is de lag min de werktijd tussen de werkelijke start en de statusdatum, nooit minder dan 0. Een lag van 0 of minder, een lag in klokuren en een planning in dagen houden het gewone gedrag. De keuze werkt alleen als de conventies *Verstreken SS-lag uit een lopende voorganger telt niet* en *Lopende taak: vroege start = begin van het restwerk* allebei aan staan; anders is de keuzelijst uitgeschakeld en staat er *Werkt alleen als de conventie „…” aanstaat.* Waar: *Reken-opties van dit project*.

### Instellingen uit het bronbestand

Deze drie opties komen uit een Primavera P6-bestand (`.xer`) en zijn alleen te lezen. Het blok *Instellingen uit het bronbestand* verschijnt alleen als het project ze draagt. Ze rekenen mee. *Standaardopties van dit profiel toepassen* laat ze staan of zet ze, onder *Primavera P6*, terug op aan (de eerste en de laatste).

**Verwachte einddatums gebruiken (P6: Use Expected Finish Dates)** — Standaard onder P6: aan. Effect: een lopende P6-taak met een verwachte einddatum krijgt die datum als vroeg einde. Waar: *Instellingen uit het bronbestand*.

**Speling rekenen tot de einddatum van het project** — Standaard: uit. Effect: de einddatum van het project is het anker voor de late datums. Zonder einddatum in het bestand rekent de app tot het einde van het netwerk. Waar: *Instellingen uit het bronbestand*.

**Voltooide taak: late datums vanaf de statusdatum** — Standaard onder P6: aan. Effect: een voltooide taak krijgt ook aan de late kant nul restduur op de statusdatum, met een zinvolle speling. Het werkt alleen samen met de conventie *Voltooide taak in het statusdatumvenster*, die in elk ingebouwd profiel uit staat; is die uit, dan staat er *Werkt alleen samen met de conventie „…”, die nu uit staat.* Waar: *Instellingen uit het bronbestand*.

## Zie ook

- [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen): waarom een geïmporteerde planning andere datums kan tonen dan je pakket.
- [Kritiek pad en speling](docs://uitleg-kritiek-pad): wat kritiek, totale en vrije speling betekenen.
- [Relaties en lag](docs://uitleg-relaties): lag en de kalender waarin hij telt.
- [Voortgang, statusdatum en baseline](docs://uitleg-voortgang): de statusdatum waar veel conventies naar verwijzen.
- [Import- en exportformaten](docs://ref-import-exportformaten): welk profiel een bestand bij het openen krijgt.
