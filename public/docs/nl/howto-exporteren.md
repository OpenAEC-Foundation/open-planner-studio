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

- *Voortgang (Excel)* en *Voortgang (CSV)*, op de kaarten *Voortgangsblad (Excel)* en *Voortgangsblad (CSV)*: een slank blad met id, WBS, naam, datums en voltooiing, om rond te sturen naar wie de voortgang invult.
- *CSV (;)*, op de kaart *CSV (puntkomma-gescheiden)*: een taaklijst die je in een spreadsheet opent.
- *MS Project XML*: te openen in Microsoft Project.
- *Primavera P6 XML*: voor Oracle Primavera P6.
- *IFC 4x3*: het eigen formaat van de app, met alles erin.

### Een IFC-export met bibliotheekbestand

Is je project gekoppeld aan een resourcebibliotheek, dan staat onder de kaarten in *Bestand › Exporteren* het vakje *Bibliotheekbestand ernaast opslaan*. Vink je het aan en kies je *IFC 4x3*, dan vraagt de app twee keer om een plek: eerst voor het project, daarna voor *projectnaam-bibliotheek.ifc*. Dit vakje staat alleen in *Bestand › Exporteren*, niet in de lijst op het tabblad *Start*.

### Een voortgangsblad terugzetten

Een ingevuld voortgangsblad lees je weer in via *Bestand › Importeren*. Zie [Voortgang uit een spreadsheet importeren](docs://howto-voortgang-importeren).

## Valkuilen en wat de app dan doet

**Je project verandert niet.** Het bestand van je project blijft hetzelfde, en de markering *Niet opgeslagen* blijft staan als die er stond.

**Een verouderde planning wordt eerst doorgerekend.** Je krijgt dus de actuele datums, ook als je vergat op *Bereken* te drukken.

**Een export staat ook in Recent.** Dat geldt niet voor de voortgangsbladen. Open je een export daar, dan opent hij als import van dat formaat.

**Een export neemt niet alles mee.** Een CSV-bestand heeft geen resources of constraints, P6 XML heeft geen baselines en deadlines. Ook het rekenprofiel gaat niet mee: een heropende export rekent als *Open Planner Studio*. Alleen IFC neemt alles mee. Een voorbeeld met getallen vind je in [Bestanden en formaten](docs://uitleg-bestanden).

**Twee formaten met dezelfde extensie.** MS Project XML en Primavera P6 XML krijgen allebei de naam *projectnaam.xml*. Geef ze zelf een verschillende naam, anders weet je later niet welk bestand welk formaat is.

**Een planning met een kringverwijzing exporteert niet.** De app rekent eerst door en stopt als er een kring is. Op het tabblad *Start* krijg je de melding *Planning kon niet worden berekend*, met daaronder bijvoorbeeld *Kringverwijzing tussen taken: Set up site → Demolish existing extension → Set up site*. In *Bestand › Exporteren* staat alleen die tweede tekst op de pagina. Los de kring op en exporteer opnieuw.

**Een project uit Primavera verliest broninformatie.** Exporteer je zo'n project naar CSV, MS Project XML of P6 XML, dan meldt de app: *Bij export naar CSV gaat XER-broninformatie verloren.* Bij MS Project XML staat er *MSPDI*, bij P6 XML *P6*. Zie [Een Primavera P6-bestand (.xer) openen](docs://howto-xer-openen).

**Onderbroken taken verliezen hun onderbrekingen.** MS Project en Primavera kennen een onderbreking alleen als urenverdeling. Bevat je project onderbroken taken zonder urenverdeling, dan meldt de app na een export naar MS Project XML of P6 XML: *2 taken met onderbrekingen zijn zonder onderbrekingen geëxporteerd: MS Project/P6 kennen die alleen als urenverdeling.* Bij één taak staat er *1 taak met onderbrekingen is zonder onderbrekingen geëxporteerd: MS Project/P6 kennen die alleen als urenverdeling.* Zie [Een taak splitsen](docs://howto-taak-splitsen).

**Een planning in de weergave *Datums zoals opgeslagen*.** Exporteer je naar CSV terwijl je de datums uit het bronbestand ziet, dan laat de app *Critical* en *Total Float* leeg voor taken waarvan het bronbestand dat niet vastlegde. Zie [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen).

## Zie ook

- [Bestanden en formaten](docs://uitleg-bestanden): wat elk formaat meeneemt en wat niet.
- [Een bestand openen en opslaan](docs://howto-bestand-openen-en-opslaan): je project zelf bewaren als IFC.
- [Voortgang uit een spreadsheet importeren](docs://howto-voortgang-importeren): een ingevuld voortgangsblad inlezen.
- [Import- en exportformaten](docs://ref-import-exportformaten): per formaat wat meegaat en wat niet.
