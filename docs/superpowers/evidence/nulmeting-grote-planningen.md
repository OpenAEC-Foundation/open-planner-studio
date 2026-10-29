# Nulmeting grote planningen (1.000 / 5.000 / 10.000 activiteiten)

Issue #405 deel 2, criterium 4, en #391 Must 4 (autosave en herstel bij grote planningen). Dit is een
**nulmeting**: de stand van `main` vóór de omzetting naar urenrekening. Er staan bewust **geen
prestatiedoelen of drempels** in; die stelt de eigenaar vast na deze meting. Er is geen productcode
gewijzigd om sneller te worden.

- Ruw resultaat: [`nulmeting-grote-planningen.json`](./nulmeting-grote-planningen.json) (alle herhalingen,
  per fase alle velden).
- Script: `npm run measure:large-plans` (`scripts/measure-large-plans.mjs` + `scripts/measure-large-plans-data.ts`,
  zie `scripts/README.md`).

## Omstandigheden

| | |
|---|---|
| Productcode | `main` op `012da2900` (merge van #401). Gemeten op branchcommit `d36833ddf`; die voegt alleen de meetscripts, het npm-script `measure:large-plans` en documentatie toe |
| Datum | 21-10-2026, 06:42–06:48 UTC |
| CPU | AMD Ryzen 7 3700U with Radeon Vega Mobile Gfx, 4 kernen / 8 threads, governor `schedutil` |
| RAM | 13,6 GiB |
| OS / kernel | Linux Mint 22.3, kernel 6.14.0-37-generic |
| Node | v24.22.0 (CI gebruikt Node 22) |
| Browser | Playwright Chromium 151.0.7922.34, **headless**, venster 1600×1000, schaal 1, taal nl-NL |
| Build | `vite build` in productiemodus (React productie), met alleen `VITE_OPS_BENCH_BRIDGE=1` voor de leesbrug `window.__OPS__`; geserveerd vanaf 127.0.0.1 |
| Herhalingen | 3 per grootte; elke herhaling een verse browsercontext (lege IndexedDB en localStorage) |
| Machinebelasting | gedeelde kantoor-pc met andere agents; load average bij de start 3,5 (1 min) / 7,6 (5 min) |

## Datasets

Alle drie uit de bestaande generator `generateBenchmarkProject` (dezelfde als *Benchmark…* in de app), seed
`0x5eed`, standaard acht resources. De generator is niet gewijzigd; 10.000 is alleen een andere `size`. Het script
rekent elke dataset één keer door (CPMSolver + `applyCpmResult`) en schrijft hem als IFC 4.3. De
inhoudshash (SHA-256 zonder de schrijftijd) staat in de JSON; twee runs gaven dezelfde hash.

| | 1.000 | 5.000 | 10.000 |
|---|---:|---:|---:|
| Taken totaal | 1.000 | 5.000 | 10.000 |
| Werktaken / mijlpalen / samenvattingstaken | 840 / 60 / 100 | 4.200 / 300 / 500 | 8.400 / 600 / 1.000 |
| Samenvattingsniveaus (WBS-diepte) | 2 (3) | 2 (3) | 2 (3) |
| Relaties FS / SS / FF | 820 / 205 / 145 | 4.145 / 1.011 / 694 | 8.237 / 2.073 / 1.390 |
| Relaties met lag of lead | 156 | 651 | 1.421 |
| Resources (arbeid / ploeg / materieel / onderaannemer) | 8 (2/2/2/2) | 8 (2/2/2/2) | 8 (2/2/2/2) |
| Toewijzingen (taken met toewijzing) | 554 (488) | 2.859 (2.527) | 5.718 (5.078) |
| Kalenders | 1: ma–vr 07:00–16:00, 8 u/dag, 15 feestdagperioden (2026–2028) | idem | idem |
| Berekend einde (start 05-01-2026) | 22-03-2029 | 13-02-2040 | 07-05-2053 |
| IFC-bestand | 0,9 MB | 4,5 MB | 9,1 MB |

Let op: de generator maakt lange ketens, dus de planningen lopen 3 tot 27 jaar. De feestdagen dekken alleen
2026–2028. Bij het openen staat er ook het startdocument van de app open (twee documenttabs).

## Resultaten

Mediaan (min–max) over 3 herhalingen, in ms. "Browser" = productiebuild in Chromium; "Node" = dezelfde
functie los, via esbuild, zonder browser en zonder store.

| Fase | Waar | 1.000 | 5.000 | 10.000 |
| --- | --- | ---: | ---: | ---: |
| Openen: bestand gekozen → Gantt getekend | browser | 544 (517–570) | 2.008 (1.946–2.192) | 3.741 (3.721–3.853) |
| Openen: bestand gekozen → taken in de store | browser | 481 (450–501) | 1.898 (1.836–2.065) | 3.564 (3.541–3.646) |
| Verticaal scrollen (Shift+wiel): wiel → tekening klaar, mediaan per stap | browser | 40,5 (35,3–41,2) | 43,6 (42,8–43,6) | 43,6 (43,5–44,4) |
| Verticaal scrollen: p95 per stap | browser | 49,5 (48,7–53,1) | 52,5 (51,2–53,0) | 52,8 (51,7–54,0) |
| Verticaal scrollen: duur van één Gantt-tekening | browser | 3,0 (2,8–3,1) | 3,5 (3,3–3,5) | 3,7 (3,6–3,9) |
| Zoomen (wiel): wiel → tekening klaar, mediaan per stap | browser | 39,0 (37,7–42,4) | 45,2 (43,4–47,8) | 48,5 (47,0–49,4) |
| Zoomen: p95 per stap | browser | 50,4 (49,6–50,8) | 54,3 (53,3–59,0) | 56,9 (55,9–69,4) |
| Zoomen: duur van één Gantt-tekening | browser | 2,7 (2,6–3,0) | 4,0 (3,3–4,2) | 4,3 (4,3–4,7) |
| F5: toets → Gantt getekend | browser | 207 (200–247) | 760 (746–775) | 1.489 (1.474–1.740) |
| F5: toets → nieuw rekenresultaat in de store | browser | 187 (180–218) | 697 (682–703) | 1.364 (1.350–1.552) |
| Nivelleren: Berekenen → voorstel zichtbaar | browser | 558 (553–589) | 8.445 (8.232–8.481) | 37.583 (37.010–37.980) |
| Nivelleren: Toepassen → Gantt getekend | browser | 344 (343–364) | 1.442 (1.441–1.468) | 3.004 (2.766–3.133) |
| Autosave-tick: serialiseren + IndexedDB | browser | 90,5 (82,0–97,0) | 277 (268–316) | 545 (492–557) |
| Autosave-tick: serialiseren (long task) | browser | 78 (75–84) | 239 (232–271) | 461 (415–476) |
| Autosave-tick: IndexedDB-transactie | browser | 12,2 (7,0–12,5) | 37,0 (36,3–43,9) | 81,1 (76,6–83,1) |
| Herstel: herladen → herstelvraag zichtbaar | browser | 484 (480–499) | 956 (951–1.123) | 1.631 (1.551–1.658) |
| Herstel: Herstellen → Gantt getekend | browser | 150 (140–160) | 466 (438–517) | 812 (793–814) |
| Opslaan: Ctrl+S → bestand klaar (download) | browser | 67 (64–73) | 238 (229–241) | 821 (495–924) |
| Rekenen (`CPMSolver.solve`) | Node | 30 (27–51) | 113 (80–168) | 178 (162–180) |
| IFC schrijven (`writeIFC`) | Node | 59 (47–64) | 223 (206–246) | 431 (428–527) |
| IFC lezen (`readIFC`) | Node | 144 (116–156) | 408 (366–474) | 826 (777–852) |

Grootte van de geschreven IFC (opslaan / autosave-snapshot): 0,91 / 0,93 MB, 4,6 / 4,7 MB en 9,3 / 9,4 MB.

## Hoe er gemeten is

Elke herhaling volgt dezelfde route met echte browserinvoer. `window.__OPS__` leest alleen state; het vervangt
geen gemeten handeling. Meetinstrumenten in de pagina zijn passief: een Long Tasks-observer, een wrapper om
`fillRect` die het begin van een Gantt-tekening herkent (`__OPS__.gantt.paintCount` telt alleen in een
dev-build, knownbugs 165), een wrapper om IndexedDB-transacties van `ops-recovery` en een wrapper om de
download-klik. Een store-subscription noteert het eerste moment dat de store de verwachte stand heeft.

1. **Openen**: lintknop *Openen*, bestand via de bestandskiezer van Playwright. Eind = einde van de eerste
   Gantt-tekening ná het moment dat de taken in de store staan.
2. **Scrollen en zoomen**: muis midden op de Gantt; 30 stappen Shift+wiel (300 px) en 16 stappen wiel
   (8 × in, 8 × uit). In de standaard scrollmodus `drag` scrolt Shift+wiel de rijen en zoomt het wiel zonder
   toets (`src/utils/ganttWheel.ts`). Per stap: tijdstempel van het wheel-event → einde van de volgende
   Gantt-tekening. Het verschil met de tekenduur is vooral wachttijd op de volgende frame; de laagste
   stap in deze meting was 35 ms.
3. **F5**: toets F5 boven de Gantt. Er viel geen autosave-tick in dit venster (gecontroleerd).
4. **Nivelleren**: tab *Resources* → *Nivelleren* → *Berekenen*; eind = de knop *Toepassen* is actief
   (herkend per frame, ±17 ms). Daarna *Toepassen*; eind = Gantt getekend na de gewijzigde taken.
5. **Autosave-tick**: de eerste crashherstel-ronde na het nivelleren (de throttle van 10 s laat hem
   vanzelf komen). Tick = begin van de long task die vlak vóór de IndexedDB-transactie begint (het
   serialiseren) → einde van die transactie. Dit is afgeleid zonder productcode; bij 1.000 taken is het
   serialiseren nog net een long task (> 50 ms).
6. **Herstel**: pagina herladen (beforeunload geaccepteerd). Eerst de tijd vanaf de navigatiestart tot de
   herstelvraag zichtbaar is (app-start plus snapshot lezen en parsen), dan *Herstellen* → Gantt getekend.
7. **Opslaan**: Ctrl+S op het herstelde, gewijzigde document. In deze omgeving heeft het bestand uit de
   bestandskiezer geen schrijfbare handle; de app kiest dan de download (dezelfde route als
   `tests/browser/ifc-schema.spec.ts`). Eind = de download-klik van de app.

De app-start tot de welkomstdialoog duurde 0,8–0,9 s, onafhankelijk van de grootte (staat per herhaling in
de JSON als `bootToWelcomeMs`).

## Niet gemeten

- **De Tauri-desktopapp.** Die draait niet op deze machine (geen Rust-build, geen display). Opslaan en
  autosave lopen daar via bestanden in `appDataDir` in plaats van IndexedDB of een download; die getallen
  kunnen dus anders zijn.
- **Opslaan naar een bestaande bestandshandle** (File System Access, Chromium-web) en opslaan naar de site
  (`window.openaecHost`). Playwright geeft geen schrijfbare handle; gemeten is de downloadroute.
- **XER, MSPDI en `.mpp` openen.** Alleen het eigen IFC-formaat. Voor XER zie
  `docs/superpowers/plans/2026-10-07-perf-grote-planningen.md`.
- **Andere interactie**: taak selecteren, een veld wijzigen, slepen, de tabelweergave, het histogram en
  rapporten/afdrukken. De opdracht vroeg alleen scrollen en zoomen in de Gantt.
- **Echte schermverversing.** De meting eindigt bij het einde van de tekenaanroep op het canvas, niet bij de
  pixels op het scherm; headless is er geen GPU-compositor.
- **Andere hardware, Firefox en Safari.** Eén machine, alleen Chromium.
- **Planningen met meer resources of kalenders.** De generator maakt één kalender en acht resources.

## Opvallende waarnemingen

Geen doelen; wel de grootste getallen, zodat de eigenaar kan kiezen.

1. **Nivelleren (Berekenen) bij 10.000 taken: 37,6 s** (5.000 taken: 8,4 s; 1.000 taken: 0,56 s). De tijd groeit
   veel sneller dan het aantal taken. Daarnaast blokkeert de hoofdthread in die fase toch één keer 2,8–4,1 s,
   terwijl de berekening in een Web Worker loopt (knownbugs 164, vermoedelijk de voorsteltabel met 8.920 rijen).
2. **Openen bij 10.000 taken: 3,7 s**, met een langste blokkade van 1,9–2,1 s. Het lezen van de IFC alleen kost in
   Node 0,83 s.
3. **F5 bij 10.000 taken: 1,5 s**, terwijl de solver zelf in Node 0,18 s kost. Ongeveer 1,2 s zit dus buiten de
   solver zelf. Waar precies, is niet uitgesplitst (geen profiel).
4. **Autosave-tick bij 10.000 taken: 0,55 s, waarvan 0,46 s één blokkade** (serialiseren). Die tick komt
   hoogstens elke 10 s zolang er gewijzigd wordt.
5. **Herstel bij 10.000 taken**: 1,6 s tot de herstelvraag en 0,8 s om te herstellen.
6. **Scrollen en zoomen** blijven tot 10.000 taken onder 4,5 ms tekentijd per frame; per wielstap 44–49 ms
   (mediaan), vooral wachttijd op de frame.

**Herhaalbaarheid op deze machine.** Binnen deze meting is de spreiding klein (meestal < 10 %). Een eerdere
volledige run op dezelfde dag met dezelfde productcode (branchcommit `84ed60efe`, load average 4,2 en andere
agents actief) gaf voor de zware fasen 1,5 tot 2,3 keer hogere waarden (bijv. nivelleren bij 10.000 taken 85,5 s,
openen 7,7 s, F5 3,2 s). Vergelijk dus alleen metingen op een rustige machine, en kijk naar `loadAvgAtStart` in
de JSON.

## Opnieuw meten

```bash
npm run measure:large-plans                     # 1k/5k/10k, 3×, ±7 min; JSON naar build/measure-large-plans/
npm run measure:large-plans -- --sizes 1000 --repeats 1 --out /tmp/proef.json
```

Eenmalig nodig: `npx playwright install --only-shell chromium`. Draai de meting niet tegelijk met andere zware
runs. Exit 0 = alle fasen gemeten; exit 1 = een fase mislukte of gaf een time-out (staat in de JSON).
