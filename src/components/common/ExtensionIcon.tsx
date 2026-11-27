import { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { sanitizeSvgIcon } from '@/utils/sanitizeSvgIcon';

interface ExtensionIconProps {
  raw: string | null | undefined;
  fallback: ReactNode;
  style?: CSSProperties;
}

export function ExtensionIcon({ raw, fallback, style }: ExtensionIconProps) {
  const icon = useMemo(() => sanitizeSvgIcon(raw), [raw]);

  if (!icon) return <>{fallback}</>;

  if (icon.kind === 'text') return <span style={style}>{icon.text}</span>;

  return <span style={style} dangerouslySetInnerHTML={{ __html: icon.markup }} />;
}
