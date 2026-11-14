// Knownbug 1026: een kalender die bij het openen `LiteralTimes` had, blijft letterlijk bij opslaan (besluit Trias, wrakko
// 10 november 2026, optie a; `DocumentPayload.ifcLiteralCalendarIds`). Headless tegen de echte store en de echte
// open-route. Bewaakt:
//   1. `fixtures/1026-voor.ifc` (het bestand van de sessie IFCX): wis '1. Preparation' (met haar vijf kinderen) en sla op.
//      `LiteralTimes` blijft staan, en de eindtijden (ScheduleFinish, EarlyFinish, LateFinish) van alle 51 taken die
//      blijven zijn gelijk aan het bestand vóór het wissen, dus 16:00 en niet 07:00. Zonder het veld (zoals main)
//      gaan ze naar 07:00: zo is te zien dat de check de bug vangt;
//   2. over sessies heen: het opgeslagen bestand opnieuw openen geeft dezelfde letterlijke kalender, ook na nog een keer
//      opslaan en openen (dan is opslaan byte-gelijk);
//   4. een extensie die het project ongewijzigd terugzet (`loadExtensionProject`, lees-wijzig-laad) houdt de keuze;
//   5. IFC Toepassen met een tekst zonder `LiteralTimes` maakt de keuze niet kleiner, ook niet na undo en redo (review
//      #872 ronde 1, Sol en Terra; de keuze wordt nooit kleiner);
//   6. letterlijk opgeslagen in deze sessie blijft letterlijk (Opslaan, undo, AutoSave), en letterlijk geworden maar
//      nooit zo opgeslagen telt niet (besluit Trias, wrakko 10 november 2026);
//   7. een IFC-export over het eigen bestand legt de keuze ook vast, een export naar een ander bestand niet (review #872
//      ronde 3, Terra);
//   3. zonder bewerking verandert het veld niets: voor elk voorbeeld in `public/examples/` en `examples/` is opslaan met
//      en zonder het veld byte-gelijk, en een voorbeeld zonder `LiteralTimes` krijgt geen veld.
// Exit 0 = alles groen.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
installBrowserStubs();
const reseed = installDeterminism();
console.error = () => {};
console.warn = () => {};

const { createAppStoreContext } = await import('@/state/appStoreFactory');
const { writeIFC } = await import('@/services/ifc/ifcWriter');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const { serializeForSave } = await import('@/state/savedLiteralCalendars');
const { readIFC } = await import('@/services/ifc/ifcReader');
const { loadExtensionProject } = await import('@/extensions/retainActiveDocument');
const { toExtProject, toExtCalendar, toExtTask, toExtSequence, toExtResource, toExtAssignment } = await import('@/extensions/extMappers');
type Store = ReturnType<typeof createAppStoreContext>['store'];

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
};

async function open(name: string, content: string): Promise<Store> {
  reseed(0x1026);
  const store = createAppStoreContext().store;
  await store.getState().openOpenedFile({ name, content, ref: { kind: 'path', path: `/tmp/ops-1026/${name}` } });
  return store;
}
const save = (store: Store) => writeIFC(buildWriteIFCInput(store.getState(), 'planOnly'));
/** Zoals main: zonder het nieuwe veld. */
const saveWithoutField = (store: Store) => writeIFC(buildWriteIFCInput({ ...store.getState(), ifcLiteralCalendarIds: null }, 'planOnly'));

/** Naam van de taak → [ScheduleFinish, EarlyFinish, LateFinish] uit de `IFCTASKTIME`-regels. */
function finishes(ifc: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const m of ifc.matchAll(/IFCTASKTIME\('((?:[^']|'')*) Time',([^\n]*)\);/g)) {
    const slots = m[2].split(',');
    // Na de naam: 1 DataOrigin, 2 UserDefined, 3 DurationType, 4 ScheduleDuration, 5 ScheduleStart, 6 ScheduleFinish,
    // 7 EarlyStart, 8 EarlyFinish, 9 LateStart, 10 LateFinish.
    out.set(m[1], [slots[5], slots[7], slots[9]]);
  }
  return out;
}

// ── 1 en 2. 1026-voor.ifc: wissen, opslaan, heropenen ──────────────────────────────────────────────────────────────
{
  const voor = readFileSync(join(ROOT, 'tests/planning/fixtures/1026-voor.ifc'), 'utf8');
  const store = await open('1026-voor.ifc', voor);
  const S = () => store.getState();
  eq('1026: de projectkalender had LiteralTimes', S().ifcLiteralCalendarIds, ['cal-default']);
  eq('1026: zonder bewerking maakt het veld niets uit', save(store) === saveWithoutField(store), true);
  const prep = S().tasks.find(t => t.name === '1. Preparation')!;
  eq('1026: voorwaarde, 57 taken en een fase met vijf kinderen', [S().tasks.length, prep.childIds.length], [57, 5]);
  S().deleteTask(prep.id);
  eq('1026: na het wissen 51 taken', S().tasks.length, 51);
  const na = save(store);
  eq('1026: LiteralTimes blijft staan', na.includes("IFCPROPERTYSINGLEVALUE('LiteralTimes',$,IFCBOOLEAN(.T.),$)"), true);
  const before = finishes(voor);
  const after = finishes(na);
  const names = S().tasks.map(t => t.name);
  eq('1026: elke taak die blijft, staat in het bestand', names.filter(n => !after.has(n)), []);
  const changed = names.filter(n => JSON.stringify(after.get(n)) !== JSON.stringify(before.get(n)));
  eq('1026: de eindtijden van de 51 taken die blijven, zijn gelijk aan vóór het wissen', changed, []);
  const at16 = names.filter(n => after.get(n)?.[0]?.endsWith("T16:00:00'"));
  eq('1026: alle 51 ScheduleFinish staan op 16:00', at16.length, 51);
  // Zonder het veld (main): de kalender wordt een ankerkalender en de eindtijden springen naar 07:00.
  const mainLike = finishes(saveWithoutField(store));
  eq('1026, controle zoals main: ScheduleFinish van "2. Earthworks & foundations" wordt 07:00',
    mainLike.get('2. Earthworks & foundations')?.[0], "'2027-03-05T07:00:00'");
  // 2. Over sessies heen: het bestand draagt LiteralTimes weer, dus heropenen houdt de kalender letterlijk.
  const reopened = await open('1026-na.ifc', na);
  eq('1026, heropend: de kalender is weer letterlijk', reopened.getState().ifcLiteralCalendarIds, ['cal-default']);
  const second = save(reopened);
  eq('1026, heropend en opgeslagen: LiteralTimes staat er nog', second.includes("IFCPROPERTYSINGLEVALUE('LiteralTimes',$,IFCBOOLEAN(.T.),$)"), true);
  // Het eerste heropenen rekent de planning opnieuw (na het wissen was ze niet herberekend; zo ook op main). Vanaf
  // daar is opslaan en heropenen stabiel.
  const third = await open('1026-na-2.ifc', second);
  eq('1026, tweede keer heropend: de kalender is letterlijk en opslaan is byte-gelijk',
    [third.getState().ifcLiteralCalendarIds, save(third) === second], [['cal-default'], true]);
}

// ── 4 en 5. De keuze gaat niet verloren onderweg ──────────────────────────────────────────────────────────────────
const LITERAL = "IFCPROPERTYSINGLEVALUE('LiteralTimes',$,IFCBOOLEAN(.T.),$)";
const earthworksFinish = (store: Store) => finishes(save(store)).get('2. Earthworks & foundations')?.[0];
const deletePrep = (store: Store) => store.getState().deleteTask(store.getState().tasks.find(t => t.name === '1. Preparation')!.id);
{
  // 4. Extensie: lees-wijzig-laad van hetzelfde project, zonder wijziging. Het publieke contract draagt de keuze niet.
  const voor = readFileSync(join(ROOT, 'tests/planning/fixtures/1026-voor.ifc'), 'utf8');
  const store = await open('1026-ext.ifc', voor);
  const S = () => store.getState();
  deletePrep(store);
  const s = S();
  loadExtensionProject(store, {
    project: toExtProject(s.project), calendar: toExtCalendar(s.calendar), tasks: s.tasks.map(x => toExtTask(x)),
    sequences: s.sequences.map(toExtSequence), resources: s.resources.map(toExtResource), assignments: s.assignments.map(toExtAssignment),
  });
  eq('4 extensie: de keuze blijft na een ongewijzigde lees-wijzig-laad', S().ifcLiteralCalendarIds, ['cal-default']);
  eq('4 extensie: "2. Earthworks & foundations" blijft op 16:00', earthworksFinish(store), "'2027-03-05T16:00:00'");
}
{
  // 5. IFC Toepassen met een tekst zonder LiteralTimes: de keuze wordt niet kleiner (besluit Trias: wat eenmaal letterlijk
  //    in het bestand stond, blijft letterlijk), ook niet na undo en redo.
  const voor = readFileSync(join(ROOT, 'tests/planning/fixtures/1026-voor.ifc'), 'utf8');
  const store = await open('1026-apply.ifc', voor);
  const S = () => store.getState();
  const text = save(store);
  eq('5 voorwaarde: de opgeslagen tekst draagt LiteralTimes', text.includes(LITERAL), true);
  const edited = readIFC(text.split(LITERAL).join("IFCPROPERTYSINGLEVALUE('LiteralTimes',$,IFCBOOLEAN(.F.),$)"));
  eq('5 voorwaarde: de bewerkte tekst heeft geen letterlijke kalender', edited.ifcLiteralCalendarIds, undefined);
  S().applyProjectEdit(edited);
  eq('5 Toepassen: de keuze blijft', S().ifcLiteralCalendarIds, ['cal-default']);
  S().undo();
  eq('5 undo: de keuze blijft', S().ifcLiteralCalendarIds, ['cal-default']);
  S().redo();
  eq('5 redo: de keuze blijft', S().ifcLiteralCalendarIds, ['cal-default']);
  S().undo();
  deletePrep(store);
  eq('5 undo, dan wissen: "2. Earthworks & foundations" blijft op 16:00', earthworksFinish(store), "'2027-03-05T16:00:00'");
}

// ── 6. Letterlijk opgeslagen in deze sessie ───────────────────────────────────────────────────────────────────────────
// Besluit Trias (wrakko, 10 november 2026): staat een kalender eenmaal letterlijk in het bestand, dan blijft hij
// letterlijk, ook als de app hem pas in deze sessie letterlijk opsloeg. Een kalender die letterlijk werd maar nooit zo is
// opgeslagen, telt niet. Via de echte opslagroute (Opslaan naar een handle) en de AutoSave-vastlegging.
{
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  /** Een bestand achter een handle, zoals de File System Access API het geeft. */
  /** Haken voor 7c: na het sluiten van een schrijfbeurt, en vóór `isSameEntry` (de handle zelf bevriest in de store). */
  const hooks: { afterClose?: () => void; beforeSameEntry?: () => Promise<void> } = {};
  const fakeHandle = (name: string, initial: string) => {
    let data = initial;
    const handle = {
      kind: 'file' as const, name,
      isSameEntry: async (other: unknown) => { await hooks.beforeSameEntry?.(); return other === handle; },
      getFile: async () => new File([enc.encode(data) as BlobPart], name),
      createWritable: async () => {
        let buffer = '';
        return {
          write: async (chunk: unknown) => { buffer += typeof chunk === 'string' ? chunk : dec.decode(chunk as Uint8Array); },
          close: async () => { data = buffer; hooks.afterClose?.(); },
        };
      },
      queryPermission: async () => 'granted' as const,
      requestPermission: async () => 'granted' as const,
    };
    return { handle: handle as unknown as FileSystemFileHandle, text: () => data };
  };
  const showcase = readFileSync(join(ROOT, 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), 'utf8');
  const openOwn = async () => {
    reseed(0x1026);
    const file = fakeHandle('eigen.ifc', showcase);
    const store = createAppStoreContext().store;
    await store.getState().openOpenedFile({ name: 'eigen.ifc', content: showcase, ref: { kind: 'handle', handle: file.handle } });
    return { store, file, S: () => store.getState() };
  };
  /** Een urentaak van vier uur: die maakt de projectkalender letterlijk (T17). */
  const addHourTask = (store: Store) => {
    const id = store.getState().addTask({ name: 'Uurtaak', time: { ...store.getState().tasks[0].time, durationUnit: 'hours', durationMinutes: 240 } });
    store.getState().runCPM();
    return id;
  };
  const sameFinishes = (label: string, before: string, after: string, skip: string) => {
    const a = finishes(before);
    const b = finishes(after);
    const names = [...b.keys()].filter(n => n !== skip);
    eq(`${label}: elke taak staat in beide bestanden`, names.filter(n => !a.has(n)), []);
    eq(`${label}: de eindtijden blijven gelijk`, names.filter(n => JSON.stringify(a.get(n)) !== JSON.stringify(b.get(n))), []);
  };
  {
    // 6a. De test van Trias: open zonder LiteralTimes, maak een taak die het nodig heeft, sla op, wis die taak, sla
    //     opnieuw op: alle eindtijden blijven gelijk.
    const { store, file, S } = await openOwn();
    eq('6a voorwaarde: het bestand heeft geen LiteralTimes, het document geen keuze', [showcase.includes("'LiteralTimes'"), S().ifcLiteralCalendarIds], [false, null]);
    const id = addHourTask(store);
    await S().saveFile();
    const first = file.text();
    eq('6a eerste opslag: LiteralTimes staat in het bestand', first.includes(LITERAL), true);
    eq('6a eerste opslag: de keuze bevat de projectkalender', S().ifcLiteralCalendarIds, [S().calendar.id]);
    S().deleteTask(id);
    S().runCPM();
    await S().saveFile();
    const second = file.text();
    eq('6a tweede opslag: LiteralTimes staat er nog', second.includes(LITERAL), true);
    sameFinishes('6a tweede opslag na het wissen', first, second, 'Uurtaak');
    // Zonder de keuze (zoals main) zou de kalender een ankerkalender worden: zo is te zien dat de check de bug vangt.
    eq('6a controle zoals main: zonder de keuze geen LiteralTimes', saveWithoutField(store).includes(LITERAL), false);
  }
  {
    // 6b. Undo maakt de keuze niet kleiner: opslaan, de nieuwe taak ongedaan maken, opnieuw opslaan.
    const { store, file, S } = await openOwn();
    addHourTask(store);
    await S().saveFile();
    const first = file.text();
    S().undo();
    S().runCPM();
    eq('6b undo: de urentaak is weg', S().tasks.some(t => t.name === 'Uurtaak'), false);
    eq('6b undo: de keuze blijft', S().ifcLiteralCalendarIds, [S().calendar.id]);
    await S().saveFile();
    const second = file.text();
    eq('6b na undo opgeslagen: LiteralTimes staat er nog', second.includes(LITERAL), true);
    sameFinishes('6b na undo opgeslagen', first, second, 'Uurtaak');
  }
  {
    // 6c. AutoSave naar het bestand legt de keuze ook vast (`serializeForSave` + `markAutoSaveVersionSaved`).
    const { store, S } = await openOwn();
    const id = addHourTask(store);
    const source = S().getOpenDocumentPayloads().find(d => d.id === S().activeDocumentId)!.payload;
    const written = serializeForSave(source);
    S().markAutoSaveVersionSaved(S().activeDocumentId, source);
    eq('6c AutoSave: LiteralTimes in de geschreven tekst, de keuze vastgelegd', [written.includes(LITERAL), S().ifcLiteralCalendarIds], [true, [S().calendar.id]]);
    S().deleteTask(id);
    S().runCPM();
    sameFinishes('6c na AutoSave en wissen', written, save(store), 'Uurtaak');
  }
  {
    // 6d. Letterlijk geworden, maar nooit zo opgeslagen: telt niet. Het bestand had de kalender nooit letterlijk.
    const { store, file, S } = await openOwn();
    const id = addHourTask(store);
    S().deleteTask(id);
    S().runCPM();
    await S().saveFile();
    eq('6d nooit letterlijk opgeslagen: geen LiteralTimes en geen keuze', [file.text().includes(LITERAL), S().ifcLiteralCalendarIds], [false, null]);
  }
  {
    // 6e. Een crashherstel-kopie of een export is geen opslag naar het eigen bestand: die legt niets vast.
    const { store, S } = await openOwn();
    addHourTask(store);
    save(store);
    eq('6e een losse schrijfbeurt legt niets vast', S().ifcLiteralCalendarIds, null);
  }
  // 7. Review #872 ronde 3 (Terra, BLOKKEERT): een IFC-export over het eigen bestand schrijft dat bestand ook. Die legt
  //    de keuze vast, zoals Opslaan; een export naar een ander bestand niet. Via de echte exportroutes (Exporteren en
  //    Project met bibliotheek exporteren), met de bestandskiezer van de browser.
  const win = (globalThis as unknown as { window: Record<string, unknown> }).window;
  win.showOpenFilePicker = () => { throw new Error('niet in deze test'); }; // de app ziet de File System Access API
  for (const route of ['exportAs', 'exportProjectWithPool'] as const) {
    const run = (S: () => ReturnType<Store['getState']>) => (route === 'exportAs' ? S().exportAs('ifc') : S().exportProjectWithPool());
    {
      // 7a. Over het eigen bestand: daarna wissen en opslaan, en alle eindtijden blijven gelijk.
      const { store, file, S } = await openOwn();
      const id = addHourTask(store);
      win.showSaveFilePicker = async () => file.handle;
      const result = await run(S);
      eq(`7a ${route} over het eigen bestand: geslaagd`, [result.ok, 'cancelled' in result && result.cancelled === true], [true, false]);
      const exported = file.text();
      eq(`7a ${route} over het eigen bestand: LiteralTimes staat erin, de keuze bevat de projectkalender`, [exported.includes(LITERAL), S().ifcLiteralCalendarIds], [true, [S().calendar.id]]);
      S().deleteTask(id);
      S().runCPM();
      await S().saveFile();
      eq(`7a ${route}: na wissen en opslaan staat LiteralTimes er nog`, file.text().includes(LITERAL), true);
      sameFinishes(`7a ${route}`, exported, file.text(), 'Uurtaak');
    }
    {
      // 7b. Naar een ander bestand: de keuze van het open document blijft leeg.
      const { store, file, S } = await openOwn();
      addHourTask(store);
      const other = fakeHandle('ander.ifc', '');
      win.showSaveFilePicker = async () => other.handle;
      await run(S);
      eq(`7b ${route} naar een ander bestand: LiteralTimes daar, geen keuze, eigen bestand ongewijzigd`,
        [other.text().includes(LITERAL), S().ifcLiteralCalendarIds, file.text() === showcase], [true, null, true]);
    }
    {
      // 7c. Review #872 ronde 4 (Terra, BLOKKEERT, vermoed): export en AutoSave kruisen elkaar. De export heeft het eigen
      //     bestand geschreven en kijkt nog of het het eigen bestand is (`isSameEntry`); in die opening wist de planner de
      //     urentaak en draait AutoSave. AutoSave mag dan niet de ankertekst schrijven en het document als opgeslagen
      //     markeren: daarna kwam er geen schrijfbeurt meer, en het bestand hield de verschoven eindtijden.
      const { store, file, S } = await openOwn();
      const id = addHourTask(store);
      S().setAutoSaveToFile(true);
      let written = false;
      let gated = false;
      let release!: () => void;
      const gate = new Promise<void>(r => { release = r; });
      let reached!: () => void;
      const inGap = new Promise<void>(r => { reached = r; });
      hooks.afterClose = () => { written = true; };
      hooks.beforeSameEntry = async () => {
        if (written && !gated) { gated = true; reached(); await gate; }
      };
      win.showSaveFilePicker = async () => file.handle;
      const exporting = run(S);
      await inGap;
      const exported = file.text();
      S().deleteTask(id);
      S().runCPM();
      const { createFileAutoSaveController } = await import('@/services/actualAutosave/fileAutoSave');
      const auto = createFileAutoSaveController({ getState: S, enabled: () => true }).flush();
      await new Promise(r => setTimeout(r, 50));
      release();
      await exporting;
      await auto;
      delete hooks.afterClose;
      delete hooks.beforeSameEntry;
      eq(`7c ${route} en AutoSave kruisen: de export schreef LiteralTimes`, exported.includes(LITERAL), true);
      eq(`7c ${route} en AutoSave kruisen: daarna staat LiteralTimes er nog, of het document blijft gewijzigd`,
        file.text().includes(LITERAL) || S().isDirty, true);
      await S().saveFile();
      eq(`7c ${route} en AutoSave kruisen: na opslaan staat LiteralTimes er nog`, file.text().includes(LITERAL), true);
      sameFinishes(`7c ${route} en AutoSave kruisen`, exported, file.text(), 'Uurtaak');
    }
    {
      // 7d. Review #872 ronde 5 (Terra): de export maakt zijn tekst vóór hij op de schrijflock wacht. Een opslag houdt de
      //     lock vast en het document verandert intussen: de export schrijft dan niets (geen oude inhoud over een nieuwere
      //     opslag), meldt dat, en het document blijft gewijzigd.
      const { runProjectFileWrite } = await import('@/services/fileAccess/writeCoordinator');
      const { store, file, S } = await openOwn();
      addHourTask(store);
      let release!: () => void;
      const hold = runProjectFileWrite(() => new Promise<void>(r => { release = r; }));
      win.showSaveFilePicker = async () => file.handle;
      const exporting = run(S);
      await new Promise(r => setTimeout(r, 20));
      const before = file.text();
      S().addTask({ name: 'Tussendoor' });
      release();
      await hold;
      const result = await exporting;
      eq(`7d ${route}: het document veranderde terwijl de export wachtte: niets geschreven, geannuleerd, gemeld, gewijzigd`,
        [file.text() === before, 'cancelled' in result && result.cancelled === true,
          S().ui.notifications.some(n => n.messageKey === 'notifications.ifcExportChangedWhileWaiting'), S().isDirty],
        [true, true, true, true]);
      // 7e. Wachten zonder wijziging: de export schrijft na de lock, en legt de keuze vast.
      let release2!: () => void;
      const hold2 = runProjectFileWrite(() => new Promise<void>(r => { release2 = r; }));
      const exporting2 = run(S);
      await new Promise(r => setTimeout(r, 20));
      eq(`7e ${route}: tijdens het wachten nog niets geschreven`, file.text() === before, true);
      release2();
      await hold2;
      const result2 = await exporting2;
      eq(`7e ${route}: na het wachten geschreven, met LiteralTimes en de keuze`,
        [result2.ok && !('cancelled' in result2 && result2.cancelled === true), file.text().includes(LITERAL), file.text().includes('Tussendoor'), S().ifcLiteralCalendarIds],
        [true, true, true, [S().calendar.id]]);
    }
    {
      // 7f. Review #872 ronde 5 (Sol): de opslag die de lock vasthoudt, legt tijdens het wachten de letterlijke keuze vast
      //     (zoals een opslag met een urentaak doet). De export maakte zijn tekst daarvoor, zonder `LiteralTimes`: hij mag
      //     die ankertekst nu niet meer over het eigen bestand schrijven.
      const { runProjectFileWrite } = await import('@/services/fileAccess/writeCoordinator');
      const { store, file, S } = await openOwn();
      S().addTask({ name: 'Gewone taak' });
      let release!: () => void;
      const hold = runProjectFileWrite(() => new Promise<void>(r => { release = r; }));
      win.showSaveFilePicker = async () => file.handle;
      const exporting = run(S);
      await new Promise(r => setTimeout(r, 20));
      const before = file.text();
      store.setState(s => { s.ifcLiteralCalendarIds = [s.calendar.id]; });
      release();
      await hold;
      const result = await exporting;
      eq(`7f ${route}: de keuze werd vastgelegd terwijl de export wachtte: niets geschreven, geannuleerd`,
        [file.text() === before, 'cancelled' in result && result.cancelled === true], [true, true]);
    }
    {
      // 7g. Review #872 ronde 6 (Terra): zonder bestandskiezer (Firefox, Safari) gaat de export als download, zonder doel.
      //     Verandert het document terwijl de export op de lock wacht, dan geen download van de oude inhoud. Zonder
      //     wijziging wel.
      const { runProjectFileWrite } = await import('@/services/fileAccess/writeCoordinator');
      const g = globalThis as unknown as Record<string, unknown>;
      const saved = { document: g.document, picker: win.showSaveFilePicker, open: win.showOpenFilePicker };
      let downloads = 0;
      g.document = { createElement: () => ({ href: '', download: '', click() { downloads++; } }) };
      const url = URL as unknown as Record<string, unknown>;
      const savedUrl = { create: url.createObjectURL, revoke: url.revokeObjectURL };
      url.createObjectURL = () => 'blob:test';
      url.revokeObjectURL = () => { /* niets */ };
      delete win.showSaveFilePicker;
      delete win.showOpenFilePicker;
      try {
        for (const change of [true, false]) {
          const { S } = await openOwn();
          S().addTask({ name: 'Gewone taak' });
          let release!: () => void;
          const hold = runProjectFileWrite(() => new Promise<void>(r => { release = r; }));
          downloads = 0;
          const exporting = run(S);
          await new Promise(r => setTimeout(r, 20));
          if (change) S().addTask({ name: 'Tussendoor' });
          release();
          await hold;
          const result = await exporting;
          eq(`7g ${route}, download ${change ? 'na een wijziging tijdens het wachten: geen download, geannuleerd' : 'zonder wijziging: gedownload'}`,
            [downloads, 'cancelled' in result && result.cancelled === true], change ? [0, true] : [1, false]);
        }
      } finally {
        g.document = saved.document;
        url.createObjectURL = savedUrl.create;
        url.revokeObjectURL = savedUrl.revoke;
        win.showSaveFilePicker = saved.picker;
        win.showOpenFilePicker = saved.open;
      }
    }
    {
      // 7i. Review #872 ronde 7 (Terra): de bestandskiezer wacht, het document verandert, en daarna weigert de omgeving de
      //     kiezer (`SecurityError`, zoals zonder gebruikersactivatie). De terugval naar een download mag de oude inhoud dan
      //     niet downloaden. Zonder wijziging wel. `SecurityError` en niet `NotAllowedError`: die laatste onthoudt de
      //     web-route voor de rest van de sessie, en dan liepen de volgende stappen niet meer langs de kiezer.
      const g = globalThis as unknown as Record<string, unknown>;
      const saved = { document: g.document, picker: win.showSaveFilePicker };
      let downloads = 0;
      g.document = { createElement: () => ({ href: '', download: '', click() { downloads++; } }) };
      const url = URL as unknown as Record<string, unknown>;
      const savedUrl = { create: url.createObjectURL, revoke: url.revokeObjectURL };
      url.createObjectURL = () => 'blob:test';
      url.revokeObjectURL = () => { /* niets */ };
      try {
        for (const change of [true, false]) {
          const { S } = await openOwn();
          S().addTask({ name: 'Gewone taak' });
          let refuse!: () => void;
          win.showSaveFilePicker = () => new Promise((_, reject) => {
            refuse = () => reject(new DOMException('geen activatie', 'SecurityError'));
          });
          downloads = 0;
          const exporting = run(S);
          await new Promise(r => setTimeout(r, 20));
          if (change) S().addTask({ name: 'Tussendoor' });
          refuse();
          const result = await exporting;
          eq(`7i ${route}, kiezer geweigerd ${change ? 'na een wijziging: geen download, geannuleerd, gemeld' : 'zonder wijziging: gedownload'}`,
            [downloads, 'cancelled' in result && result.cancelled === true,
              S().ui.notifications.some(n => n.messageKey === 'notifications.ifcExportChangedWhileWaiting')],
            change ? [0, true, true] : [1, false, false]);
        }
      } finally {
        g.document = saved.document;
        url.createObjectURL = savedUrl.create;
        url.revokeObjectURL = savedUrl.revoke;
        win.showSaveFilePicker = saved.picker;
      }
    }
  }
  {
    // 7h. Review #872 ronde 6 (Terra): project met bibliotheek over het eigen bestand, met een kalender die voor het eerst
    //     letterlijk wordt. De eerste write legt de keuze vast; de bibliotheek (een ander bestand) moet daarna gewoon
    //     geschreven worden.
    const { store, file, S } = await openOwn();
    addHourTask(store);
    store.setState(s => { s.project.companyId = 'bedrijf-1'; });
    store.setState({ exportPoolIFC: () => 'ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n' });
    const pool = fakeHandle('bibliotheek.ifc', '');
    const picks = [file.handle, pool.handle];
    win.showSaveFilePicker = async () => picks.shift();
    const result = await S().exportProjectWithPool();
    eq('7h project met bibliotheek: geslaagd, project letterlijk en vastgelegd, bibliotheek geschreven, geen melding',
      [result.ok && !('cancelled' in result && result.cancelled === true), file.text().includes(LITERAL), S().ifcLiteralCalendarIds,
        pool.text().startsWith('ISO-10303-21;'), S().ui.notifications.some(n => n.messageKey === 'notifications.ifcExportChangedWhileWaiting')],
      [true, true, [S().calendar.id], true, false]);
  }
  delete win.showSaveFilePicker;
  delete win.showOpenFilePicker;
}

// ── 3. Zonder bewerking verandert het veld niets ──────────────────────────────────────────────────────────────────
{
  let withLiteral = 0;
  let without = 0;
  for (const dir of ['public/examples', 'examples']) {
    for (const file of readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.ifc')).sort()) {
      const text = readFileSync(join(ROOT, dir, file), 'utf8');
      const store = await open(file, text);
      const literal = text.includes("'LiteralTimes'");
      if (literal) withLiteral++; else without++;
      if (!literal) eq(`${dir}/${file}: zonder LiteralTimes geen veld`, store.getState().ifcLiteralCalendarIds, null);
      eq(`${dir}/${file}: opslaan met en zonder het veld byte-gelijk`, save(store) === saveWithoutField(store), true);
    }
  }
  console.log(`..  voorbeelden: ${withLiteral} met LiteralTimes, ${without} zonder`);
}

if (diffs.length > 0) {
  console.log(`XX  ifc-literaltimes-behoud: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 40)) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  ifc-literaltimes-behoud: alle checks groen (${checks})`);
process.exit(0);
