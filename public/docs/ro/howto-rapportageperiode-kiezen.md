# Alegerea perioadei raportului

Scop: stabiliți ce interval de timp acoperă un raport, de exemplu următoarele patru săptămâni sau luna iunie.

## Când aveți nevoie de acest lucru

Ședința săptămânală vrea să afle ce se întâmplă în următoarele patru săptămâni. Raportul lunar acoperă luna iunie. Fără perioadă, primiți pe hârtie întreaga planificare. Cinci rapoarte lucrează, prin urmare, cu *Perioadă raport:*: *Look-ahead*, *Raport de progres*, *Încărcarea resurselor*, *Atribuiri de resurse* și *Diagrama resurselor*. Celelalte rapoarte nu au perioadă.

Perioada nu este legată de o lună calendaristică, ci de o **zi de referință**: data raportului de stare al proiectului (ziua în care măsurați progresul, vezi [Progres, data raportului de stare și referința](docs://uitleg-voortgang)), sau azi, dacă proiectul nu are o dată a raportului de stare. *Următoarele 4 săptămâni* se numără de la această zi. Dacă mutați data raportului de stare, intervalul se mută odată cu ea.

## Pași

### 1. Setați data raportului de stare

Dacă lucrați cu o alegere relativă, de exemplu *Următoarele 4 săptămâni* sau *Luna trecută*, setați mai întâi data raportului de stare. Alegeți *Planificare › Referințe și progres* și completați câmpul *Data raportului de stare*. Cu crucea de lângă el (*Golire data raportului de stare*) ștergeți din nou data. Dacă lucrați cu o perioadă fixă (pasul 4), nu aveți nevoie de acest lucru.

### 2. Alegeți un raport cu perioadă

Deschideți fila *Raport* și alegeți unul dintre cele cinci rapoarte la *Tip de raport*. Lista *Perioadă raport:* se află sub *Opțiuni de raport*. Pentru Diagrama resurselor se află sub *Setări*, sub cele patru casete de validare ale acelui raport.

Fiecare raport își reține propria perioadă. Acestea sunt valorile inițiale:

- *Look-ahead*: *Luna următoare*.
- *Raport de progres*: *Luna trecută*.
- *Încărcarea resurselor*, *Atribuiri de resurse* și *Diagrama resurselor*: *Durata proiectului*.

### 3. Alegeți o perioadă din listă

Lista conține *Săptămâna următoare*, *Următoarele 2 săptămâni*, *Următoarele 4 săptămâni*, *Următoarele 6 săptămâni*, *Următoarele 8 săptămâni*, *Următoarele 12 săptămâni*, *Luna următoare*, aceleași șapte cu *Ultimele*, *Durata proiectului* și *Personalizat*. Sub listă se află *De la* și *Până la*, cu datele pe care le produce alegerea. Aici le puteți doar citi.

Ambele zile se numără. Dacă data raportului de stare este joi, 20 mai, *Săptămâna următoare* se întinde de la 20 până la 26 mai inclusiv, iar *Următoarele 4 săptămâni* de la 20 mai până la 16 iunie inclusiv (28 de zile). *Luna următoare* se întinde până la o zi înainte de aceeași dată din luna următoare, aici până la 19 iunie inclusiv. *Ultimele 2 săptămâni* se întind de la 7 până la 20 mai inclusiv.

*Durata proiectului* ia planificarea de la primul început până la ultimul sfârșit.

### 4. Sau alegeți Personalizat

Cu *Personalizat*, *De la* și *Până la* devin două câmpuri de dată. Ele pornesc cu datele alegerii anterioare. Completați ambele, de exemplu 1 și 14 iunie. Dacă introducerea nu este corectă, raportul rămâne la ultima perioadă validă și afișează cu roșu:

- *Data de sfârșit este înaintea datei de început.* dacă *Până la* este mai devreme decât *De la*.
- *Completați ambele date.* dacă unul dintre cele două câmpuri este gol.

### 5. Citiți perioada în raport

Pentru Look-ahead, Încărcarea resurselor și Atribuiri de resurse perioada se află sub titlu, de exemplu *Perioadă: 20-05-2027 – 19-06-2027*. Dacă alegeți *Durata proiectului*, în spatele datelor se adaugă *Durata proiectului*. Raportul de progres arată perioada în rezumat, la *Perioadă*. Diagrama resurselor lasă axa de timp să se întindă exact peste perioadă.

### Ce face perioada pentru fiecare raport

Perioada nu funcționează la fel în fiecare raport.

- **Look-ahead** ia activitățile nefinalizate care ating perioada, chiar dacă acoperă întreaga perioadă. Activitățile întârziate din dinaintea zilei de referință sunt incluse și ele, atât timp cât sfârșitul perioadei nu este înaintea zilei de referință. O perioadă personalizată complet în trecut este o privire în urmă: arată doar ce era în desfășurare atunci și încă nu era finalizat, fără restanța de azi.
- **Raport de progres** folosește perioada pentru *Finalizate în perioada trecută*. Secțiunea *Încep în perioada următoare* privește înainte de la data raportului de stare, până la data de la *Previziune până la* din rezumat. Dacă alegeți o perioadă din categoria *Ultimele*, raportul privește înainte pe cât privește înapoi: cu *Ultimele 2 săptămâni* și data raportului de stare 20 mai, raportul afișează *Previziune până la* 3 iunie. O perioadă personalizată sau *Durata proiectului* care se află complet în trecut nu se oglindește.
- **Încărcarea resurselor** arată, integral, fiecare săptămână sau lună care atinge perioada. Dacă perioada dumneavoastră se întinde de miercuri până miercuri, vedeți deci săptămâni întregi, astfel încât un rând arată întotdeauna aceeași cifră ca histograma.
- **Atribuiri de resurse** arată atribuirile activităților care ating perioada. Cu *Durata proiectului* nu se filtrează după dată.
- **Diagrama resurselor** arată doar activitățile care ating perioada. În rezumat, *În afara perioadei:* numără câte activități au fost lăsate deoparte.

## Greșeli frecvente și ce face aplicația

**Nu există dată a raportului de stare.** Aplicația folosește atunci azi. Pentru cele patru rapoarte-tabel cu perioadă (*Look-ahead*, *Raport de progres*, *Încărcarea resurselor* și *Atribuiri de resurse*) apare sus, la o perioadă relativă, *Nu este setată data raportului de stare — raportul calculează cu data de azi (29-09-2026).*, cu data dumneavoastră de azi. Diagrama resurselor nu afișează acest lucru. Uitați-vă deci la *De la* și *Până la*: atunci se află în jurul zilei de azi, nu în jurul planificării dumneavoastră.

**Perioada se află în afara planificării dumneavoastră.** Atunci raportul este gol. Diagrama resurselor afișează acest lucru cu *Nicio activitate în perioada raportului — alegeți altă perioadă sau Întregul proiect.* (în listă, această alegere se numește *Durata proiectului*). În celelalte rapoarte vedeți zero activități sau niciun rând.

**Datele sunt în notația dumneavoastră.** *De la* și *Până la* urmează notația datei din setările dumneavoastră, cu excepția câmpurilor de dată din *Personalizat*: acestea arată notația browserului dumneavoastră.

**Perioada se mută odată cu timpul.** O alegere relativă, de exemplu *Luna următoare*, se stabilește din nou de fiecare dată: dacă data raportului de stare se schimbă, sau, fără dată a raportului de stare, dacă trece o zi, perioada se mută imediat. Dacă doriți o perioadă fixă, alegeți *Personalizat*.

**Alegerea se aplică tuturor proiectelor dumneavoastră.** O perioadă personalizată se aplică și ea tuturor proiectelor dumneavoastră de pe acest dispozitiv, nu doar proiectului deschis.

## Vezi și

- [Crearea și tipărirea unui raport](docs://howto-rapport-maken-en-afdrukken): tot traseul de la tipul de raport până la PDF.
- [Progres, data raportului de stare și referința](docs://uitleg-voortgang): ce este data raportului de stare și de ce aplicația calculează cu ea.
- [Rezolvarea supraalocării](docs://howto-overbezetting-oplossen): ce faceți cu săptămânile cu supraalocare din Încărcarea resurselor.
- [Tipuri de raport](docs://ref-rapporttypes): toate tipurile de raport și opțiunile lor.
