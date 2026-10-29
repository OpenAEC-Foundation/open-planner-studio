# IFC-lezen: property-relaties één keer indexeren

Gerichte optimalisatie ten opzichte van `522589202` op `main`, 22-10-2026. De 10k-dataset bevat
86.960 STEP-entiteiten en 15.688 property-relaties. Het CPU-profiel wees herhaalde scans,
referentieparsing en `stripQuotes` in de property-extractors aan. De reader deelt nu één index met
opgeloste psets, namen en doelverwijzingen. De kalenderindex bewaart uitsluitend kalenderpsets;
een aparte doellijst voor iedere taak is niet nodig. De scheduler, store en recovery zijn ongewijzigd.

De definitieve resultaten staan in [ifc-property-relaties.json](./ifc-property-relaties.json).
De cijfers hieronder betreffen uitsluitend de async IFC-reader uit `formatRegistry`, zonder store
of browser. Ze zijn geen meting van de totale opentijd in de app.

Productcode: `53049917515597244b0593f6088d6c1152bdb8e3`. Mediaan over zeven afwisselende paren:

- 1.000 taken: 77,0 → 66,0 ms wandkloktijd (14,3% sneller); CPU 184,8 → 142,1 ms.
- 5.000 taken: 338,7 → 318,2 ms (6,1% sneller); CPU 478,0 → 485,5 ms (1,6% hoger).
- 10.000 taken: 694,5 → 622,3 ms (10,4% sneller); CPU 944,4 → 905,1 ms (4,2% lager).

Bij 10k zijn zes van zeven paren sneller; bereik voor 670,5–710,5 ms, na 610,9–735,4 ms.
De gedeelde machine geeft uitschieters. Bij 5k is geen CPU-winst aangetoond; de kleine stijging wordt
hier niet als verbetering gepresenteerd. De historische nulmeting van 826 ms had andere broncode
en meetomstandigheden en is daarom niet de noemer van deze vergelijking.

De index bevat tijdelijke metadata per property-relatie en verdwijnt met de entiteitenlijst via
een WeakMap. Piekgeheugen is niet apart gemeten. Browser-/store-opentijd is evenmin gemeten.

## Methode en reproductie

Node v24.22.0, Linux, AMD Ryzen 7 3700U; gedeelde machine. De JSON bevat starttijd, load average,
bronhashes, dataset-hashes en alle afzonderlijke wandklok-/CPU-metingen. Er draaide tijdens de
definitieve meting geen eigen typecheck, lint of testsuite. Andere worktrees kunnen wel belasting
veroorzaken. CPU-tijd omvat ook V8-achtergrondwerk en is daarom een aanvullende controle.

De bestaande generator maakt één keer de drie bestanden met seed `0x5eed`, acht resources en een
berekend schema. Beide lezers krijgen exact dezelfde bytes. De vergelijking bundelt tweemaal
dezelfde code met esbuild en productieflags; alleen `ifcReader.ts` wordt voor de nulmeting uit
`522589202` geladen. Twee opwarmrondes en zeven meetrondes per grootte, afwisselend voor/na en
na/voor, in hetzelfde Node-proces. Een expliciete GC staat buiten iedere tijdmeting.

Voer de opdrachten achtereenvolgens uit vanuit de repositoryroot:

```bash
node scripts/run-ts.mjs scripts/measure-large-plans-data.ts --out build/ifc-property-relaties-data --sizes 1000,5000,10000 --repeats 1
node --expose-gc docs/superpowers/evidence/meet-ifc-property-relaties.mjs --before 522589202 --data build/ifc-property-relaties-data --out build/ifc-property-relaties.json
```

De schrijftijd varieert bij generatie; `contentSha256` normaliseert die volgens de bestaande
datasetgenerator. `inputSha256` bewijst dat de twee lezers binnen deze run dezelfde bytes kregen.

## Pariteit en checks

Het meetscript vergelijkt het volledige importmodel met `deepStrictEqual` en de opnieuw geschreven
IFC byte voor byte: 45 bestaande repository-IFC's, de drie grote datasets en een rijke fixture plus
een XER-bronarchief, elk geschreven als IFC4, IFC4X3 en IFC4X3_ADD2 (54 invoeren).
De pariteitsbundels geven uitsluitend nieuwe gegenereerde ids een deterministische teller en zetten
de klok vast; geen modelvelden worden weggelaten. De tijdmetingen gebruiken de gewone id-generator
en klok. Resultaathashes per invoer staan in de JSON.

`check-ifc-property-relations.ts` bewaakt daarnaast 30 asserties over bestandsvolgorde,
gedeelde psets, dubbele relaties/doelen, eerste/laatste-wint, STEP-gecodeerde psetnamen, ongeldige
verwijzingen, losse psets en opeenvolgende imports, verdeeld over de drie schrijfschema's.

De volledige planningsrun is op verzoek gestopt wegens machinebelasting (exit 143); de optionele
MPP-corpusbevinding daaruit staat in `knownbugs.md` onder #175. Definitieve checks:

- `npm run typecheck`: exit 0.
- Alle 21 `check-ifc-*.ts`-batterijen plus `check-document-contract.ts` en `check-headless-core.ts`
  via één gerichte `tests/planning/run.sh`-aanroep: exit 0, eindoordeel GROEN; geen tijdzonematrix.
- `npx eslint src/services/ifc/ifcReader.ts`: exit 0.
- `npm run verify:conventions`: exit 0.
- Meetscript, inclusief volledige import-/writerpariteit voor 54 invoeren: exit 0.

Volledige CI en onafhankelijke review blijven bij de parent. Geen budgetten gewijzigd.
