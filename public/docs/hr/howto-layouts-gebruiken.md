# Stvaranje i korištenje izgleda

Cilj: jednim klikom prebacivati se između prikaza vašeg rasporeda, na primjer samo kritični zadaci, zadaci po ekipi ili drugi redoslijed sortiranja.

## Kada vam ovo treba

Na sastanku na gradilištu naručitelj želi vidjeti samo kritične zadatke. Zatim voditelj gradilišta želi po ekipi vidjeti tko je potreban kada. Zatim želite ponovno cijeli raspored. Ponovno postavljanje filtara, grupiranja i redoslijeda sortiranja svaki put je zamorno. **Izgled** sprema takav prikaz kao gumb na vrpci.

Izgled može spremiti šest stvari: filtar, grupiranje, sortiranje, stupce tablice zadataka uz Gantt dijagram, vremensku skalu te crte ovisnosti i preklope (temeljni plan, linija napretka, linija datuma stanja, isticanje resursa, pojas vremenske rezerve i boje traka). Kad kliknete gumb, mijenja se samo ono što ste označili. Ostatak vašeg prikaza ostaje kakav jest.

Filtrirate, grupirate i sortirate pomoću izgleda. Zasebni gumbi *Filtriraj…*, *Grupiraj…* i *Sortiraj…* sada postoje samo iza skrivene postavke (vidi zamke).

## Koraci

### Korištenje postojećeg izgleda

1. Odaberite karticu *Prikaz*. U grupi *Izgled* nalazi se gumb za svaki izgled. Zadano je to *Dijagram resursa*.
2. Kliknite ga. *Dijagram resursa* grupira zadatke po resursu, sortira unutar svake grupe prema početku i isključuje crte ovisnosti. Zadatak s dva resursa prikazuje se pod oba.
3. Ponovno kliknite da izgled isključite. Prikaz se vraća u stanje prije vašeg klika.

Svaki klik je jedan korak za *Poništi* (Ctrl+Z), i za uključivanje i za isključivanje.

### Izrada vlastitog izgleda

1. U grupi *Izgled* kliknite *Novi izgled*. Otvara se prozor *Novi izgled*.
2. U polje *Naziv* upišite naziv. U polju *Ikona* odaberite ikonu.
3. Ispod *Što ovaj izgled sprema?* nalazi se šest dijelova s potvrdnim okvirom. Novi prozor u početku ima sve dijelove označene i ispunjene onim što je sada na vašem zaslonu. Odznačite sve što izgled ne smije mijenjati. Ako želite samo filtar, ostavite uključen samo *Filtar*. *Preuzmi trenutačni prikaz* ponovno ispunjava sve dijelove prema vašem zaslonu.
4. Postavite dijelove.
5. Kliknite *Spremi*.

Izgled je sada gumb na vrpci, ali još nije primijenjen. Kliknite gumb da ga uključite.

### Postavljanje filtra

U dijelu *Filtar* sastavljate pravila. Kliknite *+ pravilo*, odaberite *Polje*, *Operator* i vrijednost. Ako želite samo kritične zadatke: polje *Kritičan*, operator *je jednako*, vrijednost *Da*. Polja obuhvaćaju *Naziv zadatka*, *Početak*, *Završetak*, *Ukupan slobodni hod*, *Napredak* i *Kontrolna točka*, uz vaše šifre zadataka i vaša polja te *Resursi*. Operatori ovise o vrsti polja: za tekst možete odabrati *sadrži*, za brojeve i datume *između*.

Koje operatore dobijete ovisi o vrsti polja:

- Tekst (*Naziv zadatka*, *WBS*): *je jednako*, *nije jednako*, *sadrži*, *počinje s* i *je prazno*.
- Broj i datum (*Ukupan slobodni hod*, *Početak*, *Napredak*): *je jednako*, *nije jednako*, *manje od*, *manje ili jednako*, *veće od*, *veće ili jednako*, *između* i *je prazno*. Uz *između* su dva polja: za broj s oznakama *Od* i *Do*, za datum bez oznaka (prvi datum je početak, drugi je završetak).
- Da/ne (*Kritičan*, *Kontrolna točka*, *Gotovo kritičan*): *je jednako* i *nije jednako*, s vrijednosti *Da* ili *Ne*.
- Izbor (*Vrsta*, šifra zadatka): *je jednako*, *nije jednako*, *je jedan od* (s vrijednostima uz potvrdne okvire) i *je prazno*.
- *Resursi*: *je jedan od* i *je prazno*.
- *U tijeku*: samo *između*, s dva datuma (od i do).

S poljem *U tijeku*, operatorom *između* i dva datuma dobijete sve zadatke koji se odvijaju u bilo kojem trenutku tog razdoblja, na primjer sve što je aktivno u lipnju.

Više pravila kombinirate pomoću popisa na vrhu: *Sve u nastavku (I)* prikazuje zadatke koji ispunjavaju sva pravila, *Bilo što u nastavku (ILI)* zadatke koji ispunjavaju barem jedno pravilo. Pomoću *+ skupina* dodajete podskupinu sa svojim pravilima.

Filtar gleda same zadatke. Faze (zadaci sažetka) kojima zadatak pripada ostaju vidljive sivo, pa vidite gdje zadatak pripada. Ako dodatno grupirate, te sive faze nestaju.

### Grupiranje i sortiranje

U dijelu *Grupiranje* dodajete polje pomoću *+ razina*. Najviše su dvije razine grupiranja. Bez grupiranja vidite stablo WBS-a. U dijelu *Sortiranje* dodajete polje pomoću *+ razina* i odaberete *Uzlazno* ili *Silazno*. Uz dvije razine druga odlučuje kada su vrijednosti u prvoj jednake.

### Isprobavanje bez gumba

U prozoru kliknite *Primijeni bez spremanja*. Označeni dijelovi se primjenjuju na zaslon, ali gumb se ne dodaje. To je zgodno za filtar koji trebate samo jednom. Ctrl+Z to poništava.

### Promjena, kopiranje ili uklanjanje izgleda

Desnom tipkom miša kliknite gumb izgleda. Odaberete *Uredi…*, *Dupliciraj* ili *Izbriši*. *Izbriši* prvo traži potvrdu. Kopija se zove *naziv (kopija)*. Ugrađeni izgled, na primjer *Dijagram resursa*, ne možete uređivati niti izbrisati. Dupliciranjem stvarate vlastitu verziju.

### Više izgleda istodobno

Izgledi koji ne spremaju iste dijelove mogu biti uključeni zajedno. Ako imate izgled koji sprema samo filtar *Kritičan je jednako Da* (nazovite ga, na primjer, *Samo kritični*) i uključite ga zajedno s *Dijagram resursa* (grupiranje, sortiranje, crte ovisnosti), dobijete kritične zadatke po resursu. Ako oba izgleda spremaju isti dio, na primjer filtar, drugi preuzima i prvi se isključuje. Ako taj drugi ponovno isključite, vraćate se na prikaz prije vašeg prvog klika, a ne na prvi izgled.

## Zamke i što aplikacija radi

**Zaboravite odznačiti dijelove.** Izgled koji sprema i stupce, vremensku skalu i preklope pri svakom kliku vraća te dijelove u spremljeno stanje. Vaše zumiranje tada skače, iako ste željeli samo filtar. Provjerite u prozoru da su označeni samo dijelovi koje želite.

**Nepotpuno pravilo ne prikazuje ništa.** Ako za polje da/ne ne odaberete vrijednost (još piše *—*) ili ostavite datume za *U tijeku* prazne, nijedan zadatak ne odgovara i popis ostaje prazan. Dovršite pravilo.

**Ručna promjena isključuje izgled.** Ako sami promijenite dio koji izgled sprema, na primjer *Crte ovisnosti* dok je *Dijagram resursa* uključen, taj izgled se isključuje, a ostali dijelovi se vraćaju na prikaz prije izgleda. Zumiranje isključuje izgled koji sprema vremensku skalu, a proširivanje stupca isključuje izgled koji sprema stupce. Ostatak prikaza tada ostaje kakav jest. Dijagram resursa ne sprema vremensku skalu, pa zumiranje na njega ne utječe.

**Stupci se odnose na tablicu zadataka uz Gantt dijagram.** Dio *Stupci* sprema stupce tablice lijevo od vremenske crte. Tablica na kartici *Tablica* zadržava svoje stupce. Kako odabirete stupce, opisano je u [Prilagodba stupaca tablice](docs://howto-tabelkolommen-aanpassen).

**Uvući i pomaknuti na višu razinu nisu dostupni.** Dok je filtar, grupiranje ili sortiranje uključeno, prikazani redoslijed nije redoslijed rasporeda. *Uvući* i *Pomakni na višu razinu* su tada onemogućeni, a savjet glasi *Nije dostupno tijekom filtriranja, grupiranja ili sortiranja*. Isključite izgled da biste ponovno prilagodili strukturu, kako je opisano u [Prilagodba strukture](docs://howto-structuur-aanpassen).

**Traka stanja ne prati filtar.** *Zadaci:* u traci stanja prikazuje broj zadataka cijelog projekta, čak i ako filtar prikazuje samo dio njih.

**Izgledi su na vašem uređaju, a ne u projektu.** Aplikacija čuva vaše izglede i stupce za sve vaše projekte na ovom uređaju. Preklopi iz izgleda (temeljni plan, linija napretka i ostali) vrijede za sve vaše projekte. Filtar, grupiranje i sortiranje koji su trenutačno uključeni pripadaju otvorenom projektu, ali ne ulaze u datoteku projekta: nakon spremanja i ponovnog otvaranja prikaz je ponovno čist. Ni oni ne označavaju projekt kao „izmijenjen“.

**Zasebni gumbi su skriveni.** *Stupci…*, *Filtriraj…*, *Grupiraj…* i *Sortiraj…* kao zasebni gumbi na kartici *Prikaz* pripadaju staroj verziji prikaza. Vraćate ih pomoću *Prikaži klasične gumbe prikaza* u dijelu *Zastarjele funkcije* na kartici *Napredno* u prozoru postavki (⚙ u naslovnoj traci). Radije koristite izglede.

## Vidi također

- [Prilagodba stupaca tablice](docs://howto-tabelkolommen-aanpassen): odabir, premještanje i fiksiranje samih stupaca.
- [Izrada i ispis izvješća](docs://howto-rapport-maken-en-afdrukken): prikaz na papiru s *Prati prikaz*.
- [Prilagodba strukture](docs://howto-structuur-aanpassen): zašto ne možete uvući zadatke dok je filtar uključen.
