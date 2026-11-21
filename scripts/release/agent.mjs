// De opdrachten voor de tekstagent (`claude -p`, Opus 5.5 high). De agent schrijft alleen teksten; het script
// controleert daarna de grenzen en draait de bestaande checks. Hij commit, pusht en publiceert niets.

/** De bestanden die de tekstagent mag wijzigen of aanmaken. Een map eindigt op `/`. */
export const TEKST_PADEN = versie => [
  `docs/release-notes/v${versie}.md`,
  'docs/CHANGELOG.md',
  'src/services/updater/releaseHighlights.ts',
  'public/release-highlights.json',
  'public/docs/nl/',
  'public/docs/en/',
  'public/docs/manifest.json',
  'docs/wiki/',
  'AGENTS.md',
  '.claude/rules/',
];

/** Wat de websiteagent mag wijzigen: het Nederlandse `#whats-new`-blok en de vier woordenboeken. */
export const WEBSITE_TEKST_PADEN = [
  'open-planner-studio/index.html',
  'shared/translations/open-planner-studio.json',
  'shared/translations/open-planner-studio.fr.json',
  'shared/translations/open-planner-studio.tr.json',
  'shared/translations/open-planner-studio.es.json',
];

const GIT_REGEL = 'Je mag alleen deze git-opdrachten draaien, elk los (zonder `|`, `;`, `&&` of omleiding): `git log …`, `git show …` en `git diff …`. Andere opdrachten worden geweigerd; zoek dan geen omweg.';

export function tekstOpdracht({ versie, prev, base, commits, afgeschreven }) {
  const opvolger = afgeschreven
    ? `\n${afgeschreven} is afgeschreven en nooit uitgebracht. Neem de tekst van docs/release-notes/${afgeschreven}.md en de nog niet uitgebrachte changelogsectie over in v${versie} en vul ze aan met de fix. Verplaats die changelogsectie naar v${versie}.\n`
    : '';
  return `Je schrijft de releaseteksten van Open Planner Studio v${versie} en toetst de documentatie. Het releasescript draait daarna de controles en commit; jij commit, pusht en publiceert niets.

Werkmap: de release-worktree (de huidige map). Vorige release: ${prev}. Basis: ${base}.
${opvolger}
Bron is de volledige commitlijst sinds ${prev} (hieronder). Lees bij twijfel de commit zelf met \`git show <sha>\`. Verzin niets wat niet in de commits staat.

Schrijf:
1. docs/release-notes/v${versie}.md: 3 tot 6 korte bullets in het Engels, weinig opmaak, alleen de inhoud (scripts/release-notes.mjs voegt de kop en Downloads toe). Kijk naar de vorige bestanden in docs/release-notes/ voor de vorm.
2. Bovenaan docs/CHANGELOG.md (onder de titel, boven de vorige versie) een uitgebreide Engelse sectie met precies de kop \`## v${versie} — <datum van vandaag, JJJJ-MM-DD>\` en waar passend Added / Changed / Fixed / Documentation. Geen commitdump en geen Unreleased-kop.
3. In src/services/updater/releaseHighlights.ts alleen een nieuw versieblok \`'${versie}': { … }\` bovenaan RELEASE_HIGHLIGHT_CATALOG, in dezelfde vorm als de blokken eronder: precies vijf highlights (één primary met eventueel een \`docsId\` van een bestaand artikel, vier secondaries zonder gidslink), iconen uit HIGHLIGHT_ICONS, en copy voor alle 28 RELEASE_HIGHLIGHT_LOCALES in natuurlijke, korte taal per taal. Zet de stats-regel op \`stats: { daysSincePrevious: 0, commitsSincePrevious: 0, addedCodeLines: 0 },\`; het script vult de echte cijfers in. Verander niets aan andere blokken of aan de code.
4. Documentatie: toets volgens .claude/skills/wiki/SKILL.md (Release-mandaat) elke inhoudelijke doc-claim tegen wat er echt is uitgebracht. Loopt een gids in public/docs/{nl,en}/ of een wiki-pagina in docs/wiki/ achter op de commits, pas hem aan (nl en en gelijk). Zo nodig ook AGENTS.md of .claude/rules/. Een nieuwe gids vraagt ook een manifest-entry (docs/recepten/in-app-gids.md).

Je mag alleen deze bestanden wijzigen of aanmaken: ${TEKST_PADEN(versie).join(', ')}. Andere bestanden laat je ongemoeid; een wijziging daarbuiten laat de release stoppen.
${GIT_REGEL}

Antwoord aan het eind in één korte alinea in het Nederlands: welke gidsen of wikipagina's je aanpaste en waarom, en wat je niet zeker wist.

Commits sinds ${prev}:
${commits}
`;
}

export function herstelOpdracht({ versie, fouten }) {
  return `De controles op de releaseteksten van Open Planner Studio v${versie} faalden. Herstel alleen wat de meldingen noemen, in dezelfde bestanden als de vorige ronde: ${TEKST_PADEN(versie).join(', ')}. Laat de stats-regel van het blok '${versie}' staan; die vult het script in.
${GIT_REGEL}
Je mag de bestanden lezen om de fout te begrijpen. Je commit niets.

Meldingen:
${fouten.join('\n\n')}

Antwoord aan het eind in één zin wat je herstelde.`;
}

export function websiteOpdracht({ tag, versie }) {
  return `Je werkt het blok "Wat is er nieuw" van Open Planner Studio ${tag} bij op de website van OpenAEC. De huidige map is een checkout van OpenAEC-Foundation/website op een eigen branch. Het releasescript commit, maakt de PR en draait de generatoren; jij schrijft alleen tekst.

Bron: de releaseteksten van ${tag}: https://github.com/OpenAEC-Foundation/open-planner-studio/releases/tag/${tag} en de highlights in https://open-planner-studio.open-aec.com/release-highlights.json (versie ${versie}). Lees ze met WebFetch. Verzin geen functies.

Werk bij:
1. In open-planner-studio/index.html alleen de inhoud van <section id="whats-new">: de Nederlandse tekst bij de sleutels whatsnew.label, .title, .desc en .items.*. Zet de versie in het label (de vorm "Nieuw in v${versie}" of zoals het label nu is opgebouwd). Behoud de CTA's en de structuur.
2. Het object "whatsnew" in shared/translations/open-planner-studio.json (Engels), .fr.json, .tr.json en .es.json, met dezelfde sleutels en de vertaling van dezelfde tekst. Laat alle andere objecten staan.
Bij een release met alleen fixes benoemt het blok die verbeteringen.

Je mag alleen deze bestanden wijzigen: ${WEBSITE_TEKST_PADEN.join(', ')}. Draai geen opdrachten.

Antwoord aan het eind in één zin wat de nieuwe titel is.`;
}

/** Ingebouwde tools en vooraf toegestane opdrachten per agent (`--tools` en `--allowedTools`). */
export const TEKST_TOOLS = {
  tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
  toegestaan: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(git diff:*)'],
};
export const WEBSITE_TOOLS = {
  tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch'],
  toegestaan: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch'],
};
