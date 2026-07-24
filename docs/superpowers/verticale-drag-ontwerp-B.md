# Ontwerp B — Verticaal slepen van taken in de Gantt (issue #21 punt 1, optie 1)

> Onafhankelijk ontwerp door de ontwerper-rol. Ik heb géén ander ontwerpbestand voor dit onderwerp
> aangetroffen (`docs/superpowers/{specs,plans}/` en de losse design-docs bevatten niets over
> drag/reparent/issue-21); dit is dus een eigen, op code geverifieerd ontwerp. Alle file:line-verwijzingen
> hieronder heb ik zelf gelezen in de worktree `issue-21-verbeterpunten` op 2026-07-24.

## 0. Doel en harde eisen

Issue #21 punt 1, optie 1 (door de issuemaker gekozen): een taak **verticaal** verslepen naar elke plek
in de lijst, **óók onder een andere summary** (reparenting). Concreet:

- Tijdens het slepen een **visuele invoeg-indicator**; de echte mutatie pas bij **mouseup**.
- **Eén undo-stap** voor de hele beweging.
- **Datums veranderen niet** door verticaal slepen (de gesleepte taak blijft op dezelfde tijd).
- Werkt in de Gantt (de issuemaker spreekt over "taakbalken").

Niet in scope (expliciet): horizontaal slepen (bestaat al), afhankelijkheden tekenen (bestaat al),
touch/pen (de hele canvas-interactie-laag is muismodel), en IFC-round-trip (structuur-mutaties leven
al in `parentId`/`childIds` die gewoon mee-serialiseren).

## 1. Geverifieerde feiten (wat ik in de code vond)

Ik vertrouwde de briefing niet blind en heb de kern gelezen. Bevindingen, met correcties waar de
briefing onnauwkeurig was:

**Horizontale drag** — `src/components/canvas/hooks/useBarDrag.ts`:
- `DragState` (regel 14–23) kent alleen `edge: 'left'|'right'|'body'`, `startX` (clientX) en originele
  tijdvelden. Er wordt **geen clientY bijgehouden** — de hook is puur horizontaal.
- `startBarDrag` = `setDragState` (regel 214): de *caller* bouwt de state; de hook bezit alleen
  window-listeners + state.
- De hook muteert **live per mousemove** via `updateTask` met een coalesce-key
  `bardrag:<taskId>:<n>` (monotone teller `dragSeq`, regel 12/52) zodat alle commits samenvloeien tot
  één undo-stap. `handleMouseUp` (202) doet **alleen** `setDragState(null)` — geen extra commit.
- Conclusie voor ons ontwerp: verticale drag is **fundamenteel anders** — hij muteert één keer bij
  mouseup, dus heeft hij **géén coalescing nodig**; één `beginUndoable` = één undo-stap.

**Bestaande store-acties** — `src/state/slices/taskSlice.ts`:
- `moveTask(id, newParentId)` (300–339): cykel-check door de ouderketen omhoog te lopen (310–316);
  bij weigering **géén snapshot, géén mutatie** (schone state). Verwijdert uit oud-ouder `childIds`,
  zet `parentId`, en **`newParent.childIds.push(id)`** (regel 332) — dus **altijd achteraan**.
  **Hij raakt de rauwe `s.tasks`-array niet.** WBS auto-nummering; `finishMutation(s,{stale:true})`.
- `reorderSibling(taskId, dir)` (484–528): non-root = swap in `parent.childIds`; root = swap van twee
  **absolute array-slots** (508–520). `finishMutation(s)` **zonder stale** (pure volgorde).
- `addTask` met `position:{anchorId,where:'above'|'below'}` (117–212) is het **gouden
  referentiepatroon**: hij splicet tegelijk in de rauwe array (175–181) **én** in `parent.childIds`
  (187–196). **Dit is het enige bestaande voorbeeld dat beide bronnen synchroon houdt.** Onze actie
  moet dit precies zo doen.
- `indentTasks`/`outdentTasks` (341–418) gebruiken `flattenOrder(s.tasks)` als weergavevolgorde.

**Twee bronnen van waarheid — het cruciale subtiele punt** (briefing had gelijk, maar ik verhelder):
- `src/utils/wbs.ts:flattenOrder` (10–43): bouwt `childrenByParent` door de **ruwe array** te
  itereren (19–25). Kind-volgorde voor WBS/flatten = **raw-array-volgorde**. De docstring (7–8) zegt
  het expliciet: *"`childIds`-volgorde wordt door de renderers genegeerd en telt hier dus ook niet."*
- `src/engine/view/visibleRows.ts` (242): `const kids = task.childIds.map(id => byId.get(id))`.
  Kind-volgorde voor **display** (tabel + Gantt) = **`childIds`-volgorde**.
- **Root-volgorde** is in beide de rauwe array-volgorde (`visibleRows.ts:245` filtert `!t.parentId`
  in array-volgorde; `wbs.ts:35` itereert roots in array-volgorde). Consistent.
- **Conclusie:** elke verplaatsing moet **drie** dingen synchroon bijwerken: `parentId`,
  `parent.childIds` (display-volgorde voor non-root) **én** de raw-array-positie (WBS/flatten +
  root-volgorde). Doet alleen `addTask`-position; `moveTask` laat de raw-array links liggen en kan
  geen positie — dus **is er een echt gat** dat onze actie vult (geen duplicaat van `moveTask`).

**Rijen & hit-tests** — `src/engine/renderer/GanttRenderer.ts`:
- `ViewRow = {kind:'task',task,depth,dimmed} | {kind:'group',key,label,count,...}`
  (`visibleRows.ts:15–25`). Ingeklapte kinderen worden niet ge-emit; groepsrijen (bij filter/groep)
  zijn géén taken.
- `getRowAtY(canvasY)` (1378) → `this.rows[getRowIndex(y)]`; `getTaskAtY` (1383) → de taak als
  `row.kind==='task'`, anders null. `getRowIndex` (1389) =
  `floor((canvasY - headerHeight + scrollY)/rowHeight)`.
- `getTaskBarBounds(x,y)` (1436–1451): geeft null als `x < taskTableWidth` (buiten chart) **én**
  sluit summaries (`childIds.length>0`) en milestones uit. **Belangrijk:** de *horizontale* bar-drag
  start dus nooit op een summary of milestone. Voor *verticale* drag is het gebaar echter
  **rij-gebaseerd**, niet rand-gebaseerd — dus gebruiken we `getRowAtY`/`getTaskAtY` (die wél alle
  taakrijen teruggeven, incl. summaries), niet `getTaskBarBounds`.
- Rij-Y-formule (190): `rowTop = headerHeight + rowIndex*rowHeight - scrollY`. Onze indicator moet
  exact deze formule hergebruiken om op de pixel te kloppen met waar de rij getekend is.

**Boommodus-guard** — `visibleRows.ts:44` documenteert al: *"structuur-mutaties
(indent/outdent/**row-move**) zijn alleen dan zinvol."* `isTreeMode(view)` (47–53) is `true` enkel
als `filter===null && group.length===0 && sort.length===0`. Onze guard leunt hierop.

**Undo-API** — `src/state/transaction.ts`: `beginUndoable(s,{coalesceKey})` (70–88) duwt een snapshot
tenzij dezelfde key op dezelfde stackdiepte in hetzelfde doc doorgaat; `finishMutation(s,{stale})`
(96–99) zet `isDirty` (+ optioneel `scheduleStale`).

**Bestaande interactie-paden in `GanttCanvas.handleMouseDown`** (857–944) — de botsingskaart:
- `e.button!==0` → uit (alleen links).
- Splitter → tabelbreedte-sleep. `y<headerHeight` → uit.
- `getTaskBarBounds(x,y)` raakt → **shift** = dependency-tekenen (882); **ctrl/cmd** =
  multiselectie-gebaar (901, issue #21 pt3); **else** = `barDrag.startBarDrag` + single-select (907).
- Geen bar-raak: tabel → `boxSelect` (924); chart in drag-modus (zonder ctrl) → pan; else → box-select.
- `handleClick` (720) doet selectie/collapse/+knop/dubbelklik; `useBoxSelect` kent een
  kandidaat→promoot-patroon met `BOX_SELECT_THRESHOLD=4` (`constants.ts`) en een `justBoxSelectedRef`
  om de volgende click te onderdrukken.
- `Alt` is **nergens** op het canvas gebonden (geen `altKey`-gebruik in `src/components/canvas/`).
- Het **herbruikbare DOM-overlay-patroon** is de box-select-rechthoek (`GanttCanvas.tsx:1078–1105`):
  een absoluut-gepositioneerde `div` in container-coördinaten, `pointerEvents:none`, op `zIndex:5`.

**Redraw-mechanisme**: hoofd-render-effect (`GanttCanvas.tsx:504`) hangt af van `effectiveView`
(omvat `scrollX/scrollY/zoom`). `setScroll(...)` triggert dus hertekening + herbouw van de renderer,
zodat hit-tests altijd de actuele rijen zien. **Autoscroll via `setScroll` is dus haalbaar** (het
pan-patroon doet hetzelfde).

## 2. Beslissing 1 — Gebaar: hoe onderscheid je verticaal van horizontaal?

Dit is de kernkeuze. Drie kandidaten, serieus overwogen:

| Optie | Mechanisme | Misgreep-risico | Blast-radius | Platform |
|---|---|---|---|---|
| **A** Alt+sleep op balk/rij | modifier | geen | puur additief | ⚠ Alt+drag = venster verplaatsen op KDE |
| **B** As-lock op balk | Δx vs Δy bij eerste beweging | **hoog (diagonaal)** | raakt werkende tijd-drag | OK |
| **C** Rijsleep uit de linker takentabel | zone (tabel vs chart) | geen | verkleint box-select-startzone | OK |

**Mijn keuze: C als primair, A als sterke alternatieve. B wijs ik af.**

**Waarom C (rij-sleep uit de takentabel, modifier-vrij, kandidaat→promoot):**
1. **Nul misgreep.** Reorder leeft in de tabel (waar horizontaal geen betekenis heeft); tijd-sleep
   leeft op de chart-balk. Twee gescheiden zones ⇒ geen ambiguïteit. Dat is precies het
   asymmetrie-argument *tegen* B: op de balk betekent horizontal=tijd én vertical=reorder ⇒ een
   diagonale beweging is een muntje-worp. In de tabel bestaat die ambiguïteit niet.
2. **Modifier-vrij ⇒ geen platform-val.** Zie A's probleem hieronder.
3. **Komt overeen met het industriestandaard-mentale model.** In MS Project versleep je een taak om
   te herrangen door de **rij** (de taaknaam-cel links) te grijpen, niet de balk; de balk is voor
   tijd. Onze linker takentabel is precies die outline.
4. **Raakt de geprezen, fijn-getunde horizontale drag niet.** `useBarDrag` blijft letterlijk onaangepast.
5. **Hergebruikt het bewezen kandidaat→promoot-patroon** (`useBoxSelect`): mousedown op een taakrij
   in de tabel armt een *kandidaat*; beweging > drempel ⇒ promote tot rijsleep; mouseup onder drempel
   ⇒ gewone klik/selectie (bestaand gedrag behouden).

**Kosten van C (eerlijk):** de vrije mousedown in de tabel start nu *altijd* een box-select-kandidaat
(`GanttCanvas.tsx:924`). C vervangt "box-select starten op een taakrij" door "rijsleep op een
taakrij." Box-select blijft beschikbaar vanaf de chart-achtergrond én van lege tabelruimte (onder de
laatste rij / op bandkoppen) — en omdat box-select Y-band-gebaseerd en X-agnostisch is
(`useBoxSelect`-commentaar regel 69–71), selecteert "starten vanuit de chart" dezelfde rijen. De
enige gedragsverandering is dus: je kunt een rubberband niet meer *precies bovenop een taakcel in de
tabel* beginnen. Dat is een kleine, beperkte erodering van een recente feature ("fase 2.10 golf 4").
**Ik vond dit acceptabel; zie open besluit D1.**

**Risico van misgreep (expliciet gevraagd):** met C is het **nul** (zone-gescheiden). Met A eveneens
nul (modifier-gescheiden). Alleen B heeft een onoplosbaar diagonaal-misgreep-risico.

**Waarom A (Alt+sleep op balk/rij) als sterke alternatief:** A is *puur additief* — een nieuwe
`if (e.altKey)`-tak vóór het `getTaskBarBounds`-blok. Het raakt noch box-select noch tijd-drag, en is
letterlijk "de balk verticaal slepen" (trouw aan de issuemaker-woording). **Twee problemen:**
(i) **KDE** pakt standaard Alt+drag om het venster te verplaatsen (GNOME gebruikt Super; Tauri draait
   in het WM) ⇒ deassing op een belangrijk Linux-bureaublad. In de **browser-build** is dit géén
   probleem (browsers negeren Alt+drag).
(ii) Ontdekbareid: Alt is obscuur; mitigatie = afwijkende cursor bij Alt-hover + een hint.

**Waarom B (as-lock) afgewezen:** onoplosbaar diagonaal-misgreep-risico **én** grote blast-radius —
om as-lock te doen moet je het armen van de horizontale drag *uitstellen* tot na de drempel, maar
`useBarDrag` is gebouwd op live-mutatie vanaf pixel 1. Dat ombouwen riskeert regressie in een
werkende, gereviewde feature. Dat weegt zwaarder dan de winst aan "natuurlijkheid."

> **Open besluit D1 (product):** C (mijn voorstel: rijsleep uit de tabel, modifier-vrij) vs A (Alt+
> sleep op de balk, trouw aan de letter). Ik beveel C aan; A is gereed als de issuemaker letterlijk
> "de balk verslepen" wil en de KDE-caveat accepteert. **Dit is het belangrijkste te nemen besluit.**

## 3. Beslissing 2 — Droptarget-semantiek

De rij onder de cursor wordt in **drie verticale zones** opgedeeld (elk ±1/3 van `rowHeight`):

| Zone | Actie | Store-target |
|---|---|---|
| **bovenste 1/3** | invoegen **boven** deze rij (sibling ervan) | `{kind:'before', anchorId: rij.id}` |
| **onderste 1/3** | invoegen **onder** deze rij (sibling ervan) | `{kind:'before', anchorId: volgendeSibling ?? null}` (of rootEnd) |
| **midden 1/3** | **kind worden** van deze rij (achteraan kindlijst) | `{kind:'childOf', parentId: rij.id}` |

Indicator:
- above/below → een **horizontale accent-lijn** (2px) in de rij-spleet, over de volle tabel+chart-breedte.
- childOf → een **accent-kader** om de doelry + de doelrij krijgt een lichte tint ("wordt kind van …").

**Specifieke doelen:**
- **Summary-rij** (ingeklapt of uitgeklapt): alle drie zones geldig. midden = kind worden (achteraan
  `childIds`). Omdat een ingeklapte summary zijn kinderen verbergt, wordt het nieuwe kind pas zichtbaar
  bij uitklappen — de indicator moet dat signaleren ("kind van [summary], momenteel verborgen").
- **Milestone-rij**: above/below geldig; **midden uitgesloten** (een mijlpaal is een punt-in-tijd, geen
  ouder — zie D4).
- **Leaf-rij** (gewone taak zonder kinderen): midden = kind worden ⇒ de leaf promoot automatisch tot
  summary (`childIds` wordt niet-leeg). Structureel triviaal; zie D3.
- **Groepsrij** (`kind:'group'`): komt alleen voor buiten tree-modus — maar dan is de hele rijsleep
  uitgeschakeld (guard §5), dus irrelevant. Verdedigend: geen geldig doel.
- **Helemaal boven** (boven rij 0): `before(eersteZichtbareRij)` binnen diens ouder.
- **Onder alle rijen** (lege ruimte onder de lijst): `childOf(null)` = achteraan op **root**-niveau
  (zie D5 voor het alternatief "achteraan de ouder van de laatste rij").
- **Buiten de lijst / boven de header**: geen doel; indicator verdwijnt, mouseup = annuleren.
- **Op zichzelf of op een eigen nakomeling**: cykel ⇒ weigeren (zie §4); indicator toont "geen doel".

## 4. Beslissing 3 — De nieuwe store-actie `moveTaskTo`

Eén nieuwe actie in `taskSlice.ts`, die `moveTask` (reparent, géén positie) en `addTask`-position
(dual-sync) verenigt. Het is **geen** duplicaat van `moveTask`: die kan niet positioneren en houdt de
raw-array niet bij.

**Signatuur:**
```ts
moveTaskTo: (id: string,
  target:
    | { kind: 'before';  anchorId: string }          // invoegen vlak vóór anchorId (sibling ervan)
    | { kind: 'childOf'; parentId: string | null }   // achteraan als kind van parentId (null = root)
) => void;
```
`tussen`/`onder` worden door de hook omgezet naar `before` (op de volgende sibling) of `childOf`;
`rootEnd` = `childOf(null)`. Twee primitieven volstaan → minimale oppervlakte.

**Algoritme (binnen `set((s)=>{ … })`, spiegelend op `moveTask`+`addTask`):**
1. `task = s.tasks.find(id)`; onbekend ⇒ return (géén snapshot).
2. Bepaal `newParentId`: `before` ⇒ ouder van anchor; `childOf` ⇒ `target.parentId`.
3. **Cykel-check** (hergebruik `moveTask`:300-316): loop van `newParentId` omhoog; is hij `id` of een
   afstammeling van `id` ⇒ **return zonder snapshot/mutatie** (schone state). (Voor `before` volstaat
   dit: anchor is kind van newParentId, dus anchor ∈ subtree(newParentId); als newParentId geen
   afstammeling van id is, dan anchor ook niet.)
4. `oldParentId = task.parentId`. Bepaal de beoogde raw-array-slot én childIds-index; **no-op-guard**:
   als `newParentId===oldParentId` én de resulterende positie gelijk is aan de huidige ⇒ return
   (géén loze undo).
5. `beginUndoable(s)` — **zonder coalesceKey** (één mouseup = één aanroep = één undo).
6. Verwijder `id` uit `oldParent.childIds` (indien oldParent).
7. `task.parentId = newParentId`.
8. **childIds-synchronisatie** (display-volgorde non-root):
   - `before(anchor)` ⇒ voeg in op `indexOf(anchor)` in `newParent.childIds` (root ⇒ n.v.t.).
   - `childOf(P)` ⇒ `P.childIds.push(id)` (P=null ⇒ n.v.t.).
9. **Raw-array-synchronisatie** (WBS/flatten + root-volgorde) — *het stuk dat `moveTask` mist*:
   - verwijder `id` van zijn huidige array-slot;
   - `before(anchor)` ⇒ splice `id` in vlak vóór de (na verwijdering herlokaliseerde) anchor-slot;
   - `childOf(P)` ⇒ push `id` achteraan de raw array (correct voor `flattenOrder`: id wordt laatst-
     verzamelde kind van P; id's eigen subtree volgt via recursie ongeacht raw-positie).
   - *waarom dit klopt:* `flattenOrder` ordent kinderen op raw-array-volgorde, `visibleRows` op
     `childIds`; door beide te updaten blijven display én WBS gelijk — exact het `addTask`-bewijs.
10. **WBS**: `if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks)`. Auto uit ⇒ codes **ongemoeid
    laten** (zie D8: handmatige modus = gebruiker eigenaar; alleen de verplaatste taak had een code,
    die mag stale zijn tot handmatige hernummering — consistent met `addTask` dat ook alleen de níeuwe
    taak afleidt).
11. **`stale`-regel (fijn, bewust gekozen):** `finishMutation(s, { stale: newParentId !== oldParentId })`.
    - **Pure reorder** (zelfde ouder) ⇒ **géén stale** — datum-vrij, identiek aan `reorderSibling`.
    - **Reparent** (andere ouder) ⇒ **stale:true** — want summary-rollup-datem wijzigen
      (ouder verliest/wint een kind ⇒ vroege start/einde van summaries schuift). Dit **houdt de
      eis "datums veranderen niet" in stand voor de blad-taak zelf** (zijn `time.*` wordt niet
      aangeraakt), maar dwingt een F5-hercompute af zodat summaries kloppen. Zie open besluit D7.
12. `get().recomputeViewRows()`.

**Eén undo-stap:** gegarandeerd door één `beginUndoable`/`finishMutation`-paar; géén coalescing nodig.

## 5. Beslissing 4 — Drag-state & rendering

**Nieuwe hook `src/components/canvas/hooks/useRowDrag.ts`**, exact gespiegeld aan `useBoxSelect`
(drie fasen: kandidaat, gepromoot, mouseup/Escape). Bezit eigen window-listeners.

Interface:
```ts
useRowDrag({ canvasRef, rendererRef, moveTaskTo, justRowDraggedRef })
  -> { rowDragCandidate, rowDragState, startRowDrag, active }
```
- `startRowDrag({ taskId, startClientX, startClientY })` zet de kandidaat (geen indicator zolang
  onder drempel).
- Kandidaat-mousemove: beweging > drempel (`ROW_DRAG_THRESHOLD`, voorstel 4 px = `BOX_SELECT_THRESHOLD`)
  ⇒ promote tot `rowDragState` met `currentClientX/Y`.
- Gepromoot-mousemove: bereken doelry+zone uit `currentClientY` via `renderer.getRowAtY`; bewaar
  `{taskId, currentClientY, dropTarget}` in state voor de indicator.
- mouseup: `moveTaskTo(taskId, dropTarget)`; `justRowDraggedRef.current=true` (onderdruk volgende
  click, net als box-select); state weg.
- Escape (capture-fase, `stopImmediatePropagation`): annuleren zonder mutatie.

**Waarom de renderer en niet de store voor de hit-test:** `renderer.getRowAtY` reflecteert altijd de
actuele scroll/collapse-context (renderer wordt herbouwd bij elke `effectiveView`-wijziging). De
store-`viewRows` is prima voor logica, maar voor pixel→rij is de renderer de bron.

**Indicator (DOM-overlay, hergebruik box-select-patroon `GanttCanvas.tsx:1078-1105`):** een
`pointerEvents:none`-`div` in container-coördinaten op `zIndex:6`. Positie uit de rij-Y-formule
(`GanttRenderer.ts:190`: `rowTop = headerHeight + rowIndex*rowHeight - scrollY`):
- above/below-lijn op `rowTop` respectievelijk `rowTop+rowHeight`.
- childOf-kader op `[rowTop, rowTop+rowHeight]` met lichte tint.
- Optionele polish: de **bron-rij** (en bij blok-sleep de geselecteerde rijen) licht-dimensionerend
  markeren zodat de gebruiker ziet wat er verplaatst.

**Autoscroll bij randen:** een `requestAnimationFrame`-loop, alleen actief in de gepromote fase. Als
`currentClientY` binnen `AUTO_SCROLL_EDGE` (voorstel 40 px) van de canvas-boven/-onderkant valt:
`setScroll(scrollX, scrollY ± AUTO_SCROLL_SPEED·dt)`. Omdat `setScroll` het render-effect triggert
(§1), herbouwt de renderer en blijven de hit-tests kloppen. Snelheid mild (bv. 12 px/frame) om de
hertekening niet te overbelasten. **Onzekerheid:** hertekening per frame kan bij zeer grote lijsten
voelbaar zijn; meet dit in Fase 4 (zie §6).

## 6. Beslissing 5 — Guards & botsingen

1. **`isTreeMode(view)`-guard (hard):** buiten tree-modus (filter/groep/sortering actief) is de
   zichtbare volgorde niet de structuur ⇒ reorder is zinloos en zelfs gevaarlijk (verkeerde ouder).
   De hook armt niet; cursor blijft default; mousedown valt door naar selectie/box-select. Hiermee
   wordt `visibleRows.ts:44` (de reeds gedocumenteerde "row-move alleen in tree-modus"-regel) geëerbiedigd.
2. **Modifier-matrix in de tabel** (zie C, §2): plain-mousedown-op-taakrij ⇒ rijsleep-kandidaat;
   Shift/Ctrl-op-taakrij ⇒ bestaande multiselectie (`selectTask` met multi/range); plain-mousedown-op-
   niet-taakrij ⇒ box-select. Geen conflict met de bestaande ctrl/shift-paden.
3. **Multiselectie-interactie** (3 taken geselecteerd, je grijpt er één):
   - **v1: alleen de gegrepen taak verplaatsen.** Rationale: `reorderSibling` is ook één-taak;
     blok-verplaatsen heeft niet-triviale ordeningssemantiek (waar ankert het blok, hoe kruisen
     selecties?). Houdt v1 klein en één-undo.
   - De rest van de selectie blijft geselecteerd; de verplaatste taak blijft geselecteerd (id overleeft
     de verplaatsing).
   - **Open besluit D2:** later blok-sleep (hele selectie als aaneengesloten blok) toevoegen.
4. **Dialoog/contextmenu open:** armen niet (guard op `contextMenu`/`showTaskDialog`, net als
   `handleMouseMove:952`).
5. **Cykel**: afgedwongen in de actie (§4 stap 3); indicator toont "geen doel" bij hover op zichzelf
   of nakomelingen.

## 7. Faseringsvoorstel (elke fase apart bouwen + verifiëren)

**Fase 1 — Store-actie (puur logica, headless verifieerbaar).**
- Bestanden: `src/state/slices/taskSlice.ts` (actie), `src/state/slices/types.ts` (`TaskSlice`-type).
- Lever: `moveTaskTo` met cykel/no-op/dual-sync/WBS/stale-regel.
- Verifieer: headless via `window.__OPS__` of een esbuild-node-scriptje — muteren en asserten op
  `childIds`, raw-array-volgorde (`flattenOrder`), `deriveWbsCodes`, en `scheduleStale` per geval
  (reorder=false, reparent=true, cykel=reject). Geen UI nodig.

**Fase 2 — `useRowDrag`-hook (interactie-kern, grotendeels headless).**
- Bestanden: `src/components/canvas/hooks/useRowDrag.ts` (nieuw), `…/hooks/constants.ts` (drempels).
- Lever: kandidaat→promoot, doelry-berekening, Escape, autoscroll-rAF.
- Verifieer: gedrag via Playwright MCP tegen de browser-dev-build; assert op `rowDragState`-overgangen
  en de uiteindelijke `moveTaskTo`-aanroep (stub/mock in `window.__OPS__`).

**Fase 3 — Integratie + indicator (visueel).**
- Bestanden: `src/components/canvas/GanttCanvas.tsx` (`handleMouseDown`-matrix, isTreeMode-guard,
  DOM-overlay JSX), eventueel een klein `RowDragIndicator`-componentje.
- Lever: armen in de tabel, indicator-lijn/-kader, click-onderdrukking (`justRowDraggedRef`).
- Verifieer: self-test-harness (Playwright MCP + `window.__OPS__`) — reparent onder summary, reorder
  binnen zelfde ouder, cykel-weigering, ingeklapte summary, "onder alle rijen", isTreeMode-uit.

**Fase 4 — Polish (optioneel, na validatie).**
- Autoscroll-finetuning (perfmeting bij grote lijsten), auto-uitklappen van ingeklapte summary bij
  hover (file-manager-stijl, met timer), blok-sleep (D2), milestone-nesting-beslissing (D4).

## 8. Randgevallen — lijst + antwoord

| # | Geval | Antwoord |
|---|---|---|
| 1 | Sleep naar allereerste rij (boven rij 0) | `before(eersteZichtbareRij)` binnen diens ouder. |
| 2 | Sleep onder alle rijen (lege ruimte) | `childOf(null)` = achteraan root (D5). |
| 3 | Drop op ingeklapte summary (midden) | `childOf(summary)` — kind toegevoegd, verborgen tot uitklap; indicator signaleert "verborgen kind". |
| 4 | Groepsrij als doel | Komt alleen buiten tree-modus voor ⇒ drag uit (guard). |
| 5 | Milestone-rij, midden-zone | Uitgesloten (mijlpaal = geen ouder, D4); above/below wél. |
| 6 | Leaf-rij, midden-zone | Toegestaan → leaf promoot tot summary (D3). |
| 7 | Drop op zichzelf / eigen nakomeling | Cykel ⇒ weigeren, geen undo, indicator "geen doel". |
| 8 | 3 geselecteerd, 1 versleept | v1: alleen de gegrepen taak (D2). |
| 9 | Filter/groep/sortering actief | Drag volledig uit (isTreeMode-guard). |
| 10 | Dialoog of contextmenu open | Armen niet (guard). |
| 11 | Touch/pen | Buiten scope (muismodel, net als bestaande hooks). |
| 12 | Rand van viewport | Autoscroll (Fase 4; rAF + setScroll). |
| 13 | Gesleepte taak is geselecteerd | Blijft geselecteerd (id overleeft verplaatsing). |
| 14 | summary verplaatst | Hele subtree gaat mee (kinderen behouden `parentId`); stale:true (reparent). |
| 15 | WBS handmatig (auto uit) | Codes ongemoeid gelaten (D8); verplaatste taak mag stale code tonen tot handmatige hernummering. |

## 9. Open vragen / te nemen productbesluiten

- **D1 (kritiek):** Gebaar = C (rijsleep uit tabel, modifier-vrij — mijn voorstel) of A (Alt+sleep op
  balk, letterlijk "de balk")? Beïnvloedt alles. Aanbeveling: **C**.
- **D2:** Blok-sleep (hele selectie verplaatsen) in v1 of later? Aanbeveling: **later** (v1 = één taak).
- **D3:** Kind-worden van een *leaf* toestaan (auto-promotie tot summary)? Aanbeveling: **ja**
  (structureel triviaal, komt overeen met MSP).
- **D4:** Kind-worden van een *milestone* toestaan? Aanbeveling: **nee** (mijlpaal = punt-in-tijd).
- **D5:** "Onder alle rijen" = achteraan root, of achteraan de ouder van de laatste rij?
  Aanbeveling: **achteraan root** (eenvoudig, voorspelbaar).
- **D6:** Ingeklapte summary auto-uitklappen bij hover? Aanbeveling: **nee in v1** (leuk, later).
- **D7:** `stale`-interpretatie — de eis luidt "datums veranderen niet." Ik interpreer dat als
  *de blad-taak behoudt zijn eigen datums* (we raken `time.*` niet aan), en zet wél `stale:true` bij
  *reparent* zodat summary-rollups via F5 kloppen. **Bevestiging gevraagd:** is die interpretatie OK,
  of moet ook reparent géén stale zetten (en summaries achterlopend tonen tot F5)?
- **D8:** WBS bij auto-uit — code van verplaatste taak stale laten? Aanbeveling: **ja** (handmatige
  modus = gebruiker eigenaar).

## 10. Onzekerheden (eerlijk)

- **D1 is niet vrijblijvend** en ik heb geen objectieve doorslag gevonden — C is natuurlijker en
  platform-veiliger, A is additiever en letterlijker. Dit is echt een smaak/product-oordeel.
- **Autoscroll-perf:** `setScroll` triggert een volledige canvas-hertekening + renderer-herbouw per
  frame. Bij zeer lange lijsten (duizenden rijen) moet dat gemeten worden; mogelijk is er een goedkopere
  "alleen scrollY meenemen"-pad nodig. Voor v1 aanvaardbaar, maar flag.
- **Indicator-precisie:** ik vertrouw op de rij-Y-formule uit de renderer (`GanttRenderer.ts:190`).
  Als de renderer ooit een andere vertical-offfet gebruikt (bijv. bovenste padding) moet de indicator
  meebewegen — daarom expliciet *dezelfde formule hergebruiken*, niet herleiden.
- **`moveTaskTo` raw-array-slot bij `childOf`:** "achteraan pushen" klopt voor `flattenOrder`, maar
  maakt de raw-array rommeliger na veel reparents (id staat ver van zijn ouder). Functioneel correct,
  esthetisch lelijk; geen functioneel risico. Eventueel later: invoegen ná de laatste nakomeling van P.
- **KDE/Alt:** ik heb het WM-gedrag niet live getest; het is een bekende KDE-default maar
  gebruikersafhankelijk. Ondersteunt mijn voorkeur voor modifier-vrije C.

---

## Samenvatting (5 regels)

1. **Eén nieuwe store-actie `moveTaskTo(id,{before|childOf})`** die — anders dan `moveTask` —
   positioneert én de **drie** waarheidsbronnen synchroon houdt (`parentId`, `childIds`, raw-array),
   mét cykel-check, no-op-guard, WBS, en een `stale`-regel die alleen bij *reparent* aangaat.
2. **Eén nieuwe hook `useRowDrag`** (kandidaat→promoot, gespiegeld aan `useBoxSelect`); mutatie pas bij
   mouseup ⇒ één undo-stap zonder coalescing; autoscroll via `setScroll`.
3. **Gebaar = rijsleep uit de linker takentabel** (C, modifier-vrij, nul misgreep, raakt tijd-drag
   niet) — met Alt+sleep-op-de-balk (A) als letterlijk alternatief; **D1 is het te nemen besluit**.
4. **Droptarget = drie zones per rij** (boven/onder = sibling-invoeg; midden = kind-worden),
   conform de renderer-rij-Y-formule; indicator is een hergebruikte DOM-overlay.
5. **Hard `isTreeMode`-guard**, één-taak-sleep in v1 (blok-sleep = D2-later), en 8 expliciete
   productbesluiten (D1–D8) waarvan D1/D7 de belangrijkste zijn.

## Mijn 3 spannendste beslissingen (met motivering)

1. **Gebaar = C (tabel-rijsleep) en niet B (as-lock op de balk).** As-lock is de "natuurlijke"
   keuze, maar heeft een *onoplosbaar* diagonaal-misgreep-risico (de issuemaker vroeg er expliciet om)
   én vereist het ombouwen van de werkende, fijn-getunde `useBarDrag`. Tabel-rijsleep is
   zone-gescheiden (nul misgreep), modifier-vrij (geen KDE-Alt-val), en komt overeen met het MSP-
   mentale model (herrangen via de outline, niet de balk). Ik betaal daarvoor één kleine erodering
   (box-select kan niet meer exact op een taakcel starten) — een acceptabele ruil.
2. **`stale` alleen bij reparent, niet bij pure reorder — en wél bij reparent ondanks "datums
   veranderen niet."** Dit is een bewuste asymmetrie die twee bestaande acties verenigt:
   `reorderSibling` (géén stale) en `moveTask` (wel stale). De eis "datums veranderen niet" geldt voor
   de *blad-taak* (we raken `time.*` niet aan), maar reparent verandert summary-rollups, dus zonder
   `stale:true` tonen summaries verkeerd tot F5. Dit behoeft expliciete bevestiging (D7) — ik wil niet
   stilletjes aannemen dat de issuemaker dit bedoelde.
3. **Eén actie met `before`/`childOf`-primitieven die de raw-array én `childIds` dubbel-sync houden,
   als generalisatie van `moveTask`+`addTask`.** Het verleidelijke zou zijn `moveTask` uit te breiden,
   maar dat riskeert de bestaande caller (`TaskDialog.handleSave`) en de "altijd achteraan"-semantiek.
   Een nieuwe, expliciet-gepositioneerde actie houdt `moveTask` stable, hergebruikt het *bewezen*
   `addTask`-position dual-sync-bewijs, en maakt cykel/no-op/stake tot cleamp; het enige nadeel is dat
   `moveTask` en `moveTaskTo` elkaar deels overlappen — acceptabel, want ze dienen verschillende
   callers (dialoog vs. drag).
