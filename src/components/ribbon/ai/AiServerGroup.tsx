import { useTranslation } from 'react-i18next';
import { Icon, type IconId } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { startMcpServer, stopMcpServer } from '@/services/mcp/server';
import { RibbonButton } from '@/components/layout/Ribbon/ribbonPrimitives';
import { useRibbonDensity } from '@/components/layout/Ribbon/ribbonDensity';
import type { McpServerStatus } from '@/services/mcp/contracts';

export const AI_STATUS_ICON: Record<McpServerStatus['state'], IconId> = {
  off: 'status.bridge-off',
  live: 'status.bridge-live',
  'port-busy': 'status.warning',
  error: 'status.error',
};

export const AI_STATUS_COLOR: Record<McpServerStatus['state'], string> = {
  off: 'var(--theme-text-muted)',
  live: 'var(--success)',
  'port-busy': 'var(--theme-warning-text)',
  error: 'var(--theme-critical-text)',
};

export function AiServerGroup() {
  const { t } = useTranslation('common');
  const compact = useRibbonDensity() !== 'full';
  const status = useAppStore(s => s.ui.aiServerStatus);
  const running = status.state === 'live';
  const tauri = isTauri();

  const statusText = (() => {
    switch (status.state) {
      case 'live': return t('ai.statusLive', { port: status.port });
      case 'port-busy': return t('ai.statusPortBusy', { port: status.port });
      case 'error': return t('ai.statusError');
      default: return t('ai.statusOff');
    }
  })();

  const statusHint = [
    statusText,
    !tauri ? t('ai.desktopOnly') : null,
    status.state === 'port-busy' && status.message ? status.message : null,
  ].filter(Boolean).join(' — ');

  const onToggle = () => {
    if (!tauri) return;
    if (running) void stopMcpServer();
    else void startMcpServer();
  };

  const toggleButton = (
    <RibbonButton
      icon={running ? <Icon id="ai.bridge-stop" size={24} /> : <Icon id="ai.bridge-start" size={24} />}
      label={running ? t('ai.stop') : t('ai.start')}
      primary={!running}
      active={running}
      disabled={!tauri}
      onClick={onToggle}
    />
  );

  if (compact) {
    return (
      <span title={statusHint}>{toggleButton}</span>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span title={!tauri ? t('ai.desktopOnly') : undefined}>{toggleButton}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 130 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon id={AI_STATUS_ICON[status.state]} size={10} style={{ color: AI_STATUS_COLOR[status.state] }} />
          <span className="ribbon-info">{statusText}</span>
        </div>
        {!tauri && (
          <span className="ribbon-info" style={{ opacity: 0.7 }}>{t('ai.desktopOnly')}</span>
        )}
        {status.state === 'port-busy' && status.message && (
          <span className="ribbon-info" style={{ color: 'var(--theme-warning-text)' }}>{status.message}</span>
        )}
      </div>
    </div>
  );
}
