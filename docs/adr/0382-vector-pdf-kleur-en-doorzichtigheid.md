# Kleur en doorzichtigheid in de vector-PDF

De render geeft kleuren als CSS-tekst, onder meer met een doorzichtigheid achter de hex-code geplakt (`'#10B981' + '40'`,
ontwerp `docs/superpowers/specs/2026-07-22-vector-pdf-export-design.md` §4.1). `parseColor`
(`src/services/pdf/pdfVectorDraw2d.ts`) leest vijf vormen: `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb(…)` en `rgba(…)`, en geeft
rood, groen, blauw en alfa als getallen van 0 tot 1 (de kanalen gedeeld door 255, de alfa van `rgba` zoals hij er staat).
Een kanaal of alfa in `rgb`/`rgba` dat geen getal is, wordt 0. Elke andere vorm (een kleurnaam, `#rgba`, `hsl(…)`) tekent ondoorzichtig zwart;
volgens het weggehaalde commentaar komt zo'n vorm in de renderer niet voor.

PDF zet doorzichtigheid niet in de kleur maar in een ExtGState. Bij een alfa onder 1 zetten `paintFill`, `paintStroke` en
`pushText` de vorm of de tekst tussen `q` en `Q`, met `gs` op de sleutel uit `registerAlpha` van de pagineerder. Die
(`createResourcePool` in `paginateVector.ts`) rondt de alfa af op drie decimalen, maakt per afgeronde waarde één ExtGState
met dezelfde waarde voor vullen en lijnen (`ca` en `CA`) en geeft sleutels `GA0`, `GA1` en verder. Bij alfa 1 komt er geen
`q`/`Q` en geen ExtGState. De `Q` sluit de doorzichtigheid af, zodat een volgende vorm er niet onder valt.
