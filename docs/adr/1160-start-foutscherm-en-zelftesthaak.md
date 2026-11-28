# De start van de app: foutscherm zonder React, zelftesthaak na de render

Het foutscherm (`showFatalError` in `src/startup/fatalError.ts`) bouwt zijn elementen met de DOM-API en gebruikt
alleen i18n, geen React. Het komt in beeld bij een startfout waar de app niet langs kan, zoals een mislukte dynamische
import van `./App` in `main.tsx`, of als React een fout meldt die niemand opving (`onUncaughtError`). In beide gevallen kan React of de app-bundel de oorzaak zijn, dus mag het scherm daar niet van afhangen. Daarom importeert `main.tsx` het
statisch en `App` dynamisch. Een fout bij het laden van de taal of de instellingen haalt het scherm niet:
de app start dan met de Engelse terugval of de standaardwaarden.

## Gevolgen

- `installDevHooks` in `main.tsx` (de zelftesthaak `window.__OPS__` en de kijkscène) loopt pas na `render`. De haak
  laadt de store (`devBridge.ts` importeert `appStore`), en de browsertests wachten op `__OPS__` (`waitForOps` in
  `tests/browser/fixtures/ops.ts`) als teken dat de app er staat. Een eerdere haak maakt de store vóór de app.
