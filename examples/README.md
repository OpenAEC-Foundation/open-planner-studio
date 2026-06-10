# Voorbeeldplanningen

Deze map bevat **22 voorbeeldplanningen** in IFC 4.3-formaat (buildingSMART) — het
native bestandsformaat van Open Planner Studio. Open ze via **Bestand → Openen**.
Ze bestrijken uiteenlopende sectoren: woningbouw, utiliteit, infra, renovatie en industrie.

| Bestand | Project | Taken* |
|---------|---------|--------|
| `01-grachtenpand-amsterdam.ifc` | Nieuwbouw Grachtenpand Amsterdam | 51 |
| `02-renovatie-basisschool.ifc` | Renovatie Basisschool De Regenboog | 37 |
| `03-kantoorgebouw-zuidas.ifc` | Kantoorgebouw Zuidas | 57 |
| `04-appartementen-eindhoven.ifc` | Woningbouw 24 Appartementen Eindhoven | 51 |
| `05-brugvervanging-n279.ifc` | Brugvervanging N279 | 39 |
| `06-parkeergarage-utrecht.ifc` | Parkeergarage Stationsplein Utrecht | 45 |
| `07-industriehal-venlo.ifc` | Industriehal Logistiek Venlo | 36 |
| `08-zorgcentrum-de-linde.ifc` | Zorgcentrum De Linde | 47 |
| `09-rioolvervanging-delft.ifc` | Rioolvervanging Centrum Delft | 26 |
| `10-villa-wassenaar.ifc` | Villa Nieuwbouw Wassenaar | 47 |
| `11-sporthal-amstelveen.ifc` | Sporthal Gemeente Amstelveen | 35 |
| `12-windturbine-offshore.ifc` | Windturbine Fundatie Offshore | 30 |
| `13-supermarkt-albert-heijn.ifc` | Supermarkt Verbouwing Albert Heijn | 25 |
| `14-fietstunnel-arnhem.ifc` | Fietstunnel Station Arnhem | 33 |
| `15-datacentrum-agriport.ifc` | Datacentrum Agriport A7 | 41 |
| `16-dijkversterking-markermeerdijk.ifc` | Dijk Versterking Markermeerdijk | 37 |
| `17-hotel-scheveningen.ifc` | Hotel 120 Kamers Scheveningen | 49 |
| `18-station-uitbreiding-breda.ifc` | Treinstation Uitbreiding Breda | 45 |
| `19-basisschool-ikc.ifc` | Basisschool Nieuwbouw IKC | 42 |
| `20-woonwijk-almere.ifc` | Woonwijk 60 Woningen Almere | 68 |
| `oosterhoutse-baai-drijvende-woningen.ifc` | Ontwikkeling 30 drijvende woningen Oosterhoutseplas | 125 |
| `woongebouw-nieuwbouw.ifc` ⭐ | Nieuwbouw Woongebouw Parkzicht | 40 |

<sub>* Aantal `IfcTask`-entiteiten, inclusief fasen (WBS) en mijlpalen.</sub>

> **Resources:** alleen `woongebouw-nieuwbouw.ifc` (⭐) bevat resource-toewijzingen
> (arbeid, materieel, onderaannemers). De overige bestanden bevatten taken, relaties
> en een kalender, maar geen resources. Dat bestand staat hieronder uitgelicht.

---

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
