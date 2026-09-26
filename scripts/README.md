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
poort te pakken. Zie `.claude/rules/dev-server.md` en `tests/dev-server/` voor het geheel.

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
| `verify-parts.mjs` | `.github/workflows/ci.yml` (job `verify`) | verdeelt de stappen van `npm run verify` — rechtstreeks gelezen uit `package.json` — over de parallelle CI-delen; een niet-ingedeelde stap valt in `static`. `--list` toont de indeling, `--check-ci` eist dat de CI-matrix elk deel draait |
| `i18n-diff.mjs` | `verify:i18n` | ontbrekende vertaalsleutels t.o.v. `nl`, met CLDR-pluralcategorieën |
| `verify-i18n-keys.mjs` | `verify:i18n` | geen cast (`as 'a.b'`) op een vertaalsleutel in `src/`: zo'n cast zet de typecheck van die sleutel uit (`as const` mag); bewezen door `tests/planning/check-i18n-keys.ts` |
| `i18n-fmt.ts` | `verify:i18n` (met `--check`) en `npm run i18n:fmt` (schrijven) | de vaste opmaak van alle 56 locale-bestanden: één sleutel per regel, volgorde van `nl`, meervoudsfamilies in CLDR-volgorde |
| `i18n-add.ts` | `npm run i18n:add` | zet één tekst (of meervoudsfamilie) in alle 14 locales tegelijk, na validatie van locales, CLDR-categorieën en `{{invulplekken}}`; `--update` wijzigt, `--after` plaatst |
| `i18n-resolve.ts` | `npm run i18n:resolve` | voegt na `git merge` alle locale-bestanden per sleutel samen (merge-base, HEAD, MERGE_HEAD; of de merge-commit achteraf), maakt ze op en doet `git add`; een echte botsing blijft open met exit 1 |
| `i18n-tools.ts` | de drie hierboven, en `tests/planning/check-i18n-tools.ts` | de pure kern (ordenen, serialiseren, valideren, plaatsen, per sleutel samenvoegen) |
| `verify-text-roles.mjs` | `verify:text-roles` | tekstgroottes lopen uitsluitend via de zes tekstrollen (`text-caption` … `text-title` / `var(--text-…)`); keurt kale px/rem-font-sizes, `text-[Npx]`, Tailwinds eigen schaal en inline `fontSize` in `src/` af (niet in `engine/`/`services/`) |
| `verify-cycles.mjs` | `verify:cycles` | circulaire imports binnen `src/`, gemeten op de esbuild-metafile (dus ná type-erasure — `import type` geeft geen valse treffers) |
| `verify-docs.ts` | `verify:docs` | de in-app gidsen in `public/docs/`: manifest-dekking, weesbestanden, `docs://`/`examples://`-links, en of de inhoud binnen de mini-Markdown-subset blijft; bewaakt daarnaast dat `.claude/skills/goed-plannen/SKILL.md` byte-identiek is aan de bron `public/skills/goed-plannen/SKILL.md` |
| `verify-examples.ts` | `verify:examples` | de gebundelde voorbeeldprojecten laden en rekenen door zoals verwacht |
| `verify-conventions.mjs` | `verify:conventions` | AST-poort van de rekenprofielen (ook aangeroepen door `tests/planning/check-conventions-boundary.ts`): de motor (`src/engine/` plus de motorhelper `src/utils/p6SuspendResume.ts`) leest geen bronformaat (`p6Source`/`importFormat`/`readFormat`/`xerSourceProjectId`/`xerSourceArchive`/`xerImportMetadata`, ook via string-index, `in` of destructuring; geen lezer-, `formatRegistry`- of `xerSourceArchive`-imports en geen niet-letterlijke dynamische imports); opties-sleutels alleen uit het register (`convention('…')` in `CONVENTIONS` plus de projectopties uit `interface SchedulingOptions`): een onbekende of niet-letterlijke sleutel op een opties-object, `Reflect.get`/`Object.keys|values|entries` op een opties-object (ook via hernoemde imports, type-aliassen en `import('…')`-typen), een registerconventie die in geen vanuit `solveProject.ts` bereikbaar bestand gelezen wordt, en een ongepind herkomstveld (`p6…`/`xer…`/`mpp…`/`msp…`/`mpx…` dat geen eigen lid op `this` of op een in hetzelfde bestand gedeclareerd object is) zijn rood (Fable-critreview PR #169, bevinding 4 + critreview 2e ronde). Grens: syntactisch, dus een opties-object dat via een helper in een ander bestand onder een neutrale naam binnenkomt, of een waarde die al als `any` binnenkomt, ziet de poort niet; herkomst-datagates (ook via destructuring en `in`) gepind in `verify-conventions.datagates.json`, alleen omlaag (`--write-baseline` herpint, alleen als alles groen is). Een optionele `verify-conventions.allowlist.json` kan overgangscode tijdelijk vrijstellen (alleen namen, alleen bestaande bestanden, reden met de overgangsmarkering); in de eindstand bestaat hij niet |

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
| P6-profiel | `check-xer-product-fidelity-x12.ts` mét `OPS_XER_CORPUS` | cel-poort op `tests/planning/xer-product-fidelity-cells.json` over zeven poortassen: de zes X12-assen plus `drivingPath` als zevende poort-as (cel-ratchet; niet in het zesassige nuldoel-getal). Exact → inexact of een verslechterde emmer (exact < sameday < diff < missing) is rood. **Grootte-ratchet** (cellenbestand versie 2, eigenaarsbesluit 2026-09-23): elke `sameday`/`diff`-cel op de zes X12-assen draagt zijn absolute afwijking `\|ours − truth\|` in minuten (datum-assen: wandklokminuten; tf/ff: floatminuten; afgerond op 0,001 — en tf/ff tellen alleen als afwijking als hun verschil op die raster niet naar 0 afrondt: `FLOAT_EXACT_TOLERANCE_MIN` in `fidelityCore.ts`, eigenaarsbesluit in afwachting (§1d-9, branch `claude/x12-tolerantie-vraag9`); `missing` en `drivingPath` zonder grootte) — een cel die in baseline én meting dezelfde emmer `sameday`/`diff` heeft en nu GROTER afwijkt is rood (`groter`), kleiner telt apart als verbeterd-grootte (`kleiner`). De cel-deltaregel luidt `CELLDELTA p6 nieuw=… verslechterd=… groter=… verbeterd=… kleiner=… onmeetbaar=… onbekend=… ongemeten=… schuld=… totaal=…`; een regel zonder `groter=`/`kleiner=`/`schuld=` is onleesbaar en dus rood. `schuld=N` is de ratchet-schuld (zie hieronder): informatief, NULDOEL blijft mogelijk bij `groter=0`; de check zelf is rood als de schuld stijgt. Niet rood zijn alleen: GROEN (exit 0); NULDOEL (uitsluitend de drie nuldoelregels rood, cel-poort groen, `verbeterd=0 groter=0 kleiner=0`). Herkend maar sinds de Fable-critreview PR #169 (bevinding 9) óók rood, omdat per cel de pin geldt en een ongepinde verbetering anders stil kan terugvallen: VERBETERD (daarnaast alleen de v2-gelijkheidsregel rood en cel-delta `nieuw=0 verslechterd=0 groter=0 onmeetbaar=0 verbeterd>0`: herpin v2 + cellen in dezelfde commit, zie hieronder, en meet opnieuw); VERBETERD (grootte) (geen v2-afwijking, `groter=0 kleiner>0`: herpin de cellen en meet opnieuw — de v2-payload en de gate-pins tellen emmers en veranderen niet; de cellenherpin werkt alleen `cellMinutesSha256` in de v2-envelop mee bij, zie *Minuten-digest* hieronder). Een cel die niet meer meetbaar is (blinder orakel) telt nooit als verbeterd maar als `onmeetbaar` en is rood; meetbaarheid en dekking per entry/as worden daarnaast apart tegen v2 vergeleken (`X12 meetbaarheid/dekking wijkt af van v2`, altijd rood). `--strict` maakt een rode nuldoelregel rood |
| MS Project-profiel | `check-mpp-fidelity.ts` | `GOAL_ZERO_DEVIATIONS` en de 216 tellingenpins; het orakel meet alleen start en einde (twee assen) en staat op nul, dus elke pin is al een cel-poort. Nul gescande bestanden is `ROOD (niet gemeten)` |
| vangrails | `check-xer-corpusless-fidelity-gate.ts`, `check-fidelity-cells-gate.ts` | corpusloos: v2-karakterisering, cel-baseline canoniek, versie 2, grootte op precies de sameday/diff-cellen van de zes assen, in de pas met de v2-tellingen, grootten gelijk aan `cellMinutesSha256` in de v2-envelop, schuldset gelijk aan de gepinde digest; plus de synthetische ratchetbewijzen (groter ⇒ rood, kleiner ⇒ verbeterd-grootte) en mutanten op het gecommitte bestand (15e schuldcel, ingekorte/geruilde schuldlijst, schuldcel of gewone cel met de hand groter, ontbrekende schuldsectie ⇒ rood) |
| `--full` (optioneel) | de volledige `run.sh`, zonder `OPS_XER_CORPUS` | standaard uit: draait al in `npm run verify`, en machinebreed hoort er maar één zware run tegelijk te lopen |

Exit 1 zodra één onderdeel rood is; logs per onderdeel in een tijdelijke map (pad staat in de
uitvoer).

**Herpinnen na een VERBETERD-uitslag** (rood tot de herpin; daarna geeft dezelfde meting NULDOEL/GROEN) — zes stappen, in deze volgorde, alles in één commit:

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
  meting vergeleken. Sinds v11 staat ook de projectoptie `startToStartLagFrom` (default `earlyStart`)
  als `startToStartLagFromEarlyStart` in de defaults-projectie. Toeschrijving: een kapotte lezerdefault wordt gevangen door de onafhankelijke
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

Tweede toepassing (2026-09-23, DCP-03 Baseline naar `reader-only`, bevestigd door de eigenaar op 2026-09-23, overdracht §1a): dezelfde route, met
twee aanvullingen. `OPS_XER_GATE_PINS=corpus` werkte hier (het manifest verschilde nog van de v2-pin). In
`check-xer-corpus.ts` staat C1 `oracleOk` (het aantal orakelentries), en in
`xer-schedoptions-blast-radius.json` beweegt `expectedFinishVariant.fidelity` mee (die telt op
manifest-orakels): neem die rijen over uit `OPS_XER_SCHEDOPTIONS_REPORT=baseline`. Let ook op mutant M24
in de corpusloze vangrail: die flipt het eerste teken van de manifesthash en moet een ander teken kiezen
als de hash zelf al met `0` begint.

**Uitsluiting per project of taak** (mechanisme 2026-09-23, `tests/planning/xerManifestExclusions.ts`).
Een orakelentry kan bij eigenaarsbesluit een deel van zichzelf uit de meetlat halen, zonder het hele bestand
een andere rol te geven:

```json
"decision": "JJJJ-MM-DD eigenaarsbesluit: <vrije tekst>",
"excludeProjects": [{ "projId": "2665", "reason": "…" }],
"excludeTasks": [{ "projId": "4408", "taskCode": "EC1430", "reason": "…" }]
```

Regels: alleen op een `role: "oracle"`/`included: true`-entry. `decision` heeft EXACT de vorm
`JJJJ-MM-DD eigenaarsbesluit: <vrije tekst>` (een bestaande datum, niet in de toekomst; "geen
eigenaarsbesluit" of een vrije plaatsing van het woord glipt dus niet door). Komt één regel uit een LATER
besluit, dan draagt die regel een eigen `decision` in dezelfde vorm (niet vóór de entrydatum); de entry noemt
dan het vroegste besluit en de latere chronologisch in de tekst, en de HERPIN-regel volgt de datum van de
regel (HarbourPointe: entry 2026-09-23 vraag 8, EC1420 2026-09-24 vraag 13). Anders weigert de lezer de hele
entry, net als bij een lege lijst, een onbekende sleutel, een reden korter dan 10 tekens, een `projId`/`taskId`
als getal (schrijf `"12345"`), een dubbele regel of een taak onder een al uitgesloten project. Een taak noem
je met precies één van `taskId` of `taskCode`; dezelfde taak via `taskId` én `taskCode` is een dubbel-fout,
en een uitsluiting die geen orakeltaak raakt of een dubbelzinnige taakcode is een fout, nooit een stille
no-op. De solve draait ongewijzigd over het hele bestand (uitgesloten taken blijven invoer voor hun
opvolgers). **Wat filtert wel/niet:** WEL de zes assen, de cellen, drivingPath, de nuldoelregels, de
X1-doelbaseline (`buildXerTargetBaseline`) en de task-replay; NIET de schemavingerafdruk (dedup), de ruwe
corpusdekking (C3/C4/C4a), de X12-probes op `solvedProjects` en `expectedFinishVariant` in
`xer-schedoptions-blast-radius.json` (telt op manifest-orakels, hele bestand). X12 print altijd een regel
`INFO X12 manifestuitsluiting …: uitgesloten: N taken in K projecten — <label>: <project/taak> (<n> taken) —
<reden> [<datum>]; buiten de telling: … zesassige afwijkingen, … drivingPath-cellen`, ook bij nul, en
`measure:profiles` neemt het aantal over in zijn tellingenkolom.

De lijst is gepind zoals de schuldset: een gegenereerd blok `manifest-uitsluitingspin` met
`EXPECTED_EXCLUSIONS_SHA256` in `check-fidelity-cells-gate.ts` (corpusloos: lijst = digest, blok = lijst, geen
cel en geen v2-project op een uitgesloten project/taak-id). Een uitsluiting wijzigen is een
manifestwijziging, dus de corpusgroei-route hierboven: in één run
`OPS_XER_V2_WRITE=corpus OPS_XER_CELLS_WRITE=corpus bash tests/planning/run.sh check-xer-product-fidelity-x12.ts`.
Alleen voor entries waarvan de opgeloste IDENTITEITSSET (uitgesloten projecten en taken) verschilt van het
gepinde blok zijn de weggevallen cellen ("cel valt weg door een nieuwe manifestuitsluiting"), de
drivingPath-orakelhash en de dekkingsverschuiving `fileset` in plaats van `hard` — en de dekking alleen als
de v2-pin exact gelijk is aan de meting met de GEPINDE uitsluiting (dus precies de delta van nu ∖ was en
was ∖ nu; elke andere verschuiving blijft `hard`). Alleen een andere reden of datum verandert de digest
(herpin van het blok) maar niet de identiteitsset, en maakt dus niets `fileset`. De `CELLDELTA`-regel en de
herpin-OK-regel noemen het aantal door uitsluiting weggevallen cellen (`uitgesloten=N`). De cel-herpin
herschrijft het blok zelf (alleen via `=corpus`, en alleen vanaf een ongeschonden blok) en print per
uitsluiting de regel `HERPIN <herpindatum> uitsluiting (besluit <besluitdatum>): <label> — <reden>`,
chronologisch op besluitdatum; de corpusloze cellenpoort eist per uitsluiting het deel vanaf "uitsluiting"
letterlijk tussen de schuldpin en het blok (de herpindatum schrijft de herpin, hij hoort niet bij het record). **Verborgen aantallen:** per bestand met een uitsluiting en daarbinnen PER
UITGESLOTEN TAAK (`proj_id/task_id`) staan de zesassige afwijkingen en drivingPath-cellen op die taak als
`excludedHidden` in `xer-product-fidelity-cells.json` (vorm `{ "<sha256>": { "<proj>/<taak>": { "sixAxis": n,
"drivingPath": m } } }`; taken met 0/0 staan er niet in, een bestand zonder verborgen afwijking heeft `{}`).
Elk getal is een NIET-STIJGENDE pin per taak (stijging = `hard`, daling = herpinnen via de schrijfmodi), zodat
een motorregressie op een uitgesloten taak niet onzichtbaar wordt; de per-taakpin telt mee in
`cellMinutesDigest` en dus in `cellMinutesSha256` van de v2-envelop (met de hand ophogen valt op). Bij een
gewijzigde identiteitsset geldt per taak, apart voor de zes assen samen en drivingPath: al uitgesloten ⇒ ≤ eigen
pin; **nieuw uitgesloten** ⇒ ≤ de cellen die de gepinde baseline op die taak had (`excludedCells`); **weer
meegeteld** ⇒ de teruggekeerde cellen ≤ de eigen pin, waarna die pin vervalt. Binnen die grenzen `fileset`
(herpin via `=corpus`), elk surplus `hard`. Per taak en niet per bestand, omdat een bestandstotaal speelruimte
gaf: een weer meegetelde taak zonder afwijking maakte haar deel vrij voor een regressie op een andere, nog
uitgesloten taak (her-check 2026-09-24, M1). Aanleiding: critreview C14-landing en Fable-critreview PR #169
bevinding 1 (2026-09-24); mutatiebewijs: +1 dag ff op OZB-project 9032 plus `excludeProjects` 9032 blijft hard
rood en `=corpus` weigert. De overgang van het bestandstotaal naar de per-taakvorm (2026-09-24) is eenmalig
gemeten: per bestand was de som per taak exact het oude totaal (OZB 38/4 over 14 taken, Hotel 0/19 over 19,
HarbourPointe 34/0 over 9); er is geen leesroute voor de oude vorm. Wat dit níét vangt: een grotere afwijking
in een cel die op een nieuw uitgesloten taak al inexact was (zelfde telling); dat blijft
aan de review van de uitsluiting. Zonder uitsluiting ontbreekt de sectie (bestand byte-gelijk).
Daarna de vijf handmatige pinplekken hierboven (de X1-baseline, C5–C8b,
het baselineschema, de task-replay-pin, `EXPECTED` van de corpusloze vangrail) en `OPS_XER_GATE_PINS=corpus`.
Verboden: het blok of de digest met de hand bijwerken, of een uitsluiting laten kiezen door veldinhoud
(een script dat taken selecteert op hun waarden) — de lijst staat letterlijk in het manifest, per regel met
reden.

**Kant-en-klaar voor de eigenaarsvragen §1d-8, §1d-10 en §1d-12 (Hotel/CR)** (overdracht rekenprofielen). Zeg ja ⇒
deze drie entries in `tests/planning/xer-corpus-manifest.json` krijgen dit blok (datum van het besluit invullen),
gevolgd door de route hierboven:

```json
"crawl-xer/HarbourPointe_AssistedLiving.xer": { …, "decision": "JJJJ-MM-DD eigenaarsbesluit: §1d-8, de 8 taken met verouderde P6-uitvoer uit het orakel",
  "excludeTasks": [
    { "projId": "4408", "taskCode": "EC1430", "reason": "P6-span 696 u < opgeslagen restduur 720 u: uitvoer verouderd t.o.v. de invoer (§1d-8)" },
    { "projId": "4408", "taskCode": "EC1590", "reason": "P6-span 696 u < opgeslagen restduur 720 u (§1d-8)" },
    { "projId": "4408", "taskCode": "EC1680", "reason": "P6-span 840 u < opgeslagen restduur 864 u (§1d-8)" },
    { "projId": "4408", "taskCode": "EC2060", "reason": "P6-span 480 u < opgeslagen restduur 552 u (§1d-8)" },
    { "projId": "4408", "taskCode": "EC2170", "reason": "P6-span 1968 u < opgeslagen restduur 2208 u (§1d-8)" },
    { "projId": "4408", "taskCode": "EC2200", "reason": "P6-span 1944 u < opgeslagen restduur 2184 u (§1d-8)" },
    { "projId": "4408", "taskCode": "EC2380", "reason": "P6-span 96 u < opgeslagen restduur 144 u (§1d-8)" },
    { "projId": "4408", "taskCode": "EC2410", "reason": "P6-span 720 u < opgeslagen restduur 920 u (§1d-8)" }
  ] },
"crawl-xer/eh_P6Workshops/OZB-Start-09Dec24.xer": { …, "decision": "JJJJ-MM-DD eigenaarsbesluit: §1d-10, project 9033 is door P6 genivelleerd",
  "excludeProjects": [{ "projId": "9033", "reason": "door P6 resource-genivelleerd (PM-1, vooruit en achteruit); nivellering is geen CPM-conventie (§1d-10)" }] },
"crawl-xer/Hotel_Construction_TEC.xer": { …, "decision": "JJJJ-MM-DD eigenaarsbesluit: project CR (2665) niet door P6 doorgerekend",
  "excludeProjects": [{ "projId": "2665", "reason": "project CR niet door P6 doorgerekend (xer-corpus-p6computed.json: p6Computed false)" }] }
```

Proef op 2026-09-23 (niet gecommit, mechanismebranch `claude/x12-manifest-uitsluiting-taak-project`): met
precies deze drie blokken gaat X12 van 192 naar 121 zesassige afwijkingen (OZB 9033 −38 op 14 taken,
HarbourPointe −33 op de 8 taken; Hotel/CR −0, het had er geen) en drivingPath van 169 naar 146 (Hotel/CR
−19, OZB 9033 −4); de cel-poort meldt alleen `fileset`-regels en de nuldoelregels, en
`OPS_XER_V2_WRITE=corpus OPS_XER_CELLS_WRITE=corpus` herpint in één run (uitsluitingspin mee). Geen cel
werd daarbij slechter of groter. Van de 81 HarbourPointe-cellen die het onderzoek aan de verouderde uitvoer
toeschreef, zitten er 48 op andere taken dan de 8; die blijven meetellen.

**Toegepast 2026-09-23** (eigenaarsbesluiten vraag 8 "ja", vraag 10 "uitsluiten", vraag 12 "ja, uitsluiten";
overdracht §1a): de drie blokken staan in het manifest met `decision: "2026-09-23 eigenaarsbesluit: …"`. Vanaf
X12 175 (na brok 8/9): 175 → 104 (OZB −38, HarbourPointe −33, Hotel/CR −0), drivingPath 168 → 145 (Hotel/CR
−19, OZB −4); `excludedHidden` 71 zesassig / 23 drivingPath. Volgorde: eerst de handmatige manifesthashpinnen, dus
daarna weigerde `OPS_XER_GATE_PINS=corpus` ("vereist een gewijzigd corpusmanifest") en was `=write` de modus
voor de tellers en payloadhashes; met de hand: X1-doelbaseline, C6/C8/C8b, het baselineschema (manifest-
en baselinehash, meetbaar), de task-replay-pin (alleen `unchanged` −22 per as) en in `EXPECTED` van de
vangrail `manifestRawSha256`, `baselineRawSha256`, `selectedContractSha256` en `tasksWithAnyMeasuredAxis`
(5.901 → 5.879, want die moet gelijk zijn aan replay `overall.unchanged`). Dit zijn eigenaarsbesluiten, geen regel.

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
