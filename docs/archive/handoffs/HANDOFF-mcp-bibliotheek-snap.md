# HANDOFF — MCP × resourcebibliotheken, en de snap-verificatie

**Sessie 2026-07-27 → 2026-07-30. Alles hieronder staat op `main`.** Commits: `efc0ec0`, `32d1b6d`,
`d950a6b`, `cd00d22`, `f74a73a`.

Dit document is een overdracht, geen ontwerpdocument. Het beschrijft wat er gemeten is, wat daaruit
besloten en gebouwd is, en — even belangrijk — wat er **niet** is vastgesteld. De lopende to-do's
staan in [docs/TODO.md](TODO.md); hier staat de context die daar niet in past.

---

## 1. De aanleiding

De MCP-bridge en B1.1 (bedrijfscentrische resourcebibliotheken) zijn onafhankelijk gebouwd en
raakten elkaar voor het eerst. Niemand had gemeten wat er gebeurt als een `planner_*`-tool een
resource of kalender muteert die een herkomststempel (`libraryOrigin` + `syncedHash`) draagt.

Twee faalvormen stonden op het bord:

1. **Stempel blijft liggen** — de hash wordt niet bijgewerkt, het item geldt bij de volgende
   verversgrens als `deviated`, en de gebruiker krijgt een afwijkingsvraag over een wijziging die hij
   zelf niet maakte.
2. **Stempel wordt blind meegeschreven** — de hash wordt wél bijgewerkt zonder dat de pool verandert,
   waardoor een echte afwijking wordt weggeslikt.

## 2. Wat de meting opleverde

**Het stempelbeheer was in orde.** Geen van beide faalvormen kwam voor, op geen van de drie routes
(direct, via `planner_batch`, en bij aanmaken/verwijderen). De tools laten `libraryOrigin` met rust en
werken `syncedHash` niet bij.

| Handeling | Stempel | Hash | Status bij de grens |
|---|---|---|---|
| `costPerHour` 65 → 95 | blijft | ongewijzigd | `deviated` |
| hernoemen | blijft | ongewijzigd | `deviated` |
| `maxUnits` 2 → 4 | blijft | ongewijzigd | `in-sync` — geen valse vraag |
| create in gekoppeld project | géén stempel | — | projecteigen, pool blijft 1 |
| delete gestempeld item | — | — | pool onaangeroerd |
| `update_calendar` `hoursPerDay` 8 → 6 | blijft | ongewijzigd | `deviated` |

**Faalvorm 2 is erger dan oorspronkelijk gedacht.** Bij een blind meegeschreven hash geldt
`fileHash === syncedHash`, en `classifyOnOpen` leest dat als `behind` — en `behind` wordt door
`runOpenBoundary` **stil ververst** naar de poolwaarden. De AI-bewerking zou dan niet onbevraagd
blijven maar geruisloos verdwijnen. Dat maakt de assertie "hash mag niet meebewegen" de
belangrijkste regel van de hele batterij.

## 3. Wat er wél mis bleek: een bevoegdheidsverschil

`ResourcePanel` rendert naam, type, tarief/uur en eenheid als **platte tekst** zodra er een stempel op
zit (`isResourceFieldLocked`); `description` heeft in de projectweergave niet eens een kolom. Dat zijn
precies de vijf `RESOURCE_DIFF_FIELDS` die `planner_manage_resources` gewoon schreef.

De bridge deed dus iets wat de gebruiker zelf niet kán. Gemeten gevolg: AI zet het tarief op 95 →
`deviated` → afwijkingsdialoog → gebruiker kiest "bibliotheekwaarden gebruiken" (de veilige,
voor de hand liggende keuze) → **tarief terug naar 65, naam mee terug**. Een lus waar niemand iets
aan heeft.

**Besluit van de eigenaar: spiegelen, dus weigeren.** De redenering, omdat die de volgende keuze
stuurt:

- De repo heeft dit principe al vastgelegd — main is er weken doorheen gegaan om stille no-ops te
  vervangen door expliciete weigeringen. Een tool die een veld schrijft dat de gebruiker niet kán
  schrijven is een variant van hetzelfde probleem.
- Een weigering is hier inhoudelijk **beter advies** dan uitvoering: "zet het tarief op 95" is in dit
  model geen projecthandeling.
- Het slot heeft een ontsnappingsluik dat er bewust zit: losmaken van de bibliotheek.

**Uitdrukkelijk NIET de bedoeling:** de pool zelf via MCP muteerbaar maken. Dat is app-globale data
die door alle projecten gedeeld wordt, en bibliotheekbewerkingen vallen buiten de ongedaan-maak-
geschiedenis. Eén tariefwijziging zou doorwerken in projecten die niet openstaan, onherroepelijk.
Komt er ooit een poolroute, dan verdient die een eigen ontwerp met expliciete bevestiging.

## 4. Wat er gebouwd is

| Waar | Wat |
|---|---|
| `src/services/mcp/tools/resourceTools.ts` | `libraryLockReason()` — weigert een `update` op een vastgelegd veld van een gestempelde resource. Een **gemengde** update (`maxUnits` + `costPerHour`) sneuvelt in zijn geheel; half toepassen zou de stille-no-op-klasse terugbrengen. |
| `src/services/mcp/tools/readTools.ts` | `planner_list_resources` geeft per geërfde rij een `library`-blok: `company`, `status`, `lockedFields`. De schrijfkant weigert op iets wat de leeskant nu toont. |
| `public/docs/{nl,en}/gids-ai-mcp.md` | Nieuwe paragraaf **"Wat een assistent níet mag"** — met per punt de reden, niet alleen de regel. |
| `tests/mcp/cases-bibliotheek.ts` | 13 tests. Mutatie-getest: gating eruit = 3 rood; hash blind bijwerken = 3 rood; stempel strippen = 4 rood; kalendervariant apart = 1 rood. |

**Eén bron, geen tweede administratie.** De gating leunt op `onOpenStatusForResource` +
`isResourceFieldLocked` + `RESOURCE_DIFF_FIELDS` — exact wat het paneel gebruikt. Verhuist een veld
ooit van bedrijfsafspraak naar projectinzet, dan bewegen paneel en bridge samen mee.

**Kalenders houden hun gedrag.** De kalenderdialoog kent geen slot, dus daar is `deviated` juist de
gespiegelde uitkomst. Niet "vergeten" — bewust.

**Buiten schot, net als in de UI:** een stempel van een ánder bedrijf, een `removed`-wees, en
`delete` (dat is in de UI ook gewoon een rijactie).

## 5. Bijvangst: main stond rood

`tests/mcp/cases-uurkalender.ts` pinde de IFC-beperking dat een kalender zonder taak of resource niet
wordt teruggelezen. B1.1 heeft die opgeheven (de "A2-fix" in `ifcReader.extractCalendarLibrary` vangt
nu álle `IFCWORKCALENDAR`-entiteiten op — de bedrijfspools hadden er zelf last van). De assertie is
omgedraaid naar het nieuwe gedrag; het bijbehorende TODO-punt is vervallen.

## 6. De snap-verificatie (T24, eindelijk echt gelopen)

Aanleiding: de storebeschrijving prijst de MCP-server aan, maar `snap/snapcraft.yaml` plugde alleen
`network` (client-only). Verwachting was dat de bridge niet zou kunnen luisteren.

**Die verwachting was fout.** Gemeten op de geïnstalleerde snap **2026.7.13 rev 1**:

| Test | Uitkomst |
|---|---|
| TCP-listener binnen `snap run --shell` | lukt (3878, 8080) |
| De app zelf | luisterde al op 127.0.0.1:3877 |
| Geen token / fout token | 401 |
| `Origin`-header | 403 |
| `initialize` | serverInfo `2026.7.13` |
| `tools/list` | 39 tools, allemaal `planner_`-prefix |
| Echte `tools/call` | correcte envelope + data van het open document |
| `xdg-open` op de backupmap | exitcode 0, bestandsbeheerder startte |
| Auto-backup | twee documentmappen met echte IFC-snapshots |

Alle antwoorden kwamen direct — geen spoor van het 120s-timeout-beeld uit de eerdere koppelpoging.
Dat bevestigt dat die hang een verweesde instantie was, niet iets structureels.

**Waarom het zonder `network-bind` werkt:** `browser-support` staat in het seccomp-profiel
bind/listen/accept toe "for anonymous sockets", en er zijn geen AppArmor-inet-regels die het alsnog
mediëren. De mogelijkheid om te luisteren komt dus van een plug die er **voor WebKit** zit.
`network-bind` is alsnog toegevoegd — **niet als reparatie**, maar om die afhankelijkheid vast te
leggen, zodat de bridge niet stilvalt als `browser-support` ooit wordt aangescherpt.

## 7. Wat NIET is vastgesteld

Lees dit vóór je iets van hierboven als zekerheid gebruikt.

- **De gating zit niet in de uitgeleverde snap.** Die draait 2026.7.13; de weigering komt pas in een
  volgende release. Wil je hem live zien: `npm run tauri:dev` uit een worktree.
- **De backupmap-knop zelf is niet geklikt.** Getest is het mechanisme (`xdg-open` door de portal),
  niet `AiSafetyGroup`'s knop.
- **Of binden zónder `network-bind` ooit geweigerd zou worden**, is niet aangetoond — er was geen
  geïnstalleerde snap mét die plug als vergelijkingsgeval.
- **Geen enkele mutatie is via de bridge op een echt plan gedaan** in deze ronde; alle live-aanroepen
  waren read-only tegen het geopende document.

## 8. Openstaand

In [docs/TODO.md](TODO.md), met de volledige omschrijving:

- **"Losmaken van de bibliotheek" als MCP-actie** — directe vervolgstap. De weigering verwijst naar
  die route, maar de bridge kan hem alleen bénoemen, niet lopen. `unlinkResourceFromLibrary` bestaat
  al als store-actie, is projectlokaal en undo-baar. Klein werk.
- Per-weekdag verschillende uurbanden overleven een IFC-round-trip niet.
- Wélke kalender de projectdefault is, kan de bridge niet wisselen.
- Bridge-robustheid: de bridge merkt niet dat zijn venster weg is; een tweede app-instantie is
  onzichtbaar voor de gebruiker.
- Crash-herstel reset de bibliotheek-UI-vlaggen niet expliciet.

## 9. De afgesproken volgorde hierna

Vastgelegd door de eigenaar, in deze volgorde:

1. **Headless MCP** — plannen zonder dat de app openstaat. Niet de bridge naar een draaiend venster,
   maar de planner zelf als server: IFC in, IFC uit.
2. **API** voor koppeling met bijvoorbeeld een ERP.
3. **Een uitgebreide skillset** die een AI leert *hoe* je plant — niet welke knop, maar wat goed
   plannen is.

Punt 2 en 3 mogen tegelijk; 1 gaat voor.

**Wat het goedkoper maakt dan het klinkt:** de 39 tools, de dispatcher, het protocol, de store en de
CPM-solver draaien vandaag al headless op Node — de hele `tests/mcp`-suite doet precies dat, gebundeld
met esbuild, zonder venster. Wat ontbreekt is de schil: een Node-ingang met stdio-transport, een
derde backend in `fileAccess/` (naast Tauri en web), en een besluit over wat er in de plaats komt van
"de gebruiker kijkt live mee" — want pauze, alleen-lezen, Ctrl+Z en het activiteitenpaneel gaan
allemaal uit van een venster.

**De post die de schatting kan laten ontsporen:** de store buiten React opstarten werkt in tests,
maar tests raken maar een deel van de slices. Zodra `fileSlice`, `documentSlice` en `settingsStore`
meekomen, komen `localStorage`, `window` en IndexedDB mee. Onbekend hoeveel. Eén spike die de hele
store op Node opstart en kijkt wat er omvalt, maakt de schatting hard.

Grove schatting: één werksessie tot een werkend skelet, twee à drie daarbovenop tot iets dat je een
vreemde in handen durft te geven.

## 10. Valkuilen voor de volgende sessie

- **De suites printen "alles groen" óók bij exit 1.** Vertrouw de **exitcode**. `grep '^XX'` werkt
  alleen voor `tests/planning/`; de bibliotheeksuite springt zijn faalregels in.
- **Elke nieuwe test mutatie-testen.** Een test die niet aantoonbaar rood wordt tegen ongefixte code
  bewaakt niets. Draai de mutatie, kijk of hij bijt, draai hem volledig terug.
- **Een worktree heeft geen `node_modules`** — symlink naar de repo-root, anders faalt elke
  `run.sh` op `$ROOT/node_modules/.bin/esbuild`.
- **`grep` gedroeg zich onbetrouwbaar op `resourceTools.ts`** (gaf leeg terug op patronen die er
  aantoonbaar in staan). `sed`, `python3` en `Read` werkten wel. Niet uitgezocht.
- **Push vaak.** De checkout waarin deze hele sessie gewerkt werd
  (`/home/nozzit/open-aec/OPS/open-planner-studio`) is halverwege verdwenen. Al het werk overleefde
  uitsluitend doordat er na elke stap naar `origin/main` gepusht was.
- **Releasen vraagt altijd expliciet akkoord.** Pushen naar main mag voor geverifieerd werk; een
  `v*`-tag is onomkeerbaar en levert automatisch uit aan alle gebruikers, inclusief de Snap Store.
