import assert from 'node:assert/strict';
import {
  assertGitEvidenceUnchanged,
  assertMetadataGitIdentity,
} from './x11-xer-evidence.mjs';

const expectedParent = '790d6cd8266682fa9b7798a3d1f9e0a1a2498db9';

const begin = Object.freeze({
  toplevel: '/tmp/ops-xer-x11-harness',
  branch: 'codex/xer-x11-harness',
  head: '900358f2ed5c6b70b5bec0afeea0891fa8678715',
  parent: expectedParent,
  statusPorcelainV1: ' M known-dirty.txt\n?? known-untracked.txt\n',
});

assert.doesNotThrow(
  () => assertGitEvidenceUnchanged(begin, { ...begin }),
  'exact gelijke Git-identiteit inclusief raw dirty/untracked-status moet groen blijven',
);

const mutations = [
  ['toplevel', '/tmp/andere-worktree'],
  ['branch', 'andere-schone-branch'],
  ['head', '1111111111111111111111111111111111111111'],
  ['statusPorcelainV1', `${begin.statusPorcelainV1}?? during-run.txt\n`],
];

for (const [field, value] of mutations) {
  assert.throws(
    () => assertGitEvidenceUnchanged(begin, { ...begin, [field]: value }),
    (error) => {
      assert.match(error.message, /git-eindintegriteitsgate rood/);
      assert.match(error.message, new RegExp(`verschil=${field}(?:,|;)`));
      return true;
    },
    `${field}-verschil moet de eindintegriteitsgate rood maken`,
  );
}

const metadata = { git: { ...begin } };
if (process.env.OPS_X11_GIT_MUTATION === 'parent') {
  metadata.git.parent = '1111111111111111111111111111111111111111';
}
assertMetadataGitIdentity(metadata, begin);

console.log(`OK git-evidence-contract: vier eindpoorten en metadata-parent ${expectedParent} zijn exact gepind`);
