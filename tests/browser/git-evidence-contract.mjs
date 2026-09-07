import assert from 'node:assert/strict';
import {
  assertGitEvidenceUnchanged,
  assertMetadataGitIdentity,
  metadataGitIdentity,
} from './x11-xer-evidence.mjs';

const expectedBase = '790d6cd8266682fa9b7798a3d1f9e0a1a2498db9';
const expectedCommitParent = '00d82a43bc6e552d899c61dd0c3ae05f6e8f728a';

const begin = Object.freeze({
  toplevel: '/tmp/ops-xer-x11-harness',
  branch: 'codex/xer-x11-harness',
  head: '58f498ec76188b4459747a3dd1c72cce6d4a0ec4',
  base: expectedBase,
  commitParent: expectedCommitParent,
  statusPorcelainV1: ' M known-dirty.txt\n?? known-untracked.txt\n',
});

const end = { ...begin };
if (process.env.OPS_X11_GIT_MUTATION === 'base') {
  end.base = '1111111111111111111111111111111111111111';
}
if (process.env.OPS_X11_GIT_MUTATION === 'commit-parent') {
  end.commitParent = '2222222222222222222222222222222222222222';
}

if (process.env.OPS_X11_GIT_MUTATION) {
  assertGitEvidenceUnchanged(begin, end);
} else {
  assert.doesNotThrow(
    () => assertGitEvidenceUnchanged(begin, end),
    'exact gelijke Git-identiteit inclusief raw dirty/untracked-status moet groen blijven',
  );
}

const mutations = [
  ['toplevel', '/tmp/andere-worktree'],
  ['branch', 'andere-schone-branch'],
  ['head', '1111111111111111111111111111111111111111'],
  ['base', '2222222222222222222222222222222222222222'],
  ['commitParent', '3333333333333333333333333333333333333333'],
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

const metadata = { git: metadataGitIdentity(begin) };
assertMetadataGitIdentity(metadata, begin);
for (const [field, value] of [
  ['base', '1111111111111111111111111111111111111111'],
  ['commitParent', '2222222222222222222222222222222222222222'],
]) {
  const mutated = { ...metadata.git, [field]: value };
  assert.throws(
    () => assertMetadataGitIdentity({ git: mutated }, begin),
    /metadata-git-identiteitsgate rood/,
    `${field}-verschil moet ook de metadata-identiteitsgate rood maken`,
  );
}

console.log(
  `OK git-evidence-contract: Git-eindpoorten, fasebasis ${expectedBase} en directe commitparent ` +
    `${expectedCommitParent} zijn exact gepind`,
);
