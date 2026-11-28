import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import {
  submitFeedback,
  prepareGitHubFallback,
  openFeedbackUrl,
  feedbackUserText,
  isValidFeedbackEmail,
  getFeedbackMeta,
  FeedbackSubmitError,
  FEEDBACK_MESSAGE_MIN,
  type FeedbackErrorKind,
  type FeedbackMeta,
  type FeedbackType,
  type SendResult,
  type SubmitFeedbackResult,
} from '@/services/feedback/feedbackService';
import { saveFeedbackEmail } from '@/utils/settingsStore';
import { useDialogKeys } from '@/hooks/useDialogKeys';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import type { AnnotationShape, FeedbackDraft } from '@/services/feedback/feedbackDraft';
import { ScreenshotAnnotator } from './ScreenshotAnnotator';
import './FeedbackDialog.css';

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 4600;

const ERROR_KEYS = {
  validation: 'feedback.errorValidation',
  rateLimited: 'feedback.errorRateLimited',
  failed: 'feedback.errorFailed',
  uncertain: 'feedback.errorUncertain',
} as const satisfies Record<Exclude<FeedbackErrorKind, 'duplicate'>, string>;

const TYPE_KEYS = {
  bug: 'feedback.typeBug',
  feature: 'feedback.typeFeature',
  general: 'feedback.typeGeneral',
} as const satisfies Record<FeedbackType, string>;
const TYPES = Object.keys(TYPE_KEYS) as FeedbackType[];

function languageName(locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'language' }).of(locale);
    if (name) return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  } catch { }
  return locale;
}

export function FeedbackDialog() {
  const { t, i18n } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const setFeedbackDraft = useAppStore(s => s.setFeedbackDraft);
  const storedEmail = useAppStore(s => s.ui.feedbackEmail);
  const [initialDraft] = useState<FeedbackDraft | null>(() => useAppStore.getState().ui.feedbackDraft);

  const [feedbackType, setFeedbackType] = useState<FeedbackType>(initialDraft?.type ?? 'bug');
  const [title, setTitle] = useState(initialDraft?.title ?? '');
  const [description, setDescription] = useState(initialDraft?.description ?? '');
  const [email, setEmail] = useState(initialDraft?.email ?? storedEmail);
  const [attachScreenshot, setAttachScreenshot] = useState(
    !!initialDraft?.attachScreenshot && !!initialDraft.screenshotDataUrl);

  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(initialDraft?.screenshotDataUrl ?? null);
  const [annotatedDataUrl, setAnnotatedDataUrl] = useState<string | null>(initialDraft?.annotatedDataUrl ?? null);
  const [shapes, setShapes] = useState<AnnotationShape[]>(initialDraft?.shapes ?? []);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<keyof typeof ERROR_KEYS | null>(null);
  const [sent, setSent] = useState<SubmitFeedbackResult | null>(null);
  const [alreadyIn, setAlreadyIn] = useState(false);
  const [hadUncertain, setHadUncertain] = useState(initialDraft?.hadUncertain ?? false);
  const [fallback, setFallback] = useState<SendResult | null>(null);

  const close = useCallback(() => setUI({ showFeedbackDialog: false }), [setUI]);

  const draftIsEmpty = title.trim() === '' && description.trim() === ''
    && email.trim() === storedEmail.trim() && !attachScreenshot;
  const draft: FeedbackDraft | null = draftIsEmpty ? null : {
    type: feedbackType, title, description, email, attachScreenshot, hadUncertain,
    screenshotDataUrl: attachScreenshot ? screenshotDataUrl : null,
    annotatedDataUrl: attachScreenshot ? annotatedDataUrl : null,
    shapes: attachScreenshot ? shapes : [],
  };
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const discardDraftRef = useRef(false);
  useEffect(() => () => {
    setFeedbackDraft(discardDraftRef.current ? null : draftRef.current);
  }, [setFeedbackDraft]);

  const alreadyInRef = useRef(alreadyIn);
  alreadyInRef.current = alreadyIn;
  useEffect(() => {
    if (alreadyInRef.current) setAlreadyIn(false);
  }, [feedbackType, title, description, email, attachScreenshot, screenshotDataUrl, annotatedDataUrl, shapes]);

  const closeAlreadyIn = () => {
    discardDraftRef.current = true;
    setFeedbackDraft(null);
    close();
  };

  const keepsDraft = !sent && !alreadyIn && !draftIsEmpty;
  const closeLabel = keepsDraft ? t('feedback.saveAndClose') : t('feedback.close');
  const closeWindow = alreadyIn ? closeAlreadyIn : close;

  const [meta, setMeta] = useState<FeedbackMeta | null>(null);
  useEffect(() => {
    let alive = true;
    void getFeedbackMeta().then(m => { if (alive) setMeta(m); });
    return () => { alive = false; };
  }, [i18n.language]);

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  useDialogKeys({ onCancel: sending ? undefined : closeWindow });

  const trimmedEmail = email.trim();
  const emailOk = trimmedEmail === '' || isValidFeedbackEmail(trimmedEmail);
  const titleOk = title.trim().length > 0;
  const lengthOk = feedbackUserText(title, description).length >= FEEDBACK_MESSAGE_MIN;
  const formHint: string | null = !titleOk
    ? t('feedback.titleRequired')
    : !lengthOk
      ? t('feedback.tooShort')
      : !emailOk
        ? t('feedback.emailInvalid')
        : null;
  const [annotatorOpen, setAnnotatorOpen] = useState(false);
  const annotatorWasOpen = useRef(false);
  useEffect(() => {
    if (annotatorWasOpen.current && !annotatorOpen) {
      dialogRef.current?.querySelector<HTMLElement>('[data-annotate-button]')?.focus();
    }
    annotatorWasOpen.current = annotatorOpen;
  }, [annotatorOpen]);
  const canSubmit = !sending && !capturing && !annotatorOpen && formHint === null;

  const captureScreenshot = useCallback(async () => {
    setCapturing(true);
    setCaptureError(null);
    try {
      const { domToPng } = await import('modern-screenshot');
      const dataUrl = await domToPng(document.getElementById('root') ?? document.body, {
        filter: (node) =>
          !(node instanceof HTMLElement && node.closest?.('.feedback-dialog-overlay') !== null),
      });
      setScreenshotDataUrl(dataUrl);
      setAnnotatedDataUrl(null);
      setShapes([]);
    } catch (err) {
      console.warn('Screenshot mislukt:', err);
      setCaptureError(t('feedback.captureFailed'));
      setAttachScreenshot(false);
      setScreenshotDataUrl(null);
      setAnnotatedDataUrl(null);
      setShapes([]);
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
      setShapes([]);
      setCaptureError(null);
    }
  }, [screenshotDataUrl, captureScreenshot]);

  const handleAnnotated = useCallback((flat: string, next: AnnotationShape[]) => {
    setAnnotatedDataUrl(flat);
    setShapes(next);
  }, []);

  const clearDraft = useCallback(() => {
    setFeedbackType('bug');
    setTitle('');
    setDescription('');
    setEmail(storedEmail);
    setAttachScreenshot(false);
    setScreenshotDataUrl(null);
    setAnnotatedDataUrl(null);
    setShapes([]);
    setCaptureError(null);
    setSubmitError(null);
    setHadUncertain(false);
    setAlreadyIn(false);
    setFeedbackDraft(null);
  }, [storedEmail, setFeedbackDraft]);

  const flatScreenshot = (): string | null =>
    attachScreenshot ? (annotatedDataUrl ?? screenshotDataUrl) : null;

  const settle = () => {
    setHadUncertain(false);
    if (trimmedEmail !== storedEmail) {
      setUI({ feedbackEmail: trimmedEmail });
      void saveFeedbackEmail(trimmedEmail);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSending(true);
    setSubmitError(null);
    setAlreadyIn(false);
    try {
      const res = await submitFeedback({
        type: feedbackType,
        title: title.trim(),
        description: description.trim(),
        screenshotDataUrl: flatScreenshot(),
        email: trimmedEmail,
      });
      settle();
      discardDraftRef.current = true;
      setFeedbackDraft(null);
      setSent(res);
    } catch (err) {
      console.warn('Feedback versturen mislukt:', err);
      const kind: FeedbackErrorKind = err instanceof FeedbackSubmitError ? err.kind : 'failed';
      if (kind === 'duplicate') {
        settle();
        setAlreadyIn(true);
        return;
      }
      const uncertainNow = hadUncertain || kind === 'uncertain';
      if (kind === 'uncertain') setHadUncertain(true);
      setSubmitError(kind === 'failed' && uncertainNow ? 'uncertain' : kind);
    } finally {
      setSending(false);
    }
  };

  const handleGitHubFallback = async () => {
    setSending(true);
    try {
      const flat = flatScreenshot();
      const res = await prepareGitHubFallback({
        type: feedbackType,
        title: title.trim(),
        description: description.trim(),
        screenshotDataUrl: flat,
      });
      if (flat) {
        setFallback(res);
      } else {
        await openFeedbackUrl(res.githubUrl);
        close();
      }
    } catch (err) {
      console.error('GitHub-terugval mislukt:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="feedback-dialog-overlay">
      <div
        ref={dialogRef}
        className="feedback-dialog"
        inert={annotatorOpen}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('feedback.title')}
      >
        <div className="feedback-dialog-header">
          <span className="feedback-dialog-title">{t('feedback.title')}</span>
          <button
            className="modal-close-btn"
            onClick={closeWindow}
            disabled={sending}
            title={closeLabel}
            aria-label={closeLabel}
          >
            <Icon id="ui.close" size={16} />
          </button>
        </div>

        <div className="feedback-dialog-body">
          {sent ? (
            <div className="feedback-confirm" data-feedback-sent>
              <p className="feedback-confirm-title" role="status">{t('feedback.sentTitle')}</p>
              {sent.githubIssueUrl && (
                <p className="feedback-confirm-issue">
                  {t('feedback.sentIssue')}{' '}
                  <a
                    className="feedback-confirm-link"
                    href={sent.githubIssueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => { e.preventDefault(); if (sent.githubIssueUrl) void openFeedbackUrl(sent.githubIssueUrl); }}
                  >
                    {sent.githubIssueUrl.replace(/^https:\/\//, '')}
                  </a>
                </p>
              )}
              {sent.screenshotDropped && (
                <p className="feedback-confirm-fallback">{t('feedback.sentScreenshotDropped')}</p>
              )}
            </div>
          ) : fallback ? (
            <div className="feedback-confirm">
              <p className="feedback-confirm-title">{t('feedback.instructionTitle')}</p>
              <ol className="feedback-confirm-steps">
                <li>{t('feedback.instructionStep1')}</li>
                <li>{t('feedback.instructionStep2')}</li>
                <li>{t('feedback.instructionStep3')}</li>
                <li>{t('feedback.instructionStep4')}</li>
              </ol>
              {fallback.savedPath && (
                <p className="feedback-confirm-fallback">
                  {t('feedback.instructionFallback', { path: fallback.savedPath })}
                </p>
              )}
            </div>
          ) : (
            <>
              {alreadyIn && <p className="feedback-confirm-fallback" role="status">{t('feedback.alreadyIn')}</p>}
              <div className="feedback-type-row">
                {TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    className={`feedback-type-btn${feedbackType === type ? ' active' : ''}`}
                    aria-pressed={feedbackType === type}
                    onClick={() => setFeedbackType(type)}
                    disabled={sending}
                  >
                    {t(TYPE_KEYS[type])}
                  </button>
                ))}
              </div>

              <div className="feedback-field">
                <label className="feedback-label" htmlFor="feedback-title">{t('feedback.fieldTitle')}</label>
                <input
                  id="feedback-title"
                  className="feedback-input"
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t('feedback.titlePlaceholder')}
                  maxLength={TITLE_MAX}
                  readOnly={sending}
                  autoFocus
                />
              </div>

              <div className="feedback-field">
                <label className="feedback-label" htmlFor="feedback-description">{t('feedback.fieldDescription')}</label>
                <textarea
                  id="feedback-description"
                  className="feedback-textarea"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={t('feedback.descriptionPlaceholder')}
                  maxLength={DESCRIPTION_MAX}
                  readOnly={sending}
                  rows={4}
                />
              </div>

              <div className="feedback-field">
                <label className="feedback-label" htmlFor="feedback-email">{t('feedback.fieldEmail')}</label>
                <input
                  id="feedback-email"
                  className="feedback-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  maxLength={254}
                  readOnly={sending}
                  aria-invalid={!emailOk}
                />
              </div>

              <div className="feedback-screenshot-toggle">
                <label className="feedback-toggle-label">
                  <input
                    type="checkbox"
                    checked={attachScreenshot}
                    onChange={e => handleAttachToggle(e.target.checked)}
                    disabled={sending}
                  />
                  <span>{t('feedback.attachScreenshot')}</span>
                </label>
              </div>

              {capturing && (
                <p className="feedback-capturing">{t('feedback.capturing')}</p>
              )}
              {captureError && (
                <p className="feedback-error">{captureError}</p>
              )}

              {attachScreenshot && screenshotDataUrl && !capturing && (
                <ScreenshotAnnotator
                  key={screenshotDataUrl}
                  screenshotDataUrl={screenshotDataUrl}
                  previewDataUrl={annotatedDataUrl}
                  shapes={shapes}
                  onChange={handleAnnotated}
                  onRetake={() => void captureScreenshot()}
                  onRemove={() => handleAttachToggle(false)}
                  onEditorOpenChange={setAnnotatorOpen}
                  disabled={sending}
                />
              )}

              {submitError && (
                <p className="feedback-error" role="alert" data-feedback-error={submitError}>
                  {t(ERROR_KEYS[submitError])}
                </p>
              )}

              {formHint && !sending && (
                <p id="feedback-submit-hint" className="feedback-hint" data-feedback-hint>{formHint}</p>
              )}

              <p className="feedback-privacy">{t('feedback.privacy')}</p>

              {meta && (
                <p className="feedback-meta" data-feedback-meta>
                  {t('feedback.sentWith', { version: meta.version, os: meta.os, language: languageName(meta.locale) })}
                </p>
              )}
            </>
          )}
        </div>

        <div className="feedback-dialog-footer">
          {sent ? (
            <>
              <button className="btn btn--sm btn--primary" onClick={close} autoFocus>
                {t('feedback.close')}
              </button>
            </>
          ) : fallback ? (
            <button
              className="btn btn--sm btn--primary"
              onClick={() => { void openFeedbackUrl(fallback.githubUrl); close(); }}
            >
              {t('feedback.openGithub')}
            </button>
          ) : (
            <>
              {!draftIsEmpty && (
                <button
                  type="button"
                  className="feedback-clear-btn"
                  onClick={clearDraft}
                  disabled={sending}
                  title={t('feedback.clearDraftTitle')}
                >
                  {t('feedback.clearDraft')}
                </button>
              )}
              <button
                className="btn btn--sm btn--secondary"
                onClick={closeWindow}
                disabled={sending}
              >
                {closeLabel}
              </button>
              {submitError === 'failed' && (
                <button
                  className="btn btn--sm btn--secondary"
                  onClick={() => void handleGitHubFallback()}
                  disabled={sending}
                >
                  {t('feedback.fallbackGithub')}
                </button>
              )}
              <button
                className="btn btn--sm btn--primary"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                aria-describedby={formHint && !sending ? 'feedback-submit-hint' : undefined}
              >
                {sending ? t('feedback.sending') : t('feedback.submit')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
