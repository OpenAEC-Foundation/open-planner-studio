# Korištenje pregleda zauzetosti

Cilj: vidjeti na kojim danima dva ili više otvorenih projekata zajedno traže više jednog resursa nego što ga ima biblioteka.

## Kada vam ovo treba

Vaša ekipa zidara radi na fasadama u jednom projektu, a u drugom na garažama. Svaki projekt pokazuje da je ekipa lijepo raspoređena, jer histogram i preopterećenje resursa jednog projekta gledaju samo taj jedan projekt. Tek kad projekte postavite jedan uz drugi, vidi se da zajedno traže za iste dane više zidara nego što ih imate. Pregled zauzetosti to postavljanje jedan uz drugi radi za vas.

Pregled broji samo resurse iz biblioteke resursa, u projektima koji su povezani s istom bibliotekom. Kako se to računa, pročitajte u [Biblioteka resursa](docs://uitleg-resourcebibliotheek).

## Koraci

### 1. Pripremite projekte

1. Otvorite projekte koje želite usporediti, svaki u vlastitoj kartici; pogledajte [Rad s više projekata istodobno](docs://howto-meerdere-projecten). Pregled vidi samo projekte koji su otvoreni u ovom programu.
2. Povežite svaki projekt s istom bibliotekom i upotrijebite resurs iz biblioteke u svakom projektu. Bez povezivanja s bibliotekom okno resursa ne prikazuje pregled. Pogledajte [Korištenje biblioteke resursa](docs://howto-resourcebibliotheek-gebruiken).
3. Izračunajte projekte naredbom *Izračunaj* (F5) ili uključite *Automatsko izračunavanje*. Što pregled radi sa zastarjelim projektima, opisano je u dijelu *Mogući problemi i što program tada radi* u nastavku.

### 2. Otvorite pregled

1. Idite na jedan od projekata i odaberite *Resursi › Upravljanje › Resursi*.
2. U gornjem desnom kutu odaberite *Zauzetost*. Pregled pripada biblioteci projekta u kojem se nalazite. U ovom oknu ništa ne možete mijenjati: to je prozor samo za čitanje.

### 3. Pročitajte tablicu

Svaki resurs iz biblioteke koji je rezerviran u barem jednom otvorenom projektu dobiva redak. Resursi bez rezervacije nisu prikazani. Redci s najviše danima s preopterećenjem su na vrhu, zatim po abecedi.

- *Dokumenti* kaže u koliko je projekata resurs rezerviran, na primjer *2 dokumenta*.
- *Razdoblje* ide od prvog do zadnjeg dana s opterećenjem, zapisano kao gggg-mm-dd, na primjer *2027-06-07 – 2027-06-14*.
- *Vrhunac / Kapacitet* postavlja najveće dnevno opterećenje svih projekata zajedno naspram kapaciteta resursa u biblioteci, na primjer *4,0 / 3,0*. Ako postoji barem jedan dan s preopterećenjem, prikazuje se crveno.
- Crvena oznaka iza retka, na primjer *3 dana s preopterećenjem resursa*, broji dane na kojima je zbroj veći od kapaciteta. Ako zadržite miš iznad nje, vidite datume.

### 4. Pogledajte po projektu

1. Kliknite malu strelicu ispred naziva resursa. Redak se otvori.
2. Na vrhu su datumi s preopterećenjem: prvih pet, zatim *… i još 3* ako ih ima više. Ispod toga je po projektu naziv s razdobljem i vrhuncem samo tog projekta, na primjer *Houses North 2027-06-07 – 2027-06-11 Vrhunac: 2,0*.
3. Kliknite sam redak da dolje vidite histogram. Svaki projekt ima svoju boju, a stupci su naslagani jedan na drugi. Isprekidana crta je kapacitet biblioteke. Ako se mijenja tijekom vremena, vidite stepenice. Dani s preopterećenjem dobivaju crveni pojas iza stupaca. Ponovno kliknite redak da zatvorite histogram. Bez odabranog retka piše *Odaberite resurs da biste vidjeli histogram.*

### 5. Riješite problem

Pregled prikazuje problem, ali ga ne rješava. Imate dvije mogućnosti:

- Premjestite zadatak u jednom od projekata ili mu dodijelite manje jedinica dodjele po danu. Zatim taj projekt ponovno izračunajte pritiskom na F5.
- Ako stvarno dolazi novi član tima, povećajte *Maksimalan postotak jedinica* resursa u biblioteci. To radite u *Resursi › Upravljanje › Resursi*, u prikazu *Biblioteka*.

Naredba *Razriješi…* na vrpci ovdje ne pomaže: gleda resurse samo jednog projekta u kojem se nalazite. Pogledajte [Uravnoteživanje resursa](docs://uitleg-nivelleren).

## Mogući problemi i što program tada radi

**Pregled je prazan.** Piše *Nema resursa iz biblioteke u otvorenim dokumentima.* Tada nijedan otvoreni projekt nema resurs iz biblioteke na zadatku.

**Ne vidite gumb *Zauzetost*.** Projekt u kojem se nalazite nije povezan s bibliotekom.

**Projekt se ne ubraja.** Nije otvoren u ovom programu, povezan je s drugom bibliotekom ili je resurs u njemu vlastiti resurs tog projekta. Na dnu pregleda uvijek piše *Ovaj pregled vidi samo dokumente otvorene u ovom programu.* Ni kopija resursa koji je u međuvremenu uklonjen iz biblioteke se ne ubraja.

**Kopija ili varijanta ubraja se u cijelosti.** Ubraja se svaki otvoreni projekt koji je povezan s bibliotekom, pa i ako je kopija ili varijanta drugog otvorenog projekta, na primjer varijanta koju je napravio AI pomoćnik s `planner_duplicate_document`. Izvornik i varijanta zajedno tada mogu pokazati preopterećenje koje u stvarnosti postoji samo jednom. Pregled to ne filtrira tiho: zatvorite varijantu na neko vrijeme ili to uzmite u obzir pri čitanju.

**Projekt je zastario.** Projekt je zastario ako ste nešto promijenili u rasporedu, a niste ga ponovno izračunali. Pregled tada s tim projektom postupa ovako:

- Za projekt koji nije aktivna kartica pregled sam izračunava unaprijed, bez promjene projekta. Iznad tablice tada piše *Izmijenjeni dokumenti su za ovaj pregled unaprijed izračunati; pritisnite F5 u dokumentu ili uključite „Automatsko izračunavanje” da biste to trajno radili.* Iza projekta piše *Unaprijed izračunato za ovaj pregled — sam dokument prikazuje starije datume dok ondje ne pritisnete F5 ili ne uključite „Automatsko izračunavanje”.* Ako je *Automatsko izračunavanje* uključeno (*Postavke › Projekt › Postavke*, kartica *Raspored*), program takve projekte zaista ponovno izračunava čim pogledate pregled, a poruka nestaje. Ako je i aktivni projekt zastario, umjesto toga se iznad tablice prikazuje poruka iz sljedeće točke.
- Pregled sam ne izračunava projekt u kojem se nalazite. Ako je taj projekt zastario, piše *Izmijenjeni dokument još nije izračunat; ovdje se ubraja s posljednjim izračunatim brojkama. Pritisnite F5 u tom dokumentu ili uključite „Automatsko izračunavanje”.* A iza projekta *Zastarjelo: ovo su posljednje izračunate brojke — pritisnite F5 u ovom dokumentu.* Pazite: *posljednje izračunate brojke* nije sasvim točno. Pregled uzima stare početne datume, ali već promijenjeno trajanje ili dodjelu. Brojke se zato mogu razlikovati i od starog i od novog rasporeda, i od traka u Gantt dijagramu. Vjerujte im tek nakon što pritisnete F5.
- Ako pregled ne može izračunati projekt, na primjer zbog petlje u njegovim ovisnostima, projekt se ne ubraja. I dalje je naveden, s porukom *Ne ubraja se: raspored nije izračunat — aktivirajte ovaj dokument i pritisnite F5.* A iznad tablice *Najmanje jedan dokument nije izračunat i ne ubraja se u zauzetost.*

**Pregled nije u skladu s vašim očekivanjem.** Kapacitet dolazi iz biblioteke (*Maksimalan postotak jedinica* stavke u biblioteci ili njezin *Kapacitet po vremenskim fazama* na taj dan), a ne iz *Maksimalan postotak jedinica* kopije u projektu. Zbroj jednak kapacitetu nije sukob.

## Vidi također

- [Biblioteka resursa](docs://uitleg-resourcebibliotheek): kako se računa zauzetost, s primjerom izračuna.
- [Korištenje biblioteke resursa](docs://howto-resourcebibliotheek-gebruiken): povezivanje projekata i dodjela resursa.
- [Rješavanje preopterećenja resursa](docs://howto-overbezetting-oplossen): preopterećenje unutar jednog projekta.
