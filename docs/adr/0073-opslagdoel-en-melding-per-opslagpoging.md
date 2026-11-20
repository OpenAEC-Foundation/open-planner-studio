# Opslaan: één doel per document en één melding per poging

De bewaking van de opslagroutes (inhoudsidentiteit, momentopname, doelcontroles, de vervanging van het eigen bestand)
staat in `AGENTS.md`, `.claude/rules/state.md` en `.claude/rules/tauri-ifc.md`. Daarnaast maakt de route in
`fileSlice.ts` een paar keuzes die een lezer zonder uitleg zou terugdraaien. Een geslaagde opslag naar een nieuw doel
zet alle vier de doelvelden van het document tegelijk (`filePath`, `fileHandle`, `siteFileId`, `siteFileVersion`):
wie naar een lokaal bestand opslaat, verliest zijn site-doel en omgekeerd, anders schreef de volgende Ctrl+S naar het
oude doel. Een mislukte Ctrl+S geeft één melding per poging, ook als ook de terugval faalt.

## Gevolgen

- Bij een site-doel is `siteFileVersion` de net geschreven versie, de nieuwe basis van dit document. Een site-doel zet
  Automatisch opslaan uit, omdat dat naar de site niet bestaat.
- Elke Ctrl+S (ook *Opslaan* in de sluitvraag) krijgt een eigen samenvouwsleutel voor haar foutmelding
  (`writeActiveDocument`). Faalt ook de terugval, dan ververst de melding haar reden zonder tweede melding; een volgende
  Ctrl+S is een nieuwe poging met een eigen melding. *Opslaan als* maakt zo'n sleutel niet aan.
- In de browser vraagt Ctrl+S de schrijftoestemming van een handle vóór het rekenen, ook voor een gewoon bestand. De
  vraag van de browser hoort bij het gebaar van de planner, en dat gebaar kan na een trage start van de opslagworker
  verlopen zijn. Zonder toestemming volgt de bestaande uitweg (de opslaankiezer of een download). Alleen voor een
  document zonder vreemd deel wordt een echte fout van de toestemmingsvraag gemeld en neemt hij dezelfde uitweg; bij een
  document met een vreemd deel gaat zo'n fout rechtstreeks naar de gewone foutafhandeling van de opslag.
- Na een echte schrijffout van de gewone writer op een handle biedt alleen de browser de uitweg Opslaan als; een fout
  bij de merge gaat naar de gewone foutafhandeling. Slaagt die kopie, dan bewijst
  dat geen browserbeperking: de uitleg van `browserSaveNotice` komt dan alleen bij een download.
- De uitvoer van de opslagworker draagt de bytes en een lui berekende tekst. De route geeft de bytes rechtstreeks aan
  de schrijflaag en vraagt de tekst nooit op; ook het toevoegen van een eigenschap aan zo'n uitvoer kopieert de
  eigenschapsbeschrijvingen in plaats van een spread, want een spread roept de getter aan en decodeert de bytes
  alsnog.
- Staat er al een vraag bij opslaan of openen open (van de site, de schemavraag, de waarschuwing over afhankelijke
  projecten of de vraag "alleen de planning", `saveQuestionOpen`), dan begint Opslaan of Openen geen tweede ronde.
  Anders schreef Ctrl+S in het naamveld van "Opslaan op de site" na het antwoord nog een versie.
