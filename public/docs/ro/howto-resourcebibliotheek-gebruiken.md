# Utilizarea bibliotecii de resurse

Scop: utilizați resursele din biblioteca de resurse în proiectul dumneavoastră și treceți în bibliotecă o resursă pe care ați creat-o într-un proiect, astfel încât toate proiectele să folosească aceleași date.

## Când aveți nevoie de acest lucru

Aveți o echipă fixă de zidari, o macara și un tencuitor, care apar în mai multe proiecte. Fără bibliotecă le introduceți din nou în fiecare proiect, cu riscul unor nume și tarife standard diferite, iar niciun proiect nu vede că și alt proiect cere aceeași echipă. În biblioteca de resurse le înregistrați o singură dată.

Ce este biblioteca de resurse și ce preia un proiect din ea, aflați în [Biblioteca de resurse](docs://uitleg-resourcebibliotheek). Acest articol se ocupă de acțiuni. Crearea, exportul și ștergerea bibliotecilor de resurse sunt descrise în [Gestionarea și partajarea bibliotecilor de resurse](docs://howto-bibliotheken-beheren).

## Pași

### 1. Legați proiectul de o bibliotecă

Lucrați cu biblioteca de resurse numai dacă proiectul este legat de ea. Fără legătură, panoul *Resurse* nu afișează comutatorul *Bibliotecă*, *Proiect* și *Ocupare*.

Pentru un proiect nou:

1. Alegeți *Fișier › Nou*. Se deschide fereastra *Creare proiect nou*.
2. Uitați-vă la *Bibliotecă de resurse*. Câmpul este setat pe biblioteca implicită. Puteți alege alta, *fără bibliotecă (proiect independent)* sau *+ Bibliotecă de resurse nouă…*.
3. Faceți clic pe *Creare*.

Pentru un proiect existent:

1. Alegeți *Fișier › Informații proiect*.
2. Sub *Bibliotecă de resurse*, alegeți biblioteca.
3. Faceți clic pe *Aplicare*. Până atunci, în partea de jos scrie *Modificările nu au fost aplicate — faceți clic pe Aplicare pentru a le păstra.*

Dacă proiectul are deja resurse cu același nume ca un element din bibliotecă, se deschide fereastra *Legare bibliotecă de resurse* cu secțiunea *Recunoaștere*. Fiecare resursă cu o potrivire afișează *Sugestie: Bricklayer*. Faceți clic pe *Legare* ca să legați acea resursă, sau pe *Legarea tuturor sugestiilor*, dacă există mai multe sugestii. Aplicația compară numele fără să țină cont de majuscule sau de spațiile duble. La legare, resursa preia numele, tipul, tariful standard, unitatea și descrierea din elementul bibliotecii. *Capacitate maximă* rămâne cea pe care o aveați în proiect. Fereastra arată și calendarele proiectului care au același nume ca un calendar din bibliotecă. Cu *Amânarea deciziei* închideți fereastra fără să legați.

### 2. Puneți o resursă în bibliotecă

1. Alegeți *Resurse › Gestionare › Resurse*. Panoul de resurse ocupă spațiul de lucru. Se deschide întotdeauna pe *Proiect*, chiar și pentru un proiect legat.
2. În dreapta sus, alegeți *Bibliotecă*. Deasupra tabelului scrie *Aceasta modifică biblioteca și se aplică tuturor proiectelor — nu poate fi anulată.*
3. Faceți clic pe *Resursă nouă în bibliotecă*. Apare un rând gol în partea de jos a tabelului.
4. Scrieți numele, de exemplu *Bricklayer*, și apăsați Enter. Resursa se află acum în bibliotecă, iar pentru următoarea se deschide imediat un rând gol. Apăsați Esc când ați terminat. Fără nume, aplicația nu creează nimic.
5. Completați restul rândului. Implicit, *Tip* este *Forță de muncă*. Sub *Capacitate maximă* introduceți câte exemplare din această resursă există în total, de exemplu 3 pentru trei zidari. Prezentarea generală a ocupării folosește acest număr ca capacitate. *Tarif standard/oră* este opțional. Puteți completa *Unitate de măsură* numai pentru tipul *Material*. Sub *Calendar* alegeți un calendar din bibliotecă sau *+ Calendar de resurse* ca să creați unul; vedeți [Configurarea unui calendar de resurse](docs://howto-resourcekalender-instellen). Aplicația salvează numele, tariful standard și unitatea când părăsiți câmpul, iar celelalte câmpuri imediat.

Fiecare modificare din bibliotecă se transmite imediat copiilor nemodificate din proiectele dumneavoastră deschise.

### 3. Atribuiți o resursă proiectului dumneavoastră

1. În vizualizarea *Bibliotecă*, alegeți *Atribuire la proiect* la resursa dorită. Deasupra tabelului scrie *Adăugat.* Dacă faceți clic din nou, scrie *Există deja în proiect.* și nu apare o a doua copie.
2. Alegeți *Proiect*. Copia apare în tabel, cu o mică pictogramă de bibliotecă lângă nume, numită *Din bibliotecă*. Numele, tipul, tariful standard și unitatea sunt text simplu. Dacă țineți cursorul peste ele, vedeți *Valoare din bibliotecă — modificați-o în vizualizarea Bibliotecă sau desprindeți această resursă de bibliotecă.*
3. Setați *Capacitate maximă* pentru acest proiect. Câmpul pornește cu valoarea din bibliotecă și rămâne editabil în proiect.
4. Atribuiți acum resursa activităților, ca pe orice altă resursă; vedeți [Atribuirea resurselor cu o curbă](docs://howto-resource-toewijzen). *Resurse › Atribuire › Atribuire* arată numai resursele care sunt deja în proiect, deci mai întâi atribuiți resursa din bibliotecă la proiect, în acest mod.

*Atribuire la proiect* există numai în vizualizarea *Bibliotecă* a unui proiect legat de acea bibliotecă.

### 4. Treceți o resursă din proiect în bibliotecă

Procedați astfel pentru o resursă pe care ați creat-o în proiect și o folosiți mai des, de exemplu o macara închiriată.

1. În vizualizarea *Proiect*, alegeți *Trecere în bibliotecă* la resursa dorită. Butonul apare numai la o resursă care are un nume și care nu provine încă din bibliotecă, într-un proiect legat.
2. Citiți mesajul de deasupra tabelului.

Mesajul poate spune trei lucruri:

- *Adăugat.* Biblioteca nu avea niciun element cu acest nume. A fost creat un element nou, iar resursa dumneavoastră este legată de el.
- *Exista deja în bibliotecă — acum este legat.* Exista un element cu același nume și aceleași date. Resursa dumneavoastră este legată de el.
- *Legat de elementul existent din bibliotecă — valorile diferă, vedeți marcajul.* Exista un element cu același nume, dar cu alte date. Resursa dumneavoastră este legată și primește imediat marcajul *diferă — decideți*. Continuați cu pasul 6.

### 5. Desprindeți o copie

Dacă doriți să vă abateți de la biblioteca de resurse într-un proiect, de exemplu cu un alt tarif standard, desprindeți copia.

1. În vizualizarea *Proiect*, faceți clic pe pictograma *Desprindere de bibliotecă* de la sfârșitul rândului.
2. Resursa devine o resursă obișnuită a proiectului. Toate câmpurile sunt editabile, iar resursa nu mai urmează biblioteca. Calendarul care a venit împreună cu resursa se desprinde și el, dacă nicio altă resursă din acest proiect nu îl mai urmează.

Cu *Anulare* (Ctrl+Z) anulați desprinderea.

### 6. Rezolvați o abatere

O copie cu marcajul *diferă — decideți* nu corespunde elementului din bibliotecă. Aplicația nu alege care valoare este corectă.

1. Faceți clic pe marcajul *diferă — decideți* al resursei. Se deschide fereastra *Legare bibliotecă de resurse*. Se deschide și singură când deschideți un fișier cu o astfel de copie.
2. În secțiunea *Abateri*, alegeți ce doriți pentru element; vedeți mai jos.
3. Faceți clic pe *Amânarea deciziei* dacă nu doriți să alegeți încă. Fereastra se închide, iar marcajul rămâne.

Pentru o abatere aveți două variante:

- *Utilizarea valorilor din bibliotecă*: copia primește datele din bibliotecă.
- *Preluarea valorilor fișierului în bibliotecă*: biblioteca primește datele din copia dumneavoastră. Sub această opțiune scrie *Atenție: aceasta modifică biblioteca și se aplică tuturor proiectelor dumneavoastră.* Copiile din celelalte proiecte deschise urmează modificarea.

## Situații problematice și ce face aplicația atunci

**Proiectele de exemplu au o bibliotecă proprie.** Dacă deschideți unul dintre cele trei exemple de prezentare (*Fișier › Exemple*, sau printr-un link din Ajutor), aplicația creează o singură dată biblioteca *Bibliotecă de resurse demo* și leagă proiectul de ea. Resursele proiectului cu același nume ca un element din bibliotecă sunt legate imediat; calendarele nu. Bibliotecile dumneavoastră proprii nu sunt modificate. Dacă deschideți două exemple unul lângă altul, împreună arată conflicte în [Utilizarea prezentării generale a ocupării](docs://howto-bezettingsoverzicht-gebruiken), de exemplu la Masonry crew (*Masonry crew*) între *Refurbishment & Extension of a Family Home* și *6 New Terraced Houses, De Akkers*.

**Nu vedeți comutatorul.** Proiectul nu este legat de o bibliotecă. Urmați pasul 1.

**Modificați din greșeală biblioteca.** Panoul se deschide întotdeauna pe *Proiect*, ca să evitați asta. Modificările din vizualizarea *Bibliotecă* se aplică tuturor proiectelor și nu pot fi anulate cu *Anulare*.

**Ștergeți o resursă din bibliotecă.** Aplicația întreabă mai întâi *Eliminați „Bricklayer” din bibliotecă? Aceasta se aplică tuturor proiectelor și nu poate fi anulată.* Copiile din proiectele dumneavoastră rămân și continuă să funcționeze. Ele primesc marcajul *nu mai este în bibliotecă* și pot fi editate complet. Cu *Eliminare din proiect* scoateți copia din proiect.

**Sub *Bibliotecă de resurse* alegeți altă bibliotecă sau *fără bibliotecă (proiect independent)*.** Marcajele de origine ale bibliotecii anterioare dispar. Resursele rămân în proiect ca resurse obișnuite ale proiectului. Dacă alegeți altă bibliotecă, aplicația caută din nou resursele cu același nume.

**O resursă nu are nicio sugestie în *Recunoaștere*.** Apare *Nicio sugestie — alegeți manual*, dar această fereastră nu are buton pentru asta. Aceasta pare o lipsă. Treceți o asemenea resursă în bibliotecă cu *Trecere în bibliotecă* (pasul 4).

## Vedeți și

- [Biblioteca de resurse](docs://uitleg-resourcebibliotheek): ce decide biblioteca, ce decide proiectul și cum urmează copiile modificările din bibliotecă.
- [Gestionarea și partajarea bibliotecilor de resurse](docs://howto-bibliotheken-beheren): crearea, exportul și importul bibliotecilor.
- [Utilizarea prezentării generale a ocupării](docs://howto-bezettingsoverzicht-gebruiken): vedeți dacă două proiecte cer aceeași resursă în același moment.
- [Gestionarea resurselor](docs://howto-resources-beheren): resursele unui singur proiect.
