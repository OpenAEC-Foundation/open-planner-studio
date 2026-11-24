# Een contour is data op de werkminuten-as van de taak

De urenverdeling van een toewijzing is opgeslagen data, geen formule. Een contour bestaat uit periodes op dezelfde
cumulatieve werkminuten-as als `TaskSplitGap`: 0 is de taakstart, de as loopt door werktijd van de taakkalender en
telt gaten mee. Een dagslot is `hoursPerDay × 60` asminuten, dezelfde maat als `splitDayPattern`. De contour-engine
(`src/engine/contour/`) rekent periodes om naar werk per dagslot en raakt geen taakdatum: de datums van een
geïmporteerde contourtaak komen uit de timephased-beslistabel van de solver en uit `splitGaps`
(`check-mpp-fidelity.ts` bewaakt dat).

## Gevolgen

- In uur-modus met ongelijk lange werkdagen is het dagslot een benadering: een vrijdag van 4 uur telt als een half
  slot. Dat is dezelfde benadering als `enumerateTaskWorkDays`, zodat de engine werk legt op precies de dagen waarop
  histogram en nivelleerder boeken. Er komt geen tweede slotdefinitie.
- Opgeslagen dagwaarden worden nooit afgerond. `distributeUnits` rondt bij een geheel tempo af op hele eenheden om
  een rekenresidu van de formule te onderdrukken; een contour is bedoelde data.
- De som van het werk per slot is exact de som van de periodes. Werk dat in een pauzeslot van `splitGaps` valt,
  schuift door naar het eerstvolgende werkslot.
- Periodes kunnen uit een handgemaakt IFC-, MSPDI- of P6-bestand komen. Niet-eindige, negatieve of nul-lange
  periodes slaat de engine over, net als `splitTotalSpanMinutes` bij gaten.
- De acht vormen staan als 21 waarden in `CONTOUR_SHAPE_VALUES`, overgenomen uit MPXJ `org.mpxj.WorkContour`
  (LGPL-2.1): index 0 is 0, index 1 tot en met 20 is het percentage werk per 5% van de duur. P6 schrijft
  `<ResourceCurve>` in dezelfde vorm, dus één tabelvorm dekt MS Project en P6.
- Een vorm wordt over de dagslots verdeeld door de dichtheid per slot te integreren, niet door te interpoleren.
  Een taak van twee dagen met *Vooraan belast* krijgt zo 65/35. De formule in `distributeUnits` interpoleert en
  vervlakt korte taken.
- Een contour hoort bij een toewijzing via `contour.resourceId`, in volgorde en elke contour hooguit één keer. Een
  ouder document zonder `resourceId` koppelt alleen als de taak precies één contour en één toewijzing heeft; anders
  volgt de toewijzing de formule. Wie de koppeling opvraagt, geeft alle toewijzingen van de taak mee zonder
  kostentoewijzingen (#815), omdat die terugval de lijstlengte telt.
