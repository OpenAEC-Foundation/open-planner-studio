# Browsershards op gemeten duur, niet met Playwrights `--shard`

CI verdeelt de browserspecs over de shards met `scripts/browser-shards.mjs` (`--duration-shard=k/n` in
`scripts/run-browser-tests.mjs`), niet met Playwrights eigen `--shard=k/n`. Playwright verdeelt naar aantal tests
(`filterForShard` in `playwright/lib/runner`); met `fullyParallel: false` blijven testgroepen bij elkaar, dus de
aantallen kunnen uiteenlopen. Hoe lang een test duurt, telt niet mee; specs met weinig maar lange tests komen zo samen in één shard, en die shard bepaalt hoe lang
de run duurt. Daarom krijgt elke spec een duur uit `tests/browser/spec-durations.json` en gaat steeds de langste
spec naar de shard met de minste tijd (`assignShards`).

## Gevolgen

De duren bepalen alleen de balans, niet de dekking: een spec zonder meting krijgt de mediaan, en
`tests/dev-server/browser-shards.test.mjs` eist dat de shards samen precies de specs zijn die Playwright vindt.
`--update` ververst de duren uit de joblogs van een groene run en corrigeert per log voor de snelheid van de
runner (`mergeJobDurations`).
