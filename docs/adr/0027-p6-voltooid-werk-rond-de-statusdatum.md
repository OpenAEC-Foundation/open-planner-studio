# Voltooid werk rond de statusdatum volgt P6 alleen waar het gemeten is

Een reeks P6-conventies bepaalt hoe een voltooide taak zich rond de statusdatum gedraagt: B3
(`p6CompletedDataDateWindow`, het statusdatumvenster), de projectoptie A21 (`p6CompletedLateFromRemainingWindow`,
de late kant van dat venster), C1, C3, C4 en C5. De regel per conventie, in de woorden van de planner, staat in de
gids `ref-rekenopties-en-conventies.md`. Ze werken alleen in uurplanning, met een statusdatum en op een kalender met
eigen werkblokken: P6-kalenders zijn altijd uurprecies, en in dagmodus verandert er niets. Waar P6 niet gemeten is,
doet de conventie niets: een ongemeten geval valt terug op het gewone pad in plaats van een gok.

## Gevolgen

- C1 (`p6CompletedPredecessorAtDataDate`): een werkelijk einde na de statusdatum telt voor de relatie als de
  werkgrens vlak vóór de statusdatum op de voortgangskalender, dezelfde grens als het B3-venster. Alleen het einde
  wordt begrensd: FS en FF lezen de finish, SS en SF houden de start.
- C4 (`p6CompletedOutOfSequenceWindow`, niet bij Progress Override): het nul-restvenster van een voltooide taak buiten
  volgorde begint op het laatste van de statusdatumgrens en de FS/SS-grens uit elke voorganger die nog niet klaar is.
  Een voorganger op de B3-route telt alleen met een verschoven venster; een gewone voltooide voorganger is historie.
  FF en SF ankeren op de finish en zijn niet gemeten, dus zonder effect. Voor de relatie naar opvolgers is zo'n
  venster één moment: de grens die de eigen maatgevende voorganger oplegde, op de kalender van die voorganger.
  Gemeten in rehab-2: V3163130 (kalender 842, venster 10-11) naar V3163135 (kalender 893) start in P6 op
  09-29 08:00, direct na de voorgangerfinish 09-28; V3119130 naar V3119135 op 09-13 08:00. Uit zo'n venster telt
  van een positieve lag alleen het nog niet verstreken deel (rekenregel C3, alleen als C3 aan staat): V3117150 naar
  V3117160 (FS+8 h) en V3229080 naar V3229090 (FS+16 h) starten in P6 op het vensterbegin.
- C3 (`p6CompletedRemainingLag`): achter een voltooide voorganger telt van een positieve lag in werktijd alleen
  `max(0, lag − werktijd(werkelijk einde → statusdatum))` in de lagkalender.
- C5 (`p6CompletedPhysicalAtDataDate`): een voltooide CP_Phys-activiteit is één punt (ES = EF) op het rauwe
  statusdatummoment, niet gesnapt, ook buiten werktijd. Het punt schuift naar de laatste rauwe relatiegrens uit een
  voorganger die nog niet klaar is (FS/FF zijn finish, SS/SF zijn start, plus de volle lag met een finishgrens) of uit
  een voorganger met zo'n punt (plus alleen de nog niet verstreken lag); een gewone voltooide voorganger telt niet.
  Uit zo'n punt telt naar opvolgers alleen de nog niet verstreken lag (Roads A15087 naar A15089, SS+30 h). Ook de
  late kant is één punt: de vroegste rauwe grens van de opvolgers, zonder statusdatumklem; zonder opvolger het
  projecteinde. Gemeten op alle 187 voltooide CP_Phys-activiteiten met een laat orakel in Roads, HarbourPointe en OZB
  (zonder opvolger: HarbourPointe EC1040 en EC1050). Een C5-opvolger legt gewone achterwaartse druk op een open
  voorganger (Roads B2911 naar OCEC11361, A33 naar A65, OCEC10851 SS naar OCEC10791). De C1-klem geldt niet voor
  een C5-voorganger.
- A21 op de B3-route: een voltooide taak staat ook aan de late kant op nul restduur op de statusdatum: LS is de
  vroegste late grens van haar opvolgers, geklemd op de statusdatum, en LF het werkmoment vlak daarvoor. Gemeten op
  rehab-2: 2036 voltooide taken, 99,9 % dekking. De late route gebruikt dezelfde poort als de vroege, zodat een taak
  nooit tussen twee poorten valt; een voltooide taak buiten die poort (CP_Phys, de LOE-uitzondering of een taak
  zonder werkelijke finish) houdt aan de late kant haar werkelijke datums.
- Tussen twee voltooide activiteiten telt de lag niet (R1 zonder lag: 2033 van 2036), wel zolang de opvolger nog
  restwerk heeft (R2 met lag: 1796 van 2036; de drie uitzonderingen op R1 hebben elk een niet-voltooide maatgevende
  opvolger). Een procentlag wordt eerst tegen de echte duur vastgezet, omdat de rekenstap daarna voor SS en SF de
  duur op 0 zet en de lag anders stil verdwijnt. Die nul-duur zorgt dat SS en SF de late start zelf teruggeven;
  alleen FS en FF gaan nog door de omzetting naar een start.
- Een voltooide opvolger die niet door die poort kwam, draagt nog haar werkelijke datums: dat is historie, en ze
  trekt een open voorganger niet terug. Een opvolger op de poort heeft een zinvolle late kant en drukt gewoon.
- XER-uitvoer (vroege, late datums en speling uit het bestand) is op geen enkel pad solverinvoer.
