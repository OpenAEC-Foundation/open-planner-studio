# Voortgang importeren

Een uitvoerder op de bouwplaats werkt meestal niet in Open Planner Studio zelf. Stuur een spreadsheet
mee, laat hij invullen wat er al klaar is, en lees het teruggestuurde blad in — zonder dat je project
opnieuw hoeft te worden opgebouwd. Dat is wat deze functie doet: hij **werkt bestaande taken bij**, hij
maakt er geen nieuwe van.

## Wat je hier leert

- Waarom je eerst een peildatum zet, vóór je een blad terugleest.
- Hoe je het blad exporteert en wat de kolom `OPS Task ID` doet.
- Waar je de functie vindt.
- Welke drie kolommen worden ingelezen, en welke twee alleen ter controle dienen.
- Dat voltooiing altijd een percentage is.
- Welke datumnotaties werken, en wat er gebeurt als de app twijfelt.
- Wat een leeg veld betekent.
- Hoe koppelen werkt, en hoe je een rij met de hand koppelt.
- Waarom nieuwe rijen geen nieuwe taken worden.
- Welke rijen geweigerd worden, en waarom.
- Dat de preview verplicht is en dat je niet van document kunt wisselen tijdens de import.
- Dat je na afloop opnieuw moet berekenen.

## Zet eerst een peildatum

Voordat je een teruggestuurd blad inleest, zet je op het Planning-tabblad een **statusdatum** (de
peildatum van je project). Zonder peildatum kan de app niet beoordelen of een gemelde werkelijke datum
in de toekomst ligt — en die controle is nou juist de bescherming tegen een typefout in een
teruggestuurd blad (bijvoorbeeld een werkelijke start die per ongeluk volgende maand is ingevuld). Hoe
je de statusdatum zet en wat hij verder betekent, lees je in de gids
[Baselines & voortgang](docs://gids-baselines-voortgang).

## Het blad exporteren

Exporteer je project als CSV via Backstage → Exporteren. Elke CSV-export draagt sinds deze functie een
eerste kolom `OPS Task ID` — een technisch, voor mensen onleesbaar kenmerk dat de app gebruikt om een
teruggestuurd blad weer aan de juiste taak te koppelen. Verwijder of wijzig die kolom niet; verplaats
of sorteer de rijen gerust, dat maakt niets uit. Stuur het bestand naar de uitvoerder, laat hem de
voortgangskolommen invullen en terugsturen. Meer over de CSV-export in het algemeen staat in de gids
[Im-/export](docs://gids-import-export).

## Waar je de functie vindt

Je kunt een teruggestuurd blad op drie plekken inlezen — ze openen alle drie hetzelfde scherm:

- Backstage → Importeren, bovenaan de kaart "Voortgang bijwerken uit een blad".
- Het Planning-tabblad, in de groep Baselines & voortgang.
- Het Tabel-tabblad, in de groep Voortgang.

## Welke kolommen worden gelezen

De import leest precies drie kolommen: **Completion (%)**, **Actual Start** en **Actual Finish**. De
kolommen **Start** en **Finish** worden ook gelezen, maar uitsluitend om te controleren hóé de datums
in het bestand geschreven zijn (zie hieronder) — de waarden daarin worden nooit naar een taak
overgenomen. Wijzig je de plandatums in het teruggestuurde blad, dan gebeurt er dus niets: die kolommen
zijn alleen een ijkpunt, geen invoer.

## Voltooiing is altijd een percentage

Wat een uitvoerder in de kolom Completion (%) typt, is een percentage: `100` is honderd procent
gereed, `1` is één procent, `45,5` mag met komma of met punt. Het procentteken is optioneel — `40` en
`40%` betekenen hetzelfde. Een waarde onder 0 of boven 100 wordt geweigerd; er is geen alternatieve
lezing waarbij bijvoorbeeld `0,4` als veertig procent zou tellen.

## Datums

De volgende schrijfwijzen werken, met of zonder tijd erbij: `2026-06-09`, `9-6-2026`, `9/6/2026`,
`9.6.2026`. De app stelt voor het **hele bestand** vast of de eerste component dag of maand is —
Excel is daar consequent in, dus dat hoeft maar één keer per bestand bepaald te worden. Waar mogelijk
leidt de app dat automatisch af (bijvoorbeeld doordat een component boven de 12 uitkomt, of doordat de
datums in het blad overeenkomen met de geplande datums in je project).

Twijfelt de app, dan **vraagt** hij het je, vóór je de preview te zien krijgt: je krijgt de eerste
onduidelijke datum uit het bestand te zien, met de twee mogelijke lezingen als knop. Kies je de
verkeerde, dan kun je vanuit de preview terug naar diezelfde vraag — je koppelingen met de hand blijven
daarbij gewoon staan.

## Een leeg veld betekent: geen wijziging

Een teruggestuurd blad komt vaak deels ingevuld terug. Laat een uitvoerder een kolom leeg, dan blijft
de bestaande waarde van die taak gewoon staan — een leeg veld **wist niets**.

## Koppelen: automatisch, en met de hand

Elke rij wordt eerst gekoppeld op `OPS Task ID`. Ontbreekt die (bijvoorbeeld omdat het blad in een
ander programma is bewerkt en de kolom kwijtraakte), dan valt de app terug op de WBS-code. Een
WBS-terugval is een zwakkere aanwijzing dan het echte id, dus zo'n rij komt in de preview onder
"Koppeling betwijfeld" te staan: je kunt hem met één klik **bevestigen**, of naar een andere taak
**wijzigen**.

Is er voor een rij helemaal geen taak te vinden — bijvoorbeeld doordat de WBS-code niet uniek is, of
doordat er niets bruikbaars in staat — dan staat hij onder "Wacht op koppeling". Daar koppel je de rij
met de hand aan een taak via een zoekbaar keuzeveld (zoek op WBS-code of naam); een taak die al door
een andere rij geclaimd is, is niet nog eens te kiezen.

## Nieuwe rijen worden geen nieuwe taken

Deze import werkt uitsluitend **bestaande** taken bij. Een rij die aan geen enkele taak te koppelen is,
blijft wachten op een koppeling of wordt geweigerd — hij wordt nooit stilzwijgend een nieuwe taak. Wil
je nieuwe taken toevoegen, doe dat in de app zelf.

## Welke rijen worden geweigerd

Een rij wordt geweigerd, met een reden die de preview toont, in onder meer deze gevallen:

- De werkelijke datum ligt na de peildatum (vandaar: zet die peildatum eerst).
- Werkelijk einde ligt vóór werkelijke start.
- De rij verwijst naar een verzameltaak — die kan geen eigen voortgang dragen.
- Een datum of percentage is onleesbaar.

Eén geweigerde rij houdt de rest van het blad niet tegen: alle andere rijen worden gewoon verwerkt.

## De preview is verplicht

Voordat er iets aan je project verandert, zie je altijd eerst een preview: per rij wat er verandert (of
waarom een rij geweigerd wordt), met datums voluit geschreven zodat een dag/maand-verwisseling
opvalt. Er is geen manier om de preview over te slaan. Zolang dit scherm openstaat, kun je **niet naar
een ander document wisselen** — dat voorkomt dat koppelwerk dat je net met de hand deed, verloren gaat
door een toevallige documentwissel. Bevestig je de import, dan gebeurt dat in **één stap**: één druk op
Ctrl+Z draait het hele blad in één keer terug, nooit rij voor rij.

## Na afloop: opnieuw berekenen

Een geslaagde import werkt de voortgangsvelden van je taken bij, maar berekent de planning niet
vanzelf opnieuw door. Druk op **F5** (of de knop Berekenen) om de nieuwe voortgang in de rest van je
planning te laten doorwerken.

## Verder lezen

- [Baselines & voortgang](docs://gids-baselines-voortgang) — de statusdatum, voortgangsmodus en het
  handmatig invoeren van voortgang in de app zelf.
- [Im-/export](docs://gids-import-export) — de CSV-export in het algemeen.
