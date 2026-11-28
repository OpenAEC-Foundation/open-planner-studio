# Headless API: een vroeg antwoord sluit de verbinding niet

De headless HTTP-API (`headless/server/server.mjs`) geeft een deel van de antwoorden voordat de body binnen is: een
ongeldige URL in een verder geldig HTTP-verzoek, een verkeerde route, methode, query of invoertype, geen geldig token, een te grote body (volgens
`Content-Length` of tijdens het lezen) en 503 `BUSY`.
Zo'n antwoord gaat via `failEarly`, en dat zet bewust geen `Connection: close`. Na het antwoord leest de server de rest
van de body en gooit die weg, tot vier keer de bodygrens of tot de uploadtijd om is; pas dan verbreekt hij de
verbinding (`docs/headless-api.md`, *Grenzen en gedrag*). HTTP dat Node zelf niet kan lezen, gaat niet via
`failEarly`: dat krijgt via `clientError` een 400 mét `Connection: close`.

De reden: met `Connection: close` sluit Node de socket direct na het antwoord, terwijl de client nog aan het uploaden
is. Een TCP-verbinding die gesloten wordt terwijl er nog ongelezen data binnenkomt, krijgt een reset, en een client die
die reset ontvangt kan het antwoord kwijtraken voordat hij het gelezen heeft. Dan komt er geen 413 of 503 aan maar een
verbindingsfout; de containersmoketest kreeg zo `fetch failed` waar hij 413 verwachtte (commit 3ee48ea86). Stap 7 van `headless/server/smoke.mjs` stuurt een body van één byte boven de grens en eist de 413; de
servertest (`server-test.mjs`) eist de meteen gegeven 503 bij te veel uploads. `headless-api.yml` draait de smoke-test
lokaal en tegen de container, de servertest lokaal.

## Overwogen

De verbinding na het antwoord meteen sluiten of vernietigen. Dat spaart het lezen van een body die toch wordt
weggegooid, maar dan krijgt juist de client die te veel stuurt zijn foutcode niet te zien.
