# Postavljanje ograničenja ili roka za dovršetak

Cilj: zabilježiti dogovor o datumu za zadatak, tako da raspored to uzme u obzir ili pokaže da ga ne ispunjavate.

## Kada vam ovo treba

Opeke se isporučuju tek 21. lipnja, pa zidanje ne smije početi ranije: **ograničenje** *ne početi prije*. Krov mora biti zatvoren prije građevinskog godišnjeg odmora, a želite upozorenje ako to ne uspije: **rok za dovršetak**. Betoniranje je fiksirano na određeni dan jer ga je betonara obećala: *mora započeti na*. Koji tip kada odgovara i što aplikacija s njim radi, objašnjeno je u [Ograničenja i rokovi za dovršetak](docs://uitleg-constraints).

## Koraci

Ograničenje i rok za dovršetak postavljate u panelu *Svojstva*.

1. Odaberite zadatak. Ako ne vidite panel *Svojstva*, uključite ga putem *Prikaz › Paneli › Svojstva*.
2. Uz *Ograničenje* odaberite vrstu, na primjer *Ne početi prije (SNET)*.
3. Uz svaku vrstu osim *Što prije moguće (ASAP)* i *Što kasnije moguće (ALAP)* pojavljuje se polje *Datum ograničenja*. Upišite datum u tri polja za dan, mjesec i godinu, na primjer 21, 06 i 2027, zatim pritisnite Enter. Aplikacija sama prelazi na sljedeće polje čim je prethodno puno. Nakon što odaberete vrstu, datum je već upisan: datum prethodnog ograničenja ili, ako ga nema, izvorni planirani početak zadatka. Taj se datum može razlikovati od početka u panelu, zato uvijek sami upišite datum koji želite.
4. Ako želite zadatak fiksirati na datumu, čak i prije njegovih prethodnika, odaberite *Mora započeti na (MSO)* ili *Mora završiti na (MFO)* i označite *Obvezno (logika fiksiranja)*. To je čvrsto fiksiranje; upotrijebite ga samo za datum koji je zaista fiksiran.
5. Ako želite i drugu granicu, na primjer zadatak koji ne smije početi prije 14. lipnja i mora biti završen do 17. lipnja, odaberite vrstu pod *Sekundarno ograničenje* i ispunite *Sekundarni datum*. To polje se pojavljuje uz svako ograničenje s datumom, osim uz čvrsto fiksiranje. Uz MSO i MFO sekundarno ograničenje nije dopušteno: aplikacija ga tada označi crveno.
6. Za rok za dovršetak ispunite polje *Rok za dovršetak* na isti način kao datum ograničenja. Rok za dovršetak nije dio ograničenja: na istom zadatku možete postaviti oboje.
7. Pritisnite **Izračunaj** (F5), na primjer kroz *Početna › Raspored › Izračunaj*. Dok to ne učinite, traka stanja prikazuje *Zastarjelo — ponovno izračunajte (F5)*.

Ta polja nalaze se i u prozoru *Uredi zadatak*, koji otvarate desnim klikom na zadatak i odabirom *Uredi...*; potvrdite s *Spremi*.

U tablici radite sa stupcima. Kliknite na **+** u zaglavlju tablice i pod *Ograničenja* odaberite stupce *Vrsta ograničenja*, *Datum ograničenja* i *Rok za dovršetak* (postoje i *Čvrsto ograničenje*, *Vrsta sekundarnog ograničenja* i *Datum sekundarnog ograničenja*). Dvaput kliknite na ćeliju da je uredite: vrstu birate s popisa, a datum upisujete s crticama, na primjer 21-06-2027. *Čvrsto ograničenje* može se mijenjati samo za MSO i MFO.

Ako zadatak ima prethodnika, postoji prečac za *ne početi prije*: upišite novi datum početka u polje *Početak* (u panelu *Svojstva*, u prozoru *Uredi zadatak* ili u tablici) ili pomaknite traku u Gantt dijagramu. Aplikacija to tada sama pretvori u ograničenje *Ne početi prije (SNET)* i to vam javi.

## Provjera rezultata

- U Gantt dijagramu nalazi se mali romb iznad trake: na strani početka za ograničenje početka, a na strani završetka za ograničenje završetka. Romb je plav za SNET i FNET, ljubičast za SNLT, FNLT, MSO i MFO, i crven ako je ograničenje prekršeno. Čvrsto fiksiranje ima klin. Rok za dovršetak prikazan je strelicom prema dolje na datumu roka za dovršetak: zelena dok je zadatak završen na vrijeme, crvena ako kasni.
- Prekršeno ograničenje ili propušten rok za dovršetak prikazuje se u panelu *Upozorenja* (*Raspored › Raspored › Upozorenja*) i u traci stanja. Vrijednost *Ukupan slobodni hod* zadatka i zadataka prije njega tada je negativna.
- Uz gornju granicu (*ne početi kasnije od*, *ne završiti kasnije od*) ili rok za dovršetak izostanak upozorenja znači da raspored ispunjava datum.

## Uklanjanje ograničenja ili roka za dovršetak

Uz *Ograničenje* ponovno odaberite *Što prije moguće (ASAP)*. Time se uklanja i sekundarno ograničenje. Rok za dovršetak uklonite tako da ispraznite tri polja i pritisnete Enter. Zatim pritisnite **Izračunaj**.

## Zamke i što aplikacija radi

**Ograničenje na fazi.** Ograničenje ili rok za dovršetak na fazi (zadatku sažetka) nema učinka. Postavite ga na sam zadatak.

**Zadatak koji je već započeo.** Ako zadatak ima stvarni početak ili napredak, zadržava svoj stvarni početak. Ograničenje *ne početi prije* s kasnijim datumom ga ne pomiče.

**Upisivanje datuma početka uz drugo ograničenje.** Ako zadatak ima prethodnika i već ima drugo ograničenje, na primjer *Što kasnije moguće (ALAP)*, aplikacija upisani datum početka ne primjenjuje. Poruka navodi to ograničenje; promijenite ga ako želite pomaknuti početak.

**Datum u vikendu.** Datum u subotu, nedjelju ili na neradni dan računa se kao radni dan: donja granica (*ne početi prije*, *ne završiti prije*) kao sljedeći radni dan, a gornja granica (*ne početi kasnije od*, *ne završiti kasnije od*) kao prethodni.

**Sekundarno ograničenje koje nije dopušteno.** Aplikacija nedopuštenu kombinaciju označi crveno, s razlogom, na primjer *Primarno i sekundarno ograničenje ne smiju ograničavati istu stranu.* Sekundarno ograničenje nije dopušteno uz ASAP, ALAP, MSO, MFO i čvrsto fiksiranje.

**Čvrsto fiksiranje.** Prvi put kada ga uključite, aplikacija upozori da čvrsto fiksiranje nadjačava ovisnosti. Zadatak je tada na datumu, čak i prije svojih prethodnika; ti prethodnici dobivaju negativnu vremensku rezervu.

**Nakon postavljanja ništa nije promijenjeno.** Ograničenja djeluju tek nakon **Izračunaj**. Ako gornja granica (*ne početi kasnije od*, *ne završiti kasnije od*) nema učinka na trake, to je normalno: gornja granica ništa ne pomiče, ona samo čini vremensku rezervu negativnom ako datum nije ispunjen.

## Pogledajte također

- [Ograničenja i rokovi za dovršetak](docs://uitleg-constraints): što svaka vrsta radi, te objašnjenje čvrstog fiksiranja, negativne vremenske rezerve i roka za dovršetak.
- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): što negativna vremenska rezerva čini s kritičnim putem.
- [Ovisnosti i vrijeme odgode](docs://uitleg-relaties): ovisnosti uz koje ograničenje stoji.
- [Obavijesti i upozorenja](docs://ref-meldingen): upozorenja za prekršeno ograničenje ili propušten rok za dovršetak.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): ograničenje dozvole *ne početi prije* na *Demolish existing extension* (14. svibnja 2027.) i rok za dovršetak koji se ispunjava s dosta vremena.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): namjerno strog rok za dovršetak na *Contractual project handover* (15. srpnja 2027.): nakon izračunavanja završetak je 17. kolovoza i mnogi zadaci imaju negativnu vremensku rezervu.
