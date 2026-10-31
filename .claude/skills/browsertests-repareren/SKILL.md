---
name: browsertests-repareren
description: Gebruik alleen wanneer de geplande vrijdagjob of de release-skill deze skill start, of bij een expliciete /browsertests-repareren. Repareert een rode browserrun van ci.yml op main, ook een haperende test. Nooit vanzelf bij een rode PR, een andere rode CI-run of onderhoud aan deze skill.
---

# Browsertests repareren — Open Planner Studio

Besluit eigenaar, 2026-10-31: "die draaien we een keer per week, elke vrijdagavond om 10 uur alles wat daaruit
komt moet dan automatisch gefixt worden zodat de release door kan gaan."

`ci.yml` draait de browsersuite elke vrijdag om 22:00 Nederlandse tijd op main. Deze job zoekt die run en
repareert alles wat rood is, zonder de eigenaar. Stel geen vragen. Het doel is een groene browserrun op main.

## Grenzen

- Geen tag, geen release, geen bump en geen andere releasestappen. Kom niet aan de gate in `release.yml`.
- Geen test overslaan, geen check verzwakken, geen retries erbij. `retries` in `playwright.config.ts` blijft 0.
- `gh run rerun --failed` is alleen diagnose. Wordt een test bij opnieuw draaien groen, dan is hij een haperende
  test en is hij nog niet gerepareerd. Dit gaat vóór stap 1 van *CI herstellen* in de release-referentie.
- Geen directe push naar main, geen force-push, geen `git stash`, geen `git reset --hard`.
- Er werkt nooit meer dan één Sol-taak tegelijk op main. Hervat bestaand werk (zie stap 1); maak geen dubbel
  issue of dubbele PR.

**Tijd.** Reken altijd in Europe/Amsterdam. Wees klaar vóór zaterdag 07:00. Lukt dat niet, ga dan door tot
uiterlijk **zaterdag 14:00**, de grens van de release. Controleer de tijd vóór elke rerun, delegatie, merge en
dispatch. Om 14:00 stop je: volg *Stoppen om 14:00*.

**Node.** Deze job heeft geen Node-uitzondering; de serverregel uit `AGENTS.md` geldt. Draai zo min mogelijk lokaal.
De browsersuite draait in CI, nooit op aia. Ook geen volledige `npm test` of `npm run verify`, geen Playwright-run
over meerdere specs, geen productie-, Rust- of Tauri-build en geen losse dev-server. Wel mag dit, in de eigen worktree:
eenmaal per run `npm ci` als een stap hieronder het nodig heeft, `npm run typecheck`, `npm run lint:fast` en
één spec die de oorzaak sneller aantoont dan PR-CI (`flock /tmp/ops-zwaar.lock node scripts/run-browser-tests.mjs <spec>`).
Geen link naar `node_modules` in een andere checkout. Voert de release deze skill uit, dan gelden de Node-grenzen
van de release.

## 1. Zoek de run

Haal `origin/main` op. Zoek eerst bestaand werk, ook van een vorige week:

```bash
REPO=OpenAEC-Foundation/open-planner-studio
export TZ=Europe/Amsterdam
VRIJDAG=$(date -d "$(( ($(date +%u) + 2) % 7 )) days ago" +%F)
VANAF=$(date -d "$VRIJDAG 21:00" +%FT%T%:z)
gh issue list --repo "$REPO" --state open --label browsertests-reparatie --json number,title,updatedAt
gh pr list --repo "$REPO" --state open --json number,headRefName,headRefOid \
  --jq '.[] | select(.headRefName | startswith("fix/browsertests-"))'
gh run list --repo "$REPO" --workflow ci.yml --branch main --event schedule --created ">=$VANAF" \
  --json databaseId,status,conclusion,headSha,createdAt
```

Is het issue open en de afgelopen 2 uur bijgewerkt, dan werkt er al een taak: stop en meld dat. Is het ouder, dan
hervat je dat werk.

Neem de bovenste run. Loopt hij nog (`queued` of `in_progress`): wacht, hoogstens 2 uur.
Oordeel altijd op poging 1. Een rerun verandert de conclusie van de run, dus die conclusie zegt niets meer:

```bash
gh api "repos/$REPO/actions/runs/$RUN/attempts/1" --jq .conclusion
```

- `success`: ga naar stap 2.
- `failure` of `timed_out`: open meteen het issue (stap 3) en ga naar stap 4.
- Geen run, `cancelled`, `skipped`, `startup_failure`, of na 2 uur nog bezig: de set is niet afgemaakt. Open meteen
  het issue en start de run zelf. Volg die tot het einde en oordeel op zijn poging 1.

```bash
SHA=$(git ls-remote origin refs/heads/main | cut -f1)
gh workflow run ci.yml --repo "$REPO" --ref main
gh run list --repo "$REPO" --workflow ci.yml --event workflow_dispatch --commit "$SHA" \
  --json databaseId,status,conclusion,createdAt
```

Start geen tweede handmatige run op main terwijl er een loopt: de nieuwe annuleert de lopende (`concurrency`).

## 2. Groen

Eén regel in het eindrapport, met run-ID en SHA. Geen PR. Staat er een open issue: sluit het met die regel.
Staat er nog een fix-PR van een vorige week open: noem hem in het rapport. Klaar.

## 3. Open het issue

Het issue is het enige signaal aan de release en ook het hervatverslag. Open het vóór elke andere stap, en sluit
het pas in stap 2 of 6. Bestaat er al een: gebruik dat en meld dat je hervat. Een nieuw issue:

```bash
gh issue create --repo "$REPO" --title "Browsertests repareren" --label agent-ticket --label browsertests-reparatie \
  --body "<vrijdag $VRIJDAG, run-URL, SHA en wat er rood is>"
```

Schrijf na elke stap, en bij wachten minstens elk uur, een reactie: run-ID's, foutbewijs, fix-PR's, review-taak-ID's
en wat er nog openstaat.

## 4. Stel de oorzaak vast

Lees de rode shards van poging 1:

```bash
gh run view "$RUN" --repo "$REPO" --attempt 1 --json jobs
gh run view "$RUN" --repo "$REPO" --attempt 1 --log-failed
gh run download "$RUN" --repo "$REPO" --pattern 'playwright-ci-*' --dir "$(mktemp -d)"
```

Schrijf elke rode test op. Draai daarna eenmaal `gh run rerun "$RUN" --repo "$REPO" --failed` als diagnose:

- Nog rood: een vaste fout.
- Groen: een haperende test. Voorbeeld: xer-recovery op 24 oktober. Maak de test of de code stabiel.
  Eén groene run bewijst dan weinig, dus de PR wijst de oorzaak aan, met bewijs uit log, trace of code.

Alleen een fout buiten de repo is geen haperende test: de log toont een verloren runner of een mislukte download,
in een stap vóór de tests. Noteer dat bewijs in het issue, sla stap 5 over en ga naar stap 6.

## 5. Repareer met een fix-PR

Volg [CI herstellen](../release/referentie.md#ci-herstellen), stap 2 tot en met 4. Lokale checks volgen de Node-regel
hierboven. Verder geldt dit:

- Branch `fix/browsertests-<VRIJDAG>-<onderwerp>` vanaf vers opgehaalde `origin/main`. De kleinste fix, één oorzaak per PR.
- Zet meteen het label, zodat de PR de hele set draait. `gh pr edit --add-label` faalt in deze repo:

  ```bash
  gh api "repos/$REPO/issues/$PR/labels" -f 'labels[]=browsertests'
  ```

- Registreer de PR bij T3 en noem hem in het issue.
- Review door een tweede Sol xhigh: [Tweede Sol-review via T3](../release/referentie.md#tweede-sol-review-via-t3), met
  de letterlijke reviewerbrief en BLOKKEERT/VERVOLG. Alleen BLOKKEERT vraagt een nieuwe fixronde.
- Zet elke VERVOLG als genummerd punt in `knownbugs.md` op de fixbranch. Een commit met alleen die punten vraagt
  groene PR-CI, geen nieuwe review.
- Review akkoord en alle PR-CI groen op dezelfde head:
  `gh pr merge "$PR" --repo "$REPO" --merge --admin --match-head-commit "$HEAD"`.
- Hapert een andere test op de fix-PR: die telt ook als rood. Neem hem mee in deze job.
- Wacht op de groene `ci.yml`-pushrun op de merge-SHA. Rood: herstel dit op dezelfde manier.

## 6. Bewijs op main

Start na de laatste merge de browserrun op main (zie stap 1) en volg hem. Poging 1 moet `success` zijn, op exact de
SHA waarop je hem startte. Rood: terug naar stap 4, met deze run als `RUN`.

Dit is het einde van de job. Sluit het issue met de run-URL. Het eindrapport noemt wat er rood was, de oorzaak,
fix-PR's, reviews, VERVOLG en de bewijsrun.

## Stoppen om 14:00

Doe geen nieuwe merge of dispatch meer. Open fix-PR's blijven staan. Schrijf de stand in het issue. Het issue blijft
open. Zet bovenaan het eindrapport wat er nog rood is, voor Ethan. De job van de volgende vrijdag hervat dit werk.

## Stand voor de release

Er werkt nooit meer dan één Sol-taak tegelijk op main. Het enige signaal is een open issue met de titel
`Browsertests repareren` en het label `browsertests-reparatie`. Open issue: de reparatie loopt.

- Issue open: de release wacht. Geen vertalingen, geen versie, geen PR en geen tag.
- Issue dicht en laatste browserrun op main groen: de release gaat verder.
- Geen issue, en de vrijdagrun is rood of ontbreekt: de release doet de reparatie eerst zelf, ook met dat issue.
- Nog geen tag om 14:00: geen tag die week. De release meldt dat aan Ethan, met de reden.
  Is de reparatie dan niet klaar, dan blijft het issue open.

De release-skill wacht vóór alles op main, in [Eerst: browsertests](../release/SKILL.md#eerst-browsertests).
Hij leest de laatste browserrun zo, met `REPO` en `VANAF` uit stap 1. Oordeel op poging 1:

```bash
gh run list --repo "$REPO" --workflow ci.yml --branch main --created ">=$VANAF" --limit 100 \
  --json databaseId,event,status,conclusion,headSha,createdAt \
  --jq '[.[] | select(.event == "schedule" or .event == "workflow_dispatch")] | first'
```

## Geplande taak

Dit deel is configuratie-invoer en prompttekst; het maakt geen taak aan. De orkestrator maakt de taak na de merge.
Vorm gekozen door de orkestrator, 2026-10-31.

- Host: **aia09-mp50**, T3-scheduled task. Zelfde project als de wekelijkse release, geen vaste thread
  (`bindToCurrentThread: false`).
- Titel: `Browsertests repareren Open Planner Studio`.
- Schedule: `{"type":"fixed_time","timeOfDay":"23:30","weekdays":[5]}`. De scheduler rekent in de lokale tijd van
  aia, Europe/Amsterdam: de releasetaak van 07:00 staat op 06:00 UTC in de winter.
- Agent: alleen de doorgever draait in de taak zelf. Het werk gaat naar **Sol xhigh**. De taak start elke week, ook
  als de run niet startte of de wekker niets ziet.
- Begroting: de run duurde 15 tot 22 minuten (gemeten op #757). Schatting voor een fix-PR met review en PR-CI: 1 tot 2 uur.

### Letterlijke prompt

```text
Dit is de geplande reparatie van de browsertests van Open Planner Studio (besluit van de eigenaar, 2026-10-31). Jij bent alleen de doorgever. Doe het werk NIET zelf, lees geen code en stel geen vragen; het Claude-budget van de eigenaar is laag.

Stap 1. Roep `delegate_task` aan (t3-code MCP) met:
- target: providerInstanceId `codex`, model `gpt-6.1-sol`, options `{"reasoningEffort":"xhigh"}`. Is dat model "at capacity", probeer dan `gpt-6-sol` met dezelfde options.
- isolation `worktree`, mode `async`, role `implementation`, title `Browsertests repareren`, clientRequestId `ops-browsertests-repareren-<datum van vandaag JJJJ-MM-DD>`.
- task: de tekst tussen de lijnen hieronder, letterlijk.

Stap 2. Beëindig je beurt. Als de taak klaar is word je gewekt. Geef dan in het Nederlands, kort (ASD-STE100), het eindrapport door. Groen: één regel. Rood: wat er rood was, de fix-PR's, de reviews, de VERVOLG-punten en de bewijsrun. Staat er na de taak nog iets rood, zet dat dan bovenaan, voor Ethan. Zeg op welk model de agent draaide. Start geen tweede taak.

----------
Voer op aia09-mp50 de reparatie van de browsertests van Open Planner Studio uit (repo OpenAEC-Foundation/open-planner-studio).
Je werkt zonder de eigenaar. Stel geen vragen.
Haal eerst origin/main op. Lees daaruit AGENTS.md, .claude/rules/ci-release.md, .claude/rules/tests.md
en .claude/skills/browsertests-repareren/SKILL.md. Volg die skill volledig, ook de delen van
.claude/skills/release/referentie.md waarnaar hij verwijst.
Zoek de geplande ci.yml-run op main van deze vrijdagavond. Loopt hij nog, wacht dan hoogstens 2 uur.
Is er geen run, of is hij niet afgemaakt, start hem dan zelf met gh workflow run ci.yml --ref main en volg die.
Oordeel altijd op poging 1 van de run.
Groen: één regel in het eindrapport, klaar. Geen PR.
Niet groen: open meteen het issue met de titel Browsertests repareren en het label browsertests-reparatie.
Dat issue is het enige signaal aan de release. Sluit het pas na de groene bewijsrun.
Repareer alles wat rood is. Kleinste fix-PR vanaf main, met het label browsertests.
Een haperende test telt ook als rood. gh run rerun --failed is alleen diagnose. Wordt de test bij opnieuw
draaien groen, dan is hij nog niet gerepareerd: maak de test of de code stabiel, met een fix-PR.
Geen test overslaan, geen check verzwakken, geen retries erbij om het rood te verbergen.
Review door een tweede Sol: je mag daarvoor delegate_task gebruiken, met codex/gpt-6.1-sol en reasoningEffort xhigh.
De reviewbrief bevat de letterlijke body van ~/.claude/agents/reviewer.md en BLOKKEERT/VERVOLG; elke ronde is een
nieuwe taak. Alleen BLOKKEERT vraagt een nieuwe fixronde. Delegeer verder niets.
Merge na reviewakkoord en groene PR-CI met --merge --admin. Schrijf bevindingen als VERVOLG in knownbugs.md.
Start na de laatste merge de browserrun op main opnieuw en bewijs dat hij groen is. Dat is het einde van de job.
Geen tag, geen release, geen andere releasestappen. Kom niet aan de gate in release.yml.
Draai zo min mogelijk lokaal. De browsersuite draait in CI, niet op aia. Volg de Node-grenzen uit de skill.
Wees klaar vóór zaterdag 07:00. Lukt dat niet, ga dan door tot uiterlijk zaterdag 14:00 Europe/Amsterdam.
Stop dan. Zet bovenaan je eindrapport wat er nog rood is, voor Ethan. Open fix-PR's en het issue blijven staan.
Draai zware runs in de voorgrond of wacht met een echte until-lus; beëindig je beurt niet terwijl je wacht.
----------
```
