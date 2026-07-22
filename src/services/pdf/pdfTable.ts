/**
 * `PdfTable` — generieke, data-gedreven tabel-render voor het `renderReport`-patroon (§ fase 3
 * vector-PDF-export). Tekent tegen `Draw2D` (net als `printPreview.renderReport` voor de Gantt),
 * zodat `paginateVectorToPdfBytes` 'm kan pagineren zonder aparte code-paden: dit bestand levert
 * alleen een `(makeDraw2D) => RenderReportResult`-functie, precies het contract dat de vector-
 * pagineerder al van de Gantt-render kent.
 *
 * Vervangt de DOM-screenshot (`modern-screenshot`) voor de mijlpalen-/afwijkingenrapporten door
 * échte vector-tekst — de renderer hieronder is puur data → tekening, dus deterministisch en
 * onafhankelijk van het geladen thema (bewust altijd wit/donker-op-wit: een PDF is een papieren
 * artefact, geen thema-weergave).
 */
import type { Draw2D } from './draw2d';
import type { RenderReportResult } from '@/services/print/printPreview';

export type PdfTableAlign = 'left' | 'right' | 'center';

export interface PdfTableColumn<Row> {
  /** Kolomkop-tekst (al vertaald door de aanroeper — deze module doet geen i18n). */
  header: string;
  /** Kolombreedte in logische px (zelfde eenheid als de Gantt-render — zie `printPreview.ts`). */
  width: number;
  align: PdfTableAlign;
  /** Celtekst voor deze rij (al geformatteerd door de aanroeper — datums/afkortingen/…). */
  text(row: Row): string;
  /** Optionele celkleur (CSS-kleur, bv. een statusbadge of rood bij negatieve speling); `undefined`
   * (of geen `color`-functie) valt terug op de standaard tekstkleur. */
  color?(row: Row): string | undefined;
  /** Optioneel vetgedrukt (bv. status-badges, of speling/delta < 0 resp. > 0). */
  bold?(row: Row): boolean;
}

export interface PdfTableSpec<Row> {
  /** Optionele titel boven de tabel (spiegelt de DOM `<h3 class="ui-card-header">`). */
  title?: string;
  columns: PdfTableColumn<Row>[];
  rows: Row[];
  /** Tekst voor de lege-staat-rij (spiegelt de DOM `rows.length === 0`-rij). */
  emptyText?: string;
}

// Zelfde gevendorde Inter-familie als de Gantt-render (printPreview.ts) — deterministisch en
// inbedbaar, zodat measureText/vector-embedding identiek zijn (§5.1/§5.2 ontwerpdoc).
const FONT_FAMILY = 'InterPDF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** Print-kleurenschema — puur wit-op-papier, GEEN thema-afhankelijkheid (dit is het hele punt: de
 * DOM-screenshot moest een thema forceren, de vector-tekening hoeft dat niet). */
const COLORS = {
  bg: '#ffffff',
  text: '#111827',
  textMuted: '#6b7280', // spiegelt --theme-text-muted (headers)
  textDim: '#9ca3af',   // spiegelt --theme-text-dim (lege-staat-tekst)
  headerBorder: '#9ca3af', // spiegelt de DOM 2px solid var(--theme-border)
  rowBorder: '#e5e7eb',    // spiegelt de DOM 1px solid var(--theme-border-light)
};

const TITLE_FONT_SIZE = 15;
const HEADER_FONT_SIZE = 11;
const BODY_FONT_SIZE = 11;
const CELL_PAD_X = 8;
const ROW_HEIGHT = 26;
const HEADER_HEIGHT = 30;
const TITLE_HEIGHT = 36;
const TITLE_BASELINE_GAP = 12; // afstand van de titel-baseline tot de onderkant van het titelblok

/**
 * Kort `text` in met een ellipsis zodat het binnen `maxWidth` past (zelfde binaire-zoek-strategie
 * als `fitText` in `printPreview.ts`, hier lokaal gehouden om deze module zelfstandig te houden).
 */
function fitText(d2d: Draw2D, text: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  if (d2d.measureText(text).width <= maxWidth) return text;
  const ellipsis = '…';
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (d2d.measureText(text.slice(0, mid) + ellipsis).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  if (lo === 0) return d2d.measureText(ellipsis).width <= maxWidth ? ellipsis : '';
  return text.slice(0, lo) + ellipsis;
}

function cellX(align: PdfTableAlign, colX: number, colW: number): number {
  if (align === 'left') return colX + CELL_PAD_X;
  if (align === 'right') return colX + colW - CELL_PAD_X;
  return colX + colW / 2;
}

/**
 * Bouw een `renderReport`-compatibele render-functie uit een generieke tabel-spec. Roept
 * `makeDraw2D` exact één keer aan (G1-conventie van de vector-pagineerder) zodra de totale
 * (kolom-som) breedte + hoogte (titel + header + rijen×rijhoogte) bekend zijn.
 *
 * Retourneert `tableWidth: 0` — tabellen hebben geen bevroren-kolom (ze tegelen fit-width, 1 kolom
 * breed; de vector-pagineerder herhaalt de bevroren-strip alleen in `'actual'`-modus).
 */
export function makeTableRenderReport<Row>(
  spec: PdfTableSpec<Row>,
): (makeDraw2D: (w: number, h: number) => Draw2D) => RenderReportResult {
  return (makeDraw2D) => {
    const tableWidth = spec.columns.reduce((sum, c) => sum + c.width, 0);
    const titleH = spec.title ? TITLE_HEIGHT : 0;
    const rowCount = spec.rows.length === 0 ? 1 : spec.rows.length;
    const height = titleH + HEADER_HEIGHT + rowCount * ROW_HEIGHT;

    const d2d = makeDraw2D(tableWidth, height);

    // Achtergrond — altijd wit (print-artefact, geen thema).
    d2d.fillStyle = COLORS.bg;
    d2d.fillRect(0, 0, tableWidth, height);

    let y = 0;

    if (spec.title) {
      d2d.fillStyle = COLORS.text;
      d2d.font = `bold ${TITLE_FONT_SIZE}px ${FONT_FAMILY}`;
      d2d.textAlign = 'left';
      d2d.textBaseline = 'alphabetic';
      d2d.fillText(spec.title, 0, titleH - TITLE_BASELINE_GAP);
      y = titleH;
    }

    // ---- Header-rij (bold, 2px onderlijn — spiegelt de DOM `2px solid var(--theme-border)`) ----
    let x = 0;
    d2d.font = `bold ${HEADER_FONT_SIZE}px ${FONT_FAMILY}`;
    d2d.fillStyle = COLORS.textMuted;
    d2d.textBaseline = 'middle';
    const headerMidY = y + HEADER_HEIGHT / 2;
    for (const col of spec.columns) {
      d2d.textAlign = col.align;
      const avail = col.width - 2 * CELL_PAD_X;
      d2d.fillText(fitText(d2d, col.header, avail), cellX(col.align, x, col.width), headerMidY);
      x += col.width;
    }
    d2d.strokeStyle = COLORS.headerBorder;
    d2d.lineWidth = 2;
    d2d.beginPath();
    d2d.moveTo(0, y + HEADER_HEIGHT);
    d2d.lineTo(tableWidth, y + HEADER_HEIGHT);
    d2d.stroke();
    y += HEADER_HEIGHT;

    // ---- Data-rijen (of lege-staat) ----
    if (spec.rows.length === 0) {
      d2d.fillStyle = COLORS.textDim;
      d2d.font = `${BODY_FONT_SIZE}px ${FONT_FAMILY}`;
      d2d.textAlign = 'left';
      d2d.textBaseline = 'middle';
      d2d.fillText(spec.emptyText ?? '', CELL_PAD_X, y + ROW_HEIGHT / 2);
      y += ROW_HEIGHT;
    } else {
      for (const row of spec.rows) {
        let cx = 0;
        const midY = y + ROW_HEIGHT / 2;
        for (const col of spec.columns) {
          const bold = col.bold?.(row) ?? false;
          const color = col.color?.(row) ?? COLORS.text;
          d2d.font = `${bold ? 'bold ' : ''}${BODY_FONT_SIZE}px ${FONT_FAMILY}`;
          d2d.fillStyle = color;
          d2d.textAlign = col.align;
          d2d.textBaseline = 'middle';
          const avail = col.width - 2 * CELL_PAD_X;
          d2d.fillText(fitText(d2d, col.text(row), avail), cellX(col.align, cx, col.width), midY);
          cx += col.width;
        }
        d2d.strokeStyle = COLORS.rowBorder;
        d2d.lineWidth = 1;
        d2d.beginPath();
        d2d.moveTo(0, y + ROW_HEIGHT);
        d2d.lineTo(tableWidth, y + ROW_HEIGHT);
        d2d.stroke();
        y += ROW_HEIGHT;
      }
    }

    d2d.textAlign = 'left';
    d2d.textBaseline = 'alphabetic';

    return { width: tableWidth, height, tableWidth: 0 };
  };
}
