# Rapport-exportopties — balkkleuren, statuslijn, volg-weergave — ontwerpdoc

**Datum:** 2026-08-14, herzien 2026-08-24
**Issues:** #21 punt 1 (nieuwe ronde: balkkleuren bij het plotten) + #54 (statuslijn, volg-weergave)
**Status:** herzien ontwerp goedgekeurd; het bestaande implementatieplan moet vóór verdere bouw
worden bijgewerkt op basis van deze herziening

---

## 1. Context & doel

De Gantt-rapportexport is functioneel compleet (vector-PDF, paginering, preview), maar drie wensen
uit #21/#54 ontbreken:

1. **Balkkleuren op scherm én bij export** — naast kritiek-pad-kleuren moet de gebruiker taken
   automatisch per taak of per categorie kunnen kleuren. De categorievelden zijn exact de velden
   die al onder **Group** beschikbaar zijn: WBS, taaktype, activity codes, gebruikersvelden en
   resource.
2. **Statuslijn in export** — op het scherm bestaan de statusdatumlijn en voortgangslijn al; de
   printlaag kent alleen een "vandaag"-lijn.
3. **Volg weergave** — de export tekent de volledige takenboom; filter/groepering/sortering/
   inklapstatus van de schermweergave worden genegeerd.

Kernprincipe van het ontwerp: **de printlaag blijft dom**. ReportPanel levert rijen + opties, pure
modules rekenen kleuren/segmenten uit, `renderReport` tekent wat hij krijgt. Preview (canvas) én
PDF-export (vector) draaien op hetzelfde `Draw2D`-interface, dus één wijziging dekt beide.

## 2. Vastgelegde besluiten (uit de brainstorm met de user)

| # | Besluit |
|---|---------|
| B1 | Resource krijgt een **kleurveld** (`Resource.color?: string`, hex), automatisch toegekend bij aanmaak, door de gebruiker wijzigbaar in de resource-editor. |
| B2 | Scherm en rapport gebruiken **dezelfde ene globale balkkleurkeuze**. Een wijziging onder View werkt meteen door in Report en andersom. Resource-accent blijft daarnaast een onafhankelijke schermtoggle. |
| B3 | Statuslijn in het rapportpaneel als **letterlijke 3-opties-dropdown**: Geen / Statusdatumlijn / Voortgangslijn. |
| B4 | "Volg weergave" = **volledige WYSIWYG**: de export tekent exact de `viewRows` van het scherm (filter, groepering, sortering én inklapstatus). Print-tabel behoudt zijn eigen vaste kolommen. |
| B5 | Bij **Op categorie → Resource**: resourcekleur als vulling + rode rand om kritieke taken; een taak zonder resource valt terug op de neutrale kleur voor `(geen)`. |
| B6 | De zichtbare keuzes zijn **Kritiek pad**, **Per taak — automatisch** en **Op categorie**. De oude modus *Per taak — eigen kleur* en de op deze branch toegevoegde taakkleurkiezer verdwijnen. `Task.color` blijft alleen als inert legacyveld in het documentcontract bestaan en wordt door geen renderer gelezen. |
| B7 | Kleurtoewijzing: **nieuwe resources automatisch** (eerste vrije paletkleur) + **hash-fallback** voor kleurloze resources (deterministisch, muteert géén data — werkt direct voor elk bestaand project). |
| B8 | Taak met meerdere resources: **balk in segmenten** naar rato van `units` per resource. |
| B9 | Architectuur: printlaag accepteert **doorgegeven rijen** (benadering 1); géén eigen view-pijplijn, géén self-flatten wanneer rijen worden meegegeven. |
| B10 | **Op categorie** toont een tweede selector die rechtstreeks `groupFieldList`/`fieldOptions` hergebruikt; kleur- en groepeer-UI kunnen daardoor niet stil uit elkaar lopen. |
| B11 | De categorievelden zijn niet per project opgeslagen. De selectie is globaal. Ontbreekt een projectgebonden veld in het geopende project, dan gebruikt dat project tijdelijk **Taaktype**, toont de UI een melding en laat de opgeslagen globale keuze intact. |
| B12 | Een categoriewaarde krijgt overal dezelfde deterministische paletkleur. Een bestaande `ActivityCodeValue.color` of `Resource.color` wint van de paletfallback. Geen waarde = neutraal grijs. |
| B13 | Resource is een categorie binnen **Op categorie** en geen losse hoofdmodus meer. Meerdere resources blijven gewogen balksegmenten opleveren. |
| B14 | Samenvattingsbalken en groepsbanden behouden hun structurele stijl. Bladtaken en mijlpalen volgen de gekozen kleur; in `auto` en `category` houdt een kritieke taak een rode rand. |
| B15 | De rapportlegenda toont alleen categoriewaarden van zichtbare bladtaken, maximaal acht plus *“… en N meer”*, en verklaart daarnaast de rode kritieke rand. |

## 3. Datamodel & kleurenbron

**`Resource.color?: string`** (hex) — `src/types/resource.ts`.

- **IFC-round-trip** via het bestaande `OPS_`-Pset-patroon (`ifcPsets.ts`), net als `Task.color`
  (PSet `Color`). De kleur reist mee in project-IFC en pool-export/import.
- **Bewust níét** in `RESOURCE_DIFF_FIELDS` — kleur is presentatie, geen planningsdata; een andere
  kleur mag nooit een *"wijkt af"*-markering tussen bibliotheek en project triggeren. Vastgelegd in
  een library-test (kleur wijzigen → géén `deviated`).
- **Auto-toewijzing** bij aanmaak (bibliotheek én project): eerste paletkleur die nog niet in
  gebruik is.
- **Hash-fallback**: kleurloze resources krijgen weergavekleur `hash(resourceId) → palet[index]`.
  Deterministisch op elke machine, muteert niets, niets te migreren.
- **Kleurkiezer** in de bestaande gedeelde resource-editor.
- **`Task.color`** blijft voor achterwaartse compatibiliteit in het taakmodel en in oude bestanden
  staan, maar is geen kleurenbron meer. De branch-eigen taakkleurkiezer wordt verwijderd en zowel
  de klassieke als de nieuwe renderer negeren het veld.
- **`ActivityCodeValue.color`** bestaat al als kleur op categoriewaarden. In categoriekleuring wint
  die expliciete categoriekleur van de automatische paletkleur.

**Nieuw palet** `src/engine/renderer/resourcePalette.ts`: vaste reeks van 12 printvriendelijke
kleuren, dienend voor resourcekleuren én de automatische per-taak-regenboog. Printvriendelijk =
onderling onderscheidbaar, óók in grijswaarden (verschillende lichtheid), geen botsing met de
kritiek-roodtint.

## 4. Gedeelde balkkleurselectie en kleurengine

Scherm en rapport consumeren één discriminated union:

```ts
type BarColorSelection =
  | { mode: 'critical' }
  | { mode: 'auto' }
  | { mode: 'category'; field: FieldRef };
```

De selectie wordt app-globaal gepersisteerd. `category.field` gebruikt exact dezelfde `FieldRef`
als Group. De selector toont daarom zonder duplicatie:

- WBS en taaktype;
- ieder activity-code-type in het huidige project;
- ieder gebruikersveld in het huidige project, ongeacht het veldtype;
- resource.

Een gedeelde pure resolver zet `(field, task, projectcontext)` om naar een rauwe sleutel, zichtbaar
label en optionele expliciete kleur. De regels zijn:

| Selectie | Regel |
|---|---|
| `critical` | Huidige gedrag: rood (kritiek) / oranje (bijna-kritiek) / blauw. `Task.color` is geen fallback meer. |
| `auto` | `hash(taskId) → palet[index]`; stabiel bij herordenen. |
| categorie WBS/taaktype/gebruikersveld | `hash(field-identiteit + rauwe waarde) → palet[index]`. |
| categorie activity code | Expliciete kleur van de codewaarde, anders dezelfde deterministische hash-fallback. |
| categorie resource | `Resource.color` of resource-hash; meerdere toewijzingen worden segmenten naar rato van `unitsPerDay`. |
| ontbrekende categoriewaarde | Neutraal grijs met label `(geen)`. |

- Kritieke taken in `auto` en `category` krijgen een rode rand; hun vulling blijft de gekozen kleur.
- Een resourcebalk smaller dan circa 12 px valt terug op de eerste resourcekleur in plaats van
  onleesbare segmenten.
- Mijlpalen volgen dezelfde kleurbron; samenvattingen en groepsbanden volgen die bewust niet.
- De voltooiings-overlay komt over de categorie- of resourcevulling heen zoals nu.
- In een project waarin de opgeslagen projectgebonden `FieldRef` niet voorkomt, rekent en toont de
  UI tijdelijk met `{ src: 'builtin', key: 'taskType' }`. De opgeslagen selectie wordt niet
  gewijzigd; terugkeren naar een passend project herstelt de oorspronkelijke keuze.
- De rapportlegenda gebruikt dezelfde resolver en alleen zichtbare bladtaken. `critical` behoudt de
  bestaande legenda; `auto` verklaart alleen de rode rand; `category` toont maximaal acht unieke
  zichtbare waarden, gevolgd door *“… en N meer”* indien nodig, plus de rode-randverklaring.

## 5. Statuslijn

Nieuw `PrintOptions`-veld `statusLine: 'none' | 'statusDate' | 'progress'` (default `'none'`).

- `statusDate`: verticale stippellijn op `project.statusDate` in de statusdatum-kleur met label —
  zelfde patroon als de bestaande today-lijn (`setLineDash` bestaat al in `Draw2D`).
- `progress`: de voortgangslijn zoals `GanttRenderer.drawProgressLine` die tekent. Die logica wordt
  naar een gedeelde pure helper gehesen (posities per rij + verbindingspunten), zodat scherm en
  print dezelfde definitie delen.
- Geen `statusDate` gezet → beide lijnopties tekenen niets; het rapportpaneel toont een korte hint
  *"Stel eerst een statusdatum in"* onder de dropdown.

## 6. Volg weergave — rijen naar de printlaag

Nieuw optioneel veld `options.rows?: ViewRow[]` op `renderReport`:

- Checkbox **uit** (default): ReportPanel levert geen rijen → huidige gedrag (volledige boom).
- Checkbox **aan**: ReportPanel levert `viewRows` uit de store. Print tekent die rijen; taken onder
  een ingeklapte groep staan er niet in. WYSIWYG.
- Groepsband-rijen (`kind: 'group'`) krijgen een eigen band-weergave in de print (naam +
  samenvattingsbalk over de groep) — het enige nieuwe tekenpad.
- Relatielijnen: alleen tussen paren waarvan béide endpoints zichtbaar zijn (zelfde regel als
  scherm).
- Intern normaliseert `renderReport` beide invoervormen (boom vs. rijen) naar één rij-type.
- Print-tabel behoudt eigen vaste kolommen (WBS, naam, duur, datums, voltooiing) — kolominstellingen
  volgen niet (bewuste scope-afbakening).

## 7. UI & instellingen

- ReportPanel (Gantt-instellingenblok): dropdown **Statuslijn** (3), gedeelde bediening
  **Balkkleuren**, checkbox **Volg weergave**.
- De Balkkleuren-bediening heeft drie hoofdkeuzes. Alleen bij **Op categorie** verschijnt een tweede
  selector met de actuele `groupFieldList`.
- View en Report lezen en schrijven dezelfde globale `BarColorSelection`; ReportPanel houdt hiervoor
  geen onafhankelijke lokale/persistente kopie meer bij.
- Tolerante migratie wanneer de nieuwe instelling nog ontbreekt: `critical → critical`,
  `auto → auto`, `resource → category/resource`, `task → critical`. Als oude scherm- en
  rapportinstellingen verschillen, wint een niet-standaard schermkeuze; anders een niet-standaard
  rapportkeuze; anders `critical`. Na migratie is alleen de nieuwe instelling canoniek.
- Een ontbrekende categorie in het huidige project toont naast de tijdelijke Taaktype-terugval een
  korte uitleg; er is geen stille wijziging van de globale voorkeur.
- i18n: nieuwe sleutels in `report`-namespace; nl+en bron, 14 locales aanvullen (`verify:i18n` poort).
- Scherm-accent: toggle **"Resource-accent"** op de Beeld-tab (persisted via losse `ops-`-sleutel
  zoals `showProgressLine`). Aan = `GanttRenderer` tekent op elke taakbalk een dun streepje
  (±3 px onderrand) in de resourcekleur, gesegmenteerd bij meerdere resources. Deze toggle blijft
  onafhankelijk van de gekozen balkvulling, ook bij **Op categorie → Resource**.

## 8. Tests

- `tests/planning/check-bar-colors.ts`: palet- en hash-stabiliteit; WBS, taaktype, activity codes,
  alle gebruikersveldtypen en resource; expliciete categoriekleuren; `(geen)`; verwijderde velden;
  resourceverdeling, smalbalk-fallback, rode rand, mijlpalen en bewijs dat `Task.color` geen effect
  meer heeft.
- `tests/planning/check-print-report.ts`: `renderReport` tegen een recording-`Draw2D`-stub:
  rijen-volg-modus, statuslijn, iedere nieuwe kleurselectie en de zichtbare-categorielegenda.
- UI-/settingstest: één keuze stuurt View én Report; de tweede selector spiegelt `groupFieldList`;
  ontbrekend veld geeft tijdelijke Taaktype-terugval zonder overschrijven; alle vier oude modi
  migreren volgens §7.
- IFC-batterij uitbreiden: `Resource.color` round-trip; pool-export/import behoudt kleur.
- `tests/library/`: kleurwijziging triggert géén afwijkingsstatus.
- Renderertests houden resource-accent onafhankelijk van alle drie balkkleurkeuzes.
- Poort: typecheck, volledige planning-/tijdzonematrix, `npm run verify` en echte visuele QA in de
  dev-build: categorie kiezen onder View, dezelfde keuze onder Report terugzien en preview/export
  met het scherm vergelijken.

## 9. Buiten scope

Kleurmodi via MCP-tools, tabelkolommen volgen in export, handmatige kleuren per taak of per
categoriewaarde toevoegen, CJK/RTL-printzaken en baseline-gerelateerde kleuren.

## 10. Fasering

1. Gedeeld contract: `BarColorSelection`, globale instelling en tolerante migratie; oude
   ReportPanel-kopie verwijderen.
2. Categorie-resolver: `FieldRef` + projectcontext naar sleutel/label/kleur, inclusief terugval en
   volledige tests voor de velden uit Group.
3. Kleurlogica: `barColors.ts` ombouwen naar `critical | auto | category`; `Task.color` volledig uit
   alle renderpaden halen; resource-segmenten behouden.
4. Print/scherm: beide renderers en rapportlegenda op dezelfde selectie/resolver aansluiten.
5. UI: gedeelde drie-keuzebediening met conditionele Group-veldselector, migratiehint, i18n en de
   reeds gevraagde ribbonkolommen.
6. Docs, gerichte regressietests, visuele vergelijking en volledige verificatiepoort.
