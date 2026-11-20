---
name: delete-comment
description: Use ONLY when the user explicitly invokes /delete-comment, or in their own words asks to judge and remove the code comments of a part of Open Planner Studio. Classifies every comment in the given path (tautology, stale, excuse, decision record), removes them, moves decisions to docs/adr/ and workarounds to knownbugs.md, and lowers the comment baseline. NEVER auto-trigger, and never as a side job inside another PR.
---

# Delete-comment: het commentaar van één onderdeel beoordelen en weghalen

Code in deze repo heeft geen commentaar (`docs/adr/0001-geen-commentaar-in-code.md`). Wat er nog staat, staat in
`scripts/verify-comments.baseline.json` en wacht op deze skill. Je doet per keer één onderdeel: een map of een
paar bestanden die bij elkaar horen. Eén onderdeel is één PR.

Aanroep: `/delete-comment <pad>`. Zonder pad vraag je welk onderdeel. De grootste staan bovenaan in
`node scripts/verify-comments.mjs --stats <pad>` per map.

## Regels

- Je verandert geen gedrag. Alleen commentaar verdwijnt. Vind je een bug of een noodgreep, dan gaat die naar
  `knownbugs.md`, niet in deze PR.
- Je beoordeelt elk blok zelf, met de code erbij. Weghalen zonder lezen is geen uitvoering van deze skill.
- Kennis gaat niet verloren. Een besluit dat nergens anders staat, staat in een ADR vóór het commentaar weg is.
- Je schrijft geen nieuw commentaar en maakt geen bestaand commentaar langer.

## Stap 1. Meten en lezen

```bash
node scripts/verify-comments.mjs --stats <pad>
node scripts/verify-comments.mjs --list <pad> > <scratch>/blokken.json
```

`--list` geeft elk blok met `file`, `line`, `endLine`, `kind` en `text`. Lees elk bestand van het onderdeel
helemaal, met de regel van het onderdeel in `.claude/rules/` en de ADR's in `docs/adr/` die erover gaan.

## Stap 2. Elk blok indelen

| soort | herken je aan | wat je doet |
|---|---|---|
| **Herhaling** | zegt wat de naam, het type of de regel eronder al zegt; sectiekoppen en lijnen; een JSDoc die de signatuur naspreekt | weg |
| **Verouderd** | noemt een naam, bestand of gedrag dat niet meer bestaat; vertelt de geschiedenis ("fixronde 3", "eerst deed dit X", "niet meer nodig") | weg |
| **Smoes** | legt uit waarom een noodgreep mag: een benadering, een dubbele kopie, een ingeslikte fout, "niet nagemeten", "tijdelijk", "voor nu" | weg, en een punt in `knownbugs.md` |
| **Besluit** | een keuze die een lezer zonder uitleg zou terugdraaien, met een echte afweging erachter | naar een ADR, dan weg |

Twijfel tussen herhaling en besluit: zou een goede collega de code "verbeteren" naar het tegendeel als de zin er
niet stond? Dan is het een besluit. Staat het besluit al in `.claude/rules/`, een ADR of een gids, dan is het
commentaar een herhaling.

Verouderd toets je mechanisch: elke naam tussen backticks en elk genoemd bestand zoek je op (`grep -rw`,
`git ls-files`). Een knownbug-nummer zoek je op in `knownbugs.md`.

Een ADR is voor een besluit dat moeilijk terug te draaien is, dat verrast zonder uitleg en waar een echte afweging
achter zat. Een keuze op één regel ("`!has` en niet `set`, want de eerste telt") is geen ADR: houdt een test dat
gedrag vast, dan herhaalt het commentaar de test en gaat het weg. Zoek die test op (`grep` op de functienaam in
`tests/`). Is er geen test, dan meld je dat als ontbrekende test in `knownbugs.md` onder *Tests* en neem je de regel
op onder *Gevolgen* van de ADR van dat onderwerp.

Een bronvermelding van overgenomen werk met een licentie (MPXJ, LGPL-2.1) blijft als één regel staan; de poort
telt die niet als commentaar.

## Stap 3. Besluiten vastleggen

Eén ADR per besluit, niet per commentaar: meerdere blokken over hetzelfde onderwerp worden één ADR. Vorm en
nummering: `docs/adr/NNNN-korte-naam.md`, het volgende vrije nummer, Nederlands. Eerste alinea: de situatie, wat
we kozen en waarom, in een paar zinnen. Daarna alleen als het iets toevoegt `## Gevolgen` of `## Overwogen`.
Schrijf wat nu geldt; geen geschiedenis van reviewrondes. Noem bestanden en functies alleen als ze het besluit
dragen.

Zet in de regel van het onderdeel (`.claude/rules/<onderdeel>.md`) een verwijzing naar de nieuwe ADR's.

## Stap 4. Smoezen melden

Elk punt in `knownbugs.md` volgens de kop van dat bestand: wat er misgaat, waar, en **B** (zelf nagegaan in de
code of met een test) of **S** (alleen gelezen). Nummers komen uit het blok van je sessie; heb je er geen, vraag
het aan Trias.

## Stap 5. Weghalen

```bash
node scripts/verify-comments.mjs --strip <pad>
node scripts/verify-comments.mjs --strip <bestand> --only 12,48
```

`--strip` haalt de blokken weg, ruimt de lege regel op de naad op en weigert een bestand als de code erdoor zou
veranderen. Wat het meldt als "met de hand" (JSX-commentaar tussen tekst) haal je zelf weg. `--only` neemt de
beginregels uit `--list`, voor als je een onderdeel in delen doet.

Zoek daarna naar verwijzingen die nu nergens meer heen wijzen ("zie het docblok bij", "zie de kop van") in de
rest van de repo en in `.claude/rules/`, en laat ze naar de ADR wijzen of haal ze weg.

## Stap 6. Controleren en vastleggen

```bash
npm run comments:ratchet
npm run verify:comments
npm run verify:docs
```

Plus de gerichte test van het onderdeel uit de tabel *Which check after which change* in `AGENTS.md`. De baseline
gaat alleen omlaag; staat een bestand na een verplaatsing boven zijn getal, gebruik dan `--move <oud> <nieuw>`.

## Stap 7. Rapport

In de PR-tekst: het onderdeel, het aantal blokken per soort, de regels minder, de nieuwe ADR's, de
knownbug-nummers, en wat je met de hand deed.
