# Novi projekt i Postavke projekta

Polja prozora *Novi projekt* i *Postavke projekta*: što svako polje radi, koja je zadana vrijednost i gdje djeluje. To su dvije strane istog obrasca. *Novi projekt* stvara novi projekt i ima nekoliko dodatnih polja. *Postavke projekta* mijenjaju projekt koji ste otvorili.

## Otvaranje

**Novi projekt** — *Datoteka › Novo*, Ctrl+N, ili znak plus desno od kartica dokumenta (*Pokreni projekt*, zatim *Novi projekt*). Prozor se otvara s kursorom u polju *Naziv projekta*.

**Postavke projekta** — *Postavke › Projekt › Postavke projekta* otvara obrazac kao prozor s naslovom *Postavke projekta*. *Datoteka › Postavke projekta* prikazuje isti obrazac na zaslonu *Datoteka*. Blok *Profil izračuna i opcije izračuna* nalazi se na dnu na oba mjesta; što je u njemu, opisano je u [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies).

## Stvaranje, primjena i odustajanje

**Stvori** (u prozoru *Novi projekt*) stvara projekt. Ako je vaša trenutna kartica prazna i nepromijenjena, aplikacija koristi tu karticu. Inače se projekt otvara u novoj kartici. **Primijeni** (u prozoru *Postavke projekta*) zapisuje vaše promjene u projekt.

- **Samo pri primjeni.** Upisujete u nacrt. Projekt se mijenja samo kad kliknete *Primijeni*. *Primijeni* zapisuje samo ono što ste stvarno promijenili, kao jedan korak koji možete vratiti naredbom *Poništi*. Ako kliknete *Primijeni* bez promjena, ništa se ne događa i ne dodaje se korak.
- **Odustani, križić i Esc** zatvaraju prozor bez spremanja ičega. Klik pored prozora ga ne zatvara: ono što ste upisali ostaje.
- **Enter** radi isto što *Stvori* ili *Primijeni*, osim u polju *Opis* i u otvorenom padajućem izborniku.
- **Na zaslonu Datoteka** *Postavke projekta* prikazuje na dnu *Promjene nisu primijenjene — kliknite Primijeni da ih zadržite.* dok se vaš nacrt razlikuje. Ako zatim napustite zaslon, aplikacija vas pita želite li promjene primijeniti, odbaciti ili odustati. Pogledajte [Vrpca, kartica po kartica](docs://ref-lint).
- **Prilagođeni profil izračuna bez naziva** blokira *Primijeni* i *Stvori*. Dajte mu naziv ili odbacite promjenu.

## Polja u oba prozora

**Naziv projekta** — naziv projekta u naslovnoj traci, na kartici i u nazivu datoteke pri spremanju. Zadano: prazno. Prazno polje je dopušteno: projekt se tada zove *Novi raspored*, prikazan sivim tekstom u polju. Gdje: cijeli zaslon.

**Opis** — slobodan tekst. Zadano: prazno. Učinak: sprema se s projektom, u IFC datoteci i u izvozu u Primavera P6 XML, a nema utjecaja na raspored.

**Autor** — slobodan tekst. Zadano: prazno. Učinak: ide u IFC datoteku i pojavljuje se kao *Autor:* u zaglavlju izvješća, gdje ga ne možete ponovno upisati.

**Biblioteka resursa** — s kojom bibliotekom resursa je projekt povezan. Odaberite između *bez biblioteke (samostalan projekt)*, vaših postojećih biblioteka i *+ Nova biblioteka resursa…*. Zadano: u prozoru *Novi projekt* zadana biblioteka, u prozoru *Postavke projekta* trenutna veza. Učinak: pogledajte [Korištenje biblioteke resursa](docs://howto-resourcebibliotheek-gebruiken). Ako odaberete *+ Nova biblioteka resursa…*, upisujete naziv u polje ispod. Biblioteka se stvara tek kad kliknete *Stvori* ili *Primijeni*, pa odustajanje ništa ne ostavlja za sobom. Veza u prozoru *Postavke projekta* mijenja se samo ako sami izmijenite ovo polje.

**Naručitelj/organizacija** — slobodan tekst. Zadano: prazno. Učinak: ide u IFC datoteku i pojavljuje se kao *Tvrtka:* u zaglavlju izvješća.

**Datum početka** — početak projekta. Zadano: u prozoru *Novi projekt* danas. Što polje radi, opisano je dolje pod *Što radi datum početka*.

**Datum završetka** — planirani završetak projekta. Zadano: prazno. Učinak: podatak, a ne zahtjev: aplikacija ne planira prema ovom datumu. Pojavljuje se u zaglavlju izvješća i u izvozima te određuje do koje godine se generiraju praznici. Samo za datoteku iz programa Primavera s postavkom *Izračunati vremensku rezervu do datuma završetka projekta* (vidi [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies)) izračun vremenske rezerve ide do ovog datuma.

**Zadana jedinica za nove zadatke** — vidljivo samo kad je *Uključi planiranje u satima* uključeno. Odaberite između *Dani* i *Sati*. Zadano: *Dani*. Učinak i uvjeti: pogledajte [Uključivanje planiranja u satima](docs://howto-urenplanning-aanzetten).

**Profil izračuna i opcije izračuna** — u prozoru *Postavke projekta* cijeli blok, u prozoru *Novi projekt* samo padajući izbornik *Profil izračuna* s opcijama *Primavera P6*, *Microsoft Project* i *Open Planner Studio*. Zadano: *Open Planner Studio*. Odabirom profila postavljaju se i zadane opcije tog profila. Pogledajte [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies).

## Samo u prozoru Postavke projekta

**IFC shema pri spremanju** — koja IFC shema je u zaglavlju spremljene datoteke. Izbor: *IFC 4.3 ADD2 (zadano)*, *IFC 4.3* i *IFC4*. Zadano: *IFC 4.3 ADD2 (zadano)*; za otvorenu IFC datoteku shema te datoteke. Učinak: mijenja se samo zaglavlje datoteke, a ne sadržaj. Upotrijebite je za spajanje rasporeda s modelom zgrade u istoj shemi. Ako otvorena datoteka ima drugu shemu od zadane, aplikacija vas pri prvom spremanju pita želite li zadržati tu shemu; izbor ovdje vrijedi kao odgovor. Drugi izbor ovdje nije korak u naredbi *Poništi*: shema pripada datoteci. Pogledajte [Odabir IFC sheme](docs://howto-ifc-schema-kiezen).

## Samo u prozoru Novi projekt

**Predložak faza** — s kojim fazama projekt počinje. Odaberite između *Prazno*, *Stambena gradnja* i *Poslovna gradnja / obnova*. Zadano: *Prazno*. Učinak: *Prazno* daje projekt bez zadataka. Druge dvije opcije pripremaju osam zadataka faza, svaki s trajanjem 5 u zadanoj jedinici projekta (5 radnih dana ili 5 sati ako pod *Zadana jedinica za nove zadatke* odaberete *Sati*) i bez ovisnosti. Sami ih preimenujete, premjestite i produljite. Za predložak *Stambena gradnja* to su: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking i Oplevering. Za predložak *Poslovna gradnja / obnova*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen i Oplevering. Nazivi su podaci vašeg projekta i ostaju nizozemski, također kad je sučelje na drugom jeziku. Ako je *Omogući građevinski način rada* isključen, postoji samo *Prazno*. Pogledajte [Postavke aplikacije](docs://ref-instellingen).

**Smjena** — vidljivo samo kad je *Uključi planiranje u satima* uključeno. Odaberite između *Dnevna smjena*, *2 smjene*, *3 smjene* i *24/7*. Zadano: *Dnevna smjena*. Učinak: *Dnevna smjena* ostavlja standardni kalendar kakav jest, obični dnevni kalendar od ponedjeljka do petka. Ostale tri opcije dodaju blokove radnog vremena u kalendar projekta, kao gumbi s istim nazivom u prozoru *Kalendari*. Koja su to vremena, opisano je u [Postavljanje radnog vremena](docs://howto-werktijden-instellen). Ako je odabrana *Dnevna smjena*, ne može se odabrati *Sati* u polju *Zadana jedinica za nove zadatke*, jer dnevni kalendar nema blokove radnog vremena.

**Skup praznika** — koje slobodne dane dobiva kalendar projekta. U polju *Država* odaberete *Nizozemska* (zadano), *Njemačka*, *Belgija*, *Francuska*, *Ujedinjeno Kraljevstvo*, *Austrija*, *Švicarska*, *Bez praznika* ili *Prilagođeno…*. Ako država ima regije, dodaje se padajući izbornik *Regija*. Za Nizozemsku još odaberete, ako je *Omogući građevinski način rada* uključen, *Kolektivni godišnji odmor u građevinarstvu*: *Nema* (zadano), *Sjever*, *Središnja* ili *Jug*. Ispod toga je redak sličan *Broj praznika: 36, 2025–2029*, koji proširite za popis. Godine idu od godine prije datuma početka projekta do godine nakon datuma završetka, ili do tri godine nakon početne godine ako nema datuma završetka. *Prilagođeno…* daje kalendar bez praznika i odmah nakon stvaranja otvara prozor *Kalendari*, pa praznike upišete sami. Kalendar projekta zove se *Bouwkalender NL*, ili *Standaardkalender* ako je *Omogući građevinski način rada* isključen; izbor je tada i *Bez praznika*. Kako generator radi, opisano je u [Generiranje praznika i kolektivnog godišnjeg odmora u građevinarstvu](docs://howto-feestdagen-genereren).

## Što radi datum početka

Datum početka je sidro projekta. Tri pravila:

- **Novi zadaci počinju na datumu početka.** Zadatak koji dodate dobiva datum početka projekta kao planirani početak.
- **Zadatak s prethodnikom nikad ne počinje prije datuma početka.** Ako je završetak prethodnika ranije, zadatak čeka do datuma početka. Zadatak *bez* prethodnika zadržava svoj datum, čak i ako je prije datuma početka. To je potrebno da se raspored iz programa MS Project ili Primavera prikaže onako kako ga prikazuje izvorni program. Ograničenje *Mora započeti na (MSO)* ili *Mora završiti na (MFO)* krši oba pravila: takav zadatak ostaje na svom datumu, čak i ako pada prije datuma početka.
- **Kasniji datum početka pomiče slobodne zadatke.** Ako kasniji datum početka postavite u prozoru *Postavke projekta* i kliknete *Primijeni*, zadaci bez prethodnika i bez ograničenja koje postavlja donju granicu (*ne početi prije*, *mora započeti na*, *ne završiti prije* ili *mora završiti na*) pomaknu se na novi datum ako bi inače bili prije njega, u istom koraku u naredbi *Poništi*. Aplikacija kaže koliko je zadataka pomaknuto. To se događa samo kad sami promijenite datum početka, nikad pri otvaranju datoteke. Kasniji datum početka ne pomiče ostatak rasporeda: to radi *Premjesti projekt*, pogledajte [Premještanje projekta](docs://howto-project-verplaatsen).

## Pogledajte i

- [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies): blok *Profil izračuna i opcije izračuna*.
- [Profili izračuna i pravila izračuna](docs://uitleg-rekenprofielen): zašto profil mijenja ishod.
- [Premještanje projekta](docs://howto-project-verplaatsen): cijeli raspored na drugi početak.
- [Dodavanje zadataka i kontrolne točke](docs://howto-taken-en-mijlpalen-toevoegen): početak s prvim zadacima.
- [Generiranje praznika i kolektivnog godišnjeg odmora u građevinarstvu](docs://howto-feestdagen-genereren): skup praznika detaljno.
- [Odabir IFC sheme](docs://howto-ifc-schema-kiezen): spremanje za model zgrade u IFC4.
