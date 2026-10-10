# Ovisnosti i vrijeme odgode

Zašto zidanje počinje tek kad je temelj gotov? A zašto se ugradnja krova pomakne za tjedan dana kad elementi krova stignu kasno? To određuju ovisnosti među vašim zadacima. U ovom članku saznajete koje četiri vrste ovisnosti aplikacija poznaje. Saznajete čemu služe vrijeme odgode i vrijeme preklapanja. Saznajete u kojem kalendaru se vrijeme odgode broji, što se događa s ovisnošću na fazi i kako aplikacija odlučuje koja ovisnost određuje datum početka zadatka.

Pravila i primjeri vrijede za novi projekt s profilom izračuna *Open Planner Studio* i radnim tjednom od ponedjeljka do petka.

## Pojam

**Ovisnost** bilježi da dva zadatka ovise jedan o drugom. Prvi zadatak je **prethodnik**, a drugi je **nasljednik**. Ovisnost je donja granica. Nasljednik nikad ne smije početi ili završiti ranije nego što ovisnost dopušta. Može početi ili završiti kasnije. Ima li zadatak više prethodnika, čeka najkasniji datum koji proizlazi iz svih tih ovisnosti.

Postoje četiri vrste. Razlikuju se po tome koji se trenutak prethodnika (početak ili završetak) veže uz koji trenutak nasljednika:

- **FS (završetak-početak).** Nasljednik počinje tek kad je prethodnik završen. Elementi krova postavljaju se tek kad su zidovi podignuti. Ovo je daleko najčešće korištena ovisnost.
- **SS (početak-početak).** Nasljednik počinje tek kad je prethodnik počeo. Zadaci se smiju preklapati: instalacije cijevi mogu početi čim je zidanje u tijeku.
- **FF (završetak-završetak).** Nasljednik završava tek kad je prethodnik završen. Fugiranje može biti završeno tek kad je zidanje završeno, ali može početi ranije.
- **SF (početak-završetak).** Nasljednik završava tek kad je prethodnik počeo. Ta vrsta je rijetka. Primjer: privremeno crpljenje vode smije stati tek kad je zidanje temelja počelo.

Ovisnost može imati i **vrijeme odgode**: čekanje između dva zadatka, primjerice kad beton mora odstajati. Negativno vrijeme odgode zove se **vrijeme preklapanja**. Nasljednik tada počinje prije nego što je prethodnik završen, pa se zadaci preklapaju.

## Kako aplikacija izračunava

### Četiri vrste

Za svaku ovisnost aplikacija izračunava najraniji datum na koji nasljednik može početi. Uzima najkasniji od svih ovisnosti jednog zadatka. Bez vremena odgode radi ovako:

- Uz FS nasljednik počinje prvi radni dan nakon završetka prethodnika.
- Uz SS nasljednik počinje istog dana kao prethodnik.
- Uz FF nasljednik završava istog dana kao prethodnik. Da bi se pronašao početak, aplikacija broji unatrag kroz trajanje nasljednika. Nasljednik od 3 radna dana zato počinje 2 radna dana prije završetka prethodnika.
- Uz SF nasljednik završava na dan kad prethodnik počinje. I ovdje aplikacija broji unatrag kroz trajanje nasljednika.

To su donje granice. Nasljednik počinje kasnije ako to traži neka druga ovisnost ili ograničenje. Svi datumi se prikazuju tek nakon naredbe **Izračunaj** (F5). Dok traka stanja prikazuje *Zastarjelo — ponovno izračunajte (F5)*, trake pripadaju prethodnom izračunu.

### Vrijeme odgode i vrijeme preklapanja

Vrijeme odgode može se izraziti na četiri načina:

- U **radnim danima** (`3` ili `3d`): aplikacija preskače slobodne dane i vikende. To je zadano.
- U **kalendarskim danima** (`3ed`, e znači *elapsed*, odnosno proteklo vrijeme): broji se svaki dan, uključujući subotu i nedjelju. Ovo je jedinica za nešto što traje dalje, a da se pritom ne radi, primjerice njegovanje betona.
- Kao **postotak** trajanja prethodnika (`40%`): aplikacija to iznova izračunava pri svakom izračunu i zaokružuje na cijele dane (2,5 dana postaje 3).
- U **radnim satima** (`4h`): aplikacija broji vrijeme odgode u kalendaru vremena odgode, zadano u kalendaru prethodnika. Ako je prethodnik zadatak u danima u kalendaru bez vlastitih blokova radnog vremena, primjerice standardnom kalendaru, aplikacija sate pretvara u cijele radne dane, zaokružene na najbliži cijeli dan (pola dana ide naviše). Uz radni dan od 8 sati, `2h` i `3h` daju zato 0 dana, `4h` do uključivo `11h` daju 1 dan, a `12h` daje 2 dana. Ima li taj kalendar vlastite blokove radnog vremena ili je prethodnik zadatak u satima, vrijeme odgode broji se točno u radnim satima.

Pravilo za vrijeme odgode od N radnih dana uz FS glasi ovako: N radnih dana nakon završetka prethodnika je čekanje, a nasljednik počinje prvi radni dan nakon toga. Uz SS i FF dodaje se vrijeme odgode na početak, odnosno na završetak prethodnika. Negativno vrijeme odgode broji unatrag: vrijeme preklapanja od 1 radnog dana uz FS omogućuje da nasljednik počne na dan kad prethodnik završava.

Vrijeme preklapanja ne može zadatak staviti prije datuma početka projekta. Ako bi se to dogodilo, aplikacija nasljednika zadržava na datumu početka projekta i u oknu *Upozorenja* prijavljuje: *Vrijeme preklapanja skraćeno zbog datuma početka projekta. Ovisnost nije u potpunosti primijenjena*.

### U kojem kalendaru se vrijeme odgode broji

Svaki zadatak može imati vlastiti kalendar. Uz vrijeme odgode u radnim danima važno je koji kalendar broji radne dane. To određuje postavka *Kalendar vremena odgode*, s četiri izbora: *Prethodnik*, *Nasljednik*, *24-satni* i *Kalendar projekta*. Zadano se vrijeme odgode broji u kalendaru **prethodnika**. Postavku nalazite pod *Postavke › Projekt › Podaci o projektu*, u bloku *Profil izračuna i opcije izračuna*, pod *Opcije izračuna ovog projekta*. Izbor pripada datoteci projekta i vrijedi tek nakon što kliknete *Primijeni*. Nakon toga slijedi ponovno izračunavanje rasporeda.

Vrijeme odgode u kalendarskim danima (`3ed`) uvijek broji sve dane, bez obzira na to koji izbor u *Kalendar vremena odgode* odaberete.

### Ovisnosti na zadacima sažetka

Ovisnost možete staviti na fazu (zadatak sažetka), a ne na zadatak unutar nje. Aplikacija tu ovisnost interno stavlja na svaki zadatak u fazi:

- Faza kao **prethodnik** uz FS ili FF: nasljednik čeka da se završi zadatak u fazi koji se zadnji završava.
- Faza kao **nasljednik** uz FS ili SS: svaki zadatak u fazi čeka prethodnika, neovisno o ostalim zadacima u fazi.
- Faza kao **prethodnik** uz SS ili SF: nasljednik čeka početak zadatka u fazi koji počinje **zadnji**, a ne početak same faze. To je opreznije nego što očekujete: nasljednik nikad ne počne prerano, ali možda kasnije nego što želite. Ako želite da nasljednik prati početak faze, stavite ovisnost na prvi zadatak u fazi.
- Faza kao **nasljednik** uz FF ili SF: svaki zadatak u fazi mora sam ispuniti zahtjev za završetak (uz FF na završetak prethodnika ili kasnije, uz SF na početak prethodnika ili kasnije), čak i zadatak koji je mogao biti gotov mnogo ranije. Bolje je takvu ovisnost staviti na zadnji zadatak u fazi.

Ovisnost između zadatka i faze u kojoj se nalazi nije dopuštena.

### Odlučujuće ovisnosti

Ima li nasljednik više prethodnika, obično jedna ovisnost određuje njegov datum početka: ona koja sprječava da nasljednik počne ijedan dan ranije nego sada. Takva ovisnost je **odlučujuća ovisnost**. Pri izjednačenju postoji više odlučujućih ovisnosti. Odlučujuću ovisnost prepoznajete po simbolu munje u stupcu *Prethodnici* i u stupcu *Nasljednici* tablice, po stupcu *Odlučujuća ovisnost* (**+** desno u zaglavlju tablice, ispod *Ovisnosti*) i po jačoj nijansi kad pratite put. Kako otvoriti taj put, opisano je u [Praćenje puta](docs://howto-pad-traceren).

Odlučujuća ovisnost govori o datumima, a ne o trajanju. I kratak prethodnik može biti odlučujući, primjerice zbog dugog vremena odgode. To vidite u primjeru u nastavku.

## Radni primjer

Primjeri koriste odvojene mini-projekte. Svi počinju u ponedjeljak 7. lipnja 2027., osim ako nije drukčije navedeno. Pojmove kao što su kritični put i vremenska rezerva objašnjava [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad). Izgradnju mreže ovisnosti i njezinu provjeru radite u lekciji 2, „Ovisnosti i kritični put“.

### Četiri vrste jedna uz drugu

*Pour foundation* traje 5 radnih dana: od ponedjeljka 7. do petka 11. lipnja. *Build walls* (5 radnih dana) slijedi uz FS i traje od ponedjeljka 14. do petka 18. lipnja. Četiri zadatka od po 3 radna dana ovise o *Build walls*, svaki s drugom vrstom ovisnosti:

- *Place roof elements* (FS) počinje u ponedjeljak 21. lipnja, prvi radni dan nakon zidanja, i završen je u srijedu 23. lipnja.
- *Pipework* (SS) počinje u ponedjeljak 14. lipnja, zajedno sa zidanjem, i završen je u srijedu 16. lipnja.
- *Pointing* (FF) mora biti gotov u petak 18. lipnja, zajedno sa zidanjem. Uz 3 radna dana počinje zato u srijedu 16. lipnja.
- *Dewatering* (SF) mora završiti u ponedjeljak 14. lipnja, na dan kad počinje zidanje. Ako se 3 radna dana broje unatrag (četvrtak 10., petak 11., ponedjeljak 14. lipnja), počinje u četvrtak 10. lipnja.

Samo je *Place roof elements* na kritičnom putu. Projekt završava u srijedu 23. lipnja. *Pipework*, *Pointing* i *Dewatering* imaju redom 5, 3 i 7 radnih dana vremenske rezerve.

### Vrijeme odgode i vrijeme preklapanja u brojevima

*Pour foundation* je gotov u petak 18. lipnja. *Build walls* (2 radna dana) slijedi uz FS. Ovako vrijeme odgode utječe na datum početka:

- Bez vremena odgode zidanje počinje u ponedjeljak 21. lipnja.
- Uz vrijeme odgode `3` (tri radna dana) ponedjeljak 21., utorak 22. i srijeda 23. lipnja su čekanje. Zidanje počinje u četvrtak 24. lipnja.
- Uz vrijeme odgode `3ed` (tri kalendarska dana) broje se subota, nedjelja i ponedjeljak. Zidanje počinje u utorak 22. lipnja.
- Uz vrijeme odgode `-1` (vrijeme preklapanja od jednog radnog dana) zidanje počinje u petak 18. lipnja, na dan kad je lijevanje završeno.
- Uz vrijeme odgode `40%` vrijeme odgode iznosi 40% od 5 radnih dana, dakle 2 radna dana. Zidanje počinje u srijedu 23. lipnja.
- Uz vrijeme odgode `50%` vrijeme odgode iznosi 2,5 radna dana, zaokruženo na 3 radna dana. Zidanje počinje u četvrtak 24. lipnja.

### Koji kalendar broji vrijeme odgode

*Build walls* (4 radna dana) je u kalendaru projekta (ponedjeljak do petka) i gotov je u četvrtak 10. lipnja. *Pointing* (2 radna dana) slijedi uz FS i vrijeme odgode `3`, a nalazi se u kalendaru u kojem su i subota i nedjelja radni dani. Tada datum početka ovisi o *Kalendar vremena odgode*:

- *Prethodnik* (zadano): vrijeme odgode broji se u kalendaru zidanja. Petak 11., ponedjeljak 14. i utorak 15. lipnja su čekanje. Pointing počinje u srijedu 16. lipnja.
- *Nasljednik*: vrijeme odgode broji se u kalendaru za pointing. Petak 11., subota 12. i nedjelja 13. lipnja su čekanje. Pointing počinje u ponedjeljak 14. lipnja.
- *24-satni*: broje se svi kalendarski dani. I ovdje su petak, subota i nedjelja čekanje. Pointing počinje u ponedjeljak 14. lipnja.
- *Kalendar projekta*: vrijeme odgode broji se u kalendaru projekta, kao i uz *Prethodnik*. Pointing počinje u srijedu 16. lipnja.

### Ovisnosti na fazi

*Foundation* je faza s dva zadatka: *Excavate* (2 radna dana, ponedjeljak 7. i utorak 8. lipnja) i zatim *Pour* (3 radna dana, od srijede 9. do petka 11. lipnja). *Build walls* slijedi fazu *Foundation* uz FS i počinje u ponedjeljak 14. lipnja: aplikacija ga tjera da čeka *Pour*, zadnji zadatak koji se završava.

Uz fazu kao nasljednika: *Permit* (3 radna dana, završen u srijedu 9. lipnja) ide uz FS na fazu *Struktura*. Faza sadrži *Build walls* (4 radna dana), a zatim *Lay floor* (2 radna dana). Svaki zadatak u fazi čeka zadatak *Permit*: *Build walls* počinje u četvrtak 10. lipnja i završen je u utorak 15. lipnja. *Lay floor* također čeka zidanje i traje od srijede 16. do četvrtka 17. lipnja.

Uz SS iz faze: faza *Finishing* sadrži *Plastering* (2 radna dana, 7. i 8. lipnja), zatim *Painting* (3 radna dana, od 9. do 11. lipnja) i zatim *Snagging* (2 radna dana, 14. i 15. lipnja). *Cleaning* slijedi fazu uz SS. Očekivali biste početak u ponedjeljak 7. lipnja, ali aplikacija čini da *Cleaning* čeka početak *Snagging*, zadatka koji počinje zadnji: ponedjeljak 14. lipnja.

### Što je odlučujuće

*Pour foundation* (2 radna dana) traje od ponedjeljka 7. do utorka 8. lipnja. Iz toga izlaze dvije grane:

- *Build walls* (5 radnih dana): od srijede 9. do utorka 15. lipnja.
- *Order roof elements* (2 radna dana): srijeda 9. i četvrtak 10. lipnja.

*Place roof elements* (3 radna dana) slijedi oboje: uz FS nakon zidanja, a uz FS i vrijeme odgode `5` nakon narudžbe (vrijeme isporuke). Od zidanja postavljanje bi moglo početi u srijedu 16. lipnja. Od narudžbe su petak 11., ponedjeljak 14., utorak 15., srijeda 16. i četvrtak 17. lipnja čekanje. Postavljanje počinje u petak 18. lipnja. Ovisnost uz narudžbu je zato odlučujuća ovisnost, iako je narudžba mnogo kraća od zidanja. Zidanje ima 2 radna dana vremenske rezerve.

## Posljedice i pogrešna shvaćanja

**„Ovisnost fiksira zadatke.“** Ne, ovisnost je donja granica. Nasljednik počinje najranije na datum koji daje ovisnost, a kasnije ako to traži druga ovisnost ili ograničenje. Kako se ograničenja uklapaju, objašnjeno je u [Ograničenja i rokovi za dovršetak](docs://uitleg-constraints).

**„SS znači da zadaci počinju istodobno.“** SS samo kaže da nasljednik ne smije početi prije prethodnika. Ako nasljednik ima drugog prethodnika koji završava kasnije, počinje kasnije.

**„Uz FF nasljednik počinje istog dana.“** Ne, uz FF se poklapaju datumi završetka. Kratak nasljednik zato počinje kasnije od prethodnika, kao pointing u primjeru.

**„Vrijeme odgode u danima broji kalendarske dane.“** Zadano vrijeme odgode broji radne dane, u kalendaru prethodnika. Za njegovanje ili sušenje, gdje se računa i vikend, koristite kalendarske dane (`ed`).

**„Zadatak bez ovisnosti nije problem.“** Zadatak bez prethodnika počinje na planirani datum početka, a zadatak bez nasljednika dobiva vremensku rezervu do završetka projekta. Ako zaboravite ovisnost, zadatak zato izgleda kao da ima puno prostora. Pogledajte pogrešna shvaćanja u [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad).

**„Ovisnost na fazi je jedna ovisnost.“** Za izračun je to jedna ovisnost po zadatku u fazi. Ako zadatke premjestite u fazu ili iz faze, mijenjaju se i ovisnosti koje se odnose na te zadatke.

## Vidi također

- [Dodavanje ovisnosti](docs://howto-relaties-leggen): koraci za povezivanje zadataka i postavljanje vremena odgode.
- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): što aplikacija izračunava iz vaših ovisnosti i zašto zadatak postaje kritičan.
- [Ograničenja i rokovi za dovršetak](docs://uitleg-constraints): dogovori o datumima uz ovisnosti.
- [Praćenje puta](docs://howto-pad-traceren): prikaz lanca prije ili poslije zadatka.
- [Izrada hamaka](docs://howto-hammock): zadatak s izvedenim trajanjem, povezan s ovisnostima tipa SS i FF.
- [Međuzavisnosti projekata](docs://howto-externe-relaties): ovisnosti sa zadatkom u drugoj datoteci projekta.
