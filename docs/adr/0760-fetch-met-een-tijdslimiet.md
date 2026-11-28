# Fetch met een tijdslimiet: een eigen signaal en een race

Een kale `fetch` heeft geen tijdslimiet; een server die de verbinding openhoudt zonder te antwoorden, laat elke UI die
erop wacht (de tutorialvraag, de installeerknop in de catalogus) eeuwig hangen. `fetchWithTimeout` en
`fetchWithIdleTimeout` (`src/services/fetchWithTimeout.ts`) breken het verzoek daarom af met een eigen
`AbortController`.

## Gevolgen

- `init` neemt geen eigen `signal` aan (`FetchInit` laat het weg). Twee signalen combineren vraagt `AbortSignal.any`,
  en volgens het weggehaalde commentaar ontbreekt die in oudere WebKit-versies (niet nagegaan). Een signaal van de
  aanroeper zou het eigen signaal anders stil overschrijven.
- `run` wacht met `Promise.race` op het werk en op het afbreeksignaal. Die race lijkt dubbel naast het signaal dat
  `fetch` al krijgt, maar maakt de limiet hard, ook als `fetchImpl` of `read` het signaal negeert. Welke afwijzing de
  race wint, hangt af van de volgorde van microtaken; of de limiet verliep, beslist daarom `controller.signal.aborted`,
  niet de soort fout.
