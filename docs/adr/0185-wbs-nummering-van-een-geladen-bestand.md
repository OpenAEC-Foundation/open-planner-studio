# WBS-codes uit een bestand worden niet stil herschreven

`Project.wbsAutoNumber` zet *WBS auto* aan of uit: aan nummert de app de boom bij elke structuurwijziging opnieuw,
uit zijn de codes vrije tekst met *Hernummer WBS* als losse actie (gids `howto-structuur-aanpassen.md`). Een nieuw
project krijgt de vlag aan (`createDefaultProject` in `state/defaults.ts`). Een geladen bestand zonder de vlag houdt
vrije tekst, naar het model van MS Project: codes die al in omloop zijn, veranderen niet zonder dat de planner erom
vraagt.

## Gevolgen

- Uitzondering bij het openen (eigenaarsbesluit 2026-10-17): staat er geen vlag in het bestand en is elke code al
  precies de boomnummering, of heeft het bestand geen taken, dan zet `inferWbsAutoNumberOnOpen` (`utils/wbs.ts`) de
  vlag aan. Er verandert dan geen code. Op welke laadroutes dat gebeurt, staat in ADR 0072.
- Een vlag uit het bestand, ook `false`, laat `inferWbsAutoNumberOnOpen` staan.
