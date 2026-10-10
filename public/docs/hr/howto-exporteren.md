# Izvoz

Cilj: predati vaš raspored kao datoteku u drugom formatu, za nekoga tko ne čita IFC ili za drugi programski paket.

## Kada vam ovo treba

Savjetnik radi u programu MS Project, klijent u Primaveri, podizvođač želi zadatke u Excelu, ili šaljete raspored programu koji ne može obraditi IFC. Izvoz je kopija u drugom formatu. Ako želite zadržati sam projekt, spremite ga: to zapisuje IFC i sve prenosi. Što pojedini format prenosi, a što ne, opisano je u [Datoteke i formati](docs://uitleg-bestanden).

## Koraci

1. Odaberite *Početna › Datoteka › Izvezi* i u popisu odaberite format, ili odaberite *Datoteka › Izvezi*. Tamo je svaki format prikazan kao kartica s kratkim opisom.
2. U prozoru odaberite naziv i mjesto. Aplikacija predlaže naziv projekta, s nastavkom za taj format. Listovi napretka nazivaju se *projectname-voortgang* i otvaraju se u vašoj mapi za preuzimanja, ako je to moguće.
3. Potvrdite. Ako izvoz uspije, ne pojavljuje se nikakva poruka, osim poruka u nastavku. Iz *Datoteka › Izvezi* nakon toga se vraćate na karticu *Početna*, čak i ako odustanete od prozora. Ako odustanete od prozora za izvoz s popisa na kartici *Početna*, ništa se ne događa.

Ako vaš preglednik sprema samo kao preuzimanje (kao Firefox), datoteka je u vašoj mapi za preuzimanja odmah nakon koraka 1. Vidite poruku *Spremljeno kao preuzimanje: 'name.xml' sada je u vašoj mapi za preuzimanja. Ovo okruženje ne dopušta aplikaciji da izravno zapisuje na odabrano mjesto.*

### Koji format odabirete?

Popis na kartici *Početna* i kartice u *Datoteka › Izvezi* nude iste formate:

- *Napredak (Excel)* i *Napredak (CSV)*, na karticama *List napretka (Excel)* i *List napretka (CSV)*: sažet list s ID-om, WBS-om, nazivom, datumima i dovršenošću, koji se šalje onima koji unose napredak.
- *CSV (;)*, na kartici *CSV (odvojeno točka-zarezom)*: popis zadataka koji otvarate u proračunskoj tablici.
- *MS Project XML*: može se otvoriti u programu Microsoft Project.
- *Primavera P6 XML*: za Oracle Primavera P6.
- *IFC 4x3*: vlastiti format aplikacije, sa svim podacima.

### Izvoz IFC-a s datotekom biblioteke

Ako je vaš projekt povezan s bibliotekom resursa, potvrdni okvir *Spremi i datoteku biblioteke* nalazi se ispod kartica u *Datoteka › Izvezi*. Ako ga označite i odaberete *IFC 4x3*, aplikacija dvaput traži mjesto: prvo za projekt, zatim za *projectname-bibliotheek.ifc*. Ovaj potvrdni okvir postoji samo u *Datoteka › Izvezi*, a ne na popisu na kartici *Početna*.

### Vraćanje lista napretka

Ispunjeni list napretka učitavate natrag kroz *Datoteka › Uvezi*. Pogledajte [Uvoz napretka iz proračunske tablice](docs://howto-voortgang-importeren).

## Zamke i što aplikacija tada radi

**Vaš projekt se ne mijenja.** Datoteka vašeg projekta ostaje ista, a oznaka *Nije spremljeno* ostaje ako je bila prisutna.

**Zastarjeli raspored prvo prolazi kroz ponovno izračunavanje.** Zato dobivate aktualne datume, čak i ako ste zaboravili pritisnuti *Izračunaj*.

**Izvoz je također u popisu Nedavno.** To se ne odnosi na listove napretka. Ako tamo otvorite izvoz, otvara se kao uvoz tog formata.

**Izvoz ne prenosi sve.** CSV datoteka nema resursa ni ograničenja, a P6 XML nema temeljnog plana ni roka za dovršetak. Ni profil izračuna se ne prenosi: ponovno otvoren izvoz izračunava se kao *Open Planner Studio*. Samo IFC prenosi sve. Primjer s brojkama pronaći ćete u [Datoteke i formati](docs://uitleg-bestanden).

**Dva formata s istim nastavkom.** MS Project XML i Primavera P6 XML oba dobivaju naziv *projectname.xml*. Sami im dajte različite nazive, inače kasnije nećete znati koja datoteka je koji format.

**Raspored s kružnom ovisnošću se ne izvozi.** Aplikacija prvo izračunava i zaustavlja se ako postoji petlja. Na kartici *Početna* dobivate poruku *Raspored nije bilo moguće izračunati*, a ispod nje, na primjer, *Kružna ovisnost između zadataka: Set up site → Demolish existing extension → Set up site*. U *Datoteka › Izvezi* na stranici je samo taj drugi tekst. Otklonite petlju i izvezite ponovno.

**Projekt iz Primavere gubi podatke o izvoru.** Ako takav projekt izvezete u CSV, MS Project XML ili P6 XML, aplikacija prijavljuje: *Izvoz u CSV gubi informacije o izvoru XER-a.* Za MS Project XML piše *MSPDI*, a za P6 XML *P6*. Pogledajte [Otvaranje Primavera P6 datoteke (.xer)](docs://howto-xer-openen).

**Podijeljeni zadaci gube svoje podjele.** MS Project i Primavera poznaju podjelu samo kao raspodjelu sati. Ako u vašem projektu ima podijeljenih zadataka bez raspodjele sati, aplikacija nakon izvoza u MS Project XML ili P6 XML prijavljuje: *2 zadatka s prekidima izvezena su bez prekida: MS Project i P6 poznaju prekide samo kao raspodjelu rada.* Za jedan zadatak poruka glasi *1 zadatak s prekidima izvezen je bez prekida: MS Project i P6 poznaju prekide samo kao raspodjelu rada.* Pogledajte [Podjela zadatka](docs://howto-taak-splitsen).

**Raspored u prikazu *Datumi kako su zabilježeni*.** Ako izvozite u CSV dok u prikazu vidite datume iz izvorne datoteke, aplikacija za zadatke za koje izvorna datoteka to nije zabilježila ostavlja prazna polja `Critical` i `Total Float`. Pogledajte [Datumi kako su zabilježeni](docs://uitleg-datums-zoals-opgeslagen).

## Vidi također

- [Datoteke i formati](docs://uitleg-bestanden): što svaki format prenosi, a što ne.
- [Otvaranje i spremanje datoteke](docs://howto-bestand-openen-en-opslaan): čuvanje samog projekta kao IFC.
- [Uvoz napretka iz proračunske tablice](docs://howto-voortgang-importeren): učitavanje ispunjenog lista napretka.
- [Formati za uvoz i izvoz](docs://ref-import-exportformaten): za svaki format što se prenosi, a što ne.
