# Instaliranje i upravljanje proširenjem

Cilj: instalirati proširenje, pročitati pitanje o dopuštenjima i kasnije onemogućiti ili ukloniti proširenje.

## Kada vam ovo treba

Proširenje dodaje nešto aplikaciji, a ne morate čekati novu verziju. Proširenje može, na primjer, dodati format uvoza koji se pojavljuje u *Datoteka › Uvezi*, staviti gumb u vrpcu ili dati font za PDF-izvoz. Službeni katalog ih dijeli u kategorije: *Uvoz/izvoz*, *Raspored*, *Izvješćivanje*, *Alati*, *Fontovi* i *Ostalo*.

Dobro razmislite prije instaliranja. Proširenje je programski kod koji radi s istim pravima kao i sama aplikacija, a aplikacija to ne može ograničiti. Zato aplikacija traži dopuštenje pri svakoj instalaciji. Što vidite u tom pitanju, objašnjeno je u nastavku.

## Koraci

### Instalacija proširenja iz kataloga

1. Odaberite *Datoteka › Proširenja*.
2. Odaberite karticu *Pregledaj*. Aplikacija dohvaća katalog dok prikazuje *Učitavanje kataloga...*. Što je u katalogu, određuje zaklada OpenAEC Foundation koja ga održava, i to se može promijeniti.
3. Potražite proširenje u polju *Pretraži proširenja...*. Traži po nazivu, opisu, autoru i oznakama.
4. Svaka pločica prikazuje naziv, verziju, kategoriju, opis i autora. Kliknite *Instaliraj*.
5. Otvara se prozor *Instalirati proširenje?*. Pročitajte ga i pogledajte sljedeći korak.
6. Kliknite *Instaliraj* za nastavak. Pritiskom na *Ne instaliraj* ništa se ne događa. Esc ili klik pokraj prozora također znači odbijanje, a aplikacija tada ne prikazuje poruku o grešci.

Nakon instalacije proširenje se odmah omogućuje. Na pločici u *Pregledaj* sada piše *Instalirano*. Što proširenje dodaje, vidite u samoj aplikaciji: novi gumb u vrpci ili format uvoza u *Datoteka › Uvezi*. Neka proširenja prikazuju i poruku. Prepoznajete je po prefiksu *Proširenje*, nakon kojeg slijedi naziv proširenja.

### Instalacija proširenja iz datoteke

Ako ste proširenje dobili kao datoteku, instalirajte ga ovako.

1. Odaberite *Datoteka › Proširenja*.
2. Gore desno kliknite *ZIP* za ZIP-datoteku ili *JS* za zasebnu JavaScript-datoteku.
3. Odaberite datoteku. Otvara se prozor *Instalirati proširenje?*, kao gore.

ZIP-datoteka mora sadržavati `manifest.json` i glavnu datoteku proširenja. Ako instalirate proširenje koje je već instalirano, nova verzija zamjenjuje staru. Ako aplikacija ne može instalirati datoteku, na primjer zato što je ZIP-datoteka oštećena, ništa se ne događa. Aplikacija za ZIP i JS ne prikazuje poruku o grešci, a proširenje se ne pojavljuje na popisu. Razlog je ipak u debug-terminalu. Uključite ga u *Postavke › Projekt › Postavke*, na kartici *Napredno*: *Omogući debug-terminal*. Otvorite ga gumbom *Prikaži debug-terminal* u traci stanja. Tamo piše, na primjer, *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (aplikacija ovaj tehnički tekst piše na nizozemskom).

### Čitanje pitanja o dopuštenjima

Pitanje pokazuje što trebate odlučiti.

- *Autor* i *Repozitorij* govore tko je napravio proširenje i gdje je izvorni kod.
- *Podrijetlo* govori odakle datoteka dolazi: *Iz internetskog kataloga proširenja*, *Iz ZIP-datoteke na ovom računalu* ili *Iz JavaScript-datoteke na ovom računalu*. Ispod toga piše je li datoteka provjerena. Za katalog piše *Preuzimanje je provjereno pomoću kontrolnog zbroja iz kataloga.* Ako katalog nema kontrolni zbroj, crveno piše *Katalog ne navodi kontrolni zbroj; ovo preuzimanje nije provjereno.* Za vlastitu datoteku piše *Odabrali ste ovu datoteku sami; nema vanjskog izvora za provjeru.*
- *Na što pristajete* kaže: *Proširenje je programski kod koji radi s istim pravima kao sam Open Planner Studio. Ništa ga ne ograničava. Instalirajte samo proširenja čijem autoru vjerujete.* Ispod toga piše što to znači na vašoj platformi. U desktop-aplikaciji piše *U desktop-aplikaciji to uključuje: čitanje i pisanje datoteka bilo gdje u vašoj korisničkoj mapi te pristup projektima, postavkama i međuspremniku.* U pregledniku piše *U pregledniku to znači: pristup spremljenim projektima i postavkama, datotekama kojima ste dali pristup te mreži.*
- *Što ovo proširenje navodno koristi* prikazuje dopuštenja koja je autor naveo kao male oznake. To je izjava autora, a ne ograničenje: *Ovo je izjava autora, a ne ograničenje; kod ipak može više.* Ako nema oznaka, piše *Ništa nije navedeno.* To ne znači da proširenje ne može ništa. Čak i bez oznaka proširenje može čitati i mijenjati podatke vašeg rasporeda te prikazivati poruke.

Oznake znače sljedeće:

- *ribbon*: proširenje stavlja gumbe u vrpcu.
- *events*: proširenje prati događaje u aplikaciji.
- *backstage*: proširenje dodaje formate uvoza u *Datoteka › Uvezi*.
- *pdf-fonts*: proširenje daje font za PDF-izvoz.
- *importSource*: proširenje smije čitati sve izvorne bajtove svake datoteke koju uvezete, na primjer sirovu Primavera-datoteku, uključujući polja koja ne završe u vašem projektu. I prozor to sam objašnjava.
- *help*: proširenje smije dodavati članke pomoći, otvarati ugrađene projekte kao novi dokument i prikazivati vodič koji pokazuje dijelove aplikacije. I prozor to sam objašnjava.
- *filesystem* i *network*: to su samo naznake onoga što autor namjerava. Aplikacija za njih nema funkciju.

### Onemogućivanje, ponovno omogućivanje ili uklanjanje proširenja

1. Odaberite *Datoteka › Proširenja* i karticu *Instalirano*. Svako proširenje ima pločicu s nazivom, verzijom, kategorijom, opisom i autorom.
2. Prekidačem na pločici onemogućujete proširenje (*Onemogući*) ili ga ponovno omogućujete (*Omogući*). Kad je proširenje onemogućeno, gumbi i formati uvoza koje je dodalo nestaju, ali proširenje ostaje instalirano. Ostaje isključeno i nakon ponovnog pokretanja aplikacije. Omogućeno proširenje pokreće se automatski kad se pokrene aplikacija.
3. Kliknite *Ukloni*. Gumb se mijenja u *Potvrdi*, s objašnjenjem *Kliknite ponovo za trajno uklanjanje*. Kliknite još jednom da uklonite proširenje. Aplikacija također čisti postavke koje je proširenje spremilo.

## Mogući problemi i što aplikacija tada radi

**Katalog se ne učitava.** Piše *Katalog nije moguće učitati:*, a iza toga je tehnički razlog. Pojavljuje se i gumb *Pokušaj ponovo*. To može biti zato što nemate internetsku vezu.

**Piše *Instalacija nije uspjela.* ispod pločice u katalogu.** Preuzimanje ili instalacija nisu uspjeli, na primjer zato što se kontrolni zbroj ne podudara. Tada ništa nije instalirano. To se razlikuje od odbijanja pitanja: tada nema poruke o grešci.

**Iznad popisa piše *Preskočeni unosi kataloga: 1*.** Katalog je sadržavao stavku koju aplikacija ne može upotrijebiti. Ostala proširenja možete instalirati kao i obično.

**Proširenje se ne pokreće.** Pločica tada prikazuje poruku o grešci, na primjer da proširenje treba noviju verziju Open Planner Studio, s prikazom vaše trenutne verzije, ili grešku koju je javilo samo proširenje. Proširenje tada nije aktivno. Ažurirajte aplikaciju ili uklonite proširenje.

**Pločica s oznakom *Karantena*.** Aplikacija nije mogla upotrijebiti spremljeno proširenje. Ispod naziva piše *Razlog:* s uzrokom. Gumbom *Ukloni iz pohrane* to očistite.

**Pisanje vlastitog proširenja.** Vodič za autore proširenja (manifest, API, dopuštenja) nalazi se u repozitoriju `OpenAEC-Foundation/open-planner-studio` na GitHubu, u datoteci `docs/extensions.md`.

**Proširenje ne pripada projektu.** Proširenja se spremaju u aplikaciji: u desktop-aplikaciji na ovom računalu, a u pregledniku u pohrani tog preglednika. Vrijede za sve vaše projekte i nisu dio datoteke projekta. Ako u pregledniku obrišete podatke web-mjesta, proširenja nestaju.

## Vidi također

- [Ažuriranje aplikacije](docs://howto-app-bijwerken): proširenje može tražiti noviju verziju aplikacije.
- [Dopuštenja proširenja](docs://ref-extensiepermissies): što znači svako dopuštenje u pitanju o instalaciji.
