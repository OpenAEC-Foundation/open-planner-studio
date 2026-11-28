# Bibliotheek- en releasetests: keuzes die verrassen

`tests/library/check-showcase-occupancy.ts` toetst geen code maar gegenereerde data: het kruis-projectconflict in de
showcase-voorbeelden komt uit `scripts/showcases.ts` en staat in `public/examples/*.ifc`. Een wijziging aan de
voorbeelden kan dat conflict laten verdwijnen zonder dat een andere test rood wordt. Daarom leest de check de
bestanden zoals ze op schijf staan en opent ze via `openExampleFromString`, de route van Backstage → Voorbeelden.

## Gevolgen

- `EXPECTED_CONFLICT_ITEMS` is de exacte set poolitems die met de drie showcases open rood mag staan, geen
  ondergrens. Een te krap gedimensioneerde demobibliotheek zette bijna elke rij rood (ADR 0174); een toets op
  "minstens deze items" ziet dat niet. Een regeneratie van de voorbeelden of een andere bibliotheekcapaciteit die
  een rij rood maakt, moet de set dus bewust aanpassen.
- De grens van 15 werkdagen verschuiving in blok (b) bewaakt alleen de orde van grootte. Hij geldt niet voor het
  tweede knelpunt (`CROSS_ITEM`, de stukadoors): de middelgrote showcase draagt bewust een eigen overbezetting op de
  stukadoors (`publicDescription` in `scripts/showcases.ts`), die de verdeling er ook uit moet werken. Daar eist de
  check alleen een voorstel zonder blokkade en zonder tekort.
- Blok (b3) toetst "Onderbrekingen toestaan" op tekort tegen geen tekort onder een bindend plafond, niet op een
  kleinere uitloop. In `ResourceLeveler.findSlot` is `scatterSlot` een terugval die pas loopt als de aaneengesloten
  scan binnen het venster geen plek vond. `computeDistribution` zet `constrainToFloat: false`, dus zonder
  `ceilingWorkdays` is er geen venster (`windowLimit` geeft `null`) en komt de terugval niet aan bod. Met een bindend
  plafond blijft de taak in de uit-stand met conflictdagen liggen; de twee standen verschillen dus alleen waar de
  uit-stand een tekort heeft. Een eis op kleinere uitloop in beide standen is daarmee onbereikbaar.
- `tests/dev-server/bump-version.test.mjs` houdt een eigen lijst van versiebestanden en leest `VERSION_FIELDS` uit
  `scripts/bump-version.js` niet. Valt een bestand uit de lijst van het script, dan blijft het in de test staan en
  wordt die rood; een gedeelde lijst zou het bestand stil uit de dekking laten vallen.
