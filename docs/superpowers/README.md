# `docs/superpowers/`

Ontwerp- en implementatiedocumenten: waaróm iets gebouwd is zoals het gebouwd is. Deze map had geen
overzicht en geen regel, waardoor niet te zien was wat er nog liep en wat allang opgeleverd was
(K-item 40).

## Actief programma (2026-08-24)

Het actuele onderhoudbaarheidsprogramma is nog **niet uitgevoerd**. Lees de documenten in deze
volgorde; de sprong naar alleen taak 1 van Plan 2 is een bewuste contextvoorwaarde voor Plan 1:

1. [`specs/2026-08-24-onderhoudbaarheidsprogramma-design.md`](specs/2026-08-24-onderhoudbaarheidsprogramma-design.md)
2. [`plans/2026-08-24-onderhoudbaarheid-0-bewijspoorten.md`](plans/2026-08-24-onderhoudbaarheid-0-bewijspoorten.md)
3. Plan 2, alleen taak 1:
   [`plans/2026-08-24-onderhoudbaarheid-2-store-runtime-isolatie.md`](plans/2026-08-24-onderhoudbaarheid-2-store-runtime-isolatie.md)
4. [`plans/2026-08-24-onderhoudbaarheid-1-extensiecontract.md`](plans/2026-08-24-onderhoudbaarheid-1-extensiecontract.md)
5. Plan 2, taken 2 en verder.
6. [`plans/2026-08-24-onderhoudbaarheid-3-gantt-grenzen.md`](plans/2026-08-24-onderhoudbaarheid-3-gantt-grenzen.md)

De visuele nulmeting staat in
[`docs/onderhoudbaarheid/audit-2026-08-24.html`](../onderhoudbaarheid/audit-2026-08-24.html).

## De regel

| waar | wat |
|---|---|
| `docs/superpowers/` | het ontwerp waar nu aan gewerkt wordt, of dat als naslag bij de code hoort |
| `docs/archive/superpowers/` | opgeleverd én niet meer aangehaald |
| `docs/archive/handoffs/` | verbruikte sessie-draaiboeken |

**Een document verhuist pas als óók zijn verwijzingen meeverhuizen.** Dat is geen slag om de arm maar
de reden dat er nu niet meer verplaatst is dan hieronder staat — zie *Wat er gemeten is*.

## Wat er gemeten is (2026-08-17)

Drie dingen nagekeken, want het rapport ging uit van "het overgrote deel is opgeleverd" en dat klopt,
maar de conclusie "dus verplaatsen" niet zomaar:

1. **De toenmalige 44 documenten in `specs/` en `plans/` beschreven functionaliteit die aantoonbaar
   in de code zat.** Per document is een distinctief spoor gecontroleerd (een bestand of een symbool
   dat alleen bestaat als de functie er is): 44 van de 44. Dit was de stand op 2026-08-17; het
   actieve programma hierboven is later toegevoegd en valt nadrukkelijk niet onder die conclusie.
2. **De afvinkvakjes in de plannen zijn waardeloos als signaal.** Alle negen plannen hebben nul
   afgevinkte en tientallen open vakjes, terwijl de functies wél bestaan. Ze zijn nooit bijgehouden.
   Gebruik ze niet om te bepalen wat af is; de code is het bewijs.
3. **Ongeveer vijftig plekken in `src/`, `tests/` en `docs/` verwijzen naar bestanden hier**, met een
   pad in een commentaarregel — `src/types/task.ts` naar het constraints-ontwerp,
   `src/services/mcp/contracts.ts` naar het MCP-ontwerp ("normatief"), `src/engine/renderer/timeAxis.ts`
   naar het werkdagen-as-ontwerp, en zo verder. Die verwijzingen zijn de reden dat de documenten
   waarde houden: ze verbinden een regel code aan de afweging erachter.

Een blinde verhuizing van alle 44 zou dus vijftig pointers in code en tests breken. Dat is een
grotere ingreep dan het item vermoedt, en hij levert pas iets op als de referenties in dezelfde beweging
meegaan. Verplaats daarom per document, samen met zijn verwijzingen — niet per map.

Wél verplaatst, omdat ze nergens meer bij horen:

- `HANDOFF-2026-07-20-poorten-ongedraaid.md` → `docs/archive/handoffs/`. Opent met *"AFGEWERKT — dit
  draaiboek is verbruikt; alleen nog van historisch belang."* Dat is niet voor tweeërlei uitleg vatbaar.
- `docs/HANDOFF-mcp-bibliotheek-snap.md` → `docs/archive/handoffs/`. Sessie-draaiboek waarvan de kop
  zelf zegt dat alles op `main` staat.

## Wat er staat

**Losse documenten (map-niveau)**

| document | status |
|---|---|
| `HANDOFF-2026-08-14-roadmap.md` | **actief** — wat er nog op de roadmap staat, met peildatum en afhankelijkheden |
| `specs/2026-09-04-spec-taaktypes-opgeslagen-werk.md` | **actief ontwerp, nog niet gebouwd** — taaktypes/werkregels, opgeslagen werk per toewijzing en effort-driven bewerken; opvolger van `specs/2026-08-18-spec-taaktypes-effort-driven.md`. Bevat de MSP/P6-documentatievergelijking, de regeltabel, de meetlat (28 bewerkingen) en drie open beslispunten (8–10). Bouwt pas ná de tweede XER-merge. |
| `werkdagen-as-ontwerp.md` | naslag; aangehaald vanuit `timeAxis.ts`, `workdayAxis.ts` en `check-workday-axis.ts` |
| `verticale-drag-ontwerp.md`, `verticale-drag-ontwerp-B.md` | naslag; twee varianten van hetzelfde ontwerp |
| `modulariteit-audit.md`, `prestatie-modulariteit-audit.md` | de audits waar de P-bevindingen uit komen; aangehaald vanuit testkoppen |
| `lagen-en-federatie-conceptplan.md` | conceptplan, niet uitgevoerd |
| `workflows/triple-verify.js` | hulpscript, aangehaald vanuit `docs/TODO.md` |

**`specs/` en `plans/`** — per feature het ontwerp respectievelijk het uitvoerplan. De bestandsnaam
begint met de datum, dus chronologisch bladeren werkt. Documenten van vóór het actieve programma
zijn vooral naslag; de vijf hierboven genoemde bestanden zijn uitvoerwerk. **Bij twijfel wint de
actuele code, behalve wanneer een nog uit te voeren plan juist expliciet een gewenste grens
definieert.**

## Verwante mappen

- `docs/onderhoudbaarheid/` — het onderhoudbaarheidsonderzoek en de K-items. Dat is een rapport met
  een peildatum: bevindingen daarin worden niet herschreven als de code verandert.
- `docs/archive/superpowers/` — oudere ontwerpen (zoom, debug-terminal, stijlboek), met dezelfde
  waarschuwing: nuttig voor het waarom, niet voor het wat.
