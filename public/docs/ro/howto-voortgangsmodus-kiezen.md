# Alegerea modului de progres

Obiectiv: decideți cum planifică aplicația lucrul rămas al unei activități care a început deja, în timp ce predecesorul său încă este în desfășurare: conform dependenței (Retained Logic) sau conform celor ce se întâmplă efectiv (Progress Override).

## Când aveți nevoie de asta

Pe șantier, lucrările avansează adesea mai repede decât logica. Vopsitorul începe deja în camerele care au fost tencuite, în timp ce tencuitorul este încă ocupat în altă parte. În planificare, aceasta este, de exemplu, o dependență sfârșit-început la care succesorul începe înainte ca predecesorul să fie încheiat. Aplicația numește asta **progres în afara secvenței**. Dacă bara de stare afișează *N dependență(e) în afara secvenței*, aveți un asemenea caz, iar modul de progres decide cum planifică aplicația lucrul rămas al succesorului. Ce fac cele două moduri, cu un exemplu concret, este descris în [Progres, data raportului de stare și referința](docs://uitleg-voortgang).

## Pași

1. Actualizați progresul și setați data raportului de stare, conform descrierii din [Actualizarea progresului](docs://howto-voortgang-bijwerken).
2. Mergeți la *Planificare › Referințe și progres › Mod de progres* și deschideți lista.
3. Alegeți *Retained Logic* sau *Progress Override*.
4. Apăsați **Calculare** (F5), de exemplu prin *Planificare › Planificare › Calculare*. Alegerea face planificarea învechită: bara de stare afișează *Învechit — recalculați (F5)*. Dacă *Calculare automată* este activată, aplicația face asta singură.

Cum alegeți?

- **Retained Logic** este implicit. Dependența rămâne în vigoare: lucrul rămas al succesorului începe abia după ce predecesorul este încheiat. Alegeți această opțiune dacă ordinea este cu adevărat fixă sau dacă doriți să planificați cu prudență.
- **Progress Override** lasă realitatea să decidă. Lucrul rămas al succesorului începe la data raportului de stare, fără să aștepte predecesorul. Alegeți această opțiune dacă succesorul continuă cu adevărat să lucreze și data de sfârșit nu trebuie să depindă de un predecesor care încă este în desfășurare.

## Verificarea rezultatului

- Faceți clic pe mesajul *N dependență(e) în afara secvenței* din bara de stare. Se deschide panoul *Avertismente*, care se poate deschide și prin *Planificare › Planificare › Avertismente*. Fiecare dependență apare în el cu textul *În afara secvenței: progresul succesorului contrazice dependența*, de exemplu *4.2 Plastering → 4.5 Painting (FS)*.
- Uitați-vă la bara succesorului. Sub Retained Logic, bara se întinde până după sfârșitul predecesorului. Sub Progress Override, se încheie mai devreme. În exemplul din explicație, acestea sunt marți, 27 iulie, față de joi, 22 iulie.

## Capcane și ce face aplicația

**Nicio diferență.** Modul are efect numai asupra activităților care au început deja, în timp ce predecesorul lor nu s-a încheiat încă. Fără o asemenea activitate, nimic nu se schimbă.

**Mesajul rămâne.** Progress Override nu rezolvă mesajul despre progres în afara secvenței. Modul decide cum calculează aplicația; contradicția dintre dependență și progres rămâne. Dacă dependența nu mai este corectă, modificați-o ([Adăugarea dependențelor](docs://howto-relaties-leggen)).

**Aparține proiectului.** Alegerea se salvează împreună cu fișierul proiectului, se aplică la întregul proiect și poate fi anulată cu Ctrl+Z. Un proiect nou folosește Retained Logic.

**Un fișier P6.** Dacă deschideți un fișier Primavera P6 (.xer), aplicația preia modul din fișier. În afară de Retained Logic și Progress Override, P6 mai are și Actual Dates. Aplicația nu cunoaște acest al treilea mod; un asemenea fișier se calculează ca Retained Logic. Mesajul de import numără asta ca *1 setare de planificare P6 a folosit o revenire sigură.*

**Profilul de calcul.** În profilul Primavera P6, Progress Override funcționează și invers, în datele târzii și în marja liberă a predecesorului (convenția de calcul *Progress Override ignoră un succesor început și în calculul înapoi*). În profilurile Open Planner Studio și Microsoft Project nu este așa. Convențiile le găsiți la *Setări › Proiect › Informații proiect*, în blocul *Profil de calcul și opțiuni de calcul*. În exemplul din explicație, acest efect invers nu se vede.

## Vezi și

- [Progres, data raportului de stare și referința](docs://uitleg-voortgang): diferența dintre cele două moduri, cu cifre.
- [Actualizarea progresului](docs://howto-voortgang-bijwerken): introducerea progresului asupra căruia lucrează modul.
- [Adăugarea dependențelor](docs://howto-relaties-leggen): modificarea unei dependențe care nu mai este corectă.
