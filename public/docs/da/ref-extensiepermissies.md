# Tilladelser for udvidelser

Alle tilladelser en udvidelse kan angive i sit manifest: hvad den tillader, hvad der sker når den mangler, og hvad du ser af den når du installerer en udvidelse. Hvordan du håndterer og installerer udvidelser, står i [Installation og håndtering af en udvidelse](docs://howto-extensie-installeren).

## Hvad en tilladelse er, og hvad den ikke er

En tilladelse er en **angivelse fra forfatteren**: hvilke dele af appens grænseflade udvidelsen vil bruge. Den er ikke en barriere. Koden i en udvidelse kører i samme miljø som selve appen. Den kan derfor gøre mere end tilladelserne siger: der er ingen sandkasse. Appen siger det også i installationsvinduet. Installér kun udvidelser fra forfattere du stoler på.

Appen håndhæver en tilladelse på en af tre måder. Forskellen er vigtig:

**Hårdt håndhævet.** Mangler tilladelsen, kaster den tilsvarende metode en fejl (på nederlandsk, for eksempel *Extensie "…" mist permissie: ribbon*), før noget sker.

**Advarsel.** Mangler tilladelsen, virker metoden stadig, men appen skriver en advarsel i loggen. I en fremtidig version bliver det en afvisning.

**Kun informativ.** Tilladelsen hører ikke til nogen del af grænsefladen. Appen viser den ved installation og gør ikke andet med den.

Det der kræver ingen tilladelse, er grundlaget for udvidelsens grænseflade: læse projektet, kalenderen, opgaverne, afhængighederne, ressourcerne og tildelingerne; tilføje opgaver og afhængigheder og ændre opgaver; indlæse et projekt, genberegne og samle flere ændringer; gemme sine egne indstillinger, læse sine egne medfølgende filer og vise en meddelelse.

**Manifestet.** Tilladelserne står i manifestet som en liste. En udvidelse du installerer nu, med en tilladelse som denne appversion ikke kender, bliver afvist. For en allerede gemt, ældre udvidelse fjerner appen ukendte tilladelser og melder det i loggen.

## Hvordan appen spørger

Ved installation, fra kataloget (*Fil › Udvidelser › Gennemse › Installér*) eller fra en fil (*ZIP* eller *JS*), viser appen vinduet *Installér udvidelse?*. Spørgsmålet kommer én gang, ved installationen: ikke hver gang du slår udvidelsen til.

Vinduet viser navn, version, beskrivelse, forfatter og, hvis der er en, depotet. Under *Oprindelse* står hvor udvidelsen kommer fra (*Fra det online udvidelseskatalog*, *Fra en ZIP-fil på denne computer* eller *Fra en JavaScript-fil på denne computer*) og om downloaden er bekræftet: med kontrolsummen fra kataloget, ikke bekræftet fordi kataloget ikke giver nogen, eller en fil du selv valgte. Under *Hvad du siger ja til* står at en udvidelse er programkode der kører med de samme rettigheder som appen, og hvad det betyder i praksis: i desktopappen blandt andet læsning og skrivning af filer hvor som helst i din brugermappe, samt adgang til dine projekter, indstillinger og udklipsholder; i browseren adgang til dine gemte projekter og indstillinger, til de filer du har givet adgang til, og til netværket.

Under *Hvad denne udvidelse siger at bruge* står tilladelserne fra manifestet, som korte etiketter med navnet som nedenfor. Der står: *Dette er forfatterens angivelse, ikke en begrænsning. Koden kan alligevel gøre mere.* Har udvidelsen ingen tilladelser, står der *Intet angivet.* To tilladelser får en forklaring: *importSource* og *help*. De øvrige seks får kun deres etiket.

Med *Installér* siger du ja. *Installér ikke*, Esc og et klik uden for vinduet afviser installationen.

## Tilladelserne

**ribbon** — placér en knap i båndet. Virkning: udvidelsen må tilføje en knap til en gruppe på en båndfane. En udvidelse uden denne tilladelse får en fejl, når den forsøger. Knapperne vises til sidst på den valgte fane, under en gruppeetiket for udvidelsen. De forsvinder, når du slår udvidelsen fra eller fjerner den. Standard: ikke givet; kun det der står i manifestet. Håndhævelse: hård. Hvor: på den fane udvidelsen valgte.

**events** — følg appens hændelser og send selv hændelser. Virkning: udvidelsen må abonnere på og framelde sig fra hændelser og selv sende hændelser. Appen selv sender fire: et projekt er indlæst (efter import, åbning eller indlæsning via en udvidelse), et tomt projekt er oprettet, tidsplanen er genberegnet, og brugeren har bedt om et selvstudium. Den sidste sendes kun til udvidelsen for selvstudier. Standard: ikke givet; kun det der står i manifestet. Håndhævelse: hård. Hvor: ingen steder; udvidelsen reagerer på hændelsen.

**backstage** — tilbyd et importformat. Virkning: udvidelsen må registrere en importør; den vises under *Fil › Importer*, hvor du klikker på et format og vælger en fil. De indbyggede formater er adskilt fra dette (se [Import- og eksportformater](docs://ref-import-exportformaten)). Standard: ikke givet; kun det der står i manifestet. Håndhævelse: advarsel. Mangler tilladelsen, virker registreringen stadig, med en advarsel i loggen. Det er en overgangsordning, fordi eksisterende udvidelser ikke altid angiver tilladelsen. Hvor: *Fil › Importer*.

**pdf-fonts** — lever en skrifttype til pdf-eksporten. Virkning: udvidelsen må registrere en skrifttypeleverandør. PDF-eksporten bruger den til tegn som de indbyggede skrifttyper ikke dækker, for eksempel kinesiske, japanske og koreanske tegn. Standard: ikke givet; kun det der står i manifestet. Håndhævelse: hård. Hvor: i pdf-filen fra en rapport; i installationsvinduet står der kun etiketten.

**importSource** — læs de oprindelige bytes i en importeret fil. Virkning: udvidelsen må bede om hele indholdet af kildefilen i et importeret projekt (indtil nu: en Primavera-fil), inklusive de felter som appen bevidst ikke tager med i dit projekt, for eksempel revisions- og herkomstfelter, omkostninger, gennemgangs- og placeringsfelter. Det er langt bredere end resten af grænsefladen og er derfor en særskilt tilladelse. Uden tilladelsen læser appen ikke en eneste byte af kildefilen: hver metode kaster så en fejl, før noget hentes. Standard: ikke givet; kun det der står i manifestet. Håndhævelse: hård, afvist som standard. Hvor: i installationsvinduet følger en forklaring med: *importSource — de komplette oprindelige kildebytes for hver importeret fil (for eksempel en rå Primavera-fil), inklusive felter der aldrig kommer med i projektet.*

**help** — tilføj Hjælp-artikler og vejledning. Virkning: udvidelsen må registrere og fjerne Hjælp-artikler (selvstudier), åbne en medfølgende `.ifc`-fil som nyt dokument og starte og stoppe en vejledning der peger på dele af appen. Et medfølgende projekt overskriver aldrig det dokument du arbejder i: det åbnes som nyt dokument, eller overtager kun en tom, uændret fane. Fra kontraktversion 1.4.0. Standard: ikke givet; kun det der står i manifestet. Håndhævelse: hård. Hvor: i vinduet *Hjælp* (artiklerne), som ny fane (projektet) og som vejledning der peger på knapper. I installationsvinduet følger en forklaring med: *help — må tilføje Hjælp-artikler, åbne medfølgende projekter som nyt dokument og vise en vejledning der peger på dele af appen.*

**filesystem** — udvidelsen siger at den bruger filer. Virkning: ingen; ingen del af grænsefladen hører til den, og appen kan ikke håndhæve den. Standard: ikke givet; kun det der står i manifestet. Håndhævelse: kun informativ. Hvor: som etiket i installationsvinduet.

**network** — udvidelsen siger at den bruger netværket. Virkning: ingen; ligesom *filesystem*. Standard: ikke givet; kun det der står i manifestet. Håndhævelse: kun informativ. Hvor: som etiket i installationsvinduet.

## Se også

- [Import- og eksportformater](docs://ref-import-exportformaten): de formater appen selv kender, ved siden af det som udvidelser tilføjer under *Fil › Importer*.
- [Installation og håndtering af en udvidelse](docs://howto-extensie-installeren): installere, deaktivere og fjerne en udvidelse.
