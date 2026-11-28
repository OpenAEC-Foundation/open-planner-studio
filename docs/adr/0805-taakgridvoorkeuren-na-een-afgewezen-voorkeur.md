# Taakgridvoorkeuren na een afgewezen voorkeur

Is de opgeslagen taakgridvoorkeur afgewezen (`invalid-fallback`), dan toont de app standaardkolommen en meet ze
geen kolombreedtes automatisch: `hydrateTaskGridPreferences` met `autoWrite: false` zet `taskGridAutoWriteAllowed`
uit, en `applyAutoFitTaskGridColumns` doet dan niets, zodat een automatisch gemeten breedte de afgewezen voorkeur niet
overschrijft. Andere schrijfroutes houdt dit niet tegen (knownbug 2770).
