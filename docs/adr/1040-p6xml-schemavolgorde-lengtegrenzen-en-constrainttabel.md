# P6 XML: de schemavolgorde, de lengtegrenzen en de constrainttabel komen van buiten

De tabellen in `p6xmlSchemaOrder.ts` en `p6ConstraintTypes.ts` zijn geen eigen keuze: ze volgen het P6-schema en
echte exports, en wie er een element of soort aan toevoegt, zoekt de plek daar op en niet in de code. `ORDER` in
`p6xmlSchemaOrder.ts` neemt per element de kinderen die de writer schrijft in de volgorde van de `propOrder` van
de schemaklassen van MPXJ (`org.mpxj.primavera.schema`, schema V25.12), omdat P6 zijn import tegen dat schema
valideert en elk type daar een `xs:sequence` is; `P6_MAX_LENGTH` neemt de `xs:maxLength` uit dezelfde klassen, omdat
P6 anders het hele bestand weigert.

## Gevolgen

- Een kind zonder plek in `ORDER` geeft een exception in `orderedChildren`, en geen plek achteraan: een element op
  een verkeerde plek maakt het bestand voor P6 ongeldig.
- `UDF` en `ScheduleOptions` in `<Project>` staan waar echte P6-exports ze zetten: de project-UDF na de gewone
  velden en vóór WBS en activiteiten, de rekenopties als laatste kind.
- `P6_CONSTRAINT_KINDS` volgt `ConstraintTypeHelper` van MPXJ (`XML_TYPE_MAP` naast `XER_TYPE_MAP`): het label voor
  P6 XML en het `CS_*`-token voor XER per soort. Hoe de lezer en de
  writer de tabel gebruiken, staat in ADR 0267 en 0364.
