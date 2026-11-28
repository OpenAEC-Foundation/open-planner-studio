import type { UIFontFamily } from '@/state/slices/types';

export const DEFAULT_UI_FONT_STACK = '"Inter", system-ui, sans-serif';

function resolveSystemFontStack(): string {
  if (typeof navigator === 'undefined') {
    return 'sans-serif';
  }
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('win')) {
    return '"Segoe UI", sans-serif';
  }
  if (platform.includes('mac')) {
    return '-apple-system, BlinkMacSystemFont, sans-serif';
  }
  return '-webkit-system-font, system-ui, sans-serif';
}

export const UI_FONT_STACKS: Record<Exclude<UIFontFamily, 'default'>, string> = {
  system: resolveSystemFontStack(),
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
};

export function resolveUIFontStack(family: UIFontFamily): string {
  return family === 'default' ? DEFAULT_UI_FONT_STACK : UI_FONT_STACKS[family];
}
