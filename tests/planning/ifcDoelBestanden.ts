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
