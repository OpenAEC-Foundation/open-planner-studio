import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeReleaseChecksums } from './release-checksums.mjs';

test('SHA256SUMS dekt de echte bytes, ook bij spaties, herhaling en een gewijzigd AppImage', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ops-checksums-'));
  try {
    assert.throws(() => writeReleaseChecksums(dir), /Geen releasebestanden/);
    writeFileSync(join(dir, 'Planner 2026.44.0.AppImage'), Buffer.from([0, 1, 128, 255]));
    writeFileSync(join(dir, 'Planner 2026.44.0.AppImage.sig'), 'bestaande handtekening');
    const first = writeReleaseChecksums(dir);
    assert.equal(first.trim().split('\n').length, 2);
    assert.equal(writeReleaseChecksums(dir), first, 'een herhaling neemt SHA256SUMS niet in zichzelf op');
    execFileSync('sha256sum', ['--check', 'SHA256SUMS'], { cwd: dir, stdio: 'pipe' });
    writeFileSync(join(dir, 'Planner 2026.44.0.AppImage'), 'gewijzigd');
    assert.throws(() => execFileSync('sha256sum', ['--check', 'SHA256SUMS'], { cwd: dir, stdio: 'pipe' }));
    assert.notEqual(writeReleaseChecksums(dir), first);
    execFileSync('sha256sum', ['--check', 'SHA256SUMS'], { cwd: dir, stdio: 'pipe' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
