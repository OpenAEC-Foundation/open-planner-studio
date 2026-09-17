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
| `werkdagen-as-ontwerp.md` | naslag; aangehaald vanuit `timeAxis.ts`, `workdayAxis.ts` en `check-workday-axis.ts` |
| `verticale-drag-ontwerp.md`, `verticale-drag-ontwerp-B.md` | ontwerp; balk-slepen op het canvas is vervallen, rij-slepen bestaat — twee varianten van hetzelfde ontwerp |
| `modulariteit-audit.md`, `prestatie-modulariteit-audit.md` | de audits waar de P-bevindingen uit komen; aangehaald vanuit testkoppen |
| `lagen-en-federatie-conceptplan.md` | conceptplan, niet uitgevoerd |
| `workflows/triple-verify.js` | hulpscript, aangehaald vanuit `docs/TODO.md` |

**`specs/` en `plans/`** — per feature het ontwerp respectievelijk het uitvoerplan. De bestandsnaam
begint met de datum, dus chronologisch bladeren werkt. Documenten van vóór het actieve programma
zijn vooral naslag; de vijf hierboven genoemde bestanden zijn uitvoerwerk. **Bij twijfel wint de
actuele code, behalve wanneer een nog uit te voeren plan juist expliciet een gewenste grens
definieert.**

## Overzicht per stuk (peildatum 2026-09-14, bijgewerkt 2026-09-15)

Volgorde: eerst de levende stukken (specs, plannen, los), daarna de verhuisde stukken.

| stuk | stand | verwijzingen |
|---|---|---|
| `specs/2026-06-05-multi-worktree-dev-isolation-design.md` | naslag (opgeleverd) | 1 |
| `specs/2026-06-26-planning-correctheid-testplan-design.md` | naslag (opgeleverd) | 1 |
| `specs/2026-06-26-snap-packaging-design.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-02-constraints-deadlines-design.md` | naslag (opgeleverd) | 3 |
| `specs/2026-07-02-mijlpalen-design.md` | naslag (opgeleverd) | 3 |
| `specs/2026-07-02-volledige-dependencies-design.md` | naslag (opgeleverd) | 2 |
| `specs/2026-07-02-wbs-structuur-design.md` | naslag (opgeleverd) | 3 |
| `specs/2026-07-03-resources-design.md` | naslag (opgeleverd) | 5 |
| `specs/2026-07-04-baselines-voortgang-design.md` | naslag (opgeleverd) | 3 |
| `specs/2026-07-04-kalenders-design.md` | naslag (opgeleverd) | 3 |
| `specs/2026-07-04-weergaven-design.md` | naslag (opgeleverd) | 2 |
| `specs/2026-07-06-2.8b-research-codebase.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-06-2.8b-research-domein.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-06-2.9-research-codebase.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-06-2.9-research-domein.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-06-geavanceerde-cpm-design.md` | naslag (opgeleverd) | 3 |
| `specs/2026-07-06-uren-scheduling-design.md` | naslag (opgeleverd) | 3 |
| `specs/2026-07-07-2.10-onderdeel4-showcases-design.md` | naslag (opgeleverd) | 2 |
| `specs/2026-07-07-2.10-onderdeel5-docs-design.md` | naslag (opgeleverd) | 2 |
| `specs/2026-07-13-bouwmodus-toggle-design.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-20-move-project-design.md` | naslag (opgeleverd) | 2 |
| `specs/2026-07-22-vector-pdf-export-design.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-23-b1-1-bedrijfscentrisch-model-design.md` | naslag (opgeleverd) | 2 |
| `specs/2026-07-23-dev-server-dual-guard-prevention-design.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-24-github-wiki-design.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-24-mcp-bridge-design.md` | naslag (opgeleverd) | 2 |
| `specs/2026-08-14-b1b-bezettingsoverzicht-design.md` | naslag (opgeleverd) | 5 |
| `specs/2026-08-14-mijlpaal-relaties-design.md` | naslag (opgeleverd) | 1 |
| `specs/2026-08-14-rapport-code-inventaris.md` | naslag (opgeleverd) | 1 |
| `specs/2026-08-14-rapport-critreview-f0.md` | invoer voor lopend XER-werk (etappe 2) | 0 |
| `specs/2026-08-14-rapport-export-opties-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-08-14-rapport-formaat-specs.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-08-14-task-type-inheritance-parent-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-08-17-b1c-nivelleren-restcapaciteit-design.md` | naslag (opgeleverd) | 2 |
| `specs/2026-08-17-datums-zoals-opgeslagen-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-08-18-issue-65-dependency-jump-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-08-18-spec-taaktypes-effort-driven.md` | naslag (opgeleverd) | 1 |
| `specs/2026-08-24-hooksite-ledger.md` | naslag (opgeleverd) | 1 |
| `specs/2026-08-24-onderhoudbaarheidsprogramma-design.md` | actief | 4 |
| `specs/2026-08-24-tabel-overhaul-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-06-24-auto-update-cross-platform.md` | naslag (opgeleverd) | 3 |
| `plans/2026-07-13-browser-bestandstoegang.md` | naslag (opgeleverd) | 2 |
| `plans/2026-07-23-b1-1-bedrijfscentrisch-model.md` | naslag (opgeleverd) | 1 |
| `plans/2026-08-14-f0-brief-definitief.md` | verhuisd naar archief (2026-09-15) | 0 |
| `plans/2026-08-15-plan-mpp-datumgetrouwheid.md` | naslag (opgeleverd) | 3 |
| `plans/2026-08-17-plan-mpp-nul-afwijkingen.md` | naslag (opgeleverd) | 2 |
| `plans/2026-08-24-onderhoudbaarheid-0-bewijspoorten.md` | actief | 0 |
| `plans/2026-08-24-onderhoudbaarheid-1-extensiecontract.md` | actief | 0 |
| `plans/2026-08-24-onderhoudbaarheid-2-store-runtime-isolatie.md` | actief | 0 |
| `plans/2026-08-24-onderhoudbaarheid-3-gantt-grenzen.md` | actief | 0 |
| `plans/2026-09-01-plan-issue27-voortgangsimport.md` | verhuisd naar archief (2026-09-14) | 0 |
| `HANDOFF-2026-08-14-roadmap.md` | actief | 0 |
| `lagen-en-federatie-conceptplan.md` | concept, niet uitgevoerd | 1 |
| `modulariteit-audit.md` | naslag (opgeleverd) | 8 |
| `prestatie-modulariteit-audit.md` | naslag (opgeleverd) | 5 |
| `verticale-drag-ontwerp-B.md` | deels uitgevoerd (rij-slepen wel, balk-slepen op canvas niet) | 0 |
| `verticale-drag-ontwerp.md` | deels uitgevoerd (rij-slepen wel, balk-slepen op canvas niet) | 0 |
| `werkdagen-as-ontwerp.md` | naslag (opgeleverd) | 8 |
| `specs/2026-06-19-ui-modern-overhaul-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-07-07-2.10-onderdeel2-ux-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-07-07-2.10-onderdeel3-firststartup-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-07-07-2.10-sneltoetsen-contextmenu-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-07-13-browser-bestandstoegang-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-07-23-just-updated-dialog-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-08-14-bestandsformaten-ontwerpskelet.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-06-12-store-slices-en-extensies.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-07-23-dev-server-dual-guard-prevention.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-07-23-just-updated-dialog.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-07-24-mcp-bridge-fase1.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-14-mijlpaal-relaties.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-14-mpp-import-etappe-1.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-14-rapport-export-opties.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-14-task-type-inheritance-parent.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-17-datums-zoals-opgeslagen.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-18-issue-65-dependency-jump.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-24-gedeelde-categoriekleuren.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-24-tabel-overhaul-implementation-plan.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-27-b1c-w0-split-bewuste-fundamenten.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-31-b1c-plan2-verdeler-kern.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-09-11-plan-issue27-xlsx-voortgangsblad.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/archief-2026-08-14-f0-brief-concept.md` | verhuisd naar archief (2026-09-14) | 0 |

Betekenis van de standen: **actief** = er wordt nu aan gewerkt of het is het geldende programma;
**naslag** = het werk is gedaan, het stuk blijft als uitleg bij de code;
**deels uitgevoerd** = een deel van het ontwerp bestaat, een deel niet (welk deel staat erbij);
**invoer voor lopend werk** = het stuk zelf is geen actief werk, maar voedt een nog lopende etappe;
**concept** = idee dat niet is uitgevoerd;
**verhuisd naar archief** = op de genoemde datum verplaatst naar
`docs/archive/superpowers/`, omdat het werk erop afgerond was én er nergens meer naar
verwezen werd. Als regel gaat een stuk naar het archief zodra het werk erop afgerond is en
de laatste verwijzing ernaartoe verdwenen is; wat nog loopt of nog aangehaald wordt, blijft staan.
De verwijzingentelling is gemeten op de peildatum over `src/`, `tests/`, `docs/`, `public/` en
`scripts/`, per letterlijke bestandsnaam; het archief en deze tabel zelf zijn buiten de telling
gelaten.

**De vakjes in de werkplannen worden niet bijgehouden.** Vrijwel alle plannen tonen nul
afgevinkte vakjes terwijl het werk wel gedaan is. Leid de voortgang af uit de code en uit de
stand in de tabel hierboven, niet uit de vakjes.

## Verwante mappen

- `docs/onderhoudbaarheid/` — het onderhoudbaarheidsonderzoek en de K-items. Dat is een rapport met
  een peildatum: bevindingen daarin worden niet herschreven als de code verandert.
- `docs/archive/superpowers/` — oudere ontwerpen (zoom, debug-terminal, stijlboek), met dezelfde
  waarschuwing: nuttig voor het waarom, niet voor het wat.
