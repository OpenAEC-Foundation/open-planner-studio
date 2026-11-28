# Baseline op de getoonde datums

`saveBaseline` (`baselineSlice.ts`) legt per bladtaak de getoonde datums vast (`shownStart`/`shownFinish`): voor een
gestarte taak haar werkelijke start, voor een voltooide haar werkelijke einde, en niet de berekende datums. De
afwijking (`variance.ts`) rekent ook op de getoonde datums, dus direct na het opslaan van een baseline is ze nul. Volgens
het weggehaalde commentaar doen MS Project en P6 het ook zo (niet nagegaan). Vóór de eerste berekening vallen de
getoonde datums terug op de planningsdatums.
