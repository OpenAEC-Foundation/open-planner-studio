# Izrada i ispis izvješća

Cilj: odaberite izvješće o svom rasporedu, provjerite ga u pregledu i spremite ga kao PDF. Tako ga možete podijeliti ili sami ispisati.

## Kada ovo trebate

Petak je sastanak na gradilištu. Naručitelj želi raspored na papiru, voditelj gradilišta želi znati što počinje u sljedećim tjednima, a voditelj radova želi list samo sa svojim zadacima. Takve preglede izrađujete na kartici *Izvješće*. Aplikacija ih izračunava iz vašeg rasporeda i najprije ih prikazuje kao pregled. Zatim ih izvezete u PDF.

Aplikacija ne šalje izvješće na pisač sama. Krajnji rezultat je uvijek PDF. Taj PDF ispišete svojim čitačem PDF-a ili ga pošaljete e-poštom.

## Koraci

### 1. Otvorite karticu Izvješće

Odaberite *Izvješće* na vrpci ili pritisnite Ctrl+P. Ctrl+P vas vodi na ovu karticu. Ako upisujete u polje, otvoren je dijalog ili je uključen način prezentacije, Ctrl+P ne radi. U pregledniku se tada otvara dijalog za ispis preglednika. Taj ispisuje zaslon, a ne izvješće.

S lijeve strane je okno *Izvješće* s popisom *Vrsta izvješća*, sažetkom i postavkama. S desne strane je pregled.

### 2. Odaberite vrstu izvješća

Popis *Vrsta izvješća* ima jedanaest izvješća. Odaberite ono koje odgovara vašem pitanju.

- *Gantt ispis*: raspored kao trakasti grafikon, za uobičajeni raspored koji dijelite.
- *Dijagram resursa*: iste trake, ali s recima za svaki resurs. Za pitanje „Što radi ekipa X?“ po želji s listom za svaku ekipu.
- *Pregled kontrolnih točaka*: sve kontrolne točke s datumom i stanjem.
- *Odstupanja*: aktualni raspored uz aktivni temeljni plan. Za pitanje „Koliko smo kasnili?“.
- *Look-ahead*: što se izvodi ili počinje u sljedećem razdoblju. Popis za tjedni sastanak.
- *Kritični i gotovo kritični*: zadaci bez vremenske rezerve ili s vrlo malo vremenske rezerve.
- *Izvješće o napretku*: stanje projekta na datum stanja, dan na koji mjerite napredak.
- *Stanje rasporeda*: provjera samog rasporeda na pogreške i neuobičajene vrijednosti.
- *Opterećenje resursa*: po resursu, po tjednu ili mjesecu, što je potrebno naspram onoga što je dostupno.
- *Dodjele resursa*: po resursu, zadaci kojima je dodijeljen.
- *Sažetak WBS-a*: raspored sažet po razini WBS-a, za rukovodstvo.

### 3. Provjerite je li raspored ažuran

Aplikacija sama ne izračunava. Ako ste od posljednjeg izračuna mijenjali zadatke, ovisnosti ili kalendare, pritisnite **Izračunaj** (F5). Tablična izvješća vas sama upozoravaju na vrhu izvješća: *Raspored je promijenjen od posljednjeg izračuna — pritisnite Izračunaj (F5) za aktualne vrijednosti.* Ili, ako nikad nije izračunato: *Još nije izračunato — pritisnite Izračunaj (F5) za datume i vremensku rezervu.*

Na vrpci kartice *Izvješće* nema gumba *Izračunaj*, ali F5 ovdje radi. *Izvezi PDF* također sam izračuna ako raspored nije ažuran, pa PDF nikad ne zaostaje za vašim rasporedom.

### 4. Prilagodite izvješće

U odjeljku *Postavke* nalaze se izbori za Gantt ispis i Dijagram resursa. Izvješća Look-ahead, Kritični i gotovo kritični, Izvješće o napretku, Stanje rasporeda, Opterećenje resursa, Dodjele resursa i Sažetak WBS-a imaju samo *Papir:* i *Orijentacija:*, plus dio *Opcije izvješća* s izborima tog izvješća. Pregled kontrolnih točaka i Odstupanja nemaju vlastite izbore. Razdoblje izvješća pogledajte u članku [Odabir razdoblja izvješća](docs://howto-rapportageperiode-kiezen).

- *Papir:* i *Orijentacija:* određuju list. Zadano je A3 vodoravno. To je zgodno za raspored gradnje, ali nisu svi pisači u stanju ispisati A3. Ako imate A4 pisač, odaberite odmah A4. Aplikacija tada prelama stranice za A4, a vi ih ne morate kasnije smanjivati.
- Uz Dijagram resursa, potvrdni okvir *Svaki resurs na novoj stranici* daje list za svaku ekipu.
- *Veličina slova:* (od 90% do 125%) čini tekst i tablicu većima ili manjima. Veća veličina slova ostavlja manje mjesta za vremensku os.
- *Prati prikaz (filtar, grupiranje, sortiranje)* prikazuje se samo kod Gantt ispisa. Zadano se na papir stavlja cijelo stablo zadataka. S ovim potvrdnim okvirom izvješće crta točno retke koje vidite na zaslonu, uključujući sklopljene faze. Na primjer, samo kritični zadaci iz izgleda. Kako napraviti takav prikaz, piše u članku [Izrada i korištenje izgleda](docs://howto-layouts-gebruiken).
- *Prikaži preklop temeljnog plana* prikazuje aktivni temeljni plan uz trenutne trake. U polju *Statusna linija:* odaberete *Linija datuma stanja* ili *Linija napretka*.
- *Prilagodi papiru* je zadano uključeno: vremenska os se tada skalira na širinu stranice, a broj stranica ovisi o visini. Ako to isključite, izvješće koristi fiksni zoom i slaže stranice i u širinu, što brzo daje mnogo stranica. U polju *Vremenska os na:* raspoređujete vremensku os na 2 do 8 stranica u širinu, uz prilagodbu papiru. Tako je dugi raspored moguće ispisati u čitljivoj veličini.

### 5. Provjerite pregled

Za Gantt ispis i Dijagram resursa vidite papir sa zaglavljem stranice, tablicom, vremenskom osi i legendom. Listajte da biste pogledali stranice. *Kvaliteta pregleda* određuje samo oštrinu pregleda na zaslonu. PDF se zbog toga ne mijenja. Ako ispod stranica piše *… i još 1 stranica — izvezite za cijeli dokument* (uz više stranica *… i još 2 stranice — izvezite za cijeli dokument*), pregled nema sve stranice spremne. PDF sadrži sve stranice.

Ostala izvješća se na zaslonu prikazuju kao tablica. Ono što vidite jest ono što završi u PDF-u.

### 6. Izvezite u PDF

Na dnu lijevog okna kliknite **Izvezi PDF**. Predloženi naziv datoteke je naziv projekta, a zatim vrsta izvješća. Za Gantt ispis, na primjer, *Extension house-planning.pdf*.

- U desktop aplikaciji i u pregledniku koji ima dijalog za spremanje datoteka birate mjesto na kojem se PDF sprema. Ako zatvorite taj dijalog bez spremanja, ništa se ne događa.
- U pregledniku bez takvog dijaloga preglednik stavlja PDF u mapu za preuzimanja.

### 7. Ispišite PDF

Otvorite PDF u čitaču PDF-a i ispišite ga tamo. Ako ispišete A3 PDF na A4 pisaču, dijalog za ispis mora smanjiti stranice. Zato prvo postavite veličinu papira u koraku 4.

## Zamke i što aplikacija radi

**Gumb Ispiši i Ctrl+P ne ispisuju.** Gumb *Ispiši* u grupi *Izvješće* nalazi se na samoj kartici i ne radi ništa dodatno. Ctrl+P vas vodi na ovu karticu. U aplikaciji nema zasebne naredbe za ispis: put do papira vodi preko PDF-a. Ako Ctrl+P ne radi (vidi korak 1), u pregledniku se otvara dijalog za ispis preglednika. Taj ispisuje zaslon, a ne izvješće.

**Tvrtka: prepisivanje se ne čuva.** Polje *Tvrtka:* u Gantt ispisu počinje s tvrtkom iz podataka o projektu. Ono što upišete preko njega, ne čuva se. Ovdje ne možete upisivati u polje *Autor:*. Oboje mijenjate u *Postavke › Projekt › Podaci o projektu*, u poljima *Naručitelj/organizacija* i *Autor*, a potvrđujete gumbom *Primijeni*.

**Boje traka vrijede i za vaš zaslon.** Izbor *Boje traka:* u izvješću isti je kao izbor *Boje traka* na kartici Prikaz. Ako ga promijenite u izvješću, vaš Gantt na zaslonu mijenja se s njim.

**Odstupanja bez temeljnog plana.** Temeljni plan je spremljena kopija rasporeda s kojom kasnije uspoređujete. Kako ga spremiti, piše u članku [Spremanje i upravljanje temeljnim planom](docs://howto-baseline-opslaan-en-beheren). Ako nemate aktivni temeljni plan, umjesto usporedbe piše *Nema aktivnog temeljnog plana — spremite temeljni plan ili ga postavite kao aktivan.*

**Statusna linija bez datuma stanja.** Ako odaberete *Statusna linija:* dok projekt nema datum stanja, izvješće upozorava porukom *Najprije postavite datum stanja* i ne crta ništa. Datum stanja postavite pod *Raspored › Temeljni planovi i napredak › Datum stanja*.

**U rasporedu postoji kružna ovisnost.** Ako postoji kružna ovisnost, *Izvezi PDF* ne izrađuje datoteku i prikazuje pogrešku.

**Papir se trenutačno primjenjuje na sva izvješća.** Postoji jedan izbor za *Papir:* i *Orijentacija:*, zajednički za sva izvješća. Pregled kontrolnih točaka i Odstupanja nemaju vlastiti izbor papira. Koriste ono što ste postavili u drugom izvješću, po zadanom A3 vodoravno. Zato prvo odaberite papir u izvješću koje ga nudi, na primjer u Gantt ispisu, a zatim se vratite.

**Izbori vrijede za sve projekte.** Papir, veličina slova, razdoblje i ostali izbori pamte se na ovom uređaju, za sve vaše projekte. Ne pripadaju datoteci projekta.

## Vidi također

- [Odabir razdoblja izvješća](docs://howto-rapportageperiode-kiezen): Look-ahead ili izvješće o napretku za određeni vremenski raspon.
- [Izrada i korištenje izgleda](docs://howto-layouts-gebruiken): prvo filtrirajte ili grupirajte, zatim ispišite s uključenom opcijom *Prati prikaz (filtar, grupiranje, sortiranje)*.
- [Spremanje i upravljanje temeljnim planom](docs://howto-baseline-opslaan-en-beheren): kopija s kojom se uspoređuju Odstupanja.
- [Rješavanje preopterećenja resursa](docs://howto-overbezetting-oplossen): što učiniti kad Opterećenje resursa prikazuje preopterećene tjedne.
- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): zašto je zadatak kritičan ili gotovo kritičan.
- [Vrste izvješća](docs://ref-rapporttypes): sve vrste izvješća i njihovi izbori.
