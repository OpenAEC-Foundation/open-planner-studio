# Korištenje podijeljenog prikaza i mini-karte

Cilj: vidjeti dva dijela vremenske crte jedan pored drugoga i brzo se kretati kroz dugi raspored.

## Kada vam ovo treba

Raspravljate o početku temelja i istovremeno o predaji devet mjeseci kasnije. Bez pomoći stalno uvećavate i umanjujete prikaz pa izgubite pregled gdje ste bili. Uz **podijeljeni prikaz** vidite isti raspored dvaput, jedan pored drugoga, a svaki s vlastitim vremenskim prozorom. Uz **mini-kartu** vidite cijelo razdoblje projekta u jednom uskom pojasu i klikom skačete na dio koji tražite.

## Koraci

### Uključivanje podijeljenog prikaza

1. Odaberite karticu *Prikaz*. U grupi *Prezentacija* nalaze se *Prezentacija*, *Podijeljeni prikaz* i *Mini-karta*.
2. Kliknite *Podijeljeni prikaz*. Gantt se dijeli na dva dijela. Oba prozora počinju s uvećanjem i položajem vašeg trenutačnog prikaza.

Dva prozora dijele tablicu zadataka, retke i okomito pomicanje. Ono što svaki prozor ima za sebe, to je vremenska skala: uvećanje i vodoravni položaj.

### Svakom prozoru dajete vlastiti vremenski raspon

- Uvećavate i pomičete u prozoru nad kojim je miš. Uz zadanu postavku za *Pomicanje i zumiranje* (*Zumiranje + povlačenje*) kotačić miša uvećava taj prozor, s točkom uvećanja na mjestu miša. Ako vaša postavka prati neki drugi način, kotačić u oba prozora radi ono što taj način određuje.
- Uz zadanu postavku pomičete retke tipkom Shift i kotačićem miša. To vrijedi za oba prozora istodobno.
- Gumbi *Uvećaj +* i *Umanji -* i popis vremenske skale (na primjer *Kvartal*) rade samo u lijevom prozoru. Zato desni prozor uvećavate kotačićem miša.
- Povucite razdjelnik između dvaju prozora ulijevo ili udesno da ih proširite ili suzite. Na početku svaki prozor zauzima polovicu.

### Isključivanje podijeljenog prikaza

Ponovno kliknite *Podijeljeni prikaz*. Ostaje jedan prozor, s prikazom lijevog prozora. Novi podijeljeni prikaz počinje s prikazom tog trenutka.

### Uključivanje mini-karte

1. U grupi *Prezentacija* kliknite *Mini-karta*.
2. Ispod vremenske crte pojavi se pojas cijelog razdoblja projekta. Zadaci trenutačnog prikaza vidljivi su kao tanke crtice, dakle nakon filtra samo zadaci koje filtar prikazuje. Okvir oko dijela koji sada vidite označava vaš položaj.
3. Kliknite bilo gdje na pojasu da okvir postavite tamo. Prozor se centrira na to mjesto. Ili uhvatite okvir i povucite ga.

Mini-karta samo pomiče vremenski prozor. Retci ostaju kakvi jesu.

Ako je podijeljeni prikaz uključen, svaki prozor dobiva vlastiti pojas, ispod vlastitog dijela vremenske crte. Svaki pojas upravlja samo prozorom iznad sebe.

## Zamke i ponašanje aplikacije

**Mini-karta ne radi ništa ako je cijeli projekt već vidljiv.** Ako umanjite prikaz toliko da stane cijeli raspored, nema se kamo pomaknuti i klik nema učinka. Najprije uvećajte prikaz.

**Mini-karta je samo u Gantt prikazu.** Na karticama *Tablica*, *IFC* i *Izvješće* te u punom prikazu okna resursa (*Resursi*, a ne *Usidrenje resursa*) nema vremenske crte, pa nema ni mini-karte ni podijeljenog prikaza. Vraćaju se čim se vratite na Gantt prikaz.

**Podijeljeni prikaz pripada projektu, mini-karta ne.** Podijeljeni prikaz vrijedi za otvoreni projekt. Ako prijeđete na drugi projekt i vratite se, i dalje je uključen. Mini-karta je jedan izbor za sve projekte i ostaje uključena ili isključena nakon ponovnog pokretanja. Oba su izbora zaslona: ne spremaju se u datoteku projekta, ne označavaju projekt kao „izmijenjen“ i nisu u *Poništi*.

**Podijeljeni prikaz i prezentacija.** Oba ostaju uključena kad pređete na način prezentacije (pogledajte [Prezentiranje na velikom zaslonu](docs://howto-presentatie)). Budući da vrpca tada nestaje, u tom načinu ih više ne možete uključiti ni isključiti. Zato ih prije početka ispravno postavite.

## Vidi također

- [Prezentiranje na velikom zaslonu](docs://howto-presentatie): Gantt prikaz na cijelom zaslonu, bez vrpce.
- [Stvaranje i korištenje izgleda](docs://howto-layouts-gebruiken): vremenska skala može se također spremiti kao dio izgleda.
