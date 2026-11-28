import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import type { OpsDevBridge } from '@/utils/devBridge';
import {
  pick, type Action, type Check, type Lang, type Shot, type Snap, type Step, type Target, type TutorialScript, type Txt,
} from './dsl';

declare global {
  interface Window {
    __OPS__?: OpsDevBridge;
  }
}

export interface RunOptions {
  lang: Lang;
  stagesDir: string;
  captureDir?: string;
  webpQuality?: number;
  debugDir?: string;
}

const CHECK_TIMEOUT = 10_000;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactRe = (s: string) => new RegExp(`^\\s*${escapeRe(s)}\\s*$`);

export function resolveTarget(page: Page, target: Target, lang: Lang): Locator {
  const base = (within?: Target): Page | Locator => (within ? resolveTarget(page, within, lang) : page);
  if ('anchor' in target) return page.locator(`[data-tour-anchor="${target.anchor}"]`).first();
  if ('role' in target) {
    return base(target.within).getByRole(target.role, { name: pick(target.name, lang), exact: target.exact ?? true }).first();
  }
  if ('field' in target) {
    return base(target.within)
      .locator('label, legend, h2, h3, h4, span', { hasText: exactRe(pick(target.field, lang)) })
      .first()
      .locator('xpath=following::*[self::input or self::select or self::textarea or self::button][1]');
  }
  if ('button' in target) {
    return base(target.within)
      .locator('button:visible, [role="menuitem"]:visible, [role="option"]:visible, [role="menuitemradio"]:visible, [role="menuitemcheckbox"]:visible')
      .filter({ hasText: exactRe(pick(target.button, lang)) }).first();
  }
  if ('text' in target) return base(target.within).getByText(pick(target.text, lang), { exact: target.exact ?? true }).first();
  if ('css' in target) return base(target.within).locator(target.css).first();
  if ('taskName' in target) {
    return taskRow(page, pick(target.taskName, lang)).locator('[data-grid-column-id="task.name"]').first();
  }
  if ('cell' in target) return tableCell(page, pick(target.cell.task, lang), pick(target.cell.column, lang));
  return page.getByRole('dialog').last();
}

const xq = (s: string) => (s.includes("'") ? `"${s}"` : `'${s}'`);

function taskRow(page: Page, task: string): Locator {
  return page.locator(`xpath=//*[@role='grid']//*[@role='row'][.//*[@data-grid-column-id='task.name'][normalize-space(.)=${xq(task)}]]`).first();
}

function tableCell(page: Page, task: string, column: string): Locator {
  const col = `//*[@role='grid']//*[@role='columnheader'][normalize-space(.)=${xq(column)}]/@aria-colindex`;
  return page.locator(`xpath=//*[@role='grid']//*[@role='row'][.//*[@data-grid-column-id='task.name'][normalize-space(.)=${xq(task)}]]/*[@role='gridcell'][@aria-colindex=${col}]`).first();
}

async function ribbonItem(page: Page, id: string, label: Txt | undefined, lang: Lang): Promise<Locator> {
  const [tab] = id.split(':');
  const item = page.locator(`[data-tour-anchor="ribbon:${id}"]`).first();
  if (!(await item.isVisible())) {
    await page.locator(`[data-tour-anchor="ribbon-tab:${tab}"]`).click();
  }
  await expect(item, `lintitem ribbon:${id}`).toBeVisible();
  if (label !== undefined) await expect(item, `lintitem ribbon:${id} heet "${pick(label, lang)}"`).toContainText(pick(label, lang));
  return item;
}

async function act(page: Page, action: Action, opts: RunOptions, where: string): Promise<void> {
  const { lang } = opts;
  if ('check' in action) {
    await verify(page, action.check, lang, where);
    return;
  }
  if ('shot' in action) {
    await shoot(page, action.shot, opts, where);
    return;
  }
  if ('download' in action) {
    const pending = page.waitForEvent('download', { timeout: 30_000 });
    await act(page, action.download, opts, where);
    const file = await pending;
    expect(file.suggestedFilename(), `${where}: bestandsnaam van de download`).toBe(pick(action.filename, lang));
    await file.cancel().catch(() => undefined);
    return;
  }
  if ('ribbon' in action) {
    await (await ribbonItem(page, action.ribbon, action.label, lang)).click();
    return;
  }
  if ('tab' in action) {
    const tab = page.locator(`[data-tour-anchor="ribbon-tab:${action.tab}"]`);
    if (action.label !== undefined) await expect(tab).toContainText(pick(action.label, lang));
    await tab.click();
    return;
  }
  if ('click' in action) {
    const el = resolveTarget(page, action.click, lang);
    const opts = { modifiers: action.modifiers, force: action.force };
    if (action.double) await el.dblclick(opts);
    else await el.click(opts);
    return;
  }
  if ('type' in action) {
    await page.keyboard.type(pick(action.type, lang));
    return;
  }
  if ('press' in action) {
    await page.keyboard.press(action.press);
    return;
  }
  if ('fill' in action) {
    await resolveTarget(page, action.fill, lang).fill(pick(action.value, lang));
    return;
  }
  if ('select' in action) {
    const el = resolveTarget(page, action.select, lang);
    const option = pick(action.option, lang);
    if ((await el.evaluate(e => e.tagName)) === 'SELECT') {
      await el.focus();
      await el.selectOption({ label: option });
    } else {
      await el.click();
      const exact = exactRe(option);
      const options = page.locator('[role="option"]:visible');
      await options.filter({ hasText: exact })
        .or(options.filter({ has: page.locator('.ops-select__option-label', { hasText: exact }) }))
        .first().click();
    }
    return;
  }
  if ('date' in action) {
    await resolveTarget(page, action.date, lang).click();
    await page.keyboard.type(pick(action.value, lang).replace(/\D/g, ''));
    return;
  }
  if ('dragBar' in action) {
    await dragBar(page, pick(action.dragBar.from, lang), pick(action.dragBar.to, lang));
    return;
  }
  if ('dragColumnEdge' in action) {
    const head = page.locator('[role="grid"] [role="columnheader"]', { hasText: exactRe(pick(action.dragColumnEdge.column, lang)) }).first();
    const box = await head.locator('.task-grid-resize-handle').boundingBox();
    if (!box) throw new Error(`breedtegreep van kolom ${pick(action.dragColumnEdge.column, lang)} niet in beeld`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + action.dragColumnEdge.dx, y, { steps: 8 });
    await page.mouse.up();
    return;
  }
  if ('expand' in action) {
    const base: Page | Locator = action.within ? resolveTarget(page, action.within, lang) : page;
    const head = base.locator('[aria-expanded]', { hasText: new RegExp(`^\\s*${escapeRe(pick(action.expand, lang))}(?![\\p{L}])`, 'u') }).first();
    if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click();
    await expect(head).toHaveAttribute('aria-expanded', 'true');
    return;
  }
  if ('histogramPick' in action) {
    const name = pick(action.histogramPick, lang);
    const index = (await snapshot(page)).resources.findIndex(r => r.name === name);
    if (index < 0) throw new Error(`resource "${name}" bestaat niet`);
    await page.getByTestId('gantt-histogram-canvas').click({ position: { x: 24, y: 8 + (index + 1) * 18 + 9 } });
    return;
  }
  if ('waitFor' in action) {
    await resolveTarget(page, action.waitFor, lang).waitFor({ state: action.state ?? 'visible' });
  }
}

async function dragBar(page: Page, from: string, to: string): Promise<void> {
  const point = async (name: string) => {
    let p: { x: number; y: number } | null = null;
    await expect.poll(async () => {
      p = await page.evaluate((n) => {
        const ops = window.__OPS__!;
        const task = ops.store.getState().tasks.find(t => t.name === n);
        return task ? ops.gantt.taskBarPoint(task.id, 'body', 'primary') : null;
      }, name);
      return p;
    }, { message: `balk van "${name}" in beeld` }).not.toBeNull();
    return p!;
  };
  const a = await point(from);
  const b = await point(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 });
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}

export async function snapshot(page: Page): Promise<Snap> {
  return page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const byId = new Map(s.tasks.map(t => [t.id, t]));
    const nameOf = (id: string) => byId.get(id)?.name ?? `?${id}`;
    const resName = new Map(s.resources.map(r => [r.id, r.name]));
    const overIds = Object.entries(s.resourceLoadResult?.overallocatedDays ?? {})
      .filter(([, days]) => (days as unknown[]).length > 0).map(([id]) => id);
    const activeBaseline = s.baselines.find(b => b.id === s.activeBaselineId);
    return {
      documents: s.documents.length,
      projectName: s.project.name,
      startDate: s.project.startDate,
      statusDate: s.project.statusDate || null,
      stale: s.scheduleStale,
      calcError: s.cpmResult?.error ?? null,
      tasks: s.tasks.map(t => {
        const hours = t.time.durationUnit === 'hours';
        return {
          name: t.name,
          wbs: t.wbsCode,
          parent: t.parentId ? nameOf(t.parentId) : null,
          summary: t.childIds.length > 0,
          milestone: t.isMilestone,
          milestoneKind: t.milestoneKind ?? null,
          mandatory: !!t.mandatory,
          unit: t.time.durationUnit,
          days: hours ? null : t.time.scheduleDuration,
          minutes: hours ? (t.time.durationMinutes ?? null) : null,
          earlyStart: t.time.earlyStart,
          earlyFinish: t.time.earlyFinish,
          totalFloat: Math.round(t.time.totalFloat * 1000) / 1000,
          critical: t.time.isCritical,
          constraint: t.constraint && t.constraint.type !== 'ASAP' ? `${t.constraint.type} ${t.constraint.date ?? ''}`.trim() : null,
          deadline: t.deadline ?? null,
          completion: Math.round(t.time.completion * 1000) / 1000,
          actualStart: t.time.actualStart ?? null,
          actualFinish: t.time.actualFinish ?? null,
          workRule: t.workRule ? JSON.stringify(t.workRule) : null,
          levelingDelay: t.levelingDelay ?? 0,
        };
      }),
      links: s.sequences.map(q => `${nameOf(q.predecessorId)} → ${nameOf(q.successorId)} ${q.type} ${q.lagMinutes ?? q.lagDays}${q.lagUnit ? ` ${q.lagUnit}` : ''}`).sort(),
      holidays: s.calendar.holidays.map(h => `${h.name} ${h.startDate}..${h.endDate}`).sort(),
      workDays: [...s.calendar.workDays],
      resources: s.resources.map(r => ({ name: r.name, type: r.type, maxUnits: r.maxUnits, unit: r.unitOfMeasure ?? null })),
      assignments: s.assignments.map(a => `${nameOf(a.taskId)} ← ${resName.get(a.resourceId) ?? '?'} × ${a.unitsPerDay}`).sort(),
      baselines: s.baselines.map(b => b.name),
      activeBaseline: activeBaseline?.name ?? null,
      overallocated: overIds.map(id => resName.get(id) ?? id).sort(),
      ui: {
        tab: s.ui.activeRibbonTab,

        showTaskTypes: s.ui.showTaskTypes,
        showHistogram: s.ui.showHistogram,
        histogramResource: s.view.histogramResourceId ? (resName.get(s.view.histogramResourceId) ?? null) : null,
        selected: s.selectedTaskIds.map(nameOf),
        dialogs: document.querySelectorAll('[role="dialog"]').length,
      },
    };
  });
}

async function verify(page: Page, check: Check, lang: Lang, where: string): Promise<void> {
  if ('state' in check) {
    let problems: string[] = [];
    try {
      await expect.poll(async () => {
        problems = check.state(await snapshot(page), lang);
        return problems.length;
      }, { timeout: CHECK_TIMEOUT }).toBe(0);
    } catch {
      throw new Error(`${where}: toestand klopt niet:\n  - ${problems.join('\n  - ')}`);
    }
    return;
  }
  if ('see' in check) {
    await expect(resolveTarget(page, check.see, lang), `${where}: tekst "${pick(check.text, lang)}"`)
      .toContainText(pick(check.text, lang), { timeout: CHECK_TIMEOUT });
    return;
  }
  if ('notSee' in check) {
    await expect(resolveTarget(page, check.notSee, lang), `${where}: geen tekst "${pick(check.text, lang)}"`)
      .not.toContainText(pick(check.text, lang), { timeout: CHECK_TIMEOUT });
    return;
  }
  if ('visible' in check) {
    await expect(resolveTarget(page, check.visible, lang), `${where}: zichtbaar`).toBeVisible({ timeout: CHECK_TIMEOUT });
    return;
  }
  await expect(resolveTarget(page, check.gone, lang), `${where}: weg`).toHaveCount(0, { timeout: CHECK_TIMEOUT });
}

export async function openStage(page: Page, stagesDir: string, lang: Lang, stage: string): Promise<void> {
  const content = readFileSync(join(stagesDir, lang, `${stage}.ifc`), 'utf8');
  const ok = await page.evaluate(([c, n]) => window.__OPS__!.store.getState().openExampleFromString(c, n), [content, `${stage}.ifc`] as const);
  if (!ok) throw new Error(`stand ${lang}/${stage} kon niet geopend worden`);
}

async function capture(page: Page, shot: Shot, lang: Lang, dir: string, quality: number): Promise<void> {
  const targets = Array.isArray(shot.of) ? shot.of : [shot.of];
  const boxes = [];
  for (const t of targets) {
    const loc = resolveTarget(page, t, lang);
    await expect(loc, `beeld ${shot.name}: element in beeld`).toBeVisible();
    const b = await loc.boundingBox();
    if (!b) throw new Error(`beeld ${shot.name}: geen omhullende`);
    boxes.push(b);
  }
  const pad = shot.pad ?? 8;
  const vp = page.viewportSize()!;
  let x = Math.max(0, Math.min(...boxes.map(b => b.x)) - pad);
  let y = Math.max(0, Math.min(...boxes.map(b => b.y)) - pad);
  let right = Math.min(vp.width, Math.max(...boxes.map(b => b.x + b.width)) + pad);
  let bottom = Math.min(vp.height, Math.max(...boxes.map(b => b.y + b.height)) + pad);
  if (shot.maxWidth) right = Math.min(right, x + shot.maxWidth);
  if (shot.maxHeight) bottom = Math.min(bottom, y + shot.maxHeight);
  x = Math.round(x); y = Math.round(y);
  const clip = { x, y, width: Math.round(right) - x, height: Math.round(bottom) - y };
  if (!shot.keepToasts) {
    const toasts = page.locator('.ops-toast-stack > *');
    for (let i = 0; i < 10 && (await toasts.count()) > 0; i++) {
      await toasts.first().locator('[data-ops-toast-close]').click();
    }
    await expect(toasts).toHaveCount(0);
  }
  await page.mouse.move(vp.width - 2, 2);
  const png = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
  const webp = await toWebp(page, png, quality);
  mkdirSync(join(dir, lang), { recursive: true });
  writeFileSync(join(dir, lang, `${shot.name}.webp`), webp);
}

async function toWebp(page: Page, png: Buffer, quality: number): Promise<Buffer> {
  const scratch = await page.context().newPage();
  try {
    const b64 = await scratch.evaluate(async ([data, q]) => {
      const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality: q });
      if (blob.type !== 'image/webp') throw new Error(`geen WebP-encoder (kreeg ${blob.type})`);
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(s);
    }, [png.toString('base64'), quality] as const);
    return Buffer.from(b64, 'base64');
  } finally {
    await scratch.close();
  }
}

export function documentFacts(s: Snap): unknown {
  return {
    projectName: s.projectName, startDate: s.startDate, statusDate: s.statusDate,
    tasks: [...s.tasks].sort((a, b) => a.wbs.localeCompare(b.wbs, undefined, { numeric: true }) || a.name.localeCompare(b.name)),
    links: s.links, holidays: s.holidays, workDays: s.workDays,
    resources: s.resources, assignments: s.assignments, baselines: s.baselines, activeBaseline: s.activeBaseline,
    overallocated: s.overallocated,
  };
}

async function shoot(page: Page, shot: Shot, opts: RunOptions, where: string): Promise<void> {
  const before = page.viewportSize()!;
  if (shot.viewport) {
    await page.setViewportSize(shot.viewport);
    await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  }
  try {
    if (opts.captureDir) {
      await capture(page, shot, opts.lang, opts.captureDir, opts.webpQuality ?? 0.9);
      return;
    }
    for (const t of Array.isArray(shot.of) ? shot.of : [shot.of]) {
      await expect(resolveTarget(page, t, opts.lang), `${where}: onderwerp van beeld ${shot.name}`).toBeVisible();
    }
  } finally {
    if (shot.viewport) await page.setViewportSize(before);
  }
}

async function runActions(page: Page, actions: Action[], opts: RunOptions, where: string, kind: string): Promise<void> {
  for (const [i, action] of actions.entries()) {
    try {
      await act(page, action, opts, where);
    } catch (error) {
      throw new Error(`${where}, ${kind} ${i + 1} ${JSON.stringify(action)}: ${(error as Error).message}`);
    }
  }
}

export async function runStep(page: Page, script: TutorialScript, step: Step, index: number, opts: RunOptions): Promise<void> {
  const where = `${script.id} [${opts.lang}] stap ${index + 1} (${step.id})`;
  await runActions(page, step.do, opts, where, 'handeling');
  for (const check of step.expect) await verify(page, check, opts.lang, where);
  await runActions(page, step.frame ?? [], opts, where, 'beeldhandeling');
  for (const shot of step.shots ?? []) await shoot(page, shot, opts, where);
  if (opts.debugDir) {
    mkdirSync(join(opts.debugDir, opts.lang), { recursive: true });
    await page.screenshot({ path: join(opts.debugDir, opts.lang, `${script.id}-${String(index + 1).padStart(2, '0')}-${step.id}.png`) });
  }
}

export async function runTutorial(page: Page, script: TutorialScript, opts: RunOptions): Promise<void> {
  if (script.start) await openStage(page, opts.stagesDir, opts.lang, script.start);
  for (const [i, step] of script.steps.entries()) await runStep(page, script, step, i, opts);

  const mine = await snapshot(page);
  expect(mine.stale, `${script.id} [${opts.lang}]: berekend aan het eind`).toBe(false);
  await openStage(page, opts.stagesDir, opts.lang, script.end);
  const reference = await snapshot(page);
  expect(documentFacts(mine), `${script.id} [${opts.lang}]: eindigt exact op ${script.end}`).toEqual(documentFacts(reference));
}
