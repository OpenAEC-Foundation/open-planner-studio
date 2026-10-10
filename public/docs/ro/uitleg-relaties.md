# Dependențe și decalaj

De ce începe zidăria abia după ce este gata fundația? Și de ce se întârzie o săptămână montarea acoperișului când elementele de acoperiș sosesc târziu? Acest lucru ține de dependențele dintre activitățile dumneavoastră. În acest articol aflați ce patru tipuri de dependențe cunoaște aplicația, ce fac decalajul și devansul, în ce calendar se numără un decalaj, ce se întâmplă cu o dependență pusă pe o fază și cum decide aplicația ce dependență determină data de start a unei activități.

Regulile și exemplele se aplică unui proiect nou, cu profilul de calcul *Open Planner Studio* și o săptămână de lucru de luni până vineri.

## Conceptul

O **dependență** arată că două activități depind una de alta. Prima activitate este **predecesorul**, a doua **succesorul**. O dependență este o limită inferioară: succesorul nu poate începe sau să se termine niciodată mai devreme decât permite dependența, dar poate începe sau să se termine mai târziu. Dacă o activitate are mai mulți predecesori, ea așteaptă cea mai târzie dată care rezultă din toate aceste dependențe.

Există patru tipuri. Ele se deosebesc prin momentul din predecesor (început sau sfârșit) care este legat de un moment din succesor:

- **FS (sfârșit-început).** Succesorul începe abia după ce predecesorul s-a terminat. Elementele de acoperiș se montează abia după ce pereții sunt ridicați. Acesta este de departe cel mai folosit tip de dependență.
- **SS (început-început).** Succesorul începe abia după ce predecesorul a început. Activitățile se pot suprapune: instalațiile de conducte pot începe imediat ce zidăria este în curs.
- **FF (sfârșit-sfârșit).** Succesorul se termină abia după ce predecesorul s-a terminat. Rostuirea nu se poate face înainte ca zidăria să fie terminată, dar poate începe mai devreme.
- **SF (început-sfârșit).** Succesorul se termină abia după ce predecesorul a început. Acest tip este rar. Un exemplu: drenajul temporar poate fi oprit abia după ce a început zidăria fundației.

O dependență poate avea și un **decalaj**: timp de așteptare între cele două activități, de exemplu beton care trebuie să se întărească. Un decalaj negativ se numește **devans**: succesorul începe atunci înainte ca predecesorul să fie terminat, deci activitățile se suprapun.

## Cum calculează aplicația

### Cele patru tipuri

Pentru fiecare dependență, aplicația calculează cea mai devreme dată la care poate începe succesorul și ia cea mai târzie dată dintre toate dependențele unei activități. Fără decalaj, funcționează așa:

- Cu FS, succesorul începe în prima zi lucrătoare după sfârșitul predecesorului.
- Cu SS, succesorul începe în aceeași zi cu predecesorul.
- Cu FF, succesorul se termină în aceeași zi cu predecesorul. Pentru a găsi începutul, aplicația numără înapoi pe durata succesorului. Un succesor de 3 zile lucrătoare începe deci cu 2 zile lucrătoare înainte de sfârșitul predecesorului.
- Cu SF, succesorul se termină în ziua în care începe predecesorul. Și aici aplicația numără înapoi pe durata succesorului.

Acestea sunt limite inferioare. Un succesor începe mai târziu dacă o altă dependență sau o restricție o cere. Datele apar abia după **Calculare** (F5). Cât timp bara de stare afișează *Învechit — recalculați (F5)*, barele aparțin calculului anterior.

### Decalaj și devans

Un decalaj se poate exprima în patru moduri:

- În **zile lucrătoare** (`3` sau `3d`): aplicația sare peste zilele libere și weekenduri. Acesta este valoarea implicită.
- În **zile calendaristice** (`3ed`, litera e înseamnă *scurs*: timpul care trece): fiecare zi se numără, inclusiv sâmbăta și duminica. Această unitate se folosește pentru ceva ce continuă fără lucru, cum este întărirea.
- Ca **procent** din durata predecesorului (`40%`): aplicația îl recalculează la fiecare calcul și rotunjește la zile întregi (2,5 zile devin 3).
- În **ore de lucru** (`4h`): aplicația numără decalajul în calendarul pentru decalaj, implicit cel al predecesorului. Dacă predecesorul este o activitate pe zile, pe un calendar fără propriile intervale de lucru, cum este calendarul standard, aplicația convertește orele în zile lucrătoare întregi, rotunjite la cea mai apropiată zi întreagă (o jumătate de zi se rotunjește în sus). Cu o zi lucrătoare de 8 ore, `2h` și `3h` dau deci 0 zile, `4h` până la `11h` inclusiv dau 1 zi, iar `12h` dă 2 zile. Dacă acel calendar are propriile intervale de lucru, sau dacă predecesorul este o activitate pe ore, decalajul se numără exact în ore de lucru.

Regula pentru un decalaj de N zile lucrătoare cu FS: cele N zile lucrătoare după sfârșitul predecesorului sunt timp de așteptare, iar succesorul începe în ziua lucrătoare următoare. Cu SS și FF, decalajul se adaugă la începutul, respectiv sfârșitul predecesorului. Un decalaj negativ se numără înapoi: un devans de 1 zi lucrătoare cu FS lasă succesorul să înceapă în ziua în care se termină predecesorul.

Un devans nu poate muta o activitate înainte de începutul proiectului. Dacă ar fi să se întâmple asta, aplicația păstrează succesorul la începutul proiectului și semnalează în panoul *Avertismente*: *Devans tăiat de începutul proiectului — dependența nu este folosită complet*.

### În ce calendar se numără decalajul

Fiecare activitate poate avea propriul calendar. Cu un decalaj în zile lucrătoare contează ce calendar numără zilele lucrătoare. Setarea *Calendar pentru decalaj* decide acest lucru, cu patru opțiuni: *Predecesor*, *Succesor*, *24 de ore* și *Calendar de proiect*. Implicit, decalajul se numără în calendarul **predecesorului**. Această setare o găsiți la *Setări › Proiect › Informații proiect*, în blocul *Profil de calcul și opțiuni de calcul*, la *Opțiunile de calcul ale acestui proiect*. Alegerea se salvează în fișierul proiectului și are efect abia după ce faceți clic pe *Aplicare*; planificarea se recalculează atunci.

Un decalaj în zile calendaristice (`3ed`) numără întotdeauna toate zilele, indiferent de *Calendar pentru decalaj* pe care îl alegeți.

### Dependențe pe activități rezumat

Puteți pune o dependență pe o fază (o activitate rezumat), în loc de o activitate din ea. Intern, aplicația pune acea dependență pe fiecare activitate din fază:

- O fază ca **predecesor** cu FS sau FF: succesorul așteaptă până se termină activitatea din fază care se termină ultima.
- O fază ca **succesor** cu FS sau SS: fiecare activitate din fază așteaptă predecesorul, independent de celelalte activități din fază.
- O fază ca **predecesor** cu SS sau SF: succesorul așteaptă începutul activității din fază care începe **cel mai târziu**, nu începutul fazei în sine. Aceasta este mai prudentă decât ați putea crede: succesorul nu începe niciodată prea devreme, dar poate începe mai târziu decât doriți. Dacă doriți ca succesorul să urmeze începutul fazei, puneți dependența pe prima activitate din fază.
- O fază ca **succesor** cu FF sau SF: fiecare activitate din fază trebuie să îndeplinească ea însăși cerința de sfârșit (cu FF, sfârșitul trebuie să fie egal sau după sfârșitul predecesorului; cu SF, egal sau după începutul predecesorului), chiar și o activitate care ar fi putut fi terminată mult mai devreme. Este mai bine să puneți o astfel de dependență pe ultima activitate din fază.

O dependență între o activitate și faza în care se află nu este permisă.

### Legături determinante

Dacă un succesor are mai mulți predecesori, de obicei o singură dependență îi determină data de start: dependența care împiedică succesorul să înceapă cu o singură zi mai devreme decât începe acum. Această dependență se numește **determinantă**. La egalitate există mai multe legături determinante. Recunoașteți o legătură determinantă după simbolul cu fulger din coloanele *Predecesori* și *Succesori* ale tabelului, după coloana *Legătură determinantă* (semnul **+** din dreapta antetului tabelului, sub *Dependențe*) și după nuanța mai intensă când urmăriți un drum. Cum deschideți acel drum este descris în [Trasarea unui drum](docs://howto-pad-traceren).

O legătură determinantă spune ceva despre date, nu despre durată. Un predecesor scurt poate fi și el determinant, de exemplu din cauza unui decalaj lung; vedeți acest lucru în exemplul de mai jos.

## Exemplu rezolvat

Exemplele folosesc proiecte mici separate, care încep toate luni 7 iunie 2027, dacă nu se indică altfel. Termeni precum drum critic și marjă sunt explicați în [Drum critic și marjă](docs://uitleg-kritiek-pad). Construirea unei rețele de dependențe și verificarea ei o faceți singuri în tutorialul 2, "Dependențe și drumul critic".

### Cele patru tipuri alăturate

*Pour foundation* durează 5 zile lucrătoare: de luni 7 până vineri 11 iunie. *Build walls* (5 zile lucrătoare) urmează cu FS și durează de luni 14 până vineri 18 iunie. Patru activități de câte 3 zile lucrătoare depind de *Build walls*, fiecare cu alt tip:

- *Place roof elements* (FS) începe luni 21 iunie, prima zi lucrătoare după zidărie, și se termină miercuri 23 iunie.
- *Pipework* (SS) începe luni 14 iunie, odată cu zidăria, și se termină miercuri 16 iunie.
- *Pointing* (FF) trebuie să se termine vineri 18 iunie, odată cu zidăria. Cu 3 zile lucrătoare, începe deci miercuri 16 iunie.
- *Dewatering* (SF) trebuie să se termine luni 14 iunie, ziua în care începe zidăria. Numărând înapoi 3 zile lucrătoare (joi 10, vineri 11, luni 14 iunie) rezultă un început joi 10 iunie.

Doar *Place roof elements* se află pe drumul critic; proiectul se termină miercuri 23 iunie. *Pipework*, *Pointing* și *Dewatering* au respectiv 5, 3 și 7 zile lucrătoare de marjă.

### Decalaj și devans în cifre

*Pour foundation* se termină vineri 18 iunie. *Build walls* (2 zile lucrătoare) urmează cu FS. Ce face decalajul cu data de start:

- Fără decalaj, zidăria începe luni 21 iunie.
- Cu decalajul `3` (trei zile lucrătoare), luni 21, marți 22 și miercuri 23 iunie sunt timp de așteptare; zidăria începe joi 24 iunie.
- Cu decalajul `3ed` (trei zile calendaristice) se numără sâmbătă, duminică și luni; zidăria începe marți 22 iunie.
- Cu decalajul `-1` (un devans de o zi lucrătoare), zidăria începe vineri 18 iunie, ziua în care se termină turnarea.
- Cu decalajul `40%`, decalajul este 40% din 5 zile lucrătoare, deci 2 zile lucrătoare; zidăria începe miercuri 23 iunie.
- Cu decalajul `50%`, decalajul este 2,5 zile lucrătoare, rotunjit la 3 zile lucrătoare; zidăria începe joi 24 iunie.

### Ce calendar numără decalajul

*Build walls* (4 zile lucrătoare) este pe calendarul proiectului (de luni până vineri) și se termină joi 10 iunie. *Pointing* (2 zile lucrătoare) urmează cu FS și decalajul `3`, și este pe un calendar în care sâmbăta și duminica sunt și ele zile lucrătoare. Atunci data de start depinde de *Calendar pentru decalaj*:

- *Predecesor* (implicit): decalajul se numără în calendarul zidăriei. Vineri 11, luni 14 și marți 15 iunie sunt timp de așteptare; rostuirea începe miercuri 16 iunie.
- *Succesor*: decalajul se numără în calendarul rostuirii. Vineri 11, sâmbătă 12 și duminică 13 iunie sunt timp de așteptare; rostuirea începe luni 14 iunie.
- *24 de ore*: se numără fiecare zi calendaristică. Și aici vineri, sâmbătă și duminică sunt timp de așteptare; rostuirea începe luni 14 iunie.
- *Calendar de proiect*: decalajul se numără în calendarul proiectului, la fel ca la *Predecesor*; rostuirea începe miercuri 16 iunie.

### Dependențe pe o fază

*Foundation* este o fază cu două activități: *Excavate* (2 zile lucrătoare, luni 7 și marți 8 iunie) și apoi *Pour* (3 zile lucrătoare, de miercuri 9 până vineri 11 iunie). *Build walls* urmează faza *Foundation* cu FS și începe luni 14 iunie: aplicația îl face să aștepte *Pour*, activitatea care se termină ultima.

Cu o fază ca succesor: *Permit* (3 zile lucrătoare, se termină miercuri 9 iunie) este legat prin FS de faza *Structure*. Faza conține *Build walls* (4 zile lucrătoare) și apoi *Lay floor* (2 zile lucrătoare). Fiecare activitate din fază așteaptă permisul: *Build walls* începe joi 10 iunie și se termină marți 15 iunie. *Lay floor* așteaptă și zidăria și durează de miercuri 16 până joi 17 iunie.

Cu SS dintr-o fază: faza *Finishing* conține *Plastering* (2 zile lucrătoare, 7 și 8 iunie), apoi *Painting* (3 zile lucrătoare, 9 până 11 iunie) și apoi *Snagging* (2 zile lucrătoare, 14 și 15 iunie). *Cleaning* urmează faza cu SS. Ați aștepta un început luni 7 iunie, dar aplicația îl face pe *Cleaning* să aștepte începutul lui *Snagging*, activitatea care începe ultima: luni 14 iunie.

### Ce este determinant

*Pour foundation* (2 zile lucrătoare) durează de luni 7 până marți 8 iunie. Urmează două ramuri:

- *Build walls* (5 zile lucrătoare): de miercuri 9 până marți 15 iunie.
- *Order roof elements* (2 zile lucrătoare): miercuri 9 și joi 10 iunie.

*Place roof elements* (3 zile lucrătoare) urmează ambele: cu FS după zidărie, și cu FS și decalajul `5` după comandă (timpul de livrare). După zidărie, montarea ar putea începe miercuri 16 iunie. După comandă, vineri 11, luni 14, marți 15, miercuri 16 și joi 17 iunie sunt timp de așteptare; montarea începe vineri 18 iunie. Legătura cu comanda este deci determinantă, deși comanda este mult mai scurtă decât zidăria. Zidăria are 2 zile lucrătoare de marjă.

## Consecințe și idei greșite

**"O dependență fixează activitățile."** Nu, o dependență este o limită inferioară. Un succesor începe cel mai devreme la data dată de dependență și mai târziu dacă o altă dependență sau o restricție cere asta. Modul în care se încadrează restricțiile este explicat în [Restricții și termene limită](docs://uitleg-constraints).

**"SS înseamnă că activitățile încep în același timp."** SS spune doar că succesorul nu poate începe înainte de predecesor. Dacă succesorul are un alt predecesor care se termină mai târziu, el începe mai târziu.

**"Cu FF, succesorul începe în aceeași zi."** Nu, cu FF coincid datele de sfârșit. Un succesor scurt începe deci mai târziu decât predecesorul, ca rostuirea din exemplu.

**"Un decalaj în zile numără zile calendaristice."** Implicit, un decalaj numără zile lucrătoare, în calendarul predecesorului. Pentru întărire sau uscare, unde contează și weekendul, folosiți zile calendaristice (`ed`).

**"O activitate fără dependențe nu este o problemă."** O activitate fără predecesor începe la data ei de start planificată, iar o activitate fără succesor primește marjă până la sfârșitul proiectului. Dacă uitați o dependență, o activitate pare deci să aibă mult loc; vedeți ideile greșite din [Drum critic și marjă](docs://uitleg-kritiek-pad).

**"O dependență pe o fază este o singură dependență."** Pentru calcul, este câte o dependență pentru fiecare activitate din fază. Dacă mutați activități în fază sau din fază, se schimbă și dependențele care se aplică acelor activități.

## Vezi și

- [Adăugarea dependențelor](docs://howto-relaties-leggen): pașii pentru a lega activitățile și a seta un decalaj.
- [Drumul critic și marja](docs://uitleg-kritiek-pad): ce calculează aplicația din dependențele dumneavoastră și de ce o activitate devine critică.
- [Restricții și termene limită](docs://uitleg-constraints): restricții de dată alături de dependențe.
- [Urmărirea unui drum](docs://howto-pad-traceren): face vizibil lanțul de activități dinaintea sau de după o activitate.
- [Crearea unui hamac](docs://howto-hammock): o activitate cu durată derivată, legată de dependențe de tip SS și FF.
- [Legături între proiecte](docs://howto-externe-relaties): dependențe cu o activitate dintr-un alt fișier de proiect.
