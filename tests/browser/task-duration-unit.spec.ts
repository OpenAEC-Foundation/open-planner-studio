import type { Page } from '@playwright/test';
import { expect, test, waitForOps } from './fixtures/ops';

async function seedDurationTask(page: Page, unit: 'days' | 'hours' = 'days', amount = 2): Promise<string> {
  return page.evaluate(({ nativeUnit, nativeAmount }) => {
    const state = window.__OPS__!.store.getState();
    state.setUI({

      allowMixedDayHour: true,
      showPropertiesPanel: true,
      rightPanelCollapsed: false,
    });
    state.setCalendar({
      ...state.calendar,
      workDays: [1, 2, 3, 4, 5],
      hoursPerDay: 8,
      workStartHour: 8,
      workEndHour: 16,
      workTime: {
        byWeekday: {
          1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }],
          3: [{ start: 480, end: 960 }], 4: [{ start: 480, end: 960 }],
          5: [{ start: 480, end: 960 }], 6: [], 7: [],
        },
      },
    });
    const id = state.addTask({ name: 'Duurtaak' });
    const current = window.__OPS__!.store.getState().tasks.find(task => task.id === id)!;
    state.updateTask(id, {
      time: {
        ...current.time,
        durationUnit: nativeUnit,
        scheduleDuration: nativeUnit === 'days' ? nativeAmount : nativeAmount / 8,
        durationMinutes: nativeUnit === 'hours' ? nativeAmount * 60 : undefined,
        scheduleStart: '2026-09-07',
        earlyStart: '2026-09-07T08:00',
      },
    });
    state.selectTask(id);
    return id;
  }, { nativeUnit: unit, nativeAmount: amount });
}

async function openDialog(page: Page, taskId: string): Promise<void> {
  await page.evaluate((id) => {
    window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: id });
  }, taskId);
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('dialoog en eigenschappenpaneel normaliseren duur zonder redundante suffix naast de unitkiezer', async ({ page, ops: _ops }) => {
  const taskId = await seedDurationTask(page, 'days', 4);
  const panelDuration = page.locator('[data-ops-task-duration]').first();
  await expect(panelDuration).toBeVisible();
  await expect(panelDuration.locator('[data-ops-duration-value]')).toHaveValue('4');
  // knownbugs #90: één klik en typen vervangt de oude waarde, zonder Ctrl+A.
  await panelDuration.locator('[data-ops-duration-value]').click();
  await page.keyboard.type('12 hours');
  await panelDuration.locator('[data-ops-duration-value]').blur();

  await expect.poll(() => page.evaluate((id) => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id)!;
    return { unit: task.time.durationUnit, minutes: task.time.durationMinutes };
  }, taskId)).toEqual({ unit: 'hours', minutes: 720 });
  await expect(panelDuration.locator('[data-ops-duration-value]')).toHaveValue('12');

  await openDialog(page, taskId);
  const dialogDuration = page.getByRole('dialog').locator('[data-ops-task-duration]');
  await expect(dialogDuration.locator('[data-ops-duration-value]')).toHaveValue('12');
  await expect(dialogDuration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ })).toHaveText(/^(Hours|Uren)$/);
  await dialogDuration.locator('[data-ops-duration-value]').click();
  await page.keyboard.type('4 days');
  await dialogDuration.locator('[data-ops-duration-value]').blur();
  await expect(dialogDuration.locator('[data-ops-duration-value]')).toHaveValue('4');
  await expect(dialogDuration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ })).toHaveText(/^(Days|Dagen)$/);
  await page.getByRole('dialog').locator('[data-ops-task-save]').click();

  await expect.poll(() => page.evaluate((id) => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id)!;
    return { unit: task.time.durationUnit, days: task.time.scheduleDuration, minutes: task.time.durationMinutes };
  }, taskId)).toEqual({ unit: 'days', days: 4, minutes: undefined });
});

test('duurwaarde blijft de brede primaire invoer met controls op normale, gelijke hoogte', async ({ page, ops: _ops }) => {
  const taskId = await seedDurationTask(page);
  const panelDuration = page.locator('[data-ops-task-duration]').first();

  const panelGeometry = await panelDuration.evaluate((field) => {
    const input = field.querySelector<HTMLElement>('[data-ops-duration-value]')!;
    const unit = field.querySelector<HTMLElement>('[aria-label="Duration unit"]')!;
    const info = field.querySelector<HTMLElement>('[data-ops-duration-info]')!;
    const rect = (element: HTMLElement) => element.getBoundingClientRect();
    return {
      input: { width: rect(input).width, height: rect(input).height },
      unit: { width: rect(unit).width, height: rect(unit).height },
      info: { width: rect(info).width, height: rect(info).height },
    };
  });

  expect(panelGeometry.input.width).toBeGreaterThan(panelGeometry.unit.width);
  expect(panelGeometry.input.height).toBeGreaterThanOrEqual(28);
  expect(panelGeometry.input.height).toBeLessThanOrEqual(30);
  expect(Math.abs(panelGeometry.input.height - panelGeometry.unit.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(panelGeometry.info.height - panelGeometry.unit.height)).toBeLessThanOrEqual(2);

  await openDialog(page, taskId);
  const dialogDuration = page.getByRole('dialog').locator('[data-ops-task-duration]');
  const dialogGeometry = await dialogDuration.evaluate((field) => {
    const input = field.querySelector<HTMLElement>('[data-ops-duration-value]')!;
    const unit = field.querySelector<HTMLElement>('[aria-label="Duration unit"]')!;
    const info = field.querySelector<HTMLElement>('[data-ops-duration-info]')!;
    const rect = (element: HTMLElement) => element.getBoundingClientRect();
    return {
      input: { width: rect(input).width, height: rect(input).height },
      unit: { width: rect(unit).width, height: rect(unit).height },
      info: { width: rect(info).width, height: rect(info).height },
    };
  });

  expect(dialogGeometry.input.width).toBeGreaterThan(dialogGeometry.unit.width);
  expect(dialogGeometry.input.height).toBeGreaterThanOrEqual(28);
  expect(dialogGeometry.input.height).toBeLessThanOrEqual(30);
  expect(Math.abs(dialogGeometry.input.height - dialogGeometry.unit.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(dialogGeometry.info.height - dialogGeometry.unit.height)).toBeLessThanOrEqual(2);
});

test('de gemengde voorkeur regelt beide gedeelde duurvelden zonder taakdata te herschrijven', async ({ page, ops: _ops }) => {
  const taskId = await seedDurationTask(page, 'hours', 12);
  const panelDuration = page.locator('[data-ops-task-duration]').first();
  await openDialog(page, taskId);
  const dialogDuration = page.getByRole('dialog').locator('[data-ops-task-duration]');

  const assertControls = async (visible: boolean) => {
    for (const field of [panelDuration, dialogDuration]) {
      const unit = field.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ });
      const info = field.locator('[data-ops-duration-info]');
      if (visible) {
        await expect(unit).toBeVisible();
        await expect(info).toBeVisible();
      } else {
        await expect(unit).toHaveCount(0);
        await expect(info).toHaveCount(0);
        const geometry = await field.locator('[data-ops-duration-value]').evaluate((input) => {
          const rect = input.getBoundingClientRect();
          return { height: rect.height, width: rect.width };
        });
        expect(geometry.height).toBeGreaterThanOrEqual(28);
        expect(geometry.height).toBeLessThanOrEqual(30);
        expect(geometry.width).toBeGreaterThan(150);
      }
    }
  };

  // De gemengde voorkeur bepaalt uitsluitend de eenheidsbediening.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ allowMixedDayHour: true }));
  await assertControls(true);
  await expect(panelDuration.locator('[data-ops-duration-value]')).toBeEnabled();

  // Uren aan maar gemengd uit verbergt uitsluitend de eenheidsbediening. De bestaande urentaak
  // blijft intact en de numerieke waarde is weer bewerkbaar.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ allowMixedDayHour: false }));
  await assertControls(false);
  await expect(panelDuration.locator('[data-ops-duration-value]')).toBeEnabled();
  await expect.poll(() => page.evaluate((id) => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id)!;
    return { unit: task.time.durationUnit, minutes: task.time.durationMinutes };
  }, taskId)).toEqual({ unit: 'hours', minutes: 720 });

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ allowMixedDayHour: true }));
  await assertControls(true);
});

test('gemengde dag/uur-planning staat onder Duurweergave en blijft bewaard', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    localStorage.setItem('ops-allowMixedDayHour', 'false');
    window.__OPS__!.store.getState().setUI({ allowMixedDayHour: false, showSettingsDialog: true });
  });
  const settings = page.getByRole('dialog', { name: /^(App settings|App-instellingen)$/ });
  await settings.getByRole('button', { name: /^(Appearance|Weergave)$/, exact: true }).click();
  const mixed = settings.getByLabel(/^(Allow mixed day\/hour planning|Gemengde dag\/uur-planning toestaan)$/);
  await expect(mixed).not.toBeChecked();
  await mixed.check();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ops-allowMixedDayHour'))).toBe('true');

  await page.reload();
  await waitForOps(page);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.allowMixedDayHour)).toBe(true);
});

test('duurinfo is met hover en toetsenbordfocus bereikbaar en legt het vaste contract uit', async ({ page, ops: _ops }) => {
  const taskId = await seedDurationTask(page);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ rightPanelWidth: 200 }));
  const info = page.locator('[data-ops-duration-info]').first();
  await info.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(/(unit belongs to this task|eenheid hoort bij deze taak)/i);
  await expect(tooltip).toContainText(/(different calendar|andere kalender)/i);
  const geometry = await page.evaluate(() => {
    const infoButton = document.querySelector<HTMLElement>('[data-ops-duration-info]')!;
    const tooltipElement = document.querySelector<HTMLElement>('[role="tooltip"]')!;
    const gantt = document.querySelector<HTMLElement>('[data-testid="gantt-primary-canvas"]')!;
    const infoRect = infoButton.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const ganttRect = gantt.getBoundingClientRect();
    const overlapLeft = Math.max(tooltipRect.left, ganttRect.left);
    const overlapRight = Math.min(tooltipRect.right, ganttRect.right);
    const overlapTop = Math.max(tooltipRect.top, ganttRect.top);
    const overlapBottom = Math.min(tooltipRect.bottom, ganttRect.bottom);
    const x = (overlapLeft + overlapRight) / 2;
    const y = (overlapTop + overlapBottom) / 2;
    return {
      isBodyPortal: tooltipElement.parentElement === document.body,
      leftOfInfo: tooltipRect.right <= infoRect.left - 4,
      inViewport: tooltipRect.left >= 0 && tooltipRect.right <= window.innerWidth && tooltipRect.top >= 0 && tooltipRect.bottom <= window.innerHeight,
      overlapsGantt: overlapLeft < overlapRight && overlapTop < overlapBottom,
      onTopAtOverlap: tooltipElement.contains(document.elementFromPoint(x, y)),
    };
  });
  expect(geometry).toEqual({
    isBodyPortal: true,
    leftOfInfo: true,
    inViewport: true,
    overlapsGantt: true,
    onTopAtOverlap: true,
  });

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ allowMixedDayHour: false }));
  await expect(tooltip).toBeHidden();
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ allowMixedDayHour: true }));
  await expect(tooltip).toBeHidden();

  await page.mouse.move(1, 1);
  await info.hover();
  await expect(tooltip).toBeVisible();
  await page.mouse.move(1, 1);
  await expect(tooltip).toBeHidden();
  await info.focus();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(/(days count working days|dagen tellen werkdagen)/i);
  await expect(tooltip).toContainText(/(hours count working hours|uren tellen werkuren)/i);

  // De dialoog gebruikt hetzelfde veld, maar krijgt een eigen DOM-insertie en focusketen.
  await openDialog(page, taskId);
  const dialogInfo = page.getByRole('dialog').locator('[data-ops-duration-info]');
  await dialogInfo.hover();
  await expect(tooltip).toBeVisible();
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ allowMixedDayHour: false }));
  await expect(tooltip).toBeHidden();
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ allowMixedDayHour: true }));
  await expect(tooltip).toBeHidden();
  await page.mouse.move(1, 1);
  await dialogInfo.hover();
  await expect(tooltip).toBeVisible();
  await page.mouse.move(1, 1);
  await dialogInfo.focus();
  await expect(tooltip).toBeVisible();
});

test('scalaire standaardkalender converteert naar uren met middagpauze; ongeldige data blokkeert veilig', async ({ page, ops: _ops }) => {
  const dayTaskId = await seedDurationTask(page, 'days', 2);
  await page.evaluate(() => {
    const state = window.__OPS__!.store.getState();
    state.setCalendar({ ...state.calendar, workStartHour: 7, workEndHour: 16, hoursPerDay: 8, workTime: undefined });
  });
  const duration = page.locator('[data-ops-task-duration]').first();
  await duration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ }).click();
  await page.getByRole('option', { name: /^(Hours|Uren)$/ }).click();
  // De keuze geldt meteen: geen voorstel om doorheen te klikken.
  await expect(duration.locator('[data-ops-duration-value]')).toHaveValue('16');
  await expect(duration.locator('[data-ops-duration-message]')).toBeHidden();
  await duration.locator('[data-ops-duration-value]').fill('12h');
  await duration.locator('[data-ops-duration-value]').blur();
  await expect.poll(() => page.evaluate((id) => {
    const state = window.__OPS__!.store.getState();
    state.runCPM();
    const task = state.tasks.find(candidate => candidate.id === id)!;
    return { unit: task.time.durationUnit, minutes: task.time.durationMinutes, finish: task.time.earlyFinish };
  }, dayTaskId)).toEqual({ unit: 'hours', minutes: 720, finish: '2026-09-08T12:00' });

  // N0: kalenderwissel bewaart de oorspronkelijke start 08:00. Door de afgeleide
  // pauze 12:00–13:00 eindigen acht werkuren dinsdag 08:00.
  await duration.locator('[data-ops-duration-value]').fill('8h');
  await duration.locator('[data-ops-duration-value]').blur();
  await expect.poll(() => page.evaluate((id) => {
    const state = window.__OPS__!.store.getState();
    state.runCPM();
    return state.tasks.find(candidate => candidate.id === id)!.time.earlyFinish;
  }, dayTaskId)).toBe('2026-09-08T08:00');

  await page.evaluate(() => {
    const state = window.__OPS__!.store.getState();
    state.setCalendar({ ...state.calendar, workDays: [], workTime: undefined });
  });
  await duration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ }).click();
  await page.getByRole('option', { name: /^(Days|Dagen)$/ }).click();
  await expect(duration.locator('[data-ops-duration-not-exact]')).toBeVisible();

  // Sinds de dagenmaat een breuk mag hebben (spec "alleen uren" B1, §3.2) is 12 u op een werkdag van 8 u
  // exact 1,5 d: de wissel houdt het eindmoment en meldt niets.
  const hourTaskId = await seedDurationTask(page, 'hours', 12);
  const hourDuration = page.locator('[data-ops-task-duration]').first();
  await expect(hourDuration.locator('[data-ops-duration-value]')).toBeEnabled();
  await expect(hourDuration.locator('[data-ops-duration-hour-planning-blocked]')).toHaveCount(0);
  await hourDuration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ }).click();
  await page.getByRole('option', { name: /^(Days|Dagen)$/ }).click();
  await expect(hourDuration.locator('[data-ops-duration-not-exact]')).toHaveCount(0);
  await expect.poll(() => page.evaluate((id) => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id)!;
    return { unit: task.time.durationUnit, days: task.time.scheduleDuration };
  }, hourTaskId)).toEqual({ unit: 'days', days: 1.5 });
  await expect(hourDuration.locator('[data-ops-duration-value]')).toHaveValue('1.5');
});

test('eenheid kiezen zet een exacte duur meteen om en undo zet het in één stap terug', async ({ page, ops: _ops }) => {
  const taskId = await seedDurationTask(page, 'hours', 16);
  const readTime = () => page.evaluate((id) => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id)!;
    return { unit: task.time.durationUnit, days: task.time.scheduleDuration, minutes: task.time.durationMinutes ?? null };
  }, taskId);
  const historyLength = () => page.evaluate(() => window.__OPS__!.store.getState().historyEvents.length);
  const historyBefore = await historyLength();
  const duration = page.locator('[data-ops-task-duration]').first();
  await duration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ }).click();
  await page.getByRole('option', { name: /^(Days|Dagen)$/ }).click();

  await expect.poll(readTime).toEqual({ unit: 'days', days: 2, minutes: null });
  // Eén keuze is precies één geschiedenisstap: eenheid en duur landen samen.
  expect(await historyLength()).toBe(historyBefore + 1);
  await expect(duration.locator('[data-ops-duration-value]')).toHaveValue('2');
  await expect(duration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ })).toContainText(/^(Days|Dagen)$/);
  await expect(duration.locator('[data-ops-duration-message]')).toBeHidden();
  await expect(duration.getByRole('button', { name: /(proposal|voorstel|Retain|Behouden)/i })).toHaveCount(0);

  // Eén undo-stap zet eenheid én duur samen terug; een tussenstand (alleen eenheid) mag niet bestaan.
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(readTime).toEqual({ unit: 'hours', days: 2, minutes: 960 });
  await expect(duration.locator('[data-ops-duration-value]')).toHaveValue('16');

  // De taakdialoog deelt hetzelfde veld en gedraagt zich gelijk: keuze ⇒ meteen omgezet in het concept.
  await openDialog(page, taskId);
  const dialogDuration = page.getByRole('dialog').locator('[data-ops-task-duration]');
  await dialogDuration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ }).click();
  await page.getByRole('option', { name: /^(Days|Dagen)$/ }).click();
  await expect(dialogDuration.locator('[data-ops-duration-value]')).toHaveValue('2');
  await expect(dialogDuration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ })).toContainText(/^(Days|Dagen)$/);
  await expect(dialogDuration.locator('[data-ops-duration-message]')).toBeHidden();
});

/** Een kalender zonder werktijd: de enige plek waar een eenheidswissel niet om te rekenen is (sinds B1 is
 *  elke omzetting op een leesbare kalender exact, want de dagenmaat mag een breuk hebben). */
async function unreadableCalendar(page: Page): Promise<void> {
  await page.evaluate(() => {
    const state = window.__OPS__!.store.getState();
    state.setCalendar({ ...state.calendar, workDays: [], workTime: undefined });
  });
}

test('niet exact: duidelijk waarschuwingsblok, eenheid blijft, geen toast; blok verdwijnt bij nieuwe waarde en andere taak', async ({ page, ops: _ops }) => {
  const hourTaskId = await seedDurationTask(page, 'hours', 12);
  await unreadableCalendar(page);
  const notificationCount = () => page.evaluate(() => window.__OPS__!.store.getState().ui.notifications.length);
  const notificationsBefore = await notificationCount();
  const duration = page.locator('[data-ops-task-duration]').first();
  await duration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ }).click();
  await page.getByRole('option', { name: /^(Days|Dagen)$/ }).click();

  const block = duration.locator('[data-ops-duration-not-exact]');
  await expect(block).toBeVisible();
  await expect(block).toHaveAttribute('role', 'alert');
  await expect(block).toContainText('12h');
  await expect(block).toContainText(/(cannot be converted|niet om te rekenen)/i);
  // Waarschuwingskleur uit de --warning-token, geen grijze bijschrifttekst.
  const colors = await block.evaluate((el) => {
    const css = getComputedStyle(el);
    const probe = document.createElement('span');
    probe.style.color = 'var(--theme-warning-text)';
    document.body.appendChild(probe);
    const warning = getComputedStyle(probe).color;
    probe.remove();
    return { text: css.color, warning, border: css.borderTopColor, borderWidth: css.borderTopWidth };
  });
  expect(colors.text).toBe(colors.warning);
  expect(colors.borderWidth).not.toBe('0px');
  await expect(duration.locator('[data-ops-duration-message]')).toHaveCount(0);
  await expect.poll(() => page.evaluate((id) => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id)!;
    return { unit: task.time.durationUnit, minutes: task.time.durationMinutes };
  }, hourTaskId)).toEqual({ unit: 'hours', minutes: 720 });
  await expect(duration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ })).toContainText(/^(Hours|Uren)$/);
  // Geen toast: de store krijgt geen melding en er staat geen toast in beeld.
  expect(await notificationCount()).toBe(notificationsBefore);
  await expect(page.locator('.ops-toast')).toHaveCount(0);

  // Een nieuwe waarde haalt het blok weg.
  await duration.locator('[data-ops-duration-value]').fill('16h');
  await duration.locator('[data-ops-duration-value]').blur();
  await expect(block).toHaveCount(0);

  // Opnieuw niet exact, daarna een andere taak: het blok lekt niet mee.
  await duration.locator('[data-ops-duration-value]').fill('12h');
  await duration.locator('[data-ops-duration-value]').blur();
  await duration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ }).click();
  await page.getByRole('option', { name: /^(Days|Dagen)$/ }).click();
  await expect(block).toBeVisible();
  const nextTaskId = await seedDurationTask(page, 'hours', 24);
  await expect(duration.locator('[data-ops-duration-value]')).toHaveValue('24');
  await expect(block).toHaveCount(0);
  await expect.poll(() => page.evaluate((id) => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id)!;
    return { unit: task.time.durationUnit, minutes: task.time.durationMinutes };
  }, nextTaskId)).toEqual({ unit: 'hours', minutes: 1440 });

  // De taakdialoog toont hetzelfde blok.
  const dialogTaskId = await seedDurationTask(page, 'hours', 12);
  await unreadableCalendar(page);
  await openDialog(page, dialogTaskId);
  const dialogDuration = page.getByRole('dialog').locator('[data-ops-task-duration]');
  await dialogDuration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ }).click();
  await page.getByRole('option', { name: /^(Days|Dagen)$/ }).click();
  await expect(dialogDuration.locator('[data-ops-duration-not-exact]')).toContainText('12h');
  await expect(dialogDuration.locator('[data-ops-duration-value]')).toHaveValue('12');
  expect(await notificationCount()).toBe(notificationsBefore);
});
