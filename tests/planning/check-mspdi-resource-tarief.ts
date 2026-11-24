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

const rateRow = (standardRate: string, table = 0, from = '2026-01-01T00:00:00', to = '2026-12-31T23:59:59') =>
  `<Rate><RateTable>${table}</RateTable><RatesFrom>${from}</RatesFrom><RatesTo>${to}</RatesTo><StandardRate>${standardRate}</StandardRate></Rate>`;

const resource = (uid: number, name: string, extra: string) =>
  `<Resource><UID>${uid}</UID><ID>${uid}</ID><Name>${name}</Name><Type>1</Type><MaxUnits>1</MaxUnits>${extra}</Resource>`;

const read = (resourcesXml: string): ImportResult => readMSPDI(wrap(`<Resources>${resourcesXml}</Resources>`));
const byName = (r: ImportResult, name: string) => r.resources.find(x => x.name === name);

{
  const r = read(`${resource(1, 'Direct wint', `<StandardRate>0</StandardRate><Rates>${rateRow('120')}</Rates>`)}`);
  eq('1 direct StandardRate 0 wint van een tabeltarief 120', byName(r, 'Direct wint')?.costPerHour, 0);
}

{
  const r = read(`${resource(1, 'Tabel dekt deels', `<Rates>${rateRow('120', 0, '2026-03-02T08:00:00', '2026-03-10T00:00:00')}</Rates>`)}`);
  eq('2 eerste tabelrij geeft 120, ook als die het project maar deels dekt', byName(r, 'Tabel dekt deels')?.costPerHour, 120);
}

{
  const r = read(`${resource(1, 'Meerdere A-rijen', `<Rates>${rateRow('120')}${rateRow('120')}</Rates>`)}`);
  eq('3 meerdere tabel-A-rijen geven 120 (eerste in documentvolgorde)', byName(r, 'Meerdere A-rijen')?.costPerHour, 120);
}

{
  const r = read(`${resource(1, 'Alleen B t/m E', `<Rates>${rateRow('150', 1)}${rateRow('160', 2)}</Rates>`)}`);
  eq('4 alleen tabel B t/m E geeft het tarief van de eerste rij (150)', byName(r, 'Alleen B t/m E')?.costPerHour, 150);
}

{
  const r = read(`${resource(1, 'B voor A', `<Rates>${rateRow('150', 1)}${rateRow('120', 0)}</Rates>`)}`);
  eq('5 een B-rij van 150 vóór een A-rij van 120 geeft 150 (documentvolgorde, als op main)', byName(r, 'B voor A')?.costPerHour, 150);
}

{
  const bRowZonderTarief = `<Rate><RateTable>1</RateTable><RatesFrom>2026-01-01T00:00:00</RatesFrom><RatesTo>2026-12-31T23:59:59</RatesTo></Rate>`;
  const r = read(`${resource(1, 'B zonder tarief voor A', `<Rates>${bRowZonderTarief}${rateRow('120', 0)}</Rates>`)}`);
  eq('6 een B-rij zonder StandardRate verbergt een latere A-rij niet: 120', byName(r, 'B zonder tarief voor A')?.costPerHour, 120);
}

if (failures.length) {
  console.error(`XX mspdi-resource-tarief: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK mspdi-resource-tarief: ${checks}/${checks}`);
