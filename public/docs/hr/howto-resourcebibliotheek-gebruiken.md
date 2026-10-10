# Korištenje biblioteke resursa

Cilj: koristite resurse iz biblioteke resursa u svom projektu i resurs koji ste napravili u projektu prebacite u biblioteku, da svi projekti koriste iste podatke.

## Kada vam ovo treba

Imate stalnu ekipu zidara, dizalicu i žbukara koji se pojavljuju u više projekata. Bez biblioteke ih unosite iznova u svakom projektu, uz rizik različitih naziva i standardnih tarifa, i nijedan projekt ne vidi da i drugi traži istu ekipu. U biblioteci ih zabilježite jednom.

Što je biblioteka i što projekt preuzima iz nje, pročitajte u [Biblioteka resursa](docs://uitleg-resourcebibliotheek). Ovaj članak govori o radnjama. Stvaranje, izvoz i brisanje biblioteka opisani su u [Upravljanje bibliotekama resursa i njihovo dijeljenje](docs://howto-bibliotheken-beheren).

## Koraci

### 1. Povežite projekt s bibliotekom

S bibliotekom radite samo ako je projekt povezan s njom. Ako projekt nije povezan, okno *Resursi* ne prikazuje preklopnik *Biblioteka*, *Projekt* i *Zauzetost*.

Za novi projekt:

1. Odaberite *Datoteka › Novo*. Otvara se prozor *Novi projekt*.
2. Pogledajte *Biblioteka resursa*. Polje je postavljeno na zadanu biblioteku. Možete odabrati drugu, *bez biblioteke (samostalan projekt)* ili *+ Nova biblioteka resursa…*.
3. Kliknite *Stvori*.

Za postojeći projekt:

1. Odaberite *Datoteka › Podaci o projektu*.
2. U polju *Biblioteka resursa* odaberite biblioteku.
3. Kliknite *Primijeni*. Dotad na dnu piše *Promjene nisu primijenjene — kliknite Primijeni da ih zadržite.*

Ako projekt već ima resurse s istim nazivom kao stavka u biblioteci, otvara se prozor *Poveži biblioteku resursa* s odjeljkom *Prepoznato*. Svaki resurs s podudaranjem ima oznaku *Prijedlog: Bricklayer*. Kliknite *Poveži* da povežete taj resurs, ili *Poveži sve prijedloge* ako ima više prijedloga. Aplikacija uspoređuje nazive bez obzira na velika slova ili dvostruke razmake. Pri povezivanju resurs preuzima naziv, vrstu, standardnu tarifu, jedinicu i opis iz stavke u biblioteci. *Maksimalan postotak jedinica* ostaje onakav kakav je bio u projektu. Prozor također prikazuje kalendare projekta koji imaju isti naziv kao kalendar u biblioteci. S *Odluči kasnije* zatvarate prozor bez povezivanja.

### 2. Stavite resurs u biblioteku

1. Odaberite *Resursi › Upravljanje › Resursi*. Okno resursa preuzima cijeli radni prostor. Uvijek se otvara u prikazu *Projekt*, i za povezan projekt.
2. Gore desno odaberite *Biblioteka*. Iznad tablice piše *Ovo uređuje biblioteku i vrijedi za sve projekte. Ovo se ne može poništiti.*
3. Kliknite *Novi resurs u biblioteci*. Na dnu tablice pojavljuje se prazan redak.
4. Upišite naziv, na primjer *Bricklayer*, i pritisnite Enter. Resurs je sada u biblioteci i odmah se otvara prazan redak za sljedeći. Kada ste gotovi, pritisnite Esc. Bez naziva aplikacija ne stvara ništa.
5. Ispunite ostatak retka. *Vrsta* je zadana: *Radna snaga*. U polju *Maksimalan postotak jedinica* unesite koliko ovog resursa ima ukupno, na primjer 3 za tri zidara. Pregled zauzetosti koristi taj broj kao kapacitet. *Standardna tarifa/sat* je neobavezna. U polju *Jedinica mjere* možete unijeti vrijednost samo za vrstu *Materijal*. U polju *Kalendar* odaberete kalendar iz biblioteke ili *+ Kalendar resursa* da napravite novi; vidi [Postavljanje kalendara resursa](docs://howto-resourcekalender-instellen). Aplikacija sprema naziv, standardnu tarifu i jedinicu kada napustite polje, a ostala polja odmah.

Svaka promjena u biblioteci odmah se prenosi na nepromijenjene kopije u vašim otvorenim projektima.

### 3. Dodijelite resurs svom projektu

1. U prikazu *Biblioteka* odaberite *Dodijeli projektu* na resursu. Iznad tablice piše *Dodano.* Ako kliknete ponovno, piše *Već je u projektu.* i ne pojavljuje se druga kopija.
2. Odaberite *Projekt*. Kopija je u tablici s malom ikonom biblioteke uz naziv, s oznakom *Iz biblioteke*. Naziv, vrsta, standardna tarifa i jedinica mjere su običan tekst. Ako zadržite miš iznad njih, vidite *Vrijednost iz biblioteke — uredite je u prikazu Biblioteka ili odvojite ovaj resurs od biblioteke.*
3. Postavite *Maksimalan postotak jedinica* za ovaj projekt. Polje na početku ima vrijednost iz biblioteke i u projektu ga možete uređivati.
4. Sada dodijelite resurs zadacima kao i svaki drugi resurs; vidi [Dodjela resursa s krivuljom](docs://howto-resource-toewijzen). *Resursi › Dodjela › Dodijeli* prikazuje samo resurse koji su već u projektu, zato prvo resurs iz biblioteke dodijelite projektu na ovaj način.

*Dodijeli projektu* postoji samo u prikazu *Biblioteka* projekta koji je povezan s tom bibliotekom.

### 4. Prenesite resurs iz projekta u biblioteku

To radite za resurs koji ste napravili u projektu i češće ga koristite, na primjer unajmljenu dizalicu.

1. U prikazu *Projekt* odaberite *Prebaci u biblioteku* na resursu. Gumb se pojavljuje samo kod resursa koji ima naziv i još ne dolazi iz biblioteke, u povezanom projektu.
2. Pročitajte poruku iznad tablice.

Poruka može reći tri stvari:

- *Dodano.* Biblioteka nije imala stavku s tim nazivom. Napravljena je nova stavka i vaš je resurs povezan s njom.
- *Već postoji u biblioteci. Sada je povezano.* Postojala je stavka s istim nazivom i istim podacima. Vaš je resurs povezan s njom.
- *Povezano s postojećom stavkom biblioteke. Vrijednosti se razlikuju, pogledajte oznaku.* Postojala je stavka s istim nazivom, ali drugačijim podacima. Vaš je resurs povezan i odmah dobiva oznaku *odstupa — odlučite*. Nastavite s korakom 6.

### 5. Odvojite kopiju

Ako želite odstupiti od biblioteke u jednom projektu, na primjer s drugom standardnom tarifom, odvojite kopiju.

1. U prikazu *Projekt* kliknite ikonu *Odvoji od biblioteke* na kraju retka.
2. Resurs je sada običan resurs projekta. Sva polja se mogu uređivati i više ne prati biblioteku. Kalendar koji je došao uz resurs također se odvaja, osim ako ga u ovom projektu i dalje prati drugi resurs.

S *Poništi* (Ctrl+Z) poništavate odvajanje.

### 6. Riješite odstupanje

Kopija s oznakom *odstupa — odlučite* razlikuje se od stavke u biblioteci. Aplikacija ne odlučuje koja je vrijednost ispravna.

1. Kliknite oznaku *odstupa — odlučite* na resursu. Otvara se prozor *Poveži biblioteku resursa*. Otvara se i sam kada otvorite datoteku s takvom kopijom.
2. U odjeljku *Odstupanja* odaberite što želite za tu stavku, vidi u nastavku.
3. Kliknite *Odluči kasnije* ako još ne želite birati. Prozor se zatvara, a oznaka ostaje.

Za odstupanje imate dva izbora:

- *Uzmi iz biblioteke*: kopija dobiva podatke iz biblioteke.
- *Preuzmi vrijednosti iz datoteke u biblioteku*: biblioteka dobiva podatke iz vaše kopije. Ispod toga piše *Pozor: ovo mijenja biblioteku i vrijedi za sve vaše projekte.* Kopije u drugim otvorenim projektima slijede promjenu.

## Zamke i što aplikacija tada radi

**Primjeri projekata imaju vlastitu biblioteku.** Ako otvorite jedan od tri primjera (*Datoteka › Primjeri*, ili preko poveznice u Pomoći), aplikacija jednom stvara biblioteku *Demo resource library* i povezuje projekt s njom. Resursi projekta s istim nazivom kao stavka u biblioteci odmah se povezuju; kalendari se ne povezuju. Vaše vlastite biblioteke ostaju netaknute. Ako otvorite dva primjera jedan do drugoga, zajedno pokazuju sukobe u [Korištenje pregleda zauzetosti](docs://howto-bezettingsoverzicht-gebruiken), na primjer za ekipu zidara (*Masonry crew*) između *Refurbishment & Extension of a Family Home* i *6 New Terraced Houses, De Akkers*.

**Ne vidite preklopnik.** Projekt nije povezan s bibliotekom. Izvedite korak 1.

**Slučajno uredite biblioteku.** Okno se uvijek otvara na *Projekt* da to spriječi. Promjene u prikazu *Biblioteka* vrijede za sve projekte i nisu obuhvaćene funkcijom *Poništi*.

**Izbrišete resurs iz biblioteke.** Aplikacija prvo pita *Želite li ukloniti 'Bricklayer' iz biblioteke? Ovo vrijedi za sve projekte i ne može se poništiti.* Kopije u vašim projektima ostaju i dalje rade. Dobivaju oznaku *više nije u biblioteci* i potpuno se mogu uređivati. S *Ukloni iz projekta* kopiju uklanjate iz projekta.

**U polju *Biblioteka resursa* odaberete drugu biblioteku ili *bez biblioteke (samostalan projekt)*.** Oznake porijekla iz prethodne biblioteke nestaju. Resursi ostaju u projektu kao obični resursi projekta. S drugom bibliotekom aplikacija ponovno traži resurse s istim nazivom.

**Resurs nema prijedlog u *Prepoznato*.** Piše *Nema prijedloga — odaberite ručno*, ali ovaj prozor za to nema gumb. To izgleda kao nedostatak. Stavite takav resurs u biblioteku s *Prebaci u biblioteku* (korak 4).

## Vidi također

- [Biblioteka resursa](docs://uitleg-resourcebibliotheek): što odlučuje biblioteka, što odlučuje projekt i kako kopije slijede promjene.
- [Upravljanje bibliotekama resursa i njihovo dijeljenje](docs://howto-bibliotheken-beheren): stvaranje, izvoz i uvoz biblioteka.
- [Korištenje pregleda zauzetosti](docs://howto-bezettingsoverzicht-gebruiken): provjera traže li dva projekta isti resurs u isto vrijeme.
- [Upravljanje resursima](docs://howto-resources-beheren): resursi jednog projekta.
