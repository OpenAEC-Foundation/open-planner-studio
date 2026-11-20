# Een kalendertijdtaak rekent in kloktijd, ook buiten werktijd

MS Project plant een ELAPSEDTIME-taak puur in kalendertijd, ook op een moment dat geen werktijd is. De solver snapt
zo'n taak daarom nergens naar een werkmoment waar het om haar eigen planning gaat: niet als opvolger
(`snapSuccessorEarlyStart`), niet als wortel (haar rauwe anker), en niet als ze een kalendertijd-hervattingspunt
krijgt. Haar duur, rest, speling en een hammockspan in kalendertijd tellen in klokminuten, met een vaste dag van
24 uur en nooit gedeeld door de werktijd per dag van de kalender. Een mijlpaal met duur die ELAPSEDTIME is, valt
er wel onder; een echte nulduurmijlpaal niet (`isElapsedTask` sluit die uit).

## Gevolgen

- Het constraintpad snapt wel: een SNET-, MSO- of MFO-datum op een kalendertijdtaak snapt naar een werkmoment,
  net als een harde pin. Alleen de duurstap van een pin rekent in kloktijd. Deze afbakening is bewust, maar geen
  test houdt haar vast.
- De speling van een kalendertijdtaak is de getekende klokspan (`signedElapsedSpan`), omdat haar datums op een
  niet-werkdag mogen liggen (`msp-14`).
- Een lopende kalendertijdtaak houdt haar kalendertijd: zonder die tak zou ze met voortgang stil naar werktijd
  omslaan. Haar rest staat in de eigen eenheid (minuten of dagen) en wordt omgerekend naar klokminuten.
