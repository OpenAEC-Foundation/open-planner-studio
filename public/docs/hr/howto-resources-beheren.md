# Upravljanje resursima

Cilj: stvoriti, urediti i izbrisati resurse (ljude, strojeve i materijal) u vašem projektu, kako biste ih mogli dodijeliti zadacima.

## Kada je ovo potrebno

Prije nego što zadatku dodijelite zidara ili dizalicu, ta osoba ili stroj mora postojati kao resurs. Resurs bilježi koliko ga ima i na koje dane radi. Aplikacija tako provjerava je li od njega zatraženo previše na jedan dan. Resurs uređujete kada se promijeni sastav osoblja, na primjer kada se pridruži drugi zidar.

Dva pojma. **Maksimalan postotak jedinica** je kapacitet po radnom danu: 1 znači jednu osobu ili jedan stroj, 2 znači dvije od njih. **Dodjela** je resurs na zadatku (vidi [Dodjeljivanje resursa krivuljom](docs://howto-resource-toewijzen)).

## Koraci

### Stvaranje resursa

1. Odaberite *Resursi › Upravljanje › Novi resurs*. Okno resursa preuzima radni prostor, a na dnu tablice pojavljuje se prazan redak. Okno možete otvoriti i pomoću *Resursi › Upravljanje › Resursi* pa zatim odabrati *Novi resurs u projektu*.
2. Upišite naziv, na primjer *Bricklayer*.
3. U polju *Vrsta* odaberite vrijednost: *Radna snaga* (zadano), *Oprema*, *Materijal*, *Podizvođač* ili *Ekipa*.
4. Po potrebi ispunite ostala polja. Sve ima zadanu vrijednost: *Maksimalan postotak jedinica* je 1, a *Kalendar* je *Kalendar projekta*. *Standardna tarifa/sat* je prazna. Polje *Jedinica mjere* možete ispuniti samo za vrstu *Materijal*, na primjer m³.
5. Pritisnite Enter ili kliknite izvan retka. Resurs je u tablici. Pritiskom na Enter se odmah ispod njega otvara prazan redak za sljedeći resurs. Kada završite, pritisnite Esc.

Redak postaje resurs tek kada ima naziv. Pritiskom na Esc ili klikom izvan retka bez naziva aplikacija ne stvara ništa. Redoslijed unosa nije važan: vrstu možete odabrati prije nego što upišete naziv.

### Uređivanje resursa

Uredite polja u retku. Aplikacija sprema naziv, tarifu i jedinicu kada napustite polje, a ostala polja odmah.

- Aplikacija prihvaća *Maksimalan postotak jedinica* samo ako je vrijednost veća od 0. Kod 0 ili manje polje dobije crveni okvir i vraća se na prethodnu vrijednost.
- *Kalendar* određuje na koje dane resurs radi. Odaberite *Kalendar projekta* ili vlastiti kalendar. Pomoću *+ Kalendar resursa* stvarate novi, a olovka (*Uredi…*) otvara odabrani kalendar. Ako zadatak radi na dan kada resurs prema svom kalendaru ne radi, taj se dan računa kao preopterećenje resursa. Kako stvoriti kalendar resursa, opisano je u [Postavljanje kalendara resursa](docs://howto-resourcekalender-instellen).
- *Standardna tarifa/sat* i *Ukupno*: *Ukupno* je umnožak opterećenih sati tog resursa i standardne tarife. Gipsar s opterećenjem od 32 sata i tarifom od 50 po satu iznosi 1.600,00. Na dnu tablice nalazi se zbroj svih resursa.
- *Ekipa* grupira resurs pod resursom vrste *Ekipa*. To je samo grupiranje: aplikacija ne zbraja kapacitet ni opterećenje članova u ekipu.
- Obojeni kvadratić s lijeve strane prikazuje boju resursa. Služi samo za prikaz i nema utjecaja na raspored.

### Kapacitet koji se mijenja tijekom vremena

Dolazi li vaš drugi zidar tek 19. srpnja? Kliknite strelicu uz *Maksimalan postotak jedinica*. Pod *Kapacitet po vremenskim fazama* odaberite *Dodaj korak*. Svaki korak ima datum (*Od*) i broj (*Maksimalan postotak jedinica*). Od tog datuma vrijedi taj broj. Bez koraka uvijek vrijedi stalna vrijednost, dakle ista vrijednost za cijelo razdoblje.

Novi korak počinje s današnjim datumom i 1 jedinicom. Promijenite oboje, jer se inače kapacitet 1 primjenjuje od danas.

### Brisanje resursa

1. Kliknite kantu za smeće u retku.
2. Ako resurs ima dodjele, aplikacija traži potvrdu, na primjer *'Bricklayer' ima dodjele (ukupno: 4). Izbrisati?* Kliknite kvačicu za brisanje ili križić za odustajanje. Bez dodjela resurs odmah nestaje.

Aplikacija briše i dodjele tog resursa. Ako zadatak ima pravilo rada osim *Fiksno trajanje i fiksne jedinice*, aplikacija rad uklonjenog resursa raspodjeljuje među resursima koji ostaju. Ovisno o pravilu, to mijenja njihove jedinice ili trajanje zadatka. Ako se trajanje promijeni, raspored više nije ažuran.

Stvaranje, uređivanje i brisanje možete poništiti pomoću *Poništi* (Ctrl+Z).

### Mali pregled u bočnoj traci

*Resursi › Upravljanje › Usidrenje resursa* prikazuje kompaktan pregled u desnoj bočnoj traci, uz *Svojstva*. Tamo vidite naziv i boju svakog resursa, a uz resurs koji je preopterećen upozoravajući znak (*Preopterećenje resursa*). Tamo možete mijenjati samo *Maksimalan postotak jedinica*. Ako odaberete jedan ili više zadataka, pregled prikazuje samo resurse tih zadataka.

## Zamke i što tada radi aplikacija

**Samo vrsta *Materijal* utječe na izračun.** Radna snaga, Oprema, Podizvođač i Ekipa obrađuju se jednako. Materijal se ne uračunava u trajanje zadatka i ne izravnava se. U histogramu redak *Svi resursi* ne računa ni materijal.

**Bez naziva nema resursa.** Prazan redak nestaje bez traga.

**Novi korak u kapacitetu.** Ako zaboravite promijeniti datum i broj, kapacitet je 1 od danas.

**Uklanjanje resursa koji vam još treba.** Ako ga slučajno izbrišete, odmah pritisnite Ctrl+Z. Dodjele se također vraćaju.

## Vidi također

- [Dodjeljivanje resursa krivuljom](docs://howto-resource-toewijzen): stavljanje resursa na zadatak.
- [Postavljanje kalendara resursa](docs://howto-resourcekalender-instellen): određivanje radnih dana jednog resursa.
- [Rješavanje preopterećenja resursa](docs://howto-overbezetting-oplossen): što učiniti kada resurs na jedan dan ima previše posla.
- [Okno resursa](docs://ref-resourcepaneel): sva polja i gumbi okna resursa.
