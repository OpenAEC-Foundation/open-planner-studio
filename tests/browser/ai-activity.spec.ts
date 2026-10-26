import { expect, test } from './fixtures/ops';

// Nieuwe route: er bestond geen scenario voor activiteiten lezen/uitklappen/wissen. De
// verbindingsgegevens-test heeft een ander doel (credentials kopiëren), zonder activiteitenfeed.
test('MCP-activiteit: vaste markeringen vertalen mee, technische inhoud blijft letterlijk', async ({ page, ops: _ops }) => {
  await page.evaluate(async () => {
    const activityPath = '/src/services/mcp/activityLog.ts';
    const log = await import(/* @vite-ignore */ activityPath);
    log.clear();
    log.record({ ts: 1, tool: '?', summary: 'Unparseable request', summaryKind: 'unparseableRequest',
      durationMs: 1, ok: false, error: 'Unparseable response', errorKind: 'unparseableResponse',
      argsJson: 'x'.repeat(log.FIELD_CAP + 100), resultJson: 'raw … truncated' });
    log.record({ ts: 2, tool: 'fixture', summary: 'generic fixture', durationMs: 1, ok: false,
      error: 'Error', errorKind: 'error', argsJson: '{}', resultJson: '{}' });
    window.__OPS__!.store.getState().setUI({ aiMode: true, activeRibbonTab: 'ai', ribbonCompact: false });
  });
  await page.getByRole('button', { name: 'Activity panel', exact: true }).click();
  await page.getByText('Unparseable request', { exact: true }).click();
  await page.getByText('generic fixture', { exact: true }).click();

  for (const locale of ['nl', 'en']) {
    await page.evaluate(async language => {
      const localePath = '/src/i18n/config.ts';
      const { setLocale } = await import(/* @vite-ignore */ localePath);
      await setLocale(language);
    }, locale);
    const nl = locale === 'nl';
    const panel = page.getByText(nl ? 'MCP-activiteit' : 'MCP activity', { exact: true }).locator('../..');
    await expect(panel.getByText(nl ? 'Onparseerbaar verzoek' : 'Unparseable request', { exact: true })).toBeVisible();
    await expect(panel.getByText(nl ? 'Onparseerbaar antwoord' : 'Unparseable response', { exact: true })).toBeVisible();
    await expect(panel.getByText(nl ? 'Fout' : 'Error', { exact: true })).toBeVisible();
    const fields = await panel.locator('pre').allTextContents();
    expect(fields).toContain('x'.repeat(20 * 1024) + (nl ? '… afgekapt' : '… truncated'));
    expect(fields).toContain('raw … truncated'); // Geen vervanging binnen technische inhoud.
  }
  const panel = page.getByText('MCP activity', { exact: true }).locator('../..');
  await panel.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(panel.getByText('No MCP activity yet. Bridge calls will appear here.', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(panel).toBeHidden();
});
