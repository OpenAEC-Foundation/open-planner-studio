# Crashherstel: IFC-serialisatie op één worker

Datum: 22 oktober 2026. PR #483. Dit is een optimalisatie van de responsiviteit: de UI kan tijdens IFC-serialisatie doorwerken. De totale autosave-tick wordt in deze metingen langer. Er is geen aangetoonde winst in totale doorlooptijd.

## Meetbron en omstandigheden

De gezaghebbende hermeting staat in [2026-10-22-recovery-worker.json](2026-10-22-recovery-worker.json). Gemeten productcommit: `0b071433061c86c50470888b51a8eed9488d0c0e`. De werkboom was schoon (`dirty: ""`); de JSON bevat afzonderlijke SHA-256-bronhashes van de hook en alle zes betrokken recoverymodules. Latere commits voegen bewijs toe en begrenzen de HTTP-server van het meetscript; de productiebestanden blijven bytegelijk aan deze commit.

Node 22.23.4, Chromium 151.0.7922.34, AMD Ryzen 7 3700U, acht logische CPU's, 13,6 GiB RAM. De machine wordt gedeeld; load average na de hermeting: 8,89 / 5,96 / 7,12. Deze thread draaide steeds maximaal één zwaar commando tegelijk. Absolute tijden zijn daarom geen universele norm.

Dataset: `generateBenchmarkProject(10000, { seed: 0x5eed })`, met 10.000 taken, 11.700 relaties, 5.718 toewijzingen en acht resources. De dataset wordt vooraf doorgerekend zoals in de bestaande grote-plannenmeting en daarna diep immutable gemaakt. Het resulterende IFC telt 9.111.485 tekens.

Het [meetscript](2026-10-22-recovery-worker.mjs) bouwt een geïsoleerde productieharness met de eigen Vite-configuratie en de echte worker, delta en IndexedDB-backend. De synchrone vergelijking gebruikt de oude tickvolgorde van main `522589202727a4a519b25b94aed196d844dc6ab8`: `prepare` met de oorspronkelijke synchrone writer, `saveRecovery`, `commit`. De workervergelijking gebruikt de nieuwe `runRecoveryTick` met de productieclient. Elke ronde heeft een verse deltatracker: dit meet een daadwerkelijk gewijzigde bron, niet een overgeslagen tick.

Eén koude workerstart apart, daarna vijf afwisselende synchrone en vijf workerrondes. `totalTickMs` loopt van delta/serialisatie tot de opgeloste recovery-save, inclusief opslag en opruiming. `longestMainTaskMs` komt uit de echte Long Tasks API. `senderCloneMs` meet de synchrone duur van native `Worker.postMessage`; ontvangst en het kopiëren van de antwoordtekst zitten in de totale ticktijd. Een aparte `structuredClone`-probe meet een volledige lokale kopie en is geen tweede meting van alleen de verzendkant. De heartbeat is een timer van 5 ms. Dit is een geïsoleerde autosavemeting zonder Gantt-rendering; de browsertest controleert daarnaast de bestaande gebruikersroute.

## Resultaten

De eerste [verkenning](2026-10-22-recovery-worker-verkenning.json) gaf mediaan **702 → 72 ms hoofdthreadblokkade** en **756 → 807 ms totale ticktijd**. De verzendclone kostte mediaan 72,3 ms (70,1–114,1 ms); de langste hoofdthreadtaak met worker was 70–114 ms. Dat is responsiviteitswinst, geen wall-time-speedup. Die ronde registreerde HEAD `7fa19fa7e` maar geen volledige dirty-/bronhashscope; gebruik hem daarom niet als exact bronbewijs.

De hermeting op schone `0b0714330` geeft:

- Langste hoofdthreadtaak: mediaan **826 → 103 ms**, bereik synchroon 725–905 ms, worker 80–130 ms; circa 87,5% minder blokkade.
- Totale tick: mediaan **916,3 → 1129,9 ms**, bereik synchroon 819,3–993,2 ms, worker 1038,9–1479,0 ms; circa 23,3% langer.
- Verzendclone: mediaan **102,9 ms**, bereik 80,3–130,0 ms. Opbouw van de kleine writer-envelop: 0,1 ms. Een volledige lokale `structuredClone`: mediaan 195,7 ms, bereik 181,8–238,2 ms.
- Grootste framegat: mediaan **816,7 → 99,9 ms**. Heartbeat tijdens de tick: mediaan **3 → 185** callbacks.
- Koude worker: totale tick 1375,9 ms, langste hoofdthreadtaak 92 ms, verzendclone 87,6 ms; daarna wordt dezelfde worker hergebruikt.

Alle elf IFC-uitkomsten hebben dezelfde SHA-256 na normalisatie van uitsluitend de schrijftijd: `a15b316a460e670d336598712d97c4fabe6d860c7cc221cc7cf67d4b2857f880`. De verschillende absolute tijden tussen verkenning en hermeting vallen onder verschillende gedeelde machinebelasting en Node-versies. De winstclaim berust steeds op de afwisselende vergelijking binnen één meetronde.

De clone op de hoofdthread blijft dus merkbaar. De totale berekening is niet sneller geworden; de zware writer draait parallel aan de UI. Er is bewust één worker, met maximaal één actief verzoek. Extra doorvoer met twee onafhankelijke documenten is niet aangetoond; een tweede worker is daarom niet toegevoegd. Er wordt geen uitspraak gedaan dat twee workers nooit kunnen helpen.

## Integriteit, flush en afsluiten

De delta en manifestmetadata blijven gekoppeld aan dezelfde immutable payload als de workerinvoer. De grens ontvangt alleen writer-invoer en een kleine archiefverwijzing. XER-byteChunks, readModel, diagnostiekcatalogi en filehandles gaan niet mee; site-id en versie blijven manifestmetadata. Het XER-archief wordt uitsluitend lazy door de bestaande opslaglaag beschikbaar gesteld.

Een tracker verwerkt volledige rondes in volgorde; de persistentiebasis verschuift pas na geslaagde opslag. De stoppoort wordt na workerwerk opnieuw gecontroleerd, vóór het aanbieden van een save aan de bestaande backendketen. Daardoor kan een late workerrespons bij clean quit geen snapshots na het wissen terugzetten. Unmount beëindigt de worker en verwerpt lopende/wachtende serialisatie.

Expliciete flush en timer gebruiken dezelfde productiehelper `createRecoveryTickQueue`. `inFlight` wordt binnen dezelfde draincallback gewist als de laatste pending-controle. Dit verhelpt de P2 uit de review van `7fa19fa7e`: een losse `.finally` liet een microtaskvenster waarin een nieuwe flush de oude belofte kreeg zonder een nieuwe ronde.

De deterministische regressie doorloopt 65 microtaskposities met de echte productiehelper en echte delta/IFC/recovery-opslag. Na beide flushbeloften moet de nieuwste versie persistent zijn. Een tijdelijke mutant die de losse `.finally` terugzet, faalt op diepte 16 (exit 1, verwacht). De herstelde helper slaagt (exit 0). Ook fouten, cachehergebruik, oudere/nieuwere versies, stoppen/wissen, unmount, ontbrekende workers en een expliciete flush tijdens workerwerk worden gecontroleerd. Inhoudelijke writerfouten committen niets en houden de worker bruikbaar; ontbrekende/geblokkeerde/gecrashte workers vallen terug op dezelfde synchrone writer. Een worker die 60 seconden niet antwoordt wordt beëindigd en gebruikt diezelfde terugval.

De 10-seconden-throttle en immutable generatie-/manifestopslag zijn behouden. Handmatige bestandsopslag en echte bestands-AutoSave veranderen niet. Er is geen nieuwe UI-functie of gids toegevoegd.

## Meetserver: CodeQL-alert 28

De review van het meetscript vond een requestpad dat rechtstreeks naar `readFileSync(join(out, path))` ging. Vanaf `2b2391be80186c9ca94de743350f01b70ad626af` wordt vóór serverstart een vaste Map opgebouwd uit uitsluitend vertrouwde Rollup-output en zelf gegenereerde index-HTML. De requesthandler zoekt alleen de exacte padsleutel in die Map op. Hij leest geen bestanden en vertaalt geen requestpad naar een bestandspad. Er is geen suppressie of regexfilter toegevoegd.

De gerichte HTTP-check controleert de index, entry en workerasset op status 200, MIME en bytegelijke inhoud. Acht ruwe traversal-/onbekende paden geven uitsluitend `404 Not found`, ook voor bestaande sentinelbestanden binnen en buiten de uitvoermap. Ruwe HTTP-requests voorkomen dat `../` vooraf door een URL-parser wordt genormaliseerd. Daarna draait een echte worker-/IFC-ronde in Chromium. [De vastgelegde HTTP-check](2026-10-22-recovery-worker-http-check.json) bevat commit, dirty-status, productbronhashes en de hash van het meetscript zelf.

## Herhalen en uitgevoerde checks

Vanuit de reporoot, met Node 22 en de Playwright-Chromiuminstallatie:

```bash
node docs/superpowers/evidence/2026-10-22-recovery-worker.mjs build/recovery-worker.json
node docs/superpowers/evidence/2026-10-22-recovery-worker.mjs build/recovery-http.json --http-check-only
npm run typecheck
npm run lint
bash tests/planning/run.sh check-recovery-worker.ts check-recovery-delta.ts check-recovery-content.ts check-recovery-integrity.ts check-recovery-isolation.ts check-recovery-web-hold.ts check-xer-archive-recovery-once.ts check-app-quit.ts
node scripts/run-browser-tests.mjs tests/browser/xer-recovery-archive.spec.ts
npm run verify:docs
npm run verify:cycles
npm run verify:store-boundaries
```

Uitgevoerd op Node 22.23.4: typecheck, lint, acht gerichte recovery-/quitbatterijen, beide browserroutes, docs, cycles en store-boundaries: **alle exit 0**. Na het toevoegen van de reviewregressie zijn de gerichte workerbatterij en typecheck opnieuw uitgevoerd: beide exit 0. De productieharness met workerbuild en de gerichte HTTP-/workercheck eindigen eveneens met exit 0. De `.finally`-mutant eindigt met exit 1 zoals verwacht; de productiehelper is daarna hersteld en slaagt.

Geen volledige `npm run verify`, geen CI-monitoring, geen merge/release en geen wijziging aan andere PR's. Er is geen echte Tauri-executable gestart; de sluitcontroller en stop-/wisraces zijn headless getest en de echte herstelroute in Chromium.
