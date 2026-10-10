# Pravila rada: trajanje, jedinice dodjele i rad

Na žbukanje postavljate jednog žbukara. Zadatak tada traje četiri dana. Ako dodate drugog žbukara, posao se može završiti za dva dana. Može ostati i četiri dana, ali s dvostruko više rada. Oba su moguća. Koju od te dvije mogućnosti aplikacija odabere, ovisi o **pravilu rada** zadatka. U ovom članku čitate kako aplikacija povezuje trajanje, jedinice dodjele i rad. Čitate i što svako pravilo rada drži stalnim.

## Pojam

Tri veličine su međusobno povezane:

- **Trajanje**: koliko zadatak traje, u radnim danima ili satima.
- **Jedinice dodjele**: koliko resursa radi na zadatku po radnom danu. U aplikaciji se to zove *Jed./dan*. Jedinica dodjele 1 znači jednog žbukara za cijeli dan. 2 znači dvojicu. 0,5 znači pola dana.
- **Rad**: ukupan broj sati koje resurs provede na zadatku.

Zbroj glasi: rad = trajanje × jedinice dodjele × sati po radnom danu. Sati po radnom danu dolaze iz kalendara zadatka. Žbukanje od četiri radna dana s jednim žbukarom iznosi, uz radni dan od 8 sati, 4 × 1 × 8 = 32 sata rada.

Ako promijenite jednu od te tri veličine, najmanje jedna od druge dvije mora se pomaknuti. Inače zbroj više ne vrijedi. Pravilo rada odlučuje koja. Postavljate ga po zadatku, u oknu *Svojstva*. Aplikacija prikazuje *Pravilo rada* i rad tek nakon što ih uključite. Kako to radi, opisano je u [Odabir pravila rada](docs://howto-werkregel-kiezen).

Pravilo rada radi samo na običnim zadacima. Kontrolne točke, faze (zadaci sažetka), hamaci i zadaci čija je *Vrsta trajanja* *Proteklo vrijeme* nemaju pravilo rada. Polje *Pravilo rada* ondje ne postoji. Ni materijal, kao beton ili žbukna smjesa, se ne računa. Količina materijala nikad ne određuje trajanje. Aplikacija zbog pravila rada trajanje za materijal nikad ne prilagođava.

## Kako aplikacija računa

### Pravilo djeluje na ono što promijenite

Aplikacija ponovno izračunava trajanje, jedinice dodjele i rad samo u trenutku kad promijenite jednu od njih. To može biti trajanje zadatka, jedinice dodjele, rad, resurs koji dodate ili uklonite, ili sati dnevno u kalendaru. **Izračunaj** (F5) ne mijenja nijednu od njih. F5 samo izračunava datume. Odabir pravila ne mijenja nijedan broj. Pravilo se primjenjuje pri vašoj sljedećoj promjeni.

Ako pravilo rada promijeni trajanje zadatka, raspored je zastario. Traka stanja tada prikazuje *Zastarjelo — ponovno izračunajte (F5)*, osim ako je uključeno *Automatsko izračunavanje*.

### Četiri pravila

U oknu *Svojstva*, ispod padajućeg izbornika, aplikacija prikazuje što odabrano pravilo štiti. Četiri pravila, s tekstom same aplikacije:

- **Fiksno trajanje i fiksne jedinice** (*Zaštićeno: trajanje i jedinice (rad slijedi)*). Ovo je zadano. Aplikacija trajanje nikad sama ne mijenja. Rad slijedi iz trajanja i jedinica. Ako sami upišete rad, aplikacija prilagodi jedinice, jer je trajanje fiksno.
- **Fiksno trajanje i fiksni rad** (*Zaštićeno: trajanje i rad (jedinice slijede)*). Aplikacija trajanje nikad sama ne mijenja. Ako promijenite trajanje, rad ostaje, a jedinice se prilagode.
- **Fiksni rad** (*Zaštićeno: rad (trajanje slijedi jedinice)*). Rad je fiksan. Trajanje slijedi iz rada i jedinica.
- **Fiksne jedinice** (*Zaštićeno: jedinice (trajanje slijedi rad)*). Jedinice su fiksne. Trajanje slijedi iz rada.

Dakle dva pravila ostavljaju trajanje na miru. Kod druga dva se trajanje pomakne kad promijenite jedinice, rad ili broj resursa. S jednim resursom pravila *Fiksni rad* i *Fiksne jedinice* djeluju potpuno isto. Razlikuju se kad sami promijenite trajanje. Pri pravilu *Fiksni rad* rad ostaje, a jedinice se prilagode. Pri pravilu *Fiksne jedinice* jedinice ostaju, a rad raste. Razlikuju se i kad je na zadatku više resursa.

Primjeri dolje pokazuju što svako pravilo radi.

### Zaokruživanje

Trajanje koje slijedi iz zbroja aplikacija zaokružuje naviše. Za zadatak u danima to znači na cijele radne dane. Za zadatak u satima to znači na cijele minute. Rad i jedinice ostaju kakvi ste ih upisali, ili kakve je aplikacija uzela iz zbroja. Zbog toga zbroj ponekad više ne vrijedi točno. Primjer dolje pokazuje što se tada događa.

### Više resursa

Ako zadatak ima više resursa, vrijede dva dogovora. Pri pravilima *Fiksno trajanje i fiksni rad*, *Fiksni rad* i *Fiksne jedinice* ukupni rad ostaje isti kad dodate ili uklonite resurs. Aplikacija ga tada dijeli srazmjerno jedinicama. Pri pravilu *Fiksno trajanje i fiksne jedinice* novi resurs donosi vlastiti rad. Pri pravilima *Fiksni rad* i *Fiksne jedinice* najsporiji resurs određuje trajanje. Po resursu je to rad podijeljen s jedinicama, a veći rezultat vrijedi.

Primjer: dva resursa imaju po 32 sata rada i jedinice 1. Zajedno su to 4 radna dana. Jedinice prvog postavite na 0,5. Trajanje tada postaje 8 radnih dana. Pod pravilom *Fiksni rad* drugi resurs zadržava svojih 32 sata rada, a njegove jedinice padaju na 0,5. Pod pravilom *Fiksne jedinice* drugi resurs zadržava jedinice 1, a njegov rad raste na 64 sata.

### Napredak

Ako zadatak već ima napredak, pravilo djeluje na preostali dio. To su preostalo trajanje i preostali posao. U aplikaciji se taj dio zove *Rad (preostalo)*. Što je gotovo, ostaje.

### Zadaci u satima

Zadatak koji planirate u satima računa se isto, ali u minutama. Ako je na zadatku od 5 sati samo dizalica, to je 5 sati rada. Pod pravilom *Fiksni rad* trajanje za jedinice 2 tada postaje 2,5 sata. Šuplja međukatna konstrukcija u vježbenom projektu ima i tesarsku ekipu. Ona još uvijek treba 5 sati rada. Najsporija je, pa trajanje ostaje 5 sati. Kako se dani i sati odnose, objašnjeno je u [Dani i sati](docs://uitleg-dagen-en-uren).

## Primjer: žbukanje

Primjer je vježbeni projekt *House extension* iz lekcija. U lekciji 5 sami to izračunate i provjerite brojke. Ovdje čitate što svako pravilo radi.

Žbukanje traje 4 radna dana. Na njega je dodijeljen jedan žbukar, s jedinicama 1. Radni dan je 8 sati. Rad je dakle 32 sata.

### Fiksno trajanje i fiksne jedinice

- Trajanje postavljate na 6 radnih dana: rad raste na 48 sati, a jedinice ostaju 1.
- Jedinice postavljate na 2: trajanje ostaje 4 radna dana, a rad postaje 64 sata.
- U polju *Rad (preostalo)* upisujete 48 sati: trajanje ostaje 4 radna dana, a jedinice postaju 1,5.
- Dodjeljujete drugi resurs, na primjer *Plasterer 2*, s jedinicama 1: trajanje ostaje 4 radna dana. Taj drugi donosi 32 sata rada, zajedno 64 sata.

### Fiksno trajanje i fiksni rad

- Trajanje postavljate na 6 radnih dana: rad ostaje 32 sata, a jedinice padaju na 0,67.
- Jedinice postavljate na 2: trajanje ostaje 4 radna dana. Jer je trajanje fiksno, rad raste na 64 sata.
- U polju *Rad (preostalo)* upisujete 16 sati: trajanje ostaje 4 radna dana, a jedinice postaju 0,5.
- Dodjeljujete drugi resurs, na primjer *Plasterer 2*, s jedinicama 1: 32 sata se dijele, po 16 sati. Jedinice za oba postaju 0,5. Trajanje ostaje 4 radna dana.

### Fiksni rad

- Trajanje postavljate na 6 radnih dana: rad ostaje 32 sata, a jedinice padaju na 0,67.
- Jedinice postavljate na 2: rad ostaje 32 sata, a trajanje postaje 2 radna dana. Ovo je korak koji radite u lekciji 5.
- U polju *Rad (preostalo)* upisujete 48 sati: jedinice ostaju 1, a trajanje postaje 6 radnih dana.
- Dodjeljujete drugi resurs, na primjer *Plasterer 2*, s jedinicama 1: 32 sata se dijele, po 16 sati. Trajanje postaje 2 radna dana. Uklonite taj drugi resurs i trajanje je opet 4 radna dana.

### Fiksne jedinice

- Trajanje postavljate na 6 radnih dana: jedinice ostaju 1, a rad raste na 48 sati.
- Jedinice postavljate na 2: rad ostaje 32 sata, a trajanje postaje 2 radna dana.
- U polju *Rad (preostalo)* upisujete 48 sati: jedinice ostaju 1, a trajanje postaje 6 radnih dana.
- Dodjeljujete drugi resurs, na primjer *Plasterer 2*, s jedinicama 1: 32 sata se dijele, po 16 sati. Trajanje postaje 2 radna dana.

### Kad zbroj ne izlazi

Pod pravilom *Fiksni rad* postavljate jedinice na 3. Rad je 32 sata, pa trajanje postaje 32 ÷ (3 × 8) = 1,33 radna dana. Aplikacija to zaokružuje naviše na 2 radna dana. Rad (32 sata) i jedinice (3) ostaju. Ali 2 × 3 × 8 je 48 sati. Histogram zato raspoređuje 32 sata na 2 radna dana: 2 jedinice dnevno, a ne 3. Pored *Rad (preostalo)* pojavljuje se znak upozorenja *Odstupa od jedinica dodjele × trajanja*. On to pokazuje.

Isto vrijedi i za dva resursa s različitim jedinicama. Pod pravilom *Fiksni rad* dodajete drugi resurs, na primjer *Plasterer 2*, s jedinicama 2. Dodajete ga uz žbukara s jedinicama 1. Aplikacija dijeli 32 sata u omjeru 1 : 2, dakle 10,7 i 21,3 sata. Oba tada trebaju po 1,33 radna dana. Trajanje postaje 2 radna dana.

### Drugi kalendar

Pod pravilom *Fiksni rad* radni dan kalendara prelazi s 8 na 6 sati. Rad ostaje 32 sata. Trajanje tada postaje 32 ÷ 6 = 5,33, zaokruženo naviše na 6 radnih dana. Kako aplikacija računa radne dane i radne sate, objašnjeno je u [Kalendari i radni dani](docs://uitleg-kalenders). Aplikacija javlja: *Nakon promjene kalendara pravilo rada prilagodilo je trajanje za 1 zadatak (rad ostaje, sati dnevno su se promijenili).*

### Zadatak s napretkom

Unutarnji sloj šupljeg zida traje 5 radnih dana i gotov je 40%. Gotova su 2 radna dana, a 3 radna dana (24 sata) preostaju. Pod pravilom *Fiksni rad* jedinice mijenjate s 1 na 2. Preostali posao ostaje 24 sata. Preostalo trajanje postaje 1,5, zaokruženo naviše na 2 radna dana. Zadatak sada traje 2 + 2 = 4 radna dana, a napredak je 50%. Postotak se pomakne jer gotovi dio ostaje isti, a ostatak se skrati.

## Posljedice i pogrešna shvaćanja

**„Fiksni rad znači da je trajanje fiksno.“** Ne, upravo suprotno. Pri pravilima *Fiksno trajanje i fiksne jedinice* i *Fiksno trajanje i fiksni rad* trajanje je fiksno. Pri pravilima *Fiksni rad* i *Fiksne jedinice* trajanje slijedi iz druga dva.

**„Ako odaberem pravilo, moj se raspored mijenja.“** Ne. Odabir ne mijenja nijedan broj. Tek pri vašoj sljedećoj promjeni pravilo odlučuje što se pomiče. Pod pravilom koje štiti rad aplikacija rad fiksira u trenutku odabira, pa postoji broj koji se štiti. Takav zadatak tada ima spremljen *Rad (preostalo)*.

**„Trajanje se promijenilo, a ja ga nisam dirao.“** To se može dogoditi nakon promjene jedinica dodjele, rada, broja resursa ili sati dnevno. Događa se pod pravilom *Fiksni rad* ili *Fiksne jedinice*. Traka stanja tada kaže da je raspored zastario. Pritisnite **Izračunaj** (F5) da vidite nove datume.

**Bez dodjele pravilo rada ne radi ništa.** Tada nema jedinica dodjele ni rada koje bi se vezale uz trajanje.

**Datoteke iz MS Projecta ili Primavera P6 uvijek prikazuju pravilo rada.** Za zadatak iz MS Projecta se ispod pravila ponekad pojavi tekst *Iz MS Projecta: vođeno radom* ili *Iz MS Projecta: nije vođeno radom*. Ta spremljena postavka mijenja dva slučaja. Pri pravilu *Fiksno trajanje i fiksni rad*, ako je zadatak vođen radom, rad se pomakne kad promijenite trajanje, umjesto jedinica dodjele. Pri pravilu *Fiksne jedinice*, ako zadatak nije vođen radom, rad se pomakne kad dodate ili uklonite resurs. Trajanje tada ostaje. Zadaci koje stvorite u aplikaciji nemaju ovu postavku.

## Vidi također

- [Odabir pravila rada](docs://howto-werkregel-kiezen): koraci za postavljanje pravila rada zadatka.
- [Dodjela resursa krivuljom](docs://howto-resource-toewijzen): resurs postavljate na zadatak, s jedinicama dodjele i raspodjelom.
- [Dani i sati](docs://uitleg-dagen-en-uren): kako aplikacija pretvara dane i sate.
- [Kalendari i radni dani](docs://uitleg-kalenders): kako aplikacija računa radne dane i radne sate.
