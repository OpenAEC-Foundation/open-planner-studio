# Kalendari i radni dani

Koliko radnih dana traje zadatak, a na koji datum je završen? To ovisi o kalendaru u kojem aplikacija broji. U ovom članku pročitate što je kalendar, kako aplikacija broji radne dane pomoću njega i koji kalendar vrijedi kada je uključeno više njih. Primjer s brojevima pomaže vam pratiti račun.

## Pojam

Raspored se računa u **radnim danima**, a ne u kalendarskim danima. „Pet dana zidanja“ znači pet dana na kojima se radi. Vikend ili državni praznik se ne broji, pa zadatak u dnevniku traje dulje od pet dana.

Koji su dani radni, zapisano je u **kalendaru**. Kalendar određuje tri stvari:

- **Radni tjedan**: dani u tjednu na koje se radi. Zadano je od ponedjeljka do petka.
- **Radno vrijeme**: početak, kraj i pauza. Ono daje **neto sate po danu**. Zadano je od 07:00 do 16:00 s jednosatnom pauzom, dakle 8 sati.
- **Praznici**: pojedinačni dani ili cijeli nizovi uzastopnih dana na koje se ne radi, na primjer Dan kralja, Božić ili kolektivni godišnji odmor u građevinarstvu.

Projekt ima jednu biblioteku kalendara. Jedan od njih je **kalendar projekta**. Primjenjuje se na svaki zadatak koji nema vlastiti kalendar. Pojedinom zadatku dajete drugi kalendar, na primjer radni tjedan od šest dana za podizvođača koji radi i subotom. Resurs također može imati vlastiti kalendar, ali to radi nešto drugo (vidi dolje).

## Kako aplikacija izračunava

Ovaj članak opisuje standardni izračun: profil izračuna *Open Planner Studio*, s kojim se izračunava novi projekt.

### Brojanje radnih dana

Prvi radni dan zadatka broji se kao dan 1. Zadatak od 5 dana završava se tako na petom radnom danu. Ako početak pada na neradni dan, zadatak počinje sljedećeg radnog dana. Praznik ili kolektivni godišnji odmor u građevinarstvu usred zadatka se ne broji: zadatak jednostavno prolazi kroz njega i u dnevniku traje dulje.

Sati po danu nemaju nikakav udio u datumima zadatka u danima. Računaju se samo radni tjedan i praznici. Radno vrijeme dolazi do izražaja samo kod zadatka u satima; to je opisano u [Dani i sati](docs://uitleg-dagen-en-uren).

### Koji kalendar prevladava

Aplikacija odabire jedan kalendar po zadatku:

1. Ako zadatak ima vlastiti kalendar, aplikacija zadatak u cijelosti izračunava u tom kalendaru: trajanje, datum završetka i vremensku rezervu.
2. Ako nema, primjenjuje se kalendar projekta. Ako zadatak upućuje na kalendar koji više ne postoji, i tada se primjenjuje kalendar projekta.

Zadatak sažetka (faza) nema vlastiti rad i zato nema vlastiti kalendar. Njegovo trajanje proizlazi iz datuma njegovih zadataka, a aplikacija ga broji u kalendaru projekta.

Kalendar **resursa** ne utječe na datume. U rasporedu koji sami izrađujete u aplikaciji određuje samo kada je resurs dostupan: u histogramu, za preopterećenje resursa i pri uravnoteživanju.

### Zadaci na različitim kalendarima

Kada su dva zadatka s različitim kalendarima povezana, vrijedi sljedeće:

- Kod ovisnosti završetak-početak nasljednik počinje prvog radnog dana nakon završetka prethodnika, računano u kalendaru **nasljednika**. Ako zadatak završava u petak, nasljednik s radnim tjednom od šest dana počinje u subotu.
- **Vrijeme odgode** se zadano računa u kalendaru **prethodnika**. To možete promijeniti pod *Postavke › Projekt › Podaci o projektu*, u bloku *Profil izračuna i opcije izračuna*, pod *Opcije izračuna ovog projekta*, s izborom *Kalendar vremena odgode*: *Prethodnik* (zadano), *Nasljednik*, *24-satni* ili *Kalendar projekta*.
- **Ukupan slobodni hod** računa se u radnim danima kalendara samog zadatka. U ovom profilu **slobodni hod** računa se u kalendaru nasljednika.

Što je vrijeme odgode točno, opisano je u [Dodavanje ovisnosti](docs://howto-relaties-leggen); što je vremenska rezerva, u [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad).

### U Gantt-dijagramu

Siva pozadina u Gantt-dijagramu uvijek prikazuje neradne dane **kalendara projekta**. Zadatak na vlastitom kalendaru može zato prolaziti preko sivog dana, na primjer zadatak od šest dana preko subote. Niz praznika širine tri dana ili više dobije prikazan naziv, na primjer *Bouwvak (Noord)*. To se ne događa kada je uključeno *Prikaži samo radne dane*. Ako ne želite vidjeti sive dane uopće, uključite *Prikaži samo radne dane* pod *Postavke › Projekt › Postavke*, na kartici *Prikaz*, u naslovu *Vremenska os*.

## Primjer: raspored građevinskih radova

Primjer koristi standardni kalendar *Bouwkalender NL*: od ponedjeljka do petka, s nizozemskim državnim praznicima. Svi zadaci traju cijeli broj dana. U lekciji o kalendarima (lekcija 3) sami gradite takav kalendar.

### Vikend, praznik i kolektivni godišnji odmor u građevinarstvu

*Brickwork* traje 5 radnih dana i počinje u četvrtak, 13. svibnja 2027. Četvrtak 13. i petak 14. svibnja su dan 1 i dan 2. Vikend i Duhovski ponedjeljak, 17. svibnja, ne broje se. Utorak 18., srijeda 19. i četvrtak 20. svibnja su dan 3, 4 i 5. Zadatak završava **u četvrtak, 20. svibnja**: osam kalendarskih dana za pet radnih dana.

Kolektivni godišnji odmor u građevinarstvu povećava razliku. Uzmite *Bouwvak (Noord)*, od 26. srpnja do 13. kolovoza 2027. uključivo, i isti zadatak od 5 radnih dana od petka, 23. srpnja. Petak, 23. srpnja je dan 1. Nakon toga kalendar tri tjedna miruje. Ponedjeljak, 16. do četvrtak, 19. kolovoza su dani 2 do 5. Završetak je **četvrtak, 19. kolovoza**, 28 kalendarskih dana nakon početka. Bez tog odmora završetak bi bio četvrtak, 29. srpnja.

### Zadatak u subotu

Tri zadatka slijede jedan za drugim, svi s ovisnošću završetak-početak bez vremena odgode: *Groundwork* (4 dana), *Pour foundation* (3 dana) i *Brickwork* (5 dana). Projekt počinje u ponedjeljak, 24. svibnja 2027.

Ako su sva tri na kalendaru projekta, *Groundwork* traje od ponedjeljka, 24. do četvrtka, 27. svibnja. *Pour foundation* traje od petka, 28. svibnja do utorka, 1. lipnja (petak, ponedjeljak, utorak). *Brickwork* traje od srijede, 2. lipnja do utorka, 8. lipnja. Projekt završava **u utorak, 8. lipnja**.

Dodijelite *Pour foundation* kalendar *Six-day week* (od ponedjeljka do subote) i subota se broji. Zadatak traje od petka, 28. svibnja do **ponedjeljka, 31. svibnja** (petak, subota, ponedjeljak). *Brickwork* ostaje na kalendaru projekta, počinje u utorak, 1. lipnja i završava **u ponedjeljak, 7. lipnja**. Cijeli projekt traje jedan dan kraće, jer jedan zadatak radi u subotu.

### Vrijeme odgode preko dva kalendara

*Pour floor* (tjedan od šest dana, 4 dana) počinje u ponedjeljak, 31. svibnja i završava u četvrtak, 3. lipnja. *Pointing* (kalendar projekta, 3 dana) slijedi s vremenom odgode od 2 radna dana. Bez vremena odgode *Pointing* bi počeo u petak, 4. lipnja.

- Zadano se vrijeme odgode računa u kalendaru prethodnika, tjednu od šest dana. Počevši od petka, 4. lipnja, prvi radni dan je subota, 5. lipnja, a drugi ponedjeljak, 7. lipnja. *Pointing* počinje **u ponedjeljak, 7. lipnja** i završava u srijedu, 9. lipnja.
- Ako postavite *Kalendar vremena odgode* na *Nasljednik*, broji se kalendar projekta. Subota se tada ne broji: ponedjeljak, 7. lipnja je prvi radni dan, a utorak, 8. lipnja drugi. *Pointing* počinje **u utorak, 8. lipnja** i završava u četvrtak, 10. lipnja.

### Vremenska rezerva u vlastitom kalendaru

*Brickwork* (5 dana, kalendar projekta) i *Crane hire* (3 dana, tjedan od šest dana) počinju u ponedjeljak, 24. svibnja. Oba su prethodnika za *Fit window frames* (2 dana, kalendar projekta).

*Brickwork* završava u petak, 28. svibnja, pa *Fit window frames* počinje u ponedjeljak, 31. svibnja. *Crane hire* je u srijedu, 26. svibnja već završen. **Ukupan slobodni hod** zadatka *Crane hire* računa se u vlastitom kalendaru: četvrtak 27., petak 28. i subota 29. svibnja, dakle **3 radna dana**. Da je *Crane hire* na kalendaru projekta, bio bi 2 radna dana. **Slobodni hod** iznosi 2 radna dana (četvrtak i petak), jer ga aplikacija računa u kalendaru nasljednika.

### Kalendar resursa

U drugom primjeru projekta resurs *Bricklaying crew* ima kalendar *Crew Mon–Thu* (od ponedjeljka do četvrtka). Dodijeljen je zadatku *Brickwork* s 1 jedinicom dodjele dnevno (5 dana, kalendar projekta, od ponedjeljka, 31. svibnja do petka, 4. lipnja).

Datumi zadatka *Brickwork* se ne mijenjaju. Ali petak, 4. lipnja je u histogramu označen crveno, s porukom *Prema kalendaru „Crew Mon–Thu” ne radi na ovaj dan*, a vrpca prijavljuje jedan resurs pod *Preopterećenje*. Uravnoteživanje to ne rješava. Pomicanje ne pomaže, jer pet radnih dana zaredom uvijek sadrži petak. U prozoru *Uravnoteživanje resursa* zadatak se zato navodi pod *Preostali sukobi*, s razlogom *Resurs ne radi na sve dane koje zadatak treba — pomicanje to ne rješava.*

## Posljedice i nesporazumi

**„Kalendar resursa mi pomiče zadatke.“** Ne. Kalendar resursa ne mijenja nijedan datum; samo čini preopterećenje resursa vidljivim. Ako želite da zadatak sam radi na drugim danima, dajte zadatku vlastiti kalendar.

**„Ako promijenim kalendar projekta, sve se pomakne.“** Pomiču se samo zadaci bez vlastitog kalendara. Zadatak kojem ste sami dodijelili kalendar s popisa zadržava ga, čak i ako je to slučajno stari kalendar projekta. Ako izbrišete kalendar, zadaci i resursi koji su ga koristili vraćaju se na kalendar projekta.

**„Praznici su tu, zar ne?“** Praznici postoje samo za godine za koje su stvoreni. Dan izvan tih godina jednostavno je radni dan. U dijalogu kalendara aplikacija to kaže porukom *Praznici pokrivaju 2025–2028; projekt traje do 2030. Želite li ponovno generirati?*

**„Više sati po danu skraćuje moj zadatak.“** Ne kod zadatka u danima: broje se cijeli radni dani, bez obzira na to ima li dan 6 ili 8 sati. Trajanje se mijenja samo za zadatak s resursima i pravilom rada *Fiksni rad* ili *Fiksne jedinice*.

**Kalendar bez radnih dana** aplikacija ne može izračunati. Izračun prijavljuje *Kalendar nema postavljene radne dane*.

## Pogledajte također

- [Dani i sati](docs://uitleg-dagen-en-uren): kako aplikacija broji radne sate i što se događa kada se sretnu zadatak u danima i zadatak u satima.
- [Izrada i dodjela kalendara](docs://howto-kalender-maken-en-toewijzen): koraci za izradu vlastitog kalendara i njegovu dodjelu zadacima.
- [Generiranje praznika i kolektivnog godišnjeg odmora u građevinarstvu](docs://howto-feestdagen-genereren): ispunjavanje praznika države i kolektivnog godišnjeg odmora u građevinarstvu.
- [Postavljanje kalendara resursa](docs://howto-resourcekalender-instellen): bilježenje dostupnosti resursa.
- [Prozori kalendara](docs://ref-kalenders): sva polja prozora kalendara.
