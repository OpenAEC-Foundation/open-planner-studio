// Pure toetsen voor poort 9 van `verify:docs`: de agent-skills onder `public/skills/<naam>/SKILL.md`
// (bron, uitgeleverd en door `planner_get_planning_guide` geleverd) en hun kopieën in
// `.claude/skills/<naam>/` (waar Claude Code ze leest). Puur, zodat `tests/mcp/cases-planning-guide.ts`
// het mutatiebewijs kan leveren zonder bestanden aan te raken; `scripts/verify-docs.ts` leest de
// bestanden en roept deze functies aan.

/** Skills die alleen voor wie aan deze repo werkt bestaan (geen agent-skill, geen `public/`-bron). */
export const REPO_ONLY_SKILLS: readonly string[] = ['release', 'wiki', 'docs-update'];

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

/** Toets `name` (gelijk aan de mapnaam, niet leeg) en `description` (niet leeg) in de frontmatter. */
export function checkSkillFrontmatter(text: string, dirName: string, label: string): string[] {
  const fm = skillFrontmatter(text);
  if (fm === null) return [`${label}: geen frontmatter (een SKILL.md begint met een ---blok met name en description)`];
  const diffs: string[] = [];
  const field = (key: string) => {
    const m = new RegExp(`^${key}:(.*)$`, 'm').exec(fm);
    return m ? m[1].trim() : undefined;
  };
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
