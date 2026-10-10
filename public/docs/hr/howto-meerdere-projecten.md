# Rad s više projekata istodobno

Cilj: imati otvoreno više rasporeda, prebacivati se među njima i zatvarati ih zasebno.

## Kada vam ovo treba

Radite na stambenom razvoju u susjedstvu, ali sastanak na gradilištu odnosi se i na obnovu klupske kuće. Ili želite zadržati varijantu uz izvorni raspored. Svaki projekt ima vlastitu karticu, sa svojim zadacima, izračunom i vremenskim razdobljem. Prebacivanje zahtijeva jedan klik i ništa se ne gubi.

## Koraci

### Otvaranje drugog projekta

1. Kliknite plus desno od kartica (*Pokreni projekt*). Otvara se prozor *Pokreni projekt*.
2. Odaberite *Novi projekt* za prazan raspored ili *Otvori postojeći projekt* za odabir datoteke. *Odustani* zatvara prozor.
3. Pri odabiru *Novi projekt* ispunite prozor *Novi projekt* i kliknite *Stvori*.

Projekt se pojavi na vlastitoj kartici i odmah je aktivan. *Novo* i *Otvori* na vrpci, Ctrl+O i primjeri u *Datoteka › Primjeri* također otvaraju projekt na novoj kartici. Ponovno se koristi samo novi, prazan raspored koji još niste mijenjali, umjesto da se doda kartica.

### Prebacivanje između projekata

- Kliknite karticu projekta.
- Pritisnite Ctrl+1 do Ctrl+9 (⌘ umjesto Ctrl na macOS-u) za projekt na tom mjestu u nizu, brojeno slijeva nadesno.
- Kliknite ikonu izbornika lijevo od kartica (*Svi projekti*). Pregled *Otvoreni projekti* prikazuje pločicu za svaki projekt, s nazivom, nazivom datoteke (ako projekt ima datoteku), sličicom rasporeda, brojem zadataka, brojem kritičnih zadataka i datumom završetka. Kliknite pločicu da odete tamo. Esc zatvara pregled.

Svaka kartica ima obojenu točku koja pripada projektu. Kartica s malom točkom iza nje ima nespremljene promjene.

### Zatvaranje projekta

Kliknite križić pored naziva na kartici (*Zatvori*) ili križić na pločici u pregledu. Projekt bez promjena odmah se zatvara. Ako ima nespremljene promjene, aplikacija pita *Nespremljene promjene* i nudi tri izbora:

- *Spremi* sprema projekt i zatim ga zatvara.
- *Ne spremaj* zatvara projekt i odbacuje promjene.
- *Odustani* ostavlja projekt otvoren.

Ako odustanete od spremanja, na primjer zatvaranjem prozora za spremanje, projekt ostaje otvoren.

Ako zatvorite posljednji projekt, ostaje prazan raspored pod nazivom *Novi raspored*.

### Odabir stila prebacivanja

Način prebacivanja možete izabrati. Otvorite prozor postavki zupčanikom u naslovnoj traci, idite na karticu *Prikaz* i pri *Stil prebacivanja dokumenata* odaberite:

- *Vodoravne kartice*: zadano. Red kartica ispod vrpce.
- *Okomite kartice*: uska traka lijevo s gumbom za svaki projekt (prva slova naziva) i gumbom plus. Ako zadržite pokazivač iznad gumba, vidite naziv, naziv datoteke, broj zadataka, broj kritičnih zadataka i datum završetka. Gumb na vrhu otvara pregled.
- *Pilula*: jedna pilula u naslovnoj traci s nazivom aktivnog projekta i brojačem, na primjer *2 otvorena*. Kliknite je da otvorite pregled i tamo se prebacite.

Sva tri stila otvaraju isti pregled, a Ctrl+1 do Ctrl+9 radi u svakom stilu.

## Zamke i što aplikacija radi

**Što pripada projektu, a što je zajedničko.** Svaki projekt ima vlastiti pogled: zumiranje i položaj, aktivni izgled s filtrom, grupiranjem ili sortiranjem, podijeljeni prikaz, linije ovisnosti i sažete faze. Kad se prebacite na drugi projekt, tamo vidite njegov pogled. Zajednički su za sve projekte: odabrana kartica na vrpci, mini-karta, preklopi (preklop temeljnog plana, linija napretka i ostali), vaš izbor stupaca, vaši izgledi i postavke izvješća.

**Ne možete se prebaciti dok je dijalog otvoren.** Dok je dijalog otvoren, na primjer prozor postavki ili prozor zadatka, Ctrl+1 do Ctrl+9 ne radi ništa u aplikaciji. U pregledniku tada prebacuju kartice preglednika. Najprije zatvorite dijalog. Promjena u *Podaci o projektu* u Backstageu koja još nije primijenjena također blokira prebacivanje.

**Ctrl+1 do Ctrl+9 broje po redoslijedu.** Prečac ide na projekt na tom mjestu u nizu. Ako zatvorite projekt, ostali projekti dobivaju niži broj. Ako imate otvoreno više od devet projekata, do ostalih dolazite samo preko kartica ili pregleda.

**Izračunaj i izvješća rade na aktivnom projektu.** Izračunaj (F5), *Izvezi PDF* i izvješća odnose se na projekt koji je sada aktivan.

## Pogledajte također

- [Stvaranje i korištenje izgleda](docs://howto-layouts-gebruiken): postavljanje pogleda za svaki projekt.
- [Izrada i ispis izvješća](docs://howto-rapport-maken-en-afdrukken): izvješće aktivnog projekta.
