/**
 * De veldlijsten-poort (X0, XER-etappeplan §4.1) — legt invoer, berekende uitvoer, nog niet
 * ondersteunde external-dependency-proxyvelden en genegeerde niet-planningsdata apart vast,
 * en toetst ze tegen de
 * daadwerkelijke TASK-`%F`-kolommen over het hele publieke XER-corpus (§4.3: bestandsnamen mogen
 * gewoon in tests/commits — dit is geen bedrijfsdata, anders dan `OPS_MPP_CORPUS`).
 *
 * DRIE BAKKEN, NIET TWEE (delta-check-redactieronde, 076f67ec): het plan startte met een whitelist
 * (invoer) en een verboden-lijst (rekenuitvoer) — maar 32 corpuskolommen (audittrail, vlaggen,
 * kosten, review/locatie-velden, pseudo-XER-dialectkolommen, …) vielen buiten beide, wat de poort op
 * dag één onvervulbaar maakte. De derde bak, `XER_TASK_IGNORED`, vangt die: "bestaat, is geen
 * rekenuitvoer, maar draagt ook geen planningsinvoer" — expliciet genegeerd, niet vergeten.
 *
 * X0 RAAKT `src/services/xer/` NIET AAN — met precies één, LATERE uitzondering (X-O7 laag 3,
 * §4.1-bijstelling 2026-09-04): `XER_TASK_RECORDED_OUTPUT` (bak 4 hieronder) IS de whitelist voor
 * de daadwerkelijk gebouwde `src/services/xer/xerRecordedTimes.ts`. De overige vier bakken
 * (whitelist/forbidden/external-proxy/ignored) blijven documentatie-van-het-plan zonder eigen
 * lezercode.
 *
 * De corpusscan hieronder is een eigen, MINIMALE %T/%F-tabelscan (geen tokenizer-hergebruik — X2
 * bouwt de echte grammatica) die uitsluitend kolomNAMEN uittrekt, nooit rijwaarden leest of
 * interpreteert.
 *
 * HET GATENKAAS-MECHANISME (planreview M2): een corpus-`%F`-kolom die in GEEN van de VIJF bakken
 * staat is een poortfout — precies de fout die de eerste twee-bakken-versie van dit plan maakte en
 * die de her-check ving. Schrap je een whitelist- (of verboden-, of genegeerd-, of
 * recorded-output-)veld zonder het elders te herplaatsen, dan valt die kolom terug tussen wal en
 * schip en gaat de scan ROOD (mét corpus gemount) — dat IS mutatiebewijs (a) voor deze poort.
 *
 * Zonder `OPS_XER_CORPUS` gemount: skip met een OK-regel (zelfde conventie als
 * `check-mpp-fidelity.ts`'s `OPS_MPP_CORPUS`) — dit is dus GEEN CI-poort, hij werkt alleen lokaal
 * (of op een machine met het corpus gemount). De corpusvrije zelfconsistentie-checks op de drie
 * constanten zelf (geen dubbele/overlappende velden) draaien wél altijd.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const diffs: string[] = [];
let checks = 0;
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};

// ═══════════════════════════════════════════════════════════════════════════════════════════
// De vijf bakken (XER-etappeplan §4.1 + D4-review: external proxy is geen lokale rekenuitvoer;
// bak 4 "recorded-output" kwam er later bij, X-O7 laag 3, §4.1-bijstelling 2026-09-04)
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * BAK 1 — WHITELIST: de invoervelden die de lezer straks WEL uit de TASK-tabel mag importeren.
 * Letterlijk overgenomen uit plan §4.1 — dit is documentatie-van-het-plan, geen eigen keuze. Een
 * uitbreiding hier hoort samen te gaan met een wijziging in het plandocument zelf.
 */
export const XER_TASK_WHITELIST = [
  // identiteit/structuur
  'task_id', 'task_code', 'task_name', 'wbs_id', 'clndr_id', 'proj_id', 'guid', 'rsrc_id',
  'status_code', 'task_type', 'duration_type', 'priority_type',
  // voortgang
  'complete_pct_type', 'complete_pct', 'phys_complete_pct',
  'act_start_date', 'act_end_date',
  // duren
  'target_drtn_hr_cnt', 'remain_drtn_hr_cnt',
  // geplande datums
  'target_start_date', 'target_end_date',
  // werk-hoeveelheden (als data)
  'target_work_qty', 'remain_work_qty', 'act_work_qty', 'act_this_per_work_qty',
  'target_equip_qty', 'remain_equip_qty', 'act_equip_qty', 'act_this_per_equip_qty',
  // constraints
  'cstr_type', 'cstr_date', 'cstr_type2', 'cstr_date2',
  // suspend/resume (X7 verwerkt de semantiek; het VELD is invoer)
  'suspend_date', 'resume_date',
  // échte notitiedata (X8) + dialect-alias van cstr_type in de ProjectLens-bestanden
  'task_notes', 'constraint_type',
  // alleen samen met de bijbehorende SCHEDOPTIONS-vlag (X5) — het VELD zelf is invoer
  'expect_end_date',
] as const;

/**
 * BAK 2 — VERBODEN: rekenuitvoer die er als gewone velden uitziet, maar dat niet is. De lezer mag
 * hier NOOIT uit lezen — de opgeslagen antwoorden zijn de meetlat (§3), nooit de invoer.
 *
 * De zes kolommen die ooit hier stonden (`early_start_date`, `early_end_date`, `late_start_date`,
 * `late_end_date`, `total_float_hr_cnt`, `free_float_hr_cnt`) zijn VERHUISD naar
 * `XER_TASK_RECORDED_OUTPUT` (bak 4, hieronder) — X-O7 laag 3, §4.1-bijstelling 2026-09-04. Ze
 * zijn nog steeds geen `Task`-invoer, maar de lezer mag ze — als apart, waardedragend kanaal naast
 * de taken, nooit als solverinvoer — WEL lezen voor de "datums zoals opgeslagen"-weergave.
 */
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

/**
 * BAK 2b — P6-proxy/input voor externe afhankelijkheden. Dit is géén berekende lokale TASK-
 * uitvoer, maar OPS ondersteunt deze bronsemantiek nog niet. Daarom blijft hij bewust buiten de
 * reader/solver en krijgt hij een eigen non-interferencecontract in de X12-productpoort.
 */
export const XER_TASK_EXTERNAL_DEPENDENCY_PROXY = [
  'external_early_start_date', 'external_late_end_date',
] as const;

/**
 * BAK 4 — "uitsluitend weergave/meetlat, nooit solverinvoer" (plan §4.1, bijgesteld 2026-09-04 —
 * eigenaarsbesluit X-O7 laag 3). Naamgeving-nota: het plan noemt dit "de vierde bak" (tellend
 * whitelist/forbidden/ignored als de oorspronkelijke drie), maar dit testbestand had door
 * `XER_TASK_EXTERNAL_DEPENDENCY_PROXY` al VIER constanten-groepen vóór deze — dit wordt dus de
 * VIJFDE `buckets`-entry hieronder. Genoemd naar de plan-SEMANTIEK ("recorded output"), niet naar
 * de telling.
 *
 * Deze zes namen waren tot deze bijstelling onderdeel van `XER_TASK_FORBIDDEN` (bak 2). Anders dan
 * de rest van bak 2 mag de lezer ze WEL uit de TASK-tabel halen — maar uitsluitend via het eigen,
 * geïsoleerde kanaal `src/services/xer/xerRecordedTimes.ts` (`ImportResult.recordedTimes`), NOOIT
 * naar `Task.time` en NOOIT als solverinvoer. Het enige echte bewijs daarvoor is het
 * X12-mutatiebewijs (taak T2): gemuteerde opgeslagen uitvoer verplaatst de solve niet, maar
 * verplaatst de weergavemodus wél. Die scherpte mag nooit als "traag" of "redundant" gesnoeid
 * worden (plan §5, risico 8) — het bak-4-lidmaatschap ALLEEN is een verzwakte poort.
 */
export const XER_TASK_RECORDED_OUTPUT = [
  'early_start_date', 'early_end_date', 'late_start_date', 'late_end_date',
  'total_float_hr_cnt', 'free_float_hr_cnt',
] as const;

/**
 * BAK 3a — "genegeerd — geen planningsdata": VOORBEHOUDEN kandidaten (plan §4.1, letterlijk).
 * Deze drie zijn OP NAAM ingedeeld, niet doorgelezen tegen echte rijwaarden — blijkt tijdens de
 * bouw dat één van de drie tóch planningsinvoer draagt, dan verhuist hij EXPLICIET naar
 * `XER_TASK_WHITELIST` hierboven (en uit deze lijst) — nooit stilzwijgend. Een aparte constante,
 * zodat die verhuizing een diff van twee regels is, niet een speurtocht in een lange platte lijst.
 */
export const XER_TASK_IGNORED_PROVISIONAL = [
  'est_wt', 'review_type', 'tmpl_guid',
] as const;

/**
 * BAK 3b — "genegeerd — geen planningsdata": de rest (audittrail, vlaggen, kosten, review/locatie
 * op naam behalve de drie voorbehouden hierboven, en een handvol restvelden). Gededupliceerd met
 * bak 3a in `XER_TASK_IGNORED` hieronder — nooit dezelfde naam op twee plekken.
 */
export const XER_TASK_IGNORED_OTHER = [
  // audittrail
  'create_date', 'update_date', 'create_user', 'update_user',
  // vlaggen
  'rev_fdbk_flag', 'lock_plan_flag', 'auto_compute_act_flag',
  // kosten
  'remain_cost', 'plan_cost', 'act_cost',
  // review/locatie (review_type zit in de voorbehouden-bak hierboven, review_end_date/location_id niet)
  'review_end_date', 'location_id',
  // overig, met naam genoemd in het plan
  'target_qty_per_hr', 'act_reg_qty', 'act_ot_qty',
] as const;

/**
 * BAK 3c — pseudo-XER-dialectkolommen: bestanden in het corpus die %F-headers dragen maar GEEN
 * echte P6-kolommen (plan §4.1 + X2's failure-mode-model — `p6xer-basic.xer`:
 * `Task_ID`/`Start_Date`/`Duration`; `p6xer-comprehensive.xer`/`p6xer-malformed.xer`: de kleine-
 * letter-varianten `start_date`/`end_date`/`duration`/`calendar_id`/`total_float`/`free_float`).
 * X2 weigert deze bestanden straks met een typed fout — ze openen nooit als leeg-maar-geldig
 * project — maar de NAMEN moeten wel ergens landen zolang deze scan blind over kolomnamen gaat
 * (bestandsbewust classificeren is X2-werk, geen X0-scantooling).
 */
export const XER_TASK_IGNORED_PSEUDO_XER = [
  'Task_ID', 'Task_Name', 'Start_Date', 'Duration', 'Status',
  'start_date', 'end_date', 'duration', 'calendar_id', 'total_float', 'free_float',
] as const;

/**
 * BAK 3d — tokenizer-artefact: een `%F`-regel die eindigt op een tab levert bij het splitsen een
 * lege laatste "kolomnaam" op (gemeten: `pmxml-samples/testXer.xer`,
 * `crawl-xer-extra/groupdocs-conversion/sample.xer`). Geen kolom, geen data — X2's tokenizer-nota.
 */
export const XER_TASK_IGNORED_TRAILING_TAB = [''] as const;

/** BAK 3, samengevoegd — dit is de lijst die de corpusscan hieronder daadwerkelijk gebruikt. */
export const XER_TASK_IGNORED: readonly string[] = [
  ...XER_TASK_IGNORED_PROVISIONAL,
  ...XER_TASK_IGNORED_OTHER,
  ...XER_TASK_IGNORED_PSEUDO_XER,
  ...XER_TASK_IGNORED_TRAILING_TAB,
];

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Corpusvrije zelfconsistentie: geen dubbele/overlappende velden binnen of tussen de bakken.
// Draait ALTIJD, ook zonder OPS_XER_CORPUS — dit bewaakt de constanten zelf, niet het corpus.
// ═══════════════════════════════════════════════════════════════════════════════════════════
{
  // VIJF bakken sinds X-O7 laag 3 (§4.1-bijstelling 2026-09-04): de oorspronkelijke vier plus
  // `recorded-output` (bak 4, plan-semantiek — zie de naamgevingsnota bij `XER_TASK_RECORDED_OUTPUT`
  // hierboven voor waarom dit de vijfde `buckets`-entry is, geen "vierde").
  const buckets: [string, readonly string[]][] = [
    ['whitelist', XER_TASK_WHITELIST],
    ['forbidden', XER_TASK_FORBIDDEN],
    ['external-dependency-proxy', XER_TASK_EXTERNAL_DEPENDENCY_PROXY],
    ['recorded-output', XER_TASK_RECORDED_OUTPUT],
    ['ignored', XER_TASK_IGNORED],
  ];
  for (const [name, list] of buckets) {
    const seen = new Set<string>();
    for (const f of list) {
      truthy(`geen dubbele entry "${f}" binnen ${name}`, !seen.has(f));
      seen.add(f);
    }
  }
  // Volledige paarsgewijze overlapcheck (i<j) over alle vijf bakken — generiek in plaats van een
  // handmatige piramide, zodat een zesde bak hier vanzelf meegenomen wordt.
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

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Isolatiescan (X-O7 laag 3, §3.2 van het laag-3-plan): een grep op de zes BAK-4-kolomnamen
// binnen `src/services/xer/` mag UITSLUITEND `xerRecordedTimes.ts` raken. Draait altijd, geen
// corpus nodig — dit is een broncodescan, naar het voorbeeld van sectie 11 in
// `check-recorded-dates.ts` (dubbele wortelkandidaat, want dit script draait zowel gebundeld in
// `tests/planning/` als los vanuit een andere map).
//
// NUANCE (bewust, geen vals-positief): `total_float_hr_cnt`/`free_float_hr_cnt` komen ook voor in
// `xerTables.ts`'s `XER_DECIMAL_FIELDS` — een AL BESTAANDE, generieke veldnaam-classificatie voor
// getalformaat-parsing over ALLE XER-tabellen (niet TASK-specifiek, niets met "lees dit veld als
// taakuitvoer" te maken). Die catalogus draagt de naam als lijst-element (gevolgd door een komma),
// nooit als celtoegang of functie-argument. De scan hieronder herkent daarom twee LEESPATRONEN —
// `cells.<veld>`/`cells['<veld>']` (celtoegang) en `'<veld>')`/`"<veld>")` (laatste argument van
// een aanroep, zoals `ctx.numberOf(row, 'total_float_hr_cnt')`) — en negeert bewust kale
// lijst-lidmaatschap. Zonder die nuance zou deze scan op dag één al rood staan, buiten elke wijziging
// van deze etappe om.
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
      loop(xerDir);
      truthy('isolatiescan leest een plausibel aantal bestanden in src/services/xer/', xerFiles.length > 5);

      const toegestaan = join(xerDir, 'xerRecordedTimes.ts');
      const overtreders: string[] = [];
      for (const file of xerFiles) {
        if (file === toegestaan) continue;
        const text = readFileSync(file, 'utf8');
        for (const field of XER_TASK_RECORDED_OUTPUT) {
          const cellAccess = new RegExp(`cells(?:\\.${field}\\b|\\[['"]${field}['"]\\])`);
          const callArg = new RegExp(`['"]${field}['"]\\s*\\)`);
          if (cellAccess.test(text) || callArg.test(text)) {
            overtreders.push(`${field} in ${file.slice(srcRoot.length)}`);
          }
        }
      }
      checks++;
      if (overtreders.length > 0) {
        diffs.push(
          `isolatiescan: BAK-4-kolommen worden buiten xerRecordedTimes.ts gelezen — ${overtreders.join(', ')}`,
        );
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// De corpusscan: union van alle TASK-%F-kolommen over OPS_XER_CORPUS, tegen de vijf bakken.
// ═══════════════════════════════════════════════════════════════════════════════════════════

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

/**
 * Decodeert de bytes van een .xer-bestand tot tekst, puur voor kolomNAAM-extractie. GEEN X-O4-
 * implementatie (dat is X2's tweepas-heuristiek voor de volledige, betrouwbare bestandsdecodering)
 * — kolomnamen op een `%F`-regel zijn altijd ASCII, dus een geldige-UTF-8-toets met een latin1-
 * terugval volstaat hier ruimschoots om ze leesbaar te maken.
 */
function decodeForColumnNames(bytes: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return bytes.toString('latin1');
  }
}

/**
 * Eigen, MINIMALE %T/%F-scan — geen tokenizer-hergebruik (er is nog niets te hergebruiken; X2 bouwt
 * de echte XER-grammatica). Zoekt de TASK-tabel (naam case-insensitief, spatie-getrimd — dezelfde
 * coulance als de generieke enum-tokenregel elders in het plan) en geeft de kolomnamen van de
 * daaropvolgende `%F`-regel terug, INCLUSIEF een eventuele lege laatste kolom (afsluitende tab).
 * `null` als het bestand geen TASK-tabel draagt.
 */
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
  // kolomnaam -> één voorbeeldbestand (relatief pad — corpus is publiek, §4.3, geen hash-only-eis)
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
      // Kan hier eigenlijk niet gebeuren gezien de zelfconsistentie-checks hierboven, maar een
      // corpuskolom die toch in >1 bak zou vallen is even fataal als "in geen enkele" — beide zijn
      // een gat in de poort, dus allebei een diff i.p.v. een silent pass.
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

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK: xer-field-whitelist — ${checks} checks groen`);
} else {
  console.log(`XX xer-field-whitelist — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}
