# Postavke aplikacije

Svaka postavka aplikacije: što radi, početna vrijednost, što se mijenja i gdje je pronađete. Za opcije izračuna projekta (profil izračuna, definicija kritičnosti) pogledajte [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies). Te opcije pripadaju datoteci projekta, a ne aplikaciji.

## Gdje ih pronaći i kako rade

Panel postavki nalazi se na tri mjesta, i svugdje je isti panel: zupčanik na vrhu prozora, *Postavke › Projekt › Postavke aplikacije* i *Datoteka › Postavke aplikacije*. Panel ima tri kartice: *Izgled*, *Raspored* i *Napredno*. Svaka postavka u nastavku navodi samo karticu.

Promjena odmah stupa na snagu. Nema gumba *Primijeni* i nema gumba *Odustani*.

**Za cijelu aplikaciju, ne po projektu.** Sve postavke u ovom članku vrijede za sve vaše projekte i pripadaju ovom uređaju. Aplikacija ih čuva u pohrani aplikacije ili u pregledniku, a ne u datoteci projekta. Druga osoba koja otvori vašu datoteku zato vidi svoje postavke. Ako obrišete pohranu preglednika, ponovno se koriste početne vrijednosti.

## Kartica Izgled

**Tema** — shema boja sučelja. Odaberite između *Tamna*, *Svijetla* i *Visoki kontrast*. Zadano: *Tamna*. Učinak: boje cijelog sučelja, uključujući Gantt i histogram. Gdje: *Izgled*.

**Prati temu sustava** — dopušta da o temi odlučuje vaš operacijski sustav. Zadano: isključeno. Učinak: aplikacija je *Svijetla* ili *Tamna*, ovisno o vašem sustavu; tri kartice za temu tada su isključene. *Visoki kontrast* ne prati vaš sustav: tu temu birate sami. Ako ovo isključite, ostaje tema koja je u tom trenutku bila na ekranu. Gdje: *Izgled*, pod *Tema*.

**Jezik** — jezik sučelja. Zadano: jezik vašeg preglednika ili sustava, ako ga aplikacija poznaje, inače engleski. Učinak: svi tekstovi u aplikaciji; jezici su poredani po kratici. Arapski i perzijski prikazuju sučelje zrcalno, s desna na lijevo. Jezik članaka pomoći postavljate posebno, pod *Jezik dokumentacije* u *Datoteka › Pomoć*. Gdje: *Izgled*.

**Font** — font cijelog sučelja. Odaberite između *Zadano*, *Sustav*, *Serifno* i *Monospace*. Zadano: *Zadano*. Učinak: naslovi i tekst u prozorima te tekst u Ganttu i histogramu. Web aplikacija sama ne prati font vašeg sustava; zato ga ovdje birate. Gdje: *Izgled*.

**Veličina teksta** — mjerilo sučelja. Odaberite između 90%, 100%, 110% i 125%. Zadano: 100%. Učinak: tekst i razmještaj vrpce, panela i dijaloga postaju veći ili manji, a visina redaka tablice i Gantta mijenja se razmjerno. Nema izbora iznad 125%, jer se tada natpisi gumba u vrpci lome na više redaka. Gdje: *Izgled*.

**Format datuma** — kako se datumi prikazuju u aplikaciji. Odaberite između *dd-mm-gggg*, *mm-dd-gggg* i *gggg-mm-dd*. Zadano: *dd-mm-gggg*. Učinak: datumi u tablici, dijalozima, izvješćima i ispisu. Datoteke i izračuni se ne mijenjaju: mijenja se samo prikaz. Gdje: *Izgled*.

**Format vremena** — kako se vremena na satu prikazuju u aplikaciji. Odaberite između *24 sata (13:00)* i *12 sati (1:00 PM)*. Zadano: *24 sata (13:00)*. Učinak: vremena u prozoru kalendara, datum i vrijeme zadataka u satima (tablica, podjele, poruke) te vremenska skala *Sat* u Ganttu. U polje za vrijeme možete upisati oba oblika: *13:00*, *1300*, *13*, *1:00 PM* ili *1 pm*. Ponoć kao kraj dana zapisujete kao *24:00* ili *12:00 AM*. Datoteke i izračuni se ne mijenjaju: ostaju u 24-satnom obliku. Gdje: *Izgled*.

**Prikaz trajanja** — u kojoj se jedinici prikazuje trajanje zadatka. Odaberite između *Automatski (vlastita jedinica po zadatku)*, *Uvijek dani* i *Uvijek sati*. Zadano: *Automatski (vlastita jedinica po zadatku)*. Učinak: u tablici zadataka, oznakama traka u Ganttu, skočnom savjetu, ispisu i izvješćima. Pri *Automatski* zadatak u danima prikazuje dane, a zadatak u satima prikazuje sate. Pri *Uvijek dani* ili *Uvijek sati* aplikacija pretvara vrijednosti pomoću broja sati po danu iz kalendara zadatka te, ako je jedinica zadatka drugačija, dodaje njegovu jedinicu u zagradi, na primjer `2.25d(18h)`. Mijenja se samo prikaz; zadatak zadržava svoju jedinicu. Gdje: *Izgled*.

**Stil prebacivanja dokumenata** — kako prebacujete između otvorenih projekata. Odaberite između *Vodoravne kartice*, *Okomite kartice* i *Pilula*. Zadano: *Vodoravne kartice*. Učinak: *Vodoravne kartice* stavljaju traku kartica ispod vrpce; *Okomite kartice* traku projekata lijevo; *Pilula* mali gumb projekta u naslovnoj traci. Gdje: *Izgled*.

### Odjeljak Gantt

**Prikaži samo radne dane** — sabija vremensku os. Zadano: isključeno. Učinak: vikendi i praznici iz kalendara projekta preskaču se, pa je zadatak od 5 radnih dana širok točno 5 dana na vremenskoj skali. Prečaci za *Idi na danas* i *Prilagodi projektu* tada također broje u radnim danima. Izvješće ima vlastitu kvačicu s istim nazivom, koja ne ovisi o ovoj postavci. Gdje: *Izgled*, pod *Gantt › Vremenska os*.

**Prikaži četvrt sata pri jakom zumiranju** — dodatna fina vremenska skala. Zadano: isključeno. Učinak: možete dalje zumirati, a skala sati dobiva dodatni red za četvrt sata. Povlačenje trake zadatka u satima tada se može poravnati na četvrt sata umjesto na cijeli sat. To vidite samo kad je *Uključi planiranje u satima* uključeno. Gdje: *Izgled*, pod *Gantt › Zoom na četvrt sata*.

**Trake kod prekida** — crta li se zadatak u satima u blokovima. Odaberite između *Nikad ne dijeli*, *Dijeli kad je odabrano* i *Uvijek dijeli*. Zadano: *Dijeli kad je odabrano*. Učinak: traka zadatka u satima tada se crta po radnom bloku, umjesto kao jedan neprekinuti blok. *Dijeli kad je odabrano* to radi samo za odabrani zadatak. Odnosi se samo na zadatke u satima. Zadatak koji je zaista podijeljen (s *Podijeli zadatak*) prikazuje svoj prekid bez obzira na ovu postavku. Gdje: *Izgled*, pod *Gantt*.

**Pomicanje i zumiranje › Način rada** — što kotačić miša radi nad Ganttom. Odaberite između *Položaj*, *Tipke* i *Zumiranje + povlačenje*. Zadano: *Zumiranje + povlačenje*. Učinak: pri *Zumiranje + povlačenje* kotačić zumira oko kursora, Shift + kotačić pomiče retke, vremensku os pomičete povlačenjem pozadine, a Ctrl + povlačenje (na Macu Cmd) crta okvir za odabir. Pri *Položaj* funkcija kotačića ovisi o tome gdje je kursor; Ctrl + kotačić uvijek zumira, a Shift + kotačić uvijek pomiče vodoravno. Pri *Tipke* sami birate koja tipka što radi. Izbor vrijedi i za drugu vremensku os podijeljenog prikaza. Gdje: *Izgled*, pod *Gantt › Pomicanje i zumiranje*.

**Pomicanje i zumiranje › Podjela zaslona** — gdje mora biti kursor za koju funkciju. Vidljivo je samo u načinu rada *Položaj*. Odaberite između *Lijevo/desno*, *Gore/dolje* i *Gornji desni kut*. Zadano: *Lijevo/desno*. Učinak: pri *Lijevo/desno* kotačić pomiče okomito nad lijevom polovicom, a vodoravno nad desnom polovicom. Pri *Gore/dolje* kotačić pomiče vodoravno nad gornjih 30% (uz vremensku skalu), a ispod nje okomito. Pri *Gornji desni kut* kotačić pomiče vodoravno u gornjem desnom kvadrantu, a okomito u ostatku. Gdje: *Izgled*, pod *Gantt › Pomicanje i zumiranje*.

**Pomicanje i zumiranje › Okomito, Vodoravno, Zumiranje** — koja tipka pripada kojoj funkciji kotačića. Vidljivo je samo u načinu rada *Tipke*. Za svaku funkciju birate između *Pomicanje*, *Ctrl + kotačić* i *Shift + kotačić*. Zadano: *Okomito* je *Pomicanje*, *Zumiranje* je *Ctrl + kotačić*, a *Vodoravno* je *Shift + kotačić*. Učinak: ako odaberete tipku koja je već u uporabi, zamijenit će se s funkcijom koja ju je imala. Gdje: *Izgled*, pod *Gantt › Pomicanje i zumiranje*.

## Kartica Raspored

**Uključi građevinski način rada** — početne vrijednosti za nove projekte usmjerene na građevinarstvo. Zadano: uključeno. Učinak: uključeno novom projektu daje kalendar *Bouwkalender NL* s nizozemskim državnim praznicima, omogućuje odabir građevinskog godišnjeg odmora pri generiranju praznika, nudi predloške faziranja *Stambena gradnja* i *Poslovna gradnja / obnova* te novim zadacima daje kategoriju radova *Gradnja*. Isključeno daje kalendar *Standaardkalender* bez praznika, samo predložak *Prazno* i kategoriju radova *Ostalo*. Novi zadatak ispod nadređenog zadatka koji ima kategoriju radova prvo preuzima tu kategoriju; *Gradnja* ili *Ostalo* primjenjuje se tek nakon toga. Postojeći zadaci i kalendari se ne mijenjaju. Gdje: *Raspored*.

**Uključi planiranje u satima** — planiranje u radnim satima uz radne dane. Zadano: isključeno. Učinak: vremenska skala *Sat* pojavljuje se pod *Prikaz › Vremenska skala*. U prozoru *Kalendari* običan kalendar može dobiti blokove radnog vremena (blok *Radno vrijeme*; kalendar koji već ima blokove uvijek ga prikazuje), a prozor *Novi projekt* dobiva izbore *Smjena* i *Zadana jedinica za nove zadatke*. Također *Postavke projekta* dobivaju izbor *Zadana jedinica za nove zadatke*. Isključeno, aplikacija radi na razini dana. Zadaci koji su već u satima ostaju i uključeni su u izračun; trajanje im možete uređivati tek kad uključite planiranje u satima. Gdje: *Raspored*, pod *Planiranje u satima*. Pogledajte [Uključivanje planiranja u satima](docs://howto-urenplanning-aanzetten).

**Dopusti miješano planiranje po danima i satima** — određuje hoćete li za svaki zadatak birati jedinicu. Vidljivo je samo kad je *Uključi planiranje u satima* uključeno. Zadano: uključeno. Učinak: uključeno prikazuje padajući izbornik *Jedinica trajanja* uz trajanje svakog zadatka. Isključeno skriva taj izbornik. Gdje: *Raspored*, pod *Planiranje u satima*. Pogledajte [Dani i sati](docs://uitleg-dagen-en-uren).

**Početak tjedna** — prvi dan tjedna. Odaberite između *Ponedjeljak* i *Nedjelja*. Zadano: *Ponedjeljak*. Učinak: raspored tjedana i brojevi tjedana na vremenskoj skali u Ganttu i u izvješćima (ispis Gantt-dijagrama) te redoslijed dana u tjednu u prozoru *Kalendari*. Gdje: *Raspored*.

**Automatsko izračunavanje** — ponovno izračunava raspored čim više nije ažuran. Zadano: isključeno. Učinak: isključeno znači da *Izračunaj* (F5) pritisnete sami. Uključeno znači da aplikacija ponovno izračunava raspored u djeliću sekunde nakon promjene zadataka, ovisnosti ili kalendara. Tijekom povlačenja ili dok upisujete u polje, aplikacija čeka i izračuna jednom kad završite. Nakon neuspješnog izračuna ponovno izračunava tek kad nešto promijenite. Gdje: *Raspored*, pod *Izračunavanje*.

**Koristi vrste zadataka** — polja vrste zadatka i rada u aplikaciji. Zadano: isključeno. Učinak: uključeno prikazuje polje *Vrsta zadatka* na zadatku i stupac rada za dodjele te čini dostupnim stupac tablice *Vrsta zadatka*. Isključeno ih skriva; trajanje i jedinice ostaju, a rad se prilagođava. Projekt koji već sadrži podatke o vrsti zadatka ili radu, na primjer iz datoteke `.mpp` ili `.xer`, uvijek ih prikazuje, čak i kad je postavka isključena. Gdje: *Raspored*, pod *Izračunavanje*. Pogledajte [Vrste zadataka: trajanje, jedinice dodjele i rad](docs://uitleg-werkregels).

## Kartica Napredno

**Prikaži objašnjenje nakon otvaranja** — jedan potvrdni okvir po formatu: *Primavera datoteka (.xer)*, *MS Project datoteka (.mpp)*, *MS Project XML*, *Primavera P6 XML* i *CSV datoteka*. Zadano: sve uključeno. Učinak: uključeno prikazuje prozor s kratkim objašnjenjem formata nakon što otvorite takvu datoteku: što je aplikacija preuzela, što nije i kako rade spremanje i zapisivanje natrag. *Ne prikazuj ponovno za …* u tom prozoru poništava potvrdni okvir ovdje; ovdje ga ponovno uključujete. Datoteka IFC, primjer i projekt koje otvara AI pomoćnik ili proširenje nikad ne dobivaju to objašnjenje. Gdje: *Napredno*, pod *Prikaži objašnjenje nakon otvaranja*. Pogledajte [Otvaranje i spremanje datoteke](docs://howto-bestand-openen-en-opslaan).

**Omogući AI način rada** — omogućuje AI pomoćniku rad s vašim rasporedom. Zadano: isključeno. Učinak: uključeno prikazuje karticu *AI* s mostom MCP, pa AI pomoćnik može raditi s vašim rasporedom putem Model Context Protocol. Isključeno skriva karticu i zaustavlja most. Gdje: *Napredno*, pod *AI način rada*. Pogledajte [Povezivanje AI pomoćnika (MCP)](docs://howto-ai-assistent-koppelen).

**Automatski pokreni most** — pokreće most MCP kad se aplikacija pokrene. Može se uključiti samo kad je *Omogući AI način rada* uključeno. Zadano: isključeno. Učinak: most je odmah aktivan, pa se AI klijent može povezati bez da prvo otvorite karticu *AI*. To radi samo u aplikaciji za računalo i jednom po pokretanju: ako ga kasnije sami isključite, ne pokreće se ponovno. Gdje: *Napredno*, pod *AI način rada*.

**Uključi debug-terminal** — panel dnevnika za rješavanje problema. Zadano: isključeno. Učinak: uključeno stavlja gumb terminala u traku stanja, koji prikazuje ili skriva panel dnevnika. Isključeno zatvara panel. Gdje: *Napredno*, pod *Debug-terminal*.

**Benchmark…** — mjeri performanse motora izračuna rasporeda. Učinak: otvara prozor u kojem se generira testni raspored odabrane veličine i mjere se glavne faze. Vaš otvoreni projekt ostaje netaknut. To je gumb, a ne postavka: nema se što pamtiti. Gdje: *Napredno*, pod *Benchmark*.

**Statistika…** — koliko je puta aplikacija preuzeta. Učinak: otvara prozor *Statistika preuzimanja* s javnim podacima s GitHub Releases; ništa se ne prikuplja od vas. To je gumb, a ne postavka. Gdje: *Napredno*, pod *Statistika*. U prozoru:

- *Preuzimanja po operacijskom sustavu* — po sustavu stupci *Preuzimanja*, *Instalatori* (što osoba preuzme) i *Ažuriranja* (što program za ažuriranje u aplikaciji dohvaća), s *Ukupno*. Na Linuxu se to dvoje ne može razdvojiti: program za ažuriranje dohvaća istu datoteku `.deb`, `.rpm` ili `.AppImage` koju ljudi ručno preuzimaju, pa se tamo kao instalacija broji samo datoteka snap. Ispod toga *Provjere ažuriranja iz aplikacije*: koliko je puta program za ažuriranje u instaliranoj aplikaciji dohvatio datoteku s verzijom s GitHuba kako bi potražio novu verziju. To su provjere, a ne instalacije.
- *Po izdanju* — ista preuzimanja po verziji, s datumom; prvo šest najnovijih, a ostala s *Prikaži svih … izdanja*.
- *Izvor* — datum podataka (GitHub Releases, ažurira se tjedno) i *Osvježi sada*. Aplikacija zadržava dohvaćene podatke pola sata. Ako dohvat ne uspije, prozor to kaže. Instalacije putem Snap Storea ne idu preko GitHuba i nedostaju.

**Pokreni obilazak** — ponovno pokreće uvodni obilazak. Učinak: zatvara prozor *Postavke aplikacije* i pokreće obilazak od prvog koraka. Gdje: *Napredno*, pod *Obilazak*.

**Verzija** — broj verzije aplikacije, s dva gumba. *Provjeri ažuriranja* otvara prozor za ažuriranja. *Što je novo* prikazuje novosti trenutne verzije. Gdje: *Napredno*, pod *Verzija*.

**Prikaži klasične gumbe prikaza** — zamijenjena funkcija, pod *Zastarjele funkcije*. Zadano: isključeno. Učinak: uključeno vraća grupu *Prikaz* na karticu *Prikaz* s odvojenim gumbima *Stupci…*, *Filtriraj…*, *Grupiraj…* i *Sortiraj…*. Zamijenili su ih plus u zaglavlju tablice, gumbi za izgled i prozor za izgled. Gdje: *Napredno*, pod *Zastarjele funkcije*.

## Zapamćeni izbori prikaza izvan panela

Aplikacija također čuva ove izbore na ovom uređaju. Postavljate ih na samom elementu, a ne u panelu postavki.

**Prikaz temeljnog plana** — aktivni temeljni plan kao tanka traka ispod trake zadatka. Zadano: uključeno. Gdje: *Prikaz › Temeljni planovi i napredak › Prikaz temeljnog plana*.

**Linija napretka** — cik-cak linija napretka na datumu stanja. Zadano: uključeno. Učinak: linija se prikazuje samo kada projekt ima datum stanja. Tada zamjenjuje zasebnu liniju datuma stanja. Gdje: *Prikaz › Temeljni planovi i napredak › Linija napretka*.

**Linija datuma stanja** — točkasta linija na datumu stanja. Zadano: uključeno. Učinak: ako je linija napretka uključena, ona sama crta oznaku datuma stanja. Gdje: *Prikaz › Temeljni planovi i napredak › Linija datuma stanja*.

**Naglasak resursa** — tanka pruga u boji resursa ispod trake zadatka. Zadano: isključeno. Gdje: *Prikaz › Temeljni planovi i napredak › Naglasak resursa*.

**Traka vremenske rezerve** — vremenska rezerva kao pojas iza nekritičnih traka, ne za dovršene zadatke. Zadano: uključeno. Gdje: *Prikaz › Temeljni planovi i napredak › Traka vremenske rezerve*.

**Boje traka** — o čemu ovisi boja trake. Odaberite jednu od opcija *Kritični put*, *Po zadatku — automatski* i *Po kategoriji*. Zadano: *Kritični put*. Učinak: vrijedi za dijagram Gantt i za izvješće istodobno. Gdje: *Prikaz › Temeljni planovi i napredak › Boje traka*.

**Histogram** — pruga s histogramom ispod dijagrama Gantt. Zadano: isključeno. Gdje: *Resursi › Histogram › Histogram*, *Prikaz › Paneli › Histogram* ili Ctrl+Shift+H. Visinu pruge (zadano 160 piksela, između 80 i 480) postavljate povlačenjem njezina ruba.

**Mini-karta** — pregledna karta vremenske osi. Zadano: isključeno. Gdje: *Prikaz › Prezentacija › Mini-karta*.

**Sažimanje vrpce** — kompaktna vrpca. Zadano: isključeno. Gdje: gumb sa strelicom u donjem desnom kutu vrpce.

**Širina tablice zadataka** — zadano 350 piksela, između 150 i 800. Postavljate je povlačenjem razdjelnika uz tablicu. Ili koristite tipke sa strelicom lijevo i strelicom desno, kada je razdjelnik aktivan.

**Širina desnog panela** — zadano 280 piksela, između 200 i 900. Postavljate je povlačenjem ruba panela.

**Visina *Svojstva* i *Upozorenja* u desnom panelu** — zadano 240 i 220 piksela, između 120 i 2000. *Svojstva* imaju tu visinu i kada je popis resursa također otvoren. Visinu postavljate hvatištem za povlačenje između odjeljaka. Aplikacija ne pamti jesu li odjeljci otvoreni ili zatvoreni.

**Također se pamti, opisano drugdje** — aplikacija na ovom uređaju, a ne u datoteci projekta, također čuva: stupce tablice ([Prilagođavanje stupaca tablice](docs://howto-tabelkolommen-aanpassen)), vaše izglede ([Stvaranje i upotreba izgleda](docs://howto-layouts-gebruiken)), mogućnosti izvješća ([Vrste izvješća](docs://ref-rapporttypes)), vaše vlastite predloške profila izračuna ([Mogućnosti izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies)) i *Jezik dokumentacije* u pomoći (*Datoteka › Pomoć*).

## Pogledajte također

- [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies): opcije koje pripadaju projektu.
- [Uključivanje planiranja u satima](docs://howto-urenplanning-aanzetten): koraci za prekidač *Uključi planiranje u satima*.
- [Dani i sati](docs://uitleg-dagen-en-uren): kako aplikacija broji dane i sate.
- [Vrste zadataka: trajanje, jedinice dodjele i rad](docs://uitleg-werkregels): što *Koristi vrste zadataka* čini vidljivim.
- [Tipkovni prečaci](docs://ref-sneltoetsen): sve tipke aplikacije, uključujući one za zumiranje i pomicanje.
