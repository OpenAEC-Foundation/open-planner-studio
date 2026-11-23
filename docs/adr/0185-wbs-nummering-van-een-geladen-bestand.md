# WBS-codes uit een bestand worden niet stil herschreven

`Project.wbsAutoNumber` zet *WBS auto* aan of uit (gids `howto-structuur-aanpassen.md`). Een geladen bestand zonder
de vlag houdt vrije tekst, naar het model van MS Project: codes die al in omloop zijn, veranderen niet zonder dat de
planner erom vraagt. Uitzondering bij het openen (eigenaarsbesluit 2026-10-17): staat er geen vlag in het bestand en
zijn alle codes al precies de boomnummering, dan zet `inferWbsAutoNumberOnOpen` (`utils/wbs.ts`) de vlag aan, zonder
een code te veranderen. Op welke laadroutes dat gebeurt, staat in ADR 0072.
