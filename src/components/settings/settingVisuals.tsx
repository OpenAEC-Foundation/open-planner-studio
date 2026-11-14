// Kleine plaatjes bij instellingen waarvan je het effect anders pas ziet als je weet waar je moet
// kijken. Elk plaatje is een schets van een stukje van de app in HTML en CSS, met de themakleuren,
// zodat hij in licht, donker en hoog contrast vanzelf klopt. Tekst in een plaatje komt uit dezelfde
// formatters als de app zelf (duur, kloktijd, weekdag), zodat het voorbeeld de echte notatie toont.
// Alles is decoratie (`aria-hidden`): de naam van de keuze staat altijd als tekst onder het plaatje.

import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import type { ModifierMap, ResolvedUITheme, WheelFunction } from '@/state/slices/types';
import { formatClock } from '@/utils/displayTime';
import { durationSuffixesFrom, formatMeasuredDurationText, type MeasuredDuration } from '@/utils/taskDuration';
import type { DurationDisplay } from '@/types/view';
import { Icon } from '@/components/icons';
import './settingVisuals.css';

/** Een balk in procenten van de breedte van zijn spoor. */
function Bar({ from, to, className = '' }: { from: number; to: number; className?: string }) {
  const style: CSSProperties = { insetInlineStart: `${from}%`, width: `${to - from}%` };
  return <span className={`sv-bar ${className}`} style={style} />;
}

function Frame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`sv ${className}`} aria-hidden="true">{children}</div>;
}

// --- Thema ---------------------------------------------------------------------------------------

/** Representatieve kleurstalen per thema: titelbalk, paneel, accent en tekst. */
const THEME_SWATCHES: Record<ResolvedUITheme, string[]> = {
  'dark':          ['#2A2A32', '#36363E', '#D97706', '#FAFAF9'],
  // Licht volgt Blueprint v2026.45.0: titelbalk `frame`, paneel, accent en tekst (geen crème).
  'light':         ['#F4F4F5', '#FFFFFF', '#D97706', '#2A2A31'],
  'high-contrast': ['#000000', '#0a0a0a', '#FFFF00', '#FFFFFF'],
};

export function ThemeSwatches({ theme }: { theme: ResolvedUITheme }) {
  return (
    <div className="settings-theme-swatches" aria-hidden="true">
      {THEME_SWATCHES[theme].map((hex, i) => (
        <span key={i} className="settings-theme-swatch" style={{ background: hex }} />
      ))}
    </div>
  );
}

// --- Documentwissel-stijl ------------------------------------------------------------------------

/** Een venster met titelbalk en lint; de stijl bepaalt waar de geopende projecten staan. */
export function DocumentChromeVisual({ value }: { value: string }) {
  return (
    <Frame className="sv-window">
      <div className="sv-titlebar">
        <span className="sv-dots" />
        {value === 'switcher' && <span className="sv-pill sv-accent-outline" />}
      </div>
      <div className="sv-ribbon" />
      {value === 'tabs' && (
        <div className="sv-doctabs">
          <span className="sv-doctab is-active" />
          <span className="sv-doctab" />
          <span className="sv-doctab" />
        </div>
      )}
      <div className="sv-window-body">
        {value === 'rail' && (
          <div className="sv-docrail">
            <span className="is-active" />
            <span />
            <span />
          </div>
        )}
        <div className="sv-tracks">
          <div className="sv-track"><Bar from={6} to={46} /></div>
          <div className="sv-track"><Bar from={30} to={78} /></div>
          <div className="sv-track"><Bar from={52} to={94} /></div>
        </div>
      </div>
    </Frame>
  );
}

// --- Duurweergave --------------------------------------------------------------------------------

const DURATION_SAMPLES: readonly { duration: MeasuredDuration; to: number }[] = [
  { duration: { unit: 'days', days: 2 }, to: 80 },
  { duration: { unit: 'hours', minutes: 6 * 60 }, to: 30 },
];

/** Twee taken uit het raster: een dagtaak van 2 dagen en een urentaak van 6 uur, bij 8 uur per dag. */
export function DurationDisplayVisual({ value }: { value: string }) {
  const { t, i18n } = useTranslation('common');
  const fmt = { display: value as DurationDisplay, suffixes: durationSuffixesFrom(t), locale: i18n.language };
  return (
    <Frame className="sv-grid">
      {DURATION_SAMPLES.map(({ duration, to }, i) => (
        <div className="sv-grid-row" key={i}>
          <span className="sv-cell">{formatMeasuredDurationText(duration, 8, fmt)}</span>
          <span className="sv-track"><Bar from={0} to={to} /></span>
        </div>
      ))}
    </Frame>
  );
}

// --- Alleen werkbare dagen tonen -----------------------------------------------------------------

/** 3 januari 2024 is een woensdag (UTC). De taak begint op woensdag en duurt 5 werkdagen. */
const WEDNESDAY = Date.UTC(2024, 0, 3);
const DAY_MS = 86_400_000;

export function CompressNonWorkdaysVisual({ on }: { on: boolean }) {
  const { i18n } = useTranslation('common');
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow', timeZone: 'UTC' });
  // Woensdag t/m dinsdag: met de grijze weekenddagen 7 kolommen, zonder 5.
  const days = Array.from({ length: 7 }, (_, i) => new Date(WEDNESDAY + i * DAY_MS))
    .map(date => ({ label: weekday.format(date), weekend: date.getUTCDay() === 0 || date.getUTCDay() === 6 }))
    .filter(day => !on || !day.weekend);
  const columns: CSSProperties = { gridTemplateColumns: `repeat(${days.length}, 1fr)` };
  return (
    <Frame className="sv-timeline">
      <div className="sv-scale" style={columns}>
        {days.map((day, i) => <span key={i} className={day.weekend ? 'is-off' : ''}>{day.label}</span>)}
      </div>
      <div className="sv-days" style={columns}>
        {days.map((day, i) => <span key={i} className={day.weekend ? 'is-off' : ''} />)}
        <Bar from={0} to={100} />
      </div>
    </Frame>
  );
}

// --- Kwartieren bij ver inzoomen -----------------------------------------------------------------

export function QuarterHourVisual({ on }: { on: boolean }) {
  const notation = useAppStore(s => s.ui.timeNotation);
  return (
    <Frame className="sv-timeline">
      <div className="sv-scale sv-scale-hours">
        <span>{formatClock(9 * 60, notation)}</span>
        <span>{formatClock(10 * 60, notation)}</span>
      </div>
      {on && (
        <div className="sv-scale sv-scale-quarters">
          {Array.from({ length: 8 }, (_, i) => <span key={i} />)}
        </div>
      )}
      {/* Slepen snapt op hele uren, met kwartieren op een kwartier: 9:15–10:30. */}
      <div className="sv-track sv-track-tall">
        {on ? <Bar from={12.5} to={75} /> : <Bar from={0} to={100} />}
      </div>
    </Frame>
  );
}

// --- Taakbalken bij onderbrekingen ---------------------------------------------------------------

/** Twee urentaken over de middagpauze; de bovenste is geselecteerd. */
export function BarSplitVisual({ value }: { value: string }) {
  const split = (selected: boolean) => value === 'always' || (value === 'selection' && selected);
  const row = (selected: boolean) => (
    <div className={`sv-track sv-track-row ${selected ? 'is-selected' : ''}`}>
      {split(selected)
        ? <><Bar from={8} to={44} /><Bar from={56} to={92} /></>
        : <Bar from={8} to={92} />}
    </div>
  );
  return (
    <Frame className="sv-split">
      <span className="sv-break" />
      {row(true)}
      {row(false)}
    </Frame>
  );
}

// --- Scrollen en zoomen --------------------------------------------------------------------------

const FUNCTION_GLYPH: Record<WheelFunction, ReactNode> = {
  vertical: <span className="sv-glyph">↕</span>,
  horizontal: <span className="sv-glyph">↔</span>,
  zoom: <Icon id="view.zoom-in" size={12} />,
};

function Mouse() {
  return <span className="sv-mouse"><span /></span>;
}

function KeyCap({ children }: { children: ReactNode }) {
  return <span className="sv-key">{children}</span>;
}

/** Welke toets bij welke wielfunctie hoort: gewoon, Ctrl en Shift. */
export function WheelMapVisual({ map }: { map: ModifierMap }) {
  const { t } = useTranslation('common');
  const rows: { keys: ReactNode; fn: WheelFunction }[] = [
    { keys: null, fn: map.plain },
    { keys: <KeyCap>{t('settings.keyCtrl')}</KeyCap>, fn: map.ctrl },
    { keys: <KeyCap>{t('settings.keyShift')}</KeyCap>, fn: map.shift },
  ];
  return (
    <Frame className="sv-wheelmap">
      {rows.map(({ keys, fn }, i) => (
        <div className="sv-wheelmap-row" key={i}>
          {keys}
          <Mouse />
          <span className="sv-arrow">→</span>
          {FUNCTION_GLYPH[fn]}
        </div>
      ))}
    </Frame>
  );
}

/** De drie modi naast elkaar: slepen, positie of toetsen. */
export function ScrollModeVisual({ value }: { value: string }) {
  // De modi Toetsen en Positie tonen hun huidige toewijzing en schermverdeling.
  const map = useAppStore(s => s.ui.modifierMap);
  const division = useAppStore(s => s.ui.positionDivision);
  if (value === 'modifier') return <WheelMapVisual map={map} />;
  if (value === 'position') return <PositionDivisionVisual value={division} />;
  // Zoom + slepen: het wiel zoomt, de achtergrond slepen verschuift.
  return (
    <Frame className="sv-wheelmap">
      <div className="sv-wheelmap-row">
        <Mouse />
        <span className="sv-arrow">→</span>
        {FUNCTION_GLYPH.zoom}
      </div>
      <div className="sv-wheelmap-row">
        <span className="sv-grab" />
        <span className="sv-arrow">→</span>
        <span className="sv-glyph">✥</span>
      </div>
    </Frame>
  );
}

/** Waar de cursor staat bepaalt de functie: het oranje vlak scrolt horizontaal, de rest verticaal. */
export function PositionDivisionVisual({ value }: { value: string }) {
  return (
    <Frame className={`sv-zones sv-zones-${value}`}>
      <span className="sv-zone sv-zone-vertical"><span className="sv-glyph">↕</span></span>
      <span className="sv-zone sv-zone-horizontal"><span className="sv-glyph">↔</span></span>
    </Frame>
  );
}
