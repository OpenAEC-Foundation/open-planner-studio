import { useEffect, useState, type CSSProperties } from 'react';
import type { B2IconName } from './b2IconNames';

/**
 * Eén B2-icoon uit de OpenAEC-huisstijl (iconenset B2, revisie 106 uit de OpenAEC Style Repo).
 *
 * De iconen staan als losse SVG-masters in `public/icons/b2/{16,24}/<id>.svg` — alleen de iconen
 * die de app gebruikt, zie `docs/b2-iconen.md`. Een master heeft twee delen: `data-part="primary"`
 * in `currentColor` en `data-part="accent"` in `var(--icon-accent, currentColor)`. De accentkleur
 * volgt het thema via `.b2-icon` in `globals.css`; op een accentachtergrond (actieve of primaire
 * knop) valt het accent terug op `currentColor`.
 *
 * Het component haalt een master één keer op (per maat) en houdt de binnenste markup in een
 * modulecache; daarna rendert elk gelijknamig icoon synchroon. Tot de eerste master binnen is,
 * staat er een lege `<svg>` van dezelfde maat, zodat de layout niet verspringt. De markup komt
 * uitsluitend uit de eigen `public/`-map van de app (geen gebruikersinvoer), vandaar het directe
 * `dangerouslySetInnerHTML` — extensie-iconen lopen via `ExtensionIcon` en de sanitizer.
 *
 * Maatkeuze: tot en met 18 px tekent de 16px-master, daarboven de 24px-master. Het lint gebruikt
 * 24 px voor grote knoppen en 16 px voor kleine knoppen en menu's; panelen en dialogen houden
 * hun bestaande pixelmaten.
 */
export interface B2IconProps {
  name: B2IconName;
  /** Weergavegrootte in px (standaard 16). */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Hoofdkleur (`currentColor`); zonder deze prop erft het icoon de tekstkleur. */
  color?: string;
  /** Horizontaal spiegelen, voor richtingsiconen in RTL. */
  flip?: boolean;
  /** Standaard `true`, tenzij er een `aria-label` is. */
  'aria-hidden'?: boolean | 'true' | 'false';
  'aria-label'?: string;
  role?: string;
  [dataAttribute: `data-${string}`]: string | undefined;
}

export type B2Master = 16 | 24;

/** Welke master bij een weergavemaat hoort: tot en met 18 px de 16px-master, daarboven 24 px. */
export function b2MasterFor(size: number): B2Master {
  return size <= 18 ? 16 : 24;
}

/** Het pad van een master, via `BASE_URL` zodat de platformbouw onder een subpad blijft werken. */
export function b2IconUrl(name: B2IconName, master: B2Master): string {
  return `${import.meta.env.BASE_URL}icons/b2/${master}/${name}.svg`;
}

/** Binnenste markup per `master/name`; een lege string betekent "niet gevonden" (geen herhaalde fetch). */
const markupCache = new Map<string, string>();
const pending = new Map<string, Promise<void>>();

/** Haalt de inhoud tussen `<svg …>` en `</svg>` uit een master. */
function innerMarkup(svgText: string): string {
  const open = svgText.indexOf('<svg');
  const start = open >= 0 ? svgText.indexOf('>', open) + 1 : 0;
  const end = svgText.lastIndexOf('</svg>');
  return start > 0 && end > start ? svgText.slice(start, end) : '';
}

function loadMarkup(key: string, url: string): Promise<void> {
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const task = (typeof fetch === 'function'
    ? fetch(url).then((res) => (res.ok ? res.text() : ''))
    : Promise.resolve(''))
    .then((text) => { markupCache.set(key, innerMarkup(text)); })
    .catch(() => { markupCache.set(key, ''); })
    .finally(() => { pending.delete(key); });
  pending.set(key, task);
  return task;
}

/** Laadt masters vooraf (bijvoorbeeld de linticonen bij het opstarten). */
export function preloadB2Icons(names: readonly B2IconName[], master: B2Master): Promise<void> {
  return Promise.all(names.map((name) => {
    const key = `${master}/${name}`;
    return markupCache.has(key) ? Promise.resolve() : loadMarkup(key, b2IconUrl(name, master));
  })).then(() => undefined);
}

export function B2Icon({
  name, size = 16, className, style, color, flip,
  'aria-hidden': ariaHidden, 'aria-label': ariaLabel, role,
  ...rest
}: B2IconProps) {
  const master = b2MasterFor(size);
  const key = `${master}/${name}`;
  const cached = markupCache.get(key);
  const [, rerender] = useState(0);

  useEffect(() => {
    if (cached !== undefined) return;
    let alive = true;
    void loadMarkup(key, b2IconUrl(name, master)).then(() => { if (alive) rerender((n) => n + 1); });
    return () => { alive = false; };
  }, [key, name, master, cached]);

  const classes = className ? `b2-icon ${className}` : 'b2-icon';
  const mergedStyle: CSSProperties | undefined = flip ? { transform: 'scaleX(-1)', ...style } : style;
  return (
    <svg
      className={classes}
      width={size}
      height={size}
      viewBox={`0 0 ${master} ${master}`}
      color={color}
      style={mergedStyle}
      role={role}
      aria-hidden={ariaHidden ?? (ariaLabel ? undefined : true)}
      aria-label={ariaLabel}
      focusable="false"
      data-b2-icon={name}
      data-b2-flip={flip ? 'x' : undefined}
      {...rest}
      dangerouslySetInnerHTML={{ __html: cached ?? '' }}
    />
  );
}
