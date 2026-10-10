# Novi projekt i Podaci o projektu

Polja prozora *Novi projekt* i prozora *Podaci o projektu*: što svako polje radi, koja je zadana vrijednost i gdje djeluje. Riječ je o dvije strane istog obrasca. *Novi projekt* stvara novi projekt i ima nekoliko dodatnih polja. *Podaci o projektu* mijenjaju projekt koji je otvoren.

## Otvaranje

**Novi projekt** — *Datoteka › Novo*, Ctrl+N ili znak plus desno od kartica dokumenata (*Pokreni projekt*, zatim *Novi projekt*). Prozor se otvara s pokazivačem u polju *Naziv projekta*.

**Podaci o projektu** — *Postavke › Projekt › Podaci o projektu* otvara obrazac kao prozor s naslovom *Informacije o projektu*. *Datoteka › Podaci o projektu* prikazuje isti obrazac na zaslonu *Datoteka*. Blok *Profil izračuna i opcije izračuna* nalazi se dolje na oba mjesta. Što je u njemu, opisano je u [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies).

## Stvori, Primijeni i odustajanje

**Stvori** (u prozoru *Novi projekt*) stvara projekt i otvara ga u vlastitoj kartici. **Primijeni** (u prozoru *Podaci o projektu*) upisuje vaše promjene u projekt.

- **Samo pri Primijeni.** Upisujete u nacrt. Projekt se mijenja samo kad kliknete *Primijeni*. *Primijeni* upisuje samo ono što ste stvarno promijenili, u jednom koraku koji se može poništiti naredbom *Poništi*. Ako kliknete *Primijeni* bez promjene, ne događa se ništa i ne dodaje se korak.
- **Odustani, križić i Esc** zatvaraju prozor bez spremanja. Klik pored prozora ga ne zatvara: ono što ste upisali ostaje.
- **Enter** radi isto što i *Stvori* ili *Primijeni*, osim u polju *Opis* i u otvorenom padajućem izborniku.
- **Na zaslonu Datoteka** *Podaci o projektu* na dnu prikazuju poruku *Promjene nisu primijenjene — kliknite Primijeni da ih zadržite.* dok se vaš nacrt razlikuje. Ako zatim napustite zaslon, aplikacija pita želite li primijeniti, odbaciti ili odustati. Pogledajte [Vrpca, kartica po kartica](docs://ref-lint).
- **Prilagođeni profil izračuna bez naziva** blokira *Primijeni* i *Stvori*. Dajte mu naziv ili odbacite promjenu.

## Polja u oba prozora

**Naziv projekta** — naziv projekta u naslovnoj traci, na kartici i u nazivu datoteke pri spremanju. Zadano: prazno. Prazno polje je dopušteno: projekt se tada zove *Novi raspored*, prikazan sivim tekstom u polju. Gdje: cijeli zaslon.

**Opis** — slobodan tekst. Zadano: prazno. Učinak: pohranjuje se s projektom, u IFC datoteci i u izvozu u Primavera P6 XML, a nema utjecaja na raspored.

**Autor** — slobodan tekst. Zadano: prazno. Učinak: ide u IFC datoteku i pojavljuje se kao *Autor:* u zaglavlju izvješća, gdje ga ne možete ponovno upisati.

**Biblioteka resursa** — biblioteka resursa s kojom je projekt povezan. Možete odabrati: *bez biblioteke (samostalan projekt)*, postojeće biblioteke ili *+ Nova biblioteka resursa…*. Zadano: u prozoru *Novi projekt* zadana biblioteka, u prozoru *Podaci o projektu* trenutno povezana biblioteka. Učinak: pogledajte [Korištenje biblioteke resursa](docs://howto-resourcebibliotheek-gebruiken). S *+ Nova biblioteka resursa…* upisujete naziv u polje ispod. Biblioteka se stvara tek pri *Stvori* ili *Primijeni*, pa odustajanje ne ostavlja ništa iza sebe. Biblioteka u prozoru *Podaci o projektu* mijenja se samo ako sami dirate ovo polje.

**Klijent/organizacija** — slobodan tekst. Zadano: prazno. Učinak: ide u IFC datoteku i pojavljuje se kao *Tvrtka:* u zaglavlju izvješća.

**Datum početka** — početak projekta. Zadano: u prozoru *Novi projekt* danas. Što polje radi, opisano je dolje pod *Što radi datum početka*.

**Datum završetka** — planirani završetak projekta. Zadano: prazno. Učinak: podatak, a ne zahtjev. Aplikacija ne planira prema ovom datumu. Pojavljuje se u zaglavlju izvješća i u izvozima te određuje do koje se godine generiraju praznici. Samo za datoteku Primavera s postavkom *Izračunati vremensku rezervu do datuma završetka projekta* (pogledajte [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies)) izračun vremenske rezerve ide do ovog datuma.

**Zadana jedinica za nove zadatke** — vidljivo samo kad je *Uključi planiranje u satima* uključeno. Možete odabrati *Dani* ili *Sati*. Zadano: *Dani*. Učinak i uvjeti: pogledajte [Uključivanje planiranja u satima](docs://howto-urenplanning-aanzetten).

**Profil izračuna i opcije izračuna** — u prozoru *Podaci o projektu* cijeli blok, u prozoru *Novi projekt* samo padajući izbornik *Profil izračuna* s *Primavera P6*, *Microsoft Project* i *Open Planner Studio*. Zadano: *Open Planner Studio*. Kad odaberete profil, postavljaju se i zadane opcije tog profila. Pogledajte [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies).

## Samo u prozoru Novi projekt

**Predložak faza** — koje faze projekt na početku ima. Možete odabrati *Prazno*, *Stambena gradnja* i *Poslovna gradnja / obnova*. Zadano: *Prazno*. Učinak: *Prazno* daje projekt bez zadataka. Druga dva predloška pripremaju osam zadataka faza, svaki s trajanjem 5 u zadanoj jedinici projekta (5 radnih dana ili 5 sati ako odaberete *Sati* pod *Zadana jedinica za nove zadatke*) i bez ovisnosti. Zadatke sami preimenujete, premještate i produljujete. Za *Stambena gradnja* to su: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking i Oplevering. Za *Poslovna gradnja / obnova*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen i Oplevering. Nazivi su podaci vašeg projekta i ostaju na nizozemskom, i kad je jezik sučelja drugi. Ako je *Omogući građevinski način rada* isključeno, postoji samo *Prazno*. Pogledajte [Postavke](docs://ref-instellingen).

**Smjena** — vidljivo samo kad je *Uključi planiranje u satima* uključeno. Možete odabrati *Dnevna smjena*, *2 smjene*, *3 smjene* i *24/7*. Zadano: *Dnevna smjena*. Učinak: *Dnevna smjena* ostavlja standardni kalendar kakav jest, obični dnevni kalendar od ponedjeljka do petka. Ostala tri dodaju blokove radnog vremena u kalendar projekta, kao gumbi istog naziva u prozoru *Kalendari*. Koja su to vremena, opisano je u [Postavljanje radnog vremena](docs://howto-werktijden-instellen). S *Dnevna smjena* ne može se odabrati *Sati* pod *Zadana jedinica za nove zadatke*, jer dnevni kalendar nema blokove radnog vremena.

**Skup praznika** — koje neradne dane kalendar projekta dobiva. Pod *Država* birate *Nizozemska* (zadano), *Njemačka*, *Belgija*, *Francuska*, *Ujedinjeno Kraljevstvo*, *Austrija*, *Švicarska*, *Bez praznika* ili *Prilagođeno…*. Ima li država regije, dodaje se padajući izbornik *Regija*. Za Nizozemsku birate i, ako je *Omogući građevinski način rada* uključeno, *Kolektivni godišnji odmor u građevinarstvu*: *Nema* (zadano), *Sjever*, *Središnja* ili *Jug*. Ispod toga je redak poput *Broj praznika: 36, 2025–2029*. Proširite ga za popis. Godine idu od godine prije datuma početka projekta do godine nakon datuma završetka projekta. Ako nema datuma završetka, ide do tri godine nakon početne godine. *Prilagođeno…* daje kalendar bez praznika i odmah nakon stvaranja otvara prozor *Kalendari*, da ih sami unesete. Kalendar projekta naziva se *Bouwkalender NL*, ili *Standaardkalender* ako je *Omogući građevinski način rada* isključeno. Izbor je tada također *Bez praznika*. Kako generator radi, opisano je u [Generiranje praznika i kolektivnog godišnjeg odmora u građevinarstvu](docs://howto-feestdagen-genereren).

## Što radi datum početka

Datum početka je sidro projekta. Vrijede tri pravila:

- **Novi zadaci počinju na datumu početka.** Zadatak koji dodate dobiva kao planirani početak datum početka projekta.
- **Zadatak s prethodnikom nikad ne počinje prije datuma početka.** Ako je završetak prethodnika ranije, zadatak čeka do datuma početka. Zadatak *bez* prethodnika zadržava svoj datum, čak i ako je prije datuma početka. To je potrebno da se raspored iz MS Project ili Primavera prikaže onako kako ga prikazuje izvorni program. Ograničenje *Mora započeti na (MSO)* ili *Mora završiti na (MFO)* krši oba pravila: takav zadatak ostaje na svom datumu, čak i ako on pada prije datuma početka.
- **Kasniji datum početka pomiče slobodne zadatke.** Ako datum početka postavite kasnije u prozoru *Podaci o projektu* i kliknete *Primijeni*, zadaci bez prethodnika i bez ograničenja koje postavlja donju granicu (*Ne početi prije*, *Mora započeti na*, *Ne završiti prije* ili *Mora završiti na*), koji bi bili prije novog datuma, pomaknu se na taj datum, u istom koraku koji se može poništiti naredbom *Poništi*. Aplikacija kaže koliko je zadataka pomaknuto. To se događa samo kad sami promijenite datum početka, nikad pri otvaranju datoteke. Kasnije postavljanje datuma početka ne pomiče ostatak rasporeda: to radi *Premjesti projekt*, pogledajte [Premještanje projekta](docs://howto-project-verplaatsen).

## Pogledajte također

- [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies): blok *Profil izračuna i opcije izračuna*.
- [Profili izračuna i pravila izračuna](docs://uitleg-rekenprofielen): zašto profil mijenja ishod.
- [Premještanje projekta](docs://howto-project-verplaatsen): cijeli raspored na drugi početak.
- [Dodavanje zadataka i kontrolnih točaka](docs://howto-taken-en-mijlpalen-toevoegen): početak s prvim zadacima.
- [Generiranje praznika i kolektivnog godišnjeg odmora u građevinarstvu](docs://howto-feestdagen-genereren): skup praznika detaljno.
