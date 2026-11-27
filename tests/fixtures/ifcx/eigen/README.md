# Eigen IFCX-planningen

`datumgevallen.ifcx` en `verbouwing-eengezinswoning-kern.ifcx` zijn de bestaande voorbeelden uit
`check-ifcx-kern.ts`. De proef vergelijkt ze met de uitvoer van de schrijver op een vast tijdstip.

`planning-met-model.ifcx` is gemaakt door `writeIfcx` met de ingelezen planning uit `datumgevallen.ifcx`
en dezelfde vaste klok. De eerste taak heeft twee uitvoerkoppelingen. De kale UUID is het muurpad uit
de tweebestandenproef van 27 november 2026. Het tweede pad, `/gevel/Raam-02`, is een zelfgekozen,
ongecontroleerd doel. De bronverwijzing gebruikt de naam en de SHA-256 van de ongewijzigde
`model.ifcx` uit die proef (ontwerpversie 23, commit `9b55f994e7f3021f6275bcde212afee3381c596b`,
`docs/superpowers/evidence/2026-11-27-ifcx-verwijzing-los-modelbestand/`).

Opnieuw genereren vanuit de hoofdmap van de repo:

```sh
OPS_IFCX_FIXTURES_WRITE=1 bash tests/planning/run.sh check-ifcx-bronverwijzing.ts
```

Zonder die omgevingsvariabele vergelijkt de proef de bestaande fixture byte voor byte met de schrijver.
