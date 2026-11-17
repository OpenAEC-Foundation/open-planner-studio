// Opslaan als op de desktop: het opslagvenster geeft toestemming (scope) en stelt de overschrijfvraag voor de naam
// die het teruggeeft. Op Linux/GTK komt een getypte naam zonder extensie terug (`kopie`); de app schrijft `kopie.ifc`.
// Deze batterij bewijst dat de app de eindnaam dan nog één keer door het venster haalt als die buiten de scope valt of
// al bestaat, en anders bij één venster blijft (`pickSavePathTauri` in `tauriBackend.ts`).
//
// Nagebootst: de ECHTE plugin-fs- en plugin-dialog-JS-clients via nep-IPC (`nodeFileIpc.ts`) op Node-fs. Het venster
// hieronder geeft, zoals plugin-dialog 2.7.0 (`commands.rs` `save`: `allow_file`), alleen het pad vrij dat het
// teruggeeft, en stelt zoals GTK (rfd 0.16.0, `gtk_file_chooser_set_do_overwrite_confirmation`) de overschrijfvraag
// voor dat pad. De scope volgt tauri 2.12.3 `Scope::is_allowed`: een bestaand pad wordt eerst met links en al
// opgelost, een nieuw pad telt zoals het er staat. Niet bewezen: de echte Rust-scope, het echte venster, Windows/macOS.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { installNodeFileIpc, writeFileCall } from './nodeFileIpc';
import {
  saveBytePartsDialogTauri, saveBytesDialogTauri, saveFileDialogTauri,
} from '@/services/fileAccess/tauriBackend';
import type { FileRef, SaveOutcome } from '@/services/fileAccess';

const FILTERS = [{ name: 'IFC', extensions: ['ifc'] }];
const NEW_TEXT = 'NIEUWE INHOUD\r\n';
const OLD_TEXT = 'OUDE INHOUD\n';

/**
 * Hoe plugin-fs een pad tegen de scope legt. Per versie één regel; de verhoging naar plugin-fs 2.7.1 (#978) voegt hier
 * een regel toe die elke link oplost, ook in de voorouders van een nieuw pad (`resolve_real_path`), met de verwachte
 * vensters voor een map in de thuismap die een link naar buiten is.
 */
const SCOPE_RULES: { plugin: string; scopePath: (p: string) => string; linkDialogs: number }[] = [
  // plugin-fs 2.5.0 + tauri 2.12.3 `is_allowed`: bestaat het pad, dan het opgeloste pad; anders het pad zoals gegeven.
  { plugin: 'plugin-fs 2.5.0', scopePath: p => (fs.existsSync(p) ? fs.realpathSync(p) : p), linkDialogs: 1 },
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
      granted.add(round.pick);
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

        await check(`${tag} (g) ${variant}: map in de thuismap die een link naar buiten is, nieuwe naam zonder extensie`, async () => {
          reset();
          fs.symlinkSync(outside, path.join(home, 'projecten'));
          const typed = path.join(home, 'projecten', 'kopie'), full = `${typed}.ifc`;
          const script: Round[] = rule.linkDialogs === 1 ? [{ pick: typed }] : [{ pick: typed }, { pick: full }];
          const outcome = await save(variant, script);
          assert.equal(seen.length, rule.linkDialogs);
          savedTo(outcome, full);
          // Niet `deepEqual`: met plugin-fs 2.5.0 blijft hier het hulpbestand `save-<id>.ops-save.tmp` staan (knownbug 1755).
          assert.ok(fs.readdirSync(outside).includes('kopie.ifc'));
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
