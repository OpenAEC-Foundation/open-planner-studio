# Bestanden en formaten

Wat staat er eigenlijk in het bestand dat je opslaat? En wat gebeurt er met je planning als je hem exporteert naar een ander pakket? In dit artikel lees je hoe de app met bestanden omgaat: wat de app opslaat, wat een export meeneemt en waarin opslaan, automatisch opslaan en crashherstel verschillen. Het voorbeeld aan het eind laat met getallen zien wat een export doet.

## Het begrip

De app bewaart een planning standaard in het **IFC-formaat** (`.ifc`), een open uitwisselformaat voor bouwinformatie. De app schrijft het IFC-schema van het project, standaard IFC 4.3 ADD2 (zie [Het IFC-schema kiezen](docs://howto-ifc-schema-kiezen)). Het tabblad *IFC* toont de IFC-tekst van de planning. *Genereer IFC* ververst die tekst en *Kopieer* zet haar op het klembord. Met *Toepassen* kun je de planning in het huidige tabblad vervangen door de bewerkte tekst. Bij een gebouwmodel of gegevens van een ander programma is die knop uitgeschakeld.

Met de experimentele instelling *IFCX openen en opslaan* aan kun je een planning ook bewaren in het **IFCX-formaat** (`.ifcx`), een uitwisselformaat voor bouwinformatie dat nog in ontwikkeling is. Op de desktop kun je je planning met *Opslaan als* in een nieuw IFCX-bestand bewaren en dat weer openen in Open Planner Studio. Het gebouwmodel of P6-bronarchief blijft in het oorspronkelijke bestand. Voor uitwisseling met een ander programma gebruik je het IFC-formaat als dat programma IFC leest. Een latere versie van de app kan een experimenteel IFCX-bestand weigeren.

CSV, XML, MPP en XER dienen voor uitwisseling met andere programma's. De app leest CSV, MS Project XML, Primavera P6 XML, MS Project-bestanden (`.mpp`) en Primavera-bestanden (`.xer`). Ze schrijft CSV, MS Project XML, Primavera P6 XML, Primavera-bestanden (`.xer`) en een voortgangsblad voor Excel. Naar `.mpp` kun je niet exporteren.

Bij export naar een ander pakket gaan de gegevens mee die het gekozen exportformaat kan vastleggen. Een CSV-export bevat bijvoorbeeld de taaklijst. Het IFC-formaat bewaart ook de logica, resources en kalenders van de planning.

## Hoe de app met bestanden omgaat

### Wat openen doet

Bij *Bestand › Openen* kiest de app de lezer op de extensie. Bij een `.xml`-bestand kijkt ze in het bestand zelf of het MS Project XML of Primavera P6 XML is. Voor een onbekende extensie probeert de app het bestand als IFC te lezen. Lukt dat niet, dan toont de app de reden.

Elk bestand opent in een eigen tabblad. De uitzondering is een tabblad dat nog leeg en ongewijzigd is: dat neemt het bestand over. Eén Primavera-bestand kan meerdere tabbladen opleveren, één per project met taken.

Na het openen rekent de app altijd door. Komt het bestand uit een ander pakket, dan kunnen de datums afwijken van wat het bestand zei. Dat staat beschreven in [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen).

Het **opslagdoel** is het bestand dat *Opslaan* bijwerkt. Dat kan het IFC-bestand zijn dat je opende, als de app ernaar kan schrijven. Na een import uit CSV, XML, `.mpp` of `.xer` schrijft *Opslaan* de planning in een nieuw IFC-bestand. In Firefox krijg je bij lokaal opslaan een download.

Met de experimentele instelling *IFCX openen en opslaan* aan werkt *Opslaan* een geopend IFCX-bestand bij als de app schrijftoegang heeft. Voor een nieuw lokaal IFCX-bestand downloadt de browser een kopie. Een ander type kies je met [Opslaan als in de desktop-app](docs://howto-bestand-openen-en-opslaan).

### Wat opslaan schrijft

Bij opslaan in het IFC-formaat bewaart de app onder meer:

- taken met structuur, duur, datums en voortgang;
- relaties met lag, constraints en deadlines;
- kalenders, resources en toewijzingen, ook de curves;
- baselines, activiteitcodes, eigen velden en aantekeningen;
- externe koppelingen naar andere projecten;
- de projectinstellingen, zoals de statusdatum, het rekenprofiel en de reken-opties;
- de koppeling met een resourcebibliotheek.

Wat je op het scherm instelt, hoort niet bij het project en gaat niet mee: zoom, scrollpositie, de geselecteerde taak en ingeklapte fasen. Ook je app-instellingen, zoals taal en thema, staan niet in het bestand. Die bewaart de app zelf, in de app of in je browser.

Een export naar een ander formaat raakt je project niet. Na een export heeft het project nog hetzelfde opslagdoel en staat het er nog net zo *Niet opgeslagen* voor als daarvoor.

### Wat een export verliest

Elke adapter neemt mee wat zijn formaat kent.

**MS Project XML** neemt taken, relaties, kalenders, resources, toewijzingen, constraints, deadlines en de statusdatum mee. Van je baselines gaat alleen de actieve mee. Activiteitcodes, eigen velden, aantekeningen en externe koppelingen gaan niet mee. Een tweede constraint op een taak gaat niet mee. Een constraint *Moet starten op (MSO)* of *Moet eindigen op (MFO)* zonder de keuze *Verplicht (pin logica)* komt terug als *Start niet eerder dan (SNET)* of *Eindig niet eerder dan (FNET)*. *Handmatig gepland* en de *Nivelleervertraging* van een taak komen niet terug. Een hammock wordt een gewone taak met berekende datums.

**Primavera P6 XML** neemt taken, relaties, kalenders, resources, toewijzingen, constraints en de statusdatum mee. Baselines en deadlines gaan niet mee, en ook geen activiteitcodes, eigen velden, aantekeningen en externe koppelingen. Een hammock gaat mee als *Level of Effort*, net als in een `.xer`. P6 kent geen lag in procenten: de app rekent zo'n lag om naar een vast aantal dagen. Een lag in kalenderdagen wordt een lag in werkdagen.

**CSV** is een taaklijst. Het bestand heeft per taak deze kolommen: taak-id, WBS, niveau, naam, duur, start, einde, voorgangers, werksoort, het id van een eigen werksoort (`OPS Custom Task Type ID`), status, voltooiing, werkelijke start en einde, kritiek, totale speling en beschrijving. Resources, toewijzingen, kalenders, constraints, deadlines, baselines en de statusdatum staan er niet in. De kolomkoppen zijn altijd Engels.

**Een IFC-export neemt het rekenprofiel en alle reken-opties mee.** Exporteer je naar CSV of MS Project XML, dan staat het profiel niet in het bestand; van de reken-opties schrijft MS Project XML hooguit de kritiek-drempel. Zo'n bestand heropent als *Open Planner Studio*. Een `.xer` en een Primavera P6 XML heropenen als *Primavera P6*, met de planningsinstellingen van P6 die in het bestand staan. Rekende je project met *Primavera P6* of *Microsoft Project*, bijvoorbeeld omdat het uit een `.xer` of `.mpp` kwam, dan kunnen de datums daardoor verschuiven. Wat een rekenprofiel is, staat in [Rekenprofielen en conventies](docs://uitleg-rekenprofielen).

Komt je project uit een Primavera-bestand (`.xer`), ook als je het tussendoor als IFC hebt opgeslagen, dan meldt de app na een export naar CSV, MS Project XML of P6 XML: *Bij export naar CSV gaat XER-broninformatie verloren.* Bij MS Project XML staat er *MSPDI* in plaats van *CSV*, bij P6 XML staat er *P6*. Naar IFC krijg je die melding niet: het IFC-bestand bewaart Primavera's bronbestand mee. Zie [Een Primavera P6-bestand (.xer) openen](docs://howto-xer-openen).

Nog twee dingen die de app bij een export doet. Is de planning verouderd, dan rekent ze eerst door en exporteert daarna. En een planning met een kringverwijzing exporteert ze niet: je krijgt een melding met de kring erin, bijvoorbeeld *Kringverwijzing tussen taken: Set up site → Demolish existing extension → Set up site*.

### Opslaan, automatisch opslaan en crashherstel

Dit zijn drie verschillende dingen. Ze lijken op elkaar, maar schrijven naar een andere plek.

**Opslaan** doe jij. De app schrijft je project naar je bestand en haalt de markering *Niet opgeslagen* weg.

**Automatisch opslaan** staat standaard uit en zet je per project zelf aan. De app schrijft dan, zonder venster, telkens als er wijzigingen zijn naar hetzelfde bestand, hoogstens eens per tien seconden. Het werkt alleen als het project al een bestand heeft. Zie [Automatisch opslaan aanzetten](docs://howto-automatisch-opslaan).

**Crashherstel** staat altijd aan. Zodra er ergens een wijziging is, bewaart de app, ook hoogstens eens per tien seconden, een herstelkopie van álle open projecten, ook van projecten die je zelf niet wijzigde. Die kopie staat niet in je projectbestand: op de desktopapp in de datamap van de app, in de browser in de opslag van de browser. Bij de volgende start biedt de app die kopie aan. Dat lees je in [Herstellen na een crash](docs://howto-herstellen-na-een-crash). Crashherstel schrijft nooit naar je projectbestand.

Omdat er hoogstens eens per tien seconden een kopie wordt bewaard, kun je bij een crash de laatste seconden werk kwijt zijn.

### Desktop en browser

De desktopapp en de browserversie doen hetzelfde met je project, maar schrijven bestanden op een andere manier.

Op de desktop werkt de app met echte paden. *Opslaan* schrijft rechtstreeks naar je bestand. Meestal schrijft de app eerst naar een tijdelijk bestand ernaast (`.ops-save.tmp`) en vervangt pas daarna je bestand, zodat een crash midden in het schrijven je oude bestand niet afkapt. Sluit je de app met wijzigingen, dan vraagt ze per project of je wilt opslaan. Bij een nette afsluiting ruimt ze haar herstelkopieën op.

In een browser die bestanden kan bewaren waar jij wilt (zoals Chrome en Edge) krijg je een gewoon open- en opslaanvenster. Daarna schrijft *Opslaan* rechtstreeks naar het bestand; bij een bestand dat je opende vraagt de browser daarvoor eenmalig toestemming. De lijst *Recent* werkt, met alleen bestandsnamen.

In een browser zonder die mogelijkheid (zoals Firefox) opent de app een bestand via de bestandskiezer en bewaart ze via een download. Bij *Opslaan* legt de melding *Opgeslagen als download: 'naam.ifc' staat in je downloadmap. …* dat één keer per sessie uit; bij *Opslaan als* en exporteren zie je *Opgeslagen als download: 'naam.ifc' staat nu in je downloadmap. Deze omgeving staat de app niet toe rechtstreeks naar de gekozen locatie te schrijven.* Kan de browser wel een opslaanvenster tonen maar niet terugschrijven naar het bestand van het project, dan vraagt *Opslaan* elke keer opnieuw om een plek. Ook dat legt een melding één keer per sessie uit. *Bestand › Recent* staat er dan wel, maar opent een lege pagina, en automatisch opslaan is niet beschikbaar. Dezelfde melding krijg je in elke omgeving die de app het schrijven naar je gekozen plek niet toestaat.

## Voorbeeld: het voorbeeldproject exporteren

Neem het voorbeeld *Refurbishment & Extension of a Family Home* (*Bestand › Voorbeelden*). Het heeft 20 taken, waarvan 4 fasen en 2 mijlpalen, en 16 relaties. Er zijn 6 resources met 8 toewijzingen, 1 baseline en een koppeling met de *Demo resource library*. De taak *Demolish existing extension* heeft de constraint *Start niet eerder dan (SNET)* op 14 mei 2027 en *Handover inspection* heeft een deadline op 29 juli 2027. De planning eindigt op 7 juli 2027.

Zo komt het project terug uit elk formaat, gemeten nadat het exportbestand weer is geopend:

- Het IFC-bestand geeft alles terug: 20 taken, 16 relaties, 6 resources, 8 toewijzingen, de baseline, de constraint, de deadline en de bibliotheekkoppeling. De planning eindigt weer op 7 juli 2027.
- Het MS Project XML-bestand geeft ook alles terug, op de bibliotheekkoppeling na. De planning eindigt op 7 juli 2027.
- Het P6 XML-bestand geeft de taken, relaties, resources, toewijzingen en de constraint terug. De baseline en de deadline ontbreken. De planning eindigt nog op 7 juli 2027, want de constraint zit er nog in.
- Het CSV-bestand geeft 20 taken en 16 relaties terug. Resources, toewijzingen, baseline, constraint en deadline ontbreken, en het project heet *CSV Import*. Zonder de constraint schuift het werk naar voren: de planning eindigt op 2 juli 2027, vijf kalenderdagen eerder.

Zonder die constraint komt ook het voorbeeld zelf uit op 2 juli 2027. Het verschil komt dus door de constraint die het CSV-bestand niet meeneemt.

## Gevolgen en misverstanden

**Je project bewaren.** Met *Opslaan* bewaar je de planning waaraan je werkt. Het IFC-formaat bewaart ook het bronarchief van een XER-import. Met *Exporteren* maak je een kopie voor het programma dat de planning ontvangt.

**Een export opnieuw openen levert niet altijd dezelfde planning.** De app rekent bij het openen altijd door, met het rekenprofiel dat bij het formaat hoort. Mist er logica, zoals de constraint in het CSV-voorbeeld, of rekent het profiel anders, dan verandert de uitkomst.

**Een export staat ook in Recent.** Op de desktop en in browsers met bestandstoegang komt een export, net als een opgeslagen project, in *Recent* te staan (het voortgangsblad niet). Open je hem daar, dan opent hij als import van dat formaat.

**Opslaan is niet hetzelfde als crashherstel.** Crashherstel helpt na een crash, maar vervangt het opslaan niet. Sla dus op voordat je een tabblad of de app sluit.

## Zie ook

- [Een bestand openen en opslaan](docs://howto-bestand-openen-en-opslaan): de stappen voor openen, opslaan en opslaan als.
- [Exporteren](docs://howto-exporteren): een formaat kiezen en wat je te zien krijgt.
- [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen): waarom een geïmporteerde planning andere datums kan tonen.
- [Taakdialoog en eigenschappenpaneel](docs://ref-taak-eigenschappen): wat een constraint doet, en dus wat er verdwijnt als hij ontbreekt.
- [Relaties leggen](docs://howto-relaties-leggen): wat een lag is en hoe de app hem rekent.
- [Een hammock maken](docs://howto-hammock): wat een hammock is, die een export als gewone taak schrijft.
- [Codes en eigen velden](docs://howto-codes-en-velden): werken met activiteitcodes en eigen velden.
- [Externe relaties naar een ander project](docs://howto-externe-relaties): koppelingen die MS Project XML en P6 XML niet meenemen.
- [Een baseline opslaan en beheren](docs://howto-baseline-opslaan-en-beheren): baselines, waarvan MS Project XML alleen de actieve meeneemt.
- [Import- en exportformaten](docs://ref-import-exportformaten): per formaat wat meegaat en wat niet.
