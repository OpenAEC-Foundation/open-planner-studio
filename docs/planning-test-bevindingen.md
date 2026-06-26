# Planning (CPM) — bevindingen én fixes

**Datum:** 2026-06-26
**Onderwerp:** klopt de planningsberekening (kritiek pad, relaties, mijlpalen, kalender) bij echt gebruik?
**Status:** **7 bevindingen gevonden, allemaal opgelost en geverifieerd.** Regressietest 121/121 groen, app-build groen.
**Testplan:** [spec](superpowers/specs/2026-06-26-planning-correctheid-testplan-design.md) · **regressietests:** [`tests/planning/`](../tests/planning/)

---

## Samenvatting

Eerst zijn ~115 testgevallen tegen de échte rekenmotor gedraaid; daaruit kwamen 7 bevindingen. Die zijn
vervolgens **gefixt** in `CPMSolver`/`CalendarEngine` (+ één in de relatie-opslag), en de hele suite is
uitgebreid tot **121 gevallen die nu allemaal groen zijn**. Elke fix is onafhankelijk nagerekend uit
CPM-theorie (drie verschillende verificatierondes), niet uit de code zelf.

| # | Bevinding | Ernst | Status |
|---|---|---|---|
| 1 | "Finish-Finish"-relatie werd als "Finish-Start" berekend | 🔴 Hoog | ✅ opgelost |
| 2 | Uitlooptijd (lag) telde één werkdag te weinig (lag 1 deed niets) | 🟠 Midden | ✅ opgelost |
| 3 | Negatieve lag (lead/overlap) werd genegeerd | 🟠 Midden | ✅ opgelost |
| 4 | Een mijlpaal in een keten schoof de opvolger een werkdag op | 🟠 Midden | ✅ opgelost |
| 5 | Vrije speling ("free float") stond overal 1 werkdag te hoog | 🟠 Midden | ✅ opgelost |
| 6 | Projectduur van een nul-duur-project was 1 i.p.v. 0 | 🟡 Laag | ✅ opgelost |
| 7 | "Start-Finish"-relatie was slechts bij benadering | 🟡 Laag | ✅ opgelost |
| + | Tweede relatie tussen hetzelfde takenpaar (bv. SS+FF) verdween stil | 🟠 Midden | ✅ opgelost |

Wat al goed wás en goed is gebléven: **kalender/werktijd** (weekenden, feestdagen, afwijkende
werkweken) en **totale speling + kritiek pad** in tientallen netwerkvormen.

---

## Wat is aangepast (technisch)

Alle wijzigingen zitten in de rekenmotor; de domeinlogica blijft in TypeScript.

- **`src/engine/scheduler/CalendarEngine.ts`** — nieuwe `addWorkingDaysSigned(date, n)`: een zuivere
  verschuiving over werkdagen (n=0 = zelfde dag, n<0 = achteruit). Anders dan `addWorkDays` telt de
  begindag níét als "dag 1". Dit is de basis voor correcte lag/lead en relatie-logica.
- **`src/engine/scheduler/CPMSolver.ts`**
  - *Voorwaartse constraint* per relatietype herschreven: FS, SS, **FF (eindigt-gelijk)** en
    **SF** worden nu elk apart en correct toegepast (voorheen viel FF/onbekend op FS terug).
  - *Lag/lead* via `addWorkingDaysSigned`: een lag van N geeft nu N werkdagen (lag 1 werkt), en een
    **negatieve lag (lead) werkt** — geklemd op de projectstart zodat niets vóór dag 1 wordt getrokken.
  - *Mijlpaal-bewust*: een nul-duur-mijlpaal bezet geen werkdag, dus de "+1 werkdag na finish" van FS
    geldt niet rond een mijlpaal — een tussengevoegde mijlpaal schuift de keten niet meer op.
  - *Achterwaartse pass* spiegelt dit exact, en de late finish wordt nu begrensd op het projecteinde
    (voorheen kon een Start-Start-opvolger 'm erbóven duwen → voorganger ten onrechte niet-kritiek).
  - *Vrije speling* relatie-bewust en met de ontbrekende −1 (was overal +1 te hoog).
  - *Projectduur* = 0 voor een project zónder echt werk (alleen mijlpalen op één moment).
- **`src/state/slices/sequenceSlice.ts`** — duplicaatcontrole weegt nu óók het relatietype mee, zodat
  een tweede relatietype tussen hetzelfde paar (SS+FF "ladder"/overlap) niet meer stil verdwijnt.

---

## De bevindingen in detail (was → nu)

> Voorbeelden: werkdagen ma–vr, geen feestdagen, eerste taak start ma 1 juni 2026. Een taak van N
> werkdagen die op maandag start, eindigt N werkdagen later (einddag meegeteld).

### 1. 🔴 "Finish-Finish" werd als "Finish-Start" berekend
FF betekent: twee taken zijn *samen klaar*. **Was:** FF werd als "opvolger start ná de finish" berekend
(FS-gedrag) → project leek langer en het kritieke pad klopte niet. **Nu:** FF lijnt de finishes uit.
*Voorbeeld:* A(5d, 1–5 juni) →FF→ B(2d) geeft B = 4–5 juni (samen klaar), beide kritiek, project klaar
5 juni. (Was: B = 8–9 juni, A niet-kritiek, project 9 juni.)

### 2. 🟠 Uitlooptijd (lag) telde één werkdag te weinig
**Was:** een lag van N gaf N−1 werkdagen; een lag van 1 deed niets. **Nu:** een lag van N geeft N
werkdagen. *Voorbeeld:* A(1–5 juni) →FS+2→ B start nu 10 juni (was 9 juni); FS+1 start nu 9 juni (was 8).

### 3. 🟠 Negatieve lag (lead/overlap) werd genegeerd
**Was:** een negatieve lag had geen effect (gelijk aan lag 0). **Nu:** een lead vervroegt de opvolger
(geklemd op de projectstart). *Voorbeeld:* A(1–5 juni) →FS−2→ B start nu 4 juni (was 8 juni).

### 4. 🟠 Een mijlpaal in een keten schoof de opvolger op
**Was:** A → M → B (mijlpaal ertussen) zette B een werkdag later dan A → B direct. **Nu:** de mijlpaal
verandert de planning niet; B start in beide gevallen op dezelfde dag. Geldt ook voor start-mijlpalen.

### 5. 🟠 Vrije speling stond overal 1 werkdag te hoog
**Was:** elke taak kreeg vrije speling +1 (bij totale speling werd wél een −1 toegepast, bij vrije
speling niet). **Nu:** correct, relatie-bewust; een eindtaak zonder opvolger krijgt weer 0.

### 6. 🟡 Projectduur van een nul-duur-project
**Was:** een project met alleen een mijlpaal meldde duur 1. **Nu:** 0 (geen tijdsbeslag). Geen effect op
echte projecten met taken.

### 7. 🟡 "Start-Finish" was bij benadering
Het zeldzame vierde type wordt nu volgens de definitie berekend (opvolger eindigt wanneer de voorganger
start, + lag), in plaats van een ruwe benadering.

### + Tweede relatie tussen hetzelfde paar verdween stil
**Was:** een tweede relatie tussen dezelfde twee taken (bv. SS náást FF, een legitieme overlap-koppeling)
werd door de duplicaatcontrole stilletjes weggegooid. **Nu:** verschillende relatietypes tussen hetzelfde
paar mogen naast elkaar bestaan.

---

## Verificatie (hoe weten we dat het nu klopt)

- **121 testgevallen, allemaal groen** — `bash tests/planning/run.sh`. Tegen de échte store + motor,
  headless en reproduceerbaar.
- **Onafhankelijk narekenen.** Verwachte waarden uit standaard CPM-theorie (niet uit de solver). Drie
  losse verificatierondes (telkens meerdere onafhankelijke agents) bevestigden zowel de bugs als de
  juistheid van de fixes — inclusief het afvangen van een aantal *testfouten* (gevallen waarin de app
  juist gelijk had en de testverwachting ernaast zat).
- **Regressie-bewaakt.** Wat al goed was, is groen gebleven: kalender 18/18, totale speling & kritiek
  pad in 23 topologieën, en de WBS-/fase-oprol.
- **App-build groen** (`npm run build`: `tsc` + `vite`).

De minimale "probe"-gevallen (`tests/planning/cases-probes.json`) leggen elke voormalige bug afzonderlijk
vast, zodat een terugval meteen rood wordt.

---

## Over resources (ongewijzigd, buiten scope)

Je kunt resources aanmaken en aan taken koppelen, maar de planning rekent er (nog) niet mee — de
rekenmotor krijgt alleen taken, relaties en de kalender. Er is dus geen resource-nivellering. Dit is
bewust niet aangeraakt; het is een aparte feature-keuze, geen rekenfout.
