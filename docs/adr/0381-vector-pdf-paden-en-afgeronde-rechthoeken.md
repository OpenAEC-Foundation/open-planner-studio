# Paden in de vector-PDF volgen het canvas, afgeronde hoeken als bezier

De vector-PDF moet dezelfde vormen tekenen als het canvas van de rasterexport en het papier (ADR 0230). `PdfVectorDraw2D`
houdt daarom een pad bij zoals een canvas: `beginPath` maakt het leeg, en pas `fill` of `stroke` tekent het, met de
kleur van dat moment. Na `fill` of `stroke` blijft het pad staan, net als bij een canvas, dus `fill` gevolgd door
`stroke` tekent hetzelfde pad twee keer. Een leeg pad tekent niets. `fillRect` en `strokeRect` raken het pad niet.

`roundRect` zet een nieuw pad klaar, zoals `CanvasDraw2D.roundRect`, en de aanroeper doet daarna `fill`. Het canvas
tekent de hoeken met `arcTo`; de vector-PDF tekent elke hoek als één kubische bezier. Elk controlepunt ligt `KAPPA` ×
straal van een eindpunt van de boog, langs de raaklijn naar het hoekpunt toe (`KAPPA` = 0,5522847498307936, de bekende
benadering van een kwart cirkel; het ontwerp `docs/superpowers/specs/2026-07-22-vector-pdf-export-design.md` §4.1
noemt de bezierhoeken). De stralen komen uit `resolveCornerRadii` (`draw2d.ts`), dezelfde helper als het canvas: per
hoek een straal of één voor alle vier, begrensd op de helft van de kleinste zijde. Een straal 0 geeft een rechte hoek.
Bij een negatieve breedte is het pad leeg en tekent de volgende `fill` niets; het canvas begint dan geen nieuw pad.

## Gevolgen

- Een lijn krijgt bij elke `stroke` opnieuw kleur, dikte en streepjespatroon (fase 0), in logische px.
