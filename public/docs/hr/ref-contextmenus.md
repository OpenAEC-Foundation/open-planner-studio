# Izbornici desnog klika

Koje izbornike otvara desna tipka miša u Gantt prikazu i u tablici zadataka, što svaka stavka radi i na koje zadatke se odnosi. Stavke koje postoje i kao gumb ili kao prečac opisane su u [Vrpca, karticu po karticu](docs://ref-lint) i [Tipkovni prečaci](docs://ref-sneltoetsen).

## Koji izbornik gdje

Postoje četiri izbornika. Koji se otvori, ovisi o tome gdje kliknete:

- **Na traci zadatka u Gantt prikazu** — izbornik zadatka, s *Započni ovisnost ovdje* na vrhu.
- **Na zadatku u tablici zadataka** — isti izbornik zadatka, bez te jedne stavke na vrhu. To vrijedi za tablicu zadataka lijevo od Gantt prikaza i za karticu *Tablica*.
- **Na zaglavlju grupe u tablici zadataka** — mali izbornik za proširivanje i sažimanje grupa. Zaglavlja grupa pojavljuju se samo kada grupirate, na primjer s izgledom *Dijagram resursa*.
- **Na praznom prostoru** — u Gantt prikazu pored ili ispod traka, i u tablici zadataka ispod zadnjeg zadatka ili na sivom retku *Novi zadatak*. Izbornik ima *Novi zadatak*, *Dodaj kontrolnu točku* i *Zalijepi*; u Gantt prikazu još *Vrati zoom* i *Prilagodi projektu*. Novi zadatak ili nova kontrolna točka ide na dno popisa. U Gantt prikazu počinje na datumu na koji ste kliknuli; u tablici zadataka otvara se odmah ćelija s nazivom, pa možete odmah upisati.

Na pojasu zaglavlja grupe u Gantt prikazu desna tipka miša ne otvara izbornik. Desni klik na zaglavlje vremenske osi također ne čini ništa. Zaglavlja stupaca tablice zadataka imaju vlastiti izbornik, opisan u [Prilagođavanje stupaca tablice](docs://howto-tabelkolommen-aanpassen).

**Na koje zadatke se stavka odnosi?** Kliknete na jedan zadatak, ali odabir određuje opseg. Ako je zadatak na koji kliknete dio odabira, stavka se odnosi na cijeli odabir. Ako nije, odnosi se samo na taj jedan zadatak. Desnim klikom na traku u Gantt prikazu ili na redak u tablici zadataka taj zadatak zamjenjuje odabir, ako nije bio dio njega. Svaka stavka koja nešto mijenja jedan je korak u *Poništi*, i za cijeli odabir.

## Izbornik zadatka

Stavke su u ovom redoslijedu. Crta između skupina stavki je razdjelnik u izborniku.

**Započni ovisnost ovdje** — samo u Gantt prikazu, na traci. Uključuje način rada za ovisnosti s ovim odabranim zadatkom; zatim povučete do nasljednika. Pogledajte [Dodavanje ovisnosti](docs://howto-relaties-leggen).

**Ukloni prekid** i **Ukloni sve prekide** — samo u Gantt prikazu, na traci s prekidima. *Ukloni prekid* je prisutan samo ako kliknete na prekid ili na dio iza njega, i ako se prekid može urediti; uklanja taj jedan prekid. *Ukloni sve prekide* uklanja sve njih, uključujući prekide iz izvorne datoteke koje ne možete urediti. Pogledajte [Dijeljenje zadatka](docs://howto-taak-splitsen).

**Uredi...** — otvara prozor *Uredi zadatak* za ovaj zadatak. Pogledajte [Dijaloški okvir zadatka i okno svojstava](docs://ref-taak-eigenschappen).

**Umetni iznad** i **Umetni ispod** — umeće jedan novi zadatak iznad najvišeg ili ispod najnižeg zadatka opsega, na istoj razini. To radi samo u čistom prikazu stabla, bez filtra, grupiranja ili sortiranja; inače aplikacija odbija radnju i prikazuje poruku. Pogledajte [Dodavanje zadataka i kontrolnih točaka](docs://howto-taken-en-mijlpalen-toevoegen).

**Dodaj podzadatak** — dodaje novi zadatak kao podzadatak zadatka na koji ste kliknuli, na dno njegovih podzadataka. Odnosi se samo na taj jedan zadatak, ne na cijeli odabir.

**Dodaj kontrolnu točku** — dodaje kontrolnu točku kao podzadatak zadatka na koji ste kliknuli. Odnosi se samo na taj jedan zadatak.

**Dodaj ovisnost** — radi isto kao *Započni ovisnost ovdje*: uključuje način rada za ovisnosti s ovim odabranim zadatkom. U tablici zadataka je stavka onemogućena ako Gantt prikaz nije vidljiv, s porukom *Dostupno samo kada je Gantt prikaz vidljiv*.

**Uvući** i **Pomaknuti na višu razinu** — premješta zadatke opsega za jednu razinu dublje ili za jednu razinu više u WBS-u. Ove dvije stavke postoje samo u čistom prikazu stabla. Pogledajte [Prilagođavanje strukture](docs://howto-structuur-aanpassen).

**Preklopi kontrolnu točku** — pretvara zadatak u kontrolnu točku ili natrag. Novo stanje slijedi iz zadatka na koji ste kliknuli i odnosi se na cijeli opseg: ako je taj zadatak običan zadatak, sve zadatke u opsegu pretvara u kontrolne točke. Zadatak sažetka i zadatak s dodjelama ne postaju kontrolne točke; ostatak opsega postaje kontrolna točka, a za svaki razlog dobijete poruku.

**Dodijeli kalendar ▸** — podizbornik s *Kalendar projekta* (zadatak tada nema vlastiti kalendar) i ispod njega dostupni kalendari. Trenutni izbor ima kvačicu. Zadatak koji je već na tom kalendaru ne ubraja se i ne stvara dodatni korak u *Poništi*. Pogledajte [Stvaranje i dodjeljivanje kalendara](docs://howto-kalender-maken-en-toewijzen).

**Napredak ▸** — podizbornik s 0%, 25%, 50%, 75% i 100%. Trenutna vrijednost ima kvačicu. Zadatak sažetka nema vlastiti napredak: ako je u opsegu, njegovi krajnji zadaci dobivaju postotak. Bez datuma stanja aplikacija postavlja datum na danas, uz poruku. Za zadatak koji je planiran da počne tek nakon datuma stanja i još nema stvarni početak, aplikacija prvo postavlja pitanje o stvarnom početku; ako to pitanje otkažete, ništa se ne mijenja. Pogledajte [Ažuriranje napretka](docs://howto-voortgang-bijwerken).

**Prioritet ▸** — podizbornik s *Nizak* (100), *Normalan* (500) i *Visok* (900), prioritet uravnoteživanja zadatka. Trenutna vrijednost ima kvačicu. Pogledajte [Uravnoteživanje resursa](docs://uitleg-nivelleren).

**Prati put** — prikazuje prethodnike i nasljednike ovog zadatka. Ako je praćenje već uključeno, stavka se zove *Zaustavi praćenje puta*. Pogledajte [Praćenje puta](docs://howto-pad-traceren).

**Sažmi**, **Proširi** i **Spremi granu kao predložak** — samo za zadatak sažetka. *Sažmi* i *Proširi* su uvijek obje prisutne, čak i ako je zadatak već sažet ili proširen, i odnose se na cijeli opseg. *Spremi granu kao predložak* sprema zadatak s njegovim podzadacima i ovisnostima među njima kao WBS predložak. Pogledajte [Spremanje i umetanje WBS predložaka](docs://howto-wbs-sjablonen).

**Izbriši** — briše zadatke opsega, s njihovim podzadacima. Nema potvrde; vratite ih s Ctrl+Z, u jednom koraku za cijeli opseg. Pogledajte [Odabir, brisanje i poništavanje zadataka](docs://howto-taken-selecteren-verwijderen).

## Izbornik zaglavlja grupe

Ovaj izbornik postoji samo u tablici zadataka, na zaglavlju grupe:

**Sažmi grupu** ili **Proširi grupu** — sažima ili proširuje samo ovu grupu. Stavka pokazuje što možete učiniti.

**Proširi sve** i **Sažmi sve** — proširuje ili sažima sve grupe odjednom.

Grupiranje postavljate pomoću izgleda. Pogledajte [Stvaranje i korištenje izgleda](docs://howto-layouts-gebruiken).

## Pogledajte također

- [Povlačenje, pomicanje i zumiranje u Gantt prikazu](docs://howto-gantt-bedienen): što povlačenje lijevom i srednjom tipkom miša radi.
- [Vrpca, karticu po karticu](docs://ref-lint): gumbi s istim radnjama.
- [Tipkovni prečaci](docs://ref-sneltoetsen): tipke koje su uz njih vezane.
