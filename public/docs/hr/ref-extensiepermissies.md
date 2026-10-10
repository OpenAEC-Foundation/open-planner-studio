# Dozvole proširenja

Svaka dozvola koju proširenje može navesti u svom manifestu: što dopušta, što se događa kad nedostaje i što vidite pri instalaciji proširenja. Kako upravljate proširenjima i kako ih instalirate, opisano je u [Instaliranje i upravljanje proširenjem](docs://howto-extensie-installeren).

## Što je dozvola, a što nije

Dozvola je **izjava autora**: koje dijelove sučelja aplikacije proširenje želi koristiti. Ona nije prepreka. Programski kod proširenja radi u istom okruženju kao i sama aplikacija, pa može učiniti više nego što dozvole navode: nema sandboxa. Aplikacija to navodi i u prozoru za instalaciju. Instalirajte proširenja samo od autora kojima vjerujete.

Aplikacija provodi dozvolu na jedan od tri načina, a razlika je važna:

**Strogo provedeno.** Ako dozvola nedostaje, odgovarajuća metoda javlja pogrešku prije nego što se išta dogodi (na nizozemskom, na primjer *Extensie „…“ mist permissie: ribbon*).

**Upozorenje.** Ako dozvola nedostaje, metoda i dalje radi, ali aplikacija zapisuje upozorenje u dnevnik. U budućoj verziji to postaje odbijanje.

**Samo informativno.** Dozvola nije povezana ni s jednim dijelom sučelja. Aplikacija je prikazuje pri instalaciji i ne radi s njom ništa drugo.

Radnje koje ne traže dozvolu čine temelj sučelja proširenja: čitanje projekta, kalendara, zadataka, ovisnosti, resursa i dodjela; dodavanje zadataka i ovisnosti te mijenjanje zadataka; učitavanje projekta, ponovno izračunavanje i objedinjavanje više promjena; čuvanje vlastitih postavki, čitanje vlastitih priloženih datoteka i prikazivanje obavijesti.

**Manifest.** Dozvole su u manifestu zapisane kao popis. Proširenje koje sada instalirate, s dozvolom koju ova verzija aplikacije ne poznaje, odbija se. Za već spremljeno starije proširenje aplikacija izostavlja nepoznate dozvole i to bilježi u dnevniku.

## Kako aplikacija traži potvrdu

Pri instalaciji iz kataloga (*Datoteka › Proširenja › Pregledaj › Instaliraj*) ili iz datoteke (*ZIP* ili *JS*) aplikacija prikazuje prozor *Instalirati proširenje?*. Pitanje se prikaže samo jednom, pri instalaciji: ne pri svakom uključivanju proširenja.

Prozor prikazuje naziv, verziju, opis, autora i, ako postoji, repozitorij. U odjeljku *Podrijetlo* piše odakle proširenje dolazi (*Iz internetskog kataloga proširenja*, *Iz ZIP-datoteke na ovom računalu* ili *Iz JavaScript-datoteke na ovom računalu*). Piše i je li preuzimanje provjereno: s kontrolnim zbrojem iz kataloga, nije provjereno jer katalog ne daje zbroj, ili kao datoteka koju ste sami odabrali. U odjeljku *Na što pristajete* piše da je proširenje programski kod koji ima ista prava kao aplikacija. Piše i što to znači u praksi: u aplikaciji za računalo, među ostalim čitanje i pisanje datoteka bilo gdje u vašoj korisničkoj mapi te pristup projektima, postavkama i međuspremniku. U pregledniku je to pristup spremljenim projektima i postavkama, datotekama kojima ste dali pristup i mreži.

U odjeljku *Što ovo proširenje navodno koristi* nalaze se dozvole iz manifesta, kao kratke oznake s imenom kao u nastavku. Piše: *Ovo je izjava autora, a ne ograničenje; kod ipak može više.* Ako proširenje nema dozvola, piše *Ništa nije navedeno.* Dvije dozvole dobivaju objašnjenje: *importSource* i *help*. Ostalih šest dobiva samo svoju oznaku.

Odabirom *Instaliraj* pristajete. *Ne instaliraj*, tipka Esc i klik izvan prozora odbijaju instalaciju.

## Dozvole

**ribbon** — postavlja gumb u vrpcu. Učinak: proširenje smije dodati gumb u grupu na kartici vrpce. Proširenje bez ove dozvole dobiva pogrešku kad to pokuša. Gumbi se pojavljuju na kraju odabrane kartice, pod oznakom grupe proširenja, i nestaju kad isključite ili uklonite proširenje. Zadano: nije dodijeljeno; samo ono što je u manifestu. Provedba: strogo. Gdje: na kartici koju je proširenje odabralo.

**events** — prati događaje aplikacije i sam šalje događaje. Učinak: proširenje se smije pretplatiti na događaje i odjaviti se od njih te sam slati događaje. Aplikacija sama šalje tri: učitan je projekt (nakon uvoza, otvaranja ili učitavanja od strane proširenja), stvoren je prazan projekt i raspored je izračunat (ili ponovno izračunat). Zadano: nije dodijeljeno; samo ono što je u manifestu. Provedba: strogo. Gdje: nigdje; proširenje reagira na događaj.

**backstage** — nudi format uvoza. Učinak: proširenje smije registrirati uvoznik; pojavljuje se u *Datoteka › Uvezi*, gdje kliknete format i odaberete datoteku. Ugrađeni formati su odvojeni od toga (vidi [Formati uvoza i izvoza](docs://ref-import-exportformaten)). Zadano: nije dodijeljeno; samo ono što je u manifestu. Provedba: upozorenje. Ako dozvola nedostaje, registracija i dalje radi, uz upozorenje u dnevniku. To je privremeno rješenje, jer postojeća proširenja ne navode uvijek dozvolu. Gdje: *Datoteka › Uvezi*.

**pdf-fonts** — dostavlja font za izvoz u PDF. Učinak: proširenje smije registrirati pružatelja fontova. Izvoz u PDF ga koristi za znakove koje ugrađeni fontovi ne pokrivaju, na primjer kineske, japanske i korejske znakove. Zadano: nije dodijeljeno; samo ono što je u manifestu. Provedba: strogo. Gdje: u PDF-u izvješća; u prozoru za instalaciju postoji samo oznaka.

**importSource** — čita izvorne bajtove uvezene datoteke. Učinak: proširenje smije zatražiti potpuni sadržaj izvorne datoteke uvezenog projekta (za sada: Primavera datoteka), uključujući polja koja aplikacija namjerno ne preuzima u vaš projekt, kao što su polja revizije i podrijetla, troškovi, polja pregleda i lokacije. To je znatno šire od ostatka sučelja, pa je zato zasebna dozvola. Bez dozvole aplikacija ne čita ni jedan bajt izvorne datoteke: svaka metoda tada javlja pogrešku prije nego što se išta dohvati. Zadano: nije dodijeljeno; samo ono što je u manifestu. Provedba: strogo, zadano odbijeno. Gdje: u prozoru za instalaciju uz nju ide objašnjenje: *importSource — potpuni izvorni bajtovi svake uvezene datoteke (na primjer neobrađena Primavera datoteka), uključujući polja koja nikada ne dospiju u projekt.*

**help** — dodaje članke pomoći i smjernice. Učinak: proširenje smije registrirati i povući članke pomoći (lekcije), otvoriti priloženu `.ifc` datoteku kao novi dokument te pokrenuti i zaustaviti vodič koji ukazuje na dijelove aplikacije. Priloženi projekt nikad ne prepisuje dokument u kojem radite: otvara se kao novi dokument ili samo preuzima praznu, nepromijenjenu karticu. Od verzije ugovora 1.4.0. Zadano: nije dodijeljeno; samo ono što je u manifestu. Provedba: strogo. Gdje: u prozoru *Pomoć* (članci), kao nova kartica (projekt) i kao vodič koji ukazuje na gumbe. U prozoru za instalaciju uz nju ide objašnjenje: *help — smije dodavati članke pomoći, otvarati priložene projekte kao novi dokument i prikazivati vodič koji ukazuje na dijelove aplikacije.*

**filesystem** — proširenje navodi da koristi datoteke. Učinak: nema. Nijedan dio sučelja nije povezan s time, a aplikacija to ne može provesti. Zadano: nije dodijeljeno; samo ono što je u manifestu. Provedba: samo informativno. Gdje: kao oznaka u prozoru za instalaciju.

**network** — proširenje navodi da koristi mrežu. Učinak: nema; kao *filesystem*. Zadano: nije dodijeljeno; samo ono što je u manifestu. Provedba: samo informativno. Gdje: kao oznaka u prozoru za instalaciju.

## Vidi također

- [Formati uvoza i izvoza](docs://ref-import-exportformaten): formati koje aplikacija sama poznaje, uz ono što proširenja dodaju pod *Datoteka › Uvezi*.
- [Instaliranje i upravljanje proširenjem](docs://howto-extensie-installeren): instaliranje, isključivanje i uklanjanje proširenja.
