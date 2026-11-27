# Vector-PDF: de weigering wordt herkend aan haar naam

`VectorUnsupportedError` (`paginateVector.ts`) zet `name` vast op `'VectorUnsupportedError'`, en
`describeVectorFallback` (`exportGanttReportPdf.ts`) herkent de fout aan die naam, niet met `instanceof`. De aanroepers
laden `paginateVector.ts` met een dynamische `import()`, zodat pdf-lib en fontkit niet in de hoofdbundel komen; met de
naam hangt `describeVectorFallback` niet van de klasse af. De naam is daarom deel van het contract. De terugval op
raster zelf hangt er niet van af: de aanroepers vangen elke fout van de vector-PDF (ADR 0384); de naam bepaalt alleen
wat er gelogd wordt.
