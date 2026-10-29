# Dijalog zadatka i okno svojstava

Zadatak možete uređivati na dva mjesta: u prozoru *Uredi zadatak* i u oknu *Svojstva*. Gotovo sva polja su ista na oba mjesta. Za svako polje ovaj članak opisuje što radi, koja je zadana vrijednost i što primijetite. Kako stvoriti i postaviti zadatak, piše u [Dodavanje zadataka i kontrolnih točaka](docs://howto-taken-en-mijlpalen-toevoegen). Zašto izračun daje baš taj rezultat, piše u [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad).

## Dva mjesta

- **Uredi zadatak** — prozor za prvi odabrani zadatak. Otvorite ga tipkom F2, dvostrukim klikom na traku u Gantt dijagramu ili desnim klikom na zadatak u Gantt dijagramu ili u tablici i odabirom *Uredi...*. Vaše promjene ostaju u nacrtu dok ne kliknete *Spremi* (Enter). *Odustani* (Esc) ih odbacuje. *Spremi* je onemogućeno dok je naziv prazan. Spremanje je jedan korak poništavanja (*Poništi*), uključujući ono što ste učinili u odjeljcima *Vrsta zadatka*, *Ovisnosti*, *Dodjele* i *Šifre i polja*. Ti odjeljci već djeluju na projekt dok uređujete, a *Odustani* to poništava.
- **Svojstva** — okno u desnom stupcu, za aktivni zadatak. Svaka promjena djeluje odmah. Uzastopne promjene istog polja broje se kao jedan korak poništavanja (*Poništi*). Bez zadatka piše *Odaberite zadatak za prikaz svojstava.* Uključite ili isključite okno s *Prikaz › Paneli › Svojstva*. Zadano: uključeno. Okno stoji pored Gantt dijagrama i na kartici *Tablica*, ali ne na *IFC* i *Izvješće* i ne ispod punog okna resursa.

Samo u prozoru: *Nadređeni zadatak* te gumbi *Spremi* i *Odustani*. Samo u oknu: ikona kante *Izbriši zadatak*, gumb *Izračunaj* na dnu, odjeljak *Prekidi*, tri oznake pod *Vrsta zadatka* (dugo neradno razdoblje, MS Project, zabilježeni datumi) te dodavanje ovisnosti i skok na povezani zadatak u *Ovisnosti*. Sva ostala polja su na oba mjesta. Prozor prikazuje *Ovisnosti*, *Dodjele* i *Šifre i polja* samo za postojeći zadatak.

Ako ste promijenili nešto što utječe na datume, pritisnite *Izračunaj*. Izračunavanje se ne pokreće samo od sebe, osim ako je uključeno *Automatsko izračunavanje*.

## Opće

- **Naziv** (u prozoru *Naziv \**) — naziv zadatka u Gantt dijagramu, tablici i izvješćima. Obavezno: prazan naziv se ne sprema. Zadano za novi zadatak: *Novi zadatak*.
- **WBS šifra** — strukturna šifra zadatka, na primjer `RB-301`. Obavezno. Uz *Raspored › Struktura › WBS auto* polje je onemogućeno (savjet: *WBS šifre numeriraju se automatski (Raspored → Struktura)*), jer aplikacija tada sama upravlja šiframa.
- **Opis** — slobodni tekst. Nema učinka na izračun. Možete ga prikazati kao stupac *Opis* u tablici.
- **Kategorija radova** — kategorija radova zadatka. Popis ima skupine *Ugrađene kategorije radova* (*Gradnja*, *Instalacija*, *Rušenje*, *Logistika*, *Inspekcija*, *Premještanje*, *Obnova*, *Održavanje*), *Moje kategorije radova* i *Iz ovog projekta*. *Ostalo* se pojavljuje samo ako zadatak već ima tu kategoriju radova. Na dnu su *+ Nova kategorija radova…* i *Upravljaj kategorijama radova…*. Zadano: kategorija radova nadređenog zadatka, inače *Gradnja* (način za gradnju uključen, što je zadano) ili *Ostalo*. Učinak: nema učinka na izračun; možete grupirati i filtrirati po njoj te bojiti trake prema njoj. Aplikacija čuva prilagođenu kategoriju radova na vašem uređaju. Kad je odaberete, kopija ide u projekt (*Iz ovog projekta*). Ako u *+ Nova kategorija radova…* upišete naziv koji već postoji u *Moje kategorije radova*, čak i s drugim velikim slovima, aplikacija ne stvara drugu kategoriju nego odabire postojeću. U *Upravljaj kategorijama radova…* uređujete ili uklanjate samo svoje kategorije radova; prazan naziv ili naziv koji već postoji se ne sprema. Ako uklonite kategoriju radova koju otvoreni projekt koristi, aplikacija prvo pita, a kopija u projektu ostaje. Kategorija radova pod *Iz ovog projekta*, na primjer iz tuđe datoteke, ulazi na vaš popis tek kad kliknete *Dodaj u moje kategorije radova* u *Upravljaj kategorijama radova…*.
- **Kalendar** — kalendar u kojem zadatak broji svoje trajanje, datum završetka i vremensku rezervu. Zadano: *Projektni kalendar: {name}*. Učinak: zadatak s vlastitim kalendarom radi na drugim danima nego projektni kalendar. Nakon promjene *Izračunaj* ponovno izračunava datume. Pogledajte [Kalendari i radni dani](docs://uitleg-kalenders).
- **Nadređeni zadatak** (samo u prozoru) — premješta zadatak pod drugi zadatak. Zadano: trenutni nadređeni zadatak. *- Nema (korijen) -* stavlja zadatak na najvišu razinu. Izbor koji bi stvorio ciklus u ovisnostima odbija se pri *Spremi* s porukom, a prozor ostaje otvoren.

## Bilješke

- **Bilješke** — kontrolni popis na zadatku. *Dodaj bilješku* dodaje redak; kvačica (*Gotovo*) ga precrta; ikona kante (*Ukloni*) ga briše. Bez redaka piše *Još nema bilješki.* Nema učinka na izračun; stupac *Bilješke* u tablici ih prikazuje s ✓ ili ○ ispred.

## Kontrolna točka

- **Kontrolna točka** — pretvara zadatak u kontrolnu točku. Zadano: isključeno. Učinak: trajanje postaje 0. Aplikacija to odbija za zadatak sažetka (zadatak s podzadacima) i za zadatak s dodjelama resursa, uz poruku; prvo uklonite dodjele. Ako je ponovno isključite, nestaju *Vrsta kontrolne točke* i *Obvezno (ugovorno)*.
- **Vrsta kontrolne točke** (samo za kontrolnu točku) — *Automatski*, *Početna kontrolna točka* ili *Završna kontrolna točka*. Zadano: *Automatski*. Učinak: početna kontrolna točka je na početku dana, završna na kraju dana. Uz *Automatski* kontrolna točka se broji kao početna kontrolna točka kad je prethodnik, na početku dana.
- **Obvezno (ugovorno)** (samo za kontrolnu točku) — označava ugovornu kontrolnu točku, na primjer inspekciju ili predaju. Zadano: isključeno. Učinak: oznaka za Gantt dijagram i izvješća; ne štiti datum. To se postiže ograničenjem ili rokom za dovršetak.

## Vrijeme

- **Početak** (u prozoru *Datum početka*) — prikazuje početak, isti datum kao traka u Gantt dijagramu i stupac *Početak*, a ne izvorni planirani datum. Za zadatak koji je već započeo to je stvarni početak i polje je samo za čitanje; umjesto toga promijenite *Stvarni početak*. Inače je to izračunati početak. Obavezno: prazno polje vraća prethodnu vrijednost. Učinak unosa: novi datum postaje planirani datum (stupac *Planirani početak*). Ako zadatak ima prethodnika i još nije započeo, aplikacija novi početak bilježi kao ograničenje *Ne početi prije (SNET)* na taj datum (ili pomiče postojeći SNET), uz poruku. Nakon *Izračunaj* zadatak zato ne počinje ranije. Ako postoji ograničenje osim *ASAP* ili *SNET*, aplikacija ne primjenjuje početak i kaže koje ograničenje određuje početak.
- **Trajanje** — koliko zadatak traje. Upišite `5d` za dane, ili `12h` ili `1h 30m` za sate (`u`, `hour` i `hours` također rade). Broj bez jedinice broji se u jedinici zadatka. Dani su uvijek cijeli brojevi; sati mogu imati decimalni dio. Neispravan unos daje poruku *Unesite cijeli broj dana ili sati, na primjer 2d ili 12h.* i polje se vraća. Zadano za novi zadatak: 5 dana (kontrolna točka 0). Polje je onemogućeno za zadatak sažetka, hamak i kontrolnu točku s trajanjem 0: njihovo trajanje slijedi iz drugih zadataka ili je nula. Zadatak u satima onemogućen je dok je isključeno *Uključi planiranje u satima*; postoji gumb s tim nazivom. Učinak: nakon *Izračunaj* trajanje određuje završetak u kalendaru zadatka. Ako zadatak ima resurse i vrstu zadatka, vrsta zadatka odlučuje hoće li rad ili jedinice dodjele pratiti promjenu. Ako je zadatak već djelomično gotov, aplikacija odbija trajanje kraće od obavljenog rada. Pogledajte [Dani i sati](docs://uitleg-dagen-en-uren).
- **Jedinica trajanja** — izbor *Dani* ili *Sati*, uz gumb s informacijom. Vidljivo samo kad su uključeni *Uključi planiranje u satima* i *Dopusti mješoviti raspored po danima i satima* (potonje je zadano uključeno kad je planiranje u satima uključeno). Učinak: kad odaberete drugu jedinicu, aplikacija odmah pretvori trajanje ako je rezultat točan. *Poništi* to vraća u jednom koraku. Ako se ne uklapa točno, jedinica ostaje i aplikacija to kaže. Kalendar bez ispravnog radnog vremena odbija promjenu.
- **Vrsta zadatka** — koja kombinacija trajanja × jedinice dodjele = rad ostaje fiksna kad se jedna od tri vrijednosti promijeni. Izbori: *Standard projekta (Fiksno trajanje i fiksne jedinice)*, *Fiksno trajanje i fiksne jedinice*, *Fiksno trajanje i fiksni rad*, *Fiksni rad* i *Fiksne jedinice*. Zadano: standard projekta. Ikona *i* pored polja objašnjava vrstu zadatka koja sada vrijedi; u otvorenom padajućem izborniku svaka opcija ima takvu ikonu. Za zadatak iz programa MS Project to objašnjenje uzima u obzir spremljenu postavku vođeno radom. Vidljivo samo kad je uključeno *Koristi vrste zadataka* (*Postavke aplikacije*, kartica *Raspored*, naslov *Izračunavanje*) ili kad sama datoteka sadrži vrste zadataka ili spremljeni rad, i samo za običan zadatak: ne za zadatak sažetka, kontrolnu točku, hamak ni zadatak u proteklom vremenu. Pogledajte [Vrste zadataka: trajanje, jedinice i rad](docs://uitleg-werkregels).

## Hamak

- **Hamak (izvedeno trajanje)** — trajanje slijedi iz dva druga zadatka umjesto da ima vlastito. Zadano: isključeno. Samo za običan zadatak, dakle ne za kontrolnu točku ni zadatak sažetka. Uključeno: *Odlučujuća ovisnost početka* prikazuje prethodnike s ovisnošću završetak-početak ili početak-početak, *Odlučujuća ovisnost završetka* one s ovisnošću završetak-završetak ili početak-završetak, a iza svakog je vrsta ovisnosti. Ako nemate odlučujuću ovisnost završetka, piše *Nema odlučujuće ovisnosti završetka (FF/SF) — raspon se svodi na nultu duljinu.* i trajanje je nula. Pogledajte [Izrada hamaka](docs://howto-hammock).

## Ograničenje i rok za dovršetak

Kod zadatka sažetka ograničenje ili rok za dovršetak nema učinka: izračun obuhvaća samo krajnje zadatke (zadatke bez podzadataka) i datume zadatka sažetka izvodi iz njegovih podzadataka.

- **Ograničenje** — granica datuma za zadatak. Izbori: *Što prije moguće (ASAP)*, *Što kasnije moguće (ALAP)*, *Ne početi prije (SNET)*, *Ne početi kasnije od (SNLT)*, *Ne završiti prije (FNET)*, *Ne završiti kasnije od (FNLT)*, *Mora započeti na (MSO)* i *Mora završiti na (MFO)*. Zadano: *ASAP*, što znači da nema ograničenja. Ako odaberete ASAP, nestaju sva ograničenja zadatka; ako odaberete ALAP, nestaje sekundarno ograničenje. Učinak nakon *Izračunaj*: granica pomiče zadatak ili čini vremensku rezervu negativnom. Pogledajte [Ograničenja i rokovi](docs://uitleg-constraints).
- **Datum ograničenja** — datum koji pripada ograničenju. Vidljivo za svako ograničenje osim za *ALAP*. Obavezno polje; novo ograničenje dobiva datum planiranog početka.
- **Obvezno (logika fiksiranja)** — samo za *MSO* i *MFO*. Zadano: isključeno. Uključeno: datum je tvrd, nadjačava ovisnosti i fiksira traku čak i prije njezinih prethodnika. Kršenje postaje negativna vremenska rezerva uzvodno. Kad ga prvi put uključite, jednom se pojavi objašnjenje.
- **Sekundarno ograničenje** i **Sekundarni datum** — druga granica, samo jedna od *SNET*, *FNET*, *SNLT* ili *FNLT* (ili *(nema)*). Vidljivo čim postoji primarno ograničenje koje nije ASAP, ALAP ni tvrdo fiksiranje. Uvijek meko. Nedopuštena kombinacija dobije crveni okvir i razlog: sekundarno ograničenje ne smije biti tvrdo, ne smije uz MSO/MFO ili tvrdo fiksiranje, ne smije uz ASAP/ALAP, mora biti gornja ili donja granica, a primarno i sekundarno ne smiju graničiti istu stranu. Ispravan par je, na primjer, SNET uz FNLT.
- **Rok za dovršetak** — ciljni datum za završetak. Prazno = nema roka. Učinak: zadatak se zbog njega ne pomiče. Ako je najraniji završetak kasniji, vremenska rezerva postaje negativna i aplikacija javlja *Rok … propušten — najraniji završetak …*.

## Napredak

- **Napredak (%)** — klizač od 0 do 100. Zadano: 0. Učinak: iznad 0 aplikacija dopunjuje nedostajući *Stvarni početak*, a 100 dopunjuje *Stvarni završetak*. Status slijedi: *Nije započeto* bez stvarnog početka, *U tijeku* sa stvarnim početkom i *Dovršeno* sa stvarnim završetkom. Preostalo trajanje (*Preostalo*) jednako je trajanju × (1 − napredak), zaokruženo na cijele dane za zadatak u danima i na cijele minute za zadatak u satima. Obavljeni rad mjeri se do datuma stanja; ako datum stanja još nije postavljen, aplikacija ga postavlja na danas i to javlja. Za zadatak sažetka polje je onemogućeno: njegov napredak slijedi iz podzadataka nakon *Izračunaj* (*Izvedeno iz podzadataka: promijenite napredak tamo. Zadatak sažetka slijedi nakon izračunavanja (F5).*).
- **Stvarni početak** — datum kad je zadatak stvarno počeo. Datum nakon datuma stanja se odbija. U tablici zadataka i kod pitanja *Unesite stvarni početak* odbija se i datum nakon stvarnog završetka. Ako je zadatak planiran da počne tek nakon datuma stanja, a sada dobiva napredak, prozor pita *Unesite stvarni početak*. Za kontrolnu točku postoji jedno polje *Stvarni datum* umjesto *Stvarni početak* i *Stvarni završetak*.
- **Stvarni završetak** — datum kad je zadatak stvarno dovršen. Kad ga upišete, napredak se postavlja na 100, a status na *Dovršeno*. Kad ga obrišete, napredak se vraća na 0, a status na *U tijeku*. Datum nakon datuma stanja se odbija, kao i kod *Stvarni početak*.
- **Preostalo** — samo za čitanje (ne za kontrolnu točku): koliko trajanja još ostaje, u jedinici zadatka.

Prozor primjenjuje ta pravila na nacrt; vrijede tek nakon *Spremi*. Pogledajte [Napredak, datum stanja i temeljni plan](docs://uitleg-voortgang).

## CPM rezultat

- **CPM rezultat** — samo za čitanje: prikaz zadnjeg izračuna: *Najraniji početak*, *Najraniji završetak*, *Kasni početak*, *Kasni završetak*, *Ukupan slobodni hod*, *Slobodni hod*, *Ometajuća vremenska rezerva* i *Kritični put* (*Da* ili *Ne*). Vremenska rezerva je u radnim danima, s dvije decimale. Zastarjelo ili još nije izračunato? Pritisnite *Izračunaj*.

## Ovisnosti

- **Ovisnosti** — ovisnosti ovog zadatka, jedan redak po ovisnosti: povezani zadatak (u oknu WBS šifra, ili naziv ako nedostaje; u prozoru naziv), ikona munje ako je ovisnost odlučujuća (*Odlučujuća ovisnost*, nakon izračuna), vrsta ovisnosti (*FS*, *SS*, *FF* ili *SF*), vrijeme odgode i kanta. U oknu je WBS šifra gumb: kad na nju pokažete, prikazuje se zadatak, a klikom skačete na njega. Mala oznaka ispred šifre pokazuje ulogu: zlatna okrugla oznaka za prethodnika i ljubičasta kvadratna za nasljednika, iste boje kao u [Praćenje puta](docs://howto-pad-traceren). Uloga je i u nazivu gumba, za čitač zaslona. U prozoru je to običan tekst, a odjeljak vidite samo ako zadatak ima ovisnosti.
- **Vrijeme odgode** — upišite broj s jedinicom: `2d` radni dani, `3ed` kalendarski dani, `2u` ili `2h` radni sati, `3eu` ili `3eh` kalendarski sati, `50%` postotak trajanja prethodnika, `-25e%` postotak u kalendarskom vremenu. Minus ga pretvara u vrijeme preklapanja. Bez jedinice broji se kao radni dani. Neispravan unos oboji polje crveno, a vrijednost se vraća. Pogledajte [Ovisnosti i vrijeme odgode](docs://uitleg-relaties).
- **Dodaj ovisnost** (samo u oknu) — otvara nacrt retka. Pod *Smjer* odaberite *Prethodnik* ili *Nasljednik*, pronađite zadatak s *Traži zadatak…* po WBS šifri ili nazivu, odaberite vrstu i vrijeme odgode te potvrdite s *Spremi ovisnost* (ili *Odustani*). Dupla ovisnost ili ovisnost s vlastitim nadređenim zadatkom odbija se s porukom, a redak ostaje.

## Prekidi

Samo u oknu i ne za kontrolnu točku, zadatak sažetka, hamak, zadatak u proteklom vremenu, ručno planiran zadatak ili zadatak koji je prekratak za prekid.

- **Prekidi** — prekidi u radu zadatka. Jedan redak za svaki prekid: *nakon* (koliko rada je prije prekida), *prekid* (duljina) i jedinica (*radni dani*, a za zadatak u satima *sati*), s datumima od–do dijela koji slijedi ispod. Prekid nastao uravnoteživanjem nosi oznaku *uravnoteživanje*. Prekid duljine 0 se uklanja. Ikona za brisanje u svakom retku (*Ukloni prekid*) ga također uklanja. Učinak: traka se crta prekinuto, a nakon *Izračunaj* završetak se pomakne za duljinu prekida.
- **Dodaj prekid** — dodaje prekid od jedne jedinice u sredini najdužeg dijela. Isključeno kad za prekid nema mjesta.
- **Ukloni sve prekide** — prikazuje se kad prekidi dolaze iz izvorne datoteke u obliku koji se ovdje ne može uređivati (*Ovi prekidi dolaze iz izvorne datoteke u obliku koji se ovdje ne može uređivati.*). Tada vidite samo datume.

Pogledajte [Podjela zadatka](docs://howto-taak-splitsen).

## Dodjele

- **Dodjele** — resursi na ovom zadatku. Svaki resurs je u jednom retku: strelica, mali kvadrat u boji resursa, naziv, *Jedinice dodjele*, *Rad (h)* i kanta (*Ukloni*). Zaglavlje iznad redaka imenuje stupce. Kliknite na naziv da prikažete *Krivulja*, gumb *Raspodijeli sate…* i *Premjesti na…* ispod njega. Ponovno kliknite da ih sakrijete. Ako dodjela ima krivulju drugačiju od *Ujednačeno* ili vlastitu raspodjelu sati, uz naziv se prikazuje ikona stupića, i kad su detalji sakriveni. Na dnu je popis *Dodijeli resurs*; on dodjeljuje resurs s 1 jedinicom dodjele dnevno. Bez resursa piše *Najprije stvorite resurse (kartica Resursi).*; kad su svi dodijeljeni, piše *Svi su resursi već dodijeljeni.* Za kontrolnu točku ili zadatak sažetka piše da dodjela nije moguća.
- **Jedinice dodjele** — koliko resursa zadatak koristi po danu, broj veći od 0. Polje prikazuje najviše dva decimalna mjesta; točna vrijednost je u savjetu. Možete upisati zarez ili točku. Učinak: opterećenje u histogramu i preopterećenje resursa, a uz vrstu zadatka i rad. Ako dodjela dolazi iz programa Primavera P6 (`.xer` ili P6 XML) i još ostaje rad, ovo je preostala stopa (*Remaining Units/Time* u P6). Planirana stopa ostaje spremljena u stupcu tablice *Planirane jedinice dodjele po danu*.
- **Rad (h)** — preostali posao u satima za ovaj resurs. Vidljivo je samo kad su vrste zadataka vidljive i zadatak ima vrstu zadatka. Za materijal je prikazana crtica. Katanac u zaglavlju pokazuje koji kut trokuta vrsta zadatka štiti (*Zaštićeno vrstom zadatka …*). Upozoravajući trokut u polju (*Odstupa od jedinica dodjele × trajanja*) znači da spremljeni rad nije jednak jedinicama dodjele × preostalom trajanju. Histogram tada slijedi spremljeni rad.
- **Krivulja** — kako se rad raspoređuje kroz trajanje: *Ujednačeno*, *Opterećeno na početku*, *Opterećeno na završetku*, *Zvonasto*, *Rani vrh*, *Kasni vrh*, *Dvostruki vrh* ili *Kornjača*. Zadano: *Ujednačeno*. Ako dodjela ima vlastitu raspodjelu sati, piše *Obris* i popis je onemogućen; uvezena krivulja zove se *Uvezena krivulja*.
- **Raspodijeli sate…** — otvara raspodjelu sati po radnom danu za ovu dodjelu. Pogledajte [Prilagođavanje raspodjele sati](docs://howto-urenverdeling-aanpassen).
- **Premjesti na…** — premješta dodjelu na drugi zadatak najniže razine koji resurs još nema. Vidljivo je samo kad takav zadatak postoji.

## Šifre i polja

- **Šifre i polja** — vidljivo je samo kad projekt ima šifre zadataka ili prilagođena polja. Svaka šifra zadatka je popis s *(nema)* i vrijednostima u obliku `šifra — opis`. Za svaku vrstu birete najviše jednu vrijednost. Svako prilagođeno polje ima unos koji odgovara njegovoj vrsti: *Tekst*, *Broj*, *Cijeli broj*, *Trošak*, *Datum* ili *Da/ne*. Učinak: nema utjecaja na izračun. Po njima možete grupirati i filtrirati te ih prikazati kao stupce. Pogledajte [Šifre i prilagođena polja](docs://howto-codes-en-velden).

## Oznake pod vrstom zadatka

Samo u oknu i samo kad se primjenjuju.

- **Dugo neradno razdoblje** — *Ovaj zadatak prelazi neradno razdoblje od … dana (… do …).*, ili s dodanim nazivom praznika ili građevinskog odmora. Pojavljuje se kad zadatak prelazi neprekinuto razdoblje od 8 dana ili više koje sadrži barem jedan praznik. To je upozorenje, a ne odbijanje. Provjerite je li raspored tako namjeren.
- **Oznaka MS Projecta** — okvir *Slijedi raspodjelu sati iz MS Projecta*, *Datumski prozor MS Projecta više nije primijenjen nakon uređivanja — …* ili *Vlastita raspodjela sati*, s *Pročitaj više*. Pokazuje je li raspodjela sati iz datoteke MS Projecta još ona koja upravlja datumima.
- **Zabilježeni datumi** — okvir na vrhu odjeljka *Vrijeme*, izravno iznad *Početak*, dok aplikacija prikazuje datume iz datoteke. Narančasto: *Vidite datume koji su bili u datoteci, a ne izračun aplikacije.* (za datoteku Primavera *Vidite datume koje je Primavera spremila, a ne izračun aplikacije.*), s *Ponovno izračunavanje mijenja ovaj zadatak.* ili *Ponovno izračunavanje ovaj zadatak ne mijenja.* ispod. Ako datoteka ne sadrži sve za ovaj zadatak, slijedi treći redak s nedostajućim vrijednostima: *Datoteka ne sadrži sve za ovaj zadatak. Nedostaje: …* (za Primaveru *Primavera nije spremila sve za ovaj zadatak. Nedostaje: …*). Okvir ostaje narančast. S *Pročitaj više*. Pogledajte [Datumi kako su zabilježeni](docs://uitleg-datums-zoals-opgeslagen).

## Zaglavlje i podnožje okna

- **Izbriši zadatak** — ikona za brisanje pored naslova *Zadatak*. Briše ovaj zadatak zajedno s njegovim podzadacima, kao jedan korak pod *Poništi*. Raspored je nakon toga zastario, dok ne pritisnete *Izračunaj*.
- **Izračunaj** — gumb na dnu. Isti izračun kao *Početna › Raspored › Izračunaj*.

## Što ovdje ne nalazite

- **Prioritet uravnoteživanja** — nije u prozoru ni u oknu. Postavljate ga desnim klikom i odabirom *Prioritet* (*Nizak* = 100, *Normalan* = 500, *Visok* = 900) ili upisivanjem broja od 0 do 1000 u stupac *Prioritet uravnoteživanja*. Zadano: 500. Učinak: uravnoteživanje prvo ostavlja zadatke višeg prioriteta na njihovim datumima. Vrijednost 1000 zaključava zadatak, pa ga uravnoteživanje nikad ne pomiče. Pogledajte [Uravnoteživanje](docs://uitleg-nivelleren).
- **Ostali podaci zadatka** — ostalo što zadatak nosi, kao stupci *Ručno planiran*, *Boja* i tehnički stupci, nalazi se samo u tablici. Pogledajte [Stupci tablice](docs://ref-tabelkolommen).
