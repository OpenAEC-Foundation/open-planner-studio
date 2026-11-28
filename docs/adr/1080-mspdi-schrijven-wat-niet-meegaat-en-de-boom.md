# MSPDI schrijven: wat niet meegaat, de boom en de start van een contour

`writeMSPDIWithReport` (`mspdiWriter.ts`) schrijft alleen wat `readMSPDI` ook weer leest. MSPDI kent `<Manual>`,
`<LevelingDelay>`, `<Resume>` en `<Stop>`, maar de lezer leest geen van die elementen; het importverslag
(`scanMspdiImportLoss`) telt `<Manual>` en `<LevelingDelay>` daarom als verlies. Een handmatig geplande taak, een
nivelleervertraging in minuten (`levelingDelayMinutes`) en een hervat- of stopmoment gaan daarom niet mee; de writer
meldt ze alleen in de console. Zou hij ze wel schrijven, dan zegt de eigen export iets wat OPS bij het openen van
hetzelfde bestand stil weglaat.

## Gevolgen

- Een kostenresource en haar toewijzingen gaan niet mee (issue #815). De lezer maakt van elke `<Type>` behalve 0 een
  LABOR-resource (ADR 0257), dus een kostenresource zou na openen van de eigen export als arbeid terugkomen. De
  exportmelding telt ze (`exportCostResourcesLostNotice`).
- De taken gaan in boomvolgorde (`flattenOrder`) en `<OutlineLevel>` komt uit de diepte in de echte boom
  (`taskDepths`), niet uit `wbsCode`. De lezer bouwt de boom uit de niveaus in de volgorde van het bestand
  (`rebuildImportedHierarchy`, ADR 0761), en `wbsCode` is na een IFC-import de vrije tekst van
  `IfcTask.Identification` (`ifcReader.ts`), terwijl de volgorde in de store dan "samenvattingen eerst" kan zijn
  (ADR 0074). `<WBS>` draagt `wbsCode` alleen als tekst.
- De `<TimephasedData>` van een toewijzing met contour begint bij de rekenstart van de taak (`computedStart`), niet bij
  de getoonde `<Start>` (`shownStart`, de werkelijke start van een gestarte taak). Zo vallen de werkdagen op dezelfde
  dagen als in de eigen resourcebelasting, die vanaf `earlyStart` telt (`taskWorkDayIsos` in `ResourceLoad.ts`), en
  als in de P6 XML-writer (ADR 0365).
