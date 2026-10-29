# Prilagođavanje strukture

Cilj: svrstajte zadatke u faze i podzadatke, promijenite njihov redoslijed i zadržite ispravne WBS brojeve.

## Kada vam ovo treba

Vaš raspored je stablo: faze (zadaci sažetka) s podzadacima ispod njih, na primjer *Foundation* s *Groundwork*, *Reinforcement* i *Pouring*. To stablo prilagođavate kada želite staviti zadatke pod fazu, izvaditi zadatak iz faze ili kada redoslijed nije ispravan. **WBS šifra** (1, 1.1, 1.2, 2, …) je broj zadatka u tom stablu.

## Koraci

### Uvući zadatak

1. Odaberite zadatak. Možete odabrati i više zadataka.
2. Odaberite *Raspored › Struktura › Uvući*. Možete i upotrijebiti Alt+→ (ili Alt+Shift+→) ili *Uvući* u kontekstnom izborniku.

Zadatak postaje posljednji podzadatak prethodnog zadatka na istoj razini. Taj zadatak time postaje zadatak sažetka. Ako odaberete neprekinuti niz, cijeli niz se uvlači kao cjelina. Ako zadatak nema prethodni zadatak na istoj razini, ništa se ne događa i ne prikazuje se poruka.

### Pomaknuti zadatak na višu razinu

Odaberite *Raspored › Struktura › Pomakni na višu razinu*, pritisnite Alt+← (ili Alt+Shift+←) ili odaberite *Pomakni na višu razinu* u kontekstnom izborniku.

Zadatak postaje zadatak iste razine, odmah nakon faze u kojoj je bio. Njegovi podzadaci idu s njim. Zadaci koji su bili iza njega u toj fazi ostaju u njoj. Zadatak na najvišoj razini ne pomiče se dalje.

### Premještanje zadatka

Imate tri načina.

- **Tipkovnicom.** Alt+↑ i Alt+↓ zamjenjuju zadatak sa susjednim zadatkom na istoj razini. Zadatak sažetka pomiče i svoje podzadatke. Na vrhu ili dnu razine ništa se ne događa. Ako je odabrano više zadataka, pomiče se samo zadatak koji ste prvi kliknuli.
- **Povlačenjem u tablici zadataka.** Pritisnite na redak i povucite ga okomito. Gornja četvrtina retka znači *prije*, donja četvrtina *nakon*. Sredina zadatka sažetka stavlja zadatak pod njega kao posljednji podzadatak. Sredina običnog zadatka računa se kao najbliži rub. Ako povučete redak koji je dio višestrukog odabira, pomiče se cijeli odabir.
- **Povlačenjem u Gantt-dijagramu.** Povucite traku okomito na drugi redak. To radi isto kao povlačenje u tablici zadataka i ne mijenja datume. Ako povučete vodoravno, umjesto toga pomičete datume.

Svako premještanje je jedan korak za *Poništi* (Ctrl+Z).

### Ažuriranje WBS brojeva

Pogledajte gumb *WBS auto* na kartici *Raspored › Struktura*.

- **Uključeno (zadano u novom projektu).** Uključeno je i nakon otvaranja datoteke bez ove postavke, ako se sve WBS šifre već podudaraju s numeriranjem stabla (1, 1.1, 1.2 …). Šifre se ne mijenjaju. Prazna datoteka bez ove postavke također dobiva *uključeno*, kao i novi projekt. Aplikacija renumerira cijelo stablo pri svakom dodavanju, brisanju i premještanju. WBS šifra je tada samo za čitanje: ne možete je upisati u tablicu zadataka ni u okno *Svojstva*. *Renumeriraj WBS* je onemogućen.
- **Isključeno.** Zadano je u datoteci s vlastitim šiframa, kao što je *A1000*, ili u datoteci u kojoj se jedna šifra razlikuje od stabla. Šifre ostaju kakve jesu, i nakon premještanja i uvlačenja. Sami ih upisujete u stupac *WBS* ili u polje *WBS šifra* u oknu *Svojstva*, ili jednom pokrenete *Renumeriraj WBS*. Ta naredba prepisuje i šifre koje ste sami upisali.

Ako uključite *WBS auto*, aplikacija odmah numerira stablo. Obje naredbe, *WBS auto* i *Renumeriraj WBS*, mogu se poništiti pomoću *Poništi*.

## Zamke i što aplikacija radi

**Filtriranje, grupiranje ili sortiranje je uključeno.** Redoslijed koji vidite tada nije redoslijed rasporeda, pa aplikacija zaključava strukturu. *Uvući* i *Pomakni na višu razinu* su onemogućeni, uz opis *Nije dostupno tijekom filtriranja, grupiranja ili sortiranja*. Alt+→ i povlačenje prikazuju isti tekst u crvenom pojasu, s gumbom *Obriši*. Tim gumbom uklanjate filtar, grupiranje i sortiranje odjednom, a Ctrl+Z ih ne vraća. Pojas ostaje dok ne kliknete križić, ne upotrijebite Ctrl+Z ili Ctrl+Y, ili ne prijeđete na drugi dokument. *Uvući* i *Pomakni na višu razinu* tada nedostaju u kontekstnom izborniku.

Alt+↑ i Alt+↓ rade u takvom prikazu, bez poruke. Uz samo filtar redoslijed vidite odmah. Uz sortiranje se redoslijed u rasporedu doista mijenja, ali to vidite tek nakon *Obriši*.

**WBS auto je isključeno.** To se događa s datotekom koja ima vlastite šifre ili s datotekom koja postavku sprema kao *isključeno*. Novi zadatak dobije šifru koja odgovara njegovom mjestu u stablu, čak i ako je ta šifra već dodijeljena drugom zadatku. Tako se mogu pojaviti dvostruki brojevi. I nakon uvlačenja šifre više ne odgovaraju stablu. *Renumeriraj WBS* ispravlja oboje.

**Kontrolna točka dobije podzadatke.** Kontrolna točka je trenutak i nema podzadataka. Aplikacija uklanja oznaku kontrolne točke i javlja vam to.

**Zadatak s dodjelama resursa dobije podzadatke.** Zadatak sažetka sam nema dodjele. Aplikacija zato prvo pita što treba učiniti s njima, u prozoru *Zadatak postaje zadatak sažetka*. To se događa kad uvučete zadatak, kad upotrijebite *Dodaj podzadatak* ili *Dodaj kontrolnu točku* na zadatku, kad umetnete predložak ili kad u prozoru *Uredi zadatak* odaberete novi *Nadređeni zadatak*: za postojeći i za novi zadatak. U prozoru *Uredi zadatak* pitanje se pojavljuje prije spremanja. Ako tamo odaberete *Odustani*, prozor *Uredi zadatak* ostaje otvoren s vašim promjenama. Birate:

- *Odustani*: ništa se ne mijenja, a struktura također ostaje kakva je bila.
- *Izbriši dodjelu*: zadatak dobiva podzadatke, a njegove dodjele se brišu. Stvarni rad tih dodjela također se briše.
- *Premjesti na „…“*: dodjele prelaze na prvi novi podzadatak koji ih može preuzeti, zajedno sa stvarnim radom. Kontrolna točka ili zadatak sažetka ne mogu preuzeti dodjele.

Ako taj podzadatak već ima isti resurs ili ne postoji prikladan podzadatak, *Premjesti* je onemogućeno. Narančasti okvir u prozoru kaže vam zašto.

Ako dodjela već ima stvarni rad, narančasti okvir kaže koliko sati po resursu, na primjer *Na dodjeli za Metselaar već je evidentirano 8 sati stvarnog rada. Brisanjem se taj rad gubi.* *Odustani* je tada zadani gumb: Enter ne mijenja ništa. Ako ipak želite izbrisati dodjelu, sami kliknite *Izbriši dodjelu*.

Dok je prozor otvoren, nijedna prečica izvan prozora ne radi, uključujući *Poništi*, *Zalijepi*, Delete, F5 i Ctrl+S. Ako jedna radnja odjednom stvori više zadataka sažetka, prozor prikazuje resurse po zadatku, a vaš izbor vrijedi za sve njih. Jedan korak *Poništi* (Ctrl+Z) poništava cijelu radnju.

**Ovisnost bi stvorila ciklus.** Ovisnosti zadatka sažetka vrijede i za njegove podzadatke. Ako bi zbog toga premještanje stvorilo ciklus, aplikacija ga odbija s porukom *Ovo premještanje stvorilo bi ciklus u rasporedu (…)*. Ništa se ne mijenja.

**Ovisnost između zadatka i vlastite faze.** Ako stavite zadatak pod fazu s kojom već ima ovisnost, ta ovisnost ostaje, ali se više ne uzima u obzir pri izračunu. Aplikacija vas o tome obavještava. Više o ovisnostima na zadacima sažetka možete pročitati u članku [Ovisnosti i vrijeme odgode](docs://uitleg-relaties).

**Raspored više nije ažuran.** Premještanje u drugu fazu može promijeniti datume. Pritisnite **Izračunaj** (F5). Samo zamjena redoslijeda unutar iste faze to ne čini.

## Pogledajte također

- [Dodavanje zadataka i kontrolnih točaka](docs://howto-taken-en-mijlpalen-toevoegen): stavite nove zadatke na pravo mjesto.
- [Spremanje i umetanje WBS predložaka](docs://howto-wbs-sjablonen): ponovno upotrijebite cijelu fazu.
- [Dodavanje ovisnosti](docs://howto-relaties-leggen): povežite zadatke.
- [Odabir, brisanje i poništavanje zadataka](docs://howto-taken-selecteren-verwijderen): poništite premještanje.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): četiri faze s podzadacima, onako kako ih gradite tako da ih uvučete.
