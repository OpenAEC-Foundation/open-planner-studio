# Otvaranje i spremanje datoteke

Cilj: otvoriti projekt iz datoteke i zadržati promjene.

## Kada vam ovo treba

Dan počinjete s projektom od jučer, dobijete datoteku od kolege ili iz drugog paketa, ili želite spremiti međustanje prije nego što nešto veliko promijenite. Što aplikacija sprema u datoteku i zašto samo IFC čuva cijeli vaš projekt, objašnjeno je u [Datoteke i formati](docs://uitleg-bestanden).

## Koraci

### Otvaranje datoteke

1. Odaberite *Početna › Datoteka › Otvori*, ili *Datoteka › Otvori*, ili pritisnite Ctrl+O (⌘+O na Macu). Grupa *Datoteka* je također na kartici *Tablica*.
2. Odaberite datoteku. Istodobno otvarate samo jednu datoteku. U desktop aplikaciji i u preglednicima s pristupom datotekama, kao što su Chrome i Edge, prozor prikazuje popis vrsta datoteka: *Sve podržane*, *IFC datoteke*, *CSV datoteke*, *XML datoteke*, *MS Project datoteke* i *Primavera XER datoteke*.
3. Projekt se otvara na novoj kartici. Ako je trenutna kartica još prazna i nepromijenjena, projekt se otvara na njoj.
4. Ako datoteka nije IFC, prikazuje se prozor s kratkim objašnjenjem tog formata. Zeleni okvir kaže što je aplikacija preuzela, jantarni okvir što nije uključeno ili je uključeno samo djelomično, a plavi okvir kako funkcionira spremanje i zapisivanje natrag. *Pročitaj više* otvara vodič za taj format. Kliknite *Razumijem* da zatvorite prozor. Ako više ne želite vidjeti to objašnjenje za taj format, prvo označite *Ne prikazuj ponovno za …*. Ponovno ga uključujete u [Postavke aplikacije](docs://ref-instellingen), na kartici *Napredno*.

Naziv IFC datoteke postaje naziv kartice. Projekt iz drugog formata dobiva naziv projekta.

Aplikacija otvara `.ifc`, `.csv`, `.xml` (MS Project XML ili Primavera P6 XML), `.mpp` i `.xer`. Za posljednje dvije vrste postoje zasebni koraci u [Otvaranje MS Project datoteke (.mpp)](docs://howto-mpp-openen) i [Otvaranje Primavera P6 datoteke (.xer)](docs://howto-xer-openen).

### Otvaranje nedavnog projekta

Odaberite *Početna › Datoteka › Nedavno* i kliknite datoteku na popisu, ili odaberite *Datoteka › Nedavno*. Popis čuva posljednjih deset datoteka koje ste otvorili, spremili ili izvezli. I ovdje, ako datoteka nije IFC, slijedi objašnjenje njezina formata. Desktop aplikacija prikazuje putanju za svaku datoteku, preglednik samo naziv.

Ako aplikacija više ne može pročitati datoteku s popisa, na primjer zato što ste je premjestili, datoteka nestane s popisa bez poruke. U preglednicima bez pristupa datotekama, kao što je Firefox, *Nedavno* ostaje prazno.

### Otvaranje primjera

Odaberite *Datoteka › Primjeri* i kliknite primjer projekta. Otvara se na kartici, bez datoteke: *Spremi* zato pita gdje ga želite spremiti.

### Spremanje

Odaberite *Početna › Datoteka › Spremi* ili *Datoteka › Spremi*, ili pritisnite Ctrl+S. Što se tada događa, ovisi o vašem projektu:

1. Ako projekt već ima datoteku, jer ste otvorili IFC datoteku ili ste je ranije spremili, aplikacija piše u tu datoteku. Ne pojavljuje se prozor, osim pri prvom spremanju datoteke s IFC shemom koja nije IFC 4.3 ADD2. Tada aplikacija najprije pita *U kojoj IFC shemi želite spremiti?* Pogledajte [Odabir IFC sheme](docs://howto-ifc-schema-kiezen).
2. Ako projekt još nema datoteku, aplikacija pita gdje da je spremi. Predlaže naziv projekta s `.ifc`. Nakon toga ta datoteka postaje datoteka projekta.
3. Ako vaš preglednik sprema samo preko preuzimanja (kao Firefox), datoteka završi u mapi za preuzimanja, a svako spremanje stvara novo preuzimanje. Prvi put u sesiji vidite poruku *Spremljeno kao preuzimanje: „name.ifc“ je u mapi za preuzimanja. Ovaj preglednik ne dopušta aplikaciji da zapisuje na vlastito mjesto, pa svako spremanje stvara novo preuzimanje. U Chromeu, Edgeu ili desktop aplikaciji Spremi jednostavno ažurira istu datoteku.*
4. Ako vaš preglednik ne može zapisati natrag u datoteku projekta, aplikacija svaki put pri spremanju ponovno pita gdje želite smjestiti datoteku. To izgleda kao *Spremi kao*, ali je to ograničenje preglednika. Prvi put u sesiji poruka *Ovaj preglednik ne dopušta aplikaciji da zapisuje natrag u „name.ifc“.* to objašnjava, uz poveznicu na [Datoteke](docs://uitleg-bestanden).

Nakon spremanja nestaje oznaka *Nije spremljeno*: točka na kartici, zvjezdica ispred naziva projekta na vrhu i tekst *Nije spremljeno* dolje desno u traci stanja.

### Spremanje pod drugim nazivom

Odaberite *Početna › Datoteka › Spremi kao* ili *Datoteka › Spremi kao*, ili pritisnite Ctrl+Shift+S. Odaberite naziv i mjesto (u Firefoxu aplikacija umjesto toga preuzima novu datoteku). Nakon toga projekt radi s tom novom datotekom: sljedeće *Spremi* piše tamo. Stara datoteka ostaje onakva kakva je bila pri zadnjem spremanju.

### Zatvaranje projekta

Kliknite križić na kartici ili odaberite *Datoteka › Zatvori projekt*. Ako projekt ima promjene koje niste spremili, aplikacija pita: *Promjene nisu spremljene: „name“ ima promjene koje još nisu spremljene.* Odaberite *Odustani* (projekt ostaje otvoren), *Ne spremaj* (projekt se zatvara i vaše promjene nestaju) ili *Spremi* (aplikacija prvo sprema, zatim zatvara). Ako na desktopu zatvorite cijelu aplikaciju (gumbom za zatvaranje, s Alt+F4 ili izbornikom vašeg operacijskog sustava), aplikacija to pita za svaki projekt s promjenama. Odabir *Odustani* ili neuspjelo spremanje zaustavlja zatvaranje. Nakon takvog normalnog zatvaranja aplikacija briše sigurnosne kopije za oporavak te sesije, pa se prozor za oporavak prikazuje samo nakon pravog rušenja. Ako projekt ima promjene, a zatvorite karticu ili prozor preglednika, preglednik traži potvrdu.

## Zamke i što aplikacija tada radi

**Otvorena IFC datoteka odmah postaje datoteka vašeg projekta.** *Spremi* prepisuje tu datoteku, čak i ako dolazi iz drugog programa. Ako želite zadržati original, prvo odaberite *Spremi kao*.

**Ostali formati se nikada ne prepisuju.** Projekt iz `.csv`, `.xml`, `.mpp` ili `.xer` nakon otvaranja nema datoteku. *Spremi* sprema novu IFC datoteku i ostavlja original netaknut.

**U Firefoxu svako spremanje stvara novu datoteku.** Aplikacija tamo ne može pisati u vašu datoteku. Svaki put preuzima novu datoteku, s nazivom projekta kao nazivom datoteke, a ne s nazivom datoteke koju ste otvorili.

**Chrome i Edge traže dopuštenje.** Pri prvom *Spremi* datoteke koju ste otvorili, preglednik pita smije li aplikacija u nju pisati. Ako odbijete, aplikacija otvara prozor u kojem odaberete novu datoteku. U Chromeu i Edgeu dobijete taj prozor također ako pisanje u postojeću datoteku ne uspije, na primjer zato što je datoteka nestala ili je zaključana.

**Poruka o dvostrukim identifikatorima ili ovisnostima koje se ne računaju.** Nakon otvaranja poruka može ostati na zaslonu. Ako piše *Objekti s dvostrukim identifikatorom u ovoj datoteci*, svaki duplicirani objekt dobio je vlastiti identifikator, a reference upućuju na prvo pojavljivanje. Tada provjerite ovisnosti i dodjele. Ako piše *ovisnost(i) nije mogla biti uključena u izračun*, ovisnost se nalazila na zadatku sažetka i nema učinka, na primjer zadatak povezan s vlastitim zadatkom sažetka. Sama datoteka ostaje nepromijenjena. Pogledajte [Ovisnosti](docs://uitleg-relaties) za to što ovisnost na zadatku sažetka čini.

**Spremanje može ne uspjeti.** Ako sama operacija spremanja javi grešku, aplikacija prikazuje *Spremanje nije uspjelo*, s razlogom. Vaš projekt ostaje otvoren i još je označen kao *Nije spremljeno*.

## Pogledajte također

- [Datoteke i formati](docs://uitleg-bestanden): što je u IFC datoteci i kako aplikacija postupa s formatima.
- [Uključivanje automatskog spremanja](docs://howto-automatisch-opslaan): da aplikacija sama ažurira vašu datoteku.
- [Odabir IFC sheme](docs://howto-ifc-schema-kiezen): što znači pitanje *U kojoj IFC shemi želite spremiti?*
- [Izvoz](docs://howto-exporteren): izrada kopije u drugom formatu.
- [Oporavak nakon rušenja](docs://howto-herstellen-na-een-crash): što učinite ako se aplikacija nije ispravno zatvorila.
- [Formati za uvoz i izvoz](docs://ref-import-exportformaten): za svaki format što se prenosi i što ne.
