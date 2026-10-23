# Meldingen en waarschuwingen

De app zegt op vier plekken wat er aan de hand is: de statusbalk onderaan, het paneel *Waarschuwingen* in de rechterkolom, de meldingen die tijdelijk onderin het scherm verschijnen en de stroken onder het lint. Dit artikel geeft per plek wat je ziet, wanneer het verschijnt en wat je eraan kunt doen. Waarom een planning kritiek of overbezet is, staat in [Kritiek pad en speling](docs://uitleg-kritiek-pad); overbezetting oplossen in [Overbezetting oplossen](docs://howto-overbezetting-oplossen); relaties leggen in [Relaties leggen](docs://howto-relaties-leggen).

## Het verschil tussen de vier

- **Statusbalk** — een vaste regel met tellers. Ze komen uit de laatste berekening en blijven staan tot je opnieuw rekent.
- **Paneel Waarschuwingen** — de lijst achter die tellers, met alles wat de laatste berekening vond, en een klik brengt je bij de taak, relatie of resource. Het is afgeleid van de laatste berekening; er wordt niets bewaard.
- **Meldingen** — korte berichten over iets wat je zojuist deed (opslaan mislukt, relatie geweigerd, import gelezen). Een info verdwijnt weer, een fout blijft staan tot je hem sluit. Ze staan niet in het paneel.
- **Strook onder het lint** — een gekleurde strook met uitleg en één knop. Hij hoort bij een stand van het document of van een modus en blijft staan zolang die stand geldt. Zie *De stroken onder het lint*.

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
- **MCP** — een gekleurde stip met het woord MCP, alleen als de MCP-koppeling aan staat. De tooltip zegt *MCP-bridge:* met *Uit*, *Actief op poort N*, *Poort N bezet* of *Fout*. Een klik opent het tabblad *MCP*.
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

## De stroken onder het lint

Een strook staat direct onder het lint, boven de werkruimte. Hij heeft een tekst en één knop. Een strook van een modus heeft geen kruisje; de andere sluit je met het kruisje. De vijf stroken:

- **Relatiemodus** — *Relatiemodus: sleep in de Gantt van de ene balk naar de andere om een relatie te leggen. Esc stopt.* Staat zolang de relatiemodus aan staat. Knop: *Stoppen*. Zie [Relaties leggen](docs://howto-relaties-leggen).
- **Splits-modus** — *Klik op een balk op de dag waar de onderbreking begint en sleep naar rechts voor de lengte. Esc stopt.* Staat zolang *Taak splitsen* aan staat. Knop: *Stoppen*.
- **Urenplanning in het bestand** — *Dit bestand bevat urenplanning.* Verschijnt als een geopend bestand urenplanning bevat terwijl *Urenplanning inschakelen* uit staat. Knop: *Urenplanning aanzetten*. Zie [Urenplanning aanzetten](docs://howto-urenplanning-aanzetten).
- **Structuur vergrendeld** — *Niet beschikbaar tijdens filteren/groeperen/sorteren*. Verschijnt als inspringen of uitspringen wordt geweigerd omdat de takenlijst is gefilterd, gegroepeerd of gesorteerd. Knop: *Wissen*, die filter, groepering en sortering opheft.
- **Datums zoals opgeslagen** — na het openen van een bestand waarvan herberekenen datums verschoof: *Herberekening verschoof N van de M taken ten opzichte van de datums in het bestand.* met de knop *Opgeslagen datums tonen*. Zolang de weergave aan staat: *Je ziet de datums zoals ze in het bestand staan …* met de knop *Herberekenen*. Zie [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen).

## Meldingen

De meldingen verschijnen onderin het scherm, ook in de tabel, in Backstage en in de presentatiemodus. Een melding is een *fout* of *info*. Een fout is rood en blijft staan tot je op het kruisje klikt; een info verdwijnt na 5 seconden (een melding met veel uitleg blijft langer), en die timers beginnen opnieuw zodra de stapel verandert. Elke melding heeft rechtsboven een kruisje (tooltip *Melding sluiten*) waarmee je hem meteen sluit. Een klik op de tekst van de melding doet niets. Een weigering is altijd een fout: een melding dat de app iets wat je deed niet heeft uitgevoerd, zoals een geweigerde relatie, duur, start of mijlpaal. Zo mis je hem niet als je even wegkijkt. Een weigering verdwijnt wel na Ctrl+Z of Ctrl+Y en als je naar een ander document gaat, want dan klopt hij niet meer. Een andere fout, zoals *Opslaan mislukt*, blijft dan staan. Dat geldt ook als de rest van dezelfde handeling wel lukte, bijvoorbeeld bij plakken in meer cellen. Gaat het om meer taken, dan staat eronder welke taken niet zijn aangepast, bijvoorbeeld *Niet aangepast: Fundering, Metselwerk.* Bij meer dan vijf staat er *en nog N taken* achter. Dezelfde weigering vouwt bij herhaling samen tot één regel met een teller. Er staan er hooguit drie tegelijk. Komt er een vierde, dan verdwijnt eerst de oudste info. Is er geen info, dan de oudste weigering, daarna de oudste blijvende openingsmelding, en pas dan de oudste fout. Zo duwt een info of een weigering een andere fout, zoals *Opslaan mislukt*, nooit weg. De stapel schuift weg van de knoppen van een open dialoog en van plakkende actiebalken. Een melding bij het openen van een bestand blijft ook staan tot je op het kruisje klikt, als de app bij het openen data heeft ingevuld, vervangen, gerepareerd of weggelaten: een regel over parser- of kalenderbevindingen, getalnotatieproblemen, enum-terugvallen, P6-planningsinstellingen met veilige terugval, een beschermende baseline-terugval, genegeerde baselineverwijzingen, activiteiten zonder geplande start die een start kregen, relaties tussen projecten of activiteiten zonder project die niet zijn overgenomen (P6 XML), iets uit een MS Project-bestand dat niet is overgenomen (MS Project XML en `.mpp`) of een onbruikbaar XER-bronarchief, en de meldingen over dubbele id's en relaties die niet meerekenen. Staat er alleen informatie zonder zo'n wijziging in (zoals het aantal projecten, documenten of de tekstcodering), dan verdwijnt de melding na 5 seconden.

- **Teller ×N** — een melding met een vaste sleutel vouwt een herhaling samen tot één regel met een teller, bijvoorbeeld een opslagfout die steeds terugkomt of een geweigerde relatie die je herhaalt. Niet elke melding doet dat.
- **Lees meer** — sommige meldingen hebben een link *Lees meer* of een eigen onderwerp (bijvoorbeeld *Taaktypes uitgelegd*) naar de gids in Backstage › Help.
- **Actieknop** — de melding over het rekenprofiel heeft een knop *Rekenprofiel openen* naar Projectinstellingen.

De lijst hieronder is een keuze, gegroepeerd naar onderwerp. Waar het niet staat, is het een fout of info.

### Opslaan, openen en herstel

- **Opslaan mislukt** (fout) — *Opslaan mislukt* met de reden eronder. Bij opslaan, opslaan als en het exporteren van een rapport.
- **Opgeslagen als download** (info) — *Opgeslagen als download: '{naam}' staat nu in je downloadmap. …* Bij *Opslaan als* en exporteren, als de omgeving de app niet rechtstreeks naar de gekozen plek laat schrijven. Twee downloads vlak na elkaar vouwen samen.
- **Opslaan als download (uitleg)** (info, 15 seconden) — *Opgeslagen als download: '{naam}' staat in je downloadmap. Deze browser laat de app niet naar een eigen plek schrijven, …* Bij *Opslaan* in een browser die alleen via een download bewaart. Eén keer per sessie, met een link naar de uitleg over bestanden.
- **Browser schrijft niet terug** (info, 15 seconden) — *Deze browser laat de app niet terugschrijven naar '{naam}'. …* Bij *Opslaan* van een project met een bestand, als de browser opnieuw om een plek moet vragen. Eén keer per sessie, met een link naar de uitleg over bestanden.
- **Automatisch opslaan mislukt** (fout) — *Automatisch opslaan mislukt* met de reden. Geldt voor het automatisch opslaan naar het bestand en voor het crashherstel.
- **Bibliotheek kon niet worden opgeslagen** (fout) — *Bibliotheek kon niet worden opgeslagen*, bij het opslaan van de resourcebibliotheek.
- **Bestand openen mislukt** (fout) — *Bestand openen mislukt* met de reden. Bij een voorbeeld, een recent bestand of een importbestand.
- **Oud of beveiligd .mpp** (fout) — *Dit .mpp-bestand gebruikt een oud formaat (Project 2007 of ouder)…* of *Dit .mpp-bestand is met een wachtwoord beveiligd…*, allebei met het advies te exporteren als XML in MS Project en dat bestand te openen.
- **Ongeldig XER-bestand** (fout) — een van de *xer…*-teksten, bijvoorbeeld *Dit bestand is geen geldig of ondersteund XER-bestand.* of *Het XER-bestand bevat een dubbele tabel.*, met de reden erbij.
- **IFC kon niet worden gelezen** (fout) — *IFC kon niet worden gelezen* met de reden, in de IFC-weergave.
- **Herstel** (fout) — *Hersteld bestand kon niet worden gelezen*, *Herstellen mislukt* en *N herstelbestanden konden niet worden geladen en zijn overgeslagen.* Bij het herstellen na een onverwachte afsluiting.
- **Tak bewaard als sjabloon** (info) — *Tak bewaard als sjabloon '{naam}'*.
- **Melding van een extensie** (info, of fout als de extensie een fout meldt) — *Extensie {naam}: {bericht}*. Een extensie mag er hoogstens drie nieuwe per 10 seconden tonen, zodat ze de stapel niet vult. Faalt een stap van de begeleiding van een extensie, dan staat er *Een stap van de extensie {naam} gaf een fout. De begeleiding gaat door.*, en kan een projectbestand van een extensie niet worden geopend, dan *Het projectbestand {bestand} van de extensie {naam} kon niet worden geopend.* Beide zijn fouten.
- **Een wijziging kwam tussendoor** (fout) — *Een wijziging van de MCP-client of een extensie kwam tussendoor. …* Als je de taakdialoog annuleert terwijl de MCP-client of een extensie intussen iets wijzigde: de taakwijzigingen van vóór die wijziging worden dan niet teruggedraaid en staan als gewone stappen onder *Ongedaan maken*.

### Berekenen

- **Planning kon niet worden berekend** (fout) — *Planning kon niet worden berekend* met de reden eronder (zie *Redenen van een planningsfout*). Bij *Bereken*, bij het wisselen van document en bij het openen van een bestand.
- **Statusdatum op vandaag gezet** (info) — *Statusdatum op vandaag gezet ({datum}).* Bij het invoeren van voortgang in een project zonder statusdatum. De app meet voortgang tot de statusdatum, dus zonder statusdatum kan ze voortgang niet verwerken. Een andere datum zet je bij *Planning › Baselines & voortgang › Statusdatum*. Met een link *Lees meer* naar [Voortgang, statusdatum en baseline](docs://uitleg-voortgang).
- **Duur korter dan het gedane werk** (fout) — *'{naam}' is al voor {N}% gedaan: een duur korter dan het gedane werk kan niet. De duur is niet gewijzigd.*

### Relaties en hiërarchie

- **Relatie geweigerd** (fout) — *Deze relatie bestaat al*, *Een relatie tussen een taak en zijn eigen (voor)ouder-samenvattingstaak is niet toegestaan.* of *Deze relatie zou een kring in de planning maken ({kring}) en is niet aangemaakt.* De kring noemt de taken, zodat je weet welke relatie je eerst moet weghalen of omdraaien.
- **Verplaatsing geweigerd** (fout) — *Deze verplaatsing zou een kring in de planning maken ({kring}): de relaties van een samenvattingstaak gelden ook voor haar subtaken. Er is niets verplaatst.*
- **Relaties vallen weg na verplaatsen** (info) — *Na het verplaatsen verbinden N relaties een taak met zijn eigen samenvattingstaak; die tellen niet meer mee in de berekening.*
- **Relaties overgeslagen bij invoegen** (fout) — *N relaties zijn niet aangemaakt: ongeldige koppeling…*, bij het plakken of invoegen van een tak. Eronder staat welke relaties, bijvoorbeeld *Niet aangemaakt: Fundering → Metselwerk.*
- **Relaties niet meegerekend na import** (info) — *N relatie(s) konden niet worden meegerekend. Controleer de voorganger- en opvolgerkolommen.*
- **Dubbele id's na import** (info) — *Objecten met een dubbel id in dit bestand: N. Ze hebben een eigen id gekregen…*

### Taken bewerken

- **Start vastgelegd als constraint** (info) — *'{naam}' start niet eerder dan {datum} (SNET).* Als je de start van een taak met voorganger verandert. De voorganger bepaalt de start, dus de app legt je datum vast als constraint *Start niet eerder dan* (SNET). Na herberekenen (F5) begint de taak niet vóór die datum. Had de taak al zo'n constraint, dan staat er *'{naam}' start nu niet eerder dan {datum} (SNET).*; bij meer taken tegelijk staat er een aantal. Met een link *Lees meer* naar [Constraints en deadlines](docs://uitleg-constraints).
- **Start niet toegepast** (fout) — *De nieuwe start van '{naam}' is niet toegepast: de taak heeft een voorganger en de constraint {type} {datum}, en die bepalen de start. Pas die constraint aan om de start te verplaatsen.*
- **Mijlpaal geweigerd** (fout) — *'{taak}' heeft resource-toewijzingen en kan geen mijlpaal worden. Verwijder eerst de toewijzingen.* of *'{taak}' is een samenvattingstaak met subtaken en kan geen mijlpaal worden.* Bij één geweigerde taak staat de naam in de melding. Bij meer geweigerde taken met dezelfde reden staat er *{aantal} taken hebben resource-toewijzingen en kunnen geen mijlpaal worden. Verwijder eerst de toewijzingen.* of *{aantal} taken zijn samenvattingstaken met subtaken en kunnen geen mijlpaal worden.* Daaronder staan de geweigerde namen; toegestane taken worden wel omgezet. Bij het omzetten in de taakdialoog, het eigenschappenpaneel, het contextmenu en de tabel.
- **Toewijzingen verplaatst naar subtaak** (info) — *Toewijzing verplaatst naar subtaak '{kind}'.* of *N toewijzingen verplaatst naar subtaak '{kind}'.* Als een extensie een taak met toewijzingen subtaken geeft. Die taak wordt een samenvattingstaak, en een samenvattingstaak draagt zelf geen toewijzingen. Daarom gaan ze naar de eerste nieuwe subtaak. In de app zelf kies je dat in het venster *Taak wordt een samenvattingstaak*; daarna komt deze melding niet. Met een link *Lees meer* naar [Structuur aanpassen](docs://howto-structuur-aanpassen).
- **Mijlpaalmarkering verwijderd** (info) — *'{fase}' is geen mijlpaal meer.* Bij één taak staat de naam in de melding; bij meer taken staat er *{aantal} taken zijn geen mijlpaal meer.* Alleen taken die hun mijlpaalmarkering verliezen tellen mee. Als een mijlpaal subtaken krijgt. Een mijlpaal is een moment zonder subtaken; met subtaken wordt hij een samenvattingstaak. Met een link *Lees meer* naar [Structuur aanpassen](docs://howto-structuur-aanpassen).
- **Vraag verouderd** (fout) — *De taken of toewijzingen zijn veranderd terwijl de vraag openstond. Er is niets gewijzigd; probeer het opnieuw.* Als je in het venster *Taak wordt een samenvattingstaak* kiest, maar de vraag intussen niet meer klopt.
- **Samenvattingstaak geweigerd** (fout) — *'{fase}' kan geen samenvattingstaak worden: …* met de reden, en *Er is niets gewijzigd.* Als een extensie een taak met toewijzingen subtaken geeft en de toewijzingen niet naar de eerste nieuwe subtaak kunnen. In de app zelf komt deze melding niet: daar vraagt het venster *Taak wordt een samenvattingstaak* wat er moet gebeuren, en is *Verplaatsen* dan uitgeschakeld.
- **Cellen overgeslagen bij plakken** (fout) — *N cellen overgeslagen: ze zijn read-only (bijvoorbeeld een automatisch genummerde WBS-code of een berekende kolom).*
- **Verwijzingen leeggemaakt bij plakken** (info) — *N verwijzingen bestonden niet in dit document en zijn leeggemaakt (taakkalenders, eigen werksoorten, activity codes of gebruikersvelden uit het brondocument).*
- **Structuur staat vast** (fout, rode strook onder het lint) — *Niet beschikbaar tijdens filteren/groeperen/sorteren*, met de knop *Wissen*. Terwijl er gefilterd, gegroepeerd of gesorteerd wordt: bij inspringen, uitspringen en slepen, bij *Invoegen boven* en *Invoegen onder* (rechtermuismenu of sneltoets). De strook blijft staan tot je op het kruisje klikt, Ctrl+Z of Ctrl+Y gebruikt, of naar een ander document gaat. Zie [Structuur aanpassen](docs://howto-structuur-aanpassen).
- **Taak staat achteraan** (fout) — *De nieuwe taak staat achteraan. Tijdens filteren, groeperen of sorteren kan de app hem niet onder je selectie zetten.* Met de knop *Wissen*. Bij *Taak* en *Mijlpaal ▾* met een geselecteerde taak, terwijl er gefilterd, gegroepeerd of gesorteerd wordt. De taak is wel toegevoegd, maar onderaan. *Wissen* haalt filter, groepering en sortering weg en sluit de melding. Zie [Taken en mijlpalen toevoegen](docs://howto-taken-en-mijlpalen-toevoegen).
- **Taaktype paste duren aan** (info) — *Het taaktype heeft na de kalenderwijziging de duur van N taken aangepast (werk blijft, uren per dag veranderden).* Met een link *Taaktypes uitgelegd*.

### Primavera P6 XML

- **P6 XML-bestand geopend** (info) — *P6 XML-bestand geopend: N projectdocumenten.* Na het openen van een P6 XML-bestand.
- **Niet overgenomen** (blijft staan) — *N relaties tussen projecten zijn niet als relatie overgenomen.* en *N activiteiten zonder project zijn niet ingelezen.* Controleer of je planning compleet is.
- **Leeg of onbruikbaar** (fout) — er opent niets. Drie redenen: *In dit bestand staan geen activiteiten die de app kan lezen.*, *De activiteiten hebben geen ObjectId. …* en *Het bestand gebruikt XER-kolomnamen … Open de .xer zelf.*

### Primavera (XER)

- **XER-bestand geopend** (info) — *XER-bestand geopend: N projectdocumenten.* Eén melding per bestand, ook als het bestand meer projecten opent, met een link *Lees meer* en detailregels eronder. Altijd *N projecten gezien.* Alleen als het aantal boven 0 is: *N lege projecten overgeslagen.*, *N baselineprojecten uitgesloten.*, *N baselines gematerialiseerd.*, *N losse baselineverwijzingen genegeerd.*, *Beschermende baseline-terugval gebruikt.* en *N externe koppelingen bewaard.* Alleen bij een andere codering dan UTF-8: *Tekstcodering vastgesteld als {codering}.* Verder, als het aantal boven 0 is: *N parserbevindingen.*, *N kalenderbevindingen.*, *N getalnotatieproblemen.*, *N enum-terugvallen.* en *N P6-planningsinstellingen met veilige terugval.*
- **Datums zoals Primavera ze opsloeg** (detailregel in dezelfde melding) — *N taken tonen de datums zoals Primavera ze opsloeg (niet herberekend).* N telt alle taken waarvan het bestand datums vastlegde, ook de taken die niet afwijken. Of, als de modus niet aanging, *N taken wijken af van de datums in het bestand — je kunt ze tonen.*
- **XER-bronarchief onbruikbaar** (info) — *Het XER-bronarchief in dit bestand is onbruikbaar en weggelaten; het project zelf is volledig geopend.* met de reden (bijvoorbeeld *Reden: de controlesom past niet bij de bronbytes — het archief is beschadigd.*) en het gevolg (*De planning, het rekenprofiel en alle projectdata uit het IFC zijn compleet. …*). Bij het openen van een IFC-bestand waarin een eerder bewaard XER-bronarchief niet te gebruiken is. Ook bij het herstellen na een onverwachte afsluiting, als de herstelopslag het bronarchief niet meer heeft.
- **Export verliest XER-informatie** (info) — *Bij export naar {formaat} gaat XER-broninformatie verloren.* Na een geslaagde export naar een ander formaat dan IFC van een project met gegevens die alleen in een XER-bestand bestaan. Met een link *Lees meer*.

### Importeren, exporteren en rekenprofiel

- **Datums zoals in het bestand** (info) — *N taken tonen de datums zoals ze in het bestand staan (niet herberekend).* (N telt alle taken met vastgelegde datums) of *N taken wijken af van de datums in het bestand — je kunt ze tonen.* Bij het openen van een bestand met vastgelegde datums.
- **Werk en taaktypes zichtbaar** (info) — *Dit bestand bevat opgeslagen werk of taaktypes; het taaktype en het resterende werk zijn voor dit project zichtbaar.*
- **MS Project-planning ingelezen** (info) — *Dit MS Project-bestand bevat N taken met een onderbroken, genivelleerde of resource-gedreven planning. Die worden als zodanig ingelezen en getoond.*
- **Onderbrekingen niet geëxporteerd** (info) — *N taken met onderbrekingen zijn zonder onderbrekingen geëxporteerd: MS Project/P6 kennen die alleen als urenverdeling.* Bij export naar MS Project of Primavera.
- **Projectstart verzet** (info) — *N taken schoven mee met de projectstart.* Als je de projectstart later zet. Alleen taken zonder voorganger en zonder constraint die vóór de nieuwe startdatum zouden liggen, schuiven naar die datum. Met een link *Lees meer* naar [Nieuw project en Projectinstellingen](docs://ref-projectinfo).
- **Datumvenster stuurt niet meer** (info) — *Het datumvenster uit MS Project stuurt N taken niet meer na deze bewerking; …* Eén keer per document.
- **Nivelleervertraging afgerond** (info) — *Nivelleren rondt de minuutprecieze nivelleervertraging van MS Project van N taken af op hele werkdagen.* Eén keer per document.
- **Rekenprofiel toegepast** (info) — *Dit project rekent als {profiel}. Aanpassen via Bestand → Projectinstellingen → Rekenprofiel en reken-opties.* Met de knop *Rekenprofiel openen*. Na het toepassen van een profiel volgt zo nodig *Na het toepassen zijn N taken verschoven.*
