# Vrste zadatka: trajanje, jedinice dodjele i rad

Na žbukanje postavljate jednog žbukara. Zadatak tada traje četiri dana. Ako dodate drugog žbukara, posao se može završiti za dva dana. Može ostati i četiri dana, ali s dvostruko više rada. Oba su logična. Koju od te dvije mogućnosti aplikacija odabere, ovisi o **vrsti zadatka**. U ovom članku čitate kako aplikacija povezuje trajanje, jedinice dodjele i rad. Čitate i što svaka vrsta zadatka drži stalnim.

## Pojam

Tri veličine su međusobno povezane:

- **Trajanje**: koliko zadatak traje, u radnim danima ili satima.
- **Jedinice dodjele**: koliko resursa radi na zadatku po radnom danu. U oknu *Svojstva* to se zove *Jedinice dodjele*, u drugim prozorima *Jed./dan*. Jedinica 1 znači jednog žbukara za cijeli dan, 2 znači dvojicu, a 0,5 znači pola dana.
- **Rad**: ukupan broj sati koje resurs provede na zadatku.

Formula glasi: rad = trajanje × jedinice dodjele × sati po radnom danu. Sati po radnom danu dolaze iz kalendara zadatka. Žbukanje od četiri radna dana s jednim žbukarom, uz radni dan od 8 sati, iznosi 4 × 1 × 8 = 32 sata rada.

Ako promijenite jednu od te tri veličine, mora se pomaknuti najmanje jedna od preostalih dviju. Inače formula više ne vrijedi. Vrsta zadatka odlučuje koja to je. Postavljate je po zadatku, u oknu *Svojstva*. Aplikacija prikazuje *Vrsta zadatka* i rad tek nakon što ih uključite. Kako to radi, opisano je u [Odabir vrste zadatka](docs://howto-werkregel-kiezen).

Vrsta zadatka radi samo na običnim zadacima. Kontrolne točke, faze (zadaci sažetka), hamaci i zadaci čija je *Vrsta trajanja* *Proteklo vrijeme* nemaju vrstu zadatka. Polje *Vrsta zadatka* ondje ne postoji. Materijal se također ne računa, na primjer beton ili žbukna smjesa. Količina materijala nikad ne određuje trajanje. Aplikacija zbog vrste zadatka trajanje za materijal nikad ne prilagođava.

## Kako aplikacija računa

### Vrsta zadatka djeluje na ono što promijenite

Aplikacija ponovno izračunava trajanje, jedinice dodjele i rad samo u trenutku kad promijenite jednu od njih. To može biti trajanje zadatka, jedinice dodjele, rad, resurs koji dodate ili uklonite, ili sati dnevno u kalendaru. **Izračunaj** (F5) ne mijenja nijednu od njih. F5 samo izračunava datume. Odabir vrste zadatka ne mijenja ni jedan broj. Vrsta zadatka ima učinak tek pri vašoj sljedećoj promjeni.

Ako vrsta zadatka promijeni trajanje zadatka, raspored je zastario. Traka stanja tada prikazuje *Zastarjelo — ponovno izračunajte (F5)*, osim ako je uključeno *Automatsko izračunavanje*.

### Četiri vrste zadatka

U oknu *Svojstva* nalazi se ikona „i“ pored padajućeg izbornika *Vrsta zadatka*. Ako pokažete na nju, kliknete ili dodirnete, aplikacija objašnjava vrstu zadatka koja sada vrijedi. U otvorenom padajućem izborniku svaka mogućnost ima takvu ikonu. Objašnjenje počinje podebljanom rečenicom. Četiri vrste zadatka, s tom rečenicom iz aplikacije:

- **Fiksno trajanje i fiksne jedinice** (*Rad proizlazi iz trajanja i jedinica dodjele.*). Ovo je zadano. Aplikacija trajanje nikad sama ne mijenja. Rad slijedi iz trajanja i jedinica dodjele. Ako sami upišete rad, aplikacija prilagodi jedinice, jer je trajanje fiksno.
- **Fiksno trajanje i fiksni rad** (*Jedinice dodjele proizlaze iz trajanja i rada.*). Aplikacija trajanje nikad sama ne mijenja. Ako promijenite trajanje, rad ostaje, a jedinice se prilagode.
- **Fiksni rad** (*Trajanje proizlazi iz rada i jedinica dodjele.*). Rad je fiksan. Trajanje slijedi iz rada i jedinica dodjele.
- **Fiksne jedinice** (*Trajanje proizlazi iz rada i jedinica dodjele.*). Jedinice su fiksne. Trajanje slijedi iz rada.

Dakle dvije vrste zadatka ostavljaju trajanje na miru. Kod druge dvije trajanje se pomakne kad promijenite jedinice, rad ili broj resursa. S jednim resursom Fiksni rad i Fiksne jedinice djeluju potpuno isto. Razlikuju se kad sami promijenite trajanje. Pri vrsti Fiksni rad rad ostaje, a jedinice se prilagode. Pri vrsti Fiksne jedinice jedinice ostaju, a rad raste. Razlikuju se i kad je na zadatku više resursa.

Primjeri dolje pokazuju što svaka vrsta zadatka radi.

### Zaokruživanje

Trajanje koje slijedi iz formule aplikacija zaokružuje naviše. Za zadatak u danima to znači na cijele radne dane. Za zadatak u satima to znači na cijele minute. Rad i jedinice ostaju kakvi ste ih upisali, ili kakve je aplikacija uzela iz formule. Zato formula ponekad više ne vrijedi točno. Primjer dolje pokazuje što se tada događa.

### Više resursa

Ako zadatak ima više resursa, vrijede dva dogovora. Pri vrstama Fiksno trajanje i fiksni rad, Fiksni rad i Fiksne jedinice ukupni rad ostaje isti kad dodate ili uklonite resurs. Aplikacija ga tada dijeli srazmjerno jedinicama. Pri vrsti Fiksno trajanje i fiksne jedinice novi resurs donosi vlastiti rad. Pri vrstama Fiksni rad i Fiksne jedinice najsporiji resurs određuje trajanje. Po resursu je to rad podijeljen s jedinicama, a veći rezultat vrijedi.

Primjer: dva resursa imaju po 32 sata rada i jedinice 1. Zajedno su to 4 radna dana. Jedinice prvog postavite na 0,5. Trajanje tada postaje 8 radnih dana. Pod vrstom Fiksni rad drugi resurs zadržava svojih 32 sata rada, a njegove jedinice padaju na 0,5. Pod vrstom Fiksne jedinice drugi resurs zadržava jedinice 1, a njegov rad raste na 64 sata.

### Napredak

Ako zadatak već ima napredak, vrsta zadatka djeluje na preostali dio. To su preostalo trajanje i preostali posao. U oknu *Svojstva* taj se rad nalazi u stupcu *Rad (h)*. Što je već gotovo, ostaje.

### Zadaci u satima

Zadatak koji planirate u satima računa se isto, ali u minutama. Ako je na zadatku od 5 sati samo dizalica, to je 5 sati rada. Pod vrstom Fiksni rad trajanje za jedinice 2 tada postaje 2,5 sata. Šuplja međukatna konstrukcija u vježbenom projektu ima i tesarsku ekipu. Ona i dalje treba 5 sati rada. Najsporija je, pa trajanje ostaje 5 sati. Kako se dani i sati odnose, objašnjeno je u [Dani i sati](docs://uitleg-dagen-en-uren).

## Primjer: žbukanje

Primjer je vježbeni projekt *House extension* iz lekcija. U lekciji 5 sami to izračunate i provjerite brojke. Ovdje čitate što svaka vrsta zadatka radi.

Žbukanje traje 4 radna dana. Na njega je dodijeljen jedan žbukar, s jedinicama 1. Radni dan je 8 sati. Rad je dakle 32 sata.

### Fiksno trajanje i fiksne jedinice

- Trajanje postavljate na 6 radnih dana: rad raste na 48 sati, a jedinice ostaju 1.
- Jedinice postavljate na 2: trajanje ostaje 4 radna dana, a rad postaje 64 sata.
- U polje *Rad (h)* upisujete 48 sati: trajanje ostaje 4 radna dana, a jedinice postaju 1,5.
- Dodjeljujete drugi resurs, na primjer *Plasterer 2*, s jedinicama 1: trajanje ostaje 4 radna dana. Taj drugi donosi 32 sata rada, zajedno 64 sata.

### Fiksno trajanje i fiksni rad

- Trajanje postavljate na 6 radnih dana: rad ostaje 32 sata, a jedinice padaju na 0,67.
- Jedinice postavljate na 2: trajanje ostaje 4 radna dana. Jer je trajanje fiksno, rad raste na 64 sata.
- U polje *Rad (h)* upisujete 16 sati: trajanje ostaje 4 radna dana, a jedinice postaju 0,5.
- Dodjeljujete drugi resurs, na primjer *Plasterer 2*, s jedinicama 1: 32 sata se dijele, po 16 sati. Jedinice za oba postaju 0,5. Trajanje ostaje 4 radna dana.

### Fiksni rad

- Trajanje postavljate na 6 radnih dana: rad ostaje 32 sata, a jedinice padaju na 0,67.
- Jedinice postavljate na 2: rad ostaje 32 sata, a trajanje postaje 2 radna dana. Ovo je korak koji radite u lekciji 5.
- U polje *Rad (h)* upisujete 48 sati: jedinice ostaju 1, a trajanje postaje 6 radnih dana.
- Dodjeljujete drugi resurs, na primjer *Plasterer 2*, s jedinicama 1: 32 sata se dijele, po 16 sati. Trajanje postaje 2 radna dana. Uklonite taj drugi resurs i trajanje je opet 4 radna dana.

### Fiksne jedinice

- Trajanje postavljate na 6 radnih dana: jedinice ostaju 1, a rad raste na 48 sati.
- Jedinice postavljate na 2: rad ostaje 32 sata, a trajanje postaje 2 radna dana.
- U polje *Rad (h)* upisujete 48 sati: jedinice ostaju 1, a trajanje postaje 6 radnih dana.
- Dodjeljujete drugi resurs, na primjer *Plasterer 2*, s jedinicama 1: 32 sata se dijele, po 16 sati. Trajanje postaje 2 radna dana.

### Kad se formula ne poklapa

Pod vrstom Fiksni rad postavite jedinice na 3. Rad je 32 sata, pa trajanje postaje 32 ÷ (3 × 8) = 1,33 radna dana. Aplikacija to zaokružuje naviše na 2 radna dana. Rad (32 sata) i jedinice (3) ostaju, ali 2 × 3 × 8 je 48 sati. Histogram zato raspoređuje 32 sata na 2 radna dana: 2 jedinice dnevno, a ne 3. U polju *Rad (h)* pojavljuje se znak upozorenja *Odstupa od jedinica dodjele × trajanja*, koji to pokazuje.

Isto vrijedi za dva resursa s različitim jedinicama. Pod vrstom Fiksni rad dodajete drugi resurs, na primjer *Plasterer 2*, s jedinicama 2, uz žbukara s jedinicama 1. Aplikacija dijeli 32 sata u omjeru 1 : 2, dakle 10,7 i 21,3 sata. Oba tada trebaju po 1,33 radna dana. Trajanje postaje 2 radna dana.

Datoteka iz P6 ili MS Projecta može imati i *Rad (preostalo)* koji nije jednak jedinicama × preostalom trajanju. Tada se pojavljuje isto upozorenje. Aplikacija taj rad sama ne mijenja. Ako promijenite trajanje takvog zadatka, aplikacija slijedi vrstu zadatka, i kad je preostali rad došao iz datoteke. Pod vrstama Fiksno trajanje i fiksne jedinice te Fiksne jedinice preostali rad postaje jedinice × novo preostalo trajanje. Pod vrstama Fiksno trajanje i fiksni rad te Fiksni rad rad ostaje, a jedinice se prilagode. Ako preostali posao iz datoteke tako nestane, dobivate obavijest sa starim i novim brojem sati. Ctrl+Z vraća staru vrijednost. Objašnjenje uz znak upozorenja kaže vam za svaki zadatak što se od ta dva događa.

### Drugi kalendar

Pod vrstom Fiksni rad radni dan kalendara prelazi s 8 na 6 sati. Rad ostaje 32 sata. Trajanje tada postaje 32 ÷ 6 = 5,33, zaokruženo naviše na 6 radnih dana. Kako aplikacija računa radne dane i radne sate, objašnjeno je u [Kalendari i radni dani](docs://uitleg-kalenders). Aplikacija javlja: *Nakon promjene kalendara vrsta zadatka prilagodila je trajanje za 1 zadatak (rad ostaje, sati dnevno su se promijenili).*

### Zadatak s napretkom

Unutarnji sloj šupljeg zida traje 5 radnih dana i gotov je 40%. Gotova su 2 radna dana, a 3 radna dana (24 sata) preostaju. Pod vrstom Fiksni rad jedinice mijenjate s 1 na 2. Preostali posao ostaje 24 sata. Preostalo trajanje postaje 1,5, zaokruženo naviše na 2 radna dana. Zadatak sada traje 2 + 2 = 4 radna dana, a napredak je 50%. Postotak se pomakne jer gotovi dio ostaje isti, a ostatak se skrati.

## Posljedice i pogrešna shvaćanja

**„Fiksni rad znači da je trajanje fiksno.“** Ne, upravo suprotno. Pri vrstama *Fiksno trajanje i fiksne jedinice* i *Fiksno trajanje i fiksni rad* trajanje je fiksno. Pri vrstama *Fiksni rad* i *Fiksne jedinice* trajanje slijedi iz druga dva.

**„Ako odaberem vrstu zadatka, moj se raspored mijenja.“** Ne. Odabir ne mijenja nijedan broj. Tek pri vašoj sljedećoj promjeni vrsta zadatka odlučuje što se pomiče. Pod vrstom koja štiti rad aplikacija rad fiksira u trenutku odabira, pa postoji broj koji se štiti. Takav zadatak tada ima spremljen *Rad (h)*.

**„Trajanje se promijenilo, a ja ga nisam dirao.“** To se može dogoditi nakon promjene jedinica dodjele, rada, broja resursa ili sati dnevno. Događa se pod vrstom Fiksni rad ili Fiksne jedinice. Traka stanja tada kaže da je raspored zastario. Pritisnite **Izračunaj** (F5) da vidite nove datume.

**Bez dodjele vrsta zadatka ne radi ništa.** Tada nema jedinica dodjele ni rada koje bi se vezale uz trajanje.

**Datoteke iz MS Projecta ili Primavera P6 uvijek prikazuju vrstu zadatka.** Za zadatak iz MS Projecta aplikacija ponekad čuva postavku *vođeno radom*. Ta spremljena postavka mijenja dva slučaja. Pri vrsti Fiksno trajanje i fiksni rad, ako je zadatak vođen radom, rad se pomakne kad promijenite trajanje, umjesto jedinica dodjele. Pri vrsti Fiksne jedinice, ako zadatak nije vođen radom, rad se pomakne kad dodate ili uklonite resurs, a trajanje ostaje. Zadaci koje sami stvorite u aplikaciji nemaju tu postavku. Objašnjenje uz ikonu „i“ uzima tu postavku u obzir.

## Vidi također

- [Odabir vrste zadatka](docs://howto-werkregel-kiezen): koraci za postavljanje vrste zadatka.
- [Dodjela resursa krivuljom](docs://howto-resource-toewijzen): resurs postavljate na zadatak, s jedinicama dodjele i raspodjelom.
- [Dani i sati](docs://uitleg-dagen-en-uren): kako aplikacija pretvara dane i sate.
- [Kalendari i radni dani](docs://uitleg-kalenders): kako aplikacija računa radne dane i radne sate.
