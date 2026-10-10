# Izrada i dodjela kalendara

Cilj: napraviti vlastiti kalendar, na primjer šesterodnevni radni tjedan, i dodijeliti ga zadacima koji se moraju izračunati u njemu.

## Kada vam ovo treba

Podizvođač radi i subotom. Ekipa radi samo od ponedjeljka do četvrtka. Zadatak pada u razdoblje u kojem samo taj zadatak miruje. Kalendar projekta tada ima pogrešne radne dane. S vlastitim kalendarom aplikacija izračunava te zadatke na pravim danima, a ostali ostaju na kalendaru projekta. Što aplikacija točno radi s kalendarom, možete pročitati u [Kalendari i radni dani](docs://uitleg-kalenders).

## Koraci

### Izrada kalendara

1. Odaberite *Raspored › Kalendar › Kalendar*. Isti gumb je i u *Postavke › Kalendar › Kalendar*. Otvara se prozor *Kalendari*. Lijevo su kalendari projekta; kalendar projekta ima zvjezdicu.
2. Ispod popisa kliknite gumb sa znakom plus (*Novi kalendar*). Novi kalendar je kopija standardnog: od ponedjeljka do petka, od 07:00 do 16:00, s pauzom od sat vremena i, ako je *Građevinski način rada* uključen, nizozemskim državnim praznicima. Ako želite postojeći kalendar kao osnovu, odaberite ga na popisu i ispod popisa kliknite gumb s dva lista (*Dupliciraj*).
3. Ispod *Naziv* upišite naziv koji kaže tko koristi kalendar, na primjer *Six-day week*.
4. Ispod *Radni dani* kliknite dane u tjednu da ih uključite ili isključite. *Pon–pet* vraća standardni tjedan, od 07:00 do 16:00. *Kontinuirano (24/7)* uključuje svih sedam dana, od 00:00 do 24:00.
5. Po potrebi prilagodite radno vrijeme: *Početak (sat)*, *Završetak (sat)*, *Početak pauze* i *Trajanje pauze (minute)*. Vrijeme upisujete u obliku HH:MM; strelicama ga povećavate ili smanjujete za četvrt sata. Ako postavite trajanje pauze na 0, kalendar radi bez pauze. *Neto sati po danu* aplikacija izračunava sama. Ako je planiranje u satima uključeno i kalendar ima blokove radnog vremena po danu u tjednu, ta polja ne vidite; pogledajte [Postavljanje radnog vremena](docs://howto-werktijden-instellen).
6. Po potrebi prilagodite praznike. Kako to funkcionira, opisano je u [Generiranje praznika i kolektivnog godišnjeg odmora u građevinarstvu](docs://howto-feestdagen-genereren).
7. Kliknite *Primijeni*. Aplikacija odmah ponovno izračunava raspored i zatvara prozor. Pomoću *Odustani* odbacujete promjene. Tipka Enter u polju za unos privremeno sprema promjenu i ponovno izračunava raspored, bez zatvaranja prozora; *Odustani* tada poništava samo promjene nakon toga.

### Dodjela kalendara zadacima

Novi kalendar djeluje tek kad ga zadatak upotrijebi. Postoje dva načina.

**Preko okna *Svojstva***

1. Odaberite zadatak. Ako ne vidite okno *Svojstva*, uključite ga pomoću *Prikaz › Paneli › Svojstva*.
2. U odjeljku *Zadatak* odaberite kalendar na popisu *Kalendar*. Prvi izbor, *Kalendar projekta* s nazivom iza njega, znači da zadatak nema vlastiti kalendar.

**Preko izbornika desne tipke miša**

1. Desnom tipkom miša kliknite zadatak, u tablici zadataka ili na traku u dijagramu Gantt.
2. Odaberite *Dodijeli kalendar*, zatim kalendar, ili *Kalendar projekta* da opet uklonite vlastiti kalendar zadatka. Kalendar koji se sada primjenjuje ima kvačicu.
3. Ako želite jedan kalendar dodijeliti većem broju zadataka odjednom, najprije ih odaberite s Ctrl (⌘ na Macu) i desnom tipkom miša kliknite jedan od odabranih zadataka. Izbor se primjenjuje na sve odabrane zadatke. Ako desnom tipkom miša kliknete zadatak koji nije odabran, primjenjuje se samo na taj zadatak.

Novi izbor kalendara još ne čini raspored ažurnim: traka stanja prikazuje *Zastarjelo — ponovno izračunajte (F5)*. Pritisnite **Izračunaj** (F5), na primjer putem *Početna › Raspored › Izračunaj*. Ako je *Automatsko izračunavanje* uključeno (*Postavke › Projekt › Postavke*, kartica *Raspored*, naslov *Izračunavanje*), aplikacija to radi sama.

### Promjena kalendara projekta

1. Otvorite *Raspored › Kalendar › Kalendar* i odaberite kalendar na popisu.
2. Iznad obrasca kliknite *Postavi kao zadani za projekt*. Zvjezdica prelazi na taj kalendar.
3. Kliknite *Primijeni*.

Samo zadaci bez vlastitog kalendara prelaze na novi.

### Brisanje kalendara

1. Otvorite prozor *Kalendari* i odaberite kalendar na popisu.
2. Ispod popisa kliknite gumb s kantom za smeće (*Izbriši*). Taj je gumb onemogućen dok postoji samo jedan kalendar.
3. Kliknite *Primijeni*. Zadaci i resursi koji su koristili taj kalendar vraćaju se na kalendar projekta. Ako izbrišete sam kalendar projekta, prvi kalendar na popisu postaje kalendar projekta.

## Zamke i što tada aplikacija radi

**Nema radnih dana.** Ako isključite sve dane u tjednu, aplikacija ne može izračunati raspored. Pri izračunavanju prijavljuje *Kalendar nema postavljene radne dane*.

**Neispravan unos.** Pauza izvan radnog dana, početak nakon završetka ili praznik s netočnim datumom dobije crvenu poruku uz polje, a *Primijeni* je onemogućen dok to ne ispravite. Za neispravnu pauzu ili praznik uz kalendar na popisu prikazuje se i znak upozorenja (*Ovaj kalendar sadrži neispravan unos*).

**Kalendar na fazi.** Faza se uvijek izračunava na kalendaru projekta, jer njezino trajanje proizlazi iz njezinih zadataka. Kalendar dodijelite samim zadacima.

**Isti kalendar, dva izbora.** Na popisu se kalendar projekta pojavljuje dvaput: kao *Kalendar projekta: naziv* i kao običan kalendar s tim nazivom. Ako odaberete drugi, to je zaseban izbor za taj zadatak. Zadatak tada ne prati kad kasnije odaberete drugi kalendar projekta.

**Različiti sati po danu.** Ako promijenite radno vrijeme ili pauzu tako da se *Neto sati po danu* kalendara promijene, zadatak u danima i dalje broji isti broj dana. Za zadatak s resursima i pravilom rada *Fiksni rad* ili *Fiksne jedinice* trajanje se s tim mijenja, jer rad ostaje isti. Četrdeset sati rada iznosi 5 dana uz 8 sati dnevno, a 7 dana uz 6 sati dnevno. Aplikacija prijavljuje koliko je zadataka dobilo drugo trajanje.

## Vidi također

- [Kalendari i radni dani](docs://uitleg-kalenders): kako aplikacija broji radne dane i koji kalendar ima prednost.
- [Dani i sati](docs://uitleg-dagen-en-uren): što rade neto sati po danu.
- [Postavljanje kalendara resursa](docs://howto-resourcekalender-instellen): kalendar za resurs umjesto za zadatak.
- [Prozori kalendara](docs://ref-kalenders): sva polja prozora kalendara.
