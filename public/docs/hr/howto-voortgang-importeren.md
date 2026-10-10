# Uvoz napretka iz lista

Cilj: napredak koji osoblje na gradilištu upisuje u list prenijeti u raspored odjednom, bez ručnog klikanja na svaki zadatak.

## Kada je ovo potrebno

Podizvođač ili voditelj gradilišta nema aplikaciju, ali svaki tjedan javlja svoje stanje: koliko je posto gotovo, kada je počelo i kada je završeno. Vi mu šaljete list s vašim zadacima. On popuni tri stupca i vraća ga. Iz toga aplikacija čita samo tri vrijednosti po zadatku: dovršenost, stvarni početak i stvarni završetak. Ostatak vašeg rasporeda ostaje netaknut. Što aplikacija radi s tim napretkom, objašnjeno je u [Napredak, datum stanja i temeljni plan](docs://uitleg-voortgang).

## Koraci

### 1. Datum stanja i izračunavanje

Postavite datum stanja kako je opisano u [Ažuriranje napretka](docs://howto-voortgang-bijwerken). Voditelj gradilišta upisuje stvarne datume zaključno s tim danom. Ako raspored nije ažuran, aplikacija prije izrade lista izvrši ponovno izračunavanje.

### 2. Izrada lista

Odaberite *Raspored › Napredak › Izvezi tablicu napretka*. Isti gumb nalazi se i na karticama *Tablica* i *Izvješće*. Aplikacija izrađuje Excel datoteku i predlaže naziv *(naziv projekta)-voortgang.xlsx*; u pregledniku datoteka se sprema u vaša preuzimanja. Radije CSV? Odaberite *Datoteka › Izvoz › List napretka (CSV)*. Excel list također postoji, kao *List napretka (Excel)*.

List ima osam stupaca. Nazivi stupaca ostaju na engleskom, uz kratku uputu na jeziku aplikacije:

- `OPS Task ID`, `WBS` i `Name` služe samo za prepoznavanje zadatka. Ne mijenjajte ih.
- `Start` i `Finish` su planirani datumi, samo za informaciju. Aplikacija ih nikada ne upisuje natrag.
- `Completion (%)`, `Actual Start` i `Actual Finish` su stupci koje upisujete.

Excel list je zaštićen bez lozinke: može se uređivati samo tri stupca za unos. Excel provjerava da je postotak između 0 i 100 i da je stvarni datum zaista datum. Faza (zadatak sažetka) označena je sivom bojom s *— zadatak sažetka: ne unosite*.

### 3. Popunjavanje lista

Za svaki zadatak voditelj gradilišta upisuje:

- `Completion (%)`: od 0 do uključivo 100. U Excel listu dopušteni su decimalni brojevi (na primjer 33,3). U CSV-u uputa traži cijele brojeve.
- `Actual Start` i `Actual Finish`: u Excelu kao datum u vašoj regionalnoj postavci; u CSV-u kao dd-mm-yyyy.

Što god ostane prazno, ne mijenja se. Prazna ćelija zato ne briše ni postojeći napredak; to se može učiniti samo u aplikaciji. Zadatak koji nije započeo ostavlja potpuno prazan.

### 4. Učitavanje lista

1. Odaberite *Raspored › Napredak › Ažuriranje napretka iz lista* (također na karticama *Tablica* i *Izvješće*) ili *Datoteka › Uvezi › Ažuriranje napretka iz lista*. Otvara se prozor *Ažuriranje napretka iz lista*.
2. Kliknite *Odaberi datoteku…* i odaberite popunjenu datoteku `.xlsx` ili `.csv`.
3. Ako su datumi u CSV-u dvosmisleni, aplikacija pita *Dan ili mjesec prvo?*, s datumom iz vaše datoteke pročitanim na dva načina. Kliknite točan datum.
4. Sada vidite pregled. Na vrhu su četiri brojača: *Primijenjeno*, *Nepromijenjeno*, *Čeka povezivanje* i *Odbijeno*. Ispod toga po zadatku vidite što se mijenja, na primjer *Dovršenost: 0% → 100%*.
5. Provjerite pregled i kliknite *Primijeni*. Prozor prikazuje *Rezultat*, s brojačima i redcima koji su odbijeni, uz razlog. Završite klikom na *Zatvori*.

Pregled ne možete preskočiti. Gumb *Primijeni* je onemogućen dok nema što primijeniti.

### 5. Ponovno izračunavanje rasporeda

Učitavanje samo po sebi ne pokreće ponovno izračunavanje rasporeda. Pritisnite **Izračunaj** (F5), na primjer kroz *Raspored › Raspored › Izračunaj*, osim ako je *Automatsko izračunavanje* uključeno.

## Retci koji se ne uklapaju jednostavno

Aplikacija povezuje svaki redak sa zadatkom, najprije prema `OPS Task ID`, a inače prema broju WBS-a.

**Povezivanje je upitno.** Ako je aplikacija zadatak pronašla samo prema broju WBS-a, redak je pod *Povezivanje je upitno*, s gumbima *Potvrdi* i *Promijeni*. Redak se primjenjuje i ako ne učinite ništa, zato provjerite je li zadatak ispravan. *Potvrdi* uklanja redak s ovog popisa; ne mijenja ništa u onome što se primjenjuje. *Promijeni* omogućuje odabir drugog zadatka. Pomoću *Ukloni povezivanje* uklanjate povezivanje koje ste sami napravili. Napomena: list iz drugog projekta s istim brojevima WBS-a ipak se povezuje pod *Povezivanje je upitno* i primjenjuje se kad kliknete *Primijeni*.

**Čeka povezivanje.** Ako aplikacija nije pronašla nijedan zadatak ili ih je našla više s istim brojem WBS-a, redak je pod *Čeka povezivanje*. U polju *Odaberi zadatak…* odaberite pravi zadatak; tražite prema broju WBS-a ili nazivu. Ako ga ne povežete, redak se odbija.

## Zamke i što aplikacija radi

Redak koji se ne uklapa odbija se uz razlog. Ostatak lista obrađuje se dalje. Ovo su glavne poruke:

- *Stvarni datum je nakon datuma stanja.* Postavite kasniji datum stanja ili ispravite list.
- *Prema rasporedu ovaj zadatak počinje tek nakon datuma stanja. Najprije u list upišite stvarni početak.* Aplikacija ne izmišlja početak; upišite ga u list.
- *Postotak je izvan raspona 0–100. Provjerite decimalni znak: tablica s drugom regionalnom postavkom može 8,38 pročitati kao 838.*
- *Zadaci sažetka ne mogu dobiti napredak iz lista.* Napredak faze slijedi iz zadataka koji su ispod nje.
- *Stvarni završetak je prije stvarnog početka.*
- *Nečitljiv datum.* i *Nečitljiv postotak.*
- *Unesene vrijednosti se međusobno proturječe.* Na primjer stvarni završetak uz postotak manji od 100.
- *Za ovaj redak nije pronađen zadatak.* List navodi ID zadatka i broj WBS-a koji se ne pojavljuju u ovom projektu.
- *Ova oznaka WBS-a pripada većem broju zadataka. Povežite redak ručno.*
- *Drugi redak je već preuzeo ovaj zadatak.* Dva retka pokazuju na isti zadatak.
- *Odbio ga je planer.* Drugo odbijanje od strane samog planera, bez vlastite poruke.

Ako se cijela datoteka odbije, u prozoru se prikaže jedna od ovih poruka: *Ova datoteka nema stupac “OPS Task ID” ili “WBS” za povezivanje redaka sa zadacima.*, *Ova datoteka nema nijedan od stupaca Dovršenost, Stvarni početak ili Stvarni završetak.*, *Ova datoteka je prevelika za čitanje kao list napretka.* (više od 16 MB), *Ova datoteka ima previše redaka za čitanje kao list napretka.* (više od 50.000 redaka), *Ova datoteka je zaštićena lozinkom i ne može se pročitati.* ili *Ova datoteka se nije mogla pročitati kao list napretka.*

**Nema datuma stanja.** Ako datum stanja još nije postavljen, a uvoz primjenjuje napredak, aplikacija ga postavlja na današnji datum i javlja vam to. Zato ga sami prvo postavite.

**Sve se poništava odjednom.** Cijeli list je jedan korak za Ctrl+Z.

**Samo ono što upišete.** Redak bez razlike u odnosu na raspored računa se kao *Nepromijenjeno*. Zadatak bez retka u listu ostaje kakav je bio.

## Vidi također

- [Napredak, datum stanja i temeljni plan](docs://uitleg-voortgang): što aplikacija izračunava sa stvarnim datumima i postocima.
- [Ažuriranje napretka](docs://howto-voortgang-bijwerken): unos napretka u samoj aplikaciji.
