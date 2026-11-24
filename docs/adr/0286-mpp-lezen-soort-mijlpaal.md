# MPP lezen: de soort mijlpaal alleen voor een mijlpaal van duur 0 op een uurkalender

`readTasks` neemt de mijlpaalvlag uit `FixedMeta` letterlijk over als `isMilestone` (ADR 0280), maar leidt alleen een
`milestoneKind` af als de vlag staat, de ruwe duur 0 is, de taak op een uurkalender staat (ADR 0283) en er een anker
is: het opgeslagen einde, anders de start (`milestoneKindAt`, dat buiten een bandgrens niets geeft). De voorwaarde duur
0 staat er omdat MS Project de vlag ook op een taak met duur toestaat; voor de planning is zo'n taak geen mijlpaal
(`isZeroDurationMilestone`), en een afgeleide soort zou dan `snapSuccessorEarlyStart` op de verkeerde taak laten
werken. De MSPDI-lezer heeft dezelfde regel (ADR 0256). Dat MS Project zo'n vlag schrijft, is volgens het weggehaalde
commentaar gezien in `mpp14task.mpp`, `mpp14task-from2013.mpp` en `taskFlags-mpp14Project2010/2013.mpp` uit het corpus,
dat niet in de repo staat.
