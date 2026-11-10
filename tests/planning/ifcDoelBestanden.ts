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

/** Sol en Terra (review van #870, ronde 2, BLOKKEERT): ISO 10303-21 staat witruimte en commentaar toe tussen `DATA` en
 *  `(`. De varianten van `paramDataFile` met zo'n scheiding, en een gemengde: alleen de eerste kop `DATA (…)`, de tweede
 *  een gewone `DATA;`. */
export const separatedDataFiles = (twoData: string): Array<[string, string]> => [
  ['spatie', paramDataFile(twoData, ' ')],
  ['commentaar', paramDataFile(twoData, '/*scheiding*/')],
  ['regeleinde', paramDataFile(twoData, '\n')],
  ['gemengd', paramDataFile(twoData, ' ', 'first')],
];

/** Sol en Terra (review van #870, ronde 3, BLOKKEERT): een oude, rauw geschreven bestandsnaam met één apostrof en een
 *  sectiekop-achtige tekst erin. De apostrof draait de stringtoestand om; in ronde 3 werd `DATA (` in de naam de
 *  sectiekop, en opende een bestaande planning met nul taken, zonder schema en zonder modelweigering. */
export const brokenNameFiles = (text: string): Array<[string, string]> => [
  ['naam-spatie', text.replace(/FILE_NAME\('[^']*'/, "FILE_NAME('Van 't Hof DATA (bouw).ifc'")],
  ['naam-haakje', text.replace(/FILE_NAME\('[^']*'/, "FILE_NAME('Van 't DATA( toren.ifc'")],
  ['naam-commentaar', text.replace(/FILE_NAME\('[^']*'/, "FILE_NAME('Van 't DATA/*x*/(b.ifc'")],
  ['naam-puntkomma', text.replace(/FILE_NAME\('[^']*'/, "FILE_NAME('Van 't Hof; DATA (bouw).ifc'")],
];
