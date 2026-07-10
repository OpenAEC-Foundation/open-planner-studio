# Voorbeeldplanningen

Deze map bevat **23 voorbeeldplanningen** in IFC 4.3-formaat (buildingSMART) — het
native bestandsformaat van Open Planner Studio — plus **1 NIET-PUBLIC bronbestand** voor de
externe (cross-project) koppeling in GROOT (zie §"Showcase-planningen" hieronder). Open de
voorbeeldplanningen via **Bestand → Openen**.

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
door de twintig sectorvoorbeelden hieronder. **Golf 1** leverde KLEIN + MIDDEL; **golf 2** voegt
**GROOT** toe (~250 taken) — de "kitchen sink"-showcase die de resterende geavanceerde functies
draagt: hard pin (`constraint.hard`), secundaire constraint (`constraint2`), een hammock (LOE),
near-critical-markering + meerdere kritieke paden (`floatPaths`), uren-planning
(`WorkTimeBands`) voor vlechtwerk/stort, alle 5 resourcetypes (incl. EQUIPMENT/SUBCONTRACTOR)
met een `availabilitySteps`-capaciteitsstap, alle 4 relatietypes (incl. START_FINISH), alle 6
toewijzingscurves, een externe (cross-project) koppeling naar een apart NIET-PUBLIC bronbestand,
en een rebaseline (Contract → meerwerk → Herbaseline). De drie showcases dekken **samen** de
volledige functiedekkingsmatrix (zie `scripts/verify-examples.ts`, de suite-brede union-checks).

| Bestand | Project | Taken | Demonstreert |
|---------|---------|-------|--------------|
| `showcase-verbouwing-eengezinswoning.ifc` | Verbouwing & Aanbouw Eengezinswoning (KLEIN) | 20 | Instapniveau: WBS-fasering, FS-keten met één SS-overlap (wanden/dak) en één FF-koppeling (schilderwerk vlak na tegelwerk), SNET-vergunningconstraint, start-/verplichte-oplevermijlpaal, comfortabele deadline (géén conflict), één baseline. Bewust geen resources/activity codes. |
| `showcase-rijwoningen-de-akkers.ifc` | Nieuwbouw 6 Rijwoningen De Akkers (MIDDEL) | 83 | Gedeelde fundering met vorstverlet (`extraHolidays`); doorschuivende metselploeg (CREW+LABOR) per woning; installateurs op een 4-daagse resource-kalender; afbouw met curve-variatie (UNIFORM/FRONT_LOADED/BACK_LOADED) en zichtbare overallocatie op stukadoors/schilders; per-woning verplichte opleverinspecties + een bewust te krappe contractdeadline (negatieve float); activity codes Woning×Discipline; aantekeningen (open + afgevinkt); voortgang + statusdatum halverwege; baseline vóór start. |
| `showcase-appartementencomplex.ifc` | Nieuwbouw Appartementencomplex De Vaart (GROOT) | 249 | Appartementencomplex met 3 parallelle torens A/B/C — hard-pin MSO op de vergunde wegafzetting, uren-planning (uur-kalender) voor kelder-vlechtwerk/stort, torenkraan (EQUIPMENT) met capaciteitsstap + zichtbare (met nivellering oplosbare) overallocatie op alle ruwbouw-/afbouwploegen, een hammock "Ruwbouw toren A (LOE)", twee getide kritieke ketens (torens A+B) + een near-critical toren C (floatPaths), secundaire constraint op de liftlevering, alle 6 toewijzingscurves in de afbouw, START_FINISH-relatie in fase 7, een externe koppeling naar het NIET-PUBLIC bronbestand `showcase-groot-terrein-onderaannemer.ifc` (bewust `sourceMissing`, niet in de PUBLIC-set), en een rebaseline (Contract → meerwerk op torens A+B → Herbaseline, `activeBaselineId`=Contract). |

**Extern bronbestand (NIET-PUBLIC):** `showcase-groot-terrein-onderaannemer.ifc` — een kleine,
apart aangeleverde planning ("Terreininrichting Onderaannemer", 8 taken) die het bevroren anker
levert voor GROOT's externe koppeling (§4.2 van het ontwerpdocument). Staat niet in de
Backstage-lijst (`category: 'external-source'`, buiten de `PUBLIC`-set), maar leeft wél in deze
map zodat `sourceRef.filePath` naar een echt bestand verwijst.

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
"Alle functies" + tags `klein`/`middel`/`groot`), daaronder een representatieve set eenvoudige
voorbeelden. De publieke selectie blijft samen onder ~600 kB (huidig: ~547 kB voor 8 bestanden —
GROOT alleen al ~300 kB; bij een volgende toevoeging eerst de basisselectie inkrimpen vóór het
budget wordt opgetrokken). Voeg een voorbeeld toe door het in de generator op te nemen; de
`PUBLIC`-set in `scripts/generate-examples.ts` leidt de showcase-slugs automatisch af uit
`category === 'showcase'` (het externe-koppeling-bronbestand, `category: 'external-source'`,
komt hier bewust nooit in terecht).

## Regenereren

```bash
npm run gen:examples      # regenereert examples/ + kopieert de publieke selectie + manifest
npm run verify:examples   # leest elk bestand terug via readIFC en assert tellingen/features
```

De projectdefinities staan in `scripts/showcases.ts` (KLEIN + MIDDEL), `scripts/showcase-groot.ts`
(GROOT + het externe-koppeling-bronbestand) en `scripts/example-topologies.json` (de topologie
van de twintig sectorvoorbeelden, verrijkt met fase-overlap in `scripts/gen-core.ts`). Het schema
staat in `scripts/spec.ts`.
