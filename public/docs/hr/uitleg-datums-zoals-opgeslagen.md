# Datumi kako su zapisani

Otvarate raspored iz programa Primavera ili MS Project, a datumi se razlikuju od onih koje ste vidjeli u tom programu. Je li uvoz pošao krivo? Obično ne. U ovom članku saznajete zašto aplikacija sama ponovno izračunava, kada prikazuje datume iz datoteke, što tada ostaje prazno i kako se vraćate na vlastiti izračun. Primjer na kraju prati dva zadatka kroz cijeli postupak.

## Koncept

Datoteka rasporeda sadrži dvije vrste podataka. Prvo logiku: zadatke, trajanja, ovisnosti, kalendare i ograničenja. Drugo datume koje je sam program iz toga izračunao. Pri otvaranju Open Planner Studio koristi logiku i sam izračunava. Zato datumi u datoteci nisu ulazni podaci.

Ako vlastiti izračun dovede do drugih datuma nego što datoteka navodi, ne znate koja strana je u pravu. Datoteci možda nedostaje logika koju je program koristio. Program je možda također na nekoj točki izračunavao drukčije od aplikacije. Zato aplikacija može prikazati datume **kako su zapisani**: datume koje je drugi program upisao u datoteku. Tako uspoređujete s onim što ste vidjeli u tom programu.

## Kako aplikacija to rješava

### Koji profil izračuna aplikacija koristi

Aplikacija izračunava s **profilom izračuna**: skupom pravila izračuna (pravila izračuna) koji određuje, na primjer, kako se postupa s planiranim početkom zadatka i s ograničenjima. Pogledajte [Profili izračuna i pravila izračuna](docs://uitleg-rekenprofielen). Postoje tri ugrađena profila: *Primavera P6*, *Microsoft Project* i *Open Planner Studio*. Datoteka `.xer` otvara se s *Primavera P6*, a `.mpp` s *Microsoft Project*. CSV, MS Project XML i Primavera P6 XML otvaraju se s *Open Planner Studio*. Profil projekta nalazi se u *Datoteka › Postavke projekta*, u dijelu *Profil izračuna i opcije izračuna*. IFC datoteka iz aplikacije zadržava svoj profil.

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

Tu je i poruka: *12 zadataka prikazuje datume onako kako su zapisani u datoteci (nisu ponovno izračunati).* Samo uz `.xer` piše *12 zadataka prikazuje datume onako kako ih je Primavera spremila (nisu ponovno izračunati).* Taj broj obuhvaća svaki zadatak za koji su datumi zapisani u datoteci, uključujući zadatke koji se ne razlikuju. Broj zadataka koji se razlikuju nakon ponovnog izračunavanja nalazi se na traci. Svaki zadatak za koji su datumi zapisani u datoteci prikazuje narančasti blok u okviru *Svojstva*, odmah iznad *Početak*: *Vidite datume koje je Primavera spremila, a ne izračun aplikacije.* S drugim izvorom piše *Vidite datume koji su bili u datoteci, a ne izračun aplikacije.* Drugi redak kaže što se događa s ovim zadatkom kad ponovno izračunate: *Ponovno izračunavanje mijenja ovaj zadatak.* ili *Ponovno izračunavanje ovaj zadatak ne mijenja.* Gantt, tablica zadataka i traka stanja prikazuju datume iz datoteke.

### Zadaci koji su započeli ili su završeni

Zadatak koji je završen nalazi se na danima kada se stvarno odvijao: od stvarnog početka do stvarnog završetka. Zadatak koji je u tijeku počinje na danu kada je stvarno počeo. Završava se na izračunatom završetku. To vrijedi u ovom prikazu, nakon ponovnog izračunavanja i uz svaki profil izračuna, kao u Primaveri i MS Projectu.

Za takav zadatak datoteka često zapisuje druge najranije datume. Primavera stavlja najraniji početak zadatka koji je u tijeku ili je završen na datum stanja. Te datume vidite u stupcima *Najraniji početak* i *Najraniji završetak*, a ne u *Početak* i *Završetak*. Zadatak koji je završen zato se nikada ne ubraja kao razlika. Zadatak koji je u tijeku ubraja se samo kad se razlikuje njegov završetak.

Za zadatak koji je započeo više ne možete upisati početak. U tablici zadataka, u okviru *Svojstva* i u *Uredi zadatak* početak je tada samo za čitanje. Za zadatak koji je završen to vrijedi i za završetak u tablici zadataka. Umjesto toga promijenite *Stvarni početak* ili *Stvarni završetak*, s napretkom. U dijagramu Gantt traka takvog zadatka se ne pomiče; tada dobijete poruku.

### Što u ovom prikazu ostaje prazno

U ovom prikazu aplikacija ništa ne izračunava. Prikazuje samo ono što je datoteka zapisala. Zato vidite vremensku rezervu i kritični put samo ako ih datoteka sadrži. Ako datoteka ne zapisuje kritične zadatke, traka stanja prikazuje 0 kritičnih zadataka. To ništa ne govori o kritičnom putu u samom programu. Ono što nastaje samo pri izračunu u ovom prikazu ne postoji: koje ovisnosti upravljaju rasporedom, prekršena ograničenja, zadaci koji nisu u redoslijedu i gotovo kritični zadaci.

Ako datoteka za zadatak ne zapisuje sve, narančasti blok u okviru *Svojstva* dobiva treći redak, na primjer *Primavera za ovaj zadatak nije spremila sve podatke. Nedostaje: slobodni hod.* S drugim izvorom piše *Datoteka za ovaj zadatak nema sve podatke.* Prva dva retka ostaju: za takav zadatak i dalje vidite da datumi dolaze iz datoteke i hoće li se zadatak promijeniti pri ponovnom izračunavanju. Nedostajuće vrijednosti nose ista imena kao stupci u tablici zadataka. U CSV izvozu stupci *Kritični* i *Ukupan slobodni hod* ostaju prazni za takav zadatak, umjesto izmišljene nule.

### Izlazak iz prikaza

Iz prikaza izlazite na dva načina:

- Kliknite *Ponovno izračunaj* na traci ili odaberite *Izračunaj* (F5). Aplikacija izračunava vlastitim pravilima.
- Promijenite nešto što može promijeniti datume, na primjer trajanje zadatka ili novi zadatak. Aplikacija napušta prikaz i odmah ponovno izračunava, čak i ako je *Automatsko izračunavanje* isključeno. Promjena naziva, opisa, kategorije radova ili vrste zadatka to ne čini: prikaz ostaje uključen.

Promjena kalendara iz biblioteke resursa ostavlja prikaz uključenim i datume iz datoteke nepromijenjenima, ali ažurira broj na traci.

Nakon izlaska nema gumba za povratak u prikaz. Ctrl+Z ga vraća, ali samo odmah nakon ponovnog izračunavanja ili takve izmjene. Inače možete ponovno otvoriti izvornu datoteku. Uz `.xer` otvaranje IFC datoteke koju ste spremili nakon ponovnog izračunavanja, ali je niste uređivali, također ponovno uključuje prikaz.

### Oporavak od pada

Ako oporavite projekt nakon pada dok je bio u prikazu, prikaz ostaje uključen. Ako prikaz nije bio uključen, aplikacija zaboravlja datume iz datoteke. Aktivni projekt prikazuje istu traku kao prije. Projekt na drugoj kartici prikazuje traku bez broja: *Prikazujete datume onako kako su zapisani u datoteci. Ništa nije ponovno izračunato.* Pogledajte [Oporavak od pada](docs://howto-herstellen-na-een-crash).

### Spremanje i ponovno otvaranje

Ako spremite dok koristite prikaz, aplikacija u IFC datoteku upisuje prikazane datume, zajedno s izvornim formatom. Ako tu IFC datoteku kasnije ponovno otvorite, prikaz je ponovno uključen, bez nove poruke. To vrijedi i ako ste u prikazu promijenili nešto što ne utječe na datume, na primjer naziv. Aplikacija otvara datoteku onako kako ste je ostavili.

Ako spremite nakon izlaska iz prikaza, bilo ponovnim izračunavanjem, bilo uređivanjem koje može promijeniti datume, datoteka sadrži vlastiti izračun aplikacije. Pri ponovnom otvaranju vidite taj izračun, bez trake i bez bloka u okviru *Svojstva*. Jedna iznimka je `.xer` koji ste samo ponovno izračunali i niste uredili (vidi gore). Uređeni raspored sada je vaš raspored; stari datumi iz izvornog programa više mu ne pripadaju. Ako ih i dalje želite vidjeti, ponovno otvorite izvornu datoteku.

## Primjer: dogradnja

Pretpostavimo da otvorite datoteku Primavera *Uitbouw* (dogradnja) s dva zadatka, na kalendaru bez praznika. U 2027. je 6. svibnja Uzašašće Gospodnje, a 17. svibnja Duhovski ponedjeljak: s praznicima u kalendaru datumi ispadnu drukčije. *Fundering storten* (ulijevanje temelja) traje 5 radnih dana, *Metselwerk* (zidanje) 10 radnih dana, a Metselwerk slijedi nakon Fundering s ovisnošću završetak-početak. Datoteka zapisuje da Fundering traje od ponedjeljka 3. svibnja do petka 7. svibnja 2027., a Metselwerk od ponedjeljka 17. svibnja do petka 28. svibnja 2027.: tjedan dana nakon najranijeg početka koji ovisnost dopušta. Planirani početak za Metselwerk u datoteci je ponedjeljak 10. svibnja 2027.

Odmah nakon otvaranja vidite datume iz datoteke. Traka stanja prikazuje *Završetak: 28-05-2027* i *Kritični put: 2 zadatka, trajanje u radnim danima: 20*. Traka javlja da se pri ponovnom izračunavanju razlikuje 1 zadatak. Oba zadatka prikazuju narančasti blok *Vidite datume koje je Primavera spremila, a ne izračun aplikacije.* Ispod njega, Metselwerk kaže *Ponovno izračunavanje mijenja ovaj zadatak.*, a Fundering kaže *Ponovno izračunavanje ovaj zadatak ne mijenja.*

Kada kliknete *Ponovno izračunaj*, Fundering ostaje od 3. do 7. svibnja. Metselwerk sada počinje u ponedjeljak 10. svibnja, sljedeći radni dan nakon završetka Fundering, i završava u petak 21. svibnja. Raspored završava 21. svibnja 2027. i traje 15 radnih dana umjesto 20. Kritični put čine ista 2 zadatka.

Što ako je drukčije?

- Ako je Metselwerk u datoteci također planiran za ponedjeljak 17. svibnja, profil izračuna *Primavera P6* zadržava taj početak. Izračun daje Metselwerk od 17. do 28. svibnja, nema razlike i prikaz se ne uključuje.
- Dodate zadatak u prikazu: isto ponovno izračunavanje. Metselwerk se pomakne na 10. do 21. svibnja.
- Spremite u prikazu i ponovno otvorite IFC datoteku, bez uređivanja: Metselwerk je opet od 17. do 28. svibnja.
- Ponovno izračunate, spremite bez daljnjeg uređivanja i ponovno otvorite IFC datoteku: prikaz je opet uključen i Metselwerk je od 17. do 28. svibnja.
- U prikazu samo promijenite naziv zadatka *Metselwerk*, spremite i ponovno otvorite: prikaz je opet uključen i Metselwerk je od 17. do 28. svibnja.
- Dodate zadatak u prikazu, spremite i ponovno otvorite: aplikacija zaboravlja datume iz datoteke. Metselwerk je od 10. do 21. svibnja, bez trake i bez bloka.
- Fundering je već završen u datoteci: stvarno je počeo 3. svibnja, a stvarno je završio 7. svibnja. Datoteka datum stanja zapisuje kao najraniji početak tog zadatka. Traka zadatka Fundering i dalje je od 3. do 7. svibnja, u prikazu i nakon ponovnog izračunavanja. Fundering se ne ubraja kao razlika.

## Posljedice i pogrešna tumačenja

**Razlika nije greška pri uvozu.** Aplikacija izračunava vlastitim pravilima: s `.xer` s profilom izračuna *Primavera P6*, s `.mpp` s *Microsoft Project*, s CSV-om, MS Project XML-om i Primavera P6 XML-om s *Open Planner Studio*. Zašto su datumi u izvornom programu ispali drukčije, može biti do datoteke ili do programa. Prikaz vam pokazuje *da* se razlikuju.

**Prikaz nije rezultat izračuna.** Aplikacija datume nije izračunala. Nemojte ih jednostavno preuzeti kao ishod vlastitog rasporeda.

**Spremanje u prikazu zadržava datume izvornog programa.** IFC datoteka tada sadrži ono što je izvorni program zapisao, a ne ono što bi aplikacija izračunala.

**Nakon uređivanja koje može promijeniti datume, datumi iz datoteke ne vraćaju se.** Ako ste prikaz napustili takvim uređivanjem, nakon spremanja i ponovnog otvaranja vidite samo izračun same aplikacije. Promjena naziva se ne ubraja: prikaz tada ostaje uključen (vidi *Spremanje i ponovno otvaranje*). Ako želite vidjeti datume iz izvornog programa, ponovno otvorite izvornu datoteku.

## Pogledajte i

- [Datoteke i formati](docs://uitleg-bestanden): što aplikacija zadržava u datoteci i što uvoz ili izvoz nosi.
- [Otvaranje datoteke Primavera P6 (.xer)](docs://howto-xer-openen): koraci i poruke za datoteku `.xer`.
- [Otvaranje datoteke MS Project (.mpp)](docs://howto-mpp-openen): koraci i poruke za datoteku `.mpp`.
- [Oporavak od pada](docs://howto-herstellen-na-een-crash): što se događa s ovim projektom nakon pada.
- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): kako aplikacija izračunava vremensku rezervu i kritičnost kada zaista izračunava.
