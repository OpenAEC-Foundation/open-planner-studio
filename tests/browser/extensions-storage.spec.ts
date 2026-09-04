import { expect, test, waitForOps } from './fixtures/ops';

test('extension storage: reparatie vervangt quarantaine zonder het geldige record te bedreigen', async ({ page, ops: _ops }) => {
  test.setTimeout(60_000);

  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ops-extensions', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('extensions')) {
          request.result.createObjectStore('extensions', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('extensions', 'readwrite');
      const store = tx.objectStore('extensions');
      store.clear();
      store.put({ id: 'repair-demo', manifest: 17, mainCode: 99, enabled: 'ja' });
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });

  await page.reload();
  await waitForOps(page);
  const skipWelcome = page.getByRole('button', { name: /^(Skip|Overslaan)$/ });
  await expect(skipWelcome).toBeVisible();
  await skipWelcome.click();
  await page.getByRole('button', { name: /^(File|Bestand)$/ }).click();
  await page.getByRole('button', { name: /^(Extensions|Extensies)$/ }).click();

  await expect(page.getByTestId('extension-ready-card')).toHaveCount(0);
  await expect(page.getByTestId('extension-quarantine-card')).toHaveCount(1);

  await page.evaluate(async () => {
    await window.__OPS__!.extensions.installFromCode({
      id: 'repair-demo',
      name: 'Gerepareerde extensie',
      version: '1.0.0',
      apiVersion: '1.0',
      minAppVersion: '0.0.0',
      author: 'Browserfixture',
      description: '',
      category: 'Utility',
      main: 'main.js',
      permissions: [],
    }, 'module.exports = { onLoad() {} };');
  });

  await expect(page.getByTestId('extension-ready-card')).toHaveCount(1);
  await expect(page.getByTestId('extension-quarantine-card')).toHaveCount(0);
  await expect(page.getByTestId('extension-ready-card')).toContainText('Gerepareerde extensie');

  const persisted = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ops-extensions', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction('extensions', 'readonly');
      const request = tx.objectStore('extensions').get('repair-demo');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return window.__OPS__!.extensions.scanStored().then(scan => ({
      recordExists: record !== undefined,
      validation: scan.find(item => item.storageKey === 'repair-demo')?.ok,
    }));
  });
  expect(persisted).toEqual({ recordExists: true, validation: true });
});

test('extension storage: scant vier echte IndexedDB-records zonder code uit te voeren', async ({ page, ops }) => {
  test.setTimeout(60_000);
  await page.evaluate(async () => {
    Object.defineProperty(window, '__opsExtensionStorageOnLoad', {
      configurable: true,
      writable: true,
      value: 0,
    });

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ops-extensions', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('extensions')) {
          request.result.createObjectStore('extensions', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const modernManifest = (id: string): Record<string, unknown> => ({
      id,
      name: `Extensie ${id}`,
      version: '1.0.0',
      apiVersion: '1.0',
      minAppVersion: '0.0.0',
      author: 'Browserfixture',
      description: '',
      category: 'Utility',
      main: 'main.js',
      permissions: ['events'],
    });
    const legacyManifest = modernManifest('01-legacy');
    delete legacyManifest.permissions;
    delete legacyManifest.minAppVersion;
    const effectCode = 'window.__opsExtensionStorageOnLoad += 1; module.exports = { onLoad() {} };';

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('extensions', 'readwrite');
      const store = tx.objectStore('extensions');
      store.clear();
      store.put({ id: '01-legacy', manifest: legacyManifest, mainCode: effectCode, enabled: false });
      store.put({ id: '02-corrupt', manifest: 17, mainCode: 99, enabled: 'ja' });
      store.put({
        id: '03-mismatch',
        manifest: modernManifest('03-andere-manifest-id'),
        mainCode: effectCode,
        enabled: false,
      });
      store.put({
        id: '04-modern',
        manifest: modernManifest('04-modern'),
        mainCode: effectCode,
        enabled: true,
      });
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });

  const beforeKeys = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ops-extensions', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const tx = db.transaction('extensions', 'readonly');
      const request = tx.objectStore('extensions').getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return keys;
  });

  const scan = await page.evaluate(() => window.__OPS__!.extensions.scanStored());

  const after = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ops-extensions', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const tx = db.transaction('extensions', 'readonly');
      const request = tx.objectStore('extensions').getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return {
      keys,
      onLoadEffects: (window as unknown as { __opsExtensionStorageOnLoad: number })
        .__opsExtensionStorageOnLoad,
    };
  });

  expect(beforeKeys).toEqual(['01-legacy', '02-corrupt', '03-mismatch', '04-modern']);
  expect(scan).toHaveLength(4);
  expect(scan.map(record => ({ storageKey: record.storageKey, ok: record.ok }))).toEqual([
    { storageKey: '01-legacy', ok: true },
    { storageKey: '02-corrupt', ok: false },
    { storageKey: '03-mismatch', ok: false },
    { storageKey: '04-modern', ok: true },
  ]);
  expect(scan.filter(record => !record.ok).every(record => Boolean(record.reason))).toBe(true);
  expect(after.keys).toEqual(beforeKeys);
  expect(after.onLoadEffects).toBe(0);

  const quarantineIds = await page.evaluate(() => {
    const makeId = window.__OPS__!.extensions.quarantineIdForKey;
    return [
      makeId('1'),
      makeId(1),
      makeId(new Date(1)),
      makeId(new Uint8Array([1]).buffer),
      makeId(['1', 1, new Uint8Array([1])]),
    ];
  });
  expect(new Set(quarantineIds).size).toBe(quarantineIds.length);
  expect(quarantineIds.every(id => /^q:[0-9a-f]+$/.test(id))).toBe(true);

  await page.addInitScript(() => {
    Object.defineProperty(window, '__opsExtensionStorageOnLoad', {
      configurable: true,
      writable: true,
      value: 0,
    });
  });
  await page.reload();
  await waitForOps(page);

  await expect.poll(() => page.evaluate(() => {
    const store = window.__OPS__!.store.getState();
    return {
      ready: Object.keys(store.installedExtensions),
      quarantined: Object.keys(store.quarantinedExtensions),
    };
  })).toEqual({
    ready: ['01-legacy', '04-modern'],
    quarantined: expect.arrayContaining([
      expect.stringMatching(/^q:[0-9a-f]+$/),
      expect.stringMatching(/^q:[0-9a-f]+$/),
    ]),
  });
  expect(await page.evaluate(() => (
    window as unknown as { __opsExtensionStorageOnLoad: number }
  ).__opsExtensionStorageOnLoad)).toBe(1);

  const skipWelcome = page.getByRole('button', { name: /^(Skip|Overslaan)$/ });
  await expect(skipWelcome).toBeVisible();
  await skipWelcome.click();
  await page.getByRole('button', { name: /^(File|Bestand)$/ }).click();
  await page.getByRole('button', { name: /^(Extensions|Extensies)$/ }).click();

  await expect(page.getByTestId('extension-ready-card')).toHaveCount(2);
  const quarantineCards = page.getByTestId('extension-quarantine-card');
  await expect(quarantineCards).toHaveCount(2);
  await expect(quarantineCards.locator('.ext-toggle')).toHaveCount(0);
  await expect(quarantineCards.first().getByText(/^(Quarantine|Quarantaine)$/)).toBeVisible();
  await expect(quarantineCards.first().getByText(/^(Reason|Reden):/)).toBeVisible();

  const remove = quarantineCards.first().getByTestId('extension-quarantine-remove');
  await remove.click();
  await expect(quarantineCards).toHaveCount(2);
  await remove.click();
  await expect(quarantineCards).toHaveCount(1);

  const remaining = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ops-extensions', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const tx = db.transaction('extensions', 'readonly');
      const request = tx.objectStore('extensions').getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return {
      keys,
      quarantineCount: Object.keys(window.__OPS__!.store.getState().quarantinedExtensions).length,
    };
  });
  expect(remaining.keys).toEqual(['01-legacy', '03-mismatch', '04-modern']);
  expect(remaining.quarantineCount).toBe(1);

  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ops-extensions', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('extensions', 'readwrite');
      const request = tx.objectStore('extensions').get('01-legacy');
      request.onsuccess = () => {
        const value = request.result;
        value.manifest = 17;
        tx.objectStore('extensions').put(value);
      };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });

  const legacyReadyCard = page.getByTestId('extension-ready-card').filter({ hasText: 'Extensie 01-legacy' });
  await legacyReadyCard.locator('.ext-toggle').click();
  await expect(legacyReadyCard).toHaveCount(0);
  await expect(page.getByTestId('extension-quarantine-card')).toHaveCount(2);
  await expect(page.getByTestId('extension-quarantine-card').filter({
    hasText: 'manifest moet een object zijn',
  })).toHaveCount(1);
  expect(await page.evaluate(() => (
    window as unknown as { __opsExtensionStorageOnLoad: number }
  ).__opsExtensionStorageOnLoad)).toBe(1);

  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ops-extensions', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const manifest = (id: string) => ({
      id,
      name: `Extensie ${id}`,
      version: '1.0.0',
      apiVersion: '1.0',
      minAppVersion: '0.0.0',
      author: 'Browserfixture',
      description: '',
      category: 'Utility',
      main: 'main.js',
      permissions: ['events'],
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('extensions', 'readwrite');
      const store = tx.objectStore('extensions');
      store.put({
        id: '05-onload-error',
        manifest: manifest('05-onload-error'),
        mainCode: 'module.exports = { onLoad() { window.__opsFailingOnLoad += 1; throw new Error("bewuste onLoad-fout"); } };',
        enabled: true,
      });
      store.put({
        id: '06-after-error',
        manifest: manifest('06-after-error'),
        mainCode: 'module.exports = { onLoad() { window.__opsAfterOnLoadError += 1; } };',
        enabled: true,
      });
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, '__opsFailingOnLoad', { configurable: true, writable: true, value: 0 });
    Object.defineProperty(window, '__opsAfterOnLoadError', { configurable: true, writable: true, value: 0 });
  });
  ops.acceptError('Activeren van "05-onload-error" mislukt');
  await page.reload();
  await waitForOps(page);

  await expect.poll(() => page.evaluate(() => {
    const store = window.__OPS__!.store.getState();
    return {
      failing: store.installedExtensions['05-onload-error']?.status,
      after: store.installedExtensions['06-after-error']?.status,
      readyIds: Object.keys(store.installedExtensions),
      quarantined: Object.keys(store.quarantinedExtensions).length,
    };
  })).toEqual({
    failing: 'error',
    after: 'enabled',
    readyIds: ['04-modern', '05-onload-error', '06-after-error'],
    quarantined: 2,
  });
  expect(await page.evaluate(() => ({
    failedEffects: (window as unknown as { __opsFailingOnLoad: number }).__opsFailingOnLoad,
    laterEffects: (window as unknown as { __opsAfterOnLoadError: number }).__opsAfterOnLoadError,
  }))).toEqual({ failedEffects: 1, laterEffects: 1 });
});
