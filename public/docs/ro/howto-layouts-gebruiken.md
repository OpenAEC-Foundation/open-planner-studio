# Crearea și utilizarea unui aspect

Scop: să comutați dintr-un clic între vizualizările planificării dumneavoastră, de exemplu doar activitățile critice, activitățile pe echipă sau o altă ordine de sortare.

## Când aveți nevoie de acest lucru

În ședința de șantier, clientul vrea să vadă doar activitățile critice. Apoi, managerul de șantier vrea să vadă pe echipe cine este necesar și când. Apoi doriți din nou întreaga planificare. Setarea repetată a filtrelor, grupărilor și ordinilor de sortare este greoaie. Un **aspect** stochează o astfel de vizualizare ca buton în panglică.

Un aspect poate stoca șase lucruri: filtrul, gruparea, sortarea, coloanele tabelului de activități de lângă Gantt, scara de timp și liniile de dependență și suprapunerile (referința, linia de progres, linia datei raportului de stare, accentul resurselor, banda de marjă și culorile barelor). La clic pe buton se modifică doar ce ați bifat. Restul vizualizării dumneavoastră rămâne cum era.

Filtrați, grupați și sortați cu ajutorul unui aspect. Butoanele separate *Filtrare…*, *Grupare…* și *Sortare…* există acum doar în spatele unei setări ascunse (vezi Capcane și ce face aplicația).

## Pași

### Folosirea unui aspect existent

1. Alegeți fila *Vizualizare*. În grupul *Aspect* există câte un buton pentru fiecare aspect. Implicit, acesta este *Diagrama resurselor*.
2. Faceți clic pe el. *Diagrama resurselor* grupează activitățile pe resursă, sortează în fiecare grup după început și dezactivează liniile de dependență. O activitate cu două resurse apare la ambele grupuri.
3. Faceți din nou clic pentru a dezactiva aspectul. Vizualizarea revine la starea de dinaintea clicului dumneavoastră.

Fiecare clic este un pas pentru *Anulare* (Ctrl+Z), atât la activare, cât și la dezactivare.

### Crearea unui aspect propriu

1. În grupul *Aspect*, faceți clic pe *Aspect nou*. Se deschide fereastra *Aspect nou*.
2. Scrieți un *Nume* și alegeți o *Pictogramă*.
3. Sub *Ce reține acest aspect?* sunt cele șase părți, fiecare cu o casetă de bifare. O fereastră nouă pornește cu toate părțile bifate și completate cu ce vedeți acum pe ecran. Debifați tot ce aspectul nu trebuie să modifice. Dacă doriți doar un filtru, lăsați bifat doar *Filtrare*. *Preluare vizualizare curentă* completează din nou toate părțile cu ce vedeți pe ecran.
4. Setați părțile.
5. Faceți clic pe *Salvare*.

Aspectul apare acum ca buton în panglică, dar nu este aplicat încă. Faceți clic pe buton pentru a-l activa.

### Configurarea filtrului

Sub *Filtrare* construiți reguli. Faceți clic pe *+ regulă*, alegeți un *Câmp*, un *Operator* și o valoare. Dacă doriți doar activitățile critice: câmpul *Critic*, operatorul *este egal cu*, valoarea *Da*. Câmpurile includ *Nume activitate*, *Început*, *Sfârșit*, *Marjă totală*, *Progres* și *Jalon*, plus coduri de activitate, câmpuri proprii și *Resurse*. Pentru text puteți alege *conține*, iar pentru numere și date *între*.

Ce operatori aveți la dispoziție depinde de tipul câmpului:

- Text (*Nume activitate*, *WBS*): *este egal cu*, *este diferit de*, *conține*, *începe cu* și *este gol*.
- Număr și dată (*Marjă totală*, *Început*, *Progres*): *este egal cu*, *este diferit de*, *mai mic decât*, *mai mic sau egal cu*, *mai mare decât*, *mai mare sau egal cu*, *între* și *este gol*. Cu *între* există două câmpuri: pentru un număr, cu indicațiile *De la* și *Până la*; pentru o dată, fără indicație (prima dată este începutul, a doua sfârșitul).
- Da/nu (*Critic*, *Jalon*, *Aproape critic*): *este egal cu* și *este diferit de*, cu valoarea *Da* sau *Nu*.
- Alegere (*Tip*, un cod de activitate): *este egal cu*, *este diferit de*, *este unul dintre* (cu valori bifabile) și *este gol*.
- *Resurse*: *este unul dintre* și *este gol*.
- *În curs*: doar *între*, cu două date (de la și până la).

Cu câmpul *În curs*, operatorul *între* și două date obțineți toate activitățile care rulează în orice moment din perioada respectivă, de exemplu tot ce este activ în iunie.

Combinați mai multe reguli cu lista de sus: *Toate de mai jos (AND)* afișează activitățile care respectă toate regulile, *Oricare de mai jos (OR)* activitățile care respectă cel puțin o regulă. Cu *+ grupare* adăugați un subgrup cu propriile reguli.

Filtrul se uită la activitățile în sine. Activitățile rezumat (fazele) din care face parte o activitate rămân vizibile în gri, astfel că vedeți unde se încadrează activitatea. Dacă activați și gruparea, fazele gri dispar.

### Gruparea și sortarea

Sub *Grupare* adăugați un câmp cu *+ nivel*. Există cel mult două niveluri de grupare. Fără grupare vedeți arborele WBS. Sub *Sortare* adăugați un câmp cu *+ nivel* și alegeți *Crescător* sau *Descrescător*. Cu două niveluri, al doilea decide când valorile primului sunt egale.

### Încercarea rapidă fără buton

În fereastră faceți clic pe *Aplicare fără salvare*. Părțile bifate ajung pe ecran, dar nu se adaugă niciun buton. Asta este util pentru un filtru de care aveți nevoie o singură dată. Ctrl+Z îl anulează.

### Modificarea, copierea sau ștergerea unui aspect

Faceți clic dreapta pe butonul aspectului. Alegeți *Editare…*, *Duplicare* sau *Ștergere*. *Ștergere* cere mai întâi o confirmare. O copie se numește *nume (copie)*. Un aspect integrat, de exemplu *Diagrama resurselor*, nu îl puteți edita sau șterge; îl duplicați pentru a face propria versiune.

### Mai multe aspecte în același timp

Aspectele care nu stochează aceleași părți pot fi active împreună. Dacă aveți un aspect care stochează doar filtrul *Critic este egal cu Da* (numiți-l, de exemplu, *Doar critice*) și îl activați împreună cu *Diagrama resurselor* (grupare, sortare, linii de dependență), obțineți activitățile critice pe resursă. Dacă două aspecte stochează aceeași parte, de exemplu amândouă un filtru, al doilea o preia, iar primul se dezactivează. Dacă dezactivați din nou al doilea, reveniți la vizualizarea de dinaintea primului clic, nu la primul aspect.

## Capcane și ce face aplicația

**Ați uitat să debifați părți.** Un aspect care stochează și coloanele, scara de timp și suprapunerile readuce acestea la starea salvată la fiecare clic. Zoomul dumneavoastră sare atunci în altă parte, deși doreați doar un filtru. Verificați în fereastră că sunt bifate doar părțile dorite.

**O regulă incompletă nu afișează nimic.** Dacă nu alegeți nicio valoare pentru un câmp da/nu (încă scrie *—*) sau lăsați goale datele pentru *În curs*, nicio activitate nu se potrivește și lista rămâne goală. Completați regula.

**O modificare manuală dezactivează aspectul.** Dacă modificați dumneavoastră o parte pe care aspectul o stochează, de exemplu *Linii de dependență* cât timp Diagrama resurselor este activă, aspectul iese, iar celelalte părți revin la vizualizarea de dinaintea aspectului. Zoomul dezactivează un aspect care stochează scara de timp, iar lărgirea unei coloane dezactivează un aspect care stochează coloanele. Restul vizualizării rămâne atunci cum era. Diagrama resurselor nu stochează scara de timp, deci zoomul nu o afectează.

**Coloanele se aplică tabelului de activități de lângă Gantt.** Partea *Coloane* stochează coloanele tabelului din stânga liniei de timp. Tabelul din fila *Tabel* își păstrează propriile coloane. Cum alegeți coloanele este descris în [Ajustarea coloanelor tabelului](docs://howto-tabelkolommen-aanpassen).

**Butoanele *Indenta* și *Indenta negativ* sunt dezactivate.** Cât timp este activ un filtru, o grupare sau o sortare, ordinea afișată nu este ordinea planificării. *Indenta* și *Indenta negativ* sunt atunci dezactivate, cu mesajul *Indisponibil la filtrare, grupare sau sortare*. Dezactivați aspectul pentru a ajusta din nou structura, cum este descris în [Ajustarea structurii](docs://howto-structuur-aanpassen).

**Bara de stare nu se adaptează.** *Activități:* din bara de stare arată numărul de activități din întregul proiect, chiar dacă un filtru afișează doar o parte din ele.

**Aspectele se află pe dispozitivul dumneavoastră, nu în proiect.** Aplicația păstrează aspectele și coloanele dumneavoastră pentru toate proiectele de pe acest dispozitiv. Suprapunerile unui aspect (referința, linia de progres și restul) se aplică tuturor proiectelor dumneavoastră. Filtrul, gruparea și sortarea activate chiar acum aparțin proiectului deschis, dar nu intră în fișierul proiectului: după salvare și redeschidere, vizualizarea este din nou curată. Nici nu fac proiectul „modificat”.

**Butoanele separate sunt ascunse.** *Coloane…*, *Filtrare…*, *Grupare…* și *Sortare…* ca butoane separate din fila *Vizualizare* sunt o variantă veche. Le readuceți cu *Afișare butoane clasice de vizualizare* sub *Funcții vechi*, în fila *Avansat* a ferestrei de setări (⚙ din bara de titlu). Preferați aspectele.

## Vezi și

- [Ajustarea coloanelor tabelului](docs://howto-tabelkolommen-aanpassen): alegerea, mutarea și fixarea coloanelor în sine.
- [Realizarea și tipărirea unui raport](docs://howto-rapport-maken-en-afdrukken): punerea vizualizării pe hârtie cu *Urmărire vizualizare*.
- [Ajustarea structurii](docs://howto-structuur-aanpassen): de ce nu puteți indenta cât timp filtrați.
