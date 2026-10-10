# Biblioteca de resurse

Echipa dumneavoastră de zidari nu lucrează pentru un singur proiect. Astăzi lucrează la casele din nord, mâine la garajele din sud. O bibliotecă de resurse este locul unde înregistrați o asemenea echipă o singură dată, astfel încât fiecare proiect să folosească aceeași echipă. Aplicația poate vedea apoi și când două proiecte cer aceleași persoane în aceeași zi, lucru pe care niciun proiect singur nu îl poate vedea. În acest articol citiți cum sunt legate între ele biblioteca și proiectul și cum numără aplicația ocuparea în mai multe proiecte.

## Conceptul

Există două niveluri.

**Biblioteca de resurse** este lista resurselor și a calendarelor care aparțin organizației dumneavoastră: un zidar, o macara, un tencuitor, cu tipul, tariful standard și câte exemplare aveți. Lista în sine, pe care aplicația o numește și **biblioteca de resurse**, nu se află în fișierele proiectului, ci în aplicație: în aplicația desktop, într-un fișier de pe acest calculator, iar în browser, în spațiul de stocare al acelui browser. Dacă ștergeți datele site-ului din browser, biblioteca se pierde; de aceea exportați-o ca rezervă. Există întotdeauna cel puțin o bibliotecă. Prima se numește *Mijn resourcebibliotheek* (un nume în olandeză), iar o puteți redenumi.

**Proiectul** decide cât din fiecare resursă folosește și când. Un proiect este legat de o bibliotecă sau există independent. Un proiect independent funcționează bine, doar fără o listă comună.

Un proiect nu indică spre bibliotecă, ci păstrează o **copie**. Când atribuiți *Bricklayer* din bibliotecă unui proiect, aplicația face o copie în proiect cu un **marcaj de origine**: nota că această copie provine din biblioteca X și este elementul Y de acolo. În tabelul de resurse recunoașteți o astfel de copie după o mică pictogramă a bibliotecii. Copia este o resursă obișnuită: activitățile pot fi atribuite ei, iar ea este salvată în chiar fișierul proiectului.

Calendarele din biblioteca de resurse sunt altceva decât lista de calendare a proiectului, pe care o gestionați în fereastra de calendare. Un calendar din bibliotecă ajunge în proiect împreună cu resursa care îl folosește.

## Cum lucrează aplicația cu ea

### Ce decide biblioteca și ce decide proiectul

Biblioteca decide **ce este o resursă**: numele, tipul, tariful standard pe oră, unitatea și descrierea. Într-o copie din proiect, aceste câmpuri apar ca text simplu. Le modificați în bibliotecă, pentru ca ele să fie corecte în fiecare proiect. Dacă totuși doriți ca o copie să urmeze drumul ei, o dezlegați de bibliotecă.

Proiectul decide **cât și când**: *Capacitate maximă*, capacitatea care se schimbă în timp (*Capacitate pe etape de timp*) și ce calendar are resursa. Aceste câmpuri rămân editabile în proiect și nu se consideră abatere de la bibliotecă. De altfel, aceeași echipă poate lucra cu alt calendar la o lucrare urgentă decât la un proiect obișnuit. Conținutul unui calendar care a venit împreună cu o resursă urmează totuși biblioteca.

### Când urmează copia modificările

Biblioteca nu actualizează copiile continuu, ci în momente fixe:

- Când modificați ceva în bibliotecă, copiile nemodificate din toate proiectele deschise urmează imediat.
- Când deschideți un proiect sau treceți la altă filă, aplicația compară copiile cu biblioteca. Dacă o copie nemodificată este în urmă, aplicația o actualizează discret și anunță scurt acest lucru: *Un element actualizat din bibliotecă* sau *N elemente actualizate din bibliotecă*.

Aplicația ține minte valorile din momentul în care copia a fost făcută sau actualizată. Dacă o copie diferă acum de acestea, aplicația nu decide cine are dreptate. Copia primește atunci marcajul *diferă — decideți*. Când deschideți un fișier cu o astfel de copie, se deschide singură fereastra *Legare bibliotecă de resurse*. Acolo alegeți, pentru fiecare element, dacă se aplică valorile din bibliotecă sau dacă valorile din fișierul dumneavoastră intră în bibliotecă. Când schimbați fila, nu apare niciodată o fereastră.

O abatere apare, de exemplu, când legați o resursă proprie din proiect de un element din bibliotecă cu același nume, dar cu alte valori, prin *Trecere în bibliotecă*. Aplicația le leagă totuși și marchează imediat copia cu o abatere.

### Când dispare o resursă din bibliotecă

Dacă ștergeți o resursă din bibliotecă, copia rămâne în proiectele dumneavoastră și funcționează în continuare. Ea primește marcajul *nu mai este în bibliotecă*, iar apoi o puteți edita complet sau o puteți scoate din proiect.

### Ocuparea în mai multe proiecte

Histograma și supraalocarea dintr-un proiect se uită doar la acel proiect. Biblioteca știe mai mult: câte exemplare ale unei resurse există în total. Vizualizarea *Ocupare* adună, pe zi, sarcina tuturor proiectelor deschise care sunt legate de aceeași bibliotecă și folosesc o copie a acelei resurse. Dacă suma pe o zi este mai mare decât capacitatea bibliotecii, ziua respectivă se consideră cu supraalocare.

Trei reguli decid ce se numără:

- Capacitatea vine din bibliotecă (*Capacitate maximă* a elementului din bibliotecă sau *Capacitate pe etape de timp* a acesteia în ziua respectivă), nu din *Capacitate maximă* a copiei din proiect. Două proiecte care rămân fiecare în propria alocare pot, deci, să ceară totuși prea mult împreună.
- O sumă exact egală cu capacitatea nu este un conflict. Trebuie cerut mai mult decât capacitatea.
- Se numără doar copiile cu marcaj de origine și doar în proiectele care sunt deschise în această aplicație în acel moment. O resursă proprie a unui singur proiect nu este în bibliotecă și, prin urmare, nu se numără. Prezentarea generală nu vede documentele care nu sunt deschise în această aplicație; acest lucru este precizat și în partea de jos a prezentării generale.

## Exemplu practic: echipa de zidari în două proiecte

Biblioteca conține resursa *Bricklayer* cu *Capacitate maximă* 3: trei zidari pe statul de plată. Două proiecte o folosesc, ambele cu o copie care are *Capacitate maximă* 2.

- Proiectul *Houses North* are activitatea *Bricklaying facades* de 5 zile lucrătoare, de la luni 7 iunie 2027, cu 2 unități de atribuire pe zi. Activitatea rulează de la 7 la 11 iunie, inclusiv.
- Proiectul *Garages South* are activitatea *Bricklaying garages* de 4 zile lucrătoare, de la miercuri 9 iunie 2027, cu 2 unități de atribuire pe zi. Weekendul nu se numără, deci activitatea acoperă 9, 10, 11 și 14 iunie.

În fiecare proiect se cer zidarului 2 din cele 2 unități ale sale. Niciunul dintre proiecte nu indică supraalocare: la *Resurse › Supraalocare* ambele indică *Fără*. Totuși, împreună depășesc cei 3 zidari. Pe zi, aplicația numără:

- Luni 7 și marți 8 iunie: 2 (doar Houses North)
- Miercuri 9, joi 10 și vineri 11 iunie: 2 + 2 = 4
- Luni 14 iunie: 2 (doar Garages South)

Vârful este 4, față de o capacitate de 3. Prezentarea generală arată zidarul cu *2 documente*, perioada *2027-06-07 – 2027-06-14*, *4.0 / 3.0* pentru vârf și capacitate, și *3 zile cu supraalocare*: 9, 10 și 11 iunie.

Ce se întâmplă dacă schimbați ceva:

- Dacă *Bricklaying facades* durează 6 zile lucrătoare, se întinde până luni 14 iunie. Și în acea zi se ajunge la 2 + 2 = 4, deci prezentarea generală indică *4 zile cu supraalocare*: 9, 10, 11 și 14 iunie. Vârful rămâne 4.
- Dacă biblioteca are *Capacitate maximă* 4, indică *4.0 / 4.0* și nu există conflict, pentru că suma nu este mai mare decât capacitatea.
- Dacă *Garages South* lucrează cu 1 unitate de atribuire pe zi în loc de 2, vârful este 3 și indică *3.0 / 3.0*: fără conflict.
- Dacă *Garages South* începe abia luni 14 iunie, proiectele nu se suprapun. Perioada devine *2027-06-07 – 2027-06-17*, iar vârful este *2.0 / 3.0*.

Pașii pentru a vedea acest lucru în proiectele dumneavoastră se găsesc în [Utilizarea prezentării generale a ocupării](docs://howto-bezettingsoverzicht-gebruiken).

## Consecințe și concepții greșite

**"Biblioteca este comună cu colegii mei."** Nu. Biblioteca se află în aplicație (în aplicația desktop, într-un fișier de pe acest calculator, iar în browser, în spațiul de stocare al acelui browser) și nu se sincronizează. Dacă doi planificatori lucrează cu aceeași bibliotecă de resurse, bibliotecile lor pot diferi. Puteți partaja prin export și import, consultați [Gestionarea și partajarea bibliotecilor de resurse](docs://howto-bibliotheken-beheren). Dacă organizația dumneavoastră împarte echipe între companii operaționale, alegeți deliberat o singură bibliotecă comună. Prezentarea generală vede, de asemenea, doar proiectele deschise în această aplicație.

**"Dacă modificați biblioteca, totul din proiectele dumneavoastră se schimbă."** Doar identitatea resursei: numele, tipul, tariful, unitatea și descrierea. *Capacitate maximă*, capacitatea în timp și alegerea calendarului unui proiect rămân cum sunt.

**"Pot anula o modificare în bibliotecă."** Nu. Biblioteca aparține aplicației, nu unui proiect, deci modificările din ea sunt în afara *Anulare* (Ctrl+Z). Vizualizarea *Bibliotecă* avertizează singură despre acest lucru: *Aceasta modifică biblioteca și se aplică tuturor proiectelor — nu poate fi anulată.* Ștergerea din bibliotecă cere, de asemenea, confirmare și nu poate fi anulată.

**"Prezentarea generală a ocupării rezolvă supraalocarea."** Nu, prezentarea generală este doar o fereastră de consultare. Ea arată pe ce zile două proiecte cer împreună prea mult. Redistribuirea (*Resurse › Redistribuire › Nivel…*, consultați [Redistribuirea resurselor](docs://uitleg-nivelleren)) se uită la resursele unui singur proiect și nu ia în calcul celelalte proiecte. Mutați dumneavoastră o activitate într-unul dintre proiecte sau schimbați capacitatea în bibliotecă, dacă cineva se alătură cu adevărat.

**"Resursa mea proprie se numără în ocupare."** Doar dacă este în bibliotecă. O resursă pe care ați creat-o doar în proiect, de exemplu o macara închiriată pentru o singură lucrare, nu are marcaj de origine și, prin urmare, nu este în prezentarea generală. Cu *Trecere în bibliotecă* o adăugați.

## Vezi și

- [Utilizarea bibliotecii de resurse](docs://howto-resourcebibliotheek-gebruiken): legarea, atribuirea resurselor și rezolvarea abaterilor.
- [Gestionarea și partajarea bibliotecilor de resurse](docs://howto-bibliotheken-beheren): crearea, exportul și importul bibliotecilor.
- [Utilizarea prezentării generale a ocupării](docs://howto-bezettingsoverzicht-gebruiken): găsirea supraalocărilor între proiecte.
- [Gestionarea resurselor](docs://howto-resources-beheren): resursele unui singur proiect.
