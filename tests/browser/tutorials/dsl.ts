import type { StageId } from '../../../scripts/tutorial-project';

export type Lang = 'nl' | 'en';
export const LANGS: readonly Lang[] = ['nl', 'en'];

export interface L { nl: string; en: string }
export const l = (nl: string, en: string): L => ({ nl, en });
export const same = (s: string): L => ({ nl: s, en: s });
export type Txt = L | string;
export const pick = (t: Txt, lang: Lang): string => (typeof t === 'string' ? t : t[lang]);

export type Target =
  | { anchor: string }
  | { role: 'button' | 'option' | 'tab' | 'checkbox' | 'textbox' | 'combobox' | 'menuitem' | 'menuitemcheckbox' | 'link' | 'dialog' | 'row' | 'radio' | 'spinbutton'; name: Txt; exact?: boolean; within?: Target }
  | { field: Txt; within?: Target }
  | { button: Txt; within?: Target }
  | { text: Txt; within?: Target; exact?: boolean }
  | { css: string; within?: Target }
  | { taskName: Txt }
  | { cell: { task: Txt; column: Txt } }
  | { dialog: true };

export type Action =
  | { ribbon: `${string}:${string}`; label?: Txt }
  | { tab: string; label?: Txt }
  | { click: Target; modifiers?: ('Control' | 'Shift' | 'Alt')[]; double?: boolean; force?: boolean }
  | { type: Txt }
  | { press: string }
  | { fill: Target; value: Txt }
  | { select: Target; option: Txt }
  | { date: Target; value: Txt }
  | { dragBar: { from: Txt; to: Txt } }
  | { dragColumnEdge: { column: Txt; dx: number } }
  | { expand: Txt; within?: Target }
  | { histogramPick: Txt }
  | { waitFor: Target; state?: 'visible' | 'hidden' }
  | { download: Action; filename: Txt }
  | { check: Check }
  | { shot: Shot };

export interface SnapTask {
  name: string;
  wbs: string;
  parent: string | null;
  summary: boolean;
  milestone: boolean;
  milestoneKind: string | null;
  mandatory: boolean;
  unit: string;
  days: number | null;
  minutes: number | null;
  earlyStart: string;
  earlyFinish: string;
  totalFloat: number;
  critical: boolean;
  constraint: string | null;
  deadline: string | null;
  completion: number;
  actualStart: string | null;
  actualFinish: string | null;
  workRule: string | null;
  levelingDelay: number;
}

export interface Snap {
  documents: number;
  projectName: string;
  startDate: string;
  statusDate: string | null;
  stale: boolean;
  calcError: string | null;
  tasks: SnapTask[];
  links: string[];
  holidays: string[];
  workDays: number[];
  resources: { name: string; type: string; maxUnits: number; unit: string | null }[];
  assignments: string[];
  baselines: string[];
  activeBaseline: string | null;
  overallocated: string[];
  ui: {
    tab: string;

    showTaskTypes: boolean;
    showHistogram: boolean;
    histogramResource: string | null;
    selected: string[];
    dialogs: number;
  };
}

export type StateCheck = (s: Snap, lang: Lang) => string[];

export type Check =
  | { state: StateCheck }
  | { see: Target; text: Txt }
  | { notSee: Target; text: Txt }
  | { visible: Target }
  | { gone: Target };

export interface Shot {
  name: string;
  of: Target | Target[];
  pad?: number;
  maxWidth?: number;
  maxHeight?: number;
  viewport?: { width: number; height: number };
  keepToasts?: boolean;
}

export interface Step {
  id: string;
  do: Action[];
  expect: Check[];
  frame?: Action[];
  shots?: Shot[];
}

export interface TutorialScript {
  id: string;
  start: StageId | null;
  end: StageId;
  steps: Step[];
}
