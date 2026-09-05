// Commandoregister (K-item 34) — headless tegen de ECHTE Zustand-store.
//
// WAAROM DEZE BATTERIJ. Elf acties stonden twee keer los gedefinieerd: als React-hook in
// `ribbonConfig.tsx` en als imperatieve `run(store)` in `shortcutRegistry.ts`, zonder gedeeld id en
// zonder iets dat ze bij elkaar hield. Ze wáren al uit elkaar gelopen — de zoomstap verschilde
// (apart gerepareerd) en `toggleHistogram` stond letterlijk twee keer uitgeschreven. Nu is er één
// definitie, en die is puur genoeg om hier volledig te toetsen.
//
// Drie delen:
//  1. GEDRAG — elk commando tegen de echte store: doet `run` wat het moet doen, en klopt
//     `isEnabled` in beide richtingen (aan én uit)? UITZONDERING: `save`, `saveAs` en `open` doen
//     bestands-I/O en worden hier alleen op hun DOORGIFTE getoetst (deel 5c), niet op hun effect —
//     een echte dialoog openen kan headless niet. Dat gat stond eerder niet opgeschreven terwijl
//     de kop "elk commando" beweerde.
//  2. HET CONTRACT dat het `indent`-geval mogelijk maakt: `run` mag niet stil niets doen wanneer
//     `isEnabled` false is. Het lint grijst de knop uit, maar de sneltoets vuurt wél en moet dan
//     uitleggen waarom er niets gebeurt (issue #26).
//  3. BRON — geen van de twee registers definieert deze acties nog zelf. Zonder die check kan
//     iemand er morgen weer een tweede definitie naast zetten en is de consolidatie stil ongedaan.
//
// Draait via run.sh. Exit 0 = alles groen.
// MOET de eerste import blijven: `@/i18n/config` raakt `document` bij het laden, en imports worden
// gehoist — losse statements hierboven zouden te laat draaien. Zie domStub.ts.
import './domStub';
import { createAppStoreContext, useAppStore } from '@/state/appStore';
import { COMMANDS, isCommandEnabled, type Command } from '@/state/commands';
import { ZOOM_STEP } from '@/utils/ganttViewport';
import { SHORTCUTS } from '@/hooks/keyboard/shortcutRegistry';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const run = (cmd: Command) => cmd.run(S());
const enabled = (cmd: Command) => isCommandEnabled(cmd, S());

// ── 0) Elk commando dat een `isEnabled` heeft, moet in BEIDE richtingen waarneembaar zijn. ──
// Deze bewaker staat vooraan omdat hij de checks hieronder pas betekenis geeft: een `isEnabled`
// die in deze fixture altijd hetzelfde teruggeeft, toetst niets.
const enabledSeen = new Map<string, Set<boolean>>();
const observe = (cmd: Command) => {
  if (!cmd.isEnabled) return;
  const set = enabledSeen.get(cmd.id) ?? new Set<boolean>();
  set.add(enabled(cmd));
  enabledSeen.set(cmd.id, set);
};

// ── 1) undo / redo ───────────────────────────────────────────────────────────
S().newProject();
observe(COMMANDS.undo);
eq('01 undo: uitgeschakeld op een verse store (lege undo-stack)', enabled(COMMANDS.undo), false);
eq('02 redo: uitgeschakeld op een verse store', enabled(COMMANDS.redo), false);

observe(COMMANDS.redo);
const idA = S().addTask({ name: 'Fundering' });
observe(COMMANDS.undo);
eq('03 undo: ingeschakeld zodra er iets te herroepen valt', enabled(COMMANDS.undo), true);
run(COMMANDS.undo);
eq('04 undo: de taak is weg', S().tasks.some(t => t.id === idA), false);
observe(COMMANDS.redo);
eq('05 redo: ingeschakeld na een undo', enabled(COMMANDS.redo), true);
run(COMMANDS.redo);
eq('06 redo: de taak is terug', S().tasks.some(t => t.id === idA), true);

// ── 2) delete ────────────────────────────────────────────────────────────────
S().deselectAll();
observe(COMMANDS.delete);
eq('07 delete: uitgeschakeld zonder selectie', enabled(COMMANDS.delete), false);
S().selectTask(idA);
observe(COMMANDS.delete);
eq('08 delete: ingeschakeld met selectie', enabled(COMMANDS.delete), true);
const undoBefore = S().historyEvents.filter(event => event.state === 'applied').length;
const idB = S().addTask({ name: 'Ruwbouw' });
S().selectTasks([idA, idB], false);
run(COMMANDS.delete);
eq('09 delete: beide geselecteerde taken zijn weg', S().tasks.filter(t => t.id === idA || t.id === idB).length, 0);
eq('10 delete: één handeling = één undo-stap (niet N)', S().historyEvents.filter(event => event.state === 'applied').length, undoBefore + 2); // addTask + delete
run(COMMANDS.undo);
eq('11 delete: één undo brengt ze allebei terug', S().tasks.filter(t => t.id === idA || t.id === idB).length, 2);

// TODO.md: deleteTasksBulk met ≥2 ids die stuk voor stuk al niet (meer) bestaan mag geen dode
// undo-stap achterlaten — het 1-id-pad (deleteTask) ontweek dat al bewust, het ≥2-pad moet dat nu
// ook doen.
{
  const undoDepthBefore = historyDepthsForActiveScope(S()).undoDepth;
  S().deleteTasksBulk(['onbekend-1', 'onbekend-2']);
  eq('11e deleteTasksBulk met louter onbekende ids: geen dode undo-stap',
    historyDepthsForActiveScope(S()).undoDepth, undoDepthBefore);
}

// Het commandocontract krijgt de doelstore expliciet mee. Een eerdere implementatie gebruikte
// desondanks de app-gebonden bulkadapter, waardoor `COMMANDS.delete.run(storeB)` stil store A
// muteerde. Hetzelfde taak-id aan beide kanten maakt zowel het gemiste doel als de nevenschade
// zichtbaar; alleen controleren dat B niet veranderde zou de singletonmutatie missen.
{
  const contextB = createAppStoreContext();
  const sharedId = contextB.store.getState().addTask({ name: 'Alleen in context B' });

  S().newProject();
  const appId = S().addTask({ name: 'Alleen in appcontext A' });
  useAppStore.setState((s) => {
    const appTask = s.tasks.find((task) => task.id === appId);
    if (appTask) appTask.id = sharedId;
  });

  contextB.store.getState().selectTask(sharedId);
  const appUndoBefore = historyDepthsForActiveScope(S()).undoDepth;
  const contextBUndoBefore = historyDepthsForActiveScope(contextB.store.getState()).undoDepth;
  COMMANDS.delete.run(contextB.store.getState());

  eq('11a delete gebruikt de meegegeven context',
    contextB.store.getState().tasks.some((task) => task.id === sharedId), false);
  eq('11b delete schrijft precies één undo-stap in de meegegeven context',
    historyDepthsForActiveScope(contextB.store.getState()).undoDepth, contextBUndoBefore + 1);
  eq('11c delete laat de appcontext ongemoeid',
    S().tasks.map((task) => task.id), [sharedId]);
  eq('11d delete laat ook de undo van de appcontext ongemoeid',
    historyDepthsForActiveScope(S()).undoDepth, appUndoBefore);
}

// ── 3) indent / outdent — het contract dat afwijkt van het rapportvoorstel ───
// In boommodus: gewoon inspringen.
S().newProject();
S().setGroup([]);
const idParent = S().addTask({ name: 'Ouder' });
const idChild = S().addTask({ name: 'Kind' });
S().selectTasks([idChild], false);
observe(COMMANDS.indent);
eq('12 indent: ingeschakeld in boommodus met selectie', enabled(COMMANDS.indent), true);
run(COMMANDS.indent);
eq('13 indent: de taak hangt nu onder zijn voorganger', S().tasks.find(t => t.id === idChild)?.parentId, idParent);
observe(COMMANDS.outdent);
run(COMMANDS.outdent);
eq('14 outdent: de taak staat weer op het hoogste niveau', S().tasks.find(t => t.id === idChild)?.parentId, null);

// Zonder selectie: uitgeschakeld.
S().deselectAll();
observe(COMMANDS.indent);
eq('15 indent: uitgeschakeld zonder selectie', enabled(COMMANDS.indent), false);

// BUITEN boommodus is `isEnabled` false, maar `run` mag NIET stil niets doen — dat is precies het
// geval waarvoor `run` en `isEnabled` los van elkaar staan. Het lint grijst de knop uit; de
// sneltoets vuurt en moet uitleggen waarom er niets gebeurt (issue #26).
S().selectTasks([idChild], false);
S().setGroup([{ field: { src: 'builtin', key: 'taskType' }, dir: 'asc' }]);
observe(COMMANDS.indent);
observe(COMMANDS.outdent);
eq('16 indent: uitgeschakeld buiten boommodus (het lint grijst de knop uit)', enabled(COMMANDS.indent), false);
const parentBefore = S().tasks.find(t => t.id === idChild)?.parentId ?? null;
const noticeBefore = S().ui.structureLockedNotice;
run(COMMANDS.indent);
eq('17 indent buiten boommodus: de structuur blijft ongewijzigd',
  S().tasks.find(t => t.id === idChild)?.parentId ?? null, parentBefore);
eq('18 indent buiten boommodus: de melding-teller loopt op (geen stille no-op)',
  S().ui.structureLockedNotice, noticeBefore + 1);
run(COMMANDS.outdent);
eq('19 outdent buiten boommodus: ook een melding, geen stilte',
  S().ui.structureLockedNotice, noticeBefore + 2);
S().setGroup([]);

// ── 4) zoom — de asymmetrie die deze consolidatie blootlegde ────────────────
const zoomBegin = S().view.zoom;
run(COMMANDS.zoomIn);
eq('20 zoomIn: precies één stap omhoog', S().view.zoom, zoomBegin + ZOOM_STEP);
run(COMMANDS.zoomOut);
eq('21 zoomOut: precies terug op het startpunt', S().view.zoom, zoomBegin);

// ── 5) toggleHistogram — was letterlijk twee keer uitgeschreven ─────────────
const histoBegin = S().ui.showHistogram;
localStorage.removeItem('ops-showHistogram');
run(COMMANDS.toggleHistogram);
eq('22 toggleHistogram: schakelt om', S().ui.showHistogram, !histoBegin);
// De PERSISTENTIE hoort bij het commando, niet bij de knop. Stond die alleen in het lint, dan
// onthield Ctrl+Shift+H de stand niet — en dat verschil zag je pas na een herstart.
eq('23 toggleHistogram: de stand wordt weggeschreven',
  localStorage.getItem('ops-showHistogram'), JSON.stringify(!histoBegin));
run(COMMANDS.toggleHistogram);
eq('24 toggleHistogram: en weer terug', S().ui.showHistogram, histoBegin);
eq('25 toggleHistogram: ook de teruggezette stand wordt weggeschreven',
  localStorage.getItem('ops-showHistogram'), JSON.stringify(histoBegin));

// ── 5b) `useCommandBinding` — de lintkant van het contract. ─────────────────
// Dit is het bestand dat de hele redenering draagt ("één imperatieve `isEnabled` levert beide
// gezichten"), en het had nul dekking: hem tot een no-op maken liet de suite groen. Het is een
// dunne functie rond `useAppStore.getState()`, dus de twee eigenschappen die ertoe doen zijn
// headless na te bootsen — een echte hook-render kan hier niet, maar de vertaalregel wel.
{
  const binding = (cmd: Command) => ({
    onClick: () => cmd.run(useAppStore.getState()),
    disabled: !isCommandEnabled(cmd, S()),
  });
  S().newProject();
  eq('26a binding: undo is uitgeschakeld op een lege undo-stack', binding(COMMANDS.undo).disabled, true);
  const tmp = S().addTask({ name: 'Tijdelijk' });
  eq('26b binding: undo is ingeschakeld zodra er iets te herroepen valt', binding(COMMANDS.undo).disabled, false);
  eq('26c binding: een commando zonder isEnabled is nooit uitgeschakeld', binding(COMMANDS.save).disabled, false);
  // En de klik voert het commando daadwerkelijk uit, op de VERSE store.
  binding(COMMANDS.undo).onClick();
  eq('26d binding: onClick voert run uit', S().tasks.some(t => t.id === tmp), false);
}

// ── 5c) save / saveAs / open — geen gedrag, wel doorgifte. ─────────────────
// Deze drie openen een bestandsdialoog; headless valt er niets aan te observeren. Wat wél te
// toetsen is: dat het commando de bijbehorende store-actie aanroept en niet een andere. Een
// leeggehaalde `run` valt hier om.
{
  const geroepen: string[] = [];
  const nep = {
    ...S(),
    saveFile: async () => { geroepen.push('saveFile'); },
    saveFileAs: async () => { geroepen.push('saveFileAs'); },
    openFile: async () => { geroepen.push('openFile'); },
  } as unknown as Parameters<Command['run']>[0];
  COMMANDS.save.run(nep);
  COMMANDS.saveAs.run(nep);
  COMMANDS.open.run(nep);
  eq('26e save/saveAs/open roepen elk hun eigen store-actie aan', geroepen, ['saveFile', 'saveFileAs', 'openFile']);
}

// ── 6) De bewaker op deel 0: elke isEnabled is in beide standen gezien. ─────
for (const cmd of Object.values(COMMANDS) as Command[]) {
  if (!cmd.isEnabled) continue;
  checks++;
  const seen = enabledSeen.get(cmd.id);
  if (!seen || seen.size < 2) {
    diffs.push(`26 ${cmd.id}: isEnabled is in deze fixture nooit ${seen?.has(true) ? 'false' : 'true'} geweest — die check is dan vacuüm`);
  }
}

// ── 7) Bron: elk commando wordt op BEIDE oppervlakken via het register aangeroepen. ────────
//
// Een eerdere versie deed hier `ribbon.includes('COMMANDS.' + id)`. Dat bewaakte niets: een
// review liet undo en redo in het lint volledig kruisbedraden (beide namen staan er dan nog),
// verving een `run` door `() => {}` met de naam alleen nog in commentaar, en de suite bleef groen.
// Nu wordt commentaar gestript en per id de BINDINGSVORM geteld — `useCommandBinding(COMMANDS.x)`
// in het lint, `run: COMMANDS.x.run` in de sneltoetsen — zodat de naam alleen meetelt op de plek
// waar hij het commando ook echt uitvoert.
{
  const { readFileSync, existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { join, dirname } = await import('node:path');
  let root = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(root, 'package.json')) && dirname(root) !== root) root = dirname(root);
  const ribbonPath = join(root, 'src/components/layout/Ribbon/ribbonConfig.tsx');
  const shortcutPath = join(root, 'src/hooks/keyboard/shortcutRegistry.ts');

  checks++;
  if (!existsSync(ribbonPath) || !existsSync(shortcutPath)) {
    diffs.push('27 bron-assert overgeslagen: registers niet gevonden vanaf de bundelplek');
  } else {
    const strip = (src: string): string => {
      let out = ''; let mode: 'code' | 'line' | 'block' | '"' | "'" | '`' = 'code';
      for (let i = 0; i < src.length; i++) {
        const c = src[i], n = src[i + 1];
        if (mode === 'code') {
          if (c === '/' && n === '/') { mode = 'line'; i++; continue; }
          if (c === '/' && n === '*') { mode = 'block'; i++; continue; }
          if (c === '"' || c === "'" || c === '`') mode = c;
          out += c;
        } else if (mode === 'line') { if (c === '\n') { mode = 'code'; out += c; } }
        else if (mode === 'block') { if (c === '*' && n === '/') { mode = 'code'; i++; } }
        else { if (c === '\\') { out += c + (n ?? ''); i++; continue; } if (c === mode) mode = 'code'; out += c; }
      }
      return out;
    };
    const ribbon = strip(readFileSync(ribbonPath, 'utf8'));
    const shortcuts = strip(readFileSync(shortcutPath, 'utf8'));
    const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;

    // Bewaker op de stripper zelf: hij moet iets weghalen én de code laten staan.
    eq('27a de stripper haalt commentaar weg', ribbon.includes('K-item 34'), false);
    eq('27b de stripper laat code staan', ribbon.includes('useCommandBinding'), true);

    for (const id of Object.keys(COMMANDS)) {
      const inRibbon = count(ribbon, new RegExp(`useCommandBinding\\(COMMANDS\\.${id}\\b`, 'g'));
      const inShortcuts = count(shortcuts, new RegExp(`COMMANDS\\.${id}\\.run\\b`, 'g'));
      checks++;
      if (inRibbon < 1) diffs.push(`28.${id} het lint bindt deze knop niet via useCommandBinding(COMMANDS.${id})`);
      checks++;
      if (inShortcuts < 1) diffs.push(`29.${id} geen enkele sneltoets voert COMMANDS.${id}.run uit`);
    }

    // Elke lintknop die een commando bindt, moet dat via de gedeelde binding doen: evenveel
    // `useCommandBinding(`-aanroepen als `COMMANDS.`-verwijzingen in code (geen losse verwijzing
    // die ergens anders heen gaat).
    eq('30 het lint gebruikt COMMANDS uitsluitend via useCommandBinding',
      count(ribbon, /COMMANDS\./g), count(ribbon, /useCommandBinding\(COMMANDS\./g));
    // Idem voor de sneltoetsen: elke COMMANDS-verwijzing is een `.run`-binding.
    eq('31 de sneltoetsen gebruiken COMMANDS uitsluitend als .run-binding',
      count(shortcuts, /COMMANDS\./g), count(shortcuts, /COMMANDS\.[a-zA-Z]+\.run\b/g));

    // En de weggehaalde implementaties mogen niet terugkomen.
    const verdwenen: [string, string, string][] = [
      ['lint', 'onClick: () => undo()', ribbon],
      ['lint', 'onClick: () => redo()', ribbon],
      ['lint', 'deleteTasksBulk(', ribbon],
      ['lint', 'indentTasks(', ribbon],
      ['lint', 'outdentTasks(', ribbon],
      ['lint', 'saveShowHistogram(', ribbon],
      ['sneltoets', 'store.indentTasks(', shortcuts],
      ['sneltoets', 'store.outdentTasks(', shortcuts],
      ['sneltoets', 'deleteTasksBulk(store', shortcuts],
      ['sneltoets', 'saveShowHistogram(', shortcuts],
      ['sneltoets', 'store.setZoom(store.view.zoom', shortcuts],
    ];
    for (const [waar, fragment, bron] of verdwenen) {
      eq(`32 ${waar}: geen eigen implementatie meer van "${fragment}"`, bron.includes(fragment), false);
    }
  }
}

// ── 33. Taakgridtoetsen zijn zichtbaar in het Sneltoetsen-venster ──────────────────────────
//
// Eindreview-bevinding: Tab/Shift+Tab, Enter/F2, direct typen, Insert en Delete (celinhoud wissen)
// stonden nergens in `SHORTCUTS` — het venster dat rechtstreeks uit dit register rendert (zie
// ShortcutsDialog.tsx) toonde ze dus niet, ondanks de claim dat de lijst "nooit achterloopt".
// Deze check bewaakt de BRON (het register), niet de gerenderde DOM.
{
  const grid = SHORTCUTS.filter(entry => entry.category === 'grid');
  const byId = new Map(grid.map(entry => [entry.id, entry] as const));

  checks++;
  if (!grid.every(entry => entry.displayOnly === true)) {
    diffs.push('33a alle grid-entries zijn displayOnly (de gridcontainer handelt ze zelf af, niet de globale matcher)');
  }

  const expectTab = (id: string, shift: boolean) => {
    checks++;
    const entry = byId.get(id);
    if (!entry || entry.combo.key !== 'Tab' || Boolean(entry.combo.shift) !== shift) {
      diffs.push(`33b ${id} ontbreekt of heeft de verkeerde combo`);
    }
  };
  expectTab('grid.navigateNext', false);
  expectTab('grid.navigatePrevious', true);

  const expectKey = (id: string, key: string) => {
    checks++;
    const entry = byId.get(id);
    if (!entry || entry.combo.key !== key) diffs.push(`33c ${id} ontbreekt of heeft de verkeerde combo`);
  };
  expectKey('grid.editEnter', 'Enter');
  expectKey('grid.editF2', 'F2');
  expectKey('grid.typeToReplace', 'A–Z, 0–9, …');
  expectKey('grid.insertAbove', 'Insert');
  expectKey('grid.clearCell', 'Delete');

  eq('33d Tab en Shift+Tab delen dezelfde labelKey (één rij in de dialoog)',
    byId.get('grid.navigateNext')?.labelKey, byId.get('grid.navigatePrevious')?.labelKey);
  eq('33e Enter en F2 delen dezelfde labelKey (één rij in de dialoog)',
    byId.get('grid.editEnter')?.labelKey, byId.get('grid.editF2')?.labelKey);
  eq('33f de grid-Insert hergebruikt dezelfde labelKey als de globale structure.insertAbove',
    byId.get('grid.insertAbove')?.labelKey,
    SHORTCUTS.find(entry => entry.id === 'structure.insertAbove')?.labelKey);

  checks++;
  if (byId.get('grid.clearCell')?.labelKey === byId.get('grid.insertAbove')?.labelKey) {
    diffs.push('33g grid.clearCell (celinhoud wissen) moet een ander label hebben dan "Invoegen boven"');
  }
}

// ── 34. De grid volgt de globale Insert-richting (boven, niet onder) ──────────────────────
//
// Eindreview-bevinding: `FullTaskGrid.tsx` deed Insert altijd 'below', terwijl de globale
// sneltoets (`structure.insertAbove`, Insert zonder modifier) 'above' doet. Beide moeten dezelfde
// richting gebruiken — anders doet dezelfde fysieke toets iets anders binnen versus buiten een
// gefocuste taakcel.
{
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { join, dirname } = await import('node:path');
  let root = dirname(fileURLToPath(import.meta.url));
  const { existsSync } = await import('node:fs');
  while (!existsSync(join(root, 'package.json')) && dirname(root) !== root) root = dirname(root);
  const fullGrid = readFileSync(join(root, 'src/components/task-grid/FullTaskGrid.tsx'), 'utf8');
  const insertBlock = /if \(command\.kind === 'insert-task'\) \{([\s\S]*?)\n    \}/.exec(fullGrid)?.[1] ?? '';
  eq('34 de grid voegt via Insert boven de actieve taak in, net als structure.insertAbove',
    /insertTaskRelativeToScope\(\[row\.task\.id\],\s*'above'/.test(insertBlock), true);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  commands: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  commands: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
