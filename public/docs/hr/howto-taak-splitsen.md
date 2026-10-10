# Podjela zadatka

Cilj: prekinuti zadatak, tako da se rad zaustavi i nastavi kasnije, bez pretvaranja u dva zadatka.

## Kada vam ovo treba

Postavljanje armature traje osam radnih dana, ali nakon četiri dana dizalica mora otići na drugi posao, a rad se nastavlja dva dana kasnije. Dva odvojena zadatka znače da morate ovisnosti i dodjele držati dvostruko. S **prekidom** zadatak ostaje jedan, s jednom trakom koja ima prazninu. Aplikacija u sučelju koristi i naziv *prekid*.

Rad ostaje jednako dug, ali zadatak na kalendaru traje dulje. Primjer: zadatak od 8 radnih dana koji počinje u utorak 29. rujna 2026. završava u četvrtak 8. listopada. Ako stavite prekid od 2 radna dana nakon 4 radna dana, završava u ponedjeljak 12. listopada. Trajanje ostaje 8 radnih dana, samo se završetak pomakne za dva radna dana.

## Koraci

### Podjela u Gantt prikazu

1. Odaberite *Početna › Zadaci › Podijeli zadatak* (ili *Raspored › Ovisnosti › Podijeli zadatak*). Iznad rasporeda pojavljuje se obavijest *Kliknite traku na dan kada prekid počinje i povucite udesno za njegovu duljinu. Pritisnite Esc za zaustavljanje*. Gumb je i na kartici *Tablica* (*Tablica › Zadaci › Podijeli zadatak*), ali je tamo onemogućen.
2. Pomaknite miš preko trake. Isprekidana crta i oznaka s datumom pokazuju gdje bi prekid počeo. Pritisnite na traku, na dan kada prekid počinje.
3. Povucite udesno. Oznaka prikazuje duljinu, na primjer *Prekid: 2 radna dana*: udaljenost u radnim danima do dana ispod miša. Otpustite.

Ako samo kliknete, bez povlačenja, prekid postaje jedan radni dan. Povlačenjem ulijevo prekid opet postaje kraći, najmanje na jedan radni dan. Za zadatak u satima radi se u satima.

Način ostaje uključen, pa možete podijeliti još zadataka. Zaustavite ga tipkom Esc ili gumbom *Zaustavi* u obavijesti. Ako pritisnete Esc dok povlačite, aplikacija poništava prekid i način se zaustavlja. Svaki potez je jedan korak za *Poništi*.

Nakon podjele vaš raspored više nije ažuran. Pritisnite **Izračunaj** (F5) za konačne datume.

### Povlačenje postojećeg prekida u Gantt prikazu

To radi bez načina podjele, izravno na traci koja ima prekid.

- Povucite dio **nakon** prekida udesno ili ulijevo. Prekid postaje dulji ili kraći, s oznakom *Prekid: 3 radna dana*. Ako ga povučete natrag dok prekid ne bude 0, oznaka prikazuje *Spoji*, a dva dijela opet su jedan.
- Povucite desni rub dijela **prije** prekida. Taj dio postaje dulji ili kraći, s oznakom *Dio: 5 radnih dana*. Trajanje zadatka mijenja se s njim.
- Ako povučete prvi dio, pomičete cijeli zadatak, kao i kod svake trake.

### Podjela i prilagodba u oknu svojstava

Odaberite zadatak. U oknu *Svojstva* odjeljak *Prekidi* nalazi se ispod *Ovisnosti* i iznad *Dodjele*. Ako je potrebno, pomaknite se do njega.

- *Dodaj prekid* stavlja prekid od jednog radnog dana na sredinu najdužeg dijela.
- Svaki prekid ima dva polja: *nakon* (koliko radnih dana rada dolazi prije prekida) i *prekid* (duljina prekida). Uz njih su datumi dijela nakon prekida. Za zadatak u satima prikazuju se sati.
- Ako postavite *prekid* na 0, prekid nestaje. Mala kanta (*Ukloni prekid*) radi isto.

Budite oprezni s poljem *nakon*: to polje produljuje ili skraćuje dio rada prije prekida, a s time i trajanje cijelog zadatka. Kad mijenjate polje *prekid*, mijenja se samo završetak.

### Uklanjanje prekida

Desnom tipkom miša kliknite prekid u Gantt prikazu ili dio nakon njega i odaberite *Ukloni prekid*. *Ukloni sve prekide* nalazi se u izborniku desne tipke miša za svaku traku koja ima prekid. Ili upotrijebite odjeljak *Prekidi* u oknu *Svojstva*, kao gore.

### S AI pomoćnikom

Povezani AI pomoćnik postavlja prekide alatom `planner_set_task_splits`, u istom obliku kao okno: nakon koliko radnih dana (ili radnih sati) rada i koliko radnih dana (ili radnih sati) prekida. Uvijek šalje cijeli popis; prazan popis uklanja sve prekide. Prekide čita natrag alatom `planner_get_task`. Vrijede ista pravila kao dolje: zadatak koji ne možete podijeliti, ne može podijeliti ni pomoćnik. Za razliku od podjele koju sami napravite, aplikacija nakon toga sama ponovno izračunava raspored. Kako povezati pomoćnika, opisano je u [Povezivanje AI pomoćnika (MCP)](docs://howto-ai-assistent-koppelen).

## Zamke i što aplikacija radi

**Ne može se svaki zadatak podijeliti.** Ne možete podijeliti kontrolnu točku, zadatak sažetka, zadatak s uključenim *Hamak (izvedeno trajanje)* (vidi [Izrada hamaka](docs://howto-hammock)), zadatak s vrstom trajanja *Proteklo vrijeme*, zadatak koji je *Ručno planiran*, ili zadatak kraći od dva radna dana. U načinu podjele miš pokazuje zabranjeni pokazivač, a ništa se ne događa. Za takav zadatak odjeljak *Prekidi* u oknu *Svojstva* također nedostaje.

**Na kartici *Tablica* gumb ne radi.** *Podijeli zadatak* je tamo onemogućen, s opisom *Dostupno samo kada je Gantt prikaz vidljiv*. Potez zahtijeva traku. Način podjele i način povezivanja međusobno se isključuju.

**Klik bez učinka.** Prekid ne može početi prvog dana zadatka niti unutar postojećeg prekida. Svaki dio rada mora također ostati najmanje jedan radni dan. Ako kliknete na takvo mjesto, ništa se ne događa, bez poruke.

**Zadatak s napretkom.** Ako zadatak ima napredak, prekid može početi tek nakon rada koji je već završen. Pri 50% od 8 radnih dana to je najranije peti radni dan. Klik u dijelu koji je završen ne čini ništa, a zadatak koji je 100% dovršen više se ne može podijeliti. U oknu je tada *Dodaj prekid* onemogućen: to vrijedi i kad sredina najdužeg dijela pada u završen rad, na primjer pri 75% od 8 radnih dana.

**Uravnoteživanje također stvara prekide.** Prikazuju se u odjeljku *Prekidi* s oznakom *uravnoteživanje*. *Resursi › Uravnoteživanje › Ukloni uravnoteživanje* ih ponovno uklanja. Ako sami uredite prekide takvog zadatka, svi njegovi prekidi uravnoteživanja postaju vaši i *Ukloni uravnoteživanje* ih više ne uklanja.

**Prekidi se ne prenose u MS Project ni Primavera.** Ako izvozite u *MS Project XML* ili *Primavera P6 XML*, taj program poznaje prekid samo kao raspodjelu rada jedne dodjele. Bez takve raspodjele zadatak stiže bez prekida, a aplikacija prijavljuje koliko je takvih zadataka: *1 zadatak s prekidima izvezen je bez prekida: MS Project i P6 poznaju prekide samo kao raspodjelu rada*. U IFC datoteci aplikacije prekidi se čuvaju.

**Datoteka s prekidima koje aplikacija ne može uređivati.** Prekidi iz izvorne datoteke koji ne odgovaraju obliku u aplikaciji u oknu prikazuju poruku *Ovi prekidi dolaze iz izvorne datoteke u obliku koji se ovdje ne može uređivati*, i nude samo *Ukloni sve prekide*.

## Pogledajte također

- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): kako raspored broji u radnim danima i zašto se završetak pomiče.
- [Dodavanje ovisnosti](docs://howto-relaties-leggen): drugi način u Gantt prikazu, koji se koristi povlačenjem trake.
- [Dijaloški okvir zadatka i okno svojstava](docs://ref-taak-eigenschappen): odjeljak *Prekidi* u oknu svojstava.
