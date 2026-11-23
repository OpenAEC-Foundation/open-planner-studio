# Herstel op de desktop: lezen en terugval

Eén stuk JSON-bestand mag niet betekenen dat het werk in de snapshots als weg geldt (bevinding K4 in
`docs/onderhoudbaarheid/README.md`: een directory-scan als het manifest niet parst). `loadTauri` valt daarom terug op
een scan van de appDataDir als het manifest er staat maar niet te lezen is of geen JSON is. Een manifest dat wel JSON is
maar een onbekend of ongeldig contract heeft, krijgt die terugval niet: `parseRecoveryManifest` gooit dan
`RecoveryManifestError` (regel `settings-autosave`, de manifestleespoort).

De scan (`scanTauriSnapshots`) neemt alleen namen die `stableSnapshotDocId` als stabiele snapshot herkent, de vorm van
de manifestversies 1 en 2, en geen generatiesnapshots. Een generatiesnapshot van versie 3 of later die vóór de rename van
het manifest geschreven is, is nog niet vastgelegd (ADR 0191); zonder geldig manifest zou ze als half nieuwe herstelset
verschijnen (`check-recovery-isolation.ts`, 1w). Welke namen bij de eigen naambasis horen, bepaalt `recoveryNames` in
`recoveryPaths.ts`, met de uitzondering die daar bewust aanvaard is: voor de productiebuild is het oude losse
herstelbestand van een oude dev-build (`recovery.<slug>.ifc`) een stabiele snapshot met document-id `<slug>`, dus bij
een onleesbaar manifest kan de productiebuild zo'n bestand aanbieden.

## Gevolgen

- Een geldig manifest waarvan snapshots niet te lezen zijn, geeft die als `readFailures` terug en valt niet terug op de
  scan, ook als geen enkele snapshot te lezen was. Zo krijgt de planner eerst een herstelkeuze in plaats van een lege
  sessie waarin de auto-save verder schrijft (`check-recovery-web-hold.ts`, de proeven met I/O-fouten in het
  desktopdeel). Van de geldige manifesten valt alleen een manifest zonder regels terug op de scan.
- Vindt de scan niets, dan komt het oude losse bestand `<base>.ifc` aan de beurt (`legacyFile`), als één document.
- Staat er geen manifest, dan scant `loadTauri` niet; alleen het oude losse bestand telt.
- Een snapshot uit de scan heeft geen metadata: geen pad, `isDirty` waar en `datesAsRecorded` onwaar. Wat de scan
  vindt, heeft de vorm van versie 1 en 2, en zulke snapshots dragen hun XER-archief ingebed
  (`docs/xer-recovery-guardrails.md`); de scan geeft daarom geen archiefblobs terug.
