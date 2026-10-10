# Gestionarea resurselor

Scop: creați, editați și ștergeți resurse (persoane, mașini și materiale) în proiectul dumneavoastră, pentru a le putea atribui activităților.

## Când aveți nevoie de aceasta

Înainte să atribuiți un zidar sau o macara unei activități, persoana sau mașina respectivă trebuie să existe ca resursă. Resursa înregistrează câtă resursă există și în ce zile lucrează. Astfel, aplicația determină dacă solicitați prea mult din ea într-o zi. Editați o resursă când se modifică personalul, de exemplu când se alătură un al doilea zidar.

Doi termeni. **Capacitate maximă** este capacitatea pe zi lucrătoare: 1 înseamnă o persoană sau o mașină, 2 înseamnă două dintre ele. O **atribuire** este o resursă pe o activitate (vezi [Atribuirea resurselor cu o curbă](docs://howto-resource-toewijzen)).

## Pași

### Crearea unei resurse

1. Alegeți *Resurse › Gestionare › Resursă nouă*. Panoul de resurse preia spațiul de lucru, iar la baza tabelului apare un rând gol. Puteți deschide panoul și cu *Resurse › Gestionare › Resurse*, apoi alegeți *Resursă nouă în proiect*.
2. Introduceți numele, de exemplu *Bricklayer*.
3. Alegeți *Tip*: *Forță de muncă* (implicit), *Utilaj*, *Material*, *Subcontractant* sau *Echipă*.
4. Completați celelalte câmpuri, dacă este necesar. Toate au o valoare implicită: *Capacitate maximă* este 1, iar *Calendar* este *Calendar de proiect*. *Tarif standard/oră* este gol. Puteți completa *Unitate de măsură* numai pentru tipul *Material*, de exemplu m³.
5. Apăsați Enter sau faceți clic în afara rândului. Resursa apare în tabel. Cu Enter, sub ea se deschide imediat un rând gol pentru următoarea resursă. Apăsați Esc când ați terminat.

Rândul devine resursă abia când are un nume. Cu Esc, sau dacă faceți clic în afară fără un nume, aplicația nu creează nimic. Ordinea în care completați lucrurile nu contează: puteți alege mai întâi tipul și apoi să scrieți numele.

### Editarea unei resurse

Editați câmpurile din rând. Aplicația salvează numele, tariful și unitatea când părăsiți câmpul, iar celelalte câmpuri imediat.

- *Capacitate maximă* este acceptată de aplicație numai dacă valoarea este mai mare decât 0. Cu 0 sau mai puțin, câmpul primește o margine roșie și revine la valoarea anterioară.
- *Calendar* stabilește în ce zile lucrează resursa. Alegeți *Calendar de proiect* sau un calendar propriu. Cu *+ Calendar de resursă* creați unul nou, iar creionul (*Editare…*) deschide calendarul ales. Dacă o activitate lucrează într-o zi în care resursa este liberă conform calendarului său, ziua respectivă se consideră supraalocată. Cum se creează un calendar de resursă este descris în [Configurarea unui calendar de resursă](docs://howto-resourcekalender-instellen).
- *Tarif standard/oră* și *Total*: *Total* este numărul de ore încărcate ale acelei resurse înmulțit cu tariful. Un gletar încărcat cu 32 de ore, cu un tarif de 50 pe oră, ajunge la 1,600.00. În partea de jos a tabelului este suma tuturor resurselor.
- *Echipă* grupează o resursă sub o resursă de tipul *Echipă*. Este doar o grupare: aplicația nu adună capacitatea sau încărcarea membrilor în echipă.
- Pătrățelul colorat din stânga este culoarea resursei. Este doar pentru afișare și nu are niciun efect asupra planificării.

### Capacitate care se modifică în timp

Al doilea zidar ajunge abia pe 19 iulie? Faceți clic pe săgeata de lângă *Capacitate maximă*. Sub *Capacitate pe etape de timp*, alegeți *Adăugare pas*. Fiecare pas are o dată (*De la*) și un număr (*Capacitate maximă*). De la acea dată se aplică acel număr. Fără pași se aplică mereu valoarea fixă.

Un pas nou începe cu data de azi și cu valoarea 1 pentru *Capacitate maximă*. Modificați ambele, deoarece altfel o capacitate de 1 se aplică de azi.

### Ștergerea unei resurse

1. Faceți clic pe coșul de gunoi din rând.
2. Dacă resursa are atribuiri, aplicația cere confirmare, de exemplu *„Bricklayer” are 4 atribuire(i) — ștergeți?* Faceți clic pe bifă pentru a șterge sau pe cruce pentru a anula. Fără atribuiri, resursa dispare imediat.

Atribuirile resursei dispar odată cu ea. Dacă o activitate are o regulă de lucru, altă decât *Durată fixă și unități fixe*, aplicația împarte lucrul resursei șterse între resursele rămase. În funcție de regulă, se modifică unitățile de atribuire ale acestora sau durata activității. Dacă se modifică durata, planificarea dumneavoastră nu mai este actualizată.

Puteți anula crearea, editarea și ștergerea cu *Anulare* (Ctrl+Z).

### Vederea rezumată din coloana laterală

*Resurse › Gestionare › Andocare resurse* afișează un rezumat compact în coloana din dreapta, lângă *Proprietăți*. Acolo vedeți numele și culoarea fiecărei resurse și un semn de avertizare (*Supraalocată*) lângă o resursă supraalocată. Acolo puteți modifica doar *Capacitate maximă*. Dacă selectați una sau mai multe activități, rezumatul arată doar resursele acelor activități.

## Capcane și ce face aplicația atunci

**Doar tipul *Material* face diferență la calcul.** Forța de muncă, Utilaj, Subcontractant și Echipă sunt tratate la fel. Materialul nu influențează durata unei activități și nu este nivelat. În histogramă, rândul *Toate resursele* nu include nici el materialul.

**Fără nume, fără resursă.** Un rând gol dispare fără urmă.

**Un pas nou în capacitate.** Dacă uitați să modificați data și numărul, capacitatea este 1 începând de azi.

**Ștergerea unei resurse de care mai aveți nevoie.** Dacă o ștergeți din greșeală, apăsați imediat Ctrl+Z. Atribuirile revin și ele.

## Vedeți și

- [Atribuirea resurselor cu o curbă](docs://howto-resource-toewijzen): punerea unei resurse pe o activitate.
- [Configurarea unui calendar de resursă](docs://howto-resourcekalender-instellen): fixarea zilelor lucrătoare ale unei resurse.
- [Rezolvarea supraalocării](docs://howto-overbezetting-oplossen): ce faceți când o resursă are prea multe de făcut într-o zi.
- [Panoul de resurse](docs://ref-resourcepaneel): toate câmpurile și butoanele panoului de resurse.
