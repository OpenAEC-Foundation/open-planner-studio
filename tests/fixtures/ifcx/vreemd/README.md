# Vreemde IFCX-bestanden (#804 fase 3, F3-6)

In fase 3 opent Open Planner Studio alleen een IFCX-bestand dat helemaal van haarzelf is (keuze T2;
`docs/ifcx-profiel.md`, *Wat de lezer weigert*). De bestanden hier zijn van een ander. De lezer moet ze weigeren met de
code `foreign`, en `classifyIfcx` moet `foreign` geven. `scripts/ifcx/vreemd.ts` toetst dat; de workflow
`.github/workflows/ifcx.yml` draait het op deze map en op de bestanden die hij ophaalt.

```bash
node scripts/run-ts.mjs scripts/ifcx/vreemd.ts tests/fixtures/ifcx/vreemd
```

Het script neemt elk `.ifcx`-bestand in een map, en maakt bij elk bestand met `openaec::activity` zelf een kopie waarin
dat attribuut `openaec::planning::activity` heet (de naam waar ifcx-explorer naartoe gaat, ontwerp §5.2). Ook die kopie
moet geweigerd worden. Uitgang 0: alles geweigerd; 1: een bestand werd niet als vreemd geweigerd; 2: geen bestanden.

## In deze map

Beide bestanden zijn zelf gemaakt op 27 november 2026, voor F3-6. Ze vallen onder de licentie van deze repository
(LGPL-3.0-or-later). Er staat geen bestand van een ander in.

- `muur.ifcx`: een klein model in de vorm van Hello Wall van IFC5-development: een kop van een ander, een import van
  het IFC-kernschema, `children` van project naar gebouw naar muur, en `bsi::ifc::class` op elke node.
- `werkpakketten.ifcx`: een kleine planning in de vorm van `work-packages.ifcx` van ifcx-explorer: het kopveld
  `openaecProfile`, paden `/planning/work-N`, `openaec::activity` met `start`, `endExclusive`, `status` en
  `predecessor`, en `openaec::label`.

## Opgehaald in de CI, niet in deze repository

De workflow haalt de echte voorbeelden op een vaste commit op, en geeft ze aan hetzelfde script. Ze staan niet in deze
repository, omdat hun licentie het opnemen niet toelaat of niet duidelijk is.

- **IFC5-development** (`buildingSMART/IFC5-development`), commit `1a63082ada967c683cfacee2005f8f749c8e1b79`
  (8 september 2026; op 27 november 2026 nog de laatste commit op `main`): `examples/Hello Wall/hello-wall.ifcx` en, als
  groter voorbeeld, `examples/IFC Hero Model/IFC Hero Model.ifcx` (19,8 MB, 239 entries). Licentie: de repository heeft geen
  licentiebestand in de wortel, en de GitHub-API geeft geen licentie (404). Alleen `web/LICENSE` is MIT, met de zin
  "This license applies to the viewer code", en de README zegt "The viewer source code is MIT licensed". Voor de
  voorbeelden, de schema's en `src/ifcx-core` staat er geen licentie.
- **ifcx-explorer** (`OpenAEC-Foundation/ifcx-explorer`), commit `ae3aba5c9c5df41b78d3673f10ac65fd874047d2`
  (4 november 2026): `examples/reference-school/planning/work-packages.ifcx`. De repository is privé en heeft geen
  licentiebestand (GitHub-API: 404). De Rust-crates verklaren in `Cargo.toml` `MIT OR LGPL-3.0-or-later`; dat geldt voor
  de crates, en niet aantoonbaar voor de voorbeelden.

Wat we van beide gebruiken: de workflow haalt de broncode op en draait die alleen in de CI (de validator en de composer
van IFC5-development, de crate `ifcx-project` van ifcx-explorer). Er komt niets van in de app of in een release.
