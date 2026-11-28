# De uitvoercontrole van de merge bewaart een GlobalId als eigen string

`differenceCounts` in `src/services/ifc/foreign/mergeValidation.ts` telt GlobalId's in een `Map` die tot het einde van
de controle blijft staan. De sleutel komt uit `countEntity`, als stuk van de gedecodeerde argumententekst van een
entiteit. In V8 kan zo'n stuk een deelstring zijn die de hele tekst waaruit het komt vasthoudt. Daarom kopieert de
controle een sleutel bij de eerste invoeging met `detached` (`Array.from(key).join('')`), die een losse string geeft.
Die aanroep lijkt overbodig maar is het niet: het geheugen van opslaan met een groot gebouwmodel is een bekende grens
(knownbug 1936).
