import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import { loadMcpPort, saveMcpPort } from '@/utils/settingsStore';
import { ensureMcpToken, regenerateAndApplyMcpToken } from '@/services/mcp/server';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { AiConnectionDetailsDialog } from '@/components/dialogs/AiConnectionDetailsDialog';
import { RibbonButton, RibbonCollapsedTrigger, RibbonCollapsible, RibbonCompactTrigger, RibbonPopoverContent } from '@/components/layout/Ribbon/ribbonPrimitives';
import { Popover } from '@/components/common/Popover';
import { useRibbonDensity } from '@/components/layout/Ribbon/ribbonDensity';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { isTauri } from '@/utils/platform';

const fieldStyle: React.CSSProperties = {
  padding: '3px 6px',
  background: 'var(--theme-input-bg)',
  border: '1px solid var(--theme-control-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--theme-text)',
};

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 3,
  background: 'transparent',
  border: '1px solid var(--theme-control-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--theme-text)',
  cursor: 'pointer',
};

export function AiConnectionGroup() {
  const { t } = useTranslation('common');
  const { t: tMenu } = useTranslation('menu');
  const compact = useRibbonDensity() !== 'full';
  const serverState = useAppStore(s => s.ui.aiServerStatus.state);
  const setAiServerStatus = useAppStore(s => s.setAiServerStatus);

  const [port, setPort] = useState<number>(() => loadMcpPort());
  const [token, setToken] = useState<string>(() => ensureMcpToken());
  const [showToken, setShowToken] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { copiedKey: copied, copy } = useCopyFeedback(1500);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const portLocked = serverState === 'live';

  useEffect(() => {
    if (!import.meta.env.DEV || isTauri()) return;
    void import('@/utils/devOpenLink').then(({ takeDevConnectionDetails }) => {
      if (takeDevConnectionDetails()) setShowDetails(true);
    });
  }, []);

  const onPortChange = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    setPort(n);
    saveMcpPort(n);
    setAiServerStatus({ state: 'off', port: n });
  };

  const onRegenerate = () => {
    setConfirming(false);
    void regenerateAndApplyMcpToken(() => useAppStore.getState().ui.aiServerStatus.state === 'live').then((fresh) => {
      setToken(fresh);
      setShowToken(true);
    });
  };

  const portControl = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ minWidth: 44 }}>{t('ai.port')}</span>
      <input
        type="number"
        value={port}
        disabled={portLocked}
        title={portLocked ? t('ai.portLockedHint') : undefined}
        onChange={e => onPortChange(e.target.value)}
        className="!text-body"
        style={{ ...fieldStyle, width: 80, opacity: portLocked ? 0.6 : 1 }}
      />
    </label>
  );

  const tokenControl = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ minWidth: 44 }}>{t('ai.token')}</span>
      <input
        type={showToken ? 'text' : 'password'}
        value={token}
        readOnly
        className="!text-body"
        style={{ ...fieldStyle, flex: 1, minWidth: 120, fontFamily: 'monospace' }}
      />
      <button
        type="button"
        style={iconBtnStyle}
        title={showToken ? t('ai.hideToken') : t('ai.showToken')}
        aria-label={showToken ? t('ai.hideToken') : t('ai.showToken')}
        onClick={() => setShowToken(v => !v)}
      >
        {showToken ? <Icon id="credential.hide" size={13} /> : <Icon id="credential.show" size={13} />}
      </button>
      <button
        type="button"
        style={iconBtnStyle}
        title={t('ai.copy')}
        aria-label={t('ai.copy')}
        onClick={() => { void copy(token, 'token'); }}
      >
        {copied === 'token' ? <Icon id="status.success" size={13} /> : <Icon id="edit.copy" size={13} />}
      </button>
      <button
        type="button"
        style={iconBtnStyle}
        title={t('ai.regenerate')}
        aria-label={t('ai.regenerate')}
        onClick={() => setConfirming(true)}
      >
        <Icon id="credential.regenerate" size={13} />
      </button>
    </label>
  );

  const dialogs = (
    <>
      {showDetails && (
        <AiConnectionDetailsDialog port={port} token={token} onClose={() => setShowDetails(false)} />
      )}

      {confirming && (
        <ConfirmDialog
          message={t('ai.regenerateConfirm')}
          confirmLabel={t('ai.regenerate')}
          danger
          onConfirm={onRegenerate}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );

  const popover = (
    <Popover
      open={popoverOpen}
      onClose={() => setPopoverOpen(false)}
      align="right"
      panelRole="dialog"
      panelAriaLabel={tMenu('ribbon.aiConnection')}
      panelClassName="!text-body"
      panelStyle={{
        marginTop: 2, zIndex: 9999,
        padding: 8, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260,
      }}
      trigger={compact ? (
        <RibbonCompactTrigger
          icon={<Icon id="ai.connection-menu" size={16} />}
          title={t('ai.connectHint')}
          ariaLabel={t('ai.connect')}
          onClick={() => setPopoverOpen(o => !o)}
        />
      ) : (
        <RibbonCollapsedTrigger
          icon={<Icon id="ai.connection-menu" size={24} />}
          label={tMenu('ribbon.aiConnection')}
          title={tMenu('ribbon.aiConnection')}
          open={popoverOpen}
          onClick={viaKeyboard => { setKeyboardOpen(viaKeyboard); setPopoverOpen(o => !o); }}
        />
      )}
    >
      <RibbonPopoverContent trap={!compact && keyboardOpen}>
        {portControl}
        {tokenControl}
        <div style={{ height: 1, background: 'var(--theme-border-light)', margin: '4px 0' }} />
        <button
          className="ribbon-btn small"
          style={{ width: '100%' }}
          onClick={() => { setShowDetails(true); setPopoverOpen(false); }}
        >
          <span className="ribbon-btn-icon"><Icon id="ai.connection-details" size={16} /></span>
          <span className="ribbon-btn-label">{t('ai.connect')}</span>
        </button>
      </RibbonPopoverContent>
    </Popover>
  );

  if (compact) {
    return (
      <>
        {popover}
        {dialogs}
      </>
    );
  }

  return (
    <>
      <RibbonCollapsible
        popoverOpen={popoverOpen}
        onHidden={() => setPopoverOpen(false)}
        full={
          <div className="!text-body" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 240 }}>
              {portControl}
              {tokenControl}
            </div>

            <span title={t('ai.connectHint')}>
              <RibbonButton
                icon={<Icon id="ai.connection-details" size={24} />}
                label={t('ai.connect')}
                onClick={() => setShowDetails(true)}
              />
            </span>
          </div>
        }
        collapsed={popover}
      />
      {dialogs}
    </>
  );
}
