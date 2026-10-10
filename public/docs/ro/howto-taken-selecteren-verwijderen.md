# Selectarea, ștergerea și anularea activităților

Obiectiv: alegeți activități, eliminați-le și anulați o greșeală.

## Când aveți nevoie de acest lucru

Aproape fiecare acțiune din planificare se aplică activităților selectate: ștergere, copiere, a indenta, activare sau dezactivare a unui jalon. Eliminați activități când lucrarea nu mai este necesară sau când planificarea este revizuită. Pentru că aplicația nu cere confirmare la ștergere, *Anulare* vă protejează împotriva greșelilor.

## Pași

### Selectarea activităților

- **O activitate.** Faceți clic pe rândul din tabelul de activități sau pe bara din Gantt.
- **Mai multe activități.** Ctrl+clic (⌘+clic pe Mac) adaugă o activitate la selecție sau o elimină din selecție. În tabelul de activități, Shift+clic selectează toate activitățile de la activitatea activă până la cea pe care ați făcut clic.
- **Toate activitățile vizibile.** Ctrl+A, cu focusul în tabelul de activități sau în Gantt. Activitățile ascunse de un filtru nu fac parte din selecție. La fel, subactivitățile dintr-o fază restrânsă nu fac parte din ea.
- **O casetă în Gantt.** Țineți Ctrl apăsat și trageți peste fundalul gol. Sunt selectate toate activitățile din rândurile pe care le atinge caseta, chiar dacă bara lor se află lângă ea. Contează doar înălțimea casetei, nu axa timpului. Dacă eliberați Ctrl abia după butonul mouse-ului, activitățile se adaugă la selecția existentă. Altfel, ele o înlocuiesc. Fără Ctrl, această tragere derulează axa timpului în setarea implicită.
- **Nimic.** Esc sau un clic pe fundalul gol al Gantt.

Dacă selectați o activitate rezumat, subactivitățile ei nu sunt selectate. Ștergerea și copierea le includ însă.

### Ștergerea activităților

Selectați activitățile și alegeți una din aceste variante:

- *Acasă › Editare › Ștergere*. Același buton se află pe fila *Tabel*.
- Delete sau Backspace, dacă focusul nu se află în tabelul de activități. Faceți deci mai întâi clic pe o bară din Gantt.
- *Ștergere* din meniul cu clic dreapta. Dacă activitatea pe care ați făcut clic face parte din selecție, comanda se aplică întregii selecții. Altfel, se aplică doar acelei activități.
- Pictograma mică a coșului de gunoi din partea de sus a panoului *Proprietăți* (sfat *Ștergere activitate*). Aceasta șterge activitatea afișată în panou.

Aplicația nu cere confirmare. Dacă ștergeți mai multe activități deodată, aceasta este un singur pas pentru *Anulare*.

Dispar odată cu ele: toate subactivitățile unei activități rezumate șterse, toate dependențele de la și către activitățile șterse și atribuirile lor de resurse. Dacă ștergeți ultima subactivitate a unei activități rezumat, aceasta rămâne ca activitate obișnuită. Dacă *WBS automat* este activat, aplicația renumerotează arborele. Planificarea nu mai este actualizată după aceea: apăsați **Calculare** (F5), dacă *Calculare automată* nu este activată.

### Restrângerea și extinderea

O activitate rezumat are un triunghi înaintea numelui ei în tabelul de activități. Faceți clic pe el pentru a ascunde sau a afișa subactivitățile. Cu *Vizualizare › Schiță › Restrângere* și *Extindere* faceți același lucru pentru activitățile rezumat selectate. Dacă nu este selectat nimic, faceți asta pentru toate. Meniul cu clic dreapta al unei activități rezumat conține, de asemenea, *Restrângere* și *Extindere*. Într-o vizualizare grupată, butoanele acționează asupra grupurilor.

Aplicația reține restrângerea și extinderea pentru fiecare document deschis. Acestea nu fac parte din *Anulare* și nu se află în fișierul de proiect.

### Anularea și refacerea

- *Acasă › Editare › Anulare* și *Refacere* (și pe fila *Tabel*), săgețile din bara de titlu, sau Ctrl+Z pentru anulare și Ctrl+Y sau Ctrl+Shift+Z pentru refacere.
- Dacă faceți ceva nou după o *Anulare*, *Refacere* nu mai este disponibilă.

*Anulare* se aplică la modificările datelor proiectului (activități, dependențe, resurse, calendare și altele) și la aplicarea unui aspect. Modificările coloanelor din tabelul de activități sunt, de asemenea, pași: adăugare, eliminare, mutare, redimensionare, potrivire automată, fixare și resetare a aspectului coloanelor la implicit. Acești pași de coloane aparțin tabelului de activități însuși și se aplică la întreaga aplicație, nu la un singur document. Aplicația păstrează ultimii o sută de pași pentru fiecare document, mai puțini pentru un proiect foarte mare.

## Capcane și ce face aplicația

**Ștergerea în tabelul de activități nu șterge o activitate.** Dacă focusul se află în tabelul de activități, tasta Delete (sau Backspace) șterge conținutul celulelor selectate. Pentru o celulă obligatorie sau calculată, cum sunt numele sau durata, aplicația refuză și afișează un mesaj sub tabelul de activități. Pentru nume, de exemplu, mesajul este *Această valoare este obligatorie și nu poate rămâne goală.* Atunci nu se șterge nimic, nici în celelalte celule selectate. Faceți clic pe o bară din Gantt sau folosiți *Ștergere* (pe fila *Tabel*, unde nu există Gantt: *Tabel › Editare › Ștergere* sau meniul cu clic dreapta).

**O fază întreagă dispare deodată.** Dacă ștergeți o activitate rezumat, subactivitățile, dependențele și atribuirile ei dispar odată cu ea. *Anulare* (Ctrl+Z) readuce totul, inclusiv dependențele și atribuirile.

**Ce nu revine.** Selecția, restrângerea și extinderea, precum și butonul *Ștergere* din bara *Indisponibil la filtrare, grupare sau sortare*, nu fac parte din *Anulare*. Dacă apăsați Ctrl+Z după *Ștergere*, anulați deci pasul anterior, nu acțiunea de golire.

**Eliminarea unei activități de care depind altele.** Dependențele de la și către această activitate dispar și ele. Activitățile care erau legate doar de ea se desprind. După **Calculare**, ele încep din nou la data lor de început planificată. Adăugați dependențe noi dacă este nevoie; consultați [Adăugarea dependențelor](docs://howto-relaties-leggen).

## Vezi și

- [Adăugarea activităților și a jaloanelor](docs://howto-taken-en-mijlpalen-toevoegen): procesul invers, și copierea activităților.
- [Ajustarea structurii](docs://howto-structuur-aanpassen): mutați o activitate sub altă fază în loc să o eliminați.
- [Tragerea, deplasarea și zoomarea în Gantt](docs://howto-gantt-bedienen): caseta de selecție și modurile de derulare.
- [Meniurile cu clic dreapta](docs://ref-contextmenus): ce fac *Ștergere* și celelalte elemente cu o selecție.
