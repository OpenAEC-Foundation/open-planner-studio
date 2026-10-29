# Zoeken naar afhankelijkheden meten

Deze opt-in meting draait uitsluitend in GitHub Actions, via
`relation-search-performance.yml`. De werkbranch `t3/limit-relation-search` doet mee
bij wijzigingen aan deze meetmap, de twee betrokken tests of de workflow. Later
kan de workflow handmatig worden gestart. Een PR-tekstwijziging start niets.

De basis is vastgezet op `1c4c8a2b629c1efcd070188a8368b108c4e289cf`; de andere
checkout is de expliciete PR-head (bij handmatig starten: de gekozen revisie).
Beide gebruiken Node 22, dezelfde lockfile, dezelfde Chromium-versie en dezelfde
runner. De workflow bewaart ook bij fouten de revisies, installatie-/test-/bouwlogs
en gedeeltelijke resultaten. Er is geen millisecondenpoort.

De Ubuntu-installatie gebruikt dezelfde officiële archiefbron als de bestaande
Linux-CI, met één APT-retry en transporttimeouts van 15 seconden. Na installatie
wordt de headless browser werkelijk gestart en gesloten; versie en Node-versie
komen in `browser-preflight.log`. De browserroute en vergelijking starten alleen
wanneer die hele installatiestap slaagt. De installatiestap heeft 10 minuten, de
job 35 minuten. De poging op `700bf69` liep na zes minuten vast bij APT; zonder
Chromium faalden daarna de browserroute en vergelijking. Dat was geen voltooide
browsermeting of productregressiebewijs.

`fixture.mjs` maakt 1.000, 5.000 en 10.000 vlakke taken, eigenaar vooraan. Per omvang
worden leeg zoeken, breed zoeken op `Werk`, een unieke laatste treffer en geen
treffer gemeten. Namen bevatten ook niet-ASCII-tekst. Locale-/whitespacegevallen,
dubbele ids, alle eigenaarvoorkomens en grenswaarden staan uitgebreider in de
bestaande planningtest.

De helper wordt voor beide revisies met dezelfde esbuild-instellingen gebundeld.
De oude aanroep met `.slice(0, 8)` wordt vergeleken met de begrensde nieuwe aanroep.
Alle resultaatvelden moeten gelijk zijn, ook de onbeperkte nieuwe aanroep wordt
met de oude vergeleken. Twee opwarmrondes en negen ruwe samples wisselen de
voor/na-volgorde af. Een tellende iterable draait buiten de timing; invoer is
recursief bevroren en wordt met een verse volledige fixture vergeleken.

De browserroute gebruikt twee Vite-productiebuilds met React in productiemodus,
`minify=false` en de bestaande `VITE_OPS_BENCH_BRIDGE=1`. Dit is dus geen gewone
minified distributiebouw en geen dev-server. De brug zet de fixture en leest de
domeinstate. Selectie, toevoegen, zoeken, pijlen, type, richting, lag, bevestigen,
undo en Escape gebruiken echte browserbediening. Tekst wordt met Playwright
`fill` als één invoerhandeling aangeboden; leegmaken gebeurt met Ctrl+A/Backspace.
Een passieve eventlistener meet vanaf de eerste input/toets tot twee animatieframes
na de verwachte zichtbare lijst. Die tijd omvat browserafhandeling en frames en is
geen geïsoleerde React-rendertijd of garantie dat pixels het scherm bereikt hebben.
Eén opwarmronde en vijf samples wisselen de revisievolgorde af. De hoofddraad-
long-tasks worden apart vastgelegd; afwezigheid daarvan bewijst niet dat zoeken
geen tijd kost. Andere app-activiteit wordt niet onderdrukt.

De aparte CDP-proef staat uit tijdens alle tijden. `startPreciseCoverage` gebruikt
`callCount:true,detailed:false`; de poort toetst uitsluitend of de tellerdelta nul
of positief is. Een echte zoekactie kalibreert de observatie; de volgende zoekactie
moet de helper opnieuw laten zien nadat de eerste delta is gelezen. Ruwe aantallen
blijven bewaard, zonder vast renderaantal als contract.
De exacte declaratie in de geleverde JavaScript wordt via haar bronbereik aan
CDP gekoppeld; de mogelijk lege CDP-functienaam is geen zoekcriterium. Ruwe
coverage wordt per stap bewaard. Een querywijziging moet hem op beide revisies uitvoeren; pijl, type, richting en
lag alleen vóór de wijziging. Er is geen contract op aantallen StrictMode-renders.
Na de pijlcontrole kiest een echte Enter de gemarkeerde taak. De proef controleert
de gekozen zoektekst, de gesloten trefferlijst en ongewijzigde domeinstate vóór
de muisklik op type. Dit volgt de bestaande browserroute: de zwevende trefferlijst
bedekt anders het typeveld. Kiezen wijzigt de zoektekst en moet de helper op beide
revisies opnieuw uitvoeren; type, richting en lag houden daarna die zoektekst gelijk.
Daarna moet de echte bevestiging één relatie en één undo-stap maken; undo en Escape
worden tegen de volledige taken, relaties en toewijzingen gecontroleerd. De
voor/na-domeinvergelijking normaliseert uitsluitend het gegenereerde relatie-id.
Er wordt geen `structuredClone` als oracle gebruikt.

Het artifact `relation-search-<head>` bevat `resultaten.json` met revisies,
bronnen-/harnashashes, invoer-/uitvoerhashes, ruwe milliseconden, bezoekaantallen,
long-tasks en de binaire uitvoeringsproeven. `domein-*.json` bevat de resultaten
van bevestigen/undo; `voor-*.png` en `na-*.png` tonen de browserlijst. Browserhashes
slaan op de werkelijk gelezen labels; helperhashes op alle resultaatvelden.
Een groene gerichte meting vervangt de gewone volledige PR-CI niet.

Bij 10.000 taken met de eigenaar vooraan en acht vroege treffers verwacht de bron
9 bezoeken in plaats van 10.000. Geen of late treffers blijven 10.000 bezoeken.
Dat is een algoritmische verwachting, geen gemeten algemene versnelling.
