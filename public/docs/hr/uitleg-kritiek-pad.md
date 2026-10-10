# Kritični put i vremenska rezerva

Zašto je datum završetka vašeg projekta takav kakav jest? A koji zadatak može kasniti jedan dan, a da se primopredaja ne pomakne? Na ta pitanja odgovara kritični put. Ovaj članak točno objašnjava što aplikacija izračunava, na primjeru.

## Osnovni pojam

Raspored je mreža zadataka povezanih **ovisnostima**: dogovorima, na primjer „prozorski okviri ugrađuju se tek kada je krov zatvoren“. Te ovisnosti povezuju zadatke. Neki lanci zadataka su duži od drugih. Najduži lanac određuje koliko traje cijeli projekt.

Taj najduži lanac je **kritični put**. Ako jedan zadatak na njemu kasni jedan dan, primopredaja se pomiče za jedan dan. U njemu nema prostora.

Zadaci izvan kritičnog puta imaju prostora. Taj prostor se zove **vremenska rezerva**. Zidar koji gradi vanjski sloj šupljeg zida mogao bi početi dva dana kasnije, a da to nitko ne primijeti. Ta dva dana su vremenska rezerva tog zadatka.

Dakle, kritičnost ne govori ništa o tome koliko je zadatak važan. Govori samo da nema viška vremena.

Metoda izračuna zove se **CPM** (Critical Path Method). Zato se odjeljak s rezultatima u panelu *Svojstva* zove *Rezultat CPM-a*.

## Kako aplikacija izračunava

Aplikacija raspored sama ponovno ne izračunava. Izračun pokrećete naredbom **Izračunaj** (F5), na primjer preko *Početna › Raspored › Izračunaj*. Ako se nešto promijenilo od posljednjeg izračuna, traka stanja prikazuje *Zastarjelo — ponovno izračunajte (F5)*. Ako je *Automatsko izračunavanje* uključeno (pod *Postavke › Projekt › Postavke*, na kartici *Raspored*, pod naslovom *Izračunavanje*), aplikacija to radi sama.

Izračun ima dva prolaza kroz mrežu.

### Prolaz unaprijed

Aplikacija počinje na datumu početka projekta i slijedi ovisnosti od prethodnika do nasljednika. Za svaki zadatak aplikacija pronalazi najraniji dan na koji taj zadatak može početi. Ako zadatak ima više prethodnika, čeka se da zadnji od njih završi. Tako svaki zadatak dobiva svoj **najraniji početak** i **najraniji završetak**. Najkasniji od svih najranijih završetaka zadataka je datum završetka projekta.

### Prolaz unatrag

Zatim aplikacija ide unatrag, od tog datuma završetka do početka. Sada aplikacija za svaki zadatak pronalazi zadnji dan do kojeg zadatak mora završiti, a da se datum završetka projekta ne pomakne. Ako zadatak ima više nasljednika, mjerodavan je onaj koji mora prvi početi. Tako se dobiju **kasni početak** i **kasni završetak**.

### Ukupan slobodni hod i slobodni hod

Razlika između kasnog i najranijeg datuma zadatka je njegov **ukupan slobodni hod**: broj radnih dana za koji zadatak može kasniti ili kasnije početi, a da se datum završetka projekta ne pomakne. Aplikacija broji radne dane kalendara zadatka. Vikend ili praznik se ne računa.

**Slobodni hod** je strožiji pojam. To je prostor koji zadatak ima prije nego jedan od njegovih nasljednika mora kasnije početi. Taj prostor možete iskoristiti, a da to nijedan drugi zadatak ne primijeti.

Ukupan slobodni hod može se dijeliti. Ako dva nekritična zadatka slijede jedan drugi, dijele istu vremensku rezervu. Ako prvi to potroši, drugi nema više ništa. Prvi tada ima ukupan slobodni hod, ali nema slobodnog hoda. Dio ukupnog slobodnog hoda koji nije slobodan zove se **međusobno ometajuća vremenska rezerva**: ako ga iskoristite, pomiču se i zadaci iza njega. Primjer u nastavku to prikazuje brojkama.

### Negativna vremenska rezerva

Vremenska rezerva može postati i negativna. To se događa kad zadatak ima rok za dovršetak ili ograničenje koje određuje najkasniji datum, a taj datum je prije datuma koji aplikacija izračuna za taj zadatak. Na papiru zadatak već kasni, a zadatak i lanac prije njega postaju kritični.

### Kada je zadatak kritičan?

Zadano je da je zadatak kritičan kad je njegov ukupan slobodni hod 0 ili manji. To se može promijeniti pod *Postavke › Projekt › Podaci o projektu*, u odjeljku *Profil izračuna i opcije izračuna*, pod *Opcije izračuna ovog projekta*. Kada kliknete *Primijeni*, aplikacija odmah ponovno izračunava raspored. Opcije pripadaju datoteci projekta, ne aplikaciji.

- **Definicija kritičnosti** s opcijom *Ukupan slobodni hod ≤ prag* i poljem *Prag (radni dani)*. Prag je zadano 0. Ako želite zaštitni prostor, postavite ga na 2, na primjer: svaki zadatak s 2 radna dana vremenske rezerve ili manje tada se računa kao kritičan i postaje crven.
- **Označi gotovo kritične** s vlastitom postavkom *Prag*, zadano 2 radna dana. Zadatak s više od 0, ali najviše toliko vremenske rezerve, dobiva narančastu traku. To pokazuje koji zadaci gotovo nemaju vremenske rezerve, a da se ne nazivaju kritičnima.
- **Zadaci s otvorenim završetkom su kritični**: zadatak bez nasljednika koji još nije završen računa se kao kritičan. Korisno kao sigurnosna mreža protiv zaboravljenih ovisnosti (vidi pogrešne predodžbe u nastavku).
- **Izračun vremenske rezerve** određuje hoće li se ukupna vremenska rezerva mjeriti na početku zadatka, na njegovom završetku ili kao manja od ta dva. Novi projekti postavljeni su na *Automatski (standardno)*. Ako slijedite način izračuna programa Primavera P6, *Primijeni standardne opcije ovog profila* postavlja taj izbor na *Vremenska rezerva završetka*. Za MS Project isti gumb ga vraća na *Automatski (standardno)*: kad je postavljen datum stanja, MS Project sam tako izračunava.

### Gdje to vidite

Kritični zadaci imaju crvenu traku u Gantt dijagramu. Iza nekritične trake nalazi se zelena pruga do kasnog završetka zadatka: to je vremenska rezerva. Pruga se uključuje ili isključuje putem *Prikaz › Temeljni planovi i napredak › Traka vremenske rezerve*.

Za odabrani zadatak panel *Svojstva* prikazuje sve pod naslovom *Rezultat CPM-a*: najraniji i kasni početak i završetak, ukupan slobodni hod, slobodni hod i međusobno ometajuću vremensku rezervu te je li zadatak na kritičnom putu. Vremenska rezerva svih zadataka jedan pored drugoga nalazi se u stupcima pod *Izračunato* (**+** desno u zaglavlju tablice), na primjer *Ukupan slobodni hod*, *Slobodni hod*, *Kritičan* i *Gotovo kritičan*.

Traka stanja na dnu broji kritične zadatke, na primjer *Kritični put: 21 zadatak, trajanje u radnim danima: 45*.

## Radni primjer: projekt House extension

Primjer je vježbovni projekt iz lekcija, *House extension*, u stanju u kojem su sve ovisnosti postavljene. U lekciji 2, „Ovisnosti i kritični put“, sami ga gradite i provjeravate brojke. Ovdje čitate zašto su brojke takve kakve jesu.

Dogradnja počinje u ponedjeljak, 7. lipnja 2027. Nakon izračuna je primopredaja u petak, 6. kolovoza 2027, a traka stanja prikazuje *Kritični put: 21 zadatak, trajanje u radnim danima: 45*. Dva zadatka nisu kritična: *Build outer cavity leaf* i *Painting*.

### Dva lanca koja se spajaju

Nakon nosive međukatne konstrukcije (*Lay hollow-core floor*, završeno u ponedjeljak, 28. lipnja) radovi se dijele na dva lanca. Oba završavaju na *Install window frames*:

- Unutarnji lanac: *Build inner cavity leaf* (5 radnih dana), zatim *Place roof elements* (1), zatim *Apply roofing* (2). Prozorski okviri mogu se ugraditi tek kad je krov zatvoren.
- Vanjski lanac: *Build outer cavity leaf* (6 radnih dana). Okviri su u fasadi, pa i to mora biti završeno.

**Unaprijed.** Oba sloja šupljeg zida mogu početi u utorak, 29. lipnja. Unutarnji sloj je završen u ponedjeljak, 5. srpnja. Krovni elementi postavljaju se u utorak, 6. srpnja, a pokrivanje krova slijedi u srijedu i četvrtak, 7. i 8. srpnja. Vanjski sloj je završen u utorak, 6. srpnja. *Install window frames* čeka kasniji od dva lanca, odnosno pokrivanje krova, pa počinje u petak, 9. srpnja.

**Unatrag.** Okviri moraju početi najkasnije u petak, 9. srpnja, inače se primopredaja pomiče. Zato vanjski sloj mora biti završen najkasnije u četvrtak, 8. srpnja. Šest radnih dana unatrag to je kasni početak u četvrtak, 1. srpnja.

**Vremenska rezerva.** Vanjski sloj može najranije početi 29. lipnja, a mora početi najkasnije 1. srpnja. Između su 2 radna dana: srijeda, 30. lipnja, i četvrtak, 1. srpnja. To je njegov ukupan slobodni hod. Panel prikazuje *Ukupan slobodni hod: 2 dana* i *Kritični put: Ne*. Slobodni hod je također 2 dana, jer je njegov jedini nasljednik, *Install window frames*, na kritičnom putu.

Unutarnji lanac nema vremenske rezerve. Svaki dan kašnjenja tu pomiče okvire i sve nakon njih.

### Painting

*Painting* (3 radna dana) počinje nakon žbukanja, u ponedjeljak, 26. srpnja, i završava u srijedu, 28. srpnja. Sljedeći zadatak, *Snagging and cleaning*, također čeka popločavanje. Taj zadatak završava tek u četvrtak, 5. kolovoza, jer se estrih mora prvo pet radnih dana sušiti. *Painting* tako može trajati do četvrtka, 5. kolovoza. To daje 6 radnih dana vremenske rezerve: 29. i 30. srpnja te 2. do 5. kolovoza. I ovdje je slobodni hod jednak ukupnom slobodnom hodu, jer je nasljednik kritičan.

### Kada vanjski sloj kasni

Ako vanjski sloj traje 8 radnih dana umjesto 6, završava u četvrtak, 8. srpnja: točno na svoj kasni završetak. Vremenske rezerve nema više i zadatak postaje crven. Oba lanca su tada kritična i traka stanja broji 22 kritična zadatka. Primopredaja ostaje u petak, 6. kolovoza.

Ako traje 9 radnih dana, vanjski sloj je tek završen u petak, 9. srpnja. Okviri se pomiču na ponedjeljak, 12. srpnja, a primopredaja na ponedjeljak, 9. kolovoza: jedan radni dan kasnije. Vanjski lanac je sada kritični put. Traka stanja prikazuje *Kritični put: 19 zadataka, trajanje u radnim danima: 46*.

Unutarnji lanac tada ima 1 radni dan ukupnog slobodnog hoda, ali taj dan se dijeli:

- *Build inner cavity leaf*: ukupan slobodni hod 1, slobodni hod 0, međusobno ometajuća vremenska rezerva 1. Ako unutarnji sloj kasni jedan dan, krovni elementi se pomiču s njim.
- *Place roof elements*: ukupan slobodni hod 1, slobodni hod 0, međusobno ometajuća vremenska rezerva 1.
- *Apply roofing*: ukupan slobodni hod 1, slobodni hod 1. Samo ovdje jedan dan kašnjenja nikoga ne košta ništa.

Riječ je o istom jednom danu koji dijeli cijeli lanac. Ako ga unutarnji sloj iskoristi, nestaje za krovne elemente i pokrivanje krova.

### Gotovo kritični i negativna vremenska rezerva

Kad je *Označi gotovo kritične* uključeno uz zadani prag od 2 radna dana, vanjski sloj s točno 2 dana vremenske rezerve dobiva narančastu traku. *Painting*, sa 6 dana vremenske rezerve, ostaje plavo.

Ako primopredaja dobije rok za dovršetak u srijedu, 4. kolovoza, dva radna dana prije izračunate primopredaje, vremenska rezerva postaje negativna. Svih 21 zadatak na kritičnom putu dobiva ukupan slobodni hod od −2 radna dana. Vanjski sloj više nema vremenske rezerve i također postaje kritičan. *Painting* zadržava 4 radna dana vremenske rezerve.

## Posljedice i pogrešne predodžbe

**„Kritično znači važno.“** Ne. Pregled može biti presudan, a ipak imati vremensku rezervu. Obrnuto, jednostavan posao može biti kritičan: u primjeru je *Snagging and cleaning* na kritičnom putu. Kritičnost se odnosi samo na vrijeme: nema više rezerve.

**„Ovaj zadatak ima vremensku rezervu, pa može čekati.“** Najprije pogledajte slobodni hod. Ako zadatak ima ukupan slobodni hod, ali nema slobodnog hoda, svaki dan kašnjenja oduzima vremensku rezervu zadacima iza njega, kao kod unutarnjeg sloja u slučaju od 9 radnih dana.

**Zaboravljena ovisnost daje lažnu vremensku rezervu.** Zadatak bez nasljednika dobiva vremensku rezervu do završetka projekta. Ako u primjeru nedostaje ovisnost od vanjskog sloja do okvira, vanjski sloj bi odjednom imao 23 radna dana vremenske rezerve, do primopredaje 6. kolovoza. Na papiru bi tada mogao kasniti tjednima, a da okviri ne čekaju. Kad je uključeno *Zadaci s otvorenim završetkom su kritični*, vanjski sloj u tom slučaju postaje kritičan i propust se vidi.

**Kritični put nije fiksan.** Ako nekritični zadatak kasni više od svoje vremenske rezerve, drugi lanac postaje najduži. Vidjeli ste to gore s 9 dana zidanja. Zato se raspored mora ponovno izračunati nakon svake promjene. Dok traka stanja prikazuje *Zastarjelo*, crvene trake i dalje pripadaju prethodnom izračunu.

**Vremenska rezerva se broji u radnim danima.** Vremenska rezerva za *Painting* od 6 radnih dana traje od četvrtka, 29. srpnja, do četvrtka, 5. kolovoza: osam kalendarskih dana, jer se vikend ne računa. Ni praznik ni kolektivni godišnji odmor u građevinarstvu u kalendaru se ne računaju.

## Vidi također

- [Dodavanje ovisnosti](docs://howto-relaties-leggen): koraci za povezivanje zadataka i postavljanje vremena odgode.
- [Ovisnosti i vrijeme odgode](docs://uitleg-relaties): kako ovisnosti i vrijeme odgode određuju najranije datume.
- [Ograničenja i rokovi za dovršetak](docs://uitleg-constraints): kako ograničenje ili rok za dovršetak stvara negativnu vremensku rezervu.
- [Praćenje puta](docs://howto-pad-traceren): praćenje lanca iza zadatka.
- [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies): definicija kritičnosti, gotovo kritični zadaci i izračun vremenske rezerve, opcija po opciji.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): velik projekt s više puteva vremenske rezerve, gotovo kritičnim zadacima (prag 3 radna dana), hamakom, čvrsto fiksiranim datumom i međuzavisnošću projekata.
