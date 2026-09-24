---
paths:
  - "public/docs/**"
  - "src/components/backstage/HelpPanel.tsx"
  - "src/utils/miniMarkdown.tsx"
  - "scripts/verify-docs.ts"
  - "scripts/publish-wiki.mjs"
  - "docs/wiki/**"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud overgenomen; kruisverwijzingen wijzen naar het betreffende rules-bestand. -->

### In-app documentatie & wiki

`public/docs/` is een **eigen documentatiesubsysteem** met een eigen CI-poort — makkelijk over het hoofd te zien, want het staat niet in `src/`. Het bestaat uit `manifest.json` (artikel-id's, per-artikel titels in veertien talen, en een `layer` ∈ `quickstart | gidsen | referentie`) plus één map met Markdown-artikelen per taal.

Twee afnemers, één bron:

- **De in-app helpviewer** — `src/components/backstage/HelpPanel.tsx`, bereikbaar via Backstage → Help. Manifest en artikelen worden at-runtime gefetcht via `BASE_URL` (net als `public/examples/`), dus ze zitten niet in de bundel. De documentatietaal staat persistent los van de UI-taal (`ops-docs-locale`), zodat iemand de docs in het Engels kan lezen terwijl de app Nederlands blijft; ontbreekt een artikel in een taal, dan valt hij terug op EN.
- **De GitHub-wiki** — via `npm run publish:wiki`. De wiki wordt **gegenereerd, nooit met de hand bewerkt**; zie de `wiki`-skill.

De artikelen worden gerenderd door `src/utils/miniMarkdown.tsx`, dat een **beperkte** Markdown-subset kent: koppen `#`/`##`/`###`, paragrafen, enkelvoudige lijsten, `**vet**`/`*cursief*`/`` `code` ``, codeblokken, afbeeldingen, en uitsluitend `docs://`- en `examples://`-links. Geen tabellen, geen blockquotes, geen h4, geen rauwe HTML.

`npm run verify:docs` (onderdeel van `npm run verify`) bewaakt dit: elk manifest-id moet minstens een `nl`- en een `en`-artikel hebben, geen weesbestanden, geen dubbele id's, elke `docs://`/`examples://`-link moet bestaan, en de inhoud moet binnen de parser-subset blijven. De overige twaalf talen mogen achterlopen maar worden gevalideerd zodra ze er zijn. Wijkt de kop- of linkstructuur van zo'n vertaling af van EN (typisch: er kwam een sectie bij in nl+en), dan is dat een waarschuwing, geen fout — voor `nl` blijft het een fout. In de vertaalronde maakt `npm run verify:docs -- --strict-translations` het ook voor de twaalf hard.

**Bouw je een gebruikerszichtbare functie, dan hoort daar documentatie bij** — minimaal `nl` en `en`, met een manifest-entry. Zonder dat blokkeert `verify:docs` niet (het artikel bestaat dan simpelweg niet), maar de functie is voor gebruikers onvindbaar.
