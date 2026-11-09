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

## Werk

- 2026-11-09: #863 gemerged in main (`2a66df33c`). Branch `feat/804-fase1a-lezen` vanaf die commit, worktree
  `/home/aia09/.t3/worktrees/open-planner-studio/feat-804-fase1a`; `node_modules` is een link naar
  `kb-tests/node_modules` (package-lock gelijk op het versienummer na).
- 2026-11-09: handoff van fase 0 naar het archief; verplaatstest in §10 aangescherpt (VERVOLG 1 uit ronde 2 van #863).

## Vervolgpunten uit ronde 2 van #863 (comment op de PR)

1. De verplaatstest in §10 had een relatie met één lid en lege attributen. Aangescherpt in deze PR (twee leden, `Name`
   en `Description`, behoud na verplaatsen, opslaan, heropenen en undo).
2. `ifc-foreign.yml`: samenvatting en upload liepen niet na een meetfout. Patch aan Trias gegeven (eigen stap
   "Samenvatting" en `if: always()`); Trias pusht hem.

## Volgende stappen

1. Bouwer (expert, Opus xhigh) bouwt 1a; draft PR met groene CI.
2. Review door Sol (Trias start hem), fixrondes, merge.
3. Dan 1b en 1c op eigen branches vanaf `main`.
