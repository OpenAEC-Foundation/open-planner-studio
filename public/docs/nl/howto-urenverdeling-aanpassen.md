# Urenverdeling aanpassen

Doel: voor één toewijzing zelf bepalen hoeveel de resource op elke werkdag van de taak werkt, in plaats van een standaardcurve te gebruiken.

## Wanneer je dit nodig hebt

Een curve als *Klokvorm* is een vaste vorm. Soms weet je het beter. De metselaar begint op het buitenspouwblad pas half, omdat de stelling nog wordt opgebouwd, en werkt daarna vol door. Of je wilt een piek juist onder de capaciteit houden. Dan pas je de **urenverdeling** aan.

Je werkt daarbij met **fasen**: aaneengesloten werkdagen waarop de resource met dezelfde inzet werkt. De verdeling verandert alleen de uren per dag van deze ene toewijzing. De datums van de taak veranderen niet.

## Stappen

Het voorbeeld is het buitenspouwblad: 6 werkdagen, één metselaar, 48 uur.

1. Selecteer de taak. Het paneel *Eigenschappen* staat rechts; zie je het niet, zet het dan aan met *Beeld › Panelen › Eigensch.*
2. Klik in het blok *Toewijzingen* bij de metselaar op het staafdiagram-icoon *Urenverdeling…*. Het venster *Urenverdeling in fasen* opent. Je begint bij wat de app nu boekt: bij dit buitenspouwblad één fase van 6 dagen met inzet 1.
3. Kies zo nodig een vertrekpunt bij *Vorm toepassen:*. Bij *Klokvorm* maakt de app vijf fasen: 0,18 eenheden op de eerste en de laatste dag, 0,84 op de tweede en de vijfde dag en 1,98 op de twee middelste dagen. Het totaal blijft 48 uur.

### De fasen aanpassen

Je kunt in de tabel werken of in de strook erboven.

- Typ een andere *Inzet (eenh./dag)* in een fase. De kolommen *Uren/dag* en *Uren* rekenen mee.
- Wijzig het aantal *Dagen* van een fase. De laatste fase loopt altijd tot het einde van de taak en krijgt de dagen die overblijven.
- Kies *Splitsen* om een fase in tweeën te delen, bij 6 dagen in 3 en 3. Kies *Samenvoegen* om een fase samen te voegen met de volgende.
- In de strook sleep je een grens om een fase langer of korter te maken, sleep je de bovenrand voor de inzet en dubbelklik je op een dag om een fase te splitsen.

### Toepassen

Kies *Toepassen*. Met *Annuleren* sluit het venster zonder wijziging.

Een voorbeeld. Je kiest *Splitsen*, zet de *Dagen* van de eerste fase op 2 en de inzet van die fase op 0,5. De tweede fase loopt dan 4 dagen met inzet 1. Het totaal is 2 × 0,5 × 8 + 4 × 1 × 8 = 40 uur.

Na *Toepassen* staat bij de toewijzing de curve op *Contour*, uitgeschakeld. *Eenh./dag* blijft staan zoals het was. Het histogram en de overbezetting volgen de nieuwe verdeling meteen. Herberekenen is niet nodig, want er verschuift geen enkele datum.

### De verdeling loslaten

Heeft de toewijzing een eigen verdeling, dan staat in het venster ook *Verdeling loslaten*. Daarmee vervalt je eigen verdeling en rekent de app weer met *Eenh./dag* en de curve. Kies dit ook als je de curve wilt wijzigen, want de keuzelijst *Curve* is uitgeschakeld zolang er een eigen verdeling is.

## Valkuilen en wat de app dan doet

**Het totaal verandert mee.** Je verdeelt de uren niet, je bepaalt ze. Zet je een fase op 0,5 in plaats van 0,18, dan wordt het totaal groter. Onderaan het venster staat het totaal in uren, dus controleer dat vóór je op *Toepassen* klikt.

**Eenh./dag stuurt de verdeling niet meer.** Zet je later de inzet op 2, dan blijft de eigen verdeling gelden. De inzet heeft er pas weer invloed op als je de verdeling loslaat.

**Verander je de duur van de taak, dan rekt de verdeling mee.** Bij de standaardregel *Vaste duur en inzet* blijft de vorm dan gelijk en groeit het totaal evenredig met de duur. Verdubbelt de duur van een taak met een eigen verdeling van 4 naar 8 werkdagen, dan verdubbelt ook het totaal, van 32 naar 64 uur.

**Het werk volgt de verdeling.** *Werk (rest)* wordt de som van je fasen, ook onder *Vast werk*. De duur van de taak verandert daar niet door.

**Ongeldige inzet.** Een lege of negatieve inzet krijgt een rode rand en dan is *Toepassen* uitgeschakeld. Een fase met inzet 0 mag wel. Zo'n fase blijft binnen de duur van de taak.

**Alles geldt voor deze ene toewijzing.** De app noemt het zelf: *De verdeling verandert alleen de uren per dag van deze toewijzing; de taakdatums en onderbrekingen blijven zoals ze zijn.* Andere resources op dezelfde taak houden hun eigen verdeling.

**Uurtaken korter dan een werkdag.** Een taak die je in uren plant en die korter duurt dan één werkdag, zoals de kraaninzet van 5 uur, telt niet mee als belasting. Het venster toont daarvoor één fase met inzet 0 en 0 uur. Zie ook [Overbezetting oplossen](docs://howto-overbezetting-oplossen).

**Nivelleren volgt de verdeling.** De nivelleerder telt dezelfde uren per dag als het histogram.

**Terugdraaien.** *Toepassen* en *Verdeling loslaten* zijn elk één stap voor *Ongedaan* (Ctrl+Z).

## Zie ook

- [Resources toewijzen met een curve](docs://howto-resource-toewijzen): een resource op een taak zetten en een curve kiezen.
- [Overbezetting oplossen](docs://howto-overbezetting-oplossen): wat je doet als een resource op een dag te veel moet doen.
