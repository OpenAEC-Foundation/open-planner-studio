# Premještanje projekta

Cilj: pomaknuti cijeli raspored na novi datum početka i prije promjene vidjeti što to znači za završetak.

## Kada vam ovo treba

Početak radova se pomiče: dozvola stiže kasnije ili raspored prethodne kuće upotrijebite za sljedeću. Pomicanje svakog zadatka pojedinačno puno je posla. S **Premjesti projekt** unesete jedan novi datum početka, a aplikacija sve pomakne za isto.

Datum završetka projekta ne pomiče se uvijek za isti broj dana kao početak. Kalendar se ne pomiče zajedno s njim: praznici, kolektivni godišnji odmor u građevinarstvu i zimski prekid ostaju na fiksnim datumima. Primjer: u *Početna › Datoteka › Novo* stvorite projekt s poljem *Datum početka*: 29-09-2026, *Država*: *Nizozemska* i *Kolektivni godišnji odmor u građevinarstvu*: *Nema*. U njega unesete raspored od 30 radnih dana koji završava 9. studenoga 2026. Ako ga premjestite na 14. prosinca 2026., odnosno 76 kalendarskih dana kasnije, završit će 26. siječnja 2027. To je 78 dana kasnije, jer su 25. prosinca i 1. siječnja sada neradni dani u vašem rasporedu. Trajanje ostaje 30 radnih dana. Pregled u prozoru to prikazuje prije nego što išta promijenite.

## Koraci

1. Odaberite *Raspored › Raspored › Premjesti projekt…*. Gumb je onemogućen dok projekt nema datum početka.
2. U polju *Trenutni datum početka projekta* pogledajte kada projekt sada počinje, a u polju *Novi datum početka projekta* odaberite novi datum.
3. Ako projekt ima temeljne planove, pojavljuje se okvir *Pomakni i temeljne planove*. Ostavite ga isključenim ako želite i dalje vidjeti pomak kao odstupanje (vidi Zamke i što aplikacija radi).
4. Kliknite *Izračunaj pregled*. Aplikacija u cijelosti izračunava pomaknuti raspored, bez promjene bilo čega u vašem projektu.
5. Pogledajte pregled (vidi dolje). Ako je točan, kliknite *Premjesti*.

U pregledu vidite:

- pomak u kalendarskim danima (*Pomak: 76 kalendarskih dana kasnije*);
- *Datum početka projekta* i *Datum završetka projekta*, od prije do poslije;
- crveno upozorenje ako kalendar smeta, ili poruku da trajanje projekta ostaje isto;
- broj pomaknutih zadataka i što se još pomiče zajedno s njima;
- upozorenja koja trebate pročitati (vidi Zamke i što aplikacija radi).

Aplikacija odmah izračunava novi raspored, pa ne morate koristiti **Izračunaj** (F5). Prikaz se također prilagođava cijelom projektu. Cijela promjena je jedan korak za poništavanje naredbom *Poništi* (Ctrl+Z).

Gumb *Premjesti* radi samo nakon pregleda bez greške i ako se novi datum razlikuje od trenutnog. Ako promijenite datum ili okvir, pregled nestaje i morate ponovno izračunati.

### Što se pomiče zajedno, a što ne

Pomiče se: početak i završetak svakog zadatka, stvarni početak i stvarni završetak, datumi ograničenja (također čvrsto fiksiranje tipa Mandatory, vidi [Ograničenja i rokovi za dovršetak](docs://uitleg-constraints)), rokovi za dovršetak, datum stanja, sidra međuzavisnosti projekata i koraci dostupnosti resursa. Pomiču se i datum početka projekta i, ako ste ga unijeli, datum završetka projekta.

Ne pomiče se:

- kalendari, dakle praznici, kolektivni godišnji odmor u građevinarstvu i zimski prekid;
- temeljni planovi, osim ako uključite *Pomakni i temeljne planove*;
- ispunjeno prilagođeno polje vrste *Datum*.

## Zamke i što aplikacija radi

**Završetak se pomiče za drugačiji broj dana.** Ako pregled ustanovi da se završetak pomiče za više ili manje kalendarskih dana nego početak, ili da se trajanje projekta u radnim danima mijenja, prikazuje crveno upozorenje s brojevima. Tada i dalje možete otkazati.

**Temeljni planovi se ne pomiču.** Temeljni plan postoji da bi se mjerilo odstupanje. Ako projekt premjestite s isključenim okvirom, pomak vidite kao odstupanje od temeljnog plana. Ako okvir uključite, temeljni planovi se pomiču zajedno s rasporedom. Pomiču se samo njihovi datumi; datum na koji je temeljni plan spremljen ostaje isti.

**Projekt u tijeku.** Stvarni datumi se pomiču zajedno. U projektu u kojem ste već unijeli napredak to nije uvijek ono što želite. Aplikacija upozorava: *Provjerite je li to ispravno za projekt u tijeku.*

**Međuzavisnosti projekata.** Sidro u vašem projektu pomiče se zajedno s rasporedom, izvorni projekt ne. Nakon premještanja osvježite međuzavisnosti s *Početna › Zadaci › Poveži ▾ › Osvježi sve međuzavisnosti projekata*. Vidi [Međuzavisnosti s drugim projektom](docs://howto-externe-relaties).

**Praznici ne sežu dovoljno daleko.** Kalendar s generiranim praznicima pokriva određeni broj godina. Ako premješteni raspored traje dulje, aplikacija tu godinu računa bez praznika. Pregled na to upozorava, na primjer: *Generirani praznici kalendara „Bouwkalender NL” obuhvaćaju 2025–2029; premješteni raspored traje do 2030. Ponovno generirajte praznike.* Prvo premjestite projekt. Zatim otvorite *Raspored › Kalendar › Kalendar*: pored praznika sada piše *Ponovno generiraj*. Potvrdite gumbom *Primijeni* i aplikacija ponovno izračunava. Raspon novih praznika slijedi datume projekta, pa ponovno generiranje prije premještanja ne pomaže.

**Datum je u prošlosti.** To je dopušteno, ali pregled to spominje: *Novi datum početka je u prošlosti.*

**Promjena početka u podacima o projektu je nešto drugo.** Ako promijenite datum početka projekta u *Postavke › Projekt › Podaci o projektu* i odaberete *Primijeni*, raspored se ne pomiče. Samo zadaci bez prethodnika ili ograničenja, koji bi inače bili prije novog početka, pomiču se na taj datum, a aplikacija kaže koliko ih je. Ako želite pomaknuti sve, upotrijebite *Premjesti projekt…*.

## Vidi također

- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): kako raspored računa i zašto se završetak pomiče.
- [Dodavanje ovisnosti](docs://howto-relaties-leggen): ovisnosti se pri premještanju projekta jednostavno ne mijenjaju.
- [Novi projekt i podaci o projektu](docs://ref-projectinfo): što radi datum početka u podacima o projektu.
