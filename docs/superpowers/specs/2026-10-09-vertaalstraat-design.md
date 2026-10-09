# Vertaalstraat — eerst de vaktermen, dan de UI en de docs

*Ontwerp, 2026-10-09, versie 0.2. Status: **concept**. v0.1 kreeg van de reviewer (Opus, xhigh) "nee, nog
niet klaar"; v0.2 verwerkt alle 18 bevindingen (zie §14). Aanleiding: verzoek van de eigenaar (2026-10-09):
"alle talen uit de todo toevoegen, eerst de vaktermen goed vertalen, daarna alles, ook de docs; zoveel
mogelijk met Haiku 5.5, nooit boven 100k context per agent".*

## 1. Wat er gevraagd is

1. **Dertien nieuwe UI-talen.** De lijst staat in de `docs/TODO.md` van branch
   `origin/claude/orchestrator-role-uiskcu` (sectie *Lokalisatie & i18n*, uit het marktonderzoek):
   `ru`, `uk`, `cs`, `sk`, `sr`, `hr`, `bg`, `hu`, `ro` en `sv`, `nb`, `da`, `fi`. Daarna heeft de app 27
   locales (28 als PR #301, Lao, eerst landt). Geen van de nieuwe talen is RTL.
2. **De docs in alle talen.** Nu bestaan de in-app gidsen (`public/docs`) alleen in `nl` + `en`. Het
   Diátaxis-ontwerp (`2026-09-28-gebruikersdocumentatie-diataxis-design.md`, §2 en §9) plande de andere
   talen als "apart traject na fase 4". Dit is dat traject: 25 nieuwe docstalen.
3. **Eerst de vaktermen.** Een vaste woordenlijst (termbase) per taal, vóór er één UI-tekst of artikel
   vertaald wordt.
4. **Uitvoering vooral door Haiku 5.5**, met een harde grens van 100k tokens context per agent.

## 2. Omvang en tempo (gemeten op `main` 5c180527)

| Deel | Bron | Per taal | Totaal |
|---|---|---|---|
| UI | 4 namespaces, ±2.700 sleutels, 144 KB Engels | ±36k tokens | 13 talen |
| Docs | 76 artikelen, 700 KB Engels, 0 codeblokken, 357 inline-codestukken | ±175k tokens | 25 talen |

**Tempo van de bron (reviewer, origin/main):** 56 van de 76 Engelse artikelen veranderden in 7 dagen, alle
76 in 14 dagen; de `nl`-locales in 61 commits in 14 dagen. Een eenmalige vertaalrun is dus binnen een week
verouderd. Daarom is de straat **incrementeel** (§9): hij vertaalt alleen wat ontbreekt of veranderd is,
per UI-sleutel en per docs-sectie.

## 3. Kernidee

Vertalen is hier een **straat** met vaste stations. Een script maakt het werk klein en controleerbaar; een
Haiku-agent doet alleen het taalwerk op één klein werkpakket en keurt zijn eigen uitvoer met hetzelfde
script tot het groen is; een andere Haiku-agent leest na; een script voegt samen.

```
concepten (nl/en, synoniemen, definitie, soort)        ← script + Haiku; Opus keurt
   └─ termbase per taal                                ← script zoekt kandidaten in Microsoft-terminologie (TBX)
        │                                                Haiku kiest; Opus beslist bij conflict
        └─ werkpakketten (script)                      ← klein, met alleen de termen en labels die erin staan
             └─ vertalen + zelf keuren (Haiku + script) ← agent draait `translate check` tot groen (max 3×)
                  └─ nalezen (andere Haiku-agent) → herstellen → keuren
                       └─ samenvoegen (script) → verify
```

Consistentie komt uit **data** (termbase, labelkaart) en **scripts** (poorten), niet uit het geheugen van een
agent. Zo blijft elke agent klein.

## 4. Station 1 — de termbase

### 4.1 Bestanden

```
i18n/termbase/concepts.json      één lijst concepten, taalloos
i18n/termbase/<taal>.json        per taal: _style + per concept de term, vormen en herkomst
i18n/docs-literal.json           namen die in de docs letterlijk blijven (§5.3)
```

`i18n/` staat buiten `src/` en `public/`: bronmateriaal voor de tooling, geen runtime-data.

Een concept:

```json
{ "id": "total-float",
  "kind": "term",
  "nl": "totale speling",
  "en": ["total float", "total slack"],
  "enBySource": { "msp": "total slack", "p6": "total float" },
  "definition": "Time a task can slip without delaying the project finish (CPM).",
  "seeAlso": ["free-float"] }
```

`kind` is één van drie:

- `term` — wordt vertaald, met één vaste doelterm per taal.
- `token` — **nooit vertalen**: invoersyntax en codes die de app parseert of schrijft. Voorbeelden: de
  relatiecodes `FS/SS/FF/SF` in de taakgrid (de parser kent alleen deze, `src/engine/taskGrid/relationCell.ts:94`;
  daarom houdt `de/task.json:158` "1.2 FS+2d"), duureenheden in invoer (`3ed`, `12h`, `1h 30m`,
  `src/utils/durationFormat.ts:29-32`). De volle naam ("Finish-Start") is wél een `term`.
- `keep` — eigennamen die niet vertaald worden: `IFC`, `MS Project`, `Primavera P6`, `XER`, `CSV`, `MSPDI`.

`en` is een lijst, omdat bronnen verschillende woorden gebruiken voor hetzelfde concept: MS Project zegt
*slack*, P6 en de app zeggen *float*. De definitie kiest de betekenis (in de Microsoft-termen betekent
"float" ook "zwevendekommagetal").

Een taalbestand:

```json
{ "_style": { "address": "informal", "note": "du-vorm, zoals de bestaande de-UI" },
  "total-float": {
    "term": "Gesamtpuffer",
    "forms": ["Gesamtpuffer", "Gesamtpuffers"],
    "avoid": ["Gesamtschlupf"],
    "source": "tbx:msp",
    "status": "tbx" } }
```

- `forms` — de naamval- en meervoudsvormen. Nodig voor de termcontrole in verbuigende talen (cs
  *celková → celkové*, fi *polku → polun*); gemaakt door Haiku, gecontroleerd door het script (elke vorm
  deelt een stam met `term`).
- `avoid` — varianten die niet mogen. Een treffer is een **waarschuwing** voor de nalezer (een substring
  geeft valse treffers), geen afkeur.
- `status` ∈ `tbx` (één kandidaat uit de Microsoft-terminologie), `tbx-chosen` (Haiku koos tussen
  kandidaten), `existing-ui` (overgenomen uit een bestaande vertaling, §4.4), `model` (geen bron; Haiku uit
  eigen kennis, met verplichte blinde controle), `arbitrated` (conflict, beslist door Opus).

### 4.2 De conceptenlijst (eenmalig)

1. Een script verzamelt kandidaten: cursieve en vette termen in de Engelse docs, kolomnamen en veldlabels in
   `task.json`, en woordgroepen die vaak terugkomen in de `en`-UI.
2. Haiku-agents (per ±300 kandidaten) maken er concepten van: samenvoegen, definitie in één zin, `kind`
   bepalen, synoniemen per bron.
3. Opus keurt de lijst: dubbele concepten, ontbrekende kerntermen (kritiek pad, speling, relatietypen,
   beperkingen, taaktypen, werkregels, nivelleren, basislijn, statusdatum, rekenprofiel,
   resourcebibliotheek, …), en elke `token` tegen de parser. Verwacht: 200–300 concepten.

### 4.3 Termen per taal

**Eerst een script, dan pas een agent.** De Microsoft Terminology Collection (gratis TBX, ±100 talen; lokaal
in `build/cache/`, nooit gecommit; licentie: zie §13) bevat de termen van MS Project per taal. Voorbeelden
(reviewer, gemeten): cs *total slack* → *celková časová rezerva*, *status date* → *datum stavu*; fi
*kokonaisliukuma*; sr-Latn *ukupno pasivno vreme*.

1. `translate terms-lookup <taal>` zoekt per concept alle `en`-synoniemen op in de TBX en schrijft de
   kandidaten (met productlabel en definitie als de TBX die heeft) in een pakket.
2. Eén Haiku-agent per pakket van ±40 concepten **kiest** met de definitie als maatstaf, of meldt "geen
   goede kandidaat". Geen webonderzoek nodig, dus klein en goedkoop.
3. Voor een gat (`model`) volgt een **blinde controle**: een andere Haiku-agent krijgt alleen de doelterm,
   vertaalt terug en zegt of dit de gangbare vakterm is. Bij onenigheid beslist Opus.
4. Dezelfde agent maakt `forms` en zet `_style` (aanspreekvorm, zoals de gangbare software in die taal).

### 4.4 De twaalf bestaande talen

Voor `fr, de, es, zh, it, pt, pl, tr, ar, ja, ko, fa` volgt de termbase eerst **de bestaande UI**, zodat
docs en knoppen dezelfde woorden gebruiken. Een script zoekt per concept de UI-sleutels met de `en`/`nl`-term
en geeft de doelteksten plus de TBX-kandidaten aan een Haiku-agent. Die noemt de gebruikte term
(`existing-ui`) en meldt:

- **inconsistenties** — één concept, twee vertalingen in de UI;
- **afwijkingen van de vakterm** — de UI gebruikt iets anders dan MS Project in die taal.

Die meldingen worden **PR 3** (herstel in de UI), met Opus als beslisser. Pas daarna worden de docs van die
twaalf talen vertaald (§12) — anders nemen de docs labels over die daarna nog veranderen.

## 5. Station 2 — werkpakketten

`npm run translate -- prepare <ui|docs> <taal> [--missing|--stale]` schrijft pakketten naar
`build/translate/<taal>/` (komt in `.gitignore`). Een pakket bevat **alles** wat de agent nodig heeft.

### 5.1 UI-pakket (±150 sleutels)

```json
{ "kind": "ui", "lang": "cs", "namespace": "task", "id": "task-03",
  "style": { "address": "formal" },
  "terms": [ { "nl": "totale speling", "en": "total float", "target": "celková časová rezerva",
               "forms": ["celková časová rezerva", "celkové časové rezervy"] } ],
  "tokens": ["FS", "SS", "FF", "SF"],
  "plural": { "one": [1], "few": [2, 3, 4], "many": [1.5], "other": [0, 5, 10] },
  "items": [
    { "key": "columns.totalFloat", "nl": "Totale speling", "en": "Total float" },
    { "key": "toast.tasksMoved", "plural": true,
      "nl": { "one": "{{count}} taak verplaatst", "other": "{{count}} taken verplaatst" },
      "en": { "one": "{{count}} task moved", "other": "{{count}} tasks moved" } } ] }
```

- Bron is `nl` (de brontaal van het project) **plus** `en` als tweede lezing. **Bij verschil bepaalt `nl`
  de betekenis.** Het sleutelpad geeft context.
- `plural` geeft per CLDR-categorie voorbeeldgetallen (uit `Intl.PluralRules`), want de categorieën
  betekenen per taal iets anders: cs/sk `many` is alleen voor decimalen, ru/uk `many` is 0 en 5–20, ro
  `few` is 0, 2–19 en 101–119.
- Alleen termen en tokens die in de items voorkomen, gaan mee.

### 5.2 Docs-pakket (één artikel, of een reeks `##`-secties van ±2.500 woorden)

- Bron: het **Engelse** artikel. Engels is de docs-referentie en de labels lopen via de `en`-UI.
- `terms`, `tokens`: alleen wat erin voorkomt.
- `labels`: de **labelkaart** (§5.3).
- `style`: de aanspreekvorm.
- De grens van ±2.500 woorden is zacht: een sectie wordt nooit geknipt (de grootste zijn 2.670 en 2.625).

### 5.3 De labelkaart

De Engelse docs zetten UI-labels cursief, ook als pad (*Home › Tasks › Link ▾ › Link selected tasks*).
Gemeten: 4.959 cursieve labeldelen; 83 % past exact op een `en`-UI-tekst. Maar niet elke treffer is een
label, en niet elk label is een treffer. Daarom vier soorten:

| Soort | Voorbeeld | In het pakket | Poort |
|---|---|---|---|
| **a. UI-label** | *Relation type* | alle doelteksten van alle `en`-sleutels met die tekst, met sleutelpad (270 labels zijn in het Duits dubbelzinnig: *Link* → *Verknüpfen* of *Verknüpfung*) | één van de kandidaten staat letterlijk in de vertaling |
| **b. UI-patroon** | *Relation created: Foundation brickwork → Lay hollow-core floor* | de doeltekst met `{{…}}` als open plek | de vertaling past op het patroon |
| **c. Letterlijk** | *Pour foundation*, *Bouwkalender NL*, *OPS Task ID*, XLSX-kolommen *Start*, *Name* | de tekst zelf | staat byte-gelijk in de vertaling |
| **d. Vrij** | gewone nadruk | niets | geen |

Soort **c** gaat vóór **a**: een XLSX-kolom *Start* blijft *Start*, ook al bestaat er een UI-tekst
*Start*. De lijst `i18n/docs-literal.json` komt uit de code (`scripts/tutorial-project.ts`,
`src/engine/calendar/defaultCalendar.ts`, de kolommen van `src/services/xlsx/` en de CSV-adapter) plus een
handlijst, en een script controleert dat elke code-bron er nog in staat.

Regel in de opdracht: een label staat in de **nominatief**, met een draagwoord als de zin een naamval vraagt
(cs: *v okně *Typ vazby**). Zo hoeft het label niet te verbuigen en blijft de poort exact.

`apply` slaat per docs-sectie de **gebruikte sleutelpaden** op. Verandert later de UI-tekst achter zo'n
sleutel, dan is die sectie verouderd (§9), ook als het Engels niet veranderde.

## 6. Station 3 — vertalen en zelf keuren (Haiku)

Eén agent per pakket. Opdracht in vaste vorm:

1. Lees het pakket. Lees niets anders.
2. Schrijf `<id>.out.json` (UI) of `<id>.out.md` (docs).
3. Draai `node scripts/translate/check.mjs <pakket>`. Is hij rood, herstel dan precies de genoemde punten
   en draai opnieuw. Maximaal drie keer; daarna stop je en meld je de laatste fouten.

Regels: termen uit `terms` (een vorm uit `forms` mag), `tokens` ongewijzigd, labels volgens §5.3,
`{{invulplekken}}` en `$t(…)`-nesting byte-gelijk, Markdown-structuur gelijk, geen uitleg toevoegen,
aanspreekvorm uit `style`. Een regel mag niet beginnen met "getal + punt" als de bron daar geen lijst heeft
(miniMarkdown leest "18. června" als genummerde lijst, `src/utils/miniMarkdown.tsx:52`).

Zo zit de herstellus in de agent zelf; het Workflow-script hoeft geen bestanden te lezen.

## 7. Station 4 — de poorten (`check.mjs`)

**Hard (rood):**

- UI: precies dezelfde sleutels; per meervoudsfamilie precies de CLDR-categorieën; dezelfde
  `{{invulplekken}}` als de bron (een meervoudsvorm mag `{{count}}` uitschrijven, zoals bij `i18n:add`);
  `$t(…)` byte-gelijk (`common.json:116-117`); geen lege tekst; `tokens` ongewijzigd aanwezig.
- Docs: dezelfde koppen (aantal, niveau), geen dubbele kop, lijsten met hetzelfde aantal items, links met
  dezelfde doelen, afbeeldingen gelijk, alleen de miniMarkdown-subset, inline code gelijk aan het Engels
  (witte lijst: decimaalteken, plekhouders als `<projectnaam>`), labelkaart a/b/c volgens §5.3.
- Na samenvoegen van de secties: het hele artikel opnieuw, plus `verify:docs` voor die taal.

**Zacht (waarschuwing voor de nalezer):**

- een term uit `terms` waarvan de bron het concept bevat, maar geen vorm uit `forms` in de vertaling;
- een `avoid`-variant;
- tekst gelijk aan het Engels (in de bestaande talen is dat vaak terecht: de 90, fr 103 keer — *Filter*,
  *Status*, *Type*);
- een UI-tekst die veel langer is dan het Engels (knoppen; fi, hu en ru zijn lang).

## 8. Station 5 — nalezen en herstellen

Een **andere** Haiku-agent leest per twee pakketten na (bron + vertaling + termen + de waarschuwingen) en
geeft een gestructureerde lijst: plek, soort (betekenis fout, term fout, meervoud fout, onnatuurlijk, te
lang), voorstel. Een herstelagent past alleen die punten toe en draait `check.mjs` tot groen. Maximaal twee
rondes; wat daarna openstaat, gaat als lijst naar Opus.

## 9. Station 6 — samenvoegen en bijhouden

`npm run translate -- apply <taal>`:

- UI → `src/i18n/locales/<taal>/<ns>.json` via `orderLike`/`serialize` (`scripts/i18n-tools.ts`), dus in
  de vaste opmaak. Per sleutel komt de hash van de `nl`-bron in `i18n/ui-sources/<taal>.json`.
- Docs → `public/docs/<taal>/<id>.md` en een index `public/docs/<taal>/index.json`:
  `{ "<id>": { "title": "<vertaalde H1>", "sections": ["<hash van de en-sectie>", …],
  "labels": ["task:columns.totalFloat", …] } }`. De titel komt uit de vertaalde H1 (in 152 van 152 gevallen
  is de manifest-titel gelijk aan de H1), dus `manifest.json` krijgt **geen** 25 extra titels en blijft
  conflictarm.

**Incrementeel:**

- `prepare --missing` maakt alleen pakketten voor wat ontbreekt.
- `prepare --stale` maakt pakketten voor UI-sleutels waarvan de `nl`-hash veranderde en voor
  docs-**secties** waarvan de `en`-hash of een gebruikt label veranderde. De agent krijgt dan de oude
  vertaling erbij en past alleen aan wat nodig is.
- `translate status` toont per taal: ontbreekt / verouderd / actueel.

## 10. Wat er in de app verandert

**UI (13 talen erbij):**

- `Locale` + `LANGUAGE_LABELS` (`src/i18n/config.ts`), `LOCALES` (`scripts/i18n-tools.ts`).
- Taaldetectie: `no`/`nn` in de browser kiest `nb`. `sr` volgt besluit B1.
- Koppen: Space Grotesk heeft geen Cyrillisch (gemeten in `node_modules/@fontsource`), Inter wel (en laadt
  die subset al). `--font-heading` krijgt `"Inter"` als tweede font, zodat ru/uk/bg/sr-koppen niet op
  `system-ui` vallen.
- Release-hoogtepunten (`releaseHighlights.ts`) vallen terug op `en` (:147). Niet vertalen; de twee blokken
  zijn al uitgeleverd. Alleen de lijst uitbreiden als de typecheck dat eist.

**Docs (25 talen erbij):**

- `HELP_DOC_LANGS` (`src/utils/helpManifest.ts:28`) wordt alle locales.
- De viewer leest `public/docs/<taal>/index.json` voor titels en beschikbaarheid. Ontbreekt een artikel in
  de gekozen taal, dan toont hij het Engels met de bestaande melding `backstage.helpLangFallback`. Wat hij
  doet met een verouderd artikel volgt besluit B2.
- **RTL:** `HelpPanel.tsx` zet nu vast `dir="ltr"` op tekst en titels (:309, :402-404, :410, :416, met het
  commentaar "De tekst is nl of en"). Dat wordt `dir={localeDirection(lang)}`; `HelpPanel.css:112` gaat
  naar logische eigenschappen (`padding-inline-start`). `help-panel.spec.ts:59-66` (eist `ltr` in ar)
  wordt herschreven.
- `verify:docs`: **`nl` en `en` blijven verplicht**; de andere talen zijn optioneel. Wat er is, moet
  kloppen: geen artikel zonder manifest-id, geen artikel zonder index-regel, structuur gelijk aan `en`
  (generalisatie van de nl↔en-pariteit, `verify-docs.ts:847-858`). Ontbrekende of verouderde vertalingen
  zijn een **rapport**, geen fout — anders blokkeert elk nieuw Engels artikel elke PR. De mappen-poort
  (`verify-docs.ts:754-770`) staat alle docstalen en `index.json` toe.
- Ankers: poort 10 eist dat een anker in elke docstaal bestaat; ankers volgen de koptekst, dus dat kan niet
  met 27 talen. De app gebruikt geen ankers (0 in `public/docs`, 0 in `src/`); de poort controleert ankers
  voortaan alleen in `nl`/`en`, en vastgelegd wordt dat app-links geen anker gebruiken.
- Afbeeldingen: zonder eigen `img/<taal>/` valt een taal terug op `en` (`helpImageLang`).
- Tests die nu eisen dat `de`/`fr` op Engels terugvallen (`check-help-manifest.ts:80-84`,
  `help-docs-v2.spec.ts:200-202`, `help-panel.spec.ts:35`) gaan over op een artikel dat in die taal
  ontbreekt.
- Wiki, Engelse agentgids en skills blijven Engels.
- Omvang: `public/docs` zit in de Tauri-binary. 25 talen × ±0,9 MB ruw; Tauri comprimeert ingebedde
  bestanden, dus ±4–6 MB erbij in het installatiebestand (VERMOED, te meten in de proef).

**Tutorials:** het extensiecontract (`ExtHelpText {nl, en}` e.a.) houdt `nl` + `en` verplicht en krijgt
optionele andere talen; zonder vertaling valt een tutorial terug op `en`. Het vertalen van de tutorials
zelf (tutorialproject, 336 `l()`-aanroepen in de stapscripts, 7 × 27 browsertests) is een aparte fase na
deze klus (B4).

**Tests en teksten:** zie bijlage A.

## 11. Werkwijze na deze klus

- **`i18n:add`** eist nu een tekst in elke locale (`scripts/i18n-tools.ts:102`). Met 27 talen moet een
  agent dan 27 vertalingen schrijven. Voorstel (B5): `i18n:add` eist `nl` + `en`; de andere talen mogen
  ontbreken en vallen terug op `en`; `translate prepare ui --missing` vult ze aan, en `verify:i18n` meldt
  ontbrekende sleutels als rapport, niet als fout. Zo blijft elke open PR met een nieuwe tekst groen.
- **Release:** de release-skill draait `translate status`; bij ontbrekende of verouderde vertalingen
  eerst `prepare --missing --stale` + de straat. Zo krijgt een gebruiker bij een release actuele
  vertalingen, terwijl `main` tussendoor mag achterlopen.
- Recepten `i18n-sleutel.md` en `in-app-gids.md` krijgen de straat als stap; `AGENTS.md` krijgt
  `npm run translate` (`verify:docs` poort 7c eist dat elk npm-script daar staat, `verify-docs.ts:321`).

## 12. Uitvoering

**Motor:** de Workflow-tool met `model: 'haiku'` voor alle taalwerk (concepten opstellen, termen kiezen,
blinde controle, vertalen, nalezen, herstellen). Opus doet alleen: dit ontwerp, de conceptenlijst keuren,
conflicten beslissen, de review per PR.

**Isolatie:** de agents draaien in de cwd van de sessie en laden daar `AGENTS.md`. De opdracht beperkt ze
tot hun pakket; na elke run controleert de orkestrator `git status` (alleen `build/translate/` mag
veranderd zijn).

**Contextbudget (te meten in de proef):** ±20–25k harnas + ≤ ±10k pakket + ≤ ±10k uitvoer + ≤ 3 check-rondes
⇒ ±50k piek, ruim onder 100k. De proef meet de echte piek per agent; komt hij boven 70k, dan worden de
pakketten kleiner.

**Aantallen (schatting):** termbase ±26 talen × ±7 pakketten ≈ 180 agents + blinde controles; UI 13 × ±20
pakketten × ±1,7 ≈ 450; docs 25 × ±90 pakketten × ±1,7 ≈ 3.800. Meerdere workflows (maximaal 1.000 agents
per workflow).

**Proef** (vóór de grote runs, met gemeten piekcontext): UI in **sv** (makkelijk), **cs** en **ru** (moeilijke
meervouden en naamvallen); docs: 5 artikelen in **cs** en **ar** (RTL). De eigenaar kijkt het na in de app.

**PR's:**

1. **PR 1 — straat + termbase.** `scripts/translate/`, tests (`tests/planning/check-translate-*.ts` voor de
   poorten), `i18n/`, termbase voor 26 talen, rapport van inconsistenties in de 12 bestaande talen.
2. **PR 2 — 13 UI-talen** (+ fonts, tests en teksten uit bijlage A, `i18n:add`-regel B5).
3. **PR 3 — herstel van inconsistenties** in de 12 bestaande UI-talen (§4.4).
4. **PR 4 — docs-infrastructuur** (§10: index, viewer, RTL, verify:docs).
5. **PR 5… — docs per taalgroep** (Noords; Slavisch + hu/ro; West-Europees; CJK; ar/fa/tr), elk met
   `translate status` = actueel.

## 13. Open besluiten

Voor de eigenaar (worden één voor één voorgelegd, met voorbeeld):

- **B1 — Servisch schrift.** Cyrillisch (`sr`): officieel schrift, en `Intl.DateTimeFormat('sr')` geeft
  al Cyrillische maandnamen. Latijns vraagt de code `sr-Latn`, en die breekt `load: 'languageOnly'`
  (`config.ts:48`), de taalsplitsing (`config.ts:116`, `helpManifest.ts:45`) en `verify-docs.ts:341`. Wel
  staan de MS Project-termen in de TBX vooral in Latijns schrift (omzetten naar Cyrillisch is
  mechanisch). Voorstel: Cyrillisch.
- **B2 — Verouderd docsartikel.** (a) de viewer toont toch de vertaling; (b) de viewer toont het Engels met
  een melding; (c) per sectie: actuele secties in de taal, verouderde in het Engels. Voorstel: (a) op `main`,
  en de release-regel uit §11 zorgt dat een release geen verouderde vertaling bevat.
- **B3 — Melding "machinevertaling".** Geen moedertaalspreker in de keten. Voorstel: in Help een korte
  melding in de nieuwe talen, tot iemand een taal nakijkt; in de UI geen melding.
- **B4 — Tutorials.** Voorstel: aparte fase na deze klus.
- **B5 — `i18n:add` met 27 talen.** Voorstel: zie §11.
- **B6 — PR #301 (Lao, externe bijdrager).** Open (niet gemerged). Voorstel: eerst die PR afhandelen; `lo`
  krijgt daarna ook een termbase en een nalees-ronde door de straat.
- **B7 — Verbruik.** Ruwe schatting ±4.500 Haiku-agentaanroepen voor alles. De proef meet het echte verbruik
  per pakket; daarna een getal voor de rest.

**Licentie Microsoft-terminologie (gemeten 2026-10-09).** De zip (`download.microsoft.com/…/MicrosoftTermCollection.zip`,
176 MB, 111 TBX-bestanden, export van 2024-11-06) bevat geen licentietekst. Microsoft beschrijft het doel als
"integrate Microsoft terminology into other terminology collections". Een licentietekst is niet gevonden
(de Language Portal sloot in 2023). Daarom: het TBX-bestand blijft lokaal in `build/cache/` en komt nooit in
de repo; in de repo staan alleen losse vaktermen (korte woordgroepen) met `source: "tbx"`. Elk TBX-record
heeft een Engelse definitie (bv. *total slack*: "The amount of time that a task can slip before it delays
the project."), zodat de keuze tussen kandidaten op betekenis kan. Alle 26 doeltalen staan erin, Servisch in
Cyrillisch én Latijns schrift, ook Lao.

## 14. Verwerking van de review (v0.1 → v0.2)

Reviewer (Opus, xhigh), 2026-10-09, oordeel v0.1: **nee**. Alle punten verwerkt:
1 tempo docs → §2, §9 incrementeel per sectie · 2 labelkaart → §5.3 vier soorten · 3 RTL → §10 ·
4 B2 niet bouwbaar → index per taal + rapport i.p.v. fout (§9, §10) · 5 volgorde → PR 3 vóór docs van de 12
talen, gebruikte labels per sectie · 6 TBX → §4.3 · 7 tokens → §4.1 `kind` · 8 meervoud → voorbeeldgetallen
§5.1 · 9 "≠ Engels" → waarschuwing · 10 `$t(` → harde poort · 11 bijlage A → gecorrigeerd · 12 parallel werk
→ B5, B6, `--missing` · 13 isolatie → §12 · 14 budget → meten in de proef · 15 check tussen aanroepen → de
agent draait zelf `check.mjs` (§6) · 16 proef → sv + cs + ru, docs cs + ar · 17 kleine gaten → §5.2, §6, §7 ·
18 B1 → feiten erbij. Geschrapt: titelpakket (H1), codeblokpoort (0 codeblokken), `<1>`-tags (bestaan niet),
release-hoogtepunten vertalen.

## Bijlage A — plekken met een vaste talenlijst

Inventaris op `main` 5c180527 (Explore, Haiku), gecorrigeerd door de review. [ROOD] = typecheck of test wordt
rood; [STIL] = blijft groen maar test de nieuwe talen niet.

- **Code:** `src/i18n/config.ts` (`Locale`, `LANGUAGE_LABELS`, detectie) [ROOD bij typecheck];
  `scripts/i18n-tools.ts` `LOCALES`; `src/utils/helpManifest.ts` `HELP_DOC_LANGS`, `helpImageLang`;
  `src/components/backstage/HelpPanel.tsx` (+ `.css`) RTL; `vite.config.ts` (commentaar).
- **Docs-poort:** `scripts/verify-docs.ts` — mappen, titels/index, pariteit (elke taal ↔ en), ankers
  (alleen nl/en), drift, poort 7c (`npm run translate` in AGENTS.md). `verify-package-docs.mjs` volgt het
  manifest. `publish-wiki.mjs` blijft `en`.
- **Tests:** `check-recorded-dates.ts:1215` (eist precies 14) [ROOD], en :1228 eist letterlijk
  "Primavera" (wordt een stam, zoals :1253 voor pl); `check-count-labels-i18n.ts`, `check-i18n-plurals.ts`
  (imports per taal); `check-task-grid-i18n.ts` (eigen `LOCALES`, :4), `check-conventions-registry.ts:382`,
  `check-start-snet.ts:384`, `tests/library/check-i18n-plurals.ts:34` [STIL]; `check-help-manifest.ts`,
  `help-panel.spec.ts`, `help-docs-v2.spec.ts` (verwachten nl/en-docs en LTR).
- **Extensies/tutorials:** `src/extensions/{types,guideModel,guideRuntime,helpApi}.ts`,
  `src/utils/helpArticleRegistry.ts`, `src/services/mcp/tools/guideTools.ts`, `scripts/tutorial-project.ts`,
  `tests/browser/tutorials/dsl.ts`, `scripts/generate-docs-screenshots.mjs` (B4).
- **Tekst met getallen ("14", "veertien", "56", "nl + en"):** `AGENTS.md` (r. 53, 133, 152 — door
  `verify:docs` bewaakt —, 176), `.claude/rules/{i18n,docs-help,docs-index,reports}.md`,
  `.claude/skills/release/SKILL.md`, `docs/recepten/{i18n-sleutel,ribbontabblad,in-app-gids,conventie,mcp-tool}.md`,
  `README.md`, `CONTRIBUTING.md`, `.github/pull_request_template.md`, `snap/snapcraft.yaml`,
  `scripts/README.md`, `docs/wiki/{Features,Home,Contributing}.md`.
- **`.gitignore`:** `build/translate/` en `build/cache/` erbij.
- **Geen wijziging nodig:** datum- en getalnotatie (Intl), `RTL_LOCALES`, `index.html` (`lang` wordt runtime
  gezet), Tauri-config, `releaseHighlights.ts` (valt terug op `en`). Feestdagsets voor de nieuwe landen
  staan los van de taal (eventueel later, `knownbugs.md`).
