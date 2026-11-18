/**
 * #804, knownbug 1131 stap 5: het herstelrecord van een vervanging van het eigen bestand op de desktop (ontwerp §4.10
 * stap 0, "Restbestanden na een crash"). Eén bestand per operatie in de appDataDir, `recovery[.<slug>].replace.<id>.json`,
 * los van het herstelmanifest: dat blijft versie 5, dus een oudere app leest haar herstelset zoals altijd en laat dit
 * bestand staan (het past niet in haar naamvormen, `isOwnFile` in `recoveryPaths.ts`). Ook de snapshotopruiming van deze
 * app (sessierotatie, wissen na de herstelkeuze, schoon afsluiten) raakt het niet: die werkt alleen op die naamvormen.
 *
 * Het record ontstaat vóór stap 1 en verdwijnt pas als er geen hulpbestand van de operatie meer staat. Bij de start en
 * vóór een lokaal pad gelezen wordt, handelt `settlePendingReplaces` de records af (`settleReplaceRemnants`: eigendom
 * alleen op inhoud). Zonder record voor een pad raakt dat de projectmap niet aan: alleen de appDataDir wordt gelezen.
 */
import { ownRecoveryNames, recoveryTmpSuffix } from '@/services/recovery/recoveryPaths';
import { replaceCopyLabel } from '@/i18n/replaceCopyName';
import { precomputeSha256 } from '@/services/xerSourceArchive';
import { isTauri } from '@/utils/platform';
import { writeTextFileAtomic } from './atomicWrite';
import {
  settleReplaceRemnants, tauriReplaceRemnantsFs, type RemnantEvent, type ReplaceRemnantsFs,
} from './ownFileReplace';

/** Wat herstel van één vervanging moet weten: het doel, het id van de hulpnamen en de twee versies. */
export interface ReplaceRecord {
  /** Het id van `save-<id>.ops-save.tmp` en `<naam>.ops-vorige-<id>`. */
  id: string;
  /** Het doel: het eigen bestand van het document. */
  path: string;
  /** De versie die de app in stap 2 op het doel controleerde (de bron in het geheugen). */
  vorigeSha256: string;
  /** De versie die op het doel zou komen (de voorbereide uitvoer). */
  pendingSha256: string;
}

export interface ReplaceRecordStore {
  write(record: ReplaceRecord): Promise<void>;
  remove(id: string): Promise<void>;
  /** Elk leesbaar record; een onleesbaar of ongeldig bestand blijft staan en telt niet mee. */
  list(): Promise<ReplaceRecord[]>;
}

const RECORD_KIND = 'ops-replace';
const RECORD_VERSION = 1;
const SHA256_HEX = /^[0-9a-f]{64}$/;
/** Gelijk aan `is_helper_id` in `place_file.rs`. */
const HELPER_ID = /^[0-9a-z]{1,64}$/;
const recordPrefix = `${ownRecoveryNames.base}.replace.`;

/** De bestandsnaam van het record in de appDataDir. */
export function replaceRecordName(id: string): string {
  return `${recordPrefix}${id}.json`;
}

/** Het id als `name` precies een record van deze build is (een dev-slug heeft een eigen voorvoegsel), anders `null`. */
export function replaceRecordId(name: string): string | null {
  if (!name.startsWith(recordPrefix) || !name.endsWith('.json')) return null;
  const id = name.slice(recordPrefix.length, -'.json'.length);
  return HELPER_ID.test(id) ? id : null;
}

export function serializeReplaceRecord(record: ReplaceRecord): string {
  return JSON.stringify({ kind: RECORD_KIND, version: RECORD_VERSION, ...record });
}

/** Een record uit zijn tekst; `null` bij een andere vorm (dan blijft het bestand staan en doet herstel er niets mee). */
export function parseReplaceRecord(text: string): ReplaceRecord | null {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!value || typeof value !== 'object') return null;
  const { kind, version, id, path, vorigeSha256, pendingSha256 } = value as Record<string, unknown>;
  if (kind !== RECORD_KIND || version !== RECORD_VERSION) return null;
  if (typeof id !== 'string' || !HELPER_ID.test(id) || typeof path !== 'string' || path === '') return null;
  if (typeof vorigeSha256 !== 'string' || !SHA256_HEX.test(vorigeSha256)) return null;
  if (typeof pendingSha256 !== 'string' || !SHA256_HEX.test(pendingSha256)) return null;
  return { id, path, vorigeSha256, pendingSha256 };
}

/** De records in de appDataDir, via plugin-fs; atomair geschreven zoals het manifest (`writeTextFileAtomic`). */
export async function tauriReplaceRecords(): Promise<ReplaceRecordStore> {
  const fs = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();
  return {
    write: record => writeTextFileAtomic(dir, replaceRecordName(record.id), serializeReplaceRecord(record), recoveryTmpSuffix),
    remove: async id => fs.remove(await join(dir, replaceRecordName(id))),
    list: async () => {
      let names: string[];
      try {
        names = (await fs.readDir(dir)).map(entry => entry.name).filter((name): name is string => !!name);
      } catch {
        return [];
      }
      const records: ReplaceRecord[] = [];
      for (const name of names) {
        const id = replaceRecordId(name);
        if (id === null) continue;
        try {
          const record = parseReplaceRecord(await fs.readTextFile(await join(dir, name)));
          if (record?.id === id) records.push(record);
        } catch (error) {
          console.error('Herstelrecord van een vervanging niet te lezen:', name, error);
        }
      }
      return records;
    },
  };
}

/** De vervangingen die in deze sessie nog lopen: hun record is van een levende operatie, herstel blijft eraf. */
const running = new Set<string>();

/** Rond `action` geldt het record met dit id als lopend; `settlePendingReplaces` slaat het over. */
export async function whileReplaceRuns<T>(id: string, action: () => Promise<T>): Promise<T> {
  running.add(id);
  try { return await action(); } finally { running.delete(id); }
}

export interface SettleOptions {
  /** Alleen de records voor dit doel (vóór het lezen van een lokaal pad); zonder: alle (bij de start). */
  path?: string;
  fs?: ReplaceRemnantsFs;
  records?: ReplaceRecordStore;
  now?: Date;
}

/**
 * De onafgeronde vervangingen afhandelen. Alleen op de desktop (de browser vervangt via de handle, zonder
 * restbestanden), los van de flag: de restbestanden zijn van een eerdere sessie. Een record verdwijnt alleen als er
 * geen hulpbestand van de operatie meer staat; anders probeert de volgende start of het volgende openen het opnieuw.
 */
export async function settlePendingReplaces(options: SettleOptions = {}): Promise<RemnantEvent[]> {
  if (!options.records && !isTauri()) return [];
  let records: ReplaceRecordStore, pending: ReplaceRecord[];
  try {
    records = options.records ?? await tauriReplaceRecords();
    pending = (await records.list())
      .filter(record => !running.has(record.id) && (options.path === undefined || record.path === options.path));
  } catch (error) {
    // Afhandelen houdt de start of het openen nooit tegen: zonder leesbare appDataDir gaat het gewoon verder.
    console.error('Herstelrecords van vervangingen niet te lezen:', error);
    return [];
  }
  if (pending.length === 0) return [];
  const fs = options.fs ?? await tauriReplaceRemnantsFs();
  const events: RemnantEvent[] = [];
  for (const record of pending) {
    try {
      const settled = await settleReplaceRemnants(fs, record, replaceCopyLabel(options.now), precomputeSha256);
      events.push(...settled.events);
      if (settled.resolved) await records.remove(record.id);
    } catch (error) {
      console.error('Restbestanden van een onderbroken opslag niet afgehandeld:', record.path, error);
    }
  }
  return events;
}
