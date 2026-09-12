/**
 * De `.xlsx`-schrijver voor het voortgangsblad (issue #27, etappe 3 — taak T6).
 *
 * Waarom dit bestaat (eigenaarsbesluit E9, 2026-09-11): de letterlijke wens was *"de kolommen in de
 * csv moeten net zo breed zijn als de tekst die erin staat"*. Een CSV kán dat niet — geen breedte,
 * geen opmaak, geen celtype. Dit blad doet wat E9 werkelijk vraagt: kolommen op maat, alleen de
 * invulcellen bewerkbaar, een percentage dat buiten 0–100 geweigerd wordt, en datums die als
 * **datum** in de cel staan zodat de terugimport nooit de dag/maand-vraag hoeft te stellen.
 *
 * De schrijver blijft **puur**: geen store, geen React, geen `@tauri-apps/*`, geen i18n. Alle
 * gebruikerszichtbare tekst komt van buiten via `ProgressXlsxText`, precies zoals
 * `writeProgressSheetCSV(tasks, headerNotes, summaryNote)` dat al doet. De rijvolgorde, de acht
 * kolomsleutels, de em-dash-markering van verzameltaken en de instructie-in-de-kopcel zijn
 * letterlijk hetzelfde als in de CSV — dit is een tweede SCHRIJVER op dezelfde afspraken, geen
 * tweede formaatdefinitie.
 *
 * ## De valstrikken die dit bestand dragen
 *
 * 1. **OOXML-schema's zijn `xsd:sequence`, geen `xsd:all`.** Een element op de verkeerde plek geeft
 *    geen nette foutmelding maar "Excel heeft onleesbare inhoud gevonden". `CT_Worksheet` eist
 *    `dimension → sheetViews → sheetFormatPr → cols → sheetData → sheetProtection → dataValidations`
 *    (X4); `CT_Stylesheet` eist `numFmts → fonts → fills → borders → cellStyleXfs → cellXfs →
 *    cellStyles → dxfs → tableStyles`. `buildProgressXlsxParts` is daarom geëxporteerd: de
 *    structurele test asserteert die volgordes zónder een ZIP te hoeven uitpakken.
 * 2. **Twee fills, en de tweede MOET `gray125` zijn.** Een historische Excel-quirk. Laat je hem weg,
 *    dan schuiven alle fill-indexen op en kleurt het blad verkeerd. Dat is meteen de reden dat de
 *    grijze verzamelrij-markering diezelfde `gray125` hergebruikt in plaats van een derde fill toe te
 *    voegen: één fill minder om verkeerd te indexeren.
 * 3. **De polariteit van `sheetProtection` is omgekeerd aan wat je verwacht: `1` betekent VERBODEN.**
 *    `selectLockedCells="0"` betekent dus "vergrendelde cellen mág je selecteren" (nodig om te lezen
 *    en te kopiëren) en `formatColumns="0"` betekent "kolombreedte aanpassen mág". Een omgedraaide
 *    boolean levert een blad op dat precies het omgekeerde doet van wat de eigenaar vroeg, zónder dat
 *    er iets stukgaat — daarom staat hier een test op, en daarom is dit de enige plek in etappe 3 met
 *    een verplichte handmatige controle in een echte spreadsheet.
 * 4. **De instructietekst telt NIET mee in de kolombreedte.** Zou hij dat wel doen, dan werd elke
 *    kolom 70+ tekens breed en zag de invuller nog vier kolommen op zijn scherm — het tegenovergestelde
 *    van E9. De breedte volgt de data plus de kále kolomsleutel; de kopcel krijgt `wrapText` en de
 *    kopregel een vaste hoogte, zodat de instructie zichtbaar blijft zonder de kolom op te blazen.
 * 5. **Percentages gaan hier WÉL met decimalen** (X6/Q2). Besluit A1 (hele procenten in de CSV)
 *    bestond om precies één reden: "8,38" werd door een programma met een andere landinstelling als
 *    838 gelezen. In een `.xlsx`-cel staat een getal, geen tekst — die valstrik bestaat daar domweg
 *    niet. Gevolg: een taak op 1/3 komt exact als no-op terug waar de CSV-round-trip een
 *    afrondingsverlies heeft.
 * 6. **Geen `sharedStrings`-part** (bewust buiten scope): `t="inlineStr"` scheelt een part en een
 *    indirectie. De LEZER moet `sharedStrings` wél aankunnen, want Excel herschrijft het bestand bij
 *    opslaan en gebruikt dan vrijwel altijd wél zo'n part.
 */
import type { Task } from '@/types/task';
import type { ProgressSheetColumnKey } from '@/services/csv/csvWriter';
import { escapeXmlText, escapeXmlAttr } from '@/services/xlsx/xmlText';
import { isoToSerial } from '@/services/xlsx/serialDate';
import { writeZip } from '@/services/zip/zipWriter';

/** Alle gebruikerszichtbare tekst komt van BUITEN; de schrijver blijft puur (geen i18n in `services/`). */
export interface ProgressXlsxText {
  /** Instructie per kolomsleutel, ` — ` achter de kale sleutel geplakt (E8) — zelfde bron als de CSV. */
  headerNotes?: Partial<Record<ProgressSheetColumnKey, string>>;
  /** Markeertekst voor de drie invulcellen van een verzameltaak; MOET met een em-dash beginnen. */
  summaryNote?: string;
  /** Bladnaam in de werkmap; wordt gesaneerd naar wat Excel toelaat. */
  sheetName?: string;
  /** De vier teksten van de invoervalidatie (titels + foutmeldingen). */
  validation?: { percentTitle: string; percentError: string; dateTitle: string; dateError: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Kolommen
// ─────────────────────────────────────────────────────────────────────────────

type ColumnKind = 'text' | 'date' | 'percent';

interface ColumnSpec {
  key: ProgressSheetColumnKey;
  kind: ColumnKind;
  /** Invulkolom (ontgrendeld) of alleen-lezen kolom (vergrendeld onder de bladbeveiliging). */
  editable: boolean;
}

/** Exact de acht kolommen van `writeProgressSheetCSV`, in dezelfde volgorde. */
const COLUMNS: readonly ColumnSpec[] = [
  { key: 'OPS Task ID', kind: 'text', editable: false },
  { key: 'WBS', kind: 'text', editable: false },
  { key: 'Name', kind: 'text', editable: false },
  { key: 'Start', kind: 'date', editable: false },
  { key: 'Finish', kind: 'date', editable: false },
  { key: 'Completion (%)', kind: 'percent', editable: true },
  { key: 'Actual Start', kind: 'date', editable: true },
  { key: 'Actual Finish', kind: 'date', editable: true },
];

/** 0-gebaseerde kolomindex → `A`, `B`, … `AA`. */
function columnLetter(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stijlen (X5 — bewust geteld: tien `cellXfs`, waarvan vier ontgrendeld)
// ─────────────────────────────────────────────────────────────────────────────

const STYLE = {
  /** 0 — kaal, alleen voor cellen zonder eigen betekenis. */ default: 0,
  /** 1 — kopcel: vet, `wrapText`, vergrendeld. */            header: 1,
  /** 2 — alleen-lezen tekst. */                              roText: 2,
  /** 3 — alleen-lezen datum (`numFmt` 164). */               roDate: 3,
  /** 4 — alleen-lezen datumtijd (`numFmt` 165). */           roDateTime: 4,
  /** 5 — invul-tekst (ontgrendeld). */                       fillText: 5,
  /** 6 — invul-percentage (ontgrendeld, `numFmt` 166). */    fillPercent: 6,
  /** 7 — invul-datum (ontgrendeld, `numFmt` 164). */         fillDate: 7,
  /** 8 — invul-datumtijd (ontgrendeld, `numFmt` 165). */     fillDateTime: 8,
  /** 9 — verzamelrij-markering: vergrendeld ondanks de ontgrendelde kolom, grijze fill. */ summary: 9,
} as const;

/**
 * De kolomstijl staat óók op `<col>`, niet alleen op de cellen. Dat is geen dubbelop: zonder
 * kolomstijl is de kolom ónder de laatste rij vergrendeld en tekstueel opgemaakt, en erft een lege
 * invulcel zónder eigen `<c>` niets. De per-cel stijl blijft desondanks nodig, want een
 * verzameltaakrij moet binnen een ontgrendelde kolom juist vergrendeld zijn.
 */
function columnStyle(col: ColumnSpec): number {
  if (!col.editable) return col.kind === 'date' ? STYLE.roDate : STYLE.roText;
  if (col.kind === 'percent') return STYLE.fillPercent;
  if (col.kind === 'date') return STYLE.fillDate;
  return STYLE.fillText;
}

// ─────────────────────────────────────────────────────────────────────────────
// Waarden
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Percentage met vier decimalen (X6). `completion` is 0..1; de cel draagt 0..100 als GETAL, dus de
 * landinstellingen-valstrik van de CSV bestaat hier niet. Buiten bereik wordt geklemd in plaats van
 * geweigerd: dit is een export van eigen state, geen invoer.
 */
function percentValue(completion: number): number {
  if (!Number.isFinite(completion)) return 0;
  const clamped = Math.min(1, Math.max(0, completion));
  return Math.round(clamped * 1_000_000) / 10_000;
}

/** Serieel getal zonder drijvende-komma-ruis in het bestand (`46000.35416666666` → `46000.354167`). */
function serialText(serial: number): string {
  if (Number.isInteger(serial)) return String(serial);
  return String(Number(serial.toFixed(6)));
}

/** De tekst zoals de invuller hem in de cel ziet — de maat voor de kolombreedte. */
function displayText(kind: ColumnKind, raw: string): string {
  if (kind !== 'date') return raw;
  const serial = isoToSerial(raw);
  if (serial === undefined) return raw;
  return Number.isInteger(serial) ? '0000-00-00' : '0000-00-00 00:00';
}

// ─────────────────────────────────────────────────────────────────────────────
// Celbouw
// ─────────────────────────────────────────────────────────────────────────────

function inlineStringCell(ref: string, style: number, value: string): string {
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXmlText(value)}</t></is></c>`;
}

function numberCell(ref: string, style: number, value: string): string {
  return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
}

/**
 * Eén datacel. Een lege waarde levert **geen** `<c>` op: de cel erft dan de kolomstijl, wat precies
 * de bedoeling is (ontgrendeld en als datum opgemaakt voor de invulkolommen).
 *
 * Een datumwaarde die `isoToSerial` niet kan lezen valt terug op een tekstcel — nooit op een geraden
 * datum. Dat kan alleen bij state die zelf al kapot is; stil een getal verzinnen zou precies de
 * onzichtbare verkeerde datum opleveren die besluit E5 verbiedt.
 */
function dataCell(ref: string, col: ColumnSpec, raw: string, marked: boolean): string {
  if (marked) return raw ? inlineStringCell(ref, STYLE.summary, raw) : '';
  if (!raw) return '';
  if (col.kind === 'date') {
    const serial = isoToSerial(raw);
    if (serial === undefined) {
      return inlineStringCell(ref, col.editable ? STYLE.fillText : STYLE.roText, raw);
    }
    const dated = Number.isInteger(serial)
      ? (col.editable ? STYLE.fillDate : STYLE.roDate)
      : (col.editable ? STYLE.fillDateTime : STYLE.roDateTime);
    return numberCell(ref, dated, serialText(serial));
  }
  if (col.kind === 'percent') return numberCell(ref, STYLE.fillPercent, raw);
  return inlineStringCell(ref, col.editable ? STYLE.fillText : STYLE.roText, raw);
}

/** De acht rauwe celwaarden van één taak, in kolomvolgorde — spiegelt `writeProgressSheetCSV`. */
function rowValues(task: Task, marked: boolean, summaryNote: string): readonly string[] {
  return [
    task.id,
    task.wbsCode,
    task.name,
    task.time.earlyStart || task.time.scheduleStart,
    task.time.earlyFinish || task.time.scheduleFinish,
    marked ? summaryNote : String(percentValue(task.time.completion)),
    marked ? summaryNote : (task.time.actualStart ?? ''),
    marked ? summaryNote : (task.time.actualFinish ?? ''),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Parts
// ─────────────────────────────────────────────────────────────────────────────

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Excel weigert `[]:*?/\` in een bladnaam, kapt op 31 tekens en houdt niet van een lege naam. */
function sanitizeSheetName(name: string | undefined): string {
  const cleaned = (name ?? '')
    .replace(/[[\]:*?/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31)
    .replace(/^'+|'+$/g, '')
    .trim();
  return cleaned.length > 0 ? cleaned : 'Progress';
}

/**
 * `w ≈ maxTekenlengte × 1.05 + 2`, geklemd op `[10, 46]`. De eenheid is "aantal `0`-tekens in het
 * standaardlettertype"; de factor is de gebruikelijke marge voor niet-cijfertekens, de `+2` de
 * celpadding. De klem voorkomt zowel een onleesbaar smalle als een schermvullende kolom.
 */
function columnWidth(maxChars: number): number {
  const raw = maxChars * 1.05 + 2;
  return Math.round(Math.min(46, Math.max(10, raw)) * 100) / 100;
}

function buildContentTypes(): string {
  return `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '</Types>';
}

function buildRootRels(): string {
  return `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>`
    + '</Relationships>';
}

function buildWorkbook(sheetName: string): string {
  return `${XML_DECL}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">`
    + `<sheets><sheet name="${escapeXmlAttr(sheetName)}" sheetId="1" r:id="rId1"/></sheets>`
    + '</workbook>';
}

function buildWorkbookRels(): string {
  return `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>`
    + `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/>`
    + '</Relationships>';
}

/**
 * De stijlen. De kindvolgorde van `CT_Stylesheet` is een `xsd:sequence`; de verplichte minima
 * (≥ 1 font, ≥ 2 fills met `gray125` als tweede, ≥ 1 border, ≥ 1 `cellStyleXfs`) legt Excel nergens
 * uit maar eist het wel. Elk `count`-attribuut moet kloppen met het werkelijke aantal kinderen.
 */
function buildStyles(): string {
  const numFmts = [
    '<numFmt numFmtId="164" formatCode="yyyy-mm-dd"/>',
    '<numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm"/>',
    '<numFmt numFmtId="166" formatCode="0.####"/>',
  ];
  const fonts = [
    '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>',
    '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>',
  ];
  // Fill 1 is `gray125`: verplicht aanwezig én meteen de grijze markering van de verzamelrijen.
  const fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
  ];
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  const cellStyleXfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>'];

  const xf = (opts: {
    numFmtId?: number; fontId?: number; fillId?: number; unlocked?: boolean; wrap?: boolean;
  }): string => {
    const numFmtId = opts.numFmtId ?? 0;
    const head = [
      `<xf numFmtId="${numFmtId}" fontId="${opts.fontId ?? 0}" fillId="${opts.fillId ?? 0}" borderId="0" xfId="0"`,
      numFmtId !== 0 ? ' applyNumberFormat="1"' : '',
      opts.fontId ? ' applyFont="1"' : '',
      opts.fillId ? ' applyFill="1"' : '',
      opts.wrap ? ' applyAlignment="1"' : '',
      opts.unlocked ? ' applyProtection="1"' : '',
    ].join('');
    // `CT_Xf` is óók een sequence: `alignment` vóór `protection`.
    const children = `${opts.wrap ? '<alignment vertical="top" wrapText="1"/>' : ''}`
      + `${opts.unlocked ? '<protection locked="0"/>' : ''}`;
    return children ? `${head}>${children}</xf>` : `${head}/>`;
  };

  const cellXfs = [
    xf({}),                                                    // 0 standaard
    xf({ fontId: 1, wrap: true }),                             // 1 kop
    xf({}),                                                    // 2 alleen-lezen tekst
    xf({ numFmtId: 164 }),                                     // 3 alleen-lezen datum
    xf({ numFmtId: 165 }),                                     // 4 alleen-lezen datumtijd
    xf({ unlocked: true }),                                    // 5 invul-tekst
    xf({ numFmtId: 166, unlocked: true }),                     // 6 invul-percentage
    xf({ numFmtId: 164, unlocked: true }),                     // 7 invul-datum
    xf({ numFmtId: 165, unlocked: true }),                     // 8 invul-datumtijd
    xf({ fillId: 1, wrap: true }),                             // 9 verzamelrij-markering
  ];

  const group = (tag: string, items: readonly string[]): string =>
    `<${tag} count="${items.length}">${items.join('')}</${tag}>`;

  return `${XML_DECL}<styleSheet xmlns="${NS_MAIN}">`
    + group('numFmts', numFmts)
    + group('fonts', fonts)
    + group('fills', fills)
    + group('borders', borders)
    + group('cellStyleXfs', cellStyleXfs)
    + group('cellXfs', cellXfs)
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '<dxfs count="0"/>'
    + '<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>'
    + '</styleSheet>';
}

/** Eén `dataValidation`. Lege teksten worden weggelaten in plaats van als lege attributen geschreven. */
function validationXml(opts: {
  type: 'decimal' | 'date';
  sqref: string;
  f1: string;
  f2: string;
  title?: string;
  error?: string;
  prompt?: string;
}): string {
  const attrs = [
    `type="${opts.type}"`,
    'operator="between"',
    // BINDEND: leeg betekent "geen wijziging" (Q1 van etappe 2). Een lege cel mag nooit een
    // foutmelding geven, anders zou een blad met één ingevulde rij onbruikbaar zijn.
    'allowBlank="1"',
    `showInputMessage="${opts.prompt ? '1' : '0'}"`,
    'showErrorMessage="1"',
    'errorStyle="stop"',
  ];
  if (opts.title) attrs.push(`errorTitle="${escapeXmlAttr(opts.title)}"`);
  if (opts.error) attrs.push(`error="${escapeXmlAttr(opts.error)}"`);
  if (opts.prompt) {
    if (opts.title) attrs.push(`promptTitle="${escapeXmlAttr(opts.title)}"`);
    attrs.push(`prompt="${escapeXmlAttr(opts.prompt)}"`);
  }
  attrs.push(`sqref="${opts.sqref}"`);
  return `<dataValidation ${attrs.join(' ')}><formula1>${opts.f1}</formula1><formula2>${opts.f2}</formula2></dataValidation>`;
}

function buildWorksheet(tasks: readonly Task[], text: ProgressXlsxText): string {
  const notes = text.headerNotes;
  const summaryNote = text.summaryNote;
  const headers = COLUMNS.map(col => {
    const note = notes?.[col.key];
    return note ? `${col.key} — ${note}` : col.key;
  });

  // ── breedtes ───────────────────────────────────────────────────────────────
  // De KALE sleutel telt mee, de instructie niet (X5). Zie de moduledoc, valstrik 4.
  const maxChars = COLUMNS.map(col => col.key.length);
  for (const task of tasks) {
    const marked = summaryNote !== undefined && task.childIds.length > 0;
    const values = rowValues(task, marked, summaryNote ?? '');
    COLUMNS.forEach((col, i) => {
      // De verzamelrij-markering telt om dezelfde reden NIET mee als de kopinstructie: het is een
      // mededeling van tientallen tekens, geen data. Zou hij meetellen, dan liepen de drie
      // invulkolommen meteen tegen de klem van 46 aan en was E9 juist in de kolommen waar het om
      // gaat ongedaan gemaakt. De cel zelf blijft de volle tekst dragen (Excel laat hem overlopen
      // in de lege buurcel), alleen de BREEDTE volgt de echte waarden.
      if (marked && col.editable) return;
      const shown = displayText(col.kind, values[i] ?? '');
      if (shown.length > (maxChars[i] ?? 0)) maxChars[i] = shown.length;
    });
  }
  const cols = COLUMNS.map((col, i) => {
    const n = i + 1;
    return `<col min="${n}" max="${n}" width="${columnWidth(maxChars[i] ?? 0)}" customWidth="1" style="${columnStyle(col)}"/>`;
  }).join('');

  // ── rijen ──────────────────────────────────────────────────────────────────
  const headerCells = headers
    .map((h, i) => inlineStringCell(`${columnLetter(i)}1`, STYLE.header, h))
    .join('');
  // Vaste kophoogte: de instructie mag wrappen zonder de kolom breed te maken.
  const rows = [`<row r="1" ht="46" customHeight="1">${headerCells}</row>`];

  tasks.forEach((task, index) => {
    const rowNumber = index + 2;
    const marked = summaryNote !== undefined && task.childIds.length > 0;
    const values = rowValues(task, marked, summaryNote ?? '');
    const cells = COLUMNS.map((col, i) =>
      dataCell(`${columnLetter(i)}${rowNumber}`, col, values[i] ?? '', marked && col.editable),
    ).join('');
    rows.push(`<row r="${rowNumber}">${cells}</row>`);
  });

  // ── validatiebereik ────────────────────────────────────────────────────────
  // Begrensd tot de werkelijke laatste rij — géén open `F2:F1048576`. Bij een leeg project blijft
  // rij 2 staan, anders zou `F2:F1` een ongeldig bereik zijn.
  const lastRow = Math.max(2, tasks.length + 1);
  const validations = [
    validationXml({
      type: 'decimal', sqref: `F2:F${lastRow}`, f1: '0', f2: '100',
      title: text.validation?.percentTitle, error: text.validation?.percentError,
      prompt: notes?.['Completion (%)'],
    }),
    validationXml({
      // 1 = 1900-01-01, 2958465 = 9999-12-31: de volle datumruimte van Excel.
      type: 'date', sqref: `G2:H${lastRow}`, f1: '1', f2: '2958465',
      title: text.validation?.dateTitle, error: text.validation?.dateError,
      prompt: notes?.['Actual Start'],
    }),
  ];

  const lastCol = columnLetter(COLUMNS.length - 1);
  return `${XML_DECL}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">`
    + `<dimension ref="A1:${lastCol}${lastRow}"/>`
    // `CT_SheetView` is ook een sequence: `pane` vóór `selection`.
    + '<sheetViews><sheetView tabSelected="1" workbookViewId="0">'
    + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
    + '<selection pane="bottomLeft" activeCell="F2" sqref="F2"/>'
    + '</sheetView></sheetViews>'
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + `<cols>${cols}</cols>`
    + `<sheetData>${rows.join('')}</sheetData>`
    // Let op de polariteit: 1 = VERBODEN. Zie de moduledoc, valstrik 3.
    + '<sheetProtection sheet="1" selectLockedCells="0" selectUnlockedCells="0" formatColumns="0" formatRows="0"/>'
    + `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>`
    + '</worksheet>';
}

/**
 * Bouwt de zes parts als losse, leesbare XML-strings — geëxporteerd zodat de structurele test de
 * kindvolgordes kan asserteren ZONDER een ZIP te hoeven uitpakken.
 *
 * `[Content_Types].xml` staat vooraan. Dat is geen spec-eis, maar wel wat elke echte OOXML-schrijver
 * doet, en sommige strikte consumers leunen erop.
 */
export function buildProgressXlsxParts(
  tasks: readonly Task[],
  text: ProgressXlsxText = {},
): readonly { name: string; xml: string }[] {
  return [
    { name: '[Content_Types].xml', xml: buildContentTypes() },
    { name: '_rels/.rels', xml: buildRootRels() },
    { name: 'xl/workbook.xml', xml: buildWorkbook(sanitizeSheetName(text.sheetName)) },
    { name: 'xl/_rels/workbook.xml.rels', xml: buildWorkbookRels() },
    { name: 'xl/worksheets/sheet1.xml', xml: buildWorksheet(tasks, text) },
    { name: 'xl/styles.xml', xml: buildStyles() },
  ];
}

/** Verpakt de zes parts tot een `.xlsx`. Deterministisch: `writeZip` gebruikt een vaste DOS-datum. */
export async function writeProgressSheetXLSX(
  tasks: readonly Task[],
  text: ProgressXlsxText = {},
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const files = buildProgressXlsxParts(tasks, text).map(part => ({
    name: part.name,
    data: encoder.encode(part.xml),
  }));
  return writeZip(files);
}
