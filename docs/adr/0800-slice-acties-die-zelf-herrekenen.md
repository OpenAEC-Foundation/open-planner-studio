# Slice-acties die zelf herrekenen

Scheduling is handmatig, maar een paar acties rekenen na hun mutatie zelf door: `moveProject` (`projectSlice.ts`),
`applyProjectInfo` bij een ander rekenprofiel (`schedulingProfileSlice.ts`),
`applyLeveling` en `clearLeveling` (`scheduleSlice.ts`). Ze roepen toch `finishMutation` met `stale: true` aan, ook al
wist de `runCPM` erna de vlag meteen weer. `stale` is het signaal waarop de mutatie de modus "datums zoals opgeslagen"
verlaat. Zonder dat signaal verlaat `runCPM` de modus in een eigen producer met een eigen undo-snapshot: twee stappen
voor één bewerking, met daartussen een stand die de gebruiker nooit zag. Met het signaal blijft het één undo-stap.

## Gevolgen

- `setProject` rekent alleen door als de nieuwe projectstart werkelijk wortel-ankers klemde, zodat de melding
  "meegeschoven" klopt op het moment dat ze verschijnt.
- `moveProject` verschuift elk taakanker zelf en zet de nieuwe startdatum exact, niet als oude start plus het
  verschil: de projectstart is geen ondergrens voor het eigen anker van een wortel-taak (ADR 0011), en een start met
  tijd zou anders verlopen.
