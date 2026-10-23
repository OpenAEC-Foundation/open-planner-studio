/**
 * ScreenshotAnnotator — annotatie-editor voor FeedbackDialog.
 *
 * Toont een klein voorbeeld van de screenshot in een licht kader, met de knoppen *Annoteren*,
 * *Opnieuw maken* en *Weghalen*. *Annoteren* opent een bijna-schermvullende overlay (~92vw × ~90vh).
 *
 * De vormen leven bij de ouder (het bewaarde feedbackconcept): de editor start met `shapes` en
 * meldt bij *Klaar* de nieuwe vormen plus de geflattende PNG. *Annuleren* (en Esc) gooit de
 * wijzigingen van deze bewerkronde weg: terug naar de vormen bij het openen van de editor.
 *
 * Afdekken (`mask`) tekent een dicht zwart vlak. Het flatten tekent dat ondoorzichtig over de
 * screenshot, dus de pixels eronder zitten niet meer in de verstuurde afbeelding.
 *
 * Coördinaten-strategie:
 *  - canvas.width/height = natieve pixeldimensies van de screenshot
 *  - CSS schaalt het canvas naar weergavegrootte (max-width/height 100%)
 *  - canvasPos() schaalt muiscoördinaten via getBoundingClientRect()
 *    zodat getekende vormen altijd correct uitlijnen op de uiteindelijke PNG
 *  - Inline tekst-invoer: <input> absoluut op de klikpositie t.o.v. het canvas
 */

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useTranslation } from 'react-i18next';
import { B2Icon } from '@/components/common/B2Icon';
import type { AnnotationShape, AnnotationPoint, AnnotationText } from '@/services/feedback/feedbackDraft';
import './ScreenshotAnnotator.css';

// ─── Annotatie-types ──────────────────────────────────────────────────────────

type AnnotationTool = 'arrow' | 'rectangle' | 'mask' | 'pen' | 'text';
type Color = string;
type Point = AnnotationPoint;
type Shape = AnnotationShape;
type ShapeText = AnnotationText;

/** Kleur van het afdekvlak: dicht zwart, zonder transparantie. */
const MASK_COLOR = '#000000';

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

function drawMask(ctx: CanvasRenderingContext2D, from: Point, to: Point) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = MASK_COLOR;
  ctx.fillRect(
    Math.min(from.x, to.x), Math.min(from.y, to.y),
    Math.abs(to.x - from.x), Math.abs(to.y - from.y),
  );
  ctx.restore();
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
    else if (s.kind === 'mask') drawMask(ctx, s.from, s.to);
    else if (s.kind === 'pen') drawPen(ctx, s.points, s.color);
    else if (s.kind === 'text') drawText(ctx, s.pos, s.text, s.color);
  }
}

// ─── Hulpfuncties ─────────────────────────────────────────────────────────────

/**
 * Zet een muispositie om naar canvas-pixelcoördinaten.
 * Schaalt via getBoundingClientRect() zodat de weergavegrootte er niet toe doet.
 */
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
      // Fouten in deze asynchrone callback moeten de Promise afwijzen, niet laten hangen.
      try {
        const out = document.createElement('canvas');
        out.width = annotationCanvas.width;
        out.height = annotationCanvas.height;
        const ctx = out.getContext('2d');
        if (!ctx) throw new Error('No 2D context');
        ctx.drawImage(img, 0, 0, out.width, out.height);
        ctx.drawImage(annotationCanvas, 0, 0);
        const png = out.toDataURL('image/png');
        if (!png.startsWith('data:image/png;')) throw new Error('Invalid PNG');
        resolve(png);
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = reject;
    img.src = screenshotDataUrl;
  });
}

// ─── Inline tekst-invoer type ─────────────────────────────────────────────────

interface TextInputState {
  /** Canvas-pixelcoördinaten (natieve resolutie) voor de uiteindelijke ShapeText. */
  canvasPoint: Point;
  /** Positie t.o.v. het canvas-element (CSS-pixels) — stuur het invoerveld hierheen. */
  screenLeft: number;
  screenTop: number;
  /** Lettergrootte in CSS-pixels = 16 (native) × weergaveschaal, zodat het
   *  invoerveld visueel even groot oogt als de uiteindelijk getekende tekst. */
  fontSize: number;
  /** Tekstkleur op het moment van klikken. */
  color: Color;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScreenshotAnnotatorProps {
  /** Het rauwe screenshot (zonder annotaties). */
  screenshotDataUrl: string;
  /** Wat het voorbeeld toont: de geflattende PNG, of null (dan het rauwe screenshot). */
  previewDataUrl: string | null;
  /** De huidige vormen (uit het concept). */
  shapes: readonly Shape[];
  /** Na *Klaar*: de nieuwe vormen en de geflattende PNG-dataURL. */
  onChange: (flattenedDataUrl: string, shapes: Shape[]) => void;
  /** *Opnieuw maken*: de ouder maakt een nieuw screenshot en wist de vormen. */
  onRetake: () => void;
  /** *Weghalen*: de ouder zet het screenshot-vinkje uit. */
  onRemove: () => void;
  /** Knoppen uit (tijdens versturen). */
  disabled?: boolean;
  /** Meldt of de editor openstaat (ook tijdens het flattenen na *Klaar*). Zolang hij openstaat,
   *  maakt de ouder de rest van het venster `inert` en kan er niet verstuurd worden. */
  onEditorOpenChange?: (open: boolean) => void;
}

/** Het editorpaneel met een eigen focus-trap: Tab blijft in de editor zolang die openstaat. */
function EditorPanel({ label, children }: { label: string; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef);
  // `useFocusTrap` luistert op het paneel. Na tekenen op het canvas (niet focusbaar) staat de focus
  // op `body`; Tab zou dan naar de app erachter gaan. Daarom ook op document: Tab buiten het paneel
  // zet de focus terug op het eerste focusbare element van de editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (e.key !== 'Tab' || !panel || panel.contains(document.activeElement)) return;
      e.preventDefault();
      const items = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'))
        .filter(el => el.getClientRects().length > 0);
      (e.shiftKey ? items[items.length - 1] : items[0])?.focus();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);
  return (
    <div
      ref={panelRef}
      className="annotator-editor"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={e => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScreenshotAnnotator({
  screenshotDataUrl, previewDataUrl, shapes: committedShapes, onChange, onRetake, onRemove, disabled = false,
  onEditorOpenChange,
}: ScreenshotAnnotatorProps) {
  const { t } = useTranslation('common');

  const [editorOpen, setEditorOpen] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  // Werkkopie tijdens een bewerkronde; bij openen gevuld uit `committedShapes`.
  const [shapes, setShapes] = useState<Shape[]>(() => [...committedShapes]);
  const [activeTool, setActiveTool] = useState<AnnotationTool>('arrow');
  const [activeColor, setActiveColor] = useState<Color>('#ef4444');

  // Inline tekst-invoer
  const [textInput, setTextInput] = useState<TextInputState | null>(null);
  const [textValue, setTextValue] = useState('');

  // Canvas voor annotaties in de grote editor
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const currentShape = useRef<Shape | null>(null);
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;

  const thumbnailUrl = previewDataUrl ?? screenshotDataUrl;

  // De ouder volgt of de editor openstaat (versturen blokkeren, de rest van het venster inert).
  useEffect(() => {
    onEditorOpenChange?.(editorOpen);
  }, [editorOpen, onEditorOpenChange]);
  useEffect(() => () => onEditorOpenChange?.(false), [onEditorOpenChange]);

  // ── Canvas: afmetingen synchroniseren met screenshot bij openen ───────────
  useEffect(() => {
    if (!editorOpen || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) redrawAll(ctx, shapesRef.current);
    };
    img.src = screenshotDataUrl;
  }, [editorOpen, screenshotDataUrl]);

  // Hertekenen bij shapes-wijziging
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !editorOpen) return;
    const ctx = canvas.getContext('2d');
    if (ctx) redrawAll(ctx, shapes);
  }, [shapes, editorOpen]);

  // ── Editor openen/sluiten ─────────────────────────────────────────────────

  const openEditor = () => {
    // Elke bewerkronde begint bij de vastgelegde vormen; *Annuleren* keert daarheen terug.
    setShapes([...committedShapes]);
    setSaveError(false);
    setEditorOpen(true);
  };

  /** *Klaar*: flatten en de nieuwe vormen aan de ouder geven. */
  const closeEditor = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('No annotation canvas');
      const flat = await flattenToPng(screenshotDataUrl, canvas);
      onChange(flat, shapesRef.current);
      setEditorOpen(false);
      setTextInput(null);
      setTextValue('');
    } catch {
      // Fail closed: nooit het origineel vastleggen als afdekken niet gelukt is.
      // De editor blijft open, dus de ouder blijft inert en Versturen geblokkeerd.
      setSaveError(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [screenshotDataUrl, onChange]);

  /** *Annuleren* (en Esc): de wijzigingen van deze bewerkronde weggooien. */
  const cancelEditor = useCallback(() => {
    if (savingRef.current) return;
    drawing.current = false;
    currentShape.current = null;
    setShapes([...committedShapes]);
    setEditorOpen(false);
    setTextInput(null);
    setTextValue('');
  }, [committedShapes]);

  // Escape-handler voor de grote editor.
  // CAPTURE-fase + stopPropagation: anders vangt FeedbackDialog's eigen
  // Escape-handler (op document, bubble) het óók op en sluit de HELE dialoog
  // i.p.v. alleen de editor — waarmee de ingetypte titel/omschrijving verloren
  // gaat. Capture-listeners op document vuren vóór bubble-listeners, ongeacht
  // registratievolgorde, dus deze wint. Esc in de editor = *Annuleren*.
  useEffect(() => {
    if (!editorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (textInput) {
        // Annuleer tekst-invoer, sluit de editor NIET
        setTextInput(null);
        setTextValue('');
      } else {
        cancelEditor();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [editorOpen, textInput, cancelEditor]);

  // ── Annotatie-muisgebeurtenissen ──────────────────────────────────────────

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const pos = canvasPos(canvasRef.current, e);

    if (activeTool === 'text') {
      // KRITIEK: voorkom de standaard mousedown-focus-actie. Zonder dit
      // verspringt de focus na deze handler naar het niet-focusbare canvas/body,
      // wat het zojuist via autoFocus gefocuste invoerveld meteen blurt → onBlur
      // commit (leeg) → het veld verdwijnt direct. preventDefault houdt de focus
      // op het invoerveld.
      e.preventDefault();
      // Inline tekst-invoer: positie t.o.v. canvas-element in CSS-pixels.
      // De weergaveschaal (rect.width / canvas.width) bepaalt de lettergrootte
      // zodat het invoerveld even groot oogt als de uiteindelijk getekende tekst.
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const scale = canvasRect.width / canvasRef.current.width;
      const fontSize = 16 * scale;
      setTextInput({
        canvasPoint: pos,
        screenLeft: e.clientX - canvasRect.left,
        // drawText tekent met de baseline op canvasPoint.y; til het invoerveld
        // één regelhoogte op zodat de getypte tekst op de klikpositie landt.
        screenTop: (e.clientY - canvasRect.top) - fontSize,
        fontSize,
        color: activeColor,
      });
      setTextValue('');
      return;
    }

    drawing.current = true;
    if (activeTool === 'arrow') {
      currentShape.current = { kind: 'arrow', from: pos, to: pos, color: activeColor };
    } else if (activeTool === 'rectangle') {
      currentShape.current = { kind: 'rect', from: pos, to: pos, color: activeColor };
    } else if (activeTool === 'mask') {
      currentShape.current = { kind: 'mask', from: pos, to: pos };
    } else if (activeTool === 'pen') {
      currentShape.current = { kind: 'pen', points: [pos], color: activeColor };
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !canvasRef.current || !currentShape.current) return;
    const pos = canvasPos(canvasRef.current, e);
    const s = currentShape.current;

    if (s.kind === 'arrow' || s.kind === 'rect' || s.kind === 'mask') s.to = pos;
    else if (s.kind === 'pen') s.points.push(pos);

    const ctx = canvasRef.current.getContext('2d');
    if (ctx) redrawAll(ctx, shapes, s);
  };

  const onMouseUp = () => {
    if (!drawing.current || !currentShape.current) return;
    drawing.current = false;
    const shape = currentShape.current;
    currentShape.current = null;
    setShapes(prev => [...prev, shape]);
  };

  // ── Tekst-invoer vastleggen ───────────────────────────────────────────────

  const commitTextInput = useCallback(() => {
    if (!textInput) return;
    if (textValue.trim()) {
      const shape: ShapeText = {
        kind: 'text',
        pos: textInput.canvasPoint,
        text: textValue.trim(),
        color: textInput.color,
      };
      setShapes(prev => [...prev, shape]);
    }
    setTextInput(null);
    setTextValue('');
  }, [textInput, textValue]);

  const onTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitTextInput();
    } else if (e.key === 'Escape') {
      setTextInput(null);
      setTextValue('');
    }
  };

  // ── Undo & clear ──────────────────────────────────────────────────────────

  const handleUndo = () => setShapes(prev => prev.slice(0, -1));
  const handleClear = () => setShapes([]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Klein voorbeeld in een licht kader, met de drie knoppen ernaast */}
      <div className="screenshot-annotator-preview">
        <div className="screenshot-annotator-thumbnail">
          <img
            src={thumbnailUrl}
            className="screenshot-annotator-thumb-img"
            alt={t('feedback.screenshotPreview')}
            draggable={false}
          />
        </div>
        <div className="screenshot-annotator-actions">
          <button type="button" className="screenshot-annotator-action" onClick={openEditor} disabled={disabled} data-annotate-button>
            <B2Icon name="capture.annotate" size={14} aria-hidden />
            <span>{t('feedback.annotate')}</span>
          </button>
          <button type="button" className="screenshot-annotator-action" onClick={onRetake} disabled={disabled}>
            <B2Icon name="ui.refresh" size={14} aria-hidden />
            <span>{t('feedback.retake')}</span>
          </button>
          <button type="button" className="screenshot-annotator-action" onClick={onRemove} disabled={disabled}>
            <B2Icon name="edit.delete" size={14} aria-hidden />
            <span>{t('feedback.removeScreenshot')}</span>
          </button>
        </div>
      </div>

      {/* Bijna-schermvullende editor-overlay. Via een portal buiten het feedbackvenster, zodat de
          ouder dat venster `inert` kan maken: de focus kan dan niet naar *Versturen* erachter. */}
      {editorOpen && createPortal(
        <div
          className="annotator-editor-backdrop"
          onClick={() => void closeEditor()}
        >
          <EditorPanel label={t('feedback.annotate')}>
            {/* Toolbar */}
            <div className="annotator-editor-toolbar" inert={saving}>
              <button
                className={`feedback-ann-btn${activeTool === 'arrow' ? ' active' : ''}`}
                title={t('feedback.tools.arrow')}
                onClick={() => setActiveTool('arrow')}
              >
                <B2Icon name="draw.arrow" size={16} />
              </button>
              <button
                className={`feedback-ann-btn${activeTool === 'rectangle' ? ' active' : ''}`}
                title={t('feedback.tools.rectangle')}
                onClick={() => setActiveTool('rectangle')}
              >
                <B2Icon name="draw.rectangle" size={16} />
              </button>
              <button
                className={`feedback-ann-btn${activeTool === 'mask' ? ' active' : ''}`}
                title={t('feedback.tools.mask')}
                aria-label={t('feedback.tools.mask')}
                aria-pressed={activeTool === 'mask'}
                onClick={() => setActiveTool('mask')}
              >
                <B2Icon name="annotate.redact" size={16} />
              </button>
              <button
                className={`feedback-ann-btn${activeTool === 'pen' ? ' active' : ''}`}
                title={t('feedback.tools.pen')}
                onClick={() => setActiveTool('pen')}
              >
                <B2Icon name="draw.freehand" size={16} />
              </button>
              <button
                className={`feedback-ann-btn${activeTool === 'text' ? ' active' : ''}`}
                title={t('feedback.tools.text')}
                onClick={() => setActiveTool('text')}
              >
                <B2Icon name="draw.text" size={16} />
              </button>

              <div className="feedback-ann-sep" />

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
                <B2Icon name="edit.undo" size={16} />
              </button>
              <button
                className="feedback-ann-btn"
                title={t('feedback.tools.clear')}
                onClick={handleClear}
                disabled={shapes.length === 0}
              >
                <B2Icon name="capture.clear-annotations" size={16} />
              </button>

              <div className="annotator-toolbar-spacer" />

              <button
                className="annotator-cancel-btn"
                onClick={cancelEditor}
              >
                {t('feedback.cancel')}
              </button>
              <button
                className="btn btn--sm btn--primary"
                onClick={() => void closeEditor()}
              >
                {t('feedback.editorDone')}
              </button>
            </div>

            {saveError && (
              <p role="alert" className="text-body" style={{ padding: '0.5rem 1rem' }}>
                {t('feedback.annotationSaveFailed')}
              </p>
            )}

            {/* Canvas-ruimte */}
            <div className="annotator-canvas-area" inert={saving}>
              {/*
                annotator-canvas-inner heeft position:relative zodat:
                  1. De img zijn eigen aspect-ratio bepaalt (width 100%, height auto)
                  2. Het canvas en het tekst-invoerveld absoluut erover gepositioneerd worden
                  3. canvasPos() via getBoundingClientRect() de juiste schaal berekent
              */}
              <div className="annotator-canvas-inner">
                <img
                  src={screenshotDataUrl}
                  className="annotator-editor-img"
                  alt=""
                  draggable={false}
                />
                <canvas
                  ref={canvasRef}
                  className="annotator-editor-canvas"
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                />
                {/* Inline tekst-invoer — verschijnt op de klikpositie */}
                {textInput && (
                  <input
                    type="text"
                    className="annotator-text-input"
                    style={{
                      left: textInput.screenLeft,
                      top: textInput.screenTop,
                      fontSize: `${textInput.fontSize}px`, // text-roles: volgt de schaal van de screenshot (16 × canvas-schaal), geen interfacetekst
                      color: textInput.color,
                    }}
                    value={textValue}
                    onChange={e => setTextValue(e.target.value)}
                    onKeyDown={onTextKeyDown}
                    onBlur={commitTextInput}
                    // Bewust autoFocus: het tekstvak verschijnt pas ná een expliciete klik van de
                    // gebruiker op de plek waar hij tekst wil zetten, dus de focus volgt zijn actie.
                    autoFocus
                  />
                )}
              </div>
            </div>
          </EditorPanel>
        </div>,
        document.body,
      )}
    </>
  );
}
