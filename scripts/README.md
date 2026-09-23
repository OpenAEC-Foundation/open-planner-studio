# `scripts/`

Alles wat buiten de app draait: de dev-server-poortverdeling, de generatoren, de verify-poorten en
de release-hulpjes. Deze map had geen overzicht, waardoor niet te zien was wat er nog gebruikt werd
en wat een eenmalige klus was — dit bestand is dat overzicht (K-item 40).

**Regel:** wat hier staat, wordt aangeroepen. Blijft er iets over dat één keer gedraaid heeft en zijn
werk gedaan heeft, dan hoort het weg en niet "voor het geval dat" te blijven staan. Bij het schrijven
van dit bestand gold dat voor `i18n-apply-wave6.mjs` + `i18n-translations-wave6.mjs` (646 regels,
eenmalige vertaalgolf, nergens aangeroepen); die zijn verwijderd. De git-historie bewaart ze.

## Dev-server en poortverdeling

Deze vier horen bij elkaar en dragen de multi-worktree-isolatie: elk worktree krijgt een eigen vaste
poort, en een tweede start in hetzelfde worktree wordt geweigerd in plaats van stilletjes een andere
poort te pakken. Zie de kop van `CLAUDE.md` en `tests/dev-server/` voor het geheel.

| script | aangeroepen door | doet |
|---|---|---|
| `dev-server.mjs` | `npm run dev` | wijst de poort toe, claimt het guard-slot, stempelt `.claude/launch.json`, start dan pas Vite |
| `tauri-dev.mjs` | `npm run tauri:dev` | idem, plus `tauri dev` met een matchende `--config`-devUrl en `OPS_DEV_*` in de env |
| `dev-port.mjs` | de twee hierboven | poorttoewijzing verankerd aan de worktree-root (3007–3106) |
| `dev-lock.mjs` | de drie hierboven | flock-gebaseerd guard-slot tegen dubbelstart |
| `dev-bootstrap.mjs` | een Claude Code SessionStart-hook (staat in `.claude/`, niet in de repo) | stempelt bij het openen van een sessie alvast de poort van dít worktree in `.claude/launch.json`. Zelf-scopend (no-op in een ander project), idempotent, faalt zacht |

## Poorten (draaien mee in `npm run verify`)

| script | npm-script | doet |
|---|---|---|
| `i18n-diff.mjs` | `verify:i18n` | ontbrekende vertaalsleutels t.o.v. `nl`, met CLDR-pluralcategorieën |
| `verify-text-roles.mjs` | `verify:text-roles` | tekstgroottes lopen uitsluitend via de zes tekstrollen (`text-caption` … `text-title` / `var(--text-…)`); keurt kale px/rem-font-sizes, `text-[Npx]`, Tailwinds eigen schaal en inline `fontSize` in `src/` af (niet in `engine/`/`services/`) |
| `verify-cycles.mjs` | `verify:cycles` | circulaire imports binnen `src/`, gemeten op de esbuild-metafile (dus ná type-erasure — `import type` geeft geen valse treffers) |
| `verify-docs.ts` | `verify:docs` | de in-app gidsen in `public/docs/`: manifest-dekking, weesbestanden, `docs://`/`examples://`-links, en of de inhoud binnen de mini-Markdown-subset blijft; bewaakt daarnaast dat `.claude/skills/goed-plannen/SKILL.md` byte-identiek is aan de bron `public/skills/goed-plannen/SKILL.md` |
| `verify-examples.ts` | `verify:examples` | de gebundelde voorbeeldprojecten laden en rekenen door zoals verwacht |
| `verify-conventions.mjs` | `verify:conventions` | AST-poort van de rekenprofielen (ook aangeroepen door `tests/planning/check-conventions-boundary.ts`): de motor (`src/engine/` plus de motorhelper `src/utils/p6SuspendResume.ts`) leest geen bronformaat (`p6Source`/`importFormat`/`readFormat`/`xerSourceProjectId`/`xerSourceArchive`/`xerImportMetadata`, ook via string-index, `in` of destructuring; geen lezer-, `formatRegistry`- of `xerSourceArchive`-imports en geen niet-letterlijke dynamische imports); herkomst-datagates (ook via destructuring en `in`) gepind in `verify-conventions.datagates.json`, alleen omlaag (`--write-baseline` herpint, alleen als alles groen is). Een optionele `verify-conventions.allowlist.json` kan overgangscode tijdelijk vrijstellen (alleen namen, alleen bestaande bestanden, reden met de overgangsmarkering); in de eindstand bestaat hij niet |

## Voorbeeldprojecten genereren

`npm run gen:examples` → `generate-examples.ts`. De rest is de generator eronder en wordt niet los
aangeroepen:

- `gen-core.ts` — de generator zelf
- `spec.ts` — de gedeelde vorm waar alle generatoren op leunen
- `showcases.ts` / `showcase-groot.ts` — de projectdefinities
- `example-resources.ts` — de resourcepool
- `example-topologies.json` — de relatienetwerken (117 kB data, geen code)

## Meetlatdata genereren

`node scripts/generate-p6-verified-cases.mjs <p6-comparison-map>` schrijft
`tests/planning/cases-p6-verified.json` opnieuw uit de publieke P6 23.12-capture. Alleen
`activity_code` en de `*_p6`-kolommen komen mee; kloktijden en actual-suffixen blijven onvertaald.
De `*_engine`-kolommen en PASS-oordelen zijn uitdrukkelijk geen brondata voor deze generator.

## Regel A: landingsmeting per rekenprofiel (corpusgebonden, niet in `verify`)

`npm run measure:profiles` → `measure-profiles.mjs` (oordeelsfuncties in `measure-profiles-status.mjs`,
corpusloos getoetst in `tests/dev-server/measure-profiles.test.mjs`). De landingspoort voor elke
motorwijziging (rekenprofielen-spec §2 besluit 5, §5): draait elk onderdeel als eigen
`bash tests/planning/run.sh <check>` en print per profiel exitcode, tellingen en cel-delta.
Kindprocessen krijgen nooit `OPS_XER_CELLS_WRITE`, `OPS_XER_FIDELITY_REPORT` of
`OPS_MPP_FIDELITY_REPORT` mee. `--only=p6|msp|vangrails` draait één onderdeel.

| onderdeel | check | oordeel |
|---|---|---|
| P6-profiel | `check-xer-product-fidelity-x12.ts` mét `OPS_XER_CORPUS` | cel-poort op `tests/planning/xer-product-fidelity-cells.json` over zeven poortassen: de zes X12-assen plus `drivingPath` als zevende poort-as (cel-ratchet; niet in het zesassige nuldoel-getal). Exact → inexact of een verslechterde emmer (exact < sameday < diff < missing) is rood. **Grootte-ratchet** (cellenbestand versie 2, eigenaarsbesluit 2026-09-23): elke `sameday`/`diff`-cel op de zes X12-assen draagt zijn absolute afwijking `\|ours − truth\|` in minuten (datum-assen: wandklokminuten; tf/ff: floatminuten; afgerond op 0,001 — en tf/ff tellen alleen als afwijking als hun verschil op die raster niet naar 0 afrondt: `FLOAT_EXACT_TOLERANCE_MIN` in `fidelityCore.ts`, eigenaarsbesluit in afwachting (§1d-9, branch `claude/x12-tolerantie-vraag9`); `missing` en `drivingPath` zonder grootte) — een cel die in baseline én meting dezelfde emmer `sameday`/`diff` heeft en nu GROTER afwijkt is rood (`groter`), kleiner telt apart als verbeterd-grootte (`kleiner`). De cel-deltaregel luidt `CELLDELTA p6 nieuw=… verslechterd=… groter=… verbeterd=… kleiner=… onmeetbaar=… onbekend=… ongemeten=… schuld=… totaal=…`; een regel zonder `groter=`/`kleiner=`/`schuld=` is onleesbaar en dus rood. `schuld=N` is de ratchet-schuld (zie hieronder): informatief, NULDOEL blijft mogelijk bij `groter=0`; de check zelf is rood als de schuld stijgt. Niet rood zijn alleen: GROEN (exit 0); NULDOEL (uitsluitend de drie nuldoelregels rood, cel-poort groen, `groter=0 kleiner=0`); VERBETERD (daarnaast alleen de v2-gelijkheidsregel rood en cel-delta `nieuw=0 verslechterd=0 groter=0 onmeetbaar=0 verbeterd>0`: exit 0, maar commit alleen mét herpin v2 + cellen, zie hieronder); VERBETERD (grootte) (geen v2-afwijking, `groter=0 kleiner>0`: exit 0, maar commit alleen mét herpin van de cellen — de v2-payload en de gate-pins tellen emmers en veranderen niet; de cellenherpin werkt alleen `cellMinutesSha256` in de v2-envelop mee bij, zie *Minuten-digest* hieronder). Een cel die niet meer meetbaar is (blinder orakel) telt nooit als verbeterd maar als `onmeetbaar` en is rood; meetbaarheid en dekking per entry/as worden daarnaast apart tegen v2 vergeleken (`X12 meetbaarheid/dekking wijkt af van v2`, altijd rood). `--strict` maakt een rode nuldoelregel rood |
| MS Project-profiel | `check-mpp-fidelity.ts` | `GOAL_ZERO_DEVIATIONS` en de 216 tellingenpins; het orakel meet alleen start en einde (twee assen) en staat op nul, dus elke pin is al een cel-poort. Nul gescande bestanden is `ROOD (niet gemeten)` |
| vangrails | `check-xer-corpusless-fidelity-gate.ts`, `check-fidelity-cells-gate.ts` | corpusloos: v2-karakterisering, cel-baseline canoniek, versie 2, grootte op precies de sameday/diff-cellen van de zes assen, in de pas met de v2-tellingen, grootten gelijk aan `cellMinutesSha256` in de v2-envelop, schuldset gelijk aan de gepinde digest; plus de synthetische ratchetbewijzen (groter ⇒ rood, kleiner ⇒ verbeterd-grootte) en mutanten op het gecommitte bestand (15e schuldcel, ingekorte/geruilde schuldlijst, schuldcel of gewone cel met de hand groter, ontbrekende schuldsectie ⇒ rood) |
| `--full` (optioneel) | de volledige `run.sh`, zonder `OPS_XER_CORPUS` | standaard uit: draait al in `npm run verify`, en machinebreed hoort er maar één zware run tegelijk te lopen |

Exit 1 zodra één onderdeel rood is; logs per onderdeel in een tijdelijke map (pad staat in de
uitvoer).

**Herpinnen na een VERBETERD-uitslag** — zes stappen, in deze volgorde, alles in één commit:

```bash
export OPS_XER_CORPUS=/pad/naar/testdata-crawl
# 1. de v2-tellingen
OPS_XER_V2_WRITE=1 bash tests/planning/run.sh check-xer-product-fidelity-x12.ts
# 2. de cellen
OPS_XER_CELLS_WRITE=1 bash tests/planning/run.sh check-xer-product-fidelity-x12.ts
# 3. de EXPECTED-pins van de corpusloze CI-vangrail (productStrict-tellers + payload-hashes)
OPS_XER_GATE_PINS=write bash tests/planning/run.sh check-xer-corpusless-fidelity-gate.ts
#    ...en werk de HERPIN-toelichting boven `productStrict` in dat bestand met de hand bij
# 4. de vangrails moeten nu groen zijn
bash tests/planning/run.sh check-xer-corpusless-fidelity-gate.ts check-fidelity-cells-gate.ts
# 5. de tweede-orde pins (geen schrijfmodus; met de hand, zie hieronder), daarna deze twee groen
bash tests/planning/run.sh check-xer-schedule-options-corpus.ts check-xer-task-replay.ts
# 6. xer-product-fidelity-baseline-v2.json, xer-product-fidelity-cells.json,
#    check-xer-corpusless-fidelity-gate.ts en de onder 5 bijgewerkte pins samen committen
```

**Stap 5 — de tweede-orde pins** (bij brok 2 vergeten; `test:planning` mét corpus staat anders rood
op regels BUITEN het nuldoel). Beide hebben geen schrijfmodus; herpin met de hand, met een
`Herpin <datum> (…)`-toelichting boven de betreffende `eq` in de check:
- `tests/planning/xer-schedoptions-blast-radius.json` (`check-xer-schedule-options-corpus.ts`).
  **Wat hij bewaakt: de DETECTIE en bedrading van de XER-lezerdefaults op de bestanden zonder
  SCHEDOPTIONS-rij — geen P6-getrouwheid.** Vergeleken worden: de onafhankelijke raw/scanner-populatie,
  de reader-/wiring-/projectvergelijkingstellers, de uit alle SCHEDOPTIONS-rijen herleide instellingen
  (`schedOptionsRows`), de 27-kolommenunion, de expected-finish-variant (per bestand/as/populatie en
  richting), de torture-pin op late starts, en één struikeldraad: de defaults-fidelity telt alleen op
  manifest-orakels (`role: oracle`/`included: true`) en die populatie bevat geen enkel orakel, dus de
  check eist 0 meetbaar op alle zes assen — komt er een orakel zonder SCHEDOPTIONS bij, dan is hij rood
  en hoort er een echte meetlat bij. **Niet** (meer) gepind, sinds de fixronde van de critreview
  integratie-eindstand (2026-09-23): de bewegingsvectoren (`files[].xerDefaultsMovement`,
  `files[].defaults[].movement`), de 0-projectie `causalProductEffects` en het `fidelity`-blok. Die werden
  niet vergeleken (mutant 0 → 99999 bleef groen) en maten P3-/generatorbestanden; een structuurregel
  ("geen dode pinnen") houdt ze uit het bestand. Sinds v10 worden de overige waarden in `files[]` (de
  negatieve-floattellingen per defaultset, gekozen/tegenvariant) mét corpus per bestand exact tegen de
  meting vergeleken. Toeschrijving: een kapotte lezerdefault wordt gevangen door de onafhankelijke
  handlijst (uitzondering "concrete SCHEDOPTIONS-afleiding wijkt af"), niet door deze pin; de
  blast-radius-pin is een struikeldraad voor structuur en populatie.
  Herpinnen: `OPS_XER_SCHEDOPTIONS_REPORT=baseline bash tests/planning/run.sh check-xer-schedule-options-corpus.ts`
  print de verse meting als JSON (zonder `fidelity`); neem alleen de rijen over die de rode regel noemt,
  met een `Herpin <datum> (…)`-toelichting in de check. Criterium: de detectie- en populatietellers
  veranderen alleen bij een bewuste lezerwijziging of een gewijzigd manifest; beweegt er iets anders ⇒
  niet herpinnen, uitzoeken.
- `tests/planning/xer-task-replay-public-pin.json` (`check-xer-task-replay.ts`, o.a. de negatieve
  kandidaat `drop-p6-relation-finish-boundary` (B1; sinds de populatiewijziging van 2026-09-23, daarvoor
  A17 `drop-p6-finish-milestone-boundary`, die op de nieuwe populatie inert is)). Dit pint DETECTIEVERMOGEN: een mutant die meer
  exacte cellen breekt is de verwachte richting na een verbetering. Criterium: per as blijft de som
  `regressed + unchanged` gelijk (alleen de verdeling schuift), assen die de wijziging niet raakt
  blijven gelijk. Een kleinere som of een detectieverlies ⇒ niet herpinnen, uitzoeken.

Stap 1 en 2 eindigen zolang het nuldoel niet gehaald is met exit 1 op precies de drie
nuldoelregels; dat is verwacht. Kijk naar de regel `OK  X12 v2-baseline herpind` resp. `OK  X12
cel-baseline herpind`. Beide schrijven atomair (tijdelijk bestand + rename) en alleen als de meting
verder schoon is: naast de drie nuldoelregels geen enkele rode regel — geen nieuwe, verslechterde
of onmeetbaar geworden cel, geen gewijzigde drivingPath-orakelhash, geen meetbaarheids-,
dekkings- of `schemaFingerprint`-afwijking t.o.v. v2 (een orakel dat verschuift is geen
verbetering). Anders weigeren ze en blijft het bestand onaangeroerd. De v2-stap gaat vóór de
cellen omdat `check-fidelity-cells-gate.ts` eist dat de cellen per entry/as/emmer optellen tot de
v2-tellingen. Stap 3 schrijft uitsluitend de uit v2 afgeleide pinnen (`OPS_XER_GATE_PINS=print`
toont ze zonder te schrijven); zonder die stap staat `npm run verify` na een verbetering rood.
De cel-herpin weigert ook bij één `groter`-cel (grootte-ratchet).

**Herpinnen na VERBETERD (grootte)** — alleen stap 2 (`OPS_XER_CELLS_WRITE=1`) en daarna stap 4:
kleinere cellen binnen dezelfde emmer veranderen geen enkele v2-telling of gate-pin. De cellenherpin
schrijft wel `cellMinutesSha256` in de envelop van `xer-product-fidelity-baseline-v2.json` bij (de
payload blijft byte-gelijk); commit beide bestanden samen.

**Minuten-digest (`cellMinutesSha256`, critreview integratie-eindstand 2026-09-23).** De grootte van
een cel is haar ratchet-referentie; een met de hand opgerekte grootte (gemeten mutant: 105360 → 205360
min) versoepelde de ratchet stil — de meting zag hem alleen als "kleiner". Daarom staat in de envelop
van de v2-baseline een SHA-256 over alle grootten van het cellenbestand (`cellMinutesDigest` in
`tests/planning/fidelityCells.ts`). `OPS_XER_CELLS_WRITE` schrijft hem (samen met de cellen);
`OPS_XER_V2_WRITE` neemt de gepinde waarde mee, of die van de cellenherpin in dezelfde run (zo blokkeert
stap 1 van het herpinrecept stap 2 niet). `check-fidelity-cells-gate.ts` en de X12-check vergelijken
het cellenbestand ermee; ongelijk ⇒ rood ("grootten met de hand bewerkt of maar één van beide bestanden
herpind"). Bewust in de envelop en niet in de payload: de payload-hashes in `EXPECTED` van de
corpusloze vangrail veranderen er niet door.

**Versie 1 → versie 2 en merges met een versie-1-cellenbestand.** Een cellenbestand met
`"version": 1` (alleen emmers, geen grootte) wordt door de poort en door
`check-fidelity-cells-gate.ts` geweigerd met een melding die hierheen verwijst; er is geen stille
migratie. De v1-leesroute bestaat alleen nog achter een expliciete, eenmalige vlag:
`OPS_XER_CELLS_WRITE=1 OPS_XER_CELLS_V1_UPGRADE=1` (luide `INFO`-regel). Die vlag is uitsluitend voor
de allereerste overgang v1→v2 en mag na het landen van `claude/x12-grootte-ratchet` **niet meer
gebruikt worden**.

Merge je een branch die zijn cellenbestand als versie 1 herpinde (een conflict in
`tests/planning/xer-product-fidelity-cells.json` is dan zeker): neem **altijd de versie-2-kant**
(`git checkout --ours`/`--theirs`, welke van de twee v2 is), bewerk de JSON nooit met de hand, en draai
ná de merge (met de v2-baseline en gate-pins van de merge al op hun plek, stap 1 en 3 hierboven indien
nodig):

```bash
OPS_XER_CELLS_WRITE=1 bash tests/planning/run.sh check-xer-product-fidelity-x12.ts
```

Weigert die herpin op `groter`, dan is dat een echte bevinding, geen merge-artefact. Die los je op door
de motor te herstellen, of doordat de betreffende cellen via een eigenaarsbesluit uit de populatie
verdwijnen (zoals de rehab-2-cellen die met de manifest-etappe uit het orakel gaan). Er is bewust geen
modus "accepteer grotere cellen": dat zou pinnen met reden zijn. (De eenmalige schuld-overgang van
2026-09-23 was precies zo'n modus; hij is na gebruik verwijderd, zie hieronder.)

**Ratchet-schuld (`ratchetDebt`, eenmalig ontstaan 2026-09-23).** Bij de merge van de grootte-ratchet in
de etappebranch waren 14 Roads-cellen op de huidige motor groter dan in de oude v2-kant (gemeten op de
motor van d4a66772). Orkestratorbesluit: niet stil accepteren en niet de ratchet tegenhouden, maar
schuld vastleggen. Het cellenbestand draagt sindsdien een sectie `ratchetDebt` met per cel
`{ reference, current }` in minuten (`reference` = de oude v2-kant, `current` = de nieuwe). Regels
(`fidelityCells.ts`, `check-fidelity-cells-gate.ts` §4):
- de ratchet-referentie van een schuldcel is `current`: verder groeien is `groter`, rood;
- daalt de cel tot ≤ `reference` of wordt hij exact, dan vervalt de schuld (de volgende herpin laat de
  regel weg); daalt hij maar blijft hij boven `reference`, dan schuift `current` mee omlaag;
- er is GEEN route meer die schuld aanmaakt. De eenmalige overgang (`OPS_XER_CELLS_DEBT_INIT=2026-09-23`)
  heeft de sectie op 23-09 gemaakt en is daarna verwijderd; de X12-check weigert de vlag. Een
  cellenbestand zonder `ratchetDebt`-sectie wordt geweigerd, net als versie 1; neem bij een merge
  altijd de kant mét sectie. De sectie kan alleen krimpen via `OPS_XER_CELLS_WRITE`;
- `check-fidelity-cells-gate.ts` pint een digest over de schuldSET (`EXPECTED_DEBT_SHA256` over
  bestand, as, id en `reference`; `current` niet, die daalt mee) in een gegenereerd blok met de
  leesbare lijst, zodat de lijst niet ongemerkt geruild, verlengd of ingekort kan worden. Ontschuldt
  een herpin een cel, dan herschrijft `OPS_XER_CELLS_WRITE` dat blok zelf (alleen als het bij de
  gepinde set hoorde, en alleen krimp) en print per cel `ratchet-schuld ONTSCHULD: …`; zet er met de
  hand een `HERPIN <datum>`-regel bij die die cel noemt, en commit het blok samen met de cellen.
De 14 staan met hun minuten en hun oorzaak (C5 en C6 zonder late kant) in plan XER §9 ("Ratchet-schuld
2026-09-23"); X12 brok 6 maakte ze alle 14 exact, de schuldsectie is sindsdien leeg.

**Corpusgroei** (een entry erbij of eraf, dus een gewijzigd `xer-corpus-manifest.json`): de
dekkingscheck en de cel-poort staan dan rood op het gewijzigde entry-set, en `=1` weigert. Gebruik
`OPS_XER_V2_WRITE=corpus` en daarna `OPS_XER_CELLS_WRITE=corpus`, gevolgd door stap 3–5 hierboven
met `OPS_XER_GATE_PINS=corpus` in plaats van `=write`.
`=corpus` staat alleen de entry-set-/manifestregels toe en alleen als het manifest werkelijk
verschilt van dat van de gepinde baseline; elke nieuwe, verslechterde of onmeetbaar geworden cel en
elke afwijking op een bestaande entry blijft blokkeren (ook een `groter`-cel). De corpusloze vangrail pint het manifest en
de orakelselectie zelf ook (`EXPECTED.manifestRawSha256` e.a.); die pinnen bijwerken is bij
corpusgroei een bewuste reviewstap en valt buiten `OPS_XER_GATE_PINS`. Zijn die manifestpinnen al
bijgewerkt (bijvoorbeeld omdat ze met een merge meekwamen), dan weigert `OPS_XER_GATE_PINS=corpus`
("vereist een gewijzigd corpusmanifest") en is `=write` de juiste modus voor de tellers.

Een manifestwijziging raakt naast de drie schrijfmodi nog vijf handmatige, bewust te reviewen pinplekken
(gemeten bij de populatiewijziging van 2026-09-23): (1) `tests/planning/xer-fidelity-baseline.json` —
de orakel-doelbaseline, opnieuw gemeten met `OPS_XER_FIDELITY_REPORT=baseline bash tests/planning/run.sh
check-xer-fidelity.ts` (de JSON tussen de kopregels, byte-exact); (2) de ankers C5–C8b in
`check-xer-fidelity.ts`; (3) `EXPECTED_BASELINE_KEYS`/`EXPECTED_MEASURABLE`/de twee raw-hashes en 1h/1i in
`check-xer-fidelity-baseline-schema.ts`; (4) `tests/planning/xer-task-replay-public-pin.json`
(`selectedEntries`, `projects`, `tasks`, de kandidaat-aggregaten, gemeten met `check-xer-task-replay.ts`
mét corpus); (5) in `EXPECTED` van de corpusloze vangrail de manifest-/selectiepinnen
(`manifestRawSha256`, `baselineRawSha256`, de projectie- en selectiedigests, `included`, `excluded`,
`oracleByteUnique`, `selected`, `tasksWithAnyMeasuredAxis`, `roles`) — de vangrail noemt de verwachte
waarden zelf in zijn foutregel. `xer-schedoptions-blast-radius.json` telt zijn fidelity sinds 2026-09-23
alleen op manifest-orakels (zie stap 5); een rolwissel die een orakel zonder SCHEDOPTIONS oplevert, maakt
daar de struikeldraad "0 meetbaar" rood — dat vraagt een meetlat, geen herpin.

Tweede toepassing (2026-09-24, DCP-03 Baseline naar `reader-only`, zelfde besluit): dezelfde route, met
twee aanvullingen. `OPS_XER_GATE_PINS=corpus` werkte hier (het manifest verschilde nog van de v2-pin). In
`check-xer-corpus.ts` staat C1 `oracleOk` (het aantal orakelentries), en in
`xer-schedoptions-blast-radius.json` beweegt `expectedFinishVariant.fidelity` mee (die telt op
manifest-orakels): neem die rijen over uit `OPS_XER_SCHEDOPTIONS_REPORT=baseline`. Let ook op mutant M24
in de corpusloze vangrail: die flipt het eerste teken van de manifesthash en moet een ander teken kiezen
als de hash zelf al met `0` begint.

Een ontbrekend cellenbestand maak je alleen bewust aan met `OPS_XER_CELLS_WRITE=init`; `=1` weigert
dan met uitleg, `init` weigert over een bestaand bestand, en `init` weigert ook zolang er een
v2-baseline bij hetzelfde corpusmanifest bestaat — `init` is alleen voor een echt nieuw corpus. Een
weggegooid cellenbestand zet je terug uit versiebeheer.

**Verboden omwegen.** Alle drie de schrijfmodi (`OPS_XER_V2_WRITE`, `OPS_XER_CELLS_WRITE`,
`OPS_XER_GATE_PINS`) schrijven alleen omlaag; `OPS_XER_GATE_PINS=write` weigert zodra een
afwijkingenteller stijgt of de dekking wijzigt, en bij een gewijzigd manifest alleen via `=corpus`.
Maak een baseline daarom nooit langs ze heen:

- geen omleiding `OPS_XER_FIDELITY_REPORT=baseline … > tests/planning/xer-product-fidelity-baseline-v2.json`.
  De rapportmodus print een kopregel `RAPPORT — niet als baseline gebruiken` vóór de JSON (een
  omgeleid bestand is dus ongeldig en de strikte v2-lezer weigert het) en weigert rechtstreeks naar
  het baselinebestand te schrijven;
- geen cellenbestand weggooien om het met `init` opnieuw te maken;
- `EXPECTED` in `check-xer-corpusless-fidelity-gate.ts` niet met de hand ophogen;
- nooit `ratchetDebt` of een grootte (`minutes`) in het cellenbestand met de hand bewerken, en nooit
  `cellMinutesSha256` of het schuldpin-blok met de hand bijwerken om zo'n bewerking te dekken;
- `OPS_XER_CELLS_DEBT_INIT` bestond eenmalig op 2026-09-23 (de overgang die de 14 schuldcellen
  vastlegde) en is daarna verwijderd; de X12-check weigert de vlag, en er komt geen opvolger;
- geen `OPS_XER_CELLS_V1_UPGRADE=1` meer na het landen van `claude/x12-grootte-ratchet` (en nooit de
  v1-kant van een cellenbestand nemen bij een merge).

## P6-doorgerekend-rapportage (corpusgebonden, niet in `verify`)

- `xer-p6-computed.ts` — `node scripts/run-ts.mjs scripts/xer-p6-computed.ts [--check]` met
  `OPS_XER_CORPUS`. Meet per manifest-entry de drie kenmerken (SCHEDOPTIONS-rij, `rem_late_start_date`
  gevuld op open taken, `driving_path_flag` ergens Y) op de ruwe tabellen en schrijft
  `tests/planning/xer-corpus-p6computed.json`. Het oordeel is per PROJECT (`projects[proj_id]:
  { p6Computed: true|false|"unknown", schedOptions, remLateStartFilled, drivingPathFlagY }`; "unknown"
  = geen open taken); de X12-splitsing telt per (bestand, project), en projecten zonder sidecar-regel
  tellen apart als "niet in sidecar". Het bestandsveld `p6Computed` is alleen een samenvatting: de
  gemeenschappelijke waarde, of `"mixed"` als projecten verschillen. Het eigenaarsbesluit van 2026-09-23
  ("alleen die P6-bestanden") classificeerde de toenmalige 93 entries met deze meting als onderbouwing:
  `oracle` waar minstens één project `true` was, anders `reader-only`. De tweede toepassing (DCP-03
  Baseline, zie hierboven) maakte het kenmerkencriterium noodzakelijk maar niet voldoende: bewijs dat een
  generator(script) de kenmerken zelf schrijft sluit uit; de meting noteert zulke vondsten informatief
  als `generatorEvidence` (XER-schrijvende `.py`-bestanden naast het bestand of een byte-identieke kopie;
  stuurt de populatie niet, de uitsluiting is een rolwissel in het manifest). Dat is een eenmalig besluit, geen
  vaste regel: een nieuwe entry of een rolwissel vraagt opnieuw een eigenaarsbesluit (zoals de
  manifest-policy zegt: veldinhoud kiest nooit zelf de populatie). `measure:profiles` draait in het
  P6-deel `--check` mee en print de exitcode, zonder het oordeel te veranderen. Dat
  bestand is de enige bron voor de splitsing "P6-doorgerekend / niet / onbekend" in de X12-uitvoer en
  in `measure:profiles`; het stuurt de populatie nooit. `--check` faalt (exit 1) als het bestand niet
  met de meting overeenkomt. Het staat bewust naast en niet ín `xer-corpus-manifest.json`: de
  manifest-SHA-256 is gepind in de v2- en cel-baselines. Het leest twee bak-2-kolommen, maar alleen
  hier in `scripts/`; in `src/` blijft dat verboden (`check-xer-field-whitelist.ts`).

## Release en publicatie

| script | aangeroepen door | doet |
|---|---|---|
| `bump-version.js` | `npm run bump X.Y.Z` | CalVer synchroon zetten in `package.json`, `tauri.conf.json` en de lockfile (`Cargo.toml` blijft bewust `0.1.0`) |
| `release-notes.mjs` | `.github/workflows/release.yml` (twee plekken) | `docs/release-notes/v<versie>.md` → `--format=body` voor de GitHub-releasepagina, `--format=notes` (platte tekst) voor het `notes`-veld in `latest.json` |
| `release-highlights.mjs` | `npm run verify:release-highlights` | start de getypeerde releasehighlight-verifier: eist één volledig versieblok met 14 locales, één primary en vier secondary-kaarten zonder gidslink, veilige pictogrammen en reproduceerbare Git-cijfers; docs, vertalingen, lock-, gegenereerde en vendorbestanden tellen niet mee |
| `build-release-highlights-json.ts` | `npm run gen:release-highlights-json` (schrijven) en `npm run verify:release-highlights-json` (poort, in de `verify`-keten); tijdens een release stap 4a van de `release`-skill | genereert `public/release-highlights.json` uit `src/services/updater/releaseHighlights.ts` — de webbuild serveert dat als `https://open-planner-studio.open-aec.com/release-highlights.json` voor de releasetijdlijn op open-aec.com; `--check` faalt (exit 1) zodra het bestand achterloopt op de catalogus (`generated` telt niet mee) |
| `verify-package-docs.mjs` | `.github/workflows/snap.yml`, direct na de Snap-build | leest de executable uit de zojuist gebouwde Snap en eist dat het manifest plus de aanwezige Help-artikelen uit `public/docs/` als Tauri-assets zijn ingesloten, vóór upload of Store-publicatie |
| `publish-wiki.mjs` | `npm run publish:wiki` | genereert de GitHub-wiki uit `public/docs/en`, `docs/wiki/*` en de changelog. De wiki is een build-artefact — nooit met de hand bewerken |
| `download-stats.mjs` | `npm run stats:downloads` en `.github/workflows/download-stats.yml` (wekelijks + op verzoek) | downloadcijfers per besturingssysteem uit de `download_count` per release-asset van de GitHub Releases-API — tekst, markdown of JSON. Let op: Linux is install+update samen (de updater haalt hetzelfde `.deb`/`.rpm`/`.AppImage` op), de Snap Store zit er niet in, `.sig`-bestanden tellen niet mee. Unit-test: `tests/dev-server/download-stats.test.mjs` |
| `publish-stats-branch.sh` | `.github/workflows/download-stats.yml`, direct na het genereren | schrijft `download-stats.json` als `downloads.json` naar de `stats`-databranch met git-plumbing (`hash-object` → `mktree` → `commit-tree` → gewone push, dus geen checkout en geen force). Vaste leeslocatie: `https://raw.githubusercontent.com/OpenAEC-Foundation/open-planner-studio/stats/downloads.json` — hetzelfde raw-patroon als de extensiecatalogus, CORS-vrij, en een push naar `stats` triggert geen CI of deploy. Regressietest tegen een tijdelijke bare repo: `tests/dev-server/publish-stats-branch.test.mjs` |

## Overig

- `run-ts.mjs` — de TypeScript-runner waarmee de `.ts`-scripts hierboven draaien (esbuild → Node).
  Alle `node scripts/run-ts.mjs scripts/x.ts`-aanroepen in `package.json` gaan hierlangs.
- `generate-icon.mjs` — genereert het app-icoon uit code. **Draait niet zonder extra installatie:**
  hij importeert `sharp`, en dat staat bewust niet in `package.json` (het is een zware native
  dependency voor een handeling die je hooguit bij een rebranding doet). Wil je hem draaien:
  `npm i --no-save sharp` en dan `node scripts/generate-icon.mjs`.
