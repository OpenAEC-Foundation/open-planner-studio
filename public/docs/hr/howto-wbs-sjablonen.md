# Spremanje i umetanje predložaka WBS-a

Cilj: spremiti fazu s njezinim podzadacima i njihovim ovisnostima kao predložak i kasnije ga ponovno umetnuti u isti ili drugi projekt.

## Kada vam ovo treba

Stalno planirate istu vrstu posla: svaka kuća ima temelj s pripremnim radovima, armiranjem, ulijevanjem betona i njegom betona. Umjesto da te zadatke stvarate iznova i povezujete ih, fazu spremite jednom kao **predložak**. Predložak je grana vašeg WBS-a: jedan zadatak sa svime što visi pod njim.

## Koraci

### Spremanje grane kao predložak

1. Izgradite granu onako kako je želite ponovno upotrijebiti: zadatak sažetka s podzadacima i ovisnostima među njima.
2. Desnom tipkom miša kliknite taj zadatak sažetka i odaberite *Spremi granu kao predložak*. Ta stavka izbornika prikazuje se samo kod zadataka s podzadacima.

Aplikacija prikazuje poruku *Grana spremljena kao predložak 'Foundation'*. Aplikacija ne traži ime: predložak dobiva ime po najvišem zadatku grane.

### Umetanje predloška

1. Odaberite zadatak ispod kojeg predložak treba biti, ili ne odaberite ništa.
2. Odaberite *Raspored › Struktura › Predlošci*. Popis prikazuje ime svakog predloška i, na primjer, *4 zadataka, 2 ovisnosti*.
3. Kliknite predložak.

Ako je odabran zadatak, predložak se umeće kao zadnji podzadatak ispod tog zadatka. Taj zadatak zato postaje zadatak sažetka. Ako je odabrano više zadataka, računa se onaj koji ste prvi kliknuli. Ako nije odabrano ništa, grana se stavlja na dno popisa, na najvišu razinu. Umetnuta grana se nakon toga odabere.

Svi umetnuti zadaci počinju na datumu početka projekta, a raspored je zastario. Pritisnite **Izračunaj** (F5), na primjer kroz *Početna › Raspored › Izračunaj*, i datumi slijede iz ovisnosti. Umetanje se poništava jednim korakom naredbom *Poništi*. Spremanje ili brisanje predloška nije dio tog koraka.

### Brisanje predloška

Otvorite *Raspored › Struktura › Predlošci* i kliknite na mali koš desno od predloška (*Izbriši predložak*). Aplikacija ne traži potvrdu.

### Što je u predlošku

Predložak za svaki zadatak čuva ime, opis, vrstu zadatka, je li kontrolna točka i trajanje u danima. Od ovisnosti čuva samo one između dvaju zadataka unutar grane, zajedno s vrstom i vremenom odgode.

Sve ostalo ostaje iza: datumi, napredak i stvarni datumi, dodjele resursa, šifre i prilagođena polja (vidi [Šifre i prilagođena polja](docs://howto-codes-en-velden)), kalendar, ograničenja i rokovi za dovršetak, prioritet, prilagođena vrsta zadatka, za kontrolnu točku njezina vrsta i oznaka *Obvezno (ugovorno)*, te ovisnosti sa zadacima izvan grane. Nakon umetanja ponovno ih unesite: dodjele, šifre, kalendar i ograničenja su prazni, a svi zadaci počinju na datumu početka projekta.

Zadatak koji je bio u satima vraća se kao zadatak u danima, a njegovo se trajanje pretvara u dio radnog dana. Zadatak od 5 sati uz radni dan od 8 sati postaje 0,625 dana.

## Zamke i što aplikacija radi

**Predlošci ne pripadaju projektu.** Aplikacija ih čuva u pohrani aplikacije na ovom uređaju, a ne u datoteci projekta. Kolega koji otvori vašu datoteku ne vidi vaše predloške. U verziji za preglednik predložak pripada tom pregledniku. Ako su vam predlošci važni, čuvajte ih i na drugom mjestu: stavite ih u projekt koji spremite kao datoteku.

**Isto ime može se pojaviti više puta.** Ako granu spremite dvaput, popis sadrži dva predloška s istim imenom. Aplikacija ništa ne prepisuje.

**Trajanje najvišeg zadatka ne uzima se u obzir.** Zadatak sažetka dobiva trajanje od svojih podzadataka čim upotrijebite naredbu Izračunaj.

**Zadatak koji ima dodjele resursa kao cilj.** Ako odaberete zadatak s dodjelama koji još nema podzadatke i ispod njega umetnete predložak, aplikacija to odbija. Zadatak bi postao zadatak sažetka, a zadatak sažetka ne nosi dodjele. Najviši zadatak predloška već ima podzadatke, pa dodjele nemaju gdje otići. Aplikacija vas o tome obavijesti i ništa ne mijenja. Zatim odaberite drugi zadatak ili ništa kao mjesto. Kontrolna točka koja primi predložak gubi oznaku kontrolne točke, uz poruku.

**Nevažeća ovisnost u predlošku.** Ako ovisnost u predlošku nije dopuštena, na primjer zadatak prema vlastitoj fazi, ili već postoji, aplikacija je preskače i javi vam koliko je ovisnosti preskočeno.

## Vidi također

- [Prilagodba strukture](docs://howto-structuur-aanpassen): premjestiti ili uvući umetnutu granu.
- [Dodavanje ovisnosti](docs://howto-relaties-leggen): sami stvarate ovisnosti unutar grane prije nego je spremite.
- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): što se događa s umetnutom granom nakon naredbe Izračunaj.
