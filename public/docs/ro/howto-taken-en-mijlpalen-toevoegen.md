# Adăugarea activităților și a jaloanelor

Obiectiv: puneți o activitate nouă sau un jalon nou în planificarea dumneavoastră, pe locul potrivit.

## Când aveți nevoie de aceasta

Lucrați la o planificare, se adaugă activități noi sau vreți să înregistrați un moment, de exemplu predarea sau o inspecție.

O **activitate** este o lucrare care durează un anumit timp. O activitate nouă durează implicit 5 zile lucrătoare (cu planificare pe ore, valoarea implicită a proiectului poate fi în ore). Un **jalon** este un moment fără durată: 0 zile. O activitate cu subactivități se numește **activitate rezumat**; în construcții este de obicei o fază. Durata și datele ei rezultă din subactivitățile ei de îndată ce folosiți **Calculare** (F5).

## Pași

### Adăugarea unei activități

1. Alegeți *Acasă › Activități › Activitate*. Același buton se află și pe fila *Tabel*.
2. Panoul *Proprietăți* se deschide, iar câmpul *Nume* este selectat. Tastați numele și apăsați Enter.

Activitatea nouă se numește mai întâi *Activitate nouă* și începe la începutul proiectului.

Dacă o activitate este selectată, activitatea nouă se adaugă direct sub ea, la același nivel. Dacă activitatea selectată este o activitate rezumat, activitatea nouă se adaugă sub întreaga fază, deci după subactivitățile ei. Dacă nimic nu este selectat, se adaugă la sfârșitul listei. Descrierea butonului arată care dintre cele două se întâmplă: *Activitate nouă direct sub selecție* sau *Activitate nouă la sfârșitul listei*. Dacă selectați mai multe activități, se creează o singură activitate nouă, sub cea mai de jos din selecție, așa cum o vedeți pe ecran.

### Rapid, una după alta, în tabelul de activități

Sub ultima activitate din tabelul de activități există întotdeauna un rând gri *Activitate nouă*. Nu este încă o activitate: nu apare în Gantt și nu se află în fișier.

1. Faceți clic pe o celulă din acel rând sau ajungeți în el cu săgeata în jos.
2. Tastați numele și apăsați Enter. Acum este o activitate reală, la același nivel ca activitatea de deasupra. Cursorul se află imediat pe noul rând gri de sub ea.
3. Tastați următorul nume și tot așa.

Dacă completați doar o durată sau o dată pe rândul gri, activitatea se numește *Activitate nouă*. Dacă plecați fără să completați nimic, nu se întâmplă nimic: nu se creează nicio activitate și nu apare niciun pas în *Anulare*. Crearea activității și prima ei valoare formează împreună un singur pas în *Anulare*. Rândul gri apare doar când tabelul de activități nu este filtrat, grupat sau sortat.

### Cu clic dreapta pe spațiu gol

Faceți clic dreapta pe spațiu gol: în tabelul de activități sub ultima activitate, sau în Gantt, lângă bare sau sub ele. Alegeți *Creare activitate* sau *Adăugare jalon*. Activitatea se adaugă la sfârșitul listei. În Gantt începe la data pe care ați făcut clic. În tabelul de activități se deschide imediat celula cu numele, ca să puteți tasta.

### Deasupra sau dedesubt, la o anumită activitate

Faceți clic dreapta pe activitate și alegeți *Inserare deasupra* sau *Inserare dedesubt*. Și tastatura funcționează: Insert adaugă o activitate deasupra activității selectate, Ctrl+I (⌘+I pe Mac) dedesubt. În tabelul de activități se deschide imediat celula cu numele după Insert, gata de tastat.

Dacă sunt selectate mai multe activități, se creează o singură activitate nouă: *Inserare deasupra* o pune deasupra celei mai de sus activități selectate, *Inserare dedesubt* sub cea mai de jos.

### Adăugarea unei subactivități

Faceți clic dreapta pe activitate și alegeți *Adăugare subactivitate*. Activitatea nouă se adaugă la sfârșitul subactivităților acelei activități. În tabelul de activități de lângă Gantt, o activitate rezumat are și un mic **+** după nume, care face același lucru.

### Adăugarea unui jalon

1. Alegeți *Acasă › Activități › Jalon ▾*, apoi *Jalon de început*, *Jalon de sfârșit* sau *Moment de inspecție (obligatoriu)*.
2. Tastați numele și apăsați Enter. Poziția urmează aceeași regulă ca la *Activitate*.

Cele trei tipuri diferă astfel:

- Un *Jalon de început* se află la începutul zilei, un *Jalon de sfârșit* la sfârșitul zilei. În Gantt, romboul se află în stânga, respectiv în dreapta zilei. Acest lucru contează și pentru succesor. Să presupunem că un jalon este marți, 29 septembrie 2026, iar o activitate îl urmează cu o dependență sfârșit-început: după un jalon de început, activitatea începe în aceeași zi, marți; după un jalon de sfârșit, începe miercuri, 30 septembrie.
- Un *Moment de inspecție (obligatoriu)* este un jalon de sfârșit cu tipul de activitate *Inspecție* și bifa *Obligatoriu (prin contract)*.

### Transformarea unei activități existente într-un jalon

Faceți clic dreapta pe activitate și alegeți *Comutare jalon*, sau bifați *Jalon* în panoul *Proprietăți*. Elementul de meniu funcționează pentru întreaga selecție. Durata devine 0.

Dacă îl dezactivați din nou, rămâne o activitate obișnuită cu durata 0: introduceți dumneavoastră o durată.

### Alte modalități

- Ctrl+M (⌘+M pe Mac) pune un jalon nou la sfârșitul listei, chiar dacă este selectată o activitate. Panoul *Proprietăți* nu se deschide.
- *Adăugare jalon* din meniul cu clic dreapta al unei activități face din jalon o subactivitate a acelei activități, nu o activitate de același nivel.

### Copierea unei activități sau a unei ramuri întregi

1. În Gantt, faceți clic pe bara activității. Selectați mai multe activități cu Ctrl+clic.
2. Apăsați Ctrl+C (⌘+C pe Mac). Aplicația copiază activitatea cu toate subactivitățile ei, dependențele dintre activitățile copiate și atribuiri de resurse ale acestora.
3. Dacă doriți, faceți clic pe bara activității lângă care trebuie să fie copia și apăsați Ctrl+V (⌘+V).

Copia are același nume, aceleași date și același progres. Ea se adaugă ca activitate de același nivel cu activitatea selectată (la mai multe: cu cea pe care ați făcut clic primul), la sfârșitul celor de același nivel. Dacă nimic nu este selectat, se adaugă la sfârșitul listei. Activitățile copiate sunt selectate după aceea, WBS-urile (numărul fiecărei activități din arbore, de exemplu 1.2; vezi [Ajustarea structurii](docs://howto-structuur-aanpassen)) se stabilesc din nou, iar planificarea este învechită.

Clipboardul este comun pentru toată aplicația, deci puteți lipi și într-un alt document. Ce nu există acolo, de exemplu un calendar al activității, un tip de activitate particularizat, un cod de activitate sau un câmp particularizat, aplicația șterge și vă anunță.

### După aceea

O activitate nouă nu schimbă încă celelalte date. Bara de stare arată *Învechit — recalculați (F5)*. Apăsați **Calculare** (F5), de exemplu prin *Acasă › Planificare › Calculare*.

## Capcane și ce face aplicația

**Fiecare activitate nouă începe la începutul proiectului.** Fără dependențe, o activitate nu așteaptă nimic. Adăugați dependențe, vezi [Adăugarea dependențelor](docs://howto-relaties-leggen).

**Filtrarea, gruparea sau sortarea este activată.** Ordinea pe care o vedeți atunci nu este ordinea planificării. Dacă o activitate este selectată, *Activitate* și *Jalon ▾* adaugă activitatea nouă la sfârșitul listei, iar banda *Indisponibil la filtrare, grupare sau sortare* apare. *Inserare deasupra* și *Inserare dedesubt* sunt refuzate, cu aceeași bandă. Butonul *Ștergere* din bandă elimină dintr-o dată filtrul, gruparea și sortarea. Aceasta nu face parte din *Anulare*: Ctrl+Z nu le readuce.

**O subactivitate sub o activitate cu atribuiri de resurse.** Activitatea devine o activitate rezumat, iar o activitate rezumat nu poartă ea însăși atribuiri. Aplicația mută atribuirile la noua subactivitate și vă anunță. Dacă acest lucru nu este posibil, de exemplu pentru că ați ales *Adăugare jalon* și un jalon nu poate avea atribuiri, aplicația nu adaugă nimic și spune de ce.

**O subactivitate sub un jalon.** Jalonul devine o activitate rezumat, iar aplicația elimină marcajul de jalon, cu un mesaj.

**Jalon activat pentru o activitate rezumat sau pentru o activitate cu atribuiri.** Aplicația refuză și spune de ce. Dacă are atribuiri, eliminați-le mai întâi.

**Copierea în tabelul de activități.** În tabelul de activități (și pe fila *Tabel*) Ctrl+C copiază doar valorile celulelor selectate, ca într-o foaie de calcul, iar Ctrl+V lipește în celule. Copierea activităților funcționează, prin urmare, doar dacă folosiți Gantt: faceți mai întâi clic pe o bară.

## Vezi și

- [Ajustarea structurii](docs://howto-structuur-aanpassen): indentați și mutați activități și mențineți WBS-urile actualizate.
- [Adăugarea dependențelor](docs://howto-relaties-leggen): legați activitățile între ele.
- [Selectarea, ștergerea și anularea activităților](docs://howto-taken-selecteren-verwijderen): eliminați din nou o activitate.
- [Drumul critic și marja](docs://uitleg-kritiek-pad): ce calculează aplicația după ce există dependențe.
- [Dialogul activității și panoul de proprietăți](docs://ref-taak-eigenschappen): toate câmpurile unei activități.
- [Proiect nou și Informații proiect](docs://ref-projectinfo): începeți cu un șablon de etapizare.
- [Meniurile cu clic dreapta](docs://ref-contextmenus): toate elementele meniului unei activități.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): un mic proiect exemplu (*Fișier › Exemple*) cu patru faze, un jalon de început și un jalon obligatoriu de predare.
