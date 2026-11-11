import { REPORT_PAGE_TEXT_RULE, reportFontRule } from '@/services/pdf/svgDraw2d';

// De letterregels van het papier (issue #817): één `<style>` in het document voor alle bladen, in plaats
// van een `<style>` per blad. Een nieuwe `<style>` laat de browser het hele document opnieuw opmaken; bij
// elk blad dat in beeld kwam kostte dat 5 tot 15 ms. Een regel per letter komt er alleen bij als een
// opname een nieuwe letter gebruikt (een andere rapportletter of lettergrootte).

const known = new Set<string>();
let sheet: CSSStyleSheet | null = null;

function paperSheet(): CSSStyleSheet | null {
  if (sheet?.ownerNode?.isConnected) return sheet;
  known.clear();
  const style = document.createElement('style');
  style.dataset.opsReportPaperFonts = '';
  style.textContent = REPORT_PAGE_TEXT_RULE;
  document.head.appendChild(style);
  sheet = style.sheet;
  return sheet;
}

/** Zorgt dat elke letter van een opname een regel heeft (`reportFontClass` in de SVG van een blad). */
export function ensurePaperFontRules(fonts: readonly string[]): void {
  if (fonts.every(font => known.has(font)) && sheet?.ownerNode?.isConnected) return;
  const target = paperSheet();
  if (!target) return;
  for (const font of fonts) {
    if (known.has(font)) continue;
    target.insertRule(reportFontRule(font), target.cssRules.length);
    known.add(font);
  }
}
