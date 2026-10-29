import { expect, test, seedProject } from './fixtures/ops';
import type { Locator, Page, Request, Route } from '@playwright/test';

// Het feedbackvenster: bewaard concept, Leegmaken, drie soorten, hint bij de grijze knop,
// de regel Meegestuurd, Afdekken en Annuleren in de editor. Elke test vangt de API af met
// `page.route`: er gaat NOOIT een echte melding naar productie. De handelingen zijn echte klikken
// en toetsaanslagen; de verstuurde body lezen we uit het afgevangen verzoek.

const ENDPOINT = 'https://open-feedback-studio.pages.dev/api/feedback';
const TITLE = 'Balk springt terug';
const DESCRIPTION = 'Na slepen van de balk staat hij weer op de oude plek.';

declare global {
  interface Window {
    __annotationSaveGate?: { started: number; waiting: number; released: number; release: () => void };
  }
}

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

async function mockApi(page: Page): Promise<Captured[]> {
  const seen: Captured[] = [];
  await page.route(ENDPOINT, async (route: Route) => {
    seen.push(await capture(route.request()));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ success: true, githubIssueUrl: null, imageKeys: [] }),
    });
  });
  return seen;
}

async function openDialog(page: Page) {
  await page.locator('[data-tour-anchor="feedback-button"]').click();
  const dialog = page.getByRole('dialog', { name: 'Send feedback' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function typeInto(page: Page, field: Locator, text: string) {
  await field.click();
  await page.keyboard.type(text);
}

async function seed(page: Page) {
  await seedProject(page, [
    { name: 'Fundering', start: '2026-03-02', finish: '2026-03-06', durationDays: 5 },
    { name: 'Ruwbouw', start: '2026-03-09', finish: '2026-03-20', durationDays: 10 },
    { name: 'Afbouw', start: '2026-03-23', finish: '2026-04-03', durationDays: 10 },
  ]);
}

/** Sleep op het editorcanvas van (fx0,fy0) naar (fx1,fy1), als fracties van het canvas. */
async function dragOnCanvas(page: Page, fx0: number, fy0: number, fx1: number, fy1: number) {
  const canvas = page.locator('canvas.annotator-editor-canvas');
  await expect.poll(() => canvas.evaluate(el => (el as HTMLCanvasElement).width)).toBeGreaterThan(0);
  const b = (await canvas.boundingBox())!;
  await page.mouse.move(b.x + b.width * fx0, b.y + b.height * fy0);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * ((fx0 + fx1) / 2), b.y + b.height * ((fy0 + fy1) / 2));
  await page.mouse.move(b.x + b.width * fx1, b.y + b.height * fy1);
  await page.mouse.up();
}

test('concept blijft na Esc en heropenen; Leegmaken wist het', async ({ page, ops }) => {
  void ops;
  const seen = await mockApi(page);
  let dialog = await openDialog(page);
  await dialog.getByRole('button', { name: 'Idea' }).click();
  await typeInto(page, dialog.getByLabel('Title'), TITLE);
  await typeInto(page, dialog.getByLabel('Description'), DESCRIPTION);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  dialog = await openDialog(page);
  await expect(dialog.getByLabel('Title')).toHaveValue(TITLE);
  await expect(dialog.getByLabel('Description')).toHaveValue(DESCRIPTION);
  await expect(dialog.getByRole('button', { name: 'Idea' })).toHaveAttribute('aria-pressed', 'true');

  // Het kruisje (Bewaren en sluiten) bewaart het concept ook.
  await dialog.locator('.feedback-dialog-header').getByRole('button', { name: 'Save and close' }).click();
  await expect(dialog).toBeHidden();
  dialog = await openDialog(page);
  await expect(dialog.getByLabel('Title')).toHaveValue(TITLE);

  // De voetknop Bewaren en sluiten ook (er is geen Annuleren meer in het venster).
  await expect(dialog.locator('.feedback-dialog-footer').getByRole('button', { name: 'Cancel' })).toHaveCount(0);
  await dialog.locator('.feedback-dialog-footer').getByRole('button', { name: 'Save and close' }).click();
  await expect(dialog).toBeHidden();
  dialog = await openDialog(page);
  await expect(dialog.getByLabel('Title')).toHaveValue(TITLE);

  await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(dialog.getByLabel('Title')).toHaveValue('');
  await expect(dialog.getByLabel('Description')).toHaveValue('');
  await expect(dialog.getByRole('button', { name: "Something's not working" })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('button', { name: 'Clear', exact: true })).toHaveCount(0);

  // Ook na sluiten en heropenen blijft het leeg.
  await page.keyboard.press('Escape');
  dialog = await openDialog(page);
  await expect(dialog.getByLabel('Title')).toHaveValue('');
  expect(seen).toHaveLength(0);
});

test('soort Vraag of opmerking stuurt category general; na versturen is het concept leeg', async ({ page, ops }) => {
  void ops;
  const seen = await mockApi(page);
  let dialog = await openDialog(page);
  await dialog.getByRole('button', { name: 'Question or comment' }).click();
  await typeInto(page, dialog.getByLabel('Title'), TITLE);
  await typeInto(page, dialog.getByLabel('Description'), DESCRIPTION);

  // De regel Meegestuurd toont wat de metaregel meestuurt.
  const metaLine = dialog.locator('[data-feedback-meta]');
  await expect(metaLine).toHaveText(/^Sent along: v\S+ · .+ · English$/);
  const shownOs = (await metaLine.textContent())!.split(' · ')[1];
  const shownVersion = (await metaLine.textContent())!.split(' · ')[0].replace('Sent along: v', '');

  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByText('Thank you, your report has been sent.')).toBeVisible();
  expect(seen).toHaveLength(1);
  const body = seen[0].json!;
  expect(body.category).toBe('general');
  expect(String(body.message).endsWith(`Open Planner Studio v${shownVersion} · ${shownOs} · en`)).toBe(true);
  expect(['Windows', 'macOS', 'Linux']).toContain(shownOs);

  await dialog.getByRole('button', { name: 'Close' }).last().click();
  dialog = await openDialog(page);
  await expect(dialog.getByLabel('Title')).toHaveValue('');
  await expect(dialog.getByRole('button', { name: "Something's not working" })).toHaveAttribute('aria-pressed', 'true');
});

test('grijze knop: een rustige hint zegt waarom', async ({ page, ops }) => {
  void ops;
  const dialog = await openDialog(page);
  const send = dialog.getByRole('button', { name: 'Send', exact: true });
  await expect(send).toBeDisabled();
  const hint = dialog.locator('[data-feedback-hint]');
  await expect(hint).toHaveText('Enter a title.');
  await expect(send).toHaveAccessibleDescription('Enter a title.');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.getByLabel('Title')).toHaveAttribute('placeholder', 'E.g. Critical path jumps after saving');
  await expect(dialog.getByLabel('Description')).toHaveAttribute('placeholder', 'What did you do, what did you expect, and what happened?');

  await typeInto(page, dialog.getByLabel('Title'), 'Kort');
  await expect(hint).toHaveText('Write at least 10 characters in the title and description together.');
  await page.keyboard.type(' maar lang genoeg');
  await expect(send).toBeEnabled();
  await expect(hint).toHaveCount(0);
});

test('afdekken: het gebied is egaal in de verstuurde afbeelding', async ({ page, ops }) => {
  void ops;
  test.setTimeout(90_000);
  await seed(page);
  const seen = await mockApi(page);
  const dialog = await openDialog(page);
  await typeInto(page, dialog.getByLabel('Title'), TITLE);
  await typeInto(page, dialog.getByLabel('Description'), DESCRIPTION);
  await dialog.getByLabel('Attach screenshot').check();
  const thumb = dialog.locator('.screenshot-annotator-thumb-img');
  await expect(thumb).toBeVisible({ timeout: 20_000 });

  const rawSrc = (await thumb.getAttribute('src'))!;

  await dialog.getByRole('button', { name: 'Annotate' }).click();
  await page.locator('.annotator-editor').getByRole('button', { name: 'Cover' }).click();
  // Een vlak over het midden-links van de app (raster en kop: daar staat tekst).
  await dragOnCanvas(page, 0.02, 0.05, 0.45, 0.6);
  const editor = page.locator('.annotator-editor');
  // Alleen het losse uitvoercanvas faalt; het tekenvlak en de rest van de app blijven werken.
  // Elke fout wordt één keer geïnjecteerd, zodat dezelfde bewerking daarna opnieuw kan slagen.
  for (const failure of ['context', 'image', 'export', 'empty'] as const) {
    await page.evaluate((failure) => {
      const proto = HTMLCanvasElement.prototype;
      if (failure === 'context') {
        const original = proto.getContext;
        proto.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
          if (!this.isConnected) {
            proto.getContext = original;
            return null;
          }
          return original.apply(this, args);
        } as typeof original;
      } else if (failure === 'image') {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!;
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
          ...descriptor,
          set() {
            Object.defineProperty(HTMLImageElement.prototype, 'src', descriptor);
            descriptor.set!.call(this, 'data:image/png;base64,broken');
          },
        });
      } else {
        const original = proto.toDataURL;
        proto.toDataURL = function () {
          proto.toDataURL = original;
          if (failure === 'export') throw new DOMException('Test export failure', 'SecurityError');
          return 'data:,';
        };
      }
    }, failure);
    await editor.getByRole('button', { name: 'Done' }).click();
    await expect(editor.getByRole('alert')).toContainText('Your edits could not be saved.');
    await expect(editor).toBeVisible();
    await expect(thumb).toHaveAttribute('src', rawSrc);
    await expect(dialog.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
    expect(seen).toHaveLength(0);
    await expect(editor.getByTitle('Undo')).toBeEnabled();
  }
  // Houd de echte afbeeldingscallback vast: dubbel Klaar, Annuleren en Esc mogen tijdens
  // het verwerken geen tweede save starten of de editor voortijdig sluiten.
  await page.evaluate((rawSrc) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!;
    const pending: (() => void)[] = [];
    const gate = {
      started: 0, waiting: 0, released: 0,
      release: () => {
        Object.defineProperty(HTMLImageElement.prototype, 'src', descriptor);
        for (const callback of pending.splice(0)) { gate.released++; callback(); }
      },
    };
    window.__annotationSaveGate = gate;
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      ...descriptor,
      set(value: string) {
        if (value === rawSrc && !this.isConnected) {
          gate.started++;
          const onload = this.onload;
          this.onload = (event: Event) => {
            gate.waiting++;
            pending.push(() => onload?.call(this, event));
          };
        }
        descriptor.set!.call(this, value);
      },
    });
  }, rawSrc);
  const doneBox = await editor.getByRole('button', { name: 'Done' }).boundingBox();
  const cancelBox = await editor.getByRole('button', { name: 'Cancel' }).boundingBox();
  if (!doneBox || !cancelBox) throw new Error('Editor-knoppen ontbreken');
  await page.mouse.dblclick(doneBox.x + doneBox.width / 2, doneBox.y + doneBox.height / 2);
  await expect.poll(() => page.evaluate(() => ({
    started: window.__annotationSaveGate?.started, waiting: window.__annotationSaveGate?.waiting,
  }))).toEqual({ started: 1, waiting: 1 });
  // Echte muisklik op de inmiddels inert gemaakte Annuleren-knop, zonder Playwright-wacht op enabled.
  await page.mouse.click(cancelBox.x + cancelBox.width / 2, cancelBox.y + cancelBox.height / 2);
  await expect(editor).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(editor).toBeVisible();
  await expect(thumb).toHaveAttribute('src', rawSrc);
  await expect(dialog.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  expect(seen).toHaveLength(0);
  // Pas nu mag flatten voltooien. De pixelcontrole hieronder bewijst dat de afdekking is behouden.
  await page.evaluate(() => window.__annotationSaveGate!.release());
  await expect(editor).toHaveCount(0);
  expect(await page.evaluate(() => ({
    started: window.__annotationSaveGate?.started, released: window.__annotationSaveGate?.released,
  }))).toEqual({ started: 1, released: 1 });

  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByText('Thank you, your report has been sent.')).toBeVisible({ timeout: 20_000 });
  expect(seen).toHaveLength(1);
  const files = [...seen[0].form!.values()].filter((v): v is File => typeof v !== 'string');
  expect(files).toHaveLength(1);
  const b64 = Buffer.from(await files[0].arrayBuffer()).toString('base64');
  const type = files[0].type;

  // Lees de verstuurde afbeelding en meet een raster van punten binnen het afgedekte gebied.
  const sample = (src: string) => page.evaluate(async (src) => {
    const bmp = await createImageBitmap(await (await fetch(src)).blob());
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    const out: number[][] = [];
    for (const fx of [0.06, 0.15, 0.25, 0.35, 0.41]) {
      for (const fy of [0.1, 0.2, 0.3, 0.4, 0.55]) {
        const d = ctx.getImageData(Math.round(fx * c.width), Math.round(fy * c.height), 1, 1).data;
        out.push([d[0], d[1], d[2]]);
      }
    }
    return out;
  }, src);
  // Tegencontrole: in het ruwe screenshot is dat gebied niet egaal zwart.
  const raw = await sample(rawSrc);
  expect(raw.some(([r, g, b]) => Math.max(r, g, b) > 40), 'het ruwe gebied hoort inhoud te hebben').toBe(true);
  const samples = await sample(`data:${type};base64,${b64}`);
  for (const [r, g, b] of samples) {
    expect(Math.max(r, g, b), `pixel ${r},${g},${b} hoort zwart te zijn`).toBeLessThanOrEqual(12);
  }
});

test('annuleren in de editor gooit een getekende vorm weg; Esc sluit alleen de editor', async ({ page, ops }) => {
  void ops;
  test.setTimeout(60_000);
  await seed(page);
  const dialog = await openDialog(page);
  await dialog.getByLabel('Attach screenshot').check();
  const thumb = dialog.locator('.screenshot-annotator-thumb-img');
  await expect(thumb).toBeVisible({ timeout: 20_000 });
  const before = await thumb.getAttribute('src');
  const editor = page.locator('.annotator-editor');
  const undo = editor.getByTitle('Undo');

  // Ronde 1: tekenen en Annuleren.
  await dialog.getByRole('button', { name: 'Annotate' }).click();
  await editor.getByRole('button', { name: 'Rectangle' }).click();
  await dragOnCanvas(page, 0.2, 0.2, 0.5, 0.5);
  await expect(undo).toBeEnabled();
  await editor.getByRole('button', { name: 'Cancel' }).click();
  await expect(editor).toHaveCount(0);
  expect(await thumb.getAttribute('src')).toBe(before);
  await dialog.getByRole('button', { name: 'Annotate' }).click();
  await expect(undo).toBeDisabled();

  // Ronde 2: tekenen en Esc — de editor sluit, het venster blijft open.
  await editor.getByRole('button', { name: 'Rectangle' }).click();
  await dragOnCanvas(page, 0.2, 0.2, 0.5, 0.5);
  await expect(undo).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(editor).toHaveCount(0);
  await expect(dialog).toBeVisible();
  expect(await thumb.getAttribute('src')).toBe(before);

  // Ronde 3: tekenen en Klaar — de vorm blijft, ook na sluiten en heropenen van het venster.
  await dialog.getByRole('button', { name: 'Annotate' }).click();
  await expect(undo).toBeDisabled();
  await editor.getByRole('button', { name: 'Rectangle' }).click();
  await dragOnCanvas(page, 0.2, 0.2, 0.5, 0.5);
  await editor.getByRole('button', { name: 'Done' }).click();
  await expect(editor).toHaveCount(0);
  await expect.poll(() => thumb.getAttribute('src')).not.toBe(before);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  const again = await openDialog(page);
  await expect(again.getByLabel('Attach screenshot')).toBeChecked();
  await again.getByRole('button', { name: 'Annotate' }).click();
  await expect(undo).toBeEnabled();
  await editor.getByRole('button', { name: 'Cancel' }).click();

  // Opnieuw maken wist de annotaties.
  await again.getByRole('button', { name: 'Retake' }).click();
  await expect(again.locator('.screenshot-annotator-thumb-img')).toBeVisible({ timeout: 20_000 });
  await again.getByRole('button', { name: 'Annotate' }).click();
  await expect(undo).toBeDisabled();
  await editor.getByRole('button', { name: 'Cancel' }).click();

  // Weghalen zet het vinkje uit.
  await again.getByRole('button', { name: 'Remove' }).click();
  await expect(again.getByLabel('Attach screenshot')).not.toBeChecked();
  await expect(again.locator('.screenshot-annotator-thumb-img')).toHaveCount(0);
});

test('editor open: Tab bereikt Versturen niet en Enter verstuurt niets; na Klaar is de upload afgedekt', async ({ page, ops }) => {
  void ops;
  test.setTimeout(90_000);
  await seed(page);
  const seen = await mockApi(page);
  const dialog = await openDialog(page);
  await typeInto(page, dialog.getByLabel('Title'), TITLE);
  await typeInto(page, dialog.getByLabel('Description'), DESCRIPTION);
  await dialog.getByLabel('Attach screenshot').check();
  await expect(dialog.locator('.screenshot-annotator-thumb-img')).toBeVisible({ timeout: 20_000 });

  await dialog.getByRole('button', { name: 'Annotate' }).click();
  const editor = page.locator('.annotator-editor');
  await editor.getByRole('button', { name: 'Cover' }).click();
  await dragOnCanvas(page, 0.02, 0.05, 0.45, 0.6);

  // Probeer met het toetsenbord bij Versturen te komen, vooruit en achteruit. Komt de focus daar
  // toch, dan drukt de test op Enter (zo vond de review de fout).
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press(key);
      const where = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        return {
          inEditor: !!a?.closest('.annotator-editor'),
          isSend: a?.tagName === 'BUTTON' && a.textContent?.trim() === 'Send',
        };
      });
      if (where.isSend) await page.keyboard.press('Enter');
      expect(where.isSend, `${key} ${i + 1}: focus op Versturen terwijl de editor openstaat`).toBe(false);
      expect(where.inEditor, `${key} ${i + 1}: focus buiten de editor`).toBe(true);
    }
  }
  await expect(editor).toBeVisible();
  expect(seen, 'geen verzending terwijl de editor openstaat').toHaveLength(0);

  await editor.getByRole('button', { name: 'Done' }).click();
  await expect(editor).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByText('Thank you, your report has been sent.')).toBeVisible({ timeout: 20_000 });
  expect(seen).toHaveLength(1);
  const file = [...seen[0].form!.values()].find((v): v is File => typeof v !== 'string')!;
  const samples = await page.evaluate(async ({ b64, type }) => {
    const bmp = await createImageBitmap(await (await fetch(`data:${type};base64,${b64}`)).blob());
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    return [[0.1, 0.2], [0.25, 0.35], [0.4, 0.5]].map(([fx, fy]) =>
      Array.from(ctx.getImageData(Math.round(fx * c.width), Math.round(fy * c.height), 1, 1).data.slice(0, 3)));
  }, { b64: Buffer.from(await file.arrayBuffer()).toString('base64'), type: file.type });
  for (const [r, g, b] of samples) {
    expect(Math.max(r, g, b), `pixel ${r},${g},${b} hoort zwart te zijn`).toBeLessThanOrEqual(12);
  }
});

test('onzeker hoort bij het concept: na heropenen geen GitHub, een 409 geeft al binnen met het formulier', async ({ page, ops }) => {
  ops.acceptError(/status of 409/);
  await page.evaluate(async () => {
    const modulePath = '/src/services/feedback/feedbackService.ts';
    const mod = await import(/* @vite-ignore */ modulePath) as typeof import('@/services/feedback/feedbackService');
    mod.setFeedbackTimeoutForTests(400);
  });
  let calls = 0;
  const hanging: Route[] = [];
  await page.route(ENDPOINT, async route => {
    calls += 1;
    if (calls === 1) { hanging.push(route); return; } // eerste poging: geen antwoord op tijd
    await route.fulfill({
      status: 409, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ error: 'Duplicate feedback' }),
    });
  });
  let dialog = await openDialog(page);
  await typeInto(page, dialog.getByLabel('Title'), TITLE);
  await typeInto(page, dialog.getByLabel('Description'), DESCRIPTION);
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(/^We are not sure whether your report arrived\./, { timeout: 5_000 });

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  dialog = await openDialog(page);
  await expect(dialog.getByLabel('Title')).toHaveValue(TITLE);
  await expect(dialog.getByRole('button', { name: 'Open on GitHub' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText(
    'We have already received this report. Want to add something? Then change the text and send it again.');
  await expect(dialog.getByLabel('Title')).toHaveValue(TITLE);
  await expect(dialog.getByLabel('Description')).toHaveValue(DESCRIPTION);
  expect(calls).toBe(2);

  // Sluiten vanuit "al binnen": de melding is binnen, dus het concept is weg.
  await dialog.locator('.feedback-dialog-footer').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
  dialog = await openDialog(page);
  await expect(dialog.getByLabel('Title')).toHaveValue('');
  for (const r of hanging) await r.abort().catch(() => { /* al afgebroken door de client */ });
});

test('na Klaar, Annuleren en Esc staat de focus op Annoteren en blijft Tab in het venster', async ({ page, ops }) => {
  void ops;
  test.setTimeout(90_000);
  await seed(page);
  const dialog = await openDialog(page);
  await dialog.getByLabel('Attach screenshot').check();
  await expect(dialog.locator('.screenshot-annotator-thumb-img')).toBeVisible({ timeout: 20_000 });
  const annotate = dialog.getByRole('button', { name: 'Annotate' });
  const editor = page.locator('.annotator-editor');
  const focusInfo = () => page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    return { inDialog: !!a?.closest('.feedback-dialog'), text: a?.textContent?.trim() ?? '', tag: a?.tagName ?? '' };
  });

  const closers: Array<[string, () => Promise<void>]> = [
    ['Klaar', () => editor.getByRole('button', { name: 'Done' }).click()],
    ['Annuleren', () => editor.getByRole('button', { name: 'Cancel' }).click()],
    ['Esc', () => page.keyboard.press('Escape')],
  ];
  for (const [label, closeEditor] of closers) {
    await annotate.click();
    await editor.getByRole('button', { name: 'Rectangle' }).click();
    await dragOnCanvas(page, 0.2, 0.2, 0.4, 0.4);
    await closeEditor();
    await expect(editor).toHaveCount(0);
    await expect(annotate, `${label}: focus terug op Annoteren`).toBeFocused();
    for (const key of ['Tab', 'Shift+Tab', 'Shift+Tab']) {
      await page.keyboard.press(key);
      const f = await focusInfo();
      expect(f.inDialog, `${label} ${key}: focus buiten het venster (${f.tag} "${f.text}")`).toBe(true);
    }
    await annotate.focus();
  }
  // Niets achter het venster is geopend.
  await expect(page.getByRole('dialog')).toHaveCount(1);
});

test('al binnen, dan een aanvulling typen: de melding gaat weg en sluiten bewaart de aanvulling', async ({ page, ops }) => {
  ops.acceptError(/status of 409/);
  let calls = 0;
  await page.route(ENDPOINT, async route => {
    calls += 1;
    await route.fulfill({
      status: 409, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ error: 'Duplicate feedback' }),
    });
  });
  let dialog = await openDialog(page);
  await typeInto(page, dialog.getByLabel('Title'), TITLE);
  await typeInto(page, dialog.getByLabel('Description'), DESCRIPTION);
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  const notice = dialog.getByText('We have already received this report.', { exact: false });
  await expect(notice).toBeVisible();
  const footer = dialog.locator('.feedback-dialog-footer');
  await expect(footer.getByRole('button', { name: 'Close', exact: true })).toBeVisible();

  const ADDITION = ' Het gebeurt ook na een herstart.';
  await typeInto(page, dialog.getByLabel('Description'), ADDITION);
  await expect(notice).toHaveCount(0);
  await expect(footer.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
  await expect(footer.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);

  await footer.getByRole('button', { name: 'Save and close' }).click();
  await expect(dialog).toBeHidden();
  dialog = await openDialog(page);
  await expect(dialog.getByLabel('Title')).toHaveValue(TITLE);
  await expect(dialog.getByLabel('Description')).toHaveValue(DESCRIPTION + ADDITION);
  expect(calls).toBe(1);
});

test('sluitknop: leeg formulier Sluiten, na typen Bewaren en sluiten, en de tekst blijft bewaard', async ({ page, ops }) => {
  void ops;
  let dialog = await openDialog(page);
  const footer = dialog.locator('.feedback-dialog-footer');
  const header = dialog.locator('.feedback-dialog-header');
  await expect(footer.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
  await expect(header.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
  await expect(footer.getByRole('button', { name: 'Save and close' })).toHaveCount(0);

  await typeInto(page, dialog.getByLabel('Title'), TITLE);
  await expect(footer.getByRole('button', { name: 'Save and close' })).toBeVisible();
  await expect(header.getByRole('button', { name: 'Save and close' })).toBeVisible();
  await expect(footer.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);

  await footer.getByRole('button', { name: 'Save and close' }).click();
  await expect(dialog).toBeHidden();
  dialog = await openDialog(page);
  await expect(dialog.getByLabel('Title')).toHaveValue(TITLE);
  await expect(dialog.locator('.feedback-dialog-footer').getByRole('button', { name: 'Save and close' })).toBeVisible();
});

test('sluitknop: een soort kiezen is geen inhoud', async ({ page, ops }) => {
  void ops;
  const dialog = await openDialog(page);
  const footer = dialog.locator('.feedback-dialog-footer');
  const header = dialog.locator('.feedback-dialog-header');
  const kinds = ["Something's not working", 'Idea', 'Question or comment'];
  for (const kind of kinds) {
    await dialog.getByRole('button', { name: kind }).click();
    await expect(footer.getByRole('button', { name: 'Close', exact: true }), `${kind}: leeg`).toBeVisible();
    await expect(header.getByRole('button', { name: 'Close', exact: true }), `${kind}: leeg (kruisje)`).toBeVisible();
    await expect(footer.getByRole('button', { name: 'Save and close' })).toHaveCount(0);
  }
  await typeInto(page, dialog.getByLabel('Title'), TITLE);
  for (const kind of kinds) {
    await dialog.getByRole('button', { name: kind }).click();
    await expect(footer.getByRole('button', { name: 'Save and close' }), `${kind}: met titel`).toBeVisible();
    await expect(header.getByRole('button', { name: 'Save and close' }), `${kind}: met titel (kruisje)`).toBeVisible();
  }
});

// Echte toetsaanslagen (CDP `Input.dispatchKeyEvent`, wat ook `page.keyboard` gebruikt), maar elke
// toets direct na de vorige, zonder op de pagina te wachten. Zo typt een snelle typist, en zo liep
// de CI vast: een extra render per toets bleef open tot de volgende toets. React telde elke toets
// dan als geneste update en gooide na 50 toetsen "Maximum update depth exceeded"; een teken viel weg.
async function typeFast(page: Page, text: string) {
  const cdp = await page.context().newCDPSession(page);
  const sent: Array<Promise<unknown>> = [];
  for (const key of text) {
    sent.push(cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, text: key, unmodifiedText: key }));
    sent.push(cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key }));
  }
  await Promise.all(sent);
  await cdp.detach();
}

test('snel typen: geen teken valt weg en React blijft onder de grens voor geneste updates', async ({ page, ops }) => {
  void ops;
  const dialog = await openDialog(page);
  // Ruim boven de grens van 50: twee keer de omschrijving, 107 tekens.
  const LONG = `${DESCRIPTION} ${DESCRIPTION}`;
  await dialog.getByLabel('Description').click();
  await typeFast(page, LONG);
  await expect(dialog.getByLabel('Description')).toHaveValue(LONG);
});
