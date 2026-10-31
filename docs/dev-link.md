# Dev-link: een projectbestand openen met één link

Gereedschap voor de controle van nieuwe onderdelen, geen functie voor gebruikers. Het werkt alleen in de
browser op de dev-server (`npm run dev`), niet in Tauri-dev.

```
http://<host>:<poort>/?open=examples/03-kantoorgebouw-zuidas.ifc&theme=dark
```

- `open=<pad>` opent een bestand uit de repo; het pad begint bij de root. Meestal is dat een van de
  voorbeeldprojecten in `examples/`. `..`, een absoluut pad en een backslash worden geweigerd. Codeer
  bijzondere tekens in de URL (`%20` voor een spatie).
- `theme=light|dark` zet het thema voor deze sessie. De bewaarde voorkeur (`ops-theme`) blijft staan:
  een gewone herlaad zonder `theme=` toont weer het eigen thema. Kies je in de app zelf een thema, dan
  bewaart de app die keuze zoals altijd. `theme=` werkt ook zonder `open=`.
- `tab=<tab>` opent die tab van het lint, bijv. `tab=planning` of `tab=beeld`. Werkt ook zonder `open=`.

## Hoe het werkt

Na de herstelkeuze haalt de app het bestand op en geeft het aan `openOpenedFile`. Dat is dezelfde stap
als Bestand › Openen na de bestandskiezer: formaatherkenning, bestandsnaam, meldingen, tabblad. Het
bestand komt binnen zoals in een browser zonder bestandshandle (Firefox/Safari): er is geen opslagdoel,
dus Opslaan vraagt om een plek. Een onbekend pad of een fout bij het inlezen geeft de gewone melding
"openen mislukt", met het pad erbij.

Code: `src/utils/devOpenLink.ts` (ophalen en openen), het effect in `src/App.tsx`, en
`devSessionTheme` in `src/utils/settingsStore.ts`.

## Waar testbestanden staan

In `examples/`: de voorbeeldprojecten die ook in de app zitten. Er is geen aparte map. De Vite-dev-server
serveert elk bestand onder de projectroot, dus `examples/` is er zonder extra instelling. Een selectie
staat ook in `public/examples/` (`npm run gen:examples`); die kopieën zijn gelijk aan de bron, dus het
maakt niet uit welke de dev-server levert. Een build neemt `examples/` niet mee: `vite build` kopieert
alleen `public/` en wat de code importeert, en de Tauri-app pakt alleen `dist/` in. Een eigen testbestand
mag ook elders in de repo staan; zet er geen klantdata in, want de repo is openbaar.

## Niet in een productiebouw

Alle drie de ingangen staan achter `import.meta.env.DEV` en `!isTauri()`. De app laadt `devOpenLink`
alleen met een dynamische import vanuit die tak. `tests/planning/check-dev-open-link.ts` bewijst dat de
takken in een productiebouw wegvallen (esbuild-minify met `DEV=false`, zoals Vite), met een tegenproef in
dev. Hij bewijst ook dat `?theme=` met de Tauri-marker niets doet.
