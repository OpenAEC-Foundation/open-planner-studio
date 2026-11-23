# Release-details

Lees het passende onderdeel tijdens de release. Dit bestand geeft geen zelfstandig publicatiemandaat.

## Node-uitzondering voor de maandagjob

**Besluit 9: eigenaar, verduidelijkt door de orkestrator op 2026-10-23.** Lichte release-scripts
mogen op de server; de bedoeling is overbelasting voorkomen, niet de release blokkeren.
Dit is de vaste, smalle uitzondering op de
[Server restriction in AGENTS.md](../../../AGENTS.md), aangehaald in [SKILL.md](SKILL.md).
Alleen de geplande wekelijkse releasejob op aia09-mp50 mag onderstaande Node-stappen uitvoeren.
Zijn Haiku-vertaalstations mogen hun eigen pakketchecks uitvoeren binnen dezelfde job en worktree.
Onderhoud aan de skill, losse releases, CI-fixagents en agents voor codereview krijgen geen uitzondering.

Alleen in de eigen worktrees van de job onder `.claude/worktrees/`. Geen Node in de hoofdcheckout of een CI-fixworktree.
De volledige lijst:

- `node scripts/release/run.mjs` (ook `--droog`) vanuit `release-script`, een losse worktree op `origin/main`.
  Het script gebruikt alleen ingebouwde modules; daar geen `npm ci`. Het draait zelf
  `node scripts/release-ci-check.mjs "$SHA"` en met `--browser`, vanuit dezelfde worktree.
- In `release-werk` (de releasebranch, daarna los op de releasecommit), door het script:
  eenmaal per run `npm ci`; `npm run bump`; `node scripts/bump-version.js --check "$VERSION"`;
  `node scripts/release-notes.mjs "v$VERSION" --format=body` en `--format=notes`;
  `npm run gen:release-highlights-json`, `npm run verify:release-highlights -- "$VERSION"` en
  `npm run verify:release-highlights-json`; `npm run verify:translations`; `npm run verify:docs`;
  `npm run publish:wiki` (proef) en `node scripts/run-ts.mjs scripts/check-wiki-links.ts`.
- In `release-wiki` (alleen als de wiki van een tag nog niet gepubliceerd is, op de getagde commit):
  eenmaal per run `npm ci`, `npm run publish:wiki` met en zonder `-- --push`, en de linkcheck.
- In `release-website-generatie` (een tijdelijke kopie van de websitebranch, alleen daar):
  `node scripts/generate-release-notes.js`, `node scripts/generate-release-highlights.js`,
  `node scripts/build-i18n-pages.js` en `node scripts/build-release-notes-static.js`.
- In `release-werk`, door de thread bij de taak `vertalen` ([update-ui-lang](../update-ui-lang/SKILL.md)):
  `node -p 'process.execPath'`; `npm run translate -- prepare ui <taal> --missing`, `--stale` of `--avoid`;
  `npm run translate -- apply ui <taal>`, `npm run translate -- packages ui <talen> [--red]`,
  `npm run translate -- status [taal] [--strict]`, `npm run translate -- terms-lookup <taal>` en
  `npm run translate -- apply-terms <taal>`; `node build/translate/check.mjs <pakket>` bij de ouder én zijn
  Haiku-stations; `npm run i18n:add -- ...`, `npm run i18n:fmt`, `npm run i18n:resolve`, `npm run verify:i18n`
  en `npm run verify:translations`.

De tekstagent (`claude -p`) draait geen Node; hij mag alleen lezen, de tekstbestanden schrijven en `git log`,
`git show` en `git diff` draaien. Interne helperprocessen van deze opdrachten horen bij die stap; dit staat geen
andere losse Node-opdracht toe. Tests (`npm test`, alle suites en browsertests), app-builds (`npm run build`,
`tauri:*`), de volledige `npm run verify` en dev-servers blijven hier verboden. Ook geen andere installatie of `npx`.
De verplichte volledige verify vóór de tag komt uit `ci.yml`: de pushrun op de exacte main-SHA
plus de laatste browserrun op main. De `gate` van `release.yml` draait geen verify en leest alleen
of die runs groen zijn, met dezelfde regels als het script. Gerichte tests en foutreproducties horen in PR-CI.

### Grenzen bij aangeroepen skills

De [wiki-skill](../wiki/SKILL.md) vraagt alleen Node-stappen uit de lijst hierboven.
Ook de lichte stappen uit [update-ui-lang](../update-ui-lang/SKILL.md) vallen binnen de lijst,
inclusief pakketselectie, pakketchecks, i18n-onderhoud en termbaseherstel.
Gebruik `release-werk` en zijn eenmaal geïnstalleerde dependencies. Sla de losse
werkplekinrichting van `update-ui-lang` over; geen extra worktree, installatie of `node_modules`-link.
Geef elk T3-Haiku-station expliciet het maandagmandaat, de worktree `release-werk` en toestemming voor
zijn eigen `build/translate/check.mjs`-pakketcheck uit deze lijst mee. Dit geldt voor vertalen,
nalezen en herstellen, uitsluitend binnen deze maandagjob. De stations installeren niets.
Behoud de bestaande pakketpoorten en wacht op alle vereiste stations vóór `apply ui`.

## Node-uitzondering voor de nachttaak

**Besluit Ethan, 2026-11-16 (vertalingen elke nacht), dat besluit 9 uitbreidt.** De geplande nachttaak
op aia09-mp50 ([nachtvertalingen](../nachtvertalingen/SKILL.md)) mag dezelfde lichte stappen draaien als
de maandagjob, beperkt tot de vertaling, uitsluitend in zijn eigen nachtworktree:

- Eenmaal per run `npm ci` in de nachtworktree, en `node -p 'process.execPath'` voor het Node-pad.
- `npm run translate -- settled --out <bestand>`, `npm run translate -- night-guard <BASE>`,
  `npm run translate -- prepare ui <taal> --open --only <bestand>`, `npm run translate -- apply ui <taal>`,
  `npm run translate -- packages ui <talen> [--red|--bundle <tekens>]` en `npm run translate -- status [taal]`.
- `node build/translate/check.mjs <pakket>` bij de ouder én zijn Haiku-stations, in dezelfde worktree.
- `npm run verify:i18n`.

Verder niets: geen tests, builds, volledige verify, dev-servers, andere installaties of `npx`. De CI van de
PR draait de rest.

## Hervatten

Het script doet dit bij elke start, vóór “niets veranderd” en vóór de bump (`lever` in `scripts/release/stappen.mjs`).
Het neemt de numeriek nieuwste stabiele origin-tag, ook als zijn release ontbreekt of draft is.
Een incomplete app-uitlevering wordt nooit stil als vorige voltooide release gebruikt.

**Afschrijving eerst.** De vaste regel staat in de body van de gemergde PR `Release v<VERSION>`:
`Afgeschreven tag: v<VERSION>`. Alleen een volledige, exacte regel voor deze tag telt; een leesfout stopt.
Een afgeschreven tag krijgt geen rerun, dispatch, publicatie, wiki of website meer; hij blijft `PREV` en de
opvolger neemt zijn tekst over ([Herstel na de tag](#herstel-na-de-tag)).

Anders controleert het script, in deze volgorde, en stopt het bij elke onbekende toestand:

1. **Release.** De `release.yml`-run op de tag (event `push` of een dispatch op de tag). Ontbreken run én
   release: eenmaal `gh workflow run release.yml --ref "$TAG" -f "version=$TAG"`. Bestaat er wel een release of
   draft zonder run: stop. Rood: eenmaal `gh run rerun <id> --failed`, nooit een hele rerun (na een geslaagde
   `create-release` zou die een tweede draft maken). Daarna moet de release gepubliceerd zijn
   (`draft=false`, `prerelease=false`, `published_at`). Alleen HTTP 404 telt als ontbrekend.
2. **Vervolgworkflows.** `release-verify.yml` en `snap.yml` via `workflow_run`. Zo'n run staat op de
   SHA van main op dat moment, niet op de tag. Het script neemt de oudste niet-overgeslagen run sinds de start van
   de release-run en volgt of herhaalt hem pas als een gedraaide job de tag logt (`HEAD_BRANCH: <tag>`); anders is het een stop.
   Snap telt met de stap `Publish to Snap Store` op `success`, of met de bewezen
   [verlopen Store-login](#verlopen-snap-store-login); een ontbrekende Snap-run is een stop
   (een dispatch publiceert niet).
3. **Uitlevering.** Zie [Uitlevering controleren](#uitlevering-controleren).
4. **Wiki.** Af als de wiki-pagina Changelog de sectie `## v<VERSION> ` heeft. Anders publiceert het script
   vanaf de getagde commit (proef zonder waarschuwingen, linkcheck, `-- --push`) en controleert het de pagina en Home.
5. **Website.** Pas aan het eind, en alleen als er geen nieuwe release komt: de website van een nieuwe tag dekt ook
   de vorige. Zie [Website](#website).

**Hervatverslag.** Eén reactie met `<!-- ops-release:TAG -->` op de PR `Release v<VERSION>`, door het script
geschreven vóór de tag en na elke stap. Het script schrijft alleen tussen `<!-- ops-release-script:begin -->` en
`<!-- ops-release-script:end -->` en vult daar zijn regels aan; wat erbuiten staat (een ouder verslag, notities van
de thread) laat het staan. Het script leest de
stand niet uit het verslag maar uit GitHub, dus ook een verslag dat “klaar” zegt, wordt gecontroleerd. De thread
zet fix-PR's, reruns, review-taak-ID's en BLOKKEERT/VERVOLG eronder, buiten het scriptblok, als hij een stop herstelt.

### Verlopen Snap Store-login

Besluit wrakko, 2026-11-17 (na de verlopen login bij v2026.47.0). Faalt de Snap-publicatie op de bekende fout van een
verlopen Store-login, dan houdt dat de release niet tegen, voor de vorige en voor de nieuwe tag. Het script controleert dat vast (`snapLoginVerlopen`): de run is
`failure`, de enige rode stap is `Publish to Snap Store`, en de joblog bevat
`credentials are no longer valid for the Snap Store`. Dan geen rerun; het script zet het in het verslag en schrijft
`RELEASE-MELDING snap-login: …` met de link, die de thread aan wrakko doorgeeft. Ethan herstelt de login; daarna
herstart alleen wrakko de Snap-publicatie. Elke andere Snap-fout blijft een stop (`snap-mislukt`).

## Kandidaatselectie

Het script doet dit vóór iedere bump (`kiesKandidaat` in `scripts/release/stappen.mjs`). Alleen PR's met precies de
titel `Release v<versie>` tellen. Een ongetagde versie op main of een open release-PR is alleen hervatbaar als hij
numeriek hoger is dan `PREV` (jaar, week, volgnummer als getallen); de kalenderweek van vandaag is geen ondergrens.

- **Open release-PR:** de bestaande branch, versie en voortgang; geen tweede PR, geen bump, geen dubbel blok.
  Het script merget actuele main erin en vernieuwt cijfers en CI.
- **Ongetagde versie op main met een gemergde release-PR:** direct naar de poorten vóór de tag. Ontbreekt inhoud,
  dan is dat een stop (`inhoud-ontbreekt`); de thread vult haar aan via een correctie-PR voor dezelfde versie.
- **Geen van beide:** `npm run bump`, en alleen als er commits zijn sinds `PREV`.

Stop zonder bump of tag bij: twee open release-PR's, een titel die niet bij de pakketversie past, een al getagde
PR-versie, een kandidaat die niet hoger is dan `PREV`, of botsende kandidaatversies. Een bestaande ongetagde
opvolger krijgt nooit een extra bump, ook niet na een weekwissel.

## CI herstellen

Besluit 8: eigenaar, gesprek 2026-10-22. Dit geldt voor rode main-CI, release-PR-CI en releaseworkflows
na de tag. Een rode browserrun volgt de skill `browsertests-repareren`. Een rode poort blijft blokkeren; de job repareert de oorzaak zelf.

### Geen eindtijd en voortgang

De maandagjob start op maandag om 07:00 Europe/Amsterdam en heeft geen eindtijd (besluit Ethan, 2026-11-09). Hij gaat door
tot hij af is, ook 's avonds, en vraagt geen toestemming om door te gaan. Alleen een echte blokkade stopt hem:
een BLOKKEERT, een rode CI die je niet zelf kunt repareren, of een vaste regel. De weekendstop (zaterdag 23:00
tot maandag 01:00) en zondag blijven gelden.
Gebruik de lokale datum/tijd met de IANA-tijdzone Europe/Amsterdam; geen vaste UTC-offset (zomer-/wintertijd).
Wacht begrensd op runs en reviewtaken; meld een taak die vastzit als blokkade.
Bij een blokkade: geen nieuwe mutaties; bewaar de actuele status en rapporteer de precieze oorzaak.
Nog geen nieuwe tag: die week geen tag meer. Een open fix-PR blijft staan. Al getagd: niets terugdraaien.
De volgende maandag hervat de bestaande voortgang: dezelfde tag tenzij afgeschreven, dan zijn
fix/opvolger. Een al ongetagde opvolgversie behoudt zijn nummer, ook na een weekwissel.

Leg run-ID/attempt, rerunpoging, foutbewijs, fix-PR/branch/head, review-taak-ID's en resterend werk
vast in het hervatverslag. Vóór een release-PR bestaat, staat dit in de fix-PR; verwijs er later naar.
Zoek bij de volgende start eerst die open fix-PR voor dezelfde fout. Hervat die branch en review;
maak geen dubbele PR. Een al verbruikte rerunpoging begint na een weekwissel niet opnieuw.

### Rerun, kleinste fix, merge

1. Lees de rode jobs en logs van de **exacte** main-/PR-head of getagde run:
   `gh run view <run-id> --json jobs` en `gh run view <run-id> --log-failed`.
   Het script draait de mislukte checks eerst zelf eenmaal opnieuw (`gh run rerun <run-id> --failed`) en stopt
   pas als ook poging 2 rood is; een tweede rerun is er niet. Alleen buiten het script: eenmaal zelf rerunnen.
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
   merge-SHA; het script controleert daarna ook de browserrun. Is main verder gegaan, controleer de nieuwste main-SHA; een oudere groene run volstaat niet.
5. Start daarna het script opnieuw. Bij een rode release-PR merget het main in de bestaande releasebranch,
   behoudt de kandidaatversie en vernieuwt de cijfers; bij een conflict stopt het (`merge-conflict`). Ook een fout die alleen in de kandidaat
   optreedt moet in PR-CI op die kandidaat gereproduceerd en na de fix opnieuw getest worden.
   Wacht opnieuw op groene release-PR-CI en main-CI. Geen tweede bump.
   Een lokale releasepoort krijgt dezelfde kleinste fix en review; zonder run valt alleen de rerun weg.

### Tweede Sol-review via T3

Lees op aia09-mp50 **`~/.claude/agents/reviewer.md`**. Neem de volledige body vanaf
`# Hyperkritische review` **letterlijk** op in `task`. Daarmee staan de houding, bewijslast en
rapportvorm in de brief zelf. Alleen naar het bestand verwijzen is onvoldoende.
De YAML-keuze voor Opus neem je niet over. Lees `orchestrator_capabilities` en kies provider
`codex`, model `gpt-6.2-sol`, met `target.options.reasoningEffort="xhigh"`.
Ontbreekt het bestand, model of de optie: bewaar de fix-PR en meld de exacte blokkade.

Gebruik een nieuwe T3 `delegate_task` per reviewronde:
```json
{
  "target": {"providerInstanceId":"codex","model":"gpt-6.2-sol","options":{"reasoningEffort":"xhigh"}},
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
Een timeout laat de child doorlopen: lees `task_status(taskId)`, start geen duplicaat.
Gebruik `childThreadId` nooit als vervolgronde. Elke nieuwe ronde krijgt een nieuwe `delegate_task`
met de oorspronkelijke brief én eerdere bevindingen/antwoorden; een retry van dezelfde aanvraag
houdt dezelfde `clientRequestId`. Bij een blokkade of onderbreking: leg een nog actieve taak vast en hervat die eerst.

### Herstel na de tag

Ook een rode `release.yml` begint met één `--failed`-rerun en daarna een fix-PR met bovenstaande review.
Een main-fix verandert de getagde broncode of workflow niet; een rerun gebruikt de oude SHA/workflow.
Is uitsluitend een externe oorzaak weggenomen, hervat dan gericht de mislukte jobs van de bestaande
run. Bewaar het bewijs; herhaal niet ongewijzigd als die weer faalt. Nooit een volledige rerun na
geslaagde `create-release` of een dispatch op main om de getagde gate te omzeilen.

Stopt de `gate` bij **Check CI and browser run**, lees dan de `::error::`-regels. Is de reden weg, draai dan
de gate opnieuw met `gh run rerun <run-id> --failed`. Browserrun afgewezen: volg de skill
`browsertests-repareren` en geef haar de regel `BROWSERRUN=<id>` uit de log door. Staat main nog op de getagde commit,
dan telt zijn bewijsrun voor de tag.
Staat main verder, dan is de nieuwe run geen voorouder van de tag en stopt de gate weer: schrijf de tag af volgens
punt 2 hieronder en maak een opvolgversie. Verander de gate niet om een tag door te laten.

**Besluit orkestrator, 2026-10-22:** heeft de tag gewijzigde broncode of workflow nodig, dan geldt:

1. Repareer de oorzaak via de fix-PR-route op main: rerun → kleinste fix-PR → tweede Sol-review →
   groene PR-CI → merge → groene CI op de exacte main-SHA. Behoud de fix-PR bij een blokkade.
2. Schrijf de mislukte tag af. Zet in de body van zijn gemergde release-PR een eigen, vaste regel:
   ```text
   Afgeschreven tag: v2026.43.0
   ```
   Vul de echte tag in. Noteer eronder reden, fout/run-URL, fix-PR en later de opvolger-PR/tag.
   Bewaar ook het bestaande hervatverslag. Er komt geen apart register of nieuwe release-status.
   Lees de opgeslagen body terug voordat je doorgaat. Een nog niet vastgelegde afschrijving is
   geen vrijbrief voor een nieuwe bump. Staat de fix bij een blokkade nog open, zet de afschrijfregel
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
   slaat geen enkele poort over. Bij een blokkade: stop en bewaar fix/opvolger in de PR's. De volgende
   maandag herkent de vaste regel de afschrijving en hervat dezelfde opvolger, zonder extra bump.

## Releasecijfers

`scripts/verify-release-highlights.ts` vergelijkt exact met Git, niet met afgeronde schattingen.
Een extra commit of een gewijzigde mergebasis verandert de cijfers. Plan daarom een squashmerge.
Het script rekent stappen 1–5 zelf (`meetCijfers`), met als verwachte squashcommitdatum het moment van rekenen
plus 30 minuten. Vlak vóór de merge rekent het opnieuw: is een dag omgesprongen of main verder, dan werkt het de
cijfers bij en wacht het opnieuw op PR-CI. Een verschil na de merge (stap 6) is de stop `cijfers`.

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

### Wat het script doet

Website-werk telt als af zodra `whatsnew.label` in het Engelse woordenboek op website-main deze versie (of een
nieuwere) noemt, de nieuwste `deploy.yml`-run op main (`push` of `workflow_dispatch`) `success` is op inhoud met
die versie, en de live pagina `https://open-aec.com/open-planner-studio/` die versie toont. Anders:

1. Wachten tot de live `release-highlights.json` de versie noemt.
2. Websitebranch `release/open-planner-studio-<tag>` in de map `.claude/worktrees/release-website` (een kloon, geen
   worktree). Bestaat er al een PR voor die branch, dan hergebruikt het script die.
3. Een websiteagent (`claude -p`, Opus 5.5 high) schrijft alleen het Nederlandse `#whats-new` in
   `open-planner-studio/index.html` en het object `whatsnew` in de vier woordenboeken, uit de releasetekst en de
   highlights. Verzonnen functies horen er niet in.
4. De vier generatoren draaien in de tijdelijke kopie `release-website-generatie` (met daar alleen een
   `package.json` `{"type":"commonjs"}`). Het script neemt uit die kopie alleen over: het `rn:start`–`rn:end`-blok
   in de vijf Planner-pagina's, `#whats-new` in de vier statische taalpagina's, en de twee Planner-databestanden.
   `latestStable.tag` en de highlights moeten de nieuwe versie noemen. Elk ander gewijzigd pad is een fout.
5. Commit, push, PR, direct `gh pr merge <nr> --repo OpenAEC-Foundation/website --merge --admin`.
6. Deploy: een geslaagde `deploy.yml` op de merge-SHA of een afstammeling (`compare` geeft `ahead` of `identical`),
   plus de live controle. Mislukt of geannuleerd: eenmaal `gh workflow run deploy.yml --repo OpenAEC-Foundation/website`
   als er na die run nog geen dispatch was; de volgende run van het script controleert het resultaat.

Besluit: orkestrator na vraag aan eigenaar, gesprek 2026-10-22. De website heeft en behoeft geen PR-checks of
websitecheckers; generatoren, diffcontrole, de geslaagde deploy en de live inhoud zijn genoeg. Nozzit heeft een
bypass op de branchbescherming van website-main. Een websitefout laat de app-release staan, blokkeert de volgende
app-release niet en staat in het verslag; de volgende maandag probeert het script het opnieuw.

## Uitlevering controleren

Het script controleert dit na elke groene release-run (`controleerAssets` in `scripts/release/stappen.mjs`).

- `release.yml`, `release-verify.yml` en `snap.yml` tot hun eindstatus, gekoppeld aan tag en SHA.
- Assets tegenover de vorige gepubliceerde release (namen met de versie vervangen): alle installers,
  updaterarchieven, `.sig`-bestanden, `latest.json` en de Claude Desktop-bundel `open-planner-studio-<versie>.mcpb`.
- `latest.json` van **deze tag** (`gh release download`): juiste versie, niet-lege notes, een entry voor linux,
  windows en darwin (een ontbrekende darwin-entry wijst op een ontbrekend macOS `app`-target), alle download-URL's HTTP 200.
  Is dit de nieuwste release, dan ook het publieke updater-adres, met 15 minuten ruimte voor de CDN.
- De GitHub-body heeft het Downloads-blok.
- Snap: stap **Publish to Snap Store** `success`; alleen een bijgevoegde `.snap` bewijst geen publicatie.
  Uitzondering: de bewezen [verlopen Store-login](#verlopen-snap-store-login), gemeld en niet gestopt. Vraag of wijzig
  geen secrets.
- Bij een afwijking: rapporteer het bewijs. Verplaats nooit de tag en wijzig assets niet op goed geluk.
