# Vector-PDF-export — ontwerpdoc

**Datum:** 2026-07-22
**Issue:** #23 "Support vector PDF export support"
**Status:** ✅ v1 + RTL + CJK-ONDERSTEUNING GEBOUWD & GEVERIFIEERD (2026-07-22). v1 (fasen 0–5):
Latijn/Cyrillisch/Grieks vector. RTL (RTL-1/2): Arabisch/Perzisch vector (bidi/shaping, Noto Arabic).
CJK (CJK-1/2 + font-verify): harfbuzz-subset (omzeilt het pdf-lib-defect) + font-provider-extensie-API;
CJK rendert vector zodra een font-extensie geïnstalleerd is, anders raster. **Capstone E2E-UI-QA groen**
(echte browser, pypdf+PyMuPDF): Latijn/Arabisch/CJK-via-extensie allemaal vector, per-glyph-coverage
afgedwongen. **Rest (buiten deze repo):** de echte per-regio CJK-font-extensies (zh/ja/ko) publiceren
naar de catalogus-repo `open-planner-studio-extensions`. Nog niet-vector (later): Tauri-save-pad
niet in Tier-1-QA; extensie-disable→raster-reversie ongetest; CJK-Bold-gewicht ongetest.
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
export **voor door-Inter-gedekte scripts** — voor CJK is de preview een benadering tenzij de
provider-`FontFace` ook in de preview geladen wordt (§5.1, review-bevinding: de preview-canvas heeft
geen Noto-font, de export wel → afwijkende metrics/afkapping voor CJK).

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
| B4 | **CJK als installeerbare extensie** (Noto Sans CJK in TTF/glyf), niet in de kern of via server-fetch. Kern levert een font-provider-registry + extensie-API (§4.5). | CFF/OTF-subsetting is onbetrouwbaar (o.a. OpenPDF #71 → onzichtbare tekst); pdf-lib subset werkt betrouwbaar op glyf (TTF). Volledige CJK-font = 5–16 MB → hoort niet in de hoofdbundle. De user koos bewust het **extensie**-model (besluit 3): frontend-extensies, IndexedDB-opslag, geen Rust; houdt de default-bundle licht en maakt CJK opt-in. **Eerlijke kanttekening (§4.5):** dit is méér kern-werk dan een simpele lazy-`fetch` — de extensie-loader/API kent nu geen binaire assets, dus die moeten gebouwd worden (fase 4). De extensie levert de ruwe TTF-bytes; de kern subset per export (~tientallen–honderd KB in de PDF). Horizontale CJK heeft **geen** shaping nodig — simpele codepoint→glyph via Type0/CID. |
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
fase 2 op een A1-case met veel taken, niet op A4.** Let op: de Form-XObject-resource-dict moet de
gebruikte (gesubsette) font-objecten meenemen — als een CJK-subset per export verschilt, hoort dat
font bij de XObject-resources.

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
  achter een nieuwe permissie `pdf-fonts`. De registratie moet een **cleanup-functie op `cleanupFns`
  pushen** (net als `importers.register` in `extensionApi.ts:54` en `ui.addRibbonButton` `:102`), zodat
  `disableExtension` → `_cleanup()` (`extensionLoader.ts:209`) de provider **automatisch** uitschrijft
  — niet vertrouwen op een auteur-`onUnload()` (dat lekt een stale provider als het ontbreekt/gooit).

- **Eerlijke kern-kost (review-bevinding — het doc onderschatte dit eerst).** "Een provider
  registreren" is licht, maar **de font-bytes bij de extensie krijgen** raakt meerdere kernbestanden.
  De ZIP-install decodeert nu *alleen* `manifest.json` + `main.js` als tekst en gooit de rest weg
  (`extensionService.ts:167,175`); `StoredExtension` = `{id,manifest,mainCode,enabled}` heeft geen
  asset-veld (`extensionLoader.ts:62-67`); de SDK is globaal/stateless (`sdk.ts:4-7`) en de
  `ExtensionApi` (`types.ts:107-157`) heeft geen asset-accessor. Twee routes:
  1. **Loader uitbreiden met binaire assets (aanbevolen).** Concreet kern-werk: (a) niet-main
     ZIP-entries bewaren in `installFromZipBlob`; (b) `StoredExtension` + opgeslagen record uitbreiden
     met assets; (c) een asset-accessor op de API (bv. `api.assets.get(name): Uint8Array`); (d)
     `ExtensionApi`-type + `createExtensionApi`; (e) idem voor het losse-`.js`-pad
     (`installFromJsFile`). Dit is een **echte kern-feature**, geen bijzaak.
  2. **Font als base64 in `main.js`** — geen loader-wijziging, maar ingeschakelde extensies worden bij
     **elke app-start** opnieuw uitgevoerd via `new Function(mainCode)` (`extensionLoader.ts:126,223,239`),
     dus een ~20 MB base64-blob (16 MB font × +33%) wordt bij iedere startup gecompileerd + als string
     uit IndexedDB gehaald. Reële geheugen-/opstart-kost, niet slechts "lelijk". → afgeraden.
  Opslag is sowieso IndexedDB (`ops-extensions`, `extensionLoader.ts:38`), dat de multi-MB-payload aankan.
  De extensie hoort in de catalogus (`open-planner-studio-extensions/catalog.json`).

- **Permissie-plumbing (review-bevinding).** `pdf-fonts` toevoegen vergt: `KNOWN_PERMISSIONS`
  (`permissions.ts:72-78`), het `ExtensionPermission`-type (`types.ts:39-44`), `API_PERMISSIONS`
  (`permissions.ts:39`, pad `pdfFonts.register` met `mode:'throw'`), plus een `pdfFonts`-groep in
  `ExtensionApi` + `createExtensionApi`. **Valkuil:** `sanitizeManifestPermissions` **stript elke
  onbekende permissie** (`permissions.ts:86-106`) — zolang `pdf-fonts` niet in `KNOWN_PERMISSIONS`
  staat, verliest elke extensie die 'm declareert de permissie stil. Deze edits horen dus in **fase 4
  (kern)**, niet 4b.

- **Sandbox-doorgifte is géén probleem:** de `new Function`-sandbox draait in hetzelfde realm (geen
  echte isolatie, `extensionLoader.ts:110-111`), dus een provider-object met een echte `Uint8Array`
  gaat 1:1 naar de kern — geen structured-clone-grens.

- **Waarom dit model (ondanks de kost):** de user koos het bewust (besluit 3). Het houdt de
  default-bundle licht en maakt CJK opt-in. Wees wél eerlijk: het is **méér** kern-complexiteit dan
  een simpele lazy-`fetch` van het font uit de app-assets zou zijn — dat is de prijs van de
  extensie-keuze, niet gratis.

**Belangrijk voor de bouw:** de kern-haak (registry + API + **de gekozen font-bytes-leveringsroute** +
permissie-plumbing + fallback) is v1-werk (**fase 4**) — de API-vorm moet stabiel zijn vóór v1-freeze.
Fase 4b is puur "het echte Noto-CJK-font inpakken + catalogus publiceren" en mag ná de v1-merge lopen;
valideer fase 4 met een **klein test-font-provider** (paar glyphs, in-repo), niet de volle 16 MB.

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

**CJK preview≠export (review-bevinding).** De preview-canvas heeft géén Noto-font geladen (Inter
dekt geen CJK), dus meet daar op de OS-CJK-fallback, terwijl de export Noto Sans CJK gebruikt →
afwijkende afkapping/overlap/paginering voor CJK-documenten. Dat is dezelfde measureText-valkuil,
nu tussen twee verschillende fonts. Keuze: (a) accepteer dat WYSIWYG (check e) alleen voor
Inter-gedekte scripts geldt en voor CJK een benadering is (pragmatisch, past bij besluit 4); óf (b)
laad in de preview-tak de provider-`FontFace` (uit de TTF-bytes: `new FontFace('NotoCJK', bytes)`)
zodat de canvas óók Noto meet — kost een extra async font-load in de preview en trekt de provider de
preview-lus in. **Voorstel: (a) in v1, (b) als latere verfijning.**

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

**Forward-compat-eis voor v1 (zodat de ontkoppeling veilig blijft — review-bevinding):** de latere
RTL-laag moet **boven** `Draw2D` kunnen zitten (bidi reorderen + per visuele run een x uitrekenen,
dan per run een gewone LTR-`fillText(run, xRun, y)` aanroepen). Daarom in v1: (a) de font-provider-
registry blijft **richting-agnostisch** (alleen bytes/coverage, geen shaping/richting); (b) bak in de
gedeelde meet-/pagineerpaden (`measureText`-gebruik in footer/timeline/`fitText`) **geen LTR-only-
aannames** die RTL later tot een refactor dwingen. Zo staat de deur open zonder dat v1 al bidi hoeft
te kennen.

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

**Fase 0 — de-risk spike — ✅ UITGEVOERD (GO, 2026-07-22).** Bewezen met onafhankelijke verificatie
(pypdf/fontTools/Playwright): pdf-lib **1.17.1** + @pdf-lib/fontkit **1.1.1** geïnstalleerd; Inter als
statische **glyf**-TTF (`InterVariable.ttf` → `varLib.instancer` wght=400 → `src/services/pdf/fonts/
Inter-Regular.ttf`, geen CFF, 2937 glyphs, pl/tr/de/Cyrillisch/Grieks gedekt); low-level operator-API
(rects/dash/alpha/`showText`) werkt en levert Type0-font + `FontFile2`, géén DCTDecode, tekst exact
extraheerbaar incl. diacrieten; **measureText-pariteit is exact modulo kerning** — met
`ctx.fontKerning='none'` in de canvas-backend float-identiek aan `widthOfTextAtSize` (zonder: max
~1,4% op korte labels). **Learnings voor de bouw:** (1) zet `ctx.fontKerning='none'` in `CanvasDraw2D`
voor pixel-WYSIWYG; (2) valideer fase 2 tegen npm-**1.17.1** (niet master — `setFillingColor` bestáát
er wél, maar gebruik `setFillingRgbColor`); (3) Bold moet nog geïnstantieerd/gevendord (wght=700); (4)
`file://` is geblokkeerd in de Playwright-omgeving → serveer via een lokale http-server in
harness-scripts.

*Oorspronkelijke opdracht (behouden voor context):* De operator-API-existentievraag is al door de
review geretired (§4.2), dus de spike richt zich op de énige overgebleven load-bearing onzekerheid: de
**measureText-pariteit**. Dun end-to-end: lazy-`import()` pdf-lib+fontkit, embed een Inter-TTF-subset,
teken op één A4-pagina een paar rechthoeken/lijnen + tekst via de low-level operators, schrijf weg via
`writePdf`. **Verifieer**: (a) PDF opent, tekst is selecteerbaar; (b) `widthOfTextAtSize` ≈
`ctx.measureText` op hetzelfde Inter-font — meet numeriek op een **representatieve set** (korte
labels én lange taaknamen mét pl/tr-diacriet, niet 10 triviale strings), zodat kerning-/GPOS-
verschil boven water komt (K3). Bevestigt B1/§5.1 vóór de grote refactor. **Blokkeert de rest bij
tegenvallen.**

**Fase 1 — Draw2D-abstractie + CanvasDraw2D (Sonnet high, bindend doc).** Definieer de interface
(§4.1); implementeer de canvas-backend; buig `renderPrintCanvas` + de 5 helpers om naar `Draw2D`;
vervang `FONT_FAMILY` door Inter (met FontFace-load in preview/export). **Scoping-geruststelling
(geverifieerd door de review):** de font-swap raakt alléén `printPreview.ts:38` — de on-screen
`GanttRenderer` heeft z'n eigen hardcoded font-stacks en importeert `printPreview` niet, dus het
hoofdscherm verandert niet. **Verifieer**: preview identiek aan vóór de refactor (visuele QA, Sonnet
high; verwachtingen vooraf uitgerekend).

**Fase 2 — PdfVectorDraw2D + vector-pagineerder — ✅ UITGEVOERD (2026-07-22).** PDF-backend
(`pdfVectorDraw2d.ts`) + `paginateVectorToPdfBytes` (`paginateVector.ts`); Gantt-export is vector met
selecteerbare tekst, G1 bewezen op A1 (1 Form-XObject 57× ge-`Do`'d, 30 pag., 432 KB, 1,7 s), 0
DCTDecode, tsc/planning(429)/build groen; vector = aparte lazy chunk. **Twee afwijkingen/learnings:**
(1) **`subset:false` gekozen i.p.v. `subset:true`** — subset:true dropt glyphs in pdfium/Chrome
(visueel defect; extractie klopt wél, vandaar door fase 0 gemist). Volledige Inter-embed = ~0,4 MB
vloer, prima voor print. **Blokkeert CJK-subsetting → moet vóór fase 4b opgelost (zie B4/fase 4b).**
(2) **G2-amplificatie:** het gedeelde XObject (G1) betekende dat tekst-extractie op élke pagina de
HELE planning gaf (taaknaam 798× op A1). Opgelost in **fase 2.1** (tekst uit het XObject, per tegel
geplaatst; vormen blijven gedeeld) → terug naar het "per-pagina zelfstandig"-G2-niveau.

*Oorspronkelijke opdracht:* Implementeer de PDF-backend (kleur-parsing, alpha/ExtGState,
baseline/align, dash, roundRect-bezier) en `paginateVectorToPdfBytes` (clip+transform,
bevroren-kolom-herhaling); Gantt-vectortak in `handleExportPDF` voor Latijn/Cyrillisch/Grieks.

**Fase 3 — PdfTable + mijlpalen/afwijkingen — ✅ UITGEVOERD (2026-07-22, `04c7fd6`).** `pdfTable.ts`
(`makeTableRenderReport`) + kolom-specs die de DOM exact spiegelen (headers via `t()`, ◆-prefix,
float<0/delta>0 rood+bold, `STATUS_COLOR`-badges, `dd.date`); DOM-screenshot-tak vervangen, raster
behouden als fallback; `STATUS_COLOR`+`fmtDelta` geëxporteerd tegen drift. Geverifieerd (echte
CPMSolver/computeVariance-data; pypdf+PyMuPDF): Type0/FontFile2, geen DCTDecode, selecteerbaar,
kolommen/kleuren/badges/lege-staat/paginering kloppen. tsc/planning(429)/build groen.

**Fase 4 — coverage-detectie + raster-fallback — ✅ UITGEVOERD (2026-07-22, `bb8af28`). HERSCOPED.**
Reden voor de herscope: het fase-2-subset-defect blokkeert de CJK-font-extensie (fase 4b), dus de
volledige extensie-API + binaire-asset-loader + font-registry (oorspronkelijk fase-4-werk) heeft nog
geen werkende afnemer — dat nu bouwen is speculatieve infra (een registry die niets embedt/consumeert).
Wél v1-kritisch: zonder detectie rendert een CJK/RTL-string als **tofu** (`subset:false` mapt onbekende
codepoints op `.notdef` — géén fout, dus de bestaande try/catch-fallback springt niet aan). Fase 4
bouwt daarom uitsluitend:
- **Coverage-detectie in `PdfVectorDraw2D`**: tijdens `fillText`-encoding per codepoint checken of het
  ingebedde Inter-font (via de fontkit-`font`) een glyph heeft; verzamel ongedekte codepoints (+ een
  RTL-vlag voor later). Dit dekt ALLE getekende tekst by-construction (Gantt én tabellen gaan door
  dezelfde `fillText`). `paginateVectorToPdfBytes` gooit bij een niet-lege set een specifieke fout →
  de **bestaande** try/catch in `handleExportPDF` valt terug op het raster-pad (dat CJK/RTL correct via
  de browser rendert).
- **Verifieer**: puur-Latijn/Cyrillisch/Grieks → vector (ongewijzigd); een taaknaam met CJK- of
  Arabische glyphs → raster-fallback (geen tofu, correcte weergave); geen valse fallback op gedekte
  tekst; geldt voor Gantt én de tabel-rapporten.

De **font-registry, extensie-API (`api.pdfFonts.register` + `pdf-fonts`-permissie + volledige
permissie-plumbing) en de binaire-asset-leveringsroute** (ZIP-entries bewaren, `StoredExtension`+record,
`api.assets.get`, `ExtensionApi`-type/`createExtensionApi`, `.js`-pad; cleanup via `cleanupFns`)
verhuizen naar **fase 4b**, samen met de subset-fix en het echte CJK-font — allemaal post-v1.

**Fase 4b — officiële CJK-font-extensie (Opus xhigh, apart deliverable, mág ná v1-merge).**
**BLOKKER OPGELOST (spike 2026-07-22):** CJK-fonts zijn 5–16 MB → subsetten is verplicht. Het
`subset:true`-defect (corrupte glyf uit `@pdf-lib/fontkit`) wordt omzeild door **harfbuzz
`hb-subset.wasm`** als pre-subsetter (MIT, 197 KB gzip, 0 imports → puur browser, lazy) vóór pdf-lib
`subset:false` — bewezen correct in pdfium/MuPDF/Chrome (WQY-CJK 11,6 MB → 3,1 KB subset). Integratie
= twee-pass in `paginateVector` (scan `usedCodepoints` → `hb-subset` → embed), `PdfVectorDraw2D`/
coverage ongewijzigd; eigen ~90-regel wasm-wrapper (niet `subset-font`, dat sleept Node-`fs`/`Buffer`).
Deze harfbuzz-pipeline is een eigen post-v1-stap (verkleint óók de Inter-PDF's) die vóór het echte
CJK-font landt. **Fase 4b omvat nu ook de uit fase 4 verschoven extensie-infra:** de
extensie-API `api.pdfFonts.register(provider)` achter een `pdf-fonts`-permissie (volledige
plumbing: `KNOWN_PERMISSIONS`, `ExtensionPermission`-type, `API_PERMISSIONS`; cleanup via
`cleanupFns`), en de binaire-asset-leveringsroute in de loader (ZIP-entries bewaren,
`StoredExtension`+record uitbreiden, `api.assets.get`, `ExtensionApi`-type/`createExtensionApi`, ook
het `.js`-pad). Daarna: pak het echte Noto Sans CJK-TTF in een extensie-ZIP (`manifest.json` +
`main.js` + font-asset via die asset-route), registreer via `api.pdfFonts.register`, voeg het
Noto-OFL-NOTICE toe, en publiceer in de catalogus. **Verifieer**: extensie installeren → showcase met echte CJK-taaknamen
exporteert vector met correcte glyphs; deïnstalleren → terug naar raster-fallback. De kern (fase 4) is
af zónder deze fase.

## Post-v1 bouwvolgorde (in uitvoering, gestart 2026-07-22)

Twee research-spikes (RTL + subset-defect) hebben de resterende onbekenden met rasterbewijs weggenomen.
Conflictvrije, sequentiële volgorde (alles raakt `paginateVector.ts`/`pdfVectorDraw2d.ts`, dus geen
parallelle edits):

1. **RTL-vector (ar/fa)** — kleiner dan gevreesd: shaping is al gratis via pdf-lib's `encodeText`
   (fontkit `layout`), single-line ⇒ geen bidi-line-breaking, en Noto Sans Arabic (~0,4 MB, glyf, OFL)
   wordt **vol in de kern ingebed** (`subset:false`, zoals Inter) → ontkoppeld van het subset-defect.
   - **RTL-1**: Noto Arabic vendoren + `bidi-js` (MIT, 5,6 KB gzip) + `bidiShape.ts` (UBA-L2-runreorder
     + per-run `fk.layout(dir)` + font-per-run + glyph-ID-emissie via `PDFHexString.of`+`showText` op
     Identity-H). Los mechanisme, nog niet in `fillText` gehaakt (main blijft groen).
   - **RTL-2**: integreren in `fillText` (snelpad ongewijzigd voor 12 locales; complex pad voor
     RTL/gemengd) + `measureText` run-summed + coverage multi-font (Arabisch → vector i.p.v. raster) +
     GPOS-posities; verifiëren tegen de browser-canvas-referentie. Geen layout-mirroring (alleen tekst).
2. **harfbuzz subset-pipeline** — eigen ~90-regel wasm-wrapper om `hb-subset.wasm`; twee-pass in
   `paginateVector` (scan `usedCodepoints` → subset → embed `subset:false`). Fixt het subset-defect,
   verkleint alle vector-PDF's (Inter mee), en is de prerequisite voor CJK.
3. **Font-provider-infra (fase 4b-kern)** — registry + `api.pdfFonts.register` + `pdf-fonts`-permissie
   + binaire-asset-loader (§4.5) voor CJK-bron-levering (het 5–16 MB-font blijft lazy/extern).
4. **Noto-CJK-extensie (fase 4b)** — het echte font via de extensie; per export gesubset met harfbuzz
   (→ ~KB in de PDF).

**CJK-voortgang (2026-07-22):**
- **CJK-1 ✅ (`14b2be6`):** harfbuzz-subset-wrapper (`hbSubset.ts`, gevendorde `hb-subset.wasm`,
  RETAIN_GIDS) + `fontRegistry.ts` (provider-registry) + rendering (coverage-multi-provider,
  `fillTextCjk`, twee-pass subset→embed→emit, F4/F5). Bewezen met testfont (MuPDF ink 0,59 = rendert).
  Inter/Noto-Arabisch blijven ongewijzigd `subset:false`.
- **Font-verify ✅:** de gemelde `@pdf-lib/fontkit`-crash was een cu2qu-conversie-artefact; de
  **officiële Noto glyf-fonts** (Google Fonts `ofl/`, variabel → statisch geïnstantieerd wght 400/700)
  gaan schoon door de pijplijn en renderen zh/ja/ko zichtbaar (MuPDF). Subset echt font 10,6 MB →
  ~200–330 KB/gewicht per export.
- **CJK-2 (in uitvoering):** font-provider-extensie-API (`api.pdfFonts.register` + `pdf-fonts`-permissie
  + volledige plumbing; binaire-asset-loader `api.assets.get`). Font-agnostisch.
- **CJK-3 (plan):** **per-regio-extensies** (zh→Noto Sans SC, ja→JP, ko→KR), Regular-only (~5–10 MB
  elk, Bold→Regular-fallback) → gebruiker installeert alleen z'n schrift, met correcte regionale
  Han-vormen. Elk brengt z'n glyf-TTF + OFL mee via de asset-loader.

**Fase 5 — docs + i18n + licentie + changelog — ✅ UITGEVOERD (2026-07-22, `f4f3882`).** Inter-OFL
gevendord (byte-identiek aan upstream) + README; changelog (vectorexport + K2-reflow-noot + OFL);
print-gids nl+en bijgewerkt; `verify:docs` groen. K5-hardcoded-labels bewust buiten v1 gescoped
(pre-existente i18n-bug, los van issue #23). *Oorspronkelijke opdracht:* De print-gids bijwerken — **let op:
die bestaat alleen als `public/docs/en/` en `public/docs/nl/gids-rapporten-printen.md` (K8),** niet
in 14 locales; verifieer welke bestaan i.p.v. `*` aan te nemen. `docs/CHANGELOG.md` (incl. de
K2-layout-reflow-noot). **OFL-NOTICE (K7):** Inter (kern) is OFL-1.1 — de licentietekst moet
meegeleverd worden. Voeg een NOTICE/licentiebestand toe voor Inter. (Recente Inter-versies hebben
géén Reserved Font Name meer, dus de RFN-regel bij subsetten is voor Inter vermoedelijk moot —
verifiëren tegen de meegeleverde versie.) Het Noto-CJK-OFL hoort bij de **CJK-extensie** (fase 4b),
niet bij de kern. **Pre-existente i18n-gaten (K5, optioneel meenemen):** `'Today'`
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
| **Tekstlaag-duplicatie bij extractie (G2)** | ✅ Opgelost + geverifieerd in fase 2.1 (`5d5c868`): tekst uit XObject, per tegel geplaatst → body-label 1×, frozen = aantal kolommen (gemeten 72×→6× op A1, git-stash vóór→na + pypdf/MuPDF). G1 blijft intact (1 vorm-XObject). |
| **`subset:true` dropt glyphs (pdf-lib/fontkit-defect)** | Root cause (spike 2026-07-22): `@pdf-lib/fontkit@1.1.1`'s glyf-subsetter schrijft corrupte coördinaat-bytes (6/15 Inter-glyphs onparsebaar; ToUnicode blijft ok). **Oplossing bewezen** (pdfium+Chrome): harfbuzz `hb-subset.wasm` pre-subsetten → dan pdf-lib `subset:false`. v1 draait nu op `subset:false` (Inter vol); post-v1 harfbuzz-pipeline verkleint PDF's + deblokkeert CJK. |
| measureText ≠ PDF-advances (afkapping/paginering wijkt) | Zelfde ingebedde TTF voor beide; definitieve plaatsing via `widthOfTextAtSize`; numerieke meting in fase 0 op diacriet-strings (K3). |
| Font-swap (systeemstack → Inter) = zichtbare export-reflow (K2) | Bewuste, deterministische wijziging; changelog-noot. |
| CFF/OTF-subsetting onbetrouwbaar | Dwing TTF (glyf) af voor alle embed-fonts (B3/B4). Exacte "kapot"-issuenummers deels ongeverifieerd; TTF-guardrail is sowieso goedkoop. |
| CJK-extensie niet geïnstalleerd | Graceful raster-fallback per document (geen "tofu"); CJK is opt-in. |
| **Extensie-loader kent geen binaire assets (onderschatte kern-kost)** | Loader/API-asset-support is echte fase-4-kern-feature (§4.5, optie 1); leveringsroute + permissie-plumbing vóór v1-freeze. Base64 (optie 2) afgeraden om startup-`new Function`-parsekost. |
| **Preview≠export voor CJK (WYSIWYG-check e faalt)** | v1: WYSIWYG alleen voor Inter-gedekte scripts; CJK-preview is benadering. Optioneel later: provider-`FontFace` in preview (§5.1). |
| Provider lekt bij uitschakelen extensie | Registratie pusht cleanup op `cleanupFns` → auto-uitschrijven bij `disableExtension` (§4.5). |
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
- Kritische review 1 (Opus xhigh): verifieerde pdf-lib `operators.ts` (clip/dash/gs/cm/bezier — API
  compleet), `@fontsource` levert geen TTF (fontsource #371/#570), Inter is al UI-font
  (`main.tsx`/`globals.css`), integratie-regelnummers, en de ~220-DPI-realiteit van de huidige
  raster-export. Bracht G1/G2 + K1–K9 in; eindoordeel "klaar-met-aanpassingen" (verwerkt).
- Kritische review 2 (Opus xhigh, na de vier scope-besluiten): verifieerde tegen de echte
  extensie-code dat de CJK-extensie een echte kern-uitbreiding vergt (ZIP-install bewaart alleen
  manifest+main `extensionService.ts:167,175`; `StoredExtension` zonder asset-veld
  `extensionLoader.ts:62-67`; geen asset-API `types.ts:107-157`; `sanitizeManifestPermissions` stript
  onbekende perms `permissions.ts:86-106`), dat de font-swap alleen print/preview raakt (niet
  `GanttRenderer`), en dat de RTL-ontkoppeling veilig is. Bracht de leveringsroute→fase-4-verschuiving,
  base64-startup-kost, CJK-preview≠export, `cleanupFns`-cleanup en de RTL-forward-compat-eis in
  (nu verwerkt). Eindoordeel "klaar-met-aanpassingen".

**Ongeverifieerd (bewust als open gemarkeerd, valideren tijdens bouw):** exacte CJK-subset-KB in de
PDF; `bidi-js` exacte gzip-grootte; woff2-in-browser-embed door `@pdf-lib/fontkit`; bundlegroottes
178/342 KB gzip (bundlephobia niet geraadpleegd); de blanket-claim "CFF-subsetting kapot" met issue
#664/#826 (alleen OpenPDF #71 bevestigd) — de TTF-guardrail staat er los van; numerieke
`widthOfTextAtSize`≈`measureText`-match (→ fase 0); Inter's volledige glyph-dekking pl/tr/Cyrillisch/
Grieks (→ render-test fase 1).
