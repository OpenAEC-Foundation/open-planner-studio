# MCP-bridge-tests

Headless regressietests voor de AI-assistent-laag (`src/services/mcp/`): dispatcher, schema-
validatie, de `planner_*`-tools en `planner_batch`. Ze draaien tegen de **échte** Zustand-store
(`src/state/appStore`), niet tegen een mock — dus precies de code die ook achter de Tauri
MCP-bridge (`src-tauri/src/mcp_bridge.rs`) draait, alleen zonder de Rust/HTTP-laag eromheen.

## Draaien

```bash
bash tests/mcp/run.sh                 # alle cases-*.ts
bash tests/mcp/run.sh cases-smoke.ts  # één specifiek case-bestand
bash tests/mcp/run.sh cases-smoke.ts cases-batch.ts   # meerdere, door elkaar
```

Exit 0 = elk gedraaid case-bestand groen, exit 1 = minstens één gefaald. `run.sh` bundelt elk
`cases-*.ts`-bestand apart met esbuild (komt met Vite mee) en draait het op Node — geen extra
testrunner-dependency. Een `run.sh`-argument dat geen bestaand `cases-*.ts`-bestand in `tests/mcp/`
is, telt als `BUILD-FAIL` en zet de exitcode op 1 (zie *Valkuilen* hieronder).

Een gerichte run (met argumenten) draait uitsluitend de genoemde case-bestanden — er is hier geen
apart "volledige poort"-blok zoals in `tests/planning/run.sh`: elk `cases-*.ts`-bestand is al een
zelfstandige eenheid, dus een gerichte run mist niets stilzwijgend behalve de expliciet
weggelaten bestanden.

## Hoe het werkt

Elk `cases-*.ts`-bestand importeert uit `harness.ts` (`test`, `assert`, `assertEq`, `run`,
`useAppStore`, `appStoreContext`, `makeMcpContext`), registreert tests met `test(naam, fn)` en
sluit af met `await run()`. `harness.ts` zet vóór elke `@/`-import een minimale DOM-shim
(`document.createElement`/`documentElement`) — zonder die shim klapt de store-import in Node stuk,
omdat slices canvas-/renderer-code en i18n-initialisatie meeslepen. `makeMcpContext(...)` bouwt een
`McpContext` (het object dat elke `planner_*`-tool als eerste argument krijgt) met een aantoonbaar
bij dezelfde storecontext horende `transactions`-binding — gebruik dat i.p.v. zelf een context te
verzinnen.

`run()` print per test `PASS`/`FAIL` en beëindigt het proces met code 1 zodra er ook maar één test
faalt binnen dat bestand; `run.sh` telt daarna zelf `PASS`/`FAIL` per case-bestand en print een
`TOTAAL: X groen, Y rood`-regel.

## Een test toevoegen

De conventie staat ook bovenin `run.sh`: leg een nieuw `cases-<naam>.ts`-bestand naast de
bestaande in `tests/mcp/`, naar het patroon van `cases-smoke.ts`. `run.sh` globt `cases-*.ts` bij
een volledige run — aan het script zelf hoeft niets te veranderen. Gebruik `harness.ts` voor de
teststructuur en `makeMcpContext(...)` voor de tool-context; roep de MCP-tools rechtstreeks aan
(niet via de Tauri-bridge) en lees het resultaat terug uit `useAppStore.getState()`.

## Valkuilen

- **Oordeel altijd op de exitcode van `run.sh`, nooit op de tail van de uitvoer.** Een mislukte
  esbuild-bundeling van één `cases-*.ts`-bestand print `BUILD-FAIL` en telt mee in `FAIL`, maar de
  overige bestanden draaien gewoon door — de laatste regels van de uitvoer kunnen dus prima groen
  ogen terwijl de exitcode 1 is.
- Een `grep` op faalregels (`FAIL`/`BUILD-FAIL`) is een handig extraatje om te zien wélk
  case-bestand rood staat, maar geen vervanging voor de exitcode.
- Zie `tests/planning/README.md` voor de gedeelde-fixtures-conventie (`tests/fixtures/`) — o.a.
  `cases-recorded-dates.ts` hier deelt zijn IFC-fixture met `tests/planning/check-recorded-dates.ts`.
