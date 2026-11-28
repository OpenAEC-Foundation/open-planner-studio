# De uitvoercontrole van de merge bewaart een GlobalId als eigen string

`differenceCounts` in `src/services/ifc/foreign/mergeValidation.ts` telt per GlobalId hoe vaak die in de uitvoer en de
bron voorkomt, in een `Map` die tot het einde van de controle blijft staan. De sleutel komt uit `countEntity`, als stuk
van de gedecodeerde argumententekst van een entiteit. In V8 is zo'n stuk uit `slice` of `trim` een deelstring
(`SLICED_ONE_BYTE_STRING_TYPE`) die de hele tekst waaruit hij komt vasthoudt; met één sleutel per entiteit blijft zo de
tekst van elk geteld stuk in het geheugen. Daarom zet de controle een sleutel pas in de `Map` na `detached`
(`Array.from(key).join('')`), die een nieuwe, losse string geeft. Die aanroep lijkt overbodig maar is het niet: het
geheugen van opslaan met een groot gebouwmodel is een bekende grens (knownbug 1936).
