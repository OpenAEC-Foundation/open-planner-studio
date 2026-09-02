import assert from 'node:assert/strict';
import { assertGitEvidenceUnchanged } from './x11-xer-evidence.mjs';

const begin = Object.freeze({
  toplevel: '/tmp/ops-xer-x11-harness',
  branch: 'codex/xer-x11-harness',
  head: '900358f2ed5c6b70b5bec0afeea0891fa8678715',
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

console.log('OK git-evidence-contract: toplevel, branch, HEAD en raw status zijn exact gepind');
