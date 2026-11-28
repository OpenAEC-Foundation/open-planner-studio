# Weigeringen van de browser bij bestandstoegang

Een omgeving kan de File System Access API volledig aanbieden en toch elke schrijfactie weigeren: gemeten in
commit "fix(web): val terug op downloaden wanneer de omgeving schrijven weigert" krijgt een handle uit de bestandskiezer in de ingebedde
webview van de Claude-desktopapp nooit een readwrite-grant, zodat `createWritable` `NotAllowedError` gooit. Featuredetectie
ziet dat niet. `src/services/fileAccess/webBackend.ts` onthoudt daarom de eerste `NotAllowedError` voor de rest van de
sessie (`platformRefusesWrites`, en `platformRefusesReads` voor openen) en gaat daarna meteen naar de download of naar
`<input type=file>`, in plaats van bij elke opslag eerst een toestemmingsvraag en een kiezer te tonen die niets
opleveren. Bij opslaan onthoudt de app een `SecurityError` (geen verse gebruikersactivatie, vooral bij de timer van Automatisch opslaan)
bewust niet: dat hoort bij die ene aanroep, en onthouden zou de volgende Ctrl+S met een echt gebaar naar de download
sturen.

## Gevolgen

- De herkenning gaat op `err.name`, niet op de fouttekst; die verschilt per browser, versie en taal.
- Alleen een weigering van de omgeving valt terug. Annuleren blijft annuleren (geen download, geen tweede kiezer).
- `featurePolicyBlocksFSA` kijkt vooraf naar `document.featurePolicy`, zodat een kiezer die toch geweigerd wordt niet
  eerst verschijnt. Ontbreekt `featurePolicy`, dan vangen de weigeringen hierboven het op.
- Een handle uit Recent valt bij een weigering niet terug op `<input type=file>`: die geeft geen handle om te onthouden,
  en een nieuwe kiezer is iets anders dan het recente bestand heropenen (`readRefWeb`).
