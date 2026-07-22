# Vector-PDF-export — ontwerpdoc

**Datum:** 2026-07-22
**Issue:** #23 "Support vector PDF export support"
**Status:** ontwerp (nog niet geïmplementeerd)
**Ontwikkelbranch:** `claude/vector-pdfs-investigation-15da01`

---

## 1. Context & probleem

De rapport-export produceert nu een PDF met een **ingebedde raster-JPEG**. De hele Gantt
(staven, grid, afhankelijkheden, mijlpaal-ruiten, tabel, tekst) wordt imperatief op een
`<canvas>` getekend (`src/services/print/printPreview.ts` → `renderPrintCanvas`), dat canvas
wordt in papiertegels gesneden (`src/services/print/paginate.ts`), elke tegel wordt een JPEG en
`src/utils/miniPdf.ts` `buildImagePdf()` bedt die JPEG paginavullend in als een `DCTDecode`-image.
De mijlpalen- en afwijkingen-rapporten gaan via `modern-screenshot` (DOM → canvas) door dezelfde
tegel/JPEG-pijplijn.

Gevolg (uit de issue): print is niet scherp en inzoomen pixelt. Gewenst: **echte vectorgraphics**
met scherpe lijnen op elke schaal en — waar haalbaar — **selecteerbare/doorzoekbare tekst**.

## 2. Doel & scope

**"Af"** = de PDF-export levert vectorgraphics met ingebedde, gesubsette fonts en selecteerbare
tekst voor het Gantt-rapport én de twee tabel-rapporten (mijlpalen, afwijkingen), met correcte
weergave voor alle 14 locales. **Check**: (a) de geëxporteerde PDF bevat PDF-tekstoperators
(`BT`/`Tj`) en ingebedde font-objecten i.p.v. één grote `DCTDecode`-image; (b) tekst is
selecteerbaar in een PDF-viewer; (c) inzoomen pixelt niet; (d) de bestaande groene poort
(`npm run build`, `bash tests/planning/run.sh`) blijft groen; (e) preview blijft WYSIWYG t.o.v. de
export.

**In scope (v1):**
- Gantt-rapport volledig vector via een `Draw2D`-abstractie + PDF-vector-backend.
- Mijlpalen- en afwijkingen-rapporten als data-gedreven vector-tabellen (geen DOM-screenshot meer).
- Ingebedde gesubsette fonts: Latijn/Cyrillisch/Grieks (Inter) + CJK (Noto Sans CJK, lazy).
- Vector-paginering (clip + transform per pagina) met behoud van de bevroren-naam-kolom-herhaling.

**Bewust buiten v1 (met promotiepad in v2):**
- **Arabisch/Farsi (ar/fa) blijven via de bestaande raster-JPEG-export** — zie §5.4. Reden: correcte
  RTL-vectortekst vergt een zelfgebouwde bidi-runlayout bovenop `bidi-js`; dat is de grootste
  engineering- en testlast van het hele project. De browser rendert RTL al perfect naar canvas, dus
  de raster-PDF is visueel correct; het enige verlies is niet-selecteerbare tekst voor 2 van de 14
  locales. **Dit is een afwijking van de oorspronkelijke "alle locales vector"-wens en staat als
  open besluit in §10.**
- Volledige per-run font-fallback voor willekeurig gemengde scripts binnen één string (§5.3).

### 2.1 Waarom vector — en niet alleen hogere DPI

Belangrijk om eerlijk vast te leggen (uit de kritische review): de huidige raster-export is **al
~220 DPI**, niet 96 (`computeHighResScale(targetDpi=220, minScale=1.5)`, `miniPdf.ts:263-277`,
begrensd op 24 MP). "Scherp printen" is voor A4/A3 daarmee grotendeels al opgelost; alleen A1 zakt
door de MP-cap naar ~170 DPI. Wat raster **fundamenteel niet** kan is (i) oneindig inzoomen zonder
pixelatie en (ii) **selecteerbare/doorzoekbare tekst**. Punt (ii) is de eigenlijke kostendrijver van
dit hele plan.

**Gekozen richting (bevestigd door de user):** volledige vector mét selecteerbare tekst — de user
koos expliciet "ingebedde gesubsette fonts" en "Gantt + alle rapporten". De goedkopere alternatieven
zijn afgewogen en bewust niet gekozen; ze staan gedocumenteerd in §10.1 zodat de afweging
navolgbaar blijft.

## 3. Besluiten (met onderbouwing)

| # | Besluit | Onderbouwing |
|---|---------|--------------|
| B1 | **`pdf-lib` + `@pdf-lib/fontkit`** als vector-PDF-generator, i.p.v. `miniPdf` uitbreiden of `jspdf`. | pdf-lib doet al Type0/CID (`Identity-H`) font-embedding **met subsetting via fontkit** (`embedFont(bytes,{subset:true})`), is browser-native (de fork bestaat juist om Node-`fs`/`Buffer` te vermijden), en is MIT (compatibel met LGPL-3.0). Zelf TrueType-subsetting + CID/Type0 + `cmap`/`GSUB` schrijven is honderden correctheidsgevoelige regels — precies wat fontkit betrouwbaar doet. `jspdf` heeft zwakkere subsetting en slechts partiële RTL. |
| B2 | **Lazy `import()`** van pdf-lib/fontkit in de exporttak, niet in de hoofdbundle. | ~530 KB gzip (pdf-lib 178 KB + fontkit 342 KB). Volgt het bestaande patroon (`App.tsx` importeert de Tauri-auto-save dynamisch). De export is een gebruikersactie, geen opstartpad. |
| B3 | **Inter als TTF meeleveren** (raw `.ttf` uit `rsms/inter`, OFL-1.1), niet de `@fontsource/inter`-woff2. | `@fontsource/inter` levert alleen woff2/woff + CSS, geen `.ttf`. Voor embedding is TTF/OTF nodig; of `@pdf-lib/fontkit` in-browser woff2 (brotli) decodeert is **ongeverifieerd** — dus veiligste route = raw TTF. Inter dekt Latijn + Cyrillisch + Grieks ⇒ 9 Latijnse locales met één font. Vervangt de systeem-font-stack `FONT_FAMILY` (`printPreview.ts:38`), die per platform verschilt en niet inbedbaar is. |
| B4 | **CJK via Noto Sans CJK in TTF (glyf), region-specifiek, lazy-fetch** als static asset. | CFF/OTF-subsetting is over de hele linie kapot (pdf-lib #664, TCPDF #826, OpenPDF #71 → onzichtbare tekst). pdf-lib subset werkt betrouwbaar op glyf-outlines (TTF). Volledige CJK-font = 5–16 MB, dus niet bundelen: `fetch()` alleen bij export van een document met CJK-glyphs; subset embed alleen de ~honderden gebruikte glyphs (orde tientallen–honderd KB in de PDF). Horizontale CJK heeft **geen** shaping nodig — simpele codepoint→glyph via Type0/CID. |
| B5 | **ar/fa via raster-fallback in v1** (bestaande miniPdf-pad); vector met `bidi-js` in v2. | fontkit shapet Arabisch (joining/ligaturen) al, maar doet **geen bidi-reordering** — dat is zelfbouw. Grote lift + testlast (mixed met cijfers/Latijnse namen). Raster = nul extra werk, vandaag visueel correct. `harfbuzz` is niet nodig (fontkit shapet even goed) en zou 390 KB wasm toevoegen. |
| B6 | **Draw2D-abstractie** met twee backends (canvas voor preview, PDF-vector voor export); `renderPrintCanvas` tekent tegen `Draw2D` i.p.v. rechtstreeks `ctx`. | De renderer gebruikt een gesloten set van ~14 primitieven (geen gradients/clipping/composite). Eén renderer, twee backends houdt preview en export gegarandeerd in sync. |
| B7 | **Tabellen als data-gedreven vector** (route a), niet DOM→vector (route b). | `useMilestoneRows()`/`useVarianceResult()` leveren al pure rij-data en worden al in `ReportPanel` aangeroepen (`:131-132`). Een generieke `PdfTable(columns, rows)`-renderer bovenop Draw2D geeft selecteerbare tekst + gedeelde font/kleur-infra. DOM→vector zou een HTML/CSS-engine vergen en vecht met thema-kleuren (de `data-theme='light'`-hack in `ReportPanel.tsx:198-205`). |

## 4. Architectuur

```
                         ┌─────────────────────────────┐
   renderPrintCanvas ───▶│   Draw2D (interface)        │
   PdfTable          ───▶│  fillRect/strokeRect/path/  │
                         │  fill/stroke/text/measure/  │
                         │  style-setters/roundRect    │
                         └──────────┬─────────┬────────┘
                                    │         │
                     ┌──────────────▼──┐  ┌───▼──────────────────┐
                     │ CanvasDraw2D    │  │ PdfVectorDraw2D      │
                     │ (preview/raster)│  │ (pdf-lib operators)  │
                     └─────────────────┘  └───┬──────────────────┘
                                              │
                              ┌───────────────▼───────────────┐
                              │ vector-pagineerder            │
                              │ (clip+transform per pagina,   │
                              │  tegelwiskunde uit paginate.ts)│
                              └───────────────┬───────────────┘
                                              ▼  Uint8Array (PDF)
                                         writePdf()  (ongewijzigd)
```

### 4.1 `Draw2D`-interface (nieuw)

Minimale gesloten set die `printPreview.ts` volledig dekt (geverifieerde inventaris):

- **Rects:** `fillRect(x,y,w,h)`, `strokeRect(x,y,w,h)`
- **Paths:** `beginPath()`, `moveTo(x,y)`, `lineTo(x,y)`, `closePath()`, `fill()`, `stroke()`,
  `roundRect(x,y,w,h,r)` (convenience; canvas-backend gebruikt `arcTo`, PDF-backend bezier-hoeken —
  `arcTo` wordt **niet** los geëxposeerd)
- **Tekst:** `fillText(text,x,y)`, `measureText(text): {width}` — **backend-geleverd**: canvas →
  `ctx.measureText`, PDF → `font.widthOfTextAtSize`
- **Style-setters:** `font`, `fillStyle`, `strokeStyle`, `lineWidth`, `textAlign`, `textBaseline`,
  `setLineDash`
- **Geen** `scale`/`setTransform` in de interface: de canvas-backend zet de dpr-scale intern; de
  PDF-backend werkt 1:1 in logische px.

Lastige gevallen die de PDF-backend moet afhandelen:
- **Kleur-parsing** naar `{r,g,b,a}`: hex6 (`#rrggbb`), hex8 (`'#10B981'+'40'` → alpha ≈ 0.25) en
  `rgba(...)`. Alpha via PDF `ExtGState` `/ca` (fill-alpha).
- **`textBaseline`** (`middle`/`alphabetic`/`bottom`) + **`textAlign`** (`left`/`right`/`center`):
  PDF plaatst op de baseline; `middle`/`bottom` omrekenen via font-ascent/descent, align via
  `x -= width * {0|0.5|1}`. Beide leunen op de ingebedde-font-metrics.
- **`setLineDash([5,3])`** (today-lijn): PDF `d`-operator (`[5 3] 0 d`).

### 4.2 `PdfVectorDraw2D`-backend (nieuw)

Bouwt bovenop pdf-lib's **low-level content-operators** (`page.pushOperators(...)` met de
operator-helpers), niet alleen de high-level `page.draw*`-helpers, voor volledige pad-controle
(dependency-routes, ruiten, driehoeken, afgeronde staven). De review verifieerde dat `operators.ts`
(pdf-lib master) alle benodigde operators levert: `clip`/`clipEvenOdd` (W/W*), `setDashPattern`
(d), `setGraphicsState` (gs → ExtGState `/ca`-alpha), `concatTransformationMatrix` (cm),
`appendBezierCurve` (c), `moveTo`/`lineTo`/`fill`/`stroke`/`fillAndStroke`/`closePath`/`endPath`,
`pushGraphicsState`/`popGraphicsState`, `setLineWidth`. **De aanname "operator-API bestaat" is dus
al geretired** — de kleur-parser mapt naar `setFillingRgbColor`/`setStrokingRgbColor` (er is géén
generieke `setFillingColor`). Houdt per pagina één content-stream bij.

**Tekst-operators i.p.v. `page.drawText` (K9):** `page.drawText` beheert zelf `BT`/`ET` +
tekstmatrix + font-resource en is lastig correct te nesten binnen een zelfbeheerde
graphics-state/clip. Gebruik voor de vector-backend de **low-level `showText`-operators** binnen de
eigen `q … Q`-wrapper voor volledige controle.

### 4.3 Vector-pagineerder (nieuw, naast bestaande `paginate.ts`)

`paginateVectorToPdfBytes(draw, opts)` hergebruikt **1:1 de tegelwiskunde** van
`paginateCanvasToTiles` (`paginate.ts`): `PAPER_PT`, marges/`FOOTER_PT`, `fit-width` vs `actual`
schaal, rij-tegels, kolom-tegels met bevroren-naam-kolom-herhaling, bron-venster per tegel. Het
verschil: een "tegel" wordt een **PDF-pagina met clip-rechthoek + translate/scale op de
content-stream** (`q … cm … W n`) i.p.v. een `drawImage`-crop. De bevroren strip wordt op
kolommen k>0 als tweede getekend blok herhaald (exact de logica van `paginate.ts:159-179`, maar via
transform). Today-lijn, gestippelde randen etc. tegelen mee als vector.

De bestaande raster-functies (`paginateCanvasToTiles`, `paginateCanvasToPdfBytes`, `buildImagePdf`)
**blijven bestaan** — ze voeden de preview en de ar/fa-raster-fallback.

**G1 — kostenstructuur klapt om t.o.v. raster (kritisch).** Bij raster tekent `renderPrintCanvas`
**één keer** naar een bitmap en maakt `paginate.ts` per tegel goedkope `drawImage`-crops. Bij vector
is er geen bitmap om te croppen: naïef zou je de **volledige** operator-lijst per pagina opnieuw
plaatsen, en door de frozen-kolom-herhaling zelfs twee keer per kolom k>0 → O(tegels × taken×dagen)
i.p.v. O(taken×dagen) + O(tegels). Een A1-`actual`-planning tekent per dag grid-lijnen + weekend-
shading over vele tegels → duizenden operators × tegels. **Mitigatie (bindend):** leg de volledige
Gantt-tekening **één keer** vast als een PDF **Form-XObject** (of een herbruikbare operator-buffer),
en laat elke pagina die alleen `Do`'en onder een eigen `q cm W n … Q`-wrapper (transform + clip).
Zo blijft de operator-set O(taken×dagen) en zijn de pagina's goedkoop. **Bewijs deze aanname in
fase 2 op een A1-case met veel taken, niet op A4.**

**G2 — tekstlaag-duplicatie over tegel-/kolomgrenzen (ontwerpbesluit).** `clip` (`W n`) beperkt
alleen de *rendering*, niet welke tekst in de content-stream staat: geclipte `Tj`-operators zijn in
de meeste viewers volledig **selecteerbaar/doorzoekbaar buiten de clip**. Gevolgen: (a) de bevroren
naam-/tabelkolom staat op elke horizontale tegel opnieuw als tekst → bij zoeken/kopiëren verschijnt
elke taaknaam N keer; (b) een taaknaam op een tegelrand staat volledig op beide pagina's. **Besluit
v1:** accepteer **per-pagina zelfstandige tekst** — dat is de bewuste prijs van de frozen-kolom-
feature (elke pagina blijft los leesbaar/printbaar) en de raster-versie herhaalt dezelfde inhoud al
visueel. Cross-tegel-dubbeling is een bekend, klein extractie-artefact. Een fijnere aanpak (frozen
strip op k>0 als niet-selecteerbare visuele herhaling, of tekst clippen op woord/regelgrens) is v2.
**Neem dit expliciet op in de fase-2-verificatie: controleer wat tekst-extractie oplevert.**

### 4.4 `PdfTable`-renderer (nieuw)

Generieke `PdfTable(draw, columns, rows)` bovenop Draw2D: kolom-spec (breedte, align, optionele
kleur-functie voor status-/delta-cellen), rij-hoogte, kop-onderlijn (2px), rij-scheiding (1px). Eén
helper voor beide rapporten; ze verschillen alleen in kolom-spec en databron
(`MilestoneRow`/`VarianceRow`). Voeden vanuit `useMilestoneRows()`/`useVarianceResult()`.

## 5. Font- & i18n-strategie

### 5.1 measureText-pariteit (het scherpste knelpunt, opgelost via de interface)

`fitText`, `drawBarLabel`, header-inkorting, timeline-overlapvermijding en de footer-legenda-layout
hangen allemaal op `measureText`. Preview (canvas) en export (PDF) moeten **identieke** breedtes
geven, anders wijken afkapping/paginering uiteen. Oplossing:
1. Vervang `FONT_FAMILY` (`printPreview.ts:38`) door een concreet meegeleverd font (Inter).
2. **De preview heeft géén nieuwe FontFace nodig (K1):** Inter is al de UI-body-font
   (`src/main.tsx:8-11` importeert `@fontsource/inter/400..700.css`; `globals.css:47`
   `--font-body: "Inter"`), dus `ctx.measureText` op `"Inter"` werkt al zodra de app draait. Het
   écht nieuwe is alleen de **raw TTF-bytes voor pdf-lib-embedding** in de exporttak (fontkit heeft
   binair TTF nodig; @fontsource levert alleen woff2/woff — B3).
3. De PDF-backend meet met pdf-lib's `font.widthOfTextAtSize` (leest fontkit-advances) — de
   **definitieve** plaatsing gebruikt die getallen, niet de doorgegeven canvas-metrics, om
   sub-pixel/hinting-verschil te elimineren. Voor CJK/shaping is dit sowieso nodig (ligaturen
   veranderen de somweidte).

**K2 — bewuste layout-wijziging, geen pure interne verbetering.** `FONT_FAMILY` is nu de
systeem-font-stack (`printPreview.ts:38`), niet Inter — ondanks dat de UI Inter gebruikt. Overstappen
op Inter verandert `measureText` → andere `fitText`-afkappunten (`:164-178`), andere
maand-/weeklabel-overlap-onderdrukking (`:718`, `:743`) en mogelijk een ander **paginatal**.
Bestaande exports re-flowen dus zichtbaar. Dat is verdedigbaar (het huidige gedrag is al
OS-afhankelijk; Inter maakt het deterministisch), maar het is een echte gedragsverandering — benoem
het in de changelog.

### 5.2 Async font-load (valkuil)

`renderPrintCanvas` is nu **synchroon**. Met een meegeleverd font moet vóór elke render (preview én
export) gegarandeerd zijn dat de FontFace geladen is: `await document.fonts.load('9px Inter')` (voor
elke gebruikte grootte/gewicht) en `await document.fonts.ready`. Anders meet de eerste render op
fallback-metrics → verkeerde layout. Preview-`useEffect` (`ReportPanel.tsx:101`) moet daarom eerst
op font-load wachten en daarna (her)renderen; tot die tijd een korte "voorbereiden…"-staat of een
best-effort render die herhaalt zodra `fonts.ready` resolvet.

### 5.3 Script-detectie & glyph-fallback

Getekende tekst = `t(...)`-labels **én vrije gebruikersinvoer** (taaknaam, projectnaam, bedrijf,
auteur, WBS) — dus willekeurige Unicode, ongeacht de UI-locale. Strategie per export:
1. Verzamel alle te tekenen strings; detecteer de voorkomende scripts. **De detectie moet óók de
   gelokaliseerde maandnamen meenemen (K4):** `toLocaleDateString(locale,{month:'long'})`
   (`printPreview.ts:615`, `:1015`) én de timeline-maandnamen (`getLocalizedMonths`) produceren in
   een CJK-locale CJK-glyphs *zonder* enige gebruikersinvoer. Detecteer dus over alle bronnen
   (labels + maandnamen + gebruikersinvoer), niet alleen taaknamen.
2. Latijn/Cyrillisch/Grieks → Inter (altijd geladen).
3. Bevat een string CJK-codepoints → zorg dat het juiste Noto Sans CJK-TTF geladen is (lazy fetch);
   embed-subset dekt de gebruikte glyphs.
4. Bevat een string ar/fa (of een script dat geen geladen font dekt) → **v1: raster-fallback voor de
   hele export** (de bestaande miniPdf-pijplijn). Zo is de output altijd correct, nooit "tofu".
5. **Bekende v1-beperking:** willekeurig gemengde scripts binnen één string die geen enkel geladen
   font volledig dekt, vallen onder de raster-fallback. Volledige per-run font-fallback (string
   splitsen per script, x-offsets berekenen) is v2.

De getekende tekstvelden (voor glyph-dekking) zijn geïnventariseerd: project-header (branding,
projectnaam, bedrijf/auteur/print-datum met gelokaliseerde maandnaam, start/eind/duur), today-label,
taakbar-labels, timeline-header (maandnaam+jaar, week, dag, kolomkoppen), tabel (WBS, taaknaam,
duur, datums, voltooiing) en footer (projectnaam, print-datum, "Pagina x van y", branding,
legenda).

### 5.4 RTL (ar/fa) — v1 raster, v2 vector

**v1:** detecteer ar/fa (of RTL-codepoints) → route de hele export door de bestaande
raster-JPEG-pijplijn. Visueel correct (browser shapet + bidi al), tekst niet selecteerbaar.

**v2 (promotiepad):** `bidi-js` `getEmbeddingLevels()` + `getReorderSegments()` → visuele runs
bepalen, RTL-runs omkeren/rechts uitlijnen, per run `font.layout` (fontkit-shaping) → subset →
op de juiste x plaatsen. Bidi-aware line-breaking. harfbuzz alleen als fontkit-shaping kwalitatief
tekortschiet.

## 6. Integratiepunten (exact)

| Plek | Wat |
|------|-----|
| `src/components/panels/ReportPanel.tsx:157` `handleExportPDF` | Vervang de raster-pijplijn door de vector-tak per rapporttype; kies raster-fallback bij RTL/ongedekte scripts. |
| `ReportPanel.tsx:186-216` (tabel-tak) | Vervang `domToCanvas`+`data-theme`-hack door `PdfTable` gevoed met `useMilestoneRows()`/`useVarianceResult()` (`:131-132`). |
| `ReportPanel.tsx:135` `writePdf` | **Ongewijzigd** — formaat-agnostisch (`Uint8Array` in, Tauri-save/web-download). |
| `ReportPanel.tsx:101-129` preview-`useEffect` | Wacht op font-load; blijft canvas-Draw2D-backend gebruiken (raster PNG-tegels) met het Inter-font ⇒ near-WYSIWYG. |
| `src/services/print/printPreview.ts` `renderPrintCanvas` + helpers | Ombuigen van `ctx` naar `Draw2D`; `FONT_FAMILY` (`:38`) → Inter. Layout-logica ongewijzigd. |
| `src/services/print/paginate.ts` | Behoud raster-functies; voeg `paginateVectorToPdfBytes` toe (tegelwiskunde hergebruikt). |
| `src/utils/miniPdf.ts` | **Ongewijzigd** — blijft de raster-fallback + preview voeden. |
| nieuw `src/services/pdf/` (voorstel) | `Draw2D`-interface, `CanvasDraw2D`, `PdfVectorDraw2D`, `PdfTable`, font-loading/subset-helper. |

## 7. Gefaseerd implementatieplan

Elke fase eindigt met `npx tsc --noEmit` groen; scheduling-suite draaien na aanraken van planning
(hier n.v.t., maar de build-poort geldt altijd).

**Fase 0 — de-risk spike (Opus xhigh).** De operator-API-existentievraag is al door de review
geretired (§4.2), dus de spike richt zich op de énige overgebleven load-bearing onzekerheid: de
**measureText-pariteit**. Dun end-to-end: lazy-`import()` pdf-lib+fontkit, embed een Inter-TTF-subset,
teken op één A4-pagina een paar rechthoeken/lijnen + tekst via de low-level operators, schrijf weg via
`writePdf`. **Verifieer**: (a) PDF opent, tekst is selecteerbaar; (b) `widthOfTextAtSize` ≈
`ctx.measureText` op hetzelfde Inter-font — meet numeriek op een **representatieve set** (korte
labels én lange taaknamen mét pl/tr-diacriet, niet 10 triviale strings), zodat kerning-/GPOS-
verschil boven water komt (K3). Bevestigt B1/§5.1 vóór de grote refactor. **Blokkeert de rest bij
tegenvallen.**

**Fase 1 — Draw2D-abstractie + CanvasDraw2D (Sonnet high, bindend doc).** Definieer de interface
(§4.1); implementeer de canvas-backend; buig `renderPrintCanvas` + de 5 helpers om naar `Draw2D`;
vervang `FONT_FAMILY` door Inter (met FontFace-load in preview/export). **Verifieer**: preview
identiek aan vóór de refactor (visuele QA, Sonnet high; verwachtingen vooraf uitgerekend).

**Fase 2 — PdfVectorDraw2D + vector-pagineerder (Opus xhigh).** Implementeer de PDF-backend
(kleur-parsing, alpha/ExtGState, baseline/align, dash, roundRect-bezier) en
`paginateVectorToPdfBytes` (clip+transform, bevroren-kolom-herhaling). Sluit de Gantt-vectortak aan
in `handleExportPDF` voor Latijn/Cyrillisch/Grieks. **Verifieer**: export is vector (tekstoperators
+ font-object, geen paginavullende DCTDecode), selecteerbaar, geen pixelatie bij inzoomen;
tegel-/paginering-pariteit met de raster-versie op een meerpagina-planning.

**Fase 3 — PdfTable + mijlpalen/afwijkingen (Sonnet high, bindend doc).** Generieke tabel-renderer +
kolom-specs voor beide rapporten; vervang de DOM-screenshot-tak. **Verifieer**: kolommen/kleuren/
statusbadges kloppen met de DOM-preview; selecteerbare tekst.

**Fase 4 — CJK lazy-fetch + script-detectie + raster-fallback (Opus xhigh).** Host Noto Sans CJK-TTF
als static asset; per-export script-detectie (incl. maandnamen, K4); lazy-fetch + subset-embed;
RTL/ongedekt → raster-fallback. **Cache de gefetchte font (K6)** in IndexedDB (web) / `appDataDir`
(Tauri) zodat een tweede export niet tientallen MB her-downloadt; en zorg dat de **Tauri-CSP** de
connectie naar de font-host (`open-planner-studio.open-aec.com`) toestaat. **Verifieer**: een
showcase met CJK-taaknamen exporteert vector met correcte glyphs; een tweede export gebruikt de
cache (geen her-download); een ar/fa-document valt correct terug op raster; offline CJK-fetch faalt
gracieus naar raster.

**Fase 5 — docs + i18n + licentie + changelog (Sonnet medium).** De print-gids bijwerken — **let op:
die bestaat alleen als `public/docs/en/` en `public/docs/nl/gids-rapporten-printen.md` (K8),** niet
in 14 locales; verifieer welke bestaan i.p.v. `*` aan te nemen. `docs/CHANGELOG.md` (incl. de
K2-layout-reflow-noot). **OFL-NOTICE (K7):** Inter en Noto zijn OFL-1.1 — de licentietekst moet
meegeleverd worden en OFL kent Reserved-Font-Name-regels bij subsetten/hernoemen; voeg een
NOTICE/licentiebestand toe. **Pre-existente i18n-gaten (K5, optioneel meenemen):** `'Today'`
(`printPreview.ts:447`) en `'Start:'`/`'Eind:'`/`'Duur:'` (`:629,633,639`) zijn hardcoded buiten
`t(...)` — de refactor erft die fout; fix ze of scope ze expliciet uit (de "af"-eis "correct voor
alle 14 locales" raakt hieraan). Eventuele nieuwe UI-labels via `t(...)` in alle 14 locales.

## 8. Verificatie / groene poort

- **Build:** `npm run build` (tsc strict, `noUnusedLocals`/`noUnusedParameters`).
- **Scheduling-suite:** `bash tests/planning/run.sh` (geen scheduling-wijziging verwacht, maar de
  poort draait volledig).
- **PDF-assertie (nieuw, aanbevolen):** parse de geproduceerde bytes en assert (a) aanwezigheid van
  `/Font`-objecten + tekstoperators, (b) afwezigheid van een paginavullende `DCTDecode`-image in de
  vectortak. Kan headless via de self-test-harness of een klein Node-scriptje.
- **Visuele QA:** open de PDF, controleer scherpte bij inzoomen en tekst-selecteerbaarheid;
  vergelijk preview vs. export op dezelfde planning (afkapping/paginering identiek). Grote QA
  splitsen over 2 parallelle agents met eigen `launchPersistentContext`-userDataDir.
- **Zero-context-test:** de changelog/gids-tekst begrijpelijk zonder deze sessie.

## 9. Risico's

| Risico | Mitigatie |
|--------|-----------|
| ~~pdf-lib operator-API wijkt af~~ (geretired) | Review verifieerde `operators.ts` — API dekt alles (§4.2). |
| **Render-/geheugenkost vector ≫ raster op grote planningen (G1)** | Draw-list één keer als Form-XObject; per pagina alleen `Do` onder transform+clip; bewijzen op A1. |
| **Tekstlaag-duplicatie bij extractie (G2)** | Bewust besluit: per-pagina zelfstandige tekst v1; fijnere aanpak v2; verifiëren via tekst-extractie. |
| measureText ≠ PDF-advances (afkapping/paginering wijkt) | Zelfde ingebedde TTF voor beide; definitieve plaatsing via `widthOfTextAtSize`; numerieke meting in fase 0 op diacriet-strings (K3). |
| Font-swap (systeemstack → Inter) = zichtbare export-reflow (K2) | Bewuste, deterministische wijziging; changelog-noot. |
| CFF/OTF-subsetting onbetrouwbaar | Dwing TTF (glyf) af voor alle embed-fonts (B3/B4). Exacte "kapot"-issuenummers deels ongeverifieerd; TTF-guardrail is sowieso goedkoop. |
| CJK-TTF niet beschikbaar (offline desktop) | Graceful raster-fallback per document; cache na eerste fetch (K6); Tauri-CSP toestaan. |
| Async font-load race → verkeerde eerste render | `await document.fonts.ready` vóór render (§5.2). |
| RTL-vector onderschat | v1 raster-fallback; v2 pas na bidi-runlayout + test. |
| Bundle-groei | Lazy `import()`; CJK als lazy static asset, niet gebundeld. |

## 10. Open besluiten voor de user

**Besluit 0 — diepte van de oplossing (bevestigd).** De user koos volledige vector mét selecteerbare
tekst (§2.1). De afgewogen, niet-gekozen alternatieven staan in §10.1.

1. **RTL v1 = raster-fallback** (§5.4/B5). Afwijking van "alle locales vector". Akkoord, of moet
   ar/fa-vector (bidi-runlayout) toch in v1?
2. **CJK-font hosting**: als static asset op `open-planner-studio.open-aec.com` (lazy-fetch, met
   cache) — of liever bundelen ondanks de grootte, of GitHub-raw? Static-asset-fetch is de voorkeur;
   graag bevestiging.
3. **Preview-strategie**: canvas-raster-preview met Inter-font (near-WYSIWYG, pragmatisch) vs. een
   echte in-browser PDF-viewer (zwaarder). Voorstel = canvas-raster.

### 10.1 Afgewogen alternatieven (niet gekozen)

Voor de navolgbaarheid — de kritische review wees erop dat selecteerbare tekst de hele kostendrijver
is en dat er goedkopere routes bestaan die de letterlijke issue-klacht ("sharp print", "zoom without
pixelation") ook deels adresseren:

- **Goedkope scherpte (~1 dag):** PNG i.p.v. JPEG in `paginate.ts:214` (de tabelrapporten gebruiken
  nu `toDataURL('image/jpeg',0.9)` → ringing op tekst) + de MP-cap in `computeHighResScale`
  verhogen/opheffen voor A4/A3. Lost de scherpte-klacht grotendeels op, **geen** selecteerbare tekst,
  A1 blijft eindige DPI. → Afgewezen: geen selecteerbare/doorzoekbare tekst, die de user expliciet
  wil.
- **Vector, alleen Latijn:** vector + selecteerbare tekst voor Latijnse locales; CJK én RTL via
  raster-fallback. Schrapt CJK-hosting/fetch (fase 4) volledig. → Kleinere variant; blijft
  beschikbaar als de CJK-hosting-vraag (besluit 2) op bezwaar stuit.

Deze staan hier zodat een latere lezer ziet dat de volledige aanpak een bewuste keuze was, niet een
default.

## 11. Bronnen & verificatiestatus

- Research A (PDF-vector/font-stack): pdf-lib `CustomFontEmbedder.ts` (Type0/CID/Identity-H +
  subsetting), `@pdf-lib/fontkit` browser-native + MIT, foliojs/fontkit `opentype/shapers`
  (ArabicShaper aanwezig, geen bidi), `bidi-js`, Noto Sans CJK TTF-vereiste, bundlephobia-groottes.
- Research B (rapportcode): `printPreview.ts` primitieven-inventaris, `MilestoneReport.tsx`/
  `VarianceReport.tsx` data-inventaris, `ReportPanel.tsx`/`paginate.ts` integratiepunten,
  `i18n/config.ts` locales.
- Kritische review (Opus xhigh): verifieerde pdf-lib `operators.ts` (clip/dash/gs/cm/bezier — API
  compleet), `@fontsource` levert geen TTF (fontsource #371/#570), Inter is al UI-font
  (`main.tsx`/`globals.css`), integratie-regelnummers, en de ~220-DPI-realiteit van de huidige
  raster-export. Bracht G1/G2 + K1–K9 in; eindoordeel "klaar-met-aanpassingen" (nu verwerkt).

**Ongeverifieerd (bewust als open gemarkeerd, valideren tijdens bouw):** exacte CJK-subset-KB in de
PDF; `bidi-js` exacte gzip-grootte; woff2-in-browser-embed door `@pdf-lib/fontkit`; bundlegroottes
178/342 KB gzip (bundlephobia niet geraadpleegd); de blanket-claim "CFF-subsetting kapot" met issue
#664/#826 (alleen OpenPDF #71 bevestigd) — de TTF-guardrail staat er los van; numerieke
`widthOfTextAtSize`≈`measureText`-match (→ fase 0); Inter's volledige glyph-dekking pl/tr/Cyrillisch/
Grieks (→ render-test fase 1).
