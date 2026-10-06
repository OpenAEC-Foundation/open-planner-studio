# Project verplaatsen

Doel: de hele planning naar een nieuwe startdatum schuiven, en vooraf zien wat dat met het einde doet.

## Wanneer je dit nodig hebt

De start van het werk schuift op: de vergunning komt later, of je hergebruikt de planning van een eerdere woning voor de volgende. Alle taken één voor één verzetten is veel werk. Met **Project verplaatsen** geef je één nieuwe startdatum op en de app schuift alles mee.

Het projecteinde schuift niet altijd evenveel op als de start. De **kalender** schuift namelijk niet mee: feestdagen, bouwvak en winterstop liggen op vaste datums. Een voorbeeld: je maakt met *Start › Bestand › Nieuw* een project met *Startdatum* 29-09-2026, *Land* op *Nederland* en *Bouwvak* op *Geen*, en zet er een planning van 30 werkdagen in die op 9 november 2026 eindigt. Verplaats je hem naar 14 december 2026, 76 kalenderdagen later, dan eindigt hij op 26 januari 2027. Dat is 78 dagen later, want 25 december en 1 januari zijn nu vrije dagen in je planning. De duur blijft 30 werkdagen. Het voorbeeld in het venster laat dit zien voordat je iets verandert.

## Stappen

1. Kies *Planning › Planning › Project verplaatsen…*. De knop is uitgeschakeld zolang het project geen startdatum heeft.
2. Zie bij *Huidige projectstart* waar het project nu begint en kies bij *Nieuwe projectstart* de nieuwe datum.
3. Heeft het project baselines, dan verschijnt het vakje *Baselines mee verschuiven*. Laat het uit als je de verschuiving als afwijking wilt blijven zien (zie de valkuilen).
4. Klik op *Voorbeeld berekenen*. De app rekent de verschoven planning volledig door, zonder iets in je project te veranderen.
5. Bekijk het voorbeeld (zie hieronder). Klopt het, klik dan op *Verplaatsen*.

In het voorbeeld zie je:

- de verschuiving in kalenderdagen (*Verschuiving: 76 kalenderdagen vooruit*);
- *Projectstart* en *Projecteinde*, van voor naar na;
- een rode waarschuwing als de kalender ingrijpt, of de melding dat de projectduur gelijk blijft;
- het aantal verschoven taken en wat er verder meeschuift;
- waarschuwingen die je moet lezen (zie de valkuilen).

De app zet de nieuwe planning meteen door, dus je hoeft geen **Bereken** (F5) te gebruiken, en past het beeld aan op het hele project. Het geheel is één stap voor *Ongedaan* (Ctrl+Z).

De knop *Verplaatsen* is pas te gebruiken na een voorbeeld zonder fout, en als de nieuwe datum anders is dan de huidige. Wijzig je de datum of het vakje, dan verdwijnt het voorbeeld en reken je opnieuw.

### Wat er meeschuift, en wat niet

Meegeschoven wordt: de start en het einde van elke taak, de werkelijke start en het werkelijke einde, de datums van constraints (ook van een harde Mandatory-pin, zie [Constraints en deadlines](docs://uitleg-constraints)), deadlines, de statusdatum, de ankers van externe relaties en de capaciteitsstappen van resources. Ook de projectstart en, als je die hebt ingevuld, de projecteinddatum verschuiven.

Niet mee schuift:

- de kalenders, dus feestdagen, bouwvak en winterstop;
- baselines, tenzij je *Baselines mee verschuiven* aanzet;
- een ingevuld eigen veld van het type *Datum*.

## Valkuilen en wat de app dan doet

**Het einde schuift met een ander aantal dagen op.** Ziet het voorbeeld dat het einde met meer of minder kalenderdagen opschuift dan de start, of dat de projectduur in werkdagen verandert, dan toont het een rode waarschuwing met de getallen. Je kunt dan alsnog annuleren.

**Baselines blijven staan.** Een baseline is er om afwijking te meten. Verplaats je het project met het vakje uit, dan zie je de verschuiving als afwijking van de baseline. Zet je het vakje aan, dan schuiven de baselines mee met de planning. Alleen hun datums schuiven mee; de datum waarop de baseline is opgeslagen niet.

**Een lopend project.** Werkelijke datums schuiven mee. Bij een project waarin je al voortgang hebt ingevoerd is dat niet altijd wat je wilt. De app waarschuwt: *Controleer of dat klopt voor een lopend project.*

**Externe relaties.** Het anker in je eigen project schuift mee, het bronproject niet. Ververs de koppelingen na het verplaatsen met *Start › Taken › Relatie ▾ › Alle externe relaties vernieuwen*. Zie [Externe relaties naar een ander project](docs://howto-externe-relaties).

**Feestdagen die niet ver genoeg reiken.** Een kalender met gegenereerde feestdagen dekt een aantal jaren. Loopt de verplaatste planning daar voorbij, dan rekent de app in dat jaar zonder feestdagen. Het voorbeeld waarschuwt daarvoor, bijvoorbeeld: *De gegenereerde feestdagen van kalender “Bouwkalender NL” dekken 2025–2029; de verplaatste planning loopt tot 2030. Genereer de feestdagen opnieuw.* Verplaats eerst het project. Open daarna *Planning › Kalender › Kalender*: daar staat dan bij de feestdagen *Opnieuw genereren*. Bevestig met *Toepassen*, dan rekent de app opnieuw door. Het bereik van de nieuwe feestdagen volgt de projectdatums, dus opnieuw genereren vóór het verplaatsen helpt niet.

**De datum ligt in het verleden.** Dat mag, maar het voorbeeld meldt het: *De nieuwe startdatum ligt in het verleden.*

**De projectstart wijzigen in Projectinfo is iets anders.** Pas je in *Instellingen › Project › Projectinfo* de startdatum aan en kies je *Toepassen*, dan verplaatst de planning niet. Alleen taken zonder voorganger of constraint die dan vóór de nieuwe start zouden liggen, schuiven naar die datum, en de app meldt hoeveel. Wil je alles verschuiven, gebruik dan *Project verplaatsen…*.

## Zie ook

- [Kritiek pad en speling](docs://uitleg-kritiek-pad): hoe de planning rekent en waarom het einde schuift.
- [Relaties leggen](docs://howto-relaties-leggen): de relaties blijven bij het verplaatsen gewoon bestaan.
- [Nieuw project en Projectinfo](docs://ref-projectinfo): wat de startdatum in Projectinfo doet.
