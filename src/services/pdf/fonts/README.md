# Ingebedde fonts — Inter + Noto Sans Arabic (beide OFL-1.1)

Deze map bevat de TTF's die de PDF-export (`src/services/pdf/`) inbedt voor
selecteerbare/doorzoekbare vectortekst in Latijnse, Cyrillische en Griekse scripts:

- `Inter-Regular.ttf` — statische glyf-instantie van `InterVariable.ttf` op gewicht 400
  (Regular), geïnstantieerd via `fonttools varLib.instancer`.
- `Inter-Bold.ttf` — dezelfde bron, geïnstantieerd op gewicht 700 (Bold).

**Herkomst**: [`rsms/inter`](https://github.com/rsms/inter) (upstream Inter-repository),
`InterVariable.ttf`. De exacte upstream release/commit is bij het vendoren (fase 0/1,
2026-07-22) niet vastgelegd; `package.json` bevat wel `@fontsource/inter@^5.2.8` als los
UI-font-pakket (CSS/woff2 voor de schermweergave — geen bron voor deze TTF's, zie
`Inter-OFL.txt`/de OFL-tekst hieronder voor waarom een aparte raw-TTF nodig was).

**Waarvoor**: PDF-embedding via `pdf-lib` + `@pdf-lib/fontkit` (`fontLoader.ts`), zodat de
Gantt-/mijlpalen-/variance-export vectorgrafisch en met selecteerbare tekst kan renderen in
plaats van als ingebedde raster-afbeelding. Zie `docs/superpowers/specs/2026-07-22-vector-pdf-export-design.md`
voor het volledige ontwerp en `docs/CHANGELOG.md` voor het gebruikersgerichte resultaat.

**Licentie**: Inter is vrijgegeven onder de SIL Open Font License, versie 1.1. De volledige
licentietekst — inclusief de verplichte copyright-regel van The Inter Project Authors — staat
in [`Inter-OFL.txt`](./Inter-OFL.txt), ongewijzigd overgenomen van de upstream `LICENSE.txt`.
De OFL staat inbedden in gegenereerde documenten (zoals onze PDF-export) uitdrukkelijk toe;
de voorwaarde is dat deze licentietekst met het font meegeleverd blijft, wat deze map borgt.

## Noto Sans Arabic (RTL-vector-uitbreiding)

Voor de RTL-vector-uitbreiding (Arabisch/Perzisch, gemengd met Latijn/cijfers) bedt de export een
tweede fontfamilie in, geshapt via de bidi/shaping-kern (`src/services/pdf/bidiShape.ts`):

- `NotoSansArabic-Regular.ttf` — statische **glyf**-instantie (geen CFF), met GSUB/GPOS, gewicht 400.
- `NotoSansArabic-Bold.ttf` — dezelfde bron, gewicht 700.

**Herkomst**: [`notofonts/notofonts.github.io`](https://github.com/notofonts/notofonts.github.io)
(`fonts/NotoSansArabic/unhinted/ttf/`), upstream Noto-release **Version 2.013**. `unitsPerEm` 1000,
1399 glyphs. Geverifieerd met fontTools: `glyf`+`loca` aanwezig, géén `CFF `/`CFF2`; cmap-dekking voor
Arabische basisletters, de Perzische extra-letters (پ چ ژ گ ی ک), Perzische cijfers ۰–۹ (U+06F0–06F9)
en Arabisch-Indische cijfers ٠–٩ (U+0660–0669).

**Waarvoor**: als apart CID-font (`Identity-H`/`CIDFontType2`, `subset:false` → CID==GID==fontkit
`glyph.id`) inbedden zodat de geshapte glyph-id's uit `bidiShape` rechtstreeks als `PDFHexString`
geëmit kunnen worden. `getArabicFontBytes(400|700)` in `fontLoader.ts` levert de bytes.

**Licentie**: Noto Sans Arabic staat onder de SIL Open Font License, versie 1.1 — volledige tekst
inclusief de copyright-regel van The Noto Project Authors in
[`NotoSansArabic-OFL.txt`](./NotoSansArabic-OFL.txt), ongewijzigd overgenomen van upstream.
