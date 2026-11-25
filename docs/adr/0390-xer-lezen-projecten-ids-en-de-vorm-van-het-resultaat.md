# XER lezen: welk project een rij krijgt, welke ids gelden en welke vorm het resultaat heeft

Een XER-bestand kan meerdere projecten dragen, met één tabel per soort voor alle projecten samen.
`indexXerProjectRows` (`xerReader.ts`) verdeelt de rijen in één doorgang: TASK en PROJWBS op `proj_id`, een
TASKPRED-rij op haar eigen projectvelden. Daarna leest `readXerProject` elk project apart; de route voor meerdere
projecten (`assembleXerMultiProjectImport` in `xerMultiProject.ts`) roept het per project aan, zodat er één
leesroute is. Een relatie die de lezer niet zonder gok aan één project kan geven, weigert het hele bestand, omdat
een verkeerd toegewezen relatie de planning stil verandert.

## Gevolgen

- Een TASKPRED-rij met een niet-lege `proj_id` of `pred_proj_id` (na trim) gaat naar het project van de opvolger
  en naar dat van de voorganger; een leeg veld neemt de waarde van het andere over. Twee verschillende projecten
  krijgen dus allebei de rij, en `readXerProject` maakt er vanaf de eigen kant een externe relatie van
  (`externalRelations`, `direction` `predecessor` of `successor`). Een externe relatie is brondata en geen
  `Sequence` voor de solver (`check-xer-reader.ts` 13); de twee kanten worden één `externalLink`
  (`check-xer-multi-project.ts` 10).
- Een rij met beide projectvelden leeg gaat naar het enige project waarin `task_id` en `pred_task_id` allebei als
  activiteit staan. Staat een van de twee in geen enkel project, dan weigert `readXER` met
  `XER_DANGLING_LOCAL_RELATION` (veld `task_id` als de opvolger ontbreekt, anders `pred_task_id`); delen ze geen
  of meer dan één project, dan met `XER_AMBIGUOUS_LOCAL_RELATION` (veld `proj_id`). De toewijzing wordt per paar
  `task_id` en `pred_task_id` één keer bepaald. `check-xer-project-index.ts` toetst de toewijzing, de twee
  weigeringen en dat 30 ambigue relaties tussen 12 projecten nergens terechtkomen.
- Binnen een project weigert `readXerProject` een dubbele `wbs_id`, `task_id` of `task_pred_id` met
  `XER_DUPLICATE_ID` (`assertUniqueId`), en een relatie waarvan een eindpunt dat volgens de rij in dit project
  hoort er niet als activiteit staat met `XER_DANGLING_LOCAL_RELATION`. Een lege `task_pred_id` telt niet als
  dubbel; zo'n relatie krijgt het id `xer-rel:<regelnummer>`. Dat sommige exports dat veld leeg laten, komt uit het
  weggehaalde commentaar en is niet nagegaan.
- Een project zonder activiteiten wordt geen document en telt in het verslag als overgeslagen
  (`emptyProjectsSkipped`); heeft geen enkel project activiteiten, dan weigert `readXER` met `XER_EMPTY_PROJECT`.
- Heeft de PROJECT-tabel één rij, dan geeft `readXER` één `ImportResult`; met meer rijen de meervoudige vorm, ook
  als er maar één document opent. Het verslag (`xer.report`) heeft in beide vormen dezelfde inhoud:
  `readXerProject` vult het verplichte veld met het verslag van één project, en `assembleXerMultiProjectImport`
  vervangt het in elk geopend document door een kopie van het verslag over het hele bestand
  (`check-xer-reader.ts` 0). Het veld is verplicht, zodat geen codeweg een XER-document zonder verslag oplevert.
- De metadata van activiteiten (activiteitscodes, eigen velden, notities) zet de lezer per project op de taken, nadat
  alle activiteiten van dat project gelezen zijn (`materializeXerMetadata` met de `proj_id`), zodat gelijke
  `task_id`'s in verschillende projecten elkaars metadata niet krijgen (`check-xer-metadata-wiring.ts` 1). De
  catalogus is één gedeeld, alleen-lezen object voor het hele bestand (4).
- Het bronarchief maakt `readXER` één keer per bestand, nadat alle projecten gelezen zijn; elk geopend document
  krijgt hetzelfde archiefobject, met zijn eigen metadata eraan gebonden (`bindXerImportMetadataToArchive`). Wat het
  archief draagt, staat in de regel `xer` en ADR 0048.
- De metadata van de rekenopties (`xer.scheduleOptions`) neemt de lezer veld voor veld over uit de uitkomst van
  `deriveXerScheduleOptions` (`source`, `retainedSource`, `fallbacks`, `diagnostics`, `sourceArchive`,
  `sourceRowIndexes`, `sourceRows`), niet het hele object, zodat een later toegevoegd intern veld van die afleiding
  niet als brongegeven in het archief of de IFC komt. De solver krijgt alleen `schedulingOptions`.
