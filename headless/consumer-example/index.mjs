#!/usr/bin/env node
// Minimaal extern consumeervoorbeeld van @openaec/open-planner-core.
// Gebruikt ALLEEN het gebouwde pakket (geen code uit src/ van de app).
//
//   node index.mjs <project.ifc> [--json] [--out <herberekend.ifc>]
//
// Exitcodes: 0 = doorgerekend, 1 = fout van de kern (code op stderr), 2 = verkeerd gebruik.
import { readFileSync, writeFileSync } from 'node:fs';
import { openIfc, PlannerCoreError, VERSION } from '@openaec/open-planner-core';

const args = process.argv.slice(2);
const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : undefined;
if (!file || (outIdx >= 0 && !out)) {
  console.error('usage: node index.mjs <project.ifc> [--json] [--out <recalculated.ifc>]');
  process.exit(2);
}

try {
  const doc = await openIfc(readFileSync(file, 'utf8'));
  const summary = doc.schedule();
  if (out) writeFileSync(out, doc.toIfc());

  if (args.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    const { project, counts, warnings } = summary;
    console.log(`open-planner-core ${VERSION}`);
    console.log(`${project.name}: ${project.start} → ${project.finish} (${project.durationWorkdays} workdays, profile ${project.schedulingProfile})`);
    console.log(`${counts.tasks} tasks, ${counts.relations} relations, ${counts.criticalTasks} critical, ${warnings.length} warning type(s)`);
    for (const t of summary.tasks.filter((t) => t.critical && !t.summary).slice(0, 10)) {
      console.log(`  ${t.wbs.padEnd(8)} ${t.start} → ${t.finish}  ${t.name}`);
    }
    if (out) console.log(`recalculated IFC written to ${out}`);
  }
} catch (err) {
  if (err instanceof PlannerCoreError) {
    console.error(`${err.code}: ${err.message}`);
    process.exit(1);
  }
  throw err;
}
