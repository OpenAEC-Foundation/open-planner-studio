# De IFC-lezer weigert een onvolledig bestand, nooit een leeg project

Zonder controle wordt alles wat er niet uit een bestand te halen valt stil een leeg project, en is een afgekapte
crashherstel-snapshot onzichtbaar. `readIFC` begint daarom met `assertIfcIntegrity`: het bestand moet beginnen met
`ISO-10303-21;` en eindigen met `END-ISO-10303-21;` (ISO 10303-21 §5). Ontbreekt de kop, dan is het geen STEP-bestand
(`IfcParseError` `not-step`); ontbreekt de sluitmarkering, dan is de tekst afgekapt (`truncated`). Dat is het enige
signaal dat een half weggeschreven bestand afgeeft. Ontbreekt de datasectie, dan volgt `no-data-section`. We kiezen
bewust geen inhoudelijke drempel zoals minstens één taak: een leeg maar echt project, zoals een vers project uit de
wizard met alleen kalender en resources, is geldig en zou bij crashherstel anders als onbruikbaar worden weggegooid.

## Gevolgen

- Openen en crashherstel tonen dan de leesfout, in plaats van een leeg document te openen op het pad van de
  gebruiker.
- Tolerant waar het mag: een BOM en witruimte vóór de kop, en kleine letters in kop en sluitmarkering. De
  sluitmarkering wordt gezocht in de laatste 4096 tekens. De kopregel komt uit `stepDataSection.ts`, die de
  doelcontrole ook gebruikt.
- De controle kopieert de tekst niet (`trimStart`, `toUpperCase` over het hele bestand): bestanden zijn megabytes
  groot.
- Toets: `tests/planning/check-recovery-integrity.ts`.
