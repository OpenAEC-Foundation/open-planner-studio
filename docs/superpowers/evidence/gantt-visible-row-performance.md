# Gantt: tekenlussen tot het zichtbare rijbereik beperken

De uitgangsrevisie is `fbd4a3f9dcc7bdd308ab86b992d0b26f4670a553`.
Deze wijziging raakt uitsluitend het rijbereik van drie tekenlussen in `GanttRenderer`:
horizontale rasterlijnen, taakbalken en de voortgangslijn. De bestaande voorwaarden binnen
de lussen beslissen nog steeds welke rijen worden getekend. Er worden geen datums, assen,
pijlroutes, balkgeometrie of hit-testregels gewijzigd.

Bij scrollen, zoomen of selecteren werd eerst voor iedere rij de y-positie berekend om daarna
te beslissen of die rij buiten beeld viel. Met de voortgangslijn aan zijn dit drie volledige
scans per frame. De kandidaatrijen worden nu vooraf begrensd tot de viewport plus enkele
rijen marge. Het raster houdt zijn extra lijn onder de laatste rij. De bestaande
obstakelindex voor relaties gebruikte deze begrenzing al en blijft ongewijzigd.

## Bewijs dat lokaal is gecontroleerd

Een onafhankelijke Python-rekenprobe vergeleek de geselecteerde rij-indexen van de oude
afkapvoorwaarden met de nieuwe begrenzing voor 45.000 laag-/invoercombinaties: 0–10.000
rijen, vijf rijhoogtes, verschillende header-/canvashoogtes, fractionele scrollposities,
exacte rijranden en een scrollpositie voorbij de laatste rij. Alle geselecteerde indexen
waren exact gelijk; proces-exitcode 0. Dit bewijst de geteste rijrekenkunde, niet de
uitvoering van de TypeScript-renderer of de browser.

`git diff --check` is lokaal uitgevoerd met exitcode 0. Er zijn lokaal geen Node-, npm-,
npx-, build-, test- of browserprocessen gestart.

## Regressiecontrole in CI

De bestaande `check-render-caches.ts` vergelijkt de volledige canvasaanroepen zonder
afronding met een referentierender die dezelfde drie lagen weer volledig laat scannen.
De matrix bevat 42 combinaties van rijhoogte, scrollpositie en kalender-/werkdagenas,
plus lege, enkele en grote rijlijsten. Ze bevat bandkoppen, samenvattingen, mijlpalen,
splits, selectie, voortgang en alle vier relatietypen, inclusief relaties waarvan beide
eindpunten buiten beeld liggen. Klik- en splitsgrenzen worden afzonderlijk vergeleken.
Een deterministisch werkbudget vereist minder dan 200 `rowToY`-aanroepen bij zowel 1.000
als 10.000 rijen. Er is geen tijdsdrempel in de normale regressiesuite.

De bestaande browserroute `Gantt viewport: primary wheel volgt drag, modifier en position
mode` is uitgebreid met een echte klik op een taakbalk na echt verticaal wielscrollen.
De bestaande RTL-, werkdagenas- en pijlkniptests blijven onderdeel van de normale CI.

## Afzonderlijke vergelijking tussen bronrevisies

De begrensde workflow `Gantt-rijbereik meten` bundelt dezelfde testinvoer eenmaal met de
echte renderer uit de merge-base en eenmaal met de renderer uit de PR-head. Zij weigert
andere gewijzigde `src/`-bestanden: de meting isoleert alleen deze renderer. De automatische
trigger kijkt daarom alleen naar de eigen meettest en workflow, zodat latere productwijzigingen
deze specifieke oude nulmeting niet onbedoeld erven.

De workflow draait twee meetparen in omgekeerde volgorde. Iedere revisie warmt vijf renders
op en meet vijftien renders per schaal. Het artifact `renderer-performance` bevat exacte
revisies, invoer-/teken-/hithashes, aantallen rijpositieberekeningen en individuele tijden.
De vergelijking faalt bij afwijkende invoer, tekenuitvoer of hitdetectie, of als het aantal
rijpositieberekeningen niet afneemt. De timing omvat rendererconstructie plus renderen
tegen een opnemende canvascontext; zij meet geen echte browserframetijd of GPU-werk.

Bij het opstellen van dit document waren deze CI-controles nog niet uitgevoerd. Er wordt
daarom nog geen gemeten snelheidswinst of groene TypeScript-/browsercontrole geclaimd.
