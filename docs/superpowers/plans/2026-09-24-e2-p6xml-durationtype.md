# E2: klopt de P6-XML-labelwissel van #101 (`<DurationType>`)?

Kort: ja. #101 koppelt "Fixed Duration and Units" aan `DT_FixedDUR2` en "Fixed Duration and Units/Time" aan `DT_FixedDrtn`. MPXJ doet het net zo, en onze eigen `workRuleMapping.ts` ook. Er hoeft niets gerepareerd te worden. Wat nog ontbreekt, is een eigen citaat uit de Oracle-documentatie; dat heb ik niet opgehaald.

Onderzoek: Claude Opus 5.5 (uitvoerder-opus-laag), 2026-09-24, gelezen op kop `6e448f63` (`origin/claude/taaktypes-integratie`).

## Onze mapping (`src/services/p6/p6xmlReader.ts:131-136`)

| P6-XML-label | XER-code (#101) | betekenis | MPXJ (XML en XER) | oordeel |
|---|---|---|---|---|
| Fixed Duration and Units/Time | DT_FixedDrtn | duur en eenheden/tijd vast | FIXED_DURATION ⇔ "Fixed Duration and Units/Time" ⇔ DT_FixedDrtn | klopt |
| Fixed Duration and Units | DT_FixedDUR2 | duur en eenheden vast | FIXED_DURATION_AND_UNITS ⇔ "Fixed Duration and Units" ⇔ DT_FixedDUR2 | klopt |
| Fixed Units | DT_FixedQty | eenheden vast | FIXED_WORK ⇔ DT_FixedQty | klopt |
| Fixed Units/Time | DT_FixedRate | eenheden/tijd vast | FIXED_UNITS ⇔ DT_FixedRate | klopt |

De opdracht noemt de XER-code `DT_FixedDUR`. Die bestaat niet in de standaardset: de echte code is `DT_FixedDrtn`. `DT_FixedDUR` staat alleen in de testfixtures, en `workRuleMapping.ts:93` noemt het expliciet een niet-standaardcode.

## Bronnen

- (a) Oracle XER Data Map Guide / Data Dictionary: niet opgehaald (geen WebFetch op de Oracle-documentatie gedaan). De bewering over Oracle komt alleen uit het codecommentaar van #101 (`p6xmlReader.ts:125-129`). Dat is dus [VERMOED]: ik heb het niet zelf gezien.
- (b) Labels in de P6-XML-export (`DurationType`), geteld in het corpus (`testdata-crawl`, *.xml):
  - 313× "Fixed Duration and Units"
  - 132× "Fixed Duration and Units/Time"
  - 20× "Fixed Units"
  - Precies dezelfde labelteksten als in onze tabel.
- (c) MPXJ `src/main/java/org/mpxj/primavera/TaskTypeHelper.java`, regels 84-114 (via `gh api repos/joniles/mpxj`):
  - `XER_TYPE_MAP.put("DT_FixedDrtn", TaskType.FIXED_DURATION); // Fixed Duration and Units/Time`
  - `XER_TYPE_MAP.put("DT_FixedDUR2", TaskType.FIXED_DURATION_AND_UNITS); // Fixed Duration & Units`
  - `XML_TYPE_MAP.put("Fixed Duration and Units/Time", TaskType.FIXED_DURATION);`
  - `XML_TYPE_MAP.put("Fixed Duration and Units", TaskType.FIXED_DURATION_AND_UNITS);`
  - Samen (XER-tabel en XML-tabel) geeft dat precies de paren van #101. [BEVESTIGD]
- Het XER-corpus telt:
  - 16015× DT_FixedDUR2
  - 2158× DT_FixedDrtn
  - 155× DT_FixedQty
  - 27× DT_FixedDUR (niet-standaard)
  - Daar valt geen oriëntatie uit af te leiden. Dat kan wel, maar alleen met hetzelfde project in XER én in XML. Zo'n paar heb ik niet gezocht.

## `check-xer-p6xml-parity.ts`

- Case 4 pint dezelfde vier paren in een eigen tabel (`knownDurationTypeLabels`, r. 73-78).
- Die tabel is met de hand overgeschreven uit dezelfde bewering als de code. De check ziet dus een stille wijziging van de code, maar zegt niets over de juistheid: als beide fout zijn, blijft hij groen. Tegenover de bron is hij een tautologie.
- Aanbeveling (optioneel, geen fout): zet het MPXJ-citaat en de URL in het commentaar van case 4 als externe bron.
- Nog sterker: pin via `workRuleMapping.ts` (`XER_DURATION_TYPE_TOKEN` ↔ `P6_DURATION_TYPE_NAME`). Dan zijn de XER-lezer en de XML-lezer mechanisch aan elkaar gekoppeld.

## Oordeel

- #101 koppelt de labels goed aan de codes: [BEVESTIGD] via MPXJ en via onze eigen `workRuleMapping.ts`. De Oracle-bron zelf is [VERMOED]: niet zelf nagelezen.
- Geen fix nodig. Er hoeft geen check te veranderen.
