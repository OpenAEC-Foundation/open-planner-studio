# Vrste izvješća

Ovdje su opisana sva izvješća na kartici *Izvješće*, s opcijama koje pripadaju svakom izvješću. Za svaku opciju vidite što ona radi, početnu vrijednost, što se mijenja u izvješću i gdje je nalazite. Kako izraditi izvješće i spremiti ga kao PDF, opisano je u [Izrada i ispis izvješća](docs://howto-rapport-maken-en-afdrukken).

## Kako radi prozor izvješća

Otvorite karticu *Izvješće* (ili pritisnite Ctrl+P). Lijevo je stupac *Izvješće*. U njemu su padajući izbornik *Vrsta izvješća*, blok *Sažetak* s brojevima, blok *Postavke* ili *Opcije izvješća* i na dnu gumb *Izvezi PDF*. Desno je pregled. Ono što vidite u pregledu ide u PDF.

**Vrsta izvješća** — koje izvješće vidite. Odaberite između jedanaest izvješća. Zadano: *Gantt ispis*. Gdje: *Izvješće*, na vrhu stupca *Izvješće*.

**Izvezi PDF** — stvara PDF. Učinak: rezultat je samo PDF. Aplikacija ništa ne šalje na pisač. Ako raspored nije ažuran, aplikacija najprije izračunava. Ako izračunavanje javi grešku, na primjer zbog petlje u ovisnostima, gumb ne stvara datoteku i prikazuje grešku. Gdje: *Izvješće*, na dnu stupca *Izvješće*.

**Zapamćeno.** Aplikacija čuva sve opcije izvješća na ovom uređaju, za sve vaše projekte. Ne pripadaju datoteci projekta. Samo se polje *Tvrtka:* u Gantt ispisu ne čuva.

**Trenutačni raspored.** Izvješća koriste posljednje izračunavanje. Ako se raspored od tada promijenio, tablična izvješća na vrhu prikazuju *Raspored je promijenjen od posljednjeg izračuna — pritisnite Izračunaj (F5) za aktualne vrijednosti*. Ako još ništa nije izračunato, piše *Još nije izračunato — pritisnite Izračunaj (F5) za datume i vremensku rezervu*. Ako je projekt u prikazu *Datumi kako su zabilježeni*, izvješća prikazuju datume iz izvorne datoteke, a traka s napomenom to kaže.

**Kratice.** *rd* znači radni dani. *TF* znači ukupan slobodni hod, *FF* slobodni hod.

## Papir i orijentacija

**Papir:** — veličina papira za PDF. Odaberite između A4, A3, A2 i A1. Zadano: A3. Učinak: stranice su postavljene za tu veličinu. Postoji jedan izbor za sva izvješća: što odaberete za jedno izvješće, vrijedi i za ostala. Na okomitom A4 formatu široka tablica postaje mala, jer se tablica prilagođava širini stranice. Gdje: *Postavke* (Gantt ispis i Dijagram resursa) ili *Opcije izvješća* (sedam tabličnih izvješća). Pregled kontrolnih točaka i Odstupanje nemaju izbora.

**Orijentacija:** — vodoravno ili okomito. Odaberite između *Vodoravno* i *Okomito*. Zadano: *Vodoravno*. Učinak: kao kod *Papir:*. Gdje: isto mjesto kao *Papir:*.

## Gantt ispis

Raspored prikazan kao trakasti dijagram, s tablicom lijevo i vremenskom osi desno, po potrebi na više stranica. Pregled prikazuje papir sa zaglavljem stranice, tablicom, vremenskom osi i legendom. Blok *Sažetak* broji *Zadaci:*, *Listni zadaci:*, *Kritični:* i *Ovisnosti:*. Sve opcije su u kartici *Postavke*.

**Tvrtka:** — tvrtka u zaglavlju stranice. Zadano: tvrtka iz podataka o projektu. Učinak: samo zaglavlje izvješća; ono što ovdje upišete, ne čuva se. Tvrtku promijenite u *Postavke › Projekt › Podaci o projektu*, u polju *Naručitelj/organizacija*, i potvrdite gumbom *Primijeni*.

**Autor:** — autor u zaglavlju stranice. Samo za čitanje: aplikacija ga preuzima iz podataka o projektu.

**Veličina fonta:** — veličina teksta i tablice u izvješću. Odaberite između 90%, 100%, 110% i 125%. Zadano: 100%. Učinak: s većim fontom rastu tekst, redci i tablica, a vremenska os gubi širinu. Neovisno o opciji *Veličina teksta* u postavkama.

**Boje traka:** — o čemu ovisi boja trake. Odaberite između *Kritični put*, *Po zadatku — automatski* i *Po kategoriji*, s padajućim izbornikom *Polje kategorije* za *Po kategoriji*. Zadano: *Kritični put*. Učinak: to je isti izbor kao *Boje traka* na kartici *Prikaz*. Ako ga promijenite ovdje, mijenja se i Gantt na ekranu. Ako odabrano polje ne postoji u ovom projektu, piše *Ovo polje ne postoji u ovom projektu. Privremeno se koristi vrsta zadatka*.

**Linija stanja:** — linija na datumu stanja. Odaberite između *Nema*, *Linija datuma stanja* i *Linija napretka*. Zadano: *Nema*. Učinak: *Linija datuma stanja* crta liniju na datumu stanja; *Linija napretka* crta cik-cak liniju koja se izbočuje prema napretku svakog zadatka. Ako projekt nema datum stanja, piše *Najprije postavite datum stanja* i izvješće ne crta ništa.

**Prati prikaz (filtar, grupiranje, sortiranje)** — samo za Gantt ispis. Zadano: isključeno. Učinak: kad je isključeno, cijelo stablo zadataka ide na papir. Kad je uključeno, crta se točno ono što je na ekranu, s vašim filtrom, grupiranjem, sortiranjem i sažetim fazama.

**Prilagodi papiru** — Skalira vremensku os na širinu stranice. Zadano: uključeno. Učinak: uključeno skalira vremensku os na širinu stranice; broj stranica slijedi iz visine. Isključeno koristi fiksno mjerilo (*Zumiranje:*) i širi se i po širini, što brzo daje mnogo stranica.

**Zumiranje:** — fiksno mjerilo vremenske osi. Vidljivo je samo kad je *Prilagodi papiru* isključeno. Klizač od 1 do 40. Zadano: 22. Učinak: veća vrijednost čini vremensku os širom, pa ima više stranica u širinu.

**Vremenska os preko:** — raspoređuje vremensku os preko više širina stranice. Izbor od 1 do 8 stranica. Zadano: 1 stranica. Učinak: samo uz *Prilagodi papiru*; inače je izbor onemogućen i piše *Samo uz prilagodbu papiru*. Korisno za dug raspored koji želite ispisati u čitljivoj veličini.

**Ponovi zaglavlje na svakoj stranici** — Zadano: uključeno. Učinak: uključeno stavlja zaglavlje stranice na svaku stranicu; isključeno samo na prvoj.

**Ponovi podnožje na svakoj stranici** — Zadano: uključeno. Učinak: uključeno stavlja podnožje (naziv projekta, datum ispisa i legendu) na svaku stranicu; isključeno samo na zadnjoj. Papirni materijal bez legende nije čitljiv, zato je uključeno.

**Nazivi zadataka na trakama** — Zadano: uključeno. Učinak: naziv zadatka na traci, tamo gdje ima mjesta.

**Prikaži dovršenost** — Zadano: uključeno. Učinak: tamniji dio trake do napretka zadatka i stupac *Dovr* u tablici.

**Skrati nazive zadataka** — Zadano: uključeno. Učinak: uključeno skraćuje nazive u tablici na širinu *Stupac naziva:*. Isključeno pušta stupac da raste s najdužim nazivom; tada piše *Stupac naziva prilagođava se najdužem nazivu zadatka*.

**Stupac naziva:** — širina stupca naziva. Vidljivo samo kad je *Skrati nazive zadataka* uključeno. Klizač od 60 do 400. Zadano: 130.

**Prikaži preklapanje temeljnog plana** — aktivni temeljni plan uz trake. Zadano: isključeno. Učinak: tanka traka u boji temeljnog plana ispod trake zadatka, samo za zadatke koji su u temeljnom planu.

**Kritični put** — Zadano: uključeno. Učinak: upravlja samo crvenim linijama ovisnosti između dva kritična zadatka i retkom u legendi. Same trake slijede *Boje traka:*, bez obzira na ovaj potvrdni okvir.

**Prikaži vremensku rezervu** — Zadano: uključeno. Učinak: vremenska rezerva kao pojas iza nekritičnih traka.

**Ovisnosti** — linije ovisnosti. Zadano: uključeno. Učinak: crta strelice između traka.

**Prikaži samo radne dane** — sažima vremensku os u ovom izvješću. Zadano: isključeno. Učinak: vikendi i praznici se preskaču, a tjedni pojasevi tada zamjenjuju sjenčanje vikenda. Neovisno o istoj postavci za Gantt na ekranu.

**Vikendi** — Zadano: uključeno. Učinak: sjenča vikende i praznike na vremenskoj osi, dok mjerilo čini dane razlučivima. Na sažetoj osi (*Prikaži samo radne dane*) ovaj potvrdni okvir nema učinka.

**Legenda** — Zadano: uključeno. Učinak: legenda u podnožju.

**Kvaliteta pregleda** — koliko je pregled oštar. Odaberite između *Standardna*, *Visoka* i *Najveća*. Zadano: *Visoka*. Učinak: samo oštrina pregleda na ekranu; PDF se ne mijenja. Gdje: *Izvješće*, iznad pregleda.

## Dijagram resursa

Iste trake kao u Gantt ispisu, grupirane po resursu: tko što radi i kada. Blok *Sažetak* broji *Resursi:*, *Dodjele:* i *Bez resursa:* (uz razdoblje također *Izvan razdoblja:*). Dijagram dijeli sve opcije Gantt ispisa, osim *Prati prikaz (filtar, grupiranje, sortiranje)*, *Kritični put* i *Ovisnosti*: retci ne dolaze s ekrana, zadatak se može pojaviti pod više resursa, a ovisnosti se tu ne crtaju. Potvrdni okvir *Kritični put* je skriven i uključen. Uz to dolaze opcije Gantt ispisa u kartici *Postavke*, s ovim četirima potvrdnim okvirima i razdobljem:

**Svaki resurs na novoj stranici** — Zadano: isključeno. Učinak: svaki resurs počinje na novoj stranici, pa možete podijeliti list po ekipi ili radniku. Isključeno daje jedan neprekinut dokument.

**Uključi zadatke bez resursa** — Zadano: isključeno. Učinak: zadaci bez resursa dolaze kao zadnji pojas u dijagramu, da se vidi što još nitko nema.

**Grupiraj po vrsti resursa** — Zadano: isključeno. Učinak: sloj iznad: najprije pojas po vrsti resursa (radna snaga, ekipa, podizvođač, oprema, materijal), a unutar njega po resursu.

**Prikaži jedinice/dan i krivulju** — Zadano: uključeno. Učinak: dva stupca iza naziva zadatka s jedinicama dodjele po danu i krivuljom raspodjele resursa tog pojasa. Ako je za vremensku os premalo mjesta, izvješće izostavlja stupce i piše *Stupci Jedinice/d i Krivulja izostavljeni su: …*; više mjesta daje veći format papira ili vodoravna orijentacija, manja veličina fonta ili uža tablica.

**Razdoblje izvješća:** — samo zadaci koji dodiruju razdoblje. Zadano: *Trajanje projekta*. Učinak: vremenska os ide točno preko razdoblja. Ako u razdoblju nema ničega, piše *Nema zadataka u razdoblju izvješća — odaberite drugo razdoblje ili Cijeli projekt.* Pogledajte *Razdoblje izvješća* u nastavku.

## Pregled kontrolnih točaka

Sve kontrolne točke projekta u tablici. Nema vlastitih opcija. Blok *Sažetak* broji *Kontrolne točke*, *Obavezno* i *Kasni*. Stupci su *WBS*, *Naziv*, *Vrsta* (*Automatski*, *Početak* ili *Završetak*), *Datum*, *Ograničenje/rok za dovršetak*, *Vremenska rezerva*, *Obavezno* i *Status*. Status je *Kasni* ako je ograničenje prekršeno, rok propušten ili je ukupan slobodni hod negativan. Inače je *Kritičan* ako je kontrolna točka kritična prema kritičnoj definiciji projekta. Inače je *Prema rasporedu*. Bez kontrolnih točaka piše *Nema kontrolnih točaka u ovom projektu.* PDF koristi papir i orijentaciju koje ste zadnje odabrali za drugo izvješće.

## Odstupanje

Trenutačni raspored uz aktivni temeljni plan, za listne zadatke. Nema vlastitih opcija. Blok *Sažetak* broji *Zadaci*, *Kasni* i *Ranije* i prikazuje *Završetak projekta: +3 radnih dana* (razliku u radnim danima između završetka temeljnog plana i trenutačnog završetka). Stupci su *WBS*, *Naziv*, *Poč. temeljnog plana*, *Završ. temeljnog plana*, *Trenutačni početak*, *Trenutačni završetak*, *Δ početak (rd)*, *Δ završetak (rd)* i *Status*. Status prati završetak: *Kasni* ako je završetak kasniji nego u temeljnom planu, *Ranije* ako je raniji, inače *Prema rasporedu*. *Novo* je zadatak koji nije u temeljnom planu. *Uklonjeno* je zadatak koji je u temeljnom planu, ali više nije u rasporedu. Bez aktivnog temeljnog plana piše *Nema aktivnog temeljnog plana — spremite temeljni plan ili ga postavite kao aktivan.* PDF koristi papir i orijentaciju koje ste zadnje odabrali za drugo izvješće.

## Pregled unaprijed

Što traje ili počinje u razdoblju: popis za tjedni sastanak. Opcije su u bloku *Opcije izvješća*.

**Razdoblje izvješća:** — vremenski okvir izvješća. Zadano: *Sljedeći mjesec*. Učinak: izvješće sadrži nedovršene zadatke koji dodiruju razdoblje, čak i ako traju kroz cijelo razdoblje, plus kasne zadatke iz vremena prije referentnog dana, sve dok završetak razdoblja nije prije referentnog dana.

**Gotovo kritičan ≤ (rd):** — prag za *Gotovo kritičan*. Broj od 0 do 60. Zadano: 5. Učinak: zadatak s više od 0 i najviše toliko radnih dana ukupnog slobodnog hoda broji se kao gotovo kritičan. Kod 0 se broji samo ono što označi opcija izračuna projekta *Označi gotovo kritične*.

Blok *Sažetak* broji *Zadaci*, *Kasni*, *U tijeku*, *Trebao je početi*, *Počinje*, *Kritičan* i *Gotovo kritičan*. Status po retku uvijek je u odnosu na referentni dan: *Kasni* (nije dovršen i završetak je prije referentnog dana), *Trebao je početi* (nije počeo, a početak je bio prije referentnog dana), *U tijeku*, *Počinje* (još nije počeo, a počinje u razdoblju). Stupci su *WBS*, *Naziv*, *Početak*, *Završetak*, *Preostalo (rd)*, *Dovr*, *TF (r.d.)*, *Kritičan*, *Resursi* i *Status*.

## Kritični i gotovo kritični

Zadaci koji određuju završetak projekta i oni koji su mu blizu. Opcija je u bloku *Opcije izvješća*.

**Gotovo kritičan ≤ (rd):** — Zadano: 5. Broj od 0 do 60. Učinak i značenje kao kod pregleda unaprijed. Podnaslov navodi odabrani prag.

Izvješće sadrži nedovršene zadatke koji su kritični (prema rješavaču i kritičnoj definiciji projekta) ili gotovo kritični, poredane po putu vremenske rezerve, zatim po ukupnom slobodnom hodu, zatim po početku. Blok *Sažetak* broji *Kritičan*, *Gotovo kritičan*, *Kritični lanci* i *Listni zadaci*. Stupci su *WBS*, *Naziv*, *Početak*, *Završetak*, *Preostalo (rd)*, *TF (r.d.)*, *FF (r.d.)*, *Put* i *Status*. Stupac *Put* prikazuje put vremenske rezerve ako je opcija izračuna *Više putova vremenske rezerve* uključena, inače crticu.

## Izvješće o napretku

Gdje projekt stoji na datumu stanja. Opcije su u bloku *Opcije izvješća*.

**Razdoblje izvješća:** — Zadano: *Prošli mjesec*. Učinak: *Dovršeno u prethodnom razdoblju* broji se unutar razdoblja. *Počinje u sljedećem razdoblju* gleda unaprijed od datuma stanja, do *Pregled unaprijed do*. Uz razdoblje *Prošli* gleda unaprijed onoliko koliko razdoblje gleda unatrag.

**Gotovo kritičan ≤ (rd):** — Zadano: 5. Kao kod pregleda unaprijed.

Blok *Sažetak* prikazuje *Datum stanja*, *Razdoblje*, *Pregled unaprijed do*, *Završ. temeljnog plana*, *Prognozirani završetak*, *Δ završetak (rd)*, *Planirano* (uz *(temeljni plan)* ili *(trenutni raspored)*), *Stvarno* te brojeve *Dovršeno*, *U tijeku*, *Nije započeto*, *Kasni* i *Kritičan*. Planirano i stvarno računaju se ponderirano trajanjem zadataka. Planirano se mjeri prema temeljnom planu ako postoji aktivni temeljni plan, inače prema trenutnom rasporedu. Odjeljci su *Dovršeno u prethodnom razdoblju*, *U tijeku*, *Počinje u sljedećem razdoblju*, *Kasni* i *Otvoreni kritični zadaci*; zadatak može biti u više odjeljaka.

## Zdravlje rasporeda

Provjera samog rasporeda za pogreške i neuobičajene vrijednosti. Na vrhu je DCMA 14-točkovna procjena. Opcije su u odjeljku *Opcije izvješća*.

**Visoka vremenska rezerva > (rd):** — Broj od 1 do 365. Zadano: 44. Učinak: nedovršen zadatak s više ukupnog slobodnog hoda od ove vrijednosti spada pod *Visoka vremenska rezerva*.

**Dugo trajanje > (rd):** — Broj od 1 do 365. Zadano: 44. Učinak: nedovršen zadatak, koji nije kontrolna točka, s duljim trajanjem spada pod *Dugo trajanje*.

**Vrijeme odgode > (rd):** — Broj od 0 do 365. Zadano: 10. Učinak: ovisnost s više vremena odgode spada pod *Dugo vrijeme odgode*. Negativno vrijeme odgode (vrijeme preklapanja) uvijek se prijavljuje.

**Gotovo kritičan ≤ (rd):** — Broj od 0 do 60. Zadano: 5. Učinak: određuje provjeru *Gotovo kritičan*.

Odjeljak *DCMA 14-točkovna procjena* dolazi prvi. Slijedi četrnaest provjera Američke agencije za upravljanje obrambenim ugovorima (US Defense Contract Management Agency), s formulama i pragovima iz njihove brošure *EVMS Program Analysis Pamphlet* (DCMA-EA PAM 200.1, listopad 2012.). Za svaku točku vidite *Broj*, *Od* (ukupno nad kojim se brojalo), *Vrijednost*, *Prag*, *Rezultat* i *Pojedinosti*. Rezultat je *Zadovoljava*, *Oznaka* ili *n.p*. Za *n.p* je razlog u pojedinostima. Oznaka nije neuspjeh. Priručnik kaže da je to razlog za dalju provjeru. Pragovi u odjeljku *Opcije izvješća* ne vrijede za ovaj odjeljak. Uvijek se koriste pragovi iz priručnika.

Broje se nedovršeni listni zadaci, bez kontrolnih točaka i hamaka, i ovisnosti prema takvim zadacima. Napomena iznad izvješća daje oba broja. Ove su četrnaest točaka:

- *Logika*: zadaci bez prethodnika ili nasljednika. Prag: najviše 5%.
- *Preklapanja*: ovisnosti s negativnim vremenom odgode. Prag: nema.
- *Vremena odgode*: ovisnosti s pozitivnim vremenom odgode, koliko god kratkom. Prag: najviše 5%.
- *Vrste ovisnosti*: udio ovisnosti vrste FS. Prag: najmanje 90%.
- *Čvrsta ograničenja*: zadaci s obveznim ograničenjem ili MSO, MFO, SNLT ili FNLT. Prag: najviše 5%.
- *Visoka vremenska rezerva*: zadaci s više od 44 radna dana ukupnog slobodnog hoda. Prag: najviše 5%. Potreban je izračun.
- *Negativna vremenska rezerva*: zadaci s ukupnim slobodnim hodom manjim od 0. Prag: nema. Potreban je izračun.
- *Veliko trajanje*: zadaci dulji od 44 radna dana. Broji se trajanje temeljnog plana ako je zadatak u aktivnom temeljnom planu, inače trenutno trajanje. Prag: najviše 5%.
- *Neispravni datumi*: stvarni početak ili stvarni završetak nakon datuma stanja, ili prognozirani početak ili prognozirani završetak prije datuma stanja. Prag: nema. Potreban je datum stanja.
- *Resursi*: zadaci bez resursa. Prag: nema. Samo ako projekt koristi resurse; inače n.p.
- *Propušteni zadaci*: od zadataka za koje temeljni plan kaže da moraju biti završeni na datum stanja ili prije njega, udio onih koji završavaju kasnije ili su prognozirani kasnije. Prag: najviše 5%. Potrebni su datum stanja i aktivni temeljni plan.
- *Test kritičnog puta*: aplikacija produljuje kritični zadatak za 100 radnih dana i na kopiji ponovno izračunava raspored, bez promjene projekta. Test prolazi ako posljednji zadatak projekta tada ne završava prije tog zadatka. Testira se kritični, nedovršeni zadatak s najranijim početkom. Pojedinosti navode naziv zadatka i za koliko se radnih dana završetak pomaknuo.
- *CPLI*: (duljina kritičnog puta + vremenska rezerva) / duljina kritičnog puta. Duljina se broji u radnim danima od datuma stanja do završetka posljednjeg zadatka. Vremenska rezerva je razlika s završetkom tog zadatka u temeljnom planu, ili izračunata vremenska rezerva ako zadatak nije u temeljnom planu. Prag: najmanje 0,95. Potreban je datum stanja.
- *BEI* (indeks izvršenja temeljnog plana): broj zadataka završenih na datum stanja, podijeljen zbrojem broja koji temeljni plan kaže da je tada trebao biti završen i broja zadataka bez temeljnog plana. Prag: najmanje 0,95. Potrebni su datum stanja i aktivni temeljni plan.

Dvije točke se razlikuju od priručnika jer aplikacija nema taj pojam: *Veliko trajanje* broji svaki nedovršeni zadatak, dok priručnik to ograničava na detaljno razdoblje planiranja (rolling wave), a *Resursi* gledaju samo dodijeljene resurse, a ne troškove. Priručnik ne daje broj za test kritičnog puta; 100 radnih dana izbor je aplikacije.

Kontrole su poredane ovim redom, s njihovom ozbiljnošću. Pogreška: *Negativna vremenska rezerva*, *Propušten rok za dovršetak*, *Prekršeno ograničenje* i *Nedosljedan napredak* (stvarni početak ili stvarni završetak nakon datuma stanja, prognozirani početak ili prognozirani završetak prije datuma stanja, 100% bez stvarnog završetka, stvarni završetak, ali ne 100%, napredak bez stvarnog početka). Upozorenje: *Bez prethodnika (otvoren početak)* i *Bez nasljednika (otvoren završetak)* (ne kontrolne točke), *Dugo trajanje*, *Vrijeme preklapanja (negativno vrijeme odgode)*, *Čvrsto ograničenje* (obvezno ograničenje ili MSO, MFO, SNLT ili FNLT), *Napredak izvan redoslijeda* i *Propušteni zadatak (u odnosu na temeljni plan)*. Informacija: *Gotovo kritičan*, *Visoka vremenska rezerva*, *Dugo vrijeme odgode*, *Vrsta ovisnosti nije FS* i *Bez resursa* (samo ako projekt koristi resurse). Izvješće gleda samo listne zadatke, bez hamaka. Blok *Sažetak* broji *DCMA oznake*, *Pogreške*, *Upozorenja*, *Informacije*, *Listni zadaci* i *Ovisnosti*. Ispod odjeljka DCMA su odjeljak *Pregled* (za svaku kontrolu ozbiljnost i broj) i odjeljak *Nalazi* (svaki zadatak ili ovisnost). Bez izračuna nedostaju kontrole koje trebaju vremensku rezervu.

## Opterećenje resursa

Za svaki resurs po tjednu ili mjesecu: što je potrebno naspram onoga što je raspoloživo. Opcije su u odjeljku *Opcije izvješća*.

**Razdoblje izvješća:** — Zadano: *Trajanje projekta*. Učinak: svaki tjedan ili mjesec koji dotiče razdoblje uključuje se u cijelosti. Tako redak prikazuje isti broj kao histogram.

**Agregacija:** — Odaberite *Tjedno* ili *Mjesečno*. Zadano: *Tjedno*. Učinak: jedan redak po kalendarskom tjednu (stupac *Tjedan od*, s ponedjeljkom) ili po kalendarskom mjesecu (stupac *Mjesec*).

**Samo preopterećena razdoblja** — Zadano: isključeno. Učinak: uključeno prikazuje samo tjedne ili mjesece s najmanje jednim preopterećenim danom.

Stupci su *Resurs*, *Vrsta*, *Tjedan od* ili *Mjesec*, *Potrebno*, *Raspoloživo*, *Odstupanja* (raspoloživo minus potrebno; negativno znači manjak), *Vrh/dan* i *Preopterećeno*. *Potrebno* je zbroj jedinica-dana. U njemu su samo tjedni ili mjeseci s potražnjom. Blok *Sažetak* broji *Resursi*, *Tjedni* ili *Mjeseci*, *Preopterećeni tjedni* ili *Preopterećeni mjeseci* i *Preopterećeni resursi*.

## Dodjele resursa

Za svaki resurs zadaci kojima je dodijeljen: što ta ekipa ili dizalica radi? Opcije su u odjeljku *Opcije izvješća*.

**Razdoblje izvješća:** — Zadano: *Trajanje projekta*. Učinak: uz razdoblje uključuju se samo dodjele zadataka koji dotiču razdoblje, plus zakašnjeli rad od prije referentnog dana. *Trajanje projekta* ne filtrira po datumu.

**Uključi dovršene zadatke** — Zadano: isključeno. Učinak: uključeno uključuje i dodjele dovršenih zadataka.

Retci su po resursu, a unutar resursa po početku. Blok *Sažetak* broji *Resursi*, *Dodjele* i *Zadaci bez resursa*. Stupci uključuju resurs, zadatak, početak i završetak, *Preostalo (rd)*, *Jed./dan*, *Dovr*, *Kritičan* i *Status*.

## Sažetak WBS-a

Raspored sažet po WBS elementu: pregled za upravljanje. Opcije su u odjeljku *Opcije izvješća*.

**Razina:** — do koje razine se prikazuje WBS. Odaberite *Cijela WBS* ili razine od 1 do 8. Zadano: razina 2. Učinak: podnaslov glasi *Zaključno s razinom 2*.

**Prikaži zadatke** — Zadano: isključeno. Učinak: uključeno prikazuje i same listne zadatke ispod svakog elementa.

Stupci uključuju *WBS*, *Naziv*, *Početak*, *Završetak*, *Početak temeljnog plana*, *Završetak temeljnog plana*, *Trajanje (wd)*, *Dovr*, *Δ završetak (rd)*, *Min. TF*, *Zad* (broj zadataka), *Ključ*, *Aktivno* i *Dovršeno*. Početak i završetak zadatka sažetka dolaze iz posljednjeg izračuna. Napredak je ponderiran trajanjem listnih zadataka. *Min. TF* i brojevi odnose se na listne zadatke ispod. Blok *Sažetak* broji *Elementi WBS-a* i *Zadaci*.

## Razdoblje izvješća

Četiri tablična izvješća i *Dijagram resursa* rade s poljem *Razdoblje izvješća*: *Look-ahead*, *Izvješće o napretku*, *Opterećenje resursa*, *Dodjele resursa* i *Dijagram resursa*. Svako izvješće pamti vlastito razdoblje. Ispod padajućeg izbornika nalaze se *Od* i *Do*, s datumima koje izbor daje.

**Referentni dan.** Razdoblje s *Sljedeći* ili *Prošli* računa se od datuma stanja projekta, ili od danas ako datum stanja nije postavljen. Tada tablična izvješća pišu *Datum stanja nije postavljen — izvješće koristi današnji datum (…).* Ako pomaknete datum stanja, prozor se pomiče zajedno s njim. Oba dana se ubrajaju.

**Sljedeći tjedan, Sljedeća 2 tjedna, Sljedeća 4 tjedna, Sljedeća 6 tjedana, Sljedeća 8 tjedana, Sljedeća 12 tjedana** — od referentnog dana. Svaki tjedan traje 7 dana. Uz datum stanja četvrtak 20. svibnja, *Sljedeći tjedan* traje od 20. do 26. svibnja, a *Sljedeća 4 tjedna* od 20. svibnja do 16. lipnja.

**Prethodni tjedan, Prethodna 2 tjedna, Prethodna 4 tjedna, Prethodna 6 tjedana, Prethodna 8 tjedana, Prethodna 12 tjedana** — isto ovih šest, ali unatrag: svaki tjedan traje 7 dana, do referentnog dana uključivo. Uz referentni dan 20. svibnja, *Prethodna 2 tjedna* traje od 7. do 20. svibnja.

**Sljedeći mjesec, Prošli mjesec** — kalendarski mjesec unaprijed ili unatrag, do dana prije istog datuma u drugom mjesecu. Uz referentni dan 20. svibnja, *Sljedeći mjesec* traje do 19. lipnja, a *Prošli mjesec* od 21. travnja do 20. svibnja.

**Trajanje projekta** — od prvog početka do posljednjeg završetka rasporeda.

**Prilagođeno** — vlastito razdoblje. Učinak: *Od* i *Do* postaju dva polja za datum. Ona počinju s datumima izbora koji ste upravo imali. Datum završetka ne smije biti prije datuma početka (*Datum završetka je prije datuma početka*), a oba polja moraju biti popunjena (*Unesite oba datuma*). Ako unos nije ispravan, izvješće ostaje na posljednjem ispravnom razdoblju.

## Vidi također

- [Izrada i ispis izvješća](docs://howto-rapport-maken-en-afdrukken): cijeli put od vrste izvješća do PDF-a.
- [Odabir razdoblja izvješća](docs://howto-rapportageperiode-kiezen): koraci i primjeri.
- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): što znače kritičan i gotovo kritičan.
- [Napredak, datum stanja i temeljni plan](docs://uitleg-voortgang): datum stanja i temeljni plan s kojima izvješća rade.
- [Rješavanje preopterećenja resursa](docs://howto-overbezetting-oplossen): što učiniti s preopterećenim tjednima iz opterećenja resursa.
- [Formati uvoza i izvoza](docs://ref-import-exportformaten): PDF uz ostale formate.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): dva temeljna plana s napretkom i datumom stanja, za pregled izvješća o odstupanjima.
