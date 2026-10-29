# F5: rekenen buiten de Immer-producer

## Wijziging en afbakening

`runCPM` rekent synchroon op `cloneTasksForSolve`, bepaalt de resourcebelasting op dezelfde uitkomst,
en schrijft gewijzigde tijdvelden en afgeleide samenvattingsstatus in één store-update terug.
De solver, conventies, nivelleerder en UI zijn ongewijzigd. Gelijke taken houden hun referenties;
undo, handmatig rekenen, fouten en ‘datums zoals opgeslagen’ behouden hun bestaande route.

De verkenning wees op leesproxies: bij 5.000 taken kostte dezelfde solve op gewone objecten ongeveer
0,13–0,16 s, tegenover 0,66–0,81 s op de draft. Deze verkennende tijden zijn geen voor/na-bewijs.

## Methode

- Basis: `522589202`, nameting `095af2528`; alleen `src/state/slices/scheduleSlice.ts` wordt voor de oude bundel vervangen
  door de versie uit die commit. Alle andere code en bundelopties zijn gelijk. De SHA-256 van beide
  bronversies staat in het [ruwe resultaat](2026-10-22-f5-writeback.json).
- De bestaande `generateBenchmarkProject`, seed `0x5eed`, acht resources; 1.000/5.000/10.000 taken.
  Beide versies gebruiken een echte geïsoleerde Zustand-store, de gepinde Immer-versie en dezelfde invoer.
- Twee opwarmrondes, zeven meetparen per grootte en route. Oud/nieuw en nieuw/oud wisselen elkaar af
  in **één Node-proces**. Gemeten wordt de hele synchrone `runCPM`, inclusief store-writeback,
  history-after-verversing, resourcebelasting en view-rijen. Een eventuele duurwijziging gebeurt vóór
  de klok start, via de echte `updateTask`-actie; de duur wisselt tussen de oorspronkelijke waarde en +1 dag.
- Na ieder paar: dezelfde SHA-256 over alle taken, het volledige CPM-resultaat en de resourcebelasting
  (Maps/Sets als arrays). Ook de opwarmrondes worden op uitkomstpariteit gecontroleerd.
- Runtime: Node v24.22.0, V8 13.6.233.17-node.57, Linux, AMD Ryzen 7 3700U, 22 oktober 2026.
  Gedeelde machine: load average tijdens meetparen 1,87–2,83; daarom de afwisselende volgorde en
  rapportage van de verbetering per paar. In deze worktree liep tijdens de meting geen andere zware run.

## Resultaat

Mediaan in ms; verbetering = mediaan van `1 − na/voor` binnen ieder meetpaar.

| Taken | Route | Voor | Na | Minder tijd per paar |
| ---: | --- | ---: | ---: | ---: |
| 1.000 | Ongewijzigde F5 | 163,0 | 50,0 | 69,6% |
| 1.000 | F5 na duurwijziging | 247,5 | 143,0 | 42,0% |
| 5.000 | Ongewijzigde F5 | 831,6 | 168,5 | 79,7% |
| 5.000 | F5 na duurwijziging | 1.440,3 | 865,1 | 43,7% |
| 10.000 | Ongewijzigde F5 | 1.913,9 | 403,9 | 77,8% |
| 10.000 | F5 na duurwijziging | 2.875,4 | 1.514,0 | 45,1% |

Alle 54 meetparen inclusief opwarmrondes hadden gelijke uitkomsthashes. Bij 10.000 taken varieert
ongewijzigde F5 van 1.747–2.226 ms vóór tot 380–546 ms na; na duurwijziging van 2.501–3.294 ms vóór
tot 1.349–1.808 ms na. Iedere gemeten combinatie werd sneller.

Dit bewijst winst in de store-route, inclusief echt gewijzigde berekeningen. Het zijn geen browser-
of Tauri-eindtijden en geen vergelijking met de oudere browsernulmeting. Een losse browsernulmeting
onder wisselende machinebelasting is bewust buiten dit bewijs gehouden. Schermtekening, interactie,
geheugenpiek en andere datasets zijn niet gemeten.

## Reproduceren en regressie

```bash
node tests/planning/measure-cpm-writeback.mjs 522589202 /tmp/f5-writeback.json
bash tests/planning/run.sh check-cpm-writeback.ts check-recorded-dates.ts check-auto-calc-cpm.ts check-solve-input.ts
env -u OPS_XER_CORPUS -u OPS_MPP_CORPUS -u OPS_MPP_CRAWL bash tests/planning/run.sh
npm run measure:profiles
```

De meting verandert geen werkboom en maakt tijdelijke bundels die na afloop worden verwijderd.
Zij gebruikt geen prestatiedrempel. De nieuwe regressiecheck vergelijkt de volledige taakdata, het
CPM-resultaat en de resourcebelasting met de oude draft-route voor OPS/P6/MS Project in dagen en
uren, inclusief handmatige taken, hammock, voortgang en samenvattingen. Zij controleert daarnaast
atomische publicatie, behoud van invoer/referenties, cyclusfouten en handmatig rekenen met undo/redo.
De bestaande recorded-dates-check bewaakt onder meer de bijzondere F5-undo in die modus.

Validatie op de definitieve productcode: gerichte run, `npm run typecheck`, `npm run lint`,
prestatiemeting en volledige corpusloze planningssuite alle exit 0. De volledige suite bevatte
560/560 planningscases; alle vijf tijdzones (395 bundels per zone) waren groen, met de bestaande
prestatiepoorten actief.

`npm run measure:profiles` met de bestaande corpusinstellingen: exit 0, regel A gehouden.
P6 heeft geen cel-delta; het bestaande nuldoel van 76 afwijkingen blijft bestaan (onderliggende
X12-check exit 1, door de meetpoort als ongewijzigd nuldoel beoordeeld). MS Project: 661 bestanden,
2.196 checks, exit 0; corpusloze profielvangrails exit 0. Een eerdere volledige run met een brede
`OPS_MPP_CRAWL` is gestopt (exit 143) na de niet-gerelateerde corpuscheckbevinding in `knownbugs.md`
#175. De volledige herhaling hierboven gebruikt de corpusloze CI-instellingen.
