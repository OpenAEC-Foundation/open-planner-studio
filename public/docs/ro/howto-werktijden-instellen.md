# Setarea orelor de lucru

Obiectiv: înregistrați pentru fiecare zi a săptămânii la ce ore lucrează un calendar, astfel încât activitățile în ore să se desfășoare la momentele potrivite.

## Când aveți nevoie de acest lucru

Vinerea după-amiaza nu se lucrează. Echipa lucrează de la 06:00 până la 22:00, în două ture. Există o echipă de noapte. Pauza durează mai puțin de o oră. Dacă planificați doar în zile, sunt suficiente *Început (oră)*, *Sfârșit (oră)* și pauza ([Crearea și atribuirea unui calendar](docs://howto-kalender-maken-en-toewijzen)). Dacă planificați activități în ore, aplicația numără minutele de lucru din **intervalele** calendarului. În aplicație, aceste intervale se numesc *intervale*: un interval este o perioadă continuă de timp de lucru într-o zi a săptămânii, iar un spațiu între două intervale este o pauză. Ce înseamnă aceasta pentru planificarea dumneavoastră este descris în [Zile și ore](docs://uitleg-dagen-en-uren).

Pentru ca un calendar obișnuit să primească intervale, aveți nevoie de *Activare planificare pe ore* ([Activarea planificării pe ore](docs://howto-urenplanning-aanzetten)). Dacă calendarul are deja intervale, de exemplu dintr-un fișier MS Project, blocul *Ore de lucru* este mereu prezent, iar intervalele le modificați și cu planificarea pe ore dezactivată.

## Pași

### Alegerea unui preset de ture

1. Alegeți *Planificare › Calendar › Calendar* și selectați calendarul din stânga.
2. În blocul *Ore de lucru*, faceți clic pe un preset. Acesta înlocuiește zilele lucrătoare și orele de lucru ale calendarului.
3. Faceți clic pe *Aplicare*.

Fiecare preset face următoarele:

- *Tură de zi*: de luni până vineri de la 08:00 până la 16:00, fără pauză. Calendarul devine din nou unul obișnuit, fără intervale de timp de lucru.
- *2 ture*: de luni până vineri de la 06:00 până la 14:00 și de la 14:00 până la 22:00, în total 16 ore.
- *3 ture*: de luni până vineri trei ture, de la 06:00 până la 14:00, de la 14:00 până la 22:00 și de la 22:00 până la 06:00 a doua zi, în total 24 de ore.
- *Tură de noapte*: de luni până vineri de la 22:00 până la 06:00 a doua zi, 8 ore.
- *24/7*: toate cele șapte zile, de la 00:00 până la 24:00.

### Setarea orelor de lucru pe zi a săptămânii

1. În blocul *Ore de lucru*, faceți clic pe *Setare pe zi a săptămânii…*. Sub butoane apare câte un rând pentru fiecare zi a săptămânii, cu timpul de lucru al acelei zile, iar calendarul are acum intervale pe fiecare zi. Dacă calendarul le are deja, această prezentare se deschide imediat; butonul se numește atunci *Ascundere ore de lucru* și o restrânge.
2. Ajustați ora de început și ora de sfârșit ale fiecărui interval în cele două câmpuri pentru oră. Scrieți ora și apăsați Enter sau folosiți săgețile (15 minute pe pas). Câmpurile urmează *Format oră* din setări; *13:00* și *1:00 PM* funcționează amândouă.
3. Dacă doriți să includeți o pauză, faceți clic pe **+** (*Adăugare interval*) pentru acea zi și ajustați orele intervalelor, astfel încât între ele să rămână un spațiu. Un interval nou începe la 08:00 și se termină la 16:00.
4. Pentru un interval care trece peste miezul nopții, bifați *ziua următoare*. Intervalul se numără la ziua în care începe.
5. Faceți clic pe coșul de gunoi din spatele unui interval pentru a-l șterge. O zi fără intervale apare ca *Zi nelucrătoare*.
6. Pentru o zi de luni până vineri, faceți clic pe simbolul de copiere (*Copiere la toate zilele lucrătoare*) ca intervalele acelei zile să fie puse de luni până vineri.
7. Deasupra blocului *Ore de lucru* se află *Zi lucrătoare standard*: timpul de lucru pe zi pe care aplicația îl deduce din intervale și cu care calculează. Cifra se actualizează imediat când modificați intervalele. Dacă calendarul are propriile ore pe zi (de exemplu din Primavera P6), această valoare proprie se păstrează și se exportă împreună cu el, până când un preset o înlocuiește. Dacă această valoare proprie diferă de *Zi lucrătoare standard*, un bloc portocaliu apare direct sub cifră, de exemplu: *Fișierul are propria zi lucrătoare de 8h. Aceasta se păstrează la exportul în MS Project și P6. Acolo o zi are 8h, aici 10h.* Blocul dispare de îndată ce intervalele dau aceeași sumă pe zi sau când un preset înlocuiește valoarea proprie. Blocul nu modifică calculul. Faceți clic pe *Aplicare*.

**Exemplu: vinerea după-amiaza liberă.** Faceți clic pe *Setare pe zi a săptămânii…*. Ștergeți al doilea interval (13:00 până la 16:00) pentru *Vin*. Vinerea are acum 5 ore, celelalte zile câte 8 ore. *Zi lucrătoare standard* rămâne 8 ore.

### Salvarea unui preset propriu

1. Faceți clic pe *Salvare ca preset…* și scrieți un nume în câmpul *Nume pentru preset-ul propriu*.
2. Faceți clic pe *Salvare*. Presetul apare acum printre celelalte preset-uri și îl puteți folosi în orice proiect. Cu crucea de lângă el îl ștergeți din nou.

Un preset propriu este salvat pe acest dispozitiv, nu în fișierul proiectului.

## Capcane și ce face aplicația atunci

**Un preset înlocuiește totul.** Dacă alegeți un preset, zilele lucrătoare și orele de lucru setate anterior dispar. Sărbătorile rămân.

**Butoanele pentru zile modifică intervalele.** Dacă dezactivați o zi sub *Zile lucrătoare*, intervalele acelei zile dispar. Dacă o reactivați, primește din nou intervalele pe care le avea când ați deschis fereastra (sau după ultimul preset), altfel pe cele ale primei zile lucrătoare. *Lun–Vin* face asta pentru luni până vineri și șterge intervalele de sâmbătă și duminică. *Continuu (24/7)* înlocuiește toate intervalele: fiecare zi primește 00:00 până la 24:00.

**Ajustarea orelor de lucru cu planificarea pe ore dezactivată.** Un calendar cu intervale de timp de lucru păstrează blocul *Ore de lucru*, chiar dacă dezactivați planificarea pe ore. Acolo modificați pur și simplu intervalele. Dacă alegeți *Tură de zi*, calendarul devine din nou unul obișnuit, cu câmpurile *Început (oră)*, *Sfârșit (oră)* și pauza. Punerea la loc a intervalelor este posibilă doar cu planificarea pe ore activată.

**Nu există ore de lucru valide.** Un calendar fără intervale sau fără zile lucrătoare nu poate primi o activitate în ore. Aplicația afișează atunci *Acest calendar nu are ore de lucru valide. Verificați zilele lucrătoare și orele de lucru.*

## Vezi și

- [Zile și ore](docs://uitleg-dagen-en-uren): cum numără aplicația orele de lucru și cum deduce ziua lucrătoare standard.
- [Activarea planificării pe ore](docs://howto-urenplanning-aanzetten): planificarea unei activități în ore.
- [Calendare și zile lucrătoare](docs://uitleg-kalenders): ce calendar se aplică la ce activitate.
- [Ferestrele calendarului](docs://ref-kalenders): toate câmpurile ferestrelor de calendar.
