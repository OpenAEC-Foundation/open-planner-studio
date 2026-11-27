# XER lezen: de WBS-boom, de volgorde en de projectnaam

PROJWBS wordt een boom van samenvattingstaken met het id `xer-wbs:<proj_id>:<wbs_id>`, en een activiteit hangt
onder de samenvatting van haar `wbs_id`. Een ouder telt alleen als hij een PROJWBS-rij van hetzelfde project is
(`localParentWbsId`); anders is de rij een wortel. De bovenste rij wijst in de bestanden van
`check-xer-wbs-tree.ts` naar een knoop die niet in het bestand staat: `0` in de fixture naar MER-1, een EPS-knoop
in de fixture naar een P6-export (de projectknoop met `proj_node_flag` Y). De kop van die toets beschrijft wat een
`parentId` naar een niet-bestaande taak deed: geen wortel, dus een plat raster, inklappen zonder effect en geen
rollup. Om dezelfde reden hangt een activiteit met een `wbs_id` die het project niet heeft op het hoogste niveau
(`check-xer-wbs-tree.ts` 2, 12 en 13). Dat MPXJ een rij en een activiteit met een onvindbare ouder ook op het
hoogste niveau zet (`TableProjectReader`), komt uit het weggehaalde commentaar en is niet nagegaan.

## Gevolgen

- Volgorde onder een ouder (`stableWbsRows`): eerst `seq_num` als getal (leeg of onleesbaar telt als 0), dan
  `wbs_id` met `compareP6Keys`, dan de bronregel; alle wortels vormen één groep. Zo hangt de volgorde niet af van de
  rijvolgorde in het bestand (`check-xer-wbs-tree.ts` 5, `check-xer-reader.ts` 28).
- `compareP6Keys` vergelijkt twee sleutels van alleen cijfers als getal: zonder voorloopnullen eerst op lengte, dan
  op tekens, en bij gelijke waarde op de oorspronkelijke tekst, zodat ook een lang getal exact vergelijkt zonder
  `Number`. Op tekst kwam `10` vóór `2` (`check-xer-wbs-tree.ts` 3). Een sleutel met een ander teken komt na de
  getallen, in codepuntvolgorde. Dat MPXJ ook numeriek sorteert (`WbsRowComparatorXER`), komt uit het weggehaalde
  commentaar en is niet nagegaan.
- Tekst vergelijkt de lezer op codepunten (`compareCodePoints`), niet met `localeCompare`, zodat de volgorde niet
  van de taal van de machine afhangt (`check-xer-reader.ts` 26 en 27).
- De takenarray staat in boomvolgorde (`flattenOrder`), zoals in de P6 XML-lezer (ADR 0261): elke activiteit direct
  onder haar WBS, per ouder eerst de WBS-kinderen en dan de activiteiten in bestandsvolgorde. `childIds` volgt die
  volgorde (`check-xer-reader.ts` 4, `check-xer-wbs-tree.ts` 3 en 4).
- Een samenvattingstaak heet `wbs_name`, anders `wbs_short_name`, anders `WBS`, met `wbs_short_name` als WBS-code.
  Een activiteit heet `task_name`, anders `task_code`, anders `Activity`, met `task_code` als WBS-code.
- De projectnaam is `PROJECT.proj_name` als die niet leeg is, anders de `wbs_name` van de WBS-wortel als het project
  precies één wortel heeft (`xerProjectName`); is die ook leeg, dan `proj_short_name` en anders de `proj_id`
  (`readXerProject`). Bevinding 7 van `docs/superpowers/plans/2026-09-24-fable-critreview-pr109.md` gaf de reden:
  P6 bewaart de projectnaam in de wortelrij en `proj_short_name` is de code. `check-xer-reader.ts` 34 toetst de
  naam uit de wortel; hoe de documentnaam de code toevoegt, staat in de regel `xer`.
