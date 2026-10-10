# Gestionarea și partajarea bibliotecilor de resurse

Obiectiv: creați și ștergeți biblioteci de resurse, adăugați calendare în ele și exportați sau importați o bibliotecă, ca copie de rezervă sau ca s-o folosiți pe alt calculator.

## Când aveți nevoie de aceasta

Biblioteca de resurse nu se află în fișierele proiectului, ci în aplicație: în aplicația desktop, într-un fișier de pe acest calculator; în browser, în spațiul de stocare al acelui browser. Nu se sincronizează. Dacă ștergeți datele site-ului din browser, biblioteca se pierde; de aceea exportați-o ca copie de rezervă. Dacă un coleg dorește să lucreze cu aceleași echipe și aceleași tarife standard, îi predați biblioteca și sub formă de fișier. Dacă organizația dumneavoastră are mai multe companii de exploatare, cu echipele lor, creați câte o bibliotecă separată pentru fiecare. Pentru un proiect nou alegeți biblioteca pe care o folosește.

Ce este o bibliotecă, aflați în [Biblioteca de resurse](docs://uitleg-resourcebibliotheek). Resursele în sine nu le editați aici, ci în panoul de resurse; vezi [Utilizarea bibliotecii de resurse](docs://howto-resourcebibliotheek-gebruiken).

## Pași

### Deschideți ecranul de gestionare

Alegeți *Fișier › Bibliotecă*. În stânga se află lista *Biblioteci de resurse*. În dreapta se află detaliile bibliotecii pe care faceți clic: numele, butoanele și lista *Calendare*. Sus scrie că resursele le gestionați în fila *Resurse*.

### Creare, redenumire și alegerea unei biblioteci implicite

1. Faceți clic pe semnul plus de deasupra listei (*Adăugare bibliotecă de resurse*). Se adaugă o bibliotecă *Bibliotecă de resurse nouă*, iar aceasta este selectată imediat.
2. Scrieți noul nume în câmpul de nume din partea de sus a părții din dreapta și apăsați Enter, sau faceți clic în afara câmpului. Aplicația nu acceptă un nume gol.
3. Faceți clic pe *Setare ca implicită*, ca această bibliotecă să fie preselectată pentru proiectele noi de acum înainte. Biblioteca implicită are o stea în listă.

### Adăugarea unui calendar în bibliotecă

1. Sub *Calendare*, faceți clic pe *Din proiect*. Se deschide o listă cu calendarele proiectului activ.
2. Faceți clic pe săgeata mică de după calendarul pe care doriți să îl preluați. Deasupra listei scrie *Adăugat.* Un calendar care este deja legat de această bibliotecă are *deja legat* după nume.
3. Calendarul se află acum în lista *Calendare* a bibliotecii. Cu creionul (*Editare*) schimbați numele și salvați cu semnul de bifare. Coșul de gunoi șterge calendarul imediat, fără confirmare. Copiile din proiecte rămân.

După *Calendare* apare un număr de versiune, de exemplu *v2*. Acesta crește cu fiecare modificare a bibliotecii. Un calendar din bibliotecă ajunge în proiect când atribuiți o resursă care îl folosește. Îl atribuiți unei resurse în *Resurse*, vizualizarea *Bibliotecă de resurse*, în coloana *Calendar*.

### Exportarea unei biblioteci

1. Alegeți biblioteca din listă.
2. Faceți clic pe *Exportare*.
3. În aplicația desktop și în Chrome și Edge alegeți unde se salvează fișierul. În celelalte browsere, fișierul merge direct în folderul de descărcări, iar aplicația vă informează despre aceasta. Fișierul se numește `bibliotheek-` urmat de numele bibliotecii, cu extensia `.ifc`.

Sub butoane scrie *Exportarea este și copia de rezervă: păstrați fișierul într-un loc sigur.*

### Importarea unei biblioteci

1. Faceți clic pe *Importare*. Se deschide fereastra *Importare bibliotecă* pentru biblioteca pe care o aveați selectată în listă.
2. Faceți clic pe *Alegere fișier…* și alegeți fișierul `.ifc` al unei exportări. Dacă fișierul nu conține o bibliotecă, apare mesajul *Acest fișier IFC nu conține o bibliotecă de resurse.*
3. Aplicația arată ce conține, de exemplu *2 calendare, 5 resurse (versiunea 3).*
4. Alegeți ce doriți să faceți cu fișierul, vezi mai jos.
5. Faceți clic pe *Adăugare* sau pe *Înlocuire*, ori pe *Anulare* pentru a opri.

Aveți două variante:

- *Adăugare ca bibliotecă de resurse nouă*: fișierul devine o bibliotecă separată, alături de cele existente. Dedesubt scrie sub ce nume, de exemplu *Va fi adăugată ca „Mijn resourcebibliotheek (2)”.* Nimic nu se pierde, iar proiectul activ rămâne legat de propria bibliotecă.
- *Înlocuire bibliotecă de resurse existentă*: întregul conținut al bibliotecii alese se înlocuiește cu cel din fișier. Aplicația o spune și ea: *Importarea înlocuiește ÎNTREG conținutul comun al bibliotecii de resurse alese.* Dacă aveți două sau mai multe biblioteci, alegeți care sub *Importare în bibliotecă de resurse*. Dacă biblioteca dumneavoastră este mai nouă decât fișierul, aplicația avertizează: *Biblioteca locală este mai nouă — importarea poate suprascrie modificările dumneavoastră.*

Aplicația propune singură o variantă. Pentru un fișier care conținea biblioteca implicită, este preselectată *Adăugare ca bibliotecă de resurse nouă*. Dacă biblioteca din fișier există deja pe calculatorul dumneavoastră și nu este cea implicită, este preselectată *Înlocuire bibliotecă de resurse existentă*, cu exact această bibliotecă aleasă. Dacă nu sunteți sigur, alegeți adăugarea: aceasta nu suprascrie nimic.

### Ștergerea unei biblioteci

1. Alegeți biblioteca din listă și faceți clic pe *Ștergere bibliotecă de resurse*. Butonul este gri la ultima bibliotecă, pentru că una rămâne întotdeauna.
2. Confirmați cu *Ștergere*. Întrebarea este *Ștergeți această bibliotecă de resurse?* Dacă proiecte deschise sunt legate de ea, apare: *Această bibliotecă de resurse este legată de 1 proiect deschis. Ștergerea dezleagă acel proiect. Continuați?* Pentru mai multe proiecte apare același text cu numărul corect, de exemplu *legată de 2 proiecte deschise*.

Biblioteca se șterge apoi, cu toate resursele și calendarele din ea. Proiectele deschise care o foloseau se dezleagă: resursele lor rămân resurse obișnuite ale proiectului. Exportați mai întâi dacă doriți să păstrați conținutul.

### Transmiterea unui proiect împreună cu biblioteca sa

Un fișier de proiect conține propriile copii ale resurselor. Dacă doriți să predați și întreaga bibliotecă, procedați astfel. Exportarea în sine este descrisă și în [Exportarea](docs://howto-exporteren).

1. Deschideți un proiect legat de o bibliotecă și alegeți *Fișier › Exportare*.
2. Bifați *Salvare fișier bibliotecă alături*. Caseta apare numai pentru un proiect legat.
3. Alegeți cardul *IFC 4x3* și salvați fișierul. Apoi aplicația cere și un al doilea fișier. Acesta are numele proiectului, urmat de `-bibliotheek`, și conține biblioteca.

Caseta de bifare funcționează numai pentru exportul IFC, nu și pentru celelalte formate. Colegul dumneavoastră importă al doilea fișier, cum s-a descris mai sus.

## Capcane și ce face aplicația atunci

**Doi planificatori, două biblioteci.** Aplicația nu sincronizează bibliotecile între calculatoare. Fereastra de import afișează întotdeauna un avertisment: *Notă: bibliotecile nu se sincronizează între calculatoare. Dacă doi planificatori lucrează cu aceeași bibliotecă de resurse, bibliotecile pot diverge. Dacă organizația dumneavoastră împarte echipele între companiile de exploatare, alegeți deliberat un conținut comun.*

**Înlocuirea suprascrie totul.** Tot ce aveați în biblioteca aleasă dispare, iar o modificare a bibliotecii nu poate fi anulată cu *Anulare*. Exportați mai întâi dacă nu sunteți sigur.

**Ștergerea unui calendar din listă se face imediat.** Aplicația nu cere confirmare, spre deosebire de ștergerea unei resurse. Aceasta pare o lipsă. Modificările bibliotecii nu pot fi anulate cu *Anulare*.

## Vezi și

- [Biblioteca de resurse](docs://uitleg-resourcebibliotheek): cum se leagă biblioteca și proiectul între ele.
- [Utilizarea bibliotecii de resurse](docs://howto-resourcebibliotheek-gebruiken): legarea resurselor, atribuirea lor și rezolvarea abaterilor.
- [Exportarea](docs://howto-exporteren): formatele de export, inclusiv IFC cu fișier de bibliotecă.
