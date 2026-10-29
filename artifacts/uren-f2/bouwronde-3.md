# F2 — bouwronde 3, 23 oktober 2026

F2 is niet klaar voor review: de kernpunten hieronder zijn uitgevoerd, maar de overige rode
CI-verschillen zijn nog niet hersteld. Er wordt geen basisvrijstelling of nieuwe redencode toegevoegd.

## Start en werkplek

De verplichte eerste controle toonde `cbd63b03a8080c1c525edc77ebad126ab8d7a686`.
Branch `claude/uren-f2-kern` was schoon, gelijk aan origin en stond in de opgegeven worktree.
Het verslag van ronde 2 en de opgegeven delen van de specificatie zijn gelezen.
Gerichte controles liepen met de gemeten Node 22.23.4, na elkaar in de voorgrond.
De volledige planningssuite en `npm run verify` zijn niet lokaal gedraaid.

## De dagtaak en het F0-vangnet

Het doel van `lagadv-pct-fs50-odd-roundup` blijft donderdag 11:00. F2 eindigt woensdag 16:00:
een dagtaak telt nog in hele dagen (§7.2), de loper van §3.14 komt in F3. De bestaande code
`PCT-LAG-EXACT` en de oorspronkelijke gewone verwachting blijven behouden. De minutenverwachting
legt nu ook de kloktijden expliciet vast: woensdag 11:00 → donderdag 11:00; die stonden eerder
alleen in de toelichtende zin.

Het F0-vangnet laat het bestaande, gepinde bewuste rode doel zichtbaar staan en eindigt met exit 0.
Ongecodeerd rood blijft run 1 blokkeren; een nieuw of verdwenen gepind rood doel blokkeert beide runs.
De uitzondering is bovendien op precies het ene verwachte B7-eindverschil begrensd: een tweede fout
binnen dezelfde gepinde case moet ook rood blijven. Een tijdelijke mutatie van B's startdoel naar
10:00 bewijst dat met exit 1; herstel met `cp`, oorspronkelijke case daarna exit 0.
De 24 gerichte minutenmodelbatterijen geven in run 1 405 gelijk, 16 bewust gewijzigd, 0 ongecodeerd rood
en 1 bewust rood. Run 2 houdt dezelfde 400 gelijk, 16 bewust, 4 ongecodeerd rood, 1 bewust rood en
1 niet omzetbaar als ronde 2. Beide vangnetten hebben exit 0.

## Gemengde terugrekening

`s7a-day-to-hour` is gerepareerd: woensdag 08:00 laat geen hele woensdag toe. D eindigt laat op
dinsdag 16:00, begint laat maandag 07:00 en heeft nul speling. De verandering geldt voor de
bindende opvolgergrens; de bestaande F2-dagspeling bij een gemeenschappelijk projecteinde blijft behouden.

`s7b-hour-to-day` houdt het oude dagdoel zichtbaar rood, zonder vrijstellingscode. F2 plant D2 maandag
13:00–16:00. De terugrekening gooide 13:00 weg en zette de late start op 07:00; dat dwong de
uurvoorganger naar vrijdag en veroorzaakte −0,5 d speling. Het late startmoment blijft nu 13:00;
H2 krijgt LS maandag 09:00, LF 13:00 en +0,125 d. Dat uur bestaat doordat H8 doorwerkt tijdens de
pauze van de dagkalender. De negatieve speling uit F2 is dus gerepareerd.

De bestaande urenloper toont op dezelfde werkdagen het F3-referentie-einde: dinsdag 12:00.
Maandag 13:00–16:00 levert 3 u, dinsdag 07:00–12:00 de overige 5 u. F2 telt alleen de kalenderdag
van de start als de hele eerste dag; F3 telt het werkelijke deel (§3.14). Het oude dagpad-doel,
dinsdag 07:00–16:00, is daarbij geen precieze F3-startverwachting. Deze fasegrens is vastgelegd
in de gerichte grenscontrole en de PR-tekst; de oorspronkelijke gemengde case blijft rood.

## Voorbeeldensnapshot

Alle 378 oorspronkelijke afwijkingen zijn aan B7 gekoppeld. De tegenproef verandert alleen de
procentlag terug naar de oude afronding op hele dagen: 0 afwijkingen. Na de terugrekenfix blijven
322 afwijkingen over; dezelfde tegenproef geeft ook daar 0 afwijkingen. Herstel steeds met `cp`.

De fix herstelt 56 waarden zonder verversen. Alleen de overige 322 zijn uit de bestaande
snapshotgenerator overgenomen: 4 rechtstreeks procentlag, 108 voorwaartse doorwerking,
166 terugrekening/speling en 44 samenvattingen. De overige waarden houden hun oude dagniveautoets.
Snapshot 6.090/6.090 op 24 voorbeelden, exit 0; `verify:examples` exit 0.

De eigen snapshotcommit is `94507893e`. De volledige lijst en telling per oorzaak staan in
[procentlag.md](procentlag.md) en [procentlag-waarden.json](procentlag-waarden.json).
Daar staan ook de zeven dagtaken die midden op een dag beginnen en waarvan F3 het einde en de
doorwerking opnieuw moet bepalen.

## Andere herstelde F2-fouten

- De harde MFO-eindgrens blijft na D2-normalisatie ook bij een urentaak op het echte eindmoment.
  De gerichte blokgrensbatterij geeft 48/48, de aanvullende CPM-batterij 72/72, exit 0.
- De MCP-veldpatch normaliseert vóór vergelijking en gevolgregels. Dezelfde SNET-datum invoeren
  wist daardoor geen nivelleergat en maakt het document niet gewijzigd. Een echt andere
  constraint wist het nivelleergat nog wel. De bestaande waardetriggerbatterij bewaakt beide.
- Oude MCP-verwachtingen zijn expliciet naar momenten bijgewerkt. Het bewaren van een baseline
  wordt na de echte laadnormalisatie vergeleken. Een naamwijziging blijft in de opgeslagen modus;
  de controle die de modus moet verlaten gebruikt een duurwijziging. De nooit-berekend-fixture
  draagt expliciet het moderne documenttype, zodat hij geen oude omzetting onbedoeld toetst.
- Het kernpakket verwacht nu het D2-projecteinde `2028-01-12T16:00`. De uitvoer is niet afgeknipt.

Kern- en MCP-correcties zijn gepusht in `5b15ce6a8`. De 15 door de suites aangewezen MCP-batterijen
zijn na herstel allemaal groen, exit 0. De statische kernpakketcheck zelf is aan CI gelaten.

## Regressiebewijs

- Grenzen: 16/16; vier nieuwe reparaties afzonderlijk gemuteerd, iedere mutatie exit 1.
- F1-review 120/120; statusregel 114/114; 34 rekenroutes zonder afwijking.
- B5/minutenovergang 87/87; vastlegging 377/377; bibliotheekvastlegging 26/26. Exit 0.
  De echte browserhooks zijn in deze ronde niet lokaal herhaald; de ronde-2-proef en de
  gerichte store/MCP-proeven worden niet als een nieuwe browseruitslag gepresenteerd.
- IFC 52/52; de oude lezer v2026.9.0 21.772/21.772 op 27 bestanden; kern/store 260/260. Exit 0.
- Typecheck, lint, conventies, cycli en i18n: exit 0.
- `measure:profiles` met corpus: exit 1, gelijk aan ronde 2. P6 nieuw 0, verslechterd 0,
  groter 0; 221 bestaande inexacte cellen. MSP dezelfde drie afwijkingen op
  `timephased-cost-rollup.mpp`, 661 bestanden/2.196 controles. Corpusloze vangrail exit 0.

## CI: de resterende blokkade

De beginrun op `cbd63b03a` is afgerond rood: statisch, suites, planning en vier browsershards.
De drie installerbuilds zijn groen. Bron:
[CI-run 39950546147](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/39950546147).

Om basisbekend rood te onderscheiden is de actuele integratiebasis
`51b1728c0d56eb8c2430774e882767e092aa66f4` apart uitgecheckt. Die is niet in de F2-branch gemerged.
62 gerichte batterijen en de vier casusbestanden hours, hours-blokgrenzen, lag-advanced en
msp-pariteit zijn daar groen, exit 0 (149/149 cases). De eerste poging had een onbruikbare
verwijzing naar ontbrekende dependencies; die poging is niet als testbewijs gebruikt.
Na controle van de echte dependencylocatie is de meting opnieuw uitgevoerd.

Dezelfde vergelijking op F2 heeft exit 1: 161/167 cases en daarnaast rode controlebatterijen.
`s7a` en alle 48 blokgrenscases zijn groen; de zes rode gewone cases zijn `s7b`, twee lag-cases
en drie MSP-pariteitscases. De oorspronkelijke gemengde batterijen staan op 66/67.
Voorbeelden van overige rode batterijen zijn de datumverwachtingen in
`check-start-snet.ts`, `check-table-shown-dates.ts`, `check-summary-actuals.ts`,
`check-mspdi-werktijd-minuten.ts` en het afleiden van vastgelegde formaten. Naast zulke
verwachtingen staan er gedragsverschillen tussen. Deze punten zijn niet afgedaan als
basisbekend of als F3: zij vereisen nog onderzoek en herstel.

Er is bovendien een aftekenvraag voor de orkestrator: de opdracht laat `s7b` rood tot F3,
maar de gewone CI draait deze case zonder fasevrijstelling. De opgegeven combinatie van
“bewust rood laten” en “CI groen buiten basisbekend rood” kan daarmee niet tegelijk worden afgetekend.
Dezelfde gewone run houdt ook oude doelen van de gecodeerde procentlag-/kalendertijdcases vast.
Er is geen nieuwe code toegevoegd om dat rood te verbergen.

## Vervolg en bewijsbestanden

De PR blijft concept en vermeldt de F3-doelen. De overige CI-verschillen zijn open werk;
F2 is daarom niet klaar voor review. De actuele nieuwe head en CI-momentopname staan in de PR
bij de overdracht. Als gedelegeerde uitvoerder is geen blijvende CI-bewaking gestart.

Lokale bewijsbestanden staan onder `/tmp/uren-f2-ronde3/`: `minuten-definitief.log`,
`grenzen-definitief.log`, `mcp-definitief.log`, `regressies.log`, `profielen.log`,
`mutaties.log`, de vier afzonderlijke mutatielogs, `snapshot-exact.log`, `voorbeelden.log`,
`basis-gerichte-ci.log`, `eigen-gerichte-ci.log` en de oorspronkelijke CI-joblogs.
Er zijn geen nieuwe knownbugs-nummers geschreven. De door F1, F3a en F3b aangewezen
productiebestanden zijn niet gewijzigd.
