import type { SVGAttributes } from 'react';
import { B2_ICONS, type IconDef, type IconId, type IconMaster } from './b2/icons.generated';

export type { IconId };

const ICONS: Readonly<Record<IconId, IconDef>> = B2_ICONS;

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'children' | 'viewBox' | 'width' | 'height'> {
  id: IconId;
  size?: number;
  mono?: boolean;
  title?: string;
}

function masterFor(id: IconId, size: number): IconMaster {
  const def = ICONS[id];
  return size <= 18 ? def.s16 : def.s24;
}

export function Icon({ id, size = 16, mono = false, className, style, title, ...rest }: IconProps) {
  const decorative = !title && !rest['aria-label'] && !rest['aria-labelledby'];
  const def = ICONS[id];
  const master = masterFor(id, size);
  const box = size <= 18 ? 16 : 24;
  const ownColor = /(^|\s)text-/.test(className ?? '');
  const classes = ['oa-icon', mono ? 'oa-icon--mono' : '', def.semantic && !ownColor ? `oa-icon--${def.semantic}` : '', className ?? '']
    .filter(Boolean).join(' ');
  return (
    <svg
      className={classes}
      width={size}
      height={size}
      viewBox={`0 0 ${box} ${box}`}
      data-icon={id}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : 'img'}
      focusable="false"
      style={style}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {box === 16
        ? renderParts(master)
        : (
          <>
            <g className="oa-icon__m24">{renderParts(master)}</g>
            <g className="oa-icon__m16" transform="scale(1.5)">{renderParts(def.s16)}</g>
          </>
        )}
    </svg>
  );
}

function renderParts(master: IconMaster) {
  return master.parts.map(([kind, tone, d], index) => {
    const paint = tone === 1 ? 'var(--icon-accent, currentColor)' : 'currentColor';
    return kind === 0
      ? <path key={index} d={d} fill="none" stroke={paint} strokeWidth={master.w} strokeLinecap="round" strokeLinejoin="round" />
      : <path key={index} d={d} fill={paint} fillRule="evenodd" />;
  });
}

export function toIconId(value: unknown): IconId | undefined {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ICONS, value) ? value as IconId : undefined;
}

export const ICON_IDS = Object.keys(ICONS) as IconId[];
