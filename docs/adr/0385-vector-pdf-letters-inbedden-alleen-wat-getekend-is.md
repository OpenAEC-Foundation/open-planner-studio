# Letters in de vector-PDF: alleen inbedden wat getekend is, terugvalletters in twee renders

De rapportletter staat altijd in de PDF, als F0 (gewoon) en F1 (vet). Noto Sans Arabic en de terugvalletters (de
`fallbackFonts` van de aanroeper, zoals Inter achter een andere rapportletter, en daarna de CJK-aanbieders uit
`fontRegistry.ts`) komen er alleen in als er tekst in getekend is. Een CJK-letter is volgens het ontwerp
`docs/superpowers/specs/2026-07-22-vector-pdf-export-design.md` (B4) 5 tot 16 MB en wordt daarom per export
gesubset, met HarfBuzz (`subsetFont`); welke tekens erin moeten, weet de pagineerder pas na een render. Noto of een
terugvalletter zonder getekende tekst staat ook niet in de resources van de bladen.

`PdfVectorDraw2D` houdt daarvoor bij wat het tekende:

- `usedArabic` wordt waar zodra `fillTextComplex` een stuk in F2 of F3 zet. Alleen dan bedt `paginateVectorToPdfBytes`
  Noto Sans Arabic in (volledig, `subset: false`) en zet F2/F3 in de resources.
- `usedCjkCodepoints` verzamelt per index van de terugvalletter de tekens die zij tekent, behalve tekens die de gewone
  rapportletter zelf heeft (`collectCjkCodepoints`); `usedCjk` wordt dan waar. De pagineerder subset per letter met die
  tekens en geeft de geladen terugvalletter met index i (vanaf 0) de sleutels `F(4+2i)` en `F(5+2i)` (gewoon en vet).

## Gevolgen

- Een `CjkVectorFont` heeft altijd zijn fontkit-letters (`fk`, `fkBold`) voor dekking en meting, en pas in de render
  na het inbedden een `embed` met de ingebedde letters en hun sleutels. Tekst langs de weg van de terugvalletters
  (ADR 0384, weg 2) komt alleen in de PDF als elke letter in de lijst een `embed` heeft (`cjkEmbedReady`); anders
  verzamelt `fillText` alleen de tekens. Is er zo tekst verzameld (`usedCjk`), dan bedt de pagineerder in en tekent hij
  opnieuw; die render levert de PDF (knownbug 2450).
- De pagineerder laadt een aanbieder pas als haar `covers` een teken raakt dat de eerste render zonder terugvalletters
  ongedekt liet; een aanbieder die niet laadt, wordt overgeslagen en haar tekens blijven ongedekt (`paginateVector.ts`).
- Een stuk in een terugvalletter gaat net als de rapportletter door `laidOutTextOps`, op de opgetelde breedte van de
  stukken ervoor (`fallbackRunWidth`, dezelfde meting als `measureText`). `splitFallbackRuns` geeft de rapportletter
  voorrang: een teken dat haar gewone letter heeft, blijft bij haar, ook in een tekst met CJK.
- De tekenaar leest de fontkit-letter van een ingebedde rapportletter uit een intern veld van pdf-lib
  (`embedder.font`, in `fontkitOf`), net als `embedReportFont`; om die interne velden staat pdf-lib exact op 1.17.1
  (regel `reports`).
- `check-report-font.ts` B1 en B4 eisen bij Inter zonder Arabisch alleen de twee Inter-letters en geen subset; B3 eist
  bij een smalle letter met Inter als terugval F4 op het blad, en in de Inter-subset `Ф`, `≤` en `a` maar geen spatie of
  cijfer (die heeft de smalle letter zelf).
