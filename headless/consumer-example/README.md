# Consumeervoorbeeld: `@openaec/open-planner-core`

Een extern programma dat alleen het gebouwde pakket gebruikt. Het leest een IFC-planning, rekent
die door zoals de app en toont de samenvatting.

```bash
npm run build:core                 # in de root van de repo → dist-core/
cd headless/consumer-example
npm install                        # installeert dist-core als pakket
node index.mjs ../../examples/01-grachtenpand-amsterdam.ifc
node index.mjs ../../examples/01-grachtenpand-amsterdam.ifc --json --out /tmp/herberekend.ifc
```

`npm run verify:core-package` doet hetzelfde automatisch, maar dan met `npm pack` en een install
in een tijdelijke map. Uitleg: [docs/headless-kern.md](../../docs/headless-kern.md).
