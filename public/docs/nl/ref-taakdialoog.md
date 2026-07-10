# Taakdialoog

Het venster **Taak bewerken** toont alle eigenschappen van één taak — dezelfde velden en secties als het eigenschappenpaneel rechts, maar dan in een venster met een expliciete opslag-stap.

## Openen

- **Dubbelklik** op een taak in de Gantt.
- **F2** met een geselecteerde taak.
- **Rechtsklik** op een taak → **Bewerken...**

## Opslaan en annuleren

- **Opslaan** past alle veld-wijzigingen in één keer toe; de knop is uitgeschakeld zolang de naam leeg is. **Enter** doet hetzelfde als Opslaan (behalve in een tekstvak met meerdere regels).
- **Annuleren**, **Esc**, het kruisje of een klik buiten het venster sluit zonder de veld-wijzigingen toe te passen.
- Uitzondering: de secties **Afhankelijkheden**, **Toewijzingen** en **Codes & velden** werken rechtstreeks op de planning (identiek aan het paneel) — wijzigingen daar zijn direct van kracht, ook als je daarna annuleert.

## Velden

- **Naam *** — verplicht; krijgt bij het openen automatisch de focus.
- **WBS Code** — vrij invulbaar. Staat WBS-autonummering aan (Planning → Structuur), dan is het veld vergrendeld: de app beheert de codes.
- **Beschrijving** — vrije tekst.
- **Type** — het taaktype (bijvoorbeeld Bouw); stuurt de balk-kleurcodering.
- **Kalender** — **Projectkalender** of een specifieke kalender uit de bibliotheek; bepaalt de werkdagen van deze taak.
- **Bovenliggende taak** — verplaats de taak onder een andere ouder, of **- Geen (root) -**. Dit veld bestaat alleen in de dialoog; in het paneel gaat herstructureren via slepen of in-/uitspringen.

## Aantekeningen

Een checklist per taak: per regel een **afvink-hokje**, een tekstvak en een verwijderknop; **aantekening toevoegen** maakt een nieuwe regel. Afgevinkte regels worden doorgestreept. Zie [Plannen & WBS](docs://gids-plannen-wbs).

## Mijlpaal

- **Mijlpaal** — aanvinken zet de duur op 0 en toont de ruit in plaats van een balk.
- **Soort mijlpaal** — **Automatisch**, **Startmijlpaal** of **Eindmijlpaal**.
- **Verplicht (contractueel)** — markeert de mijlpaal als contractueel.

## Tijd

- **Startdatum** — toont de berekende vroegste start; een handmatige wijziging verankert de nieuwe datum als gepland startpunt.
- **Duur (werkdagen)** — hele werkdagen; uitgeschakeld voor een mijlpaal.
- Met **Urenplanning ingeschakeld** én een uur-kalender op de taak verschijnen drie gesynchroniseerde vakjes: **Dagen**, **Uren** en **Totaal uren** (alleen hele getallen). Zonder uur-kalender toont een hint: "Uren-invoer vereist een uur-kalender (werktijden)." Zie [Kalenders & uren-planning](docs://gids-kalenders-uren).

## Hammock (afgeleide duur)

Alleen op een taak zonder subtaken die geen mijlpaal is. Aanvinken maakt de duur afgeleid: de span tussen de **Start-driver** (inkomende FS/SS-relatie) en de **Finish-driver** (inkomende FF/SF-relatie), beide read-only getoond. Ontbreekt een finish-driver, dan meldt de dialoog dat de span terugvalt op nul-lengte. Zie [Kritiek pad & geavanceerde analyse](docs://gids-kritiek-pad-analyse).

## Constraint en deadline

- **Constraint** — Zo vroeg mogelijk (ASAP), Zo laat mogelijk (ALAP), Start niet eerder dan (SNET), Start niet later dan (SNLT), Eindig niet eerder dan (FNET), Eindig niet later dan (FNLT), Moet starten op (MSO) of Moet eindigen op (MFO); met **Constraint-datum** waar van toepassing.
- **Verplicht (pin logica)** — alleen bij MSO/MFO: pint de datum hard en overschrijft de relatie-logica; overtreding wordt negatieve speling stroomopwaarts.
- **Secundaire constraint** — een tweede grens (SNET/FNET/SNLT/FNLT) met **Secundaire datum**; niet mogelijk bij een harde pin. Verboden combinaties kleuren rood met een reden.
- **Deadline** — een streefdatum los van de berekening; overschrijding geeft een waarschuwing, geen verschuiving. Zie [Relaties & constraints](docs://gids-relaties-constraints).

## Voortgang

- **Voortgang (%)** — schuifregelaar 0–100%.
- **Werkelijke start** / **Werkelijke einde** — vastgelegde feiten; bij een mijlpaal één veld **Werkelijke datum**. Datums ná de statusdatum worden geweigerd.
- **Resterend (werkdagen)** — read-only, afgeleid van duur × (1 − voortgang). Zie [Baselines & voortgang](docs://gids-baselines-voortgang).

## CPM Resultaat (read-only)

**Vroegste start/einde**, **Laatste start/einde**, **Totale speling**, **Vrije speling**, **Interfererende speling** (indien berekend) en **Kritiek pad** (ja/nee). Gevuld na een berekening (F5).

## Afhankelijkheden

Alle relaties van deze taak: richting (→ opvolger, ← voorganger), de andere taak, een bliksem-icoon bij de **bepalende relatie (driving)**, het relatietype (FS/SS/FF/SF), de **lag** (bv. 2d, 3ed, 50%) en een verwijderknop. Wijzigingen zijn direct van kracht.

## Toewijzingen

Per toegewezen resource: naam, **Eenh./dag**, **Curve**, **Verplaats naar…** (verplaats de toewijzing naar een andere taak) en verwijderen; onderaan **Resource toewijzen**. Niet mogelijk op mijlpalen of samenvattingstaken. Direct van kracht. Zie [Resources, histogram & nivellering](docs://gids-resources-histogram).

## Codes & velden

Alleen zichtbaar als het project activity-codetypes of gebruikersvelden heeft: per codetype een waarde-keuze, per gebruikersveld een getypeerde invoer. Direct van kracht. Definities beheer je in de structuurdialoog — zie [Codes & velden](docs://ref-codes-velden).
