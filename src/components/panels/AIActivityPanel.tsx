import { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, X, Check, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';
import * as activityLog from '@/services/mcp/activityLog';
import type { ActivityEntry } from '@/services/mcp/contracts';
import { useAppStore } from '@/state/appStore';
import { createSnapshotStore, DashboardIconButton, DashboardPanel, formatClockTime } from './DashboardPanel';

// AI-activiteitenpaneel (T15, spec §UI). Rechterpaneel in dezelfde rail als de DebugTerminal, maar
// gevoed door de eigen `activityLog`-ring-buffer i.p.v. de log-bus. Nieuwste aanroep boven; klik op
// een regel klapt de volledige args/respons uit (monospace, scrollbaar). "Wissen" leegt de buffer.

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

const activityStore = createSnapshotStore<ActivityEntry[]>(activityLog.getEntries(), activityLog.subscribe);

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
        <span style={{ color: 'var(--dashboard-text-dim)', flexShrink: 0 }}>{formatClockTime(entry.ts)}</span>
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
              <div className="!text-small" style={{ color: 'var(--dashboard-text-dim)' }}>{t('aiActivity.args')}</div>
              <pre className="!text-small" style={preStyle}>{entry.argsJson}</pre>
            </div>
          )}
          {entry.resultJson && (
            <div>
              <div className="!text-small" style={{ color: 'var(--dashboard-text-dim)' }}>{t('aiActivity.result')}</div>
              <pre className="!text-small" style={preStyle}>{entry.resultJson}</pre>
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
  const entries = useSyncExternalStore(activityStore.subscribe, activityStore.getSnapshot);

  return (
    <DashboardPanel
      height={220}
      toolbar={<>
        <span className="!text-small" style={{ textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--dashboard-text-dim)' }}>
          {t('aiActivity.title')}
        </span>
        <div className="flex-1" />
        <DashboardIconButton onClick={() => activityLog.clear()} title={t('aiActivity.clear')}>
          <Trash2 size={12} />
        </DashboardIconButton>
        <DashboardIconButton onClick={() => setUI({ aiActivityOpen: false })} title={t('close')}>
          <X size={12} />
        </DashboardIconButton>
      </>}
    >
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
    </DashboardPanel>
  );
}
