# Resourcebibliotheek-regressietests

Headless tests voor de app-globale resourcebibliotheek (spec B1/B1.1, zie `docs/library.md`):
`librarySlice`, pool-IFC-export/-import, herkomststempels, i18n-meervouden van de
bibliotheek-UI, hoeveelheidsverdeling, en het bezettingsoverzicht (B1b, `src/services/library/occupancy.ts`).
Ze draaien tegen de **échte** Zustand-store, headless via een esbuild-bundel — zelfde model als
`tests/planning/run.sh`.

## Draaien

```bash
bash tests/library/run.sh                       # alle check-*.ts (geglobd) + de compile-afdwinging
bash tests/library/run.sh check-occupancy.ts     # één check
bash tests/library/run.sh check-occupancy.ts check-pool-ifc.ts   # meerdere, door elkaar
```

Exit 0 = alles groen, exit 1 = minstens één afwijking. De tsc-compile-afdwinging
(`tsconfig.check.json` — fixture-/type-volledigheid, want de hoofd-tsconfig sluit `tests/` uit)
draait **altijd** mee, ook bij een gerichte run: hij typecheckt alle `check-*.ts` in één programma
en is geen los te schakelen kostenpost.

Een gerichte run met argumenten draait uitsluitend de genoemde check(s) — de overige checks
worden dan niet uitgevoerd. Een argument dat geen bestaand `check-<naam>.ts`-bestand in
`tests/library/` is, print een `XX`-foutregel en zet de exitcode op 1; de overige (wél geldige)
argumenten draaien gewoon door.

## Checks

| Bestand | Dekt |
|---|---|
| `check-library-ops.ts` | zuivere bibliotheekoperaties (CRUD op library-items) |
| `check-library-slice.ts` | `librarySlice`-store-acties |
| `check-demo-library.ts` | de meegeleverde demobibliotheek |
| `check-projectinfo-guard.ts` | guard rond projectinfo/bibliotheekbinding |
| `check-pool-ifc.ts` | pool-IFC-export/-import |
| `check-ifc-hostile.ts` | vijandige/corrupte IFC-invoer voor de bibliotheeklaag |
| `check-i18n-plurals.ts` | CLDR-pluralvormen in de bibliotheek-UI-teksten |
| `check-occupancy.ts` | `computeLibraryOccupancy` — het bezettingsoverzicht (B1b) |
| `check-distribute.ts` | hoeveelheidsverdeling over resource-toewijzingen |

## Een test toevoegen

Voeg een nieuw `check-<naam>.ts`-bestand toe naast de bestaande, naar het patroon van
`check-occupancy.ts` (eigen mini-assertielaag: een `eq`/`ok`-achtige helper die bij een afwijking
`fails++` doet en de regel print — zie *Valkuilen* hieronder voor het printformaat). Anders dan
eerder — en net als `tests/planning/run.sh` en `tests/mcp/run.sh` — kent deze suite nu wél een
glob: `run.sh` bouwt `ALL_CHECKS` door `"$DIR"/check-*.ts` te lezen, en `tsconfig.check.json`s
`include` bevat zelf het patroon `check-*.ts` (TypeScript ondersteunt wildcards in `include`). Een
nieuw bestand dat aan het naampatroon voldoet draait en typecheckt dus automatisch mee, zonder een
lijst bij te werken. (Tot 2026-09 waren dit twee handonderhouden lijsten die uit elkaar konden
lopen — `check-distribute.ts` ontbrak toen in de tsconfig, draaide dus wél maar werd nooit
getypecheckt. Die klasse fout kan nu niet meer optreden.)

## Valkuilen

- **Oordeel altijd op de exitcode, nooit op de tail van de uitvoer.**
- Deze suite print zijn faalregels **ingesprongen**: elk `check-*.ts`-bestand gebruikt
  `console.log(\`   XX ${msg}\`)` (drie spaties vóór `XX`), niet `console.log('XX ...')` aan het
  regelbegin zoals `tests/planning/`. Een `grep -c '^XX'` geeft hier dus **misleidend 0** terwijl
  de suite rood staat (gemeten 2026-07-28, zie ook `CLAUDE.md`). Gebruik `grep -c 'XX '` als je
  toch wilt tellen, en laat de exitcode altijd het oordeel vellen.
- De tsc-compile-afdwinging faalt los van de losse checks: een rode `tsc`-regel bovenin de uitvoer
  betekent een fixture/type-gat, geen kapotte testlogica.
- Een mislukte esbuild-bundeling van een check breekt de run niet af, maar verbergt hem ook niet:
  `bundle_check` (bevinding K9b, hetzelfde patroon als `tests/planning/run.sh`) dempt alleen
  esbuilds STDOUT-groottemelding — STDERR (de compilefout) blijft zichtbaar — print een
  `XX  bundelen mislukt: ...`-regel, zet de exitcode op 1, en laat de overige checks gewoon
  doordraaien. Vóór deze fix demptte `run_check` STDOUT én STDERR (`>/dev/null 2>&1`) zonder de
  `if`-vorm: een kapotte `check-*.ts` gaf dan NUL regels uitvoer en `set -e` doodde de rest van de
  run vóórdat `exit "$STATUS"` bereikt werd.
