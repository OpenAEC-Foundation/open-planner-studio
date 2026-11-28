# Browsertests van de app-schil: hulpcontracten, nagebootste events en ruime grenzen

De browsertests van de app-schil, de dialogen, de rapporten, de resources en de tutorials delen hulpbestanden in
`tests/browser/fixtures/` waar elke spec op leunt, en een paar tests wijken af van de gewone regel dat een
handeling een echte klik of toets is. Die opbouw blijft staan, ook als hij omslachtig lijkt: een eenvoudiger
versie verliest een race op een trage runner, slaagt op kapotte code of meet iets anders dan bedoeld.

## Gevolgen

- De `ops`-fixture (`fixtures/ops.ts`) verbergt de welkomstdialoog pas nadat die er is (`waitForWelcomeDialog`).
  `useSettingsBootstrap` zet `showWelcomeDialog: true` pas als `loadWelcomeSeen()` antwoordt; wie eerder verbergt,
  krijgt de dialoog daarna alsnog over de app heen.
- De fixture zet `ops-welcomeSeen` bewust niet: specs die na een herlaad de welkomstdialoog verwachten
  (`extensions-storage.spec.ts`), krijgen hem dan nog. `ops-formatNoticeHidden` zet zij alleen als de sleutel
  ontbreekt; het init-script draait bij elke lading, en zo houdt een spec die de sleutel zelf zet
  (`format-notice.spec.ts`) zijn waarde na een herlaad.
- `completeTour` (`fixtures/onboarding.ts`) klikt tot `ui.showTourOverlay` uit is en wacht na elke klik tot de
  kaart een andere titel toont of de rondleiding dicht is, zodat ook de laatste klik zonder volgende kaart slaagt.
  Hij telt geen stappen en stuurt niet op een label. `TourOverlay` wacht per stap tot
  `ANCHOR_WAIT_MS` op het anker en slaat de stap anders over, dus tussen twee stappen is de kaart even weg en
  kan het aantal stappen verschillen.
- `resource-color-undo.spec.ts` speelt een sleep in de kleurkiezer na met `dragPicker`: een reeks `input`-events
  en daarna één `change`, via de native value-setter van het invoerveld. Het onderwerp is die reeks; `fill` levert
  één waarde en de test gebruikt het daarom als één gekozen kleur.
- `feedback-studio.spec.ts` vervangt voor de test met een stilvallende body `window.fetch` voor alleen het
  endpoint: `route.fulfill` neemt een body als `string` of `Buffer` en kan dus geen stroom openhouden.
- `typeFast` in `feedback-venster.spec.ts` stuurt alle toetsen via CDP (`Input.dispatchKeyEvent`) zonder per toets
  te wachten. De test gaat over toetsen die binnenkomen voordat de vorige render klaar is; `page.keyboard` wacht
  per toets.
- `toast-open-sticky.spec.ts` en `delete-under-dialog.spec.ts` zetten de nepklok stil (`page.clock.pauseAt`) zodra
  de beginstand er is. Daarna vuurt een timer alleen nog via `runFor`, zodat de echte tijd die een assertion wacht
  niet meetelt. Een eigen controle (een gewone info-melding, een eigen `setTimeout`) laat zien dat `runFor` de
  timer wel laat verlopen.
- `just-updated-dialog.spec.ts` beantwoordt de GitHub Releases-API zelf met een lege lijst. De tests asserteren
  niets uit die vergelijking, en elke consolefout faalt in de teardown van `ops`; een echt antwoord zou de test
  van het netwerk van de runner laten afhangen.
- `system-theme.spec.ts` toetst de spiegel vóór de eerste paint met een licht systeemthema: zonder
  `public/theme-prepaint.js` valt de eerste paint op de standaard donker, dus een donker systeem bewijst niets. De
  test eist eerst dat `light|light` in het spoor staat; een leeg spoor zou de filtercheck daarna vacuüm laten slagen.
- `smoke.spec.ts` houdt `Backstage.tsx` en `HelpPanel.tsx` 1,5 s tegen, met twee aparte effecten. `App` importeert
  Backstage statisch, dus die vertraging valt in de appstart: de test wacht op de gestarte app en klikt pas dan op
  Bestand, dat het al geladen Backstage toont; elk waargenomen tussenbeeld moet de werkruimte of een afgewerkt
  Bestand zijn. `HelpPanel` laadt Backstage apart (`lazy`), dus na de klik op Help is de laadstand (`Laden…`) echt
  te zien.
- `title-bar.spec.ts` kiest vensterbreedtes ruim weg van de drempels van de containerqueries in `TitleBar.css`
  (400 px en 120 px). De middenruimte hangt af van de gemeten breedte van het linkercluster, en een iets ander
  lettertype in CI mag de uitkomst niet laten kantelen.
- `report-studio.spec.ts` herkent de voetstrook in de PDF als een clip-rechthoek op de onderrand van het
  printgebied die hoger is dan 15 pt en lager dan de halve pagina, niet aan een vaste hoogte. De hoogte gaat door
  twee schalen: `makeMetrics` (`printPreview.ts`) vermenigvuldigt `FOOTER_HEIGHT` met de lettertypeschaal van het
  rapport, en de PDF-pagineerder (`paginateVector.ts`) past daar de paginaschaal uit `tileLayout.ts` op toe, die bij
  *Passend op breedte* van de breedte van het rapport afhangt.
- `tutorials/runner.ts` codeert de beelden met de WebP-encoder van Chromium zelf, in een aparte lege pagina, en
  niet met een beeldbibliotheek: de generator heeft zo geen extra afhankelijkheid.
