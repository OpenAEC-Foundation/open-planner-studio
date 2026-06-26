# Testplan — correctheid van de planning (CPM, relaties, mijlpalen, kalender)

**Datum:** 2026-06-26
**Status:** ontwerp, ter review
**Scope-eigenaar:** Ethan (niet-expert in planningssoftware) — rapport moet in begrijpelijke taal.

## 1. Doel

Aantonen dat Open Planner Studio **de planning correct uitrekent bij echt gebruik**. Niet "doet de knop iets", maar "kloppen de getallen". Vier focusgebieden:

1. **Kritiek pad (CPM)** — de keten die de einddatum bepaalt; `earlyStart/Finish`, `lateStart/Finish`.
2. **Relaties** tussen taken — de vier types (`FINISH_START`, `START_START`, `FINISH_FINISH`, `START_FINISH`) + `lagDays` (uitloop/aanloop).
3. **Mijlpalen** — taken met duur 0.
4. **Kalender/werktijd** — weekenden en feestdagen overslaan bij het berekenen van datums.

Plus twee dunne extra-controles: (7) ziet de gebruiker dezelfde getallen in tabel/Gantt als de motor, en (8) overleeft de berekende planning een opslaan-en-herladen-rondje.

## 2. Buiten scope (bewust)

- **Bestanden openen/opslaan op schijf** — werkt al, geen testdoel (bevestigd met de gebruiker).
- **Resources / resource-nivellering** — `runCPM` voert alléén `(leafTasks, sequences, calendar)` in de solver; resources beïnvloeden de datums niet. Er valt voor *planningscorrectheid* dus niets te verifiëren. Wordt als context-bevinding genoemd in het rapport, niet getest.
- **Pixel-vergelijking van de Gantt** — de Gantt is een `<canvas>`; correctheid bewijzen we via store-state, niet via screenshots (zie `docs/self-test-harness.md`).
- **i18n, extensies, multi-document, thema's** — buiten de planning-focus.

## 3. Methode — onafhankelijk narekenen

De valkuil is *circulair* testen: de code naar de uitkomst vragen en die dan met zichzelf vergelijken. Dat vindt nooit een bug. Daarom twee-traps:

### 3a. IJking (calibratie) — eerst
Met minimale gevallen de **conventies** van de app vaststellen en documenteren. Pin minstens:

- **Standaard-kalender** van een nieuw project: welke `workDays` (verwacht ma–vr = `[1,2,3,4,5]`), welke feestdagen (verwacht geen). Bron: de `newProject`/`createNewProject`-default (`src/state/slices/projectSlice.ts`).
- **Duur-conventie:** waar leeft de duur (`task.time.scheduleDuration`?) en is de einddag **inclusief**? D.w.z. een taak van 5 werkdagen die op maandag start — eindigt die op vrijdag (inclusief) of op de volgende maandag (exclusief)? Bron: `CPMSolver` forward pass + `CalendarEngine.addWorkDays`.
- **Anker van de forward pass:** waar begint een taak zonder voorganger — `project.startDate`, of een per-taak `scheduleStart`? Bron: `CPMSolver.solve()`.
- **Lag-eenheid:** is `lagDays` in **werkdagen** of kalenderdagen? Bron: hoe `CPMSolver` `lagDays` toepast t.o.v. `CalendarEngine`.
- **Mijlpaal-conventie:** een mijlpaal heeft duur 0 → `earlyStart === earlyFinish`? Bron: gedrag bij `isMilestone`.

Calibratie stelt de *conventie* vast (legitiem code lezen); de batterijen daarna toetsen de *correctheid* daar onafhankelijk tegen.

### 3b. Theorie-gedreven batterijen — daarna
Testnetwerken bouwen waarvan de juiste uitkomst **vaststaat volgens CPM-theorie**, onafhankelijk van de implementatie. De verwachte waarden worden afgeleid uit (a) standaard CPM/PERT-semantiek en (b) de in 3a gepinde kalender- en duur-conventies — **niet** door de rekenformule uit de solver over te schrijven.

Voorbeeld (float/kritiek pad): twee parallelle ketens vanaf hetzelfde startpunt naar hetzelfde eindpunt, lengtes 8 en 5 werkdagen → de keten van 8 is kritiek (`totalFloat = 0`, `isCritical = true`), de keten van 5 heeft `totalFloat = 3` op elke taak. Wijkt de app af → bevinding.

### 3c. Adversariële verificatie
Elke afwijking (actueel ≠ verwacht) gaat naar **meerdere onafhankelijke verificatie-subagents** die de verwachte waarde opnieuw vanaf de grond af narekenen (en proberen de "bug" te wéérleggen). Pas bij meerderheid "echt fout" komt het als bug in het rapport. Zo geen vals alarm door een fout in onze eigen verwachting. (Diepte-niveau, zie §6.)

## 4. Uitvoering — Tier 1 (browser-dev-build)

Tegen `http://localhost:<poort>` (browser-dev-build; zelfde React-UI als desktop). Per testgeval:

1. `window.__OPS__.store.getState().newProject()` — schone lei.
2. (zo nodig) kalender zetten via `setCalendar(...)` voor feestdag-/werkweek-gevallen.
3. Netwerk bouwen via echte acties: `addTask({ name, time: { scheduleDuration: N }, isMilestone? })` → id's; `addSequence({ predecessorId, successorId, type, lagDays })`.
4. `runCPM()`.
5. Teruglezen: per taak `task.time` (`earlyStart/Finish`, `lateStart/Finish`, `totalFloat`, `freeFloat`, `isCritical`) + `cpmResult` (`criticalPath`, `projectEnd`, `projectDuration`, `error`).
6. Vergelijken met de onafhankelijk berekende verwachting; afwijkingen verzamelen.
7. `window.__OPS__.log.snapshot().filter(e => e.level === 'error')` — geen stille fouten.

Dit raakt de **volledige echte keten** (store → `scheduleSlice.runCPM` → `CPMSolver`/`CalendarEngine` → terugschrijven), precies zoals een gebruiker die ook gebruikt — geen losgekoppeld moduletje.

**Poort:** dit is een git-worktree; draait er al een Vite op 3007 (andere worktree), dan start ik met `OPS_DEV_PORT=<vrij> npm run dev` en navigeer Playwright daarheen (`strictPort`). **Playwright MCP** moet verbonden zijn; zo niet, eerst herstellen.

## 5. Clusters

1. **IJking & conventies** — eerst; legt de conventies uit §3a vast. De rest bouwt hierop voort.
2. **Relatietypes & lag** — FS, SS, FF, SF; elk met `lag = 0`, `+lag`, `−lag` (lead). Verifieer dat elk type de juiste rand koppelt (bv. SS: opvolger-start volgt voorganger-start; FF: opvolger-finish volgt voorganger-finish).
3. **Speling & kritiek pad** — `totalFloat`, `freeFloat`, kritiek pad bij parallelle ketens, diamant-netwerken, ketens met meerdere voorgangers.
4. **Mijlpalen** — duur 0; mijlpaal als voorganger en als opvolger; mijlpaal op het kritieke pad; "start"- en "eind"-mijlpaal.
5. **Kalender/werktijd** — weekend overslaan; losse feestdag; meerdaagse feestdag-periode (`Holiday.startDate..endDate`); taak die over een weekend/feestdag heen loopt; (indien instelbaar) afwijkende werkweek.
6. **Randgevallen & robuustheid** — kringverwijzing A→B→A (verwacht `cpmResult.error`, planning ongemoeid); leeg project; één taak; lange keten (≥50); **verzamel-/fase-taken**: parent `earlyStart` = vroegste kind, `earlyFinish` = laatste kind, `isCritical` = enig kind kritiek (bron: `scheduleSlice.ts:46-67`).
7. **(dun) Wat de gebruiker ziet** — na `runCPM` tonen `TableEditor` (DOM) en de Gantt dezelfde start/finish als de store. (Tabel via DOM uitlezen; Gantt-bars via store-state, niet pixels.)
8. **(dun) Planning overleeft opslaan/herladen** — `window.__OPS__.roundTrip()` lossless, plus steekproef: blijven berekende datums/relaties behouden na serialiseren→parsen.

## 6. Subagent-model (diepte-niveau, optie 4)

- **Fan-out (parallel) — ontwerp.** Per cluster één of meer finder-subagents die de batterij *ontwerpen* als pure data: per geval `{ beschrijving, bouwstappen (lijst store-acties), verwachte uitkomst (onafhankelijk berekend), bron-redenering }`. Diepte: ruime batterijen (richtgetal **≥15–25 gevallen** voor de grote clusters 2–5; kleinere clusters navenant), en voor de brede clusters meerdere finders met verschillende invalshoeken.
- **Fan-in (ik, serieel) — uitvoering.** Alle gevallen door één browsersessie (§4), actueel vs. verwacht, afwijkingen verzamelen. Uitvoering is milliseconden per geval.
- **Adversariële verificatie.** Per afwijking **≥3 onafhankelijke** verificatie-subagents die de verwachting opnieuw afleiden en proberen te weerleggen; meerderheid beslist "echt fout" vs. "onze verwachting was mis".
- **Rapport.** Nederlandstalig eindrapport.

Subagents leiden verwachte waarden af uit CPM-theorie + de gepinde conventies (§3a); ze schrijven **niet** de solver-rekenstap over. Code lezen mag voor de *interface/conventie*, niet om de verwachte getallen te kopiëren.

## 7. Rapportage

Eindrapport (NL, niet-expert) met:
- **Per cluster:** wat is getest, hoeveel gevallen, hoeveel geslaagd.
- **Per afwijking:** (1) wat gaat mis, (2) waarom dat fout is in gewone taal, (3) reproductie (de bouwstappen), (4) verificatie-uitslag.
- **Samenvatting** + de resource-context-bevinding (§2).
- **Eerst rapporteren, fixes daarna** — deze ronde blijft schoon van code-wijzigingen; daarna samen triëren.

## 8. Risico's & aandachtspunten

- **Conventie-onzekerheid (inclusief/exclusief finish, lag-eenheid)** — eerst pinnen in calibratie; alle batterijen consistent daarop bouwen.
- **Playwright MCP nog niet verbonden / poort 3007 bezet** — vóór uitvoering checken; eigen poort kiezen.
- **Canvas niet pixel-testen** — altijd via store-state asserten.
- **Vals alarm** — afgevangen door de adversariële verificatiestap (§3c/§6).

## 9. Definition of done

- Alle 8 clusters uitgevoerd; per cluster een geslaagd/afwijkend-telling.
- Elke gerapporteerde bug door ≥3 verificaties bevestigd, met reproductie.
- Nederlandstalig eindrapport opgeleverd; geen code-wijzigingen in deze ronde.
