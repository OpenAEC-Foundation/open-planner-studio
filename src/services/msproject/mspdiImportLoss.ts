import { directChildText, toInt } from '@/services/xmlDom';
import { DAY_TIME_ANCHOR } from '@/services/xmlInterchange';
import { emptyMsProjectImportReport, type MsProjectImportReport } from '@/services/importTypes';

function directChildren(parent: Element, tagName: string): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName === tagName || child.tagName === tagName) out.push(child);
  }
  return out;
}

function directChild(parent: Element | undefined, tagName: string): Element | undefined {
  return parent ? directChildren(parent, tagName)[0] : undefined;
}

const nonZero = (text: string): boolean => {
  const n = Number.parseFloat(text);
  return Number.isFinite(n) && n !== 0;
};

const nonZeroDuration = (text: string): boolean => /[1-9]/.test(text);

export function mspdiWallClock(raw: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(raw.trim());
  if (!m) return undefined;
  const [, y, mo, d, hh = DAY_TIME_ANCHOR.slice(0, 2), mm = DAY_TIME_ANCHOR.slice(3, 5)] = m;
  const day = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (day.getUTCFullYear() !== Number(y) || day.getUTCMonth() !== Number(mo) - 1 || day.getUTCDate() !== Number(d)) return undefined;
  if (Number(hh) > 23 || Number(mm) > 59) return undefined;
  return `${y}-${mo}-${d}T${hh}:${mm}`;
}

export type ConsumedExtendedAttribute = (fieldId: string, value: string) => boolean;

export function scanMspdiImportLoss(root: Element, isConsumed: ConsumedExtendedAttribute): MsProjectImportReport {
  const report = emptyMsProjectImportReport('mspdi');
  const customFieldIds = new Set<string>();
  const baselineNumbers = new Set<number>();

  const collectBaselines = (el: Element) => {
    let workCostLost = false;
    for (const baseline of directChildren(el, 'Baseline')) {
      const number = Number.parseInt(directChildText(baseline, 'Number'), 10);
      if (!Number.isFinite(number) || number < 0 || number > 10) continue;
      const hasDates = ['Start', 'Finish'].some(tag => directChildText(baseline, tag) !== '');
      const hasAmounts = nonZeroDuration(directChildText(baseline, 'Duration'))
        || nonZeroDuration(directChildText(baseline, 'Work'))
        || nonZero(directChildText(baseline, 'Cost'));
      if (number === 0) {
        const workCost = nonZeroDuration(directChildText(baseline, 'Work')) || nonZero(directChildText(baseline, 'Cost'));
        if (workCost) workCostLost = true;
      } else if (hasDates || hasAmounts) {
        baselineNumbers.add(number);
      }
    }
    if (workCostLost) report.baselineWorkCost++;
  };

  const baseline0Dates = (el: Element): { start?: string; finish?: string } | undefined => {
    const baseline = directChildren(el, 'Baseline').find(b => toInt(directChildText(b, 'Number'), -1) === 0);
    if (!baseline) return undefined;
    const at = (tag: string) => mspdiWallClock(directChildText(baseline, tag));
    return { start: at('Start'), finish: at('Finish') };
  };
  const taskBaseline0 = new Map<number, { start?: string; finish?: string }>();

  const hasHyperlink = (el: Element) => ['Hyperlink', 'HyperlinkAddress', 'HyperlinkSubAddress']
    .some(tag => directChildText(el, tag) !== '');
  const collectExtendedAttributes = (el: Element) => {
    for (const attr of directChildren(el, 'ExtendedAttribute')) {
      const fieldId = directChildText(attr, 'FieldID');
      const value = directChildText(attr, 'Value');
      const lookup = directChildText(attr, 'ValueID') !== '' || directChildText(attr, 'ValueGUID') !== '';
      if (!fieldId || (value === '' && !lookup) || isConsumed(fieldId, value)) continue;
      customFieldIds.add(fieldId);
    }
    for (const code of directChildren(el, 'OutlineCode')) {
      const fieldId = directChildText(code, 'FieldID');
      if (!fieldId || (directChildText(code, 'ValueID') === '' && directChildText(code, 'ValueGUID') === '')) continue;
      customFieldIds.add(`outline:${fieldId}`);
    }
  };

  const tasks = directChildren(directChild(root, 'Tasks') ?? root, 'Task');
  for (const task of tasks) {
    const uid = Number.parseInt(directChildText(task, 'UID'), 10);
    if (!Number.isFinite(uid) || uid < 0) continue;
    if (uid === 0 && directChildText(task, 'OutlineLevel') === '0') continue;

    collectBaselines(task);
    const taskDates = baseline0Dates(task);
    if (taskDates) taskBaseline0.set(uid, taskDates);
    collectExtendedAttributes(task);
    if (hasHyperlink(task)) report.hyperlinks++;
    if (nonZero(directChildText(task, 'FixedCost'))) report.fixedCosts++;
    if (directChildText(task, 'IsSubproject') === '1') report.subprojects++;
    if (directChildText(task, 'ExternalTask') === '1') report.externalTasks++;
    if (directChildText(task, 'Manual') === '1') report.manualTasks++;
    if (nonZero(directChildText(task, 'LevelingDelay'))) report.levelingDelays++;
    if (directChildText(task, 'Active') === '0') report.inactiveTasks++;
  }

  for (const resource of directChildren(directChild(root, 'Resources') ?? root, 'Resource')) {
    const uid = Number.parseInt(directChildText(resource, 'UID'), 10);
    if (!Number.isFinite(uid) || uid < 0) continue;
    if (directChildText(resource, 'Notes') !== '') report.notes++;
    collectBaselines(resource);
    collectExtendedAttributes(resource);
    if (hasHyperlink(resource)) report.hyperlinks++;
    const rates = directChildren(directChild(resource, 'Rates') ?? resource, 'Rate');
    const tableA = rates.filter(rate => (directChildText(rate, 'RateTable') || '0') === '0');
    const otherTables = rates.filter(rate => (directChildText(rate, 'RateTable') || '0') !== '0');
    const rateLost = nonZero(directChildText(resource, 'OvertimeRate'))
      || nonZero(directChildText(resource, 'CostPerUse'))
      || tableA.length > 1
      || tableA.some(rate => ['OvertimeRate', 'CostPerUse']
        .some(tag => nonZero(directChildText(rate, tag))))
      || otherTables.some(rate => ['StandardRate', 'OvertimeRate', 'CostPerUse']
        .some(tag => nonZero(directChildText(rate, tag))));
    if (rateLost) report.resourceRates++;
  }

  for (const assignment of directChildren(directChild(root, 'Assignments') ?? root, 'Assignment')) {
    if (directChildText(assignment, 'Notes') !== '') report.notes++;
    collectBaselines(assignment);
    const own = baseline0Dates(assignment);
    if (own) {
      const ofTask = taskBaseline0.get(toInt(directChildText(assignment, 'TaskUID'), -1));
      const differs = (['start', 'finish'] as const)
        .some(key => own[key] !== undefined && own[key] !== ofTask?.[key]);
      if (differs) report.assignmentBaselineDates++;
    }
    collectExtendedAttributes(assignment);
    if (hasHyperlink(assignment)) report.hyperlinks++;
  }

  report.baselines = baselineNumbers.size;
  report.customFields = customFieldIds.size;
  return report;
}
