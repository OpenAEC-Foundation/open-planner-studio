# Release-details

Lees het passende onderdeel tijdens de release. Dit bestand geeft geen zelfstandig publicatiemandaat.

## Node-uitzondering voor de zaterdagjob

**Besluit 9: eigenaar, verduidelijkt door de orkestrator op 2026-10-23.** Lichte release-scripts
mogen op de server; de bedoeling is overbelasting voorkomen, niet de release blokkeren.
Dit is de vaste, smalle uitzondering op de
[Server restriction in AGENTS.md](../../../AGENTS.md), aangehaald in [SKILL.md](SKILL.md).
Alleen de geplande wekelijkse releasejob op aia09-mp50 mag onderstaande Node-stappen uitvoeren.
Zijn Haiku-vertaalstations mogen hun eigen pakketchecks uitvoeren binnen dezelfde job en worktree.
Onderhoud aan de skill, losse releases, CI-fixagents en agents voor codereview krijgen geen uitzondering.

Gebruik uitsluitend de eigen release-worktree. Houd de Node-stappen daar, ook bij hervatten of
wisselen van releasecommit. Geen Node in de hoofdcheckout, een CI-fixworktree of een andere checkout.
Alleen de vier websitegeneratoren draaien in een tijdelijke websitekopie binnen de release-worktree.

De volledige lijst:

- Eenmaal per run `npm ci` in de release-worktree. De hoofdcheckout heeft geen `node_modules`;
  gebruik geen link daarheen en installeer niet opnieuw per stap of in de websitekopie.
- `npm run bump` en `node scripts/bump-version.js --check "$VERSION"`.
- De bestaande kleine inline `node`-blokken in deze skill: afschrijving herkennen,
  kandidaatselectie, pakketversie lezen en jaar/week/volgnummer numeriek vergelijken.
  Ook `node -p 'process.execPath'` om het Node-pad voor de vertaalstations vast te stellen.
- `node scripts/release-notes.mjs "v$VERSION" --format=body` en dezelfde opdracht met `--format=notes`.
- `npm run gen:release-highlights-json`, `npm run verify:release-highlights -- "$VERSION"`
  en `npm run verify:release-highlights-json`.
- `npm run translate -- prepare ui <taal> --missing`, `--stale` of `--avoid`;
  `npm run translate -- apply ui <taal>`, `npm run translate -- packages ui <talen> [--red]`
  en `npm run translate -- status [taal] [--strict]`.
  Voor termbaseherstel uit `update-ui-lang`: `npm run translate -- terms-lookup <taal>`
  en `npm run translate -- apply-terms <taal>`.
- `node build/translate/check.mjs <pakket>` bij de ouder én zijn Haiku-vertaalstations.
  Het absolute Node-pad mag ook; checker en pakket blijven in dezelfde release-worktree.
- `npm run i18n:add -- ...`, `npm run i18n:fmt`, `npm run i18n:resolve`,
  `npm run verify:i18n` en `npm run verify:translations`.
- `npm run verify:docs`, `npm run publish:wiki` (dry-run), `npm run publish:wiki -- --push`
  en `node scripts/run-ts.mjs scripts/check-wiki-links.ts`.
- Alleen in de tijdelijke websitekopie: `node scripts/generate-release-notes.js`,
  `node scripts/generate-release-highlights.js`, `node scripts/build-i18n-pages.js`
  en `node scripts/build-release-notes-static.js`.

Interne helperprocessen van deze opdrachten horen bij die stap; dit staat geen andere losse Node-opdracht toe.
Tests (`npm test`, alle suites en browsertests), app-builds (`npm run build`, `tauri:*`), de volledige
`npm run verify` en dev-servers blijven hier verboden. Ook geen andere installatie of `npx`.
De verplichte volledige verify vóór de tag komt uit `ci.yml` op de exacte main-SHA.
`release.yml` herhaalt de volledige verify na de tag, vóór publicatie. Bekijk die runs met `gh`.
Gerichte tests en foutreproducties horen eveneens in PR-CI; sla geen check over en verzwak niets.

### Grenzen bij aangeroepen skills

De [wiki-skill](../wiki/SKILL.md) vraagt alleen Node-stappen uit de lijst hierboven.
Ook de lichte stappen uit [update-ui-lang](../update-ui-lang/SKILL.md) vallen binnen de lijst,
inclusief pakketselectie, pakketchecks, i18n-onderhoud en termbaseherstel.
Gebruik de bestaande release-worktree en zijn eenmaal geïnstalleerde dependencies. Sla de losse
werkplekinrichting van `update-ui-lang` over; geen extra worktree, installatie of `node_modules`-link.
Geef elk T3-Haiku-station expliciet het zaterdagmandaat, de release-worktree en toestemming voor
zijn eigen `build/translate/check.mjs`-pakketcheck uit deze lijst mee. Dit geldt voor vertalen,
nalezen en herstellen, uitsluitend binnen deze zaterdagjob. De stations installeren niets.
Behoud de bestaande pakketpoorten en wacht op alle vereiste stations vóór `apply ui`.

## Hervatten

Doe dit vóór “niets veranderd” en vóór `npm run bump`. Neem de numeriek nieuwste stabiele
**origin-tag**, ook als zijn release ontbreekt of draft is. Zet `REPO=OpenAEC-Foundation/open-planner-studio`.
`TAG` is die bestaande tag, `SHA` zijn gepelde commit en `VERSION="${TAG#v}"`.
Werk voor publicatie in een schone worktree op `SHA`; CI-fixes krijgen apart een branch vanaf main.
Een incomplete app-uitlevering wordt nooit stil als vorige voltooide release gebruikt.
Alleen open websitewerk blokkeert een volgende app-release niet; probeer het de volgende zaterdag opnieuw.

**Controleer eerst afschrijving**, vóór enige release-/workflowpoging voor deze tag.
De vaste regel staat in de body van de gemergde app-release-PR, titel `Release v<VERSION>`:
`Afgeschreven tag: v<VERSION>`. Alleen een volledige, exacte regel voor deze tag telt.
Voer dit uitsluitend lezende blok uit en neem `actie` en `prev` over:

```bash
TAG="$TAG" node --input-type=module <<'JS'
import { execFileSync } from 'node:child_process';
const tag = process.env.TAG;
const prs = JSON.parse(execFileSync('gh', ['pr', 'list', '--repo', 'OpenAEC-Foundation/open-planner-studio',
  '--base', 'main', '--state', 'merged', '--search', `"Release ${tag}" in:title`, '--limit', '1000',
  '--json', 'title,body,url'], { encoding: 'utf8' }));
const afgeschreven = prs.find(pr => pr.title === `Release ${tag}` &&
  pr.body.split(/\r?\n/).includes(`Afgeschreven tag: ${tag}`));
console.log(JSON.stringify({ actie: afgeschreven ? 'opvolger' : 'hervatten', prev: tag,
  releasePr: afgeschreven?.url }));
JS
```

- `actie=hervatten`: voer hieronder de normale hervatstappen uit. Een leesfout stopt de job.
- `actie=opvolger`: zet `AFGESCHREVEN_TAG="$TAG"` en **`PREV="$TAG"`**, ook bij een draft of ontbrekende
  GitHub-release. Sla hervatstappen 1–6 voor deze tag over: geen rerun, dispatch, publicatie, wiki of
  website voor deze tag. Ga naar actuele main, rond eerst de bijbehorende fix-PR/review af en eis groene
  main-CI. Voer daarna de kandidaatselectie uit. Een bestaande opvolger boven `PREV` gaat voor;
  anders `RELEASE_MODE=nieuw`, dan pas `npm run bump` zonder argument. Volg [Herstel na de tag](#herstel-na-de-tag).

Bewaar in de app-release-PR (titel `Release v<VERSION>`) één bijwerkbaar commentaar met marker
`<!-- ops-release:TAG -->`: tag/SHA, run-ID's en eindstatus van release/Snap/AUR, wiki-bron-SHA en
wiki-commit, website-PR-URL, merge-SHA en deployrun, resterende fout. Leg ook reruns, fix-PR's,
review-taak-ID's/head-SHA's, BLOKKEERT/VERVOLG en de deadline vast. Vul `TAG` in de marker echt in.
Schrijf het commentaar vóór de tag en na elke stap bij. Een lokaal bestand of chatbericht is geen
hervatbewijs. Zonder bestaand verslag: reconstrueer dezelfde gegevens uit GitHub en de wiki;
controleer de werkelijkheid ook als het verslag “klaar” zegt. Maak geen dubbele release of PR.
Neem onafgerond websitewerk met de oorspronkelijke PR en merge-SHA over in het verslag van de
volgende release, zodat het ook na een nieuwe tag hervatbaar blijft.

1. **Publicatie en runs.** Lees `gh api "repos/$REPO/releases/tags/$TAG"`: de release moet bestaan,
   `draft=false`, `prerelease=false` en een `published_at` hebben. Alleen HTTP 404 betekent
   ontbrekend; auth-/netwerkfouten zijn geen aanleiding om opnieuw te publiceren.
   Zoek de release-run met `gh run list --workflow release.yml --commit "$SHA"`.
   Zoek vervolgruns met `gh run list --workflow snap.yml --event workflow_run` (idem `aur.yml`).
   Hun eigen `head_sha` kan de defaultbranch zijn: koppel via getagde checkout/versie in de logs
   en de vastgelegde run-ID's, niet blind via `--commit`. Een PR-run of overgeslagen publicatie
   telt niet. Wacht binnen de deadline op een lopende run; start geen tweede.
2. **Release herstellen.** Is de bijbehorende `release.yml`-run mislukt of geannuleerd: bekijk
   eerst de fout en de geslaagde jobs met `gh run view <run-id> --json jobs` en `--log-failed`.
   Volg [CI herstellen](#ci-herstellen): eerst eenmaal `gh run rerun <run-id> --failed`, ook bij een
   inhoudelijke fout. Blijft hij rood: fix-PR met Sol-review, binnen de deadline.
   Dit is publiceren en valt onder het zaterdagmandaat. Bewaar de gebruikte rerunpoging.
   Nooit een hele release-run opnieuw starten als `create-release` al slaagde: die maakt een nieuwe
   draft met `createRelease`, zonder bestaande-releasecontrole. Gebruik de bestaande run en outputs.
   Ontbreken zowel release als run: start eenmaal de volledige gate op **de bestaande tag**:
   `gh workflow run release.yml --ref "$TAG" -f "version=$TAG"`. Ontbreekt alleen de run maar
   bestaat wel een draft/publicatie, of zijn de outputs onbruikbaar: stop met de exacte blokkade.
   Een main-fix werkt niet vanzelf door in deze tag; volg [Herstel na de tag](#herstel-na-de-tag).
   Bij afschrijving stopt dit hervatpad voor de oude tag. Geen poort omzeilen of tag verplaatsen.
3. **Snap en AUR herstellen.** Na een groene release-run moeten de bijbehorende vervolgworkflows
   groen zijn. Gebruik bestaande run-ID's en controleer de geselecteerde versie in hun logs.
   Een mislukte run: volg CI herstellen, met dezelfde grens voor getagde broncode.
   Ontbreekt een run: start niet de release opnieuw. `snap.yml`-dispatch is alleen een bouwtest
   en publiceert niet. Stop daarvoor met de ontbrekende run als blokkade.
   Voor een ontbrekende AUR-run mag de bestaande publicatieroute wel:
   `gh workflow run aur.yml --ref "$TAG" -f "version=$TAG" -f publish=true`.
   Controleer `Publish to Snap Store` en `Push to AUR` op `success`; ontbreken credentials, meld
   de blokkade zonder secrets te wijzigen. Bestond een vervolgworkflow nog niet in deze historische
   tag, leg “niet van toepassing” vast met bewijs uit `git cat-file -e "$TAG:.github/workflows/<naam>"`.
4. **Gepubliceerde assets.** Voer [Uitlevering controleren](#uitlevering-controleren) uit voor `TAG`.
   Een gepubliceerde release alleen is geen bewijs van complete of juiste assets.
5. **Wiki hervatten.** Genereer uit `SHA` via de wiki-skill een dry-run en controleer links.
   Clone/fetch de wiki. Een vastgelegde wiki-commit moet in de remote historie zitten en de
   gegenereerde bestanden van `SHA` bevatten. Ontbreekt dat bewijs: vergelijk de beheerde
   `.wiki-build/`-bestanden met de remote wiki. Bij ontbrekende wijzigingen opnieuw
   `npm run publish:wiki -- --push` uit deze worktree. De generator doet niets als alles al gelijk is.
   Controleer remote en live Home/gewijzigde pagina; noteer bron-SHA en wiki-commit. Bij fout stoppen.
6. **Website hervatten.** Lees de bestaande website-PR uit het verslag; zoek bij ontbrekend verslag
   in website-PR's op deze versie en controleer ook beide blokken op website-main/live.
   Volg de [websiteprocedure](#website). Hergebruik een open versie-PR en merge direct met
   `gh pr merge <nr> --repo OpenAEC-Foundation/website --merge --admin`.
   Controleer een gemergde PR via [Websitedeploy controleren en herstellen](#websitedeploy-controleren-en-herstellen).
   Een geslaagde deploy op de merge-SHA of een bewezen afstammeling telt, mits beide blokken live staan.
   Staat de juiste inhoud al op main zonder PR, leg die main-SHA vast als basis voor dezelfde controle.
   Bij ontbrekende wijziging maak je de versie-PR alsnog. Bij een gesloten, ongemergede PR of
   blijvend mislukte/ontbrekende deploy: meld en bewaar het resterende werk voor de volgende zaterdag.
   De app-release blijft staan; dit websitewerk blokkeert ook de volgende app-release niet.

Na alle toepasselijke hervatstappen, uitgesteld websitewerk of vastgelegde afschrijving: noteer de tag als `PREV`.
Ga terug naar actuele `origin/main` en voer de kandidaatselectie hieronder uit. Een bestaande kandidaat gaat vóór
“niets veranderd” en vóór een nieuwe bump. `PREV` blijft de numerieke versieondergrens.
Bij afschrijving blijft de oorspronkelijke releasetekst daarnaast de inhoudsbron voor de opvolger.

## Kandidaatselectie

Voer dit vóór **iedere** bump uit, na het afhandelen van de laatste tag. Een pakketversie zonder
origin-tag is alleen hervatbaar als hij **numeriek hoger is dan `PREV`**. Vergelijk JJJJ, W en N
als getallen, in die volgorde. Lager of gelijk: stoppen met versie en `PREV` in de melding;
geen bump of tag. De kalenderweek van vandaag is geen ondergrens: een oudere week boven `PREV` mag.

Voer vanuit de repo dit uitsluitend lezende blok uit. Alleen titels `Release v<versie>` tellen als
release-PR (de vaste titel uit stap 3); gewone feature-PR's worden genegeerd. Twee release-PR's
betekenen stoppen. Lees hun echte pakketversie op de PR-head; titel en pakket moeten overeenkomen.
Neem `mode`, `version` en de bestaande `pr` uit de JSON over; `mode` wordt `RELEASE_MODE`.

```bash
PREV="$PREV" node --input-type=module <<'JS'
import { execFileSync } from 'node:child_process';
import { parseVersion } from './scripts/bump-version.js';
const repo = 'OpenAEC-Foundation/open-planner-studio';
const read = (cmd, ...args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();
const previous = parseVersion(process.env.PREV.replace(/^v/, ''));
const tags = new Set(read('git', 'ls-remote', '--tags', 'origin', 'v*').split('\n')
  .map(line => line.split('\t')[1]?.replace(/^refs\/tags\//, '').replace(/\^\{\}$/, '')));
const main = JSON.parse(read('git', 'show', 'origin/main:package.json')).version;
const prs = JSON.parse(read('gh', 'pr', 'list', '--repo', repo, '--base', 'main', '--state', 'open',
  '--limit', '1000', '--json', 'number,title,headRefName,headRefOid,url'))
  .filter(pr => /^Release v[0-9]+\.[0-9]+\.[0-9]+$/.test(pr.title));
if (prs.length > 1) throw new Error('Meerdere open release-PRs; stop zonder bump of tag');
const candidates = tags.has(`v${main}`) ? [] : [{ mode: 'main', version: main }];
for (const pr of prs) {
  const version = JSON.parse(read('gh', 'api', `repos/${repo}/contents/package.json?ref=${pr.headRefOid}`,
    '-H', 'Accept: application/vnd.github.raw+json')).version;
  if (pr.title !== `Release v${version}`) throw new Error('Titel en PR-pakketversie verschillen; stop');
  if (tags.has(`v${version}`)) throw new Error('PR-versie is al getagd; eerst het hervatpad volgen');
  candidates.push({ mode: 'pr', version, pr });
}
for (const { version } of candidates) {
  const fields = parseVersion(version);
  const first = fields.findIndex((n, i) => n !== previous[i]);
  if (first < 0 || fields[first] < previous[first]) {
    throw new Error(`Kandidaat ${version} is niet hoger dan PREV ${process.env.PREV}; stop zonder tag`);
  }
}
if (new Set(candidates.map(c => c.version)).size > 1) throw new Error('Kandidaatversies botsen; stop');
console.log(JSON.stringify(candidates.find(c => c.mode === 'pr') ?? candidates[0] ?? { mode: 'nieuw' }));
JS
```

- **Open release-PR:** `RELEASE_MODE=pr`. Gebruik zijn bestaande branch/head, versie en
  hervatverslag. Maak geen tweede PR, bump niet en voeg geen dubbel notes-/highlights-/changelogblok toe.
  Voeg zo nodig actuele main samen op die branch, behoud de kandidaatversie en vernieuw cijfers/CI.
- **Ongetagde versie op main, geen open kandidaat-PR:** `RELEASE_MODE=main`. Gebruik die versie,
  notes/highlights en de bestaande gemergde release-PR met zijn verslag. Hervat direct bij de
  main-poorten van stap 3. Ontbreekt nog inhoud: vul die voor **dezelfde versie** aan via een
  correctie-PR (`RELEASE_MODE=pr`) met normale PR/main-poorten; vernieuw de cijfers voor de extra
  commit. Geen bump, ook niet op de volgende zaterdag.
- **Geen van beide:** `RELEASE_MODE=nieuw`. Pas nu mag de wijzigingscontrole tot een nieuwe
  `npm run bump` leiden. Een afgeschreven tag met nog te maken opvolger blijft onafgerond werk;
  anders is er zonder nieuwe commits sinds `PREV` niets te releasen.

Match PR en main op versie. Verschillende kandidaatversies of meerdere open PR's voor dezelfde
versie: stop en meld de botsing; kies niet stil een nieuwe versie. Controleer dat de PR-head echt
de kandidaatversie bevat. Reconstructeer ontbrekende voortgang uit de bestaande PR en bestanden.
Een al getagde kandidaat gaat terug naar [Hervatten](#hervatten). Alleen vastgelegde afschrijving
maakt de route naar een nieuwe opvolgversie vrij; een bestaande ongetagde opvolger krijgt geen extra bump.

## CI herstellen

Besluit 8: eigenaar, gesprek 2026-10-22. Dit geldt voor rode main-CI, release-PR-CI en
releaseworkflows na de tag. Een rode poort blijft blokkeren; de job repareert de oorzaak zelf.

### Deadline en voortgang

De zaterdagjob stopt uiterlijk **14:00 Europe/Amsterdam**, dezelfde zaterdag als de start om 07:00.
Gebruik de lokale datum/tijd met die IANA-tijdzone; geen vaste UTC-offset (zomer-/wintertijd).
Controleer de tijd vóór reruns, delegaties, commits, merges, dispatches en tag/publicatie.
Wacht begrensd op runs en reviewtaken. Start geen nieuwe stap die niet meer binnen de deadline past.
Om 14:00: geen nieuwe mutaties; bewaar de actuele status en rapporteer de precieze oorzaak.
Nog geen nieuwe tag: die week geen tag meer. Een open fix-PR blijft staan. Al getagd: niets terugdraaien.
De volgende zaterdag hervat de bestaande voortgang: dezelfde tag tenzij afgeschreven, dan zijn
fix/opvolger. Een al ongetagde opvolgversie behoudt zijn nummer, ook na een weekwissel.

Leg run-ID/attempt, rerunpoging, foutbewijs, fix-PR/branch/head, review-taak-ID's en resterend werk
vast in het hervatverslag. Vóór een release-PR bestaat, staat dit in de fix-PR; verwijs er later naar.
Zoek bij de volgende start eerst die open fix-PR voor dezelfde fout. Hervat die branch en review;
maak geen dubbele PR. Een al verbruikte rerunpoging begint na een weekwissel niet opnieuw.

### Rerun, kleinste fix, merge

1. Lees de rode jobs en logs van de **exacte** main-/PR-head of getagde run:
   `gh run view <run-id> --json jobs` en `gh run view <run-id> --log-failed`.
   Draai de mislukte checks eerst eenmaal opnieuw met `gh run rerun <run-id> --failed`.
   Bewaar de poging en wacht binnen de deadline. Groen: hercontroleer de SHA en vervolg de poorten.
   Ontbrekende runs of auth-/netwerkfouten zijn geen rode check; verzin geen succes of nieuwe run.
2. Nog rood: maak een eigen fixbranch vanaf vers opgehaalde `origin/main` en een fix-PR tegen main.
   Reproduceer de oorzaak in PR-CI en maak de kleinste fix die haar repareert. Geen test uitzetten of
   overslaan, geen check verzwakken. Gerichte tests en volledige `verify` lopen in PR-CI, nooit lokaal.
   Lees vóór iedere commit `git status -sb`. Geen directe push naar main of force-push.
   Open de fix-PR vroeg, registreer hem bij T3 en leg fout, run en releasekandidaat vast.
3. Laat een tweede Sol-agent de actuele fix-PR-head reviewen zoals hieronder. Alleen BLOKKEERT
   vraagt een nieuwe fixronde. Iedere gewijzigde head krijgt opnieuw review en PR-CI.
   Een mislukte/onvolledige review is geen akkoord. Een rode fix-PR-check volgt dezelfde
   eenmalige rerun en herstelronde op deze fixbranch; maak daarvoor geen keten van fix-PR's.
4. Review akkoord en alle PR-CI groen voor dezelfde head: merge een PR met uitsluitend cijfercorrecties met
   `gh pr merge <nr> --squash --admin --match-head-commit <head-SHA>`.
   Alle overige fixes: `gh pr merge <nr> --merge --admin --match-head-commit <head-SHA>`.
   De cijfercorrectie voegt zo precies één commit toe; bereken vanaf de actuele basis volgens
   [Releasecijfers](#releasecijfers). Na een inhoudelijke fix kan een aparte cijfercorrectie nodig zijn.
   Haal main opnieuw op en wacht op groene `ci.yml` met event `push`, branch `main` en exact de
   merge-SHA. Is main verder gegaan, controleer de nieuwste main-SHA; een oudere groene run volstaat niet.
5. Hervat pas daarna de release. Bij een rode release-PR: neem de fix via een gewone merge van
   main op in de bestaande releasebranch. Los conflicten op, behoud de kandidaatversie en vernieuw
   cijfers/JSON volgens [Releasecijfers](#releasecijfers). Ook een fout die alleen in de kandidaat
   optreedt moet in PR-CI op die kandidaat gereproduceerd en na de fix opnieuw getest worden.
   Wacht opnieuw op groene release-PR-CI en main-CI. Geen tweede bump.
   Een lokale releasepoort krijgt dezelfde kleinste fix en review; zonder run valt alleen de rerun weg.

### Tweede Sol-review via T3

Lees op aia09-mp50 **`~/.claude/agents/reviewer.md`**. Neem de volledige body vanaf
`# Hyperkritische review` **letterlijk** op in `task`. Daarmee staan de houding, bewijslast en
rapportvorm in de brief zelf. Alleen naar het bestand verwijzen is onvoldoende.
De YAML-keuze voor Opus neem je niet over. Lees `orchestrator_capabilities` en kies provider
`codex`, model `gpt-6.1-sol`, met `target.options.reasoningEffort="xhigh"`.
Ontbreekt het bestand, model of de optie: bewaar de fix-PR en meld de exacte blokkade.

Gebruik een nieuwe T3 `delegate_task` per reviewronde:
```json
{
  "target": {"providerInstanceId":"codex","model":"gpt-6.1-sol","options":{"reasoningEffort":"xhigh"}},
  "isolation": "shared",
  "mode": "wait",
  "timeoutMs": 60000,
  "clientRequestId": "<fix-PR>:<head-SHA>:review-<ronde>",
  "task": "<letterlijke volledige reviewer-body>\n<oorspronkelijke fout, run/logbewijs, PR-URL, exacte head-SHA, scope en gerichte checks>\n<alle vorige bevindingen, antwoorden/fixes en open bezwaren; leeg bij ronde 1>\nWerk alleen lezend. Geen commits, pushes, publicatie of delegatie. Behoud de voorgeschreven vijfdelige rapportvorm en bewijslabels. Deel de bevindingen binnen punt 2 in BLOKKEERT en VERVOLG in. Alleen BLOKKEERT vraagt een nieuwe fixronde; vermeld VERVOLG in het eindrapport. Geef akkoord voor deze head als er geen BLOKKEERT overblijft."
}
```
Vul de brief concreet in. BLOKKEERT omvat fouten die correct herstel verhinderen of regressies
veroorzaken; VERVOLG omvat niet-blokkerende verbeteringen. Behoud [BEVESTIGD]/[VERMOED] en onderbouwing.
Controleer geretourneerde provider, model en opties. Bewaar elk `taskId` en het rapport voor die head.
Een timeout laat de child doorlopen: lees `task_status(taskId)` binnen de deadline, start geen duplicaat.
Gebruik `childThreadId` nooit als vervolgronde. Elke nieuwe ronde krijgt een nieuwe `delegate_task`
met de oorspronkelijke brief én eerdere bevindingen/antwoorden; een retry van dezelfde aanvraag
houdt dezelfde `clientRequestId`. Bij de deadline: leg een nog actieve taak vast en hervat die eerst.

### Herstel na de tag

Ook een rode `release.yml` begint met één `--failed`-rerun en daarna een fix-PR met bovenstaande review.
Een main-fix verandert de getagde broncode of workflow niet; een rerun gebruikt de oude SHA/workflow.
Is uitsluitend een externe oorzaak weggenomen, hervat dan gericht de mislukte jobs van de bestaande
run. Bewaar het bewijs; herhaal niet ongewijzigd als die weer faalt. Nooit een volledige rerun na
geslaagde `create-release` of een dispatch op main om de getagde gate te omzeilen.

**Besluit orkestrator, 2026-10-22:** heeft de tag gewijzigde broncode of workflow nodig, dan geldt:

1. Repareer de oorzaak via de fix-PR-route op main: rerun → kleinste fix-PR → tweede Sol-review →
   groene PR-CI → merge → groene CI op de exacte main-SHA. Behoud de fix-PR bij de deadline.
2. Schrijf de mislukte tag af. Zet in de body van zijn gemergde release-PR een eigen, vaste regel:
   ```text
   Afgeschreven tag: v2026.43.0
   ```
   Vul de echte tag in. Noteer eronder reden, fout/run-URL, fix-PR en later de opvolger-PR/tag.
   Bewaar ook het bestaande hervatverslag. Er komt geen apart register of nieuwe release-status.
   Lees de opgeslagen body terug voordat je doorgaat. Een nog niet vastgelegde afschrijving is
   geen vrijbrief voor een nieuwe bump. Staat de fix bij de deadline nog open, zet de afschrijfregel
   alvast met het foutbewijs en die fix-PR; de volgende job rondt eerst de fix af, vóór een nieuwe bump.
3. **Vanaf die regel geen enkele nieuwe poging meer op de afgeschreven tag.** Verplaats, verwijder
   of push hem nooit opnieuw. Een eventuele draft blijft draft; publiceer hem niet. Laat een reeds
   gepubliceerde release staan. Vermeld de afgeschreven tag en reden altijd in het eindrapport.
4. Zet `AFGESCHREVEN_TAG="$TAG"`, `PREV="$TAG"` en ga naar actuele main. Zoek eerst een bestaande
   opvolgkandidaat zoals in [Kandidaatselectie](#kandidaatselectie). Alleen zonder opvolger:
   `RELEASE_MODE=nieuw` en **`npm run bump` zonder argument**. De origin-tag blijft meetellen,
   bijvoorbeeld `2026.43.0` → `2026.43.1`; op een volgende week geldt het bestaande weekschema.
   De opvolger moet numeriek `VERSION > PREV` zijn; de afgeschreven versie wordt nooit hergebruikt.
5. Neem `docs/release-notes/v<afgeschreven-versie>.md` uit die tag over naar het nieuwe notesbestand
   en vul de tekst aan met de fix. Bij meerdere afschrijvingen bevat elke opvolger ook alle eerdere
   nog niet uitgebrachte inhoud. Verplaats de nog niet uitgebrachte changelogsectie naar de opvolgversie
   en voeg de fix toe; behoud uitgebrachte secties. Maak het nieuwe highlight-versieblok met die
   inhoud en vernieuw de cijfers/JSON. De bestaande cijferverifier blijft de nieuwste origin-tag
   als basis gebruiken, ook bij afschrijving; verwissel die niet stil met de vorige publicatie.
6. Doorloop de normale release-PR, poorten, groene main, nieuwe tag en uitlevering. De afschrijving
   slaat geen enkele poort over. Is het 14:00: stop en bewaar fix/opvolger in de PR's. De volgende
   zaterdag herkent de vaste regel de afschrijving en hervat dezelfde opvolger, zonder extra bump.

## Releasecijfers

`scripts/verify-release-highlights.ts` vergelijkt exact met Git, niet met afgeronde schattingen.
Een extra commit of een gewijzigde mergebasis verandert de cijfers. Plan daarom een squashmerge.

1. Noteer `BASE` = de groene `origin/main`-SHA bij de start en `PREV` = de vorige origin-tag.
2. Neem voor `commitsSincePrevious` het aantal `git rev-list --count "$PREV..$BASE"` **plus 1**:
   de release-PR wordt één squashcommit. Tussentijdse commits op de releasebranch tellen niet mee.
3. Meet `addedCodeLines` met dezelfde paden/uitsluitingen als de verifier, maar gebruik de
   uiteindelijke werkboom (`git diff --numstat "$PREV" -- ...`). Neem het nieuwe highlight-blok mee.
   Werk alleen cijfers bij en genereer daarna opnieuw de JSON; dat verandert het regelaantal niet.
4. Bereken `daysSincePrevious` volgens de formule in de verifier: afgeronde dagen tussen de
   commitdatum van `PREV` en de verwachte squashcommitdatum. Gebruik geen tag-aanmaakdatum.
5. Controleer vlak vóór de squashmerge dat `origin/main` nog `BASE` is. Anders: stop deze kandidaat
   en werk dezelfde kandidaatversie bij vanaf de nieuwe basis. Geen nieuwe bump of force-push.
6. Controleer ná de merge op de echte main-commit `npm run verify:release-highlights -- "$VERSION"`.
   Vóór de merge zijn de cijfers van de uiteindelijke squashcommit nog niet tegen `HEAD` te toetsen.
   Een verschil (ook door datumafronding) blokkeert de tag. Corrigeer via een nieuwe PR met de
   fix-/reviewroute uit [CI herstellen](#ci-herstellen), maar **verplicht met `--squash`**.
   Neem de actuele main-SHA als nieuwe `BASE` en bereken de cijfers opnieuw voor precies één extra
   squashcommit volgens stappen 2–5. Wacht opnieuw op groene PR-/main-CI en toets de echte main-commit.
   Tag uitsluitend de laatste groene main.

## Website

Onderzoek op 2026-10-22, website-main `3ccd04e248f8cb4bd1fb475f06822efd714586b0`.
Lees bij uitvoering de actuele website-instructies (`CLAUDE.md`) en controleer de paden opnieuw.
Mandaat: precies twee blokken; geen algemene productpagina-redactie.

### Wat waar staat

- Nederlands highlight-blok: `open-planner-studio/index.html`, `<section id="whats-new">`
  (het attribuut staat tussen andere attributen). Tekstsleutels: `whatsnew.label`, `.title`,
  `.desc`, `.items.*`. Behoud de CTA's en bestaande structuur.
- Engelse copy: `shared/translations/open-planner-studio.json`, object `whatsnew`.
  Frans, Turks en **Spaans**: `open-planner-studio.fr.json`, `.tr.json`, `.es.json` in dezelfde map.
  Werk dezelfde sleutels bij. Laat alle andere objecten, zoals `download`, `f`, `faq` en `meta`, staan.
- Statische taalpagina's: `{en,fr,tr,es}/open-planner-studio/index.html`.
  Die dragen `meta[name="i18n-static"]`; alleen woordenboeken wijzigen werkt daar niet.
- Releaseblok onderaan: `#releases` met
  `<div data-release-notes="open-planner-studio" data-release-notes-timeline>`.
  De inhoud tussen `<!-- rn:start ... -->` en `<!-- rn:end -->` is gegenereerd, nooit handmatig.
- Bronnen: `data/release-notes/open-planner-studio.json` (GitHub-releases + nieuwste Engelse
  `docs/CHANGELOG.md`-sectie) en `data/release-highlights/open-planner-studio.json`
  (de live `https://open-planner-studio.open-aec.com/release-highlights.json`).

De dagelijkse `.github/workflows/update-stats.yml` draait om **06:00 UTC** vanzelf:
`generate-release-notes.js` → `generate-release-highlights.js` → `build-release-notes-static.js`.
Daarmee komt de nieuwe release automatisch in het blok onderaan, nieuwste eerst.
De dagelijkse run wijzigt ook andere gegenereerde gegevens, waaronder JSON-LD `softwareVersion`.
Het highlight-blok `#whats-new` en zijn woordenboeken komen **niet** vanzelf mee.

### Uitvoering na publicatie

1. Wacht op de geslaagde webdeploy van de releasecommit en controleer dat de live highlights-JSON
   `v$VERSION` bevat. `generate-release-highlights.js` kan exit 0 geven terwijl oude data blijft staan.
2. Maak een eigen websitebranch vanaf actuele `origin/main`. Werk alleen `#whats-new` bij met de
   nieuwe functies/fixes van deze release, uit dezelfde releasehistorie. Verzin geen functies.
   Zet de versie in `whatsnew.label` en vertaal de aangepaste tekst in alle vier woordenboeken.
   Bij een release met uitsluitend fixes benoemt het blok die verbeteringen.
3. Genereer in een **aparte tijdelijke kopie** van de bijgewerkte websitecheckout:
   ```bash
   printf '%s\n' '{"type":"commonjs"}' > package.json # Alleen in de root van de tijdelijke websitekopie; nooit meenemen in de website-PR.
   node scripts/generate-release-notes.js
   node scripts/generate-release-highlights.js
   node scripts/build-i18n-pages.js
   node scripts/build-release-notes-static.js
   ```
   Deze scripts hebben geen productfilter en schrijven ook andere pagina's en metadata.
   Neem uit die tijdelijke kopie uitsluitend de twee Planner-JSON-bronnen en de twee toegestane
   HTML-blokken over naar de vijf Planner-pagina's van de branch: `#whats-new` en `rn:start`–`rn:end`.
   Controleer dat `latestStable.tag` en de highlights beide de nieuwe versie bevatten.
   Behoud de eerdere releases in de gegenereerde tijdlijn.
4. De diff mag alleen die twee blokken, de twee Planner-databestanden en de `whatsnew`-objecten
   bevatten. Geen feature-grid, FAQ, meta-teksten, JSON-LD, screenshots, nieuws, `/md/` of `llms.txt`.
   Laat de dagelijkse Action zijn overige bestaande werk doen.
5. Commit, push de websitebranch, open een PR tegen `main` en registreer die bij de T3-thread.
   Merge direct: `gh pr merge <nr> --repo OpenAEC-Foundation/website --merge --admin`.
   Nozzit heeft een bypass in `required_pull_request_reviews.bypass_pull_request_allowances.users`
   (gecontroleerd via `gh api repos/OpenAEC-Foundation/website/branches/main/protection`).
6. Lees `mergeCommit.oid` uit `gh pr view <nr> --repo OpenAEC-Foundation/website --json mergeCommit`.
   Volg [Websitedeploy controleren en herstellen](#websitedeploy-controleren-en-herstellen), ook bij hervatten.

Besluit: orkestrator na vraag aan eigenaar, gesprek 2026-10-22. De website heeft en behoeft
geen PR-checks of websitecheckers. Generatoren, diffcontrole en de geslaagde `deploy.yml`-run
(push naar main of `workflow_dispatch`) plus beide juiste blokken live zijn voldoende bewijs.
De overige workflows zijn `update-stats.yml` (06:00 UTC) en `auto-assign-issues.yml`.
Deze procedure voegt geen workflow of checkeis aan het website-repo toe.

### Websitedeploy controleren en herstellen

De website gebruikt `cancel-in-progress: true`. Een nieuwere push kan de oorspronkelijke deploy
annuleren; soms ontbreekt die run geheel. De merge-SHA blijft de inhoudsbasis. Ook een afstammeling kan voldoen.

1. Zoek eerst `gh run list --repo OpenAEC-Foundation/website --workflow deploy.yml --event push
   --branch main --commit <merge-SHA>`. Lees ook nieuwere `deploy.yml`-runs op main, met event
   `push` of `workflow_dispatch`. Wacht binnen de deadline op een lopende toepasselijke run;
   start geen tweede zolang die loopt. Auth-/netwerkfouten zijn geen bewijs van een ontbrekende run.
2. Bewijs vereist `conclusion=success` én beide juiste releaseblokken live (`#whats-new` en de tijdlijn).
   Een geslaagde run op de merge-SHA telt. Een geslaagde run op een afstammeling telt ook:
   fetch de actuele websitehistorie en controleer `git merge-base --is-ancestor <merge-SHA> <deploy-SHA>`
   in de websitecheckout (exit 0). Noteer beide SHA's en het voorouderbewijs. Een oudere of niet-verwante
   groene deploy, alleen live inhoud of alleen de dagelijkse stats-run volstaat niet.
3. Ontbreekt dit bewijs na een ontbrekende, geannuleerde of mislukte run, en loopt er geen
   toepasselijke deploy: start binnen het zaterdagmandaat eenmaal per job
   `gh workflow run deploy.yml --repo OpenAEC-Foundation/website`.
   Noteer dispatchtijd en de actuele main-SHA. Zoek de bijbehorende `workflow_dispatch`-run,
   wacht binnen de deadline en toets zijn SHA, conclusie en liveblokken volgens stap 2.
   Dit is het herstelpad zonder bruikbaar run-ID; maak geen dubbele website-PR.
4. Noteer website-PR, merge-SHA, deploy-SHA, run-ID/URL, conclusie en livecontrole in het hervatverslag.
   Blijft de deploy rood, ontbreekt bevestiging of verstrijkt de deadline: laat de app-release staan,
   meld de fout in het eindrapport en bewaar het websitewerk. **Dit blokkeert de volgende app-release niet.**
   Probeer het de volgende zaterdag opnieuw naast de nieuwe release en draag open werk over in diens verslag.

## Uitlevering controleren

Bij historisch hervatten vervallen alleen workflowcontroles die het hervatpad aantoonbaar als
“niet van toepassing” heeft vastgelegd. De overige controles blijven verplicht.

- Volg `release.yml`, `snap.yml` en `aur.yml` tot hun eindstatus; koppel run aan tag/SHA.
- Vergelijk `gh release view "v$VERSION" --json body,assets` met de vorige release:
  alle platforminstallers, updaterarchieven, `.sig`-bestanden, `latest.json` en de Claude Desktop-bundel
  `open-planner-studio-<versie>.mcpb` (job `build-mcpb`) moeten aanwezig zijn.
- Download `latest.json` van **deze tag** naar een eigen tijdelijke map met `gh release download`.
  Controleer versie, niet-lege platte notes en alle platform-URL's (HTTP 200).
  Controleer daarnaast het publieke updater-endpoint; houd rekening met kortdurende CDN-cache.
- De GitHub-body bevat de bullets en Downloads. Dezelfde bullets staan als platte tekst in notes.
- Controleer in `snap.yml` de stap **Publish to Snap Store**: conclusie `success`.
  Alleen een bijgevoegde `.snap` bewijst geen publicatie. Ontbrekende credentials betekenen een
  onvolledige release; meld dit zonder secrets op te vragen of te wijzigen.
- Controleer ook `aur.yml`, stap **Push to AUR**: `success`; een groen pakket zonder publicatie
  is geen afgeronde AUR-uitlevering. Controleer de gepubliceerde `pkgver` voor deze versie.
- Een `latest.json` met ontbrekende darwin-entry kan duiden op een ontbrekend macOS `app`-target.
  Windows-updaterarchief en `.sig` moeten ná Azure-signing opnieuw zijn gemaakt door de workflow.
- Bij een afwijking: rapporteer het bewijs. Verplaats nooit de tag en wijzig assets niet op goed geluk.
