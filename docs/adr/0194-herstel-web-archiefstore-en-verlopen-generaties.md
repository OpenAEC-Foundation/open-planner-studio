# Herstel in de browser: een eigen archiefstore en verlopen generaties

De XER-archiefblobs staan in de webdatabase `ops-recovery` in een eigen object-store, `xer-archives`, met de sha256 van
de bronbytes als sleutel, los van de snapshot- en manifestrecords in `records`. `readWebRecovery` en `clearWeb` lezen
`records` met `getAll`; omdat de blobs daar niet in staan, komen hun bytes bij dat lezen niet mee. `readWebRecovery`
haalt daarna alleen de blobs op die een leesbaar manifest noemt, en `saveWeb` en `clearWeb` lezen van `xer-archives`
alleen de sleutels. Een blob kan groot zijn; twaalf documenten uit één bestand delen er één
(`docs/xer-recovery-guardrails.md`).

Een andere generatie verloopt in `saveWeb` als haar manifest ouder is dan zeven dagen of als ze geen manifest heeft (de
gids). Een generatie zonder manifest kan weg omdat `loadWeb` een document alleen aanbiedt via een manifest van zijn
generatie, en `saveWeb` de records en het manifest van een generatie in één transactie schrijft.
