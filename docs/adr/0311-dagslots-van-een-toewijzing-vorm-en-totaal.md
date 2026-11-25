# De dagslots van een toewijzing: de vorm uit de hoogste bron, het totaal uit opgeslagen werk

`assignmentDayUnits` (`src/engine/scheduler/ResourceLoad.ts`) geeft de eenheden per dagslot van één toewijzing. De
vier bronnen en hun volgorde staan in de regel `contour`: een gekoppelde contour, `curveValues`, opgeslagen werk en de
formule (ADR 0310). Dat exacte curvewaarden ook naast een vormnaam winnen en een contour zonder periodes niet telt,
staat in ADR 0005. Hier ligt vast hoe vorm en totaal samengaan als een toewijzing `curveValues` en opgeslagen werk
(`remainingWorkMinutes`) allebei draagt: de 21 waarden geven de vorm, het opgeslagen werk het totaal. Zonder werkveld
is het totaal inzet maal duur. Opgeslagen werk is het totaal zodat een toewijzing die de duur niet stuurt haar eigen
werk boekt en niet inzet maal restduur. Won de curve ook voor het totaal, dan boekte ze inzet maal duur in plaats van het werk
(bevinding 7 van de review van #170, volgens `check-work-rule-store.ts`; de gevallen g5 en g6 vergelijken de som en
de vorm).

## Gevolgen

- Het totaal bij opgeslagen werk is verricht plus resterend werk (`storedTotalUnits`): `remainingWorkMinutes` plus
  `actualWorkMinutes` als de toewijzing dat veld heeft, anders een verricht deel dat de functie afleidt als de duur min
  de restduur (`remainingDaysOf`), maal de inzet. Reden: een toewijzing kan restwerk dragen zonder
  `actualWorkMinutes`, en zonder het afgeleide deel zou de belasting van een gestarte taak dan alleen het restwerk
  tellen. `check-work-rule-store.ts` toetst in h1 na een typewissel alleen `remainingWorkMinutes` en in h2 dat
  `assignmentDayUnits` na de typewissel op zes decimalen dezelfde slots geeft als ervoor; g4 toetst een meegegeven
  verricht deel. Negatieve werkvelden tellen als 0. `remainingDaysOf` rondt de afgeleide rest af; de solver in de
  dagenmaat (`progressWork` in `CPMSolver.ts`) en `remainingMinutesOf` (`workRuleApply.ts`) ronden niet af; in de
  minutentak rondt de solver de rest uit `completion` wel af op hele minuten. Het gevolg voor de afronding staat in
  knownbug 2322.
- Opgeslagen werk telt alleen als `remainingWorkMinutes` eindig is en de duur groter dan 0; `curveValues` telt alleen
  bij een duur groter dan 0. Opgeslagen werk zonder `curveValues` spreidt zonder afronding met de tabelvorm van de
  curve (`CONTOUR_SHAPE_VALUES` via `CURVE_TO_SHAPE`; een toewijzing zonder curve krijgt *Gelijkmatig*), niet met de
  interpolatie van de formule.
- Een contour rekent met een slot van `max(1, mpd)` minuten en zonder afronding (ADR 0002). Geeft ze geen slots, dan
  valt de functie door naar de volgende bron. Geeft ze meer slots dan `scheduleDuration`, dan is de lijst langer;
  `dayslotLoad` neemt daarom `max(scheduleDuration, units.length)` werkdagen en kapt beide lijsten af op de kortste.
- De aanroeper mag de contour al opgezocht meegeven, ook als `null`. Zonder dat argument koppelt de functie zelf, met
  `siblings` of anders alleen met de eigen toewijzing. `contourLookup` koppelt één keer per taak met alle meegegeven
  toewijzingen van die taak, omdat de koppeling op volgorde gaat (ADR 0002). `assignmentLoadOnPlacement` vraagt de
  slots met `null`, omdat `assignmentPlacementLoad` een contour zelf op de plaatsing snijdt.
