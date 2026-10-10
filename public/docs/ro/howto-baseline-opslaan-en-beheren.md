# Salvarea și gestionarea unei referințe

Obiectiv: înregistrați planificarea ca un acord (o referință), ca să puteți vedea mai târziu cât se abate execuția și ca să păstrați, redenumiți, alegeți și ștergeți mai multe referințe.

## Când aveți nevoie de aceasta

Înregistrați o referință când planificarea a fost aprobată și lucrările încă trebuie să înceapă. Dacă planificarea este revizuită oficial mai târziu, de exemplu după un ordin de modificare, salvați o a doua referință și o păstrați pe prima. Astfel măsurați execuția față de primul acord și față de cel revizuit. Ce înregistrează exact o referință și cum calculează aplicația varianța este explicat în [Progres, data raportului de stare și referință](docs://uitleg-voortgang).

## Pași

### Salvarea unei referințe

1. Apăsați **Calculare** (F5), de exemplu prin *Planificare › Planificare › Calculare*. Referința înregistrează datele care sunt calculate în acel moment.
2. Alegeți *Planificare › Referințe și progres › Gestionare referințe…*. Se deschide fereastra *Referințe*.
3. Sub *Salvare referință nouă* există un nume sugerat, de exemplu *Referință 1 — (data de azi)*. Tastați un nume propriu, pe care îl veți recunoaște mai târziu, de exemplu *Referință*.
4. Faceți clic pe *Salvare*. Referința este acum în listă și este imediat referința activă.
5. Faceți clic pe *Închidere*.

Sub fiecare bară de activitate din Gantt există acum o bară subțire cu datele referinței; un jalon primește un romb mic. Activați sau dezactivați această suprapunere cu *Vizualizare › Referințe și progres › Suprapunere referință*.

### Alegerea referinței active

Deschideți *Gestionare referințe…* și alegeți în coloana *Activ* referința cu care doriți să comparați. Cât timp există referințe, exact una este activă. Suprapunerea din Gantt, tipul de raport *Varianță* și *Raport de progres* folosesc referința activă.

### Redenumirea unei referințe

Schimbați numele din listă. Modificarea se aplică imediat; nu trebuie să faceți clic pe *Salvare*.

### Ștergerea unei referințe

Faceți clic pe coșul mic de gunoi de lângă referința din listă. Dacă ștergeți referința activă, aplicația întreabă *Ștergeți referința activă?*. Apoi cea mai nouă referință rămasă devine cea activă. Dacă nu există alta, nu mai există nicio referință activă, iar suprapunerea dispare. Cu Ctrl+Z readuceți o referință ștearsă.

### Varianțele din tabelul de activități

Fiecare referință are șase coloane în tabelul de activități. Faceți clic pe **+** din dreapta antetului tabelului de activități (*Adăugare coloană*) și deschideți categoria *Referință*. Pentru fiecare referință există *Început planificat*, *Sfârșit planificat*, *Durată*, *Varianță de început*, *Varianță de sfârșit* și *Varianță de durată*, cu numele referinței în față, de exemplu *Referință — Varianță de sfârșit*. Varianțele sunt în zile lucrătoare: un plus înseamnă mai târziu, un minus înseamnă mai devreme. O activitate care nu este în referință afișează o liniuță (—) în aceste coloane.

## Capcane și ce face aplicația

**O planificare învechită.** Dacă planificarea este învechită, fereastra afișează *Planificarea este învechită — recalculați mai întâi (F5)*. Acesta este un avertisment; salvarea rămâne posibilă. Dar atunci salvați datele vechi. Închideți fereastra, apăsați **Calculare** și abia apoi salvați.

**O referință cu progres.** Dacă salvați o referință după ce ați introdus progresul, ea înregistrează starea cu datele reale. Varianța este atunci zero și nu mai spune nimic despre execuție. Înregistrați referința înainte de începerea lucrărilor.

**O referință nu poate fi actualizată.** Dacă doriți să revizuiți acordul, salvați o referință nouă și ștergeți-o pe cea veche, dacă este necesar.

**Doar activități fără subactivități.** O fază nu se află în referință: nu are bară de referință și nu are varianță. Faza rezultă din activitățile de sub ea.

**Activități noi și șterse.** O activitate pe care o adăugați după salvare nu are bară de referință. În raportul de varianță apare ca *Nouă*. O activitate pe care o ștergeți apare ca *Eliminată*.

**Mutarea proiectului.** În fereastra *Mutarea proiectului…*, de îndată ce există referințe, există caseta de validare *Deplasați și referințele*. Implicit, ea este dezactivată: referințele rămân pe loc, astfel deplasarea apare ca varianță. Vedeți [Mutarea unui proiect](docs://howto-project-verplaatsen).

**Stocate în fișierul proiectului.** Referințele și alegerea activă sunt salvate împreună cu proiectul și revin când deschideți fișierul.

## Vedeți și

- [Progres, data raportului de stare și referință](docs://uitleg-voortgang): ce înregistrează o referință și cum se calculează varianța.
- [Mutarea unui proiect](docs://howto-project-verplaatsen): caseta de validare *Deplasați și referințele*.
- [Actualizarea progresului](docs://howto-voortgang-bijwerken): introducerea stării reale cu care comparați referința.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): o referință (*Baseline at start*) înainte de începere, cu progres și data raportului de stare de 20 mai 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): două referințe, *Contract* și *Re-baseline (variation order)*, cu progres și data raportului de stare de 5 iulie 2027.
