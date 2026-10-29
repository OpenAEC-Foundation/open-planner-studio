// Linkcontrole voor de gegenereerde wiki, niet voor codevoorbeelden in auteurshandleidingen.
import { stripCode } from './docs-structure';

export interface DeadWikiLink { page: string; target: string }

/** `pages` bevat wikislugs zonder .md en hun Markdown. Behoud het bestaande linkbeleid. */
export function deadWikiLinks(pages: ReadonlyMap<string, string>): DeadWikiLink[] {
  const dead: DeadWikiLink[] = [];
  for (const [page, source] of pages) {
    for (const match of stripCode(source).matchAll(/\]\(([^)]+)\)/g)) {
      let target = match[1].trim();
      if (/^(https?:|mailto:|#|<)/.test(target) || /\.(png|jpe?g|gif|svg)$/i.test(target)) continue;
      target = target.split('#')[0];
      if (target && !pages.has(target)) dead.push({ page, target });
    }
  }
  return dead;
}
