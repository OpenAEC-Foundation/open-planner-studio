# UI-voorstel: de conventies in het profielblok per thema (2026-09-24)

De 26 conventies in Projectinfo stonden in één lange lijst, zonder uitleg in beeld en zonder te zien
wat de standaard van het profiel is. Dit voorstel zet ze onder zes onderwerpen, met achter elke regel
de standaardwaarde van het gekozen profiel en een knop om een afwijking terug te zetten. De uitleg
klapt per regel uit in plaats van alleen in een tooltip te staan. Dit is een voorstel op een eigen
branch (`claude/x12-ui-conventies-groepen`): niets is gemerged, de eigenaar beoordeelt op de
screenshots.

Bron: gebruikstest 24-09 (B3, B6, B8, B10), eindreview Fable PR #169 (bevinding 2 en 3).
Geen motorwijziging: het nieuwe registerveld `theme` is beschrijvend en wordt alleen door de UI
gelezen.

## Wat er te zien is

- **Zes thema's plus één restgroep**, elk als omlijnd blok met een kop en het aantal regels. Heeft een
  groep afwijkingen, dan staat er een oranje label "afwijkend: n" bij de kop.
- **Per regel:** een pijltje (klapt de uitleg uit als blauw blok), het vinkje met de naam, grijs
  "basis: aan/uit" (de waarde van het basisprofiel; bij een eigen profiel die van zijn ingebouwde
  basis), en bij een afwijking een oranje achtergrond, vette naam en de link **terug naar basis**.
- **A19** heeft een blauw label **per bestand**. Terug naar basis maakt van een ingebouwd profiel
  geen kopie (nieuwe pure functie `resetConventionToBase`); zo verdwijnt ook "Primavera P6 (aangepast)".
- **Alleen voor eigen profielen:** de conventies die in élk ingebouwd profiel uit staan, als laatste
  groep met een blauw uitlegblok. De groep wordt afgeleid (`isOffInEveryBuiltIn`): nu C1 en C4; na
  het samenvoegen van vraag 7 (A17/B3/B4 uit in P6) verhuizen die drie vanzelf mee.
- **Instellingen uit het bronbestand (B10):** de drie P6-opties die niet te wijzigen zijn, staan
  alleen-lezen in een blauw blok onderaan, alleen als het project ze draagt. Staat A21 aan en B3 uit,
  dan zegt het blok dat A21 dan niets doet (eindreview bevinding 3).
- **SS-lag-optie (B8):** de reden waarom het veld grijs is, staat nu zichtbaar in een blauw blok onder
  het veld, niet meer alleen in een tooltip.

## De indeling per thema

| Thema | Conventies | Waarom hier |
|---|---|---|
| Voortgang en voltooid werk | A12, A19, B3, B4, C5, C8, C11 (+ C1, C4 in de restgroep) | wat er met gestarte en voltooide taken rond de statusdatum gebeurt |
| Relaties en lag | B1, B2, C3, C6, C12 | hoe een relatie of haar lag de opvolger of de late kant bindt; C3 en C6 zijn elkaars tegenhanger (lag na voltooide / lopende voorganger) |
| Mijlpalen en LOE-activiteiten | A15, A17, C7, B5 | activiteiten met een venster in plaats van een duur; C7 omdat het doel van de relatie de mijlpaal is |
| Speling en late datums | A13, C2, C9 | de speling zelf en de late finish waaruit ze volgt |
| Datums en tijdstippen uit het bestand | A16, A18, A20 | een datum of moment uit het bestand blijft letterlijk staan (geplande start, werkelijke datums, constraintmoment) |
| Voortgang zoals Microsoft Project | A22, A23 | de twee MS Project-conventies apart, zodat ze niet tussen de P6-regels staan |
| Alleen voor eigen profielen | C1, C4 (na vraag 7 ook A17, B3, B4) | in elk ingebouwd profiel uit |

Twijfelgevallen, ter beoordeling: B4 (voltooide LOE) staat bij voortgang en niet bij LOE; A20
(constraintmoment op een mijlpaal) staat bij tijdstippen en niet bij mijlpalen; C8 staat bij voortgang,
terwijl zijn tegenhanger A16 bij tijdstippen staat.

## Termen (B6)

Gekozen volgens de gids, en in de nl-labels, de nl-helpteksten en de gids zelf gelijkgetrokken:

- relatietypen: **eind-start, start-start, eind-eind** (weg: "begin-begin", "einde-begin",
  "einde-einde", "eind-eindrelatie", "eind-eindgrens");
- **werkelijk** in plaats van "actueel" (zoals de rest van de app: "Werkelijke start");
- **finish** blijft voor berekende datums (vroege/late finish, finishgrens), zoals de gids het
  gebruikt; "werkelijk einde" voor het geregistreerde einde. De app-kolommen zeggen wél "Vroegste
  einde" — dat verschil is een open keuze voor de eigenaar;
- "SS-lag", "LOE" en "Progress Override" blijven, omdat de gids ze zo noemt. "Retained Logic" kreeg
  "(P6: …)" ervoor.

Andere talen: alleen de nieuwe sleutels (thema's, basis, terug naar basis, bronbestand) zijn in alle
veertien talen toegevoegd; bestaande labels in andere talen zijn niet aangeraakt.

## Wat de eigenaar moet beoordelen

1. Is deze indeling in zes thema's de juiste, en kloppen de drie twijfelgevallen hierboven?
2. Groepen altijd open (zoals nu) of ingeklapt met alleen de groep met afwijkingen open (zoals B3
   voorstelt)? Ingeklapt maakt het blok korter, maar verbergt de standaardwaarden.
3. Is "basis: aan/uit" in grijs duidelijk genoeg, of liever een label "P6"/"MSP" per regel zoals de gids?
4. Oranje achtergrond plus vette naam voor een afwijking: te veel of juist goed?
5. Finish of einde in de conventielabels (zie Termen)?
6. Het bronbestand-blok alleen tonen als het project de opties draagt (zoals nu), of altijd?

## Screenshots

Lokaal in `qa/ui-conventies-groepen/` (gitignored): `voor-100.png`, `voor-125.png` (huidige lijst) en
`na-100.png`, `na-125.png` (dit voorstel), steeds met een `.xer` met A19 uit het bestand en één
afwijking (*Vrije speling nooit negatief* uit); in de ná-shots is de uitleg van A19 uitgeklapt.

## Controle

Typecheck, lint, `verify:conventions`, `verify:text-roles`, `verify:i18n`, `verify:docs`,
`verify:cycles`, `verify:store-boundaries`, de planningchecks `check-conventions-registry.ts` en
`check-scheduling-profile-draft.ts`, en `tests/browser/scheduling-profile.spec.ts` (aangepast en met
een nieuwe test voor groepen, basis, terug naar basis, uitleg en het bronbestand-blok).
