# Drum critic și marjă

De ce are proiectul dumneavoastră data de sfârșit pe care o are? Și ce activitate poate întârzia o zi, fără ca predarea să se mute? Acestea sunt întrebările din spatele drumului critic. Acest articol explică exact ce calculează aplicația, folosind un exemplu rezolvat.

## Conceptul

O planificare este o rețea de activități legate prin **dependențe**: înțelegeri, cum ar fi „tâmplăria se montează abia după ce acoperișul este închis”. Aceste dependențe leagă activitățile între ele. Unele lanțuri de activități sunt mai lungi decât altele. Cel mai lung lanț stabilește cât durează tot proiectul.

Acest lanț cel mai lung este **drumul critic**. Dacă o activitate de pe el întârzie o zi, predarea se mută o zi. Pe el nu există timp liber.

Activitățile din afara drumului critic au timp liber. Acest timp se numește **marjă**. Zidarul care lucrează la zidul exterior ar putea începe cu două zile mai târziu, fără ca cineva să observe. Aceste două zile sunt marja acelei activități.

Deci termenul „critic” nu spune nimic despre importanța unei activități. Spune doar că nu există timp de rezervă.

Metoda de calcul se numește **CPM** (Critical Path Method). De aceea blocul cu rezultatele din panoul *Proprietăți* se numește *Rezultat CPM*.

## Cum calculează aplicația

Aplicația nu recalculează planificarea singură. Calculul începe cu **Calculare** (F5), de exemplu prin *Acasă › Planificare › Calculare*. Dacă ceva s-a schimbat de la ultimul calcul, bara de stare arată *Învechit — recalculați (F5)*. Dacă *Calculare automată* este activată (sub *Setări › Proiect › Setări*, fila *Planificare*, secțiunea *Calculare*), aplicația face asta singură.

Un calcul parcurge rețeaua de două ori.

### Parcurgerea înainte

Aplicația pornește de la începutul proiectului și urmează dependențele de la predecesor la succesor. Pentru fiecare activitate, aplicația găsește cea mai devreme zi la care activitatea poate începe. Dacă o activitate are mai mulți predecesori, ea așteaptă terminarea ultimului. Așa primește fiecare activitate **începutul cel mai devreme** și **sfârșitul cel mai devreme**. Cel mai mare sfârșit cel mai devreme dintre toate activitățile este sfârșitul proiectului.

### Parcurgerea înapoi

Apoi aplicația parcurge rețeaua înapoi, de la acel sfârșit al proiectului până la început. Acum aplicația găsește, pentru fiecare activitate, ultima zi până la care activitatea trebuie terminată, fără să mute sfârșitul proiectului. Dacă o activitate are mai mulți succesori, contează cel care trebuie să înceapă primul. Așa se obțin **începutul târziu** și **sfârșitul târziu**.

### Marja totală și marja liberă

Diferența dintre datele târzii și cele mai devreme ale unei activități este **marja totală**: numărul de zile lucrătoare cu care activitatea poate întârzia sau începe mai târziu, până când sfârșitul proiectului se mută. Aplicația numără zilele lucrătoare din calendarul activității. Un sfârșit de săptămână sau o sărbătoare nu se numără.

**Marja liberă** este mai strictă. Este timpul pe care îl are o activitate înainte ca unul dintre succesorii săi să trebuiască să înceapă mai târziu. Puteți folosi acest timp fără ca vreo altă activitate să observe.

Marja totală poate fi împărțită. Dacă două activități necritice urmează una după alta, ele împart aceeași marjă. Dacă prima o consumă, a doua nu mai are marjă. Prima are atunci marjă totală, dar nicio marjă liberă. Partea marjei totale care nu este liberă se numește **marjă de interferență**: dacă o folosiți, se mută și activitățile care urmează. Exemplul de mai jos arată acest lucru cu cifre.

### Marjă negativă

Marja poate deveni și negativă. Aceasta se întâmplă când o activitate are un termen limită. Sau când o restricție impune o dată cea mai târzie, înainte de data pe care aplicația o calculează. Pe hârtie, activitatea este deja întârziată. Activitatea și lanțul dinaintea ei devin critice.

### Când este o activitate critică?

Implicit, o activitate este critică atunci când marja ei totală este 0 sau mai mică. Acest lucru se poate modifica sub *Setări › Proiect › Informații proiect*, în blocul *Profil de calcul și opțiuni de calcul*, la *Opțiunile de calcul ale acestui proiect*. Când faceți clic pe *Aplicare*, aplicația recalculează planificarea imediat. Opțiunile aparțin fișierului de proiect, nu aplicației.

- **Definiția activității critice** cu *Marjă totală ≤ prag* și câmpul *Prag (zile lucrătoare)*. Pragul este implicit 0. Pentru a păstra o rezervă, setați-l la 2, de exemplu: fiecare activitate cu cel mult 2 zile lucrătoare de marjă devine critică și bara devine roșie.
- **Marcare activități aproape critice** cu propriul *Prag*, implicit 2 zile lucrătoare. O activitate cu o marjă mai mare decât 0, dar cel mult atât, primește o bară chihlimbarie. Așa se vede ce activități mai au aproape deloc marjă, fără să fie numite critice.
- **Activități cu sfârșit deschis, critice**: o activitate fără succesor, care nu este încă terminată, devine critică. Este util ca plasă de siguranță împotriva dependențelor uitate (vezi concepțiile greșite de mai jos).
- **Calculul marjei** decide dacă marja totală se măsoară la începutul activității, la sfârșitul ei sau ca cea mai mică dintre cele două. Proiectele noi au setarea *Automat (implicit)*. Dacă urmați modul de calcul din Primavera P6, *Aplicare opțiuni implicite ale acestui profil* setează această opțiune pe *Marjă de sfârșit*. Pentru MS Project, același buton o readuce la *Automat (implicit)*: cu data raportului de stare, MS Project calculează singur astfel.

### Unde vedeți asta

Activitățile critice au o bară roșie în Gantt. În spatele unei bare necritice există o bandă verde până la sfârșitul târziu al activității: aceasta este marja. Banda se activează sau se dezactivează cu *Vizualizare › Referințe și progres › Bandă de marjă*.

Pentru o activitate selectată, panoul *Proprietăți* listează totul sub *Rezultat CPM*: începutul și sfârșitul cel mai devreme, precum și cele târzii, marja totală, marja liberă și marja de interferență, plus dacă activitatea se află pe drumul critic. Marjele tuturor activităților, una lângă alta, se află în coloanele de sub *Calculat* (semnul **+** din dreapta antetului tabelului), precum *Marjă totală*, *Marjă liberă*, *Critic* și *Aproape critic*.

Bara de stare din partea de jos numără activitățile critice, de exemplu *Drum critic: 21 de activități, 45 de zile lucrătoare*.

## Exemplu rezolvat: House extension

Exemplul este proiectul de exercițiu din tutoriale, *House extension*, așa cum arată după ce toate dependențele sunt stabilite. În tutorialul 2, „Dependențe și drumul critic”, construiți singur acest proiect și verificați cifrele. Aici citiți de ce sunt cifrele așa cum sunt.

Extinderea începe luni, 7 iunie 2027. După calcul, predarea este vineri, 6 august 2027, iar bara de stare arată *Drum critic: 21 de activități, 45 de zile lucrătoare*. Două activități nu sunt critice: *Build outer cavity leaf* și *Painting*.

### Două lanțuri care se întâlnesc

După placa structurală (*Lay hollow-core floor*, terminată luni, 28 iunie), lucrarea se împarte în două lanțuri. Ambele se termină la *Install window frames*:

- Partea interioară: *Build inner cavity leaf* (5 zile lucrătoare), apoi *Place roof elements* (1), apoi *Apply roofing* (2). Tâmplăria se poate monta abia după ce acoperișul este închis.
- Partea exterioară: *Build outer cavity leaf* (6 zile lucrătoare). Tâmplăria se află în fațadă, deci și această activitate trebuie terminată.

**Înainte.** Ambele ziduri cu gol pot începe marți, 29 iunie. Zidul interior se termină luni, 5 iulie. Elementele de acoperiș se montează marți, 6 iulie. Lucrările de acoperiș urmează miercuri, 7 iulie, și joi, 8 iulie. Zidul exterior se termină marți, 6 iulie. *Install window frames* așteaptă ca ultimul dintre cele două lanțuri, acoperișul, să se termine, și astfel începe vineri, 9 iulie.

**Înapoi.** Tâmplăria trebuie să înceapă la vineri, 9 iulie, cel mai târziu, altfel predarea se mută. Deci zidul exterior trebuie terminat cel mai târziu joi, 8 iulie. Șase zile lucrătoare înapoi, rezultă un început târziu joi, 1 iulie.

**Marjă.** Zidul exterior poate începe cel mai devreme marți, 29 iunie, și trebuie să înceapă cel mai târziu joi, 1 iulie. Între ele sunt 2 zile lucrătoare: miercuri, 30 iunie, și joi, 1 iulie. Aceasta este marja totală. Panoul arată *Marjă totală: 2 zile* și *Drum critic: Nu*. Marja liberă este tot de 2 zile, deoarece singurul său succesor, *Install window frames*, se află pe drumul critic.

Lanțul interior nu are marjă. Fiecare zi de întârziere de acolo mută tâmplăria și tot ce urmează după ea.

### Painting

*Painting* (3 zile lucrătoare) începe după tencuială, luni, 26 iulie, și se termină miercuri, 28 iulie. Următoarea activitate, *Snagging and cleaning*, așteaptă și ea placarea cu gresie. Placarea se termină abia joi, 5 august, deoarece șapa trebuie să se usuce întâi cinci zile lucrătoare. Deci painting poate continua până joi, 5 august. Rezultă 6 zile lucrătoare de marjă: 29 și 30 iulie, și 2 până la 5 august. Și aici marja liberă este egală cu marja totală, deoarece succesorul este critic.

### Când zidul exterior întârzie

Dacă zidul exterior ia 8 zile lucrătoare în loc de 6, se termină joi, 8 iulie: exact la sfârșitul târziu al activității. Marja dispare, iar activitatea devine roșie. Atunci ambele lanțuri sunt critice, iar bara de stare numără 22 de activități critice. Predarea rămâne vineri, 6 august.

Dacă ia 9 zile lucrătoare, zidul exterior se termină abia vineri, 9 iulie. Tâmplăria se mută pe luni, 12 iulie, iar predarea pe luni, 9 august: cu o zi lucrătoare mai târziu. Lanțul exterior este acum drumul critic. Bara de stare arată *Drum critic: 19 activități, 46 de zile lucrătoare*.

Lanțul interior are atunci 1 zi lucrătoare de marjă totală, dar această zi este împărțită:

- *Build inner cavity leaf*: marjă totală 1, marjă liberă 0, marjă de interferență 1. Dacă zidul interior întârzie o zi, elementele de acoperiș se mută odată cu el.
- *Place roof elements*: marjă totală 1, marjă liberă 0, marjă de interferență 1.
- *Apply roofing*: marjă totală 1, marjă liberă 1. Doar aici o întârziere de o zi nu costă pe nimeni nimic.

Este aceeași zi, împărțită de tot lanțul. Dacă zidul interior o folosește, ea dispare pentru elementele de acoperiș și pentru lucrările de acoperiș.

### Aproape critic și marjă negativă

Cu *Marcare activități aproape critice* activat, la pragul implicit de 2 zile lucrătoare, zidul exterior, cu exact 2 zile de marjă, primește o bară chihlimbarie. Painting, cu 6 zile, rămâne albastră.

Dacă predarea primește un termen limită miercuri, 4 august, cu două zile lucrătoare înainte de predarea calculată, marja devine negativă. Toate cele 21 de activități de pe drumul critic primesc o marjă totală de −2 zile lucrătoare. Zidul exterior nu mai are marjă și devine și el critic. Painting păstrează o marjă de 4 zile lucrătoare.

## Consecințe și concepții greșite

**„Critic înseamnă important.”** Nu. Un control poate fi esențial și totuși să aibă marjă. Invers, o lucrare simplă poate fi critică: în exemplu, *Snagging and cleaning* se află pe drumul critic. „Critic” se referă numai la timp: nu mai există timp de rezervă.

**„Această activitate are marjă, deci poate aștepta.”** Uitați-vă întâi la marja liberă. Dacă o activitate are marjă totală, dar nu are marjă liberă, fiecare zi de întârziere ia marjă din activitățile care urmează, ca în cazul zidului interior din varianta cu 9 zile lucrătoare.

**O dependență uitată dă marjă falsă.** O activitate fără succesor primește marjă până la sfârșitul proiectului. Dacă în exemplu ar lipsi dependența dintre zidul exterior și tâmplărie, zidul exterior ar avea deodată 23 de zile lucrătoare de marjă, până la predarea de vineri, 6 august. Pe hârtie, ar putea întârzia săptămâni întregi fără ca tâmplăria să aștepte. Cu *Activități cu sfârșit deschis, critice* activat, zidul exterior devine critic în acest caz, iar golul se vede.

**Drumul critic nu este fix.** Dacă o activitate necritică întârzie mai mult decât marja ei, alt lanț devine cel mai lung. Ați văzut asta mai sus, cu 9 zile lucrătoare de zidărie. Deci planificarea trebuie recalculată după fiecare modificare. Atât timp cât bara de stare arată *Învechit — recalculați (F5)*, barele roșii aparțin încă calculului precedent.

**Marja se măsoară în zile lucrătoare.** Cele 6 zile lucrătoare de marjă ale activității painting merg de joi, 29 iulie, până joi, 5 august: opt zile calendaristice, deoarece sfârșitul de săptămână nu se numără. Nicio sărbătoare publică sau concediu colectiv din construcții din calendar nu se numără.

## Vezi și

- [Adăugarea dependențelor](docs://howto-relaties-leggen): pașii pentru a lega activități și a seta un decalaj.
- [Dependențe și decalaj](docs://uitleg-relaties): cum determină dependențele și decalajul datele cele mai devreme.
- [Restricții și termene limită](docs://uitleg-constraints): cum produce o restricție sau un termen limită marjă negativă.
- [Urmărirea unui drum](docs://howto-pad-traceren): urmărirea lanțului din spatele unei activități.
- [Opțiuni de calcul și convenții de calcul](docs://ref-rekenopties-en-conventies): definiția activității critice, aproape critice și calculul marjei, opțiune cu opțiune.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): un proiect mare cu mai multe drumuri de marjă, lucrări aproape critice (prag 3 zile lucrătoare), un hamac, o fixare fermă și o legătură între proiecte.
