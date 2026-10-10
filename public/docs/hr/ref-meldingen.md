# Obavijesti i upozorenja

Aplikacija vas obavještava o stanju na tri mjesta: na traci stanja na dnu, u oknu *Upozorenja* u desnom stupcu i u obavijestima koje se nakratko pojave na dnu ekrana. Ovaj članak za svako mjesto kaže što vidite, kada se to pojavi i što možete učiniti. Zašto je raspored kritičan ili ima preopterećenje resursa, opisano je u [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad); rješavanje preopterećenja resursa je u [Rješavanje preopterećenja resursa](docs://howto-overbezetting-oplossen); stvaranje ovisnosti je u [Stvaranje ovisnosti](docs://howto-relaties-leggen).

## Razlika među trima

- **Traka stanja** — fiksni redak s brojačima. Oni potječu iz posljednjeg izračuna i ostaju dok opet ne izračunate.
- **Okno upozorenja** — popis iza tih brojača, sa svime što je pronašao posljednji izračun. Klikom idete na zadatak, ovisnost ili resurs. Popis proizlazi iz posljednjeg izračuna; ništa se ne pohranjuje.
- **Obavijesti** — kratke poruke o nečemu što ste upravo učinili (spremanje nije uspjelo, ovisnost odbijena, uvoz pročitan). Nestanu i nisu u oknu.

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

## Obavijesti

Obavijesti se prikazuju dolje na ekranu, ali i u tablici, u Backstageu i u načinu prezentacije. Obavijest je *greška* ili *info*. Greška ostaje dok je ne kliknete. Info nestaje nakon 5 sekundi. Ti mjerači vremena kreću ispočetka čim se gomila obavijesti promijeni. Klik na obavijest zatvara je (opis alata *Zatvori obavijest*). Najviše tri obavijesti prikazuju se istodobno. Ako dođe četvrta, prvo ide najstariji info. Ako infa nema, ide najstarija obavijest. Tako greška nikad ne ispadne zbog infa. Gomila se pomiče od gumba otvorenog dijaloga i od fiksnih traka s radnjama.

- **Brojač ×N** — obavijest s fiksnim ključem spaja ponavljanje u jedan redak s brojačem, na primjer greška pri spremanju koja se stalno vraća ili odbijena ovisnost koju ponavljate. Ne radi to svaka obavijest.
- **Pročitaj više** — neke obavijesti imaju vezu *Pročitaj više* ili vlastitu temu (na primjer *Objašnjenje pravila rada*) koja vodi do vodiča u Backstageu › Pomoć.
- **Gumb radnje** — obavijest o profilu izračuna ima gumb *Otvori profil izračuna* koji vodi do podataka o projektu.

Popis u nastavku je izbor, razvrstan po temi. Ako tekst ne kaže drugačije, obavijest je info.

### Spremanje, otvaranje i oporavak

- **Spremanje nije uspjelo** (greška) — *Spremanje nije uspjelo* s razlogom ispod. Pri spremanju, spremanju kao i izvozu izvješća.
- **Spremljeno kao preuzimanje** (info) — *Spremljeno kao preuzimanje: '{name}' je sada u mapi za preuzimanja. …* Uz *Spremi kao* i izvoze, kada okruženje ne dopušta aplikaciji da piše izravno na mjesto koje ste odabrali. Dva preuzimanja jedno za drugim spajaju se u jedno.
- **Spremljeno kao preuzimanje (objašnjenje)** (info) — *Spremljeno kao preuzimanje: '{name}' je u mapi za preuzimanja. Ovaj preglednik ne dopušta aplikaciji da piše na vlastito mjesto, …* Uz *Spremi* u pregledniku koji sprema samo preuzimanjem. Jednom po sesiji, s vezom na objašnjenje datoteka.
- **Preglednik ne piše natrag** (info) — *Ovaj preglednik ne dopušta aplikaciji da piše natrag u '{name}'. …* Uz *Spremi* projekta koji ima datoteku, kada preglednik mora ponovno tražiti mjesto. Jednom po sesiji, s vezom na objašnjenje datoteka.
- **Automatsko spremanje nije uspjelo** (greška) — *Automatsko spremanje nije uspjelo* s razlogom. Odnosi se na automatsko spremanje u datoteku i na oporavak od pada.
- **Biblioteku nije bilo moguće spremiti** (greška) — *Biblioteku nije bilo moguće spremiti*, pri spremanju biblioteke resursa.
- **Otvaranje datoteke nije uspjelo** (greška) — *Otvaranje datoteke nije uspjelo* s razlogom. Na primjer nedavna datoteka ili uvezena datoteka.
- **Staro ili zaštićeno .mpp** (greška) — *Ova .mpp datoteka koristi stariji format (Project 2007 ili raniji)…* ili *Ova .mpp datoteka je zaštićena lozinkom…*, obje s savjetom da izvezete kao XML u MS Projectu i otvorite tu datoteku.
- **Neispravna XER datoteka** (greška) — jedan od tekstova *XER…*, na primjer *Ovo nije valjana ni podržana XER datoteka.* ili *XER datoteka sadrži dvostruku tablicu.*, s dodanim razlogom.
- **IFC nije bilo moguće pročitati** (greška) — *IFC nije bilo moguće pročitati* s razlogom, u prikazu IFC-a.
- **Oporavak** (greška) — *Oporavljenu datoteku nije bilo moguće pročitati*, *Vraćanje nije uspjelo* i *N datoteka za oporavak nije bilo moguće učitati i preskočeno je.* Pri oporavku nakon neočekivanog gašenja.
- **Grana spremljena kao predložak** (info) — *Grana spremljena kao predložak '{name}'*.
- **Poruka proširenja** (info, ili greška ako proširenje javi grešku) — *Proširenje {name}: {message}*. Proširenje smije prikazati najviše tri nove poruke u 10 sekundi, pa ne puni gomilu obavijesti. Ako jedan korak vodiča proširenja ne uspije, piše *Jedan korak proširenja {name} javio je grešku. Vodič se nastavlja.*, a ako se projektna datoteka proširenja ne može otvoriti, piše *Projektnu datoteku {file} iz proširenja {name} nije bilo moguće otvoriti.* Obje su greške.
- **Promjena je stigla u međuvremenu** (info) — *Promjena od AI pomoćnika ili proširenja stigla je u međuvremenu. …* Kada otkažete dijalog zadatka, a AI pomoćnik ili proširenje je u međuvremenu nešto promijenio: izmjene zadatka iz prije te promjene ne vraćaju se i ostaju kao obični koraci pod *Poništi*.

### Izračunavanje

- **Raspored nije bilo moguće izračunati** (greška) — *Raspored nije bilo moguće izračunati* s razlogom ispod (vidi *Razlozi pogreške u rasporedu*). Pri *Izračunaj*, pri prebacivanju dokumenata i pri otvaranju datoteke.
- **Datum stanja postavljen na danas** (info) — *Datum stanja još nije bio postavljen: sada je postavljen na danas ({date}), jer se napredak mjeri do datuma stanja. Promijenite ga u Raspored → Datum stanja.* Pri unosu napretka u projektu bez datuma stanja.
- **Trajanje kraće od obavljenog rada** (info) — *'{name}' je već {N}% završen: trajanje kraće od već obavljenog rada nije moguće. Trajanje nije promijenjeno.*

### Ovisnosti i hijerarhija

- **Ovisnost stvorena** (info) — *Ovisnost je stvorena: {predecessor} → {successor}*.
- **Ovisnost odbijena** (info) — *Ta ovisnost već postoji*, *Ovisnost između zadatka i njegovog vlastitog (pra)nadređenog zadatka sažetka nije dopuštena.* ili *Ova ovisnost bi stvorila ciklus u rasporedu ({cycle}) i nije stvorena.* Ciklus navodi zadatke. Tako znate koju ovisnost prvo treba ukloniti ili obrnuti.
- **Premještanje odbijeno** (info) — *Ovo premještanje bi stvorilo ciklus u rasporedu ({cycle}): ovisnosti zadatka sažetka vrijede i za njegove podzadatke. Ništa nije premješteno.*
- **Ovisnosti otpadaju nakon premještanja** (info) — *Nakon premještanja N ovisnosti povezuju zadatak s njegovim vlastitim zadatkom sažetka; one se više ne uzimaju u izračun.*
- **Ovisnosti preskočene pri umetanju** (info) — *N ovisnosti nisu stvorene: neispravna poveznica…*, pri lijepljenju ili umetanju grane.
- **Ovisnosti nisu uzete u obzir nakon uvoza** (info) — *Ovisnosti nisu uključene u izračun: N. Provjerite stupce Prethodnici i Nasljednici.*
- **Dvostruki ID-jevi nakon uvoza** (info) — *Objekti s dvostrukim ID-jem u ovoj datoteci: N. Dobili su vlastiti ID…*

### Uređivanje zadataka

- **Početak zabilježen kao ograničenje** (info) — *'{name}' ima prethodnika: novi početak je postavljen kao ograničenje „ne početi prije“ (SNET) {date}. Nakon ponovnog izračunavanja (F5) zadatak ne počinje prije tog datuma.* Pri promjeni početka zadatka s prethodnikom. Ako je zadatak već imao takvo ograničenje, obavijest kaže da je ograničenje pomaknuto. Za više zadataka odjednom daje broj.
- **Početak nije primijenjen** (info) — *Novi početak '{name}' nije primijenjen: zadatak ima prethodnika i ograničenje {type} {date}, a ti određuju njegov početak. Promijenite to ograničenje da biste pomaknuli početak.*
- **Kontrolna točka odbijena** (info) — *'{task}' ima dodjele resursa i ne može postati kontrolna točka. Prvo uklonite dodjele.* ili *'{task}' je zadatak sažetka s podzadacima i ne može postati kontrolna točka.* Pri pretvaranju u dijalogu zadatka, u oknu svojstava, u kontekstnom izborniku i u tablici.
- **Dodjele premještene u podzadatak** (info) — *Dodjela za {resources} premještena je iz '{phase}' u novi podzadatak '{child}': zadatak sažetka sam po sebi ne nosi dodjele.* Kada zadatak s dodjelama dobije podzadatke.
- **Oznaka kontrolne točke uklonjena** (info) — *Kontrolna točka '{phase}' sada ima podzadatke: to je zadatak sažetka, a oznaka kontrolne točke uklonjena je.*
- **Zadatak sažetka odbijen** (info) — *'{phase}' ne može postati zadatak sažetka: …* s razlogom, i *Ništa nije promijenjeno.*
- **Ćelije preskočene pri lijepljenju** (info) — *Preskočeno je N ćelija: one su samo za čitanje (na primjer automatski numerirana oznaka WBS-a ili izračunati stupac).*
- **Reference uklonjene pri lijepljenju** (info) — *N referenci nije postojalo u ovom dokumentu i uklonjeno je (kalendari zadataka, prilagođene vrste zadataka, šifre zadatka ili prilagođena polja iz izvornog dokumenta).*
- **Pravilo rada prilagodilo trajanje** (info) — *Nakon promjene kalendara pravilo rada prilagodilo je trajanje za N zadataka (rad ostaje, sati dnevno su se promijenili).* S vezom *Objašnjenje pravila rada*.

### Primavera (XER)

- **XER datoteka otvorena** (info) — *XER datoteka otvorena: N projektnih dokumenata.* Jedna obavijest po datoteci, čak i kad datoteka otvori više projekata. Ima vezu *Pročitaj više* i redove s pojedinostima ispod. Uvijek se prikazuje *N projekata pronađeno.* Samo kad je broj veći od 0 prikazuju se: *N praznih projekata preskočeno.*, *N projekata temeljnog plana isključeno.*, *N temeljnih planova materijalizirano.*, *N nepovezanih referenci na temeljni plan zanemareno.*, *Upotrijebljeno je zaštitno zamjensko rješenje za temeljni plan.* i *N međuzavisnosti projekata sačuvano.* Samo za kodiranje koje nije UTF-8: *Kodiranje teksta utvrđeno je kao {encoding}.* Dalje, kad je broj veći od 0: *N nalaza parsera.*, *N nalaza kalendara.*, *N problema s zapisom brojeva.*, *N zamjenskih rješenja za nabrajanje* i *N postavki rasporeda P6 upotrijebilo je sigurno zamjensko rješenje.*
- **Datumi kako ih je Primavera spremila** (redak s pojedinostima u istoj obavijesti) — *N zadataka prikazuje datume onako kako ih je Primavera spremila (nisu ponovno izračunati).*, ili, ako način nije bio uključen, *N zadataka odstupa od datuma u datoteci. Možete prikazati te datume.*
- **Izvorni XER arhiv nije upotrebljiv** (info) — *Izvorni XER arhiv u ovoj datoteci je neupotrebljiv i izostavljen je; sam projekt je potpuno otvoren.* s razlogom (na primjer *Razlog: kontrolni zbroj ne odgovara izvornim bajtovima; arhiv je oštećen.*) i posljedicom (*Raspored, profil izračuna i svi podaci projekta iz IFC-a su potpuni. …*). Pri otvaranju IFC datoteke u kojoj se prethodno spremljeni izvorni XER arhiv ne može upotrijebiti.
- **Izvoz gubi XER informacije** (info) — *Izvoz u {format} gubi informacije o izvoru XER-a.* Nakon uspješnog izvoza u format koji nije IFC, za projekt s podacima koji postoje samo u XER datoteci. S vezom *Pročitaj više*.

### Uvoz, izvoz i profil izračuna

- **Datumi kao u datoteci** (info) — *N zadataka prikazuje datume onako kako su zapisani u datoteci (nisu ponovno izračunati).* ili *N zadataka odstupa od datuma u datoteci. Možete prikazati te datume.* Pri otvaranju datoteke sa zapisanim datumima.
- **Rad i pravila rada vidljivi** (info) — *Ova datoteka sadrži spremljeni rad ili vlastita pravila rada; pravilo rada i preostali posao vidljivi su za ovaj projekt.*
- **MS Project raspored pročitan** (info) — *Ova MS Project datoteka sadrži N zadataka s prekinutim, razriješenim ili rasporedom vođenim resursima. Tako se uvoze i prikazuju.*
- **Prekidi nisu izvezeni** (info) — *N zadataka s prekidima izvezeno je bez prekida: MS Project i P6 poznaju prekide samo kao raspodjelu rada.* Pri izvozu u MS Project ili Primavera.
- **Datum početka projekta pomaknut** (info) — *Datum početka projekta pomaknut: N sidara zadataka bez prethodnika ili ograničenja pomaknuto je na novi datum.*
- **Prozor datuma više ne upravlja** (info) — *Prozor datuma iz MS Projecta više ne određuje datume N zadataka nakon ove izmjene; …* Jednom po dokumentu.
- **Kašnjenje zbog uravnoteživanja zaokruženo** (info) — *Uravnoteživanje zaokružuje minutno precizno kašnjenje zbog uravnoteživanja iz MS Projecta na cijele radne dane za N zadataka.* Jednom po dokumentu.
- **Profil izračuna primijenjen** (info) — *Ovaj projekt izračunava se kao {profile}. Promijenite u Datoteka → Podaci o projektu → Profil izračuna i opcije izračuna.* S gumbom *Otvori profil izračuna*. Nakon primjene profila, ako je potrebno, slijedi *Nakon primjene pomaknuto je N zadataka.*
