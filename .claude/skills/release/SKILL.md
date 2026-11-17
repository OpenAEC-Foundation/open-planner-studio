---
name: release
description: Gebruik alleen bij een expliciete /release of een verzoek om een nieuwe versie van Open Planner Studio uit te brengen, of wanneer de wekelijkse geplande release-job deze skill start. Nooit vanzelf bij committen, pushen, bouwen, een versie-bump of onderhoud aan deze skill.
---

# Wekelijkse release — Open Planner Studio

Mandaat: eigenaar, gesprek 2026-10-22. De maandagjob op aia09-mp50 (maandag 07:00, besluit Ethan 2026-11-07) brengt
volledig automatisch uit, zonder menselijk akkoord vóór de tag. Stel geen vragen aan Ethan. Een `v*`-tag is
onomkeerbaar: installers, updater, Snap Store en AUR leveren aan alle gebruikers. `main` is altijd af.
Geen eindtijd (besluit Ethan, 2026-11-09); de weekendstop (zaterdag 23:00 tot maandag 01:00) en zondag blijven.

**De vaste stappen doet het releasescript** `scripts/release/run.mjs` (voorstel 2, Ethan 2026-11-16). De
release-thread start het, geeft elke stop door en doet alleen wat oordeel vraagt. **De thread tagt nooit zelf**,
pusht nooit naar main en publiceert niets buiten het script om. Na een herstel start hij het script opnieuw.
Node alleen volgens besluit 9: de [lijst in referentie.md](referentie.md#node-uitzondering-voor-de-maandagjob).

## Wat het script doet

In deze volgorde; elke stap kijkt eerst op GitHub of hij al af is, dus het script mag altijd opnieuw starten.

1. Origin controleren; wachten zolang het issue `Browsertests repareren` open is; `release-ci-check.mjs --browser`.
2. De vorige tag afronden ([Hervatten](referentie.md#hervatten)): release-run, publicatie, Verify Release, Snap
   (met de [verlopen Store-login](referentie.md#verlopen-snap-store-login)), AUR (met het
   [ontbrekende secret](referentie.md#ontbrekend-aur-secret)), assets en `latest.json`, wiki.
   Een afgeschreven tag slaat het over.
3. Wachten tot de nachtvertaling van vandaag klaar is; [kandidaat kiezen](referentie.md#kandidaatselectie);
   niets veranderd: klaar. Groene `ci.yml`-pushrun op de basis.
4. Werkplek `.claude/worktrees/release-werk`, `npm ci`, `npm run bump`, branch `release/v<versie>`.
5. Teksten via één tekstagent (`claude -p`, Opus 5.5 high, zonder thread): notes, Engelse changelog, vijf highlights
   in 28 talen, en de documentatie getoetst tegen de releasecommits zoals de [wiki-skill](../wiki/SKILL.md) vraagt.
   De agent mag alleen die bestanden schrijven. Daarna de checks; bij een fout gaat de melding één keer terug.
6. `verify:translations`; rood is de taak `vertalen` (hieronder). PR `Release v<versie>`, [cijfers](referentie.md#releasecijfers),
   groene PR-CI, squashmerge met `--match-head-commit`.
7. Groene pushrun op de releasecommit, `release-ci-check.mjs <sha>`, de poorten, tag, en dan stap 2 voor de nieuwe tag.
8. Website (`#whats-new` en de tijdlijn, [referentie](referentie.md#website)). Een websitefout stopt niets;
   hij staat in het verslag en de volgende maandag probeert het script het opnieuw.

De voortgang staat in de reactie `<!-- ops-release:<tag> -->` op de PR `Release v<versie>`.
Rode runs krijgen van het script eenmaal `gh run rerun --failed`; daarna is het een stop.

## Starten

Het script draait vanuit een eigen losse worktree op `origin/main`, zonder `npm ci` (alleen Node-ingebouwde modules):
```bash
REPO=/home/aia09/projects/open-planner-studio
S="$REPO/.claude/worktrees/release-script"
git -C "$REPO" fetch --quiet origin
[ -d "$S" ] || git -C "$REPO" worktree add --detach "$S" origin/main
git -C "$S" switch --quiet --detach origin/main
LOG=~/.local/state/ops-release/run-$(date +%F-%H%M).log; mkdir -p "$(dirname "$LOG")"
( node "$S/scripts/release/run.mjs"; echo "EXIT:$?" ) > "$LOG" 2>&1
tail -n 1 "$LOG"; grep '^RELEASE-MELDING ' "$LOG"
```
Het script wacht zelf op CI en runs (uren mogelijk). Draai het in de voorgrond, of start het losgekoppeld en wacht met een
`until grep -q '^EXIT:' "$LOG"`-lus; beëindig je beurt niet terwijl het loopt. Een tweede run tegelijk stopt met `al-actief`.
`--droog` leest alles en stopt vóór de eerste schrijvende stap (`RELEASE-DROOG <stap>`).

## De uitkomst

De laatste regel van het log beslist. Stuur daarnaast elke regel `RELEASE-MELDING <code>: …` uit het log, bij elke
uitkomst, letterlijk door aan wrakko (zie hieronder); een melding stopt de release niet.

- `RELEASE-KLAAR …` (exit 0): stuur wrakko het eindrapport (hieronder).
- `RELEASE-TAAK <code>: …` (exit 3): een vaste klus voor jou, geen fout. Doe hem en start het script opnieuw.
- `RELEASE-STOP <code>: <reden>` (exit 2): stuur wrakko **meteen**, vóór je iets anders doet, met `t3_thread_send`
  naar `mcp:61c68b58-2bdb-4ec2-9959-846e47c05c98` (environment `840d828d-5623-4ae4-8085-a5f6dd2c07b8`):
  `[sessie Trias · release OPS] RELEASE-STOP <code>: <reden>` letterlijk, plus een link naar de run of de PR-reactie.
  Volg daarna de route bij de code. Na een herstel: script opnieuw starten.

### Taken

| code | wat de thread doet |
|---|---|
| `vertalen` | [update-ui-lang](../update-ui-lang/SKILL.md) in `.claude/worktrees/release-werk` op de releasebranch, tot `verify:translations` groen is; commit daar (niet pushen). |
| `browserreparatie` | De [reparatie](../browsertests-repareren/SKILL.md), met de regel `BROWSERRUN=<id>` uit de reden. |

### Stops

| code | route |
|---|---|
| `main-ci-rood`, `pr-ci-rood`, `release-rood`, `release-verify-rood`, `snap-mislukt`, `aur-mislukt` | De rerun is al gebruikt. [CI herstellen](referentie.md#ci-herstellen): kleinste fix-PR, tweede Sol-review, merge. Raakt het de getagde code: [Herstel na de tag](referentie.md#herstel-na-de-tag). Ontbrekende credentials: alleen melden. |
| `merge-conflict` | Los het conflict op in `release-werk` (behoud de kandidaatversie), commit. |
| `tekst-agent`, `tekst-grens`, `tekst-checks` | Lees de reden; herstel de tekst of de grens in `release-werk` en commit. Bij `tekst-grens` eerst de vreemde wijziging weghalen. |
| `cijfers` | Cijfercorrectie volgens [Releasecijfers](referentie.md#releasecijfers), met squash. |
| `werkplek` | Bekijk de werkplek; bewaar wat waarde heeft, ruim de rest op. |
| `weekendstop` | Niets; de volgende maandag gaat het verder. |
| overige (`origin`, `reparatie-geblokkeerd`, `geen-tag`, `kandidaat`, `main-ci-ontbreekt`, `release-ontbreekt`, `snap-ontbreekt`, `uitlevering`, `wiki`, `inhoud-ontbreekt`, `main-beweegt`, `poort`, `wacht-te-lang`, `al-actief`, `onverwacht`) | Niets veranderen; wacht op wrakko. |

Bij een stop vóór de tag is er die week niets uitgebracht; open fix-PR's blijven staan. Na de tag blijft alles staan.
Een fout in het script zelf is ook een stop: herstel het script niet tijdens de release.

## Eindrapport

Aan wrakko, kort: de slotregel, de `RELEASE-MELDING`-regels, versie en tag-SHA, de link naar de PR-reactie, fix-PR's en
reviews, wat open bleef (website, Snap Store of Arch zonder pakket en waarom), en wat de tekstagent niet zeker wist. Verwijder daarna alleen eigen schone
worktrees zonder lopend werk (`git worktree remove` zonder force). Bijvangst gaat naar `knownbugs.md`.
