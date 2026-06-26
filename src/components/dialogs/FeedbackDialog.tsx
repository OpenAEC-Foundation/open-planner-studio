/**
 * FeedbackDialog — feedback-knop → GitHub issue.
 *
 * Patroon: vergelijkbaar met UpdateDialog.tsx / SettingsDialog.tsx.
 * - Overlay + paneel, sluiten via setUI, Escape-handler, klik-backdrop-sluit.
 * - Alle tekst via t('feedback.xxx') (common-namespace).
 * - @tauri-apps/* UITSLUITEND dynamisch geïmporteerd binnen isTauri()-branches.
 * - Screenshot via modern-screenshot domToPng; dialoog uitgefilterd.
 * - Annotatie-canvas: pijl, rechthoek, pen, tekst, kleur, undo, wissen.
 * - Twee verstuur-paden: PAD A (geen screenshot) / PAD B (met screenshot + klembord).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, ArrowUpRight, Square, Pen, Type, Undo2, Trash2 } from 'lucide-react';
import { sendFeedback, type FeedbackType, type SendResult } from '@/services/feedback/feedbackService';
import './FeedbackDialog.css';

// ─── Annotatie-types ──────────────────────────────────────────────────────────

type AnnotationTool = 'arrow' | 'rectangle' | 'pen' | 'text';
type Color = string;

interface Point { x: number; y: number; }

interface ShapeArrow { kind: 'arrow'; from: Point; to: Point; color: Color; }
interface ShapeRect  { kind: 'rect';  from: Point; to: Point; color: Color; }
interface ShapePen   { kind: 'pen';   points: Point[]; color: Color; }
interface ShapeText  { kind: 'text';  pos: Point; text: string; color: Color; }

type Shape = ShapeArrow | ShapeRect | ShapePen | ShapeText;

const PALETTE: Color[] = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ffffff', '#000000'];

// ─── Canvas-rendering ─────────────────────────────────────────────────────────

function drawArrow(ctx: CanvasRenderingContext2D, from: Point, to: Point, color: Color) {
  const headLen = 14;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - headLen * Math.cos(angle - Math.PI / 6), to.y - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(to.x - headLen * Math.cos(angle + Math.PI / 6), to.y - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function drawRect(ctx: CanvasRenderingContext2D, from: Point, to: Point, color: Color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(from.x, from.y, to.x - from.x, to.y - from.y);
}

function drawPen(ctx: CanvasRenderingContext2D, points: Point[], color: Color) {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}

function drawText(ctx: CanvasRenderingContext2D, pos: Point, text: string, color: Color) {
  ctx.fillStyle = color;
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(text, pos.x, pos.y);
}

function redrawAll(ctx: CanvasRenderingContext2D, shapes: Shape[], active?: Shape | null) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const all = active ? [...shapes, active] : shapes;
  for (const s of all) {
    if (s.kind === 'arrow') drawArrow(ctx, s.from, s.to, s.color);
    else if (s.kind === 'rect') drawRect(ctx, s.from, s.to, s.color);
    else if (s.kind === 'pen') drawPen(ctx, s.points, s.color);
    else if (s.kind === 'text') drawText(ctx, s.pos, s.text, s.color);
  }
}

// ─── Hulpfuncties ─────────────────────────────────────────────────────────────

function canvasPos(canvas: HTMLCanvasElement, e: React.MouseEvent): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

/** Flatten screenshot-dataURL + annotatie-canvas tot één PNG-dataURL. */
function flattenToPng(screenshotDataUrl: string, annotationCanvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const out = document.createElement('canvas');
      out.width = annotationCanvas.width;
      out.height = annotationCanvas.height;
      const ctx = out.getContext('2d');
      if (!ctx) { reject(new Error('No 2D context')); return; }
      ctx.drawImage(img, 0, 0, out.width, out.height);
      ctx.drawImage(annotationCanvas, 0, 0);
      resolve(out.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = screenshotDataUrl;
  });
}

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
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Annotatie-state
  const annotationRef = useRef<HTMLCanvasElement>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [activeTool, setActiveTool] = useState<AnnotationTool>('arrow');
  const [activeColor, setActiveColor] = useState<Color>('#ef4444');
  const drawing = useRef(false);
  const currentShape = useRef<Shape | null>(null);

  // Verstuur-state
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const close = useCallback(() => setUI({ showFeedbackDialog: false }), [setUI]);

  // Escape sluit de dialoog (niet tijdens versturen).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close, sending]);

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
      setShapes([]);
    } catch (err) {
      console.warn('Screenshot mislukt:', err);
      setCaptureError(t('feedback.captureFailed'));
      setAttachScreenshot(false);
      setScreenshotDataUrl(null);
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
      setShapes([]);
      setCaptureError(null);
    }
  }, [screenshotDataUrl, captureScreenshot]);

  // ── Annotatie-canvas: afmetingen synchroniseren met screenshot ────────────
  useEffect(() => {
    if (!screenshotDataUrl || !annotationRef.current) return;
    const img = new Image();
    img.onload = () => {
      const canvas = annotationRef.current!;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) redrawAll(ctx, shapes);
    };
    img.src = screenshotDataUrl;
    // shapes bewust niet in dep — alleen bij nieuwe screenshot resetten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenshotDataUrl]);

  // Hertekenen bij shapes-wijziging
  useEffect(() => {
    const canvas = annotationRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) redrawAll(ctx, shapes);
  }, [shapes]);

  // ── Annotatie-muisgebeurtenissen ──────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!annotationRef.current) return;
    drawing.current = true;
    const pos = canvasPos(annotationRef.current, e);

    if (activeTool === 'arrow') {
      currentShape.current = { kind: 'arrow', from: pos, to: pos, color: activeColor };
    } else if (activeTool === 'rectangle') {
      currentShape.current = { kind: 'rect', from: pos, to: pos, color: activeColor };
    } else if (activeTool === 'pen') {
      currentShape.current = { kind: 'pen', points: [pos], color: activeColor };
    } else if (activeTool === 'text') {
      // Tekst-tool: simpel prompt (eenvoud boven verfijning per spec).
      drawing.current = false;
      const text = window.prompt(t('feedback.tools.text'));
      if (text && text.trim()) {
        const shape: ShapeText = { kind: 'text', pos, text: text.trim(), color: activeColor };
        setShapes(prev => [...prev, shape]);
      }
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !annotationRef.current || !currentShape.current) return;
    const pos = canvasPos(annotationRef.current, e);
    const s = currentShape.current;

    if (s.kind === 'arrow') s.to = pos;
    else if (s.kind === 'rect') s.to = pos;
    else if (s.kind === 'pen') s.points.push(pos);

    const ctx = annotationRef.current.getContext('2d');
    if (ctx) redrawAll(ctx, shapes, s);
  };

  const onMouseUp = () => {
    if (!drawing.current || !currentShape.current) return;
    drawing.current = false;
    // Bewaar de shape lokaal vóór we de ref nullen: de setShapes-updater draait
    // pas ná dit event, en zou currentShape.current dan als null lezen → crash.
    const shape = currentShape.current;
    currentShape.current = null;
    setShapes(prev => [...prev, shape]);
  };

  // ── Undo & clear ──────────────────────────────────────────────────────────
  const handleUndo = () => setShapes(prev => prev.slice(0, -1));
  const handleClear = () => setShapes([]);

  // ── Versturen ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSending(true);
    try {
      let flatDataUrl: string | null = null;
      if (attachScreenshot && screenshotDataUrl && annotationRef.current) {
        flatDataUrl = await flattenToPng(screenshotDataUrl, annotationRef.current);
      }
      const res = await sendFeedback({
        type: feedbackType,
        title: title.trim(),
        description: description.trim(),
        screenshotDataUrl: flatDataUrl,
      });
      // PAD B (mét screenshot): toon de plak-instructie.
      // PAD A (zónder screenshot): geen klembord/plakstap → sluit direct.
      if (flatDataUrl) {
        setResult(res);
      } else {
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

              {/* Screenshot-preview + annotatiebalk */}
              {attachScreenshot && screenshotDataUrl && !capturing && (
                <div className="feedback-screenshot-section">
                  {/* Annotatiebalk */}
                  <div className="feedback-annotation-toolbar">
                    <button
                      className={`feedback-ann-btn${activeTool === 'arrow' ? ' active' : ''}`}
                      title={t('feedback.tools.arrow')}
                      onClick={() => setActiveTool('arrow')}
                    >
                      <ArrowUpRight size={14} />
                    </button>
                    <button
                      className={`feedback-ann-btn${activeTool === 'rectangle' ? ' active' : ''}`}
                      title={t('feedback.tools.rectangle')}
                      onClick={() => setActiveTool('rectangle')}
                    >
                      <Square size={14} />
                    </button>
                    <button
                      className={`feedback-ann-btn${activeTool === 'pen' ? ' active' : ''}`}
                      title={t('feedback.tools.pen')}
                      onClick={() => setActiveTool('pen')}
                    >
                      <Pen size={14} />
                    </button>
                    <button
                      className={`feedback-ann-btn${activeTool === 'text' ? ' active' : ''}`}
                      title={t('feedback.tools.text')}
                      onClick={() => setActiveTool('text')}
                    >
                      <Type size={14} />
                    </button>

                    <div className="feedback-ann-sep" />

                    {/* Kleurpalet */}
                    {PALETTE.map(c => (
                      <button
                        key={c}
                        className={`feedback-color-swatch${activeColor === c ? ' active' : ''}`}
                        style={{ background: c }}
                        onClick={() => setActiveColor(c)}
                        title={t('feedback.tools.color')}
                        aria-label={c}
                      />
                    ))}

                    <div className="feedback-ann-sep" />

                    <button
                      className="feedback-ann-btn"
                      title={t('feedback.tools.undo')}
                      onClick={handleUndo}
                      disabled={shapes.length === 0}
                    >
                      <Undo2 size={14} />
                    </button>
                    <button
                      className="feedback-ann-btn"
                      title={t('feedback.tools.clear')}
                      onClick={handleClear}
                      disabled={shapes.length === 0}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Preview + annotatie-canvas */}
                  <div className="feedback-preview-container">
                    <img
                      src={screenshotDataUrl}
                      className="feedback-preview-img"
                      alt=""
                      draggable={false}
                    />
                    <canvas
                      ref={annotationRef}
                      className="feedback-annotation-canvas"
                      onMouseDown={onMouseDown}
                      onMouseMove={onMouseMove}
                      onMouseUp={onMouseUp}
                      onMouseLeave={onMouseUp}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="feedback-dialog-footer">
          {result ? (
            <button className="btn btn--sm btn--primary" onClick={close}>
              {t('feedback.close')}
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
