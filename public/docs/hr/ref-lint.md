# De vrpca, kartica po kartica

Vrpca na vrhu zaslona ima kartice, a svaka kartica ima grupe gumba. Ovaj članak kaže, za svaki gumb, što gumb radi i gdje vidite rezultat. Kako posao obaviti korak po korak, opisano je u uputama. Ovdje tražite što je pojedini gumb. Gumb koji postoji ili radi samo pod nekim uvjetom ima taj uvjet uz sebe.

## Kako se vrpca ponaša

- **Kartice** — *Datoteka* je lijevo, zatim *Početna*, *Raspored*, *Resursi*, *Prikaz*, *Postavke*, *Tablica*, *IFC*, *Izvješće* i, samo kad je uključen AI-način rada, *AI*.
- **Uski prozor** — kada vrpca ne stane, gumbi se od desna nalijevo smanjuju na ikonu. Naziv je tada u opisu gumba. Svaki gumb bez vlastitog opisa prikazuje svoj naziv.
- **Sažmi vrpcu** — mala strelica dolje desno na vrpci pretvara je u ravnu traku samo s ikonama. Grupe *Temeljni planovi i napredak* i *Povezivanje* na kartici AI tada nestaju iza jednog gumba sa skočnim prozorom. Zadano: prošireno. Vaš izbor se pamti.
- **Gumbi proširenja** — proširenje može dodati vlastitu grupu na kraj kartice. Takav gumb radi ono što mu je proširenje dalo.

## Datoteka

Klikom na *Datoteka* otvara se vlastiti zaslon (Backstage) koji preuzima radni prostor. Taj zaslon nema vrpcu. *Natrag* ga zatvara. Ako ste nešto promijenili u odjeljku *Podaci o projektu* i to niste primijenili, aplikacija vas prvo pita što s time učiniti.

- **Novo** — otvara prozor *Novi projekt* i zatvara Backstage. Polja su opisana u [Novi projekt i Podaci o projektu](docs://ref-projectinfo).
- **Otvori** — odabire datoteku i otvara je kao dokument. Zatvara Backstage.
- **Nedavno** — popis nedavno otvorenih projekata; klik na stavku otvara projekt. Vidljivo samo kada okruženje može ponovno otvoriti datoteke: u aplikaciji za računalo i u preglednicima koji nude pristup datotekama, kao što su Chrome i Edge. U drugim preglednicima gumb postoji, ali stranica ostaje prazna.
- **Primjeri** — ugrađeni primjeri rasporeda, podijeljeni na *Potpuni prikazni rasporedi* (oznaka *Sve funkcije*) i *Jednostavni primjeri*. Klik otvara jedan u novoj kartici.
- **Spremi** — zapisuje projekt u datoteku ovog dokumenta. Ako dokument još nema datoteku, prvo odaberete naziv i mjesto. Datoteku koju ste otvorili u drugom formatu osim IFC-a nikad se ne prepisuje; tada *Spremi* traži naziv i mjesto za IFC datoteku.
- **Spremi kao** — odabire novi naziv ili mjesto i sprema ondje kao IFC.
- **Izvoz** — kartice po formatu izvoza, s opisom. Klik pretvara projekt i sprema ga te vas vraća na *Početna*. Ako raspored ima ciklus, greška se prikazuje u Backstageu i ostajete tu. Ako je projekt povezan s bibliotekom resursa, ispod se pojavljuje potvrdni okvir *Spremi i datoteku biblioteke*; radi samo za karticu IFC.
- **Uvoz** — na vrhu kartica *Ažuriraj napredak iz tablice* (onemogućeno bez zadataka), ispod nje uvoznici koje dodaju proširenja.
- **Ispis** — gumb *Otvori pregled ispisa* vodi vas na karticu *Izvješće*.
- **Podaci o projektu** — metapodaci i profil izračuna ovog projekta. Promjene stupaju na snagu tek nakon *Primijeni*. Pogledajte [Novi projekt i Podaci o projektu](docs://ref-projectinfo) i [Profili izračuna i pravila izračuna](docs://uitleg-rekenprofielen).
- **Postavke** — iste postavke kao u prozoru *Postavke*.
- **Proširenja** — upravljanje i instalacija proširenja; pogledajte [Instaliranje i upravljanje proširenjem](docs://howto-extensie-installeren).
- **Biblioteka** — upravljanje bibliotekama resursa; pogledajte [Upravljanje bibliotekama resursa i njihovo dijeljenje](docs://howto-bibliotheken-beheren).
- **Pomoć** — ugrađena dokumentacija, također s tipkom F1. Polje za pretraživanje traži naslove, podnaslove i sam tekst. Članci su u četiri odjeljka: *Lekcije*, *Upute*, *Objašnjenje* i *Referenca*. U odjeljku *Jezik dokumentacije* birate *Prati jezik aplikacije*, *Nederlands* ili *English*. Pomoć postoji samo na nizozemskom i engleskom: ako je aplikacija na nekom drugom jeziku, čitate englesku verziju, uz napomenu. Izbor se pamti na ovom uređaju, odvojeno od jezika aplikacije. Pomoć možete otvoriti i iz prozora ili okna: mnogi prozori i okna *Svojstva*, *Resursi* i *Upozorenja* imaju upitnik gore desno (*Otvori pomoć za ovaj dio*), koji otvara Pomoć o članku za taj prozor ili okno. Ako ste u prozoru unijeli nešto što još nije spremljeno, aplikacija prvo pita: *Spremi*, *Odustani* (odbacuje unos) ili *Natrag* (ostajete u prozoru). Zatim se prozor zatvara i otvara se Pomoć. Nekoliko prozora, kao *Uredi zadatak* i *Uravnoteživanje resursa*, uvijek pita. Bez unosa se Pomoć odmah otvara.
- **Pokreni obilazak** — zatvara Backstage i pokreće obilazak od koraka 1.
- **Zatvori projekt** — zatvara aktivni dokument. Ima li nespremljene promjene, aplikacija traži potvrdu.

## Početna

### Početna › Datoteka

- **Novo**, **Spremi**, **Otvori** i **Spremi kao** — iste radnje kao u odjeljku *Datoteka*.
- **Nedavno** — padajući izbornik s nedavnim projektima; klik otvara jedan. Vidljiv samo pod istim uvjetom kao *Datoteka › Nedavno*. Bez nedavnih datoteka piše *Nema nedavnih datoteka*.
- **Izvoz** — padajući izbornik s formatima izvoza (kratki nazivi). Klik pretvara projekt i ga sprema.

### Početna › Uređivanje

- **Poništi** — poništava posljednju promjenu. Onemogućeno kada nema što poništiti.
- **Ponovi** — vraća posljednju poništenu promjenu. Onemogućeno kada nema što ponoviti.
- **Izbriši** — briše odabrane zadatke zajedno s njihovim podzadacima, u jednom koraku. Onemogućeno bez odabira.

### Početna › Zadaci

- **Zadatak** — dodaje zadatak pod nazivom *Novi zadatak*, s trajanjem od 5 radnih dana, s početkom na datumu početka projekta. (Ako je *Uključi planiranje u satima* uključeno i *Zadana jedinica za nove zadatke* u odjeljku *Podaci o projektu* je sati, trajanje je 5 sati.) Ako je zadatak odabran i prikaz je obični prikaz stabla, novi zadatak dolazi odmah ispod najnižeg odabranog zadatka (opis: *Novi zadatak odmah ispod odabira*). Bez odabira dolazi na dno (opis: *Novi zadatak na dnu popisa*). S odabirom, ali dok filtrirate, grupirate ili sortirate, također dolazi na dno, a traka ispod vrpce prikazuje *Nije dostupno tijekom filtriranja, grupiranja ili sortiranja*. Novi zadatak postaje jedini odabir, Gantt se pomakne do njega, a naziv možete odmah prepisati u oknu *Svojstva*.
- **Kontrolna točka ▾** — padajući izbornik koji stavlja kontrolnu točku (trajanje 0) na isto mjesto kao *Zadatak*. *Početna kontrolna točka* i *Završna kontrolna točka* određuju vrstu kontrolne točke; nova kontrolna točka dobiva naziv *Nova kontrolna točka* i vrstu zadatka *Ostalo*. *Inspekcijska točka (obvezna)* stvara završnu kontrolnu točku s vrstom zadatka *Inspekcija* i oznakom *Obvezno (ugovorno)*, s nazivom *Nova inspekcijska točka*.
- **Poveži ▾** — padajući izbornik s četiri fiksne radnje; glavni gumb nikad ne mijenja značenje. Pogledajte *Raspored › Ovisnosti* za te četiri radnje.
- **Podijeli zadatak** — uključuje ili isključuje način podjele. Uključeno: traka ispod vrpce objašnjava da kliknete na traku na mjestu gdje počinje prekid i da povučete udesno, za njegovu duljinu. Onemogućeno kada Gantt nije vidljiv (na karticama *Tablica*, *IFC* i *Izvješće* te pod punim oknom resursa); opis tada kaže *Dostupno samo kada je Gantt prikaz vidljiv*. Pogledajte [Podjela zadatka](docs://howto-taak-splitsen).

### Početna › Izračun

- **Izračunaj** — izračunava raspored: datume, vremensku rezervu, kritični put i opterećenje resursa. To se nikad ne događa samo od sebe, osim ako uključite *Automatsko izračunavanje* (*Postavke*, kartica *Raspored*, naslov *Izračunavanje*). Dok raspored nije ažuran, traka stanja prikazuje *Zastarjelo — ponovno izračunajte (F5)*.

### Početna › Zumiranje

- **Uvećaj +** — uvećava vremensku os za 10 piksela po danu.
- **Umanji -** — umanjuje vremensku os za 10 piksela po danu.

## Raspored

### Raspored › Izračun

Gumb *Izračunaj* je isti kao na kartici *Početna*.

- **Premjesti projekt…** — otvara prozor *Premjesti projekt*. Onemogućeno bez datuma početka projekta. Pogledajte [Premještanje projekta](docs://howto-project-verplaatsen).
- **Upozorenja** — prikazuje ili skriva okno *Upozorenja* u desnom stupcu. Gumb svijetli dok vidite okno. Uključivanje proširuje sažeti stupac. Što se u njemu nalazi, opisano je u [Obavijesti i upozorenja](docs://ref-meldingen).

### Raspored › Ovisnosti

Grupa ima gumb *Poveži ▾* s četiri radnje i gumb *Podijeli zadatak* (isti kao na kartici *Početna*). Te četiri radnje:

- **Nacrtaj ovisnost** — uključuje ili isključuje način povezivanja; kad je uključen, pojavljuje se kvačica i glavni gumb svijetli. Uključeno: povlačite s jedne trake na drugu u Ganttu da biste stvorili ovisnost, a traka ispod vrpce kaže kako zaustaviti (*Zaustavi* ili Esc). Onemogućeno kada Gantt nije vidljiv.
- **Poveži odabrane zadatke** — stvara ovisnost završetak-početak bez vremena odgode između dva zadatka; prvi odabrani postaje prethodnik. Dostupno samo uz točno dva odabrana zadatka (inače *Odaberite točno dva zadatka*). Dvostruka ovisnost ili ciklus odbijaju se uz poruku.
- **Dodaj međuzavisnost projekata…** — otvara prozor za dodavanje prethodnika ili nasljednika iz druge datoteke projekta odabranom zadatku. Dostupno samo uz točno jedan odabrani zadatak (inače *Odaberite točno jedan zadatak*).
- **Osvježi sve međuzavisnosti projekata** — osvježava sidra svih međuzavisnosti projekata i u izborniku javlja koliko ih je ažurirano ili nedostaje. Dostupno samo kada projekt ima međuzavisnosti projekata (inače *Ovaj projekt nema međuzavisnosti projekata*).

Za razloge iza ovisnosti pogledajte [Stvaranje ovisnosti](docs://howto-relaties-leggen) i [Ovisnosti i vrijeme odgode](docs://uitleg-relaties).

### Raspored › Praćenje puta

- **Prethodnici** — ističe u Ganttu prethodnike odabranih zadataka, lanac po lanac.
- **Nasljednici** — ističe nasljednike odabranih zadataka.

Možete uključiti oba istodobno; ponovni klik na gumb isključuje tu stranu. Odlučujuće ovisnosti dobivaju jaču nijansu. Pogledajte [Praćenje puta](docs://howto-pad-traceren).

### Raspored › Kalendar

- **Kalendar** — otvara prozor *Kalendari* s bibliotekom kalendara projekta. Pogledajte [Prozori kalendara](docs://ref-kalenders).

### Raspored › Struktura

- **Šifre i polja** — otvara prozor *Šifre i polja* za šifre zadatka i prilagođena polja. Pogledajte [Šifre i prilagođena polja](docs://howto-codes-en-velden).
- **WBS auto** — uključuje ili isključuje automatsko numeriranje WBS šifri. Zadano: isključeno. Uključeno: cijelo stablo se odjednom ponovno numerira, šifre zatim prate svaku promjenu strukture, a polje *WBS šifra* u oknu i u dijaloškom okviru je onemogućeno.
- **Ponovno numeriraj WBS** — jednom ponovno numerira WBS šifre prema položaju u stablu (1.2.3). Onemogućeno dok je *WBS auto* uključen.
- **Predlošci** — padajući izbornik sa spremljenim WBS predlošcima, svaki s brojem zadataka i ovisnosti. Klik umeće predložak ispod odabranog zadatka ili na najvišu razinu bez odabira. Ikona kante briše predložak. Bez predložaka piše kako spremiti jedan (desnom tipkom na zadatak sažetka, *Spremi granu kao predložak*). Pogledajte [Spremanje i umetanje WBS predložaka](docs://howto-wbs-sjablonen).
- **Uvući** — pretvara odabrane zadatke u podzadatke zadatka ispred njih. Onemogućeno bez odabira i čim filtrirate, grupirate ili sortirate; opis tada kaže *Nije dostupno tijekom filtriranja, grupiranja ili sortiranja*.
- **Pomaknuti na višu razinu** — pomiče odabrane zadatke za jednu razinu više, odmah iza njihovog trenutačnog nadređenog zadatka. Isti uvjeti kao za *Uvući*.

### Raspored › Temeljni planovi i napredak

- **Upravljaj temeljnim planovima…** — otvara prozor za temeljne planove. Pogledajte [Spremanje i upravljanje temeljnim planom](docs://howto-baseline-opslaan-en-beheren).
- **Datum stanja** — datum do kojeg mjerite napredak. Upišite datum; križić (*Ukloni datum stanja*) ga uklanja. Učinak: napredak se mjeri do tog datuma, a crta datuma stanja i linija napretka u Ganttu nalaze se na tom datumu. Pogledajte [Napredak, datum stanja i temeljni plan](docs://uitleg-voortgang).
- **Način praćenja napretka** — izbor između *Retained Logic* i *Progress Override*. Zadano: *Retained Logic*. Učinak: uz *Retained Logic* preostali posao započetog nasljednika slijedi ovisnost; uz *Progress Override* preostali posao počinje na datumu stanja, bez čekanja na prethodnika. Pogledajte [Odabir načina praćenja napretka](docs://howto-voortgangsmodus-kiezen).

U sažetoj vrpci ova tri nalaze se iza jednog gumba sa zastavicom pod nazivom *Temeljni planovi i napredak*.

### Raspored › Napredak

- **Izvezi tablicu napretka** — stvara `.xlsx` tablicu sa zadacima, za unos napretka izvan aplikacije. Onemogućeno bez zadataka.
- **Ažuriraj napredak iz tablice** — otvara prozor za uvoz vraćene tablice. Onemogućeno bez zadataka. Pogledajte [Uvoz napretka iz tablice](docs://howto-voortgang-importeren).

Ova grupa je i na karticama *Tablica* i *Izvješće*.

## Resursi

### Resursi › Upravljanje

- **Resursi** — otvara puno okno resursa; ono preuzima radni prostor. Svijetli dok vidite to okno. Pogledajte [Okno resursa](docs://ref-resourcepaneel).
- **Pričvrsti okno resursa** — pričvršćuje kompaktno okno resursa u desni stupac, pored Gantt prikaza. Svijetli dok je pričvršćeno okno vidljivo; drugi klik ga zatvara. Pričvršćeno okno prikazuje samo naziv, boju, upozorenje o preopterećenju i *Maksimalan postotak jedinica*, a uz odabir zadataka samo resurse tih zadataka.
- **Novi resurs** — otvara puno okno resursa s praznim redom nacrta za novi resurs. Ništa se ne stvara dok ne unesete naziv. Ako kliknete izvan njega, ništa ne ostaje. Resurs ide u biblioteku ili u projekt, ovisno o prikazu.

### Resursi › Dodjela

- **Dodijeli ▾** — dodjeljuje resurs odabranom zadatku. Dostupno samo uz točno jedan odabrani zadatak koji je bez podzadataka i nije kontrolna točka; inače je gumb siv. U izborniku prvo postavite *Jed./dan* (zadano 1) i *Krivulja* (zadano *Ujednačeno*); klik na resurs dodjeljuje ga s tim vrijednostima. Izbornik prikazuje samo resurse koji još nisu dodijeljeni zadatku. Pogledajte [Dodjela resursa s krivuljom](docs://howto-resource-toewijzen).

### Resursi › Histogram

- **Histogram** — prikazuje ili skriva traku histograma ispod Gantta. Zadano: isključeno. Vaš izbor se pamti.
- **Prethodni** i **Sljedeći** — koračaju kroz resurse u biraču trake histograma, s *Svi resursi* kao dodatnim korakom u krugu. Onemogućeno kada je histogram isključen ili projekt nema resursa.

### Resursi › Uravnoteživanje

- **Uravnoteži…** — otvara prozor *Uravnoteživanje resursa*. Pogledajte [Uravnoteživanje](docs://uitleg-nivelleren).
- **Ukloni uravnoteživanje** — uklanja odgode i prekide koje je uravnoteživanje primijenilo. Onemogućeno kada nijedan zadatak nema rezultat uravnoteživanja.

### Resursi › Preopterećenje

- **Preopterećenje resursa** — nije gumb nego brojač: broj resursa s najmanje jednim preopterećenim danom, ili *Nema*. Crveno je s ikonom upozorenja čim postoji jedan takav. Broj se osvježava nakon *Izračunaj* i nakon promjena resursa i dodjela; ako mijenjate datume zadataka, to se broji tek nakon *Izračunaj*.

## Prikaz

### Prikaz › Vremenska skala

- **Zumiraj +** i **Zumiraj -** — povećavaju ili smanjuju vremensku os za 10 piksela po danu.
- **Vrati** — vraća zumiranje na zadanih 30 piksela po danu.
- **Prilagodi projektu** — zumira i pomiče prikaz tako da cijeli projekt stane u vidljivo područje.
- **Izbor vremenske skale** — popis s *Godina*, *Kvartal*, *Mjesec*, *Tjedan*, *Dan* i, samo kad je *Uključi planiranje u satima* uključeno, *Sat*. Izbor postavlja fiksno zumiranje. Prikazana vrijednost prati trenutačno zumiranje, a ispod nje prikazano je to zumiranje u pikselima po danu.

### Prikaz › Prikazivanje

- **Stupci…**, **Filtar…**, **Grupiranje…** i **Sortiranje…** — vidljivo samo kad je uključeno *Prikaži klasične gumbe prikaza* (*Postavke*, kartica *Napredno*, naslov *Zastarjele funkcije*). Zadano: isključeno. *Stupci…* vodi na karticu *Tablica* i ondje otvara izbornik stupaca. *Filtar…* odmah otvara prozor filtra, sve dok nema spremljenog filtra. Sa spremljenim filtrima otvara izbornik s *Filtar…*, *Obriši* (samo kad je filtar aktivan) i spremljenim filtrima. *Grupiranje…* dopušta dvije razine. *Sortiranje…* dopušta više razina. Gumb svijetli kad je ta postavka prikaza aktivna. U trenutačnoj vrpci to radite gumbima izgleda; pogledajte [Stvaranje i korištenje izgleda](docs://howto-layouts-gebruiken).

### Prikaz › Struktura

- **Sažmi** — sažima odabrane zadatke sažetka; bez odabira sažima sve njih. U grupiranom prikazu sažima sve grupe, a odabir nema učinka.
- **Proširi** — obrnuto.

### Prikaz › Izgled

- **Gumbi izgleda** — svaki izgled je prekidač s ikonom i nazivom. *Dijagram resursa* je ugrađen. Jedan klik uključuje izgled, a drugi klik ga isključuje i vraća prikaz kakav je bio prije klika. Izgledi s različitim dijelovima mogu biti uključeni istodobno. Desnom tipkom miša kliknite izgled: *Uredi…*, *Dupliciraj* i *Izbriši* (nakon potvrde). Ugrađeni izgled može se samo duplicirati.
- **Novi izgled** — otvara prozor izgleda za novi izgled.

### Prikaz › Prezentacija

- **Prezentacija** — uključuje ili isključuje način prezentacije (za zaustavljanje pritisnite F11 ili Esc): samo Gantt ispunjava zaslon. Pogledajte [Prezentiranje na velikom zaslonu](docs://howto-presentatie).
- **Podijeljeni prikaz** — dijeli Gantt na dva dijela koji oba počinju s vašim trenutačnim zumiranjem i položajem (podjela 50 posto), ili ga ponovno spaja u jedan. Zadano: isključeno. Pogledajte [Korištenje podijeljenog prikaza i mini-karte](docs://howto-split-view-en-mini-map).
- **Mini-karta** — prikazuje ili skriva mini-kartu. Zadano: isključeno. Vaš izbor se pamti.

### Prikaz › Okna

- **Svojstva** — prikazuje ili skriva okno *Svojstva* u desnom stupcu. Zadano: uključeno. Pogledajte [Dijalog zadatka i okno svojstava](docs://ref-taak-eigenschappen).

Gumbi *Resursi*, *Usidrenje resursa* i *Histogram* isti su kao na kartici *Resursi*, a *Upozorenja* isto je kao na kartici *Raspored*.

### Prikaz › Temeljni planovi i napredak

Ova grupa ima isti naziv kao grupa na kartici *Raspored*, ali sadrži mogućnosti crtanja Gantt-a.

- **Prikaz temeljnog plana** — prikazuje aktivni temeljni plan kao tanku traku ispod svake trake zadatka. Zadano: uključeno. Bez aktivnog temeljnog plana ništa nije vidljivo.
- **Linija napretka** — crta liniju na datumu stanja koja se za svaki zadatak ispupči do njegovog napretka. Zadano: uključeno. Bez datuma stanja ništa nije vidljivo. Kad je linija napretka uključena, ta linija je ujedno oznaka datuma stanja.
- **Linija datuma stanja** — crta isprekidanu liniju na datumu stanja. Zadano: uključeno. Vidite je samo kad je linija napretka isključena, jer tada ona zauzima njezino mjesto. Oznaka s datumom u zaglavlju ostaje dok je barem jedna od dviju linija uključena.
- **Boje traka** — određuje kako se trake boje: *Kritični put* (zadano), *Po zadatku — automatski* ili *Po kategoriji* uz izbor polja. Ako to polje nije u ovom projektu, izbornik kaže da se privremeno koristi *Vrsta zadatka*. Kad nije odabrano *Kritični put*, crveni obrub označava kritični put. Izbor vrijedi i za izvješće.
- **Naglasak resursa** — crta tanku traku u boji resursa ispod svake trake krajnjeg zadatka, podijeljenu razmjerno jedinicama dodjele po danu. Zadano: isključeno.
- **Pojas vremenske rezerve** — crta zeleni pojas iza nekritične trake, do kasnog završetka zadatka. Zadano: uključeno.
- **Linije ovisnosti** — prikazuje ili skriva linije ovisnosti među zadacima. Zadano: uključeno. Izbor pripada dokumentu i izgledu.

## Postavke

### Postavke › Projekt

- **Podaci o projektu** — otvara prozor *Podaci o projektu*: metapodatke projekta i, u odjeljku *Profil izračuna i opcije izračuna*, kako projekt izračunava raspored. Pogledajte [Novi projekt i podaci o projektu](docs://ref-projectinfo).
- **Postavke** — otvara prozor *Postavke* s karticama *Prikaz*, *Raspored* i *Napredno*. Iste postavke nalaze se pod *Datoteka › Postavke*.

### Postavke › Kalendar

Gumb *Kalendar* isti je kao na kartici *Raspored*.

### Postavke › Tipkovnički prečaci

- **Tipkovnički prečaci** — otvara prozor *Tipkovnički prečaci*.

## Tablica

Kartica *Tablica* prikazuje zadatke kao punu tablicu umjesto Gantt-a. Grupe *Datoteka*, *Uredi*, *Zadaci*, *Raspored* i *Praćenje puta* iste su kao na karticama *Početna* i *Raspored* te djeluju na isti odabir. Nema grupe *Zumiranje*, jer zumiranje samo mijenja vremensku skalu Gantt-a. Gumbi *Podijeli zadatak* i *Nacrtaj ovisnost* ovdje su onemogućeni: nema Gantt-a.

### Tablica › Stupci

- **Stupci…** — otvara izbornik stupaca ove tablice. Isti izbornik otvara se plusom u zaglavlju tablice. Opis alata kaže *Odaberite stupce prikaza Tablica*. Pogledajte [Prilagođavanje stupaca tablice](docs://howto-tabelkolommen-aanpassen) i [Stupci tablice](docs://ref-tabelkolommen).

## IFC

Kartica prikazuje IFC okno u radnom prostoru. Vrpca ovdje nema gumbe, samo redak teksta *IFC 4x3 - Industry Foundation Classes*.

## Izvješće

### Izvješće › Izvješće

- **Ispiši** — samo na ovoj kartici, gdje ne radi ništa jer je *Izvješće* već otvoreno. Mogućnosti izvješća nalaze se na zaslonu izvješća.

## AI

Kartica *AI* postoji samo kad je *Omogući AI način rada* uključeno (*Postavke*, kartica *Napredno*, naslov *AI način rada*). Zadano: isključeno. Isključivanjem se kartica uklanja i most se zaustavlja. AI pomoćnik radi s vašim rasporedom preko MCP mosta koji ovdje pokrenete. Pogledajte [Povezivanje AI pomoćnika (MCP)](docs://howto-ai-assistent-koppelen).

### AI › Poslužitelj

- **Pokreni most** i **Zaustavi most** — pokreću ili zaustavljaju MCP most. Pored toga je status: *Isključeno*, *Aktivan na portu …*, *Port … je zauzet* (s razlogom) ili *Greška*. Onemogućeno u web-verziji; opis alata kaže *Most radi samo u desktop-aplikaciji*. Isti status prikazuje se kao točka uz *AI* u traci stanja.

### AI › Spajanje

- **Port** — port mosta. Zadano: 3877. Može se mijenjati samo kad je status *Isključeno* (opis alata *Moguće je mijenjati samo dok je server zaustavljen*.)
- **Token** — lozinka mosta, skrivena. Mali gumbi *Prikaži token*/*Sakrij token*, *Kopiraj* i *Novi token*. *Novi token* prvo traži potvrdu, jer novi token prekida sve postojeće spojeve. Ako je most pokrenut, ponovno se pokreće s novim tokenom.
- **Poveži** — prikazuje podatke o spajanju: krajnju točku, token, isječak konfiguracije i upit za spajanje koji zalijepite u svog AI agenta.

### AI › Sigurnost

- **Pauziraj** / **Nastavi** — privremeno odbija sve promjene koje napravi AI; čitanje ostaje dopušteno, a most ostaje aktivan. Gumb svijetli crveno dok je pauziran.
- **Samo za čitanje** — odbija sve alate koji mijenjaju podatke dok je ovo uključeno.
- **Automatska sigurnosna kopija: uključeno** / **Automatska sigurnosna kopija: isključeno** — automatski zapisuje IFC sigurnosnu kopiju prije prve promjene koju napravi AI, po dokumentu. Zadano: uključeno.
- **Sigurnosno kopiraj sada** — odmah zapisuje sigurnosnu kopiju i javlja naziv datoteke. Samo u desktop-aplikaciji.
- **Otvori mapu sigurnosnih kopija** — otvara mapu sa sigurnosnim kopijama. Samo u desktop-aplikaciji.

### AI › AI zadatak

- **Okno AI zadatka** — prikazuje ili skriva okno *AI zadatak* s pozivima mosta, s njihovim argumentima i odgovorom.
