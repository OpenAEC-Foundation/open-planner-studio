# Tests van extensies, vertalingen en gidsen: keuzes die verrassen

De tests in `tests/planning/` voor het extensiecontract, de i18n-sleutels, de tutorials en de in-app gidsen bevatten
een paar lijsten en dubbele toetsen die overbodig lijken. Ze leggen vast wat een extensie bewust niet ziet, en ze
houden een referentie los van de pinnen, zodat een herpin niet stil ook de referentie meeneemt. De rest van wat deze
tests bewaken staat in `docs/extensions.md`, ADR 0540, ADR 0600, de regel `i18n` en `scripts/README.md`.

## Gevolgen

- `NIET_PUBLIEK` in `check-ext-contract.ts` is de lijst interne velden die bewust niet in het extensiecontract
  staan; een intern veld dat in die lijst noch in het contract staat, maakt de test rood. De redenen: `companyId` en
  `companyName` zijn de binding met de app-brede resourcebibliotheek, en een extensie die ze zet, kan een projectkopie
  laten doen alsof die uit de bibliotheek komt. `ifcSchema` en `ifcSchemaUnconfirmed` horen bij het bestand.
  `p6ProjectCode` is de bronidentiteit voor de P6-export, `dependentProjectsFolder` een pad op deze computer en
  `anchorsFromOpenDocuments` een instelling van het afhankelijke project, geen planningsdata. `plannedUnitsPerDay`
  is bronreferentie voor de P6 XML-export. `retainActiveDocument` houdt deze velden bij een lees-wijzig-laad op
  hetzelfde id vast (`ASSIGNMENT_SOURCE_FIELDS` voor de toewijzing). Een veld uit deze lijst publiek maken is een
  contractbesluit, geen reparatie van de test.
- `LEES_ALLEEN_EXT` in dezelfde test is een andere grens: `toExt*` geeft deze velden door, `fromExt*` neemt ze niet
  over, zodat een extensie-import geen P6-rekengedrag kan aanzetten of een ander rekenprofiel kan kiezen.
- `check-ext-integrity.ts` eist dat extensiecode via `globalThis` en `Function('return this')()` nog bij de
  host-globals komt. Dat pint de zin "Dit is geen sandbox" in `docs/extensions.md`: wordt die toets rood, dan is er
  een echte grens bijgekomen en mag die tekst strenger.
- `checkF3Reference` in `check-tutorial-project.ts` rekent elke stand opnieuw in uren, los van de gepinde getallen,
  en dezelfde test toetst de beoogde effecten van elke tutorial (de bouwvak schuift de oplevering, na nivelleren is
  niemand overbezet) apart van de pin. Een herpin na een motorwijziging verandert zo niet stil ook de referentie of
  het effect.
- De headerlezer `readStepCall` in `check-step-strings.ts` volgt ADR 1250: hij hergebruikt de lezer niet, omdat de
  toets bewijst dat het bestand geldig STEP is.
