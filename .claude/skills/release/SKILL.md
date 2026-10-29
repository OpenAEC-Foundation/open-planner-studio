---
name: release
description: Gebruik alleen bij een expliciete /release of een verzoek om een nieuwe versie van Open Planner Studio uit te brengen, of wanneer de wekelijkse geplande release-job deze skill start. Nooit vanzelf bij committen, pushen, bouwen, een versie-bump of onderhoud aan deze skill.
---

# Wekelijkse release — Open Planner Studio

Besluit 9: eigenaar, verduidelijkt door de orkestrator op 2026-10-23. Alleen de zaterdagjob heeft de smalle
Node-uitzondering op [AGENTS.md](../../../AGENTS.md). De [exacte lijst en werkplekgrenzen](referentie.md#node-uitzondering-voor-de-zaterdagjob)
omvatten de lichte vertaalscripts en pakketchecks door de ouder en zijn Haiku-stations.
Alleen binnen die job en release-worktree. Andere runs en onderhoud aan deze skill krijgen geen uitzondering.

Mandaat: eigenaar, gesprek 2026-10-22. De zaterdagjob op aia09-mp50 voert deze skill
volledig automatisch uit. Er is geen menselijk akkoord vóór de tag. Stel geen vragen.
Een `v*`-tag is onomkeerbaar: installers, updater en Snap Store leveren aan alle gebruikers.
Alleen deze skill mag een release uitvoeren. Een verzoek om de skill te wijzigen publiceert niets.
`main` is altijd af; groot werk landt achter een feature-flag.

## 1. Werkplek en stopregels

- Controleer eerst de fetch- én push-URL van `origin`. Beide moeten exact naar
  `OpenAEC-Foundation/open-planner-studio` op github.com wijzen, via HTTPS of SSH.
  Een andere repo, ontbrekende origin of netwerkfout: stop vóór schrijven of publiceren.
- Gebruik een schone, eigen release-worktree vanaf vers opgehaalde `origin/main`.
  Neem geen ongecommit werk over. Haal volledige historie en origin-tags op.
  Alleen de zaterdagjob: eenmaal per run `npm ci` in die worktree vóór de eerste Node-stap.
  De hoofdcheckout heeft geen `node_modules`; maak geen link daarheen. Zie de exacte lijst hierboven.
- Harde deadline zaterdagjob: **14:00 Europe/Amsterdam**. Stop dan met herstel/publicatie.
  Vóór de tag: geen tag die week; behoud open fix-PR's en rapporteer de oorzaak.
  Na de tag: behoud tag/draft en hervat de voortgang de volgende zaterdag; sla afgeschreven tags over.
- Noteer de nieuwste stabiele origin-tag (`vJJJJ.W.N`, numeriek gesorteerd). Geen tag: stop.
  **Vóór de wijzigingscontrole en bump:** volg [Hervatten](referentie.md#hervatten).
  Controleer GitHub-publicatie, release-/Snap-/AUR-runs, wiki en website. Rond onafgerond werk
  voor dezelfde tag af, ook zonder nieuwe commits. Onopgelost: stop, tenzij de tag is afgeschreven
  of alleen websitewerk openstaat. Probeer dat de volgende zaterdag opnieuw naast de nieuwe release.
- Na herstel, uitgesteld websitewerk of vastgelegde afschrijving geldt die nieuwste tag als `PREV`.
  Volg daarna de [kandidaatselectie](referentie.md#kandidaatselectie): zoek open release-PR's
  en een ongetagde versie op main. Elke ongetagde kandidaat moet numeriek `VERSION > PREV` zijn;
  lager of gelijk: stop zonder tag. Hervat dezelfde versie/PR; bump uitsluitend bij `RELEASE_MODE=nieuw`.
  Haal `origin/main` opnieuw op als basis-SHA; `PREV` moet daarvan een voorouder zijn.
- Zoek de `ci.yml`-run op **die exacte basis-SHA** met event `push` en branch `main`.
  Ontbreekt hij: stop zonder tag. Loopt hij nog: wacht binnen de deadline.
  Rood: volg [CI herstellen](referentie.md#ci-herstellen): eenmaal rerun, dan een fix-PR
  met tweede Sol-review. Ga pas verder na groene CI op de actuele main-SHA.
- Geen commits sinds `PREV` en geen onafgerond app-werk: stop zonder bump/tag; meld “niets veranderd”.
- Falende `verify:translations`, `verify` in CI of ontbrekende/lege releasetekst blokkeert de tag.
  Herstel binnen de deadline volgens de referentie. Omzeil nooit een poort.
- Geen gelijktijdige release-run. Een bestaande doeltag gaat uitsluitend via het hervatpad;
  verplaats, verwijder of push hem nooit opnieuw. Geen force-push, secretwijziging of ongepoort dispatch.

## 2. Release-inhoud

Lees de volledige commitlijst sinds `PREV`. Gebruik die als bron voor alle teksten.
Neem bij hervatten de kandidaatversie, bestaande teksten en voortgang over; vul alleen aan wat ontbreekt.
Na afschrijving: neem de oorspronkelijke releasetekst plus de fix over naar de opvolgversie.
Voer na de kandidaatselectie, in de gekozen werkboom, uitsluitend bij een nieuwe kandidaat de bump uit:
```bash
: "${RELEASE_MODE:?Voer eerst de kandidaatselectie uit}"
if [ "$RELEASE_MODE" = nieuw ]; then npm run bump; fi
VERSION=$(node -p 'require("./package.json").version')
```
Een hervatte kandidaat krijgt ook na een weekwissel geen nieuwe bump. Schema: `JJJJ.W.N`, ISO-weekjaar, week zonder voorloopnul, volgnummer vanaf 0.
De bump gebruikt actuele origin-tags én de huidige versie en synct alle eigen versievelden.

- Schrijf 3–6 korte, opmaakarme bullets in `docs/release-notes/v<versie>.md`.
  Alleen de inhoud; `scripts/release-notes.mjs` voegt kop en Downloads toe.
- Voeg bovenaan `docs/CHANGELOG.md` een uitgebreide **Engelse** sectie toe:
  `## v<versie> — YYYY-MM-DD`, met Added / Changed / Fixed / Documentation waar passend.
  Elke uitgebrachte versie heeft een sectie; geen Ongepubliceerd-kop of commitdump.
- Voeg in `src/services/updater/releaseHighlights.ts` uitsluitend een nieuw versieblok toe.
  Precies vijf highlights: één primary met eventueel gidslink, vier secondaries zonder gidslink.
  Lever copy voor alle 28 `RELEASE_HIGHLIGHT_LOCALES` en reproduceerbare Git-statistieken.
  Behoud de dialoogstructuur. Volg [referentie.md](referentie.md#releasecijfers) voor de cijfers.
- Draai `npm run gen:release-highlights-json`; commit `public/release-highlights.json` mee.
- Volg de [wiki-skill](../wiki/SKILL.md). Toets documentatie tegen de releasecommits en werk
  `public/docs/{nl,en}/`, wiki-bronnen en zo nodig `AGENTS.md`/regels bij.
- Volg **elke release** de [update-ui-lang-skill](../update-ui-lang/SKILL.md), tot
  `npm run verify:translations` groen is. Alle 28 UI-talen moeten compleet en actueel zijn.
  `update-docs-lang` draait uitsluitend op een afzonderlijk verzoek van de eigenaar.
  Vraag er niet naar. Achterlopende gidsvertalingen blokkeren de release niet.

## 3. Poorten en groene main

Controleer beide tekstvormen en de documentatie:
```bash
node scripts/release-notes.mjs "v$VERSION" --format=body
node scripts/release-notes.mjs "v$VERSION" --format=notes
npm run verify:translations
npm run verify:docs
npm run publish:wiki
node scripts/run-ts.mjs scripts/check-wiki-links.ts
```
`VERSION` is de versie uit stap 2. Beoordeel elke opdracht op zijn exitcode.
Controleer vóór iedere commit `git status -sb`; commit alleen releasebestanden.
Staat de kandidaat al ongewijzigd op main met een gemergde PR, sla dan de PR/merge-stappen over.
Anders: push de releasebranch en hergebruik de kandidaat-PR; maak alleen zonder bestaande PR
`Release v<VERSION>`. Registreer hem bij T3 en bewaar daarin het hervatverslag.
De volledige `npm run verify`, alle tests en app-builds draaien uitsluitend in CI, ook vóór de tag.
Wacht op een geslaagde `ci.yml`-run voor de exacte PR-head; bij rood: volg CI herstellen.
Merge zelf met `gh pr merge <nr> --squash --admin --match-head-commit <head-SHA>`.
Hiervoor is geen menselijke review nodig. Bewaak de basis en cijfers zoals in de referentie.

Haal `origin/main` opnieuw op en gebruik een schone checkout van de gemergede releasecommit.
Wacht op de `ci.yml`-pushrun voor exact die commit: **alle jobs groen**.
Controleer vóór de tag opnieuw dat `origin/main` nog die SHA heeft. Bij nieuwe commits:
behoud kandidaatversie en voortgang; werk de basis, cijfers en CI bij zonder nieuwe bump.
Draai op de releasecommit; vergelijk ook hier jaar, week en volgnummer numeriek met `PREV`:
```bash
node --input-type=module - "$VERSION" "$PREV" <<'JS'
import { parseVersion } from './scripts/bump-version.js';
const [version, previous] = process.argv.slice(2).map(v => parseVersion(v.replace(/^v/, '')));
const first = version.findIndex((n, i) => n !== previous[i]);
if (first < 0 || version[first] < previous[first]) throw new Error('Versie is niet hoger dan PREV; stop zonder tag');
JS
node scripts/bump-version.js --check "$VERSION"
test -s "docs/release-notes/v$VERSION.md"
npm run verify:translations
npm run verify:release-highlights -- "$VERSION"
npm run verify:release-highlights-json
```
Een falende poort of ontbrekende releasetekst blokkeert de tag tot gecontroleerd herstel.

## 4. Tag en uitlevering

Alle poorten groen: noteer de definitieve SHA in het hervatverslag en tag zonder vraag:
```bash
git tag -a "v$VERSION" <gecontroleerde-main-SHA> -m "Open Planner Studio v$VERSION"
git push origin "refs/tags/v$VERSION"
```
`release.yml` herhaalt `verify:translations`, `verify` en de highlight-/versiecontroles.
Daarna bouwt en signeert hij installers, verifieert de draft en publiceert `latest.json`.
`snap.yml` en `aur.yml` volgen automatisch. Volg ze tot hun eindstatus en werk het hervatverslag bij.
Bij falen na de tag: volg [Herstel na de tag](referentie.md#herstel-na-de-tag), binnen de deadline.
Vereist herstel gewijzigde broncode/workflow: fix op main, schrijf de tag af en maak een opvolgversie.
De afgeschreven tag blijft staan; een eventuele draft blijft draft. Hervat die tag nooit meer.

Controleer de gepubliceerde release met [referentie.md](referentie.md#uitlevering-controleren):
notes in de body én `latest.json`, juiste versie, volledige assets en groene Snap-publicatie.

## 5. Wiki en website

- Publiceer de wiki via de wiki-skill: `npm run publish:wiki -- --push`.
  Controleer live de Home en een gewijzigde pagina; noteer de wiki-commit in het hervatverslag.
- Werk **elke release** `OpenAEC-Foundation/website` bij volgens
  [referentie.md](referentie.md#website): uitsluitend het nieuwe releaseblok onderaan en
  `#whats-new` bovenaan, met de bijbehorende vertalingen. Gebruik een websitebranch + PR.
  Merge direct met `gh pr merge <nr> --merge --admin`. Geen aparte vraag.
  Volg de referentie voor `deploy.yml`: `success` op de merge-SHA of een bewezen afstammeling,
  plus beide blokken live. Ontbrekend/geannuleerd: controleer opvolgruns, anders eenmaal dispatch.
  Geen websitecheckers of PR-checks vereist; generatoren, diffcontrole en dit deploy-/livebewijs volstaan.
  Bij falen blijft de app-release staan en blokkeert websitewerk de volgende app-release niet.
  Meld de fout; bewaar PR, merge-SHA en deployrun voor een nieuwe poging de volgende zaterdag.

## 6. Opruimen en rapporteren

Verwijder alleen eigen of aantoonbaar gemergede, schone worktrees zonder actieve sessie/dev-server.
Controleer per worktree `git status --porcelain`; behoud ongemergd of twijfelachtig werk.
Gebruik `git worktree remove` zonder force en daarna `git worktree prune`.
Meld versie, tag-SHA, workflow-URL's, fix-PR's/reviews, deadline, UI-vertalingen, wiki en websitedeploy.
Bij een stop vóór de tag: meld de precieze reden en dat niets is uitgebracht.
Leg bijvangst buiten deze release vast in `knownbugs.md`; los die niet stil mee op.
