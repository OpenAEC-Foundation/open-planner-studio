import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const XER = [
  'ERMHDR\t8.4\t2026-07-18\t\t\t\t\t\tEUR',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
  '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tP1\tWbsBoom\tC1\t2026-01-05\t2026-01-05',
  '%T\tPROJWBS', '%F\twbs_id\tproj_id\tparent_wbs_id\tseq_num\twbs_short_name\twbs_name',
  '%R\t1\tP1\t0\t1\tMER.W01\tWBS 01',
  '%R\t2\tP1\t1\t2\tMER.W02\tWBS 02',
  '%R\t10\tP1\t1\t2\tMER.W10\tWBS 10',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
  '%R\tA1\tP1\t1\tC1\tA-1\tTaak 1\tTT_Task\tTK_NotStart\t8\t8\t2026-01-05\t2026-01-05',
  '%R\tA2\tP1\t2\tC1\tA-2\tTaak 2\tTT_Task\tTK_NotStart\t16\t16\t2026-01-06\t2026-01-07',
  '%R\tA3\tP1\t10\tC1\tA-3\tTaak 3\tTT_Task\tTK_NotStart\t8\t8\t2026-01-08\t2026-01-08',
  '%T\tTASKPRED', '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  '%R\tR1\tA2\tA1\tP1\tP1\tPR_FS\t0',
  '%R\tR2\tA3\tA2\tP1\tP1\tPR_FS\t0',
  '%E',
].join('\n');

const W1 = 'xer-wbs:P1:1';
const W2 = 'xer-wbs:P1:2';
const W10 = 'xer-wbs:P1:10';

async function openXer(page: Page): Promise<void> {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  await expect(openButton).toHaveCount(1);
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name: 'wbs-boom.xer', mimeType: 'application/octet-stream', buffer: Buffer.from(XER) });
}

function nameCell(page: Page, taskId: string): Locator {
  return page.locator(
    `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"] .full-task-grid-name`,
  );
}

test('XER-WBS: de boom springt in, de samenvatting rolt op, en inklappen verbergt de kinderen',
  async ({ page, ops: _ops }) => {
    await openXer(page);
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(6);

    await expect(nameCell(page, W1)).toHaveAttribute('data-grid-name-depth', '0');
    await expect(nameCell(page, W2)).toHaveAttribute('data-grid-name-depth', '1');
    await expect(nameCell(page, W10)).toHaveAttribute('data-grid-name-depth', '1');
    await expect(nameCell(page, 'A2')).toHaveAttribute('data-grid-name-depth', '2');
    await expect(nameCell(page, 'A1')).toHaveAttribute('data-grid-name-depth', '1');
    const w2Box = await nameCell(page, W2).boundingBox();
    const w10Box = await nameCell(page, W10).boundingBox();
    expect(w2Box && w10Box && w2Box.y < w10Box.y).toBe(true);

    await expect.poll(() => page.evaluate(ids => {
      const tasks = window.__OPS__!.store.getState().tasks;
      return ids.map(id => (tasks.find(task => task.id === id)?.time.scheduleDuration ?? 0) > 0);
    }, [W1, W2, W10])).toEqual([true, true, true]);

    const disclosure = nameCell(page, W2).locator('.full-task-grid-disclosure');
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    await disclosure.click();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await expect(nameCell(page, 'A2')).toHaveCount(0);
    await expect(nameCell(page, 'A3')).toHaveCount(1);
    await expect(nameCell(page, 'A1')).toHaveCount(1);

    await disclosure.click();
    await expect(nameCell(page, 'A2')).toHaveCount(1);
    await nameCell(page, W1).locator('.full-task-grid-disclosure').click();
    for (const id of [W2, W10, 'A1', 'A2', 'A3']) await expect(nameCell(page, id)).toHaveCount(0);
    await expect(nameCell(page, W1)).toHaveCount(1);
  });
