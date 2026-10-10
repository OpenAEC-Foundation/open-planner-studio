# Prezentacija na velikom zaslonu

Cilj: prikazati Gantt-dijagram preko cijelog zaslona, bez vrpce i okana, na primjer na projektoru ili televizoru na sastanku na gradilištu.

## Kada vam ovo treba

Deset ljudi gleda jedan zaslon u gradilišnoj baraci. Vrpca, traka stanja i okno svojstava tada zauzimaju prostor koji raspored treba, i odvraćaju pozornost. U **načinu prezentacije** aplikacija zadržava samo tablicu zadataka i Gantt-dijagram, preko cijelog zaslona.

## Koraci

### Priprema prikaza

U načinu prezentacije vrpca nestaje, pa unaprijed postavite ono što želite prikazati.

1. Pritisnite **Izračunaj** (F5), da prikazani datumi budu točni.
2. Postavite pogled koji želite prikazati, na primjer izgled koji prikazuje samo kritične zadatke (vidi [Stvaranje i korištenje izgleda](docs://howto-layouts-gebruiken)).
3. Odaberite vremensku skalu i zumiranje pri kojem su nazivi zadataka čitljivi iz daljine, i sažmite ili proširite faze pomoću *Sažmi* i *Proširi* u grupi *Pregled* na kartici *Prikaz*.
4. Ako ih želite koristiti, uključite opcije *Podijeljeni prikaz* i *Mini-karta* (vidi [Korištenje podijeljenog prikaza i mini-karte](docs://howto-split-view-en-mini-map)).

### Pokretanje prezentacije

Odaberite *Prikaz › Prezentacija › Prezentacija*, ili pritisnite F11. Nestaju vrpca, kartice, traka stanja i desno okno. Vidite tablicu zadataka, Gantt-dijagram i, ako ste ih uključili, histogram i mini-kartu. Nekoliko sekundi pri dnu piše *Pritisnite Esc ili F11 za izlaz iz cijelog zaslona.*

Prezentaciju možete pokrenuti s bilo koje kartice, također s kartice *Tablica* ili *Izvješće*. Uvijek vidite Gantt-dijagram otvorenog projekta. Kada zaustavite prezentaciju, vraćate se na karticu s koje ste počeli.

### Zaustavljanje prezentacije

Pritisnite Esc ili F11. Vrpca i okna vraćaju se na kartici na kojoj ste počeli.

## Zamke i što aplikacija radi

**I dalje možete uređivati u načinu prezentacije.** Klikanje, povlačenje, uređivanje ćelija i tipka Delete i dalje rade. Ako slučajno povučete traku, ona se pomakne i raspored više nije ažuran. Zadatak koji slučajno izbrišete vratite s Ctrl+Z, također u načinu prezentacije. Zato kliknite pažljivo kada radite s grupom.

**Obavijesti ostaju vidljive.** Poruka aplikacije, na primjer pogreška pri spremanju, pojavljuje se i u načinu prezentacije. Inače nema vrpce ni trake stanja, pa je takva poruka jedini znak da nešto nije u redu.

**Postavite unaprijed podijeljeni prikaz, mini-kartu i izglede.** Za to vam treba vrpca, a u ovom načinu nje nema. Zumiranje radi, mišem s kotačićem ili s Ctrl+= i Ctrl+-. Tipke + i - također rade, ali samo kada je fokus u Gantt-dijagramu. Nakon F11 fokus je često u tablici zadataka, pa prvo kliknite u Gantt-dijagram.

**Cijeli zaslon ne radi.** Osim što skriva vrpcu, aplikacija zaista traži cijeli zaslon. Ako preglednik ili prozor to odbije, nestaju samo vrpca i okna. Prezentacija i dalje radi. Ako izađete iz cijelog zaslona na drugi način, a ne s Esc ili F11, na primjer tipkom vašeg operacijskog sustava, i način prezentacije prestaje.

**Način prezentacije se ne pamti.** Nakon zatvaranja i ponovnog otvaranja aplikacije on je isključen.

## Pogledajte i

- [Korištenje podijeljenog prikaza i mini-karte](docs://howto-split-view-en-mini-map): dva vremenska prozora ili traka s pregledom tijekom prezentacije.
- [Stvaranje i korištenje izgleda](docs://howto-layouts-gebruiken): postavljanje pogleda koji želite prikazati jednim klikom.
- [Tipkovni prečaci](docs://ref-sneltoetsen): F11 i ostale tipke.
