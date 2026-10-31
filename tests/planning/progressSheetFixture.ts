// Testgereedschap: een voortgangsblad als leesbare tekst (`;` tussen cellen, één regel per rij) in
// plaats van een binaire werkmap. `sheetFromText` loopt langs de echte kolomherkenning
// (`sheetColumns.ts`) zonder ZIP, voor batterijen die het plan toetsen. `xlsxFromText` maakt er een
// echt `.xlsx` van met alleen tekstcellen, voor de echte lezer en de echte bestandskiezer.

import { escapeXmlAttr, escapeXmlText } from '@/services/xlsx/xmlText';
import { writeZip } from '@/services/zip';
import { collectProgressRows, mapColumnIndex, progressHeaderIssue, refuseSheet } from '@/services/progressImport/sheetColumns';
import { PROGRESS_IMPORT_LIMITS, type ProgressImportLimits, type ProgressSheet } from '@/services/progressImport/types';

interface TextRow { rowNumber: number; texts: string[] }

/** Niet-lege regels met hun echte regelnummer: de koprij is rij 1, net als in een spreadsheet. */
function textRows(text: string): TextRow[] {
  return text.split(/\r?\n/)
    .map((line, index) => ({ rowNumber: index + 1, line }))
    .filter(({ line }) => line.trim().length > 0)
    .map(({ rowNumber, line }) => ({ rowNumber, texts: line.split(';') }));
}

export function sheetFromText(text: string, limits: ProgressImportLimits = PROGRESS_IMPORT_LIMITS): ProgressSheet {
  const [header, ...data] = textRows(text);
  if (header === undefined) return refuseSheet('noKeyColumn');
  const colMap = mapColumnIndex(header.texts);
  const issue = progressHeaderIssue(colMap, data.length, limits);
  return issue ? refuseSheet(issue) : collectProgressRows(data, colMap, limits);
}

function columnLetter(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : `A${String.fromCharCode(65 + index - 26)}`;
}

/** Een `.xlsx` met alleen tekstcellen, zoals een spreadsheet die een datum als tekst bewaart. */
export async function xlsxFromText(text: string): Promise<Uint8Array> {
  const decl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const rows = textRows(text).map(({ rowNumber, texts }) => {
    const cells = texts.map((value, col) => (value === ''
      ? ''
      : `<c r="${columnLetter(col)}${rowNumber}" t="inlineStr"><is><t>${escapeXmlText(value)}</t></is></c>`));
    return `<row r="${rowNumber}">${cells.join('')}</row>`;
  });
  const parts: Record<string, string> = {
    '[Content_Types].xml': `${decl}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '</Types>',
    '_rels/.rels': `${decl}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${decl}<workbook xmlns="${main}" xmlns:r="${rel}"><sheets>`
      + `<sheet name="${escapeXmlAttr('Blad')}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `${decl}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `${decl}<worksheet xmlns="${main}"><sheetData>${rows.join('')}</sheetData></worksheet>`,
  };
  const encoder = new TextEncoder();
  return writeZip(Object.entries(parts).map(([name, xml]) => ({ name, data: encoder.encode(xml) })));
}
