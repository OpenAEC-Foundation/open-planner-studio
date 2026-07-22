# Vector-PDF-export — ontwerpdoc

**Datum:** 2026-07-22
**Issue:** #23 "Support vector PDF export support"
**Status:** ontwerp — vier scope-besluiten vastgelegd (§2.2), klaar om te bouwen
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
- Ingebedde gesubsette fonts uit de **kern**: Latijn/Cyrillisch/Grieks (Inter).
- Een **font-provider-registry + extensie-API** zodat extra scripts (CJK) via een extensie
  bijgeplugd kunnen worden; scripts zonder dekkend font vallen terug op raster (§4.5, §5.3).
- Vector-paginering (clip + transform per pagina) met behoud van de bevroren-naam-kolom-herhaling.

**Bewust buiten v1 (losgekoppelde vervolgtaken ná v1):**
- **CJK (zh/ja/ko) zit niet in de kern maar wordt een aparte, officiële extensie** (besluit 3, §2.2).
  De kern levert alleen de haak (font-registry + extensie-API); de extensie brengt het Noto Sans
  CJK-font mee. Zonder geïnstalleerde extensie → raster-fallback voor CJK-documenten.
- **Arabisch/Farsi (ar/fa) blijven via de bestaande raster-JPEG-export** (besluit 2, §5.4). De
  RTL-vectortekst (bidi-runlayout op `bidi-js`) is de grootste engineering-/testlast en wordt
  **pas ná de rest, als losgekoppelde vervolgtaak door een aparte agent** gedaan. De browser rendert
  RTL al perfect naar canvas, dus de raster-PDF is visueel correct; enige verlies = niet-selecteerbare
  tekst voor 2 van de 14 locales tot die vervolgtaak klaar is.
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

### 2.2 De vier vastgelegde scope-besluiten

Na de kritische review heeft de user vier keuzes bevestigd; die zijn nu bindend:

1. **Alles vector.** Volledige vector-aanpak mét selecteerbare tekst voor Gantt + beide
   tabelrapporten. Geen afgeslankte variant.
2. **Arabisch/Farsi: nu raster, vector later apart.** In v1 gaan ar/fa via de bestaande
   raster-JPEG-export. Het RTL-vectorwerk (bidi-runlayout) wordt **pas ná v1 en door een aparte
   agent** opgepakt — niet in deze bouwronde.
3. **CJK wordt een extensie.** De Aziatische lettertypes (5–16 MB) komen niet in de kern of van een
   server, maar als een **installeerbare extensie** via het bestaande extensiesysteem. De kern
   levert een font-provider-registry + extensie-API; de extensie registreert het Noto-CJK-font.
   Zonder extensie → raster-fallback voor CJK.
4. **Preview = raster.** Het live-voorbeeld blijft de snelle raster-manier (canvas → PNG-tegels,
   near-WYSIWYG). Geen zware in-browser PDF-viewer.

## 3. Besluiten (met onderbouwing)

| # | Besluit | Onderbouwing |
|---|---------|--------------|
| B1 | **`pdf-lib` + `@pdf-lib/fontkit`** als vector-PDF-generator, i.p.v. `miniPdf` uitbreiden of `jspdf`. | pdf-lib doet al Type0/CID (`Identity-H`) font-embedding **met subsetting via fontkit** (`embedFont(bytes,{subset:true})`), is browser-native (de fork bestaat juist om Node-`fs`/`Buffer` te vermijden), en is MIT (compatibel met LGPL-3.0). Zelf TrueType-subsetting + CID/Type0 + `cmap`/`GSUB` schrijven is honderden correctheidsgevoelige regels — precies wat fontkit betrouwbaar doet. `jspdf` heeft zwakkere subsetting en slechts partiële RTL. |
| B2 | **Lazy `import()`** van pdf-lib/fontkit in de exporttak, niet in de hoofdbundle. | ~530 KB gzip (pdf-lib 178 KB + fontkit 342 KB). Volgt het bestaande patroon (`App.tsx` importeert de Tauri-auto-save dynamisch). De export is een gebruikersactie, geen opstartpad. |
| B3 | **Inter als TTF meeleveren** (raw `.ttf` uit `rsms/inter`, OFL-1.1), niet de `@fontsource/inter`-woff2. | `@fontsource/inter` levert alleen woff2/woff + CSS, geen `.ttf`. Voor embedding is TTF/OTF nodig; of `@pdf-lib/fontkit` in-browser woff2 (brotli) decodeert is **ongeverifieerd** — dus veiligste route = raw TTF. Inter dekt Latijn + Cyrillisch + Grieks ⇒ 9 Latijnse locales met één font. Vervangt de systeem-font-stack `FONT_FAMILY` (`printPreview.ts:38`), die per platform verschilt en niet inbedbaar is. |
| B4 | **CJK als installeerbare extensie** (Noto Sans CJK in TTF/glyf), niet in de kern of via server-fetch. Kern levert een font-provider-registry + extensie-API (§4.5). | CFF/OTF-subsetting is onbetrouwbaar (o.a. OpenPDF #71 → onzichtbare tekst); pdf-lib subset werkt betrouwbaar op glyf (TTF). Volledige CJK-font = 5–16 MB → hoort niet in de hoofdbundle. De user koos bewust het **extensie**-model (besluit 3): dat past bij de app-filosofie (frontend-extensies, IndexedDB-opslag, geen Rust), houdt de kern licht, en maakt CJK optioneel/opt-in. De extensie levert de ruwe TTF-bytes; de kern subset per export (~tientallen–honderd KB in de PDF). Horizontale CJK heeft **geen** shaping nodig — simpele codepoint→glyph via Type0/CID. |
| B5 | **ar/fa via raster-fallback in v1**; RTL-vector (`bidi-js`) is een **losgekoppelde vervolgtaak ná v1, door een aparte agent**. | fontkit shapet Arabisch (joining/ligaturen) al, maar doet **geen bidi-reordering** — dat is zelfbouw (grootste lift + testlast: mixed met cijfers/Latijnse namen). Raster = nul extra werk, vandaag visueel correct. De user koos expliciet dit werk te ontkoppelen (besluit 2). `harfbuzz` is niet nodig (fontkit shapet even goed) en zou 390 KB wasm toevoegen. |
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

### 4.5 Font-provider-registry + extensie-API (CJK via extensie — besluit 3)

De kern bedt zelf alleen Inter in (Latijn/Cyrillisch/Grieks). Extra scripts komen via een
**font-provider-registry** die extensies kunnen vullen:

```ts
interface PdfFontProvider {
  id: string;                       // bv. 'noto-cjk-sc'
  covers(codepoint: number): boolean; // of, praktischer: een lijst Unicode-ranges/scripts
  getTtfBytes(): Promise<Uint8Array>; // ruwe TTF (glyf) — de kern subset per export
}
```

- **Kern:** een module (bv. `src/services/pdf/fontRegistry.ts`) houdt de geregistreerde providers
  bij. Bij export doet de script-detectie (§5.3) per string: gedekt door Inter → Inter; anders →
  vraag de registry om een provider die de codepoints dekt; geen provider → **raster-fallback voor de
  hele export**.
- **Extensie-API:** breid `src/extensions/api` uit met `api.pdfFonts.register(provider)`, afgedwongen
  achter een nieuwe permissie (bv. `pdf-fonts`) net als de bestaande `ribbon`/`events`-permissies.
  De extensie roept dit aan in `onLoad(api)` en verwijdert zich bij `onUnload()`.
- **De officiële CJK-extensie:** een ZIP met `manifest.json` + `main.js` die het Noto Sans CJK-TTF
  meebrengt en registreert. Twee opties voor de font-bytes, te beslissen in fase 4b:
  1. **Loader uitbreiden met binaire assets** (aanbevolen): de extensie-loader (`src/extensions/loader`)
     leert een asset-bestand uit de ZIP als `Uint8Array` aan de extensie te geven. Schoon, maar raakt
     de loader.
  2. **Font als base64 in `main.js`** (geen loader-wijziging, maar een ~7–21 MB JS-string — lelijk).
  Opslag is sowieso IndexedDB (`ops-extensions`), dat de multi-MB-payload aankan. De extensie hoort
  in de catalogus (`open-planner-studio-extensions/catalog.json`).
- **Waarom dit past:** extensies zijn puur frontend, geen Rust, geen IFC-impact — een font-provider is
  precies zo'n app-niveau-uitbreiding. De kern blijft licht en CJK wordt opt-in.

**Belangrijk voor de bouw:** de kern-haak (registry + API + fallback) is v1-werk (fase 4). De
CJK-extensie zelf is een **apart deliverable** (fase 4b) en kan met een klein test-font gevalideerd
worden zonder de volle 16 MB.

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
2. Latijn/Cyrillisch/Grieks → Inter (altijd door de kern geladen).
3. Bevat een string CJK-codepoints → vraag de **font-provider-registry** (§4.5) om een provider die
   ze dekt. Is de **officiële CJK-extensie geïnstalleerd**, dan levert die het Noto-CJK-TTF en subset
   de kern per export; is er geen provider → stap 4 (raster-fallback).
4. Bevat een string ar/fa, óf CJK zonder geïnstalleerde extensie, óf een ander script dat geen
   provider dekt → **v1: raster-fallback voor de hele export** (de bestaande miniPdf-pijplijn). Zo is
   de output altijd correct, nooit "tofu".
5. **Bekende v1-beperking:** willekeurig gemengde scripts binnen één string die geen enkele provider
   volledig dekt, vallen onder de raster-fallback. Volledige per-run font-fallback (string splitsen
   per script, x-offsets berekenen) is een latere uitbreiding.

De getekende tekstvelden (voor glyph-dekking) zijn geïnventariseerd: project-header (branding,
projectnaam, bedrijf/auteur/print-datum met gelokaliseerde maandnaam, start/eind/duur), today-label,
taakbar-labels, timeline-header (maandnaam+jaar, week, dag, kolomkoppen), tabel (WBS, taaknaam,
duur, datums, voltooiing) en footer (projectnaam, print-datum, "Pagina x van y", branding,
legenda).

### 5.4 RTL (ar/fa) — v1 raster, vector als losgekoppelde vervolgtaak

**v1:** detecteer ar/fa (of RTL-codepoints) → route de hele export door de bestaande
raster-JPEG-pijplijn. Visueel correct (browser shapet + bidi al), tekst niet selecteerbaar.

**Vervolgtaak ná v1 (aparte agent, besluit 2):** `bidi-js` `getEmbeddingLevels()` +
`getReorderSegments()` → visuele runs bepalen, RTL-runs omkeren/rechts uitlijnen, per run
`font.layout` (fontkit-shaping) → subset → op de juiste x plaatsen. Bidi-aware line-breaking. Het
Arabische font komt — net als CJK — via een provider (kern-font of extensie). harfbuzz alleen als
fontkit-shaping kwalitatief tekortschiet. **Deze taak wordt bewust níét in deze bouwronde gedaan;
ze wordt pas gestart als v1 (fasen 0–5) staat en groen is.**

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
| nieuw `src/services/pdf/` (voorstel) | `Draw2D`-interface, `CanvasDraw2D`, `PdfVectorDraw2D`, `PdfTable`, `fontRegistry.ts`, font-subset-helper. |
| `src/extensions/api` (+ `types`, permissie-lijst) | Nieuwe `api.pdfFonts.register(...)` achter een `pdf-fonts`-permissie (besluit 3, §4.5). |
| `src/extensions/loader` | Mogelijk uitbreiden met binaire-asset-toegang zodat een font-extensie de TTF-bytes kan leveren (fase 4b, optie 1). |
| catalogus `open-planner-studio-extensions/catalog.json` | Officiële CJK-font-extensie publiceren (fase 4b). |

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

**Fase 4 — font-provider-registry + extensie-API + script-detectie + raster-fallback (Opus xhigh).**
Kern-werk (géén CJK-font nog): bouw `fontRegistry.ts`; breid de extensie-API uit met
`api.pdfFonts.register(provider)` achter een `pdf-fonts`-permissie (§4.5); per-export script-detectie
(incl. maandnamen, K4); scripts zonder dekkende provider (ar/fa, of CJK zonder extensie) → raster-
fallback voor de hele export. **Verifieer**: met een klein **test-font-provider** (paar CJK-glyphs,
in-repo, niet de volle 16 MB) exporteert een document met die glyphs vector; zonder provider valt
hetzelfde document terug op raster; een ar/fa-document valt terug op raster; een puur-Latijn document
blijft ongewijzigd vector.

**Fase 4b — officiële CJK-font-extensie (Opus xhigh, apart deliverable).** Bouw de extensie-ZIP
(`manifest.json` + `main.js`) die het Noto Sans CJK-TTF meebrengt en via `api.pdfFonts.register`
aanbiedt. Beslis font-bytes-route (§4.5: loader-binaire-assets vs. base64). Publiceer in de catalogus.
**Verifieer**: extensie installeren → een showcase met echte CJK-taaknamen exporteert vector met
correcte glyphs; deïnstalleren → terug naar raster-fallback. **Deze fase mag ná de v1-merge lopen —
de kern (fase 4) is af zonder haar.**

**Losgekoppelde vervolgtaak (ná v1, aparte agent) — RTL-vector (ar/fa).** Zie §5.4. Niet in deze
bouwronde.

**Fase 5 — docs + i18n + licentie + changelog (Sonnet medium).** De print-gids bijwerken — **let op:
die bestaat alleen als `public/docs/en/` en `public/docs/nl/gids-rapporten-printen.md` (K8),** niet
in 14 locales; verifieer welke bestaan i.p.v. `*` aan te nemen. `docs/CHANGELOG.md` (incl. de
K2-layout-reflow-noot). **OFL-NOTICE (K7):** Inter (kern) is OFL-1.1 — de licentietekst moet
meegeleverd worden; OFL kent Reserved-Font-Name-regels bij subsetten/hernoemen. Voeg een
NOTICE/licentiebestand toe voor Inter. Het Noto-CJK-OFL hoort bij de **CJK-extensie** (fase 4b), niet
bij de kern. **Pre-existente i18n-gaten (K5, optioneel meenemen):** `'Today'`
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
| CJK-extensie niet geïnstalleerd | Graceful raster-fallback per document (geen "tofu"); CJK is opt-in. |
| Extensie kan geen binaire font-bytes leveren | Loader uitbreiden met binaire assets (§4.5, fase 4b, optie 1) of base64-fallback (optie 2). |
| Async font-load race → verkeerde eerste render | `await document.fonts.ready` vóór render (§5.2). |
| RTL-vector onderschat | v1 raster-fallback; losgekoppelde vervolgtaak ná v1 (aparte agent). |
| Bundle-groei | Lazy `import()` van pdf-lib/fontkit; CJK-font zit in een extensie (IndexedDB), niet in de hoofdbundle. |

## 10. Besluiten (allemaal beslist)

Alle eerder openstaande punten zijn door de user bevestigd (§2.2); niets blokkeert meer:

| # | Vraag | Besluit |
|---|-------|---------|
| 0 | Diepte van de oplossing | **Volledige vector mét selecteerbare tekst** (§2.1). Alternatieven in §10.1. |
| 1 | RTL (ar/fa) in v1? | **Nee — v1 raster-fallback**; RTL-vector is een losgekoppelde vervolgtaak ná v1 door een aparte agent (§5.4). |
| 2 | CJK-font: bundelen/hosten/extensie? | **Extensie** (§4.5/B4). Kern levert de haak; officiële CJK-extensie brengt het font. |
| 3 | Preview-strategie | **Raster** (canvas → PNG-tegels, near-WYSIWYG). Geen in-browser PDF-viewer. |

### 10.1 Afgewogen alternatieven (niet gekozen)

Voor de navolgbaarheid — de kritische review wees erop dat selecteerbare tekst de hele kostendrijver
is en dat er goedkopere routes bestaan die de letterlijke issue-klacht ("sharp print", "zoom without
pixelation") ook deels adresseren:

- **Goedkope scherpte (~1 dag):** PNG i.p.v. JPEG in `paginate.ts:214` (de tabelrapporten gebruiken
  nu `toDataURL('image/jpeg',0.9)` → ringing op tekst) + de MP-cap in `computeHighResScale`
  verhogen/opheffen voor A4/A3. Lost de scherpte-klacht grotendeels op, **geen** selecteerbare tekst,
  A1 blijft eindige DPI. → Afgewezen: geen selecteerbare/doorzoekbare tekst, die de user expliciet
  wil.
- **Vector, alleen Latijn (kern zonder CJK-extensie):** dit is feitelijk de gekozen v1 wanneer de
  CJK-extensie níét geïnstalleerd is — vector + selecteerbare tekst voor Latijnse/Cyrillische/Griekse
  locales, CJK én RTL via raster-fallback. Het extensie-model (besluit 2) maakt CJK juist opt-in
  bovenop deze basis, zonder de kern zwaarder te maken.

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
