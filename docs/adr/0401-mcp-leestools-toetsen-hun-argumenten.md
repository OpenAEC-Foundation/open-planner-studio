# Een leestool weigert een argument dat ze niet kan toepassen

Een fout argument geeft bij een leestool geen kapotte data maar een plausibel, onjuist antwoord, waarop de agent zijn
volgende stap bouwt. `kritiek: "true"` is noch `true` noch `false`, dus zonder toets komt de hele takenlijst terug
als "de kritieke taken"; `status: "started"` zou een lege lijst geven die leest als "geen gestarte taken". Elke
leestool in `readTools.ts` toetst daarom haar argumenten zelf, vóór ze iets leest, en geeft bij een fout `VALIDATION`
met de toegestane waarden. Dat geldt ook voor onbekende sleutels (`requireOnlyKeys`, ook op de tools zonder
argumenten), al weigert de schemapoort van de dispatcher die ook: de tool moet kloppen langs elk pad dat haar
`handler` aanroept.

## Gevolgen

- `kritiek`, `zonder_relaties` en `externe_relaties` moeten een boolean zijn (`requireBool`), `status` een van
  `NOT_STARTED`, `STARTED` en `COMPLETED`, hoofdlettergevoelig. `van` en `tot` moeten beginnen met `JJJJ-MM-DD`
  (`ISO_DATE_ONLY`); de regel toetst alleen dat begin. Toetsen: `cases-stille-noops.ts`, de gevallen H10 (per fout
  argument `VALIDATION` met de naam van het argument, bij `status` ook de toegestane waarden).
- `limit` en `offset` worden geweigerd en niet geklemd (`requirePageArgs`): een stil geklemde pagina kost de
  aanroeper een ronde zonder dat hij ziet waarom. De grenzen staan in ADR 0402. Toets: `cases-stille-noops.ts`, "L1:
  …" (`limit` 0 en 5000 en `offset` −1 geven `VALIDATION`, `limit` 1000 werkt).
- Onbekende sleutels: `cases-stille-noops.ts`, "leestools: een onbekende sleutel wordt LOS geweigerd, …" (roept de
  `handler` rechtstreeks aan, buiten de dispatcher, ook met een sleutel op `planner_get_project_overview`), en
  "BATCH: een VERSCHREVEN leesfilter …" voor een stap van `planner_batch`.
- `planner_get_resource_histogram` toetst alles vóór de herberekening, die op een groot project duur kan zijn: hij
  roept `freshen` pas daarna aan. `bucket` mag alleen `dag`, `week` of `maand` zijn, zonder terugval op `week`.
  `resourceIds` moet een lijst van niet-lege strings zijn: een andere waarde zou wegvallen, en valt alles weg, dan
  geeft de tool stil het aggregaat in plaats van het gevraagde detail (ADR 0402). Elk id moet een bestaande resource
  zijn en geen kostenresource (ADR 0406); een onbekend id zou volgens het weggehaalde commentaar een lege reeks geven
  die leest als "geen belasting".
- `planner_get_critical_path` toetst de pagina ook als er geen geldig rekenresultaat is. Geen toets dekt die tak.
