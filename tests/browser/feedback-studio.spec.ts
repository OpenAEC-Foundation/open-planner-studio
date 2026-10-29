import { expect, test, seedProject } from './fixtures/ops';
import type { Page, Request, Route } from '@playwright/test';

// De feedbackdialoog verstuurt meldingen naar Open Feedback Studio. Elke test vangt de API af met
// `page.route`: er gaat NOOIT een echte melding naar productie. De handelingen zijn echte klikken
// en toetsaanslagen; de verstuurde body lezen we uit het afgevangen verzoek.

const ENDPOINT = 'https://open-feedback-studio.pages.dev/api/feedback';
const TITLE = 'Balk springt terug';
const DESCRIPTION = 'Na slepen van de balk staat hij weer op de oude plek.';

interface Captured {
  contentType: string;
  json: Record<string, unknown> | null;
  form: FormData | null;
}

async function capture(request: Request): Promise<Captured> {
  const contentType = request.headers()['content-type'] ?? '';
  if (contentType.startsWith('multipart/form-data')) {
    const body = request.postDataBuffer() ?? Buffer.alloc(0);
    const form = await new Response(new Uint8Array(body), { headers: { 'content-type': contentType } }).formData();
    return { contentType, json: null, form };
  }
  return { contentType, json: JSON.parse(request.postData() ?? 'null') as Record<string, unknown>, form: null };
}

/** Vang de API af; `reply` bepaalt het antwoord. Geeft de lijst met afgevangen verzoeken terug. */
async function mockApi(page: Page, reply: (route: Route) => Promise<void>): Promise<Captured[]> {
  const seen: Captured[] = [];
  await page.route(ENDPOINT, async route => {
    seen.push(await capture(route.request()));
    await reply(route);
  });
  return seen;
}

const ok = (githubIssueUrl: string | null = null) => async (route: Route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ success: true, githubIssueUrl, imageKeys: [] }),
  });
};

async function openDialog(page: Page) {
  await page.locator('[data-tour-anchor="feedback-button"]').click();
  const dialog = page.getByRole('dialog', { name: 'Send feedback' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillForm(page: Page) {
  const dialog = await openDialog(page);
  await dialog.getByLabel('Title').click();
  await page.keyboard.type(TITLE);
  await dialog.getByLabel('Description').click();
  await page.keyboard.type(DESCRIPTION);
  return dialog;
}

test('succes zonder screenshot: JSON-body klopt en het bedankscherm verschijnt', async ({ page, ops }) => {
  void ops;
  const seen = await mockApi(page, ok(null));
  const dialog = await fillForm(page);
  await dialog.getByLabel('Email address (optional, for a reply)').click();
  await page.keyboard.type('planner@example.com');
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(dialog.getByText('Thank you, your report has been sent.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'View on GitHub' })).toHaveCount(0);

  expect(seen).toHaveLength(1);
  const body = seen[0].json!;
  expect(seen[0].contentType).toContain('application/json');
  expect(body.app).toBe('open-planner-studio');
  expect(body.category).toBe('bug');
  expect(String(body.message)).toContain(`${TITLE}\n\n${DESCRIPTION}`);
  expect(String(body.message)).toMatch(/Open Planner Studio v\S+ · .+ · \S+$/);
  expect(typeof body.appVersion).toBe('string');
  expect(String(body.appVersion).length).toBeGreaterThan(0);
  expect(body.email).toBe('planner@example.com');
  expect(body).not.toHaveProperty('website');

  // Het e-mailadres is onthouden voor de volgende melding.
  expect(await page.evaluate(() => localStorage.getItem('ops-feedbackEmail'))).toBe('planner@example.com');
  await dialog.getByRole('button', { name: 'Close' }).last().click();
  await expect(dialog).toBeHidden();
  const again = await openDialog(page);
  await expect(again.getByLabel('Email address (optional, for a reply)')).toHaveValue('planner@example.com');
});

test('validatie vooraf: zonder titel of met te weinig tekst blijft Versturen grijs', async ({ page, ops }) => {
  void ops;
  const seen = await mockApi(page, ok(null));
  const dialog = await openDialog(page);
  const send = dialog.getByRole('button', { name: 'Send', exact: true });
  await expect(send).toBeDisabled();
  await dialog.getByLabel('Title').click();
  await page.keyboard.type('Kort');
  await expect(send).toBeDisabled();
  await expect(dialog.getByText('Write at least 10 characters in the title and description together.')).toBeVisible();
  await page.keyboard.type(' maar nu lang genoeg');
  await expect(send).toBeEnabled();
  await dialog.getByLabel('Email address (optional, for a reply)').click();
  await page.keyboard.type('geen-adres');
  await expect(send).toBeDisabled();
  await expect(dialog.getByText('This email address is not valid. Correct it or leave the field empty.')).toBeVisible();
  expect(seen).toHaveLength(0);
});

test('succes met githubIssueUrl: de knop Bekijk op GitHub verschijnt', async ({ page, ops }) => {
  void ops;
  await mockApi(page, ok('https://github.com/OpenAEC-Foundation/open-planner-studio/issues/999'));
  const dialog = await fillForm(page);
  await dialog.getByRole('button', { name: 'Idea' }).click();
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByText('Thank you, your report has been sent.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'View on GitHub' })).toBeVisible();
});

test('429: vertaalde fout, de ingevulde tekst blijft staan, geen GitHub-terugval', async ({ page, ops }) => {
  ops.acceptError(/status of 429/);
  await mockApi(page, async route => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ error: 'Too many requests' }),
    });
  });
  const dialog = await fillForm(page);
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('You have sent many reports in a short time. Try again in an hour.');
  await expect(dialog.getByText('Too many requests')).toHaveCount(0);
  await expect(dialog.getByLabel('Title')).toHaveValue(TITLE);
  await expect(dialog.getByLabel('Description')).toHaveValue(DESCRIPTION);
  await expect(dialog.getByRole('button', { name: 'Open on GitHub' })).toHaveCount(0);
});

const UNCERTAIN = 'We are not sure whether your report arrived. Wait a minute and then send it again; if it is already there, we will see that automatically.';
const FAILED = 'Sending failed. Check your internet connection and try again, or open the report on GitHub.';

/** Korte timeout in de dev-build (zelfde module-instantie als de dialoog), zodat de test geen 20 s wacht. */
async function shortTimeout(page: Page, ms: number) {
  await page.evaluate(async (value) => {
    const modulePath = '/src/services/feedback/feedbackService.ts';
    const mod = await import(/* @vite-ignore */ modulePath) as typeof import('@/services/feedback/feedbackService');
    mod.setFeedbackTimeoutForTests(value);
  }, ms);
}

const json = (status: number, body: unknown) => async (route: Route) => {
  await route.fulfill({
    status, contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body),
  });
};

test('5xx: zeker niet aangekomen, de knop Open op GitHub volgt de oude weg', async ({ page, ops }) => {
  ops.acceptError(/status of 503/);
  await mockApi(page, json(503, { error: 'Service unavailable' }));
  const dialog = await fillForm(page);
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(FAILED);
  await expect(dialog.getByRole('button', { name: 'Open on GitHub' })).toBeVisible();
  await expect(dialog.getByLabel('Title')).toHaveValue(TITLE);

  // De terugval opent de oude GitHub-new-issue-URL (zonder screenshot meteen). GitHub zelf wordt
  // afgevangen: de test gaat niet echt naar buiten.
  await page.context().route('https://github.com/**', route => route.fulfill({ status: 200, body: 'ok' }));
  const popup = page.waitForEvent('popup');
  await dialog.getByRole('button', { name: 'Open on GitHub' }).click();
  const opened = await popup;
  expect(opened.url()).toContain('github.com/OpenAEC-Foundation/open-planner-studio/issues/new');
  expect(decodeURIComponent(opened.url())).toContain(TITLE);
  await opened.close();
});

test('offline vóór verzenden: zeker niet aangekomen, Open op GitHub', async ({ page, ops }) => {
  void ops; // geen fetch, dus ook geen netwerkfout in de console
  let fetched = 0;
  await page.exposeFunction('__countFeedbackFetch', () => { fetched += 1; });
  await page.evaluate((endpoint) => {
    const realFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === endpoint) void (window as unknown as { __countFeedbackFetch: () => Promise<void> }).__countFeedbackFetch();
      return realFetch(input, init);
    };
  }, ENDPOINT);
  const dialog = await fillForm(page);
  await page.context().setOffline(true);
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(FAILED);
  await expect(dialog.getByRole('button', { name: 'Open on GitHub' })).toBeVisible();
  expect(fetched, 'offline vóór verzenden: de app hoort niet te versturen').toBe(0);
  await page.context().setOffline(false);
});

test('R2-1: online gestart, verbinding valt weg tijdens het verzoek: onzeker, geen GitHub', async ({ page, ops }) => {
  ops.acceptError(/net::ERR_FAILED|ERR_INTERNET_DISCONNECTED|Failed to fetch/);
  let calls = 0;
  await page.route(ENDPOINT, async route => {
    calls += 1;
    // Het verzoek is al vertrokken; nu valt de verbinding weg en faalt de fetch.
    await page.context().setOffline(true);
    await route.abort('internetdisconnected');
  });
  const dialog = await fillForm(page);
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(UNCERTAIN);
  await expect(dialog.getByRole('button', { name: 'Open on GitHub' })).toHaveCount(0);
  await expect(dialog.getByLabel('Title')).toHaveValue(TITLE);
  expect(calls).toBe(1);
  await page.context().setOffline(false);
});

test('netwerkfout na verzenden (abort): onzeker, geen GitHub-knop, tekst blijft', async ({ page, ops }) => {
  ops.acceptError(/net::ERR_FAILED|Failed to fetch/);
  await mockApi(page, async route => { await route.abort('failed'); });
  const dialog = await fillForm(page);
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(UNCERTAIN);
  await expect(dialog.getByRole('button', { name: 'Open on GitHub' })).toHaveCount(0);
  await expect(dialog.getByLabel('Title')).toHaveValue(TITLE);
  await expect(dialog.getByLabel('Description')).toHaveValue(DESCRIPTION);
});

const ALREADY_IN = 'We have already received this report. Want to add something? Then change the text and send it again.';

/** Eerste poging hangt (en wordt dus `uncertain` na de korte timeout); daarna `next`. */
async function firstHangsThen(page: Page, next: (route: Route) => Promise<void>) {
  const state = { calls: 0, hanging: [] as Route[] };
  await page.route(ENDPOINT, async route => {
    state.calls += 1;
    if (state.calls === 1) { state.hanging.push(route); return; }
    await next(route);
  });
  return state;
}

test('(a) 409 zonder voorgeschiedenis: "al binnen", formulier blijft, Sluiten sluit', async ({ page, ops }) => {
  ops.acceptError(/status of 409/);
  await mockApi(page, json(409, { error: 'Duplicate feedback' }));
  const dialog = await fillForm(page);
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByText(ALREADY_IN)).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Open on GitHub' })).toHaveCount(0);
  await expect(dialog.getByLabel('Title')).toHaveValue(TITLE);
  await expect(dialog.getByLabel('Description')).toHaveValue(DESCRIPTION);
  await dialog.locator('.feedback-dialog-footer').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
});

test('(b) onzeker, daarna gewijzigde invoer + 409: "al binnen", wijziging blijft zichtbaar, e-mail bewaard', async ({ page, ops }) => {
  ops.acceptError(/status of 409/);
  await shortTimeout(page, 400);
  const state = await firstHangsThen(page, json(409, { error: 'Duplicate feedback' }));
  const dialog = await fillForm(page);
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(UNCERTAIN, { timeout: 5_000 });
  await expect(dialog.getByRole('button', { name: 'Open on GitHub' })).toHaveCount(0);

  const emailField = dialog.getByLabel('Email address (optional, for a reply)');
  await emailField.click();
  await page.keyboard.type('planner@example.com');
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByText(ALREADY_IN)).toBeVisible();
  await expect(dialog.getByText('Thank you, your report has been sent.')).toHaveCount(0);
  await expect(dialog.getByLabel('Title')).toHaveValue(TITLE);
  await expect(emailField).toHaveValue('planner@example.com');
  expect(await page.evaluate(() => localStorage.getItem('ops-feedbackEmail'))).toBe('planner@example.com');
  expect(state.calls).toBe(2);
  for (const r of state.hanging) await r.abort().catch(() => { /* verzoek al afgebroken door de client */ });
});

test('(c) onzeker, daarna offline-poging: mislukt, maar ZONDER GitHub-knop', async ({ page, ops }) => {
  void ops;
  await shortTimeout(page, 400);
  const state = await firstHangsThen(page, ok(null));
  const dialog = await fillForm(page);
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(UNCERTAIN, { timeout: 5_000 });

  await page.context().setOffline(true);
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(UNCERTAIN);
  await expect(dialog.getByRole('button', { name: 'Open on GitHub' })).toHaveCount(0);
  await expect(dialog.getByLabel('Title')).toHaveValue(TITLE);
  expect(state.calls, 'offline: geen tweede verzoek').toBe(1);
  await page.context().setOffline(false);
  for (const r of state.hanging) await r.abort().catch(() => { /* verzoek al afgebroken door de client */ });
});

test('B1: headers meteen, body valt stil: de timeout slaat ook dan toe', async ({ page, ops }) => {
  void ops;
  await shortTimeout(page, 400);
  // De body-stream die nooit sluit kan Playwright niet nabootsen met route.fulfill; daarom levert
  // een vervangen fetch voor alleen dit endpoint een 200 met een stilvallende body. De
  // gebruikershandeling (klikken op Versturen) blijft echt.
  await page.evaluate((endpoint) => {
    const realFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url !== endpoint) return realFetch(input, init);
      const stalled = new ReadableStream<Uint8Array>({ start() { /* nooit data, nooit sluiten */ } });
      return Promise.resolve(new Response(stalled, { status: 200, headers: { 'content-type': 'application/json' } }));
    };
  }, ENDPOINT);
  const dialog = await fillForm(page);
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(UNCERTAIN, { timeout: 5_000 });
  await expect(dialog.getByRole('button', { name: 'Open on GitHub' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
});

test('B2: tijdens versturen staan Annoteren en het screenshot-vinkje uit', async ({ page, ops }) => {
  void ops;
  test.setTimeout(60_000);
  let release: (() => void) | null = null;
  const held = new Promise<void>(resolve => { release = resolve; });
  await mockApi(page, async route => { await held; await ok(null)(route); });
  const dialog = await fillForm(page);
  await dialog.getByLabel('Attach screenshot').check();
  await expect(dialog.locator('.screenshot-annotator-thumb-img')).toBeVisible({ timeout: 20_000 });
  const annotate = dialog.getByRole('button', { name: 'Annotate' });
  await expect(annotate).toBeEnabled();

  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Sending…' })).toBeDisabled();
  await expect(annotate).toBeDisabled();
  await expect(dialog.getByLabel('Attach screenshot')).toBeDisabled();

  release!();
  await expect(dialog.getByText('Thank you, your report has been sent.')).toBeVisible({ timeout: 20_000 });
});

test('met screenshot: multipart met één verkleinde afbeelding onder 1 MB', async ({ page, ops }) => {
  void ops;
  test.setTimeout(60_000);
  await seedProject(page, [
    { name: 'Fundering', start: '2026-03-02', finish: '2026-03-06', durationDays: 5 },
    { name: 'Ruwbouw', start: '2026-03-09', finish: '2026-03-20', durationDays: 10 },
    { name: 'Afbouw', start: '2026-03-23', finish: '2026-04-03', durationDays: 10 },
  ]);
  const seen = await mockApi(page, ok(null));
  const dialog = await fillForm(page);
  await dialog.getByLabel('Attach screenshot').check();
  const thumb = dialog.locator('.screenshot-annotator-thumb-img');
  await expect(thumb).toBeVisible({ timeout: 20_000 });
  const original = await thumb.evaluate((img: HTMLImageElement) => ({
    bytes: Math.floor((img.src.length - img.src.indexOf(',') - 1) * 3 / 4),
    width: img.naturalWidth,
    height: img.naturalHeight,
  }));

  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByText('Thank you, your report has been sent.')).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByText('The screenshot was too large and was not sent.')).toHaveCount(0);

  expect(seen).toHaveLength(1);
  const form = seen[0].form!;
  expect(form, 'verzoek met screenshot hoort multipart te zijn').not.toBeNull();
  expect(form.get('app')).toBe('open-planner-studio');
  expect(String(form.get('message'))).toContain(TITLE);
  expect(form.has('website')).toBe(false);
  const files = [...form.values()].filter((v): v is File => typeof v !== 'string');
  expect(files).toHaveLength(1);
  const file = files[0];
  expect(['image/webp', 'image/jpeg']).toContain(file.type);
  expect(file.size).toBeLessThanOrEqual(1024 * 1024);
  const dims = await page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/webp;base64,${b64}`)).blob());
    return { width: bmp.width, height: bmp.height };
  }, Buffer.from(await file.arrayBuffer()).toString('base64'));
  console.log(`[feedback-studio] screenshot vóór: PNG ${original.bytes} B ${original.width}x${original.height}; ` +
    `na: ${file.type} ${file.size} B ${dims.width}x${dims.height}`);
});

test('verkleinen: een te groot beeld gaat eerst op volle resolutie, daarna smaller onder 900 KB', async ({ page, ops }) => {
  void ops;
  test.setTimeout(60_000);
  // Ruisbeeld van 2560x1440: als PNG ver boven 1 MB, en ook als WebP op volle resolutie te groot.
  // Dit test de pure verkleinfunctie (geen gebruikershandeling), via de Vite-module van de dev-build.
  const result = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 2560; c.height = 1440;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = Math.random() * 255; img.data[i + 1] = Math.random() * 255;
      img.data[i + 2] = Math.random() * 255; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const dataUrl = c.toDataURL('image/png');
    const modulePath = '/src/services/feedback/feedbackService.ts';
    const mod = await import(/* @vite-ignore */ modulePath) as typeof import('@/services/feedback/feedbackService');
    const blob = await mod.prepareScreenshotForUpload(dataUrl);
    const bmp = blob ? await createImageBitmap(blob) : null;
    return {
      pngBytes: Math.floor((dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4),
      type: blob?.type ?? null, bytes: blob?.size ?? null, width: bmp?.width ?? null, height: bmp?.height ?? null,
      limit: mod.FEEDBACK_IMAGE_MAX_BYTES,
    };
  });
  console.log(`[feedback-studio] ruisbeeld vóór: PNG ${result.pngBytes} B 2560x1440; ` +
    `na: ${result.type} ${result.bytes} B ${result.width}x${result.height}`);
  expect(result.pngBytes).toBeGreaterThan(1024 * 1024);
  expect(result.bytes).not.toBeNull();
  expect(result.bytes!).toBeLessThanOrEqual(result.limit);
  expect(result.width!).toBeLessThan(2560);
  expect(result.width! / result.height!).toBeCloseTo(2560 / 1440, 1);
});
