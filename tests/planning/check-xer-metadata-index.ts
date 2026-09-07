import { buildXerMetadataCatalog, materializeXerMetadata } from '@/services/xer/xerMetadata';
import { parseXerTables } from '@/services/xer/xerTables';

const projects = 120;
const lines = ['ERMHDR\t23.12', '%T\tTASK', '%F\ttask_id\tproj_id\ttask_code'];
for (let index = 0; index < projects; index++) lines.push(`%R\tT${index}\tP${index}\tC${index}`);
lines.push('%T\tACTVTYPE', '%F\tactv_code_type_id\tactv_code_type', '%R\tTYPE\tFase');
lines.push('%T\tACTVCODE', '%F\tactv_code_id\tactv_code_type_id\tshort_name', '%R\tVALUE\tTYPE\tV');
lines.push('%T\tTASKACTV', '%F\tproj_id\ttask_id\tactv_code_type_id\tactv_code_id');
for (let index = 0; index < projects; index++) lines.push(`%R\tP${index}\tT${index}\tTYPE\tVALUE`);
lines.push('%E');

const catalog = buildXerMetadataCatalog(parseXerTables(new TextEncoder().encode(lines.join('\n'))));
const visits = Array.from({ length: projects }, (_, index) => materializeXerMetadata(catalog, `P${index}`).visitedTaskProjectionCount);
const diffs: string[] = [];
if (catalog.taskProjections.length !== projects) diffs.push(`platte X9-lijst ${catalog.taskProjections.length} != ${projects}`);
if (visits.some(count => count !== 1)) diffs.push(`projectindex bezocht niet exact één projectie: ${JSON.stringify(visits)}`);
if (!Object.isFrozen(catalog.taskProjectionsByProject) || !Object.values(catalog.taskProjectionsByProject).every(Object.isFrozen)) diffs.push('projectindex is niet diep bevroren');
if (diffs.length) { console.error(`XX X8 projectindex\n${diffs.join('\n')}`); process.exitCode = 1; }
else console.log(`OK X8 projectindex: projecten=${projects}, totaleMetadata=${projects}, bezoeken=${visits.reduce((a, b) => a + b, 0)}`);
