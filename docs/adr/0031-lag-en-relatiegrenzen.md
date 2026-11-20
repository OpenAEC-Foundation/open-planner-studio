# Eén definitie van de effectieve lag, en de SF-eis als aparte finishvloer

De effectieve lag van een relatie in dagen (`resolveEffectiveLagDays`) wordt gedeeld met de UI (de waarschuwingen in
de relatietabel), zodat er één definitie is. Een procentlag volgt uit de actuele duur van de voorganger, exact
(B7 in het ontwerp "alleen uren"); een lag die alleen in minuten bestaat, wordt met de werktijd per dag van de
lagkalender exact in dagen uitgedrukt (I11). In de motor telt een lag in werktijd in minuten: een procentlag weegt
de duur van de voorganger op diens kalender, `lagMinutes` is de bron als die er is, en anders telt `lagDays` maal de
werktijd per dag van de lagkalender. Een lag in kalendertijd telt in klokminuten.

## Gevolgen

- Een SF-relatie eist een finish (niet eerder dan de start van de voorganger plus lag). Die eis is een aparte
  ondergrens op de vroege finish, naast de startdruk van de relatie: de vroege finish wordt als start plus duur
  herberekend, en verliest de SF-eis zodra die terugtelling precies een niet-werkperiode overspant
  (`mpp14relations.mpp`, "Task 5"). Een harde finishpin wint van die vloer (ADR 0021).
- De lagkalender `24hour` is een interne kalender van zeven dagen van 24 uur.
