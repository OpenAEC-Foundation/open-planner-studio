# Gebruikersdocumentatie — opnieuw, volgens Diátaxis

*Ontwerp, 2026-09-28, versie 1.1 (open punten §10 beantwoord). Status: **ter review bij de eigenaar**. Basis: interview met de eigenaar
(2026-09-28), de documentatie-audit van 2026-09-26 (PR #242), en drie read-only onderzoeken op `main`
`9ab90cfd`: functie-inventaris uit de code (bijlage: `2026-09-28-gebruikersdocumentatie-functie-inventaris.md`),
analyse van de docs-infrastructuur, en een haalbaarheidsmeting van app-gegenereerde screenshots.*

Legenda bij beweringen over de huidige code: **Z** = zeker (met pad:regel aangetoond), **A** = afgeleid,
**O** = onbekend.

## 1. Waarom

De in-app gidsen (`public/docs`, 38 artikelen, ~57.000 woorden in nl) hebben twee problemen die de eigenaar
benoemt en die de audit bevestigt:

1. **Inhoud.** Artikelen zijn opsommingen van knoppen en velden. Ze zeggen wát er is, niet *waarom* het zo
   werkt en *hoe* de app rekent. Een planner leert er niet van waarom een taak verschuift, waarom iets kritiek
   wordt, of wat een werkregel met duur en werk doet. Daarnaast bleken veel beweringen verouderd (audit:
   knoppen op het verkeerde tabblad, velden die niet bestaan).
2. **Structuur.** Eén platte lijst "gidsen" waarin beginnersstof (WBS), specialistische stof
   (rekenprofielen, datums zoals opgeslagen) en importhandleidingen door elkaar staan; geen leerroute;
   verwarrende overlap (`gids-taaktypen` vs `gids-taaktypes`).

## 2. Besluiten van de eigenaar (interview 2026-09-28)

| Onderwerp | Besluit |
|---|---|
| Doelgroep | Beginners **én** ervaren planners, gelaagd |
| Structuur | **Diátaxis**: tutorial, how-to, uitleg, referentie |
| Kanaal | In-app Help + gegenereerde GitHub-wiki (zoals nu); `public/docs` blijft de bron |
| Tutorials | **Eén doorlopend project**, nieuw en klein, maar mét resources en urenplanning |
| Tutorialdekking | Basis · kalenders & uren · resources & werk · uitvoering & rapport |
| Screenshots | Alleen in tutorials; **build-time gegenereerd** uit de echte app (zie §7 — de gevraagde runtime-variant is gemeten en afgewezen) |
| Bestaande artikelen | **Opnieuw schrijven.** De oude artikelen zijn géén bron: elke bewering wordt getoetst aan de echte app (code + draaiende app) |
| Vertalingen | Eerst **nl + en**; de 12 andere talen vallen terug op Engels, de oude vertalingen worden verwijderd |
| Toon | Je-vorm, praktisch, bouwplaatsvoorbeelden |
| Grenzen aan toon en opbouw | Vaste schrijfgids (§4) — **handhaving alleen via review**, geen nieuwe CI-poort op stijl |
| Contextuele hulp | Uitbreiden: ?-knoppen in dialogen en panelen; bestaande app-links omzetten |
| Fasering | Eerst dit ontwerp ter review, dan een pilot (1 tutorial + 1 how-to + 1 uitleg) als maatstaf, dan uitrollen |

## 3. Doelstructuur: vier soorten

Diátaxis scheidt documentatie naar wat de lezer op dat moment wil:

| Soort | Lezer wil… | Vorm | Manifest `kind` |
|---|---|---|---|
| **Tutorial** | leren, door te doen | een doorlopend project, stap voor stap, met screenshots | `tutorial` |
| **How-to** | een concrete taak gedaan krijgen | doel → stappen → valkuilen | `howto` |
| **Uitleg** | begrijpen waarom en hoe het werkt | begrip → rekenregel → voorbeeld met getallen → gevolgen | `uitleg` |
| **Referentie** | iets opzoeken | per veld/optie: wat, standaard, effect | `referentie` |

In de Help-viewer staan ze in deze volgorde: Tutorials (genummerd, leerroute) · How-to · Uitleg ·
Referentie. Tutorials krijgen onderaan "Vorige / Volgende tutorial".

### 3.1 Inhoudsopgave (voorstel)

Afgeleid uit de functie-inventaris (185 gebruikerszichtbare functies, 14 domeinen), niet uit de oude
gidsen. Id's zijn Nederlands en stabiel; titels volgen in het pilotwerk. Dit is een **startvoorstel**:
tijdens het schrijven kan een how-to splitsen of samenvallen, zolang elke functie uit de inventaris een
thuis heeft (checklist in de bijlage).

**Tutorials — één project, zeven stappen** (§5)

| # | Id | Wat de lezer bouwt en leert |
|---|---|---|
| 1 | `tut-1-eerste-planning` | Nieuw project, WBS-fasen, taken, duur, mijlpalen; waarom een WBS |
| 2 | `tut-2-relaties-kritiek-pad` | Relaties + lag, Bereken (F5), kritiek pad en speling lezen — waarom de einddatum is wat hij is |
| 3 | `tut-3-kalender` | Projectkalender, feestdagen/bouwvak, een constraint en een deadline — zien hoe de planning verschuift en waarom |
| 4 | `tut-4-uren` | Urenplanning aan, een kraaninzet in uren, gemengde dag/uur-planning |
| 5 | `tut-5-resources` | Resources aanmaken, toewijzen, werkregel, histogram, overbezetting, nivelleren |
| 6 | `tut-6-uitvoering` | Baseline, statusdatum, voortgang invoeren, afwijking lezen |
| 7 | `tut-7-rapport` | Rapport kiezen, PDF maken, exporteren/delen |

**How-to's** (per domein uit de inventaris)

- *Planning opzetten:* taken en mijlpalen toevoegen; structuur aanpassen (inspringen, verplaatsen, WBS
  hernummeren); WBS-sjablonen bewaren en invoegen; codes en eigen velden; taak splitsen; project
  verplaatsen.
- *Relaties & constraints:* relaties leggen (slepen, koppelen, relatiecel); pad traceren; externe relaties
  naar een ander project; constraint of deadline zetten; hammock.
- *Kalenders & uren:* kalender maken en toewijzen; feestdagen genereren; resourcekalender; urenplanning
  aanzetten.
- *Resources & werk:* resources beheren; toewijzen met curve; urenverdeling (contour); werkregel kiezen;
  overbezetting oplossen en nivelleren.
- *Uitvoering:* baseline opslaan en beheren; voortgang bijwerken; voortgang uit een spreadsheet
  importeren; voortgangsmodus kiezen.
- *Rapporten:* rapport maken en afdrukken; rapportageperiode.
- *Bestanden:* openen/opslaan/automatisch opslaan; MS Project (.mpp) openen; Primavera P6 (.xer) openen;
  exporteren; herstellen na een crash.
- *Weergave:* layouts (filter, groeperen, sorteren, kolommen); tabelkolommen; split view en mini-map;
  presentatie; meerdere documenten.
- *Bibliotheek, extensies, AI:* resourcebibliotheek gebruiken; bezettingsoverzicht; extensie installeren;
  AI-assistent koppelen (MCP).
- *Overig:* feedback geven; updates.

**Uitleg**

| Id | Begrip |
|---|---|
| `uitleg-kritiek-pad` | Voorwaarts/achterwaarts rekenen, speling (totaal/vrij), wat "kritiek" betekent en wanneer bijna-kritiek |
| `uitleg-relaties` | FS/SS/FF/SF, lag en in welke kalender lag telt, relaties op samenvattingstaken |
| `uitleg-constraints` | Hoe constraints en deadlines de berekening sturen, hard vs zacht, wanneer ze conflicteren |
| `uitleg-kalenders` | Hoe de motor werkdagen en werkuren telt, welke kalender wint (taak, resource, project) |
| `uitleg-dagen-en-uren` | Dag- vs uurplanning, gemengd, afronding |
| `uitleg-werkregels` | De driehoek duur × inzet = werk en wat elke werkregel vasthoudt |
| `uitleg-nivelleren` | Wat nivelleren verschuift, binnen speling vs erbuiten, wat het niet doet |
| `uitleg-voortgang` | Statusdatum, restwerk, Retained Logic vs Progress Override, baselines en afwijking |
| `uitleg-rekenprofielen` | Waarom P6 en MS Project anders rekenen; conventies vs projectopties |
| `uitleg-datums-zoals-opgeslagen` | Waarom geïmporteerde datums afwijken van de eigen berekening |
| `uitleg-bestanden` | IFC als eigen formaat, adapters, wat een export verliest, crashherstel vs opslaan |
| `uitleg-resourcebibliotheek` | Bibliotheek vs projectresources, koppelen, bezetting over projecten |
| `gids-goed-plannen` | Planningsprincipes (id blijft — publieke URL, §8.3) |

**Referentie** — lint per tabblad; taakdialoog en eigenschappenpaneel; kalenderdialoog; resourcepaneel;
instellingen; sneltoetsen; tabelkolommen; rapporttypes en -opties; import/exportformaten (wat wel/niet
meegaat); waarschuwingen en meldingen; rekenopties en conventies; extensiepermissies.

## 4. Schrijfgids (bindend; handhaving via review)

### 4.1 Algemeen

1. **Eerst waarom, dan hoe.** Elke functie begint bij het probleem dat hij oplost en wat de app er
   onder de motorkap mee doet. Pas daarna de klikken.
2. **Geen kale opsomming.** Een lijst mag alleen als elk item zegt wát het doet en wanneer je het nodig
   hebt. "Veld Naam: de naam" is verboden; zo'n veld laat je weg of je zegt waar hij doorwerkt.
3. **Oorzaak en gevolg.** Beschrijf wat er verandert en waarom: "Je legt een relatie Eind-Start; daardoor
   begint het metselwerk pas als de fundering klaar is, en schuift de einddatum drie werkdagen op."
4. **Rekenen met getallen.** Uitleg en tutorials tonen een concreet voorbeeld met datums of uren, zodat de
   lezer de rekenregel kan nachecken in de app.
5. **Alleen wat de app echt doet.** Elke bewering is getoetst aan de code of in de draaiende app. De
   oude gidsen zijn geen bron. Twijfel = navragen of weglaten, nooit gokken.
6. **Knopnamen letterlijk** zoals de app ze toont (uit `src/i18n/locales/{nl,en}`), met het pad:
   *Planning › Kalender › Kalender*.
7. **Toon:** je-vorm, korte zinnen, bouwplaatsvoorbeelden (metselwerk, kraan, stort, bouwvak). Een
   vakterm wordt uitgelegd bij het eerste gebruik in een artikel.
8. **Eén soort per artikel.** Een how-to legt niet uitgebreid uit (verwijs naar de uitleg); een uitleg
   geeft geen klik-voor-klik (verwijs naar de how-to).
9. **Markdown-subset** van de viewer (`src/utils/miniMarkdown.tsx`): geen tabellen, blockquotes, h4 of
   HTML.

### 4.2 Vaste opbouw per soort

**Tutorial**
1. Wat je in deze stap bouwt (één alinea + eindbeeld).
2. Uitgangspunt: "je hebt tutorial N−1 afgerond" of "open het startbestand".
3. Stappen. **Elke stap eindigt met "wat je nu ziet, en waarom"**, met screenshot waar het beeld iets
   uitlegt.
4. Wat je hebt geleerd (3–5 punten, elk met een waarom) + link naar de bijbehorende uitleg.

**How-to**
1. Doel in één zin.
2. Wanneer je dit nodig hebt (situatie op de bouwplaats of in de planning).
3. Stappen.
4. Valkuilen en wat de app dan doet (melding, geweigerde actie).
5. Zie ook: de uitleg erachter.

**Uitleg**
1. Het begrip, in gewone taal.
2. Hoe de app ermee rekent (de regel, met verwijzing naar de instelling of conventie die hem stuurt).
3. Een uitgewerkt voorbeeld met getallen.
4. Gevolgen voor je planning en veelgemaakte misverstanden.

**Referentie**
Per veld/optie/knop: **wat het doet · standaardwaarde · effect op de berekening of weergave · waar het
te vinden is.** Een regel zonder effect is geen referentie en wordt weggelaten of aangevuld.

### 4.3 Review-checklist (per artikel, vóór merge)

- [ ] Hoort het artikel bij precies één soort, en volgt het de vaste opbouw daarvan?
- [ ] Begint elke functie met het waarom? Is er geen kale opsomming?
- [ ] Is elke bewering getoetst aan code of app (reviewer kiest minstens 5 beweringen en controleert ze)?
- [ ] Bestaat elke genoemde knop/veldnaam letterlijk als label in `src/i18n/locales/{nl,en}`?
- [ ] Bevat uitleg/tutorial een rekenvoorbeeld dat in de app na te spelen is?
- [ ] Je-vorm, korte zinnen, vaktermen uitgelegd?
- [ ] nl en en inhoudelijk gelijk (zelfde koppen, zelfde voorbeelden)?
- [ ] Links naar de andere soorten (how-to ↔ uitleg ↔ referentie) aanwezig?

Uitvoering van de review: per artikel een kritische review-agent tegen deze checklist, daarna de
eigenaar voor de pilotartikelen.

## 5. Het tutorialproject

**Eisen (eigenaar):** klein, maar gebruikt resources en urenplanning; één project door alle zeven
tutorials.

**Voorstel:** *Aanbouw woning* — een uitbouw aan een eengezinswoning, ~20–25 taken in 4 fasen
(voorbereiding, fundering, ruwbouw, afbouw) plus mijlpalen (start, oplevering) en één
inspectiemoment. Resources: een timmerploeg (ploeg), een metselaar (arbeid), een mobiele kraan
(materieel, in uren), een stukadoor (onderaannemer), beton (materiaal). De kraaninzet en de betonstort
worden in uren gepland (tutorial 4). Eén bewuste overbezetting (metselaar op twee taken tegelijk) die
tutorial 5 oplost door te nivelleren. Een bouwvak in de zomer zodat tutorial 3 zichtbaar verschuift.

**Twee talen.** De bestaande voorbeeldbestanden hebben alleen Engelse taaknamen (Z, spike). Het
tutorialproject krijgt daarom een **nl- en een en-variant** met vertaalde taak- en resourcenamen, zodat
de nl-screenshots Nederlandse taken tonen.

**Bestanden.** Per tutorial een startbestand en het eindresultaat, als `.ifc` in `public/examples/`
(de viewer kan `examples://` al openen). Gegenereerd door een script (zoals `gen:examples`), niet met
de hand, zodat het project reproduceerbaar blijft.

## 6. Techniek: viewer, manifest en poorten

(Bron: infrastructuur-analyse, alle punten Z tenzij anders vermeld.)

### 6.1 Manifest v2

```json
{ "version": 2,
  "articles": [ { "id": "tut-1-eerste-planning", "kind": "tutorial", "order": 1,
                  "title": { "nl": "…", "en": "…" }, "draft": true } ],
  "aliases": { "gids-plannen-wbs": "tut-1-eerste-planning" } }
```

- `kind` vervangt `layer` (`quickstart|gidsen|referentie` → `tutorial|howto|uitleg|referentie`).
- `order` alleen voor tutorials: de leerroute.
- `draft`: tijdens de bouw zichtbaar in dev, verborgen in productie (§9 overgang).
- `aliases`: oude id's blijven werken — nodig voor app-meldingen in uitgeleverde versies, release-
  highlights en externe links (§8).
- Titels alleen `nl` + `en`. Het ongebruikte veld `cluster` vervalt.

### 6.2 Help-viewer (`src/components/backstage/HelpPanel.tsx`)

- Vier secties in vaste volgorde; tutorials genummerd met "Vorige / Volgende".
- Talen: `nl`, `en`; andere UI-talen tonen Engels met een korte melding ("nog niet beschikbaar in jouw
  taal"). Taalkiezer: Auto / NL / EN; een bewaarde oude keuze (bijv. `de`) valt terug op Auto.
- Afbeeldingen: een afbeelding op een eigen regel wordt een blok (`<figure>`), met taalvariant
  (§7.3). Alt-tekst verplicht.
- `docs://id#anker`: werkt nu niet (Z: `miniMarkdown.tsx:61-67`); koppen krijgen een id zodat ?-knoppen
  naar een sectie kunnen springen.
- Scrollen naar boven bij artikelwissel; zoeken ook in de tekst (nu alleen titels en koppen).
- i18n: `menu:backstage.helpKind.{tutorial,howto,uitleg,referentie}` + melding voor de taalterugval, via
  `i18n:add` in alle 14 UI-talen; `helpLayer.*` en `helpStale` vervallen.

### 6.3 `verify:docs`

- `LANGS` splitsen in `UI_LANGS` (14, voor de CLAUDE.md-feiten) en `DOC_LANGS = ['nl','en']`; mappen van
  andere talen onder `public/docs` zijn een fout (verwijderde vertaling teruggekomen).
- Poort 4: geldige `kind`, leerroute (`order` uniek en aaneengesloten, alleen tutorials), aliassen wijzen
  naar bestaande id's.
- **Nieuwe poort 10:** elk artikel-id dat de app gebruikt (constanten in één bestand
  `src/state/helpArticles.ts`, plus `docsId` in release-highlights) bestaat in het manifest of als alias.
  Dit is een correctheidspoort, geen stijlpoort — nu breekt een hernoeming stil (Z).
- Afbeeldingen: elke `![](…)` in een tutorial verwijst naar een beeld dat de generator kent (register),
  en het bestand bestaat.
- `scripts/verify-package-docs.mjs` (Snap) leidt talen af uit de titels van het eerste artikel — mee
  aanpassen.

### 6.4 Wiki (`scripts/publish-wiki.mjs`)

Sidebar in vier secties (Tutorials genummerd), afbeeldingen meekopiëren, oude beeldsubmappen opruimen,
`docs/wiki/Home.md` bijwerken. **Gevolg:** wiki-URL's volgen de Engelse titel; nieuwe titels = nieuwe
URL's zonder redirect (A). Geaccepteerd als eenmalige breuk; Home linkt naar de nieuwe pagina's.

## 7. Screenshots (build-time)

### 7.1 Waarom niet runtime (gemeten)

De eigenaar vroeg om screenshots die de app zelf maakt bij de eerste opening. De haalbaarheidsmeting
(Chromium en WebKit, scripts in de sessie-scratchpad) liet zien:

- **Haperen is onvermijdelijk:** één volledig beeld vastleggen blokkeert de hoofdthread 1,5–2,5 s
  (Chromium), 4–7 s (WebKit). JavaScript deelt die thread; spreiden helpt alleen tussen beelden. (Z)
- **Een verborgen app-instantie is gevaarlijk:** in de meting nam het tutorialdocument het crashherstel
  van de gebruiker over, en toetsaanslagen van de gebruiker belandden in de verborgen instantie. (Z)
- Oplosbaar alleen met een aparte screenshot-ingang, opslag-shims en focusbewaking; gedrag in de echte
  desktop-webviews is niet gemeten (O).

De eigenaar koos daarop voor build-time (2026-09-28).

### 7.2 Generator

- **Stapscript per tutorial** (declaratief, TypeScript, naast de tutorial): welk bestand, welke acties
  via echte UI-events, welk element of welke uitsnede, en een controle van de toestand na elke stap.
  Dezelfde stappen als in de tekst — het script is het bewijs dat de tutorial werkt in de echte app.
- `npm run gen:docs-screenshots` start de browserbuild via de bestaande browsertest-infrastructuur
  (Playwright, `scripts/browser-test-server.mjs`) en schrijft per taal:
  `public/docs/img/<lang>/<shot>.webp` (alleen licht thema, §10).
- De beelden worden **gecommit**: de bouwketens (`live.yml`, Tauri-builds) hebben geen Playwright (A).
- **Omvang:** ~100 beelden × 2 talen, alleen licht thema, WebP-uitsneden ~15–35 KB → ongeveer 3–7 MB
  (gemeten groottes, schatting van het aantal).

### 7.3 Viewer

`![Alt](img/{lang}/tut-3-kalender-bouwvak.webp)` — de viewer vult de docstaal in. De wiki gebruikt de
Engelse variant.

### 7.4 Blijven kloppen

- Een browsertest in CI draait de stapscripts **zonder** vast te leggen: faalt een stap (knop hernoemd,
  dialoog anders), dan wordt de tutorial rood vóórdat een gebruiker een verouderde tutorial leest.
  Dit is een correctheidstest van de stappen, geen stijlpoort.
- Beelden opnieuw genereren is één commando; aanbevolen bij elke release.

## 8. Contextuele hulp en bestaande verwijzingen

### 8.1 ?-knoppen

- `DialogHeader` (`src/components/common/Dialog.tsx`) krijgt een optionele `help`-prop: een ?-knop naast
  het kruisje. Voor panelen een kleine `HelpButton`.
- Mechanisme bestaat al: `openHelpArticle(id)` (`uiSlice.ts:364-369`, Z); geen nieuwe UI-vlag nodig.
- Bij een dialoog met onopgeslagen invoer vraagt de ?-knop eerst: opslaan / annuleren / terug (§10).
- Bestaand bugje meegenomen: "Lees de gids" in *Net bijgewerkt* opent Help achter de dialoog (Z).

### 8.2 Id's op één plek

Alle artikel-id's die de app gebruikt komen in `src/state/helpArticles.ts` (nu verspreid over 13 plekken,
waaronder een dubbele constante voor `datums-zoals-opgeslagen`, Z). Poort 10 leest dat bestand.

### 8.3 Id's die niet mogen breken

- `gids-goed-plannen`: publieke URL in de MCP-instructie van uitgeleverde versies en in geïnstalleerde
  skills (Z). **Id en pad blijven.**
- Id's in meldingen en release-highlights van uitgeleverde versies: via `aliases` (§6.1).

## 9. Fasering

| Fase | Inhoud | Oplevering |
|---|---|---|
| 0 | Dit ontwerp | PR, review eigenaar |
| 0b | Dubbele knoppen weghalen ("Vrije dagen", "Baseline opslaan…") | kleine app-PR |
| 1 — pilot | Manifest v2 + viewer (4 soorten, `draft`), tutorialproject (nl/en) + generator, **tut-1**, één how-to, `uitleg-kritiek-pad` | PR('s); review tegen §4.3, daarna eigenaar |
| 2 | Tutorials 2–7 + screenshots | PR per 1–2 tutorials |
| 3 | How-to's, uitleg, referentie | PR per domein |
| 4 — omschakelen | `draft` eraf, oude artikelen en 12 vertaalmappen weg, aliassen, ?-knoppen, poort 10, wiki, recepten/rules/skills bijwerken | PR |

**Overgang:** tot fase 4 blijven de oude artikelen de productie-Help; nieuwe artikelen zijn `draft` en
alleen in dev zichtbaar. Zo ziet een gebruiker nooit een halve mix.

Na fase 4 volgen de 12 vertalingen in een apart traject.

## 10. Besluiten op de open punten (eigenaar, 2026-09-28)

1. **Screenshots: alleen licht thema.** Geen thema-variant in het pad; §7.2/§7.3 lezen
   `public/docs/img/<lang>/<shot>.webp`. Omvang ≈ 3–7 MB.
2. **?-knop in een dialoog met onopgeslagen invoer: eerst vragen** (opslaan / annuleren / terug).
   Daarna sluit de dialoog en opent Help op het artikel. Dialogen zonder invoer openen Help direct.
3. **Tutorialproject *Aanbouw woning*: akkoord** zoals in §5.
4. **Dubbele knoppen eerst in de app oplossen door de dubbele weg te halen:** "Vrije dagen" en
   "Baseline opslaan…" verdwijnen; "Kalender" en "Baselines beheren…" blijven. Dit is een aparte,
   kleine PR vóór de pilot, zodat de docs meteen de nieuwe situatie beschrijven.

## 11. Buiten scope

- De 12 vertalingen (apart traject na fase 4).
- Een docs-website naast app en wiki.
- Machinale stijlcontrole (bewust: alleen review).
- Functionele wijzigingen aan de app, behalve het Help-bugje (§8.1) en wat de viewer nodig heeft.
