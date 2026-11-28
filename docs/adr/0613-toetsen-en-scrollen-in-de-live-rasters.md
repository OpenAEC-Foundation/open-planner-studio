# Toetsen en scrollen in de live rasters

De resourcetabel en de fasentabel van het contourvenster zijn formulierrasters: elke bewerkbare cel is altijd een
echt invoerveld, en de cursor is de focus van de DOM. Het taakraster is een spreadsheet met één editor tegelijk en een
cursor in React-state. Die twee mechanieken zijn bewust niet samengevoegd; het taakraster heeft zijn eigen toetsbeleid
(`resolveTaskGridCommand`) en deelt met `src/utils/gridNavigation.ts` alleen `GridKeyEventLike`.

In een live raster (`liveGridNavDirection`) navigeren ↑ en ↓ alleen vanuit een tekstveld: in een `<select>` kiezen
ze een optie en in een getalveld stappen ze de waarde, en dat gedrag afpakken zou de kalender-, type- en ploegkolom
en de spinner van de maximale eenheden onbruikbaar maken. Enter en Shift+Enter navigeren overal.

## Gevolgen

- `scrollDeltaToReveal` rekent het scrollen zelf uit in plaats van op `focus()` te leunen. Bij doorlopend invoeren
  met Enter houdt hetzelfde naamveld de focus, dus `focus()` scrolt niet, en zakte de rij onder de rand van het
  venster. De marge voor de kopregel (`stickyHeaderHeight`) is nodig omdat de kolomkoppen `sticky` zijn; zonder die
  marge parkeert het scrollen een rij onder de kop.
