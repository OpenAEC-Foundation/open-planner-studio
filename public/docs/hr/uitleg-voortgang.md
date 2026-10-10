# Napredak, datum stanja i temeljni plan

Raspored je prognoza. Kad je posao u tijeku, želite znati što je završeno, što je još preostalo i što to znači za predaju. Ovaj članak objašnjava kako aplikacija obrađuje napredak: što radi datum stanja, kako aplikacija računa preostali posao, zašto zadatak koji je već počeo ponekad još čeka svog prethodnika, i kako uspoređujete trenutno stanje s prvotnim dogovorom. Radni primjer prikazuje brojke.

## Koncept

**Napredak** je ono što se zaista dogodilo. Za svaki zadatak aplikacija bilježi tri stvari: postotak, **stvarni početak** i **stvarni završetak**. Ono što je raspored predvidio ostaje uz to; stvarno je ono što se zaista dogodilo.

**Datum stanja** je dan na koji procjenjujete stanje. Sve što se dogodilo prije tog dana je činjenica. Sve što se još mora dogoditi aplikacija planira od početka tog dana. Stvarni datum može pasti na datum stanja, ali nikad ne smije biti nakon njega.

**Preostali posao** je ono što još treba učiniti na zadatku. Zadatak od 4 radna dana koji je gotov 25% ima 3 radna dana preostalog posla.

**Temeljni plan** je snimka rasporeda u određenom trenutku, obično u trenutku kad je dogovor odobren. Kasnije stavite stvarni raspored uz njega i vidite koliko se izvedba odstupa.

## Kako aplikacija izračunava

Primjer ispod koristi profil izračuna *Open Planner Studio*, s kojim novi projekt računa. Dalje možete pročitati što se razlikuje u profilima Primavera P6 i Microsoft Project.

Aplikacija sama ne pokreće ponovno izračunavanje. Nakon svake promjene napretka ili datuma stanja traka stanja prikazuje *Zastarjelo — ponovno izračunajte (F5)*. Pritisnite *Izračunaj* (F5), na primjer putem *Raspored › Raspored › Izračunaj*. Ako je *Automatsko izračunavanje* uključeno (pod *Postavke › Projekt › Postavke*, kartica *Raspored*, pod naslovom *Izračunavanje*), aplikacija to radi sama.

### Datum stanja

Datum stanja ima tri učinka.

Prvo, aplikacija ne prihvaća stvarni datum nakon datuma stanja. Datum na samom datumu stanja je u redu.

Drugo, posao koji nije počeo ne može ležati u prošlosti. Ako je takav zadatak planiran prije datuma stanja, aplikacija ga pomakne na datum stanja. To vrijedi i za zadatke iza njega, koji se pomiču zajedno preko svojih ovisnosti. Učinak možete vidjeti u primjeru ispod. U profilu Microsoft Project aplikacija to ne čini.

Treće, preostali posao zadatka koji je već u tijeku počinje baš na datumu stanja. Aplikacija datum stanja tretira kao početak tog dana. Ako procjenjujete stanje u petak nakon radnog vremena, zato datum stanja postavite na ponedjeljak. Ako ga postavite na petak, aplikacija i dalje planira preostali posao za taj petak.

Ako još nemate datum stanja, a unesete napredak, aplikacija postavlja datum stanja na danas i to vam javlja. Bez datuma stanja aplikacija računa zadatak koji je u tijeku unaprijed s njegovim preostalim trajanjem, ali unatrag s punim trajanjem. Vremenska rezerva tada ispadne negativna, i zadatak izgleda kritičan bez razloga.

### Postotak, stvarni datumi i preostalo trajanje

Polja ovise jedno o drugom. Ako ispunite jedno, aplikacija popunjava ostala.

- Postotak veći od 0 znači da je zadatak počeo. Ako ne unesete stvarni početak, aplikacija uzima planirani početak. Ako je zadatak planiran da počne nakon datuma stanja, aplikacija prvo pita kad je zapravo počeo.
- Postotak 100 znači dovršeno. Ako ne unesete stvarni završetak, postaje datum stanja, čak i ako je posao zapravo završen ranije.
- Stvarni završetak čini zadatak 100%. Ako dovršeni zadatak vratite na manje od 100%, stvarni završetak se briše. Ako obrišete stvarni završetak, postotak se vraća na 0 i zadatak ostaje *U tijeku* dok ne obrišete i stvarni početak.
- **Preostalo trajanje** je trajanje pomnoženo s onim što još treba učiniti, zaokruženo na cijele radne dane. Za zadatak od 2 radna dana, 0% i 25% daju po 2 radna dana preostalog posla, a 50% i 75% po 1 radni dan. Kod 90% aplikacija zaokružuje na 0: preostali posao je tada završen na datumu stanja. Zadatak u satima broji u cijelim minutama: zadatak od 5 sati na 40% ima 3 sata preostalog posla.
- Kontrolna točka ima samo jedan stvarni datum.
- Faza (zadatak sažetka) nema vlastiti napredak. Nakon izračuna njezin postotak proizlazi iz zadataka ispod nje: ponderirani prosjek njihovih postotaka, pri čemu je trajanje u radnim danima težina. Kontrolna točka ima težinu 0.

Ako promijenite trajanje zadatka koji je već u tijeku, učinjeni rad ostaje učinjen. Postotak se prilagođava: zadatak od 5 radnih dana na 60% koji postavite na 10 radnih dana završi na 30%. Aplikacija ne prihvaća trajanje kraće od već učinjenog rada.

### Dovršeni zadaci i zadaci u tijeku

Dovršeni zadatak je fiksiran na svoje stvarne datume. Ne pomiče se više, i uz datum stanja nikad nije kritičan. Bez datuma stanja dovršeni zadatak može i dalje biti kritičan.

Zadatak u tijeku zadržava svoj stvarni početak. Pomiče se samo preostali posao. Gdje preostali posao počinje, ovisi o načinu praćenja napretka.

### Retained Logic and Progress Override

Što aplikacija čini ako je zadatak već počeo dok je njegov prethodnik još u tijeku? Takva ovisnost zove se **napredak izvan redoslijeda**: napredak je u suprotnosti s redoslijedom. Zamislite soboslikara koji već počinje u sobi koja je već ožbukana, dok je ožbukavač još zauzet na drugom mjestu.

Dva načina praćenja napretka određuju kako aplikacija to računa:

- **Retained Logic** (zadano): ovisnost ostaje na snazi. Preostali posao nasljednika slijedi ovisnost: kod ovisnosti završetak-početak počinje tek kad je prethodnik završen, i nikad prije datuma stanja.
- **Progress Override**: stvarnost ima prednost. Preostali posao nasljednika počinje na datumu stanja, bez čekanja na prethodnika.

U ovom profilu razlika je samo u preostalom poslu zadataka koji su već počeli dok njihov prethodnik još nije završen. Ostali zadaci se u oba načina računaju jednako. Aplikacija takvu ovisnost prijavljuje u oba načina: u traci stanja kao *Ovisnosti izvan redoslijeda: 1* i na panelu *Upozorenja*.

### Temeljni planovi i odstupanja

Kad spremite, aplikacija za svaki zadatak bez podzadataka bilježi najraniji početak, najraniji završetak, trajanje i vrstu kontrolne točke. Zadaci sažetka nisu u njemu. Ono što kasnije promijenite ne utječe na temeljni plan. Možete čuvati više temeljnih planova; točno jedan je **aktivan**. Gantt, izvješće o odstupanjima i izvješće o napretku koriste aktivni temeljni plan.

**Odstupanje** je razlika u radnim danima između temeljnog plana i trenutnog rasporeda. Plus znači kasnije, minus ranije. Aplikacija računa u kalendaru projekta. Izvješće o odstupanjima daje odstupanje početka i završetka po zadatku. Status proizlazi samo iz završetka: *Kasni* za plus, *Ranije* za minus, inače *Prema rasporedu*. Zadatak dodan nakon temeljnog plana zove se *Novo*; zadatak koji više ne postoji je *Uklonjeno*.

Dvije napomene. Odstupanje trajanja je u tablici zadataka (stupac *Odstupanje trajanja*), a ne u izvješću o odstupanjima. Uspoređuje planirano trajanje zadatka sada s trajanjem u temeljnom planu. Napredak ne mijenja to planirano trajanje: zadatak planiran na dva dana koji je trajao tri dana ima zato odstupanje završetka +1, ali odstupanje trajanja 0. Ako spremite temeljni plan nakon što je unesen napredak, zabilježi se stanje s tim stvarnim datumima; odstupanje je tada nula.

Izvješće o napretku stavlja planirani napredak uz stvarni napredak. Oba su ponderirana radnim danima. Planirani napredak je dio svakog zadatka koji je prema temeljnom planu trebao biti završen na datumu stanja. Stvarni napredak je postotak koji je unesen.

### Gdje to vidite

U Gantt dijagramu crtkana linija označava datum stanja, s datumom u zaglavlju. Kod svakog zadatka u tijeku linija se ispupči do točke u traci koju pokazuje postotak. To je **linija napretka**. Ako isključite liniju napretka, a linija datuma stanja ostane uključena, ostaje ravna linija. Kad su obje isključene, nestaju linija i oznaka. Gumbi *Prikaz temeljnog plana*, *Linija napretka* i *Linija datuma stanja* nalaze se pod *Prikaz › Temeljni planovi i napredak* i ništa ne mijenjaju u izračunu. Temeljni plan se prikazuje kao tanka traka ispod svake trake zadatka. Tablica zadataka ima stupce za napredak i, po temeljnom planu, za odstupanje. Na kartici *Izvješće* nalaze se vrste izvješća *Odstupanja* i *Izvješće o napretku*.

## Radni primjer: dogradnja nakon tri tjedna

Primjer je vježbeni projekt *House extension* iz lekcija, u stanju nakon što su dodane sve ovisnosti: bez kolektivnog godišnjeg odmora u građevinarstvu, bez resursa i bez radnih sati. U lekciji 6 sami to radite u vježbenom projektu. Taj projekt do tada ima više sadržaja, pa se brojke tamo razlikuju. Ovdje čitate zašto su brojke takve kakve jesu.

Dogradnja počinje u ponedjeljak 7. lipnja 2027. Na izračunatom rasporedu aplikacija sprema temeljni plan pod nazivom *Temeljni plan*: predaja u petak 6. kolovoza 2027., 45 radnih dana.

### Stanje u ponedjeljak 28. lipnja

Datum stanja je ponedjeljak 28. lipnja 2027. Ovo se dogodilo:

- *Start of construction*, *Set up site*, *Clear garden and paving* i *Set out the extension* su završeni prema planu, od 7. do 10. lipnja.
- *Excavate foundation trench* bio je planiran na 2 radna dana (petak 11. i ponedjeljak 14. lipnja), a trajao je 3: od 11. do 15. lipnja.
- *Foundation formwork and reinforcement* traje od 16. do 18. lipnja. *Reinforcement inspection* je 18. lipnja, *Pour foundation* u ponedjeljak 21. lipnja.
- *Foundation brickwork* (2 radna dana) počeo je u petak 25. lipnja i gotov je 50%.

Nakon *Izračunaj* aplikacija računa ovako:

- Preostali posao za foundation brickwork je 2 × (1 − 0,5) = 1 radni dan. Počinje na datumu stanja, pa završava u ponedjeljak 28. lipnja.
- *Lay hollow-core floor* slijedi u utorak 29. lipnja. Zato *Build inner cavity leaf* počinje u srijedu 30. lipnja umjesto u utorak 29. lipnja. Predaja dolazi u ponedjeljak 9. kolovoza: jedan radni dan kasnije od temeljnog plana. Jedan dodatni dan iskopa je zato kašnjenje cijelog projekta, jer je taj zadatak bio na kritičnom putu.
- Traka stanja prijavljuje *Kritični put: 13 zadataka, trajanje u radnim danima: 46*, u odnosu na 21 zadatak i 45 radnih dana prije unosa napretka. Osam dovršenih zadataka koji su bili na kritičnom putu više se ne broji.
- Faza *Foundations* je na 77,8%. Zadaci u njoj imaju težinu 2 + 3 + 1 + 2 + 1 = 9 radnih dana. Završeno je 2 + 3 + 1 radnih dana, plus polovica od 2: ukupno 7. 7 od 9 je 77,8%. Kontrolna točka *Reinforcement inspection* ima težinu 0.

Izvješće o odstupanjima to stavlja uz temeljni plan:

- *Excavate foundation trench*: početak 0, završetak +1 (završetak u temeljnom planu 14. lipnja, sada 15. lipnja).
- *Foundation brickwork*: početak +1 (24. lipnja postao je 25. lipnja), završetak +1.
- *Build outer cavity leaf*: +1, +1. Taj zadatak još nije kritičan: imao je 2 radna dana vremenske rezerve i zadržava ih.
- *Handover*: +1. Datum završetka projekta odstupa za 1 radni dan.
- Ukupno je 19 zadataka u statusu *Kasni*, a 4 u statusu *Prema rasporedu*. Nijedan zadatak nije u statusu *Ranije*.

Izvješće o napretku prikazuje *Planirano* 28,3% i *Stvarno* 23,9%. Zadaci zajedno teže 46 radnih dana. Prema temeljnom planu trebalo je biti završeno 13: 4 radna dana u pripremi, 2 za iskop, 3 za armaturu, 1 za lijevanje, 2 za foundation brickwork i 1 za hollow-core floor. Zapravo je završeno 11: 4 + 2 + 3 + 1, plus polovica dana za foundation brickwork.

### Što ako pomaknete datum stanja?

Isti napredak, drugi datum stanja. Preostali posao za foundation brickwork uvijek počinje na datumu stanja, pa se predaja pomiče s njim:

- Datum stanja petak 25. lipnja: preostali posao pada u petak 25. lipnja, predaja ostaje u petak 6. kolovoza.
- Ponedjeljak 28. lipnja: predaja u ponedjeljak 9. kolovoza.
- Utorak 29. lipnja: predaja u utorak 10. kolovoza, 2 radna dana kasnije od temeljnog plana.

### Što ako promijenite postotak?

Foundation brickwork ima 2 radna dana. Na 0% ili 25% preostali posao je 2 radna dana: završava u utorak 29. lipnja, a predaja postaje u utorak 10. kolovoza. Na 50% ili 75% je 1 radni dan: ponedjeljak 28. lipnja, predaja u ponedjeljak 9. kolovoza. Na 90% preostali posao je 0, a zadatak završava na datumu stanja.

### Što ako postavite datum stanja bez unosa napretka?

Ako samo postavite datum stanja na ponedjeljak 28. lipnja i ništa ne unesete, prema rasporedu se još ništa nije dogodilo. Posao koji nije počeo ne može ležati u prošlosti. Aplikacija zato sve pomakne na 28. lipnja: *Start of construction* je tada na tom danu, a predaja dolazi u petak 27. kolovoza, 15 radnih dana nakon temeljnog plana. Zato prvo unesite napredak koji postoji.

## Primjer: žbukar i soboslikar

Sada primjer za način praćenja napretka. Isti primjer dogradnje, drugo stanje: danas je srijeda, 21. srpnja 2027. Sve do i uključujući *Install building services* završeno je prema planu. Zadatak *Plastering* (4 radna dana) počeo je u utorak 20. srpnja i napredak mu je 25%. *Painting* (3 radna dana) slijedi nakon zadatka *Plastering*, ali soboslikar je danas već počeo i napredak mu je 33%.

Bez napretka je zadatak *Plastering* bio planiran od utorka 20. do petka 23. srpnja, a zadatak *Painting* od ponedjeljka 26. do srijede 28. srpnja. Traka stanja sada prikazuje *Ovisnosti izvan redoslijeda: 1*: zadatak *Painting* je počeo dok *Plastering* nije završen. U oknu *Upozorenja* piše: *Izvan redoslijeda: napredak nasljednika proturječi ovisnosti*.

Zadatak *Plastering* ima 4 × (1 − 0.25) = 3 radna dana preostalog posla: 21., 22. i 23. srpnja. Zadatak *Painting* ima 3 × (1 − 0.33) = 2 radna dana preostalog posla.

- Uz **Retained Logic** preostali posao može početi tek kad je zadatak *Plastering* završen. To je petak 23. srpnja, pa *Painting* počinje u ponedjeljak 26. srpnja i završava u utorak 27. srpnja. Traka se proteže od stvarnog početka 21. srpnja do 27. srpnja. Ukupan slobodni hod je 7 radnih dana.
- Uz **Progress Override** preostali posao počinje na datumu stanja. Zadatak *Painting* završava u četvrtak 22. srpnja, prije nego što je *Plastering* završen. Ukupan slobodni hod je 10 radnih dana.

Predaja ostaje u petak 6. kolovoza u oba slučaja: zadatak *Painting* je ionako imao vremensku rezervu.

### Ostali profili izračuna

U profilima izračuna Primavera P6 i Microsoft Project zadatak *Painting* u ovom primjeru završava na istim datumima (27. i 22. srpnja). Razlikuju se u sljedećim točkama. To su pravila izračuna profila. Nalazite ih pod *Postavke › Projekt › Podaci o projektu*, u odjeljku *Profil izračuna i opcije izračuna*.

- U profilu Microsoft Project zadatak koji nije započeo ne pomiče se na datum stanja (pravilo izračuna *Nezapočeti zadaci se ne pomiču na datum stanja*). Ako u gornjem primjeru samo postavite datum stanja i ništa ne unesete, predaja u tom profilu ostaje u petak 6. kolovoza.
- U profilu Microsoft Project preostali posao također ne počinje ranije od stvarnog početka plus već proteklo vrijeme (pravilo izračuna *Preostali posao nastavlja se nakon proteklog vremena*). To je dodatna donja granica uz datum stanja: vrijedi kasniji od ta dva. Uzmite zadatak *Build inner cavity leaf* (5 radnih dana). Počeo je u utorak 29. lipnja. Na srijedu 30. lipnja, datum stanja, zadatak je gotov 40% (dvije ekipe zidaju istodobno, pa je 40% već gotovo nakon jednog dana). Sve prije njega završeno je prema planu. Open Planner Studio i Primavera P6 dopuštaju da zadatak završi u petak 2. srpnja. Microsoft Project ga završava u ponedjeljak 5. srpnja, jer utorak 29. lipnja plus 2 radna dana proteklog vremena je četvrtak 1. srpnja, a to je nakon datuma stanja.
- Primavera P6 kao najraniji početak zadatka u tijeku prikazuje početak preostalog posla, a ne stvarni početak (u primjeru unutarnjeg zida srijeda 30. lipnja).
- U profilu Primavera P6 vrijedi pod Progress Override da se ovisnost prema nasljedniku koji je već započeo ne računa ni za prethodnika: više ne ograničava njegove kasne datume ni njegov slobodni hod (pravilo izračuna *Progress Override ignorira započetog nasljednika i unatrag*). U primjeru žbukara i soboslikara to ne vidite, jer je zadatak *Plastering* ionako kritičan preko estriha: njegovi kasni datumi i slobodni hod isti su pod Retained Logic i pod Progress Override.
- Kad otvorite .xer file, aplikacija preuzima način praćenja napretka iz datoteke. Actual Dates, treći način P6, aplikaciji nije poznat. Takva se datoteka izračunava kao Retained Logic.

## Posljedice i nesporazumi

**„Samo ću pomaknuti datum stanja.“** Ako ga pomaknete, preostali posao zadataka u tijeku počinje na novom datumu, a zadatak koji još nije započeo ne može nikad biti prije tog datuma. Zato datum stanja pomičite samo zajedno s ažuriranjem napretka.

**„Unos 100% bilježi stvarni završetak.“** Samo ako i stvarni završetak unesete. Ako zadatak postavite na 100% bez stvarnog završetka, njegov završetak postaje datum stanja. Ako je zadatak zapravo završen ranije, unesite stvarni završetak.

**„0% znači da nije započeo.“** Ako zadatak ima stvarni početak, računa se kao započet, čak i pri 0%. Preostali posao je tada cijelo trajanje i počinje na datumu stanja. Obrišite stvarni početak da se zadatak ponovno računa kao nezapočet.

**„Progress Override rješava upozorenje.“** Poruka o napretku izvan redoslijeda ostaje. Način praćenja napretka samo određuje kako aplikacija izračunava. Ako ovisnost više nije ispravna, promijenite ovisnost.

**„Stanka u podijeljenom zadatku otpada.“** Ne: stanka u dijelu koji tek treba obaviti ostaje u preostalom poslu. Uzmite zadatak od 5 radnih dana s 1-dnevnom stankom nakon 2 dana rada, započet u utorak 29. lipnja. S datumom stanja u srijedu 30. lipnja zadatak je 40% gotov. Preostali posao od 3 radna dana počinje na datumu stanja i prolazi kroz stanku: završetak je ponedjeljak 5. srpnja. Bez stanke bi to bio petak 2. srpnja.

**Sati i datum stanja.** U vrpci ne možete unijeti vrijeme: datum stanja unosite kao datum. Ako stanje pregledate nakon radnog vremena, postavite datum stanja na sljedeći radni dan. Zadatak u satima računa preostali posao od početka datuma stanja. Uzmite *Lay hollow-core floor* u vježbenom projektu nakon lekcije 4: 5 sati, u ponedjeljak 28. lipnja, radni dan od 07:00. S datumom stanja u ponedjeljak 28. lipnja i zadatkom na 40% ima 3 sata preostalog posla, koji teče od 07:00 do 10:00, čak i ako je tog jutra već nešto odrađeno. Kako aplikacija računa sate, objašnjeno je u [Dani i sati](docs://uitleg-dagen-en-uren).

**Ažuriranje temeljnog plana.** To nije moguće. Spremite novi temeljni plan i izbrišite stari. Ako premjestite projekt, stvarni datumi i datum stanja pomiču se zajedno, ali temeljni planovi po zadanim postavkama ostaju na mjestu: tako pomak ostaje vidljiv kao odstupanje. Pogledajte [Premještanje projekta](docs://howto-project-verplaatsen).

## Vidi također

- [Ažuriranje napretka](docs://howto-voortgang-bijwerken): postavljanje datuma stanja i unos napretka.
- [Uvoz napretka iz proračunske tablice](docs://howto-voortgang-importeren): čitanje napretka koji prijavljuju radnici na gradilištu, u jednom koraku.
- [Odabir načina praćenja napretka](docs://howto-voortgangsmodus-kiezen): postavljanje Retained Logic ili Progress Override.
- [Spremanje i upravljanje temeljnim planom](docs://howto-baseline-opslaan-en-beheren): bilježenje temeljnog plana i njegova upotreba.
- [Premještanje projekta](docs://howto-project-verplaatsen): što se događa sa stvarnim datumima, datumom stanja i temeljnim planovima.
- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): zašto je zadatak kritičan i što znači vremenska rezerva.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): napredak i datum stanja usred projekta (20. svibnja 2027.).
