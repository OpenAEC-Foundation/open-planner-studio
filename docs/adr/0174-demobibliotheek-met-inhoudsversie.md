# De demobibliotheek draagt een inhoudsversie

`seedDemoLibrary` in `librarySlice.ts` maakt bij het openen van een showcase-voorbeeld de demobibliotheek aan als
het bedrijf `DEMO_COMPANY_ID` nog niet bestaat, en maakt geen tweede aan als het er al is (`docs/library.md`,
*Demo-resourcebibliotheek*). Alleen op het bestaan van het bedrijf letten zou betekenen dat een latere correctie van
de demo-inhoud een bestaande installatie nooit bereikt; te krappe capaciteiten gaven zo een bezettingsoverzicht vol
rode rijen. Daarom draagt de pool een inhoudsversie (`seedVersion`). Is die lager dan `DEMO_LIBRARY_SEED_VERSION`,
dan werkt `migrateDemoLibrarySeed` de pool eenmalig bij zonder id's te veranderen of items te verwijderen, zodat
herkomststempels in projecten geldig blijven. Toets: blok (e) in `tests/library/check-demo-library.ts`.

## Gevolgen

- Veranderde de migratie inhoud, dan bumpt `seedDemoLibrary` de pool; toets (e) controleert die bump. Veranderde ze
  niets, dan zet het alleen de nieuwe `seedVersion`, zonder bump.
- Een migratie roept geen `refreshAllDocumentsFromPool` aan.
