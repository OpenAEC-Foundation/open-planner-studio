# Een duurwijziging herschaalt de contour en de gaten

Verandert de duur van een taak met een contour, dan rekt of krimpt de contour mee over de as: begin en lengte van
elke periode maal dezelfde factor, de gaten ook. Het werk schaalt mee, behalve als de taak werk behoudt (vast werk):
dan blijft het werk staan en verandert alleen de inzet per dag. We volgen hiermee MS Project bij een toewijzing met
*Contoured*; dat gedrag is als ontwerpregel overgenomen en niet tegen MS Project nagemeten.

## Gevolgen

- Periodes met verricht werk (`kind: 'actual'`) blijven staan. Alleen het deel van de as na het laatste verrichte
  werk herschaalt, met een factor over dat resterende deel. Is er geen bruikbaar restant, dan blijft het profiel
  ongewijzigd.
- `Task.splitGaps` herschaalt met dezelfde factor en hetzelfde anker, zodat de gaten van de solver en die van de
  belasting gelijk blijven. Nivelleergaten doen niet mee.
- Een gat van de gebruiker springt na het herschalen terug op een hele eenheid (in dagmodus een werkdag), met
  minstens één eenheid pauze. Anders rondt de dagafronding het bij een forse krimp weg. Een gat uit een import blijft
  fractioneel: dat is brondata.
- Oude en nieuwe duur worden op dezelfde as gemeten (`taskAxisMinutes`). Bij kalendertijd is dat klokdagen maal de
  werktijd per dag, in dagen en in uren. Een taak van 2 d en een van 48 u zijn bij 8 uur per dag allebei 960; een
  wissel van eenheid herschaalt dus niets (knownbug 265, `check-contour-unit-switch.ts`).
