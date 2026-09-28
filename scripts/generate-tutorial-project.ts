// Generator van het tutorialproject *Aanbouw woning* / *House extension* (schrijfkant). De opbouw
// staat in `tutorial-project.ts`; hier schrijven we per taal en per stand één .ifc weg.
//
//   npm run gen:tutorial-project                       # → build/tutorial-project/<lang>/<stand>.ifc
//   npm run gen:tutorial-project -- --out <map>        # andere uitvoermap
//
// De uitvoer is een BUILD-artefact (niet gecommit, niet in `public/`): de tutorials en hun
// projectbestanden worden een installeerbare extensie in `open-planner-studio-extensions`, en die
// build draait deze generator tegen een app-checkout, omdat hij de echte store en motor van de app
// nodig heeft. De beoogde effecten per stand worden tijdens het bouwen geasserteerd (de generator
// schrijft niets als één ervan uitblijft); de exacte getallen pint
// `tests/planning/check-tutorial-project.ts`.
import { mkdirSync, writeFileSync, statSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildTutorialProject, TASKS, TUTORIAL_LANGS, type TaskKey, type TutorialBuild } from './tutorial-project';

function parseOut(argv: string[]): string {
  const i = argv.indexOf('--out');
  if (i >= 0) {
    const v = argv[i + 1];
    if (!v || v.startsWith('--')) {
      console.error('gebruik: npm run gen:tutorial-project -- [--out <map>]');
      process.exit(2);
    }
    return resolve(process.cwd(), v);
  }
  const eq = argv.find(a => a.startsWith('--out='));
  if (eq) return resolve(process.cwd(), eq.slice('--out='.length));
  return resolve(process.cwd(), 'build', 'tutorial-project');
}

function main() {
  const out = parseOut(process.argv.slice(2));
  // Eerst alles bouwen (en asserteren), pas daarna schrijven: een mislukte stand laat geen halve
  // uitvoermap achter.
  let builds: TutorialBuild[];
  try {
    builds = TUTORIAL_LANGS.map(lang => buildTutorialProject(lang));
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(1);
  }

  let total = 0;
  for (const build of builds) {
    const dir = join(out, build.lang);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const stage of build.stages) {
      const file = join(dir, `${stage.id}.ifc`);
      writeFileSync(file, stage.ifc, 'utf8');
      const size = statSync(file).size;
      total += size;
      const f = stage.facts;
      const over = Object.entries(f.overallocated).map(([k, d]) => `${k} ${d}d`).join(', ') || '-';
      console.log(
        `✓ ${build.lang}/${stage.id.padEnd(12)} ${String((size / 1024).toFixed(1)).padStart(5)} kB  ` +
        `${String(f.counts.tasks).padStart(2)}t ${String(f.counts.sequences).padStart(2)}rel ` +
        `${f.counts.resources}res ${String(f.counts.assignments).padStart(2)}toe  laatste einde ${f.projectFinish || '-'}  overbezet ${over}`,
      );
    }
  }
  console.log(`\n${builds.length} talen × ${builds[0].stages.length} standen → ${out} (${(total / 1024).toFixed(0)} kB)`);
  if (process.argv.includes('--report')) printReport(builds[0]);
}

/** `--report`: de getallen per stand voor de tutorialtekst (taaknamen in de taal van de build). */
function printReport(build: TutorialBuild) {
  const name = (k: TaskKey) => TASKS.find(t => t.key === k)!.name[build.lang];
  console.log(`\n── Rapport (${build.lang}) ──`);
  console.log(`bouwvak: ${build.bouwvak.name} ${build.bouwvak.startDate} … ${build.bouwvak.endDate}`);
  console.log(`tut-3 einde na alleen de bouwvak: ${build.finishAfterBouwvak}`);
  console.log(`tut-5 stucwerk ${build.plasterDays.before} → ${build.plasterDays.after} werkdagen; nivelleervertraging: ${JSON.stringify(build.levelingDelays)}`);
  console.log(`tut-5 vóór nivelleren: einde ${build.beforeLeveling.finish}, overbezet ${JSON.stringify(build.beforeLeveling.overallocated)}`);
  for (const st of build.stages) {
    const f = st.facts;
    console.log(`\n[${st.id}] oplevering ${f.finish}  laatste einde ${f.projectFinish}  overbezet ${JSON.stringify(f.overallocated)}`);
    console.log(`  kritiek: ${f.critical.map(name).join(' → ')}`);
    for (const t of TASKS) {
      const e = f.early[t.key];
      if (!e) continue;
      console.log(`  ${name(t.key).padEnd(34)} ${e.start.padEnd(17)} ${e.finish.padEnd(17)} TF ${f.totalFloat[t.key]}`);
    }
  }
}

main();
