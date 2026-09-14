// B1c-plan4 taak 2 — de BALK van één project in de verdeeldialoog (spec §4/§5/§6).
//
// DE BALK IS DE BEDIENING. Vóór dit herontwerp was de strook een dun blokje van 24 px waarin je
// dagen niet kon tellen, pauzes niet zag en tijdens het slepen niets bewoog; de eigenaar vatte dat
// op 2026-09-12 samen als "ik snap niet wat alle knoppen doen". De vorm hier is die van het
// gekozen prototype (`docs/superpowers/prototypes/2026-08-27-b1c-interface-lab.html`, tabblad 4):
// een rij van drie kolommen — label 150 px | track 32 px | uitkomstlabel 132 px — met per werkdag
// een apart blokje, zodat je de dagen letterlijk kunt tellen.
//
// DE GEOMETRIE ZIT NIET HIER. `stripGeometry.ts` rekent uit een voorstel-doorsnede de dagblokjes,
// pauzedagen, de gestippelde rest en de meetlat uit; deze component tekent ze en vangt de gebaren
// op. Dat is dezelfde knip als tussen `chartGeometry.ts` en `BeforeAfterChart.tsx`.
//
// SVG VOOR DE TRACK, DOM VOOR DE HANDLE. Zie het plan bij taak 2: de tekenlaag neemt de x/w van de
// pure module 1-op-1 over, en de handle is een echte `<button>` omdat hij focus, toetsen en een
// `:focus-visible`-omranding nodig heeft.
//
// DE HANDLE ANKERT OP HET NIEUWE FASE-EINDE. `buildStripGeometry` zet hem op `phaseEndX` plus de
// nog OPENSTAANDE uitloop (`max(0, plafond − benut)` werkdagen); hij valt daarmee nooit ín de balk,
// en bij een volledig benutte uitloop is er geen gestippelde doos (`freeBox === null`). Deze
// component leest die posities dus uitsluitend uit de geometrie en rekent ze niet zelf na.
//
// DE WERKDAGVRAAG KOMT VAN BUITEN. `isWorkingDay` levert de aanroeper uit de PROJECTkalender van
// het betreffende document (`CalendarEngine.isWorkDay`) — dezelfde eenheid als `endShiftWorkdays`
// in `distribute.ts`. KANTTEKENING (taak 1): een individuele taak kan een afwijkende taakkalender
// hebben; de arcering van een pauzedag leest dan de projectkalender, niet die van de taak. Voor de
// bedoeling van de balk — "hier zit een ingevoegde onderbreking" — is dat de juiste grofheid.
//
// LIVE MEEREKENEN TIJDENS HET SLEPEN (§5). Onder de ondersteunde schaal gaat élke gesnapte
// werkdagverandering meteen naar `onCeilingChange` — de hook coalesceert die runs zelf (één in
// vlucht, de laatste stand wint), dus er is hier GEEN eigen timer nodig en er mag er ook geen
// bijkomen: een tweede throttle zou de laatste stand kunnen inslikken. Boven de schaal
// (`liveCommit === false`) commit alleen het loslaten, en beweegt tijdens het slepen dus alleen de
// handle en de plafondtekst. Een zuivere klik (pointerdown/-up zonder move) commit nooit iets:
// anders zou een klik op een onbegrensde handle 'm stiekem op een concreet getal zetten.
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AXIS, type OccupancyAxis } from '@/components/panels/occupancyAxis';
import { STRIP, buildStripGeometry } from './stripGeometry';

/** Eindige bovengrens voor `aria-valuemax`. Het plafond zélf kent ook `null` = ONBEGRENSD (de
 *  End-toets); dat is geen 61e waarde maar het ontbreken van een grens, en wordt aan
 *  hulptechnologie gerapporteerd als deze `valuemax` mét een `aria-valuetext` die "onbegrensd"
 *  zegt — een slider zonder eindige `valuemax` is voor screenreaders betekenisloos. */
export const CEILING_MAX_WORKDAYS = 60;

/** De pil-toon bij een einddatum-verschuiving (§4): 0 groen, 1–2 amber, meer rood. */
function shiftTone(workdays: number): { background: string; color: string } {
  if (workdays <= 0) {
    return {
      background: 'color-mix(in srgb, var(--success) 18%, transparent)',
      color: 'var(--success)',
    };
  }
  if (workdays <= 2) {
    return {
      background: 'color-mix(in srgb, var(--warning) 20%, transparent)',
      color: 'var(--warning)',
    };
  }
  return {
    background: 'color-mix(in srgb, var(--error) 16%, transparent)',
    color: 'var(--error)',
  };
}

export interface PhaseStripProps {
  docId: string;
  title: string;
  /** De gedeelde tijdas, of `null` wanneer er geen enkele geboekte dag te tekenen valt. */
  axis: OccupancyAxis | null;
  /** `proposal.bookingByDay[docId]` — de stand VÓÓR (ankerpunt van de meetlat). */
  beforeLoadByDay: Record<string, number>;
  /** `proposal.afterLoadByDay[docId]` — de stand NÁ; dít wordt als dagblokjes getekend. */
  afterLoadByDay: Record<string, number>;
  /** `proposal.fixedLoadByDay` met de eigen boeking er al af wanneer dit document gepind is. */
  fixedLoadByDay: Record<string, number>;
  /** Is deze kalenderdag een werkdag in de kalender van dít document? Bepaalt of een boekingsloze
   *  dag binnen de fase een PAUZEDAG is of gewoon weekend. */
  isWorkingDay: (iso: string) => boolean;
  /** De identiteitskleur van dít document (`assignDocColors`) — gedeeld met het histogram. */
  color: string;
  /** De eigen speling in werkdagen; `null` ⇒ onbekend (geen boekende taak). */
  slackWorkdays: number | null;
  /** Werkdagen die de einddatum van dít document opschuift in het huidige voorstel. */
  endShiftWorkdays: number;
  /** Het ingestelde plafond in werkdagen; `null` = onbegrensd. */
  ceiling: number | null;
  pinned: boolean;
  /** #63 "datums zoals opgeslagen": impliciet gepind, en niet met een pin-knop te ontgrendelen. */
  recorded: boolean;
  /** Alle betrokken taken staan vast (priority 1000) — het document KAN niet wijken. */
  cannotMove: boolean;
  /** Onder de ondersteunde schaal ⇒ élke gesnapte werkdag commit meteen (§5). */
  liveCommit: boolean;
  /** Er loopt een berekening: de uitkomstpil toont "Bezig…" ZONDER van maat te veranderen (§7). */
  busy: boolean;
  /**
   * Hoeveel taken van dit document niet passen (0 = geen tekort). Een tekort maakt de uitkomstpil
   * ROOD, ook bij een ongewijzigde einddatum: "eind ongewijzigd" in het groen naast een rode badge
   * en een rode strook las als "alles in orde", terwijl er juist taken onbediend blijven.
   */
  shortfallCount: number;
  /** De volle tekortzin voor de `title` van de pil (leeg bij geen tekort). */
  shortfallTitle?: string;
  /** Datumnotatie voor de plafonddatum — de dialoog levert één `Intl.DateTimeFormat` voor alle rijen. */
  formatDay: (iso: string) => string;
  onTogglePin: () => void;
  onCeilingChange: (next: number | null) => void;
}

export function PhaseStrip({
  docId, title, axis, beforeLoadByDay, afterLoadByDay, fixedLoadByDay, isWorkingDay, color,
  slackWorkdays, endShiftWorkdays, ceiling, pinned, recorded, cannotMove, liveCommit, busy,
  shortfallCount, shortfallTitle, formatDay, onTogglePin, onCeilingChange,
}: PhaseStripProps) {
  const { t } = useTranslation('common');

  // Sleepstate: `dragRef` is de bron van waarheid TIJDENS het slepen (geen staleness over
  // event-grenzen heen), `dragValue` de renderbare afgeleide. Niet-`null` ⇒ er wordt nu gesleept.
  const dragRef = useRef<{ pointerId: number; startX: number; startCeiling: number; moved: boolean; value: number } | null>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);
  // De greep moet ZICHTBAAR de focus hebben (spec §5): hij wordt met pijltjes bediend, en zonder
  // omranding weet je niet welke van de rijen die toets opvangt. Dat kan hier niet met
  // `:focus-visible` in CSS omdat de hele greep inline gestyled is (zijn x volgt de geometrie), dus
  // de focus is gewone React-state. `onFocus`/`onBlur` en niet `:focus-within`: de greep IS het
  // focusbare element.
  const [focused, setFocused] = useState(false);

  const dayWidth = axis?.dayWidth ?? 0;
  const trackWidth = axis?.width ?? AXIS.padLeft + 200;
  const displayCeiling = dragValue !== null ? dragValue : ceiling;

  const geometry = axis === null ? null : buildStripGeometry({
    axis,
    beforeLoadByDay,
    loadByDay: afterLoadByDay,
    fixedLoadByDay,
    isWorkingDay,
    slackWorkdays: slackWorkdays ?? 0,
    ceilingWorkdays: displayCeiling,
    endShiftWorkdays,
    // Bij een tekort tekent de rij ook waar het werk VÓÓR de verdeling stond — zie `ghostBlocks`.
    showGhosts: shortfallCount > 0,
  });

  const handleX = geometry?.handleX ?? AXIS.padLeft;
  const patternId = `ops-pause-${docId}`;

  const ceilingText = displayCeiling === null
    ? t('resource.distribution.strip.ceilingUnlimited')
    : t('resource.distribution.strip.ceilingDays', { count: displayCeiling });
  const shiftText = endShiftWorkdays === 0
    ? t('resource.distribution.strip.endUnchanged')
    : t('resource.distribution.strip.endShift', { count: endShiftWorkdays });
  const maxDateText = geometry?.ceilingEndIso
    ? t('resource.distribution.strip.maxDate', { date: formatDay(geometry.ceilingEndIso) })
    : t('resource.distribution.strip.maxDate', { date: t('resource.distribution.strip.ceilingUnlimited') });
  const usedText = t('resource.distribution.strip.used', { used: endShiftWorkdays });
  // BIJ EEN TEKORT STAAT DE TEKORTZIN ZÉLF IN DE PIL (bevinding B6 van de review). De pil wordt
  // rood zodra er een taak niet past, maar de tekst bleef "eind ongewijzigd" — rood met een
  // geruststellende zin erin las als een tegenspraak. De pil krijgt de KORTE vorm zonder
  // documentnaam: die naam staat al in het label links van dezelfde rij. Dat is een eigen
  // meervoudfamilie (`strip.shortfall_*`) en niet de langere `shortfall.doc_*` met een lege
  // `{{doc}}` — zo'n truc leunt op de woordvolgorde van veertien vertalingen en breekt stil zodra
  // een vertaler de documentnaam achteraan zet. De volle zin blijft in de `title` staan, samen met
  // de einddatum-uitkomst.
  const shortfallText = shortfallCount > 0
    ? t('resource.distribution.strip.shortfall', { count: shortfallCount })
    : '';
  const pillText = busy
    ? t('resource.distribution.compute.busy')
    : (shortfallCount > 0 ? shortfallText : shiftText);
  const pillTitle = shortfallCount > 0
    ? `${shortfallTitle ?? shortfallText} · ${shiftText}`
    : undefined;
  const valueText = `${ceilingText} — ${shiftText}`;

  const clamp = (value: number) => Math.max(0, Math.min(CEILING_MAX_WORKDAYS, value));
  // Onbegrensd is geen getal op de as, dus een pijltje pakt de handle op waar hij staat: bij de
  // benutte uitloop. Dat is de enige lezing waarin de handle niet verspringt op het moment dat je
  // hem voor het eerst aanraakt. Pointer en toetsenbord delen dit stappunt — één definitie.
  const stepBase = ceiling ?? Math.max(0, endShiftWorkdays);

  const commit = (next: number | null) => {
    if (pinned) return;
    onCeilingChange(next);
  };

  const onHandleKey = (event: React.KeyboardEvent) => {
    if (pinned) return;
    let next: number | null;
    switch (event.key) {
      case 'ArrowRight': case 'ArrowUp': next = clamp(stepBase + 1); break;
      case 'ArrowLeft': case 'ArrowDown': next = clamp(stepBase - 1); break;
      case 'PageUp': next = clamp(stepBase + 3); break;
      case 'PageDown': next = clamp(stepBase - 3); break;
      case 'Home': next = 0; break;
      case 'End': next = null; break;
      default: return;
    }
    // De dialoog scrollt; pijltjes en Home/End mogen die scroll niet óók verzetten.
    event.preventDefault();
    event.stopPropagation();
    commit(next);
  };

  const onHandlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (pinned || dragRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    // `preventDefault()` onderdrukt óók de standaard focus-stap van de browser (bevinding B9): na
    // een klik op de greep stond de focus nog op wat er daarvóór actief was, en deed een pijltje
    // dus niets — terwijl de greep er wel "aangeraakt" uitzag. Focus dus zelf zetten, ná het
    // capturen, zodat toetsenbordbediening naadloos op de muis aansluit.
    event.currentTarget.focus();
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startCeiling: stepBase, moved: false, value: stepBase };
    setDragValue(stepBase);
  };

  const onHandlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.moved = true;
    if (dayWidth <= 0) return;
    // Snappen op hele werkdagen: dezelfde dayWidth-per-werkdag-conventie die de tekenpositie van de
    // handle hierboven gebruikt. Een tweede, kalenderdaggetrouwe omrekening zou de handle tijdens
    // het slepen van zijn eigen getekende positie laten afwijken.
    const next = clamp(drag.startCeiling + Math.round((event.clientX - drag.startX) / dayWidth));
    if (next === drag.value) return;
    drag.value = next;
    setDragValue(next);
    // Onder de schaal is ELKE gesnapte werkdag een rekenmoment (§5). De hook coalesceert.
    if (liveCommit) commit(next);
  };

  const onHandlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragValue(null);
    // Een zuivere klik commit niets; in de live-stand is de waarde al onderweg.
    if (drag.moved && !liveCommit) commit(drag.value);
  };

  const onHandlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragValue(null);
  };

  // Een tekort weegt zwaarder dan de einddatum: past er een taak niet, dan is de rij rood, ook
  // als het eind niet verschuift. Anders staat er een groene pil naast een rode badge.
  const tone = shortfallCount > 0 ? shiftTone(Number.POSITIVE_INFINITY) : shiftTone(endShiftWorkdays);

  return (
    <div
      className="flex items-center"
      style={{ gap: STRIP.gap }}
      data-ops-distribution-strip
      data-ops-doc-id={docId}
      data-ops-distribution-day-width={dayWidth}
      {...(pinned ? { 'data-ops-distribution-pinned': 'true' } : {})}
    >
      {/* (a) LABEL — kleurstip, projectnaam, speling, pin-tekstknop (§4/§6). */}
      <div
        className="flex flex-col justify-center shrink-0 min-w-0"
        style={{ width: STRIP.labelWidth }}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <span
            className="inline-block rounded-[2px] shrink-0"
            style={{ width: 8, height: 8, background: color }}
            aria-hidden
          />
          <span className="truncate font-medium">{title}</span>
        </span>
        <span className="text-[10px] text-text-secondary truncate">
          {t('resource.distribution.strip.slack', {
            days: slackWorkdays === null ? '—' : String(slackWorkdays),
          })}
        </span>
        {recorded ? (
          <span
            className="text-[10px] text-text-secondary truncate"
            title={`${t('recordedDates.active')} ${t('recordedDates.recalculate')}`}
            data-ops-distribution-recorded
          >
            {t('resource.distribution.strip.pinnedRecorded')}
          </span>
        ) : cannotMove ? (
          <span className="text-[10px] text-text-secondary truncate">
            {t('resource.distribution.strip.cannotMove')}
          </span>
        ) : (
          <button
            type="button"
            aria-pressed={pinned}
            title={t('resource.distribution.help.pin')}
            onClick={onTogglePin}
            // EEN ECHTE KNOP, GEEN ONDERSTREEPT WOORDJE (polishronde 2026-09-14, bevinding 7). Het
            // vastzetten is naast de greep de tweede bediening van de rij; als kale link tussen
            // twee regels grijze tekst las hij als voetnoot. Dezelfde vorm als "Reset" onderin de
            // dialoog — rand, afgeronde hoek, hover-vlak — alleen compacter. In gepinde stand draagt
            // hij het accent, zodat de stand ook zonder de tekst te lezen zichtbaar is; `aria-pressed`
            // blijft de bron voor hulptechnologie en de browsertest.
            className="mt-0.5 self-start max-w-full truncate rounded-[6px] border px-1.5 py-[1px] text-[10px] leading-4 hover:bg-surface-hover"
            style={pinned
              ? {
                borderColor: 'var(--theme-accent)',
                background: 'color-mix(in srgb, var(--theme-accent) 12%, transparent)',
                color: 'var(--theme-accent)',
              }
              : { borderColor: 'var(--theme-border)', color: 'var(--color-text-secondary)' }}
            data-ops-distribution-pin
          >
            {pinned
              ? t('resource.distribution.strip.unpinButton')
              : t('resource.distribution.strip.pinButton')}
          </button>
        )}
      </div>

      {/* (b) TRACK. Geforceerd LTR, net als het histogram: een tijdas spiegelt nergens in dit
          product. De horizontale scroll zit BEWUST niet hier maar om de hele stapel heen (de
          dialoog), zodat balken en histogram kolom-op-kolom blijven staan tijdens het scrollen. */}
      <div
        className="relative shrink-0"
        dir="ltr"
        style={{ width: trackWidth, height: STRIP.trackHeight, direction: 'ltr' }}
        data-ops-distribution-track
      >
        <svg
          width={trackWidth}
          height={STRIP.trackHeight}
          viewBox={`0 0 ${trackWidth} ${STRIP.trackHeight}`}
          role="img"
          aria-label={title}
          style={{ display: 'block' }}
        >
          <defs>
            {/* De arcering van een pauzedag: `repeating-linear-gradient(135deg, …)` uit het
                prototype, hier als SVG-pattern zodat hij met het thema meekleurt. */}
            <pattern id={patternId} width={6} height={6} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <rect width={6} height={6} fill="var(--theme-text-dim)" opacity={0.05} />
              <rect width={3} height={6} fill="var(--theme-text-dim)" opacity={0.17} />
            </pattern>
          </defs>

          {/* De track zelf: lichte achtergrond met een randje (`.ptrack`). */}
          <rect
            x={AXIS.padLeft} y={0}
            width={Math.max(0, trackWidth - AXIS.padLeft - AXIS.padRight)}
            height={STRIP.trackHeight}
            rx={6}
            fill="var(--theme-surface-alt, transparent)"
            stroke="var(--theme-border-light)"
          />

          {/* Vaste last van gepinde/#63-documenten (§4, achtergrondband). */}
          {(geometry?.fixedBands ?? []).map((band, i) => (
            <rect key={`fx-${i}`} x={band.x} y={0} width={band.w} height={STRIP.trackHeight}
              fill="var(--theme-text-dim)" opacity={0.14} />
          ))}

          {/* De BREUKEN van de as (bevinding B1). Een gat van meer dan `GAP_COMPRESS_DAYS`
              kalenderdagen is weggeklapt; zonder markering leest de balk alsof de twee segmenten
              aan elkaar vast zitten. Zelfde "⋯" als het histogram en de voor/na-grafiek. */}
          {(axis?.breaks ?? []).map((x, i) => (
            <text
              key={`brk-${i}`}
              x={x} y={STRIP.trackHeight / 2 + 4}
              textAnchor="middle" fontSize={11} fill="var(--theme-text-muted)"
              data-ops-distribution-break
            >
              ⋯
            </text>
          ))}

          {/* Weekscheidingen (1 px) en de donkerdere maandlijn. */}
          {(geometry?.weekLines ?? []).map((x, i) => (
            <rect key={`w-${i}`} x={x} y={0} width={1} height={STRIP.trackHeight} fill="var(--theme-border-light)" />
          ))}
          {(geometry?.monthLines ?? []).map((x, i) => (
            <rect key={`m-${i}`} x={x} y={0} width={1} height={STRIP.trackHeight} fill="var(--theme-border)" />
          ))}

          {/* "Toegestaan maar niet benut" — lege doos met gestippelde rand (§4). */}
          {geometry?.freeBox && (
            <rect
              x={geometry.freeBox.x} y={STRIP.blockTop}
              width={Math.max(1, geometry.freeBox.w)} height={STRIP.blockHeight}
              fill="none" stroke="var(--theme-text-dim)" strokeWidth={1} strokeDasharray="3 3" rx={2}
              // GEDEMPT (polishronde 2026-09-14). Bij een onbegrensd plafond staat de greep aan de
              // rechterrand, dus deze doos beslaat sinds de breedtefix de HELE track in plaats van
              // een paar dagen. Op volle sterkte was hij daarmee het luidste element in de dialoog,
              // terwijl hij ruimte aanduidt en geen boeking. Hij blijft leesbaar, maar achter de
              // dagblokjes.
              opacity={0.5}
              data-ops-distribution-tail
            />
          )}

          {/* SPOOKBLOKJES bij een tekort: waar dit werk stond vóór de verdeling, omlijnd in de
              projectkleur en zonder vulling. Vóór de polishronde van 2026-09-14 was de track van
              een project dat nergens paste helemaal LEEG — nu zie je wát er niet past. Ze staan
              ONDER de echte dagblokjes zodat een deels geplaatst project geen dubbel blokje geeft. */}
          {(geometry?.ghostBlocks ?? []).map(block => (
            <rect
              key={`g-${block.iso}`}
              x={block.x + 0.5} y={STRIP.blockTop}
              width={Math.max(1, block.w - 1)} height={STRIP.blockHeight}
              fill="none" stroke={color} strokeWidth={1} strokeDasharray="2 2" rx={2}
              opacity={0.8}
              data-ops-doc-id={docId} data-ops-distribution-day="unplaced"
            />
          ))}

          {/* De dagblokjes. Een werkdag in de projectkleur met een 1 px witte scheiding rechts
              (`.pwork`), een pauzedag gearceerd met een dun grijs randje (`.ppause`). */}
          {(geometry?.blocks ?? []).map(block => (block.kind === 'work' ? (
            <rect
              key={`b-${block.iso}`}
              x={block.x} y={STRIP.blockTop}
              width={Math.max(1, block.w - 1)} height={STRIP.blockHeight}
              fill={color} opacity={pinned ? 0.45 : 0.9}
              data-ops-doc-id={docId} data-ops-distribution-day="work"
            />
          ) : (
            <rect
              key={`p-${block.iso}`}
              x={block.x + 0.5} y={STRIP.blockTop}
              width={Math.max(1, block.w - 1)} height={STRIP.blockHeight}
              fill={`url(#${patternId})`} stroke="var(--theme-border)" strokeWidth={1} rx={2}
              data-ops-distribution-day="pause"
            />
          )))}

          {/* De meetlat: grijs gestippeld = speling, massief rood = einddatum-verschuiving (§4). */}
          {geometry?.slackBar && (
            <rect
              x={geometry.slackBar.x} y={STRIP.trackHeight - STRIP.measureBottom - STRIP.measureHeight}
              width={Math.max(1, geometry.slackBar.w)} height={STRIP.measureHeight}
              fill="var(--theme-text-dim)" opacity={0.55} strokeDasharray="3 3"
              data-ops-distribution-slack-bar
            />
          )}
          {geometry?.overrunBar && (
            <rect
              x={geometry.overrunBar.x} y={STRIP.trackHeight - STRIP.measureBottom - STRIP.measureHeight}
              width={Math.max(1, geometry.overrunBar.w)} height={STRIP.measureHeight}
              fill="var(--error)"
              data-ops-distribution-overrun-bar
            />
          )}
        </svg>

        {/* De HANDLE (§5): een echte knop van 15×30 met drie grijpstreepjes. */}
        <button
          type="button"
          role="slider"
          aria-label={t('resource.distribution.strip.handleLabel', { doc: title })}
          aria-valuemin={0}
          aria-valuemax={CEILING_MAX_WORKDAYS}
          aria-valuenow={displayCeiling ?? CEILING_MAX_WORKDAYS}
          aria-valuetext={valueText}
          aria-disabled={pinned || undefined}
          title={t('resource.distribution.help.ceiling')}
          onKeyDown={onHandleKey}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerCancel}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          data-ops-distribution-handle
          {...(focused ? { 'data-ops-distribution-handle-focused': 'true' } : {})}
          className="absolute flex items-center justify-center rounded-[4px] border"
          style={{
            left: handleX - STRIP.handleWidth / 2,
            top: STRIP.handleTop,
            width: STRIP.handleWidth,
            height: STRIP.handleHeight,
            // ZWEVEND OPPERVLAK MET EEN BEDIENINGSRAND, geen wit blokje. Vóór deze polishronde stond
            // hier `var(--theme-text-secondary)` — een variabele die in geen enkel thema bestaat,
            // dus viel de rand terug op `currentColor` en was de greep in het donkere thema knalwit
            // (gemeten 2026-09-14: `borderTopColor: rgb(241,243,245)`), terwijl de drie
            // grijpstreepjes op diezelfde niet-bestaande variabele juist ONZICHTBAAR waren
            // (achtergrond → transparant). `--theme-control-border` is de bestaande rand van
            // bedienbare elementen; in focus wordt dat het accent.
            borderColor: focused && !pinned ? 'var(--theme-accent)' : 'var(--theme-control-border)',
            background: 'var(--theme-surface-elevated)',
            boxShadow: focused && !pinned ? '0 0 0 2px color-mix(in srgb, var(--theme-accent) 35%, transparent)' : 'none',
            cursor: pinned ? 'not-allowed' : 'ew-resize',
            opacity: pinned ? 0.45 : 1,
            touchAction: 'none',
            padding: 0,
            outline: 'none',
          }}
        >
          {/* Drie grijpstreepjes (`.phandle::before` met twee box-shadows in het prototype). */}
          <span aria-hidden className="flex items-center" style={{ gap: 2 }}>
            <span style={{ width: 1, height: 13, background: 'var(--theme-text-dim)' }} />
            <span style={{ width: 1, height: 13, background: 'var(--theme-text-dim)' }} />
            <span style={{ width: 1, height: 13, background: 'var(--theme-text-dim)' }} />
          </span>
        </button>
      </div>

      {/* (c) UITKOMSTLABEL — vaste breedte, dus een toestandswissel verandert de maat niet (§7). */}
      <div
        className="flex flex-col items-end shrink-0 text-right"
        style={{ width: STRIP.endWidth }}
        data-ops-distribution-effect
      >
        <span
          className="inline-block max-w-full truncate rounded-full px-2 py-0.5 tabular-nums"
          {...(shortfallCount > 0
            ? { 'data-ops-distribution-effect-shortfall': 'true', ...(pillTitle ? { title: pillTitle } : {}) }
            : {})}
          style={busy
            ? { background: 'color-mix(in srgb, var(--theme-text-dim) 14%, transparent)', color: 'var(--theme-text-dim)' }
            : tone}
        >
          {pillText}
        </span>
        <span className="text-[10px] text-text-secondary truncate w-full">
          {`${maxDateText} · ${usedText}`}
        </span>
      </div>
    </div>
  );
}
