# Okno resursa

Okno resursa služi za upravljanje resursima: tko i što je dostupno, s kojim kapacitetom i na kojem kalendaru. Histogram ispod Gantt-a i preopterećenje resursa pripadaju tom oknu. Ovaj članak za svako polje i gumb opisuje što radi, koja je zadana vrijednost i što ćete primijetiti. Kako stvoriti i dodijeliti resurse, pročitajte u [Upravljanje resursima](docs://howto-resources-beheren) i [Dodjela resursa s krivuljom](docs://howto-resource-toewijzen). Rješavanje preopterećenja resursa opisano je u [Rješavanje preopterećenja resursa](docs://howto-overbezetting-oplossen).

## Gdje ga pronaći

- **Cijeli panel** — *Resursi › Upravljanje › Resursi* ili *Prikaz › Paneli › Resursi*. Zauzima cijeli radni prostor. Križić gore desno ga zatvara.
- **Usidrenje resursa** — *Resursi › Upravljanje › Usidrenje resursa* ili *Prikaz › Paneli › Usidrenje resursa*: kompaktan popis u desnom stupcu, uz Gantt. Pogledajte dolje.
- **Histogram** — *Resursi › Histogram › Histogram* ili *Prikaz › Paneli › Histogram*: pojas ispod Gantt-a. Pogledajte dolje.
- **Prikazi** — ako vaš projekt pripada biblioteci resursa, gore desno u oknu možete birati između *Biblioteka*, *Projekt* i *Zauzetost*. Bez biblioteke postoji samo tablica projekta. Pri svakom otvaranju okno počinje u prikazu *Projekt*. Tako ne završite nehotice u zajedničkoj biblioteci.

## Novi resurs

- **Novi resurs u projektu** (u prikazu *Biblioteka* *Novi resurs u biblioteci*) — gumb gore desno. Otvara nacrt retka na dnu tablice. Resurs se ne stvara dok ne unesete naziv i ne napustite redak (ili ne pritisnete Enter). Ako kliknete izvan praznog retka ili pritisnete Esc, ništa ne ostaje: ni resurs ni korak pod *Poništi*. Polja možete popuniti bilo kojim redoslijedom; sve se sprema odjednom. Enter ili strelica dolje potvrđuje redak i otvara novi nacrt. Shift+Enter ili strelica gore potvrđuje redak i vraća vas u tablicu. Nacrt nema strelicu za kapacitet, olovku kalendara ni kantu za smeće, jer one rade s resursom koji još ne postoji. Gumb *Novi resurs* pod *Resursi › Upravljanje* radi isto.
- **Kretanje po tablici** — u tablici Enter i Shift+Enter te strelice gore i dolje pomiču kursor između redaka. Enter u zadnjem retku otvara novi nacrt.

## Prikaz Projekt

Tablica onoga što ovaj projekt koristi. Svaki redak je jedan resurs. Promjene teksta i standardne tarife vrijede čim napustite polje i broje se kao jedan korak pod *Poništi*.

- **Boja** — birač boja. Zadano: prva slobodna boja iz palete. Učinak: boja naglaska resursa ispod traka Gantt-a (*Prikaz › Temeljni planovi i napredak › Naglasak resursa*) i boja uzorka u usidrenju resursa.
- **Naziv** — naziv resursa. Prazan naziv se ne čuva; polje vraća stari naziv.
- **Vrsta** — *Radna snaga*, *Oprema*, *Materijal*, *Podizvođač* ili *Ekipa*. Zadano za novi resurs: *Radna snaga*. Učinak: *Materijal* ima polje *Jedinica mjere*, ne ubraja se u zbroj *Svi resursi* u histogramu, a uravnoteživanje ga preskače. Vrsta *Ekipa* može se odabrati za polje *Ekipa* drugih resursa. Ostale vrste računaju jednako.
- **Maksimalan postotak jedinica** — koliki dio resursa je dostupan po danu. Broj veći od 0; razlomci su dopušteni. Zadano: 1. Učinak: kapacitet po danu. Ako je opterećenje veće, resurs ima preopterećenje resursa. Strelica pored njega otvara *Kapacitet po vremenskim fazama*; broj pored strelice je broj koraka.
- **Kapacitet po vremenskim fazama** — koraci s *Od* (datum) i *Maksimalan postotak jedinica*. *Dodaj korak* dodaje korak s današnjim datumom i vrijednošću 1. Bez koraka piše *Nema koraka — uvijek vrijedi jednak maksimalan postotak jedinica.* Učinak: od datuma koraka vrijedi njegov *Maksimalan postotak jedinica* umjesto ravne vrijednosti. Zadnji korak čiji je datum na taj dan ili prije njega vrijedi za taj dan.
- **Kalendar** — popis s *Kalendar projekta* (zadano), kalendarima projekta i *+ Kalendar resursa* za novi kalendar. Olovka (*Uredi…*) otvara odabrani kalendar; za *Kalendar projekta* je onemogućena. Učinak: dani u kojima resurs radi. Na slobodan dan kapacitet je 0. Ako je tada planiran rad, resurs ima preopterećenje s razlogom *Prema kalendaru „…” ne radi na ovaj dan*. Kalendar resursa ne mijenja datume zadatka. Pogledajte [Prozori kalendara](docs://ref-kalenders).
- **Standardna tarifa/sat** — trošak po satu. Prazno = bez tarife; neispravan broj se vraća na prethodnu vrijednost. Učinak: nema utjecaja na raspored ni na opterećenje. Tarifa određuje stupac *Ukupno*, sprema se u IFC datoteku i zapisuje se pri izvozu u MS Project (*standardna tarifa*) i u Primavera P6 XML (*cijena po jedinici*).
- **Ukupno** — samo prikaz: opterećeni sati × tarifa, s dvije decimale; *—* bez tarife ili opterećenja. Na dnu redak *Ukupno* zbraja sve resurse. Sati dolaze iz zadnjeg izračuna. Broje jedinice dodjele × sate po danu prema kalendaru zadatka. Zastarjelo? Pritisnite *Izračunaj*.
- **Jedinica mjere** — jedinica mjere materijala, na primjer `m³`. Može se popuniti samo za vrstu *Materijal* (savjet: *Unosi se samo kod resursa vrste Materijal.*). Učinak: samo oznaka; ne računa se ništa.
- **Ekipa** — ekipa kojoj resurs pripada, iz resursa vrste *Ekipa*. Zadano: *Nema*. Učinak: samo grupiranje. Kapacitet i opterećenje ekipe nisu zbroj njezinih članova.
- **Izbriši** (kanta za smeće) — briše resurs. Ima li dodjele, aplikacija prvo pita *'…' ima dodjele (ukupno: …). Izbrisati?* s kvačicom za potvrdu i križićem za odustajanje.
- **U biblioteku** — samo kad projekt pripada biblioteci resursa, za resurs čiji naziv još ne dolazi iz biblioteke. Stavlja ga u biblioteku ili ga povezuje s postojećom stavkom istog naziva. Javlja što se dogodilo: *Dodano.*, *Već postoji u biblioteci. Sada je povezano.* ili *Povezano s postojećom stavkom biblioteke. Vrijednosti se razlikuju, pogledajte oznaku.*
- **Odvoji od biblioteke** — ikona za odvajanje na resursu koji dolazi iz biblioteke. Uklanja izvor. Nakon toga su sva polja opet slobodna.

Bez resursa piše *Još nema resursa. Dodajte jedan za početak.* Ako projekt pripada biblioteci, piše *Ovaj projekt još ne koristi resurse iz biblioteke.* uz savjet.

### Resursi iz biblioteke

Resurs iz biblioteke ima malu ikonu biblioteke (*Iz biblioteke*). Njegovi *Naziv*, *Vrsta*, *Standardna tarifa/sat* i *Jedinica mjere* su tada običan tekst (*Vrijednost iz biblioteke — uredite je u prikazu Biblioteka ili odvojite ovaj resurs od biblioteke.*). Razlog: biblioteka odlučuje što je resurs. *Boja*, *Maksimalan postotak jedinica*, koraci kapaciteta, *Kalendar* i *Ekipa* ostaju za uređivanje, jer projekt odlučuje koliko i kada. Mogu se pojaviti dvije oznake: *odstupa — odlučite* (klik otvara prozor *Poveži biblioteku resursa*) i *više nije u biblioteci*, s gumbom *Ukloni iz projekta*.

## Prikaz Biblioteka

Samo kad projekt pripada biblioteci resursa. Pogledajte [Korištenje biblioteke resursa](docs://howto-resourcebibliotheek-gebruiken) i [Upravljanje bibliotekama resursa i njihovo dijeljenje](docs://howto-bibliotheken-beheren). Na vrhu je obojena napomena: *Ovo uređuje biblioteku i vrijedi za sve projekte. Ovo se ne može poništiti.* Tablica ima ista polja kao prikaz *Projekt*, uz ove razlike:

- Nema stupca *Ukupno*: to je izračun za jedan projekt.
- Stupac *Ekipa* postoji čim biblioteka ima resurse.
- Stupac *Kalendar* nudi kalendare biblioteke. Zadano je *Bez kalendara*.
- **Dodijeli projektu** — stavlja resurs u projekt, s kopijom njegova kalendara. Javlja *Dodano.* ili *Već je u projektu.*
- **Izbriši** — pita *Želite li ukloniti '…' iz biblioteke? Ovo vrijedi za sve projekte i ne može se poništiti.*
- Bez resursa piše *Još nema resursa u biblioteci.*

## Prikaz Zauzetost

Prikaz samo za pregled preko svih otvorenih dokumenata: koji su resursi iz biblioteke gdje rezervirani. Gumba za novi resurs nema. Pogledajte [Korištenje pregleda zauzetosti](docs://howto-bezettingsoverzicht-gebruiken).

- **Tablica** — po resursu iz biblioteke: *Naziv*, *Dokumenti* (broj dokumenata u kojima je), *Razdoblje* i *Vrh / kapacitet* (najveće zbrojeno opterećenje u odnosu na kapacitet tog dana). Crveno *N dana s preopterećenjem resursa* znači da resurs u više dokumenata ima više nego što mu je kapacitet. Strelica pored naziva otvara dokumente, svaki s razdobljem i vrhom. Klik na redak prikazuje histogram tog resursa (*Odaberite resurs da biste vidjeli histogram.*).
- **Što se broji** — samo dokumenti otvoreni u ovom programu (*Ovaj pregled vidi samo dokumente otvorene u ovom programu.*). Dokument koji nije izračunat dobiva poruku u svom retku. Aktivni dokument ulazi u pregled sa zadnjim izračunatim brojkama (*Zastarjelo: ovo su posljednje izračunate brojke — pritisnite F5 u ovom dokumentu.*). Ostali dokumenti pregled unaprijed izračunava (*Unaprijed izračunato za ovaj pregled — sam dokument prikazuje starije datume dok ondje ne pritisnete F5 ili ne uključite „Automatsko izračunavanje”.*). Ako je *Automatsko izračunavanje* uključeno, pregled zaista izračunava te dokumente. Ako izračun ne uspije, dokument se ne broji (*Ne ubraja se: raspored nije izračunat — aktivirajte ovaj dokument i pritisnite F5.*). Bez rezerviranih resursa piše *Nema resursa iz biblioteke u otvorenim dokumentima.*
- **Redoslijed** — resursi s preopterećenjem resursa stoje na vrhu: najprije oni s najviše dana sukoba, zatim po abecedi.

## Usidrenje resursa

Kompaktan popis u desnom stupcu, uz okno *Svojstva*. Po resursu: uzorak boje, naziv (samo za prikaz) i crveni trokut *Preopterećenje resursa* čim resurs ima bar jedan dan s preopterećenjem resursa. Uz to je *Maksimalan postotak jedinica* za uređivanje. Ako je u zadacima nešto odabrano, prikazuju se samo resursi tih zadataka. U zaglavlju su *Cijeli panel* (otvara cijeli panel) i *Zatvori dok*. Bez resursa piše *Još nema resursa. Dodajte jedan za početak.*

## Histogram

Pojas ispod Gantt-a koji prikazuje opterećenje resursa po danu. Uključite ili isključite ga s *Resursi › Histogram › Histogram* ili *Prikaz › Paneli › Histogram*. Zadano: isključeno; vaš izbor se pamti. Visina je zadano 160 piksela. Može se povući na rubu između Gantt-a i histograma.

- **Izbornik** — lijevo, ispod tablice zadataka, nalazi se popis: *Svi resursi* pri vrhu, ispod njega po jedan redak za svaki resurs. Klik odabire redak, strelice se kreću kroz popis, a *Resursi › Histogram › Prethodno* i *Dalje* rade isto. Crvena točka uz redak znači da resurs ima bar jedan dan s preopterećenjem resursa. Kod *Svi resursi* točka gleda samo na resurse koji nisu materijal. Ako je u zadacima nešto odabrano, popis sadrži samo resurse tih zadataka. Ako odabrani resurs nije među njima, pojas privremeno prikazuje *Svi resursi* odabranih zadataka.
- **Stupići** — jedan stupić po danu, s opterećenjem. Vrijednost gore lijevo je najveća, uz oznaku *jedinice dodjele*. Linija prikazuje kapacitet; dio stupića iznad kapaciteta je crven. *Svi resursi* zbraja opterećenje i kapacitet svih resursa, osim materijala.
- **Savjet** — zadržite miš nepomično nekoliko trenutaka nad danom: *N zadataka doprinosi na {date}*, s nazivima najviše osam zadataka. Za odabrani resurs i dan kad njegov kalendar ne radi, piše i *Prema kalendaru „…” ne radi na ovaj dan*.
- **Poruke u pojasu** — *Ponovno izračunajte (F5) da biste prikazali opterećenje* dok nema opterećenja, *Još nema resursa* bez resursa i *⚠ Raspored je zastario — ponovno izračunajte (F5)* gore desno kad je raspored zastario.
- **Što se broji** — jedinice dodjele po danu za svaku dodjelu, raspoređene na radne dane zadatka. Raspodjelu određuje *Krivulja* (ili *Raspodijeli sate*). Broje se samo zadaci bez podzadataka, bez kontrolnih točaka. Opterećenje se osvježava nakon *Izračunaj* i nakon promjena resursa i dodjela. Ako mijenjate datume zadataka, to se broji tek nakon *Izračunaj*.

## Preopterećenje resursa

Resurs ima preopterećenje resursa na danu ako je njegovo opterećenje veće od kapaciteta. Kapacitet je *Maksimalan postotak jedinica* (s koracima kapaciteta) na radni dan njegova kalendara, a 0 na slobodan dan. Materijal se ovdje ubraja. Razlog je premalo kapaciteta ili dan na koji resurs prema svom kalendaru ne radi.

Gdje to vidite:

- **Resursi › Preopterećenje resursa** — broj preopterećenih resursa, ili *Nema*.
- **Traka stanja** — *Preopterećenja resursa: N*; klik otvara panel *Upozorenja*.
- **Upozorenja** — po resursu jedan redak *Dani s preopterećenjem resursa: N (prvi – zadnji)*, uz dodatak *resurs ne radi ove dane prema svom kalendaru* ako su svi ti dani slobodni, ili *od toga N dana resurs ne radi prema svom kalendaru* kod mješavine. Pogledajte [Obavijesti i upozorenja](docs://ref-meldingen).
- **Histogram** — crveni dijelovi stupića i crvena točka u izborniku.
- **Dok** — trokut *Preopterećenje resursa*.

Uravnoteživanje može riješiti preopterećenje resursa tako da pomakne zadatke unutar njihove vremenske rezerve. Ne može riješiti resurs koji mora raditi na slobodan dan. Pogledajte [Uravnoteživanje](docs://uitleg-nivelleren).
