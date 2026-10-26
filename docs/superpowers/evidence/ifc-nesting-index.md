# IFC-lezen van brede taakhiërarchieën

PR: https://github.com/OpenAEC-Foundation/open-planner-studio/pull/647

## Afbakening en algoritme

De zelfstandige branch begint op `fbd4a3f9dcc7bdd308ab86b992d0b26f4670a553`.
Alleen `src/services/ifc/ifcReader.ts` wijzigt productcode. De writer-optimalisatie uit PR #641
zit hier niet in. De bestaande psetrelatie-index op main blijft ongewijzigd.

`extractNesting` indexeerde taken al op id, maar controleerde elk kind met
`parent.childIds.includes(childId)`. Voor m verschillende kinderen onder dezelfde ouder
doorzoekt dat achtereenvolgens 0, 1, …, m−1 bestaande ids: m(m−1)/2 vergelijkingen.
De brede fixture met 10.000 taken bevat één ouder met 9.999 kinderen, dus 49.985.001
vergelijkingen. Dit is een afleiding uit de bron en invoervorm, geen gemeten tijd.

Een lokale `Map<Task, Set<string>>` bewaart nu het lidmaatschap per ouder gedurende één
aanroep. De arrays blijven de volgorde bepalen. Dezelfde ouder houdt zijn index over meerdere
`IFCRELNESTS`-relaties; een kind krijgt nog steeds bij iedere geldige verschijning de dan
aangewezen ouder, ook als het kind al in de kindlijst stond. De laatste ouderrelatie wint dus
zoals voorheen. De index leeft niet voort na de import en kost O(aantal unieke kindverwijzingen)
extra geheugen. De lidmaatschapscontrole wordt gemiddeld lineair over alle verwijzingen.

## Regressie en meetopzet

`check-ifc-nesting-index.ts` controleert dubbele verwijzingen binnen en over relaties,
eerste kindvolgorde, laatste oudervoorrang, ongeldige en niet-taakverwijzingen, isolatie tussen
imports en 1k/5k/10k taken. Opslaan en heropenen controleren ook GlobalIds, bibliotheekkalenders,
kalenderherkomst, provenance en baseline. Deze batterij wordt automatisch door de bestaande
planningssuite en tijdzonematrix meegenomen; er is geen tijdsgrens in de regressiecheck.

De afzonderlijke workflow `IFC-nesting vergelijken` draait de batterij en daarna
`ifc-nesting-index.mjs` op dezelfde Ubuntu-runner met Node 22. Zij checkt expliciet de PR-head
uit, niet de tijdelijke mergecommit. Alleen wijzigingen aan eigen meet-/testbestanden en de
workflow triggeren deze vastgepinde vergelijking.

Het meetprogramma bundelt twee versies. De oude lezer komt letterlijk uit de vastgepinde
basiscommit; de nieuwe uit de gecommitte head. Alle overige productiebronnen zijn gelijk.
Het programma weigert meerdere gewijzigde productbestanden onder `src/` of ongecommitte wijzigingen.

De bestaande deterministische benchmarkgenerator levert 1k/5k/10k taken, relaties, resources en
toewijzingen. Eén variant hangt de taken onder één brede fase, de controlevariant houdt de
verdeelde WBS. Beide bevatten daarnaast een toegewezen en een ongebruikte bibliotheekkalender,
bibliotheekherkomst, baseline en importprovenance. Alleen klok en toeval staan vast;
de echte id-generator en zijn teller blijven actief. Beide bundels doen evenveel imports,
zodat ook de gegenereerde assignment-ids exact vergelijkbaar zijn.

Per invoer zijn er twee opwarmronden en zeven meetronden, afwisselend basis→nieuw en nieuw→basis.
Alleen de volledige `readIFC` valt binnen het tijdvenster: STEP-parsing en alle extractors.
Voor elke ronde vergelijken we de complete `ImportResult`, complete heropening en SHA-256 van
de importpayload, eerste opslag, heropening en tweede export. Geen payloadvelden worden weggelaten.
De opslagketen en hashberekeningen vallen buiten het tijdvenster. Het resultaat bewaart elke
ruwe tijd, invoerhash, uitvoerhash, basis/head, bronhash, Node-versie en runnergegevens.

Deze meting zegt iets over het lezen van IFC-bytes naar domeindata. Schijf-I/O, store-opbouw,
F5, layout en zichtbare wachttijd in de app vallen erbuiten. De brede variant is een gerichte
werkpakkettenlijst; de verdeelde variant laat zien of de extra index gewone WBS-invoer schaadt.

## CI-bewijs

- Vergelijking: [run 40285702465](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/40285702465),
  afgerond met `success`; gerichte batterij: 33 controles en
  `EINDOORDEEL planningssuite: GROEN (exit 0)`; vergelijkingsprogramma: exit 0.
- Gemeten head: `38b9986d2761b683e5f581b65f13276bb3c2bd06`.
- Runner: Ubuntu 24.04, image `20261023.334.3`, AMD EPYC 7763, Node `v22.23.3`,
  tijdzone `Europe/Amsterdam`; beide versies in één job op dezelfde runner.
- Ruwe gegevens: [`ifc-nesting-index.json`](ifc-nesting-index.json), ongewijzigd uit
  het CI-artefact `ifc-nesting-vergelijking`. Alle 42 meetronden hebben identieke vier
  uitvoerhashes voor basis en nieuw; ook de volledige payloadvergelijkingen zijn geslaagd.
- SHA-256 reader basis: `d62eaf7bec764c2c09374ac80d07c5c24eac543a7b86d928f5d7482288144736`.
- SHA-256 reader nieuw: `1257a5f96ea5e995b094e8b91a08ed1be14a485f5da27d2bb92679b4a95765ef`.

Medianen van zeven metingen, na twee opwarmronden:

| Invoer | Taken | Basis (ms) | Nieuw (ms) | Verschil |
|---|---:|---:|---:|---:|
| Brede fase | 1.000 | 45,73 | 40,87 | 10,6% sneller |
| Brede fase | 5.000 | 302,00 | 226,11 | 25,1% sneller |
| Brede fase | 10.000 | 957,11 | 446,21 | 53,4% sneller |
| Verdeelde WBS | 1.000 | 37,38 | 37,25 | 0,3% sneller |
| Verdeelde WBS | 5.000 | 212,87 | 208,70 | 2,0% sneller |
| Verdeelde WBS | 10.000 | 453,83 | 455,15 | 0,3% langzamer |

Bij de brede 10k-fase scheelt de volledige import op deze runner circa 511 ms. De
verdeelde controlevariant laat in deze meting vrijwel gelijke tijden zien, inclusief een
kleine negatieve uitslag op 10k. Dit is één runner met zeven steekproeven per variant;
de kleine controleverschillen rechtvaardigen geen algemene snelheidsclaim. Er is geen
meting van geheugengebruik of van de totale wachttijd in de app uitgevoerd.

Het vastleggen van dit bewijs wijzigt alleen deze toelichting en het ruwe JSON-artefact.
Productcode, fixture en meetprogramma blijven gelijk aan de gemeten head; hun hashes zijn
bij het overnemen van het artefact gecontroleerd. De reguliere CI op de uiteindelijke PR-head
blijft een aparte poort en volgt niet uit deze meting.
