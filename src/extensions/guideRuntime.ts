/**
 * De looptijd van het begeleidingspaneel (`api.help.startGuide`, contract 1.4.0).
 *
 * WAAR DE STAAT WOONT. Module-globaal met abonnees (zelfde soort UI-coördinatie als
 * `utils/helpArticleRegistry.ts`), niet in de store: een begeleiding draagt functies van de extensie
 * (`check`, `prepare`), is geen documentdata, gaat niet mee in undo of opslaan en overleeft een
 * documentwissel. Het paneel (`components/guide/GuidePanel.tsx`) leest de momentopname via
 * `useSyncExternalStore`.
 *
 * GEEN STORE-IMPORT. De host geeft bij het starten een binding mee (`GuideBinding`): een abonnement
 * op wijzigingen in de app, het openen van een meegeleverd project en het melden van fouten. Zo blijft
 * dit bestand headless te testen (`tests/planning/check-ext-help.ts`) en raakt de extensie de store
 * nooit zelf.
 *
 * HET GEDRAG, IN VIJF REGELS.
 *  1. Er loopt hooguit één begeleiding. Een nieuwe `start` van DEZELFDE extensie vervangt de vorige;
 *     loopt er een begeleiding van een ANDERE extensie, dan wordt de start geweigerd (gooit) — alleen
 *     de gebruiker (Sluiten) of de eigenaar (`stopGuide`) maakt plaats.
 *  2. Bij het openen van een stap, en daarna gebundeld (hooguit eens per 150 ms) na wijzigingen in de app, roept de
 *     host `check(api)` aan. Alleen `true` telt; dan is de stap GEDAAN en blijft hij dat tot de stap
 *     opnieuw begint (Terug/Volgende/Opnieuw). Elke keer dat een stap (opnieuw) begint, krijgt hij een
 *     nieuw volgnummer (`epoch`); een uitkomst die binnenkomt voor een eerder volgnummer — ook van
 *     dezelfde stap, na Opnieuw of Terug→Volgende — wordt genegeerd.
 *  3. Gooit `check` (of wijst hij af), dan meldt de host dat via het meldingenkanaal en valt de stap
 *     terug op "Klaar, volgende": de gebruiker komt nooit vast te zitten door een fout in de extensie.
 *  4. "Toon mij" = `prepare(api)`, daarna meteen een controle. "Opnieuw" = het `resetAsset` openen als
 *     nieuw document, de stap weer op niet-gedaan, daarna een controle. Fouten: melden, niet crashen.
 *  5. Stoppen (Sluiten, Klaar op de laatste stap, `stopGuide()`, of het uitschakelen van de extensie)
 *     zegt het abonnement op en ruimt alles op.
 */
import type { ExtGuideStep, ExtHelpText, ExtensionApi } from './types';

/** Wat de host meegeeft bij het starten. */
export interface GuideBinding {
  extensionId: string;
  api: ExtensionApi;
  /** Abonneer op wijzigingen in de app; geeft een opzegfunctie. */
  subscribe(listener: () => void): () => void;
  /** Open een meegeleverd `.ifc` als nieuw document (dezelfde route als `api.help.openBundledProject`). */
  openBundledProject(assetName: string): Promise<void>;
  /** Afbeeldingspad uit een stap-tekst → URL (eigen assets van de extensie). */
  resolveImage(path: string): string;
  /** Meld een fout in een callback van de extensie via het meldingenkanaal. */
  reportError(stepId: string, error: unknown): void;
}

/** De stap zoals het paneel hem ziet: data, geen functies van de extensie. */
export interface GuideStepView {
  id: string;
  body: ExtHelpText;
  anchor?: string;
  hasCheck: boolean;
  hasPrepare: boolean;
  hasReset: boolean;
}

/** Momentopname voor het paneel (stabiele referentie tot de volgende wijziging). */
export interface GuideView {
  /** Nieuw getal per gestarte begeleiding (React-key, en om oude uitkomsten te herkennen). */
  session: number;
  extensionId: string;
  guideId: string;
  title: ExtHelpText;
  stepIndex: number;
  stepCount: number;
  step: GuideStepView;
  /** `check` gaf `true` sinds de stap begon. */
  done: boolean;
  /** `check` gooide: de stap valt terug op "Klaar, volgende". */
  checkFailed: boolean;
  /** Toon mij of Opnieuw loopt nog. */
  busy: boolean;
}

interface ActiveGuide {
  binding: GuideBinding;
  id: string;
  title: ExtHelpText;
  steps: ExtGuideStep[];
  view: GuideView;
  unsubscribe: () => void;
  timer: ReturnType<typeof setTimeout> | null;
  /** Volgnummer van de huidige stapsessie; opgehoogd bij elk (her)begin van een stap. */
  epoch: number;
}

/** Bundelvenster voor controles na wijzigingen in de app. */
export const GUIDE_CHECK_DEBOUNCE_MS = 150;

let active: ActiveGuide | null = null;
let sessionSeq = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function stepView(step: ExtGuideStep): GuideStepView {
  return {
    id: step.id,
    body: { nl: step.body.nl, en: step.body.en },
    ...(step.anchor ? { anchor: step.anchor } : {}),
    hasCheck: typeof step.check === 'function',
    hasPrepare: typeof step.prepare === 'function',
    hasReset: typeof step.resetAsset === 'string',
  };
}

/** Zet velden van de momentopname (nieuwe referentie) en meld het de abonnees. */
function update(guide: ActiveGuide, patch: Partial<GuideView>): void {
  if (active !== guide) return;
  guide.view = { ...guide.view, ...patch };
  emit();
}

/** Is `guide` nog steeds actief én loopt nog dezelfde stapsessie (`epoch`)? */
function current(guide: ActiveGuide, epoch: number): boolean {
  return active === guide && guide.epoch === epoch;
}

function fail(guide: ActiveGuide, stepIndex: number, epoch: number, error: unknown, disableCheck: boolean): void {
  if (active !== guide) return;
  guide.binding.reportError(guide.steps[stepIndex]?.id ?? '', error);
  if (disableCheck && current(guide, epoch)) update(guide, { checkFailed: true });
}

/** Roep `check` van de huidige stap aan (als die er is en de stap nog niet gedaan is). */
function runCheck(guide: ActiveGuide): void {
  if (active !== guide) return;
  const { stepIndex, done, checkFailed } = guide.view;
  const check = guide.steps[stepIndex]?.check;
  if (done || checkFailed || typeof check !== 'function') return;
  const epoch = guide.epoch;
  let result: boolean | Promise<boolean>;
  try {
    result = check(guide.binding.api);
  } catch (error) {
    fail(guide, stepIndex, epoch, error, true);
    return;
  }
  void Promise.resolve(result).then(
    (value) => {
      if (value === true && current(guide, epoch) && !guide.view.done) update(guide, { done: true });
    },
    (error: unknown) => {
      if (current(guide, epoch)) fail(guide, stepIndex, epoch, error, true);
    },
  );
}

/**
 * Bundel: de eerste wijziging zet een timer, volgende wijzigingen binnen het venster vallen erin.
 * Bewust GEEN debounce die bij elke wijziging opnieuw begint: een app die voortdurend kleine
 * UI-wijzigingen doet (hover, scroll) zou de controle dan eindeloos uitstellen.
 */
function scheduleCheck(guide: ActiveGuide): void {
  if (active !== guide || guide.timer !== null) return;
  guide.timer = setTimeout(() => {
    guide.timer = null;
    runCheck(guide);
  }, GUIDE_CHECK_DEBOUNCE_MS);
}

function enterStep(guide: ActiveGuide, stepIndex: number): void {
  if (guide.timer !== null) { clearTimeout(guide.timer); guide.timer = null; }
  guide.epoch++;
  update(guide, {
    stepIndex,
    step: stepView(guide.steps[stepIndex]),
    done: false,
    checkFailed: false,
    busy: false,
  });
  runCheck(guide);
}

/**
 * Start een (al gevalideerde) begeleiding. De stappen worden gekopieerd: een extensie die haar
 * object later muteert, verandert de lopende begeleiding niet. Gooit als er een begeleiding van een
 * ándere extensie loopt: een extensie mag de tutorial van een andere niet wegpoetsen.
 */
export function startGuideSession(
  binding: GuideBinding,
  guide: { id: string; title: ExtHelpText; steps: readonly ExtGuideStep[] },
): void {
  if (active && active.binding.extensionId !== binding.extensionId) {
    throw new Error(
      `Extensie "${binding.extensionId}": er loopt al een begeleiding van extensie "${active.binding.extensionId}"`,
    );
  }
  stopGuideSession();
  const steps: ExtGuideStep[] = guide.steps.map(step => ({
    id: step.id,
    body: { nl: step.body.nl, en: step.body.en },
    ...(step.anchor !== undefined ? { anchor: step.anchor } : {}),
    ...(step.check !== undefined ? { check: step.check } : {}),
    ...(step.prepare !== undefined ? { prepare: step.prepare } : {}),
    ...(step.resetAsset !== undefined ? { resetAsset: step.resetAsset } : {}),
  }));
  const session = ++sessionSeq;
  const next: ActiveGuide = {
    binding,
    id: guide.id,
    title: { nl: guide.title.nl, en: guide.title.en },
    steps,
    view: {
      session,
      extensionId: binding.extensionId,
      guideId: guide.id,
      title: { nl: guide.title.nl, en: guide.title.en },
      stepIndex: 0,
      stepCount: steps.length,
      step: stepView(steps[0]),
      done: false,
      checkFailed: false,
      busy: false,
    },
    unsubscribe: () => {},
    timer: null,
    epoch: 0,
  };
  active = next;
  next.unsubscribe = binding.subscribe(() => scheduleCheck(next));
  emit();
  runCheck(next);
}

/**
 * Stop de lopende begeleiding. Met `extensionId`: alleen als die van deze extensie is (een extensie
 * mag andermans begeleiding niet sluiten).
 */
export function stopGuideSession(extensionId?: string): void {
  const guide = active;
  if (!guide) return;
  if (extensionId !== undefined && guide.binding.extensionId !== extensionId) return;
  active = null;
  if (guide.timer !== null) clearTimeout(guide.timer);
  try { guide.unsubscribe(); } catch { /* opzeggen mag de opruiming niet breken */ }
  emit();
}

/** Volgende stap; op de laatste stap sluit dit de begeleiding ("Klaar"). */
export function guideNext(): void {
  const guide = active;
  if (!guide || guide.view.busy) return;
  const { stepIndex, stepCount } = guide.view;
  if (stepIndex >= stepCount - 1) { stopGuideSession(); return; }
  enterStep(guide, stepIndex + 1);
}

export function guidePrevious(): void {
  const guide = active;
  if (!guide || guide.view.busy || guide.view.stepIndex === 0) return;
  enterStep(guide, guide.view.stepIndex - 1);
}

/** "Toon mij": `prepare(api)` van de huidige stap, daarna een controle. */
export async function guideShowMe(): Promise<void> {
  const guide = active;
  if (!guide) return;
  const stepIndex = guide.view.stepIndex;
  const prepare = guide.steps[stepIndex]?.prepare;
  if (typeof prepare !== 'function' || guide.view.busy) return;
  const epoch = guide.epoch;
  update(guide, { busy: true });
  try {
    await prepare(guide.binding.api);
  } catch (error) {
    fail(guide, stepIndex, epoch, error, false);
  }
  if (current(guide, epoch)) {
    update(guide, { busy: false });
    runCheck(guide);
  }
}

/** "Opnieuw": open de beginstand van de stap als nieuw document en begin de stap opnieuw. */
export async function guideReset(): Promise<void> {
  const guide = active;
  if (!guide) return;
  const stepIndex = guide.view.stepIndex;
  const asset = guide.steps[stepIndex]?.resetAsset;
  if (typeof asset !== 'string' || guide.view.busy) return;
  const epoch = guide.epoch;
  update(guide, { busy: true });
  try {
    await guide.binding.openBundledProject(asset);
  } catch (error) {
    fail(guide, stepIndex, epoch, error, false);
  }
  if (current(guide, epoch)) enterStep(guide, stepIndex);
}

/** Afbeeldingspad in de tekst van de lopende begeleiding → URL. */
export function guideResolveImage(path: string): string {
  return active ? active.binding.resolveImage(path) : '';
}

/**
 * Een `project://`-link in de stap-tekst: meegeleverd project openen (fout ⇒ melding). Loopt er al
 * iets (Toon mij, Opnieuw, of deze link zelf: dubbelklik), dan doet een klik niets — anders opent
 * een dubbelklik twee documenten.
 */
export async function guideOpenProject(assetName: string): Promise<void> {
  const guide = active;
  if (!guide || guide.view.busy) return;
  const { stepIndex } = guide.view;
  const epoch = guide.epoch;
  update(guide, { busy: true });
  try {
    await guide.binding.openBundledProject(assetName);
  } catch (error) {
    fail(guide, stepIndex, epoch, error, false);
  }
  if (current(guide, epoch)) update(guide, { busy: false });
}

/** Huidige momentopname, of `null` als er geen begeleiding loopt. */
export function getGuideView(): GuideView | null {
  return active ? active.view : null;
}

/** Abonneer op wijzigingen (voor `useSyncExternalStore`). */
export function subscribeGuideView(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
