// Proefvorm van het letterlijk gemeten sjabloon; onafhankelijk van de herkenning in de productcode.
export const oudeKop = (name: string, author = 'Aannemer', company = 'Bouwbedrijf Van Dijk BV') =>
  "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [SchedulingView]'),'2;1');\n"
  + `FILE_NAME('${name}.ifc','2026-01-15T12:00:00',('${author}'),('${company}'),'Open Planner Studio 0.1','Open Planner Studio','');\n`
  + "FILE_SCHEMA(('IFC4X3'));\nENDSEC;\nDATA;\n";
export const oudeKopVelden: Array<[string, string, string]> = [
  ...['DATA;', 'ENDSEC;'].flatMap(token => {
    const value = `O'Hara ${token} Fase 1`;
    return [[value, 'Aannemer', 'Bouwbedrijf Van Dijk BV'], ["O'Hara Tower", value, 'Bouwbedrijf Van Dijk BV'],
      ["O'Hara Tower", 'Aannemer', value], [value, value, value]] as Array<[string, string, string]>;
  }),
  ["O'Hara; Noord", 'Aannemer', 'Bouwbedrijf Van Dijk BV'],
];
export const oudeWand = "#999999=IFCWALL('0abcdefghijkmnopqrstuv',$,'Wand',$,$,$,$,$,$);\n";
