# Backstage: keuzes die verrassen

Backstage (`src/components/backstage/`) vervangt in `App.tsx` de hele body zolang het tabblad Bestand actief is: de
werkruimte met het rechterpaneel is dan niet gemonteerd. Een paar keuzes in de map volgen daaruit of beschermen een
draft of een extern bestand; de reden blijkt niet uit de code.

## Gevolgen

- **Sluit project sluit eerst Backstage** (`handleCloseProject` in `Backstage.tsx`), en vraagt dan via
  `closeWithGuard`, zoals de tabstrip. De sluitvraag hoort boven de gewone werkruimte te staan, niet achter Backstage.
- **De wegnavigeerbewaker is een modulevariabele, geen store-state** (`backstageLeaveGuard.ts`). Het is alleen
  UI-coördinatie tussen Backstage en het lint, dat buiten Backstage gemount is. Zolang er een bewaker staat, blokkeert
  `shortcutRegistry.ts` de sneltoetsen die een ander document activeren (Ctrl/⌘+1–9, N, O) in plaats van te vragen:
  de Projectinfo-draft hoort bij het actieve document en een documentwissel zou hem stil weggooien.
- **De keuzedialoog bij een niet-toegepaste draft** (`UnappliedChangesDialog`) begint op Annuleren en kent geen
  backdrop-klik en geen Enter als Toepassen: wegklikken of een losse Enter mag geen projectwijziging vastleggen.
- **Een kaart uit de extensiecatalogus toont een vast icoon** (`CatalogCard` in `ExtensionManagerPanel.tsx`), niet het
  icoon uit de catalogus, ook na installatie: die JSON komt van buiten.
