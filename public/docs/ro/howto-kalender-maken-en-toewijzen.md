# Crearea și atribuirea unui calendar

Scop: creați un calendar propriu, de exemplu o săptămână de lucru de șase zile, și atribuiți-l activităților care trebuie calculate în el.

## Când aveți nevoie de aceasta

Un subcontractant lucrează și sâmbăta. O echipă lucrează doar de luni până joi. O activitate cade într-o perioadă în care doar acea activitate stă pe loc. Calendarul de proiect are atunci zilele lucrătoare greșite. Cu un calendar propriu, aplicația calculează acele activități în zilele corecte, iar restul rămâne pe calendarul de proiect. Ce face exact aplicația cu un calendar, puteți citi în [Calendare și zile lucrătoare](docs://uitleg-kalenders).

## Pași

### Crearea unui calendar

1. Alegeți *Planificare › Calendar › Calendar*. Același buton se află la *Setări › Calendar › Calendar*. Se deschide fereastra *Calendare*. În stânga sunt calendarele proiectului; calendarul de proiect are o stea.
2. Sub listă, faceți clic pe butonul cu semnul plus (*Calendar nou*). Noul calendar este o copie a celui standard: de luni până vineri, de la 07:00 la 16:00, cu o pauză de o oră și, dacă *Mod construcții* este activat, sărbătorile legale olandeze. Dacă doriți ca bază un calendar existent, selectați-l din listă și faceți clic pe butonul cu cele două foi de sub listă (*Duplicare*).
3. Sub *Nume*, dați calendarului un nume care arată cine îl folosește, de exemplu *Six-day week*.
4. Sub *Zile lucrătoare*, faceți clic pe zilele săptămânii ca să le activați sau dezactivați. *Lun–Vin* readuce săptămâna standard, de la 07:00 la 16:00. *Continuu (24/7)* activează toate cele șapte zile, de la 00:00 la 24:00.
5. Ajustați, dacă este nevoie, timpul de lucru: *Început (oră)*, *Sfârșit (oră)*, *Începutul pauzei* și *Durata pauzei (minute)*. Introduceți orele în formatul HH:MM. Cu săgețile, le măriți sau le micșorați cu un sfert de oră. Dacă setați durata pauzei la 0, calendarul funcționează fără pauză. *Ore nete pe zi* este calculat de aplicație însăși. Dacă planificarea pe ore este activată și calendarul are intervale de lucru pe fiecare zi a săptămânii, nu vedeți aceste câmpuri; consultați [Stabilirea orelor de lucru](docs://howto-werktijden-instellen).
6. Ajustați, dacă este nevoie, sărbătorile. Cum funcționează aceasta este descris în [Generarea sărbătorilor și a concediului colectiv din construcții](docs://howto-feestdagen-genereren).
7. Faceți clic pe *Aplicare*. Aplicația recalculează imediat planificarea și închide fereastra. Cu *Anulare* renunțați la modificări. Apăsarea tastei Enter într-un câmp salvează între timp și de asemenea recalculează, fără să închidă fereastra; *Anulare* anulează atunci doar modificările făcute după aceea.

### Atribuirea unui calendar activităților

Un calendar nou produce efect doar după ce o activitate îl folosește. Există două moduri.

**Prin panoul de proprietăți**

1. Selectați activitatea. Dacă nu vedeți panoul *Proprietăți*, activați-l cu *Vizualizare › Panouri › Proprietăți*.
2. Sub *Activitate*, alegeți calendarul din lista *Calendar*. Prima opțiune, *Calendar de proiect* urmat de nume, înseamnă că activitatea nu are un calendar propriu.

**Prin meniul contextual**

1. Faceți clic dreapta pe activitate, în tabelul de activități sau pe bara din Gantt.
2. Alegeți *Atribuire calendar* și apoi calendarul, sau *Calendar de proiect* ca să eliminați din nou calendarul propriu. Calendarul care se aplică acum are o bifă.
3. Dacă doriți să dați un calendar mai multor activități deodată, selectați-le mai întâi cu Ctrl (⌘ pe Mac) și faceți clic dreapta pe una dintre activitățile selectate. Alegerea se aplică tuturor activităților selectate. Dacă faceți clic dreapta pe o activitate care nu este selectată, alegerea se aplică doar acelei activități.

O nouă alegere de calendar nu face planificarea actuală încă: bara de stare afișează *Învechit — recalculați (F5)*. Apăsați **Calculare** (F5), de exemplu prin *Acasă › Planificare › Calculare*. Dacă *Calculare automată* este activată (*Setări › Proiect › Setări*, fila *Planificare*, secțiunea *Calculare*), aplicația face asta singură.

### Schimbarea calendarului de proiect

1. Deschideți *Planificare › Calendar › Calendar* și alegeți calendarul din listă.
2. Deasupra formularului, faceți clic pe *Setare ca implicit pentru proiect*. Steaua se mută la acel calendar.
3. Faceți clic pe *Aplicare*.

Doar activitățile care nu au un calendar propriu trec pe noul calendar de proiect.

### Ștergerea unui calendar

1. Deschideți fereastra *Calendare* și alegeți calendarul din listă.
2. Sub listă, faceți clic pe butonul cu coșul de gunoi (*Ștergere*). Acest buton este dezactivat cât timp există un singur calendar.
3. Faceți clic pe *Aplicare*. Activitățile și resursele care foloseau calendarul revin la calendarul de proiect. Dacă ștergeți chiar calendarul de proiect, primul calendar din listă devine calendarul de proiect.

## Capcane și ce face atunci aplicația

**Nicio zi lucrătoare.** Dacă dezactivați toate zilele săptămânii, aplicația nu poate calcula. Când calculează, afișează mesajul *Calendarul nu are zile lucrătoare setate*.

**Date nevalide.** O pauză în afara timpului de lucru al zilei, o oră de început după ora de sfârșit sau o sărbătoare cu o dată incorectă primesc un mesaj roșu la câmp, iar *Aplicare* este dezactivat până când le corectați. Pentru o pauză sau o sărbătoare nevalidă există și un semn de avertizare lângă calendarul din listă (*Acest calendar conține date nevalide*).

**Un calendar pe o fază.** O fază se calculează întotdeauna pe calendarul de proiect, pentru că durata ei rezultă din activitățile sale. Atribuiți calendarul activităților în sine.

**Același calendar, două alegeri.** În listă, calendarul de proiect apare de două ori: ca *Calendar de proiect: nume* și ca un calendar obișnuit cu acel nume. Dacă alegeți al doilea, aceasta este o alegere proprie pentru activitatea respectivă. Activitatea nu trece atunci pe noul calendar de proiect dacă alegeți mai târziu un alt calendar de proiect.

**Alte ore pe zi.** Dacă modificați timpul de lucru sau pauza, astfel încât *Ore nete pe zi* ale unui calendar se schimbă, o activitate exprimată în zile numără în continuare același număr de zile. Pentru o activitate cu resurse și regula de lucru *Muncă fixă* sau *Unități fixe*, durata se schimbă odată cu ele, pentru că lucrul rămâne același. Patruzeci de ore de lucru sunt 5 zile de câte 8 ore pe zi, sau 7 zile de câte 6 ore pe zi. Aplicația afișează câte activități au primit o durată diferită.

## Vezi și

- [Calendare și zile lucrătoare](docs://uitleg-kalenders): cum numără aplicația zilele lucrătoare și ce calendar are prioritate.
- [Zile și ore](docs://uitleg-dagen-en-uren): ce fac orele nete pe zi.
- [Configurarea unui calendar de resursă](docs://howto-resourcekalender-instellen): un calendar pentru o resursă în locul unei activități.
- [Ferestrele de calendar](docs://ref-kalenders): toate câmpurile ferestrelor de calendar.
