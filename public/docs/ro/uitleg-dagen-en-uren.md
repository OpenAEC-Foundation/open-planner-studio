# Zile și ore

O activitate pe zile de 2 zile și o activitate pe ore de 16 ore arată la fel, dar aplicația le calculează diferit. De ce puteți alege între zile și ore? Și ce se întâmplă când o activitate pe ore este legată de o activitate pe zile? În acest articol citiți cum numără aplicația zilele și orele și unde rotunjește. Exemplul lucrat arată cifrele.

## Conceptul

O **activitate pe zile** are o durată în zile lucrătoare întregi, de exemplu `5d`. Ocupă zile lucrătoare complete. În calendarul standard are o dată de început și una de sfârșit, fără oră.

O **activitate pe ore** are o durată în ore de lucru, de exemplu `12h` sau `1h 30m`. Are un început și un sfârșit cu oră, de exemplu marți, ora 11:00.

Unitatea aparține activității, nu proiectului. Puteți combina activități pe zile și activități pe ore în aceeași planificare. Aceasta se numește **planificare mixtă**.

Folosiți orele pentru lucrări care nu încap în zile întregi: o macara pe care o închiriați pentru douăsprezece ore, o turnare de șase ore, o activitate care poate începe abia după pauza de prânz. Pentru tot restul, zilele sunt suficiente și mai clare.

**Planificarea pe ore** este dezactivată implicit. Cât timp este dezactivată, aplicația lucrează în zile. Dacă un fișier conține totuși planificare pe ore, de exemplu activități pe ore, aplicația afișează *Acest fișier conține planificare pe ore.* Aceste activități sunt calculate în continuare, dar durata lor poate fi modificată abia după ce activați planificarea pe ore.

## Cum calculează aplicația

### Intervale de timp de lucru și ore nete

Fiecare calendar are **intervale** pentru fiecare zi lucrătoare (în aplicație se numesc *bands*). Calendarul standard are intervalele de la 07:00 la 12:00 și de la 13:00 la 16:00. Spațiul dintre ele este pauza. Aplicația deduce aceste intervale din *Început (oră)*, *Sfârșit (oră)* și pauza din calendar. Pentru asta nu trebuie să setați nimic. Dacă setați intervale proprii pe zi a săptămânii, acestea au prioritate.

**Orele nete pe zi** sunt suma intervalelor unei zile lucrătoare. Dacă zilele lucrătoare au lungimi diferite, se aplică totalul zilnic cel mai frecvent și, la egalitate, cel mai mare. Cu patru zile de 8 ore și o vineri de 5 ore, orele nete pe zi sunt deci 8.

### O activitate pe ore

Aplicația numără minutele de lucru de la început, prin intervalele de timp de lucru. Pauzele, serile, weekendurile și sărbătorile nu se numără. O activitate de 12 ore nu încape deci într-o zi lucrătoare de 8 ore: continuă în ziua următoare.

### O activitate pe zile

Aplicația numără zile lucrătoare întregi. Orele pe zi nu joacă niciun rol. O activitate de 5 zile se încheie în aceeași zi, indiferent dacă în calendar sunt 6 sau 8 ore pe zi.

### Conversia zilelor și orelor

O zi este orele nete pe zi din calendarul activității. Aplicația folosește această valoare în trei locuri:

- Pentru *Afișare durată*. În *Setări › Proiect › Setări*, fila *Afișare*, alegeți *Automat (unitatea proprie a fiecărei activități)*, *Întotdeauna zile* sau *Întotdeauna ore*. O activitate de 18 ore apare sub *Întotdeauna zile* ca `2.25d(18h)`: unitatea proprie rămâne între paranteze.
- Pentru un decalaj în ore după o activitate pe zile (vezi *Rotunjirea*).
- Când modificați unitatea unei activități. Aplicația numără atunci zilele de la începutul activității, fiecare zi cu orele ei, și face o propunere doar dacă rezultatul este exact. Două zile devin `16h`. Într-un calendar în care vinerea are 5 ore, 5 zile de la luni devin `37h`. Douăsprezece ore nu pot fi transformate în zile întregi într-un calendar cu zile de 8 ore: aplicația lasă atunci unitatea cum este.

### Activități pe zile și activități pe ore împreună

Regulile de mai jos se aplică unei dependențe sfârșit-început într-un calendar fără intervale de timp de lucru proprii, cum este calendarul standard.

- **Oră → oră.** Succesorul începe în momentul în care predecesorul s-a încheiat, chiar dacă acesta este la mijlocul unei zile.
- **Oră → zi.** O activitate pe zile nu începe niciodată la mijlocul unei zile. Începe în prima zi lucrătoare de după ziua în care se încheie activitatea pe ore. Restul acelei zile rămâne neutilizat și revine ca marjă a activității pe ore.
- **Zi → oră.** O activitate pe zile ocupă toată ultima zi. Activitatea pe ore începe în prima zi lucrătoare de după ea, la începutul primului interval de timp de lucru.

### Rotunjirea

Aplicația rotunjește sau refuză în patru locuri:

- **O activitate pe zile după o activitate pe ore** începe în următoarea zi lucrătoare. Activitatea pe ore este, ca să spunem așa, rotunjită în sus la zile întregi.
- **Un decalaj în ore** se numără în calendarul decalajului, implicit cel al predecesorului. Dacă predecesorul este o activitate pe zile pe un calendar fără intervale de timp de lucru proprii, cum este calendarul standard, aplicația convertește decalajul în zile lucrătoare întregi: decalajul împărțit la orele nete pe zi, rotunjit la un număr întreg; jumătatea de zi se rotunjește în sus. La 8 ore pe zi, 1 oră înseamnă 0 zile, 4 ore înseamnă 1 zi și 12 ore înseamnă 2 zile. Acest lucru se aplică și dacă succesorul este o activitate pe ore. Dacă predecesorul este o activitate pe ore, sau dacă calendarul lui are intervale de timp de lucru proprii, decalajul se numără exact în ore de lucru, iar pauza nu se numără.
- **O durată în zile** este întotdeauna un număr întreg. Dacă scrieți `1.5d`, aplicația afișează *Introduceți un număr întreg de zile sau de ore, de exemplu 2d sau 12h.* O durată în ore poate fi `1.5h` sau `1h 30m`.
- **Modificarea unității** are loc numai dacă rezultatul este exact (vezi mai sus).

## Exemplu lucrat: macaraua

Calendarul este de luni până vineri, de la 07:00 la 12:00 și de la 13:00 la 16:00: 8 ore nete pe zi. Proiectul începe luni, 7 iunie 2027.

### Oră, oră și zi

*Place crane* durează 12 ore. Luni are 8 ore de lucru (5 până la 12:00 și 3 după pauză), iar marți ultimele 4 ore. Activitatea se desfășoară de luni, de la 07:00, până la **marți, 8 iunie, la 11:00**.

*Adjust elements* durează 8 ore și urmează cu o dependență sfârșit-început. Începe imediat marți la 11:00: adică 1 oră până la pauză și 3 ore după ea. Ultimele 4 ore sunt miercuri de la 07:00 până la 11:00. Sfârșitul este **miercuri, 9 iunie, la 11:00**.

*Finishing* durează 2 zile și urmează după *Adjust elements*. O activitate pe zile nu începe la mijlocul unei zile, deci începe **joi, 10 iunie** și se încheie vineri, 11 iunie.

### Rotunjirea la trecere

Dacă lăsați afară *Adjust elements* și legați *Finishing* direct de *Place crane*, *Finishing* începe miercuri, 9 iunie, și se încheie joi, 10 iunie. Restul zilei de marți (4 ore de lucru) nu poate fi folosit. Aceste 4 ore le vedeți din nou ca marjă totală a activității *Place crane*: o jumătate de zi lucrătoare.

Dacă inversați ordinea, este mai simplu. *Pour foundation* durează 2 zile, de la luni, 7 iunie, până marți, 8 iunie. *Place crane* durează acum 4 ore și urmează. Începe **miercuri, 9 iunie, la 07:00** și se încheie la 11:00.

### Un decalaj în ore

Între *Place crane* (12 ore) și *Adjust elements* (8 ore) puneți un decalaj de 2 ore. *Adjust elements* nu începe atunci la 11:00, ci marți la **14:00**: 1 oră până la pauză și 1 oră după ea. Sfârșitul se mută la **miercuri, 9 iunie, la 14:00**.

După o activitate pe zile, un decalaj funcționează altfel. *Pour foundation* se încheie marți, 8 iunie. Fără decalaj, *Finishing* începe miercuri, 9 iunie. Cu un decalaj de 4 ore, care este o jumătate de zi, aplicația rotunjește în sus: *Finishing* începe **joi, 10 iunie**. Cu un decalaj de 1 oră, aplicația rotunjește în jos, iar *Finishing* începe pur și simplu miercuri.

### O după-amiază liberă de vineri

Acum vinerea are un singur interval, de la 07:00 la 12:00: 5 ore. Celelalte zile rămân la 8 ore. Orele nete pe zi rămân 8, pentru că acesta este totalul zilnic cel mai frecvent. O săptămână are acum 37 de ore de lucru.

O activitate pe ore de 40 de ore de la luni, 7 iunie, la 07:00 folosește de luni până joi (32 de ore) și vinerea (5 ore). Ultimele 3 ore cad luni următoare, de la 07:00 la 10:00. Sfârșitul este **luni, 14 iunie, la 10:00**. O activitate pe zile de 5 zile ar ocupa 37 de ore începând de luni, iar aceasta este propunerea aplicației dacă modificați unitatea de la 5 zile la ore.

În tutorialul 4, despre planificarea pe ore, planificați singur o lucrare cu macara în ore.

## Consecințe și neînțelegeri

**"8 ore înseamnă 1 zi."** Doar dacă în calendar zilele au 8 ore. În calendarul cu vinerea liberă după-amiaza, 5 zile înseamnă 37 de ore, nu 40.

**"Dacă setez mai multe ore pe zi, activitatea mea pe zile se încheie mai devreme."** Nu. O activitate pe zile numără zile lucrătoare întregi. Orele pe zi schimbă doar valoarea unei zile în ore, de exemplu în afișare și pentru un decalaj în ore. Doar pentru o activitate cu resurse și cu regula de lucru *Muncă fixă* sau *Unități fixe*, durata se modifică odată cu orele, pentru că lucrul rămâne același: 40 de ore de lucru înseamnă 5 zile la 8 ore pe zi și 7 zile la 6 ore pe zi.

**"O activitate pe ore de 8 ore durează o zi."** Doar dacă începe la începutul zilei. Dacă începe mai târziu, ca *Adjust elements* marți la 11:00, continuă în ziua următoare.

**Un calendar cu intervale de timp de lucru proprii** se comportă altfel decât calendarul standard. Un astfel de calendar îl obțineți dacă setați timpul de lucru pe zi a săptămânii sau dacă alegeți un model de ture (*2 ture*, *3 ture*, *Tură de noapte* sau *24/7*). Pe un astfel de calendar, un decalaj în ore se numără exact în ore de lucru, și după o activitate pe zile.

**Dezactivarea planificării pe ore nu șterge nimic.** Activitățile pe ore rămân și sunt calculate în continuare, dar nu le puteți modifica până când activați din nou planificarea pe ore.

## Vezi și

- [Activarea planificării pe ore](docs://howto-urenplanning-aanzetten): pașii pentru a planifica o activitate pe ore.
- [Setarea timpului de lucru](docs://howto-werktijden-instellen): ajustarea intervalelor de timp de lucru ale unui calendar.
- [Calendare și zile lucrătoare](docs://uitleg-kalenders): cum numără aplicația zilele lucrătoare și care calendar câștigă.
- [Adăugarea dependențelor](docs://howto-relaties-leggen): pașii pentru a adăuga o dependență sau un decalaj.
