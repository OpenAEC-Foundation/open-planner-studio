# Een vast bedrag toekennen

Doel: een vast bedrag op een taak zetten, zoals leges voor een vergunning, een keuring of een huurprijs, zonder uren of inzet.

## Wanneer je dit nodig hebt

Niet elke kostenpost is werk. Een omgevingsvergunning kost een vast bedrag, ook als niemand er een uur aan werkt. Daarvoor is het resourcetype *Kosten*. Een kostenresource heeft alleen een bedrag per toewijzing. Hij heeft geen tarief, geen *Max. eenheden*, geen kalender, geen eenheid en geen ploeg.

Een kostenresource telt niet mee voor de belasting, de overbezetting, het histogram of het nivelleren. Hij verandert de duur van de taak nooit, ook niet onder het taaktype *Vast werk*. Een bedrag wijzigen maakt de planning niet verouderd: je hoeft niet te herberekenen.

Voorbeeld: de taak *Vergunning aanvragen* krijgt de kostenresource *Leges gemeente* met een bedrag van 1250,55. De mijlpaal *Oplevering* krijgt de kostenresource *Opleverkeuring* met 450. In het resourcepaneel staat in de kolom *Totaal* de som van de bedragen per kostenresource.

## Stappen

### De kostenresource maken

1. Kies het tabblad *Resources* en maak een nieuwe resource (zie [Resources beheren](docs://howto-resources-beheren)).
2. Kies in de kolom *Type* de waarde *Kosten*. De velden die niet bij kosten horen, tonen een streepje (—).

### Het bedrag toekennen

1. Selecteer de taak of de mijlpaal.
2. Kies in het paneel *Eigenschappen*, blok *Toewijzingen*, bij *Resource toewijzen* de kostenresource. Via *Resources › Toewijzing › Toewijzen ▾* kan het ook; voor een kostenresource vraagt het venster geen inzet en geen curve.
3. Typ in de kolom *Inzet* van die regel het bedrag en druk op Enter. Bij een kostenresource is dat veld het bedrag.

Een bedrag van 0 is geldig. Maak je het veld leeg, dan heeft de toewijzing geen bedrag meer. In de kolom *Werk (u)* staat een streepje: een kostenresource heeft geen werk. Klik je op de naam, dan zie je geen curve en geen *Urenverdeling…*; *Verplaats naar…* werkt wel.

## Valkuilen en wat de app dan doet

**Type wisselen met toewijzingen.** Heeft een resource toewijzingen, dan kun je het type niet wisselen tussen *Kosten* en een ander type. De keuze staat dan uitgeschakeld. Verwijder eerst de toewijzingen.

**Resourcebibliotheek.** Wil de bibliotheek het type van een resource met toewijzingen wisselen tussen *Kosten* en een ander type, dan blijft het type in het project zoals het is. De resource staat dan als afwijkend van de bibliotheek, en de app meldt waarom.

**Mijlpalen.** Op een mijlpaal kun je alleen een kostenresource toewijzen. Een taak met alleen kostenresources kun je een mijlpaal maken; met werk of materiaal erop niet.

**Exporteren.** MS Project XML, Primavera XER en Primavera P6 XML krijgen kostenresources pas in een volgende versie. Bij die exporten laat de app de kostenresources weg, met hun toewijzingen en bedragen, en meldt hoeveel. Het IFC-bestand bewaart ze wel.

**Geen valuta.** Het bedrag heeft geen valutateken, net als het tarief.

**Terugdraaien.** Een bedrag wijzigen of wissen kun je met *Ongedaan* (Ctrl+Z) terugdraaien.

## Zie ook

- [Resources beheren](docs://howto-resources-beheren): resources maken en de typen.
- [Resources toewijzen met een curve](docs://howto-resource-toewijzen): werk en materiaal toewijzen.
- [Resourcepaneel](docs://ref-resourcepaneel): de kolom *Totaal* en de andere velden.
