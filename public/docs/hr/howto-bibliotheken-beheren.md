# Upravljanje bibliotekama resursa i njihovo dijeljenje

Cilj: stvoriti i izbrisati biblioteke resursa, staviti kalendare u njih te izvesti ili uvesti biblioteku, kao sigurnosnu kopiju ili za upotrebu na drugom računalu.

## Kada vam ovo treba

Biblioteka nije u datotekama vašeg projekta, nego u aplikaciji: u desktop aplikaciji u datoteci na ovom računalu, a u pregledniku u pohrani tog preglednika. Ne sinkronizira se. Ako očistite podatke web-mjesta u pregledniku, biblioteka nestaje. Zato ju izvezite kao sigurnosnu kopiju. Ako kolega želi raditi s istim ekipama i standardnim tarifama, biblioteku mu također predajete kao datoteku. Ako vaša organizacija ima više operativnih društava sa svojim ekipama, za svako napravite zasebnu biblioteku. Za novi projekt birate koju biblioteku koristi.

Što je biblioteka, pročitajte u [Biblioteka resursa](docs://uitleg-resourcebibliotheek). Resurse ovdje ne uređujete. Uređujete ih u oknu resursa. Vidi [Korištenje biblioteke resursa](docs://howto-resourcebibliotheek-gebruiken).

## Koraci

### Otvorite zaslon za upravljanje

Odaberite *Datoteka › Biblioteka*. Lijevo je popis *Biblioteke resursa*. Desno su pojedinosti biblioteke koju kliknete: naziv, gumbi i popis *Kalendari*. Na vrhu piše da se resursima upravlja na kartici *Resursi*.

### Stvorite, preimenujte i odaberite zadanu biblioteku

1. Kliknite znak plus iznad popisa (*Dodaj biblioteku resursa*). Aplikacija dodaje biblioteku *Nova biblioteka resursa* i odmah ju odabire.
2. Upišite novi naziv u polje za naziv na vrhu desnog dijela i pritisnite Enter ili kliknite izvan polja. Aplikacija ne prihvaća prazan naziv.
3. Kliknite *Postavi kao zadanu* da ova biblioteka bude unaprijed odabrana za nove projekte od sada. Zadana biblioteka ima zvjezdicu na popisu.

### Stavite kalendar u biblioteku

1. Pod *Kalendari* kliknite *Iz projekta*. Otvara se popis kalendara vašeg aktivnog projekta.
2. Kliknite malu strelicu iza kalendara koji želite preuzeti. Iznad popisa piše *Dodano.* Kalendar koji je već povezan s ovom bibliotekom ima *već povezano* iza naziva.
3. Kalendar je sada na popisu *Kalendari* u biblioteci. Olovkom (*Uredi*) mijenjate naziv. Kvačicom ga spremate. Kanta za smeće briše kalendar odmah, bez pitanja za potvrdu. Kopije u projektima ostaju.

Iza *Kalendari* stoji broj verzije, na primjer *v2*. Broj se povećava uz svaku promjenu biblioteke. Kalendar iz biblioteke prelazi u projekt kad dodijelite resurs koji ga koristi. Kalendar dodijelite resursu na kartici *Resursi*, u prikazu *Biblioteka*, u stupcu *Kalendar*.

### Izvezite biblioteku

1. Odaberite biblioteku na popisu.
2. Kliknite *Izvezi*.
3. U desktop aplikaciji te u Chromeu i Edgeu birate mjesto datoteke. U drugim preglednicima datoteka odmah ide u mapu za preuzimanja, a aplikacija vas o tome obavještava. Datoteka se zove `bibliotheek-`, a zatim naziv biblioteke, s ekstenzijom `.ifc`.

Ispod gumba piše *Izvoz je ujedno vaša sigurnosna kopija. Čuvajte datoteku na sigurnom mjestu.*

### Uvezite biblioteku

1. Kliknite *Uvezi*. Otvara se prozor *Uvoz biblioteke* za biblioteku koju ste odabrali na popisu.
2. Kliknite *Odaberi datoteku…* i odaberite `.ifc` datoteku izvoza. Ako datoteka ne sadrži biblioteku, piše *Ova IFC datoteka ne sadrži biblioteku resursa.*
3. Aplikacija prikazuje sadržaj, na primjer *Kalendari: 2, resursi: 5 (verzija 3).*
4. Odaberite što želite učiniti. Pogledajte dolje.
5. Kliknite *Dodaj* ili *Zamijeni*, ili *Odustani* za prekid.

Imate dva izbora:

- *Dodaj kao novu biblioteku resursa*: datoteka postaje zasebna biblioteka uz vaše postojeće. Ispod piše pod kojim nazivom, na primjer *Dodat će se kao „Mijn resourcebibliotheek (2)“.* Ništa se ne gubi i vaš aktivni projekt ostaje povezan sa svojom bibliotekom.
- *Zamijeni postojeću biblioteku resursa*: sadržaj odabrane biblioteke u potpunosti se zamjenjuje sadržajem iz datoteke. Aplikacija to i kaže: *Uvoz zamjenjuje CIJELI skup odabrane biblioteke resursa.* Ako imate dvije ili više biblioteka, odaberite jednu pod *Uvezi u biblioteku resursa*. Ako je vaša biblioteka novija od datoteke, aplikacija upozorava: *Vaša lokalna biblioteka je novija. Uvozom se vaše promjene mogu prebrisati.*

Aplikacija sama predlaže izbor. Za datoteku koja je sadržavala zadanu biblioteku unaprijed je odabrano *Dodaj kao novu biblioteku resursa*. Ako biblioteka iz datoteke već postoji na vašem računalu i nije zadana, unaprijed je odabrano *Zamijeni postojeću biblioteku resursa*, s upravo tom bibliotekom odabranom. Ako niste sigurni, odaberite dodavanje. Time se ništa ne prebriše.

### Izbrišite biblioteku

1. Odaberite biblioteku na popisu i kliknite *Ukloni biblioteku resursa*. Gumb je siv kad postoji samo jedna biblioteka, jer uvijek mora ostati jedna.
2. Potvrdite s *Izbriši*. Pitanje glasi *Ukloniti ovu biblioteku resursa?* Ako su s njom povezani otvoreni projekti, piše *Ova biblioteka resursa povezana je s 1 otvorenim projektom. Uklanjanjem će se taj projekt odvojiti. Nastaviti?* Za više projekata piše isto, s brojem, na primjer *povezana s 2 otvorena projekta*.

Biblioteka je tada izbrisana, sa svim resursima i kalendarima u njoj. Otvoreni projekti koji su ju koristili više nisu povezani: njihovi resursi ostaju obični resursi projekta. Ako želite zadržati sadržaj, prvo ga izvezite.

### Predajte projekt zajedno s njegovom bibliotekom

Datoteka projekta sadrži vlastite kopije resursa. Ako želite predati i cijelu biblioteku, učinite sljedeće. Sam izvoz opisan je i u [Izvoz](docs://howto-exporteren).

1. Otvorite projekt povezan s bibliotekom i odaberite *Datoteka › Izvoz*.
2. Označite *Spremi i datoteku biblioteke*. Okvir se vidi samo za povezani projekt.
3. Odaberite karticu *IFC 4x3* i spremite datoteku. Aplikacija zatim traži i drugu datoteku. Ona se zove kao projekt, uz nastavak `-bibliotheek`, i sadrži biblioteku.

Okvir radi samo za IFC izvoz, ne za druge formate. Vaš kolega uvozi drugu datoteku na način opisan gore.

## Zamke i što aplikacija tada radi

**Dva planera, dvije biblioteke.** Aplikacija ne sinkronizira biblioteke između računala. Prozor za uvoz uvijek prikazuje upozorenje o tome: *Napomena: biblioteke se ne sinkroniziraju između uređaja. Ako dva planera rade s istom bibliotekom resursa, biblioteke se mogu razići. Ako vaša organizacija dijeli ekipe među operativnim društvima, namjerno odaberite jedan zajednički skup.*

**Zamjena briše sve.** Sve što ste imali u odabranoj biblioteci nestaje. Promjena biblioteke ne može se poništiti naredbom *Poništi*. Ako niste sigurni, prvo izvezite.

**Brisanje kalendara s popisa odmah se izvršava.** Aplikacija ne traži potvrdu, a kod brisanja resursa traži. To izgleda kao nedostatak. Promjena biblioteke ne može se poništiti naredbom *Poništi*.

## Vidi također

- [Biblioteka resursa](docs://uitleg-resourcebibliotheek): kako su biblioteka i projekt povezani.
- [Korištenje biblioteke resursa](docs://howto-resourcebibliotheek-gebruiken): povezivanje resursa, dodjela i rješavanje odstupanja.
- [Izvoz](docs://howto-exporteren): formati izvoza, uključujući IFC s datotekom biblioteke.
