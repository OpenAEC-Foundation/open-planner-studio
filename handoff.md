# Handoff — #804 fase 1: lezen, schrijven en controles

Dit bestand is de bron bij compactie en voor Trias. Houd het actueel bij elke stap. Gaat vóór de merge van de laatste PR
van fase 1 naar `docs/archive/handoffs/` (bij fase 0 ging dat mis: zie `HANDOFF-2026-11-09-804-fase0.md`).

## Waar het staat (gewone taal)

Het ontwerp (versie 20) en fase 0 zijn gemerged in main. Fase 0 bewees dat de app bij een eigen bestand precies het eigen
deel herkent. Fase 1 bouwt het echte openen en opslaan van een IFC-bestand met een gebouwmodel, achter een flag: eerst
lezen, dan schrijven, dan de controles vóór opslaan. Zolang de flag uit staat, verandert er niets voor de planner.
Het lezen (1a) en het schrijven (1b, #867) zijn gemerged in main: de writer laat het gebouwmodel staan en zet de
planning ertussen, en bij twijfel weigert hij. De vervolg-PR #886 (draft) toetst die writer nu op de toestand die de app
na openen heeft, en lost op wat dat liet zien: een oud eigen bestand schrijft weer zonder bewerking, taak wissen in een
bestand van v2026.7.12 schrijft, en een verstopt stuk vóór een eigen stuk laat de merge weigeren. Na de review van #886
volgt 1c, de controles; tot dan blijft opslaan met een vreemd deel geweigerd.

## Bronnen

- Ontwerp: `docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md` (v20). Fase 1: §8, en §4.1–4.4,
  §4.8–4.10, §4.12, §4.13, §10.
- Uitkomst van fase 0: `docs/superpowers/evidence/2026-11-ifc-fase0.md` (afwijkingen 6–9 zijn werk voor fase 1).
- Handoff van fase 0: `docs/archive/handoffs/HANDOFF-2026-11-09-804-fase0.md`.
- Code van fase 0: `src/services/ifc/foreign/` (scanner, indeling), poort `tests/planning/check-ifc-foreign-classify.ts`.

## Afspraken

| Afspraak | Wie, wanneer |
|---|---|
| Elke fase op een eigen branch vanaf `main`; Sol (xhigh) en Terra (xhigh, proef) reviewen per PR, elke ronde een nieuwe `delegate_task` met de vorige bevindingen | wrakko, 2026-11-09/10 |
| Zolang Codex geen tegoed heeft: review door één reviewer op Opus 5.5 (xhigh), en dat staat in de PR-tekst; daarna weer Sol en Terra. Een commit met alleen `knownbugs.md` na een ja hoeft geen nieuwe review; raakt hij ook ander tekstwerk, dan een korte tekstcheck | wrakko, 2026-11-10 |
| Mergen doet de orkestrator zelf: `gh pr merge <nr> --merge --admin --match-head-commit <sha>`, bij een groene CI en een ja van Sol op de laatste commit; merge-commit aan wrakko melden (wiki/inzichten/merge met admin.md) | wrakko, 2026-11-10 |
| De orkestrator (deze thread, sinds 10 november op Fable 5.2) coördineert en bouwt niet zelf; bouwers en reviewers draaien op Opus, Sol of Terra, niet op Fable; een council draait met Opus en Sol | Ethan, 2026-11-09/10 |
| `place_file_exclusive(from, to)` pas in fase 2, met de voorwaarden in §11; in fase 1 geen Rust-commando | wrakko, 2026-11-09 |
| Een wijziging in `.github/workflows/` pusht Trias: het token op aia09-mp50 heeft geen `workflow`-scope | wrakko, 2026-11-09 |
| VERVOLG uit een review naar `knownbugs.md` op de PR-branch; 1007 is gebruikt door #863 | werkwijze |
| Knownbugs: fase 1 gebruikte 1011–1035 (1026 is de LiteralTimes-bug van de writer, buiten #804; 1008–1010 bleven ongebruikt). Sinds 10 november heeft deze sessie het blok 1100–1149 en gebruikt alleen nummers daaruit; is het blok vol, dan een volgend blok vragen aan wrakko | Ethan via wrakko, 2026-11-10 |
| Elke feature flag krijgt een schakelaar in het verborgen blok Experimenteel, ook `ifcForeignContent`. Wat achter de flag zit, moet met de flag aan veilig zijn bij opslaan; een stap die met de flag aan data kan verliezen, is een BLOKKEERT. Dit staat in elke reviewbrief | Ethan via wrakko, 2026-11-10 |
| Regel voor de merge-writer: bij twijfel weigeren. De duur- en tijdtoets is een lijst van vormen die mogen (`src/services/ifc/foreign/durationForms.ts`). Een waarde die een OPS-versie zelf schreef, mag nooit laten weigeren: eerst op de lijst, anders de bronwaarde letterlijk laten staan; weigeren alleen als de planner dat veld zelf wijzigde | wrakko, 2026-11-10 |
| Leesfouten die ook op main zitten (1028, 1029, 1033, 1034, 1035) repareert de thread "Trias · IFC-lezer". In #804 alleen weigeren, de lezer niet aanpassen. Staat een fix in main, dan gaat de weigering weg bij het bijwerken met main (zo gedaan voor 1027 met #871 en 1026 met #872) | wrakko, 2026-11-10 |
| Geen zware runs lokaal: CI | AGENTS.md |

## Verdeling van fase 1 (5 PR's, elk achter de flag)

1. **1a lezen** (branch `feat/804-fase1a-lezen`): openen als bytes op elke route, scanner en indeling in een Worker,
   `ifcSource` in het document, de lezer met C-context (planning uit een bestand met model), de weigering blijft zonder
   flag. Met flag en een vreemd deel: openen mag, opslaan wordt geweigerd met een melding tot 1c. Ook: afwijking 6
   (`readIFC` volgt `selectPlanning`, ook de uitzondering voor een eigen live-schema), afwijking 7 (wat de app doet als de
   scanner een bestand weigert dat `readIFC` wel opent), knownbug 1007 (ids boven 2^31−1).
2. **1b schrijven** (branch `feat/804-fase1b-schrijven`): de writer met behouden ids (§4.3, §4.4, §4.10 opbouw van de
   uitvoer), afwijking 8 (writer en lezer gebruiken dezelfde constanten als het register).
   **Ook in 1b** (wrakko, 10 november 2026; VERVOLG 3 van Sol uit ronde 5 van #864): het contract-commentaar van
   `src/services/ifc/foreign/targetModelScan.ts` noemt de strengere afwijkingen tegenover `readIFC` (complexe instantie
   met een producttype; een scan zonder uitkomst; een modelbestand dat `readIFC` om een andere reden niet opent, zoals
   afgekapt of met een NUL-byte vóór de kop, omdat `First.Space` alle bytes `<= 0x20` overslaat), en de pariteitstest
   in `tests/planning/check-ifc-target-model-scan.ts` neemt die gevallen expliciet op.
3. **1b-vervolg: de merge via de route van de app** (knownbug 1105, BLOKKEERT vóór 1c; PR #886, branch
   `feat/804-fase1b-vervolg-app-route`). Besluit van Trias (wrakko, 10 november 2026), de vier voorwaarden letterlijk:
   - "#867 krijgt nu in fixronde 8 alleen het dubbele #id (1100, hoogste #id uit de hele tekst) en de kleine punten.
     Daarna een kleine ronde 8."
   - "De nieuwe PR "de merge via de route van de app" start direct na de merge van #867, vanaf main, en moet in main
     staan vóór 1c begint. Zet dat als harde eis in knownbugs.md en in de PR-tekst van #867."
   - "In die PR openen alle merge- en verliestoetsen via de route van de app (openOpenedFile met de flag). Draai de hele
     telling en alle verliestoetsen daar opnieuw. Vindt dat ergens echt verlies in plaats van te veel weigeren, dan is
     dat een BLOKKEERT in die PR [...]."
   - "Neem daar ook de ene definitie van "gewijzigd" (mergeWriter.ts tegenover lossCheck.ts), 1102 en 1104 in, en zet de
     pariteitstest op de huidige main met de oude-tags."
4. **1b-vervolg 2: eigen bestanden die nog weigeren** (knownbugs 1108 en 1109, BLOKKEERT vóór 1c). Besluit van Trias
   (wrakko, 11 november 2026): een eigen kleine PR na #886, vanaf main, die in main staat vóór 1c begint. 1108: drie
   oude eigen fixtures weigeren met een model zonder bewerking. 1109: voortgang invoeren in
   `b5-lopend-oude-writer.ifc` met een model weigert ("voortgang bijwerken is gewoon werk van elke planner").
   Ook 1107 (vóór 1c, Terra in review ronde 1 van #886): een volledige herleestoets in de merge, zoals openen via de
   app, met een proef die rood wordt als de herberekening na openen de planning verandert.
   Knownbug 1110 (de laatste taak met een eigen taaktype wissen) blijft VERVOLG.
5. **1c controles**: controles 1 en 2 met `planningCanon`, `ifcSource` vernieuwen na opslaan, opslaan aan achter de flag.
   **Eis voor 1c** (wrakko, 10 november 2026; uit de zoektocht van fixronde 3 van #864): de headless MCP-server kent geen
   flag, geen `ifcSource` en geen doelcontrole op inhoud (de gedeelde laadcode herkent wel het kenmerk uit een backup). `planner_export_ifc` roept wel
   `refusedWriteTarget` aan (`src/services/mcp/tools/fileTools.ts:347-349`), maar de headless fs geeft geen
   `scanTarget` (optioneel, `fileTools.ts:86-90`; `headless/mcp-server/src/host.ts:127`), dus een bestaand modelbestand
   in `--root` is daar niet leesbaar en mag overschreven worden (`headless/mcp-server/src/nodeFs.ts:358`). Openen gaat
   nog als tekst met de modelweigering van main; de bytes-route voor headless is fase 2 (§4.12, §8). Zodra 1c opslaan
   met een vreemd deel aanzet, krijgt de headless route minstens de doelcontrole op inhoud (een `scanTarget` in
   `nodeFs.ts`), of hij weigert schrijven naar een bestaand IFC met model. Anders is 1c niet klaar.
   **Eis voor 1c** (wrakko, 9 november 2026; knownbug 1011): zodra opslaan aan gaat, mag geen vreemd deel stil
   verloren gaan, ook niet bij een onbekend schema (§4.11). Anders is 1c niet klaar.
   **Eis voor 1c** (wrakko, 10 november 2026; uit de zoektocht van fixronde 3 van #864): een bron met vreemde gegevens
   maar zonder model, die niet meer open is, moet beschermd zijn. Nu beschermt de doelcontrole alleen een bestaand
   bestand met `IfcProduct`/`IfcTypeProduct` (`src/services/ifc/foreign/targetModelScan.ts`), en het kenmerk alleen
   zolang het document open is of via herstel en MCP-backup; een gewone opslag schrijft het kenmerk bewust niet
   (`src/state/ifcSaveInput.ts:36-39`). Na export of Opslaan als naar een ander bestand en heropenen kan zo'n bron
   (bijv. een IFC met een externe pset) overschreven worden. Anders is 1c niet klaar.
   **Eis voor 1c** (wrakko, 10 november 2026; knownbug 1022): bij een eigen project (P) met een gedeelde eerste owner
   history weigert de merge een gewijzigde auteur of een gewijzigd bedrijf (`projectgegevens`, `lossCheck.ts`). Richting 1:
   op de bytes-route auteur en bedrijf lezen uit de owner history van het IfcProject of het werkplan (die schrijft de
   writer zelf). Zolang de planner bij een eigen bestand met een model zijn auteur niet kan wijzigen, gaat opslaan niet
   aan. Anders is 1c niet klaar.
   **Eis voor 1c** (wrakko, 10 november 2026; knownbug 1021): de merge mag de bron niet bij elke merge opnieuw scannen;
   bij 300 MB terug naar ongeveer het niveau van ronde 1 van #867 (merge 6,7 s, piek 1,2 GB; na fixronde 2 13,0 s en
   1,7 GB). Anders is 1c niet klaar.
   **Eis voor 1c** (wrakko, 10 november 2026; knownbug 1104): 1c gaat niet naar main zolang een eigen bestand van
   v2026.7.4 tot v2026.7.14 met een baseline en een model weigert bij het wissen van een baselinetaak. Opgelost in
   #886; de proeven staan in `check-ifc-foreign-oude-eigen.ts` en in de telling.
   **Eis voor 1c** (Ethan via wrakko, 10 november 2026): de merge-writer aansluiten mag alleen als hij met de flag aan
   op elke opslagroute (Opslaan, Opslaan als, AutoSave en herstel, export, MCP, headless) veilig is, met een test met
   de flag aan.
   **Voor 1c** (review ronde 6 van #867, VERMOED laag): `writeIfcMerge` geeft `literalCalendarIds` niet terug;
   `writeIFCWithChoices` doet dat wel. Na het aansluiten moet de sessie een nieuw letterlijke kalender onthouden.
   **Opgelost in #886** (was knownbug 1102, besluit van Trias 10 november 2026): wordt een kalender bij een opslag
   letterlijk, dan schrijft de merge alle datums op die kalender (taaktijden, werktijden, baselinerijen) in de vorm van
   de writer, zoals een gewone opslag op main. Alleen bij P-stukken, alleen in slots die de lezer exact leest, en alleen
   als herlezen via de route van de app dezelfde planning geeft; anders weigert de merge. De toets van Trias
   (`check-ifc-foreign-oude-eigen.ts`): tien oude eigen bestanden met model geven na een duurwijziging, F5 en opslaan
   dezelfde planning als zonder model met een gewone opslag.
   **Voor 1c** (review van #881, knownbug 1100, VERMOED midden): V-bytes kunnen een entiteit bevatten die de scanner
   niet ziet; een nieuw `#id` van de writer mag daar niet mee botsen. Ronde 7 van #867 toetst dit.
   **Bij voorkeur in 1c** (wrakko, 10 november 2026; knownbug 1023, VERVOLG): stabiele GlobalIds voor onze eigen
   hulpstukken (`OPS_Resource` en de andere psets en relaties); het is onze eigen writer.

## Werk

- 2026-11-09: #863 gemerged in main (`2a66df33c`). Branch `feat/804-fase1a-lezen` vanaf die commit, worktree
  `/home/aia09/.t3/worktrees/open-planner-studio/feat-804-fase1a`; `node_modules` is een link naar
  `kb-tests/node_modules` (package-lock gelijk op het versienummer na).
- 2026-11-09: handoff van fase 0 naar het archief; verplaatstest in §10 aangescherpt (VERVOLG 1 uit ronde 2 van #863).
- 2026-11-09: Trias zette de workflow-patch erop (`0231a2d91`, eigen stap "Samenvatting", `if: always()`); verdeling
  1a/1b/1c akkoord; eisen: flag uit = main byte-gelijk (met test), melding kort en neutraal; knownbugs 1011–1015.
- 2026-11-09: bouwer (expert, Opus xhigh, geen subagents) klaar. Draft PR #864, flag `ifcForeignContent`. Bytes-route op
  de open-routes, Worker met terugval, `ifcSource` zonder fase-2-velden, lezer volgt `selectPlanning` (afwijking 6 weg),
  opslaan geweigerd met een vreemd deel, §4.9 punt 6 (afwijking 7), knownbug 1007 opgelost. Nieuw
  `check-ifc-foreign-open.ts` (481 checks, 66 eigen bestanden byte-gelijk met en zonder flag). Poort
  `check-xer-chunk-boundary.ts` staat ook een luie XER-import in `ifcReadWithXer.ts` toe (door Sol na te kijken).
  Open vragen van de bouwer: rode weigermelding (`refusalNotice`), onbekend schema zonder `IfcProduct` opent zoals nu
  (afwijking van §4.11), een kopie deelt de bron en houdt de weigering.
- 2026-11-09/10: vijf reviewrondes van #864 door Sol (GPT-6.1 Sol, xhigh) en Terra (GPT-6.1 Terra, xhigh, proef); vier
  fixrondes door dezelfde bouwer. Gedicht: documentwissel tijdens opslaan, export over de bron, herstelkenmerk
  (fixronde 1); AutoSave over de bron van een ander document, doelcontrole op inhoud als stroom (fixronde 2); lange kop,
  kenmerk in de MCP-backup, één vingerafdruk per controle (fixronde 3); de doelcontrole volgt de route van `readIFC`,
  met één gedeelde zoeker voor `DATA;` (`src/services/ifc/stepDataSection.ts`) (fixronde 4). Knownbugs 1012–1019.
- 2026-11-10: ronde 5 op `ac56701fb` (CI groen op `24ef9cca5`): Sol **ja**, Terra **ja**, geen BLOKKEERT. Besluiten van wrakko in deze rondes:
  de doelcontrole zegt `model` precies als `readIFC` weigert met `building-model`, plus drie strengere afwijkingen
  (complexe instantie met een producttype; een scan zonder uitkomst is geen vrijbrief; een modelbestand dat `readIFC`
  om een andere reden niet opent, zoals afgekapt of met een NUL-byte vóór de kop); de backup met kenmerk wijkt met de
  flag uit af van main (aanvaard); geen werkgrens voor 1018 in 1a.

- 2026-11-10: #864 gemerged in main door wrakko: `14f979755` (`--admin --match-head-commit 24ef9cca5`). Branch
  `feat/804-fase1b-schrijven` vanaf die commit, worktree `/home/aia09/.t3/worktrees/open-planner-studio/feat-804-fase1b`
  (`node_modules`: link naar `kb-tests/node_modules`, package-lock gelijk op het versienummer na).
- 2026-11-10: #867 rondes 1 en 2: Sol nee, Terra nee; fixronde 1 (verliesbewaking tegen de bron, regel in de kop van
  `mergeWriter.ts`; het oude losse `IfcProject` wordt C, besluit 9 november; het akkoord "wordt P" is ingetrokken) en
  fixronde 2 (leesverliestoets O0 in plaats van vrijstellingen). Telling na fixronde 2: 23 van 26 eigen bestanden met
  model weigeren zonder bewerking (`niet-gedragen`, 775 meldingen; vooral GlobalIds van hulpstukken, knownbug 1023, en
  oude writer-waarden, knownbug 1024).
- 2026-11-10: besluiten van wrakko na fixronde 2: (1) GlobalIds van eigen hulpstukken mogen wijzigen als benoemde soort
  (§4.10), als de toets zelf nagaat dat het stuk P is en geen vreemd stuk ernaar wijst; (2) het slotdeel van
  `sourceSlots` gaat naar fase 1 (in 1b gebouwd): de bronwaarde van een P-slot blijft staan als de planner dat veld niet
  wijzigde; O0 blijft de toets; `jsonExtras`, `unusedKeys` en `detached` blijven in fase 2; (3) lay-out, schrijfvelden en
  toevoegingen mogen, smal; een wegvallend argument alleen als het `$` was of uit andere velden volgt; (4) het pad van
  `LiteralTimes`: nagaan of een gewone opslag het ook doet, dan een eigen knownbug buiten #804.
- 2026-11-10: fixronde 3 (bronwaarden terugzetten, (b); `d4b81faba`) en ronde 3: Sol nee, Terra nee.
- 2026-11-10: een expert (Opus xhigh, alleen lezen) maakte een lijst van 53 plekken waar de bewaking een verschil
  verklaart; fixronde 4 dichtte er 19 (head `a94774a7c`); ronde 4: Sol nee, Terra nee (STEP-codering, decimale komma,
  feestdagen, verdwijnend stuk).
- 2026-11-10: fixronde 5 en 5b (`f1efc7eed` tot en met `ae8c3f882`); main met #871 erin (1027 weg); ronde 5: Sol nee,
  Terra nee (oude lagvorm, `PT-2H`, `PT90S`).
- 2026-11-10: fixronde 6: de lijst van duurvormen die mogen (`5d6b1f813` tot en met `626f21029`); main met #872 en #847
  erin (1026 weg); ronde 6 door één reviewer op Opus 5.5 (Codex had geen tegoed): nee (vier soorten waarden die OPS zelf
  schreef, weigerden).
- 2026-11-10: #881 (knownbug 1151: met de flag aan sloeg openen de modelweigering over) gemerged in main: `febb69ce1`.
  Knownbug 1100 komt uit de review daarvan.
- 2026-11-10: fixronde 7 (`06b6b8e3a`): oude eigen bestanden schrijven zonder bewerking; de telling loopt nu ook over
  elk bestand uit `oude-tags` met een wand; main met #870 en #881 erin (`febb69ce1`, merge `36bfb3752`); doeltest op
  `fix3-twee-data`; knownbugs 1101–1104. Head `6c115d3f6`.
- 2026-11-10: besluiten van Trias na fixronde 7: 1103 blijft VERVOLG (er gaat niets verloren en het weigert bij
  openen); 1104 mag in 1b weigeren en is een eis voor 1c.
- 2026-11-10: review ronde 7 op `402fffabe` door één reviewer op Opus 5.5 (Codex had geen tegoed): nee, twee BLOKKEERT
  (een dubbel `#id` naast een entiteit die de scanner niet ziet, knownbug 1100; oude eigen bestanden weigeren via de
  route van de app). Fixronde 8: het eerste nieuwe id begint boven het hoogste `#<cijfers>` in elk stuk dat de merge
  letterlijk overneemt, ook in commentaar en strings; de route van de app gaat naar de vervolg-PR (knownbug 1105).
- 2026-11-10: #867 gemerged in main (`a4783fc35`). Vervolg-PR #886 vanaf main: de testkern opent via de store met de flag
  (`openForeign`); de meting vooraf vond geen echt verlies, wel te veel weigeren en te ruim schrijven (tussenrapport in de
  PR). Daarna: wat alleen het openen veranderde, gaat in de vorm van de bron (`sourceForm.ts`, knownbug 1105); een
  baselineregel zonder taak telt zonder id (knownbug 1104); tekst met `#cijfers` vóór een eigen stuk weigert
  (`verstopt-stuk`, knownbug 1106); de velden per slot komen uit één tabel in `lossCheck.ts`; de pariteit is opnieuw
  gemaakt op `a4783fc35`, met de oude-tags. De telling loopt nu ook over de fixtures met gewone bewerkingen; daaruit:
  de lijst ids in `WorkingExceptionIds` telt via de koppeling (een relatie erbij weigerde, en zonder bewerking wees de
  lijst naar een id dat niet meer bestond). Knownbug 1102 is breder beschreven en blijft open; 1108, 1109 en 1110 zijn nieuw.
- 2026-11-11: stap 6 van #886, besluit van Trias over knownbug 1102 (BLOKKEERT vóór 1c): een kalender die bij deze
  opslag letterlijk wordt, krijgt al haar datums in de vorm van de writer (`sourceForm.ts`, `lossCheck.ts`:
  `literalWriterForm`, `literalBaselineForm`); een datum in een taaktijd die de lezer helemaal leest, telt niet meer als
  deels gelezen als de planner haar wijzigde. F5 schrijft in alle tien oude eigen bestanden, met dezelfde planning als
  een gewone opslag zonder model; de telling ging van 2547 naar 2562 gelukt, 0 anders, niets dat eerst schreef weigert
  nu. Knownbug 1102 is weg; wat bij F5 nog weigert, weigert ook zonder bewerking (1108 en vreemde bestanden).
- 2026-11-11: review ronde 1 van #886 op `1cb0b0057`: Sol (GPT-6.1-Sol, xhigh) nee, Terra (GPT-6.1-Terra, xhigh) ja met
  vervolgpunten. Sol vond echt verlies: "de lezer leest dit slot exact" kwam uit de schrijfwijze van de bron, niet uit de
  waarde (een periode `'07:30:00'` die de lezer als 07:00 leest, ging na een duurwijziging verloren). Fixronde 1: een slot
  is gedragen als de writer op de lezing van de bron (O0) dezelfde waarde geeft (`sameMeaning` in `lossCheck.ts`); de
  regel voor een samengestelde datum geldt alleen als de planner die datum zelf wijzigde tegenover `opened`; de toets van
  Trias vergelijkt met een gewone opslag op main zelf (`ifcAppRoute.ts`, `scripts/proef/maak-main-toets-trias.mjs`). De
  tien oude eigen bestanden schrijven nog na F5. Knownbug 1107 nieuw (vóór 1c, de kleine PR).
- 2026-11-11: #886 bijgewerkt met main `2fbbc4ae1` (#892, de lezer leest duren exact; #891, alle flags een
  schakelaar). Eén conflict, in `check-ifc-duurvormen.ts`: de lezer direct (`openForeignRaw`) en de weigering bij openen
  van #892 gelden samen. Sommige duurvormen weigeren nu al bij openen en bereiken de merge niet; de lijst van de merge
  (`durationForms.ts`) bleef op main bewust voorzichtig (knownbug 1152), dus er ging geen weigering weg. De referenties
  van main zijn opnieuw gemaakt op `2fbbc4ae1`, met dezelfde bytes als op `a4783fc35`. Telling gelijk per bestand en
  bewerking (2562 gelukt, 701 geweigerd, 0 anders); de tien oude eigen bestanden schrijven nog na F5.

## Vervolgpunten uit ronde 2 van #863 (comment op de PR)

1. De verplaatstest in §10 had een relatie met één lid en lege attributen. Aangescherpt in deze PR (twee leden, `Name`
   en `Description`, behoud na verplaatsen, opslaan, heropenen en undo).
2. `ifc-foreign.yml`: samenvatting en upload liepen niet na een meetfout. Patch aan Trias gegeven (eigen stap
   "Samenvatting" en `if: always()`); Trias pusht hem.

## Volgende stappen

1. Review ronde 2 van #886 (fixronde 1).
2. Een kleine PR vanaf `main` voor knownbugs 1107, 1108 en 1109 (vóór 1c).
3. Dan 1c op een eigen branch vanaf `main`, met alle eisen voor 1c hierboven.
4. Vóór de merge van de laatste PR van fase 1: deze handoff naar `docs/archive/handoffs/`.
