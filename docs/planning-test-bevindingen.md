# Testbevindingen — correctheid van de planning (CPM)

**Datum:** 2026-06-26
**Onderwerp:** klopt de planningsberekening (kritiek pad, relaties, mijlpalen, kalender) bij echt gebruik?
**Aanpak:** zie [testplan-spec](superpowers/specs/2026-06-26-planning-correctheid-testplan-design.md). Korte samenvatting onderaan.
**Status:** test- en rapportageronde afgerond. **Nog geen code gewijzigd** — fixes pas na overleg.

---

## In één oogopslag

Er zijn ~115 testgevallen gedraaid tegen de échte rekenmotor van de app. De **kalender en het
kritieke pad zelf werken goed**; de fouten zitten in de **relatietypes (behalve gewone "klaar → start"),
in uitloop-/aanlooptijden (lag), en in een paar nul-duur-/randgevallen**.

| # | Bevinding | Ernst | Bevestiging |
|---|---|---|---|
| 1 | **"Finish-Finish"-relatie wordt verkeerd berekend** (als gewone "Finish-Start") | 🔴 Hoog | code + ~12 gevallen + 3/3 narekening |
| 2 | **Uitlooptijd (lag) telt één werkdag te weinig** — een lag van 1 dag doet niets | 🟠 Midden | code + probes + 3/3 |
| 3 | **Negatieve lag (aanlooptijd/"lead") wordt volledig genegeerd** | 🟠 Midden | code + probes + 3/3 |
| 4 | **Een mijlpaal in een keten schuift de opvolger een werkdag op** | 🟠 Midden | probes + 3/3 |
| 5 | **Vrije speling ("free float") is overal precies 1 werkdag te hoog** | 🟠 Midden | 23/23 gevallen + 3/3 |
| 6 | **Projectduur van een nul-duur-project wordt als 1 gemeld i.p.v. 0** | 🟡 Laag | probes + 3/3 |
| 7 | **"Start-Finish"-relatie is slechts bij benadering** (zeldzaam type) | 🟡 Laag | code (zelf gedocumenteerd) + gevallen |

"3/3 narekening" = drie onafhankelijke controles hebben, zonder de broncode te zien, vanuit de
CPM-theorie bevestigd dat de app fout zit en wat het hoort te zijn.

---

## Wat aantoonbaar goed werkt (geruststellend)

- **Kalender / werktijd: 18 van 18 goed.** Weekenden overslaan, losse feestdagen, meerdaagse
  feestdag-periodes (bv. een bouwvak), en afwijkende werkweken (bv. ook op zaterdag, of een 4-daagse
  week) — de datums kloppen allemaal.
- **Totale speling en kritiek pad: overal goed.** In 23 uiteenlopende netwerkvormen (parallelle
  ketens, diamanten, dubbele diamanten, ladders, samenkomsten met meerdere voorgangers) klopt telkens
  de totale speling, of een taak kritiek is, én welke taken samen het kritieke pad vormen.
- **Gewone "klaar → start" (Finish-Start) zonder lag**, **"samen starten" (Start-Start) zonder lag**,
  de **inclusieve einddag** (5 werkdagen vanaf maandag = t/m vrijdag), en de **datum-oprol van
  verzamel-/fase-taken** (een fase loopt van de vroegste kind-start tot de laatste kind-finish):
  allemaal correct.

De fouten hieronder zijn dus geen "alles is stuk" — het fundament staat. Het zit in specifieke
relatietypes en in randjes van de werkdag-telling.

---

## De bevindingen in detail

> In alle voorbeelden: werkdagen ma–vr, geen feestdagen, eerste taak start op **maandag 1 juni 2026**.
> Een taak van N werkdagen die op maandag start, eindigt N werkdagen later met de einddag meegeteld.

### 1. 🔴 "Finish-Finish"-relatie wordt als "Finish-Start" berekend

**Een relatie van het type Finish-Finish (FF) betekent: twee taken moeten *samen klaar* zijn.** De app
behandelt zo'n relatie echter alsof het "Finish-Start" is (de opvolger mag pas *starten* nadat de
voorganger klaar is). Dat is iets heel anders.

**Voorbeeld.** Taak A duurt 5 werkdagen (1 juni → 5 juni). Taak B duurt 2 werkdagen en heeft een
FF-relatie naar A → B hoort dus óók op 5 juni te eindigen (B loopt dan 4–5 juni).
- **Hoort te zijn:** B = 4 juni → 5 juni; A en B zijn beide kritiek; project klaar op 5 juni.
- **Wat de app doet:** B = 8 juni → 9 juni (B start ná A's einde); A wordt als *niet*-kritiek
  gemarkeerd; project klaar op **9 juni**.

**Waarom dit erg is.** Het project lijkt langer dan het is (hier 4 kalenderdagen), en het kritieke
pad klopt niet meer — precies de twee dingen waarvoor je een planning gebruikt. Dit speelt overal
waar een FF-relatie wordt gebruikt (typisch: "binnenafwerking en schilderwerk moeten gelijk
opleveren").

**Oorzaak (technisch).** In de voorwaartse berekening valt `FINISH_FINISH` in dezelfde tak als
`FINISH_START` (`getForwardConstraint` in `CPMSolver.ts`); alleen de *terugwaartse* berekening kent FF
wél apart. De voor- en achterkant zijn dus inconsistent.

### 2. 🟠 Uitlooptijd (lag) telt één werkdag te weinig — een lag van 1 doet niets

Een **lag** is wachttijd tussen twee taken ("na het storten 3 dagen uitharden vóór ontkisten"). De app
telt die wachttijd consequent **één werkdag te kort**: een lag van 1 werkdag heeft géén effect, een lag
van 2 geeft 1 dag, enzovoort (een lag van N geeft N−1 werkdagen).

**Voorbeeld.** A (1–5 juni) → B met "Finish-Start".
- lag 0: B start 8 juni ✅
- lag +1: hoort 9 juni → **app: 8 juni** (identiek aan geen lag!)
- lag +2: hoort 10 juni → **app: 9 juni**

De duidelijkste illustratie is dat lag 0 en lag 1 exact hetzelfde resultaat geven — onder elke
gangbare conventie is dat fout (een wachttijd toevoegen móét de opvolger opschuiven).

**Waarom dit erg is.** Wachttijden (uithardtijd, levertijd, keuringstermijn) komen veel voor; ze
worden nu allemaal een dag te kort ingepland, wat het project te optimistisch maakt.

**Oorzaak (technisch).** `addWorkDays(basis, lag)` telt de basisdag als dag 1, dus N werkdagen
"verderop" levert N−1 dagen verschuiving.

### 3. 🟠 Negatieve lag (aanlooptijd / "lead") wordt genegeerd

Een **negatieve lag** (een "lead") betekent overlap: de opvolger mag al beginnen vóórdat de voorganger
helemaal klaar is ("beginnen met inrichten terwijl de laatste ruimte nog wordt afgewerkt"). De app
**negeert negatieve lag volledig** — het resultaat is identiek aan lag 0.

**Voorbeeld.** A (1–5 juni) → B met "Finish-Start" en lag −2.
- **Hoort te zijn:** B start 2 werkdagen eerder dan normaal → 4 juni.
- **Wat de app doet:** B start 8 juni (alsof er geen lead is).

**Waarom dit erg is.** Overlappende taken zijn een standaardtechniek om planningen te versnellen; die
versnelling wordt nu gewoon weggegooid.

**Oorzaak (technisch).** De lag wordt alleen toegepast `als lag > 0`; negatieve waarden vallen door de
mand.

### 4. 🟠 Een mijlpaal in een keten schuift de opvolger een werkdag op

Een **mijlpaal** (duur 0, bv. "vergunning binnen") hoort de planning niet te veranderen. Maar als je een
mijlpaal *tussen* twee taken zet, schuift de opvolger een werkdag op.

**Voorbeeld.** A (5 werkdagen) direct gevolgd door B → B start 8 juni. Zet je er een mijlpaal tussen
(A → M → B), dan start B op **9 juni**. Alleen het invoegen van een nul-duur-mijlpaal kost dus een dag.

**Waarom dit erg is.** Mijlpalen worden juist gebruikt om de planning leesbaar te maken ("hier is fase 1
af"); ze horen de doorlooptijd niet te beïnvloeden. Nu rekt elke tussengevoegde mijlpaal het project op.

**Oorzaak (technisch).** Dezelfde "+1 werkdag na de finish"-regel wordt óók toegepast op een nul-duur-
mijlpaal, waardoor de overgang dubbel wordt geteld.

### 5. 🟠 Vrije speling ("free float") is overal 1 werkdag te hoog

De **vrije speling** van een taak = hoeveel die kan uitlopen zonder dat z'n opvolger later start. De app
meldt die waarde **overal precies 1 werkdag te hoog**. In alle 23 speling-testgevallen was de gemelde
vrije speling steeds de juiste waarde + 1 (een eindtaak zonder opvolger krijgt bijvoorbeeld vrije speling
1 in plaats van 0).

**Waarom dit (relatief) minder erg is.** De *totale* speling en het *kritieke pad* zijn wél correct — en
dat zijn de getallen waarop je stuurt. De vrije speling is een aanvullende indicator; die staat nu
structureel een dag te ruim, wat misleidend kan zijn maar de hoofdplanning niet verschuift.

**Oorzaak (technisch).** Bij de totale speling wordt een corrigerende "−1" toegepast; bij de vrije
speling ontbreekt diezelfde "−1".

### 6. 🟡 Projectduur van een nul-duur-project wordt 1 i.p.v. 0

Een project dat (nog) alleen uit één mijlpaal bestaat, krijgt projectduur **1 werkdag** gerapporteerd
terwijl dat 0 hoort te zijn. Klein randgeval; geen effect op echte planningen met taken erin, maar
dezelfde "inclusieve dag"-telling die ook bevinding 4 veroorzaakt.

### 7. 🟡 "Start-Finish"-relatie is slechts bij benadering

Het vierde, zeldzame relatietype "Start-Finish" (SF) wordt in de code expliciet als *benadering*
behandeld en geeft afwijkende datums. Omdat dit type in de bouw vrijwel nooit voorkomt, is de prioriteit
laag — maar het is goed te weten dat het niet exact klopt.

---

## Twee onderliggende thema's

De meeste bevindingen komen neer op twee patronen:

1. **Relatietypes worden niet volledig consistent verwerkt.** "Finish-Start" zonder lag is goed, maar
   "Finish-Finish" (1), negatieve lag (3) en "Start-Finish" (7) worden in de voorwaartse berekening niet
   correct toegepast. Positieve lag (2) wordt wel toegepast maar één te kort geteld.
2. **Een "±1 werkdag"-telfout aan de randen.** Bij wachttijden (2), nul-duur-mijlpalen (4, 6) en de
   vrije speling (5) sluipt telkens precies één werkdag in of uit.

Geen van deze raakt de kalender of het kritieke-pad-algoritme zelf — die zijn gezond.

---

## Over resources (ter info, buiten de test gehouden)

Je kunt in de app resources (arbeid/materiaal/materieel) aanmaken en aan taken koppelen, en dat wordt
opgeslagen. **Maar de planning houdt er géén rekening mee:** de rekenmotor krijgt alleen taken, relaties
en de kalender — niet de resources. Er is dus geen resource-nivellering (of je nu 1 of 100 man op een
taak zet, de datums veranderen niet). Daarom viel er voor *planningscorrectheid* niets aan resources te
testen. Goed om te weten dat dit nog "wel invoer, geen invloed" is.

---

## Hoe dit getest is (verantwoording)

- **Tegen de échte rekenmotor.** Elk testgeval bouwt een netwerk via dezelfde interne acties die de
  app gebruikt, draait de berekening ("Bereken"/`runCPM`) en leest de échte uitkomsten terug — niet een
  losgekoppeld moduletje. Headless gedraaid (zonder venster), wat de resultaten exact reproduceerbaar maakt.
- **Onafhankelijk narekenen.** De verwachte uitkomsten zijn afgeleid uit de standaard CPM-theorie, níét
  uit de broncode van de rekenmotor (anders bevestigt een test alleen dat de code doet wat de code doet).
  Vijf testbatterijen (~90 gevallen) zijn door aparte agents ontworpen; daarbovenop een schone set
  minimale "probe"-gevallen.
- **Adversarieel geverifieerd.** Elke afwijking is door drie onafhankelijke controles (zonder code-inzage)
  herbeoordeeld vóór ze "bug" werd genoemd. Dat ving ook een paar *testfouten* af (gevallen waar de app
  juist gelijk had en de testverwachting ernaast zat) — die staan dus niet in dit rapport.
- **Bevestigde correcte onderdelen:** kalender (18/18), totale speling & kritiek pad (23/23 voor die
  aspecten), basale relaties en de fase-oprol.

Testgevallen, het testharnas en de ruwe uitvoer staan klaar; desgewenst commit ik die als een
herbruikbare, reproduceerbare testset in de repo.

---

## Voorgestelde vervolgstappen

1. **Jij leest dit rapport** en bepaalt de prioriteit.
2. **Fixes** (apart van deze testronde) — mijn voorstel qua volgorde: eerst #1 (FF-relatie, grootste
   impact op datums en kritiek pad), dan #2/#3 (lag-telling en leads), dan #4/#5/#6 (nul-duur/speling).
   Bevinding #7 (SF) optioneel.
3. **Vastleggen met tests.** Ik kan het testharnas + de batterijen in de repo zetten zodat elke fix
   meteen aantoonbaar de juiste getallen oplevert (en niets anders breekt).
