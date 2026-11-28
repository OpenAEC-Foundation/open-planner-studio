# P6-resttempo: gelijk binnen de afronding van P6

`importedAssignmentRate` in `src/engine/work/workRuleMapping.ts` neemt voor een geïmporteerde P6-toewijzing het
resttempo als `unitsPerDay` en bewaart het begrote tempo als `plannedUnitsPerDay`, alleen als die twee echt van elkaar
verschillen (ADR 0269). De grens `RATE_REL_EPS` is 1e-5 relatief, en niet een veel kleinere waarde. Reden (de gevallen a7 tot
a9 in `check-resttempo.ts`, uit rehab-2, Roads en het corpus): P6 schrijft het resttempo afgerond, in XER op 6 significante cijfers of op 8
decimalen, wat hooguit 5e-6 relatief scheelt; het kleinste echte verschil in het corpus was 1,7e-5. Een strengere grens
zou een afgerond resttempo als ander tempo kunnen zien.
