// Zichtbaar foutscherm als de app niet start of vastloopt (issue #895).
//
// Het venster start verborgen (`appWindow.ts`). Mislukt de start, dan mag het niet onzichtbaar blijven
// of een leeg vlak tonen: dit scherm zegt wat er is, met de details om te melden en een knop om opnieuw
// te laden. Bewust zonder React: juist React of de app-bundel kan de oorzaak zijn. De tekst komt uit
// i18n (het Engels zit altijd in de bundel, dus ook als de taal niet laadde).
//
// Twee ingangen in `main.tsx`: de start zelf faalt (taal, instellingen, de app-bundel), of React meldt
// een fout die niemand opving (`onUncaughtError`); React haalt dan de hele boom weg.
import i18n from '@/i18n/config';
import { revealAppWindow } from './appWindow';

const SCREEN_ID = 'ops-fatal-error';

function errorDetails(error: unknown): string {
  if (error instanceof Error) return error.stack && error.stack.includes(error.message) ? error.stack : `${error.name}: ${error.message}\n${error.stack ?? ''}`;
  try { return typeof error === 'string' ? error : JSON.stringify(error); } catch { return String(error); }
}

/** Zet het foutscherm over de app heen en toont het venster. Een tweede fout vult alleen de details aan. */
export function showFatalError(error: unknown): void {
  console.error('De app kon niet verder:', error);
  const t = (key: 'fatalError.title' | 'fatalError.body' | 'fatalError.reload' | 'fatalError.details') => i18n.t(key, { ns: 'common' });
  const existing = document.getElementById(SCREEN_ID);
  const details = errorDetails(error);
  if (existing) {
    const pre = existing.querySelector('pre');
    if (pre) pre.textContent += `\n\n${details}`;
  } else {
    document.getElementById('root')?.replaceChildren();
    const screen = document.createElement('div');
    screen.id = SCREEN_ID;
    screen.setAttribute('role', 'alert');
    screen.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-surface text-text-primary p-8';

    const card = document.createElement('div');
    card.className = 'ui-card flex flex-col gap-4 p-6 max-w-[640px] w-full';
    const title = document.createElement('h1');
    title.className = 'text-title font-semibold';
    title.textContent = t('fatalError.title');
    const body = document.createElement('p');
    body.className = 'text-large leading-5';
    body.textContent = t('fatalError.body');
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'btn btn--primary self-start';
    reload.textContent = t('fatalError.reload');
    reload.addEventListener('click', () => window.location.reload());
    const disclosure = document.createElement('details');
    const summary = document.createElement('summary');
    summary.className = 'text-body cursor-pointer';
    summary.textContent = t('fatalError.details');
    const pre = document.createElement('pre');
    pre.className = 'text-small leading-4 whitespace-pre-wrap break-words max-h-[240px] overflow-auto select-text mt-2';
    pre.textContent = details;
    disclosure.append(summary, pre);
    card.append(title, body, reload, disclosure);
    screen.append(card);
    document.body.append(screen);
    reload.focus();
  }
  void revealAppWindow('fout');
}
