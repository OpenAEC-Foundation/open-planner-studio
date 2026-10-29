// De gedeelde property-relatie-index bewaart de bestaande volgorde- en duplicaatsemantiek.
// Bewust losse STEP-invoer: de writer maakt deze gedeelde, dubbele en ongeldige koppelingen niet.
import { readIFC } from '@/services/ifc/ifcReader';
import { ifcJson } from '@/services/ifc/ifcPsets';

let checks = 0;
const fails: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function fixture(schema: string, internalId: string): string {
  const origin = (companyId: string) => ifcJson({ companyId, libraryItemId: 'item', poolVersion: 3 });
  return `ISO-10303-21;
HEADER;
FILE_SCHEMA(('${schema}'));
ENDSEC;
DATA;
#1=IFCAPPLICATION($,'0.2','Open Planner Studio','OPS');
#10=IFCTASK('task-a',$,'A',$,$,$,$,$,$,.F.,500,$,.CONSTRUCTION.);
#11=IFCTASK('task-b',$,'B',$,$,$,$,$,$,.F.,500,$,.CONSTRUCTION.);
#12=IFCLABORRESOURCE('resource',$,'Vakman',$,$,$,$,$,$,$,.NOTDEFINED.);
#13=IFCWORKCALENDAR('calendar',$,'Week',$,$,$,$,.NOTDEFINED.);
/* Koppelingen staan vóór hun psets; STEP-id-volgorde is geen bestandsvolgorde. */
#900=IFCRELDEFINESBYPROPERTIES('r1',$,$,$,(#10),#20);
#800=IFCRELDEFINESBYPROPERTIES('r2',$,$,$,(#10),#21);
#700=IFCRELDEFINESBYPROPERTIES('r3',$,$,$,(#10,#11),#22);
#600=IFCRELDEFINESBYPROPERTIES('r4',$,$,$,(#10),#23);
#500=IFCRELDEFINESBYPROPERTIES('r5',$,$,$,(#12),#24);
#400=IFCRELDEFINESBYPROPERTIES('r6',$,$,$,(#12),#25);
/* Dubbel doel moet twee metadata-items in de assignmentwachtrij opleveren. */
#300=IFCRELDEFINESBYPROPERTIES('r7',$,$,$,(#10,#10),#26);
#301=IFCRELDEFINESBYPROPERTIES('r7-dup',$,$,$,(#10,#10),#26);
#200=IFCRELDEFINESBYPROPERTIES('r8',$,$,$,(#13,#13),#27);
#100=IFCRELDEFINESBYPROPERTIES('r9',$,$,$,(#10),#999);
#101=IFCRELDEFINESBYPROPERTIES('r10',$,$,$,(#10),#12);
#102=IFCRELDEFINESBYPROPERTIES('r11',$,$,$,(#10),$);
/* Losse pset mag geen effect hebben. */
#28=IFCPROPERTYSET('orphan',$,'OPS_TaskAppearance',$,(#33));
#20=IFCPROPERTYSET('identity-old',$,'OPS_TaskIdentity',$,(#30));
#21=IFCPROPERTYSET('identity-new',$,'OPS_TaskIdentit\\X2\\0079\\X0\\',$,(#31));
#22=IFCPROPERTYSET('shared',$,'OPS_TaskAppearance',$,(#32,#999));
#23=IFCPROPERTYSET('override',$,'OPS_TaskAppearance',$,(#33));
#24=IFCPROPERTYSET('resource-first',$,'OPS_Resource',$,(#34,#36));
#25=IFCPROPERTYSET('resource-last',$,'OPS_Resource',$,(#35,#37));
#26=IFCPROPERTYSET('assignment',$,'OPS_Assignments',$,(#38));
#27=IFCPROPERTYSET('calendar-meta',$,'OPS_Calendar',$,(#39));
#30=IFCPROPERTYSINGLEVALUE('InternalTaskId',$,IFCTEXT('oud'),$);
#31=IFCPROPERTYSINGLEVALUE('InternalTaskId',$,IFCTEXT('${internalId}'),$);
#32=IFCPROPERTYSINGLEVALUE('Color',$,IFCTEXT('#112233'),$);
#33=IFCPROPERTYSINGLEVALUE('Color',$,IFCTEXT('#445566'),$);
#34=IFCPROPERTYSINGLEVALUE('LibraryOrigin',$,IFCTEXT(${origin('eerste')}),$);
#35=IFCPROPERTYSINGLEVALUE('LibraryOrigin',$,IFCTEXT(${origin('laatste')}),$);
#36=IFCPROPERTYSINGLEVALUE('MaxUnits',$,IFCREAL(2),$);
#37=IFCPROPERTYSINGLEVALUE('MaxUnits',$,IFCREAL(4),$);
#38=IFCPROPERTYSINGLEVALUE('resource#0',$,IFCTEXT('0.25|UNIFORM'),$);
#39=IFCPROPERTYSINGLEVALUE('HoursPerDay',$,IFCREAL(6),$);
#40=IFCRELASSIGNSTOPROCESS('assign',$,$,$,(#12,#12,#12,#12,#12),$,#10,$);
ENDSEC;
END-ISO-10303-21;`;
}

for (const schema of ['IFC4', 'IFC4X3', 'IFC4X3_ADD2']) {
  const result = readIFC(fixture(schema, `intern-${schema}`));
  eq(`${schema}: schema behouden`, result.project.ifcSchema, schema);
  eq(`${schema}: laatste identiteit wint, psetnaam eerst STEP-decoderen`, result.tasks[0].id, `intern-${schema}`);
  eq(`${schema}: gedeelde pset en laatste kleur in bestandsvolgorde`, result.tasks.map(t => t.color), ['#445566', '#112233']);
  eq(`${schema}: eerste geldige herkomst blijft behouden`, result.resources[0].libraryOrigin?.companyId, 'eerste');
  eq(`${schema}: laatste capaciteit wint`, result.resources[0].maxUnits, 4);
  eq(`${schema}: dubbele doelen en relaties blijven in assignmentwachtrij`, result.assignments.map(a => a.unitsPerDay), [0.25, 0.25, 0.25, 0.25, 1]);
  eq(`${schema}: dubbele doelen dupliceren geen taken/resources`, [result.tasks.length, result.resources.length], [2, 1]);
  eq(`${schema}: kalender via doelindex`, result.calendar.hoursPerDay, 6);
  const next = readIFC(fixture(schema, 'volgend-bestand'));
  eq(`${schema}: volgende import heeft eigen index`, next.tasks[0].id, 'volgend-bestand');
  eq(`${schema}: vorige import blijft ongewijzigd`, result.tasks[0].id, `intern-${schema}`);
}

if (fails.length) {
  for (const fail of fails) console.log(`XX ${fail}`);
  console.log(`check-ifc-property-relations: ${fails.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`check-ifc-property-relations: ${checks}/${checks} groen`);
