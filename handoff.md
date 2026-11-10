# Handoff — #804 fase 1: lezen, schrijven en controles

Dit bestand is de bron bij compactie en voor Trias. Houd het actueel bij elke stap. Gaat vóór de merge van de laatste PR
van fase 1 naar `docs/archive/handoffs/` (bij fase 0 ging dat mis: zie `HANDOFF-2026-11-09-804-fase0.md`).

## Waar het staat (gewone taal)

Het ontwerp (versie 20) en fase 0 zijn gemerged in main. Fase 0 bewees dat de app bij een eigen bestand precies het eigen
deel herkent. Fase 1 bouwt het echte openen en opslaan van een IFC-bestand met een gebouwmodel, achter een flag: eerst
lezen, dan schrijven, dan de controles vóór opslaan. Zolang de flag uit staat, verandert er niets voor de planner.

## Bronnen

- Ontwerp: `docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md` (v20). Fase 1: §8, en §4.1–4.4,
  §4.8–4.10, §4.12, §4.13, §10.
- Uitkomst van fase 0: `docs/superpowers/evidence/2026-11-ifc-fase0.md` (afwijkingen 6–9 zijn werk voor fase 1).
- Handoff van fase 0: `docs/archive/handoffs/HANDOFF-2026-11-09-804-fase0.md`.
- Code van fase 0: `src/services/ifc/foreign/` (scanner, indeling), poort `tests/planning/check-ifc-foreign-classify.ts`.

## Afspraken

| Afspraak | Wie, wanneer |
|---|---|
| Elke fase op een eigen branch vanaf `main`; Sol reviewt per PR, Trias start de review en merget | wrakko, 2026-11-09 |
| Geen Fable, ook niet als subagent of in een council, tot Fable 5.5 uit is; een council draait met Opus en Sol | Ethan, 2026-11-09 |
| `place_file_exclusive(from, to)` pas in fase 2, met de voorwaarden in §11; in fase 1 geen Rust-commando | wrakko, 2026-11-09 |
| Een wijziging in `.github/workflows/` pusht Trias: het token op aia09-mp50 heeft geen `workflow`-scope | wrakko, 2026-11-09 |
| VERVOLG uit een review naar `knownbugs.md` op de PR-branch; 1007 is gebruikt door #863 | werkwijze |
| Knownbugs voor fase 1: 1011 t/m 1020; vanaf 1021 eerst vragen (1008–1010 blijven ongebruikt) | wrakko, 2026-11-10 |
| Geen zware runs lokaal: CI | AGENTS.md |

## Verdeling van fase 1 (3 PR's, elk achter de flag)

1. **1a lezen** (branch `feat/804-fase1a-lezen`): openen als bytes op elke route, scanner en indeling in een Worker,
   `ifcSource` in het document, de lezer met C-context (planning uit een bestand met model), de weigering blijft zonder
   flag. Met flag en een vreemd deel: openen mag, opslaan wordt geweigerd met een melding tot 1c. Ook: afwijking 6
   (`readIFC` volgt `selectPlanning`, ook de uitzondering voor een eigen live-schema), afwijking 7 (wat de app doet als de
   scanner een bestand weigert dat `readIFC` wel opent), knownbug 1007 (ids boven 2^31−1).
2. **1b schrijven**: de writer met behouden ids (§4.3, §4.4, §4.10 opbouw van de uitvoer), afwijking 8 (writer en lezer
   gebruiken dezelfde constanten als het register).
3. **1c controles**: controles 1 en 2 met `planningCanon`, `ifcSource` vernieuwen na opslaan, opslaan aan achter de flag.
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
- 2026-11-10: ronde 5 op `ac56701fb`: Sol **ja**, Terra **ja**, geen BLOKKEERT. Besluiten van wrakko in deze rondes:
  de doelcontrole zegt `model` precies als `readIFC` weigert met `building-model`, plus drie strengere afwijkingen
  (complexe instantie met een producttype; een scan zonder uitkomst is geen vrijbrief; een modelbestand dat `readIFC`
  om een andere reden niet opent, zoals afgekapt of met een NUL-byte vóór de kop); de backup met kenmerk wijkt met de
  flag uit af van main (aanvaard); geen werkgrens voor 1018 in 1a.

## Vervolgpunten uit ronde 2 van #863 (comment op de PR)

1. De verplaatstest in §10 had een relatie met één lid en lege attributen. Aangescherpt in deze PR (twee leden, `Name`
   en `Description`, behoud na verplaatsen, opslaan, heropenen en undo).
2. `ifc-foreign.yml`: samenvatting en upload liepen niet na een meetfout. Patch aan Trias gegeven (eigen stap
   "Samenvatting" en `if: always()`); Trias pusht hem.

## Volgende stappen

1. #864: CI groen op de laatste commit, PR op ready, merge met `--match-head-commit`, merge-commit aan wrakko melden.
2. Dan 1b en 1c op eigen branches vanaf `main`, met de eisen voor 1c hierboven (1011, de bron zonder model, headless).
3. Vóór de merge van de laatste PR van fase 1: deze handoff naar `docs/archive/handoffs/`.
