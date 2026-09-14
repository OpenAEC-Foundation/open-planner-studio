// Issue #27 etappe 3 (T2): de kolomherkenning van het voortgangsblad, formaat-AGNOSTISCH gelift uit
// `parseProgressCsv.ts`. Zowel de CSV- als de XLSX-lezer gebruikt deze ene tabel en deze ene
// matchregel; zou de xlsx-lezer ze kopiëren, dan loopt hij stil uit de pas zodra er een alias
// bijkomt. Niets in dit bestand weet van CSV, delimiters, ZIP of XML.

// Detectie-only kolommen (start/finish) staan bewust in dezelfde tabel: ze worden hieronder
// herkend als elke andere kolom, maar landen NOOIT in `RawProgressRow` — alleen in
// `detectionCells` (A5.4). Dat is een structurele garantie: er bestaat geen veld in het
// rij-contract dat een Start/Finish-waarde zou kunnen dragen.
export const PROGRESS_COLUMN_ALIASES: Record<string, readonly string[]> = {
  taskId: ['ops task id', 'ops taskid', 'task id'],
  wbs: ['wbs', 'wbs code', 'wbscode'],
  name: ['name', 'task name', 'naam', 'taak'],
  completion: ['completion', 'completion (%)', '% complete', 'percent', 'voltooiing'],
  actualStart: ['actual start', 'actualstart', 'werkelijke start'],
  actualFinish: ['actual finish', 'actualfinish', 'werkelijk einde', 'werkelijke einde'],
  start: ['start', 'start date', 'begin', 'startdatum'],
  finish: ['finish', 'finish date', 'end', 'end date', 'eind', 'einddatum'],
};

// Besluit 2026-09-05 (punt D, gebruikstest — letterlijke wens: "er moet ook in de headers van de
// kolommen komen te staan wat je in mag voeren en waar je af moet blijven"): het geëxporteerde
// voortgangsblad (`writeProgressSheetCSV`) draagt per kolom een invulinstructie NA de sleutel,
// gescheiden door ` — ` (`<sleutel> — <instructie>`). De vroegste van deze drie markers snijdt
// dus de instructie van de sleutel af: `HEADER_INSTRUCTION_MARKERS`.
export const HEADER_INSTRUCTION_MARKERS = [' — ', ' - ', '('];

/**
 * Matcht één kopcel op zijn kolomsleutel. Eerst EXACT tegen `PROGRESS_COLUMN_ALIASES` (bestaand gedrag,
 * dekt zowel oude bladen als de volledige CSV-export). Lukt dat niet, dan is de terugval het
 * PREFIX vóór de vroegste instructiemarker: dat vangt `OPS Task ID — niet wijzigen` op, en ook
 * `Completion (%) — invullen: …` — het haakje van "(%)" zelf ligt vóór de "—", dus de afgesneden
 * prefix wordt "completion", een bestaande alias (E6/A5.6-notitie: geen aparte "haakjes"-uitzondering
 * nodig, de bestaande exacte alias "completion" vangt dat al op). Geen van beide treft ⇒ geen kolom.
 */
export function matchColumnKey(header: string): string | undefined {
  const h = header.toLowerCase().trim();
  for (const [key, aliases] of Object.entries(PROGRESS_COLUMN_ALIASES)) {
    if (aliases.includes(h)) return key;
  }
  let cut = -1;
  for (const marker of HEADER_INSTRUCTION_MARKERS) {
    const idx = h.indexOf(marker);
    if (idx >= 0 && (cut === -1 || idx < cut)) cut = idx;
  }
  if (cut <= 0) return undefined; // geen marker, of de sleutel zelf zou leeg zijn.
  const prefix = h.slice(0, cut).trim();
  for (const [key, aliases] of Object.entries(PROGRESS_COLUMN_ALIASES)) {
    if (aliases.includes(prefix)) return key;
  }
  return undefined;
}

export function mapColumnIndex(headers: readonly string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    const key = matchColumnKey(headers[i]);
    if (key !== undefined) map[key] = i;
  }
  return map;
}

/** Trimt en begrenst een rauwe celwaarde. Overschrijding is een WEIGERING (het veld wordt
 *  afwezig — "telt als leeg"), NOOIT een stille afkapping: een afgekapt id/waarde kan per ongeluk
 *  een andere taak matchen dan de gebruiker bedoelde (hardening-checklist). */
export function boundedCell(raw: string | undefined, maxChars: number): string | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > maxChars) return undefined;
  return trimmed;
}

export function hasControlChar(value: string): boolean {
  return Array.from(value).some(ch => {
    const code = ch.codePointAt(0) ?? 0;
    return code <= 31 || code === 127;
  });
}
