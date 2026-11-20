# De STEP-tekstscan van de IFC-lezer is overal quote-bewust en loopt in één pas

`);`, `(…)`, `/* */` en zelfs `ENDSEC;` zijn gewone plantekst ("Fase 1 (ruwbouw); fase 2"). Een laag die strings niet
herkent, kapt stil planningsdata af: een afgekapte `IFCTASK` verliest zijn verwijzing naar `IfcTaskTime` en valt terug
op de standaardduur, zodat de planning bij opslaan en heropenen zonder signaal verandert. Daarom zijn alle lagen van
`parseSTEP` quote- en commentaarbewust: het begin van de datasectie, het weghalen van commentaar, de grens van een
entiteit (de sluithaak op haakdiepte), het einde van de datasectie en het splitsen van argumenten. Ze gebruiken één
routine voor strings en commentaar (`stepStringEnd` en `skipStepComment` uit `stepLexical.ts`). De scan blijft
lineair: één pas over de tekst, zonder index en zonder terugspringen. Hoofdletterongevoelig zoeken gebeurt per teken,
niet met een `toUpperCase` over het hele bestand, en een tekst zonder `/` gaat ongekopieerd door het weghalen van
commentaar.

## Gevolgen

- Regeleinden worden niet genormaliseerd. De scan behandelt `\r` als witruimte; een globale vervanging van `\r\n`
  door `\n` veranderde ook de tekst binnen strings, zodat een naam of notitie met Windows-regeleinden na opslaan en
  openen anders terugkwam. Toets: `check-ifc-crlf.ts`.
- Een STEP-id is een woord en kan letters bevatten (`#300T`). Een onbegrepen stuk tekst slaat de scan teken voor
  teken over.
- Het begin van de datasectie staat in `stepDataSection.ts`, gedeeld met de doelcontrole. Eerst zoekt de vinder het
  eerste `DATA;` op codeniveau: dat is juist voor elk syntactisch geldig bestand, slaat `DATA;` in een kopstring of
  commentaar over en is ongevoelig voor opmaak (alles op één regel, `ENDSEC;DATA;`, een form feed vóór het token).
  Pas als dat niets vindt, zoekt hij een `DATA;` aan het begin van een regel, voor oude eigen bestanden waarin de
  writer naam, auteur of bedrijf onbeschermd in `FILE_NAME` zette (een losse apostrof in "Van 't Hof"). Andersom kan
  niet: regelverankering als eerste poging weigert geldige bestanden en pikt een `DATA;` op aan het begin van een
  regel binnen commentaar of een kopstring met een echt regeleinde. Toets: `check-step-strings.ts` (9f tot en met 9k).
- Of de strings STEP-gecodeerd zijn, staat bij *Tekst in IFC is STEP-gecodeerd* in `.claude/rules/tauri-ifc.md`.
  Een bestand met `OPS_`-psets maar zonder `IFCAPPLICATION` van OPS telt daarbij als oud eigen bestand en wordt
  letterlijk gelezen. Het decoderen laat de apostrof verdubbeld (`''`), zodat de rest van de lezer ongewijzigd werkt.
- Een bestand dat de grammatica niet kan lezen (`stepFileGrammar`, `failed`) houdt de tolerante oude quotelezing;
  een geldig bestand volgt de tekstversie van zijn schrijver. De schemanaam in de kop wordt op dezelfde manier
  gezocht, met een regelverankerde terugval voor dezelfde oude koppen.
- De doelcontrole (`foreign/targetModelScan.ts`) volgt het weghalen van commentaar, de entiteitslus en `readEntity`
  als stroom van bytes. Zij moet "model" zeggen precies wanneer `readIFC` met `building-model` weigert. Wie de regels
  voor strings, commentaar, `#id = TYPE (…) ;` of `ENDSEC;` hier wijzigt, wijzigt ze daar ook.
  `check-ifc-target-model-scan.ts` vergelijkt beide op het corpus, op randgevallen en op willekeurige invoer.
