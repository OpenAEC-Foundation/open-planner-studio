# Povlačenje, pomicanje i zumiranje u Gantt dijagramu

Cilj: upravljati vremenskom linijom mišem. Pomaknite traku ili promijenite njezino trajanje, pomaknite vremensku liniju, odaberite zadatke okvirom i uvećavajte ili umanjujte prikaz.

## Kada vam ovo treba

U Gantt dijagramu vidite da zidanje mora početi dva dana kasnije ili da lijevanje traje dan duže. To želite promijeniti izravno na traci. Ili imate projekt od nekoliko mjeseci i želite se brzo pomaknuti do građevinskog godišnjeg odmora. Miš za to ima nekoliko gesta. Što koja gesta čini, ovisi o tome gdje počnete povlačiti i o postavci načina pomicanja.

## Koraci

### Pomicanje trake

1. Pritisnite na sredinu trake zadatka i povucite vodoravno. Početak i završetak pomiču se zajedno, u cijelim danima. Trajanje ostaje isto.
2. Pustite tipku miša. Traka ostaje na novom mjestu. Raspored tada nije ažuran: pritisnite *Izračunaj* (F5) ili pustite aplikaciju da to sama učini ako je *Automatsko izračunavanje* uključeno.

Ako zadatak ima prethodnika, aplikacija novi početak bilježi kao ograničenje *Ne početi prije (SNET)* i to kaže nakon što pustite tipku miša. Zašto je tako i što se događa s drugim ograničenjem, opisano je u [Ograničenja i rokovi za dovršetak](docs://uitleg-constraints). Ako povučete natrag na izvorni početak, vraća se i izvorno ograničenje.

Ako povlačite uglavnom gore ili dolje umjesto u stranu, pomičete zadatak u drugi redak, a datumi ostaju isti. Smjer koji odaberete u prvih nekoliko piksela vrijedi za cijelo povlačenje. Zato jedna gesta nikad ne mijenja datume i strukturu istodobno. Pogledajte [Prilagođavanje strukture](docs://howto-structuur-aanpassen).

### Promjena trajanja

1. Pomaknite miš na desni rub trake. Kursor postaje strelica koja pokazuje lijevo i desno.
2. Povucite rub. Dok povlačite, mala oznaka u naglasnoj boji teme (zadano narančasta) prikazuje trajanje koje bi zadatak sada dobio, na primjer *4d*. Oznaka se mijenja uživo, pa novo trajanje vidite prije nego pustite tipku miša. Na desnom rubu oznaka je unutar trake, na lijevom rubu tik lijevo od nje. Oznaka prikazuje trajanje na isti način kao stupac trajanja.
3. Pustite tipku miša. Trajanje je ono koje je prikazala oznaka.

Lijevi rub pomiče početak, a završetak ostaje, pa zadatak postaje kraći ili duži sprijeda. Isto SNET pravilo vrijedi kao kod pomicanja. Kad povlačite sredinu trake, oznaka se ne pojavljuje: trajanje se ne mijenja.

Trajanje se broji u radnim danima kalendara zadatka. Vikendi i neradni dani se ne broje, a zadatak u danima ne može biti kraći od jednog radnog dana. Za zadatak u satima aplikacija zaokružuje na korak vremenske linije ispod miša: najmanje jedan sat, ili četvrt sata ako dovoljno uvećate prikaz i uključen je *Prikaži četvrt sata pri jakom zoomu*.

Jedno povlačenje je jedan korak za *Poništi*, bez obzira koliko dugo povlačite. Na traci podijeljenog zadatka rubovi rade drugačije. Pogledajte [Dijeljenje zadatka](docs://howto-taak-splitsen).

### Pomicanje vremenske linije

Što čini povlačenje po praznoj pozadini, ovisi o načinu pomicanja. Odaberete ga u prozoru *Postavke*, na kartici *Prikaz*, pod *Gantt › Pomicanje i zumiranje*, kod *Način*:

- **Zumiranje + povlačenje** (zadano): ako povlačite po praznoj pozadini lijevom tipkom miša, vremenska linija se pomiče zajedno s mišem, kao karta. Kursor je ruka. Na traci povlačenje samo pokreće gestu trake.
- **Položaj** i **Tipke**: isto povlačenje stvara okvir za odabir. Vremensku liniju pomičete kotačićem (pogledajte [Postavke](docs://ref-instellingen)) ili srednjom tipkom miša.

**Srednja tipka miša** (pritisnut kotačić) pomiče vremensku liniju u svakom načinu, i ako počnete na traci. Ne radi dok je druga gesta u tijeku, na primjer povlačenje trake.

### Odabir zadataka okvirom

Okvir odabire sve zadatke u redcima koje dira. Važna je samo visina okvira, a ne vremenska skala.

1. Počnite na praznoj pozadini. U načinu *Zumiranje + povlačenje* pritom držite Ctrl (⌘ na Macu). U načinima *Položaj* i *Tipke* to nije potrebno.
2. Povucite preko redaka koje želite odabrati. Odabir dobiva okvir.
3. Pustite tipku miša. Tipkom Esc tijekom povlačenja poništavate okvir, a odabir ostaje kakav je bio.

Više o odabiru je u [Odabir, brisanje i poništavanje zadataka](docs://howto-taken-selecteren-verwijderen). Na praznom prostoru u tablici zadataka povlačenje ne radi ništa.

### Uvećavanje i umanjivanje

1. Upotrijebite *Uvećaj +* i *Umanji -* (*Početak › Zumiranje*) ili tipke + i -. Kotačić također zumira. Kada to radi, ovisi o načinu pomicanja (pogledajte [Postavke](docs://ref-instellingen)).
2. Ako želite cijeli projekt u prikazu, odaberite *Prikaz › Vremenska skala › Prilagodi projektu* ili pritisnite Ctrl+0. *Vrati zadano* (na kartici *Prikaz*) ili tipka 0 vraća zumiranje na zadanu vrijednost.
3. Desno dolje u traci stanja je zumiranje u pikselima po danu, na primjer *Zumiranje: 15px/dan*.

Što dalje umanjujete, to je manje linija mreže. Pri 8 piksela po danu ili više svaki dan ima liniju, a na granici tjedna deblju liniju. Između 2 i 8 piksela po danu ostaje samo granica tjedna. Ispod 2 piksela po danu, na razini godine, ostaju samo granice mjeseci. Inače bi platno postalo jednolika pruga u kojoj nestaju trake. Sivi vikendi i neradni dani te naizmjenično obojene trake tjedana ostaju na svakoj razini. One nose strukturu tjedna kad linije nestanu. U zaglavlju vremenske linije brojevi tjedana i dana pojavljuju se samo kad ima mjesta za njih. Od 40 piksela po danu prikazuje se i dan u tjednu ispred broja dana.

## Problemi i što aplikacija tada radi

**Početak se ne pomiče.** Ako zadatak ima prethodnika i ograničenje koje nije SNET, na primjer *Što kasnije moguće (ALAP)*, aplikacija ne primjenjuje povučeni početak. Nakon što pustite tipku miša, aplikacija kaže koje ograničenje zadržava početak. Promijenite to ograničenje da biste pomaknuli početak. Desni rub radi, jer mijenja samo trajanje.

**Gesta radi nešto drugo.** U načinu ovisnosti i u načinu podijeljenog zadatka geste na traci rade drugačije. Tipka Esc zaustavlja te načine. Ako držite Shift dok povlačite s trake, stvarate ovisnost umjesto da pomičete traku. Pogledajte [Dodavanje ovisnosti](docs://howto-relaties-leggen).

**U načinu Položaj ili Tipke lijeva tipka miša ne pomiče prikaz.** Tada vidite običnu strelicu umjesto ruke. Upotrijebite kotačić ili srednju tipku miša, ili postavite način pomicanja na *Zumiranje + povlačenje*.

**Klik u prekidu podijeljene trake** odabire zadatak i ne pokreće ni povlačenje ni okvir.

## Pogledajte također

- [Izbornici desnom tipkom miša](docs://ref-contextmenus): izbornici na traci, retku i zaglavlju grupe.
- [Tipkovnički prečaci](docs://ref-sneltoetsen): tipke za zumiranje i za poništavanje geste.
- [Postavke](docs://ref-instellingen): način pomicanja i vremenska skala.
- [Ograničenja i rokovi za dovršetak](docs://uitleg-constraints): zašto pomaknuti početak postaje ograničenje.
