# Generarea sărbătorilor și a concediului colectiv din construcții

Obiectiv: să introduceți în calendar sărbătorile unei țări și, dacă este cazul, concediul colectiv din construcții. Adăugați, dacă este nevoie, o zi sau o perioadă liberă proprie.

## Când aveți nevoie de aceasta

Fără sărbători, aplicația planifică pur și simplu lucru și în ziua de Crăciun sau în Ziua Regelui. Un proiect nou primește deja sărbătorile din Țările de Jos, dacă *Mod construcții* este activat. Generați din nou sărbătorile dacă aveți nevoie de altă țară sau de altă regiune, dacă doriți să includeți concediul colectiv din construcții sau dacă proiectul dumneavoastră nu se încadrează în anii pentru care au fost create sărbătorile. Acei ani contează: pentru aplicație, o zi din afara lor este pur și simplu o zi lucrătoare. Modul în care aplicația ține cont de o sărbătoare la numărare îl puteți citi în [Calendare și zile lucrătoare](docs://uitleg-kalenders).

**Concediul colectiv din construcții** (*bouwvak*) este concediul colectiv din sectorul construcțiilor din Țările de Jos, trei săptămâni vara. În aplicație, este implicit dezactivat.

## Pași

### Generarea sărbătorilor

1. Alegeți *Planificare › Calendar › Calendar* și selectați în stânga calendarul în care trebuie introduse sărbătorile.
2. Faceți clic pe *Generare sărbători…*. Sub buton se deschide un bloc cu opțiunile.
3. Alegeți *Țară*: Țările de Jos, Germania, Belgia, Franța, Regatul Unit, Austria, Elveția sau *Fără sărbători*. Pentru unele țări apare și o listă *Regiune*, de exemplu un land din Germania. *Național* păstrează doar sărbătorile care se aplică peste tot.
4. Pentru Țările de Jos, alegeți *Concediu colectiv din construcții*: *Niciuna* (implicit), *Nord*, *Centru* sau *Sud*. Concediul colectiv din construcții apare ca o perioadă în listă, de exemplu *Bouwvak (Noord)*, trei săptămâni de luni până vineri. Vedeți această alegere doar dacă *Mod construcții* este activat.
5. Sub opțiuni există un rezumat, de exemplu *21 sărbători, 2026–2028*. Faceți clic pe el ca să vedeți datele.
6. Faceți clic pe *Generare*. Lista *Sărbători* este acum completată.
7. Faceți clic pe *Aplicare*. Aplicația recalculează imediat planificarea.

Pentru Țările de Jos, aplicația pune în listă în fiecare an Nieuwjaar, Goede Vrijdag, Pasen (două zile), Koningsdag, Hemelvaart, Pinksteren (două zile) și Kerst (25 și 26 decembrie) (Anul Nou, Vinerea Mare, Paștele, Ziua Regelui, Înălțarea Domnului, Rusaliile și Crăciunul). Dacă Ziua Regelui cade duminică, ea este pe 26 aprilie. Bevrijdingsdag (Ziua Eliberării) apare în listă doar în anii de lustru, de exemplu 2025 și 2030.

Anii depind de perioada proiectului: de la anul dinaintea datei de început până la anul de după data de sfârșit. Dacă proiectul nu are dată de sfârșit, până la trei ani după anul datei de început. Modificați data de început și data de sfârșit în *Setări › Proiect › Informații proiect*.

### Regenerarea după o nouă perioadă a proiectului

Dacă perioada proiectului se schimbă sau primește o dată de sfârșit mai târzie, sărbătorile nu mai acoperă anii noi. Aplicația afișează asta în fereastra *Calendare*, de exemplu *Sărbătorile acoperă 2025–2028; proiectul merge până în 2030. Regenerați?* Apoi faceți clic pe *Regenerare*. Aplicația folosește pentru anii proiectului aceleași opțiuni ca data trecută (țara, regiunea, concediul colectiv din construcții). Apoi faceți clic pe *Aplicare*. Vedeți acest mesaj doar pentru un calendar pentru care sărbătorile au fost generate anterior.

### Adăugarea unei zile sau a unei perioade libere proprii

1. În fereastra *Calendare*, faceți clic pe *Adăugare sărbătoare*. La capătul listei apare un rând nou, cu data de azi sub *De la*.
2. Completați *Descriere*, de exemplu *Excursie de firmă*.
3. Modificați *De la*. Lăsați *Până la* gol pentru o singură zi sau completați ultima zi liberă pentru o perioadă, de exemplu pentru o vacanță de iarnă.
4. Faceți clic pe *Aplicare*.

Cu pictograma coș de gunoi de lângă un rând ștergeți o sărbătoare.

### Ștergerea tuturor sărbătorilor

Alegeți *Fără sărbători* sub *Țară* și faceți clic pe *Generare*. Lista rămâne apoi goală.

## Capcane și ce face aplicația atunci

**Generarea înlocuiește toată lista.** Și zilele pe care le-ați adăugat singuri dispar. Adăugați-le din nou după aceea.

**Goede Vrijdag este inclusă.** Dacă firma dumneavoastră lucrează în Vinerea Mare sau în Ziua Eliberării dintr-un an de lustru, ștergeți rândul respectiv cu pictograma coș de gunoi.

**Datele concediului colectiv din construcții sunt date orientative.** Aplicația le cunoaște pentru 2025 până la 2028 inclusiv. Pentru alți ani face o estimare aproximativă. Cu un concediu colectiv din construcții ales, aplicația afișează deci *Date orientative — verificați la Bouwend Nederland*. Ajustați perioada din listă, dacă este nevoie.

**Un rând nevalid.** Un rând fără o dată validă la *De la*, o dată *Până la* înaintea lui *De la* sau o dată ilizibilă primește un mesaj roșu, de exemplu *Data de sfârșit este înaintea datei de început.* *Aplicare* este dezactivat până când îl corectați.

**Pentru un proiect nou.** Fereastra *Creare proiect nou* are aceleași opțiuni sub *Set de sărbători*. Cu *Particularizat…* porniți fără sărbători. După creare se deschide fereastra *Calendare*, ca să le completați singuri.

## Vezi și

- [Calendare și zile lucrătoare](docs://uitleg-kalenders): cum ține aplicația cont de sărbători și de concediul colectiv din construcții la numărarea zilelor lucrătoare.
- [Crearea și atribuirea unui calendar](docs://howto-kalender-maken-en-toewijzen): cum creați un calendar propriu în care să introduceți sărbători.
- [Ferestrele calendarului](docs://ref-kalenders): toate câmpurile ferestrelor de calendar.
- [Proiect nou și Informații proiect](docs://ref-projectinfo): setul de sărbători pentru un proiect nou.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): pe lângă sărbători, calendarul proiectului are o perioadă liberă *Frost delay, foundations*.
