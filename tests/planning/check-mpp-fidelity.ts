// MPP-datumgetrouwheid (fase 3.8, etappe "MSP-pariteit", plandocument T1) — de regressietest-
// helft van het gedeelde meetscript (§5). De meetkern zelf staat in `mppFidelity.ts`
// (`measureFidelity`, roept `readMPP` + `solveProject` — de ECHTE `runCPM`-keten — aan tegen de
// ONAFHANKELIJKE grondwaarheid uit `mppGroundTruth.ts`). Dit bestand is de poort eromheen:
// corpus-/crawl-iteratie, per-bestand-per-veld-pinning tegen `mpp-fidelity-baseline.json`, en de
// drie rapportagemodi.
//
// LOW (eindreview T16c): dit is GEEN CI-poort — `OPS_MPP_CORPUS`/`OPS_MPP_CRAWL` bestaan niet in
// CI (bedrijfsbestanden resp. extern crawl-materiaal, bewust nooit in de repo, zie het
// baselinebeleid hieronder), dus in CI/op elke andere machine zonder die mappen draait dit bestand
// wél mee in `npm run verify`/`run.sh` maar slaat de hele corpus-/crawl-lus over ("OK ...
// overgeslagen") — geen enkele echte assertie. De poort werkt uitsluitend LOKAAL (of via een
// gerichte pre-push-hook op een machine met de mappen gemount); "geregistreerd in run.sh" is dus
// wél waar (het draait overal mee, ook in CI), maar "CI-poort" beweert ten onrechte dat CI 'm
// daadwerkelijk afdwingt.
//
// TWEE LEVENS, ÉÉN ARTEFACT (plan §5): tijdens de etappe draaien implementers/reviewers dit exact
// zo (`OPS_MPP_FIDELITY_REPORT=detail`) om voor→na-cijfers te zien; als regressietest (default-
// modus, geregistreerd in run.sh) bewaakt het dat niemand een gerepareerd bestand stilzwijgend
// weer laat verslechteren. Geen tweede, gepind harnas dat kan afdrijven van de live worktree.
//
// BASELINEBELEID (plan §6): sleutel = SHA-256 van de bestandsBYTES (eerste 16 hex-tekens), NOOIT
// de bestandsnaam. Corpusinhoud komt nooit in de repo — de baseline draagt alleen tellingen. Voor
// bestanden onder `OPS_MPP_CRAWL` (publiek MPXJ-junit-materiaal + OzBuild-workshopbestanden) mag
// een leesbaar `label` (relatief pad) meelopen voor diagnose; voor `OPS_MPP_CORPUS`-bestanden
// (echte bedrijfsbestanden) blijft dat veld leeg. REVIEWBEVINDING L4: dat privacybeleid geldt niet
// alleen voor wat er in het GECOMMITTE baselinebestand komt, maar voor ALLE tekst die deze check
// naar stdout schrijft — ook een transiente faalregel in een CI-log kan gekopieerd/geplakt worden
// (en belandde eerder zelfs letterlijk in een commitbericht). Elke diagnoseregel over een
// CORPUS-bestand identificeert het daarom UITSLUITEND via zijn hash; alleen CRAWL-bestanden mogen
// met hun leesbare (relatieve) pad in de uitvoer verschijnen — zie `tagFor()` hieronder.
//
// `tagFor()` DEKT ALLEEN IDENTITEIT, NIET INHOUD (her-reviewbevinding, ná H2). Het is de enige
// plek die een bestand naar een IDENTIFICERENDE tekst (hash of relatief pad) omzet — maar de
// default-modus kan via `measureFidelity`'s foutmeldingen (bv. de uitlijningsguard in
// `mppFidelity.ts`, H2) nog steeds tekst UIT het bestand zelf naar stdout laten lekken als die
// meldingen niet zelf al schoon zijn; dat is dáár gefixt, niet hier. `OPS_MPP_FIDELITY_REPORT=
// detail` (`printDetail()` hieronder) is een APARTE, BEWUST BREDERE categorie: die print per
// afwijkende taak de MSP-naam, kalender-id, constraint en voorgangernamen — CORPUSINHOUD, niet
// alleen een identificerende tag. L3 (Opus-eindreview, 2026-08-17): dat privacyrisico is NIET
// voor beide wortels gelijk, en dit moet expliciet staan i.p.v. impliciet uit §6/O4 afgeleid
// worden. Voor `OPS_MPP_CORPUS`-bestanden (bedrijfsdata) hoort deze uitvoer NOOIT in een commit,
// PR-beschrijving of CI-log geplakt te worden — dat is precies zo gevoelig als het corpusbestand
// zelf. Voor `OPS_MPP_CRAWL`-bestanden (publieke MPXJ-junit-data en OzBuild-workshopmateriaal) is
// de brontekst zélf al publiek: taak-/voorgangernamen uit die bestanden plakken is dezelfde,
// toegestane blootstelling als het leesbare `label` dat §6/O4 voor crawl-bestanden al toestaat in
// de baseline. Detail-modus blijft niettemin bedoeld voor lokaal, interactief gebruik tijdens de
// etappe (plan §5) — plak in de praktijk niet meer dan nodig, en behandel een regel bij twijfel
// over corpus-versus-crawl als corpus.
//
// PINNING (plan §5, "geen somtotalen"): per bestand, met `===` — `tasks`, `startExact`,
// `startSameday`, `startDiff`, `finishExact`, `finishSameday`, `finishDiff`. Plus twee globale
// pins: (a) elk gepind bestand van een GESCANDE wortel ook echt teruggevonden, en (b) de
// VERZAMELING bestanden met ≥1 start-/finish-afwijking (bewust NIET sameday, zie
// `mppFidelity.ts`'s `FidelityRow.startSameday`-doc) binnen die wortel exact gelijk aan de
// gepinde verzameling voor die wortel — dat vangt een NIEUW afwijkend bestand ook wanneer een
// ander bestand tegelijk verbetert (een som zou dat verdoezelen). Een gescand bestand zonder pin
// faalt (herpinnen via `OPS_MPP_FIDELITY_REPORT=baseline`, met de hand plakken — de check schrijft
// nooit zelf een bestand).
//
// REVIEWBEVINDING H1 — DE GLOBALE PINS ZIJN PER WORTEL, NIET OVER HET HELE BASELINEBESTAND. Wie
// alleen OPS_MPP_CRAWL heeft (het bedrijfscorpus is per definitie afwezig buiten deze ene machine)
// zou anders een valse rode "aantal gepinde bestanden gezien: verwacht 216, kreeg 213" krijgen —
// de 3 corpusbestanden zíjn simpelweg niet gescand. Elke `BaselineEntry` draagt daarom een `root`
// ('corpus' | 'crawl'); de globale pins vergelijken uitsluitend binnen een wortel die dit keer
// DAADWERKELIJK gescand is (aanwezig ÉN ≥1 `.mpp`-bestand gevonden — een aanwezige maar lege map
// gedraagt zich hetzelfde als een afwezige map: één OK-regel, geen assert. Voorheen gaf zo'n lege
// map wél de OK-skipregel MAAR ook nog een rode globale pin, want de assert keek naar
// `corpusPresent` (bestaat de map) i.p.v. "is er iets gescand").
//
// DELTA-SLOTREGEL (coordinator-verzoek, ná de Opus-review): één informatieve `console.log`-regel
// aan het eind van de scan — hoeveel gepinde bestanden verbeterden/verslechterden/gelijk bleven
// t.o.v. de pin, en de netto som. GEEN poort (geen `checks++`/`diffs.push`) en vervangt de
// per-bestand-per-veld-pins hierboven niet — puur zodat een andere baan in één regel ziet welke
// KANT een rode of groene run op wijst, zonder door tientallen individuele pin-regels te scrollen.
//
// `MPP_LEGACY`/`MPP_ENCRYPTED`-weigeringen tellen als overgeslagen (eigenaarsbesluit O7), nooit
// als fout; alleen een ONVERWACHTE throw (geen `mppCode`) is een echte faal.
//
// Draait via run.sh (RUN_HOLIDAYS-blok, ná check-mpp-summary-relations) en draait daarna mee in de
// tijdzone-matrix — vandaar (T1-ontwerpeis) dat de gehele corpusscan ruim < 1 s kost: de matrix
// herhaalt dit vijfmaal.
//
// REVIEWBEVINDING M1 — deze check is niet leeg zonder corpus. De ALTIJD-DRAAIENDE sectie hieronder
// (vóór de corpus-/crawl-iteratie) dekt de classify-tabel en de twee terugvaltakken van
// `measureFidelity` (leeg bestand ⇒ 'error', gefingeerd legacy-bestand ⇒ 'rejected') met eigen,
// minimale fixtures — naar het patroon van check-mpp-import.ts se synthetische MPP12-case.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { measureFidelity, solveMppBytes, classify, type FidelityRow } from './mppFidelity';
import { scanGroundTruthTasks } from './mppGroundTruth';
import { readMPP } from '@/services/mpp/mppReader';
import { useAppStore } from '@/state/appStore';
import { getTimestamp } from '@/services/mpp/mppPrimitives';
import { TaskFieldId } from '@/services/mpp/fieldMap14';
import {
  encodeCompObjFileFormat, encodePropsSingleByteEntry, buildTwoRootStreamsCfb,
  encodeAsciiWithTerminator, encodePropsEntries, buildVarMetaBytes, buildNestedCfb, type CfbTreeNode,
} from './mppFixtures';

// `import.meta.url`-relatief i.p.v. `process.cwd()` — zelfde reviewbevinding/conventie als
// `check-adapters-hours.ts`/`check-mpp-chunk-boundary.ts`: dit bestand draait via
// `bash tests/planning/run.sh`, dat nooit naar de repo-root `cd`'t.
const HERE = fileURLToPath(new URL('.', import.meta.url));

const diffs: string[] = [];
let checks = 0;
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (got !== want) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

const REPORT = process.env.OPS_MPP_FIDELITY_REPORT; // undefined | 'detail' | 'baseline'

// ═══════════════════════════════════════════════════════════════════════════════════════════
// M1 — corpusvrije unit-asserties: draaien ALTIJD, ook zonder OPS_MPP_CORPUS/OPS_MPP_CRAWL.
// ═══════════════════════════════════════════════════════════════════════════════════════════

// classify() — de vier uitkomsten, rechtstreeks tegen de geëxporteerde functie.
eq('M1 classify: exacte uurinstant', classify('2026-01-05T08:00', '2026-01-05T08:00'), 'exact');
eq('M1 classify: date-only vs middernacht-instant is exact', classify('2026-01-05', '2026-01-05T00:00'), 'exact');
eq('M1 classify: zelfde dag, andere klokstand → sameday', classify('2026-01-05T08:00', '2026-01-05T17:00'), 'sameday');
eq('M1 classify: andere dag → diff', classify('2026-01-06T08:00', '2026-01-05T08:00'), 'diff');
eq('M1 classify: geen grondwaarheid → missing', classify('2026-01-05T08:00', null), 'missing');
eq('M1 classify: geen eigen waarde → missing', classify(undefined, '2026-01-05T08:00'), 'missing');

// measureFidelity op lege bytes: geen geldig CFB-bestand (de eerste 8 bytes zijn al te kort voor
// de OLE2-magic), dus geen MppUnsupportedError — die gooit pas ná een geslaagde CFB-parse. Status
// moet 'error' zijn (een echte, onverwachte leesfout), niet stil 'ok' met tasks: 0.
{
  const row = measureFidelity(new Uint8Array(0));
  eq('M1 measureFidelity(lege bytes): status === error', row.status, 'error');
  truthy('M1 measureFidelity(lege bytes): errMsg gezet', !!row.errMsg);
}

// measureFidelity op een gefingeerd MPP12 (legacy)-bestand: minimale CFB met alleen \x01CompObj
// (applicatienaam "MSProject.MPP12") + Props14 (wachtwoordvlag=0). `assertReadable` weigert MPP12
// met mppCode 'MPP_LEGACY' vóór er ooit naar de rest van de structuur gekeken wordt — zelfde
// fixture-patroon als check-mpp-import.ts se "T4 synthetisch MPP12"-case, hier lokaal opgebouwd
// (elk mpp-checkbestand bouwt zijn eigen, minimale fixture-set — zie check-mpp-relations.ts se
// moduleheader-conventie). Bewijst dat 'rejected' (overgeslagen, O7) een bereikbaar pad is zonder
// dat het bedrijfscorpus toevallig een MPP12-bestand hoeft te bevatten om dat te oefenen.
{
  const MPP_PASSWORD_FLAG_KEY = 893386752; // PropsKey.PASSWORD_FLAG (PropsKey.java r. 73)
  const compObj = encodeCompObjFileFormat('MSProject.MPP12');
  const props14 = encodePropsSingleByteEntry(MPP_PASSWORD_FLAG_KEY, 0);
  const legacyBytes = buildTwoRootStreamsCfb('\x01CompObj', compObj, 'Props14', props14);
  const row = measureFidelity(legacyBytes);
  eq('M1 measureFidelity(gefingeerd MPP12): status === rejected', row.status, 'rejected');
  eq("M1 measureFidelity(gefingeerd MPP12): errCode === 'MPP_LEGACY'", row.errCode, 'MPP_LEGACY');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// M1 — Z1 (etappe "nul afwijkingen"): TASK_MODE-bewuste grondwaarheid, CORPUSLOOS mutatie-bewezen.
// `scanGroundTruthTasks` (mppGroundTruth.ts) kiest sinds Z1 per taak het veldpaar dat MS Project
// zelf gebruikt: SCHEDULED_START/FINISH (35/36) voor AUTO_SCHEDULED, START/FINISH (1283/1284,
// Fixed2Data blok 1 van TBkndTask) voor MANUALLY_SCHEDULED (TASK_MODE-bit uit Fixed2Meta, offset 8,
// masker 0x08 voor applicationVersion ≤14, 0x80 voor >14). Deze fixtures bewijzen dat corpusloos,
// dus in CI. Mutatiebewijs (uitgevoerd tijdens implementatie, niet in deze bestandsvorm aanwezig —
// zie het commitbericht): (1) TASK_MODE-decodering geforceerd AUTO → onderstaande MANUAL-assertie
// ROOD; (2) het 2010-masker (0x08) toegepast op de 2013-fixture → die assertie ROOD; (3) beide
// herstelt weer groen na terugdraaien.
// ═══════════════════════════════════════════════════════════════════════════════════════════
{
  const Z1_PASSWORD_FLAG_KEY = 893386752; // PropsKey.PASSWORD_FLAG — zelfde waarde als de MPP12-case hierboven.
  const Z1_BLOCK0_ITEM_SIZE = 90; // ≥ 72 (ScheduledFinish@68 + 4) — letterlijke DEFAULT_TASK_FIELDS-offsets.
  const Z1_BLOCK1_ITEM_SIZE = 72; // ≥ 58 (FINISH@54 + 4) — letterlijke FieldMap14.java-defaultoffsets.
  const Z1_FIXED2_META_ITEM_SIZE = 92; // kleinste FixedMeta.withHeuristicItemSize-kandidaat.
  const Z1_FIRST_TASK_INDEX = 3; // spiegelt scanGroundTruthTasks se FIRST_TASK_INDEX.

  interface Z1Ts { time: number; days: number }
  interface Z1TaskSpec {
    uniqueId: number; id: number; name: string; manual: boolean;
    schedStart: Z1Ts; schedFinish: Z1Ts;
    rawStart?: Z1Ts | null; rawFinish?: Z1Ts | null;
  }

  function z1WriteTs(view: DataView, offset: number, ts: Z1Ts | null | undefined): void {
    // `days` ontbreekt (0) ⇒ `getTimestamp` geeft `null` terug (mppPrimitives.ts: `days<=1 ⇒ null`)
    // — zo kan een fixture bewust "geen rauwe waarde opgeslagen" uitdrukken.
    view.setUint16(offset, ts?.time ?? 0, true);
    view.setUint16(offset + 2, ts?.days ?? 0, true);
  }

  function z1EncodeUnicodeStringAscii(s: string): Uint8Array {
    const out = new Uint8Array(s.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), true);
    return out;
  }

  /** Eigen kleine CompObj-encoder MET instelbare `applicationName` (mppFixtures.ts se
   *  `encodeCompObjFileFormat` hardcodt 'OPS synthetic' — geen versie-patroon-match, dus altijd
   *  `applicationVersion === null`). Nodig om de `≤14`/`>14`-TASK_MODE-versiegrens daadwerkelijk
   *  te kunnen kiezen i.p.v. hem alleen te kunnen "missen". */
  function z1EncodeCompObjWithVersion(applicationName: string, fileFormat: string): Uint8Array {
    const nameBytes = encodeAsciiWithTerminator(applicationName);
    const fmtBytes = encodeAsciiWithTerminator(fileFormat);
    const out = new Uint8Array(28 + 4 + nameBytes.length + 4 + fmtBytes.length + 4);
    const view = new DataView(out.buffer);
    let pos = 28;
    view.setInt32(pos, nameBytes.length, true); pos += 4;
    out.set(nameBytes, pos); pos += nameBytes.length;
    view.setInt32(pos, fmtBytes.length, true); pos += 4;
    out.set(fmtBytes, pos); pos += fmtBytes.length;
    view.setInt32(pos, 0, true); // applicationID-lengte: 0 ⇒ overslaan
    return out;
  }

  /** Bouwt een compleet, corpusloos MPP14-bestand: `tasks.length` echte taken + 3 verplichte
   *  dummy-slots (spiegelt `FIRST_TASK_INDEX`), met blok-0 (SCHEDULED_START/FINISH) én — tenzij
   *  `includeFixed2Streams: false` — blok-1 (Fixed2Meta/Fixed2Data, TASK_MODE + rauw START/FINISH).
   *  `taskModeOffset`/`taskModeMask` bepalen welke bit-positie een `manual: true`-taak daadwerkelijk
   *  draagt (de fixture kiest dus zelf, bewust, welke versietabel ze simuleert — geen giswerk). */
  function buildZ1Fixture(opts: {
    tasks: Z1TaskSpec[];
    applicationName?: string;
    includeFixed2Streams?: boolean;
    taskModeOffset?: number;
    taskModeMask?: number;
    fixed2DataTruncateTo?: number;
    /** Fixronde-1-HOOG: `Fixed2Meta` blijft AANWEZIG (niet-`null`, dus de
     *  `if (fixed2MetaBytes && fixed2DataBytes)`-guard in `scanGroundTruthTasks` laat de `try` in),
     *  maar krijgt een ONGELDIG magic-getal — `FixedMeta.withItemSize` (aangeroepen door
     *  `withHeuristicItemSize`) gooit daar altijd op, ongeacht gekozen itemSize. Dit is de enige
     *  manier in deze fixture-bouwer om de `catch`-tak zelf (niet alleen de if-guard) daadwerkelijk
     *  te bereiken — zie de fixture die deze vlag gebruikt in `check-mpp-fidelity.ts`. */
    corruptFixed2Meta?: boolean;
  }): Uint8Array {
    const n = opts.tasks.length;
    const includeFixed2 = opts.includeFixed2Streams ?? true;
    const tmOffset = opts.taskModeOffset ?? 8;
    const tmMask = opts.taskModeMask ?? 0x08;

    // ── Blok 0: FixedMeta (47-byte items) + FixedData (Z1_BLOCK0_ITEM_SIZE-byte records). ────────
    const metas0: Uint8Array[] = [new Uint8Array(47), new Uint8Array(47), new Uint8Array(47)];
    const dataBlob0 = new Uint8Array((3 + n) * Z1_BLOCK0_ITEM_SIZE);
    opts.tasks.forEach((t, i) => {
      const idx = Z1_FIRST_TASK_INDEX + i;
      const meta = new Uint8Array(47);
      new DataView(meta.buffer).setInt32(4, idx * Z1_BLOCK0_ITEM_SIZE, true);
      metas0.push(meta);
      const rec = new Uint8Array(Z1_BLOCK0_ITEM_SIZE);
      const rv = new DataView(rec.buffer);
      rv.setInt32(0, t.uniqueId, true);
      rv.setInt32(4, t.id, true);
      z1WriteTs(rv, 64, t.schedStart);
      z1WriteTs(rv, 68, t.schedFinish);
      dataBlob0.set(rec, idx * Z1_BLOCK0_ITEM_SIZE);
    });
    const fixedMetaBlob = new Uint8Array(16 + metas0.length * 47);
    {
      const v = new DataView(fixedMetaBlob.buffer);
      v.setUint32(0, 0xfadfadba, true);
      v.setInt32(8, metas0.length, true);
      metas0.forEach((m, i) => fixedMetaBlob.set(m, 16 + i * 47));
    }

    // ── VarMeta/Var2Data — namen (nodig voor de bestaande naam-uitlijnvergelijking elders; hier
    // alleen zodat `scanGroundTruthTasks` een niet-lege naam teruggeeft). ───────────────────────
    let nameOffset = 0;
    const varMetaEntries: { uniqueId: number; type: number; offset: number }[] = [];
    const namePayloads: { offset: number; payload: Uint8Array }[] = [];
    for (const t of opts.tasks) {
      varMetaEntries.push({ uniqueId: t.uniqueId, type: TaskFieldId.Name, offset: nameOffset });
      const payload = z1EncodeUnicodeStringAscii(t.name);
      namePayloads.push({ offset: nameOffset, payload });
      nameOffset += 4 + payload.length;
    }
    const varMetaBytes = buildVarMetaBytes(varMetaEntries);
    const var2DataBuf = new Uint8Array(Math.max(nameOffset, 1));
    {
      const v = new DataView(var2DataBuf.buffer);
      for (const { offset, payload } of namePayloads) {
        v.setInt32(offset, payload.length, true);
        var2DataBuf.set(payload, offset + 4);
      }
    }

    const children: Record<string, CfbTreeNode> = {
      FixedMeta: { data: fixedMetaBlob },
      FixedData: { data: dataBlob0 },
      VarMeta: { data: varMetaBytes },
      Var2Data: { data: var2DataBuf },
    };

    // ── Blok 1: Fixed2Meta (Z1_FIXED2_META_ITEM_SIZE-byte items) + Fixed2Data (rauw START/FINISH
    // op de letterlijke FieldMap14.java-offsets 50/54). Optioneel — acceptatiepunt 4. ────────────
    if (includeFixed2) {
      const itemCount2 = 3 + n;
      const fixed2MetaBlob = new Uint8Array(16 + itemCount2 * Z1_FIXED2_META_ITEM_SIZE);
      {
        const v = new DataView(fixed2MetaBlob.buffer);
        v.setUint32(0, 0xfadfadba, true);
        v.setInt32(8, itemCount2, true);
      }
      let data2Blob = new Uint8Array((3 + n) * Z1_BLOCK1_ITEM_SIZE);
      const mv = new DataView(fixed2MetaBlob.buffer);
      opts.tasks.forEach((t, i) => {
        const idx = Z1_FIRST_TASK_INDEX + i;
        const metaOff = 16 + idx * Z1_FIXED2_META_ITEM_SIZE;
        mv.setInt32(metaOff + 4, idx * Z1_BLOCK1_ITEM_SIZE, true); // offsetIntoFixed2Data
        if (t.manual) mv.setUint8(metaOff + tmOffset, tmMask); // TASK_MODE-bit (4-byte int, past in byte 0)
        const rec = new Uint8Array(Z1_BLOCK1_ITEM_SIZE);
        const rv = new DataView(rec.buffer);
        z1WriteTs(rv, 50, t.rawStart);
        z1WriteTs(rv, 54, t.rawFinish);
        data2Blob.set(rec, idx * Z1_BLOCK1_ITEM_SIZE);
      });
      if (opts.fixed2DataTruncateTo !== undefined) data2Blob = data2Blob.subarray(0, opts.fixed2DataTruncateTo);
      if (opts.corruptFixed2Meta) mv.setUint32(0, 0, true); // ongeldig magic-getal ⇒ withItemSize gooit
      children.Fixed2Meta = { data: fixed2MetaBlob };
      children.Fixed2Data = { data: data2Blob };
    }

    const compObj = opts.applicationName
      ? z1EncodeCompObjWithVersion(opts.applicationName, 'MSProject.MPP14')
      : encodeCompObjFileFormat('MSProject.MPP14');
    const tree: Record<string, CfbTreeNode> = {
      '\x01CompObj': { data: compObj },
      Props14: { data: encodePropsSingleByteEntry(Z1_PASSWORD_FLAG_KEY, 0) },
      '   114': {
        children: {
          Props: { data: encodePropsEntries([]) }, // geen data-gedreven veldkaart ⇒ DEFAULT_TASK_FIELDS + de letterlijke block-1-terugval (50/54)
          TBkndTask: { children },
        },
      },
    };
    return buildNestedCfb(tree);
  }

  /** Bouwt de verwachte `Date` uit dezelfde tijd/dag-notatie als de fixture, via de ECHTE
   *  `getTimestamp`-primitief (niet opnieuw uitgerekend) — deze test bewijst welk VELDPAAR
   *  `scanGroundTruthTasks` kiest, niet hoe `getTimestamp` zelf rekent. */
  function z1ExpectedDate(ts: Z1Ts): Date {
    const buf = new Uint8Array(4);
    const v = new DataView(buf.buffer);
    v.setUint16(0, ts.time, true);
    v.setUint16(2, ts.days, true);
    const d = getTimestamp(buf, 0, 'z1-expected');
    if (!d) throw new Error('z1ExpectedDate: onverwacht null (kies days > 1)');
    return d;
  }

  // ── Acceptatiepunt 1: AUTO-taak → 35/36, MANUAL-taak → 1283/1284, in HETZELFDE bestand
  // (2010-tabel, TASK_MODE offset 8 masker 0x08 — de default-terugval van `applicationVersion`). ──
  {
    const autoSpec: Z1TaskSpec = {
      uniqueId: 101, id: 1, name: 'TaskAuto', manual: false,
      schedStart: { time: 4800, days: 15000 }, schedFinish: { time: 9600, days: 15000 },
      rawStart: { time: 4800, days: 15005 }, rawFinish: { time: 9600, days: 15005 }, // aanwezig, moet genegeerd worden
    };
    const manualSpec: Z1TaskSpec = {
      uniqueId: 102, id: 2, name: 'TaskManual', manual: true,
      schedStart: { time: 4800, days: 15000 }, schedFinish: { time: 9600, days: 15000 },
      rawStart: { time: 7200, days: 15002 }, rawFinish: { time: 9600, days: 15003 }, // moet WINNEN
    };
    const bytes = buildZ1Fixture({ tasks: [autoSpec, manualSpec] });
    const { raws } = scanGroundTruthTasks(bytes);
    eq('Z1 fixture: 2 taken gelezen', raws.length, 2);
    if (raws.length === 2) {
      truthy('Z1 AUTO-taak: start === SCHEDULED_START (35), niet het rauwe 1283', raws[0].start?.getTime() === z1ExpectedDate(autoSpec.schedStart).getTime());
      truthy('Z1 AUTO-taak: finish === SCHEDULED_FINISH (36), niet het rauwe 1284', raws[0].finish?.getTime() === z1ExpectedDate(autoSpec.schedFinish).getTime());
      truthy('Z1 MANUAL-taak: start === rauwe START (1283), niet SCHEDULED_START', raws[1].start?.getTime() === z1ExpectedDate(manualSpec.rawStart!).getTime());
      truthy('Z1 MANUAL-taak: finish === rauwe FINISH (1284), niet SCHEDULED_FINISH', raws[1].finish?.getTime() === z1ExpectedDate(manualSpec.rawFinish!).getTime());
    }
  }

  // ── Acceptatiepunt 3 (fixture-helft): 2013+-tabel — applicationVersion via een custom CompObj-
  // applicationName ("Microsoft.Project 16.0", >14), TASK_MODE-bit op offset 8 MASKER 0x80 (niet
  // 0x08). Mutatiebewijs (uitgevoerd, zie commitbericht): `taskModeBitFlag` tijdelijk geforceerd op
  // altijd `{ offset: 8, mask: 0x08 }` maakte de onderstaande MANUAL-assertie ROOD — het 2010-
  // masker vindt de 0x80-bit niet, dus de taak werd ten onrechte als AUTO gelezen. ───────────────
  {
    const manual2013: Z1TaskSpec = {
      uniqueId: 201, id: 1, name: 'Manual2013', manual: true,
      schedStart: { time: 4800, days: 16000 }, schedFinish: { time: 9600, days: 16000 },
      rawStart: { time: 7200, days: 16002 }, rawFinish: { time: 9600, days: 16003 },
    };
    const bytes = buildZ1Fixture({
      tasks: [manual2013], applicationName: 'Microsoft.Project 16.0', taskModeOffset: 8, taskModeMask: 0x80,
    });
    const { raws } = scanGroundTruthTasks(bytes);
    eq('Z1 2013+-fixture: 1 taak gelezen', raws.length, 1);
    if (raws.length === 1) {
      truthy('Z1 2013+-masker (0x80): MANUAL-taak start === rauwe START (1283)', raws[0].start?.getTime() === z1ExpectedDate(manual2013.rawStart!).getTime());
      truthy('Z1 2013+-masker (0x80): MANUAL-taak finish === rauwe FINISH (1284)', raws[0].finish?.getTime() === z1ExpectedDate(manual2013.rawFinish!).getTime());
    }
  }

  // ── Acceptatiepunt 4: Fixed2Meta/Fixed2Data ONTBREKEN VOLLEDIG → nette terugval op 35/36 voor
  // élke taak, GEEN exceptie (rode-pad-fixture voor de `if (fixed2MetaBytes && fixed2DataBytes)`-
  // tak). `manual: true` is hier bewust INERT (zonder de streams is er geen TASK_MODE-bit om te
  // lezen, dus `isManual` resolveert sowieso naar `false`) — dat is precies het punt: zelfs een
  // taak die MANUAL zou zijn als de bron het toeliet, valt netjes terug op SCHEDULED_START/FINISH
  // in plaats van op een undefined/`null` resultaat. De `raw === null`-terugvaltak van
  // `resolveScheduleField` zelf wordt SEPARAAT (en mutatie-bewezen) getoetst door de vijandige
  // fixture hieronder. ─────────────────────────────────────────────────────────────────────────
  {
    const noFixed2: Z1TaskSpec = {
      uniqueId: 301, id: 1, name: 'NoFixed2Streams', manual: true,
      schedStart: { time: 4800, days: 15100 }, schedFinish: { time: 9600, days: 15100 },
    };
    const bytes = buildZ1Fixture({ tasks: [noFixed2], includeFixed2Streams: false });
    let threw: string | null = null;
    let raws: ReturnType<typeof scanGroundTruthTasks>['raws'] = [];
    try {
      ({ raws } = scanGroundTruthTasks(bytes));
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`Z1 ontbrekende Fixed2-streams: geen exceptie (${threw ?? ''})`, threw === null);
    eq('Z1 ontbrekende Fixed2-streams: 1 taak gelezen', raws.length, 1);
    if (raws.length === 1) {
      truthy('Z1 ontbrekende Fixed2-streams: valt terug op SCHEDULED_START (35)', raws[0].start?.getTime() === z1ExpectedDate(noFixed2.schedStart).getTime());
      truthy('Z1 ontbrekende Fixed2-streams: valt terug op SCHEDULED_FINISH (36)', raws[0].finish?.getTime() === z1ExpectedDate(noFixed2.schedFinish).getTime());
    }
  }

  // ── Fixronde-1-HOOG: AANWEZIGE maar ONPARSEBARE Fixed2Meta (ongeldig magic-getal) — anders dan
  // het acceptatiepunt hierboven (streams ONTBREKEN, dus de `if`-guard blijft dicht en de `try` in
  // `scanGroundTruthTasks` wordt nooit betreden), gaat déze fixture WEL de `try` in en laat
  // `FixedMeta.withHeuristicItemSize` (via `withItemSize`'s magic-controle) daadwerkelijk gooien —
  // dus wordt de `catch`-tak zelf bereikt en geoefend, niet alleen de guard ervoor. Zonder deze
  // fixture zou een kapotte `catch` (bv. per ongeluk een rethrow) door geen enkele bestaande case
  // gevangen worden. Mutatiebewijs (uitgevoerd, zie het commitbericht): de `catch`-body in
  // `mppGroundTruth.ts` tijdelijk vervangen door `throw err;` maakte UITSLUITEND de "geen
  // exceptie"-assertie hieronder rood — alle andere Z1-fixtures (die nooit een corrupte stream
  // hebben) bleven groen, wat bevestigt dat dit de enige fixture is die de `catch` echt raakt. ────
  {
    const corrupt: Z1TaskSpec = {
      uniqueId: 501, id: 1, name: 'CorruptFixed2Meta', manual: true,
      schedStart: { time: 4800, days: 15300 }, schedFinish: { time: 9600, days: 15300 },
      rawStart: { time: 7200, days: 15302 }, rawFinish: { time: 9600, days: 15303 }, // moet GENEGEERD worden
    };
    const bytes = buildZ1Fixture({ tasks: [corrupt], corruptFixed2Meta: true });
    let threw: string | null = null;
    let raws: ReturnType<typeof scanGroundTruthTasks>['raws'] = [];
    try {
      ({ raws } = scanGroundTruthTasks(bytes));
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`Z1 onparsebare Fixed2Meta (ongeldig magic-getal): geen exceptie (${threw ?? ''})`, threw === null);
    eq('Z1 onparsebare Fixed2Meta: 1 taak gelezen', raws.length, 1);
    if (raws.length === 1) {
      truthy('Z1 onparsebare Fixed2Meta: valt terug op SCHEDULED_START (rauwe TASK_MODE-bit onleesbaar)', raws[0].start?.getTime() === z1ExpectedDate(corrupt.schedStart).getTime());
      truthy('Z1 onparsebare Fixed2Meta: valt terug op SCHEDULED_FINISH (rauwe TASK_MODE-bit onleesbaar)', raws[0].finish?.getTime() === z1ExpectedDate(corrupt.schedFinish).getTime());
    }
  }

  // ── Vijandige fixture (hardening-checklist §8): Fixed2Data ONTBREEKT niet, maar het item van de
  // taak zelf is korter dan de FINISH-offset (54+4=58) — moet netjes `null` geven i.p.v. een
  // out-of-bounds-crash, en de taak valt terug op SCHEDULED_START/FINISH (dezelfde
  // `resolveScheduleField`-regel als bij een ontbrekende stream: raw === null ⇒ scheduled). ─────
  {
    const truncated: Z1TaskSpec = {
      uniqueId: 401, id: 1, name: 'TruncatedFixed2', manual: true,
      schedStart: { time: 4800, days: 15200 }, schedFinish: { time: 9600, days: 15200 },
      rawStart: { time: 7200, days: 15202 }, rawFinish: { time: 9600, days: 15203 },
    };
    // Eén taak op index 3 ⇒ itemOffset = 3 * 72 = 216; het item krijgt daardoor een LOKALE lengte
    // van 30 bytes (bytes.length − itemOffset, want dit is het laatste item) — dat dekt START
    // (lokale offset 50, nodig: ≥54 bytes) NIET, en FINISH (lokale offset 54, nodig: ≥58 bytes)
    // ook niet. Beide velden vallen dus terug op SCHEDULED_START/FINISH — precies de grens die
    // `data2.length >= offset + 4` per veld bewaakt (T16-fixronde-correctie: een eerdere versie
    // van dit commentaar beweerde ten onrechte dat START "nog half" gedekt zou zijn).
    const bytes = buildZ1Fixture({ tasks: [truncated], fixed2DataTruncateTo: 216 + 30 });
    let threw: string | null = null;
    let raws: ReturnType<typeof scanGroundTruthTasks>['raws'] = [];
    try {
      ({ raws } = scanGroundTruthTasks(bytes));
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`Z1 vijandige fixture (afgekapt Fixed2Data-item): geen exceptie (${threw ?? ''})`, threw === null);
    eq('Z1 vijandige fixture: 1 taak gelezen', raws.length, 1);
    if (raws.length === 1) {
      truthy('Z1 vijandige fixture: valt terug op SCHEDULED_START (rauwe START niet leesbaar)', raws[0].start?.getTime() === z1ExpectedDate(truncated.schedStart).getTime());
      truthy('Z1 vijandige fixture: valt terug op SCHEDULED_FINISH (rauwe FINISH niet leesbaar)', raws[0].finish?.getTime() === z1ExpectedDate(truncated.schedFinish).getTime());
    }
  }
}

// ── Corpuswortels (T1-conventie, plan §"Corpuswortels") ───────────────────────────────────────
const CORPUS = process.env.OPS_MPP_CORPUS ?? '/home/nozzit/open-aec/voor claude/test bestanden voor file implementation';
const CRAWL = process.env.OPS_MPP_CRAWL ?? '/home/nozzit/open-aec/voor claude/testdata-crawl';

type RootName = 'corpus' | 'crawl';

// L2 (reviewbevinding): entries per map sorteren — `readdirSync` garandeert GEEN volgorde
// (filesystem-afhankelijk), en de pad-pariteitscase hieronder kiest "het eerste bruikbare bestand"
// tijdens de scan. Zonder sortering kan die keuze tussen machines/runs wisselen, wat de
// pariteitscase non-deterministisch maakt. Nit (reviewbevinding): een kale `<`-vergelijking op de
// UTF-16-code-units i.p.v. `localeCompare` — die laatste hangt af van de ICU-/locale-configuratie
// van de machine (Node kan met of zonder volledige ICU-data gebouwd zijn) en zou dus in theorie
// zelf een bron van machine-afhankelijkheid kunnen worden, precies wat deze sortering juist moet
// uitsluiten. `<`/`>` op strings is altijd codepoint-ordening, overal identiek.
function listMppFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMppFilesRecursive(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mpp')) out.push(full);
  }
  return out;
}

function hashOf(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 16);
}

/** L4: de ENIGE plek die een bestand naar tekst voor menselijke/CI-uitvoer omzet — corpusbestanden
 *  UITSLUITEND als hash, crawlbestanden met hun (publieke, ongevoelige) relatieve pad. */
function tagFor(root: RootName, hash: string, label: string | undefined): string {
  return root === 'crawl' ? (label ?? hash) : hash;
}

// ── Baseline-schema (plan §6, root-veld: reviewbevinding H1) ────────────────────────────────
interface BaselineEntry {
  root: RootName;
  /** Alleen voor crawl-bestanden (publiek materiaal) — bedrijfsbestanden blijven ongelabeld. */
  label?: string;
  tasks: number;
  startExact: number;
  startSameday: number;
  startDiff: number;
  finishExact: number;
  finishSameday: number;
  finishDiff: number;
  /** LOW (§T15-eis, eindreview T16c): VERPLICHT voor elk bewust-gepind bestand met ≥1 start-/
   *  finish-afwijking (`hasDiff` hieronder) — een korte, geschreven reden mét dossierverwijzing
   *  (§H1/H2 "6 bestanden zonder melding", of het relevante (c)-dossier/§1.4-uitzondering in
   *  het plandocument). Afwezig bij een 100%-exact bestand (niets te verantwoorden). Bewaakt door
   *  `assertPinnedDiffsHaveReason` hieronder — géén stille (c)-pin meer zonder geschreven reden. */
  reason?: string;
}
interface Baseline {
  files: Record<string, BaselineEntry>;
}
/** ≥1 start- of finish-afwijking (bewust NIET sameday — zie mppFidelity.ts se FidelityRow-doc).
 *  Gederiveerd uit de per-bestand-pins zelf, niet als los, potentieel afdrijvend veld bijgehouden
 *  (vóór deze review was dit een apart top-level `diffFiles`-veld dat uit de pas kon lopen met de
 *  per-bestand-tellingen als iemand de baseline met de hand bewerkt). */
function hasDiff(e: Pick<BaselineEntry, 'startDiff' | 'finishDiff'>): boolean {
  return e.startDiff > 0 || e.finishDiff > 0;
}

const BASELINE_PATH = join(HERE, 'mpp-fidelity-baseline.json');
let baseline: Baseline = { files: {} };
// LOW (eindreview T16c): ook in `baseline`-modus (herpinnen) wordt de HUIDIGE baseline gelezen —
// uitsluitend om een bestaand `reason`-veld per hash te kunnen doorgeven aan de nieuwe pin (zie de
// `reason`-overname hieronder). Een absent/kapot bestand is in déze modus geen fout (het eerste-
// keer-pinnen-scenario): geen `checks`/`diffs`-vervuiling, gewoon een lege startbaseline.
if (REPORT !== 'baseline') {
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as Baseline;
  } catch (err) {
    checks++;
    diffs.push(`mpp-fidelity-baseline.json kon niet gelezen/geparsed worden: ${err instanceof Error ? err.message : String(err)}`);
  }
} else {
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as Baseline;
  } catch {
    // Stil: eerste-keer-pinnen of een kapot bestand — regeneratie gaat gewoon door zonder
    // `reason`-overname. Zie de toelichting hierboven.
  }
}

// ── Rapport-accumulator voor OPS_MPP_FIDELITY_REPORT=baseline (print, schrijft NOOIT zelf) ─────
const reportEntries: Record<string, BaselineEntry> = {};

// ── Bijhouden PER WORTEL (reviewbevinding H1) ───────────────────────────────────────────────
const seenPinnedHashesByRoot: Record<RootName, Set<string>> = { corpus: new Set(), crawl: new Set() };
const actualDiffHashesByRoot: Record<RootName, Set<string>> = { corpus: new Set(), crawl: new Set() };
let rejectedCount = 0;
let firstUsableFile: { path: string; bytes: Uint8Array; root: RootName; hash: string; label: string | undefined } | null = null;

// ── Delta-slotregel (coordinator-verzoek, ná de Opus-review) — GEEN poort, puur leesbaarheid:
// telt per gepind bestand of het totaal (startDiff+finishDiff) t.o.v. de pin verbeterd/verslechterd/
// gelijk is, zodat een andere baan in één regel ziet welke KANT een rode run op wijst — zonder de
// per-bestand-per-veld-pins hierboven te vervangen (dit is een SOM, en §5 waarschuwt expliciet dat
// een som compenserende wijzigingen verdoezelt; die pins blijven dus de echte poort).
//
// T13-B-FIX: "verslechterd" hieronder is EXPLICIET "op de som" — een gemengd bestand
// (bv. −7 start-afwijkingen/+3 finish-afwijkingen) telt op de som als VERBETERD, ook al is er
// een veld dat echt slechter werd. Dat is precies wat T13's hermeting op één bestand liet zien
// ("OzBuild Workshop 14 After Para 28": startDiff 8→1, finishDiff 11→14 — som 19→15, dus
// "verbeterd", terwijl finishDiff wél steeg). Om dat niet stil te laten wegvallen achter de
// som-regel telt `fieldRegressedTags` PER VELD (`startDiff`/`finishDiff`, niet de som): een
// bestand telt hier zodra ook maar ÉÉN teller t.o.v. de pin steeg — onafhankelijk van wat de
// andere tellers van hetzelfde bestand doen. Dit is, net als de som-regel, GEEN poort (de
// per-bestand-per-veld-pins hierboven blijven de enige echte poort) — puur een tweede, eerlijkere
// leesbare regel naast de eerste.
let improvedFiles = 0, regressedFiles = 0, unchangedFiles = 0, netDiffDelta = 0;
const fieldRegressedTags: string[] = [];

/** OPS_MPP_FIDELITY_REPORT=detail: print CORPUSINHOUD (taaknamen, kalender-id's, voorgangernamen)
 *  — niet alleen een identificerende tag zoals `tagFor()`. Bedoeld voor lokaal, interactief gebruik
 *  (plan §5); nooit naar een commit/PR/CI-log kopiëren. */
function printDetail(tag: string, row: FidelityRow) {
  if (row.diffTasks.length === 0) return;
  console.log(`   . [detail ${tag}] ${row.diffTasks.length} afwijkende taak/taken:`);
  console.log('     ID | naam | MSP-start | onze-ES | MSP-finish | onze-EF | dur(d) | ms | cons | %c | actS | cal | preds');
  for (const d of row.diffTasks) {
    console.log(
      `     ${d.id.padStart(4)} ${d.name.slice(0, 24).padEnd(24)} ${String(d.msStart).padEnd(16)} `
      + `${d.startMark}${d.ourStart.padEnd(16)} ${String(d.msFinish).padEnd(16)} ${d.finishMark}${d.ourFinish.padEnd(16)} `
      + `${d.durationDays.toFixed(3).padStart(8)} ${d.isMilestone ? 'M' : ' '} ${d.constraint.padEnd(10)} `
      + `${String(d.completionPct).padStart(3)} ${d.actualStart.padEnd(11)} ${d.calendarId.slice(0, 8).padEnd(8)} ${d.preds.slice(0, 50)}`,
    );
  }
  if (Object.keys(row.diffBuckets).length > 0) {
    console.log(`     attribuut-emmers: ${JSON.stringify(row.diffBuckets)}`);
  }
}

/** Verwerk één gelezen bestand: meet, pin-check (of baseline-accumulatie), rapportage. Elke
 *  diagnoseregel gebruikt `tagFor()` (L4) — nooit rechtstreeks `path`. */
function processFile(path: string, bytes: Uint8Array, root: RootName, label: string | undefined) {
  const row = measureFidelity(bytes);
  const hash = hashOf(bytes);
  const tag = tagFor(root, hash, label);

  if (row.status === 'rejected') {
    rejectedCount++;
    return; // MPP_LEGACY/MPP_ENCRYPTED — overgeslagen, nooit een fout (O7).
  }
  if (row.status === 'error') {
    checks++;
    diffs.push(`[${tag}] measureFidelity gaf status 'error': ${row.errMsg ?? '(geen boodschap)'}`);
    return;
  }

  // status === 'ok'
  if (!firstUsableFile && row.tasks > 0) firstUsableFile = { path, bytes, root, hash, label };

  if (hasDiff(row)) actualDiffHashesByRoot[root].add(hash);
  if (REPORT === 'detail') printDetail(tag, row);

  if (REPORT === 'baseline') {
    // LOW (eindreview T16c): `reason` overnemen uit de HUIDIGE pin voor dit hash (zie de laad-
    // toelichting hierboven) — een herpin zonder gedragswijziging op een al-verantwoord bestand
    // mag de geschreven reden niet stilzwijgend laten vallen. Bij een NIEUW afwijkend bestand
    // (geen bestaande pin, of de bestaande pin was 100% exact) blijft `reason` afwezig — de mens
    // die herpint moet 'm dan zelf toevoegen (zie `assertPinnedDiffsHaveReason` se poort hieronder,
    // die ná het plakken van deze uitvoer weer aanslaat als de reden ontbreekt).
    const existingReason = baseline.files[hash]?.reason;
    reportEntries[hash] = {
      root,
      ...(label ? { label } : {}),
      tasks: row.tasks,
      startExact: row.startExact, startSameday: row.startSameday, startDiff: row.startDiff,
      finishExact: row.finishExact, finishSameday: row.finishSameday, finishDiff: row.finishDiff,
      ...(existingReason ? { reason: existingReason } : {}),
    };
    return;
  }

  const pin = baseline.files[hash];
  if (!pin) {
    checks++;
    diffs.push(`[${tag}] niet gepind in mpp-fidelity-baseline.json — herpin via OPS_MPP_FIDELITY_REPORT=baseline`);
    return;
  }
  seenPinnedHashesByRoot[root].add(hash);
  eq(`[${tag}] tasks`, row.tasks, pin.tasks);
  eq(`[${tag}] startExact`, row.startExact, pin.startExact);
  eq(`[${tag}] startSameday`, row.startSameday, pin.startSameday);
  eq(`[${tag}] startDiff`, row.startDiff, pin.startDiff);
  eq(`[${tag}] finishExact`, row.finishExact, pin.finishExact);
  eq(`[${tag}] finishSameday`, row.finishSameday, pin.finishSameday);
  eq(`[${tag}] finishDiff`, row.finishDiff, pin.finishDiff);

  // LOW (§T15-eis, eindreview T16c): een bewust-gepind bestand met ≥1 afwijking moet een
  // geschreven `reason` dragen — "pinnen mag alleen met een geschreven, gemeten reden" (§T15
  // Uitgangscriterium). Dit is een POORT, niet documentatie: een nieuw afwijkend bestand dat
  // zonder reden gepind wordt (of een bestaand bestand waarvan de reden per ongeluk verdwijnt bij
  // een herpin) faalt hier expliciet, i.p.v. stilzwijgend als "gewoon een pin" door te glippen.
  if (hasDiff(pin)) {
    checks++;
    if (!pin.reason || pin.reason.trim().length === 0) {
      diffs.push(`[${tag}] gepind MET afwijking maar ZONDER "reason" — §T15 eist een geschreven, gemeten reden (dossierverwijzing) bij elke bewuste (c)-pin`);
    }
  }

  // Delta-slotregel-boekhouding (zie de toelichting bij de accumulatoren) — puur informatief.
  const before = pin.startDiff + pin.finishDiff;
  const after = row.startDiff + row.finishDiff;
  if (after < before) improvedFiles++;
  else if (after > before) regressedFiles++;
  else unchangedFiles++;
  netDiffDelta += before - after; // positief = netto verbetering t.o.v. de pin (OP DE SOM)

  // T13-B-FIX: per-veld regressie, onafhankelijk van de som hierboven (zie de moduleheader-uitleg
  // bij `fieldRegressedTags`). Bewust smal, symmetrisch met `hasDiff()`/de globale pins hierboven:
  // alleen `startDiff`/`finishDiff` zelf, NIET een verschuiving tussen `Exact`↔`Sameday` (dat is
  // een precisieverlies binnen "matcht", geen nieuwe afwijking) — anders zou deze regel ruis geven
  // op elke sameday↔exact-schommeling die niets met de "som verdoezelt een veld"-zorg te maken heeft.
  if (row.startDiff > pin.startDiff || row.finishDiff > pin.finishDiff) {
    fieldRegressedTags.push(tag);
  }
}

// ── OPS_MPP_CORPUS — geen label (bedrijfsbestanden, plan §6) ────────────────────────────────
const corpusDirExists = existsSync(CORPUS);
const corpusFiles = corpusDirExists ? listMppFilesRecursive(CORPUS) : [];
// H1: een aanwezige maar LEGE map gedraagt zich als afwezig — geen globale-pin-assert erop.
const corpusScanned = corpusFiles.length > 0;
if (!corpusDirExists) {
  console.log('OK  mpp-fidelity: corpus niet aanwezig (OPS_MPP_CORPUS) — corpuslus overgeslagen');
} else if (!corpusScanned) {
  console.log(`OK  mpp-fidelity: corpusmap aanwezig maar geen .mpp-bestanden erin (${CORPUS}) — corpuslus overgeslagen`);
} else {
  for (const path of corpusFiles) {
    processFile(path, new Uint8Array(readFileSync(path)), 'corpus', undefined);
  }
  console.log(`   . [corpus] ${corpusFiles.length} bestand(en) gescand`);
}

// ── OPS_MPP_CRAWL — leesbaar label toegestaan (publiek materiaal, plan §6) ──────────────────
const crawlDirExists = existsSync(CRAWL);
const crawlFiles = crawlDirExists ? listMppFilesRecursive(CRAWL) : [];
const crawlScanned = crawlFiles.length > 0;
if (!crawlDirExists) {
  console.log('OK  mpp-fidelity: crawl niet aanwezig (OPS_MPP_CRAWL) — crawllus overgeslagen');
} else if (!crawlScanned) {
  console.log(`OK  mpp-fidelity: crawlmap aanwezig maar geen .mpp-bestanden erin (${CRAWL}) — crawllus overgeslagen`);
} else {
  for (const path of crawlFiles) {
    const label = relative(CRAWL, path).split(sep).join('/');
    processFile(path, new Uint8Array(readFileSync(path)), 'crawl', label);
  }
  console.log(`   . [crawl] ${crawlFiles.length} bestand(en) gescand`);
}

console.log(`   . ${rejectedCount} bestand(en) overgeslagen (MPP_LEGACY/MPP_ENCRYPTED — O7, telt niet als fout)`);

// ── OPS_MPP_FIDELITY_REPORT=baseline: print en klaar (schrijft nooit zelf, plan §6) ────────────
if (REPORT === 'baseline') {
  // GEEN replacer-array op JSON.stringify hier: die filtert RECURSIEF op elk niveau — een
  // top-level-sleutellijst als replacer zou dus ook de hash-sleutels BINNEN `files` wegfilteren.
  // Sorteer de bestandssleutels expliciet vóór het serialiseren.
  const sortedFiles: Record<string, BaselineEntry> = {};
  for (const hash of Object.keys(reportEntries).sort()) sortedFiles[hash] = reportEntries[hash];
  const out: Baseline = { files: sortedFiles };
  console.log('#BASELINE ' + JSON.stringify(out, null, 2));
  process.exit(0);
}

// ── Z20 — GOAL_ZERO_DEVIATIONS: de eindpoort (plan §1.1/§Z20, uitgangscriterium van Z19). ──────
// Werkt UITSLUITEND op het GELADEN baselinebestand zelf (`baseline.files`) — niet op de live
// corpus-/crawlscan — en draait dus ook op een machine zonder corpus/crawl (CI incluis, want
// `mpp-fidelity-baseline.json` zit wél in de repo). Dat is precies het punt: een teruggezette
// `reason`-pin of een niet-nul-teller in het GECOMMITTE bestand maakt de suite overal rood, niet
// alleen op de ene machine die toevallig het corpus mount. Overvleugelt de bestaande "reason bij
// afwijking"-poort hierboven (§T15/`hasDiff(pin)`-blok in `processFile`) zonder die weg te halen:
// die poort blijft de wacht tijdens de etappe (een afwijking zonder reden was al fout), maar met
// nul afwijkingen als doel is een reason-pin per definitie fout, ongeacht of hij geschreven en
// gemeten is — vandaar een aparte, strengere poort in plaats van de bestaande te verzwakken.
const GOAL_ZERO_DEVIATIONS = true;
if (GOAL_ZERO_DEVIATIONS) {
  for (const [hash, entry] of Object.entries(baseline.files)) {
    const tag = tagFor(entry.root, hash, entry.label);
    checks++;
    if (entry.startDiff !== 0 || entry.startSameday !== 0 || entry.finishDiff !== 0 || entry.finishSameday !== 0) {
      diffs.push(
        `[GOAL_ZERO_DEVIATIONS ${tag}] niet-nul teller in de baseline (startDiff=${entry.startDiff}, `
        + `startSameday=${entry.startSameday}, finishDiff=${entry.finishDiff}, finishSameday=${entry.finishSameday}) `
        + '— de etappedoelstelling is "nul, punt uit" (plan §1.1, orkestratorbesluit O1)',
      );
    }
    checks++;
    if (entry.startExact !== entry.tasks || entry.finishExact !== entry.tasks) {
      diffs.push(
        `[GOAL_ZERO_DEVIATIONS ${tag}] exact-tellers dekken niet alle taken (tasks=${entry.tasks}, `
        + `startExact=${entry.startExact}, finishExact=${entry.finishExact}) — een 'missing'-`
        + 'classificatie (taak zonder grondwaarheid) telt in geen van de vier nul-tellers mee en '
        + 'zou anders stil door de corpusloze poort glippen (eindreview-bevinding F1; plan §1.1 '
        + 'eist tasks === startExact === finishExact)',
      );
    }
    checks++;
    if ('reason' in entry) {
      diffs.push(
        `[GOAL_ZERO_DEVIATIONS ${tag}] draagt nog een "reason"-sleutel — met nul afwijkingen als doel `
        + 'is er niets meer te verantwoorden; "pinnen met reden" bestaat niet meer als uitweg (plan §1.1/Z19)',
      );
    }
  }
}

// ── Globale pins, PER WORTEL (reviewbevinding H1) ───────────────────────────────────────────
// Alleen zinvol (en alleen uitgevoerd) voor een wortel die dit keer DAADWERKELIJK gescand is —
// anders zou een afwezig/leeg corpus of crawl (de normale situatie voor wie niet op deze ene
// machine werkt) hier alsnog een globale mismatch geven en de C3-conventie breken ("corpus/crawl-
// afwezig beïnvloedt nooit de einduitslag", plan §5).
function assertRootPins(root: RootName) {
  const pinnedForRoot = Object.entries(baseline.files).filter(([, v]) => v.root === root);
  eq(`globaal[${root}]: aantal gepinde bestanden dat daadwerkelijk gezien is`, seenPinnedHashesByRoot[root].size, pinnedForRoot.length);

  const expectedDiff = new Set(pinnedForRoot.filter(([, v]) => hasDiff(v)).map(([h]) => h));
  const actualDiff = actualDiffHashesByRoot[root];
  // L3: symmetrisch verschil printen i.p.v. twee volledige (soms tientallen hashes lange) arrays —
  // een mens leest "ontbreekt/nieuw" in één oogopslag, twee volle JSON-arrays niet.
  const missingFromScan = [...expectedDiff].filter((h) => !actualDiff.has(h)).sort();
  const unexpectedInScan = [...actualDiff].filter((h) => !expectedDiff.has(h)).sort();
  checks++;
  if (missingFromScan.length > 0 || unexpectedInScan.length > 0) {
    const missingLabels = missingFromScan.map((h) => tagFor(root, h, baseline.files[h]?.label));
    const unexpectedLabels = unexpectedInScan.map((h) => tagFor(root, h, baseline.files[h]?.label));
    diffs.push(
      `globaal[${root}]: verzameling bestanden met ≥1 afwijking wijkt af van de gepinde verzameling — `
      + `mist in de scan (was gepind als afwijkend, nu niet meer gezien): [${missingLabels.join(', ')}]; `
      + `nieuw/onverwacht afwijkend: [${unexpectedLabels.join(', ')}]`,
    );
  }
}
if (corpusScanned) assertRootPins('corpus');
if (crawlScanned) assertRootPins('crawl');

// Delta-slotregel: één leesbare regel voor welke KANT een rode/groene run op wijst t.o.v. de
// gepinde baseline — geen assert, alleen een samenvatting bovenop de per-bestand-pins hierboven.
// T13-B-FIX: "verslechterd" hier is EXPLICIET "(op de som)" — zie `fieldRegressedTags` hierboven
// voor de eerlijkere, per-veld tegenhanger die een gemengd bestand (som verbeterd, één veld toch
// slechter) niet laat wegvallen.
if (improvedFiles + regressedFiles + unchangedFiles > 0) {
  const richting = netDiffDelta > 0 ? 'netto verbeterd' : netDiffDelta < 0 ? 'netto VERSLECHTERD' : 'netto ongewijzigd';
  console.log(
    `   . delta t.o.v. mpp-fidelity-baseline.json: ${improvedFiles} bestand(en) verbeterd (op de som), `
    + `${regressedFiles} verslechterd (op de som), ${unchangedFiles} ongewijzigd — ${richting} `
    + `(${netDiffDelta >= 0 ? '-' : '+'}${Math.abs(netDiffDelta)} start+finish-afwijkingen)`,
  );
  if (fieldRegressedTags.length > 0) {
    console.log(
      `   . waarschuwing: ${fieldRegressedTags.length} bestand(en) hebben startDiff of finishDiff ZIEN STIJGEN `
      + `t.o.v. de pin, ook al is de SOM voor dat bestand gelijk of beter — dus NIET per se in de `
      + `"verslechterd (op de som)"-telling hierboven: [${fieldRegressedTags.join(', ')}]`,
    );
  }
}

// ── T1-acceptatie: pad-pariteitscase — de ECHTE store (applyLoadedProject+runCPM, patroon
// check-mpp-open-guard.ts) tegen mppFidelity's solveMppBytes op HETZELFDE bestand. Wijken die af,
// dan meet deze suite iets anders dan wat de gebruiker in de app krijgt. ──────────────────────────
if (!firstUsableFile) {
  console.log('OK  mpp-fidelity: geen bruikbaar bestand (0 taken of geen corpus/crawl) — pad-pariteitscase overgeslagen');
} else {
  const { bytes: parityBytes, root: parityRoot, hash: parityHash, label: parityLabel } = firstUsableFile;
  const parityTag = tagFor(parityRoot, parityHash, parityLabel);
  const direct = solveMppBytes(parityBytes);

  const S = () => useAppStore.getState();
  S().newProject();
  S().applyLoadedProject(readMPP(parityBytes), {
    filePath: null, recompute: true, fit: false, hourDataNotice: false, linkedOpen: true,
  });

  // Join op ARRAY-POSITIE, niet op `id`: `readMPP` geeft elke taak een VERSE id
  // (`src/utils/id.ts`: tijd+random) — twee losse `readMPP(parityBytes)`-aanroepen op DEZELFDE
  // bytes leveren dus nooit gelijke id's, ook al is de rest identiek. De volgorde is wél
  // deterministisch (beide kanten sorteren op MS Projects eigen taak-ID), dus positioneel
  // vergelijken is hier het juiste join — bevestigd door een handmatige steekproef (namen op
  // gelijke index kwamen exact overeen vóór deze fix er was).
  eq(`[pad-pariteit ${parityTag}] taakaantal store === direct`, S().tasks.length, direct.tasks.length);
  let mismatched = 0;
  const storeTasks = S().tasks;
  const n = Math.min(storeTasks.length, direct.tasks.length);
  for (let i = 0; i < n; i++) {
    const st = storeTasks[i];
    const dt = direct.tasks[i];
    if (st.name !== dt.name || st.time.earlyStart !== dt.time.earlyStart || st.time.earlyFinish !== dt.time.earlyFinish) mismatched++;
  }
  eq(`[pad-pariteit ${parityTag}] alle taken (positioneel): store naam+earlyStart+earlyFinish === solveMppBytes (mismatches)`, mismatched, 0);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  mpp-fidelity: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  mpp-fidelity: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
