# Uključivanje planiranja u satima

Cilj: planirati zadatke u radnim satima, uz zadatke u danima.

## Kada vam ovo treba

Dizalicu iznajmljujete po satu, a ne po danu. Betoniranje u trajanju od šest sati ne stane u cijeli radni dan. Noćna ekipa radi u drugo vrijeme nego dnevna ekipa. Za takav posao želite trajanje u satima te početak i završetak s točnim vremenom. Ovo također uključujete ako otvorite datoteku, a aplikacija javlja *Ova datoteka sadrži planiranje u satima.* Zašto aplikacija dane i sate računa različito, možete pročitati u [Dani i sati](docs://uitleg-dagen-en-uren).

## Koraci

### Omogućivanje planiranja u satima

1. Odaberite *Postavke › Projekt › Postavke aplikacije* i otvorite karticu *Raspored*.
2. U odjeljku *Planiranje u satima* označite *Uključi planiranje u satima*. To radi odmah. U poruci *Ova datoteka sadrži planiranje u satima.* gumb *Uključi planiranje u satima* radi isto.
3. Ispod toga je *Dopusti mješoviti raspored po danima i satima*, po zadanom uključeno. S tom postavkom birate za svaki zadatak hoće li se računati u danima ili satima. Ako to isključite, popis *Jedinica trajanja* nestaje. Trajanje i dalje možete upisati s jedinicom, na primjer `12h`.

To mijenja više od trajanja zadatka. Pod *Prikaz › Vremenska skala* možete odabrati skalu *Sat*. U prozoru *Kalendari* običan kalendar može dobiti blok *Radno vrijeme* (kalendar koji već ima blokove uvijek ga prikazuje). U prozoru *Novi projekt* pojavljuju se mogućnosti *Smjena* i *Zadana jedinica za nove zadatke*.

### Planiranje zadatka u satima

1. Odaberite zadatak i u panelu *Svojstva*, u odjeljku *Vrijeme*, pogledajte polje *Trajanje*.
2. Upišite trajanje s jedinicom i pritisnite Enter: `12h` (`12u`, nizozemska kratica, također radi) za dvanaest sati, `1h 30m` za sat i pol. `1.5h` je također u redu. Broj bez jedinice vrijedi u jedinici koju zadatak već ima.
3. Ako želite pretvoriti postojeći zadatak, odaberite jedinicu *Sati* na popisu *Jedinica trajanja*. Aplikacija odmah pretvara trajanje, na primjer iz `2` dana u `16` sati. Ako se želite vratiti, upotrijebite *Poništi*.
4. Natrag na dane možete prijeći pomoću `2d` ili jedinice *Dani*.
5. Pritisnite **Izračunaj** (F5), na primjer preko *Početna › Raspored › Izračunaj*. Zadatak sada ima početak i završetak s točnim vremenom.
6. Ako želite vidjeti sate u Gantt prikazu, odaberite skalu *Sat* u popisu pod *Prikaz › Vremenska skala*.

### Novi zadaci u satima prema zadanom

1. Odaberite *Postavke › Projekt › Postavke projekta*.
2. U odjeljku *Zadana jedinica za nove zadatke* odaberite jedinicu *Sati* i kliknite *Primijeni*.

Novi zadatak tada počinje s 5 sati umjesto 5 dana. Postojeći zadaci se ne mijenjaju. Kod novog projekta isti izbor nalazi se u prozoru *Novi projekt*. Ako tamo u odjeljku *Smjena* odaberete *Dnevna smjena*, *Sati* su onemogućeni. Odaberite drugu smjenu ili zadanu jedinicu postavite nakon stvaranja u prozoru *Postavke projekta*.

## Zamke i što aplikacija tada radi

**Nema ispravnog radnog vremena.** Ako kalendar zadatka nema upotrebljivog radnog vremena, aplikacija javlja *Ovaj kalendar nema ispravna radna vremena. Provjerite radne dane i radno vrijeme.* Pri izračunavanju se može pojaviti poruka *Zadatak u satima 'name' nema valjanih radnih sati u svom kalendaru*.

**Nema decimala uz dane.** Trajanje u danima je cijeli broj. `1.5d` javlja poruku *Unesite cijeli broj dana ili sati, na primjer 2d ili 12h.* Ako želite dan i pol, izračunajte u satima.

**Pretvorba koja ne može biti točna.** Dvanaest sati ne stane u cijele dane od 8 sati. U panelu *Svojstva* i u prozoru *Uredi zadatak* aplikacija tada prikazuje žuti okvir s porukom *12h ne odgovara cijelim danima u ovom kalendaru. Jedinica nije promijenjena.* i ostavlja jedinicu. Tablica zadataka prikazuje kraću poruku: *Ovo trajanje ne može se točno pretvoriti u drugu jedinicu.*

**Polje je onemogućeno.** Za fazu, hamak ili kontrolnu točku s nultim trajanjem trajanje proizlazi iz nečeg drugog i ne možete ga upisati.

**Isključivanje planiranja u satima.** Zadaci u satima ostaju, a aplikacija ih i dalje izračunava. Njihovo trajanje tada se ne može uređivati. Polje prikazuje *Uključite planiranje u satima da biste uredili ovaj zadatak u satima.* uz gumb za ponovno uključivanje.

## Vidi također

- [Dani i sati](docs://uitleg-dagen-en-uren): kako aplikacija broji sate, što se događa kad se dani i sati susretnu i gdje zaokružuje.
- [Postavljanje radnog vremena](docs://howto-werktijden-instellen): vremena kalendara po danu u tjednu.
- [Dodavanje ovisnosti](docs://howto-relaties-leggen): vrijeme odgode u satima između dva zadatka.
- [Postavke aplikacije](docs://ref-instellingen): postavka Uključi planiranje u satima i što je još mijenja.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): sadrži zadatke u satima (rebar fixing and pouring) s vlastitim kalendarom u satima, *Hourly calendar, rebar fixing & pouring*.
