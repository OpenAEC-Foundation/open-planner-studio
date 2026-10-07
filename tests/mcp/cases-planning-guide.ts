// D2b — de agentgids en de agent-skills bij de agent brengen.
//
// Twee kanalen, één doel: een externe AI-client hoeft niets te weten om goed te plannen.
//   (a) `initialize` draagt `instructions` mee (MCP-spec: clients zetten dat in hun systeemprompt);
//   (b) de leestool `planner_get_planning_guide` levert de Engelse agentgids, de twee skills
//       (`goed-plannen`, `progress-update`) en per skill een installatie-aanwijzing.
// Daarnaast (c): het mutatiebewijs voor poort 11 van verify:docs — een nieuw principe in het
// Help-artikel zonder tegenhanger in de agentgids maakt de poort rood.
//
// De tool leest RUNTIME-ASSETS uit `public/` via `fetchTextAsset`. Headless is er geen server, dus
// we zetten `globalThis.fetch` op een stub — precies de naad die `fetchTextAsset` openlaat (zijn
// `fetchImpl`-default resolvet bij elke aanroep naar de globale `fetch`). De stub levert óf vaste
// teksten (padopbouw toetsen), óf de ECHTE bestanden uit `public/` (bestaan ze, en serveert de tool
// precies die). Alle calls lopen via de ECHTE dispatch-weg (`handleMcpMessage`), zodat de schemapoort
// meetest.
import { makeMcpContext, test, assert, assertEq, run } from './harness';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleMcpMessage, MCP_INSTRUCTIONS } from '@/services/mcp/dispatcher';
import { getTools, registerAllTools } from '@/services/mcp/toolRegistry';
import { AGENT_GUIDE_PATH, AGENT_GUIDE_URL, AGENT_SKILLS, GUIDE_PUBLIC_BASE } from '@/services/mcp/tools/guideTools';
import type { McpContext } from '@/services/mcp/contracts';
import {
  AGENT_GUIDE_FILE, PRINCIPLE_COUPLING, checkAgentGuideLinks, checkPrincipleCoupling, principleHeadings,
} from '../../scripts/lib/agent-guide-coupling';
import { checkSkillFrontmatter, checkSkillSets, sharedClaudeSkills } from '../../scripts/lib/agent-skills-check';

registerAllTools();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBLIC = join(ROOT, 'public');

const GUIDE_BODY = '# Planning well: guide for AI agents\n\nStart from the milestones.\n';
const SKILL_BODIES: Record<string, string> = {
  'goed-plannen': '---\nname: goed-plannen\n---\n\n# Planning well through the planner_* tools\n',
  'progress-update': '---\nname: progress-update\n---\n\n# Weekly progress update\n',
};

/** Onthoudt welke URL's zijn opgehaald, zodat we de padopbouw kunnen toetsen. */
const fetched: string[] = [];

/** Het pad binnen `public/` van een opgehaalde asset-URL (`BASE_URL` is headless `/`). */
function assetPathOf(url: string): string {
  return url.replace(/^\//, '');
}

function installFetch(mode: 'stub' | 'disk' | 'missing' | 'no-progress-skill'): void {
  (globalThis as any).fetch = async (url: string) => {
    fetched.push(url);
    if (mode === 'missing') return { ok: false, status: 404, text: async () => '' };
    if (mode === 'no-progress-skill' && url.includes('/skills/progress-update/')) {
      return { ok: false, status: 404, text: async () => '' };
    }
    const path = assetPathOf(url);
    if (mode === 'disk') {
      const file = join(PUBLIC, path);
      if (!existsSync(file)) return { ok: false, status: 404, text: async () => '' };
      const body = readFileSync(file, 'utf8');
      return { ok: true, status: 200, text: async () => body };
    }
    const skill = /^skills\/([^/]+)\/SKILL\.md$/.exec(path)?.[1];
    const body = skill ? SKILL_BODIES[skill] : path === AGENT_GUIDE_PATH ? GUIDE_BODY : undefined;
    if (body === undefined) return { ok: false, status: 404, text: async () => '' };
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
    'planner_get_project_info', // het resultaat lezen; een losse herbereken-tool is er niet
    'planner_get_critical_path',
    'datesAsRecorded',
    'scheduleError',
    'status date',          // voortgang vraagt de peildatum van de gebruiker
    'assumed',              // meld je aannames
    'planner_get_planning_guide',
    'progress-update',
    'https://open-planner-studio.open-aec.com/agent/planning-guide.md',
  ];
  for (const n of needles) {
    assert(text.includes(n), `instructions missen "${n}"`);
  }
  assert(!text.includes('planner_run_cpm'), 'instructions noemen nog de verwijderde planner_run_cpm');
  assert(!text.includes('gids-goed-plannen'), 'instructions wijzen nog naar het Help-artikel voor mensen i.p.v. de agentgids');
  assert(text.length < 2500, `instructions te lang (${text.length} tekens) — hij gaat in elke systeemprompt mee`);
});

// --- (b) de leestool ------------------------------------------------------------------------------

test('planner_get_planning_guide staat geregistreerd, read-only en niet-batchable', () => {
  const def = getTools().find((t) => t.name === 'planner_get_planning_guide');
  assert(!!def, 'tool niet gevonden in de registry');
  assertEq(def!.kind, 'read', 'kind moet read zijn');
  assertEq(def!.annotations.readOnlyHint, true, 'readOnlyHint');
  assertEq(def!.batchable, false, 'een documentatie-tool hoort niet in een draaiboek');
  for (const n of ['goed-plannen', 'progress-update', 'English', '`language`']) {
    assert(def!.description.includes(n), `tool-beschrijving noemt "${n}" niet`);
  }
});

test('zonder argumenten: agentgids + beide skills, Engels, met installatie-aanwijzing per skill', async () => {
  installFetch('stub');
  fetched.length = 0;
  const res = await call(makeMcpContext(), {});
  assertEq(res.isError, false, `verwachtte succes, kreeg ${JSON.stringify(res.structuredContent)}`);
  const data = res.structuredContent.data;
  assertEq(data.language, 'en', 'de inhoud is Engels');
  assertEq(data.languageNote, undefined, 'geen taalnotitie zonder taalverzoek');
  assertEq(data.part, 'both', 'default part');
  assertEq(data.guide, GUIDE_BODY, 'gidstekst doorgegeven');
  assertEq(data.skills, [
    { name: 'goed-plannen', text: SKILL_BODIES['goed-plannen'] },
    { name: 'progress-update', text: SKILL_BODIES['progress-update'] },
  ], 'beide skills, in vaste volgorde');
  assertEq(data.skill, SKILL_BODIES['goed-plannen'], 'compat-veld `skill` = goed-plannen');
  assertEq(data.install.guideUrl, 'https://open-planner-studio.open-aec.com/agent/planning-guide.md', 'gids-URL');
  assertEq(data.install.skills.map((s: any) => [s.name, s.installPathProject, s.installPathGlobal, s.url]), [
    ['goed-plannen', '.claude/skills/goed-plannen/SKILL.md', '~/.claude/skills/goed-plannen/SKILL.md',
      'https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md'],
    ['progress-update', '.claude/skills/progress-update/SKILL.md', '~/.claude/skills/progress-update/SKILL.md',
      'https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md'],
  ], 'installatiepaden en URL\'s per skill');
  // Compat-velden van vóór de tweede skill: ongewijzigd, voor goed-plannen.
  assertEq(data.install.skillPathProject, '.claude/skills/goed-plannen/SKILL.md', 'projectpad (compat)');
  assertEq(data.install.skillPathGlobal, '~/.claude/skills/goed-plannen/SKILL.md', 'globaal pad (compat)');
  assertEq(data.install.skillUrl, 'https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md', 'skill-URL (compat)');
  assertEq([...fetched].sort(), [
    '/agent/planning-guide.md', '/skills/goed-plannen/SKILL.md', '/skills/progress-update/SKILL.md',
  ], 'precies de drie assets, nooit het Help-artikel');
});

test('language=nl wordt nog geaccepteerd, maar de inhoud blijft Engels (met notitie)', async () => {
  installFetch('stub');
  fetched.length = 0;
  const res = await call(makeMcpContext(), { language: 'nl', part: 'guide' });
  assertEq(res.isError, false, `nl moet geaccepteerd worden: ${JSON.stringify(res.structuredContent)}`);
  const data = res.structuredContent.data;
  assertEq(data.language, 'en', 'inhoud Engels');
  assert(typeof data.languageNote === 'string' && data.languageNote.includes('English'), 'taalnotitie ontbreekt');
  assertEq(data.guide, GUIDE_BODY, 'agentgids, niet het Nederlandse Help-artikel');
  assertEq(fetched, ['/agent/planning-guide.md'], 'part=guide haalt alleen de agentgids');
  assert(fetched.every((u) => !u.includes('/docs/')), 'het Help-artikel mag niet meer opgehaald worden');
});

test('part=skill haalt alleen de twee skills', async () => {
  installFetch('stub');
  fetched.length = 0;
  const res = await call(makeMcpContext(), { part: 'skill' });
  const data = res.structuredContent.data;
  assertEq(data.guide, undefined, 'gids mag ontbreken bij part=skill');
  assertEq(data.skills.map((s: any) => s.name), ['goed-plannen', 'progress-update'], 'beide skills');
  assert(fetched.every((u) => u.includes('/skills/')), `alleen skills verwacht, kreeg ${fetched.join(', ')}`);
});

test('de tool werkt in alleen-lezen-modus en gepauzeerd (lezen mag altijd)', async () => {
  installFetch('stub');
  const res = await call(makeMcpContext(undefined, { readOnly: true, paused: true }), {});
  assertEq(res.isError, false, `read-only/paused mag een leestool niet blokkeren: ${JSON.stringify(res.structuredContent)}`);
  assertEq(res.structuredContent.data.guide, GUIDE_BODY, 'de gids komt gewoon terug');
});

test('een onbekende taal wordt door de schemapoort geweigerd', async () => {
  installFetch('stub');
  const res = await call(makeMcpContext(), { language: 'de' });
  assertEq(res.isError, true, 'de stond nooit in de enum');
  assertEq(res.structuredContent.code, 'VALIDATION', 'schemapoort ⇒ VALIDATION');
});

test('een onbekende parameter wordt geweigerd (additionalProperties: false)', async () => {
  installFetch('stub');
  const res = await call(makeMcpContext(), { taal: 'nl' });
  assertEq(res.isError, true, 'onbekende sleutel moet falen');
  assertEq(res.structuredContent.code, 'VALIDATION', 'schemapoort ⇒ VALIDATION');
});

test('een onbereikbare asset geeft een Engelse NOT_FOUND met alle publieke download-URL\'s', async () => {
  installFetch('missing');
  const res = await call(makeMcpContext(), { language: 'nl' });
  assertEq(res.isError, true, 'ontbrekende asset ⇒ fout');
  assertEq(res.structuredContent.code, 'NOT_FOUND', 'nette code i.p.v. INTERNAL');
  const msg: string = res.structuredContent.error;
  for (const url of [
    'https://open-planner-studio.open-aec.com/agent/planning-guide.md',
    'https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md',
    'https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md',
  ]) {
    assert(msg.includes(url), `foutmelding noemt ${url} niet: ${msg}`);
  }
  assert(msg.startsWith('The planning guide could not be read'), `foutmelding niet Engels: ${msg}`);
  assert(!/\b(kon|niet|gids|lege)\b/i.test(msg), `Nederlandse woorden in de foutmelding: ${msg}`);
});

test('één ontbrekende skill blokkeert de rest niet: ok, met `missing` en de publieke URL', async () => {
  installFetch('no-progress-skill');
  const res = await call(makeMcpContext(), {});
  assertEq(res.isError, false, `een deel ontbreekt, de rest hoort te komen: ${JSON.stringify(res.structuredContent)}`);
  const data = res.structuredContent.data;
  assertEq(data.guide, GUIDE_BODY, 'de gids komt mee');
  assertEq(data.skills.map((s: any) => s.name), ['goed-plannen'], 'alleen de skill die laadde');
  assertEq(data.skill, SKILL_BODIES['goed-plannen'], 'compat-veld blijft gevuld');
  assertEq(data.missing.map((m: any) => [m.path, m.url]), [
    ['skills/progress-update/SKILL.md', 'https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md'],
  ], 'missing noemt het bestand en zijn publieke URL');
  assertEq(data.install.skills.length, 2, 'de installatie-aanwijzing noemt nog steeds beide skills');
});

test('alles aanwezig: geen `missing`-veld', async () => {
  installFetch('stub');
  const res = await call(makeMcpContext(), {});
  assertEq(res.structuredContent.data.missing, undefined, 'missing alleen bij een ontbrekend deel');
});

test('de echte bestanden in public/ bestaan, en de tool levert precies die', async () => {
  installFetch('disk');
  fetched.length = 0;
  const res = await call(makeMcpContext(), {});
  assertEq(res.isError, false, `echte assets moeten laden: ${JSON.stringify(res.structuredContent)}`);
  const data = res.structuredContent.data;
  assertEq(data.guide, readFileSync(join(PUBLIC, AGENT_GUIDE_PATH), 'utf8'), 'agentgids = public/agent/planning-guide.md');
  assertEq(join('public', AGENT_GUIDE_PATH), AGENT_GUIDE_FILE, 'guideTools en de koppelpoort wijzen naar hetzelfde bestand');
  assert(data.guide.startsWith('# '), 'agentgids begint met een kop');
  assert(!/(docs|examples):\/\//.test(data.guide), 'agentgids bevat een helpviewer-link');
  for (const s of data.skills as { name: string; text: string }[]) {
    assert(s.text.startsWith(`---\nname: ${s.name}\n`), `skill ${s.name}: frontmatter-name ontbreekt of wijkt af`);
    assertEq(s.text, readFileSync(join(PUBLIC, 'skills', s.name, 'SKILL.md'), 'utf8'), `skill ${s.name} = public-bestand`);
    assertEq(s.text, readFileSync(join(ROOT, '.claude', 'skills', s.name, 'SKILL.md'), 'utf8'), `skill ${s.name} = .claude-kopie`);
  }
  // Elke publieke URL hoort bij een bestand in public/ (de webbuild serveert public/ op de root).
  const urls = [data.install.guideUrl, ...data.install.skills.map((s: any) => s.url)];
  for (const url of urls) {
    assert(url.startsWith(`${GUIDE_PUBLIC_BASE}/`), `URL buiten de publieke basis: ${url}`);
    assert(existsSync(join(PUBLIC, url.slice(GUIDE_PUBLIC_BASE.length + 1))), `geen bestand in public/ voor ${url}`);
  }
  assertEq(AGENT_GUIDE_URL, data.install.guideUrl, 'AGENT_GUIDE_URL = de geleverde gids-URL');
});

test('de tool levert precies de skills die in public/skills/ staan', () => {
  const dirs = readdirSync(join(PUBLIC, 'skills'), { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).sort();
  assertEq(AGENT_SKILLS.map((s) => s.name).sort(), dirs, 'AGENT_SKILLS ↔ public/skills/');
});

// --- (c) poort 11: de agentgids groeit niet los van het Help-artikel ------------------------------

const sources = () => ({
  nl: readFileSync(join(PUBLIC, 'docs', 'nl', 'gids-goed-plannen.md'), 'utf8'),
  en: readFileSync(join(PUBLIC, 'docs', 'en', 'gids-goed-plannen.md'), 'utf8'),
  agent: readFileSync(join(ROOT, AGENT_GUIDE_FILE), 'utf8'),
});

test('poort 11 is groen op de huidige teksten, en de tabel dekt alle negen principes', () => {
  const src = sources();
  assertEq(checkPrincipleCoupling(src), [], 'koppeling hoort nu in orde te zijn');
  assertEq(checkAgentGuideLinks(src.agent), [], 'geen helpviewer-links in de agentgids');
  assertEq(principleHeadings(src.en, 'How the app calculates with it')?.length, PRINCIPLE_COUPLING.length, 'aantal principes (en)');
});

test('mutatie: een nieuw principe in nl zonder tegenhanger ⇒ rood, met een melding die de weg wijst', () => {
  const src = sources();
  src.nl = src.nl.replace('### De duur schatten', '### Weerverlet apart houden\n\nTekst.\n\n### De duur schatten');
  const diffs = checkPrincipleCoupling(src);
  assertEq(diffs.length, 1, `precies één afwijking verwacht, kreeg ${JSON.stringify(diffs)}`);
  assert(diffs[0].includes('Weerverlet apart houden') && diffs[0].includes('geen tegenhanger in de agentgids')
    && diffs[0].includes('PRINCIPLE_COUPLING'), `melding onduidelijk: ${diffs[0]}`);
});

test('mutatie: een nieuw principe in en, of een hernoemde kop ⇒ rood', () => {
  const added = sources();
  added.en = added.en.replace('### Estimating duration', '### Keep weather delay separate\n\nText.\n\n### Estimating duration');
  assert(checkPrincipleCoupling(added).some((d) => d.includes('Keep weather delay separate')), 'nieuwe en-kop niet gemeld');

  const renamed = sources();
  renamed.nl = renamed.nl.replace('### De duur schatten', '### Duur inschatten');
  const diffs = checkPrincipleCoupling(renamed);
  assert(diffs.some((d) => d.includes('Duur inschatten')), 'nieuwe naam niet gemeld');
  assert(diffs.some((d) => d.includes('"De duur schatten" staat niet (meer)')), 'verdwenen tabelkop niet gemeld');
});

test('mutatie: een agentsectie zonder principe, een verdwenen sectie en een docs://-link ⇒ rood', () => {
  const extra = sources();
  extra.agent = extra.agent.replace('### Estimating duration', '### Something only agents get\n\nText.\n\n### Estimating duration');
  assert(checkPrincipleCoupling(extra).some((d) => d.includes('Something only agents get') && d.includes('geen principe')),
    'agentsectie zonder principe niet gemeld');

  const gone = sources();
  gone.agent = gone.agent.replace('## Principles and the tools for them', '## Principles');
  assert(checkPrincipleCoupling(gone).some((d) => d.includes('principesectie')), 'verdwenen principesectie niet gemeld');

  assertEq(checkAgentGuideLinks('See [Relations](docs://uitleg-relaties).').length, 1, 'docs://-link niet gemeld');
});

// --- (d) poort 9: frontmatter en skill-verzamelingen -------------------------------------------------

test('poort 9: frontmatter-name alleen binnen de frontmatter, leeg of anders = fout', () => {
  const ok = '---\nname: progress-update\ndescription: Use when …\n---\n\n# X\n';
  assertEq(checkSkillFrontmatter(ok, 'progress-update', 'x'), [], 'een correcte frontmatter is groen');
  assert(checkSkillFrontmatter('---\nname:\ndescription: d\n---\n', 'a', 'x').some((d) => d.includes('leeg')), 'lege name niet gemeld');
  assert(checkSkillFrontmatter('---\nname: b\ndescription: d\n---\n', 'a', 'x').some((d) => d.includes('"b"')), 'verkeerde name niet gemeld');
  assert(checkSkillFrontmatter('---\ndescription: d\n---\n\nname: a\n', 'a', 'x').some((d) => d.includes('ontbreekt')),
    'een name-regel BUITEN de frontmatter telt niet');
  assert(checkSkillFrontmatter('# geen frontmatter\nname: a\n', 'a', 'x').some((d) => d.includes('geen frontmatter')), 'ontbrekende frontmatter niet gemeld');
  assert(checkSkillFrontmatter('---\nname: a\ndescription:\n---\n', 'a', 'x').some((d) => d.includes('description')), 'lege description niet gemeld');
});

test('poort 9: een wees in .claude/skills/ en een niet-gedeelde agent-skill worden gemeld', () => {
  const real = sharedClaudeSkills(readFileSync(join(ROOT, '.gitignore'), 'utf8'));
  for (const n of ['release', 'wiki', 'docs-update', 'goed-plannen', 'progress-update']) {
    assert(real.includes(n), `.gitignore deelt ${n} niet`);
  }
  const base = { publicSkills: ['goed-plannen', 'progress-update'], claudeDirs: ['release', 'wiki', 'docs-update', 'goed-plannen', 'progress-update', 'lokaal'], shared: real };
  assertEq(checkSkillSets(base), [], 'de huidige situatie (plus een lokale, niet-gedeelde map) is groen');
  const orphan = checkSkillSets({ ...base, publicSkills: ['goed-plannen'] });
  assert(orphan.some((d) => d.includes('.claude/skills/progress-update/ is een wees')), `wees niet gemeld: ${JSON.stringify(orphan)}`);
  const notShared = checkSkillSets({ ...base, shared: real.filter((n) => n !== 'progress-update') });
  assert(notShared.some((d) => d.includes('!.claude/skills/progress-update/')), `ontbrekende .gitignore-regel niet gemeld: ${JSON.stringify(notShared)}`);
});

await run();
