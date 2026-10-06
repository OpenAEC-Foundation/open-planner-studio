# Een nieuwe in-app gids toevoegen

`public/docs/` is een eigen documentatiesubsysteem, los van `src/` — zie de `docs-help`-rule
(`.claude/rules/docs-help.md`). Eén manifest (`public/docs/manifest.json`) plus de mappen `nl/` en
`en/` met Markdown-artikelen. Manifest en artikelen worden runtime gefetcht (niet gebundeld), dus een
nieuw artikel vraagt geen rebuild om zichtbaar te worden in dev — wel om hem in `dist/` te krijgen
voor een echte deploy.

De indeling volgt Diátaxis. Ontwerp en **bindende schrijfgids** (opbouw per soort, toon, review-checklist):
`docs/superpowers/specs/2026-09-28-gebruikersdocumentatie-diataxis-design.md` §3–§4.

**Dit is een toelichting, geen vervanging.** `npm run verify:docs` is de poort; loopt dit document
ooit achter, dan heeft de code gelijk.

---

## De stappen

1. **Kies de soort** — dat bepaalt de opbouw van het artikel (ontwerp §4.2):
   - `howto` — één taak gedaan krijgen: doel, wanneer je het nodig hebt, stappen, valkuilen, zie ook;
   - `uitleg` — begrijpen hoe de app rekent: het begrip, de rekenregel, een voorbeeld met getallen,
     gevolgen en misverstanden;
   - `referentie` — opzoeken: per veld, optie of knop wat het doet, de standaard, het effect en waar
     het staat.
   Tutorials horen niet in `public/docs`: die levert de tutorials-extensie (ontwerp §11).
2. **Kies een artikel-id** (kebab-case, Nederlands, met de soort als voorvoegsel:
   `howto-mijn-onderwerp`, `uitleg-…`, `ref-…`). Een id is stabiel: wordt hij later toch hernoemd,
   zet dan een alias van het oude id (stap 6).
3. **Voeg de manifest-entry toe** aan `public/docs/manifest.json`, op de plek waar hij in de
   inhoudsopgave van zijn sectie moet staan (de volgorde in het manifest is de volgorde in Help):
   ```json
   {
     "id": "howto-mijn-onderwerp",
     "title": { "nl": "Mijn onderwerp", "en": "My topic" },
     "kind": "howto"
   }
   ```
   Alleen `nl` en `en`: titels in andere talen keurt `verify:docs` af (de andere UI-talen tonen
   Engels). Zolang het artikel nog niet af is, zet je er `"draft": true` bij: dan is het alleen in de
   dev-build zichtbaar.
4. **Schrijf het artikel** in `public/docs/nl/<id>.md` én `public/docs/en/<id>.md`, met dezelfde
   koppen en dezelfde `docs://`-links (`verify:docs` eist die pariteit). Knopnamen letterlijk zoals de
   app ze toont, met het pad: *Planning › Kalender › Kalender*. Link alleen naar bestaande artikelen;
   noem een tutorial bij naam (er is geen `docs://`-link naar een tutorial).
5. **Blijf binnen de miniMarkdown-subset** (zie hieronder).
6. **Hernoem je een bestaand artikel**, zet dan in `aliases` het oude id → het nieuwe. Uitgeleverde
   versies, de release-hoogtepunten, de tutorials-extensie en externe links gebruiken het oude id nog.
   Gebruikt de app het id zelf (een "Lees meer" of een ?-knop), dan staat het in
   `src/state/helpArticles.ts`; werk de constante bij.
7. **Draai `npm run verify:docs`**, en bij een wijziging in `public/docs/en` ook `npm run publish:wiki`
   (dry-run; zie de `wiki`-skill).

## De beperkte Markdown-subset (`src/utils/miniMarkdown.tsx`)

Er is bewust géén markdown-dependency: `renderMiniMarkdown()` is een eigen, kleine parser die
rechtstreeks veilige React-elementen teruggeeft (geen `dangerouslySetInnerHTML` — dat ontbreken ÍS de
veiligheidsgarantie, geen aparte escape-stap nodig). Ondersteund:

- koppen `#`, `##`, `###` (geen nesting, geen `####`+); elke kop krijgt een anker in GitHub-vorm, zodat
  `docs://<id>#<anker>` naar een sectie springt
- paragrafen (regels gescheiden door een lege regel)
- `**vet**`, `*cursief*`, inline `` `code` ``
- codeblokken (` ``` `)
- ongeordende (`-`/`*`) en geordende (`1.`) lijsten — **single-level**, geen geneste/ingesprongen
  items
- afbeeldingen `![alt](pad)` — alt-tekst verplicht; het pad wordt opgelost tegen
  `${BASE_URL}docs/<pad>`, en `{lang}` in het pad wordt `nl` of `en`
  (`img/{lang}/<naam>.webp`); ontbreekt het bestand, dan valt de afbeelding terug op een zichtbare
  placeholder met de alt-tekst
- links, en dan **uitsluitend** twee schema's:
  - `docs://<article-id>` (of een alias, eventueel met `#anker`) — interne navigatie
  - `examples://<file>` — opent hetzelfde voorbeeld-openpad als Backstage → Voorbeelden

**Niet ondersteund**: tabellen, blockquotes, horizontale lijnen, voetnoten, reference-style links,
rauwe HTML (buiten inline-code), en elk ander linkschema dan de twee hierboven (die worden getoond
als platte, niet-klikbare tekst — bewust geen externe netwerkaanroepen vanuit help-content).

## Wat `verify:docs` wel en niet blokkeert

`npm run verify:docs` (`scripts/verify-docs.ts`, onderdeel van `npm run verify`) controleert onder meer:

1. Elk manifest-id heeft een `nl`- én een `en`-bestand; geen wees-`.md`-bestanden; geen dubbele id's.
   Onder `public/docs` staan alleen `manifest.json`, `nl/`, `en/` en `img/`.
2. Elke `docs://<id>`-link wijst naar een bestaand artikel of een alias, een `#anker` naar een
   bestaande kop; een gepubliceerd artikel linkt niet naar een draft.
3. Elke `examples://<file>`-link wijst naar een bestand in `public/examples/manifest.json`.
4. Manifest: `version` 2, titels alleen in `nl` + `en` en niet leeg, `kind` ∈
   `{howto, uitleg, referentie}`, geen `layer`/`cluster`/`order`, aliassen alleen voor id's die niet
   meer bestaan en naar een bestaand, niet-draft artikel.
5. Parser-compatibiliteit: h4+, tabellen, blockquotes, horizontale lijnen, geneste lijst-items,
   voetnoten, reference-style links, rauwe HTML-tags en onbekende linkschema's zijn fouten; een
   afbeelding zonder alt-tekst of met een ontbrekend bestand ook (bij een draft een waarschuwing).
6. Hygiëne: geen dubbele koppen in één artikel, geen lege bestanden, `nl` ≉ `en` (meer dan 60%
   woordelijk gelijke regels ⇒ vermoedelijk vergeten te vertalen), en `nl` en `en` hebben dezelfde
   kopstructuur en dezelfde link-targets.
10. Elk artikel-id dat de app gebruikt (`src/state/helpArticles.ts`, de `docsId`'s in
    `src/services/updater/releaseHighlights.ts`) bestaat als artikel of alias en is geen draft.

**Wat het NIET blokkeert:** inhoudelijke juistheid, toon en opbouw — dat is review tegen de
checklist in het ontwerp (§4.3), bewust geen poort.

## Twee afnemers, één bron

De help-viewer (`HelpPanel.tsx`, Backstage → Help) en de GitHub-wiki (`npm run publish:wiki`) lezen
allebei uit dezelfde `public/docs/`-bron (de wiki alleen het Engels); de wiki is een gegenereerd
artefact en wordt nooit rechtstreeks bewerkt (zie de `wiki`-skill).

## Waar het echt staat

| onderwerp | bestand |
|---|---|
| manifest (id's, titels nl/en, `kind`, `draft`, `aliases`) | `public/docs/manifest.json` |
| artikelen | `public/docs/{nl,en}/<id>.md` |
| de regels (draft, alias, docstaal, ankers) | `src/utils/helpManifest.ts` |
| artikel-id's die de app gebruikt | `src/state/helpArticles.ts` |
| de parser-subset | `src/utils/miniMarkdown.tsx` |
| de in-app viewer | `src/components/backstage/HelpPanel.tsx` |
| de poort | `scripts/verify-docs.ts` (`npm run verify:docs`) |
| de wiki-generator (afgeleide, niet bewerken) | `scripts/publish-wiki.mjs`, de `wiki`-skill |
