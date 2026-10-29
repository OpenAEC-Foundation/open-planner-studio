# Postavljanje radnog vremena

Cilj: za svaki dan u tjednu odrediti u koje sate kalendar radi, da zadaci u satima teku u ispravno vrijeme.

## Kada je ovo potrebno

Petak popodne je slobodan. Ekipa radi od 06:00 do 22:00 u dvije smjene. Postoji noćna ekipa. Pauza je kraća od jednog sata. Sve dok planirate samo u danima, dovoljni su *Početak (sat)*, *Završetak (sat)* i pauza ([Stvaranje i dodjela kalendara](docs://howto-kalender-maken-en-toewijzen)). Ako planirate zadatke u satima, aplikacija broji radne minute unutar **blokova radnog vremena** kalendara. U aplikaciji se ti blokovi zovu *blok*: blok je neprekidan dio radnog vremena jednog dana u tjednu, a prazan prostor između dva bloka je pauza. Što to znači za vaš raspored, objašnjeno je u [Dani i sati](docs://uitleg-dagen-en-uren).

Za to vam treba *Uključi planiranje u satima* ([Uključivanje planiranja u satima](docs://howto-urenplanning-aanzetten)). Ako kalendar već ima blokove, na primjer iz datoteke MS Project, blok *Radno vrijeme* uvijek je tu, a blokove mijenjate i kad je planiranje u satima isključeno.

## Koraci

### Odabir predloška smjene

1. Odaberite *Raspored › Kalendar › Kalendar* i na lijevoj strani odaberite kalendar.
2. U bloku *Radno vrijeme* kliknite predložak. On zamjenjuje radne dane i radno vrijeme kalendara.
3. Kliknite *Primijeni*.

Svaki predložak radi sljedeće:

- *Dnevna smjena*: od ponedjeljka do petka od 08:00 do 16:00 bez pauze. Time se kalendar vraća u običan kalendar, bez blokova radnog vremena.
- *2 smjene*: od ponedjeljka do petka od 06:00 do 14:00 i od 14:00 do 22:00, ukupno 16 sati.
- *3 smjene*: od ponedjeljka do petka tri smjene: od 06:00 do 14:00, od 14:00 do 22:00 i od 22:00 do 06:00 sljedećeg dana, ukupno 24 sata.
- *Noćna smjena*: od ponedjeljka do petka od 22:00 do 06:00 sljedećeg dana, 8 sati.
- *24/7*: svih sedam dana od 00:00 do 24:00.

### Postavljanje radnog vremena po danu u tjednu

1. U bloku *Radno vrijeme* kliknite *Postavi po danu u tjednu…*. Ispod gumba pojavljuje se red za svaki dan u tjednu s radnim vremenom tog dana, a kalendar sada ima blokove radnog vremena po danu. Ako ih kalendar već ima, ovaj pregled je odmah otvoren; gumb se tada zove *Sakrij radno vrijeme* i sklapa ga.
2. Prilagodite vrijeme početka i završetka svakog bloka u dva polja za vrijeme. Upišite vrijeme i pritisnite Enter ili upotrijebite strelice (15 minuta po koraku). Polja slijede *Oblik vremena* u postavkama; *13:00* i *1:00 PM* oboje rade.
3. Ako želite uključiti pauzu, kliknite **+** (*Dodaj blok*) za taj dan i prilagodite vremena blokova tako da između njih bude prazan prostor. Novi blok počinje u 08:00 i završava u 16:00.
4. Blok koji traje preko ponoći označite kvačicom *sljedeći dan*. Blok se računa za dan na koji počinje.
5. Kliknite ikonu kante za smeće iza bloka da biste ga uklonili. Dan bez blokova prikazuje se kao *Neradno*.
6. Za dan od ponedjeljka do petka kliknite simbol kopiranja (*Kopiraj na sve radne dane*) da blokove tog dana stavite na sve dane od ponedjeljka do petka.
7. Iznad bloka *Radno vrijeme* nalazi se *Standardni radni dan*: radno vrijeme po danu koje aplikacija izvodi iz blokova i s kojim računa. Broj se odmah mijenja kad promijenite blokove. Ako kalendar ima vlastite sate po danu (na primjer iz Primavera P6), ta vlastita vrijednost ostaje i ide zajedno s izvozom, dok je predložak ne zamijeni. Ako se ta vlastita vrijednost razlikuje od vrijednosti *Standardni radni dan*, ispod broja se odmah pojavljuje narančasti blok, na primjer: *Datoteka ima vlastiti radni dan od 8h. On se zadržava pri izvozu u MS Project i P6. Tamo dan traje 8h, ovdje 10h.* Blok nestaje čim blokovi daju isti zbroj sati po danu ili kad predložak zamijeni vlastitu vrijednost. Blok ne mijenja izračun. Kliknite *Primijeni*.

**Primjer: slobodan petak popodne.** Kliknite *Postavi po danu u tjednu…*. Uklonite drugi blok (od 13:00 do 16:00) za *Pet*. Petak sada ima 5 sati, ostali dani 8. *Standardni radni dan* ostaje 8 sati.

### Spremanje vlastitog predloška

1. Kliknite *Spremi kao predložak…* i u polje *Naziv vašeg vlastitog predloška* upišite naziv.
2. Kliknite *Spremi*. Predložak sada stoji među ostalim predlošcima i možete ga upotrijebiti u bilo kojem projektu. Križićem pored njega uklonite ga ponovno.

Vlastiti predložak sprema se na ovom uređaju, a ne u datoteci projekta.

## Zamke i što aplikacija tada radi

**Predložak zamjenjuje sve.** Ako odaberete predložak, radni dani i radno vrijeme koje ste ranije postavili nestaju. Praznici ostaju.

**Gumbi za dane mijenjaju blokove.** Ako isključite dan u dijelu *Radni dani*, blokovi tog dana nestanu. Ponovno ga uključite i dobit će blokove koje je imao kad ste otvorili prozor (ili nakon zadnjeg predloška), ili inače blokove prvog radnog dana. *Pon–pet* to radi za ponedjeljak do petak i uklanja blokove subote i nedjelje. *Kontinuirano (24/7)* zamjenjuje sve blokove: svaki dan dobiva 00:00 do 24:00.

**Prilagođavanje radnog vremena kad je planiranje u satima isključeno.** Kalendar s blokovima radnog vremena zadržava blok *Radno vrijeme*, i kad isključite planiranje u satima. Blokove tamo jednostavno mijenjate. Ako odaberete *Dnevna smjena*, kalendar opet postaje običan kalendar s poljima *Početak (sat)*, *Završetak (sat)* i pauzom. Blokove je tada moguće vratiti samo kad je planiranje u satima uključeno.

**Nema upotrebljivog radnog vremena.** Kalendar bez blokova ili bez radnih dana ne može obračunati zadatak u satima. Aplikacija tada prikazuje poruku *Ovaj kalendar nema ispravna radna vremena. Provjerite radne dane i radno vrijeme.*

## Pogledajte i

- [Dani i sati](docs://uitleg-dagen-en-uren): kako aplikacija broji radne sate i izvodi standardni radni dan.
- [Uključivanje planiranja u satima](docs://howto-urenplanning-aanzetten): planiranje zadatka u satima.
- [Kalendari i radni dani](docs://uitleg-kalenders): koji se kalendar primjenjuje na koji zadatak.
- [Prozori kalendara](docs://ref-kalenders): sva polja prozora kalendara.
