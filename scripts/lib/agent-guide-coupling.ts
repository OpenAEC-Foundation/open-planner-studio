// Koppeling tussen het Help-artikel "Goed plannen" (voor mensen, `public/docs/{nl,en}/gids-goed-plannen.md`)
// en de agentgids (voor AI-agents, `public/agent/planning-guide.md`).
//
// WAAROM. Het Help-artikel en de agentgids beschrijven dezelfde planningsprincipes voor twee lezers:
// een mens drukt F5 en klikt in het lint, een agent gebruikt de `planner_*`-tools en het rekenen gaat
// vanzelf. Twee teksten over hetzelfde groeien uit elkaar zodra iemand er één bijwerkt. Deze module
// legt daarom EXPLICIET vast welk principe (`###`-kop onder de principesectie) van het Help-artikel bij
// welke sectie van de agentgids hoort, en `npm run verify:docs` (poort 11) keurt elke afwijking af:
//   - een principe in nl of en zonder regel in de koppeltabel (een nieuw principe dat de agent mist);
//   - een regel waarvan de kop niet (meer) bestaat in nl, en of de agentgids (hernoemd of verwijderd);
//   - een agentgids-sectie onder de principesectie zonder regel (een principe dat de mensen missen).
// De tabel is bewust handwerk: een nieuwe kop vraagt een bewuste beslissing over de agenttekst, geen
// automatische vertaling.
//
// Puur (alleen tekst in, meldingen uit), zodat `tests/mcp/cases-planning-guide.ts` het mutatiebewijs
// kan leveren zonder bestanden aan te raken.

/** De agentgids, relatief aan de repo-root (zelfde bestand als `AGENT_GUIDE_PATH` in guideTools.ts). */
export const AGENT_GUIDE_FILE = 'public/agent/planning-guide.md';
/** Waar de koppeltabel staat — voor de foutmeldingen. */
export const COUPLING_TABLE_FILE = 'scripts/lib/agent-guide-coupling.ts';

/** De `##`-sectie met de principes, per bron. */
export const PRINCIPLE_SECTIONS = {
  nl: 'Hoe de app ermee rekent',
  en: 'How the app calculates with it',
  agent: 'Principles and the tools for them',
} as const;

export type CouplingSource = keyof typeof PRINCIPLE_SECTIONS;

export interface PrincipleCoupling {
  nl: string;
  en: string;
  agent: string;
}

/** Elk principe van het Help-artikel (nl + en) ↔ zijn sectie in de agentgids. */
export const PRINCIPLE_COUPLING: readonly PrincipleCoupling[] = [
  {
    nl: 'Begin bij het doel, niet bij de taken',
    en: 'Start from the goal, not from the tasks',
    agent: 'Start from the goal, not from the tasks',
  },
  {
    nl: 'De opdeling: fasen, werkpakketten, taken',
    en: 'The breakdown: phases, work packages, tasks',
    agent: 'The breakdown: phases, work packages, tasks',
  },
  {
    nl: 'De duur schatten',
    en: 'Estimating duration',
    agent: 'Estimating duration',
  },
  {
    nl: 'Relaties: zonder netwerk is het geen planning',
    en: 'Relations: without a network it is not a schedule',
    agent: 'Relations: without a network it is not a schedule',
  },
  {
    nl: 'Constraints en vaste datums: zo min mogelijk',
    en: 'Constraints and fixed dates: as few as possible',
    agent: 'Constraints and fixed dates: as few as possible',
  },
  {
    nl: 'Kalenders: eerst het project, dan de uitzonderingen',
    en: 'Calendars: the project first, then the exceptions',
    agent: 'Calendars: the project first, then the exceptions',
  },
  {
    nl: 'Resources: wie doet het, en kan dat wel',
    en: 'Resources: who does it, and is that possible',
    agent: 'Resources: who does it, and is that possible',
  },
  {
    nl: 'Kritiek pad en speling: waar de planning kwetsbaar is',
    en: 'Critical path and float: where the schedule is vulnerable',
    agent: 'Critical path and float: where the schedule is vulnerable',
  },
  {
    nl: 'Baseline vóór de start, daarna bijhouden',
    en: 'Baseline before the start, then keep it up to date',
    agent: 'Baseline before the start, then keep it up to date',
  },
];

/**
 * De `###`-koppen onder de `##`-sectie `sectionTitle`, tot de volgende `#`/`##`-kop. Koppen binnen
 * een ```-codeblok tellen niet. `null` wanneer de sectie niet bestaat.
 */
export function principleHeadings(source: string, sectionTitle: string): string[] | null {
  let inFence = false;
  let inSection = false;
  let found = false;
  const out: string[] = [];
  for (const raw of source.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (/^```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const h = /^(#{1,3})\s+(.*?)\s*$/.exec(line);
    if (!h) continue;
    const level = h[1].length;
    if (level <= 2) {
      inSection = level === 2 && h[2] === sectionTitle;
      if (inSection) found = true;
      continue;
    }
    if (inSection) out.push(h[2]);
  }
  return found ? out : null;
}

/**
 * Poort 11: toets de koppeling. `sources` zijn de drie teksten (Help-artikel nl en en, agentgids).
 * Geeft de afwijkingen terug als leesbare meldingen (leeg = in orde).
 */
export function checkPrincipleCoupling(
  sources: Record<CouplingSource, string>,
  table: readonly PrincipleCoupling[] = PRINCIPLE_COUPLING,
  sections: Record<CouplingSource, string> = PRINCIPLE_SECTIONS,
): string[] {
  const diffs: string[] = [];
  const label: Record<CouplingSource, string> = {
    nl: 'gids-goed-plannen (nl)',
    en: 'gids-goed-plannen (en)',
    agent: `agentgids ${AGENT_GUIDE_FILE}`,
  };
  for (const src of ['nl', 'en', 'agent'] as const) {
    const headings = principleHeadings(sources[src], sections[src]);
    if (headings === null) {
      diffs.push(`${label[src]}: de principesectie "## ${sections[src]}" ontbreekt — hernoemd? Werk PRINCIPLE_SECTIONS in ${COUPLING_TABLE_FILE} bij`);
      continue;
    }
    const inTable = new Set(table.map((row) => row[src]));
    const present = new Set(headings);
    for (const h of headings) {
      if (inTable.has(h)) continue;
      diffs.push(src === 'agent'
        ? `${label.agent}: sectie "### ${h}" heeft geen principe in gids-goed-plannen — voeg het principe toe aan het Help-artikel (nl en en) en een regel aan PRINCIPLE_COUPLING in ${COUPLING_TABLE_FILE}, of haal de sectie weg`
        : `${label[src]}: principe "### ${h}" heeft geen tegenhanger in de agentgids — schrijf de agentversie (met de tools die het toepassen) onder "## ${sections.agent}" in ${AGENT_GUIDE_FILE} en zet de koppeling in PRINCIPLE_COUPLING in ${COUPLING_TABLE_FILE}`);
    }
    for (const row of table) {
      if (!present.has(row[src])) {
        diffs.push(`koppeltabel ${COUPLING_TABLE_FILE}: "${row[src]}" staat niet (meer) als ### onder "## ${sections[src]}" in ${label[src]} — kop hernoemd of verwijderd? Werk de tabel en de andere twee teksten bij`);
      }
    }
    const seen = new Set<string>();
    for (const h of headings) {
      if (seen.has(h)) diffs.push(`${label[src]}: de kop "### ${h}" staat dubbel onder "## ${sections[src]}"`);
      seen.add(h);
    }
  }
  return diffs;
}

/**
 * De agentgids wordt buiten de helpviewer gelezen (door een agent, of als ruwe download): een
 * `docs://`- of `examples://`-link werkt daar niet. Alleen volledige URL's.
 */
export function checkAgentGuideLinks(agent: string): string[] {
  const diffs: string[] = [];
  const re = /\b(docs|examples|project):\/\/[^\s)]*/g;
  for (const m of agent.matchAll(re)) {
    diffs.push(`${AGENT_GUIDE_FILE}: link "${m[0]}" werkt alleen in de helpviewer — gebruik de volledige URL (https://open-planner-studio.open-aec.com/docs/en/<id>.md)`);
  }
  return diffs;
}
