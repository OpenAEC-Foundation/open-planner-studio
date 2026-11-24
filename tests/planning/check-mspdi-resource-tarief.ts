import { readMSPDI } from '@/services/msproject/mspdiReader';
import type { ImportResult } from '@/services/importTypes';
import { installDOMParser } from './xmldom-shim';

installDOMParser();
let checks = 0;
const failures: string[] = [];
const eq = (label: string, actual: unknown, expected: unknown) => {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
};

const wrap = (inner: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project"><Name>Tarief</Name>
  <StartDate>2026-03-02T08:00:00</StartDate><FinishDate>2026-03-31T17:00:00</FinishDate><MinutesPerDay>480</MinutesPerDay><Tasks></Tasks>${inner}</Project>`;

const rateRow = (standardRate: string, from = '2026-01-01T00:00:00', to = '2026-12-31T23:59:59') =>
  `<Rate><RatesFrom>${from}</RatesFrom><RatesTo>${to}</RatesTo><StandardRate>${standardRate}</StandardRate></Rate>`;

const resource = (uid: number, name: string, extra: string) =>
  `<Resource><UID>${uid}</UID><ID>${uid}</ID><Name>${name}</Name><Type>1</Type><MaxUnits>1</MaxUnits>${extra}</Resource>`;

const read = (resourcesXml: string): ImportResult => readMSPDI(wrap(`<Resources>${resourcesXml}</Resources>`));
const byName = (r: ImportResult, name: string) => r.resources.find(x => x.name === name);

{
  const r = read(`${resource(1, 'Direct wint', `<StandardRate>0</StandardRate><Rates>${rateRow('120')}</Rates>`)}`);
  eq('1 direct StandardRate 0 wint van tabel-A-tarief 120', byName(r, 'Direct wint')?.costPerHour, 0);
}

{
  const r = read(`${resource(1, 'Alleen tabel A', `<Rates>${rateRow('120')}</Rates>`)}`);
  eq('2 tabel-A-rij over het hele project zonder direct tarief geeft costPerHour 120', byName(r, 'Alleen tabel A')?.costPerHour, 120);
}

{
  const r = read(`${resource(1, 'Tabel dekt niet', `<Rates>${rateRow('120', '2026-03-02T08:00:00', '2026-03-10T00:00:00')}</Rates>`)}`);
  eq('3 tabel-A-rij die het project niet beslaat geeft geen costPerHour', byName(r, 'Tabel dekt niet')?.costPerHour, undefined);
}

if (failures.length) {
  console.error(`XX mspdi-resource-tarief: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK mspdi-resource-tarief: ${checks}/${checks}`);
