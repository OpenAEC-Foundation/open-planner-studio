# Waarschuwingenpaneel

De statusbalk telt wat er mis is met de planning: overschreden deadlines, geschonden constraints, out-of-sequence-relaties en overbezette resources. Het **Waarschuwingenpaneel** laat de details zien: één lijst met elke afzonderlijke waarschuwing, en met één klik sta je bij de betreffende taak, relatie of resource.

## Openen en sluiten

- Klik op een van de gele tellers in de statusbalk — bijvoorbeeld **⚠ 2 deadline(s) overschreden**.
- Of via het lint: **Beeld → Panelen → Waarschuwingen**, of **Planning → Planning → Waarschuwingen**, naast **Bereken**.
- Het paneel verschijnt onderin de rechterzijkolom, onder Eigenschappen en het Resourcedock. Sleep de rand erboven om de hoogte te veranderen; die hoogte wordt onthouden.
- Sluiten doet u met het kruisje in de kopbalk of opnieuw met de lintknop. Het paneel staat bij het opstarten altijd uit.

## Wat er in de lijst staat

Alles komt uit de laatste berekening (F5) en de daaruit afgeleide resourcebelasting; het paneel rekent zelf niets. Fouten staan bovenaan, daarna de waarschuwingen per soort, in de volgorde van de taken in uw planning.

- **Planning kon niet worden berekend** — een fout, zoals een cirkelrelatie of een kalender zonder werkdagen. Bij een cirkel staan de betrokken taken erbij.
- **Deadline overschreden** — de vroegste einddatum van de taak valt na de deadline. De rij noemt beide datums.
- **Constraint overschreden** — een "niet later dan"- of "moet op"-constraint wordt door de logica weggedrukt; de taak heeft negatieve speling.
- **Out-of-sequence** — de opvolger heeft voortgang die de relatie tegenspreekt (bijvoorbeeld al gestart terwijl de voorganger nog niet klaar is).
- **Lead afgekapt** — een negatieve lag wilde de opvolger vóór de projectstart trekken; de relatie is niet volledig benut.
- **Relatie genegeerd** — de relatie raakt geen bladtaak en telt niet mee in de berekening.
- **Hammock zonder eind-driver** — een hammocktaak zonder FF- of SF-voorganger; de duur valt terug op nul.
- **Einddatum afgekapt** — de kalender laat voor deze taak geen werkbaar venster over.
- **Overbezet** — een resource is op een of meer dagen zwaarder ingezet dan zijn capaciteit. De rij noemt het aantal dagen en de eerste en laatste dag.

Staat er **Geen waarschuwingen**, dan voldoet de planning aan alle controles. Is er nog nooit berekend, dan biedt het paneel de knop **Bereken** aan.

## Naar het probleem springen

Klik op een rij, of ga er met Tab naartoe en druk op Enter.

- **Taak** — de taak wordt geselecteerd, ingeklapte bovenliggende taken klappen uit en de Gantt zoomt en scrolt ernaartoe. Het eigenschappenpaneel toont de taak.
- **Relatie** — beide taken worden geselecteerd, met de opvolger als actieve taak. In het eigenschappenpaneel staat de relatie onder **Afhankelijkheden**.
- **Resource** — alle taken waaraan deze resource is toegewezen worden geselecteerd (hun balken lichten op), en de histogramstrook onder de Gantt gaat aan en toont precies deze resource, zodat u de overbezette dagen ziet.
- **Cirkelrelatie** — alle taken in de cirkel worden geselecteerd; de Gantt springt naar de eerste.

Op het tabblad **Tabel** wordt de taak in de tabel geselecteerd; de Gantt maakt de sprong zodra u terugschakelt.

## Verouderde lijst

Wijzigt u taken zonder opnieuw te berekenen, dan verschijnt een geel driehoekje in de kop van het paneel: de lijst hoort nog bij de vorige berekening. Klik op **Bereken** of druk op F5. Rijen die inmiddels een verwijderde taak, relatie of resource betreffen, verdwijnen vanzelf.

## Verder lezen

- Wat deadlines en constraints precies doen: de gids [Relaties & constraints](docs://gids-relaties-constraints).
- Overbezetting oplossen met nivelleren en het histogram: de gids [Resources & histogram](docs://gids-resources-histogram).
- Zie het deadline-conflict in de praktijk: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
