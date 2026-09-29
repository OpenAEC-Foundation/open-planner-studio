# De voortgangsmodus kiezen

Doel: bepalen hoe de app het restwerk plant van een taak die al begonnen is terwijl zijn voorganger nog loopt: volgens de relatie (Retained Logic) of volgens wat er werkelijk gebeurt (Progress Override).

## Wanneer je dit nodig hebt

Op de bouwplaats loopt werk vaak vooruit op de logica. De schilder begint al in de kamers die gestuukt zijn, terwijl de stukadoor elders nog bezig is. In de planning is dat een relatie Eind-Start waarvan de opvolger begint voordat de voorganger klaar is. De app noemt dat **out-of-sequence**. Zie je in de statusbalk *N out-of-sequence-relatie(s)*, dan heb je zo'n geval, en de voortgangsmodus bepaalt hoe de app het restwerk van de opvolger plant. Wat de twee modi doen, staat met een uitgewerkt voorbeeld in [Voortgang, statusdatum en baseline](docs://uitleg-voortgang).

## Stappen

1. Werk de voortgang bij en zet de statusdatum, zoals beschreven in [Voortgang bijwerken](docs://howto-voortgang-bijwerken).
2. Ga naar *Planning › Baselines & voortgang › Voortgangsmodus* en open de keuzelijst.
3. Kies *Retained Logic* of *Progress Override*.
4. Druk op **Bereken** (F5), bijvoorbeeld via *Planning › Planning › Bereken*. De keuze maakt de planning verouderd: de statusbalk meldt *Verouderd — herbereken (F5)*. Staat *Automatisch berekenen* aan, dan doet de app dit zelf.

Hoe kies je?

- **Retained Logic** is de standaard. De relatie blijft gelden: het restwerk van de opvolger begint pas als de voorganger klaar is. Kies dit als de volgorde echt hard is, of als je voorzichtig wilt plannen.
- **Progress Override** laat de werkelijkheid winnen. Het restwerk van de opvolger begint op de statusdatum, zonder te wachten op de voorganger. Kies dit als de opvolger echt doorwerkt en de einddatum niet moet afhangen van een voorganger die nog loopt.

## Resultaat controleren

- Klik op de melding *N out-of-sequence-relatie(s)* in de statusbalk. Het paneel *Waarschuwingen* opent, ook te bereiken via *Planning › Planning › Waarschuwingen*. Elke relatie staat erin met de tekst *Out-of-sequence: de voortgang van de opvolger spreekt de relatie tegen*, bijvoorbeeld *4.2 Stucwerk → 4.5 Schilderwerk (FS)*.
- Kijk naar de balk van de opvolger. Onder Retained Logic loopt hij tot ná het einde van zijn voorganger. Onder Progress Override eindigt hij eerder. In het voorbeeld van de uitleg is dat dinsdag 27 juli tegenover donderdag 22 juli.

## Valkuilen en wat de app dan doet

**Geen verschil.** De modus heeft alleen effect op taken die al begonnen zijn terwijl hun voorganger nog niet klaar is. Zonder zo'n taak verandert er niets.

**De melding blijft.** Progress Override lost de out-of-sequence-melding niet op. De modus bepaalt hoe de app rekent; de tegenstrijdigheid tussen relatie en voortgang blijft bestaan. Klopt de relatie niet meer, pas hem dan aan ([Relaties leggen](docs://howto-relaties-leggen)).

**Hij hoort bij het project.** De keuze wordt met het projectbestand opgeslagen, geldt voor het hele project en is met Ctrl+Z terug te draaien. Een nieuw project staat op Retained Logic.

**Een P6-bestand.** Open je een Primavera P6-bestand (.xer), dan neemt de app de modus uit het bestand over. P6 kent naast Retained Logic en Progress Override ook Actual Dates. Die derde modus kent de app niet; zo'n bestand rekent als Retained Logic.

**Het rekenprofiel.** In het profiel Primavera P6 werkt Progress Override ook achterwaarts, in de late datums en de vrije speling van de voorganger (conventie *Progress Override negeert een gestarte opvolger ook achterwaarts*). In de profielen Open Planner Studio en Microsoft Project is dat niet zo. Je vindt de conventies onder *Instellingen › Project › Projectinfo*, in het blok *Rekenprofiel en reken-opties*.

## Zie ook

- [Voortgang, statusdatum en baseline](docs://uitleg-voortgang): het verschil tussen de twee modi, met getallen.
- [Voortgang bijwerken](docs://howto-voortgang-bijwerken): de voortgang invullen waar de modus op werkt.
- [Relaties leggen](docs://howto-relaties-leggen): een relatie aanpassen die niet meer klopt.
