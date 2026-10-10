# Profili izračuna i pravila izračuna

Isti raspored može dati različite datume, ovisno o tome koji način izračuna primijenite. Ovaj članak objašnjava zašto se Primavera P6 i Microsoft Project na nekoliko točaka izračunavaju različito, kako aplikacija tu razliku bilježi u **profilu izračuna** i kako se profil razlikuje od opcija izračuna koje sami postavljate za svaki projekt. Računski primjer s jednom malom mrežom pokazuje što to znači za datume.

## Koncept

Zadaci, ovisnosti i kalendar određuju većinu rasporeda, ali ne sve. Što se događa s radom koji nije počeo kada postavite datum stanja? Gdje počinje preostali posao zadatka koji je već u tijeku? Koliki je slobodni hod zadatka kada se propusti rok za dovršetak? Mreža o tome ništa ne kaže. Program za izradu rasporeda mora za to odabrati pravilo. Aplikacija zna nekoliko točaka u kojima se pravilo programa Primavera P6 i pravilo programa Microsoft Project razlikuju.

Aplikacija takav izbor naziva **pravilom izračuna**. **Profil izračuna** je skup pravila izračuna koji pripada jednom programu. Aplikacija ima tri profila:

- *Open Planner Studio*: profil s kojim se izračunava novi projekt. Nijedno pravilo izračuna nije uključeno.
- *Primavera P6*: pravila izračuna koja aplikacija poznaje iz programa P6.
- *Microsoft Project*: pravila izračuna koja aplikacija poznaje iz programa Microsoft Project.

Profil dakle kaže kako program izračunava. Ono što želite za svoj projekt nije dio profila. To su **opcije izračuna**: izbori, na primjer koliko mala vremenska rezerva zadatak čini kritičnim ili u kojem se kalendaru računa vrijeme odgode. Te opcije postavljate za svaki projekt.

## Kako aplikacija izračunava

### Pravila izračuna i opcije izračuna

Pravilo izračuna je prekidač: uključen ili isključen. Profil odlučuje koji su prekidači uključeni. Opcija izračuna je izbor koji vi napravite. Razliku vidite u samoj aplikaciji, u bloku *Profil izračuna i opcije izračuna*:

- **Pravila izračuna** su pod *Pravila izračuna ovog profila*, grupirana po temi, na primjer *Napredak i dovršeni rad*, *Ovisnosti i vrijeme odgode* i *Vremenska rezerva i kasni datumi*. Svaki redak je potvrdni okvir s vrijednošću profila iza njega (*osnovno: uključeno* ili *osnovno: isključeno*). Ako se vaš izbor od toga razlikuje, redak se ističe i pojavljuje se *Vrati na osnovno*. Strelica ispred retka otvara objašnjenje tog pravila. Ako želite promijeniti pravilo, prvo ga pročitajte.
- **Opcije izračuna** su pod *Opcije izračuna ovog projekta*: među ostalim *Definicija kritičnosti*, *Izračun vremenske rezerve*, *Zadaci s otvorenim završetkom su kritični*, *Označi gotovo kritične* i *Kalendar vremena odgode*. Kažu što želite za ovaj projekt, a ne kako program izračunava. Njihovo djelovanje objašnjeno je u [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad) i [Ovisnosti i vrijeme odgode](docs://uitleg-relaties).

Primjer za svaku vrstu. „Zadatak je kritičan ako je njegov ukupan slobodni hod 0 ili manje“ je opcija izračuna: prag možete postaviti na 4, pa je sve s 4 radna dana vremenske rezerve ili manje kritično. „Rad koji nije počeo pomiče se na datum stanja“ je pravilo izračuna: Open Planner Studio i Primavera P6 to rade, Microsoft Project ne.

Profil i opcije izračuna pripadaju datoteci projekta, a ne aplikaciji. Ako spremite projekt, one putuju s njim. Dva projekta u istoj aplikaciji mogu se stoga izračunavati s različitim profilom. Projekt bez profila izračunava se kao Open Planner Studio.

Ako postoje opcije izračuna koje poznaje samo Primavera, blok na dnu također prikazuje *Postavke iz izvorne datoteke*: za projekt iz .xer file-a, ali i ako u prozoru *Novi projekt* odaberete *Primavera P6* ili primijenite standardne opcije programa Primavera P6. Ovdje ih ne možete promijeniti.

### Gdje odabirete profil

Za novi projekt profil je u prozoru *Novi projekt*, koji otvarate putem *Početna › Datoteka › Novo*. Tamo je *Profil izračuna* padajući popis. Ako tamo odaberete profil, aplikacija zamjenjuje opcije izračuna koje ste već popunili standardnim vrijednostima tog profila; ostaju samo postavke iz izvorne datoteke. S *Primavera P6* je *Izračun vremenske rezerve* tada *Vremenska rezerva završetka*. S *Microsoft Project* i *Open Planner Studio* svaka opcija izračuna ima zadanu vrijednost, pa je *Izračun vremenske rezerve* *Automatski (standardno)*. S datumom stanja tako i sam MS Project izračunava: započeti zadatak dobiva vremensku rezervu završetka, a svaki ostali zadatak manju vrijednost od vremenske rezerve početka i završetka.

Za postojeći projekt profil odaberete pod *Postavke › Projekt › Podaci o projektu*, u bloku *Profil izračuna i opcije izračuna*, u padajućem popisu *Profil izračuna*. Isto mjesto dosegnete i putem *Datoteka › Podaci o projektu*. Promjena profila ovdje mijenja samo pravila izračuna. Vaše opcije izračuna ostaju kakve jesu. Ako želite i zadane opcije izračuna novog profila, odaberite *Primijeni standardne opcije ovog profila*.

Dok ne pritisnete *Primijeni*, promjena postoji samo u obrascu. Pritiskom na *Primijeni* aplikacija odmah ponovno izračunava raspored, čak i ako *Automatsko izračunavanje* nije uključeno. Ako su se zadaci pomaknuli, aplikacija kaže koliko, na primjer *Nakon primjene pomaknuta su 4 zadatka.* Cijelu promjenu možete poništiti jednim korakom pomoću *Poništi*.

Ako u profilu uključite ili isključite jedno pravilo izračuna, aplikacija ga pretvara u prilagođeni profil. Zove se *Kopija profila Open Planner Studio*, ili *Kopija* profila s kojim ste počeli. Možete mu dati drugi naziv i spremiti ga s *Spremi kao predložak* za druge projekte u ovoj aplikaciji. Projekt uvijek nosi vlastitu kopiju: ako kasnije promijenite predložak, projekt se s njim ne mijenja.

### Kada aplikacija sama odabire profil

Kada otvorite datoteku, aplikacija predlaže profil prema formatu:

- Datoteka .mpp (Microsoft Project) otvara se s profilom *Microsoft Project*.
- Datoteka .xer (Primavera P6) otvara se s profilom *Primavera P6*.
- Datoteka u formatu *MS Project XML*, *Primavera P6 XML* ili *CSV (odvojeno točka-zarezom)* otvara se s *Open Planner Studio*, bez poruke o profilu.
- Vaš vlastiti projekt (.ifc) otvara se s profilom koji je u njemu pohranjen.

Za datoteku .mpp ili .xer aplikacija prijavljuje profil: *Ovaj projekt izračunava se kao Microsoft Project. Promijenite u Datoteka → Podaci o projektu → Profil izračuna i opcije izračuna.* Gumb *Otvori profil izračuna* u poruci odmah vas vodi do Podataka o projektu. Za .xer datoteku ovaj redak je prvi detaljni redak poruke pri otvaranju datoteke. Više o toj poruci nalazite u [Otvaranje datoteke Primavera P6 (.xer)](docs://howto-xer-openen) i [Otvaranje datoteke Microsoft Project (.mpp)](docs://howto-mpp-openen).

Za datoteku .mpp aplikacija samo postavlja profil. Opcije izračuna ostaju prazne, kao kod novog projekta s profilom *Microsoft Project*: *Izračun vremenske rezerve* je *Automatski (standardno)*. Otvorena datoteka .mpp i novi projekt s *Microsoft Project* zato izračunavaju vremensku rezervu na isti način.

## Računski primjer: jedna mreža, tri profila

Primjer je mala mreža. Kalendar ima radni tjedan od ponedjeljka do petka i u tim tjednima nema neradnih dana. Način praćenja napretka je Retained Logic (zadano). Datum početka projekta je ponedjeljak, 7. lipnja 2027. Trajanja svih zadataka su u radnim danima.

- *Pour foundation*: 5 radnih dana, planirano od ponedjeljka, 7. lipnja.
- *Lay walls*: 5 radnih dana, nakon *Pour foundation* (završetak-početak).
- *Order window frames*: 3 radna dana, bez prethodnika, planirano od ponedjeljka, 7. lipnja.
- *Fit roof*: 2 radna dana, nakon *Lay walls* i nakon *Order window frames*. Završetak ovog zadatka je predaja.

Brojeve je izračunao računski motor aplikacije. Čitate ih u panelu *Svojstva*, pod *Rezultat CPM-a*.

**Bez datuma stanja i bez napretka, sva tri profila ovu mrežu izračunavaju jednako.** *Pour foundation* traje od ponedjeljka, 7. do petka, 11. lipnja, *Lay walls* od ponedjeljka, 14. do petka, 18. lipnja, a *Fit roof* u ponedjeljak, 21. i utorak, 22. lipnja. Predaja je utorak, 22. lipnja. *Order window frames* (od ponedjeljka, 7. do srijede, 9. lipnja) ima 7 radnih dana ukupnog slobodnog hoda.

Sada unosite stanje. Datum stanja je srijeda, 9. lipnja. Zadatak *Pour foundation* počeo je u ponedjeljak, 7. lipnja i dovršen je 60 %. Preostali posao je stoga 2 radna dana (5 × 40 %). Zadatak *Order window frames* nije počeo. Kako [napredak i datum stanja](docs://uitleg-voortgang) funkcioniraju, objašnjeno je u tom članku. Ovdje je pitanje što profil s time radi.

### Open Planner Studio

Preostali posao zadatka *Pour foundation* počinje na datumu stanja: srijeda, 9. i četvrtak, 10. lipnja. Najraniji početak ostaje stvarni početak, ponedjeljak, 7. lipnja. Najraniji završetak je četvrtak, 10. lipnja. *Lay walls* traje od petka, 11. do četvrtka, 17. lipnja, a *Fit roof* u petak, 18. i ponedjeljak, 21. lipnja.

Zadatak *Order window frames* bio je planiran za ponedjeljak, 7. lipnja, ali nije počeo. Rad koji nije počeo ne može biti u prošlosti. Aplikacija ga zato pomiče na datum stanja: od srijede, 9. do petka, 11. lipnja, s 4 radna dana ukupnog slobodnog hoda. Predaja je ponedjeljak, 21. lipnja.

### Primavera P6

Sve je isto kao u Open Planner Studio, osim jedne točke: najraniji početak zadatka *Pour foundation* je srijeda, 9. lipnja. To je početak preostalog posla, a ne stvarni početak. To čini pravilo izračuna *Zadatak u tijeku: najraniji početak = početak preostalog posla*, u grupi *Napredak i dovršeni rad*. Završetak i vremenska rezerva se zbog toga ne mijenjaju. Predaja je ponedjeljak, 21. lipnja.

### Microsoft Project

Ovdje se datumi razlikuju. Dva pravila izračuna u grupi *Napredak kao u programu Microsoft Project* to uzrokuju.

*Nezapočeti zadaci se ne pomiču na datum stanja*: *Order window frames* ostaje od ponedjeljka, 7. do srijede, 9. lipnja, iako to dijelom leži prije datuma stanja. Ukupan slobodni hod je 7 radnih dana.

*Preostali posao nastavlja se nakon proteklog vremena*: preostali posao počinje najranije na datum stanja i najranije na zbroj stvarnog početka i već proteklog vremena. Pri 60 % od 5 radnih dana, 3 radna dana su gotova. Ponedjeljak, 7. lipnja plus 3 radna dana je četvrtak, 10. lipnja. To je nakon datuma stanja, pa preostali posao traje od četvrtka, 10. do petka, 11. lipnja. *Lay walls* traje od ponedjeljka, 14. do petka, 18. lipnja, a *Fit roof* u ponedjeljak, 21. i utorak, 22. lipnja. Predaja je utorak, 22. lipnja: jedan radni dan kasnije nego u druga dva profila.

### Što ako

**Zadatak Pour foundation je na 20 % umjesto 60 %.** Preostali posao je tada 4 radna dana. U sva tri profila *Pour foundation* završava u ponedjeljak, 14. lipnja, a predaja je srijeda, 23. lipnja. Pravilo programa Microsoft Project za preostali posao ovdje ne čini razliku: ponedjeljak, 7. lipnja plus 1 proteklog radnog dana je utorak, 8. lipnja, a to je prije datuma stanja. Takvo pravilo je donja granica koja može preostali posao samo pomaknuti kasnije. *Order window frames* i najraniji početak prema Primavera P6 se i dalje razlikuju, kao gore. Prema programu Microsoft Project *Order window frames* tada ima 8 radnih dana ukupnog slobodnog hoda.

**Postavite samo datum stanja i ne unosite napredak.** Prema profilu Open Planner Studio i Primavera P6 cijela mreža pomiče se na srijedu, 9. lipnja. *Pour foundation* tada teče od srijede, 9. do utorka, 15. lipnja, a predaja postaje četvrtak, 24. lipnja: dva radna dana kasnije nego bez datuma stanja. Prema programu Microsoft Project sve ostaje gdje je bilo, a predaja je utorak, 22. lipnja.

**Profil sastavljate sami.** Ako u profilu Open Planner Studio uključite samo *Nezapočeti zadaci se ne pomiču na datum stanja*, profil postaje prilagođeni profil, *Kopija profila Open Planner Studio*. Uz napredak od 60 % zadatak *Pour foundation* tada zadržava datume iz Open Planner Studio (završetak četvrtak, 10. lipnja, predaja ponedjeljak, 21. lipnja). *Order window frames* doista ostaje od ponedjeljka, 7. do srijede, 9. lipnja, sa 6 radnih dana ukupnog slobodnog hoda. Profil je dakle skup pojedinačnih prekidača, i možete ih mijenjati jedan po jedan.

**Opcija izračuna umjesto pravila.** Ako u profilu Open Planner Studio postavite *Definicija kritičnosti* (*Ukupan slobodni hod ≤ prag*) s *Prag (radni dani)* na 4, *Order window frames* postaje kritičan, jer mu je ukupan slobodni hod točno 4. Nijedan datum se ne mijenja. Opcija izračuna je vaš izbor za projekt i neovisna je o profilu.

**Rok za dovršetak koji je prošao.** Zadatku *Fit roof* dodijelite rok za dovršetak u petak, 18. lipnja. U Open Planner Studio je ukupan slobodni hod zadatka *Fit roof* tada −1 radni dan, a slobodni hod je također −1. U Primavera P6 ukupan slobodni hod ostaje −1, ali slobodni hod postaje 0. To čini pravilo izračuna *Slobodni hod nikad nije negativan*, u grupi *Vremenska rezerva i kasni datumi*. U Microsoft Project oba iznose −2, jer tamo predaja pada dan kasnije. Kako rok za dovršetak radi, objašnjeno je u [Ograničenja i rokovi za dovršetak](docs://uitleg-constraints).

## Posljedice i pogrešna shvaćanja

**„Profil je postavka aplikacije.“** Ne. Profil i opcije izračuna pripadaju projektu i nalaze se u datoteci. Aplikaciji pripadaju samo predlošci koje zadržite, a projekt uvijek zadržava vlastitu kopiju.

**„Ako izvezem, moj profil ide s njim.“** Samo pri izvozu u vlastiti format projekta (.ifc). Ako izvezete u *MS Project XML*, *Primavera P6 XML* ili *CSV (odvojeno točka-zarezom)*, profil nije u datoteci. Od opcija izračuna izvoz u *MS Project XML* zapisuje najviše kritični prag. Aplikacija o tome upozorava samo za projekt koji je nastao iz .xer file. Za projekt koji ste sami napravili ne dobijete nikakvu poruku. Datoteka se tada otvara kao Open Planner Studio, bez poruke o profilu. Razmotrite primjer s profilom Microsoft Project i napretkom od 60 %. Ako ga izvezete u *MS Project XML* i ponovno otvorite, aplikacija prvo prikazuje datume iz datoteke, s predajom posla u utorak, 22. lipnja. Ako dopustite da aplikacija sama ponovno izračuna, taj datum postaje ponedjeljak, 21. lipnja. Što još izvoz gubi, nalazi se u [Datoteke i formati](docs://uitleg-bestanden).

**„Profil Primavera P6 daje isti rezultat kao P6.“** Aplikacija to ne može jamčiti. Profil uključuje pravila izračuna koja aplikacija poznaje iz P6, a ta nisu sve postavke P6. Osim Retained Logic i Progress Override, P6 ima i treći način praćenja napretka, Actual Dates. Aplikacija ga ne poznaje: takav .xer file se izračunava kao Retained Logic, a poruka pri otvaranju to javlja, na primjer kao *1 postavka rasporeda P6 upotrijebila je sigurno zamjensko rješenje.* Neka pravila izračuna profila Primavera P6 također rade samo na zadacima koji potječu iz .xer file, na primjer *Nezapočeta LOE koristi ciljni prozor* i *Stvarni datumi ostaju točni*. Za neka od njih objašnjenje to kaže: „samo zadaci s P6 podrijetlom“. Na zadacima koje sami izradite, ta pravila ne čine ništa.

**„Način praćenja napretka dio je profila.“** Ne. Retained Logic ili Progress Override biraju se zasebno za svaki projekt. Postavljate ga odvojeno od profila; pogledajte [Odabir načina praćenja napretka](docs://howto-voortgangsmodus-kiezen). Jedno pravilo izračuna profila Primavera P6, *Progress Override ignorira započetog nasljednika i unatrag*, djeluje samo uz Progress Override.

**„Samo ću promijeniti profil da vidim što se događa.“** Možete, jer *Poništi* poništava *Primijeni* u jednom koraku: profil i datumi se vraćaju zajedno. Ali datumi se stvarno mogu pomaknuti. U primjeru se prebacivanjem s Open Planner Studio na Microsoft Project pomiču svih 4 zadatka. Poruka ih broji umjesto vas. Poslije pogledajte raspored prije nego nastavite. Ako aplikacija i nakon otvaranja datoteke .xer ili .mpp još prikazuje datume iz datoteke, promjena profila napušta taj prikaz i aplikacija sama izračunava. Kako to funkcionira, nalazi se u [Datumi kako su zapisani](docs://uitleg-datums-zoals-opgeslagen).

**Primjer prikazuje četiri pravila izračuna, a popis u aplikaciji je duži.** Svaki redak u ovom dijelu ima vlastito objašnjenje. Najprije ga pročitajte. Pogledajte i skupinu *Samo za vlastite profile*: ta pravila su isključena u svakom ugrađenom profilu, uključujući Primavera P6. Ako uključite jedno od tih pravila, nastaje vlastiti profil.

## Vidi također

- [Napredak, datum stanja i temeljni plan](docs://uitleg-voortgang): što rade datum stanja i preostali posao, s razlikama po profilu.
- [Odabir načina praćenja napretka](docs://howto-voortgangsmodus-kiezen): izbor između Retained Logic ili Progress Override.
- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): opcije izračuna za kritične zadatke i vremensku rezervu.
- [Ovisnosti i vrijeme odgode](docs://uitleg-relaties): opcija izračuna *Kalendar vremena odgode*.
- [Datoteke i formati](docs://uitleg-bestanden): što izvoz prenosi, a što ne.
- [Izvoz](docs://howto-exporteren): izvoz projekta.
- [Ažuriranje napretka](docs://howto-voortgang-bijwerken): unos postotka, stvarnog početka i datuma stanja.
- [Datumi kako su zapisani](docs://uitleg-datums-zoals-opgeslagen): zašto se uvezeni datumi mogu razlikovati od onoga što aplikacija sama izračunava.
- [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies): sva pravila izračuna i sve opcije izračuna na jednom popisu.
