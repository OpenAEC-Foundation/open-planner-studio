// De agentteksten (`public/agent/**`, `public/skills/**`) noemen tools en parameters bij naam. Een
// agent volgt die letterlijk, dus een hernoemde tool of parameter mag daar niet stil blijven staan.
// Deze goedkope poort houdt de teksten tegen de ECHTE registry:
//   1. elke `planner_[a-z_]+` in de teksten is een geregistreerde tool;
//   2. "`planner_x` `param`" (of "`planner_x` with `param`"): `param` (ook een pad als
//      `fields.calendarId`) bestaat in het inputSchema van precies die tool;
//   3. elke backtick-span in de vorm `sleutel: waarde` (ook JSON-achtig, meerdere paren): de sleutel is
//      een parameter uit een inputSchema of een bekend antwoordveld, en een tekstwaarde staat in de enum
//      van die parameter als hij er een heeft.
// Plus het mutatiebewijs: een verzonnen tool, parameter of enumwaarde maakt de toets rood.
import { test, assert, assertEq, run } from './harness';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTools, registerAllTools } from '@/services/mcp/toolRegistry';

registerAllTools();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Velden uit de ANTWOORDEN van de tools (envelop en data), die de teksten in de vorm `veld: waarde`
 * noemen. Geen invoer, dus niet in een inputSchema; elk staat in `contracts.ts` (`McpEnvelope`) of in
 * de beschrijving/het antwoord van de genoemde tool.
 */
const RESPONSE_FIELDS = new Set([
  'scheduleRecalculated', // McpEnvelope
  'datesAsRecorded', // McpEnvelope
  'scheduleStale', // McpEnvelope
  'becameLiteral', // planner_update_calendar, per item
  'summary', // planner_list_tasks, rij van een samenvattingstaak
]);

type Schema = { type?: unknown; properties?: Record<string, Schema>; items?: Schema; enum?: unknown[] };

function agentFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.md')) out.push(p);
    }
  };
  walk(join(ROOT, 'public', 'agent'));
  walk(join(ROOT, 'public', 'skills'));
  return out;
}

/** Alle schema-knopen met een `properties`-blok, over de hele boom (ook binnen `items`). */
function propertyNodes(schema: Schema | undefined, out: Schema[] = []): Schema[] {
  if (!schema || typeof schema !== 'object') return out;
  if (schema.properties) {
    out.push(schema);
    for (const child of Object.values(schema.properties)) propertyNodes(child, out);
  }
  if (schema.items) propertyNodes(schema.items, out);
  return out;
}

/** De schema-knoop van het eind van een pad (`fields.calendarId`), ergens in de boom begonnen. */
function resolvePath(schema: Schema, segs: string[]): Schema | undefined {
  for (const node of propertyNodes(schema)) {
    let cur: Schema | undefined = node;
    for (const seg of segs) {
      while (cur && !cur.properties && cur.items) cur = cur.items;
      cur = cur?.properties?.[seg];
    }
    if (cur) return cur;
  }
  return undefined;
}

interface Registry {
  tools: Map<string, Schema>;
  /** parameternaam → de enums die hij in de schema's heeft; `free` als hij ergens geen enum heeft. */
  params: Map<string, { enums: unknown[][]; free: boolean }>;
}

function realRegistry(): Registry {
  const tools = new Map(getTools().map((t) => [t.name, t.inputSchema as Schema]));
  const params = new Map<string, { enums: unknown[][]; free: boolean }>();
  for (const schema of tools.values()) {
    for (const node of propertyNodes(schema)) {
      for (const [key, child] of Object.entries(node.properties ?? {})) {
        const entry = params.get(key) ?? { enums: [], free: false };
        if (Array.isArray(child.enum)) entry.enums.push(child.enum);
        else entry.free = true;
        params.set(key, entry);
      }
    }
  }
  // De stappen van planner_batch: `tool` en `args` staan in zijn schema, dus al hierboven.
  return { tools, params };
}

/** Toets één tekst; geeft de afwijkingen terug (leeg = in orde). */
function checkAgentText(label: string, text: string, reg: Registry): string[] {
  const diffs: string[] = [];
  for (const m of text.matchAll(/\bplanner_[a-z_]*[a-z]\b/g)) {
    if (!reg.tools.has(m[0])) diffs.push(`${label}: tool ${m[0]} bestaat niet in de registry`);
  }
  for (const m of text.matchAll(/`(planner_[a-z_]+)`\s+(?:with\s+)?`([A-Za-z_][\w.]*)/g)) {
    const schema = reg.tools.get(m[1]);
    if (!schema) continue; // al gemeld
    if (!resolvePath(schema, m[2].split('.'))) diffs.push(`${label}: ${m[1]} heeft geen parameter ${m[2]}`);
  }
  for (const span of text.matchAll(/`([^`]+)`/g)) {
    const body = span[1];
    if (/^\w+:\/\//.test(body)) continue; // een URL, geen sleutel: waarde
    if (!/^\s*\{?\s*"?[A-Za-z_]\w*"?\s*:/.test(body)) continue;
    for (const pair of body.matchAll(/"?([A-Za-z_]\w*)"?\s*:\s*("([^"]*)"|[^,}\s]+)/g)) {
      const key = pair[1];
      const value = pair[3];
      if (RESPONSE_FIELDS.has(key)) continue;
      const param = reg.params.get(key);
      if (!param) { diffs.push(`${label}: \`${key}\` is geen parameter van een tool (en geen bekend antwoordveld)`); continue; }
      if (value !== undefined && !param.free && !param.enums.some((e) => e.includes(value))) {
        diffs.push(`${label}: \`${key}: "${value}"\` — "${value}" staat in geen enum van ${key}`);
      }
    }
  }
  return diffs;
}

test('elke tool- en parameternaam in de agentteksten bestaat in de registry', () => {
  const reg = realRegistry();
  const files = agentFiles();
  assert(files.length >= 3, `verwachtte de agentgids en twee skills, vond ${files.length} bestanden`);
  const diffs = files.flatMap((f) => checkAgentText(relative(ROOT, f), readFileSync(f, 'utf8'), reg));
  assertEq(diffs, [], 'agentteksten wijken af van de tools');
});

test('de poort ziet echt iets: de teksten noemen tientallen tools en parameters', () => {
  const text = agentFiles().map((f) => readFileSync(f, 'utf8')).join('\n');
  const tools = new Set([...text.matchAll(/\bplanner_[a-z_]*[a-z]\b/g)].map((m) => m[0]));
  assert(tools.size >= 30, `te weinig toolnamen gevonden (${tools.size}) — scant de poort nog wel?`);
  const adjacent = [...text.matchAll(/`(planner_[a-z_]+)`\s+(?:with\s+)?`([A-Za-z_][\w.]*)/g)].length;
  const pairs = [...text.matchAll(/`\s*\{?\s*"?[A-Za-z_]\w*"?\s*:[^`]*`/g)].length;
  assert(adjacent >= 10, `te weinig "tool + parameter"-plekken (${adjacent})`);
  assert(pairs >= 15, `te weinig "sleutel: waarde"-spans (${pairs})`);
});

test('mutatie: een verzonnen tool, parameter, pad of enumwaarde ⇒ rood', () => {
  const reg = realRegistry();
  const cases: [string, RegExp][] = [
    ['Call `planner_run_cpm` first.', /planner_run_cpm bestaat niet/],
    ['Set `planner_update_project` `statusDay` first.', /geen parameter statusDay/],
    ['Attach with `planner_update_tasks` `fields.calendar`.', /geen parameter fields\.calendar/],
    ['Use `planner_list_tasks` with `orphans: true`.', /geen parameter orphans/],
    ['Set `durationType: "CALENDARDAYS"`.', /staat in geen enum van durationType/],
    ['Pass `{ "type": "XYZ", "date": "2027-01-01" }`.', /staat in geen enum van type/],
  ];
  for (const [text, expect] of cases) {
    const diffs = checkAgentText('mutatie', text, reg);
    assert(diffs.some((d) => expect.test(d)), `niet gemeld: ${text} → ${JSON.stringify(diffs)}`);
  }
  assertEq(checkAgentText('ok', 'Use `planner_update_tasks` `fields.calendarId` and `durationType: "ELAPSEDTIME"`.', reg), [],
    'een correcte zin mag niet rood zijn');
});

await run();
