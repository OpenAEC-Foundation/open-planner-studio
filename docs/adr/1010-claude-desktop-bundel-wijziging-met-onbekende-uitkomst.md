# Claude Desktop-bundel: een wijziging met onbekende uitkomst gaat nooit opnieuw

Het schakelstuk (`integrations/claude-desktop/src/proxy.ts`) stuurt een wijzigende tool niet opnieuw als niet
vaststaat dat de planner haar niet kreeg: twee keer uitvoeren is erger dan één keer een fout. Alleen een geweigerde
verbinding (`ECONNREFUSED`) bewijst dat de bridge niets kreeg; een verbroken verbinding, een andere netwerkfout of een
HTTP-fout kan na aflevering komen. Dan krijgt het model een fout en kiest de bundel opnieuw (`viaApp`,
`maybeDelivered` in `postApp`). Een leesaanvraag mag wel opnieuw.

## Gevolgen

- Geeft de headless planner geen antwoord op tijd op een wijziging, dan telt die als uitgevoerd maar niet opgeslagen.
  Vóór de volgende aanvraag vraagt de bundel welk document actief is (`resolveUncertain`) en markeert dat als niet
  opgeslagen, zodat een wissel naar de app het werk niet weggooit. Zolang dat onbekend blijft, gaat niets door dat het
  actieve document kan veranderen, ook een documentkeuze niet: anders telt de onzekere wijziging bij het verkeerde
  document (`viaHeadless`).
- De wachttijd van de bundel (`DEFAULT_REQUEST_TIMEOUT_MS`) ligt bewust iets boven de 120 s waarna de bridge zelf een
  `504` met een JSON-RPC-fout geeft, zodat het antwoord van de bridge eerst aankomt.
- Een `initialize`-antwoord zonder `Mcp-Session-Id` wordt aanvaard (`adoptInitialize`): een app van vóór de
  MCP-sessies stuurt er geen.
