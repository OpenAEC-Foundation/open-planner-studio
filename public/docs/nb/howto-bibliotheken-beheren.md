# Administrere og dele ressursbiblioteker

Mål: opprette og slette ressursbiblioteker, legge kalendere i dem, og eksportere eller importere et bibliotek, som sikkerhetskopi eller for å bruke det på en annen datamaskin.

## Når du trenger dette

Biblioteket ligger ikke i prosjektfilene dine, men i appen: i skrivebordsappen i en fil på denne datamaskinen, i nettleseren i nettleserens lagring. Det synkroniseres ikke. Hvis du sletter nettstedsdataene i nettleseren, er biblioteket borte. Eksporter det derfor som sikkerhetskopi. Hvis en kollega vil jobbe med de samme mannskapene og standardsatsene, gir du også biblioteket videre som en fil. Hvis organisasjonen din har flere driftsselskaper med egne mannskaper, lager du et eget bibliotek for hvert av dem. For et nytt prosjekt velger du hvilket bibliotek det bruker.

Hva et bibliotek er, leser du i [Ressursbiblioteket](docs://uitleg-resourcebibliotheek). Du redigerer ikke ressursene selv her, men i ressurspanelet. Se [Bruke ressursbiblioteket](docs://howto-resourcebibliotheek-gebruiken).

## Steg

### Åpne administrasjonsskjermen

Velg *Fil › Bibliotek*. Til venstre er listen *Ressursbibliotekene*. Til høyre er detaljene for biblioteket du klikker på: navnet, knappene og listen *Kalendere*. Øverst står det at du administrerer ressurser på fanen *Ressurser*.

### Opprette, gi nytt navn og velge standardbibliotek

1. Klikk på plusstegnet over listen (*Legg til ressursbibliotek*). Et bibliotek med navnet *Nytt ressursbibliotek* blir lagt til, og det er valgt med en gang.
2. Skriv det nye navnet i navnefeltet øverst til høyre og trykk Enter, eller klikk utenfor feltet. Appen godtar ikke et tomt navn.
3. Klikk på *Angi som standard* for at dette biblioteket skal være forhåndsvalgt for nye prosjekter fra nå av. Standardbiblioteket har en stjerne i listen.

### Legge en kalender i biblioteket

1. Under *Kalendere* klikker du på *Fra prosjekt*. Det åpnes en liste med kalenderne i det aktive prosjektet.
2. Klikk på den lille pilen etter kalenderen du vil ta over. Over listen står det *Lagt til.* En kalender som allerede er koblet til dette biblioteket, har *allerede koblet* etter navnet.
3. Kalenderen står nå i listen *Kalendere* i biblioteket. Med blyanten (*Rediger*) endrer du navnet, og du lagrer med haken. Søppelbøtten sletter kalenderen med en gang, uten å be om bekreftelse. Kopiene i prosjektene blir værende.

Etter *Kalendere* står et versjonsnummer, for eksempel *v2*. Det går opp ved hver endring i biblioteket. En bibliotekskalender følger med til et prosjekt når du tildeler en ressurs som bruker den. Du knytter den til en ressurs i *Ressurser*, i visningen *Bibliotek*, i kolonnen *Kalender*.

### Eksportere et bibliotek

1. Velg biblioteket i listen.
2. Klikk på *Eksporter*.
3. I skrivebordsappen og i Chrome og Edge velger du hvor filen skal lagres. I andre nettlesere går den rett til nedlastingsmappen din, og appen sier fra om det. Filen heter `bibliotheek-` etterfulgt av navnet på biblioteket, med filendelsen `.ifc`.

Under knappene står det *Eksport er også din sikkerhetskopi: oppbevar filen et trygt sted.*

### Importere et bibliotek

1. Klikk på *Importer*. Vinduet *Importer bibliotek* åpnes for biblioteket du hadde valgt i listen.
2. Klikk på *Velg fil…* og velg `.ifc`-filen fra en eksport. Hvis filen ikke inneholder et ressursbibliotek, står det *Denne IFC-filen inneholder ikke et ressursbibliotek.*
3. Appen viser hva som er i filen, for eksempel *2 kalendere, 5 ressurser (versjon 3).*
4. Velg hva du vil gjøre med den, se nedenfor.
5. Klikk på *Legg til* eller *Erstatt*, eller på *Avbryt* for å stoppe.

Du har to valg:

- *Legg til som nytt ressursbibliotek*: filen blir et eget bibliotek ved siden av de eksisterende. Under den står det hvilket navn det får, for eksempel *Blir lagt til som “Mijn resourcebibliotheek (2)”.* Ingenting går tapt, og det aktive prosjektet er fortsatt koblet til sitt eget bibliotek.
- *Erstatt et eksisterende ressursbibliotek*: hele innholdet i det valgte biblioteket erstattes av innholdet i filen. Det står også der: *Import erstatter HELE poolen til det valgte ressursbiblioteket.* Har du to eller flere bibliotek, velger du hvilket under *Importer til ressursbibliotek*. Er biblioteket ditt nyere enn filen, advarer appen: *Ditt lokale bibliotek er nyere — import kan overskrive endringene dine.*

Appen stiller selv et forslag. For en fil som inneholdt standardbiblioteket, er *Legg til som nytt ressursbibliotek* forhåndsvalgt. Hvis biblioteket fra filen allerede finnes på datamaskinen din og ikke er standardbiblioteket, er *Erstatt et eksisterende ressursbibliotek* forhåndsvalgt, med nettopp det biblioteket valgt. Er du usikker, velg å legge til: da overskrives ingenting.

### Slette et bibliotek

1. Velg biblioteket i listen og klikk på *Slett ressursbibliotek*. Knappen er grå for det siste biblioteket, fordi det alltid er ett igjen.
2. Bekreft med *Slett*. Spørsmålet er *Slette dette ressursbiblioteket?* Hvis åpne prosjekter er koblet til det, står det *Dette ressursbiblioteket er koblet til 1 åpent prosjekt. Sletting kobler prosjektet fra. Fortsette?* For flere prosjekter står det det samme med tallet, for eksempel *koblet til 2 åpne prosjekter*.

Biblioteket er da borte, med alle ressurser og kalendere i det. De åpne prosjektene som brukte det, blir frakoblet: ressursene deres blir værende som vanlige prosjektressurser. Eksporter først hvis du vil beholde innholdet.

### Gi et prosjekt videre sammen med biblioteket

En prosjektfil inneholder sine egne kopier av ressursene. Vil du også gi hele biblioteket videre, gjør du følgende. Selve eksporten beskrives også i [Eksportering](docs://howto-exporteren).

1. Åpne et prosjekt som er koblet til et bibliotek, og velg *Fil › Eksporter*.
2. Kryss av for *Lagre bibliotekfilen ved siden av*. Avkrysningsboksen finnes bare for et koblet prosjekt.
3. Velg kortet *IFC* og lagre filen. Appen ber deretter også om en annen fil. Den får samme navn som prosjektet, med `-bibliotheek` etter, og den inneholder biblioteket.

Avkrysningsboksen virker bare for IFC-eksporten, ikke for de andre eksportformatene. Kollegaen din importerer den andre filen slik som beskrevet ovenfor.

## Fallgruver og hva appen gjør da

**To planleggere, to bibliotek.** Appen synkroniserer ikke bibliotek mellom datamaskiner. Importvinduet viser alltid en advarsel om det: *Merk: bibliotek synkroniseres ikke mellom maskiner. Hvis to planleggere jobber med samme ressursbibliotek, kan bibliotekene bli ulike. Hvis organisasjonen din deler mannskaper mellom driftsselskaper, velg da bevisst ett felles bibliotek.*

**Erstatting overskriver alt.** Alt du hadde i det valgte biblioteket, er borte, og en endring i biblioteket er ikke med i *Angre*. Eksporter først hvis du er usikker. Prosjektene dine beholder sine kopier. Appen oppdaterer kopiene som fortsatt finnes i den nye filen. Kopier som ikke lenger finnes i den, får merket *ikke lenger i biblioteket* og fortsetter å virke. Hvis en kopi er ulik, åpnes vinduet *Koble til ressursbiblioteket* (se [Bruke ressursbiblioteket](docs://howto-resourcebibliotheek-gebruiken)).

**Sletting av en kalender i listen skjer med en gang.** Appen spør ikke om bekreftelse, mens sletting av en ressurs gjør det. Det ser ut som en mangel. Endringer i biblioteket er ikke med i *Angre*.

## Se også

- [Ressursbiblioteket](docs://uitleg-resourcebibliotheek): hvordan bibliotek og prosjekt henger sammen.
- [Bruke ressursbiblioteket](docs://howto-resourcebibliotheek-gebruiken): koble ressurser, tildele dem og løse avvik.
- [Eksportering](docs://howto-exporteren): eksportformatene, inkludert IFC med en bibliotekfil.
