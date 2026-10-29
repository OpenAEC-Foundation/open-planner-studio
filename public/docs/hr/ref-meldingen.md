# Obavijesti i upozorenja

Aplikacija vas obavještava o stanju na četiri mjesta: na traci stanja na dnu, u oknu *Upozorenja* u desnom stupcu, u obavijestima koje se nakratko pojave na dnu ekrana i u trakama ispod vrpce. Ovaj članak za svako mjesto kaže što vidite, kada se to pojavi i što možete učiniti. Zašto je raspored kritičan ili ima preopterećenje resursa, opisano je u [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad); rješavanje preopterećenja resursa je u [Rješavanje preopterećenja resursa](docs://howto-overbezetting-oplossen); stvaranje ovisnosti je u [Stvaranje ovisnosti](docs://howto-relaties-leggen).

## Razlika među četirima

- **Traka stanja** — fiksni redak s brojačima. Oni potječu iz posljednjeg izračuna i ostaju dok opet ne izračunate.
- **Okno upozorenja** — popis iza tih brojača, sa svime što je pronašao posljednji izračun. Klikom idete na zadatak, ovisnost ili resurs. Popis proizlazi iz posljednjeg izračuna; ništa se ne pohranjuje.
- **Obavijesti** — kratke poruke o nečemu što ste upravo učinili (spremanje nije uspjelo, ovisnost odbijena, uvoz pročitan). Informacija nestane sama, a pogreška ostaje dok je ne zatvorite. Nisu u oknu.
- **Traka ispod vrpce** — obojena traka s objašnjenjem i jednim gumbom. Pripada stanju dokumenta ili načinu rada i ostaje dok to stanje vrijedi. Pogledajte *Trake ispod vrpce*.

## Traka stanja

Traka na dnu prikazuje, s lijeva na desno:

- **Zadaci:** — broj zadataka najniže razine (zadaci sažetka se ne broje).
- **Kontrolne točke:** — broj kontrolnih točaka.
- **Kritični put: N zadataka, N radnih dana** — broj kritičnih zadataka i trajanje projekta. Vidljivo je samo nakon izračuna.
- **Završetak:** — datum završetka projekta iz izračuna. Vidljivo je samo nakon izračuna; prazan projekt nema završetka.
- **N propuštenih rokova za dovršetak**, **N prekršenih ograničenja**, **N napretka izvan redoslijeda** i **N preopterećenih resursa** — svaki je gumb sa znakom upozorenja. Vidljiv je samo kad je brojač veći od 0 i postoji izračun. Klik otvara okno *Upozorenja* (opis: *Otvori okno upozorenja (pojedinosti i navigacija)*). Ako ste na kartici *IFC* ili *Izvješće*, aplikacija istodobno prelazi na karticu *Početna*, jer desni stupac tamo ne postoji. Brojač *N preopterećenih resursa* se osvježava i nakon promjena resursa i dodjela; ostali brojači mijenjaju se tek nakon naredbe *Izračunaj*. Četiri brojača čine samo izbor. Ono što okno dodatno prikazuje nije u traci stanja: skraćeno vrijeme preklapanja, zanemarena ovisnost, hamak bez odlučujuće ovisnosti završetka, ograničen datum završetka i pogreška u rasporedu.
- **Zastario — ponovno izračunajte (F5)** — sa znakom upozorenja (opis: *Raspored je zastario — ponovno izračunajte (F5)*). Vidljivo je čim promijenite nešto što utječe na raspored, a niste ponovno izračunali. Ako je *Automatsko izračunavanje* uključeno, ne pojavljuje se, osim kad je izračun javio pogrešku: tada ostaje vidljivo.
- **Odabir: N zadatak(a)** — broj odabranih zadataka; vidljivo je samo uz odabir.
- **Vremenska skala:** i **Zumiranje: Npx/dan** — vremenska skala vremenske trake i razina zumiranja. Vremenska skala prati zumiranje.
- **Nespremljeno** — dok dokument ima promjene koje nisu u datoteci.
- **AI** — obojena točka s riječju AI, samo kad je AI način rada uključen. Opis kaže *AI most:* uz *Isključeno*, *Aktivno na portu N*, *Port N je zauzet* ili *Greška*. Klik otvara karticu *AI*.
- **Debug-terminal** — gumb terminala, samo kad je debug-terminal uključen; prikazuje ili skriva terminal (*Prikaži debug-terminal* / *Sakrij debug-terminal*).

## Okno upozorenja

- **Otvaranje** — *Raspored › Raspored › Upozorenja*, *Prikaz › Paneli › Upozorenja* ili brojač u traci stanja. Okno je u desnom stupcu, ispod okna *Svojstva* i okna resursa, i proširuje sklopljeni stupac. Zadano je zatvoreno i ne pamti se između sesija. Visinu povucite na rubu kad je okno ispod drugih okana; ta se visina pamti. Križić u gornjem desnom kutu zatvara okno (*Zatvori upozorenja*).
- **Zaglavlje** — *Pogreške: N, upozorenja: N*. Ako još ništa nije izračunato, piše *Još nije izračunato. Pritisnite Izračunaj (F5) za provjere*.
- **Izračunaj** — gumb u zaglavlju, vidljiv dok je raspored zastario ili još nije izračunat. Radi isto kao *Izračunaj* na vrpci.
- **Znak upozorenja u zaglavlju** — kad je raspored zastario, s opisom *Raspored je zastario. Ovaj popis dolazi iz posljednjeg izračuna. Ponovno izračunajte (F5)*. Popis nije skriven, samo je označen kao zastario.
- **Prazan popis** — *Nema upozorenja. Raspored prolazi sve provjere*.
- **Redak** — na vrhu mjesto (zadatak, ovisnost, resurs ili projekt), a ispod opis. Pogreška ima vlastiti osmerokutni znak, upozorenje trokutasti znak. Zadatak se prikazuje kao `WBS naziv`. Ovisnost se prikazuje kao `prethodnik → nasljednik (FS+2d)`, s vrstom i vremenom odgode. Klik vodi na mjesto (opis: *Idi na: …*), pogledajte dolje. Redak koji pripada vašem aktivnom zadatku (za ovisnost: njezinom nasljedniku) ili resursu odabranom u histogramu je istaknut.
- **Redoslijed** — prvo pogreške; zatim po vrsti, prema popisu dolje; unutar vrste prema redoslijedu u dokumentu (za ovisnost prema nasljedniku, za resurs prema popisu resursa). Zadatak, ovisnost ili resurs obrisan nakon posljednjeg izračuna ispada s popisa.

### Vrste upozorenja

- **Pogreška u rasporedu** — *Raspored se nije mogao izračunati: …* s razlogom iza toga, pogledajte dolje. Klik: za ciklus aplikacija odabire sve zadatke u ciklusu i skače na prvi; za ostale pogreške nema kamo skočiti i redak nije gumb.
- **Propušten rok za dovršetak** — *Rok za dovršetak {date} je propušten. Najraniji završetak: {date}*. Zadatak ima rok za dovršetak, a izračun ga ne ispunjava. Klik skače na zadatak. Za ispravak prilagodite logiku ili trajanje ili pomaknite rok za dovršetak.
- **Prekršeno ograničenje** — *Logika nadjačava ograničenje {type and date} (negativna vremenska rezerva)*. Ograničenje se ne može ispuniti bez kršenja logike; vremenska rezerva je negativna. Klik skače na zadatak. Pogledajte [Ograničenja](docs://uitleg-constraints).
- **Izvan redoslijeda** — *Izvan redoslijeda: napredak nasljednika proturječi ovisnosti*. Napredak nasljednika ne odgovara vrsti ovisnosti. Na primjer: nasljednik je već u tijeku, a prethodnik još nije gotov, pri ovisnosti završetak-početak. Klik odabire oba zadatka, a nasljednik je aktivan. Provjerite stvarne datume ili ovisnost.
- **Skraćeno vrijeme preklapanja** — *Vrijeme preklapanja skraćeno zbog datuma početka projekta. Ovisnost nije u potpunosti primijenjena*. Vrijeme preklapanja (negativno vrijeme odgode) ovisnosti seže prije datuma početka projekta. Klik odabire oba zadatka.
- **Zanemarena ovisnost** — *Ovisnost zanemarena: prethodnik ili nasljednik nedostaje ili nije zadatak najniže razine*. Izračun ne koristi ovisnost. Klik odabire zadatke koji još postoje. Pogledajte [Ovisnosti](docs://uitleg-relaties).
- **Hamak bez odlučujuće ovisnosti završetka** — *Hamak bez odlučujuće ovisnosti završetka (nema FF/SF prethodnika): trajanje se vraća na nulu*. Klik skače na zadatak. Pogledajte [Zadaci tipa hamak](docs://howto-hammock).
- **Ograničen datum završetka** — *Datum završetka je ograničen: kalendar ne ostavlja radni prozor za zadatak*. Izračun je dosegao granicu broja dana koje pretražuje, na primjer zbog vrlo dugog neprekinutog niza neradnih dana u kalendaru. Klik skače na zadatak. Pogledajte [Kalendari i radni dani](docs://uitleg-kalenders).
- **Preopterećenje resursa** — *Dani s preopterećenjem resursa: N (prvi – zadnji)*, uz dodatak *resurs ne radi ove dane prema svom kalendaru* ako su svi dani neradni, ili *od toga resurs ne radi N dana prema svom kalendaru* za kombinaciju. Klik odabire zadatke s dodjelom tom resursu, uključuje histogram i u njemu odabire taj resurs. Iz kartica *Tablica*, *IFC* ili *Izvješće* aplikacija skače na karticu *Resursi*. Pogledajte [Okno resursa](docs://ref-resourcepaneel).

### Razlozi za pogrešku u rasporedu

- *Kružna ovisnost između zadataka: {path}* — ovisnosti tvore ciklus. Zadaci su u putanji; preokrenite ili uklonite jednu ovisnost.
- *Kalendar nema postavljene radne dane* — dodijelite kalendaru barem jedan radni dan, pogledajte [Prozori kalendara](docs://ref-kalenders).
- *Neispravno trajanje u danima za zadatak '{task}'* i *Neispravno trajanje u satima za zadatak '{task}'* — trajanje zadatka nije ispravan broj.
- *Zadatak u satima '{task}' nema valjanih radnih sati u svom kalendaru* — zadatak u satima je na kalendaru bez radnih sati.
- *Neispravan datum početka za zadatak '{task}'* — datum početka zadatka nije ispravan.

## Trake ispod vrpce

Traka se nalazi odmah ispod vrpce, iznad radnog prostora. Ima tekst i jedan gumb. Traka za način rada nema križić; ostale trake zatvorite križićem. Pet traka:

- **Način ovisnosti** — *Način ovisnosti: povucite od jedne trake do druge u Gantt-prikazu da biste stvorili ovisnost. Pritisnite Esc za zaustavljanje*. Traka ostaje dok je način ovisnosti uključen. Gumb: *Zaustavi*. Pogledajte [Stvaranje ovisnosti](docs://howto-relaties-leggen).
- **Način podijeljenog zadatka** — *Kliknite traku na dan kada prekid počinje i povucite udesno za njegovu duljinu. Pritisnite Esc za zaustavljanje*. Traka ostaje dok je *Podijeli zadatak* uključen. Gumb: *Zaustavi*.
- **Planiranje u satima u datoteci** — *Ova datoteka sadrži planiranje u satima.* Pojavi se kada otvorena datoteka sadrži planiranje u satima, a *Uključi planiranje u satima* nije uključen. Gumb: *Uključi planiranje u satima*. Pogledajte [Uključivanje planiranja u satima](docs://howto-urenplanning-aanzetten).
- **Zaključana struktura** — *Nije dostupno tijekom filtriranja, grupiranja ili sortiranja*. Pojavi se kada zadatak ne možete uvući ili pomaknuti na višu razinu jer je tablica zadataka filtrirana, grupirana ili sortirana. Gumb: *Očisti*, koji uklanja filtar, grupiranje i sortiranje.
- **Datumi kako su zabilježeni** — nakon otvaranja datoteke u kojoj je ponovno izračunavanje pomaknulo datume: *Ponovno izračunavanje pomaknulo je N od M zadataka s datuma iz datoteke.* uz gumb *Prikaži zabilježene datume*. Dok je prikaz uključen: *Gledate datume kako su zabilježeni u datoteci …* uz gumb *Ponovno izračunaj*. Pogledajte [Datumi kako su zabilježeni](docs://uitleg-datums-zoals-opgeslagen).

## Obavijesti

Obavijesti se prikazuju pri dnu ekrana, također u tablici, u Backstageu i u načinu prezentacije. Obavijest je *pogreška* ili *info*. Pogreška je crvena i ostaje dok ne kliknete na križić. Info nestaje nakon 5 sekundi (obavijest s puno objašnjenja ostaje dulje). Ti brojači počinju ponovno čim se niz promijeni. Svaka obavijest ima križić u gornjem desnom kutu (opis alata *Zatvori obavijest*) koji je odmah zatvara. Klik na tekst obavijesti ne čini ništa. Odbijanje je uvijek pogreška: obavijest da aplikacija nije izvršila nešto što ste učinili, na primjer odbijenu ovisnost, trajanje, početak ili kontrolnu točku. Tako je ne propustite ako na trenutak odvratite pogled. Odbijanje nestaje nakon Ctrl+Z ili Ctrl+Y i kad pređete na drugi dokument, jer tada više nije točno. Druga pogreška, na primjer *Spremanje nije uspjelo*, ostaje. To vrijedi i kad je ostatak iste radnje uspio, na primjer pri lijepljenju u više ćelija. Ako je uključeno više zadataka, redak ispod kaže koji zadaci nisu promijenjeni, na primjer *Nije promijenjeno: Foundation, Masonry.* Uz više od pet zadataka redak završava s *i još N zadataka*. Isto odbijanje se pri ponavljanju sažima u jedan redak s brojačem. Istodobno se prikazuju najviše tri. Ako dođe četvrta, prvo nestaje najstarija info obavijest. Ako nema info obavijesti, prvo nestaje najstarije odbijanje, zatim najstarija obavijest pri otvaranju koja ostaje, i tek onda najstarija pogreška. Info obavijest ili odbijanje tako nikad ne gurne drugu pogrešku, na primjer *Spremanje nije uspjelo*, iz niza. Niz se miče od gumba otvorenog dijaloga i od fiksnih traka s radnjama. Obavijest pri otvaranju datoteke također ostaje dok ne kliknete na križić, ako je aplikacija pri otvaranju dopunila, zamijenila, popravila ili izostavila podatke: redak o nalazima parsera ili kalendara, problemima sa zapisom brojeva, zamjenskim rješenjima za nabrajanja, postavkama P6 rasporeda sa sigurnim zamjenskim rješenjem, zaštitnoj zamjeni za temeljni plan, nepovezanim referencama na temeljni plan, zadacima bez planiranog početka kojima je dan početak, međuzavisnostima projekata ili zadacima bez projekta koji nisu uvezeni (P6 XML), nečim iz MS Project datoteke što nije uvezeno (MS Project XML i `.mpp`) ili neupotrebljivim XER izvornim arhivom te obavijestima o dupliciranim id-ovima i ovisnostima koje se ne izračunavaju. Ako sadrži samo informacije bez takve promjene (na primjer broj projekata, dokumenata ili kodiranje teksta), obavijest nestaje nakon 5 sekundi.

- **Brojač ×N** — obavijest s fiksnim ključem sažme ponavljanje u jedan redak s brojačem, na primjer pogreška pri spremanju koja se stalno vraća ili odbijena ovisnost koju ponavljate. Nije svaka obavijest tako.
- **Pročitaj više** — neke obavijesti imaju vezu *Pročitaj više* ili vlastitu temu (na primjer *Objašnjenje vrsta zadataka*) koja vodi do vodiča u Backstageu › Pomoć.
- **Gumb za radnju** — obavijest o profilu izračuna ima gumb *Otvori profil izračuna* koji vodi do *Informacije o projektu*.

Popis ispod je izbor, grupiran po temi. Ako nije drugačije navedeno, obavijest je info.

### Spremanje, otvaranje i oporavak

- **Spremanje nije uspjelo** (pogreška) — *Spremanje nije uspjelo* s razlogom ispod. Pri spremanju, spremanju kao i pri izvozu izvješća.
- **Spremljeno kao preuzimanje** (info) — *Spremljeno kao preuzimanje: '{name}' je sada u vašoj mapi za preuzimanja. …* Uz *Spremi kao* i izvoze, kad okruženje ne dopušta aplikaciji da izravno piše na mjesto koje ste odabrali. Dva preuzimanja odmah jedno za drugim sažmu se zajedno.
- **Spremljeno kao preuzimanje (objašnjenje)** (info, 15 sekundi) — *Spremljeno kao preuzimanje: '{name}' je u mapi za preuzimanja. Ovaj preglednik ne dopušta aplikaciji pisanje na vlastito mjesto, …* Uz *Spremi* u pregledniku koji sprema samo preuzimanjem. Jednom po sesiji, s vezom na objašnjenje datoteka.
- **Preglednik ne piše natrag** (info, 15 sekundi) — *Ovaj preglednik aplikaciji ne dopušta pisanje natrag u '{name}'. …* Uz *Spremi* projekta koji ima datoteku, kad preglednik mora ponovno tražiti mjesto. Jednom po sesiji, s vezom na objašnjenje datoteka.
- **Automatsko spremanje nije uspjelo** (pogreška) — *Automatsko spremanje nije uspjelo* s razlogom. Odnosi se na automatsko spremanje u datoteku i na oporavak od pada.
- **Biblioteku nije bilo moguće spremiti** (pogreška) — *Biblioteku nije bilo moguće spremiti*, pri spremanju biblioteke resursa.
- **Otvaranje datoteke nije uspjelo** (pogreška) — *Otvaranje datoteke nije uspjelo* s razlogom. Na primjer pri otvaranju nedavne datoteke ili uvezene datoteke.
- **Stari ili zaštićeni .mpp** (pogreška) — *Ova .mpp datoteka koristi stariji format (Project 2007 ili raniji)…* ili *Ova .mpp datoteka je zaštićena lozinkom…*, obje sa savjetom da izvezete datoteku kao XML u MS Projectu i otvorite tu datoteku.
- **Neispravna XER datoteka** (pogreška) — jedan od tekstova *XER…*, na primjer *Ovo nije valjana ni podržana XER datoteka.* ili *XER datoteka sadrži dvostruku tablicu.*, s dodanim razlogom.
- **IFC nije bilo moguće pročitati** (pogreška) — *IFC nije bilo moguće pročitati* s razlogom, u prikazu IFC-a.
- **Oporavak** (pogreška) — *Oporavljenu datoteku nije bilo moguće pročitati*, *Vraćanje nije uspjelo* i *N datoteke za oporavak nije bilo moguće učitati i preskočene su.* Pri oporavku nakon neočekivanog gašenja.
- **Grana spremljena kao predložak** (info) — *Grana spremljena kao predložak '{name}'.*
- **Poruka iz proširenja** (info, ili pogreška ako proširenje javi pogrešku) — *Proširenje {name}: {message}*. Proširenje smije prikazati najviše tri nove poruke u 10 sekundi, pa ne puni niz. Ako korak vodiča proširenja ne uspije, piše *Jedan korak proširenja {name} javio je grešku. Vodič se nastavlja.*, a ako projektnu datoteku proširenja nije moguće otvoriti, *Projektnu datoteku {file} iz proširenja {name} nije bilo moguće otvoriti.* Obje su pogreške.
- **Promjena u međuvremenu** (pogreška) — *Promjena od AI pomoćnika ili proširenja stigla je u međuvremenu. …* Kad otkažete dijalog zadatka dok je AI ili proširenje u međuvremenu nešto promijenilo: izmjene zadatka iz prije te promjene se ne poništavaju i ostaju kao obični koraci pod *Poništi*.

### Izračunavanje

- **Raspored nije bilo moguće izračunati** (pogreška) — *Raspored nije bilo moguće izračunati* s razlogom ispod (vidi *Razlozi za pogrešku u rasporedu*). Pri *Izračunaj*, pri prelasku na drugi dokument i pri otvaranju datoteke.
- **Datum stanja postavljen na danas** (info) — *Datum stanja postavljen na danas ({date}).* Kad unosite napredak u projekt bez datuma stanja. Aplikacija mjeri napredak do datuma stanja, pa bez njega ne može obraditi napredak. Drugi datum postavite pod *Raspored › Temeljni planovi i napredak › Datum stanja*. Uz vezu *Pročitaj više* na [Napredak, datum stanja i temeljni plan](docs://uitleg-voortgang).
- **Trajanje kraće od već obavljenog rada** (pogreška) — *'{name}' je već {N}% završen: trajanje kraće od već obavljenog rada nije moguće. Trajanje nije promijenjeno.*

### Ovisnosti i hijerarhija

- **Ovisnost odbijena** (pogreška) — *Ta ovisnost već postoji*, *Ovisnost između zadatka i njegovog vlastitog (pra)nadređenog zadatka sažetka nije dopuštena.* ili *Ova ovisnost bi stvorila ciklus u rasporedu ({cycle}) i nije stvorena.* Ciklus navodi zadatke, pa znate koju ovisnost treba prvo ukloniti ili preokrenuti.
- **Premještanje odbijeno** (pogreška) — *Ovo premještanje bi stvorilo ciklus u rasporedu ({cycle}): ovisnosti zadatka sažetka vrijede i za njegove podzadatke. Ništa nije premješteno.*
- **Ovisnosti otpadnu nakon premještanja** (info) — *Nakon premještanja N ovisnosti povezuju zadatak s njegovim vlastitim zadatkom sažetka; one se više ne uzimaju u izračun.*
- **Ovisnosti nisu stvorene pri umetanju** (pogreška) — *N ovisnosti nisu stvorene: neispravno povezivanje…*, pri lijepljenju ili umetanju grane. Redak ispod kaže koje ovisnosti, na primjer *Nije stvoreno: Foundation → Masonry.*
- **Ovisnosti nisu uračunate nakon uvoza** (info) — *Ovisnosti nisu uključene u izračun: N. Provjerite stupce Prethodnici i Nasljednici.*
- **Dupli id-ovi nakon uvoza** (info) — *Objekti s dupliciranim id-om u ovoj datoteci: N. Dobili su vlastiti id…*

### Uređivanje zadataka

- **Početak zabilježen kao ograničenje** (info) — *'{name}' počinje najranije {date} (SNET).* Kad promijenite početak zadatka s prethodnikom. Prethodnik određuje početak, pa aplikacija vaš datum bilježi kao ograničenje *ne početi prije* (SNET). Nakon ponovnog izračuna (F5) zadatak neće početi prije tog datuma. Ako je zadatak već imao takvo ograničenje, piše *'{name}' sada počinje najranije {date} (SNET).*; za više zadataka odjednom daje broj. Uz vezu *Pročitaj više* na [Ograničenja i rokovi](docs://uitleg-constraints).
- **Početak nije primijenjen** (pogreška) — *Novi početak '{name}' nije primijenjen: zadatak ima prethodnika i ograničenje {type} {date}, a oba određuju njegov početak. Promijenite to ograničenje da biste pomaknuli početak.*
- **Kontrolna točka odbijena** (pogreška) — *'{task}' ima dodjele resursa i ne može postati kontrolna točka. Prvo uklonite dodjele.* ili *'{task}' je zadatak sažetka s podzadacima i ne može postati kontrolna točka.* Pri pretvaranju u dijalogu zadatka, u oknu svojstava, u kontekstnom izborniku i u tablici.
- **Dodjele premještene u podzadatak** (info) — *1 dodjela premještena u podzadatak '{child}'.* ili *N dodjela premješteno u podzadatak '{child}'.* Kad proširenje daje podzadatke zadatku s dodjelama. Taj zadatak postaje zadatak sažetka, a zadatak sažetka sam nema dodjele. Zato se dodjele premještaju na prvi novi podzadatak. U samoj aplikaciji to birate u prozoru *Zadatak postaje zadatak sažetka*; ova poruka se tada ne pojavljuje. Uz vezu *Pročitaj više* na [Prilagođavanje strukture](docs://howto-structuur-aanpassen).
- **Oznaka kontrolne točke uklonjena** (info) — *'{phase}' više nije kontrolna točka.* Kad kontrolna točka dobije podzadatke. Kontrolna točka je trenutak bez podzadataka; s podzadacima postaje zadatak sažetka. Uz vezu *Pročitaj više* na [Prilagođavanje strukture](docs://howto-structuur-aanpassen).
- **Pitanje je zastarjelo** (pogreška) — *Zadaci ili dodjele promijenili su se dok je pitanje bilo otvoreno. Ništa nije promijenjeno; pokušajte ponovno.* Kad birate u prozoru *Zadatak postaje zadatak sažetka*, ali pitanje se više ne podudara.
- **Zadatak sažetka odbijen** (pogreška) — *'{phase}' ne može postati zadatak sažetka: …* s razlogom, i *Ništa nije promijenjeno.* Kad proširenje daje podzadatke zadatku s dodjelama, a dodjele se ne mogu premjestiti na prvi novi podzadatak. U samoj aplikaciji se ova poruka ne pojavljuje: tamo prozor *Zadatak postaje zadatak sažetka* pita što učiniti, a *Premjesti* je tada onemogućen.
- **Ćelije preskočene pri lijepljenju** (pogreška) — *Preskočeno je N ćelija: one su samo za čitanje (na primjer automatski numerirana oznaka WBS-a ili izračunati stupac).*
- **Reference očišćene pri lijepljenju** (info) — *N referenci nije postojalo u ovom dokumentu i uklonjeno je (kalendari zadataka, prilagođene kategorije radova, šifre zadatka ili prilagođena polja iz izvornog dokumenta).*
- **Struktura je zaključana** (pogreška, crvena traka ispod vrpce) — *Nije dostupno tijekom filtriranja, grupiranja ili sortiranja*, s gumbom *Očisti*. Dok je popis filtriran, grupiran ili sortiran: pri uvlačenju, pri pomicanju na višu razinu i pri povlačenju, s *Umetni iznad* i *Umetni ispod* (izbornik desnim klikom ili prečac). Traka ostaje dok ne kliknete na križić, ne upotrijebite Ctrl+Z ili Ctrl+Y ili ne pređete na drugi dokument. Vidi [Prilagođavanje strukture](docs://howto-structuur-aanpassen).
- **Zadatak dodan na kraj** (pogreška) — *Novi zadatak je dodan na kraj. Dok filtrirate, grupirate ili sortirate, aplikacija ga ne može postaviti ispod vašeg odabira.* S gumbom *Očisti*. Pri naredbama *Zadatak* i *Kontrolna točka ▾* dok je odabran zadatak, a popis je filtriran, grupiran ili sortiran. Zadatak se doda, ali na dno. *Očisti* uklanja filtar, grupiranje i sortiranje te zatvara obavijest. Vidi [Dodavanje zadataka i kontrolnih točaka](docs://howto-taken-en-mijlpalen-toevoegen).
- **Trajanje prilagođeno vrstom zadatka** (info) — *Nakon promjene kalendara vrsta zadatka prilagodila je trajanje za N zadataka (rad ostaje, sati dnevno su se promijenili).* S vezom *Objašnjenje vrsta zadataka*.

### Primavera P6 XML

- **P6 XML datoteka otvorena** (info) — *P6 XML datoteka otvorena: N projektnih dokumenata.* Nakon otvaranja P6 XML datoteke.
- **Nije uvezeno** (ostaje) — *N ovisnosti između projekata nisu preuzete kao ovisnosti.* i *N zadataka bez projekta nije učitano.* Provjerite je li vaš raspored potpun.
- **Prazno ili neupotrebljivo** (pogreška) — ništa se ne otvara. Tri razloga: *Ova datoteka ne sadrži zadatke koje aplikacija može pročitati.*, *Zadaci nemaju ObjectId. …* i *Datoteka koristi nazive stupaca XER-a … Otvorite samu datoteku .xer.*

### Primavera (XER)

- **XER datoteka otvorena** (info) — *XER datoteka otvorena: N projektnih dokumenata.* Jedna obavijest po datoteci, čak i kad se u njoj otvori više projekata, s vezom *Pročitaj više* i redovima s detaljima ispod. Uvijek *N projekata pronađeno.* Samo kad je broj veći od 0: *N praznih projekata preskočeno.*, *N projekata temeljnog plana isključeno.*, *N temeljnih planova materijalizirano.*, *N nepovezanih referenci na temeljni plan zanemareno.*, *Upotrijebljeno je zaštitno zamjensko rješenje za temeljni plan.* i *N međuzavisnosti projekata sačuvano.* Samo za kodiranje koje nije UTF-8: *Kodiranje teksta utvrđeno je kao {encoding}.* Dalje, kad je broj veći od 0: *N nalaza parsera.*, *N nalaza kalendara.*, *N problema s zapisom brojeva.*, *N zamjenskih rješenja za nabrajanje* i *N postavki rasporeda P6 upotrijebilo je sigurno zamjensko rješenje.*
- **Datumi kako ih je Primavera spremila** (detaljni redak u istoj obavijesti) — *N zadataka prikazuje datume onako kako ih je Primavera spremila (nisu ponovno izračunati).* N broji svaki zadatak za koji je datoteka zabilježila datume, uključujući one koji se ne razlikuju. Ili, ako način nije bio uključen, *N zadataka se razlikuje od datuma u datoteci — možete ih prikazati.*
- **Izvorni XER arhiv neupotrebljiv** (info) — *Izvorni XER arhiv u ovoj datoteci je neupotrebljiv i izostavljen je; sam projekt je potpuno otvoren.* s razlogom (na primjer *Razlog: kontrolni zbroj ne odgovara izvornim bajtovima; arhiv je oštećen.*) i posljedicom (*Raspored, profil izračuna i svi podaci projekta iz IFC-a su potpuni. …*). Pri otvaranju IFC datoteke u kojoj se prethodno spremljeni XER izvorni arhiv ne može upotrijebiti. Također pri vraćanju nakon neočekivanog gašenja, ako spremište za oporavak više ne sadrži izvorni arhiv.
- **Izvoz gubi informacije o XER-u** (info) — *Izvoz u {format} gubi informacije o izvoru XER-a.* Nakon uspješnog izvoza projekta s podacima koji postoje samo u XER datoteci u drugi format osim IFC-a. S vezom *Pročitaj više*.

### Uvoz, izvoz i profil izračuna

- **Datumi kako su u datoteci** (info) — *N zadataka prikazuje datume onako kako su zapisani u datoteci (nisu ponovno izračunati).* (N broji svaki zadatak sa zabilježenim datumima) ili *N zadataka se razlikuje od datuma u datoteci — možete ih prikazati.* Kad otvorite datoteku sa zabilježenim datumima.
- **Rad i vrste zadataka vidljivi** (info) — *Ova datoteka sadrži spremljeni rad ili vrste zadataka; vrsta zadatka i preostali posao vidljivi su za ovaj projekt.*
- **MS Project raspored pročitan** (info) — *Ova MS Project datoteka sadrži N zadataka s prekinutim, razriješenim ili rasporedom vođenim resursima. Tako se uvoze i prikazuju.*
- **Prekidi nisu izvezeni** (info) — *N zadataka s prekidima izvezeno je bez prekida: MS Project i P6 poznaju prekide samo kao raspodjelu rada.* Pri izvozu u MS Project ili Primavera.
- **Početak projekta pomaknut** (info) — *N zadataka pomaknuto je s početkom projekta.* Kad postavite kasniji datum početka projekta. Samo zadaci bez prethodnika i bez ograničenja koje bi ležalo prije novog datuma početka pomiču se na taj datum. Uz vezu *Pročitaj više* na [Novi projekt i Informacije o projektu](docs://ref-projectinfo).
- **Prozor datuma više ne upravlja** (info) — *Prozor datuma MS Projecta više ne upravlja N zadataka nakon ove izmjene; …* Jednom po dokumentu.
- **Kašnjenje zbog uravnoteživanja zaokruženo** (info) — *Uravnoteživanje zaokružuje minutno precizno kašnjenje zbog uravnoteživanja iz MS Projecta na cijele radne dane za N zadataka.* Jednom po dokumentu.
- **Profil izračuna primijenjen** (info) — *Ovaj projekt se izračunava kao {profile}. Promijenite u Datoteka → Informacije o projektu → Profil izračuna i opcije izračuna.* S gumbom *Otvori profil izračuna*. Nakon primjene profila slijedi *Nakon primjene pomaknuto je N zadataka.* ako je potrebno.
