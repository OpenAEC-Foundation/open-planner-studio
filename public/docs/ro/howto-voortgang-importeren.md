# Importarea progresului dintr-o foaie de calcul

Scop: introduceți progresul pe care personalul de șantier îl completează într-o foaie de calcul direct în planificare, dintr-o dată, fără să faceți clic pe fiecare activitate.

## Când aveți nevoie de aceasta

Un subcontractant sau un responsabil de șantier nu are aplicația, dar își raportează starea în fiecare săptămână: câte procente sunt realizate, când a început și când s-a terminat. Dumneavoastră îi trimiteți o foaie cu activitățile dumneavoastră. Responsabilul completează trei coloane și trimite foaia înapoi. Din foaie, aplicația citește doar trei valori pentru fiecare activitate: procentul de finalizare, începutul efectiv și sfârșitul efectiv. Restul planificării dumneavoastră rămâne neschimbat. Ce face aplicația cu acest progres este explicat în [Progres, data raportului de stare și referința](docs://uitleg-voortgang).

## Pași

### 1. Setați data raportului de stare și calculați

Setați data raportului de stare, așa cum este descris în [Actualizarea progresului](docs://howto-voortgang-bijwerken). Responsabilul de șantier completează datele reale până la această zi inclusiv. Dacă planificarea nu este actualizată, aplicația o recalculează înainte de a crea foaia.

### 2. Creați foaia

Alegeți *Planificare › Progres › Exportare foaie de progres*. Același buton se află în filele *Tabel* și *Raport*. Aplicația creează un fișier Excel și propune numele *(numele proiectului)-voortgang.xlsx*. În browser, fișierul ajunge în descărcările dumneavoastră. Preferați un CSV? Alegeți *Fișier › Exportare › Foaie de progres (CSV)*. Foaia Excel există și ea, ca *Foaie de progres (Excel)*.

Foaia are opt coloane. Numele coloanelor rămân în engleză, urmate de o scurtă instrucțiune în limba aplicației:

- `OPS Task ID`, `WBS` și `Name` există doar pentru a recunoaște activitatea. Lăsați-le neschimbate.
- `Start` și `Finish` sunt datele planificate, doar pentru informare. Aplicația nu le scrie niciodată înapoi.
- `Completion (%)`, `Actual Start` și `Actual Finish` sunt câmpurile pe care le completați.

Foaia Excel este protejată, fără parolă: pot fi modificate doar cele trei coloane de completat. Excel verifică dacă un procent este între 0 și 100 și dacă o dată reală este o dată. O fază (activitate rezumat) este marcată cu gri, cu *— activitate rezumat: nu completați*.

### 3. Completarea foii

Pentru fiecare activitate, responsabilul de șantier completează:

- `Completion (%)`: de la 0 până la 100 inclusiv. În foaia Excel sunt permise zecimale (de exemplu 33,3). În CSV, instrucțiunea cere numere întregi.
- `Actual Start` și `Actual Finish`: în Excel ca dată, conform setării regionale proprii; în CSV ca zz-ll-aaaa.

Ce rămâne gol nu modifică nimic. Deci o celulă goală nu șterge nici progresul existent; asta se poate face doar în aplicație. Pentru o activitate care nu a început, celulele rămân complet goale.

### 4. Citirea foii în aplicație

1. Alegeți *Planificare › Progres › Actualizare progres din foaie de calcul* (de asemenea în filele *Tabel* și *Raport*), sau *Fișier › Importare › Actualizare progres din foaie de calcul*. Se deschide fereastra *Actualizare progres din foaie de calcul*.
2. Faceți clic pe *Alegere fișier…* și alegeți fișierul `.xlsx` sau `.csv` completat.
3. Dacă datele dintr-un CSV sunt ambigue, aplicația întreabă *Ziua sau luna pe primul loc?*, cu data din fișierul dumneavoastră citită în două moduri. Faceți clic pe data corectă.
4. Acum vedeți o previzualizare. Sus sunt patru contoare: *Aplicate*, *Neschimbate*, *În așteptarea legării* și *Refuzate*. Dedesubt, pentru fiecare activitate, este indicat ce se schimbă, de exemplu *Procent de finalizare: 0% → 100%*.
5. Controlați previzualizarea și faceți clic pe *Aplicare*. Fereastra afișează *Rezultat*, cu contoarele și rândurile refuzate, împreună cu motivul. Terminați cu *Închidere*.

Nu puteți sări peste previzualizare. Butonul *Aplicare* este dezactivat cât timp nu există nimic de aplicat.

### 5. Recalculați planificarea

Citirea nu recalculează singură. Apăsați **Calculare** (F5), de exemplu prin *Planificare › Planificare › Calculare*, dacă *Calculare automată* nu este activată.

## Rânduri care nu se potrivesc direct

Aplicația leagă fiecare rând de o activitate, întâi după `OPS Task ID` și altfel după numărul WBS.

**Legarea este incertă.** Dacă aplicația a găsit activitatea doar după numărul WBS, rândul se află sub *Legarea este incertă*, cu *Confirmare* și *Modificare*. Rândul se aplică și dacă nu faceți nimic. Verificați deci că activitatea este corectă. *Confirmare* scoate rândul din această listă; nu schimbă nimic din ce se aplică. *Modificare* vă lasă să alegeți altă activitate. Cu *Ștergere legare* eliminați o legare pe care ați făcut-o dumneavoastră. Notă: o foaie dintr-un alt proiect cu aceleași numere WBS se leagă totuși, sub *Legarea este incertă*, și se aplică atunci când faceți clic pe *Aplicare*.

**În așteptarea legării.** Dacă aplicația nu a găsit nicio activitate sau mai multe cu același număr WBS, rândul se află sub *În așteptarea legării*. La *Alegeți o activitate…* alegeți activitatea corectă. Căutați după numărul WBS sau după nume. Dacă nu legați rândul, acesta este refuzat.

## Greșeli frecvente și ce face aplicația

Un rând care nu se potrivește este refuzat, cu un motiv. Restul foii continuă să fie procesat. Acestea sunt mesajele principale:

- *Data reală este după data raportului de stare.* Setați data raportului de stare mai târziu sau corectați foaia.
- *Această activitate este planificată să înceapă după data raportului de stare. Completați mai întâi începutul efectiv în foaie.* Aplicația nu inventează un început; furnizați-l în foaie.
- *Procent în afara intervalului 0–100. Verificați separatorul zecimal: 8,38 poate fi citit ca 838 de o foaie de calcul cu altă setare regională.*
- *Activitățile rezumat nu pot primi progres dintr-o foaie.* Progresul unei faze rezultă din activitățile de sub ea.
- *Sfârșitul efectiv este înainte de începutul efectiv.*
- *Dată ilizibilă.* și *Procent ilizibil.*
- *Valorile introduse se contrazic.* De exemplu, un sfârșit efectiv cu un procent sub 100.
- *Nicio activitate găsită pentru acest rând.* Foaia menționează un ID de activitate și un număr WBS care nu apar în acest proiect.
- *Acest cod WBS apare la mai multe activități. Legați rândul manual.*
- *Un alt rând a revendicat deja această activitate.* Două rânduri indică aceeași activitate.
- *Refuzat de planificator.* Un alt refuz din partea planificării în sine, fără un mesaj propriu.

Dacă este refuzat întregul fișier, apare unul dintre aceste mesaje în fereastră: *Acest fișier nu are nicio coloană “OPS Task ID” sau “WBS” pentru a lega rândurile de activități.*, *Acest fișier nu are nicio coloană de tipul Procent de finalizare, Început efectiv sau Sfârșit efectiv.*, *Acest fișier este prea mare pentru a fi citit ca foaie de progres.* (mai mult de 16 MB), *Acest fișier are prea multe rânduri pentru a fi citit ca foaie de progres.* (mai mult de 50.000 de rânduri), sau *Acest fișier este protejat cu parolă și nu poate fi citit.*, sau *Acest fișier nu a putut fi citit ca foaie de progres.*

**Lipsește data raportului de stare.** Dacă nu există încă o dată a raportului de stare și importul aplică progres, aplicația o setează la data de azi și vă informează. Setați-o deci dumneavoastră mai întâi.

**Anulare totală dintr-o dată.** Întreaga foaie este un singur pas pentru Ctrl+Z.

**Doar ce completați.** Un rând fără nicio diferență față de planificare se numără la *Neschimbate*. O activitate fără rând în foaie rămâne așa cum era.

## Vezi și

- [Progres, data raportului de stare și referința](docs://uitleg-voortgang): ce calculează aplicația cu datele reale și procentele.
- [Actualizarea progresului](docs://howto-voortgang-bijwerken): introducerea progresului direct în aplicație.
