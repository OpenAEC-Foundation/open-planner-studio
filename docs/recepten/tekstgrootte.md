# Een tekstgrootte kiezen (of er één toevoegen)

De interface kent zes tekstrollen, gedefinieerd in het `@theme static`-blok van
`src/styles/globals.css` (zie *Tekstgroottes* in `CLAUDE.md`):

| rol | px × `--ui-font-scale` | waarvoor |
|---|---|---|
| `caption` | 9 | bijschriften, badges, groepslabels in het lint |
| `small` | 10 | secundaire tekst, compacte invoervelden, hints |
| `body` | 11 | de standaard: raster, panelen, dialogen, menu's |
| `large` | 12 | lint-tabs, dialoogtitels, ongestileerde tekst (erft van `body`) |
| `heading` | 14 | sectie- en kaartkoppen |
| `title` | 20 | paginatitels (Backstage, Help, projectoverzicht) |

**Dit is een toelichting, geen vervanging.** Loopt dit document ooit achter, dan heeft de code gelijk.

---

## Een bestaande rol gebruiken — bijna altijd wat je wilt

1. **In een `className`:** `text-body`. Moet je een bestaande regel overstemmen (`.input`, `.btn`
   zetten zelf een font-size), dan `!text-body`.
2. **Regelhoogte zet je zelf.** Een rol is alleen een grootte — Tailwinds `text-xs` gaf er stil een
   `line-height` bij, de rollen bewust niet. Staat de tekst in een rij met vaste hoogte, zet dan
   `leading-4` (small) of `leading-5` (body) erbij.
3. **In losse CSS:** `font-size: var(--text-body);`. Schrijf géén `calc(11px * var(--ui-font-scale))`
   meer uit; dat zit al in de rol.
4. **Relatief mag:** `font-size: 0.85em` binnen een element dat zelf een rol heeft (zo doet
   `.help-inline-code` het, zodat inline code met de omringende kop of alinea meegroeit). Let op
   nesting: `0.85em` in `0.85em` is 72%, geen 85%.

## Waar de poort je tegenhoudt

`npm run verify:text-roles` (onderdeel van `npm run verify`) keurt in `src/` af: een absolute maat in
een CSS-`font-size` (alles buiten `var(--text-<rol>)`, `em`/`%` en overervingswoorden), de
`font`-shorthand met een maat, `@apply text-xs`, `text-[11px]`/`text-[length:…]`, Tailwinds eigen
schaal (`text-xs`, `text-sm`, … — die bestaan door `--text-*: initial` niet meer en zouden **stil
niets doen**), `ops-text-N`, `fontSize` met een absolute maat in een style-object of via
`el.style.fontSize`/`setProperty`/`cssText`, en een `var(--text-…)` die geen rol is.

`tests/browser/text-roles.spec.ts` controleert daarnaast in de echte browser dat elke zichtbare tekst
op een rolmaat uitkomt, op 100% en 125%.

**Waar hij je NIET tegenhoudt:** `fontSize: n` met een variabele, en HTML-strings
(`dangerouslySetInnerHTML`). De browsertest vangt die alleen op de oppervlakken die hij bezoekt.

## Buiten de rollen

- **Canvas, PDF, print** (`src/engine/`, `src/services/`) rekenen in eigen eenheden en krijgen de
  schaal als getal mee — geen CSS, dus geen rollen.
- **SVG-`<text fontSize={9}>`** rekent in viewBox-eenheden.
- **Een echte uitzondering in de DOM** krijgt op de regel zelf, in commentaar, de markering
  `text-roles: <reden>` (zie `ScreenshotAnnotator.tsx`: annotatietekst volgt de schaal van de
  screenshot). In een string telt de markering niet.

## Een zevende rol toevoegen — een ontwerpbesluit, geen gemak

Doe dit alleen als een hele klásse tekst nergens past, niet voor één scherm. De zes zijn er gekomen
door negen losse maten terug te brengen; elke nieuwe rol is een stap terug.

1. `--text-<naam>: calc(<n>px * var(--ui-font-scale, 1));` in het `@theme static`-blok.
2. `<naam>` toevoegen aan `ROLES` in `scripts/verify-text-roles.mjs` en de px-waarde aan `ROLE_PX`
   in `tests/browser/text-roles.spec.ts`.
3. De tabel hierboven en de sectie *Tekstgroottes* in `CLAUDE.md` bijwerken.
