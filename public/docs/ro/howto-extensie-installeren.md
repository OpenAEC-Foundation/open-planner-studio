# Instalarea și gestionarea unei extensii

Obiectiv: instalați o extensie, citiți întrebarea despre permisiuni și, mai târziu, dezactivați sau ștergeți extensia.

## Când aveți nevoie de acest lucru

O extensie adaugă ceva în aplicație fără să așteptați o versiune nouă. De exemplu, o extensie poate adăuga un format de import care apare în *Fișier › Importare*, poate pune un buton în panglică sau poate furniza un font pentru exportul PDF. Catalogul oficial le împarte în categorii: *Import/Export*, *Planificare*, *Rapoarte*, *Utilitare*, *Fonturi* și *Altele*.

Gândiți-vă bine înainte să instalați una. O extensie este cod de program care rulează cu aceleași drepturi ca aplicația însăși, iar aplicația nu o poate restricționa. De aceea, aplicația cere permisiunea la fiecare instalare. Ce vedeți în această întrebare este explicat mai jos.

## Pași

### Instalarea unei extensii din catalog

1. Alegeți *Fișier › Extensii*.
2. Alegeți fila *Răsfoire*. Aplicația descarcă catalogul cât timp afișează *Se încarcă catalogul...*. Ce se află în catalog este stabilit de OpenAEC Foundation, care îl întreține, și acest lucru se poate schimba.
3. Căutați o extensie în câmpul *Căutați extensii...*. Aplicația caută după nume, descriere, autor și etichete.
4. Fiecare card arată nume, versiune, categorie, descriere și autor. Faceți clic pe *Instalare*.
5. Se deschide fereastra *Instalați extensia?*. Citiți-o, apoi vedeți pasul următor.
6. Faceți clic pe *Instalare* pentru a continua. Cu *Anulare* nu se întâmplă nimic. Tasta Esc sau un clic lângă fereastră înseamnă, de asemenea, refuz, iar aplicația nu afișează atunci niciun mesaj de eroare.

După instalare, extensia este activată imediat. Pe cardul din *Răsfoire* scrie acum *Instalată*. Ce adaugă extensia vedeți în aplicația însăși: un buton nou în panglică sau un format de import în *Fișier › Importare*. Unele extensii afișează și un mesaj. Îl recunoașteți după prefixul *Extensie*, urmat de numele extensiei.

### Instalarea unei extensii dintr-un fișier

Dacă ați primit o extensie ca fișier, instalați-o astfel.

1. Alegeți *Fișier › Extensii*.
2. În dreapta sus, faceți clic pe *ZIP* pentru un fișier ZIP sau pe *JS* pentru un fișier JavaScript separat.
3. Alegeți fișierul. Se deschide fereastra *Instalați extensia?*, ca mai sus.

Un fișier ZIP trebuie să conțină un `manifest.json` și fișierul principal al extensiei. Dacă instalați o extensie care este deja instalată, versiunea nouă o înlocuiește pe cea veche. Dacă aplicația nu poate instala fișierul, de exemplu pentru că un fișier ZIP este deteriorat, nu se întâmplă nimic: aplicația nu afișează niciun mesaj de eroare pentru ZIP și JS, iar extensia nu apare în listă. Motivul apare totuși în terminalul de depanare. Activați-l din *Setări › Proiect › Setări*, fila *Avansat*, *Activare terminal de depanare*, apoi deschideți-l cu butonul *Afișare terminal de depanare* din bara de stare. Acolo apare, de exemplu, *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (aplicația afișează acest text tehnic în limba olandeză).

### Citirea întrebării despre permisiuni

Întrebarea arată ce trebuie să decideți.

- *Autor* și *Depozit* arată cine a realizat extensia și unde se află codul sursă.
- *Proveniență* arată de unde vine fișierul: *Din catalogul online de extensii*, *Dintr-un fișier ZIP de pe acest calculator* sau *Dintr-un fișier JavaScript de pe acest calculator*. Dedesubt se arată dacă fișierul a fost verificat. Pentru catalog scrie *Descărcarea a fost verificată cu suma de control din catalog.* Dacă catalogul nu are sumă de control, scrie cu roșu *Catalogul nu oferă o sumă de control; această descărcare nu a fost verificată.* Pentru un fișier ales de dumneavoastră scrie *Dumneavoastră ați ales acest fișier; nu există o sursă externă pentru verificare.*
- *Ce acceptați* arată: *O extensie este cod de program care rulează cu aceleași drepturi ca Open Planner Studio însuși. Nimic nu o limitează. Instalați doar extensii ale căror autori vi se par de încredere.* Dedesubt se arată ce înseamnă asta pe platforma dumneavoastră. În aplicația desktop scrie *În aplicația desktop înseamnă, printre altele: citirea și scrierea fișierelor din tot folderul de utilizator, plus acces la proiectele, setările și clipboardul dumneavoastră.* În browser scrie *În browser înseamnă: acces la proiectele și setările salvate, la fișierele la care ați acordat acces și la rețea.*
- *Ce spune această extensie că folosește* arată permisiunile pe care le-a declarat autorul, ca etichete mici. Este o declarație a autorului și nu o restricție: *Aceasta este declarația autorului, nu o restricție: codul poate face oricum mai mult.* Dacă nu există nicio etichetă, scrie *Nimic declarat.* Asta nu înseamnă că extensia nu poate face nimic: chiar și fără etichete, o extensie poate citi și modifica datele planificării dumneavoastră și poate afișa mesaje.

Etichetele înseamnă următoarele:

- *ribbon*: extensia pune butoane în panglică.
- *events*: extensia urmărește evenimentele din aplicație.
- *backstage*: extensia adaugă formate de import în *Fișier › Importare*.
- *pdf-fonts*: extensia furnizează un font pentru exportul PDF.
- *importSource*: extensia poate citi octeții originali complet ai fiecărui fișier importat, de exemplu un fișier Primavera brut, inclusiv câmpuri care nu ajung în proiectul dumneavoastră. Fereastra explică și ea acest lucru.
- *help*: extensia poate adăuga articole de ajutor, poate deschide proiecte incluse ca document nou și poate afișa un ghid care indică părți din aplicație. Fereastra explică și ea acest lucru.
- *filesystem* și *network*: acestea arată doar ce intenționează autorul. Aplicația nu are nicio funcție pentru ele.

### Dezactivarea, reactivarea sau ștergerea unei extensii

1. Alegeți *Fișier › Extensii* și fila *Instalate*. Fiecare extensie are un card cu nume, versiune, categorie, descriere și autor.
2. Cu comutatorul de pe card dezactivați extensia (*Dezactivare*) sau o activați din nou (*Activare*). Când este dezactivată, butoanele și formatele de import pe care le adăugase extensia dispar, dar extensia rămâne instalată. Rămâne dezactivată și după o repornire a aplicației. O extensie activată pornește singură când pornește aplicația.
3. Faceți clic pe *Ștergere*. Butonul devine *Confirmare*, cu explicația *Faceți clic din nou pentru a șterge definitiv*. Faceți clic încă o dată pentru a șterge extensia. Aplicația șterge și setările pe care le-a stocat extensia.

## Probleme posibile și ce face aplicația atunci

**Catalogul nu se încarcă.** Apare *Nu s-a putut încărca catalogul:* cu motivul tehnic după el, și butonul *Reîncercare*. Cauza poate fi lipsa unei conexiuni la internet.

**Sub un card din catalog apare *Instalarea a eșuat.*** Descărcarea sau instalarea a eșuat, de exemplu pentru că suma de control nu a corespuns. Atunci nu s-a instalat nimic. Acest lucru este altceva decât refuzul întrebării, la care nu apare niciun mesaj de eroare.

**Deasupra listei apare *Intrări din catalog omise: 1*.** Catalogul conținea un element pe care aplicația nu îl poate folosi. Puteți instala celelalte extensii ca de obicei.

**O extensie nu pornește.** Cardul afișează atunci un mesaj de eroare, de exemplu că extensia are nevoie de o versiune mai nouă a Open Planner Studio, cu versiunea dumneavoastră curentă afișată, sau eroarea pe care a semnalat-o extensia însăși. Extensia nu este activă atunci. Actualizați aplicația sau ștergeți extensia.

**Un card cu *Carantină*.** Aplicația nu a putut folosi extensia stocată. Sub nume scrie *Motiv:* cu cauza. Cu *Ștergere din stocare* o curățați.

**Scrieți singur o extensie.** Ghidul pentru autorii de extensii (manifest, API, permisiuni) se află în depozitul `OpenAEC-Foundation/open-planner-studio` de pe GitHub, în fișierul `docs/extensions.md`.

**O extensie nu aparține unui proiect.** Extensiile sunt stocate în aplicație: în aplicația desktop, pe acest calculator, iar în browser, în spațiul de stocare al acelui browser. Ele se aplică tuturor proiectelor dumneavoastră și nu fac parte din fișierul proiectului. Dacă ștergeți datele site-ului din browser, extensiile dispar.

## Vezi și

- [Actualizarea aplicației](docs://howto-app-bijwerken): o extensie poate cere o versiune mai nouă a aplicației.
- [Permisiunile extensiilor](docs://ref-extensiepermissies): ce înseamnă fiecare permisiune din întrebarea de instalare.
