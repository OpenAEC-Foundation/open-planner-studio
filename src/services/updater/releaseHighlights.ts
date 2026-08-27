/** Lokale, beperkte gegevens voor de visuele update-dialoog.
 *
 * Dit is nadrukkelijk geen tweede changelog: een release kiest hooguit vijf
 * onderwerpen. De releasepoort valideert dit bestand vóór een stabiele tag.
 */
export const HIGHLIGHT_ICONS = ['import', 'library', 'relations', 'tasks', 'examples'] as const;
export type HighlightIcon = (typeof HIGHLIGHT_ICONS)[number];

export interface ReleaseHighlight {
  icon: HighlightIcon;
  category: string;
  title: string;
  description: string;
  docsId?: string;
}

export interface ReleaseStats {
  daysSincePrevious?: number;
  commitsSincePrevious?: number;
  addedCodeLines?: number;
}

export interface ReleaseHighlights {
  version: string;
  primary: ReleaseHighlight;
  secondary: ReleaseHighlight[];
  stats: ReleaseStats;
}

// Cijfers zijn bij v2026.8.1 uit v2026.8.0..v2026.8.1 bepaald: git rev-list
// --count en git diff --numstat met docs, i18n, lock- en gegenereerde bestanden uitgesloten.
const RELEASES: Record<string, ReleaseHighlights> = {
  '2026.8.1': {
    version: '2026.8.1',
    primary: {
      icon: 'import',
      category: 'MS PROJECT',
      title: 'Import with the dates from your plan',
      description: 'Open MS Project schedules while retaining the recorded planning dates where that matters.',
      docsId: 'gids-msproject-import',
    },
    secondary: [
      { icon: 'library', category: 'RESOURCES', title: 'Resource library occupancy', description: 'See bookings across the open projects that share a resource library.', docsId: 'gids-bezettingsoverzicht' },
      { icon: 'relations', category: 'RELATIONS', title: 'Clearer milestone relations', description: 'Inspect relationships on milestones and summary tasks with more useful feedback.', docsId: 'gids-relaties-constraints' },
      { icon: 'tasks', category: 'TASKS', title: 'Consistent task types', description: 'New child tasks inherit their parent task type.', docsId: 'gids-plannen-wbs' },
      { icon: 'examples', category: 'EXAMPLES', title: 'Richer example projects', description: 'Bundled examples now include realistic resource sets.', docsId: 'gids-resources-histogram' },
    ],
    stats: { daysSincePrevious: 2, commitsSincePrevious: 360, addedCodeLines: 45066 },
  },
};

export function getReleaseHighlights(version: string): ReleaseHighlights | null {
  return RELEASES[version.replace(/^v/i, '')] ?? null;
}

export function isSafeHighlightIcon(icon: string): icon is HighlightIcon {
  return (HIGHLIGHT_ICONS as readonly string[]).includes(icon);
}
