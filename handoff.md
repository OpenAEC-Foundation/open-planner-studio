# Handoff — #804 fase 1: lezen, schrijven en controles

Dit bestand is de bron bij compactie en voor Trias. Houd het actueel bij elke stap. Gaat vóór de merge van de laatste PR
van fase 1 naar `docs/archive/handoffs/` (bij fase 0 ging dat mis: zie `HANDOFF-2026-11-09-804-fase0.md`).

## Waar het staat (gewone taal)

Het ontwerp (versie 20) en fase 0 zijn gemerged in main. Fase 0 bewees dat de app bij een eigen bestand precies het eigen
deel herkent. Fase 1 bouwt het echte openen en opslaan van een IFC-bestand met een gebouwmodel, achter een flag: eerst
lezen, dan schrijven, dan de controles vóór opslaan. Zolang de flag uit staat, verandert er niets voor de planner.
Het lezen (1a) en het schrijven (1b, #867) zijn gemerged in main: de writer laat het gebouwmodel staan en zet de
planning ertussen, en bij twijfel weigert hij. #886 is gemerged in main; de merge wordt daar getoetst via de toestand die
na openen in de app staat. Concept-PR #898 bevat alleen de tijdzonevergelijking (1111), de oude kalenderindeling
(1108), de bijbehorende tests en tekst. Alle code voor voortgang (1109) is terug naar main. Daarna volgt #903 voor de
volledige herleestoets (1107), dan een eigen PR voor 1109 met 1113, en daarna 1c. De meting van 1113 via de echte
invoer van de app: de rest na een werkelijk einde klopt (0 vóór en na opslaan); alleen de afronding van een duur of rest
met 17 cijfers bij gewone opslag blijft, als VERVOLG. Opslaan met een vreemd deel blijft geweigerd.

## Bronnen

- Ontwerp: `docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md` (v20). Fase 1: §8, en §4.1–4.4,
  §4.8–4.10, §4.12, §4.13, §10.
- Uitkomst van fase 0: `docs/superpowers/evidence/2026-11-ifc-fase0.md` (afwijkingen 6–9 zijn werk voor fase 1).
- Handoff van fase 0: `docs/archive/handoffs/HANDOFF-2026-11-09-804-fase0.md`.
- Code van fase 0: `src/services/ifc/foreign/` (scanner, indeling), poort `tests/planning/check-ifc-foreign-classify.ts`.

## Afspraken

| Afspraak | Wie, wanneer |
|---|---|
| Elke fase op een eigen branch vanaf `main`. Reviews gaan naar GPT-6.1-Terra (Codex, xhigh, priority); zegt Terra ja en raakt de PR opslaan, gegevensverlies, het bestandsformaat, het openen van bestanden of beveiliging, dan volgt één gerichte run van GPT-6.1-Sol (xhigh) op die punten, bewezen met echte code en echte bestanden. Bij een BLOKKEERT van Sol een fixronde, daarna kijkt Sol opnieuw naar dat punt. Mergen bij een groene CI en de laatste ja op de laatste code. Elke ronde een nieuwe `delegate_task` met de vorige bevindingen | Ethan, 2026-11-11 |
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

## Verdeling van fase 1 (7 PR's, elk achter de flag)

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
4. **1b-vervolg 2: tijdzone en oude kalender** (#898, gemerged in main op 11 november 2026). Alleen 1111 (`sameMeaning` op de vaste tijdas)
   en de kalender van 1108 (`workCalendarSlots` voor de oude indeling), plus tests en tekst. 1109 is uit deze PR:
   TASKTIME_SLOT_FIELDS en het bewaren van duur/rest zijn weer exact die van main `d456e6e7b`. De twee herschreven
   fixtures blijven bewust geweigerd, met herkomstbewijs en redenen in de PR-tekst en `OWN_MAY_REFUSE`.
5. **1107: volledige herleestoets** (#903, eigen branch). Moet vóór het aansluiten in 1c af zijn. Deze PR raakt die
   worktree niet. Kosten van opnieuw openen en rekenen apart meten (1021).
6. **1109 met 1113**: eigen PR ná #903, volgens besluit van Trias 11 november 2026. `carried` voor een duur moet de
   betekenis kunnen vergelijken binnen de lijst van exact gelezen vormen. Proeven bewerken voortgang, werkelijke start
   en werkelijk einde zoals de app (`enterTaskProgress`, `setActualFinish`), niet met een kale `updateTask` (1113).
   **Aanvulling 1109 uit #903:** echte `setTaskProgress` en `setActualStart` wijzigen de rest; daarbij kreeg ook de
   ongewijzigde duur de writerwaarde 2.333333 in plaats van 2.3333333333333335 (vier gevallen). De naad weigert dit nu
   getypeerd. Per-slot-behoud van de duur moet deze vier in de PR voor 1109 weer laten schrijven; b5 schrijft via de echte invoer.
   **De PR voor 1109** begint met opnieuw meten via echte acties wat er nog weigert (`b5-lopend` schrijft via `enterTaskProgress`); 1116 hoort erbij (besluit van Trias, 11 november 2026).
7. **1c controles**: controles 1 en 2 met `planningCanon`, `ifcSource` vernieuwen na opslaan, opslaan aan achter de flag.
   **Eis voor 1c** (Trias, 11 november 2026): de bewerkingen in de telling lopen via de acties van de app, niet kaal op het domein (nu duur en voortgang; doorrekenen gebruikt de duuractie plus F5).
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
   **Bij 1c** (besluit van Trias, 11 november 2026; knownbug 1112): de toestand "bron ontbreekt" van §4.14 afmaken: het
   echte herstel (de bron teruglezen op sha256), en de keuze van Ethan of Opslaan als met een tekst erbij komt. Tot dan
   weigert na herstel elke IFC-opslag van een document met een vreemd deel (#886, fixronde 2).
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

- 2026-11-11: 1120, fixronde 3 na Terra (GPT-6.1-Terra, xhigh) nee: alleen `calendarPeriodClocks` gebruikt nu het verschil tussen bronklok en effectief einde, met een grens van 1e-9 minuut; daarbinnen behoud per kant, daarbuiten alleen op de hele werkdag bij openen. Dit geldt ook na opslaan en heropenen zonder nieuw herstel. De extra terugval zonder bronrecord vervalt; daar blijft de exacte klokschrijver van main. Proeven dekken oude schrijfrekenruis met en zonder zone, de tweede generatie, klein herstel en de eerdere nachtdienstgevallen. De gemaakte tegenstrijdige bron met 24 seconden verschil staat als VERVOLG in 1124; kale datums blijven 1123. De eerdere 7.7-combinatie weigert op main en branch gelijk; 1121 en 1122 blijven apart. Nieuwe nummers in #908 vanaf 1125.

- 2026-11-11: #903 fixronde 1 na Terra (GPT-6.1-Terra, xhigh) nee: ongewijzigde getallen worden in de hele planning bewaakt; de echte extensieactie met alleen een lag-eenheidswijziging weigert nu veilig (1109). De twee leeswegen worden rechtstreeks vergeleken; een gemaakte proef is alleen met echte herberekening ongelijk. Beide mutaties zijn rood, cp/cmp en SHA-256 bevestigen herstel.

- 2026-11-11: #903 gebruikt één echte duuractie voor duur, doorrekenen en de toets van Trias; tien van tien schrijven. De referentie is opnieuw gemaakt op main `20b9af79a` (vier uitvoerhashes gewijzigd, invoer gelijk). De vier voortgangsgevallen weigeren getypeerd; de mutatie maakt ze alle vier stil schrijvend en rood, cp/cmp en hash herstellen de bron.
- 2026-11-11: #903 voegt de eis voor ongewijzigde taakgetallen toe; de vier echte voortgangsgevallen weigeren nu getypeerd. Toets van Trias 9/10: de 17-cijfers-villa weigert op ongewijzigde rest 2.3333333333333335 → 2.333333. Volgens opdracht gestopt, geen uitzondering, geen eindtelling of mutatie.
- 2026-11-11: #903 vergelijkt alleen `resourceCalendars` op id, met exacte inhoud en behoud van dubbele ids; de zes wisgevallen schrijven weer. Verdwenen, extra en gewijzigde kalenders blijven geweigerd. 1116 is BLOKKEERT vóór 1c en hoort bij de PR voor 1109; de telling moet dan volledig via echte app-acties lopen. Main met #898 is gemerged; de pariteitsreferentie is opnieuw gemaakt op `20b9af79a`, 1115 is daarmee opgelost.
- 2026-11-11: fixronde 2 van #898 na de gerichte run van Sol (GPT-6.1-Sol, xhigh: nee, één BLOKKEERT, ook op main): gedeelde kalender- en klokgeldigheid via `isStrictIsoDateTime` vóór vormcontrole en betekenisvergelijking; onmogelijke bronwaarden weigeren getypeerd, 1114 opgelost; de lezer blijft ongewijzigd. Aanvullend besluit: precies 24:00 met nul seconden/fracties is in een tijdslot een geldige daggrens; datum-tijd T24:00 blijft niet gedragen. De bestaande OPS-werkperiode 16:00–24:00 blijft zo behouden. Ook de tweede CI-fixture `urenperdag-oude-writer.ifc` (14:00–24:00) staat in de daggrensproef; `check-ifc-duurvormen.ts` is een aparte eindcheck.

- 2026-11-11: review ronde 2 van #898 op `9bd1e3b2e`: Terra (GPT-6.1-Terra, xhigh) ja, geen blokkade. Vier
  vervolgpunten: de open punten 1107 en 1110 waren uit `knownbugs.md` verdwenen en 1113 had geen eigen ingang
  (teruggezet); de herkomst van `xer-archief-herschreven.ifc` stond te stellig (nu alleen wat vaststaat); 1114
  (`sameMeaning` en een datum met rommel erachter) en 1115 (de pariteitstest vergelijkt met een oudere main) zijn nieuw.
  Daarna volgt de gerichte run van Sol op opslaan en verlies.
- 2026-11-11: 1113 gemeten via de echte invoer van de app (paneel, Taak bewerken, tabel, `setActualFinish`): de rest
  staat al vóór opslaan op 0 en blijft zo na heropenen. De eerdere sprong van 2.3333333333333335 naar 0 kwam alleen
  uit een kale `updateTask` en is geen fout in main; de regel hieronder van dezelfde dag is daarmee achterhaald. Wat
  blijft: de afronding naar 6 decimalen bij gewone opslag (VERVOLG, besluit van Trias).

- 2026-11-11: besluit van Trias na de stop: 1109 uit #898. De code is terug naar main, behalve de twee eerder getoetste
  wijzigingen voor 1111 en de kalender van 1108. De regressie voor precieze duur/rest bij completion en actualStart
  blijft; actualFinish is alleen gemeten zonder model. Resultaat 1113: rest 2.3333333333333335 → 0 en duur
  2.3333333333333335 → 2.333333 bij gewone opslag; dus ook in de gewone route van main. Volgorde: #898, #903,
  daarna een eigen PR voor 1109 met 1113, daarna 1c.

- 2026-11-11: review ronde 1 van #898 op `ccc92a8b3`: Terra (GPT-6.1-Terra, xhigh) nee, BEVESTIGD BLOKKEERT.
  Alleen voortgang wijzigen liet een ongewijzigde 17-cijfers-duur en rest afronden. Fixronde 1 versmalt het behoud per
  slot; de waarde van een gewijzigde duur/rest mag alleen uit de writer komen als `carried` haar draagt. De oude
  lopende taak weigert weer veilig; 1109 is heropend. Geen uitzondering. Nieuwe storeproeven voor completion,
  actualStart en actualFinish controleren de precieze bronwaarden en heropening, of een getypeerde weigering.
  STOP wegens nieuw verlies in de actualFinish-proef (1113): de rest wijzigt na heropenen hoewel de brontekst behouden
  bleef. Gerichte oude-eigen-run rood: 5 afwijkingen / 386 controles, waaronder 2 actualFinish-afwijkingen en 3 nieuwe
  weigeringen in de toets van Trias door de extra `carried`-eis. De huidige stand is tussenwerk, niet afgerond.
  Geen mutatiebewijs, eindtelling of overige eindchecks op deze stand; eerst het verlies met Trias afbakenen.

- 2026-11-11: concept-PR #898 vanaf main met #886: 1111 gebruikt `parseInstant`; 1109 rekent gewijzigde voortgang
  tot de afhankelijkheden van duur en rest; 1108 herkent de oude kalenderslots via `workCalendarSlots`. Gerichte
  storeproeven controleren de geschreven planning na heropenen. De twee extern herschreven fixtures blijven geweigerd.
  1107 is niet gebouwd: een gedeelde volledige open-route is groter dan deze reparatie. Vóór 1c apart afmaken.

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
- 2026-11-11: review ronde 2 van #886 op `40b8fbadc`: Terra (GPT-6.1-Terra, xhigh) ja; gerichte run van Sol (GPT-6.1-Sol,
  xhigh) nee. Sol vond: na herstel van een document met een model schreef Opslaan als een IFC zonder model en zonder
  kenmerk (ook op main). Fixronde 2 (besluit van Trias): het kenmerk uit herstel draagt `sourceMissing`, en
  `ifcSaveBlocked` weigert dan elke IFC-uitvoer, met de bestaande melding, ook met de flag uit. Een geopende MCP-backup en
  een eigen planning zonder model slaan op zoals eerst. Knownbugs 1111 (vóór 1c) en 1112 (bij 1c) nieuw.

## Vervolgpunten uit ronde 2 van #863 (comment op de PR)

1. De verplaatstest in §10 had een relatie met één lid en lege attributen. Aangescherpt in deze PR (twee leden, `Name`
   en `Description`, behoud na verplaatsen, opslaan, heropenen en undo).
2. `ifc-foreign.yml`: samenvatting en upload liepen niet na een meetfout. Patch aan Trias gegeven (eigen stap
   "Samenvatting" en `if: always()`); Trias pusht hem.

## Volgende stappen

1. #898 is gemerged in main (`20b9af79a`): 1111 en de kalender van 1108 zijn afgerond.
2. #903: de volledige herleestoets (1107) afmaken.
3. Een eigen PR voor 1109 met 1113 en 1116, na #903; eerst opnieuw meten via echte acties.
4. Dan 1c, met alle eisen hierboven.
5. Vóór de merge van de laatste PR van fase 1: deze handoff naar `docs/archive/handoffs/`.

## Kostenvoorwaarde van 1107 (11 november 2026)

De eigen kostenproef vóór de verplichte naad is klaar; de bouw is volgens de opdracht gestopt. Volledig heropenen scant
ook het model opnieuw: 441 ms bij 5 MiB, 621 ms bij 10 MiB, dezelfde 260 taken. De gemeten helling geeft ongeveer 11 s
extra bij 300 MiB. De verplichte naad is nog niet gebouwd; 1107 blijft open. Trias moet eerst kiezen: de open-stappen
delen (optie 1), of alleen het planningsdeel toetsen. Advies: de open-stappen delen, zodat alle stappen van de app gelijk
blijven en de bestaande scan hergebruikt kan worden. Dit is een voorstel, geen nieuwe afspraak of implementatie.
Bewijs en beperkingen: `docs/superpowers/evidence/2026-11-11-1107-herleestoets.md`.

## Vervolg 1107: stop op de nieuwe weigering (11 november 2026)

Trias koos de naad op het planningsdeel (besluit letterlijk in PR #903). De eerste versie is gebouwd, zonder wijziging
van de open-route. De bouw is gestopt volgens de opdracht: `eigen-plus-model.ifc`, een dag langer op
`task-mvp6eel7qyht28`, weigert nu met `planning-na-openen`. Zonder die toets schrijft de merge, waarna volledig heropenen
12 tijdvelden op drie taken anders geeft. De naad en de volledige bytes-route zijn in dat geval gelijk. Geen reparatie.
Bewijs: `docs/superpowers/evidence/2026-11-11-1107-herleestoets.md`. Knownbug 1107 blijft open; de volledige telling,
de tien oude eigen bestanden, het grote model en de nieuwe kosten zijn nog niet getoetst. Eerst beoordeling van de
bevinding; de stop is geen toestemming om de vergelijking af te zwakken of de bewerking te repareren.

## 1107: definitie uit #886 herbevestigd en beproefd (11 november 2026)

De naad op het planningsdeel past de callback aan beide kanten toe: `uitvoer` (ImportResult van `readPlanning`) en
`domein` (zonder writer/lezer, precies `shownAfterOpen`). De eerdere stop op twaalf bij heropenen berekende tijdvelden is
vervallen. De duurwijziging zonder F5 schrijft weer. De nieuwe proef gebruikt voor 1113 de echte setter: rest 7/3 gaat
vóór opslaan al naar 0, en blijft op beide open-wegen 0. Vier strikte/behoudsproeven zijn alleen voor hun invoer naar de
bestaande setters omgezet; beide checks zijn groen. De telling zelf is niet aangepast.

De volledige telling: 2516 geschreven, 747 getypeerd geweigerd, 0 anders (voorheen 2562/701/0). Alle geschreven merges
geven via de naad en de volledige bytes-route dezelfde planning; ook de tien oude eigen bestanden en het model van
10 MiB met duurwijziging zijn groen. Alle 46 nieuwe weigeringen zijn per bestand/bewerking/veld bewaard: 40 directe
voortgangsmutaties van de oude telling (geen echte invoer), 6 taak-wisgevallen met een verschil in de kalenderlijst.
Geen daarvan gerepareerd. Deze zes vragen beoordeling; de veertig vragen een aparte correctie van de tellerroute door
de eigenaar, niet in deze PR. Geen verlies op een echte plannerroute bewezen.

**Eis voor 1c:** 1c geeft de echte open-stappen mee aan de naad, met een test met de flag aan.

De proef van Trias is gemaakt (duur-invoerveld alleen in de uitvoer vóór de echte herberekening gewijzigd); drie rode
mutaties toetsen vergelijking, verplichte functie en gelijkheid van de twee leeswegen. Bronbestanden zijn met cp/cmp
plus SHA-256 hersteld. Gemeten extra mergetijd 140/228 ms bij 5/10 MiB, callbacks samen 129/123 ms; geen nieuwe modelscan.
De grote-modelproef kost 6,7 s inclusief genereren/bundelen, piek 377 MiB; één keer buiten de tijdzonematrix.
Bewijs, alle gevallen en grenzen: `docs/superpowers/evidence/2026-11-11-1107-herleestoets.md`.

## 1107: echte acties, kalenderbehoud en definitieve telling (11 november 2026)

De voortgangsbewerking van de testkern loopt nu via enterTaskProgress in de bestaande store-context, met bevestiging
van question.latest bij een startvraag. Edit.apply mag een verse domeinpayload teruggeven; applyEdit neemt die in haar
geheel over. Zo blijven gewiste optionele velden zoals importPristine niet hangen. De nieuwe regressieproef was rood
met alleen Object.assign en is groen met de verse payload; ook de kale voortgangsmutatie terugzetten maakt hem rood.

Het onderzoek van de zes wisgevallen toont GEEN kalenderverlies door gewone opslag op main. Echte Delete laat de
kalender staan; de writer schrijft haar en de lezer leest haar terug met dezelfde id en exacte inhoud. h7: 5/5/5,
urenperdag: 9/9/9 in resourceCalendars inclusief projectkalenderkopie; nul ontbrekend/toegevoegd/gewijzigd. Alleen de
lijstvolgorde verandert: de nu ongebruikte kalender komt via de fallback na de gebruikte kalenders. De testwisactie,
reader, writer en vergelijkingsmaat zijn niet aangepast. Dit is uitkomst "iets anders"; alleen gemeten.

Definitieve telling: 2556 geschreven, 707 getypeerd geweigerd, 0 anders, over dezelfde 3263 bewerkingen/67 bestanden.
Alle 660 rijen zijn vergeleken met de begintelling 2562/701/0. Van de 40 kale voortgangsgevallen schrijven er 39 weer;
b5 schrijft via de echte actie nu ook. Eén voortgangsgeval blijft nieuw weigeren: ifc-arity-oude-writer, vervallen
UnchangedSinceImport (#412), pset en relatie na het terecht wissen van de importvlag. Samen met de zes volgordegevallen
zijn dat zeven nieuwe weigeringen, met één verbetering (b5). Alleen gemeld, geen reparatie. Alle gerichte checks groen.

#898 was bij begin, vóór de definitieve telling en na afloop nog open. Main stond bij de laatste twee controles op
ac334b6bc (#893, rapportwerk); de onderzochte IFC-/statebestanden bleven byte-gelijk. Geen main-merge van #898, geen
nieuwe pariteitsreferentie en geen verwijdering van 1115: stap 3 is volgens opdracht overgeslagen.

Bijsturing van Trias over het rekenslot verwerkt: elke definitieve check heeft een eigen flock; het controlescript
zelf houdt geen slot vast. De eerste tussentelling is afgebroken voor de verse-payloadcorrectie en telt niet als
resultaat. Advies: apart besluiten of de bibliotheekkalenders op stabiel id mogen worden vergeleken, met exacte inhoud;
taak-/kindvolgorde blijven relevant. Ook de provenanceweigering vraagt een aparte beslissing. Bewijs en alle gevallen:
`docs/superpowers/evidence/2026-11-11-1107-herleestoets.md`.

## 1107: stop na integratie van main wegens precisieverlies (11 november 2026)

Main met #898 (`20b9af79a`) is via merge-commit `a1f6dba4a` geïntegreerd. De pariteitsreferentie is opnieuw gemaakt op
exact die main; alleen de basiscommit in de fixture veranderde. 1115 is verwijderd. De oude-eigen-proeven die de
voortgangsbewerking aanroepen wachten nu haar verse payload af; de precisieproeven gebruiken de echte setters.

**STOP: echt verlies.** Op de 17-cijfers-villa met model blijft de invoerduur na 50 % voortgang of een werkelijke start
2.3333333333333335, ook na openen van het domein. De merge schrijft en volledig heropenen geeft 2.333333; ook de
nieuwe rest wordt afgerond. Vier gevallen: oorspronkelijke bronrest en een gemaakte variant, elk met beide acties.
De canon normaliseert taakvelden via de gewone writer en maskeert dit verschil. 1107 blijft daarom BLOKKEERT vóór 1c.
Geen reparatie, overige checks en eindtelling na main niet uitgevoerd. Mainreferentie voor de nog uit te voeren telling:
2578 geschreven / 685 getypeerd geweigerd / 0 anders, 3263 bewerkingen en 660 rijen. De zes wisgevallen zijn groen;
1116 blijft voor de PR van 1109. Bewijs: `docs/superpowers/evidence/2026-11-11-1107-herleestoets.md`.

## 1107: ongewijzigd exact, stop op de toets van Trias (11 november 2026)

De extra eis bewaakt generiek numerieke taakbladeren die tegenover opened ongewijzigd zijn en die ook de open-stappen
van het domein niet veranderen. De bestaande canon blijft staan; gewijzigde getallen mogen volgens dat bestaande pad
afronden. Zonder opened is pristine de referentie, hetzelfde als de verliesbewaking. Geen reader-, writer- of
verliesbewakingswijziging. De vier echte voortgangsgevallen weigeren nu getypeerd op de duur.

**Toets van Trias: 9 schrijven, 1 weigert.** De 17-cijfers-villa met model weigert op
`task-ifc-_j2rFB79P78NtLEnkTKJwV.time.remainingTime`: 2.3333333333333335 → 2.333333. De opdracht vereist hier stoppen;
geen uitzondering of reparatie toegevoegd. Oude-eigen eindigt rood met één afwijking op 531 controles. Mutatie,
pariteit en eindtelling zijn nog niet gedaan. 1107 blijft daarom open. Bewijs:
`docs/superpowers/evidence/2026-11-11-1107-herleestoets.md`.

## 1107: echte duuractie, tien van tien (11 november 2026)

Trias besloot de kale duurwijziging te vervangen door de echte actie van de app. De voorafgaande meting op alle tien
bestanden via zowel paneel als tabel schrijft 20/20, met dezelfde planning als gewone opslag op main na dezelfde echte
actie. Bij de 17-cijfers-villa volgen duur en rest beide 2.3333333333333335 → 3.3333333333333335. F5 en openen van het
domein houden ze zo; na merge en volledig heropenen zijn beide 3.333333. Omdat de actie beide veranderde, mag dat.

lengthen gebruikt nu updateTask met dezelfde volledige time-patch en coalesceKey als het eigenschappenpaneel. De
werkregels lopen mee; de verse payload wordt volledig overgenomen. Duur, doorrekenen en de toets van Trias gebruiken
allemaal deze ene bewerking. De gewone mainreferentie gebruikt haar ook, op 20b9af79a. Vier uitvoerhashes veranderen:
urentaak v2026.7.7, 17-cijfers-villa v2026.9.0, halve-dag-villa v2026.43.0 en urentaak v2026.43.0. Alle invoerhashes
blijven gelijk. De eerdere stop op 9/10 kwam door de kale actie, niet door een echte plannerroute.

De aanvullende eis voor ongewijzigde getallen blijft staan. De mutatie neemt alleen die eis weg: alle vier echte
voortgangsgevallen schrijven dan weer stil met duur 2.333333 en de proef wordt rood. Met cp hersteld, cmp gelijk en
SHA-256 vóór/na gelijk. Op de herstelde code zijn herleestoets en oude-eigen groen; de toets van Trias is tien van tien.
1107 is verwijderd. De veilige weigeringen van de vier voortgangsgevallen blijven voor de PR voor 1109; 1116 blijft
BLOKKEERT vóór 1c. Meetbewijs: docs/superpowers/evidence/2026-11-11-1107-herleestoets.md.

### Definitieve eindtelling en controles van #903

Alle veertien gevraagde gerichte eindchecks zijn groen, elk onder een eigen flock. De telling draaide één keer na de
laatste codewijziging: 3263 bewerkingen, 2575 geschreven, 688 getypeerd geweigerd, 0 anders, over 67 bestanden.
Alle 660 rijen zijn vergeleken met main na #898 (2578/685/0). Vier nieuwe weigeringen: drie op
ifc-arity-oude-writer (duur, duur met F5 en voortgang; importvlag 1116), één op de 17-cijfers-villa (50 % voortgang;
ongewijzigde duur 2.3333333333333335 → 2.333333, 1109). b5 schrijft bij echte voortgang juist weer: één verbetering,
netto drie minder geschreven. Geen nieuwe weigering zonder bewerking; de al verklaarde uitzonderingen blijven gelijk.
Alle geschreven merges zijn via de volledige bytes-route vergeleken met de naad. Geen nieuwe weigering door de
volledige herleestoets zelf, naast de vier genoemde gevallen. De bevindingen zijn niet gerepareerd.

Pariteit op main 20b9af79a is groen; de toets van Trias schrijft tien van tien. De vier gemaakte minutenproeven in
strikt weigeren op het ongewijzigde afgeleide dagengetal 3.5 → 1.5. Vijf schrijvende combinaties met een echte duuractie
krijgen een onafhankelijke volledige heropening in plaats van de te algemene oude onafhankelijkheidsverwachting.
Geen uitzondering in de writer. Bewijs en alle nieuwe gevallen:
`docs/superpowers/evidence/2026-11-11-1107-herleestoets.md`.
De PR blijft concept, daarna Terra en Sol gericht volgens het besluit van Trias.
