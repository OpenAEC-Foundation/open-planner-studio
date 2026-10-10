# Dodavanje ovisnosti

Cilj: povezati zadatke tako da zadatak počinje tek kad je posao prije njega završen, te dodati vrijeme odgode između njih tamo gdje je potrebno.

## Kada je to potrebno

Bez ovisnosti aplikacija ne zna da zidar može početi tek kad je temelj izliven. Svaki zadatak tada počinje na datumu početka projekta, pa datum završetka ne znači ništa. **Ovisnost** bilježi taj redoslijed. Prvi zadatak je **prethodnik**, a drugi **nasljednik**.

Ovisnosti dodajete kad sastavljate raspored, kad dodate zadatak ili kad se naknadno pokaže da dva posla ipak ovise jedan o drugome. **Vrijeme odgode** je čekanje između dvaju zadataka, na primjer beton koji mora otvrdnuti ili estrih koji se mora osušiti.

Zadana ovisnost je **FS** (završetak-početak): nasljednik može početi tek kad je prethodnik završen. Aplikacija poznaje i SS, FF i SF, koje vežu početak ili završetak uz početak ili završetak. Na primjer, uz SS (početak-početak) žbukanje može početi tek kad su počele instalacije.

Niste sigurni koja vrsta vam treba? Ispod izbora vrste nalazi se rečenica sa stvarnim nazivima zadataka. Ona to objašnjava, na primjer: *Metselwerk može početi tek kad Fundering završi.* Odaberete li drugu vrstu, rečenica se mijenja. Vidite je u prozoru *Vrsta ovisnosti*, u bloku *Ovisnosti* i u stupcu *Prethodnici* ili *Nasljednici*.

## Koraci

Postoje četiri načina za dodavanje ovisnosti. Svi stvaraju istu ovisnost. Odaberite način koji vam najbolje odgovara.

### Povezivanje dvaju odabranih zadataka

Korisno kad radite u tablici zadataka.

1. U tablici zadataka kliknite zadatak koji dolazi prvi: prethodnik.
2. Držite tipku Ctrl (⌘ na Macu) i kliknite zadatak koji dolazi poslije: nasljednik.
3. Odaberite *Početna › Zadaci › Poveži ▾ › Poveži odabrane zadatke*. Isti gumb nalazi se i na *Raspored › Ovisnosti*.

Aplikacija stvara ovisnost završetak-početak bez vremena odgode i javlja, na primjer: *Ovisnost je stvorena: Foundation brickwork → Lay hollow-core floor*. Gumb radi samo s točno dva odabrana zadatka.

### Crtanje ovisnosti u Gantt-prikazu

Korisno kad dodajete mnogo ovisnosti jednu za drugom.

1. Odaberite *Početna › Zadaci › Poveži ▾ › Nacrtaj ovisnost*. Iznad rasporeda pojavljuje se obavijest *Način ovisnosti: povucite od jedne trake do druge u Gantt-prikazu da biste stvorili ovisnost. Pritisnite Esc za zaustavljanje.*
2. Pritisnite traku prethodnika i povucite do trake nasljednika. Isprekidana crta sa strelicom prati pokazivač.
3. Otpustite. Pojavljuje se mali prozor *Vrsta ovisnosti* s vrstom (zadano je FS) i poljem za vrijeme odgode.
4. Po potrebi promijenite vrstu ili vrijeme odgode i pritisnite Enter ili kliknite izvan prozora. Ovisnost je stvorena.
5. Odmah dodajte sljedeću: način ostaje uključen. Zaustavite ga tipkom Esc, gumbom *Zaustavi* u obavijesti ili ponovnim odabirom *Nacrtaj ovisnost*.

Ako pritisnete Esc u prozoru *Vrsta ovisnosti*, ništa se ne spremi. Za jednu ovisnost ne morate uključiti način: držite Shift dok povlačite od trake do trake. *Započni ovisnost ovdje* u izborniku koji se otvara desnim klikom na traku uključuje način ovisnosti; povlačenje i dalje radite sami. Na kartici *Tablica*, bez Gantt-prikaza, *Nacrtaj ovisnost* je onemogućeno.

### Dodavanje ovisnosti u oknu svojstava

Korisno kad gledate jedan zadatak i želite dodati njegove prethodnike ili nasljednike.

1. Odaberite zadatak. Okno *Svojstva* nalazi se desno. Ako ga ne vidite, uključite ga putem *Prikaz › Paneli › Svojstva*.
2. U bloku *Ovisnosti* kliknite *Dodaj ovisnost*.
3. Ostavite smjer na *Prethodnik* ako drugi zadatak dolazi prvi, ili odaberite *Nasljednik*.
4. Upišite dio naziva drugog zadatka. Pravi zadatak odaberite strelicama i tipkom Enter ili kliknite na njega.
5. Odaberite vrstu (zadano je FS) i po potrebi upišite vrijeme odgode.
6. Pritisnite Enter ili kliknite kvačicu (*Spremi ovisnost*).

Ovisnosti ovog zadatka tada su navedene u bloku *Ovisnosti*, svaka s WBS brojem drugog zadatka, vrstom i vremenom odgode.

### Upisivanje ovisnosti u stupcu Prethodnici

Korisno kad brzo radite tipkovnicom i znate WBS brojeve.

1. Kliknite **+** desno od zaglavlja tablice zadataka (*Dodaj stupac*) i pod *Ovisnosti* odaberite stupac *Prethodnici*. Stupac *Nasljednici* radi na isti način.
2. U stupcu *Prethodnici* kliknite ćeliju nasljednika.
3. Upišite WBS broj prethodnika, razmak i vrstu, na primjer `2.6 FS`. Odmah iza toga upišite vrijeme odgode: `2.6 FS+1d`. Više prethodnika odvojite točka-zarezom ili zarezom: `3.1 FS; 3.2 SS+2d`.
4. Pritisnite Enter.

Ono što upišete zamijeni cijelu ćeliju. Ako u njoj već ima prethodnika, upišite i njih (vidi zamke). Ako umjesto upisivanja pritisnete Enter ili F2 u ćeliji, otvara se polje koje zadržava postojeće ovisnosti: zadatak tražite po WBS broju ili nazivu, a za svaku ovisnost birate vrstu i vrijeme odgode.

### Postavljanje ili promjena vremena odgode

Vrijeme odgode upisujete u polje pored vrste, na bilo koji od gore navedenih načina. Postojeće vrijeme odgode mijenjate u bloku *Ovisnosti*: kliknite u polje za odgodu, upišite novu vrijednost i pritisnite Enter.

- `3` ili `3d`: 3 radna dana. Vikend se ne računa. Aplikacija prikazuje `+3d`.
- `3ed`: 3 kalendarska dana. Vikend se računa, kao kod betona koji otvrdnjava i u subotu i u nedjelju.
- `-1`: negativno vrijeme odgode, odnosno vrijeme preklapanja. Nasljednik može početi dan ranije, pa se zadaci preklapaju.
- `4h`: 4 radna sata; aplikacija to prikazuje kao `+4u`. Ako je prethodnik zadatak u danima u kalendaru bez vlastitih blokova radnog vremena, na primjer standardni kalendar, aplikacija to pretvara u cijele radne dane, zaokruženo na najbliži cijeli dan: `4h` tada djeluje kao 1 dan, a `2h` kao 0. U kalendaru s vlastitim blokovima radnog vremena, ili nakon zadatka u satima, odgoda se računa točno u satima.
- `50%`: polovina trajanja prethodnika.

Primjer: beton temelja mora otvrdnuti prije nego zidar može raditi na njemu, pa *Pour foundation → Foundation brickwork* dobiva FS ovisnost s vremenom odgode `3`. Ako je ulijevanje u petak, 18. lipnja 2027., zidanje počinje nakon **Izračunaj** u četvrtak, 24. lipnja: od ponedjeljka do srijede je vrijeme čekanja. Uz `3ed` vikend se računa i zidanje počinje u utorak, 22. lipnja.

### Na kraju: ponovno izračunavanje

Nova ovisnost još ne pomiče nijednu traku. Traka stanja prikazuje *Zastarjelo — ponovno izračunajte (F5)*. Pritisnite **Izračunaj** (F5), na primjer kroz *Početna › Raspored › Izračunaj*. Tek tada nasljednici dobivaju nove datume. Želite li da to aplikacija radi sama, uključite *Automatsko izračunavanje* pod *Postavke › Projekt › Postavke*, na kartici *Raspored*.

## Zamke i što aplikacija radi

**Obrnuti redoslijed.** Kod *Poveži odabrane zadatke* važan je redoslijed klikanja, a ne redoslijed na popisu. Ako prvo kliknete kasniji zadatak, ovisnost je obrnuta. Obrišite je u bloku *Ovisnosti* ikonom koša i dodajte ponovno.

**Upisivanje u stupac briše ono što je bilo.** Ako ćelija sadrži `3.4 FS; 3.2 FS` i upišete samo `3.2 FS`, ovisnost s 3.4 nestaje bez poruke. Upišite sve prethodnike, upotrijebite Enter ili F2 za dodavanje ili poništite radnju pomoću Ctrl+Z.

**Ciklus.** Ako dodate ovisnost koja vodi natrag do zadatka ranije u lancu, raspored nikad ne bi mogao početi. Aplikacija takvu ovisnost odbija: *Ova ovisnost bi stvorila ciklus u rasporedu (…) i nije stvorena*, sa zadacima ciklusa u zagradama. Prvo obrišite ovisnost koja zatvara ciklus.

**Zadatak i njegov zadatak sažetka.** Ovisnost između zadatka i zadatka sažetka u kojem se nalazi nije moguća. Aplikacija kaže: *Ovisnost između zadatka i njegovog vlastitog (pra)nadređenog zadatka sažetka nije dopuštena.*

**Duplikat.** Ako ovisnost već postoji, aplikacija kaže *Ta ovisnost već postoji* i ništa se ne mijenja.

**Kraće poruke u stupcu.** Stupac *Prethodnici* daje ista odbijanja, s kraćim tekstom pod ćelijom: *Ova promjena stvorila bi ciklus u rasporedu.*, *Ova ovisnost već postoji.* ili *Zadatak ne može imati ovisnost sa svojim zadatkom sažetka.* Ako upišete samo WBS broj, na primjer `3.1`, vrsta nedostaje i ćelija kaže *Upotrijebite na primjer 1.2 FS+2d.* Ćelija ostaje otvorena. Ispravite unos ili pritisnite Esc za otkazivanje.

**Nema polovičnih dana odgode.** Vrijeme odgode u danima uvijek je cijeli broj: `1.5` postaje `+2d`. Odgoda u satima nakon zadatka u danima u kalendaru bez vlastitih blokova radnog vremena zaokružuje se na cijele radne dane. Nečitljiv unos, na primjer riječ, ne sprema se: polje se vraća na prethodnu vrijednost.

## Vidi također

- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): što aplikacija izračunava iz vaših ovisnosti i zašto zadatak postaje kritičan.
- [Ovisnosti i vrijeme odgode](docs://uitleg-relaties): što četiri vrste ovisnosti i vrijeme odgode rade s datumima.
- [Praćenje puta](docs://howto-pad-traceren): prikazivanje lanca prethodnika i nasljednika na ekranu.
- [Dijalog zadatka i okno svojstava](docs://ref-taak-eigenschappen): polja za ovisnosti i vrijeme odgode u oknu i u dijalogu.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): lanac ovisnosti završetak-početak s jednom ovisnošću početak-početak (zidovi i krov, vrijeme odgode 2 dana) i jednom ovisnošću završetak-završetak (pločice i bojanje, vrijeme odgode 1 dan).
