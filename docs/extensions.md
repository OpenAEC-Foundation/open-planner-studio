# Extensies schrijven voor Open Planner Studio

Een extensie is een ZIP-bestand met twee bestanden — of een los `.js`-bestand met een `@manifest`-commentaarblok.

## manifest.json

````json
{
  "id": "mijn-extensie",
  "name": "Mijn Extensie",
  "version": "1.0.0",
  "apiVersion": "1.0",
  "minAppVersion": "2026.4.0",
  "author": "Jouw Naam",
  "description": "Wat de extensie doet.",
  "category": "Import/Export",
  "main": "main.js",
  "permissions": ["ribbon", "events"],
  "icon": "<svg viewBox=\"0 0 24 24\">…</svg>"
}
````

Categorieën: `Import/Export`, `Planning`, `Reporting`, `Utility`, `Fonts`, `Other`.

`icon` is een inline SVG-string of een emoji. Iconen worden gesaniteerd voordat ze getoond worden
(`src/utils/sanitizeSvgIcon.ts`): toegestaan zijn de gebruikelijke vorm-, tekst- en verloop-elementen
met hun geometrie-/stijlattributen. Er uit gaan altijd `script`, `foreignObject`, `use`, `image`,
`animate`, `set` en `a`, plus elk `on…`-attribuut, `href`/`xlink:href`, `style` en verwijzingen naar
buiten het document (`url(https://…)`). De SVG moet welgevormde XML zijn (één wortel, alles gesloten);
lukt het parsen niet of blijft er niets zichtbaars over, dan toont de app het standaardicoon.
Gebruik `currentColor` voor `fill`/`stroke` zodat het icoon met het thema meekleurt.

### Permissies

| Permissie | Afdwinging | Betekenis |
|---|---|---|
| `events` | **hard** — ontbreekt ⇒ `api.events.*` gooit | Abonneren/uitzenden op de event-bus. |
| `ribbon` | **hard** — ontbreekt ⇒ `api.ui.addRibbonButton` gooit | Een knop in de ribbon plaatsen. |
| `backstage` | **warn** (overgangsregime) — ontbreekt ⇒ `api.importers.*` werkt nog, maar logt een waarschuwing | Een importer registreren (verschijnt in Bestand → Importeren). |
| `pdf-fonts` | **hard** — ontbreekt ⇒ `api.pdfFonts.register` gooit | Een font-provider registreren voor de vector-PDF-export (bv. CJK-glyf-bytes). |
| `importSource` | **hard, default-deny** — ontbreekt ⇒ `api.data.getImportSourceInfo`/`getImportSourceIssue`/`getImportSourceChunk`/`getImportSourceCatalogPage` gooien vóórdat er ook maar één byte gelezen wordt | De **volledige oorspronkelijke bronbytes** van een geïmporteerd bestand (vandaag: XER) lezen, inclusief velden die de importlaag bewust niet in het projectmodel materialiseert. Zie de aparte paragraaf verderop. |
| `help` | **hard** — ontbreekt ⇒ elke `api.help.*`-methode gooit (synchroon, ook `openBundledProject`) | Help-artikelen (tutorials) registreren, een meegeleverd projectbestand als nieuw document openen en het begeleidingspaneel aansturen. Sinds contractversie `1.4.0`; zie *Help & begeleiding* hieronder. |
| `filesystem` | informatief | Geen API-oppervlak; puur getoonde intentie bij installatie — **geen** sandbox-garantie (extensie-code heeft technisch gewoon toegang). |
| `network` | informatief | Idem — getoonde intentie, geen technische grens. |

`data.*` is verder **kern-API** — behalve de vier `getImportSource*`-methoden hierboven — net als
`settings.*`, `assets.*` en `ui.showNotification`: altijd beschikbaar, geen permissie nodig.

De afdwinging is gecentraliseerd in `src/extensions/permissions.ts` (één tabel pad → permissie).

### Wat de app wél en niet afdwingt

Twee dingen zijn hard, en het verschil is belangrijk:

- **Integriteit van een catalogus-installatie.** Draagt een catalogusentry een `sha256` van de
  release-ZIP, dan wordt de download geverifieerd en bij het kleinste verschil geweigerd. Draagt hij
  er geen, dan installeert de app wel maar meldt hij in de debug-terminal dat de download
  ongeverifieerd is. Een aanwezige maar onleesbare hash is een weigering, niet een stille terugval.
- **Afscherming van de rauwe host-globals.** `__TAURI_INTERNALS__`, `__TAURI__` en `__OPS__` zijn
  binnen extensie-code geschaduwd op `undefined`. Alles wat een extensie legitiem nodig heeft loopt
  via `require('open-planner-studio')` en de `api` die `onLoad` krijgt.

> **Dit is geen sandbox.** Extensie-code draait in dezelfde realm als de app. `globalThis.__TAURI_INTERNALS__`
> en `Function('return this')()` komen er nog steeds bij, en `filesystem`/`network` zijn dan ook
> informatieve permissies zonder technische grens. Wat de afscherming oplevert is dat de
> gedachteloze route dicht zit: wie er alsnog omheen gaat, doet dat aantoonbaar met opzet.
> **Installeer alleen extensies waarvan je de bron vertrouwt.** Een echte grens vergt uitvoering in
> een Web Worker of iframe; dat staat op de roadmap.

### Toestemming bij installeren

Precies omdát er geen grens is, vraagt de app bij **installeren** om bevestiging — één keer, op het
moment waarop je de maker vertrouwt, niet bij elke activering. Wat de dialoog toont:

- **wie en wat**: naam, versie, auteur, omschrijving en repository uit het manifest;
- **herkomst**: catalogus of lokaal bestand, en of de download tegen een checksum geverifieerd is;
- **wat het concreet betekent** op dit platform (desktop of browser);
- **de gedeclareerde permissies** — nadrukkelijk als *voorgenomen gebruik*, niet als beperking.

Dat laatste is een bewuste keuze. Een afvinklijst in Android-stijl zou lezen als "de extensie is
hiertoe beperkt", en dat is aantoonbaar onwaar; dan is de dialoog erger dan geen dialoog.

Weigeren laat niets achter: geen record in de opslag, geen registratie, en een al geïnstalleerde
vorige versie blijft draaien. Kan de vraag niet gesteld worden (geen dialoog beschikbaar), dan wordt
er **niet** geïnstalleerd — de faalstand is weigeren, niet stil doorlaten.

Zelftests slaan de vraag over via `window.__OPS__.extensions.installFromZip`; de dialoog zelf stuur
je aan met `window.__OPS__.extensions.consent.set(fn)` / `.reset()` (dev-only).

### Twee versievelden, twee vragen

`apiVersion` en `minAppVersion` lijken op elkaar maar beantwoorden verschillende vragen, en allebei
worden ze bij het activeren afgedwongen (weigering ⇒ status `error` met de reden erbij).

| veld | vraag | vorm |
|---|---|---|
| `minAppVersion` | *Welke app-FEATURES heb ik nodig?* | CalVer, bv. `2026.4.0` |
| `apiVersion` | *Tegen welk extensie-CONTRACT ben ik gebouwd?* | semver, bv. `1.0` |

De app-versie is CalVer en zegt alleen wanneer een build gemaakt is — daar valt geen brekende
wijziging uit af te lezen. `apiVersion` doet dat wel:

- **major** verschilt ⇒ geweigerd, in beide richtingen. Een andere major betekent dat `ExtensionApi`
  of een `Ext*`-vorm brekend gewijzigd is.
- **minor** hoger dan de host ⇒ geweigerd (je rekent op iets dat deze app nog niet heeft). Lager of
  gelijk ⇒ prima: toevoegingen zijn achterwaarts compatibel.
- **patch** speelt geen rol.

`apiVersion` is **optioneel**. Laat je hem weg, dan laadt de extensie gewoon (manifesten van vóór dit
veld blijven werken) maar logt de app een waarschuwing in de debug-terminal. Zet hem in nieuwe
extensies wél: zonder dat veld merk je een contractwijziging pas als je code halverwege `onLoad`
klapt. Een onleesbare waarde (`"v1.0"`, `"1.x"`) wordt geweigerd in plaats van als `0.0.0` gelezen.

De huidige contractversie leest je uit met `require('open-planner-studio').apiVersion`.

Historie van de contractversie: `1.1.0` — read-only XER-bronroute (`data.getImportSource*`); `1.2.0` —
rekenprofiel (#169, `ExtProject.schedulingProfile`) + `getImportSourceIssue()` (#109). Beide
toevoegingen vallen onder dezelfde minor `1.2`. `1.3.0` — taaktypes (#170): `ExtTask.workRule`,
`ExtProject.defaultWorkRule` en de drie optionele werkvelden op de toewijzing
(`plannedWorkMinutes`/`actualWorkMinutes`/`remainingWorkMinutes`). `1.4.0` — Help & begeleiding: de
permissie `help` en `api.help.*` (Help-artikelen registreren, meegeleverd projectbestand openen,
begeleidingspaneel), plus de generieke ankers in het lint (zie *Help & begeleiding*).

> **Migratie (audit P16):**
> - De permissie `commands` is verwijderd — die had nooit een API-oppervlak. Een nieuwe installatie met een manifest dat haar (of een andere onbekende waarde) noemt, wordt geweigerd. Alleen al opgeslagen legacy-installaties blijven werken: daar worden onbekende permissies weggefilterd met een waarschuwing.
> - `backstage` is nu de permissie voor `api.importers.*`. Bestaande importer-extensies die haar niet declareren blijven werken (warn-modus); **declareer `backstage` in nieuwe extensies met een importer** — in een toekomstige versie wordt dit hard.

## Validatie, identiteit en quarantaine

ZIP-, JavaScript-, catalogus- en IndexedDB-invoer begint als `unknown` en wordt veld voor veld naar
een nieuw bekend object geparseerd. De uitvoerbare bron van dit contract is
[`src/extensions/validation.ts`](../src/extensions/validation.ts); die module bevat ook de actuele
limieten en is leidend wanneer deze uitleg en de code ooit uiteenlopen.

Het veldbeleid in hoofdlijnen:

- `id` is verplicht, maximaal 128 tekens, gebruikt alleen kleine letters, cijfers, punt,
  underscore en streepje, en wordt nooit automatisch getrimd of naar lowercase omgezet;
- `name`, `version`, `author`, `description`, `category`, `main`, versies, URL's, tags,
  permissies en icoongrootte krijgen een expliciete type-, vorm- en lengtegrens;
- onbekende objectvelden worden niet doorgedragen; de parser reconstrueert uitsluitend bekende
  velden en maakt kopieën van arrays, assets en geneste waarden;
- verse invoer met een onbekende permissie is ongeldig. Alleen reeds opgeslagen legacyrecords
  mogen ontbrekende `permissions` en `minAppVersion` in geheugen aanvullen en onbekende oude
  permissies wegfilteren met een waarschuwing;
- `main` en assetnamen zijn relatieve POSIX-paden. Absolute paden, backslashes, NUL, lege
  segmenten en `.`/`..` zijn verboden. ZIP-entrynamen worden vóór gebruik aan dezelfde soort
  traversalcontrole onderworpen; dubbele namen na het eventueel verwijderen van één gedeelde
  topmap zijn ongeldig;
- uitgepakte ZIP-entries/assets zijn begrensd op 24 MiB per bestand en 48 MiB totaal; opgeslagen
  `mainCode` is begrensd op 48 MiB UTF-8;
- de ZIP zelf moet een gewone (niet-Zip64) archief zijn: Zip64-verpakte extensies worden geweigerd.
  In de praktijk raak je die grens alleen met meer dan 65 535 bestanden of een archief boven de 4 GiB
  — ruim voorbij de limieten hierboven — dus verpak gewoon met de standaardinstellingen van je
  ZIP-programma.

Sinds de gedeelde ZIP-laag (2026-09, issue #27 etappe 3) gelden er naast die twee maten nog twee
grenzen, en die zijn er tegen een **zip bomb**: een archief van een paar kilobyte dat bij het
uitpakken gigabytes oplevert, of dat uit tienduizenden lege entries bestaat. Een extensie-ZIP mag
daarom hoogstens **2048 entries** bevatten, en per entry mag uitgepakt ÷ ingepakt niet boven de
**200×** uitkomen. Beide worden tijdens het uitpakken gecontroleerd, dus een archief dat eroverheen
gaat wordt afgebroken en niet eerst volledig in het geheugen gezet. Een echte extensie zit daar niet
in de buurt: een `main.js` met wat iconen en vertalingen is een handvol bestanden, en 200× is ruim
boven wat deflate op broncode haalt. Loop je er tóch tegenaan, dan is dat vrijwel altijd een teken
dat er build-artefacten of een `node_modules` in de ZIP zijn meegegaan.

Bij installatie vanuit de catalogus moeten de `id` en `version` uit de gevalideerde
`manifest.json` exact overeenkomen met de gevalideerde catalogusentry. De app normaliseert geen
hoofdletters, spaties of versienummers om een mismatch passend te maken. Een aanwezige checksum,
de exacte identiteit, veilige ZIP-paden, consent en opslag zijn afzonderlijke poorten; falen vóór
consent laat geen half geïnstalleerde extensie achter.

De catalogus zelf heeft een atomair topcontract. Is dat topobject ongeldig, dan faalt de catalogus.
Is één entry ongeldig of heeft hij een dubbel `id`, dan wordt alleen die entry overgeslagen en
blijven latere geldige entries zichtbaar. De debuglog vermeldt hoeveel entries zijn overgeslagen.

Bij startup leest de app ieder IndexedDB-record met zijn werkelijke opslagsleutel. Alleen records
waarvan opslagsleutel, record-`id` en manifest-`id` exact overeenkomen en waarvan code/assets geldig
zijn, worden uitvoerbaar. Een ongeldige entry gaat in **quarantaine**: de code wordt niet uitgevoerd,
de kaart heeft geen aan/uit-schakelaar en blijft via de bewaarde echte opslagsleutel verwijderbaar.
Eén kapot record blokkeert latere geldige records niet. Vlak vóór elke activatie wordt het record
opnieuw gelezen en geparseerd, zodat een wijziging ná startup niet alsnog wordt uitgevoerd.

Legacydefaults bestaan alleen in de genormaliseerde geheugenwaarde. Startup herschrijft zo'n oud
record niet stil; pas een expliciete latere statuswrite bewaart de bekende genormaliseerde vorm. Een
mislukte statuswrite verandert de feitelijke runtimekeuze niet: een ingeschakelde extensie blijft
ingeschakeld en een uitgeschakelde blijft uitgeschakeld, met een zichtbare opslagfout op de kaart.

Deze validatie is **geen JavaScript-sandbox**. Zij voorkomt dat ongeldige vormen, identiteiten en
paden de loader passeren, maar geldige extensiecode draait nog steeds in dezelfde realm als de app.
Consent blijft daarom een echte vertrouwensbeslissing: valide betekent structureel bruikbaar, niet
veilig of geïsoleerd.

## main.js

CommonJS-module die `onLoad(api)` exporteert (en optioneel `onUnload()`):

````js
module.exports = {
  onLoad(api) {
    // Importer: verschijnt in Bestand → Importeren
    api.importers.register({
      id: 'mijn-import',
      name: 'Mijn Formaat',
      description: 'Leest .abc-bestanden',
      fileExtensions: ['.abc'],
      handler: async (file) => {
        const text = await file.text();
        // … parse text …
        return { project, calendar, tasks, sequences, resources, assignments };
      },
    });

    // Ribbon-knop (permissie 'ribbon')
    api.ui.addRibbonButton({
      tab: 'start',
      group: 'Mijn Groep',
      label: 'Doe iets',
      onClick: () => api.ui.showNotification('Gedaan!'),
    });
  },
  onUnload() {},
};
````

## API-overzicht

| Onderdeel | Functies |
|---|---|
| `api.importers` | `register(def)`, `unregister(id)` |
| `api.data` | `getProject/getCalendar/getTasks/getSequences/getResources/getAssignments`, `getImportSourceInfo/getImportSourceIssue/getImportSourceChunk/getImportSourceCatalogPage` (permissie `importSource`, zie hieronder), `addTask`, `updateTask`, `addSequence`, `loadProject(result)`, `recalculate()`, `batch(fn)` |
| `api.events` | `on/off/emit` (permissie `events`) |
| `api.ui` | `addRibbonButton(reg)` (permissie `ribbon`), `showNotification(msg, type?)` — zichtbare melding voor de gebruiker, zie hieronder |
| `api.settings` | `get(key, default)`, `set(key, value)` — per extensie geprefixt in localStorage |
| `api.assets` | `get(name)` — rauwe bytes van een mee-verpakt (niet-`main`/`manifest`) ZIP-bestand, of `undefined` (kern-API) |
| `api.pdfFonts` | `register(provider)` (permissie `pdf-fonts`) — font-provider voor de vector-PDF-export; automatisch uitgeschreven bij disable |
| `api.help` | `registerArticles(articles)`, `unregisterArticles()`, `openBundledProject(assetName)`, `startGuide(guide)`, `stopGuide()` (permissie `help`, sinds `1.4.0`) — alles automatisch opgeruimd bij disable/verwijderen |

`showNotification(msg, type?)` toont de tekst als melding onderaan het scherm, via hetzelfde
meldingenkanaal als de app zelf, voorafgegaan door de naam van de extensie ("Extensie Rapportmaker:
Gedaan!"). De tekst wordt niet vertaald en altijd als platte tekst getoond: HTML of Markdown verschijnt
letterlijk. `type` is `'info'` (standaard), `'warning'` of `'error'`; `'error'` blijft staan tot de
gebruiker hem wegklikt, `'info'` en `'warning'` verdwijnen na enkele seconden. Tegen overspoelen:
dezelfde tekst herhalen vouwt samen tot één melding met een teller, en een extensie toont hooguit drie
nieuwe meldingen per tien seconden — de rest gaat alleen naar de debuglog. Elke aanroep komt ook in de
debuglog (kanaal `ext:<id>`). Teksten langer dan 500 tekens worden in de melding afgekapt.

`addSequence` retourneert `string | null`: het nieuwe relatie-id, of **`null`** wanneer de relatie
geweigerd is — een duplicaat (zelfde voorganger + opvolger + type), een zelfrelatie, een onbekende
taak, een relatie tussen een taak en zijn eigen (voor)ouder-samenvattingstaak, of een relatie die een
**kring** zou sluiten (ook via de bladtaken van een samenvattingstaak). Een gewone samenvattingstaak
als voorganger of opvolger is toegestaan: de berekening rekent zo'n relatie door naar de
onderliggende taken. Controleer
het resultaat dus op `null` in plaats van aan te nemen dat elke aanroep slaagt. Dit retourtype is
strikt correcter dan het oude gedrag: bij een geweigerd duplicaat gaf `addSequence` voorheen ook al
gewoon een `string` terug — een id dat nergens naar verwees, omdat de relatie zelf nooit is
toegevoegd.

Een taak onder een andere ouder hangen doe je met `updateTask(id, { parentId })`. Dat is geen kaal
veld maar een **verplaatsing**, dezelfde als rij-slepen in de app: de taak komt achteraan bij de
nieuwe ouder (`null` = wortel) en de kindlijsten van oude en nieuwe ouder worden bijgewerkt. Een
**onbekende ouder**, of een ouder die de taak zelf of een eigen afstammeling is (een kring), **gooit
een fout** vóór er iets gewijzigd is — ook de overige velden uit dezelfde aanroep worden dan niet
toegepast. Dezelfde ouder terugschrijven (bijvoorbeeld een ongewijzigd object uit `getTasks()`)
verplaatst niets. `addTask({ ..., parentId })` weigert een onbekende ouder op dezelfde manier.

`resourceIds` op een taak is **geen schrijfbaar veld**: het is een afgeleide van de toewijzingen
(`getAssignments()`), en alleen een toewijzing geeft belasting en overleeft opslaan. `updateTask`
negeert een `resourceIds` die gelijk is aan de huidige waarde (bijvoorbeeld een ongewijzigd object uit
`getTasks()`; de volgorde telt niet) en `addTask` accepteert alleen `[]`. Een andere waarde **gooit een
fout** vóór er iets gewijzigd is — ook de overige velden uit dezelfde aanroep worden dan niet toegepast.
Toewijzingen zet een extensie mee via `loadProject(result)` (`result.assignments`); losse
toewijzingsmutaties kent de API niet.

Belangrijk: na het muteren van taken/relaties zelf `api.data.recalculate()` aanroepen — het schema wordt niet reactief herberekend. `loadProject()` doet dat automatisch.

**Muteer je meer dan een handvol dingen in een lus, wikkel dat dan in `api.data.batch()`.** Elke
losse mutatie legt anders een eigen undo-snapshot aan: honderd taken toevoegen kost honderd
snapshots (de kosten lopen kwadratisch op) en laat honderd undo-stappen achter voor wat de
gebruiker als één handeling ziet. Binnen `batch` wordt de snapshot één keer genomen:

```js
api.data.batch(() => {
  for (const row of rows) api.data.addTask({ name: row.naam });
});
api.data.recalculate();
```

`batch` kent geen rollback: gooit je callback halverwege, dan blijft staan wat al gemuteerd is —
maar de ene snapshot dekt de begintoestand, dus de gebruiker draait het in één keer terug.
Nesten mag; de binnenste `batch` doet dan niets extra's.

### Binaire assets & font-providers

Bestanden die je náást `manifest.json` en `main.js` in de installatie-ZIP stopt, worden bewaard als
**assets** en zijn op naam op te vragen met `api.assets.get(naam)` (rauwe `Uint8Array`, of `undefined`).
Dat is de manier om binaire data mee te leveren — bijvoorbeeld font-bytes. Een los `.js`-geïnstalleerde
extensie heeft geen assets. Grootte is begrensd (per bestand ≤ 24 MB, samen ≤ 48 MB).

Met de permissie `pdf-fonts` registreer je zulke bytes als **font-provider** voor de vector-PDF-export.
Een provider levert rauwe glyf-TTF-bytes + een codepoint-dekking; de export subset en bedt hem
conditioneel in. De registratie wordt bij het uitschakelen automatisch teruggedraaid.

````js
// manifest.json → "permissions": ["pdf-fonts"], en test.ttf mee in de ZIP.
module.exports = {
  onLoad(api) {
    api.pdfFonts.register({
      id: 'mijn-font',
      covers: (cp) => cp >= 0x4e00 && cp <= 0x9fff,   // bv. CJK Unified Ideographs
      getRegularBytes: async () => api.assets.get('test.ttf'),
      // getBoldBytes: async () => api.assets.get('test-bold.ttf'),  // optioneel
    });
  },
};
````

### Help & begeleiding (permissie `help`, sinds 1.4.0)

Hiermee levert een extensie **tutorials**: artikelen die in Help onder *Tutorials* verschijnen, met
screenshots en projectbestanden uit de eigen assets, en een **begeleidingspaneel** waarin de gebruiker
de tutorial stap voor stap in de app zelf doorloopt. Declareer `"permissions": ["help"]` en
`"apiVersion": "1.4"`. De vorm staat in `src/extensions/types.ts` (`ExtHelpArticle`, `ExtGuide`,
`ExtGuideStep`); de validatie in `src/utils/helpArticleRegistry.ts` en `src/extensions/guideModel.ts`.

```ts
api.help.registerArticles(articles: ExtHelpArticle[]): void;   // gooit bij ongeldige invoer
api.help.unregisterArticles(): void;
api.help.openBundledProject(assetName: string): Promise<void>;
api.help.startGuide(guide: ExtGuide): void;                     // gooit bij ongeldige invoer
api.help.stopGuide(): void;

interface ExtHelpArticle { id: string; kind: 'tutorial'; order: number;
  title: { nl: string; en: string }; body: { nl: string; en: string } }
interface ExtGuide { id: string; title: { nl: string; en: string }; steps: ExtGuideStep[] }
interface ExtGuideStep {
  id: string;
  body: { nl: string; en: string };            // opdracht, dan een regel '---', dan de uitleg
  anchor?: string;                             // data-tour-anchor, zie hieronder
  check?: (api) => boolean | Promise<boolean>; // is de stap gedaan?
  prepare?: (api) => void | Promise<void>;     // "Toon mij"
  resetAsset?: string;                         // "Opnieuw": .ifc met de beginstand van de stap
}
```

**Artikelen.** `registerArticles` is een dunne laag op het Help-register, met het extensie-id als bron.
Regels: `id` in kleine letters, cijfers en streepjes en uniek over alle bronnen; `kind` is
`'tutorial'`; `order` is een positief geheel getal (de leerroute); titel en tekst in `nl` én `en`,
niet leeg. Ongeldige invoer registreert **niets** en gooit met alle problemen in één melding; opnieuw
aanroepen vervangt de vorige set. Talen: de Help-viewer toont `nl` bij een Nederlandse docstaal en
anders `en`. De tekst gebruikt dezelfde Markdown-subset als de ingebouwde gidsen, met twee
extensie-specifieke aanvullingen:

- `![alt](img/{lang}/stap-1.webp)` — de afbeelding komt uit je **eigen assets** (het ZIP-pad), met
  `{lang}` vervangen door `nl` of `en`. De app maakt er een blob-URL van en trekt die in bij het
  uitschakelen. Ontbreekt de asset, dan toont de viewer de alt-tekst in een placeholder.
- `[Open het startproject](project://start.ifc)` — opent die meegeleverde `.ifc` als nieuw document
  (zelfde route als `openBundledProject`). Lukt dat niet, dan meldt de app "Het projectbestand … van
  de extensie … kon niet worden geopend"; een dubbelklik opent één document.

**Meegeleverd project.** `openBundledProject('start.ifc')` opent een `.ifc` uit je assets als
**nieuw document**, precies zoals een voorbeeld uit Bestand → Voorbeelden: zonder opslagdoel of
bestandshandle (opslaan wordt Opslaan als), en het actieve document wordt nooit overschreven — alleen
een leeg, ongewijzigd tabblad wordt hergebruikt. Vanuit Backstage springt de app daarna naar Start.
De belofte wordt afgewezen als de asset ontbreekt, geen `.ifc` is of niet te lezen is (in dat laatste
geval heeft de app zelf al "Bestand openen mislukt" gemeld).

**Begeleiding.** `startGuide` valideert eerst de hele begeleiding (id's, teksten in `nl` en `en`, hooguit
één `---` per tekst en een opdracht ervóór, geldige ankernaam, `check`/`prepare` zijn functies,
`resetAsset` is een `.ifc` die in je assets zit) en start bij de eerste fout niets. Er loopt hooguit
één begeleiding tegelijk. Een nieuwe `startGuide` van je eigen extensie vervangt je vorige; loopt er
een begeleiding van een **andere** extensie, dan gooit `startGuide` en blijft die staan — alleen de
gebruiker (Sluiten) of de eigenaar (`stopGuide`) maakt plaats. Het paneel wordt door de **app** getekend
(thema, tekstrollen, RTL en vertaalde knoppen) en toont titel, "Stap n van N", de opdracht, en —
zodra de stap gedaan is — de uitleg ná `---`. Afbeeldingen en `project://`-links in een stap werken
zoals in een artikel. Knoppen: **Terug**, **Toon mij** (alleen met `prepare`), **Opnieuw** (alleen met
`resetAsset`), **Volgende** / **Klaar** op de laatste stap, en Sluiten.

- `check(api)` roept de host aan bij het openen van de stap en daarna, gebundeld (hooguit eens per
  150 ms), na elke wijziging in de app — je hoeft zelf geen events te beluisteren. Alleen `true`
  telt; dan is de stap gedaan en blijft hij dat tot de stap opnieuw begint (Terug, Volgende,
  Opnieuw). Een asynchrone uitkomst van een eerdere doorgang van de stap telt niet — ook niet van
  dezelfde stap na Opnieuw of Terug→Volgende.
  Lees de toestand via `api.data.*`.
- **Zonder `check`** toont het paneel direct de uitleg en de knop **Klaar, volgende**.
- **Toon mij** roept `prepare(api)` aan en controleert daarna meteen. **Opnieuw** opent
  `resetAsset` als nieuw document en begint de stap opnieuw. Zolang een van beide (of een
  `project://`-link in de stap) nog loopt, zijn de knoppen uitgeschakeld.
- **Fouten** in `check`/`prepare` (gooien of een afgewezen belofte) vangt de app op en meldt ze via het
  meldingenkanaal ("Een stap van de extensie … gaf een fout"); een gooiende `check` wordt daarna niet
  meer aangeroepen en de stap valt terug op **Klaar, volgende**. De gebruiker komt nooit vast te zitten.
- `stopGuide()` sluit alleen een begeleiding van je eigen extensie. Uitschakelen of verwijderen van
  de extensie sluit het paneel en haalt de artikelen uit Help. Daarna gooit elke `api.help.*`-methode
  (`openBundledProject` wordt afgewezen): een achtergebleven timer van een uitgeschakelde extensie kan
  niets meer neerzetten.

Het paneel zweeft rechtsonder (in `ar`/`fa` linksonder) boven de statusbalk, en niet in de
rechterrail: die bestaat niet in de volledige weergaven (Tabel, IFC, Rapport, Resources) en in
Backstage, terwijl een tutorial daar juist doorheen loopt. Ligt het gemarkeerde element onder het
paneel en is de andere kant vrij, dan wijkt het paneel daarheen uit. Het ligt boven dialogen en onder
de meldingen.

**Ankers.** `anchor` is de waarde van een `data-tour-anchor`-attribuut; de app markeert dat element
met dezelfde rand als de rondleiding, maar **niet modaal**: de gebruiker kan het gewoon aanklikken. Een
element dat uit meerdere delen bestaat, krijgt één markering om alle zichtbare delen. De markering
verdwijnt zodra de stap gedaan is. Beschikbare ankers:

- `ribbon-tab:<tab>` — elk linttabblad, ook `ribbon-tab:file`;
- `ribbon-group:<tab>:<groupId>` — elke lintgroep;
- `ribbon:<tab>:<itemId>` — elke lintknop en elk lintwidget (dropdown, invoerveld). Deze drie komen
  automatisch uit het lint; de id's zijn die uit `src/components/layout/Ribbon/ribbonConfig.tsx`,
  bijvoorbeeld `ribbon:start:addTask` (Taak), `ribbon:start:milestone`, `ribbon:planning:calendar`.
  Staat de knop op een ander tabblad dan het actieve, dan markeert de app `ribbon-tab:<tab>`, zodat
  de gebruiker ziet welke tab hij moet openen. Knoppen die een extensie zelf aan het lint toevoegt,
  hebben (nog) geen anker;
- vaste ankers voor de hoofdpanelen: `ribbon-tabs`, `gantt-panel`, `properties-panel` (de
  rechterrail), `rail:properties`, `rail:resources`, `rail:warnings`, `histogram-strip`,
  `report-panel`, `status-bar`, `backstage-examples`, `feedback-button`.

Ankernamen bestaan uit letters, cijfers en `: . _ -`. Een anker dat (nog) niet in beeld is, geeft
geen markering en geen fout.

```js
// manifest.json → "permissions": ["help", "ribbon"], "apiVersion": "1.4";
// in de ZIP: start.ifc, img/nl/taak.webp, img/en/taak.webp
module.exports = {
  onLoad(api) {
    api.help.registerArticles([{
      id: 'tut-1-eerste-planning', kind: 'tutorial', order: 1,
      title: { nl: 'Je eerste planning', en: 'Your first schedule' },
      body: {
        nl: '# Je eerste planning\n\n[Open het startproject](project://start.ifc)\n\n![Taak](img/{lang}/taak.webp)',
        en: '# Your first schedule\n\n[Open the starting project](project://start.ifc)\n\n![Task](img/{lang}/taak.webp)',
      },
    }]);
    api.ui.addRibbonButton({
      tab: 'start', group: 'Tutorials', label: 'Tutorial 1',
      onClick: async () => {
        await api.help.openBundledProject('start.ifc');
        const start = api.data.getTasks().length;
        api.help.startGuide({
          id: 'tut-1', title: { nl: 'Je eerste planning', en: 'Your first schedule' },
          steps: [{
            id: 'taak-toevoegen',
            body: {
              nl: 'Klik op **Taak** in het lint.\n\n---\n\nDe nieuwe taak staat onderaan en is geselecteerd.',
              en: 'Click **Task** on the ribbon.\n\n---\n\nThe new task is at the bottom and selected.',
            },
            anchor: 'ribbon:start:addTask',
            check: (a) => a.data.getTasks().length > start,
            prepare: (a) => { a.data.addTask({ name: 'Nieuwe taak' }); },
            resetAsset: 'start.ifc',
          }],
        });
      },
    });
  },
};
```

### Rekenprofiel (sinds 1.2.0)

`data.getProject()` levert sinds contractversie `1.2.0` het veld `schedulingProfile`: het rekenprofiel
van het project (`id`, `baseId` ∈ `p6`/`msproject`/`ops`, `name` — leeg bij een ingebouwd profiel —
en `conventions`, de opgeloste conventies — sinds X12 brok 2 zevenentwintig). Het veld is **alleen-lezen**: de app neemt het
nooit over uit wat een extensie teruggeeft. Een importer-resultaat van een extensie opent daarom altijd
als OPS; het profiel kiest de gebruiker in Bestand → Projectinfo.

### Read-only XER-bronroute (permissie `importSource`, `apiVersion` ≥ 1.1)

Naast de gemapte `data.*`-DTO's (afgeleid, genormaliseerd, altijd beschikbaar) kan een extensie met
de permissie `importSource` ook bij de **oorspronkelijke, ongewijzigde brondata** van het huidige
document — vandaag alleen voor een geopend `.xer`-bestand (Primavera P6). Zonder deze permissie
gooien alle vier de methoden vóórdat er ook maar één byte gelezen wordt; er lekt dus niets via een
gedeeltelijke aanroep of een foutpad. Deze drie methoden bestaan sinds contractversie `1.1.0` (zie
*Twee versievelden, twee vragen* hierboven) — declareer `"apiVersion": "1.1"` of hoger in je
manifest als je erop rekent; een host ouder dan 1.1 kent de methoden simpelweg niet. De vierde,
`getImportSourceIssue()`, bestaat sinds `1.2.0` (declareer `"apiVersion": "1.2"`).

**Waarom een aparte permissie en geen kern-API.** De rest van `api.data.*` levert het interne
projectmodel: taken, kalender, relaties — precies wat de importer ervan gemaakt heeft. De
bronroute geeft de **volledige originele bytes en tabellen** terug, inclusief kolommen die de
importlaag bewust nooit in het projectmodel materialiseert (audit-/herkomstvelden als
`create_user`/`update_date`, kosten, review-/locatievelden, ongebruikte UDF's, …). Dat is een
wezenlijk grotere blootstelling dan "de app leest dit bestand" — elke geïnstalleerde extensie zou
anders, ook zonder enige andere permissie, de rauwe brontekst van elk geopend project kunnen lezen
en doorsturen. Vandaar: default-deny, expliciet gedeclareerd in `manifest.json`.

```js
// manifest.json → "permissions": ["importSource"]
const info = api.data.getImportSourceInfo();     // null buiten een XER-document
if (info) {
  console.log(info.sourceFormat, info.archive.byteLength, info.catalogs.taskSourceRows.totalRows);
}
```

- **`getImportSourceInfo()`** → `ExtImportSourceInfo | null`. Een kleine, samengestelde samenvatting
  (bronformaat, archief-identiteit inclusief `sha256`/`byteLength`/`chunkCount`, getalnotatie,
  diagnostiek-tellingen, het importrapport, de schedule-options-herkomst en catalogustellingen).
  Geen record-inhoud. **`null`** wanneer het actieve document geen retained XER-bron heeft (elk
  niet-XER-document, of een XER-document van vóór deze functie).
- **`getImportSourceIssue()`** → `ExtImportSourceIssue | null`. `null`, tenzij het document een
  XER-bronarchief **had** dat bij het openen onbruikbaar bleek en is weggelaten (eigenaarsbesluit
  2026-09-24, "openen met melding": een corrupt of door andere IFC-software herschreven archief
  gijzelt het project niet meer). Dan `{ code }` met `code` ∈ `schema-version` | `hash-mismatch` |
  `truncated` | `bytes-missing` | `metadata-invalid` | `structure`. Zo onderscheid je "nooit een
  XER-bron" van "bron verloren bij openen"; `getImportSourceInfo()` is in beide gevallen `null`.
  Alleen de code, geen technische reden (die bevat bestandsgestuurde namen).
- **`getImportSourceChunk(index)`** → `Uint8Array | null`. Eén losse, verse kopie van een stuk van
  de oorspronkelijke bestandsbytes (`archive.chunkSize`/`archive.chunkCount` uit `getImportSourceInfo()`
  geven de indeling). Concateneer alle chunks 0..`chunkCount - 1` in volgorde om de **exacte**
  oorspronkelijke bytes te reconstrueren — vergelijk de `sha256` uit `getImportSourceInfo()` om dat
  te bevestigen. Een ongeldige index (negatief, fractioneel, of buiten bereik) gooit een
  `RangeError`; buiten een XER-document levert de methode `null`.
- **`getImportSourceCatalogPage(collection, options?)`** → `ExtImportSourceCatalogPage | null`.
  Gepagineerde, per record gekopieerde toegang tot de retained brontabellen (task-bronrijen,
  resource-/rol-/tarief-/curve-/toewijzingsrijen, activiteitscodes, custom-field-definities,
  UDF-waarden, schedule-options-bronrijen, …) — zie `ExtImportSourceCollection` in `extTypes.ts`
  voor de volledige lijst. `options.offset` (default 0) en `options.limit` (default 100, **maximaal
  500 per pagina**) sturen de paginering; een niet-safe-integer of negatieve waarde gooit een
  `RangeError`, net als een onbekende `collection`. Een `offset` voorbij het einde van de collectie
  gooit **niet** — hij wordt gecanoniseerd naar `total` en levert zo een lege, geldige laatste
  pagina (`items: []`) in plaats van een fout of een numeriek onveilige slice.  Buiten een
  XER-document levert de methode `null`.

**Documentbinding, selector en documentdrift tijdens pagineren.** Alle drie de methoden werken op
het **actieve document**: bij het wisselen van document (`switchDocument`) volgen ze automatisch
mee naar de bronroute (of het ontbreken daarvan) van het nieuw actieve document. `info.selector`/
`info.sourceProjectId` identificeert welk P6-project binnen het (mogelijk multi-project)
XER-bestand dit document vertegenwoordigt — een `.xer`-bestand kan meerdere documenten openen (één
per project), en elk document draagt zijn eigen bronselector.

Dat "automatisch meevolgen" is handig voor een enkele aanroep, maar een **risico bij pagineren**:
pagineren is per definitie meerdere aanroepen na elkaar, en er is geen paginasessie die aan één
document vastzit. Wisselt de gebruiker tussen twee `getImportSourceCatalogPage`-aanroepen van
document (`switchDocument`), dan levert de tweede aanroep zonder verdere maatregelen gewoon een
pagina van het **nieuwe** actieve document — bijvoorbeeld een lege pagina omdat dat project minder
records heeft, wat een naïeve extensie laat concluderen "klaar" terwijl in werkelijkheid twee
projecten door elkaar zijn gehaald. Geef daarom `options.expectedSourceProjectId` mee met het
`sourceProjectId` dat je van een eerdere aanroep kreeg: wijkt de actieve bronselector af (ook als
het actieve document inmiddels helemaal geen XER-bron meer heeft), dan gooit de aanroep een
`ExtImportSourceDriftError` in plaats van stilzwijgend door te gaan. Zonder deze optie is er **geen**
driftbewaking. Dezelfde risicoklasse geldt in mindere mate voor het na elkaar opvragen van meerdere
`getImportSourceChunk`-indexen om de bronbytes te reconstrueren — vergelijk daar `sourceProjectId`
(of de `sha256`) tussen chunks als je niet zeker weet dat het document niet wisselt.

**Verse kopieën, geen aliasing.** Zoals de rest van `api.data.*` levert elke aanroep een nieuwe,
onafhankelijke kopie: muteren van een teruggegeven `info`, cataloguspagina-item of chunk raakt het
retained archief niet, en twee aanroepen na elkaar geven nooit hetzelfde object terug.

### Datacontract: de `Ext*`-typen

Alles wat via `api.data.*`, de importer-handlers en `sdk.factory.*` de extensie in- en uitgaat, gebruikt **stabiele extensie-typen** (`ExtProject`, `ExtCalendar`, `ExtTask`, `ExtTaskTime`, `ExtSequence`, `ExtResource`, `ExtAssignment`, `ExtImportResult`; gedefinieerd in `src/extensions/extTypes.ts`). Dit is het **publieke contract** — bewust losgekoppeld van het interne domeinmodel, zodat een interne refactor jouw extensie niet breekt.

- `api.data.addTask` met een niet-gestarte urentaak (`time.durationUnit: 'hours'` of `time.durationMinutes`) zonder `time.scheduleFinish`: de app leidt het geplande einde af uit start + duur op de taakkalender, net als bij een taak die de gebruiker toevoegt; een meegegeven `earlyFinish`/`lateFinish` telt dan niet (rekenuitvoer, de volgende berekening zet ze). Geef je zelf een `scheduleFinish` mee, dan wint dat. `sdk.factory.createTask` leidt niets af (geen document, geen kalender).
- `api.data.getTasks()` (en de andere `get*`) leveren **verse, muteerbare kopieën**: je mag het teruggegeven object gerust muteren, dat raakt de store niet. Schrijf terug via `addTask`/`updateTask`/`addSequence` en roep `recalculate()` aan. (Vóór P16 waren dit Immer-*bevroren* objecten die je niet mocht muteren — die beperking is vervallen.)
- Een importer-handler retourneert een `ExtImportResult` (bouw 'm met `sdk.factory.emptyImportResult()`); de host mapt dat intern.

## Host-SDK: `require('open-planner-studio')`

Naast de scoped `api` (die `onLoad(api)` binnenkrijgt) kun je de **host-SDK** ophalen. Die is
globaal en stateloos — alleen versie-info, constanten en pure helpers om geldige
domeinobjecten te bouwen. Muteren doe je nooit via de SDK, maar via `api.data.*`.

````js
const sdk = require('open-planner-studio');

sdk.version;            // app-versie, bv. "2026.6.0"
sdk.categories;         // geldige manifest-categorieën
sdk.permissions;        // geldige manifest-permissies
sdk.hostEvents;         // { projectLoaded, projectNew, scheduleCalculated }

sdk.utils.generateId('seq');                 // id volgens de app-conventie
sdk.utils.formatDate(new Date());            // "YYYY-MM-DD"
sdk.utils.parseDate('2026-06-19');           // Date (UTC-middernacht)
sdk.utils.addBusinessDays(date, 5);          // werkdagen optellen

sdk.factory.createProject({ name: '…' });    // volledig Project
sdk.factory.createCalendar();                // standaard WorkCalendar
sdk.factory.createTask({ name: 'Taak' });    // volledige Task met defaults
sdk.factory.createTaskTime(start, 10);       // TaskTime met duur in werkdagen
sdk.factory.emptyImportResult();             // { project, calendar, tasks: [], … }
````

Een importer wordt zo veel korter:

````js
function parse(text) {
  const result = sdk.factory.emptyImportResult();
  result.project = sdk.factory.createProject({ name: 'Import' });
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    result.tasks.push(sdk.factory.createTask({ name: line.trim() }));
  }
  return result;
}
````

## Host-events

De app zendt lifecycle-events op dezelfde bus als `api.events`. Abonneer met
`api.events.on(...)` (permissie `events`); de namen staan in `sdk.hostEvents`:

| Event (`sdk.hostEvents.…`) | Naam | Data |
|---|---|---|
| `projectLoaded` | `host:project-loaded` | `{ tasks, sequences, resources }` |
| `projectNew` | `host:project-new` | — |
| `scheduleCalculated` | `host:schedule-calculated` | `{ hasError, error, criticalTasks }` |

````js
api.events.on(sdk.hostEvents.scheduleCalculated, (d) => {
  api.ui.showNotification(`Schema berekend — kritiek: ${d.criticalTasks}`);
});
````

## Compleet voorbeeld

Zie [`examples/extensions/voorbeeld-takenlijst-importer/`](../examples/extensions/voorbeeld-takenlijst-importer/) —
een werkende referentie-extensie (importer + ribbon-knop + host-event) met `manifest.json`,
`main.js`, een voorbeeld-invoerbestand en een README.

## Installeren

Bestand → Extensies → **ZIP** of **JS** (lokaal bestand), of via de **Bladeren**-tab (catalogus: `OpenAEC-Foundation/open-planner-studio-extensions`).

Bij een los `.js`-bestand mag het manifest als commentaarblok bovenaan:

````js
/** @manifest { "id": "mijn-extensie", "name": "Mijn Extensie", "version": "1.0.0", "apiVersion": "1.0", "minAppVersion": "0.0.0", "author": "Ik", "description": "…", "category": "Utility", "main": "main.js", "permissions": [] } */
````

## Beperkingen

- Er is geen JavaScript-sandbox: extensie-code draait via `new Function(...)` en heeft toegang tot `window`, `document` en `fetch`. Permissies worden hard afgedwongen (default-deny) voor `ribbon`/`events`/`pdf-fonts`/`importSource`/`help`, in warn-modus voor `backstage`, en zijn voor `filesystem`/`network` puur informatief (geen technische grens). Installeer alleen extensies die je vertrouwt.
- Objecten uit `api.data.get*()` zijn **verse, muteerbare `Ext*`-kopieën** — muteren raakt de store niet; schrijf terug via de muterende API-functies.
- Het `@manifest`-commentaarblok in een los .js-bestand moet een plat JSON-object zijn (geen geneste objecten).
