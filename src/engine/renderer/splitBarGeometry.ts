// Z15 → B1c-W0: de wandeling zelf leeft in `engine/scheduler/splitWalk.ts` (één bron voor
// renderer, print, lastlezer en nivelleerder — zie dat moduleheader voor de H1-as-semantiek,
// dag/uur-modus-keuze, overlap-samenvoeging en taakeinde-klem). Deze module blijft de import-plek
// voor de tekenpaden (`GanttRenderer`, `printPreview`) — puur re-export, geen eigen logica meer.
//
// O5 (orkestratorbesluit 2026-08-17, plan-§10): een ECHTE split (`Task.splitGaps`, uit een
// .mpp-import afgeleid) tekent ALTIJD gesplitst — een werkonderbreking is DATA, geen
// weergavevoorkeur. `barSplitMode`/`shouldSplit` (GanttRenderer) blijven daarom UITSLUITEND de
// kalender-necking sturen (de calendar-only "toon werkblokken"-weergave); een taak met
// `splitGaps` bereikt die tak nooit. Deze module weet niets van `barSplitMode` — dat blijft aan
// de aanroeper.
export { computeSplitSegments, type SplitSegmentBounds } from '@/engine/scheduler/splitWalk';
