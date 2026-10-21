// Kijkscènes voor handmatige controle, alleen in DEV: `?qaScene=<naam>` zet de app via echte klikken op
// het punt dat de eigenaar moet zien, scrolt erheen en omlijnt het doel. Zo kan een checkstap een link
// zijn in plaats van een klikinstructie. Valt uit elke productiebouw (dynamische import achter
// `import.meta.env.DEV` in main.tsx). Geen testhaak: browsertests doen hun eigen handelingen.
import { useAppStore } from '@/state/appStore';

type Scene = {
  /** Eigen verloop zonder Projectinfo; geeft het doel-selector terug. */
  run?: () => Promise<string>;
  /** Voorbereiding in de store vóór Projectinfo opengaat (alleen beginstand, geen geteste handeling). */
  setup?: () => void;
  /** Klikken binnen Projectinfo voordat het doel zichtbaar is. */
  steps?: () => Promise<void>;
  /** Het element dat de eigenaar moet zien. */
  target?: string;
  /** Omlijning binnen het element, voor een doel in een vlak dat de buitenkant afknipt. */
  inset?: boolean;
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

/** Knop op zichtbare tekst (nl of en), binnen `scope`. */
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

/** Klapt *Conventies van dit profiel* open (standaard dicht). */
async function expandConventions(): Promise<void> {
  const toggle = await waitFor('[data-ops-conventions-toggle]');
  if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
  await waitFor('[data-ops-conventions-body]');
}

/** "Nieuw profiel" met de voorgestelde naam: daarna zijn de conventies bewerkbaar. */
async function createProfile(): Promise<void> {
  (await waitFor('[data-ops-scheduling-new-profile]')).click();
  (await waitFor('[data-ops-new-profile-create]')).click();
  await waitFor('input[type="checkbox"][data-ops-convention]');
}

/** Beginstand: het project rekent als Primavera P6, met reken-opties zoals Roads (langste pad) en een
 *  bronoptie uit de .xer; `overrides` = afwijkingen op het ingebouwde id (zoals de migratie ze geeft). */
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

/** Opent een bestand van een oudere app-versie (geen schemamarkering) met kop `schema`, en drukt Ctrl+S:
 *  de schemavraag (#292) verschijnt. Het bestand is de fixture van de arity-test. */
async function openOldFileAndSave(schema: 'IFC4' | 'IFC4X3'): Promise<string> {
  const raw = await (await fetch('/tests/planning/fixtures/ifc-arity-oude-writer.ifc')).text();
  const text = raw.replace("FILE_SCHEMA(('IFC4X3'));", `FILE_SCHEMA(('${schema}'));`);
  await useAppStore.getState().openExampleFromString(text, schema === 'IFC4' ? 'bouwmodel-ifc4.ifc' : 'oude-planning-ifc43.ifc');
  await sleep(500);
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, bubbles: true }));
  return '[data-ops-ifc-schema-question]';
}

// ── Hulpjes voor de gele-waarschuwingsscènes ───────────────────────────────────────────────────

/** Opent een voorbeeldproject uit `public/examples` als nieuw document en wacht tot het staat. */
async function openExample(file: string): Promise<void> {
  const text = await (await fetch(`/examples/${file}`)).text();
  await useAppStore.getState().openExampleFromString(text, file);
  await sleep(800);
}

/** Klikt een lintknop: eerst het tabblad, dan het item (`data-ops-ribbon-item`). */
async function clickRibbon(tab: string, item: string): Promise<void> {
  (await waitFor(`[data-ops-ribbon-tab="${tab}"]`)).click();
  (await waitFor(`[data-ops-ribbon-item="${item}"]`)).click();
}

/** Zoekt binnen `scope` het eerste element dat aan `match` voldoet, en geeft er een selector voor. */
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

/** Zet de planning op verouderd (zoals na een bewerking zonder F5). */
async function markStale(): Promise<void> {
  const { markDateMutation } = await import('@/state/transaction');
  useAppStore.setState(s => { markDateMutation(s); });
}

/** Brengt de taakrij in beeld en selecteert de taak met een echte klik op de naamcel. */
async function clickTaskRow(taskId: string): Promise<void> {
  useAppStore.getState().focusOnTask(taskId);
  const row = `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"]`;
  (await waitFor(`${row} [data-grid-column-id="task.name"]`)).click();
  await sleep(300);
}

/** Een gewone taak (geen mijlpaal, geen samenvatting) die over een lange vrije periode loopt. */
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

/** Een bibliotheek met één poolresource, gekoppeld aan het actieve project en toegewezen aan één
 *  gewone taak. Geeft de bibliotheek en de taak terug. */
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

const SCENES: Record<string, Scene> = {
  // Blauwe (nu oranje) infoblokken in Projectinfo › Rekenprofiel.
  // Uitleg per conventie: het i-icoon krijgt de focus, de tooltip staat er meteen (en blijft bij scrollen).
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
  // Info-labels (badge--blue) bij de conventies.
  'label-uurplanning': { steps: expandConventions, target: '[data-ops-convention-requires="hourPlanning"]' },
  // Info (oranje) naast waarschuwing (geel + icoon): een conventie aanzetten maakt de groep "afwijkend"
  // en geeft onderaan "Wijzigingen niet toegepast".
  'waarschuwing-naast-info': {
    steps: async () => {
      await createProfile();
      (await waitFor('[data-ops-convention-group="completedWork"] input[type="checkbox"]')).click();
      await waitFor('[data-ops-project-info-unapplied]');
    },
    target: '[data-ops-convention-group="completedWork"]',
  },
  // Profielblok (review #169, 2026-10-14): P6 met ingeklapte conventies en het blok "afwijkende
  // reken-opties"; de naamvraag van "Nieuw profiel"; een afwijking uit een oud bestand, alleen-lezen.
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
  // De IFC-schemakeuze (#292).
  'ifc-schema': { target: '[data-ops-project-ifc-schema]' },
  // De schemavraag bij opslaan (#292): een IFC4-bestand, en een IFC 4.3-bestand van een oudere app.
  'ifc-vraag-ifc4': { run: () => openOldFileAndSave('IFC4') },
  'ifc-vraag-ifc43': { run: () => openOldFileAndSave('IFC4X3') },

  // ── Gele waarschuwingen: waar de app nu geel toont (keuze welke rood worden) ──
  // 1. Waarschuwingsbalk met driehoek boven de resourcetabel (StatusBanner `warning`), hier in de
  //    Bibliotheekweergave. Dezelfde balk staat in Bezetting bij een ongeteld document (scène 7).
  'geel-bibliotheek-balk': {
    run: async () => {
      await openExample('showcase-verbouwing-eengezinswoning.ifc');
      seedLibraryBooking();
      await clickRibbon('resources', 'openResourcePanel');
      await clickText('[data-ops-resources-view-toggle]', ['Bibliotheek', 'Library']);
      return '[data-ops-company-view-hint]';
    },
  },
  // 2. Baseline-dialoog: "⚠ Planning is verouderd — herbereken eerst (F5)" bij een verouderde planning.
  'geel-baseline-verouderd': {
    run: async () => {
      await openExample('showcase-verbouwing-eengezinswoning.ifc');
      await markStale();
      (await waitFor('[data-ops-ribbon-tab="planning"]')).click();
      await clickText('body', ['Baselines beheren…', 'Manage baselines…']);
      return tagWhere('[role="dialog"] div', el => el.children.length === 0 && (el.textContent ?? '').startsWith('⚠'));
    },
  },
  // 3. Project verplaatsen: "De nieuwe startdatum ligt in het verleden." bij een datum vóór vandaag.
  'geel-project-verplaatsen': {
    run: async () => {
      await openExample('showcase-verbouwing-eengezinswoning.ifc');
      await clickRibbon('planning', 'moveProject');
      const input = await waitFor('[role="dialog"] input[type="date"]') as HTMLInputElement;
      // Gecontroleerd React-veld: de waarde via de native setter, dan een input-event.
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '2025-03-03');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return tagWhere('[role="dialog"] div', el => el.style.color === 'var(--theme-warning-text)');
    },
  },
  // 4. Taakpaneel: "⚠ Deze taak loopt over … — een vrije periode van … dagen" (bouwvak).
  'geel-vrije-periode': {
    run: async () => {
      await openExample('showcase-rijwoningen-de-akkers.ifc');
      await clickTaskRow(await taskOverFreePeriod());
      return tagWhere('div', el => el.children.length === 0 && el.style.color === 'var(--theme-warning-text)'
        && (el.textContent ?? '').startsWith('⚠'));
    },
  },
  // 5. Paneel Waarschuwingen met gele driehoekjes, geopend via de gele melding in de statusbalk.
  'geel-waarschuwingen-paneel': {
    run: async () => {
      await openExample('showcase-rijwoningen-de-akkers.ifc');
      (await waitFor('[data-ops-status-warning="missedDeadlines"]')).click();
      await waitFor('[data-ops-warnings-panel]');
      await waitFor('[data-ops-warnings-panel] [data-ops-warning-id]');
      return '[data-ops-warnings-panel] ul[role="list"]';
    },
    // Het paneel knipt een omlijning aan de buitenkant af.
    inset: true,
  },
  // 6. Statusbalk onderaan: "⚠ 1 deadline(s) overschreden" en "⚠ 1 resource(s) overbezet".
  'geel-statusbalk': {
    run: async () => {
      await openExample('showcase-rijwoningen-de-akkers.ifc');
      await waitFor('[data-ops-status-warning]');
      return '[data-ops-status-warning]';
    },
  },
  // 7. Bezetting: een slapend document dat niet door te rekenen is (relatiekring) telt niet mee —
  //    gele balk bovenaan en per document "⚠ Telt niet mee: …". Omlijnd: de markering in de rij.
  'geel-bezetting': {
    run: async () => {
      await openExample('showcase-verbouwing-eengezinswoning.ifc');
      const { companyId } = seedLibraryBooking();
      // Beginstand: een kring van twee relaties (zoals een geïmporteerd bestand kan hebben) en verouderd.
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
  // 8. Taakpaneel › Toewijzingen: gele driehoek bij opgeslagen werk dat afwijkt van inzet × duur
  //    (tooltip "Wijkt af van inzet × duur"). Alleen zichtbaar met "Toon werkregels en werk".
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
      // Beginstand: opgeslagen restwerk van 1 uur (zoals een P6-toewijzing met een eigen spanne).
      useAppStore.setState(st => {
        const x = st.assignments.find(y => y.id === a.id)!;
        x.remainingWorkMinutes = 60;
      });
      await clickTaskRow(a.taskId);
      return `[data-ops-assignment-row="${a.id}"] [data-ops-assignment-work-deviates]`;
    },
  },
  // Issue #391: meerdere baselines tegelijk in de Gantt, in één gestreepte strook.
  // Drie baselines: "Contract" (actief) plus "Herplanning maart" en "Herplanning juni". De
  // verschuivingen wisselen per taak, zodat alle gevallen in beeld komen: drie baselines die deels
  // overlappen (stukken met 1, 2 en 3 kleuren), twee die precies samenvallen, en drie die elkaar niet
  // raken. Bij de mijlpalen vallen Contract en maart op dezelfde datum (één gestreepte ruit).
  'meerdere-baselines': {
    run: async () => {
      await openExample('showcase-verbouwing-eengezinswoning.ifc');
      const { addCalendarDays, formatDate, parseDate } = await import('@/utils/dateUtils');
      // Het voorbeeld heeft al een baseline; de scène begint met precies deze drie.
      useAppStore.setState(s => { s.baselines = []; s.activeBaselineId = null; });
      const contractId = useAppStore.getState().saveBaseline('Contract');
      const contract = useAppStore.getState().baselines.find(b => b.id === contractId)!;
      const order = [...contract.tasks].filter(t => !t.isMilestone).sort((a, b) => a.start.localeCompare(b.start));
      const rank = new Map(order.map((t, i) => [t.taskId, i]));
      const shift = (iso: string, days: number) => (iso
        ? formatDate(addCalendarDays(parseDate(iso), days)) + iso.slice(10)
        : iso);
      // Verschuiving in kalenderdagen per baseline [contract, maart, juni], per soort taak.
      const SHIFTS: Record<'deels' | 'gelijk' | 'los', [number, number, number]> = {
        deels: [-4, -2, 0],    // overlappen deels: stukken met 1, 2 en 3 baselines
        gelijk: [-3, -3, 0],   // contract en maart vallen samen: gestreept in twee kleuren
        los: [-20, -10, 0],    // raken elkaar niet: drie losse effen stukken
      };
      const kindOf = (taskId: string) => {
        const i = rank.get(taskId);
        if (i === undefined) return null; // mijlpaal
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
      // In een verse browser komt het welkomstvenster soms pas ná het begin van de scène.
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
};

export async function runQaScene(name: string): Promise<void> {
  const scene = SCENES[name];
  if (!scene) {
    console.warn(`qaScene: onbekend "${name}"; bekend: ${Object.keys(SCENES).join(', ')}`);
    return;
  }
  // Welkomstvenster (eerste start in een schone browser) wegklikken.
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
  (await waitFor(target)).scrollIntoView({ block: 'center' });
  // Alle treffers omlijnen (bv. meerdere meldingen naast elkaar in de statusbalk).
  for (const el of document.querySelectorAll<HTMLElement>(target)) {
    el.style.outline = '3px dashed var(--theme-accent)';
    el.style.outlineOffset = scene.inset ? '-3px' : '3px';
  }
}
