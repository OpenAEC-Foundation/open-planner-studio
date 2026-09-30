# Relaties leggen

Doel: taken aan elkaar koppelen, zodat een taak pas begint als het werk ervoor klaar is, en waar nodig een wachttijd (lag) ertussen zetten.

## Wanneer je dit nodig hebt

Zonder relaties weet de app niet dat de metselaar pas kan beginnen als de fundering is gestort. Elke taak begint dan op de projectstart en de einddatum zegt niets. Een **relatie** legt die volgorde vast. De eerste taak heet de **voorganger**, de tweede de **opvolger**.

Je legt relaties bij het opbouwen van een planning, als er een taak bijkomt, of als twee klussen toch op elkaar blijken te wachten. Een **lag** is wachttijd tussen twee taken, zoals beton dat moet uitharden of een dekvloer die moet drogen.

De standaardrelatie is **FS** (Eind-Start): de opvolger kan pas beginnen als de voorganger klaar is. De app kent daarnaast SS, FF en SF, die een start of einde aan een start of einde koppelen; bij SS (Start-Start) kan het stucwerk bijvoorbeeld pas beginnen als de installaties begonnen zijn.

## Stappen

Er zijn vier manieren om een relatie te leggen. Ze maken dezelfde relatie; kies wat het handigst is voor je situatie.

### Twee geselecteerde taken koppelen

Handig als je in de takenlijst werkt.

1. Klik in de takenlijst op de taak die eerst moet: de voorganger.
2. Houd Ctrl (op een Mac ⌘) ingedrukt en klik op de taak die daarna komt: de opvolger.
3. Kies *Start › Taken › Relatie ▾ › Geselecteerde taken koppelen*. Dezelfde knop staat ook op *Planning › Relaties*.

De app legt een Eind-Start-relatie zonder lag en meldt bijvoorbeeld *Relatie aangemaakt: Funderingsmetselwerk → Kanaalplaatvloer leggen*. De knop werkt alleen met precies twee geselecteerde taken.

### Een relatie tekenen in de Gantt

Handig als je veel relaties achter elkaar legt.

1. Kies *Start › Taken › Relatie ▾ › Relatie tekenen*. Boven de planning verschijnt de melding *Relatiemodus: sleep in de Gantt van de ene balk naar de andere om een relatie te leggen. Esc stopt.*
2. Druk op de balk van de voorganger en sleep naar de balk van de opvolger. Er loopt een stippellijn met een pijl mee.
3. Laat los. Er verschijnt een klein venster *Type relatie* met het type (standaard FS) en een vak voor de lag.
4. Pas zo nodig type of lag aan en druk op Enter, of klik ernaast. De relatie is gelegd.
5. Leg meteen de volgende: de modus blijft aan. Stoppen doe je met Esc, met de knop *Stoppen* in de melding, of door *Relatie tekenen* opnieuw te kiezen.

Druk je in het venster *Type relatie* op Esc, dan wordt er niets vastgelegd. Voor één losse relatie hoef je de modus niet aan te zetten: houd Shift ingedrukt terwijl je van balk naar balk sleept. *Relatie leggen vanaf hier* in het rechtermuismenu van een balk zet de relatiemodus aan; slepen doe je daarna zelf. Op het tabblad *Tabel*, zonder Gantt, staat *Relatie tekenen* uit.

### Een relatie toevoegen in het paneel Eigenschappen

Handig als je één taak bekijkt en de voorgangers of opvolgers ervan wilt aanvullen.

1. Selecteer de taak. Het paneel *Eigenschappen* staat rechts; zie je het niet, zet het dan aan met *Beeld › Panelen › Eigensch.*
2. Klik in het blok *Afhankelijkheden* op *Relatie toevoegen*.
3. Laat de richting op *Voorganger* staan als de andere taak eerst komt, of kies *Opvolger*.
4. Typ een deel van de naam van de andere taak. Kies de juiste met de pijltjestoetsen en Enter, of klik erop.
5. Kies het type (standaard FS) en vul zo nodig een lag in.
6. Druk op Enter of klik op het vinkje (*Relatie vastleggen*).

De relaties van de taak staan daarna in *Afhankelijkheden*, elk met het WBS-nummer van de andere taak, het type en de lag.

### Relaties typen in de kolom Voorgangers

Handig als je snel werkt met het toetsenbord en de WBS-nummers kent.

1. Klik op de **+** rechts in de kop van de takenlijst (*Kolom toevoegen*) en kies onder *Relaties* de kolom *Voorgangers*. De kolom *Opvolgers* werkt hetzelfde.
2. Klik in de kolom *Voorgangers* op de cel van de opvolger.
3. Typ het WBS-nummer van de voorganger, een spatie en het type, bijvoorbeeld `2.6 FS`. Een lag zet je er direct achter: `2.6 FS+1d`. Meer voorgangers scheid je met een puntkomma of komma: `3.1 FS; 3.2 SS+2d`.
4. Druk op Enter.

Wat je typt, vervangt de hele cel. Staan er al voorgangers in, typ die dan mee (zie de valkuilen). Druk je in de cel op Enter of F2 in plaats van te typen, dan opent een invoerveld dat de bestaande relaties laat staan: je zoekt er een taak op WBS-nummer of naam, en kiest per relatie het type en de lag.

### Lag zetten of wijzigen

Een lag typ je in het vak naast het type, bij elke manier hierboven. Een bestaande lag wijzig je in *Afhankelijkheden*: klik in het lagvak, typ de nieuwe waarde en druk op Enter.

- `3` of `3d`: 3 werkdagen. Een weekend telt niet mee. De app toont `+3d`.
- `3ed`: 3 kalenderdagen. Het weekend telt wel mee, zoals bij beton dat ook op zaterdag en zondag uithardt.
- `-1`: een negatieve lag (lead). De opvolger mag een dag eerder beginnen, zodat de taken overlappen.
- `4u`: 4 werkuren. Is de voorganger een dagtaak op een kalender zonder eigen werktijdblokken, zoals de standaardkalender, dan rekent de app dit om naar hele werkdagen, afgerond op de dichtstbijzijnde hele dag: `4u` werkt dan als 1 dag, `2u` als 0. Op een kalender met eigen werktijdblokken, of na een urentaak, telt de lag exact in uren.
- `50%`: de helft van de duur van de voorganger.

Voorbeeld: het beton van de fundering moet uitharden voordat de metselaar erop kan, dus *Fundering storten → Funderingsmetselwerk* krijgt een FS-relatie met lag `3`. Is het storten op vrijdag 18 juni 2027, dan begint het metselwerk na **Bereken** op donderdag 24 juni: maandag tot en met woensdag is wachttijd. Met `3ed` telt het weekend mee en begint het metselwerk op dinsdag 22 juni.

### Tot slot: opnieuw berekenen

Een nieuwe relatie verschuift nog geen balken; de statusbalk meldt *Verouderd — herbereken (F5)*. Druk op **Bereken** (F5), bijvoorbeeld via *Start › Planning › Bereken*. Pas dan krijgen de opvolgers hun nieuwe datums. Wil je dat de app dit zelf doet, zet dan *Automatisch berekenen* aan onder *Instellingen › Project › Instellingen*, tabblad *Planning*.

## Valkuilen en wat de app dan doet

**Omgekeerde volgorde.** Bij *Geselecteerde taken koppelen* telt de volgorde waarin je klikt, niet die in de lijst. Klik je eerst de latere taak aan, dan staat de relatie verkeerd om. Verwijder hem in *Afhankelijkheden* met het prullenbakje en leg hem opnieuw.

**Typen in de kolom wist wat er stond.** Staat in de cel `3.4 FS; 3.2 FS` en typ je alleen `3.2 FS`, dan is de relatie met 3.4 weg, zonder melding. Typ alle voorgangers mee, gebruik Enter of F2 om aan te vullen, of zet het terug met Ctrl+Z.

**Een kring.** Leg je een relatie die terugloopt naar een taak die al eerder in de keten zit, dan zou de planning nooit kunnen beginnen. De app weigert zo'n relatie: *Deze relatie zou een kring in de planning maken (…) en is niet aangemaakt*, met tussen haakjes de taken van de kring. Verwijder eerst de relatie die de kring sluit.

**Een taak aan de eigen fase.** Een relatie tussen een taak en de samenvattende taak waar de taak zelf onder valt, kan niet. De app meldt *Een relatie tussen een taak en zijn eigen (voor)ouder-samenvattingstaak is niet toegestaan.*

**Dubbel.** Bestaat de relatie al, dan meldt de app *Deze relatie bestaat al* en verandert er niets.

**In de kolom korter gemeld.** Dezelfde weigeringen geeft de kolom *Voorgangers* met een kortere tekst onder de cel: *Deze wijziging zou een kring in de planning maken.*, *Deze relatie bestaat al.* of *Een taak kan geen relatie hebben met zijn eigen samenvattende taak.* Typ je alleen een WBS-nummer, zoals `3.1`, dan mist het type en meldt de cel *Gebruik bijvoorbeeld 1.2 FS+2d.* De cel blijft open; verbeter de invoer of druk op Esc om te annuleren.

**Geen halve dagen lag.** Een lag in dagen is altijd een heel getal: `1,5` wordt `+2d`, en een uren-lag na een dagtaak op een kalender zonder eigen werktijdblokken wordt afgerond op hele werkdagen. Onleesbare invoer, zoals een woord, wordt niet opgeslagen: het vak springt terug naar de vorige waarde.

## Zie ook

- [Kritiek pad en speling](docs://uitleg-kritiek-pad): wat de app met je relaties uitrekent, en waarom een taak kritiek wordt.
