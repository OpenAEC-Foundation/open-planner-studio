# Otvaranje MS Project datoteke (.mpp)

Cilj: otvoriti raspored iz programa Microsoft Project izravno u aplikaciji, bez prethodnog izvoza.

## Kada vam ovo treba

Izvođač, konzultant ili naručitelj šalje vam njihov raspored kao `.mpp` datoteku. Želite ga pregledati, izračunati ili dalje razvijati. Aplikacija čita `.mpp` datoteke iz programa MS Project od verzije 2010 do uključivo 2021. Aplikacija samo čita: ne piše `.mpp` i nikad ne mijenja vašu datoteku. Iz datoteke preuzima sam raspored: zadatke sa strukturom, trajanjem i ograničenjima, ovisnosti s vremenom odgode, kalendare, resurse, dodjele i napredak. Aplikacija čita i datume i vremensku rezervu koje je MS Project sam izračunao, ali ih upotrebljava samo za prikaz *Datumi kako su zapisani*, nikad kao ulaz.

## Koraci

1. Odaberite *Početna › Datoteka › Otvori* ili pritisnite Ctrl+O. Odaberite `.mpp` datoteku.
2. Projekt se otvara na novoj kartici ili u trenutnoj kartici, ako je ona još bila prazna i nepromijenjena. Projekt nema datoteku: *Spremi* kasnije zapisuje novu IFC datoteku.
3. Pročitajte poruku na dnu: *Ovaj projekt izračunava se kao Microsoft Project. Promijenite u Datoteka → Podaci o projektu → Profil izračuna i opcije izračuna.* Aplikacija izračunava ovaj projekt načinom izračuna programa MS Project: profil izračuna *Microsoft Project*. *Otvori profil izračuna* vodi vas do postavke, a *Pročitaj više* otvara Pomoć o profilima izračuna.
4. Provjerite ima li ispod vrpce poruku: *Prikazujete datume onako kako su zapisani u datoteci; pri ponovnom izračunavanju pomaknut će se 4 zadatka.* Tada se na tim zadacima rezultat aplikacije razlikuje od datuma koje je spremio MS Project. Ispod poruke iz koraka 3 ima i redak: *4 zadatka prikazuju datume onako kako su zapisani u datoteci (nisu ponovno izračunati).* Što to znači i kako prijeđete na izračun same aplikacije, opisano je u [Datumi kako su zapisani](docs://uitleg-datums-zoals-opgeslagen).
5. Ako aplikacija prikazuje *Ova datoteka sadrži planiranje u satima.* s gumbom *Uključi planiranje u satima*, datoteka sadrži podatke u satima. Pogledajte [Uključivanje planiranja u satima](docs://howto-urenplanning-aanzetten).

Ako datoteka sadrži zadatke s prekidom, uravnoteživanjem ili rasporedom vođenim resursima, dodaje se još jedna poruka, na primjer *Ova MS Project datoteka sadrži 3 zadatka s prekinutim, razriješenim ili rasporedom vođenim resursima. Tako se uvoze i prikazuju.* Za jedan zadatak poruka je u jednini.

## Zamke i što aplikacija tada radi

**Ne preuzima se sve.** Aplikacija ne preuzima temeljne planove, troškove i standardne tarife, bilješke i prilagođena polja iz programa MS Project. WBS-kod koji ste sami unijeli u programu MS Project preuzima se; inače aplikacija numerira zadatke prema strukturi.

**Datoteka iz programa MS Project 2007 ili starija.** Aplikacija je odbija i prikazuje: *Ova .mpp datoteka koristi stariji format (Project 2007 ili stariji). Izvezite je u MS Project kao XML (Datoteka → Spremi kao → XML) i otvorite tu datoteku.* Ispod poruke aplikacija dodaje tehnički razlog na engleskom.

**Datoteka s lozinkom.** Aplikacija prikazuje: *Ova .mpp datoteka zaštićena je lozinkom. Izvezite je u MS Project kao XML (Datoteka → Spremi kao → XML) i otvorite tu datoteku.* I ovdje poruka dolazi s tehničkim razlogom na engleskom.

**Datoteka koja se pokaže da nije `.mpp`.** Dobijete *Otvaranje datoteke nije uspjelo* s tehničkim razlogom.

**Otvaranje preko XML-a računa drugačije.** Ako otvorite izvoz programa Microsoft Project u XML umjesto `.mpp`, aplikacija izračunava s profilom izračuna *Open Planner Studio* i ne vidite poruku o profilu *Microsoft Project*. Datumi tada mogu biti drugačiji nego kod `.mpp` datoteke.

**Izmjena ukida upravljanje programa MS Project.** Ako izmijenite zadatak čiji je raspored vodio datumski prozor programa MS Project, aplikacija to prikazuje jednom po projektu: *Datumski prozor iz MS Projecta više ne određuje 2 zadatka nakon ove izmjene; sama raspodjela rada i dalje vrijedi i ostaje spremljena u datoteci.* Za jedan zadatak poruka je u jednini.

**Spremanje nikad ne prepisuje vaš `.mpp`.** Projekt nema datoteku. *Spremi* pita gdje želite spremiti novu IFC datoteku.

## Vidi također

- [Datoteke i formati](docs://uitleg-bestanden): zašto se `.mpp` samo čita i što spremanje zapisuje.
- [Datumi kako su zapisani](docs://uitleg-datums-zoals-opgeslagen): prikaz datuma samog programa MS Project.
- [Uključivanje planiranja u satima](docs://howto-urenplanning-aanzetten): ako datoteka sadrži podatke u satima.
- [Otvaranje Primavera P6 datoteke (.xer)](docs://howto-xer-openen): isto za Primaveru.
- [Formati za uvoz i izvoz](docs://ref-import-exportformaten): za svaki format što se preuzima i što ne.
- [Profili izračuna i pravila izračuna](docs://uitleg-rekenprofielen): zašto se datoteka programa MS Project otvara sa svojim profilom izračuna.
