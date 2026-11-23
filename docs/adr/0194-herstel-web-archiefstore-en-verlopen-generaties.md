# Herstel in de browser: een eigen archiefstore, en opruimen naast een onbekend manifest

De XER-archiefblobs staan in de webdatabase `ops-recovery` in een eigen object-store, `xer-archives`, met de sha256 van
de bronbytes als sleutel, los van de snapshot- en manifestrecords in `records`. `readWebRecovery` en `clearWeb` lezen
`records` met `getAll`; omdat de blobs daar niet in staan, komen hun bytes bij dat lezen niet mee. `readWebRecovery`
haalt daarna alleen de blobs op die een leesbaar manifest noemt, en `saveWeb` en `clearWeb` lezen van `xer-archives`
alleen de sleutels. Een blob kan groot zijn; twaalf documenten uit één bestand delen er één
(`docs/xer-recovery-guardrails.md`).

Staat er in de database een manifest dat deze versie niet kan lezen, dan verwijdert `saveWeb` geen records van andere
generaties en geen archiefblobs, ook niet van een generatie die anders zou verlopen. Een onbekend manifest kan naar
records en blobs verwijzen op een manier die deze versie niet kent. De precieze regel voor verlopen en voor onbekende
kandidaten staat in `docs/xer-recovery-guardrails.md`; de proeven in `check-recovery-web-hold.ts` (de blokken over
vreemde en onbekende kandidaten).
