import type { CSSProperties, SVGAttributes } from 'react';
import { B2_ICONS, type IconDef, type IconId, type IconMaster } from './b2/icons.generated';
import { applyDockProposal } from './dockProposal';
import { b2IconsOn } from './iconFamily';
import { LUCIDE_ICONS, LUCIDE_SHAPES, type LucideShape } from './lucideMapping';

export type { IconId };

const ICONS: Readonly<Record<IconId, IconDef>> = B2_ICONS;

/**
 * Standaard de oude Lucide-vorm, maat en kleur van vóór B2 (#765); `b2-icons` kiest de OpenAEC Blueprint
 * (huisstijl 0.4). Wijkt een plek af van de tabel, dan zegt de prop `lucide` hoe hij er vroeger uitzag.
 * Alle iconen van de app lopen hierlangs: één betekenis per
 * icoon, dus de `id` is de FUNCTIE (`task.add`, `calendar.holiday-add`), niet de vorm (`Plus`).
 *
 * - Master zoals de Style Repo voorschrijft: tot en met 18 px de 16 px-tekening, daarboven de 24 px-tekening;
 *   de `viewBox` schaalt naar `size`. Boven 18 px gaat de 16 px-tekening verborgen mee, voor plekken waar CSS
 *   het icoon op 16 px zet (zie `icons.css`).
 * - Hoofdkleur `currentColor`, accent `var(--icon-accent)` (gezet in `icons.css` per thema; `oa-icon--mono`
 *   schakelt het accent uit). Een icoon met `semantic` kleurt mee met de statuskleur van het thema.
 * - Grijs is de basis, oranje het accent: een icoon is nooit helemaal oranje (Blueprint `docs/iconen.md`, "Grijs en
 *   oranje"). Geeft een plek het icoon de oranje tekstkleur, dan wordt het toch helemaal oranje; geef het icoon
 *   daar een grijze tekstkleur (`text-text-secondary`). `tests/planning/check-icon-accent-text.ts` en
 *   `tests/browser/icon-orange.spec.ts` bewaken dat.
 * - Standaard decoratief (`aria-hidden`); met `aria-label` of `title` wordt het een `role="img"`.
 * - `data-icon` draagt het id voor tests en de self-test-harness.
 */
export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'children' | 'viewBox' | 'width' | 'height'> {
  id: IconId;
  /** Zijde in px (standaard 16, zoals `.oa-icon` in de Style Repo). */
  size?: number;
  /** Accent uitzetten: alles in `currentColor` (Style Repo `oa-icon--mono`). */
  mono?: boolean;
  title?: string;
  /** Hoe deze plek er vóór B2 uitzag, als dat afwijkt. Geldt alleen zonder B2; zie `LucideLegacy`. */
  lucide?: LucideLegacy;
}

/**
 * De oude Lucide-aanroep van één plek (vóór #765), voor wat daar afwijkt van de B2-aanroep. Zonder B2 gaat elk
 * veld voor op de gewone prop; `className: undefined` en `style: undefined` halen die van de B2-aanroep weg.
 * B2 negeert dit helemaal.
 */
export interface LucideLegacy {
  /** De oude vorm, als die hier een andere was dan de vorm in `LUCIDE_ICONS`. */
  icon?: LucideShape;
  size?: number;
  strokeWidth?: number;
  fill?: string;
  className?: string;
  style?: CSSProperties;
}

function masterFor(id: IconId, size: number): IconMaster {
  const def = ICONS[id];
  return size <= 18 ? applyDockProposal(id, 16, def.s16) : applyDockProposal(id, 24, def.s24);
}

export function Icon({ id, size = 16, mono = false, className, style, title, lucide, ...rest }: IconProps) {
  const decorative = !title && !rest['aria-label'] && !rest['aria-labelledby'];
  if (!b2IconsOn()) {
    // Zonder B2 precies de oude aanroep: geen `oa-icon`, dus ook geen B2-CSS uit `icons.css`.
    const old = lucide ?? {};
    const Lucide = old.icon ? LUCIDE_SHAPES[old.icon] : LUCIDE_ICONS[id];
    return (
      <Lucide
        size={old.size ?? size}
        className={'className' in old ? old.className : className}
        data-icon={id}
        aria-hidden={decorative ? true : undefined}
        role={decorative ? undefined : 'img'}
        focusable="false"
        style={'style' in old ? old.style : style}
        {...(old.strokeWidth === undefined ? {} : { strokeWidth: old.strokeWidth })}
        {...(old.fill === undefined ? {} : { fill: old.fill })}
        {...rest}
      >
        {title ? <title>{title}</title> : null}
      </Lucide>
    );
  }
  const def = ICONS[id];
  const master = masterFor(id, size);
  const box = size <= 18 ? 16 : 24;
  // Geeft de plek zelf een tekstkleur op, dan gaat die voor op de statuskleur van het icoon.
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
            {/* De 16 px-master op het 24-raster (×1,5). `icons.css` toont hem waar het lint een groot icoon
                op 16 px zet (mini-stand, ingeklapt lint); dan staat hij op ware grootte en blijft hij scherp. */}
            <g className="oa-icon__m16" transform="scale(1.5)">{renderParts(applyDockProposal(id, 16, def.s16))}</g>
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
