import type { ExtGuideStep, ExtHelpText, ExtensionApi } from './types';

export interface GuideBinding {
  extensionId: string;
  api: ExtensionApi;
  subscribe(listener: () => void): () => void;
  openBundledProject(assetName: string): Promise<void>;
  resolveImage(path: string): string;
  reportError(stepId: string, error: unknown): void;
}

export interface GuideStepView {
  id: string;
  body: ExtHelpText;
  anchor?: string;
  hasCheck: boolean;
  hasPrepare: boolean;
  hasReset: boolean;
}

export interface GuideView {
  session: number;
  extensionId: string;
  guideId: string;
  title: ExtHelpText;
  stepIndex: number;
  stepCount: number;
  step: GuideStepView;
  done: boolean;
  checkFailed: boolean;
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
  epoch: number;
}

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

function update(guide: ActiveGuide, patch: Partial<GuideView>): void {
  if (active !== guide) return;
  guide.view = { ...guide.view, ...patch };
  emit();
}

function current(guide: ActiveGuide, epoch: number): boolean {
  return active === guide && guide.epoch === epoch;
}

function fail(guide: ActiveGuide, stepIndex: number, epoch: number, error: unknown, disableCheck: boolean): void {
  if (active !== guide) return;
  guide.binding.reportError(guide.steps[stepIndex]?.id ?? '', error);
  if (disableCheck && current(guide, epoch)) update(guide, { checkFailed: true });
}

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

export function stopGuideSession(extensionId?: string): void {
  const guide = active;
  if (!guide) return;
  if (extensionId !== undefined && guide.binding.extensionId !== extensionId) return;
  active = null;
  if (guide.timer !== null) clearTimeout(guide.timer);
  try { guide.unsubscribe(); } catch { }
  emit();
}

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

export function guideResolveImage(path: string): string {
  return active ? active.binding.resolveImage(path) : '';
}

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

export function getGuideView(): GuideView | null {
  return active ? active.view : null;
}

export function subscribeGuideView(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
