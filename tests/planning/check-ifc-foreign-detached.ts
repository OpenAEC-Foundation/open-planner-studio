import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { prepareIfcOutput } from '@/state/prepareIfcOutput';
import { loadStore, openInStore } from './ifcAppRoute';
import { bonsaiPlanning, PIN_FILE } from './ifcBonsaiPin';
import { desktopRoute, endDifferences } from './ifcDetachedRoute';
import { installDeterminism } from './ifcPariteitKern';
import { twoTasksAndChain } from './ifcTwoTasksChain';

installDeterminism();
await loadStore();
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const text = (name: string) => readFileSync(join(root, name), 'utf8');
const encode = (content: string) => new TextEncoder().encode(content);
const route = desktopRoute();

let passed = 0, failed = 0;
async function check(label: string, run: () => Promise<void>) {
  try { await run(); passed++; console.log(`OK ${label}`); }
  catch (error) { failed++; console.error(`XX ${label}`, error instanceof Error ? error.message : error); }
}

const FIXTURES: readonly [string, Uint8Array][] = [
  ['bonsai-4d.ifc', new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/bonsai-4d.ifc')))],
  ['de pinbron', encode(bonsaiPlanning(PIN_FILE).text)],
  ['eigen-plus-model.ifc met een stuk naar twee taken en een keten', encode(twoTasksAndChain(text('tests/fixtures/ifc-foreign/eigen-plus-model.ifc')))],
  ['eigen-plus-model.ifc', new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc')))],
];

type StepKind = 'taak' | 'resource' | 'relatie' | 'terug' | 'opnieuw' | 'opslaan' | 'automatisch';
interface Step { readonly kind: StepKind; readonly pick: number }
const WEIGHTS: readonly [StepKind, number][] = [['taak', 4], ['resource', 1], ['relatie', 1], ['terug', 4], ['opnieuw', 1], ['opslaan', 3], ['automatisch', 1]];
const SAVES: ReadonlySet<StepKind> = new Set(['opslaan', 'automatisch']);

function randomSteps(seed: number, length: number): Step[] {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const total = WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  return Array.from({ length }, () => {
    let r = next() * total;
    const kind = WEIGHTS.find(([, w]) => (r -= w) < 0)?.[0] ?? 'opslaan';
    return { kind, pick: Math.floor(next() * 1000) };
  });
}

type Store = Awaited<ReturnType<typeof openInStore>>['store'];
interface Played { readonly store: Store; readonly ctrlS?: () => Promise<unknown>; readonly autoSave?: () => Promise<unknown> }

class Player {
  private applied = 0;
  private undone = 0;
  constructor(private readonly doc: Played) {}
  async play(step: Step): Promise<string> {
    const s = this.doc.store.getState();
    const byId = <T extends { id: string }>(list: readonly T[]) => [...list].sort((a, b) => a.id.localeCompare(b.id));
    const remove = (label: string, list: readonly { id: string; name?: string }[], run: (id: string) => void) => {
      if (list.length === 0) return `${label} (geen)`;
      const target = byId(list)[step.pick % list.length];
      run(target.id);
      this.applied++;
      this.undone = 0;
      return `${label} ${target.name ?? target.id}`;
    };
    switch (step.kind) {
      case 'taak': return remove('wis taak', s.tasks, id => s.deleteTask(id));
      case 'resource': return remove('wis resource', s.resources, id => s.removeResource(id));
      case 'relatie': return remove('wis relatie', s.sequences, id => s.removeSequence(id));
      case 'terug':
        if (this.applied === 0) return 'Ctrl+Z (niets)';
        s.undo(); this.applied--; this.undone++;
        return 'Ctrl+Z';
      case 'opnieuw':
        if (this.undone === 0) return 'Ctrl+Y (niets)';
        s.redo(); this.undone--; this.applied++;
        return 'Ctrl+Y';
      case 'opslaan':
        await this.doc.ctrlS?.();
        return 'Ctrl+S';
      case 'automatisch':
        await this.doc.autoSave?.();
        return 'Automatisch opslaan';
    }
  }
}

const errors = (store: Store) => store.getState().ui.notifications.filter(n => n.severity === 'error')
  .map(n => `${n.messageKey}${n.detail ? `: ${String(n.detail).slice(0, 300)}` : ''}`);

async function oneSaveAtTheEnd(bytes: Uint8Array, plan: readonly Step[]): Promise<Uint8Array | string> {
  const { store } = await openInStore(bytes), replay = new Player({ store });
  for (const step of plan) await replay.play(step);
  try {
    const output = await prepareIfcOutput(store.getState(), buildWriteIFCInput(store.getState(), 'merge'));
    return output.prepared?.bytes ?? encode(output.content!);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

const SEEDS = [11, 12, 13, 14, 15, 16, 17, 18];
const LENGTH = 10;
for (const [name, bytes] of FIXTURES) {
  await check(`de regel op ${name}: na elke opslag is het bestand gelijk aan één opslag aan het eind (zaden ${SEEDS.join(', ')}, ${LENGTH} stappen)`, async () => {
    const found: string[] = [];
    let refusedBoth = 0;
    for (const seed of SEEDS) {
      const plan = randomSteps(seed, LENGTH);
      const doc = await route.open(bytes), player = new Player(doc);
      const labels: string[] = [];
      for (let i = 0; i < plan.length; i++) {
        const before = errors(doc.store).length;
        labels.push(await player.play(plan[i]));
        if (!SAVES.has(plan[i].kind)) continue;
        const expected = await oneSaveAtTheEnd(bytes, plan.slice(0, i + 1));
        const refused = errors(doc.store).slice(before);
        if (typeof expected === 'string') {
          if (refused.length === 0) found.push(`zaad ${seed}, na ${labels.join(' → ')}: de reeks schrijft, één opslag aan het eind weigert: ${expected.slice(0, 300)}`);
          else refusedBoth++;
          break;
        }
        const problems = [...refused.map(e => `de reeks weigert: ${e}`), ...await endDifferences(expected, doc.file())];
        if (problems.length > 0) {
          found.push(`zaad ${seed}, na ${labels.join(' → ')}:\n    ${problems.slice(0, 8).join('\n    ')}`);
          break;
        }
      }
      doc.close();
      console.log(`  zaad ${seed}: ${labels.join(' → ')}`);
    }
    if (refusedBoth > 0) console.log(`  ${refusedBoth} reeks(en) gestopt waar ook één opslag aan het eind weigert`);
    if (found.length > 0) throw new Error(`\n  ${found.join('\n  ')}`);
  });
}

route.dispose();
console.log(`Detached: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
