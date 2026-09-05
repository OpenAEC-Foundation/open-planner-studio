// Kindproces A voor X9: schrijft een echte compacte schema-2-IFC zonder een lezer te openen.
import { isMultiDocumentImport } from '@/services/importTypes';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readXER } from '@/services/xer/xerReader';
import { writeFileSync } from 'node:fs';

const target = process.argv[2];
if (!target) throw new Error('X9 koud-schrijfproces mist doelpad');

const source = new TextEncoder().encode([
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  '%R\tP-COLD\tKoude bron\tC\t2026-08-01 08:00',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC\tStandaard\t8\t40\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\tclndr_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_type\tduration_type\tstatus_code',
  '%R\tT-COLD\tP-COLD\tC-1\tKoude taak\tC\t2026-08-01 08:00\t2026-08-01 16:00\t8\tTT_Task\tDT_FixedDUR2\tTK_NotStart',
  '%E',
].join('\r\n'));

const opened = readXER(source);
const parsed = isMultiDocumentImport(opened) ? opened.results[0] : opened;
if (!parsed || (isMultiDocumentImport(opened) && opened.results.length !== 1)) {
  throw new Error('X9 koud-schrijfproces verwacht precies één XER-document');
}
writeFileSync(target, writeIFC(parsed));
