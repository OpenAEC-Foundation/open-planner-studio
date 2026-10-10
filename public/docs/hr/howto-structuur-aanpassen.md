# Prilagođavanje strukture

Cilj: svrstajte zadatke u faze i podzadatke, promijenite njihov redoslijed i zadržite ispravne WBS brojeve.

## Kada vam ovo treba

Vaš raspored je stablo: faze (zadaci sažetka) s podzadacima ispod njih, na primjer *Foundation* s *Groundwork*, *Reinforcement* i *Pouring*. To stablo prilagođavate kada želite staviti zadatke pod fazu, izvaditi zadatak iz faze ili kada redoslijed nije ispravan. **WBS šifra** (1, 1.1, 1.2, 2, …) je broj zadatka u tom stablu.

## Koraci

### Uvući zadatak

1. Odaberite zadatak. Možete odabrati i više zadataka.
2. Odaberite *Raspored › Struktura › Uvući*. Možete i upotrijebiti Alt+→ (ili Alt+Shift+→) ili *Uvući* u kontekstnom izborniku.

Zadatak postaje posljednji podzadatak prethodnog zadatka na istoj razini. Taj zadatak time postaje zadatak sažetka. Ako odaberete neprekinuti blok, cijeli blok se uvlači kao cjelina. Ako zadatak nema prethodni zadatak na istoj razini, ništa se ne događa i ne prikazuje se poruka.

### Pomaknuti zadatak na višu razinu

Odaberite *Raspored › Struktura › Pomakni na višu razinu*, pritisnite Alt+← (ili Alt+Shift+←) ili odaberite *Pomakni na višu razinu* u kontekstnom izborniku.

Zadatak postaje zadatak iste razine, odmah nakon faze u kojoj je bio. Njegovi podzadaci idu s njim. Zadaci koji su bili iza njega u toj fazi ostaju u njoj. Zadatak na najvišoj razini ne pomiče se dalje.

### Premještanje zadatka

Imate tri načina.

- **Tipkovnicom.** Alt+↑ i Alt+↓ zamjenjuju zadatak sa susjednim zadatkom na istoj razini. Zadatak sažetka pomiče i svoje podzadatke. Na vrhu ili dnu razine ništa se ne događa. Ako je odabrano više zadataka, pomiče se samo zadatak koji ste prvi kliknuli.
- **Povlačenjem u tablici zadataka.** Pritisnite na redak i povucite ga okomito. Gornja četvrtina retka znači *prije*, donja četvrtina *nakon*. Sredina zadatka sažetka stavlja zadatak pod njega kao posljednji podzadatak. Sredina običnog zadatka računa se kao najbliži rub. Ako povučete redak koji je dio višestrukog odabira, pomiče se cijeli odabir.
- **Povlačenjem u Gantt-dijagramu.** Povucite traku okomito na drugi redak. To radi isto kao povlačenje u tablici zadataka i ne mijenja datume. Ako povučete vodoravno, umjesto toga pomičete datume.

Jedan korak naredbe *Poništi* (Ctrl+Z) poništava jedno premještanje.

### Ažuriranje WBS brojeva

Pogledajte gumb *WBS auto* na kartici *Raspored › Struktura*.

- **Uključeno (zadano u novom projektu).** Aplikacija renumerira cijelo stablo pri svakom dodavanju, brisanju i premještanju. WBS šifra je tada samo za čitanje: ne možete je upisati u tablicu zadataka ni u oknu *Svojstva*. *Renumeriraj WBS* je onemogućen.
- **Isključeno.** Šifre ostaju kakve jesu, i nakon premještanja i uvlačenja. Sami ih upisujete u stupac *WBS* ili u polje *WBS šifra* u oknu *Svojstva*. Ili jednom pokrenite *Renumeriraj WBS*. Ta naredba prepisuje i šifre koje ste sami upisali.

Ako uključite opciju *WBS auto*, aplikacija odmah numerira stablo. Obje naredbe, *WBS auto* i *Renumeriraj WBS*, mogu se poništiti pomoću *Poništi*.

## Zamke i što aplikacija radi

**Filtriranje, grupiranje ili sortiranje je uključeno.** Redoslijed koji vidite tada nije redoslijed rasporeda, pa aplikacija zaključava strukturu. *Uvući* i *Pomakni na višu razinu* su onemogućeni, s objašnjenjem *Nije dostupno tijekom filtriranja, grupiranja ili sortiranja*. Alt+→ i povlačenje prikazuju istu poruku u posebnom pojasu, s gumbom *Obriši*. Tim gumbom uklanjate filtar, grupiranje i sortiranje odjednom, a Ctrl+Z ih ne vraća. *Uvući* i *Pomakni na višu razinu* tada nedostaju u kontekstnom izborniku.

Alt+↑ i Alt+↓ rade u takvom prikazu, bez poruke. Uz samo filtar vidite novi redoslijed odmah. Uz sortiranje se redoslijed u rasporedu mijenja, ali to vidite tek nakon *Obriši*.

**Opcija WBS auto je isključena.** Novi zadatak dobije šifru koja odgovara njegovom mjestu u stablu, čak i ako je ta šifra već dodijeljena drugom zadatku. Tako se mogu pojaviti dvostruki brojevi. I nakon uvlačenja šifre više ne odgovaraju stablu. *Renumeriraj WBS* ispravlja oboje.

**Kontrolna točka dobije podzadatke.** Kontrolna točka je trenutak i nema podzadataka. Aplikacija uklanja oznaku kontrolne točke i javlja vam to.

**Zadatak s dodjelama resursa dobije podzadatke.** Zadatak sažetka sam nema dodjele. Aplikacija ih premješta na prvi novi podzadatak koji ih može preuzeti i javlja vam to. Ako takav podzadatak ne postoji ili već ima isti resurs, ništa se ne događa, a poruka kaže zašto.

**Ovisnost bi stvorila ciklus.** Ovisnosti zadatka sažetka vrijede i za njegove podzadatke. Ako bi zbog toga premještanje stvorilo ciklus, aplikacija ga odbija s porukom *Ovo premještanje stvorilo bi ciklus u rasporedu (…)*. Ništa se ne mijenja.

**Ovisnost između zadatka i vlastite faze.** Ako stavite zadatak pod fazu s kojom već ima ovisnost, ta ovisnost ostaje, ali se više ne uzima u obzir pri izračunu. Aplikacija vas o tome obavještava. Više o ovisnostima na zadacima sažetka možete pročitati u članku [Ovisnosti i vrijeme odgode](docs://uitleg-relaties).

**Raspored više nije ažuran.** Premještanje u drugu fazu može promijeniti datume. Pritisnite **Izračunaj** (F5). Samo zamjena redoslijeda unutar iste faze to ne čini.

## Pogledajte također

- [Dodavanje zadataka i kontrolnih točaka](docs://howto-taken-en-mijlpalen-toevoegen): stavite nove zadatke na pravo mjesto.
- [Spremanje i umetanje WBS predložaka](docs://howto-wbs-sjablonen): ponovno upotrijebite cijelu fazu.
- [Dodavanje ovisnosti](docs://howto-relaties-leggen): povežite zadatke.
- [Odabir, brisanje i poništavanje zadataka](docs://howto-taken-selecteren-verwijderen): poništite premještanje.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): četiri faze s podzadacima, onako kako ih gradite tako da ih uvučete.
