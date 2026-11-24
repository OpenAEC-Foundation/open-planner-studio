# MPP lezen: de projecteigenschappen, de statusdatum met tijd en het profiel MS Project

`parseProjectProperties` leest de projecteigenschappen uit `"   114"/Props` met de sleutels `PROPS_KEY_*` (volgens het
weggehaalde commentaar die van MPXJ `PropsKey.java`). Een `.mpp` komt uit MS Project, dus het project krijgt het
ingebouwde profiel `msproject` (`builtInProfile('msproject')`) en `readMPP` stelt `msproject` voor
(`suggestedProfileId`). Welke conventies dat profiel draagt, staat in `conventions/registry.ts`. Een hervatting buiten
de volgorde hangt aan het veld `task.time.resume` (`TaskField.RESUME`, `TaskFieldId.Resume`), niet aan een vlag op het
project.

## Gevolgen

- De naam is de titel uit de Props, anders `labels.importedProject`, anders `MS Project Import`. Projectstart en
  -einde zijn alleen een datum; zonder start zet `readMPP` het anker uit ADR 0282.
- De statusdatum houdt haar tijd. De lezer leest haar met de regel van de MSPDI-lezer voor een vreemd bestand
  (`statusDateFromXml(…, 'foreign')`), zodat elke tijd blijft, ook 08:00: het anker 08:00 is een afspraak van OPS
  (I8), en OPS schrijft geen `.mpp`. Dat MS Project de statusdatum op de standaard eindtijd bewaart (17:00, het einde
  van die dag) en dezelfde waarde als `<StatusDate>…T17:00:00` in MSPDI schrijft, zodat beide lezers voor hetzelfde
  project hetzelfde leveren, komt uit het weggehaalde commentaar.
- De kritiekgrens (`PROPS_KEY_CRITICAL_SLACK_LIMIT`, in dagen) gaat ook in de projectopties
  (`criticalDefinition: { mode: 'totalFloat', threshold }`), zodat F5 met dezelfde grens rekent als de vastgelegde
  kritiek van ADR 0285. `criticalSlackLimitDaysOf` neemt alleen een geheel getal met een absolute waarde van hoogstens
  36500 (`MAX_CRITICAL_SLACK_LIMIT_DAYS`), anders 0, de standaard van MS Project. Volgens het weggehaalde commentaar
  loopt de instelling in MS Project tot een paar duizend dagen, dus een waarde daarbuiten is een corrupt veld; de grens
  is alleen een vergelijking, geen allocatie. `check-recorded-times-formats.ts` (5-0a tot en met 5-0c) toetst 3, 0 en
  een miljard dagen.
