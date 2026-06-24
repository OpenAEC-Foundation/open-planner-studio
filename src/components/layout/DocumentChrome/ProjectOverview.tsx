import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { useDocumentCards, useDocumentActions, type DocumentCard } from './useDocumentCards';
import './DocumentChrome.css';

/**
 * Gedeeld projectoverzicht (overlay) — alle drie de chrome-stijlen openen dit.
 * Raster van projectkaarten met mini-Gantt; klik wisselt en sluit, × sluit het
 * document, "Project openen" start de open-bestand-flow. Esc/backdrop sluit.
 */
export function ProjectOverview() {
  const { t } = useTranslation('common');
  const open = useAppStore((s) => s.ui.showProjectOverview);
  const cards = useDocumentCards();
  const { switchTo, closeWithGuard, openProject, closeOverview } = useDocumentActions();

  if (!open) return null;

  const onCard = (card: DocumentCard) => {
    if (!card.isActive) switchTo(card.id);
    closeOverview();
  };

  return (
    <div
      onClick={closeOverview}
      data-ops-overview
      style={{
        position: 'absolute', inset: 0, zIndex: 70,
        background: 'rgba(15,16,20,0.72)', backdropFilter: 'blur(3px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 84, animation: 'ops-fade 0.12s ease-out',
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 760, maxWidth: '92%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, color: '#fff' }}>
              {t('documents.overviewTitle')}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
              {t('documents.openBadge', { count: cards.length })} · {t('documents.switchHint')}
            </span>
          </div>
          <button
            onClick={() => { openProject(); closeOverview(); }}
            title={t('documents.openProject')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--theme-accent)', color: 'var(--theme-accent-on)',
              border: 'none', borderRadius: 'var(--radius-md)', padding: '7px 13px',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={14} />{t('documents.openProject')}
          </button>
        </div>

        {/* Kaartraster */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {cards.map((card) => (
            <div
              key={card.id}
              onClick={() => onCard(card)}
              data-ops-overview-card={card.id}
              style={{
                position: 'relative', background: 'var(--theme-surface)',
                border: `1px solid ${card.isActive ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
                borderRadius: 'var(--radius-lg)', padding: 14, cursor: 'pointer',
                boxShadow: 'var(--shadow-card)', overflow: 'hidden',
              }}
            >
              <span style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: card.color }} />

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, paddingLeft: 6 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--theme-text)' }}>
                      {card.title}
                    </span>
                    {card.isActive && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: 'var(--theme-accent-on)', background: 'var(--theme-accent)',
                        borderRadius: 9999, padding: '2px 7px',
                      }}>{t('documents.active')}</span>
                    )}
                    {card.isDirty && (
                      <span style={{ width: 7, height: 7, borderRadius: 9999, background: 'var(--theme-warning-text)' }} />
                    )}
                  </div>
                  {card.fileName && (
                    <div style={{ fontSize: 10, color: 'var(--theme-text-muted)', marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>
                      {card.fileName}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); closeWithGuard(card); }}
                  title={t('close')}
                  className="ops-card-close"
                  style={{
                    width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--theme-surface-alt)', border: '1px solid var(--theme-border)',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--theme-text-muted)',
                  }}
                >
                  <X size={12} />
                </button>
              </div>

              {/* Mini-Gantt-thumbnail */}
              <div style={{
                position: 'relative', height: 104, background: 'var(--theme-bg)',
                border: '1px solid var(--theme-border-light)', borderRadius: 'var(--radius-md)',
                overflow: 'hidden', marginLeft: 6,
              }}>
                {card.thumb.map((b, i) => (
                  <div key={i} style={{
                    position: 'absolute', height: 6, borderRadius: 2,
                    top: `${b.topPct}%`, left: `${b.leftPct}%`, width: `${b.widthPct}%`, background: b.color,
                  }} />
                ))}
              </div>

              <div style={{ display: 'flex', gap: 14, marginTop: 11, paddingLeft: 6, fontSize: 11, color: 'var(--theme-text-dim)' }}>
                <span><b style={{ color: 'var(--theme-text)', fontWeight: 600 }}>{card.taskCount}</b> {t('documents.tasksWord')}</span>
                <span><b style={{ color: 'var(--theme-critical-text)', fontWeight: 600 }}>{card.criticalCount}</b> {t('documents.criticalWord')}</span>
                {card.endDate && <span style={{ marginLeft: 'auto', color: 'var(--theme-text-muted)' }}>{card.endDate}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
