import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, Trash2, X } from 'lucide-react';
import { appLog, LogEntry, LogLevel } from '@/services/debug/appLog';
import { useAppStore } from '@/state/appStore';
import { createSnapshotStore, DashboardIconButton, DashboardPanel, formatClockTime } from './DashboardPanel';

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

const logStore = createSnapshotStore<LogEntry[]>(appLog.snapshot(), listener => appLog.subscribe(listener));

export function DebugTerminal() {
  const { t } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const entries = useSyncExternalStore(logStore.subscribe, logStore.getSnapshot);

  const [enabledLevels, setEnabledLevels] = useState<Set<LogLevel>>(() => new Set(ALL_LEVELS));
  const [paused, setPaused] = useState(false);
  const [stickyBottom, setStickyBottom] = useState(true);

  const listRef = useRef<HTMLDivElement>(null);
  const lastSeenIdRef = useRef<number>(0);
  // Snapshot we render when paused — frozen until unpaused.
  const frozenRef = useRef<LogEntry[] | null>(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  // When pausing, freeze the current entries; on unpause, release.
  useEffect(() => {
    if (paused) frozenRef.current = entriesRef.current;
    else frozenRef.current = null;
  }, [paused]);

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
    <DashboardPanel
      height={200}
      toolbar={<>
        {ALL_LEVELS.map(lvl => {
          const on = enabledLevels.has(lvl);
          return (
            <button
              key={lvl}
              onClick={() => toggleLevel(lvl)}
              title={t('debugTerminal.toggleLevel', { level: lvl })}
              className="!text-small"
              style={{
                padding: '1px 6px',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${on ? LEVEL_COLOR[lvl] : 'var(--dashboard-border)'}`,
                color: on ? LEVEL_COLOR[lvl] : 'var(--dashboard-text-dim)',
                background: on ? 'var(--dashboard-surface-hover)' : 'transparent',
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
        <DashboardIconButton
          onClick={() => setPaused(p => !p)}
          title={paused ? t('debugTerminal.resume') : t('debugTerminal.pause')}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
        </DashboardIconButton>
        <DashboardIconButton onClick={() => appLog.clear()} title={t('debugTerminal.clear')}>
          <Trash2 size={12} />
        </DashboardIconButton>
        <DashboardIconButton onClick={() => setUI({ debugTerminalOpen: false })} title={t('close')}>
          <X size={12} />
        </DashboardIconButton>
      </>}
    >
      {/* Feed */}
      <div
        ref={listRef}
        onScroll={onScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '2px 6px', position: 'relative' }}
      >
        {newCount > 0 && (
          <button
            onClick={jumpToBottom}
            className="!text-small"
            style={{
              position: 'sticky',
              top: 4,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--dashboard-surface-hover)',
              color: 'var(--dashboard-text)',
              border: '1px solid var(--dashboard-border)',
              borderRadius: 'var(--radius-full)',
              padding: '1px 8px',
              cursor: 'pointer',
              zIndex: 1,
            }}
          >
            {t('debugTerminal.newEntries', { count: newCount })}
          </button>
        )}
        {visibleEntries.map(e => (
          <div key={e.id} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4 }}>
            <span style={{ color: 'var(--dashboard-text-dim)' }}>{formatClockTime(e.ts)}</span>{' '}
            <span style={{ color: LEVEL_COLOR[e.level] }}>
              [{e.level}{e.channel ? `/${e.channel}` : ''}]
            </span>{' '}
            <span>{e.text}</span>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}
