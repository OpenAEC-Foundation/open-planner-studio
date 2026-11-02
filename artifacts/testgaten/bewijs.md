# Bewijs voor de aangescherpte tests

Basis: `6386f95e6ca28b47c1ded7c085b74a1e15c2d87b` (`origin/main` bij de start).
Lokaal: Node 22.23.4. Iedere gerichte uitvoering loopt onder `flock /tmp/ops-zwaar.lock`.
De volledige suites en builds worden uitsluitend door CI uitgevoerd.

## 473 — gewone taaklabels op hun eigen rij

Op de basis is tijdelijk alleen de aanroep van `drawOutsideBarName` voor een gewone taak
uit `GanttRenderer.drawTaskBar` verwijderd. De aanroep voor samenvattingen bleef staan.
De oude test bleef groen: 23 controles, exit 0. Met dezelfde ontbrekende aanroep geeft
de aangescherpte test één afwijking, exit 1: de lange naam ontbreekt op de eigen rij.
De renderer is teruggezet met `cp` uit de vooraf gemaakte kopie in `/tmp`.

Commando: `bash tests/planning/run.sh check-gantt-label-ellipsis.ts`.

Na herstel van de renderer: 23 controles groen, exit 0. Geen productwijziging in de diff.

## 394 — interne splitsranden in de scrollmatrix

De meetpunten komen nu ook van elk afzonderlijk balkstuk en de tussenliggende pauze,
afgeleid uit taak en kalender, buiten de rendercache om. De bestaande matrix wisselt
rijhoogte, scrollpositie en de kalender-/werkdagenas. Twee voorwaarden bewaken dat zij
ook werkelijk gesplitste stukken en pauzes bemonstert.

Als tegenproef is tijdelijk in `rendererFor` alleen op het viewportpad de hit op het
exacte einde van het eerste balkstuk op `null` gezet. De referentie met volledige
rijscan bleef intact. De oude matrix bleef groen, exit 0; de aangescherpte matrix werd
rood, exit 1. Het testbestand is met `cp` teruggezet uit `/tmp`. De gewone nieuwe matrix
was daarvoor groen, exit 0.

Commando: `bash tests/planning/run.sh check-render-caches.ts`.

## 432 — onbekende taal onder een Nederlandse systeemtaal

Tijdelijk is in `src/utils/monthLabel.ts` alleen de `supportedLocalesOf`-voorwaarde
vervangen door `base`. Op de basistest met `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`
bleef de rapportbatterij groen, exit 0. De nieuwe uitvoerregel zet beide variabelen
op `nl_NL.UTF-8`; de test controleert zelf dat `Intl` werkelijk `nl` kiest.
Met dezelfde ontbrekende guard werd deze route rood op de Engelse terugval, exit 1.
Na herstel van de productbron met `cp`: 380 controles groen, exit 0.

De taal is gezet voor zowel de losse aanroep als het volledige uitvoerplan.
De bestaande pool bewaart de omgevingsvariabelen van een regel ook voor zijn
tijdzoneruns. De verwachte checklijst verandert niet.

Commando: `bash tests/planning/run.sh check-reports.ts`.

## 427 — gedeeltelijke MPP-meting herkenbaar

De nieuwe tests op de ongewijzigde scripts faalden op drie routes, exit 1:
alleen één wortel gemeten, een foutregel naast een groene slotregel en de echte
corpusloze scriptrun zonder dekkingsaantallen in zijn slotmelding.
Na de fix: 22 tests groen, exit 0. Beide effectieve wortels moeten bestanden hebben
om `measure:profiles` groen te laten zijn; één wortel geeft expliciet
`ROOD (gedeeltelijk gemeten: … overgeslagen)`. Een corpusloze check blijft exit 0
geven voor gewone CI, maar noemt nul bestanden en beide overgeslagen lussen.

De bestaande integratietest gebruikt twee vaste niet-bestaande paden: geen lokale
corpusmeting of volledige profielmeting uitgevoerd. De baselines zijn niet veranderd.

Commando: `node --test tests/dev-server/measure-profiles.test.mjs`.

## 553 — PR-sjabloon vraagt om de juiste poort

Een tijdelijke broncontrole in `/tmp` controleert dat de oude volledige-verify-vinkregel
ontbreekt, dat PR-CI wordt gevraagd en dat slepen, focus, dialogen en opslag een
browserafweging krijgen. Op het oude sjabloon exit 1; na de tekstcorrectie exit 0.
Er is geen permanente test voor deze beperkte documentcorrectie toegevoegd.

## 460 — publicaties naar stats in één wachtrij

Een nieuwe controle leest de echte workflowconfiguratie en eist één vaste,
workflowbrede groep, zonder annulering van een lopende publicatie. Zonder de groep
faalde één van de vier tests, exit 1. Met de groep slagen alle vier, exit 0.
De overige tests voeren de echte publicatiescript-routes uit tegen een tijdelijke
lokale bare Git-repo. Er is geen publicatie naar de echte stats-branch gestart.

Commando: `node --test tests/dev-server/publish-stats-branch.test.mjs`.

## 552 — lege labelruns krijgen een eigen checknaam

De controle leest de naam van de echte afsluitende CI-job en rekent de gebruikte
expressie door voor opened/synchronize/reopened, push, schedule, workflow_dispatch,
browsertests en drie andere labels. De expressie gebruikt alleen veldlezingen,
strings en logische/vergelijkingsoperatoren met dezelfde betekenis in JavaScript.
Zonder de nieuwe naam faalde één van acht tests, exit 1. Met de nieuwe naam blijven
alle echte runs `test` heten; alleen lege labelruns krijgen een andere naam.
Alle acht tests slagen, exit 0. De bestaande jobvoorwaarde, afhankelijkheden en
controle op geslaagde delen veranderen niet.

Commando: `node --test tests/dev-server/ci-changes.test.mjs`.

## Herhaling met teruggezette basisbestanden

Voor 427, 460, 552 en 553 zijn de verbeterde bestanden daarna apart naar `/tmp`
gekopieerd. De betrokken script-/configuratiebestanden uit basiscommit `6386f95e6`
zijn teruggezet en dezelfde nieuwe controles zijn opnieuw uitgevoerd: telkens exit 1.
Daarna zijn alle verbeterde bestanden teruggezet met `cp`. De gezamenlijke gerichte
planningsrun en de gezamenlijke Node-tests zijn vervolgens groen, beide exit 0.

## 598 — zichtbare kleur na alle baseline-vullingen

De nieuwe kolomcontrole bepaalt met een onafhankelijke punt-in-veelhoekregel de
laatste ondoorzichtige vulling op 60 hoogtes. Zij gebruikt geen uitkomst van
`baselineLanes` als verwachting. Drie gelijke baselines houden elk een derde;
bij gedeeltelijke overlap is de verdeling voor/midden/na respectievelijk 1:0,
1:1 en 0:1. Halverwege een overgang is het gewicht 1 naast 0,5, dus de zichtbare
verdeling is 2:1 of 1:2. Ook de echte scherm- en afdrukroute worden bemonsterd.

Tegenproef: in `paintBaselineStrip` is de bovenrand tijdelijk van
`o.top + lane.top[i]` naar `o.top` gezet. De zuivere geometrie bleef goed, maar
alle baseline-vullingen kregen de volle hoogte. De oude test bleef groen met
8.073 controles, exit 0. De nieuwe test zag zes afwijkingen in 8.083 controles,
exit 1, waaronder de scherm- en afdrukcompositie. Na herstel van de productbron
met `cp`: 8.083 controles groen, exit 0.

Dit toetst de compositie van de opgenomen baselinepaden, geen browserpixels of
anti-aliasing. De thema-/kleurwaarden uit #721/#780 zijn niet aangepast.

Commando: `bash tests/planning/run.sh check-baseline-vergelijking.ts`.

De typecheck vóór deze laatste testtoevoeging slaagde, exit 0. De definitieve
controle van de samengevoegde head volgt in CI.

## Controle op de samengevoegde head f122053d9

Na de merge van main (`dd9d7b46c`) zijn de vier gerichte planningschecks opnieuw
uitgevoerd: 23, 106, 380 en 8.083 controles groen; de gezamenlijke exitcode was 0.
De drie gerichte Node-bestanden gaven samen 34 tests groen, exit 0. Ook
`npm run typecheck` en de vergelijking van `--list-checks` met de verwachte lijst
slaagden, exit 0. `i18n:resolve` meldde dat de merge per sleutel al klopte en
wijzigde niets.

De normale PR-CI op deze head slaagde (run 41450060763). Bij het toevoegen van het
gewone label `bug` draaide ook de echte lege labelroute (run 41450394927). GitHub
geeft die overgeslagen afsluitende job de expressietekst als naam, in plaats van
`test`; de normale test-check bleef gescheiden. De naam `label zonder controles`
is dus de uitkomst bij evaluatie van de expressie, niet de letterlijke weergave
van deze overgeslagen job. Er is geen browserrun uitgevoerd.

De afzonderlijke renderer-meetworkflow faalde vóór de meting; zie bijvangst 780.

## 780 — renderer-meetroute accepteert een wijziging aan alleen de test

Bevestigd door CI-run 41450060913 op f122053d9: de trigger start op de gewijzigde
rendercachetest, maar de productbronlijst is leeg en de harde vergelijking met
`GanttRenderer.ts` stopt de workflow vóór esbuild. Het punt is daarna als 780
in het register vastgelegd.

De nieuwe gerichte test voert de echte bundelstap uit tegen kleine tijdelijke
Git-repo's. Alleen esbuild is vervangen door een teller. Op de oude workflow
werden drie van de vijf tests rood, exit 1; de route met alleen een test strandde
op de oorspronkelijke bronvoorwaarde. Er is geen lokale meetbuild gestart.

De correctie laat een lege productbronlijst de snelheidsvergelijking expliciet
overslaan. Met uitsluitend een rendererwijziging blijven beide bundels en de
meting vereist; een andere of gecombineerde productwijziging blijft geweigerd.
De meetstap en artifact-upload zijn gebonden aan het daadwerkelijk maken van
beide bundels. De vijf tests bewaken deze routes, inclusief de twee voorwaarden
in de echte YAML. De gewone PR-CI blijft de aangescherpte rendercachetest uitvoeren.

Commando: `node --test tests/dev-server/renderer-performance.test.mjs`.
