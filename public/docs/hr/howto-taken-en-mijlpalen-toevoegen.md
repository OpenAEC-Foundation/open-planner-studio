# Dodavanje zadataka i kontrolnih točaka

Cilj: staviti novi zadatak ili kontrolnu točku u vaš raspored, na mjesto gdje pripada.

## Kada vam ovo treba

Izrađujete raspored, dodaju se radovi ili želite zabilježiti trenutak, na primjer predaju ili inspekciju.

**Zadatak** je posao koji traje. Novi zadatak traje zadano 5 radnih dana (uz planiranje u satima zadano trajanje projekta može biti u satima). **Kontrolna točka** je trenutak bez trajanja: 0 dana. Zadatak s podzadacima zove se **zadatak sažetka**, u građevinarstvu često faza. Njegovo trajanje i datumi slijede iz njegovih podzadataka čim upotrijebite **Izračunaj** (F5).

## Koraci

### Dodavanje zadatka

1. Odaberite *Početna › Zadaci › Zadatak*. Isti gumb nalazi se i na kartici *Tablica*.
2. Otvara se okno *Svojstva* i polje *Naziv* je odabrano. Upišite naziv i pritisnite Enter.

Novi zadatak se u početku zove *Novi zadatak* i počinje na datumu početka projekta.

Ako je odabran zadatak, novi zadatak ide izravno ispod njega, na istoj razini. Ako je odabrani zadatak zadatak sažetka, novi zadatak ide ispod cijele faze, dakle nakon njegovih podzadataka. Ako nije odabrano ništa, ide na dno popisa. Opis gumba kaže što će se od dvoga dogoditi: *Novi zadatak odmah ispod odabira* ili *Novi zadatak na dnu popisa*. Ako odaberete više zadataka, stvara se jedan novi zadatak, ispod najnižeg od odabira, onako kako ga vidite na zaslonu.

### Brzo jedan za drugim u tablici zadataka

Ispod posljednjeg zadatka u tablici zadataka uvijek je sivi redak *Novi zadatak*. To još nije zadatak: nije u Gantt-dijagramu i nije u datoteci.

1. Kliknite ćeliju tog retka ili se na nju pomaknite strelicom prema dolje.
2. Upišite naziv i pritisnite Enter. Sada je to pravi zadatak, na istoj razini kao zadatak iznad njega. Kursor je odmah na novom sivom retku ispod.
3. Upišite sljedeći naziv i tako dalje.

Ako na sivom retku upišete samo trajanje ili datum, zadatak se zove *Novi zadatak*. Ako izađete bez ičega upisanog, ništa se ne događa: nema zadatka i nema koraka u *Poništi*. Stvaranje zadatka i njegova prva vrijednost zajedno su jedan korak u *Poništi*. Sivi redak postoji samo kad tablica zadataka nije filtrirana, grupirana ili sortirana.

### Desnom tipkom miša na prazan prostor

Desnom tipkom miša kliknite prazan prostor: u tablici zadataka ispod posljednjeg zadatka ili u Gantt-dijagramu pokraj ili ispod traka. Odaberite *Novi zadatak* ili *Dodaj kontrolnu točku*. Zadatak ide na dno popisa. U Gantt-dijagramu počinje na datumu na koji ste kliknuli. U tablici zadataka ćelija za naziv odmah se otvara, da možete upisati.

### Iznad ili ispod određenog zadatka

Desnom tipkom miša kliknite zadatak i odaberite *Umetni iznad* ili *Umetni ispod*. Radi i tipkovnica: Insert dodaje iznad odabranog zadatka, Ctrl+I (⌘+I na Macu) ispod njega. U tablici zadataka ćelija za naziv odmah se otvara nakon tipke Insert, spremna za upisivanje.

Ako je odabrano više zadataka, stvara se jedan novi zadatak: *Umetni iznad* ga stavlja iznad najvišeg odabranog zadatka, *Umetni ispod* ispod najnižeg.

### Dodavanje podzadatka

Desnom tipkom miša kliknite zadatak i odaberite *Dodaj podzadatak*. Novi zadatak ide na dno podzadataka tog zadatka. U tablici zadataka pokraj Gantt-dijagrama zadatak sažetka ima i mali **+** iza naziva, koji radi isto.

### Dodavanje kontrolne točke

1. Odaberite *Početna › Zadaci › Kontrolna točka ▾*, a zatim *Početna kontrolna točka*, *Završna kontrolna točka* ili *Inspekcijska točka (obvezna)*.
2. Upišite naziv i pritisnite Enter. Mjesto je određeno istim pravilom kao za *Zadatak*.

Tri vrste razlikuju se ovako:

- *Početna kontrolna točka* pripada na početak dana, *Završna kontrolna točka* na završetak dana. U Gantt-dijagramu romb je na lijevom rubu dana za početnu kontrolnu točku, a na desnom za završnu. To je važno i za nasljednika. Pretpostavimo da je kontrolna točka u utorak 29. rujna 2026. i da zadatak slijedi nakon nje s ovisnošću završetak-početak: nakon početne kontrolne točke taj zadatak počinje istog utorka, nakon završne kontrolne točke u srijedu 30. rujna.
- *Inspekcijska točka (obvezna)* je završna kontrolna točka s vrstom zadatka *Inspekcija* i kvačicom pri *Obvezno (ugovorno)*.

### Postojeći zadatak pretvoriti u kontrolnu točku

Desnom tipkom miša kliknite zadatak i odaberite *Uključi/isključi kontrolnu točku*, ili označite *Kontrolna točka* u oknu *Svojstva*. Stavka izbornika djeluje na cijeli odabir. Trajanje postaje 0.

Ako je ponovno isključite, ostaje obični zadatak s trajanjem 0: trajanje unesite sami.

### Ostali načini

- Ctrl+M (⌘+M na Macu) stavlja novu kontrolnu točku na dno popisa, čak i ako je odabran zadatak. Okno *Svojstva* se ne otvara.
- *Dodaj kontrolnu točku* u izborniku zadatka (desni klik) čini kontrolnu točku podzadatkom tog zadatka, a ne na istoj razini.

### Kopiranje zadatka ili cijele grane

1. U Gantt-dijagramu kliknite traku zadatka. Više zadataka odaberite Ctrl+klikom.
2. Pritisnite Ctrl+C (⌘+C na Macu). Aplikacija kopira zadatak sa svim podzadacima, ovisnostima između kopiranih zadataka i njihovim dodjelama resursa.
3. Ako želite, kliknite traku zadatka uz koji kopija treba biti, i pritisnite Ctrl+V (⌘+V).

Kopija ima isti naziv, iste datume i isti napredak. Ide kao zadatak na istoj razini kao odabrani zadatak (kod više: onaj koji ste prvi kliknuli), na dno među tim zadacima na istoj razini. Ako nije odabrano ništa, ide na dno popisa. Kopirani zadaci se naknadno odabiru, WBS-kodovi (broj svakog zadatka u stablu, na primjer 1.2; vidi [Prilagodba strukture](docs://howto-structuur-aanpassen)) ponovno se određuju i raspored više nije ažuran.

Međuspremnik je zajednički za cijelu aplikaciju, pa možete zalijepiti i u drugi dokument. Ono što tamo ne postoji, na primjer kalendar zadatka, prilagođena vrsta zadatka, šifra zadatka ili prilagođeno polje, aplikacija briše i obavještava vas.

### Nakon toga

Novi zadatak još ne mijenja ostale datume. U traci stanja piše *Zastarjelo — ponovno izračunajte (F5)*. Pritisnite **Izračunaj** (F5), na primjer preko *Početna › Raspored › Izračunaj*.

## Zamke i što aplikacija radi

**Svaki novi zadatak počinje na datumu početka projekta.** Bez ovisnosti zadatak ne čeka ni na što. Dodajte ovisnosti, vidi [Dodavanje ovisnosti](docs://howto-relaties-leggen).

**Filtriranje, grupiranje ili sortiranje je uključeno.** Redoslijed koji vidite tada nije redoslijed rasporeda. Kad je zadatak odabran, *Zadatak* i *Kontrolna točka ▾* dodaju novi zadatak na dno, i pojavljuje se traka *Nije dostupno tijekom filtriranja, grupiranja ili sortiranja*. *Umetni iznad* i *Umetni ispod* se odbijaju, s istom trakom. Gumb *Obriši* u toj traci uklanja filtar, grupiranje i sortiranje odjednom. To nije dio *Poništi*: Ctrl+Z ih ne vraća.

**Podzadatak pod zadatkom s dodjelama resursa.** Zadatak postaje zadatak sažetka, a zadatak sažetka sam nema dodjele. Aplikacija premješta dodjele na novi podzadatak i javlja vam to. Ako to nije moguće, na primjer jer ste odabrali *Dodaj kontrolnu točku*, a kontrolna točka ne može imati dodjele, aplikacija ništa ne dodaje i kaže zašto.

**Podzadatak pod kontrolnom točkom.** Kontrolna točka postaje zadatak sažetka, a aplikacija uklanja oznaku kontrolne točke i prikazuje poruku.

**Uključivanje kontrolne točke za zadatak sažetka ili zadatak s dodjelama.** Aplikacija to odbija i kaže zašto. Kod dodjela: prvo ih uklonite.

**Kopiranje u tablici zadataka.** U tablici zadataka (i na kartici *Tablica*) Ctrl+C kopira samo vrijednosti odabranih ćelija, kao u proračunskoj tablici, a Ctrl+V lijepi u ćelije. Kopiranje zadataka zato radi samo ako koristite Gantt-dijagram: prvo kliknite traku.

## Pogledajte također

- [Prilagodba strukture](docs://howto-structuur-aanpassen): uvući i pomaknuti zadatke te držati WBS-brojeve ažurnima.
- [Dodavanje ovisnosti](docs://howto-relaties-leggen): povezati zadatke međusobno.
- [Odabir, brisanje i poništavanje zadataka](docs://howto-taken-selecteren-verwijderen): ponovno ukloniti zadatak.
- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): što aplikacija izračunava kad postoje ovisnosti.
- [Dijaloški okvir zadatka i okno svojstava](docs://ref-taak-eigenschappen): sva polja zadatka.
- [Novi projekt i podaci o projektu](docs://ref-projectinfo): početak s predloškom faza.
- [Izbornici desnog klika](docs://ref-contextmenus): sve stavke izbornika zadatka.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): mali primjer projekta (*Datoteka › Primjeri*) s četiri faze, početnom kontrolnom točkom i obveznom kontrolnom točkom predaje.
