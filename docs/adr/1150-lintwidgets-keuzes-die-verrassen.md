# Lintwidgets: keuzes die verrassen

De widgets in `ribbonWidgets.tsx` zijn de componenten van het lint die niet in data passen (ADR 0480). Een paar
keuzes daarin zou een collega zonder uitleg terugdraaien; ze staan hieronder.

## Gevolgen

- De knop Relatie (`RelationDropdown`) opent altijd een keuzemenu met vaste acties. De selectie bepaalt alleen welke
  acties aan staan (`relationActionAvailability`), nooit wat de knop zelf doet: dezelfde klik doet zo altijd
  hetzelfde, ook met twee taken geselecteerd.
- De wisknop naast de statusdatum (`BaselinesProgressGroupContent`) blijft ook zonder datum in de DOM, verborgen met
  `visibility: hidden`, `aria-hidden` en `tabIndex={-1}`. Zo hangt de breedte van de groep niet af van de waarde, en
  klapt de automatische inpassing (ADR 0870) de groep bij een vaste vensterbreedte niet in of uit door alleen een
  datum in te vullen of te wissen.
- Wist de gebruiker de statusdatum met het toetsenbord (`event.detail === 0`), dan gaat de focus naar het datumveld
  ernaast, want de knop zelf wordt uitgeschakeld en de focus zou anders naar `body` vallen, ook uit de popover. Dat
  gebeurt pas na de render (`setTimeout`): `DateTextInput` neemt een nieuwe `value` niet over zolang het de focus
  heeft.
- Een component verandert de lijst layouts alleen met `updateLayouts`, op de vers gelezen lijst, nooit met
  `saveLayouts` op een eigen kopie. De layoutgroep op het lint, `FilterDialog` en `LayoutsDialog` schrijven dezelfde lijst;
  een kopie mist wat een van de andere net heeft opgeslagen.
