// De wandeling zelf leeft in `engine/scheduler/splitWalk.ts` (één bron voor renderer, print,
// lastlezer en nivelleerder — zie dat moduleheader voor de as-semantiek, dag/uur-modus-keuze,
// overlap-samenvoeging en taakeinde-klem). Deze module is de import-plek voor de tekenpaden
// (`GanttRenderer`, `printPreview`) — puur re-export, geen eigen logica.
//
// Een ECHTE split (`Task.splitGaps`, uit een
// .mpp-import afgeleid) tekent ALTIJD gesplitst — een werkonderbreking is DATA, geen
// weergavevoorkeur. `barSplitMode`/`shouldSplit` (GanttRenderer) blijven daarom UITSLUITEND de
// kalender-necking sturen (de calendar-only "toon werkblokken"-weergave); een taak met
// `splitGaps` bereikt die tak nooit. Deze module weet niets van `barSplitMode` — dat blijft aan
// de aanroeper.
export { computeSplitSegments, type SplitSegmentBounds } from '@/engine/scheduler/splitWalk';
