import { hasReleaseEndClaim } from '../../scripts/lib/release-docs-check';

const cases: Array<[string, boolean]> = [
  ['De release heeft geen deadline.', false],
  ['The release has no deadline.', false],
  ['De reparatie stopt om 14:00.', false],
  ['Wees klaar voor de release. Lukt dat niet, ga door tot 14:00.', false],
  ['Een deadline voor de vertaling staat om 14:00.', false],
  ['Om 14:00 stopt ook de release.', true],
  ['De release stopt om 14:00.', true],
  ['The release deadline is 14:00.', true],
  ['De release heeft geen deadline, maar de release stopt om 14:00.', true],
  ['De release heeft geen deadline, maar stopt om 14:00.', true],
  ['De release heeft geen deadline, maar de reparatie stopt om 14:00.', false],
  ['De release stopt niet vóór 14:00.', true],
];
for (const [line, expected] of cases) {
  const actual = hasReleaseEndClaim(line);
  if (actual !== expected) throw new Error(`release-eindtijd: ${JSON.stringify(line)}: ${actual}, verwacht ${expected}`);
}
console.log('OK release-eindtijd vangrail', cases.length);
