# To-do

Lijst met dingen die we nog willen doen. Voeg nieuwe items onderaan toe.

## Openstaand

- [ ] GitHub-repo `OpenAEC-Foundation/open-planner-studio-extensions` aanmaken met `catalog.json` (zelfde formaat als `open-calc-studio-extensions`); tot die tijd toont Bladeren een nette foutmelding.
- [ ] Voorbeeld-extensie publiceren (bv. een XER- of Excel-importer) als referentie voor extensie-auteurs.
- [ ] `window.__openPlannerStudioSdk` vullen met een echte SDK-API (nu leeg object in de sandbox-require).
- [ ] `catalogError`-melding via i18n-interpolatie (`{{error}}`) i.p.v. string-concatenatie — nettere volgorde in RTL-talen (ar/fa).
- [ ] `removeResource`/`unassignResource` laten verwijderde resource-ids achter in `task.resourceIds` (pre-existing; opruimen bij een resources-iteratie).
- [ ] XML-detectie in `openFile` heeft een onlogische fallback-tak (bestand zonder MS Project- én zonder Primavera-markers valt terug op MSPDI) — robuuster maken.
- [ ] ZIP-parser: data descriptors zónder signatuur (zeldzaam) geven een 12-byte overshoot en falen veilig — CRC-validatie via central directory zou dit oplossen.

## Afgerond

