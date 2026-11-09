# Corpus van vreemde IFC-bestanden (#804 fase 0)

Testbestanden voor de scanner en de indeling van ontwerp "Gebouwmodel behouden in IFC en IFCX"
(`docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md`, §10). De poort
`tests/planning/check-ifc-foreign-classify.ts` legt per bestand de indeling vast. De workflow
`scripts/proef/ifc-foreign.yml` (een voorstel; hoort in `.github/workflows/`) valideert de geldige bestanden met
IfcOpenShell, controleert dat het script ze byte-gelijk opnieuw maakt, en vergelijkt de TS-indeling met
`scripts/proef/classify-v9.py`. De uitkomsten van fase 0 staan in `docs/superpowers/evidence/2026-11-ifc-fase0.md`.

## Herkomst en licentie

Alle bestanden zijn door dit project gemaakt. Er staan geen externe voorbeeldbestanden in. Ze vallen onder de licentie
van de repo (LGPL-3.0).

- Externe bestanden zijn bewust weggelaten. De voorbeelden in `buildingSMART/IFC5-development` (zoals Hello Wall)
  hebben geen licentiebestand: de GitHub-API geeft voor die repo geen licentie terug (404). Zonder licentie mogen we ze
  niet opnemen. IFCX-bestanden horen bij fase 3 en 4.
- `scripts/proef/maak-oude-uitvoer.mjs` maakt de oude writer-uitvoer in `tests/planning/fixtures/oude-tags/`; die staat
  daar, want het zijn eigen bestanden.

## Gemaakt met `scripts/proef/maak-corpus.py`

IfcOpenShell 0.9.0.post1 (dezelfde versie als in de workflow). GlobalIds en tijden zijn vast, dus het script maakt
dezelfde bytes:

```bash
python3 scripts/proef/maak-corpus.py tests/fixtures/ifc-foreign              # opnieuw maken
python3 scripts/proef/maak-corpus.py --controleer tests/fixtures/ifc-foreign  # exit 1 bij een verschil
```

| Bestand | Wat het test | Schemageldig |
|---|---|---|
| `model-ifc4.ifc`, `model-ifc4x3.ifc`, `model-ifc2x3.ifc` | model zonder planning: 100 % V | ja |
| `bonsai-4d.ifc` | 4D zoals Bonsai: twee werkschema's, baseline, taken aan wanden, toewijzing met `QuantityInProcess`, gemengde `IfcRelAssignsToProcess`, kalender via `IfcRelAssignsToControl`, vreemde pset, owner history van een wand gedeeld met een taak | ja |
| `twee-werkplannen.ifc` | twee werkplannen: alleen het eerste is D | ja |
| `eigen-plus-model.ifc` | eigen bestand (`showcase-verbouwing-eengezinswoning.ifc`) plus een model onder hetzelfde project | ja |
| `oud-eigen-0.1-plus-model.ifc` | eigen bestand van v2026.9.0 (`'0.1'`, letterlijke tekst) plus een model | nee: oude eigen lay-out |
| `crlf-commentaar.ifc` | `bonsai-4d.ifc` met CRLF en commentaar tussen de delen van een entiteit | nee: tekstbewerking |
| `latin1.ifc` | `bonsai-4d.ifc` met een rauw Latin-1-byte in een tekst | nee: geen geldige UTF-8 |
| `complexe-instanties.ifc` | `model-ifc4.ifc` met complexe instanties `#n=(A()B());` | nee: tekstbewerking |
| `dubbele-globalids.ifc` | `bonsai-4d.ifc` met een GlobalId die twee keer voorkomt | nee: bewust dubbel |

Voor `oud-eigen-0.1-plus-model.ifc` opent het script de bron via een tijdelijke kopie met
`FILE_SCHEMA(('IFC4X3_ADD2'))`: IfcOpenShell 0.9 opent de oude kop `FILE_SCHEMA(('IFC4X3'))` van onze eigen oude
bestanden niet ("Unsupported schema"). Zie `knownbugs.md`.

## Proefbestanden van de council (`council/`)

Handgemaakte proeven uit de council- en reviewrondes van het ontwerp (rondes 4 tot en met 8 en de fixrondes 1 tot en met
3 van de review van PR #839). Ze zijn niet met een script te maken; ze staan hier zoals ze in die rondes zijn gebruikt.
De naam begint met de ronde (bijvoorbeeld `r6sol-` = ronde 6, Sol). Niet opgenomen: `r4/merged.ifc` (597 KB, model),
de 17 bestanden die de scanner bewust weigert (de poort maakt die gevallen zelf, synthetisch), en twee bestanden met oude
toewijzingssleutels (de echte uitvoer van de oude writers in `tests/planning/fixtures/oude-tags/` dekt die).
