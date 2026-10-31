# Exporteren

Doel: je planning als bestand in een ander formaat aanleveren, voor iemand die geen IFC leest of voor een ander pakket.

## Wanneer je dit nodig hebt

De adviseur werkt in MS Project, de opdrachtgever in Primavera, de onderaannemer wil de taken in Excel, of je stuurt een planning naar een pakket dat IFC niet aankan. Een export is een kopie in een ander formaat. Wil je je project zelf bewaren, sla het dan op: dat schrijft IFC en neemt alles mee. Wat elk formaat wel en niet meeneemt, staat in [Bestanden en formaten](docs://uitleg-bestanden).

## Stappen

1. Kies *Start › Bestand › Exporteren* en kies een formaat uit de lijst, of kies *Bestand › Exporteren*. Daar staat elk formaat als kaart met een korte toelichting.
2. Kies in het venster een naam en een plek. De app stelt de projectnaam voor, met de extensie van het formaat. De voortgangsbladen heten *projectnaam-voortgang* en openen waar mogelijk in je downloadmap.
3. Bevestig. Er verschijnt geen melding als de export slaagt, behalve de meldingen hieronder. Vanuit *Bestand › Exporteren* kom je daarna terug op het tabblad *Start*, ook als je het venster annuleert. Annuleer je het venster bij een export vanuit de lijst op het tabblad *Start*, dan gebeurt er niets.

Bewaart je browser alleen via een download (zoals Firefox), dan staat het bestand na stap 1 direct in je downloadmap. Je ziet de melding *Opgeslagen als download: 'naam.xml' staat nu in je downloadmap. Deze omgeving staat de app niet toe rechtstreeks naar de gekozen locatie te schrijven.*

### Welk formaat kies je?

De lijst op het tabblad *Start* en de kaarten in *Bestand › Exporteren* bieden dezelfde formaten:

- *Voortgang (Excel)*, op de kaart *Voortgangsblad (Excel)*: een slank blad met id, WBS, naam, datums en voltooiing, om rond te sturen naar wie de voortgang invult.
- *CSV (;)*, op de kaart *CSV (puntkomma-gescheiden)*: een taaklijst die je in een spreadsheet opent.
- *MS Project XML*: te openen in Microsoft Project.
- *Primavera P6 XML*: voor Oracle Primavera P6. Deze keuze heeft ook het label *Experimenteel*: de export is nog niet getest door het bestand in Primavera P6 zelf te openen. Na het opslaan meldt de app wat niet of niet precies meeging.
- *Primavera P6 XER*: voor Oracle Primavera P6, als `.xer`-bestand. Deze keuze heeft het label *Experimenteel*: de export is nog niet getest door het bestand in Primavera P6 zelf te openen, en er gaat veel niet of niet precies mee. Na het opslaan meldt de app wat niet of niet precies meeging. Controleer de planning na het openen in P6. Rekent je project met een ander rekenprofiel dan *Primavera P6*, dan staat onder de keuze een korte hint met het aanbevolen profiel. Hetzelfde geldt voor *Primavera P6 XML*, en voor *MS Project XML* met het profiel *Microsoft Project*. Na het opslaan geeft de app hetzelfde advies in een melding. De export gaat gewoon door.
- *IFC*: het eigen formaat van de app, met alles erin, in het IFC-schema van het project (standaard IFC 4.3 ADD2).

### Een IFC-export met bibliotheekbestand

Is je project gekoppeld aan een resourcebibliotheek, dan staat onder de kaarten in *Bestand › Exporteren* het vakje *Bibliotheekbestand ernaast opslaan*. Vink je het aan en kies je *IFC*, dan vraagt de app twee keer om een plek: eerst voor het project, daarna voor *projectnaam-bibliotheek.ifc*. Dit vakje staat alleen in *Bestand › Exporteren*, niet in de lijst op het tabblad *Start*.

### Een voortgangsblad terugzetten

Een ingevuld voortgangsblad lees je weer in via *Bestand › Importeren*. Zie [Voortgang uit een spreadsheet importeren](docs://howto-voortgang-importeren).

## Valkuilen en wat de app dan doet

**Je project verandert niet.** Het bestand van je project blijft hetzelfde, en de markering *Niet opgeslagen* blijft staan als die er stond.

**Een verouderde planning wordt eerst doorgerekend.** Je krijgt dus de actuele datums, ook als je vergat op *Bereken* te drukken.

**Een export staat ook in Recent.** Dat geldt niet voor de voortgangsbladen. Open je een export daar, dan opent hij als import van dat formaat.

**Een export neemt niet alles mee.** Een CSV-bestand heeft geen resources of constraints, P6 XML heeft geen baselines en deadlines. Ook het rekenprofiel gaat niet mee: een heropende export rekent als *Open Planner Studio*, een heropende `.xer` als *Primavera P6*. Alleen IFC neemt alles mee. Na een export naar `.xer` meldt de app *De XER-export is opgeslagen. Dit ging niet of niet precies mee:*, met per soort een regel, bijvoorbeeld *2 deadlines*. Zie [Import- en exportformaten](docs://ref-import-exportformaten). Een voorbeeld met getallen vind je in [Bestanden en formaten](docs://uitleg-bestanden).

**Twee formaten met dezelfde extensie.** MS Project XML en Primavera P6 XML krijgen allebei de naam *projectnaam.xml*. Geef ze zelf een verschillende naam, anders weet je later niet welk bestand welk formaat is.

**Een planning met een kringverwijzing exporteert niet.** De app rekent eerst door en stopt als er een kring is. Op het tabblad *Start* krijg je de melding *Planning kon niet worden berekend*, met daaronder bijvoorbeeld *Kringverwijzing tussen taken: Set up site → Demolish existing extension → Set up site*. In *Bestand › Exporteren* staat alleen die tweede tekst op de pagina. Los de kring op en exporteer opnieuw.

**Een project uit Primavera verliest broninformatie.** Exporteer je zo'n project naar CSV, MS Project XML of P6 XML, dan meldt de app: *Bij export naar CSV gaat XER-broninformatie verloren.* Bij MS Project XML staat er *MSPDI*, bij P6 XML *P6*. Zie [Een Primavera P6-bestand (.xer) openen](docs://howto-xer-openen).

**Een project dat je zelf maakte, verliest ook gegevens.** Kan het formaat iets uit je project niet bewaren, zoals notities, een tweede constraint of handmatige planning, dan meldt de app na de export: *Bij export naar CSV gaan gegevens verloren die CSV niet kent, zoals notities of een tweede constraint. Het IFC-projectbestand bewaart alles.* Bij MS Project XML staat er *MSPDI*, bij P6 XML *P6*. Met de link *Lees meer* kom je op deze pagina.

**Tekens die XML niet toestaat, worden vervangen.** Een stuurteken in een naam of tekst, bijvoorbeeld uit een ingelezen CSV-bestand, mag niet in een XML-bestand staan. Bij MS Project XML en P6 XML vervangt de app zo'n teken door �. Daarna meldt de app: *2 tekens die in XML niet mogen, zijn in de export vervangen door �.* Bij één teken staat er *1 teken dat in XML niet mag, is in de export vervangen door �.* Zoek in het geëxporteerde bestand naar � om de plek te vinden.

**Onderbroken taken verliezen hun onderbrekingen.** MS Project en Primavera kennen een onderbreking alleen als urenverdeling. Bevat je project onderbroken taken zonder urenverdeling, dan meldt de app na een export naar MS Project XML of P6 XML: *2 taken met onderbrekingen zijn zonder onderbrekingen geëxporteerd: MS Project/P6 kennen die alleen als urenverdeling.* Bij één taak staat er *1 taak met onderbrekingen is zonder onderbrekingen geëxporteerd: MS Project/P6 kennen die alleen als urenverdeling.* Zie [Een taak splitsen](docs://howto-taak-splitsen).

**Een planning in de weergave *Datums zoals opgeslagen*.** Exporteer je naar CSV terwijl je de datums uit het bronbestand ziet, dan laat de app `Critical` en `Total Float` leeg voor taken waarvan het bronbestand dat niet vastlegde. Zie [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen).

## Zie ook

- [Bestanden en formaten](docs://uitleg-bestanden): wat elk formaat meeneemt en wat niet.
- [Een bestand openen en opslaan](docs://howto-bestand-openen-en-opslaan): je project zelf bewaren als IFC.
- [Voortgang uit een spreadsheet importeren](docs://howto-voortgang-importeren): een ingevuld voortgangsblad inlezen.
- [Import- en exportformaten](docs://ref-import-exportformaten): per formaat wat meegaat en wat niet.
