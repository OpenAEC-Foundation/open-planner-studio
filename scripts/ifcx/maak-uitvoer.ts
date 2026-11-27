import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIfcx } from '@/services/ifc/ifcx';
import { CLOCK } from '../../tests/planning/ifcxProof';

const VOORBEELDEN = 'public/examples';

function main(): number {
  const [uitmap] = process.argv.slice(2);
  if (!uitmap) {
    console.error('gebruik: node scripts/run-ts.mjs scripts/ifcx/maak-uitvoer.ts <uitmap>');
    return 2;
  }
  const namen = readdirSync(VOORBEELDEN).filter(naam => naam.endsWith('.ifc')).sort();
  if (namen.length === 0) {
    console.error(`Geen voorbeeldprojecten in ${VOORBEELDEN}`);
    return 2;
  }
  mkdirSync(uitmap, { recursive: true });
  let geweigerd = 0;
  for (const naam of namen) {
    const doel = join(uitmap, `${basename(naam, '.ifc')}.ifcx`);
    try {
      writeFileSync(doel, writeIfcx(readIFC(readFileSync(join(VOORBEELDEN, naam), 'utf8')), CLOCK));
      console.log(`OK ${doel}`);
    } catch (error) {
      geweigerd++;
      console.log(`XX ${naam}: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
    }
  }
  console.log(`IFCX-uitvoer: ${namen.length - geweigerd} voorbeeldprojecten geschreven, ${geweigerd} geweigerd`);
  return geweigerd > 0 ? 1 : 0;
}

process.exitCode = main();
