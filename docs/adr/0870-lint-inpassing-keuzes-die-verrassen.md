# De automatische inpassing van het lint: keuzes die verrassen

`useRibbonAutoFit` (`Ribbon.tsx`) maakt bij een smal venster knoppen mini en klapt veldengroepen in (de regel staat in
`.claude/rules/ui-shell.md`). Het doet dat zonder React-state: in een `useLayoutEffect` zet het `data-*`-attributen die
React niet beheert, meet `scrollWidth` en zoekt zo de stand die past, vóór de browser schildert. Zo ziet de gebruiker
geen tussenstand en kost het zoeken naar de indeling zelf geen render. Met state zou elke meetstap een
render kosten en zichtbaar knipperen.

## Gevolgen

- De waarnemers rond de automaat reageren alleen op wat de automaat zelf nooit schrijft: de MutationObserver van de
  inpassing kijkt alleen naar `data-ribbon-popover-open`, en die van de generieke ankers (`useRibbonAnchorMarkers`)
  alleen naar `childList`; het zetten van een attribuut is geen `childList`-mutatie.
- Een veldengroep met de focus in een veld klapt niet in (`keepOpen` in `collectFitItems`): een veld dat midden in
  het typen `display: none` krijgt, verliest zijn focus en zijn invoer. Om dezelfde reden blijft een ingeklapte groep
  met een open popover ingeklapt (`keepCollapsed`).
- `setMini` zet een vervangend `title` alleen bij de overgang naar mini, niet bij elke toepassing van het plan: de
  tooltip haalt het `title` tijdens hover tijdelijk weg (ADR 0670), en het steeds opnieuw aanvullen bracht de native
  tooltip terug boven de eigen tooltip.
- Het bovenste deel van `BaselineOverlaySplitButton` draagt een verborgen label: `collectRibbonButtons` neemt alleen
  knoppen met pictogram én label mee, en zonder label zou dat deel niet verkleinen.
- Een keuzelijst in een popover van het lint is een native `select` (`RibbonInlineSelect`), geen tweede
  `RibbonDropdown`: die tekent zijn opties in een eigen portal, en `useClickOutside` van de buitenste `Popover` ziet een
  klik daarin als een klik buiten de popover.
- `useRibbonTabWheel` haalt vóór de tabwissel de focus uit het actieve veld, zoals een klik op een tab: dan bewaart
  het veld zijn getypte waarde (`onBlur`). Opent dat bewaren een vraag, dan wisselt het wiel niet.
- Na elke inpassing stuurt het lint `POPOVER_REPOSITION_EVENT`. `Popover` luistert ook naar `resize`, maar die
  komt vóór de inpassing: het lint meet opnieuw vanuit een `ResizeObserver` en verplaatst de knop pas daarna. Zonder
  het tweede signaal blijft een open paneel staan waar de knop vóór het inpassen stond
  (`ribbon-status-date-time.spec.ts`).
