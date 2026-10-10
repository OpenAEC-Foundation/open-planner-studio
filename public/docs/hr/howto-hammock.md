# Stvaranje hamaka

Cilj: stvoriti zadatak koji ne zna vlastito trajanje, nego traje od početka jednog zadatka do završetka drugog, na primjer postavljanje gradilišta, nadzor ili najam gradilišne kućice.

## Kada vam ovo treba

Gradilišna kućica stoji na mjestu dok zgrada traje, od prvih zemljanih radova do primopredaje. Ako tom zadatku dodijelite fiksno trajanje od 13 radnih dana, on se ne pomiče kad zidarski radovi kasne, pa raspored prestaje biti točan. **Hamak** (također se zove *level of effort*) prati posao za koji ga vežete: njegov početak dolazi iz ovisnosti početka, njegov završetak iz ovisnosti završetka, a njegovo trajanje je razlika između ta dva datuma.

## Koraci

1. Stvorite zadatak, na primjer *Site cabin*, ili odaberite postojeći zadatak. Kontrolna točka i zadatak sažetka (faza) ne mogu biti hamak. U oknu *Svojstva* i u prozoru *Uredi zadatak* za takav zadatak nedostaje potvrdni okvir, a u stupcu tablice ga nije moguće promijeniti.
2. Označite *Hamak (izvedeno trajanje)* u oknu *Svojstva*, u prozoru *Uredi zadatak* (desnom tipkom miša kliknite zadatak, *Uredi...*) ili u stupcu *Hamak (izvedeno trajanje)* u odjeljku *Raspored*. Polje *Trajanje* se tada više ne može uređivati.
3. Dodajte ovisnost od zadatka s kojim hamak počinje do hamaka, vrste **SS** (hamak počinje zajedno s tim zadatkom) ili **FS** (hamak počinje nakon tog zadatka). Za to odaberite hamak, kliknite *Dodaj ovisnost* u odjeljku *Ovisnosti*, ostavite smjer na opciji *Prethodnik*, odaberite zadatak i odaberite vrstu. Koraci su opisani u [Dodavanje ovisnosti](docs://howto-relaties-leggen).
4. Dodajte ovisnost od zadatka s kojim hamak završava do hamaka, vrste **FF** (hamak završava zajedno s tim zadatkom) ili **SF**.
5. Pogledajte u oknu *Svojstva* u odjeljku *Hamak (izvedeno trajanje)*: tamo vidite *Odlučujuća ovisnost početka* sa zadatkom i vrstom te *Odlučujuća ovisnost završetka* sa zadatkom i vrstom. Odlučujuća ovisnost pokazuje na zadatak iz kojeg hamak preuzima početak ili završetak.
6. Pritisnite **Izračunaj** (F5), na primjer kroz *Početna › Raspored › Izračunaj*. Hamak sada traje od početka zadatka koji određuje početak do završetka zadatka koji određuje završetak, a *Trajanje* prikazuje izvedeno trajanje.

U Gantt dijagramu je hamak tanka tirkizna traka s kukicom na oba kraja.

Primjer: *Site cabin* dobiva SS od *Groundwork* (ponedjeljak, 7. lipnja 2027.) i FF od *Roofing* (završen u srijedu, 23. lipnja). Nakon **Izračunaj** hamak traje od ponedjeljka, 7. do srijede, 23. lipnja: 13 radnih dana. Ako zidarski radovi kasne za 2 radna dana, završetak zadatka *Roofing* postaje u petak, 25. lipnja, a hamak se produlji na 15 radnih dana.

## Što aplikacija radi s hamakom

- Hamak nikad nije kritičan i nema vremensku rezervu. Ni on ne ograničava zadatke iz kojih uzima početak i završetak: zbog hamaka ne dobivaju kasni datum.
- Vrijeme odgode se uračunava. Uz SS i vrijeme odgode `1d` hamak počinje jedan radni dan nakon zadatka koji određuje početak, uz FF i vrijeme odgode `2d` završava dva radna dana nakon zadatka koji određuje završetak.

## Zamke i što aplikacija radi

**Nema odlučujuće ovisnosti završetka.** Ako hamak nema ovisnost FF ili SF, aplikacija ne može izvesti njegov završetak. U oknu *Svojstva* piše *Nema odlučujuće ovisnosti završetka (FF/SF) — raspon se svodi na nultu duljinu*. U oknu *Upozorenja* piše *Hamak bez odlučujuće ovisnosti završetka (nema FF/SF prethodnika): trajanje se vraća na nulu*. Hamak tada počinje i završava istog dana. Dodajte ovisnost FF ili SF.

**Hamak koji završava nakon posljednjeg zadatka.** Ako hamak traje do nakon posljednjeg zadatka, na primjer s FF i vremenom odgode od 2 radna dana, datum završetka projekta pomiče se zajedno s njim. Zadaci koje zapravo izvodite tada dobivaju vremensku rezervu; nijedan od njih više nije kritičan.

**Zadaci koji čekaju na hamak.** Ako dodate ovisnost od hamaka do drugog zadatka, taj zadatak počinje tek nakon završetka hamaka. Cijeli lanac prije hamaka, uključujući zadatke iz kojih hamak uzima početak i završetak, tada dobiva vremensku rezervu i više nije kritičan, jer hamak ne vraća nikakav pritisak. Zato ne dopuštajte da zadaci čekaju na hamak; radije takve zadatke vežite na odlučujuću ovisnost završetka hamaka.

**Unos trajanja.** Polje *Trajanje* hamaka je izvedeno i ne može se uređivati. Trajanje koje ste unijeli prije nego što ste označili potvrdni okvir više se ne uračunava.

## Vidi također

- [Dodavanje ovisnosti](docs://howto-relaties-leggen): koraci za dodavanje ovisnosti vrste SS ili FF.
- [Ovisnosti i vrijeme odgode](docs://uitleg-relaties): što znače SS i FF i kako se vrijeme odgode uračunava.
- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): što znači kritičan i kako vremenska rezerva radi.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): sadrži hamak *Structural works tower A (LOE)*.
