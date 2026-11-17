---
name: nachtvertalingen
description: Gebruik alleen wanneer de geplande nachttaak (maandag tot en met zaterdag 01:00 op aia09-mp50) deze skill start, of bij een expliciete /nachtvertalingen. Vertaalt de UI-teksten die af zijn in de 26 andere talen, in een eigen PR die zichzelf merget na groene CI. Nooit vanzelf na een commit, merge of release, en niet voor docs.
---

# Nachtvertalingen — de UI-teksten die af zijn, elke nacht

## Waarom
Besluit Ethan, 2026-11-16: de UI-vertalingen gaan elke nacht, niet allemaal op de maandag van de release.
Zijn grens: "doe het wel alleen voor werk wat af is, we hebben er niet veel aan als teksten nog niet
definitief zijn". De nacht vertaalt dus alleen wat af is; de release vertaalt de rest, zoals nu
(`update-ui-lang`). Plan, metingen en reviewrondes: `docs/superpowers/plans/2026-11-17-nachtvertalingen.md`.

**Af** = de nl-tekst staat minstens 48 uur ongewijzigd op main en hoort niet bij een feature flag
(`FeatureFlag.texts`, `nameKey`, `descriptionKey` in `src/utils/featureFlags.ts`). Dat rekent
`npm run translate -- settled` uit; doe het nooit met de hand.

**Kernregels:** vertaal nooit zelf en pas geen locale met de hand aan. Alles gaat door de straat:
pakket → Haiku-stations → poort → `apply`. Geen Sol-review op de nachtelijke PR (besluit 2026-11-16).
Node alleen volgens besluit 9, de lijst *Node-uitzondering voor de nachttaak* in
[referentie.md](../release/referentie.md#node-uitzondering-voor-de-nachttaak).

`TALEN` (de 26 doeltalen; nooit `nl` of `en`):
`fr de es zh it pt pl tr ar ja ko fa ru uk cs sk sr hr bg hu ro sv nb da fi lo`

## Stappen

### 0. Markering
`M=~/.local/state/ops-nachtvertalingen/actief`. Bestaat `$M` en is hij jonger dan 24 uur: deze nacht
slaat over (de vorige loopt nog). Ouder: meld het aan wrakko en ga door. Schrijf `date -Iseconds` in `$M`.
Haal hem aan het eind altijd weg, ook bij vervallen of mislukken.

### 1. Werkplek
```bash
REPO=/home/aia09/projects/open-planner-studio
TALEN="fr de es zh it pt pl tr ar ja ko fa ru uk cs sk sr hr bg hu ro sv nb da fi lo"
git -C "$REPO" fetch origin
W="$REPO/.claude/worktrees/nacht-$(date +%F)"
git -C "$REPO" worktree add --detach "$W" origin/main
cd "$W" && npm ci
BASE=$(git rev-parse HEAD)
NODE=$(node -p 'process.execPath')
```
Nooit een vorige nachtbranch of -worktree hervatten. Bestaat `$W` al van een vervallen poging: verwijder
die eerst met `git worktree remove --force "$W"` (alleen die map; hij bevat alleen gitignored werk).

### 2. Wat is af en wat staat open
```bash
npm run translate -- settled --out build/translate/settled.json
for l in $TALEN; do npm run translate -- prepare ui $l --open --only build/translate/settled.json; done
npm run translate -- packages ui $TALEN --bundle 60000      # JSON [[taal, [id, …]], …]
```
Geen pakketten in alle talen: klaar zonder PR. Rapport: "niets af en open", met de aantallen uit `settled`.

### 3. Stations
Per bundel: vertalen → nalezen → herstellen als de nalezer iets vond, volgens
[t3-stations.md](../update-ui-lang/t3-stations.md) (*Bundels*). Hoogstens twee bundels tegelijk als aia
druk is. Geef elk station het nachtmandaat, deze worktree en toestemming voor zijn eigen
`build/translate/check.mjs`-pakketcheck mee; de stations installeren niets.

Vóór en na de stations: `git status --short` en
`sha256sum build/translate-seal/*.json build/translate/check.mjs build/translate/*/ui-*-[0-9][0-9].json`.
Alleen nieuwe uitvoer (`*.out.json`, `review-*.json`) onder `build/translate/` mag erbij. Schreef een run
daarbuiten, of veranderde een pakket, zegel of de checker:
die run telt niet en draait opnieuw. Een naleesrun telt pas als je het reviewbestand zelf las en het een
geldige JSON-lijst is. `OPEN_STATIONS` moet 0 zijn vóór stap 4; een onbekende status is open.

### 4. Verse main
```bash
git fetch origin
NIEUW=$(git rev-parse origin/main)
npm run translate -- night-guard "$BASE"     # exit 1 = de nacht vervalt
git switch -c "vertalingen/$(date +%F)" "$NIEUW"
```
`night-guard` faalt zodra een commit na `BASE` de taalbestanden, hashes, termbase, flags, vertaalscripts
of dependencies raakte, ook als hij later werd teruggedraaid. Dan vervalt de nacht: geen apply, geen PR.

### 5. Toepassen
```bash
for l in $TALEN; do npm run translate -- apply ui $l; done
```
Rode pakketten blijven liggen voor de volgende nacht of de release; geen tweede ronde in dezelfde nacht.
Noteer ze voor de PR-tekst (`npm run translate -- packages ui $TALEN --red`).

### 6. Poorten en commit
```bash
npm run verify:i18n; echo "exit=$?"            # moet 0 zijn
for l in $TALEN; do git add "src/i18n/locales/$l" "i18n/ui-sources/$l.json"; done
git diff --cached --name-only | grep -Ev "^(src/i18n/locales/($(echo $TALEN | tr ' ' '|'))/[a-z]+\.json|i18n/ui-sources/($(echo $TALEN | tr ' ' '|'))\.json)$"
git status --porcelain | grep -Ev '^[MA]  '
```
De twee laatste opdrachten moeten niets tonen. Anders: niet committen, de nacht vervalt, melding.
Niets gestaged: klaar zonder PR. Commit met het ingestelde noreply-adres:
`UI-vertalingen JJJJ-MM-DD: <n> teksten in <talen>`.

### 7. PR en merge
```bash
git push -u origin "vertalingen/$(date +%F):vertalingen/$(date +%F)"
gh pr create --base main --title "UI-vertalingen $(date +%F)" --body-file <tekst>
```
PR-tekst: per taal het aantal vertaalde teksten en bevindingen van de nalezer, de rode/open pakketten
met de foutregel, en uit `settled` hoeveel teksten te nieuw of van een flag waren. Vermeld dat een
AI-assistent de PR maakte.

Wacht in de voorgrond tot de CI op de head klaar is (`gh pr checks <nr> --watch`).
- Groen: `git fetch origin`. Is `origin/main` nog `$NIEUW`, dan
  `gh pr merge <nr> --merge --admin --match-head-commit "$(git rev-parse HEAD)"`.
  Is main verder: sluit de PR met de reden "main is verder; de volgende nacht doet het opnieuw".
- Rood: geen herstel; sluit de PR met de rode check in de reden.

### 8. Eind
`git worktree remove "$W"` (na de merge of het sluiten), `rm -f "$M"`. Mislukte of vervallen de vorige
nacht ook: meld beide aan wrakko (`[sessie nachtvertalingen]`), met de reden.

## Rapport
Eén regel per uitkomst: gemerged (PR, talen, aantal teksten), vervallen (waarom) of niets te doen. Daarna:
per taal de aantallen, de bevindingen van de nalezer, rode pakketten, het aantal Haiku-runs, de duur.
