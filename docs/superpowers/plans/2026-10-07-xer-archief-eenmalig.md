# XER-bronarchief één keer schrijven in crashherstel

Het XER-bronarchief (de volledige oorspronkelijke `.xer`-bytes) ging tot nu toe mee in élke
crashherstel-snapshot. Bij een groot bestand kostte elke auto-save-ronde daardoor seconden en tientallen
megabytes. Na deze wijziging schrijft crashherstel het archief één keer apart weg; de snapshots wijzen er
alleen nog naar. Het echte opslaan als IFC verandert niet: het projectbestand draagt het archief volledig.

Bron: eigenaarsbesluit 2026-09-22, plan `2026-08-20-plan-xer-p6-lezer.md` punt (9): "Bronarchief één keer
schrijven, in het IFC, niet per crashherstel-snapshot." Herhaald bij de review van 2026-10-07. Het
open punt staat in `docs/TODO.md` ("XER: het bronarchief heeft geen bytegrens …").

## Probleem (gemeten op `main` vóór de wijziging)

`useAutoSave` serialiseerde elk gewijzigd document met `writeIFC(buildWriteIFCInput(source))`. Die
schrijft het archief als base64-chunks in de pset `OPS_XerSourceArchive` (schema 2, compact). Per
tick van een gewijzigd XER-document betekende dat: het hele archief opnieuw coderen in een IFC-tekst
en die tekst volledig wegschrijven. Op `rehab-2.xer` (18,6 MB bron): ±60 MB per tick, ±2,4 s
hoofdthread per tick (Node 22, deze machine). De webbackend las bovendien elke tick alle records
(`getAll`) terug, dus ook alle grote snapshots.

## Ontwerp

1. **Twee opslagvormen voor het archief in een IFC.** `writeIFC` krijgt
   `xerSourceArchiveStorage: 'embedded' | 'recovery-reference'` (standaard `embedded`). De
   referentievorm schrijft dezelfde pset `OPS_XerSourceArchive`, maar met `SchemaVersion 3`,
   `StorageFormat 'recovery-reference-v1'`, `ByteLength` en `Sha256` — zonder bytes. De selector
   `OPS_XerDocument` blijft ongewijzigd. Alleen crashherstel gebruikt de referentievorm; opslaan,
   Opslaan als, echte AutoSave, export en MCP blijven `embedded`. Daardoor verandert de round-trip
   van een projectbestand niet.
2. **Content-adressed archiefblob.** De sleutel is de SHA-256 van de bronbytes (die staat al in het
   archief: `archive.sha256`). Twaalf documenten uit één `.xer` delen dus één blob. De blob bevat de
   ruwe bronbytes (geen base64). Hij wordt alleen geschreven als hij nog niet bestaat; de bytes
   worden pas dán uit het in-memory archief gedecodeerd (`decodeXerSourceArchive`, lazy leverancier).
   Een tick met een bestaande blob raakt het archief dus niet aan: geen kopie, geen codering.
3. **Manifest draagt de verwijzing.** Elke manifestregel krijgt het optionele veld `xerArchive`
   (de sha256). Manifestversie wordt 5. Oudere manifesten (v1–v4) hebben het veld niet; hun
   snapshots dragen het archief ingebed en blijven zo leesbaar (beide vormen lezen, geen migratie).
4. **Backends.**
   - *Tauri* (`appDataDir`, via `plugin-fs` en `src/services/fileAccess/atomicWrite.ts`, geen Rust):
     bestand `<base>.xerarchive.<sha256>.bin`, atomair via temp + rename, geschreven vóór de
     snapshots en vóór de manifestcommit. Opruimen ná de commit: een blob die deze instantie schreef
     (of die het vorige eigen/legacy manifest noemde) en die het nieuwe manifest — inclusief de
     meegedragen regels van een vreemde eigenaar — niet meer noemt, verdwijnt. `clearRecovery`
     wist alle eigen bestanden van de base, blobs inbegrepen; de schone afsluiting
     (`planRecoveryExitClear`) wist alleen eigen blobs zonder verwijzing uit de bewaarde regels.
   - *Web* (IndexedDB `ops-recovery`): een tweede object-store `xer-archives` (databaseversie 2).
     Blob-put, snapshot-upserts, manifest en opruimen zitten in één `readwrite`-transactie over
     beide stores. Bestaan en opruimen gebruiken `getAllKeys()` op de archiefstore, dus de blob zelf
     wordt per tick niet gelezen. Een blob verdwijnt als geen enkel manifest in de database (alle
     tabs, alle vastgehouden generaties) hem nog noemt.
5. **Herstellen.** `loadRecovery` levert naast de snapshots een map `archives` (sha256 → bytes) voor
   alle verwijzingen uit het manifest. `useRecoveryRestore` geeft een resolver mee aan
   `readIFCWithXerReconstruction`. De reader controleert lengte en SHA-256 en reconstrueert daarna
   precies zoals bij de compacte vorm (`reconstructXerSourceFromBytes`). Ontbreekt de blob of klopt
   hij niet, dan opent het document zonder archief met het bestaande `xerArchiveIssue`
   (`bytes-missing`, `truncated` of `hash-mismatch`) — eigenaarsbesluit vraag 15, "openen met
   melding". Een referentiesnapshot die buiten crashherstel wordt geopend (zonder resolver) geeft
   ook `bytes-missing`.
6. **Documentcontract ongewijzigd.** `xerSourceArchive` blijft in `DOCUMENT_FIELDS` en
   `IFC_SAVE_KEYS`; documentwissel, undo, kopie en opslaan dragen het archief zoals voorheen. Alleen
   de serialisatie van de crashherstel-tick verandert, op één plek:
   `src/services/recovery/recoverySnapshot.ts` (`serializeRecoverySnapshot`, `runRecoveryTick`).

## Bekende grenzen

- De eerste tick na het openen van een groot XER schrijft de blob één keer (decoderen + schrijven).
- Herstel reconstrueert per document nog steeds met een volledige `readXER` over de bronbytes; bij
  twaalf documenten uit één bestand twaalf keer. Dat was al zo en valt buiten deze etappe.
- Twee gelijktijdige Tauri-instanties: blobs van een vreemde eigenaar worden niet gewist zolang een
  meegedragen regel ernaar verwijst; een blob die alleen een levend ander venster gebruikt en die
  niet in het gedeelde manifest staat, kan niet ontstaan, want elke ronde schrijft blob vóór manifest.
- Een ouder app-versie in een tweede browsertab opent `ops-recovery` met versie 1 en faalt na de
  upgrade naar versie 2 (`VersionError`); die tab meldt dan "auto-save mislukt". Na herladen is het weg.

## Tests

- `check-xer-archive-recovery-once.ts` (nieuw, corpusloos): synthetisch archief van 16 MB.
  (a) budgetpoort: na de eerste tick schrijft een bewerkingstick ≤ 256 KiB en roept de
  archief-leverancier niet aan; ook de eerste tick schrijft de IFC-snapshot zonder archief
  (≤ 256 KiB) plus precies één blob; (b) herstel via verwijzing geeft byte-identieke bronbytes;
  (c) twee documenten uit één bestand delen één blob; (d) ontbrekende blob ⇒ openen met
  `xerArchiveIssue` `bytes-missing`; (e) een oude snapshot met ingebed archief herstelt nog;
  (f) opruimen: sluiten van het laatste document met het archief wist de blob.
- `check-xer-archive-recovery-corpus.ts`: meet per tick bytes en tijd op rehab-2/OZB en poort de bytes.
- Mutant: `serializeRecoverySnapshot` terug op `embedded` ⇒ (a) rood.
