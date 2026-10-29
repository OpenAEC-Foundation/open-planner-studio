import type { CSSProperties, SVGAttributes } from 'react';
import { B2_ICONS, type IconDef, type IconId, type IconMaster } from './b2/icons.generated';

export type { IconId };

const ICONS: Readonly<Record<IconId, IconDef>> = B2_ICONS;

/**
 * Eén B2-icoon uit de OpenAEC Style Repo (huisstijl 0.4). Vervangt de lucide-iconen: één betekenis per
 * icoon, dus de `id` is de FUNCTIE (`task.add`, `calendar.holiday-add`), niet de vorm (`Plus`).
 *
 * - Master zoals de Style Repo voorschrijft: tot en met 18 px de 16 px-tekening, daarboven de 24 px-tekening;
 *   de `viewBox` schaalt naar `size`. Boven 18 px gaat de 16 px-tekening verborgen mee, voor plekken waar CSS
 *   het icoon op 16 px zet (zie `icons.css`).
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
  const def = ICONS[id];
  return size <= 18 ? def.s16 : def.s24;
}

export function Icon({ id, size = 16, mono = false, className, style, title, ...rest }: IconProps) {
  const def = ICONS[id];
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
      {box === 16
        ? renderParts(master)
        : (
          <>
            <g className="oa-icon__m24">{renderParts(master)}</g>
            {/* De 16 px-master op het 24-raster (×1,5). `icons.css` toont hem waar het lint een groot icoon
                op 16 px zet (mini-stand, ingeklapt lint); dan staat hij op ware grootte en blijft hij scherp. */}
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

/** Typeguard voor ids uit opgeslagen data (layouts, extensies): onbekend ⇒ `undefined`. */
export function toIconId(value: unknown): IconId | undefined {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ICONS, value) ? value as IconId : undefined;
}

export const ICON_IDS = Object.keys(ICONS) as IconId[];
