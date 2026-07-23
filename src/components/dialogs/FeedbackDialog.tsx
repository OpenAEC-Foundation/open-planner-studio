/**
 * FeedbackDialog — feedback-knop → GitHub issue.
 *
 * Patroon: vergelijkbaar met UpdateDialog.tsx / SettingsDialog.tsx.
 * - Overlay + paneel, sluiten via setUI, Escape-handler, klik-backdrop-sluit.
 * - Alle tekst via t('feedback.xxx') (common-namespace).
 * - @tauri-apps/* UITSLUITEND dynamisch geïmporteerd binnen isTauri()-branches.
 * - Screenshot via modern-screenshot domToPng; dialoog uitgefilterd.
 * - Annotatie: gedelegeerd aan <ScreenshotAnnotator/> (thumbnail + grote editor).
 * - Twee verstuur-paden: PAD A (geen screenshot) / PAD B (met screenshot + klembord).
 */

import { useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { sendFeedback, openFeedbackUrl, type FeedbackType, type SendResult } from '@/services/feedback/feedbackService';
import { useDialogKeys } from '@/hooks/useDialogKeys';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { ScreenshotAnnotator } from './ScreenshotAnnotator';
import './FeedbackDialog.css';

// ─── Component ────────────────────────────────────────────────────────────────

export function FeedbackDialog() {
  const { t } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);

  // Form-state
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachScreenshot, setAttachScreenshot] = useState(false);

  // Screenshot-state
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  // Door ScreenshotAnnotator geleverde geflattende PNG (screenshot + annotaties).
  // Null zolang er nog niet geannoteerd is → val terug op de rauwe screenshot.
  const [annotatedDataUrl, setAnnotatedDataUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Verstuur-state
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const close = useCallback(() => setUI({ showFeedbackDialog: false }), [setUI]);

  // Focus-trap (a11y): eigen overlay (geen shared Dialog), role/aria-modal staan al op het paneel.
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  // Escape sluit de dialoog (niet tijdens versturen: dan is de handler `undefined` en doet de
  // hook niets). De overlay zelf blijft custom CSS-chrome — geen `Dialog`-migratie hier.
  useDialogKeys({ onCancel: sending ? undefined : close });

  // ── Screenshot maken ───────────────────────────────────────────────────────
  const captureScreenshot = useCallback(async () => {
    setCapturing(true);
    setCaptureError(null);
    try {
      const { domToPng } = await import('modern-screenshot');
      const dataUrl = await domToPng(document.getElementById('root') ?? document.body, {
        // Filter de dialoog zelf weg zodat de achterliggende app-scherm verschijnt.
        filter: (node) =>
          !(node instanceof HTMLElement && node.closest?.('.feedback-dialog-overlay') !== null),
      });
      setScreenshotDataUrl(dataUrl);
      setAnnotatedDataUrl(null);
    } catch (err) {
      console.warn('Screenshot mislukt:', err);
      setCaptureError(t('feedback.captureFailed'));
      setAttachScreenshot(false);
      setScreenshotDataUrl(null);
      setAnnotatedDataUrl(null);
    } finally {
      setCapturing(false);
    }
  }, [t]);

  const handleAttachToggle = useCallback((checked: boolean) => {
    setAttachScreenshot(checked);
    if (checked && !screenshotDataUrl) {
      void captureScreenshot();
    }
    if (!checked) {
      setScreenshotDataUrl(null);
      setAnnotatedDataUrl(null);
      setCaptureError(null);
    }
  }, [screenshotDataUrl, captureScreenshot]);

  // ── Versturen ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSending(true);
    try {
      // De geflattende PNG uit de annotator (screenshot + annotaties); is er nog
      // niet geannoteerd, dan de rauwe screenshot.
      const flatDataUrl: string | null =
        attachScreenshot ? (annotatedDataUrl ?? screenshotDataUrl) : null;
      const res = await sendFeedback({
        type: feedbackType,
        title: title.trim(),
        description: description.trim(),
        screenshotDataUrl: flatDataUrl,
      });
      // PAD B (mét screenshot): toon de plak-instructie; GitHub opent PAS nadat
      // de gebruiker daar op "OK" klikt (zo staat de screenshot al op het
      // klembord vóór de issue-pagina opent).
      // PAD A (zónder screenshot): geen plakstap → open GitHub meteen en sluit.
      if (flatDataUrl) {
        setResult(res);
      } else {
        await openFeedbackUrl(res.githubUrl);
        close();
      }
    } catch (err) {
      console.error('Feedback versturen mislukt:', err);
    } finally {
      setSending(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="feedback-dialog-overlay"
      onClick={() => { if (!sending) close(); }}
    >
      <div
        ref={dialogRef}
        className="feedback-dialog"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('feedback.title')}
      >
        {/* Header */}
        <div className="feedback-dialog-header">
          <span className="feedback-dialog-title">{t('feedback.title')}</span>
          <button
            className="modal-close-btn"
            onClick={close}
            disabled={sending}
            title={t('feedback.cancel')}
            aria-label={t('feedback.cancel')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="feedback-dialog-body">
          {result ? (
            /* ── Bevestigingsstap (PAD B na versturen) ── */
            <div className="feedback-confirm">
              <p className="feedback-confirm-title">{t('feedback.instructionTitle')}</p>
              <ol className="feedback-confirm-steps">
                <li>{t('feedback.instructionStep1')}</li>
                <li>{t('feedback.instructionStep2')}</li>
                <li>{t('feedback.instructionStep3')}</li>
                <li>{t('feedback.instructionStep4')}</li>
              </ol>
              {result.savedPath && (
                <p className="feedback-confirm-fallback">
                  {t('feedback.instructionFallback', { path: result.savedPath })}
                </p>
              )}
            </div>
          ) : (
            /* ── Formulier ── */
            <>
              {/* Type-schakelaar */}
              <div className="feedback-type-row">
                <button
                  className={`feedback-type-btn${feedbackType === 'bug' ? ' active' : ''}`}
                  onClick={() => setFeedbackType('bug')}
                >
                  {t('feedback.typeBug')}
                </button>
                <button
                  className={`feedback-type-btn${feedbackType === 'feature' ? ' active' : ''}`}
                  onClick={() => setFeedbackType('feature')}
                >
                  {t('feedback.typeFeature')}
                </button>
              </div>

              {/* Titel */}
              <div className="feedback-field">
                <label className="feedback-label">{t('feedback.fieldTitle')}</label>
                <input
                  className="feedback-input"
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t('feedback.fieldTitle')}
                  autoFocus
                />
              </div>

              {/* Omschrijving */}
              <div className="feedback-field">
                <label className="feedback-label">{t('feedback.fieldDescription')}</label>
                <textarea
                  className="feedback-textarea"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={t('feedback.fieldDescription')}
                  rows={4}
                />
              </div>

              {/* Screenshot-schakelaar */}
              <div className="feedback-screenshot-toggle">
                <label className="feedback-toggle-label">
                  <input
                    type="checkbox"
                    checked={attachScreenshot}
                    onChange={e => handleAttachToggle(e.target.checked)}
                  />
                  <span>{t('feedback.attachScreenshot')}</span>
                </label>
              </div>

              {/* Capture-melding */}
              {capturing && (
                <p className="feedback-capturing">{t('feedback.capturing')}</p>
              )}
              {captureError && (
                <p className="feedback-error">{captureError}</p>
              )}

              {/* Screenshot-thumbnail + annotatie-editor */}
              {attachScreenshot && screenshotDataUrl && !capturing && (
                <ScreenshotAnnotator
                  screenshotDataUrl={screenshotDataUrl}
                  onChange={setAnnotatedDataUrl}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="feedback-dialog-footer">
          {result ? (
            <button
              className="btn btn--sm btn--primary"
              onClick={() => { void openFeedbackUrl(result.githubUrl); close(); }}
            >
              {t('feedback.openGithub')}
            </button>
          ) : (
            <>
              <button
                className="btn btn--sm btn--secondary"
                onClick={close}
                disabled={sending}
              >
                {t('feedback.cancel')}
              </button>
              <button
                className="btn btn--sm btn--primary"
                onClick={() => void handleSubmit()}
                disabled={sending || !title.trim()}
              >
                {t('feedback.submit')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
