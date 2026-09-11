// D2b — de planningsgids en de agent-skill bij de agent brengen.
//
// Twee kanalen, één doel: een externe AI-client hoeft niets te weten om goed te plannen.
//   (a) `initialize` draagt `instructions` mee (MCP-spec: clients zetten dat in hun systeemprompt);
//   (b) de leestool `planner_get_planning_guide` levert de volledige gids, de skill en een
//       installatie-aanwijzing.
//
// De tool leest RUNTIME-ASSETS uit `public/` via `fetchTextAsset`. Headless is er geen server, dus
// we zetten `globalThis.fetch` op een stub — precies de naad die `fetchTextAsset` openlaat (zijn
// `fetchImpl`-default resolvet bij elke aanroep naar de globale `fetch`). Alle calls lopen via de
// ECHTE dispatch-weg (`handleMcpMessage`), zodat de schemapoort meetest.
import { makeMcpContext, test, assert, assertEq, run } from './harness';
import { handleMcpMessage, MCP_INSTRUCTIONS } from '@/services/mcp/dispatcher';
import { getTools, registerAllTools } from '@/services/mcp/toolRegistry';
import type { McpContext } from '@/services/mcp/contracts';

registerAllTools();

const GUIDE_BODY = '# Goed plannen\n\nBegin bij de mijlpalen.\n';
const SKILL_BODY = '---\nname: goed-plannen\n---\n\n# Goed plannen via de planner_*-tools\n';

/** Onthoudt welke URL's zijn opgehaald, zodat we de padopbouw kunnen toetsen. */
const fetched: string[] = [];

function installFetch(mode: 'ok' | 'missing'): void {
  (globalThis as any).fetch = async (url: string) => {
    fetched.push(url);
    if (mode === 'missing') return { ok: false, status: 404, text: async () => '' };
    const body = url.includes('/skills/') ? SKILL_BODY : GUIDE_BODY;
    return { ok: true, status: 200, text: async () => body };
  };
}

async function call(ctx: McpContext, args: unknown): Promise<any> {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'planner_get_planning_guide', arguments: args } }),
    ctx,
  );
  return JSON.parse(raw).result;
}

// --- (a) instructions in de initialize-respons ---------------------------------------------------

test('initialize geeft het instructions-veld terug, exact MCP_INSTRUCTIONS', async () => {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    makeMcpContext(),
  );
  const msg = JSON.parse(raw);
  assertEq(msg.result.instructions, MCP_INSTRUCTIONS, 'instructions ontbreekt of wijkt af van de exportconstante');
});

test('de instructions bevatten de kernregels die een agent anders fout doet', () => {
  const text = MCP_INSTRUCTIONS;
  const needles = [
    'milestone',            // begin bij mijlpalen en opleverdatum
    'two weeks',            // granulariteit
    'Finish-to-start',      // relaties i.p.v. vaste datums
    'negative lag',
    'planner_run_cpm',      // niet om te verversen, wél voor het resultaat
    'assumed',              // meld je aannames
    'planner_get_planning_guide',
    'https://open-planner-studio.open-aec.com/docs/en/gids-goed-plannen.md',
  ];
  for (const n of needles) {
    assert(text.includes(n), `instructions missen "${n}"`);
  }
  assert(text.length < 2500, `instructions te lang (${text.length} tekens) — hij gaat in elke systeemprompt mee`);
});

// --- (b) de leestool ------------------------------------------------------------------------------

test('planner_get_planning_guide staat geregistreerd, read-only en niet-batchable', () => {
  const def = getTools().find((t) => t.name === 'planner_get_planning_guide');
  assert(!!def, 'tool niet gevonden in de registry');
  assertEq(def!.kind, 'read', 'kind moet read zijn');
  assertEq(def!.annotations.readOnlyHint, true, 'readOnlyHint');
  assertEq(def!.batchable, false, 'een documentatie-tool hoort niet in een draaiboek');
});

test('zonder argumenten: taal en, beide delen, met installatie-instructie', async () => {
  installFetch('ok');
  fetched.length = 0;
  const res = await call(makeMcpContext(), {});
  assertEq(res.isError, false, `verwachtte succes, kreeg ${JSON.stringify(res.structuredContent)}`);
  const data = res.structuredContent.data;
  assertEq(data.language, 'en', 'default language');
  assertEq(data.part, 'both', 'default part');
  assertEq(data.guide, GUIDE_BODY, 'gidstekst doorgegeven');
  assertEq(data.skill, SKILL_BODY, 'skilltekst doorgegeven');
  assertEq(data.install.skillPathProject, '.claude/skills/goed-plannen/SKILL.md', 'projectpad');
  assertEq(data.install.skillPathGlobal, '~/.claude/skills/goed-plannen/SKILL.md', 'globaal pad');
  assertEq(data.install.skillUrl, 'https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md', 'skill-URL');
  assertEq(data.install.guideUrl, 'https://open-planner-studio.open-aec.com/docs/en/gids-goed-plannen.md', 'gids-URL');
  assert(fetched.some((u) => u.endsWith('docs/en/gids-goed-plannen.md')), `gids-asset niet opgehaald: ${fetched.join(', ')}`);
  assert(fetched.some((u) => u.endsWith('skills/goed-plannen/SKILL.md')), `skill-asset niet opgehaald: ${fetched.join(', ')}`);
});

test('part=guide haalt alleen de gids op, part=skill alleen de skill', async () => {
  installFetch('ok');
  fetched.length = 0;
  const onlyGuide = await call(makeMcpContext(), { language: 'nl', part: 'guide' });
  assertEq(onlyGuide.structuredContent.data.guide, GUIDE_BODY, 'gids aanwezig');
  assertEq(onlyGuide.structuredContent.data.skill, undefined, 'skill mag ontbreken bij part=guide');
  assert(fetched.every((u) => !u.includes('/skills/')), 'skill-asset had niet opgehaald mogen worden');
  assert(fetched.some((u) => u.endsWith('docs/nl/gids-goed-plannen.md')), `nl-pad verwacht, kreeg ${fetched.join(', ')}`);

  fetched.length = 0;
  const onlySkill = await call(makeMcpContext(), { part: 'skill' });
  assertEq(onlySkill.structuredContent.data.skill, SKILL_BODY, 'skill aanwezig');
  assertEq(onlySkill.structuredContent.data.guide, undefined, 'gids mag ontbreken bij part=skill');
});

test('de tool werkt in alleen-lezen-modus en gepauzeerd (lezen mag altijd)', async () => {
  installFetch('ok');
  const res = await call(makeMcpContext(undefined, { readOnly: true, paused: true }), {});
  assertEq(res.isError, false, `read-only/paused mag een leestool niet blokkeren: ${JSON.stringify(res.structuredContent)}`);
  assertEq(res.structuredContent.data.guide, GUIDE_BODY, 'de gids komt gewoon terug');
});

test('een onbekende taal wordt door de schemapoort geweigerd', async () => {
  installFetch('ok');
  const res = await call(makeMcpContext(), { language: 'de' });
  assertEq(res.isError, true, 'de is geen brontaal van de gids');
  assertEq(res.structuredContent.code, 'VALIDATION', 'schemapoort ⇒ VALIDATION');
});

test('een onbekende parameter wordt geweigerd (additionalProperties: false)', async () => {
  installFetch('ok');
  const res = await call(makeMcpContext(), { taal: 'nl' });
  assertEq(res.isError, true, 'onbekende sleutel moet falen');
  assertEq(res.structuredContent.code, 'VALIDATION', 'schemapoort ⇒ VALIDATION');
});

test('een onbereikbare asset geeft NOT_FOUND met de publieke download-URL erbij', async () => {
  installFetch('missing');
  const res = await call(makeMcpContext(), { language: 'nl' });
  assertEq(res.isError, true, 'ontbrekende asset ⇒ fout');
  assertEq(res.structuredContent.code, 'NOT_FOUND', 'nette code i.p.v. INTERNAL');
  assert(
    res.structuredContent.error.includes('https://open-planner-studio.open-aec.com/docs/nl/gids-goed-plannen.md'),
    `foutmelding noemt het alternatief niet: ${res.structuredContent.error}`,
  );
});

await run();
