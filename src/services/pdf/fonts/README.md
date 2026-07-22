# Ingebedde fonts — Inter (OFL-1.1)

Deze map bevat de twee TTF's die de PDF-export (`src/services/pdf/`) inbedt voor
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
