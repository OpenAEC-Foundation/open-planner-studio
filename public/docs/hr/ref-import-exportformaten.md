# Uvoz i izvoz formata

Po vrsti datoteke: možete li je otvoriti, spremiti i izvesti, što se prenosi, a što ne, i s kojim profilom izračuna se otvara. Zašto je tako, i primjer s brojkama, nalazi se u [Datoteke i formati](docs://uitleg-bestanden).

## Pregled

**Otvaranje** radi s formatima IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` i `.xer`. Aplikacija datoteku s bilo kojom drugom ekstenzijom tretira kao IFC.

**Spremanje** uvijek zapisuje IFC. Samo otvorena IFC datoteka postaje odredište za spremanje. Projekt iz drugog formata nema datoteku nakon otvaranja, a naredba *Spremi* tada pita gdje treba spremiti IFC datoteku.

**Izvoz** radi u IFC, MS Project XML, Primavera P6 XML, CSV i dvije liste napretka (Excel i CSV). Izvoz ne mijenja vaš projekt.

**Samo za čitanje** su `.mpp` i `.xer`: aplikacija ih može otvoriti, ali ih ne može zapisati.

**PDF** dolazi samo iz izvješća (vidi [Vrste izvješća](docs://ref-rapporttypes)). Aplikacija ne čita PDF.

**Gdje.** Otvaranje: *Početna › Datoteka › Otvori*, *Datoteka › Otvori* ili Ctrl+O. Izvoz: *Početna › Datoteka › Izvezi* ili *Datoteka › Izvezi*. Ispunjeni list napretka uvozite preko *Datoteka › Uvezi* ili gumbom *Ažuriraj napredak iz tablice* u grupi vrpce *Napredak* na karticama *Raspored*, *Tablica* i *Izvješće*.

**Profil izračuna pri otvaranju.** Svaki format se otvara s profilom izračuna. Što je to, piše u [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies). `.xer` se otvara s *Primavera P6*, `.mpp` s *Microsoft Project*, a CSV, MS Project XML i P6 XML s *Open Planner Studio*. IFC zadržava profil koji je zapisan u datoteci. Za `.xer` i `.mpp` aplikacija javlja da projekt tako računa. Samo IFC nosi profil izračuna i opcije izračuna. Od opcija izračuna MS Project XML zapisuje najviše kritični prag. Ponovno otvoren izvoz drugog formata računa se kao *Open Planner Studio*.

## IFC

**Otvaranje** — da, `.ifc`. Aplikacija čita IFC4 i IFC 4.3 (također ADD2). Datoteka u drugoj shemi, na primjer IFC2X3, također se otvara. Pri prvom spremanju zatim birate shemu koju aplikacija može zapisati (vidi [Odabir IFC sheme](docs://howto-ifc-schema-kiezen)). Profil izračuna: onaj iz datoteke.

**Spremanje** — da, i to je jedini format koji se može spremiti. *Spremi* zapisuje cijeli vaš projekt kao IFC datoteku, u IFC shemi projekta (standardno IFC 4.3 ADD2). Datoteka postaje odredište za spremanje.

**Izvoz** — da, kao *IFC*, u IFC shemi projekta (standardno IFC 4.3 ADD2). Zadani naziv: naziv projekta s `.ifc`. Ako je vaš projekt povezan s bibliotekom resursa, potvrdni okvir *Spremi i datoteku biblioteke* nalazi se ispod kartica u *Datoteka › Izvezi*. Ako je označen, aplikacija nakon toga traži mjesto za *projectname-bibliotheek.ifc*. Potvrdni okvir nije na popisu na kartici *Početna*.

**Što se prenosi** — sve što pripada projektu: zadaci sa strukturom, trajanjem, datumima i napretkom; ovisnosti s vremenom odgode; ograničenja i rokovi za dovršetak; kalendari; resursi i dodjele, uključujući raspodjelu po satima; temeljni planovi; šifre zadatka i prilagođena polja; bilješke; vanjske međuzavisnosti projekata; prekidi; vrste zadataka i prilagođene kategorije radova; postavke projekta, kao datum stanja, način praćenja napretka, profil izračuna i opcije izračuna; povezanost s bibliotekom resursa. Za projekt iz `.xer` ide i originalna izvorna datoteka. Prilagođena kategorija radova sprema se kao IFC tip `USERDEFINED`, s nazivom u polju ObjectType. Drugi IFC programi zadatak zato čitaju normalno. Aplikacija čuva i stalni ID kategorije, pa preimenovanje ne prekida vezu. Ako datoteku otvori netko na drugom računalu, kategorija se tamo pojavljuje pod *Iz ovog projekta*, a ne u njegovim *Moje kategorije radova*.

**Što se ne prenosi** — način na koji ste postavili zaslon (zoom, položaj pomicanja, odabrani zadatak, sažete faze, odabrani filtar i grupiranje) i postavke aplikacije ([Postavke aplikacije](docs://ref-instellingen)). Kartica *IFC* je uređivač s IFC tekstom vašeg projekta. *Generiraj IFC* ga osvježava, *Kopiraj* stavlja na međuspremnik, a *Primijeni* učitava tekst kao vaš projekt i zamjenjuje projekt na toj kartici.

## MS Project XML (MSPDI)

**Otvaranje** — da. Aplikacija prepoznaje `.xml` datoteku kao MS Project XML po korijenskom elementu `Project` u MS Project imenskom prostoru (ili bez imenskog prostora). Profil izračuna: *Open Planner Studio*. Nakon otvaranja aplikacija vas jednom porukom obavijesti što nije preuzela; vidi [Otvaranje MS Project datoteke (.mpp)](docs://howto-mpp-openen).

**Spremanje** — ne. Takav projekt nema odredište za spremanje.

**Izvoz** — da, kao *MS Project XML* (*Otvara se u programu Microsoft Project. Potpuna WBS-struktura.*). Zadani naziv: naziv projekta s `.xml`.

**Što se prenosi** — zadaci sa strukturom (razina i WBS), trajanjem, datumima i napretkom; ovisnosti s vremenom odgode, također u satima ili postotcima; ograničenja, uključujući rok za dovršetak; kalendari, uključujući kalendare zadataka i resursa; resursi i dodjele, uključujući krivulju ili raspodjelu po satima; datum stanja; kritični prag, kao cijeli broj radnih dana od 0 ili više, s *Ukupan slobodni hod ≤ prag*; opis zadatka (kao bilješka); vrsta zadatka (kao vrsta zadatka u MS Projectu); prilagođena kategorija radova, u slobodnom polju (`ExtendedAttribute`) koje aplikacija ponovno čita, a MS Project ga može ignorirati. Od temeljnih planova ide samo aktivni, kao temeljni plan 0. Zadatak u satima zadržava svoju jedinicu, a kontrolna točka svoju vrstu (početak, završetak ili automatski).

**Što se ne prenosi** — bilješke (kontrolna lista na zadatku), vanjske međuzavisnosti projekata, šifre zadatka i prilagođena polja, drugo ograničenje, oznaku *Ručno planiran*, kašnjenje zbog uravnoteživanja, točku nastavka i zaustavljanja zadatka s napretkom izvan redoslijeda, pravila izračuna *Preostali posao nastavlja se nakon proteklog vremena* i *Nezapočeti zadaci se ne pomiču na datum stanja* iz profila MS Project, te ostale opcije izračuna. Zadaci s prekidom bez raspodjele po satima idu bez svojih prekida.

**Praznici pri otvaranju.** Izvedeni kalendar nasljeđuje izuzetke svog osnovnog kalendara. Kalendar s vlastitim radnim tjednom i bez izuzetaka nema praznike. Samo kalendar bez osnovnog kalendara, radnog tjedna i izuzetaka zadržava standardne nizozemske praznike. Ako praznici nedostaju, vaš datum završetka može biti drugačiji; vidi [Generiranje praznika i kolektivnog godišnjeg odmora u građevinarstvu](docs://howto-feestdagen-genereren).

**Što se mijenja usput** — ograničenje *Mora započeti na (MSO)* ili *Mora završiti na (MFO)* bez izbora *Obvezno (logika fiksiranja)* postaje *Ne početi prije (SNET)* ili *Ne završiti prije (FNET)*. Hamak postaje običan zadatak s izračunatim datumima. MS Project XML čuva sate po danu samo za projektni kalendar. Drugi kalendar sa svojim satima po danu dobije svoje radno vrijeme kao sate po danu kad otvorite datoteku: 8 sati po danu s radnim vremenom od 10 sati postaje 10. Zadatak u danima na takvom kalendaru tada postaje kraći, na primjer 4 dana umjesto 5.

## MS Project datoteka (`.mpp`)

**Otvaranje** — da, od MS Project 2010 do 2021. Profil izračuna: *Microsoft Project*. Aplikacija samo čita datoteku: nikad ne mijenja vaš `.mpp`. Datoteku iz MS Project 2007 ili starije, kao i datoteku zaštićenu lozinkom, aplikacija odbija s porukom koja upućuje na XML izvoz programa MS Project. Nakon otvaranja aplikacija vas jednom porukom obavijesti što nije preuzela.

**Spremanje** — ne, i nema odredišta za spremanje: *Spremi* zapisuje novu IFC datoteku.

**Izvoz** — ne.

**Što se prenosi** — zadaci sa strukturom, trajanjem i ograničenjima; ovisnosti s vremenom odgode; kalendari; resursi i dodjele; napredak; WBS-kod koji ste sami upisali u MS Project. Datume i vremensku rezervu koje je MS Project sam izračunao aplikacija također čita, za prikaz *Datumi kako su zabilježeni*.

**Što se ne prenosi** — temeljni planovi, troškovi i standardne tarife, bilješke, hiperveze, prilagođena polja iz MS Project-a, povezanost podprojekata i vanjskih zadataka te kritični prag. Vidi [Otvaranje MS Project datoteke (.mpp)](docs://howto-mpp-openen).

**Podrijetlo i licenca** — čitač `.mpp` napisan je za Open Planner Studio i izveden je iz izvornog koda i strukturnog znanja MPXJ-a (`github.com/joniles/mpxj`, Jon Iles i suradnici), Java biblioteka pod LGPL-2.1. Strukture i konstante polja prenesene su u TypeScript. Sam Open Planner Studio je otvorenog koda pod LGPL-3.0. Čitač `.xer` nije izvedenica: MPXJ je tamo samo korišten kao izvor za razumijevanje.

## Primavera P6 XML

**Otvaranje** — da. Aplikacija prepoznaje `.xml` datoteku kao P6 XML po korijenskom elementu `APIBusinessObjects`. Profil izračuna: *Open Planner Studio*.

**Više projekata u jednoj datoteci.** Svaki projekt sa zadacima otvara se u vlastitoj kartici, s nazivom *Naziv projekta (ID projekta)*. Aplikacija preskače projekt bez zadataka. Aktivna kartica je projekt s najviše zadataka. Aplikacija ne preuzima ovisnost prema drugom projektu, niti zadatak koji ne pripada nijednom projektu. Nakon otvaranja aplikacija javlja koliko je projekata otvorila.

**Praznici pri otvaranju.** Vrijede ista pravila kao za MS Project XML: kalendar s vlastitim radnim tjednom i bez izuzetaka nema praznike.

**Temeljni planovi.** `<BaselineProject>` u datoteci postaje temeljni plan svog projekta. Temeljni plan koji P6 označi kao aktivan ostaje aktivan i u aplikaciji.

**Stopa dodjele.** Ako još preostaje rad, preostala stopa (`RemainingUnitsPerTime`) postaje *Jed./dan*. Inače je to planirana stopa (`PlannedUnitsPerTime`). Za materijal planirana stopa ostaje. Aplikacija pri otvaranju datoteke ništa ponovno ne izračunava. Pri izvozu u P6 XML zapisuje planiranu stopu kao `PlannedUnitsPerTime`. Preostalu stopu zapisuje kao `RemainingUnitsPerTime` samo kad dodjela ima zasebnu planiranu stopu.

**Nema čitljivih zadataka.** Ako aplikacija ne nađe nijedan zadatak koji može pročitati, ne otvara karticu. Javlja to i navodi razlog kad je poznat. Primjeri: zadaci bez `ObjectId`, ili nazivi XER stupaca u XML datoteci. Tada projekt iz P6 ponovno izvezite kao P6 XML, ili ga otvorite kao `.xer`.

**Spremanje** — ne.

**Izvoz** — da, kao *Primavera P6 XML* (*Za Oracle Primavera P6.*). Zadani naziv: naziv projekta s `.xml`, s ID-jem projekta u zagradi ako projekt ima ID. Izvoz MS Project XML dobije isti naziv: dajte im sami različite nazive.

**Naziv projekta i ID projekta.** Aplikacija čuva ID projekta iz P6 odvojeno od naziva projekta, kao kod `.xer`. *Postavke projekta* prikazuju samo naziv, na primjer *Bid for Facility Extension*. Kartica prikazuje *Bid for Facility Extension (OZB-05)*. Ako projekt preimenujete u *Hall extension*, kartica se zove *Hall extension (OZB-05)*. Izvoz u P6 XML zapisuje *OZB-05* natrag kao ID projekta, a *Hall extension* kao naziv. Tako P6 prepoznaje projekt. Projekt iz `.xer` također ponese svoj ID projekta. ID projekta ostaje kad projekt spremite kao IFC. Zagrade u samom nazivu, kao *New build (phase 2)*, ostaju u nazivu. Projekt bez ID-a projekta dobije pri izvozu vlastiti jedinstveni ID od aplikacije, koji počinje s *OPS:*.

**Što se prenosi** — WBS-struktura i zadaci s trajanjem, datumima i napretkom; ovisnosti s vremenom odgode; ograničenja (također drugo, kao meko ograničenje); kalendari; resursi i dodjele; datum stanja (kao `DataDate`); prilagođena kategorija radova, u vlastitom polju `OPS Custom Task Type`, koje aplikacija ponovno čita, a P6 ga može ignorirati.

**Što se ne prenosi** — temeljni planovi i rokovi za dovršetak; šifre zadatka, prilagođena polja, bilješke i vanjske međuzavisnosti projekata; opcije izračuna; nazivi praznika. P6 nema naziv za svaki neradni dan: nakon ponovnog otvaranja praznik se zove *Praznik*, a radni izuzetak *Radni izuzetak*. Uzastopni neradni dani vraćaju se kao jedan raspon. Aplikacija skraćuje naziv ili šifru koji su duži nego što P6 dopušta: naziv zadatka na 120 znakova, ID zadatka ili WBS-kod na 40, a naziv WBS-a ili projekta na 100. Javlja koliko je naziva i šifri skratila. P6 nema vrijeme odgode u postocima: aplikacija ga pretvara u fiksni broj dana. Vrijeme odgode u kalendarskim danima postaje vrijeme odgode u radnom vremenu: 3 kalendarska dana postaju 3 radna dana. Hamak postaje običan zadatak, ručno planiran zadatak postaje običan zadatak s izračunatim datumima, a kašnjenje zbog uravnoteživanja kraće od jednog dana se odbacuje.

## Primavera datoteka (`.xer`)

**Otvaranje** — da. Profil izračuna: *Primavera P6*. Aplikacija samo čita datoteku: ne zapisuje `.xer` i nikad ne mijenja vašu datoteku. Otvara po jednu karticu za svaki projekt sa zadacima. Datoteku bez zadataka ili s oštećenim tablicama aplikacija odbija s porukom.

**Spremanje** — ne, i nema odredišta za spremanje: *Spremi* zapisuje novu IFC datoteku, s izvornim `.xer` unutra.

**Izvoz** — ne. Ako izvezete projekt iz `.xer` u CSV, MS Project XML ili P6 XML, aplikacija javlja da se izvorni podaci XER-a gube, čak i ako ste projekt u međuvremenu spremili kao IFC. U IFC se ništa ne gubi.

**Što se prenosi** — WBS-struktura i zadaci s trajanjem, datumima, ograničenjima i napretkom; ovisnosti s vremenom odgode; kalendari; resursi s dodjelama; šifre zadatka; prilagođena polja (UDF); bilješke; postavke rasporeda P6. Zadatak vrste *Level of Effort* postaje hamak. Temeljni projekt postaje aktivni temeljni plan projekta koji na njega upućuje. Ovisnost između dva projekta aplikacija čuva kao izvorni podatak.

**Brzina dodjele.** Ako preostaje posao, preostala brzina (`remain_qty_per_hr`) postaje *Jed./dan*. Inače je to planirana brzina (`target_qty_per_hr`). Planirani rad, stvarni rad i preostali posao ostaju kao u datoteci. Za materijal planirana brzina ostaje.

**Slobodna subota ili nedjelja koja nije u datoteci.** Neki P6 izvozi pomiču slobodan dan vikenda unutar niza od nekoliko slobodnih dana na petak koji mu prethodi ili na ponedjeljak koji slijedi. Ako kalendar radi subotom ili nedjeljom, taj bi dan pogrešno postao radni dan. Ako aplikacija prepozna takav obrazac u nizu od najmanje tri slobodna dana, taj dan vikenda ipak čini slobodnim. U kalendaru se taj dan zove *Iznimka kalendara (rekonstrukcija vikenda)*, i ubraja se u redak *N nalaza kalendara.* poruke. Kod kalendara koji ne radi vikendom ništa se ne mijenja.

**Vremenska rezerva do datuma završetka projekta, bez datuma završetka.** Je li opcija P6 uključena za izračun vremenske rezerve do datuma završetka projekta, ali datoteka nema datum završetka za projekt i nema planirani datum završetka ni za jedan zadatak? Tada aplikacija isključuje opciju *Izračunati vremensku rezervu do datuma završetka projekta*. Zatim kasne datume računa unatrag od najkasnijeg najranijeg završetka. To se ubraja u redak *N postavki rasporeda P6 upotrijebilo je sigurno zamjensko rješenje.*

**Dovršeni zadaci na datumu stanja.** Neke datoteke ne bilježe stvarne datume dovršenog zadatka, nego prozor na datumu stanja. U prikazu *Datumi kako su zabilježeni* takav je zadatak tada uska traka na datumu stanja. Ako ga ponovno izračunavanje premjesti na drugo mjesto, ubraja se u broj zadataka koje daje traka. Pravilo izračuna *Dovršeni zadatak u prozoru datuma stanja* izračunava takav prozor, i samo uz to pravilo dovršeni zadatak dobiva stvarnu vremensku rezervu preko opcije izračuna *Dovršeni zadatak: kasni datumi od datuma stanja*. Ovo pravilo je aproksimacija: aplikacija je to ponašanje vidjela samo u izlazu P3, a Primavera to nigdje ne potvrđuje. Zato je isključeno u svakom ugrađenom profilu izračuna, pa i pod *Primavera P6*. Uključujete ga u odjeljku *Profil izračuna i opcije izračuna*; projekt tada dobiva prilagođeni profil izračuna. Vidi [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies).

**Brojevi s decimalnim zarezom.** P6 bilježi decimalni separator i separator tisuća u tablici `CURRTYPE`. Aplikacija čita te znakove prije nego što pretvori trajanja, rad i vremensku rezervu. Ako taj podatak nedostaje, aplikacija kao decimalni separator koristi točku. Ako datoteka i dalje sadrži brojeve s decimalnim zarezom, aplikacija ne otvara ništa. Tako se raspored s pogrešno pročitanim brojevima nikad ne otvara.

**Što se ne prenosi** — projekt bez zadataka i ovisnost između dva projekta kao prava ovisnost u vašem rasporedu. Vidi [Otvaranje Primavera P6 datoteke (.xer)](docs://howto-xer-openen).

## CSV

**Otvaranje** — da. Aplikacija čita `;` i `,` kao separator. Prepoznaje zaglavlja stupaca na engleskom i nizozemskom (na primjer `Name` ili `Naam`, `Duration` ili `Duur`, `Predecessors` ili `Voorgangers`). Datumi mogu biti *gggg-mm-dd*, *dd-mm-gggg* ili *dd/mm/gggg*. Prethodnika upisujete kao WBS-kod, vrstu ovisnosti i vrijeme odgode, na primjer `1.2FS+2d`. Profil izračuna: *Open Planner Studio*. Projekt se zove *CSV Import*. Stupac `Task Type` sadrži kategoriju radova, a ne vrstu zadatka; aplikacija čita i zaglavlja `Werksoort` i `Work category`. Vrijednost `Task Type` koja nije nijedna od fiksnih šifara (kao `CONSTRUCTION` ili `INSTALLATION`, koje aplikacija sama zapisuje) postaje prilagođena kategorija radova pod *Iz ovog projekta*, a ne pod *Moje kategorije radova*. S `OPS Custom Task Type ID` čuva se id prilagođene kategorije radova.

**Spremanje** — ne.

**Izvoz** — da, kao *CSV (;)* (*Univerzalni izvoz tablice. Svi zadaci s datumima i trajanjem.*), na kartici *CSV (odvojeno točka-zarezom)*. Datoteka kao separator koristi točku-zarez, u UTF-8 s BOM-om i ima engleska zaglavlja stupaca.

**Što se prenosi** — po zadatku ovi stupci: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` i `Description`. Stupac `Task Type` sadrži kategoriju radova. Dovršenost je u cijelim postocima. Vrijeme odgode u satima dobiva oznaku sata jezika aplikacije: `1.2FS+2h` na engleskom, `1.2FS+2u` na nizozemskom. Otvaranje čita oba oblika.

**Što se ne prenosi** — resursi, dodjele, kalendari, ograničenja, rokovi za dovršetak, temeljni planovi i datum stanja. Ako su datumi u prikazu *Datumi kako su zabilježeni*, izvoz ostavlja prazne vrijednosti u stupcima `Critical` i `Total Float` za zadatke čija izvorna datoteka to nije zabilježila.

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
