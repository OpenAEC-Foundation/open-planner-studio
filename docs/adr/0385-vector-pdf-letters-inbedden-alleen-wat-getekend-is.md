# Letters in de vector-PDF: inbedden wat de inventarisatie zag, terugvalletters in twee renders

De rapportletter staat altijd in de PDF, als F0 (gewoon) en F1 (vet). Noto Sans Arabic en de terugvalletters (de
`fallbackFonts` van de aanroeper, zoals Inter achter een andere rapportletter, en daarna de CJK-aanbieders uit
`fontRegistry.ts`) komen er alleen in als de inventarisatie er tekst in zag. Een CJK-letter is volgens het ontwerp
`docs/superpowers/specs/2026-07-22-vector-pdf-export-design.md` (B4) 5 tot 16 MB en wordt daarom per export
gesubset, met HarfBuzz (`subsetFont`); welke tekens erin moeten, weet de pagineerder pas na een render.

De inventarisatie is de render waarop `paginateVectorToPdfBytes` de dekkingspoort toetst (ADR 0384): de eerste render
met de geladen terugvalletters, of de eerste render als er geen geladen is. Wat `PdfVectorDraw2D` daarin bijhoudt,
beslist wat er wordt ingebed:

- `usedArabic`: `fillTextComplex` zette een stuk in Noto. Alleen dan bedt de pagineerder Noto Sans Arabic in (volledig,
  `subset: false`) en zet hij F2/F3 in de resources.
- `usedCjkCodepoints`: per index van een geladen terugvalletter de tekens die zij tekent, behalve tekens die de gewone
  rapportletter zelf heeft (`collectCjkCodepoints`). De pagineerder subset alleen een letter met tekens in die lijst,
  bedt haar in en geeft de geladen terugvalletter met index i (vanaf 0) de sleutels `F(4+2i)` en `F(5+2i)` (gewoon en
  vet). Een geladen letter zonder tekens wordt niet ingebed.

## Gevolgen

- Een `CjkVectorFont` heeft altijd zijn fontkit-letters voor dekking en meting; zijn ingebedde letters en sleutels
  (`embed`) krijgt hij pas na de inventarisatie. Tekst langs de weg van de terugvalletters (ADR 0384, weg 2) komt alleen
  in de PDF als elke letter in de lijst ingebed is (`cjkEmbedReady`); anders verzamelt `fillText` alleen de tekens. Zag
  de inventarisatie zulke tekst (`usedCjk`), dan tekent de pagineerder na het inbedden opnieuw, en die render levert de
  PDF. Bleef een geladen letter zonder tekens, dan tekent die render de tekst niet, terwijl de andere letters al
  ingebed zijn (knownbug 2450).
- De pagineerder laadt een aanbieder pas als haar `covers` een teken raakt dat de eerste render zonder terugvalletters
  ongedekt liet; een aanbieder die niet laadt, wordt overgeslagen en haar tekens blijven ongedekt.
- Een stuk in een terugvalletter staat op de opgetelde breedte van de stukken ervoor (`fallbackRunWidth`, dezelfde
  meting als `measureText`). `splitFallbackRuns` geeft de rapportletter voorrang: een teken dat haar gewone letter
  heeft, blijft bij haar, ook in een tekst met CJK.
- De tekenaar leest de fontkit-letter van een ingebedde rapportletter uit een intern veld van pdf-lib (`fontkitOf`),
  net als `embedReportFont`; om die interne velden staat pdf-lib exact op 1.17.1 (regel `reports`).
- `check-report-font.ts`: B1 en B4 eisen bij Inter zonder Arabisch alleen de twee Inter-letters en geen subset; B3 eist
  bij een smalle letter met Inter als terugval F4 op de eerste bladzijde, en in de subset van Inter `Ф`, `≤` en `a` maar
  geen spatie of cijfer; C2 eist per meegeleverde letter behalve Inter dat het vinkje (U+2713) in de subset van Inter
  staat.
