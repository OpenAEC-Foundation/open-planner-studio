#!/usr/bin/env python3
"""Corpus van vreemde IFC-bestanden voor #804 fase 0 (ontwerp "Gebouwmodel behouden", §10).

Maakt de bestanden in tests/fixtures/ifc-foreign/ met IfcOpenShell (de versie staat in de workflow
.github/workflows/ifc-foreign.yml; lokaal: `uv pip install ifcopenshell==<die versie>`). GlobalIds en tijden zijn
vast, zodat CI kan controleren dat de gecommitte bestanden reproduceerbaar zijn:

    python3 scripts/proef/maak-corpus.py tests/fixtures/ifc-foreign      # schrijft het corpus
    python3 scripts/proef/maak-corpus.py --controleer tests/fixtures/ifc-foreign   # exit 1 bij een verschil

Elk bestand is van ons zelf (geen externe voorbeeldbestanden; zie README.md in die map). Een paar bestanden zijn
tekstbewerkingen van een gemaakt bestand (CRLF met commentaar, Latin-1, complexe instanties, dubbele GlobalIds); die
zijn bewust niet allemaal schemageldig. De lijst GELDIG zegt welke `ifcopenshell.validate` moet doorstaan.
"""
import hashlib
import os
import sys
import tempfile
import time

import ifcopenshell
import ifcopenshell.api
import ifcopenshell.api.aggregate
import ifcopenshell.api.context
import ifcopenshell.api.geometry
import ifcopenshell.api.owner
import ifcopenshell.api.pset
import ifcopenshell.api.resource
import ifcopenshell.api.root
import ifcopenshell.api.sequence
import ifcopenshell.api.spatial
import ifcopenshell.api.unit
import ifcopenshell.guid

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VAST_TIJDSTIP = 1767268800  # 2026-01-01T12:00:00Z
VAST_STEMPEL = '2026-01-01T12:00:00'

# Bestanden die `ifcopenshell.validate` zonder fouten moeten doorstaan (de rest is bewust ongeldig of een oude eigen
# lay-out: zie README.md).
GELDIG = [
    'model-ifc4.ifc', 'model-ifc4x3.ifc', 'model-ifc2x3.ifc', 'bonsai-4d.ifc', 'twee-werkplannen.ifc',
    'eigen-plus-model.ifc',
]


class VasteGuids:
    """Deterministische GlobalIds: md5 van een teller per bestand."""

    def __init__(self):
        self.teller = 0
        self.bestand = ''

    def nieuw(self):
        self.teller += 1
        return ifcopenshell.guid.compress(hashlib.md5(f'{self.bestand}:{self.teller}'.encode()).hexdigest())

    def start(self, bestand):
        self.bestand = bestand
        self.teller = 0


GUIDS = VasteGuids()
ifcopenshell.guid.new = GUIDS.nieuw
time.time = lambda: VAST_TIJDSTIP


def nieuw_bestand(naam, schema, app_id, app_naam):
    GUIDS.start(naam)
    f = ifcopenshell.file(schema=schema)
    f.header.file_name.name = naam
    f.header.file_name.time_stamp = VAST_STEMPEL
    persoon = f.createIfcPerson(FamilyName='Corpus')
    org = f.createIfcOrganization(Name='OpenAEC corpus')
    f.createIfcPersonAndOrganization(ThePerson=persoon, TheOrganization=org)
    f.createIfcApplication(ApplicationDeveloper=org, Version='1.0', ApplicationFullName=app_naam,
                           ApplicationIdentifier=app_id)
    return f


def model(f, project_naam='Model'):
    """Project, units, context, site/gebouw/verdieping en twee wanden met geometrie en een eigen pset."""
    project = ifcopenshell.api.root.create_entity(f, ifc_class='IfcProject', name=project_naam)
    ifcopenshell.api.unit.assign_unit(f)
    ctx = ifcopenshell.api.context.add_context(f, context_type='Model')
    body = ifcopenshell.api.context.add_context(f, context_type='Model', context_identifier='Body',
                                                target_view='MODEL_VIEW', parent=ctx)
    site = ifcopenshell.api.root.create_entity(f, ifc_class='IfcSite', name='Terrein')
    gebouw = ifcopenshell.api.root.create_entity(f, ifc_class='IfcBuilding', name='Gebouw')
    verdieping = ifcopenshell.api.root.create_entity(f, ifc_class='IfcBuildingStorey', name='Begane grond')
    ifcopenshell.api.aggregate.assign_object(f, products=[site], relating_object=project)
    ifcopenshell.api.aggregate.assign_object(f, products=[gebouw], relating_object=site)
    ifcopenshell.api.aggregate.assign_object(f, products=[verdieping], relating_object=gebouw)
    wanden = []
    for i, naam in enumerate(['Wand A', 'Wand B']):
        wand = ifcopenshell.api.root.create_entity(f, ifc_class='IfcWall', name=naam)
        rep = ifcopenshell.api.geometry.add_wall_representation(f, context=body, length=4.0 + i, height=3.0,
                                                                thickness=0.2)
        ifcopenshell.api.geometry.assign_representation(f, product=wand, representation=rep)
        ifcopenshell.api.geometry.edit_object_placement(f, product=wand)
        ifcopenshell.api.spatial.assign_container(f, products=[wand], relating_structure=verdieping)
        pset = ifcopenshell.api.pset.add_pset(f, product=wand, name='Pset_WallCommon')
        ifcopenshell.api.pset.edit_pset(f, pset=pset, properties={'IsExternal': i == 0, 'Reference': f'W{i + 1}'})
        wanden.append(wand)
    return project, wanden


def taaktijd(f, taak, start, einde, duur):
    tijd = ifcopenshell.api.sequence.add_task_time(f, task=taak)
    ifcopenshell.api.sequence.edit_task_time(f, task_time=tijd, attributes={
        'ScheduleStart': start, 'ScheduleFinish': einde, 'ScheduleDuration': duur})


def vaste_datums(f):
    """Werkplannen en werkschema's: CreationDate en StartTime vast (de API zet anders 'nu')."""
    for e in f.by_type('IfcWorkControl'):
        e.CreationDate = '2026-01-01T12:00:00'
        e.StartTime = '2026-02-02T08:00:00'


def planning_4d(f, wanden, met_baseline=True, tweede_schema=True):
    plan = ifcopenshell.api.sequence.add_work_plan(f, name='Plan')
    schema = ifcopenshell.api.sequence.add_work_schedule(f, name='Uitvoering', predefined_type='PLANNED', work_plan=plan)
    kalender = ifcopenshell.api.sequence.add_work_calendar(f, name='Werkweek')
    hoofd = ifcopenshell.api.sequence.add_task(f, work_schedule=schema, name='Ruwbouw', identification='1')
    a = ifcopenshell.api.sequence.add_task(f, parent_task=hoofd, name='Wand A bouwen', identification='1.1')
    b = ifcopenshell.api.sequence.add_task(f, parent_task=hoofd, name='Wand B bouwen', identification='1.2')
    taaktijd(f, a, '2026-02-02T08:00:00', '2026-02-06T17:00:00', 'P5D')
    taaktijd(f, b, '2026-02-09T08:00:00', '2026-02-13T17:00:00', 'P5D')
    ifcopenshell.api.sequence.assign_sequence(f, relating_process=a, related_process=b)
    # Taak <-> bouwdeel: de wand als uitvoer (IfcRelAssignsToProduct) en als invoer (IfcRelAssignsToProcess).
    ifcopenshell.api.sequence.assign_product(f, relating_product=wanden[0], related_object=a)
    ifcopenshell.api.sequence.assign_product(f, relating_product=wanden[1], related_object=b)
    # Resource met QuantityInProcess; assign_process hergebruikt OperatesOn[0], dus wand en resource komen in één
    # gemengde IfcRelAssignsToProcess (§11-vraag; zie het evidence-document).
    ploeg = ifcopenshell.api.resource.add_resource(f, ifc_class='IfcLaborResource', name='Metselploeg')
    rel = ifcopenshell.api.sequence.assign_process(f, relating_process=a, related_object=ploeg)
    rel.QuantityInProcess = f.createIfcMeasureWithUnit(f.createIfcCountMeasure(2.0),
                                                       f.by_type('IfcSIUnit')[0])
    ifcopenshell.api.sequence.assign_process(f, relating_process=a, related_object=wanden[0])
    # Kalender aan het schema-niveau: taken via IfcRelAssignsToControl.
    f.createIfcRelAssignsToControl(GlobalId=GUIDS.nieuw(), OwnerHistory=a.OwnerHistory, RelatedObjects=[a, b],
                                   RelatingControl=kalender)
    # Een vreemde pset op een taak.
    pset = ifcopenshell.api.pset.add_pset(f, product=a, name='Bonsai_Notities')
    ifcopenshell.api.pset.edit_pset(f, pset=pset, properties={'Opmerking': 'Steiger eerst'})
    if tweede_schema:
        tweede = ifcopenshell.api.sequence.add_work_schedule(f, name='Afbouw', work_plan=plan)
        ifcopenshell.api.sequence.add_task(f, work_schedule=tweede, name='Stucwerk', identification='2')
    if met_baseline:
        ifcopenshell.api.sequence.create_baseline(f, work_schedule=schema, name='Baseline 1')
    vaste_datums(f)
    return plan, schema


def schrijf(f, pad):
    f.write(pad)


def model_bestand(map_, naam, schema):
    f = nieuw_bestand(naam, schema, 'CorpusModel', 'Corpus modelleur')
    model(f)
    schrijf(f, os.path.join(map_, naam))


def bonsai_4d(map_):
    naam = 'bonsai-4d.ifc'
    f = nieuw_bestand(naam, 'IFC4', 'IfcOpenShell', 'IfcOpenShell (corpus, Bonsai-achtig)')
    _, wanden = model(f, 'Proj')
    planning_4d(f, wanden)
    # Gedeelde owner history: de eerste taak krijgt die van wand A (zoals exporters die één owner history delen).
    taak = next(t for t in f.by_type('IfcTask') if t.Name == 'Wand A bouwen')
    taak.OwnerHistory = wanden[0].OwnerHistory
    schrijf(f, os.path.join(map_, naam))


def twee_werkplannen(map_):
    naam = 'twee-werkplannen.ifc'
    f = nieuw_bestand(naam, 'IFC4', 'IfcOpenShell', 'IfcOpenShell (corpus)')
    _, wanden = model(f, 'Proj')
    planning_4d(f, wanden, met_baseline=False, tweede_schema=False)
    plan2 = ifcopenshell.api.sequence.add_work_plan(f, name='Plan 2')
    schema2 = ifcopenshell.api.sequence.add_work_schedule(f, name='Onderhoud', work_plan=plan2)
    ifcopenshell.api.sequence.add_task(f, work_schedule=schema2, name='Inspectie', identification='9')
    vaste_datums(f)
    schrijf(f, os.path.join(map_, naam))


def eigen_plus_model(map_, bron, naam):
    """Een eigen planningsbestand met een model erbij, zoals ifcpatch MergeProjects het doet: het eigen IfcProject
    blijft, het model komt eronder. Het project wijst dan naar de eigen owner history."""
    GUIDS.start(naam)
    with open(bron, 'rb') as h:
        data = h.read()
    # Oude eigen bestanden hebben 'IFC4X3' in de kop; IfcOpenShell 0.9 opent dat niet ("Unsupported schema"). Een
    # planner moet de kop dan eerst zelf aanpassen; dit script doet hetzelfde in een tijdelijke kopie.
    data = data.replace(b"FILE_SCHEMA(('IFC4X3'));", b"FILE_SCHEMA(('IFC4X3_ADD2'));")
    with tempfile.NamedTemporaryFile(suffix='.ifc', delete=False) as tmp:
        tmp.write(data)
    try:
        f = ifcopenshell.open(tmp.name)
    finally:
        os.unlink(tmp.name)
    project = f.by_type('IfcProject')[0]
    m = nieuw_bestand('model-tijdelijk.ifc', f.schema_identifier, 'CorpusModel', 'Corpus modelleur')
    _, _ = model(m)
    GUIDS.start(naam)
    m_project = m.by_type('IfcProject')[0]
    for e in m:
        f.add(e)
    for rel in f.by_type('IfcRelAggregates'):
        if rel.RelatingObject.is_a('IfcProject') and rel.RelatingObject.GlobalId == m_project.GlobalId:
            rel.RelatingObject = project
    weg =[e for e in f.by_type('IfcProject') if e.GlobalId == m_project.GlobalId]
    for e in weg:
        f.remove(e)
    f.header.file_name.name = naam
    f.header.file_name.time_stamp = VAST_STEMPEL
    schrijf(f, os.path.join(map_, naam))


def tekstbewerking(map_, bron, naam, bewerk):
    with open(os.path.join(map_, bron), 'rb') as h:
        data = h.read()
    with open(os.path.join(map_, naam), 'wb') as h:
        h.write(bewerk(data))


def crlf_commentaar(data):
    """CRLF, commentaar tussen en binnen entiteiten, en tekst met `/*`, `);` en `''`."""
    regels = data.decode('ascii').split('\n')
    uit = []
    for r in regels:
        if r.startswith('#') and '=IFCTASK(' in r:
            r = r.replace('=IFCTASK(', '= IFCTASK /* taak */ (', 1)
            uit.append('/* commentaar vóór een taak; met ; en ) erin */'.encode('utf-8').decode('ascii', 'ignore'))
        if r.startswith('#') and "'Wand A'" in r:
            r = r.replace("'Wand A'", "'Wand A /*geen commentaar*/ ); ''x'''", 1)
        uit.append(r)
    return '\r\n'.join(uit).encode('ascii')


def latin1(data):
    """Een wandnaam met een rauw Latin-1-byte (0xE9), geen geldige UTF-8 en geen STEP-codering."""
    return data.replace(b"'Wand B'", b"'Wand B caf\xe9'", 1)


def complexe_instanties(data):
    """Twee complexe instanties `#n=(A(..)B(..));` erbij, met verwijzingen; niet schemageldig, alleen voor de scanner."""
    tekst = data.decode('ascii')
    hoogste = max(int(x.split('=')[0][1:]) for x in tekst.split('\n') if x.startswith('#'))
    extra = (f"#{hoogste + 1}=(IFCNAMEDUNIT(*,.LENGTHUNIT.)IFCSIUNIT($,.MILLI.,.METRE.));\n"
             f"#{hoogste + 2}=(IFCCARTESIANPOINT((0.,0.,0.))IFCPOINT()IFCREPRESENTATIONITEM()"
             f"IFCGEOMETRICREPRESENTATIONITEM()IFCPLACEMENT(#{hoogste + 1}));\n")
    return tekst.replace('ENDSEC;\nEND-ISO', extra + 'ENDSEC;\nEND-ISO', 1).encode('ascii')


def dubbele_globalids(data):
    """De tweede wand en de tweede taak krijgen de GlobalId van de eerste (niet schemageldig)."""
    tekst = data.decode('ascii')
    regels = tekst.split('\n')

    def guid_van(prefix, naam):
        r = next(x for x in regels if prefix in x and naam in x)
        return r.split("('", 1)[1].split("'", 1)[0]
    for prefix, a, b in (('=IFCWALL(', "'Wand A'", "'Wand B'"), ('=IFCTASK(', "'Wand A bouwen'", "'Wand B bouwen'")):
        ga, gb = guid_van(prefix, a), guid_van(prefix, b)
        regels = [x.replace(f"('{gb}'", f"('{ga}'", 1) if prefix in x and b in x else x for x in regels]
    return '\n'.join(regels).encode('ascii')


def maak(map_):
    os.makedirs(map_, exist_ok=True)
    model_bestand(map_, 'model-ifc4.ifc', 'IFC4')
    model_bestand(map_, 'model-ifc4x3.ifc', 'IFC4X3_ADD2')
    model_bestand(map_, 'model-ifc2x3.ifc', 'IFC2X3')
    bonsai_4d(map_)
    twee_werkplannen(map_)
    eigen_plus_model(map_, os.path.join(ROOT, 'public/examples/showcase-verbouwing-eengezinswoning.ifc'),
                     'eigen-plus-model.ifc')
    eigen_plus_model(map_, os.path.join(ROOT, 'tests/planning/fixtures/oude-tags/v2026.9.0-10-villa-wassenaar.ifc'),
                     'oud-eigen-0.1-plus-model.ifc')
    tekstbewerking(map_, 'bonsai-4d.ifc', 'crlf-commentaar.ifc', crlf_commentaar)
    tekstbewerking(map_, 'bonsai-4d.ifc', 'latin1.ifc', latin1)
    tekstbewerking(map_, 'model-ifc4.ifc', 'complexe-instanties.ifc', complexe_instanties)
    tekstbewerking(map_, 'bonsai-4d.ifc', 'dubbele-globalids.ifc', dubbele_globalids)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    doel = args[0] if args else os.path.join(ROOT, 'tests/fixtures/ifc-foreign')
    if '--controleer' not in sys.argv:
        maak(doel)
        return 0
    with tempfile.TemporaryDirectory() as tmp:
        maak(tmp)
        verschil = 0
        for naam in sorted(os.listdir(tmp)):
            with open(os.path.join(tmp, naam), 'rb') as a:
                nieuw = a.read()
            pad = os.path.join(doel, naam)
            oud = open(pad, 'rb').read() if os.path.exists(pad) else None
            if oud != nieuw:
                verschil += 1
                print(f'XX  {naam}: wijkt af van het gecommitte bestand (opnieuw maken met maak-corpus.py)')
            else:
                print(f'OK  {naam}: reproduceerbaar')
        return 1 if verschil else 0


if __name__ == '__main__':
    sys.exit(main())
