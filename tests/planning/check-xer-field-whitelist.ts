import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import type * as TS from 'typescript';
const ts = createRequire(import.meta.url)('typescript') as typeof TS;

const diffs: string[] = [];
let checks = 0;
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};

export const XER_TASK_WHITELIST = [
  'task_id', 'task_code', 'task_name', 'wbs_id', 'clndr_id', 'proj_id', 'guid', 'rsrc_id',
  'status_code', 'task_type', 'duration_type', 'priority_type',
  'complete_pct_type', 'complete_pct', 'phys_complete_pct',
  'act_start_date', 'act_end_date',
  'target_drtn_hr_cnt', 'remain_drtn_hr_cnt',
  'target_start_date', 'target_end_date',
  'target_work_qty', 'remain_work_qty', 'act_work_qty', 'act_this_per_work_qty',
  'target_equip_qty', 'remain_equip_qty', 'act_equip_qty', 'act_this_per_equip_qty',
  'cstr_type', 'cstr_date', 'cstr_type2', 'cstr_date2',
  'suspend_date', 'resume_date',
  'task_notes', 'constraint_type',
  'expect_end_date',
] as const;

export const XER_TASK_FORBIDDEN = [
  'restart_date', 'reend_date',
  'rem_late_start_date', 'rem_late_end_date',
  'driving_path_flag',
  'float_path', 'float_path_order',
  'old_restart_date', 'old_reend_date', 'old_remain_drtn_hr_cnt',
  'crt_path_num',
  'critical_drtn_hr_cnt',
  'act_drtn_hr_cnt',
  'plan_start_date', 'plan_end_date',
] as const;

export const XER_TASK_EXTERNAL_DEPENDENCY_PROXY = [
  'external_early_start_date', 'external_late_end_date',
] as const;

export const XER_TASK_RECORDED_OUTPUT = [
  'early_start_date', 'early_end_date', 'late_start_date', 'late_end_date',
  'total_float_hr_cnt', 'free_float_hr_cnt',
] as const;

export const XER_TASK_IGNORED_PROVISIONAL = [
  'est_wt', 'review_type', 'tmpl_guid',
] as const;

export const XER_TASK_IGNORED_OTHER = [
  'create_date', 'update_date', 'create_user', 'update_user',
  'rev_fdbk_flag', 'lock_plan_flag', 'auto_compute_act_flag',
  'remain_cost', 'plan_cost', 'act_cost',
  'review_end_date', 'location_id',
  'target_qty_per_hr', 'act_reg_qty', 'act_ot_qty',
] as const;

export const XER_TASK_IGNORED_PSEUDO_XER = [
  'Task_ID', 'Task_Name', 'Start_Date', 'Duration', 'Status',
  'start_date', 'end_date', 'duration', 'calendar_id', 'total_float', 'free_float',
] as const;

export const XER_TASK_IGNORED_TRAILING_TAB = [''] as const;

export const XER_TASK_IGNORED: readonly string[] = [
  ...XER_TASK_IGNORED_PROVISIONAL,
  ...XER_TASK_IGNORED_OTHER,
  ...XER_TASK_IGNORED_PSEUDO_XER,
  ...XER_TASK_IGNORED_TRAILING_TAB,
];

{
  const buckets: [string, readonly string[]][] = [
    ['whitelist', XER_TASK_WHITELIST],
    ['forbidden', XER_TASK_FORBIDDEN],
    ['external-dependency-proxy', XER_TASK_EXTERNAL_DEPENDENCY_PROXY],
    ['recorded-output', XER_TASK_RECORDED_OUTPUT],
    ['ignored', XER_TASK_IGNORED],
  ];
  truthy('bak 4 draagt exact de zes P6-rekenuitvoerkolommen (corpusvrije verankering)',
    JSON.stringify([...XER_TASK_RECORDED_OUTPUT].sort()) === JSON.stringify([
      'early_end_date', 'early_start_date', 'free_float_hr_cnt', 'late_end_date', 'late_start_date',
      'total_float_hr_cnt',
    ]));

  for (const [name, list] of buckets) {
    const seen = new Set<string>();
    for (const f of list) {
      truthy(`geen dubbele entry "${f}" binnen ${name}`, !seen.has(f));
      seen.add(f);
    }
  }
  const bucketSets = buckets.map(([name, list]) => [name, new Set(list)] as const);
  for (let i = 0; i < bucketSets.length; i++) {
    const [nameA, setA] = bucketSets[i];
    for (let j = i + 1; j < bucketSets.length; j++) {
      const [nameB, setB] = bucketSets[j];
      for (const f of setA) {
        truthy(`"${f}" (${nameA}) staat niet óók in ${nameB}`, !setB.has(f));
      }
    }
  }
}

{
  const kandidaten = [
    fileURLToPath(new URL('../../src/', import.meta.url).href),
    resolvePath(process.cwd(), 'src'),
  ];
  const srcRoot = kandidaten.find((p) => existsSync(p)) ?? null;
  truthy(`isolatiescan vindt src/ (geprobeerd: ${kandidaten.join(', ')})`, srcRoot !== null);

  if (srcRoot) {
    const xerDir = join(srcRoot, 'services', 'xer');
    truthy(`isolatiescan vindt ${xerDir}`, existsSync(xerDir));

    if (existsSync(xerDir)) {
      const xerFiles: string[] = [];
      const loop = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name);
          if (entry.isDirectory()) loop(full);
          else if (/\.tsx?$/.test(entry.name)) xerFiles.push(full);
        }
      };
      loop(srcRoot);
      truthy('isolatiescan leest een plausibel aantal bestanden in src/', xerFiles.length > 100);

      const toegestaan = join(xerDir, 'xerRecordedTimes.ts');
      const readsField = (text: string, field: string): boolean => {
        const cellAccess = new RegExp(`cells(?:\\.${field}\\b|\\[['"]${field}['"]\\])`);
        const callArg = new RegExp(`\\([^()\\n]*['"]${field}['"]\\s*[,)]`);
        const destructure = new RegExp(`\\{[^{}]*\\b${field}\\b[^{}]*\\}\\s*=`);
        return cellAccess.test(text) || callArg.test(text) || destructure.test(text);
      };
      const overtreders: string[] = [];
      for (const file of xerFiles) {
        if (file === toegestaan) continue;
        const text = readFileSync(file, 'utf8');
        for (const field of XER_TASK_RECORDED_OUTPUT) {
          if (readsField(text, field)) overtreders.push(`${field} in ${file.slice(srcRoot.length)}`);
        }
      }
      checks++;
      if (overtreders.length > 0) {
        diffs.push(
          `isolatiescan: BAK-4-kolommen worden buiten xerRecordedTimes.ts gelezen — ${overtreders.join(', ')}`,
        );
      }

      truthy('isolatiescan herkent de M-B-mutant (conditionele celtoegang)',
        readsField("const x = row.cells.task_type === 'TT_Rsrc' && row.cells.restart_date ? 1 : 2;", 'restart_date'));
      truthy('isolatiescan herkent een aanroepargument op een niet-laatste positie',
        readsField("ctx.numberOf(row, 'restart_date', 0)", 'restart_date'));
      truthy('isolatiescan herkent destructurering',
        readsField('const { restart_date: r } = row.cells;', 'restart_date'));
      truthy('isolatiescan negeert kale lijst-lidmaatschap',
        !readsField("const F = new Set([\n  'a',\n  'restart_date',\n  'b',\n]);", 'restart_date'));

      const bak2Toegestaan: ReadonlyArray<{ field: string; file: string; exact: RegExp }> = [
        { field: 'plan_end_date', file: join(xerDir, 'xerReader.ts'), exact: /projectRow\.cells\.plan_end_date\b/ },
        { field: 'plan_start_date', file: join(xerDir, 'xerReader.ts'), exact: /projectRow\.cells\.plan_start_date\b/ },
        { field: 'critical_drtn_hr_cnt', file: join(xerDir, 'xerScheduleOptions.ts'), exact: /row\.cells\.critical_drtn_hr_cnt\b/ },
      ];
      const bak2Overtreders: string[] = [];
      for (const file of xerFiles) {
        const text = readFileSync(file, 'utf8');
        for (const field of XER_TASK_FORBIDDEN) {
          if (!readsField(text, field)) continue;
          const uitzondering = bak2Toegestaan.find(entry => entry.field === field && entry.file === file);
          if (uitzondering) {
            const rest = text.replace(new RegExp(uitzondering.exact.source, 'g'), '');
            if (!readsField(rest, field)) continue;
          }
          bak2Overtreders.push(`${field} in ${file.slice(srcRoot.length)}`);
        }
      }
      checks++;
      if (bak2Overtreders.length > 0) {
        diffs.push(`sluiproute-grep: BAK-2-kolommen (verboden rekenuitvoer) worden in src/ gelezen — ${bak2Overtreders.join(', ')}`);
      }
      for (const entry of bak2Toegestaan) {
        truthy(`sluiproute-grep: toegestane andere-tabel-lezing van ${entry.field} bestaat nog in ${entry.file.slice(srcRoot.length)}`,
          existsSync(entry.file) && entry.exact.test(readFileSync(entry.file, 'utf8')));
      }
    }
  }
}

type AstHit = { field: string; kind: 'identifier' | 'literal'; context: string; line: number };

function astFieldHits(fileName: string, text: string, fields: readonly string[]): AstHit[] {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  const fieldSet = new Set(fields);
  const wordPatterns = fields.map(field => ({ field, re: new RegExp(`(?<![A-Za-z0-9_])${field}(?![A-Za-z0-9_])`) }));
  const hits: AstHit[] = [];
  const lineOf = (node: TS.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const contextOf = (node: TS.Node): string => {
    const parent = node.parent;
    if (parent && ts.isPropertyAccessExpression(parent) && parent.name === node) {
      return `access:${parent.expression.getText(source)}`;
    }
    if (parent && ts.isArrayLiteralExpression(parent)) {
      const path: string[] = [];
      let cur: TS.Node | undefined = parent.parent;
      while (cur && !ts.isSourceFile(cur)) {
        if (ts.isPropertyAssignment(cur)) path.unshift(cur.name.getText(source));
        if (ts.isVariableDeclaration(cur)) { path.unshift(cur.name.getText(source)); break; }
        if (ts.isBlock(cur) || ts.isFunctionLike(cur)) break;
        cur = cur.parent;
      }
      return `catalog:${path.join('.')}`;
    }
    return `other:${ts.SyntaxKind[parent?.kind ?? ts.SyntaxKind.Unknown]}`;
  };
  const visit = (node: TS.Node): void => {
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
      if (fieldSet.has(node.text)) hits.push({ field: node.text, kind: 'identifier', context: contextOf(node), line: lineOf(node) });
    } else if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      for (const { field, re } of wordPatterns) {
        if (re.test(node.text)) hits.push({ field, kind: 'literal', context: contextOf(node), line: lineOf(node) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

{
  const kandidaten = [
    fileURLToPath(new URL('../../src/', import.meta.url).href),
    resolvePath(process.cwd(), 'src'),
  ];
  const srcRoot = kandidaten.find((p) => existsSync(p)) ?? null;
  truthy('AST-poort vindt src/', srcRoot !== null);

  const mutanten: ReadonlyArray<[string, string]> = [
    ['alias', 'const c = row.cells; const rd = c.restart_date;'],
    ['optional chaining', 'const rd = row.cells?.restart_date;'],
    ['variabele sleutel', "const k = 'restart_date'; const rd = row.cells[k];"],
    ['template-literal', 'const rd = row.cells[`restart_date`];'],
    ['string-literal-index', "const rd = row.cells['restart_date'];"],
    ['destructurering', 'const { restart_date: rd } = row.cells;'],
    ['template met interpolatie', 'const rd = row.cells[`restart_date${suffix}`];'],
  ];
  for (const [naam, code] of mutanten) {
    truthy(`AST-poort herkent de mutant "${naam}"`,
      astFieldHits('mutant.ts', code, XER_TASK_FORBIDDEN).some(hit => hit.field === 'restart_date'));
  }
  truthy('AST-poort negeert commentaar',
    astFieldHits('comment.ts', '// row.cells.restart_date\n/* row.cells.plan_end_date */ const x = 1;', XER_TASK_FORBIDDEN).length === 0);
  truthy('AST-poort negeert een langere naam die de kolomnaam als deelstring draagt',
    astFieldHits('substr.ts', "const x = row.cells.old_restart_date_x; const y = 'my_restart_date';", ['restart_date']).length === 0);

  if (srcRoot) {
    const files: string[] = [];
    const loop = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) loop(full);
        else if (/\.(?:ts|tsx|mts)$/.test(entry.name)) files.push(full);
      }
    };
    loop(srcRoot);
    truthy('AST-poort leest een plausibel aantal bestanden in src/', files.length > 100);

    const rel = (file: string) => file.slice(srcRoot.length).split('\\').join('/');
    const verboden = [...XER_TASK_FORBIDDEN, ...XER_TASK_EXTERNAL_DEPENDENCY_PROXY];
    type Uitzondering = { file: string; field: string; context: string; count: number; waarom: string };
    const uitzonderingen: Uitzondering[] = [
      { file: 'services/xer/xerReader.ts', field: 'plan_end_date', context: 'access:projectRow.cells', count: 1,
        waarom: 'PROJECT-tabel (niet TASK): het geplande projecteinde voor useProjectEndDateForFloat, X5' },
      { file: 'services/xer/xerReader.ts', field: 'plan_start_date', context: 'access:projectRow.cells', count: 1,
        waarom: 'PROJECT-tabel (niet TASK): geplande projectstart als anker voor een ontbrekende target_start_date, review PR #109 N1' },
      { file: 'services/xer/xerScheduleOptions.ts', field: 'critical_drtn_hr_cnt', context: 'access:row.cells', count: 1,
        waarom: 'SCHEDOPTIONS-tabel: de kritiek-drempel in uren, X5' },
      { file: 'services/xer/xerTables.ts', field: 'plan_end_date', context: 'catalog:XER_KNOWN_FIELDS_BY_TABLE.PROJECT', count: 1,
        waarom: 'bekende-veldencatalogus van de PROJECT-tabel' },
      { file: 'services/xer/xerTables.ts', field: 'critical_drtn_hr_cnt', context: 'catalog:XER_KNOWN_FIELDS_BY_TABLE.PROJECT', count: 1,
        waarom: 'bekende-veldencatalogus van de PROJECT-tabel' },
      { file: 'services/xer/xerTables.ts', field: 'critical_drtn_hr_cnt', context: 'catalog:XER_DECIMAL_FIELDS', count: 1,
        waarom: 'getalformaatclassificatie over alle tabellen, geen celtoegang' },
      { file: 'services/xer/xerTables.ts', field: 'act_drtn_hr_cnt', context: 'catalog:XER_DECIMAL_FIELDS', count: 1,
        waarom: 'getalformaatclassificatie over alle tabellen, geen celtoegang' },
      { file: 'services/xer/xerTables.ts', field: 'old_remain_drtn_hr_cnt', context: 'catalog:XER_DECIMAL_FIELDS', count: 1,
        waarom: 'getalformaatclassificatie over alle tabellen, geen celtoegang' },
      { file: 'services/xer/xerTables.ts', field: 'total_float_hr_cnt', context: 'catalog:XER_DECIMAL_FIELDS', count: 1,
        waarom: 'bak 4, getalformaatclassificatie over alle tabellen, geen celtoegang' },
      { file: 'services/xer/xerTables.ts', field: 'free_float_hr_cnt', context: 'catalog:XER_DECIMAL_FIELDS', count: 1,
        waarom: 'bak 4, getalformaatclassificatie over alle tabellen, geen celtoegang' },
      { file: 'services/leveling/levelingInput.ts', field: 'early_start_date', context: 'catalog:P6_PRIORITY_FIELD_QUANTITY', count: 1,
        waarom: 'bak 4, gesloten mapping P6-prioriteitskolomnaam ⇒ EIGEN berekende grootheid, geen celtoegang' },
      { file: 'services/leveling/levelingInput.ts', field: 'early_end_date', context: 'catalog:P6_PRIORITY_FIELD_QUANTITY', count: 1,
        waarom: 'bak 4, gesloten mapping P6-prioriteitskolomnaam ⇒ EIGEN berekende grootheid, geen celtoegang' },
      { file: 'services/leveling/levelingInput.ts', field: 'late_start_date', context: 'catalog:P6_PRIORITY_FIELD_QUANTITY', count: 1,
        waarom: 'bak 4, gesloten mapping P6-prioriteitskolomnaam ⇒ EIGEN berekende grootheid, geen celtoegang' },
      { file: 'services/leveling/levelingInput.ts', field: 'late_end_date', context: 'catalog:P6_PRIORITY_FIELD_QUANTITY', count: 1,
        waarom: 'bak 4, gesloten mapping P6-prioriteitskolomnaam ⇒ EIGEN berekende grootheid, geen celtoegang' },
      { file: 'services/leveling/levelingInput.ts', field: 'total_float_hr_cnt', context: 'catalog:P6_PRIORITY_FIELD_QUANTITY', count: 1,
        waarom: 'bak 4, gesloten mapping P6-prioriteitskolomnaam ⇒ EIGEN berekende grootheid, geen celtoegang' },
      { file: 'services/leveling/levelingInput.ts', field: 'free_float_hr_cnt', context: 'catalog:P6_PRIORITY_FIELD_QUANTITY', count: 1,
        waarom: 'bak 4, gesloten mapping P6-prioriteitskolomnaam ⇒ EIGEN berekende grootheid, geen celtoegang' },
      { file: 'services/xer/xerWriter.ts', field: 'plan_start_date', context: 'catalog:XER_PROJECT_PLANNING_COLUMNS', count: 1,
        waarom: 'SCHRIJVER, PROJECT-tabel: de geplande projectstart als uitvoerkolom, geen celtoegang (#391)' },
      { file: 'services/xer/xerWriter.ts', field: 'plan_end_date', context: 'catalog:XER_PROJECT_PLANNING_COLUMNS', count: 1,
        waarom: 'SCHRIJVER, PROJECT-tabel: het projecteinde bij useProjectEndDateForFloat, geen celtoegang (#391)' },
      { file: 'services/xer/xerWriter.ts', field: 'critical_drtn_hr_cnt', context: 'catalog:XER_PROJECT_PLANNING_COLUMNS', count: 1,
        waarom: 'SCHRIJVER, PROJECT-tabel: de kritiek-drempel in uren, geen celtoegang (#391)' },
      { file: 'services/p6/p6xmlScheduleOptions.ts', field: 'critical_drtn_hr_cnt', context: 'other:PropertyAssignment', count: 1,
        waarom: 'P6 XML-LEZER, nagebouwde PROJECT-rij: CriticalActivityFloatLimit (invoer) als kritiek-drempel voor dezelfde afleiding als XER, geen celtoegang (#775)' },
    ];
    const bak4Eigenaar = 'services/xer/xerRecordedTimes.ts';
    const gezien = new Map<Uitzondering, number>();
    const overtreders: string[] = [];
    for (const file of files) {
      const path = rel(file);
      const text = readFileSync(file, 'utf8');
      const velden = path === bak4Eigenaar ? verboden : [...verboden, ...XER_TASK_RECORDED_OUTPUT];
      for (const hit of astFieldHits(file, text, velden)) {
        const u = uitzonderingen.find(x => x.file === path && x.field === hit.field && x.context === hit.context);
        if (u) { gezien.set(u, (gezien.get(u) ?? 0) + 1); continue; }
        overtreders.push(`${hit.field} (${hit.kind}, ${hit.context}) in ${path}:${hit.line}`);
      }
    }
    checks++;
    if (overtreders.length > 0) {
      diffs.push(`AST-poort: verboden P6-kolomnamen (bak 2/2b, of bak 4 buiten xerRecordedTimes.ts) in src/ — ${overtreders.join('; ')}`);
    }
    for (const u of uitzonderingen) {
      truthy(`AST-poort: uitzondering ${u.field} @ ${u.file} (${u.context}) komt precies ${u.count}× voor (${u.waarom}), kreeg ${gezien.get(u) ?? 0}`,
        (gezien.get(u) ?? 0) === u.count);
    }
    const eigenaar = join(srcRoot, bak4Eigenaar);
    truthy('AST-poort: xerRecordedTimes.ts draagt alle zes bak-4-kolommen',
      existsSync(eigenaar) && XER_TASK_RECORDED_OUTPUT.every(field =>
        astFieldHits(eigenaar, readFileSync(eigenaar, 'utf8'), [field]).length > 0));
  }
}

const CORPUS = process.env.OPS_XER_CORPUS;

function listXerFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listXerFilesRecursive(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xer')) out.push(full);
  }
  return out;
}

function decodeForColumnNames(bytes: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return bytes.toString('latin1');
  }
}

function scanTaskColumns(text: string): string[] | null {
  const lines = text.split('\n').map(l => (l.endsWith('\r') ? l.slice(0, -1) : l));
  for (let i = 0; i < lines.length; i++) {
    const tTokens = lines[i].split('\t');
    if (tTokens[0] !== '%T') continue;
    if ((tTokens[1] ?? '').trim().toUpperCase() !== 'TASK') continue;
    const next = lines[i + 1];
    if (!next) return null;
    const fTokens = next.split('\t');
    if (fTokens[0] !== '%F') return null;
    return fTokens.slice(1);
  }
  return null;
}

const corpusDirExists = CORPUS !== undefined && existsSync(CORPUS);
const corpusFiles = corpusDirExists ? listXerFilesRecursive(CORPUS) : [];

if (!CORPUS) {
  console.log('OK  xer-field-whitelist: corpus niet aanwezig (OPS_XER_CORPUS) — corpusscan overgeslagen');
} else if (!corpusDirExists) {
  truthy('xer-field-whitelist: OPS_XER_CORPUS wijst naar een bestaande map', false);
} else if (corpusFiles.length === 0) {
  console.log('OK  xer-field-whitelist: corpus aanwezig maar geen .xer-bestanden gevonden — corpusscan overgeslagen');
} else {
  const unionFirstSeen = new Map<string, string>();
  let filesWithTaskTable = 0;
  for (const path of corpusFiles) {
    const bytes = readFileSync(path);
    const text = decodeForColumnNames(bytes);
    const cols = scanTaskColumns(text);
    if (cols === null) continue;
    filesWithTaskTable++;
    for (const col of cols) {
      if (!unionFirstSeen.has(col)) unionFirstSeen.set(col, path.slice(CORPUS.length + 1));
    }
  }

  truthy(`xer-field-whitelist: minstens één corpusbestand droeg een TASK-tabel (gevonden: ${filesWithTaskTable})`, filesWithTaskTable > 0);

  const whitelistSet = new Set(XER_TASK_WHITELIST as readonly string[]);
  const forbiddenSet = new Set(XER_TASK_FORBIDDEN as readonly string[]);
  const externalProxySet = new Set(XER_TASK_EXTERNAL_DEPENDENCY_PROXY as readonly string[]);
  const recordedOutputSet = new Set(XER_TASK_RECORDED_OUTPUT as readonly string[]);
  const ignoredSet = new Set(XER_TASK_IGNORED);

  const unclassified: string[] = [];
  for (const [col, exampleFile] of unionFirstSeen) {
    const inWhitelist = whitelistSet.has(col);
    const inForbidden = forbiddenSet.has(col);
    const inExternalProxy = externalProxySet.has(col);
    const inRecordedOutput = recordedOutputSet.has(col);
    const inIgnored = ignoredSet.has(col);
    const bucketCount = Number(inWhitelist) + Number(inForbidden) + Number(inExternalProxy)
      + Number(inRecordedOutput) + Number(inIgnored);
    if (bucketCount === 0) {
      unclassified.push(`"${col}" (bv. ${exampleFile})`);
    } else if (bucketCount > 1) {
      unclassified.push(`"${col}" (bv. ${exampleFile}) — staat in MEER DAN ÉÉN bak`);
    }
  }

  checks++;
  if (unclassified.length > 0) {
    diffs.push(
      `xer-field-whitelist: ${unclassified.length} TASK-%F-kolom(men) uit het corpus staan in géén van de vijf bakken (whitelist/forbidden/external-proxy/recorded-output/ignored) — gatenkaas-mechanisme, plan §4.1: ${unclassified.join(', ')}`,
    );
  }

  console.log(`.   xer-field-whitelist: ${filesWithTaskTable} bestanden met een TASK-tabel gescand, ${unionFirstSeen.size} unieke kolomnamen, ${unclassified.length} onbekend`);
}

if (diffs.length === 0) {
  console.log(`OK: xer-field-whitelist — ${checks} checks groen`);
} else {
  console.log(`XX xer-field-whitelist — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}
