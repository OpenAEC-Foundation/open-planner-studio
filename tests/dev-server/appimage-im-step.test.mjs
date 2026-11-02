import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Knownbug 595: voer de echte workflowstap uit met de standaardshell van een Linux-run-stap
// (bash -e, zonder impliciete pipefail). Alleen het uitpakken van de AppImage is een lichte fixture.
const workflow = readFileSync(new URL('../../.github/workflows/appimage-im-check.yml', import.meta.url), 'utf8');
const step = workflow.split('      - name: Verify AppImage input-method modules\n')[1];
assert.ok(step, 'de modulecontrole bestaat');
const script = step.split('        run: |\n')[1].split('\n      - name:')[0]
  .split('\n').map(line => line.replace(/^          /, '')).join('\n');

for (const variant of ['compleet', 'cache-id ontbreekt', 'modulebestand ontbreekt', 'link is kapot', 'geen AppImage']) {
  test(`AppImage-workflow: ${variant}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'ops-appimage-step-'));
    try {
      const appdir = join(dir, 'fixture.AppDir');
      const library = join(appdir, 'usr/lib');
      const gtk = join(library, 'gtk-3.0/3.0.0');
      mkdirSync(join(appdir, 'apprun-hooks'), { recursive: true });
      mkdirSync(join(gtk, 'immodules'), { recursive: true });
      writeFileSync(join(appdir, 'apprun-hooks/linuxdeploy-plugin-gtk.sh'),
        'export GTK_IM_MODULE_FILE="$APPDIR/usr/lib/gtk-3.0/3.0.0/immodules.cache"\n');
      let cache = '';
      for (const id of ['ibus', 'fcitx', 'fcitx5']) {
        const file = `im-${id}.so`;
        if (id !== 'ibus' || variant !== 'cache-id ontbreekt') cache += `"${file}"\n"${id}" "Testmodule"\n`;
        if (id !== 'ibus' || variant !== 'modulebestand ontbreekt') writeFileSync(join(gtk, 'immodules', file), 'fixture');
        symlinkSync(id === 'ibus' && variant === 'link is kapot' ? 'ontbreekt.so' : `gtk-3.0/3.0.0/immodules/${file}`,
          join(library, file));
      }
      writeFileSync(join(gtk, 'immodules.cache'), cache);
      mkdirSync(join(dir, 'scripts'));
      symlinkSync(fileURLToPath(new URL('../../scripts/check-appimage-im-modules.sh', import.meta.url)),
        join(dir, 'scripts/check-appimage-im-modules.sh'));
      const output = join(dir, 'src-tauri/target/release/bundle/appimage');
      mkdirSync(output, { recursive: true });
      if (variant !== 'geen AppImage') {
        writeFileSync(join(output, 'fixture.AppImage'), '#!/usr/bin/env bash\ncp -a "$OPS_TEST_APPDIR" squashfs-root\n', { mode: 0o755 });
      }
      const summary = join(dir, 'summary.md');
      const result = spawnSync('bash', ['-e', '-c', script], {
        cwd: dir, encoding: 'utf8',
        env: { ...process.env, GITHUB_STEP_SUMMARY: summary, OPS_TEST_APPDIR: appdir },
      });
      assert.equal(result.status, variant === 'compleet' ? 0 : 1, result.stdout + result.stderr);
      if (variant === 'compleet') {
        assert.match(readFileSync(summary, 'utf8'), /Alle invoermodules aanwezig: ibus fcitx fcitx5/);
      } else {
        assert.match(result.stdout + result.stderr, /::error::/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
