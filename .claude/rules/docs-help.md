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

`public/docs/` is een **eigen documentatiesubsysteem** met een eigen CI-poort — makkelijk over het hoofd te zien, want het staat niet in `src/`. Het bestaat uit `manifest.json` (manifest v2: artikel-id's, titels in `nl` + `en`, een `kind` ∈ `howto | uitleg | referentie`, en `aliases` van oude naar nieuwe id's) plus de mappen `nl/` en `en/` met de Markdown-artikelen (en eventueel `img/<taal>/` voor afbeeldingen). De indeling volgt Diátaxis; ontwerp en schrijfgids: `docs/superpowers/specs/2026-09-28-gebruikersdocumentatie-diataxis-design.md` (§4 is bindend voor nieuwe artikelen).

Twee afnemers, één bron:

- **De in-app helpviewer** — `src/components/backstage/HelpPanel.tsx`, bereikbaar via Backstage → Help en F1. Manifest en artikelen worden at-runtime gefetcht via `BASE_URL` (net als `public/examples/`), dus ze zitten niet in de bundel. De docs bestaan alleen in `nl` en `en` (`HELP_DOC_LANGS` in `src/utils/helpManifest.ts`): een andere UI-taal toont de Engelse tekst met een melding (`menu:backstage.helpLangFallback`). De taalkiezer (Auto / Nederlands / English) staat persistent los van de UI-taal (`ops-docs-locale`); een bewaarde oude keuze als `de` valt terug op Auto.
- **De GitHub-wiki** — via `npm run publish:wiki`, met de drie Diátaxis-secties in de sidebar. De wiki wordt **gegenereerd, nooit met de hand bewerkt**; zie de `wiki`-skill.

De artikelen worden gerenderd door `src/utils/miniMarkdown.tsx`, dat een **beperkte** Markdown-subset kent: koppen `#`/`##`/`###`, paragrafen, enkelvoudige lijsten, `**vet**`/`*cursief*`/`` `code` ``, codeblokken, afbeeldingen, en uitsluitend `docs://`- en `examples://`-links. Geen tabellen, geen blockquotes, geen h4, geen rauwe HTML.

`npm run verify:docs` (onderdeel van `npm run verify`) bewaakt dit: elk manifest-id heeft een `nl`- én een `en`-artikel, alleen `nl/`, `en/` en `img/` onder `public/docs` (een map van een andere taal is een fout: een verwijderde vertaling die terugkwam), titels alleen in `nl` + `en`, geen weesbestanden, geen dubbele id's, een geldige `kind` (de oude `layer`/`cluster` zijn fout), aliassen naar bestaande niet-draft-artikelen, elke `docs://`/`examples://`-link bestaat, nl en en hebben dezelfde kop- en linkstructuur, en de inhoud blijft binnen de parser-subset. Poort 10: elk artikel-id dat de app gebruikt (`src/state/helpArticles.ts` plus de `docsId`'s in `src/services/updater/releaseHighlights.ts`) bestaat als artikel of alias. De twaalf vertalingen zijn een apart traject na de omschakeling (fase 4); dan komt een taal bij in `HELP_DOC_LANGS`.

**Manifest v2.** `draft: true` = alleen zichtbaar in de dev-build, in productie onvindbaar (ook via zoeken, links, aliassen). `aliases` (oud id → nieuw id) houdt oude verwijzingen werkend — meldingen in uitgeleverde versies, release-hoogtepunten, externe links en de tutorials-extensie — en mag geen bestaand id overschaduwen. **Hernoem je een artikel, zet dan een alias van het oude id.** `gids-goed-plannen` behoudt id en pad (publieke URL in de MCP-instructie en de skill van oudere app-versies). Het is het artikel voor mensen; agents krijgen de Engelse agentgids `public/agent/planning-guide.md` (bewust buiten `public/docs/`: geen Help-artikel, niet in manifest, viewer of wiki). Poort 11 van `verify:docs` houdt via de koppeltabel in `scripts/lib/agent-guide-coupling.ts` elk principe (`###` onder *Hoe de app ermee rekent*) gelijk met een sectie van de agentgids: een nieuwe of hernoemde kop vraagt ook een agentversie. Tutorials staan niet in het manifest: een extensie registreert ze via `api.help.registerArticles` (→ `src/utils/helpArticleRegistry.ts`), de viewer toont ze genummerd met Vorige/Volgende; alleen in zulke artikelen werkt ook een `project://<asset>`-link (meegeleverd project openen). De regels (draftfilter, aliasresolutie, docstaal, kopankers in GitHub-vorm voor `docs://id#anker`, `{lang}` in afbeeldingspaden) staan puur in `src/utils/helpManifest.ts`. Elk artikel-id dat de app zelf gebruikt hoort in `src/state/helpArticles.ts`; de ?-knop in een dialoog is `DialogHeader`'s `help`-prop, los in een paneel `HelpButton`.

**Bouw je een gebruikerszichtbare functie, dan hoort daar documentatie bij** — `nl` en `en`, met een manifest-entry; recept: `docs/recepten/in-app-gids.md`. Zonder dat blokkeert `verify:docs` niet (het artikel bestaat dan simpelweg niet), maar de functie is voor gebruikers onvindbaar.
