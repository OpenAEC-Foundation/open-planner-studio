// B1c-plan3 taak 9 — de FASESTROOK van één document in de verdeeldialoog (spec §6, minus het
// pointer-slepen: dat is taak 10).
//
// WAT DE STROOK TOONT. Eén SVG-rij op de GEDEELDE tijdas (`occupancyAxis.ts` — dezelfde as als het
// histogram in het bezettingsoverzicht, zodat een strook en dat histogram per constructie boven
// elkaar uitkomen):
//  - de VASTE LAST als achtergrondband: wat gepinde/#63-documenten al van het poolitem opeisen;
//  - de BOEKING van dít document als gevulde blokken over de dagen waarop het echt boekt. Dagen
//    zonder boeking binnen de spanne blijven leeg — dat is precies wat een bestaande split of een
//    ingevoegde pauze zichtbaar maakt;
//  - een GESTIPPELDE STAART van het einde van de benutte uitloop tot het plafond: toegestaan, maar
//    niet benut.
//
// HET LABEL BIJ DE HANDLE TOONT HET EINDDATUM-EFFECT, NIET DE SLEEPAFSTAND (§6). Een gebruiker
// verplaatst een plafond om te zien wat er met zijn EINDDATUM gebeurt; "handle 3 werkdagen naar
// rechts" is een handeling, geen uitkomst. Staat er meer toe dan er benut wordt, dan zegt de strook
// dat er apart bij ("gevraagd 3, dichtst haalbare 1") — anders leest een ongebruikte ruimte als een
// mislukking.
//
// TOETSENBORD IS EEN VOLWAARDIGE ROUTE, GEEN NAZORG. De handle is een `role="slider"` met
// `aria-valuetext` (plafond, benutting én einddatum-effect); pijltjes verzetten één werkdag,
// PageUp/PageDown vijf, Home zet het plafond op 0 en End maakt het onbegrensd. Snappen op hele
// werkdagen is inherent: het plafond ís een geheel aantal werkdagen.
//
// WAAROM `ceiling ?? endShiftWorkdays` HET STAPPUNT IS. Een onbegrensd plafond is geen getal op de
// as maar de End-stand; de handle staat dan visueel aan het einde van wat er BENUT wordt. Een
// pijltje pakt hem dus op waar hij staat. Dat is ook de enige lezing waarin de handle niet
// verspringt op het moment dat je hem voor het eerst aanraakt.
import { useTranslation } from 'react-i18next';
import { Pin } from 'lucide-react';
import { AXIS, type OccupancyAxis } from '@/components/panels/occupancyAxis';

/** Eindige bovengrens voor `aria-valuemax`. Het plafond zélf kent ook `null` = ONBEGRENSD (de
 *  End-toets); dat is geen 61e waarde maar het ontbreken van een grens, en wordt aan
 *  hulptechnologie gerapporteerd als deze `valuemax` mét een `aria-valuetext` die "onbegrensd"
 *  zegt — een slider zonder eindige `valuemax` is voor screenreaders betekenisloos. */
export const CEILING_MAX_WORKDAYS = 60;

/** Hoogte van de tekenstrook (viewBox-eenheden ≈ px). */
const STRIP_HEIGHT = 24;

export interface PhaseStripProps {
  docId: string;
  title: string;
  /** De gedeelde tijdas, of `null` wanneer er geen enkele geboekte dag te tekenen valt. */
  axis: OccupancyAxis | null;
  /** ISO-dag → eenheden die dít document op het poolitem boekt (uit `computeLibraryOccupancy`). */
  dailyLoad: Record<string, number>;
  /** ISO-dag → vaste last van gepinde/#63-documenten (uit `DistributionProposal`). */
  fixedLoadByDay: Record<string, number>;
  /** Bovengrens van de verticale as in eenheden (capaciteit of hoogste stapeling). */
  scaleMax: number;
  /** Werkdagen die de einddatum van dít document opschuift in het huidige voorstel. */
  endShiftWorkdays: number;
  /** Het ingestelde plafond in werkdagen; `null` = onbegrensd. */
  ceiling: number | null;
  pinned: boolean;
  /** #63 "datums zoals opgeslagen": impliciet gepind, en niet met een pin-knop te ontgrendelen. */
  recorded: boolean;
  /** Alle betrokken taken staan vast (priority 1000) — het document KAN niet wijken. */
  cannotMove: boolean;
  /** Gedegradeerd overzicht (§3.4): een plafondwijziging rekent niet automatisch door. */
  degraded: boolean;
  onTogglePin: () => void;
  onCeilingChange: (next: number | null) => void;
}

export function PhaseStrip({
  docId, title, axis, dailyLoad, fixedLoadByDay, scaleMax,
  endShiftWorkdays, ceiling, pinned, recorded, cannotMove, degraded,
  onTogglePin, onCeilingChange,
}: PhaseStripProps) {
  const { t } = useTranslation('common');

  const dayWidth = axis?.dayWidth ?? 0;
  const stripWidth = axis?.width ?? AXIS.padLeft + 200;
  const yOf = (units: number) =>
    STRIP_HEIGHT * (1 - Math.min(1, Math.max(0, units) / Math.max(0.01, scaleMax)));

  // Blokken per kalenderdag van de as: de vaste last onderaan, de eigen boeking daarbovenop.
  const fixedRects: { key: string; x: number; y: number; h: number }[] = [];
  const bookedRects: { key: string; x: number; y: number; h: number }[] = [];
  let lastBookedX: number | null = null;
  if (axis !== null) {
    for (const segment of axis.segments) {
      for (let i = 0; i < segment.days.length; i++) {
        const iso = segment.days[i];
        const x = segment.x0 + i * dayWidth;
        const booked = dailyLoad[iso] ?? 0;
        // Een gepind document zit ZELF in de vaste last (dat is wat pinnen betekent). Zonder deze
        // aftrek zou zijn eigen boeking twee keer in dezelfde staaf staan.
        const fixed = Math.max(0, (fixedLoadByDay[iso] ?? 0) - (pinned ? booked : 0));
        if (fixed > 0) {
          const y = yOf(fixed);
          fixedRects.push({ key: iso, x, y, h: STRIP_HEIGHT - y });
        }
        if (booked > 0) {
          const y0 = yOf(fixed);
          const y1 = yOf(fixed + booked);
          bookedRects.push({ key: iso, x, y: y1, h: Math.max(1, y0 - y1) });
          lastBookedX = x;
        }
      }
    }
  }

  // Rechterrand van de benutte boeking; de handle en de staart hangen daaraan.
  const usedEndX = lastBookedX === null ? AXIS.padLeft : lastBookedX + dayWidth;
  // Het plafond ligt `ceiling - benutte uitloop` werkdagen voorbij die rand (kan negatief zijn:
  // een plafond dat krapper is dan wat er nu benut wordt — dan valt de handle ín de strook).
  const tailWorkdays = ceiling === null ? 0 : ceiling - endShiftWorkdays;
  const handleX = Math.max(
    AXIS.padLeft,
    Math.min(stripWidth - AXIS.padRight, usedEndX + tailWorkdays * dayWidth),
  );

  const ceilingText = ceiling === null
    ? t('resource.distribution.strip.ceilingUnlimited')
    : t('resource.distribution.strip.ceilingDays', { count: ceiling });
  const endEffectText = endShiftWorkdays === 0
    ? t('resource.distribution.strip.endUnchanged')
    : t('resource.distribution.strip.endShift', { count: endShiftWorkdays });
  // "Toegestaan maar niet benut" (§6): pas melden zodra er echt ruimte overblijft.
  const achievableText = ceiling !== null && endShiftWorkdays < ceiling
    ? t('resource.distribution.strip.requestedVsAchievable', {
        requested: ceiling, achievable: endShiftWorkdays,
      })
    : null;
  // Gedegradeerd overzicht (§3.4): de waarde is gezet, maar er is niet doorgerekend — dan zou het
  // oude effect een LEUGEN zijn bij de nieuwe handle-stand.
  const effectText = degraded ? t('resource.distribution.compute.pressRecompute') : endEffectText;
  const valueText = [ceilingText, effectText, achievableText].filter(Boolean).join(' — ');

  const clamp = (value: number) => Math.max(0, Math.min(CEILING_MAX_WORKDAYS, value));
  // Zie het moduleblok: onbegrensd is geen getal, dus een pijltje pakt de handle op waar hij staat.
  const stepBase = ceiling ?? Math.max(0, endShiftWorkdays);

  const onHandleKey = (event: React.KeyboardEvent) => {
    if (pinned) return;
    let next: number | null;
    switch (event.key) {
      case 'ArrowRight': case 'ArrowUp': next = clamp(stepBase + 1); break;
      case 'ArrowLeft': case 'ArrowDown': next = clamp(stepBase - 1); break;
      case 'PageUp': next = clamp(stepBase + 5); break;
      case 'PageDown': next = clamp(stepBase - 5); break;
      case 'Home': next = 0; break;
      case 'End': next = null; break;
      default: return;
    }
    // De dialoog scrollt; pijltjes en Home/End mogen die scroll niet óók verzetten.
    event.preventDefault();
    event.stopPropagation();
    onCeilingChange(next);
  };

  return (
    <div
      className="flex flex-col gap-1 px-2 py-1.5 rounded-[8px] border border-border-light"
      data-ops-distribution-strip
      data-ops-doc-id={docId}
      {...(pinned ? { 'data-ops-distribution-pinned': 'true' } : {})}
    >
      <div className="flex items-center gap-2">
        <span className="truncate font-medium flex-1 min-w-0">{title}</span>

        {recorded ? (
          // #63: geen bedienbare pin — het document doet pas mee als de gebruiker dáár herberekent.
          <span
            className="text-text-secondary shrink-0"
            title={`${t('recordedDates.active')} ${t('recordedDates.recalculate')}`}
            data-ops-distribution-recorded
          >
            {t('resource.distribution.strip.pinnedRecorded')}
          </span>
        ) : (
          <button
            type="button"
            aria-pressed={pinned}
            aria-label={t('resource.distribution.strip.pin')}
            title={pinned ? t('resource.distribution.strip.pinned') : t('resource.distribution.strip.pin')}
            onClick={onTogglePin}
            className={`p-0.5 rounded shrink-0 hover:bg-surface-hover ${pinned ? 'text-accent' : 'text-text-secondary'}`}
            data-ops-distribution-pin
          >
            <Pin size={13} />
          </button>
        )}
        {pinned && !recorded && (
          <span className="text-text-secondary truncate">{t('resource.distribution.strip.pinned')}</span>
        )}
        {cannotMove && (
          <span className="text-text-secondary truncate">{t('resource.distribution.strip.cannotMove')}</span>
        )}

        {achievableText !== null && (
          <span className="text-text-secondary tabular-nums shrink-0" data-ops-distribution-achievable>
            {achievableText}
          </span>
        )}
        <span className="tabular-nums text-text-secondary shrink-0" data-ops-distribution-effect>
          {effectText}
        </span>
      </div>

      {/* Geforceerd LTR, net als het histogram: een tijdas spiegelt nergens in dit product. */}
      <div className="overflow-x-auto" dir="ltr" style={{ direction: 'ltr' }}>
        <div className="relative" style={{ width: stripWidth }}>
          <svg
            width={stripWidth}
            height={STRIP_HEIGHT}
            viewBox={`0 0 ${stripWidth} ${STRIP_HEIGHT}`}
            role="img"
            aria-label={title}
            style={{ display: 'block' }}
          >
            <rect
              x={AXIS.padLeft} y={0}
              width={Math.max(0, stripWidth - AXIS.padLeft - AXIS.padRight)}
              height={STRIP_HEIGHT}
              fill="var(--theme-surface-alt, transparent)"
              stroke="var(--theme-border-light)"
            />
            {/* Vaste last: wat gepinde/#63-documenten al opeisen (§6 achtergrondband). */}
            {fixedRects.map(r => (
              <rect key={`f-${r.key}`} x={r.x} y={r.y} width={dayWidth} height={r.h}
                fill="var(--theme-text-dim)" opacity={0.35} />
            ))}
            {/* De boeking van dít document; boekingsloze dagen binnen de spanne blijven leeg. */}
            {bookedRects.map(r => (
              <rect key={`b-${r.key}`} x={r.x + 0.5} y={r.y} width={Math.max(1, dayWidth - 1)} height={r.h}
                fill="var(--theme-accent)" opacity={pinned ? 0.45 : 0.85} />
            ))}
            {/* Toegestaan maar niet benut. */}
            {tailWorkdays > 0 && dayWidth > 0 && (
              <rect
                x={usedEndX} y={2} width={Math.max(1, handleX - usedEndX)} height={STRIP_HEIGHT - 4}
                fill="none" stroke="var(--theme-accent)" strokeWidth={1} strokeDasharray="3 3"
                data-ops-distribution-tail
              />
            )}
          </svg>
          <div
            role="slider"
            tabIndex={0}
            aria-label={t('resource.distribution.strip.handleLabel', { doc: title })}
            aria-valuemin={0}
            aria-valuemax={CEILING_MAX_WORKDAYS}
            aria-valuenow={ceiling ?? CEILING_MAX_WORKDAYS}
            aria-valuetext={valueText}
            aria-disabled={pinned || undefined}
            title={t('resource.distribution.strip.ceiling')}
            onKeyDown={onHandleKey}
            data-ops-distribution-handle
            className="absolute rounded-[2px]"
            style={{
              left: handleX - 2,
              top: 0,
              width: 5,
              height: STRIP_HEIGHT,
              background: pinned ? 'var(--theme-text-dim)' : 'var(--theme-accent)',
              cursor: pinned ? 'not-allowed' : 'ew-resize',
              opacity: pinned ? 0.5 : 1,
            }}
          />
        </div>
      </div>
    </div>
  );
}
