# Activarea planificării pe ore

Scop: planificați activități în ore de lucru, alături de activități în zile.

## Când aveți nevoie de aceasta

Închiriați o macara pe oră, nu pe zi. O turnare de șase ore nu încape într-o zi lucrătoare întreagă. O echipă de noapte lucrează în alte ore decât echipa de zi. Pentru astfel de lucrări doriți o durată în ore, cu o oră de început și una de sfârșit. Activați planificarea pe ore și dacă deschideți un fișier, iar aplicația afișează *Acest fișier conține planificare pe ore.* Puteți citi motivul pentru care aplicația numără zilele și orele diferit în [Zile și ore](docs://uitleg-dagen-en-uren).

## Pași

### Pornirea planificării pe ore

1. Alegeți *Setări › Proiect › Setări* și deschideți fila *Planificare*.
2. Sub *Planificare pe ore*, bifați *Activare planificare pe ore*. Setarea intră în vigoare imediat. În mesajul *Acest fișier conține planificare pe ore.* butonul *Activare planificare pe ore* face același lucru.
3. Mai jos se află *Permitere planificare pe ore și zile combinate*, activată implicit. Cu această setare alegeți pentru fiecare activitate dacă se numără în zile sau în ore. Dacă o dezactivați, lista *Unitate de durată* dispare. Puteți totuși introduce o durată cu unitate, de exemplu `12h`.

Această setare schimbă mai mult decât durata unei activități: sub *Vizualizare › Scară de timp* puteți alege scara *Oră*, fereastra *Calendare* primește blocul *Ore de lucru*, iar fereastra *Creare proiect nou* primește opțiunile *Tură* și *Unitate implicită pentru activități noi*.

### Planificarea unei activități pe ore

1. Selectați activitatea și uitați-vă în panoul *Proprietăți*, sub *Timp*, la câmpul *Durată*.
2. Introduceți durata cu o unitate și apăsați Enter: `12h` (`12u`, abrevierea olandeză, funcționează și ea) pentru douăsprezece ore, `1h 30m` pentru o oră și jumătate. Și `1.5h` este corect. Un număr fără unitate se numără în unitatea pe care o are deja activitatea.
3. Dacă doriți să convertiți o activitate existentă, alegeți unitatea *Ore* sub *Unitate de durată*. Aplicația calculează durata și o propune, de exemplu *Propunere de conversie exactă: 16h. Aplicați propunerea sau păstrați unitatea curentă.* Alegeți *Aplicare propunere* sau *Păstrare*.
4. Trecerea înapoi la zile este posibilă cu `2d` sau cu unitatea *Zile*.
5. Apăsați **Calculare** (F5), de exemplu prin *Acasă › Planificare › Calculare*. Activitatea primește acum o oră de început și una de sfârșit.
6. Dacă doriți să vedeți orele în Gantt, alegeți scara *Oră* din lista de sub *Vizualizare › Scară de timp*.

### Activități noi pe ore în mod implicit

1. Alegeți *Setări › Proiect › Informații proiect*.
2. Sub *Unitate implicită pentru activități noi*, alegeți unitatea *Ore* și faceți clic pe *Aplicare*.

Activitatea nouă are atunci o durată de 5 ore, nu de 5 zile. Activitățile existente nu se schimbă. La un proiect nou, aceeași alegere se află în fereastra *Creare proiect nou*. Dacă alegeți aici *Tură de zi* sub *Tură*, opțiunea *Ore* este dezactivată. Alegeți o altă tură sau setați unitatea implicită după creare, în *Informații proiect*.

## Capcane și ce face aplicația atunci

**Fără timp de lucru valid.** Dacă din calendarul activității lipsește timp de lucru utilizabil, aplicația afișează *Acest calendar nu are ore de lucru valide. Verificați zilele lucrătoare și orele de lucru.* La calculare poate apărea mesajul *Activitatea pe ore 'name' nu are ore de lucru valide în calendarul său.*

**Fără zecimale la zile.** O durată în zile este un număr întreg. `1.5d` afișează mesajul *Introduceți un număr întreg de zile sau de ore, de exemplu 2d sau 12h.* Dacă doriți o zi și jumătate, calculați în ore.

**O conversie care nu poate fi exactă.** Douăsprezece ore nu încap în zile întregi de 8 ore. Aplicația afișează atunci *Această durată nu poate fi convertită exact în zile întregi în calendarul curent. Unitatea existentă rămâne; introduceți o nouă valoare validă.* și păstrează unitatea.

**Câmpul este dezactivat.** Pentru o fază, un hamac sau un jalon cu durată zero, durata rezultă din altceva și nu o puteți introduce.

**Dezactivarea planificării pe ore.** Activitățile pe ore rămân și se calculează în continuare. Durata lor nu poate fi editată atunci; câmpul afișează *Activați planificarea pe ore pentru a edita această activitate pe ore.*, cu un buton pentru a o activa din nou.

## Vezi și

- [Zile și ore](docs://uitleg-dagen-en-uren): cum numără aplicația orele, ce se întâmplă când se întâlnesc zilele și orele și unde rotunjește.
- [Setarea timpilor de lucru](docs://howto-werktijden-instellen): timpii unui calendar pe zile ale săptămânii.
- [Adăugarea dependențelor](docs://howto-relaties-leggen): un decalaj în ore între două activități.
- [Setări](docs://ref-instellingen): setarea Activare planificare pe ore și ce mai schimbă ea.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): conține activități pe ore (rebar fixing and pouring) cu un calendar pe ore propriu, *Hourly calendar, rebar fixing & pouring*.
