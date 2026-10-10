# Spremanje i upravljanje temeljnim planom

Cilj: raspored zabilježiti kao dogovor (temeljni plan), zato da kasnije vidite koliko izvršenje odstupa. I čuvate, preimenujete, birate i brišete više temeljnih planova.

## Kada to trebate

Temeljni plan zabilježite kada je raspored odobren, a rad još nije počeo. Ako se raspored kasnije formalno revidira, na primjer nakon naloga za izmjenu radova, spremite drugi temeljni plan i prvi zadržite. Tako izvršenje mjerite prema prvom dogovoru i prema revidiranom. Što točno temeljni plan bilježi i kako aplikacija računa odstupanje, objašnjeno je u [Napredak, datum stanja i temeljni plan](docs://uitleg-voortgang).

## Koraci

### Spremanje temeljnog plana

1. Pritisnite **Izračunaj** (F5), na primjer kroz *Raspored › Raspored › Izračunaj*. Temeljni plan bilježi datume koji se u tom trenutku izračunaju.
2. Odaberite *Raspored › Temeljni planovi i napredak › Upravljaj temeljnim planovima…*. Otvara se prozor *Temeljni planovi*.
3. Pod *Spremi novi temeljni plan* nalazi se predloženi naziv, na primjer *Temeljni plan 1 — (današnji datum)*. Upišite naziv po svom izboru, po kojem ćete ga kasnije prepoznati, na primjer *Temeljni plan*.
4. Kliknite *Spremi*. Temeljni plan je sada na popisu i odmah je aktivni temeljni plan.
5. Kliknite *Zatvori*.

Ispod svake trake zadatka u Gantt prikazu sada je tanka traka s datumima temeljnog plana. Kontrolna točka dobiva mali romb. Ovaj prikaz uključujete ili isključujete u *Prikaz › Temeljni planovi i napredak › Prikaz temeljnog plana*.

### Odabir aktivnog temeljnog plana

Otvorite *Upravljaj temeljnim planovima…* i u stupcu *Aktivno* odaberite temeljni plan s kojim želite usporediti. Dok postoje temeljni planovi, točno je jedan aktivan. Prikaz temeljnog plana u Gantt prikazu, vrsta izvješća *Odstupanja* i *Izvješće o napretku* koriste aktivni temeljni plan.

### Preimenovanje temeljnog plana

Promijenite naziv na popisu. Promjena se odmah primjenjuje. Ne morate kliknuti *Spremi*.

### Brisanje temeljnog plana

Kliknite malu kantu za smeće pored temeljnog plana na popisu. Ako izbrišete aktivni temeljni plan, aplikacija pita *Izbrisati aktivni temeljni plan?*. Zatim najnoviji preostali temeljni plan postaje aktivni. Ako nema drugog, više nema aktivnog temeljnog plana i prikaz nestaje. Pomoću Ctrl+Z vraćate izbrisani temeljni plan.

### Odstupanja u tablici zadataka

Svaki temeljni plan ima šest stupaca u tablici zadataka. Kliknite **+** s desne strane zaglavlja tablice zadataka (*Dodaj stupac*) i otvorite kategoriju *Temeljni plan*. Za svaki temeljni plan postoje *Planirani početak*, *Planirani završetak*, *Trajanje*, *Odstupanje početka*, *Odstupanje završetka* i *Odstupanje trajanja*, s nazivom temeljnog plana ispred, na primjer *Temeljni plan — Odstupanje završetka*. Odstupanja su u radnim danima: plus znači kasnije, minus znači ranije. Zadatak koji nije u temeljnom planu prikazuje crticu (—) u tim stupcima.

## Zamke i što aplikacija radi

**Zastarjeli raspored.** Ako je raspored zastario, prozor prikazuje *Raspored je zastario. Prvo ponovno izračunajte (F5)*. To je upozorenje. Spremanje ostaje moguće. Ali tada spremate stare datume. Zatvorite prozor, pritisnite **Izračunaj** i tek tada spremite.

**Temeljni plan s unesenim napretkom.** Ako spremite temeljni plan nakon što ste unijeli napredak, bilježi stanje sa stvarnim datumima. Odstupanje je tada nula i više ništa ne govori o izvršenju. Temeljni plan spremite prije nego što rad počne.

**Temeljni plan se ne može ažurirati.** Ako želite revidirati dogovor, spremite novi temeljni plan i po potrebi izbrišite stari.

**Samo zadaci bez podzadataka.** Faza nije u temeljnom planu: nema traku temeljnog plana i nema odstupanja. Faza proizlazi iz zadataka ispod nje.

**Novi i izbrisani zadaci.** Zadatak koji dodate nakon spremanja nema traku temeljnog plana. U izvješću o odstupanjima prikazuje se kao *Novo*. Zadatak koji izbrišete prikazuje se kao *Uklonjeno*.

**Premjesti projekt.** U prozoru *Premjesti projekt…*, čim postoje temeljni planovi, prikazuje se potvrdni okvir *Pomakni i temeljne planove*. Zadano je isključen: temeljni planovi ostaju na mjestu, pa se pomak vidi kao odstupanje. Pogledajte [Premještanje projekta](docs://howto-project-verplaatsen).

**Spremljeno u datoteci projekta.** Temeljni planovi i izbor aktivnog temeljnog plana spremaju se zajedno s projektom i vraćaju se kada otvorite datoteku.

## Pogledajte također

- [Napredak, datum stanja i temeljni plan](docs://uitleg-voortgang): što temeljni plan bilježi i kako se računa odstupanje.
- [Premještanje projekta](docs://howto-project-verplaatsen): potvrdni okvir *Pomakni i temeljne planove*.
- [Ažuriranje napretka](docs://howto-voortgang-bijwerken): unos stvarnog stanja koje uspoređujete s temeljnim planom.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): jedan temeljni plan (*Baseline at start*) prije početka, s napretkom i datumom stanja 20. svibnja 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): dva temeljna plana, *Contract* i *Re-baseline (variation order)*, s napretkom i datumom stanja 5. srpnja 2027.
