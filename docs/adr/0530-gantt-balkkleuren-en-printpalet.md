# Balkkleuren op scherm en papier

De taakbalken tekenen de verzadigde merktinten uit `BRAND` (`src/engine/renderer/themePalette.ts`), in licht én
donker. Een ontzadigde set die op beide kaarten 3:1 haalt, maakt van de balken mat pastel en kost het merkkarakter.
We aanvaarden daarom dat de balken op de donkere kaart onder de 3:1 voor grafische objecten van WCAG 1.4.11 blijven,
ook in de modus kritiek pad waar de kleur het enige teken van kritiek is (uit het weggehaalde commentaar, niet
nagegaan). Alleen het hoogcontrastthema zet eigen tinten via de `--theme-bar-*`-variabelen. De drempels per kleurpaar
staan in `tests/planning/theme-contrast-thresholds.json` (`check-theme-contrast.ts`) en mogen niet lager.

## Gevolgen

- `PRINT_PALETTE` houdt eigen waarden en verwijst niet naar `BRAND`, ook waar ze nu gelijk zijn. Papier is altijd
  wit en moet in grijstinten leesbaar blijven; het scherm weegt twee kaarten tegen elkaar af. Een bijstelling van het
  schermpalet hoeft zo niet mee naar de afdruk.
- De drie baselines verschillen behalve in tint ook in helderheid (besluit eigenaar 2026-11-02, issue #741), zodat
  ze in grijs en op een zwart-witafdruk uit elkaar blijven.
