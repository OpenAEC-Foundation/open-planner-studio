// Het tutorialproject *Aanbouw woning* / *House extension*: de namen zoals de tutorial ze laat typen (gelijk
// aan `scripts/tutorial-project.ts`; wijkt er één af, dan faalt de vergelijking met de eindstand).
import { l, type L, type Lang, type Snap } from './dsl';

export const PROJECT = l('Aanbouw woning', 'House extension');

export const PHASES = {
  prep: l('Voorbereiding', 'Preparation'),
  foundation: l('Fundering', 'Foundations'),
  shell: l('Ruwbouw', 'Shell'),
  finishing: l('Afbouw', 'Finishing'),
};

export const T = {
  start: l('Start bouw', 'Start of construction'),
  site: l('Bouwplaats inrichten', 'Set up site'),
  garden: l('Tuin en bestrating verwijderen', 'Clear garden and paving'),
  setout: l('Aanbouw uitzetten', 'Set out the extension'),
  excavate: l('Funderingssleuf ontgraven', 'Excavate foundation trench'),
  rebar: l('Wapening en bekisting fundering', 'Foundation formwork and reinforcement'),
  inspection: l('Inspectie wapening', 'Reinforcement inspection'),
  pour: l('Fundering storten', 'Pour foundation'),
  foundBrick: l('Funderingsmetselwerk', 'Foundation brickwork'),
  floor: l('Kanaalplaatvloer leggen', 'Lay hollow-core floor'),
  innerLeaf: l('Binnenspouwblad metselen', 'Build inner cavity leaf'),
  outerLeaf: l('Buitenspouwblad metselen', 'Build outer cavity leaf'),
  roofElements: l('Dakelementen plaatsen', 'Place roof elements'),
  roofing: l('Dakbedekking aanbrengen', 'Apply roofing'),
  frames: l('Kozijnen plaatsen', 'Install window frames'),
  breakThrough: l('Achtergevel doorbreken', 'Break through rear wall'),
  services: l('Installaties aanleggen', 'Install building services'),
  plaster: l('Stucwerk', 'Plastering'),
  screed: l('Dekvloer aanbrengen', 'Lay floor screed'),
  tiling: l('Tegelwerk', 'Tiling'),
  painting: l('Schilderwerk', 'Painting'),
  cleaning: l('Opleverpunten en schoonmaken', 'Snagging and cleaning'),
  handover: l('Oplevering', 'Handover'),
};

export const R = {
  crew: l('Timmerploeg', 'Carpentry crew'),
  bricklayer: l('Metselaar', 'Bricklayer'),
  crane: l('Mobiele kraan', 'Mobile crane'),
  plasterer: l('Stukadoor', 'Plasterer'),
  concrete: l('Beton', 'Concrete'),
};

export interface TaskExpect {
  milestone?: boolean;
  kind?: 'START' | 'FINISH';
  wbs?: string;
  parent?: L | null;
  days?: number;
  minutes?: number;
  earlyStart?: string;
  earlyFinish?: string;
  totalFloat?: number;
  critical?: boolean;
  constraint?: string | null;
  deadline?: string | null;
  completion?: number;
  actualStart?: string | null;
  actualFinish?: string | null;
}

/** Afwijkingen van één taak ten opzichte van wat de tutorial zegt (lege lijst = in orde). */
export function taskIs(s: Snap, lang: Lang, name: L, want: TaskExpect): string[] {
  const t = s.tasks.find(x => x.name === name[lang]);
  if (!t) return [`taak "${name[lang]}" ontbreekt`];
  const out: string[] = [];
  const cmp = (field: string, got: unknown, exp: unknown) => {
    if (exp !== undefined && got !== exp) out.push(`${name[lang]}: ${field} ${JSON.stringify(got)}, verwacht ${JSON.stringify(exp)}`);
  };
  cmp('mijlpaal', t.milestone, want.milestone);
  cmp('soort mijlpaal', t.milestoneKind, want.kind);
  cmp('WBS', t.wbs, want.wbs);
  cmp('fase', t.parent, want.parent === undefined ? undefined : want.parent === null ? null : want.parent[lang]);
  cmp('duur (werkdagen)', t.days, want.days);
  cmp('duur (minuten)', t.minutes, want.minutes);
  cmp('vroegste start', t.earlyStart, want.earlyStart);
  cmp('vroegste einde', t.earlyFinish, want.earlyFinish);
  cmp('totale speling', t.totalFloat, want.totalFloat);
  cmp('kritiek', t.critical, want.critical);
  cmp('constraint', t.constraint, want.constraint);
  cmp('deadline', t.deadline, want.deadline);
  cmp('voortgang', t.completion, want.completion);
  cmp('werkelijke start', t.actualStart, want.actualStart);
  cmp('werkelijk einde', t.actualFinish, want.actualFinish);
  return out;
}
