# Praćenje puta

Cilj: učiniti lanac zadataka prije ili poslije zadatka vidljivim, da vidite što određuje datum zadatka i što se pomakne ako kasni.

## Kada vam ovo treba

Krovopokrivački radovi počinju tek za tri tjedna i želite znati koji zadatak to određuje. Ili zidar kasni tjedan dana i želite vidjeti koji se zadaci nakon njega pomiču. U rasporedu s desecima ovisnosti to ne vidite iz crta. Uz **praćenje puta** aplikacija oboji sve **prethodnike** (zadatke koji dolaze prije odabranog zadatka, izravno ili preko drugih zadataka) i **nasljednike** (zadatke koji dolaze poslije njega) i prigušuje ostale.

## Koraci

1. Odaberite zadatak čiji put želite vidjeti, u tablici zadataka ili na njegovoj traci u Gantt dijagramu. Ako odaberete više zadataka, aplikacija prati put od zadatka koji ste prvi odabrali.
2. Odaberite *Raspored › Praćenje puta › Prethodnici* za sve što dolazi prije zadatka ili *Raspored › Praćenje puta › Nasljednici* za sve što dolazi poslije njega. Oba gumba mogu biti uključena istodobno. Ista dva gumba nalaze se na kartici *Tablica*, u grupi *Praćenje puta*.
3. Ako želite oba smjera odjednom, desnom tipkom miša kliknite zadatak, u Gantt dijagramu ili u tablici zadataka, i odaberite *Prati put*.
4. Pogledajte rezultat u Gantt dijagramu i u tablici zadataka. Kako ga čitati, objašnjeno je u nastavku.
5. Praćenje zaustavite ponovnim klikom na aktivni gumb, desnom tipkom miša kliknite zadatak i odaberite *Zaustavi praćenje puta*, ili pritisnite Esc. Esc također briše odabir.

Ako odaberete drugi zadatak dok pratite put, put slijedi novi odabir.

## Čitanje rezultata

- Prethodnici su zlatne boje, nasljednici ljubičaste. U Gantt dijagramu trake mijenjaju boju, a u tablici zadataka pojavljuje se crta lijevo od retka: puna za prethodnike, isprekidana za nasljednike. Odabrani zadatak ima obrub.
- Tamnija boja, u tablici zadataka deblja crta s podebljanim tekstom, označava lanac **odlučujućih ovisnosti**: ovisnosti koje stvarno određuju datume. Što to znači, objašnjeno je u članku [Ovisnosti i vrijeme odgode](docs://uitleg-relaties).
- Svi zadaci izvan puta su prigušeni. Crte ovisnosti koje ne pripadaju putu su blijede i točkaste.

## Mogući problemi i što aplikacija radi

**Nijedan zadatak nije odabran.** Bez odabranog zadatka nema što pratiti: gumb je uključen, ali se na zaslonu ništa ne mijenja. Najprije odaberite zadatak.

**Nema isticanja lanca odlučujućih ovisnosti.** Isticanje dolazi iz posljednjeg izračunavanja. Ako raspored još nije izračunat ili izračunavanje javlja grešku, aplikacija boji sve prethodnike i nasljednike jednako jako. Pritisnite **Izračunaj** (F5), na primjer putem *Početna › Raspored › Izračunaj*, i ponovno pogledajte put. Nakon promjene isticanje ostaje uz prethodno izračunavanje dok traka stanja prikazuje *Zastarjelo — ponovno izračunajte (F5)*.

**Ovisnost na fazi.** Praćenje slijedi ovisnosti onako kako ste ih postavili. Ovisnost koja ide od faze ili do nje povezuje samu fazu (zadatak sažetka). Za izračunavanje vrijedi za svaki zadatak u toj fazi, ali se put ne nastavlja na zadatke unutar nje. Ako pratite zadatak unutar faze koja je ovisnošću na samoj fazi povezana s drugim zadatkom, tu ovisnost zato ne vidite. U tom slučaju odaberite samu fazu.

**Samo odabrani smjer.** Ako je uključen samo *Prethodnici*, ne vidite što dolazi poslije zadatka, i obrnuto.

## Pogledajte također

- [Ovisnosti i vrijeme odgode](docs://uitleg-relaties): zašto je neka ovisnost odlučujuća i kako aplikacija izračunava datum početka zadatka.
- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): koji lanac određuje kraj projekta.
- [Dodavanje ovisnosti](docs://howto-relaties-leggen): dodavanje ovisnosti ako vam u putu nedostaje poveznica.
