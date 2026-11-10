// #804 fase 1a, fixronde 4: de bestanden van de reviewers voor de doelcontrole. Gedeeld door
// `check-ifc-target-model-scan.ts` (de scanner zelf) en `check-ifc-foreign-target.ts` (de echte opslagroutes), zodat
// beide checks precies dezelfde bestanden gebruiken.

/** De oude ongebalanceerde apostrof in `FILE_NAME`: oude eigen bestanden zetten de naam rauw in de kop. */
export const brokenHeader = (text: string) => text.replace(/FILE_NAME\('[^']*'/, "FILE_NAME('Van 't Hof.ifc'");

/** Terra (BLOKKEERT 1): `model-ifc4.ifc` met een kapotte kop, en alle entiteiten na `DATA;` op één regel. */
export function terraFile(model: string): string {
  const text = brokenHeader(model);
  const data = /^DATA;/m.exec(text)!.index + 'DATA;'.length;
  const end = text.lastIndexOf('ENDSEC;');
  return text.slice(0, data) + text.slice(data, end).replace(/\r?\n/g, '') + '\n' + text.slice(end);
}

/** Sol (BLOKKEERT 1b): `model-ifc4.ifc` met een kapotte kop, en een regeleinde tussen `=` en het type van de wand. */
export const solFile = (model: string) => brokenHeader(model).replace('#30=IFCWALL(', '#30=\nIFCWALL(');

/**
 * Sol's vorm op elke entiteit: na de kapotte kop staat elk type op de regel na `#n=`. Met alleen `#30` gesplitst ziet
 * de scanner van 343b74300 nog `#18=IFCSITE(` aan het begin van een regel; zo geeft hij "no-model", zoals Sol meldde.
 */
export const solFileAllSplit = (model: string) => brokenHeader(model).replace(/^(#\d+)=/gm, '$1=\n');

/** Sol (VERVOLG 2b): een eigen bestand met na `DATA;` geldig commentaar waarin een modelregel staat. */
export const commentFile = (own: string) => own.replace(/^DATA;\r?\n/m, line => `${line}/*\n#900000=IFCWALL(\n*/\n`);

/** Terra (VERVOLG 2): een eigen bestand met een tekstproperty waarin een regel `#9=IFCWALL(` staat. */
export const stringFile = (own: string) => own.replace(/^DATA;\r?\n/m,
  line => `${line}#9999999=IFCPROPERTYSINGLEVALUE('Notitie',$,IFCTEXT('regel 1\n#9=IFCWALL(\nregel 3'),$);\n`);

/**
 * Sol en Terra (review van #870, BLOKKEERT): `council/fix3-twee-data.ifc` met parameters bij BEIDE sectiekoppen
 * (ISO 10303-21 editie 3, implementatieniveau `3;1`). Vóór de fix herkende de gedeelde sectievinder alleen `DATA;`:
 * `readIFC` gaf `no-data-section` en de doelcontrole "no-model", dus Opslaan als schreef over de wand heen.
 */
export function paramDataFile(twoData: string, separator = '', only?: 'first'): string {
  let n = 0;
  return twoData.replace("'2;1'", "'3;1'").replace(/^DATA;$/gm,
    line => (only === 'first' && n > 0 ? line : `DATA${separator}('deel ${++n}',('IFC4X3_ADD2'));`));
}

/**
 * De vormen van de DATA-sectiekop volgens ISO 10303-21 (eis van Trias, wrakko 10 november 2026, na review van #870 ronde
 * 1 tot 3). De grammatica: `data_section = "DATA" [ "(" parameter_list ")" ] ";" entity_instance_list "ENDSEC;"`, en een
 * datasectie volgt op `ENDSEC;` van de kop of van de vorige sectie. Tussen twee tokens mag witruimte staan (spatie, tab,
 * regeleindes) en commentaar `/* … *\/`. Een sleutelwoord is in de norm in hoofdletters (`standard_keyword = UPPER { UPPER |
 * DIGIT }`); `readIFC` las altijd hoofdletterongevoelig. Die vormen staan erin met `buitenNorm`: de scanner achter de
 * flag volgt de norm en weigert ze, en valt dan terug op de gewone route (`ifcBytesRoute.ts`). De
 * parameters (editie 3) zijn een naam en een lijst schema's: strings en haakjes, met witruimte en commentaar ertussen.
 *
 * `kop` vervangt elke `DATA;` direct na `ENDSEC;` en een regeleinde; `{n}` is het nummer van de sectie. `overgang`
 * vervangt de `ENDSEC;` en het regeleinde ervoor. Bij een vorm met parameters wordt het implementatieniveau `'3;1'`.
 * Elke vorm gaat door de vinder (`check-ifc-target-model-scan.ts`), de modelweigering (`check-ifc-building-model-guard.ts`),
 * het openen met en zonder flag (`check-ifc-foreign-open.ts`) en de doelcontrole van Opslaan als, CSV en AutoSave
 * (`check-ifc-foreign-target.ts`).
 */
export interface DataKopVorm { id: string; norm: string; kop: string; overgang?: string; buitenNorm?: true }
const P = "('deel {n}',('IFC4X3_ADD2'))";
export const DATA_KOP_VORMEN: readonly DataKopVorm[] = [
  { id: 'kaal', norm: 'zonder parameters', kop: 'DATA;' },
  { id: 'kaal-klein', norm: 'zonder parameters, kleine letters', kop: 'data;', buitenNorm: true },
  { id: 'kaal-spatie', norm: 'witruimte vóór ;', kop: 'DATA ;' },
  { id: 'kaal-tab', norm: 'tab vóór ;', kop: 'DATA\t;' },
  { id: 'kaal-lf', norm: 'regeleinde vóór ;', kop: 'DATA\n;' },
  { id: 'kaal-crlf', norm: 'CRLF vóór ;', kop: 'DATA\r\n;' },
  { id: 'kaal-commentaar', norm: 'commentaar vóór ;', kop: 'DATA/*c*/;' },
  { id: 'kaal-gemengd', norm: 'witruimte, commentaar en regeleinde vóór ;', kop: 'DATA /*c*/ \n ;' },
  { id: 'param', norm: 'met parameters', kop: `DATA${P};` },
  { id: 'param-klein', norm: 'met parameters, kleine letters', kop: `data${P};`, buitenNorm: true },
  { id: 'param-spatie', norm: 'witruimte vóór (', kop: `DATA ${P};` },
  { id: 'param-tab', norm: 'tab vóór (', kop: `DATA\t${P};` },
  { id: 'param-lf', norm: 'regeleinde vóór (', kop: `DATA\n${P};` },
  { id: 'param-crlf', norm: 'CRLF en inspringing vóór (', kop: `DATA\r\n  ${P};` },
  { id: 'param-commentaar', norm: 'commentaar vóór (', kop: `DATA/*c*/${P};` },
  { id: 'param-gemengd', norm: 'witruimte, commentaar en regeleinde vóór (', kop: `DATA /*c*/\n/*d*/ ${P};` },
  { id: 'param-ruimte-binnen', norm: 'witruimte tussen de parameters en vóór ;', kop: "DATA( 'deel {n}' , ( 'IFC4X3_ADD2' ) ) ;" },
  { id: 'param-commentaar-binnen', norm: 'commentaar tussen de parameters en vóór ;', kop: "DATA(/*a*/'deel {n}'/*b*/,/*c*/('IFC4X3_ADD2')/*d*/)/*e*/;" },
  { id: 'param-lijst', norm: "meer schema's in de lijst", kop: "DATA('deel {n}',('IFC4X3_ADD2','IFC4'));" },
  { id: 'param-string-lastig', norm: "string met '', DATA(, ENDSEC; en een entiteit", kop: "DATA('deel {n}''s DATA( ENDSEC; #9=IFCWALL($);',('IFC4X3_ADD2'));" },
  { id: 'param-commentaar-lastig', norm: 'commentaar met DATA; en ENDSEC;', kop: `DATA/* DATA; ENDSEC; */${P};` },
  { id: 'na-endsec-direct', norm: 'geen witruimte na ENDSEC;', kop: `DATA${P};`, overgang: 'ENDSEC;' },
  { id: 'na-endsec-commentaar', norm: 'commentaar en witruimte na ENDSEC;', kop: `DATA${P};`, overgang: 'ENDSEC; /*c*/ \n ' },
  { id: 'na-endsec-spatie', norm: 'witruimte vóór de ; van ENDSEC', kop: `DATA ${P};`, overgang: 'ENDSEC ;\n' },
  { id: 'na-endsec-commentaar-binnen', norm: 'commentaar vóór de ; van ENDSEC', kop: `DATA${P};`, overgang: 'ENDSEC/*c*/;\n' },
  { id: 'na-endsec-klein', norm: 'endsec; in kleine letters', kop: `DATA ${P};`, overgang: 'endsec;\n', buitenNorm: true },
];

/** `text` met elke `ENDSEC;` + regeleinde + `DATA;` in de vorm `vorm` (`alleen: 'eerste'`: alleen de eerste kop). */
export function metDataKop(text: string, vorm: DataKopVorm, alleen?: 'eerste'): string {
  let n = 0;
  const out = text.replace(/ENDSEC;(\r?\n)DATA;/g, (whole, eol: string) => {
    if (alleen === 'eerste' && n > 0) return whole;
    n++;
    return (vorm.overgang ?? `ENDSEC;${eol}`) + vorm.kop.split('{n}').join(String(n));
  });
  return vorm.kop.includes('(') ? out.replace("'2;1'", "'3;1'") : out;
}

/** Elke vorm uit `DATA_KOP_VORMEN` op `text`; bij meer secties ook gemengd: alleen de eerste kop in die vorm. */
export function dataKopBestanden(text: string, welke: 'alle' | 'norm' | 'buitenNorm' = 'alle'): Array<[string, string]> {
  const sections = text.match(/ENDSEC;\r?\nDATA;/g)?.length ?? 0;
  const vormen = DATA_KOP_VORMEN.filter(v => welke === 'alle' || (welke === 'buitenNorm') === (v.buitenNorm === true));
  return vormen.flatMap(vorm => [
    [vorm.id, metDataKop(text, vorm)] as [string, string],
    ...(sections > 1 ? [[`${vorm.id}-eerste`, metDataKop(text, vorm, 'eerste')] as [string, string]] : []),
  ]);
}

/** Waar de eerste sectiekop in `metDataKop(text, vorm)` begint (de `D`) en waar de lezer verder gaat (na de `;` of `(`). */
export function dataKopGrens(text: string, vorm: DataKopVorm): { at: number; end: number } {
  const at = /ENDSEC;\r?\nDATA;/.exec(text)!.index + (vorm.overgang ?? 'ENDSEC;\n').length;
  const kop = vorm.kop.split('{n}').join('1');
  return { at, end: at + (kop.includes('(') ? kop.indexOf('(') : kop.indexOf(';')) + 1 };
}

/** Sol en Terra (review van #870, ronde 3, BLOKKEERT): een oude, rauw geschreven bestandsnaam met één apostrof en een
 *  sectiekop-achtige tekst erin. De apostrof draait de stringtoestand om; in ronde 3 werd `DATA (` in de naam de
 *  sectiekop, en opende een bestaande planning met nul taken, zonder schema en zonder modelweigering. */
export const brokenNameFiles = (text: string): Array<[string, string]> => [
  ['naam-spatie', text.replace(/FILE_NAME\('[^']*'/, "FILE_NAME('Van 't Hof DATA (bouw).ifc'")],
  ['naam-haakje', text.replace(/FILE_NAME\('[^']*'/, "FILE_NAME('Van 't DATA( toren.ifc'")],
  ['naam-commentaar', text.replace(/FILE_NAME\('[^']*'/, "FILE_NAME('Van 't DATA/*x*/(b.ifc'")],
  ['naam-puntkomma', text.replace(/FILE_NAME\('[^']*'/, "FILE_NAME('Van 't Hof; DATA (bouw).ifc'")],
];
