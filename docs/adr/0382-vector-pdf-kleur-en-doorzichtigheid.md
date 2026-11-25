# Kleur en doorzichtigheid in de vector-PDF

De render geeft kleuren als CSS-tekst, onder meer met een doorzichtigheid achter de hex-code geplakt (`'#10B981' +
'40'`, ontwerp `docs/superpowers/specs/2026-07-22-vector-pdf-export-design.md` §4.1). `parseColor`
(`src/services/pdf/pdfVectorDraw2d.ts`) leest vijf vormen: `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb(…)` en `rgba(…)`. De
kanalen worden gedeeld door 255, de alfa van `rgba` blijft zoals hij er staat; geldige invoer binnen het bereik van
CSS geeft zo getallen van 0 tot 1. `parseColor` begrenst niets: een kanaal buiten 0 tot 255 of een alfa buiten 0 tot 1
in `rgb`/`rgba` geeft een waarde buiten 0 tot 1. Een kanaal of alfa in `rgb`/`rgba` dat geen getal is, wordt 0. Elke
andere vorm (een kleurnaam, `#rgba`, `hsl(…)`) tekent ondoorzichtig zwart; volgens het weggehaalde commentaar komt
zo'n vorm in de renderer niet voor.

Een alfa onder 1 gaat via een ExtGState: de vorm of tekst komt met haar eigen grafische toestand in de stroom, met de
sleutel uit `registerAlpha` van de pagineerder, en die toestand eindigt direct erna, zodat een volgende vorm niet
doorzichtig wordt. De pagineerder (`createResourcePool` in `paginateVector.ts`) rondt de alfa af op drie decimalen en
maakt per afgeronde waarde één ExtGState, met dezelfde waarde voor vullen en lijnen. Bij alfa 1 komt er geen
ExtGState.
