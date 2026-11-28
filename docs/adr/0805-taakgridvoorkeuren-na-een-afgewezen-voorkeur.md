# Taakgridvoorkeuren na een afgewezen voorkeur

Is de opgeslagen taakgridvoorkeur afgewezen (`invalid-fallback`), dan toont de app standaardkolommen maar schrijft
ze zelf niets weg: `hydrateTaskGridPreferences` met `autoWrite: false` zet `taskGridAutoWriteAllowed` uit, en
`applyAutoFitTaskGridColumns` doet dan niets. De afgewezen voorkeur blijft zo onaangeroerd bewaard; een automatisch
gemeten kolombreedte zou haar anders overschrijven. Een keuze van de gebruiker schrijft wel.
