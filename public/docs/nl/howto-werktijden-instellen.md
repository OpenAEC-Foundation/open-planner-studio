# Werktijden instellen

Doel: per weekdag vastleggen op welke kloktijden een kalender werkt, zodat taken in uren op de juiste tijden lopen.

## Wanneer je dit nodig hebt

De vrijdagmiddag is vrij. De ploeg werkt van 06:00 tot 22:00 in twee diensten. Er is een nachtploeg. De pauze is korter dan een uur. Zolang je alleen in dagen plant, volstaan *Begin (uur)*, *Einde (uur)* en de pauze ([Een kalender maken en toewijzen](docs://howto-kalender-maken-en-toewijzen)). Plan je taken in uren, dan telt de app werkminuten binnen de **werktijdblokken** van de kalender. In de app heten die blokken *banden*: een blok is een aaneengesloten stuk werktijd op één weekdag, en een gat tussen twee blokken is een pauze. Wat dat voor je planning betekent, staat in [Dagen en uren](docs://uitleg-dagen-en-uren).

Het blok *Werktijden* is bij elke kalender beschikbaar.

## Stappen

### Een ploegenpreset kiezen

1. Kies *Planning › Kalender › Kalender* en kies links de kalender.
2. Klik in het blok *Werktijden* op een preset. Die vervangt de werkdagen en werktijden van de kalender.
3. Klik op *Toepassen*.

Dit doet elke preset:

- *Dagdienst*: maandag tot en met vrijdag van 08:00 tot 16:00 zonder pauze. Dit maakt er weer een gewone kalender van, zonder werktijdblokken.
- *2 ploegen*: maandag tot en met vrijdag van 06:00 tot 14:00 en van 14:00 tot 22:00, samen 16 uur.
- *3 ploegen*: maandag tot en met vrijdag drie diensten van 06:00 tot 14:00, van 14:00 tot 22:00 en van 22:00 tot 06:00 de volgende dag, samen 24 uur.
- *Nachtploeg*: maandag tot en met vrijdag van 22:00 tot 06:00 de volgende dag, 8 uur.
- *24/7*: alle zeven dagen van 00:00 tot 24:00.

### Werktijden per weekdag instellen

1. Klik in het blok *Werktijden* op *Per weekdag instellen…*. Onder de knoppen verschijnt per weekdag een regel met de werktijd van die dag, en de kalender heeft daarmee werktijdblokken per weekdag. Heeft de kalender die al, dan staat dit overzicht meteen open; de knop heet dan *Werktijden verbergen* en klapt het in.
2. Pas per blok de begin- en eindtijd aan in de twee tijdvelden. Typ de tijd en druk op Enter, of gebruik de pijltjes (15 minuten per stap). De velden volgen de *Tijdnotatie* in de instellingen; *13:00* en *1:00 PM* zijn allebei goed.
3. Wil je een pauze inbouwen, klik dan bij die dag op **+** (*Band toevoegen*) en pas de tijden van de blokken zo aan dat er een gat tussen zit. Een nieuw blok begint op 08:00 en eindigt op 16:00.
4. Een blok dat na middernacht doorloopt, vink je aan met *volgende dag*. Het blok telt bij de dag waarop het begint.
5. Klik op de prullenbak achter een blok om het te verwijderen. Een dag zonder blokken staat als *Niet-werkend*.
6. Klik bij een dag van maandag tot en met vrijdag op het kopieersymbool (*Kopieer naar alle werkdagen*) om de blokken van die dag naar maandag tot en met vrijdag te zetten.
7. Boven het blok *Werktijden* staat *Standaard werkdag*: de werktijd per dag die de app uit de blokken afleidt en waarmee hij rekent. Het getal volgt direct als je de blokken wijzigt. Heeft de kalender eigen uren per dag (bijvoorbeeld uit Primavera P6), dan blijft die eigen waarde bewaard en gaat hij mee bij de export, tot een preset hem vervangt. Wijkt die eigen waarde af van de *Standaard werkdag*, dan staat direct onder het getal een oranje blok, bijvoorbeeld: *Het bestand heeft een eigen werkdag van 8u. Die gaat mee bij export naar MS Project en P6. Daar telt een dag 8u, hier 10u.* Het blok verdwijnt zodra de blokken dezelfde dagsom geven, of als een preset de eigen waarde vervangt. Het blok verandert niets aan de berekening. Klik op *Toepassen*.

**Voorbeeld: een vrijdagmiddag vrij.** Klik op *Per weekdag instellen…*. Verwijder bij *Vr* het tweede blok (13:00 tot 16:00). Vrijdag telt nu 5 uur, de andere dagen 8. De *Standaard werkdag* blijft 8 uur.

### Een eigen preset bewaren

1. Klik op *Bewaar als preset…* en typ een naam in het veld *Naam voor je eigen preset*.
2. Klik op *Opslaan*. De preset staat nu tussen de andere presets, en je kunt hem in elk project gebruiken. Met het kruisje ernaast verwijder je hem weer.

Een eigen preset staat op dit apparaat, niet in het projectbestand.

## Valkuilen en wat de app dan doet

**Een preset vervangt alles.** Kies je een preset, dan verdwijnen de werkdagen en werktijden die je eerder instelde. De feestdagen blijven.

**Dagknoppen passen de blokken aan.** Zet je bij *Werkdagen* een dag uit, dan verdwijnen de blokken van die dag. Zet je hem weer aan, dan krijgt hij de blokken terug die hij had toen je het venster opende (of na de laatste preset), of anders die van de eerste werkdag. *Ma–vr* doet dat voor maandag tot en met vrijdag en haalt de blokken van zaterdag en zondag weg. *Continu (24/7)* vervangt alle blokken: elke dag krijgt 00:00 tot 24:00.


**Geen bruikbare werktijden.** Een kalender zonder blokken of zonder werkdagen kan geen taak in uren dragen. De app meldt dan *Deze kalender heeft geen geldige werktijden. Controleer de werkdagen en werktijden.*

## Zie ook

- [Dagen en uren](docs://uitleg-dagen-en-uren): hoe de app werkuren telt en de standaard werkdag afleidt.
- [Een taak in uren plannen](docs://howto-taak-in-uren-plannen): een taak in uren plannen.
- [Kalenders en werkdagen](docs://uitleg-kalenders): welke kalender voor welke taak geldt.
- [Kalendervensters](docs://ref-kalenders): alle velden van de kalendervensters.
