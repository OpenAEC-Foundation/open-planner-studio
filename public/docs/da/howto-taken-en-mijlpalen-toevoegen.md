# Tilføjelse af opgaver og milepæle

Mål: læg en ny opgave eller milepæl i din tidsplan, på det sted hvor den hører hjemme.

## Hvornår du har brug for dette

Du bygger en tidsplan, der kommer nyt arbejde til, eller du vil registrere et tidspunkt, for eksempel overdragelse eller en inspektion.

En **opgave** er arbejde, der tager tid. En ny opgave varer som standard 5 arbejdsdage. Med timeplanlægning kan standarden for projektet være timer. En **milepæl** er et tidspunkt uden varighed: 0 dage. En opgave med underopgaver kaldes en **hovedopgave**. I byggeri er det ofte en fase. Dens varighed og datoer følger af underopgaverne, så snart du bruger **Beregn** (F5).

## Trin

### Tilføj en opgave

1. Vælg *Start › Opgaver › Opgave*. Den samme knap findes på fanen *Tabel*.
2. Panelet *Egenskaber* åbnes, og feltet *Navn* er valgt. Skriv navnet, og tryk på Enter.

Den nye opgave hedder først *Ny opgave* og starter på projektstartdatoen.

Hvis en opgave er valgt, kommer den nye opgave lige under den, på samme niveau. Hvis den valgte opgave er en hovedopgave, kommer den nye opgave under hele fasen, altså efter dens underopgaver. Hvis intet er valgt, kommer den nederst på listen. Knappens tooltip viser, hvilket af de to der sker: *Ny opgave lige under valget* eller *Ny opgave nederst på listen*. Vælger du flere opgaver, oprettes der én ny opgave under den nederste af de valgte, set som de ses på skærmen.

### Hurtigt efter hinanden i opgavetabellen

Under den sidste opgave i opgavetabellen står altid en grå række med *Ny opgave*. Den er ikke en opgave endnu: den står hverken i Gantt eller i filen.

1. Klik i en celle på den række, eller gå til den med pil ned.
2. Skriv navnet, og tryk på Enter. Nu er det en rigtig opgave, på samme niveau som opgaven ovenfor. Markøren står med det samme på den nye grå række nedenfor.
3. Skriv det næste navn, og så videre.

Udfylder du kun en varighed eller en dato på den grå række, hedder opgaven *Ny opgave*. Forlader du rækken uden at udfylde noget, sker der ingenting: der oprettes ingen opgave, og der kommer ingen post i *Fortryd*. Oprettelsen af opgaven og den første værdi er tilsammen ét trin i *Fortryd*. Den grå række vises kun, når opgavetabellen ikke er filtreret, grupperet eller sorteret.

### Med højre museknap på tomt område

Højreklik på tomt område: i opgavetabellen under den sidste opgave, eller i Gantt ved siden af eller under bjælkerne. Vælg *Ny opgave* eller *Tilføj milepæl*. Opgaven kommer nederst på listen. I Gantt starter den på den dato, hvor du klikkede. I opgavetabellen åbnes navnecellen med det samme, så du kan skrive.

### Over eller under en bestemt opgave

Højreklik på opgaven, og vælg *Indsæt over* eller *Indsæt under*. Tastaturet virker også: Insert tilføjer over den valgte opgave, Ctrl+I (⌘+I på en Mac) under den. I opgavetabellen åbnes navnecellen direkte efter Insert, klar til at skrive.

Vælger du flere opgaver, oprettes der én ny opgave: *Indsæt over* sætter den over den øverste valgte opgave, *Indsæt under* under den nederste.

### Tilføj en underopgave

Højreklik på opgaven, og vælg *Tilføj underopgave*. Den nye opgave kommer nederst under opgavens underopgaver. I opgavetabellen ved siden af Gantt har en hovedopgave også et lille **+** efter sit navn, der gør det samme.

### Tilføj en milepæl

1. Vælg *Start › Opgaver › Milepæl ▾*, og vælg dernæst *Startmilepæl*, *Slutmilepæl* eller *Kontrolpunkt (obligatorisk)*.
2. Skriv navnet, og tryk på Enter. Placeringen følger samme regel som for *Opgave*.

De tre typer adskiller sig sådan her:

- En *Startmilepæl* hører til dagens begyndelse, en *Slutmilepæl* til dagens slutning. I Gantt sidder romben til venstre for dagkolonnen ved en startmilepæl og til højre ved en slutmilepæl. Det har også betydning for den efterfølgende opgave. Antag, at en milepæl ligger tirsdag den 29. september 2026, og at en opgave følger med en afhængighed af typen slut til start. Efter en startmilepæl starter den opgave samme tirsdag. Efter en slutmilepæl starter den onsdag den 30. september.
- Et *Kontrolpunkt (obligatorisk)* er en slutmilepæl med arbejdskategorien *Kontrol/inspektion* og afkrydsningen *Obligatorisk (kontraktuel)*.

### Gør en eksisterende opgave til en milepæl

Højreklik på opgaven, og vælg *Skift milepæl*, eller sæt flueben ved *Milepæl* i panelet *Egenskaber*. Menupunktet virker for hele markeringen. Varigheden bliver 0.

Slår du det fra igen, bliver det en almindelig opgave med varighed 0. Skriv selv en varighed.

### Andre måder

- Ctrl+M (⌘+M på en Mac) sætter en ny milepæl nederst på listen, også når en opgave er valgt. Panelet *Egenskaber* åbnes ikke.
- En milepæl, du laver med Ctrl+M eller via højreklikmenuen, får arbejdskategorien *Kontrol/inspektion*. En *Startmilepæl* eller *Slutmilepæl* fra *Milepæl ▾* får *Andet*. Skift arbejdskategorien i panelet *Egenskaber*, hvis du har brug for det.
- *Tilføj milepæl* i højreklikmenuen på en opgave gør milepælen til en underopgave af den opgave, ikke til en opgave på samme niveau.

### Kopiér en opgave eller en hel gren

1. Klik i Gantt på opgavens bjælke. Vælg flere opgaver med Ctrl+klik.
2. Tryk på Ctrl+C (⌘+C på en Mac). Appen kopierer opgaven med alle dens underopgaver, afhængighederne mellem de kopierede opgaver og tildelingerne af ressourcer.
3. Klik om ønsket på bjælken for den opgave, som kopien skal ligge ved, og tryk på Ctrl+V (⌘+V).

Kopien har samme navn, samme datoer og samme fremdrift. Den kommer på samme niveau som den valgte opgave (ved flere: den du klikkede først), nederst blandt de opgaver på det niveau. Hvis intet er valgt, kommer den nederst på listen. De kopierede opgaver er bagefter valgt, WBS-koderne (hver opgaves nummer i træet, fx 1.2; se [Justering af strukturen](docs://howto-structuur-aanpassen)) bestemmes igen, og tidsplanen er forældet.

Udklipsholderen deles af hele appen, så du kan også indsætte i et andet dokument. Det, der ikke findes dér, fx en kalender på opgaven, en egen arbejdskategori, en opgavekode eller et brugerdefineret felt, fjerner appen, og den giver dig besked.

### Bagefter

En ny opgave ændrer endnu ikke de andre datoer. Statuslinjen viser *Forældet — genberegn (F5)*. Tryk på **Beregn** (F5), fx via *Start › Tidsplan › Beregn*.

## Faldgruber og hvad appen gør

**Hver ny opgave starter på projektstartdatoen.** Uden afhængigheder venter en opgave ikke på noget. Tilføj afhængigheder, se [Tilføjelse af afhængigheder](docs://howto-relaties-leggen).

**Filtrering, gruppering eller sortering er aktiv.** Rækkefølgen du ser, er da ikke tidsplanens rækkefølge. Med en opgave valgt tilføjer *Opgave* og *Milepæl ▾* den nye opgave nederst. Så vises en rød meddelelse: *Den nye opgave står bagerst. Under filtrering, gruppering eller sortering kan appen ikke sætte den under din markering.* *Indsæt over* og *Indsæt under* afvises, med stripen *Ikke tilgængelig under filtrering/gruppering/sortering*. Knappen *Ryd* i meddelelsen eller i stripen fjerner filter, gruppering og sortering på én gang. Det er ikke en del af *Fortryd*: Ctrl+Z henter dem ikke tilbage.

**En underopgave under en opgave med ressourcetildelinger.** Opgaven bliver en hovedopgave, og en hovedopgave har selv ingen tildelinger. Appen flytter tildelingerne til den nye underopgave og giver besked. Hvis det ikke kan lade sig gøre, fx fordi du valgte *Tilføj milepæl*, og en milepæl ikke kan have tildelinger, tilføjer appen intet og siger hvorfor.

**En underopgave under en milepæl.** Milepælen bliver en hovedopgave, og appen fjerner milepælsflaget og giver besked.

**Milepæl slået til for en hovedopgave eller en opgave med tildelinger.** Appen afviser det og siger hvorfor. Med tildelinger: fjern dem først.

**Kopiering i opgavetabellen.** I opgavetabellen (og på fanen *Tabel*) kopierer Ctrl+C kun værdierne i de valgte celler, som i et regneark, og Ctrl+V indsætter i celler. Kopiering af opgaver virker derfor kun via Gantt: klik først på en bjælke.

## Se også

- [Justering af strukturen](docs://howto-structuur-aanpassen): indryk og flyt opgaver, og hold WBS-numrene opdaterede.
- [Tilføjelse af afhængigheder](docs://howto-relaties-leggen): sammenkæd opgaver.
- [Markering, sletning og fortrydelse af opgaver](docs://howto-taken-selecteren-verwijderen): fjern en opgave igen.
- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): hvad appen beregner, når der er afhængigheder.
- [Opgavedialog og egenskabspanel](docs://ref-taak-eigenschappen): alle felter for en opgave.
- [Nyt projekt og Projektinfo](docs://ref-projectinfo): at starte med en faseringsskabelon.
- [Højreklikmenuer](docs://ref-contextmenus): alle punkter i menuen for en opgave.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): et lille eksempelprojekt (*Fil › Eksempler*) med fire faser, en startmilepæl og en obligatorisk milepæl for overdragelse.
