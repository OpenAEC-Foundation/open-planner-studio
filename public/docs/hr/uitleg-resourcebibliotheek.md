# Biblioteka resursa

Vaša ekipa zidara ne radi za samo jedan projekt. Danas je na kućama na sjeveru, sutra na garažama na jugu. Biblioteka resursa je mjesto na kojem jednom zabilježite takvu ekipu, da svaki projekt koristi istu ekipu. Aplikacija tada može vidjeti i kad dva projekta traže iste ljude istog dana, što nijedan pojedinačni projekt ne može vidjeti. U ovom članku pročitate kako su biblioteka i projekt međusobno povezani i kako aplikacija računa zauzetost kroz projekte.

## Pojam

Postoje dva sloja.

**Biblioteka resursa** je popis resursa i kalendara koji pripadaju vašoj organizaciji: zidar, dizalica, žbukar, s njihovom vrstom, standardnom tarifom i brojem koji imate. Sam popis, koji aplikacija također zove *pool*, nije u datotekama vašeg projekta nego u aplikaciji: u desktop-aplikaciji u datoteci na ovom računalu, u pregledniku u pohrani tog preglednika. Ako u pregledniku obrišete podatke web-mjesta, biblioteka nestaje; zato je izvezite kao sigurnosnu kopiju. Uvijek postoji barem jedna biblioteka. Prva se zove *Mijn resourcebibliotheek* (nizozemski naziv), a možete je preimenovati.

**Projekt** odlučuje koliko resursa koristi i kada. Projekt je povezan s jednom bibliotekom ili stoji sam. Samostalni projekt radi dobro, samo bez zajedničkog popisa.

Projekt ne upućuje na biblioteku, nego zadržava **kopiju**. Kad iz biblioteke dodijelite *Bricklayer* projektu, aplikacija u projektu napravi kopiju s **oznakom podrijetla**: bilješku da ova kopija dolazi iz biblioteke X i da je tamo stavka Y. U tablici resursa takvu kopiju prepoznajete po maloj ikoni biblioteke. Kopija je običan resurs: zadatke joj možete dodijeliti, a pohranjena je u samoj datoteci projekta.

Kalendari u biblioteci resursa nisu isto što i popis kalendara vašeg projekta, kojim upravljate u dijalogu za kalendare. Kalendar iz biblioteke ulazi u vaš projekt zajedno s resursom koji ga koristi.

## Kako aplikacija radi s njom

### Što odlučuje biblioteka, a što projekt

Biblioteka odlučuje **što je resurs**: naziv, vrsta, standardna tarifa po satu, jedinica i opis. U kopiji u projektu ta se polja prikazuju kao običan tekst. Mijenjate ih u biblioteci, tako da su ispravna u svakom projektu. Ako kopija ipak treba ići svojim putem, odvojite je od biblioteke.

Projekt odlučuje **koliko i kada**: *Maksimalan postotak jedinica*, kapacitet koji se mijenja tijekom vremena (*Kapacitet po vremenskim fazama*) i koji kalendar resurs ima. Ta polja ostaju uredljiva u projektu i ne smatraju se odstupanjem od biblioteke. Naime, ista ekipa može na hitnom poslu raditi po drugom kalendaru nego na redovnom projektu. Sadržaj kalendara koji je došao uz resurs ipak prati biblioteku.

### Kada kopija prati biblioteku

Biblioteka ne osvježava kopije stalno, nego u fiksnim trenucima:

- Kad nešto promijenite u biblioteci, neizmijenjene kopije u svim otvorenim projektima odmah se ažuriraju.
- Kad otvorite projekt ili prijeđete na drugu karticu, aplikacija uspoređuje kopije s bibliotekom. Ako je neizmijenjena kopija zaostala, aplikacija je tiho ažurira i to kratko prijavi: *1 stavka ažurirana iz biblioteke* ili *N stavki ažurirano iz biblioteke*.

Aplikacija pamti vrijednosti iz trenutka kad je kopija nastala ili ažurirana. Ako se kopija sada razlikuje od tih vrijednosti, aplikacija ne odlučuje tko je u pravu. Kopija tada dobiva oznaku *odstupa — odlučite*. Kad otvorite datoteku s takvom kopijom, otvara se prozor *Poveži biblioteku resursa*. Tu za svaku stavku birete hoće li se primijeniti vrijednosti iz biblioteke ili hoće li vrijednosti iz vaše datoteke ući u biblioteku. Kad prelazite na drugu karticu, prozor se nikad ne pojavljuje.

Odstupanje nastaje, na primjer, kad vlastiti resurs u projektu povežete sa stavkom biblioteke s istim nazivom, ali drugačijim vrijednostima, pomoću *Prebaci u biblioteku*. Aplikacija ih doista poveže i odmah označi kopiju kao odstupajuću.

### Kad resurs nestane iz biblioteke

Ako izbrišete resurs iz biblioteke, kopija ostaje u vašim projektima i dalje radi. Dobiva oznaku *više nije u biblioteci*, a zatim je možete potpuno urediti ili ukloniti iz projekta.

### Zauzetost preko svih projekata

Histogram i preopterećenje resursa u projektu gledaju samo taj jedan projekt. Biblioteka zna više: koliko ukupno ima nekog resursa. Prikaz *Zauzetost* po danu zbraja opterećenje svih otvorenih projekata koji su povezani s istom bibliotekom i koriste kopiju tog resursa. Ako je zbroj na neki dan veći od kapaciteta biblioteke, taj se dan računa kao dan s preopterećenjem resursa.

Tri pravila određuju što se računa:

- Kapacitet dolazi iz biblioteke (*Maksimalan postotak jedinica* stavke biblioteke ili njezin *Kapacitet po vremenskim fazama* tog dana), a ne iz polja *Maksimalan postotak jedinica* kopije u projektu. Dva projekta, od kojih svaki ostaje unutar svoje dodjele, mogu zato zajedno ipak tražiti previše.
- Zbroj koji je točno jednak kapacitetu nije sukob. Mora se tražiti više od kapaciteta.
- Računaju se samo kopije s oznakom podrijetla i samo u projektima koji su u tom trenutku otvoreni u ovoj aplikaciji. Vlastiti resurs jednog projekta nije u biblioteci i zato se ne računa. Pregled ne vidi dokumente koji nisu otvoreni u ovoj aplikaciji; to je navedeno i na dnu samog pregleda.

## Primjer: ekipa zidara u dva projekta

Biblioteka sadrži resurs *Bricklayer* s poljem *Maksimalan postotak jedinica* 3: tri zidara na platnom popisu. Dva projekta ga koriste, oba s kopijom koja ima polje *Maksimalan postotak jedinica* 2.

- *Houses North* ima zadatak *Bricklaying facades* u trajanju od 5 radnih dana od ponedjeljka, 7. lipnja 2027., s 2 jedinice dodjele dnevno. Zadatak traje od 7. do 11. lipnja, uključivo.
- *Garages South* ima zadatak *Bricklaying garages* u trajanju od 4 radna dana od srijede, 9. lipnja 2027., s 2 jedinice dodjele dnevno. Vikend se ne računa, pa zadatak obuhvaća 9., 10., 11. i 14. lipnja.

Unutar svakog projekta traži se od zidara 2 od njegovih 2 jedinica dodjele. Nijedan projekt ne prijavljuje preopterećenje resursa: pod *Resursi › Preopterećenje* oba kažu *Nema*. Ipak zajedno premašuju 3 zidara. Aplikacija po danu računa:

- Ponedjeljak, 7. i utorak, 8. lipnja: 2 (samo Houses North)
- Srijeda, 9., četvrtak, 10. i petak, 11. lipnja: 2 + 2 = 4
- Ponedjeljak, 14. lipnja: 2 (samo Garages South)

Vrhunac je 4 naspram kapaciteta 3. Pregled prikazuje zidara s *2 dokumenta*, razdoblje *2027-06-07 – 2027-06-14*, *4.0 / 3.0* za vrhunac i kapacitet, te *3 dana s preopterećenjem resursa*: 9., 10. i 11. lipnja.

Što ako nešto promijenite:

- Ako *Bricklaying facades* traje 6 radnih dana, traje do ponedjeljka, 14. lipnja. Taj dan također dosegne 2 + 2 = 4, pa pregled prijavljuje *4 dana s preopterećenjem resursa*: 9., 10., 11. i 14. lipnja. Vrhunac ostaje 4.
- Ako biblioteka ima polje *Maksimalan postotak jedinica* 4, piše *4.0 / 4.0* i nema sukoba, jer zbroj nije veći od kapaciteta.
- Ako *Garages South* radi s 1 jedinicom dodjele dnevno umjesto 2, vrhunac je 3 i piše *3.0 / 3.0*: nema sukoba.
- Ako *Garages South* počne tek u ponedjeljak, 14. lipnja, projekti se ne preklapaju. Razdoblje postaje *2027-06-07 – 2027-06-17*, a vrhunac je *2.0 / 3.0*.

Koraci za pregled u vlastitim projektima nalaze se u [Korištenje pregleda zauzetosti](docs://howto-bezettingsoverzicht-gebruiken).

## Posljedice i pogrešna shvaćanja

**„Biblioteka je dijeljena sa mojim kolegama.“** Ne. Biblioteka živi u aplikaciji (u desktop-aplikaciji u datoteci na ovom računalu, u pregledniku u pohrani tog preglednika) i ne sinkronizira se. Ako dva planera rade s istom bibliotekom resursa, njihove biblioteke se mogu razilaziti. Dijeliti možete izvozom i uvozom, vidi [Upravljanje bibliotekama resursa i njihovo dijeljenje](docs://howto-bibliotheken-beheren). Ako vaša organizacija dijeli ekipe među poslovnim jedinicama, namjerno odaberite jednu zajedničku biblioteku. Pregled također vidi samo projekte koji su otvoreni u ovoj aplikaciji.

**„Ako promijenim biblioteku, sve u mojim projektima se mijenja.“** Mijenja se samo identitet resursa: naziv, vrsta, standardna tarifa, jedinica i opis. *Maksimalan postotak jedinica*, kapacitet tijekom vremena i izbor kalendara projekta ostaju kakvi jesu.

**„Mogu poništiti promjenu u biblioteci.“** Ne. Biblioteka pripada aplikaciji, a ne projektu, pa promjene u njoj ne spadaju pod *Poništi* (Ctrl+Z). Prikaz *Biblioteka* na to upozorava sam: *Ovo uređuje biblioteku i vrijedi za sve projekte. Ovo se ne može poništiti*. Brisanje iz biblioteke također traži potvrdu i ne može se poništiti.

**„Pregled zauzetosti rješava preopterećenje resursa.“** Ne, pregled je samo za čitanje. Prikazuje na koje dane dva projekta zajedno traže previše. *Uravnoteživanje* (*Resursi › Uravnoteživanje › Razriješi…*, vidi [Uravnoteživanje resursa](docs://uitleg-nivelleren)) gleda resurse jednog projekta i ne uzima u obzir druge projekte. Sami pomaknite zadatak u jednom od projekata ili promijenite kapacitet u biblioteci ako se netko zaista pridruži.

**„Moj vlastiti resurs ulazi u zauzetost.“** Samo ako je u biblioteci. Resurs koji ste napravili samo u projektu, primjerice unajmljena dizalica za jedan posao, nema oznaku podrijetla i zato nije u pregledu. Pomoću *Prebaci u biblioteku* dodajete ga u biblioteku.

## Pogledajte također

- [Korištenje biblioteke resursa](docs://howto-resourcebibliotheek-gebruiken): povezivanje, dodjela resursa i rješavanje odstupanja.
- [Upravljanje bibliotekama resursa i njihovo dijeljenje](docs://howto-bibliotheken-beheren): stvaranje, izvoz i uvoz biblioteka.
- [Korištenje pregleda zauzetosti](docs://howto-bezettingsoverzicht-gebruiken): traženje preopterećenja resursa kroz projekte.
- [Upravljanje resursima](docs://howto-resources-beheren): resursi jednog projekta.
