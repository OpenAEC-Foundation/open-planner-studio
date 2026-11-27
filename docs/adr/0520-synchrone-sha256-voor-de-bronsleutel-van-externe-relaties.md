# Synchrone SHA-256 voor de bronsleutel van externe relaties

De bronsleutel van een externe relatie (`sourceProjectKey` in `src/engine/taskGrid/relationFormat.ts`, de vorm
`path-sha256:…`) is een SHA-256 over het genormaliseerde bronpad. Die hash rekenen we met een eigen synchrone functie
(`sha256HexUtf8`), niet met Web Crypto of `node:crypto`. De sleutel wordt gebruikt in de klembordopmaak, in de pure
planners en bij het verversen van externe koppelingen, die allemaal synchroon zijn. `crypto.subtle.digest` is
asynchroon en zou die routes asynchroon maken; `node:crypto` werkt niet in de browserbouw (uit het weggehaalde
commentaar, niet nagegaan).
