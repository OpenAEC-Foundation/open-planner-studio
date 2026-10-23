# F2 — fixronde 2, deel B (laden), 23 oktober 2026

Het BLOKKEERT-punt uit review ronde 2, deel B, is opgelost. Een datum zonder tijd uit MSPDI, P6 XML of XER
blijft nu een datum tot de laadgrens, en de laadnormalisatie maakt er D1 of D2 van. Een expliciete `T00:00`
blijft een moment. Er is een regressie met mutatiebewijs, en de tegenproef van de reviewer is groen. Het
VERVOLG-punt staat als ingang 272 in `knownbugs.md`. Dit verslag is opgesteld door een AI-assistent; de
volledige CI is niet afgetekend.

Ronde 3 (onderaan) repareert het BLOKKEERT-punt uit review ronde 3, deel B: een werkelijke datum mét tijd
op een scalaire kalender verloor zijn tijd. Die sectie verbetert ook een verkeerde verwijzing naar I8.

## Werkplek

- Worktree `.claude/worktrees/uren-f2-laden2`, branch `claude/uren-f2-laden2`, gemaakt op `99049810a`
  (stap 0 gecontroleerd met `git log -1`). Geen PR; een worker voegt de branch samen met
  `claude/uren-f2-kern`.
- `node_modules` is een link naar `.claude/worktrees/uren-f2/node_modules`.
- De motor (`src/engine/scheduler/`) is niet aangeraakt.

## Oorzaak

Twee parsers maakten in uurmodus van een datum zonder tijd middernacht, vóór de laadnormalisatie:

- `importDateTime` (`src/services/importDates.ts`), via `importDateTimeOrUndefined`. Die functie leest
  bij MSPDI elk taakveld (`mspdiReader.ts:398`, `:497-498`) en bij P6 XML ook (`p6xmlReader.ts:920`,
  `:930`). De uurtak deed `formatInstant(parseImportedInstant(s), 'hour')`; `2026-06-01` werd
  `2026-06-01T00:00`.
- `sourceInstant` (`src/services/xer/xerInstant.ts`). In uurmodus gaf `2026-06-01` ook `T00:00`. Een
  XER-kalender wordt een urenkalender zodra één taak erop een tijd draagt (`xerReader.ts:653-668`).

De normalisatie (T17, D1–D7, `payloadFromImport`) laat een moment staan. Zo bleven werkelijk begin en
einde, baseline, deadline en FNLT na laden, opslaan en heropenen op 00:00. De IFC-lezer had dezelfde fout
al in ronde 1 gerepareerd (`ifcReader.ts:1533`).

## Fix

- `src/services/importDates.ts:47`: `hour && !isDateOnly(s) ? … 'hour' : s.substring(0, 10)`. Dezelfde
  test als de IFC-lezer (`isDateOnly`, `workdayRules.ts:50`, strikt `YYYY-MM-DD`).
- `src/services/xer/xerInstant.ts:4` en `:28`: `hourMode && !DATE_ONLY.test(value) ? 'hour' : 'day'`.
  De regex staat lokaal, zodat de module zonder afhankelijkheden blijft.

Geen nieuwe migratielaag. De laadgrens doet de rest, ook voor de vastlegging ("datums zoals opgeslagen"):
`normalizeRecordedTimes` (`documentActivation.ts:366`).

## Adapters

| route | parser | zelfde fout? | in deze fix |
|---|---|---|---|
| MSPDI | `importDateTimeOrUndefined` | ja | ja |
| P6 XML | `importDateTimeOrUndefined` | ja (gemeten, zie regressie) | ja, via dezelfde functie |
| XER | `sourceInstant` | ja | ja |
| XER stop/resume | `sourceX7Instant` (tijd per cel) | nee | niet nodig |
| `.mpp` | binaire tijdstempels (`mppReader.ts:742`) | nee: de bron kent geen datum zonder tijd; 00:00 is daar een echt moment | niet aangeraakt |
| CSV | `csvDate` | nee: altijd een datum | niet aangeraakt |
| IFC | `toHour` | al gerepareerd in ronde 1 | niet aangeraakt |

## Regressie en mutatiebewijs

Nieuwe check `tests/planning/check-import-datum-zonder-tijd.ts`, 26 controles.

- MSPDI (werkblokken 08:00–12:00 en 13:00–17:00) en XER (kalender van 8 u, een andere taak geeft het
  tijdsignaal): lezer → `payloadFromImport` → laden met berekening → IFC opslaan → heropenen. Taak
  "Gereed" draagt alleen datums zonder tijd: werkelijk begin en einde, FNLT, deadline (alleen MSPDI; P6
  kent geen deadline) en de baseline (XER: uit baselineproject P0 via `sum_base_proj_id`). Verwacht
  D1/D2: 08:00/17:00 en 08:00/16:00. Taak "Middernacht" draagt overal een expliciete `T00:00`: die blijft
  op elke stap 00:00.
- P6 XML: lezer en laadnormalisatie, met dezelfde twee taken.
- XER: de statusdatum zonder tijd blijft een datum (spec §3.6).

| run | uitkomst |
|---|---|
| zonder fix (basis `99049810a`) | exit 1, 11 rode controles: precies de zes van de reviewer, plus lezerstap, statusdatum en P6 XML |
| met fix | exit 0, 26/26 |
| mutatie `importDates.ts` (fix eruit) | exit 1, 6 rood: MSPDI ×4, P6 XML ×2 |
| mutatie `xerInstant.ts` (fix eruit) | exit 1, 5 rood: XER ×4 plus statusdatum |
| mutatie: expliciete `T00:00` ook als datum | exit 1, 10 rood: alle "Middernacht"-controles |

Elke mutatie: bestand naar /tmp, gemuteerd, check gedraaid, teruggezet met `cp`; `cmp` bevestigde de fix.

Tegenproef van de reviewer (`/tmp/review559-r2b/probe-adapters.ts`, paden omgezet naar deze worktree, run
in `/tmp/laden2-probe/`): exit 0, `FOUTEN []`. MSPDI geeft op alle vier stappen 08:00/17:00, ook voor FNLT,
deadline en baseline; XER 08:00/16:00.

## Checks (alle in de voorgrond, oordeel op exitcode)

| check | exit |
|---|---|
| `check-import-datum-zonder-tijd.ts` | 0 |
| tegenproef reviewer `probe-adapters.ts` | 0 |
| groep 1, 25 checks: de nieuwe check, `check-minute-model-input`, `check-minute-model-ifc`, alle `check-mspdi-*` (7, met `check-mspdi-werktijd-minuten`), alle `check-p6xml-*` (8), alle `check-progress-import*` (4), `check-recorded-times-formats`, `check-xml-adapter-fidelity`, `check-xml-onleesbare-taakdatums` | 0 |
| groep 2: de 60 checks die XER-datumcellen schrijven of lezen (`git grep -l` op `act_start_date`, `act_end_date`, `cstr_date`, `last_recalc_date`, `target_start_date`; `xerInstant` staat in geen enkele test), plus `check-xer-corpusless-fidelity-gate` | 0 |
| MCP: `cases-doc-file`, `cases-import-bibliotheek`, `cases-sync2-integration`, `cases-xer-provenance` | 0 |
| `npm run typecheck` (en los zonder incrementele cache: `tsc -p tsconfig.json` en `-p tsconfig.tests.json`) | 0 |
| `npm run lint:fast` | 0 |
| `npm run verify:cycles` (nieuwe import `importDates` → `workdayRules`) | 0 |
| `check-xer-product-fidelity-x12.ts` met corpus, poortmodus | 1, zie hieronder |

X12 met corpus (`OPS_XER_CORPUS` staat op deze machine): regel A is OK, "geen nieuwe, verslechterde of
grotere cel over 8 bestanden". Rood staat alleen op de drie nuldoelregels (76 zesassige afwijkingen); dat
is volgens `.claude/rules/xer.md` met corpus bewust zo. Dezelfde run op de basisversie van de twee
parserbestanden geeft regel voor regel dezelfde uitvoer. De echte P6-bestanden dragen altijd een tijd per
cel; de fix raakt ze niet.

## Gewijzigde verwachtingen

Geen bestaande testverwachting is gewijzigd. Wat de fix aan gedrag verandert:

| gedrag | indeling |
|---|---|
| MSPDI, P6 XML en XER: een taakdatum zonder tijd op een urenkalender wordt D1/D2 in plaats van 00:00 (actuals, plandatums, beperkingen, deadline, baseline, vastlegging) | B3: fout, gerepareerd |
| XER: projectdatums zonder tijd op een urenkalender (statusdatum, `plan_start_date` als anker, `plan_end_date`) blijven een datum in plaats van `T00:00`; de motor leest ze met D5, D1 en D2 | B1: besloten specpunt §3.6 ("Projectdatums blijven zoals ingevoerd") |

## Niet getest en aandachtspunten

- P6 XML is alleen tot en met de laadnormalisatie getoetst, niet door laden, opslaan en heropenen. De rest
  van die keten is dezelfde code als bij MSPDI.
- De vastlegging is niet apart in de modus "datums zoals opgeslagen" getoetst. De code normaliseert hem
  (`documentActivation.ts:366`); de tegenproef toont na het laden plandatums 08:00/17:00.
- **Correctie (ronde 3).** Hier stond eerst dat een expliciete tijd op een werkelijke datum in dagmodus
  wegvalt door "de bestaande ankerregel van de dagmodus (spec §3.10, I8 in F5b)". Die verwijzing klopte
  niet. I8 gaat over het schrijven van 08:00 voor een datum zonder tijd. Hier stond de tijd (11:00 of
  00:00) al in de bron, en de lezer gooide hem weg. Dat is dataverlies bij het laden. Review ronde 3 heeft
  het als BLOKKEERT gemeld; de sectie "Ronde 3" hieronder repareert het.
- `typecheck` gebruikt een cache in de gedeelde `node_modules`; de losse `tsc`-run zonder cache bevestigt
  exit 0.

## Ronde 3 — een werkelijke datum met tijd op een scalaire kalender

### Stap 0

`git status -sb` was schoon. De merge van `origin/claude/uren-f2-kern` (`3c2ca60fe`) was een
fast-forward; HEAD werd `3c2ca60fe`. `npm run i18n:resolve` gaf daarna exit 1 met "er is geen `git merge`
bezig en HEAD is geen merge-commit": na een fast-forward is er niets samen te voegen.

### Oorzaak

De uur-modus-beslissing per kalender keek alleen naar de geplande datums: P6 XML naar
`PlannedStartDate`/`PlannedFinishDate`, MSPDI naar `Start`/`Finish`, `.mpp` naar start en einde. Staan die
op het anker 08:00 (de probe van de reviewer: een voltooide eindmijlpaal op 1 juni 08:00), dan blijft de
kalender scalair. De gedeelde parser (`importDates.ts:47`, dagtak) en bij `.mpp` `formatField` kapten dan een
werkelijk einde 11:00 of 00:00 af tot de datum. De laadnormalisatie maakte er 16:00 van (D2, D7 FINISH), ook
na IFC opslaan en heropenen. Volgens de reviewer bestond het afkappen al op `be58ba356`.

### Fix (in de bestaande precisiebeslissing, geen nieuwe laag)

- `src/services/p6/p6xmlReader.ts:860`: `actualDateRaw`, de bestaande regel "`Not Started` wint van
  werkelijke datums" als één helper. Het signaal (`:873-878`) telt nu ook `ActualStartDate` en
  `ActualFinishDate` mee; het lezen (`:968-969`) gebruikt dezelfde helper. Zo telt een vuldatum van een niet-
  gestarte activiteit ook niet als signaal.
- `src/services/msproject/mspdiReader.ts:332`: het signaal telt ook `ActualStart` en `ActualFinish`.
- `src/services/mpp/mppReader.ts:695`: het signaal telt ook `actualStartTs` en `actualFinishTs`.
- De toets blijft de bestaande ankerregel (`hasNonAnchorTime`, anker 08:00 bij MSPDI en P6 XML, het
  kalenderbegin bij `.mpp`).

### Adapters

| route | dezelfde vorm? | in deze fix |
|---|---|---|
| P6 XML | ja (de review) | ja |
| MSPDI | ja (gemeten: 11:00 werd `2026-06-01`, na heropenen 08:00/16:00) | ja |
| XER | nee: `act_start_date`/`act_end_date` staan al in de signaallijst, met elke tijd (`xerReader.ts:653-668`). Gemeten: de XER-gevallen van ronde 3 zijn groen zonder wijziging | niet nodig |
| `.mpp` | ja (gemeten met fixture E2, zie hieronder); niet gevraagd, wel dezelfde vorm | ja |

### Regressie en mutatiebewijs

- `tests/planning/check-import-datum-zonder-tijd.ts`, sectie "Ronde 3" (`:250`): voor P6 XML (de
  eindmijlpaal van de reviewer, via `readP6XMLDocuments`), MSPDI en XER, elk met 11:00 en met 00:00: lezer →
  laadnormalisatie → laden met berekening → IFC opslaan → heropenen. Per formaat een voorwaarde: zonder tijd
  op de werkelijke datums blijft de kalender scalair. Totaal nu 53 controles; de 26 van ronde 2 blijven groen.
- `tests/planning/check-mpp-import.ts`, fixture E2 (`:2661`): de mijlpaal van fixture E met een werkelijk
  einde 11:00 en 00:00, op lezerniveau. De fixturebouwer kreeg een optioneel werkelijk einde (offset 76).

| run | uitkomst |
|---|---|
| met fix | `check-import-datum-zonder-tijd` 53/53, exit 0; `check-mpp-import` 3101/3101, exit 0 |
| `p6xmlReader.ts` terug naar `3c2ca60fe` | exit 1, 8 rood: P6 XML 11:00 en 00:00 op alle vier stappen; na heropenen 16:00 |
| `mspdiReader.ts` terug naar `3c2ca60fe` | exit 1, 8 rood: MSPDI 11:00 en 00:00 op alle vier stappen; na heropenen 08:00/16:00 |
| `mppReader.ts` terug naar de vorige commit | exit 1, precies de 4 controles van fixture E2 rood |

Elke mutatie: bestand naar /tmp, vervangen, check gedraaid, teruggezet met `cp`, gecontroleerd met `cmp`.

Probes van de reviewer, paden omgezet naar deze worktree (`/tmp/laden3-probe/`):
`probe-literal-milestone.ts` exit 0, `BEHOUD-WERKELIJKE-TIJD []` (11:00 en 00:00 op alle vier stappen,
urenkalender, soort FINISH); `probe-adapters.ts` (ronde 2) exit 0, `FOUTEN []`.

### Checks (alle in de voorgrond, oordeel op exitcode)

| check | exit |
|---|---|
| groep 1, 34 checks: als ronde 2, plus alle `check-mpp-*` | 1, alleen door `check-mpp-fidelity`, zie bijvangst |
| groep 2, 62 checks: XER-datumchecks (nu 61, want de nieuwe check noemt ook XER-kolommen) plus `check-xer-corpusless-fidelity-gate` | 0 |
| MCP: `cases-doc-file`, `cases-import-bibliotheek`, `cases-sync2-integration`, `cases-xer-provenance` | 0 |
| `flock /tmp/ops-zwaar.lock npm run typecheck`, en los zonder incrementele cache | 0 |
| `npm run lint:fast` | 0 |
| `npm run verify:cycles` | 0 |
| `check-xer-product-fidelity-x12.ts` met corpus, poortmodus | 1, regel voor regel gelijk aan ronde 2: regel A OK, rood alleen op de drie nuldoelregels |

### Bijvangst: `check-mpp-fidelity` met corpus

`mpxj/junit/data/timephased-cost-rollup.mpp`: `finishExact` 9 → 6, `finishDiff` 0 → 3 (exit 1). Dit komt
niet uit ronde 3. Dezelfde uitkomst gemeten op `99049810a` (de basis vóór ronde 2), op `7876a78b2` (het eind
van ronde 2) en op deze head met `mppReader.ts` van `3c2ca60fe`. CI heeft geen corpus en ziet dit dus niet.
Oorzaak niet onderzocht. Niet in `knownbugs.md` gezet, omdat de orkestrator de nummers verdeelt.

### Gewijzigde verwachtingen

Geen bestaande testverwachting is gewijzigd. Wat de fix aan gedrag verandert:

| gedrag | indeling |
|---|---|
| een werkelijke datum met een eigen tijd (niet 08:00) op een verder scalaire kalender houdt zijn tijd, ook na opslaan en heropenen | B3: fout, gerepareerd |
| zo'n kalender wordt daardoor een urenkalender; de andere datums erop met 08:00 lezen dan letterlijk 08:00 in plaats van D1/D2. Dat is de bestaande promotieregel per kalender, die volgens spec §3.10 in F5a/F5b vervalt | B2: tussenstand |

### Open punt (niet gerepareerd)

Een werkelijk einde om precies 08:00 valt samen met het anker. Gemeten op de mijlpaal van de reviewer
(`/tmp/laden3-probe/anchor-0800-evidence.json`): de kalender blijft scalair, en het werkelijke einde wordt
16:00 op alle vier stappen. Hier geldt I8 wel: 08:00 is de schrijfvorm van een datum zonder tijd, dus de
lezer kan een echte 08:00 er niet van onderscheiden. Een oplossing vraagt een andere precisieregel (bijvoorbeeld
08:00 alleen als anker lezen in een door OPS geschreven bestand). Dat valt buiten de opdracht om binnen de
bestaande beslissing te blijven.
