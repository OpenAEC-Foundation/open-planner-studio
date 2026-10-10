# Crearea unui hamac

Obiectiv: creați o activitate care nu are o durată proprie, ci care se întinde de la începutul unei activități până la sfârșitul alteia, de exemplu pregătirea șantierului, supravegherea sau închirierea unei barăci de șantier.

## Când este util

Baraca de șantier stă acolo atât timp cât continuă clădirea, de la prima lucrare de fundație până la predare. Dacă dați acestei activități o durată fixă de 13 zile lucrătoare, ea nu se adaptează atunci când zidăria întârzie, iar planificarea nu mai este corectă. Un **hamac** (numit și *level of effort*) urmează activitățile de care îl legați: începutul său vine dintr-o dependență de început, sfârșitul dintr-o dependență de sfârșit, iar durata este diferența dintre ele.

## Pași

1. Creați activitatea, de exemplu *Site cabin*, sau selectați o activitate existentă. Un jalon și o activitate rezumat (fază) nu pot fi hamac. Pentru o astfel de activitate, în panoul *Proprietăți* și în *Editare activitate* lipsește caseta de bifare, iar în coloana din tabel nu se poate modifica valoarea.
2. Bifați *Hamac (durată derivată)* în panoul *Proprietăți*, în *Editare activitate* (faceți clic dreapta pe activitate, apoi pe *Editare...*) sau în coloana din tabel *Hamac (durată derivată)*, sub *Planificare*. Câmpul *Durată* nu mai poate fi modificat.
3. Adăugați o dependență de la activitatea cu care începe hamacul către hamac, de tip **SS** (hamacul începe împreună cu activitatea respectivă) sau **FS** (hamacul începe după activitatea respectivă). Pentru aceasta, selectați hamacul, faceți clic pe *Adăugare dependență* în *Dependențe*, lăsați direcția pe *Predecesor*, alegeți activitatea și alegeți tipul. Pașii sunt descriși în [Adăugarea dependențelor](docs://howto-relaties-leggen).
4. Adăugați o dependență de la activitatea cu care se termină hamacul către hamac, de tip **FF** (hamacul se termină împreună cu activitatea respectivă) sau **SF**.
5. Consultați panoul *Proprietăți*, sub *Hamac (durată derivată)*: acolo vedeți *Legătură determinantă pentru început* cu activitatea și tipul, și *Legătură determinantă pentru sfârșit* cu activitatea și tipul. O legătură determinantă arată activitatea de la care hamacul preia începutul sau sfârșitul.
6. Apăsați **Calculare** (F5), de exemplu prin *Acasă › Planificare › Calculare*. Hamacul se întinde acum de la începutul activității de la care preia începutul, până la sfârșitul activității de la care preia sfârșitul, iar *Durată* arată durata derivată.

În Gantt, un hamac este o bară subțire de culoare turcoaz, cu un cârlig la ambele capete.

Exemplu: *Site cabin* primește SS de la *Groundwork* (luni, 7 iunie 2027) și FF de la *Roofing* (terminată miercuri, 23 iunie). După **Calculare**, hamacul se întinde de la luni, 7 iunie, până miercuri, 23 iunie: 13 zile lucrătoare. Dacă zidăria întârzie cu 2 zile lucrătoare, sfârșitul activității *Roofing* devine vineri, 25 iunie, iar hamacul se prelungește până la 15 zile lucrătoare.

## Ce face aplicația cu un hamac

- Hamacul nu este niciodată critic și nu are marjă. Nici el nu limitează activitățile de la care preia începutul sau sfârșitul: acestea nu primesc o dată târzie din cauza hamacului.
- Decalajul contează. Cu SS și decalajul `1d`, hamacul începe o zi lucrătoare după legătura determinantă pentru început; cu FF și decalajul `2d`, se termină cu două zile lucrătoare după legătura determinantă pentru sfârșit.

## Capcane și ce face aplicația

**Nicio legătură determinantă pentru sfârșit.** Dacă hamacul nu are o dependență FF sau SF, aplicația nu poate calcula sfârșitul său. Panoul *Proprietăți* afișează *Nicio legătură determinantă pentru sfârșit (FF/SF) — intervalul revine la lungime zero*, iar panoul *Avertismente* afișează *Hamac fără legătură determinantă pentru sfârșit (niciun predecesor FF/SF): durata revine la zero*. Hamacul începe și se termină atunci în aceeași zi. Adăugați o dependență FF sau SF.

**Un hamac care se termină după ultima activitate.** Dacă hamacul continuă până după ultima activitate, de exemplu cu FF și un decalaj de 2 zile lucrătoare, data de sfârșit a proiectului se mută împreună cu el. Activitățile pe care le executați efectiv primesc atunci marjă; niciuna nu mai este critică.

**Activități care așteaptă un hamac.** Dacă adăugați o dependență de la hamac la altă activitate, aceea începe abia după sfârșitul hamacului. Întregul lanț dinaintea hamacului, inclusiv activitățile de la care hamacul preia începutul și sfârșitul, primește atunci marjă și nu mai este critic, deoarece hamacul nu transmite presiune înapoi. Nu lăsați deci activități să aștepte un hamac; legați mai degrabă astfel de activități de legătura determinantă pentru sfârșit a hamacului.

**Introducerea unei durate.** Câmpul *Durată* al unui hamac este derivat și nu poate fi modificat. O durată pe care ați introdus-o înainte de bifarea casetei nu mai contează.

## Vezi și

- [Adăugarea dependențelor](docs://howto-relaties-leggen): pașii pentru a adăuga o dependență de tip SS sau FF.
- [Dependențe și decalaj](docs://uitleg-relaties): ce înseamnă SS și FF și cum se ia în calcul decalajul.
- [Drumul critic și marja](docs://uitleg-kritiek-pad): ce înseamnă critic și cum funcționează marja.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): conține hamacul *Structural works tower A (LOE)*.
