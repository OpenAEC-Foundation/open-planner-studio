De integratie van 27 oktober krijgt de gecontroleerde PR-basis expliciet via
`PERF_BASE_REVISION` uit het PR-event. Het harnas controleert SHA, voorouderschap,
gelijke dependencies en uitsluitend de histogramhook als productverschil. De vier
browsermetingen en bronherkomst blijven behouden. Eerdere cijfers gelden alleen
voor hun historische basis; de nieuwe CI moet de geïntegreerde head bewijzen.

# Histogramhover meten

Deze meting hoort bij de luie taak- en resourceindexen in
`useGanttHistogramInteraction.ts`. Voer haar uitsluitend uit in GitHub CI.
De workflow `measure-gantt-hover.yml` kiest expliciet mee wanneer de PR-tekst
`<!-- meet-gantt-hover -->` bevat én de PR haar eigen workflow-, meet- of
histogramtestbestanden wijzigt. Er is geen meetpoort voor gewone product-PR's.

De workflow controleert typen, lint en de bestaande histogramroutes. Daarna
voert `run.py` het uitgebreide bestaande hoverscenario viermaal uit: voor,
na, na, voor, op dezelfde runner, met nul retries en begrensde looptijden.
De productbasis wordt expliciet vastgelegd door het PR-event. Alleen het testharnas wordt naar de
baseline gekopieerd; de productboom daar blijft ongewijzigd.

De grote fixture bevat 10.000 taken, 32 resources en 40.000 toewijzingen over
twee dagen. CPM wordt niet uitgevoerd; de resourcebelasting staat vooraf als fixture. Een
echte mousemove gaat vervolgens door het bestaande canvas, de bestaande
300-ms-hovertimer, de hook en de echte tooltip in de DOM. Het scenario meet
de eerste vraag, bewegen binnen dezelfde dag, vier nieuwe dagvragen,
nieuwe taak-/resourcearrays en een gekozen materiaalresource.

`eventToTooltipMs` loopt vanaf ontvangst van de muisbeweging tot de volledige
verwachte tooltiptekst in de DOM staat. De vaste 300 ms blijft daarin zitten.
`timerWaitMs` meet de werkelijke timerwachttijd. `callbackMs` meet de bestaande
timer-callback, inclusief tooltipberekening, eventuele indexbouw en setState.
Bewegen binnen dezelfde dag mag geen nieuwe 300-ms-timer starten.

Het artifact bevat ruwe tijden, alle tooltipregels, de volledige verwachte
bijdragerslijst, screenshots en SHA-256-hashes van bron en invoer. De titel
controleert het volledige aantal; de DOM toont de eerste acht namen. De
storehash is een expliciete projectie op taken, resources, toewijzingen,
kalender, resourcebelasting en selectie. Willekeurige document-/geschiedenisids,
sessietijden en functies zitten daar niet in. Elke hover moet dezelfde
invoer-/storeprojectiehash voor en na behouden. De vier browserruns moeten
onderling exact dezelfde uitvoer en hashes hebben.

Dit is een gerichte browsermeting in Vite/React-developmentmodus. De tijden
bewijzen alleen dit hoverpad met deze fixture op de vastgelegde runner.
Ze zijn geen productiebenchmark en onderbouwen geen algemene appsnelheidclaim.
