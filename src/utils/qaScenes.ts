import { useAppStore } from '@/state/appStore';
import { TIMESCALE_ZOOM } from '@/engine/renderer/timelineTiers';

type Scene = {
  run?: () => Promise<string>;
  setup?: () => void;
  steps?: () => Promise<void>;
  target?: string;
  inset?: boolean;
  plain?: boolean;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(selector: string, timeoutMs = 10000): Promise<HTMLElement> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
    if (Date.now() > end) throw new Error(`qaScene: ${selector} niet gevonden`);
    await sleep(100);
  }
}

async function clickText(scope: string, texts: readonly string[], timeoutMs = 10000): Promise<void> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const btn = [...document.querySelectorAll<HTMLElement>(`${scope} button`)]
      .find(b => texts.includes(b.textContent?.trim() ?? ''));
    if (btn) { btn.click(); return; }
    if (Date.now() > end) throw new Error(`qaScene: knop ${texts.join('/')} niet gevonden`);
    await sleep(100);
  }
}

async function openProjectInfo(): Promise<void> {
  await clickText('body', ['Bestand', 'File']);
  await clickText('.backstage-sidebar', ['Projectinstellingen', 'Project settings']);
  await waitFor('[data-ops-scheduling-profile-section]');
}

async function expandConventions(): Promise<void> {
  const toggle = await waitFor('[data-ops-conventions-toggle]');
  if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
  await waitFor('[data-ops-conventions-body]');
}

async function createProfile(): Promise<void> {
  (await waitFor('[data-ops-scheduling-new-profile]')).click();
  (await waitFor('[data-ops-new-profile-create]')).click();
  await waitFor('input[type="checkbox"][data-ops-convention]');
}

function setP6Project(overrides: Record<string, boolean> = {}): void {
  useAppStore.setState(s => {
    s.project.schedulingProfile = { baseId: 'p6', id: 'p6', name: '', overrides };
    s.project.schedulingOptions = {
      lagCalendar: 'predecessor', criticalDefinition: { mode: 'longestPath' }, totalFloatMode: 'finish',
      makeOpenEndedCritical: false, startToStartLagFrom: 'earlyStart', useExpectedFinishDates: true,
    };
  });
}

async function chooseProfile(value: string): Promise<void> {
  (await waitFor('[data-ops-scheduling-profile-select] .ops-select__trigger')).click();
  (await waitFor(`[role="option"][data-value="${value}"]`)).click();
}

async function openOldFileAndSave(schema: 'IFC4' | 'IFC4X3'): Promise<string> {
  const raw = await (await fetch('/tests/planning/fixtures/ifc-arity-oude-writer.ifc')).text();
  const text = raw.replace("FILE_SCHEMA(('IFC4X3'));", `FILE_SCHEMA(('${schema}'));`);
  await useAppStore.getState().openExampleFromString(text, schema === 'IFC4' ? 'bouwmodel-ifc4.ifc' : 'oude-planning-ifc43.ifc');
  await sleep(500);
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, bubbles: true }));
  return '[data-ops-ifc-schema-question]';
}

async function openExample(file: string): Promise<void> {
  const text = await (await fetch(`/examples/${file}`)).text();
  await useAppStore.getState().openExampleFromString(text, file);
  await sleep(800);
}

async function clickRibbon(tab: string, item: string): Promise<void> {
  (await waitFor(`[data-ops-ribbon-tab="${tab}"]`)).click();
  (await waitFor(`[data-ops-ribbon-item="${item}"]`)).click();
}

async function tagWhere(scope: string, match: (el: HTMLElement) => boolean, timeoutMs = 10000): Promise<string> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const el = [...document.querySelectorAll<HTMLElement>(`${scope}`)].find(match);
    if (el) {
      el.setAttribute('data-qa-scene-target', '');
      return '[data-qa-scene-target]';
    }
    if (Date.now() > end) throw new Error(`qaScene: geen passend element in ${scope}`);
    await sleep(100);
  }
}

async function markStale(): Promise<void> {
  const { markDateMutation } = await import('@/state/transaction');
  useAppStore.setState(s => { markDateMutation(s); });
}

async function clickTaskRow(taskId: string): Promise<void> {
  useAppStore.getState().focusOnTask(taskId);
  const row = `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"]`;
  (await waitFor(`${row} [data-grid-column-id="task.name"]`)).click();
  await sleep(300);
}

async function taskOverFreePeriod(): Promise<string> {
  const [{ findLongFreePeriods }, { effectiveCalendarOf }, { shownStart, shownFinish }] = await Promise.all([
    import('@/engine/scheduler/freePeriods'),
    import('@/utils/taskDuration'),
    import('@/utils/taskDates'),
  ]);
  const s = useAppStore.getState();
  const task = s.tasks.find(t => !t.isMilestone && !s.tasks.some(o => o.parentId === t.id)
    && findLongFreePeriods(effectiveCalendarOf(t, s.calendar, s.calendars), shownStart(t), shownFinish(t)).length > 0);
  if (!task) throw new Error('qaScene: geen taak over een lange vrije periode');
  return task.id;
}

function seedLibraryBooking(companyId?: string): { companyId: string; taskId: string } {
  const s = useAppStore.getState();
  const cid = companyId ?? s.addCompany('Bouwbedrijf Kijklink');
  const poolId = companyId
    ? useAppStore.getState().pools[cid]!.resources[0]!.id
    : s.addPoolResource(cid, { name: 'Torenkraan', type: 'LABOR', description: '', maxUnits: 1 });
  if (!poolId) throw new Error('qaScene: poolresource niet aangemaakt');
  useAppStore.getState().bindProjectToCompany(cid);
  const { resourceId } = useAppStore.getState().addLibraryResourceToProject(cid, poolId);
  if (!resourceId) throw new Error('qaScene: poolresource niet in het project gezet');
  const st = useAppStore.getState();
  const task = st.tasks.find(t => !t.isMilestone && !st.tasks.some(o => o.parentId === t.id));
  if (!task) throw new Error('qaScene: geen gewone taak');
  st.assignResource(task.id, resourceId, 1);
  useAppStore.getState().runCPM();
  return { companyId: cid, taskId: task.id };
}

const F4B_DAY = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
const F4B_FRIDAY = [{ start: 420, end: 720 }, { start: 780, end: 840 }];

function seedF4bProject(theme: 'light' | 'dark'): Record<string, string> {
  const s = useAppStore.getState();
  s.newProject();
  s.setProject({ name: 'F4b — momenten en maten', startDate: '2026-11-02' });
  s.setUI({ uiTheme: theme, compressNonWorkdays: false, showPropertiesPanel: true, rightPanelCollapsed: false });
  s.setCalendar({
    ...s.calendar, name: 'Werkweek met korte vrijdag', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16,
    hoursPerDay: 8, holidays: [],
    workTime: { byWeekday: { 1: F4B_DAY, 2: F4B_DAY, 3: F4B_DAY, 4: F4B_DAY, 5: F4B_FRIDAY, 6: [], 7: [] } },
  });
  const add = (name: string, time: { unit: 'days'; days: number } | { unit: 'hours'; minutes: number }, extra: { milestone?: boolean } = {}) => {
    const id = useAppStore.getState().addTask({ name });
    const t = useAppStore.getState().tasks.find(x => x.id === id)!;
    useAppStore.getState().updateTask(id, {
      ...(extra.milestone ? { isMilestone: true } : {}),
      time: time.unit === 'days'
        ? { ...t.time, durationUnit: 'days', durationMinutes: undefined, scheduleDuration: time.days }
        : { ...t.time, durationUnit: 'hours', durationMinutes: time.minutes, scheduleDuration: time.minutes / 480 },
    });
    return id;
  };
  const fundering = add('Fundering storten', { unit: 'days', days: 2.5 });
  const metselwerk = add('Metselwerk', { unit: 'hours', minutes: 2400 });
  const leidingwerk = add('Leidingwerk', { unit: 'days', days: 3 });
  const kozijnen = add('Kozijnen', { unit: 'days', days: 5 });
  const tegelwerk = add('Tegelwerk (vast werk)', { unit: 'hours', minutes: 1440 });
  const oplevering = add('Oplevering', { unit: 'days', days: 0 }, { milestone: true });
  const st = useAppStore.getState();
  st.addSequence({ predecessorId: fundering, successorId: metselwerk, type: 'FINISH_START', lagDays: 0 });
  st.addSequence({ predecessorId: fundering, successorId: leidingwerk, type: 'START_START', lagDays: 0.5 });
  st.addSequence({ predecessorId: metselwerk, successorId: tegelwerk, type: 'FINISH_START', lagDays: 0 });
  st.addSequence({ predecessorId: tegelwerk, successorId: oplevering, type: 'FINISH_START', lagDays: 0 });
  st.updateTask(kozijnen, { splitGaps: [{ afterMinutes: 1920, gapMinutes: 480, source: 'user' }] });
  const tegelzetter = st.addResource({ name: 'Tegelzetter', type: 'LABOR', description: '', maxUnits: 1 });
  useAppStore.getState().assignResource(tegelwerk, tegelzetter, 1);
  useAppStore.getState().setTaskWorkRule(tegelwerk, 'FIXED_WORK');
  useAppStore.getState().runCPM();
  const view = useAppStore.getState();
  view.setZoom(TIMESCALE_ZOOM.day);
  view.setViewStartDate('2026-11-02');
  return { fundering, metselwerk, leidingwerk, kozijnen, tegelwerk, oplevering };
}

async function dismissOwnRecovery(): Promise<void> {
  const end = Date.now() + 2500;
  while (Date.now() < end) {
    const dialog = document.querySelector<HTMLElement>('[data-ops-recovery-dialog]');
    if (dialog) {
      const names = [...dialog.querySelectorAll('li .font-semibold')].map(el => el.textContent?.trim() ?? '');
      if (names.length > 0 && names.every(name => name === 'F4b — momenten en maten')) {
        await clickText('[data-ops-recovery-dialog]', ['Niet herstellen', "Don't restore"]);
      }
      return;
    }
    await sleep(100);
  }
}

async function dismissLateWelcome(): Promise<void> {
  const end = Date.now() + 3000;
  while (Date.now() < end) {
    if (document.querySelector('[data-ops-welcome-dialog]')) {
      await clickText('[data-ops-welcome-dialog]', ['Overslaan', 'Skip']);
      return;
    }
    await sleep(100);
  }
}

async function f4bGantt(theme: 'light' | 'dark'): Promise<string> {
  await dismissOwnRecovery();
  const ids = seedF4bProject(theme);
  await sleep(400);
  await clickTaskRow(ids.fundering);
  useAppStore.getState().setZoom(TIMESCALE_ZOOM.day);
  useAppStore.getState().setViewStartDate('2026-11-02');
  await dismissLateWelcome();
  (await waitFor('[data-ops-ribbon-tab="beeld"]')).click();
  return '[data-tour-anchor="ribbon-group:beeld:timeScale"]';
}

async function f4bTable(theme: 'light' | 'dark'): Promise<string> {
  await dismissOwnRecovery();
  seedF4bProject(theme);
  await sleep(400);
  await dismissLateWelcome();
  await clickText('body', ['Tabel', 'Table']);
  return waitFor('[data-task-grid-surface-id="full-task-grid"] [role="grid"]').then(() => '[data-task-grid-surface-id="full-task-grid"]');
}

const SKETCH_ZOOM = 6;

const SKETCH_ROWS = {
  dak: [[56, 70], [66, 84], [80, 92]],
  stap: [[28, 48], [34, 54], [40, 60]],
  twee: [[14, 34], [30, 50]],
  korter: [[6, 38], [18, 26]],
  gat: [[40, 54], [62, 76], [72, 90]],
  gelijk: [[14, 38], [14, 38], [14, 38]],
} satisfies Record<string, readonly (readonly [number, number])[]>;
type SketchRow = keyof typeof SKETCH_ROWS;

const SKETCH_LITERAL: Record<string, SketchRow> = {
  'Construct site road': 'korter',
  'Excavation, building pit': 'gelijk',
  'Pour foundation beams': 'twee',
  'Pour ground floor slab': 'stap',
  'Ground floor masonry \u2014 House 1': 'gat',
  'Roof structure \u2014 House 1': 'dak',
};
const SKETCH_REPEAT: readonly SketchRow[] = ['dak', 'gat', 'twee', 'dak', 'korter', 'gat', 'dak', 'twee'];

async function openBaselinesDoorElkaar(): Promise<void> {
  await openExample('showcase-rijwoningen-de-akkers.ifc');
  const { addCalendarDays, formatDate, MS_PER_DAY, parseDate } = await import('@/utils/dateUtils');
  useAppStore.setState(s => { s.baselines = []; s.activeBaselineId = null; });
  const contractId = useAppStore.getState().saveBaseline('Contract');
  const contract = useAppStore.getState().baselines.find(b => b.id === contractId)!;
  const nameOf = new Map(useAppStore.getState().tasks.map(t => [t.id, t.name]));
  const day0 = parseDate(contract.tasks.map(t => t.start.slice(0, 10)).sort()[0]);
  const dayOf = (iso: string) => Math.round((parseDate(iso.slice(0, 10)).getTime() - day0.getTime()) / MS_PER_DAY);
  const isoOf = (day: number) => formatDate(addCalendarDays(day0, day));
  const shift = (iso: string, days: number) => (iso ? isoOf(dayOf(iso) + days) + iso.slice(10) : iso);
  const repeats = contract.tasks.filter(t => !t.isMilestone && !SKETCH_LITERAL[nameOf.get(t.taskId) ?? '']);
  const derive = (which: 0 | 1 | 2) => contract.tasks.flatMap((t, i) => {
    if (t.isMilestone) {
      const days = ([[-6, 0, 6], [-5, -5, 3], [0, 0, 0]] as const)[i % 3][which];
      return [{ ...t, start: shift(t.start, days), finish: shift(t.finish, days) }];
    }
    const literal = SKETCH_LITERAL[nameOf.get(t.taskId) ?? ''];
    const row: readonly (readonly [number, number])[] = SKETCH_ROWS[literal ?? SKETCH_REPEAT[repeats.indexOf(t) % SKETCH_REPEAT.length]];
    const range = row[which];
    if (!range) return [];
    const offset = literal ? 0 : Math.max(0, dayOf(t.start) - 3) - row[0][0];
    return [{ ...t, start: isoOf(range[0] + offset), finish: isoOf(range[1] + offset - 1) }];
  });
  const named = (name: string, which: 0 | 1 | 2) => ({
    ...contract,
    id: `${contractId}-${name.replace(/\s+/g, '-').toLowerCase()}`,
    name,
    tasks: derive(which),
  });
  const maart = named('Herplanning maart', 1);
  const juni = named('Herplanning juni', 2);
  useAppStore.setState(s => {
    const i = s.baselines.findIndex(b => b.id === contractId);
    s.baselines[i] = { ...contract, tasks: derive(0) };
    s.baselines.push(maart, juni);
    s.activeBaselineId = contractId;
    s.ui.showBaselineOverlay = true;
    s.comparedBaselineIds = [maart.id, juni.id];
    s.ui.showPropertiesPanel = false;
  });
  (await waitFor('[data-ops-ribbon-tab="beeld"]')).click();
  for (let i = 0; i < 20; i++) {
    if (document.querySelector('[data-ops-welcome-dialog]')) {
      await clickText('[data-ops-welcome-dialog]', ['Overslaan', 'Skip']);
      break;
    }
    await sleep(150);
  }
  useAppStore.getState().setZoom(SKETCH_ZOOM);
  const { computeScrollToDate } = await import('@/utils/ganttViewport');
  const state = useAppStore.getState();
  useAppStore.setState(s => {
    s.view.scrollX = computeScrollToDate(isoOf(0), state);
    s.view.scrollY = 0;
  });
}

const SCENES: Record<string, Scene> = {
  'f4b-maten': { run: () => f4bGantt('light') },
  'f4b-maten-donker': { run: () => f4bGantt('dark') },
  'f4b-tabel': { run: () => f4bTable('light') },
  'f4b-tabel-donker': { run: () => f4bTable('dark') },
  'f4b-instellingen': {
    run: async () => {
      await dismissOwnRecovery();
      seedF4bProject('light');
      await dismissLateWelcome();
      useAppStore.getState().setUI({ showSettingsDialog: true, settingsFocusId: 'durationDisplay' });
      return tagWhere('[data-ops-setting="durationDisplay"]', () => true);
    },
  },
  'info-uitleg': {
    steps: async () => { await expandConventions(); (await waitFor('[data-ops-convention-help]')).focus(); },
    target: '[data-ops-convention-help]',
  },
  'info-eigen-profielen': { steps: expandConventions, target: '[data-ops-convention-own-only-note]' },
  'info-sslag-conventie': { target: '[data-ops-ss-lag-needs-convention]' },
  'info-sslag-uurplanning': {
    steps: () => chooseProfile('builtin:p6'),
    target: '[data-ops-ss-lag-needs-hour-planning]',
  },
  'info-bronbestand': {
    setup: () => {
      const s = useAppStore.getState();
      s.setProject({ schedulingOptions: { ...s.project.schedulingOptions, useExpectedFinishDates: true } });
    },
    target: '[data-ops-scheduling-source-options]',
  },
  'label-uurplanning': { steps: expandConventions, target: '[data-ops-convention-requires="hourPlanning"]' },
  'waarschuwing-naast-info': {
    steps: async () => {
      await createProfile();
      (await waitFor('[data-ops-convention-group="completedWork"] input[type="checkbox"]')).click();
      await waitFor('[data-ops-project-info-unapplied]');
    },
    target: '[data-ops-convention-group="completedWork"]',
  },
  'profielblok-p6': { setup: () => setP6Project(), target: '[data-ops-scheduling-profile-section]' },
  'profielblok-nieuw-profiel': {
    setup: () => setP6Project(),
    steps: async () => { (await waitFor('[data-ops-scheduling-new-profile]')).click(); },
    target: '[data-ops-new-profile-dialog]',
  },
  'profielblok-oud-bestand': {
    setup: () => setP6Project({ p6UseRemainingStartForProgress: false }),
    steps: expandConventions,
    target: '[data-ops-convention-row="p6UseRemainingStartForProgress"]',
  },
  'ifc-schema': { target: '[data-ops-project-ifc-schema]' },
  'ifc-vraag-ifc4': { run: () => openOldFileAndSave('IFC4') },
  'ifc-vraag-ifc43': { run: () => openOldFileAndSave('IFC4X3') },

  'geel-bibliotheek-balk': {
    run: async () => {
      await openExample('showcase-verbouwing-eengezinswoning.ifc');
      seedLibraryBooking();
      await clickRibbon('resources', 'openResourcePanel');
      await clickText('[data-ops-resources-view-toggle]', ['Bibliotheek', 'Library']);
      return '[data-ops-company-view-hint]';
    },
  },
  'geel-baseline-verouderd': {
    run: async () => {
      await openExample('showcase-verbouwing-eengezinswoning.ifc');
      await markStale();
      (await waitFor('[data-ops-ribbon-tab="planning"]')).click();
      await clickText('body', ['Baselines beheren…', 'Manage baselines…']);
      return tagWhere('[role="dialog"] [data-ops-baseline-stale-hint]', () => true);
    },
  },
  'geel-project-verplaatsen': {
    run: async () => {
      await openExample('showcase-verbouwing-eengezinswoning.ifc');
      await clickRibbon('planning', 'moveProject');
      const input = await waitFor('[data-ops-move-project-new-start] input') as HTMLInputElement;
      const data = new DataTransfer();
      data.setData('text', '2025-03-03');
      input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
      return tagWhere('[role="dialog"] div', el => el.style.color === 'var(--theme-warning-text)');
    },
  },
  'geel-vrije-periode': {
    run: async () => {
      await openExample('showcase-rijwoningen-de-akkers.ifc');
      await clickTaskRow(await taskOverFreePeriod());
      return tagWhere('[data-ops-free-period-warning]', () => true);
    },
  },
  'geel-waarschuwingen-paneel': {
    run: async () => {
      await openExample('showcase-rijwoningen-de-akkers.ifc');
      (await waitFor('[data-ops-status-warning="missedDeadlines"]')).click();
      await waitFor('[data-ops-warnings-panel]');
      await waitFor('[data-ops-warnings-panel] [data-ops-warning-id]');
      return '[data-ops-warnings-panel] ul[role="list"]';
    },
    inset: true,
  },
  'geel-statusbalk': {
    run: async () => {
      await openExample('showcase-rijwoningen-de-akkers.ifc');
      await waitFor('[data-ops-status-warning]');
      return '[data-ops-status-warning]';
    },
  },
  'geel-bezetting': {
    run: async () => {
      await openExample('showcase-verbouwing-eengezinswoning.ifc');
      const { companyId } = seedLibraryBooking();
      const { markDateMutation } = await import('@/state/transaction');
      useAppStore.setState(s => {
        const [a, b] = s.tasks.filter(t => !t.isMilestone && !s.tasks.some(o => o.parentId === t.id));
        s.sequences.push(
          { id: 'qa-kring-1', predecessorId: a!.id, successorId: b!.id, type: 'FINISH_START', lagDays: 0 },
          { id: 'qa-kring-2', predecessorId: b!.id, successorId: a!.id, type: 'FINISH_START', lagDays: 0 },
        );
        markDateMutation(s);
      });
      await openExample('showcase-rijwoningen-de-akkers.ifc');
      seedLibraryBooking(companyId);
      await clickRibbon('resources', 'openResourcePanel');
      (await waitFor('[data-ops-occupancy-view-button]')).click();
      (await waitFor('[data-ops-occupancy-expand]')).click();
      return '[data-ops-occupancy-stale-doc]';
    },
  },
  'geel-toewijzing-werk': {
    run: async () => {
      await openExample('showcase-verbouwing-eengezinswoning.ifc');
      const s = useAppStore.getState();
      s.setUI({ showTaskTypes: true });
      const a = s.assignments.find(x => {
        const t = s.tasks.find(t => t.id === x.taskId);
        return t && !t.isMilestone && !s.tasks.some(o => o.parentId === t.id);
      });
      if (!a) throw new Error('qaScene: geen toewijzing');
      useAppStore.setState(st => {
        const x = st.assignments.find(y => y.id === a.id)!;
        x.remainingWorkMinutes = 60;
      });
      await clickTaskRow(a.taskId);
      return `[data-ops-assignment-row="${a.id}"] [data-ops-assignment-work-deviates]`;
    },
  },
  'meerdere-baselines': {
    run: async () => {
      await openExample('showcase-verbouwing-eengezinswoning.ifc');
      const { addCalendarDays, formatDate, parseDate } = await import('@/utils/dateUtils');
      useAppStore.setState(s => { s.baselines = []; s.activeBaselineId = null; });
      const contractId = useAppStore.getState().saveBaseline('Contract');
      const contract = useAppStore.getState().baselines.find(b => b.id === contractId)!;
      const order = [...contract.tasks].filter(t => !t.isMilestone).sort((a, b) => a.start.localeCompare(b.start));
      const rank = new Map(order.map((t, i) => [t.taskId, i]));
      const shift = (iso: string, days: number) => (iso
        ? formatDate(addCalendarDays(parseDate(iso), days)) + iso.slice(10)
        : iso);
      const SHIFTS: Record<'deels' | 'gelijk' | 'los', [number, number, number]> = {
        deels: [-4, -2, 0],
        gelijk: [-3, -3, 0],
        los: [-20, -10, 0],
      };
      const kindOf = (taskId: string) => {
        const i = rank.get(taskId);
        if (i === undefined) return null;
        return (['deels', 'gelijk', 'los'] as const)[i % 3];
      };
      const derive = (name: string, which: 0 | 1 | 2) => ({
        ...contract,
        id: `${contractId}-${name.replace(/\s+/g, '-').toLowerCase()}`,
        name,
        tasks: contract.tasks.map(t => {
          const kind = kindOf(t.taskId);
          const d = kind ? SHIFTS[kind][which] : [-4, -4, 0][which];
          return { ...t, start: shift(t.start, d), finish: shift(t.finish, d) };
        }),
      });
      const contractShifted = derive('Contract', 0);
      const maart = derive('Herplanning maart', 1);
      const juni = derive('Herplanning juni', 2);
      useAppStore.setState(s => {
        const i = s.baselines.findIndex(b => b.id === contractId);
        s.baselines[i] = { ...contractShifted, id: contractId };
        s.baselines.push(maart, juni);
        s.activeBaselineId = contractId;
        s.ui.showBaselineOverlay = true;
        s.comparedBaselineIds = [maart.id, juni.id];
      });
      (await waitFor('[data-ops-ribbon-tab="beeld"]')).click();
      for (let i = 0; i < 20; i++) {
        if (document.querySelector('[data-ops-welcome-dialog]')) {
          await clickText('[data-ops-welcome-dialog]', ['Overslaan', 'Skip']);
          break;
        }
        await sleep(150);
      }
      return '[data-ops-baseline-split]';
    },
  },
  'baselines-door-elkaar': {
    plain: true,
    run: async () => {
      await openBaselinesDoorElkaar();
      return '[data-ops-ribbon-tab="beeld"]';
    },
  },
  'baselines-door-elkaar-rapport': {
    plain: true,
    run: async () => {
      await openBaselinesDoorElkaar();
      (await waitFor('[data-ops-ribbon-tab="report"]')).click();
      for (let i = 0; i < 40; i++) {
        const box = [...document.querySelectorAll('label')]
          .find(l => /Baseline-overlay|baseline overlay/i.test(l.textContent ?? ''))
          ?.querySelector('input');
        if (box) {
          if (!box.checked) box.click();
          break;
        }
        await sleep(150);
      }
      return '[data-ops-ribbon-tab="report"]';
    },
  },
};

export async function runQaScene(name: string): Promise<void> {
  const scene = SCENES[name];
  if (!scene) {
    console.warn(`qaScene: onbekend "${name}"; bekend: ${Object.keys(SCENES).join(', ')}`);
    return;
  }
  await sleep(300);
  if (document.querySelector('[data-ops-welcome-dialog]')) await clickText('[data-ops-welcome-dialog]', ['Overslaan', 'Skip']);
  let target: string;
  if (scene.run) {
    target = await scene.run();
  } else {
    scene.setup?.();
    await openProjectInfo();
    await scene.steps?.();
    target = scene.target!;
  }
  if (scene.plain) return;
  (await waitFor(target)).scrollIntoView({ block: 'center' });
  for (const el of document.querySelectorAll<HTMLElement>(target)) {
    el.style.outline = '3px dashed var(--theme-accent)';
    el.style.outlineOffset = scene.inset ? '-3px' : '3px';
  }
}
