# Prozori za kalendare

Prozor *Kalendari* upravlja bibliotekom kalendara projekta: koji su radni dani, radna vremena i neradni dani te koji je projektni kalendar. Obrazac uz popis isti je kao u prozoru *Kalendar resursa*. Ovaj članak za svako polje kaže što ono radi, koja je zadana vrijednost i što od toga primijetite. Kako napraviti kalendar i dodijeliti ga zadacima, pogledajte u članku [Izrada i dodjela kalendara](docs://howto-kalender-maken-en-toewijzen). Kako aplikacija broji radne dane, pogledajte u članku [Kalendari i radni dani](docs://uitleg-kalenders).

## Gdje ga pronaći

- **Kalendari** — *Raspored › Kalendar › Kalendar* ili *Postavke › Kalendar › Kalendar*.
- **Kalendar zadatka** — polje *Kalendar* u prozoru *Uredi zadatak* ili u oknu *Svojstva*. Pogledajte [Dijaloški okvir zadatka i okno svojstava](docs://ref-taak-eigenschappen).
- **Kalendar resursa** — okno *Resursi*, stupac *Kalendar*: odaberite kalendar, odaberite *+ Kalendar resursa* za novi ili kliknite olovku (*Uredi…*) za odabrani kalendar. Pogledajte [Okno resursa](docs://ref-resourcepaneel).

## Biblioteka u prozoru Kalendari

Lijevo je popis kalendara, desno obrazac odabranog kalendara. Projektni kalendar ima zvjezdicu. Kalendar s neispravnim unosom ima crveni trokut (*Ovaj kalendar sadrži neispravan unos*).

- **Novi kalendar** (plus) — dodaje kalendar pod imenom *Novi kalendar* sa zadanim sadržajem aplikacije: od ponedjeljka do petka, od 07:00 do 16:00, 8 neto sati. Ako je *Omogući građevinski način rada* uključen (zadano), u njemu su i nizozemski praznici, bez kolektivnog godišnjeg odmora u građevinarstvu. Ako je isključen, popis je prazan. Ako ne želite te praznike, odaberite *Generiraj praznike…* pa u njemu *Bez praznika*. (Imena *Bouwkalender NL* i *Standaardkalender* ostaju nizozemska u svakom jeziku.)
- **Dupliciraj** — kopira odabrani kalendar pod imenom *{name} (duplikat)*.
- **Izbriši** (kanta za smeće) — briše odabrani kalendar. Onemogućeno je kada ostane samo jedan kalendar. Ako je to bio projektni kalendar, prvi preostali kalendar postaje projektni kalendar. Zadaci i resursi koji su koristili taj kalendar vraćaju se na projektni kalendar.
- **Postavi kao zadani kalendar projekta** — odabrani kalendar postaje projektni kalendar. Na kalendaru koji je već projektni kalendar pojavi se *Projektni kalendar* sa zvjezdicom. Učinak: svaki zadatak bez vlastitog kalendra računa se u ovom kalendaru, isto kao i resurs bez vlastitog kalendra. Zadatak kojem ste sami dodijelili kalendar zadržava ga.
- **Primijeni** — upisuje sve promjene cijelog popisa u projekt odjednom, ponovno izračunava raspored i zatvara prozor. Ne izračunava ponovno ako se u ukupnom zbroju ništa nije promijenilo. Onemogućeno je dok je u jednom od kalendara neispravan unos. Enter u običnom tekstualnom polju radi isto, ali prozor ostaje otvoren.
- **Odustani** — zatvara prozor i odbacuje sve što ste promijenili od otvaranja (ili od zadnjeg pritiska na Enter). Esc i križić djeluju kao *Odustani*. Klik pokraj prozora ne čini ništa, pa ne gubite unos.

Projekt prema zadanim postavkama ima kalendar *Bouwkalender NL* (građevinski način rada uključen) ili *Standaardkalender* (isključen), s radnim danima od ponedjeljka do petka, od 07:00 do 16:00.

## Obrazac

### Osnovno

- **Naziv** — naziv na popisu i u padajućim izbornicima za zadatke i resurse.
- **Radni dani** — gumb za svaki dan u tjednu, od *Pon* do *Ned*. Pritisnut gumb znači radni dan. Redoslijed prati *Tjedan počinje* (*Postavke*, kartica *Raspored*). Zadano: *Pon* do *Pet*. Dva brza gumba: *Pon–pet* postavlja od ponedjeljka do petka, od 07:00 do 16:00, 8 sati. Postavljena pauza ponovno postaje zadana pauza od 12:00, 60 minuta. *Kontinuirano (24/7)* postavlja svih sedam dana, od 00:00 do 24:00, 24 sata. Učinak: zadatak radi samo na radne dane. Aplikacija ne može izračunati kalendar bez radnih dana (*Kalendar nema postavljene radne dane*).
- **Početak (sat)** i **Završetak (sat)** — početak i završetak radnog dana, u obliku SS:MM u 24-satnoj notaciji. Zadano: 07:00 i 16:00. Strelice (ili tipke sa strelicama) mijenjaju vrijeme u koracima od 15 minuta. Završetak može biti 24:00, a početak mora biti prije završetka. Učinak: zajedno s pauzom određuju neto sate dnevno. Za datume zadatka u danima se ne računaju. Za zadatke u satima se računaju. Ta polja nestaju kada je uključeno *Uključi planiranje u satima* i kalendar ima radno vrijeme po danu u tjednu. Tada to radno vrijeme ima prednost.
- **Početak pauze** i **Trajanje pauze (minuta)** — početak i duljina pauze, u istim koracima od 15 minuta. Zadano: 12:00 i 60 minuta. Ako postavite trajanje na 0, radni dan je neprekinut. Pauza mora u potpunosti biti unutar radnog dana i ne smije zauzeti cijeli radni dan. Učinak: neto sati su završetak minus početak minus pauza. Za zadatak u satima u pauzi se ne radi. Ista polja nestaju pod istim uvjetom kao *Početak (sat)*.
- **Neto sati dnevno** — samo za čitanje: izvedena duljina radnog dana, s dvije decimale, na primjer *8.00 h*. Zadano: 8. Učinak: to je duljina dana pri pretvaranju između dana i sati te za zadatke u satima. Pogledajte [Dani i sati](docs://uitleg-dagen-en-uren).

### Radno vrijeme

Ovaj blok je prikazan samo kada je uključeno *Uključi planiranje u satima* (*Postavke*, kartica *Raspored*). Ovdje postavljate radno vrijeme i smjene po danu u tjednu. Pogledajte [Postavljanje radnog vremena](docs://howto-werktijden-instellen).

- **Predlošci** — gumbi koji odjednom postavljaju radno vrijeme: *Dnevna smjena* (Pon–pet 08:00 do 16:00, običan dnevni kalendar), *2 smjene* (Pon–pet 06:00 do 22:00, 16 sati), *3 smjene* (Pon–pet 06:00 do 06:00 sljedeći dan, 24 sata), *Noćna smjena* (Pon–pet 22:00 do 06:00, 8 sati) i *24/7* (svi dani od 00:00 do 24:00). Iza ugrađenih gumba su vaši vlastiti predlošci, s križićem za njihovo brisanje.
- **Spremi kao predložak…** — sprema trenutačno radno vrijeme kao vlastiti predložak, na ovom uređaju, pa ga možete ponovno upotrijebiti u bilo kojem projektu. Dajete naziv (*Naziv vašeg vlastitog predloška*) i kliknete *Spremi* ili *Odustani*.
- **Postavi po danu…** — pretvara dnevni kalendar u satni kalendar: trenutačna vremena postaju blokovi radnog vremena svakog radnog dana, a pauza ostaje kao razmak. Za satni kalendar gumb se zove *Sakrij radno vrijeme* ili *Prikaži radno vrijeme* i sklapa ili razvija uređivač. Za satni kalendar je uređivač zadano otvoren.
- **Uređivač** — za svaki dan u tjednu popis blokova (*blok*) s vremenom početka i završetka. Oznaka *sljedeći dan* omogućuje da blok traje preko ponoći (noćna smjena). *Dodaj blok* (plus) dodaje blok od 08:00 do 16:00. *Kopiraj na sve radne dane* (samo za Pon–pet) kopira blokove tog dana od ponedjeljka do petka. Dan bez blokova zove se *Neradno*. Dolje je *Izračunati sati/dan:*. Čim dan ima više od jednog bloka, pojavi se napomena *Razmak između dvaju blokova je pauza — po potrebi prilagodite vremena*. Učinak: blokovi imaju prednost. Dan s blokovima je radni dan, a polja *Početak (sat)*, *Završetak (sat)* i pauza nestaju.

### Praznici

- **Generiraj praznike…** — otvara generator. *Država* bira *Nizozemska*, *Njemačka*, *Belgija*, *Francuska*, *Ujedinjeno Kraljevstvo*, *Austrija*, *Švicarska* ili *Bez praznika*. *Regija* se pojavi samo ako država ima regije; zadano *Nacionalno*. *Kolektivni godišnji odmor u građevinarstvu* se pojavi samo za Nizozemsku i kada je uključeno *Omogući građevinski način rada*. Izbori su *Nema* (zadano), *Sjever*, *Središnja* i *Jug*, uz napomenu *Preporučeni datumi — provjerite kod Bouwend Nederland*. Redak pregleda pokazuje koliko će se praznika generirati (*… praznika, …–…*), s mogućnošću proširenja za popis. *Generiraj* stavlja rezultat u kalendar koji uređujete (vrijedi tek nakon *Primijeni*). *Odustani* zatvara generator. Učinak: cijeli popis *Praznici* zamjenjuje se, uključujući ono što ste sami dodali. Godine koje generator pokriva idu od godine prije datuma početka projekta do uključivo godine nakon završetka projekta (bez završetka projekta: do tri godine nakon početka). Pogledajte [Generiranje praznika i kolektivnog godišnjeg odmora u građevinarstvu](docs://howto-feestdagen-genereren).
- **Ponovno generiraj** — pojavi se pokraj gumba kada generirani praznici više ne pokrivaju razdoblje projekta, s tekstom *Praznici pokrivaju …–…; projekt traje do …. Želite li ponovno generirati?* Klik ponovno generira isti izbor (država, regija, kolektivni godišnji odmor u građevinarstvu) za novo razdoblje. Bez toga su dani izvan generiranih godina obični radni dani.
- **Praznici** — popis neradnih dana: *Opis*, *Od* i *Do*, i kanta za smeće u svakom retku. *Dodaj praznik* dodaje redak s današnjim datumom kao *Od* i praznim *Do*. Prazan *Do* znači jedan dan. Bez redaka piše *Još nema praznika*. Učinak: svi dani u razdoblju su neradni dani u ovom kalendaru, za zadatke u ovom kalendaru i za resurse koji ga koriste. Neispravan redak dobije crveni okvir i tekst (*Unesite važeći datum početka*, *Unesite važeći datum završetka ili ga ostavite prazno za jedan dan* ili *Datum završetka je prije datuma početka*) i blokira *Primijeni*.

### Poruke o greškama i iznimke

Greške u radnom vremenu se prikazuju ispod polja i blokiraju *Primijeni*: *Unesite važeće vrijeme početka u obliku SS:MM*, *Unesite važeće vrijeme završetka u obliku SS:MM*, *Vrijeme početka mora biti prije vremena završetka*, *Unesite važeće vrijeme pauze u obliku SS:MM*, *Trajanje pauze mora biti cijeli broj minuta od 0 ili više*, *Pauza mora u potpunosti biti unutar postavljenog radnog dana* i *Pauza ne smije zauzeti cijeli radni dan*.

Kalendar poznaje neradne dane samo kao iznimku. Kalendar iz datoteke programa MS Project ili Primavera može imati i radne iznimke, dodatni radni dan. Prozor ih ne prikazuje niti uređuje.

## Prozor Kalendar resursa

- **Kalendar resursa** — obrazac iznad, u prozoru samo s *Primijeni* i *Odustani*. Esc i križić djeluju kao *Odustani*. Klik pokraj prozora ne čini ništa, a Enter ovdje također ne čini ništa. U njemu uređujete jedan kalendar: postojeći ili novi, sa zadanim nazivom *Kalendar resursa*, koji se nakon *Primijeni* povezuje s resursom (*Odustani* ne ostavlja ništa iza sebe). Ako ga otvorite u prikazu *Biblioteka* okna resursa, uređuje kalendar u biblioteci. U prikazu *Projekt* uređuje projektni kalendar, čak i ako je došao iz biblioteke. Učinak: kalendar resursa određuje kada je resurs dostupan u histogramu, u preopterećenju resursa i u uravnoteživanju. Ne mijenja datume zadatka. *Primijeni* ne izračunava ponovno. Ako je kalendar također na zadacima ili je projektni kalendar, raspored se mijenja: tada je označen kao zastario i *Izračunaj* ga ponovno izračunava. Pogledajte [Postavljanje kalendara resursa](docs://howto-resourcekalender-instellen).
