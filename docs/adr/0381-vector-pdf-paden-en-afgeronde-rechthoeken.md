# Paden in de vector-PDF volgen het canvas, afgeronde hoeken als bezier

De vector-PDF moet dezelfde vormen tekenen als het canvas van de rasterexport en het papier (ADR 0230). `PdfVectorDraw2D`
houdt daarom een pad bij zoals een canvas: `beginPath` maakt de buffer leeg, `moveTo`, `lineTo` en `closePath` voegen
er de omgeklapte pad-operatoren aan toe (ADR 0380), en pas `fill` of `stroke` zet de buffer met de kleur van dat moment
in de stroom (`paintFill`, `paintStroke`). Na `fill` of `stroke` blijft de buffer staan, net als het pad van een canvas,
dus `fill` gevolgd door `stroke` tekent hetzelfde pad twee keer. Een lege buffer tekent niets. `fillRect` en `strokeRect`
raken de buffer niet.

`roundRect` zet een nieuw pad klaar, zoals `CanvasDraw2D.roundRect`, en de aanroeper doet daarna `fill`. Het canvas
tekent de hoeken met `arcTo`; PDF kent geen boog, dus elke hoek is één kubische bezier met de controlepunten op
`KAPPA` × straal van het hoekpunt af (`KAPPA` = 0,5522847498307936, de bekende benadering van een kwart cirkel; het
ontwerp `docs/superpowers/specs/2026-07-22-vector-pdf-export-design.md` §4.1 noemt de bezierhoeken). De stralen komen
uit `resolveCornerRadii` (`draw2d.ts`), dezelfde helper als het canvas: per hoek een straal of één voor alle vier,
begrensd op de helft van de kleinste zijde. Een straal 0 geeft een rechte hoek. Bij een negatieve breedte is het pad leeg
en tekent de volgende `fill` niets; het canvas begint dan geen nieuw pad.

## Gevolgen

- Een lijn krijgt bij elke `stroke` opnieuw kleur, dikte (`lineWidth`) en streepjespatroon (`setLineDash`, fase 0),
  in logische px. `setLineDash` bewaart een kopie van de lijst.
