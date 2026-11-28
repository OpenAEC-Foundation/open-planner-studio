import { readFileSync } from 'node:fs';
import { REPAIR_SKILL, staleReleaseDocLine } from '../../scripts/lib/release-docs-check';

const release = '.claude/skills/release/referentie.md';
const repair = readFileSync(REPAIR_SKILL, 'utf8');
const cases: Array<[string, string, number | undefined]> = [
  [release, '# Release\nStop om 14:00.', 2],
  [release, '# Release\nStel de deadline vast.', 2],
  [release, 'De release heeft geen deadline.', undefined],
  [release, 'The release has no fixed deadline.', undefined],
  [release, 'De browserreparatie stopt om 14:00.', undefined],
  [release, 'De release heeft geen deadline, maar stopt om 14:00.', 1],
  [release, 'De release heeft geen deadline. Stop om 14:00.', 1],
  [release, 'De release draait op zaterdag.', 1],
  [REPAIR_SKILL, repair, undefined],
  [REPAIR_SKILL, '# Release\nOm 14:00 stopt ook de release.', 2],
  [REPAIR_SKILL, '# Release\nStop om 14:00.', 2],
  [REPAIR_SKILL, '## Stoppen om 14:00, ook voor de release', 1],
  [release, '## Stoppen om 14:00', 1],
  [REPAIR_SKILL, '## Stoppen om 14:00\nStop om 14:00.', 2],
];
for (const [path, text, expected] of cases) {
  const actual = staleReleaseDocLine(path, text);
  if (actual !== expected) throw new Error(`release-eindtijd ${path}: ${actual}, verwacht ${expected}`);
}
console.log('OK release-eindtijd vangrail', cases.length);
