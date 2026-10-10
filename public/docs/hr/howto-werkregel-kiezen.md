# Odabir pravila rada

Cilj: za svaki zadatak odredite što aplikacija prilagođava kad promijenite trajanje, jedinice dodjele ili rad. Mogućnosti su: trajanje, jedinice dodjele ili sam rad.

## Kada vam ovo treba

Na zadatak ste stavili resurse i želite da aplikacija računa onako kako vi mislite. Primjer: dizalica je unajmljena za jedan dan i taj je dan fiksan. Drugi primjer: znate da u tome ima 160 sati zidanja i želite vidjeti koliko traje s tri osobe umjesto dvije. Ove dvije situacije traže različita pravila rada.

Pravilo odlučuje koja se od triju veličina (trajanje, jedinice dodjele i rad) mijenja kad promijenite drugu. Pozadina i primjeri nalaze se u [Pravila rada: trajanje, jedinice dodjele i rad](docs://uitleg-werkregels).

## Koraci

### Prikazivanje pravila rada

Pravilo rada se prema zadanim postavkama ne prikazuje. Jednom ga uključite:

1. Odaberite *Postavke › Projekt › Postavke*, karticu *Raspored*.
2. Ispod naslova *Izračunavanje* označite *Prikaži pravila rada i rad*.
3. Zatvorite prozor gumbom *Zatvori*.

Ovo je postavka aplikacije, a ne postavka datoteke projekta. Ako datoteka već sadrži pravila rada ili spremljeni rad, na primjer datoteku iz programa MS Project ili Primavera P6, aplikacija pravilo rada za tu datoteku prikazuje i bez ove postavke. Isto vrijedi čim sami u datoteci odaberete pravilo rada: prikaz tada ostaje uključen za tu datoteku, čak i ako postavku ponovno isključite. Ostaje uključen dok je datoteka otvorena, a nakon ponovnog otvaranja dok datoteka sadrži pravilo rada ili spremljeni rad.

### Odabir pravila

1. Odaberite zadatak. Panel *Svojstva* nalazi se desno. Ako ga ne vidite, uključite ga putem *Prikaz › Paneli › Svojstva*.
2. Kod polja *Pravilo rada* odaberite jednu od pet mogućnosti: *Standard projekta (Fiksno trajanje i fiksne jedinice)*, *Fiksno trajanje i fiksne jedinice*, *Fiksno trajanje i fiksni rad*, *Fiksni rad* ili *Fiksne jedinice*. Uz opciju *Standard projekta* zadatak slijedi zadano pravilo projekta.
3. Ispod padajućeg izbornika aplikacija prikazuje što pravilo štiti, na primjer *Zaštićeno: rad (trajanje slijedi jedinice)*.

*Standard projekta* je prva mogućnost i to je ono što zadatak ima kao zadano. Pravilo u zagradama jest pravilo koje projekt trenutno ima kao zadano. Aplikacija nema gumb za promjenu tog standarda projekta: standard dolazi iz uvoza (na primjer iz programa MS Project ili Primavera P6) ili iz MCP veze. Ako za jedan zadatak želite drugo pravilo, odaberite ga ovdje.

Pravilo možete odabrati i u tablici zadataka. Kliknite **+** desno od zaglavlja tablice zadataka (*Dodaj stupac*) i pod naslovom *Raspored* odaberite stupac *Pravilo rada*.

Zadatak bez dodjele nema što povezati, pa pravilo na njemu ne radi ništa. Najprije dodijelite resurs (pogledajte [Dodjela resursa s krivuljom](docs://howto-resource-toewijzen)).

### Prikaz i promjena rada

Za zadatak s dodjelama pojavljuje se stupac *Rad (preostalo)* u odjeljku *Dodjele* na panelu *Svojstva*, pored stupca *Jed./dan*. To je preostali posao tog resursa u satima. Mali katanac iznad stupca pokazuje što pravilo drži: *Jed./dan* uz *Fiksno trajanje i fiksne jedinice* i uz *Fiksne jedinice*, a *Rad (preostalo)* uz *Fiksno trajanje i fiksni rad* i uz *Fiksni rad*.

Ako rad želite promijeniti sami, upišite sate u polje i pritisnite Enter. Aplikacija ne prihvaća vrijednost 0 ili manju: polje se vraća na prethodnu vrijednost.

### Što se događa

Kad odaberete pravilo, još se ne mijenja nijedan broj. Pod pravilom koje štiti rad aplikacija samo zadržava trenutni rad, pa *Rad (preostalo)* ima spremljenu vrijednost. Tek kod sljedeće promjene pravilo odlučuje što se mijenja. Na primjer, promijenite *Jed./dan* i pogledajte što se događa s trajanjem i radom.

Ako se time promijeni trajanje zadatka, traka stanja prikazuje *Zastarjelo — ponovno izračunajte (F5)*. Pritisnite **Izračunaj** (F5), na primjer putem *Početna › Raspored › Izračunaj*, da vidite nove datume. Ako je *Automatsko izračunavanje* uključeno (na istoj kartici *Raspored*, pod naslovom *Izračunavanje*), aplikacija to radi sama.

## Koje pravilo odgovara

- **Fiksno trajanje i fiksne jedinice** odgovara kad je trajanje dogovoreno, a jedinice dodjele unosite vi. Rad slijedi iz trajanja i jedinica dodjele. Ovo je zadano pravilo. Dizalica unajmljena za jedan dan spada ovdje: dan je fiksan, a vi odlučujete koliko je dizalica na njemu.
- **Fiksno trajanje i fiksni rad** odgovara kad zadatak mora biti gotov u fiksnom roku i znate koliko rada u njemu ima. Ako se trajanje promijeni, aplikacija prilagođava jedinice dodjele.
- **Fiksni rad** odgovara kad znate koliko sati rada u njemu ima i želite vidjeti kako se trajanje mijenja s brojem ljudi. Ovdje spada 160 sati zidanja s tri osobe umjesto dvije. Žbukanje u vježbenom projektu dobiva ovo pravilo.
- **Fiksne jedinice** odgovaraju kad su jedinice fiksne, na primjer jedna dizalica, a rad određuje trajanje.

## Zamke i što aplikacija tada radi

**Polje *Pravilo rada* nedostaje.** Tada je postavka *Prikaži pravila rada i rad* isključena, a datoteka još nema pravila rada, ili ste odabrali kontrolnu točku, fazu, hamak ili zadatak s vrstom trajanja *Proteklo vrijeme*. Tamo nema pravila rada. Odaberite običan zadatak.

**Trajanje se mijenja iako ga niste promijenili.** Kod pravila *Fiksni rad* i *Fiksne jedinice* trajanje slijedi iz jedinica dodjele i rada. Ako promijenite jednu od tih veličina ili broj resursa, aplikacija prilagođava trajanje i zaokružuje ga na cijele radne dane. Za zadatak u satima aplikacija zaokružuje na cijele minute.

**Rad se ne podudara točno s jedinicama × trajanjem.** Zaokruživanje to može uzrokovati. Pored stupca *Rad (preostalo)* tada se pojavljuje znak upozorenja, *Odstupa od jedinica dodjele × trajanja*. Histogram slijedi spremljeni rad.

**Materijal se ne broji.** Za resurs vrste materijal *Rad (preostalo)* prikazuje crticu. Materijal nikad ne određuje trajanje.

**Zadatak s napretkom.** Pravilo radi na preostalom dijelu. Zato *Rad (preostalo)* prikazuje samo ono što još treba obaviti.

**Poništavanje.** Odabir pravila i svaka promjena koju pravilo izračuna jedan su korak za *Poništi* (Ctrl+Z). Pravilo tada opet nestaje, ali polje *Pravilo rada* ostaje vidljivo.

## Pogledajte također

- [Pravila rada: trajanje, jedinice dodjele i rad](docs://uitleg-werkregels): kako aplikacija povezuje trajanje, jedinice dodjele i rad, s primjerima.
- [Dodjela resursa s krivuljom](docs://howto-resource-toewijzen): stavljanje resursa na zadatak.
