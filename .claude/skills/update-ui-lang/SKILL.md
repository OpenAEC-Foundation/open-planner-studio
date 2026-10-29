---
name: update-ui-lang
description: Use when the release skill reaches its translation step, when the user explicitly invokes /update-ui-lang, or when the user in their own words asks to translate the app's interface (UI texts) into all languages. Runs the vertaalstraat for the UI until `npm run verify:translations` is green. NEVER auto-trigger after an ordinary commit, build or merge; a PR only needs nl + en.
---

# Update UI-talen — de vertaalstraat voor de interface

## Waarom
Een PR vraagt alleen `nl` en `en` (besluit B5, 2026-10-10). `main` loopt dus met vertalingen achter.
Een release niet: daar moet elke UI-sleutel in elke taal vertaald en actueel zijn (besluit eigenaar,
2026-10-12). De poort is `npm run verify:translations`; die draait ook in `release.yml`. Deze skill maakt
die poort groen. De Help-artikelen horen hier niet bij: dat is `update-docs-lang`, en die blokkeert een
release niet.

Ontwerp: `docs/superpowers/specs/2026-10-09-vertaalstraat-design.md`. Opdrachten voor de agents:
`scripts/translate/prompts/` (`ui.md`, `ui-review.md`, `ui-fix.md`).

**Kernregel:** vertaal nooit zelf en pas nooit met de hand een locale-bestand van een andere taal dan
`nl`/`en` aan. Alles gaat door de straat: pakket → Haiku-stations → poort → `apply`.

## Wanneer
- Bij elke expliciet gevraagde of geplande release (release-skill, stap 2), zonder aparte vraag.
  Werk op de releasebranch en neem de vertalingen mee in de release-PR.
- Los, als de user erom vraagt (bijvoorbeeld om `main` bij te werken). Werk dan op een eigen branch en
  open een PR.

## Stappen

### 0. Werkplek
```bash
git -C <repo> worktree add .claude/worktrees/ui-talen -b claude/ui-talen-<datum> origin/main
cd .claude/worktrees/ui-talen
[ -e node_modules ] || ln -s <repo>/node_modules node_modules
export PATH="/home/agent/.nvm/versions/node/v22.23.2/bin:$PATH"   # of het actuele nvm-pad
```
Werk je binnen een release, dan gebruik je de releasebranch in plaats van een nieuwe.

### 1. Wat staat er open
```bash
npm run verify:translations; echo "exit=$?"
```
Exit 0: klaar, niets te doen. Anders noemt de poort per taal de sleutels: `ontbreekt`, `verouderd` of
`zonder hash`. Meer detail: `npm run translate -- status [taal]`.

Staat `en` in de lijst? Dan veranderde iemand `nl` of `en` zonder `npm run i18n:add`. `en` gaat nooit door
de stations. Zet de sleutel opnieuw met nl + en (dat zet de hash; zie `docs/recepten/i18n-sleutel.md`):
`npm run i18n:add -- <ns>:<sleutel> <json met nl en en> --update`.

### 2. Pakketten maken — eerst `--missing`
```bash
for l in <talen met "ontbreekt">; do npm run translate -- prepare ui $l --missing; done
npm run translate -- packages ui <dezelfde talen>     # JSON [[taal, pakket-id], …]
```
`prepare ui` zet bestaande `ui-*`-pakketten van die taal opzij in `archive/`. Maak dus geen nieuwe
pakketten voor een taal voordat je de vorige ronde hebt toegepast.

### 3. De stations draaien
Gebruik dezelfde prompts, pakketbestanden en poort als `scripts/translate/workflows/stations.js`.
Kies de route die de uitvoerder ondersteunt; de skill geeft toestemming voor deze Haiku-stations.
`stations.js` draait niet los met Node: `args`, `pipeline` en `agent` komen uit de Workflow-runtime.

**Claude met Workflow-tool:**
- `scriptPath`: `<worktree>/scripts/translate/workflows/stations.js`
- `args`: `{ "kind": "ui", "repo": "<worktree>", "node": "<absoluut nodepad>", "items": <JSON uit stap 2> }`

**Sol/Codex in T3:** volg [t3-stations.md](t3-stations.md). Start per pakket met `delegate_task`
achtereenvolgens de vertaler, nalezer en zo nodig hersteller, met provider `claudeAgent` en model
`claude-haiku-5-5`. Gebruik gedeelde isolatie: de pakketten staan buiten Git onder `build/translate/`.
Geen Workflow-tool simuleren en `stations.js` niet via Node starten.

Per pakket: vertalen (met eigen poort) → nalezen → herstellen als de nalezer problemen vond.
Pakketten mogen naast elkaar lopen; stations voor hetzelfde pakket nooit tegelijk.
Bij meer dan ongeveer 60 pakketten: meld vooraf het aantal agents, zonder akkoordvraag.

Vergelijk `git status --short` vóór en na de stations: alleen nieuwe uitvoer onder
`build/translate/` is toegestaan (gitignored). Bestaande releasewijzigingen blijven staan.
Schreef een agent buiten zijn pakketuitvoer of reviewbestand: stop en meld de afwijking.

### 4. Toepassen
Blokkeer de hele apply-ronde zolang een vereist vertaal-, nalees- of herstelstation onafgerond is;
een groene pakketcheck alleen volstaat niet. Onbekende stationstatus telt ook als onafgerond.
Hervat eerst die stations met hun bestaande pakketten/taak-ID's; maak geen nieuwe `prepare`-ronde.
Bepaal `OPEN_STATIONS` uit alle vereiste stations van alle pakketten die `apply` kan inlezen:
```bash
: "${OPEN_STATIONS:?Controleer eerst alle vereiste stations}"
test "$OPEN_STATIONS" -eq 0 || exit 1
for l in <talen>; do npm run translate -- apply ui $l; done
```
`apply` neemt alleen groene pakketten over. Een rood pakket blijft staan:
```bash
npm run translate -- packages ui <talen> --red        # rode pakketten met uitvoer
npm run translate -- packages ui <talen>              # alles wat nog open staat (ook zonder uitvoer)
```
Wat je met een rood pakket doet, hangt af van de foutregel:
1. **Vertaalfout** (invulplek, term, meervoud, …): stuur de open pakketten van die taal nog één keer door
   de stations (stap 3) en draai `apply` opnieuw.
2. **Pakket past niet meer** ("nl-tekst in het pakket ≠ huidige nl", "staat niet (meer) in nl",
   "veranderd na prepare", "geen zegel van prepare"): de stations helpen niet. Rond eerst geval 1 af voor
   die taal, en maak daarna nieuwe pakketten (stap 2). `prepare ui` zet namelijk álle open
   `ui-*`-pakketten van die taal opzij. `packages --red` noemt ook deze pakketten.

Blijft een pakket na twee rondes rood, stop dan en meld de taal, het pakket en de foutregel aan de user.

### 5. Daarna `--stale`
Herhaal stap 2 tot en met 4 met `--stale` voor de talen met `verouderd` of `zonder hash`. `--stale`
geeft de agent de vorige vertaling mee, zodat hij alleen aanpast wat in de bron veranderde.

Veranderde er een term in de termbase (een `avoid`-variant erbij)? Maak dan pakketten met
`prepare ui <taal> --avoid`. Gebruik bij Workflow `"kind": "ui-termfix"`; bij T3 alleen voor het
vertaalstation `ui-termfix.md` in plaats van `ui.md`. Nalezen/herstellen blijven `ui-review.md` en
`ui-fix.md`. Die route vervangt alleen de oude term.

### 6. Poorten en commit
```bash
npm run verify:translations; echo "exit=$?"   # moet 0 zijn
npm run verify:i18n; echo "exit=$?"
git status -sb                                 # alleen src/i18n/locales/<taal>/ en i18n/ui-sources/<taal>.json
git add src/i18n/locales i18n/ui-sources
git commit -m "UI vertaald door de straat: <wat>, <talen>"
```
Los: push de branch, open een PR en wacht op de CI. In de release: ga verder met de release-skill.

## Rapport aan de user
- Per taal: aantal vertaalde sleutels, aantal bevindingen van de nalezer, rode pakketten.
- Het aantal agents en het model (Haiku).
- Wat je niet kon oplossen, met de foutregel.

## Valkuilen
- Een `prepare` op een taal met open pakketten archiveert die. Pas eerst toe.
- Een nieuwe taal (Engels als vulling, geen hashes) gaat altijd via `--missing`. Zet hem pas in
  `UI_BASELINE` (`scripts/translate/common.ts`) als zijn eerste ronde is toegepast.
- `apply ui` keurt elk pakket ook tegen de huidige nl en de taal. Veranderde nl na `prepare`, dan is het
  pakket rood: maak het opnieuw.
- Relatiecodes (`FS`, `SS`, `FF`, `SF`) en duurinvoer (`3ed`) blijven altijd zoals ze zijn; de poort
  controleert dat.
- Vind je een fout in een termbase-term, pas dan `i18n/termbase/<taal>.json` aan via de straat
  (`terms.md`, `apply-terms`) en niet in de locale. Meld het in je rapport.
