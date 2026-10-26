# IFC-ploegindex: afbakening en bewijs

Deze wijziging vervangt uitsluitend de herhaalde resourcefilter in `writeCrewNesting`
door één lokale `groupBy` op `parentId`. Zonder ploegen wordt geen index gebouwd.
Ploegvolgorde, ledenvolgorde, dubbele voorkomens, de laatste STEP-verwijzing bij een
dubbele id, lege ploegen en de bestaande `#0`-filter blijven behouden.

De basis is `fbd4a3f9dcc7bdd308ab86b992d0b26f4670a553`. De toegewezen schone branch
is vóór implementatie teruggezet vanaf `f7ee2e77802a6d5d815449f5a7e58ff56f67fe6f`.
De kalenderindex uit #641 zit dus niet in deze wijziging of nulmeting.

## Grenzen van de schrijver

`writeIFC` maakt per aanroep een nieuwe schrijfcontext en schrijft eerst alle resources,
dan hun metadata en dan de ploegrelaties. Handmatig opslaan en opslaan-als gebruiken
`buildWriteIFCInput` in `fileSlice`; echte AutoSave gebruikt hetzelfde opslagpad.
Crashherstel gebruikt `recoverySnapshotInput`/`serializeRecoveryInput`, eveneens met
de volledige huidige resources. De nieuwe index leeft uitsluitend binnen die ene
schrijfronde. De wijziging voegt geen documentveld, cache, helper of instrumentatie toe.

Getypeerde id's zijn strings. `''`, `__proto__`, `constructor`, onbekende ouders en
leden vóór hun ploeg worden apart gecontroleerd. De oude writer dedupliceert dubbele
resource-id's niet: de id-map verwijst naar de laatste geschreven entiteit, maar alle
ledenvoorkomens blijven in de relatie staan. Dubbele ploegvoorkomens blijven eveneens
aparte relaties opleveren. Deze beschadigde invoer wordt alleen op uitvoerpariteit
getoetst, niet als schemageldig voorgesteld.

Ook een runtime-`NaN` als id bereikt de oude writer: de objectseed wordt via
stringinterpolatie gevormd. `===` koppelde NaN nooit aan zichzelf; `Map.get` doet dat
wel. Een expliciete `Number.isNaN(crew.id)`-controle behoudt dit oude gedrag.
De gewone referentiemap/filter blijft ongewijzigd. Bij stabiele invoer is iedere
resource al geschreven voordat de ploegrelaties worden gevormd; de bestaande `#0`-
filter is een vangnet, geen in de fixture geforceerd normaal pad.

## Controles

De bestaande maximale fixture in `check-ifc-roundtrip.ts` krijgt een tweede ploeg,
een lege ploeg, meerdere leden en leden vóór hun ploeg. Die fixture blijft door de
bestaande veldvergelijking, tweede roundtrip en alle drie schemapoorten lopen.
Een aanvullend blok leest de echte STEP-lijsten om hun volgorde en duplicaten te
controleren. Het controleert ook gewijzigd lidmaatschap op hetzelfde invoerobject en
het terugzetten daarvan. Dit is writerlogica; er komt geen browserblok bij.

Het CI-harnas `ifc-ploegindex.mjs` bundelt twee volledige schrijvers met exact dezelfde
huidige afhankelijkheden; alleen `ifcWriter.ts` komt voor de oude versie uit de
vastgezette basis. Het weigert andere productwijzigingen, ook wijzigingen buiten
`writeCrewNesting` in hetzelfde bestand.

Het vergelijkt alle IFC-bytes, inclusief STEP-nummers en GlobalIds, en de volledige
readerpayload met `deepStrictEqual`. Ook bij de tweede export worden geen resources,
bibliotheekvelden, provenance of GlobalIds uit de vergelijking verwijderd. De rijke
bestaande schemafixture, ploeggevallen, bibliotheekpool en XER-bronarchief worden in
IFC4, IFC4X3 en IFC4X3_ADD2 geschreven, gelezen en opnieuw geëxporteerd. Dubbele id's
en beschadigde runtime-invoer zijn aparte pariteitsgevallen. Een andere documentinvoer
tussen saves controleert dat geen index tussen documenten wordt hergebruikt. Dit
bewijst de writergrens; het simuleert geen UI-undo of echte schijf-/workerlatentie.

Alleen de klok staat vast: `Date()` zonder argumenten en `Date.now()` leveren
`2026-10-26T10:00:00.000Z`. Zo worden de FILE_NAME-tijd, IFCOWNERHISTORY en de
CreationDate van werkplan/werkschema reproduceerbaar. Er wordt geen tekst vervangen
en geen payloadveld genormaliseerd of weggelaten. Bestaande readernormalisatie tussen
de eerste en tweede export mag bestaan; oude en nieuwe schrijver moeten op elke
zelfde invoer en in elke ronde exact gelijk zijn. V8-serialisatie voor invoer- en
payloadhashes behoudt ook undefined, NaN en typed arrays; de Node/V8-versies staan
naast de hashes.

## Meetopzet en huidige bewijsstand

De volledige `writeIFC` draait op 1.000, 5.000 en 10.000 resources, telkens met 0, 1,
8 en R/5 ploegen. Elk project bevat 100 taken met relaties, toewijzingen, kalender,
resourcebibliotheekstempels, een bewaard GlobalId en importherkomst. Deze vaste
100 taken begrenzen de proef en maken resourceverschillen zichtbaar; het is geen
meting van een project met 10.000 taken, de hele app of een herstelactie.

Per geval: twee opwarmrondes, daarna zeven meetparen met afwisselend voor/na en
na/voor. De langzaamste opwarmtijd kiest 1–5 schrijfacties per sample, gericht op
100 ms. Alle afzonderlijke ruwe tijden blijven beschikbaar. Hashing, vergelijking,
fixturebouw, lezen en bundelen vallen buiten de gemeten tijd. Er is geen harde
tijdpoort en geen algemene snelheidsclaim. Ook nul/één ploeg wordt gerapporteerd,
om indexoverhead en ruis te kunnen beoordelen.

Los van de klok telt het harnas `parentId`-lezingen tijdens extra volledige
writer-aanroepen met gettervelden. Het verifieert de exacte reductie
`(C - (C > 0 ? 1 : 0)) × R`. Voor 10.000 resources en 2.000 ploegen zijn dat
19.990.000 vermeden lezingen in deze selectie. De timings gebruiken gewone objecten.
Dit is geen TDD-rood/groenclaim of producttijdmeting op basis van telwerk.

Workflow `perf-ifc-ploegindex.yml` is opt-in via `[perf-ifc-ploegen]` in de PR-titel
en eigen meet-/test-/workflowpaden. Hij draait op opened/synchronize/reopened, niet
op edited, checkt expliciet de PR-head uit en heeft alleen leesrechten en een
limiet van 15 minuten. Installatie-, meet- en testlogs met exitcodes gaan ook bij
fouten in een artifact; gedeeltelijke meetresultaten blijven behouden. De gewone
CI levert de volledige planning- en typecheckpoorten. De aanvullende workflow
controleert roundtrip, schema, GlobalIds en documentcontract afzonderlijk.

Bij het openen van de concept-PR is productuitvoering nog niet lokaal of in CI
bevestigd. Lokaal zijn uitsluitend broncontrole, `git diff --check` en `actionlint`
uitgevoerd (exit 0). Exacte head, bron-/harnashashes, invoer-/uitvoerhashes, versies,
ruwe tijden en eventuele foutstacks komen in `resultaat.json` in het CI-artifact.
Een eventuele latere resultaatnotitie moet naar de werkelijk gemeten head verwijzen.

## Bestandsoverlap gecontroleerd op 26 oktober 2026

De actuele bestandslijsten en writerpatches zijn gelezen. Geen van deze patches
wijzigt `writeCrewNesting`:

- #641: `f7ee2e77802a6d5d815449f5a7e58ff56f67fe6f`, `writeCalendarLibrary`.
- #600: `a7c04bff1911fbaa278573bd7fb1cdd0923c0c6b`, onder meer minutenmodel, taak-/relatievelden en bibliotheektransport.
- #591: `1185ba9c2185442cb8e8df9b99ce3c455067d1cc`, onder meer relaties en WBS-nesting.
- #592: `c750dcbd1b2e1b8863e6ae15b768d8fdda52ae25`, kalenderuitzonderingssleutels; inmiddels gesloten.
- #403: `ba9c0ddcbdbfe361c9a6bf40325c48efbec1d9a7`, baselinevergelijkingen.
- #650: `e6bff1d5d0a4d5f5efb26bd7e8ec12f91be5a007`, kalenderuitzonderingssleutels in de writer.

Integratie met die branches en de andere campagnewijzigingen is niet uitgevoerd.
