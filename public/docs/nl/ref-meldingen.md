# Meldingen en waarschuwingen

De app zegt op drie plekken wat er aan de hand is: de statusbalk onderaan, het paneel *Waarschuwingen* in de rechterkolom en de meldingen die tijdelijk onderin het scherm verschijnen. Dit artikel geeft per plek wat je ziet, wanneer het verschijnt en wat je eraan kunt doen. Waarom een planning kritiek of overbezet is, staat in [Kritiek pad en speling](docs://uitleg-kritiek-pad); overbezetting oplossen in [Overbezetting oplossen](docs://howto-overbezetting-oplossen); relaties leggen in [Relaties leggen](docs://howto-relaties-leggen).

## Het verschil tussen de drie

- **Statusbalk** — een vaste regel met tellers. Ze komen uit de laatste berekening en blijven staan tot je opnieuw rekent.
- **Paneel Waarschuwingen** — de lijst achter die tellers, met alles wat de laatste berekening vond, en een klik brengt je bij de taak, relatie of resource. Het is afgeleid van de laatste berekening; er wordt niets bewaard.
- **Meldingen** — korte berichten over iets wat je zojuist deed (opslaan mislukt, relatie geweigerd, import gelezen). Ze verdwijnen weer en staan niet in het paneel.

## De statusbalk

De balk onderaan toont van links naar rechts:

- **Taken:** — het aantal bladtaken (samenvattingstaken tellen niet mee).
- **Mijlpalen:** — het aantal mijlpalen.
- **Kritiek pad: N taken, N werkdagen** — het aantal kritieke taken en de projectduur. Pas zichtbaar na een berekening.
- **Einde:** — het projecteinde uit de berekening. Pas zichtbaar na een berekening; een leeg project heeft er geen.
- **N deadline(s) overschreden**, **N constraint(s) geschonden**, **N out-of-sequence-relatie(s)** en **N resource(s) overbezet** — elk een knop met een waarschuwingsteken, alleen zichtbaar als de teller boven 0 staat en er een berekening is. Een klik opent het paneel *Waarschuwingen* (tooltip: *Waarschuwingenpaneel openen (details en navigatie)*). Sta je op het tabblad *IFC* of *Rapport*, dan springt de app daarbij naar *Start*, omdat de rechterkolom daar niet bestaat. De teller *resource(s) overbezet* ververst ook na wijzigingen aan resources en toewijzingen; de andere tellers veranderen pas na *Bereken*. De vier tellers zijn een selectie: wat het paneel meer toont (afgekapte lead, genegeerde relatie, hammock zonder eind-driver, afgekapte einddatum, planningsfout) staat niet in de statusbalk.
- **Verouderd — herbereken (F5)** — met een waarschuwingsteken (tooltip: *Planning verouderd — herbereken (F5)*). Zichtbaar zodra je iets wijzigde wat de planning raakt en je nog niet hebt herberekend. Staat *Automatisch berekenen* aan, dan blijft het weg, behalve als de berekening een fout gaf: dan blijft hij staan.
- **Selectie: N taak/taken** — het aantal geselecteerde taken; alleen zichtbaar bij een selectie.
- **Schaal:** en **Zoom: Npx/dag** — de tijdschaal van de tijdlijn en het zoomniveau. De schaal volgt uit de zoom.
- **Niet opgeslagen** — zolang het document wijzigingen heeft die niet in het bestand staan.
- **AI** — een gekleurde stip met het woord AI, alleen als de AI-modus aan staat. De tooltip zegt *AI-bridge:* met *Uit*, *Actief op poort N*, *Poort N bezet* of *Fout*. Een klik opent het tabblad *AI*.
- **Debugterminal** — een terminalknop, alleen als de debugterminal is ingeschakeld; hij toont of verbergt de terminal (*Debug-terminal tonen* / *Debug-terminal verbergen*).

## Het paneel Waarschuwingen

- **Openen** — *Planning › Planning › Waarschuwingen*, *Beeld › Panelen › Waarschuwingen*, of een teller in de statusbalk. Het paneel staat in de rechterkolom, onder *Eigenschappen* en de resourcedock, en klapt een ingeklapte kolom uit. Standaard is het dicht en het wordt niet onthouden tussen sessies. De hoogte, als het onder andere panelen staat, sleep je aan de rand en wordt wel onthouden. Het kruisje rechtsboven sluit het (*Waarschuwingen sluiten*).
- **Kopregel** — *N fout(en), N waarschuwing(en)*. Is er nog niet berekend, dan staat er *Nog niet berekend — druk op Bereken (F5) om de controles uit te voeren.*
- **Bereken** — een knop in de kopregel, zichtbaar zolang de planning verouderd of nog niet berekend is. Hij doet hetzelfde als *Bereken* in het lint.
- **Waarschuwingsteken in de kopregel** — als de planning verouderd is, met de tooltip *Planning verouderd — deze lijst komt van de laatste berekening. Herbereken (F5).* De lijst wordt niet verborgen, alleen benoemd als verouderd.
- **Lege lijst** — *Geen waarschuwingen. De planning voldoet aan alle controles.*
- **Een regel** — bovenaan de plek (taak, relatie, resource of project) en eronder de omschrijving. Een fout heeft een eigen achthoekig teken, een waarschuwing een driehoekig teken. Een taak staat als `WBS naam`. Een relatie staat als `voorganger → opvolger (FS+2d)`, met type en lag. Een klik gaat naar de plek (tooltip *Ga naar: …*), zie hieronder. De regel die hoort bij je actieve taak (bij een relatie: haar opvolger) of bij de resource die in het histogram is gekozen, is gemarkeerd.
- **Volgorde** — fouten eerst; daarna per soort in de volgorde van de lijst hieronder; binnen een soort in documentvolgorde (bij een relatie die van de opvolger, bij een resource die van de resourcelijst). Een taak, relatie of resource die na de laatste berekening is verwijderd, valt weg.

### Soorten waarschuwing

- **Planningsfout** — *Planning kon niet worden berekend: …* met de reden erachter, zie hieronder. Een klik: bij een kring selecteert de app alle taken in de kring en springt naar de eerste; bij andere fouten is er niets om naartoe te springen en is de regel geen knop.
- **Deadline gemist** — *Deadline {datum} overschreden — vroegste einde {datum}*. De taak heeft een deadline en de berekening haalt hem niet. Een klik springt naar de taak. Oplossen: de logica of duur aanpassen, of de deadline verzetten.
- **Constraint geschonden** — *Constraint {type en datum} wordt door de logica overschreden (negatieve speling)*. De constraint is niet te halen zonder de logica te schenden, de speling is negatief. Een klik springt naar de taak. Zie [Constraints](docs://uitleg-constraints).
- **Out-of-sequence** — *Out-of-sequence: de voortgang van de opvolger spreekt de relatie tegen*. De voortgang van de opvolger past niet bij het type relatie, bijvoorbeeld een opvolger die al bezig is terwijl de voorganger volgens een Eind-Start-relatie nog niet klaar is. Een klik selecteert beide taken, met de opvolger actief. Controleer de werkelijke datums of de relatie.
- **Lead afgekapt** — *Lead afgekapt door de projectstart — de relatie is niet volledig benut*. De lead (negatieve lag) van de relatie reikt voor de projectstart. Een klik selecteert beide taken.
- **Relatie genegeerd** — *Relatie genegeerd: voorganger of opvolger ontbreekt of is geen bladtaak*. De berekening neemt de relatie niet mee. Een klik selecteert de taken die nog bestaan. Zie [Relaties](docs://uitleg-relaties).
- **Hammock zonder eind-driver** — *Hammock zonder eind-driver (geen FF/SF-voorganger): de duur valt terug op nul*. Een klik springt naar de taak. Zie [Hammocktaken](docs://howto-hammock).
- **Einddatum afgekapt** — *Einddatum afgekapt: de kalender maakt het taakvenster onwerkbaar*. De berekening liep tegen de grens van het aantal te doorzoeken dagen aan, bijvoorbeeld door een heel lang aaneengesloten vrij blok in de kalender. Een klik springt naar de taak. Zie [Kalenders en werkdagen](docs://uitleg-kalenders).
- **Overbezetting** — *Overbezet op N dag(en) (eerste – laatste)*, met erbij *de resource werkt deze dag(en) niet volgens zijn kalender* als alle dagen vrije dagen zijn, of *waarvan N dag(en) waarop de resource niet werkt volgens zijn kalender* bij een mix. Een klik selecteert de taken met een toewijzing op die resource, zet het histogram aan en kiest daarin die resource; vanaf *Tabel*, *IFC* of *Rapport* springt de app naar *Resources*. Zie [Resourcepaneel](docs://ref-resourcepaneel).

### Redenen van een planningsfout

- *Kringverwijzing tussen taken: {pad}* — de relaties vormen een kring. De taken staan in het pad; draai of verwijder één relatie.
- *De kalender heeft geen werkdagen ingesteld* — geef de kalender minstens één werkdag, zie [Kalendervensters](docs://ref-kalenders).
- *Ongeldige duur in dagen voor taak '{taak}'* en *Ongeldige duur in uren voor taak '{taak}'* — de duur van de taak is geen geldig getal.
- *Urentaak '{taak}' heeft geen geldige werktijden in zijn kalender* — een taak in uren op een kalender zonder werkuren.
- *Ongeldige startdatum voor taak '{taak}'* — de startdatum van de taak is niet geldig.

## Meldingen

De meldingen verschijnen onderin het scherm, ook in de tabel, in Backstage en in de presentatiemodus. Een melding is een *fout* of *info*. Een fout blijft staan tot je hem wegklikt; een info verdwijnt na 5 seconden, en die timers beginnen opnieuw zodra de stapel verandert. Een klik op een melding sluit hem (tooltip *Melding sluiten*). Er staan er hooguit drie tegelijk: komt er een vierde, dan verdwijnt eerst de oudste info, en is er geen info, dan de oudste melding, zodat een fout nooit door een info wordt verdrongen. De stapel schuift weg van de knoppen van een open dialoog en van plakkende actiebalken.

- **Teller ×N** — een melding met een vaste sleutel vouwt een herhaling samen tot één regel met een teller, bijvoorbeeld een opslagfout die steeds terugkomt of een geweigerde relatie die je herhaalt. Niet elke melding doet dat.
- **Lees meer** — sommige meldingen hebben een link *Lees meer* of een eigen onderwerp (bijvoorbeeld *Werkregels uitgelegd*) naar de gids in Backstage › Help.
- **Actieknop** — de melding over het rekenprofiel heeft een knop *Rekenprofiel openen* naar Projectinfo.

De lijst hieronder is een keuze, gegroepeerd naar onderwerp. Waar het niet staat, is het een fout of info.

### Opslaan, openen en herstel

- **Opslaan mislukt** (fout) — *Opslaan mislukt* met de reden eronder. Bij opslaan, opslaan als en het exporteren van een rapport.
- **Opgeslagen als download** (info) — *Opgeslagen als download: '{naam}' staat nu in je downloadmap. …* Als de omgeving de app niet rechtstreeks naar de gekozen plek laat schrijven. Twee downloads vlak na elkaar vouwen samen.
- **Automatisch opslaan mislukt** (fout) — *Automatisch opslaan mislukt* met de reden. Geldt voor het automatisch opslaan naar het bestand en voor het crashherstel.
- **Bibliotheek kon niet worden opgeslagen** (fout) — *Bibliotheek kon niet worden opgeslagen*, bij het opslaan van de resourcebibliotheek.
- **Bestand openen mislukt** (fout) — *Bestand openen mislukt* met de reden. Bij een voorbeeld, een recent bestand of een importbestand.
- **Oud of beveiligd .mpp** (fout) — *Dit .mpp-bestand gebruikt een oud formaat (Project 2007 of ouder)…* of *Dit .mpp-bestand is met een wachtwoord beveiligd…*, allebei met het advies te exporteren als XML in MS Project en dat bestand te openen.
- **Ongeldig XER-bestand** (fout) — een van de *xer…*-teksten, bijvoorbeeld *Dit bestand is geen geldig of ondersteund XER-bestand.* of *Het XER-bestand bevat een dubbele tabel.*, met de reden erbij.
- **IFC kon niet worden gelezen** (fout) — *IFC kon niet worden gelezen* met de reden, in de IFC-weergave.
- **Herstel** (fout) — *Hersteld bestand kon niet worden gelezen*, *Herstellen mislukt* en *N herstelbestanden konden niet worden geladen en zijn overgeslagen.* Bij het herstellen na een onverwachte afsluiting.
- **Tak bewaard als sjabloon** (info) — *Tak bewaard als sjabloon '{naam}'*.
- **Melding van een extensie** (info, of fout als de extensie een fout meldt) — *Extensie {naam}: {bericht}*. Een extensie mag er hoogstens drie nieuwe per 10 seconden tonen, zodat ze de stapel niet vult. Faalt een stap van de begeleiding van een extensie, dan staat er *Een stap van de extensie {naam} gaf een fout. De begeleiding gaat door.*, en kan een projectbestand van een extensie niet worden geopend, dan *Het projectbestand {bestand} van de extensie {naam} kon niet worden geopend.* Beide zijn fouten.
- **Een wijziging kwam tussendoor** (info) — *Een wijziging van de AI-assistent of een extensie kwam tussendoor. …* Als je de taakdialoog annuleert terwijl de AI of een extensie intussen iets wijzigde: de taakwijzigingen van vóór die wijziging worden dan niet teruggedraaid en staan als gewone stappen onder *Ongedaan maken*.

### Berekenen

- **Planning kon niet worden berekend** (fout) — *Planning kon niet worden berekend* met de reden eronder (zie *Redenen van een planningsfout*). Bij *Bereken*, bij het wisselen van document en bij het openen van een bestand.
- **Statusdatum op vandaag gezet** (info) — *Er stond nog geen statusdatum: die staat nu op vandaag ({datum}), want voortgang wordt tot de statusdatum gemeten. Aanpassen kan via Planning → Statusdatum.* Bij het invoeren van voortgang in een project zonder statusdatum.
- **Duur korter dan het gedane werk** (info) — *‘{naam}’ is al voor {N}% gedaan: een duur korter dan het gedane werk kan niet. De duur is niet gewijzigd.*

### Relaties en hiërarchie

- **Relatie aangemaakt** (info) — *Relatie aangemaakt: {voorganger} → {opvolger}*.
- **Relatie geweigerd** (info) — *Deze relatie bestaat al*, *Een relatie tussen een taak en zijn eigen (voor)ouder-samenvattingstaak is niet toegestaan.* of *Deze relatie zou een kring in de planning maken ({kring}) en is niet aangemaakt.* De kring noemt de taken, zodat je weet welke relatie je eerst moet weghalen of omdraaien.
- **Verplaatsing geweigerd** (info) — *Deze verplaatsing zou een kring in de planning maken ({kring}): de relaties van een samenvattingstaak gelden ook voor haar subtaken. Er is niets verplaatst.*
- **Relaties vallen weg na verplaatsen** (info) — *Na het verplaatsen verbinden N relaties een taak met zijn eigen samenvattingstaak; die tellen niet meer mee in de berekening.*
- **Relaties overgeslagen bij invoegen** (info) — *N relaties zijn niet aangemaakt: ongeldige koppeling…*, bij het plakken of invoegen van een tak.
- **Relaties niet meegerekend na import** (info) — *N relatie(s) konden niet worden meegerekend. Controleer de voorganger- en opvolgerkolommen.*
- **Dubbele id's na import** (info) — *Objecten met een dubbel id in dit bestand: N. Ze hebben een eigen id gekregen…*

### Taken bewerken

- **Start vastgelegd als constraint** (info) — *'{naam}' heeft een voorganger: de nieuwe start is vastgelegd als constraint Start niet eerder dan (SNET) {datum}. Na herberekenen (F5) begint de taak niet vóór die datum.* Als je de start van een taak met voorganger verandert. Had de taak al zo'n constraint, dan zegt de melding dat hij is verzet; bij meer taken tegelijk staat er een aantal.
- **Start niet toegepast** (info) — *De nieuwe start van '{naam}' is niet toegepast: de taak heeft een voorganger en de constraint {type} {datum}, en die bepalen de start. Pas die constraint aan om de start te verplaatsen.*
- **Mijlpaal geweigerd** (info) — *'{taak}' heeft resource-toewijzingen en kan geen mijlpaal worden. Verwijder eerst de toewijzingen.* of *'{taak}' is een samenvattingstaak met subtaken en kan geen mijlpaal worden.* Bij het omzetten in de taakdialoog, het eigenschappenpaneel, het contextmenu en de tabel.
- **Toewijzingen verplaatst naar subtaak** (info) — *De toewijzing van {resources} is verplaatst van '{fase}' naar de nieuwe subtaak '{kind}': een samenvattingstaak draagt zelf geen toewijzingen.* Als een taak met toewijzingen subtaken krijgt.
- **Mijlpaalmarkering verwijderd** (info) — *Mijlpaal '{fase}' heeft nu subtaken en is een samenvattingstaak geworden; de mijlpaalmarkering is eraf gehaald.*
- **Samenvattingstaak geweigerd** (info) — *'{fase}' kan geen samenvattingstaak worden: …* met de reden, en *Er is niets gewijzigd.*
- **Cellen overgeslagen bij plakken** (info) — *N cellen overgeslagen: ze zijn read-only (bijvoorbeeld een automatisch genummerde WBS-code of een berekende kolom).*
- **Verwijzingen leeggemaakt bij plakken** (info) — *N verwijzingen bestonden niet in dit document en zijn leeggemaakt (taakkalenders, eigen taaktypes, activity codes of gebruikersvelden uit het brondocument).*
- **Werkregel paste duren aan** (info) — *De werkregel heeft na de kalenderwijziging de duur van N taken aangepast (werk blijft, uren per dag veranderden).* Met een link *Werkregels uitgelegd*.

### Primavera (XER)

- **XER-bestand geopend** (info) — *XER-bestand geopend: N projectdocumenten.* Eén melding per bestand, ook als het bestand meer projecten opent, met een link *Lees meer* en detailregels eronder. Altijd *N projecten gezien.* Alleen als het aantal boven 0 is: *N lege projecten overgeslagen.*, *N baselineprojecten uitgesloten.*, *N baselines gematerialiseerd.*, *N losse baselineverwijzingen genegeerd.*, *Beschermende baseline-terugval gebruikt.* en *N externe koppelingen bewaard.* Alleen bij een andere codering dan UTF-8: *Tekstcodering vastgesteld als {codering}.* Verder, als het aantal boven 0 is: *N parserbevindingen.*, *N kalenderbevindingen.*, *N getalnotatieproblemen.*, *N enum-terugvallen.* en *N P6-planningsinstellingen met veilige terugval.*
- **Datums zoals Primavera ze opsloeg** (detailregel in dezelfde melding) — *N taken tonen de datums zoals Primavera ze opsloeg (niet herberekend).*, of, als de modus niet aanging, *N taken wijken af van de datums in het bestand — je kunt ze tonen.*
- **XER-bronarchief onbruikbaar** (info) — *Het XER-bronarchief in dit bestand is onbruikbaar en weggelaten; het project zelf is volledig geopend.* met de reden (bijvoorbeeld *Reden: de controlesom past niet bij de bronbytes — het archief is beschadigd.*) en het gevolg (*De planning, het rekenprofiel en alle projectdata uit het IFC zijn compleet. …*). Bij het openen van een IFC-bestand waarin een eerder bewaard XER-bronarchief niet te gebruiken is. Ook bij het herstellen na een onverwachte afsluiting, als de herstelopslag het bronarchief niet meer heeft.
- **Export verliest XER-informatie** (info) — *Bij export naar {formaat} gaat XER-broninformatie verloren.* Na een geslaagde export naar een ander formaat dan IFC van een project met gegevens die alleen in een XER-bestand bestaan. Met een link *Lees meer*.

### Importeren, exporteren en rekenprofiel

- **Datums zoals in het bestand** (info) — *N taken tonen de datums zoals ze in het bestand staan (niet herberekend).* of *N taken wijken af van de datums in het bestand — je kunt ze tonen.* Bij het openen van een bestand met vastgelegde datums.
- **Werk en werkregels zichtbaar** (info) — *Dit bestand bevat opgeslagen werk of eigen werkregels; de werkregel en het resterende werk zijn voor dit project zichtbaar.*
- **MS Project-planning ingelezen** (info) — *Dit MS Project-bestand bevat N taken met een onderbroken, genivelleerde of resource-gedreven planning. Die worden als zodanig ingelezen en getoond.*
- **Onderbrekingen niet geëxporteerd** (info) — *N taken met onderbrekingen zijn zonder onderbrekingen geëxporteerd: MS Project/P6 kennen die alleen als urenverdeling.* Bij export naar MS Project of Primavera.
- **Projectstart verzet** (info) — *Projectstart verzet: N taakankers zonder voorganger of constraint zijn meegeschoven naar de nieuwe startdatum.*
- **Datumvenster stuurt niet meer** (info) — *Het datumvenster uit MS Project stuurt N taken niet meer na deze bewerking; …* Eén keer per document.
- **Nivelleervertraging afgerond** (info) — *Nivelleren rondt de minuutprecieze nivelleervertraging van MS Project van N taken af op hele werkdagen.* Eén keer per document.
- **Rekenprofiel toegepast** (info) — *Dit project rekent als {profiel}. Aanpassen via Bestand → Projectinfo → Rekenprofiel en reken-opties.* Met de knop *Rekenprofiel openen*. Na het toepassen van een profiel volgt zo nodig *Na het toepassen zijn N taken verschoven.*
