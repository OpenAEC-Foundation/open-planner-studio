# XER-bronarchief: eerst de metadata valideren, dan de bytes in blokken

`buildXerSourceArchive` (`src/services/xerSourceArchive.ts`) valideert diagnose en leesmodel voordat het de blijvende
base64-blokken van de `.xer`-bytes maakt (`chunkXerArchiveBytes`). Die volgorde telt ook bij een geldig groot bestand:
volgens het weggehaalde commentaar maakt de validator bij een groot leesmodel kortlevende waarden, en zijn de blokken
dan al in gebruik, dan moet V8 extra heap openen en houdt de lezer meer geheugen vast dan nodig (niet opnieuw gemeten).
