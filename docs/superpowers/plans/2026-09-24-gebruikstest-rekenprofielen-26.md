# Gebruikstest rekenprofielen — 26 conventies, 10 projectopties (24-09)

Ik heb het blok *Rekenprofiel en reken-opties* in de echte browser gebruikt zoals een planner dat zou doen. Het basispad werkt: een `.xer` opent als Primavera P6 met een melding en een knop naar Projectinfo. Een profielwissel is één stap in Ongedaan maken, een eigen profiel en een sjabloon werken, en na opslaan als IFC en opnieuw openen staan profiel en opties er weer. Wel twee echte fouten. Na P6 → Open Planner Studio → P6 krijg je het profiel terug, maar niet dezelfde datums: een eindmijlpaal eindigt dan vóór zijn start, en dat gaat mee het IFC in. Daarnaast gooit het blok je wijzigingen zonder waarschuwing weg als je wegklikt zonder op Toepassen te drukken. Verder is de lijst van 26 conventies één ongegroepeerde kolom zonder zichtbare uitleg of herkomst, met door elkaar lopende termen.

- **Stand:** `claude/rekenprofielen` @ `d981ed33` (detached), browser-dev-build op poort 3037, Playwright Chromium headless shell 1600×1000, UI-taal Nederlands.
- **Model:** Claude Opus 5.5 (uitvoerder-opus-midden).
- **Werkwijze:** alle handelingen met echte klikken en toetsen, dus de knoppen Openen, Opslaan en Bereken, de bestandskiezer, selects, vinkjes en Ctrl+Z. `window.__OPS__` is alleen gebruikt om state te lezen, plus drie fixtures: de welkomstdialoog verbergen, `ui.uiFontScale` zetten, en `showSaveFilePicker` weghalen zodat Opslaan de download-terugval neemt.
- **Screenshots:** `qa/rekenprofielen-24-09/*.png` in de worktree `/home/nozzit/open-aec/open-planner-studio/.claude/worktrees/agent-a61bb56b597c8b3c4/`. Die map staat in `.gitignore`, dus de screenshots zijn niet gecommit. De scripts staan in `qa/rp-*.mjs`.
- **Fixture:** een klein XER dat ik zelf heb opgesteld, want `public/examples` bevat geen `.xer` en `tests/` ook geen los `.xer`-bestand. Statusdatum 2026-03-02, `rem_target_link_flag` = Y, `sched_lag_early_start_flag` = N. Taken: A1 voltooid, A2 lopend, A3 en A4 niet gestart, M1 is een eindmijlpaal (TT_FinMile). Relaties: A1→A2 ES, A2→A4 SS met 40 uur lag, A4→M1 ES en A3→M1 ES. Het XER staat letterlijk in `qa/rp-stage2.mjs`.

## Per stap: wat ik zag

### 1. Leeg project → Bestand → Projectinfo

- Het blok staat onder de projectmetadata. Op 100 % begint het op ongeveer y=437 van een scrollhoogte van 1376 px (scrollvenster 915 px). **Toepassen** staat helemaal onderaan, onder alle 26 vinkjes en 7 opties. Bij het wijzigen van een conventie zie je die knop dus nooit. Screenshots: `01-leeg-projectinfo-100.png`, `02-leeg-profielblok-100.png`.
- Op 125 % groeit het blok van 921 naar 1062 px hoog (scrollhoogte 1627). De breedte blijft 560 px en er breekt niets af, alle labels passen. Screenshots: `01-leeg-projectinfo-125.png`, `01b-leeg-projectinfo-gescrold-125.png`. `02-leeg-profielblok-125.png` is door de viewport afgekapt: het blok is hoger dan het scherm.
- Onder Open Planner Studio staan alle 26 vinkjes uit, zoals de gids belooft. De SS-lag-keuzelijst staat grijs, want C6 staat uit. Waarom zie je alleen in een tooltip.
- De keuzelijst Rekenprofiel is een native `<select>` van ongeveer 25 px hoog. De andere keuzelijsten in hetzelfde blok (Kritiek-definitie, Speling-berekening, Lag-kalender, SS-lag) zijn de eigen `Select` van ongeveer 38–44 px. Twee soorten keuzelijsten onder elkaar.
- De vinkjes zijn ronde bolletjes: uit is een lege cirkel, aan een gevulde oranje cirkel. Ze lijken op keuzerondjes.
- Geen consolefouten, geen native dialogen.

### 2. XER openen

- **Melding** (`10-xer-geopend-melding.png`): één toast met "XER-bestand geopend: 1 projectdocument. / Dit project rekent als Primavera P6. Aanpassen via Bestand → Projectinfo → Rekenprofiel en reken-opties. / 1 project gezien. / 5 enum-terugvallen." en de acties **Lees meer** en **Rekenprofiel openen**. Er is precies één P6-melding. De knop opent Backstage → Projectinfo met het profielblok. [BEVESTIGD]
- **Profielblok onder P6** (`11-xer-profielblok-p6.png`): de keuzelijst toont "Primavera P6 (aangepast)", terwijl de gebruiker nog niets heeft aangepast. Het komt door de per-bestandwaarde A19 uit `rem_target_link_flag` = Y. 22 vinkjes staan aan en 4 uit: Restwerk hervat, Niet-gestarte taken niet naar de statusdatum, Voltooide voorganger houdt niet vast en Voltooide taak buiten volgorde. De drempel toont de eenheid "(uren, per taakkalender)". SS-lag staat op "Werkelijke start (statusdatum)" uit het bestand.
- **P6 → OPS → P6:**
  - Na P6 → OPS en Toepassen komt de melding "Na het toepassen zijn 3 taken verschoven." Dat klopt: A1, A4 en M1 veranderen, A2 en A3 houden hun vroege start. Undo-teller van 0 naar 1. Onder OPS toont de lijst "Open Planner Studio (aangepast)", ook dat door A19. Screenshot: `12-na-wissel-naar-ops.png`.
  - Terug naar P6: undo-teller naar 2. Het profiel is **exact** het origineel (diepe vergelijking: `{baseId:p6,id:p6,overrides:{A19:true}}`). **De datums niet**, zie bevinding B1.
  - Ctrl+Z één keer geeft OPS met de OPS-datums, twee keer het originele P6 met de originele datums. Elke wissel is dus precies één undo-stap. [BEVESTIGD]
  - De tweede melding is gelijk aan de eerste. Hij verschijnt als dezelfde toast met "×2", dus je ziet niet dat er een nieuwe wissel was.
- **Conventie wijzigen → kopie** (`13-kopie-van-p6.png`): een vinkje uitzetten op een ingebouwd profiel zet de keuzelijst op "Kopie van Primavera P6". Het naamveld "Naam van dit eigen profiel" en de knop **Opslaan als sjabloon** verschijnen. Dat werkt. [BEVESTIGD]
- **Sjabloon** (`14b-na-sjabloon-opslaan-viewport.png`, `15-wijkt-af-van-sjabloon.png`):
  - Opslaan als sjabloon schrijft direct naar `ops-schedulingProfiles` in localStorage, en de keuzelijst toont dan "Mijn P6 aannemer". Er komt geen bevestiging.
  - Een tweede wijziging geeft het gele blok "Dit profiel wijkt af van het sjabloon “Mijn P6 aannemer”." met drie knoppen: **Sjabloon bijwerken vanuit dit project**, **Bijwerken vanuit sjabloon** en **Sjabloon verwijderen**. Welke conventie afwijkt, staat er niet bij. **Bijwerken vanuit sjabloon** haalt het blok weg.
- **SS-lag-keuzelijst** (`16-sslag-keuzelijst-open.png`, `17-sslag-uitgeschakeld-a19-uit.png`):
  - Onder P6 aan, met de opties "Vroege start (restwerkstart)" en "Werkelijke start (statusdatum)". De keuze landt na Toepassen als `startToStartLagFrom: earlyStart`.
  - A19 uitgevinkt: de keuzelijst gaat uit, de tooltip zegt „Werkt alleen als de conventie „Lopende taak: vroege start = begin van het restwerk” aanstaat.” Onder OPS en MS Project is hij uit, want C6 staat daar uit. [BEVESTIGD]

### 3. Opslaan als IFC en heropenen

- Opslaan leverde via de download-terugval `Gebruikstest.ifc` op, met de in-app melding "Opgeslagen als download …". Het bestand bevat `OPS_SchedulingOptions` en `OPS_SchedulingProfile` (id `prof-…`, `baseId:p6`, alle conventies opgelost). Screenshot: `18-na-opslaan.png`.
- Heropenen via Openen gaf een nieuw document. **Profiel, opties en datums zijn identiek** aan vóór het opslaan: `startToStartLagFrom: earlyStart` en het eigen profiel "Mijn P6 aannemer". De keuzelijst herkent het sjabloon (`template:prof-…`) en er is geen afwijkingsblok. [BEVESTIGD] Screenshot: `19-heropend-projectinfo.png`.
- Bij dat heropenen van een `.ifc` verscheen wél de toast **"XER-bestand geopend: 1 projectdocument. 1 project gezien. 5 enum-terugvallen."**, zie bevinding B4. Screenshot: `24-heropenen-ifc-melding.png`.

### 4. MCP

Niet getest. De MCP-brug is Tauri-only.

### Extra paden

- **Dialoogvariant** (Instellingen → Projectinfo, `22-dialoog-projectinfo.png`, `23-dialoog-profielblok.png`): hetzelfde blok in een dialoog van 560×900. De XER-toast en de toast "N taken verschoven" liggen **over de knoppen Annuleren en Toepassen** van de dialoog.
- **Wizard Nieuw project** (`25-wizard-nieuw-project.png`): onderaan staat "Rekenprofiel" als kale keuzelijst, zonder uitleg. De toasts vallen ook hier over **Annuleren**.
- **Wegklikken zonder Toepassen** (`21-wegnavigeren-na-wijziging.png`): een conventie wijzigen en dan in Backstage naar Instellingen gaan en terug naar Projectinfo. Hetzelfde met de knop **Terug**. In beide gevallen is de wijziging stil weg, zonder melding of vraag. Zie B2.

## Bevindingen, gerangschikt

**B1 [BEVESTIGD] — P6 → ander profiel → P6 geeft andere datums dan het origineel. Een eindmijlpaal eindigt vóór zijn start, en dat gaat mee het IFC in.**
Vers geopend onder P6 staat M1 op `ES/EF = 27-03 17:00 → 27-03 17:00` en `LF = 27-03`. Na P6 → MS Project → P6 of P6 → OPS → P6 staat M1 op `ES = 27-03 17:00, EF = 20-03 17:00, LF = 20-03`. **Bereken** verandert daar niets meer aan. In de tabel ziet de gebruiker "Gepland start 27-03-2026, Gepland eind 20-03-2026" (`20-tabel-onder-p6.png`). Na opslaan en heropenen staat het er nog steeds. De teller zegt die keer "4 taken verschoven" in plaats van 3. Undo herstelt het wel.
Het mechanisme is [VERMOED], maar het bewijs past erbij. De solve schrijft `time.scheduleStart/scheduleFinish` terug, en de P6-conventies lezen die velden als "gepland uit het bestand". Zo komt `p6FinishMilestoneBoundaryWindow` in `CPMSolver.ts` rond regel 2835 uit op `plannedFinish < plannedStart`, en `p6ZeroDurationUsesPlannedBoundary` leest ze ook. Onder MS Project wordt M1 `plan = 27-03..20-03`. Terug onder P6 vindt de grensvenstertak dan een "omgekeerd gepland venster" en neemt `EF = plannedFinish`. De rekenuitvoer van het ene profiel wordt zo invoer voor het andere. De gids belooft: "Zo geeft Primavera P6 → Open Planner Studio → Primavera P6 precies het profiel terug waarmee je begon." Voor het profiel klopt dat, voor de planning niet.
*Aanbeveling:* bewaar de geplande bronankers uit het bestand apart en laat de P6-conventies alleen dat veld lezen, nooit het teruggeschreven `scheduleStart/Finish`. Zet er een regressiecase bij. Bijvoorbeeld: dit XER (TT_FinMile M1) → P6 → MS Project → P6 → vergelijk alle datumvelden met de verse opening. Tot dan hoort de zin in de gids over de profielwissel ook te zeggen dat de datums niet gegarandeerd terugkomen.

**B2 [BEVESTIGD] — Wijzigingen in het blok verdwijnen stil als je wegklikt zonder Toepassen.**
Een conventie wijzigen en daarna Backstage → Instellingen → Projectinfo, of de knop **Terug**, geeft 0 dialogen, geen toast, en de profielkeuze staat weer op `builtin:p6`. Doordat **Toepassen** ongeveer 900 px lager staat dan de eerste conventie, is dit een voor de hand liggende manier om werk kwijt te raken. Hetzelfde geldt voor **Opslaan als sjabloon**: dat slaat direct op, maar het project krijgt het profiel pas na Toepassen, en ook dat verdwijnt stil.
*Aanbeveling:* maak een plakkende voetbalk in het blok. Bijvoorbeeld een gekleurd blok "3 wijzigingen niet toegepast — [Toepassen] [Verwerpen]" dat zichtbaar blijft zolang de draft afwijkt. Of vraag bij wegnavigeren met de bestaande 3-weg-sluitdialoog: toepassen, verwerpen of annuleren.

**B3 [BEVESTIGD] — 26 conventies in één ongegroepeerde kolom, zonder zichtbare uitleg of herkomst.**
- De lijst volgt de volgorde van het register, dus MS Project-conventies staan tussen de P6-conventies (posities 9 en 10), en de twee conventies die in élk profiel uit staan op posities 16 en 19.
- De enige uitleg zit in `title`-tooltips. Op een touchscreen zijn die er niet, en ze zijn niet te ontdekken.
- De gids zet achter elke conventie "(Primavera P6)" of "(Microsoft Project)" en heeft een eigen kop "Standaard uit in elk profiel". De UI toont geen van beide.
- Onder OPS zie je 26 lege bolletjes. Onder P6 22 volle en 4 lege, zonder dat je ziet welke 4 standaard uit horen te staan en welke door jou zijn gewijzigd.

*Aanbeveling:* groepeer in inklapbare secties met een tellerkop. Bijvoorbeeld:
- **Voortgang en statusdatum** (8): A19, C6, restwerk hervat, niet-gestarte taken, …
- **Mijlpalen en kalendergrenzen** (7)
- **Speling** (4)
- **Alleen taken met P6-herkomst** (3)
- **Standaard uit in elk profiel** (2)

Zet per conventie een klein label "P6"/"MSP" en markeer afwijkingen van het basisprofiel, bijvoorbeeld met een stip plus "gewijzigd". Geef elke conventie een (i) die de helptekst uitklapt. Groepen dicht by default, behalve de groep met afwijkingen.

**B4 [BEVESTIGD] — Een eigen `.ifc` openen toont de toast "XER-bestand geopend: 1 projectdocument … 5 enum-terugvallen."**
`fileSlice.ts` roept rond regel 505 `xerImportNotice(results, …)` aan op elk resultaat met `xer`-metadata, en een IFC met een XER-bronarchief levert die blijkbaar mee. De gebruiker opent een `.ifc` en krijgt te horen dat hij een XER opende, inclusief de oude importtellingen. Dat dit van vóór deze etappe is, is [VERMOED]. Het ligt wel precies op het pad dat de gids beschrijft: "Bij het heropenen van een eigen IFC-bestand … komt die melding niet."
*Aanbeveling:* toon de XER-openingsmelding alleen als het geopende bestand zelf een `.xer` is, dus kijk naar het bronformaat van de open-actie en niet naar de metadata in het resultaat.

**B5 [BEVESTIGD] — Toasts liggen over de knoppen van de Projectinfo-dialoog en de wizard.**
In `23-dialoog-profielblok.png` bedekken de XER-toast en de toast "4 taken verschoven ×2" Annuleren en Toepassen. In `25-wizard-nieuw-project.png` bedekt de toaststapel Annuleren. De XER-toast met acties blijft minutenlang staan.
*Aanbeveling:* laat modale dialogen de toaststapel boven hun footer houden, bijvoorbeeld met een `bottom`-offset gelijk aan de dialoogvoet zolang `hasBlockingDialogOpen()`. Of laat toasts met acties na een time-out inklappen tot één regel.

**B6 [BEVESTIGD] — Door elkaar lopende termen, in de UI en tussen UI en gids.**
Tel ik in de NL-conventieteksten (`common.json` → `conventions`):
- relatietypen: "begin-begin" 2×, "start-start" 2×, "einde-begin" 1×, "eind-start" 2×, "einde-einde" 1×, "eind-eind" 4×, plus de losse schrijfwijze "eind-eindgrens"/"eind-eindrelatie"
- "finish" 15× naast "einde" 13×: "Late finish", "finishgrens", maar "actuele einde"
- "actuele" 7× naast "werkelijke" 3×: de conventie heet "Actuele datums exact overnemen", de optie "Werkelijke start (statusdatum)"
- Engels onvertaald: "Progress Override", "LOE", "Retained Logic", "SS-lag"

De gids gebruikt nooit "begin-begin" of "einde-begin", wel "start-start" en "eind-start". Wie in de gids "start-start" leest, vindt in de tooltip "begin-begin".
*Aanbeveling:* kies één set en leg die vast in een termenlijst in `docs/recepten/` of in de gids zelf. Bijvoorbeeld: relatietypen "einde-start, start-start, einde-einde, start-einde". Die set heb ik niet naast de relatiedialoog gelegd; kies de termen die de app daar al gebruikt. Verder "werkelijk" in plaats van "actueel", en "einde" in plaats van "finish" in labels. Houd P6-termen als eigennaam cursief met één zin uitleg bij de eerste vermelding, bijvoorbeeld *Progress Override* (P6-voortgangsinstelling).

**B7 [BEVESTIGD] — "Primavera P6 (aangepast)" direct na het openen, en "Open Planner Studio (aangepast)" na een wissel, zonder dat de gebruiker iets aanpaste.**
De gids legt het uit: een per-bestandwaarde A19. In de UI leest "(aangepast)" als "ik heb iets veranderd".
*Aanbeveling:* maak onderscheid tussen een afwijking door de gebruiker en een waarde uit het bestand. Bijvoorbeeld "Primavera P6 (met instelling uit bestand)", of een gekleurd infoblok onder de keuzelijst: "Eén conventie komt uit je bestand: *Lopende taak: vroege start = begin van het restwerk*. Die blijft bij elke profielwissel staan."

**B8 [BEVESTIGD] — De uitgeschakelde SS-lag-keuzelijst zegt alleen via een tooltip waarom.**
Onder OPS, onder MS Project en met A19 uit is het veld grijs. De reden staat alleen in `title`. De label "Werkelijke start (statusdatum)" suggereert bovendien dat werkelijke start en statusdatum hetzelfde zijn.
*Aanbeveling:* zet onder het uitgeschakelde veld een kleine gekleurde regel: "Alleen actief met de conventies *Verstreken SS-lag uit een lopende voorganger telt niet* en *Lopende taak: vroege start = begin van het restwerk*." Hernoem de optie naar "Statusdatum (P6: Actual start)" en "Start van het restwerk (P6: Early start)".

**B9 [BEVESTIGD] — Kleine UX-punten.**
- Opslaan als sjabloon geeft geen bevestiging. Alleen de knoppen veranderen.
- Het afwijkingsblok zegt niet wélke conventies afwijken.
- **Sjabloon verwijderen** staat zonder bevestiging tussen twee bijwerk-knoppen, in dezelfde stijl.
- Een tweede, gelijke "N taken verschoven"-toast wordt "×2" op de oude toast, zodat een nieuwe wissel onzichtbaar is.
- "Standaardopties van dit profiel toepassen" heeft als secundaire knop een fel wit omlijnd uiterlijk en valt meer op dan **Toepassen**.
- Twee soorten keuzelijsten in één blok (native versus `Select`).
- Ronde vinkjes die op keuzerondjes lijken. Dat dit app-breed is, is [VERMOED]: de optie-vinkjes in hetzelfde blok hebben dezelfde stijl.

**B10 [BEVESTIGD] — Drie van de tien projectopties zijn onzichtbaar maar rekenen wel mee.**
Het XER-project draagt `useExpectedFinishDates: true` en `p6CompletedLateFromRemainingWindow: true`, maar het blok toont ze niet. Dat is bewust, volgens het componentcommentaar in `SchedulingProfileSection.tsx`. Een planner kan dus niet zien waarom twee XER-projecten met hetzelfde profiel anders rekenen.
*Aanbeveling:* toon ze alleen-lezen in een ingeklapt blok "Instellingen uit het bronbestand (P6)", met één regel per optie.

**B11 [VERMOED] — Een voltooide taak onder P6 toont een vroege start ná de vroege finish.**
A1 (voltooid, werkelijk 05-01 t/m 16-01) krijgt onder P6 `ES = 02-03 08:00, EF = 27-02 17:00`, en "Gepland eind" 27-02 in de tabel. Dat is het gedrag van conventie *Voltooide taak in het statusdatumvenster*, en mogelijk precies wat P6 doet. Voor een gebruiker die de kolommen leest, ziet het eruit als een fout. Ik heb niet gecontroleerd wat P6 hier toont.

**B12 [BEVESTIGD] — Documentatie loopt achter.**
- `CLAUDE.md` spreekt nog van "vierentwintig conventies" en "negen projectopties". Het register en de gids hebben er 26 en 10.
- Het componentcommentaar zegt terecht "zeven van de tien" bewerkbaar. De gids zegt niet dat er opties zijn die je niet ziet (B10).

## Wat goed is

- XER opent als P6, met precies één melding en een werkende actieknop naar het profielblok.
- Een profielwissel is één undo-stap. Twee keer Ctrl+Z zet profiel en datums exact terug.
- P6 → OPS → P6 geeft het profiel bit-exact terug, met de afwijkingen letterlijk bewaard.
- De kopie-, sjabloon- en afwijkingsflow werkt en gebruikt een gekleurd blok voor de afwijking.
- De SS-lag-optie komt uit het XER, is te wijzigen, wordt uitgeschakeld zodra C6 of A19 uit staat, en overleeft de IFC-round-trip.
- IFC-round-trip van profiel en opties is exact.
- Op 125 % breekt niets, alle labels passen in 560 px.
- Geen console- of paginafouten, geen native dialogen.
