# Calendare și zile lucrătoare

Câte zile lucrătoare durează o activitate și la ce dată se încheie? Acest lucru depinde de calendarul în care numără aplicația. În acest articol citiți ce este un calendar, cum numără aplicația zilele lucrătoare cu ajutorul lui și ce calendar prevalează când sunt implicate mai multe. Exemplul lucrat vă ajută să urmăriți cifrele.

## Conceptul

Planificarea se numără în **zile lucrătoare**, nu în zile calendaristice. „Cinci zile de zidărie” înseamnă cinci zile în care se lucrează. Un weekend sau o sărbătoare legală nu se numără, deci o asemenea activitate se întinde pe mai mult de cinci zile în agendă.

Ce zile sunt zile lucrătoare se notează într-un **calendar**. Un calendar fixează trei lucruri:

- **Săptămâna de lucru**: zilele din săptămână în care se lucrează. Implicit, este de luni până vineri.
- **Timpul de lucru**: începutul, sfârșitul și pauza. Ele dau **orele nete pe zi**. Implicit, este de la 07:00 la 16:00 cu o pauză de o oră, deci 8 ore.
- **Sărbătorile**: zile izolate sau perioade întregi în care nu se lucrează, de exemplu Ziua Regelui, Crăciunul sau concediul colectiv din construcții.

Un proiect are o bibliotecă de calendare. Unul dintre ele este **calendarul proiectului**. El se aplică fiecărei activități care nu are calendar propriu. Dumneavoastră dați unei activități individuale un alt calendar, de exemplu o săptămână de lucru de șase zile pentru un subcontractor care lucrează și sâmbăta. O resursă poate avea și ea un calendar propriu, dar acesta face altceva (vedeți mai jos).

## Cum calculează aplicația

Acest articol descrie calculul standard: profilul de calcul *Open Planner Studio*, cu care calculează un proiect nou.

### Numărarea zilelor lucrătoare

Prima zi lucrătoare a unei activități se numără ca ziua 1. O activitate de 5 zile se încheie deci în a cincea zi lucrătoare. Dacă începutul cade într-o zi nelucrătoare, activitatea începe în următoarea zi lucrătoare. O sărbătoare sau un concediu colectiv din construcții în mijlocul unei activități nu se numără: activitatea trece peste el și devine mai lungă în agendă.

Orele pe zi nu au niciun rol în datele unei activități pe zile. Contează doar săptămâna de lucru și sărbătorile. Timpul de lucru intră în joc doar pentru o activitate pe ore; aceasta este descrisă în [Zile și ore](docs://uitleg-dagen-en-uren).

### Ce calendar prevalează

Aplicația alege un singur calendar pentru fiecare activitate:

1. Dacă activitatea are calendar propriu, aplicația calculează activitatea în întregime în acel calendar: durata, data de sfârșit și marja.
2. Dacă nu are, se aplică calendarul proiectului. Dacă o activitate trimite la un calendar care nu mai există, revine și ea la calendarul proiectului.

O activitate rezumat (o fază) nu are lucru propriu și deci nici calendar propriu. Durata ei rezultă din datele activităților sale, iar aplicația o numără în calendarul proiectului.

Calendarul unei **resurse** nu are niciun rol în date. Într-o planificare pe care o construiți singuri în aplicație, el determină doar când este disponibilă resursa: în histogramă, la supraalocare și la redistribuire.

### Activități pe calendare diferite

Când două activități cu calendare diferite sunt legate, se aplică următoarele:

- La o dependență sfârșit-început, succesorul începe în prima zi lucrătoare după sfârșitul predecesorului, numărată în calendarul **succesorului**. Dacă o activitate se încheie vineri, un succesor cu săptămână de lucru de șase zile începe sâmbătă.
- Un **decalaj** se numără implicit în calendarul **predecesorului**. Puteți schimba acest lucru în *Setări › Proiect › Informații proiect*, în blocul *Profil de calcul și opțiuni de calcul*, sub *Opțiunile de calcul ale acestui proiect*, cu opțiunea *Calendar pentru decalaj*: *Predecesor* (implicit), *Succesor*, *24 de ore* sau *Calendarul proiectului*.
- **Marja totală** se numără în zile lucrătoare din calendarul activității înseși. În acest profil, **marja liberă** se numără în calendarul succesorului.

Ce este exact un decalaj este descris în [Adăugarea dependențelor](docs://howto-relaties-leggen); ce este marja, în [Drumul critic și marja](docs://uitleg-kritiek-pad).

### În diagrama Gantt

Fundalul gri din Gantt arată întotdeauna zilele nelucrătoare ale **calendarului proiectului**. O activitate cu calendar propriu poate trece deci peste o zi gri, de exemplu o activitate de șase zile peste sâmbătă. Un bloc de sărbători de trei zile sau mai mult își afișează numele, de exemplu *Bouwvak (Noord)*. Acest lucru nu se întâmplă când este activată opțiunea *Afișare doar pentru zilele lucrătoare*. Dacă nu doriți să vedeți deloc zilele gri, activați *Afișare doar pentru zilele lucrătoare* în *Setări › Proiect › Setări*, fila *Afișare*, secțiunea *Axa timpului*.

## Exemplu lucrat: planificarea construcției

Exemplul folosește calendarul standard *Bouwkalender NL*: de luni până vineri, cu sărbătorile legale olandeze. Toate activitățile durează un număr întreg de zile. În tutorialul despre calendare (tutorialul 3) construiți singuri un astfel de calendar.

### Weekend, sărbătoare și concediu colectiv din construcții

*Brickwork* durează 5 zile lucrătoare și începe joi, 13 mai 2027. Joi, 13, și vineri, 14 mai, sunt ziua 1 și ziua 2. Weekendul și Lunea Penticostei, 17 mai, nu se numără. Marți, 18, miercuri, 19, și joi, 20 mai, sunt ziua 3, ziua 4 și ziua 5. Activitatea se încheie **joi, 20 mai**: opt zile calendaristice pentru cinci zile lucrătoare.

Un concediu colectiv din construcții mărește diferența. Luați *Bouwvak (Noord)*, de la 26 iulie până la 13 august 2027 inclusiv, și aceeași activitate de 5 zile lucrătoare, pornind de vineri, 23 iulie. Vineri, 23 iulie, este ziua 1. După aceea calendarul stă pe loc timp de trei săptămâni. De luni, 16, până joi, 19 august, sunt ziua 2 până la ziua 5. Sfârșitul este **joi, 19 august**, la 28 de zile calendaristice după început. Fără concediul colectiv din construcții, ar fi fost joi, 29 iulie.

### O activitate de sâmbătă

Trei activități urmează una după alta, toate cu o dependență sfârșit-început fără decalaj: *Groundwork* (4 zile), *Pour foundation* (3 zile) și *Brickwork* (5 zile). Proiectul începe luni, 24 mai 2027.

Dacă toate trei sunt pe calendarul proiectului, *Groundwork* rulează de la luni, 24, până joi, 27 mai. *Pour foundation* rulează de la vineri, 28 mai, până marți, 1 iunie (vineri, luni, marți). *Brickwork* rulează de la miercuri, 2 iunie, până marți, 8 iunie. Proiectul se încheie **marți, 8 iunie**.

Atribuiți *Pour foundation* calendarul *Six-day week* (de luni până sâmbătă) și sâmbăta se numără. Activitatea rulează de la vineri, 28 mai, până luni, **31 mai** (vineri, sâmbătă, luni). *Brickwork* rămâne pe calendarul proiectului, începe marți, 1 iunie, și se încheie **luni, 7 iunie**. Întregul proiect este cu o zi mai scurt, pentru că o activitate lucrează sâmbăta.

### Un decalaj între două calendare

*Pour floor* (săptămână de lucru de șase zile, 4 zile) începe luni, 31 mai, și se încheie joi, 3 iunie. *Pointing* (calendarul proiectului, 3 zile) urmează cu un decalaj de 2 zile lucrătoare. Fără decalaj, *Pointing* ar începe vineri, 4 iunie.

- Implicit, decalajul se numără în calendarul predecesorului, adică săptămâna de șase zile. Începând de vineri, 4 iunie, prima zi lucrătoare este sâmbăta, 5 iunie, iar a doua este luni, 7 iunie. *Pointing* începe **luni, 7 iunie**, și se încheie miercuri, 9 iunie.
- Dacă setați *Calendar pentru decalaj* la *Succesor*, se numără calendarul proiectului. Atunci sâmbăta nu se numără: luni, 7 iunie, este prima zi lucrătoare, iar marți, 8 iunie, a doua. *Pointing* începe **marți, 8 iunie**, și se încheie joi, 10 iunie.

### Marja în calendarul propriu

*Brickwork* (5 zile, calendarul proiectului) și *Crane hire* (3 zile, săptămână de lucru de șase zile) încep amândouă luni, 24 mai. Ambele sunt predecesori ai activității *Fit window frames* (2 zile, calendarul proiectului).

*Brickwork* se încheie vineri, 28 mai, deci *Fit window frames* începe luni, 31 mai. *Crane hire* s-a încheiat deja miercuri, 26 mai. Marja totală a activității *Crane hire* se numără în calendarul propriu: joi, 27, vineri, 28, și sâmbătă, 29 mai, deci **3 zile lucrătoare**. Dacă *Crane hire* ar fi fost pe calendarul proiectului, ar fi fost 2 zile lucrătoare. Marja liberă este de 2 zile lucrătoare (joi și vineri), pentru că aplicația o numără în calendarul succesorului.

### Calendarul unei resurse

Într-un alt proiect exemplu, resursa *Bricklaying crew* are calendarul *Crew Mon–Thu* (de luni până joi). Ea este atribuită cu 1 unitate de atribuire pe zi activității *Brickwork* (5 zile, calendarul proiectului, de la luni, 31 mai, până vineri, 4 iunie).

Datele *Brickwork* nu se schimbă. Dar vineri, 4 iunie, este roșu în histogramă, cu mesajul *Nu lucrează în această zi conform calendarului „Crew Mon–Thu”*, iar panglica raportează o resursă sub *Supraalocare*. Redistribuirea nu rezolvă acest lucru. Deplasarea nu ajută, pentru că cinci zile lucrătoare la rând conțin mereu o vineri. În fereastra *Redistribuire resurse* activitatea apare deci sub *Conflicte rămase*, cu motivul *Resursa nu lucrează în toate zilele necesare acestei activități — deplasarea nu rezolvă acest lucru.*

## Consecințe și neînțelegeri

**„Calendarul resursei îmi mută activitățile.”** Nu. Un calendar de resursă nu schimbă nicio dată; el face doar vizibilă supraalocarea. Dacă doriți ca activitatea în sine să se desfășoare în alte zile, atribuiți activității un calendar propriu.

**„Dacă modificați calendarul proiectului, totul se mută.”** Se mută doar activitățile fără calendar propriu. O activitate căreia i-ați atribuit dumneavoastră un calendar din listă îl păstrează, chiar dacă acesta este întâmplător vechiul calendar al proiectului. Dacă ștergeți un calendar, activitățile și resursele care îl foloseau revin la calendarul proiectului.

**„Sărbătorile sunt incluse, nu?”** Sărbătorile există doar pentru anii pentru care au fost create. O zi din afara acelor ani este pur și simplu o zi lucrătoare. În dialogul calendarului, aplicația spune acest lucru cu *Sărbătorile acoperă 2025–2028; proiectul merge până în 2030. Regenerați?*

**„Mai multe ore pe zi îmi scurtează activitatea.”** Nu pentru o activitate pe zile: se numără zile lucrătoare întregi, indiferent dacă ziua are 6 sau 8 ore. Doar pentru o activitate cu resurse și regula de lucru *Muncă fixă* sau *Unități fixe* durata se schimbă odată cu acestea.

**Un calendar fără zile lucrătoare** nu poate fi calculat de aplicație. Calculul afișează *Calendarul nu are zile lucrătoare setate*.

## Vezi și

- [Zile și ore](docs://uitleg-dagen-en-uren): cum numără aplicația orele de lucru și ce se întâmplă când se întâlnesc activitățile pe zile cu cele pe ore.
- [Crearea și atribuirea unui calendar](docs://howto-kalender-maken-en-toewijzen): pașii pentru a crea un calendar propriu și a-l atribui activităților.
- [Generarea sărbătorilor și a concediului colectiv din construcții](docs://howto-feestdagen-genereren): completarea sărbătorilor unei țări și a concediului colectiv din construcții.
- [Configurarea calendarului unei resurse](docs://howto-resourcekalender-instellen): înregistrarea disponibilității unei resurse.
- [Ferestrele calendarului](docs://ref-kalenders): toate câmpurile ferestrelor de calendar.
