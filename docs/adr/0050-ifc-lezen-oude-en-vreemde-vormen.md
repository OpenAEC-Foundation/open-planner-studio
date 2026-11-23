# De IFC-lezer leest de oude eigen indelingen van taak en lag, en duren met dagen en tijd

Oudere OPS-versies schreven `IFCTASK` en `IFCLAGTIME` anders dan het schema. Die bestanden staan bij gebruikers en
moeten zonder verlies blijven openen, dus de lezer herkent beide indelingen aan de argumenten, net als bij werkplan,
werkschema en kalender (`ifcWorkControlSlots.ts`, zie `docs/ifc-round-trip.md`). Bestanden van andere programma's
kunnen bovendien duren met dagen vóór de `T` dragen (`P2DT12H`), die de eigen writer nooit schrijft.

## Gevolgen

- `IFCTASK` met precies 12 argumenten is de oude eigen indeling zonder `WorkMethod`: IsMilestone, Priority, TaskTime
  en PredefinedType staan één plek eerder. Elk ander aantal is het schema (13). De lezer schuift alleen die vier
  plekken; `GlobalId`, `Name`, `Description`, `Identification` en `Status` (vóór `WorkMethod`) schuiven niet.
- `IFCLAGTIME` in het schema draagt de waarde als getypte select (`IFCDURATION('P2D')`, `IFCRATIOMEASURE(0.5)`) en
  daarna het duurtype; de oude eigen indeling had ze omgewisseld (`.WORKTIME.`, dan `'P0Y0M2D'`). Welk slot de
  waarde draagt, kiest `lagValueSlot`, gedeeld met de verliescontrole van de merge. Een ratio wordt een percentage,
  afgerond op zes decimalen tegen rekenruis.
- Een lag of duur met dagen vóór de `T`: `isoDurationToMinutes` leest alleen het deel na `T`. De lezer telt de dagen
  erbij met de minuten per dag die bij het veld horen: voor een lag `ELAPSEDTIME` 1440, anders de werktijd per dag
  van de lagkalender (`schedulingOptions.lagCalendar`); voor duur, rest en speling van een taak de minuten per dag
  van de taak. Het sub-dag-signaal voor de uurmodus (ADR 0043) blijft het deel na `T`.
- Toetsen: `check-ifc-duur-lezen.ts`, `check-ifc-duurvormen.ts` (ook de oude lagindeling, `lag-oud`).
