# Geen commentaar in code

Bijna een vijfde van de coderegels was commentaar (ruim 100.000 regels, gemeten op 2026-11-20). Commentaar
veroudert zonder dat een test rood wordt, en een agent die een noodgreep met een zin uitlegt, krijgt die noodgreep
door de review; de volgende agent neemt hem over. We schrijven daarom geen commentaar meer in code. Wat de code
niet zelf zegt, gaat naar een van drie plekken: een naam, type of test als het over gedrag gaat, een ADR in deze
map als het een besluit is dat verrast zonder uitleg, en `knownbugs.md` als het een noodgreep of een ongetoetste
aanname is.

De poort `npm run verify:comments` keurt nieuw commentaar af. Bestaand commentaar mag blijven tot het is
beoordeeld. De poort vergelijkt daarvoor met de basis: elke commentaarregel in een gewijzigd bestand moet al op de
basiscommit staan, ergens in de gewijzigde bestanden en even vaak. Weghalen en met de code mee verhuizen mag dus,
schrijven en herschrijven niet. De basis is lokaal de merge-base met `origin/main` (in een ondiepe checkout zet je
`VERIFY_COMMENTS_BASE=origin/main`) en in CI de eerste ouder van de merge-commit. De skill `/delete-comment`
beschrijft het beoordelen en opruimen per onderdeel.

De poort keurt alleen af op een PR en lokaal. Op een push naar `main` meldt hij de regels en
blijft hij groen: een rode `main` houdt de deploy en de release tegen, en dat weegt zwaarder dan een paar regels
commentaar. Een PR die al groen was voordat de poort bestond en zonder nieuwe CI-run wordt samengevoegd, kan dus
commentaar meenemen; de eerstvolgende PR die dat bestand raakt, mag het alleen nog weghalen.

## Wat geen commentaar is

Aanwijzingen die het gereedschap zelf herkent: wat de TypeScript-parser als pragma of als `@ts-ignore` en
`@ts-expect-error` leest (ook `/// <reference … />` en `@jsxImportSource`), `eslint-disable` en verwanten,
`@vite-ignore`, `@__PURE__` en de markering `text-roles:`. Verder JSDoc in JavaScript-bestanden die alleen typetags
bevat (ook onder `@typedef` en `@overload` staat dan geen uitleg), een kale `/** @deprecated */` of
`/** @internal */`, en een bron- of licentievermelding van één regel (`// Bron: … (LGPL-2.1 …)`, een SPDX-kenmerk,
een copyrightregel). Buiten bereik: `docs/`, `examples/`, gegenereerde bestanden en alles wat geen
TypeScript of JavaScript is.

## Overwogen

Een ESLint-regel. `npm run lint` kijkt alleen naar `src/` en is bewust klein; de structurele poorten van deze repo
zijn `verify:*`-scripts op de TypeScript-AST. Eén script dekt alle mappen, toetst, telt en haalt weg.

Een telbestand met commentaarregels per bestand. Gebouwd en verworpen in de review: een commentaar kon ongezien
door een even lang ander worden vervangen, twee opruimingen in hetzelfde bestand maakten main rood na het samenvoegen,
en elke PR op main met nieuw commentaar maakte de branch met de poort rood. Vergelijken met de basis heeft geen
bestand nodig.

Een poort die ook op `main` afkeurt. Verworpen in de review: een open PR met groene CI van vóór de poort maakte
`main` rood na het samenvoegen, en de branchbeveiliging eist geen nieuwe run.

Weghalen per regelnummer (`--strip --only`). Verworpen in de review: na de eerste aanroep schuiven de regels op en
wijst een nummer uit de oude lijst een ander blok aan.

