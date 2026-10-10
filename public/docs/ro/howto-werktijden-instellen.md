# Setarea orelor de lucru

Obiectiv: înregistrați pentru fiecare zi a săptămânii la ce ore lucrează un calendar, astfel încât activitățile în ore să se desfășoare la momentele potrivite.

## Când aveți nevoie de acest lucru

Vinerea după-amiaza nu se lucrează. Echipa lucrează de la 06:00 până la 22:00, în două ture. Există o echipă de noapte. Pauza durează mai puțin de o oră. Dacă planificați doar în zile, sunt suficiente *Început (oră)*, *Sfârșit (oră)* și pauza ([Crearea și atribuirea unui calendar](docs://howto-kalender-maken-en-toewijzen)). Dacă planificați activități în ore, aplicația numără minutele de lucru din **intervalele** calendarului. În aplicație, aceste intervale se numesc *intervale*: un interval este o perioadă continuă de timp de lucru într-o zi a săptămânii, iar un spațiu între două intervale este o pauză. Ce înseamnă aceasta pentru planificarea dumneavoastră este descris în [Zile și ore](docs://uitleg-dagen-en-uren).

Pentru aceasta aveți nevoie de *Activare planificare pe ore* ([Activarea planificării pe ore](docs://howto-urenplanning-aanzetten)). Fără planificarea pe ore nu vedeți blocul *Ore de lucru*.

## Pași

### Alegerea unui preset de ture

1. Alegeți *Planificare › Calendar › Calendar* și selectați calendarul din stânga.
2. În blocul *Ore de lucru*, faceți clic pe un preset. Acesta înlocuiește zilele lucrătoare și orele de lucru ale calendarului.
3. Faceți clic pe *Aplicare*.

Fiecare preset face următoarele:

- *Tură de zi*: de luni până vineri de la 08:00 până la 16:00, fără pauză. Astfel se transformă din nou într-un calendar obișnuit, fără intervale de timp de lucru.
- *2 ture*: de luni până vineri de la 06:00 până la 14:00 și de la 14:00 până la 22:00, în total 16 ore.
- *3 ture*: de luni până vineri trei ture, de la 06:00 până la 14:00, de la 14:00 până la 22:00 și de la 22:00 până la 06:00 a doua zi, în total 24 de ore.
- *Tură de noapte*: de luni până vineri de la 22:00 până la 06:00 a doua zi, 8 ore.
- *24/7*: toate cele șapte zile, de la 00:00 până la 24:00.

### Setarea orelor de lucru pe zi a săptămânii

1. În blocul *Ore de lucru*, faceți clic pe *Setare pe zi a săptămânii…*. Sub butoane apare un rând pentru fiecare zi a săptămânii, cu timpul de lucru al acelei zile, iar calendarul are acum intervale pe fiecare zi. Dacă calendarul le are deja, această prezentare este deschisă imediat; butonul se numește atunci *Ascundere ore de lucru* și o restrânge.
2. Ajustați ora de început și ora de sfârșit ale fiecărui interval în cele două câmpuri pentru oră.
3. Dacă doriți să includeți o pauză, faceți clic pe **+** (*Adăugare interval*) pentru acea zi și ajustați orele intervalelor, astfel încât să rămână un spațiu între ele. Un interval nou începe la 08:00 și se termină la 16:00.
4. Pentru un interval care trece peste miezul nopții, bifați *ziua următoare*. Intervalul se numără la ziua în care începe.
5. Faceți clic pe coșul de gunoi din spatele unui interval pentru a-l șterge. O zi fără intervale apare ca *Zi nelucrătoare*.
6. Pentru o zi de luni până vineri, faceți clic pe simbolul de copiere (*Copiere la toate zilele lucrătoare*) pentru a pune intervalele acelei zile de luni până vineri.
7. La final se află *Ore pe zi calculate:* cu orele nete pe zi pe care aplicația le derivă din acestea. Faceți clic pe *Aplicare*.

**Exemplu: vinerea după-amiaza liberă.** Faceți clic pe *Setare pe zi a săptămânii…*. Ștergeți al doilea interval (13:00 până la 16:00) pentru *Vin*. Vinerea are acum 5 ore, celelalte zile 8 ore. Orele pe zi calculate rămân 8.

### Salvarea unui preset propriu

1. Faceți clic pe *Salvare ca preset…* și scrieți un nume în câmpul *Nume pentru preset-ul propriu*.
2. Faceți clic pe *Salvare*. Presetul apare acum printre celelalte preset-uri, iar îl puteți folosi în orice proiect. Cu crucea de lângă el îl ștergeți din nou.

Un preset propriu este salvat pe acest dispozitiv, nu în fișierul proiectului.

## Capcane și ce face aplicația atunci

**Un preset înlocuiește totul.** Dacă alegeți un preset, zilele lucrătoare și orele de lucru setate anterior dispar. Sărbătorile rămân.

**Butoanele pentru zile și intervalele sunt două lucruri diferite.** Butoanele de sub *Zile lucrătoare* nu modifică intervalele. O zi primește timp de lucru făcând clic pe *Adăugare interval* pentru acea zi. Dacă activați o zi doar cu butonul, ea contează pentru activități în zile, dar nu pentru activități în ore. Pentru un calendar care are ore de lucru, folosiți rândurile pe zi a săptămânii.

**Ajustarea orelor de lucru cu planificarea pe ore dezactivată.** Dacă dezactivați din nou planificarea pe ore, revin câmpurile *Început (oră)*, *Sfârșit (oră)* și pauza. Pe un calendar cu intervale de timp de lucru, acestea nu modifică intervalele. De aceea ajustați întotdeauna orele de lucru cât timp planificarea pe ore este activată.

**Nu există ore de lucru valide.** Un calendar fără intervale sau fără zile lucrătoare nu poate primi o activitate în ore. Aplicația afișează atunci *Acest calendar nu are ore de lucru valide. Verificați zilele lucrătoare și orele de lucru.*

## Vezi și

- [Zile și ore](docs://uitleg-dagen-en-uren): cum numără aplicația orele de lucru și calculează orele nete pe zi.
- [Activarea planificării pe ore](docs://howto-urenplanning-aanzetten): planificarea unei activități în ore.
- [Calendare și zile lucrătoare](docs://uitleg-kalenders): ce calendar se aplică la ce activitate.
- [Ferestrele calendarului](docs://ref-kalenders): toate câmpurile ferestrelor de calendar.
