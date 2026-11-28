# Synchrone SHA-256 voor de bronsleutel van externe relaties

Heeft een bronproject geen project-ID, dan valt de bronsleutel van een externe relatie (`sourceProjectKeyFor` in
`src/engine/taskGrid/relationFormat.ts`) terug op `path-sha256:…`, een SHA-256 over het genormaliseerde bronpad. Die hash rekenen we met een eigen synchrone functie
(`sha256HexUtf8`), niet met Web Crypto of `node:crypto`. Die sleutel komt in de klembordopmaak en in de relatieplanner, en
beide zijn synchroon. `crypto.subtle.digest` is
asynchroon en zou die routes asynchroon maken; `node:crypto` werkt niet in de browserbouw: Vite (7.3.7) vervangt
een ingebouwde Node-module daar door een lege module (`__vite-browser-external`).
