// Opslaan als op de desktop: het opslagvenster geeft toestemming (scope) en stelt de overschrijfvraag voor de naam
// die het teruggeeft. Op Linux/GTK komt een getypte naam zonder extensie terug (`kopie`); de app schrijft `kopie.ifc`.
// Deze batterij bewijst dat de app de eindnaam dan nog één keer door het venster haalt als die buiten de scope valt of
// al bestaat, en anders bij één venster blijft (`pickSavePathTauri` in `tauriBackend.ts`).
//
// Nagebootst: de ECHTE plugin-fs- en plugin-dialog-JS-clients via nep-IPC (`nodeFileIpc.ts`) op Node-fs. Het venster
// hieronder geeft, zoals plugin-dialog 2.7.0 (`commands.rs` `save`: `allow_file`), het pad vrij dat het teruggeeft, in
// de twee vormen die tauri 2.12.3 `push_pattern` opneemt: zoals gegeven, en met `canonicalize_parent` (`scope/fs.rs`:
// de dichtstbijzijnde bestaande voorouder canoniek, de rest erachter). Het stelt zoals GTK (rfd 0.16.0,
// `gtk_file_chooser_set_do_overwrite_confirmation`) de overschrijfvraag voor dat pad. Hoe plugin-fs een pad tegen de
// scope legt, staat per versie in `SCOPE_RULES`. Niet bewezen: de echte Rust-scope, het echte venster, Windows/macOS.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { installNodeFileIpc, realPath, writeFileCall } from './nodeFileIpc';
import {
  saveBytePartsDialogTauri, saveBytesDialogTauri, saveFileDialogTauri,
} from '@/services/fileAccess/tauriBackend';
import type { FileRef, SaveOutcome } from '@/services/fileAccess';

const FILTERS = [{ name: 'IFC', extensions: ['ifc'] }];
const NEW_TEXT = 'NIEUWE INHOUD\r\n';
const OLD_TEXT = 'OUDE INHOUD\n';

/** tauri 2.12.3 `canonicalize_parent` (`scope/fs.rs:162-191`): het pad canoniek, of anders zijn dichtstbijzijnde
 *  voorouder die canoniek te maken is, met de overige delen erachter (een dode link telt als niet te maken). */
function canonicalParent(p: string): string {
  try { return fs.realpathSync.native(p); } catch { /* bestaat niet: één map hoger */ }
  const parent = path.dirname(p);
  return parent === p ? p : path.join(canonicalParent(parent), path.basename(p));
}

/**
 * Hoe plugin-fs een pad tegen de scope legt, per versie één regel, met wat de app in een map in de thuismap doet die
 * een link naar buiten is: hoeveel vensters een nieuwe naam zonder extensie kost (`linkDialogs`), en of het hulpbestand
 * `save-<id>.ops-save.tmp` daar achterblijft (`linkHelperLeft`).
 */
const SCOPE_RULES: { plugin: string; scopePath: (p: string) => string; linkDialogs: number; linkHelperLeft: boolean }[] = [
  // plugin-fs 2.5.0 + tauri 2.12.3 `is_allowed`: bestaat het pad, dan het opgeloste pad; anders het pad zoals gegeven.
  // Het nieuwe hulpbestand mag dus (lexicaal onder `$HOME`), maar `rename` en `remove` ervan niet (opgelost buiten).
  { plugin: 'plugin-fs 2.5.0', scopePath: p => (fs.existsSync(p) ? fs.realpathSync(p) : p), linkDialogs: 1, linkHelperLeft: true },
  // plugin-fs 2.7.1 `resolve_path` (`commands.rs:1615-1657`): de toestemming geldt het echte pad (`resolve_real_path`),
  // ook de voorouders van een nieuw pad. `kopie.ifc` naast een gekozen `kopie` is dan niet vrij (tweede venster), en het
  // hulpbestand wordt al bij het aanmaken geweigerd: Opslaan schrijft direct (knownbug 1752).
  { plugin: 'plugin-fs 2.7.1', scopePath: p => realPath(p), linkDialogs: 2, linkHelperLeft: false },
];

let passed = 0;
let failed = 0;
async function check(name: string, run: () => Promise<void>) {
  try { await run(); passed++; console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`XX ${name}`, error); }
}

/** Wat de gebruiker in één venster doet: een pad kiezen (met de overschrijfvraag als dat pad bestaat), of annuleren. */
type Round = { pick: string; overwrite?: boolean } | 'annuleren';
interface SeenRound { defaultPath: string | undefined; askedOverwrite: boolean }

type Variant = 'tekst' | 'bytes' | 'byte-delen';
const VARIANTS: Variant[] = ['tekst', 'bytes'];

async function main() {
  for (const rule of SCOPE_RULES) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ops-save-dialog-ext-')));
    const home = path.join(root, 'home');
    const outside = path.join(root, 'buiten');
    const ipc = installNodeFileIpc();
    const granted = new Set<string>();
    const inScope = (p: string) => {
      const q = rule.scopePath(p);
      return q.startsWith(home + path.sep) || granted.has(q);
    };
    ipc.faults.forbidden = p => !inScope(p);

    // Het venster: geeft het gekozen pad terug en zet alleen dat pad in de scope.
    let rounds: Round[] = [];
    let seen: SeenRound[] = [];
    const internals = (globalThis as unknown as { window: { __TAURI_INTERNALS__: { invoke: (...a: unknown[]) => Promise<unknown> } } })
      .window.__TAURI_INTERNALS__;
    const nodeInvoke = internals.invoke;
    internals.invoke = async (command: unknown, args: unknown, options: unknown) => {
      // plugin-fs `rename` en `remove` toetsen elk pad via `resolve_path`; de adapter zelf toetst ze niet.
      if (command === 'plugin:fs|rename') {
        const a = args as { oldPath: string; newPath: string };
        for (const p of [a.oldPath, a.newPath]) if (!inScope(p)) throw `forbidden path: ${p}`;
      }
      if (command === 'plugin:fs|remove') {
        const p = (args as { path: string }).path;
        if (!inScope(p)) throw `forbidden path: ${p}`;
      }
      if (command !== 'plugin:dialog|save') return nodeInvoke(command, args, options);
      const round = rounds.shift();
      // Een venster dat de proef niet verwachtte: hard stoppen in plaats van een eindeloze lus.
      if (round === undefined) throw new Error('onverwacht extra opslagvenster');
      const shown: SeenRound = { defaultPath: (args as { options: { defaultPath?: string } }).options.defaultPath, askedOverwrite: false };
      seen.push(shown);
      if (round === 'annuleren') return null;
      if (fs.existsSync(round.pick)) {
        shown.askedOverwrite = true;
        // GTK: "Nee" op de overschrijfvraag laat het venster open; de proef annuleert dan.
        if (!round.overwrite) return null;
      }
      // `allow_file` → `push_pattern`: het pad zoals gegeven én in de vorm van `canonicalize_parent`.
      granted.add(round.pick);
      granted.add(canonicalParent(round.pick));
      return round.pick;
    };

    const reset = () => {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
      fs.mkdirSync(home);
      fs.mkdirSync(outside);
      granted.clear();
      seen = [];
    };
    const save = async (variant: Variant, script: Round[], refuseTarget?: (ref: FileRef) => Promise<boolean>) => {
      rounds = script;
      const opts = { refuseTarget: refuseTarget ?? null };
      let outcome: SaveOutcome | null;
      if (variant === 'tekst') outcome = await saveFileDialogTauri('standaard.ifc', NEW_TEXT, FILTERS, opts);
      else if (variant === 'bytes') outcome = await saveBytesDialogTauri('standaard.ifc', Buffer.from(NEW_TEXT), FILTERS, opts);
      else outcome = await saveBytePartsDialogTauri('standaard.ifc', [Buffer.from(NEW_TEXT)], FILTERS, opts);
      assert.equal(rounds.length, 0, 'elk verwacht venster is getoond');
      return outcome;
    };
    const savedTo = (outcome: SaveOutcome | null, file: string) => {
      assert.deepEqual(outcome?.ref, { kind: 'path', path: file });
      assert.equal(outcome?.name, path.basename(file));
      assert.equal(fs.readFileSync(file, 'utf8'), NEW_TEXT);
    };
    const tag = `${rule.plugin}`;

    try {
      for (const variant of ['tekst', 'bytes', 'byte-delen'] as Variant[]) {
        await check(`${tag} (a) ${variant}: buiten de thuismap zonder extensie → tweede venster met de volle naam`, async () => {
          reset();
          const typed = path.join(outside, 'kopie'), full = `${typed}.ifc`;
          const outcome = await save(variant, [{ pick: typed }, { pick: full }]);
          assert.deepEqual(seen.map(r => r.defaultPath), ['standaard.ifc', full]);
          savedTo(outcome, full);
          assert.deepEqual(fs.readdirSync(outside), ['kopie.ifc']);
        });
      }

      for (const variant of VARIANTS) {
        await check(`${tag} (b) ${variant}: eindnaam bestaat al → tweede venster stelt de overschrijfvraag, bevestigen vervangt`, async () => {
          reset();
          const typed = path.join(home, 'kopie'), full = `${typed}.ifc`;
          fs.writeFileSync(full, OLD_TEXT);
          const outcome = await save(variant, [{ pick: typed }, { pick: full, overwrite: true }]);
          assert.deepEqual(seen, [
            { defaultPath: 'standaard.ifc', askedOverwrite: false },
            { defaultPath: full, askedOverwrite: true },
          ]);
          savedTo(outcome, full);
        });
        await check(`${tag} (b) ${variant}: eindnaam bestaat al, overschrijven geweigerd → oud bestand bytegelijk, geen fout`, async () => {
          reset();
          const typed = path.join(home, 'kopie'), full = `${typed}.ifc`;
          fs.writeFileSync(full, OLD_TEXT);
          const before = ipc.calls.length;
          const outcome = await save(variant, [{ pick: typed }, { pick: full, overwrite: false }]);
          assert.equal(outcome, null);
          assert.equal(seen.length, 2);
          assert.equal(seen[1].askedOverwrite, true);
          assert.equal(fs.readFileSync(full, 'utf8'), OLD_TEXT);
          assert.deepEqual(fs.readdirSync(home), ['kopie.ifc']);
          assert.equal(ipc.calls.slice(before).filter(writeFileCall).length, 0, 'geen schrijfactie');
        });
        await check(`${tag} (b) ${variant}: tweede venster geannuleerd → niets geschreven, geen fout`, async () => {
          reset();
          const typed = path.join(home, 'kopie'), full = `${typed}.ifc`;
          fs.writeFileSync(full, OLD_TEXT);
          assert.equal(await save(variant, [{ pick: typed }, 'annuleren']), null);
          assert.equal(fs.readFileSync(full, 'utf8'), OLD_TEXT);
        });

        await check(`${tag} (c) ${variant}: in de thuismap, naam vrij, zonder extensie → één venster`, async () => {
          reset();
          const typed = path.join(home, 'kopie');
          const outcome = await save(variant, [{ pick: typed }]);
          assert.equal(seen.length, 1);
          savedTo(outcome, `${typed}.ifc`);
          assert.deepEqual(fs.readdirSync(home), ['kopie.ifc']);
        });

        await check(`${tag} (d) ${variant}: naam met extensie getypt → één venster, ook buiten de thuismap en over een bestaand bestand`, async () => {
          for (const dir of [home, outside]) {
            reset();
            const fresh = path.join(dir, 'kopie.IFC');
            savedTo(await save(variant, [{ pick: fresh }]), fresh);
            assert.deepEqual(seen, [{ defaultPath: 'standaard.ifc', askedOverwrite: false }]);
            const existing = path.join(dir, 'bestaand.ifc');
            fs.writeFileSync(existing, OLD_TEXT);
            seen = [];
            savedTo(await save(variant, [{ pick: existing, overwrite: true }]), existing);
            assert.deepEqual(seen, [{ defaultPath: 'standaard.ifc', askedOverwrite: true }]);
          }
        });

        await check(`${tag} (e) ${variant}: tweede venster geeft weer een naam zonder extensie → de stap herhaalt`, async () => {
          reset();
          const typed = path.join(outside, 'kopie'), full = `${typed}.ifc`;
          const outcome = await save(variant, [{ pick: typed }, { pick: typed }, { pick: full }]);
          assert.deepEqual(seen.map(r => r.defaultPath), ['standaard.ifc', full, full]);
          savedTo(outcome, full);
          // Elke herhaling is een venster: annuleren in de derde ronde stopt zonder bestand.
          reset();
          assert.equal(await save(variant, [{ pick: typed }, { pick: typed }, 'annuleren']), null);
          assert.equal(seen.length, 3);
          assert.deepEqual(fs.readdirSync(outside), []);
        });

        await check(`${tag} (f) ${variant}: refuseTarget (gebouwmodel) toetst de bevestigde eindnaam vóór het schrijven`, async () => {
          reset();
          const typed = path.join(home, 'model'), full = `${typed}.ifc`;
          fs.writeFileSync(full, OLD_TEXT);
          const asked: FileRef[] = [];
          const refuse = async (ref: FileRef) => { asked.push(ref); return true; };
          assert.equal(await save(variant, [{ pick: typed }, { pick: full, overwrite: true }], refuse), null);
          assert.deepEqual(asked, [{ kind: 'path', path: full }]);
          assert.equal(fs.readFileSync(full, 'utf8'), OLD_TEXT);
        });

        // Een map in de thuismap die een link naar buiten is (`~/projecten` → `/data/projecten`). Met plugin-fs 2.7.1 is
        // dit het geval dat de review van #978 als blokkade vond: zonder de tweede ronde van #979 weigert het schrijven.
        const linked = () => {
          reset();
          fs.symlinkSync(outside, path.join(home, 'projecten'));
          return path.join(home, 'projecten', 'kopie');
        };
        /** In de echte map: het doel, plus alleen het hulpbestand als de regel dat laat staan. */
        const realDirHolds = (file: string) => {
          const rest = fs.readdirSync(outside).filter(n => n !== file);
          assert.ok(fs.readdirSync(outside).includes(file), `${file} staat er`);
          assert.equal(rest.length, rule.linkHelperLeft ? 1 : 0, `rest: ${rest.join(', ')}`);
          for (const n of rest) assert.match(n, /^save-.*\.ops-save\.tmp$/);
        };

        await check(`${tag} (g) ${variant}: gelinkte map, nieuwe naam zonder extensie`, async () => {
          const typed = linked(), full = `${typed}.ifc`;
          const script: Round[] = rule.linkDialogs === 1 ? [{ pick: typed }] : [{ pick: typed }, { pick: full }];
          const outcome = await save(variant, script);
          assert.deepEqual(seen.map(r => r.defaultPath), ['standaard.ifc', full].slice(0, rule.linkDialogs));
          savedTo(outcome, full);
          realDirHolds('kopie.ifc');
        });

        await check(`${tag} (g) ${variant}: gelinkte map, naam met extensie → één venster`, async () => {
          const full = `${linked()}.ifc`;
          savedTo(await save(variant, [{ pick: full }]), full);
          assert.deepEqual(seen, [{ defaultPath: 'standaard.ifc', askedOverwrite: false }]);
          realDirHolds('kopie.ifc');
        });

        await check(`${tag} (g) ${variant}: gelinkte map, eindnaam bestaat → tweede venster, bevestigen vervangt`, async () => {
          const typed = linked(), full = `${typed}.ifc`;
          fs.writeFileSync(full, OLD_TEXT);
          const outcome = await save(variant, [{ pick: typed }, { pick: full, overwrite: true }]);
          assert.deepEqual(seen, [
            { defaultPath: 'standaard.ifc', askedOverwrite: false },
            { defaultPath: full, askedOverwrite: true },
          ]);
          savedTo(outcome, full);
          realDirHolds('kopie.ifc');
        });

        await check(`${tag} (g) ${variant}: gelinkte map, eindnaam bestaat, tweede venster geannuleerd → oud bestand bytegelijk`, async () => {
          const typed = linked(), full = `${typed}.ifc`;
          fs.writeFileSync(full, OLD_TEXT);
          const before = ipc.calls.length;
          assert.equal(await save(variant, [{ pick: typed }, 'annuleren']), null);
          assert.equal(seen.length, 2);
          assert.deepEqual([...fs.readFileSync(full)], [...Buffer.from(OLD_TEXT)]);
          assert.deepEqual(fs.readdirSync(outside), ['kopie.ifc']);
          assert.equal(ipc.calls.slice(before).filter(writeFileCall).length, 0, 'geen schrijfactie');
        });
      }
    } finally {
      internals.invoke = nodeInvoke;
      ipc.dispose();
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  console.log(`Opslaan als, extensie en venster: ${passed} geslaagd, ${failed} mislukt.`);
  if (failed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
