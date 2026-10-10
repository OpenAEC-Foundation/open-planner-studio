# Prilagodba raspodjele sati

Cilj: za jednu dodjelu sami odredite koliko resurs radi na svakom radnom danu zadatka, umjesto standardne krivulje.

## Kada vam ovo treba

Krivulja kao *Zvonasto* je fiksni oblik. Ponekad sami bolje znate. Zidar počinje na vanjskom listu šupljeg zida na pola snage, jer se skela još postavlja, a zatim radi punom snagom. Ili želite zadržati vrhunac malo ispod kapaciteta. Tada prilagodite **raspodjelu sati**.

Radite s **fazama**: uzastopnim radnim danima na kojima resurs radi s istim jedinicama dodjele. Raspodjela mijenja samo sate po danu ove jedne dodjele. Datumi zadatka se ne mijenjaju.

## Koraci

Primjer je vanjski list šupljeg zida: 6 radnih dana, jedan zidar, 48 sati.

1. Odaberite zadatak. Panel *Svojstva* nalazi se desno; ako ga ne vidite, uključite ga s *Prikaz › Paneli › Svojstva*.
2. U odjeljku *Dodjele* kliknite ikonu stupčastog grafikona *Raspodijeli sate…* pored zidara. Otvara se prozor *Raspodjela sati po fazama*. Polazite od onoga što aplikacija trenutno rezervira: za ovaj vanjski list jedna faza od 6 dana s jedinicama dodjele 1.
3. Ako treba, odaberite polazište kod *Primijeni oblik:*. S *Zvonasto* aplikacija stvara pet faza: 0,18 jedinica prvog i zadnjeg dana, 0,84 drugog i petog dana te 1,98 na dva srednja dana. Ukupno ostaje 48 sati.

### Prilagodba faza

U tablici ili u traci iznad nje možete raditi.

- U fazi upišite drugu vrijednost za *Jedinice dodjele/dan*. Stupci *Sati/dan* i *Sati* računaju se usporedno.
- Promijenite broj *Dani* u fazi. Zadnja faza uvijek traje do kraja zadatka i dobiva preostale dane.
- Odaberite *Podijeli* da fazu podijelite na dvije, na primjer 6 dana u 3 i 3. Odaberite *Spoji* da fazu spojite sa sljedećom.
- U traci povlačite granicu da fazu produljite ili skratite, povlačite gornji rub da postavite jedinice dodjele i dvaput kliknete dan da fazu podijelite.

### Primjena

Odaberite *Primijeni*. S *Odustani* prozor se zatvara bez promjene.

Primjer. Odaberite *Podijeli*, postavite *Dani* prve faze na 2 i jedinice dodjele te faze na 0,5. Druga faza tada traje 4 dana s jedinicama 1. Ukupno je 2 × 0,5 × 8 + 4 × 1 × 8 = 40 sati.

Nakon *Primijeni* krivulja dodjele je postavljena na *Obris* i onemogućena. *Jed./dan* ostaje kakav je bio. Histogram i preopterećenje resursa odmah prate novu raspodjelu. Ponovno izračunavanje nije potrebno, jer se nijedan datum ne pomiče.

### Uklanjanje raspodjele

Ako dodjela ima vlastitu raspodjelu, prozor ima i *Ukloni raspodjelu*. Time se uklanja vaša raspodjela, a aplikacija se vraća na *Jed./dan* i krivulju. Odaberite to i ako želite promijeniti krivulju, jer je padajući izbornik *Krivulja* onemogućen dok postoji vlastita raspodjela.

## Zamke i što aplikacija tada radi

**Ukupno se mijenja s time.** Sate ne dijelite, nego ih sami određujete. Ako postavite fazu na 0,5 umjesto 0,18, ukupno postaje veće. Ukupno u satima nalazi se na dnu prozora, pa ga provjerite prije nego kliknete *Primijeni*.

**Što jedinice dodjele poslije čine, ovisi o pravilu rada.** Uz *Fiksno trajanje i fiksne jedinice* druga *Jed./dan* ne mijenja ništa u raspodjeli. Uz *Fiksno trajanje i fiksni rad* aplikacija skalira sate po danu zajedno s novim jedinicama: pri jedinicama dodjele 2 umjesto 1 udvostruči se svaki dan, a s time i ukupno (s 32 na 64 sata). Trajanje ostaje isto. Uz *Fiksni rad* jedinice mijenjaju trajanje zadatka: raspodjela se sabija ili rasteže na novo trajanje, uz isti ukupni iznos. Uz *Fiksne jedinice* jedinice mijenjaju i trajanje; zatim provjerite ukupno na dnu prozora.

**Ako promijenite trajanje zadatka, raspodjela se rasteže s time.** Oblik ostaje isti. Uz *Fiksno trajanje i fiksne jedinice* i uz *Fiksne jedinice* ukupno raste razmjerno trajanju: ako se trajanje zadatka s vlastitom raspodjelom udvostruči s 4 na 8 radnih dana, udvostruči se i ukupno, s 32 na 64 sata. Uz *Fiksno trajanje i fiksni rad* i uz *Fiksni rad* ukupno ostaje isto (32 sata ostaje 32 sata), a jedinice se smanjuju.

**Rad slijedi raspodjelu.** *Rad (preostalo)* postaje zbroj vaših faza, također uz *Fiksni rad*. Trajanje zadatka se zbog toga ne mijenja.

**Neispravne jedinice.** Prazne ili negativne jedinice dobivaju crveni okvir, a *Primijeni* je tada onemogućen. Faza s jedinicama 0 je dopuštena. Takva faza ostaje unutar trajanja zadatka.

**Sve se primjenjuje na ovu jednu dodjelu.** Aplikacija to sama kaže: *Raspodjela mijenja samo sate po danu ove dodjele; datumi zadatka i prekidi ostaju kakvi jesu.* Drugi resursi na istom zadatku zadržavaju svoju raspodjelu.

**Uravnoteživanje slijedi raspodjelu.** Uravnoteživanje broji iste sate po danu kao histogram.

**Poništavanje.** *Primijeni* i *Ukloni raspodjelu* svaki je jedan korak koji se može poništiti s *Poništi* (Ctrl+Z).

## Vidi također

- [Dodjela resursa s krivuljom](docs://howto-resource-toewijzen): postavljanje resursa na zadatak i odabir krivulje.
- [Rješavanje preopterećenja resursa](docs://howto-overbezetting-oplossen): što učiniti kada resurs ima previše posla jednog dana.
