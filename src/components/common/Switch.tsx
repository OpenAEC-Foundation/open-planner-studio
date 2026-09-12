import type { ReactNode } from 'react';

/**
 * Eén schakelaar voor de hele app (gebruikstest 2026-09-12, gebrek 3).
 *
 * De handgeschreven varianten liepen stuk op de wortel-fontgrootte: die is in deze app 13px, dus
 * Tailwind's rem-maten (`w-9` = 29,25px, `w-4` = 13px) maakten een knop die het spoor bijna
 * helemaal vulde — 0,6px lucht boven en onder, en in de aan-stand een knop die tegen de rand plakt.
 * Daarom staat hier ALLES in vaste pixels en doet flex het werk:
 *
 *   spoor  34 × 18 px, `p-[2px]`, `inline-flex items-center`  → contentvak 30 × 14 px
 *   knop   14 × 14 px                                          → 2px lucht boven/onder (flex)
 *   aan    `translate-x-[16px]`                                → 2 + 16 + 14 = 32, rest 2px rechts
 *
 * Verticaal centreren is dus een flex-eigenschap (kan niet scheef staan) en de horizontale marge is
 * in beide standen per constructie exact 2px. Geen rem, geen `left`-berekening, geen rand die de
 * binnenbreedte per stand verandert.
 */
export interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  /** Zichtbaar label naast het spoor. Ontbreekt het, geef dan `ariaLabel` mee. */
  label?: ReactNode;
  title?: string;
  ariaLabel?: string;
  disabled?: boolean;
  /** Extra klassen op de knop zelf (bv. de plaatsingsstijl van de titelbalk). */
  className?: string;
  /** Doorgeefluik voor `data-ops-*`-haken waar de browsertests aan hangen. */
  [dataAttribute: `data-${string}`]: unknown;
}

export function Switch({
  checked,
  onChange,
  label,
  title,
  ariaLabel,
  disabled,
  className,
  ...rest
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      title={title}
      onClick={onChange}
      className={className}
      {...rest}
    >
      {label !== undefined && <span>{label}</span>}
      <span
        aria-hidden
        className="relative inline-flex items-center shrink-0 w-[34px] h-[18px] p-[2px] rounded-full transition-colors"
        style={{ background: checked ? 'var(--theme-accent)' : 'var(--theme-control-border)' }}
        data-ops-switch-track
      >
        <span
          className={`block w-[14px] h-[14px] rounded-full transition-transform${checked ? ' translate-x-[16px]' : ''}`}
          // De knop is bewust NIET `var(--theme-surface)` zoals de titelbalk-variant was. Gemeten in
          // het donkere thema: spoor `--theme-control-border` #4A515C met een knop #2E3239 erop —
          // twee donkere grijzen, op de foto op 300% niet te onderscheiden. In de titelbalk viel dat
          // niet op omdat die op een nóg donkerder balk staat, in een dialoog wel. Wit met een
          // schaduwrandje leest in beide thema's en op beide spoorkleuren.
          style={{ background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.35)' }}
          data-ops-switch-knob
        />
      </span>
    </button>
  );
}
