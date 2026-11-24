# Bij het lezen van IFC is een leeg tekst- of projectveld een uitspraak

Een IFC-slot kan een waarde dragen, `$` zijn, een gequote lege string `''` zijn of ontbreken. De writer schrijft een
leeg veld als `$`, behalve verplichte tekst, die hij als `''` schrijft (ADR 0141). Voor tekstvelden en voor de projectdatums behandelt de lezer leeg als wat het bestand zegt, niet
als "onbekend", en vult hij geen tekst of projectdatum in die niet in het bestand staat. Een verzonnen waarde is geen
invoer van de planner: een projectstart van vandaag tilt via de projectstartvloer van de solver taken met voorgangers
naar de leesdatum, en een standaardtekst van deze machine maakt van een bewust lege omschrijving na heropenen een
afwijking. `ifcSlotText` leest een tekstslot: `$`, `''` en een afwezig slot geven alle drie `''`, nooit de letterlijke
`$`.

## Gevolgen

- Projectnaam: is er een `IFCPROJECT`, dan telt zijn naamslot, ook leeg; de weergave toont dan
  `common:project.untitled` ("Nieuwe planning"). Zonder `IFCPROJECT` stempelt de lezer wel een naam
  (`ImportLabels.importedProject`, anders de Engelse terugval `DEFAULT_IMPORTED_PROJECT_NAME`, net als de
  i18n-terugval op Engels): "Nieuwe planning" zou suggereren dat de import mislukte, terwijl er taken uit het bestand
  kunnen komen. De dienstlaag heeft geen `t(...)`; de aanroeper geeft de tekst mee.
- De omschrijving komt uit `IFCWORKPLAN.Description`, met terugval op `IFCPROJECT.Description`. Een kalender met
  `$` als omschrijving krijgt geen standaardomschrijving.
- Projectstart: een leeg `StartTime` van het werkplan is geen datum en wordt niet vandaag. Zonder projectstart in het
  bestand wordt de projectstart de vroegste ingelezen `ScheduleStart`, en pas zonder enige taakstart vandaag (een leeg
  project). Een leeg `FinishTime` blijft leeg. Zegt `OPS_ProjectSettings` het veld, ook als bewust leeg (NominalValue
  `$`), dan wint dat en blijft het leeg; afleiden zou de rondgang van een leeggemaakte startdatum breken. Toets:
  `check-recorded-dates.ts` 9A en 9B.
- Taakdatums volgen een andere regel. `parseDateFromIFC` leest `$` of een afwezig slot als vandaag; daarom onthoudt
  `recordedFields` per taak welke slots van `IfcTaskTime` het bestand vulde. `$` en een afwezig slot tellen daar niet,
  een gequote lege string `''` telt wel als aanwezig en leest als lege datum. Een ontbrekende `ScheduleStart` of
  `ScheduleFinish` volgt daarna de gedeelde regel `resolveMissingScheduleDates`. Rekenslots (Early/Late Start/Finish)
  met `$` of zonder waarde krijgen de eigen geplande datum van de taak, zoals de CSV-lezer: het laden rekent ze opnieuw uit, maar
  `normalizeImportedProgress` en slapende herstelde documenten lezen ze eerder. Toets:
  `check-ifc-empty-date-slots.ts`.
- Een `IFCTASK` zonder `IfcTaskTime` krijgt `createDefaultTaskTime` (vandaag, 5 dagen) en een lege lijst in
  `recordedFields`, zodat start en einde daarna als ontbrekend gelden.
- Een actualslot met `$` of zonder waarde blijft `undefined`. Een kalenderuitzondering zonder enige datum is geen uitzondering; met één
  datum is het die ene dag.
- `calendar.holidays` is altijd de gelezen lijst, ook leeg: anders kreeg een `.mpp` met nul feestdagen bij de eerste
  IFC-opslag de Nederlandse standaardfeestdagen. `generation` geldt alleen als `OPS_Calendar` het zegt.
- De lezer normaliseert `isMilestone` niet op een taak met kinderen. De app laat een mijlpaal kinderen krijgen en de
  writer schrijft de vlag zoals hij is; een reset bij het lezen liet hem bij opslaan, openen en crashherstel stil
  verdwijnen. "Een samenvatting is nooit een mijlpaal" hoort bij de exportgrens (MSPDI-writer).
- Prioriteit 0 is een geldige prioriteit; alleen een leeg of onleesbaar slot geeft `DEFAULT_PRIORITY`.
- Alleen bladtaken gaan door `normalizeImportedProgress`. Een fase draagt bron- of rollupwaarden (100 % kan zonder
  werkelijk einde voorkomen); haar voortgang, actuals en rest blijven staan, en haar status wordt afgeleid uit
  werkelijk einde, werkelijk begin of voortgang, zonder datums te verzinnen. Toets: `check-ifc-lopend-100.ts`.
- De datumlezer van IFC (`parseDateFromIFC`) is niet gedeeld met MSPDI, P6 of CSV: hij handelt de STEP-quoting en
  `$` af op de manier hierboven.
