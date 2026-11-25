# Een companyId uit een poolbestand

Een poolbestand draagt het `companyId` van de bibliotheek waaruit het geëxporteerd is, en `readPoolIFC`
(`src/services/library/libraryIfc.ts`) neemt elke niet-lege tekst over zonder verdere toets. Waarom de gereserveerde
id's `DEFAULT_COMPANY_ID` en `DEMO_COMPANY_ID` (`RESERVED_COMPANY_IDS`) geen identiteit bewijzen en waarom een id als
`__proto__` geweigerd wordt, staat in `docs/library.md` (*Pool-import: twee expliciete routes*, critreview F1 en F2).
Hier staat hoe `src/services/library/libraryOps.ts` dat toetst en welke functies dezelfde voorrang delen.

## Gevolgen

- `isSafeFileCompanyId` aanvaardt alleen een id dat past op `^[A-Za-z0-9_-]{1,64}$` (`SAFE_COMPANY_ID_PATTERN`) en
  niet `__proto__`, `constructor` of `prototype` is (`UNSAFE_COMPANY_IDS`). Een lijst van toegestane tekens en geen
  lijst van verboden tekens, omdat een verbodslijst een variant mist. De drie namen staan er apart bij omdat ze
  alleen uit toegestane tekens bestaan. Toets: het blok "isReservedCompanyId / isSafeFileCompanyId" in
  `tests/library/check-library-ops.ts` (ook 64 en 65 tekens).
- `importPoolAsNewCompany` (`src/state/slices/librarySlice.ts`) gebruikt het id uit het bestand als sleutel in
  `companies` en `pools` alleen als het niet leeg is, `isSafeFileCompanyId` waar geeft, `isReservedCompanyId` onwaar
  en er lokaal nog geen bibliotheek met dat id is; anders `generateId('company')`. `replacePool` schrijft de pool
  onder het id van de gekozen lokale bibliotheek, niet onder dat uit het bestand.
- `resolvePoolImportPreselection` (de voorselectie in `PoolImportDialog`) geeft `replace` met die bibliotheek alleen
  bij een id dat niet leeg, veilig en niet gereserveerd is en lokaal bestaat; anders `add`. Toets: het blok
  "resolvePoolImportPreselection" in `check-library-ops.ts`.
- `classifyPoolImportIdentityHint` kiest de regel die `PoolImportDialog` onder "toevoegen" toont:
  `fresh-identity` (`companyLibrary.importAsNewFreshIdentityHint`) bij een gereserveerd of onveilig id, `collision`
  (`companyLibrary.importAsNewCopyHint`) bij een ander id dat lokaal al bestaat, en anders `none` (geen regel).
  Gereserveerd of onveilig gaat vóór een lokale botsing, net als in de twee functies hierboven. Reden voor twee
  teksten: bij een gereserveerd of onveilig id is niet gezegd dat de bibliotheek lokaal bekend is (de
  demobibliotheek kan hier nog nooit aangemaakt zijn), dus de tekst van `collision` zou daar niet kloppen. Toets: het
  blok "classifyPoolImportIdentityHint" in `check-library-ops.ts`.
