# Deschiderea și salvarea unui fișier

Obiectiv: deschideți un proiect dintr-un fișier și păstrați modificările.

## Când aveți nevoie de aceasta

Începeți ziua cu proiectul de ieri, primiți un fișier de la un coleg sau dintr-un alt pachet, ori doriți să salvați o stare intermediară înainte de o modificare mare. Ce păstrează aplicația într-un fișier, și de ce numai IFC păstrează întregul proiect, este explicat în [Fișiere și formate](docs://uitleg-bestanden).

## Pași

### Deschiderea unui fișier

1. Alegeți *Acasă › Fișier › Deschidere*, sau *Fișier › Deschidere*, ori apăsați Ctrl+O (⌘+O pe Mac). *Deschidere* se află și în bara din partea de sus. Grupul *Fișier* se află și pe fila *Tabel*.
2. Alegeți fișierul. Deschideți câte un fișier o dată. Pe desktop și în browsere cu acces la fișiere, cum sunt Chrome și Edge, fereastra afișează o listă de tipuri de fișiere: *Toate formatele acceptate*, *Fișiere IFC*, *Fișiere CSV*, *Fișiere XML*, *Fișiere MS Project* și *Fișiere Primavera XER*.
3. Proiectul se deschide într-o filă nouă. Dacă fila curentă era încă goală și nemodificată, proiectul se deschide în ea.

Un fișier IFC transmite numele fișierului către filă. Un proiect din alt format primește numele proiectului său.

Aplicația deschide `.ifc`, `.csv`, `.xml` (MS Project XML sau Primavera P6 XML), `.mpp` și `.xer`. Pentru ultimele două există pași separați în [Deschiderea unui fișier MS Project (.mpp)](docs://howto-mpp-openen) și [Deschiderea unui fișier Primavera P6 (.xer)](docs://howto-xer-openen).

### Deschiderea unui proiect recent

Alegeți *Acasă › Fișier › Recente* și faceți clic pe un fișier din listă, sau alegeți *Fișier › Recente*. Lista păstrează ultimele zece fișiere pe care le-ați deschis, salvat sau exportat. Aplicația de desktop afișează calea pentru fiecare fișier, un browser afișează doar numele.

Dacă aplicația nu mai poate citi un fișier din listă, de exemplu pentru că l-ați mutat, acesta dispare din listă fără mesaj. În browserele fără acces la fișiere, cum este Firefox, *Recente* rămâne goală.

### Deschiderea unui exemplu

Alegeți *Fișier › Exemple* și faceți clic pe un proiect exemplu. Acesta se deschide într-o filă, fără fișier: *Salvare* vă întreabă, prin urmare, unde doriți să îl păstrați.

### Salvarea

Alegeți *Acasă › Fișier › Salvare* sau *Fișier › Salvare*, ori apăsați Ctrl+S. Ce se întâmplă atunci depinde de proiectul dumneavoastră:

1. Dacă proiectul are deja un fișier, pentru că ați deschis un fișier IFC sau l-ați salvat înainte, aplicația scrie în acel fișier. Nu apare nicio fereastră.
2. Dacă proiectul nu are încă un fișier, aplicația întreabă unde trebuie să fie salvat. Propune numele proiectului cu `.ifc`. După aceea, acel fișier devine fișierul proiectului.
3. Dacă browserul dumneavoastră salvează doar prin descărcare (ca Firefox), fișierul ajunge în folderul Descărcări, iar fiecare salvare creează o descărcare nouă. Prima dată într-o sesiune vedeți mesajul *Salvat ca descărcare: „name.ifc” se află în folderul Descărcări. Acest browser nu permite aplicației să scrie într-un loc propriu, astfel că fiecare salvare creează o descărcare nouă. În Chrome, Edge sau aplicația de desktop, salvarea actualizează pur și simplu același fișier.*
4. Dacă browserul dumneavoastră nu poate scrie înapoi în fișierul proiectului, aplicația întreabă din nou unde să pună fișierul la fiecare salvare. Arată ca *Salvare ca*, dar este o limită a browserului. Prima dată într-o sesiune, mesajul *Acest browser nu permite aplicației să scrie înapoi în „name.ifc”.* explică acest lucru, cu o legătură către [Fișiere](docs://uitleg-bestanden).

După salvare, marcajul *Nesalvat* dispare: punctul de pe filă, asteriscul dinaintea numelui proiectului din partea de sus și textul *Nesalvat* din colțul din dreapta jos al barei de stare.

### Salvarea sub alt nume

Alegeți *Acasă › Fișier › Salvare ca* sau *Fișier › Salvare ca*, ori apăsați Ctrl+Shift+S. Alegeți un nume și un loc (în Firefox, aplicația descarcă un fișier nou). După aceea, aplicația lucrează cu acest fișier nou: următoarea *Salvare* scrie acolo. Fișierul vechi rămâne așa cum era la ultima dată când l-ați salvat.

### Închiderea unui proiect

Faceți clic pe crucea de pe filă sau alegeți *Fișier › Închidere proiect*. Dacă proiectul are modificări pe care nu le-ați salvat, aplicația întreabă: *Modificări nesalvate: „name” are modificări care nu au fost salvate încă.* Alegeți *Anulare* (proiectul rămâne deschis), *Fără salvare* (proiectul se închide, iar modificările dumneavoastră se pierd) sau *Salvare* (salvați mai întâi, apoi închideți). Dacă închideți întreaga aplicație pe desktop (cu butonul de închidere, cu Alt+F4 sau cu meniul sistemului de operare), aplicația întreabă acest lucru pentru fiecare proiect cu modificări. *Anulare* sau o salvare care eșuează oprește închiderea. După o astfel de închidere normală, aplicația șterge copiile de recuperare ale acelei sesiuni, astfel că fereastra de recuperare apare doar după o prăbușire reală. Dacă un proiect are modificări și închideți fila sau fereastra browserului, browserul cere confirmare.

## Capcane și ce face aplicația atunci

**Un fișier IFC deschis devine imediat fișierul proiectului dumneavoastră.** *Salvare* suprascrie acel fișier, chiar dacă provine dintr-un alt program. Dacă doriți să păstrați originalul, alegeți mai întâi *Salvare ca*.

**Celelalte formate nu se suprascriu niciodată.** Un fișier `.csv`, `.xml`, `.mpp` sau `.xer` nu are niciun fișier după deschidere. *Salvare* scrie un fișier IFC nou și lasă originalul neatins.

**În Firefox, fiecare salvare creează un fișier nou.** Aplicația nu poate scrie acolo în fișierul dumneavoastră. Ea descarcă un fișier nou de fiecare dată, cu numele proiectului drept nume de fișier, nu cu numele fișierului pe care l-ați deschis.

**Chrome și Edge cer permisiune.** La prima *Salvare* a unui fișier deschis, browserul întreabă dacă aplicația are voie să scrie în el. Dacă refuzați, aplicația deschide o fereastră în care alegeți un fișier nou. În Chrome și Edge primiți și această fereastră dacă scrierea în fișierul existent eșuează, de exemplu pentru că fișierul a dispărut sau este blocat.

**Salvarea poate eșua.** Dacă apare o eroare la salvarea în sine, aplicația afișează *Salvarea a eșuat*, cu motivul. Proiectul rămâne deschis și este marcat în continuare ca *Nesalvat*.

## Vezi și

- [Fișiere și formate](docs://uitleg-bestanden): ce conține un fișier IFC și cum tratează aplicația formatele.
- [Activarea salvării automate](docs://howto-automatisch-opslaan): lăsarea aplicației să își actualizeze singură fișierul.
- [Exportul](docs://howto-exporteren): crearea unei copii într-un alt format.
- [Recuperarea după o prăbușire](docs://howto-herstellen-na-een-crash): ce faceți dacă aplicația nu s-a închis corect.
- [Formate de import și export](docs://ref-import-exportformaten): pentru fiecare format, ce se transferă și ce nu.
