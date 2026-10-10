# Ažuriranje napretka

Cilj: unesite stvarno stanje posla u raspored i ponovno izračunajte raspored: koji su zadaci dovršeni, koji su u tijeku i koliko preostalog posla ostaje.

## Kada vam ovo treba

Napredak ažurirate u fiksnim trenucima, na primjer svaki petak kada voditelj gradilišta prijavi stanje. Tako raspored vidi što se stvarno dogodilo i izračunava preostali posao od datuma stanja. Zašto aplikacija to radi ovako, objašnjeno je u [Napredak, datum stanja i temeljni plan](docs://uitleg-voortgang).

## Koraci

### 1. Postavite datum stanja

Datum stanja je dan na koji procjenjujete stanje. Postavite ga prije nego što unesete napredak.

1. Idite na *Raspored › Temeljni planovi i napredak › Datum stanja*.
2. Upišite datum u tri polja za dan, mjesec i godinu (redoslijedom koji koristite za datume), na primjer 28, 06 i 2027, i pritisnite Enter. Aplikacija sama prelazi na sljedeće polje.
3. Malim križićem uz polje ponovno ispraznite datum stanja.

Ako procjenjujete stanje u petak nakon radnog vremena, postavite datum stanja na sljedeći radni dan, ponedjeljak. Aplikacija planira preostali posao od početka datuma stanja.

Ako unesete napredak dok još nema datuma stanja, aplikacija ga postavlja na danas i prijavljuje: *Datum stanja još nije bio postavljen: sada je postavljen na danas (…), jer se napredak mjeri do datuma stanja. Promijenite ga u Raspored → Datum stanja.* Zato to bolje prvo sami postavite.

### 2. Unesite napredak

Odaberite način koji odgovara vašoj situaciji. Svi načini daju isti rezultat.

**Jedan zadatak u oknu svojstava.** Korisno kada ažurirate jedan zadatak.

1. Kliknite zadatak. Ako ne vidite okno svojstava, uključite ga u *Prikaz › Paneli › Svojstva*.
2. Povucite klizač *Napredak (%)* na postotak koji je dovršen.
3. Po potrebi unesite *Stvarni početak* i *Stvarni završetak*, na isti način kao datum stanja. Aplikacija sama izračunava polje *Preostalo*. Ovdje ga ne možete mijenjati.

Kontrolna točka ima jedno polje, *Stvarni datum*.

**Odabir postotka u izborniku.** Korisno za brzo stanje.

1. Desnom tipkom miša kliknite traku zadatka u Gantt dijagramu.
2. Odaberite *Napredak*, a zatim 0%, 25%, 50%, 75% ili 100%.

**Više zadataka u tablici zadataka.** Korisno kada ažurirate cijeli popis.

1. Kliknite **+** desno od zaglavlja tablice zadataka (*Dodaj stupac*) i otvorite kategoriju *Napredak*. Dodajte stupce *Stvarni početak*, *Stvarni završetak*, *Preostalo* i *Status*. Stupac *Napredak* već je na kartici *Tablica*.
2. Dvaput kliknite ćeliju, upišite vrijednost i pritisnite Enter. Postotak upisujete kao `50` ili `50%`, datum kao `25-06-2027`, a preostalo trajanje kao `1`.
3. Za *Status* dvaput kliknite, pritisnite Enter i odaberite *Nije započeto*, *U tijeku* ili *Dovršeno*.

Ako upišete preostalo trajanje, aplikacija računa natrag do postotka: za zadatak od 2 radna dana, ostatak od 1 daje postotak 50. Ostatak 0 zadatak dovršava. Ako u stupcu *Status* odaberete *Nije započeto*, postotak prelazi na 0, a stvarni datumi nestanu.

**Sve za jedan zadatak u prozoru za uređivanje zadatka.** Desnom tipkom miša kliknite zadatak i odaberite *Uredi...*. Polja za napredak tu su također. Primjenjuju se tek kad kliknete *Spremi*.

**Više zadataka odjednom iz proračunske tablice.** Pogledajte [Uvoz napretka iz proračunske tablice](docs://howto-voortgang-importeren).

### 3. Ponovno izračunajte raspored

Svaka promjena napretka ili datuma stanja čini raspored zastarjelim. Traka stanja prikazuje *Zastarjelo — ponovno izračunajte (F5)*. Pritisnite **Izračunaj** (F5), na primjer preko *Raspored › Raspored › Izračunaj*. Ako je *Automatsko izračunavanje* uključeno (u *Postavke › Projekt › Postavke*, kartica *Raspored*), aplikacija to radi sama.

## Provjera rezultata

- Na datumu stanja Gantt prikazuje isprekidanu liniju, s datumom u zaglavlju. Kod zadataka u tijeku linija se na mjestu postotka izbočuje u traci. Ove linije uključujete ili isključujete u *Prikaz › Temeljni planovi i napredak › Linija napretka* i *Linija datuma stanja*.
- Dovršeni zadaci nikada nisu crveni: uz datum stanja dovršeni zadatak nije kritičan.
- Faze prikazuju izvedeni postotak, a završetak rasporeda se možda već pomaknuo.
- Ako ste spremili temeljni plan, izvorni raspored nalazi se ispod svake trake, a vrsta izvješća *Odstupanja* prikazuje odstupanje.

## Zamke i što aplikacija radi

**Datum nakon datuma stanja.** Aplikacija ne prihvaća stvarni početak ili stvarni završetak nakon datuma stanja. U oknu to piše ispod polja: *Stvarni podaci ne mogu biti nakon datuma stanja*. U tablici ćelija prijavljuje: *Stvarni datum je nakon datuma stanja.* Najprije postavite kasniji datum stanja ili ispravite datum.

**Zadatak koji bi tek počeo nakon datuma stanja.** Ako unesete napredak za zadatak koji prema rasporedu još ne bi počeo, otvara se prozor *Unesite stvarni početak*. Prozor pita kada je zadatak stvarno počeo. Predložena vrijednost je datum stanja. Pomoću *Primijeni napredak* to bilježite, a pomoću *Odustani* ništa se ne mijenja.

**100% bez datuma.** Ako zadatak postavite na 100% bez stvarnog završetka, stvarni završetak postaje datum stanja, čak i ako je zadatak završen ranije. Zatim sami unesite stvarni završetak.

**Postotak ispod 100%.** Ako dovršeni zadatak vratite na manje od 100%, stvarni završetak se briše. Ako obrišete samo stvarni završetak, postotak prelazi na 0, a zadatak ostaje *U tijeku*. Ako želite da se zadatak ponovno smatra nezapočetim, obrišite i stvarni početak ili u tablici u stupcu *Status* odaberite *Nije započeto*.

**Promjena trajanja zadatka u tijeku.** Obavljeni rad ostaje obavljen, a postotak se prilagođava. Zadatak od 5 radnih dana na 60% koji promijenite na 10 radnih dana završava na 30%. Aplikacija ne prihvaća trajanje kraće od već obavljenog rada: *'Build inner cavity leaf' je već 60% završen: trajanje kraće od već obavljenog rada nije moguće. Trajanje nije promijenjeno.* U tablici ćelija prijavljuje: *Ovo trajanje kraće je od rada koji je već obavljen.*

**Preostalo trajanje se zaokružuje.** Aplikacija zaokružuje preostalo trajanje na cijele radne dane. Za zadatak od 2 radna dana, i 50% i 75% daju ostatak od 1 radnog dana.

**Faza.** Faza nema vlastiti napredak. U oknu piše: *Izvedeno iz podzadataka: promijenite napredak tamo. Zadatak sažetka slijedi nakon izračunavanja (F5).* U tablici ćelija prijavljuje: *Napredak zadatka sažetka izvodi se iz podzadataka i ovdje se ne može mijenjati.*

**Kasnije pomicanje datuma stanja.** Preostali posao zadataka u tijeku počinje na novom datumu stanja. Rad koji još nije počeo ne može biti prije tog datuma. Zato datum stanja pomičite samo zajedno s ažuriranjem napretka. Ako postavite datum stanja, a ne unesete napredak, sav rad koji još nije počeo pomiče se na taj datum (osim u profilu Microsoft Project).

**Pogreška.** Svaku promjenu napretka poništite jednim pritiskom na Ctrl+Z.

## Pogledajte također

- [Napredak, datum stanja i temeljni plan](docs://uitleg-voortgang): kako aplikacija izračunava preostali posao i datum stanja, s primjerom.
- [Uvoz napretka iz proračunske tablice](docs://howto-voortgang-importeren): čitanje napretka za više zadataka odjednom.
- [Odabir načina praćenja napretka](docs://howto-voortgangsmodus-kiezen): što aplikacija radi sa zadatkom koji je počeo dok njegov prethodnik još traje.
- [Spremanje i upravljanje temeljnim planom](docs://howto-baseline-opslaan-en-beheren): bilježenje izvornog rasporeda radi usporedbe napretka.
