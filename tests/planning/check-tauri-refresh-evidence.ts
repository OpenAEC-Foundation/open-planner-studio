import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readIFC } from '@/services/ifc/ifcReader';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const evidenceRoot = 'docs/superpowers/evidence';
const paths = {
  before: `${evidenceRoot}/tabel-overhaul-tauri-refresh-before.ifc`,
  after: `${evidenceRoot}/tabel-overhaul-tauri-refresh-after.ifc`,
  source: `${evidenceRoot}/tabel-overhaul-tauri-refresh-source.ifc`,
} as const;
const bytes = Object.fromEntries(Object.entries(paths).map(([key, path]) => (
  [key, readFileSync(path)]
))) as Record<keyof typeof paths, Buffer>;
const hashes = Object.fromEntries(Object.entries(bytes).map(([key, value]) => (
  [key, createHash('sha256').update(value).digest('hex')]
)));

eq('Vastgelegde desktopbestanden hebben de gecontroleerde SHA-256-hashes', hashes, {
  before: 'f032ecaf7f72bcd29be36f8c977069698eb747fc4a292cfb59f979583c7dde5c',
  after: '356494bd9b41480f4f17c08d88f23bc187275df9eca557f28f2ab95e4fc617e3',
  source: 'bc9037903f3aa2dfe83516a873f596219512b6fddd41452c9d8fb266ce3bc6bc',
});

const before = readIFC(bytes.before.toString('utf8'));
const after = readIFC(bytes.after.toString('utf8'));
const source = readIFC(bytes.source.toString('utf8'));
const beforeTask = before.tasks.find(task => task.name === 'UI doelactiviteit');
const afterTask = after.tasks.find(task => task.name === 'UI doelactiviteit');
const sourceTask = source.tasks.find(task => task.name === 'Externe bronactiviteit');
const beforeLink = beforeTask?.externalLinks?.find(link => link.id === 'ext-review-ui');
const afterLink = afterTask?.externalLinks?.find(link => link.id === 'ext-review-ui');

eq('Voorbestand bevat exact de verouderde externe link', beforeLink && {
  anchorDate: beforeLink.anchorDate,
  sourceMissing: beforeLink.sourceMissing,
  projectId: beforeLink.sourceRef.projectId,
  projectName: beforeLink.sourceRef.projectName,
  taskId: beforeLink.sourceRef.taskId,
  taskName: beforeLink.sourceRef.taskName,
}, {
  anchorDate: '2026-07-01',
  sourceMissing: true,
  projectId: 'legacy-project-id',
  projectName: 'Verouderde UI bron',
  taskId: 'task-ifc-urgPb5NfMvjfZ9SFNfwJQl',
  taskName: 'Verouderde UI taak',
});
eq('Nabestand bevat exact het door de bron ververste anker en de canonieke identiteit',
  afterLink && {
    anchorDate: afterLink.anchorDate,
    sourceMissing: afterLink.sourceMissing,
    projectId: afterLink.sourceRef.projectId,
    projectName: afterLink.sourceRef.projectName,
    taskId: afterLink.sourceRef.taskId,
    taskName: afterLink.sourceRef.taskName,
  },
  sourceTask && {
    anchorDate: '2026-09-02',
    sourceMissing: false,
    projectId: source.project.id,
    projectName: source.project.name,
    taskId: sourceTask.id,
    taskName: sourceTask.name,
  });
eq('De doelactiviteit behoudt door de desktopverversing dezelfde interne identiteit',
  [beforeTask?.id, afterTask?.id], ['task-mtajsw9pjda4476', 'task-mtajsw9pjda4476']);
eq('De vastgelegde bron eindigt op het ververste externe anker',
  sourceTask?.time.scheduleFinish.slice(0, 10), '2026-09-02');

if (diffs.length > 0) {
  console.error(`FAIL tauri-refresh-evidence: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exit(1);
}
console.log(`OK  tauri-refresh-evidence: ${checks}/${checks}`);
