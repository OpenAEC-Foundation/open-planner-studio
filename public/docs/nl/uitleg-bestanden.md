# Bestanden en formaten

Wat staat er eigenlijk in het bestand dat je opslaat? En wat gebeurt er met je planning als je hem exporteert naar een ander pakket? In dit artikel lees je hoe de app met bestanden omgaat: IFC als eigen formaat, de andere formaten als vertalers, wat een export niet meeneemt en waarin opslaan, automatisch opslaan en crashherstel verschillen. Het voorbeeld aan het eind laat met getallen zien wat een export doet.

## Het begrip

Open Planner Studio heeft één eigen bestandsformaat: **IFC**, een open uitwisselformaat voor bouwinformatie van buildingSMART. De app schrijft IFC 4.3; in de exportlijst heet het *IFC 4x3*. Er is geen tweede, eigen projectbestand. *Opslaan* schrijft je hele project als IFC-bestand (`.ifc`) en *Openen* leest zo'n bestand weer terug. Wil je zien wat er in het bestand komt? Het tabblad *IFC* toont de IFC-tekst van je project; *Genereer IFC* ververst die tekst.

Alle andere formaten zijn **adapters**: vertalers tussen het model van een ander programma en dat van de app. De app leest CSV, MS Project XML, Primavera P6 XML, MS Project-bestanden (`.mpp`) en Primavera-bestanden (`.xer`). Ze schrijft CSV, MS Project XML, Primavera P6 XML en twee voortgangsbladen. Naar `.mpp` of `.xer` kun je niet exporteren.

Waarom is dat onderscheid belangrijk? Een vertaler kan alleen meenemen wat beide kanten kennen. Het IFC-bestand van de app bewaart alles wat bij je project hoort. Elk ander formaat kent een deel daarvan niet, en dat deel blijft dan achter.

## Hoe de app met bestanden omgaat

### Wat openen doet

De app kiest de lezer op de extensie: `.ifc`, `.csv`, `.xml`, `.mpp` of `.xer`. Bij een `.xml`-bestand kijkt ze in het bestand zelf of het MS Project XML of Primavera P6 XML is. Een onbekende extensie behandelt de app als IFC. Is het bestand dat niet, dan meldt ze *Bestand openen mislukt*, met de reden erbij.

Elk bestand opent in een eigen tabblad. De uitzondering is een tabblad dat nog leeg en ongewijzigd is: dat neemt het bestand over. Eén Primavera-bestand kan meerdere tabbladen opleveren, één per project met taken.

Na het openen rekent de app altijd door. Komt het bestand uit een ander pakket, dan kunnen de datums afwijken van wat het bestand zei. Dat staat beschreven in [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen).

Alleen een IFC-bestand wordt het **opslagdoel**: het bestand waar *Opslaan* naar terugschrijft. Een CSV-, XML-, `.mpp`- of `.xer`-bestand niet. Zo'n project heeft na het openen nog geen bestand; *Opslaan* vraagt dan waar het nieuwe IFC-bestand moet komen. Daardoor overschrijft een druk op Ctrl+S nooit je oorspronkelijke bestand met IFC-tekst.

### Wat opslaan schrijft

*Opslaan* schrijft altijd het hele project. Dat zit erin:

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

**Primavera P6 XML** neemt taken, relaties, kalenders, resources, toewijzingen, constraints en de statusdatum mee. Baselines en deadlines gaan niet mee, en ook geen activiteitcodes, eigen velden, aantekeningen en externe koppelingen. Een hammock wordt ook hier een gewone taak. P6 kent geen lag in procenten: de app rekent zo'n lag om naar een vast aantal dagen. Een lag in kalenderdagen wordt een lag in werkdagen.

**CSV** is een taaklijst. Het bestand heeft per taak deze kolommen: taak-id, WBS, niveau, naam, duur, start, einde, voorgangers, type, het id van een eigen taaktype (*OPS Custom Task Type ID*), status, voltooiing, werkelijke start en einde, kritiek, totale speling en beschrijving. Resources, toewijzingen, kalenders, constraints, deadlines, baselines en de statusdatum staan er niet in. De kolomkoppen zijn altijd Engels.

**Alleen IFC neemt het rekenprofiel en de reken-opties mee.** Exporteer je naar CSV, MS Project XML of Primavera P6 XML, dan staat het profiel niet in het bestand; van de reken-opties schrijft MS Project XML hooguit de kritiek-drempel. Zo'n bestand heropent als *Open Planner Studio*. Rekende je project met *Primavera P6* of *Microsoft Project*, bijvoorbeeld omdat het uit een `.xer` of `.mpp` kwam, dan kunnen de datums daardoor verschuiven. Wat een rekenprofiel is, staat in [Rekenprofielen en conventies](docs://uitleg-rekenprofielen).

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

In een browser zonder die mogelijkheid (zoals Firefox) opent de app een bestand via de bestandskiezer en bewaart ze via een download. Je krijgt dan de melding *Opgeslagen als download: 'naam.ifc' staat nu in je downloadmap. Deze omgeving staat de app niet toe rechtstreeks naar de gekozen locatie te schrijven.* *Bestand › Recent* staat er dan wel, maar opent een lege pagina, en automatisch opslaan is niet beschikbaar. Dezelfde melding krijg je in elke omgeving die de app het schrijven naar je gekozen plek niet toestaat.

## Voorbeeld: het voorbeeldproject exporteren

Neem het voorbeeld *Refurbishment & Extension of a Family Home* (*Bestand › Voorbeelden*). Het heeft 20 taken, waarvan 4 fasen en 2 mijlpalen, en 16 relaties. Er zijn 6 resources met 8 toewijzingen, 1 baseline en een koppeling met de *Demo resource library*. De taak *Demolish existing extension* heeft de constraint *Start niet eerder dan (SNET)* op 14 mei 2027 en *Handover inspection* heeft een deadline op 29 juli 2027. De planning eindigt op 7 juli 2027.

Zo komt het project terug uit elk formaat, gemeten nadat het exportbestand weer is geopend:

- Het IFC-bestand geeft alles terug: 20 taken, 16 relaties, 6 resources, 8 toewijzingen, de baseline, de constraint, de deadline en de bibliotheekkoppeling. De planning eindigt weer op 7 juli 2027.
- Het MS Project XML-bestand geeft ook alles terug, op de bibliotheekkoppeling na. De planning eindigt op 7 juli 2027.
- Het P6 XML-bestand geeft de taken, relaties, resources, toewijzingen en de constraint terug. De baseline en de deadline ontbreken. De planning eindigt nog op 7 juli 2027, want de constraint zit er nog in.
- Het CSV-bestand geeft 20 taken en 16 relaties terug. Resources, toewijzingen, baseline, constraint en deadline ontbreken, en het project heet *CSV Import*. Zonder de constraint schuift het werk naar voren: de planning eindigt op 2 juli 2027, vijf kalenderdagen eerder.

Zonder die constraint komt ook het voorbeeld zelf uit op 2 juli 2027. Het verschil komt dus door de constraint die het CSV-bestand niet meeneemt.

## Gevolgen en misverstanden

**Een export is geen back-up.** Alleen IFC bewaart alles. Wil je je project bewaren, sla het dan op als IFC. Exporteer alleen voor iemand die het andere formaat nodig heeft.

**Een export opnieuw openen levert niet altijd dezelfde planning.** De app rekent bij het openen altijd door, met het rekenprofiel dat bij het formaat hoort. Mist er logica, zoals de constraint in het CSV-voorbeeld, of rekent het profiel anders, dan verandert de uitkomst.

**Een export staat ook in Recent.** Op de desktop en in browsers met bestandstoegang komt een export, net als een opgeslagen project, in *Recent* te staan (de voortgangsbladen niet). Open je hem daar, dan opent hij als import van dat formaat.

**Opslaan is niet hetzelfde als crashherstel.** Crashherstel helpt na een crash, maar vervangt het opslaan niet. Sla dus op voordat je een tabblad of de app sluit.

## Zie ook

- [Een bestand openen en opslaan](docs://howto-bestand-openen-en-opslaan): de stappen voor openen, opslaan en opslaan als.
- [Exporteren](docs://howto-exporteren): een formaat kiezen en wat je te zien krijgt.
- [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen): waarom een geïmporteerde planning andere datums kan tonen.
- [Constraints en deadlines](docs://uitleg-constraints): wat een constraint doet, en dus wat er verdwijnt als hij ontbreekt.
- [Relaties en lag](docs://uitleg-relaties): wat een lag is en hoe de app hem rekent.
- [Een hammock maken](docs://howto-hammock): wat een hammock is, die een export als gewone taak schrijft.
- [Codes en eigen velden](docs://howto-codes-en-velden): activiteitcodes en eigen velden, die alleen IFC bewaart.
- [Externe relaties naar een ander project](docs://howto-externe-relaties): koppelingen die MS Project XML en P6 XML niet meenemen.
- [Een baseline opslaan en beheren](docs://howto-baseline-opslaan-en-beheren): baselines, waarvan MS Project XML alleen de actieve meeneemt.
