# Crearea și imprimarea unui raport

Obiectiv: alegeți un raport al planificării dumneavoastră, verificați-l în previzualizare și salvați-l ca PDF, ca să îl puteți distribui sau imprima singur.

## Când aveți nevoie de asta

Vineri este întâlnirea de la șantier. Beneficiarul vrea planificarea pe hârtie, managerul de șantier vrea să știe ce începe în următoarele săptămâni, iar maistrul vrea o foaie cu doar propriile activități. Aceste prezentări generale le creați în fila *Raport*. Aplicația le calculează din planificarea dumneavoastră și le arată mai întâi ca previzualizare. Apoi le exportați în PDF.

Aplicația nu trimite singură un raport la o imprimantă. Rezultatul final este întotdeauna un PDF. Acest PDF îl imprimați cu cititorul dumneavoastră de PDF sau îl trimiteți prin e-mail.

## Pași

### 1. Deschideți fila Raport

Alegeți *Raport* din panglică sau apăsați Ctrl+P. Ctrl+P vă duce la această filă. Dacă scrieți într-un câmp, o fereastră de dialog este deschisă sau modul de prezentare este activat, Ctrl+P nu funcționează. În browser se deschide fereastra de imprimare a browserului, care imprimă ecranul, nu raportul.

În stânga se află coloana *Raport* cu lista *Tip de raport*, un rezumat și setările. În dreapta este previzualizarea.

### 2. Alegeți tipul de raport

Lista *Tip de raport* conține unsprezece rapoarte. Alegeți raportul care corespunde întrebării dumneavoastră.

- *Diagramă Gantt*: planificarea sub formă de diagramă cu bare, pentru planificarea obișnuită de distribuit.
- *Diagrama resurselor*: aceleași bare, dar cu o fâșie pentru fiecare resursă. Pentru întrebarea „ce face echipa X?”, dacă doriți, cu câte o foaie pentru fiecare echipă.
- *Prezentare generală jaloane*: toate jaloanele cu dată și stare.
- *Varianță*: planificarea curentă alături de referința activă. Pentru întrebarea „cât de mult am întârziat?”.
- *Look-ahead*: ce se desfășoară sau începe în perioada următoare. Lista pentru întâlnirea săptămânală.
- *Critic și aproape critic*: activitățile fără marjă sau cu marjă aproape nulă.
- *Raport de progres*: unde se află proiectul la data raportului de stare, adică ziua în care măsurați progresul.
- *Starea planificării*: o verificare a planificării în sine, pentru erori și valori neobișnuite.
- *Încărcare resurse*: pe resursă, pe săptămână sau pe lună, ce este necesar față de ce este disponibil.
- *Atribuiri de resurse*: pe resursă, activitățile la care este atribuită.
- *Rezumat WBS*: planificarea agregată pe nivel WBS, pentru conducere.

### 3. Asigurați-vă că planificarea este actualizată

Aplicația nu calculează singură. Dacă ați modificat activități, dependențe sau calendare de la ultimul calcul, apăsați **Calculare** (F5). Tabelele de raport vă avertizează singure, în partea de sus a raportului: *Planificarea s-a modificat de la ultimul calcul — apăsați Calculare (F5) pentru valori curente.* Sau, dacă nu a fost calculată niciodată: *Încă necalculat — apăsați Calculare (F5) pentru date și marjă.*

Panglica filei *Raport* nu are buton Calculare, dar F5 funcționează și aici. **Exportare PDF** calculează și ea singură mai întâi, dacă planificarea este învechită, astfel încât PDF-ul să nu rămână în urma planificării dumneavoastră.

### 4. Ajustați raportul

Sub *Setări* sunt opțiunile pentru diagrama Gantt și diagrama resurselor. Look-ahead, Critic și aproape critic, Raport de progres, Starea planificării, Încărcare resurse, Atribuiri de resurse și Rezumat WBS au doar *Hârtie:* și *Orientare:*, plus un bloc *Opțiuni de raport* cu opțiunile acelui raport. Prezentare generală jaloane și Varianță nu au opțiuni proprii. Pentru perioada raportului, vedeți [Alegerea perioadei raportului](docs://howto-rapportageperiode-kiezen).

- *Hârtie:* și *Orientare:* stabilesc foaia. Implicit este A3 orizontal, ceea ce este practic pentru o planificare de șantier, dar nu fiecare imprimantă tipărește A3. Dacă aveți o imprimantă A4, alegeți acum A4: aplicația aranjează atunci paginile pentru A4, fără să fie nevoie să le micșorați mai târziu dumneavoastră.
- La diagrama resurselor, caseta *Fiecare resursă pe o pagină nouă* oferă câte o foaie pentru fiecare echipă.
- *Dimensiune text:* (90% până la 125%) face textul și tabelul mai mari sau mai mici. Un text mai mare lasă mai puțin spațiu pentru cronologie.
- *Urmărire vizualizare (filtru, grupare, sortare)* apare doar pentru diagrama Gantt. Implicit, întregul arbore de activități ajunge pe hârtie. Cu această casetă, raportul desenează exact rândurile pe care le vedeți pe ecran, inclusiv fazele restrânse, de exemplu doar activitățile critice dintr-un aspect. Despre cum se creează o astfel de vizualizare, vedeți [Crearea și folosirea unui aspect](docs://howto-layouts-gebruiken).
- *Afișare suprapunere referință* arată referința activă alături de barele curente. Cu *Linie de stare:* alegeți *Linia datei raportului de stare* sau *Linia de progres*.
- *Potrivire automată pe hârtie* este activată implicit: cronologia se scalează la lățimea paginii, iar numărul de pagini rezultă din înălțime. Dacă o dezactivați, raportul folosește un zoom fix și se întinde și pe lățime, ceea ce produce rapid multe pagini. Cu *Cronologie pe:* întindeți cronologia pe 2 până la 8 pagini în lățime, cu potrivire automată, pentru o planificare lungă pe care doriți s-o imprimați la o dimensiune lizibilă.

### 5. Verificați previzualizarea

Pentru diagrama Gantt și diagrama resurselor vedeți hârtia cu antetul paginii, tabelul, cronologia și legenda. Derulați pentru a vedea paginile. *Calitate previzualizare* stabilește doar cât de clară este previzualizarea pe ecranul dumneavoastră; PDF-ul nu se schimbă cu ea. Dacă sub pagini scrie *… și încă 1 pagină — exportați pentru documentul complet* (cu mai multe pagini *… și încă 2 pagini — exportați pentru documentul complet*), previzualizarea nu are toate paginile pregătite. PDF-ul le conține pe toate.

Celelalte rapoarte se afișează pe ecran ca tabel. Ce vedeți este exact ce ajunge în PDF.

### 6. Exportați în PDF

În partea de jos a coloanei din stânga, faceți clic pe **Exportare PDF**. Numele de fișier propus este numele proiectului urmat de tipul raportului, de exemplu pentru diagrama Gantt *Extension house-planning.pdf*.

- În aplicația desktop și într-un browser care are o fereastră de salvare a fișierelor, alegeți unde ajunge PDF-ul. Dacă închideți această fereastră fără să salvați, nu se întâmplă nimic.
- Într-un browser fără o asemenea fereastră, browserul pune PDF-ul în folderul dumneavoastră de descărcări.

### 7. Imprimați PDF-ul

Deschideți PDF-ul în cititorul dumneavoastră de PDF și imprimați-l de acolo. Dacă imprimați un PDF A3 pe o imprimantă A4, fereastra de imprimare trebuie să micșoreze paginile. Așadar, alegeți mai întâi formatul hârtiei la pasul 4.

## Capcane și ce face aplicația

**Butonul Imprimare și Ctrl+P nu imprimă.** Butonul *Imprimare* din grupul *Raport* se află chiar pe fila Raport și nu face nimic în plus. Ctrl+P vă duce la această filă. Aplicația nu are o comandă separată de imprimare: calea spre hârtie trece prin PDF. Dacă Ctrl+P nu funcționează (vedeți pasul 1), în browser se deschide fereastra de imprimare a browserului, care imprimă ecranul, nu raportul.

**Companie: suprascrierea nu se păstrează.** Câmpul *Companie:* din diagrama Gantt începe cu compania din informațiile proiectului. Ce scrieți peste el nu se păstrează. Aici nu puteți scrie în câmpul *Autor:*. Schimbați ambele cu *Setări › Proiect › Informații proiect*, în câmpurile *Beneficiar/organizație* și *Autor*, și confirmați cu *Aplicare*.

**Culori bare: se aplică și pe ecranul dumneavoastră.** Alegerea *Culori bare:* din raport este aceeași alegere ca *Culori bare* din fila Vizualizare. Dacă o schimbați în raport, diagrama Gantt de pe ecran se schimbă și ea.

**Varianța fără referință.** O referință este o copie salvată a planificării dumneavoastră, cu care măsurați mai târziu; cum salvați una este descris în [Salvarea și gestionarea unei referințe](docs://howto-baseline-opslaan-en-beheren). Dacă nu aveți o referință activă, în loc de o comparație scrie *Nicio referință activă — salvați o referință sau setați una ca activă.*

**Linie de stare fără dată a raportului de stare.** Dacă alegeți *Linie de stare:* cât timp proiectul nu are o dată a raportului de stare, raportul avertizează cu *Setați mai întâi data raportului de stare* și nu desenează nimic. Data raportului de stare o stabiliți la *Planificare › Referințe și progres › Data raportului de stare*.

**Planificarea conține o buclă.** Dacă planificarea conține o buclă, *Exportare PDF* nu creează niciun fișier și afișează eroarea.

**Hârtia se aplică deocamdată tuturor rapoartelor.** Există o singură alegere pentru *Hârtie:* și *Orientare:*, comună tuturor rapoartelor. Prezentare generală jaloane și Varianță nu au o alegere proprie de hârtie: ele folosesc ce ați stabilit în alt raport, implicit A3 orizontal. Așadar, alegeți mai întâi hârtia într-un raport care o oferă, de exemplu diagrama Gantt, și apoi reveniți.

**Setările se aplică tuturor proiectelor.** Hârtia, dimensiunea textului, perioada și celelalte alegeri sunt reținute de aplicație pe acest dispozitiv, pentru toate proiectele dumneavoastră. Ele nu aparțin fișierului proiectului.

## Vezi și

- [Alegerea perioadei raportului](docs://howto-rapportageperiode-kiezen): un look-ahead sau un raport de progres pentru o anumită perioadă.
- [Crearea și folosirea unui aspect](docs://howto-layouts-gebruiken): mai întâi filtrați sau grupați, apoi imprimați cu *Urmărire vizualizare*.
- [Salvarea și gestionarea unei referințe](docs://howto-baseline-opslaan-en-beheren): instantaneul cu care compară Varianța.
- [Rezolvarea supraalocării](docs://howto-overbezetting-oplossen): ce faceți când *Încărcare resurse* arată săptămâni cu supraalocare.
- [Drumul critic și marja](docs://uitleg-kritiek-pad): de ce o activitate este critică sau aproape critică.
- [Tipurile de raport](docs://ref-rapporttypes): toate tipurile de raport și opțiunile lor.
