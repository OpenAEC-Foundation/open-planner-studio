# Rapportpaneel: export pas na de herberekening, en de sleepzone buiten de kolom

Exporteren met een verouderde planning rekent eerst door (`handleExportPDF` in `ReportPanel.tsx`) en exporteert niet
meteen daarna. `runExport` leest de kolomspec en de rijen uit de closure van de render waarin hij is aangemaakt; die kent
de nieuwe berekening nog niet, dus de PDF zou achterlopen op het scherm. Daarom zet `handleExportPDF` een vlag
(`exportPendingRef`) en start een effect de export na de render met de verse waarden.

## Gevolgen

- De sleepzone om de instellingenkolom breder te maken is een kind van de buitenste container, niet van de kolom zelf.
  De kolom scrollt (`overflow-y-auto`), en een zone die over haar rand steekt, telt daar mee als scrollbreedte en geeft
  een horizontale schuifbalk.
