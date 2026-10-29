# Odabir vrste zadatka

Cilj: za svaki zadatak odredite što aplikacija prilagođava kad promijenite trajanje, jedinice dodjele ili rad. Mogućnosti su: trajanje, jedinice dodjele ili sam rad.

## Kada vam ovo treba

Na zadatak ste stavili resurse i želite da aplikacija računa onako kako vi mislite. Primjer: dizalica je unajmljena za jedan dan i taj je dan fiksan. Drugi primjer: znate da u tome ima 160 sati zidanja i želite vidjeti koliko traje s tri osobe umjesto dvije. Te dvije situacije traže različitu vrstu zadatka.

Vrsta zadatka odlučuje koja se od triju veličina, trajanje, jedinice dodjele ili rad, mijenja kad promijenite jednu od ostalih. Pozadina i primjeri nalaze se u [Vrste zadataka: trajanje, jedinice dodjele i rad](docs://uitleg-werkregels).

## Koraci

### Prikazivanje vrste zadatka

Vrsta zadatka se prema zadanim postavkama ne prikazuje. Uključite prikaz jednom:

1. Odaberite *Postavke › Projekt › Postavke aplikacije*, karticu *Raspored*.
2. Ispod naslova *Izračunavanje* označite *Koristi vrste zadataka*.
3. Zatvorite prozor gumbom *Zatvori*.

Ovo je postavka aplikacije, a ne postavka datoteke projekta. Ako datoteka već sadrži vrste zadataka ili spremljeni rad, na primjer datoteku iz programa MS Project ili Primavera P6, aplikacija vrstu zadatka za tu datoteku prikazuje i bez ove postavke. Isto vrijedi čim sami u datoteci odaberete vrstu zadatka: prikaz tada ostaje uključen za tu datoteku, čak i ako postavku ponovno isključite. Ostaje uključen dok je datoteka otvorena, a nakon ponovnog otvaranja dok datoteka sadrži vrstu zadatka ili spremljeni rad.

### Odabir vrste zadatka za zadatak

1. Odaberite zadatak. Panel *Svojstva* nalazi se desno. Ako ga ne vidite, uključite ga putem *Prikaz › Paneli › Svojstva*.
2. Kod polja *Vrsta zadatka* odaberite jednu od pet mogućnosti: *Standard projekta (Fiksno trajanje i fiksne jedinice)*, *Fiksno trajanje i fiksne jedinice*, *Fiksno trajanje i fiksni rad*, *Fiksni rad* ili *Fiksne jedinice*. Uz *Standard projekta* zadatak slijedi zadanu vrstu zadatka za projekt.
3. Želite znati što radi pojedina mogućnost? U otvorenom padajućem izborniku svaka mogućnost ima ikonu i. Pokažite na nju, kliknite je ili je dodirnite da vidite objašnjenje. Klik na ikonu i još ne odabire tu vrstu zadatka.
4. Pored zatvorenog polja nalazi se također ikona i. Ona objašnjava vrstu zadatka koja se trenutno primjenjuje, na primjer *Trajanje proizlazi iz rada i jedinica dodjele.* Uz *Standard projekta* to je vrsta zadatka u zagradama.

*Standard projekta* je prva mogućnost i to je ono što zadatak ima kao zadano. Vrsta zadatka u zagradama je ona koju projekt trenutno ima kao zadanu. Aplikacija nema gumb za promjenu te zadane vrste. Zadana vrsta dolazi iz uvoza (na primjer iz programa MS Project ili Primavera P6) ili iz MCP veze. Ako za jedan zadatak želite drugu vrstu zadatka, odaberite je ovdje.

Vrstu zadatka možete odabrati i u tablici zadataka. Kliknite **+** desno od zaglavlja tablice zadataka (*Dodaj stupac*) i pod naslovom *Raspored* odaberite stupac *Vrsta zadatka*.

Zadatak bez dodjele nema što povezati, pa vrsta zadatka na njemu ne radi ništa. Najprije dodijelite resurs (pogledajte [Dodjela resursa s krivuljom](docs://howto-resource-toewijzen)).

### Pregled i promjena rada

Za zadatak s dodjelama pojavljuje se stupac *Rad (h)* u odjeljku *Dodjele* na panelu *Svojstva*, pored stupca *Jedinice dodjele*. To je preostali posao tog resursa u satima. Mali katanac iznad stupca pokazuje što vrsta zadatka drži: *Jedinice dodjele* uz *Fiksno trajanje i fiksne jedinice* i uz *Fiksne jedinice*, *Rad (h)* uz *Fiksno trajanje i fiksni rad* i uz *Fiksni rad*.

Ako rad želite promijeniti sami, upišite sate u polje i pritisnite Enter. Aplikacija ne prihvaća vrijednost 0 ili manju: polje se vraća na prethodnu vrijednost.

### Što se događa

Kad odaberete vrstu zadatka, još se ne mijenja nijedan broj. Kod vrste zadatka koja štiti rad aplikacija samo zadržava trenutni rad, pa *Rad (h)* ima spremljenu vrijednost. Tek kod sljedeće promjene vrsta zadatka odlučuje što se mijenja. Na primjer, promijenite *Jedinice dodjele* i pogledajte što se događa s trajanjem i radom.

Ako se time promijeni trajanje zadatka, traka stanja prikazuje *Zastarjelo — ponovno izračunajte (F5)*. Pritisnite **Izračunaj** (F5), na primjer putem *Početna › Raspored › Izračunaj*, da vidite nove datume. Ako je *Automatsko izračunavanje* uključeno (na istoj kartici *Raspored*, pod naslovom *Izračunavanje*), aplikacija to radi sama.

## Koja vrsta zadatka odgovara

- **Fiksno trajanje i fiksne jedinice** odgovara kad je trajanje dogovoreno, a jedinice dodjele unosite vi. Rad slijedi iz tih dvaju podataka. Ovo je zadana vrsta zadatka. Dizalica unajmljena za jedan dan spada ovdje: dan je fiksan, a vi odlučujete koliko je dizalica na njemu.
- **Fiksno trajanje i fiksni rad** odgovara kad zadatak mora biti gotov u fiksnom roku i znate koliko je rada u njemu. Ako se trajanje promijeni, aplikacija prilagođava jedinice dodjele.
- **Fiksni rad** odgovara kad znate koliko sati rada u njemu ima i želite vidjeti kako se trajanje mijenja s brojem ljudi. Ovdje spadaju 160 sati zidanja s tri osobe umjesto dvije. Žbukanje u vježbenom projektu dobiva ovu vrstu zadatka.
- **Fiksne jedinice** odgovaraju kad su jedinice dodjele fiksne, na primjer jedna dizalica, a rad određuje trajanje.

## Zamke i što aplikacija tada radi

**Polje *Vrsta zadatka* nedostaje.** Tada je postavka *Koristi vrste zadataka* isključena i datoteka još ne sadrži vrste zadataka, ili ste odabrali kontrolnu točku, fazu, hamak ili zadatak s vrstom trajanja *Proteklo vrijeme*. Na njima nema vrste zadatka. Odaberite običan zadatak.

**Trajanje se mijenja iako ga niste promijenili.** Za vrste zadatka *Fiksni rad* i *Fiksne jedinice* trajanje slijedi iz jedinica dodjele i rada. Ako promijenite jednu od tih veličina ili broj resursa, aplikacija prilagođava trajanje i zaokružuje ga na cijele radne dane. Za zadatak u satima aplikacija zaokružuje na cijele minute.

**Rad se ne podudara točno s jedinicama dodjele × trajanjem.** Zaokruživanje to može uzrokovati. U polju *Rad (h)* tada se pojavljuje znak upozorenja *Odstupa od jedinica dodjele × trajanja*. Histogram slijedi spremljeni rad.

**Materijal se ne broji.** Za materijalni resurs *Rad (h)* prikazuje crticu. Materijal nikad ne određuje trajanje.

**Zadatak s napretkom.** Vrsta zadatka radi na preostalom dijelu. Zato *Rad (h)* prikazuje samo ono što još treba obaviti.

**Poništavanje.** Odabir vrste zadatka i svaka promjena koju vrsta zadatka izračuna jedan je korak, koji se poništava naredbom *Poništi* (Ctrl+Z). Odabrana vrsta zadatka tada opet nestaje, ali polje *Vrsta zadatka* ostaje vidljivo.

## Pogledajte također

- [Vrste zadataka: trajanje, jedinice dodjele i rad](docs://uitleg-werkregels): kako aplikacija povezuje trajanje, jedinice dodjele i rad, s primjerima.
- [Dodjela resursa s krivuljom](docs://howto-resource-toewijzen): stavljanje resursa na zadatak.
