# XER lezen: duur, rest en lag in werkuren

XER draagt duur, rest en lag als uren (`target_drtn_hr_cnt`, `remain_drtn_hr_cnt`, `lag_hr_cnt`). `readXerProject`
neemt een activiteit in de urenmaat, met de minuten uit het bestand en zonder afronding op hele dagen, ook op een
kalender zonder kloktijden (spec alleen-uren, `docs/superpowers/specs/2026-10-20-alleen-uren-design.md` §3.10; T15).
Alleen een activiteit met de OPS-duureenheid uit een eigen export leest anders: via `readMeasure`, met
`keepSourceMinutes`, zoals in de regel `xer` (3) en in de P6 XML-lezer (ADR 0265). Uren met zes decimalen worden de
hele minuut als het verschil ruis is, en een echte breuk blijft (`sixDecimalHoursToMinutes`, ADR 0322), voor duur, rest
uit het bestand en lag.

## Gevolgen

- Het dagengetal (`scheduleDuration`) is de duur in minuten gedeeld door de werktijd per dag van de effectieve
  kalender (`hourTaskScheduleDuration`: de blokken van een uurkalender, anders de uren per dag van de kalender).
  `createDefaultTaskTime` krijgt dat dagengetal met de eenheid `hours` en zonder kalender, en zet dan
  `durationMinutes` op het dagengetal maal 60 en een einde in werkdagen. `readXerProject` overschrijft daarna het
  einde, de vroege en late datums en `durationMinutes` met de waarden uit het bestand; die toewijzingen dragen de
  uitkomst (`check-xer-reader.ts` 9: 16 uur wordt 960 minuten).
- Op een kalender met een lege `clndr_data` waarvan `inferBlankCalendarBands` de blokken afleidde (ADR 0392), en
  alleen als die kalender in uurmodus is, kan het geplande venster de duur herstellen: liggen er tussen geplande
  start en einde meer dan 0 werkminuten en wijkt dat aantal hoogstens één dag (de uren per dag van de kalender, of 8
  bij 0) van de bronduur af, dan wordt het de duur. Reden uit het weggehaalde commentaar: zonder blokken in het
  bestand gaat een deel van de laatste dag verloren, en een groter verschil betekent dat het venster planningsruimte
  bevat en geen tweede duur is. `check-xer-reader.ts` 3b eist het einde van zo'n taak met een niet-hele dagduur.
- De rest is `remain_drtn_hr_cnt` met de regel van de duur; is die leeg, dan heeft de taak geen `remainingMinutes`.
  Een taak met status `STARTED`, `CP_Drtn` en een gelezen `complete_pct` krijgt in plaats daarvan de duur maal
  (1 − voortgang) als rest, op de hele minuut (`Math.round`), omdat die waarde berekend is en geen bronwaarde. Welke
  kolom de voortgang levert, staat in ADR 0395. `check-xer-status-afleiden.ts` 117-12 eist 720 minuten voor 16 uur
  op 25 %, met 14 uur rest in het bestand.
- `lagMinutes` is `lag_hr_cnt` met dezelfde regel (`check-xer-reader.ts` 12: 1,5 uur wordt 90 minuten, −2 uur
  −120), en `lagDays` de lag gedeeld door de uren per dag van de projectkalender. Een lagrecord uit een eigen export
  telt zoals in de regel `xer` (3) en ADR 0265 (`lagRecordHolds`); twee relaties met dezelfde voorganger en hetzelfde
  type naar één opvolger maken het record ongeldig.
- Het relatietype leest `PR_FS`, `PR_SS`, `PR_FF`, `PR_SF` en de kale tokens `FS`, `SS`, `FF` en `SF`, zonder
  hoofdlettergevoeligheid; een onbekend token wordt FS met een terugval in het verslag. De kale tokens komen uit
  andere schrijvers dan P6 (bevinding 9 van `docs/superpowers/plans/2026-09-24-fable-critreview-pr109.md`); zonder
  alle vier viel een kaal `FF` op FS (`check-xer-reader.ts` 29 en 30).
- Een FS zonder lag krijgt `p6StartAtPredecessorFinishBoundary` als de kalender van de voorganger in uurmodus is, het
  geplande einde van de voorganger gelijk is aan de geplande start van de opvolger en op het einde van een werkblok
  van die dag valt (`check-xer-reader.ts` 3h). De P6 XML-lezer volgt die regel (ADR 0265).
