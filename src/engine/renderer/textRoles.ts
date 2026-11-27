export const TEXT_ROLE_PX = {
  caption: 9,
  small: 10,
  body: 11,
  large: 12,
  heading: 14,
  title: 20,
} as const;

export type TextRole = keyof typeof TEXT_ROLE_PX;

export const CANVAS_FALLBACK_FONT_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

export function canvasFont(role: TextRole, scale: number, family?: string, bold = false): string {
  const size = Math.round(TEXT_ROLE_PX[role] * scale);
  return `${bold ? 'bold ' : ''}${size}px ${family ?? CANVAS_FALLBACK_FONT_STACK}`;
}
