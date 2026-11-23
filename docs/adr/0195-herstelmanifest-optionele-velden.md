# Herstelmanifest: optionele velden zonder nieuwe versie

Het site-opslagdoel (`siteFileId`, `siteFileVersion`, issue #309) en het doel van een bron met een vreemd deel
(`foreignSource`, #804) kregen in het herstelmanifest geen eigen versienummer (regel `settings-autosave`). Ze worden
daarom weggelaten als er geen waarde is (`siteMetaFields`, `foreignSourceMetaFields`), zodat een manifestregel zonder
site en zonder kenmerk dezelfde velden houdt als vóór die velden bestonden. Ze worden soepel gelezen: van de site-velden telt alleen een
niet-lege string (`recoverySiteMeta`), en een `foreignSource` die geen object is, telt als afwezig
(`parseForeignSourceTarget`). Toets voor de site-velden: `check-site-storage.ts`, F1, F2 en F4.

## Gevolgen

- `datesAsRecorded` is een feit dat elke herstelronde expliciet in het manifest schrijft, geen heuristiek over de
  teruggelezen datums (`docs/xer-recovery-guardrails.md`). De datums in een snapshot kunnen gelijk zijn aan de
  vastlegging zonder dat de modus aanstond; het weggehaalde commentaar noemde als voorbeeld een bewerking die de modus
  verliet, gevolgd door een auto-save vóór de uitgestelde herberekening.
- Een manifest of webrecord dat een optioneel veld niet kent, geeft bij het lezen de veilige standaard:
  `datesAsRecorded` onwaar, geen site-doel. Voor `isDirty` leest `loadWeb` eerst de regel van een manifest met
  `documents`, dan de vlag in het oude documentrecord, en anders waar (`check-recovery-web-hold.ts`, de proeven met
  historische webvormen).
