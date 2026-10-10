# Stupci tablice

Tablica zadataka ima 86 fiksnih stupaca. Uz to ima jedan stupac za svaku šifru zadatka i prilagođeno polje projekta, te osam stupaca po temeljnom planu. Ovaj članak za svaki stupac navodi što prikazuje, može li se uređivati i u kojem se obliku upisuje vrijednost. Kako birati i rasporediti stupce, opisano je u članku [Prilagođavanje stupaca tablice](docs://howto-tabelkolommen-aanpassen).

## Gdje birate stupce

Tablica zadataka pored Gantt dijagrama i tablica na kartici *Tablica* imaju svaka svoj izbor stupaca. Gumb s plusom na desnoj strani zaglavlja otvara prozor za odabir stupaca (naslov prozora *Odaberi stupac*). Također možete upotrijebiti *Tablica › Stupci › Stupci…*. Prozor prikazuje stupce po kategorijama: *Zadatak*, *Raspored*, *Ograničenja*, *Ovisnosti*, *Resursi*, *Napredak*, *Izračunato*, *Temeljni plan*, *Prilagođeno* i *Tehnički*. Pretražujete po nazivu, a *Nedavno korišteno* je na vrhu. *Vrati na zadano* vraća zadane stupce.

Prema zadanim postavkama tablica pored Gantt dijagrama prikazuje *WBS*, *Naziv zadatka* i *Trajanje*. Tablica na kartici *Tablica* prikazuje *WBS*, *Naziv zadatka*, *Trajanje*, *Početak*, *Završetak*, *Vrsta zadatka*, *Kritičan*, *Ukupan slobodni hod* i *Napredak*, uz to po jedan stupac za svaku šifru zadatka i prilagođeno polje projekta.

## Kako se vrijednosti čitaju i uređuju

- **Izračunati stupci** — stupci u kategoriji *Izračunato* i nekoliko drugih stupaca samo su za čitanje: vrijednosti dolaze iz izračuna. Ako pokušate urediti ćeliju koja je samo za čitanje, aplikacija kaže *Ovaj izračunati stupac ne može se uređivati.* Ta poruka je opća za svaku ćeliju koja je samo za čitanje, čak i kad stupac nije izračunat. Ako su vrijednosti zastarjele jer ste nešto promijenili, pored njih se pojavljuje *zastarjelo* dok ne pritisnete *Izračunaj*.
- **Datumi** — prikazuju se u zapisu koji ste odabrali u dijalogu *Postavke*, na kartici *Prikaz*, pod odjeljkom *Format datuma*.
- **Trajanja i vremenske rezerve** — trajanje se prikazuje u jedinici zadatka (`5d`, `12h`) ili prema *Prikaz trajanja* na istoj kartici (*Automatski (vlastita jedinica po zadatku)*, *Uvijek dani* ili *Uvijek sati*). Vremenska rezerva se prikazuje u radnim danima, s dvije decimale i decimalnim znakom vašeg jezika.
- **Da/Ne** — vrijednost da ili ne prikazuje se kao *Da* ili *Ne*; prazna vrijednost kao crtica (—).
- **Uređivanje** — upisujete ili birate vrijednost. Neispravnu vrijednost aplikacija odbija i razlog prikazuje ispod ćelije, na primjer *Unesite ispravno trajanje, na primjer 5d ili 8h.* ili *Unesite postotak između 0 i 100.* Lijepljenje bloka ćelija radi ćeliju po ćeliju. Ćelije koje su samo za čitanje preskaču se, a aplikacija javlja koliko ih je bilo.

## Zadatak

- **Naziv zadatka** — naziv zadatka. Može se uređivati, obavezan je. Zadatak sažetka prikazuje se podebljano, sa svijetlom pozadinom u ćeliji naziva. Kontrolna točka prikazuje se podebljano u boji kontrolne točke (ista skupina boja kao kontrolna točka u Gantt dijagramu). Običan zadatak ostaje kakav je. To je samo oblikovanje: odabir, povlačenje i uređivanje rade isto.
- **Opis** — opis. Može se uređivati; slobodan tekst.
- **WBS** — WBS šifra. Može se uređivati i obavezna je, ali samo za čitanje dok je uključen *WBS auto*.
- **Vrsta zadatka** — vrsta zadatka (*Gradnja*, *Instalacija*, *Rušenje*, *Logistika*, *Inspekcija*, *Premještanje*, *Obnova*, *Održavanje* ili *Ostalo*). Može se uređivati s popisom.
- **Prilagođena vrsta zadatka** — prilagođena vrsta zadatka iz projekta ili crtica. Može se uređivati s popisom prilagođenih vrsta projekta.
- **Boja** — spremljena boja zadatka, kao šifra boje, na primjer `#1a73e8`. Može se uređivati s odabirnikom boja. Sprema se u IFC datoteku, ali nijedna traka ni izvješće je ne upotrebljava. Boje traka postavljate u *Prikaz › Temeljni planovi i napredak › Boje traka*.
- **Bilješke** — bilješke, kao `✓ tekst; ○ tekst`. Može se uređivati dok postoji najviše jedna bilješka; tada uređujete njezin tekst. S više bilješki samo su za čitanje.

## Raspored

- **Kontrolna točka** — je li zadatak kontrolna točka. Može se uređivati. Uključivanjem se trajanje postavlja na 0. Aplikacija to odbija za zadatak sažetka i za zadatak s dodjelama.
- **Vrsta kontrolne točke** — *Početna kontrolna točka* ili *Završna kontrolna točka*, ili crtica za automatski. Može se uređivati samo na kontrolnoj točki.
- **Obvezna kontrolna točka** — oznaka *Obvezno (ugovorno)*. Može se uređivati samo na kontrolnoj točki.
- **Prioritet uravnoteživanja** — cijeli broj od 0 do 1000, zadano 500. Može se uređivati. Vrijednost 1000 fiksira zadatak za uravnoteživanje.
- **Razmaci podjele** — broj prekida, kao `Razmaci podjele: 2`, ili crtica. Samo za čitanje; uređujete ih u panelu *Svojstva*.
- **Pravilo rada** — pravilo rada za zadatak; prazno znači zadano za projekt. Može se uređivati s popisom. Prazno je i samo za čitanje na kontrolnoj točki, zadatku sažetka ili hamaku. U prozoru za odabir vidljivo je samo kad su pravila rada prikazana (*Prikaži pravila rada i rad*, ili datoteka sadrži pravila rada).
- **Hamak (izvedeno trajanje)** — je li zadatak hamak. Može se uređivati, osim na kontrolnoj točki ili zadatku sažetka.
- **Kalendar** — identifikator vlastitog kalendara zadatka; prazno (—) znači kalendar projekta. Upisujete ili birate identifikator iz prijedloga; nepoznat identifikator se odbija. Napomena: ćelija trenutno prikazuje interni identifikator umjesto naziva. Bolje je odabrati kalendar u panelu *Svojstva*.
- **Vrsta trajanja** — *Radno vrijeme* (trajanje se broji u radnim danima ili radnim satima kalendara) ili *Proteklo vrijeme* (trajanje se broji u neprekinutom vremenu na satu, bez kalendara). Može se uređivati.
- **Jedinica trajanja** — *Dani* ili *Sati*. Može se uređivati, osim na zadatku sažetka, hamaku ili kontrolnoj točki. Prebacivanje radi samo ako je pretvorba točna i ako je uključena opcija *Uključi planiranje u satima*.
- **Trajanje** — trajanje zadatka, u jedinici zadatka ili prema *Prikaz trajanja*. Može se uređivati: upisujete `5d`, `12h` ili `1h 30m`, ili broj u jedinici zadatka. Samo za čitanje na zadatku sažetka, hamaku i kontrolnoj točki s trajanjem 0.
- **Početak** — prikazani početak, isti datum kao traka u Gantt dijagramu. Može se uređivati. Zadatak s prethodnikom, kojem dodijelite novi početak, dobiva ograničenje *Ne početi prije (SNET)* na taj datum. Samo za čitanje na zadatku sažetka ili hamaku, osim ako je ručno planiran.
- **Završetak** — prikazani završetak. Može se uređivati: novi završetak postaje novo trajanje. Aplikacija to odbija za dovršen zadatak, kontrolnu točku, zadatak u proteklom vremenu i zadatak s prekidima, te za završetak prije početka (*Završetak je prije početka.*). Samo za čitanje na zadatku sažetka ili hamaku, osim ako je ručno planiran.
- **Planirani početak** — sidro za planiranje, od kojeg izračun kreće (ne mora biti prikazani početak). Može se uređivati; učinak je isti kao da upišete u polje *Početak*.
- **Planirani završetak** — uneseni završetak. Može se uređivati samo na ručno planiranom zadatku. Inače aplikacija kaže *Planirani završetak vrijedi samo za ručno planiran zadatak. Završetak promijenite u stupcu Završetak ili preko trajanja.*

## Ograničenja

- **Vrsta ograničenja** — vrsta ograničenja, od *Što prije moguće (ASAP)* do *Mora završiti na (MFO)*. Može se uređivati. Zadatak bez ograničenja prikazuje *ASAP*.
- **Datum ograničenja** — datum ograničenja. Može se uređivati.
- **Čvrsto ograničenje** — oznaka *Obvezno (logika fiksiranja)*. Može se uređivati samo na *MSO* i *MFO*.
- **Vrsta sekundarnog ograničenja** — vrsta druge granice, ili crtica. Može se uređivati. Tablica nudi sve vrste, ali nedopuštena kombinacija se odbija: druga vrsta mora biti *SNET*, *FNET*, *SNLT* ili *FNLT*, primarno ograničenje mora biti granica (ne *ASAP*, *ALAP*, *MSO*, *MFO* ni čvrsto ograničenje), a dvije granice moraju graničiti s suprotnih strana (donja granica *SNET*/*FNET* s gornjom granicom *SNLT*/*FNLT*, ili obrnuto).
- **Datum sekundarnog ograničenja** — datum druge granice. Može se uređivati.
- **Rok za dovršetak** — ciljni datum za završetak. Može se uređivati.

## Ovisnosti

- **Prethodnici** — prethodnici, kao `WBS vrsta±vrijeme odgode`, odvojeni s `; `, na primjer `1.2 FS+2d`. Može se uređivati tako da upišete isti oblik. Međuzavisnost projekata ovdje ne dodajete, nego s *Raspored › Ovisnosti › Poveži › Dodaj međuzavisnost projekata…*.
- **Nasljednici** — nasljednici, u istom obliku. Može se uređivati.
- **Odlučujuće ovisnosti** — ovisnosti koje određuju datum ovog zadatka, kao `← 1.2` (prethodnik) ili `→ 1.4` (nasljednik). Samo za čitanje; zastarjelo dok ne pritisnete *Izračunaj*.
- **Slobodni hod** (u kategoriji *Ovisnosti*) — slobodni hod po ovisnosti, kao `← 1.2: 3d`. Nije isti stupac kao *Slobodni hod* pod *Izračunato*, koji prikazuje vremensku rezervu samog zadatka. Samo za čitanje.
- **Upozorenja** — upozorenja po ovisnosti, na primjer *Izvan redoslijeda* ili *Nije uračunato u izračun*. Samo za čitanje. Pogledajte [Obavijesti i upozorenja](docs://ref-meldingen).

## Resursi

- **Dodijeljeni resursi** — nazivi dodijeljenih resursa, odvojeni zarezima. Može se uređivati: dodavanjem naziva dodjeljuje se resurs s 1 jedinicom dodjele po danu, a uklanjanjem naziva uklanja se dodjela. Samo za čitanje na kontrolnoj točki ili zadatku sažetka.
- **Jedinice dodjele po danu** — jedinice po resursu, kao `Naziv: 1; Naziv: 0.5`. Može se uređivati na zadatku s dodjelama.
- **Krivulja dodjele** — krivulja po resursu, kao `Naziv: Uniform`. Može se uređivati na zadatku s dodjelama.
- **Početak radnog prozora** i **Završetak radnog prozora** — radni prozor po resursu, iz uvezene datoteke, kao `Naziv: datum`. Samo za čitanje.
- **Planirani rad (sati)** i **Stvarni rad (sati)** — planirani i stvarni rad po resursu u satima, kao `Naziv: 12`, iz uvezene datoteke. Samo za čitanje.
- **Preostali posao (sati)** — preostali posao po resursu u satima, kao `Naziv: 6`: spremljeni rad, a inače preostalo trajanje × jedinice dodjele. Može se uređivati na zadatku s dodjelama na koje se primjenjuje pravilo rada. Vidljivo je u prozoru za odabir samo kad su pravila rada prikazana.

## Napredak

- **Status** — *Nije započeto*, *U tijeku* ili *Dovršeno*. Može se uređivati, osim na zadatku sažetka.
- **Napredak** — postotak, kao `40%`. Može se uređivati s brojem od 0 do 100, osim na zadatku sažetka.
- **Stvarni početak** — datum kada je zadatak počeo. Može se uređivati, osim na zadatku sažetka.
- **Stvarni završetak** — datum kada je zadatak završen. Može se uređivati, osim na zadatku sažetka.
- **Stvarno trajanje** — stvarno trajanje, kao broj. Može se uređivati, osim na zadatku sažetka.
- **Preostalo** — preostalo trajanje, u jedinici zadatka. Može se uređivati, osim na zadatku sažetka.
- **Datum nastavka** i **Datum zaustavljanja** — nastavak i zaustavljanje zadatka koji je u tijeku, iz datoteke MS Project ili Primavera. Samo za čitanje.

Stupci napretka slijede pravila napretka aplikacije: aplikacija odbija stvarni datum koji je nakon datuma stanja. Na zadatku sažetka aplikacija kaže *Napredak zadatka sažetka izvodi se iz podzadataka i ovdje se ne može mijenjati.*

## Izračunato

Svi stupci u ovoj kategoriji su samo za čitanje.

- **Kašnjenje zbog uravnoteživanja** — koliko je radnih dana uravnoteživanje odgodilo zadatak; crtica ako uravnoteživanje nije primijenjeno.
- **Najraniji početak** i **Najraniji završetak** — najraniji datumi iz izračuna.
- **Kasni početak** i **Kasni završetak** — najkasniji datumi na kojima zadatak još smije početi ili završiti bez kašnjenja datuma završetka projekta.
- **Slobodni hod** — radni dani za koje zadatak smije kasniti bez kašnjenja nasljednika.
- **Ukupan slobodni hod** — radni dani za koje zadatak smije kasniti bez kašnjenja datuma završetka projekta. Negativan je ako se ograničenje ili rok za dovršetak ne mogu ispuniti.
- **Kritičan** — *Da* ako je zadatak na kritičnom putu.
- **Ometajuća vremenska rezerva** — ukupan slobodni hod minus slobodni hod.
- **Gotovo kritičan** — *Da* za gotovo kritičan zadatak. Popunjava se samo ako je uključena opcija *Označi gotovo kritične* (*Podaci o projektu*, blok *Profil izračuna i opcije izračuna*); inače crtica.
- **Put vremenske rezerve** — redni broj puta vremenske rezerve, 1 za najkritičniji. Popunjava se samo ako je uključena opcija *Više putova vremenske rezerve*; inače crtica.
- **Izvor zabilježenih datuma** — za datoteku sa zabilježenim datumima: *Odstupa* ili *Djelomično nije zabilježeno*. Vidljivo je u prozoru za odabir samo za takvu datoteku. Ako datumi nisu zabilježeni, *Nije zabilježeno* pojavljuje se u stupcima kasnih datuma i vremenske rezerve.

Pogledajte [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad).

## Temeljni plan

Za svaki temeljni plan projekta dodaju se stupci. Ispred naziva stupca stoji naziv temeljnog plana (`<baseline> — Planirani početak`). Stupci su samo za čitanje. Zadatak koji nije u temeljnom planu prikazuje crticu sa savjetom *Nije prisutno u ovom temeljnom planu*.

- **Planirani početak**, **Planirani završetak** i **Trajanje** — početak, završetak i trajanje kako ih je temeljni plan zabilježio.
- **Odstupanje početka** i **Odstupanje završetka** — broj radnih dana između temeljnog plana i prikazanog početka ili završetka, u kalendaru projekta. Pozitivan je ako je zadatak kasniji.
- **Odstupanje trajanja** — trenutno trajanje minus trajanje u temeljnom planu, u radnim danima.

## Prilagođeno

- **Šifra zadatka** — jedan stupac po šifri zadatka, s nazivom šifre. Prikazuje šifru odabrane vrijednosti. Može se uređivati: upisujete šifru ili je birate iz prijedloga. Nepoznata šifra se odbija. Ako se šifra pojavljuje više puta, aplikacija traži da je odaberete s popisa.
- **Prilagođeno polje** — jedan stupac po prilagođenom polju, s nazivom polja. Unos odgovara vrsti: tekst, broj, cijeli broj, trošak, datum ili da/ne. Može se uređivati.

Ti stupci pripadaju projektu u kojem se šifra ili polje nalazi. Pogledajte [Šifre i prilagođena polja](docs://howto-codes-en-velden).

## Tehnički

Svi stupci u ovoj kategoriji su samo za čitanje. Prikazuju podatke koje aplikacija sprema, ali ne prikazuje u običnom stupcu, na primjer za provjeru uvoza.

- **ID zadatka** — interni identifikator zadatka.
- **ID nadređenog zadatka** i **ID podzadataka** — identifikatori nadređenog zadatka i podzadataka.
- **ID-ovi resursa** — identifikatori resursa na zadatku.
- **ID dodjele**, **ID zadatka dodjele** i **ID resursa dodjele** — identifikatori dodjela, zadataka i resursa ovog zadatka.
- **Trajanje (minute)** i **Preostalo (minute)** — trajanje i preostalo trajanje u minutama; popunjava se samo na zadatku u satima.
- **Kašnjenje zbog uravnoteživanja (minute)** i **Kašnjenje zbog uravnoteživanja u proteklom vremenu** — kašnjenje zbog uravnoteživanja iz datoteke MS Project u minutama i računa li se u vremenu na satu.
- **Ručno planiran** — je li zadatak ručno planiran.
- **Vrsta zadatka u datoteci MS Project (uvoz)** i **Vođeno radom** — vrsta zadatka i oznaka vođeno radom kakvi su bili u datoteci MS Project.
- **Porijeklo Primavera P6** — polja izvora iz datoteke Primavera, kao `key: value`.
- **Izričit zadatak sažetka** — je li zadatak izričit sažetak bez podzadataka (iz datoteke Primavera).
- **Vremenski raspodijeljena donja granica završetka**, **Vremenski raspodijeljeno sidro početka**, **Vremenski raspodijeljeni segmenti trajanja** i **Vremenski raspodijeljeni obrisi** — raspodjela sati iz datoteke MS Project, kao datumi i brojevi.
- **Podaci o šifri zadatka**, **Podaci o prilagođenim poljima** i **Podaci o bilješkama** — broj dodjela šifri, prilagođenih polja i bilješki.
- **Podaci o unutarnjim ovisnostima** i **Podaci o međuzavisnostima projekata** — broj unutarnjih ovisnosti i međuzavisnosti projekata.
- Za svaki temeljni plan ovdje su također **Kontrolna točka** i **Vrsta kontrolne točke**, kako ih je temeljni plan zabilježio.
