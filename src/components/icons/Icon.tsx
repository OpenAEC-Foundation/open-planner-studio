import type { CSSProperties, SVGAttributes } from 'react';
import { B2_ICONS, type IconId, type IconMaster } from './b2/icons.generated';

export type { IconId } from './b2/icons.generated';

/**
 * Eén B2-icoon uit de OpenAEC Style Repo (huisstijl 0.4). Vervangt de lucide-iconen: één betekenis per
 * icoon, dus de `id` is de FUNCTIE (`task.add`, `calendar.holiday-add`), niet de vorm (`Plus`).
 *
 * - Master zoals de Style Repo voorschrijft: tot en met 18 px de 16 px-tekening, daarboven de 24 px-tekening;
 *   de `viewBox` schaalt naar `size`.
 * - Hoofdkleur `currentColor`, accent `var(--icon-accent)` (gezet in `icons.css` per thema; `oa-icon--mono`
 *   schakelt het accent uit). Een icoon met `semantic` kleurt mee met de statuskleur van het thema.
 * - Standaard decoratief (`aria-hidden`); met `aria-label` of `title` wordt het een `role="img"`.
 * - `data-icon` draagt het id voor tests en de self-test-harness (vervangt `.lucide-*`-selectors).
 */
export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'children' | 'viewBox' | 'width' | 'height'> {
  id: IconId;
  /** Zijde in px (standaard 16, zoals `.oa-icon` in de Style Repo). */
  size?: number;
  /** Accent uitzetten: alles in `currentColor` (Style Repo `oa-icon--mono`). */
  mono?: boolean;
  title?: string;
}

function masterFor(id: IconId, size: number): IconMaster {
  const def = B2_ICONS[id];
  return size <= 18 ? def.s16 : def.s24;
}

export function Icon({ id, size = 16, mono = false, className, style, title, ...rest }: IconProps) {
  const def = B2_ICONS[id];
  const master = masterFor(id, size);
  const box = size <= 18 ? 16 : 24;
  const decorative = !title && !rest['aria-label'] && !rest['aria-labelledby'];
  const classes = ['oa-icon', mono ? 'oa-icon--mono' : '', def.semantic ? `oa-icon--${def.semantic}` : '', className ?? '']
    .filter(Boolean).join(' ');
  const svgStyle: CSSProperties | undefined = def.accent
    ? { color: 'var(--icon-accent, currentColor)', ...style }
    : style;
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
      style={svgStyle}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {master.parts.map(([kind, tone, d], index) => {
        const paint = tone === 1 ? 'var(--icon-accent, currentColor)' : 'currentColor';
        return kind === 0
          ? <path key={index} d={d} fill="none" stroke={paint} strokeWidth={master.w} strokeLinecap="round" strokeLinejoin="round" />
          : <path key={index} d={d} fill={paint} fillRule="evenodd" />;
      })}
    </svg>
  );
}

/** Typeguard voor ids uit opgeslagen data (layouts, extensies): onbekend ⇒ `undefined`. */
export function toIconId(value: unknown): IconId | undefined {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(B2_ICONS, value) ? value as IconId : undefined;
}

export const ICON_IDS = Object.keys(B2_ICONS) as IconId[];
