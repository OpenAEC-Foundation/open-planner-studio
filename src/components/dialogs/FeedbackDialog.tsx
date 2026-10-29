/**
 * FeedbackDialog — feedback-knop → Open Feedback Studio (OpenAEC).
 *
 * Patroon: vergelijkbaar met UpdateDialog.tsx / SettingsDialog.tsx.
 * - Overlay + paneel, sluiten via setUI en Escape-handler. Bewust GEEN backdrop-close:
 *   de dialoog bevat een tekstveld, en een klik naast het paneel mag getypte tekst niet weggooien.
 * - Alle tekst via t('feedback.xxx') (common-namespace).
 * - @tauri-apps/* UITSLUITEND dynamisch geïmporteerd binnen isTauri()-branches (in de service).
 * - Screenshot via modern-screenshot domToPng; dialoog uitgefilterd.
 * - Annotatie: gedelegeerd aan <ScreenshotAnnotator/> (thumbnail + grote editor).
 * - Hoofdweg: `submitFeedback()` post naar de API; daarna het bedankscherm.
 * - Concept: soort, tekst, e-mail, vinkje en screenshot + annotaties blijven na sluiten bewaard in
 *   `ui.feedbackDraft` (sessie). Na een geslaagde verzending of *Leegmaken* is het concept weg.
 * - Terugval bij een netwerk- of serverfout: de knop "Open op GitHub" volgt de oude weg
 *   (PAD A: URL meteen open; PAD B: screenshot op klembord + plak-instructie).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
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

/** Max lengtes van de velden: samen met de metaregel blijft `message` onder de servergrens (5000). */
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 4600;

// `duplicate` (409) is geen fout maar de toestand "al binnen" (`alreadyIn`).
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

/** Naam van de taal in die taal zelf, met hoofdletter (bijv. "Nederlands"); anders de code. */
function languageName(locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'language' }).of(locale);
    if (name) return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  } catch { /* onbekende code */ }
  return locale;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FeedbackDialog() {
  const { t, i18n } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const setFeedbackDraft = useAppStore(s => s.setFeedbackDraft);
  const storedEmail = useAppStore(s => s.ui.feedbackEmail);
  // Het bewaarde concept, alleen bij het openen gelezen (daarna is de lokale state de bron).
  const [initialDraft] = useState<FeedbackDraft | null>(() => useAppStore.getState().ui.feedbackDraft);

  // Form-state
  const [feedbackType, setFeedbackType] = useState<FeedbackType>(initialDraft?.type ?? 'bug');
  const [title, setTitle] = useState(initialDraft?.title ?? '');
  const [description, setDescription] = useState(initialDraft?.description ?? '');
  const [email, setEmail] = useState(initialDraft?.email ?? storedEmail);
  // Een screenshot dat nog bezig was toen het venster sloot, is er niet: vinkje dan uit.
  const [attachScreenshot, setAttachScreenshot] = useState(
    !!initialDraft?.attachScreenshot && !!initialDraft.screenshotDataUrl);

  // Screenshot-state
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(initialDraft?.screenshotDataUrl ?? null);
  // Door ScreenshotAnnotator geleverde geflattende PNG (screenshot + annotaties).
  // Null zolang er nog niet geannoteerd is → val terug op de rauwe screenshot.
  const [annotatedDataUrl, setAnnotatedDataUrl] = useState<string | null>(initialDraft?.annotatedDataUrl ?? null);
  const [shapes, setShapes] = useState<AnnotationShape[]>(initialDraft?.shapes ?? []);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Verstuur-state
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<keyof typeof ERROR_KEYS | null>(null);
  const [sent, setSent] = useState<SubmitFeedbackResult | null>(null);
  // 409 = "al binnen": het formulier blijft staan met een rustige melding; er gaat niets verloren.
  const [alreadyIn, setAlreadyIn] = useState(false);
  // Onopgeloste onzekere poging: die kan alsnog binnenkomen, dus nooit GitHub. Hoort bij het concept,
  // zodat de vlag sluiten en heropenen overleeft.
  const [hadUncertain, setHadUncertain] = useState(initialDraft?.hadUncertain ?? false);
  // Terugval PAD B: plak-instructie voor GitHub.
  const [fallback, setFallback] = useState<SendResult | null>(null);

  const close = useCallback(() => setUI({ showFeedbackDialog: false }), [setUI]);

  // ── Concept bewaren ───────────────────────────────────────────────────────
  // Leeg = niets ingevuld; dan bewaren we geen concept. Een soort kiezen is geen inhoud: alleen
  // titel, omschrijving, een ander e-mailadres dan het opgeslagen adres of een screenshot tellen.
  // De soort gaat wel mee in het concept als er inhoud is.
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
  // Na een geslaagde verzending blijft er geen concept over.
  const discardDraftRef = useRef(false);
  // Bij sluiten (Esc, Annuleren, kruisje, of een andere weg) het concept in de UI-state zetten.
  useEffect(() => () => {
    setFeedbackDraft(discardDraftRef.current ? null : draftRef.current);
  }, [setFeedbackDraft]);

  // Eén plek: elke wijziging in het formulier (soort, tekst, e-mail, screenshot aan/uit, opnieuw
  // maken, annotaties) verlaat "al binnen". Dan is het een nieuwe, nog niet verstuurde aanvulling:
  // de melding verdwijnt, de knoppen zijn weer *Annuleren* + *Versturen*, en sluiten bewaart het concept.
  // Alleen zetten als "al binnen" aan staat. Een onvoorwaardelijke `setAlreadyIn(false)` plant na
  // elke toets een extra render: React slaat een gelijke waarde vlak na een update niet meteen over.
  // Typt iemand snel, dan valt die render samen met de volgende toets, en telt React elke toets als
  // geneste update. Na 50 toetsen volgt "Maximum update depth exceeded" en valt een teken weg.
  const alreadyInRef = useRef(alreadyIn);
  alreadyInRef.current = alreadyIn;
  useEffect(() => {
    if (alreadyInRef.current) setAlreadyIn(false);
  }, [feedbackType, title, description, email, attachScreenshot, screenshotDataUrl, annotatedDataUrl, shapes]);

  /** *Sluiten* vanuit "al binnen": de melding is binnen, dus het concept gaat weg. */
  const closeAlreadyIn = () => {
    discardDraftRef.current = true;
    setFeedbackDraft(null);
    close();
  };

  // Eén afleiding voor sluiten (voetknop, kruisje en Esc): is er iets te bewaren, dan heet de knop
  // *Bewaren en sluiten* en blijft het concept staan; anders (leeg formulier, verstuurd, "al binnen")
  // gewoon *Sluiten*. Vanuit "al binnen" wist sluiten het concept.
  const keepsDraft = !sent && !alreadyIn && !draftIsEmpty;
  const closeLabel = keepsDraft ? t('feedback.saveAndClose') : t('feedback.close');
  const closeWindow = alreadyIn ? closeAlreadyIn : close;

  // ── Wat er meegaat (regel *Meegestuurd*): dezelfde bron als de metaregel van de service ──
  const [meta, setMeta] = useState<FeedbackMeta | null>(null);
  useEffect(() => {
    let alive = true;
    void getFeedbackMeta().then(m => { if (alive) setMeta(m); });
    return () => { alive = false; };
  }, [i18n.language]);

  // Focus-trap (a11y): eigen overlay (geen shared Dialog), role/aria-modal staan al op het paneel.
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  // Escape sluit de dialoog (niet tijdens versturen: dan is de handler `undefined` en doet de
  // hook niets). De overlay zelf blijft custom CSS-chrome — geen `Dialog`-migratie hier.
  useDialogKeys({ onCancel: sending ? undefined : closeWindow });

  // ── Validatie vooraf ───────────────────────────────────────────────────────
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
  // Zolang de annotatie-editor openstaat (ook tijdens het flattenen na *Klaar*) kan er niet verstuurd
  // worden: anders gaat het screenshot zonder de laatste annotaties (en zonder afdekking) mee.
  const [annotatorOpen, setAnnotatorOpen] = useState(false);
  // Na het sluiten van de editor (Klaar, Annuleren, Esc) de focus terug op *Annoteren*. Dat kan pas
  // als `inert` van het venster af is, dus hier na de commit van de ouder; de focus-trap van de
  // editor probeert het eerder, terwijl het venster nog inert is, en dan valt de focus op `body`.
  const annotatorWasOpen = useRef(false);
  useEffect(() => {
    if (annotatorWasOpen.current && !annotatorOpen) {
      dialogRef.current?.querySelector<HTMLElement>('[data-annotate-button]')?.focus();
    }
    annotatorWasOpen.current = annotatorOpen;
  }, [annotatorOpen]);
  const canSubmit = !sending && !capturing && !annotatorOpen && formHint === null;

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

  /** *Leegmaken*: het concept weggooien en het formulier leeg zetten. */
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

  // De geflattende PNG uit de annotator (screenshot + annotaties); is er nog niet geannoteerd,
  // dan de rauwe screenshot.
  const flatScreenshot = (): string | null =>
    attachScreenshot ? (annotatedDataUrl ?? screenshotDataUrl) : null;

  // ── Versturen (hoofdweg) ─────────────────────────────────────────────────
  // Succes en 409 ("al binnen") sluiten een onzekere poging af en bewaren het e-mailadres.
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
      // Na een onzekere poging blijft ook een zekere mislukking "onzeker": geen GitHub-knop.
      setSubmitError(kind === 'failed' && uncertainNow ? 'uncertain' : kind);
    } finally {
      setSending(false);
    }
  };

  // ── Terugval: de oude GitHub-weg ─────────────────────────────────────────
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
      // PAD B (mét screenshot): toon de plak-instructie; GitHub opent PAS nadat de gebruiker daar
      // op "OK" klikt (zo staat de screenshot al op het klembord vóór de issue-pagina opent).
      // PAD A (zónder screenshot): geen plakstap → open GitHub meteen en sluit.
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="feedback-dialog-overlay">
      <div
        ref={dialogRef}
        className="feedback-dialog"
        // Annotatie-editor open: het venster is inert (geen focus, geen klik), de editor heeft de focus.
        inert={annotatorOpen}
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
            onClick={closeWindow}
            disabled={sending}
            title={closeLabel}
            aria-label={closeLabel}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="feedback-dialog-body">
          {sent ? (
            /* ── Bedankscherm (hoofdweg geslaagd) ── */
            <div className="feedback-confirm" data-feedback-sent>
              <p className="feedback-confirm-title" role="status">{t('feedback.sentTitle')}</p>
              {sent.screenshotDropped && (
                <p className="feedback-confirm-fallback">{t('feedback.sentScreenshotDropped')}</p>
              )}
            </div>
          ) : fallback ? (
            /* ── Terugval PAD B: plak-instructie voor GitHub ── */
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
            /* ── Formulier ── */
            <>
              {alreadyIn && <p className="feedback-confirm-fallback" role="status">{t('feedback.alreadyIn')}</p>}
              {/* Type-schakelaar */}
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

              {/* Titel */}
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

              {/* Omschrijving */}
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

              {/* E-mailadres (optioneel) */}
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

              {/* Screenshot-schakelaar */}
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

              {/* Fout bij versturen (vertaald; de ingevulde tekst blijft staan) */}
              {submitError && (
                <p className="feedback-error" role="alert" data-feedback-error={submitError}>
                  {t(ERROR_KEYS[submitError])}
                </p>
              )}

              {/* Waarom de knop grijs is: een rustige grijze hint, geen rode fout */}
              {formHint && !sending && (
                <p id="feedback-submit-hint" className="feedback-hint" data-feedback-hint>{formHint}</p>
              )}

              <p className="feedback-privacy">{t('feedback.privacy')}</p>

              {/* Wat er met de melding meegaat (gelijk aan de metaregel van de service) */}
              {meta && (
                <p className="feedback-meta" data-feedback-meta>
                  {t('feedback.sentWith', { version: meta.version, os: meta.os, language: languageName(meta.locale) })}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="feedback-dialog-footer">
          {sent ? (
            <>
              {sent.githubIssueUrl && (
                <button
                  className="btn btn--sm btn--secondary"
                  onClick={() => { if (sent.githubIssueUrl) void openFeedbackUrl(sent.githubIssueUrl); }}
                >
                  {t('feedback.viewOnGithub')}
                </button>
              )}
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
              {/* Eén knop: *Bewaren en sluiten* of *Sluiten* (zie `keepsDraft`). */}
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
