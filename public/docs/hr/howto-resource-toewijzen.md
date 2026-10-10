# Dodjela resursa s krivuljom

Cilj: dodijeliti resurs zadatku, s jedinicama dodjele po danu i krivuljom koja određuje kako se te jedinice raspoređuju po danima zadatka.

## Kada ovo trebate

Čim želite vidjeti tko radi gdje i kada: zidar na vanjskom sloju šupljeg zida, toranj-dizalica na šupljim međukatnim pločama. Bez dodjele nema opterećenja, pa nema ni histograma ni preopterećenja resursa.

Dva pojma. **Jedinice dodjele** (u aplikaciji *Jed./dan*) su koliko resursa radi na zadatku po radnom danu: 1 je jedan zidar, 2 su dva zidara, 0,5 je pola radnog dana. **Krivulja** određuje kako se ukupno, jedinice dodjele puta trajanje, raspoređuje po radnim danima zadatka. Rad je rijetko ravnomjeran: na zidu je početak miran, sredina intenzivna, a kraj opet miran.

Vanjski sloj šupljeg zida traje 6 radnih dana. S jednim zidarom i krivuljom *Ujednačeno* to je 1 jedinica na svakom od 6 dana, 6 zajedno. S krivuljom *Zvonasto* ostaje 6 jedinica zajedno, ali raspodjela postaje 0, 1, 2, 2, 1 i 0.

## Koraci

Resurs možete dodijeliti na dva načina. Resurs već mora postojati (pogledajte [Upravljanje resursima](docs://howto-resources-beheren)).

### Putem vrpce

1. Odaberite jedan zadatak u tablici zadataka. Mora biti običan zadatak, ne kontrolna točka i ne faza.
2. Odaberite *Resursi › Dodjela › Dodijeli ▾*.
3. U prozoru unesite *Jed./dan* (zadano 1) i odaberite *Krivulja* (zadano *Ujednačeno*). Te vrijednosti vrijede za resurs koji sada odaberete.
4. Kliknite resurs. Prozor se zatvara, a dodjela postoji.

Za drugi resurs ponovno otvorite prozor. Resursi koji su već na zadatku nisu u popisu.

### Putem okna svojstava

1. Odaberite zadatak. Okno *Svojstva* je desno; ako ga ne vidite, uključite ga s *Prikaz › Paneli › Svojstva*.
2. U bloku *Dodjele*, odmah na dnu, odaberite resurs kod *Dodijeli resurs*. Dodjela počinje s jedinicama dodjele 1 i krivuljom *Ujednačeno*.
3. Za svaku dodjelu promijenite *Jed./dan* i u polju *Krivulja* odaberite drugu krivulju.

Tako mijenjate i postojeću dodjelu. Ikonom kante (*Ukloni*) pored imena uklanjate dodjelu sa zadatka. Sam resurs ostaje. S *Premjesti na…* premještate dodjelu na drugi zadatak.

### Krivulje

- *Ujednačeno*: isto svaki dan. To je zadano i odgovara radu koji je jednako težak svaki dan.
- *Opterećeno na početku*: početak je teži od kraja. Odgovara radu koji počinje velikim naporom, kao što je iskolčenje.
- *Opterećeno na završetku*: kraj je teži od početka. Odgovara radu koji je sve intenzivniji prema završetku.
- *Zvonasto*: vrh u sredini, uz tihi početak i kraj. Odgovara zidu koji tiho počinje, u sredini je u punom zamahu i zatim slabi.
- *Rani vrh*: vrh prije sredine. Odgovara radu koji brzo dostigne punu brzinu.
- *Kasni vrh*: vrh nakon sredine. Odgovara radu čiji najintenzivniji dio dolazi tek kasnije.
- *Dvostruki vrh*: dva vrha. Odgovara radu s dva intenzivna trenutka.
- *Kornjača*: tih početak i kraj, uz širok vrh u sredini. Odgovara dugom radu koji se postupno razvija i postupno smiruje.

Krivulja mijenja samo raspodjelu. Trajanje, datumi i ukupno ostaju isti. Nakon toga ne morate ponovno izračunati raspored. Histogram se odmah prilagodi. Odaberite *Resursi › Histogram › Histogram* da ga vidite. Ako odaberete zadatak, histogram prikazuje samo opterećenje tog zadatka.

## Zamke i što aplikacija tada radi

**Krivulja može vrh gurnuti iznad vaših jedinica.** Kad su jedinice cijeli broj, aplikacija zaokružuje vrijednost po danu na cijele jedinice, a ukupno ostaje isto. Zidar s jedinicom 1 na vanjskom sloju šupljeg zida i krivuljom *Zvonasto* dobiva 0, 1, 2, 2, 1, 0. Na dva srednja dana to je 2 jedinice, uz *Maksimalan postotak jedinica* 1. Histogram boji te dane crveno, a resurs ima preopterećenje resursa. Odaberite drugu krivulju ili sami rasporedite sate (pogledajte [Prilagodba raspodjele sati](docs://howto-urenverdeling-aanpassen)). Pri jedinicama kao što je 0,5 aplikacija zaokružuje na stotinke. Kod kratkog zadatka s cijelim jedinicama oblik zato postaje grub: tijekom 10 dana *Kornjača* s jedinicama 1 daje raspodjelu 0, 1, 1, 2, 2, 1, 1, 1, 1, 0, potpuno isto kao *Rani vrh*.

**Nema kontrolne točke ni faze.** Gumb *Dodijeli* je tada onemogućen, a *Svojstva* kažu *Dodjele nisu moguće za kontrolne točke.* ili *Dodjele nisu moguće za zadatak sažetka.*

**Resurs samo jednom po zadatku.** Ako je resurs već na zadatku, više nije u popisu. Ako su svi resursi već na zadatku, aplikacija kaže *Svi su resursi već dodijeljeni.* Ako još nema nijednog resursa, kaže *Najprije stvorite resurse (kartica Resursi).*

**Jedinice dodjele moraju biti veće od 0.** Aplikacija ne prihvaća vrijednost 0 ili manju.

**Materijal.** Za materijalni resurs jedinice dodjele su količina po danu, u mjernoj jedinici resursa, na primjer m³. Materijal se ne računa u trajanje zadatka.

**Pravilo rada može prilagoditi trajanje.** Ako je zadatak vrste *Fiksni rad* ili *Fiksne jedinice*, drugi resurs mijenja trajanje zadatka. Raspored tada nije ažuran; pritisnite **Izračunaj** (F5). Pogledajte [Pravila rada: trajanje, jedinice i rad](docs://uitleg-werkregels).

**Vlastita raspodjela.** Ako dodjela već ima vlastitu raspodjelu sati, krivulja je onemogućena i prikazuje *Obris*. Prvo otpustite tu raspodjelu putem *Raspodijeli sate…*.

**Poništavanje.** Stvaranje, promjenu ili uklanjanje dodjele možete poništiti s *Poništi* (Ctrl+Z).

## Pogledajte i

- [Prilagodba raspodjele sati](docs://howto-urenverdeling-aanpassen): sami postavljate sate po danu.
- [Rješavanje preopterećenja resursa](docs://howto-overbezetting-oplossen): što učiniti kad resurs ima previše posla u jednom danu.
- [Pravila rada: trajanje, jedinice i rad](docs://uitleg-werkregels): što se događa s trajanjem kad promijenite jedinice dodjele.
- [Okno resursa](docs://ref-resourcepaneel): sva polja i gumbi okna resursa.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): svih pet vrsta resursa, svih šest krivulja i toranj-dizalica s korakom kapaciteta od 30. kolovoza 2027.
