// Tekstrollen voor canvastekst (Gantt-tijdlijn, histogram).
//
// Een canvas leest geen CSS, dus de zes rollen uit het `@theme static`-blok in
// `src/styles/globals.css` (`--text-caption` … `--text-title`) staan hier nog een keer als getal.
// `npm run verify:text-roles` bewaakt dat beide lijsten gelijk blijven. Schrijf canvastekst via een
// rolnaam (`canvasFont('body', …)`), nooit met een losse pixelmaat: dan volgt hij dezelfde
// grootte als de DOM-tekst ernaast, bv. het taakraster links van de Gantt (`--text-body`).
//
// Buiten bereik: print en PDF (`src/services/`) rekenen in eigen eenheden en schalen apart.

/** Basisgrootte per rol in px bij Tekengrootte 100% — gelijk aan `--text-<rol>` in globals.css. */
export const TEXT_ROLE_PX = {
  caption: 9,
  small: 10,
  body: 11,
  large: 12,
  heading: 14,
  title: 20,
} as const;

export type TextRole = keyof typeof TEXT_ROLE_PX;

/** Fontfamilie als de aanroeper er geen meegeeft (headless tests). In de app komt de familie uit
 *  de interface-instelling (`resolveUIFontStack`). */
export const CANVAS_FALLBACK_FONT_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

/**
 * `ctx.font`-string voor een tekstrol. `scale` is `ui.uiFontScale / 100`, net als
 * `--ui-font-scale` in de DOM. Afgerond op hele pixels: sub-pixel-fontgroottes tekenen onscherp.
 */
export function canvasFont(role: TextRole, scale: number, family?: string, bold = false): string {
  const size = Math.round(TEXT_ROLE_PX[role] * scale);
  return `${bold ? 'bold ' : ''}${size}px ${family ?? CANVAS_FALLBACK_FONT_STACK}`;
}
