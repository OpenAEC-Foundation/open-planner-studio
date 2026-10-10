# Ograničenja i rokovi za dovršetak

Opeka se isporučuje tek 21. lipnja. Dozvola još nije stigla. Krov mora biti zatvoren prije građevinskog praznika. Ovisnosti bilježe da zadatak čeka drugi zadatak, ali dogovori o datumu ne proizlaze iz redoslijeda radova. Za to služe ograničenja i rokovi za dovršetak. U ovom članku čitate što radi svaka vrsta, kada se zadatak pomakne, a kada se mijenja samo vremenska rezerva, što je tvrdo fiksiranje i kako aplikacija prijavljuje sukob.

Pravila i primjeri vrijede za novi projekt s profilom izračuna *Open Planner Studio* i radnim tjednom od ponedjeljka do petka.

## Koncept

**Ograničenje** je granica datuma za jedan zadatak. Ona ne ovisi o ovisnostima zadatka. Takva granica može djelovati na dva načina:

- Ona **potiskuje**: zadatak ne smije početi ili završiti ranije od datuma. Ako bi zadatak zbog svojih ovisnosti počeo ranije, pomakne se na datum.
- Ona **čuva**: zadatak mora početi ili završiti najkasnije na datum. Aplikacija ništa ne pomiče. Ako raspored ne ispunjava datum, **vremenska rezerva** zadatka i lanca prije njega postaje negativna. Vremenska rezerva je prostor koji zadatak ima prije nego se datum završetka projekta pomakne. Negativna znači da ste na papiru već kasni (vidi [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad)).

**Rok za dovršetak** je jednostavniji oblik čuvanja: ciljni datum za završetak zadatka, bez da ga išta pomakne.

Sva ograničenja su **popustljiva**: izračun se nastavlja, čak i kad datum nije ispunjen. Jedina iznimka je **tvrdo fiksiranje**, koje nadjačava ovisnosti. Više o tome slijedi u nastavku.

## Kako aplikacija izračunava

### Osam vrsta

Vrstu odaberete u polju *Ograničenje* na panelu *Svojstva*. Kako svaka vrsta izračunava:

- *Što prije moguće (ASAP)*: bez granice. To je zadano: zadatak počinje čim to dopuštaju njegove ovisnosti.
- *Što kasnije moguće (ALAP)*: zadatak se pomakne što je kasnije moguće, a da se nasljednik ne mora kasnije započeti. Zato iskoristi svoj slobodni hod. Ako nakon toga još ima ukupan slobodni hod, jer njegovi nasljednici sami imaju prostora, ostaje nekritičan. Ako se i taj hod iskoristi, zadatak je kritičan.
- *Ne početi prije (SNET)*: donja granica za početak. Ako bi zadatak počeo ranije, pomakne se na taj datum. Ako je datum raniji od onoga što dopuštaju ovisnosti, ograničenje ne radi ništa.
- *Ne završiti prije (FNET)*: isto, ali za završetak zadatka.
- *Ne početi kasnije od (SNLT)* i *Ne završiti kasnije od (FNLT)*: gornja granica za početak ili završetak. Ne pomiču ništa. Ako granica nije ispunjena, aplikacija prijavljuje prekršeno ograničenje i vremenska rezerva postaje negativna.
- *Mora započeti na (MSO)* i *Mora završiti na (MFO)*: donja i gornja granica istodobno. Zadatak se pomakne na datum ako je on kasniji od onoga što traže ovisnosti. Ako je datum raniji od onoga što dopuštaju ovisnosti, zadatak ostaje tamo gdje ga stavljaju ovisnosti, a vremenska rezerva postaje negativna.

Ako datum padne u subotu, nedjelju ili neradni dan, aplikacija ga čita kao radni dan: donja granica (SNET, FNET) kao sljedeći radni dan, a gornja granica (SNLT, FNLT) kao prethodni.

### Što znači negativna vremenska rezerva

Gornja granica djeluje unatrag. Ako ograničenje stavi kasni datum zadatka prije njegova ranog datuma, ukupan slobodni hod postaje negativan. Isto vrijedi i za zadatke prije njega: ako zadatak brickwork mora započeti najkasnije do petka, 11. lipnja, a ne može početi prije ponedjeljka, 14. lipnja, zadaci prije zadatka brickwork kasne također jedan radni dan. Svi zadaci s negativnom vremenskom rezervom su kritični; način na koji to funkcionira objašnjen je u [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad).

Trake se zbog gornje granice ne pomiču. Sukob vidite u negativnoj vrijednosti polja *Ukupan slobodni hod*, u crvenom rombu iznad trake, u obavijesti na traci stanja (na primjer *Prekršena ograničenja: 1*) i na panelu *Upozorenja*.

### Tvrdo fiksiranje

Uz MSO i MFO pojavljuje se potvrdni okvir *Obvezno (logika fiksiranja)*. Ako ga označite, zadatak fiksirate na datum, čak i ako njegovi prethodnici do tada nisu završeni. Ovisnosti se nadjačavaju:

- Zadatak je na datumu (uz MSO tamo počinje, uz MFO tamo završava) i preklapa se s prethodnicima.
- Prethodnici dobivaju negativnu vremensku rezervu, a aplikacija prijavljuje prekršeno ograničenje čim bi ovisnosti dopustile da zadatak počne kasnije od fiksiranja. Sam fiksirani zadatak zadržava vremensku rezervu 0.
- Nasljednici se izračunavaju iz fiksiranog zadatka. Zato mogu početi ranije nego bez fiksiranja, iako logika prije njega nije završena. U primjeru u nastavku završetak projekta se zbog toga pomakne unaprijed za tri radna dana.

Prvi put kad uključite fiksiranje, aplikacija prikaže kratko objašnjenje: tvrdo fiksiranje nadjačava ovisnosti, traka je fiksirana na datumu, čak i prije svojih prethodnika.

### Sekundarno ograničenje

Zadatak ima jedno primarno ograničenje. Ako želite i drugu granicu, na primjer zadatak koji ne smije početi prije 14. lipnja i mora biti završen najkasnije 17. lipnja, dodajte **sekundarno ograničenje**. Mora biti prava granica (SNET, FNET, SNLT ili FNLT) i mora graničiti u suprotnom smjeru od primarnog: donja granica (SNET ili FNET) s gornjom granicom (SNLT ili FNLT). SNET sa SNLT je zato dopušten, SNET s FNET nije. Aplikacija druge kombinacije označava crveno, s razlogom, na primjer *Primarno i sekundarno ograničenje ne smiju ograničavati istu stranu.* Uz ASAP, ALAP, MSO, MFO i tvrdo fiksiranje sekundarno ograničenje nije dopušteno.

### Rok za dovršetak

Rok za dovršetak je zaseban datum zadatka, uz ograničenje. To je gornja granica za završetak: ništa ne pomiče, ali vremensku rezervu čini negativnom ako zadatak nije završen na vrijeme. Aplikacija tada na panelu *Upozorenja* prijavljuje *Rok za dovršetak … propušten — najraniji završetak …*, a traka stanja broji propuštene rokove. U prikazu Gantt nalazi se strelica prema dolje na datumu roka: zelena dok je zadatak završen na vrijeme, crvena čim kasni. Rok za dovršetak u subotu računa se do uključivo prethodnog petka.

Za vremensku rezervu rok za dovršetak radi isto kao FNLT. Razlika je u načinu upotrebe. Rok za dovršetak je ciljni datum koji želite čuvati. Stoji odvojeno od ograničenja, pa zadatak može imati i ograničenje i rok za dovršetak. FNLT je ograničenje: kršenje se pojavljuje kao prekršeno ograničenje, a ne kao propušten rok za dovršetak.

### Što ograničenje ne radi

- Na **fazi** (zadatak sažetka) ograničenje ili rok za dovršetak se ne računa: aplikacija izračunava s zadacima u fazi. Stavite ga na sam zadatak.
- Zadatak koji već ima stvarni početak ili napredak zadržava taj početak. SNET s kasnijim datumom ga ne pomiče.
- **Upisivanje datuma početka** kod zadatka s prethodnikom ne funkcionira kao fiksni početak: prethodnik i dalje odlučuje. Zato aplikacija to pretvara u SNET na datum koji ste upisali, na panelu *Svojstva*, u dijalogu *Uredi zadatak*, u tablici i kad pomaknete traku u prikazu Gantt. Aplikacija vas o tome obavještava. Ako zadatak već ima neko drugo ograničenje (na primjer ALAP ili MSO), aplikacija novi početak ne primjenjuje i o tome vas također obavještava; zatim promijenite to ograničenje.

Sve promjene se prikazuju tek nakon naredbe **Izračunaj** (F5).

## Razrađeni primjer

Primjer je mala mreža za dogradnju kuće. Projekt počinje u ponedjeljak, 7. lipnja 2027. godine:

- *Groundwork* (3 radna dana): od ponedjeljka, 7. do srijede, 9. lipnja.
- *Pour foundation* (2): četvrtak, 10. i petak, 11. lipnja.
- *Brickwork* (5): od ponedjeljka, 14. do petka, 18. lipnja.
- *Roofing* (3): od ponedjeljka, 21. do srijede, 23. lipnja.
- *Scaffolding* (2): slijedi *Pour foundation* i dolazi prije *Roofing*. Odvija se u ponedjeljak, 14. i utorak, 15. lipnja i ima 3 radna dana vremenske rezerve.

Kritični put čine *Groundwork*, *Pour foundation*, *Brickwork* i *Roofing*. Projekt je gotov u srijedu, 23. lipnja. Što se mijenja s jednim ograničenjem na *Brickwork*?

- **SNET ponedjeljak, 21. lipnja** (opeka tek tada stiže): *Brickwork* teče od ponedjeljka, 21. do petka, 25. lipnja, *Roofing* od ponedjeljka, 28. do srijede, 30. lipnja. Projekt je gotov u srijedu, 30. lipnja. *Groundwork* i *Pour foundation* sada imaju 5 radnih dana vremenske rezerve i više nisu kritični, *Scaffolding* ima 8.
- **SNET srijeda, 9. lipnja**: bez učinka. Ovisnosti svejedno dopuštaju da *Brickwork* počne tek u ponedjeljak, 14. lipnja.
- **SNLT srijeda, 16. lipnja**: bez učinka. *Brickwork* počinje u ponedjeljak, 14. lipnja i lako ispunjava granicu.
- **SNLT petak, 11. lipnja**: previše usko. *Brickwork* ipak počinje u ponedjeljak, 14. lipnja, jedan radni dan kasnije. *Groundwork*, *Pour foundation* i *Brickwork* dobivaju −1 radni dan vremenske rezerve, a aplikacija prijavljuje *Logika nadjačava ograničenje Ne početi kasnije od (SNLT) 11-06-2027 (negativna vremenska rezerva)*. Ništa se ne pomiče.
- **MSO srijeda, 16. lipnja** (bez tvrdog fiksiranja): *Brickwork* se pomakne na srijedu, 16. lipnja i završava u utorak, 22. lipnja. *Roofing* teče od srijede, 23. do petka, 25. lipnja, projekt je gotov u petak, 25. lipnja.
- **MSO petak, 11. lipnja** (bez tvrdog fiksiranja): datum je raniji od onoga što dopuštaju ovisnosti. *Brickwork* ipak počinje u ponedjeljak, 14. lipnja, a vremenska rezerva postaje −1, kao i kod SNLT.
- **MSO srijeda, 9. lipnja s tvrdim fiksiranjem**: *Brickwork* počinje u srijedu, 9. lipnja i završava u utorak, 15. lipnja, dok *Pour foundation* i dalje traje do petka, 11. lipnja. *Roofing* teče od srijede, 16. do petka, 18. lipnja: projekt je gotov tri radna dana ranije nego bez fiksiranja. *Groundwork* i *Pour foundation* dobivaju −3 radna dana vremenske rezerve.

Isto tako, s ograničenjem ili rokom za dovršetak na drugom zadatku:

- **ALAP na** *Scaffolding*: zadatak se pomakne na četvrtak, 17. i petak, 18. lipnja, što je najkasniji trenutak prije *Roofing*. *Roofing* je njegov jedini nasljednik i imao je prostora za točno svoja 3 radna dana vremenske rezerve; ti su dani sada iskorišteni i *Scaffolding* je kritičan.
- **SNET subota, 19. lipnja na** *Scaffolding*: granica se računa kao ponedjeljak, 21. lipnja. *Scaffolding* se odvija u ponedjeljak, 21. i utorak, 22. lipnja, a *Roofing* se pomiče zajedno na srijedu, 23. do petka, 25. lipnja.
- **Rok za dovršetak petak, 18. lipnja na** *Roofing*: ništa se ne pomiče, *Roofing* ostaje od ponedjeljka, 21. do srijede, 23. lipnja. *Groundwork*, *Pour foundation*, *Brickwork* i *Roofing* dobivaju −3 radna dana vremenske rezerve, a aplikacija prijavljuje *Rok za dovršetak 18-06-2027 je propušten. Najraniji završetak: 23-06-2027*. *Scaffolding* zadržava 0 radnih dana vremenske rezerve i također postaje kritičan.
- **SNET ponedjeljak, 21. lipnja na** *Brickwork*, **rok za dovršetak petak, 25. lipnja na** *Roofing*: ograničenje pomakne brickwork za tjedan dana kasnije, a rok prijavljuje da *Roofing* kasni u srijedu, 30. lipnja. *Brickwork* i *Roofing* dobivaju −3 radna dana vremenske rezerve; *Groundwork* i *Pour foundation* zadržavaju 2 radna dana vremenske rezerve.

U lekciji 3 sami postavljate ograničenje i rok za dovršetak u projektu za lekciju i vidite kako se raspored pomiče.

## Posljedice i zablude

**„Ograničenje pomiče zadatak.“** Samo SNET, FNET, MSO i MFO mogu zadatak staviti kasnije nego što to traže njegove ovisnosti, a ALAP ga može pomaknuti kasnije unutar svog slobodnog hoda. SNLT i FNLT nikad ništa ne pomiču: samo upozoravaju. Ispunjavanje datuma tada znači skraćivanje lanca prije njega.

**„Negativna vremenska rezerva je greška u aplikaciji.“** To je signal da raspored proturječi vašem dogovoru o datumu. Rješavate ga skraćivanjem lanca, ublažavanjem dogovora ili namjernim prihvaćanjem sukoba.

**„Tvrdo fiksiranje rješava sukob.“** Tvrdo fiksiranje skriva sukob: zadatak je na datumu, ali njegovi prethodnici za to nisu spremni, a nasljednici se izračunavaju kao da jesu. Koristite ga samo za datum koji je zaista fiksan, na primjer za pravni datum predaje, a ne kao način da zadatak stavite na datum.

**„Samo upišem datum početka.“** Kod zadatka s prethodnikom to postaje SNET. Ako je taj datum raniji od onoga što prethodnik dopušta, ne radi ništa.

**„Rok za dovršetak ili FNLT?“** Za ciljni datum koji želite čuvati odaberite rok za dovršetak, a za datum koji je zaista granični uvjet za raspored ograničenje.

**„Ograničenje na fazi.“** To se ne računa. Stavite ga na sam zadatak.

## Vidi također

- [Postavljanje ograničenja ili roka za dovršetak](docs://howto-constraint-deadline-zetten): koraci za postavljanje ograničenja ili roka za dovršetak.
- [Ovisnosti i vrijeme odgode](docs://uitleg-relaties): ovisnosti uz koje stoje ograničenja.
- [Kritični put i vremenska rezerva](docs://uitleg-kritiek-pad): kako nastaje negativna vremenska rezerva i što ona čini s kritičnim putem.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): tvrdo fiksiranje (*Mora započeti na*) na *Municipal road closure (permitted closure period)* i sekundarno ograničenje (*Ne početi kasnije od*) na *Lift supply & installation — Tower A*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): rok za dovršetak koji nije ispunjen, s negativnom vremenskom rezervom.
