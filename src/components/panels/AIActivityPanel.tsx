import { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, X, Check, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';
import * as activityLog from '@/services/mcp/activityLog';
import type { ActivityEntry } from '@/services/mcp/contracts';
import { useAppStore } from '@/state/appStore';

// AI-activiteitenpaneel (T15, spec §UI). Rechterpaneel in dezelfde rail als de DebugTerminal, maar
// gevoed door de eigen `activityLog`-ring-buffer i.p.v. de log-bus. Nieuwste aanroep boven; klik op
// een regel klapt de volledige args/respons uit (monospace, scrollbaar). "Wissen" leegt de buffer.

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

// useSyncExternalStore wil een stabiele getSnapshot: cache de laatste array-referentie.
let cachedSnapshot: ActivityEntry[] = activityLog.getEntries();
activityLog.subscribe((entries) => { cachedSnapshot = entries; });

function subscribe(onChange: () => void): () => void {
  return activityLog.subscribe(() => onChange());
}
function getSnapshot(): ActivityEntry[] {
  return cachedSnapshot;
}

/** Eén uitklapbare regel + geneste sub-stappen (batch). */
function ActivityRow({ entry, depth = 0 }: { entry: ActivityEntry; depth?: number }) {
  const { t } = useTranslation('common');
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!entry.argsJson || !!entry.resultJson || (entry.substeps?.length ?? 0) > 0;

  return (
    <div style={{ borderBottom: '1px solid var(--dashboard-border-light)' }}>
      <div
        onClick={() => hasDetail && setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 6px',
          paddingLeft: 6 + depth * 14,
          cursor: hasDetail ? 'pointer' : 'default',
          lineHeight: 1.4,
        }}
      >
        <span style={{ width: 12, flexShrink: 0, color: 'var(--dashboard-text-dim)' }}>
          {hasDetail ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
        </span>
        {entry.ok
          ? <Check size={12} style={{ flexShrink: 0, color: 'var(--success)' }} />
          : <AlertTriangle size={12} style={{ flexShrink: 0, color: '#f87171' }} />}
        <span style={{ color: 'var(--dashboard-text-dim)', flexShrink: 0 }}>{formatTime(entry.ts)}</span>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.summary || entry.tool}
        </span>
        <span style={{ color: 'var(--dashboard-text-dim)', flexShrink: 0 }}>{formatDuration(entry.durationMs)}</span>
      </div>
      {expanded && (
        <div style={{ padding: '2px 6px 6px', paddingLeft: 24 + depth * 14 }}>
          {entry.error && (
            <div style={{ color: '#f87171', marginBottom: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {entry.error}
            </div>
          )}
          {entry.argsJson && (
            <div style={{ marginBottom: 4 }}>
              <div className="ops-text-10" style={{ color: 'var(--dashboard-text-dim)' }}>{t('aiActivity.args')}</div>
              <pre className="ops-text-10" style={preStyle}>{entry.argsJson}</pre>
            </div>
          )}
          {entry.resultJson && (
            <div>
              <div className="ops-text-10" style={{ color: 'var(--dashboard-text-dim)' }}>{t('aiActivity.result')}</div>
              <pre className="ops-text-10" style={preStyle}>{entry.resultJson}</pre>
            </div>
          )}
          {entry.substeps?.map((sub, i) => <ActivityRow key={i} entry={sub} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

const preStyle: React.CSSProperties = {
  margin: 0,
  maxHeight: 180,
  overflow: 'auto',
  padding: '4px 6px',
  background: 'var(--dashboard-surface)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-code)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

export function AIActivityPanel() {
  const { t } = useTranslation('common');
  const setUI = useAppStore((s) => s.setUI);
  const entries = useSyncExternalStore(subscribe, getSnapshot);

  const iconBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    background: 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--dashboard-text-muted)',
    cursor: 'pointer',
    padding: 2,
    transition: 'background 0.12s ease, color 0.12s ease',
  };
  const onIconEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'var(--dashboard-surface-hover)';
    e.currentTarget.style.color = 'var(--dashboard-text)';
  };
  const onIconLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'transparent';
    e.currentTarget.style.color = 'var(--dashboard-text-muted)';
  };

  return (
    <div
      className="flex-shrink-0 flex flex-col border-t border-border ops-text-11"
      style={{
        height: 220,
        background: 'var(--dashboard-bg)',
        color: 'var(--dashboard-text)',
        fontFamily: 'var(--font-code)',
      }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-1 px-2 h-6 border-b"
        style={{ borderColor: 'var(--dashboard-border-light)', background: 'var(--dashboard-surface)' }}
      >
        <span className="ops-text-10" style={{ textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--dashboard-text-dim)' }}>
          {t('aiActivity.title')}
        </span>
        <div className="flex-1" />
        <button
          onClick={() => activityLog.clear()}
          title={t('aiActivity.clear')}
          style={iconBtnStyle}
          onMouseEnter={onIconEnter}
          onMouseLeave={onIconLeave}
        >
          <Trash2 size={12} />
        </button>
        <button
          onClick={() => setUI({ aiActivityOpen: false })}
          title={t('close')}
          style={iconBtnStyle}
          onMouseEnter={onIconEnter}
          onMouseLeave={onIconLeave}
        >
          <X size={12} />
        </button>
      </div>

      {/* Feed — nieuwste boven */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {entries.length === 0 ? (
          <div style={{ padding: '10px 8px', color: 'var(--dashboard-text-dim)', fontStyle: 'italic' }}>
            {t('aiActivity.empty')}
          </div>
        ) : (
          [...entries].reverse().map((e, i) => <ActivityRow key={`${e.ts}-${i}`} entry={e} />)
        )}
      </div>
    </div>
  );
}
