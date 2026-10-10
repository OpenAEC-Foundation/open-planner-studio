# Uravnoteživanje resursa

Imate jednog zidara i dva zida koja se moraju graditi istih dana. Na papiru raspored radi, ali u praksi on može biti samo na jednom mjestu. Uravnoteživanje je način na koji aplikacija rješava takve sukobe: zadaci počinju kasnije, dok resurs ne bude mogao podnijeti posao. U ovom članku pročitajte točno što uravnoteživanje pomiče, kada se datum završetka pomiče i što vam ne rješava.

## Koncept

Na radnom danu postoji **preopterećenje resursa** ako raspored toga dana traži od resursa više nego što može dati. Ono što resurs može dati jest njegov kapacitet: *Maksimalan postotak jedinica* na radnim danima iz njegovog kalendara. Ako toga dana ne radi prema svom kalendaru, njegov kapacitet je 0.

**Uravnoteživanje** to rješava tako da zadaci počinju kasnije. Ono ne radi ništa više. Ne skraćuje zadatak, ne dijeli zadatak, ne mijenja jedinice dodjele ni ovisnosti i ne dodaje dodatni resurs. Za svaki zadatak aplikacija traži prvo mjesto na kojem su resursi slobodni i pomiče zadatak tamo.

Postoje dva načina, u prozoru *Uravnoteživanje resursa*:

- Zadano je da se datum završetka projekta može pomaknuti. To je uravnoteživanje u pravom smislu.
- Uz okvir *Uravnoteživanje samo unutar vremenske rezerve (smoothing) — datum završetka projekta ostaje nepromijenjen* aplikacija pomiče zadatke samo unutar njihove vremenske rezerve. Datum završetka tada ostaje isti. Ako to ne uspije, zadatak ostaje gdje jest i aplikacija prijavljuje sukob. Što je vremenska rezerva, pročitajte u [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad).

## Kako aplikacija računa

### Koliko zadatak traži

Za svaki radni dan aplikacija broji koliko jedinica svaki zadatak traži od resursa. To su jedinice dodjele prema krivulji ili vašoj vlastitoj raspodjeli sati, točno isti sati po danu koje prikazuje histogram. Kapacitet resursa je *Maksimalan postotak jedinica* ili vrijednost koraka u vremenski raspoređenom kapacitetu koja vrijedi toga dana. Dan ima preopterećenje resursa ako je potražnja veća od kapaciteta.

### Kojim redom

Aplikacija stavlja zadatke jedan po jedan, tim redom: najprije najviši prioritet, zatim zadatak čiji je ukupan slobodni hod najmanji, zatim najraniji početak, pa redoslijed u tablici zadataka. Zadatak dolazi na red tek kad njegovi prethodnici imaju svoje mjesto.

Prioritet je broj od 0 do 1000 koji postavljate po zadatku. Zadano je 500. U izborniku koji se otvara desnim klikom na traku zadatka zove se *Prioritet*, s izborima *Nizak* (100), *Normalan* (500) i *Visok* (900). Zadatak koji dolazi ranije dobiva mjesto koje želi. Zadaci koji dolaze poslije moraju stati oko njega. Tako prioritet određuje koji zadatak ostaje, a koji ustupa mjesto. Vrijednost 1000 je posebna: takav zadatak nikad ne pomiče zbog kapaciteta. To je „Do Not Level“ iz programa MS Project.

### Kamo se zadatak pomiče

Za svaki zadatak aplikacija kreće od najranijeg početka koji dopuštaju ovisnosti. Pritom se uzima u obzir da su prethodnici možda već sami pomaknuti. Ako zadatak tu stane, ostaje. Ako ne stane, aplikacija proba sljedeći radni dan zadatka, i tako dalje. Zadatak stane ako na svakom danu zadatka svaki resurs ima dovoljno slobodnog kapaciteta. Ako zadatak ima više resursa, svi moraju biti slobodni tih dana. Zadatak se dakle uvijek pomiče kasnije, nikad ranije.

Aplikacija bilježi pomak kao **kašnjenje zbog uravnoteživanja**: broj radnih dana, prema kalendaru zadatka, za koji zadatak počinje kasnije nego što traže njegove ovisnosti. Vidite ga u stupcu *Kašnjenje zbog uravnoteživanja* pod *Izračunato*. Kašnjenje se sprema zajedno s datotekom projekta. *Izračunaj* (F5) uzima ga u obzir kao dodatno čekanje prije početka. Zadaci koji slijede pomiču se kroz svoje ovisnosti.

### Unutar vremenske rezerve ili izvan nje

Bez opcije *smoothing* aplikacija nastavlja tražiti dok zadatak ne stane. Zbog toga se datum završetka projekta može pomaknuti.

Uz *smoothing* zadatak ne smije početi kasnije od svog kasnog početka, to jest od zadnjeg dana na koji bi mogao početi bez pomicanja datuma završetka. Ako zadatak ne stane u taj vremenski okvir, ostaje na svom najranijem mjestu. Zadatak se tada pojavljuje pod *Preostali sukobi*.

### Što aplikacija ne pomiče

- Zadaci koji su već počeli ili su završeni. Njihovo opterećenje se računa, ali nikad ne dobivaju kašnjenje zbog uravnoteživanja.
- Zadaci s prioritetom 1000. Oni slijede svoje prethodnike, ali se ne pomiču zbog kapaciteta.
- Zadaci bez dodjele odabranim resursima, kontrolne točke i faze. Oni se pomiču samo ako se pomakne prethodnik.
- Materijal. Na njega se uravnoteživanje nikad ne primjenjuje.

### Prijedlog i primjena

*Izračunaj* daje prijedlog: zadaci koji se pomiču, sa starim i novim početkom te datumom završetka prije i poslije. Ništa se ne mijenja u vašem rasporedu dok ne odaberete *Primijeni*. Tada aplikacija upisuje kašnjenja u zadatke i odmah provodi ponovno izračunavanje rasporeda.

## Primjer: zidar na dva zida

Primjer je projekt za vježbu iz lekcija, *House extension*, u stanju kakvo je neposredno prije uravnoteživanja u lekciji 5. U lekciji 5 to radite sami i provjeravate brojke. U ovom primjeru je žbukanje zadatak tipa *Fiksni rad*, a žbukar radi u jedinicama dodjele od 2, kao u [Pravila rada: trajanje, jedinice i rad](docs://uitleg-werkregels).

Nakon šuplje međukatne ploče, završene u ponedjeljak 28. lipnja, unutarnji sloj (5 radnih dana) i vanjski sloj (6 radnih dana) počinju u utorak 29. lipnja. Oba su dodijeljena zidaru, s jedinicama dodjele 1 i vrijednošću *Maksimalan postotak jedinica* 1. Nakon unutarnjeg sloja slijede krovni elementi (posao dizalicom od 6 sati) i pokrivanje krova (2 radna dana). Okviri čekaju pokrivanje krova i vanjski sloj. Predaja je u ponedjeljak 30. kolovoza.

### Preopterećenje resursa

Unutarnji sloj traje od 29. lipnja do 5. srpnja uključivo, vanjski sloj od 29. lipnja do 6. srpnja uključivo. Od 29. lipnja do 5. srpnja uključivo, to je 5 radnih dana, raspored traži 2 jedinice od zidara s kapacitetom 1. Zidar ima preopterećenje resursa tih 5 dana.

### Redoslijed

Oba zadatka imaju prioritet 500. Prozorski okviri se isporučuju tek 14. srpnja (u lekciji 3 za to postavljate ograničenje *Ne početi prije (SNET)*). Zbog toga unutarnji sloj ima 3 radna dana vremenske rezerve, a vanjski 5. Unutarnji sloj ima najmanju vremensku rezervu pa dolazi prvi. Ostaje od 29. lipnja do 5. srpnja uključivo.

### Pomak

Vanjski sloj ne može početi 29. lipnja. Prvi dan kad je zidar ponovno slobodan je utorak 6. srpnja. To je 5 radnih dana kasnije od najranijeg početka, pa je kašnjenje zbog uravnoteživanja 5. Vanjski sloj sada traje od 6. srpnja do 13. srpnja uključivo. Okviri ionako počinju tek 14. srpnja, pa predaja ostaje u ponedjeljak 30. kolovoza. Prozor prijavljuje *Datum završetka projekta: nepromijenjen (30-08-2027)* i prikazuje jedan redak: *Build outer cavity leaf*, stari početak 29-06-2027, novi početak 06-07-2027, *5 d*.

Tih 5 radnih dana pomaka točno su vremenska rezerva vanjskog sloja. Zato *smoothing* ovdje daje isti rezultat. Vanjski sloj sada nema više vremenske rezerve i kritičan je.

### Što ako okviri ne dođu 14. srpnja

Bez tog ograničenja okviri mogu početi u petak 9. srpnja, a predaja je u srijedu 25. kolovoza. Vanjski sloj tada ima samo 2 radna dana vremenske rezerve.

- Bez opcije *smoothing* vanjski sloj se i dalje pomiče za 5 radnih dana. Sada okviri moraju čekati: počinju 14. srpnja, 3 radna dana kasnije. Sve što slijedi pomiče se zajedno s njima, a predaja ide s 25. kolovoza na 30. kolovoza, također 3 radna dana kasnije.
- Uz *smoothing* se ništa ne pomiče. Vanjski sloj ne stane unutar svojih 2 radna dana vremenske rezerve. Prozor prikazuje sukob *Build outer cavity leaf*, 5 dan(a), s razlogom *Nedovoljno slobodnog kapaciteta unutar vremenske rezerve za rješavanje ovog sukoba*.

### Što ako vanjski sloj dobije prioritet

Ako vanjskom sloju dodijelite prioritet *Visok* (900), on dolazi prvi. Ostaje na 29. lipnja, a sada unutarnji sloj ustupa mjesto: 6 radnih dana kasnije, od 7. do 13. srpnja uključivo. Unutarnji sloj ima samo 3 radna dana vremenske rezerve, pa je pomak od 6 radnih dana za 3 previše. Krovni elementi, okviri i sve što slijedi pomiču se zajedno. Predaja ide s ponedjeljka 30. kolovoza na četvrtak 2. rujna. Isto preopterećenje resursa daje dakle drugi datum završetka, ovisno o tome koji zadatak ostaje na mjestu.

### Što ako dođe drugi zidar

Ako za zidara postavite *Maksimalan postotak jedinica* na 2, više nema preopterećenja resursa. *Izračunaj* prijavljuje *Nijedan zadatak ne treba pomaknuti — raspored je već bez sukoba*.

## Posljedice i pogrešne predodžbe

**„Uravnoteživanje pronalazi najkraći raspored.“** Ne. Aplikacija radi zadatak po zadatak, fiksnim redom, i ne traži najbolje ukupno rješenje. Pogledajte primjer s prioritetom: drugi prioritet daje drugi datum završetka.

**„Zadatak nakon uravnoteživanja je siguran.“** Uravnoteživanje troši vremensku rezervu. Pomaknuti zadatak tada ima manje vremenske rezerve ili nema nijedne i može postati kritičan, kao vanjski sloj iznad. Ako tada kasni, predaja se pomiče.

**„Uravnoteživanje prati moje kasnije promjene.“** Ne. Kašnjenje je fiksan broj radnih dana. Ako unutarnji sloj postane kraći nakon uravnoteživanja, vanjski sloj i dalje počinje 5 radnih dana kasnije, iako to više nije potrebno. Tada ponovno pokrenite uravnoteživanje. Aplikacija kreće ispočetka.

**Pomicanjem se ne može riješiti sve.** Ako resurs ne radi dana kad zadatak treba, ili ako zadatak prema svojoj krivulji traži na jednom danu više nego što resurs može dati, preopterećenje resursa ostaje. Aplikacija tada kod zadatka kaže zašto.

**Na materijal se uravnoteživanje ne primjenjuje.** Ako materijal na jedan dan traži više od svog kapaciteta, aplikacija to prijavljuje kao preopterećenje resursa, ali uravnoteživanje ga ostavlja netaknutim.

**Zadaci s fiksnim položajem.** Ako su svi zadaci koji se sukobljavaju na prioritetu 1000, prozor prijavljuje *Nijedan zadatak ne treba pomaknuti — raspored je već bez sukoba.*, dok preopterećenje resursa ostaje. Zato nakon primjene pogledajte poruku *Preopterećenje* na vrpci.

## Pogledajte također

- [Rješavanje preopterećenja resursa](docs://howto-overbezetting-oplossen): koraci za pronalaženje preopterećenja resursa i njegovo uravnoteživanje.
- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): što je vremenska rezerva i zašto zadatak postaje kritičan.
- [Pravila rada: trajanje, jedinice i rad](docs://uitleg-werkregels): kako se trajanje zadatka mijenja zajedno s jedinicama dodjele.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): tri tornja kojima trebaju iste ekipe i toranjska dizalica te što uravnoteživanje s time radi.
