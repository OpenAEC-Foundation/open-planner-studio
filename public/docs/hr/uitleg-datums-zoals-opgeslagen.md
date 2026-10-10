# Datumi kako su zapisani

Otvarate raspored iz programa Primavera ili MS Project, a datumi se razlikuju od onih koje ste vidjeli u tom programu. Je li uvoz pošao krivo? Obično ne. U ovom članku saznajete zašto aplikacija sama ponovno izračunava, kada prikazuje datume iz datoteke, što tada ostaje prazno i kako se vraćate na vlastiti izračun. Primjer na kraju prati dva zadatka kroz cijeli postupak.

## Koncept

Datoteka rasporeda sadrži dvije vrste podataka. Prvo logiku: zadatke, trajanja, ovisnosti, kalendare i ograničenja. Drugo datume koje je sam program iz toga izračunao. Pri otvaranju Open Planner Studio koristi logiku i sam izračunava. Zato datumi u datoteci nisu ulazni podaci.

Ako vlastiti izračun dovede do drugih datuma nego što datoteka navodi, ne znate koja strana je u pravu. Datoteci možda nedostaje logika koju je program koristio. Program je možda također na nekoj točki izračunavao drukčije od aplikacije. Zato aplikacija može prikazati datume **kako su zapisani**: datume koje je drugi program upisao u datoteku. Tako uspoređujete s onim što ste vidjeli u tom programu.

## Kako aplikacija to rješava

### Koji profil izračuna aplikacija koristi

Aplikacija izračunava s **profilom izračuna**: skupom pravila izračuna (pravila izračuna) koja određuju, na primjer, kako se postupa s planiranim početkom zadatka i s ograničenjima. Pogledajte [Profili izračuna i pravila izračuna](docs://uitleg-rekenprofielen). Postoje tri ugrađena profila: *Primavera P6*, *Microsoft Project* i *Open Planner Studio*. Datoteka `.xer` otvara se s *Primavera P6*, a `.mpp` s *Microsoft Project*. CSV, MS Project XML i Primavera P6 XML otvaraju se s *Open Planner Studio*. Profil projekta nalazi se u *Datoteka › Podaci o projektu*, pod *Profil izračuna i opcije izračuna*. IFC datoteka iz aplikacije zadržava svoj profil.

### Kada aplikacija uspoređuje

Pri otvaranju aplikacija bilježi što je datoteka navodila i uspoređuje to sa svojim rezultatom. To radi za:

- datoteku Primavera (`.xer`) i Primavera P6 XML;
- MS Project XML i datoteke MS Project (`.mpp`);
- IFC datoteku iz drugog programa, za zadatke čiji su najraniji datumi u datoteci;
- IFC datoteku iz same aplikacije koja je zapamtila svoje podrijetlo. Dolje čitate kada je to slučaj.

Aplikacija nikada ne uspoređuje CSV datoteku: datum početka u CSV-u je ulazni podatak, a ne rezultat izračuna. Ni IFC datoteka iz same aplikacije bez zapamćenog podrijetla ne uspoređuje se.

Ako se nijedan zadatak ne razlikuje, ništa ne primjećujete. Ako se barem jedan zadatak razlikuje u datoteci koju upravo uvozite, aplikacija odmah uključuje prikaz.

Uz datoteku Primavera aplikacija izračunava s profilom izračuna *Primavera P6*. Taj profil zadržava planirani početak iz datoteke kao najraniji početak. Zadatak koji je u datoteci kasniji nego što ovisnosti zahtijevaju, ali je tamo također planiran, zato ostaje gdje jest: tada nema razlike.

### Što vidite

Ispod vrpce nalazi se traka: *Prikazujete datume onako kako su zapisani u datoteci; pri ponovnom izračunavanju pomaknut će se 4 zadatka.* Uz izvor Primavera (`.xer` ili Primavera P6 XML) piše *Prikazujete raspored onako kako ga je Primavera spremila; pri ponovnom izračunavanju pomaknut će se 1 zadatak.* Desno na traci nalazi se gumb *Ponovno izračunaj*. Traka nema križić.

Tu je i poruka: *4 zadatka prikazuju datume onako kako su zapisani u datoteci (nisu ponovno izračunati).* Samo uz `.xer` piše *1 zadatak prikazuje datume onako kako ih je Primavera spremila (nisu ponovno izračunati).* Svaki zadatak za koji su datumi zapisani u datoteci prikazuje oznaku u okviru *Svojstva*: *Prikazuje datume koje je Primavera sama spremila za ovaj zadatak* uz izvor Primavera, ili *Prikazuje datume kako su za ovaj zadatak zapisani u datoteci* uz drugi izvor. Gantt, tablica zadataka i traka stanja prikazuju datume iz datoteke.

### Što u ovom prikazu ostaje prazno

U ovom prikazu aplikacija ništa ne izračunava. Prikazuje samo ono što je datoteka zapisala. Zato vidite vremensku rezervu i kritični put samo ako ih datoteka sadrži. Ako datoteka ne zapisuje kritične zadatke, traka stanja prikazuje 0 kritičnih zadataka. To ništa ne govori o kritičnom putu u samom programu. Ono što nastaje samo pri izračunu u ovom prikazu ne postoji: koje ovisnosti upravljaju rasporedom, prekršena ograničenja, zadaci koji nisu u redoslijedu i gotovo kritični zadaci.

Ako datoteka za zadatak ne zapisuje sve, u okviru *Svojstva* vidite oznaku *Zapis je djelomično nepotpun — pogledajte stupce za kasne datume i vremensku rezervu*. U CSV izvozu stupci *Kritični* i *Ukupan slobodni hod* ostaju prazni za takav zadatak, umjesto izmišljene nule.

### Izlazak iz prikaza

Iz prikaza izlazite na dva načina:

- Kliknite *Ponovno izračunaj* na traci ili odaberite *Izračunaj* (F5). Aplikacija izračunava vlastitim pravilima.
- Promijenite nešto što može promijeniti datume, na primjer trajanje zadatka ili novi zadatak. Aplikacija napušta prikaz i odmah ponovno izračunava, čak i ako je *Automatsko izračunavanje* isključeno. Promjena naziva to ne čini: prikaz ostaje uključen.

Nakon izlaska nema gumba za povratak u prikaz. Ctrl+Z ga vraća, ali samo odmah nakon ponovnog izračunavanja ili takve izmjene. Inače možete ponovno otvoriti izvornu datoteku. Uz `.xer` otvaranje IFC datoteke koju ste spremili nakon ponovnog izračunavanja, ali je niste uređivali, također ponovno uključuje prikaz.

### Oporavak od pada

Ako oporavite projekt nakon pada dok je bio u prikazu, prikaz ostaje uključen. Aktivni projekt prikazuje istu traku kao prije. Projekt na drugoj kartici prikazuje traku bez broja: *Prikazujete datume onako kako su zapisani u datoteci. Ništa nije ponovno izračunato.* Pogledajte [Oporavak od pada](docs://howto-herstellen-na-een-crash).

### Spremanje i ponovno otvaranje

Ako spremite dok koristite prikaz, aplikacija u IFC datoteku upisuje prikazane datume, zajedno s izvornim formatom. Ako tu IFC datoteku kasnije ponovno otvorite i od uvoza je niste uredili, prikaz je ponovno uključen, bez nove poruke.

Ako ste u međuvremenu uređivali i spremili, ovisi o izvoru. Uz datoteku Primavera IFC datoteka zadržava i izvorni `.xer`. Aplikacija tada ponovno uspoređuje i nudi prikaz: *Ponovno izračunavanje pomaknulo je 1 zadatak od ukupno 2 u odnosu na datume u datoteci.* Uz to dolaze gumb *Prikaži spremljene datume* i križić. Na svakom zadatku koji odstupa okvir *Svojstva* prikazuje oznaku *Odstupa od spremljenih datuma*. *Prikaži spremljene datume* uključuje prikaz; Ctrl+Z to poništava. Križić skriva ponudu.

Uz MS Project XML, `.mpp`, Primavera P6 XML ili IFC datoteku iz drugog programa, IFC datoteka ne zadržava izvor. Ako uređujete i spremite takav projekt, aplikacija pri ponovnom otvaranju više ne uspoređuje.

## Primjer: dogradnja

Pretpostavimo da otvorite datoteku Primavera *Uitbouw* (dogradnja) sa dva zadatka, na kalendaru bez praznika. U 2027. je 6. svibnja Uzašašće Gospodnje, a 17. svibnja Duhovski ponedjeljak: s praznicima u kalendaru datumi ispadnu drukčije. *Fundering storten* (ulijevanje temelja) traje 5 radnih dana, *Metselwerk* (zidanje) 10 radnih dana, a Metselwerk slijedi nakon Fundering s ovisnošću završetak-početak. Datoteka zapisuje da Fundering traje od ponedjeljka 3. svibnja do petka 7. svibnja 2027., a Metselwerk od ponedjeljka 17. svibnja do petka 28. svibnja 2027.: tjedan dana nakon najranijeg početka koji ovisnost dopušta. Planirani početak za Metselwerk u datoteci je ponedjeljak 10. svibnja 2027.

Odmah nakon otvaranja vidite datume iz datoteke. Traka stanja prikazuje *Završetak: 28-05-2027* i *Kritični put: 2 zadatka, trajanje u radnim danima: 20*. Traka javlja da se pri ponovnom izračunavanju 1 zadatak razlikuje, a oba zadatka prikazuju *Prikazuje datume koje je Primavera sama spremila za ovaj zadatak*.

Kad kliknete *Ponovno izračunaj*, Fundering ostaje od 3. do 7. svibnja. Metselwerk sada počinje u ponedjeljak 10. svibnja, sljedeći radni dan nakon završetka Fundering, i završava u petak 21. svibnja. Raspored završava 21. svibnja 2027. i traje 15 radnih dana umjesto 20. Kritični put čine ista 2 zadatka.

Što ako je drukčije?

- Ako je Metselwerk u datoteci također planiran za ponedjeljak 17. svibnja, profil izračuna *Primavera P6* zadržava taj početak. Izračun daje Metselwerk od 17. do 28. svibnja, nema razlike i prikaz se ne uključuje.
- Dodate zadatak u prikazu: isto ponovno izračunavanje. Metselwerk se pomakne na 10. do 21. svibnja.
- Spremite u prikazu i ponovno otvorite IFC datoteku, bez uređivanja: Metselwerk je opet od 17. do 28. svibnja.
- Ponovno izračunate, spremite bez daljnjeg uređivanja i ponovno otvorite IFC datoteku: prikaz je opet uključen i Metselwerk je od 17. do 28. svibnja.
- Uredite, spremite i ponovno otvorite: aplikacija nudi prikaz uz *Ponovno izračunavanje pomaknulo je 1 zadatak od ukupno 2 u odnosu na datume u datoteci.* Metselwerk prikazuje *Odstupa od spremljenih datuma*.

## Posljedice i pogrešna tumačenja

**Razlika nije greška pri uvozu.** Aplikacija izračunava vlastitim pravilima: s `.xer` s profilom izračuna *Primavera P6*, s `.mpp` s *Microsoft Project*, s CSV-om, MS Project XML-om i Primavera P6 XML-om s *Open Planner Studio*. Zašto su datumi u izvornom programu ispali drukčije, može biti do datoteke ili do programa. Prikaz vam pokazuje *da* se razlikuju.

**Prikaz nije rezultat izračuna.** Aplikacija datume nije izračunala. Nemojte ih jednostavno preuzeti kao ishod vlastitog rasporeda.

**Spremanje u prikazu zadržava datume izvornog programa.** IFC datoteka tada sadrži ono što je izvorni program zapisao, a ne ono što bi aplikacija izračunala.

**Gumb *Prikaži spremljene datume* ne pojavljuje se pri svakom uvozu.** Kod novo otvorene datoteke prikaz je već uključen. Gumb se pojavljuje samo kod ponovno otvorene IFC datoteke s izvorom Primavera koju ste od uvoza uredili.

## Pogledajte i

- [Datoteke i formati](docs://uitleg-bestanden): što aplikacija zadržava u datoteci i što uvoz ili izvoz nosi.
- [Otvaranje datoteke Primavera P6 (.xer)](docs://howto-xer-openen): koraci i poruke za datoteku `.xer`.
- [Otvaranje datoteke MS Project (.mpp)](docs://howto-mpp-openen): koraci i poruke za datoteku `.mpp`.
- [Oporavak od pada](docs://howto-herstellen-na-een-crash): što se događa s ovim projektom nakon pada.
- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): kako aplikacija izračunava vremensku rezervu i kritičnost kada zaista izračunava.
