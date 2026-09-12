# B1c — Herontwerp van de verdeeldialoog naar het Interface-lab (ontwerp)

Datum: 2026-09-12 · Status: **ontwerp compleet, door de eigenaar goedgekeurd in gesprek** ·
Vervolg op `2026-08-17-b1c-nivelleren-restcapaciteit-design.md` (§6/§7) en het plan
`2026-08-31-b1c-plan3-schrijfpad-paneel.md` (taken 8–13). Referentie voor de bouwer:
`docs/superpowers/prototypes/2026-08-27-b1c-interface-lab.html`, **tabblad 4 (fasestrook-handles)**.

## 1. Aanleiding

De gebruikstest van de eigenaar op 2026-09-12 met de drie showcases: "ik vind het hele scherm
nogal vaag, ik snap niet wat alle knoppen doen, er staat overal random tekst zonder uitleg", "je
zou toch ook met balkjes projectjes moeten kunnen slepen", "het is totaal niet duidelijk wat er
allemaal gebeurt en wat wat beïnvloedt". Oorzaak: etappe 3 is tegen de spec-tekst gebouwd, niet
tegen het speelbare prototype dat de eigenaar op 2026-08-27 koos ("we doen optie 4"). Dat
prototype bestond alleen als privé-artifact van de vorige sessie en is op 2026-09-12 teruggehaald
en in de repo gezet. De verschillen met de bouw waren wezenlijk: de strook was geen bediening maar
een dun blokje, pauzes waren onzichtbaar, tijdens het slepen bewoog niets mee, en een prominente
rangordelijst trok de aandacht weg van de balken.

## 2. Eigenaarsbesluiten (2026-09-12)

1. **Rangordelijst weg uit beeld** (keuze A). De rijvolgorde is de plaatsingsvolgorde van de
   rekenaar (minste totale speling bovenaan); sturen gebeurt uitsluitend via de handle en de pin.
   `order` in de tune-state blijft bestaan als afgeleide (spelingsvolgorde), zodat kern en
   schrijfpad niet veranderen.
2. **Het prijskaartje van "Onderbrekingen toestaan" is een verschil**, geen twee bedragen:
   uit ⇒ "zou N werkdagen besparen", aan ⇒ "bespaart N werkdagen"; bij nul "zou niets besparen"
   / "bespaart niets". N = grootste einddatum-verschuiving over de deelnemers in de uit-stand
   minus die in de aan-stand.
3. **De dialoog flitst niet.** Geen enkele rekentoestand (bezig, verouderd, tekort, toegepast)
   mag de hoogte van de dialoog of van een onderdeel veranderen.
4. De rest van de kern (verdeler, schrijfpad, "alles terugdraaien", invalidatie, keuzelijst bij
   lege start, degradatie boven de schaal) blijft zoals gebouwd.

## 3. Lay-out (van boven naar beneden)

1. **Kop**: itemnaam; ondertitel; één regel uitleg: "Trek het einde van een balk naar rechts om
   dat project te laten uitlopen; zet een project vast als het niet mag bewegen. Toepassen
   schrijft de verschuivingen in alle betrokken projecten."
2. **Gereedschap**: de schakelaar **Onderbrekingen toestaan** (gedeelde `Switch`) met het
   verschil-prijskaartje (§2.2) en de MS Project-toelichting.
3. **De balken**: per deelnemend project één rij, aaneengesloten onder elkaar, op één tijdas.
4. **De uitkomst**: het histogram Nu/Na op dezelfde tijdas (zelfde `OccupancyAxis`-instantie,
   kolom-op-kolom uitgelijnd met de balken), capaciteitslijn, rode arcering boven de capaciteit,
   conflictvenster als gestippelde band; daarboven per project een einddatum-badge.
5. **Validatiestrook** (`role="status"`, `aria-live="polite"`, altijd gerenderd, vaste hoogte):
   groen "Conflict opgelost — grootste einddatum-verschuiving +N werkdagen (<project>)" of rood
   "Nog N ploegdagen tekort op <eerste drie data>…". Ernaast de reden waarom Toepassen wel of
   niet kan.
6. **Knoppenbalk**: links **Ander item kiezen…**, **Reset** (alle plafonds en pins terug,
   schakelaar ongemoeid); rechts **Toepassen** (uit-met-reden zolang er tekort of blokkade is)
   en **Verwerpen**. Na toepassen de permanente strook "Toegepast in N projecten" met **Alles
   terugdraaien** (bestaand gedrag).

De bestaande **keuzelijst** bij lege start blijft; de bestaande dialoogbreedte (`w-[960px]
max-w-[95vw]`) blijft.

## 4. De balk (per project)

Rij = **label** (vaste breedte 150 px: kleurstip in de documentkleur, projectnaam, "speling N
dagen") | **track** (32 px hoog, lichte achtergrond, 1 px-weekscheidingen, donkerdere maandlijn)
| **uitkomstlabel** (vaste breedte 132 px).

In de track, op de gedeelde as:
- per **werkdag een apart blokje** van 15 px hoog in de projectkleur, met een 1 px witte
  scheiding rechts zodat dagen te tellen zijn (= boekingsdag uit `bookingByDay`/`afterLoadByDay`);
- een **pauzedag** (ingevoegde onderbreking) als gearceerd blokje op dezelfde hoogte
  (`repeating-linear-gradient(135deg, …)`, dun grijs randje);
- **"toegestaan maar niet benut"** als lege doos met gestippelde rand, van het nieuwe fase-einde
  tot de handle-stand;
- onderin een **meetlat** van 3 px: grijs gestippeld = de eigen speling (vanaf de oorspronkelijke
  einddatum), massief rood = alles voorbij de speling, dus echte einddatum-verschuiving;
- de **vaste last** van gepinde/#63-documenten als lichte achtergrondband (bestaand).

Het **uitkomstlabel**: een gekleurde pil met de einddatum-verschuiving ("+0 dagen" groen, "+1"/
"+2" amber, meer rood), daaronder "max <datum> · benut N". Een gepind project toont "vast";
een #63-document "vast: datums zoals opgeslagen" zonder pin-knop; een `cannotMove`-document
"kan niet wijken".

Een legenda-regel onder de balken: "Volle blokjes = werkdagen · gearceerd = pauzedag · meetlat:
grijs = speling, rood = einddatum-verschuiving · gestippeld = toegestaan maar niet benut".

## 5. Het slepen

- Alleen de **handle** aan het einde van de fase is te pakken: een knop van 15×30 px met drie
  grijpstreepjes, `cursor: ew-resize`, `role="slider"`, `aria-valuemin=0`,
  `aria-valuemax=CEILING_MAX_WORKDAYS`, `aria-valuetext` met de echte datum ("einde uiterlijk
  28 aug, maximaal 3 werkdagen uitloop, benut 2, einddatum +1 dag"). De balk zelf en het
  linkereinde liggen vast.
- Pointer capture (blijft werken buiten het element); elke beweging snapt op hele werkdagen en
  zet het **plafond** van dat project (`ceilings[docId]`, bestaande tune-state). Onbegrensd (End)
  = handle aan het einde van de as.
- **Live meerekenen tijdens het slepen** onder de ondersteunde schaal: bij elke gesnapte
  werkdagverandering één `computeDistribution`-run (gethrottled: maximaal één run in vlucht, de
  laatste stand wint), waarna eigen rij, andere rijen (hun pauzepatroon en einddatum, hun start
  niet), histogram, badges en validatiestrook meteen hertekenen. Loslaten schrijft niets.
- **Boven de schaal** (bestaande degradatiepoort: >1000 taken per document, >40 boekende taken,
  >6 documenten): tijdens het slepen beweegt alleen de handle en de plafondtekst; de run volgt bij
  loslaten. De degradatiemelding blijft.
- Toetsenbord op de handle: ←/→ één werkdag, PageUp/PageDown drie, Home = geen uitloop, End =
  onbegrensd. Elke toets is een rekenmoment (onder de schaal).
- Spec §3.4 ("nooit per sleep-pixel") wordt hiermee bewust bijgesteld naar "per gesnapte
  werkdag, gethrottled, onder de schaal" — de eigenaar wil zien wat er gebeurt terwijl hij sleept,
  en het prototype werkte zo.

## 6. De pin

Per rij een kleine tekstknop "vastzetten" ↔ "vast — losmaken" (`aria-pressed`). Vastgezet:
grijze rand om de rij, handle `aria-disabled`, het project telt als vaste last en doet niet mee.
Alle deelnemers vast ⇒ validatiestrook: "Alle projecten staan vast — er is niets te
herverdelen. Maak er één los."

## 7. Stabiliteit: geen flitsen

- De dialoog staat **aan de bovenkant verankerd** (vaste `top`, geen verticale centrering) met
  `max-h-[90vh]` en scroll binnenin, zodat een hoogteverschil nooit de positie verschuift.
- Elk onderdeel dat van toestand wisselt heeft een **gereserveerde hoogte**: de validatiestrook
  (één regel, altijd gerenderd, leeg = onzichtbare tekst), het prijskaartje (vaste breedte),
  de uitkomstlabels (vaste breedte, "Bezig…" vervangt de tekst, verandert de maat niet), de
  "toegepast"-strook (gereserveerd zodra er een record is), de stale-melding (in de
  validatiestrook, geen eigen blok).
- Rekentoestand toont zich via opaciteit/kleur, nooit via het toevoegen of weghalen van blokken.
- Browsertest: de `boundingBox` van de dialoog is identiek vóór, tijdens en ná een herberekening
  en na een sleep.

## 8. Wat blijft, wat gaat

| blijft | gaat |
|---|---|
| `computeDistribution`, `applyDistribution`/`undoDistribution`, invalidatie via vingerafdruk, `resetDocumentScopedUI`-sluiting, keuzelijst (`DistributionPicker`), degradatiepoort, `Switch` | de rangordelijst en zijn sleep-/knopcode (`rank.*`-sleutels blijven tijdelijk voor i18n-poort, worden verwijderd zodra niets ze gebruikt) |
| tune-state (`allowSplits`, `order`, `pinned`, `ceilings`, `applied`) — `order` wordt afgeleid | de kostenlabels per project (waren informatie bij de rangorde) en hun runs |
| `useDistributionProposal` (rekenmomenten, bezig-toestand, labelpas voor het prijskaartje) — uitgebreid met de gethrottelde sleeprun | de huidige `PhaseStrip`-tekening (wordt herbouwd naar §4/§5) en `BeforeAfterChart`s eigen kleurtoewijzing (één `assignDocColors` voor alles) |

Nieuwe i18n-sleutels onder `resource.distribution` (nl bron, veertien locales): `intro` (nieuwe
tekst), `tool.savesOff`/`tool.savesOn` (met `{{count}}`, meervoudfamilie) en `tool.savesNone*`,
`strip.legend`, `strip.slack`, `strip.pinButton`/`strip.unpinButton`, `strip.maxDate`,
`strip.used`, `status.resolved`, `status.shortfall`, `status.allPinned`, `reset`. Verwijderd
zodra ongebruikt: `rank.*`, `tool.price*`.

## 9. Tests

- **Headless** (`tests/planning/check-distribution-strip-geometry.ts`): uit een voorstel de
  balkgeometrie afleiden (dagblokjes, pauzedagen, gestippelde rest, meetlat grijs/rood) voor
  drie gevallen: binnen de speling, voorbij de speling, met onderbrekingen; plus de
  verschil-prijs (uit − aan, nul en positief).
- **Browser** (`tests/browser/leveling-distribution.spec.ts`, herschreven waar de bediening
  wijzigt): handle slepen ⇒ badge en histogram wijzigen tijdens het slepen (poll op
  `aria-valuenow` én op de badge-tekst vóór `mouse.up`); toetsenbord; pin; schakelaar toont
  "zou … besparen"/"bespaart …"; tekort ⇒ rode strook en Toepassen uit-met-reden; Reset; Toepassen
  en Alles terugdraaien; de dialoog-`boundingBox` is stabiel over een herberekening en een sleep;
  keuzelijst en degradatie blijven zoals ze zijn.
- Bestaande store-/kernchecks blijven ongewijzigd groen.

## 10. Documentatie

`public/docs/{nl,en}/gids-verdelen-restcapaciteit.md` herschreven naar de nieuwe bediening (de
balk als bediening, wat de arcering en de meetlat betekenen, het verschil-prijskaartje, Reset), met
één screenshot-loze beschrijving per element. `docs/library.md` alleen waar hij de rangordelijst
noemt.

## 11. Buiten scope

- De hele balk versleepbaar maken als harde plaatsing ("dit project begint hier") — een ander
  mentaal model dan het gekozen prototype; zo nodig een latere etappe.
- Een expliciete rangorde-bediening terugbrengen (ingeklapt of anders).
- Wijzigingen aan de verdeler-kern of het schrijfpad.
