# Salvarea și inserarea șabloanelor WBS

Scop: salvați o fază cu subactivitățile și dependențele ei ca șablon și inserați-o din nou mai târziu, în același proiect sau într-un alt proiect.

## Când aveți nevoie de acest lucru

Planificați mereu același fel de lucrări: fiecare casă are o fundație cu lucrări de pământ, armare, turnare și întărire. În loc să creați din nou și din nou aceste activități și să le legați între ele, salvați faza o singură dată ca **șablon**. Un șablon este o ramură a WBS-ului dumneavoastră: o activitate împreună cu tot ce se află sub ea.

## Pași

### Salvarea unei ramuri ca șablon

1. Construiți ramura în forma în care doriți s-o reutilizați: o activitate rezumat cu subactivități și dependențele dintre ele.
2. Faceți clic dreapta pe activitatea rezumat și alegeți *Salvare ramură ca șablon*. Acest element de meniu apare numai la activitățile cu subactivități.

Aplicația afișează *Ramura a fost salvată ca șablon „Foundation”*. Aplicația nu cere un nume: șablonul primește numele activității de sus din ramură.

### Inserarea unui șablon

1. Selectați activitatea sub care trebuie inserat șablonul sau nu selectați nimic.
2. Alegeți *Planificare › Structură › Șabloane*. Lista arată numele fiecărui șablon și, de exemplu, *4 activități, 2 dependențe*.
3. Faceți clic pe șablon.

Dacă este selectată o activitate, șablonul se inserează ca ultima subactivitate sub aceasta. Activitatea devine astfel o activitate rezumat. Dacă sunt selectate mai multe activități, contează cea pe care ați făcut clic primul. Dacă nu este selectată nicio activitate, ramura se adaugă la sfârșitul listei, la nivelul de sus. Ramura inserată este selectată după aceea.

Toate activitățile inserate se află la începutul proiectului, iar planificarea nu mai este actualizată. Apăsați **Calculare** (F5), de exemplu prin *Acasă › Planificare › Calculare*, și datele rezultă din dependențe. Inserarea se anulează dintr-un singur pas cu *Anulare*. Salvarea sau ștergerea unui șablon nu face parte din acest pas.

### Ștergerea unui șablon

Deschideți *Planificare › Structură › Șabloane* și faceți clic pe pictograma mică de coș de gunoi din dreapta șablonului (*Ștergere șablon*). Aplicația nu cere confirmare.

### Ce conține un șablon

Pentru fiecare activitate, șablonul păstrează numele, descrierea, tipul de activitate, dacă este jalon și durata în zile. Dintre dependențe păstrează doar pe cele dintre două activități din ramură, cu tipul și decalajul lor.

Restul nu se păstrează: datele, progresul și datele reale, atribuirile de resurse, codurile și câmpurile particularizate (vezi [Coduri și câmpuri particularizate](docs://howto-codes-en-velden)), calendarul, restricțiile și termenele limită, prioritatea, un tip de activitate particularizat, pentru un jalon tipul și bifa *Obligatoriu (prin contract)*, și dependențele cu activități din afara ramurii. După inserare, completați din nou aceste date: atribuirile, codurile, calendarul și restricțiile sunt goale, iar toate activitățile încep la începutul proiectului.

O activitate care era în ore devine o activitate pe zile, cu durata convertită într-o fracție dintr-o zi lucrătoare. O activitate de 5 ore, cu o zi lucrătoare de 8 ore, devine 0,625 zile.

## Capcane și ce face aplicația

**Șabloanele nu aparțin proiectului.** Aplicația le păstrează în spațiul de stocare al aplicației de pe acest dispozitiv, nu în fișierul proiectului. Un coleg care deschide fișierul dumneavoastră nu vede șabloanele dumneavoastră. În versiunea din browser, un șablon aparține acelui browser. Dacă șabloanele dumneavoastră sunt importante, păstrați-le și în altă parte: puneți-le într-un proiect pe care îl salvați ca fișier.

**Același nume poate apărea de mai multe ori.** Dacă salvați ramura de două ori, lista conține două șabloane cu același nume. Aplicația nu suprascrie nimic.

**Durata activității de sus nu contează.** O activitate rezumat își primește durata de la subactivități, de îndată ce utilizați Calculare.

**O activitate cu atribuiri de resurse ca țintă.** Dacă selectați o activitate cu atribuiri, care nu are încă subactivități, și inserați sub ea un șablon, aplicația refuză. Activitatea ar deveni o activitate rezumat, iar o activitate rezumat nu are atribuiri. Activitatea de sus a unui șablon are chiar ea subactivități, deci atribuirile nu ar avea unde să meargă. Aplicația vă anunță și nu modifică nimic. Alegeți atunci o altă activitate sau nimic, ca loc de inserare. Un jalon care primește un șablon își pierde marcajul de jalon, iar aplicația afișează un mesaj.

**O dependență nevalidă în șablon.** Dacă o dependență din șablon nu este permisă, de exemplu o activitate către propria fază, sau dacă există deja, aplicația o omite și vă spune câte dependențe au fost omise.

## Vezi și

- [Ajustarea structurii](docs://howto-structuur-aanpassen): mutați sau indentați ramura inserată.
- [Adăugarea dependențelor](docs://howto-relaties-leggen): creați dumneavoastră dependențele din ramură înainte să o salvați.
- [Drumul critic și marja](docs://uitleg-kritiek-pad): ce se întâmplă cu ramura inserată după Calculare.
