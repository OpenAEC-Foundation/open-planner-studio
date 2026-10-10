# Dobro planiranje

Što čini raspored dobrim? Nije važno koliko izgleda uredan, nego može li odgovoriti na pitanje koje je važno kad rad počne: ako se ovo pomakne, što će to značiti za predaju? Ovaj članak objašnjava načela pouzdanog rasporeda i zašto su ona u Open Planner Studio tako važna. Aplikacija računa samo s onim što unesete, a ni s čim drugim.

Primjeri su iz građevinarstva: konstrukcijski radovi, završni radovi, rokovi nabave, kašnjenje zbog vremenskih uvjeta, podizvođači i ugovorni datum predaje. Sama načela nisu vezana uz građevinarstvo.

## Pojam

Dobar raspored nije slika onoga čemu se nadate, nego **model za izračun**: zadaci s trajanjem, povezani ovisnostima, u kalendaru. Aplikacija izračunava datume iz tog modela. Kad se nešto promijeni, pokreće se ponovno izračunavanje modela, pa odmah vidite što to znači za ostatak.

Planer radi fiksnim redoslijedom:

1. Cilj: kontrolne točke i datum predaje.
2. Razrada: faze, radni paketi, zadaci.
3. Trajanje svakog zadatka.
4. Ovisnosti.
5. Ograničenja i fiksni datumi.
6. Kalendari.
7. Resursi.
8. Kritični put i vremenska rezerva.
9. Temeljni plan i napredak.
10. Pregled.

Taj redoslijed nije formalnost. Ako preskočite korak, kasnije se pojavi kao iznenađenje: zadaci bez ovisnosti ne slijede ostale zadatke, trajanja bez kalendara su netočna, a temeljni plan koji spremite tek naknadno zamrzava kašnjenje umjesto dogovora.

## Kako aplikacija izračunava pomoću toga

Svako načelo u nastavku povezano je s nečim što aplikacija radi. Zato ovaj dio slijedi isti redoslijed.

### Krenite od cilja, a ne od zadataka

Najprije upišite trenutke koji su fiksni, pa tek onda posao koji se mora uklopiti među njih: početak pripreme gradilišta, konačna dozvola, zgrada zaštićena od vremenskih utjecaja, početak završnih radova, predaja. To su **kontrolne točke**: točke bez trajanja. Unosite ih kao kontrolnu točku (*Početna › Zadaci › Kontrolna točka ▾*), a ne kao zadatak s trajanjem od nula dana i imenom koje na nju podsjeća.

Zašto ovaj redoslijed: raspored koji kreće od popisa zadataka postane zbroj, a zbroj rijetko pada na datum iz ugovora. Krenete li od kontrolnih točaka, odmah postavljate pravo pitanje: ne „koliko sve to zajedno traje“, nego „uklapa li se posao između ova dva trenutka, a ako ne, što se mora promijeniti“. Računajte unatrag od traženog datuma predaje do trenutka kada zgrada najkasnije mora biti zaštićena od vremenskih utjecaja, a od tada do početka.

Predaja koja je ugovorom fiksirana dobiva potvrdni okvir *Obvezno (ugovorno)*. Tako svatko tko otvori datoteku vidi da taj trenutak nije ni predmet pregovora ni nešto što se može pomaknuti. Potvrdni okvir je oznaka za Gantt prikaz i izvješća; ne štiti datum. To radite rokom za dovršetak ili ograničenjem (vidi dolje).

### Razrada: faze, radni paketi, zadaci

Ispod kontrolnih točaka gradite strukturu: faze, ispod njih radne pakete, a ispod njih zadatke. To radite tako da zadatke uvučete. Zadatak s podzadacima automatski postaje **zadatak sažetka**: aplikacija iz zadataka ispod izvodi njegovu traku i trajanje. Zato nikada sami ne upisujte trajanje za zadatak sažetka.

Okvirno pravilo za razinu detalja: **zadatak traje otprilike od jednog dana do dva tjedna**. Kraće od jednog dana znači da planirate radnu površinu umjesto projekta. To pripada tjednom planu voditelja gradilišta, a ne modelu izračuna koji mora trajati mjesecima. Dulje od dva tjedna znači zadatak koji ne možete ispravno procijeniti i ne možete pratiti tijekom izvedbe: „finishing ground floor, 40 days, 45% complete“ nikome ne pokazuje ide li sve dobro. Zato revizije rasporeda često broje koliko zadataka traje dulje od otprilike dva mjeseca; iznad nekoliko postotaka to se smatra nedostatkom detalja.

Preveliki detalj škodi jednako kao prevelika grubost. Svaki zadatak iziskuje održavanje: ovisnosti koje treba povući, napredak koji treba zabilježiti, novu procjenu nakon svake promjene. Raspored od dviju tisuća zadataka za projekt od šest mjeseci ne postaje točniji, nego neodržavan. A raspored koji nitko ne ažurira za tri tjedna je fikcija. Odaberite razinu na kojoj možete svaki tjedan iskreno izvijestiti o napretku.

U praksi: „3. Finishing“ je faza, „Finishing house 4“ radni paket, „Plastering house 4 ground floor“ zadatak od pet dana. Namjerno smijete prekoračiti gornju granicu za rokove isporuke i nadzor: isporuka prozorskog okvira u trajanju od deset tjedana zaista je jedan nedjeljivi blok čekanja, a kontinuirani nadzor pripada u hamak, a ne u niz umjetnih dijelova.

### Procjena trajanja

Trajanje je procjena koliko posao traje, a ne koliko brzo bi mogao ići. Procijenite za uobičajen dan s ekipom koju stvarno dobijete, a ne za najbolji dan s najboljom ekipom. Optimizam se zbraja duž lanca: raspored u kojem svaki zadatak pretpostavlja najbolji dan gotovo nikada ne ispuni datum predaje.

Dani ili sati prava su odluka, a ne pitanje oblikovanja. Odaberite **dane** za posao koji određuje tempo na gradilištu: zidanje, žbukanje, polaganje pločica. Taj posao traje pet dana, bez obzira na to je li dan osam ili devet sati. Odaberite **sate** kada su sati sami jedinica mjere i kada je ostatak dana važan: pregled u trajanju od tri sata, ulijevanje betona u trajanju od četrnaest sati raspoređeno na dva dana, rad u smjenama. Aplikacija taj izbor pohranjuje po zadatku.

Nemojte skrivati rizik u pojedinim trajanjima. Dodavanje dana svuda sakrije rezervu, pa je nitko više ne može vidjeti ni njome upravljati. A tamo gdje je rezerva zaista bila potrebna, ispadne premala. Učinite rezervu vidljivom: izričit zadatak za puferiranje prije datuma predaje ili zasebnu rezervu za vremenske uvjete. Pazite na dvostruko računanje: otprilike 180 radnih dana godišnje u kojima se može raditi, što nizozemski sektor građevinarstva koristi kao računsku osnovu, ugovorna je godišnja brojka (UAV) iz koje su već oduzeti državni praznici, kolektivni godišnji odmor *i* izgubljeni dani. Ako su praznici i godišnji odmor već u vašem kalendaru projekta, ostaje samo kašnjenje zbog vremena kao zasebna stavka. Kašnjenja zbog mraza i oluje slijede vlastita pravila iz kolektivnog ugovora Onwerkbaar weer Bouw & Infra. Te očekivane izgubljene dane upišite u kalendar ili u zasebnu stavku, a ne skrivajte ih u trajanju zidarskih radova.

### Ovisnosti: bez mreže nema rasporeda

Aplikacija izračunava datume duž **ovisnosti**: zadatak počinje tek kada to dopuste njegovi prethodnici. Zadatak bez ovisnosti ni s čim nije povezan. Ako konstrukcijski radovi kasne dva tjedna, nepovezan završni zadatak neće slijediti, a raspored laže, a da ništa ne pocrveni.

Zato svaki zadatak mora imati barem jednog prethodnika i barem jednog nasljednika. Izuzeti su samo prvi zadatak projekta i posljednja kontrolna točka. U reviziji rasporeda ovo je prva provjera: najviše nekoliko postotaka zadataka smije imati nedostajuću logiku.

**Završetak-početak je zadana vrsta**, i tako treba ostati: temelj gotov, zatim konstrukcijski radovi. U zdravom građevinskom rasporedu otprilike devet od deset ovisnosti su završetak-početak. To je zahtjev za čitljivost: završetak-početak jedina je vrsta koju svatko na gradilištu razumije bez objašnjenja, a tijekom izvedbe ponaša se predvidljivo.

**Početak-početak s vremenom odgode** služi za posao koji se stvarno odvija usporedo, a ne čeka. Klasičan slučaj je niz kuća ili toranj s katovima: instalater kasni tri dana za zidarima. To je početak-početak s vremenom odgode od tri dana, a ne završetak-početak na umjetno razdijeljenom zadatku. Uz to postavite ovisnost završetak-završetak, inače bi nasljednik teoretski mogao završiti prije prethodnika. U građevinarstvu početak-završetak gotovo nikada ne koristite.

Po mogućnosti povucite početak-početak između zadataka, a ne između faza. Ako je prethodnik početka-početka ili početka-završetka faza, aplikacija čeka zadatak u toj fazi koji počinje **zadnji**, a ne prvi. Zato nikada ne planira prerano, ali ponekad kasnije nego što ste htjeli. Završetak-početak i završetak-završetak s fazom kao prethodnikom čekaju da završi zadnji zadatak u njoj, a to je obično upravo ono što mislite.

S vremenima odgode budite štedljivi, a posebno s negativnima. Vrijeme odgode je vrijeme čekanja bez vidljivog razloga: kasnije nitko ne može reći zašto su između dva zadatka sedam dana. Ako je riječ o njegovanju betona, unesite to kao odgodu u kalendarskim danima (beton njeguje i vikendom), ili još bolje, stvarni zadatak „curing“, koji svi mogu vidjeti i pratiti. Negativno vrijeme odgode — vrijeme preklapanja, odnosno preklapanje — uopće ne bi smjelo postojati; u reviziji rasporeda norma je nula. Ako želite preklapanje, podijelite prethodnika ili upotrijebite početak-početak.

### Ograničenja i fiksni datumi: što manje

Svaki zadatak počinje kao „što prije moguće“ i u velikoj većini slučajeva tako treba i ostati. **Ograničenje** je granica datuma uz ovisnosti. Što ih više dodate, to raspored manje izračunava i to više postaje crtež. Plan pun fiksnih datuma djeluje stabilno i upravo zato skriva rizik: ne pomiče se, pa više ne upozorava.

Ograničenje upotrijebite samo za čvrsti vanjski datum na koji sam raspored nema utjecaja: dozvola koja neće biti konačna prije 1. ožujka (*Ne početi prije (SNET)*), period zatvaranja koji je odobrila općina, datum priključka kod komunalnog poduzeća. „Ovaj zadatak želim u svibnju“ nije vanjska činjenica; to riješite logikom ili drugim trajanjem. Okvirno pravilo: najviše nekoliko postotaka preostalih zadataka nosi čvrstu granicu datuma.

Nikada ne upisujte datum početka samo da zadatak postavite tamo gdje ga želite. Za zadatak s prethodnikom aplikacija upisani (ili povučeni) početak pretvara u ograničenje *Ne početi prije (SNET)*. Zadatak je tada tamo gdje ga želite, i ostaje tamo čak i kada cijeli lanac prije njega kasni.

Ako želite pratiti datum, a da ne upravljate izračunom, upotrijebite **rok za dovršetak**. Ništa ne pomiče, ali kada zadatak više ne ispunjava rok, daje negativnu vremensku rezervu i upozorenje. Upravo je to signal koji želite vidjeti. Za krajnji slučaj zadržite čvrsto fiksiranje (*Obvezno (logika fiksiranja)*). Pritom znajte da ono daje negativnu vremensku rezervu u lancu prije njega: raspored tada kaže da se ne uklapa, a ne da je nešto pokvareno.

### Kalendari: prvo projekt, zatim iznimke

Sva trajanja se broje u radnim danima ili radnim satima kalendara. Zato ispravno postavite kalendar projekta prije nego unesete trajanja: radni dani, radno vrijeme, državni praznici i kolektivni godišnji odmor u građevinarstvu. Kalendar koji ispravljate usred rada pomiče cijeli vaš raspored. Odmah dodajte predvidiva zatvaranja: razdoblje mraza u kojem ne ulijevate beton, godišnji odmor poduzeća između Božića i Nove godine.

Resursu dodijelite vlastiti kalendar samo ako se stvarno razlikuje: izvođač fasade koji dolazi četiri dana u tjednu, ekipa koja ima drugačiji ljetni godišnji odmor. Kalendar resursa ne mijenja nijedan datum zadatka; zadatak i dalje teče u kalendaru zadatka ili projekta. Kalendar resursa samo pokazuje da resurs ne radi na jednom od radnih dana zadatka, što se u histogramu vidi kao preopterećenje resursa. Tu razliku teško je uočiti ako ne znate da ste je sami stvorili.

### Resursi: tko to radi i je li to moguće

Raspored bez resursa odgovara samo na pola pitanja. Čim dodijelite ekipe i opremu, histogram pokazuje ono što sama vremenska crta ne može: da 14. lipnja trebate tri ekipe za žbukanje, a imate dvije.

Počnite s resursima koji su usko grlo. Nije potrebno uključiti svaki vijak; uključite toranjsku dizalicu, vaše vlastite ekipe, podizvođače s gornjom granicom kapaciteta i duge rokove isporuke. Svakom resursu dodijelite iskren kapacitet: dva žbukara znače dva, a ne „dva, ali u nuždi tri“.

Histogram čitajte kao pitanje, a ne kao pogrešku. Crveno iznad crte znači da raspored traži više nego što imate tog dana. Ponekad je odgovor: pomaknite. Često je odgovor: ovo neće uspjeti, a upravo to sam želio znati. **Uravnoteživanje** pomiče zadatke dok se potražnja ne uklopi u kapacitet. Ako datum završetka može popustiti, dopustite to; ako je datum predaje fiksiran, uravnotežite samo unutar vremenske rezerve (potvrdni okvir *Uravnoteživanje samo unutar vremenske rezerve (smoothing) — datum završetka projekta ostaje nepromijenjen*). Datum završetka tada ostaje gdje jest, a ostaje prijavljeni preostali sukob. To je iskreniji ishod od rasporeda koji samo izgleda riješen.

*Nemojte* uravnotežiti kada je potražnja strukturno veća od kapaciteta. Uravnoteživanje premješta postojeći posao u vremenu; ne unajmljuje dodatne žbukare i ne gradi drugu dizalicu. Tri tornja kojima je u isto vrijeme potrebna ista ekipa i nakon uravnoteživanja su tri tornja kojima je potrebna ista ekipa; jedina se promjena sastoji u tome što se predaja pomiče. Tada pomaže etapiranje, dodatni kapacitet ili drugačiji posao. Nemojte uravnotežiti ni prije nego što su logika i trajanja postavljeni: uravnotežavali biste raspored koji će sutra već biti drugačiji.

### Kritični put i vremenska rezerva: gdje je raspored ranjiv

Aplikacija ne računa ponovno uz svaku promjenu. Izračunajte pomoću naredbe **Izračunaj** (F5) i tek tada čitajte. Ako traka stanja kaže *Zastarjelo — ponovno izračunajte (F5)*, gledate prethodni izračun, a ne ovaj. Uz postavku *Automatsko izračunavanje* aplikacija to radi sama.

**Kritični put** je lanac bez vremenske rezerve: svaki dan izgubljen tamo znači kasniju predaju. Tamo idu vaš nadzor i vaši najbolji ljudi. Ne gledajte samo crveno. **Ukupan slobodni hod** kaže koliko zadatak može kasniti, a da ne utječe na predaju; **slobodni hod** kaže koliko može kasniti, a da ne pomakne svog nasljednika. Razlika ničiji datum završetka ne mijenja, ali nekome smeta. Korisno je kada radite s podizvođačima koje ne možete dvaput rasporediti.

Pazite na tri signala. Zadatak s nekoliko dana vremenske rezerve nije siguran zadatak, nego gotovo kritičan zadatak. Uz *Označi gotovo kritične* takvi zadaci dobivaju vlastitu boju. Zadatak s izrazito velikom vremenskom rezervom — u revizijama rasporeda više od 44 radna dana, otprilike dva mjeseca — gotovo uvijek nema nasljednika; to vas odmah upućuje na praznine u mreži. A negativna vremenska rezerva nikada nije pogreška izračuna: raspored tada kaže da se rok za dovršetak ili fiksni datum ne uklapa.

### Temeljni plan prije početka, zatim ga redovito ažurirajte

Snimite **temeljni plan** čim je raspored odobren i prije nego što lopata zabode u zemlju (*Raspored › Temeljni planovi i napredak › Upravljaj temeljnim planovima…*). Prvo izračunajte: temeljni plan pohranjuje datume posljednjeg izračuna. Bez te reference kasnije možete reći samo *da* stvari idu drugačije, ali ne koliko ni od kada. Upravo to trebate na sastanku na gradilištu, za dodatne radove i kada se raspravlja o kašnjenju.

Temeljni plan pohranjuje datume, ali ne pretpostavke iza njih, a upravo se one pitaju čim se raspravlja o kašnjenju. Zato ga pri snimanju kratko zapišite na čemu se raspored temelji (u praksi rasporeda: *osnova rasporeda*): koje brojke produktivnosti ste koristili, koji kalendar i zašto je tako postavljen, što ste namjerno izostavili iz rasporeda, tko je dao rokove isporuke koje ste pretpostavili i tko je odobrio raspored. Pola stranice je dovoljno.

Nakon toga redovito ažuriranje je ritam, a ne projekt. Ažurirajte svaki tjedan, istim redoslijedom: postavite **datum stanja** na datum izvješća, upišite stvarni početak i stvarni završetak za ono što je počelo i završilo, ispravite preostalo trajanje onoga što je u tijeku i izračunajte. Sam postotak nije dovoljan: stvarni datumi su činjenična evidencija koja će se kasnije pregledavati.

Znajte što radi datum stanja: posao koji još nije počeo aplikacija pomiče na datum stanja, a zadaci iza njega idu zajedno s njim (osim u profilu izračuna *Microsoft Project*). Zato, ako zaboravite potvrditi završen zadatak ili kontrolnu točku, on se sam pomakne udesno. To nije greška, nego model koji odbija pretpostaviti da se nešto u prošlosti još može dogoditi. Ako dobijete upozorenje *Izvan redoslijeda*, posao je rađen drugim redoslijedom od onoga koji propisuje logika; to je obično razlog da revidirate slijed, a ne da upozorenje odbacite klikom. Novi temeljni plan snimite samo za stvarnu promjenu opsega, i to pored prvog, a ne preko njega.

Naposljetku: raspored je pouzdan samo ako mu vjeruju ljudi koji rade. Neka voditelj gradilišta i podizvođači usporede tjedni plan s ovim modelom. Ako iz tjedna u tjedan ostvarujete samo polovicu dogovorenog, problem je češće u rasporedu nego u izvedbi.

## Primjer: tri izbora koji tiho čine raspored netočnim

Brojevi potječu iz dvaju primjera koji su obrađeni drugdje u Pomoći: vježbeni projekt *House extension* iz lekcija i mala mreža za jednu dogradnju. Ovdje je važno što svaki izbor mijenja u vašem rasporedu. Sami to isprobajte u lekciji 2 (ovisnosti i kritični put) i u lekciji 3 (ograničenje i rok za dovršetak).

### Zaboravljena ovisnost

U dogradnji dogradnja počinje u ponedjeljak, 7. lipnja 2027., a primopredaja je u petak, 6. kolovoza. *Build outer cavity leaf* (6 radnih dana) ima *Install window frames* kao svoj nasljednik, jer se okviri nalaze u pročelju. S tom ovisnošću outer leaf ima vremensku rezervu od 2 radna dana.

Ako zaboravite tu ovisnost, outer leaf odjednom ima 23 radna dana vremenske rezerve do primopredaje. Na papiru može kasniti tjednima, a da nitko ne čeka na njega. Ništa ne postaje crveno i ne pojavljuje se nikakvo upozorenje. Samo uz opciju izračuna *Zadaci s otvorenim završetkom su kritični* takav zadatak bez nasljednika postaje kritičan, pa se praznina ističe.

### Upisani datum umjesto ovisnosti

Mala mreža: *Groundwork* (3 radna dana), *Pour foundation* (2), *Brickwork* (5) i *Roofing* (3), jedan za drugim, od ponedjeljka, 7. lipnja 2027. Projekt završava u srijedu, 23. lipnja.

Ako upišete početak u ponedjeljak, 21. lipnja za *Brickwork*, jer cigle stižu tek tada, to postaje ograničenje *ne početi prije*. Brickwork se pomiče za tjedan dana, a projekt završava u srijedu, 30. lipnja. *Groundwork* i *Pour foundation* dobivaju vremensku rezervu od 5 radnih dana i više nisu kritični. Ako cigle ipak stignu ranije, Brickwork ostaje na 21. lipnja: sada upravlja datum, a ne ovisnosti.

Ako umjesto toga upišete srijedu, 9. lipnja, prije nego što je temelj završen, ništa se ne događa: ovisnosti svejedno dopuštaju da brickwork počne tek u ponedjeljak, 14. lipnja.

### Rok za dovršetak umjesto ograničenja

Ako želite da *Roofing* bude završen u petak, 18. lipnja, na njega postavite rok za dovršetak. Ništa se ne pomiče: roofing ostaje od ponedjeljka, 21. do srijede, 23. lipnja. Ali lanac dobiva vremensku rezervu od −3 radna dana, a aplikacija prikazuje *Rok za dovršetak 18-06-2027 je propušten. Najraniji završetak: 23-06-2027*. Odmah vidite da se dogovor ne uklapa. To je bolje nego traka na pravom mjestu s lancem iza nje koji to ne ostvaruje.

## Posljedice i pogrešna shvaćanja

- **Zadaci bez prethodnika ili nasljednika.** Najčešća je i najštetnija pogreška: takvi zadaci se ne pomiču zajedno s ostalima i dobivaju lažnu vremensku rezervu.
- **Upisivanje datuma ili povlačenje traka umjesto crtanja ovisnosti.** Tako se tiho postavlja ograničenje.
- **Previše ograničenja i čvrsto fiksiranje zadatka kao oznaka.** Raspored tada više ne izračunava, nego samo crta.
- **Zadaci u trajanju od tri mjeseca ili od pola dana.** Upotrebljiv raspon je otprilike između jednog dana i dva tjedna.
- **Optimistička trajanja i margina skrivena u svakom pojedinom zadatku** umjesto da bude vidljiva kao pufer.
- **Vremenski zastoji i kolektivni godišnji odmor u građevinarstvu nisu u kalendaru.** U siječnju ćete ih ipak morati dodati.
- **Vrijeme odgode umjesto zadataka.** Sedam dana neimenovanog čekanja tri mjeseca kasnije nitko ne može objasniti.
- **Uravnoteživanje prije nego što su ovisnosti postavljene**, ili nastavak uravnoteživanja uz strukturni nedostatak kapaciteta.
- **Zaboravljanje izračunavanja.** *Zastarjelo* u traci stanja znači da gledate prethodni izračun.
- **Nema temeljnog plana ili je temeljni plan spremljen tek nakon početka.**
- **Napredak upisan samo kao postotak**, bez stvarnih datuma i bez datuma stanja.
- **Zatvaranje okna *Upozorenja* bez čitanja.** Tu se spajaju propušteni rokovi za dovršetak, prekršena ograničenja, ovisnosti izvan redoslijeda i preopterećenja resursa (*Planiranje › Raspored › Upozorenja*).

## Pogledajte i

- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): kako aplikacija izračunava najranije datume, kasne datume i vremensku rezervu.
- [Ovisnosti i vrijeme odgode](docs://uitleg-relaties): četiri vrste ovisnosti, vrijeme odgode i ovisnosti na fazi.
- [Ograničenja i rokovi za dovršetak](docs://uitleg-constraints): što svako ograničenje i rok za dovršetak mijenjaju u izračunu.
- [Kalendari i radni dani](docs://uitleg-kalenders): kako aplikacija broji radne dane i koji kalendar ima prednost.
- [Dani i sati](docs://uitleg-dagen-en-uren): raspored u danima, u satima ili kombinirano.
- [Uravnoteživanje resursa](docs://uitleg-nivelleren): što uravnoteživanje pomiče i što ne pomiče.
- [Napredak, datum stanja i temeljni plan](docs://uitleg-voortgang): što čini datum stanja i kako čitati odstupanje.
- [Dodavanje zadataka i kontrolnih točaka](docs://howto-taken-en-mijlpalen-toevoegen): unos kontrolnih točaka i zadataka.
- [Dodavanje ovisnosti](docs://howto-relaties-leggen): povezivanje zadataka.
- [Povezivanje AI pomoćnika (MCP)](docs://howto-ai-assistent-koppelen): pomoćnik koji planira prema tim načelima.
- [Obavijesti i upozorenja](docs://ref-meldingen): sva upozorenja na jednom mjestu.
