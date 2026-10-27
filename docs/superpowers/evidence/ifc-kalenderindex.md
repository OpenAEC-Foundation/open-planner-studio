# IFC-kalenderkoppelingen eenmaal groeperen

De IFC-schrijver doorliep voor iedere bibliotheekkalender opnieuw alle taken en resources.
`writeCalendarLibrary` groepeert beide lijsten nu eenmaal per schrijfaanroep met de bestaande
`groupBy`. De invoervolgorde blijft behouden. Zonder bibliotheekkalenders bouwt hij geen index.
Dit raakt de gedeelde serialisatie voor opslaan, export en crashherstel.

## Meetopzet en herkomst

- Basis: `fbd4a3f9dcc7bdd308ab86b992d0b26f4670a553`.
- Gemeten wijziging: `a781adca72635c833d912c484947c887382c6246`.
- Alleen `src/services/ifc/ifcWriter.ts` verschilt in productcode; het meetscript weigert andere
  productwijzigingen of een vuile productwerkboom.
- [CI-run 40283781959](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/40283781959),
  job `vergelijk`, conclusie `success`.
- Ubuntu 22.04, AMD EPYC 7763, Node v22.23.3, tijdzone UTC.
- Deterministische benchmarkgenerator, seed `0x1fc`, maximaal 250 resources. Taken/resources
  verwijzen verdeeld naar bibliotheekkalenders, de projectkalender, geen kalender en een onbekend id.
- Twee warmups en zeven meetparen, met afwisselende volgorde op dezelfde runner. Gemeten wordt
  uitsluitend de volledige `writeIFC`-aanroep; bundelen, genereren en uitvoervergelijking vallen erbuiten.

De ruwe tijden, invoer-/uitvoerhashes en hashes van beide writerbronnen staan in
[`ifc-kalenderindex.json`](ifc-kalenderindex.json). Reproductie op een geschikte CI-runner:

```sh
node docs/superpowers/evidence/ifc-kalenderindex.mjs --base fbd4a3f9dcc7bdd308ab86b992d0b26f4670a553 --out ifc-kalenderindex.json
```

## Mediane schrijftijd

| Taken | Bibliotheekkalenders | Voor | Na | Verschil |
|---:|---:|---:|---:|---:|
| 1.000 | 0 | 37,91 ms | 38,91 ms | 2,7% langer |
| 1.000 | 64 | 38,55 ms | 31,85 ms | 17,4% korter |
| 1.000 | 512 | 62,01 ms | 48,11 ms | 22,4% korter |
| 5.000 | 0 | 170,66 ms | 172,50 ms | 1,1% langer |
| 5.000 | 64 | 181,13 ms | 167,21 ms | 7,7% korter |
| 5.000 | 512 | 225,62 ms | 179,42 ms | 20,5% korter |
| 10.000 | 0 | 353,21 ms | 337,04 ms | 4,6% korter |
| 10.000 | 64 | 348,78 ms | 347,82 ms | 0,3% korter |
| 10.000 | 512 | 406,36 ms | 363,85 ms | 10,5% korter |

De winst is gericht op veel bibliotheekkalenders. Zonder bibliotheekkalenders blijft de gemeten
spreiding klein en wisselt de richting. De meting onderbouwt geen algemene versnelling van de
hele app, bestandsschijven of de browserinterface.

## Gelijkblijvende inhoud en controles

Elke voor/na-uitvoer is volledig teken voor teken vergeleken, na uitsluitend normalisatie van de
schrijftijd in de IFC-kop, werkschema's en owner history. Dit geldt voor alle warmups en meetparen
van alle negen datasets. De invoerhash blijft ongewijzigd na schrijven.

`check-ifc-calendar-index.ts` slaagde in dezelfde CI-run: 158/158 controles,
`EINDOORDEEL planningssuite: GROEN (exit 0)`. De check gebruikt een onafhankelijke STEP-parser
voor relatie- en doelvolgorde, alle drie schema's, ongebruikte en ontbrekende kalenders, heropenen,
invoerbehoud en gewijzigde koppelingen bij een volgende save. Een leesbudget over de volledige
schrijver beschermt tegen het opnieuw invoeren van scans per kalender.

Deze gerichte controle vervangt de volledige CI niet. Die liep nog bij het vastleggen van dit
meetbewijs. Op de werkhost zijn geen Node-processen, builds, tests of devservers gestart.
