# Otvaranje datoteke Primavera P6 (.xer)

Cilj: otvoriti raspored iz programa Primavera P6 izravno u aplikaciji, bez prethodnog izvoza u XML.

## Kad vam ovo treba

Naručitelj ili glavni izvođač radi u programu Primavera i isporučuje svoj raspored kao datoteku `.xer`. Želite ga pregledati, izračunati ili dopuniti. Aplikacija samo čita datoteke `.xer`: ne piše u `.xer` i nikada ne mijenja vašu datoteku. Iz datoteke preuzima strukturu WBS i zadatke s trajanjem, datumima, ograničenjima i napretkom. Preuzima i ovisnosti s vremenom odgode, kalendare te resurse s njihovim dodjelama. Uz to preuzima šifre zadatka, prilagođena polja (UDF), bilješke i postavke rasporeda programa P6. Zadatak vrste *Razina napora* postaje hamak.

## Koraci

1. Odaberite *Početna › Datoteka › Otvori* ili pritisnite Ctrl+O. Odaberite datoteku `.xer`.
2. Aplikacija otvara jednu karticu za svaki projekt koji ima zadatke. Projekt s najviše zadataka je aktivna kartica. Kartica se zove *Naziv projekta (ID projekta)* ako se ID projekta u programu P6 razlikuje od naziva. *Postavke projekta* prikazuju samo naziv. Ako preimenujete projekt, ID projekta ostaje iza naziva. Zatim se u prozoru ukratko objašnjava što je aplikacija preuzela iz datoteke i kako spremanje radi; pogledajte [Otvaranje i spremanje datoteke](docs://howto-bestand-openen-en-opslaan).
3. Pročitajte poruku na dnu. Za datoteku s tri projekta poruka može izgledati ovako: *XER datoteka otvorena: 3 projektna dokumenta.* Ispod nje su retci koji objašnjavaju što je aplikacija učinila. Pogledajte naslov u nastavku.
4. Provjerite je li ispod vrpce prikazana poruka: *Prikazujete raspored onako kako ga je Primavera spremila; pri ponovnom izračunavanju pomaknut će se 1 zadatak.* Primavera u datoteci bilježi vlastite izračunate datume. Ako se izračun aplikacije od njih razlikuje, aplikacija prikazuje datume iz Primavere dok ništa ne mijenjate. Zadatak koji je počeo ili je dovršen uvijek ostaje na svojim stvarnim datumima, kao u Primaveri. Što to znači i kako prijeći na vlastiti izračun aplikacije, opisano je u [Datumi onako kako su spremljeni](docs://uitleg-datums-zoals-opgeslagen). Može se pojaviti i poruka *Ova datoteka sadrži planiranje u satima.* s gumbom *Uključi planiranje u satima*. Pogledajte [Uključivanje planiranja u satima](docs://howto-urenplanning-aanzetten).
5. Spremite projekt pritiskom na Ctrl+S. Budući da se datoteka `.xer` nikada ne prepisuje, aplikacija pita gdje treba spremiti novu IFC datoteku. Kao naziv datoteke predlaže *Naziv projekta (ID projekta)*.

### Retci ispod poruke

Prvi redak poruke navodi broj otvorenih kartica. Ispod njega su samo retci koji vrijede. Obratite pozornost na sljedeće:

- *Ovaj projekt se izračunava kao Primavera P6. Promijenite u Datoteka → Informacije o projektu → Profil izračuna i opcije izračuna.* Aplikacija izračunava taj projekt prema pravilima izračuna programa Primavera. Pomoću *Otvori profil izračuna* otvorite postavku.
- *1 projekt temeljnog plana isključen.* i *1 temeljni plan materijaliziran.* Ako projekt u programu P6 određuje drugi projekt kao svoj temeljni plan, taj drugi projekt ne otvara se kao zasebna kartica. Postaje aktivni temeljni plan projekta koji ga navodi.
- *Upotrijebljeno je zaštitno zamjensko rješenje za temeljni plan.* Ako bi određivanje temeljnih planova značilo da se ne otvara nijedan projekt, ako se projekt poziva sam na sebe ili ako se projekti međusobno pozivaju u petlji, aplikacija jednostavno otvara sve projekte i ne stvara temeljne planove.
- *1 međuzavisnost projekata sačuvana.* Međuzavisnost između dvaju projekata. Aplikacija je čuva kao izvorni podatak, ali je ne pretvara u ovisnost u vašem rasporedu.
- *12 zadataka prikazuje datume onako kako ih je Primavera spremila (nisu ponovno izračunati).* Broj zadataka koje prikaz *Datumi onako kako su spremljeni* prikazuje s datumima iz Primavere: svaki zadatak za koji je datoteka zabilježila datume, ne samo oni koji se razlikuju.

Ostali retci su dijagnostika samog čitanja. Oni od vas ništa ne traže:

- broj pronađenih projekata;
- preskočeni prazni projekt;
- zanemarena neispravna referenca na temeljni plan;
- kodiranje teksta koje nije običan UTF-8 (obavijest navodi koje: za arapski, ćirilični ili grčki tekst aplikacija odabire odgovarajuću Windows kodnu stranicu, inače Windows-1252);
- zadaci bez planiranog početka (počinju na datumu stanja ili na datumu početka projekta iz datoteke);
- brojači nalaza u tablicama, kalendarima i brojevima, za nepoznate vrijednosti polja i za postavke rasporeda programa P6 koje je aplikacija zamijenila sigurnim izborom.

*Pročitaj više* otvara pomoć o otvaranju datoteka programa Primavera.

## Zamke i što aplikacija tada čini

**Nije sve pretvoreno u karticu ili ovisnost.** Projekt bez zadataka se ne otvara. Projekt temeljnog plana ne otvara se kao zasebna kartica. Međuzavisnost između dvaju projekata ne postaje ovisnost u vašem rasporedu. Aplikacija to navodi u retcima ispod poruke.

**Svaka kartica je zaseban projekt.** Ako ga spremite, IFC datoteka uz sebe čuva cijelu izvornu datoteku `.xer`. Ako kasnije ponovno otvorite tu IFC datoteku, aplikacija i dalje zna datume iz Primavere. Ako je taj izvorni arhiv oštećen ili je datoteku prepisao neki drugi IFC program, aplikacija javlja: *Izvorni XER arhiv u ovoj datoteci je neupotrebljiv i izostavljen je; sam projekt je potpuno otvoren.* Raspored, profil izračuna i svi podaci projekta su potpuni. Nedostaje: datumi onako kako ih je Primavera spremila i izvorno podrijetlo podataka za AI i proširenja. Ponovno otvorite izvornu datoteku `.xer` da biste ponovno dobili arhiv.

**IFC datoteka postaje veća.** Budući da IFC datoteka nosi cijelu izvornu datoteku `.xer`, veća je od IFC datoteke bez arhiva. Kod velike datoteke `.xer` to se vidi u veličini datoteke i u trajanju spremanja. Ako se u jednoj datoteci `.xer` otvori više projekata, svaka kartica koju spremite nosi cijelu datoteku `.xer`, ne samo svoj projekt.

**Izvoz u CSV, MS Project XML ili P6 XML gubi podatke.** Aplikacija upozorava: *Izvoz u CSV gubi informacije o izvoru XER-a.* IFC ne gubi ništa.

**Slobodna subota ili nedjelja koja nije u datoteci.** Aplikacija može takav dan vikenda sama označiti kao slobodan. Dan se tada u kalendaru zove *Iznimka kalendara (rekonstrukcija vikenda)*. Obrazac je opisan u [Formati uvoza i izvoza](docs://ref-import-exportformaten).

**Vremenska rezerva do datuma završetka projekta, bez datuma završetka.** Ako datoteka nema datum završetka, aplikacija isključuje opciju *Izračunati vremensku rezervu do datuma završetka projekta*. To se prikazuje u retku *N postavki rasporeda P6 upotrijebilo je sigurno zamjensko rješenje.* Pojedinosti su u [Formati uvoza i izvoza](docs://ref-import-exportformaten).

**Dovršeni zadaci na datumu stanja.** Dovršeni zadatak može se u prikazu *Datumi onako kako su spremljeni* prikazati kao uska traka na datumu stanja. To nije greška u vašoj datoteci. Objašnjenje i povezano pravilo izračuna opisani su u [Formati uvoza i izvoza](docs://ref-import-exportformaten).

**Brojevi sa zarezom kao decimalnim znakom.** Ako aplikacija ne može pouzdano utvrditi decimalni znak, ne otvara datoteku. Tako se raspored s pogrešno pročitanim brojevima nikada ne otvori. Zatražite od pošiljatelja novi izvoz.

**Datoteku koju aplikacija ne može pročitati.** Dobit ćete poruku o pogrešci s razlogom. Nekoliko primjera:

- *Ovo nije valjana ni podržana XER datoteka.*
- *Jedna XER tablica nema obavezne stupce.*
- *P6 projekt u ovoj XER datoteci ne sadrži zadatke.*
- *Decimalni zapis ove XER datoteke nije moguće pouzdano utvrditi.*

Tada se ništa ne otvara. Provjerite datoteku u programu P6 ili zatražite od pošiljatelja novi izvoz.

## Vidi također

- [Datoteke i formati](docs://uitleg-bestanden): zašto se datoteka `.xer` samo čita i što izvoz gubi.
- [Datumi onako kako su spremljeni](docs://uitleg-datums-zoals-opgeslagen): prikaz vlastitih datuma programa Primavera.
- [Otvaranje datoteke MS Project (.mpp)](docs://howto-mpp-openen): isto za MS Project.
- [Uključivanje planiranja u satima](docs://howto-urenplanning-aanzetten): ako datoteka sadrži podatke u satima.
- [Formati za uvoz i izvoz](docs://ref-import-exportformaten): za svaki format što se prenosi, a što ne.
- [Profili izračuna i pravila izračuna](docs://uitleg-rekenprofielen): zašto se datoteka P6 otvara sa svojim profilom izračuna.
