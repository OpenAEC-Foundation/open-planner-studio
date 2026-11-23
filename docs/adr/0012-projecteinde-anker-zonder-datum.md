# Speling tot de projecteinddatum zonder datum is gewoon het netwerkeinde

De projectoptie `useProjectEndDateForFloat` ankert de late pass op de ingestelde projecteinddatum. Zonder bruikbare
datum doet P6 wat het zonder "Must Finish By" doet: het laatste vroege einde is de basis (Oracle P6 Help, Schedule
Options, Compute Total Float As). De optie stuurt naast het anker nog drie takken: de grens van een open
eindmijlpaal in de solver en in `scheduleAnalysis`, en de klem op vrije speling 0 van een eindmijlpaal. Zonder datum
mogen die niet anders lopen dan met de optie uit. Daarom normaliseert `withEffectiveProjectEndAnchor` op één plek:
optie aan zonder geldige datum geldt als optie uit. Met een geldige datum, of met de optie uit, blijft het
optie-object hetzelfde object.

## Gevolgen

- Een ingestelde projecteinddatum is een eindmoment: een datum zonder tijd wordt het einde van de dag op de
  projectklok, gesnapt op of vóór een werkmoment van de projectkalender. De regel dat een mijlpaal op het berekende
  projecteinde de laatste werkdag opent (ADR 0014), geldt dan niet.
