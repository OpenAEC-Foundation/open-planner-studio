# Herstellen na een crash

Doel: je werk terughalen nadat de app of je browser onverwacht stopte en je niet had opgeslagen.

## Wanneer je dit nodig hebt

De laptop viel uit, de app liep vast of het browsertabblad crashte, en je had de laatste wijzigingen nog niet opgeslagen. Zodra er ergens een wijziging is, bewaart de app op de achtergrond herstelkopieën van al je open projecten, hoogstens eens per tien seconden. Die kopie staat los van je projectbestand. Wat het verschil is met opslaan en automatisch opslaan, staat in [Bestanden en formaten](docs://uitleg-bestanden).

## Stappen

1. Start de app opnieuw. In de browser laad je hetzelfde tabblad opnieuw: de herstelkopie hoort bij dat ene tabblad.
2. Heeft de app kopieën gevonden, dan verschijnt het venster *Niet-opgeslagen werk herstellen*: *Open Planner Studio is niet normaal afgesloten. De volgende documenten hadden niet-opgeslagen wijzigingen die hersteld kunnen worden:* Per project staat er de naam, het pad van het bestand als het project een bestand heeft (in de browser alleen de bestandsnaam), het aantal taken en het tijdstip van de kopie, bijvoorbeeld *21 taken* en *Opgeslagen: 29 sep 2026 09:41*. De tijd staat in de notatie van je instelling *Tijdnotatie*. Het venster kan ook projecten tonen die je niet had gewijzigd.
3. Kies *Herstellen*. De app opent alle projecten uit de lijst, elk in een tabblad, met de stand van de laatste kopie. Enter doet hetzelfde.
4. Kijk je projecten na en sla ze meteen op met Ctrl+S.

Wil je niet herstellen, dan heb je twee keuzes. *Niet herstellen* verwijdert de kopieën, en dat kun je niet ongedaan maken. Sluit je het venster met Escape, met het kruisje of door ernaast te klikken, dan blijven de kopieën staan en vraagt de app bij de volgende start opnieuw.

Het vraagteken rechtsboven in het venster opent dit artikel zonder dat je iets kiest. Zolang je in Help leest, wacht het venster. Ga je terug, dan staat het er weer en kun je alsnog herstellen.

## Valkuilen en wat de app dan doet

**Je krijgt de stand van de laatste kopie.** Wat je in de laatste seconden voor de crash deed, kan ontbreken. Een project dat wijzigingen had, staat weer als *Niet opgeslagen* gemarkeerd. De geschiedenis van *Ongedaan maken* is leeg: je kunt geen stappen van vóór de crash terugdraaien. Zoom, scrollpositie en selectie worden opnieuw opgebouwd.

**Op de desktop houdt een hersteld project zijn bestand, in de browser niet.** Op de desktop schrijft *Opslaan* naar het oorspronkelijke bestand, met de herstelde stand. In de browser is een hersteld project niet meer aan zijn bestand gekoppeld: *Opslaan* vraagt waar het bestand moet komen. Ook de schakelaar *Automatisch opslaan* is dan grijs tot je het project één keer hebt opgeslagen.

**Een project in de weergave *Datums zoals opgeslagen* blijft in die weergave.** Zie [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen).

**Op de desktop verschijnt het venster niet na elke start.** De herstelkopieën staan in de datamap van de app, als IFC-bestanden met een naam die met *recovery* begint. Sluit je de app op de gewone manier af, dan ruimt ze haar eigen kopieën op. Het venster verschijnt dus na een onverwacht einde, na een herstart voor een app-update, of als je het herstel bij een vorige start had uitgesteld.

**In de browser staat de kopie per tabblad.** De kopie staat in de opslag van de browser. Een nieuw tabblad of venster biedt de kopieën van een ander tabblad niet aan. Kopieën van tabbladen die niet meer bestaan, worden na zeven dagen opgeruimd zodra de app weer kopieën schrijft.

**In de browser verschijnt het venster ook na een gewone keer herladen.** Dat gebeurt ook als je alles had opgeslagen. Heb je vlak voor het herladen opgeslagen en daarna niets meer gewijzigd, dan kun je gerust *Niet herstellen* kiezen: je bestand is actueel.

**Het venster verschijnt niet.** Dan heeft de app geen kopie gevonden. Dat gebeurt als je nog niets had gewijzigd, als je in de browser een nieuw tabblad gebruikt, als je het herstel eerder met *Niet herstellen* hebt weggegooid, of als de crash kwam voordat de app de eerste kopie bewaarde: dat kan tot ongeveer tien seconden na je eerste wijziging duren.

**De herstelgegevens hebben een onbekende versie of een ongeldige indeling.** Deze appversie kan die herstelset niet veilig lezen of bijwerken en toont een waarschuwing. De kopieën blijven bewaard, ook bij bewerken of afsluiten. Open dezelfde appversie die de kopieën maakte of een nieuwere versie en probeer opnieuw. Sla nieuw werk zelf op: voor de geblokkeerde herstelset worden geen nieuwe kopieën vastgelegd. In de browser blijven onbekende kopieën van andere tabbladen ook na zeven dagen staan; gedeelde archiefblobs worden dan niet opgeruimd. Andere ondersteunde tabbladen kunnen hun eigen kopieën blijven bijwerken.

**De herstelopslag is tijdelijk geblokkeerd.** Een ander tabblad of een andere open verbinding houdt de upgrade van de browseropslag tegen. De app toont hiervoor een blijvende melding; dit betekent niet dat de bestaande kopieën beschadigd zijn. Ze blijven staan, maar deze pagina kan ze niet lezen of bijwerken en maakt geen nieuwe herstelkopieën. Sla je werk eerst zelf op, sluit andere tabbladen met deze app en laad deze pagina opnieuw om herstel opnieuw te proberen. Alleen het andere tabblad sluiten hervat crashherstel op deze pagina niet.

**Een kopie is beschadigd of tijdelijk niet leesbaar.** De app meldt *Hersteld bestand kon niet worden gelezen*, met de reden erbij, en biedt de overige projecten aan. Kies je *Herstellen*, dan blijven de onleesbare kopieën bewaard. Op desktop wordt een oude, wel herstelde kopie pas opgeruimd nadat een nieuwe herstelkopie veilig is vastgelegd. Is geen enkele kopie leesbaar, dan toont het venster alleen *Kopieën bewaren* en *Kopieën verwijderen*. Bewaren, Enter, Escape of sluiten laat de kopieën staan voor een latere herstelpoging. Verwijderen wist ze definitief; het venster waarschuwt dat dit niet ongedaan kan worden gemaakt.

**Herstellen lukt niet.** De app meldt *Herstellen mislukt* met de reden erbij. De kopieën blijven staan en de vraag komt bij de volgende start terug.

**Een deel van de projecten kan niet worden geladen.** De app meldt: *2 herstelbestanden konden niet worden geladen en zijn overgeslagen.* Bij één bestand staat er *1 herstelbestand kon niet worden geladen en is overgeslagen.* De andere projecten zijn hersteld. Overgeslagen kopieën blijven bewaard. Op desktop mogen oude kopieën van wel herstelde projecten verdwijnen zodra nieuwe herstelkopieën veilig zijn vastgelegd; de overgeslagen kopieën blijven staan. De browser houdt de oude herstelset vast. Verschijnt het venster opnieuw, kies dan alleen *Niet herstellen* als je zeker weet dat je de resterende kopieën niet meer nodig hebt.

## Zie ook

- [Bestanden en formaten](docs://uitleg-bestanden): opslaan, automatisch opslaan en crashherstel naast elkaar.
- [Automatisch opslaan aanzetten](docs://howto-automatisch-opslaan): je bestand zelf laten bijwerken.
- [Een bestand openen en opslaan](docs://howto-bestand-openen-en-opslaan): opslaan na het herstellen.
- [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen): wat er met een project in die weergave gebeurt.
