// Vaste sleutels uit een bronbestand, zodat een lezer bij elk inlezen dezelfde id's geeft (knownbug 837).
// Een externe relatie bewaart het id van de brontaak; "Bron vernieuwen" vindt de taak alleen terug als
// het volgende inlezen hetzelfde id geeft.
//
// Welke sleutel vast is, verschilt per formaat en per schrijver:
//  - MS Project: de Unique ID (`<UID>`) blijft gelijk en wordt nooit hergebruikt ("the Unique ID
//    always remains constant, regardless of any editing", support.microsoft.com, *Unique ID fields*).
//  - Primavera P6: de `GUID`, anders de `ObjectId` (de databasesleutel).
//  - Een MSPDI- of P6 XML-bestand van OPS zelf nummert taken op volgorde (`mspdiWriter.ts`: `i + 1`,
//    `p6xmlWriter.ts`: `nextObjId++`, project altijd ObjectId 1). Na een ingevoegde taak schuiven die
//    nummers op; een id daarop zou stil een andere taak vinden. Daar blijft het id willekeurig.

/** Een GUID uit een bronbestand, genormaliseerd (zonder accolades, kleine letters), of `undefined` als
 *  de tekst geen GUID is. P6 schrijft `{3E26F2FE-0B4E-11D6-B004-00062970E589}`, MS Project zonder
 *  accolades. */
export function sourceGuid(raw: string): string | undefined {
  const guid = raw.trim().replace(/^\{/, '').replace(/\}$/, '').toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(guid) ? guid : undefined;
}
