# Gevendorde assets — `src/services/pdf/vendor`

## `hb-subset.wasm`

De HarfBuzz `hb-subset`-bibliotheek, gecompileerd naar WebAssembly. Gebruikt door
[`../hbSubset.ts`](../hbSubset.ts) als pre-subsetter voor CJK-fonts vóór de pdf-lib-embedding
(`embedFont(bytes, { subset:false })`), omdat pdf-lib's eigen `subset:true` (via `@pdf-lib/fontkit`)
corrupte glyf-coördinaten schrijft (spike 2026-07-22). De wasm heeft **0 imports** en wordt met kale
`WebAssembly.instantiate(bytes, {})` geïnstantieerd.

- **Bron:** npm-pakket [`harfbuzzjs`](https://www.npmjs.com/package/harfbuzzjs) `1.4.0`,
  bestand `dist/harfbuzz-subset.wasm`.
- **Licentie:** MIT (HarfBuzz "Old MIT"). De volledige licentietekst staat mee-gevendord naast de
  wasm in [`HarfBuzz-LICENSE.txt`](./HarfBuzz-LICENSE.txt) (verbatim kopie van het HarfBuzz-`COPYING`,
  copyrighthouders o.a. Google/Red Hat/Behdad Esfahbod). Werk dat bestand mee bij een versie-bump.
- **sha256:** `88756f9d9bb92e27d71a6344b55a53c944a9e7bf1ce53136004a93786c1c3b9f`

**Waarom gevendord i.p.v. een dep-import?** Het `harfbuzzjs`-pakket beperkt z'n `exports` tot `.`
(alleen de JS-glue), dus Vite's node-resolver blokkeert een diepe `?url`-import van het wasm-bestand.
De JS-glue zelf sleept Node-`fs`/`Buffer`/emscripten-glue mee die we niet willen. Daarom nemen we
enkel het kale wasm-bestand op en praten er rechtstreeks tegen via de HarfBuzz-C-API-exports.

Bijwerken: `npm i -D harfbuzzjs@<versie>` → kopieer `dist/harfbuzz-subset.wasm` hierheen → werk de
versie/hash hierboven bij → verwijder de dev-dep weer.
