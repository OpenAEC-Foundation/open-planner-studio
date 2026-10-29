# Alegerea sau crearea unui profil de calcul

Scop: decideți ce reguli de calcul folosește un proiect. Alegeți un profil încorporat sau creați un profil propriu cu convențiile de calcul ale dumneavoastră.

## Când aveți nevoie de aceasta

Deschideți un proiect care trebuie să se calculeze ca Primavera P6 sau Microsoft Project, sau doriți să setați altfel o convenție de calcul decât face profilul. Ce este un profil și de ce se pot deplasa datele este explicat în [Profiluri de calcul și convenții](docs://uitleg-rekenprofielen).

## Pași

### Alegerea unui profil pentru un proiect nou

1. Alegeți *Acasă › Fișier › Nou*. Se deschide fereastra *Proiect nou*.
2. În lista derulantă *Profil de calcul*, alegeți profilul: *Open Planner Studio*, *Primavera P6* sau *Microsoft Project*.
3. Creați proiectul. Aplicația înlocuiește opțiunile de calcul pe care le-ați completat deja cu setările implicite ale profilului.

### Schimbarea profilului unui proiect existent

1. Alegeți *Setări › Proiect › Setări proiect*. Puteți alege și *Fișier › Setări proiect*.
2. În secțiunea *Profil de calcul și opțiuni de calcul*, deschideți lista derulantă *Profil de calcul* și alegeți alt profil.
3. Faceți clic pe **Aplicare**. Aplicația recalculează planificarea imediat, chiar dacă *Calculare automată* este dezactivată. Dacă s-au deplasat activități, aplicația spune câte.

Până faceți clic pe *Aplicare*, modificarea există doar în formular. Întreaga schimbare de profil se anulează dintr-un singur pas cu *Anulare*. Schimbarea profilului modifică doar convențiile de calcul; opțiunile dumneavoastră de calcul rămân neschimbate.

### Crearea unui profil propriu

1. În secțiunea *Profil de calcul și opțiuni de calcul*, faceți clic pe *Creare profil*, lângă lista derulantă.
2. Introduceți un nume. Aplicația propune *Copie a* urmat de profilul ales, de exemplu *Copie a Open Planner Studio*.
3. Faceți clic pe *Creare*. Partea *Convențiile de calcul ale acestui profil* se extinde.
4. Activați sau dezactivați convențiile cu casetele de bifare. Pictograma i de după un rând arată explicația acelei convenții. O convenție care diferă de bază primește eticheta *înapoi la bază*.
5. Faceți clic pe **Aplicare**. Abia atunci proiectul se calculează cu noul profil.

Cele trei profiluri încorporate nu pot fi modificate. Convențiile lor sunt afișate doar cu titlu informativ.

### Păstrarea unui profil propriu ca șablon

1. Dacă este nevoie, dați profilului propriu un alt nume în câmpul *Numele acestui profil propriu*.
2. Faceți clic pe *Salvare ca șablon*. Aplicația anunță că șablonul a fost salvat sau de ce nu a reușit.
3. Într-un alt proiect din aceeași aplicație, șablonul se află în lista derulantă *Profil de calcul*.

Dacă profilul diferă ulterior de șablon, o secțiune galbenă arată aceasta. Atunci alegeți *Actualizare șablon din acest proiect* sau *Actualizare din șablon*.

Ștergeți un șablon cu *Ștergere șablon*. Aplicația cere mai întâi confirmare.

## Verificarea rezultatului

- Secțiunea *Profil de calcul și opțiuni de calcul* arată profilul ales.
- După *Aplicare*, aplicația anunță activitățile deplasate, de exemplu *După aplicare, 4 activități au fost deplasate.*
- O secțiune portocalie deasupra opțiunilor de calcul arată că opțiunile dumneavoastră de calcul diferă de setările implicite ale profilului. Acest lucru este adesea intenționat. Dacă doriți totuși setările implicite, faceți clic pe *Utilizare setări implicite ale …*.

## Capcane și ce face aplicația

**Datele se schimbă.** Un alt profil poate modifica datele reale. Verificați rezultatul. Dacă nu vă convine, alegeți *Anulare*: profilul și datele revin împreună.

**O secțiune galbenă după Anulare.** Dacă apăsați *Anulare* sau *Refacere* cât timp *Setări proiect* este deschis, secțiunea urmează starea proiectului. Dacă ați modificat deja ceva în secțiune, alegerea dumneavoastră rămâne. Atunci o secțiune galbenă arată că *Aplicare* readuce alegerea respectivă.

**Pot exista cel mult 100 de șabloane.** Dacă există deja 100, aplicația nu salvează șablonul și anunță aceasta. Ștergeți mai întâi un șablon. Dacă spațiul de stocare al aplicației este plin sau lipsește, apare de asemenea un mesaj.

**Șabloanele aparțin aplicației, profilul aparține proiectului.** Proiectul are întotdeauna propria copie a profilului. Dacă modificați ulterior șablonul, proiectul nu se schimbă odată cu el.

**Setările din fișierul sursă.** Dacă alegeți *Primavera P6* sau *Microsoft Project* pentru un proiect care provine dintr-un alt fișier, setările din fișierul sursă rămân. Aici nu le puteți modifica.

## Vezi și

- [Profiluri de calcul și convenții](docs://uitleg-rekenprofielen): ce este un profil și ce face el cu datele.
- [Opțiuni de calcul și convenții de calcul](docs://ref-rekenopties-en-conventies): toate convențiile și opțiunile de calcul dintr-o privire.
- [Alegerea modului de progres](docs://howto-voortgangsmodus-kiezen): Retained Logic sau Progress Override, separat de profil.
