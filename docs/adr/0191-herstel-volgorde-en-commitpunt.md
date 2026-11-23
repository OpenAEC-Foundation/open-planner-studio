# Herstel: acties na elkaar en het manifest als commitpunt

Een crash kan midden in een herstelronde vallen, en een herstelronde kan samenvallen met het wissen bij een schone
afsluiting. Alle schrijf- en wisacties van het herstel (`saveRecovery`, `clearRecovery`, `clearOwnRecovery` en
`holdRecoveryForLater`) lopen daarom via één keten, `serializeRecoveryWrite` in `recoveryStore.ts`, strikt na elkaar; een
mislukte actie breekt de keten niet. Zonder die keten kon een ronde die al liep toen het wissen bij de schone afsluiting
begon, na dat wissen nog snapshots en een manifest schrijven, en bood de volgende start herstel aan na een normale
afsluiting. `loadRecovery` leest buiten de keten.

Op de desktop is de rename van het manifest het commitpunt van een ronde. De volgorde in `saveTauri` (eerst ontbrekende
archiefblobs, dan nieuwe snapshotgeneraties, dan het manifest, dan pas opruimen, elke stap via temp en rename) staat in
`docs/xer-recovery-guardrails.md`. Temp en rename (`writeTextFileAtomic`, `writeBytesFileAtomic`) omdat een gewone
schrijfactie bij een crash een afgekapte snapshot achterlaat, precies wat herstel moet opvangen (bevinding K4 in
`docs/onderhoudbaarheid/README.md`).

## Gevolgen

- Heeft een document geen snapshot in het vorige manifest en ook geen upsert, dan weigert `planTauriV3RecoverySave` de
  hele ronde vóór er een bestand geschreven wordt. Een manifest dat naar ontbrekende inhoud wijst, is slechter dan geen nieuwe
  commit.
- De bescherming van een herstelde snapshot die deze ronde vervangt (`replaced`, ADR 0190) vervalt pas na de rename van
  het manifest. Mislukt die, dan blijven het oude manifest, de oude snapshot en zijn bescherming staan
  (`check-recovery-web-hold.ts`, deel 3 van de desktop: "oude manifest blijft intact bij commitfout").
- `clearOwnTauri` herschrijft eerst het manifest en haalt pas daarna de eigen snapshots weg.
- `fullRecoverySave` maakt van elk document een upsert. Productiecode gebruikt het niet; alleen tests doen dat. In een
  gewone ronde zou het alle snapshots herschrijven, tegen de grens in de gids dat één inhoudsbewerking precies één
  upsert levert.
