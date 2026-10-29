# Odabir ili izrada profila izračuna

Cilj: odlučiti koja pravila izračuna projekt koristi. Birate ugrađeni profil ili izrađujete prilagođeni profil sa svojim pravilima izračuna.

## Kada vam ovo treba

Otvarate projekt koji se mora izračunavati kao Primavera P6 ili Microsoft Project, ili želite jedno pravilo postaviti drugačije od onoga što profil radi. Što je profil i zašto se datumi mogu pomaknuti opisano je u [Profili izračuna i pravila izračuna](docs://uitleg-rekenprofielen).

## Koraci

### Odabir profila za novi projekt

1. Odaberite *Početna › Datoteka › Novo*. Otvara se prozor *Novi projekt*.
2. U padajućem popisu *Profil izračuna* odaberite profil: *Open Planner Studio*, *Primavera P6* ili *Microsoft Project*.
3. Stvorite projekt. Aplikacija zamjenjuje opcije izračuna koje ste već unijeli zadanim vrijednostima profila.

### Promjena profila postojećeg projekta

1. Odaberite *Postavke › Projekt › Postavke projekta*. Možete također odabrati *Datoteka › Postavke projekta*.
2. U bloku *Profil izračuna i opcije izračuna* otvorite padajući popis *Profil izračuna* i odaberite drugi profil.
3. Kliknite **Primijeni**. Aplikacija odmah ponovno izračunava raspored, čak i ako je *Automatsko izračunavanje* isključeno. Ako su se zadaci pomaknuli, aplikacija kaže koliko ih je.

Dok ne kliknete *Primijeni*, promjena postoji samo u obrascu. Cijelu promjenu poništavate jednim korakom naredbom *Poništi*. Promjena profila mijenja samo pravila izračuna. Vaše opcije izračuna ostaju iste.

### Izrada prilagođenog profila

1. U bloku *Profil izračuna i opcije izračuna* kliknite *Novi profil* pored padajućeg popisa.
2. Upišite naziv. Aplikacija predlaže *Kopija od* odabranog profila, na primjer *Kopija od Open Planner Studio*.
3. Kliknite *Stvori*. Dio *Pravila izračuna ovog profila* se proširuje.
4. Uključite ili isključite pravila potvrdnim okvirima. Ikona „i“ iza retka prikazuje objašnjenje tog pravila. Pravilo koje se razlikuje od osnovnog dobiva oznaku *Vrati na osnovno*.
5. Kliknite **Primijeni**. Tek tada projekt računa s novim profilom.

Tri ugrađena profila ne mogu se mijenjati. Njihova pravila izračuna prikazana su samo kao informacija.

### Čuvanje prilagođenog profila kao predloška

1. Ako treba, dajte prilagođenom profilu drugi naziv u polju *Naziv ovog vlastitog profila*.
2. Kliknite *Spremi kao predložak*. Aplikacija javlja da je predložak spremljen ili zašto to nije uspjelo.
3. U drugom projektu u istoj aplikaciji predložak se nalazi u padajućem popisu *Profil izračuna*.

Ako se profil kasnije razlikuje od predloška, žuti blok to kaže. Tada odaberite *Ažuriraj predložak iz ovog projekta* ili *Ažuriraj iz predloška*.

Predložak izbrišete pomoću *Izbriši predložak*. Aplikacija prije brisanja traži potvrdu.

## Provjera rezultata

- Blok *Profil izračuna i opcije izračuna* prikazuje odabrani profil.
- Nakon klika na *Primijeni* aplikacija javlja pomaknute zadatke, na primjer *Nakon primjene pomaknuta su 4 zadatka.*
- Narančasti blok iznad opcija izračuna kaže da se vaše opcije izračuna razlikuju od zadanih vrijednosti profila. To je često namjerno. Ako ipak želite zadane vrijednosti, kliknite *Upotrijebi zadane postavke profila …*.

## Zamke i što aplikacija radi

**Datumi se pomiču.** Drugi profil može doista promijeniti datume. Provjerite rezultat. Ako vam se rezultat ne sviđa, odaberite *Poništi*: profil i datumi vraćaju se zajedno.

**Žuti blok nakon poništavanja.** Ako pritisnete *Poništi* ili *Ponovi* dok su otvorene postavke projekta, blok prati stanje projekta. Ako ste u bloku već sami nešto promijenili, vaš izbor ostaje. Žuti blok tada kaže da *Primijeni* vraća taj izbor.

**Može postojati najviše 100 predložaka.** Ako ih već ima 100, aplikacija predložak ne sprema i to javlja. Prvo izbrišite predložak. Puna ili nedostupna pohrana aplikacije također prikazuje poruku.

**Predlošci pripadaju aplikaciji, a profil projektu.** Projekt uvijek nosi vlastitu kopiju profila. Ako kasnije promijenite predložak, projekt se s njim ne mijenja.

**Postavke iz izvorne datoteke.** Ako za projekt koji dolazi iz druge datoteke odaberete *Primavera P6* ili *Microsoft Project*, postavke iz izvorne datoteke ostaju. Ovdje ih ne možete mijenjati.

## Vidi također

- [Profili izračuna i pravila izračuna](docs://uitleg-rekenprofielen): što je profil i što radi s datumima.
- [Opcije izračuna i pravila izračuna](docs://ref-rekenopties-en-conventies): sva pravila izračuna i opcije izračuna na jednom mjestu.
- [Odabir načina praćenja napretka](docs://howto-voortgangsmodus-kiezen): Retained Logic ili Progress Override, odvojeno od profila.
