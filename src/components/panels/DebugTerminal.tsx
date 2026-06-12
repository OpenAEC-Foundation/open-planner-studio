import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, Trash2, X } from 'lucide-react';
import { appLog, LogEntry, LogLevel } from '@/services/debug/appLog';
import { useAppStore } from '@/state/appStore';

const ALL_LEVELS: LogLevel[] = ['log', 'info', 'warn', 'error', 'event'];

// Functional log-level colors — readable on the dashboard-bg.
// Tokens for the brand-bound levels (log/warn/error); event keeps cyan
// since the stylebook has no equivalent semantic for "event".
const LEVEL_COLOR: Record<LogLevel, string> = {
  log:   'var(--scaffold-gray)',  // #A1A1AA
  info:  '#60a5fa',               // blue-400, readable on dark
  warn:  'var(--warm-gold)',      // #F59E0B
  error: '#f87171',               // red-400, lighter than --error for legibility on dark bg
  event: '#22d3ee',               // cyan-400, no stylebook equivalent
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// useSyncExternalStore wants a stable getSnapshot that returns the same
// reference until something changes. We cache the latest array.
let cachedSnapshot: LogEntry[] = appLog.snapshot();
appLog.subscribe((entries) => { cachedSnapshot = entries; });

function subscribe(onChange: () => void): () => void {
  return appLog.subscribe(() => onChange());
}
function getSnapshot(): LogEntry[] {
  return cachedSnapshot;
}

export function DebugTerminal() {
  const { t } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const entries = useSyncExternalStore(subscribe, getSnapshot);

  const [enabledLevels, setEnabledLevels] = useState<Set<LogLevel>>(() => new Set(ALL_LEVELS));
  const [paused, setPaused] = useState(false);
  const [stickyBottom, setStickyBottom] = useState(true);

  const listRef = useRef<HTMLDivElement>(null);
  const lastSeenIdRef = useRef<number>(0);
  // Snapshot we render when paused — frozen until unpaused.
  const frozenRef = useRef<LogEntry[] | null>(null);

  // When pausing, freeze the current entries; on unpause, release.
  useEffect(() => {
    if (paused) frozenRef.current = entries;
    else frozenRef.current = null;
  }, [paused]); // intentionally only on paused-flip

  const visibleEntries = useMemo(() => {
    const source = paused && frozenRef.current ? frozenRef.current : entries;
    return source.filter(e => enabledLevels.has(e.level));
  }, [entries, paused, enabledLevels]);

  // Auto-scroll to bottom when sticky and not paused.
  useEffect(() => {
    if (!stickyBottom || paused) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    if (visibleEntries.length > 0) {
      lastSeenIdRef.current = visibleEntries[visibleEntries.length - 1].id;
    }
  }, [visibleEntries, stickyBottom, paused]);

  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickyBottom(distanceFromBottom < 40);
  }, []);

  const toggleLevel = (lvl: LogLevel) => {
    setEnabledLevels(prev => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl); else next.add(lvl);
      return next;
    });
  };

  const newCount = useMemo(() => {
    if (stickyBottom) return 0;
    return visibleEntries.filter(e => e.id > lastSeenIdRef.current).length;
  }, [visibleEntries, stickyBottom]);

  const jumpToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setStickyBottom(true);
  };

  return (
    <div
      className="flex-shrink-0 flex flex-col border-t border-border"
      style={{
        height: 200,
        background: 'var(--dashboard-bg)',
        color: 'var(--dashboard-text)',
        fontFamily: 'var(--font-code)',
        fontSize: 11,
      }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-1 px-2 h-6 border-b"
        style={{ borderColor: 'var(--dashboard-border-light)', background: 'var(--dashboard-surface)' }}
      >
        {ALL_LEVELS.map(lvl => {
          const on = enabledLevels.has(lvl);
          return (
            <button
              key={lvl}
              onClick={() => toggleLevel(lvl)}
              title={t('debugTerminal.toggleLevel', { level: lvl })}
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 3,
                border: `1px solid ${on ? LEVEL_COLOR[lvl] : 'var(--dashboard-border)'}`,
                color: on ? LEVEL_COLOR[lvl] : 'var(--dashboard-text-dim)',
                background: 'transparent',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {lvl}
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={() => setPaused(p => !p)}
          title={paused ? t('debugTerminal.resume') : t('debugTerminal.pause')}
          style={{ background: 'transparent', border: 'none', color: 'var(--dashboard-text-muted)', cursor: 'pointer', padding: 2 }}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
        </button>
        <button
          onClick={() => appLog.clear()}
          title={t('debugTerminal.clear')}
          style={{ background: 'transparent', border: 'none', color: 'var(--dashboard-text-muted)', cursor: 'pointer', padding: 2 }}
        >
          <Trash2 size={12} />
        </button>
        <button
          onClick={() => setUI({ debugTerminalOpen: false })}
          title={t('close')}
          style={{ background: 'transparent', border: 'none', color: 'var(--dashboard-text-muted)', cursor: 'pointer', padding: 2 }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Feed */}
      <div
        ref={listRef}
        onScroll={onScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '2px 6px', position: 'relative' }}
      >
        {newCount > 0 && (
          <button
            onClick={jumpToBottom}
            style={{
              position: 'sticky',
              top: 4,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--dashboard-surface-hover)',
              color: 'var(--dashboard-text)',
              border: '1px solid var(--dashboard-border)',
              borderRadius: 10,
              padding: '1px 8px',
              fontSize: 10,
              cursor: 'pointer',
              zIndex: 1,
            }}
          >
            {t('debugTerminal.newEntries', { count: newCount })}
          </button>
        )}
        {visibleEntries.map(e => (
          <div key={e.id} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4 }}>
            <span style={{ color: 'var(--dashboard-text-dim)' }}>{formatTime(e.ts)}</span>{' '}
            <span style={{ color: LEVEL_COLOR[e.level] }}>
              [{e.level}{e.channel ? `/${e.channel}` : ''}]
            </span>{' '}
            <span>{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
