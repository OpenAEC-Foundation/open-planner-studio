# Grote nivelleervoorstellen zonder duizenden DOM-rijen

PR #478, 22 oktober 2026. Dit verbetert de weergave van het voorstel; de nivelleerberekening en
het volledige resultaat dat Toepassen verwerkt, zijn in deze PR ongewijzigd.

## Vergelijking

De bestaande productiebenchmark is gebruikt met dezelfde deterministische planning van 10.000 taken,
11.700 relaties en 5.718 toewijzingen. De datasetinhoud heeft in beide runs SHA-256
`a15b316a460e670d336598712d97c4fabe6d860c7cc221cc7cf67d4b2857f880`.

- Voor: 8.920 voorstelregels in de DOM; langste hoofdthreadtaak tijdens Berekenen 3.935 ms.
- Na: 19 voorstelregels en twee verborgen afstandsrijen in de DOM; langste hoofdthreadtaak 129 ms.
- Toepassen slaagde in beide runs en markeerde het document als gewijzigd.

Ruwe resultaten: [voor](nivelleervoorstel-voor.json) en [na](nivelleervoorstel-na.json).
Dit zijn elk één run op een gedeelde machine, geen stabiele snelheidsfactor of prestatiedrempel.
De totale berekentijd (79,3 s tegenover 45,4 s) is geen bewijs van een snellere nivelleerkern: de worker
is ongewijzigd en de machinebelasting verschilde. De eerste nulmeting op dezelfde dag liet met de
oude tabel 8.920 rijen en een hoofdthreadtaak van 2.840 ms zien. Een nameting tijdens zware
geheugendruk is verworpen en niet als prestatiebewijs opgenomen.

## Herkomst en herhalen

Node v24.22.0, Chromium 151.0.7922.34 headless, 1600×1000, Nederlands, productie-React,
Ryzen 7 3700U, 13,6 GiB RAM. De volledige omstandigheden staan in de JSON.

De builds zijn vooraf gemaakt met de bestaande benchmarkvlag. De oude build bevat de productcode
van `522589202`; de nieuwe bevat de tabelimplementatie van `4bb375eef`. De latere productwijziging
`77c588d53` voegt alleen lokale toetsroutering toe; de overige wijziging daarin typeert de testfixture.
De twee JSON-bestanden zijn gestart vanaf `77c588d53` met `--dist` naar de bewaarde builds.
Daarom beschrijft `conditions.commit` in die bestanden de launcher-checkout, niet de oude productbuild.
De bijbehorende bundels zijn `LevelingDialog-CDgMTAjN.js` (voor) en `LevelingDialog-BKTOPN_K.js` (na).
Hun SHA-256 is respectievelijk `357b162b0574b6cc1f08d0271802704386dd5300d411bccbbd154f9d415bcb9d`
en `cde51a5cf58e276e4ff9b9331b6e7e9e2aca2f3fdec86406db84aad77dfcf7aa`.

Voor een nieuwe vergelijking: bouw de twee productstanden apart en voer voor elke build uit:

```bash
npm run measure:large-plans -- --sizes 10000 --repeats 1 \
  --skip interaction,f5,autosave,recovery,save --dist <productiebuild> --out <resultaat.json>
```

De benchmark gebruikt echte klikken voor Berekenen en Toepassen. De brug leest alleen state.
De tabel maakt voor de taaknamen één index in plaats van een volledige zoeklus per verschuiving.
De virtuele tabel gebruikt de bestaande vensterberekening, vaste rijhoogte per tekstschaal,
een gemeten viewport, absolute aria-rijposities en een toetsenbordfocusbare scrollregio.

## Gedrag en controles

De bestaande browserroute in `leveling-background.spec.ts` is uitgebreid met 160 onafhankelijke
taken op één ploeg. De worker levert 159 verschuivingen. De route controleert het totale aantal,
minder dan 40 gemounte gegevensrijen, Ctrl+End/Ctrl+Home en zichtbaarheid van eerste en laatste
regel op 100% en 125%. Toepassen schrijft alle 159 verschuivingen, ook de niet-gemounte.

- `npm run typecheck`: exit 0.
- `npm run lint:fast`: exit 0.
- `node scripts/run-browser-tests.mjs tests/browser/leveling-background.spec.ts`: 2 tests groen, exit 0.
- `npm run verify:text-roles` en `npm run verify:gantt-boundaries`: exit 0.

De eerste onafhankelijke review op `4bb375eef` vond een ongetypeerde testfixture en een globale
Gantt-sneltoets die Ctrl+Home onderschepte. Beide zijn opgelost in `77c588d53`; de controles hierboven
zijn daarna opnieuw uitgevoerd. De onafhankelijke vervolgreview op `77c588d53` vond geen nieuwe
blokkerende bevindingen. Die controleerde beide TypeScript-configuraties zonder cache en testte de
echte tabel afzonderlijk met 8.920 regels: maximaal 27 gemounte gegevensrijen, native toetsenbordscroll,
eerste/laatste regel volledig zichtbaar, correcte aria-indexen, Tab/Shift+Tab en Escape. Via de echte
workerroute zijn alle 159 verschuivingen toegepast. De latere commits bevatten alleen dit meetbewijs.

Resterende beperking: de sectie met onopgeloste conflicten is niet gevirtualiseerd. Deze PR verandert
de oorzaakdetails daarvan niet; daarvoor bestaat afzonderlijk PR #419 (knownbug 121).
