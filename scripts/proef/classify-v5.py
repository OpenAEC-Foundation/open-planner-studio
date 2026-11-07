# Indeling volgens ontwerp v5 §4.2 (D, R, Own, Ext -> P/C/A/V) op een IFC-bestand met één entiteit per regel.
# Fase-0-voorproef (ontwerp #804 v5 §4.2). Draaien: python3 -I scripts/proef/classify-v5.py <bestand.ifc>
import re, sys
from collections import defaultdict, Counter
t = open(sys.argv[1], encoding='utf-8', errors='replace').read()
ents = {}
for m in re.finditer(r'^#(\d+)\s*=\s*([A-Z0-9_]+)\((.*)\);\s*$', t, re.M):
    ents[int(m.group(1))] = (m.group(2), m.group(3))
def split_args(s):
    out, depth, cur, ins, i = [], 0, '', False, 0
    while i < len(s):
        c = s[i]
        if ins:
            cur += c
            if c == "'":
                if i+1 < len(s) and s[i+1] == "'": cur += "'"; i += 1
                else: ins = False
        elif c == "'": ins = True; cur += c
        elif c == '(': depth += 1; cur += c
        elif c == ')': depth -= 1; cur += c
        elif c == ',' and depth == 0: out.append(cur); cur = ''
        else: cur += c
        i += 1
    out.append(cur); return out
def refs_in(s):
    return [int(x) for x in re.findall(r'#(\d+)', re.sub(r"'(?:[^']|'')*'", "''", s))]
ty = {i: e[0] for i, e in ents.items()}
args = {i: split_args(a) for i, (_, a) in ents.items()}
refs = {i: refs_in(a) for i, (_, a) in ents.items()}
def r1(i, k): r = refs_in(args[i][k]) if k < len(args[i]) else []; return r[0] if r else None
def rl(i, k): return refs_in(args[i][k]) if k < len(args[i]) else []
def name(i):
    a = args[i][2] if len(args[i]) > 2 else ''
    return a.strip("'")
W = set('''IFCPROPERTYSINGLEVALUE IFCPROPERTYSET IFCRELDEFINESBYPROPERTIES IFCWORKTIME IFCTIMEPERIOD IFCRECURRENCEPATTERN
IFCRELNESTS IFCRELASSIGNSTOCONTROL IFCWORKSCHEDULE IFCSIUNIT IFCSIMPLEPROPERTYTEMPLATE IFCPROPERTYSETTEMPLATE IFCORGANIZATION
IFCLAGTIME IFCTASKTIME IFCWORKPLAN IFCWORKCALENDAR IFCUNITASSIGNMENT IFCTASK IFCRELSEQUENCE IFCRELDECLARES IFCRELASSIGNSTOPROCESS
IFCRELAGGREGATES IFCPROPERTYENUMERATION IFCPROPERTYENUMERATEDVALUE IFCPROJECT IFCPERSONANDORGANIZATION IFCPERSON IFCOWNERHISTORY
IFCGEOMETRICREPRESENTATIONCONTEXT IFCCARTESIANPOINT IFCAXIS2PLACEMENT3D IFCAPPLICATION IFCCONSTRUCTIONEQUIPMENTRESOURCE
IFCCONSTRUCTIONMATERIALRESOURCE IFCCONSTRUCTIONPRODUCTRESOURCE IFCLABORRESOURCE IFCCREWRESOURCE IFCSUBCONTRACTRESOURCE
IFCCONSTRUCTIONRESOURCE IFCTASKTIMERECURRING'''.split())
RES = {k for k in W if k.endswith('RESOURCE')}
REG = set('''OPS_ActivityCodes OPS_Analysis OPS_Assignments OPS_Baselines OPS_Calendar OPS_Constraints OPS_CustomFields
OPS_DayMeasureDurations OPS_DayMeasureLags OPS_ExactMinutes OPS_ExternalLink OPS_Hammock OPS_ImportProvenance OPS_LagCalendar
OPS_Leveling OPS_Library OPS_LiteralCalendars OPS_ManualScheduling OPS_Milestone OPS_MspTaskType OPS_Project OPS_ProjectSettings
OPS_Resource OPS_Resume OPS_SchedulingOptions OPS_SchedulingProfile OPS_Sequences OPS_StructureMeta OPS_Summary
OPS_TaskAppearance OPS_TaskDurationUnit OPS_TaskIdentity OPS_TaskNotes OPS_TaskSplits OPS_TaskTypes OPS_Timephased
OPS_TimephasedContours OPS_TimephasedDurationWalks OPS_TimephasedWindow OPS_WorkRule OPS_XerDocument OPS_XerSourceArchive'''.split())
# --- Stap 1: D (huidige lezerregels) ---
sched = {i for i in ents if ty[i] == 'IFCWORKSCHEDULE'}
base = {i for i in sched if '.BASELINE.' in args[i][-1]}
live = sched - base
nest = defaultdict(list)
for i in ents:
    if ty[i] == 'IFCRELNESTS': nest[r1(i, 4)] += rl(i, 5)
def tree(roots_):
    out, todo = set(), list(roots_)
    while todo:
        x = todo.pop()
        if x in out or ty.get(x) != 'IFCTASK': continue
        out.add(x); todo += nest[x]
    return out
def tasks_of(sc):
    todo = []
    for i in ents:
        if ty[i] == 'IFCRELASSIGNSTOCONTROL' and r1(i, 6) in sc: todo += rl(i, 4)
        if ty[i] == 'IFCRELNESTS' and r1(i, 4) in sc: todo += rl(i, 5)
    return tree(todo)
live_tasks = tasks_of(live); base_tasks = tasks_of(base)
alltasks = {i for i in ents if ty[i] == 'IFCTASK'}
excl = (base_tasks - live_tasks) if live_tasks else set()
plans = {i for i in ents if ty[i] == 'IFCWORKPLAN'}
agg_sched = set()
for i in ents:
    if ty[i] == 'IFCRELAGGREGATES' and r1(i, 4) in plans: agg_sched |= {x for x in rl(i, 5) if x in sched}
has_ops_baselines = any(ty[i] == 'IFCPROPERTYSET' and name(i) == 'OPS_Baselines' for i in ents)
own_base = {b for b in base & agg_sched if has_ops_baselines and not tasks_of({b})}
D = plans | live | own_base | (alltasks - excl) | {i for i in ents if ty[i] in RES or ty[i] == 'IFCWORKCALENDAR'}
proj = {i for i in ents if ty[i] == 'IFCPROJECT'}
# --- Stap 2: R ---
def ok(i):
    T = ty[i]
    if T == 'IFCRELNESTS': return r1(i, 4) in D and all(x in D for x in rl(i, 5))
    if T == 'IFCRELASSIGNSTOCONTROL': return r1(i, 6) in D and ty[r1(i, 6)] in ('IFCWORKSCHEDULE', 'IFCWORKCALENDAR') and all(x in D and (ty[x] == 'IFCTASK' or ty[x] in RES) for x in rl(i, 4)) and (ty[r1(i, 6)] == 'IFCWORKCALENDAR' or all(ty[x] == 'IFCTASK' for x in rl(i, 4)))
    if T == 'IFCRELASSIGNSTOPROCESS': return r1(i, 6) in D and all(x in D and ty[x] in RES for x in rl(i, 4))
    if T == 'IFCRELSEQUENCE': return r1(i, 4) in D and r1(i, 5) in D
    if T == 'IFCRELAGGREGATES': return r1(i, 4) in plans and all(x in D and x in sched for x in rl(i, 5))
    if T == 'IFCRELDECLARES': return r1(i, 4) in proj and all(ty.get(x) == 'IFCPROPERTYSETTEMPLATE' and name(x) in REG for x in rl(i, 5))
    if T == 'IFCRELDEFINESBYPROPERTIES':
        p = r1(i, 5); return all(x in D or x in proj for x in rl(i, 4)) and p is not None and ty.get(p) == 'IFCPROPERTYSET' and name(p) in REG
    return False
R = {i for i in ents if ty[i].startswith('IFCREL') and ok(i)}
# --- Stap 3: Own ---
Own, todo = set(), list(D | R)
while todo:
    x = todo.pop()
    if x in Own or ty.get(x) not in W: continue
    Own.add(x); todo += refs[x]
# --- Stap 4: Ext ---
Ext, todo = set(), [i for i in ents if i not in Own]
seen = set()
while todo:
    x = todo.pop()
    if x in seen or x not in ents: continue
    seen.add(x)
    if x in Own: Ext.add(x)
    if x in D or x in R: continue  # Ext stopt bij D ∪ R (die houden hun #id)
    todo += refs[x]
P = D | R | (Own - Ext)
C = (Own & Ext) - D - R
A = {i for i in ents if i not in Own and any(r in P for r in refs[i])}
V = set(ents) - P - C - A
print(f"{sys.argv[1].split('/')[-1]}: {len(ents)} entiteiten | P {len(P)} C {len(C)} A {len(A)} V {len(V)}")
for nm, S_ in (('C', C), ('A', A), ('V', V)):
    if S_: print('  ', nm, dict(Counter(ty[x] for x in S_).most_common(8)))
