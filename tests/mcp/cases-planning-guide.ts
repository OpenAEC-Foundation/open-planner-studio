// D2b — de agentgids en de agent-skills bij de agent brengen.
//
// Twee kanalen, één doel: een externe AI-client hoeft niets te weten om goed te plannen.
//   (a) `initialize` draagt `instructions` mee (MCP-spec: clients zetten dat in hun systeemprompt);
//   (b) de leestool `planner_get_planning_guide` levert de Engelse agentgids, de twee skills
//       (`goed-plannen`, `progress-update`), één `part` per taak en één installatie-aanwijzing.
// Daarnaast (c): het mutatiebewijs voor poort 11 van verify:docs — een helpviewer-link in de
// agentgids maakt de poort rood.
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
import {
  AGENT_GUIDE_PATH, AGENT_GUIDE_URL, AGENT_SKILLS, GUIDE_PARTS, GUIDE_PUBLIC_BASE, SKILL_INSTALL_HINT, publicAssetUrl, readingText,
  skillAssetPath,
} from '@/services/mcp/tools/guideTools';
import type { McpContext } from '@/services/mcp/contracts';
import { AGENT_GUIDE_FILE, checkAgentGuideLinks } from '../../scripts/lib/agent-guide-links';
import { checkSkillFrontmatter, checkSkillSets, parseSkillFrontmatter, sharedClaudeSkills } from '../../scripts/lib/agent-skills-check';

registerAllTools();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBLIC = join(ROOT, 'public');

const GUIDE_BODY = '# Planning well: guide for AI agents\n\nStart from the milestones.\n';
const SKILL_BODIES: Record<string, string> = {
  'goed-plannen': '---\nname: goed-plannen\n---\n\n# Planning well through the planner_* tools\n\nFollow the guide.\n',
  'progress-update': '---\nname: progress-update\n---\n\n# Weekly progress update\n\nAsk the user.\n',
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
  for (const n of ['goed-plannen', 'progress-update', '`part`']) {
    assert(def!.description.includes(n), `tool-beschrijving noemt "${n}" niet`);
  }
});

test('readingText: zonder frontmatter en eerste kop; de rest blijft', () => {
  assertEq(readingText('---\nname: a\ndescription: d\n---\n\n# Title\n\nBody.\n\n## Sub\n'), 'Body.\n\n## Sub\n', 'frontmatter en H1 weg, H2 blijft');
  assertEq(readingText('# Guide\n\n# Second\nText\n'), '# Second\nText\n', 'alleen de eerste kop');
  assertEq(readingText('---\r\nname: a\r\n---\r\nBody\r\n'), 'Body\n', 'CRLF');
  assertEq(readingText('Plain text\n# Not first\n'), 'Plain text\n# Not first\n', 'zonder frontmatter en kop: ongewijzigd');
  assertEq(readingText('## Only H2\n'), '## Only H2\n', 'een H2 bovenaan blijft');
});

test('zonder argumenten: gids + goed-plannen, zonder frontmatter en kop, met één installatie-aanwijzing', async () => {
  installFetch('stub');
  fetched.length = 0;
  const res = await call(makeMcpContext(), {});
  assertEq(res.isError, false, `verwachtte succes, kreeg ${JSON.stringify(res.structuredContent)}`);
  const data = res.structuredContent.data;
  assert(!('language' in data), 'geen veld `language`: de inhoud is altijd Engels');
  assertEq(data.languageNote, undefined, 'geen taalnotitie zonder taalverzoek');
  assertEq(data.part, 'goed-plannen', 'default part');
  assertEq(data.guide, 'Start from the milestones.\n', 'gidstekst zonder kop');
  assertEq(data.skills, [{ name: 'goed-plannen', text: 'Follow the guide.\n' }], 'alleen de opbouwskill, zonder frontmatter en kop');
  // Het oude veld `skill` (tweede kopie van goed-plannen) en de oude installatievelden zijn weg (#818).
  assert(!('skill' in data), 'het oude veld `skill` is weg');
  assertEq(data.install, SKILL_INSTALL_HINT, 'één installatietekst voor alle skills');
  assertEq(
    data.install,
    'From https://open-planner-studio.open-aec.com/skills/<name>/SKILL.md to .claude/skills/<name>/SKILL.md or ~/.claude/skills/<name>/SKILL.md',
    'installatietekst: het volle bestand van de publieke URL',
  );
  assertEq([...fetched].sort(), ['/agent/planning-guide.md', '/skills/goed-plannen/SKILL.md'], 'gids en opbouwskill, nooit het Help-artikel');
});

test('elk part levert precies zijn delen (één part per taak; oude waarden blijven werken)', async () => {
  const expected: Record<string, { guide: boolean; skills: string[] }> = {
    'goed-plannen': { guide: true, skills: ['goed-plannen'] },
    'progress-update': { guide: false, skills: ['progress-update'] },
    guide: { guide: true, skills: [] },
    skill: { guide: false, skills: ['goed-plannen', 'progress-update'] },
    both: { guide: true, skills: ['goed-plannen', 'progress-update'] },
  };
  assertEq(Object.keys(GUIDE_PARTS).sort(), Object.keys(expected).sort(), 'de parts');
  for (const [part, want] of Object.entries(expected)) {
    installFetch('stub');
    fetched.length = 0;
    const res = await call(makeMcpContext(), { part });
    assertEq(res.isError, false, `part ${part}: ${JSON.stringify(res.structuredContent)}`);
    const data = res.structuredContent.data;
    assertEq(data.guide, want.guide ? readingText(GUIDE_BODY) : undefined, `part ${part}: gids`);
    assertEq(data.skills?.map((s: any) => s.name), want.skills.length > 0 ? want.skills : undefined, `part ${part}: skills`);
    assertEq(data.install, want.skills.length > 0 ? SKILL_INSTALL_HINT : undefined, `part ${part}: installatietekst alleen bij skills`);
    const files = [...(want.guide ? [`/${AGENT_GUIDE_PATH}`] : []), ...want.skills.map((n) => `/skills/${n}/SKILL.md`)];
    assertEq([...fetched].sort(), files.sort(), `part ${part}: alleen zijn eigen bestanden`);
  }
});

test('language=nl wordt nog geaccepteerd, maar de inhoud blijft Engels (met notitie)', async () => {
  installFetch('stub');
  fetched.length = 0;
  const res = await call(makeMcpContext(), { language: 'nl', part: 'guide' });
  assertEq(res.isError, false, `nl moet geaccepteerd worden: ${JSON.stringify(res.structuredContent)}`);
  const data = res.structuredContent.data;
  assert(!('language' in data), 'geen veld `language`');
  assert(typeof data.languageNote === 'string' && data.languageNote.includes('English'), 'taalnotitie ontbreekt');
  assertEq(data.guide, readingText(GUIDE_BODY), 'agentgids, niet het Nederlandse Help-artikel');
  assertEq(fetched, ['/agent/planning-guide.md'], 'part=guide haalt alleen de agentgids');
  assert(fetched.every((u) => !u.includes('/docs/')), 'het Help-artikel mag niet meer opgehaald worden');
});

test('de tool werkt in alleen-lezen-modus en gepauzeerd (lezen mag altijd)', async () => {
  installFetch('stub');
  const res = await call(makeMcpContext(undefined, { readOnly: true, paused: true }), {});
  assertEq(res.isError, false, `read-only/paused mag een leestool niet blokkeren: ${JSON.stringify(res.structuredContent)}`);
  assertEq(res.structuredContent.data.guide, readingText(GUIDE_BODY), 'de gids komt gewoon terug');
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
  const res = await call(makeMcpContext(), { language: 'nl', part: 'both' });
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
  const res = await call(makeMcpContext(), { part: 'both' });
  assertEq(res.isError, false, `een deel ontbreekt, de rest hoort te komen: ${JSON.stringify(res.structuredContent)}`);
  const data = res.structuredContent.data;
  assertEq(data.guide, readingText(GUIDE_BODY), 'de gids komt mee');
  assertEq(data.skills.map((s: any) => s.name), ['goed-plannen'], 'alleen de skill die laadde');
  assertEq(data.missing.map((m: any) => [m.path, m.url]), [
    ['skills/progress-update/SKILL.md', 'https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md'],
  ], 'missing noemt het bestand en zijn publieke URL');
});

test('alles aanwezig: geen `missing`-veld', async () => {
  installFetch('stub');
  const res = await call(makeMcpContext(), {});
  assertEq(res.structuredContent.data.missing, undefined, 'missing alleen bij een ontbrekend deel');
});

test('de echte bestanden in public/ bestaan, en de tool levert precies die', async () => {
  installFetch('disk');
  fetched.length = 0;
  const res = await call(makeMcpContext(), { part: 'both' });
  assertEq(res.isError, false, `echte assets moeten laden: ${JSON.stringify(res.structuredContent)}`);
  const data = res.structuredContent.data;
  const guideFile = readFileSync(join(PUBLIC, AGENT_GUIDE_PATH), 'utf8');
  assert(guideFile.startsWith('# '), 'het gidsbestand begint met een kop');
  assertEq(data.guide, readingText(guideFile), 'agentgids = public/agent/planning-guide.md zonder kop');
  assert(data.guide.startsWith('`tools/list`'), `het antwoord begint met de eerste regel na de kop: ${data.guide.slice(0, 40)}`);
  assertEq(join('public', AGENT_GUIDE_PATH), AGENT_GUIDE_FILE, 'guideTools en de koppelpoort wijzen naar hetzelfde bestand');
  assert(!/(docs|examples):\/\//.test(data.guide), 'agentgids bevat een helpviewer-link');
  for (const s of data.skills as { name: string; text: string }[]) {
    const file = readFileSync(join(PUBLIC, 'skills', s.name, 'SKILL.md'), 'utf8');
    assert(file.startsWith(`---\nname: ${s.name}\n`), `skill ${s.name}: het bestand heeft de frontmatter (om te installeren)`);
    assertEq(file, readFileSync(join(ROOT, '.claude', 'skills', s.name, 'SKILL.md'), 'utf8'), `skill ${s.name}: public = .claude-kopie`);
    assertEq(s.text, readingText(file), `skill ${s.name} = public-bestand zonder frontmatter en kop`);
    assert(!s.text.startsWith('---') && !s.text.startsWith('# '), `skill ${s.name}: geen frontmatter of kop in het antwoord`);
    const installUrl = SKILL_INSTALL_HINT.split(' ')[1].replace('<name>', s.name);
    assertEq(installUrl, publicAssetUrl(skillAssetPath(s.name as 'goed-plannen' | 'progress-update')), `skill ${s.name}: installatie-URL`);
  }
  // Elke publieke URL (in `missing` en de foutmelding) hoort bij een bestand in public/ (de webbuild serveert
  // public/ op de root).
  const urls = [AGENT_GUIDE_URL, ...AGENT_SKILLS.map((s) => publicAssetUrl(skillAssetPath(s.name)))];
  for (const url of urls) {
    assert(url.startsWith(`${GUIDE_PUBLIC_BASE}/`), `URL buiten de publieke basis: ${url}`);
    assert(existsSync(join(PUBLIC, url.slice(GUIDE_PUBLIC_BASE.length + 1))), `geen bestand in public/ voor ${url}`);
  }
  assertEq(AGENT_GUIDE_URL, publicAssetUrl(AGENT_GUIDE_PATH), 'AGENT_GUIDE_URL = de publieke URL van de gids');
});

test('de tool levert precies de skills die in public/skills/ staan', () => {
  const dirs = readdirSync(join(PUBLIC, 'skills'), { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).sort();
  assertEq(AGENT_SKILLS.map((s) => s.name).sort(), dirs, 'AGENT_SKILLS ↔ public/skills/');
});

// --- (c) poort 11: de agentgids linkt alleen met volledige URL's ----------------------------------

test('poort 11: de agentgids is groen, en een docs://- of examples://-link wordt gemeld', () => {
  const agent = readFileSync(join(ROOT, AGENT_GUIDE_FILE), 'utf8');
  assertEq(checkAgentGuideLinks(agent), [], 'geen helpviewer-links in de agentgids');
  assert(!agent.includes('gids-goed-plannen'), 'de agentgids wijst nog naar het verwijderde Help-artikel gids-goed-plannen');
  assertEq(checkAgentGuideLinks('See [Relations](docs://howto-relaties-leggen).').length, 1, 'docs://-link niet gemeld');
  assertEq(checkAgentGuideLinks('Open [the example](examples://03-kantoorgebouw-zuidas.ifc).').length, 1, 'examples://-link niet gemeld');
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

test('poort 9: de frontmatter is geldige YAML (mutatiebewijs met de fout uit council-ronde 3)', () => {
  const fm = (desc: string) => `---\nname: a\ndescription: ${desc}\n---\n\nBody.\n`;
  // Groen: gewone waarden met puntkomma, sterretje en pijl, en gequote waarden mét dubbele punt.
  for (const desc of ['Build schedules via planner_*; for progress use b.', 'Een → pijl', "'Progress: b.'", '"Progress: b."', "'it''s: ok'"]) {
    assertEq(checkSkillFrontmatter(fm(desc), 'a', 'x'), [], `geldige YAML afgekeurd: ${desc}`);
  }
  assertEq(parseSkillFrontmatter("name: a\ndescription: 'it''s: ok'").values.description, "it's: ok", 'enkel-gequote waarde gelezen');
  assertEq(parseSkillFrontmatter('description: "x: \\"y\\""').values.description, 'x: "y"', 'dubbel-gequote waarde gelezen');
  // Rood: precies de waarden die PyYAML weigert of anders leest dan bedoeld.
  const bad: [string, string][] = [
    ['Build/restructure schedules via planner_*. Progress: progress-update.', 'ongeldige YAML'],
    ['Record progress via planner_*. Building: goed-plannen.', 'ongeldige YAML'],
    ['Ends with a colon:', 'ongeldige YAML'],
    ['a # comment cuts it', 'commentaar'],
    ['[list]', 'YAML-teken'],
    ['- item', 'YAML-teken'],
    ["'not closed", 'sluit niet'],
    ['"bad \\q escape"', 'escape'],
  ];
  for (const [desc, word] of bad) {
    const diffs = checkSkillFrontmatter(fm(desc), 'a', 'x');
    assert(diffs.some((d) => d.includes(word)), `niet gemeld als YAML-fout (${word}): ${desc} → ${JSON.stringify(diffs)}`);
  }
  const multi = checkSkillFrontmatter('---\nname: a\ndescription: one\n  two\n---\n', 'a', 'x');
  assert(multi.some((d) => d.includes('op één regel')), `vervolgregel niet gemeld: ${JSON.stringify(multi)}`);
  const twice = checkSkillFrontmatter('---\nname: a\nname: a\ndescription: d\n---\n', 'a', 'x');
  assert(twice.some((d) => d.includes('twee keer')), `dubbele sleutel niet gemeld: ${JSON.stringify(twice)}`);
  // De echte skills: bron en kopie.
  for (const s of AGENT_SKILLS) {
    for (const file of [join(PUBLIC, skillAssetPath(s.name)), join(ROOT, '.claude', 'skills', s.name, 'SKILL.md')]) {
      assertEq(checkSkillFrontmatter(readFileSync(file, 'utf8'), s.name, file), [], `${file}: frontmatter`);
    }
  }
});

test('poort 9: een wees in .claude/skills/ en een niet-gedeelde agent-skill worden gemeld', () => {
  const real = sharedClaudeSkills(readFileSync(join(ROOT, '.gitignore'), 'utf8'));
  for (const n of ['release', 'wiki', 'docs-update', 'docs-audit', 'update-ui-lang', 'update-docs-lang', 'goed-plannen', 'progress-update']) {
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
