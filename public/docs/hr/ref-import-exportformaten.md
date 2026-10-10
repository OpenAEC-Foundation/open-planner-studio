# Uvoz i izvoz formata

Po vrsti datoteke: možete li je otvoriti, spremiti i izvesti, što se prenosi, a što ne, i s kojim profilom izračuna se otvara. Zašto je tako, i primjer s brojkama, nalazi se u [Datoteke i formati](docs://uitleg-bestanden).

## Pregled

**Otvaranje** radi s formatima IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` i `.xer`. Aplikacija datoteku s bilo kojom drugom ekstenzijom tretira kao IFC.

**Spremanje** uvijek zapisuje IFC. Samo otvorena IFC datoteka postaje odredište za spremanje. Projekt iz drugog formata nema datoteku nakon otvaranja, a naredba *Spremi* tada pita gdje treba spremiti IFC datoteku.

**Izvoz** radi u IFC 4x3, MS Project XML, Primavera P6 XML, CSV i dvije liste napretka (Excel i CSV). Izvoz ne mijenja vaš projekt.

**Samo za čitanje** su `.mpp` i `.xer`: aplikacija ih može otvoriti, ali ih ne može zapisati.

**PDF** dolazi samo iz izvješća (vidi [Vrste izvješća](docs://ref-rapporttypes)). Aplikacija ne čita PDF.

**Gdje.** Otvaranje: *Početna › Datoteka › Otvori*, *Datoteka › Otvori* ili Ctrl+O. Izvoz: *Početna › Datoteka › Izvezi* ili *Datoteka › Izvezi*. Ispunjeni list napretka uvozite preko *Datoteka › Uvezi* ili gumbom *Ažuriraj napredak iz tablice* u grupi vrpce *Napredak* na karticama *Raspored*, *Tablica* i *Izvješće*.

**Profil izračuna pri otvaranju.** Svaki format se otvara s profilom izračuna. Što je to, piše u [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies). `.xer` se otvara s *Primavera P6*, `.mpp` s *Microsoft Project*, a CSV, MS Project XML i P6 XML s *Open Planner Studio*. IFC zadržava profil koji je zapisan u datoteci. Za `.xer` i `.mpp` aplikacija javlja da projekt tako računa. Samo IFC nosi profil izračuna i opcije izračuna. Od opcija izračuna MS Project XML zapisuje najviše kritični prag. Ponovno otvoren izvoz drugog formata računa se kao *Open Planner Studio*.

## IFC

**Otvaranje** — da, `.ifc`. Aplikacija čita IFC 4.3. Profil izračuna: onaj iz datoteke.

**Spremanje** — da, i to je jedini format koji se može spremiti. *Spremi* zapisuje cijeli vaš projekt kao IFC datoteku. Datoteka postaje odredište za spremanje.

**Izvoz** — da, kao *IFC 4x3* (opisano kao *Standard BuildingSMART. 4D povezivanje s BIM modelima.*). Zadani naziv: naziv projekta s ekstenzijom `.ifc`. Ako je vaš projekt povezan s bibliotekom resursa, potvrdni okvir *Spremi i datoteku biblioteke* nalazi se ispod kartica u *Datoteka › Izvezi*. Ako je označen, aplikacija nakon toga traži mjesto za *projectname-bibliotheek.ifc*. Potvrdni okvir nije na popisu na kartici *Početna*.

**Što se prenosi** — sve što pripada projektu: zadaci sa strukturom, trajanjem, datumima i napretkom; ovisnosti s vremenom odgode; ograničenja i rokovi za dovršetak; kalendari; resursi i dodjele, uključujući raspodjelu po satima; temeljni planovi; šifre zadatka i prilagođena polja; bilješke; vanjske međuzavisnosti projekata; prekidi; pravila rada i vrste zadataka; postavke projekta, kao datum stanja, način praćenja napretka, profil izračuna i opcije izračuna; povezanost s bibliotekom resursa. Za projekt iz `.xer` ide i originalna izvorna datoteka. Prilagođena vrsta zadatka sprema se kao IFC tip `USERDEFINED`, s nazivom u polju ObjectType. Drugi IFC programi zadatak zato čitaju normalno. Aplikacija čuva i stalni id vrste, pa preimenovanje ne prekida vezu. Ako datoteku otvori netko na drugom računalu, vrsta se tamo pojavljuje pod *Iz ovog projekta*, a ne u njegovim *Moje vrste zadataka*.

**Što se ne prenosi** — način na koji ste postavili zaslon (zoom, položaj pomicanja, odabrani zadatak, sažete faze, odabrani filtar i grupiranje) i postavke aplikacije ([Postavke](docs://ref-instellingen)). Kartica *IFC* prikazuje IFC tekst vašeg projekta.

## MS Project XML (MSPDI)

**Otvaranje** — da. Aplikacija prepoznaje `.xml` datoteku kao MS Project XML po korijenskom elementu `Project` u MS Project imenskom prostoru (ili bez imenskog prostora). Profil izračuna: *Open Planner Studio*.

**Spremanje** — ne. Takav projekt nema odredište za spremanje.

**Izvoz** — da, kao *MS Project XML* (*Otvara se u programu Microsoft Project. Potpuna WBS-struktura.*). Zadani naziv: naziv projekta s `.xml`.

**Što se prenosi** — zadaci sa strukturom (razina i WBS), trajanjem, datumima i napretkom; ovisnosti s vremenom odgode, također u satima ili postotcima; ograničenja, uključujući rok za dovršetak; kalendari, uključujući kalendare zadataka i resursa; resursi i dodjele, uključujući krivulju ili raspodjelu po satima; datum stanja; kritični prag, kao cijeli broj radnih dana od 0 ili više, s *Ukupan slobodni hod ≤ prag*; opis zadatka (kao bilješka); pravilo rada zadatka (kao MS Project vrsta zadatka); prilagođena vrsta zadatka, u slobodnom polju (`ExtendedAttribute`) koje aplikacija ponovno čita, a MS Project ga može ignorirati. Od temeljnih planova ide samo aktivni, kao temeljni plan 0. Zadatak u satima zadržava svoju jedinicu, a kontrolna točka svoju vrstu (početak, završetak ili automatski).

**Što se ne prenosi** — bilješke (kontrolna lista na zadatku), vanjske međuzavisnosti projekata, šifre zadatka i prilagođena polja, drugo ograničenje, oznaku *Ručno planiran*, kašnjenje zbog uravnoteživanja, točku nastavka i zaustavljanja zadatka s napretkom izvan redoslijeda, pravila izračuna *Preostali posao nastavlja se nakon proteklog vremena* i *Nezapočeti zadaci se ne pomiču na datum stanja* iz profila MS Project, te ostale opcije izračuna. Zadaci s prekidom bez raspodjele po satima idu bez svojih prekida.

**Što se mijenja usput** — ograničenje *Mora započeti na (MSO)* ili *Mora završiti na (MFO)* bez izbora *Obvezno (logika fiksiranja)* postaje *Ne početi prije (SNET)* ili *Ne završiti prije (FNET)*. Hamak postaje običan zadatak s izračunatim datumima.

## MS Project datoteka (`.mpp`)

**Otvaranje** — da, od MS Project 2010 do 2021. Profil izračuna: *Microsoft Project*. Aplikacija samo čita datoteku: nikad ne mijenja vaš `.mpp`. Datoteku iz MS Project 2007 ili starije, kao i datoteku zaštićenu lozinkom, aplikacija odbija s porukom koja upućuje na XML izvoz programa MS Project.

**Spremanje** — ne, i nema odredišta za spremanje: *Spremi* zapisuje novu IFC datoteku.

**Izvoz** — ne.

**Što se prenosi** — zadaci sa strukturom, trajanjem i ograničenjima; ovisnosti s vremenom odgode; kalendari; resursi i dodjele; napredak; WBS-kod koji ste sami upisali u MS Project. Datume i vremensku rezervu koje je MS Project sam izračunao aplikacija također čita, za prikaz *Datumi kako su zabilježeni*.

**Što se ne prenosi** — temeljni planovi, troškovi i standardne tarife, bilješke i prilagođena polja iz MS Project-a. Vidi [Otvaranje MS Project datoteke (.mpp)](docs://howto-mpp-openen).

**Podrijetlo i licenca** — čitač `.mpp` napisan je za Open Planner Studio i izveden je iz izvornog koda i strukturnog znanja MPXJ-a (`github.com/joniles/mpxj`, Jon Iles i suradnici), Java programske knjižnice pod LGPL-2.1. Strukture i konstante polja prenesene su u TypeScript. Sam Open Planner Studio je otvorenog koda pod LGPL-3.0. Čitač `.xer` nije izvedenica: MPXJ je tamo samo korišten kao izvor za razumijevanje.

## Primavera P6 XML

**Otvaranje** — da. Aplikacija prepoznaje `.xml` datoteku kao P6 XML po korijenskom elementu `APIBusinessObjects`. Profil izračuna: *Open Planner Studio*.

**Spremanje** — ne.

**Izvoz** — da, kao *Primavera P6 XML* (*Za Oracle Primavera P6.*). Zadani naziv: naziv projekta s `.xml`, dakle isti naziv kao izvoz MS Project XML. Dajte im sami različite nazive.

**Što se prenosi** — WBS-struktura i zadaci s trajanjem, datumima i napretkom; ovisnosti s vremenom odgode; ograničenja (također drugo, kao meko ograničenje); kalendari; resursi i dodjele; datum stanja (kao `DataDate`); prilagođena vrsta zadatka, u vlastitom polju `OPS Custom Task Type`, koje aplikacija ponovno čita, a P6 ga može ignorirati.

**Što se ne prenosi** — temeljni planovi i rokovi za dovršetak; šifre zadatka, prilagođena polja, bilješke i vanjske međuzavisnosti projekata; opcije izračuna; iznimka radnog kalendara (iznimka koja dan čini radnim danom). P6 nema vrijeme odgode u postocima: aplikacija ga pretvara u fiksni broj dana. Vrijeme odgode u kalendarskim danima postaje vrijeme odgode u radnom vremenu: 3 kalendarska dana postaju 3 radna dana. Hamak postaje običan zadatak. Zadatak ručno planiran postaje običan zadatak s izračunatim datumima. Kašnjenje zbog uravnoteživanja kraće od jednog dana se odbacuje.

## Primavera datoteka (`.xer`)

**Otvaranje** — da. Profil izračuna: *Primavera P6*. Aplikacija samo čita datoteku: ne zapisuje `.xer` i nikad ne mijenja vašu datoteku. Otvara po jednu karticu za svaki projekt sa zadacima. Datoteku bez zadataka ili s oštećenim tablicama aplikacija odbija s porukom.

**Spremanje** — ne, i nema odredišta za spremanje: *Spremi* zapisuje novu IFC datoteku, s izvornim `.xer` unutra.

**Izvoz** — ne. Ako izvezete projekt iz `.xer` u CSV, MS Project XML ili P6 XML, aplikacija javlja da se izvorni podaci XER-a gube, čak i ako ste projekt između toga spremili kao IFC. U IFC se ništa ne gubi.

**Što se prenosi** — WBS-struktura i zadaci s trajanjem, datumima, ograničenjima i napretkom; ovisnosti s vremenom odgode; kalendari; resursi s dodjelama; šifre zadatka; prilagođena polja (UDF); bilješke; postavke rasporeda P6. Zadatak vrste *Level of Effort* postaje hamak. Temeljni projekt postaje aktivni temeljni plan projekta koji na njega upućuje. Međuzavisnost projekata aplikacija čuva kao izvorni podatak.

**Što se ne prenosi** — projekt bez zadataka i ovisnost između dva projekta kao prava ovisnost u vašem rasporedu. Vidi [Otvaranje Primavera P6 datoteke (.xer)](docs://howto-xer-openen).

## CSV

**Otvaranje** — da. Aplikacija čita `;` i `,` kao separator. Prepoznaje zaglavlja stupaca na engleskom i nizozemskom (na primjer `Name` ili `Naam`, `Duration` ili `Duur`, `Predecessors` ili `Voorgangers`). Datumi mogu biti *gggg-mm-dd*, *dd-mm-gggg* ili *dd/mm/gggg*. Prethodnika zapisujete kao WBS-kod, vrstu ovisnosti i vrijeme odgode, na primjer `1.2FS+2d`. Profil izračuna: *Open Planner Studio*. Projekt se zove *CSV Import*. Vrsta zadatka `Task Type` koja nije nijedna od fiksnih šifara (kao `CONSTRUCTION` ili `INSTALLATION`, koje aplikacija sama zapisuje) postaje prilagođena vrsta zadatka pod *Iz ovog projekta*, a ne u *Moje vrste zadataka*. S `OPS Custom Task Type ID` čuva se id prilagođene vrste.

**Spremanje** — ne.

**Izvoz** — da, kao *CSV (;)* (*Univerzalni izvoz tablice. Svi zadaci s datumima i trajanjem.*), na kartici *CSV (odvojeno točka-zarezom)*. Datoteka koristi točku-zarez kao separator, u UTF-8 s BOM-om i ima engleska zaglavlja stupaca.

**Što se prenosi** — po zadatku ovi stupci: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` i `Description`. Dovršenost je u cijelim postocima.

**Što se ne prenosi** — resursi, dodjele, kalendari, ograničenja, rokovi za dovršetak, temeljni planovi i datum stanja. Ako su datumi u prikazu *Datumi kako su zabilježeni*, izvoz ostavlja `Critical` i `Total Float` prazne za zadatke čija izvorna datoteka to nije zabilježila.

## List napretka (Excel i CSV)

**Otvaranje** — da, preko *Datoteka › Uvezi* (*Ažuriraj napredak iz tablice*) ili gumbom istog naziva u grupi vrpce *Napredak* na karticama *Raspored*, *Tablica* i *Izvješće*. Aplikacija čita `.xlsx` i `.csv`, do 16 MB i 50.000 redaka. Time se ne otvara projekt: ažurira se napredak vašeg otvorenog projekta. Vidi [Uvoz napretka iz tablice](docs://howto-voortgang-importeren).

**Spremanje** — ne.

**Izvoz** — da, kao *List napretka (Excel)* (*Napredak (Excel)* na popisu) i *List napretka (CSV)* (*Napredak (CSV)*). Zadani naziv: *projectname-voortgang*. Gumb *Izvezi tablicu napretka* u istoj grupi izrađuje Excel list jednim klikom. Excel list ima fiksne širine stupaca, zaključana polja i provjeru datuma. CSV list ima isti sadržaj kao običan tekst.

**Što se prenosi** — stupci `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` i `Actual Finish`. Pri čitanju aplikacija koristi `Completion (%)`, `Actual Start` i `Actual Finish`. `Start` i `Finish` služe samo za prepoznavanje zapisa datuma i ne mijenjaju vaš raspored. Aplikacija povezuje retke sa zadacima preko `OPS Task ID`, inače preko jedinstvenog WBS-koda.

**Što se ne prenosi** — sve izvan ovih stupaca: trajanje, ovisnosti, resursi i ostatak vašeg rasporeda. Zadatak sažetka ne dobiva napredak iz lista.

## PDF

**Otvaranje** — ne.

**Spremanje** — ne.

**Izvoz** — da, iz izvješća: na kartici *Izvješće* gumb *Izvezi PDF*. Aplikacija sama ne šalje izvješće na pisač. Put do papira ide preko PDF-a. Sadržaj ovisi o vrsti izvješća: vidi [Vrste izvješća](docs://ref-rapporttypes) i [Izrada i ispis izvješća](docs://howto-rapport-maken-en-afdrukken).

## Vidi također

- [Datoteke i formati](docs://uitleg-bestanden): zašto je IFC vlastiti format i što izvoz gubi, s primjerom.
- [Otvaranje i spremanje datoteke](docs://howto-bestand-openen-en-opslaan): koraci.
- [Izvoz](docs://howto-exporteren): izbor formata i poruke nakon izvoza.
- [Datumi kako su zabilježeni](docs://uitleg-datums-zoals-opgeslagen): zašto otvorena datoteka može prikazivati druge datume.
- [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies): profili izračuna.
