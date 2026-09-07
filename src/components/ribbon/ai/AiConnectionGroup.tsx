import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, RefreshCw, Eye, EyeOff, Plug } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { loadMcpPort, saveMcpPort } from '@/utils/settingsStore';
import { ensureMcpToken, regenerateMcpToken } from '@/services/mcp/server';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { AiConnectionDetailsDialog } from '@/components/dialogs/AiConnectionDetailsDialog';
import { RibbonButton } from '@/components/layout/Ribbon/ribbonPrimitives';
import { Popover } from '@/components/common/Popover';
import { useRibbonDensity } from '@/components/layout/Ribbon/ribbonDensity';

/**
 * AI-ribbontab — groep **Verbinding** (T14, spec §UI):
 *  - poortveld (`loadMcpPort`/`saveMcpPort`), alleen wijzigbaar wanneer de server gestopt is;
 *  - tokenveld (verborgen; toon/verberg, kopieerknop, regenereerknop mét bevestigingswaarschuwing
 *    dat bestaande koppelingen breken);
 *  - een normale (grote) ribbonknop "Verbinden" die de {@link AiConnectionDetailsDialog} opent
 *    (endpoint, auth-header, configuratiefragment, koppelprompt) — het label volgt de intentie
 *    ("ik wil verbinden") in plaats van de inhoud van de dialoog; die toelichting staat in de
 *    tooltip (`ai.connectHint`).
 *
 * De koppelgegevens staan bewust in een dialoog en niet in de ribbon zelf: een ribbongroep is maar
 * 66 px hoog (`.ribbon-group-content`), dus een volledige URL/header-regel werd afgekapt. De groep
 * blijft daarom op twéé veldrijen naast één grote knop — dat past ruim binnen de ribbonhoogte.
 *
 * Poort/token leven in localStorage (settingsStore), niet in de store — vandaar lokale React-state
 * die op mount uit de persistente laag wordt geïnitialiseerd. `ensureMcpToken` garandeert dat er een
 * token bestaat zodra de gebruiker dit tabblad opent.
 *
 * Compacte dichtheid (issue #38 punt 4): de twee veldrijen + grote knop zijn samen ~58-66 px hoog,
 * ruim boven de 40px-strip van de compacte lint-modus (`.ribbon-container.compact .ribbon-content`).
 * Daarom klapt de hele groep — net als "Baselines & voortgang" op de Planning-tab — samen tot één
 * kleine knop met popover die poort, token en de "Verbinden"-actie ongewijzigd bevat.
 */

const fieldStyle: React.CSSProperties = {
  padding: '3px 6px',
  background: 'var(--theme-input-bg)',
  border: '1px solid var(--theme-control-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--theme-text)',
  fontSize: 11,
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
  const compact = useRibbonDensity() !== 'full';
  const serverState = useAppStore(s => s.ui.aiServerStatus.state);
  const setAiServerStatus = useAppStore(s => s.setAiServerStatus);

  const [port, setPort] = useState<number>(() => loadMcpPort());
  const [token, setToken] = useState<string>(() => ensureMcpToken());
  const [showToken, setShowToken] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Poort mag alleen wijzigen zolang de bridge niet draait (de draaiende server bindt de poort).
  const portLocked = serverState !== 'off';

  const copy = async (text: string, key: string) => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(key);
    setTimeout(() => setCopied(c => (c === key ? null : c)), 1500);
  };

  const onPortChange = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    setPort(n);
    saveMcpPort(n);
    // Houd het off-statusobject (en dus de "uit"-weergave) in sync met de gekozen poort.
    setAiServerStatus({ state: 'off', port: n });
  };

  const onRegenerate = () => {
    const fresh = regenerateMcpToken();
    setToken(fresh);
    setShowToken(true);
    setConfirming(false);
  };

  // Poort- en tokenveld zijn geëxtraheerd omdat ze ONgewijzigd in zowel de volle als de
  // compacte (popover-)vorm hergebruikt worden — alleen de verpakking eromheen verschilt.
  const portControl = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ minWidth: 44 }}>{t('ai.port')}</span>
      <input
        type="number"
        value={port}
        disabled={portLocked}
        title={portLocked ? t('ai.portLockedHint') : undefined}
        onChange={e => onPortChange(e.target.value)}
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
        style={{ ...fieldStyle, flex: 1, minWidth: 120, fontFamily: 'monospace' }}
      />
      <button
        type="button"
        style={iconBtnStyle}
        title={showToken ? t('ai.hideToken') : t('ai.showToken')}
        aria-label={showToken ? t('ai.hideToken') : t('ai.showToken')}
        onClick={() => setShowToken(v => !v)}
      >
        {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <button
        type="button"
        style={iconBtnStyle}
        title={t('ai.copy')}
        aria-label={t('ai.copy')}
        onClick={() => { void copy(token, 'token'); }}
      >
        {copied === 'token' ? <Check size={13} /> : <Copy size={13} />}
      </button>
      <button
        type="button"
        style={iconBtnStyle}
        title={t('ai.regenerate')}
        aria-label={t('ai.regenerate')}
        onClick={() => setConfirming(true)}
      >
        <RefreshCw size={13} />
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

  if (compact) {
    // Compacte modus (issue #38 punt 4): hele groep achter één knop + popover — zelfde patroon als
    // BaselinesProgressGroupContent. Poort/token blijven functioneel identiek, alleen de trigger
    // vervangt de brede tweeledige lay-out.
    return (
      <>
        <Popover
          open={popoverOpen}
          onClose={() => setPopoverOpen(false)}
          align="right"
          panelStyle={{
            marginTop: 2, zIndex: 9999,
            padding: 8, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260, fontSize: 11,
          }}
          trigger={
            <button
              className="ribbon-btn small"
              onClick={() => setPopoverOpen(o => !o)}
              title={t('ai.connectHint')}
              aria-label={t('ai.connect')}
              style={{ minWidth: 0, padding: '2px 5px', gap: 0 }}
            >
              <span className="ribbon-btn-icon" style={{ width: 16, height: 16 }}><Plug size={14} /></span>
            </button>
          }
        >
          {portControl}
          {tokenControl}
          <div style={{ height: 1, background: 'var(--theme-border-light)', margin: '4px 0' }} />
          <button
            className="ribbon-btn small"
            style={{ width: '100%' }}
            onClick={() => { setShowDetails(true); setPopoverOpen(false); }}
          >
            <span className="ribbon-btn-icon"><Plug size={14} /></span>
            <span className="ribbon-btn-label">{t('ai.connect')}</span>
          </button>
        </Popover>
        {dialogs}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 240 }}>
        {portControl}
        {tokenControl}
      </div>

      {/* Endpoint/header/configuratiefragment/koppelprompt staan in een dialoog — zie de
          toelichting boven. Label volgt de intentie ("Verbinden"); de tooltip legt de inhoud uit. */}
      <span title={t('ai.connectHint')}>
        <RibbonButton
          icon={<Plug size={20} />}
          label={t('ai.connect')}
          onClick={() => setShowDetails(true)}
        />
      </span>

      {dialogs}
    </div>
  );
}
