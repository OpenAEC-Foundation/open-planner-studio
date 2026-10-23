# F2 — fixronde 2, deel B (laden), 23 oktober 2026

Het BLOKKEERT-punt uit review ronde 2, deel B, is opgelost. Een datum zonder tijd uit MSPDI, P6 XML of XER
blijft nu een datum tot de laadgrens, en de laadnormalisatie maakt er D1 of D2 van. Een expliciete `T00:00`
blijft een moment. Er is een regressie met mutatiebewijs, en de tegenproef van de reviewer is groen. Het
VERVOLG-punt staat als ingang 272 in `knownbugs.md`. Dit verslag is opgesteld door een AI-assistent; de
volledige CI is niet afgetekend.

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
- Niet veranderd: op een MSPDI- of P6 XML-kalender in dagmodus valt elke tijd weg, ook een expliciete
  `T00:00` op een werkelijke datum. Dat is de bestaande ankerregel van de dagmodus (spec §3.10, I8 in
  F5b), niet de fout van deze review. Of dat bij F2 hoort, is niet onderzocht.
- `typecheck` gebruikt een cache in de gedeelde `node_modules`; de losse `tsc`-run zonder cache bevestigt
  exit 0.
