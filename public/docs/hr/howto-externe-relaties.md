# Međuzavisnosti projekata s drugim projektom

Cilj: povežite zadatak u ovom projektu sa zadatkom u drugoj datoteci projekta, tako da vaš raspored uzima u obzir posao koji je planiran na drugom mjestu.

## Kada vam ovo treba

Vaša dogradnja može početi tek kad je gradilište pripremljeno za građenje, a taj posao je u projektu izvođača radova. Ili montažer može početi tek kad je vaša konstrukcija gotova, a on planira u svojoj datoteci. Obična ovisnost radi samo između zadataka u istom projektu. **Međuzavisnost projekata** povezuje zadatak sa zadatkom u drugoj datoteci.

Međuzavisnost projekata ne izračunava se uživo s drugim projektom. Aplikacija sprema fiksni **referentni datum**: datum zadatka u drugom projektu u trenutku kad ga povežete. Izračun taj datum koristi kao granicu. Ako se drugi projekt promijeni, u vašem se ništa ne pomiče dok ne osvježite referentni datum.

## Koraci

1. Odaberite točno jedan zadatak u ovom projektu: zadatak koji ovisi o zadatku u drugom projektu ili o kojem zadatak u drugom projektu ovisi.
2. Odaberite *Početna › Zadaci › Poveži ▾ › Dodaj međuzavisnost projekata…*. Isti izbornik je na *Raspored › Ovisnosti* i na *Tablica › Zadaci*. Stavka je dostupna samo ako je odabran točno jedan zadatak.
3. U prozoru *Međuzavisnost projekata* odaberite jedan od dva načina. Ako koristite gumb *Izvorna datoteka*, odaberite datoteku projekta pod *Odaberite nedavnu datoteku*, a zatim *Izvorni zadatak*. Aplikacija čita datoteku samo za čitanje, ne otvara je kao dokument i referentni datum preuzima sama. Ovaj način radi samo u aplikaciji za računalo i samo za datoteku s popisa nedavnih datoteka; inače je gumb *Izvorna datoteka* onemogućen. Ako koristite gumb *Ručno (rezerva)*, upišite *ID projekta* i *ID zadatka* zadatka u drugom projektu, po želji *Naziv zadatka (neobavezno)* i *Referentni datum*. U verziji za preglednik to je jedini način.
4. Pod *Smjer* odaberite je li zadatak u drugom projektu vaš prethodnik ili vaš nasljednik: *Prethodnik (vanjski → ja)* ili *Nasljednik (ja → vanjski)*.
5. Odaberite *Vrsta ovisnosti* (FS, SS, FF ili SF) i po potrebi upišite *Vrijeme odgode (radni dani)*, na primjer `0d` ili `2d`.
6. Kliknite *Dodaj međuzavisnost* i pritisnite **Izračunaj** (F5).

Koji datum upišete kao referentni datum za ručnu međuzavisnost ovisi o smjeru i vrsti:

- Uz vanjski **prethodnik** prvo slovo vrste je mjerodavno: F znači datum završetka zadatka u drugom projektu, S datum početka. Uz FS i FF zato upisujete završetak, uz SS i SF početak.
- Uz vanjski **nasljednik** drugo slovo je mjerodavno: S je datum početka zadatka u drugom projektu, F datum završetka. Uz FS i SS zato upisujete početak, uz FF i SF završetak.

Ako planirate u satima (planiranje u satima uključeno i zadatak na kalendaru s radnim vremenom), polje *Referentni datum* traži i vrijeme.

Primjer: projekt gradilišta završava u petak, 18. lipnja 2027. Povežete *Groundwork* s vanjskim prethodnikom vrste FS, referentni datum 18. lipnja 2027. Nakon naredbe **Izračunaj** zadatak *Groundwork* počinje u ponedjeljak, 21. lipnja, prvi radni dan nakon referentnog datuma. Vanjski nasljednik radi obrnuto: ograničava koliko kasno vaš zadatak smije završiti.

## Što vidite i kako upravljate međuzavisnostima

- Međuzavisnosti projekata prikazuju se kao tekst u stupcima *Prethodnici* i *Nasljednici* tablice zadataka (dodajte ih pomoću **+** u zaglavlju tablice, pod *Ovisnosti*), s nazivom projekta i zadatka te vrstom. Mali trokut s oznakom *Izvor nedostaje* pokazuje da izvor nije pročitan. Zadržite miš iznad međuzavisnosti da vidite projekt (redak *ID projekta* prikazuje naziv projekta kad je poznat), ID zadatka, referentni datum i stanje izvora.
- U Gantt-dijagramu je kod zadatka siva prozirna traka. Uz prethodnika ona završava na referentnom datumu, uz nasljednika počinje na njemu. Isprekidani obrub s crvenom oznakom *zastarjelo* znači da izvor nije pročitan. Uz ručnu međuzavisnost to je uvijek slučaj.
- Desnom tipkom miša kliknite međuzavisnost u stupcu, pa odaberite *Uredi međuzavisnost projekata…* ili *Ukloni ovisnost*. Ako međuzavisnost ima izvornu datoteku, tu je i *Osvježi izvor*.
- Odaberite *Poveži ▾ › Osvježi sve međuzavisnosti projekata* da ponovo pročitate izvorne datoteke i ažurirate referentne datume. To radi samo u aplikaciji za računalo. Ako imate samo ručne međuzavisnosti, aplikacija prikazuje *Nema izvora koji se mogu osvježiti (nedostaje putanja do datoteke).* Nakon osvježavanja pritisnite **Izračunaj**.
- Ako promijenite vrstu ili smjer tako da referentni datum treba drugu stranu zadatka u drugom projektu (početak umjesto završetka ili obrnuto), aplikacija kod ručne međuzavisnosti traži novi referentni datum: *Odaberite novi referentni datum: vrsta ovisnosti sada koristi drugu stranu izvornog zadatka.* Kod međuzavisnosti s izvornom datotekom aplikacija referentni datum ponovo čita sama.

## Zamke i što aplikacija radi

**Drugi projekt se ne pomiče uz vaš.** Ako zadatak u drugom projektu promijeni datum, vaš raspored i dalje računa sa starim referentnim datumom dok ga ne osvježite ili ne promijenite. Uz ručni način referentni datum mijenjate sami: desnom tipkom miša kliknite međuzavisnost i odaberite *Uredi međuzavisnost projekata…*.

**Vanjski prethodnik je donja granica.** Ako vaš zadatak počinje kasnije nego što referentni datum zahtijeva zbog vlastitih prethodnika, prevladava ta ovisnost. Referentni datum samo gura.

**Vanjski nasljednik je gornja granica.** Ako je referentni datum pretijesan, to vidite kao negativnu vremensku rezervu na svom zadatku i na zadacima prije njega. Posebno upozorenje se ne pojavljuje, zato pazite na stupac *Ukupan slobodni hod*.

**Samo fiksno vrijeme odgode.** Za međuzavisnost projekata ne možete upisati vrijeme odgode u kalendarskim danima ili postocima. Aplikacija prikazuje *Međuzavisnosti projekata podržavaju samo fiksno vrijeme odgode u radnim danima ili radnom vremenu.* Radni dani se računaju prema kalendaru vašeg zadatka. Vrijeme odgode u satima računa se samo za zadatak koji je planiran u satima; za zadatak u danima izračun ga zanemaruje. Zato upotrijebite radne dane.

**ID projekta druge datoteke.** ID projekta nije u polju ni u stupcu, nego je spremljen kao `InternalProjectId` u IFC-u tog projekta: otvorite projekt, idite na karticu *IFC* i odaberite *Generiraj IFC*. Izračun koristi samo referentni datum; ID nije samo oznaka. Pri osvježavanju aplikacija najprije prepoznaje izvornu datoteku po ID-u projekta, zatim po putanji datoteke. Ako u ručnu međuzavisnost upišete isti ID kao onaj izvorne datoteke, međuzavisnost se pri osvježavanju te datoteke ažurira zajedno s njom. *ID zadatka* zadatka u drugom projektu nađete u tablici tog projekta, u stupcu *ID zadatka* pod *Tehnički*.

## Vidi također

- [Ovisnosti i vrijeme odgode](docs://uitleg-relaties): kako aplikacija izračunava ovisnost i vrijeme odgode.
- [Dodavanje ovisnosti](docs://howto-relaties-leggen): ovisnosti između zadataka u istom projektu.
- [Ograničenja i rokovi za dovršetak](docs://uitleg-constraints): ograničenja datuma za zadatak, bez drugog projekta.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): sadrži međuzavisnost projekata na *Car park paving* (vanjski prethodnik).
