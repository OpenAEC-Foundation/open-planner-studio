# Geen commentaar in code

Bijna een vijfde van de coderegels was commentaar (ruim 100.000 regels, gemeten op 2026-11-20). Commentaar
veroudert zonder dat een test rood wordt, en een agent die een noodgreep met een zin uitlegt, krijgt die noodgreep
door de review; de volgende agent neemt hem over. We schrijven daarom geen commentaar meer in code. Wat de code
niet zelf zegt, gaat naar een van drie plekken: een naam, type of test als het over gedrag gaat, een ADR in deze
map als het een besluit is dat verrast zonder uitleg, en `knownbugs.md` als het een noodgreep of een ongetoetste
aanname is.

De poort `npm run verify:comments` keurt nieuw commentaar af. Bestaand commentaar mag blijven tot het is
beoordeeld: `scripts/verify-comments.baseline.json` telt de commentaarregels per bestand, en dat getal gaat alleen
omlaag. De telling moet precies kloppen: wie commentaar weghaalt, legt dat vast met `npm run comments:ratchet`,
anders is de poort rood. Zo kan vrijgekomen ruimte niet later met nieuw commentaar worden gevuld. De skill `/delete-comment` beschrijft het beoordelen en opruimen per onderdeel.

## Wat geen commentaar is

Aanwijzingen voor gereedschap in hun geldige vorm (`@ts-expect-error`, `eslint-disable`, `/// <reference … />`,
`@vite-ignore`, `@__PURE__`, `@jsxImportSource`, de markering `text-roles:`), JSDoc in JavaScript-bestanden die
alleen typetags bevat en geen uitleg, en een licentie- of bronvermelding van één regel met een licentienaam,
een SPDX-kenmerk of een copyrightjaar. Buiten bereik: `docs/`, `examples/`, gegenereerde bestanden en alles wat geen
TypeScript of JavaScript is.

## Overwogen

Een ESLint-regel. `npm run lint` kijkt alleen naar `src/` en is bewust klein; de structurele poorten van deze repo
zijn `verify:*`-scripts op de TypeScript-AST. Eén script dekt alle mappen, telt, haalt weg en houdt de baseline bij.

Een baseline per commentaar (hash) in plaats van per bestand. Strenger, maar elke PR die een commentaar raakt, zou
dan botsen in één groot bestand.
