# Odabir razdoblja izvješća

Cilj: odlučite koje razdoblje izvješće obuhvaća, na primjer sljedeća četiri tjedna ili mjesec lipanj.

## Kada vam ovo treba

Tjedni sastanak želi znati što se događa u sljedeća četiri tjedna. Mjesečno izvješće obuhvaća lipanj. Bez razdoblja dobijete cijeli raspored na papiru. Pet izvješća zato ima opciju *Razdoblje izvješća*: *Look-ahead*, *Izvješće o napretku*, *Opterećenje resursa*, *Dodjele resursa* i *Dijagram resursa*. Ostala izvješća nemaju razdoblje.

Razdoblje nije vezano uz kalendarski mjesec, nego uz **referentni dan**: datum stanja vašeg projekta (dan na koji mjerite napredak, pogledajte [Napredak, datum stanja i temeljni plan](docs://uitleg-voortgang)), ili današnji dan ako projekt nema datum stanja. *Sljedeća 4 tjedna* računaju se od tog dana. Ako pomaknete datum stanja, razdoblje se pomiče s njim.

## Koraci

### 1. Postavite datum stanja

Ako radite s relativnim izborom, na primjer *Sljedeća 4 tjedna* ili *Prošli mjesec*, prvo postavite datum stanja. Odaberite *Raspored › Temeljni planovi i napredak* i unesite u polje *Datum stanja*. Križićem pored polja (*Ukloni datum stanja*) datum ponovno uklanjate. Ako radite s fiksnim razdobljem (korak 4), to vam nije potrebno.

### 2. Odaberite izvješće s razdobljem

Otvorite karticu *Izvješće* i u polju *Vrsta izvješća* odaberite jedno od pet izvješća. Popis *Razdoblje izvješća:* nalazi se u odjeljku *Opcije izvješća*. Za Dijagram resursa nalazi se u odjeljku *Postavke*, ispod četiri potvrdna okvira tog izvješća.

Svako izvješće pamti vlastito razdoblje. To su početne vrijednosti:

- *Look-ahead*: *Sljedeći mjesec*.
- *Izvješće o napretku*: *Prošli mjesec*.
- *Opterećenje resursa*, *Dodjele resursa* i *Dijagram resursa*: *Trajanje projekta*.

### 3. Odaberite razdoblje s popisa

Popis ima *Sljedeći tjedan*, *Sljedeća 2 tjedna*, *Sljedeća 4 tjedna*, *Sljedećih 6 tjedana*, *Sljedećih 8 tjedana*, *Sljedećih 12 tjedana* i *Sljedeći mjesec*, a isto tako sedam izbora za prošlo razdoblje, na primjer *Prethodna 2 tjedna* i *Prošli mjesec*. Ostali izbori su *Trajanje projekta* i *Prilagođeno*. Ispod popisa su *Od* i *Do* s datumima koje izbor daje. Ovdje ih možete samo pročitati.

Oba dana se ubrajaju. Ako je datum stanja četvrtak, 20. svibnja, *Sljedeći tjedan* traje od 20. do 26. svibnja uključivo, a *Sljedeća 4 tjedna* od 20. svibnja do 16. lipnja uključivo (28 dana). *Sljedeći mjesec* traje do jednog dana prije istog datuma u sljedećem mjesecu, ovdje do 19. lipnja uključivo. *Prethodna 2 tjedna* traju od 7. do 20. svibnja uključivo.

*Trajanje projekta* uzima raspored od prvog početka do posljednjeg završetka.

### 4. Ili odaberite Prilagođeno

Kad odaberete *Prilagođeno*, *Od* i *Do* postaju dva polja za datum. Počinju s datumima izbora koji ste upravo imali. Unesite oba, na primjer 1. i 14. lipnja. Ako unos nije ispravan, izvješće ostaje na posljednjem ispravnom razdoblju i crvenom bojom ispisuje:

- *Datum završetka je prije datuma početka.* ako je *Do* ranije od *Od*.
- *Unesite oba datuma.* ako je jedno od ta dva polja prazno.

### 5. Pročitajte razdoblje u izvješću

Za Look-ahead, Opterećenje resursa i Dodjele resursa razdoblje stoji ispod naslova, na primjer *Razdoblje: 20-05-2027 – 19-06-2027*. Ako odaberete *Trajanje projekta*, iza datuma dodaje se *Trajanje projekta*. Izvješće o napretku prikazuje razdoblje u sažetku, u retku *Razdoblje*. Vremenska os dijagrama resursa točno pokriva razdoblje.

### Što razdoblje radi u pojedinom izvješću

Razdoblje ne radi isto u svakom izvješću.

- **Look-ahead** uzima nedovršene zadatke koji zadiru u razdoblje, čak i ako ga obuhvaćaju u cijelosti. Zakašnjeli zadaci iz vremena prije referentnog dana također su uključeni, sve dok razdoblje ne završava prije referentnog dana. Prilagođeno razdoblje u cijelosti u prošlosti je pregled unatrag: prikazuje samo ono što je tada bilo u tijeku i još nije završeno, bez današnjeg zaostatka.
- **Izvješće o napretku** koristi razdoblje za *Dovršeno u prethodnom razdoblju*. Odjeljak *Počinje u sljedećem razdoblju* gleda unaprijed od datuma stanja, do datuma u retku *Pregled unaprijed do* u sažetku. Ako odaberete *prethodno* razdoblje, izvješće gleda unaprijed onoliko koliko gleda unatrag: uz *Prethodna 2 tjedna* i datum stanja 20. svibnja piše *Pregled unaprijed do* 3. lipnja. Prilagođeno razdoblje ili *Trajanje projekta* koje leži u cijelosti u prošlosti ne zrcali se.
- **Opterećenje resursa** prikazuje svaki tjedan ili mjesec koji zadire u razdoblje, u cijelosti. Ako vaše razdoblje ide od srijede do srijede, vidite zato cijele tjedne, pa redak uvijek pokazuje isti broj kao histogram.
- **Dodjele resursa** prikazuje dodjele zadataka koji zadiru u razdoblje. Uz *Trajanje projekta* nema filtriranja po datumu.
- **Dijagram resursa** prikazuje samo zadatke koji zadiru u razdoblje. U sažetku *Izvan razdoblja:* broji koliko je zadataka izostavljeno.

## Pogreške i što aplikacija radi

**Nema datuma stanja.** Aplikacija tada koristi današnji dan. Za četiri tablična izvješća s razdobljem (*Look-ahead*, *Izvješće o napretku*, *Opterećenje resursa* i *Dodjele resursa*) na vrhu se uz relativno razdoblje prikazuje *Datum stanja nije postavljen — izvješće koristi današnji datum (29-09-2026).* s vašim današnjim datumom. Dijagram resursa to ne prikazuje. Zato pogledajte *Od* i *Do*: tada su oko današnjeg dana, a ne oko vašeg rasporeda.

**Razdoblje je izvan vašeg rasporeda.** Tada je izvješće prazno. Dijagram resursa to kaže porukom *Nema zadataka u razdoblju izvješća — odaberite drugo razdoblje ili Cijeli projekt.* (na popisu se taj izbor zove *Trajanje projekta*). U ostalim izvješćima vidite nula zadataka ili nema redaka.

**Datumi su u vašem zapisu.** *Od* i *Do* slijede zapis datuma iz vaših postavki, osim u poljima za datum izbora *Prilagođeno*: ona prikazuju zapis vašeg preglednika.

**Razdoblje se pomiče.** Relativni izbor, na primjer *Sljedeći mjesec*, određuje se iznova svaki put. Ako se datum stanja promijeni, ili ako nema datuma stanja i sljedeći je dan, razdoblje se odmah pomiče. Ako želite fiksno razdoblje, odaberite *Prilagođeno*.

**Izbor vrijedi za sve vaše projekte.** Prilagođeno razdoblje vrijedi i za sve vaše projekte na ovom uređaju, ne samo za otvoreni projekt.

## Vidi također

- [Izrada i ispis izvješća](docs://howto-rapport-maken-en-afdrukken): cijeli put od vrste izvješća do PDF-a.
- [Napredak, datum stanja i temeljni plan](docs://uitleg-voortgang): što je datum stanja i zašto aplikacija računa s njim.
- [Rješavanje preopterećenja resursa](docs://howto-overbezetting-oplossen): što učiniti s preopterećenim tjednima iz izvješća Opterećenje resursa.
- [Vrste izvješća](docs://ref-rapporttypes): sve vrste izvješća i njihove opcije.
