export interface AppQuitDocument {
  id: string;
  isDirty: boolean;
}

export interface AppQuitDependencies {
  finishPendingInput: () => void;
  listDocuments: () => AppQuitDocument[];
  getPendingCloseDocId: () => string | null;
  setPendingCloseDocId: (id: string) => void;
  setQuitPending: (pending: boolean) => void;
  closeWrites: () => Promise<() => void>;
  stopRecovery: () => () => void;
  clearRecovery: () => Promise<void>;
  destroyWindow: () => Promise<void>;
  waitForSaves: () => Promise<void> | null;
  watchFailures: () => () => boolean;
  claimShutdown: () => (() => void) | null;
}

export interface AppQuitController {
  requestQuit: () => boolean;
  step: () => void;
  readonly active: boolean;
}

export function createAppQuitController(deps: AppQuitDependencies): AppQuitController {
  let active = false;
  let finishing = false;
  let waiting = false;
  let prompting: string | null = null;
  let releaseShutdown: (() => void) | null = null;

  const abort = () => {
    active = false;
    prompting = null;
    deps.setQuitPending(false);
    releaseShutdown?.();
    releaseShutdown = null;
  };

  const finish = async () => {
    if (finishing) return;
    finishing = true;
    const reopenWrites = await deps.closeWrites();
    const resumeRecovery = deps.stopRecovery();
    try {
      await deps.clearRecovery();
    } catch (error) {
      console.warn('Herstelsnapshots opruimen bij afsluiten mislukt:', error);
    }
    const reopen = () => {
      resumeRecovery();
      reopenWrites();
      finishing = false;
    };
    if (deps.listDocuments().some((doc) => doc.isDirty)) {
      reopen();
      step();
      return;
    }
    try {
      await deps.destroyWindow();
    } catch (error) {
      console.error('Venster sluiten bij afsluiten mislukt:', error);
      reopen();
      abort();
      return;
    }
    reopenWrites();
    releaseShutdown?.();
    releaseShutdown = null;
  };

  const waitThenStep = async (saving: Promise<void>) => {
    waiting = true;
    const failed = deps.watchFailures();
    try {
      await saving;
    } finally {
      waiting = false;
    }
    if (!active) return;
    if (failed()) {
      abort();
      return;
    }
    step();
  };

  const step = () => {
    if (!active || finishing || waiting) return;
    if (deps.getPendingCloseDocId() !== null) return;
    const saving = deps.waitForSaves();
    if (saving) {
      void waitThenStep(saving);
      return;
    }
    const docs = deps.listDocuments();
    if (prompting !== null) {
      const stillDirty = docs.some((doc) => doc.id === prompting && doc.isDirty);
      prompting = null;
      if (stillDirty) {
        abort();
        return;
      }
    }
    const next = docs.find((doc) => doc.isDirty);
    if (next) {
      prompting = next.id;
      deps.setPendingCloseDocId(next.id);
      return;
    }
    void finish();
  };

  return {
    requestQuit: () => {
      if (finishing) return false;
      if (!active) {
        releaseShutdown = deps.claimShutdown();
        if (!releaseShutdown) return true;
      }
      deps.finishPendingInput();
      if (!active) {
        active = true;
        prompting = null;
        deps.setQuitPending(true);
      }
      step();
      return true;
    },
    step,
    get active() { return active; },
  };
}
