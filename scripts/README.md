# `scripts/`

Alles wat buiten de app draait: de dev-server-poortverdeling, de generatoren, de verify-poorten en
de release-hulpjes. Deze map had geen overzicht, waardoor niet te zien was wat er nog gebruikt werd
en wat een eenmalige klus was — dit bestand is dat overzicht (K-item 40).

**Regel:** wat hier staat, wordt aangeroepen. Blijft er iets over dat één keer gedraaid heeft en zijn
werk gedaan heeft, dan hoort het weg en niet "voor het geval dat" te blijven staan. Bij het schrijven
van dit bestand gold dat voor `i18n-apply-wave6.mjs` + `i18n-translations-wave6.mjs` (646 regels,
eenmalige vertaalgolf, nergens aangeroepen); die zijn verwijderd. De git-historie bewaart ze.

## Dev-server en poortverdeling

Deze vier horen bij elkaar en dragen de multi-worktree-isolatie: elk worktree krijgt een eigen vaste
poort, en een tweede start in hetzelfde worktree wordt geweigerd in plaats van stilletjes een andere
poort te pakken. Zie de kop van `CLAUDE.md` en `tests/dev-server/` voor het geheel.

| script | aangeroepen door | doet |
|---|---|---|
| `dev-server.mjs` | `npm run dev` | wijst de poort toe, claimt het guard-slot, stempelt `.claude/launch.json`, start dan pas Vite |
| `tauri-dev.mjs` | `npm run tauri:dev` | idem, plus `tauri dev` met een matchende `--config`-devUrl en `OPS_DEV_*` in de env |
| `dev-port.mjs` | de twee hierboven | poorttoewijzing verankerd aan de worktree-root (3007–3106) |
| `dev-lock.mjs` | de drie hierboven | flock-gebaseerd guard-slot tegen dubbelstart |
| `dev-bootstrap.mjs` | een Claude Code SessionStart-hook (staat in `.claude/`, niet in de repo) | stempelt bij het openen van een sessie alvast de poort van dít worktree in `.claude/launch.json`. Zelf-scopend (no-op in een ander project), idempotent, faalt zacht |

## Poorten (draaien mee in `npm run verify`)

| script | npm-script | doet |
|---|---|---|
| `i18n-diff.mjs` | `verify:i18n` | ontbrekende vertaalsleutels t.o.v. `nl`, met CLDR-pluralcategorieën |
| `verify-cycles.mjs` | `verify:cycles` | circulaire imports binnen `src/`, gemeten op de esbuild-metafile (dus ná type-erasure — `import type` geeft geen valse treffers) |
| `verify-docs.ts` | `verify:docs` | de in-app gidsen in `public/docs/`: manifest-dekking, weesbestanden, `docs://`/`examples://`-links, en of de inhoud binnen de mini-Markdown-subset blijft |
| `verify-examples.ts` | `verify:examples` | de gebundelde voorbeeldprojecten laden en rekenen door zoals verwacht |

## Voorbeeldprojecten genereren

`npm run gen:examples` → `generate-examples.ts`. De rest is de generator eronder en wordt niet los
aangeroepen:

- `gen-core.ts` — de generator zelf
- `spec.ts` — de gedeelde vorm waar alle generatoren op leunen
- `showcases.ts` / `showcase-groot.ts` — de projectdefinities
- `example-resources.ts` — de resourcepool
- `example-topologies.json` — de relatienetwerken (117 kB data, geen code)

## Release en publicatie

| script | aangeroepen door | doet |
|---|---|---|
| `bump-version.js` | `npm run bump X.Y.Z` | CalVer synchroon zetten in `package.json`, `tauri.conf.json` en de lockfile (`Cargo.toml` blijft bewust `0.1.0`) |
| `release-notes.mjs` | `.github/workflows/release.yml` (twee plekken) | `docs/release-notes/v<versie>.md` → `--format=body` voor de GitHub-releasepagina, `--format=notes` (platte tekst) voor het `notes`-veld in `latest.json` |
| `release-highlights.mjs` | `npm run verify:release-highlights` | start de getypeerde releasehighlight-verifier: eist één volledig versieblok met 14 locales, één primary en vier secondary-kaarten zonder gidslink, veilige pictogrammen en reproduceerbare Git-cijfers; docs, vertalingen, lock-, gegenereerde en vendorbestanden tellen niet mee |
| `verify-package-docs.mjs` | `.github/workflows/snap.yml`, direct na de Snap-build | leest de executable uit de zojuist gebouwde Snap en eist dat het manifest plus de aanwezige Help-artikelen uit `public/docs/` als Tauri-assets zijn ingesloten, vóór upload of Store-publicatie |
| `publish-wiki.mjs` | `npm run publish:wiki` | genereert de GitHub-wiki uit `public/docs/en`, `docs/wiki/*` en de changelog. De wiki is een build-artefact — nooit met de hand bewerken |
| `download-stats.mjs` | `npm run stats:downloads` en `.github/workflows/download-stats.yml` (wekelijks + op verzoek) | downloadcijfers per besturingssysteem uit de `download_count` per release-asset van de GitHub Releases-API — tekst, markdown of JSON. Let op: Linux is install+update samen (de updater haalt hetzelfde `.deb`/`.rpm`/`.AppImage` op), de Snap Store zit er niet in, `.sig`-bestanden tellen niet mee. Unit-test: `tests/dev-server/download-stats.test.mjs` |

## Overig

- `run-ts.mjs` — de TypeScript-runner waarmee de `.ts`-scripts hierboven draaien (esbuild → Node).
  Alle `node scripts/run-ts.mjs scripts/x.ts`-aanroepen in `package.json` gaan hierlangs.
- `generate-icon.mjs` — genereert het app-icoon uit code. **Draait niet zonder extra installatie:**
  hij importeert `sharp`, en dat staat bewust niet in `package.json` (het is een zware native
  dependency voor een handeling die je hooguit bij een rebranding doet). Wil je hem draaien:
  `npm i --no-save sharp` en dan `node scripts/generate-icon.mjs`.
