# X11/XWayland-browserharnas voor XER

Dit harnas voert de fase-1-gebruikstest uit tegen de browser-dev-build van precies deze
worktree. Het opent een echt zichtbaar Chromium-venster, kiest via de zichtbare Engelse knop
`Open` een XER-bestand met de echte browser-filechooser en controleert daarna zowel de DOM als
`window.__OPS__`.

## Voorwaarden

- Node 22 en npm moeten beschikbaar zijn.
- `OPS_XER_CORPUS` moet naar de corpusroot wijzen. De run gebruikt daaruit
  `crawl-xer/p6diff-baseline.xer`.
- `OPS_NODE_MODULES_DIR` kan naar een bestaande externe `node_modules` wijzen wanneer deze
  worktree geen eigen dependencies heeft. Het harnas maakt hoogstens tijdelijk een symlink en
  verwijdert die in de opruimroute.
- `OPS_PLAYWRIGHT_DIR` kan naar een bestaande installatie van `playwright-core` wijzen. Dit is
  geen productdependency en wijzigt geen lockfile.
- Er moet een zichtbaar desktopdisplay zijn. Bij een lege `DISPLAY` probeert het harnas de
  Wayland-socket `/run/user/1000/wayland-0` met `XDG_RUNTIME_DIR=/run/user/1000`,
  `WAYLAND_DISPLAY=wayland-0` en `--ozone-platform=wayland`.

Een lokale run zonder corpus, Chromium of bruikbaar display eindigt rood met exitcode 1. Een
expliciete CI-run mag overslaan met `OPS_XER_X11_CI=1`; dat is geen browserbewijs.

## Uitvoeren

```bash
OPS_XER_CORPUS="/pad/naar/testdata-crawl" \
OPS_NODE_MODULES_DIR="/pad/naar/node_modules" \
OPS_PLAYWRIGHT_DIR="/pad/naar/node_modules/playwright-core" \
npm run test:browser:x11
```

Het harnas verwijdert geërfde `OPS_DEV_GUARDED` en `OPS_DEV_PORT`, start zelf `npm run dev` en
leest de werkelijk toegewezen URL en PID uit de launcher-output. Het controleert dat de normale
bewaakte launcherregel zichtbaar is, de URL de vaste gestempelde worktreepoort gebruikt, HTTP
200 antwoordt en `/proc/PID/cwd` exact de worktree-root is. Een al actieve bewaker laat de run
rood eindigen; omzeilen met geërfde guard- of poortvariabelen is niet toegestaan. De server
wordt altijd gestopt nadat de browserrun klaar is of faalt.

De init-scriptlaag verwijdert uitsluitend binnen de testcontext `showOpenFilePicker`, zodat de
bestaande `input[type=file]`-terugval wordt gebruikt. De test vereist vervolgens een echte
Playwright `filechooser`-event en gebruikt `chooser.setFiles(...)`. Vóór de Open-klik worden alle
`open`- en `import`-methoden van de dev-bridge structureel vervangen door blokkerende wrappers.
Iedere directe of computed aanroep wordt geteld, gooit meteen een fout en maakt de run rood;
na de import moet de teller nul zijn. De store wordt alleen gelezen voor state-inspectie.

## SMALL-A-asserties

De import moet opleveren:

- één geopend document;
- acht echte XER-werk- en mijlpaaltaken (de vier afgeleide WBS-samenvattingsrijen tellen niet
  mee);
- zeven relaties;
- een aanwezig CPM-resultaat;
- een aanwezig `xerSourceArchive` en een niet-lege `xerSourceProjectId`;
- een zichtbare Engelse XER-openmelding met `helpArticleId` `gids-xer-import`.

Daarnaast moeten `window.alert`, `window.confirm` en `window.prompt` nul keer zijn aangeroepen.

## Evidence en beperking

Elke geslaagde run schrijft buiten de repo naar een unieke submap onder
`/tmp/xer-x11-evidence/`. Daarin staan metadata, de privacy-geredigeerde overzichtsscreenshot,
een afzonderlijke elementopname van de zichtbare XER-toast, de geobserveerde state en de
dev-server-output. De toastopname wordt vóór auto-dismiss gemaakt en accepteert alleen generieke
importaantallen plus `Read more`; pad-, bestands-, project-, taak- en resourcenamen zijn er niet
toegestaan. Canvas, documentnaam en tablabels worden in de overzichtsscreenshot gemaskeerd.
De metadata bevat de live lokale Git-toplevel, branch, HEAD en beginstatus om het bewijs aan de
juiste checkout te koppelen. Daardoor kan zij lokale paden bevatten en is de volledige
evidencemap uitsluitend bedoeld voor lokale opslag, niet voor publicatie of commit in de repo.

Deze test bewijst de browser-dev-build met de `input[type=file]`-terugval. Hij bewijst niet de
Chromium File System Access API, de native OS-bestandkiezer of Tauri `plugin-dialog`/`plugin-fs`.
Die OS-specifieke routes vallen buiten fase 1.
