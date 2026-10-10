# Rješavanje preopterećenja resursa

Cilj: vidjeti gdje resurs na nekom danu ima previše posla i riješiti to, obično uravnoteživanjem zadataka.

## Kada vam ovo treba

Na papiru vaš raspored funkcionira, ali bricklayer je na dva zida koji se izvode istim danima. Aplikacija to naziva **preopterećenje resursa**. Resurs je preopterećen na radni dan ako ga raspored tog dana traži više nego što iznosi njegov kapacitet (*Maksimalan postotak jedinica*), ili ako prema svom kalendaru tog dana ne radi.

Najprije pogledajte preopterećenje. Zatim odaberite rješenje. **Uravnoteživanje** je rješenje koje za vas izračunava aplikacija: zadatke pomiče tako da počinju kasnije, kako bi resurs mogao sve obaviti. Kako to aplikacija računa, pročitajte u članku [Uravnoteživanje resursa](docs://uitleg-nivelleren).

## Koraci

### 1. Pronađite preopterećenje

1. Pogledajte na vrpci *Resursi › Preopterećenje*. Piše *Nema* ili, crvenom bojom, broj preopterećenih resursa, na primjer *1 resurs*. Nakon izračuna traka stanja također piše *⚠ Preopterećenja resursa: 1*.
2. Kliknite tu poruku u traci stanja. Desno se otvara ploča *Upozorenja* s retkom za svaki resurs, na primjer *Bricklayer* s porukom *Dani s preopterećenjem resursa: 5 (29-06-2027 – 05-07-2027)*.
3. Kliknite taj redak. Aplikacija uključuje histogram, odabire resurs i označuje sve zadatke na kojima je taj resurs.
4. Pogledajte histogram ispod prikaza Gantt. Crveni stupići su dani s preopterećenjem. Ako pomaknete miš iznad dana, vidite koji zadaci doprinose, na primjer *2 zadatka doprinose na 2027-06-30*, a ispod toga njihova imena.

Histogram možete uključiti i sami pomoću vrpce *Resursi › Histogram › Histogram*. Odaberite resurs na popisu lijevo ili se kroz resurse krećite pomoću gumba *Prethodno* i *Dalje*. Crvena točka na popisu znači da je taj resurs preopterećen. Redak *Svi resursi* zbraja resurse, bez materijala.

Ako je odabran zadatak, histogram prikazuje samo opterećenje tog zadatka i samo resurse na njemu. Pritisnite Esc da uklonite odabir i ponovno vidite cijeli projekt.

### 2. Odaberite rješenje

- **Više kapaciteta.** Ako zaista dolazi drugi bricklayer, postavite *Maksimalan postotak jedinica* na 2 (vidi [Upravljanje resursima](docs://howto-resources-beheren)). Preopterećenje tada nestaje.
- **Manje jedinica po danu.** Smanjite *Jed./dan* ili za dodjelu odaberite drugu krivulju (vidi [Dodjela resursa s krivuljom](docs://howto-resource-toewijzen)).
- **Zadatke postavite jedan za drugim.** Dodajte ovisnost između dva zadatka, tako da drugi počinje tek kad se prvi završi (vidi [Dodavanje ovisnosti](docs://howto-relaties-leggen)).
- **Uravnoteživanje.** Aplikacija pomiče zadatak tako da počinje kasnije.

### 3. Uravnoteživanje

1. Provjerite je li raspored izračunat naredbom **Izračunaj** (F5), na primjer putem vrpce *Početna › Raspored › Izračunaj*.
2. Odaberite *Resursi › Uravnoteživanje › Razriješi…*. Otvara se prozor *Uravnoteživanje resursa*.
3. Odlučite smije li se datum završetka projekta pomaknuti. Ako kućicu *Uravnoteživanje samo unutar vremenske rezerve (smoothing) — datum završetka projekta ostaje nepromijenjen* ostavite isključenu, datum završetka se može pomaknuti. Ako je uključite, aplikacija pomiče samo zadatke unutar njihove vremenske rezerve.
4. Ispod odjeljka *Resursi* nalaze se resursi koji će biti uključeni u uravnoteživanje. Zadano su označeni svi resursi, osim materijala. Odznačite resurs koji želite ostaviti netaknut.
5. Kliknite *Izračunaj*. Dok se izračunava, piše *Izračunavanje…*, a možete zaustaviti pomoću gumba *Zaustavi*. Raspored se još ne mijenja: ovo je prijedlog.
6. Pročitajte prijedlog. Na vrhu je datum završetka, na primjer *Datum završetka projekta: nepromijenjen (30-08-2027)* ili *Datum završetka projekta: 25-08-2027 → 30-08-2027*. Ispod toga je tablica s po zadatku: *Stari početak*, *Novi početak* i *Pomaknuti dani*, na primjer za *Build outer cavity leaf*, 29-06-2027, 06-07-2027 i *5 d*.
7. Odaberite *Primijeni*. Aplikacija upisuje odgode u zadatke i odmah ponovno izračunava raspored. Pritiskanje tipke F5 nije potrebno. *Odustani* zatvara prozor bez promjene.
8. Provjerite *Resursi › Preopterećenje*. Sada piše *Nema*.

Ako promijenite opciju u prozoru nakon što ste kliknuli *Izračunaj*, prijedlog nestaje. Tada ponovno kliknite *Izračunaj*. Ako se raspored promijeni dok aplikacija računa, piše *Raspored je promijenjen tijekom izračuna. Ponovno kliknite Izračunaj.*

### Odlučivanje koji zadatak ostaje na mjestu

Aplikacija raspoređuje zadatke jedan po jedan. Zadaci koji su prvi na redu ostaju gdje jesu. Zadaci s najvišim prioritetom idu prvi. Uz jednak prioritet prvi ide zadatak s najmanjom vremenskom rezervom.

Ako želite sami odlučiti koji zadatak ostaje, dajte mu viši prioritet. Desnom tipkom miša kliknite traku zadatka u prikazu Gantt i odaberite *Prioritet*, zatim *Nizak* (100), *Normalan* (500) ili *Visok* (900). *Normalan* je zadano. Broj od 0 do 1000 možete upisati i sami u stupac *Prioritet ujednačavanja* na popisu zadataka: kliknite **+** s desne strane zaglavlja tablice zadataka (*Dodaj stupac*) i odaberite taj stupac u grupi *Raspored*. Viši broj znači da zadatak vjerojatnije ostaje na mjestu. Aplikacija ne prihvaća broj iznad 1000. Zadatak s prioritetom 1000 se zbog kapaciteta nikad ne pomiče.

### Poništavanje i ponavljanje

- *Poništi* (Ctrl+Z) poništava *Primijeni* u jednom koraku.
- *Resursi › Uravnoteživanje › Ukloni uravnoteživanje* uklanja sve uravnoteživanje sa zadataka. Gumb je siv dok nema uravnoteživanja. Preopterećenje koje tako ponovno dobijete jednostavno je opet tu.
- Ako ste raspored u međuvremenu promijenili, jednostavno ponovno odaberite *Razriješi…*. Aplikacija tada kreće ispočetka: stare odgode se ne uzimaju u obzir.

## Zamke i što tada radi aplikacija

**Još nije izračunato.** Ako raspored nije izračunat, prozor piše *Prvo izračunajte raspored (F5) prije uravnoteživanja.* i *Izračunaj* nije dostupan.

**Preostali sukobi.** Nije svako preopterećenje moguće riješiti pomicanjem. Zadaci koji ostanu navedeni su u odjeljku *Preostali sukobi*, s brojem dana i razlogom:

- *Nedovoljno slobodnog kapaciteta unutar vremenske rezerve za rješavanje ovog sukoba.* Ovo vidite uz *smoothing*: unutar vremenske rezerve zadatka nema slobodnog trenutka. Odznačite kućicu i datum završetka se može pomaknuti.
- *Resurs ne radi na sve dane koje zadatak treba — pomicanje to ne rješava.* Resurs u svom kalendaru ima neradne dane usred zadatka. Promijenite kalendar ili zadatak.
- *Resurs Bricklayer: vrhunac dnevnih jedinica dodjele je 2, kapacitet je 1 — ne može se riješiti pomicanjem.* Zbog svoje krivulje zadatak sam traži na jedan dan više nego što resurs može dati. Odaberite drugu krivulju ili smanjite jedinice.

**Prozor piše** *Nijedan zadatak ne treba pomaknuti — raspored je već bez sukoba.* Ako se ta linija pojavi zajedno s popisom *Preostali sukobi* u prijedlogu, vjerujte popisu. Linija samo kaže da nema što pomaknuti. Ako se linija pojavi bez popisa, dok *Resursi › Preopterećenje* još prijavljuje resurs, onda su svi zadaci koji se sukobljavaju zadržani na prioritetu 1000 ili su već počeli. Ne pomiču se i prozor ih ne prijavljuje kao sukob. Zato nakon primjene uvijek pogledajte *Preopterećenje*.

**Zadaci koji se ne pomiču.** Zadatak koji je već počeo ili je završen nikad se ne pomiče. Njegovo opterećenje se ipak računa. Kontrolne točke i faze se također ne pomiču.

**Materijal se ne uključuje u uravnoteživanje.** Ako materijalni resurs na neki dan traži više od svog polja *Maksimalan postotak jedinica*, računa se kao preopterećen u dijelu *Preopterećenje*, ali nije u prozoru za uravnoteživanje.

**Uravnoteživanje se ne prilagođava.** Odgode ostaju onakve kakve su izračunate. Ako kasnije promijenite trajanje zadatka, zadatak s uravnoteživanjem ostaje gdje je, čak i ako to mjesto više nije potrebno. Tada ponovno pokrenite uravnoteživanje.

**Preopterećenje zbog kalendara.** Ako resurs prema svom kalendaru tog dana ne radi, ploča *Upozorenja* kaže, na primjer, *Dani s preopterećenjem resursa: 5 (29-06-2027 – 05-07-2027). Od toga su neradni dani prema kalendaru resursa: 1*. Ako zadatak uvijek traje preko takvog dana, što je drugi razlog gore, uravnoteživanje to ne rješava.

## Vidi također

- [Uravnoteživanje resursa](docs://uitleg-nivelleren): što uravnoteživanje pomiče, unutar vremenske rezerve i izvan nje, te što ne radi.
- [Upravljanje resursima](docs://howto-resources-beheren): prilagođavanje kapaciteta i kalendara resursa.
- [Dodavanje ovisnosti](docs://howto-relaties-leggen): postavljanje zadataka jedan za drugim.
- [Obavijesti i upozorenja](docs://ref-meldingen): upozorenje o preopterećenju na ploči Upozorenja.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): plasterers su preopterećeni na 5 dana. Uz uključenu kućicu *Uravnoteživanje samo unutar vremenske rezerve (smoothing) — datum završetka projekta ostaje nepromijenjen*, završetak ostaje na 17. kolovoza 2027 i ostaje jedan preostali sukob. Uz isključenu kućicu (zadano) sve je riješeno i završetak se pomiče na 24. kolovoza 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): tower crane je preopterećen 65 dana, a plasterers 15 dana. Uravnoteživanje uz isključenu kućicu *Uravnoteživanje samo unutar vremenske rezerve (smoothing) — datum završetka projekta ostaje nepromijenjen* pomiče završetak s 9. svibnja na 12. listopada 2028.
