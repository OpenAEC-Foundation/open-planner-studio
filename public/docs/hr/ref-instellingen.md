# Postavke

Svaka postavka aplikacije: što radi, početna vrijednost, što se mijenja i gdje je pronađete. Za opcije izračuna projekta (profil izračuna, definicija kritičnosti) pogledajte [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies). Te opcije pripadaju datoteci projekta, a ne aplikaciji.

## Gdje ih pronaći i kako rade

Panel postavki nalazi se na tri mjesta, i svugdje je isti panel: zupčanik na vrhu prozora, *Postavke › Projekt › Postavke* i *Datoteka › Postavke*. Panel ima tri kartice: *Izgled*, *Raspored* i *Napredno*. Svaka postavka u nastavku navodi samo karticu.

Promjena odmah stupa na snagu. Nema gumba *Primijeni* i nema gumba *Odustani*.

**Za cijelu aplikaciju, ne po projektu.** Sve postavke u ovom članku vrijede za sve vaše projekte i pripadaju ovom uređaju. Aplikacija ih čuva u pohrani aplikacije ili u pregledniku, a ne u datoteci projekta. Druga osoba koja otvori vašu datoteku zato vidi svoje postavke. Ako obrišete pohranu preglednika, ponovno se koriste početne vrijednosti.

## Kartica Izgled

**Tema** — shema boja sučelja. Odaberite između *Tamna*, *Svijetla* i *Visoki kontrast*. Zadano: *Tamna*. Učinak: boje cijelog sučelja, uključujući Gantt prikaz i histogram. Gdje: *Izgled*.

**Prati temu sustava** — dopušta da o temi odlučuje vaš operacijski sustav. Zadano: isključeno. Učinak: aplikacija je *Svijetla* ili *Tamna*, ovisno o vašem sustavu; tri kartice za temu tada su isključene. *Visoki kontrast* ne prati vaš sustav: ovu temu birate sami. Ako ovo isključite, ostaje tema koja je u tom trenutku bila na ekranu. Gdje: *Izgled*, pod *Tema*.

**Jezik** — jezik sučelja. Zadano: jezik vašeg preglednika ili sustava, ako ga aplikacija poznaje, inače engleski. Učinak: svi tekstovi u aplikaciji; četrnaest jezika poredano je po kratici. Arapski i perzijski prikazuju sučelje zrcalno, s desna na lijevo. Jezik članaka pomoći postavljate posebno, pod *Jezik dokumentacije* u *Datoteka › Pomoć*. Gdje: *Izgled*.

**Font** — font cijelog sučelja. Odaberite između *Zadano*, *Sustav*, *Serifno* i *Monospace*. Zadano: *Zadano*. Učinak: naslovi i tekst u prozorima te tekst u Gantt prikazu i histogramu. Web-aplikacija sama ne preuzima font vašeg sustava; zato ga birate ovdje. Gdje: *Izgled*.

**Veličina teksta** — veličina sučelja. Odaberite između 90%, 100%, 110% i 125%. Zadano: 100%. Učinak: tekst i raspored vrpce, panela i dijaloga postaju veći ili manji, a visina redaka tablice i Gantt prikaza prati tu promjenu. Iznad 125% nema izbora, jer se oznake gumba u vrpci tada lome u više redaka. Gdje: *Izgled*.

**Format datuma** — način prikaza datuma. Odaberite između *dd-mm-gggg*, *mm-dd-gggg* i *gggg-mm-dd*. Zadano: *dd-mm-gggg*. Učinak: datumi u tablici, dijalozima, izvješćima i ispisu. Datoteke i izračuni se ne mijenjaju: mijenja se samo prikaz. Gdje: *Izgled*.

**Prikaz trajanja** — u kojoj se jedinici prikazuje trajanje zadatka. Odaberite između *Automatski (vlastita jedinica po zadatku)*, *Uvijek dani* i *Uvijek sati*. Zadano: *Automatski (vlastita jedinica po zadatku)*. Učinak: tablica zadataka, oznake traka u Gantt prikazu, opis alata, ispis i izvješća. Kod *Automatski* zadatak u danima prikazuje dane, a zadatak u satima prikazuje sate. Kod *Uvijek dani* ili *Uvijek sati* aplikacija pretvara vrijednosti s brojem radnih sati po danu iz kalendara zadatka. Ako se jedinica zadatka razlikuje, aplikacija iza toga stavlja njegovu vlastitu jedinicu u zagradi, na primjer `2.25d(18h)`. Mijenja se samo prikaz; zadatak zadržava svoju jedinicu. Gdje: *Izgled*.

**Stil prebacivanja dokumenta** — način prebacivanja između otvorenih projekata. Odaberite između *Vodoravne kartice*, *Okomite kartice* i *Pilula*. Zadano: *Vodoravne kartice*. Učinak: *Vodoravne kartice* stavljaju traku kartica ispod vrpce; *Okomite kartice* stavljaju traku projekata lijevo; *Pilula* stavlja mali gumb projekta u naslovnu traku. Gdje: *Izgled*.

### Odjeljak Gantt

**Prikaži samo radne dane** — sažima vremensku os. Zadano: isključeno. Učinak: vikendi i praznici iz kalendara projekta preskaču se, pa zadatak od 5 radnih dana zauzima točno 5 dana na vremenskoj osi. Prečaci *Idi na danas* i *Prilagodi projektu* tada također broje radne dane. Izvješće ima vlastiti potvrdni okvir s istim imenom, neovisan o ovoj postavci. Gdje: *Izgled*, pod *Gantt › Vremenska os*.

**Prikaži četvrt sata pri jakom zumiranju** — dodatna fina vremenska skala. Zadano: isključeno. Učinak: možete zumirati dalje, a satnoj skali dodaje se red s četvrt sata. Povlačenjem trake zadatka u satima tada se zadatak može poravnati na četvrt sata umjesto na cijeli sat. Ovo vidite samo kad je uključeno *Uključi planiranje u satima*. Gdje: *Izgled*, pod *Gantt › Zoom na četvrt sata*.

**Trake zadataka kod prekida** — određuje crta li se zadatak u satima u blokovima. Odaberite između *Nikad ne dijeli*, *Dijeli kad je odabrano* i *Uvijek dijeli*. Zadano: *Dijeli kad je odabrano*. Učinak: traka zadatka u satima crta se tada po bloku radnog vremena, a ne kao jedan neprekinut blok. *Dijeli kad je odabrano* to radi samo za odabrani zadatak. Odnosi se samo na zadatke u satima. Zadatak koji je zaista podijeljen (s *Podijeli zadatak*) prikazuje svoj prekid bez obzira na ovu postavku. Gdje: *Izgled*, pod *Gantt*.

**Pomicanje i zumiranje › Način** — što kotačić miša radi iznad Gantt prikaza. Odaberite između *Položaj*, *Tipke* i *Zumiranje + povlačenje*. Zadano: *Zumiranje + povlačenje*. Učinak: kod *Zumiranje + povlačenje* kotačić zumira oko pokazivača, Shift + kotačić pomiče kroz retke, vremensku os pomičete povlačenjem pozadine, a Ctrl + povlačenje (na Macu Cmd) crta okvir za odabir. Kod *Položaj* funkcija kotačića ovisi o tome gdje je pokazivač; Ctrl + kotačić uvijek zumira, a Shift + kotačić uvijek pomiče vodoravno. Kod *Tipke* sami birate koja tipka što radi. Izbor vrijedi i za drugu vremensku os podijeljenog prikaza. Gdje: *Izgled*, pod *Gantt › Pomicanje i zumiranje*.

**Pomicanje i zumiranje › Podjela zaslona** — gdje mora biti kursor za koju funkciju. Vidljivo samo u načinu *Položaj*. Odaberite između *Lijevo/desno*, *Gore/dolje* i *Gornji desni kut*. Zadano: *Lijevo/desno*. Učinak: kod *Lijevo/desno* kotačić pomiče okomito preko lijeve polovice, a vodoravno preko desne. Kod *Gore/dolje* kotačić pomiče vodoravno preko gornjih 30% (blizu vremenske skale), a okomito ispod nje. Kod *Gornji desni kut* kotačić pomiče vodoravno u gornjem desnom kvadrantu, a okomito u ostatku. Gdje: *Izgled*, pod *Gantt › Pomicanje i zumiranje*.

**Pomicanje i zumiranje › Okomito, Vodoravno, Zumiranje** — koja tipka pripada kojoj funkciji kotačića. Vidljivo samo u načinu *Tipke*. Za svaku funkciju birate između *Pomicanje*, *Ctrl + kotačić* i *Shift + kotačić*. Zadano: *Okomito* je *Pomicanje*, *Zumiranje* je *Ctrl + kotačić*, a *Vodoravno* je *Shift + kotačić*. Učinak: ako odaberete tipku koja je već u upotrebi, zamijeni se s funkcijom koja ju je imala. Gdje: *Izgled*, pod *Gantt › Pomicanje i zumiranje*.

## Kartica Raspored

**Uključi način rada za gradnju** — početne vrijednosti za gradnju za nove projekte. Zadano: uključeno. Učinak: uključeno daje novom projektu kalendar *Bouwkalender NL* s nizozemskim državnim praznicima, dopušta izbor građevinskog godišnjeg odmora pri stvaranju praznika, nudi predloške faza *Stambena gradnja* i *Poslovna gradnja / obnova* te daje novim zadacima vrstu zadatka *Gradnja*. Isključeno daje kalendar *Standaardkalender* bez praznika, samo predložak *Prazno* i vrstu zadatka *Ostalo*. Novi zadatak pod nadređenim zadatkom koji ima vrstu zadatka najprije preuzima tu vrstu; *Gradnja* ili *Ostalo* primjenjuje se nakon toga. Postojeći zadaci i kalendari se ne mijenjaju. Gdje: *Raspored*.

**Uključi planiranje u satima** — planiranje u radnim satima uz radne dane. Zadano: isključeno. Učinak: oznaka *Sat* pojavljuje se pod *Prikaz › Vremenska skala*, prozor *Kalendari* dobiva blok *Radno vrijeme*, a prozor *Novi projekt* dobiva izbore *Smjena* i *Zadana jedinica za nove zadatke*. Također *Podaci o projektu* dobiva izbor *Zadana jedinica za nove zadatke*. Isključeno, aplikacija radi na razini dana. Zadaci koji su već u satima ostaju i ulaze u izračun; njihovo trajanje možete mijenjati tek kad uključite planiranje u satima. Gdje: *Raspored*, pod *Planiranje u satima*. Pogledajte [Uključivanje planiranja u satima](docs://howto-urenplanning-aanzetten).

**Dopusti mješovito planiranje po danima i satima** — određuje možete li birati jedinicu po zadatku. Vidljivo samo kad je uključeno *Uključi planiranje u satima*. Zadano: uključeno. Učinak: uključeno prikazuje padajući izbornik *Jedinica trajanja* uz trajanje svakog zadatka. Isključeno skriva taj izbornik. Gdje: *Raspored*, pod *Planiranje u satima*. Pogledajte [Dani i sati](docs://uitleg-dagen-en-uren).

**Tjedan počinje** — prvi dan tjedna. Odaberite između *Ponedjeljak* i *Nedjelja*. Zadano: *Ponedjeljak*. Učinak: raspored tjedana i brojevi tjedana na vremenskoj skali u Gantt prikazu i u izvješćima (ispis Gantt prikaza), te redoslijed dana u tjednu u prozoru *Kalendari*. Gdje: *Raspored*.

**Automatsko izračunavanje** — ponovno izračunava raspored čim on zastari. Zadano: isključeno. Učinak: isključeno znači da sami pritisnete *Izračunaj* (F5). Kad je uključeno, aplikacija ponovno izračunava raspored unutar djelića sekunde nakon promjene zadataka, ovisnosti ili kalendara. Dok povlačite ili dok upisujete u polje, aplikacija čeka i izračuna jednom kad završite. Nakon neuspjelog izračuna ponovno izračunava tek kad nešto promijenite. Gdje: *Raspored*, pod *Izračunavanje*.

**Prikaži pravila rada i rad** — polja pravila rada i rada u aplikaciji. Zadano: isključeno. Učinak: uključeno prikazuje polje *Pravilo rada* na zadatku i stupac rada za dodjele te čini dostupnim stupac tablice *Pravilo rada*. Isključeno to skriva; trajanje i jedinice ostaju, a rad se prilagođava. Projekt koji već sadrži podatke o pravilu rada ili radu, na primjer iz datoteke `.mpp` ili `.xer`, uvijek ih prikazuje, čak i kad je postavka isključena. Gdje: *Raspored*, pod *Izračunavanje*. Pogledajte [Pravila rada: trajanje, jedinice i rad](docs://uitleg-werkregels).

## Kartica Napredno

**Omogući AI način rada** — dopušta AI pomoćniku da radi s vašim rasporedom. Zadano: isključeno. Učinak: uključeno prikazuje karticu *AI* s mostom MCP, pa AI pomoćnik može raditi s vašim rasporedom preko Model Context Protocol. Isključeno skriva karticu i zaustavlja most. Gdje: *Napredno*, pod *AI način rada*. Pogledajte [Povezivanje AI pomoćnika (MCP)](docs://howto-ai-assistent-koppelen).

**Pokreni most automatski** — pokreće MCP most kad se aplikacija pokrene. Može se uključiti samo kad je uključeno *Omogući AI način rada*. Zadano: isključeno. Učinak: most je odmah aktivan, pa se AI klijent može povezati bez da prvo otvorite karticu *AI*. Ovo radi samo u desktop-aplikaciji i to jednom po pokretanju: ako ga kasnije sami isključite, ne pokreće se ponovno. Gdje: *Napredno*, pod *AI način rada*.

**Omogući debug-terminal** — panel dnevnika za rješavanje problema. Zadano: isključeno. Učinak: uključeno dodaje gumb terminala u traku stanja; on prikazuje ili skriva panel dnevnika. Isključeno zatvara panel. Gdje: *Napredno*, pod *Debug-terminal*.

**Benchmark…** — mjeri učinak motora za raspoređivanje. Učinak: otvara prozor u kojem se generira testni raspored odabrane veličine i mjeri se trajanje glavnih faza. Vaš otvoreni projekt ostaje nepromijenjen. To je gumb, a ne postavka: ništa se ne pamti. Gdje: *Napredno*, pod *Benchmark*.

**Statistika…** — koliko je puta aplikacija preuzeta. Učinak: otvara prozor *Statistika preuzimanja* s javnim podacima iz GitHub Releases; ništa se ne prikuplja od vas. To je gumb, a ne postavka. Gdje: *Napredno*, pod *Statistika*. U prozoru:

- *Preuzimanja po operacijskom sustavu* — po sustavu stupci *Preuzimanja*, *Instalatori* (ono što osoba preuzme) i *Ažuriranja* (ono što ažurirač u aplikaciji dohvati), s *Ukupno*. Na Linuxu se to dvoje ne može razdvojiti: ažurirač dohvaća istu datoteku `.deb`, `.rpm` ili `.AppImage` koju ljudi ručno preuzimaju. Zato se tu kao instalator broji samo snap-datoteka. Ispod toga *Provjere ažuriranja iz aplikacije*: koliko je puta ažurirač u instaliranoj aplikaciji dohvatio datoteku s verzijom s GitHuba da potraži novu verziju. To su provjere, a ne instalacije.
- *Po izdanju* — iste preuzimanja po verziji, s datumom; prvo šest najnovijih, s *Prikaži svih … izdanja* za ostale.
- *Izvor* — datum podataka (GitHub Releases, ažurirano svaki tjedan) i *Osvježi sada*. Aplikacija zadržava dohvaćene brojke pola sata. Ako dohvaćanje ne uspije, prozor to kaže. Instalacije preko Snap Storea ne prolaze kroz GitHub i zato nedostaju.

**Pokreni obilazak** — uvodni obilazak opet. Učinak: zatvara prozor postavki i pokreće obilazak od prvog koraka. Gdje: *Napredno*, pod *Obilazak*.

**Verzija** — broj verzije aplikacije, s dva gumba. *Provjeri ažuriranja* otvara prozor za ažuriranja. *Što je novo* prikazuje novosti trenutne verzije. Gdje: *Napredno*, pod *Verzija*.

**Prikaži klasične gumbe za prikaz** — zamijenjena funkcija, pod *Zastarjele funkcije*. Zadano: isključeno. Učinak: uključeno vraća grupu *Prikaz* na karticu *Prikaz*, sa zasebnim gumbima *Stupci…*, *Filtar…*, *Grupiranje…* i *Sortiranje…*. Zamijenjeni su plusom u zaglavlju tablice, gumbima za izgled i prozorom za izgled. Gdje: *Napredno*, pod *Zastarjele funkcije*.

## Zapamćeni izbori prikaza izvan panela

Aplikacija također čuva ove izbore na ovom uređaju. Postavljate ih na samom elementu, a ne u panelu postavki.

**Prikaz temeljnog plana** — aktivni temeljni plan kao tanka traka ispod trake zadatka. Zadano: uključeno. Gdje: *Prikaz › Temeljni planovi i napredak › Prikaz temeljnog plana*.

**Linija napretka** — cik-cak linija napretka na datumu stanja. Zadano: uključeno. Učinak: linija se prikazuje samo kada projekt ima datum stanja. Tada zamjenjuje zasebnu liniju datuma stanja. Gdje: *Prikaz › Temeljni planovi i napredak › Linija napretka*.

**Linija datuma stanja** — točkasta linija na datumu stanja. Zadano: uključeno. Učinak: ako je linija napretka uključena, ona sama crta oznaku datuma stanja. Gdje: *Prikaz › Temeljni planovi i napredak › Linija datuma stanja*.

**Naglasak resursa** — tanka pruga u boji resursa ispod trake zadatka. Zadano: isključeno. Gdje: *Prikaz › Temeljni planovi i napredak › Naglasak resursa*.

**Traka vremenske rezerve** — vremenska rezerva kao pojas iza nekritičnih traka. Zadano: uključeno. Gdje: *Prikaz › Temeljni planovi i napredak › Traka vremenske rezerve*.

**Boje traka** — o čemu ovisi boja trake. Odaberite između *Kritični put*, *Po zadatku — automatski* i *Po kategoriji*. Zadano: *Kritični put*. Učinak: vrijedi za dijagram Gantt i za izvješće istodobno. Gdje: *Prikaz › Temeljni planovi i napredak › Boje traka*.

**Histogram** — pruga s histogramom ispod dijagrama Gantt. Zadano: isključeno. Gdje: *Resursi › Histogram › Histogram*, *Prikaz › Paneli › Histogram* ili Ctrl+Shift+H. Visinu pruge (zadano 160 piksela, između 80 i 480) postavljate povlačenjem njezina ruba.

**Mini-karta** — pregledna karta vremenske osi. Zadano: isključeno. Gdje: *Prikaz › Prezentacija › Mini-karta*.

**Sažimanje vrpce** — kompaktna vrpca. Zadano: isključeno. Gdje: gumb sa strelicom u donjem desnom kutu vrpce.

**Širina tablice zadataka** — zadano 350 piksela, između 150 i 800. Postavljate je povlačenjem razdjelnika uz tablicu. Ili koristite tipke sa strelicom lijevo i strelicom desno, kada je razdjelnik aktivan.

**Širina desnog panela** — zadano 280 piksela, između 200 i 900. Postavljate je povlačenjem ruba panela.

**Visina *Svojstava* i *Upozorenja* u desnom panelu** — zadano 240 i 220 piksela, između 120 i 2000. *Svojstva* imaju tu visinu i kada je popis resursa otvoren. Visinu postavljate hvatištem za povlačenje između odjeljaka. Aplikacija ne pamti jesu li odjeljci otvoreni ili zatvoreni.

**Također se pamti, opisano drugdje** — aplikacija na ovom uređaju, a ne u datoteci projekta, također čuva: stupce tablice ([Prilagođavanje stupaca tablice](docs://howto-tabelkolommen-aanpassen)), vaše izglede ([Stvaranje i upotreba izgleda](docs://howto-layouts-gebruiken)), mogućnosti izvješća ([Vrste izvješća](docs://ref-rapporttypes)), vaše vlastite predloške profila izračuna ([Mogućnosti izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies)) i *Jezik dokumentacije* u pomoći (*Datoteka › Pomoć*).

## Pogledajte i

- [Mogućnosti izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies): mogućnosti koje pripadaju projektu.
- [Uključivanje planiranja u satima](docs://howto-urenplanning-aanzetten): koraci za prekidač *Uključi planiranje u satima*.
- [Dani i sati](docs://uitleg-dagen-en-uren): kako aplikacija broji dane i sate.
- [Pravila rada: trajanje, jedinice dodjele i rad](docs://uitleg-werkregels): što *Prikaži pravila rada i rad* čini vidljivim.
- [Tipkovnički prečaci](docs://ref-sneltoetsen): sve tipke aplikacije, uključujući one za zumiranje i pomicanje.
