# Rapportopties: labels boven het veld, en de lettertypelijst in de browser pas na een klik

In het optieblok van de tabelrapporten (`TableReportOptionsBlock.tsx`) staan Papier, Oriëntatie, Lettertype en
Aggregatie elk op een eigen rij met het label erboven, niet naast een vast-breed label zoals in `ReportFieldRow`. In de
instellingenkolom van standaardbreedte blijft naast een `w-32`-label te weinig ruimte over: volgens het weggehaalde
commentaar leest "Landscape" dan als "Landsc…" en paste "Per maand" niet. Om dezelfde reden staan de datumvelden van
`ReportingPeriodField` op een eigen rij die omslaat, en heeft het label Van/Tot geen vaste breedte: "Başlangıç" (tr)
wordt met `w-8` afgekapt.

## Gevolgen

- `CustomReportFontDialog` haalt de lijst van de lettertypen op de computer in de desktopapp meteen op, maar in de
  browser pas na een klik op de knop. Volgens het weggehaalde commentaar (niet nagegaan) hoort de toestemmingsvraag van
  de browser bij een handeling van de gebruiker.
