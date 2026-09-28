# Relaties leggen

Doel: taken aan elkaar koppelen, zodat een taak pas begint als het werk ervoor klaar is, en waar nodig een wachttijd (lag) ertussen zetten.

## Wanneer je dit nodig hebt

Zonder relaties weet de app niet dat de metselaar pas kan beginnen als de fundering is gestort. Elke taak begint dan op de projectstart en de einddatum zegt niets. Een **relatie** legt die volgorde vast. De eerste taak heet de **voorganger**, de tweede de **opvolger**.

Je legt relaties als je een nieuwe planning opbouwt, als er een taak bijkomt, of als blijkt dat twee klussen toch op elkaar moeten wachten. Een **lag** gebruik je als er tijd tussen moet zitten waarin niemand aan die taken werkt, zoals beton dat moet uitharden of een dekvloer die moet drogen.

De app kent vier soorten relaties. Je kiest ze met hun afkorting:

- **FS** (Eind-Start): de opvolger begint als de voorganger klaar is. Dit is de standaard en veruit de meest gebruikte.
- **SS** (Start-Start): de opvolger begint als de voorganger begint.
- **FF** (Eind-Eind): de opvolger is klaar als de voorganger klaar is.
- **SF** (Start-Eind): de opvolger is klaar als de voorganger begint.

## Stappen

Er zijn vier manieren om een relatie te leggen. Ze maken dezelfde relatie; kies wat het handigst is voor je situatie.

### Twee geselecteerde taken koppelen

Handig als je in de takenlijst werkt en de twee taken ziet staan.

1. Klik in de takenlijst op de taak die eerst moet: de voorganger.
2. Houd Ctrl ingedrukt en klik op de taak die daarna komt: de opvolger.
3. Kies *Start › Taken › Relatie ▾ › Geselecteerde taken koppelen*. Dezelfde knop staat ook op *Planning › Relaties*.

De app legt een Eind-Start-relatie zonder lag en meldt bijvoorbeeld *Relatie aangemaakt: Funderingsmetselwerk → Kanaalplaatvloer leggen*. De volgorde waarin je klikt telt, niet de volgorde in de lijst: je eerste klik wordt de voorganger.

### Een relatie tekenen in de Gantt

Handig als je veel relaties achter elkaar legt en de balken in beeld hebt.

1. Kies *Start › Taken › Relatie ▾ › Relatie tekenen*. Boven de planning verschijnt de melding *Relatiemodus: sleep in de Gantt van de ene balk naar de andere om een relatie te leggen. Esc stopt.*
2. Druk op de balk van de voorganger en sleep naar de balk van de opvolger. Er loopt een stippellijn met een pijl mee.
3. Laat los. Er verschijnt een klein venster *Type relatie* met het type (standaard FS) en een vak voor de lag.
4. Pas zo nodig type of lag aan en druk op Enter, of klik ernaast. De relatie is gelegd.
5. Leg meteen de volgende: de modus blijft aan. Stoppen doe je met Esc, met de knop *Stoppen* in de melding, of door *Relatie tekenen* opnieuw te kiezen.

Druk je in het venster *Type relatie* op Esc, dan wordt er niets vastgelegd. Voor één losse relatie hoef je de modus niet aan te zetten: houd Shift ingedrukt terwijl je van balk naar balk sleept. Via de rechtermuisknop op een balk kun je ook *Relatie leggen vanaf hier* kiezen; dan staat de relatiemodus aan en is die taak geselecteerd.

### Een relatie toevoegen in het paneel Eigenschappen

Handig als je één taak bekijkt en zijn voorgangers of opvolgers wilt aanvullen.

1. Selecteer de taak. Het paneel *Eigenschappen* staat rechts; zie je het niet, zet het dan aan met *Beeld › Panelen › Eigensch.*
2. Klik in het blok *Afhankelijkheden* op *Relatie toevoegen*.
3. Kies bij de richting *Voorganger* of *Opvolger*: is de andere taak de voorganger of de opvolger van deze taak?
4. Typ een deel van de naam van de andere taak. Kies de juiste met de pijltjestoetsen en Enter, of klik erop.
5. Kies het type (standaard FS) en vul zo nodig een lag in.
6. Druk op Enter of klik op het vinkje (*Relatie vastleggen*).

Alle relaties van de taak staan daarna in *Afhankelijkheden*, elk met het WBS-nummer van de andere taak, het type en de lag. Een klik op het WBS-nummer brengt je naar die taak.

### Relaties typen in de voorgangerskolom

Handig als je snel werkt met het toetsenbord en de WBS-nummers kent.

1. Klik op de **+** rechts in de kop van de takenlijst (*Kolom toevoegen*) en kies onder *Relaties* de kolom met de voorgangers. De app toont die kolom op dit moment nog met de Engelse naam *Predecessors*; de kolom ernaast (*Successors*) werkt hetzelfde voor opvolgers.
2. Klik in die kolom op de cel van de opvolger.
3. Typ het WBS-nummer van de voorganger, een spatie en het type, bijvoorbeeld `2.6 FS`. Een lag zet je er direct achter: `2.6 FS+1d`. Meer voorgangers scheid je met een puntkomma: `3.1 FS; 3.2 SS+2d`.
4. Druk op Enter.

Druk je in de cel op Enter of F2 in plaats van te typen, dan opent een invoerveld waarin je de taak zoekt op WBS-nummer of naam, en per relatie het type en de lag kiest.

### Lag zetten of wijzigen

Een lag zet je in het vak naast het type: in het venster *Type relatie* na het tekenen, in de conceptregel in *Afhankelijkheden*, of achter het type in de voorgangerskolom. Bij een bestaande relatie wijzig je de lag in *Afhankelijkheden*: klik in het lagvak, typ de nieuwe waarde en druk op Enter.

De app kent deze schrijfwijzen:

- `3` of `3d`: 3 werkdagen. Een weekend telt niet mee. De app toont `+3d`.
- `3ed`: 3 kalenderdagen. Het weekend telt wel mee, zoals bij beton dat ook op zaterdag en zondag uithardt.
- `-1`: een negatieve lag (lead). De opvolger mag een dag eerder beginnen, zodat de taken overlappen.
- `4u`: 4 werkuren.
- `50%`: de helft van de duur van de voorganger.

Een voorbeeld uit het oefenproject *Aanbouw woning* van de tutorials. Het beton van de fundering moet uitharden voordat de metselaar erop kan. Daarom krijgt *Fundering storten → Funderingsmetselwerk* een FS-relatie met lag `3`. Na **Bereken** (F5) is het storten op vrijdag 18 juni en begint het metselwerk op donderdag 24 juni: maandag, dinsdag en woensdag zijn de wachttijd. Met `3ed` telt het weekend mee en begint het metselwerk al op dinsdag 22 juni.

### Tot slot: opnieuw berekenen

Een nieuwe relatie verschuift nog geen balken. De statusbalk meldt *Verouderd — herbereken (F5)*. Druk op **Bereken** (F5), bijvoorbeeld via *Start › Planning › Bereken*. Pas dan krijgen de opvolgers hun nieuwe datums en zie je het kritieke pad. Wil je dat de app dit zelf doet, zet dan *Automatisch berekenen* aan onder *Instellingen › Project › Instellingen*, tabblad *Planning*.

## Valkuilen en wat de app dan doet

**Omgekeerde volgorde.** Bij *Geselecteerde taken koppelen* wordt je eerste klik de voorganger. Klik je eerst de latere taak aan, dan staat de relatie verkeerd om. Verwijder hem dan in *Afhankelijkheden* met het prullenbakje en leg hem opnieuw.

**Een kring.** Leg je een relatie die terugloopt naar een taak die al eerder in de keten zit, dan zou de planning nooit kunnen beginnen. De app weigert zo'n relatie en noemt de kring, bijvoorbeeld *Deze relatie zou een kring in de planning maken (Bouwplaats inrichten → Tuin en bestrating verwijderen → Bouwplaats inrichten) en is niet aangemaakt.* Draai eerst de bestaande relatie om of verwijder hem.

**Een taak aan zijn eigen fase.** Een relatie tussen een taak en de samenvattende taak waar hij zelf onder valt, kan niet. De app meldt *Een relatie tussen een taak en zijn eigen (voor)ouder-samenvattingstaak is niet toegestaan.*

**Dubbel.** Bestaat de relatie al, dan meldt de app *Deze relatie bestaat al* en verandert er niets.

**Ongeldige invoer in de kolom.** Typ je alleen een WBS-nummer, zoals `3.1`, dan mist het type. De cel blijft open met de hint *Gebruik bijvoorbeeld 1.2 FS+2d.* Vul het type aan of druk op Esc om te annuleren.

**Halve dagen lag.** Een lag in dagen is altijd een heel getal. Typ je `1,5`, dan maakt de app er `+2d` van. Wil je een halve dag, gebruik dan uren, zoals `4u`. Onleesbare invoer, zoals een woord, wordt niet opgeslagen: het vak springt terug naar de vorige waarde.

**Niets verschuift.** Dat klopt: de app rekent pas bij **Bereken** (F5), tenzij *Automatisch berekenen* aan staat.

## Zie ook

- [Kritiek pad en speling](docs://uitleg-kritiek-pad): wat de app met je relaties uitrekent, en waarom een taak kritiek wordt.
- [Relaties & constraints](docs://gids-relaties-constraints): de oudere gids over relaties en constraints.
- [Goed plannen](docs://gids-goed-plannen): waarom elke taak een voorganger en een opvolger hoort te hebben.
