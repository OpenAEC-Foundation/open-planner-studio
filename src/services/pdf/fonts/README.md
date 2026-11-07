# Ingebedde fonts — rapportletters + Noto Sans Arabic (alle OFL-1.1)

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

## De keuzelijst *Lettertype* (issue #770)

Naast Inter levert de app drie rapportletters mee, voor de keuzelijst *Lettertype* op het tabblad
Rapport. Welke letters er zijn, onder welke bestandsnaam en welke `FontFace`-familie, staat op één
plek: `REPORT_FONTS` in `../reportFont.ts`. `fontLoader.ts` haalt de bestanden op via die namen;
`tests/planning/check-report-font.ts` leest dezelfde namen van schijf en maakt met elke letter een
vector-PDF.

Alle bestanden zijn **ongewijzigd** overgenomen (geen subset, geen tabellen weggehaald). Dat is
bewust: de OFL verbiedt een gewijzigde versie onder de *Reserved Font Name* ("Liberation",
"Carlito") te verspreiden. Het inbedden in een PDF is uitdrukkelijk toegestaan, en de `OS/2`-`fsType`
van alle bestanden is 0 (installeerbaar inbedden).

- `LiberationSans-Regular.ttf`, `LiberationSans-Bold.ttf` — zelfde tekenbreedtes als Arial.
- `LiberationSerif-Regular.ttf`, `LiberationSerif-Bold.ttf` — zelfde tekenbreedtes als Times New Roman.

  **Herkomst**: [`liberationfonts/liberation-fonts`](https://github.com/liberationfonts/liberation-fonts),
  release **2.1.5** (2021-09-30), `liberation-fonts-ttf-2.1.5.tar.gz`. **Licentie**: OFL 1.1, met
  Reserved Font Name *Liberation*; volledige tekst in [`Liberation-OFL.txt`](./Liberation-OFL.txt)
  (de upstream `LICENSE`, ongewijzigd).

- `Carlito-Regular.ttf`, `Carlito-Bold.ttf` — zelfde tekenbreedtes als Calibri.

  **Herkomst**: [`google/fonts`](https://github.com/google/fonts) `ofl/carlito/`, commit
  `07ace6abab87a122865e5cb82c7540b39551edb2` ("Carlito: Version 1.104 added"), gebouwd uit
  [`googlefonts/carlito`](https://github.com/googlefonts/carlito) op commit `a8d610ee6e4a`. **Licentie**:
  OFL 1.1, met Reserved Font Name *Carlito*; volledige tekst in [`Carlito-OFL.txt`](./Carlito-OFL.txt)
  (de upstream `OFL.txt`, ongewijzigd).

SHA-256 van de bestanden zoals overgenomen:

```
76d04c18ea243f426b7de1f3ad208e927008f961dc5945e5aad352d0dfde8ee8  LiberationSans-Regular.ttf
788abee4c806d660e8aee46689dd8540cd4bb98da03dcc9d171ce3efd99a9173  LiberationSans-Bold.ttf
058ea80864aef09a23f45cbec2bb5400bc3dfbdea01c3f10538a21fcb497fb74  LiberationSerif-Regular.ttf
d754ba427cfe0bca54ae052384baa8f842da5bd6550ad4da024ac441e7a7d5ce  LiberationSerif-Bold.ttf
f6418f708baede9789daef5d458c0f53d2a888af9820e8062934e504fedc6595  Carlito-Regular.ttf
bb5d20f79b82599ec72983597437373a80f2d2085fa91fc144fd74e876a594db  Carlito-Bold.ttf
```

**Waarom deze drie** (besluit Ethan, 7 november 2026: een klein vast setje, geen systeemletters):
ze staan onder de OFL (meeleveren en inbedden mag), hebben TrueType-contouren (`glyf`, dus
`CIDFontType2` in pdf-lib, net als Inter), en elk dekt zelf alle letters van de Latijnse en
Cyrillische talen van de app. Wat ze missen (✓, ✗, ⌘) tekent de PDF uit Inter; Arabisch en Perzisch
uit Noto Sans Arabic; CJK via de fontproviders. Ze hebben de tekenbreedtes van de drie letters die
in bouwbedrijven het meest voorkomen, zodat een rapport naast bestaande stukken van het bedrijf past.

**Een letter toevoegen**: zet het ongewijzigde upstreambestand (regular + bold, statische `glyf`-TTF)
in deze map met de licentietekst, voeg een regel toe aan `REPORT_FONTS` en `REPORT_FONT_IDS`, en een
label in alle 28 `report.json`-locales (`reportFontFamily.<id>`). `check-report-font.ts` (deel C)
toetst dan vanzelf of fontkit hem leest, of hij de letters van alle talen dekt en of de vector-PDF
slaagt. Let op: een bestand met een leeg laatste glyph (zoals Space Grotesk uit `docs/branding/`)
laat fontkit vastlopen bij volledig inbedden; deel C vangt dat.
