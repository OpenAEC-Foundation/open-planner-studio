# Datoteke i formati

Što se zapravo nalazi u datoteci koju spremate? A što se događa s vašim rasporedom kad ga izvezete u drugi program? U ovom članku čitate kako aplikacija postupa s datotekama: IFC kao vlastiti format, drugi formati kao prevoditelji, što izvoz izostavlja te kako se spremanje, automatsko spremanje i oporavak od pada razlikuju. Primjer na kraju brojkama pokazuje što izvoz čini.

## Pojam

Open Planner Studio ima jedan vlastiti format datoteke: **IFC**, otvoreni format za razmjenu građevinskih podataka iz buildingSMART-a. Aplikacija zapisuje IFC 4.3. U popisu za izvoz zove se *IFC 4x3*. Nema druge, vlasničke datoteke projekta. *Spremi* zapisuje cijeli vaš projekt kao IFC datoteku (`.ifc`), a *Otvori* čita takvu datoteku natrag. Želite li vidjeti što ide u datoteku? Kartica *IFC* prikazuje IFC tekst vašeg projekta, a *Generiraj IFC* osvježava taj tekst.

Svi ostali formati su **adapteri**: prevoditelji između modela drugog programa i modela aplikacije. Aplikacija čita CSV, MS Project XML, Primavera P6 XML, datoteke MS Project (`.mpp`) i datoteke Primavera (`.xer`). Zapisuje CSV, MS Project XML, Primavera P6 XML i dvije tablice napretka. Izvoz u `.mpp` ili `.xer` nije moguć.

Zašto je ta razlika važna? Prevoditelj može prenijeti samo ono što obje strane znaju. IFC datoteka aplikacije čuva sve što pripada vašem projektu. Svaki drugi format nema dio toga, a taj dio ostaje po strani.

## Kako aplikacija postupa s datotekama

### Što čini otvaranje

Aplikacija bira čitač prema nastavku datoteke: `.ifc`, `.csv`, `.xml`, `.mpp` ili `.xer`. Kod datoteke `.xml` aplikacija gleda u sadržaj da vidi je li to MS Project XML ili Primavera P6 XML. Nepoznat nastavak aplikacija tretira kao IFC. Ako datoteka nije IFC, aplikacija prikazuje poruku *Otvaranje datoteke nije uspjelo*, s razlogom.

Svaka datoteka se otvara u vlastitoj kartici. Iznimka je kartica koja je još prazna i nepromijenjena: ta kartica preuzima datoteku. Jedna datoteka Primavera može stvoriti više kartica, po jednu za svaki projekt s zadacima.

Nakon otvaranja aplikacija uvijek provodi ponovno izračunavanje. Ako datoteka dolazi iz drugog programa, datumi se mogu razlikovati od onoga što je datoteka navodila. To je opisano u [Datumi kako su zabilježeni](docs://uitleg-datums-zoals-opgeslagen).

Samo IFC datoteka postaje **odredište spremanja**: datoteka u koju *Spremi* zapisuje. CSV, XML, `.mpp` ili `.xer` datoteka to ne postaje. Takav projekt nakon otvaranja nema datoteku, pa *Spremi* pita gdje treba biti nova IFC datoteka. Tako pritisak na Ctrl+S nikada ne prepisuje vašu izvornu datoteku IFC tekstom.

### Što se zapisuje pri spremanju

*Spremi* uvijek zapisuje cijeli projekt. U datoteku ide sljedeće:

- zadaci sa strukturom, trajanjem, datumima i napretkom;
- ovisnosti s vremenom odgode, ograničenja i rokovi za dovršetak;
- kalendari, resursi i dodjele, uključujući krivulje;
- temeljni planovi, šifre zadatka, prilagođena polja i bilješke;
- međuzavisnosti projekata s drugim projektima;
- postavke projekta, na primjer datum stanja, profil izračuna i opcije izračuna;
- poveznica na biblioteku resursa.

Ono što postavite na ekranu ne pripada projektu i ne ide u datoteku: zumiranje, položaj pomicanja, odabrani zadatak i sažete faze. Postavke aplikacije, na primjer jezik i tema, također nisu u datoteci. Aplikacija ih čuva sama, u aplikaciji ili u vašem pregledniku.

Izvoz u drugi format ne mijenja vaš projekt. Nakon izvoza projekt i dalje ima isto odredište spremanja, a ako je prije bio označen kao *Nije spremljeno*, i dalje je tako označen.

### Što izvoz gubi

Svaki adapter prenosi ono što njegov format zna.

**MS Project XML** prenosi sljedeće: zadaci, ovisnosti, kalendari, resursi, dodjele, ograničenja, rokovi za dovršetak i datum stanja. Ide samo aktivni temeljni plan. Šifre zadatka, prilagođena polja, bilješke i međuzavisnosti projekata ne idu. Drugo ograničenje na zadatku ne ide. Ograničenje *Mora započeti na (MSO)* ili *Mora završiti na (MFO)* bez izbora *Obvezno (logika fiksiranja)* vraća se kao *Ne početi prije (SNET)* ili *Ne završiti prije (FNET)*. *Ručno planiran* i *Kašnjenje zbog uravnoteživanja* zadatka se ne vraćaju. Hamak postaje obični zadatak s izračunatim datumima.

**Primavera P6 XML** prenosi: zadaci, ovisnosti, kalendari, resursi, dodjele, ograničenja i datum stanja. Temeljni planovi i rokovi za dovršetak ne idu, kao ni šifre zadatka, prilagođena polja, bilješke i međuzavisnosti projekata. I ovdje hamak postaje obični zadatak. P6 nema vrijeme odgode u postocima: aplikacija takvo vrijeme odgode pretvara u fiksni broj dana. Vrijeme odgode u kalendarskim danima postaje vrijeme odgode u radnim danima.

**CSV** je tablica zadataka. U datoteci su za svaki zadatak ovi stupci: task id, WBS, level, name, duration, start, finish, predecessors, type, id prilagođene vrste zadatka (`OPS Custom Task Type ID`), status, completion, actual start i actual finish, critical, total float i description. Resursi, dodjele, kalendari, ograničenja, rokovi za dovršetak, temeljni planovi i datum stanja u njoj nisu. Naslovi stupaca su uvijek na engleskom.

**Samo IFC nosi profil izračuna i opcije izračuna.** Ako izvezete u CSV, MS Project XML ili Primavera P6 XML, profila nema u datoteci. Od opcija izračuna MS Project XML zapisuje najviše kritični prag. Takva se datoteka ponovno otvara kao *Open Planner Studio*. Ako je vaš projekt računan s *Primavera P6* ili *Microsoft Project*, na primjer jer dolazi iz `.xer` ili `.mpp`, datumi se zbog toga mogu pomaknuti. Što je profil izračuna, objašnjeno je u [Profili izračuna i pravila izračuna](docs://uitleg-rekenprofielen).

Ako vaš projekt dolazi iz datoteke Primavera (`.xer`), čak i ako ste ga u međuvremenu spremili kao IFC, aplikacija nakon izvoza u CSV, MS Project XML ili P6 XML prikazuje: *Izvoz u CSV gubi informacije o izvoru XER-a.* Za MS Project XML piše *MSPDI*, a ne *CSV*, a za P6 XML piše *P6*. Za IFC ta poruka ne dolazi: IFC datoteka zadržava izvornu datoteku Primavere. Pogledajte [Otvaranje datoteke Primavera P6 (.xer)](docs://howto-xer-openen).

Aplikacija pri izvozu radi još dvije stvari. Ako je raspored zastario, najprije provodi ponovno izračunavanje, a zatim izvozi. Ne izvozi raspored s kružnom ovisnošću: dobit ćete poruku s petljom, na primjer *Kružna ovisnost između zadataka: Set up site → Demolish existing extension → Set up site*.

### Spremanje, automatsko spremanje i oporavak od pada

To su tri različite stvari. Izgledaju slično, ali zapisuju na različito mjesto.

**Spremi** je radnja koju izvodite sami. Aplikacija zapisuje vaš projekt u vašu datoteku i uklanja oznaku *Nije spremljeno*.

**Automatsko spremanje** je zadano isključeno, a uključujete ga sami za svaki projekt. Aplikacija tada bez prozora zapisuje u istu datoteku kad god ima promjena, najviše jednom svakih deset sekundi. Radi samo ako projekt već ima datoteku. Pogledajte [Uključivanje automatskog spremanja](docs://howto-automatisch-opslaan).

**Oporavak od pada** uvijek je uključen. Čim se bilo gdje promijeni nešto, aplikacija također najviše jednom svakih deset sekundi čuva kopiju za oporavak svih otvorenih projekata, uključujući projekte koje sami niste mijenjali. Ta kopija nije u vašoj datoteci projekta: u desktop aplikaciji je u mapi s podacima aplikacije, a u pregledniku u spremištu preglednika. Pri sljedećem pokretanju aplikacija nudi tu kopiju. O tome čitate u [Oporavak od pada](docs://howto-herstellen-na-een-crash). Oporavak od pada nikad ne zapisuje u datoteku vašeg projekta.

Pošto se kopija čuva najviše jednom svakih deset sekundi, pri padu možete izgubiti zadnjih nekoliko sekundi unesenih podataka.

### Desktop i preglednik

Desktop aplikacija i verzija u pregledniku rade isto s vašim projektom, ali datoteke zapisuju na drugi način.

Na desktopu aplikacija radi sa stvarnim putanjama. *Spremi* zapisuje izravno u vašu datoteku. Obično aplikacija najprije zapisuje u privremenu datoteku pored nje (`.ops-save.tmp`) i tek tada zamjenjuje vašu datoteku, pa se stara datoteka ne izgubi ako pad nastane usred zapisivanja. Ako zatvorite aplikaciju s promjenama, za svaki projekt pita želite li ga spremiti. Pri urednom izlasku briše svoje kopije za oporavak.

U pregledniku koji može datoteke čuvati gdje god želite (kao Chrome i Edge) dobijete običan prozor za otvaranje i spremanje. Nakon toga *Spremi* zapisuje izravno u datoteku; za datoteku koju ste otvorili, preglednik jednom traži dopuštenje. Popis *Nedavno* radi, ali samo s nazivima datoteka.

U pregledniku bez te mogućnosti (kao Firefox) aplikacija otvara datoteku preko birača datoteka, a sprema preko preuzimanja. Uz *Spremi* poruka *Spremljeno kao preuzimanje: 'name.ifc' je u vašoj mapi za preuzimanja. …* objašnjava to jednom po sesiji. Uz *Spremi kao* i izvoz vidite *Spremljeno kao preuzimanje: 'name.ifc' sada je u vašoj mapi za preuzimanja. Ovo okruženje ne dopušta aplikaciji da izravno zapisuje na odabrano mjesto.* Ako preglednik može prikazati prozor za spremanje, ali ne može zapisati natrag u datoteku projekta, *Spremi* svaki put ponovno traži mjesto. I za to poruka objašnjava jednom po sesiji. *Datoteka › Nedavno* postoji, ali otvara praznu stranicu, a automatsko spremanje nije dostupno. Istu poruku dobijete u svakom okruženju koje aplikaciji ne dopušta zapisivanje na mjesto koje ste odabrali.

## Primjer: izvoz primjera projekta

Uzmite primjer *Refurbishment & Extension of a Family Home* (*Datoteka › Primjeri*). Ima 20 zadataka, od kojih 4 faze i 2 kontrolne točke, te 16 ovisnosti. Ima 6 resursa s 8 dodjela, 1 temeljni plan i poveznicu na *Demo resource library*. Zadatak *Demolish existing extension* ima ograničenje *Ne početi prije (SNET)* od 14. svibnja 2027., a *Handover inspection* ima rok za dovršetak 29. srpnja 2027. Raspored završava 7. srpnja 2027.

Ovako se projekt vraća iz svakog formata, mjereno nakon što se izvezena datoteka ponovno otvori:

- IFC datoteka vraća sve: 20 zadataka, 16 ovisnosti, 6 resursa, 8 dodjela, temeljni plan, ograničenje, rok za dovršetak i poveznicu na biblioteku resursa. Raspored ponovno završava 7. srpnja 2027.
- Datoteka MS Project XML također vraća sve, osim poveznice na biblioteku resursa. Raspored završava 7. srpnja 2027.
- U datoteci P6 XML vraćeni su zadaci, ovisnosti, resursi, dodjele i ograničenje. Temeljni plan i rok za dovršetak nedostaju. Raspored i dalje završava 7. srpnja 2027., jer je ograničenje i dalje u njemu.
- U datoteci CSV vraćeno je 20 zadataka i 16 ovisnosti. Resursi, dodjele, temeljni plan, ograničenje i rok za dovršetak nedostaju, a projekt se zove *CSV Import*. Bez ograničenja zadaci se pomiču naprijed: raspored završava 2. srpnja 2027., pet kalendarskih dana ranije.

Bez tog ograničenja i sam primjer završava 2. srpnja 2027. Razlika dakle dolazi od ograničenja koje CSV datoteka ne nosi.

## Posljedice i pogrešna shvaćanja

**Izvoz nije sigurnosna kopija.** Samo IFC čuva sve. Ako želite zadržati projekt, spremite ga kao IFC. Izvezite samo za nekoga tko treba drugi format.

**Ponovno otvaranje izvoza ne daje uvijek isti raspored.** Aplikacija pri otvaranju uvijek provodi ponovno izračunavanje, s profilom izračuna koji pripada formatu. Ako nedostaje logika, kao ograničenje u primjeru s CSV-om, ili profil izračuna radi drugačije, ishod se mijenja.

**Izvoz je također na popisu *Nedavno*.** Na desktopu i u preglednicima s pristupom datotekama izvoz završava na popisu *Nedavno*, baš kao spremljeni projekt (tablice napretka ne). Ako ga tamo otvorite, otvara se kao uvoz tog formata.

**Spremanje nije isto što i oporavak od pada.** Oporavak od pada pomaže nakon pada, ali ne zamjenjuje spremanje. Zato spremite prije nego zatvorite karticu ili aplikaciju.

## Vidi također

- [Otvaranje i spremanje datoteke](docs://howto-bestand-openen-en-opslaan): koraci za otvaranje, spremanje i spremanje kao.
- [Izvoz](docs://howto-exporteren): izbor formata i što dobijete.
- [Datumi kako su zabilježeni](docs://uitleg-datums-zoals-opgeslagen): zašto uvezeni raspored može prikazivati druge datume.
- [Ograničenja i rokovi za dovršetak](docs://uitleg-constraints): što ograničenje čini i što nestaje kad ga nema.
- [Ovisnosti i vrijeme odgode](docs://uitleg-relaties): što je vrijeme odgode i kako ga aplikacija računa.
- [Stvaranje hamaka](docs://howto-hammock): što je hamak i što izvoz zapisuje kao obični zadatak.
- [Šifre i prilagođena polja](docs://howto-codes-en-velden): šifre zadatka i prilagođena polja, koja čuva samo IFC.
- [Međuzavisnost projekata](docs://howto-externe-relaties): poveznice koje MS Project XML i P6 XML ne prenose.
- [Spremanje i upravljanje temeljnim planom](docs://howto-baseline-opslaan-en-beheren): temeljni planovi, od kojih MS Project XML prenosi samo aktivni.
- [Formati za uvoz i izvoz](docs://ref-import-exportformaten): za svaki format što se prenosi, a što ne.
