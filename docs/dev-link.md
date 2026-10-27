# Dev-link: een testbestand openen met één link

Gereedschap voor de controle van nieuwe onderdelen, geen functie voor gebruikers. Het werkt alleen in de
browser op de dev-server (`npm run dev`), niet in Tauri-dev.

```
http://<host>:<poort>/?open=<bestand>&theme=dark
```

- `open=<bestand>` opent `dev-files/<bestand>` uit de repo. Submappen mogen (`?open=ronde-2/plan.xer`);
  `..`, een absoluut pad en een backslash worden geweigerd. Codeer bijzondere tekens in de URL
  (`ronde%202/plan.ifc`).
- `theme=light|dark` zet het thema voor deze sessie. De bewaarde voorkeur (`ops-theme`) blijft staan:
  een gewone herlaad zonder `theme=` toont weer het eigen thema. Kies je in de app zelf een thema, dan
  bewaart de app die keuze zoals altijd. `theme=` werkt ook zonder `open=`.

## Hoe het werkt

Na de herstelkeuze haalt de app het bestand op en geeft het aan `openOpenedFile`. Dat is dezelfde stap
als Bestand › Openen na de bestandskiezer: formaatherkenning, bestandsnaam, meldingen, tabblad. Het
bestand komt binnen zoals in een browser zonder bestandshandle (Firefox/Safari): er is geen opslagdoel,
dus Opslaan vraagt om een plek. Een onbekend pad of een fout bij het inlezen geeft de gewone melding
"openen mislukt", met het pad erbij.

Code: `src/utils/devOpenLink.ts` (ophalen en openen), het effect in `src/App.tsx`, en
`devSessionTheme` in `src/utils/settingsStore.ts`.

## Waar testbestanden staan

In `dev-files/` in de root van de repo. De Vite-dev-server serveert elk bestand onder de projectroot,
dus ook deze map. Een build neemt hem niet mee: `vite build` kopieert alleen `public/` en wat de code
importeert, en de Tauri-app pakt alleen `dist/` in. Zet er geen klantdata in; de repo is openbaar.

## Niet in een productiebouw

Alle drie de ingangen staan achter `import.meta.env.DEV` en `!isTauri()`. De app laadt `devOpenLink` alleen met een
dynamische import vanuit die tak. `tests/planning/check-dev-open-link.ts` bewijst dat de takken in een
productiebouw wegvallen (esbuild-minify met `DEV=false`, zoals Vite), met een tegenproef in dev. Hij bewijst ook dat `?theme=` met de Tauri-marker niets doet.
