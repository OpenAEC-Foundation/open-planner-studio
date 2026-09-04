# Een nieuwe in-app gids toevoegen

`public/docs/` is een eigen documentatiesubsysteem, los van `src/` — zie *In-app documentatie &
wiki* in `CLAUDE.md`. Eén manifest (`public/docs/manifest.json`) plus één map Markdown-artikelen per
taal. Manifest en artikelen worden runtime gefetcht (niet gebundeld), dus een nieuw artikel vraagt
geen rebuild om zichtbaar te worden in dev — wel om hem in `dist/` te krijgen voor een echte deploy.

**Dit is een toelichting, geen vervanging.** `npm run verify:docs` is de poort; loopt dit document
ooit achter, dan heeft de code gelijk.

---

## De stappen

1. **Kies een artikel-id** (kebab-case, bijvoorbeeld `gids-mijn-onderwerp`) en een `layer`:
   `quickstart` (eerste stappen), `gidsen` (taakgerichte how-to's) of `referentie`
   (naslag/achtergrond).
2. **Voeg de manifest-entry toe** aan `public/docs/manifest.json`:
   ```json
   {
     "id": "gids-mijn-onderwerp",
     "title": { "nl": "Mijn onderwerp", "en": "My topic", "...": "..." },
     "layer": "gidsen"
   }
   ```
   `title` is verplicht voor minstens `nl` en `en` (de brontalen); de overige twaalf mogen ontbreken
   en volgen in de maandelijkse vertaalronde. Een optioneel `cluster`-veld groepeert artikelen in de
   viewer.
3. **Schrijf het artikel** in minstens `public/docs/nl/<id>.md` én `public/docs/en/<id>.md` — dat zijn
   de twee harde brontalen. De overige twaalf (`public/docs/<taal>/<id>.md`) zijn optioneel en worden
   alleen gevalideerd wanneer ze bestaan.
4. **Blijf binnen de miniMarkdown-subset** (zie hieronder) — anders rendert de viewer het artikel niet
   zoals bedoeld, of `verify:docs` waarschuwt.
5. **Draai `npm run verify:docs`.**

## De beperkte Markdown-subset (`src/utils/miniMarkdown.tsx`)

Er is bewust géén markdown-dependency: `renderMiniMarkdown()` is een eigen, kleine parser die
rechtstreeks veilige React-elementen teruggeeft (geen `dangerouslySetInnerHTML` — dat ontbreken ÍS de
veiligheidsgarantie, geen aparte escape-stap nodig). Ondersteund:

- koppen `#`, `##`, `###` (geen nesting, geen `####`+)
- paragrafen (regels gescheiden door een lege regel)
- `**vet**`, `*cursief*`, inline `` `code` ``
- codeblokken (` ``` `)
- ongeordende (`-`/`*`) en geordende (`1.`) lijsten — **single-level**, geen geneste/ingesprongen
  items
- afbeeldingen `![alt](pad)` — het pad wordt opgelost tegen `${BASE_URL}docs/<pad>`; ontbreekt het
  bestand, dan valt de afbeelding terug op een zichtbare placeholder met de alt-tekst
- links, en dan **uitsluitend** twee schema's:
  - `docs://<article-id>` — interne navigatie naar een ander manifest-artikel
  - `examples://<file>` — opent hetzelfde voorbeeld-openpad als Backstage → Voorbeelden

**Niet ondersteund**: tabellen, blockquotes, horizontale lijnen, voetnoten, reference-style links,
rauwe HTML (buiten inline-code), en elk ander linkschema dan de twee hierboven (die worden getoond
als platte, niet-klikbare tekst — bewust geen externe netwerkaanroepen vanuit help-content).

## Wat `verify:docs` wel en niet blokkeert

`npm run verify:docs` (`scripts/verify-docs.ts`, onderdeel van `npm run verify`) controleert:

1. Elke manifest-id heeft `nl`- én `en`-bestanden (hard); geen wees-`.md`-bestanden zonder
   manifest-entry; geen dubbele ids. De overige 12 talen worden gevalideerd **wanneer aanwezig**,
   maar hun afwezigheid blokkeert niets.
2. Elke `docs://<id>`-link wijst naar een bestaand manifest-id.
3. Elke `examples://<file>`-link wijst naar een bestand in `public/examples/manifest.json`.
4. `title.nl`/`title.en` niet leeg (overige talen: niet leeg *indien aanwezig*); `layer` ∈
   `{quickstart, gidsen, referentie}`.
5. Parser-compatibiliteit: **waarschuwt** (blokkeert, telt mee als afwijking) op h4+, tabellen,
   blockquotes, horizontale lijnen, geneste/ingesprongen lijst-items, voetnoten, reference-style
   links, rauwe HTML-tags (buiten inline-code) en onbekende linkschema's — fenced code blocks en
   inline-code worden vóór deze scan gestript, dus backtick-gequote voorbeeldsyntax binnenin telt
   niet mee.
6. Basishygiëne: geen dubbele koppen binnen één artikel, geen lege bestanden, en een NL≉EN-heuristiek
   (meer dan 60% woordelijk identieke niet-lege regels tussen `nl` en `en` ⇒ vermoedelijk vergeten te
   vertalen).

**Wat het NIET blokkeert:** een ontbrekend artikel in een taal buiten `nl`/`en` (dat artikel bestaat
dan simpelweg niet — de viewer valt terug op Engels), en inhoudelijke juistheid/leesbaarheid — dat
blijft mensenwerk. Zonder manifest-entry blokkeert `verify:docs` evenmin, maar dan is het artikel voor
gebruikers onvindbaar (zie *In-app documentatie & wiki* in `CLAUDE.md`).

## Twee afnemers, één bron

De help-viewer (`HelpPanel.tsx`, Backstage → Help) en de GitHub-wiki (`npm run publish:wiki`) lezen
allebei uit dezelfde `public/docs/`-bron; de wiki is een gegenereerd artefact en wordt nooit
rechtstreeks bewerkt (zie de `wiki`-skill).

## Waar het echt staat

| onderwerp | bestand |
|---|---|
| manifest (ids, titels per taal, `layer`, `cluster`) | `public/docs/manifest.json` |
| artikelen per taal | `public/docs/<taal>/<id>.md` |
| de parser-subset | `src/utils/miniMarkdown.tsx` |
| de in-app viewer | `src/components/backstage/HelpPanel.tsx` |
| de poort | `scripts/verify-docs.ts` (`npm run verify:docs`) |
| de wiki-generator (afgeleide, niet bewerken) | `scripts/publish-wiki.mjs`, de `wiki`-skill |
