# HANDOFF — 2026-07-20: draaiboek voor de volgende sessie

> **AFGEWERKT op 2026-07-20 — dit draaiboek is verbruikt; alleen nog van historisch belang.**
>
> - **STAP 1 (poorten)** — alle drie groen op de gecombineerde stand: tsc 0, suite 429/429 (exit 0,
>   geen `XX`-regels), `verify:examples` 0. Pakket B, dat nog nooit gedraaid had, bleek goed.
> - **STAP 2 (committen)** — gecommit; daarna bleek `main` 8 commits vooruit (release v2026.7.11 +
>   benchmark-tool). Gemerged met 14 locale-conflicten (beide kanten voegden een sleutelblok toe op
>   dezelfde plek), poorten opnieuw groen, gepusht naar `main`.
> - **STAP 3 (visuele verificatie)** — de hele nakijklijst afgelopen in de draaiende devbuild.
>   De kalenderwaarschuwing blijkt géén grijze voetnoot maar een echte callout (rode tint,
>   waarschuwingsicoon, eigen blok); RTL-pijl `←` is in een echte RTL-render juist bevonden
>   (oud staat rechts, nieuw links, pijl wijst mee). Gevonden restpunt: enkelvoud/meervoud klopt
>   niet bij count=1 ("1 deadlines") — apart weggezet.
> - **STAP 4 (`project.endDate`-round-trip)** — gefixt via het `OPS_ProjectSettings`-pset, inclusief
>   het lege-einddatum-geval; zie `docs/TODO.md`.
> - **STAP 5 (restwerk)** — nog niet opgepakt; staat onverkort in `docs/TODO.md`.

Dit is geen statusrapport maar een **uitvoerbaar draaiboek**. Werk het van boven naar beneden af.
Je hebt geen context uit de vorige sessie nodig; alles wat je moet weten staat hieronder.

**Situatie in één alinea.** Er staat ongecommit werk van vier pakketten in deze worktree. Elk pakket
is apart groen geweest, maar de gecombineerde poort-run ontbreekt: de vorige sessie verloor
halverwege toegang tot alle uitvoerende acties (het veiligheidsmodel van de auto-modus viel uit —
lezen bleef werken, uitvoeren niet). Er is dus **niets ongeverifieerds gecommit**. Jouw taak is de
poorten draaien, committen, visueel verifiëren, en daarna het restwerk oppakken.

Worktree: `.claude/worktrees/todo-kleine-dingen-794832` · branch `claude/todo-kleine-dingen-794832` ·
laatste commit `2246885`.

---

## STAP 0 — Randvoorwaarden

Draait de suite met exit 127, dan mist `node_modules` in de worktree (bekend probleem in dit
project — worktrees delen die niet):

```bash
ln -s /home/nozzit/open-aec/OPS/open-planner-studio/node_modules \
      /home/nozzit/open-aec/OPS/open-planner-studio/.claude/worktrees/todo-kleine-dingen-794832/node_modules
```

---

## STAP 1 — De drie poorten

```bash
npx tsc --noEmit; echo "TSC: $?"
bash tests/planning/run.sh > /tmp/final.txt 2>&1; echo "SUITE: $?"; grep -E "^XX" /tmp/final.txt
npm run verify:examples; echo "VERIFY: $?"
```

> **⚠ De samenvattingsregel van de suite liegt.** Hij print `TOTAAL: N/N (alles groen)` óók bij
> exitcode 1, want de losse check-batterijen melden zich apart met `XX`-regels erbóven. **Alleen de
> exitcode telt**, plus `grep "^XX"`. Dit verborg in de vorige sessie een rode batterij. Hetzelfde
> geldt voor `gen:examples` en `verify:examples`: die printen door na een fout.

Drie keer exit 0 → **STAP 2**. Iets rood → **STAP 1b**.

### STAP 1b — Rood? Zo weet je van wie

| Casenaam / batterij begint met | Pakket | Zie |
|---|---|---|
| `rr-fs-crossmode-`, `lagadv-minutes-` | A — solverbugs | §A |
| `edge-empty-project-01` | B — leeg project | §B |
| `move-`, batterij `move-project-check` | C — Project verplaatsen | §C |
| `ifc-roundtrip`, `document-contract-check` | eerder gecommit werk | — |

**Pas nooit een verwachting aan om iets groen te krijgen.** Reken de verwachte waarde met de hand
na uit de werkdagtabel in `tests/planning/BRIEF.md` en repareer de code. Pakket **B is het meest
verdacht**: dat is het enige dat nooit één keer gedraaid heeft.

---

## STAP 2 — Committen

```
fix(solver/state/ifc): cross-mode-FS-vlaggen, lagMinutes-only, leeg project + feat: Project verplaatsen

Solver:
- backward-uur-FS, dag-pred/uur-succ: grensvlaggen ontbraken ⇒ tf=-1 en onterecht
  kritiek; nu gespiegeld aan forwardHour.
- lag die alleen als lagMinutes bestaat viel stil weg (bereikbaar via P6-/MSPDI-import);
  opgelost in de lag-resolutie, UI- en IFC-pad byte-identiek.
- leeg project rapporteerde einddatum 1970-01-01 en een negatieve duur.

Feature:
- "Project verplaatsen…": hele planning naar een nieuwe startdatum, met droogrun-preview
  die toont dat einddatums verspringen doordat de kalender NIET meeschuift.

CI:
- nieuwe checkjob (typecheck + planningssuite + voorbeelden + docs); die draaiden nergens.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

`docs/CHANGELOG.md` en `docs/TODO.md` zijn al bijgewerkt en zitten in de diff.

**Pushen naar main mag** in dit project zonder te vragen zodra het geverifieerd is — maar let op:
een push naar `main` deployt de web-build live. Doe dat dus pas ná STAP 3. **Releasen (bump/tag)
vereist ALTIJD expliciet akkoord van de user op dat moment.**

---

## STAP 3 — Visuele verificatie (het belangrijkste openstaande werk)

Alles is headless bewezen. Geen enkel scherm is bekeken. Start de dev-server:

```
preview_start met name "wip"   → poort 3037 (config staat al in .claude/launch.json)
```

3007/3017/3027 zijn in gebruik door andere processen. Gebruik de browser-tools; `computer`-screenshots
liepen in de vorige sessie consequent vast op de canvas-zware Gantt, dus **werk tekstueel** via
`read_page` en `javascript_tool`. De dev-bridge `window.__OPS__` (store, log-bus) is beschikbaar —
zie `docs/self-test-harness.md`.

**Sla eerst de welkomst-rondleiding over** (knop "Skip"), anders staat er een overlay overheen.

Een voorbeeldproject laden en een taak selecteren, beproefd en werkend:

```js
(async () => {
  const S = () => window.__OPS__.store.getState();
  const r = await fetch('/examples/showcase-appartementencomplex.ifc');
  await S().openExampleFromString(await r.text(), 'showcase.ifc');
  await new Promise(res => setTimeout(res, 1500));
  const t = S().tasks.find(x => x.name?.includes('Opleverkeuring'));
  S().selectTask(t.id);
  return { taak: t.name, anker: t.time.scheduleStart, berekend: t.time.earlyStart };
})()
```

Alleen deze acht bestanden staan in `public/examples/` en zijn dus fetchbaar: `03-kantoorgebouw-zuidas`,
`05-brugvervanging-n279`, `08-zorgcentrum-de-linde`, `10-villa-wassenaar`, `15-datacentrum-agriport`,
`showcase-appartementencomplex`, `showcase-rijwoningen-de-akkers`, `showcase-verbouwing-eengezinswoning`.

### Nakijklijst, in volgorde van belang

1. **De kalenderwaarschuwing in het verplaats-dialoog.** Planning → "Project verplaatsen…". Neem een
   project met bouwvak/feestdagen en verplaats eroverheen: het einde schuift dan bijvoorbeeld 28
   dagen terwijl je er 21 koos. De testcases bewijzen dat de bérekening klopt — **niet dat een
   planner het zíét**. Is die waarschuwing echt opvallend, of een grijze voetnoot? Dit is het hele
   bestaansrecht van dat scherm; als het antwoord "voetnoot" is, moet het opvallender.
2. **Waarschuwingslijst** bij een project met actuals, een harde pin, een externe koppeling én een
   ingevuld datum-customfield: verschijnen alle regels, lopen de lange NL-teksten niet uit hun blok?
3. **Baseline-checkbox** verschijnt alleen als er baselines zijn, en staat uit.
4. **Na Toepassen** springt de Gantt netjes naar het verplaatste project.
5. **RTL** (`ar`/`fa`): de pijlen in de preview-regels. Daar is bewust `←` gebruikt in plaats van `→`,
   nooit in een echte RTL-render getoetst. Taal wisselen:
   `localStorage.setItem('ops-locale','ar'); location.reload();` (dat wist wel het geladen project).
6. **Statusbalk bij een leeg project** (pakket B): er hoort géén "Einde"-blok meer te staan en de duur
   is 0 — niet de grote negatieve waarde van vóór de fix.

### Al wél geverifieerd (niet overdoen)

In de vorige sessie tegen commit `2246885` bevestigd in de draaiende app: het paneel-startdatumveld
toont de berekende datum, undo van projectnaam/statusdatum werkt met één stap, opslaan zonder
wijziging pusht niets, undo na kalenderverwijdering herstelt óók de projectkalender, het grote
voorbeeld heeft twee kritieke paden met nul negatieve speling, bijna-kritiek verschijnt direct na
openen, en de Arabische hint rendert met `dir="rtl"`.

---

## STAP 4 — De opdracht die niet meer weggezet kon worden

**`project.endDate` overleeft een IFC-round-trip niet.** Dit is een volledig uitgewerkte opdracht;
voer hem uit of geef hem aan een subagent (Opus, hoog effort — dit is IFC/persistentielaag).

**De bug.** `ifcWriter.ts` (~r146-149) schrijft `IFCWORKPLAN.FinishTime` als
`planEnd = endDates[endDates.length-1] || project.endDate` — het contractuele veld is dus alleen een
fallback bij nul taken. `ifcReader.ts` (~r263) leest datzelfde slot terug ín `project.endDate`. Netto
vervangt opslaan+herladen de ingevulde einddatum door de afgeleide planningsdatum. `project.startDate`
heeft hetzelfde in mildere vorm.

**Besloten aanpak** (niet heroverwegen):
1. Contractuele datums krijgen eigen persistentie in het **`OPS_ProjectSettings`-pset** — dat bestaat
   al op het project en draagt `wbsAutoNumber` en de statusdatum; in `ifcWriter.ts` ~r308 staat
   gedocumenteerd waarom die bewust in een pset zitten. Volg dat patroon.
2. `IFCWORKPLAN.StartTime/FinishTime` blijven **ongewijzigd** de afgeleide plan-omvang dragen — dat is
   semantisch juist en andere IFC-tools lezen die slots.
3. Leesvolgorde: pset wint wanneer aanwezig, anders terugvallen op het WORKPLAN-slot, zodat bestaande
   bestanden zich exact als vandaag gedragen.
4. **KRITIEK — een lege einddatum moet leeg terugkomen.** De golden rule van dat pset ("alleen
   schrijven wat gezet is") zou bij `''` niets wegschrijven, waarna de lezer terugvalt op het
   WORKPLAN-slot en de afgeleide datum alsnog invult: dezelfde bug, verplaatst naar het lege geval.
   De lezer moet "veld aanwezig maar leeg" van "veld afwezig" kunnen onderscheiden. Bewijs beide
   gevallen met een test.

**Valstrik die je moet repareren vóór je iets test.**
`tests/planning/check-ifc-roundtrip.ts` **vergelijkt** `project.startDate`/`endDate` wél (~r377), maar
de fixture heeft `endDate: '2026-07-24'` (~r257) terwijl de laatste taak op diezelfde datum eindigt
(~r184). Afgeleid en contractueel vallen dus samen en het verlies is per constructie **onzichtbaar**;
die check passeert zonder iets te bewijzen. Geef de fixture een contractuele einddatum die duidelijk
afwijkt van de taak-span, anders bewijst ook jouw fix niets.

**Tests:** check 151 in `tests/planning/check-move-project.ts` legt nu bewust het oude gedrag vast en
is als "(pre-existing)" gelabeld — werk hem bij én herschrijf die toelichting. Volg in
`check-ifc-roundtrip.ts` de KNOWN_GAPS-conventie ("elke assertie bewijst dat het verlies er NOG is;
faalt er één, dan is de gap gedicht → haal 'm eruit en neem 'm op in de echte vergelijking").

---

## STAP 5 — Restwerk, in onderzochte volgorde

Staat allemaal in `docs/TODO.md` met volledige onderbouwing. Prioritering uit een onderzoekspakket:

1. **Commit-op-blur voor datumvelden.** `DateTextInput` commit bij élke toetsaanslag en
   `parseFlexibleDate` accepteert een jaar al bij 2 cijfers, dus "01062030" levert drie undo-stappen
   op met onzinwaarden (2020-06-01, 0203-06-01). 13 gebruiksplekken geïnventariseerd, 10
   problematisch. **Advies: los het bij de bron op** met een `commitMode`-prop, niet met
   coalesce-keys per actie — de gedeelde `task-sections`-componenten voeden zowel het
   eigenschappenpaneel als de taakdialoog, dus één fix dekt beide. Dagelijks voelbaar.
2. **Recovery-robuustheid.** `restoreDocuments` rekent sinds kort door met `runCPM`; een corrupte
   recovery-snapshot laat dat klappen. Faalmodus is **niet** "opstarten klapt" maar: herstelknop doet
   stil niets, dialoog blijft hangen, auto-save blijft de hele sessie uit. Het bestaande "patroon
   elders" (`fileSlice`) is een stille `console.error` — **kopieer dat niet**; volg het
   `HourDataNotice`-bannerpatroon. Bij mislukt herstel de snapshots **niet** wissen.
3. **Undo-stack heeft geen limiet.** 88 MB serieel bij 500 taken × 600 snapshots. Eén
   `pushBounded`-helper op alle drie de pushplekken (ook `redo`→`undoStack` en `undo`→`redoStack`),
   elementbewust, niet op bytes. **Valkuil:** de coalesce-marker gebruikt `undoStack.length` als
   identiteit — afkappen breekt dat; vervang `len` door een monotone pushteller.
4. **`<html lang>` volgt de taalkeuze niet.** `src/i18n/config.ts:135` zet wél `dir` maar nooit
   `lang`; `index.html` heeft `lang="nl"` hardcoded. Schermlezers kondigen alle dertien andere talen
   aan als Nederlands. Eén regel.
5. **Leeg project → `projectEnd` epoch bij de bron** is al gefixt (pakket B), maar controleer of er
   nog consumenten zijn die op de oude vorm rekenen.

**Bewust NIET doen** (onderzocht en afgeraden): `scripts/` toevoegen aan het typecheck-pad — kost
`@types/node` plus 16 echte strict-fouten, terwijl de nieuwe CI-job die scripts gewoon drááit in
0,74 s en daarmee méér vangt. En de uur-pred/dag-succ-arm in `backwardHour` "repareren": die is
onderzocht en **verworpen** — `predDoneAt` is in uur-modus de identiteit, dus de vlaggen ontbreken
daar terecht. Er staat een commentaarregel die dat vastlegt.

---

## Wat er in de working tree staat (referentie)

46 bestanden, ~1000 regels erbij.

### §A — Twee solverbugs · `relationMath.ts`, `CPMSolver.ts`, 2 cases-bestanden
Laatste eigen run **428/428, tsc 0**. Met rood/groen-bewijs: voorspellingen vooraf opgeschreven, fix
teruggedraaid, precies de juiste cases rood met exact de voorspelde foute waarden.

1. **Cross-mode FS, dag-voorganger → uur-opvolger.** Grensvlaggen ontbraken in de backward-tak
   terwijl `forwardHour` ze wél toepast ⇒ `tf = −1` waar 0 hoort, en bij speling wordt een taak ten
   onrechte kritiek. *Correctie op eerder onderzoek: de fout wordt bij speling **niet** geabsorbeerd —
   hij eet precies één werkdag op.*
2. **Lag in minuten zonder dagen verdween stil.** Bereikbaar via P6-/MSPDI-import (die lezers
   schrijven `lagDays: 0 + lagMinutes` zodra de opvolger in uur-modus staat, terwijl de solver de lag
   in de voorgangerkalender oplost). Fix in de lag-resolutie met een **optionele** `hoursPerDay`-
   parameter, `lagDays ≠ 0` blijft leidend, afronding symmetrisch (`Math.round(-0.5)` is `-0` in JS).
   *Nagelezen: alle aanroepers consistent — `RelationsPanel.tsx:62` gebruikt de 2-argumentvorm, wat
   compileert doordat de derde parameter optioneel is.*
   *Ongeverifieerd:* de lezer-kant is codelezing, geen import-fixture.

### §B — Leeg project gaf einddatum 1970-01-01 · `scheduleAnalysis.ts`, `StatusBar.tsx`, `cases-edge.json`
**NOOIT GEDRAAID** — dit pakket kon geen enkele poort meer uitvoeren. Het meest verdachte pakket.

De accumulator zit in `scheduleAnalysis.ts` (post-pass), **niet** in `CPMSolver.ts`. Conditie is nu
`earlyDates.size > 0`. De oude terugval mat "vandaag → epoch" en gaf dus een grote negatieve duur.
Alle 13 consumenten van `projectEnd` nagelopen; er verslechterde er precies één (de statusbalk hield
een kaal label "Einde:" over) en die is gerepareerd.

### §C — "Project verplaatsen…" · nieuw: `moveProject.ts`, `MoveProjectDialog.tsx`, 2 testbestanden
Laatste eigen run **419/419, tsc 0, verify:examples 0**, met 123 aparte checks.
Ontwerp: [`specs/2026-07-20-move-project-design.md`](specs/2026-07-20-move-project-design.md).
Negen `satisfies Record<keyof X, MoveVerdict>`-tabellen breken de build zodra iemand een datumveld
toevoegt zonder het te classificeren.

### §D — CI-checkjob · `.github/workflows/ci.yml`
CI draaide **alleen** `tauri build`; de planningssuite draaide nergens. Nieuwe Ubuntu-job: typecheck +
suite + `verify:examples` + `verify:docs` (~4 s). **Nooit in GitHub Actions gedraaid** — dat blijkt
bij de eerste push.

---

## Twee vallen die deze sessie opleverde

1. **De suite-samenvatting liegt** (zie STAP 1). In de vorige sessie is drie keer "403/403 groen"
   gerapporteerd op basis van een `tail`, terwijl er een rode batterij buiten beeld stond.
2. **Een groene check bewijst niet altijd iets.** De IFC-round-trip-batterij vergelijkt
   `project.endDate` keurig — maar de fixture koos die datum gelijk aan de laatste taak, dus het
   verlies kón niet zichtbaar worden. **Regel: schrijf je een test bij een fix, draai hem dan één keer
   met de fix teruggedraaid en zie dat hij dán rood is, met vooraf voorspelde foute waarden.** Elk
   pakket in deze sessie dat dat deed, vond iets extra's.
