# Externe relaties: bron bewaken en verversen

Een paar keuzes in het bewaken en verversen van externe relaties (`docs/relaties-tussen-projecten.md`) zien er
overbodig uit, maar houden een fout tegen.

## Gevolgen

- De desktop-app bewaakt de map van een bronbestand en niet het bestand zelf (`externalSourceWatchTargets` in
  `src/engine/externalSourceWatch.ts`). Uit het weggehaalde commentaar, niet nagegaan: veel programma's slaan op via
  een tijdelijk bestand en een hernoeming, en dan verdwijnt het bewaakte bestand onder de bewaking uit.
- *Bekijken* rekent de oude kant niet opnieuw door (`previewExternalRefresh` in `src/engine/externalRefreshPreview.ts`):
  het neemt het resultaat dat de planner ziet als beginstand. Anders zou een verouderd plan (een bewerking zonder F5)
  of de weergave van de datums uit het bestand een beginstand geven die niet in de planning staat.
- Of een kant van de brontaak al gebeurd is, toetst `sourceSideHappened` (`src/engine/externalLinks.ts`) ook voor een
  verzameltaak, anders dan `startIsActual`/`finishIsActual`. Een verzameltaak draagt na de berekening de werkelijke
  datums en de voortgang van haar bladen (`writeSummaryProgress`); die helpers sluiten haar uit omdat het scherm haar
  datums uit de kinderen afleidt.
- Een koppeling met een bronpad dat de actie niet gelezen heeft, houdt haar anker en pad (`readPaths` in
  `refreshFromSources`). De terugval op project-id zou haar anders het anker en het pad geven van een andere bron met
  hetzelfde project-id.
- Voor bronnen met een bestandspad geldt: alleen als twee gelezen bronnen met verschillende paden hetzelfde project-id hebben (een IFC-kopie houdt haar
  project-id), eist `refreshFromSources` voor die bronnen het pad (`file-path`). Daarbuiten blijft project-id
  leidend, zodat een verplaatst bronbestand blijft werken.
