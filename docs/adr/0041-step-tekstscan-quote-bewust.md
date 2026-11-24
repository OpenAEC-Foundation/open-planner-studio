# De STEP-tekstscan van de IFC-lezer herkent strings en commentaar op elke laag

`);`, `(…)`, `/* */` en zelfs `ENDSEC;` zijn gewone plantekst ("Fase 1 (ruwbouw); fase 2"). Een laag die strings niet
herkent, kapt stil planningsdata af: een afgekapte `IFCTASK` verliest zijn verwijzing naar `IfcTaskTime` en valt terug
op de standaardduur, zodat de planning bij opslaan en heropenen zonder signaal verandert. Daarom herkennen alle lagen
van `parseSTEP` strings en commentaar met dezelfde grenzen (`stepStringEnd` en `skipStepComment` uit
`stepLexical.ts`): het begin van de datasectie, het weghalen van commentaar, de grens van een entiteit (de sluithaak op
haakdiepte), het einde van de datasectie en het splitsen van argumenten. Toets: `check-step-strings.ts`.

## Gevolgen

- Het begin van de datasectie bepaalt `indexOfStepDataSection` in `stepDataSection.ts`. Eerst herkent die de exacte
  oude eigen kop (`oldOwnHeader.ts`): dan beginnen de taken bij `DATA;` na het vaste kopsjabloon, ook als de
  projectnaam `DATA;` bevat. De regels daarvoor staan bij *Oude eigen kop, scan en datasectie* in
  `.claude/rules/tauri-ifc.md` en *Oude eigen FILE_NAME-kop* in `docs/ifc-round-trip.md`. Anders zoekt de vinder eerst
  het eerste `DATA;` op codeniveau, en pas als dat niets vindt een `DATA;` aan het begin van een regel. Die volgorde
  omdraaien kan niet: regelverankering als eerste poging pikt een `DATA;` op aan het begin van een regel binnen
  commentaar of een kopstring met een echt regeleinde (`check-step-strings.ts` 9f tot en met 9k).
- Regeleinden worden niet genormaliseerd: een globale vervanging van `\r\n` door `\n` veranderde ook de tekst binnen
  strings. Toets: `check-ifc-crlf.ts`.
- Of de strings STEP-gecodeerd zijn, staat bij *Tekst in IFC is STEP-gecodeerd* in `.claude/rules/tauri-ifc.md`.
  Een bestand met `OPS_`-psets maar zonder `IFCAPPLICATION` van OPS telt daarbij als oud eigen bestand en wordt
  letterlijk gelezen. Een bestand dat de grammatica niet kan lezen (`stepFileGrammar`, `failed`) houdt de tolerante
  oude quotelezing.
- De doelcontrole (`foreign/targetModelScan.ts`) gebruikt dezelfde vinder voor de datasectie en volgt het weghalen
  van commentaar en de entiteitslus van `parseSTEP` als stroom, voor de bestanden die zij volgens die regels leest.
  Wie die regels hier wijzigt, wijzigt ze daar ook; `check-ifc-target-model-scan.ts` vergelijkt beide. De doelcontrole
  is bewust strenger dan de lezer: een bestand van een ander programma dat breekt of meer dan één datasectie heeft,
  weigert zij als `unreadable`, terwijl `readIFC` alleen de eerste datasectie leest en het bestand opent.
