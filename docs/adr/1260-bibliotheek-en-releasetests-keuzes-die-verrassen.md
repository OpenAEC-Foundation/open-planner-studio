# Bibliotheek- en releasetests: keuzes die verrassen

`tests/library/check-showcase-occupancy.ts` toetst geen code maar gegenereerde data: het kruis-projectconflict in de
showcase-voorbeelden komt uit `scripts/showcases.ts` en staat in `public/examples/*.ifc`. Een wijziging aan de
voorbeelden kan dat conflict laten verdwijnen zonder dat een andere test rood wordt. Daarom leest de check de
bestanden zoals ze op schijf staan en opent ze via `openExampleFromString`, de route van Backstage → Voorbeelden;
met die bestanden toetst hij ook de uitkomsten van de bezettings- en verdeelcode.

## Gevolgen

- `EXPECTED_CONFLICT_ITEMS` is de exacte set poolitems die met de drie showcases open rood mag staan, geen
  ondergrens. Een te krap gedimensioneerde demobibliotheek zette bijna elke rij rood (ADR 0174); een toets op
  "minstens deze items" ziet dat niet. Wordt na een regeneratie of een andere bibliotheekcapaciteit een extra rij
  rood, dan wijst de check op herstel van de capaciteit of de boeking; pas de set alleen aan na een bewust besluit
  om dat conflict te tonen.
- De grens van 15 werkdagen verschuiving in blok (b) bewaakt alleen de orde van grootte. Hij geldt niet voor het
  tweede knelpunt (`CROSS_ITEM`, de stukadoors): de middelgrote showcase draagt bewust een eigen overbezetting op de
  stukadoors (`publicDescription` in `scripts/showcases.ts`), die de verdeling er ook uit moet werken. Daar eist de
  check alleen een voorstel zonder blokkade en zonder tekort.
- Blok (b3) toetst "Onderbrekingen toestaan" op tekort tegen geen tekort onder een bindend plafond, niet op een
  kleinere uitloop. In `ResourceLeveler.findSlot` is `scatterSlot` een terugval die pas loopt als de aaneengesloten
  scan geen plek vond, binnen het venster of, zonder venster, binnen zijn zoekgrens. De proef zet daarom een bindend
  plafond (`ceilingWorkdays`): de taak blijft in de uit-stand met conflictdagen liggen, en de twee standen verschillen
  alleen waar de uit-stand een tekort heeft. Een eis op kleinere uitloop in beide standen is daarmee onbereikbaar.
- `tests/dev-server/bump-version.test.mjs` houdt een eigen lijst van versiebestanden en leest `VERSION_FIELDS` uit
  `scripts/bump-version.js` niet. Valt een bestand uit de lijst van het script, dan blijft het in de test staan en
  wordt die rood; een gedeelde lijst zou het bestand stil uit de dekking laten vallen.
