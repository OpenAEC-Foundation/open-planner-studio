# XER-bronarchief: eerst de metadata valideren, dan de bytes in blokken

`buildXerSourceArchive` (`src/services/xerSourceArchive.ts`) valideert diagnose en leesmodel voordat het de blijvende
base64-blokken van de `.xer`-bytes maakt (`chunkXerArchiveBytes`).
