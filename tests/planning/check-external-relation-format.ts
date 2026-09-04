import { createHash } from 'node:crypto';
import {
  externalAnchorSideIsCompatible,
  externalSourcePathKey,
  formatExternalLagShort,
  formatExternalRelationClipboard,
  normalizeExternalSourcePath,
  parseExternalLagInput,
  parseExternalRelationClipboard,
  sourceProjectKeyFor,
} from '@/engine/taskGrid/relationFormat';
import type { ExternalLink } from '@/types/task';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, value: boolean): void { eq(label, value, true); }

// De acht letterlijke contractvectoren uit §8.5.1. Dit zijn bewust geen host-OS-paden:
// dezelfde pure normalisatie moet in browser, Node, Windows en Linux exact hetzelfde opleveren.
const pathVectors: readonly [string, string | null][] = [
  ['C:\\A\\.\\X\\..\\B.ifc', 'c:/a/b.ifc'],
  ['c:/a/b.ifc', 'c:/a/b.ifc'],
  ['\\\\Server\\Share\\A\\B.ifc', '//server/share/a/b.ifc'],
  ['//SERVER/SHARE/a/./b.ifc', '//server/share/a/b.ifc'],
  ['/A/B.ifc', '/A/B.ifc'],
  ['/a/b.ifc', '/a/b.ifc'],
  ['C:/../../b.ifc', null],
  ['relative/b.ifc', null],
];
for (const [input, expected] of pathVectors) {
  eq(`padvector ${input}`, normalizeExternalSourcePath(input), expected);
}
eq('leeg pad is ongeldig', normalizeExternalSourcePath(''), null);
eq('NUL-pad is ongeldig', normalizeExternalSourcePath('/a\0b.ifc'), null);
eq('POSIX-backslash blijft naamteken', normalizeExternalSourcePath('/A\\B/./C'), '/A\\B/C');
eq('drive-root behoudt slash', normalizeExternalSourcePath('C:\\'), 'c:/');
eq('UNC-root heeft server en share', normalizeExternalSourcePath('\\\\Server\\Share\\'), '//server/share');
eq('UNC zonder share is ongeldig', normalizeExternalSourcePath('//server'), null);

const driveKey = externalSourcePathKey('C:\\A\\.\\X\\..\\B.ifc');
const driveKey2 = externalSourcePathKey('c:/a/b.ifc');
const uncKey = externalSourcePathKey('\\\\Server\\Share\\A\\B.ifc');
const uncKey2 = externalSourcePathKey('//SERVER/SHARE/a/./b.ifc');
eq('Windows-drivepaar heeft byte-identieke key', driveKey, driveKey2);
eq('UNC-paar heeft byte-identieke key', uncKey, uncKey2);
eq('POSIX-case blijft verschillende key', externalSourcePathKey('/A/B.ifc') === externalSourcePathKey('/a/b.ifc'), false);
eq(
  'SHA-256 hasht exact de UTF-8-bytes van het genormaliseerde pad',
  driveKey,
  `path-sha256:${createHash('sha256').update('c:/a/b.ifc', 'utf8').digest('hex')}`,
);
const unicodePath = '/Projecten/één/非常に-lang-pad-'.repeat(5) + 'bron.ifc';
eq(
  'SHA-256 blijft exact voor UTF-8 en meerdere 64-byteblokken',
  externalSourcePathKey(unicodePath),
  `path-sha256:${createHash('sha256').update(unicodePath, 'utf8').digest('hex')}`,
);

eq('project-id heeft altijd prioriteit boven filePath', sourceProjectKeyFor(
  { projectId: 'Project-1', taskId: 'T', filePath: '/bron.ifc' },
  { ownerTaskId: 'owner', direction: 'predecessor', linkId: 'link' },
), 'project:Project-1');
eq('zonder project-id gebruikt een geldig absoluut pad de hash', sourceProjectKeyFor(
  { projectId: '', taskId: 'T', filePath: '/bron.ifc' },
  { ownerTaskId: 'owner', direction: 'predecessor', linkId: 'link' },
), externalSourcePathKey('/bron.ifc'));
eq('zonder overdraagbare bron blijft alleen id-only over', sourceProjectKeyFor(
  { projectId: '', taskId: 'T', filePath: 'relatief.ifc' },
  { ownerTaskId: 'owner', direction: 'predecessor', linkId: 'link' },
), 'id-only:owner:link');

eq('externe lag: kaal getal is dagen', parseExternalLagInput('2'), { lagDays: 2 });
eq('externe lag: d is dagen', parseExternalLagInput('-1d'), { lagDays: -1 });
eq('externe lag: u is minuten', parseExternalLagInput('1.5u'), { lagMinutes: 90 });
eq('externe lag: h is alleen invoeralias', parseExternalLagInput('-2h'), { lagMinutes: -120 });
eq('externe lag: leeg is expliciet nul dagen', parseExternalLagInput(''), { lagDays: 0 });
for (const rejected of ['50%', '-25e%', '3ed', '2eu', '2eh']) {
  eq(`externe lag wijst ${rejected} af`, parseExternalLagInput(rejected), null);
}
eq('externe dagformatter', formatExternalLagShort({ lagDays: 2 }), '+2d');
eq('externe uurformatter', formatExternalLagShort({ lagMinutes: 90 }), '+1.5u');
eq('externe nulformatter', formatExternalLagShort({ lagDays: 0 }), '');

const link: ExternalLink = {
  id: 'ext-17',
  direction: 'predecessor',
  relType: 'FS',
  lagDays: 2,
  anchorDate: '2026-06-10T12:30',
  sourceRef: {
    projectId: 'bron-1',
    projectName: 'Project, "West" / A\\B',
    taskId: 'taak-9',
    taskName: 'Fundering / "Noord", X',
    filePath: 'C:\\Projecten\\West.ifc',
  },
  sourceMissing: false,
};
const token = formatExternalRelationClipboard('owner-1', link);
ok('zichtbaar label quote komma, slash, quote en backslash', token.startsWith(
  '"Project, \\"West\\" / A\\\\B" / "Fundering / \\"Noord\\", X" FS+2d ⟦OPS-EXT/1:',
));
eq('base64url bevat geen padding', /⟦OPS-EXT\/1:[A-Za-z0-9_-]+⟧$/.test(token), true);

const suffix = token.match(/⟦OPS-EXT\/1:([A-Za-z0-9_-]+)⟧$/)?.[1] ?? '';
const payloadJson = Buffer.from(suffix, 'base64url').toString('utf8');
eq('payload heeft vaste JSON-sleutelvolgorde', Object.keys(JSON.parse(payloadJson)), [
  'v', 'origin', 'sourceProjectKey', 'sourceRef', 'relType', 'lagDays', 'anchorDate', 'sourceMissing',
]);
eq('origin heeft vaste sleutelvolgorde', Object.keys(JSON.parse(payloadJson).origin), [
  'ownerTaskId', 'direction', 'linkId',
]);
eq('sourceRef heeft vaste sleutelvolgorde', Object.keys(JSON.parse(payloadJson).sourceRef), [
  'projectId', 'projectName', 'taskId', 'taskName', 'filePath',
]);

const roundTrip = parseExternalRelationClipboard(token, { ownerTaskId: 'owner-1', direction: 'predecessor' });
eq('exacte Excel-roundtrip slaagt', roundTrip.ok, true);
if (roundTrip.ok) {
  eq('roundtrip bewaart technische sourceRef exact', roundTrip.value.sourceRef, link.sourceRef);
  eq('roundtrip bewaart oorspronkelijke link-idmetadata', roundTrip.value.origin.linkId, link.id);
  eq('roundtrip levert zichtbare daglag als gewenste waarde', roundTrip.value.lag, { lagDays: 2 });
  eq('roundtrip levert zichtbaar type als gewenste waarde', roundTrip.value.relType, 'FS');
}

const changedLag = token.replace('FS+2d ⟦', 'FS-1.5u ⟦');
const lagResult = parseExternalRelationClipboard(changedLag, { ownerTaskId: 'owner-1', direction: 'predecessor' });
eq('Excel mag zichtbare lag wijzigen', lagResult.ok ? lagResult.value.lag : null, { lagMinutes: -90 });
eq('Excel mag geen niet-opslagbare externe procentlag invoeren', parseExternalRelationClipboard(
  token.replace('FS+2d ⟦', 'FS+50% ⟦'),
  { ownerTaskId: 'owner-1', direction: 'predecessor' },
).ok, false);
const changedType = token.replace('FS+2d ⟦', 'FF+2d ⟦');
const typeResult = parseExternalRelationClipboard(changedType, { ownerTaskId: 'owner-1', direction: 'predecessor' });
eq('Excel mag type wijzigen als bronzijde gelijk blijft', typeResult.ok ? typeResult.value.relType : null, 'FF');
const changedLabel = token.replace('Fundering', 'Andere bron');
eq('gewijzigd bronlabel wordt geweigerd', parseExternalRelationClipboard(
  changedLabel, { ownerTaskId: 'owner-1', direction: 'predecessor' },
).ok, false);
eq('verwijderde suffix wordt geweigerd', parseExternalRelationClipboard(
  token.replace(/ ⟦OPS-EXT\/1:[A-Za-z0-9_-]+⟧$/, ''),
  { ownerTaskId: 'owner-1', direction: 'predecessor' },
).ok, false);

function replacePayload(mutator: (payload: Record<string, unknown>) => void): string {
  const payload = JSON.parse(payloadJson) as Record<string, unknown>;
  mutator(payload);
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return token.replace(suffix, encoded);
}
eq('onbekende versie wordt geweigerd', parseExternalRelationClipboard(
  replacePayload(payload => { payload.v = 2; }),
  { ownerTaskId: 'owner-1', direction: 'predecessor' },
).ok, false);
eq('extra payloadveld wordt geweigerd', parseExternalRelationClipboard(
  replacePayload(payload => { payload.extra = true; }),
  { ownerTaskId: 'owner-1', direction: 'predecessor' },
).ok, false);
eq('extra sourceRef-veld wordt geweigerd', parseExternalRelationClipboard(
  replacePayload(payload => { (payload.sourceRef as Record<string, unknown>).credential = 'verboden'; }),
  { ownerTaskId: 'owner-1', direction: 'predecessor' },
).ok, false);
{
  const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
  const { v, ...withoutVersion } = parsed;
  const reordered = Buffer.from(JSON.stringify({ ...withoutVersion, v }), 'utf8').toString('base64url');
  eq('andere JSON-sleutelvolgorde wordt geweigerd', parseExternalRelationClipboard(
    token.replace(suffix, reordered),
    { ownerTaskId: 'owner-1', direction: 'predecessor' },
  ).ok, false);
}
eq('onjuiste sourceProjectKey wordt geweigerd', parseExternalRelationClipboard(
  replacePayload(payload => { payload.sourceProjectKey = 'project:vals'; }),
  { ownerTaskId: 'owner-1', direction: 'predecessor' },
).ok, false);
eq('ongeldige ISO-datum wordt geweigerd', parseExternalRelationClipboard(
  replacePayload(payload => { payload.anchorDate = '2026-02-30'; }),
  { ownerTaskId: 'owner-1', direction: 'predecessor' },
).ok, false);
eq('ongeldige ISO-tijdzone wordt geweigerd', parseExternalRelationClipboard(
  replacePayload(payload => { payload.anchorDate = '2026-02-20T12:00+15:00'; }),
  { ownerTaskId: 'owner-1', direction: 'predecessor' },
).ok, false);
eq('te lange string wordt geweigerd', parseExternalRelationClipboard(
  replacePayload(payload => { (payload.origin as Record<string, unknown>).linkId = 'x'.repeat(513); }),
  { ownerTaskId: 'owner-1', direction: 'predecessor' },
).ok, false);
eq('payload met twee lagbronnen wordt geweigerd', parseExternalRelationClipboard(
  replacePayload(payload => { payload.lagMinutes = 60; }),
  { ownerTaskId: 'owner-1', direction: 'predecessor' },
).ok, false);

eq('pred-FS naar succ-FF behoudt finishbron', externalAnchorSideIsCompatible(
  'predecessor', 'FS', 'successor', 'FF',
), true);
eq('pred-FS naar succ-FS wisselt finish naar start', externalAnchorSideIsCompatible(
  'predecessor', 'FS', 'successor', 'FS',
), false);
eq('zijdewissel wordt atomair door parser geweigerd', parseExternalRelationClipboard(
  token, { ownerTaskId: 'owner-2', direction: 'successor' },
).ok, false);
const crossDirection = token.replace('FS+2d ⟦', 'FF+2d ⟦');
eq('andere richting mag wel wanneer zichtbaar type dezelfde bronzijde houdt', parseExternalRelationClipboard(
  crossDirection, { ownerTaskId: 'owner-2', direction: 'successor' },
).ok, true);

const idOnlyLink: ExternalLink = {
  id: 'legacy-link', direction: 'predecessor', relType: 'SS', anchorDate: '2026-06-01',
  sourceRef: { projectId: '', taskId: 'oude-taak', filePath: 'relatief.ifc' }, sourceMissing: true,
};
const idOnlyToken = formatExternalRelationClipboard('legacy-owner', idOnlyLink);
eq('id-only werkt in exact dezelfde cel', parseExternalRelationClipboard(
  idOnlyToken, { ownerTaskId: 'legacy-owner', direction: 'predecessor' },
).ok, true);
eq('id-only mag niet naar een andere taak', parseExternalRelationClipboard(
  idOnlyToken, { ownerTaskId: 'andere-owner', direction: 'predecessor' },
).ok, false);

if (diffs.length) {
  console.error(`EXTERNAL RELATION FORMAT: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  XX ${diff}`);
  process.exit(1);
}
console.log(`OK  external relation format: ${checks}/${checks} checks groen`);
