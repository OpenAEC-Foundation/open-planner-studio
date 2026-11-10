// De kop van een kolom uit het kolomregister, vertaald. Gedeeld door het taakraster (`FullTaskGrid`)
// en de Gantt-afdruk (Rapport-tabblad, issue #817), zodat een kolom op papier dezelfde kop draagt als
// in de tabel.

/** Oudere vertaalsleutels die al een tekst hebben voor dezelfde kolomkop. */
export const COLUMN_LABEL_ALIASES: Readonly<Record<string, string>> = {
  'taskGrid.columns.wbs': 'table.wbs',
  'taskGrid.columns.name': 'table.name',
  'taskGrid.columns.description': 'properties.description',
  'taskGrid.columns.duration': 'table.duration',
  'taskGrid.columns.scheduleStart': 'table.start',
  'taskGrid.columns.scheduleFinish': 'table.finish',
  'taskGrid.columns.taskType': 'table.type',
  'taskGrid.columns.critical': 'table.critical',
  'taskGrid.columns.totalFloat': 'table.totalFloat',
  'taskGrid.columns.freeFloat': 'table.freeFloat',
  'taskGrid.columns.interferingFloat': 'table.interferingFloat',
  'taskGrid.columns.nearCritical': 'table.isNearCritical',
  'taskGrid.columns.floatPath': 'table.floatPath',
  'taskGrid.columns.completion': 'table.completion',
  'taskGrid.columns.milestone': 'table.milestone',
  'taskGrid.columns.milestoneKind': 'properties.milestoneKind',
  'taskGrid.columns.mandatoryMilestone': 'properties.mandatory',
  'taskGrid.columns.constraintType': 'properties.constraint',
  'taskGrid.columns.constraintDate': 'properties.constraintDate',
  'taskGrid.columns.constraint2Type': 'properties.constraint2',
  'taskGrid.columns.constraint2Date': 'properties.constraint2Date',
  'taskGrid.columns.hammock': 'properties.hammock',
  'taskGrid.columns.deadline': 'properties.deadline',
  'taskGrid.columns.actualStart': 'properties.progress.actualStart',
  'taskGrid.columns.actualFinish': 'properties.progress.actualFinish',
  'taskGrid.columns.remainingTime': 'properties.progress.remaining',
};

/** Een leesbare kop uit de laatste sleuteldeel, als er geen vertaling is (`lateStart` → "Late start"). */
export function humanizeTaskGridKey(labelKey: string): string {
  const parts = labelKey.split('.');
  const leaf = parts[parts.length - 1] ?? labelKey;
  const words = leaf
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\bid\b/gi, 'ID')
    .replace(/\bwbs\b/gi, 'WBS')
    .replace(/\bcpm\b/gi, 'CPM');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Vertaalt de sleutel van een kolomkop, met een leesbare terugval als een vertaling ontbreekt. Krijgt
 *  alleen vertaalsleutels: namen die de gebruiker gaf (codes, eigen velden, baselines) zet
 *  `taskColumnLabel` letterlijk in de kop, zodat ze nooit door `t()` of `humanizeTaskGridKey` gaan. */
export function resolveColumnLabel(labelKey: string, translate: (key: string) => string): string {
  const direct = translate(labelKey);
  if (direct !== labelKey) return direct;
  const alias = COLUMN_LABEL_ALIASES[labelKey];
  if (alias) {
    const translatedAlias = translate(alias);
    if (translatedAlias !== alias) return translatedAlias;
  }
  return humanizeTaskGridKey(labelKey);
}
