# Vertaalstraat: keuzes in de code die niet uit het ontwerp blijken

Het ontwerp van de vertaalstraat staat in `docs/superpowers/specs/2026-10-09-vertaalstraat-design.md` en
`scripts/README.md`. Een paar kleinere keuzes in `scripts/translate/` staan daar niet en zouden zonder uitleg
"verbeterd" kunnen worden. Ze stonden als commentaar in de code en staan nu hier.

## Gevolgen

- `pt` zoekt in de Portugees-Europese TBX (`TBX_FILES` in `common.ts`), niet in de Braziliaanse: de bestaande
  pt-UI is Europees-Portugees (*ficheiro* staat in ruim tweehonderd teksten, *arquivo* nergens). Een termbase uit
  de Braziliaanse lijst zou de straat elke bestaande tekst als afwijkend laten melden.
- `normLabel` in `docs.ts` haalt de afsluitende witruimte, punten en `…` weg met een lus die achteruit scant, niet
  met een regex als `/[\s….:]+$/`. Volgens het weggehaalde commentaar voorkomt dat ambigu backtracken op lange
  reeksen punten (niet nagegaan); het werk blijft lineair.
- `pairChanged` in `docs.ts` koppelt ongekoppelde secties alleen op volgorde als er tussen twee gekoppelde secties
  evenveel oude als nieuwe staan. Bij een ongelijk aantal krijgt geen sectie een `previous`: liever opnieuw
  vertalen dan de agent de vertaling van een andere sectie als uitgangspunt geven.
- `avoidSoft` in `i18n/docs-literal.json` maakt een avoid-woord in de docs-poort zacht. Een woord komt daar alleen
  bij na een gemeten valse treffer, want elk woord in die lijst zet de harde controle voor die taal uit.
- `packageText` in `ui.ts` schrijft een pakket met elk item op één regel in plaats van gewone JSON-opmaak: dat
  scheelt de vertaalagent ongeveer 30 % tekst en blijft per sleutel leesbaar.
- `archive` in `cli.ts` zet ook de nalees-bestanden (`review-<pakket>.json`) opzij. Anders leest de hersteller
  van een nieuw pakket met dezelfde naam de bevindingen van de vorige ronde.
