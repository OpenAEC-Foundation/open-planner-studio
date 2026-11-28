# P6-resttempo: gelijk binnen de afronding van P6

`importedAssignmentRate` in `src/engine/work/workRuleMapping.ts` neemt voor een geïmporteerde P6-toewijzing het
resttempo als `unitsPerDay` en bewaart het begrote tempo als `plannedUnitsPerDay`, alleen als die twee echt van elkaar
verschillen (ADR 0269). De grens `RATE_REL_EPS` is 1e-5 relatief, en niet een veel kleinere waarde. Reden, uit het
weggehaalde commentaar en niet nagegaan: P6 schrijft het resttempo afgerond, in XER op 6 significante cijfers of op 8
decimalen, wat hooguit 5e-6 relatief scheelt; het kleinste echte verschil in het corpus was 1,7e-5. Een strengere grens
zou bij zulke bestanden het afgeronde getal als ander tempo zien en elke toewijzing een eigen `plannedUnitsPerDay`
geven.
