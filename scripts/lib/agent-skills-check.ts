// Pure toetsen voor poort 9 van `verify:docs`: de agent-skills onder `public/skills/<naam>/SKILL.md`
// (bron, uitgeleverd en door `planner_get_planning_guide` geleverd) en hun kopieën in
// `.claude/skills/<naam>/` (waar Claude Code ze leest). Puur, zodat `tests/mcp/cases-planning-guide.ts`
// het mutatiebewijs kan leveren zonder bestanden aan te raken; `scripts/verify-docs.ts` leest de
// bestanden en roept deze functies aan.

/** Skills die alleen voor wie aan deze repo werkt bestaan (geen agent-skill, geen `public/`-bron). */
export const REPO_ONLY_SKILLS: readonly string[] = ['release', 'browsertests-repareren', 'wiki', 'docs-update', 'docs-audit', 'update-ui-lang', 'update-docs-lang'];

/**
 * De frontmatter van een SKILL.md: het blok tussen een `---`-regel op regel 1 en de volgende
 * `---`-regel. `null` als er geen (gesloten) frontmatter is.
 */
export function skillFrontmatter(text: string): string | null {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines[0] !== '---') return null;
  const close = lines.indexOf('---', 1);
  return close === -1 ? null : lines.slice(1, close).join('\n');
}

/** Een gewone (ongequote) YAML-waarde mag niet met een YAML-teken beginnen. */
const PLAIN_SCALAR_BAD_START = /^[[\]{},#&*!|>'"%@`]|^[-?:](\s|$)/;

/** Eén waarde na `sleutel: `: gequote (`'…'` of `"…"`) of gewoon; een fout als tekst. */
function yamlScalar(raw: string, requireQuoted: boolean): { value: string } | { error: string } {
  if (raw === '') return { value: '' };
  if (raw.startsWith("'")) {
    const m = /^'((?:[^']|'')*)'(?:[ \t]+#.*)?$/.exec(raw);
    return m ? { value: m[1].replace(/''/g, "'") } : { error: 'een enkel-gequote waarde sluit niet goed af' };
  }
  if (raw.startsWith('"')) {
    const m = /^"((?:[^"\\]|\\.)*)"(?:[ \t]+#.*)?$/.exec(raw);
    if (!m) return { error: 'een dubbel-gequote waarde sluit niet goed af' };
    try {
      return { value: JSON.parse(`"${m[1]}"`) as string };
    } catch {
      return { error: 'een dubbel-gequote waarde heeft een onbekende escape' };
    }
  }
  if (PLAIN_SCALAR_BAD_START.test(raw)) return { error: 'een gewone waarde begint met een YAML-teken; zet hem tussen aanhalingstekens' };
  if (/:(\s|$)/.test(raw)) return { error: '": " in een gewone waarde is ongeldige YAML; gebruik een puntkomma of aanhalingstekens' };
  if (/\s#/.test(raw)) return { error: '" #" begint in YAML een commentaar en kort de waarde in; gebruik aanhalingstekens' };
  // Geen eigen YAML-typeherkenning: null, true en getallen zijn zonder quotes geen tekst.
  if (requireQuoted) return { error: 'description moet tekst tussen aanhalingstekens zijn' };
  return { value: raw };
}

/**
 * Lees de frontmatter als YAML: een platte lijst `sleutel: waarde`, elke waarde op één regel, gewoon of
 * gequote. Voor description eisen we quotes, zodat YAML-lezers dezelfde tekstwaarde lezen (knownbug 1003).
 * Er zit geen YAML-parser in de repo en een nieuwe afhankelijkheid is het niet waard (#818); daarom deze
 * strikte lezer. Wat hij niet kent
 * (vervolgregels, `|`/`>`, lijsten), meldt hij als fout in plaats van het te raden.
 */
export function parseSkillFrontmatter(block: string): { values: Record<string, string>; errors: string[] } {
  const values: Record<string, string> = {};
  const errors: string[] = [];
  block.split('\n').forEach((line, i) => {
    const at = `frontmatterregel ${i + 1}`;
    if (line.trim() === '' || /^\s*#/.test(line)) return;
    const m = /^([A-Za-z_][\w-]*):(?:[ \t]+(.*))?$/.exec(line);
    if (!m) {
      errors.push(`${at} is geen "sleutel: waarde" op één regel (ongeldige of niet ondersteunde YAML): ${JSON.stringify(line)}`);
      return;
    }
    const key = m[1];
    if (Object.prototype.hasOwnProperty.call(values, key)) errors.push(`${at}: de sleutel ${key} staat er twee keer`);
    const parsed = yamlScalar((m[2] ?? '').replace(/[ \t]+$/, ''), key === 'description');
    if ('error' in parsed) errors.push(`${at} (${key}): ${parsed.error}`);
    else values[key] = parsed.value;
  });
  return { values, errors };
}

/** Toets de frontmatter als YAML, `name` (gelijk aan de mapnaam, niet leeg) en `description` (niet leeg). */
export function checkSkillFrontmatter(text: string, dirName: string, label: string): string[] {
  const fm = skillFrontmatter(text);
  if (fm === null) return [`${label}: geen frontmatter (een SKILL.md begint met een ---blok met name en description)`];
  const parsed = parseSkillFrontmatter(fm);
  const diffs: string[] = parsed.errors.map((e) => `${label}: ${e}`);
  const field = (key: string) => parsed.values[key]?.trim();
  const name = field('name');
  if (name === undefined || name === '') diffs.push(`${label}: frontmatter-name ontbreekt of is leeg (verwacht "${dirName}", de mapnaam)`);
  else if (name !== dirName) diffs.push(`${label}: frontmatter-name is "${name}", verwacht "${dirName}" (de mapnaam)`);
  const description = field('description');
  if (description === undefined || description === '') diffs.push(`${label}: frontmatter-description ontbreekt of is leeg (daarop kiest een agent de skill)`);
  return diffs;
}

/** De skills die `.gitignore` uitdrukkelijk deelt (`!.claude/skills/<naam>/`). */
export function sharedClaudeSkills(gitignore: string): string[] {
  const out: string[] = [];
  for (const raw of gitignore.split('\n')) {
    const m = /^!\.claude\/skills\/([^/\s]+)\/?\s*$/.exec(raw.trim());
    if (m) out.push(m[1]);
  }
  return out;
}

/**
 * Toets de verzamelingen: elke agent-skill wordt in `.gitignore` gedeeld (anders mist CI de kopie),
 * en een gedeelde map in `.claude/skills/` zonder `public/skills/`-bron is een wees, tenzij hij een
 * repo-skill is. Een lokale, niet-gedeelde map (gitignored) telt niet mee.
 */
export function checkSkillSets(opts: {
  publicSkills: readonly string[];
  claudeDirs: readonly string[];
  shared: readonly string[];
  repoOnly?: readonly string[];
}): string[] {
  const repoOnly = new Set(opts.repoOnly ?? REPO_ONLY_SKILLS);
  const pub = new Set(opts.publicSkills);
  const shared = new Set(opts.shared);
  const diffs: string[] = [];
  for (const name of opts.publicSkills) {
    if (!shared.has(name)) {
      diffs.push(`.gitignore deelt .claude/skills/${name}/ niet — voeg "!.claude/skills/${name}/" toe, anders komt de kopie niet in git en mist CI hem`);
    }
  }
  for (const name of opts.claudeDirs) {
    if (!shared.has(name) || pub.has(name) || repoOnly.has(name)) continue;
    diffs.push(`.claude/skills/${name}/ is een wees: er is geen public/skills/${name}/SKILL.md (de bron) — haal de kopie en de .gitignore-regel weg, of zet de bron terug (of voeg hem toe aan REPO_ONLY_SKILLS als het een repo-skill is)`);
  }
  return diffs;
}
