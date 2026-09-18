import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, Lock, Unlock, DatabaseBackup, Save, FolderOpen, Check, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { loadAiAutoBackup, saveAiAutoBackup } from '@/utils/settingsStore';
import { makeManualBackup, openBackupFolder } from '@/services/mcp/backup';
import { record as recordActivity } from '@/services/mcp/activityLog';
import { RibbonButton } from '@/components/layout/Ribbon/ribbonPrimitives';

/**
 * AI-ribbontab — groep **Veiligheid** (T16, spec §UI "Veiligheid & activiteit"):
 *  - **pauze**: toggelt `ui.aiPaused` (bridge blijft live; muterende tools krijgen tijdelijk een
 *    nette "gepauzeerd"-fout, lezen mag door) — status op de knop, hint als tooltip;
 *  - **alleen-lezen**: toggelt `ui.aiReadOnly` (mutaties geweigerd zolang actief);
 *  - **auto-backup**: persistente toggle (`saveAiAutoBackup`, default aan) — vóór de eerste mutatie
 *    per document schrijft de tool-laag dan een IFC-snapshot;
 *  - **"Nu backup maken"**: `makeManualBackup()` met succes/fout-feedback + een activiteit-regel;
 *  - **"Backup-map openen"**: `openBackupFolder()` via de shell-open-plugin.
 *
 * De twee fs-knoppen (handmatige backup / map openen) zijn Tauri-only; in de web-build zijn ze
 * uitgeschakeld met een "alleen desktop"-tooltip (net als de Server-groep). Pauze/alleen-lezen en de
 * backup-toggle zijn platform-agnostisch (ui-vlaggen + persistente setting).
 */

const isTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

type Feedback = { kind: 'ok' | 'err'; text: string } | null;

export function AiSafetyGroup() {
  const { t } = useTranslation('common');
  const paused = useAppStore((s) => s.ui.aiPaused);
  const readOnly = useAppStore((s) => s.ui.aiReadOnly);
  const setAiPaused = useAppStore((s) => s.setAiPaused);
  const setAiReadOnly = useAppStore((s) => s.setAiReadOnly);

  const [autoBackup, setAutoBackup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const tauri = isTauri();

  // De backup-toggle leeft in localStorage (settingsStore), niet in de store — init op mount.
  useEffect(() => { void loadAiAutoBackup().then(setAutoBackup); }, []);

  const onToggleAutoBackup = () => {
    const next = !autoBackup;
    setAutoBackup(next);
    void saveAiAutoBackup(next);
  };

  const flash = (fb: Feedback) => {
    setFeedback(fb);
    if (fb) setTimeout(() => setFeedback((cur) => (cur === fb ? null : cur)), 4000);
  };

  const onManualBackup = async () => {
    if (!tauri || busy) return;
    setBusy(true);
    const started = Date.now();
    try {
      const path = await makeManualBackup();
      const fileName = path.split(/[\\/]/).pop() ?? path;
      flash({ kind: 'ok', text: t('aiSafety.backupOk', { name: fileName }) });
      recordActivity({
        ts: started, tool: 'manual_backup', summary: fileName,
        durationMs: Date.now() - started, ok: true,
        argsJson: '{}', resultJson: JSON.stringify({ path }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      flash({ kind: 'err', text: t('aiSafety.backupErr', { error: msg }) });
      recordActivity({
        ts: started, tool: 'manual_backup', summary: t('aiSafety.backupNow'),
        durationMs: Date.now() - started, ok: false, error: msg,
        argsJson: '{}', resultJson: JSON.stringify({ error: msg }),
      });
    } finally {
      setBusy(false);
    }
  };

  const onOpenFolder = () => {
    if (!tauri) return;
    void openBackupFolder().catch((err) => {
      flash({ kind: 'err', text: t('aiSafety.openErr', { error: err instanceof Error ? err.message : String(err) }) });
    });
  };

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      {/* Pauze + alleen-lezen (ui-vlaggen; werken overal). */}
      <div style={{ display: 'flex', gap: 6 }}>
        <span title={t('aiSafety.pauseHint')}>
          <RibbonButton
            icon={paused ? <Play size={20} /> : <Pause size={20} />}
            label={paused ? t('aiSafety.resume') : t('aiSafety.pause')}
            active={paused}
            danger={paused}
            onClick={() => setAiPaused(!paused)}
          />
        </span>
        <span title={t('aiSafety.readOnlyHint')}>
          <RibbonButton
            icon={readOnly ? <Lock size={20} /> : <Unlock size={20} />}
            label={t('aiSafety.readOnly')}
            active={readOnly}
            onClick={() => setAiReadOnly(!readOnly)}
          />
        </span>
      </div>

      {/* Backup: toggle + handmatig + map openen. */}
      <div style={{ display: 'flex', gap: 6 }}>
        <span title={t('aiSafety.autoBackupHint')}>
          <RibbonButton
            icon={<DatabaseBackup size={20} />}
            label={autoBackup ? t('aiSafety.autoBackupOn') : t('aiSafety.autoBackupOff')}
            active={autoBackup}
            onClick={onToggleAutoBackup}
          />
        </span>
        <span title={!tauri ? t('ai.desktopOnly') : undefined}>
          <RibbonButton
            icon={<Save size={20} />}
            label={t('aiSafety.backupNow')}
            disabled={!tauri || busy}
            onClick={() => void onManualBackup()}
          />
        </span>
        <span title={!tauri ? t('ai.desktopOnly') : undefined}>
          <RibbonButton
            icon={<FolderOpen size={20} />}
            label={t('aiSafety.openFolder')}
            disabled={!tauri}
            onClick={onOpenFolder}
          />
        </span>
      </div>

      {/* Feedback-regel (handmatige backup succes/fout). */}
      {feedback && (
        <div
          className="ops-text-11"
          style={{
            display: 'flex', alignItems: 'center', gap: 4, maxWidth: 200,
            color: feedback.kind === 'ok' ? 'var(--success)' : 'var(--theme-critical-text)',
          }}
        >
          {feedback.kind === 'ok' ? <Check size={13} /> : <AlertTriangle size={13} />}
          <span>{feedback.text}</span>
        </div>
      )}
    </div>
  );
}
