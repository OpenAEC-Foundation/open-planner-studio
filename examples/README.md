# Voorbeeldplanningen

Deze map bevat **22 voorbeeldplanningen** in IFC 4.3-formaat (buildingSMART) — het
native bestandsformaat van Open Planner Studio. Open ze via **Bestand → Openen**.

De voorbeelden worden **volledig gegenereerd door de app zelf**: `npm run gen:examples`
bouwt elke planning declaratief op via de échte Zustand-store (`addTask`, `addSequence`,
`addResource`, `assignResource`, `setCalendar`, …), draait de échte `runCPM()` voor
kalender-correcte datums en serialiseert met de échte `writeIFC`. Er is dus **geen tweede,
met de hand nagebouwde IFC-writer meer** — drift tussen de voorbeelden en de app is
structureel onmogelijk. `npm run verify:examples` haalt elk bestand daarna door de échte
`readIFC` en controleert tellingen, round-trip-stabiliteit en de aanwezige functies.

> **Jaar-onafhankelijk:** projecten ankeren relatief ("eerste maandag van maart, volgend
> jaar"); NL-feestdagen (incl. Pasen-afgeleiden) en de bouwvak worden per jaar berekend.
> Elke regeneratie levert dus actuele, plausibele datums — de voorbeelden verouderen niet.

## Showcase-planningen — schaalvarianten binnen woningbouw

Fase 2.10 (onderdeel 4) verving de drie sector-showcases (woningbouw/infra/renovatie) door
**schaalvarianten binnen woningbouw** (klein/middel/groot) — sector-diversiteit blijft gedekt
door de twintig sectorvoorbeelden hieronder. **Golf 1** levert KLEIN + MIDDEL; **golf 2** voegt
GROOT toe (~250 taken, met de resterende geavanceerde functies: hard pin, secundaire
constraint, hammock, near-critical + float paths, uren-planning, externe koppeling en de
resttypen resources/curves/relaties — zie de TODO bovenaan `scripts/verify-examples.ts`). De
twee huidige showcases dekken samen: WBS-hiërarchie, drie relatietypes (FS/SS/FF) met lags,
leads, %-lags en een ELAPSEDTIME-lag, datum-constraints + deadlines (incl. een bewust conflict
met negatieve float in MIDDEL, en een conflictvrije deadline in KLEIN), start-/eind-/verplichte
mijlpalen, activity codes + custom fields, drie resourcetypes (LABOR/CREW/MATERIAL) met
ploeg-hiërarchie, een resource-kalender (4-daagse week), drie toewijzingscurves, zichtbare
overallocatie (oplosbaar met nivellering), een vastgepinde taak (prioriteit 1000), aantekeningen
(open + afgevinkt), voortgang + statusdatum, een kalender-eigenaardigheid (vorstverlet via
`extraHolidays`) en een baseline per showcase.

| Bestand | Project | Taken | Demonstreert |
|---------|---------|-------|--------------|
| `showcase-verbouwing-eengezinswoning.ifc` | Verbouwing & Aanbouw Eengezinswoning (KLEIN) | 20 | Instapniveau: WBS-fasering, FS-keten met één SS-overlap (wanden/dak) en één FF-koppeling (schilderwerk vlak na tegelwerk), SNET-vergunningconstraint, start-/verplichte-oplevermijlpaal, comfortabele deadline (géén conflict), één baseline. Bewust geen resources/activity codes. |
| `showcase-rijwoningen-de-akkers.ifc` | Nieuwbouw 6 Rijwoningen De Akkers (MIDDEL) | 83 | Gedeelde fundering met vorstverlet (`extraHolidays`); doorschuivende metselploeg (CREW+LABOR) per woning; installateurs op een 4-daagse resource-kalender; afbouw met curve-variatie (UNIFORM/FRONT_LOADED/BACK_LOADED) en zichtbare overallocatie op stukadoors/schilders; per-woning verplichte opleverinspecties + een bewust te krappe contractdeadline (negatieve float); activity codes Woning×Discipline; aantekeningen (open + afgevinkt); voortgang + statusdatum halverwege; baseline vóór start. |

## Twintig sectorvoorbeelden

Twintig kortere planningen over uiteenlopende sectoren (woningbouw, utiliteit, infra,
renovatie, industrie). Ze tonen **échte fase-overlap** — SS/FF-relaties, leads en %-lags
op de fasegrenzen — zodat een realistisch kritiek pad **mét float** ontstaat (55–86 % van de
taken kritiek, niet bijna alles). Infra-/waterprojecten draaien op een 6-daagse kalender.
Deze voorbeelden bevatten taken, relaties, mijlpalen en een kalender, maar **geen resources**
(daarvoor zijn de showcases hierboven).

| Bestand | Project | Taken* |
|---------|---------|--------|
| `01-grachtenpand-amsterdam.ifc` | Nieuwbouw Grachtenpand Amsterdam | 51 |
| `02-renovatie-basisschool.ifc` | Renovatie Basisschool De Regenboog | 37 |
| `03-kantoorgebouw-zuidas.ifc` | Kantoorgebouw Zuidas | 57 |
| `04-appartementen-eindhoven.ifc` | Woningbouw 24 Appartementen Eindhoven | 51 |
| `05-brugvervanging-n279.ifc` | Brugvervanging N279 | 39 |
| `06-parkeergarage-utrecht.ifc` | Parkeergarage Stationsplein Utrecht | 45 |
| `07-industriehal-venlo.ifc` | Industriehal Logistiek Venlo | 36 |
| `08-zorgcentrum-de-linde.ifc` | Zorgcentrum De Linde | 47 |
| `09-rioolvervanging-delft.ifc` | Rioolvervanging Centrum Delft | 26 |
| `10-villa-wassenaar.ifc` | Villa Nieuwbouw Wassenaar | 47 |
| `11-sporthal-amstelveen.ifc` | Sporthal Gemeente Amstelveen | 35 |
| `12-windturbine-offshore.ifc` | Windturbine Fundatie Offshore | 30 |
| `13-supermarkt-albert-heijn.ifc` | Supermarkt Verbouwing Albert Heijn | 25 |
| `14-fietstunnel-arnhem.ifc` | Fietstunnel Station Arnhem | 33 |
| `15-datacentrum-agriport.ifc` | Datacentrum Agriport A7 | 41 |
| `16-dijkversterking-markermeerdijk.ifc` | Dijk Versterking Markermeerdijk | 37 |
| `17-hotel-scheveningen.ifc` | Hotel 120 Kamers Scheveningen | 49 |
| `18-station-uitbreiding-breda.ifc` | Treinstation Uitbreiding Breda | 45 |
| `19-basisschool-ikc.ifc` | Basisschool Nieuwbouw IKC | 42 |
| `20-woonwijk-almere.ifc` | Woonwijk 60 Woningen Almere | 68 |

<sub>* Aantal `IfcTask`-entiteiten, inclusief fasen (WBS) en mijlpalen.</sub>

## In de app

Een selectie staat rechtstreeks in de app onder **Bestand → Voorbeelden** (Backstage),
data-gedreven via `public/examples/manifest.json`: de showcases bovenaan (met badge
"Alle functies" + tags `klein`/`middel`), daaronder een representatieve set eenvoudige
voorbeelden. De publieke selectie blijft samen onder ~600 kB. Voeg een voorbeeld toe door het
in de generator op te nemen en de `PUBLIC`-set in `scripts/generate-examples.ts` uit te breiden
(spreadt automatisch de showcase-slugs).

## Regenereren

```bash
npm run gen:examples      # regenereert examples/ + kopieert de publieke selectie + manifest
npm run verify:examples   # leest elk bestand terug via readIFC en assert tellingen/features
```

De projectdefinities staan in `scripts/showcases.ts` (de showcases) en
`scripts/example-topologies.json` (de topologie van de twintig sectorvoorbeelden, verrijkt
met fase-overlap in `scripts/gen-core.ts`). Het schema staat in `scripts/spec.ts`.
