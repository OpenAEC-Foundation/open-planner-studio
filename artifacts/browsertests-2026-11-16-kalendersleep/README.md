# Kalendersleep: wacht op de balk vóór het scrollen

Onderdeel van [issue #958](https://github.com/OpenAEC-Foundation/open-planner-studio/issues/958).
De correctie staat op basis `275a1424f6932b3b205e27d7eeacad3616192572`.

## Rood bewijs uit CI

[Run 43640587706, poging 1, browserdeel 3-4](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/43640587706/job/132587075816)
faalt in `gantt-drag-calendars.spec.ts`, bij het scenario
“Dag: een kalendertijdtaak schuift op de klok, niet op werkuren”. Na de muisknop verwacht de
test cursor `grabbing`, maar hij krijgt vijf seconden lang `default`.

De test heeft op die rode commit en op de gekozen basis dezelfde Git-blob:
`e320432a12b75920cede69085a40a8ea49a81605`.

De opgeslagen trace toont de oorzaak:

- `showBar` zet de begindatum, maar `call@6282` vindt nog geen balkpunt en geeft `false` terug.
  De scrollstap wordt daarmee overgeslagen.
- De eerste twee peilingen (`call@6284` en `call@6286`) krijgen nog `null`, bij paintcount 8.
- Daarna verschijnt een stabiel balkpunt op **x=2513, y=272**, bij paintcount 11.
  De bestaande stabiliteitscontrole wacht hierop, maar scrollt niet alsnog.
- `call@6294` beweegt de muis naar **x=2543, y=272**; `call@6296` drukt daar de knop in.
  Het venster is 1600 pixels breed. De test klikt dus buiten beeld.

`getTaskBarRect` leest de rijen van de laatst gemaakte renderer; een nog ontbrekende taak geeft
`null`. `useCanvasLayer` plant de volgende tekening met `requestAnimationFrame`.
Een geslaagde store-fixture betekent daarom niet dat haar balk al meetbaar is.

De eenmalige diagnostische herhaling van alleen de mislukte jobs, poging 2 van dezelfde run,
is op 16 november om 05:24 afgerond: browserdeel 3-4 slaagt. De kalendersleep is daarmee een
bevestigde hapering; alleen opnieuw draaien repareert haar niet. Browserdeel 4-4 blijft rood op
de instellingenverwachting (3 verwacht, 4 gevonden). Die aparte fout is in de gekozen main-basis
al gerepareerd via #961, merge `73e6c7dd77cb5234616e5b596906648347a844ed`.

## Kleinste correctie

`showBar` gebruikt de bestaande `settledPoint` ook vóór het bepalen van de scroll.
Daarna blijven de bestaande scroll, wacht op een nieuwe tekening, geometrielezing, echte
muisgebaren, cursorcontrole en exacte datum-/duurcontroles behouden. Geen productcode,
testselectie, timeout of retry gewijzigd.

## Gerichte foutproef en herstel

De oude test slaagt bij gewone timing **3 keer**, exit 0. Dat weerlegt de vastgelegde hapering niet.
Voor een gerichte proef is uitsluitend vóór de eerste sleep in het kalendertijdscenario tijdelijk
de eerste geometrielezing op `null` gezet, zoals in de CI-trace. De oorspronkelijke lezer herstelt
zichzelf direct bij die eerste aanroep:

```ts
await page.evaluate(() => {
  const driver = window.__OPS__!.gantt;
  const original = driver.taskBarPoint;
  driver.taskBarPoint = () => {
    driver.taskBarPoint = original;
    return null;
  };
});
```

De oude test met deze proef geeft **1 failed, exit 1**, op dezelfde cursorcontrole. Ook de lokale
trace toont het balkpunt x=2513 en de muisklik x=2543. De gecorrigeerde test met exact dezelfde
proef geeft **1 passed, exit 0** (12,3 s). De twee proefbestanden verschillen alleen in de drie
regels van de permanente correctie.

Na iedere proef is het normale bronbestand met `cp` teruggezet en met SHA-256 gecontroleerd:

- Basis: `18de62f16ff8036ec879b451578fcbcf59209d6fc2fd3d18cd4407c71254a961`.
- Correctie: `3d91a05158cc38fb622176be40b726232a8d4cea0e964078b2a998377c2b4c4d`.

De tijdelijke proef staat niet in de uiteindelijke test. Daarna slaagt het volledige bestaande
spec-bestand bij gewone timing: **3 passed, exit 0** (28,9 s). Daarmee zijn ook de eigen kalender
onder werkdagencompressie en de randsleep/body-sleep van een gesplitste taak gecontroleerd.

De proeven draaiden uitsluitend op dit ene spec-bestand, met één worker, nul retries,
`flock /tmp/ops-zwaar.lock`, een tijdgrens en `NODE_OPTIONS=--max-old-space-size=2048`, op Node
v24.22.0. De volledige browsersuite draait in CI. Een eerdere poging kreeg het gedeelde slot
niet op tijd en heeft geen test uitgevoerd; die telt niet als rood bewijs.

De lokale bestanden en traces staan onder `/tmp/ops-browsertests-ochtend-2026-11-16/`:
`gantt-drag-calendars-proef-rood.ts`, `gantt-drag-calendars-proef-groen.ts`, `proef-rood/trace.zip`
(in de scenariomap), `proef-rood.log`, `proef-groen.log` en `normaal-hele-spec.log`.
