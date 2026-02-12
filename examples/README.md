# Voorbeeldplanningen

## woongebouw-nieuwbouw.ifc

Een complete bouwplanning voor een nieuwbouw woongebouw met 24 appartementen over 6 verdiepingen.

### Projectgegevens

| Gegeven | Waarde |
|---------|--------|
| **Projectnaam** | Nieuwbouw Woongebouw Parkzicht |
| **Startdatum** | 2 maart 2026 |
| **Einddatum** | 30 oktober 2026 |
| **Doorlooptijd** | ~8 maanden |
| **Aantal taken** | 36 activiteiten + 4 mijlpalen |
| **Aantal fasen** | 6 |

### Fasen

| Fase | Naam | Duur | Periode |
|------|------|------|---------|
| 1 | Bouwplaatsinrichting & Grondwerk | 25 werkdagen | mrt 2026 |
| 2 | Fundering | 25 werkdagen | mrt - apr 2026 |
| 3 | Ruwbouw / Casco | 45 werkdagen | apr - jun 2026 |
| 4 | Installaties (MEP) | 40 werkdagen | jun - aug 2026 |
| 5 | Afbouw | 40 werkdagen | aug - okt 2026 |
| 6 | Oplevering | 12 werkdagen | okt 2026 |

### Mijlpalen

- **1.5** Inspectie bouwput (gemeente)
- **2.6** Inspectie fundering (constructeur)
- **3.7** Casco waterdicht
- **4.5** Inspectie installaties
- **6.4** Definitieve oplevering (sleuteloverdracht)

### IFC-entiteiten gebruikt

- `IfcProject` — Projectcontainer
- `IfcWorkPlan` — Hoofdplanning
- `IfcWorkSchedule` — Bouwplanning v1.0
- `IfcWorkCalendar` — Bouwkalender NL (ma-vr 07:00-16:00)
- `IfcTask` — 36 taken + 4 mijlpalen
- `IfcTaskTime` — Tijddata per taak (duur, start, eind, float, critical)
- `IfcRelNests` — WBS-hiërarchie (6 fasen)
- `IfcRelSequence` — 32 dependencies (FS, SS met lag)
- `IfcLaborResource` — 8 ambachten (timmerman, metselaar, etc.)
- `IfcConstructionEquipmentResource` — 4 machines (kraan, heimachine, etc.)
- `IfcSubContractResource` — 4 onderaannemers
- `IfcRelAssignsToProcess` — Resource-toewijzingen
- `IfcRelAssignsToControl` — Taken gekoppeld aan werkschema

### Kalender

- **Werkdagen**: maandag t/m vrijdag
- **Werktijden**: 07:00 - 16:00 (8 netto uren)
- **Feestdagen 2026**: Nieuwjaar, Goede Vrijdag, Pasen, Koningsdag, Bevrijdingsdag, Hemelvaart, Pinksteren
- **Bouwvak**: 20 juli - 7 augustus 2026 (regio Noord)
