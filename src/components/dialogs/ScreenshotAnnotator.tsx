/**
 * ScreenshotAnnotator — annotatie-editor voor FeedbackDialog.
 *
 * Toont een thumbnail van de screenshot met een "Annoteren"-knop.
 * Bij klikken opent een bijna-schermvullende overlay (~92vw × ~90vh).
 *
 * Coördinaten-strategie:
 *  - canvas.width/height = natieve pixeldimensies van de screenshot
 *  - CSS schaalt het canvas naar weergavegrootte (max-width/height 100%)
 *  - canvasPos() schaalt muiscoördinaten via getBoundingClientRect()
 *    zodat getekende vormen altijd correct uitlijnen op de uiteindelijke PNG
 *  - Inline tekst-invoer: <input> absoluut op de klikpositie t.o.v. het canvas
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Square, Pen, Type, Undo2, Trash2, Pencil } from 'lucide-react';
import './ScreenshotAnnotator.css';

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
  screenshotDataUrl: string;
  /** Wordt aangeroepen als de editor sluit, met de geflattende PNG-dataURL. */
  onChange: (flattenedDataUrl: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScreenshotAnnotator({ screenshotDataUrl, onChange }: ScreenshotAnnotatorProps) {
  const { t } = useTranslation('common');

  const [editorOpen, setEditorOpen] = useState(false);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [activeTool, setActiveTool] = useState<AnnotationTool>('arrow');
  const [activeColor, setActiveColor] = useState<Color>('#ef4444');

  // Inline tekst-invoer
  const [textInput, setTextInput] = useState<TextInputState | null>(null);
  const [textValue, setTextValue] = useState('');

  // Canvas voor annotaties in de grote editor
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const currentShape = useRef<Shape | null>(null);

  // Thumbnail: bijgewerkt na sluiten van de editor
  const [thumbnailUrl, setThumbnailUrl] = useState<string>(screenshotDataUrl);

  // Reset bij nieuw screenshot
  useEffect(() => {
    setThumbnailUrl(screenshotDataUrl);
    setShapes([]);
  }, [screenshotDataUrl]);

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
      if (ctx) redrawAll(ctx, shapes);
    };
    img.src = screenshotDataUrl;
    // shapes bewust niet in dep: canvas mag alleen herschalen bij openen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen, screenshotDataUrl]);

  // Hertekenen bij shapes-wijziging
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !editorOpen) return;
    const ctx = canvas.getContext('2d');
    if (ctx) redrawAll(ctx, shapes);
  }, [shapes, editorOpen]);

  // ── Editor openen/sluiten ─────────────────────────────────────────────────

  const openEditor = () => setEditorOpen(true);

  const closeEditor = useCallback(async () => {
    setEditorOpen(false);
    setTextInput(null);
    setTextValue('');
    if (canvasRef.current) {
      try {
        const flat = await flattenToPng(screenshotDataUrl, canvasRef.current);
        setThumbnailUrl(flat);
        onChange(flat);
      } catch {
        onChange(screenshotDataUrl);
      }
    } else {
      onChange(screenshotDataUrl);
    }
  }, [screenshotDataUrl, onChange]);

  // Escape-handler voor de grote editor.
  // CAPTURE-fase + stopPropagation: anders vangt FeedbackDialog's eigen
  // Escape-handler (op document, bubble) het óók op en sluit de HELE dialoog
  // i.p.v. alleen de editor — waarmee de ingetypte titel/omschrijving verloren
  // gaat. Capture-listeners op document vuren vóór bubble-listeners, ongeacht
  // registratievolgorde, dus deze wint.
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
        void closeEditor();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [editorOpen, textInput, closeEditor]);

  // ── Annotatie-muisgebeurtenissen ──────────────────────────────────────────

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const pos = canvasPos(canvasRef.current, e);

    if (activeTool === 'text') {
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
    } else if (activeTool === 'pen') {
      currentShape.current = { kind: 'pen', points: [pos], color: activeColor };
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !canvasRef.current || !currentShape.current) return;
    const pos = canvasPos(canvasRef.current, e);
    const s = currentShape.current;

    if (s.kind === 'arrow') s.to = pos;
    else if (s.kind === 'rect') s.to = pos;
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
      {/* Thumbnail met zweef-overlay "Annoteren" */}
      <div className="screenshot-annotator-thumbnail">
        <img
          src={thumbnailUrl}
          className="screenshot-annotator-thumb-img"
          alt=""
          draggable={false}
        />
        <button
          className="screenshot-annotator-open-btn"
          onClick={openEditor}
          title={t('feedback.annotate')}
        >
          <Pencil size={16} />
          <span>{t('feedback.annotate')}</span>
        </button>
      </div>

      {/* Bijna-schermvullende editor-overlay */}
      {editorOpen && (
        <div
          className="annotator-editor-backdrop"
          onClick={() => void closeEditor()}
        >
          <div
            className="annotator-editor"
            onClick={e => e.stopPropagation()}
          >
            {/* Toolbar */}
            <div className="annotator-editor-toolbar">
              <button
                className={`feedback-ann-btn${activeTool === 'arrow' ? ' active' : ''}`}
                title={t('feedback.tools.arrow')}
                onClick={() => setActiveTool('arrow')}
              >
                <ArrowUpRight size={16} />
              </button>
              <button
                className={`feedback-ann-btn${activeTool === 'rectangle' ? ' active' : ''}`}
                title={t('feedback.tools.rectangle')}
                onClick={() => setActiveTool('rectangle')}
              >
                <Square size={16} />
              </button>
              <button
                className={`feedback-ann-btn${activeTool === 'pen' ? ' active' : ''}`}
                title={t('feedback.tools.pen')}
                onClick={() => setActiveTool('pen')}
              >
                <Pen size={16} />
              </button>
              <button
                className={`feedback-ann-btn${activeTool === 'text' ? ' active' : ''}`}
                title={t('feedback.tools.text')}
                onClick={() => setActiveTool('text')}
              >
                <Type size={16} />
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
                <Undo2 size={16} />
              </button>
              <button
                className="feedback-ann-btn"
                title={t('feedback.tools.clear')}
                onClick={handleClear}
                disabled={shapes.length === 0}
              >
                <Trash2 size={16} />
              </button>

              <div className="annotator-toolbar-spacer" />

              <button
                className="btn btn--sm btn--primary"
                onClick={() => void closeEditor()}
              >
                {t('feedback.editorDone')}
              </button>
            </div>

            {/* Canvas-ruimte */}
            <div className="annotator-canvas-area">
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
                      fontSize: `${textInput.fontSize}px`,
                      color: textInput.color,
                    }}
                    value={textValue}
                    onChange={e => setTextValue(e.target.value)}
                    onKeyDown={onTextKeyDown}
                    onBlur={commitTextInput}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
